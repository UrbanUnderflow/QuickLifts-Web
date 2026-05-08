import React from 'react';
import {
  Activity,
  ClipboardList,
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
// Training Load Detection Spec
//
// Device-first, sport-agnostic detection layer that turns continuous biometric
// + activity signal into bucketed "training load" candidates the athlete can
// annotate. Sits upstream of Phase J Session Detection + Matching: this layer
// is what the device alone can confidently say without coach context. The
// athlete annotation closes the loop and sharpens future inference.
//
// Replaces the "Recent Workouts" card on the Polar 360 sheet (FWP) with
// "Recent Training Loads", and feeds Sports Intelligence with a coarse,
// high-confidence bucket when no schedule + prescribed plan is present.
// ──────────────────────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  ['1. Window', 'Continuous health-context-source-records (HR, ACC, MET, steps, distance, sleep) → activity-window detector splits the day into candidate windows when sustained activity crosses the rest baseline.', 'Window boundary heuristic: ≥3 min sustained MET ≥ 3.0 OR HR ≥ 50% reserve OR ACC dynamic magnitude > rest baseline. Quiet ≥ 5 min closes the window.'],
  ['2. Fingerprint', 'Each candidate window is fingerprinted across HR statistics, ACC peak/variance, cadence, MET distribution, distance/GPS (when present), and duration.', 'Sport-agnostic feature snapshot. Same shape feeds Phase J classifier downstream — this layer just bakes it earlier so we can speak to the athlete before Phase J runs.'],
  ['3. Bucket', 'Fingerprint maps to a high-confidence training-load bucket (8 total). Bucket selection prefers under-claim over over-claim: ambiguous windows fall back to the broader bucket.', 'Heuristic v0. v1 will retrain bucket thresholds on confirmed annotations. Buckets stay stable across versions; thresholds tune.'],
  ['4. Card', 'Detected load surfaces on the Polar 360 sheet (FWP) and the athlete profile (PulseCheck) as a card: bucket name, detected window, headline metrics, and a "Tell us what this was →" tap target.', 'Replaces the existing "Recent Workouts" card on PolarPairingView. Same backend feeds the PulseCheck athlete profile session list.'],
  ['5. Annotate', 'Athlete reply (free-text + optional sport tag + optional photo) attaches to the detected load via the same record shape used by WorkoutCompleteCheckIn.promptReply.', 'Annotation closes the loop. Coach (when present) sees the athlete\'s words. Phase J consumes both bucket + annotation as priors when scheduling context arrives.'],
];

const TRAINING_LOAD_BUCKETS = [
  ['Steady Cardio', 'Sustained HR Z2–Z3, low ACC variance, regular cadence, 15–60 min duration. MET 4–7 mostly stable.', 'Tempo run · easy ride · row · elliptical · pool work', 'High'],
  ['Long Endurance', 'Same as Steady Cardio but >60 min, MET 4–6, low intensity drift.', 'Long run · long ride · ruck · long swim', 'High'],
  ['Burst Sprints', 'Repeated ACC peaks separated by recovery dips, HR spike-recover pattern, peak MET >7 in bursts.', 'Track sprint repeats · hill repeats · bike intervals · agility drills · skating drills', 'High'],
  ['Explosive Bursts', 'Brief, very high peak ACC (dynamic magnitude well above rest), short total active time, no sustained HR plateau.', 'Jumps · throws · plyo · bounding · max-effort lifts', 'High'],
  ['Heavy Resistance', 'HR Z2–Z3, intermittent ACC clusters, long quiet gaps between effort spikes (rest sets), low average cadence.', 'Strength session · powerlifting · Oly accessory work', 'Medium-High'],
  ['Mixed Conditioning', 'Sustained MET ≥ 6 with high HR variance, high ACC variance, no clean rest pattern.', 'CrossFit · HIIT · circuit · bootcamp · MetCon', 'High'],
  ['Game / Practice', 'Long duration (>45 min), intermittent intensity, mixed cadence with bursts, irregular ACC pattern.', 'Basketball / soccer / hockey practice or game · martial arts class · field session', 'High when calendar context present, Medium without'],
  ['Active Recovery', 'Sustained low MET (2–3), low HR (<60% reserve), walking cadence or near-zero ACC variance.', 'Walk · mobility flow · shake-out · easy spin', 'High'],
];

const FINGERPRINT_FEATURES = [
  ['HR statistics', 'Mean, max, time-in-zone Z1–Z5, HR variability across the window', 'Distinguishes steady aerobic vs. interval vs. resistance vs. recovery'],
  ['ACC dynamic magnitude', 'Peak g, peak count above rest baseline, peak frequency, autocorrelation for cadence', 'Separates explosive (single high spikes) from burst sprints (repeated spikes) from steady (low variance)'],
  ['MET / activity class', 'PolarActivitySnapshot MET max + average, moderate-vigorous class minutes, rest minutes', 'Validates intensity claims independent of HR. Catches windows where HR is suppressed (heat, hydration, beta-blockers)'],
  ['Cadence + step rate', 'Steps/min trajectory, cadence stability, gait regularity', 'Resistance work has near-zero cadence; running has stable high cadence; mixed conditioning has irregular cadence'],
  ['Distance / GPS (when present)', 'Total distance, max speed, sprint count when GPS exists (Apple Watch / phone fallback)', 'Polar 360 has no native GPS — this feature is null when only Polar BLE is connected. Bucket logic must work without it.'],
  ['Duration + structure', 'Total active minutes, count of effort spikes, recovery-dip count, burst-to-rest ratio', 'Backbone for distinguishing Game/Practice from Mixed Conditioning from Heavy Resistance'],
];

const ANNOTATION_CONTRACT = [
  ['What the athlete sees', 'Card on the Polar 360 sheet: bucket name + window + headline metrics + "Tell us what this was →"', 'Tap opens an annotation sheet. No required fields — athlete can dismiss, free-text, or tag.'],
  ['Free text', 'Single text field, no character minimum.', 'Stored on the detected_training_load record as `athleteAnnotation.text`. Mirrors WorkoutCompleteCheckIn.promptReply storage shape.'],
  ['Optional sport tag', 'Curated chip list, learned per athlete (defaults to athlete\'s declared sports + the bucket\'s typical examples).', 'Stored as `athleteAnnotation.sportTag`. Drives future bucket→sport inference and Phase J priors.'],
  ['Optional photo', 'One photo (Whiteboard / track / gym mirror).', 'Stored at `athleteAnnotation.photoPath`. Same upload pipeline as WorkoutCompleteCheckIn.image.'],
  ['Dismiss', '"Wasn\'t a workout" or "Not for me right now" tap.', 'Sets `athleteDismissed: true`. Window kept on the record (so we don\'t re-detect tomorrow), but excluded from training-load aggregations.'],
  ['Bucket correction', 'Athlete can re-bucket from a small picker if our call was wrong ("This wasn\'t Burst Sprints — it was Heavy Resistance").', 'Stored as `athleteCorrectedBucket`. v1 retraining ingests these corrections as labeled examples.'],
];

const CONFIDENCE_TIERS = [
  ['Strong call', 'Fingerprint cleanly matches one bucket\'s thresholds, device coverage solid, no other plausible bucket within 15% confidence.', 'Card shows bucket name without hedging. Counted in load aggregations.'],
  ['Best call', 'Fingerprint matches one bucket but a second bucket is within 15% confidence. Device coverage solid.', 'Card shows bucket name with a quiet "Was this right? →" prompt. Counted in load. Athlete correction is highest-priority training signal.'],
  ['Wide call', 'Fingerprint is consistent with a "family" of buckets (e.g. Steady Cardio vs. Long Endurance — same shape, duration is the splitter and was borderline). Device coverage solid.', 'Card collapses to the broader bucket ("Steady Cardio") rather than over-claim. Counted in load with the broader bucket.'],
  ['Holding back', 'Device coverage thin (athlete didn\'t wear it for most of the window) OR fingerprint is too ambiguous to bucket safely.', 'Card surfaces as "Activity detected · tap to log" without a bucket call. Excluded from load aggregations until athlete annotates.'],
];

