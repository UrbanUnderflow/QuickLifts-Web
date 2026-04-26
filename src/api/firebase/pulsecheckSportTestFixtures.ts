import type {
  CoachActionCandidate,
  GameDayLookFor,
  NamedAthleteWatchEntry,
  ReportDimensionStateMap,
} from './pulsecheckSportConfig';

export type SportsIntelligenceFixtureSportId = 'basketball' | 'golf' | 'bowling' | 'track-field';

export type SportsIntelligenceFixtureScenario =
  | 'good-data'
  | 'thin-data'
  | 'missing-schedule'
  | 'missing-practice-plan'
  | 'device-gap'
  | 'clinical-boundary-signal'
  | 'high-load-stable-cognition'
  | 'low-recovery-unstable-sentiment';

export type CoachReportReviewStatus = 'draft' | 'in_review' | 'published' | 'held';

export type CoachReportReadConfidenceLabel = 'Strong read' | 'Usable read' | 'Thin read' | 'Holding back';

export interface CoachReportAdherenceSummary {
  deviceCoveragePct: number;
  noraCompletionPct: number;
  protocolSimCompletionPct: number;
  trainingPlanCoveragePct: number;
  confidenceLabel: CoachReportReadConfidenceLabel;
  coachSummary: string;
}

export interface CoachReportTopLine {
  whatChanged: string;
  who: string;
  firstAction: string;
  secondaryThread?: string;
}

export interface CoachReportCoachSurfaceMeta {
  reportId: string;
  teamId: string;
  sportId: SportsIntelligenceFixtureSportId;
  sportName: string;
  teamName: string;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  generatedAt: string;
  reviewStatus: CoachReportReviewStatus;
  reviewer: string;
  source: 'golden_fixture';
  fixtureScenario: SportsIntelligenceFixtureScenario;
  opponentOrEvent?: string;
  competitionDate?: string;
}

export interface CoachReportCoachSurface {
  meta: CoachReportCoachSurfaceMeta;
  topLine: CoachReportTopLine;
  dimensionState: ReportDimensionStateMap;
  watchlist: NamedAthleteWatchEntry[];
  coachActions: CoachActionCandidate[];
  gameDayLookFors: GameDayLookFor[];
  noteOpener: string;
  teamSynthesis: string;
  closer: string;
  adherence: CoachReportAdherenceSummary;
}

export interface CoachReportLocalizationAuditResult {
  passed: boolean;
  violations: Array<{ phrase: string; source: 'universal' | 'sport' }>;
}

export interface CoachReportReviewerEvidence {
  athleteEvidenceRefs: string[];
  sourceProvenance: string[];
  confidenceTier: 'directional' | 'emerging' | 'stable' | 'high_confidence' | 'degraded';
  missingInputs: string[];
  thresholdTrace: string[];
  unsuppressedSignals: string[];
}

export interface CoachReportReviewerAuditTrace {
  localizationAuditResult: CoachReportLocalizationAuditResult;
  suppressedWatchlistEntries: NamedAthleteWatchEntry[];
  suppressedCoachActions: CoachActionCandidate[];
  suppressionReasons: string[];
}

export interface CoachReportReviewerOnly {
  evidence: CoachReportReviewerEvidence;
  auditTrace: CoachReportReviewerAuditTrace;
}

export interface StoredCoachReport {
  id: string;
  teamId: string;
  sportId: SportsIntelligenceFixtureSportId;
  weekStart: string;
  weekEnd: string;
  reportKind: 'weekly';
  source: 'golden_fixture';
  reviewStatus: CoachReportReviewStatus;
  createdAt: string;
  updatedAt: string;
  coachSurface: CoachReportCoachSurface;
  reviewerOnly: CoachReportReviewerOnly;
}

interface SportFixtureBlueprint {
  sportId: SportsIntelligenceFixtureSportId;
  sportName: string;
  teamId: string;
  teamName: string;
  opponentOrEvent: string;
  competitionDate: string;
  weekLabel: string;
  primaryAthlete: {
    name: string;
    role: string;
    stableWhy: string;
    stableMove: string;
    extraWhy: string;
    extraMove: string;
  };
  secondaryAthlete: {
    name: string;
    role: string;
    stableWhy: string;
    stableMove: string;
  };
  unit: string;
  sportLoadPhrase: string;
  sportStablePhrase: string;
  sportConfidenceNudge: string;
  sportPracticePlanNudge: string;
  sportScheduleNudge: string;
  gameDayLookFor: GameDayLookFor;
  secondGameDayLookFor: GameDayLookFor;
  actionSession: string;
  dimensionGood: ReportDimensionStateMap;
  dimensionWatch: ReportDimensionStateMap;
}

