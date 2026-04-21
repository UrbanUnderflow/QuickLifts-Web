import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './config';

export interface PulseCheckSportConfigurationEntry {
  id: string;
  name: string;
  emoji: string;
  positions: string[];
  sortOrder: number;
  schemaVersion?: number;
  attributes?: PulseCheckSportAttributeDefinition[];
  metrics?: PulseCheckSportMetricDefinition[];
  prompting?: PulseCheckSportPromptingConfiguration;
}

export type PulseCheckSportAttributeType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'singleSelect'
  | 'multiSelect';

export type PulseCheckSportAttributeScope =
  | 'athlete'
  | 'team'
  | 'season'
  | 'competition'
  | 'nutrition'
  | 'recovery';

export interface PulseCheckSportAttributeOption {
  label: string;
  value: string;
}

export interface PulseCheckSportAttributeDefinition {
  id: string;
  key: string;
  label: string;
  type: PulseCheckSportAttributeType;
  scope: PulseCheckSportAttributeScope;
  required?: boolean;
  includeInNoraContext?: boolean;
  includeInMacraContext?: boolean;
  options?: PulseCheckSportAttributeOption[];
  placeholder?: string;
  sortOrder?: number;
}

export interface PulseCheckSportMetricDefinition {
  id: string;
  key: string;
  label: string;
  unit?: string;
  scope?: PulseCheckSportAttributeScope;
  includeInNoraContext?: boolean;
  sortOrder?: number;
}

export interface PulseCheckSportPromptingConfiguration {
  noraContext?: string;
  macraNutritionContext?: string;
  riskFlags?: string[];
  restrictedAdvice?: string[];
  recommendedLanguage?: string[];
}

const CONFIG_COLLECTION = 'company-config';
const CONFIG_DOCUMENT = 'pulsecheck-sports';

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeOptionValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const option = (label: string, value = normalizeOptionValue(label)): PulseCheckSportAttributeOption => ({
  label,
  value,
});

const options = (labels: string[]) => labels.map((label) => option(label));

const COMPETITIVE_LEVEL_OPTIONS = options(['Youth', 'High School', 'College', 'Semi-Pro', 'Pro / Elite', 'Recreational']);
const SEASON_PHASE_OPTIONS = options(['Off-Season', 'Preseason', 'In-Season', 'Postseason', 'Tournament Week', 'Return to Play']);
const TRAINING_LOAD_OPTIONS = options(['Deload / Taper', 'Normal Load', 'High Load', 'Two-a-Day Block', 'Travel / Congested Schedule', 'Return to Play']);
const HANDEDNESS_OPTIONS = options(['Right', 'Left', 'Switch / Both']);

const attribute = (
  sportId: string,
  key: string,
  label: string,
  type: PulseCheckSportAttributeType,
  scope: PulseCheckSportAttributeScope,
  sortOrder: number,
  config: Partial<Omit<PulseCheckSportAttributeDefinition, 'id' | 'key' | 'label' | 'type' | 'scope' | 'sortOrder'>> = {}
): PulseCheckSportAttributeDefinition => ({
  id: `${sportId}-${normalizeOptionValue(key)}`,
  key,
  label,
  type,
  scope,
  required: Boolean(config.required),
  includeInNoraContext: config.includeInNoraContext !== false,
  includeInMacraContext: Boolean(config.includeInMacraContext),
  options: config.options || [],
  placeholder: config.placeholder || '',
  sortOrder,
});

const metric = (
  sportId: string,
  key: string,
  label: string,
  unit: string,
  scope: PulseCheckSportAttributeScope,
  sortOrder: number,
  includeInNoraContext = true
): PulseCheckSportMetricDefinition => ({
  id: `${sportId}-${normalizeOptionValue(key)}`,
  key,
  label,
  unit,
  scope,
  includeInNoraContext,
  sortOrder,
});

const sportDefaults = (
  sport: Omit<PulseCheckSportConfigurationEntry, 'schemaVersion'> & {
    attributes?: PulseCheckSportAttributeDefinition[];
    metrics?: PulseCheckSportMetricDefinition[];
    prompting: PulseCheckSportPromptingConfiguration;
  }
): PulseCheckSportConfigurationEntry => ({
  schemaVersion: 2,
  ...sport,
});

const DEFAULT_PULSECHECK_SPORTS: PulseCheckSportConfigurationEntry[] = [
  sportDefaults({
    id: 'basketball',
    name: 'Basketball',
    emoji: '🏀',
    positions: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'],
    sortOrder: 0,
    attributes: [
      attribute('basketball', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('basketball', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('basketball', 'primaryRoleDemand', 'Primary Role Demand', 'singleSelect', 'athlete', 2, {
        options: options(['Primary Ball Handler', 'Secondary Creator', 'Off-Ball Shooter', '3-and-D Wing', 'Rim Runner', 'Interior Anchor']),
      }),
      attribute('basketball', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 3, {
        options: options(['Shooting Confidence', 'Decision Speed', 'Late-Game Composure', 'Defensive Pressure', 'Contact Finishing', 'Conditioning']),
      }),
      attribute('basketball', 'movementDemand', 'Movement Demand', 'multiSelect', 'athlete', 4, {
        options: options(['Acceleration / Deceleration', 'Lateral Containment', 'Jumping / Landing', 'Change of Direction', 'Contact Balance', 'Repeat Sprint']),
      }),
      attribute('basketball', 'currentLoadPattern', 'Current Load Pattern', 'singleSelect', 'recovery', 5, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
    ],
    metrics: [
      metric('basketball', 'minutesPerGame', 'Minutes / Game', 'min', 'competition', 0),
      metric('basketball', 'usageRole', 'Usage Role', '%', 'competition', 1),
      metric('basketball', 'assistTurnoverRatio', 'Assist-to-Turnover Ratio', 'ratio', 'competition', 2),
      metric('basketball', 'freeThrowPercentage', 'Free Throw %', '%', 'competition', 3),
      metric('basketball', 'verticalJump', 'Vertical Jump', 'in', 'athlete', 4),
      metric('basketball', 'repeatSprintReadiness', 'Repeat Sprint Readiness', 'score', 'recovery', 5),
      metric('basketball', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach basketball through role, pace, spacing, decision speed, emotional regulation, and repeat high-intensity movement. Tie advice to position demands and game context before giving mindset or performance guidance.',
      macraNutritionContext: 'Basketball nutrition should account for game density, minutes, travel, sweat rate, repeat sprint demand, and late-game energy. Adjust fueling and recovery around practices, lifts, and games rather than generic macro advice.',
      riskFlags: ['late-game fatigue', 'decision fatigue', 'confidence volatility', 'ankle or knee load', 'jump landing volume', 'travel sleep disruption', 'high-minute overreach'],
      restrictedAdvice: ['Do not give generic hustle advice without role context.', 'Do not recommend major jump-shot or landing mechanics changes without coach or clinician context.', 'Do not ignore game schedule, minutes, or travel load when discussing recovery.'],
      recommendedLanguage: ['Use concise, film-room language.', 'Separate controllables, reads, and recovery behaviors.', 'Translate mental skills into possession-level actions.'],
    },
  }),
  sportDefaults({
    id: 'soccer',
    name: 'Soccer',
    emoji: '⚽',
    positions: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'],
    sortOrder: 1,
    attributes: [
      attribute('soccer', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('soccer', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('soccer', 'tacticalDemand', 'Tactical Demand', 'multiSelect', 'athlete', 2, {
        options: options(['High Press', 'Possession Build-Up', 'Transition Running', 'Set Pieces', '1v1 Defending', 'Chance Creation']),
      }),
      attribute('soccer', 'dominantFoot', 'Dominant Foot', 'singleSelect', 'athlete', 3, { options: HANDEDNESS_OPTIONS }),
      attribute('soccer', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Scanning', 'First Touch', 'Composure Under Pressure', 'Finishing', 'Defensive Timing', 'Communication']),
      }),
      attribute('soccer', 'matchLoadPattern', 'Match Load Pattern', 'singleSelect', 'recovery', 5, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
    ],
    metrics: [
      metric('soccer', 'minutesPerMatch', 'Minutes / Match', 'min', 'competition', 0),
      metric('soccer', 'totalDistance', 'Total Distance', 'km', 'competition', 1),
      metric('soccer', 'highSpeedRuns', 'High-Speed Runs', 'count', 'competition', 2),
      metric('soccer', 'sprintDistance', 'Sprint Distance', 'm', 'competition', 3),
      metric('soccer', 'touchesUnderPressure', 'Touches Under Pressure', 'count', 'competition', 4),
      metric('soccer', 'passCompletionUnderPressure', 'Pass Completion Under Pressure', '%', 'competition', 5),
      metric('soccer', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach soccer through position, tactical system, scanning, decision windows, aerobic-repeat sprint demands, and emotional control after mistakes. Goalkeepers require separate confidence, communication, and reaction framing.',
      macraNutritionContext: 'Soccer fueling should reflect match minutes, high-speed running, heat, travel, and fixture congestion. Prioritize glycogen restoration, hydration, and recovery timing around matches and heavy training.',
      riskFlags: ['fixture congestion', 'hamstring or groin load', 'confidence after mistakes', 'underfueling during high-speed blocks', 'heat stress', 'travel fatigue'],
      restrictedAdvice: ['Do not give one-size-fits-all conditioning advice across positions.', 'Do not suggest aggressive body-weight changes in-season without performance staff context.', 'Do not overcoach technique without knowing tactical role.'],
      recommendedLanguage: ['Use match-phase language: build-up, transition, final third, defending.', 'Frame mindset around the next action and communication.', 'Connect biomechanics to repeatable field behaviors.'],
    },
  }),
  sportDefaults({
    id: 'football',
    name: 'Football',
    emoji: '🏈',
    positions: ['Quarterback', 'Running Back', 'Wide Receiver', 'Tight End', 'Offensive Line', 'Defensive Line', 'Linebacker', 'Cornerback', 'Safety', 'Kicker'],
    sortOrder: 2,
    attributes: [
      attribute('football', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('football', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('football', 'unit', 'Primary Unit', 'singleSelect', 'athlete', 2, { options: options(['Offense', 'Defense', 'Special Teams', 'Two-Way']) }),
      attribute('football', 'contactLoad', 'Contact Load', 'singleSelect', 'recovery', 3, {
        options: options(['Low Contact', 'Moderate Contact', 'Heavy Contact', 'Game Week Recovery', 'Return to Contact']),
        includeInMacraContext: true,
      }),
      attribute('football', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Assignment Discipline', 'Explosive First Step', 'Route / Coverage Timing', 'Pocket Poise', 'Tackling Confidence', 'Communication']),
      }),
      attribute('football', 'bodyCompositionGoal', 'Body Composition Goal', 'singleSelect', 'nutrition', 5, {
        options: options(['Maintain', 'Lean Mass Gain', 'Reduce Fat Mass', 'Position-Specific Weight Target', 'No Active Change']),
        includeInMacraContext: true,
      }),
    ],
    metrics: [
      metric('football', 'snapCount', 'Snap Count', 'snaps', 'competition', 0),
      metric('football', 'explosivePlays', 'Explosive Plays', 'count', 'competition', 1),
      metric('football', 'missedAssignments', 'Missed Assignments', 'count', 'competition', 2),
      metric('football', 'tenYardSplit', '10-Yard Split', 'sec', 'athlete', 3),
      metric('football', 'bodyWeight', 'Body Weight', 'lb', 'nutrition', 4),
      metric('football', 'collisionLoad', 'Collision Load', 'score', 'recovery', 5),
      metric('football', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach football by unit, position, playbook responsibility, collision exposure, explosive intent, and arousal control. Prioritize assignment clarity and repeatable pre-snap or pre-play routines.',
      macraNutritionContext: 'Football nutrition should account for position body composition goals, collision recovery, heat, camp load, and weekly game rhythm. Fueling differs sharply between skill, big-skill, linemen, and specialists.',
      riskFlags: ['collision fatigue', 'playbook overload', 'weight manipulation pressure', 'camp under-recovery', 'heat stress', 'over-arousal', 'return-to-contact risk'],
      restrictedAdvice: ['Do not recommend body-weight changes without position and staff context.', 'Do not give medical concussion or injury-clearance advice.', 'Do not flatten all positions into the same conditioning or nutrition plan.'],
      recommendedLanguage: ['Use direct position-room language.', 'Translate psychology into pre-snap routines and next-play resets.', 'Respect staff, scheme, and return-to-play boundaries.'],
    },
  }),
  sportDefaults({
    id: 'baseball',
    name: 'Baseball',
    emoji: '⚾',
    positions: ['Pitcher', 'Catcher', 'First Base', 'Second Base', 'Third Base', 'Shortstop', 'Left Field', 'Center Field', 'Right Field'],
    sortOrder: 3,
    attributes: [
      attribute('baseball', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('baseball', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('baseball', 'roleType', 'Role Type', 'singleSelect', 'athlete', 2, { options: options(['Pitcher', 'Catcher', 'Position Player', 'Two-Way', 'Designated Hitter']) }),
      attribute('baseball', 'handedness', 'Throw / Hit Handedness', 'singleSelect', 'athlete', 3, { options: options(['R/R', 'R/L', 'L/R', 'L/L', 'Switch Hitter']) }),
      attribute('baseball', 'throwingVolumePhase', 'Throwing Volume Phase', 'singleSelect', 'recovery', 4, {
        options: options(['Build-Up', 'Maintenance', 'High Volume', 'Deload', 'Return to Throw']),
        includeInMacraContext: true,
      }),
      attribute('baseball', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 5, {
        options: options(['Plate Approach', 'Pitch Command', 'Velocity', 'Receiving / Blocking', 'Throwing Accuracy', 'Slump Reset']),
      }),
    ],
    metrics: [
      metric('baseball', 'pitchCount', 'Pitch Count', 'pitches', 'competition', 0),
      metric('baseball', 'inningsWorkload', 'Innings Workload', 'innings', 'competition', 1),
      metric('baseball', 'throwingVelocity', 'Throwing Velocity', 'mph', 'athlete', 2),
      metric('baseball', 'strikePercentage', 'Strike %', '%', 'competition', 3),
      metric('baseball', 'exitVelocity', 'Exit Velocity', 'mph', 'competition', 4),
      metric('baseball', 'onBasePercentage', 'On-Base %', '%', 'competition', 5),
      metric('baseball', 'popTime', 'Pop Time', 'sec', 'competition', 6),
      metric('baseball', 'armCareReadiness', 'Arm Care Readiness', 'score', 'recovery', 7),
    ],
    prompting: {
      noraContext: 'Coach baseball through role, throwing volume, pitch-to-pitch routines, attentional control during low-frequency high-pressure actions, and confidence during slumps or command volatility.',
      macraNutritionContext: 'Baseball nutrition should respect long game windows, travel, heat, bullpen timing, and throwing recovery. Keep fueling practical for dugout access and avoid heavy choices that disrupt game feel.',
      riskFlags: ['throwing workload spike', 'slump rumination', 'command anxiety', 'long-game underfueling', 'travel fatigue', 'heat and hydration issues'],
      restrictedAdvice: ['Do not diagnose throwing pain or prescribe rehab.', 'Do not rebuild swing or pitching mechanics without coach context.', 'Do not ignore pitcher versus position-player demands.'],
      recommendedLanguage: ['Use pitch-to-pitch and at-bat-to-at-bat language.', 'Emphasize routines, approach, and controllable reads.', 'Keep mechanical guidance cue-based and conservative.'],
    },
  }),
  sportDefaults({
    id: 'softball',
    name: 'Softball',
    emoji: '🥎',
    positions: ['Pitcher', 'Catcher', 'First Base', 'Second Base', 'Third Base', 'Shortstop', 'Outfield'],
    sortOrder: 4,
    attributes: [
      attribute('softball', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('softball', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('softball', 'roleType', 'Role Type', 'singleSelect', 'athlete', 2, { options: options(['Pitcher', 'Catcher', 'Infielder', 'Outfielder', 'Utility', 'Designated Player']) }),
      attribute('softball', 'offensiveStyle', 'Offensive Style', 'singleSelect', 'athlete', 3, { options: options(['Power Hitter', 'Contact Hitter', 'Slapper', 'Baserunning Pressure', 'Situational Hitter']) }),
      attribute('softball', 'throwingVolumePhase', 'Throwing Volume Phase', 'singleSelect', 'recovery', 4, {
        options: options(['Build-Up', 'Maintenance', 'High Volume', 'Tournament Weekend', 'Return to Throw']),
        includeInMacraContext: true,
      }),
      attribute('softball', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 5, {
        options: options(['Pitch Command', 'Plate Confidence', 'Defensive Reaction', 'Catcher Leadership', 'Baserunning Aggression', 'Slump Reset']),
      }),
    ],
    metrics: [
      metric('softball', 'pitchCount', 'Pitch Count', 'pitches', 'competition', 0),
      metric('softball', 'pitchVelocity', 'Pitch Velocity', 'mph', 'competition', 1),
      metric('softball', 'strikePercentage', 'Strike %', '%', 'competition', 2),
      metric('softball', 'exitVelocity', 'Exit Velocity', 'mph', 'competition', 3),
      metric('softball', 'onBasePercentage', 'On-Base %', '%', 'competition', 4),
      metric('softball', 'popTime', 'Pop Time', 'sec', 'competition', 5),
      metric('softball', 'reactionReadiness', 'Reaction Readiness', 'score', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach softball through role, tournament rhythm, fast reaction windows, emotional steadiness, pitch-to-pitch resets, and confidence after errors or tough at-bats.',
      macraNutritionContext: 'Softball nutrition should account for tournament days, heat, repeated games, dugout fueling, and throwing recovery. Favor predictable foods, hydration, and small repeatable fueling windows.',
      riskFlags: ['tournament underfueling', 'heat stress', 'throwing workload spike', 'error carryover', 'slump rumination', 'catcher fatigue'],
      restrictedAdvice: ['Do not prescribe throwing rehab or diagnose pain.', 'Do not rebuild swing or pitching mechanics without coach context.', 'Do not ignore all-day tournament fueling logistics.'],
      recommendedLanguage: ['Use pitch-to-pitch and inning-to-inning reset language.', 'Keep cues short and action oriented.', 'Balance confidence with tactical approach.'],
    },
  }),
  sportDefaults({
    id: 'volleyball',
    name: 'Volleyball',
    emoji: '🏐',
    positions: ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Libero'],
    sortOrder: 5,
    attributes: [
      attribute('volleyball', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('volleyball', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('volleyball', 'rotationRole', 'Rotation Role', 'singleSelect', 'athlete', 2, { options: options(['Six-Rotation', 'Front Row', 'Back Row', 'Serving Specialist', 'Situational Sub']) }),
      attribute('volleyball', 'jumpLoadPhase', 'Jump Load Phase', 'singleSelect', 'recovery', 3, {
        options: options(['Low Jump Load', 'Normal Jump Load', 'High Jump Load', 'Tournament Weekend', 'Deload / Taper']),
        includeInMacraContext: true,
      }),
      attribute('volleyball', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Serve Receive', 'Setter Decision Speed', 'Attack Confidence', 'Blocking Timing', 'Defensive Read', 'Communication']),
      }),
      attribute('volleyball', 'movementDemand', 'Movement Demand', 'multiSelect', 'athlete', 5, {
        options: options(['Approach Jump', 'Lateral Shuffle', 'Landing Control', 'Shoulder Volume', 'Reaction / Read', 'Repeated Dive']),
      }),
    ],
    metrics: [
      metric('volleyball', 'attackPercentage', 'Attack %', '%', 'competition', 0),
      metric('volleyball', 'serveReceiveRating', 'Serve Receive Rating', 'score', 'competition', 1),
      metric('volleyball', 'acesErrorsRatio', 'Aces-to-Errors Ratio', 'ratio', 'competition', 2),
      metric('volleyball', 'blockTouches', 'Block Touches', 'count', 'competition', 3),
      metric('volleyball', 'digsPerSet', 'Digs / Set', 'count', 'competition', 4),
      metric('volleyball', 'jumpCount', 'Jump Count', 'jumps', 'recovery', 5),
      metric('volleyball', 'approachJump', 'Approach Jump', 'in', 'athlete', 6),
    ],
    prompting: {
      noraContext: 'Coach volleyball through role, rotation responsibility, communication, serve-receive composure, jump/landing load, shoulder volume, and point-to-point emotional reset.',
      macraNutritionContext: 'Volleyball nutrition should account for tournament waves, jump volume, shoulder load, hydration, and long gaps between matches. Keep fueling light, repeatable, and timed around play windows.',
      riskFlags: ['jump load spike', 'shoulder volume', 'serve-receive anxiety', 'communication breakdown', 'tournament underfueling', 'landing fatigue'],
      restrictedAdvice: ['Do not give generic confidence advice without rotation and role context.', 'Do not prescribe shoulder or knee rehab.', 'Do not ignore tournament timing and long match gaps.'],
      recommendedLanguage: ['Use point-to-point reset language.', 'Frame cues around read, platform, timing, and communication.', 'Separate technical cue from emotional reset.'],
    },
  }),
  sportDefaults({
    id: 'tennis',
    name: 'Tennis',
    emoji: '🎾',
    positions: ['Singles', 'Doubles'],
    sortOrder: 6,
    attributes: [
      attribute('tennis', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('tennis', 'matchFormat', 'Match Format', 'singleSelect', 'competition', 1, { options: options(['Singles', 'Doubles', 'Both', 'Tournament Multi-Match']) }),
      attribute('tennis', 'courtSurface', 'Court Surface', 'singleSelect', 'competition', 2, { options: options(['Hard Court', 'Clay', 'Grass', 'Indoor', 'Mixed']) }),
      attribute('tennis', 'playingStyle', 'Playing Style', 'singleSelect', 'athlete', 3, { options: options(['Aggressive Baseliner', 'Counterpuncher', 'Serve + 1', 'All-Court', 'Net Player']) }),
      attribute('tennis', 'scheduleDensity', 'Schedule Density', 'singleSelect', 'recovery', 4, {
        options: options(['Single Match', 'Tournament Day', 'Back-to-Back Days', 'Travel Week', 'Training Block']),
        includeInMacraContext: true,
      }),
      attribute('tennis', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 5, {
        options: options(['Serve Routine', 'Return Confidence', 'Unforced Error Control', 'Point Construction', 'Tie-Break Composure', 'Between-Point Reset']),
      }),
    ],
    metrics: [
      metric('tennis', 'firstServePercentage', 'First Serve %', '%', 'competition', 0),
      metric('tennis', 'secondServePointsWon', 'Second Serve Points Won', '%', 'competition', 1),
      metric('tennis', 'unforcedErrors', 'Unforced Errors', 'count', 'competition', 2),
      metric('tennis', 'winnersToErrors', 'Winners-to-Errors', 'ratio', 'competition', 3),
      metric('tennis', 'breakPointConversion', 'Break Point Conversion', '%', 'competition', 4),
      metric('tennis', 'matchDuration', 'Match Duration', 'min', 'competition', 5),
      metric('tennis', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach tennis through style, surface, point construction, between-point routines, emotional momentum, and repeated acceleration/deceleration. Treat singles and doubles decision demands differently.',
      macraNutritionContext: 'Tennis nutrition should account for match duration uncertainty, heat, sweat rate, tournament density, and court changeovers. Prioritize portable fueling, sodium, and recovery between matches.',
      riskFlags: ['heat stress', 'cramping risk', 'momentum spirals', 'serve yips', 'long-match underfueling', 'shoulder or elbow load', 'travel fatigue'],
      restrictedAdvice: ['Do not rebuild strokes without coach context.', 'Do not ignore surface and match duration uncertainty.', 'Do not give medical advice for tendon pain or cramping.'],
      recommendedLanguage: ['Use point-by-point and between-point language.', 'Give reset routines and tactical intentions.', 'Keep cues simple enough to use mid-match.'],
    },
  }),
  sportDefaults({
    id: 'swimming',
    name: 'Swimming',
    emoji: '🏊',
    positions: ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley'],
    sortOrder: 7,
    attributes: [
      attribute('swimming', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('swimming', 'primaryStroke', 'Primary Stroke', 'singleSelect', 'athlete', 1, { options: options(['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley', 'Distance Free']) }),
      attribute('swimming', 'eventDistance', 'Event Distance', 'singleSelect', 'competition', 2, {
        options: options(['Sprint', 'Middle Distance', 'Distance', 'Relay', 'Open Water']),
        includeInMacraContext: true,
      }),
      attribute('swimming', 'trainingPhase', 'Training Phase', 'singleSelect', 'season', 3, { options: options(['Base', 'Race Pace', 'Taper', 'Championship Meet', 'Recovery Block']), includeInMacraContext: true }),
      attribute('swimming', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Start Reaction', 'Underwaters', 'Turns', 'Pacing', 'Stroke Efficiency', 'Race Anxiety']),
      }),
      attribute('swimming', 'drylandLoad', 'Dryland Load', 'singleSelect', 'recovery', 5, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
    ],
    metrics: [
      metric('swimming', 'raceTime', 'Race Time', 'sec', 'competition', 0),
      metric('swimming', 'splitConsistency', 'Split Consistency', 'score', 'competition', 1),
      metric('swimming', 'strokeRate', 'Stroke Rate', 'strokes/min', 'competition', 2),
      metric('swimming', 'strokeCount', 'Stroke Count', 'count', 'competition', 3),
      metric('swimming', 'startReaction', 'Start Reaction', 'sec', 'competition', 4),
      metric('swimming', 'underwaterDistance', 'Underwater Distance', 'm', 'competition', 5),
      metric('swimming', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach swimming through event distance, stroke mechanics, pacing, taper state, race anxiety, start/turn execution, and water feel. Keep cues rhythm-based and specific to the race segment.',
      macraNutritionContext: 'Swimming nutrition should account for high training volume, double sessions, dryland, early practices, taper, and meet-day race timing. Recovery fueling and hydration matter even when sweat is less visible.',
      riskFlags: ['taper anxiety', 'underfueling during doubles', 'shoulder load', 'race pacing panic', 'meet-day fueling gaps', 'sleep disruption from early practice'],
      restrictedAdvice: ['Do not prescribe shoulder rehab or diagnose pain.', 'Do not give generic endurance advice without event distance.', 'Do not ignore taper or championship timing.'],
      recommendedLanguage: ['Use race-segment language: start, breakout, turn, finish.', 'Translate mindset into rhythm, breath, and execution cues.', 'Respect coach-defined stroke mechanics.'],
    },
  }),
  sportDefaults({
    id: 'track-field',
    name: 'Track & Field',
    emoji: '🏃',
    positions: ['Sprinter', 'Middle Distance', 'Long Distance', 'Jumper', 'Thrower', 'Hurdler'],
    sortOrder: 8,
    attributes: [
      attribute('track-field', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('track-field', 'eventGroup', 'Event Group', 'singleSelect', 'competition', 1, {
        options: options(['Sprints', 'Hurdles', 'Middle Distance', 'Distance', 'Jumps', 'Throws', 'Multi-Event']),
        required: true,
        includeInMacraContext: true,
      }),
      attribute('track-field', 'primaryEvent', 'Primary Event', 'text', 'competition', 2, { placeholder: '100m, 400m, Long Jump, Shot Put...' }),
      attribute('track-field', 'trainingPhase', 'Training Phase', 'singleSelect', 'season', 3, { options: options(['General Prep', 'Specific Prep', 'Competition', 'Championship Peak', 'Transition']), includeInMacraContext: true }),
      attribute('track-field', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Start / Acceleration', 'Max Velocity', 'Speed Endurance', 'Rhythm', 'Approach Consistency', 'Release / Takeoff', 'Race Anxiety']),
      }),
      attribute('track-field', 'loadSensitivity', 'Load Sensitivity', 'singleSelect', 'recovery', 5, { options: options(['Low', 'Moderate', 'High', 'Currently Managing Pain / Return']), includeInMacraContext: true }),
    ],
    metrics: [
      metric('track-field', 'personalBest', 'Personal Best', 'event unit', 'competition', 0),
      metric('track-field', 'seasonBest', 'Season Best', 'event unit', 'competition', 1),
      metric('track-field', 'splitTime', 'Split Time', 'sec', 'competition', 2),
      metric('track-field', 'approachSpeed', 'Approach Speed', 'm/s', 'competition', 3),
      metric('track-field', 'jumpDistanceHeight', 'Jump Distance / Height', 'm', 'competition', 4),
      metric('track-field', 'throwDistance', 'Throw Distance', 'm', 'competition', 5),
      metric('track-field', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach track and field by event group first. Sprint, hurdle, distance, jump, throw, and multi-event athletes have different arousal, rhythm, technical, and energy-system needs.',
      macraNutritionContext: 'Track nutrition should reflect event group, meet schedule, body composition pressure, training phase, and heat. Distance athletes, sprinters, jumpers, and throwers should not receive identical fueling advice.',
      riskFlags: ['event mismatch', 'peaking anxiety', 'hamstring or tendon load', 'underfueling in distance athletes', 'weight pressure', 'technical overthinking', 'meet-day timing errors'],
      restrictedAdvice: ['Do not give generic running advice without event group.', 'Do not prescribe injury rehab.', 'Do not recommend weight changes without event, phase, and staff context.'],
      recommendedLanguage: ['Use event-specific language and concise technical cues.', 'Separate arousal, rhythm, and execution.', 'Respect peaking and taper timing.'],
    },
  }),
  sportDefaults({
    id: 'wrestling',
    name: 'Wrestling',
    emoji: '🤼',
    positions: ['Individual'],
    sortOrder: 9,
    attributes: [
      attribute('wrestling', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('wrestling', 'style', 'Style', 'singleSelect', 'competition', 1, { options: options(['Folkstyle', 'Freestyle', 'Greco-Roman', 'No-Gi / Hybrid']) }),
      attribute('wrestling', 'weightClass', 'Weight Class', 'text', 'competition', 2, { placeholder: 'e.g. 165 lb', includeInMacraContext: true }),
      attribute('wrestling', 'weightCutStatus', 'Weight Cut Status', 'singleSelect', 'nutrition', 3, {
        options: options(['Not Cutting', 'Small Cut', 'Moderate Cut', 'Aggressive Cut', 'Recovery From Weigh-In']),
        includeInMacraContext: true,
      }),
      attribute('wrestling', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Hand Fight Pressure', 'Shot Confidence', 'Bottom Escape', 'Top Control', 'Gas Tank', 'Match Composure']),
      }),
      attribute('wrestling', 'trainingLoadPattern', 'Training Load Pattern', 'singleSelect', 'recovery', 5, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
    ],
    metrics: [
      metric('wrestling', 'weightDelta', 'Weight Delta', 'lb', 'nutrition', 0),
      metric('wrestling', 'matTime', 'Mat Time', 'min', 'competition', 1),
      metric('wrestling', 'takedownConversion', 'Takedown Conversion', '%', 'competition', 2),
      metric('wrestling', 'escapeRate', 'Escape Rate', '%', 'competition', 3),
      metric('wrestling', 'ridingTime', 'Riding Time', 'sec', 'competition', 4),
      metric('wrestling', 'gripReadiness', 'Grip Readiness', 'score', 'recovery', 5),
      metric('wrestling', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach wrestling through style, weight class, stance, hand fighting, positional confidence, fatigue tolerance, and match-by-match emotional control. Weight-cut context changes everything.',
      macraNutritionContext: 'Wrestling nutrition must handle weight class, weigh-in timing, hydration, glycogen, and refuel strategy carefully. Flag aggressive cuts and avoid unsafe dehydration or rapid weight-loss guidance.',
      riskFlags: ['aggressive weight cut', 'dehydration risk', 'post-weigh-in rebound', 'gas tank drop', 'match anxiety', 'grip fatigue', 'overtraining during cut'],
      restrictedAdvice: ['Do not give unsafe dehydration, sauna, laxative, or crash-cut advice.', 'Do not diagnose injuries or skin conditions.', 'Do not ignore weigh-in timing when discussing food or fluids.'],
      recommendedLanguage: ['Be direct and safety-aware.', 'Use position-specific language: hand fight, shot, finish, ride, escape.', 'Separate weight management from performance identity.'],
    },
  }),
  sportDefaults({
    id: 'crossfit',
    name: 'CrossFit',
    emoji: '🏋️',
    positions: ['Individual'],
    sortOrder: 10,
    attributes: [
      attribute('crossfit', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('crossfit', 'competitionFormat', 'Competition Format', 'singleSelect', 'competition', 1, { options: options(['Open / Online', 'Local Throwdown', 'Sanctioned Qualifier', 'Multi-Day Competition', 'Training Only']) }),
      attribute('crossfit', 'athleteBias', 'Athlete Bias', 'singleSelect', 'athlete', 2, { options: options(['Strength Bias', 'Engine Bias', 'Gymnastics Bias', 'Power Bias', 'Balanced']) }),
      attribute('crossfit', 'primaryLimiter', 'Primary Limiter', 'multiSelect', 'athlete', 3, {
        options: options(['Heavy Barbell', 'Gymnastics Skill', 'Monostructural Engine', 'Mixed Modal Pacing', 'Grip', 'Mobility']),
      }),
      attribute('crossfit', 'trainingLoadPattern', 'Training Load Pattern', 'singleSelect', 'recovery', 4, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
      attribute('crossfit', 'nutritionPriority', 'Nutrition Priority', 'singleSelect', 'nutrition', 5, {
        options: options(['Performance Fueling', 'Body Composition', 'Competition Day Strategy', 'Recovery', 'Gut Comfort']),
        includeInMacraContext: true,
      }),
    ],
    metrics: [
      metric('crossfit', 'benchmarkScore', 'Benchmark Score', 'score', 'competition', 0),
      metric('crossfit', 'oneRepMax', '1RM', 'lb', 'athlete', 1),
      metric('crossfit', 'gymnasticsVolume', 'Gymnastics Volume', 'reps', 'recovery', 2),
      metric('crossfit', 'monostructuralPace', 'Mono Pace', 'pace', 'competition', 3),
      metric('crossfit', 'gripFatigue', 'Grip Fatigue', 'score', 'recovery', 4),
      metric('crossfit', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 5),
      metric('crossfit', 'sleepQuality', 'Sleep Quality', 'score', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach CrossFit through mixed-modal demands, pacing, limiter identification, movement standards, competition format, and emotional control when workouts hurt. Separate skill, strength, and engine problems.',
      macraNutritionContext: 'CrossFit nutrition should consider training density, glycogen demand, gut comfort before high-intensity sessions, competition-day event spacing, and recovery from mixed eccentric and metabolic load.',
      riskFlags: ['redline pacing', 'underfueling high volume', 'grip blow-up', 'technical breakdown under fatigue', 'competition-day gut distress', 'sleep debt'],
      restrictedAdvice: ['Do not encourage reckless intensity through pain or technical failure.', 'Do not prescribe injury rehab.', 'Do not give generic macro cuts that compromise training quality.'],
      recommendedLanguage: ['Use limiter-based coaching.', 'Separate pacing, skill, strength, and recovery.', 'Keep competition advice event-sequence specific.'],
    },
  }),
  sportDefaults({
    id: 'golf',
    name: 'Golf',
    emoji: '⛳',
    positions: ['Individual'],
    sortOrder: 11,
    attributes: [
      attribute('golf', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('golf', 'handedness', 'Handedness', 'singleSelect', 'athlete', 1, { options: options(['Right-Handed', 'Left-Handed']) }),
      attribute('golf', 'playingContext', 'Playing Context', 'singleSelect', 'competition', 2, { options: options(['Tournament', 'Practice Round', 'Qualifying', 'Match Play', 'Recreational']) }),
      attribute('golf', 'courseDemand', 'Course Demand', 'multiSelect', 'competition', 3, {
        options: options(['Tight Driving', 'Wind', 'Firm Greens', 'Long Course', 'Wedge Scoring', 'Putting Speed Control']),
      }),
      attribute('golf', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Pre-Shot Routine', 'Driver Commitment', 'Approach Precision', 'Putting Confidence', 'Bad-Shot Reset', 'Course Management']),
      }),
      attribute('golf', 'physicalLoadContext', 'Physical Load Context', 'singleSelect', 'recovery', 5, { options: options(['Walking 18', 'Walking 36', 'Cart', 'Travel Week', 'Strength Block']), includeInMacraContext: true }),
    ],
    metrics: [
      metric('golf', 'scoringAverage', 'Scoring Average', 'strokes', 'competition', 0),
      metric('golf', 'fairwaysHit', 'Fairways Hit', '%', 'competition', 1),
      metric('golf', 'greensInRegulation', 'Greens in Regulation', '%', 'competition', 2),
      metric('golf', 'puttsPerRound', 'Putts / Round', 'count', 'competition', 3),
      metric('golf', 'upAndDownPercentage', 'Up-and-Down %', '%', 'competition', 4),
      metric('golf', 'clubSpeed', 'Club Speed', 'mph', 'athlete', 5),
      metric('golf', 'shotDispersion', 'Shot Dispersion', 'yd', 'competition', 6),
    ],
    prompting: {
      noraContext: 'Coach golf through pre-shot routine, commitment, course management, emotional recovery after bad shots, tempo, and fatigue over long rounds. Avoid cluttering the athlete with swing thoughts.',
      macraNutritionContext: 'Golf nutrition should account for long rounds, walking load, heat, caffeine timing, and steady energy without gut heaviness. Hydration and small fueling windows matter even when intensity feels low.',
      riskFlags: ['swing-thought overload', 'bad-shot carryover', 'late-round fatigue', 'heat dehydration', 'caffeine jitters', 'travel disruption'],
      restrictedAdvice: ['Do not rebuild swing mechanics without coach context.', 'Do not overload the athlete with multiple technical cues.', 'Do not ignore course conditions or round duration.'],
      recommendedLanguage: ['Use calm, precise caddie-style language.', 'Separate target, commitment, routine, and acceptance.', 'Favor one cue or one decision at a time.'],
    },
  }),
  sportDefaults({
    id: 'lacrosse',
    name: 'Lacrosse',
    emoji: '🥍',
    positions: ['Attack', 'Midfield', 'Defense', 'Goalkeeper'],
    sortOrder: 12,
    attributes: [
      attribute('lacrosse', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('lacrosse', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('lacrosse', 'stickHand', 'Dominant Stick Hand', 'singleSelect', 'athlete', 2, { options: HANDEDNESS_OPTIONS }),
      attribute('lacrosse', 'phaseRole', 'Phase Role', 'singleSelect', 'athlete', 3, { options: options(['Dodger / Creator', 'Shooter', 'Two-Way Midfielder', 'Close Defender', 'LSM', 'Goalkeeper', 'Faceoff']) }),
      attribute('lacrosse', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Dodging Confidence', 'Shot Selection', 'Defensive Footwork', 'Clearing Composure', 'Communication', 'Ground Balls']),
      }),
      attribute('lacrosse', 'contactLoad', 'Contact Load', 'singleSelect', 'recovery', 5, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
    ],
    metrics: [
      metric('lacrosse', 'points', 'Points', 'count', 'competition', 0),
      metric('lacrosse', 'shotsOnGoal', 'Shots on Goal', '%', 'competition', 1),
      metric('lacrosse', 'groundBalls', 'Ground Balls', 'count', 'competition', 2),
      metric('lacrosse', 'causedTurnovers', 'Caused Turnovers', 'count', 'competition', 3),
      metric('lacrosse', 'savePercentage', 'Save %', '%', 'competition', 4),
      metric('lacrosse', 'sprintRepeatReadiness', 'Sprint Repeat Readiness', 'score', 'recovery', 5),
      metric('lacrosse', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach lacrosse through role, two-way sprint demand, stick skill under pressure, communication, contact tolerance, and fast emotional resets after turnovers or goals.',
      macraNutritionContext: 'Lacrosse nutrition should account for repeat sprint demand, contact load, tournament weekends, heat, and quick recovery between games or shifts.',
      riskFlags: ['repeat sprint fatigue', 'contact accumulation', 'turnover carryover', 'goalie confidence swings', 'heat stress', 'tournament underfueling'],
      restrictedAdvice: ['Do not flatten goalie and field-player demands.', 'Do not prescribe injury rehab.', 'Do not ignore contact and sprint density when discussing recovery.'],
      recommendedLanguage: ['Use shift, possession, and next-play language.', 'Translate mindset into communication and ground-ball actions.', 'Keep biomechanics tied to field movement.'],
    },
  }),
  sportDefaults({
    id: 'hockey',
    name: 'Hockey',
    emoji: '🏒',
    positions: ['Forward', 'Defenseman', 'Goalie'],
    sortOrder: 13,
    attributes: [
      attribute('hockey', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('hockey', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('hockey', 'shotHand', 'Shot Hand', 'singleSelect', 'athlete', 2, { options: options(['Left Shot', 'Right Shot']) }),
      attribute('hockey', 'usageRole', 'Usage Role', 'singleSelect', 'athlete', 3, { options: options(['Top Line / Pair', 'Middle Rotation', 'Checking Role', 'Power Play', 'Penalty Kill', 'Goalie Starter', 'Goalie Backup']) }),
      attribute('hockey', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['First-Step Quickness', 'Puck Decisions', 'Defensive Gap', 'Net-Front Battles', 'Goalie Tracking', 'Shift Reset']),
      }),
      attribute('hockey', 'contactLoad', 'Contact Load', 'singleSelect', 'recovery', 5, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
    ],
    metrics: [
      metric('hockey', 'timeOnIce', 'Time on Ice', 'min', 'competition', 0),
      metric('hockey', 'averageShiftLength', 'Average Shift Length', 'sec', 'competition', 1),
      metric('hockey', 'shotsOnGoal', 'Shots on Goal', 'count', 'competition', 2),
      metric('hockey', 'faceoffWinRate', 'Faceoff Win %', '%', 'competition', 3),
      metric('hockey', 'savePercentage', 'Save %', '%', 'competition', 4),
      metric('hockey', 'skateRepeatReadiness', 'Skate Repeat Readiness', 'score', 'recovery', 5),
      metric('hockey', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach hockey through role, shift length, puck decisions under pressure, contact load, skating repeatability, bench resets, and goalie-specific tracking/confidence when relevant.',
      macraNutritionContext: 'Hockey nutrition should reflect game density, cold-rink hydration blind spots, contact recovery, shift intensity, travel, and late-night games.',
      riskFlags: ['shift fatigue', 'contact accumulation', 'puck decision panic', 'goalie confidence swings', 'travel sleep disruption', 'underhydration in cold environments'],
      restrictedAdvice: ['Do not give goalie and skater advice as if they are the same role.', 'Do not prescribe concussion or injury guidance.', 'Do not ignore shift length and game density.'],
      recommendedLanguage: ['Use shift-by-shift and bench-reset language.', 'Be direct and role-specific.', 'Connect skating mechanics to repeatable game actions.'],
    },
  }),
  sportDefaults({
    id: 'gymnastics',
    name: 'Gymnastics',
    emoji: '🤸',
    positions: ['Individual'],
    sortOrder: 14,
    attributes: [
      attribute('gymnastics', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('gymnastics', 'discipline', 'Discipline', 'singleSelect', 'competition', 1, { options: options(['Women Artistic', 'Men Artistic', 'Rhythmic', 'Trampoline', 'Acro', 'Tumbling']) }),
      attribute('gymnastics', 'apparatusFocus', 'Apparatus Focus', 'multiSelect', 'competition', 2, {
        options: options(['Vault', 'Bars', 'Beam', 'Floor', 'Rings', 'Pommel Horse', 'Parallel Bars', 'High Bar', 'Trampoline']),
      }),
      attribute('gymnastics', 'skillStage', 'Skill Stage', 'singleSelect', 'athlete', 3, { options: options(['Learning', 'Connecting', 'Routine Ready', 'Competition Polishing', 'Return to Skill']) }),
      attribute('gymnastics', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Fear Block', 'Routine Confidence', 'Landing Control', 'Air Awareness', 'Beam Composure', 'Meet-Day Nerves']),
      }),
      attribute('gymnastics', 'recoverySensitivity', 'Recovery Sensitivity', 'singleSelect', 'recovery', 5, { options: options(['Low', 'Moderate', 'High', 'Growth / Load Sensitive', 'Return to Impact']), includeInMacraContext: true }),
    ],
    metrics: [
      metric('gymnastics', 'difficultyScore', 'Difficulty Score', 'score', 'competition', 0),
      metric('gymnastics', 'executionScore', 'Execution Score', 'score', 'competition', 1),
      metric('gymnastics', 'routineHitRate', 'Routine Hit Rate', '%', 'competition', 2),
      metric('gymnastics', 'stuckLandings', 'Stuck Landings', 'count', 'competition', 3),
      metric('gymnastics', 'skillAttempts', 'Skill Attempts', 'count', 'recovery', 4),
      metric('gymnastics', 'landingLoad', 'Landing Load', 'contacts', 'recovery', 5),
      metric('gymnastics', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach gymnastics through apparatus, skill stage, fear blocks, routine confidence, air awareness, landing load, and meet-day composure. Psychological safety and coach boundaries matter.',
      macraNutritionContext: 'Gymnastics nutrition should support growth, recovery, concentration, and high-skill training without reinforcing harmful body pressure. Flag restrictive patterns and prioritize safe fueling language.',
      riskFlags: ['fear block', 'landing load spike', 'restrictive eating pressure', 'growth and recovery sensitivity', 'overuse pain', 'meet anxiety', 'perfectionism spiral'],
      restrictedAdvice: ['Do not encourage weight loss or leanness as a performance shortcut.', 'Do not prescribe injury rehab or return-to-skill clearance.', 'Do not shame fear responses.'],
      recommendedLanguage: ['Use psychologically safe, precise language.', 'Separate courage, readiness, and technical progression.', 'Reinforce communication with coach and support staff.'],
    },
  }),
  sportDefaults({
    id: 'bodybuilding-physique',
    name: 'Bodybuilding / Physique',
    emoji: '🏆',
    positions: ['Men’s Physique', 'Classic Physique', 'Bodybuilding', 'Bikini', 'Figure', 'Wellness', 'Fitness'],
    sortOrder: 15,
    attributes: [
      {
        id: 'physique-division',
        key: 'division',
        label: 'Division',
        type: 'singleSelect',
        scope: 'competition',
        required: true,
        includeInNoraContext: true,
        includeInMacraContext: true,
        options: [
          { label: 'Men’s Physique', value: 'mens_physique' },
          { label: 'Classic Physique', value: 'classic_physique' },
          { label: 'Bodybuilding', value: 'bodybuilding' },
          { label: 'Bikini', value: 'bikini' },
          { label: 'Figure', value: 'figure' },
          { label: 'Wellness', value: 'wellness' },
          { label: 'Fitness', value: 'fitness' },
        ],
        sortOrder: 0,
      },
      {
        id: 'physique-competition-date',
        key: 'competitionDate',
        label: 'Competition Date',
        type: 'date',
        scope: 'competition',
        required: true,
        includeInNoraContext: true,
        includeInMacraContext: true,
        sortOrder: 1,
      },
      {
        id: 'physique-prep-phase',
        key: 'prepPhase',
        label: 'Prep Phase',
        type: 'singleSelect',
        scope: 'season',
        required: true,
        includeInNoraContext: true,
        includeInMacraContext: true,
        options: [
          { label: 'Improvement Season', value: 'improvement_season' },
          { label: 'Contest Prep', value: 'contest_prep' },
          { label: 'Peak Week', value: 'peak_week' },
          { label: 'Post-Show Reverse', value: 'post_show_reverse' },
          { label: 'Off-Season', value: 'off_season' },
        ],
        sortOrder: 2,
      },
      {
        id: 'physique-food-variance',
        key: 'foodVarianceTolerance',
        label: 'Food Variance Tolerance',
        type: 'singleSelect',
        scope: 'nutrition',
        required: false,
        includeInNoraContext: true,
        includeInMacraContext: true,
        options: [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' },
        ],
        sortOrder: 3,
      },
      {
        id: 'physique-approved-carb-sources',
        key: 'approvedCarbSources',
        label: 'Approved Carb Sources',
        type: 'multiSelect',
        scope: 'nutrition',
        required: false,
        includeInNoraContext: true,
        includeInMacraContext: true,
        options: [
          { label: 'Rice', value: 'rice' },
          { label: 'Cream of Rice', value: 'cream_of_rice' },
          { label: 'Potatoes', value: 'potatoes' },
          { label: 'Oats', value: 'oats' },
          { label: 'Rice Cakes', value: 'rice_cakes' },
        ],
        sortOrder: 4,
      },
      {
        id: 'physique-coach-macros-locked',
        key: 'coachMacrosLocked',
        label: 'Coach Macros Locked',
        type: 'boolean',
        scope: 'nutrition',
        required: false,
        includeInNoraContext: true,
        includeInMacraContext: true,
        sortOrder: 5,
      },
      attribute('bodybuilding-physique', 'posingPriority', 'Posing Priority', 'multiSelect', 'competition', 6, {
        options: options(['Front Pose', 'Back Pose', 'Transitions', 'Stage Presence', 'Mandatories', 'Routine Flow']),
      }),
      attribute('bodybuilding-physique', 'cardioLoad', 'Cardio Load', 'singleSelect', 'nutrition', 7, {
        options: options(['None', 'Low', 'Moderate', 'High', 'Peak Week Taper']),
        includeInMacraContext: true,
      }),
    ],
    metrics: [
      { id: 'physique-weeks-out', key: 'weeksOut', label: 'Weeks Out', unit: 'weeks', scope: 'competition', includeInNoraContext: true, sortOrder: 0 },
      { id: 'physique-stage-weight-target', key: 'stageWeightTarget', label: 'Stage Weight Target', unit: 'lb', scope: 'competition', includeInNoraContext: true, sortOrder: 1 },
      { id: 'physique-cardio-minutes', key: 'cardioMinutesPerWeek', label: 'Cardio Minutes / Week', unit: 'min', scope: 'nutrition', includeInNoraContext: true, sortOrder: 2 },
      metric('bodybuilding-physique', 'fastedWeightAverage', 'Fasted Weight Average', 'lb', 'nutrition', 3),
      metric('bodybuilding-physique', 'dailySteps', 'Daily Steps', 'steps', 'nutrition', 4),
      metric('bodybuilding-physique', 'posingMinutes', 'Posing Minutes', 'min', 'competition', 5),
      metric('bodybuilding-physique', 'waistMeasurement', 'Waist Measurement', 'in', 'competition', 6),
    ],
    prompting: {
      noraContext: 'Treat this athlete as a physique competitor. Always classify prep phase and show timeline before giving performance advice.',
      macraNutritionContext: 'In contest prep, peak week, or post-show reverse, audit macro targets against body size, show date, division, and food-variance tolerance. Favor predictable foods and controlled adjustments.',
      riskFlags: ['target mismatch', 'flatness', 'spillover', 'rebound overeating', 'digestion variance'],
      restrictedAdvice: ['Do not casually suggest fruit, whole grains, or generic starchy vegetables inside the near-show window unless already approved.'],
      recommendedLanguage: ['Use precise prep-coach language and explain when user-set targets should be questioned.'],
    },
  }),
  sportDefaults({
    id: 'other',
    name: 'Other',
    emoji: '🏅',
    positions: ['Individual'],
    sortOrder: 16,
    attributes: [
      attribute('other', 'sportDetail', 'Sport / Discipline Detail', 'text', 'athlete', 0, { placeholder: 'Describe the sport, event, or role' }),
      attribute('other', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 1, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('other', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 2, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('other', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 3, {
        options: options(['Confidence', 'Focus', 'Composure', 'Decision Making', 'Mechanics', 'Conditioning', 'Recovery']),
      }),
      attribute('other', 'movementDemand', 'Movement Demand', 'multiSelect', 'athlete', 4, {
        options: options(['Speed', 'Power', 'Endurance', 'Agility', 'Precision', 'Contact', 'Mobility']),
      }),
      attribute('other', 'trainingLoadPattern', 'Training Load Pattern', 'singleSelect', 'recovery', 5, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
    ],
    metrics: [
      metric('other', 'competitionDate', 'Competition Date', 'date', 'competition', 0),
      metric('other', 'trainingLoad', 'Training Load', 'score', 'recovery', 1),
      metric('other', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 2),
      metric('other', 'readinessScore', 'Readiness Score', 'score', 'recovery', 3),
      metric('other', 'performanceScore', 'Performance Score', 'score', 'competition', 4),
    ],
    prompting: {
      noraContext: 'When sport is Other, ask for the discipline, role, competition phase, movement demands, and mental performance demand before giving precise coaching.',
      macraNutritionContext: 'For uncategorized sports, audit fueling against training load, competition duration, body composition pressure, heat, travel, and recovery needs before making nutrition recommendations.',
      riskFlags: ['missing sport context', 'unknown movement demand', 'unknown competition phase', 'generic advice risk', 'unverified injury context'],
      restrictedAdvice: ['Do not pretend sport-specific certainty when the sport is unknown.', 'Ask one clarifying question when context is missing.', 'Do not provide injury diagnosis or return-to-play clearance.'],
      recommendedLanguage: ['Be transparent about assumptions.', 'Gather sport, role, phase, and load before narrowing advice.', 'Keep guidance adaptable until sport-specific configuration exists.'],
    },
  }),
];

const slugifySportId = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || `sport-${Date.now()}`;
};

const normalizePositions = (value: unknown): string[] => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/)
      : [];

  const seen = new Set<string>();
  const normalized = rawValues.reduce<string[]>((acc, entry) => {
    const position = normalizeString(entry);
    if (!position) return acc;

    const key = position.toLowerCase();
    if (seen.has(key)) return acc;

    seen.add(key);
    acc.push(position);
    return acc;
  }, []);

  return normalized.length > 0 ? normalized : ['Individual'];
};

const normalizeList = (value: unknown): string[] => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/)
      : [];

  const seen = new Set<string>();
  return rawValues.reduce<string[]>((acc, entry) => {
    const item = normalizeString(entry);
    if (!item) return acc;
    const key = item.toLowerCase();
    if (seen.has(key)) return acc;
    seen.add(key);
    acc.push(item);
    return acc;
  }, []);
};

const ATTRIBUTE_TYPES: PulseCheckSportAttributeType[] = ['text', 'number', 'date', 'boolean', 'singleSelect', 'multiSelect'];
const ATTRIBUTE_SCOPES: PulseCheckSportAttributeScope[] = ['athlete', 'team', 'season', 'competition', 'nutrition', 'recovery'];

const normalizeAttributeOptions = (value: unknown): PulseCheckSportAttributeOption[] => {
  const entries = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/)
      : [];

  const seen = new Set<string>();
  return entries.reduce<PulseCheckSportAttributeOption[]>((acc, entry) => {
    let label = '';
    let optionValue = '';

    if (typeof entry === 'string') {
      label = entry.trim();
      optionValue = normalizeOptionValue(label);
    } else if (entry && typeof entry === 'object') {
      const candidate = entry as Record<string, unknown>;
      label = normalizeString(candidate.label);
      optionValue = normalizeString(candidate.value) || normalizeOptionValue(label);
    }

    if (!label || !optionValue) return acc;
    const key = optionValue.toLowerCase();
    if (seen.has(key)) return acc;
    seen.add(key);
    acc.push({ label, value: optionValue });
    return acc;
  }, []);
};

const normalizeAttributes = (value: unknown): PulseCheckSportAttributeDefinition[] => {
  if (!Array.isArray(value)) return [];

  const seenKeys = new Set<string>();
  return value.reduce<PulseCheckSportAttributeDefinition[]>((acc, entry, index) => {
    if (!entry || typeof entry !== 'object') return acc;
    const candidate = entry as Record<string, unknown>;
    const label = normalizeString(candidate.label);
    const key = normalizeString(candidate.key) || normalizeOptionValue(label);
    if (!label || !key) return acc;
    const normalizedKey = key.toLowerCase();
    if (seenKeys.has(normalizedKey)) return acc;
    seenKeys.add(normalizedKey);

    const rawType = normalizeString(candidate.type) as PulseCheckSportAttributeType;
    const rawScope = normalizeString(candidate.scope) as PulseCheckSportAttributeScope;
    const type = ATTRIBUTE_TYPES.includes(rawType) ? rawType : 'text';
    const scope = ATTRIBUTE_SCOPES.includes(rawScope) ? rawScope : 'athlete';
    const options = normalizeAttributeOptions(candidate.options);

    acc.push({
      id: normalizeString(candidate.id) || `${key}-${index}`,
      key,
      label,
      type,
      scope,
      required: Boolean(candidate.required),
      includeInNoraContext: candidate.includeInNoraContext !== false,
      includeInMacraContext: Boolean(candidate.includeInMacraContext),
      options: type === 'singleSelect' || type === 'multiSelect' ? options : [],
      placeholder: normalizeString(candidate.placeholder),
      sortOrder: typeof candidate.sortOrder === 'number' && Number.isFinite(candidate.sortOrder) ? candidate.sortOrder : index,
    });

    return acc;
  }, []).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
};

const normalizeMetrics = (value: unknown): PulseCheckSportMetricDefinition[] => {
  if (!Array.isArray(value)) return [];

  const seenKeys = new Set<string>();
  return value.reduce<PulseCheckSportMetricDefinition[]>((acc, entry, index) => {
    if (!entry || typeof entry !== 'object') return acc;
    const candidate = entry as Record<string, unknown>;
    const label = normalizeString(candidate.label);
    const key = normalizeString(candidate.key) || normalizeOptionValue(label);
    if (!label || !key) return acc;
    const normalizedKey = key.toLowerCase();
    if (seenKeys.has(normalizedKey)) return acc;
    seenKeys.add(normalizedKey);
    const rawScope = normalizeString(candidate.scope) as PulseCheckSportAttributeScope;

    acc.push({
      id: normalizeString(candidate.id) || `${key}-${index}`,
      key,
      label,
      unit: normalizeString(candidate.unit),
      scope: ATTRIBUTE_SCOPES.includes(rawScope) ? rawScope : 'athlete',
      includeInNoraContext: candidate.includeInNoraContext !== false,
      sortOrder: typeof candidate.sortOrder === 'number' && Number.isFinite(candidate.sortOrder) ? candidate.sortOrder : index,
    });

    return acc;
  }, []).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
};

const normalizePrompting = (value: unknown): PulseCheckSportPromptingConfiguration => {
  if (!value || typeof value !== 'object') return {};
  const candidate = value as Record<string, unknown>;
  return {
    noraContext: normalizeString(candidate.noraContext),
    macraNutritionContext: normalizeString(candidate.macraNutritionContext),
    riskFlags: normalizeList(candidate.riskFlags),
    restrictedAdvice: normalizeList(candidate.restrictedAdvice),
    recommendedLanguage: normalizeList(candidate.recommendedLanguage),
  };
};

const sortSports = (sports: PulseCheckSportConfigurationEntry[]) =>
  [...sports].sort((left, right) => {
    if (left.sortOrder === right.sortOrder) {
      return left.name.localeCompare(right.name);
    }

    return left.sortOrder - right.sortOrder;
  });

const cloneSports = (sports: PulseCheckSportConfigurationEntry[]) =>
  sports.map((sport) => ({
    ...sport,
    positions: [...sport.positions],
    attributes: (sport.attributes || []).map((attribute) => ({
      ...attribute,
      options: (attribute.options || []).map((option) => ({ ...option })),
    })),
    metrics: (sport.metrics || []).map((metric) => ({ ...metric })),
    prompting: {
      ...(sport.prompting || {}),
      riskFlags: [...(sport.prompting?.riskFlags || [])],
      restrictedAdvice: [...(sport.prompting?.restrictedAdvice || [])],
      recommendedLanguage: [...(sport.prompting?.recommendedLanguage || [])],
    },
  }));

const normalizeSportArray = (value: unknown): PulseCheckSportConfigurationEntry[] => {
  if (!Array.isArray(value)) {
    return getDefaultPulseCheckSports();
  }

  const seenNames = new Set<string>();
  const normalized = value.reduce<PulseCheckSportConfigurationEntry[]>((acc, entry, index) => {
    if (!entry || typeof entry !== 'object') return acc;

    const candidate = entry as Record<string, unknown>;
    const name = normalizeString(candidate.name);
    if (!name) return acc;

    const normalizedName = name.toLowerCase();
    if (seenNames.has(normalizedName)) return acc;
    seenNames.add(normalizedName);

    const parsedSortOrder =
      typeof candidate.sortOrder === 'number' && Number.isFinite(candidate.sortOrder)
        ? candidate.sortOrder
        : index;

    acc.push({
      id: normalizeString(candidate.id) || slugifySportId(name),
      name,
      emoji: normalizeString(candidate.emoji) || '🏅',
      positions: normalizePositions(candidate.positions),
      sortOrder: parsedSortOrder,
      schemaVersion: typeof candidate.schemaVersion === 'number' && Number.isFinite(candidate.schemaVersion)
        ? candidate.schemaVersion
        : 1,
      attributes: normalizeAttributes(candidate.attributes),
      metrics: normalizeMetrics(candidate.metrics),
      prompting: normalizePrompting(candidate.prompting),
    });

    return acc;
  }, []);

  if (normalized.length === 0) {
    return getDefaultPulseCheckSports();
  }

  return sortSports(normalized).map((sport, index) => ({
    ...sport,
    sortOrder: index,
  }));
};

export const getDefaultPulseCheckSports = () => cloneSports(DEFAULT_PULSECHECK_SPORTS);

export const fetchPulseCheckSportConfiguration = async (): Promise<PulseCheckSportConfigurationEntry[]> => {
  try {
    const snapshot = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOCUMENT));
    if (!snapshot.exists()) {
      return getDefaultPulseCheckSports();
    }

    return normalizeSportArray(snapshot.data()?.sports);
  } catch (error) {
    console.error('[PulseCheckSportConfig] Failed to fetch sport configuration:', error);
    return getDefaultPulseCheckSports();
  }
};

export const savePulseCheckSportConfiguration = async (
  sports: PulseCheckSportConfigurationEntry[]
): Promise<PulseCheckSportConfigurationEntry[]> => {
  const normalizedSports = normalizeSportArray(sports).map((sport, index) => ({
    ...sport,
    sortOrder: index,
  }));

  await setDoc(
    doc(db, CONFIG_COLLECTION, CONFIG_DOCUMENT),
    {
        sports: normalizedSports.map((sport) => ({
          id: sport.id,
          name: sport.name,
          emoji: sport.emoji,
          positions: sport.positions,
          sortOrder: sport.sortOrder,
          schemaVersion: sport.schemaVersion || 1,
          attributes: normalizeAttributes(sport.attributes),
          metrics: normalizeMetrics(sport.metrics),
          prompting: normalizePrompting(sport.prompting),
        })),
      updatedAt: serverTimestamp(),
      updatedBySource: 'human-ui',
      updatedByUid: auth.currentUser?.uid || '',
      updatedByEmail: auth.currentUser?.email || '',
    },
    { merge: true }
  );

  return normalizedSports;
};
