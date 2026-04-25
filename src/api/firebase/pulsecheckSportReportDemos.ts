// Coach-report demo data, shared between the admin mock-report baseline tab
// (preview chip) and the dedicated full-page coach-report demo route. Each
// example is a hand-crafted week of fixtures that exercises the report
// generator's gates: top-line three-fill, named-athlete watchlist, action
// specificity, dimension-state team read, look-for/if-then game-day note.

import {
  CoachActionCandidate,
  GameDayLookFor,
  NamedAthleteWatchEntry,
  ReportDimensionStateMap,
} from './pulsecheckSportConfig';

export interface CoachReportDemoMeta {
  weekLabel: string;
  opponentOrEvent?: string;
  competitionDate?: string;
  teamName?: string;
  primarySportColor?: string; // tailwind-friendly hex for accent strip
  primarySportColorSoft?: string; // soft / glow variant for backgrounds
}

export interface CoachReportDemoExample {
  meta: CoachReportDemoMeta;
  topLine: {
    whatChanged: string;
    who: string;
    firstAction: string;
    secondaryThread?: string;
  };
  dimensionState?: ReportDimensionStateMap;
  watchlist: NamedAthleteWatchEntry[];
  coachActions: CoachActionCandidate[];
  gameDayLookFors?: GameDayLookFor[];
  // Optional one-line, coach-voice intro that the generator could prepend so
  // the report opens like a note from an assistant coach.
  noteOpener?: string;
  // Optional one-line synthesis of the dimension state (e.g. "This is a meet-day
  // arousal week — coach the line, not the legs."). Falls back to an algorithmic
  // synthesis if absent.
  teamSynthesis?: string;
  // Optional warm closer rendered above the disclaimer ("We'll send the next one
  // Sunday morning. Reply with questions — we read every one.").
  closer?: string;
}

const SPORT_COLORS: Record<string, { primary: string; soft: string }> = {
  basketball: { primary: '#FF8A3D', soft: 'rgba(255, 138, 61, 0.12)' },
  soccer: { primary: '#22C55E', soft: 'rgba(34, 197, 94, 0.12)' },
  football: { primary: '#9F4FFF', soft: 'rgba(159, 79, 255, 0.12)' },
  baseball: { primary: '#3B82F6', soft: 'rgba(59, 130, 246, 0.12)' },
  softball: { primary: '#FACC15', soft: 'rgba(250, 204, 21, 0.12)' },
  volleyball: { primary: '#F97316', soft: 'rgba(249, 115, 22, 0.12)' },
  tennis: { primary: '#A3E635', soft: 'rgba(163, 230, 53, 0.12)' },
  swimming: { primary: '#06B6D4', soft: 'rgba(6, 182, 212, 0.12)' },
  'track-field': { primary: '#EF4444', soft: 'rgba(239, 68, 68, 0.12)' },
  wrestling: { primary: '#F59E0B', soft: 'rgba(245, 158, 11, 0.12)' },
  crossfit: { primary: '#EC4899', soft: 'rgba(236, 72, 153, 0.12)' },
  golf: { primary: '#10B981', soft: 'rgba(16, 185, 129, 0.12)' },
  bowling: { primary: '#8B5CF6', soft: 'rgba(139, 92, 246, 0.12)' },
  lacrosse: { primary: '#14B8A6', soft: 'rgba(20, 184, 166, 0.12)' },
  hockey: { primary: '#60A5FA', soft: 'rgba(96, 165, 250, 0.12)' },
  gymnastics: { primary: '#F472B6', soft: 'rgba(244, 114, 182, 0.12)' },
  'bodybuilding-physique': { primary: '#A78BFA', soft: 'rgba(167, 139, 250, 0.12)' },
  other: { primary: '#94A3B8', soft: 'rgba(148, 163, 184, 0.12)' },
};

export const getSportColor = (sportId: string) => SPORT_COLORS[sportId] || SPORT_COLORS.other;

export const COACH_REPORT_DEMO_EXAMPLES: Record<string, CoachReportDemoExample> = {
  basketball: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'at Tennessee State',
      competitionDate: 'Wednesday',
      teamName: 'UMES Men\'s Basketball',
      ...SPORT_COLORS.basketball,
      primarySportColor: SPORT_COLORS.basketball.primary,
      primarySportColorSoft: SPORT_COLORS.basketball.soft,
    },
    noteOpener: 'Quick note before the week: two of your guards are running on fumes.',
    topLine: {
      whatChanged: 'Johnson and Davis are looking heavy heading into Wednesday\'s game at Tennessee State.',
      who: 'M. Johnson and T. Davis (point guards)',
      firstAction: 'Pull one rep from Tuesday\'s repeat-sprint block and keep Wednesday\'s walkthrough short',
      secondaryThread: 'Separate thing — Davis\'s mood has been off since the rotation change two weeks ago. Worth a 5-minute one-on-one before Friday\'s shootaround.',
    },
    dimensionState: {
      focus: 'solid',
      composure: 'watch',
      decisioning: 'watch',
    },
    watchlist: [
      {
        athleteName: 'M. Johnson',
        role: 'Point Guard',
        whyMatters: 'Recovery has been below his usual for four straight days while he\'s been logging 34+ minutes a game. His reads in late-clock situations have slowed a notch.',
        coachMove: 'Cap Tuesday\'s repeat-sprint at 4 reps instead of 6. Keep Wednesday\'s install short and verbal — no live reps.',
        confidenceTier: 'stable',
        evidenceRefs: ['recovery is below his usual', 'starter logging heavy minutes', 'reads slower under fatigue'],
      },
      {
        athleteName: 'T. Davis',
        role: 'Point Guard',
        whyMatters: 'Minutes climbed after the rotation change and his mood has been off the last 48 hours. Nothing dramatic — but the pattern is there.',
        coachMove: 'Five-minute check-in before Friday\'s shootaround. Make it about role, not film.',
        confidenceTier: 'stable',
        evidenceRefs: ['mood is off', 'rotation has been changing'],
      },
    ],
    coachActions: [
      { action: 'Cap repeat-sprint volume to 4 reps', appliesTo: 'Johnson and Davis', session: 'Tuesday repeat-sprint block' },
      { action: 'Use possession-level reset language in walkthrough', appliesTo: 'starters and first-off-bench', session: 'Wednesday walkthrough' },
      { action: 'Five-minute one-on-one about role expectations', appliesTo: 'T. Davis', session: 'Friday shootaround' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'M. Johnson',
        lookFor: 'flat or quiet during pre-game warm-ups',
        ifThen: 'sneak in an extra acceleration before the tip and start him on a designed early possession.',
      },
      {
        athleteOrUnit: 'rotation guards',
        lookFor: 'late-clock reads slowing under second-half fatigue',
        ifThen: 'shorten possessions and use the early-clock action you put in Monday.',
      },
      {
        athleteOrUnit: 'whole team',
        lookFor: 'a quick opponent run flipping body language on the bench',
        ifThen: 'one cue at the timeout: "next possession." Don\'t pile on coaching.',
      },
    ],
    teamSynthesis: 'This is a back-to-back recovery week — coach the legs and the late-clock reads, the rest of the group is fine.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  golf: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'MEAC qualifying at Eagle Landing',
      competitionDate: 'Friday',
      teamName: 'UMES Men\'s Golf',
      ...SPORT_COLORS.golf,
      primarySportColor: SPORT_COLORS.golf.primary,
      primarySportColorSoft: SPORT_COLORS.golf.soft,
    },
    noteOpener: 'Quick read on the qualifier week.',
    topLine: {
      whatChanged: 'Bad shots have been bleeding into the next hole for Holloway, especially on the back nine.',
      who: 'B. Holloway',
      firstAction: 'Keep the cue count to one in Thursday\'s short-game session — target → commit. Skip swing video review',
      secondaryThread: 'Castillo also slept poorly the two nights before Tuesday\'s round and his late-round shots got tight. Move tee-time prep an hour earlier Friday and plan a quick fueling window every six holes.',
    },
    dimensionState: {
      focus: 'solid',
      composure: 'watch',
      decisioning: 'solid',
    },
    watchlist: [
      {
        athleteName: 'B. Holloway',
        whyMatters: 'Tuesday\'s qualifier showed bad shots leaking into the next hole through holes 12-15. Mood was lower in the post-round check-in.',
        coachMove: 'Thursday: one cue only — target, commit. No swing video this week.',
        confidenceTier: 'stable',
        evidenceRefs: ['bad shots have been bleeding into the next hole', 'response after mistakes is shaky'],
      },
      {
        athleteName: 'J. Castillo',
        whyMatters: 'Two nights of poor sleep before Tuesday and the spread on his approach shots widened late in the round.',
        coachMove: 'Tee-time prep one hour earlier Friday. Plan a fueling window every six holes.',
        confidenceTier: 'stable',
        evidenceRefs: ['sleep was off', 'spread on approach shots widened late'],
      },
    ],
    coachActions: [
      { action: 'One cue only — target, commit', appliesTo: 'B. Holloway', session: 'Thursday short-game session' },
      { action: 'Earlier tee-time prep + steady fueling windows', appliesTo: 'J. Castillo', session: 'Friday qualifying round' },
      { action: 'Skip swing video review for the watchlist', appliesTo: 'Holloway and Castillo', session: 'this week' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'B. Holloway',
        lookFor: 'a tight or rushed routine on the first two tee shots',
        ifThen: 'walk to him before hole 3 and remind him: target, commit. One cue.',
      },
      {
        athleteOrUnit: 'J. Castillo',
        lookFor: 'thirsty or slow tempo by hole 12',
        ifThen: 'check fueling/water at the turn, push a small carb snack between 12 and 13.',
      },
      {
        athleteOrUnit: 'whole team',
        lookFor: 'wind picking up after lunch (forecast says 12-15 mph by 1pm)',
        ifThen: 'shorten the tactical talk. Just say: "play one club more, commit."',
      },
    ],
    teamSynthesis: 'This is an acceptance-and-routine week — the swings are fine, it\'s how they handle the bad shot that wins this qualifier.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  bowling: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'MEAC tournament — Day 2',
      competitionDate: 'Saturday',
      teamName: 'UMES Bowling',
      ...SPORT_COLORS.bowling,
      primarySportColor: SPORT_COLORS.bowling.primary,
      primarySportColorSoft: SPORT_COLORS.bowling.soft,
    },
    noteOpener: 'Setting up Day 2 of the tournament.',
    topLine: {
      whatChanged: 'Repeating the same shot got harder for Ramos late in Block 2 yesterday — grip got tight and accuracy drifted.',
      who: 'A. Ramos (Anchor) and J. Phillips (Lead)',
      firstAction: 'Hold extra warm-up balls Saturday morning. One-change rule on lane transition reads',
      secondaryThread: 'Phillips\' spare conversion fell after Day 1 fatigue (78% to 61%). Keep the spare-process cue identical to last week — don\'t add anything new.',
    },
    dimensionState: {
      focus: 'watch',
      composure: 'watch',
      decisioning: 'solid',
    },
    watchlist: [
      {
        athleteName: 'A. Ramos',
        role: 'Anchor',
        whyMatters: 'Repeating the same shot dropped about 11% late in Block 2 with grip getting tight. He\'s a rep-based bowler and extras tomorrow morning will hurt more than help.',
        coachMove: 'Skip extra warm-up balls Saturday. One-change rule on the transition.',
        confidenceTier: 'stable',
        evidenceRefs: ['repeating the same shot', 'grip got tight'],
      },
      {
        athleteName: 'J. Phillips',
        role: 'Leadoff',
        whyMatters: 'Closing out spares fell from 78% to 61% after Day 1. Mood was a touch negative post-block.',
        coachMove: 'Keep the spare-process cue identical to last week. Short reset language between blocks.',
        confidenceTier: 'stable',
        evidenceRefs: ['closing out spares dropped', 'mood is off'],
      },
    ],
    coachActions: [
      { action: 'Cap warm-up balls; skip extras', appliesTo: 'A. Ramos and J. Phillips', session: 'Saturday Block 2 warm-up' },
      { action: 'One-change rule on transition adjustments', appliesTo: 'A. Ramos', session: 'Saturday Block 2' },
      { action: 'Plan a 15-minute reset/fueling window', appliesTo: 'team', session: 'Saturday between-block window' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'A. Ramos',
        lookFor: 'grip tight or shoulders rounding by frame 6',
        ifThen: 'between-frame cue: "tempo, not power." Skip extra reps in the next break.',
      },
      {
        athleteOrUnit: 'J. Phillips',
        lookFor: 'an open frame followed by a rushed pre-shot',
        ifThen: 'short reset language: "same routine, same line." No mechanical talk.',
      },
      {
        athleteOrUnit: 'team',
        lookFor: 'lane transition at frame 5-6 of Block 2',
        ifThen: 'one change at a time. Don\'t move target and ball in the same frame.',
      },
    ],
    teamSynthesis: 'This is a tournament-stamina week — repeatability and reset are the layers to coach, the read on the lane is fine.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  'track-field': {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Meet at Morgan State',
      competitionDate: 'Saturday',
      teamName: 'UMES Track & Field',
      ...SPORT_COLORS['track-field'],
      primarySportColor: SPORT_COLORS['track-field'].primary,
      primarySportColorSoft: SPORT_COLORS['track-field'].soft,
    },
    noteOpener: 'Quick read going into Saturday\'s meet.',
    topLine: {
      whatChanged: 'Smith and Adams are looking heavy in the legs going into Saturday\'s meet at Morgan State.',
      who: 'D. Smith and J. Adams (sprinters — 100/200)',
      firstAction: 'Pull one rep from Tuesday\'s 4x200 and skip the strength add-on',
      secondaryThread: 'Separate thing — Peters has been skipping pre-practice meals two days running. Stage a quick 10-minute fueling check-in Friday afternoon. Predictable carbs, hydration plan.',
    },
    dimensionState: {
      focus: 'solid',
      composure: 'watch',
      decisioning: 'solid',
    },
    watchlist: [
      {
        athleteName: 'D. Smith',
        role: 'Sprinter — 200m',
        whyMatters: 'Splits trended slower across two of three sessions and his recovery has been below his usual.',
        coachMove: 'Pull one rep from Tuesday\'s 4x200 and skip the strength add-on.',
        confidenceTier: 'stable',
        evidenceRefs: ['recovery is below his usual', 'feel for splits is off'],
      },
      {
        athleteName: 'A. Peters',
        role: 'Middle Distance — 800m',
        whyMatters: 'Distance group has been skipping pre-practice meals — Peters two days running. Volume is high enough that this catches up by Saturday.',
        coachMove: '10-minute fueling check-in Friday afternoon. Predictable carbs and a hydration plan.',
        confidenceTier: 'stable',
        evidenceRefs: ['distance group has been skipping pre-practice meals'],
      },
    ],
    coachActions: [
      { action: 'Pull one rep from 4x200; skip strength add-on', appliesTo: 'D. Smith and J. Adams', session: 'Tuesday 4x200 session' },
      { action: 'Fueling check-in — predictable carbs + hydration plan', appliesTo: 'A. Peters', session: 'Friday afternoon before meet' },
      { action: 'Use event-specific cueing — keep sprint and distance language separate', appliesTo: 'sprinters and middle distance', session: 'Saturday meet warm-up' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'D. Smith',
        lookFor: 'flat in the warm-up jog or quiet on the line',
        ifThen: 'sneak in an extra acceleration before the 200 call. Keep the cue to "drive."',
      },
      {
        athleteOrUnit: 'A. Peters',
        lookFor: 'low-energy in warm-up or skipped morning meal',
        ifThen: 'small carb top-up 60 minutes pre-race. Don\'t change race plan.',
      },
      {
        athleteOrUnit: 'sprinters as a group',
        lookFor: 'tight shoulders during strides or chatty in the call room',
        ifThen: 'one cue per athlete — "drive" or "tall." Skip tactical add-ons in the last 5 minutes.',
      },
    ],
    teamSynthesis: 'This is a meet-day arousal week — coach the line, not the legs.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  // Other sports get thin-read fallback for the demo until a coach-voice script is written.
  soccer: { meta: { weekLabel: 'Demo — Week of Apr 21', ...SPORT_COLORS.soccer, primarySportColor: SPORT_COLORS.soccer.primary, primarySportColorSoft: SPORT_COLORS.soccer.soft }, topLine: { whatChanged: '', who: '', firstAction: '' }, watchlist: [], coachActions: [] },
  football: { meta: { weekLabel: 'Demo — Week of Apr 21', ...SPORT_COLORS.football, primarySportColor: SPORT_COLORS.football.primary, primarySportColorSoft: SPORT_COLORS.football.soft }, topLine: { whatChanged: '', who: '', firstAction: '' }, watchlist: [], coachActions: [] },
  baseball: { meta: { weekLabel: 'Demo — Week of Apr 21', ...SPORT_COLORS.baseball, primarySportColor: SPORT_COLORS.baseball.primary, primarySportColorSoft: SPORT_COLORS.baseball.soft }, topLine: { whatChanged: '', who: '', firstAction: '' }, watchlist: [], coachActions: [] },
  softball: { meta: { weekLabel: 'Demo — Week of Apr 21', ...SPORT_COLORS.softball, primarySportColor: SPORT_COLORS.softball.primary, primarySportColorSoft: SPORT_COLORS.softball.soft }, topLine: { whatChanged: '', who: '', firstAction: '' }, watchlist: [], coachActions: [] },
  volleyball: { meta: { weekLabel: 'Demo — Week of Apr 21', ...SPORT_COLORS.volleyball, primarySportColor: SPORT_COLORS.volleyball.primary, primarySportColorSoft: SPORT_COLORS.volleyball.soft }, topLine: { whatChanged: '', who: '', firstAction: '' }, watchlist: [], coachActions: [] },
  tennis: { meta: { weekLabel: 'Demo — Week of Apr 21', ...SPORT_COLORS.tennis, primarySportColor: SPORT_COLORS.tennis.primary, primarySportColorSoft: SPORT_COLORS.tennis.soft }, topLine: { whatChanged: '', who: '', firstAction: '' }, watchlist: [], coachActions: [] },
  swimming: { meta: { weekLabel: 'Demo — Week of Apr 21', ...SPORT_COLORS.swimming, primarySportColor: SPORT_COLORS.swimming.primary, primarySportColorSoft: SPORT_COLORS.swimming.soft }, topLine: { whatChanged: '', who: '', firstAction: '' }, watchlist: [], coachActions: [] },
  wrestling: { meta: { weekLabel: 'Demo — Week of Apr 21', ...SPORT_COLORS.wrestling, primarySportColor: SPORT_COLORS.wrestling.primary, primarySportColorSoft: SPORT_COLORS.wrestling.soft }, topLine: { whatChanged: '', who: '', firstAction: '' }, watchlist: [], coachActions: [] },
  crossfit: { meta: { weekLabel: 'Demo — Week of Apr 21', ...SPORT_COLORS.crossfit, primarySportColor: SPORT_COLORS.crossfit.primary, primarySportColorSoft: SPORT_COLORS.crossfit.soft }, topLine: { whatChanged: '', who: '', firstAction: '' }, watchlist: [], coachActions: [] },
  lacrosse: { meta: { weekLabel: 'Demo — Week of Apr 21', ...SPORT_COLORS.lacrosse, primarySportColor: SPORT_COLORS.lacrosse.primary, primarySportColorSoft: SPORT_COLORS.lacrosse.soft }, topLine: { whatChanged: '', who: '', firstAction: '' }, watchlist: [], coachActions: [] },
  hockey: { meta: { weekLabel: 'Demo — Week of Apr 21', ...SPORT_COLORS.hockey, primarySportColor: SPORT_COLORS.hockey.primary, primarySportColorSoft: SPORT_COLORS.hockey.soft }, topLine: { whatChanged: '', who: '', firstAction: '' }, watchlist: [], coachActions: [] },
  gymnastics: { meta: { weekLabel: 'Demo — Week of Apr 21', ...SPORT_COLORS.gymnastics, primarySportColor: SPORT_COLORS.gymnastics.primary, primarySportColorSoft: SPORT_COLORS.gymnastics.soft }, topLine: { whatChanged: '', who: '', firstAction: '' }, watchlist: [], coachActions: [] },
  'bodybuilding-physique': { meta: { weekLabel: 'Demo — Week of Apr 21', ...SPORT_COLORS['bodybuilding-physique'], primarySportColor: SPORT_COLORS['bodybuilding-physique'].primary, primarySportColorSoft: SPORT_COLORS['bodybuilding-physique'].soft }, topLine: { whatChanged: '', who: '', firstAction: '' }, watchlist: [], coachActions: [] },
  other: { meta: { weekLabel: 'Demo — Week of Apr 21', ...SPORT_COLORS.other, primarySportColor: SPORT_COLORS.other.primary, primarySportColorSoft: SPORT_COLORS.other.soft }, topLine: { whatChanged: '', who: '', firstAction: '' }, watchlist: [], coachActions: [] },
};
