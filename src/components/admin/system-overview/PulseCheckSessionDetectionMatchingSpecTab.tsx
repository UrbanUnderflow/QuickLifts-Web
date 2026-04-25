import React from 'react';
import {
  Activity,
  GitMerge,
  Layers,
  RadioTower,
  ShieldCheck,
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
// Session Detection + Matching Spec
//
// The bridge between what the device saw and what the coach planned. Detects
// training/competition sessions from biometric signal patterns, matches them
// to the prescribed_session and team_schedule_event records produced by the
// Nora Context Capture layer, and emits a session_record that the load model
// and report generator consume downstream.
// ──────────────────────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  ['1. Detect', 'Continuous device stream → activity-segmenter splits the day into candidate sessions when HR/movement crosses thresholds.', 'Sport-aware threshold profiles (sprinter: speed > 7 m/s; distance: HR > Z2 for 10+ min; basketball: sustained HR + jump cluster).'],
  ['2. Classify', 'Each candidate session gets a session-type guess from its biometric signature (interval / steady / strength / game / scrimmage / recovery / unscheduled).', 'Classifier uses sport-aware feature templates; outputs class + a "this guess is solid / this guess is rough" tier.'],
  ['3. Match', 'Detected session is bound to a `team_schedule_event` and (when present) a `prescribed_session` from the Nora Context Capture layer.', 'Match by time-window overlap + sport context + (when GPS available) location proximity.'],
  ['4. Compare', 'When a `prescribed_session` matched, the executor compares device-detected blocks against prescribed blocks (executed 4 of 6 reps; pace 4% slower; 2 reps missing).', 'Comparison fan-out lives on the session_record so the load model and report generator can speak to deviation.'],
  ['5. Emit', 'Final `session_record` lands in Firestore with: detected blocks, classification, match status, prescribed-comparison delta, confidence tier, and a coach-voice summary line.', 'Single record consumed by load model, dimension-state engine, and report generator.'],
];

const DETECTION_SIGNATURES = [
  ['Track — Sprinter', 'GPS speed > 7 m/s segments separated by recovery dips', 'Per-rep distance + max velocity + recovery time = full session structure', 'Solid'],
  ['Track — Distance', 'HR holds in Z2-Z4 for sustained periods, GPS pace pattern', 'Pace zones + total distance + tempo-vs-easy classification', 'Solid'],
  ['Track — Throws / Jumps', 'Accelerometer impact spikes (high peak force, low frequency)', 'Approach-rep count + landing load proxy', 'Rough — needs prescribed plan to confirm'],
  ['Golf', 'Sustained slow movement (walking) + intermittent accelerometer impact spikes (swings) + duration 3-5h', 'Round duration + walking distance + swing count + heat exposure', 'Solid'],
  ['Basketball — Practice', 'Mixed-modal HR (sustained 60-85% max) + jump cluster + lateral acceleration count + ~60-120 min duration', 'Active minutes, jumps, sprints, density', 'Solid'],
  ['Basketball — Game', 'Higher HR variability than practice + interval pattern matching game-clock structure (4×12min) + travel signal pre/post', 'Same blocks as practice + game-context flag', 'Solid when calendar context present, rough without'],
  ['Bowling', 'Repetitive accelerometer signature (approach + delivery rhythm) + sustained low HR + block duration', 'Shots per block + block density + grip strain proxy', 'Rough — strongly improves with prescribed plan'],
  ['Soccer', 'High-speed-run count (GPS > threshold) + sprint count + total distance + match-vs-practice duration', 'Position-aware load primitives — full coverage', 'Solid'],
  ['Football', 'Burst-rest-burst pattern at high intensity + collision spikes (helmet IMU when present) + position-specific accelerometer', 'Snap-count proxy + collision load + position-load profile', 'Solid for skill positions; rough for line without helmet IMU'],
  ['Strength / Lift', 'Low-movement, accelerometer micro-spikes from rep cadence, HR rises in sets and falls in rests', 'Set count + rest pattern; reps inferred from rep-cadence accelerometer', 'Rough without prescribed plan; tight when plan is present'],
];