const WEEK_START = '2026-04-20';
const WEEK_END = '2026-04-26';
const GENERATED_AT = '2026-04-25T12:00:00.000Z';
const REVIEWER = 'Pulse Sports Intelligence Review';

const FIXTURE_SCENARIO_LABELS: Record<SportsIntelligenceFixtureScenario, string> = {
  'good-data': 'Good data',
  'thin-data': 'Thin data',
  'missing-schedule': 'Missing schedule',
  'missing-practice-plan': 'Missing practice plan',
  'device-gap': 'Device gap',
  'clinical-boundary-signal': 'Clinical-boundary signal',
  'high-load-stable-cognition': 'High load + stable cognition',
  'low-recovery-unstable-sentiment': 'Low recovery + unstable sentiment',
};

export const SPORTS_INTELLIGENCE_FIXTURE_SCENARIOS = Object.keys(
  FIXTURE_SCENARIO_LABELS
) as SportsIntelligenceFixtureScenario[];

const SPORT_BLUEPRINTS: Record<SportsIntelligenceFixtureSportId, SportFixtureBlueprint> = {
  basketball: {
    sportId: 'basketball',
    sportName: 'Basketball',
    teamId: 'fixture-team-basketball',
    teamName: 'Pulse Demo Athletics · Men\'s Basketball',
    opponentOrEvent: 'at Riverside University',
    competitionDate: 'Wednesday',
    weekLabel: 'Week of Apr 20 - Apr 26, 2026',
    primaryAthlete: {
      name: 'M. Johnson',
      role: 'Point Guard',
      stableWhy: 'Recovery has been below his usual while minutes stayed heavy. The late-clock reads looked a step slower on Tuesday, which matters because he drives the first unit.',
      stableMove: 'Trim Tuesday\'s repeat-sprint block by one rep and keep Wednesday walkthrough verbal.',
      extraWhy: 'The workload is high, but his focus and response after mistakes are steady. This is a recovery management note, not a panic note.',
      extraMove: 'Protect the warm-up and skip extra live reps. Let him keep the decision-making reps clean.',
    },
    secondaryAthlete: {
      name: 'T. Davis',
      role: 'Combo Guard',
      stableWhy: 'Mood has been quieter since the rotation change and he has carried more ball pressure in the last two games.',
      stableMove: 'Five-minute role check-in before Friday shootaround. Keep it about role clarity, not film.',
    },
    unit: 'guard unit',
    sportLoadPhrase: 'minutes are catching up',
    sportStablePhrase: 'the reads are still organized',
    sportConfidenceNudge: 'the read will sharpen once every guard has a full week of wear and check-ins',
    sportPracticePlanNudge: 'drop the practice plan and we can separate planned work from extra live reps',
    sportScheduleNudge: 'drop the game and travel schedule and we will lock the timing of this read',
    gameDayLookFor: {
      athleteOrUnit: 'M. Johnson',
      lookFor: 'flat warm-up energy or late-clock hesitation in the first quarter',
      ifThen: 'start with one designed early possession and keep the cue to "next read."',
    },
    secondGameDayLookFor: {
      athleteOrUnit: 'guard unit',
      lookFor: 'late-clock reads slowing after the second media timeout',
      ifThen: 'shorten the possession package and use the early-clock action from Monday.',
    },
    actionSession: 'Tuesday repeat-sprint block',
    dimensionGood: { focus: 'solid', composure: 'solid', decisioning: 'solid' },
    dimensionWatch: { focus: 'solid', composure: 'watch', decisioning: 'watch' },
  },
  golf: {
    sportId: 'golf',
    sportName: 'Golf',
    teamId: 'fixture-team-golf',
    teamName: 'Pulse Demo Athletics · Men\'s Golf',
    opponentOrEvent: 'Conference qualifier at Pinehurst',
    competitionDate: 'Friday',
    weekLabel: 'Week of Apr 20 - Apr 26, 2026',
    primaryAthlete: {
      name: 'B. Holloway',
      role: 'Tournament Starter',
      stableWhy: 'Bad shots have been carrying into the next hole, especially after the turn. The swing is not the story this week; the response routine is.',
      stableMove: 'Thursday short-game session gets one cue only: target, commit, accept.',
      extraWhy: 'The walking load and long round are showing, but target clarity stayed steady in the last two practice rounds.',
      extraMove: 'Move warm-up earlier, keep the cue count to one, and protect the fueling window after hole six.',
    },
    secondaryAthlete: {
      name: 'J. Castillo',
      role: 'Tournament Starter',
      stableWhy: 'Two short sleep nights lined up with wider approach shots late in the round.',
      stableMove: 'Set tee-time prep one hour earlier and plan small fueling windows every six holes.',
    },
    unit: 'travel five',
    sportLoadPhrase: 'the grind of walking 18 is showing',
    sportStablePhrase: 'target commitment is still steady',
    sportConfidenceNudge: 'the read will sharpen once round notes and tee times are in one place',
    sportPracticePlanNudge: 'drop the round plan and we can separate routine work from extra range balls',
    sportScheduleNudge: 'drop the tee sheet and travel window and we will lock the timing of this read',
    gameDayLookFor: {
      athleteOrUnit: 'B. Holloway',
      lookFor: 'rushed routine on the first two tee shots',
      ifThen: 'walk to him before hole three and give one cue: target, commit.',
    },
    secondGameDayLookFor: {
      athleteOrUnit: 'J. Castillo',
      lookFor: 'tempo getting quick around holes 12 through 15',
      ifThen: 'check water and a small carb snack at the turn. Do not add swing cues.',
    },
    actionSession: 'Thursday short-game session',
    dimensionGood: { focus: 'solid', composure: 'solid', decisioning: 'solid' },
    dimensionWatch: { focus: 'solid', composure: 'watch', decisioning: 'solid' },
  },
  bowling: {
    sportId: 'bowling',
    sportName: 'Bowling',
    teamId: 'fixture-team-bowling',
    teamName: 'Pulse Demo Athletics · Bowling',
    opponentOrEvent: 'Conference tournament - Day 2',
    competitionDate: 'Saturday',
    weekLabel: 'Week of Apr 20 - Apr 26, 2026',
    primaryAthlete: {
      name: 'A. Ramos',
      role: 'Anchor',
      stableWhy: 'Repeating the same shot got harder late in Block 2. Grip looked tight by frame seven and the ball started leaking right.',
      stableMove: 'Skip extra warm-up balls Saturday. Standard warm-up only and one change at a time on lane transition.',
      extraWhy: 'Shot volume is high, but the spare routine and lane reads are still organized.',
      extraMove: 'Protect the between-block reset and keep transition talk to one adjustment at a time.',
    },
    secondaryAthlete: {
      name: 'J. Phillips',
      role: 'Lead',
      stableWhy: 'Spare conversion dipped late after Day 1 fatigue, and his pre-shot routine sped up after open frames.',
      stableMove: 'Use the same spare-process cue as last week. No new mechanics during the block.',
    },
    unit: 'travel pair',
    sportLoadPhrase: 'repeating the same shot got harder late',
    sportStablePhrase: 'the spare system is still organized',
    sportConfidenceNudge: 'the read will sharpen once every block has shot notes and check-ins',
    sportPracticePlanNudge: 'drop the block plan and we can separate planned shots from extra warm-up volume',
    sportScheduleNudge: 'drop the tournament block schedule and we will lock the timing of this read',
    gameDayLookFor: {
      athleteOrUnit: 'A. Ramos',
      lookFor: 'grip tight or shoulders rounding by frame six',
      ifThen: 'cue "tempo, not power" and skip extra reps in the next break.',
    },
    secondGameDayLookFor: {
      athleteOrUnit: 'J. Phillips',
      lookFor: 'an open frame followed by a rushed pre-shot',
      ifThen: 'use "same routine, same line." No mechanical talk.',
    },
    actionSession: 'Saturday Block 2 warm-up',
    dimensionGood: { focus: 'solid', composure: 'solid', decisioning: 'solid' },
    dimensionWatch: { focus: 'watch', composure: 'watch', decisioning: 'solid' },
  },
  'track-field': {
    sportId: 'track-field',
    sportName: 'Track & Field',
    teamId: 'fixture-team-track-field',
    teamName: 'Pulse Demo Athletics · Track & Field',
    opponentOrEvent: 'Meet at Westbrook University',
    competitionDate: 'Saturday',
    weekLabel: 'Week of Apr 20 - Apr 26, 2026',
    primaryAthlete: {
      name: 'D. Smith',
      role: 'Sprinter - 200m',
      stableWhy: 'Splits faded across two sessions and his warm-up looked flat compared with his usual rhythm.',
      stableMove: 'Pull one rep from Tuesday\'s 4x200 and skip the strength add-on.',
      extraWhy: 'Sprint load is high, but start-line focus and response to coaching stayed clean.',
      extraMove: 'Keep speed touches sharp and short. Do not stack extra strength work after the track session.',
    },
    secondaryAthlete: {
      name: 'A. Peters',
      role: 'Middle Distance - 800m',
      stableWhy: 'Fueling was inconsistent two days running and energy dropped late in the last quality session.',
      stableMove: 'Ten-minute fueling check-in Friday afternoon. Predictable carbs and a hydration plan.',
    },
    unit: 'sprint group',
    sportLoadPhrase: 'legs are looking heavy',
    sportStablePhrase: 'meet-day focus is still steady',
    sportConfidenceNudge: 'the read will sharpen once every event group has full wear and check-ins',
    sportPracticePlanNudge: 'drop the practice plan and we can separate planned speed work from extra touches',
    sportScheduleNudge: 'drop the meet schedule and event order and we will lock the timing of this read',
    gameDayLookFor: {
      athleteOrUnit: 'D. Smith',
      lookFor: 'flat warm-up jog or quiet energy on the line',
      ifThen: 'sneak in one extra acceleration before the 200 call and keep the cue to "drive."',
    },
    secondGameDayLookFor: {
      athleteOrUnit: 'sprint group',
      lookFor: 'tight shoulders during strides',
      ifThen: 'one cue per athlete. Skip tactical add-ons in the final five minutes.',
    },
    actionSession: 'Tuesday 4x200 session',
    dimensionGood: { focus: 'solid', composure: 'solid', decisioning: 'solid' },
    dimensionWatch: { focus: 'solid', composure: 'watch', decisioning: 'solid' },
  },
};

