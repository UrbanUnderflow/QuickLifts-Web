// =============================================================================
// Sports Intelligence Report Generator — turns inference output + sport
// reportPolicy into a coach-surface draft (`CoachReportCoachSurface`).
//
// This module sits between the inference engine and the reviewer screen.
// It produces a draft a Pulse reviewer can then edit + publish through
// the existing reviewer screen flow.
//
// Discipline:
//   - Output goes through the existing compose helpers
//     (`composeReportTopLine`, `composeTeamRead`, `enforceCoachActionSpecificity`,
//     `enforceNamedAthleteWatchlist`) so the same gates fire for generated
//     drafts as for fixture-seeded drafts.
//   - Coach-language translations on the parent reportPolicy are applied
//     to every coach-facing string before it lands in the surface.
//   - Reviewer-only data (evidence refs, confidence tiers, reviewer notes)
//     is bundled separately so the reviewer pane can show the technical
//     trace next to the coach preview.
// =============================================================================

import {
  applyCoachLanguageTranslations,
  composeGameDayLookFors,
  composeReportTopLine,
  enforceCoachActionSpecificity,
  enforceNamedAthleteWatchlist,
  type CoachActionCandidate,
  type GameDayLookFor,
  type NamedAthleteWatchEntry,
  type PulseCheckSportConfigurationEntry,
  type ReportDimensionStateMap,
} from './pulsecheckSportConfig';
import type {
  CoachReportCoachAction,
  CoachReportCoachSurface,
  CoachReportGameDayLookFor,
  CoachReportReviewerOnly,
  CoachReportWatchlistEntry,
} from './pulsecheckCoachReports';
import type { AthleteHealthContextSnapshot, DataConfidence, DomainKey } from './athleteContextSnapshot';
import {
  type AthleteReadinessInterpretation,
  type CognitiveMovementInterpretation,
  type InferenceResult,
  type SportsRecommendation,
  type TrainingLoadInterpretation,
} from './sportsIntelligenceInferenceEngine';

// ──────────────────────────────────────────────────────────────────────────────
// Generator input + output
// ──────────────────────────────────────────────────────────────────────────────

export interface ReportGeneratorInput {
  /** One inference result per athlete on the team. */
  athleteResults: AthleteInferenceWithIdentity[];
  sport: PulseCheckSportConfigurationEntry;
  /** Team-level metadata for the report header. */
  team: {
    teamId: string;
    teamName?: string;
    weekStart: string;
    weekLabel?: string;
    opponentOrEvent?: string;
    competitionDate?: string;
  };
  /**
   * Pre-computed adherence numbers. When omitted, the generator falls back
   * to placeholder values + a "Thin read" / "Usable read" label inferred
   * from inference confidence. Callers (typically the orchestrator) should
   * supply this from `pilotAdherenceMetricsService.computeTeamAdherenceSummary`.
   */
  adherence?: {
    wearRate7d: number;
    noraCheckinCompletion7d: number;
    protocolOrSimCompletion7d: number;
    trainingOrNutritionCoverage7d: number;
    confidenceLabel: string;
    categoriesReady?: number;
    summary?: string;
  };
}

export interface AthleteInferenceWithIdentity {
  athleteName: string;
  role?: string;
  inference: InferenceResult;
  /** Optional richer context the reviewer might want shown in the technical pane. */
  snapshot?: AthleteHealthContextSnapshot;
}

export interface GeneratedReportDraft {
  coachSurface: CoachReportCoachSurface;
  reviewerOnly: CoachReportReviewerOnly;
  /** Notes the generator surfaced for the reviewer (e.g. "no athletes met watchlist gate"). */
  generatorNotes: string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const titleCase = (value: string): string =>
  value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const dimensionStateForReadiness = (
  band: AthleteReadinessInterpretation['readinessBand'],
): ReportDimensionStateMap[keyof ReportDimensionStateMap] => {
  switch (band) {
    case 'fresh':
      return 'solid';
    case 'on_plan':
      return 'solid';
    case 'one_to_watch':
      return 'watch';
    case 'concerning':
      return 'declining';
    default:
      return 'thin_evidence';
  }
};

const dimensionStateForLoadBand = (
  band: TrainingLoadInterpretation['loadBand'],
): ReportDimensionStateMap[keyof ReportDimensionStateMap] => {
  switch (band) {
    case 'low':
      return 'solid';
    case 'moderate':
      return 'solid';
    case 'high':
      return 'watch';
    case 'concerning':
      return 'declining';
    default:
      return 'thin_evidence';
  }
};

const buildTeamDimensionState = (
  athleteResults: AthleteInferenceWithIdentity[],
): Partial<ReportDimensionStateMap> => {
  if (athleteResults.length === 0) {
    return { focus: 'thin_evidence', composure: 'thin_evidence', decisioning: 'thin_evidence' };
  }

  const concernCount = (predicate: (entry: AthleteInferenceWithIdentity) => boolean): number =>
    athleteResults.filter(predicate).length;

  const readinessConcern = concernCount(
    (entry) => entry.inference.readiness.readinessBand === 'concerning',
  );
  const watchCount = concernCount(
    (entry) => entry.inference.readiness.readinessBand === 'one_to_watch',
  );
  const loadConcern = concernCount(
    (entry) => entry.inference.trainingLoad.loadBand === 'concerning',
  );
  const loadHigh = concernCount((entry) => entry.inference.trainingLoad.loadBand === 'high');

  const focus: ReportDimensionStateMap['focus'] =
    loadConcern > 0 ? 'declining' : loadHigh > 0 ? 'watch' : 'solid';
  const composure: ReportDimensionStateMap['composure'] =
    readinessConcern > 0 ? 'declining' : watchCount > 0 ? 'watch' : 'solid';
  const decisioning: ReportDimensionStateMap['decisioning'] =
    readinessConcern + watchCount > Math.ceil(athleteResults.length / 3) ? 'watch' : 'solid';

  return { focus, composure, decisioning };
};

const inferenceConfidenceFloor = (results: InferenceResult[]): DataConfidence => {
  const ranks: DataConfidence[] = ['degraded', 'directional', 'emerging', 'stable', 'high_confidence'];
  let lowestIdx = ranks.indexOf('high_confidence');
  for (const result of results) {
    for (const tier of [
      result.readiness.confidenceTier,
      result.trainingLoad.confidenceTier,
      result.cognitiveMovement.confidenceTier,
    ]) {
      const idx = ranks.indexOf(tier);
      if (idx >= 0 && idx < lowestIdx) lowestIdx = idx;
    }
  }
  return ranks[lowestIdx];
};

const buildAdherence = (
  athleteResults: AthleteInferenceWithIdentity[],
  override?: ReportGeneratorInput['adherence'],
) => {
  if (override) {
    // Caller (typically the orchestrator) supplied real numbers from
    // `pilotAdherenceMetricsService.computeTeamAdherenceSummary`. Use them
    // verbatim; the reviewer can still override on the screen if needed.
    return {
      wearRate7d: override.wearRate7d,
      noraCheckinCompletion7d: override.noraCheckinCompletion7d,
      protocolOrSimCompletion7d: override.protocolOrSimCompletion7d,
      trainingOrNutritionCoverage7d: override.trainingOrNutritionCoverage7d,
      confidenceLabel: override.confidenceLabel,
      summary:
        override.summary
        || `Adherence read: ${override.confidenceLabel.toLowerCase()}${
          typeof override.categoriesReady === 'number'
            ? ` (${override.categoriesReady}/4 categories at or above 70% coverage)`
            : ''
        }.`,
    };
  }

  // Fallback when the orchestrator did not supply pre-computed numbers
  // (e.g., reviewer-screen "seed from fixture" path). Surfaces zeros + a
  // confidence inferred from inference quality so the reviewer knows
  // where to fill in.
  const lowConfidence =
    athleteResults.length === 0
    || athleteResults.every((entry) => entry.inference.readiness.confidenceTier === 'degraded');

  return {
    wearRate7d: 0,
    noraCheckinCompletion7d: 0,
    protocolOrSimCompletion7d: 0,
    trainingOrNutritionCoverage7d: 0,
    confidenceLabel: lowConfidence ? 'Thin read' : 'Usable read',
    summary: lowConfidence
      ? 'Coverage is thin this week; reviewer should fill in adherence numbers and tighten the read before publish.'
      : 'Coverage is usable. Reviewer should confirm exact adherence percentages before publish.',
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// Watchlist + coach-action builders
// ──────────────────────────────────────────────────────────────────────────────

const buildWatchlistFromInference = (
  athleteResults: AthleteInferenceWithIdentity[],
): { rendered: CoachReportWatchlistEntry[]; suppressed: number } => {
  const candidates: NamedAthleteWatchEntry[] = athleteResults
    .filter(
      (entry) =>
        entry.inference.readiness.readinessBand === 'one_to_watch'
        || entry.inference.readiness.readinessBand === 'concerning'
        || entry.inference.trainingLoad.loadBand === 'high'
        || entry.inference.trainingLoad.loadBand === 'concerning',
    )
    .map((entry) => {
      const readinessBand = entry.inference.readiness.readinessBand;
      const loadBand = entry.inference.trainingLoad.loadBand;

      const whyMattersParts: string[] = [];
      if (readinessBand === 'concerning') {
        whyMattersParts.push("recovery is below his usual and the read carries through to today's session");
      } else if (readinessBand === 'one_to_watch') {
        whyMattersParts.push("recovery has been below his usual the last few days");
      }
      if (loadBand === 'concerning') {
        whyMattersParts.push('training load is climbing faster than recovery');
      } else if (loadBand === 'high') {
        whyMattersParts.push('the volume is showing');
      }

      const coachMoveParts: string[] = [];
      if (loadBand === 'concerning' || loadBand === 'high') {
        coachMoveParts.push('Pull a rep from the next high-intensity block and keep the install verbal.');
      }
      if (readinessBand === 'concerning' || readinessBand === 'one_to_watch') {
        coachMoveParts.push('Five-minute check-in before practice — make it about feel, not film.');
      }

      // Watchlist confidence reflects only domains we actually used. If
      // an athlete has no training data, training-load's `degraded`
      // confidence shouldn't drag the readiness-driven watchlist entry
      // out of the stable+ gate.
      const usedTiers: DataConfidence[] = [];
      const readinessTriggered =
        entry.inference.readiness.readinessBand === 'one_to_watch'
        || entry.inference.readiness.readinessBand === 'concerning';
      const loadTriggered =
        entry.inference.trainingLoad.loadBand === 'high'
        || entry.inference.trainingLoad.loadBand === 'concerning';
      if (readinessTriggered) usedTiers.push(entry.inference.readiness.confidenceTier);
      if (loadTriggered) usedTiers.push(entry.inference.trainingLoad.confidenceTier);
      const tier =
        usedTiers.length === 0
          ? entry.inference.readiness.confidenceTier
          : usedTiers.reduce((acc, next) => minTier(acc, next), usedTiers[0]);

      return {
        athleteName: entry.athleteName,
        role: entry.role,
        whyMatters: whyMattersParts.join(' Plus, ') || 'Watch this athlete this week.',
        coachMove: coachMoveParts.join(' ') || 'Quick check-in before practice.',
        evidenceRefs: dedupeEvidenceLabels([
          ...entry.inference.readiness.evidence,
          ...entry.inference.trainingLoad.evidence,
        ]),
        confidenceTier: tier,
      } as NamedAthleteWatchEntry;
    });

  const gate = enforceNamedAthleteWatchlist(candidates);
  return {
    rendered: gate.rendered.map((candidate) => ({
      athleteName: candidate.athleteName,
      role: candidate.role,
      whyMatters: candidate.whyMatters,
      coachMove: candidate.coachMove,
      evidenceRefs: candidate.evidenceRefs,
      confidenceTier: candidate.confidenceTier,
    })),
    suppressed: candidates.length - gate.rendered.length,
  };
};

const minTier = (a: DataConfidence, b: DataConfidence): DataConfidence => {
  const ranks: DataConfidence[] = ['degraded', 'directional', 'emerging', 'stable', 'high_confidence'];
  return ranks.indexOf(a) <= ranks.indexOf(b) ? a : b;
};

const dedupeEvidenceLabels = (refs: { label: string }[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ref of refs) {
    if (!seen.has(ref.label)) {
      seen.add(ref.label);
      out.push(ref.label);
    }
  }
  return out.slice(0, 5);
};

const buildCoachActionsFromRecommendations = (
  athleteResults: AthleteInferenceWithIdentity[],
  sport: PulseCheckSportConfigurationEntry,
): { rendered: CoachReportCoachAction[]; suppressed: number } => {
  const policyById = new Map(
    (sport.reportPolicy?.coachActions || []).map((entry) => [entry.id, entry]),
  );
  const candidates: CoachActionCandidate[] = [];

  for (const entry of athleteResults) {
    for (const rec of entry.inference.recommendations) {
      const policyEntry = rec.policyRefId ? policyById.get(rec.policyRefId) : undefined;
      candidates.push({
        action: policyEntry?.label || rec.reviewerAction,
        appliesTo: entry.athleteName,
        session: `Week of ${entry.inference.readiness.dayKey}`,
        linkedSignals: rec.policyRefId ? [rec.policyRefId] : undefined,
      });
    }
  }

  const gate = enforceCoachActionSpecificity(candidates);
  return {
    rendered: gate.rendered.map((candidate) => ({
      action: candidate.action,
      appliesTo: candidate.appliesTo,
      session: candidate.session,
      linkedSignals: candidate.linkedSignals,
    })),
    suppressed: gate.suppressed.length,
  };
};

const buildGameDayLookFors = (
  athleteResults: AthleteInferenceWithIdentity[],
): CoachReportGameDayLookFor[] => {
  const candidates: GameDayLookFor[] = [];
  for (const entry of athleteResults) {
    const readiness = entry.inference.readiness;
    if (readiness.readinessBand === 'concerning') {
      candidates.push({
        athleteOrUnit: entry.athleteName,
        lookFor: 'flat in warm-up or quiet on the bench',
        ifThen: 'sneak in an extra acceleration before the call. One cue only — keep it the same word every time.',
      });
    } else if (readiness.readinessBand === 'one_to_watch') {
      candidates.push({
        athleteOrUnit: entry.athleteName,
        lookFor: 'short on the second-ball duels or late in the rotation',
        ifThen: 'shorten his minutes. Use the early-clock action you put in earlier this week.',
      });
    }
  }
  const gate = composeGameDayLookFors(candidates);
  return gate.items.map((item) => ({
    athleteOrUnit: item.athleteOrUnit,
    lookFor: item.lookFor,
    ifThen: item.ifThen,
  }));
};

// ──────────────────────────────────────────────────────────────────────────────
// Top-line builder
// ──────────────────────────────────────────────────────────────────────────────

const buildTopLine = (
  athleteResults: AthleteInferenceWithIdentity[],
  sport: PulseCheckSportConfigurationEntry,
): { whatChanged: string; who: string; firstAction: string; secondaryThread?: string; usedThinRead: boolean } => {
  const concerning = athleteResults.filter(
    (entry) =>
      entry.inference.readiness.readinessBand === 'concerning'
      || entry.inference.trainingLoad.loadBand === 'concerning',
  );
  const watching = athleteResults.filter(
    (entry) =>
      entry.inference.readiness.readinessBand === 'one_to_watch'
      || entry.inference.trainingLoad.loadBand === 'high',
  );

  const fillRow = (entry: AthleteInferenceWithIdentity): string => {
    const role = entry.role ? ` (${entry.role})` : '';
    return `${entry.athleteName}${role}`;
  };

  if (concerning.length > 0) {
    const namedAthletes = concerning.slice(0, 2).map(fillRow).join(' and ');
    const result = composeReportTopLine(
      {
        whatChanged: `${namedAthletes} are wearing the load and recovery is sitting below their usual.`,
        who: namedAthletes,
        firstAction: 'Pull a rep from the next high-intensity block and keep the install verbal.',
        secondaryThread:
          watching.length > 0
            ? `Separate thing — ${fillRow(watching[0])} is one to watch this week, surface them in the daily.`
            : undefined,
      },
      { sportName: sport.name },
    );
    return {
      whatChanged: applyCoachLanguageTranslations(result.primary, sport.reportPolicy),
      who: namedAthletes,
      firstAction: 'Pull a rep from the next high-intensity block and keep the install verbal.',
      secondaryThread: result.secondary
        ? applyCoachLanguageTranslations(result.secondary, sport.reportPolicy)
        : undefined,
      usedThinRead: result.used === 'thin_read',
    };
  }

  if (watching.length > 0) {
    const namedAthletes = watching.slice(0, 2).map(fillRow).join(' and ');
    return {
      whatChanged: applyCoachLanguageTranslations(
        `${namedAthletes} are one to watch this week — recovery has been below their usual.`,
        sport.reportPolicy,
      ),
      who: namedAthletes,
      firstAction: 'Five-minute check-in before practice. Keep it about feel, not film.',
      usedThinRead: false,
    };
  }

  return {
    whatChanged:
      'The team is moving on plan this week — no athlete crossed the load or recovery thresholds.',
    who: 'whole team',
    firstAction: 'Stay the course. Watch the front-of-week sessions for any drift.',
    usedThinRead: false,
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// Reviewer-only assembly
// ──────────────────────────────────────────────────────────────────────────────

const buildReviewerOnly = (
  athleteResults: AthleteInferenceWithIdentity[],
  generatorNotes: string[],
  watchlistSuppressed: number,
  coachActionsSuppressed: number,
): CoachReportReviewerOnly => {
  const allEvidence = athleteResults.flatMap((entry) => [
    ...entry.inference.readiness.evidence,
    ...entry.inference.trainingLoad.evidence,
    ...entry.inference.cognitiveMovement.evidence,
  ]);

  const allMissing = athleteResults.flatMap((entry) => [
    ...entry.inference.readiness.missingInputs.map((m) => `${m.domain}: ${m.reason}`),
    ...entry.inference.trainingLoad.missingInputs.map((m) => `${m.domain}: ${m.reason}`),
  ]);

  const provenance = athleteResults.flatMap((entry) => entry.inference.readiness.provenanceTrace);
  const reviewerNotes = athleteResults.flatMap((entry) => [
    `${entry.athleteName}: ${entry.inference.readiness.reviewerNote}`,
    `${entry.athleteName}: ${entry.inference.trainingLoad.reviewerNote}`,
  ]);

  const lowestConfidence = inferenceConfidenceFloor(athleteResults.map((entry) => entry.inference));

  return {
    evidence: {
      athleteEvidenceRefs: dedupeEvidenceLabels(allEvidence),
      sourceProvenance: Array.from(new Set(provenance)),
      confidenceTier: lowestConfidence,
      missingInputs: Array.from(new Set(allMissing)),
      thresholdTrace: athleteResults.flatMap((entry) =>
        entry.inference.recommendations.map((rec) => `${rec.id}: ${rec.recommendationStrength}`),
      ),
      unsuppressedSignals: athleteResults.flatMap((entry) =>
        entry.inference.recommendations.map((rec) => rec.id),
      ),
    },
    auditTrace: {
      localizationAuditResult: undefined, // Filled in by the caller after coach surface generation
      suppressedWatchlistEntries:
        watchlistSuppressed > 0
          ? [`${watchlistSuppressed} candidate(s) suppressed by named-athlete + stable-confidence gate`]
          : [],
      suppressedCoachActions:
        coachActionsSuppressed > 0
          ? [`${coachActionsSuppressed} generic action(s) suppressed by specificity gate`]
          : [],
      suppressionReasons: [
        ...generatorNotes,
        ...reviewerNotes,
      ],
    },
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// Public entry
// ──────────────────────────────────────────────────────────────────────────────

export const generateCoachReportDraft = (input: ReportGeneratorInput): GeneratedReportDraft => {
  const generatorNotes: string[] = [];
  const { athleteResults, sport, team } = input;

  if (athleteResults.length === 0) {
    generatorNotes.push('No athlete inference results provided; producing thin-read draft.');
  }

  const dimensionState = buildTeamDimensionState(athleteResults);
  const watchlist = buildWatchlistFromInference(athleteResults);
  const coachActions = buildCoachActionsFromRecommendations(athleteResults, sport);
  const gameDayLookFors = buildGameDayLookFors(athleteResults);
  const topLine = buildTopLine(athleteResults, sport);

  if (topLine.usedThinRead) {
    generatorNotes.push('Top-line fell back to thin-read copy due to missing fills.');
  }

  const adherence = buildAdherence(athleteResults, input.adherence);

  const teamSynthesis =
    dimensionState.composure === 'declining' || dimensionState.focus === 'declining'
      ? `This is a recovery + load week — coach the watchlist names, the rest of the ${sport.name.toLowerCase()} group is sharp.`
      : dimensionState.composure === 'watch' || dimensionState.focus === 'watch'
        ? `This is a one-to-watch week for the ${sport.name.toLowerCase()} group — surface the watchlist names in the daily and stay the course.`
        : `The ${sport.name.toLowerCase()} group is moving on plan this week — stay the course and keep the front-of-week sessions clean.`;

  const coachSurface: CoachReportCoachSurface = {
    meta: {
      teamId: team.teamId,
      teamName: team.teamName,
      sportId: sport.id,
      sportName: sport.name,
      reportType: 'weekly',
      weekStart: team.weekStart,
      weekLabel: team.weekLabel || `Week of ${team.weekStart}`,
      reviewStatus: 'draft',
      source: 'generated',
    },
    topLine: {
      whatChanged: topLine.whatChanged,
      who: topLine.who,
      firstAction: topLine.firstAction,
      secondaryThread: topLine.secondaryThread,
    },
    dimensionState,
    watchlist: watchlist.rendered,
    coachActions: coachActions.rendered,
    gameDayLookFors,
    teamSynthesis: applyCoachLanguageTranslations(teamSynthesis, sport.reportPolicy),
    adherence,
  };

  const reviewerOnly = buildReviewerOnly(
    athleteResults,
    generatorNotes,
    watchlist.suppressed,
    coachActions.suppressed,
  );

  return {
    coachSurface,
    reviewerOnly,
    generatorNotes,
  };
};

export const sportsIntelligenceReportGenerator = {
  generate: generateCoachReportDraft,
};