const CLASSIFIER_INPUT_FEATURES = [
  ['HR statistics', 'Mean, max, time-in-zone for HR Z1-Z5; HR variability across the session', 'Distinguishes steady aerobic vs. interval vs. strength vs. game'],
  ['Movement statistics', 'GPS distance, max speed, sprint count, lateral-accel count, jump count', 'Sport-specific — unused for indoor sports without GPS'],
  ['Duration + structure', 'Total duration, count of high-intensity bursts, recovery-dip count, burst:rest ratio', 'Fingerprints interval sessions vs. games vs. practices'],
  ['Time-of-day + location', 'When the session started, where (when GPS), proximity to known team venues', 'Disambiguates "practice at the team facility" vs. "athlete went on their own run"'],
  ['Calendar overlap', 'Time-window overlap with team_schedule_event records', 'Highest-weight feature when present — turns rough guess into solid match'],
  ['Recent-context history', 'Same athlete\'s last 14 days of session_records', 'Catches "this athlete has done this exact session shape every Tuesday" patterns for high-confidence classification even without calendar context'],
];

const MATCHING_RULES = [
  [
    'Time-window overlap',
    'Detected session start ± 30 min window vs. team_schedule_event window. Closest-overlap wins. If overlaps span multiple events, sport context tiebreaks.',
  ],
  [
    'Location proximity',
    'When the device has GPS and the schedule event has a known venue, proximity within ~250m boosts match confidence. Indoor practices fall back to time-window only.',
  ],
  [
    'Sport context',
    'Detected session classification must be plausible for the matched event\'s sport (a strength session for a 200m sprinter on a lift day matches; a long aerobic session does not).',
  ],
  [
    'Athlete-roster context',
    'Match is per-athlete — multiple athletes on the same team can each match the same scheduled event with different execution profiles (e.g. one starter played 32 minutes; one bench player played 8). Both bind to the same event but different prescribed_sessions if individualized.',
  ],
  [
    'Unmatched activity',
    'Detected session with no plausible team_schedule_event becomes an `unscheduled_activity` session_record. Counted in load, flagged so the coach knows it wasn\'t on the plan. Coach can dismiss or annotate via Nora.',
  ],
];

const PRESCRIBED_COMPARISON = [
  ['Reps executed vs. prescribed', 'Detected sprint segments / set count / interval count compared to prescribed_session blocks', 'Surfaces "executed 4 of 6 reps" — feeds the load story and the watchlist'],
  ['Intensity vs. prescribed', 'Detected pace / power / HR-zone time compared to prescribed targets', 'Surfaces "ran the reps 4% slower than prescribed" — useful for taper / overreach interpretation'],
  ['Rest vs. prescribed', 'Detected rest dip lengths vs. prescribed rest', 'Catches "compressed the rest" or "blew up the rest interval" patterns'],
  ['Volume vs. prescribed', 'Detected total session volume (distance / time / reps) vs. prescribed total', 'Backbone for "executed full prescribed volume" vs. "stopped early"'],
  ['Modality drift', 'Detected modality (interval vs. steady vs. strength) vs. prescribed modality', 'Catches "athlete did a tempo run when the plan called for an easy day"'],
];

const CONFIDENCE_TIERS = [
  ['Strong read', 'Schedule event present, prescribed plan present, device coverage solid (athlete wore it the whole session), classifier features clean.', 'Used in coach reports without hedging language.'],
  ['Usable read', 'One of the above is missing (no prescribed plan, or schedule context is photo-only and lower-confidence). Device data is clean.', 'Used in coach reports with lighter claims; reviewer screen nudges coach to drop the missing piece in coach voice.'],
  ['Early signal', 'No prescribed plan AND no schedule event match; classifier inferred session type from biometrics alone. Device data is clean.', 'Surfaced in coach reports only as "monitor" or "early pattern" language; no hard claims; reviewer screen says "drop the practice plan and we\'ll tighten this read."'],
  ['Holding back', 'Device coverage is thin (athlete didn\'t wear it for most of the session) OR detected session is ambiguous between two classifications.', 'Suppressed from claims about that athlete\'s load this week. Reviewer screen flags it; coach report omits this session.'],
];

const COACH_VOICE_NUDGES = [
  ['Schedule context missing for a detected session', '"We saw a session on Tuesday but don\'t have a practice plan for it. Drop one and we\'ll tighten the read."'],
  ['Athlete went out for an unscheduled run', '"D. Smith logged an extra session yesterday — wasn\'t on the plan. Counted in his load."'],
  ['Athlete didn\'t wear the device for a known session', '"M. Johnson missed Tuesday\'s wear — we\'re leaning on his Wednesday and Thursday for this week\'s read."'],
  ['Device data is clean but no prescribed plan was uploaded', '"This week\'s read is solid on what happened. Drop the practice plan and we can also speak to what was supposed to happen."'],
  ['Two practice plans uploaded for the same session', '"We have two practice plans for Tuesday — using the latest one. Heads up if that\'s wrong."'],
];

const FAILURE_MODES = [
  [
    'Device sees a session that doesn\'t look like training',
    'A long walk during a campus tour, a yoga class, a dance party. Classifier marks it `non_training` — kept on the record but excluded from training load. Coach can confirm or correct via Nora.',
  ],
  [
    'Athlete forgot the device for a key session',
    'No detected session for that window despite a scheduled event. session_record is emitted with `device_data: missing`, flagged for the coach. Load model uses the prescribed plan as a proxy if confidence is high enough; otherwise the session is excluded from this week\'s load curve.',
  ],
  [
    'Classifier is genuinely uncertain between two session types',
    'session_record carries both candidate classifications + confidence tier "holding back". Reviewer screen surfaces the uncertainty; the coach can disambiguate in one tap or leave it.',
  ],
  [
    'Schedule event happened but device shows no movement',
    'Travel day, film session, lift session that\'s mostly isometric. Classifier should resolve correctly — but if not, the schedule event\'s `kind` field provides a strong prior (kind: film overrides any movement detection).',
  ],
  [
    'Athlete wore the device on the wrong wrist or it shifted',
    'Quality-of-signal flags from the device (poor HR contact, low confidence accelerometer) pull the session_record into "holding back". Coach is not pinged; reviewer screen tracks frequency by athlete to flag a hardware issue early.',
  ],
];

const RECORD_SHAPE = [
  ['session_record', '{ id, athleteId, sportId, detectedStart, detectedEnd, classifier: { class, candidates[], featureSnapshot }, scheduleEventId?, prescribedSessionId?, prescribedComparison?, blocks[]: { kind, count, intensity, restPattern }, deviceCoverage: { wear%, qualityFlags[] }, confidenceTier: strong|usable|early|holding_back, coachVoiceSummary, unscheduledActivity?: bool }', 'Backbone record. One per detected (or expected-but-missing) session. Consumed by load model + dimension-state engine + report generator.'],
];

const EXIT_CRITERIA = [
  'Detected session classifications agree with manual coach review on >85% of sessions across the initial pilot sports (basketball, golf, bowling, track & field).',
  'Match engine binds a detected session to the correct schedule event in >95% of cases when calendar context is present.',
  'Prescribed comparison surfaces deviations correctly (executed reps, pace drift, rest compression) on a fixture set covering interval, steady, strength, and game session types.',
  'Every confidence tier is verifiable from the record (strong / usable / early / holding back); no hidden internal states.',
  'Reviewer-screen nudges for missing context use coach voice — never "confidence is emerging" or "evidence is thin".',
  'Unscheduled activity is detected, counted in load, and surfaced to the coach without being treated as a planning failure.',
  'Athletes with poor device coverage are visibly handled — their week\'s read is "leaning on the days they wore it", not silently broken.',
];

const PulseCheckSessionDetectionMatchingSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Sports Intelligence"
        title="Session Detection + Matching"
        version="Version 0.1 | April 25, 2026"
        summary="The bridge between what the device saw and what the coach planned. Detects training and competition sessions from continuous biometric signals, classifies them by activity signature, matches them to the schedule + prescribed-plan records produced by Nora Context Capture, compares execution against prescribed structure, and emits the session_record consumed by the load model and report generator. Designed so device-only inference still produces a usable read; richer context just tightens it."
        highlights={[
          {
            title: 'Device Sees It First',
            body: 'Continuous biometrics from Polar / Apple Watch / Oura / Whoop / Garmin let the system detect and classify sessions without any logging. Coach context tightens the read; absence of context does not break it.',
          },
          {
            title: 'Schedule + Plan = Tighter Read',
            body: 'When the team_schedule_event and prescribed_session exist, the matcher binds them to the detected session and emits prescribed-vs-executed deltas. When they do not, the read stays usable but lighter.',
          },
          {
            title: 'Unscheduled Activity Is Real Data',
            body: 'Athletes who train outside the plan get counted, not ignored. The coach sees "extra session yesterday — counted in his load" without it being treated as a planning failure.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="The bridge layer between device data (Health Context Source Records) and the coach-context records (team_schedule_event, prescribed_session, coach_observation). Owns session detection, classification, schedule + plan matching, prescribed-comparison logic, and confidence-tier propagation."
        sourceOfTruth="This page owns the pipeline (detect → classify → match → compare → emit), the per-sport detection signatures, the matching rules, the prescribed-comparison shape, and the session_record schema. Aggregation + Inference Contract owns thresholds for downstream confidence; Nora Context Capture owns the inputs this layer consumes."
        masterReference="session_record lands in Firestore at `athletes/{athleteId}/sessionRecords/{sessionRecordId}` with a denormalized team-level index at `teams/{teamId}/sessionRecords` for report generation."
        relatedDocs={[
          'Sports Intelligence Layer',
          'Aggregation + Inference Contract',
          'Nora Context Capture',
          'Sport Load Model',
          'Health Context Source Record Spec',
          'Athlete Context Snapshot Spec',
          'Coach Journey',
        ]}
      />

      <SectionBlock icon={Workflow} title="Pipeline (Detect → Classify → Match → Compare → Emit)">
        <DataTable
          columns={['Step', 'What Happens', 'Notes']}
          rows={PIPELINE_STEPS}
        />
      </SectionBlock>

      <SectionBlock icon={RadioTower} title="Per-Sport Detection Signatures (Device-Only Inference)">
        <InfoCard
          title="What This Means"
          accent="blue"
          body="These are the biometric signatures the system uses to detect a session and classify it without any coach context. When schedule and plan are present, classification gets sharper; without them, the device alone produces a usable read for most sports."
        />
        <DataTable
          columns={['Sport', 'Detection Signature', 'What\'s Inferred From The Device Alone', 'Read Quality']}
          rows={DETECTION_SIGNATURES}
        />
      </SectionBlock>

      <SectionBlock icon={Layers} title="Classifier Input Features">
        <DataTable
          columns={['Feature Family', 'What\'s Captured', 'Why It Matters']}
          rows={CLASSIFIER_INPUT_FEATURES}
        />
      </SectionBlock>

      <SectionBlock icon={GitMerge} title="Matching Rules — Detected ↔ Scheduled ↔ Prescribed">
        <DataTable columns={['Rule', 'How It Works']} rows={MATCHING_RULES} />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Prescribed Comparison (When A Plan Exists)">
        <InfoCard
          title="Why This Matters"
          accent="green"
          body={'When the coach has dropped a practice plan, the system can do more than count reps — it can speak to deviation. "Executed 4 of 6 reps with rest 8 seconds shorter than prescribed" is a different load story than "executed 6 of 6 cleanly". Prescribed comparison is what turns volume into intent.'}
        />
        <DataTable columns={['Comparison', 'How', 'What It Surfaces']} rows={PRESCRIBED_COMPARISON} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Confidence Tiers">
        <InfoCard
          title="Coach Voice Rule"
          accent="amber"
          body={'These tier names are the internal vocabulary. They never surface as labels in the coach report or the reviewer screen — instead, the system speaks in coach voice: "strong read", "holding back claims this week", or a contextual nudge in the reviewer\'s voice ("drop the practice plan and we\'ll tighten this read").'}
        />
        <DataTable
          columns={['Internal Tier', 'When', 'How It Surfaces']}
          rows={CONFIDENCE_TIERS}
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Reviewer-Screen Nudges — Coach Voice Examples">
        <DataTable
          columns={['Situation', 'What The Reviewer Screen Says (Coach Voice)']}
          rows={COACH_VOICE_NUDGES}
        />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Failure Modes (What Breaks, What We Do)">
        <DataTable columns={['Situation', 'How It\'s Handled']} rows={FAILURE_MODES} />
      </SectionBlock>

      <SectionBlock icon={Layers} title="session_record Schema (Engineering)">
        <DataTable columns={['Record', 'Shape', 'Notes']} rows={RECORD_SHAPE} />
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

export default PulseCheckSessionDetectionMatchingSpecTab;
