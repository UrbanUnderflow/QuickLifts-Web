// =============================================================================
// Sports Intelligence Draft Orchestrator — composes the inference engine +
// report generator + coach-report service so the reviewer screen has a
// single "seed from real data" button that produces a draft.
//
// Flow:
//   1. List the team's active athletes from PulseCheckTeamMembership.
//   2. For each athlete, fetch the latest daily HCSR snapshot.
//   3. Run inference on each snapshot using the sport's reportPolicy.
//   4. Hand the inference results to the report generator.
//   5. Save the resulting draft via the coach-report service.
//
// When snapshots are missing for athletes, the orchestrator still builds
// a thin draft so the reviewer has a starting point. Reviewer notes
// surface why each athlete contributed (or didn't).
// =============================================================================

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './config';
import {
  athleteContextSnapshotService,
  type AthleteHealthContextSnapshot,
} from './athleteContextSnapshot';
import {
  computeTeamAdherenceSummary,
  type TeamAdherenceSummary,
} from './pilotAdherenceMetrics';
import {
  generateCoachReportDraft,
  type AthleteInferenceWithIdentity,
  type GeneratedReportDraft,
  type ReportGeneratorInput,
} from './sportsIntelligenceReportGenerator';
import {
  runSportsIntelligenceInference,
  type InferenceResult,
} from './sportsIntelligenceInferenceEngine';
import {
  pulsecheckCoachReportService,
  type StoredCoachReport,
} from './pulsecheckCoachReports';
import { getDefaultPulseCheckSports, type PulseCheckSportConfigurationEntry } from './pulsecheckSportConfig';

const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';

// ──────────────────────────────────────────────────────────────────────────────
// Inputs
// ──────────────────────────────────────────────────────────────────────────────

export interface DraftOrchestrationInput {
  teamId: string;
  sportId: string;
  /** YYYY-MM-DD athlete-local for the week's anchor day. */
  weekStart: string;
  weekLabel?: string;
  opponentOrEvent?: string;
  competitionDate?: string;
  /** Optional pre-provided sport entry (skips re-lookup). */
  sport?: PulseCheckSportConfigurationEntry;
  /** Optional pre-loaded snapshots keyed by athleteUserId — for tests. */
  snapshotsByAthlete?: Record<string, AthleteHealthContextSnapshot | null>;
  /** Optional pre-loaded athlete identity rows — for tests. */
  athletesOverride?: Array<{ athleteUserId: string; athleteName: string; role?: string }>;
  /** Pre-computed team adherence — skips the on-the-fly compute in tests. */
  adherenceOverride?: TeamAdherenceSummary;
  /** Skip the on-the-fly adherence computation entirely (e.g., for fast previews). */
  skipAdherenceCompute?: boolean;
  /** When true, skip the Firestore write (for previews + tests). */
  preview?: boolean;
}

export interface DraftOrchestrationResult {
  reportId?: string;
  stored?: StoredCoachReport | null;
  generatedDraft: GeneratedReportDraft;
  /** Athlete-level reasoning trace for the reviewer pane. */
  athleteTrace: Array<{
    athleteUserId: string;
    athleteName: string;
    snapshotLoaded: boolean;
    snapshotMissingReason?: string;
  }>;
  generatorNotes: string[];
  /** Team adherence summary used to populate the report's adherence block. */
  adherenceSummary?: TeamAdherenceSummary;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const requireString = (value: unknown, label: string): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`[SportsIntelligenceDraftOrchestrator] ${label} is required.`);
  }
  return normalized;
};

interface AthleteRow {
  athleteUserId: string;
  athleteName: string;
  role?: string;
}

const loadActiveAthletesForTeam = async (teamId: string): Promise<AthleteRow[]> => {
  const snap = await getDocs(
    query(
      collection(db, TEAM_MEMBERSHIPS_COLLECTION),
      where('teamId', '==', teamId),
      where('role', '==', 'athlete'),
      where('status', '==', 'active'),
    ),
  );
  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data() || {};
      const userId = String(data.userId || '').trim();
      if (!userId) return null;
      const onboarding = (data.athleteOnboarding || {}) as Record<string, unknown>;
      const athleteName =
        String(data.displayName || data.name || onboarding.displayName || onboarding.fullName || '').trim()
        || `Athlete ${userId.slice(0, 6)}`;
      const role =
        String(data.sportPosition || onboarding.sportPosition || '').trim() || undefined;
      return { athleteUserId: userId, athleteName, role } as AthleteRow;
    })
    .filter((row): row is AthleteRow => row !== null);
};

const resolveSport = (
  sportId: string,
  override: PulseCheckSportConfigurationEntry | undefined,
): PulseCheckSportConfigurationEntry => {
  if (override) return override;
  const found = getDefaultPulseCheckSports().find((entry) => entry.id === sportId);
  if (!found) {
    throw new Error(`[SportsIntelligenceDraftOrchestrator] Unknown sportId "${sportId}".`);
  }
  return found;
};

// ──────────────────────────────────────────────────────────────────────────────
// Public entry
// ──────────────────────────────────────────────────────────────────────────────

export const orchestrateGeneratedReportDraft = async (
  input: DraftOrchestrationInput,
): Promise<DraftOrchestrationResult> => {
  const teamId = requireString(input.teamId, 'teamId');
  const sportId = requireString(input.sportId, 'sportId');
  const weekStart = requireString(input.weekStart, 'weekStart');
  const sport = resolveSport(sportId, input.sport);

  const athletes =
    input.athletesOverride && input.athletesOverride.length > 0
      ? input.athletesOverride
      : await loadActiveAthletesForTeam(teamId);

  const snapshotsByAthlete: Record<string, AthleteHealthContextSnapshot | null> = {};
  const athleteTrace: DraftOrchestrationResult['athleteTrace'] = [];

  for (const athlete of athletes) {
    if (input.snapshotsByAthlete && athlete.athleteUserId in input.snapshotsByAthlete) {
      snapshotsByAthlete[athlete.athleteUserId] = input.snapshotsByAthlete[athlete.athleteUserId];
    } else {
      try {
        snapshotsByAthlete[athlete.athleteUserId] = await athleteContextSnapshotService.getActive(
          athlete.athleteUserId,
          'daily',
          weekStart,
        );
      } catch (error) {
        snapshotsByAthlete[athlete.athleteUserId] = null;
        athleteTrace.push({
          athleteUserId: athlete.athleteUserId,
          athleteName: athlete.athleteName,
          snapshotLoaded: false,
          snapshotMissingReason: `Snapshot lookup failed: ${error instanceof Error ? error.message : String(error)}`,
        });
        continue;
      }
    }

    const snapshot = snapshotsByAthlete[athlete.athleteUserId];
    athleteTrace.push({
      athleteUserId: athlete.athleteUserId,
      athleteName: athlete.athleteName,
      snapshotLoaded: Boolean(snapshot),
      snapshotMissingReason: snapshot ? undefined : 'No daily snapshot for this athlete in this window.',
    });
  }

  const inferenceResults: AthleteInferenceWithIdentity[] = [];
  for (const athlete of athletes) {
    const snapshot = snapshotsByAthlete[athlete.athleteUserId];
    if (!snapshot) continue;
    const inference: InferenceResult = runSportsIntelligenceInference({ snapshot, sport });
    inferenceResults.push({
      athleteName: athlete.athleteName,
      role: athlete.role,
      inference,
      snapshot,
    });
  }

  // Resolve adherence: use override (tests) → pre-computed → on-the-fly compute → skip.
  let adherenceSummary: TeamAdherenceSummary | undefined;
  if (input.adherenceOverride) {
    adherenceSummary = input.adherenceOverride;
  } else if (!input.skipAdherenceCompute && athletes.length > 0) {
    try {
      adherenceSummary = await computeTeamAdherenceSummary({
        teamId,
        athleteUserIds: athletes.map((a) => a.athleteUserId),
        endDateKey: weekStart,
      });
    } catch (error) {
      // Adherence is non-blocking: if the compute fails (e.g., Firestore
      // permission, missing collection), we fall back to placeholder values
      // and surface the error in generatorNotes.
      adherenceSummary = undefined;
    }
  }

  const generatorInput: ReportGeneratorInput = {
    athleteResults: inferenceResults,
    sport,
    team: {
      teamId,
      weekStart,
      weekLabel: input.weekLabel,
      opponentOrEvent: input.opponentOrEvent,
      competitionDate: input.competitionDate,
    },
    adherence: adherenceSummary
      ? {
          wearRate7d: adherenceSummary.wearRate,
          noraCheckinCompletion7d: adherenceSummary.noraCheckinCompletion,
          protocolOrSimCompletion7d: adherenceSummary.protocolOrSimCompletion,
          trainingOrNutritionCoverage7d: adherenceSummary.trainingOrNutritionCoverage,
          confidenceLabel: adherenceSummary.confidenceLabel,
          categoriesReady: adherenceSummary.categoriesReady,
        }
      : undefined,
  };

  const generated = generateCoachReportDraft(generatorInput);
  const generatorNotes = [...generated.generatorNotes];

  if (athletes.length > 0 && inferenceResults.length === 0) {
    generatorNotes.push(
      `Team has ${athletes.length} active athlete(s) but none have a daily snapshot for ${weekStart} — draft is thin.`,
    );
  }

  if (input.preview) {
    return {
      generatedDraft: generated,
      athleteTrace,
      generatorNotes,
      adherenceSummary,
    };
  }

  const reportId = await pulsecheckCoachReportService.createDraft(teamId, sportId, weekStart, 'generated', {
    reportType: 'weekly',
    teamName: generated.coachSurface.meta.teamName,
    sportName: sport.name,
  });

  await pulsecheckCoachReportService.updateDraft(teamId, reportId, {
    sportId,
    weekStart,
    reportType: 'weekly',
    source: 'generated',
    reviewStatus: 'draft',
    coachSurface: {
      ...generated.coachSurface,
      meta: {
        ...generated.coachSurface.meta,
        reportId,
      },
    },
    reviewerOnly: generated.reviewerOnly,
  });

  const stored = await pulsecheckCoachReportService.getReport(teamId, reportId);

  return {
    reportId,
    stored,
    generatedDraft: generated,
    athleteTrace,
    generatorNotes,
    adherenceSummary,
  };
};

export const sportsIntelligenceDraftOrchestrator = {
  orchestrate: orchestrateGeneratedReportDraft,
};