const makeWatchEntry = (
  athleteName: string,
  role: string,
  whyMatters: string,
  coachMove: string,
  evidenceRefs: string[],
  confidenceTier?: NamedAthleteWatchEntry['confidenceTier']
): NamedAthleteWatchEntry => {
  const entry: NamedAthleteWatchEntry = {
    athleteName,
    role,
    whyMatters,
    coachMove,
    evidenceRefs,
  };
  return confidenceTier ? { ...entry, confidenceTier } : entry;
};

const makeAction = (
  action: string,
  appliesTo: string,
  session: string,
  linkedSignals: string[] = []
): CoachActionCandidate => ({
  action,
  appliesTo,
  session,
  linkedSignals,
});

const makeAdherence = (
  confidenceLabel: CoachReportReadConfidenceLabel,
  coachSummary: string,
  values: Partial<Omit<CoachReportAdherenceSummary, 'confidenceLabel' | 'coachSummary'>> = {}
): CoachReportAdherenceSummary => ({
  deviceCoveragePct: values.deviceCoveragePct ?? 92,
  noraCompletionPct: values.noraCompletionPct ?? 86,
  protocolSimCompletionPct: values.protocolSimCompletionPct ?? 80,
  trainingPlanCoveragePct: values.trainingPlanCoveragePct ?? 88,
  confidenceLabel,
  coachSummary,
});

