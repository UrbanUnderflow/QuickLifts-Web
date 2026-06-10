import React from 'react';
import { ArrowRightLeft, ClipboardList, Database, Link2, Lock, Server, ShieldCheck, Stethoscope, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const BOUNDARY_CARDS = [
  {
    title: 'PulseCheck-only product data',
    owner: 'PulseCheck',
    crosses: 'No by default',
    body: 'Athlete profiles, full readiness history, full Nora conversation history, raw simulation history, training-plan internals, and broad product analytics stay inside PulseCheck unless a specific escalation requires a minimum-necessary excerpt or summary.',
  },
  {
    title: 'Escalation handoff payload',
    owner: 'PulseCheck -> AuntEdna',
    crosses: 'Yes',
    body: 'PulseCheck sends a focused case packet for the specific escalation: identity, routing, tier, reason, concise concern summary, consent state, and freshness-aware context.',
  },
  {
    title: 'AuntEdna clinical case data',
    owner: 'AuntEdna',
    crosses: 'No, except limited status metadata back to PulseCheck',
    body: 'Clinical intake, triage, notes, diagnosis, care plan, treatment detail, clinician messaging, EHR, billing, and PHI remain AuntEdna-side records.',
  },
  {
    title: 'Hybrid operational metadata',
    owner: 'Both systems, with different depth',
    crosses: 'Yes, limited',
    body: 'Shared ids, delivery timestamps, receipt status, status category, assignment label, appointment existence, crisis-pathway state, resolution state, and reconciliation metadata.',
  },
  {
    title: 'De-identified aggregate outcomes',
    owner: 'AuntEdna -> PulseCheck when permitted',
    crosses: 'Yes, aggregate only',
    body: 'Pilot and system-improvement signals may return as de-identified buckets, never individual clinical detail.',
  },
];

const EXPECTED_PAYLOAD_CARDS = [
  {
    title: 'Handoff envelope',
    fields: ['pulseEscalationId', 'pulseConversationId', 'handoffId', 'createdAt', 'callbackRef', 'payloadVersion'],
    why: 'Gives AuntEdna deterministic ids, timestamps, versioning, and a secure reconciliation path.',
  },
  {
    title: 'Escalation classification',
    fields: ['tier', 'category', 'urgency', 'confidence', 'classificationReason', 'triggerSource'],
    why: 'Explains why PulseCheck is creating the handoff without exposing the entire product rulebook.',
  },
  {
    title: 'Athlete identity',
    fields: ['pulseUserId', 'displayName', 'email or phone when authorized', 'sport', 'team', 'organization', 'timezone'],
    why: 'Supports identity matching, intake, and correct routing.',
    note: 'Date of birth, guardian, or emergency contact fields appear only when required by the deployment or safety workflow.',
  },
  {
    title: 'Routing context',
    fields: ['organizationId', 'teamId', 'defaultClinicianProfileId', 'athleteClinicianOverrideId', 'providerPoolId', 'staffPointOfContact'],
    why: 'Identifies where the case should land and who the operational counterpart is.',
  },
  {
    title: 'Consent and disclosure state',
    fields: ['consentStatus', 'consentedAt', 'disclosureVersion', 'optInChannel', 'lawfulBasisNote'],
    why: 'Separates Tier 2 consent-based handoff from Tier 3 immediate safety routing.',
  },
  {
    title: 'Concern summary',
    fields: ['conciseSummary', 'triggeringExcerpt', 'riskFlags', 'supportFlagState', 'staffVisibleContext'],
    why: 'Provides the minimum context needed for clinical intake without exporting a broad transcript or full account history.',
  },
  {
    title: 'Current state snapshot summary',
    fields: ['readinessColor', 'activation', 'focusReadiness', 'emotionalLoad', 'cognitiveFatigue', 'snapshotFreshness', 'confidence', 'sourcesUsed'],
    why: 'Gives the intake team performance-state context while preserving source provenance and avoiding unsupported clinical interpretation.',
  },
  {
    title: 'Recent trend summary',
    fields: ['readinessTrend', 'checkInTrend', 'recoveryOrSleepTrend', 'adherencePattern', 'engagementPattern'],
    why: 'Included only when it materially helps triage.',
    note: 'PulseCheck sends summaries and evidence references, not raw streams.',
  },
  {
    title: 'Operational references',
    fields: ['stateSnapshotId', 'sourceRecordIds[]', 'coachVisibleSummaryId', 'retryCount', 'deliveryAttemptId'],
    why: 'Allows audit and troubleshooting without requiring AuntEdna to ingest raw PulseCheck source records.',
  },
];

const REFERENCE_PAYLOAD = `POST {AUNTEDNA_BASE_URL}/escalations
Authorization: Bearer <api key>
X-Pulse-Integration: true
Content-Type: application/json

{
  "pulseUserId": "pulse-user-id",
  "pulseConversationId": "conversation-id",
  "escalationRecordId": "escalation-record-id",
  "athlete": {
    "userId": "pulse-user-id",
    "displayName": "Jordan A.",
    "email": "jordan@example.com",
    "username": "jordan.a",
    "sport": "basketball",
    "goals": ["..."],
    "dateOfBirth": "2004-03-18",
    "emergencyContact": { "name": "...", "phone": "...", "relationship": "..." }
  },
  "tier": 3,
  "category": "suicidal-ideation",
  "triggerContent": "<triggering message excerpt>",
  "classificationReason": "<classifier rationale>",
  "conversationSummary": "<concise intake summary>",
  "relevantMentalNotes": [
    { "id": "...", "title": "...", "content": "...", "category": "...", "severity": "..." }
  ],
  "escalationTimestamp": 1765432100000,
  "pulseApiCallback": "https://<pulse-environment>/.netlify/functions/auntedna-callback"
}`;

const CLASSIFICATION_VOCABULARY_ROWS = [
  ['`tier`', '`2` (Elevated Risk, consent-based handoff) or `3` (Critical Risk, mandatory handoff)', 'Tier 1 monitor-only concerns never cross the boundary.'],
  [
    'Tier 2 `category` values',
    '`persistent-distress`, `anxiety-indicators`, `disordered-eating`, `identity-impact`, `injury-psychological`, `recurrent-tier1`',
    'Tier 2 packets always carry an accepted consent state.',
  ],
  [
    'Tier 3 `category` values',
    '`self-harm`, `suicidal-ideation`, `imminent-safety-risk`, `severe-psychological-distress`, `abuse-disclosure`, `rapid-deterioration`',
    'Tier 3 packets route immediately; consent is recorded as `not-required`.',
  ],
];

const AUNTEDNA_API_ROWS = [
  ['`GET /health`', 'Availability check before and during handoff attempts.', 'HTTP 200 while the service can accept escalations.'],
  [
    '`POST /athletes`',
    'Upsert the athlete identity ahead of case creation, keyed by `externalId` (the PulseCheck user id). Must be idempotent.',
    '`{ athleteId, externalId, createdAt, status: "active" | "pending" }`',
  ],
  [
    '`POST /escalations`',
    'Submit the escalation case packet and create the clinical case. This is the primary handoff call.',
    '`{ escalationId, status: "received" | "processing" | "assigned", clinicianAssigned?, estimatedContactTime?, crisisResourcesProvided }`',
  ],
  [
    '`GET /athletes/{pulseUserId}/status`',
    'Coarse operational status for dashboards and workflow suppression. No clinical content.',
    '`{ athleteId, escalationStatus: "none" | "active" | "in_progress" | "resolved", currentTier?, lastContactAt?, clinicianId?, noteForCoach? }` where `noteForCoach` is a display-safe, non-clinical note.',
  ],
  [
    '`POST /escalations/{escalationId}/resolve`',
    'Record resolution from clinical staff: `{ status: "resolved" | "ongoing_care", coachNote?, followUpScheduled? }`. Clinical notes stay AuntEdna-side.',
    '`{ resolved: true }`',
  ],
  [
    '`GET /clinician-profiles?search=`',
    'Search clinician, group, and provider-pool profiles that PulseCheck teams can attach for routing.',
    'Array of `{ id, displayName, organizationName?, email?, profileType: "individual" | "group" | "provider" }`',
  ],
  [
    '`POST /clinician-profiles`',
    'Create a clinician profile and return its external identity for routing configuration.',
    'The created profile object, same shape as search results.',
  ],
  [
    '`POST /conversations` and `POST /conversations/messages`',
    'Deployment-optional clinical message capture during an active Tier 3 safety-mode session. Disabled unless separately authorized in writing.',
    '`{ conversationId, messagesStored, encryptionStatus }` / `{ messageId, stored }`',
  ],
];

const AUNTEDNA_ONLY_ROWS = [
  ['Clinical case record', 'AuntEdna case id, intake state, clinical workflow owner, clinical timeline', 'PulseCheck stores only the external case id and the coarse status category needed for reconciliation.'],
  ['Clinical intake and triage answers', 'Detailed responses collected inside AuntEdna after handoff', 'PulseCheck does not mirror these answers unless separately authorized in writing.'],
  ['Clinician assignment details', 'Assigned clinician, provider lane, staffing notes, clinical handoff notes', 'PulseCheck displays only limited routing metadata such as assigned lane or display-safe provider label when permitted.'],
  ['Care actions', 'Appointment details, care coordination actions, crisis-pathway decisions, clinician outreach notes', 'PulseCheck stores operational state such as appointment booked or crisis pathway invoked, not clinical content.'],
  ['Protected clinical records', 'PHI, EHR records, diagnosis, treatment plan, billing, CPT data, insurance data', 'These stay in AuntEdna and are not returned to PulseCheck by default.'],
  ['Clinician-patient communications', 'Clinical messages, notes, and care-team communications inside AuntEdna', 'PulseCheck shows only operational status, not message contents.'],
];

const HYBRID_ROWS = [
  ['Shared correlation ids', '`pulseEscalationId`, `auntEdnaCaseId`, `handoffId`, `webhookEventId`', 'Both systems need these to reconcile the same case without copying full records.'],
  ['Receipt and delivery state', '`sent`, `received`, `accepted`, `failed`, `retrying`, `manual_fallback`', 'PulseCheck owns send attempts; AuntEdna owns receipt acknowledgment.'],
  ['Case status category', '`created`, `triage_requested`, `assigned`, `appointment_booked`, `crisis_invoked`, `resolved`, `closed`', 'Coarse status only. This drives UI and workflow suppression without exposing clinical notes.'],
  ['Assignment label', 'Display-safe provider pool, clinician lane, campus support lane, or external profile label', 'Useful for operators and dashboards; not a clinical note.'],
  ['Timing metrics', 'Received at, acknowledged at, triage requested at, first outreach attempted at, resolved at', 'Supports Exhibit B performance standards and speed-to-care reporting.'],
  ['Outcome bucket', 'De-identified aggregate outcome category, when permitted', 'Used for pilot review and system improvement, not individual-level clinical storytelling.'],
  ['Error and audit metadata', 'HTTP status, webhook status, retry count, signature validation result, operator fallback note', 'Operational debug data belongs in both systems where needed for incident review.'],
];

const PULSECHECK_ONLY_ROWS = [
  ['Full Nora conversation history', 'AuntEdna receives a concise escalation-relevant summary or excerpt only when necessary.'],
  ['Raw wearable streams and raw vendor payloads', 'AuntEdna receives interpreted context with freshness and provenance, not raw HealthKit, Oura, Polar, or other vendor streams.'],
  ['Full training or simulation history', 'AuntEdna receives a brief current-state or trend summary only when it materially helps the handoff.'],
  ['PulseCheck assignment and protocol internals', 'Hidden product decision logic, training-plan internals, and protocol generation state do not cross.'],
  ['Broad school, roster, or organization exports', 'Only the team and organization routing details needed for the specific case cross the boundary.'],
  ['Out-of-scope analytics', 'Growth, engagement, marketing, billing, and unrelated product analytics stay outside the clinical bridge.'],
];

const WEBHOOK_ROWS = [
  ['`escalation.created`', 'AuntEdna accepted the handoff and created a case.', 'PulseCheck stores `auntEdnaCaseId`, status, receipt timestamp, and event id.'],
  ['`triage.requested`', 'AuntEdna needs more information or athlete intake action.', 'PulseCheck prompts the correct actor or flags operator follow-up without exposing clinical detail.'],
  ['`clinician.assigned`', 'A clinician or provider lane was assigned.', 'PulseCheck stores a display-safe assignment label and the assignment timestamp only.'],
  ['`appointment.booked`', 'A care appointment exists.', 'PulseCheck shows operational follow-up state; it does not store appointment notes or clinical content.'],
  ['`crisis.invoked`', 'A crisis pathway was invoked in AuntEdna.', 'PulseCheck stays in safety mode and suppresses inappropriate performance flows.'],
  ['`case.resolved`', 'The acute handoff workflow ended or shifted to ongoing care.', 'PulseCheck updates status and relaxes acute banners where policy allows.'],
];

const FLOW_STEPS = [
  {
    title: 'PulseCheck detects and classifies the concern',
    body: 'PulseCheck owns non-clinical detection, tiering, consent state, and staff visibility before the handoff leaves the product boundary.',
    owner: 'PulseCheck',
  },
  {
    title: 'PulseCheck builds the minimum-necessary case packet',
    body: 'The handoff packet includes identity, routing, concern summary, consent state, current state context, and evidence references scoped to the specific escalation.',
    owner: 'PulseCheck',
  },
  {
    title: 'AuntEdna creates the clinical case',
    body: 'AuntEdna receives the packet via POST /escalations, creates its own case record, and becomes source of truth for intake, triage, care actions, and clinical workflow.',
    owner: 'AuntEdna',
  },
  {
    title: 'AuntEdna returns coarse operational status',
    body: 'AuntEdna sends signed webhook events with status categories, timestamps, display-safe routing labels, and reconciliation ids only.',
    owner: 'AuntEdna -> PulseCheck',
  },
  {
    title: 'PulseCheck mirrors only workflow state',
    body: 'PulseCheck updates dashboards, safety mode, retry state, and non-clinical coordination from the limited operational mirror.',
    owner: 'PulseCheck',
  },
];

const DECISION_ROWS = [
  ['Exact optional identity fields by deployment', 'Define when date of birth, guardian, emergency contact, or phone number is included.'],
  ['Escalation summary format', 'Agree on the exact summary schema, maximum length, excerpt rules, and redaction rules.'],
  ['Trend window defaults', 'Agree whether the default trend window is 24 hours, 7 days, 14 days, or deployment-specific.'],
  ['Webhook status vocabulary', 'Lock the shared enum so PulseCheck dashboards do not need to infer clinical workflow state.'],
  ['Webhook signing and retry policy', 'Agree on the signature scheme (for example an HMAC header), retry cadence, timeout, and idempotency key semantics.'],
  ['Aggregate outcomes', 'Define the de-identified outcome buckets AuntEdna may return for pilot reporting and product improvement.'],
];

const FieldChipList: React.FC<{ fields: string[] }> = ({ fields }) => (
  <div className="flex flex-wrap gap-2">
    {fields.map((field) => (
      <code key={field} className="rounded-md border border-zinc-700 bg-black/35 px-2 py-1 text-xs text-zinc-200">
        {field}
      </code>
    ))}
  </div>
);

const CodeBlock: React.FC<{ code: string }> = ({ code }) => (
  <pre className="overflow-x-auto rounded-2xl border border-zinc-800 bg-black/35 p-4 font-mono text-xs leading-relaxed text-zinc-200">
    {code}
  </pre>
);

const InlineCode: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split('`');
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <code key={index} className="rounded bg-black/40 px-1 py-0.5 font-mono text-[11px] text-zinc-200">
            {part}
          </code>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        ),
      )}
    </>
  );
};

