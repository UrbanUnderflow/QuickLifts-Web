import React from 'react';
import { ClipboardCheck, Database, GitBranch, ShieldCheck, Workflow } from 'lucide-react';
import {
  PHASE_J_ACTOR_PRECEDENCE,
  PHASE_J_ALLOWED_CONFIDENCE_TRANSITIONS,
  PHASE_J_ATHLETE_SESSION_PATTERNS_COLLECTION,
  PHASE_J_CLARIFICATION_PROMPTS_COLLECTION,
  PHASE_J_CONTEXT_CONFIRMATION_EVENTS_COLLECTION,
  PHASE_J_INDEX_REQUIREMENTS,
  PHASE_J_REQUIRED_PROVENANCE_FIELDS,
  PHASE_J_SESSION_CANDIDATES_COLLECTION,
  PHASE_J_SESSION_CONTRACT_VERSION,
  PHASE_J_SESSION_RECORDS_COLLECTION,
} from '../../../api/firebase/phaseJSessionContracts';
import type { PhaseJRecordProvenance } from '../../../api/firebase/phaseJSessionContracts';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

const COLLECTION_ROWS = [
  [
    `\`${PHASE_J_SESSION_CANDIDATES_COLLECTION}\``,
    'Detected-but-not-finalized candidate sessions from devices, schedules, or coach/team context.',
    'Short-retention working collection for detection, review, clarification, and conversion.',
  ],
  [
    `\`${PHASE_J_CONTEXT_CONFIRMATION_EVENTS_COLLECTION}\``,
    'First-class answers, corrections, dismissals, explicit labels, coach confirmations, and operator reviews.',
    'Audit and provenance collection. Confirmation never lives only in chat text.',
  ],
  [
    `\`${PHASE_J_CLARIFICATION_PROMPTS_COLLECTION}\``,
    'Nora questions generated when an answer materially changes classification, load, confidence, or recommendation.',
    'Friction-governed prompt queue for athletes, coaches, and operators.',
  ],
  [
    `\`${PHASE_J_SESSION_RECORDS_COLLECTION}\``,
    'Canonical confirmed/interpreted session record consumed by Sport Load, reports, Nora, and readiness context.',
    'Durable downstream source of truth.',
  ],
  [
    `\`${PHASE_J_ATHLETE_SESSION_PATTERNS_COLLECTION}\``,
    'Learned per-athlete signatures from repeated confirmations and corrections.',
    'Runtime pattern memory that reduces future questions.',
  ],
];

const SESSION_CANDIDATE_FIELDS = [
  ['id', 'string', 'Candidate id.', 'Required'],
  ['athleteUserId', 'string', 'Athlete uid.', 'Required'],
  ['teamId', 'string', 'Team scope when known.', 'Recommended'],
  ['sportId', 'string', 'Known athlete sport or strongest contextual sport hint.', 'Recommended'],
  ['candidateKinds', 'array<session_type>', 'Possible meanings: lift, practice, conditioning, game, run, walk, etc.', 'Required'],
  ['status', 'enum', 'detected, contextualized, needs_clarification, confirmed, converted, dismissed, expired, held_back.', 'Required'],
  ['confidenceTier', 'enum', 'strong_contextual, confirmed, usable, directional, hold_back.', 'Required'],
  ['detectedStartAt / detectedEndAt', 'epoch seconds', 'Detected session window.', 'Required'],
  ['primitiveSnapshot', 'map', 'HR, zones, movement density, accel bursts, rest gaps, steps, distance, energy, coverage.', 'Required'],
  ['missingContext', 'array<string>', 'Questions or context gaps that would tighten the read.', 'Required'],
  ['evidenceRefs', 'array<string>', 'HCSR ids, device records, schedule records, or source traces.', 'Required'],
  ['confirmationEventIds', 'array<string>', 'Confirmations/corrections linked to this candidate.', 'Required'],
  ['provenance', 'map', 'Required source/provenance object.', 'Required'],
  ['contractVersion', 'string', PHASE_J_SESSION_CONTRACT_VERSION, 'Required'],
  ['createdAt / updatedAt / expiresAt', 'epoch seconds', 'Lifecycle and retention timestamps.', 'Required except expiresAt'],
];

