import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../config';
import type { AthleteMentalProgress, MentalCheckIn, PulseCheckDailyAssignment, PulseCheckStateSnapshot } from './types';
import {
  pulseCheckStateSnapshotFromFirestore,
  pulseCheckStateSnapshotToFirestore,
} from './types';
import { PULSECHECK_STATE_SNAPSHOTS_COLLECTION } from './collections';
import { DurationMode, SessionType, TaxonomyModifier } from './taxonomy';

const COLLECTION = PULSECHECK_STATE_SNAPSHOTS_COLLECTION;

const buildSnapshotId = (athleteId: string, sourceDate: string) => `${athleteId}_${sourceDate}`;

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

const normalizedReadinessScore = ({
  checkIn,
  progress,
}: {
  checkIn: MentalCheckIn;
  progress?: AthleteMentalProgress | null;
}) => {
  const profileReadiness = progress?.taxonomyProfile?.modifierScores?.[TaxonomyModifier.Readiness];
  if (typeof profileReadiness === 'number' && Number.isFinite(profileReadiness)) {
    return clamp(profileReadiness);
  }

  return clamp(((checkIn.readinessScore - 1) / 4) * 100);
};

const deriveDimensions = ({
  checkIn,
  progress,
}: {
  checkIn: MentalCheckIn;
  progress?: AthleteMentalProgress | null;
}) => {
  const readiness = normalizedReadinessScore({ checkIn, progress });
  const energy = typeof checkIn.energyLevel === 'number' ? ((checkIn.energyLevel - 1) / 4) * 100 : readiness;
  const stress = typeof checkIn.stressLevel === 'number' ? ((checkIn.stressLevel - 1) / 4) * 100 : 100 - readiness;
  const sleep = typeof checkIn.sleepQuality === 'number' ? ((checkIn.sleepQuality - 1) / 4) * 100 : readiness;
  const fatigability = progress?.taxonomyProfile?.modifierScores?.[TaxonomyModifier.Fatigability];
  const pressureSensitivity = progress?.taxonomyProfile?.modifierScores?.[TaxonomyModifier.PressureSensitivity];

  return {
    activation: clamp(stress * 0.65 + (pressureSensitivity ?? stress) * 0.35),
    focusReadiness: clamp(readiness * 0.55 + energy * 0.3 + sleep * 0.15),
    emotionalLoad: clamp(stress * 0.7 + (100 - readiness) * 0.3),
    cognitiveFatigue: clamp((100 - sleep) * 0.55 + (100 - energy) * 0.3 + (fatigability ?? (100 - readiness)) * 0.15),
  };
};

const deriveOverallReadiness = ({
  readinessScore,
  dimensions,
}: {
  readinessScore: number;
  dimensions: PulseCheckStateSnapshot['stateDimensions'];
}): PulseCheckStateSnapshot['overallReadiness'] => {
  if (readinessScore >= 70 && dimensions.focusReadiness >= 65 && dimensions.cognitiveFatigue <= 45) return 'green';
  if (readinessScore < 45 || dimensions.cognitiveFatigue >= 70 || dimensions.emotionalLoad >= 70) return 'red';
  return 'yellow';
};

const deriveConfidence = ({
  checkIn,
  progress,
}: {
  checkIn: MentalCheckIn;
  progress?: AthleteMentalProgress | null;
}): PulseCheckStateSnapshot['confidence'] => {
  let signalCount = 1; // explicit self-report
  if (typeof checkIn.energyLevel === 'number') signalCount += 1;
  if (typeof checkIn.stressLevel === 'number') signalCount += 1;
  if (typeof checkIn.sleepQuality === 'number') signalCount += 1;
  if (checkIn.taxonomyState) signalCount += 1;
  if (progress?.taxonomyProfile) signalCount += 1;

  if (signalCount >= 4) return 'high';
  if (signalCount >= 2) return 'medium';
  return 'low';
};

const deriveRouting = ({
  readiness,
  progress,
}: {
  readiness: PulseCheckStateSnapshot['overallReadiness'];
  progress?: AthleteMentalProgress | null;
}): PulseCheckStateSnapshot['recommendedRouting'] => {
  const sessionType = progress?.activeProgram?.sessionType;
  if (readiness === 'red') {
    return sessionType === SessionType.RecoveryRep ? 'protocol_only' : 'defer_alternate_path';
  }
  if (readiness === 'yellow') {
    return 'protocol_then_sim';
  }
  if (sessionType === SessionType.Reassessment) return 'trial_only';
  return 'sim_only';
};

const deriveProtocolClass = ({
  dimensions,
  progress,
}: {
  dimensions: PulseCheckStateSnapshot['stateDimensions'];
  progress?: AthleteMentalProgress | null;
}): PulseCheckStateSnapshot['recommendedProtocolClass'] => {
  const sessionType = progress?.activeProgram?.sessionType;
  if (sessionType === SessionType.RecoveryRep || dimensions.cognitiveFatigue >= 70) return 'recovery';
  if (dimensions.activation >= 65 || dimensions.emotionalLoad >= 65) return 'regulation';
  if (dimensions.focusReadiness <= 45) return 'priming';
  return 'none';
};

