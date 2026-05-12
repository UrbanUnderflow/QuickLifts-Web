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
    noteOpener: 'Quick read before Wednesday\'s game at Riverside — two of your guards are showing a recovery-and-check-in pattern worth watching.',
    topLine: {
      whatChanged: 'Johnson and Davis both show below-baseline recovery, and their Nora check-ins point to decision fatigue before Wednesday\'s game at Riverside.',
      who: 'M. Johnson and T. Davis (point guards)',
      firstAction: 'Review Tuesday\'s repeat-sprint exposure with staff. When the game gets late in the shot clock and the guards are tired or mentally cluttered, don\'t give them a bunch of coaching points. Give them one simple phrase they can use in that moment.',
      secondaryThread: 'Separate thing — Davis reported role uncertainty in the last two check-ins. Worth a 5-minute one-on-one before Friday\'s shootaround. Make it about role, not film.',
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
        whyMatters: 'Polar recovery has been below his usual for four straight days. In Nora\'s check-in, he described late-practice decisions as slower when fatigue shows up.',
        coachMove: 'Review Tuesday\'s repeat-sprint exposure with staff. If Johnson looks tired or mentally cluttered late in the shot clock, keep the message simple and give him one phrase he can use right then.',
        confidenceTier: 'stable',
        evidenceRefs: ['Polar recovery is below his usual', 'Nora check-in: decisions feel slower under fatigue'],
      },
      {
        athleteName: 'T. Davis',
        role: 'Point Guard',
        whyMatters: 'Davis used lower-confidence language in the last two Nora check-ins and named role clarity as the thing he needs before the next game. Nothing dramatic; the pattern is there.',
        coachMove: 'Five-minute check-in before Friday\'s shootaround. Make it about role, not film.',
        confidenceTier: 'stable',
        evidenceRefs: ['Nora check-in: confidence language dipped', 'athlete-reported role uncertainty'],
      },
    ],
    coachActions: [
      { action: 'If Johnson or Davis looks tired or mentally cluttered late in the shot clock, give one simple phrase instead of multiple corrections', appliesTo: 'Johnson and Davis', session: 'Tuesday repeat-sprint block' },
      { action: 'In walkthrough, practice the exact phrase guards should use when a possession feels rushed', appliesTo: 'starters and first-off-bench', session: 'Wednesday walkthrough' },
      { action: 'Five-minute one-on-one about role expectations', appliesTo: 'T. Davis', session: 'Friday shootaround' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'M. Johnson',
        lookFor: 'flat or quiet during pre-game warm-ups',
        ifThen: 'ask one short question about energy, then give him the same simple phrase before tip. Staff owns any warm-up or play-call adjustment.',
      },
      {
        athleteOrUnit: 'rotation guards',
        lookFor: 'late-clock reads slowing under second-half fatigue',
        ifThen: 'tell them to breathe, scan, and start the action early instead of waiting until the clock gets tight. Staff owns any possession-structure adjustment.',
      },
      {
        athleteOrUnit: 'whole team',
        lookFor: 'a quick opponent run flipping body language on the bench',
        ifThen: 'at the timeout, keep it to one plain phrase: "next possession." Don\'t pile on coaching.',
      },
    ],
    teamSynthesis: 'This is a back-to-back recovery week. The physical pattern tells us late-clock composure may be harder, so keep the coaching message simple in that moment while staff owns the physical plan.',
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
    noteOpener: 'Quick read before Friday\'s qualifier at Pinehurst — the check-ins point to back-nine response and routine, not swing reconstruction.',
    topLine: {
      whatChanged: 'Holloway\'s Nora check-ins show bad-shot carryover into the next-hole routine. Castillo had two short sleep nights and reported feeling rushed late in the round.',
      who: 'B. Holloway and J. Castillo',
      firstAction: 'On Thursday, if Holloway carries a bad shot into the next tee box, do not turn it into swing talk. Give him one simple routine: pick the target, take one breath, and commit to the shot.',
      secondaryThread: 'Separate thing — Castillo slept poorly the two nights before Tuesday and described his late-round routine as rushed. Review his tee-time routine and fueling plan with staff before Friday.',
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
        whyMatters: 'In the post-round Nora check-in, Holloway said one bad shot was carrying into the next tee routine. Mood language was quieter than his usual. This read stays in the response layer, not the swing layer.',
        coachMove: 'On Thursday, if he carries a bad shot into the next tee box, do not talk swing mechanics. Put a pre-shot routine card on the bag for Friday: pick the target, take one breath, and commit to the shot.',
        confidenceTier: 'stable',
        evidenceRefs: ['Nora post-round check-in: bad-shot carryover', 'response after mistakes is shaky'],
      },
      {
        athleteName: 'J. Castillo',
        role: 'Tournament starter',
        whyMatters: 'Polar showed two short sleep nights before Tuesday, and Castillo described his late-round routine as rushed in the Nora check-in. That is enough to coach routine and composure without pretending Nora has swing data.',
        coachMove: 'Review his tee-time routine and fueling rhythm with staff. If he looks rushed late in the round, give him the same simple routine: pick the target, take one breath, and commit to the shot.',
        confidenceTier: 'stable',
        evidenceRefs: ['Polar sleep was off', 'Nora check-in: late-round routine felt rushed'],
      },
    ],
    coachActions: [
      { action: 'If Holloway carries one bad shot into the next hole, use the routine card: pick the target, take one breath, and commit to the shot', appliesTo: 'B. Holloway', session: 'Thursday short-game session' },
      { action: 'Review tee-time routine and fueling rhythm with staff', appliesTo: 'J. Castillo', session: 'Friday qualifying round' },
      { action: 'Keep feedback out of mechanics unless staff chooses otherwise', appliesTo: 'Holloway and Castillo', session: 'this week' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'B. Holloway',
        lookFor: 'a tight or rushed routine on the first two tee shots',
        ifThen: 'walk to him before hole 3 and keep it simple: pick the target, take one breath, and commit to this shot.',
      },
      {
        athleteOrUnit: 'J. Castillo',
        lookFor: 'thirsty or slow tempo by hole 12',
        ifThen: 'ask staff to check the fueling and water plan; keep the coach message to the same routine: pick the target, take one breath, and commit.',
      },
      {
        athleteOrUnit: 'whole team',
        lookFor: 'wind picking up after lunch (forecast says 12-15 mph by 1pm)',
        ifThen: 'keep the message short: staff chooses the play plan, and the athlete commits to the shot in front of him.',
      },
    ],
    teamSynthesis: 'This is an acceptance-and-routine week — routine and response are the layers to coach while staff owns swing decisions.',
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
    noteOpener: 'Quick read going into Day 2 of the conference tournament — post-block check-ins point to grip tension and spare-routine confidence.',
    topLine: {
      whatChanged: 'Ramos reported grip tension and lower shot-repeat confidence late in Block 2. Phillips\'s post-block check-in showed spare-routine confidence dipping after Day 1.',
      who: 'A. Ramos (Anchor) and J. Phillips (Lead)',
      firstAction: 'Review warm-up volume with staff. When the lane starts changing and Ramos wants to adjust everything, ask him to change one thing at a time so he can stay patient and repeatable.',
      secondaryThread: 'Separate thing — keep the spare-process language identical to last week for Phillips. Don\'t add anything new at the tournament — the routine is what closes spares, not new mechanics.',
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
        whyMatters: 'In Nora\'s post-block check-in, Ramos reported grip tension by the late frames and lower confidence repeating the same shot. That points to transition discipline, not a mechanical rebuild.',
        coachMove: 'Review warm-up volume with staff. When the lane starts changing and Ramos wants to adjust everything, ask him to change one thing at a time so he can stay patient and repeatable.',
        confidenceTier: 'stable',
        evidenceRefs: ['Nora post-block check-in: grip tension', 'shot-repeat confidence dipped'],
      },
      {
        athleteName: 'J. Phillips',
        role: 'Leadoff',
        whyMatters: 'Phillips\'s post-block check-in showed lower confidence in the spare routine and a more negative mood tone than usual. Day 2 fatigue, not technique.',
        coachMove: 'Keep the spare-process language identical to last week. Between blocks, say the same words every time so Phillips does not start searching for a new routine mid-tournament.',
        confidenceTier: 'stable',
        evidenceRefs: ['Nora post-block check-in: spare-routine confidence dipped', 'mood tone lower than usual'],
      },
    ],
    coachActions: [
      { action: 'Review warm-up volume with staff; when lane transition starts, remind Ramos to change one thing at a time', appliesTo: 'A. Ramos and J. Phillips', session: 'Saturday Block 2 warm-up' },
      { action: 'If Ramos wants to move target and ball at the same time, slow the decision down and ask for one adjustment only', appliesTo: 'A. Ramos', session: 'Saturday Block 2' },
      { action: 'Review between-block reset and fueling rhythm with staff', appliesTo: 'team', session: 'Saturday between-block window' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'A. Ramos',
        lookFor: 'grip tight or shoulders rounding by frame 6',
        ifThen: 'between frames, keep it simple: "tempo, not power." Staff owns any break-period rep decision.',
      },
      {
        athleteOrUnit: 'J. Phillips',
        lookFor: 'an open frame followed by a rushed pre-shot',
        ifThen: 'say the same process words as last week: "same routine, same line." Do not turn it into mechanical talk.',
      },
      {
        athleteOrUnit: 'team',
        lookFor: 'lane transition at frame 5-6 of Block 2',
        ifThen: 'tell the athlete to change one thing at a time. Do not ask them to move target and ball in the same frame.',
      },
    ],
    teamSynthesis: 'This is a tournament-stamina week — repeatability and reset are the layers to coach while staff owns lane strategy.',
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
    noteOpener: 'Quick read going into Saturday\'s meet — Polar recovery and Nora check-ins point to meet-day arousal for the sprint group.',
    topLine: {
      whatChanged: 'Smith and Adams show below-baseline recovery and reported heavy legs in Nora check-ins before Saturday\'s meet at Westbrook University.',
      who: 'D. Smith and J. Adams (sprinters — 100/200)',
      firstAction: 'Review Tuesday\'s 4x200 and strength add-on with staff. If Smith says his legs feel flat before the 200, do not add a bunch of race thoughts. Give him one phrase for the start: drive for the first steps.',
      secondaryThread: 'Separate thing — Peters reported missing the pre-practice meal two days running. Review the fueling rhythm with staff and keep the athlete message concrete.',
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
        whyMatters: 'Polar recovery has been below his usual, and Smith used heavy-leg language in Nora\'s check-in. That is enough to coach meet-day arousal without pretending Nora owns the sprint plan.',
        coachMove: 'Review Tuesday\'s 4x200 and strength add-on with staff. If Smith says his legs feel flat before the 200, do not add a bunch of race thoughts. Give him one phrase for the start: drive for the first steps.',
        confidenceTier: 'stable',
        evidenceRefs: ['Polar recovery is below his usual', 'Nora check-in: heavy-leg language'],
      },
      {
        athleteName: 'A. Peters',
        role: 'Middle Distance — 800m',
        whyMatters: 'Peters reported missing the pre-practice meal two days running and named low energy as the concern before Saturday. Keep this concrete and non-shaming.',
        coachMove: 'Review the pre-meet fueling rhythm with staff. Keep the athlete-facing message concrete and non-shaming.',
        confidenceTier: 'stable',
        evidenceRefs: ['Nora check-in: missed pre-practice meal', 'athlete-reported low-energy concern'],
      },
    ],
    coachActions: [
      { action: 'Review 4x200 and strength add-on with staff; if a sprinter feels flat on meet day, give one start phrase instead of several race thoughts', appliesTo: 'D. Smith and J. Adams', session: 'Tuesday 4x200 session' },
      { action: 'Review fueling rhythm with staff; keep the athlete message concrete', appliesTo: 'A. Peters', session: 'Friday afternoon before meet' },
      { action: 'Use event-specific language and keep sprint and distance messages separate', appliesTo: 'sprinters and middle distance', session: 'Saturday meet warm-up' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'D. Smith',
        lookFor: 'self-reports flat legs in warm-up or gets quiet on the line',
        ifThen: 'give him one start phrase: "drive for the first steps." Staff owns any warm-up adjustment.',
      },
      {
        athleteOrUnit: 'A. Peters',
        lookFor: 'low-energy in warm-up or reports missing the morning meal',
        ifThen: 'ask staff to check the fueling plan; keep the race message steady and simple instead of adding new instructions.',
      },
      {
        athleteOrUnit: 'sprinters as a group',
        lookFor: 'tight shoulders during strides or chatty in the call room',
        ifThen: 'give each athlete one simple phrase for the line, such as "drive for the first steps" or "stand tall through the curve." Staff owns final technical or tactical details.',
      },
    ],
    teamSynthesis: 'This is a meet-day arousal and fueling-rhythm week. The physical pattern tells us some athletes may feel flat or over-wired before the race, so the coach message should be simple and event-specific while staff owns the physical plan.',
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
      firstAction: 'Review Diaz\'s Wednesday small-sided exposure with staff. Late in the half, if his choices slow down, keep the message simple: scan once, breathe, and choose the next pass.',
      secondaryThread: 'Separate thing — keeper communication with the back four has gotten quieter the last two matches. Use Thursday\'s set-piece context to practice the exact phrase Reyes and the back four should use early.',
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
        coachMove: 'Review the high-speed running pattern with staff for Wednesday and Saturday. Late in the half, if Diaz looks rushed on the ball, tell him to scan once, breathe, and choose the next pass.',
        confidenceTier: 'stable',
        evidenceRefs: ['high-speed running is climbing past recovery', 'recovery is below his usual', 'final-third reads slowing under fatigue'],
      },
      {
        athleteName: 'V. Reyes',
        role: 'Goalkeeper',
        whyMatters: 'Communication with the back four has gotten quieter on tape from the last two matches. Body language during long-ball clearances looks tense — late on the shout, half a step behind the cross. Nothing technical; this is voice and confidence.',
        coachMove: 'Use the set-piece context to practice the keeper-voice phrase: talk first, then play. Keep it confidence and communication, not technical correction.',
        confidenceTier: 'stable',
        evidenceRefs: ['goalkeeper confidence is shaky', 'response after mistakes is quiet'],
      },
    ],
    coachActions: [
      { action: 'Review small-sided exposure with staff; if Diaz rushes late-half choices, tell him to scan once, breathe, and choose the next pass', appliesTo: 'L. Diaz', session: 'Wednesday small-sided block' },
      { action: 'In set-piece work, ask Reyes to talk before the ball arrives so the back four hears him early', appliesTo: 'V. Reyes and back four', session: 'Thursday set-piece' },
      { action: 'Flag Diaz\'s physical pattern for staff review', appliesTo: 'L. Diaz', session: 'Saturday match' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'L. Diaz',
        lookFor: 'heavy first 15 minutes or short on second-ball duels',
        ifThen: 'tell him to scan once, breathe, and choose the next pass. Flag the physical pattern to staff; staff owns any substitution decision.',
      },
      {
        athleteOrUnit: 'V. Reyes',
        lookFor: 'quiet on the first three back-passes or slow to call out cross targets',
        ifThen: 'walk past the box at the next dead ball and say, "talk first, then play."',
      },
      {
        athleteOrUnit: 'midfield three',
        lookFor: 'late-half decisioning slipping under second-half pressure',
        ifThen: 'give one simple communication phrase and let staff own shape and pressing choices.',
      },
    ],
    teamSynthesis: 'This is a midfield-load and keeper-voice week. The physical pattern tells us decisioning and communication may get harder late, so the coach message should stay simple while staff owns the match plan.',
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
      firstAction: 'Review Wednesday\'s live-period exposure for the edge group with staff. If fatigue shows up late in the period, keep the message to one simple phrase about finishing the closeout before the next assignment.',
      secondaryThread: 'Separate thing — Carter (QB) put two short nights together this week and his late-period reads got tight on Tuesday\'s tape. Review the sleep context with staff before Friday, then keep his message to feet first on late-period reads.',
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
        coachMove: 'Review the contact-load pattern with staff for Wednesday\'s install. If Williams gets a step late when fatigue shows, give him one phrase about finishing the closeout before the next assignment.',
        confidenceTier: 'stable',
        evidenceRefs: ['contact load piling on the edge', 'recovery is below his usual', 'closeout discipline slipping under fatigue'],
      },
      {
        athleteName: 'K. Carter',
        role: 'Quarterback',
        whyMatters: 'Two short sleep nights this week and Tuesday\'s tape showed his late-period reads getting tight — held the ball half a beat longer on the second-team look. Nothing dramatic; the pattern is there.',
        coachMove: 'Review Carter\'s sleep context with staff before Friday. When reads tighten, keep the athlete-facing message to feet first, then eyes.',
        confidenceTier: 'stable',
        evidenceRefs: ['short sleep nights', 'reads slower under fatigue'],
      },
    ],
    coachActions: [
      { action: 'Review live-period exposure with staff; if the edge group looks a step late, give one closeout phrase before the next assignment', appliesTo: 'Williams and Brooks', session: 'Wednesday install' },
      { action: 'Review QB sleep context with staff; when reads tighten, say: feet first, then eyes', appliesTo: 'K. Carter', session: 'Friday install' },
      { action: 'Late in the period, if assignment slips show up, use one simple phrase before the next snap', appliesTo: 'first-team defense', session: 'Thursday seven-on-seven' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'M. Williams',
        lookFor: 'heavy off the bus or tight on the first set of pre-game rushes',
        ifThen: 'give him one phrase about finishing the closeout before the next snap and flag the physical pattern to staff; staff owns any series rotation decision.',
      },
      {
        athleteOrUnit: 'K. Carter',
        lookFor: 'jittery in pre-game scripts or rushing the cadence',
        ifThen: 'keep the message to "feet first" so he settles before the read. Staff owns the install and call sheet.',
      },
      {
        athleteOrUnit: 'first-team defense',
        lookFor: 'late-quarter assignment slips after a long offensive drive',
        ifThen: 'use one simple phrase to settle the assignment before the next snap and flag the rest pattern to staff; staff owns the call choice.',
      },
    ],
    teamSynthesis: 'This is a contact-recovery week with a quarterback-sleep overlay. The physical pattern tells us late-period closeouts and reads may get harder, so the coach message should be simple while staff owns the football plan.',
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
      firstAction: 'Review Reyes\'s arm-care window and catching load with staff before warm-ups. If he carries one pitch into the next, tell him: one pitch, one breath.',
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
        coachMove: 'Review the arm-care window with staff before Game 1. If Reyes starts carrying the last pitch into the next one, tell him: one pitch, one breath.',
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
      { action: 'Review Reyes arm-care window with staff; if he carries one pitch into the next, tell him: one pitch, one breath', appliesTo: 'A. Reyes', session: 'Saturday Game 1' },
      { action: 'Review catching workload with staff before the doubleheader', appliesTo: 'Vega and Park', session: 'Saturday doubleheader' },
      { action: 'Five-minute feel-focused hitting check-in (no film)', appliesTo: 'J. Hassan', session: 'Friday BP' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'A. Reyes',
        lookFor: 'velocity drops 1.5+ mph in the third inning or arm action shortens',
        ifThen: 'flag the pattern to staff and tell him: one pitch, one breath. Staff owns the pitching decision.',
      },
      {
        athleteOrUnit: 'catching pair',
        lookFor: 'tight throws back to the mound or slow blocks late in Game 1',
        ifThen: 'flag the catching-load pattern to staff; keep the athlete message simple: breathe, block, throw.',
      },
      {
        athleteOrUnit: 'top of the order',
        lookFor: 'late-zone takes increasing as the doubleheader runs long',
        ifThen: 'simplify the approach: "first strike, find your pitch." Don\'t pile on situational hitting points mid-game.',
      },
    ],
    teamSynthesis: 'This is a doubleheader-stamina week. The physical pattern tells us pitch-to-pitch focus and role stability may get harder, so the coach message should stay simple while staff owns rotation decisions.',
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
      firstAction: 'Review Sanchez\'s recovery window and catching load with staff before the opener. If she carries one pitch into the next, tell her: one pitch, one breath.',
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
        coachMove: 'Review the recovery window with staff before the opener. If Sanchez starts carrying the last pitch into the next one, tell her: one pitch, one breath.',
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
      { action: 'Review Sanchez recovery window with staff; if she carries one pitch into the next, tell her: one pitch, one breath', appliesTo: 'K. Sanchez', session: 'Friday opener' },
      { action: 'Review catching workload with staff before the tournament weekend', appliesTo: 'Park and Lopez', session: 'Friday — Sunday tournament' },
      { action: 'Five-minute feel-focused hitting check-in (no film)', appliesTo: 'A. Mendez', session: 'Thursday hitting' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'K. Sanchez',
        lookFor: 'rise-ball arm slot dropping a touch by the third inning, or velocity giving up 2 mph',
        ifThen: 'flag the pattern to staff and tell her: one pitch, one breath. Staff owns the pitching decision.',
      },
      {
        athleteOrUnit: 'catching pair',
        lookFor: 'tight pop times back to second or slow blocks late in Saturday\'s game',
        ifThen: 'flag the catching-load pattern to staff; keep the athlete message simple: breathe, block, throw.',
      },
      {
        athleteOrUnit: 'top of the order',
        lookFor: 'late-zone takes increasing as the weekend runs long',
        ifThen: 'keep the message simple: "first strike, find your pitch." Ask staff to check the tournament fueling rhythm.',
      },
    ],
    teamSynthesis: 'This is a tournament-stamina week. The physical pattern tells us pitch-to-pitch focus and role stability may get harder, so the coach message should stay simple while staff owns circle and catching decisions.',
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
      firstAction: 'Review Reyes\'s jump-load pattern with staff. If her approach looks rushed or heavy on Friday, give her one simple phrase: early eyes, clean breath.',
      secondaryThread: 'Separate thing — middle blocker timing on combo plays got a beat late on Tuesday\'s tape. Use Wednesday\'s set-piece context to practice the exact phrase the setter should say early.',
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
        coachMove: 'Review the jump-load pattern with staff for the week. If Reyes looks rushed or heavy on approach, give her one simple phrase: early eyes, clean breath.',
        confidenceTier: 'stable',
        evidenceRefs: ['jump count is climbing past the line', 'approach-jump intensity dropping', 'recovery is below her usual'],
      },
      {
        athleteName: 'C. Garcia',
        role: 'Libero',
        whyMatters: 'Defensive deflection count is high across the travel week and her first-dig timing slipped a half-step on Tuesday\'s tape. Travel days are stacking — she carries the floor.',
        coachMove: 'Review the defensive-volume pattern with staff. If Garcia is late to the first dig, give her one simple phrase: early step, calm platform.',
        confidenceTier: 'stable',
        evidenceRefs: ['defensive deflection count climbing', 'first-dig timing slipped', 'travel days stacking'],
      },
    ],
    coachActions: [
      { action: 'Review jump-load pattern with staff; if approach timing gets rushed, say: early eyes, clean breath', appliesTo: 'M. Reyes and outside hitters', session: 'Tuesday approach-jump block' },
      { action: 'In set-piece work, ask the setter to speak early so the middle blockers hear the play before timing slips', appliesTo: 'middle blockers and setter', session: 'Wednesday set-piece' },
      { action: 'Review defensive-volume pattern with staff; if the first dig is late, say: early step, calm platform', appliesTo: 'C. Garcia and back-row defenders', session: 'Wednesday defensive block' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'M. Reyes',
        lookFor: 'tight on the first three approach jumps in warm-up, or short on second-set explosive swings',
        ifThen: 'say: early eyes, clean breath. Flag the physical pattern to staff; staff owns any rotation decision.',
      },
      {
        athleteOrUnit: 'middle blockers',
        lookFor: 'late-set timing slipping on combo plays — half a beat behind the quick',
        ifThen: 'ask the setter to speak early and let staff own the block scheme.',
      },
      {
        athleteOrUnit: 'C. Garcia',
        lookFor: 'slow on the first dig of each set or stretching to recover floor balls',
        ifThen: 'say: "early step." Staff owns coverage talk.',
      },
    ],
    teamSynthesis: 'This is a jump-load and defensive-floor week. The physical pattern tells us approach timing and floor reactions may get harder, so the coach message should stay simple while staff owns rotation choices.',
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
      firstAction: 'Review Forrester\'s match-duration and heat context with staff. If she rushes between points, tell her: breathe, then play the next ball.',
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
        coachMove: 'Review the match-duration and heat context with staff. If Forrester rushes between points, tell her: breathe, then play the next ball.',
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
      { action: 'Review match-duration context with staff; if Forrester rushes between points, tell her: breathe, then play the next ball', appliesTo: 'L. Forrester', session: 'Friday hitting' },
      { action: 'Review heat and hydration context with staff', appliesTo: 'L. Forrester', session: 'Sunday singles' },
      { action: 'Five-minute breath-and-routine talk (no strokes)', appliesTo: 'J. Kim', session: 'Thursday afternoon' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'L. Forrester',
        lookFor: 'heavy on the first two service games or slow recovery between points',
        ifThen: 'ask staff to check the heat and hydration plan; keep the coach message to: breathe, then play the next ball.',
      },
      {
        athleteOrUnit: 'J. Kim',
        lookFor: 'rushed toss or skipping the bounce routine after a break of serve',
        ifThen: 'say: "breathe, then play the next ball." Staff owns strategy.',
      },
      {
        athleteOrUnit: 'whole team',
        lookFor: 'afternoon heat picking up by 1pm Sunday — forecast is 92° on the courts',
        ifThen: 'ask staff to review heat, hydration, and warm-up timing; keep the coach message short and repeatable.',
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
      firstAction: 'Review Allen and Jenkins\'s meet-week load with staff. If they look tight before the race, keep the message race-simple and confidence-led.',
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
        coachMove: 'Review the recovery pattern with staff for Tuesday. If Allen looks heavy before the 500, tell him to swim the first 200 at his tempo and not chase splits early.',
        confidenceTier: 'stable',
        evidenceRefs: ['recovery is below his usual', 'the back-half of the volume block is showing', 'sleep was thin'],
      },
      {
        athleteName: 'C. Jenkins',
        role: 'Sprint · 50 / 100',
        whyMatters: 'Race-pace work has come up flat across two sessions — first 25 split slower than baseline both times. Body language tight on the blocks; mood quiet on the deck. Taper-nerves rather than physical decay.',
        coachMove: 'Review the race-pace pattern with staff for meet week. Use a five-minute talk about feeling the first stroke instead of talking about the time.',
        confidenceTier: 'stable',
        evidenceRefs: ['race-pace coming up flat', 'mood is off', 'taper nerves'],
      },
    ],
    coachActions: [
      { action: 'Review distance load with staff; if Allen looks heavy before the 500, say: first 200, your tempo', appliesTo: 'T. Allen', session: 'Tuesday distance block' },
      { action: 'Review race-pace context with staff; if Jenkins looks tight, say: first stroke, your stroke', appliesTo: 'C. Jenkins', session: 'Thursday morning' },
      { action: 'Short pre-meet meeting anchored on race plan (not splits)', appliesTo: 'relay group', session: 'Friday afternoon' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'T. Allen',
        lookFor: 'heavy in warm-up or quiet at the wall before the 500',
        ifThen: 'say: "first 200, your tempo." Don\'t mention splits in the warm-up walk.',
      },
      {
        athleteOrUnit: 'C. Jenkins',
        lookFor: 'tight on the first 50 of warm-up or rushing to the blocks',
        ifThen: 'walk him to the wall before the call and say: "first stroke, your stroke." Staff owns tactical add-ons.',
      },
      {
        athleteOrUnit: 'relay group',
        lookFor: 'second-guessing exchanges or stretching too far on the start',
        ifThen: 'give each relay leg one simple word and keep it the same every time. Staff owns any marshal-area timing decision.',
      },
    ],
    teamSynthesis: 'This is a taper-and-race-readiness week. The physical pattern tells us tempo, first-stroke confidence, and relay composure may get harder, so the coach message should stay simple while staff owns the swim plan.',
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
      firstAction: 'Review Davis\'s weigh-in and live-go context with staff. If he looks low-energy before the match, keep the message simple: stance first, then shot.',
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
        coachMove: 'Review the cut and recovery pattern with staff for Wednesday and Friday. If Davis looks low-energy before the match, keep the message simple: stance first, then shot.',
        confidenceTier: 'stable',
        evidenceRefs: ['grip is tight going into the cut', 'mat time is piling on', 'recovery is below his usual'],
      },
      {
        athleteName: 'K. Holloway',
        role: '141-lb · Captain',
        whyMatters: 'Mat time has been high across two weeks since he took the captain spot. Quiet in the room the last few sessions — didn\'t lead the warm-up Tuesday or Wednesday. Response after his close loss last Saturday is still settling.',
        coachMove: 'Five-minute talk Thursday — about the captain role, not technique. Give him one visible leadership action the team can recognize.',
        confidenceTier: 'stable',
        evidenceRefs: ['mood is off', 'close-loss recovery is shaky'],
      },
    ],
    coachActions: [
      { action: 'Review live-go and cut context with staff; if Davis looks low-energy, say: stance first, then shot', appliesTo: 'M. Davis', session: 'Wednesday live-go block' },
      { action: 'Five-minute captain-role talk plus one visible leadership action', appliesTo: 'K. Holloway', session: 'Thursday afternoon' },
      { action: 'Review cut-day fueling and water rhythm with staff', appliesTo: 'all weight-class starters', session: 'Friday morning weigh-in window' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'M. Davis',
        lookFor: 'low energy in warm-up, quiet between matches, or slow on the first stance reset',
        ifThen: 'say: "stance first, then shot." Ask staff to check between-match fueling and water.',
      },
      {
        athleteOrUnit: 'K. Holloway',
        lookFor: 'tight in stance during warm-up or short on hand-fight reps',
        ifThen: 'at the corner, say: "hands first." Staff owns technique.',
      },
      {
        athleteOrUnit: 'team in the warm-up tunnel',
        lookFor: 'chatty, looking around, or quiet bench during the early matches',
        ifThen: 'no big speech. Say: "next match, your match." Captains run the room.',
      },
    ],
    teamSynthesis: 'This is a weigh-in and mat-fatigue week. The physical pattern tells us stance, leadership, and composure may get harder, so the coach message should stay simple while staff owns weight-management and mat workload decisions.',
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
      firstAction: 'Review Reyes and Park\'s qualifier load with staff. If leaderboard pressure shows up, keep the message on what they can control in the next workout, not the score.',
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
        coachMove: 'Review the grip pattern with staff for qualifier planning. If Reyes starts rushing transitions because her hands feel taxed, tell her: smooth hands, calm transitions.',
        confidenceTier: 'stable',
        evidenceRefs: ['grip is going into the qualifier hot', 'recovery is below her usual', 'gymnastics volume climbing'],
      },
      {
        athleteName: 'C. Park',
        role: 'Open Athlete · Top Quartile',
        whyMatters: 'Two weeks of double sessions are showing — monostructural pace dropped 6% on Tuesday\'s rower benchmark vs. his 4-week baseline. Sleep efficiency has been thin and his mood read quieter on the deck.',
        coachMove: 'Review the density and sleep pattern with staff through Sunday. If Park starts chasing the leaderboard, tell him: your pace, not the leaderboard.',
        confidenceTier: 'stable',
        evidenceRefs: ['density block is catching up', 'monostructural pace dropping', 'mood is off'],
      },
    ],
    coachActions: [
      { action: 'Review grip-load context with staff; if Reyes rushes transitions, say: smooth hands, calm transitions', appliesTo: 'M. Reyes', session: 'Wednesday gymnastics block' },
      { action: 'Review density and sleep context with staff; if Park chases the leaderboard, say: your pace, not the leaderboard', appliesTo: 'C. Park', session: 'Wednesday — Sunday' },
      { action: 'Short pre-workout meeting anchored on the workout (not standings)', appliesTo: 'all qualifier athletes', session: 'Friday afternoon' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'M. Reyes',
        lookFor: 'grip giving way during the rig segment — tape rolling or hands shaking out between sets',
        ifThen: 'say: "smooth hands, calm transitions." Flag the grip pattern to staff; staff owns workout-management decisions.',
      },
      {
        athleteOrUnit: 'C. Park',
        lookFor: 'pace dropping in the second half of the metcon — slow on the rower or tight on the run',
        ifThen: 'reset breathing at the next transition and say: "your pace, not the leader\'s pace." Don\'t coach mid-station.',
      },
      {
        athleteOrUnit: 'whole team',
        lookFor: 'leaderboard pressure leaking into warm-up or athletes refreshing standings between sessions',
        ifThen: 'say: "your workout." Staff owns the competition-room rules.',
      },
    ],
    teamSynthesis: 'This is a grip-and-pace week. The physical pattern tells us limiter awareness, attention, and pacing may get harder, so the coach message should stay simple while staff owns workout management.',
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
      firstAction: 'Review Sanders\'s Wednesday small-sided exposure with staff. Late in the half, if clearing choices slow down, tell him to get his eyes up and choose the safe first outlet.',
      secondaryThread: 'Separate thing — Reyes\'s communication on clears has gotten quiet on the last two tapes. Use Thursday\'s ride-and-clear context to practice the exact phrase the goalie should use early.',
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
        coachMove: 'Review the two-way sprint pattern with staff for Wednesday and Saturday. Late in the half, if Sanders rushes a clearing choice, tell him to get his eyes up and choose the safe first outlet.',
        confidenceTier: 'stable',
        evidenceRefs: ['two-way sprint demand is climbing', 'recovery is below his usual', 'clearing decisions slowing'],
      },
      {
        athleteName: 'V. Reyes',
        role: 'Goalie',
        whyMatters: 'Communication on clears has gotten quiet on the last two tapes — late on the call, half a step behind the slide. Mood read quieter in the post-practice check-ins. This is voice and confidence, not save percentage.',
        coachMove: 'Use the ride-and-clear context to practice the goalie-voice phrase: talk first, then clear. Keep it confidence and communication, not save percentage.',
        confidenceTier: 'stable',
        evidenceRefs: ['goalie confidence is shaky', 'communication on clears is quiet'],
      },
    ],
    coachActions: [
      { action: 'Review small-sided exposure with staff; if Sanders rushes a late-half clear, tell him to get his eyes up and choose the safe first outlet', appliesTo: 'L. Sanders', session: 'Wednesday small-sided block' },
      { action: 'In ride-and-clear work, ask Reyes to talk before the clear so defenders hear him early', appliesTo: 'V. Reyes and defensive midfielders', session: 'Thursday ride-and-clear block' },
      { action: 'Flag Sanders\' physical pattern for staff review', appliesTo: 'L. Sanders', session: 'Saturday match' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'L. Sanders',
        lookFor: 'heavy first 10 minutes or short on the second-ball ground-balls',
        ifThen: 'tell him to get his eyes up and choose the safe first outlet. Flag the physical pattern to staff; staff owns any midfield rotation decision.',
      },
      {
        athleteOrUnit: 'V. Reyes',
        lookFor: 'quiet on the first three save-and-clear sequences',
        ifThen: 'walk past the cage at the next dead ball and say: "talk first, then clear."',
      },
      {
        athleteOrUnit: 'midfield as a unit',
        lookFor: 'late-half clearing decisions slowing under second-half pressure',
        ifThen: 'use one simple communication phrase and let staff own the clearing shape.',
      },
    ],
    teamSynthesis: 'This is a two-way midfield and goalie-voice week. The physical pattern tells us late-half clears may get rushed, so the coach message should be simple while staff owns the lacrosse plan.',
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
      firstAction: 'Review Cooper\'s shift pattern and Davis\'s contact load with staff. If they look rushed early in a shift, keep the message tied to puck decisions and first-shift composure.',
      secondaryThread: 'Separate thing — Saturday is a 7pm faceoff after Friday\'s late game. Review skate timing and travel meal rhythm with staff before the back-to-back.',
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
        coachMove: 'Review the shift pattern with staff for the back-to-back. If Cooper holds the puck too long late in a shift, tell him to take the ice first, then move it.',
        confidenceTier: 'stable',
        evidenceRefs: ['shift length is creeping up', 'recovery is below his usual', 'puck decisions slowing under fatigue'],
      },
      {
        athleteName: 'M. Davis',
        role: 'Defenseman · Top Pair',
        whyMatters: 'Took 14 hits in last Saturday\'s game and contact load has barely settled — accelerometer impact integration is still 15% above his weekly average four days later. Tight in his own zone on Tuesday\'s drills.',
        coachMove: 'Review the contact-load pattern with staff for Wednesday and Friday. If Davis looks tight on the first shift, tell him to angle early and breathe before contact.',
        confidenceTier: 'stable',
        evidenceRefs: ['contact accumulation is showing', 'recovery is below his usual'],
      },
    ],
    coachActions: [
      { action: 'Review shift pattern with staff; if Cooper holds the puck too long, say: take ice first, then move it', appliesTo: 'J. Cooper', session: 'Friday game' },
      { action: 'Review contact-load pattern with staff; if Davis looks tight, say: angle early and breathe before contact', appliesTo: 'M. Davis', session: 'Wednesday contact session' },
      { action: 'Review skate timing and travel meal rhythm with staff', appliesTo: 'whole team', session: 'Saturday game day' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'J. Cooper',
        lookFor: 'short on first shift or chasing the puck instead of taking ice',
        ifThen: 'tell him to take the ice first, then move the puck. Flag the shift pattern to staff; staff owns line and shift decisions.',
      },
      {
        athleteOrUnit: 'M. Davis',
        lookFor: 'tight in his own zone first period, slow to angle, or backing off contact',
        ifThen: 'tell him to angle early and breathe before contact. Flag the contact-load pattern to staff; staff owns pairings and special-teams decisions.',
      },
      {
        athleteOrUnit: 'top six in the third period',
        lookFor: 'late-game B2B fatigue — short shifts but slow back-checks',
        ifThen: 'use one simple bench phrase to settle his attention before he jumps back in and let staff own line changes and matchup decisions.',
      },
    ],
    teamSynthesis: 'This is a back-to-back stamina week. The physical pattern tells us puck decisions and first shifts may get rushed, so the coach message should stay simple while staff owns hockey decisions.',
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
      firstAction: 'Review Patel\'s landing load and Kim\'s beam confidence with staff. If meet-day nerves show up, keep the message tied to rhythm and routine ownership.',
      secondaryThread: 'Separate thing — Friday morning warm-up context matters for both. Review apparatus exposure with staff while Nora keeps the athlete message on routine tempo.',
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
        coachMove: 'Review the landing-load pattern with staff for Thursday and Friday. If Patel looks heavy on the first tumbling pass, tell her to drive through the floor, then breathe.',
        confidenceTier: 'stable',
        evidenceRefs: ['landing load is past the comfortable range', 'stuck-landing rate dropping', 'recovery is below her usual'],
      },
      {
        athleteName: 'J. Kim',
        role: 'Beam · Specialist',
        whyMatters: 'Took a fall on her connection series Tuesday and has been quiet at beam stations since. Mood read tense in the post-practice check-in. Took two extra restart attempts on Wednesday\'s routine before connecting cleanly. This is perfectionism, not technique.',
        coachMove: 'Review the beam-confidence pattern with staff for Thursday and Friday. Use a five-minute talk Thursday afternoon about owning the routine, not fixing technique.',
        confidenceTier: 'stable',
        evidenceRefs: ['fear blocks after a fall', 'perfectionism spiral', 'mood is off'],
      },
    ],
    coachActions: [
      { action: 'Review landing-load pattern with staff; if Patel looks heavy on the first pass, say: drive through the floor', appliesTo: 'A. Patel', session: 'Thursday floor block' },
      { action: 'Review beam-confidence pattern with staff; if Kim pauses before mounting, say: your routine, your tempo', appliesTo: 'J. Kim', session: 'Thursday beam block' },
      { action: 'Review apparatus exposure with staff; reinforce routine tempo', appliesTo: 'Patel and Kim', session: 'Friday morning warm-up' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'A. Patel',
        lookFor: 'heavy on the first tumbling pass in warm-up or a stuck-landing miss in the open',
        ifThen: 'say: "drive through the floor." Staff owns pass-count decisions.',
      },
      {
        athleteOrUnit: 'J. Kim',
        lookFor: 'tense at the beam, long pause before mounting, or extra dip on the connection series',
        ifThen: 'walk to her at the corner and say: "your routine, your tempo." Staff owns the skill talk.',
      },
      {
        athleteOrUnit: 'team in the line-up',
        lookFor: 'meet-day nerves leaking — chatty in the warm-up corner or quiet on apparatus rotations',
        ifThen: 'no big speech. Say: "your routine, your tempo." Captains run the rotations.',
      },
    ],
    teamSynthesis: 'This is a landing-load and beam-confidence week. The physical pattern tells us rhythm, routine ownership, and composure may get harder, so the coach message should stay simple while staff owns apparatus decisions.',
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
    noteOpener: 'Quick read on the prep week — Reyes is pushing harder than staff expected and Lopez is two weeks out with fatigue showing in the cardio context.',
    topLine: {
      whatChanged: 'Reyes\'s daily steps are climbing past prescribed and his fasted weight is dropping faster than the prep curve. Lopez at 2 weeks out is aligned with staff targets and fatigue is showing in the cardio context.',
      who: 'M. Reyes (6 weeks out) and C. Lopez (2 weeks out)',
      firstAction: 'Review Reyes\'s prep-pace and Lopez\'s cardio-fatigue pattern with staff. If anxiety shows up, keep the message on plan trust and routine ownership.',
      secondaryThread: 'Separate thing — Lopez has been weighing in twice a day this week. Review scale-check rhythm with staff; scale anxiety is leaking into posing rehearsal.',
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
        coachMove: 'Review the prep-pace pattern with staff for the week. If Reyes wants to push harder than staff expected, tell him to trust the staff plan and handle the next controllable action.',
        confidenceTier: 'stable',
        evidenceRefs: ['prep volume is on track', 'fueling has been light', 'sleep was thin'],
      },
      {
        athleteName: 'C. Lopez',
        role: 'Classic Physique · 2 Weeks Out',
        whyMatters: 'Staff targets are being met for cardio minutes, but the fatigue is real — HR-zone integration on her morning fasted cardio climbed 12% across the week. She\'s been weighing in twice a day, scale anxiety leaking into posing rehearsal. Mood read tense in Tuesday\'s session.',
        coachMove: 'Review the cardio-fatigue and scale-anxiety pattern with staff. If scale anxiety shows up in posing rehearsal, tell Lopez: your routine, your shape.',
        confidenceTier: 'stable',
        evidenceRefs: ['scale volatility', 'peak-week anxiety', 'mood is off'],
      },
    ],
    coachActions: [
      { action: 'Review prep-pace pattern with staff; if Reyes wants to push harder than staff expected, say: trust the staff plan and handle the next controllable action', appliesTo: 'M. Reyes', session: 'Daily — through Saturday' },
      { action: 'Review cardio-fatigue and scale-check rhythm with staff', appliesTo: 'C. Lopez', session: 'Wednesday — Thursday' },
      { action: 'Posing rehearsal in show-day clothes', appliesTo: 'C. Lopez', session: 'Friday evening' },
    ],
    gameDayLookFors: [
      {
        athleteOrUnit: 'M. Reyes',
        lookFor: 'low energy at the morning cardio session or skipping his pre-cardio meal',
        ifThen: 'say: "fuel first." Ask staff to review cardio timing and fueling before any physical-plan decision.',
      },
      {
        athleteOrUnit: 'C. Lopez',
        lookFor: 'scale-anxiety leaking into the posing rehearsal — quiet, rushed, or skipping mandatory poses',
        ifThen: 'no scale talk in the rehearsal room. Say: "your routine, your shape." Staff owns macro checks.',
      },
      {
        athleteOrUnit: 'whole prep group',
        lookFor: 'posing form slipping under late-prep fatigue — tight shoulders, rushed transitions',
        ifThen: 'use one simple posing-tempo phrase and flag the fatigue pattern to staff; staff owns rehearsal length.',
      },
    ],
    teamSynthesis: 'This is a prep-pace week. The physical pattern tells us plan trust, posing tempo, and composure may get harder, so the coach message should stay simple while staff owns nutrition and cardio decisions.',
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
      secondaryThread: 'If a particular athlete is competing this week, drop a note in the coach channel. We\'ll use that athlete\'s session record even with thin baselines.',
    },
    dimensionState: {
      focus: 'thin_evidence',
      composure: 'thin_evidence',
      decisioning: 'thin_evidence',
    },
    watchlist: [],
    coachActions: [
      { action: 'Continue the standard wearable + protocol routine — coverage is the goal this week', appliesTo: 'whole team', session: 'all week' },
      { action: 'Flag any in-week competition in the coach channel so we can use session-level reads', appliesTo: 'coaching staff', session: 'as needed' },
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
