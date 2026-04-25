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
      opponentOrEvent: 'at Riverside University',
      competitionDate: 'Wednesday',
      teamName: 'Pulse Demo Athletics · Men\'s Basketball',
      ...SPORT_COLORS.basketball,
      primarySportColor: SPORT_COLORS.basketball.primary,
      primarySportColorSoft: SPORT_COLORS.basketball.soft,
    },
    noteOpener: 'Quick read before Wednesday\'s game at Riverside — two of your guards are wearing the back-to-back.',
    topLine: {
      whatChanged: 'Johnson and Davis are looking heavy heading into Wednesday\'s game at Riverside, and the late-clock reads are slipping a notch.',
      who: 'M. Johnson and T. Davis (point guards)',
      firstAction: 'Pull one rep from Tuesday\'s repeat-sprint block and keep Wednesday\'s walkthrough short — verbal install, no live reps.',
      secondaryThread: 'Separate thing — Davis\'s mood has been off since the rotation change two weeks ago. Worth a 5-minute one-on-one before Friday\'s shootaround. Make it about role, not film.',
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
        whyMatters: 'Recovery has been below his usual for four straight days while he\'s been logging 34+ minutes a game. His late-clock reads slipped on Tuesday\'s tape — turned the ball over twice on weak-side rotations he normally reads cleanly.',
        coachMove: 'Cap Tuesday\'s repeat-sprint at 4 reps instead of 6. Keep Wednesday\'s install short and verbal — no live reps.',
        confidenceTier: 'stable',
        evidenceRefs: ['recovery is below his usual', 'starter logging heavy minutes', 'reads slower under fatigue'],
      },
      {
        athleteName: 'T. Davis',
        role: 'Point Guard',
        whyMatters: 'Minutes climbed after the rotation change two weeks ago and his mood has been off the last 48 hours — quiet on the bus, didn\'t take his usual reps in shoot-around. Nothing dramatic; the pattern is there.',
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
    teamSynthesis: 'This is a back-to-back recovery week — coach the legs and the late-clock reads, the rest of the group is sharp.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  golf: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Conference qualifier at Pinehurst',
      competitionDate: 'Friday',
      teamName: 'Pulse Demo Athletics · Men\'s Golf',
      ...SPORT_COLORS.golf,
      primarySportColor: SPORT_COLORS.golf.primary,
      primarySportColorSoft: SPORT_COLORS.golf.soft,
    },
    noteOpener: 'Quick read before Friday\'s qualifier at Pinehurst — your back-nine response is the read this week, not the swing.',
    topLine: {
      whatChanged: 'Bad shots have been bleeding into the next hole for Holloway, especially through holes 12-15. Castillo\'s late-round shots got tight on Tuesday after two short sleep nights.',
      who: 'B. Holloway and J. Castillo',
      firstAction: 'Thursday short-game session — one cue only, target → commit. No swing video review.',
      secondaryThread: 'Separate thing — Castillo slept poorly the two nights before Tuesday\'s round and his late-round shots got tight. Move tee-time prep an hour earlier Friday and plan a quick fueling window every six holes.',
    },
    dimensionState: {
      focus: 'solid',
      composure: 'watch',
      decisioning: 'solid',
    },
    watchlist: [
      {
        athleteName: 'B. Holloway',
        role: 'Tournament starter',
        whyMatters: 'Tuesday\'s qualifier showed bad shots leaking into the next hole through holes 12-15 — three back-nine bogeys followed by a double on 14. Mood was quieter in the post-round check-in. Last week\'s pattern was the same — the swing isn\'t the issue, the response is.',
        coachMove: 'Thursday: one cue only — target, commit. No swing video this week. Pre-shot routine card on the bag for Friday.',
        confidenceTier: 'stable',
        evidenceRefs: ['bad shots have been bleeding into the next hole', 'response after mistakes is shaky'],
      },
      {
        athleteName: 'J. Castillo',
        role: 'Tournament starter',
        whyMatters: 'Two short sleep nights before Tuesday and the spread on his approach shots widened from holes 13 onward — three approaches inside 15 feet through the front, none inside 25 feet from 13 in. Tempo got quick on the back nine.',
        coachMove: 'Tee-time prep one hour earlier Friday. Plan a fueling window every six holes — predictable carbs, not on-course decisions.',
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
    teamSynthesis: 'This is an acceptance-and-routine week — the swings are sharp, it\'s how they handle the bad shot that wins this qualifier.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  bowling: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Conference tournament — Day 2',
      competitionDate: 'Saturday',
      teamName: 'Pulse Demo Athletics · Bowling',
      ...SPORT_COLORS.bowling,
      primarySportColor: SPORT_COLORS.bowling.primary,
      primarySportColorSoft: SPORT_COLORS.bowling.soft,
    },
    noteOpener: 'Quick read going into Day 2 of the conference tournament — your anchor is grip-tight and your leadoff\'s spare game took a step back.',
    topLine: {
      whatChanged: 'Repeating the same shot got harder for Ramos late in Block 2 yesterday — grip got tight by frame 7 and accuracy drifted right. Phillips\' spare conversion fell from 78% to 61% after Day 1 fatigue.',
      who: 'A. Ramos (Anchor) and J. Phillips (Lead)',
      firstAction: 'Skip extra warm-up balls Saturday morning — Ramos is rep-based and extras will hurt more than help. One-change rule on lane transition reads.',
      secondaryThread: 'Separate thing — keep the spare-process cue identical to last week for Phillips. Don\'t add anything new at the tournament — the routine is what closes spares, not new mechanics.',
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
        whyMatters: 'Repeating the same shot dropped about 11% late in Block 2 yesterday — grip got tight by frame 7 and the ball started leaking right. He\'s a rep-based bowler and extras tomorrow morning will hurt more than help.',
        coachMove: 'Skip extra warm-up balls Saturday — limit to the standard six. One-change rule on the transition.',
        confidenceTier: 'stable',
        evidenceRefs: ['repeating the same shot', 'grip got tight'],
      },
      {
        athleteName: 'J. Phillips',
        role: 'Leadoff',
        whyMatters: 'Closing out spares fell from 78% to 61% after Day 1 — five missed converts in the last two games. Mood was a touch negative post-block, quiet in the team room. Day 2 fatigue, not technique.',
        coachMove: 'Keep the spare-process cue identical to last week. Short reset language between blocks — same words every time.',
        confidenceTier: 'stable',
        evidenceRefs: ['closing out spares dropped', 'mood is off'],
      },
    ],
    coachActions: [
      { action: 'Skip extra warm-up balls — six standard, no extras', appliesTo: 'A. Ramos and J. Phillips', session: 'Saturday Block 2 warm-up' },
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
    teamSynthesis: 'This is a tournament-stamina week — repeatability and reset are the layers to coach, the read on the lane is sharp.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  'track-field': {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Meet at Westbrook University',
      competitionDate: 'Saturday',
      teamName: 'Pulse Demo Athletics · Track & Field',
      ...SPORT_COLORS['track-field'],
      primarySportColor: SPORT_COLORS['track-field'].primary,
      primarySportColorSoft: SPORT_COLORS['track-field'].soft,
    },
    noteOpener: 'Quick read going into Saturday\'s meet.',
    topLine: {
      whatChanged: 'Smith and Adams are looking heavy in the legs going into Saturday\'s meet at Westbrook University.',
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
  soccer: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'at Northridge State',
      competitionDate: 'Saturday',
      teamName: 'Pulse Demo Athletics · Soccer',
      ...SPORT_COLORS.soccer,
      primarySportColor: SPORT_COLORS.soccer.primary,
      primarySportColorSoft: SPORT_COLORS.soccer.soft,
    },
    noteOpener: 'Quick read going into Saturday — your midfield three is wearing the high-speed running load and the keeper voice has gotten quiet.',
    topLine: {
      whatChanged: 'Diaz is climbing past his usual high-speed running ceiling and the back-line keeper communication has been quieter on tape from the last two matches.',
      who: 'L. Diaz (CM) and V. Reyes (GK)',
      firstAction: 'Pull Diaz out of Wednesday\'s small-sided block — walk-through tactical work only, no live reps.',
      secondaryThread: 'Separate thing — keeper communication with the back four has gotten quieter the last two matches. Make Thursday\'s set-piece block an audible-only run with Reyes calling every clearance.',
    },
    dimensionState: {
      focus: 'watch',
      composure: 'solid',
      decisioning: 'watch',
    },
    watchlist: [
      {
        athleteName: 'L. Diaz',
        role: 'Central Midfielder',
        whyMatters: 'High-speed running has been 18% above his 4-week baseline across two matches. Recovery has been below his usual for three straight days, and his late-half decisioning slipped on Saturday\'s tape — chose the wrong pass twice on transition counters.',
        coachMove: 'Out of Wednesday\'s small-sided block. Walk-through tactics only. Full session Thursday with a planned 60-minute window for Saturday.',
        confidenceTier: 'stable',
        evidenceRefs: ['high-speed running is climbing past recovery', 'recovery is below his usual', 'final-third reads slowing under fatigue'],
      },
      {
        athleteName: 'V. Reyes',
        role: 'Goalkeeper',
        whyMatters: 'Communication with the back four has gotten quieter on tape from the last two matches. Body language during long-ball clearances looks tense — late on the shout, half a step behind the cross. Nothing technical; this is voice and confidence.',
        coachMove: 'Thursday set-piece block runs audible-only. Reyes calls every clearance. Five-minute talk about voice on Saturday warm-up.',
        confidenceTier: 'stable',
        evidenceRefs: ['goalkeeper confidence is shaky', 'response after mistakes is quiet'],
      },
    ],
    coachActions: [
      { action: 'Walk-through tactics only — no live reps', appliesTo: 'L. Diaz', session: 'Wednesday small-sided block' },
      { action: 'Audible-only set-piece block — keeper voice on every clearance', appliesTo: 'V. Reyes and back four', session: 'Thursday set-piece' },
      { action: 'Plan substitute window at 60 minutes', appliesTo: 'L. Diaz', session: 'Saturday match' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'L. Diaz',
        lookFor: 'heavy first 15 minutes or short on second-ball duels',
        ifThen: 'fresh midfielder from the bench. Don\'t wait for the 60-minute window if the legs aren\'t there.',
      },
      {
        athleteOrUnit: 'V. Reyes',
        lookFor: 'quiet on the first three back-passes or slow to call out cross targets',
        ifThen: 'walk past the box at the next dead ball. One cue: "talk first, then play."',
      },
      {
        athleteOrUnit: 'midfield three',
        lookFor: 'late-half decisioning slipping under second-half pressure',
        ifThen: 'simplify shape. Sit a fullback deeper. Don\'t ask for the high press until they reset.',
      },
    ],
    teamSynthesis: 'This is a midfield-load and keeper-voice week — coach the engine room and the communication, the front three is sharp.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  football: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'vs Westbrook State (home)',
      competitionDate: 'Saturday',
      teamName: 'Pulse Demo Athletics · Football',
      ...SPORT_COLORS.football,
      primarySportColor: SPORT_COLORS.football.primary,
      primarySportColorSoft: SPORT_COLORS.football.soft,
    },
    noteOpener: 'Quick read going into Saturday — your edge group is wearing the contact load from Tuesday\'s full-pads.',
    topLine: {
      whatChanged: 'Williams and Brooks are wearing the contact load from Tuesday\'s full-pads, and the late-period closeouts on the edge are slipping.',
      who: 'M. Williams (DE) and L. Brooks (OLB)',
      firstAction: 'Walk-through reps only on Wednesday\'s install — pull both off live periods and bring them back in for Thursday.',
      secondaryThread: 'Separate thing — Carter (QB) put two short nights together this week and his late-period reads got tight on Tuesday\'s tape. Move the install meeting 30 minutes later Friday so he can sleep through the morning.',
    },
    dimensionState: {
      focus: 'watch',
      composure: 'solid',
      decisioning: 'watch',
    },
    watchlist: [
      {
        athleteName: 'M. Williams',
        role: 'Defensive End',
        whyMatters: 'Contact load from Tuesday\'s full-pads is piling on top of last Saturday\'s 62 snaps. Recovery has been below his usual for three straight days, and his late-period closeouts on Tuesday\'s tape were a step late.',
        coachMove: 'Walk-through only on Wednesday\'s install. No live reps. Full session Thursday.',
        confidenceTier: 'stable',
        evidenceRefs: ['contact load piling on the edge', 'recovery is below his usual', 'closeout discipline slipping under fatigue'],
      },
      {
        athleteName: 'K. Carter',
        role: 'Quarterback',
        whyMatters: 'Two short sleep nights this week and Tuesday\'s tape showed his late-period reads getting tight — held the ball half a beat longer on the second-team look. Nothing dramatic; the pattern is there.',
        coachMove: 'Move the install meeting 30 minutes later Friday. Scale Thursday\'s seven-on-seven by 6 reps so he gets cleaner reps under-rested.',
        confidenceTier: 'stable',
        evidenceRefs: ['short sleep nights', 'reads slower under fatigue'],
      },
    ],
    coachActions: [
      { action: 'Walk-through reps only on the install', appliesTo: 'Williams and Brooks', session: 'Wednesday install' },
      { action: 'Move QB install meeting 30 minutes later', appliesTo: 'K. Carter', session: 'Friday install' },
      { action: 'Scale seven-on-seven by 6 reps', appliesTo: 'first-team defense', session: 'Thursday seven-on-seven' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'M. Williams',
        lookFor: 'heavy off the bus or tight on the first set of pre-game rushes',
        ifThen: 'swap his first series with the wave end. Save the closeout reps for the second-half rotation.',
      },
      {
        athleteOrUnit: 'K. Carter',
        lookFor: 'jittery in pre-game scripts or rushing the cadence',
        ifThen: 'one cue only — "feet first." Skip tactical add-ons in pre-game. Read the answer off the first series.',
      },
      {
        athleteOrUnit: 'first-team defense',
        lookFor: 'late-quarter assignment slips after a long offensive drive',
        ifThen: 'use the early-down call to buy a breather. Don\'t ask for the exotic look until they\'re back to even on rest.',
      },
    ],
    teamSynthesis: 'This is a contact-recovery week with a quarterback-sleep overlay — coach the rotations, not the playbook.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  baseball: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Doubleheader vs Lakeshore University',
      competitionDate: 'Saturday',
      teamName: 'Pulse Demo Athletics · Baseball',
      ...SPORT_COLORS.baseball,
      primarySportColor: SPORT_COLORS.baseball.primary,
      primarySportColorSoft: SPORT_COLORS.baseball.soft,
    },
    noteOpener: 'Quick read going into Saturday\'s doubleheader — your weekend rotation needs a closer look.',
    topLine: {
      whatChanged: 'Reyes is approaching pitch-count tightness across two starts and the catching pair is wearing all-day tournament throwing volume.',
      who: 'A. Reyes (SP) and the catching pair (Vega + Park)',
      firstAction: 'Cap Reyes at 75 pitches in Game 1 and split catching — Vega Game 1, Park Game 2. Decide the bullpen plan before warm-ups, not in the dugout.',
      secondaryThread: 'Separate thing — Hassan\'s bat speed has been trending lower across the week and he\'s been quieter in the dugout. Five-minute hitting check-in before Friday\'s BP — keep it about feel, not film.',
    },
    dimensionState: {
      focus: 'solid',
      composure: 'watch',
      decisioning: 'watch',
    },
    watchlist: [
      {
        athleteName: 'A. Reyes',
        role: 'Starting Pitcher',
        whyMatters: 'Inside the arm-care window from a 95-pitch start last weekend. Recovery has been below his usual for three straight days, and his throwing volume in the side session climbed past his normal between-start ceiling.',
        coachMove: 'Cap Saturday Game 1 at 75 pitches. Plan Vega\'s framing target zones tight to give him a quicker hook on borderline strikes.',
        confidenceTier: 'stable',
        evidenceRefs: ['arm-care window is tight', 'recovery is below his usual', 'throwing volume is climbing'],
      },
      {
        athleteName: 'J. Hassan',
        role: 'Outfield · Leadoff',
        whyMatters: 'Bat speed has been trending lower across three sessions and he\'s been quiet in the dugout the last two days. Sleep was thin two of the last three nights. Nothing dramatic — but the pattern is there before a long Saturday.',
        coachMove: 'Friday BP — short, feel-focused. Five-minute one-on-one about timing, not mechanics.',
        confidenceTier: 'stable',
        evidenceRefs: ['bat speed trending lower', 'mood is off', 'sleep was thin'],
      },
    ],
    coachActions: [
      { action: 'Cap Reyes at 75 pitches', appliesTo: 'A. Reyes', session: 'Saturday Game 1' },
      { action: 'Split catching across the doubleheader — Vega Game 1, Park Game 2', appliesTo: 'Vega and Park', session: 'Saturday doubleheader' },
      { action: 'Five-minute feel-focused hitting check-in (no film)', appliesTo: 'J. Hassan', session: 'Friday BP' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'A. Reyes',
        lookFor: 'velocity drops 1.5+ mph in the third inning or arm action shortens',
        ifThen: 'go to the bullpen on the next batter. Don\'t push past the count cap chasing a quick hook.',
      },
      {
        athleteOrUnit: 'catching pair',
        lookFor: 'tight throws back to the mound or slow blocks late in Game 1',
        ifThen: 'swap the catching plan early — even if Vega\'s due an at-bat. Preserve Park for Game 2.',
      },
      {
        athleteOrUnit: 'top of the order',
        lookFor: 'late-zone takes increasing as the doubleheader runs long',
        ifThen: 'simplify approach. One cue only — "first strike, find your pitch." Don\'t pile on situational hitting cues mid-game.',
      },
    ],
    teamSynthesis: 'This is a doubleheader-stamina week — coach the rotation and the catcher rotation, the rest of the lineup is sharp.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  softball: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Conference tournament — three-game weekend',
      competitionDate: 'Friday — Sunday',
      teamName: 'Pulse Demo Athletics · Softball',
      ...SPORT_COLORS.softball,
      primarySportColor: SPORT_COLORS.softball.primary,
      primarySportColorSoft: SPORT_COLORS.softball.soft,
    },
    noteOpener: 'Quick read going into the conference tournament — your circle is tight and Day-2 stamina is the real watch.',
    topLine: {
      whatChanged: 'Sanchez is approaching circle workload tightness across two starts and the catching pair is wearing all-day tournament throwing volume into Day 2.',
      who: 'K. Sanchez (P) and the catching pair (Park + Lopez)',
      firstAction: 'Cap Sanchez at 100 pitches in the Friday opener and split catching across the weekend — Park Friday and Sunday afternoon, Lopez Saturday.',
      secondaryThread: 'Separate thing — Mendez\'s bat speed has been trending lower across two sessions and her dugout body language has gotten quiet. Five-minute hitting check-in Thursday — feel-focused, no film.',
    },
    dimensionState: {
      focus: 'solid',
      composure: 'watch',
      decisioning: 'watch',
    },
    watchlist: [
      {
        athleteName: 'K. Sanchez',
        role: 'Pitcher',
        whyMatters: 'Inside the recovery window from a 110-pitch start last weekend. Recovery has been below her usual for three straight days, and her circle workload in Tuesday\'s side session climbed past her between-start ceiling. Rise-ball arm slot dropped a touch late in the bullpen.',
        coachMove: 'Cap Friday opener at 100 pitches. Plan Park\'s framing target zones tight to give Sanchez a quicker hook on borderline strikes.',
        confidenceTier: 'stable',
        evidenceRefs: ['arm-care window is tight', 'recovery is below her usual', 'tournament fatigue is showing'],
      },
      {
        athleteName: 'A. Mendez',
        role: 'Outfield · 3-hole',
        whyMatters: 'Bat speed has been trending lower across two sessions and she\'s been quiet in the dugout the last two practices. Sleep was thin two of the last three nights ahead of a long tournament weekend.',
        coachMove: 'Thursday hitting — short, feel-focused. Five-minute one-on-one about timing, not mechanics.',
        confidenceTier: 'stable',
        evidenceRefs: ['bat speed trending lower', 'mood is off', 'sleep was thin'],
      },
    ],
    coachActions: [
      { action: 'Cap Sanchez at 100 pitches', appliesTo: 'K. Sanchez', session: 'Friday opener' },
      { action: 'Split catching across the weekend — Park Fri+Sun PM, Lopez Sat', appliesTo: 'Park and Lopez', session: 'Friday — Sunday tournament' },
      { action: 'Five-minute feel-focused hitting check-in (no film)', appliesTo: 'A. Mendez', session: 'Thursday hitting' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'K. Sanchez',
        lookFor: 'rise-ball arm slot dropping a touch by the third inning, or velocity giving up 2 mph',
        ifThen: 'go to the bullpen on the next batter. Don\'t chase a quick hook past the pitch cap.',
      },
      {
        athleteOrUnit: 'catching pair',
        lookFor: 'tight pop times back to second or slow blocks late in Saturday\'s game',
        ifThen: 'swap the catching plan early — even mid-inning if needed. Day 2 stamina decides Sunday.',
      },
      {
        athleteOrUnit: 'top of the order',
        lookFor: 'late-zone takes increasing as the weekend runs long',
        ifThen: 'simplify approach. One cue only — "first strike, find your pitch." Fueling window every six innings.',
      },
    ],
    teamSynthesis: 'This is a tournament-stamina week — coach the circle and the catcher rotation, the rest of the lineup is sharp.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  volleyball: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Conference weekend — Friday at Northridge, Saturday vs Lakeshore',
      competitionDate: 'Friday — Saturday',
      teamName: 'Pulse Demo Athletics · Women\'s Volleyball',
      ...SPORT_COLORS.volleyball,
      primarySportColor: SPORT_COLORS.volleyball.primary,
      primarySportColorSoft: SPORT_COLORS.volleyball.soft,
    },
    noteOpener: 'Quick read before the conference weekend — your attackers are wearing the jump count and the libero is short on recovery.',
    topLine: {
      whatChanged: 'Reyes is climbing past her jump-count ceiling and Garcia\'s defensive volume across a heavy travel week is showing in her dig timing.',
      who: 'M. Reyes (Outside Hitter) and C. Garcia (Libero)',
      firstAction: 'Pull Reyes from Tuesday\'s approach-jump block — controlled-pace reps only, no full-out attack.',
      secondaryThread: 'Separate thing — middle blocker timing on combo plays got a beat late on Tuesday\'s tape. Make Wednesday\'s set-piece block audible-only — setter calls every quick attack.',
    },
    dimensionState: {
      focus: 'watch',
      composure: 'solid',
      decisioning: 'watch',
    },
    watchlist: [
      {
        athleteName: 'M. Reyes',
        role: 'Outside Hitter',
        whyMatters: 'Jump count is 22% above her 4-week baseline across two practices. Approach-jump intensity dropped a notch late in Tuesday\'s scrimmage and her recovery has been below her usual for three straight days.',
        coachMove: 'Tuesday block — controlled-pace approach reps only, no full-out attack. Save the explosive reps for Friday warm-up. Plan a 4-set rotation for Friday\'s match.',
        confidenceTier: 'stable',
        evidenceRefs: ['jump count is climbing past the line', 'approach-jump intensity dropping', 'recovery is below her usual'],
      },
      {
        athleteName: 'C. Garcia',
        role: 'Libero',
        whyMatters: 'Defensive deflection count is high across the travel week and her first-dig timing slipped a half-step on Tuesday\'s tape. Travel days are stacking — she carries the floor.',
        coachMove: 'Wednesday defensive block — drill quality, not quantity. Cap reps at 80% of her normal Tuesday volume and protect Thursday for full recovery.',
        confidenceTier: 'stable',
        evidenceRefs: ['defensive deflection count climbing', 'first-dig timing slipped', 'travel days stacking'],
      },
    ],
    coachActions: [
      { action: 'Controlled-pace approach reps only — no full-out attack', appliesTo: 'M. Reyes and outside hitters', session: 'Tuesday approach-jump block' },
      { action: 'Audible-only set-piece — setter calls every quick attack', appliesTo: 'middle blockers and setter', session: 'Wednesday set-piece' },
      { action: 'Cap defensive reps at 80% of Tuesday volume', appliesTo: 'C. Garcia and back-row defenders', session: 'Wednesday defensive block' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'M. Reyes',
        lookFor: 'tight on the first three approach jumps in warm-up, or short on second-set explosive swings',
        ifThen: 'rotate the second outside in earlier than planned. Save Reyes for the closing sets — don\'t spend her in set 1.',
      },
      {
        athleteOrUnit: 'middle blockers',
        lookFor: 'late-set timing slipping on combo plays — half a beat behind the quick',
        ifThen: 'simplify the block scheme — one read, not two. Setter\'s voice runs the call.',
      },
      {
        athleteOrUnit: 'C. Garcia',
        lookFor: 'slow on the first dig of each set or stretching to recover floor balls',
        ifThen: 'one cue — "early step." Skip extra defensive coverage talk in the timeout.',
      },
    ],
    teamSynthesis: 'This is a jump-load and defensive-floor week — coach the attack rotation and the libero recovery, serve receive looks sharp.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  tennis: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Conference singles + doubles championship — three-day event',
      competitionDate: 'Friday — Sunday',
      teamName: 'Pulse Demo Athletics · Tennis',
      ...SPORT_COLORS.tennis,
      primarySportColor: SPORT_COLORS.tennis.primary,
      primarySportColorSoft: SPORT_COLORS.tennis.soft,
    },
    noteOpener: 'Quick read before the conference championship — heat is going to be the deciding factor by Sunday.',
    topLine: {
      whatChanged: 'Forrester\'s match-duration cost from two long three-setters last weekend is still settling, and the heat forecast through Sunday compounds it.',
      who: 'L. Forrester (Singles 1) and the doubles team (Kim + Park)',
      firstAction: 'Lighter Friday hitting for Forrester — drill quality, no live sets. Move Sunday singles warm-up 30 minutes earlier to beat the afternoon heat.',
      secondaryThread: 'Separate thing — Kim has been quiet on between-point routines on Tuesday\'s tape. The momentum-swing recovery is slipping. Five-minute talk Thursday — keep it about the breath, not the strokes.',
    },
    dimensionState: {
      focus: 'solid',
      composure: 'watch',
      decisioning: 'solid',
    },
    watchlist: [
      {
        athleteName: 'L. Forrester',
        role: 'Singles · No. 1',
        whyMatters: 'Two long three-setters last weekend stacked match-duration cost. Recovery has been below her usual for four straight days, and her surface-load this week is high — the courts are clay through Sunday. The long-match recovery hasn\'t caught up.',
        coachMove: 'Friday hitting — drill quality only, no live sets. Sunday singles warm-up 30 minutes earlier. Plan a between-set hydration window every changeover.',
        confidenceTier: 'stable',
        evidenceRefs: ['long-match recovery hasn\'t caught up', 'recovery is below her usual', 'the heat block is showing'],
      },
      {
        athleteName: 'J. Kim',
        role: 'Doubles · No. 1',
        whyMatters: 'Between-point routines have shortened on the last two practice tapes — rushing the toss, skipping the breath. Mood has been quiet, and the momentum-swing recovery (response after a break of serve) is slipping.',
        coachMove: 'Five-minute Thursday talk — about the breath, not the strokes. Pre-match routine card on the bench Friday so she has something concrete to anchor on.',
        confidenceTier: 'stable',
        evidenceRefs: ['between-point routine shortened', 'response after errors is shaky', 'mood is off'],
      },
    ],
    coachActions: [
      { action: 'Lighter hitting — drill quality, no live sets', appliesTo: 'L. Forrester', session: 'Friday hitting' },
      { action: 'Earlier warm-up + between-set hydration windows', appliesTo: 'L. Forrester', session: 'Sunday singles' },
      { action: 'Five-minute breath-and-routine talk (no strokes)', appliesTo: 'J. Kim', session: 'Thursday afternoon' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'L. Forrester',
        lookFor: 'heavy on the first two service games or slow recovery between points',
        ifThen: 'shorter changeovers won\'t help — push hydration and a wet towel at every break. Don\'t add tactical talk; cue is "breath, then ball."',
      },
      {
        athleteOrUnit: 'J. Kim',
        lookFor: 'rushed toss or skipping the bounce routine after a break of serve',
        ifThen: 'walk to the net at the next changeover. One cue — "breath, then ball." Skip the strategic talk.',
      },
      {
        athleteOrUnit: 'whole team',
        lookFor: 'afternoon heat picking up by 1pm Sunday — forecast is 92° on the courts',
        ifThen: 'shorten the between-set tactical talk. Push electrolytes at every changeover. Move warm-up earlier for any match scheduled after 1pm.',
      },
    ],
    teamSynthesis: 'This is a heat and match-duration week — coach the routines, not the strokes.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  swimming: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Conference championship — three-day meet (taper week)',
      competitionDate: 'Thursday — Saturday',
      teamName: 'Pulse Demo Athletics · Swimming',
      ...SPORT_COLORS.swimming,
      primarySportColor: SPORT_COLORS.swimming.primary,
      primarySportColorSoft: SPORT_COLORS.swimming.soft,
    },
    noteOpener: 'Quick read before the conference taper meet — most of the team is settling well, two need watching.',
    topLine: {
      whatChanged: 'Allen is heading into 500/1650 with a thin recovery week and Jenkins\'s race-pace work has come up flat across two sessions.',
      who: 'T. Allen (Distance, 500/1650) and C. Jenkins (Sprint, 50/100)',
      firstAction: 'Skip Allen\'s Tuesday distance set — replace with broken 200s at race pace. Move Jenkins\'s race-pace work to Thursday morning when he\'s fresh.',
      secondaryThread: 'Separate thing — taper-nerves are showing on the relay group. Quiet at warm-up, second-guessing splits in practice. Friday pre-meet meeting — keep it short, anchor on race plan.',
    },
    dimensionState: {
      focus: 'solid',
      composure: 'watch',
      decisioning: 'solid',
    },
    watchlist: [
      {
        athleteName: 'T. Allen',
        role: 'Distance · 500 / 1650',
        whyMatters: 'Recovery has been below his usual for four straight days. Sleep was thin two nights this week, and he missed Monday\'s yardage block with a head cold. Distance group needs a clean taper — he\'s entering the meet with a thinner recovery base than the rest.',
        coachMove: 'Skip Tuesday\'s distance set. Replace with broken 200s at race pace — quality over yardage. Sleep target conversation Thursday.',
        confidenceTier: 'stable',
        evidenceRefs: ['recovery is below his usual', 'the back-half of the volume block is showing', 'sleep was thin'],
      },
      {
        athleteName: 'C. Jenkins',
        role: 'Sprint · 50 / 100',
        whyMatters: 'Race-pace work has come up flat across two sessions — first 25 split slower than baseline both times. Body language tight on the blocks; mood quiet on the deck. Taper-nerves rather than physical decay.',
        coachMove: 'Move race-pace work to Thursday morning. Block start drills only — no broken 100s. Five-minute talk about the first stroke, not the time.',
        confidenceTier: 'stable',
        evidenceRefs: ['race-pace coming up flat', 'mood is off', 'taper nerves'],
      },
    ],
    coachActions: [
      { action: 'Skip Tuesday distance set — replace with broken 200s at race pace', appliesTo: 'T. Allen', session: 'Tuesday distance block' },
      { action: 'Move race-pace work to Thursday morning — block start drills only', appliesTo: 'C. Jenkins', session: 'Thursday morning' },
      { action: 'Short pre-meet meeting anchored on race plan (not splits)', appliesTo: 'relay group', session: 'Friday afternoon' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'T. Allen',
        lookFor: 'heavy in warm-up or quiet at the wall before the 500',
        ifThen: 'one cue only — "first 200, your tempo." Don\'t mention splits in the warm-up walk.',
      },
      {
        athleteOrUnit: 'C. Jenkins',
        lookFor: 'tight on the first 50 of warm-up or rushing to the blocks',
        ifThen: 'walk him to the wall before the call. One cue — "first stroke, your stroke." No tactical add-ons.',
      },
      {
        athleteOrUnit: 'relay group',
        lookFor: 'second-guessing exchanges or stretching too far on the start',
        ifThen: 'hold them at the wall for 30 seconds at the marshal call. One cue per leg — keep it the same word every relay.',
      },
    ],
    teamSynthesis: 'This is a taper-and-race-readiness week — coach the line, not the legs.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  wrestling: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Dual at Lakeshore University',
      competitionDate: 'Saturday',
      teamName: 'Pulse Demo Athletics · Wrestling',
      ...SPORT_COLORS.wrestling,
      primarySportColor: SPORT_COLORS.wrestling.primary,
      primarySportColorSoft: SPORT_COLORS.wrestling.soft,
    },
    noteOpener: 'Quick read going into Saturday\'s dual at Lakeshore — your weight cuts are tight and your 174 has gotten quiet.',
    topLine: {
      whatChanged: 'Davis is two pounds out two days from weigh-ins and his mat-time intensity dropped on Tuesday\'s tape. Holloway has been quiet in the room — captain or not.',
      who: 'M. Davis (174-lb starter) and K. Holloway (141-lb captain)',
      firstAction: 'Skip Wednesday\'s hard live-go for Davis. Drilling only, no full reps. Sauna restriction until weigh-ins.',
      secondaryThread: 'Separate thing — Holloway has been quiet in the room since the rotation move two weeks ago. Five-minute one-on-one Thursday. Make it about the captain role, not technique.',
    },
    dimensionState: {
      focus: 'solid',
      composure: 'watch',
      decisioning: 'solid',
    },
    watchlist: [
      {
        athleteName: 'M. Davis',
        role: '174-lb · Starter',
        whyMatters: 'Two pounds out two days from Saturday weigh-ins. Mat-time intensity dropped a notch on Tuesday — slower on the shot, hand fight quieter. Recovery has been below his usual for three straight days. Sleep was thin two of the last three nights.',
        coachMove: 'Skip Wednesday hard live-go. Drilling only, no full reps. Sauna restriction until weigh-ins. Recheck water Friday morning.',
        confidenceTier: 'stable',
        evidenceRefs: ['grip is tight going into the cut', 'mat time is piling on', 'recovery is below his usual'],
      },
      {
        athleteName: 'K. Holloway',
        role: '141-lb · Captain',
        whyMatters: 'Mat time has been high across two weeks since he took the captain spot. Quiet in the room the last few sessions — didn\'t lead the warm-up Tuesday or Wednesday. Response after his close loss last Saturday is still settling.',
        coachMove: 'Five-minute talk Thursday — about the captain role, not technique. Pair him in a leadership drill Friday so the team sees him running the room again.',
        confidenceTier: 'stable',
        evidenceRefs: ['mood is off', 'close-loss recovery is shaky'],
      },
    ],
    coachActions: [
      { action: 'Skip hard live-go — drilling only, sauna restriction until weigh-ins', appliesTo: 'M. Davis', session: 'Wednesday live-go block' },
      { action: 'Five-minute captain-role talk + leadership drill pairing', appliesTo: 'K. Holloway', session: 'Thursday afternoon' },
      { action: 'Cut-day water + carb plan briefed before warm-up', appliesTo: 'all weight-class starters', session: 'Friday morning weigh-in window' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'M. Davis',
        lookFor: 'low energy in warm-up, quiet between matches, or slow on the first stance reset',
        ifThen: 'walk to him before the call. One cue — "stance, then shot." Add a second carb top-up between matches.',
      },
      {
        athleteOrUnit: 'K. Holloway',
        lookFor: 'tight in stance during warm-up or short on hand-fight reps',
        ifThen: 'one cue at the corner — "hands first." Skip technical add-ons. Let him run the bench between matches.',
      },
      {
        athleteOrUnit: 'team in the warm-up tunnel',
        lookFor: 'chatty, looking around, or quiet bench during the early matches',
        ifThen: 'no big speech. One cue — "next match, your match." Captains run the room.',
      },
    ],
    teamSynthesis: 'This is a cut-and-mat-fatigue week — coach the cuts and the captain, the rest of the room is sharp.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  crossfit: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Online qualifier weekend — three workouts',
      competitionDate: 'Friday — Sunday',
      teamName: 'Pulse Demo Athletics · CrossFit',
      ...SPORT_COLORS.crossfit,
      primarySportColor: SPORT_COLORS.crossfit.primary,
      primarySportColorSoft: SPORT_COLORS.crossfit.soft,
    },
    noteOpener: 'Quick read going into the qualifier weekend — your grip is the read, not the engine.',
    topLine: {
      whatChanged: 'Reyes is hitting the qualifier with grip fatigue from this week\'s pulling block, and Park\'s monostructural pace dropped on Tuesday\'s metcon after two weeks of doubles.',
      who: 'M. Reyes and C. Park (both top-quartile athletes)',
      firstAction: 'Drop pulling volume for Reyes Wednesday — gymnastics-skill work only, no toes-to-bar or muscle-up sets. Park to single sessions through the weekend.',
      secondaryThread: 'Separate thing — leaderboard pressure is showing. The bench has been refreshing the standings between sessions. Friday short meeting — anchor on the workout, not the score.',
    },
    dimensionState: {
      focus: 'solid',
      composure: 'watch',
      decisioning: 'watch',
    },
    watchlist: [
      {
        athleteName: 'M. Reyes',
        role: 'Open Athlete · Top Quartile',
        whyMatters: 'Grip strain proxy is climbing across the week — heavy pulling block stacked on top of yesterday\'s muscle-up volume. Recovery has been below her usual for three straight days. Hand check showed tear risk on the right palm.',
        coachMove: 'Wednesday gymnastics-skill work only — no toes-to-bar or muscle-up sets. Tape + chalk plan for the weekend. Skip Thursday metcon entirely.',
        confidenceTier: 'stable',
        evidenceRefs: ['grip is going into the qualifier hot', 'recovery is below her usual', 'gymnastics volume climbing'],
      },
      {
        athleteName: 'C. Park',
        role: 'Open Athlete · Top Quartile',
        whyMatters: 'Two weeks of double sessions are showing — monostructural pace dropped 6% on Tuesday\'s rower benchmark vs. his 4-week baseline. Sleep efficiency has been thin and his mood read quieter on the deck.',
        coachMove: 'Single sessions only through Sunday. AM strength dropped, PM metcon kept lighter. Move Friday warm-up later so he gets sleep through.',
        confidenceTier: 'stable',
        evidenceRefs: ['density block is catching up', 'monostructural pace dropping', 'mood is off'],
      },
    ],
    coachActions: [
      { action: 'Gymnastics-skill work only — no T2B or muscle-up sets', appliesTo: 'M. Reyes', session: 'Wednesday gymnastics block' },
      { action: 'Single sessions through the weekend — drop AM strength, lighter PM metcon', appliesTo: 'C. Park', session: 'Wednesday — Sunday' },
      { action: 'Short pre-workout meeting anchored on the workout (not standings)', appliesTo: 'all qualifier athletes', session: 'Friday afternoon' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'M. Reyes',
        lookFor: 'grip giving way during the pull-up segment — tape rolling or hands shaking out between sets',
        ifThen: 'hold her at the rig. Singles if needed. Don\'t chase the leaderboard if the grip goes — protect the next workout.',
      },
      {
        athleteOrUnit: 'C. Park',
        lookFor: 'pace dropping in the second half of the metcon — slow on the rower or tight on the run',
        ifThen: 'reset breathing at the next transition. One cue — "your pace, not the leader\'s pace." Don\'t coach mid-station.',
      },
      {
        athleteOrUnit: 'whole team',
        lookFor: 'leaderboard pressure leaking into warm-up or athletes refreshing standings between sessions',
        ifThen: 'no big speech. One cue — "your workout." Coaches run the warm-up clock; phones go away.',
      },
    ],
    teamSynthesis: 'This is a grip-and-pace week — manage the limiter, not the engine.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  lacrosse: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'at Northridge State',
      competitionDate: 'Saturday',
      teamName: 'Pulse Demo Athletics · Men\'s Lacrosse',
      ...SPORT_COLORS.lacrosse,
      primarySportColor: SPORT_COLORS.lacrosse.primary,
      primarySportColorSoft: SPORT_COLORS.lacrosse.soft,
    },
    noteOpener: 'Quick read going into Saturday — your two-way mids are wearing the sprint demand.',
    topLine: {
      whatChanged: 'Sanders is climbing past his usual high-speed running ceiling and his late-half clearing decisioning slipped on Tuesday\'s tape. Goalie communication has gotten quieter on clears.',
      who: 'L. Sanders (Midfielder) and V. Reyes (Goalie)',
      firstAction: 'Pull Sanders out of Wednesday\'s small-sided block — walk-through tactical work only, no live reps. Plan a 30-minute window for Saturday.',
      secondaryThread: 'Separate thing — Reyes\'s communication on clears has gotten quiet on the last two tapes. Make Thursday\'s ride-and-clear block audible-only — Reyes calls every clear.',
    },
    dimensionState: {
      focus: 'watch',
      composure: 'solid',
      decisioning: 'watch',
    },
    watchlist: [
      {
        athleteName: 'L. Sanders',
        role: 'Midfielder · Two-Way',
        whyMatters: 'High-speed running has been 22% above his 4-week baseline across two games. Recovery has been below his usual for three straight days. Late-half clearing decisioning slipped on Tuesday — chose the wrong outlet twice on transition counters.',
        coachMove: 'Out of Wednesday\'s small-sided. Walk-through tactics only. Full session Thursday with a planned 30-minute window for Saturday.',
        confidenceTier: 'stable',
        evidenceRefs: ['two-way sprint demand is climbing', 'recovery is below his usual', 'clearing decisions slowing'],
      },
      {
        athleteName: 'V. Reyes',
        role: 'Goalie',
        whyMatters: 'Communication on clears has gotten quiet on the last two tapes — late on the call, half a step behind the slide. Mood read quieter in the post-practice check-ins. This is voice and confidence, not save percentage.',
        coachMove: 'Thursday ride-and-clear block runs audible-only. Reyes calls every clear. Five-minute talk Friday about voice in the cage.',
        confidenceTier: 'stable',
        evidenceRefs: ['goalie confidence is shaky', 'communication on clears is quiet'],
      },
    ],
    coachActions: [
      { action: 'Walk-through tactics only — no live reps', appliesTo: 'L. Sanders', session: 'Wednesday small-sided block' },
      { action: 'Audible-only ride-and-clear — goalie calls every clear', appliesTo: 'V. Reyes and defensive midfielders', session: 'Thursday ride-and-clear block' },
      { action: 'Plan substitute window at 30 minutes', appliesTo: 'L. Sanders', session: 'Saturday match' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'L. Sanders',
        lookFor: 'heavy first 10 minutes or short on the second-ball ground-balls',
        ifThen: 'fresh mid from the bench. Don\'t wait for the 30-minute window if the legs aren\'t there.',
      },
      {
        athleteOrUnit: 'V. Reyes',
        lookFor: 'quiet on the first three save-and-clear sequences',
        ifThen: 'walk past the cage at the next dead ball. One cue — "talk first, then clear."',
      },
      {
        athleteOrUnit: 'midfield as a unit',
        lookFor: 'late-half clearing decisions slowing under second-half pressure',
        ifThen: 'simplify the clear — short, safe outlet to the wing. Don\'t ask for the cross-field skip until they reset.',
      },
    ],
    teamSynthesis: 'This is a two-way midfield and goalie-voice week — coach the engine room and the cage, attack looks sharp.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  hockey: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Back-to-back at Northridge — Friday and Saturday',
      competitionDate: 'Friday — Saturday',
      teamName: 'Pulse Demo Athletics · Men\'s Hockey',
      ...SPORT_COLORS.hockey,
      primarySportColor: SPORT_COLORS.hockey.primary,
      primarySportColorSoft: SPORT_COLORS.hockey.soft,
    },
    noteOpener: 'Quick read before the back-to-back at Northridge — your top line is wearing the shift pattern and your D pair is short on contact recovery.',
    topLine: {
      whatChanged: 'Cooper\'s shift count is climbing past his usual ceiling and Davis\'s contact accumulation from last weekend\'s game is still settling. Goalie reads sharp.',
      who: 'J. Cooper (Center, Top Line) and M. Davis (Defenseman)',
      firstAction: 'Cap Cooper\'s shift length to 45 seconds Friday — bench him at the next clean change rather than running long. Davis sits Wednesday\'s contact session.',
      secondaryThread: 'Separate thing — Saturday is a 7pm faceoff after Friday\'s late game. Game-day skate moves to morning, optional. Travel meal moved 30 minutes earlier.',
    },
    dimensionState: {
      focus: 'solid',
      composure: 'watch',
      decisioning: 'watch',
    },
    watchlist: [
      {
        athleteName: 'J. Cooper',
        role: 'Center · Top Line',
        whyMatters: 'Average shift length climbed 8 seconds over his 4-week baseline last weekend, and total ice time was 22 minutes both nights. Recovery has been below his usual for three straight days. Late-period decisioning slipped on Tuesday\'s tape — held the puck a beat too long on two cycle plays.',
        coachMove: 'Cap shift length to 45 seconds Friday — bench at the next clean change. Skip Wednesday\'s up-tempo skate. Plan a 4th-line faceoff cycle to give him a longer bench every shift change.',
        confidenceTier: 'stable',
        evidenceRefs: ['shift length is creeping up', 'recovery is below his usual', 'puck decisions slowing under fatigue'],
      },
      {
        athleteName: 'M. Davis',
        role: 'Defenseman · Top Pair',
        whyMatters: 'Took 14 hits in last Saturday\'s game and contact load has barely settled — accelerometer impact integration is still 15% above his weekly average four days later. Tight in his own zone on Tuesday\'s drills.',
        coachMove: 'Sit Wednesday\'s contact session. Walk-through D-zone coverage only — no live forecheck. Light skate Thursday. Watch his first shift Friday.',
        confidenceTier: 'stable',
        evidenceRefs: ['contact accumulation is showing', 'recovery is below his usual'],
      },
    ],
    coachActions: [
      { action: 'Cap shift length to 45 seconds + plan extended 4th-line cycle', appliesTo: 'J. Cooper', session: 'Friday game' },
      { action: 'Sit contact session — walk-through D-zone coverage only', appliesTo: 'M. Davis', session: 'Wednesday contact session' },
      { action: 'Optional morning skate; travel meal moved 30 min earlier', appliesTo: 'whole team', session: 'Saturday game day' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'J. Cooper',
        lookFor: 'short on first shift or chasing the puck instead of taking ice',
        ifThen: 'shorten his next two shifts. Don\'t ask the top line to drive the cycle until the third period — let the second line set tempo.',
      },
      {
        athleteOrUnit: 'M. Davis',
        lookFor: 'tight in his own zone first period, slow to angle, or backing off contact',
        ifThen: 'reduce his D-zone time — pair him with a forward who can break the puck out clean. Don\'t put him on the PK until period two.',
      },
      {
        athleteOrUnit: 'top six in the third period',
        lookFor: 'late-game B2B fatigue — short shifts but slow back-checks',
        ifThen: 'change on the fly aggressively. Don\'t coach lineup mid-period; trust the pattern and let the bench breathe.',
      },
    ],
    teamSynthesis: 'This is a B2B-stamina week — coach the rotations and the contact, the goalie is sharp.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  gymnastics: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Home meet — pre-conference final',
      competitionDate: 'Friday',
      teamName: 'Pulse Demo Athletics · Women\'s Gymnastics',
      ...SPORT_COLORS.gymnastics,
      primarySportColor: SPORT_COLORS.gymnastics.primary,
      primarySportColorSoft: SPORT_COLORS.gymnastics.soft,
    },
    noteOpener: 'Quick read going into Friday\'s home meet — your landing volume is past the line on floor and your beam confidence is shaky.',
    topLine: {
      whatChanged: 'Patel\'s landing load on floor is climbing across the week and her stuck-landing rate dropped on Tuesday. Kim has been quiet on beam since Tuesday\'s fall — perfectionism spiral, not technique.',
      who: 'A. Patel (Floor) and J. Kim (Beam)',
      firstAction: 'Half-out only on Thursday for Patel — no full-twisting passes. Kim does beam-off-low, dance-and-acro only, no skill connections.',
      secondaryThread: 'Separate thing — Friday morning warm-up runs bars-only for both. They get back on floor and beam at the meet, fresh.',
    },
    dimensionState: {
      focus: 'watch',
      composure: 'watch',
      decisioning: 'solid',
    },
    watchlist: [
      {
        athleteName: 'A. Patel',
        role: 'Floor · All-Around',
        whyMatters: 'Landing load on floor has been 18% above her 4-week baseline across two practices. Stuck-landing rate dropped from 80% to 55% on Tuesday\'s full-out attempts. Recovery has been below her usual for three straight days. Body is starting to wear the full-out volume.',
        coachMove: 'Thursday floor — half-out only, no full-twisting passes. Friday morning warm-up bars-only. She gets back on floor at the meet, fresh.',
        confidenceTier: 'stable',
        evidenceRefs: ['landing load is past the comfortable range', 'stuck-landing rate dropping', 'recovery is below her usual'],
      },
      {
        athleteName: 'J. Kim',
        role: 'Beam · Specialist',
        whyMatters: 'Took a fall on her connection series Tuesday and has been quiet at beam stations since. Mood read tense in the post-practice check-in. Took two extra restart attempts on Wednesday\'s routine before connecting cleanly. This is perfectionism, not technique.',
        coachMove: 'Beam-off-low Thursday — dance-and-acro work only, no skill connections. Five-minute talk Thursday afternoon — about routine strategy, not technique. Friday warm-up bars-only.',
        confidenceTier: 'stable',
        evidenceRefs: ['fear blocks after a fall', 'perfectionism spiral', 'mood is off'],
      },
    ],
    coachActions: [
      { action: 'Half-out only — no full-twisting passes', appliesTo: 'A. Patel', session: 'Thursday floor block' },
      { action: 'Beam-off-low only — dance and acro, no skill connections', appliesTo: 'J. Kim', session: 'Thursday beam block' },
      { action: 'Bars-only Friday morning warm-up — fresh for floor and beam at the meet', appliesTo: 'Patel and Kim', session: 'Friday morning warm-up' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'A. Patel',
        lookFor: 'heavy on the first tumbling pass in warm-up or a stuck-landing miss in the open',
        ifThen: 'one cue — "drive through the floor." Skip technical add-ons. Don\'t reset the pass count if she misses — keep her in rhythm.',
      },
      {
        athleteOrUnit: 'J. Kim',
        lookFor: 'tense at the beam, long pause before mounting, or extra dip on the connection series',
        ifThen: 'walk to her at the corner. One cue — "your routine, your tempo." Skip the skill talk.',
      },
      {
        athleteOrUnit: 'team in the line-up',
        lookFor: 'meet-day nerves leaking — chatty in the warm-up corner or quiet on apparatus rotations',
        ifThen: 'no big speech. One cue — "your routine, your tempo." Captains run the rotations.',
      },
    ],
    teamSynthesis: 'This is a landing-load and beam-confidence week — coach the attempts and the routine, bars looks sharp.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  'bodybuilding-physique': {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Prep block — show in 6 weeks (Reyes), 2 weeks (Lopez)',
      competitionDate: 'Show day · staggered',
      teamName: 'Pulse Demo Coaching · Bodybuilding / Physique',
      ...SPORT_COLORS['bodybuilding-physique'],
      primarySportColor: SPORT_COLORS['bodybuilding-physique'].primary,
      primarySportColorSoft: SPORT_COLORS['bodybuilding-physique'].soft,
    },
    noteOpener: 'Quick read on the prep week — Reyes is hitting the deficit harder than the plan calls for and Lopez is two weeks out and cardio-fatigued.',
    topLine: {
      whatChanged: 'Reyes\'s daily steps are climbing past prescribed and his fasted weight is dropping faster than the prep curve. Lopez at 2 weeks out is on plan but the cardio fatigue is showing.',
      who: 'M. Reyes (6 weeks out) and C. Lopez (2 weeks out)',
      firstAction: 'Pull Reyes\'s daily step target back by 2,000 — he\'s ahead of the curve, not behind. Lopez to walking-only cardio Wednesday and Thursday.',
      secondaryThread: 'Separate thing — Lopez has been weighing in twice a day this week. Move morning weigh-in to once a day and skip the evening one. Scale anxiety is leaking into posing rehearsal.',
    },
    dimensionState: {
      focus: 'solid',
      composure: 'watch',
      decisioning: 'solid',
    },
    watchlist: [
      {
        athleteName: 'M. Reyes',
        role: 'Men\'s Physique · 6 Weeks Out',
        whyMatters: 'Daily steps are 2,400 above prescribed across the last four days. Fasted weight has dropped 0.8 lb past the planned curve — too fast at this stage. Sleep was thin two of the last three nights. He\'s pushing harder than the plan, which means peak week needs more room than we have.',
        coachMove: 'Reduce step target by 2,000/day. Hold cardio at prescribed minutes — do not add. Sleep target conversation Wednesday. Recheck weight Saturday morning.',
        confidenceTier: 'stable',
        evidenceRefs: ['prep volume is on track', 'fueling has been light', 'sleep was thin'],
      },
      {
        athleteName: 'C. Lopez',
        role: 'Classic Physique · 2 Weeks Out',
        whyMatters: 'On plan for cardio minutes but the fatigue is real — HR-zone integration on her morning fasted cardio climbed 12% across the week. She\'s been weighing in twice a day, scale anxiety leaking into posing rehearsal. Mood read tense in Tuesday\'s session.',
        coachMove: 'Walking-only cardio Wednesday and Thursday — no incline. One scale check per day, morning. Friday evening posing rehearsal in show-day clothes to anchor the routine.',
        confidenceTier: 'stable',
        evidenceRefs: ['scale volatility', 'peak-week anxiety', 'mood is off'],
      },
    ],
    coachActions: [
      { action: 'Reduce daily step target by 2,000 — hold cardio at prescribed minutes', appliesTo: 'M. Reyes', session: 'Daily — through Saturday' },
      { action: 'Walking-only cardio (no incline) + one scale check per day', appliesTo: 'C. Lopez', session: 'Wednesday — Thursday' },
      { action: 'Posing rehearsal in show-day clothes', appliesTo: 'C. Lopez', session: 'Friday evening' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'M. Reyes',
        lookFor: 'low energy at the morning cardio session or skipping his pre-cardio meal',
        ifThen: 'one cue — "fuel first." Move the cardio session 30 minutes later if needed. Don\'t add intervals.',
      },
      {
        athleteOrUnit: 'C. Lopez',
        lookFor: 'scale-anxiety leaking into the posing rehearsal — quiet, rushed, or skipping mandatory poses',
        ifThen: 'no scale talk in the rehearsal room. One cue — "your routine, your shape." Skip the macro check until after.',
      },
      {
        athleteOrUnit: 'whole prep group',
        lookFor: 'posing form slipping under late-prep fatigue — tight shoulders, rushed transitions',
        ifThen: 'short rehearsals, more often. 15 minutes twice a day beats one 45-minute block when the deficit is deep.',
      },
    ],
    teamSynthesis: 'This is a prep-pace week — coach the deficit and the recovery, posing is on schedule.',
    closer: 'We\'ll send the next one Sunday morning. Reply with questions — we read every one.',
  },
  other: {
    meta: {
      weekLabel: 'Week of Apr 21 — Apr 27, 2026',
      opponentOrEvent: 'Newly added sport — first 4 weeks of data',
      competitionDate: 'Coach to flag any week with competition',
      teamName: 'Pulse Demo Coaching · New Sport',
      ...SPORT_COLORS.other,
      primarySportColor: SPORT_COLORS.other.primary,
      primarySportColorSoft: SPORT_COLORS.other.soft,
    },
    noteOpener: 'Quick note — we\'re still baselining this sport. Read this week lighter than usual; the system is learning what "high" looks like for your athletes.',
    topLine: {
      whatChanged: 'Three weeks of data on the team. Participation and protocol completion are above 70%, which is the bar for a usable read. Strong athlete-specific claims are held back until we have four full weeks.',
      who: 'whole team',
      firstAction: 'Keep the routine. Athletes who are wearing the wearable consistently this week will give us the read we need next Sunday.',
      secondaryThread: 'If a particular athlete is competing this week, drop a note in the coach channel. We\'ll lean the read toward that athlete\'s session record even with thin baselines.',
    },
    dimensionState: {
      focus: 'thin_evidence',
      composure: 'thin_evidence',
      decisioning: 'thin_evidence',
    },
    watchlist: [],
    coachActions: [
      { action: 'Continue the standard wearable + protocol routine — coverage is the goal this week', appliesTo: 'whole team', session: 'all week' },
      { action: 'Flag any in-week competition in the coach channel so we can pull session-level reads', appliesTo: 'coaching staff', session: 'as needed' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'wearable coverage',
        lookFor: 'athletes who fall below 70% wear-rate this week',
        ifThen: 'one short conversation — about what\'s breaking the routine, not the data. The first four weeks of coverage decide what the rest of the season can read.',
      },
    ],
    teamSynthesis: 'Still baselining — read this week\'s note lighter than usual. Strong claims are held back until participation hits a stable four-week window.',
    closer: 'We\'ll send the next one Sunday morning. By then we\'ll have a full four weeks and the read will tighten. Reply with questions — we read every one.',
  },
};