const deriveContextTags = (progress?: AthleteMentalProgress | null): string[] => {
  const tags = new Set<string>();
  const sessionType = progress?.activeProgram?.sessionType;
  const durationMode = progress?.activeProgram?.durationMode;

  if (sessionType) tags.add(sessionType);
  if (durationMode) tags.add(durationMode);
  if (durationMode === DurationMode.ExtendedStressTest) tags.add('high_load_window');

  return Array.from(tags);
};

export const stateSnapshotService = {
  buildId(athleteId: string, sourceDate: string) {
    return buildSnapshotId(athleteId, sourceDate);
  },

  async getById(id: string): Promise<PulseCheckStateSnapshot | null> {
    const snapshot = await getDoc(doc(db, COLLECTION, id));
    if (!snapshot.exists()) return null;
    return pulseCheckStateSnapshotFromFirestore(snapshot.id, snapshot.data() as Record<string, any>);
  },

  async getForAthleteOnDate(athleteId: string, sourceDate: string): Promise<PulseCheckStateSnapshot | null> {
    return this.getById(buildSnapshotId(athleteId, sourceDate));
  },

  async getLatestForAthlete(athleteId: string): Promise<PulseCheckStateSnapshot | null> {
    const snapshots = await this.listForAthlete(athleteId);

    return snapshots[0] || null;
  },

  async listForAthlete(athleteId: string): Promise<PulseCheckStateSnapshot[]> {
    const snapshot = await getDocs(
      query(collection(db, COLLECTION), where('athleteId', '==', athleteId))
    );

    return snapshot.docs
      .map((entry) => pulseCheckStateSnapshotFromFirestore(entry.id, entry.data() as Record<string, any>))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  },

  async getClosestForAthleteAtOrBefore(athleteId: string, capturedAt: number): Promise<PulseCheckStateSnapshot | null> {
    const snapshots = await this.listForAthlete(athleteId);
    if (!snapshots.length) return null;

    const exactSourceDate = new Date(capturedAt).toISOString().slice(0, 10);
    const sameDay = snapshots.find((snapshot) => snapshot.sourceDate === exactSourceDate);
    if (sameDay) return sameDay;

    const prior = snapshots.find((snapshot) => snapshot.updatedAt <= capturedAt);
    if (prior) return prior;

    return snapshots.reduce<PulseCheckStateSnapshot | null>((closest, snapshot) => {
      if (!closest) return snapshot;
      return Math.abs(snapshot.updatedAt - capturedAt) < Math.abs(closest.updatedAt - capturedAt)
        ? snapshot
        : closest;
    }, null);
  },

  async upsertFromCheckIn({
    athleteId,
    checkIn,
    progress,
    existingAssignment,
  }: {
    athleteId: string;
    checkIn: MentalCheckIn;
    progress?: AthleteMentalProgress | null;
    existingAssignment?: PulseCheckDailyAssignment | null;
  }): Promise<PulseCheckStateSnapshot> {
    const now = Date.now();
    const snapshotId = buildSnapshotId(athleteId, checkIn.date);
    const existing = await this.getById(snapshotId);
    const readinessScore = normalizedReadinessScore({ checkIn, progress });
    const stateDimensions = deriveDimensions({ checkIn, progress });
    const overallReadiness = deriveOverallReadiness({ readinessScore, dimensions: stateDimensions });
    const confidence = deriveConfidence({ checkIn, progress });
    const nextSnapshot: PulseCheckStateSnapshot = {
      id: snapshotId,
      athleteId,
      sourceDate: checkIn.date,
      sourceCheckInId: checkIn.id,
      stateDimensions,
      overallReadiness,
      confidence,
      freshness: 'current',
      sourcesUsed: [
        'explicit_self_report',
        ...(checkIn.taxonomyState ? ['taxonomy_checkin_state'] : []),
        ...(progress?.taxonomyProfile ? ['taxonomy_profile'] : []),
        ...(progress?.activeProgram ? ['active_program_context'] : []),
      ],
      sourceEventIds: Array.from(new Set([...(existing?.sourceEventIds || []), checkIn.id])),
      contextTags: deriveContextTags(progress),
      recommendedRouting: deriveRouting({ readiness: overallReadiness, progress }),
      recommendedProtocolClass: deriveProtocolClass({ dimensions: stateDimensions, progress }),
      readinessScore,
      executionLink: existingAssignment?.id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await setDoc(doc(db, COLLECTION, snapshotId), pulseCheckStateSnapshotToFirestore(nextSnapshot), { merge: true });
    return nextSnapshot;
  },

  async attachExecutionLink(snapshotId: string, executionLink: string): Promise<void> {
    const existing = await this.getById(snapshotId);
    if (!existing) return;

    await setDoc(
      doc(db, COLLECTION, snapshotId),
      pulseCheckStateSnapshotToFirestore({
        ...existing,
        executionLink,
        updatedAt: Date.now(),
      }),
      { merge: true }
    );
  },
};