const scenarioReportStatus = (scenario: SportsIntelligenceFixtureScenario): CoachReportReviewStatus => (
  scenario === 'clinical-boundary-signal' ? 'held' : 'draft'
);

const makeScenarioCoachSurface = (
  sport: SportFixtureBlueprint,
  scenario: SportsIntelligenceFixtureScenario,
  reportId: string
): CoachReportCoachSurface => {
  const commonMeta: CoachReportCoachSurfaceMeta = {
    reportId,
    teamId: sport.teamId,
    sportId: sport.sportId,
    sportName: sport.sportName,
    teamName: sport.teamName,
    weekStart: WEEK_START,
    weekEnd: WEEK_END,
    weekLabel: sport.weekLabel,
    generatedAt: GENERATED_AT,
    reviewStatus: scenarioReportStatus(scenario),
    reviewer: REVIEWER,
    source: 'golden_fixture',
    fixtureScenario: scenario,
    opponentOrEvent: sport.opponentOrEvent,
    competitionDate: sport.competitionDate,
  };

  const normalWatchlist = [
    makeWatchEntry(
      sport.primaryAthlete.name,
      sport.primaryAthlete.role,
      sport.primaryAthlete.stableWhy,
      sport.primaryAthlete.stableMove,
      ['coach-reviewed pattern', 'fresh participation', 'sport-specific load read']
    ),
    makeWatchEntry(
      sport.secondaryAthlete.name,
      sport.secondaryAthlete.role,
      sport.secondaryAthlete.stableWhy,
      sport.secondaryAthlete.stableMove,
      ['coach-reviewed pattern', 'recent check-ins', 'sport-specific context']
    ),
  ];

  const normalActions = [
    makeAction(sport.primaryAthlete.stableMove, sport.primaryAthlete.name, sport.actionSession, ['primary-watch']),
    makeAction(sport.secondaryAthlete.stableMove, sport.secondaryAthlete.name, sport.competitionDate, ['secondary-watch']),
  ];

  const base = {
    meta: commonMeta,
    dimensionState: sport.dimensionWatch,
    watchlist: normalWatchlist,
    coachActions: normalActions,
    gameDayLookFors: [sport.gameDayLookFor, sport.secondGameDayLookFor],
    noteOpener: `Quick read for ${sport.opponentOrEvent}: ${sport.sportLoadPhrase} for ${sport.primaryAthlete.name}, and ${sport.secondaryAthlete.name} needs a cleaner support plan.`,
    teamSynthesis: `This is a ${sport.sportName.toLowerCase()} week where the staff should protect the key routine and coach the next action.`,
    closer: 'Pulse will hold anything that belongs outside practice and competition decisions out of this report. We will send the next read Sunday morning.',
  };

  switch (scenario) {
    case 'good-data':
      return {
        ...base,
        topLine: {
          whatChanged: `${sport.primaryAthlete.name} is the clearest watch this week because ${sport.sportLoadPhrase}.`,
          who: `${sport.primaryAthlete.name} and ${sport.secondaryAthlete.name}`,
          firstAction: sport.primaryAthlete.stableMove,
          secondaryThread: `${sport.secondaryAthlete.name} also needs a short, calm check-in before ${sport.competitionDate}.`,
        },
        adherence: makeAdherence('Strong read', 'Coverage is strong this week: device wear, check-ins, training context, and coach notes all line up.'),
      };
    case 'thin-data':
      return {
        ...base,
        dimensionState: { focus: 'thin_evidence', composure: 'thin_evidence', decisioning: 'thin_evidence' },
        watchlist: [],
        coachActions: [
          makeAction('Use this as a light context note only. Do not change the plan from this read alone.', sport.unit, sport.competitionDate),
        ],
        gameDayLookFors: [],
        noteOpener: `Light read for ${sport.opponentOrEvent}: ${sport.sportConfidenceNudge}.`,
        topLine: {
          whatChanged: 'Participation is too light for a strong athlete-specific read.',
          who: sport.unit,
          firstAction: 'Keep the current plan and use staff observation first this week.',
          secondaryThread: sport.sportConfidenceNudge,
        },
        teamSynthesis: 'The right move this week is to monitor, not oversteer.',
        adherence: makeAdherence('Thin read', sport.sportConfidenceNudge, {
          deviceCoveragePct: 48,
          noraCompletionPct: 42,
          protocolSimCompletionPct: 35,
          trainingPlanCoveragePct: 55,
        }),
      };
    case 'missing-schedule':
      return {
        ...base,
        watchlist: [normalWatchlist[0]],
        coachActions: [
          makeAction('Keep the planned adjustment small until the schedule is attached.', sport.primaryAthlete.name, sport.actionSession),
        ],
        topLine: {
          whatChanged: `${sport.primaryAthlete.name} is showing a usable pattern, but the calendar is missing.`,
          who: sport.primaryAthlete.name,
          firstAction: 'Make the smallest safe adjustment and add the schedule before publishing the final coach note.',
          secondaryThread: sport.sportScheduleNudge,
        },
        noteOpener: `Usable read, but ${sport.sportScheduleNudge}.`,
        adherence: makeAdherence('Usable read', sport.sportScheduleNudge, {
          deviceCoveragePct: 88,
          noraCompletionPct: 80,
          protocolSimCompletionPct: 77,
          trainingPlanCoveragePct: 48,
        }),
      };
    case 'missing-practice-plan':
      return {
        ...base,
        watchlist: [normalWatchlist[0]],
        coachActions: [
          makeAction('Keep the adjustment to recovery and walkthrough language until the plan is attached.', sport.primaryAthlete.name, sport.actionSession),
        ],
        topLine: {
          whatChanged: `${sport.primaryAthlete.name} has a useful load read, but we cannot tell planned work from extra work yet.`,
          who: sport.primaryAthlete.name,
          firstAction: 'Use the recovery move, then attach the plan so the next read can be tighter.',
          secondaryThread: sport.sportPracticePlanNudge,
        },
        noteOpener: `Useful read, but ${sport.sportPracticePlanNudge}.`,
        adherence: makeAdherence('Usable read', sport.sportPracticePlanNudge, {
          deviceCoveragePct: 90,
          noraCompletionPct: 82,
          protocolSimCompletionPct: 74,
          trainingPlanCoveragePct: 40,
        }),
      };
    case 'device-gap':
      return {
        ...base,
        watchlist: [normalWatchlist[1]],
        coachActions: [
          makeAction('Use the coach-observed routine note and hold back from load-based changes.', sport.secondaryAthlete.name, sport.competitionDate),
        ],
        topLine: {
          whatChanged: `${sport.secondaryAthlete.name} has the clearest coach-observed thread, but device coverage has a gap.`,
          who: sport.secondaryAthlete.name,
          firstAction: 'Coach the routine and hold back from a workload change unless staff eyes confirm it.',
          secondaryThread: 'We are leaning on the days they wore it, so this read stays lighter than usual.',
        },
        noteOpener: `Device coverage has a gap. We are leaning on the days they wore it and staff notes for ${sport.secondaryAthlete.name}.`,
        teamSynthesis: 'Use this as a support note. It is not a reason to rewrite the week.',
        adherence: makeAdherence('Usable read', 'We are leaning on the days they wore it, so load claims stay restrained.', {
          deviceCoveragePct: 58,
          noraCompletionPct: 84,
          protocolSimCompletionPct: 76,
          trainingPlanCoveragePct: 82,
        }),
      };
    case 'clinical-boundary-signal':
      return {
        ...base,
        dimensionState: { focus: 'thin_evidence', composure: 'thin_evidence', decisioning: 'thin_evidence' },
        watchlist: [],
        coachActions: [
          makeAction('Hold this report for Pulse review. Do not deliver a performance recommendation from this signal.', 'Pulse review team', 'before coach delivery'),
        ],
        gameDayLookFors: [],
        noteOpener: 'This report is held for review. The coach-facing version should not include private health details.',
        topLine: {
          whatChanged: 'A non-performance concern needs the proper review path before this report goes to the staff.',
          who: 'Pulse review team',
          firstAction: 'Hold delivery and route the concern through the right handoff.',
          secondaryThread: 'The coach report should stay focused on practice and competition decisions only.',
        },
        teamSynthesis: 'No athlete-specific performance recommendation should be sent from this fixture.',
        adherence: makeAdherence('Holding back', 'The read is held because one signal belongs outside the coach performance report.', {
          deviceCoveragePct: 91,
          noraCompletionPct: 88,
          protocolSimCompletionPct: 82,
          trainingPlanCoveragePct: 86,
        }),
      };
    case 'high-load-stable-cognition':
      return {
        ...base,
        dimensionState: sport.dimensionGood,
        watchlist: [
          makeWatchEntry(
            sport.primaryAthlete.name,
            sport.primaryAthlete.role,
            sport.primaryAthlete.extraWhy,
            sport.primaryAthlete.extraMove,
            ['workload is high', 'focus is steady', 'response is steady']
          ),
        ],
        coachActions: [
          makeAction(sport.primaryAthlete.extraMove, sport.primaryAthlete.name, sport.actionSession, ['high-load-stable-response']),
        ],
        topLine: {
          whatChanged: `${sport.primaryAthlete.name} is carrying a heavy week, but ${sport.sportStablePhrase}.`,
          who: sport.primaryAthlete.name,
          firstAction: sport.primaryAthlete.extraMove,
          secondaryThread: 'Treat this as load protection, not a readiness scare.',
        },
        noteOpener: `The workload is high, but ${sport.sportStablePhrase}.`,
        teamSynthesis: 'Protect recovery without stealing confidence.',
        adherence: makeAdherence('Strong read', 'Coverage is strong enough to make a practical recovery adjustment.'),
      };
    case 'low-recovery-unstable-sentiment':
      return {
        ...base,
        dimensionState: sport.dimensionWatch,
        watchlist: [
          makeWatchEntry(
            sport.primaryAthlete.name,
            sport.primaryAthlete.role,
            `${sport.primaryAthlete.stableWhy} The last two check-ins also came in flatter than usual, so the coach move should be simple and supportive.`,
            sport.primaryAthlete.stableMove,
            ['recovery below usual', 'recent check-ins flatter', 'coach-reviewed pattern']
          ),
          makeWatchEntry(
            sport.secondaryAthlete.name,
            sport.secondaryAthlete.role,
            `${sport.secondaryAthlete.stableWhy} The tone changed quickly across 48 hours, so use relationship first and instruction second.`,
            sport.secondaryAthlete.stableMove,
            ['recent check-ins flatter', 'staff context', 'sport-specific support plan']
          ),
        ],
        coachActions: [
          makeAction(sport.primaryAthlete.stableMove, sport.primaryAthlete.name, sport.actionSession),
          makeAction(sport.secondaryAthlete.stableMove, sport.secondaryAthlete.name, sport.competitionDate),
        ],
        topLine: {
          whatChanged: `${sport.primaryAthlete.name} and ${sport.secondaryAthlete.name} both need a lighter touch this week: recovery is low and the tone has changed quickly.`,
          who: `${sport.primaryAthlete.name} and ${sport.secondaryAthlete.name}`,
          firstAction: 'Lead with a short check-in, then make the smallest practice adjustment that preserves confidence.',
          secondaryThread: 'Keep the language about support and role clarity. Do not turn it into a label.',
        },
        noteOpener: `This is a support-first week for ${sport.primaryAthlete.name} and ${sport.secondaryAthlete.name}.`,
        teamSynthesis: 'Coach relationship first, then load. The report should help the staff simplify the week.',
        adherence: makeAdherence('Strong read', 'Coverage is strong, and the coach move stays practical and coach-safe.', {
          deviceCoveragePct: 90,
          noraCompletionPct: 92,
          protocolSimCompletionPct: 82,
          trainingPlanCoveragePct: 86,
        }),
      };
    default:
      return {
        ...base,
        topLine: {
          whatChanged: `${sport.primaryAthlete.name} is the clearest watch this week.`,
          who: sport.primaryAthlete.name,
          firstAction: sport.primaryAthlete.stableMove,
        },
        adherence: makeAdherence('Usable read', 'Coverage is usable this week.'),
      };
  }
};

