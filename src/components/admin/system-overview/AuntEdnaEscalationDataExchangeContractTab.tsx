import React from 'react';
import { ArrowRightLeft, ClipboardList, Database, Link2, Lock, ShieldCheck, Stethoscope, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const BOUNDARY_ROWS = [
  ['PulseCheck-only product data', 'PulseCheck', 'No by default', 'Athlete profiles, full readiness history, full Nora conversation history, raw simulation history, training-plan internals, and broad product analytics stay inside PulseCheck unless a specific escalation requires a minimum-necessary excerpt or summary.'],
  ['Escalation handoff payload', 'PulseCheck -> AuntEdna', 'Yes', 'AuntEdna should expect a focused case packet for the specific escalation: identity, routing, tier, reason, concise concern summary, consent state, and freshness-aware context.'],
  ['AuntEdna clinical case data', 'AuntEdna', 'No, except limited status metadata back to PulseCheck', 'Clinical intake, triage, notes, diagnosis, care plan, treatment detail, clinician messaging, EHR, billing, and PHI remain AuntEdna-side records.'],
  ['Hybrid operational metadata', 'Both systems, with different depth', 'Yes, limited', 'Shared ids, delivery timestamps, receipt status, status category, assignment label, appointment existence, crisis-pathway state, resolution state, and reconciliation metadata.'],
  ['De-identified aggregate outcomes', 'AuntEdna -> PulseCheck when permitted', 'Yes, aggregate only', 'Pilot and system-improvement signals may return as de-identified buckets, never individual clinical detail.'],
];

const EXPECTED_PAYLOAD_ROWS = [
  ['Handoff envelope', '`pulseEscalationId`, `pulseConversationId`, `handoffId`, `createdAt`, `callbackRef`, `payloadVersion`', 'Gives AuntEdna deterministic ids, timestamps, versioning, and a secure reconciliation path.'],
  ['Escalation classification', '`tier`, `category`, `urgency`, `confidence`, `classificationReason`, `triggerSource`', 'Explains why PulseCheck is creating the handoff without giving AuntEdna the entire product rulebook.'],
  ['Athlete identity', '`pulseUserId`, display name, email or phone when authorized, sport, team, organization, timezone', 'Supports identity matching, intake, and correct routing. Date of birth, guardian, or emergency contact fields should appear only when required by the deployment or safety workflow.'],
  ['Routing context', '`organizationId`, `teamId`, `defaultClinicianProfileId`, `athleteClinicianOverrideId`, provider-pool id, staff point of contact', 'Tells AuntEdna where the case should land and who the operational counterpart is.'],
  ['Consent and disclosure state', '`consentStatus`, `consentedAt`, `disclosureVersion`, `optInChannel`, `lawfulBasisNote`', 'Separates Tier 2 consent-based handoff from Tier 3 immediate safety routing.'],
  ['Concern summary', 'Concise summary, triggering excerpt when necessary, risk flags, support flag state, staff-visible context', 'Provides the minimum context needed for clinical intake without exporting a broad transcript or full account history.'],
  ['Current state snapshot summary', 'Readiness color, activation, focus readiness, emotional load, cognitive fatigue, snapshot freshness, confidence, sources used', 'Gives AuntEdna performance-state context while preserving source provenance and avoiding unsupported clinical interpretation.'],
  ['Recent trend summary', 'Short-window readiness trend, check-in trend, recovery or sleep trend if permitted, adherence or engagement pattern', 'Useful only when it materially helps triage. Send summaries and evidence references, not raw streams.'],
  ['Operational refs', '`stateSnapshotId`, `sourceRecordIds[]`, `coachVisibleSummaryId`, retry count, delivery attempt id', 'Allows audit and troubleshooting without forcing AuntEdna to ingest raw PulseCheck source records.'],
];

const AUNTEDNA_ONLY_ROWS = [
  ['Clinical case record', 'AuntEdna case id, intake state, clinical workflow owner, clinical timeline', 'PulseCheck may store only the external case id and coarse status category needed for reconciliation.'],
  ['Clinical intake and triage answers', 'Detailed responses collected inside AuntEdna after handoff', 'PulseCheck does not mirror these answers unless separately authorized in writing.'],
  ['Clinician assignment details', 'Assigned clinician, provider lane, staffing notes, clinical handoff notes', 'PulseCheck may display only limited routing metadata such as assigned lane or display-safe provider label when permitted.'],
  ['Care actions', 'Appointment details, care coordination actions, crisis-pathway decisions, clinician outreach notes', 'PulseCheck may store operational state such as appointment booked or crisis pathway invoked, not clinical content.'],
  ['Protected clinical records', 'PHI, EHR records, diagnosis, treatment plan, billing, CPT data, insurance data', 'These stay in AuntEdna and should not be returned to PulseCheck by default.'],
  ['Clinician-patient communications', 'Clinical messages, notes, and care-team communications inside AuntEdna', 'PulseCheck may show only operational status, not message contents.'],
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
  ['Full Nora conversation history', 'AuntEdna should receive a concise escalation-relevant summary or excerpt only when necessary.'],
  ['Raw wearable streams and raw vendor payloads', 'AuntEdna should receive interpreted context and freshness/provenance, not raw HealthKit, Oura, Polar, or other vendor streams.'],
  ['Full training or simulation history', 'AuntEdna should receive a brief current-state or trend summary only when it materially helps the handoff.'],
  ['PulseCheck assignment and protocol internals', 'AuntEdna does not need hidden product decision logic, training-plan internals, or protocol generation state.'],
  ['Broad school, roster, or organization exports', 'Only the team and organization routing details needed for the specific case should cross.'],
  ['Out-of-scope analytics', 'Growth, engagement, marketing, billing, and unrelated product analytics stay outside the clinical bridge.'],
];

const WEBHOOK_ROWS = [
  ['`escalation.created`', 'AuntEdna accepted the handoff and created a case.', 'Store `auntEdnaCaseId`, status, receipt timestamp, and event id.'],
  ['`triage.requested`', 'AuntEdna needs more information or athlete intake action.', 'Prompt the correct actor or flag operator follow-up without exposing clinical detail.'],
  ['`clinician.assigned`', 'A clinician or provider lane was assigned.', 'Store display-safe assignment label and assignment timestamp only.'],
  ['`appointment.booked`', 'A care appointment exists.', 'Show operational follow-up state; do not store appointment notes or clinical content.'],
  ['`crisis.invoked`', 'A crisis pathway was invoked in AuntEdna.', 'Keep PulseCheck in safety mode and suppress inappropriate performance flows.'],
  ['`case.resolved`', 'The acute handoff workflow ended or shifted to ongoing care.', 'Update status and relax acute banners where policy allows.'],
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
    body: 'AuntEdna receives the packet, creates its own case record, and becomes source of truth for intake, triage, care actions, and clinical workflow.',
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
  ['Aggregate outcomes', 'Define the de-identified outcome buckets AuntEdna may return for pilot reporting and product improvement.'],
];

const AuntEdnaEscalationDataExchangeContractTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="AuntEdna Integration"
        title="Escalation Data Exchange Contract"
        version="Version 0.1 | June 1, 2026"
        summary="Partner-facing data contract for the PulseCheck to AuntEdna escalation bridge. This page explains what AuntEdna should expect from PulseCheck, what AuntEdna stores that PulseCheck does not, and which limited operational fields are shared across both systems."
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
            body: 'Shared data should be ids, timestamps, status categories, routing labels, retry state, and de-identified aggregate outcomes where permitted.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Partner-facing implementation artifact for the data boundary between PulseCheck escalation records and AuntEdna clinical case records."
        sourceOfTruth="This document is authoritative for the expected escalation handoff payload categories, AuntEdna-only clinical data categories, PulseCheck-only data categories, hybrid operational metadata, and open decisions before endpoint contract lock."
        masterReference="Use this page when AuntEdna asks what data to expect from PulseCheck, what they should store on their side, what PulseCheck must not mirror, or how shared operational status should work."
        relatedDocs={[
          'AuntEdna Integration Strategy',
          'Exhibit A - Data Architecture, Handoff, and System Boundaries',
          'Exhibit B - Performance Standards',
          'Escalation Integration Spec v1.1',
          'Health Context Source Record Spec',
        ]}
      />

      <SectionBlock icon={Database} title="System Boundary Summary">
        <DataTable columns={['Data Class', 'System of Record', 'Crosses Boundary?', 'Rule']} rows={BOUNDARY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="What AuntEdna Should Expect From PulseCheck">
        <DataTable columns={['Payload Category', 'Expected Fields', 'Why AuntEdna Needs It']} rows={EXPECTED_PAYLOAD_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Payload Shape"
            accent="blue"
            body="The production payload should be JSON, versioned, signed, idempotent, and scoped to one escalation. Fields should be omitted when unavailable or not authorized rather than filled with guessed values."
          />
          <InfoCard
            title="Evidence Posture"
            accent="amber"
            body="PulseCheck should send summaries, excerpts, source ids, confidence, and freshness. Raw transcripts, raw wearable streams, and full histories should require a separate written approval path."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Stethoscope} title="What AuntEdna Stores That PulseCheck Does Not">
        <DataTable columns={['AuntEdna Data Category', 'Examples', 'PulseCheck Boundary']} rows={AUNTEDNA_ONLY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Hybrid Operational Metadata">
        <DataTable columns={['Shared Field Group', 'Examples', 'Why It Is Shared']} rows={HYBRID_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Lock} title="PulseCheck Data That Should Not Cross By Default">
        <InfoCard title="Default Non-Disclosure Set" accent="red" body={<BulletList items={PULSECHECK_ONLY_ROWS.map(([category, rule]) => `${category}: ${rule}`)} />} />
      </SectionBlock>

      <SectionBlock icon={Link2} title="Expected AuntEdna Status Webhooks">
        <DataTable columns={['Webhook', 'Meaning', 'PulseCheck Mirror Behavior']} rows={WEBHOOK_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Exchange Lifecycle">
        <StepRail steps={FLOW_STEPS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Contract Lock Decisions">
        <DataTable columns={['Decision', 'What Needs To Be Agreed']} rows={DECISION_ROWS} />
      </SectionBlock>
    </div>
  );
};

export default AuntEdnaEscalationDataExchangeContractTab;