const BoundaryCard: React.FC<(typeof BOUNDARY_CARDS)[number]> = ({ title, owner, crosses, body }) => (
  <article className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{body}</p>
      </div>
      <div className="grid min-w-[220px] gap-2 text-xs">
        <div className="rounded-lg border border-zinc-800 bg-black/25 p-2">
          <p className="uppercase tracking-wide text-zinc-500">Owner</p>
          <p className="mt-1 text-zinc-200">{owner}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-black/25 p-2">
          <p className="uppercase tracking-wide text-zinc-500">Crosses Boundary</p>
          <p className="mt-1 text-zinc-200">{crosses}</p>
        </div>
      </div>
    </div>
  </article>
);

const PayloadCard: React.FC<(typeof EXPECTED_PAYLOAD_CARDS)[number]> = ({ title, fields, why, note }) => (
  <article className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-4">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{why}</p>
        {note ? <p className="mt-2 text-xs leading-relaxed text-amber-200/80">{note}</p> : null}
      </div>
      <div className="w-full xl:max-w-[520px]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Expected fields</p>
        <FieldChipList fields={fields} />
      </div>
    </div>
  </article>
);

const ThreePartCardList: React.FC<{
  rows: string[][];
  secondLabel: string;
  thirdLabel: string;
}> = ({ rows, secondLabel, thirdLabel }) => (
  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
    {rows.map(([title, second, third]) => (
      <article key={title} className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-4">
        <p className="text-sm font-semibold text-white">
          <InlineCode text={title} />
        </p>
        <div className="mt-3 grid gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{secondLabel}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-300">
              <InlineCode text={second} />
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{thirdLabel}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-300">
              <InlineCode text={third} />
            </p>
          </div>
        </div>
      </article>
    ))}
  </div>
);

const TwoPartCardList: React.FC<{
  rows: string[][];
  bodyLabel: string;
}> = ({ rows, bodyLabel }) => (
  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
    {rows.map(([title, body]) => (
      <article key={title} className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-4">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{bodyLabel}</p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-300">{body}</p>
      </article>
    ))}
  </div>
);

const AuntEdnaEscalationDataExchangeContractTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="AuntEdna Integration"
        title="Escalation Data Exchange Contract"
        version="Version 0.2 | June 10, 2026"
        summary="Data contract for the PulseCheck to AuntEdna escalation bridge, written for the AuntEdna engineering team. It defines the case packet PulseCheck sends for each escalation, the API surface PulseCheck calls on the AuntEdna side, the status webhooks PulseCheck consumes in return, and the boundary rules for what each system stores."
        highlights={[
          {
            title: 'Case Packet, Not Data Export',
            body: 'AuntEdna receives a focused escalation handoff packet for a specific case, not broad PulseCheck account, conversation, training, or wearable history.',
          },
          {
            title: 'AuntEdna Owns Clinical Detail',
            body: 'Clinical intake, triage, notes, care actions, EHR, billing, and PHI stay in AuntEdna. PulseCheck mirrors only coarse operational status.',
          },
          {
            title: 'Hybrid Data Is Operational',
            body: 'Shared data is limited to ids, timestamps, status categories, routing labels, retry state, and de-identified aggregate outcomes where permitted.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        sectionLabel="Document Role"
        role="Engineering reference for the AuntEdna team implementing the escalation bridge. It defines what crosses the PulseCheck-AuntEdna boundary, in which direction, and what stays on each side."
        sourceOfTruth="This document is authoritative for the escalation handoff payload, the AuntEdna API surface PulseCheck integrates against, the status webhooks PulseCheck consumes, and the data-residency boundaries between the two systems. Where it conflicts with older drafts, this document wins until superseded by a later version."
        masterReference="Master reference for the escalation data exchange: the data that arrives from PulseCheck, the data AuntEdna stores on its side, the data PulseCheck never mirrors, and how shared operational status is represented across both systems."
        relatedDocs={[
          'AuntEdna Integration Strategy',
          'Exhibit A - Data Architecture, Handoff, and System Boundaries',
          'Exhibit B - Performance Standards',
          'Escalation Integration Spec v1.1',
          'Health Context Source Record Spec',
        ]}
      />

      <SectionBlock icon={Database} title="System Boundary Summary">
        <div className="space-y-3">
          {BOUNDARY_CARDS.map((card) => (
            <BoundaryCard key={card.title} {...card} />
          ))}
        </div>
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Exchange Lifecycle">
        <StepRail steps={FLOW_STEPS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Escalation Case Packet (PulseCheck to AuntEdna)">
        <div className="space-y-3">
          {EXPECTED_PAYLOAD_CARDS.map((card) => (
            <PayloadCard key={card.title} {...card} />
          ))}
        </div>
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Payload Shape"
            accent="blue"
            body="The production payload is JSON, versioned, signed, idempotent, and scoped to one escalation. Fields are omitted when unavailable or not authorized rather than filled with guessed values."
          />
          <InfoCard
            title="Evidence Posture"
            accent="amber"
            body="PulseCheck sends summaries, excerpts, source ids, confidence, and freshness. Raw transcripts, raw wearable streams, and full histories require a separate written approval path."
          />
        </CardGrid>
        <InfoCard
          title="Reference Payload (current wire shape)"
          accent="purple"
          body={
            <div className="space-y-3">
              <p>
                The shape below is what PulseCheck transmits today. The v1 envelope fields above (handoffId, payloadVersion,
                signature, routing context, consent state, state snapshot summary) layer onto this shape as part of contract
                lock. Optional athlete fields are omitted when not authorized for the deployment.
              </p>
              <CodeBlock code={REFERENCE_PAYLOAD} />
            </div>
          }
        />
        <ThreePartCardList rows={CLASSIFICATION_VOCABULARY_ROWS} secondLabel="Values" thirdLabel="Notes" />
      </SectionBlock>

      <SectionBlock icon={Server} title="API Surface PulseCheck Calls on AuntEdna">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Authentication and Transport"
            accent="blue"
            body={
              <p>
                All requests are JSON over HTTPS, authenticated with{' '}
                <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[11px]">Authorization: Bearer &lt;api key&gt;</code>{' '}
                and the header{' '}
                <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[11px]">X-Pulse-Integration: true</code>. Keys are
                exchanged per environment during onboarding.
              </p>
            }
          />
          <InfoCard
            title="Response Envelope"
            accent="green"
            body={
              <div className="space-y-2">
                <p>Every endpoint returns a consistent envelope. PulseCheck logs the request id for joint incident review.</p>
                <CodeBlock code={`{ "success": boolean, "data": { ... }, "error": { "code", "message" }, "requestId": "..." }`} />
              </div>
            }
          />
        </CardGrid>
        <ThreePartCardList rows={AUNTEDNA_API_ROWS} secondLabel="Purpose" thirdLabel="Expected response data" />
      </SectionBlock>

      <SectionBlock icon={Link2} title="Status Webhooks (AuntEdna to PulseCheck)">
        <InfoCard
          title="Delivery Requirements"
          accent="blue"
          body="Each event is signed, carries a unique webhookEventId for idempotent processing, and is retried until PulseCheck acknowledges with a 2xx response. Events post to the PulseCheck callback URL included in each handoff packet (pulseApiCallback). The signature scheme and retry cadence are open decisions below."
        />
        <ThreePartCardList rows={WEBHOOK_ROWS} secondLabel="Meaning" thirdLabel="PulseCheck mirror behavior" />
      </SectionBlock>

      <SectionBlock icon={Stethoscope} title="What AuntEdna Stores That PulseCheck Does Not">
        <ThreePartCardList rows={AUNTEDNA_ONLY_ROWS} secondLabel="Examples" thirdLabel="PulseCheck boundary" />
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Hybrid Operational Metadata">
        <ThreePartCardList rows={HYBRID_ROWS} secondLabel="Examples" thirdLabel="Why it is shared" />
      </SectionBlock>

      <SectionBlock icon={Lock} title="PulseCheck Data That Does Not Cross By Default">
        <InfoCard title="Default Non-Disclosure Set" accent="red" body={<BulletList items={PULSECHECK_ONLY_ROWS.map(([category, rule]) => `${category}: ${rule}`)} />} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Open Decisions Before Contract Lock">
        <TwoPartCardList rows={DECISION_ROWS} bodyLabel="What needs to be agreed" />
      </SectionBlock>
    </div>
  );
};

export default AuntEdnaEscalationDataExchangeContractTab;
