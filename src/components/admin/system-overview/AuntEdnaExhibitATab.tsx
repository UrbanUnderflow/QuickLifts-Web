import React from 'react';
import { Database, Link2, Lock, ShieldCheck, Trash2, Waypoints } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const SYSTEM_ROWS = [
  ['Athlete identity and account profile', 'PulseCheck', 'Minimum necessary identity and contact fields for the specific handoff only', 'PulseCheck remains source of truth for non-clinical account data.'],
  ['Team, organization, and routing configuration', 'PulseCheck', 'Routing metadata needed to reach the correct AuntEdna destination', 'AuntEdna may store only the routing metadata required to receive and process the escalation.'],
  ['Athlete-facing non-clinical check-in and readiness data', 'PulseCheck', 'Minimum necessary non-clinical context for the escalation handoff', 'No broad non-clinical exports.'],
  ['Performance and training data', 'PulseCheck', 'Only when operationally necessary to contextualize the handoff', 'No unrelated analytics, competing-product use, or out-of-scope model training.'],
  ['Escalation conditions and non-clinical routing logic', 'PulseCheck', 'No, except descriptive operational documentation as needed', 'AuntEdna does not control PulseCheck product logic.'],
  ['PulseCheck escalation records and audit metadata', 'PulseCheck', 'Yes, in part', 'PulseCheck remains source of truth for event creation, consent capture, and handoff initiation metadata.'],
  ['AuntEdna clinician-profile and routing records', 'AuntEdna', 'Display-safe routing labels, linkage validation, and operational handoff status only', 'PulseCheck may store only a local mirror of routing metadata and sync state.'],
  ['Clinical intake, triage, and support records', 'AuntEdna', 'No, except limited operational status metadata', 'PulseCheck may not store clinical notes, diagnosis, treatment detail, or protected care documentation.'],
  ['PHI, EHR, billing, and CPT data', 'AuntEdna', 'No, unless separately authorized in writing', 'No PHI enters PulseCheck by default.'],
  ['PulseCheck-side operational mirror of clinical handoff state', 'AuntEdna for underlying state; PulseCheck for the mirror object', 'Yes, but only as limited operational status metadata', 'Mirror supports dashboards, retry logic, workflow suppression, and non-clinical coordination only.'],
  ['De-identified aggregate outcome signals', 'AuntEdna', 'Yes', 'De-identified and aggregated only; no individual-level clinical data.'],
];

const PAYLOAD_ROWS = [
  ['`pulseUserId` / unique athlete reference', 'Required', 'PulseCheck athlete identifier.'],
  ['`pulseConversationId`', 'Required', 'Conversation reference relevant to the escalation.'],
  ['`escalationRecordId`', 'Required', 'PulseCheck escalation record identifier.'],
  ['Display-safe identity fields', 'Required as reasonably necessary', 'Name, username, email, sport, goals, and similar fields for identity matching and intake routing.'],
  ['Team or organization context', 'Optional, but permitted', 'Routing context needed to place the athlete into the correct support lane.'],
  ['Date of birth and emergency contact', 'Permitted only where reasonably necessary', 'Used only for safety response, identity verification, or customer requirements.'],
  ['Escalation tier and category', 'Required', 'PulseCheck escalation classification.'],
  ['Triggering-content excerpt or concise summary', 'Required, subject to minimum necessity', 'Specific triggering excerpt or concise summary, not broad transcript history.'],
  ['Classification reason', 'Required', 'PulseCheck non-clinical reason for classification.'],
  ['Conversation summary', 'Permitted and recommended', 'Concise summary prepared for handoff.'],
  ['Relevant non-clinical notes or context summary', 'Optional, but permitted if minimum necessary', 'Limited support context relevant to intake.'],
  ['Escalation timestamp', 'Required', 'Time of handoff event creation.'],
  ['PulseCheck callback or reconciliation reference', 'Optional, but permitted', 'Secure callback or lookup reference for operational reconciliation.'],
];

const FLOW_STEPS = [
  {
    title: 'Athlete interacts with PulseCheck',
    body: 'PulseCheck owns the non-clinical athlete-facing workflow, readiness state, and support pathway before any clinical handoff occurs.',
    owner: 'PulseCheck',
  },
  {
    title: 'PulseCheck evaluates escalation conditions',
    body: 'PulseCheck applies its own detection, thresholding, classification, consent, and routing logic inside the product boundary.',
    owner: 'PulseCheck',
  },
  {
    title: 'PulseCheck creates the escalation record',
    body: 'PulseCheck stores its own escalation record, timestamps, consent state, and coach or staff visibility state.',
    owner: 'PulseCheck',
  },
  {
    title: 'PulseCheck transmits the minimum necessary handoff payload',
    body: 'Only the approved escalation payload crosses the boundary into AuntEdna.',
    owner: 'PulseCheck -> AuntEdna',
  },
  {
    title: 'AuntEdna owns intake, triage, and care actions',
    body: 'AuntEdna receives the case, creates or updates its own clinical-side record, and runs downstream clinical workflow inside AuntEdna.',
    owner: 'AuntEdna',
  },
  {
    title: 'AuntEdna may return limited operational status metadata',
    body: 'Only the operational status metadata permitted by Exhibit A may flow back into the PulseCheck-side operational mirror.',
    owner: 'AuntEdna -> PulseCheck',
  },
];

const ACCESS_ROWS = [
  ['Pulse Intelligence Labs personnel', 'PulseCheck account, readiness, performance, support, non-clinical escalation records, display-safe routing metadata, and de-identified aggregate outcome signals', 'AuntEdna clinical notes, PHI, EHR records, diagnostic interpretation, treatment documentation, or billing records'],
  ['AuntEdna personnel', 'Transmitted escalation payload data, routing context, and limited PulseCheck operational metadata relevant to the active escalated case', 'Unrelated PulseCheck datasets, broad performance histories, or PulseCheck product logic beyond descriptive operational understanding'],
  ['Coach-facing PulseCheck views', 'Privacy-safe readiness, performance, and support or safety visibility according to role', 'Raw clinical detail, AuntEdna clinical records, or clinical interpretation'],
];

const USE_ROWS = [
  ['Pulse Intelligence Labs', 'Operate PulseCheck, generate and route non-clinical escalations, maintain operational workflows, improve detection/routing/support, and use de-identified aggregate feedback for system improvement'],
  ['AuntEdna', 'Perform intake, triage, clinical support, care coordination, compliance, handoff reconciliation, and generate de-identified aggregate outcome signals permitted by the Agreement'],
  ['Neither Party', 'No selling shared data, no out-of-scope model training, no competing-product development based on the other party’s shared data, and no broad shadow database of the other party’s core operational system'],
];

const GOVERNANCE_ITEMS = [
  'Each party may retain integration-shared data only as long as reasonably necessary for operations, compliance, audit, security, dispute resolution, and permitted logs or backups.',
  'Each party must maintain a written retention schedule or retention policy for the integration-shared data categories it receives and provide it on reasonable request.',
  'Security controls include encryption in transit, role-based access controls, access logging, credential management, and incident-response procedures.',
  'No PHI enters PulseCheck unless separately authorized in writing.',
  'Changes to payload fields, allowed data categories, endpoints, authentication methods, webhooks, routing rules, or operational status metadata require mutual written approval, subject to the emergency security-change carveout.',
];

const AuntEdnaExhibitATab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="AuntEdna Integration"
        title="Exhibit A - Data Architecture, Handoff, and System Boundaries"
        version="Agreement Draft Lock | April 1, 2026"
        summary="Agreement-facing artifact for the data architecture governing the PulseCheck to AuntEdna bridge. This page locks the system-of-record boundary, approved escalation payload, limited reverse operational-status flow, access controls, and retention and security posture for the partnership."
        highlights={[
          {
            title: 'Clinical Boundary Is Explicit',
            body: 'PulseCheck owns non-clinical performance, readiness, and routing workflows. AuntEdna owns clinical workflow state, clinical records, and PHI.',
          },
          {
            title: 'Minimum Necessary Handoff',
            body: 'Only the minimum necessary operational and contextual data may cross into AuntEdna for a specific escalation handoff.',
          },
          {
            title: 'Reverse Flow Is Limited',
            body: 'AuntEdna may return only limited operational status metadata into the PulseCheck-side operational mirror, not clinical notes or protected care documentation.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Agreement-facing architecture artifact for the data boundary between PulseCheck and AuntEdna."
        sourceOfTruth="This page is authoritative for system-of-record allocation, approved escalation payload shape, limited reverse operational-status flow, access boundaries, and retention and PHI-handling posture for the AuntEdna bridge."
        masterReference="Use this page when defining what may cross systems, who owns which records, what PulseCheck may mirror locally, and what must remain exclusively in AuntEdna."
        relatedDocs={[
          'AuntEdna Integration Strategy',
          'Escalation Integration Spec v1.1',
          'Permissions & Visibility',
          'State & Escalation Orchestration v1.2',
        ]}
      />

      <SectionBlock icon={Database} title="System of Record by Data Category">
        <DataTable columns={['Data Category', 'System of Record', 'What May Cross', 'Boundary Rule']} rows={SYSTEM_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Link2} title="Approved Escalation Payload">
        <DataTable columns={['Payload Element', 'Status', 'Meaning']} rows={PAYLOAD_ROWS} />
        <InfoCard
          title="Prohibited Payload Posture"
          accent="red"
          body="The handoff payload is not a license to send full account exports, broad transcript history, broad performance-history dumps, PHI already maintained by AuntEdna, or any data that would turn one system into a shadow copy of the other."
        />
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="Permitted Data Flow">
        <StepRail steps={FLOW_STEPS} />
      </SectionBlock>

      <SectionBlock icon={Lock} title="Access and Use Boundaries">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Access Rules" accent="blue" body={<DataTable columns={['Viewer', 'May Access', 'May Not Access']} rows={ACCESS_ROWS} />} />
          <InfoCard title="Permitted Use Rules" accent="green" body={<DataTable columns={['Party', 'Permitted Use']} rows={USE_ROWS.map(([party, use]) => [party, use])} />} />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Retention, Security, and PHI Handling">
        <CardGrid columns="md:grid-cols-2 xl:grid-cols-3">
          <InfoCard title="Governance Lock" accent="amber" body={<BulletList items={GOVERNANCE_ITEMS} />} />
          <InfoCard
            title="PHI Rule"
            accent="red"
            body="Pulse Intelligence Labs does not access, receive, store, or process PHI through PulseCheck by default. AuntEdna remains the system of record for PHI, clinical documentation, and regulated clinical workflow records."
          />
          <InfoCard
            title="Operational Mirror Rule"
            accent="purple"
            body="PulseCheck may keep only the limited operational mirror of AuntEdna-origin handoff state that Exhibit A permits, and that mirror exists solely for dashboards, workflow suppression, retry logic, and non-clinical coordination."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Trash2} title="Termination and Change Control">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Termination Rule"
            accent="blue"
            body="On termination or expiration, each party must return or securely destroy integration-received data at the other party’s election, discontinue further use, remove active access to integration endpoints and credentials, and certify return or destruction in writing within 30 days, except where retention is legally required."
          />
          <InfoCard
            title="Change Management Rule"
            accent="green"
            body="Payload fields, data categories, endpoints, authentication methods, webhooks, routing rules, and operational-status return flow cannot be materially changed without mutual written approval by designated operational leads, except for emergency security changes that require prompt post-change notice."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default AuntEdnaExhibitATab;