const CONFIRMATION_EVENT_FIELDS = [
  ['id', 'string', 'Confirmation event id.', 'Required'],
  ['candidateId', 'string', 'Linked candidate.', 'Required'],
  ['athleteUserId / teamId', 'string', 'Athlete and optional team scope.', 'Required athlete'],
  ['actor', 'map', 'actorId, actorRole, optional displayName.', 'Required'],
  ['disposition', 'enum', 'confirmed, corrected, dismissed, not_sure, needs_review.', 'Required'],
  ['confirmationBasis', 'enum', 'direct_answer, explicit_start_label, coach_schedule_confirm, coach_observation, vendor_classification, operator_review, team_majority_context.', 'Required'],
  ['confidenceImpact', 'confidence tier', 'Highest tier this event is allowed to support.', 'Required'],
  ['answer', 'string', 'Canonical answer summary.', 'Required'],
  ['selectedSessionType', 'session_type', 'Chosen type when applicable.', 'Recommended'],
  ['freeText / voiceTranscript', 'string', 'Human context captured by text or voice.', 'Optional'],
  ['parsedContext', 'map', 'AI/server parsed exercises, RPE, soreness, intent, or notes.', 'Optional'],
  ['promptId', 'string', 'Prompt that produced this event.', 'Optional'],
  ['provenance', 'map', 'Required source/provenance object.', 'Required'],
];

const CLARIFICATION_PROMPT_FIELDS = [
  ['id', 'string', 'Prompt id.', 'Required'],
  ['candidateId', 'string', 'Linked candidate.', 'Required'],
  ['athleteUserId / teamId', 'string', 'Athlete and optional team scope.', 'Required athlete'],
  ['target', 'enum', 'athlete, coach, operator.', 'Required'],
  ['questionType', 'enum', 'session_type, lift_summary, rpe, schedule_mismatch, coach_intent, device_absent, etc.', 'Required'],
  ['promptText', 'string', 'Actual Nora question.', 'Required'],
  ['answerOptions', 'array<string>', 'Quick options when appropriate.', 'Optional'],
  ['reason', 'string', 'Why the prompt matters.', 'Required'],
  ['status', 'enum', 'pending, answered, expired, suppressed, cancelled.', 'Required'],
  ['missingContextResolved', 'array<string>', 'Which context gaps this prompt can resolve.', 'Required'],
  ['dailyFrictionBucket', 'string', 'Bucket used by prompt caps/cooldowns.', 'Required'],
  ['actorPrecedenceApplied', 'array<actor_role>', 'Routing order considered by the router.', 'Required'],
  ['createdAt / expiresAt / answeredAt', 'epoch seconds', 'Prompt lifecycle timestamps.', 'Required except answeredAt'],
];

const SESSION_RECORD_FIELDS = [
  ['id', 'string', 'Canonical session id.', 'Required'],
  ['athleteUserId / teamId / sportId', 'string', 'Athlete, team, and sport scope.', 'Required athlete + sport'],
  ['sessionType', 'session_type', 'Final interpreted session type.', 'Required'],
  ['startAt / endAt / timezone', 'epoch seconds + string', 'Final session window.', 'Required'],
  ['candidateId', 'string', 'Candidate converted into this record.', 'Required'],
  ['primitiveSnapshot', 'map', 'Frozen primitives used for the interpretation.', 'Required'],
  ['contextRefs', 'array<string>', 'Schedule, plan, coach observation, athlete profile, or other context ids.', 'Required'],
  ['confirmationEventIds', 'array<string>', 'Events that support this record.', 'Required'],
  ['confidenceTier', 'confidence tier', 'Final confidence tier after evidence and context.', 'Required'],
  ['loadContribution', 'map', 'Sport Load Model payload.', 'Optional until Phase 13'],
  ['athleteVisibleSummary / coachVisibleSummary', 'string', 'Audience-specific summaries. Shared bridge, separate policy profile.', 'Recommended'],
  ['athleteNote', 'string', 'User-visible note from athlete text/voice context.', 'Optional'],
  ['parsedLiftSummary', 'map', 'Parsed exercises, sets, reps, load, body areas, and RPE.', 'Optional'],
  ['provenance', 'map', 'Required source/provenance object.', 'Required'],
];

const ATHLETE_PATTERN_FIELDS = [
  ['id', 'string', 'Pattern id.', 'Required'],
  ['athleteUserId / teamId / sportId', 'string', 'Pattern scope.', 'Required athlete + sport'],
  ['patternKey', 'string', 'Stable pattern key: athlete/sport/time-window/session-type/source mix.', 'Required'],
  ['sessionType', 'session_type', 'Pattern classification.', 'Required'],
  ['signature', 'map', 'Learned primitive/context signature.', 'Required'],
  ['confirmedCount / correctionCount', 'number', 'Pattern evidence counters.', 'Required'],
  ['confidenceTier / confidenceScore', 'tier + number', 'Runtime pattern confidence.', 'Required tier'],
  ['lastConfirmedAt / lastCorrectedAt', 'epoch seconds', 'Freshness and decay inputs.', 'Recommended'],
  ['exampleCandidateIds / exampleSessionRecordIds', 'array<string>', 'Audit examples that taught the pattern.', 'Required'],
  ['decayAppliedAt', 'epoch seconds', 'Last confidence decay pass.', 'Optional'],
];

const CONFIDENCE_ROWS = Object.entries(PHASE_J_ALLOWED_CONFIDENCE_TRANSITIONS).map(
  ([tier, allowed]) => [
    `\`${tier}\``,
    allowed.map((value) => `\`${value}\``).join(', '),
    tier === 'hold_back'
      ? 'Cannot become a claim without new confirmation, clean evidence, or operator review.'
      : 'Can degrade when new evidence conflicts, coverage drops, or a higher-precedence actor corrects the record.',
  ],
);

const ACTOR_ROWS = PHASE_J_ACTOR_PRECEDENCE.map((actorRole, index) => [
  String(index + 1),
  `\`${actorRole}\``,
  {
    operator: 'Privileged correction or reviewer decision. Highest precedence because it is accountable and audited.',
    coach: 'Practice intent, schedule correction, roster context, or direct staff observation.',
    athlete: 'Direct session confirmation, lift summary, RPE, soreness, or context only the athlete knows.',
    vendor: 'Device or platform classification, useful as evidence but not final meaning by itself.',
    system: 'Pattern/schedule inference. Lowest precedence and must explain what it inferred from.',
  }[actorRole],
]);

const PROVENANCE_FIELD_DESCRIPTIONS: Record<keyof PhaseJRecordProvenance, string> = {
  adapter: 'Adapter or module that normalized the evidence.',
  confidenceHints: 'Adapter or router hints that shaped the confidence tier.',
  ingestedAt: 'When Pulse Check wrote the normalized record.',
  observedAt: 'When the upstream event happened.',
  qualityFlags: 'Coverage gaps, stale data, denied permission, partial parse, conflict, or other warnings.',
  rawRef: 'Optional pointer to raw vendor payload or internal trace.',
  sourceFamily: 'Device/platform/context family, such as polar, apple_health, coach_entered, or pulsecheck_self_report.',
  sourceRecordIds: 'HCSR ids, schedule ids, prompt ids, or raw source ids that support the record.',
  sourceType: 'Concrete adapter/feed, such as polar_live_heartrate or nora_lift_summary_parse.',
};

const PROVENANCE_ROWS = PHASE_J_REQUIRED_PROVENANCE_FIELDS.map((field) => [
  `\`${field}\``,
  PROVENANCE_FIELD_DESCRIPTIONS[field],
  'Required on candidate, confirmation event, and session record.',
]);

const INDEX_ROWS = PHASE_J_INDEX_REQUIREMENTS.map((index) => [
  `\`${index.collection}\``,
  `\`${index.fields}\``,
  index.purpose,
]);

const LOCKED_CHECKLIST_ROWS = [
  ['session_candidate schema', 'Locked', 'Candidate shape includes evidence refs, primitives, status, confidence, missing context, and provenance.'],
  ['context_confirmation_event schema', 'Locked', 'Direct answers, coach confirmations, vendor labels, operator reviews, corrections, and dismissals are first-class records.'],
  ['clarification_prompt schema', 'Locked', 'Nora prompt lifecycle, target, reason, friction bucket, status, expiry, and answer linkage are explicit.'],
  ['session_record schema', 'Locked', 'Canonical downstream record includes session type, primitives, confirmations, context refs, audience summaries, load placeholder, and provenance.'],
  ['athlete_session_pattern schema', 'Locked', 'Repeated confirmations/corrections can teach athlete-specific patterns with confidence and decay.'],
  ['Confidence tiers + transitions', 'Locked', 'Allowed transitions are codified in TypeScript and documented for reviewer/router behavior.'],
  ['Actor precedence', 'Locked', 'operator > coach > athlete > vendor > system.'],
  ['Firestore indexes', 'Locked', 'Athlete, team, date, status, prompt, session, and pattern query paths are listed.'],
  ['Source/provenance requirements', 'Locked', 'Every Phase J record that can affect interpretation must carry required provenance fields.'],
];

const PulseCheckPhaseJSessionSchemaContractTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Sports Intelligence"
        title="Phase J Session Schema Contract"
        version={`Version 0.1 | ${PHASE_J_SESSION_CONTRACT_VERSION} | May 1, 2026`}
        summary="Implementation-facing Firestore and TypeScript contract for the Contextual Sports Detection Engine. This locks candidate, prompt, confirmation, session-record, athlete-pattern, confidence, actor-precedence, index, and provenance rules before runtime work builds on top of them."
        highlights={[
          {
            title: 'Schemas First',
            body: 'The five Phase J collections have concrete field contracts before the primitive accumulator, Nora router, writer, or reviewer surface depend on them.',
          },
          {
            title: 'Confirmation Is Evidence',
            body: 'Athlete answers, coach context, explicit starts, vendor labels, and operator reviews are durable confirmation events, not buried chat text.',
          },
          {
            title: 'Provenance Required',
            body: 'Any record that changes sport meaning, confidence, load, or reporting must carry source family, source type, evidence ids, timestamps, hints, and quality flags.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Phase J contract-lock artifact for contextual session detection. It defines the persistence shape and TypeScript boundary used by device adapters, candidate emitters, Nora clarification, session writers, pattern learning, Sport Load, and reviewer tooling."
        sourceOfTruth="The TypeScript mirror is `src/api/firebase/phaseJSessionContracts.ts`; this page is the admin-facing schema and query contract. Runtime writers must match the contract version before emitting production records."
        masterReference="Use this before implementing the device registry handoff, shared HCSR writer, primitive accumulator, lift vertical slice, Nora clarification router, canonical session writer, or sports-intelligence reviewer."
        relatedDocs={[
          'Contextual Detection Engine',
          'Device Registry',
          'Session Detection + Matching',
          'Sport Load Model',
          'Sports Intelligence Aggregation + Inference Contract',
        ]}
      />

      <SectionBlock icon={Database} title="Canonical Collections">
        <DataTable columns={['Collection', 'Purpose', 'Runtime Role']} rows={COLLECTION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Session Candidate Shape">
        <DataTable columns={['Field', 'Type', 'Meaning', 'Rule']} rows={SESSION_CANDIDATE_FIELDS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Context Confirmation Event Shape">
        <DataTable columns={['Field', 'Type', 'Meaning', 'Rule']} rows={CONFIRMATION_EVENT_FIELDS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Clarification Prompt Shape">
        <DataTable columns={['Field', 'Type', 'Meaning', 'Rule']} rows={CLARIFICATION_PROMPT_FIELDS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Session Record Shape">
        <DataTable columns={['Field', 'Type', 'Meaning', 'Rule']} rows={SESSION_RECORD_FIELDS} />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Athlete Session Pattern Shape">
        <DataTable columns={['Field', 'Type', 'Meaning', 'Rule']} rows={ATHLETE_PATTERN_FIELDS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Confidence Tiers & Allowed Transitions">
        <DataTable columns={['Current Tier', 'Allowed Next Tiers', 'Rule']} rows={CONFIDENCE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Claim Discipline"
            accent="green"
            body="Coach-facing reporting may speak directly only from strong_contextual or confirmed records. Usable and directional records require softer language or reviewer context; hold_back records do not emit claims."
          />
          <InfoCard
            title="Corrections Can Degrade"
            accent="amber"
            body="A higher-precedence correction can lower a record even after conversion. The session record must preserve the confirmation chain that caused the transition."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Actor Precedence">
        <DataTable columns={['Rank', 'Actor Role', 'Why']} rows={ACTOR_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Required Provenance Fields">
        <DataTable columns={['Field', 'Meaning', 'Rule']} rows={PROVENANCE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Firestore Index Requirements">
        <DataTable columns={['Collection', 'Index', 'Purpose']} rows={INDEX_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Phase 0 Lock Status">
        <DataTable columns={['Contract Area', 'Status', 'Result']} rows={LOCKED_CHECKLIST_ROWS} />
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Runtime Import"
            accent="blue"
            body={<BulletList items={['Use `phaseJSessionContracts.ts` from writers and tests.', 'Do not redefine confidence tiers in individual services.', 'Keep collection constants shared.']} />}
          />
          <InfoCard
            title="Storage Rule"
            accent="purple"
            body={<BulletList items={['Candidates are working records.', 'Confirmation events are durable evidence.', 'Session records are the canonical downstream contract.']} />}
          />
          <InfoCard
            title="Next Build Gate"
            accent="green"
            body={<BulletList items={['Device registry can now reference the contract.', 'Shared writer boundary has stable targets.', 'Reviewer skeleton can render candidate -> prompt -> confirmation -> record traces.']} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckPhaseJSessionSchemaContractTab;
