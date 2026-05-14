import React from 'react';
import {
  Brain,
  ClipboardCheck,
  Database,
  GitMerge,
  MessageCircleQuestion,
  RadioTower,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
  StepRail,
} from './PulseCheckRuntimeDocPrimitives';

// -----------------------------------------------------------------------------
// Contextual Sports Detection Engine Spec
//
// Defines the differentiating loop for Pulse Check Sports Intelligence:
// device evidence starts the read, but athlete profile, coach intent, schedule,
// direct Nora questions, and historical corrections turn ambiguous activity into
// sport-specific meaning. This is the layer that keeps the system from guessing
// harder when it should ask better.
// -----------------------------------------------------------------------------

const LAYER_ROWS = [
  [
    '1. Sensor Evidence',
    'Device-observed facts: HR, HR zones, movement density, acceleration bursts, step/distance, sleep, HRV, recovery, device coverage, signal quality.',
    'Answers "what did the body and device show?" It does not own final sport meaning by itself.',
  ],
  [
    '2. Athlete Context',
    'Sport, position, level, season phase, training age, injury history, normal baseline, goals, team membership, prior confirmed sessions, normal weekly rhythm.',
    'Turns the same evidence into athlete-specific meaning. A high-HR interval block means something different for a soccer midfielder than for a bowler.',
  ],
  [
    '3. Coach Context',
    'Practice schedule, game schedule, prescribed plan, coach voice notes, roster tags, venue, training focus, intended intensity, modified workload.',
    'Tells the system what was supposed to happen and what the staff already knows.',
  ],
  [
    '4. Nora Clarification',
    'Targeted athlete or coach questions when evidence is incomplete: session type, RPE, soreness, whether this was practice/lift/conditioning/recovery, what changed.',
    'Closes gaps without forcing manual logging. Nora asks only when the answer materially improves the read.',
  ],
  [
    '5. Structured Interpretation',
    'A confirmed session record with evidence, context, direct answers, confidence tier, load contribution, recommendation posture, and learning signals.',
    'This is what downstream load, readiness, reports, and Nora coaching consume.',
  ],
];

const PIPELINE_STEPS = [
  {
    title: 'Detect',
    owner: 'Device + primitive extraction',
    body: 'Timestamped signals create candidate sessions from HR, movement density, acceleration bursts, device coverage, and real time windows. Daily rollups remain evidence only. Output is evidence, not a hard claim.',
  },
  {
    title: 'Contextualize',
    owner: 'Sport profile + schedule + coach intent',
    body: 'The candidate is enriched with known athlete sport/position, team schedule, prescribed sessions, venue context, coach notes, and historical pattern memory.',
  },
  {
    title: 'Ask',
    owner: 'Nora',
    body: 'If confidence is incomplete and the missing answer matters, Nora asks a small, specific question in athlete or coach voice instead of inventing certainty.',
  },
  {
    title: 'Confirm',
    owner: 'Athlete / coach feedback',
    body: 'Answers, dismissals, corrections, and text/voice context become first-class confirmation events with provenance. The athlete can confirm a lift; the coach can confirm practice intent.',
  },
  {
    title: 'Interpret',
    owner: 'Sports Intelligence',
    body: 'The system emits a session_record and load/readiness context that combine observed data, sport policy, athlete baseline, coach intent, and Nora-confirmed context.',
  },
  {
    title: 'Learn',
    owner: 'Athlete pattern model',
    body: 'Repeated confirmations calibrate future reads: same team practice window, same athlete lift pattern, same coach schedule rhythm, same sport-specific session signature.',
  },
];

const EVIDENCE_TO_MEANING_ROWS = [
  [
    'Daily rollup',
    'Date-level facts such as steps, calories, active minutes, activity-class counts, sleep, recovery, and source coverage.',
    'Context clue only. It may trigger "we saw training-like movement today" in reviewer/debug surfaces, but it cannot become a session, bucket, or load contribution.',
  ],
  [
    'Timestamped primitive window',
    'A segmented start/end window built from minute/sample-level HR, MET, activity class, cadence, distance, ACC bursts, rest gaps, and coverage.',
    'Eligible for session_candidate and training-load bucket because it proves when the activity happened.',
  ],
  [
    'Explicit session source',
    'HealthKit workout, vendor workout, QuickLifts workout completion, app-started workout runtime, or athlete/coach-confirmed scheduled session.',
    'Eligible for session_candidate because the source gives a real window and provenance. Context still decides final meaning.',
  ],
  [
    'Ambiguous movement',
    'Training-like evidence exists, but missing timestamps, poor coverage, or conflicting signals prevent segmentation.',
    'Hold back or ask a targeted question only if the answer changes classification, confidence, load, recommendation, or reviewer delivery posture.',
  ],
  [
    'Final meaning',
    'A session_record with evidenceRefs, contextRefs, confirmationRefs, actor precedence, confidence tier, and load contribution.',
    'Downstream truth. It is never created from aggregate-only movement evidence.',
  ],
];

const CLARIFICATION_TRIGGERS = [
  [
    'Device-only session with sport ambiguity',
    'Ask athlete: "Was that team practice, individual training, lifting, conditioning, or recovery?"',
    'Avoids over-labeling an interval-heavy session as basketball practice without context.',
  ],
  [
    'Likely practice but no schedule match',
    'Ask coach or athlete for a lightweight confirm; nudge coach to drop the recurring schedule if this repeats.',
    'Converts a usable read into a strong read while teaching the system the team rhythm.',
  ],
  [
    'Likely lift session with no exercise detail',
    'Ask athlete for a summary by text or voice. Parse exercises, sets, reps, weights, body areas, and RPE.',
    'Turns "lift happened" into useful load context for strength, fatigue, and sport readiness.',
  ],
  [
    'High load but unclear intent',
    'Ask coach: "Was today supposed to be a hard conditioning day or did the session run hotter than planned?"',
    'Separates intended overload from accidental spike.',
  ],
  [
    'Recovery/readiness mismatch',
    'Ask athlete about soreness, sleep disruption, illness, travel, or pain when device signals and behavior diverge.',
    'Prevents the system from treating a noisy signal as a coaching recommendation.',
  ],
  [
    'Known scheduled session but missing device coverage',
    'Ask athlete for RPE and short summary; ask coach only if prescribed plan is also missing.',
    'Keeps load accounting usable without pretending device data exists.',
  ],
];

const CONFIDENCE_POLICY = [
  [
    'Strong contextual read',
    'Clean device evidence + athlete sport profile + schedule or prescribed plan + no unresolved gaps.',
    'Coach report can speak directly after review: "Tuesday practice ran heavy for guards."',
  ],
  [
    'Confirmed read',
    'Device evidence was partial or ambiguous, but athlete/coach answered the key Nora question.',
    'Report can use the confirmed context and carry provenance: "Athlete confirmed this was a lift."',
  ],
  [
    'Usable read',
    'Device evidence is clean, sport profile is known, but schedule/plan or one context answer is missing.',
    'Use lighter language and show the missing-context nudge.',
  ],
  [
    'Directional read',
    'Evidence points one way but device coverage is thin, answer is missing, or sport signature is weak.',
    'Use as internal context only or "monitor" language; no hard coach claim.',
  ],
  [
    'Hold back',
    'Signals conflict or the missing information would change the recommendation.',
    'Nora asks or reviewer holds the claim. No report assertion.',
  ],
];

const STRUCTURED_RECORDS = [
  [
    'session_candidate',
    '{ candidateId, athleteId, sportHint?, detectedStart, detectedEnd, primitiveSnapshot, candidateKinds[], confidence, missingContext[], evidenceRefs[] }',
    'Ephemeral or short-retention object emitted by detection before final interpretation.',
  ],
  [
    'clarification_prompt',
    '{ promptId, candidateId, target: athlete|coach, questionType, promptText, answerOptions?, status, expiresAt, reason }',
    'Nora task/question generated only when the answer can materially change confidence, classification, load, or recommendation.',
  ],
  [
    'context_confirmation_event',
    '{ eventId, candidateId, actorId, actorRole, answer, freeText?, voiceTranscript?, parsedContext?, confirmationBasis, confidenceImpact, expiresAt?, createdAt }',
    'Stores athlete/coach answers, dismissals, and corrections as evidence rather than chat-only memory.',
  ],
  [
    'session_record',
    '{ sessionId, athleteId, teamId?, sportId, sessionType, start, end, primitives, contextRefs[], confirmationRefs[], scheduleEventId?, prescribedSessionId?, confidenceTier, loadContribution, coachVoiceSummary }',
    'Canonical downstream record consumed by Sport Load Model, Sports Intelligence reports, Nora, and readiness context.',
  ],
  [
    'athlete_session_pattern',
    '{ athleteId, sportId, patternKey, signature, confirmedCount, correctionCount, lastConfirmedAt, confidence, examples[] }',
    'Learns repeated patterns so future reads get sharper without requiring the same question every time.',
  ],
];

const TECHNICAL_IMPLEMENTATION_ROWS = [
  [
    'Daily evidence ledger',
    'Write date-keyed aggregate activity evidence separately from timestamped primitives. Mark aggregate-only source records as not session-candidate eligible.',
    'Pulse Check iOS / shared Fit With Pulse health services',
  ],
  [
    'iOS primitive extractor',
    'Generalize the current lift/Polar work into a SessionPrimitiveAccumulator for timestamped HR zones, movement density, accel bursts, rest gaps, step/distance, and device coverage.',
    'Pulse Check iOS / shared Fit With Pulse health services',
  ],
  [
    'Sport detection profiles',
    'Load sport/position policy from pulsecheck sport configuration: relevant primitives, thresholds, confidence gates, clarification questions, and load-model inputs.',
    'Web config + iOS config reader',
  ],
  [
    'Candidate emitter',
    'Emit session_candidate from device evidence without overclaiming. Include missingContext and "what would tighten this read" fields.',
    'iOS first, then backend reconciler',
  ],
  [
    'Nora clarification router',
    'Given a candidate and missing context, choose whether to ask athlete, ask coach, wait for schedule sync, or hold back. Enforce daily caps, cooldowns, coach-preferred routing, and pattern-confidence decay before persisting clarification_prompt.',
    'Backend/Nora orchestration',
  ],
  [
    'Athlete response capture',
    'Support quick taps, text summary, and voice summary. Parse lift/practice/conditioning summaries into structured context using the Claude bridge/GPT fallback path.',
    'Pulse Check iOS + AI bridge',
  ],
  [
    'Coach context capture',
    'Reuse Nora Context Capture: schedule upload, prescribed plan, voice memo, roster matching, venue/time windows, and parsed coach_observation.',
    'QuickLifts-Web admin/coach + backend',
  ],
  [
    'Session record writer',
    'Merge candidate evidence + confirmations + schedule/plan context into canonical session_record with provenance and confidence tier.',
    'Backend canonical writer',
  ],
  [
    'Pattern learning',
    'Update athlete_session_pattern after confirmations/corrections. Use repeated confirmed patterns to reduce future questions and improve confidence.',
    'Backend aggregation job',
  ],
  [
    'Reviewer/debug surface',
    'Show candidate -> context -> question -> answer -> final session_record -> load contribution so operators can audit why Nora believed something. Build the skeleton before automation is trusted.',
    'Admin Sports Intelligence reviewer',
  ],
];

const FRICTION_GUARDRAILS = [
  [
    'Max prompts per athlete per day',
    'Default cap: 2 clarification prompts/day unless the athlete explicitly initiated the session or a safety/escalation lane is involved.',
    'Prevents Nora from becoming session-detection homework.',
  ],
  [
    'Session-type cooldown',
    'Do not ask the same athlete the same session-type question more than once in a rolling 72h window unless new evidence conflicts with the prior answer.',
    'Stops repeated "was this a lift?" prompts after the system has enough pattern confidence.',
  ],
  [
    'Coach-preferred routing',
    'If coach context can resolve the ambiguity without athlete burden, ask the coach or wait for schedule/plan sync before asking the athlete.',
    'Keeps athlete friction low and respects the coach as the intent source.',
  ],
  [
    'Pattern-confidence decay',
    'As athlete_session_pattern.confidence rises, clarification probability decays. Ask only on drift, conflict, unusually high load, or missing critical context.',
    'Confirmed routines should get cheaper over time.',
  ],
  [
    'Materiality gate',
    'No clarification prompt is allowed unless the answer can change classification, confidence tier, load contribution, recommendation, or reviewer delivery posture.',
    'Turns "ask better" into an enforceable rule.',
  ],
  [
    'Ask suppression',
    'If the likely output is still directional after the answer, hold back or route to reviewer instead of interrupting the athlete.',
    'Avoids asking questions that do not improve product trust.',
  ],
];

const CONFIRMATION_RULES = [
  [
    'Direct actor identity',
    'Confirmation requires a known athlete, coach, or operator actor id and role. Parsed text with no actor identity is supplementary evidence only.',
    'Prevents "confirmed" from meaning "we parsed a sentence."',
  ],
  [
    'Recent enough',
    'Default confirmation freshness: answer within 24h of the session end. Older answers can annotate but do not upgrade to confirmed read without reviewer approval.',
    'Keeps retrospective memory from masquerading as fresh session truth.',
  ],
  [
    'Unambiguous answer',
    'The answer must resolve the specific classification/context question. Free-form summaries are parsed into evidence, then marked confirmed only if the key field is clear.',
    'A vague note is useful, but it is not automatically confirmation.',
  ],
  [
    'Conflict handling',
    'If athlete answer, coach context, vendor sport, and schedule disagree, the record stays usable/directional until reviewer or follow-up resolves the conflict.',
    'Triangulation should not hide disagreement.',
  ],
  [
    'Actor precedence',
    'Coach owns intent/schedule context; athlete owns exertion, RPE, soreness, and what they personally did. Operator/reviewer can adjudicate conflicts.',
    'Different actors are authoritative for different facts.',
  ],
];

const COLD_START_ROWS = [
  [
    'Athlete onboarding',
    'Pre-seed sport, position, level, season phase, normal weekly rhythm, known lift days, practice days, and preferred clarification mode.',
    'Gives Phase J context before the first detected session.',
  ],
  [
    'Coach onboarding',
    'Capture team schedule, recurring practice windows, lift windows, venues, and the minimum viable plan format.',
    'Reduces athlete-only prompts by creating intent context early.',
  ],
  [
    'First 14 days',
    'Default to lighter claims, reviewer visibility, and sparse questions while athlete_session_pattern is immature.',
    'Cold-start should feel careful, not needy.',
  ],
  [
    'Known rhythm bootstrap',
    'If an athlete confirms a recurring Tuesday lift twice, create a low-confidence pattern and ask less unless evidence drifts.',
    'Pattern learning starts quickly without pretending certainty.',
  ],
];

const DEVICE_ABSENT_ROWS = [
  [
    'Scheduled event but no wearable evidence',
    'Create a low-confidence session_candidate from schedule/prescribed plan with deviceCoverage=missing and missingContext requiring athlete or coach confirmation.',
    'Prevents load from disappearing just because the athlete forgot the device.',
  ],
  [
    'Team majority confirmed',
    'If a scheduled practice was confirmed by enough teammates, ask the missing athlete for one-tap confirmation rather than ignoring the session.',
    'Uses team context carefully without assuming individual attendance.',
  ],
  [
    'No device and no schedule',
    'Route to self-report only when the athlete initiates or Nora has a reason from check-in context; otherwise hold back.',
    'Avoids speculative activity creation.',
  ],
  [
    'Device missing for known lift',
    'Ask for RPE + summary and mark device evidence absent. Load can use self-report with capped confidence.',
    'Makes self-report useful while preserving provenance.',
  ],
];

const AUDIENCE_POLICY_ROWS = [
  [
    'Shared bridge, separate policies',
    'Athlete-facing and coach-facing language may use the same ServerBridge/translation infrastructure, but must use separate audience policy profiles.',
    'The same model pipe can serve both audiences; the contract cannot.',
  ],
  [
    'Athlete policy',
    'Uses athlete-safe Nora framing: encouraging, private, non-punitive, focused on action and self-awareness.',
    'Matches Athlete Surface Doctrine and protects trust.',
  ],
  [
    'Coach policy',
    'Uses coach-operational language: concise, role-appropriate, team-context aware, no raw private disclosures, no clinical authority.',
    'Coach copy needs different verbs, boundaries, and visibility rules than athlete copy.',
  ],
  [
    'Forbidden shortcut',
    'Do not route coach-facing language through translateForAthlete unless the service is explicitly role-aware and invoked with coach policy.',
    'Avoids accidentally wrapping coach decisions in athlete-facing tone or visibility assumptions.',
  ],
];

const CURRICULUM_BOUNDARY_ROWS = [
  [
    'Physical session records',
    'Practice, lift, conditioning, game, recovery, and unscheduled physical sessions feed load/readiness and can influence Nora planning context.',
    'They are not automatically curriculum completions.',
  ],
  [
    'Mental curriculum reps',
    'Daily protocols, sims, reflections, and mental-skill drills remain their own execution truth.',
    'Keeps Phase I curriculum from being silently completed by physical attendance.',
  ],
  [
    'Allowed interaction',
    'A confirmed practice can trigger or modify a follow-up protocol/sim recommendation, but completion requires the athlete to execute the assigned mental task.',
    'Physical context informs curriculum; it does not replace it.',
  ],
];

const PRODUCT_RULES = [
  'The device layer provides evidence; Nora plus athlete/coach context provides meaning.',
  'Daily summaries are not sessions. No timestamped evidence or explicit session source means no athlete-facing session card, no bucket, and no load contribution.',
  'Never synthesize a session window from aggregate active minutes, day-boundary math, snapshot end, or refresh time.',
  'When confidence is low, do not guess harder. Ask better.',
  'Nora should ask only the smallest useful question, and only when the answer can change classification, confidence, load, or recommendation.',
  'Athlete and coach answers are data with provenance. They must be saved as structured confirmation events, not buried in chat transcripts.',
  'Repeated confirmations should reduce future friction. The system should learn team rhythm, athlete-specific patterns, and sport-specific signatures.',
  'Coach-facing language stays practical: "drop the practice plan and we will tighten the read" instead of "confidence is emerging."',
  'Athlete-facing and coach-facing language share infrastructure only when the bridge is role-aware; each audience must use its own policy profile.',
  'Clinical or safety thresholds still route through the clinical/escalation lane. Contextual confidence is not clinical authority.',
];

const BUILD_ORDER = [
  [
    '1. Lock schemas',
    'Add session_candidate, clarification_prompt, context_confirmation_event, session_record, and athlete_session_pattern to the Health Context / Sports Intelligence schema docs and Firestore index plan.',
  ],
  [
    '2. Reviewer/debug skeleton',
    'Create the admin surface shell before automation: candidate -> evidence -> context -> ask -> answer -> session record -> load impact. Empty states are acceptable at first.',
  ],
  [
    '3. Lift vertical slice',
    'Use the proven Polar/live-HR + athlete-asserted lift + text/voice summary parsing path to exercise the loop end-to-end for one session type.',
  ],
  [
    '4. Extract primitives',
    'Move Polar lift/run learnings into a sport-agnostic primitive accumulator with device coverage, HR, movement, accel, rest windows, local timezone, and explicit separation from daily rollups.',
  ],
  [
    '5. Wire sport profiles',
    'Load sport config into detection so basketball, golf, bowling, lifting, conditioning, and future sports choose different primitives and questions.',
  ],
  [
    '6. Add Nora questions + friction caps',
    'Implement the clarification router, athlete response UI, daily caps, cooldowns, coach-preferred routing, and pattern-confidence decay.',
  ],
  [
    '7. Write session records',
    'Create the canonical writer that merges evidence plus context into session_record and feeds Sport Load Model.',
  ],
  [
    '8. Expand sports',
    'After the lift slice is trusted, expand to basketball, golf, bowling, track, and other sport profiles using the same schemas and audit surface.',
  ],
];

const EXIT_CRITERIA = [
  'Aggregate-only daily movement evidence can never create a session_candidate, session_record, training-load bucket, or athlete-facing activity card.',
  'A device-only lift, practice-like session, or conditioning session can become a session_candidate without a hard final claim.',
  'Nora can ask the athlete or coach one targeted question when the missing answer changes the read and friction caps allow it.',
  'Athlete text/voice context is parsed and saved as context_confirmation_event, then visible on the final session_record.',
  'Confirmed read requires direct actor identity, recent answer, and unambiguous resolution of the requested field.',
  'Schedule and prescribed-plan context can upgrade a usable read into a strong contextual read.',
  'Device-absent scheduled sessions can produce low-confidence candidates that ask for confirmation instead of disappearing.',
  'Athlete-facing and coach-facing language are generated with separate audience policy profiles, even when they share the same bridge infrastructure.',
  'Every final session_record carries evidenceRefs, contextRefs, confirmationRefs, confidenceTier, missingContext, and coachVoiceSummary.',
  'Admin reviewer can inspect why the system believed the session was practice/lift/conditioning and what data would have improved the read.',
  'Repeated athlete/coach confirmations update athlete_session_pattern and reduce repeated questions.',
];

const PulseCheckContextualSportsDetectionEngineSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Sports Intelligence"
        title="Contextual Sports Detection Engine"
        version="Version 0.3 | May 13, 2026"
        summary="The differentiating Sports Intelligence loop: timestamped sensor evidence starts the read, but athlete profile, coach context, Nora clarification, and historical corrections turn ambiguous activity into sport-specific meaning. Pulse Check does not depend solely on the wearable. It uses the wearable as evidence, separates daily rollups from session candidates, then intelligently closes gaps with the athlete and coach."
        highlights={[
          {
            title: 'Device Gives Evidence, Nora Gives Meaning',
            body: 'The device can say what happened physiologically. Nora, athlete onboarding, coach plans, and direct answers explain what it meant in that athlete\'s sport context.',
          },
          {
            title: 'Ask Better Instead Of Guessing Harder',
            body: 'When the system is not confident, Nora asks a small, targeted question to the athlete or coach instead of turning uncertain signals into confident claims.',
          },
          {
            title: 'Every Correction Teaches The System',
            body: 'Confirmed sessions, dismissed guesses, coach notes, and athlete summaries update pattern memory so future detection gets sharper and less intrusive.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Companion layer between Session Detection + Matching and Nora Context Capture. Owns the human-in-the-loop confidence loop that converts device evidence plus athlete/coach context into trustworthy sport-session meaning."
        sourceOfTruth="This page owns the Detect -> Contextualize -> Ask -> Confirm -> Interpret -> Learn loop, the clarification trigger policy, the structured confirmation records, and the technical implementation order for context-aware sports detection."
        masterReference="Final downstream truth is still the session_record consumed by Sport Load Model and Sports Intelligence reports. This spec defines how session_record becomes smarter than device-only inference."
        relatedDocs={[
          'Sports Intelligence Layer',
          'Phase J Schema Contract',
          'Phase J Reviewer Surface',
          'Session Detection + Matching',
          'Nora Context Capture',
          'Sport Load Model',
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
          'Coach Journey',
        ]}
      />

      <SectionBlock icon={Brain} title="Core Differentiator">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="The Moat"
            accent="green"
            body="Most wearable systems stop at sensor interpretation: elevated HR, steps, active minutes, generic workout detection. Pulse Check has athlete profile, sport, position, coach intent, schedule, prescribed plan, Nora check-ins, direct athlete answers, and historical corrections. That lets us interpret evidence instead of merely reporting it."
          />
          <InfoCard
            title="Operating Rule"
            accent="amber"
            body="When confidence is low, do not guess harder. Ask better. Nora is the missing-signal engine: she asks for the one answer that can change the classification, confidence tier, load contribution, or recommendation."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={GitMerge} title="Five Context Layers">
        <DataTable columns={['Layer', 'What It Contains', 'Why It Matters']} rows={LAYER_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Evidence To Meaning Boundary">
        <InfoCard
          title="Daily Evidence Is Not Session Truth"
          accent="amber"
          body="The contextual engine may use a daily rollup as a clue, but it cannot turn that clue into a session. A final session needs a real window, an explicit workout/session source, or a confirmation event with provenance."
        />
        <DataTable columns={['Evidence Type', 'What It Means', 'Allowed Product Behavior']} rows={EVIDENCE_TO_MEANING_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Pipeline: Detect -> Contextualize -> Ask -> Confirm -> Interpret -> Learn">
        <StepRail steps={PIPELINE_STEPS} />
      </SectionBlock>

      <SectionBlock icon={MessageCircleQuestion} title="Nora Clarification Triggers">
        <DataTable
          columns={['Trigger', 'Nora Action', 'Why It Matters']}
          rows={CLARIFICATION_TRIGGERS}
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Friction Guardrails">
        <InfoCard
          title="Ask Only When Material"
          accent="amber"
          body="The clarification router must prove that a question can change classification, confidence, load, recommendation, or reviewer delivery posture before it interrupts an athlete or coach."
        />
        <DataTable columns={['Guardrail', 'Rule', 'Why']} rows={FRICTION_GUARDRAILS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Confidence Policy">
        <InfoCard
          title="Confidence Is A Product Feature"
          accent="blue"
          body="The system should preserve why it believes a session happened, what evidence supported it, which context closed the gap, and what is still missing. Confidence is not hidden implementation state; it shapes when we ask, what we save, and what coaches can safely read."
        />
        <DataTable columns={['Tier', 'Required Inputs', 'Allowed Output']} rows={CONFIDENCE_POLICY} />
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Hard Confirmation Rules">
        <DataTable columns={['Rule', 'Definition', 'Why']} rows={CONFIRMATION_RULES} />
      </SectionBlock>

      <SectionBlock icon={GitMerge} title="Cold-Start Pre-Seeding">
        <DataTable columns={['Surface', 'What To Capture', 'Why']} rows={COLD_START_ROWS} />
      </SectionBlock>

      <SectionBlock icon={RadioTower} title="Device-Absent Session Pathway">
        <DataTable columns={['Scenario', 'System Behavior', 'Why']} rows={DEVICE_ABSENT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Brain} title="Audience Policy Boundary">
        <InfoCard
          title="Same Bridge, Different Audience Contract"
          accent="purple"
          body="Coach-facing language must not be routed through athlete-facing translation policy unless the bridge is explicitly role-aware and invoked with a coach policy profile. Athlete and coach copy can share infrastructure, but not the same audience contract."
        />
        <DataTable columns={['Policy', 'Rule', 'Why']} rows={AUDIENCE_POLICY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Phase I Curriculum Boundary">
        <DataTable columns={['Domain', 'Rule', 'Why']} rows={CURRICULUM_BOUNDARY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Structured Records">
        <DataTable columns={['Record', 'Shape', 'Purpose']} rows={STRUCTURED_RECORDS} />
      </SectionBlock>

      <SectionBlock icon={RadioTower} title="Technical Implementation Spec">
        <DataTable columns={['Workstream', 'Implementation', 'Owner Surface']} rows={TECHNICAL_IMPLEMENTATION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Product Rules To Preserve">
        <InfoCard title="Rules" accent="purple" body={<BulletList items={PRODUCT_RULES} />} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Build Order">
        <DataTable columns={['Step', 'Scope']} rows={BUILD_ORDER} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Build Exit Criteria">
        <InfoCard title="Done When" accent="green" body={<BulletList items={EXIT_CRITERIA} />} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckContextualSportsDetectionEngineSpecTab;
