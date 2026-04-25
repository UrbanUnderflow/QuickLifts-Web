import React from 'react';
import {
  Activity,
  Gauge,
  Layers,
  ShieldCheck,
  Trophy,
  Workflow,
} from 'lucide-react';
import {
  BulletList,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

// ──────────────────────────────────────────────────────────────────────────────
// Sport Load Model Spec
//
// Per-sport load model that blends device-derived primitives + prescribed
// comparison + context modifiers into a sport-relevant load score with
// sport-tolerable thresholds. Lives on the sport reportPolicy alongside
// kpiRefs / dimensionMap / coachLanguageTranslations so a new sport is an
// admin operation, not a deploy.
// ──────────────────────────────────────────────────────────────────────────────

const PRINCIPLE_CARDS = [
  {
    title: 'Same primitives, sport-specific blend',
    accent: 'blue' as const,
    body: 'Every device flows through the same Health Context Source Record. The difference between sports is which primitives matter, how they\'re weighted, and what counts as "high" — not the data shape.',
  },
  {
    title: 'Device sees what happened',
    accent: 'green' as const,
    body: 'The athlete logs nothing. Reps, sprints, jumps, walking distance, swing count, intensity zones — all derived from continuous biometrics. The coach uploads the prescribed plan once a week so the model can compare execution vs. intent.',
  },
  {
    title: 'Sport-tolerable, not generic',
    accent: 'amber' as const,
    body: 'The same acute:chronic ratio that means "yellow flag" for a sprinter is normal range for a golfer. Thresholds and decay live per sport so coach language stays sport-native.',
  },
];

const PRIMITIVE_SOURCES = [
  ['Sprint reps', 'GPS speed > sport threshold + duration > 2s', 'Track sprinter, soccer, lacrosse, basketball'],
  ['Sprint distance', 'GPS distance accumulated above sport speed threshold', 'Track sprinter, soccer, football, lacrosse'],
  ['HR-zone time', 'Seconds in HR zones Z1–Z5 (vendor-harmonized 0-100 scale)', 'All sports — load denominator'],
  ['Internal load (HR-derived)', 'TRIMP-style integration of HR-zone time', 'All sports — universal internal load proxy'],
  ['Session RPE', 'Athlete-reported 1-10 effort score', 'All sports — supporting input only, never primary'],
  ['Jump count', 'Vertical accelerometer Z-spike count above sport threshold', 'Basketball, volleyball, gymnastics'],
  ['Impact / collision load', 'Accelerometer impact-magnitude integration; helmet IMU when available', 'Football, lacrosse, hockey, wrestling'],
  ['Walking distance', 'GPS distance at sustained low speed (1-2 m/s) over multi-hour activity', 'Golf'],
  ['Swing reps', 'Accelerometer Z-spike with sport-characteristic signature', 'Golf, baseball, softball, tennis'],
  ['Lateral acceleration count', 'Accelerometer X/Y deflection count above threshold', 'Basketball, volleyball, tennis'],
  ['Block / round duration', 'Activity duration matched against sport-typical block lengths', 'Bowling, golf, tennis'],
  ['Heat exposure', 'Skin temp + ambient (when device exposes) × duration', 'Golf, soccer, T&F (distance), football camp'],
  ['Sleep efficiency', 'Vendor-harmonized sleep score, with hard-day-eve weighting', 'All sports — recovery debt input'],
  ['HRV trend', 'rmssdMs rolling 7d vs. 28d baseline', 'All sports — recovery posture input'],
  ['Travel days', 'GPS-detected location change beyond home venue / hotel signature', 'All sports — context modifier'],
  ['Prescribed deviation', 'session_record.prescribedComparison delta (executed vs. prescribed reps / pace / rest)', 'All sports — when a plan is uploaded'],
];

const SPORT_PROFILES = [
  ['Track — Sprinter', 'sprintReps × distance, neuromuscular fatigue (jump-height delta), session RPE, HR-zone time', '1.4', 'Fast (3–5 days)', '"looking heavy in the legs", "speed felt off"'],
  ['Track — Distance', 'Weekly mileage in HR zones, time in tempo / threshold zones, sleep, heat exposure', '1.6', 'Medium (5–7 days)', '"the back-half of the volume block is showing", "long run hit harder than usual"'],
  ['Track — Throws / Jumps', 'Contact / impact load, technical-rep count, peak force, landing load', '1.3', 'Slow (7–10 days)', '"approaches feel heavy", "release timing slipped"'],
  ['Golf', 'Walking distance, swing reps, round duration, heat exposure, sleep on tournament eve', '1.7', 'Fast', '"the grind of walking 18 is showing", "tempo off the back nine"'],
  ['Basketball', 'Active minutes × intensity, jump count, repeat-sprint readiness, lateral-accel count, collision load if available', '1.5', 'Medium', '"minutes are catching up", "legs looked heavy on the late-clock reads"'],
  ['Bowling', 'Shots × block length, grip strain proxy, travel days, between-block recovery', '1.6', 'Medium', '"repeating the same shot got harder late", "Day 2 stamina is the read"'],
  ['Football', 'Snap-count proxy, collision load (helmet IMU when present), position-specific accelerometer signature', '1.4', 'Slow (7–10 days)', '"contact load piling on the LB unit", "padded reps are catching up"'],
  ['Soccer', 'High-speed runs, sprint count, total distance, position-aware load profile', '1.5', 'Medium', '"high-speed running is climbing past recovery", "midfield three is heavy"'],
  ['Volleyball', 'Jump count, approach jump intensity, set-and-block reps, shoulder volume proxy', '1.5', 'Medium', '"jump count is climbing past the line", "blocking volume is catching up"'],
  ['Wrestling', 'Mat time × intensity, grip readiness, weigh-in proximity, hydration + weight delta', '1.4', 'Medium', '"grip is tight going into the cut", "mat time is piling on"'],
  ['Tennis', 'Match duration, surface load, heat exposure, between-point recovery', '1.6', 'Fast', '"the heat block is showing", "long-match recovery hasn\'t caught up"'],
  ['Baseball', 'Pitch count + innings (P/C), throwing volume (position), at-bat density', '1.4', 'Slow for arms; medium otherwise', '"arm-care window is tight", "throwing volume is climbing"'],
  ['Softball', 'Pitch count, throwing volume, tournament-day density, all-day fueling proxy', '1.5', 'Medium', '"tournament fatigue is showing", "Day 2 reaction is off"'],
  ['Hockey', 'Shift count × shift length, skate repeat readiness, contact load', '1.5', 'Medium', '"shift length is creeping up", "contact accumulation is showing"'],
  ['Lacrosse', 'Repeat sprint readiness, contact load, position-aware sprint demand', '1.5', 'Medium', '"two-way sprint demand is climbing", "contact is piling on"'],
  ['Crossfit', 'Mixed-modal density, grip fatigue, gymnastics volume, monostructural pace', '1.6', 'Fast', '"grip is going into the qualifier hot", "density block is catching up"'],
  ['Gymnastics', 'Landing load, skill-attempt count, apparatus-specific contact volume, growth/age sensitivity', '1.3', 'Slow', '"landing load is past the comfortable range", "beam attempts are catching up"'],
  ['Bodybuilding / Physique', 'Cardio minutes, daily steps, posing minutes, fasted-weight trend, weeks-out proximity', '1.4', 'Medium', '"prep volume is on track", "post-show reverse is settling"'],
];

const LOAD_SCORE_PIPELINE = [
  ['1. Pull session primitives', 'Read each session_record\'s detected blocks + prescribed-comparison delta + device coverage', 'Per session, per athlete'],
  ['2. Apply sport blend', 'Weight each primitive per the sport\'s loadModel; produce per-session load_au (load arbitrary units)', 'Per session, per athlete'],
  ['3. Roll up acute / chronic', 'Acute = trailing 7 days; chronic = trailing 28 days, both in load_au', 'Per athlete, per day'],
  ['4. Compute acute:chronic ratio', 'acuteLoad / chronicLoad', 'Per athlete, per day'],
  ['5. Apply context modifiers', 'Heat × duration, travel days, time-zone shift, schedule density — per sport contextModifiers', 'Per athlete, per day'],
  ['6. Apply recovery debt', 'Sleep deficit + HRV-below-baseline streak push the athlete\'s effective load up', 'Per athlete, per day'],
  ['7. Map to load band', 'Compare adjusted score to sport thresholds (low / moderate / high / concerning)', 'Per athlete, per day'],
  ['8. Translate to coach voice', 'Pull the matching phrase from the sport\'s coachLanguageTranslations + signal-state combination', 'Per athlete, per day — feeds the report'],
];

const PRESCRIBED_COMPARISON_INPUTS = [
  ['Executed reps fraction', 'detected_reps / prescribed_reps', '< 0.85 = "stopped early" signal; > 1.15 = "added reps" signal'],
  ['Pace deviation', '(detected_pace - prescribed_pace) / prescribed_pace', '> +5% slower = "ran the reps softer"; > -5% faster = "pushed past prescription"'],
  ['Rest deviation', '(detected_rest - prescribed_rest) / prescribed_rest', '< -20% = "compressed the rest"; > +30% = "stretched the rest"'],
  ['Volume deviation', '(detected_volume - prescribed_volume) / prescribed_volume', 'Catches "stopped early" or "did extra"'],
  ['Modality drift', 'detected_modality vs. prescribed_modality (interval / steady / strength / etc.)', 'Catches "tempo run when an easy day was prescribed" — high-impact on load story'],
];

const COACH_LANGUAGE_BAND_TABLE = [
  ['Low', 'Comfortably under sport-tolerable load', '"Plenty of room", "fresh"'],
  ['Moderate', 'Within typical training week, no flags', '"On track", "solid week of work"'],
  ['High', 'Approaching sport-tolerable ceiling', '"Heavy week", "the volume is showing"'],
  ['Concerning', 'Past sport-tolerable ceiling OR sustained high without recovery', '"Looking heavy in the legs", "we should pull a rep"'],
];

const SCHEMA_FIELD = [
  ['loadModel', 'Sport-specific load formula and thresholds', 'Lives on `PulseCheckSportReportPolicy.loadModel`'],
  ['loadModel.primitives[]', 'Each primitive: { key, weight, source, filter? }', 'Defines what to pull from session_records and how to weight it'],
  ['loadModel.thresholds', '{ low, moderate, high, concerning } in 0–1 normalized space', 'Per sport — what counts as "high" for a sprinter ≠ a golfer'],
  ['loadModel.acwrCeiling', 'Sport-tolerable acute:chronic ratio', 'Sprinter ~1.4, golfer ~1.7'],
  ['loadModel.decayHalfLifeDays', 'How fast the load score recovers without new sessions', 'Sprinter fast (3-5d), throws slow (7-10d)'],
  ['loadModel.recoveryDebtFloor', 'How negative the score can go before "deload" warning', '"You\'ve given the legs back enough room — push it again"'],
  ['loadModel.contextModifiers[]', 'Sport-specific environmental + schedule modifiers', 'Heat, travel, congested schedule, etc.'],
  ['loadModel.prescribedComparisonWeights', 'How much prescribed-vs-executed deltas adjust the load score', 'Sport-specific — track interval matters more than golf swing count'],
];

const FAILURE_MODES = [
  ['Athlete missed device wear for two days', 'Load score is held at the last known value and flagged as "leaning on his last good days". Reviewer screen tells coach in coach voice. Coach report omits hard claims about load for that athlete this week.'],
  ['Prescribed plan is missing for the week', 'Load model still produces a score from device data alone. Read confidence drops one tier. Coach report uses lighter claims and the reviewer screen says "drop the practice plan and we\'ll tighten this read." Never silent.'],
  ['Athlete logged an unscheduled extra session', 'Counted in load (no surprise spike that breaks the model). session_record carries `unscheduledActivity: true`. Coach sees "extra session yesterday — counted in his load."'],
  ['New sport added with no calibrated thresholds yet', 'Load model produces a score using the inherited reportPolicyDefaults; thresholds are surfaced as "early baselining". Reviewer screen explicitly says "we\'re still learning what \'high\' looks like for [sport] — first 4 weeks read lighter on purpose."'],
  ['Two athletes on the same team have wildly different baselines', 'All thresholds are athlete-relative within sport — what counts as "high load" for the freshman walk-on is a different ceiling than for the all-conference starter. Sport thresholds set the band; per-athlete baselines set the line within it.'],
];

const EXIT_CRITERIA = [
  '`PulseCheckSportReportPolicy.loadModel` is populated for every configured sport (starting with the initial pilot sports — basketball, golf, bowling, track & field) with primitives, weights, thresholds, decay, and context modifiers, and is review-only on the Sports Intelligence Layer admin page (edits ship through code).',
  'Load score is reproducible — the same athlete\'s same week produces the same number twice.',
  'Per-sport load bands map cleanly to the coach-voice phrases in coachLanguageTranslations (no untranslated "ACWR > 1.5" leaking to the report).',
  'Prescribed-vs-executed deltas materially adjust the load score (executing 4 of 6 reps reads differently than executing 6 of 6 cleanly).',
  'Missing-device-wear and missing-prescribed-plan cases produce a usable but lighter read instead of breaking — and the reviewer screen says so in coach voice.',
  'A new sport added through the admin console produces a load score from day one using inherited defaults, with the reviewer screen flagging "still baselining".',
];

const PulseCheckSportLoadModelSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Sports Intelligence"
        title="Sport Load Model"
        version="Version 0.1 | April 25, 2026"
        summary="Per-sport load model that turns device-derived session primitives + prescribed-comparison deltas + context modifiers into a sport-relevant load score with sport-tolerable thresholds. Same data shape across every sport; per-sport blend determines what counts as 'high' for a sprinter vs. a golfer vs. a basketball starter. Lives on the sport reportPolicy and is edited in code; the Sports Intelligence Layer admin page surfaces it as a review-only panel so coefficient mistakes can never reach a coach report from a UI typo."
        highlights={PRINCIPLE_CARDS}
      />

      <RuntimeAlignmentPanel
        role="Per-sport load formula that consumes session_records (from Session Detection + Matching) plus context modifiers (heat, travel, schedule density, recovery debt) and emits a per-athlete, per-day load score in a sport-relevant band."
        sourceOfTruth="This page owns the load primitive catalog, the per-sport blend profile, the load-score pipeline, the prescribed-comparison weighting, and the loadModel schema field on PulseCheckSportReportPolicy. Aggregation + Inference Contract owns thresholds for downstream confidence; sport reportPolicy owns the actual coefficients."
        masterReference="loadModel lives on `PulseCheckSportReportPolicy.loadModel` in `pulsecheckSportConfig.ts`. Edits ship through code; the Sports Intelligence Layer admin page (`/admin/pulsecheckSportConfiguration`) renders it as a review-only panel so admins can audit per-sport coefficients without risk of in-UI mistakes. Per-athlete daily load score lands at `athletes/{athleteId}/loadScores/{dayKey}`."
        relatedDocs={[
          'Sports Intelligence Layer',
          'Aggregation + Inference Contract',
          'Session Detection + Matching',
          'Nora Context Capture',
          'Sport Configuration Registry',
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
        ]}
      />

      <SectionBlock icon={Layers} title="Primitive Catalog (What The Device Captures)">
        <InfoCard
          title="Universal Surface, Sport-Specific Blend"
          accent="blue"
          body={'Every primitive is sourced from the universal Health Context Source Record. The sport doesn\'t change what we capture; it changes which primitives we weight and how we band the resulting score.'}
        />
        <DataTable columns={['Primitive', 'How It\'s Derived From The Device', 'Sports That Use It Heavily']} rows={PRIMITIVE_SOURCES} />
      </SectionBlock>

      <SectionBlock icon={Trophy} title="Per-Sport Load Profiles">
        <InfoCard
          title="What's In Each Profile"
          accent="green"
          body="Each sport carries: a primitive blend (which signals are weighted heavy), a sport-tolerable acute:chronic ceiling, a decay rate, and the coach-voice phrases that fire when load crosses each band. These come from coaching-staff conversations + sport-science literature, not vibes."
        />
        <DataTable
          columns={['Sport', 'Heaviest Primitives', 'ACWR Ceiling', 'Decay', 'Coach-Voice Phrases When Load Is Concerning']}
          rows={SPORT_PROFILES}
        />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Load Score Pipeline">
        <DataTable columns={['Step', 'What Happens', 'Granularity']} rows={LOAD_SCORE_PIPELINE} />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Prescribed Comparison Weighting (When A Plan Exists)">
        <InfoCard
          title="Why This Block Matters"
          accent="amber"
          body="When the coach has dropped a practice plan, the load model can do more than count volume — it can speak to intent. Same total volume reads very differently depending on whether the athlete cleanly executed the prescribed structure or compressed rest, ran the reps softer, or stopped early. These deltas adjust the load score so the report can speak to the why, not just the how-much."
        />
        <DataTable
          columns={['Comparison Input', 'Formula', 'Coach-Voice Trigger']}
          rows={PRESCRIBED_COMPARISON_INPUTS}
        />
      </SectionBlock>

      <SectionBlock icon={Gauge} title="Load Bands → Coach Voice">
        <InfoCard
          title="Coach-Voice Rule"
          accent="amber"
          body={'The coach never sees "acute:chronic ratio" or "load_au" or "score: 0.78". The system maps every load band to coach-voice phrases — pulled from the sport\'s coachLanguageTranslations — so the report reads like a thoughtful note, not a metric printout. The internal numbers exist for the reviewer screen and audit trail; they do not surface in the coach report.'}
        />
        <DataTable columns={['Band', 'What It Means', 'Coach-Voice Phrases']} rows={COACH_LANGUAGE_BAND_TABLE} />
      </SectionBlock>

      <SectionBlock icon={Layers} title="Schema (`PulseCheckSportReportPolicy.loadModel`)">
        <DataTable columns={['Field', 'Purpose', 'Lives In']} rows={SCHEMA_FIELD} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Failure Modes (What Breaks, What We Do)">
        <DataTable columns={['Situation', 'How It\'s Handled']} rows={FAILURE_MODES} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Build Exit Criteria">
        <InfoCard
          title="Done When"
          accent="green"
          body={<BulletList items={EXIT_CRITERIA} />}
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckSportLoadModelSpecTab;
