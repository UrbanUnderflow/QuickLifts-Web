import React from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ClipboardList,
  FileText,
  Gauge,
  ListChecks,
  ShieldCheck,
} from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';
import {
  PulseCheckSportReportPolicy,
  composeReportTopLine,
  enforceCoachActionSpecificity,
  enforceNamedAthleteWatchlist,
  getDefaultPulseCheckSports,
} from '../../../api/firebase/pulsecheckSportConfig';
import {
  COACH_REPORT_DEMO_EXAMPLES,
  getSportColor,
} from '../../../api/firebase/pulsecheckSportReportDemos';


const DEFAULT_SPORT_POLICIES: Record<string, PulseCheckSportReportPolicy | undefined> = (() => {
  const map: Record<string, PulseCheckSportReportPolicy | undefined> = {};
  for (const sport of getDefaultPulseCheckSports()) {
    map[sport.id] = sport.reportPolicy;
  }
  return map;
})();

const dimensionMapFromPolicy = (sportId: string): string[] | undefined => {
  const policy = DEFAULT_SPORT_POLICIES[sportId];
  if (!policy) return undefined;
  const { focus, composure, decisioning } = policy.dimensionMap || { focus: [], composure: [], decisioning: [] };
  if (focus.length === 0 && composure.length === 0 && decisioning.length === 0) return undefined;
  return [
    focus.length > 0 ? `Focus: ${focus.join(', ')}.` : undefined,
    composure.length > 0 ? `Composure: ${composure.join(', ')}.` : undefined,
    decisioning.length > 0 ? `Decisioning: ${decisioning.join(', ')}.` : undefined,
  ].filter((entry): entry is string => Boolean(entry));
};

type SportMockReportBaseline = {
  id: string;
  name: string;
  emoji: string;
  roles: string;
  kpis: string[];
  weeklyFocus: string[];
  gameDayFocus: string[];
  watchSignals: string[];
  coachActions: string[];
  language: string;
  avoid: string[];
};

const REPORT_STRUCTURE = [
  ['Weekly Sports Intelligence Report', 'Coach', 'Team posture, sport-native KPI movement, cognitive trend, load/recovery trend, athlete watchlist candidates, reviewed training adjustments.', 'Human-reviewed during pilot.'],
  ['Game-Day Readiness Report', 'Coach', 'Athlete-by-athlete readiness band, confidence tier, key evidence, missing inputs, sport-specific pre-competition protocol, optional travel context.', 'Human-reviewed before delivery.'],
  ['Early-Warning Candidate', 'Internal review', 'Threshold trace, evidence refs, source confidence, escalation check, proposed coach-facing language.', 'Not automatically delivered during pilot.'],
];

const REPORT_ROW_SHAPE = [
  ['Header', 'Sport, team, report window, generatedAt, reviewStatus, reviewer, confidence summary.'],
  ['Data Coverage / Adherence', 'Device wear rate, Nora completion, protocol/sim completion, nutrition/check-in coverage, and read confidence. Weekly reports must show this before any watchlist or recommendation block.'],
  ['Team Lens', 'One paragraph: what changed, what matters this week, and where coaches should focus attention.'],
  ['Sport-Native KPIs', 'Only KPIs from sport config or verified team systems. Never raw vendor scores as coach judgment.'],
  ['Athlete Rows', 'Name, role/position, readiness band, confidence tier, evidence refs, missing inputs, recommendation, copy posture.'],
  ['Watchlist', 'Rare, reviewed list of athletes or role groups needing observation, not a punitive ranking.'],
  ['Coach Adjustment', 'Practice, recovery, communication, pre-competition, or nutrition-context action framed in sport language.'],
  ['Trace', 'Internal-only provenance: source lanes, stale/missing data, confidence propagation, threshold path.'],
];

const COACH_REPORT_SHAPE = [
  ['Top Line', 'One plain-English paragraph that tells the coach what changed, why it matters, and what to do first.'],
  ['Data Confidence', 'A small coverage block before any interpretation: device wear, Nora/check-in completion, protocol/sim completion, training/RPE coverage.'],
  ['Team Read', 'Coach-language interpretation of load, readiness, sentiment, and Focus / Composure / Decisioning movement.'],
  ['Watchlist', '2-4 reviewed athletes or role groups with "why this matters" and "coach move" language. No punitive ranking.'],
  ['This Week / Game-Day Actions', 'Short, practical actions the head coach can use in practice, walkthrough, pre-game, or post-game recovery.'],
  ['Do Not Overread', 'A small caveat that prevents raw score worship, clinical interpretation, or unsupported technical advice.'],
];

const REPORT_POLICY_SCHEMA_ROWS = [
  ['reportPolicyDefaults', 'Shared generator defaults for interpretation-in-the-report posture (the Coach Dashboard stays thin and links into the report), adherence/data coverage, confidence thresholds, aggregate sentiment, privacy, and clinical-boundary routing.'],
  ['contextModifiers', 'Sport-specific modifiers such as travel impact, schedule density, tee time, lane transition, block length, heat, wind, or minutes concentration.'],
  ['kpiRefs', 'References to metric keys already defined in `metrics[]`; no report generator should invent sport KPI names outside the config.'],
  ['weeklyRead / gameDayRead', 'Report lenses with `id`, `label`, `inputFamilies`, and linked Focus / Composure / Decisioning dimensions.'],
  ['watchlistSignals', 'Reviewed watch candidates with evidence families and dimension mapping. These do not automatically become alerts.'],
  ['coachActions', 'Allowed coach moves linked back to watch signals or report lenses.'],
  ['earlyWarningFamilies', 'Candidate alert families requiring high confidence and review before coach delivery.'],
  ['languagePosture', 'Coach-language summary, recommended terms, and must-avoid phrases mirrored into sport prompting policy.'],
  ['dimensionMap', 'Internal sport-native mapping back to Focus, Composure, and Decisioning.'],
];

const ADHERENCE_REQUIREMENTS = [
  ['Device coverage', 'Wearable/source coverage by athlete and team; stale or missing lanes lower confidence before interpretation.'],
  ['Nora completion', 'Daily check-in completion and sentiment coverage; low completion suppresses strong sentiment claims.'],
  ['Protocol / sim completion', 'Completion rate, simEvidenceCount, and recency for Focus / Composure / Decisioning movement.'],
  ['Training / nutrition coverage', 'FWP workout/session RPE coverage and Macra nutrition availability when fueling context is used.'],
  ['Coach-facing confidence', 'Simple visible confidence posture: strong read, usable read, thin read, or insufficient read.'],
];

const DEFAULT_DATA_POLICY = [
  'Biometric readiness from normalized health-context snapshots.',
  'Training load from FWP workoutSessions and session RPE.',
  'Cognitive movement from Focus / Composure / Decisioning evidence.',
  'Sentiment trend from aggregated Nora check-ins.',
  'Sport-native KPIs from sport config or verified team/stat systems.',
  'Schedule, competition, and travel context when available.',
];

const DEFAULT_MINIMUM_DATA = [
  'Show adherence/data coverage before recommendations.',
  'Suppress strong coach actions when the relevant evidence family is stale or missing.',
  'Use watch language when confidence is emerging or directional.',
  'Route clinical-threshold content away from Sports Intelligence copy.',
];

const CORE_DIMENSION_MAP: Record<string, string[]> = {
  basketball: ['Focus: defensive reads, free-throw routine, closeout discipline.', 'Composure: late-game reset, role/minutes volatility, response after turnovers.', 'Decisioning: ball-handler reads, spacing, late-clock choices under fatigue.'],
  soccer: ['Focus: scanning, first touch, set-piece assignment.', 'Composure: response after mistakes, goalkeeper confidence, pressure moments.', 'Decisioning: transition choices, pass selection under pressure, final-third reads.'],
  football: ['Focus: assignment clarity, pre-snap routine, position-room install.', 'Composure: next-play reset, arousal control, contact confidence.', 'Decisioning: quarterback/coverage reads, unit communication, play responsibility.'],
  baseball: ['Focus: pitch-to-pitch routine, plate approach, defensive readiness.', 'Composure: command anxiety, slump reset, response after errors.', 'Decisioning: pitch selection, swing/take approach, situational choices.'],
  softball: ['Focus: pitch-to-pitch routine, defensive reaction, dugout reset.', 'Composure: error carryover, tough at-bat recovery, tournament pressure.', 'Decisioning: pitch command, situational hitting, baserunning choices.'],
  volleyball: ['Focus: serve receive, rotation responsibility, setter attention.', 'Composure: point-to-point reset, communication after errors, pressure serving.', 'Decisioning: setter choice speed, defensive read, block/attack timing.'],
  tennis: ['Focus: between-point routine, serve target, pattern commitment.', 'Composure: momentum swings, break points, response after errors.', 'Decisioning: point construction, serve + 1 choice, doubles positioning.'],
  swimming: ['Focus: race plan, start/turn execution, split awareness.', 'Composure: race anxiety, taper nerves, response after poor heat/swim.', 'Decisioning: pacing choices, race-segment adjustment, relay exchange discipline.'],
  'track-field': ['Focus: event routine, approach rhythm, split awareness.', 'Composure: meet-day arousal, response after foul/miss, body-pressure containment.', 'Decisioning: warm-up timing, tactical pacing, jump/throw attempt selection.'],
  wrestling: ['Focus: stance, hand fighting, mat awareness.', 'Composure: match-by-match reset, weight-class pressure, close-loss recovery.', 'Decisioning: shot selection, escape timing, period strategy.'],
  crossfit: ['Focus: movement standards, transition discipline, pacing cues.', 'Composure: response when workouts hurt, failed rep recovery, leaderboard pressure.', 'Decisioning: event pacing, limiter management, skill vs strength tradeoff.'],
  golf: ['Focus: pre-shot routine, target clarity, putting process.', 'Composure: bad-shot recovery, qualifying pressure, late-round patience.', 'Decisioning: course management, club/target choice, risk selection in wind/heat.'],
  bowling: ['Focus: pre-shot routine, target line, spare process.', 'Composure: strike drought response, tournament day fatigue, carry variance.', 'Decisioning: lane transition reads, ball/surface choice, adjustment timing.'],
  lacrosse: ['Focus: stick skill under pressure, communication, ground-ball readiness.', 'Composure: turnover carryover, goalie confidence, contact response.', 'Decisioning: dodge/pass choices, defensive slides, clearing decisions.'],
  hockey: ['Focus: shift discipline, puck tracking, goalie visual routine.', 'Composure: bench reset, contact response, goalie confidence swings.', 'Decisioning: puck decisions under pressure, gap choice, shift-change timing.'],
  gymnastics: ['Focus: routine sequence, apparatus cue, landing attention.', 'Composure: fear blocks, meet-day nerves, perfectionism spiral.', 'Decisioning: skill readiness communication, routine progression, attempt selection.'],
  'bodybuilding-physique': ['Focus: prep execution, posing attention, food consistency.', 'Composure: scale volatility, peak-week anxiety, post-show rebound pressure.', 'Decisioning: controlled adjustments, coach-macro adherence, food variance choices.'],
  other: ['Focus: discipline-specific routine and attention demands.', 'Composure: pressure response and recovery after disruption.', 'Decisioning: sport-specific tactical or execution choices once context is known.'],
};

const SPORTS: SportMockReportBaseline[] = [
  {
    id: 'basketball',
    name: 'Basketball',
    emoji: '🏀',
    roles: 'Point Guard, Shooting Guard, Small Forward, Power Forward, Center',
    kpis: ['Minutes / Game', 'Usage Role', 'Assist-to-Turnover Ratio', 'Free Throw %', 'Vertical Jump', 'Repeat Sprint Readiness', 'Session RPE'],
    weeklyFocus: ['Game density and minutes concentration', 'Decision speed under fatigue', 'Late-game composure and free-throw posture', 'Jump/landing and repeat-sprint load'],
    gameDayFocus: ['Ball-handler readiness', 'High-minute athlete recovery', 'Travel sleep and hydration', 'Possession-level reset protocol'],
    watchSignals: ['Low HRV + high ACWR in high-minute roles', 'Decisioning decline after congested schedule', 'Sentiment drop after role/minutes volatility'],
    coachActions: ['Adjust high-intensity practice dose by role', 'Protect late-game decision-makers from unnecessary cognitive load', 'Use possession-level reset language in walkthrough'],
    language: 'Concise film-room language: pace, spacing, reads, possessions, closeouts, late-clock decisions.',
    avoid: ['Generic hustle advice', 'Raw readiness score rankings', 'Mechanics changes without coach context'],
  },
  {
    id: 'soccer',
    name: 'Soccer',
    emoji: '⚽',
    roles: 'Goalkeeper, Defender, Midfielder, Forward',
    kpis: ['Minutes / Match', 'Total Distance', 'High-Speed Runs', 'Sprint Distance', 'Touches Under Pressure', 'Pass Completion Under Pressure', 'Session RPE'],
    weeklyFocus: ['Fixture congestion', 'High-speed running and hamstring/groin load', 'Scanning and first-touch pressure', 'Goalkeeper-specific confidence and communication'],
    gameDayFocus: ['Position-specific running load', 'Heat/travel impact', 'Transition and set-piece decision posture', 'Goalkeeper tracking/composure when relevant'],
    watchSignals: ['High-speed run spike + degraded recovery', 'Composure decline after mistakes', 'Underfueling during heavy match blocks'],
    coachActions: ['Modulate small-sided volume by position', 'Use role-specific scanning cues', 'Reinforce next-action communication after errors'],
    language: 'Match-phase language: build-up, transition, final third, defending, set pieces, next action.',
    avoid: ['One conditioning recommendation for all positions', 'Technique overreach without tactical role', 'Body-weight advice without staff context'],
  },
  {
    id: 'football',
    name: 'Football',
    emoji: '🏈',
    roles: 'Quarterback, Running Back, Wide Receiver, Tight End, Offensive Line, Defensive Line, Linebacker, Cornerback, Safety, Kicker',
    kpis: ['Snap Count', 'Explosive Plays', 'Missed Assignments', '10-Yard Split', 'Body Weight', 'Collision Load', 'Session RPE'],
    weeklyFocus: ['Collision accumulation by unit', 'Assignment clarity and playbook load', 'Explosive readiness', 'Position body-composition context'],
    gameDayFocus: ['Pre-snap routine stability', 'Contact recovery', 'Specialist vs skill vs line readiness', 'Heat and camp load if relevant'],
    watchSignals: ['Collision load spike + poor sleep', 'Missed assignments rising with cognitive fatigue', 'Weight manipulation pressure'],
    coachActions: ['Adjust contact exposure by unit', 'Use pre-snap routine reminders', 'Separate mental install from heavy physical load when fatigue is high'],
    language: 'Direct position-room language: unit, assignment, snap, pre-snap, next play, explosive intent.',
    avoid: ['Concussion or return-to-play advice', 'Flattening positions into one load model', 'Weight-change recommendations without staff context'],
  },
  {
    id: 'baseball',
    name: 'Baseball',
    emoji: '⚾',
    roles: 'Pitcher, Catcher, First Base, Second Base, Third Base, Shortstop, Left Field, Center Field, Right Field',
    kpis: ['Pitch Count', 'Innings Workload', 'Throwing Velocity', 'Strike %', 'Exit Velocity', 'On-Base %', 'Pop Time', 'Arm Care Readiness'],
    weeklyFocus: ['Throwing volume and role type', 'Pitch-to-pitch or at-bat routine quality', 'Command confidence and slump reset', 'Long-game fueling and heat'],
    gameDayFocus: ['Pitcher/catcher readiness', 'Bullpen timing', 'Low-frequency high-pressure actions', 'Dugout fueling practicality'],
    watchSignals: ['Throwing workload spike', 'Command volatility with poor recovery', 'Slump rumination and confidence drop'],
    coachActions: ['Protect arm-care window', 'Keep cueing routine-based', 'Use at-bat-to-at-bat reset prompts'],
    language: 'Pitch-to-pitch and at-bat-to-at-bat language: approach, command, routine, reset.',
    avoid: ['Throwing pain diagnosis', 'Swing or pitching rebuilds', 'Pitcher/position-player equivalence'],
  },
  {
    id: 'softball',
    name: 'Softball',
    emoji: '🥎',
    roles: 'Pitcher, Catcher, First Base, Second Base, Third Base, Shortstop, Outfield',
    kpis: ['Pitch Count', 'Pitch Velocity', 'Strike %', 'Exit Velocity', 'On-Base %', 'Pop Time', 'Reaction Readiness'],
    weeklyFocus: ['Tournament rhythm', 'Throwing volume and catcher fatigue', 'Reaction windows', 'Confidence after errors or tough at-bats'],
    gameDayFocus: ['All-day fueling and heat', 'Pitcher/catcher workload', 'Pitch-to-pitch reset', 'Defensive reaction readiness'],
    watchSignals: ['Tournament underfueling', 'Throwing workload spike', 'Error carryover', 'Catcher fatigue'],
    coachActions: ['Plan predictable fueling windows', 'Adjust extra throwing volume', 'Use inning-to-inning reset cues'],
    language: 'Pitch-to-pitch, inning-to-inning, dugout-practical language with short action cues.',
    avoid: ['Throwing rehab guidance', 'Mechanical rebuilds', 'Ignoring all-day tournament logistics'],
  },
  {
    id: 'volleyball',
    name: 'Volleyball',
    emoji: '🏐',
    roles: 'Setter, Outside Hitter, Middle Blocker, Opposite Hitter, Libero',
    kpis: ['Attack %', 'Serve Receive Rating', 'Aces-to-Errors Ratio', 'Block Touches', 'Digs / Set', 'Jump Count', 'Approach Jump'],
    weeklyFocus: ['Jump/landing load', 'Serve-receive composure', 'Setter decision speed', 'Shoulder volume and tournament waves'],
    gameDayFocus: ['Rotation role readiness', 'Point-to-point reset', 'Serve/receive pressure', 'Long gaps between matches'],
    watchSignals: ['Jump count spike + poor recovery', 'Serve-receive anxiety', 'Communication breakdown', 'Tournament underfueling'],
    coachActions: ['Adjust jump volume', 'Reinforce point-reset routines', 'Keep fueling light and timed around play windows'],
    language: 'Point-to-point language: platform, read, rotation, timing, communication, reset.',
    avoid: ['Generic confidence advice', 'Shoulder/knee rehab claims', 'Ignoring tournament match gaps'],
  },
  {
    id: 'tennis',
    name: 'Tennis',
    emoji: '🎾',
    roles: 'Singles, Doubles',
    kpis: ['First Serve %', 'Second Serve Points Won', 'Unforced Errors', 'Winners-to-Errors', 'Break Point Conversion', 'Match Duration', 'Session RPE'],
    weeklyFocus: ['Match duration uncertainty', 'Between-point routines', 'Surface and playing style', 'Heat and tournament density'],
    gameDayFocus: ['Serve confidence', 'Point construction', 'Changeover fueling', 'Singles vs doubles decision demand'],
    watchSignals: ['Unforced-error rise with fatigue', 'Heat stress', 'Emotional momentum swings', 'Grip/shoulder fatigue'],
    coachActions: ['Use between-point reset plans', 'Prepare portable fueling/sodium', 'Keep tactical cue count low'],
    language: 'Between-point and changeover language: serve + 1, patterns, reset, momentum, court position.',
    avoid: ['Overloading swing thoughts', 'Assuming match length', 'Treating singles and doubles as identical'],
  },
  {
    id: 'swimming',
    name: 'Swimming',
    emoji: '🏊',
    roles: 'Freestyle, Backstroke, Breaststroke, Butterfly, Individual Medley',
    kpis: ['Race Time', 'Split Consistency', 'Stroke Rate', 'Stroke Count', 'Start Reaction', 'Underwater Distance', 'Session RPE'],
    weeklyFocus: ['Stroke/event distance', 'Training volume and double sessions', 'Taper state', 'Starts/turns and split consistency'],
    gameDayFocus: ['Race-segment readiness', 'Warm-up and race timing', 'Water feel', 'Anxiety around start/turn execution'],
    watchSignals: ['Heavy volume + poor sleep', 'Split fade trend', 'Start reaction drop', 'Taper anxiety'],
    coachActions: ['Align cues to race segment', 'Protect recovery during taper', 'Use rhythm-based language'],
    language: 'Race-segment language: start, breakout, turn, underwater, split, finish, rhythm.',
    avoid: ['Generic conditioning advice', 'Ignoring event distance', 'Assuming low hydration need because sweat is less visible'],
  },
  {
    id: 'track-field',
    name: 'Track & Field',
    emoji: '🏃',
    roles: 'Sprinter, Middle Distance, Long Distance, Jumper, Thrower, Hurdler',
    kpis: ['Personal Best', 'Season Best', 'Split Time', 'Approach Speed', 'Jump Distance / Height', 'Throw Distance', 'Session RPE'],
    weeklyFocus: ['Event group demands', 'Meet schedule and heat', 'Approach/rhythm consistency', 'Body-composition pressure when relevant'],
    gameDayFocus: ['Event-specific arousal', 'Warm-up timing', 'Technical rhythm', 'Distance vs power recovery needs'],
    watchSignals: ['Speed/power drop with high load', 'Distance underfueling', 'Approach inconsistency', 'Meet anxiety'],
    coachActions: ['Separate sprint/jump/throw/distance logic', 'Use event-specific cueing', 'Avoid unnecessary volume near meet day'],
    language: 'Event-group language: rhythm, split, approach, drive phase, clearance, release, kick.',
    avoid: ['One report model for all event groups', 'Generic weight pressure', 'Technical overhaul from readiness data'],
  },
  {
    id: 'wrestling',
    name: 'Wrestling',
    emoji: '🤼',
    roles: 'Individual',
    kpis: ['Weight Delta', 'Mat Time', 'Takedown Conversion', 'Escape Rate', 'Riding Time', 'Grip Readiness', 'Session RPE'],
    weeklyFocus: ['Weight class context', 'Weigh-in timing', 'Grip and mat fatigue', 'Match-by-match emotional control'],
    gameDayFocus: ['Hydration/refuel status', 'Stance and hand-fighting readiness', 'Fatigue tolerance', 'Tournament bracket rhythm'],
    watchSignals: ['Aggressive weight delta', 'Hydration risk', 'Grip fatigue', 'Confidence drop after close losses'],
    coachActions: ['Flag unsafe cut patterns', 'Plan post-weigh-in refuel', 'Use match-by-match reset language'],
    language: 'Mat-specific language: stance, hand fight, shot, escape, ride, reset, period.',
    avoid: ['Unsafe dehydration guidance', 'Weight-cut normalization', 'Injury or clearance advice'],
  },
  {
    id: 'crossfit',
    name: 'CrossFit',
    emoji: '🏋️',
    roles: 'Individual',
    kpis: ['Benchmark Score', '1RM', 'Gymnastics Volume', 'Mono Pace', 'Grip Fatigue', 'Session RPE', 'Sleep Quality'],
    weeklyFocus: ['Mixed-modal density', 'Limiter identification', 'Grip and eccentric load', 'Skill/strength/engine separation'],
    gameDayFocus: ['Event spacing', 'Gut comfort before intensity', 'Pacing strategy', 'Movement standards'],
    watchSignals: ['Grip fatigue + gymnastics volume spike', 'Sleep decline during high-density block', 'Overpacing pattern'],
    coachActions: ['Separate limiter from mindset issue', 'Protect grip/shoulder volume', 'Plan carbs around event spacing'],
    language: 'Competition-floor language: event, limiter, standard, pacing, transition, engine, skill.',
    avoid: ['Treating every miss as mental toughness', 'Ignoring movement standards', 'One fueling plan for all event types'],
  },
  {
    id: 'golf',
    name: 'Golf',
    emoji: '⛳',
    roles: 'Individual',
    kpis: ['Scoring Average', 'Fairways Hit', 'Greens in Regulation', 'Putts / Round', 'Up-and-Down %', 'Club Speed', 'Shot Dispersion'],
    weeklyFocus: ['Pre-shot routine', 'Course management', 'Bad-shot recovery', 'Round-state and environment: qualifying vs tournament, tee time, heat, wind, early vs late-round splits'],
    gameDayFocus: ['Commitment and target clarity', 'Caffeine/hydration timing', 'Walking load', 'Putting confidence', 'Course/weather demand and late-round energy plan'],
    watchSignals: ['Bad-shot carryover', 'Sleep disruption before qualifying', 'Late-round dispersion increase', 'Caffeine jitters', 'Wind/heat plus low hydration coverage'],
    coachActions: ['Keep cue count to one', 'Reinforce target/routine/acceptance', 'Plan steady small fueling windows', 'Adjust report read by round state and environment'],
    language: 'Caddie-style language: target, commitment, routine, acceptance, tempo, round state, course management.',
    avoid: ['Swing rebuilds', 'Multiple technical cues', 'Ignoring course conditions and round duration'],
  },
  {
    id: 'bowling',
    name: 'Bowling',
    emoji: '🎳',
    roles: 'Anchor, Leadoff, Middle Lineup, Baker Rotation, Individual',
    kpis: ['Frame Average', 'Strike %', 'Spare Conversion %', 'Single-Pin Spare %', 'Open Frame Rate', 'First-Ball Count', 'Lane Transition Adjustment Quality'],
    weeklyFocus: ['Pre-shot routine consistency', 'Lane transition reads', 'Spare process reliability', 'Tournament day fatigue and repetition load'],
    gameDayFocus: ['Surface/ball choice confidence', 'Early frame target-line commitment', 'Anchor-frame composure', 'Multi-game hydration and hand/grip readiness'],
    watchSignals: ['Open-frame rise with fatigue', 'Spare conversion drop after travel or long blocks', 'Composure drift after carry variance', 'Delayed lane adjustment pattern'],
    coachActions: ['Reinforce spare routine before scoring pressure', 'Use short reset language after bad breaks', 'Review lane-transition communication cadence', 'Manage extra practice volume during multi-day tournaments'],
    language: 'Lane and frame language: target line, breakpoint, spare process, transition, carry, fill frame, next shot.',
    avoid: ['Blaming athletes for carry variance', 'Equipment/surface prescriptions without coach context', 'Generic confidence advice without lane-state context'],
  },
  {
    id: 'lacrosse',
    name: 'Lacrosse',
    emoji: '🥍',
    roles: 'Attack, Midfield, Defense, Goalkeeper',
    kpis: ['Points', 'Shots on Goal', 'Ground Balls', 'Caused Turnovers', 'Save %', 'Sprint Repeat Readiness', 'Session RPE'],
    weeklyFocus: ['Two-way sprint demand', 'Contact tolerance', 'Stick skill under pressure', 'Goalkeeper confidence when relevant'],
    gameDayFocus: ['Shift/possession readiness', 'Communication after turnovers', 'Ground-ball effort under fatigue', 'Heat and tournament recovery'],
    watchSignals: ['Repeat sprint fatigue', 'Contact accumulation', 'Turnover carryover', 'Goalie confidence swings'],
    coachActions: ['Adjust high-speed/contact dose', 'Use possession reset language', 'Emphasize communication and ground-ball actions'],
    language: 'Shift and possession language: dodge, clear, slide, ground ball, reset, next play.',
    avoid: ['Goalie/field-player flattening', 'Injury rehab advice', 'Ignoring contact and sprint density'],
  },
  {
    id: 'hockey',
    name: 'Hockey',
    emoji: '🏒',
    roles: 'Forward, Defenseman, Goalie',
    kpis: ['Time on Ice', 'Average Shift Length', 'Shots on Goal', 'Faceoff Win %', 'Save %', 'Skate Repeat Readiness', 'Session RPE'],
    weeklyFocus: ['Shift length and repeatability', 'Contact accumulation', 'Puck decisions under pressure', 'Goalie tracking/confidence when relevant'],
    gameDayFocus: ['Bench reset', 'Skating repeat readiness', 'Late-night game/travel sleep', 'Cold-rink hydration blind spots'],
    watchSignals: ['Shift fatigue', 'Puck decision panic', 'Goalie confidence swings', 'Underhydration'],
    coachActions: ['Adjust shift/workload expectations', 'Use bench-reset cueing', 'Separate goalie and skater recommendations'],
    language: 'Shift-by-shift language: puck decision, gap, tracking, bench reset, net-front, next shift.',
    avoid: ['Goalie and skater equivalence', 'Concussion/injury guidance', 'Ignoring game density and shift length'],
  },
  {
    id: 'gymnastics',
    name: 'Gymnastics',
    emoji: '🤸',
    roles: 'Individual',
    kpis: ['Difficulty Score', 'Execution Score', 'Routine Hit Rate', 'Stuck Landings', 'Skill Attempts', 'Landing Load', 'Session RPE'],
    weeklyFocus: ['Apparatus and skill stage', 'Fear blocks and routine confidence', 'Landing load', 'Meet-day composure'],
    gameDayFocus: ['Routine readiness', 'Air awareness confidence', 'Psychological safety', 'Apparatus-specific cueing'],
    watchSignals: ['Fear block escalation', 'Landing load spike', 'Restrictive eating pressure', 'Perfectionism spiral'],
    coachActions: ['Use safe, precise progression language', 'Separate courage from readiness', 'Encourage support-staff communication when needed'],
    language: 'Psychologically safe apparatus language: routine, landing, connection, air awareness, confidence, progression.',
    avoid: ['Weight/leanness shortcuts', 'Return-to-skill clearance', 'Shaming fear responses'],
  },
  {
    id: 'bodybuilding-physique',
    name: 'Bodybuilding / Physique',
    emoji: '🏆',
    roles: 'Men’s Physique, Classic Physique, Bodybuilding, Bikini, Figure, Wellness, Fitness',
    kpis: ['Weeks Out', 'Stage Weight Target', 'Cardio Minutes / Week', 'Fasted Weight Average', 'Daily Steps', 'Posing Minutes', 'Waist Measurement'],
    weeklyFocus: ['Prep phase and show timeline', 'Food variance tolerance', 'Cardio/steps load', 'Posing practice and recovery'],
    gameDayFocus: ['Peak-week status if relevant', 'Predictable approved foods', 'Flatness/spillover indicators', 'Post-show reverse guardrails'],
    watchSignals: ['Target mismatch', 'Digestion variance', 'Rebound overeating risk', 'Unsafe restriction pressure'],
    coachActions: ['Audit against coach-set macros', 'Keep adjustments controlled', 'Use prep-phase-specific language'],
    language: 'Precise prep-coach language: weeks out, phase, division, flatness, spillover, reverse, approved foods.',
    avoid: ['Generic food swaps near show window', 'Casual weight-loss advice', 'Undermining coach-locked macros'],
  },
  {
    id: 'other',
    name: 'Other',
    emoji: '🏅',
    roles: 'Individual',
    kpis: ['Competition Date', 'Training Load', 'Session RPE', 'Readiness Score', 'Performance Score'],
    weeklyFocus: ['Clarify discipline and movement demand', 'Competition phase', 'Training load and recovery', 'Mental performance demand'],
    gameDayFocus: ['Known competition duration', 'Movement/energy-system demand', 'Heat/travel/recovery context', 'Confidence and focus needs'],
    watchSignals: ['Missing sport context', 'Unknown movement demand', 'Generic advice risk', 'Unverified injury context'],
    coachActions: ['Ask one clarifying question before precision', 'Keep recommendations adaptable', 'Flag need for sport-specific configuration if recurring'],
    language: 'Transparent assumption language: discipline, role, phase, load, movement demand, competition duration.',
    avoid: ['Pretending sport-specific certainty', 'Injury diagnosis', 'Over-specific recommendations from incomplete context'],
  },
];

const SportMockDetails = ({ sport }: { sport: SportMockReportBaseline }) => (
  <details className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-4">
    <summary className="cursor-pointer list-none">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-base font-semibold text-white">
            {sport.emoji} {sport.name}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{sport.roles}</p>
        </div>
        <span className="rounded-full border border-purple-500/25 bg-purple-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-purple-200">
          Report outline
        </span>
      </div>
    </summary>

    <div className="mt-5 space-y-4">
      <DataTable
        columns={['Report Area', 'Report Lens']}
        rows={[
          ['Weekly read', <BulletList key={`${sport.id}-weekly`} items={sport.weeklyFocus} />],
          ['Game-day read', <BulletList key={`${sport.id}-gameday`} items={sport.gameDayFocus} />],
          ['Watchlist signals', <BulletList key={`${sport.id}-watch`} items={sport.watchSignals} />],
          ['Coach actions', <BulletList key={`${sport.id}-actions`} items={sport.coachActions} />],
        ]}
      />
      <CardGrid columns="lg:grid-cols-3">
        <InfoCard
          title="Sport-Native KPIs"
          accent="blue"
          body={<BulletList items={sport.kpis} />}
        />
        <InfoCard
          title="Language Posture"
          accent="green"
          body={sport.language}
        />
        <InfoCard
          title="Must Avoid"
          accent="red"
          body={<BulletList items={sport.avoid} />}
        />
      </CardGrid>
      <CardGrid columns="lg:grid-cols-3">
        <InfoCard
          title="Core Dimension Map"
          accent="purple"
          body={<BulletList items={dimensionMapFromPolicy(sport.id) || CORE_DIMENSION_MAP[sport.id] || CORE_DIMENSION_MAP.other} />}
        />
        <InfoCard
          title="Data Inputs"
          accent="blue"
          body={<BulletList items={DEFAULT_DATA_POLICY} />}
        />
        <InfoCard
          title="Minimum Data Rules"
          accent="amber"
          body={<BulletList items={DEFAULT_MINIMUM_DATA} />}
        />
      </CardGrid>
      <CoachDemoLinkCard sport={sport} />
    </div>
  </details>
);

// Coach Demo opens in its own tab so coaches and reviewers see the report on a clean,
// design-forward surface — not buried inside the spec page.
const CoachDemoLinkCard = ({ sport }: { sport: SportMockReportBaseline }) => {
  const policy = DEFAULT_SPORT_POLICIES[sport.id];
  const demo = COACH_REPORT_DEMO_EXAMPLES[sport.id];
  const sportColor = getSportColor(sport.id);

  // Run the gates so the link card can show whether the demo would render
  // a Specific top line, named athletes, and concrete actions — or fall back
  // to a thin read.
  const topLine = composeReportTopLine(demo?.topLine || { whatChanged: '', who: '', firstAction: '' }, { sportName: sport.name });
  const watchlistGate = enforceNamedAthleteWatchlist(demo?.watchlist || []);
  const coachActionGate = enforceCoachActionSpecificity(demo?.coachActions || []);

  const policyMissing = !policy;
  const isSpecific = topLine.used === 'specific';
  const namedCount = watchlistGate.rendered.length;
  const actionCount = coachActionGate.rendered.length;

  // Public stakeholder-shareable URL — moved out from /admin/coachReportDemo so
  // the demo can be opened by reviewers and partners without admin auth.
  const href = `/coach-report-demo/${sport.id}`;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-900 p-6 transition hover:border-zinc-700"
    >
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: sportColor.primary }} />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: sportColor.primary }}>
            Coach Demo
          </p>
          <p className="text-base font-semibold text-white">
            Open the {sport.name} weekly coach report
          </p>
          <p className="text-xs text-zinc-400">
            Full-page, coach-first design. Opens in a new tab.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-300">
          <span className={`rounded-full px-2.5 py-0.5 ${isSpecific ? 'bg-emerald-500/12 text-emerald-300' : 'bg-amber-500/12 text-amber-200'}`}>
            {isSpecific ? 'Specific top line' : 'Thin-read fallback'}
          </span>
          <span className="rounded-full bg-zinc-800/70 px-2.5 py-0.5 text-zinc-300">
            {namedCount} named
          </span>
          <span className="rounded-full bg-zinc-800/70 px-2.5 py-0.5 text-zinc-300">
            {actionCount} action{actionCount === 1 ? '' : 's'}
          </span>
          {policyMissing && (
            <span className="rounded-full bg-rose-500/12 px-2.5 py-0.5 text-rose-200">
              No policy
            </span>
          )}
          <ArrowUpRight className="h-4 w-4 text-zinc-400 transition group-hover:text-white" />
        </div>
      </div>
    </Link>
  );
};

const PulseCheckSportsIntelligenceMockReportBaselinesTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Sports Intelligence"
        title="Report Outlines + Coach Mock Reports"
        version="Version 0.2 | April 25, 2026"
        summary="Companion baseline for what Sports Intelligence reports should look like across every sport currently present in the PulseCheck sport configuration. Each sport has a build-facing report outline plus a coach-facing mock report demo that shows the plain-English, actionable artifact a head coach could actually receive."
        highlights={[
          {
            title: 'All Configured Sports Covered',
            body: 'Each collapsed sport section maps to the current default PulseCheck sport configuration and defines both report policy and a readable coach-report demo.',
          },
          {
            title: 'Reports Carry The Interpretation',
            body: 'The report pattern stays narrative and coach-actionable. The thin Coach Dashboard is the access surface that links into these reports — KPIs support the story on the dashboard, but they do not replace the interpretation.',
          },
          {
            title: 'Coach-Ready Demo',
            body: 'The mock report is written for a head coach, not a neurobiology reader: top line, data confidence, team read, watchlist, practical actions, and caveats.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Report-policy and coach-demo companion for Sports Intelligence implementation. Defines weekly, game-day, and alert-candidate expectations before report generation is built, plus readable mock reports for coach review."
        sourceOfTruth="This page owns baseline report outlines and coach-facing report demos by sport. The Aggregation + Inference Contract owns scoring, thresholds, confidence, and payload shape. The Architecture & Product Boundaries spec owns where reports sit in the system."
        masterReference="Sport coverage follows the default `PulseCheckSportConfigurationEntry` list in `src/api/firebase/pulsecheckSportConfig.ts`. If admins add a sport in `/admin/pulsecheckSportConfiguration`, this page should receive a matching collapsed mock-report baseline before coach delivery."
        relatedDocs={[
          'Sports Intelligence Layer',
          'Aggregation + Inference Contract',
          'Sport Configuration Registry',
          'Coach Journey',
          'Pilot Outcome Metrics Contract',
        ]}
      />

      <SectionBlock icon={FileText} title="Universal Coach Report Shape">
        <DataTable columns={['Surface', 'Audience', 'Mock Contents', 'Release Posture']} rows={REPORT_STRUCTURE} />
        <DataTable columns={['Block', 'Required Shape']} rows={REPORT_ROW_SHAPE} />
        <DataTable columns={['Coach Report Block', 'Plain-English Requirement']} rows={COACH_REPORT_SHAPE} />
      </SectionBlock>

      <SectionBlock icon={Gauge} title="Adherence + Data Coverage">
        <InfoCard
          title="Primary Pilot Confidence Block"
          accent="amber"
          body="Because adherence is the UMES pilot's primary success metric, every weekly report starts with data coverage before it makes athlete-specific claims. Thin participation lowers confidence and suppresses strong coach actions."
        />
        <DataTable columns={['Coverage Area', 'Report Rule']} rows={ADHERENCE_REQUIREMENTS} />
      </SectionBlock>

      <SectionBlock icon={ListChecks} title="Config-Backed Report Policy">
        <InfoCard
          title="Where This Becomes Buildable"
          accent="blue"
          body="The pilot report policy lives under each `PulseCheckSportConfigurationEntry.reportPolicy`, with common defaults owned by the report generator. All 18 configured sports now ship with a populated reportPolicy (UMES pilot sports — basketball, golf, bowling — were policy-backed first; the remainder followed in this rollout)."
        />
        <DataTable columns={['Policy Field', 'Purpose']} rows={REPORT_POLICY_SCHEMA_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Gauge} title="Configuration Coverage">
        <CardGrid columns="md:grid-cols-1">
          <InfoCard
            title="Covered In This Baseline"
            accent="green"
            body={`${SPORTS.length} configured sports: ${SPORTS.map((sport) => sport.name).join(', ')}.`}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Sport-Specific Mock Report Outlines">
        <div className="space-y-3">
          {SPORTS.map((sport) => (
            <SportMockDetails key={sport.id} sport={sport} />
          ))}
        </div>
      </SectionBlock>

      <SectionBlock icon={ListChecks} title="Implementation Acceptance">
        <InfoCard
          title="Report Generator Is Aligned When"
          accent="green"
          body={
            <BulletList
              items={[
                'Every generated weekly report includes the universal blocks and sport-native KPI anchors for the athlete sport.',
                'Every weekly report opens with adherence/data coverage and suppresses strong claims when participation is thin.',
                'Every game-day report uses the sport-specific readiness lens and avoids prohibited language for that sport.',
                'Every sport-native theme maps internally to Focus, Composure, and Decisioning so cross-sport measurement remains coherent.',
                'Top line requires three fills (whatChanged + who + firstAction). If any is missing, generator falls back to thin-read copy and labels the report as Thin read.',
                'Watchlist requires named athletes at stable confidence or higher; group-only blocks (e.g. "Sprinter group") are suppressed by policy.',
                'Coach actions must reference a named athlete or specific session; generic principles are filtered out.',
                'Every emitted report passes the sport-localization audit against languagePosture.mustAvoid; failed audits block coach delivery until regenerated.',
                'Every watchlist candidate carries evidence refs, confidence tier, missing inputs, and human review status.',
                'Pilot reviewers can compare generated copy against this mock baseline before coach delivery.',
                'New sports added through configuration are not considered report-ready until reportPolicy is populated and a matching mock-report baseline exists.',
              ]}
            />
          }
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Boundary Reminder">
        <InfoCard
          title="Mock Reports Do Not Grant Automation"
          accent="red"
          body="These baselines define expected report shape and language. They do not override the automation gates in the Aggregation + Inference Contract. Weekly and game-day reports remain human-reviewed during pilot; early-warning alerts remain internal candidates only."
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckSportsIntelligenceMockReportBaselinesTab;