const COACH_VOICE_NUDGES = [
  ['Athlete logged a Burst Sprints window with no schedule context', '"D. Smith ran sprints yesterday — counted in his load. Not on this week\'s plan, so heads up if it changes today\'s call."'],
  ['Athlete dismissed a detected window', '"M. Johnson dismissed yesterday\'s detected activity. Excluded from her week."'],
  ['Athlete corrected our bucket', '"Bumped Wednesday from Heavy Resistance to Mixed Conditioning per his note. Load updated."'],
  ['Repeated wide calls for same athlete', '"We\'re calling this athlete\'s sessions wide a lot — could mean their device is shifting, or our thresholds are off for them. Worth a check."'],
  ['Bucket pattern contradicts the prescribed plan', '"Tuesday was prescribed Steady Cardio. Detected as Burst Sprints. Athlete annotation says \'felt good, picked up the pace.\' Tagged in his load story."'],
];

const FAILURE_MODES = [
  [
    'Window has activity but device coverage is thin',
    'ACC + HR present for <50% of the window. Confidence drops to "holding back". Card surfaces as "Activity detected · tap to log" without a bucket. Athlete annotation upgrades it.',
  ],
  [
    'Two valid buckets within 15% confidence',
    'Card uses the broader bucket and surfaces a "Was this right? →" prompt. Never picks the riskier of two close calls.',
  ],
  [
    'Athlete is sedentary all day but the device shows ambient noise',
    'Window detector requires sustained signal (≥3 min of MET ≥ 3.0 etc.). Background noise alone never opens a window.',
  ],
  [
    'Athlete went on a long walk during a campus tour',
    'Bucketed as Active Recovery. Counts toward step total + recovery-day load proxy. Athlete can dismiss with one tap if it shouldn\'t count.',
  ],
  [
    'Device-detected workout overlaps with a Phase J session_record',
    'Phase J record wins. Detected training load is suppressed (kept on the record for provenance, hidden from athlete cards) so the athlete sees one row, not two.',
  ],
  [
    'Polar 360 BLE disconnected mid-window',
    'Window split into two records on resume. Each gets its own bucket call. Annotation can merge them (athlete-led) — system does not auto-merge across BLE drops.',
  ],
];

const RECORD_SHAPE = [
  [
    'detected_training_load',
    '{ id, userId, detectedStart, detectedEnd, bucket: TrainingLoadBucket, candidates[]: { bucket, confidence }, confidenceTier: strong|best|wide|holding_back, fingerprintSnapshot: { hrStats, accStats, metStats, cadenceStats, distance?, gps? }, deviceCoverage: { wearPercent, qualityFlags[] }, sourceLane: polar_ble | polar_accesslink | apple_health | phone_fallback | oura, athleteAnnotation?: { text, sportTag?, photoPath?, correctedBucket?, dismissed?: bool }, phaseJSessionRecordId?, createdAt, updatedAt }',
    'Backbone record. One per detected window. Lives at `users/{userId}/detectedTrainingLoads/{id}`. Indexed by detectedStart desc + sourceLane. Phase J session_records link back via phaseJSessionRecordId when matched.',
  ],
];

const IMPLEMENTATION_CHECKLIST_BACKEND = [
  'Generalize RetroactiveActivityDetectionService.Kind enum from `{ run, bike }` to `TrainingLoadBucket` with the 8 buckets defined here. Keep run/bike as legacy mappings during rollout (Steady Cardio + Long Endurance + Burst Sprints subsume run; Steady Cardio subsumes bike).',
  'Add `TrainingLoadFingerprint` struct (Swift) with the 6 feature families above. Expose a `fingerprint(window:)` method on the activity-window detector that consumes health-context-source-records.',
  'Add `TrainingLoadBucketClassifier` with heuristic v0 thresholds. Single source of truth for bucket → fingerprint mapping. v0 lives in Swift; v1 mirrors to a server function for retraining hooks.',
  'Add `DetectedTrainingLoad` Codable struct mirroring the record shape above. Firestore path: `users/{userId}/detectedTrainingLoads/{id}`.',
  'Persist via PolarBleService flush path so detection runs as records land. RetroactiveActivityDetectionService.scan() picks up windows on app launch as a fallback.',
  'Suppress detected loads that overlap a Phase J session_record (Phase J wins). Link via `phaseJSessionRecordId` for provenance.',
  'Add Firestore index: detectedTrainingLoads by detectedStart desc + sourceLane (firestore.indexes.json — sync from Firebase before editing per ops rule).',
  'Migrate existing RetroactiveActivityCandidate consumers (PolarConnectionWalkthrough, BLEReconnectModal, etc.) to read TrainingLoadBucket without breaking the run/ride prompt.',
];

const IMPLEMENTATION_CHECKLIST_IOS_UI = [
  'Replace WorkoutsChromaticCard at PolarPairingView.swift:3476 with TrainingLoadsChromaticCard. Same chromatic accent (orange flame) — copy reads "Recent Training Loads" / "None in this window" → "Tap-to-log activity will appear here as we detect it on your Polar 360."',
  'Card row shape: bucket name (e.g. "Burst Sprints") · window ("1:00 PM – 2:11 PM · 71 min") · headline metric (avg HR · peak ACC · distance when present) · trailing chevron.',
  'Tap on a row opens TrainingLoadAnnotationSheet (new SwiftUI view): free-text field, sport-tag chip row, photo picker, "Bucket was right / pick again" affordance, "Wasn\'t a workout" dismiss button.',
  'Reuse WorkoutCompleteCheckIn upload pipeline for photo + free-text storage. Annotation writes to `athleteAnnotation` sub-doc on the detected_training_load record.',
  'Wire detection-confidence into the row: strong call shows bucket cleanly; best call shows bucket + quiet "Was this right? →"; wide call shows broader bucket only; holding-back shows "Activity detected · tap to log".',
  'Run Scripts/add_new_files_to_xcodeproj.rb --file for each new .swift file (TrainingLoadAnnotationSheet, DetectedTrainingLoad model, TrainingLoadBucketClassifier service). Verify path field on the new file refs.',
  'Mirror the same card + sheet into the PulseCheck iOS Polar Data dump file in lockstep — Polar Data dump must stay in parity across QuickLifts + PulseCheck.',
];

const IMPLEMENTATION_CHECKLIST_PULSECHECK = [
  'Athlete profile session list (PulseCheck) reads from the same `users/{userId}/detectedTrainingLoads` path. Coach-facing label collapses to bucket + window + athlete annotation excerpt.',
  'When a Phase J session_record matches a detected_training_load, Phase J render takes precedence on the coach surface — detected_training_load is hidden from coach view but kept for provenance.',
  'Coach-voice nudges (table above) wire into the reviewer surface as "missing context" prompts when athlete-only data exists with no schedule binding.',
  'PulseCheck Sport Load Model consumes detected_training_load.bucket as a coarse load primitive when no Phase J session_record is present (early-week reads, no-schedule pilots, off-season).',
];

const IMPLEMENTATION_CHECKLIST_ADMIN = [
  'This spec tab (admin/systemOverview > PulseCheck > Training Load Detection) is the source of truth for bucket definitions, fingerprint features, confidence tiers, and athlete-annotation contract.',
  'Add reviewer-style admin debug surface (later phase) that lists recent detected_training_load records per athlete with fingerprint snapshot, bucket call, confidence tier, and athlete annotation. Mirrors PulseCheckPhaseJReviewerDebugSurfaceTab pattern.',
  'Bucket retraining loop (v1): export labeled examples from athleteCorrectedBucket + athleteAnnotation.sportTag, retune fingerprint thresholds, ship via JSON config (not new app build).',
];

const EXIT_CRITERIA = [
  'On the initial 8 buckets, classifier agrees with athlete annotation on >85% of windows after 4 weeks of pilot data.',
  'No window is bucketed as a riskier call when a broader bucket is within 15% confidence — wide-call fallback is verifiable from the record.',
  'Athlete annotation flow can be completed in <10 seconds on the Polar 360 sheet (free-text + send).',
  'Detected-vs-Phase-J overlap is resolved correctly: zero double-counting on the coach surface, full provenance preserved.',
  'Polar 360 BLE drops produce two clean records on resume — no silent merge, no lost minutes.',
  'Coach-voice nudges for missing context never use system jargon ("confidence tier", "fingerprint", "wide call"). Reviewer surface speaks athlete + coach voice only.',
  'Polar Data dump file in QuickLifts and PulseCheck stay in lockstep — every change to one ships in the same turn as the other.',
  'Bucket call is robust to Polar 360-only mode (no GPS) for all 8 buckets — distance/GPS features are optional, never required.',
];

const PulseCheckTrainingLoadDetectionSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Sports Intelligence"
        title="Training Load Detection"
        version="Version 0.1 | May 7, 2026"
        summary="Device-first, sport-agnostic detection layer that turns continuous biometric + activity signal into bucketed training-load candidates the athlete annotates. Replaces the Polar 360 sheet's Recent Workouts card with Recent Training Loads. Sits upstream of Phase J Session Detection + Matching: when no schedule + prescribed plan is present, this layer is what the device alone can confidently say. Athlete annotation closes the loop and feeds Phase J priors when scheduling context arrives."
        highlights={[
          {
            title: 'Eight Buckets, Sport-Agnostic',
            body: 'Steady Cardio · Long Endurance · Burst Sprints · Explosive Bursts · Heavy Resistance · Mixed Conditioning · Game / Practice · Active Recovery. Generic enough to be confidently called from device signal alone; specific enough for the athlete to annotate "track sprints — 8 x 200m" on top.',
          },
          {
            title: 'Athlete Annotation Closes The Loop',
            body: 'We say what the device saw. The athlete tells us what it actually was. Free-text + optional sport tag + optional photo, reusing the WorkoutCompleteCheckIn promptReply pipeline. Corrections feed v1 retraining.',
          },
          {
            title: 'Under-claim Beats Over-claim',
            body: 'Two close buckets collapse to the broader call. Thin device coverage drops to "Activity detected · tap to log" with no bucket. The system is allowed to be vague — never wrong on purpose.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Device-confident detection layer between Health Context Source Records (input) and Phase J Session Detection + Matching (downstream refinement). Owns activity-window detection, bucket fingerprinting, confidence-tier propagation, athlete-annotation capture, and the Polar 360 sheet card surface."
        sourceOfTruth="This page owns the 8 training-load buckets, the fingerprint feature families, the bucket→fingerprint thresholds, the confidence-tier definitions, the athlete-annotation contract, and the detected_training_load Firestore record shape. Phase J Session Detection + Matching owns refined sport-specific session_record + prescribed-comparison; this layer is the upstream coarse call. Sport Load Model consumes detected_training_load.bucket as a load primitive when no session_record is matched."
        masterReference="detected_training_load lands at `users/{userId}/detectedTrainingLoads/{detectedTrainingLoadId}`. Indexed by detectedStart desc + sourceLane. Phase J session_records link via `phaseJSessionRecordId` for provenance."
        relatedDocs={[
          'Sports Intelligence Layer',
          'Session Detection + Matching',
          'Sport Load Model',
          'Health Context Source Record Spec',
          'Athlete Context Snapshot Spec',
          'Device Registry',
          'Device Integration Strategy',
          'Contextual Detection Engine',
        ]}
      />

      <SectionBlock icon={Workflow} title="Pipeline (Window → Fingerprint → Bucket → Card → Annotate)">
        <DataTable columns={['Step', 'What Happens', 'Notes']} rows={PIPELINE_STEPS} />
      </SectionBlock>

      <SectionBlock icon={RadioTower} title="The 8 Training Load Buckets">
        <InfoCard
          title="Why These Eight"
          accent="blue"
          body="Each bucket is distinguishable from sensor signal alone (HR, ACC, MET, cadence, duration, distance when present) without making a sport-specific claim. The athlete adds the sport-specific story on top. Heavy Resistance vs. Game/Practice is the closest pair — duration + cadence pattern splits them; the athlete annotation corrects the rare edge case."
        />
        <DataTable
          columns={['Bucket', 'Detection Fingerprint', 'Athlete Will Tag It As', 'Read Quality']}
          rows={TRAINING_LOAD_BUCKETS}
        />
      </SectionBlock>

      <SectionBlock icon={Layers} title="Fingerprint Features (Bucket Inputs)">
        <DataTable
          columns={['Feature Family', 'What\'s Captured', 'Why It Matters']}
          rows={FINGERPRINT_FEATURES}
        />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Athlete Annotation Contract">
        <InfoCard
          title="Why The Athlete Annotates"
          accent="green"
          body="The system makes a high-confidence coarse call. The athlete adds the specific story (track sprints, lift session, soccer practice). The annotation is the highest-priority training signal we have — it teaches v1 retraining and feeds Phase J priors when coach context arrives later."
        />
        <DataTable columns={['Affordance', 'What It Is', 'Where It Lands']} rows={ANNOTATION_CONTRACT} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Confidence Tiers">
        <InfoCard
          title="Coach + Athlete Voice Rule"
          accent="amber"
          body="Tier names are internal vocabulary. They never surface as labels in the athlete card or coach view — instead, the system speaks plainly: clean bucket name, a quiet correction prompt, a broader fallback, or 'Activity detected · tap to log' when we can't safely call it."
        />
        <DataTable columns={['Internal Tier', 'When', 'How It Surfaces']} rows={CONFIDENCE_TIERS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Coach Voice Nudges (Reviewer Surface)">
        <DataTable
          columns={['Situation', 'What The Coach Sees (Coach Voice)']}
          rows={COACH_VOICE_NUDGES}
        />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Failure Modes (What Breaks, What We Do)">
        <DataTable columns={['Situation', 'How It\'s Handled']} rows={FAILURE_MODES} />
      </SectionBlock>

      <SectionBlock icon={Layers} title="detected_training_load Schema (Engineering)">
        <DataTable columns={['Record', 'Shape', 'Notes']} rows={RECORD_SHAPE} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Implementation Checklist — Backend / Detection Layer">
        <InfoCard
          title="Where This Slots In"
          accent="blue"
          body="No new top-level service. Extend RetroactiveActivityDetectionService.swift (1,585 lines today) — its multi-source scan + dedup + dismiss architecture is exactly the shape we want. Generalize the Kind enum, add fingerprint + classifier, persist to a new Firestore collection."
        />
        <BulletList items={IMPLEMENTATION_CHECKLIST_BACKEND} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Implementation Checklist — iOS UI (Fit With Pulse)">
        <BulletList items={IMPLEMENTATION_CHECKLIST_IOS_UI} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Implementation Checklist — PulseCheck Surface">
        <BulletList items={IMPLEMENTATION_CHECKLIST_PULSECHECK} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Implementation Checklist — Admin / Source Of Truth">
        <BulletList items={IMPLEMENTATION_CHECKLIST_ADMIN} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Build Exit Criteria">
        <InfoCard title="Done When" accent="green" body={<BulletList items={EXIT_CRITERIA} />} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckTrainingLoadDetectionSpecTab;
