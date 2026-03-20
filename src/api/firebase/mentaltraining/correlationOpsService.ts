import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config';
import { correlationEvidenceService } from './correlationEvidenceService';
import { correlationPatternService } from './correlationPatternService';
import { correlationProjectionService } from './correlationProjectionService';
import {
  ATHLETE_MENTAL_PROGRESS_COLLECTION,
  CORRELATION_ENGINE_MONITOR_EVENTS_COLLECTION,
  PROFILE_SNAPSHOTS_SUBCOLLECTION,
  RESEARCH_EXPORT_JOBS_COLLECTION,
} from './collections';
import { profileSnapshotService, type CanonicalProfileSnapshot, type ProfileSnapshotMilestoneType } from './profileSnapshotService';
import { simSessionService } from './simSessionService';
import type {
  AssessmentContextFlag,
  AthletePatternModel,
  CorrelationEvidenceRecord,
  CorrelationFreshnessTier,
  RecommendationProjection,
} from './correlationEngineTypes';
import { sanitizeFirestoreValue } from './types';
const RECOMPUTE_LIMIT = 60;

export interface CorrelationOpsInspectionSummary {
  athleteId: string;
  inspectedAt: number;
  evidenceCount: number;
  evidenceDensityDays: number;
  staleEvidenceCount: number;
  contradictionFlagCount: number;
  patternCount: number;
  degradedPatternCount: number;
  stalePatternCount: number;
  projectionCount: number;
  expiredProjectionCount: number;
  invalidProjectionCount: number;
  milestoneAssessmentCoverage: Record<string, {
    present: boolean;
    status: AssessmentContextFlag['status'] | 'missing';
    confidenceTier?: AssessmentContextFlag['confidenceTier'] | null;
  }>;
  alerts: string[];
}

export interface CorrelationMonitorEvent {
  id: string;
  athleteId: string;
  eventType:
    | 'evidence_write_failed'
    | 'low_evidence_density'
    | 'contradiction_spike'
    | 'projection_generate_failed'
    | 'stale_source_rate'
    | 'assessment_flag_missing'
    | 'recompute_completed';
  severity: 'info' | 'warning' | 'error';
  summary: string;
  details?: Record<string, unknown>;
  createdAt: number;
  resolvedAt?: number | null;
}

export interface CorrelationResearchBundle {
  athleteId: string;
  generatedAt: number;
  evidence: CorrelationEvidenceRecord[];
  patterns: AthletePatternModel[];
  projections: RecommendationProjection[];
  milestoneSnapshots: CanonicalProfileSnapshot[];
  simSessions: Array<Record<string, unknown>>;
  joinedRows: Array<{
    evidenceId: string;
    simSessionId: string;
    athleteLocalDate: string;
    sourceFamily: string;
    patternKeys: string[];
    projectionKeys: string[];
    milestoneSnapshotKeys: string[];
  }>;
}

export interface CorrelationResearchExportJob {
  id: string;
  dataset: 'correlation_research_bundle_v1' | 'correlation_ops_audit_v1';
  athleteIds: string[];
  requestedBy: string;
  status: 'queued';
  createdAt: number;
  outputUri: string | null;
}

function parseManualCheckpointId(snapshotKey: string): string | null {
  const marker = '__manual__';
  if (!snapshotKey.includes(marker)) return null;
  return snapshotKey.split(marker)[1] || null;
}

function parseSnapshot(entry: Record<string, unknown>): CanonicalProfileSnapshot {
  return entry as unknown as CanonicalProfileSnapshot;
}

function isStaleFreshness(freshness: CorrelationFreshnessTier): boolean {
  return freshness === 'stale' || freshness === 'expired';
}

async function listMilestoneSnapshots(athleteId: string): Promise<CanonicalProfileSnapshot[]> {
  const snap = await getDocs(
    query(
      collection(doc(db, ATHLETE_MENTAL_PROGRESS_COLLECTION, athleteId), PROFILE_SNAPSHOTS_SUBCOLLECTION),
      orderBy('capturedAt', 'desc'),
      limit(24)
    )
  );

  return snap.docs.map((entry) => parseSnapshot(entry.data() as Record<string, unknown>));
}

function buildCoverageMap(snapshots: CanonicalProfileSnapshot[]): CorrelationOpsInspectionSummary['milestoneAssessmentCoverage'] {
  const coverage: CorrelationOpsInspectionSummary['milestoneAssessmentCoverage'] = {};
  const milestones: ProfileSnapshotMilestoneType[] = ['baseline', 'midpoint', 'endpoint', 'retention', 'manual_staff_checkpoint'];

  for (const milestone of milestones) {
    const snapshot = snapshots.find((candidate) => candidate.milestoneType === milestone);
    const flag = snapshot?.profilePayload?.stateContextAtCapture?.assessmentContextFlag;
    coverage[milestone] = flag
      ? {
          present: true,
          status: flag.status,
          confidenceTier: flag.confidenceTier,
        }
      : {
          present: false,
          status: 'missing',
          confidenceTier: null,
        };
  }

  return coverage;
}

function buildAlerts(input: Omit<CorrelationOpsInspectionSummary, 'alerts' | 'athleteId' | 'inspectedAt'>): string[] {
  const alerts: string[] = [];
  if (input.evidenceDensityDays < 7) alerts.push('Evidence density is below the minimum directional threshold.');
  if (input.staleEvidenceCount > Math.max(2, Math.floor(input.evidenceCount / 3))) alerts.push('Too many evidence records are stale or expired.');
  if (input.contradictionFlagCount > Math.max(2, Math.floor(input.evidenceCount / 4))) alerts.push('Contradiction flags are elevated across recent evidence.');
  if (input.degradedPatternCount > 0) alerts.push('One or more active pattern models are degraded.');
  if (input.expiredProjectionCount > 0) alerts.push('One or more consumer projections have expired.');
  if (input.invalidProjectionCount > 0) alerts.push('One or more projections failed copy or claim validation.');
  if (Object.values(input.milestoneAssessmentCoverage).some((entry) => !entry.present)) {
    alerts.push('At least one milestone snapshot is missing an assessment context flag.');
  }
  return alerts;
}

export const correlationOpsService = {
  async inspectAthlete(athleteId: string): Promise<CorrelationOpsInspectionSummary> {
    const [evidence, patterns, projections, milestoneSnapshots] = await Promise.all([
      correlationEvidenceService.getRecentForAthlete(athleteId, 120),
      correlationPatternService.listForAthlete(athleteId, 32),
      correlationProjectionService.listForAthlete(athleteId, 32),
      listMilestoneSnapshots(athleteId),
    ]);

    const evidenceDensityDays = new Set(evidence.map((record) => record.athleteLocalDate)).size;
    const staleEvidenceCount = evidence.filter((record) =>
      isStaleFreshness(record.physiology.freshness) || record.quality.qualityFlags.some((flag) => flag.startsWith('freshness_'))
    ).length;
    const contradictionFlagCount = evidence.filter((record) => record.quality.qualityFlags.includes('contradiction_flags_present')).length;
    const degradedPatternCount = patterns.filter((pattern) => pattern.confidenceTier === 'degraded').length;
    const stalePatternCount = patterns.filter((pattern) => isStaleFreshness(pattern.freshnessTier)).length;
    const now = Date.now();
    const expiredProjectionCount = projections.filter((projection) => (projection.expiresAt ?? 0) > 0 && (projection.expiresAt ?? 0) < now).length;
    const invalidProjectionCount = projections.filter((projection) =>
      !projection.copyValidated || projection.medicalClaimCheck === 'rejected'
    ).length;
    const milestoneAssessmentCoverage = buildCoverageMap(milestoneSnapshots);

    const summaryBase = {
      evidenceCount: evidence.length,
      evidenceDensityDays,
      staleEvidenceCount,
      contradictionFlagCount,
      patternCount: patterns.length,
      degradedPatternCount,
      stalePatternCount,
      projectionCount: projections.length,
      expiredProjectionCount,
      invalidProjectionCount,
      milestoneAssessmentCoverage,
    };

    return {
      athleteId,
      inspectedAt: now,
      ...summaryBase,
      alerts: buildAlerts(summaryBase),
    };
  },

  async recordMonitorEvent(input: Omit<CorrelationMonitorEvent, 'id' | 'createdAt'> & { createdAt?: number }): Promise<CorrelationMonitorEvent> {
    const eventRef = doc(collection(db, CORRELATION_ENGINE_MONITOR_EVENTS_COLLECTION));
    const createdAt = input.createdAt ?? Date.now();
    const event: CorrelationMonitorEvent = {
      id: eventRef.id,
      createdAt,
      ...input,
    };

    await setDoc(eventRef, sanitizeFirestoreValue(event));
    return event;
  },

  async scanAthleteForOperationalSignals(athleteId: string): Promise<CorrelationOpsInspectionSummary> {
    const summary = await this.inspectAthlete(athleteId);

    if (summary.evidenceDensityDays < 7) {
      await this.recordMonitorEvent({
        athleteId,
        eventType: 'low_evidence_density',
        severity: 'warning',
        summary: 'Athlete has not reached the minimum evidence-density threshold for reliable physiology-cognition learning.',
        details: { evidenceDensityDays: summary.evidenceDensityDays, evidenceCount: summary.evidenceCount },
      });
    }

    if (summary.contradictionFlagCount > Math.max(2, Math.floor(summary.evidenceCount / 4))) {
      await this.recordMonitorEvent({
        athleteId,
        eventType: 'contradiction_spike',
        severity: 'warning',
        summary: 'Recent evidence shows an elevated contradiction rate.',
        details: { contradictionFlagCount: summary.contradictionFlagCount, evidenceCount: summary.evidenceCount },
      });
    }

    if (summary.staleEvidenceCount > Math.max(2, Math.floor(summary.evidenceCount / 3))) {
      await this.recordMonitorEvent({
        athleteId,
        eventType: 'stale_source_rate',
        severity: 'warning',
        summary: 'Too many recent evidence records were built from stale or degraded source posture.',
        details: { staleEvidenceCount: summary.staleEvidenceCount, evidenceCount: summary.evidenceCount },
      });
    }

    if (Object.values(summary.milestoneAssessmentCoverage).some((entry) => !entry.present)) {
      await this.recordMonitorEvent({
        athleteId,
        eventType: 'assessment_flag_missing',
        severity: 'warning',
        summary: 'One or more milestone snapshots are missing assessment context flags.',
        details: { milestoneAssessmentCoverage: summary.milestoneAssessmentCoverage },
      });
    }

    return summary;
  },

  async refreshMilestoneFlagsForAthlete(athleteId: string): Promise<CanonicalProfileSnapshot[]> {
    const snapshots = await listMilestoneSnapshots(athleteId);
    const refreshed: CanonicalProfileSnapshot[] = [];

    for (const snapshot of snapshots) {
      if (snapshot.milestoneType === 'onboarding') continue;

      const result = await profileSnapshotService.writeCanonicalSnapshot({
        athleteId,
        milestoneType: snapshot.milestoneType,
        pilotEnrollmentId: snapshot.pilotEnrollmentId,
        manualCheckpointId: snapshot.milestoneType === 'manual_staff_checkpoint'
          ? parseManualCheckpointId(snapshot.snapshotKey)
          : null,
        capturedAt: snapshot.capturedAt,
        profileVersion: snapshot.profileVersion,
        writerVersion: snapshot.writerVersion,
        writeReason: 'correction',
        profilePayload: snapshot.profilePayload,
        noraExplanation: {
          templateId: snapshot.noraExplanation.templateId,
          templateVersion: snapshot.noraExplanation.templateVersion,
          slots: snapshot.noraExplanation.slots,
          renderedText: snapshot.noraExplanation.renderedText,
        },
        sourceRefs: snapshot.sourceRefs,
      });
      refreshed.push(result.snapshot);
    }

    return refreshed;
  },

  async recomputeAthlete(
    athleteId: string,
    options?: {
      refreshEvidence?: boolean;
      recomputePatterns?: boolean;
      regenerateProjections?: boolean;
      refreshMilestoneFlags?: boolean;
      actorId?: string | null;
      requestId?: string | null;
    }
  ): Promise<{
    evidenceCount: number;
    patternCount: number;
    projectionCount: number;
    refreshedMilestones: number;
    inspection: CorrelationOpsInspectionSummary;
  }> {
    const refreshEvidence = options?.refreshEvidence ?? true;
    const recomputePatterns = options?.recomputePatterns ?? true;
    const regenerateProjections = options?.regenerateProjections ?? true;
    const refreshMilestoneFlags = options?.refreshMilestoneFlags ?? true;

    let evidenceCount = 0;
    let patternCount = 0;
    let projectionCount = 0;
    let refreshedMilestones = 0;

    try {
      if (refreshEvidence) {
        const evidence = await correlationEvidenceService.backfillRecentForAthlete(athleteId, RECOMPUTE_LIMIT);
        evidenceCount = evidence.length;
      }

      if (recomputePatterns) {
        const patterns = await correlationPatternService.recomputeCorePatternsForAthlete(athleteId);
        patternCount = patterns.length;
      }

      if (regenerateProjections) {
        const projections = await correlationProjectionService.generateCoreConsumerProjections(athleteId);
        projectionCount = projections.length;
      }

      if (refreshMilestoneFlags) {
        const snapshots = await this.refreshMilestoneFlagsForAthlete(athleteId);
        refreshedMilestones = snapshots.length;
      }
    } catch (error) {
      await this.recordMonitorEvent({
        athleteId,
        eventType: refreshEvidence ? 'evidence_write_failed' : 'projection_generate_failed',
        severity: 'error',
        summary: 'Correlation engine recompute failed.',
        details: {
          message: error instanceof Error ? error.message : String(error),
          refreshEvidence,
          recomputePatterns,
          regenerateProjections,
          refreshMilestoneFlags,
          actorId: options?.actorId ?? null,
          requestId: options?.requestId ?? null,
        },
      });
      throw error;
    }

    const inspection = await this.scanAthleteForOperationalSignals(athleteId);
    await this.recordMonitorEvent({
      athleteId,
      eventType: 'recompute_completed',
      severity: 'info',
      summary: 'Correlation engine recompute completed.',
      details: {
        evidenceCount,
        patternCount,
        projectionCount,
        refreshedMilestones,
        alerts: inspection.alerts,
        actorId: options?.actorId ?? null,
        requestId: options?.requestId ?? null,
      },
    });

    return {
      evidenceCount,
      patternCount,
      projectionCount,
      refreshedMilestones,
      inspection,
    };
  },

  async buildResearchBundle(athleteId: string): Promise<CorrelationResearchBundle> {
    const [evidence, patterns, projections, milestoneSnapshots, simSessions] = await Promise.all([
      correlationEvidenceService.getRecentForAthlete(athleteId, 120),
      correlationPatternService.listForAthlete(athleteId, 40),
      correlationProjectionService.listForAthlete(athleteId, 40),
      listMilestoneSnapshots(athleteId),
      simSessionService.getRecentSessions(athleteId, 120),
    ]);

    const joinedRows = evidence.map((record) => ({
      evidenceId: record.evidenceId,
      simSessionId: record.simOutcome.simSessionId,
      athleteLocalDate: record.athleteLocalDate,
      sourceFamily: record.physiology.sourceFamily,
      patternKeys: patterns
        .filter((pattern) =>
          record.simOutcome.coreMetricName
            ? pattern.affectedDomains.some((domain) => String(domain) === record.simOutcome.coreMetricName)
              || String(pattern.targetDomain) === record.simOutcome.coreMetricName
            : false
        )
        .slice(0, 3)
        .map((pattern) => pattern.patternKey),
      projectionKeys: projections
        .filter((projection) => projection.supportingPatternKeys.some((key) => patterns.some((pattern) => pattern.patternKey === key)))
        .slice(0, 4)
        .map((projection) => projection.projectionKey),
      milestoneSnapshotKeys: milestoneSnapshots
        .filter((snapshot) => Math.abs(snapshot.capturedAt - record.simOutcome.sessionTimestamp) <= 14 * 24 * 60 * 60 * 1000)
        .slice(0, 4)
        .map((snapshot) => snapshot.snapshotKey),
    }));

    return {
      athleteId,
      generatedAt: Date.now(),
      evidence,
      patterns,
      projections,
      milestoneSnapshots,
      simSessions: simSessions.map((session) => ({ ...session })),
      joinedRows,
    };
  },

  buildResearchExportJob(input: {
    athleteIds: string[];
    requestedBy: string;
    dataset?: CorrelationResearchExportJob['dataset'];
  }): Omit<CorrelationResearchExportJob, 'id'> {
    return {
      dataset: input.dataset ?? 'correlation_research_bundle_v1',
      athleteIds: input.athleteIds,
      requestedBy: input.requestedBy,
      status: 'queued',
      createdAt: Date.now(),
      outputUri: null,
    };
  },

  async queueResearchExportJob(input: {
    athleteIds: string[];
    requestedBy: string;
    dataset?: CorrelationResearchExportJob['dataset'];
  }): Promise<CorrelationResearchExportJob> {
    const job = this.buildResearchExportJob(input);
    const jobRef = doc(collection(db, RESEARCH_EXPORT_JOBS_COLLECTION));
    const fullJob: CorrelationResearchExportJob = {
      id: jobRef.id,
      ...job,
    };
    await setDoc(jobRef, sanitizeFirestoreValue(fullJob));
    return fullJob;
  },
};
