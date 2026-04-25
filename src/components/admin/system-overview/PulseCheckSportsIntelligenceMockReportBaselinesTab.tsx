import React from 'react';
import {
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
  ['Team Lens', 'One paragraph: what changed, what matters this week, and where coaches should focus attention.'],
  ['Sport-Native KPIs', 'Only KPIs from sport config or verified team systems. Never raw vendor scores as coach judgment.'],
  ['Athlete Rows', 'Name, role/position, readiness band, confidence tier, evidence refs, missing inputs, recommendation, copy posture.'],
  ['Watchlist', 'Rare, reviewed list of athletes or role groups needing observation, not a punitive ranking.'],
  ['Coach Adjustment', 'Practice, recovery, communication, pre-competition, or nutrition-context action framed in sport language.'],
  ['Trace', 'Internal-only provenance: source lanes, stale/missing data, confidence propagation, threshold path.'],
];

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
    weeklyFocus: ['Pre-shot routine', 'Course management', 'Bad-shot recovery', 'Late-round fatigue and heat'],
    gameDayFocus: ['Commitment and target clarity', 'Caffeine/hydration timing', 'Walking load', 'Putting confidence'],
    watchSignals: ['Bad-shot carryover', 'Sleep disruption before qualifying', 'Late-round dispersion increase', 'Caffeine jitters'],
    coachActions: ['Keep cue count to one', 'Reinforce target/routine/acceptance', 'Plan steady small fueling windows'],
    language: 'Caddie-style language: target, commitment, routine, acceptance, tempo, course management.',
    avoid: ['Swing rebuilds', 'Multiple technical cues', 'Ignoring course conditions and round duration'],
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
          Mock report outline
        </span>
      </div>
    </summary>

    <div className="mt-5 space-y-4">
      <DataTable
        columns={['Report Area', 'Baseline Expectation']}
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
    </div>
  </details>
);

const PulseCheckSportsIntelligenceMockReportBaselinesTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Sports Intelligence"
        title="Mock Report Baselines"
        version="Version 0.1 | April 25, 2026"
        summary="Companion baseline for what Sports Intelligence reports should look like across every sport currently present in the PulseCheck sport configuration. These are not final generated reports; they are expected report shapes, sport-native language constraints, KPI anchors, and guardrails for implementation and review."
        highlights={[
          {
            title: 'All Configured Sports Covered',
            body: 'Each collapsed sport section maps to the current default PulseCheck sport configuration and defines what weekly and game-day report drafts should include.',
          },
          {
            title: 'Baseline, Not Dashboard',
            body: 'The report pattern stays narrative and coach-actionable. KPIs support the story; they do not replace the interpretation.',
          },
          {
            title: 'Review-Ready Shape',
            body: 'Each sport makes watch signals, coach actions, language posture, and avoid rules explicit so pilot reviewers know what acceptable copy looks like.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Report-shape companion for Sports Intelligence implementation. Defines mock weekly, game-day, and alert-candidate expectations before report generation is built."
        sourceOfTruth="This page owns baseline report outlines by sport. The Aggregation + Inference Contract owns scoring, thresholds, confidence, and payload shape. The Architecture & Product Boundaries spec owns where reports sit in the system."
        masterReference="Sport coverage follows the default `PulseCheckSportConfigurationEntry` list in `src/api/firebase/pulsecheckSportConfig.ts`. If admins add a sport in `/admin/pulsecheckSportConfiguration`, this page should receive a matching collapsed mock-report baseline before coach delivery."
        relatedDocs={[
          'Sports Intelligence Layer',
          'Aggregation + Inference Contract',
          'Sport Configuration Registry',
          'Coach Journey',
          'Pilot Outcome Metrics Contract',
        ]}
      />

      <SectionBlock icon={FileText} title="Universal Mock Report Shape">
        <DataTable columns={['Surface', 'Audience', 'Mock Contents', 'Release Posture']} rows={REPORT_STRUCTURE} />
        <DataTable columns={['Block', 'Required Shape']} rows={REPORT_ROW_SHAPE} />
      </SectionBlock>

      <SectionBlock icon={Gauge} title="Configuration Coverage">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Covered In This Baseline"
            accent="green"
            body={`${SPORTS.length} configured sports: ${SPORTS.map((sport) => sport.name).join(', ')}.`}
          />
          <InfoCard
            title="Config Gap To Resolve"
            accent="amber"
            body="Bowling appears in the UMES pilot scope language, but it is not present in the current default sport configuration. Add Bowling through the sport configuration registry before locking a bowling report baseline."
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
                'Every game-day report uses the sport-specific readiness lens and avoids prohibited language for that sport.',
                'Every watchlist candidate carries evidence refs, confidence tier, missing inputs, and human review status.',
                'Pilot reviewers can compare generated copy against this mock baseline before coach delivery.',
                'New sports added through configuration are not considered report-ready until a matching mock-report baseline exists.',
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