const makeReviewerOnly = (
  sport: SportFixtureBlueprint,
  scenario: SportsIntelligenceFixtureScenario,
  coachSurface: CoachReportCoachSurface
): CoachReportReviewerOnly => {
  const missingInputsByScenario: Record<SportsIntelligenceFixtureScenario, string[]> = {
    'good-data': [],
    'thin-data': ['full-week device coverage', 'daily check-ins', 'recent sim sessions'],
    'missing-schedule': ['team schedule artifact'],
    'missing-practice-plan': ['prescribed practice plan'],
    'device-gap': ['two expected device syncs'],
    'clinical-boundary-signal': ['AuntEDNA handoff confirmation'],
    'high-load-stable-cognition': [],
    'low-recovery-unstable-sentiment': [],
  };

  const suppressedWatchlistEntries: NamedAthleteWatchEntry[] = scenario === 'thin-data'
    ? [
      makeWatchEntry(
        `${sport.unit} group`,
        sport.unit,
        'Group-only watch was suppressed because the coach report needs named athletes before it asks for action.',
        'Monitor only until participation improves.',
        ['group-only pattern'],
        'directional'
      ),
    ]
    : [];

  const suppressedCoachActions: CoachActionCandidate[] = scenario === 'thin-data' || scenario === 'device-gap'
    ? [
      { action: 'Make a broad workload change for the whole group.' },
    ]
    : [];

  const suppressionReasons: string[] = [];
  if (scenario === 'thin-data') {
    suppressionReasons.push('Held named watchlist and strong coach moves because participation is too light.');
  }
  if (scenario === 'device-gap') {
    suppressionReasons.push('Held load-based coach moves because device coverage has a gap.');
  }
  if (scenario === 'clinical-boundary-signal') {
    suppressionReasons.push('Held athlete-specific performance copy because the signal belongs in the escalation path.');
  }
  if (scenario === 'missing-schedule') {
    suppressionReasons.push('Kept timing claims restrained until schedule context is attached.');
  }
  if (scenario === 'missing-practice-plan') {
    suppressionReasons.push('Kept planned-versus-extra-work claims restrained until practice plan is attached.');
  }

  return {
    evidence: {
      athleteEvidenceRefs: coachSurface.watchlist.flatMap((entry) => entry.evidenceRefs || []),
      sourceProvenance: [
        'normalized health-context snapshot',
        'coach-reviewed sport context',
        'Nora check-in aggregate',
        'PulseCheck sim summary',
      ],
      confidenceTier: scenario === 'good-data' || scenario === 'high-load-stable-cognition' || scenario === 'low-recovery-unstable-sentiment'
        ? 'stable'
        : scenario === 'clinical-boundary-signal'
          ? 'degraded'
          : 'emerging',
      missingInputs: missingInputsByScenario[scenario],
      thresholdTrace: [
        `${FIXTURE_SCENARIO_LABELS[scenario]} reviewer fixture for ${sport.sportName}`,
        `Coach surface confidence: ${coachSurface.adherence.confidenceLabel}`,
      ],
      unsuppressedSignals: coachSurface.watchlist.map((entry) => `${entry.athleteName}: ${entry.whyMatters}`),
    },
    auditTrace: {
      localizationAuditResult: { passed: true, violations: [] },
      suppressedWatchlistEntries,
      suppressedCoachActions,
      suppressionReasons,
    },
  };
};

const buildFixture = (
  sportId: SportsIntelligenceFixtureSportId,
  scenario: SportsIntelligenceFixtureScenario
): StoredCoachReport => {
  const sport = SPORT_BLUEPRINTS[sportId];
  const reportId = `fixture-${sportId}-${scenario}`;
  const coachSurface = makeScenarioCoachSurface(sport, scenario, reportId);
  return {
    id: reportId,
    teamId: sport.teamId,
    sportId,
    weekStart: WEEK_START,
    weekEnd: WEEK_END,
    reportKind: 'weekly',
    source: 'golden_fixture',
    reviewStatus: coachSurface.meta.reviewStatus,
    createdAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    coachSurface,
    reviewerOnly: makeReviewerOnly(sport, scenario, coachSurface),
  };
};

export const SPORTS_INTELLIGENCE_GOLDEN_FIXTURES: Record<
  SportsIntelligenceFixtureSportId,
  Record<SportsIntelligenceFixtureScenario, StoredCoachReport>
> = (Object.keys(SPORT_BLUEPRINTS) as SportsIntelligenceFixtureSportId[]).reduce((sportMap, sportId) => {
  sportMap[sportId] = SPORTS_INTELLIGENCE_FIXTURE_SCENARIOS.reduce((scenarioMap, scenario) => {
    scenarioMap[scenario] = buildFixture(sportId, scenario);
    return scenarioMap;
  }, {} as Record<SportsIntelligenceFixtureScenario, StoredCoachReport>);
  return sportMap;
}, {} as Record<SportsIntelligenceFixtureSportId, Record<SportsIntelligenceFixtureScenario, StoredCoachReport>>);

export const listSportsIntelligenceFixtures = (
  sportId?: SportsIntelligenceFixtureSportId
): StoredCoachReport[] => {
  if (sportId) {
    return SPORTS_INTELLIGENCE_FIXTURE_SCENARIOS.map((scenario) =>
      cloneFixture(SPORTS_INTELLIGENCE_GOLDEN_FIXTURES[sportId][scenario])
    );
  }
  return (Object.keys(SPORTS_INTELLIGENCE_GOLDEN_FIXTURES) as SportsIntelligenceFixtureSportId[]).flatMap((id) =>
    SPORTS_INTELLIGENCE_FIXTURE_SCENARIOS.map((scenario) =>
      cloneFixture(SPORTS_INTELLIGENCE_GOLDEN_FIXTURES[id][scenario])
    )
  );
};

export const getSportsIntelligenceFixture = (
  sportId: SportsIntelligenceFixtureSportId,
  scenario: SportsIntelligenceFixtureScenario = 'good-data'
): StoredCoachReport | undefined => {
  const fixture = SPORTS_INTELLIGENCE_GOLDEN_FIXTURES[sportId]?.[scenario];
  return fixture ? cloneFixture(fixture) : undefined;
};

export const getSportsIntelligenceFixtureScenarioLabel = (
  scenario: SportsIntelligenceFixtureScenario
): string => FIXTURE_SCENARIO_LABELS[scenario];

const cloneFixture = (fixture: StoredCoachReport): StoredCoachReport => (
  JSON.parse(JSON.stringify(fixture)) as StoredCoachReport
);
