import React from 'react';
import { Activity, BellRing, ClipboardList, Gauge, ShieldCheck, Users } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const TIER_ROWS = [
  ['Tier 3', 'Critical Clinical Safety Event', 'Mandatory clinical escalation classified by PulseCheck as Tier 3. Normal programming is suspended and clinical routing begins immediately.', 'AuntEdna after receipt; Pulse Intelligence Labs before receipt'],
  ['Tier 2', 'Elevated Clinical Care Escalation', 'Consent-based clinical escalation classified by PulseCheck as Tier 2.', 'AuntEdna after receipt; Pulse Intelligence Labs before receipt'],
  ['Tier 1', 'Coach Review / Support Event', 'Non-clinical support event classified by PulseCheck as Tier 1 or an equivalent support-visibility flag.', 'Pulse Intelligence Labs'],
  ['Technical or Operational Incident', 'Technical or Operational Incident', 'System outage, material degradation, failed handoff, failed webhook, routing issue, or dashboard unavailability affecting Joint Services.', 'Party owning the affected function'],
];

const TIER3_ROWS = [
  ['Operational receipt acknowledgment', 'Within 30 minutes, 24x7', 'Measured from successful receipt of the PulseCheck handoff payload by AuntEdna to acknowledgment or acceptance into AuntEdna’s intake or coordination workflow'],
  ['Intake, assignment, or next-step disposition initiation', 'Within 1 hour during Clinical Coverage Hours; if received outside Clinical Coverage Hours, by 9:00 a.m. local time on the next calendar day unless an earlier emergency-pathway action has already been initiated under the applicable operational playbook', 'Measured from successful receipt to intake opening, assignment, routing confirmation, crisis-pathway determination, or equivalent documented next-step disposition'],
  ['First clinician follow-up or care-coordination step', 'Within 12 hours after receipt', 'Measured from successful receipt to first documented clinician follow-up, care-coordination action, outreach attempt, or equivalent documented clinical action'],
  ['Limited operational status metadata to the PulseCheck-side operational mirror', 'Promptly after assignment, routing confirmation, or emergency-pathway invocation, and in all cases during the same Clinical Coverage Hours period if available, or otherwise at the start of the next Clinical Coverage Hours period', 'Must remain limited to Exhibit A operational status metadata only; no PHI except as separately authorized in writing'],
];

const TIER2_ROWS = [
  ['Receipt acknowledgment', 'Within 1 hour during Clinical Coverage Hours; otherwise by 10:00 a.m. local time on the next calendar day', 'Measured from successful receipt of the PulseCheck handoff payload by AuntEdna'],
  ['Intake initiation', 'Within 4 Clinical Coverage Hours after receipt; if received outside Clinical Coverage Hours, within the first 4 Clinical Coverage Hours of the next coverage period', 'Measured from successful receipt to intake opening, assignment, or equivalent case activation'],
  ['First clinician outreach or intake follow-up', 'Within 1 business day after receipt', 'Measured from successful receipt to first documented clinician outreach, triage request, or equivalent care-path movement'],
  ['Limited operational status metadata to the PulseCheck-side operational mirror', 'Same business day as intake initiation', 'Must remain limited to Exhibit A operational status metadata only; no clinical notes, diagnosis, treatment detail, or protected care documentation'],
];

const PULSE_ROWS = [
  ['PulseCheck monthly availability for Joint Services workflows', '99.5% monthly uptime', 'Measured monthly, excluding Scheduled Maintenance and force majeure downtime'],
  ['Tier 3 handoff transmission to AuntEdna', 'Within 5 minutes of escalation creation', 'Measured from PulseCheck escalation-record creation to successful transmission or documented manual fallback handoff'],
  ['Tier 2 handoff transmission to AuntEdna', 'Within 5 minutes after athlete consent or other lawful authorization is captured', 'Measured from consent capture to successful transmission or documented manual fallback handoff'],
  ['Tier 1 coach notification', 'Within 15 minutes of event creation', 'Measured from PulseCheck escalation-record creation to coach notification timestamp'],
  ['Failed Tier 3 handoff remediation', 'Within 15 minutes of detected failure', 'Measured from detection of failed transmission to successful re-transmission or documented manual fallback handoff'],
  ['Failed Tier 2 handoff remediation', 'Within 4 business hours of detected failure', 'Measured from detection of failed transmission to successful re-transmission or documented manual fallback handoff'],
  ['Critical technical incident acknowledgment to AuntEdna', 'Within 30 minutes, 24x7', 'Measured from internal confirmation of a material technical or operational incident affecting Joint Services'],
  ['Critical technical incident status updates', 'At least every 4 hours until service restoration', 'Operational updates only'],
];

const CADENCE_ROWS = [
  ['Bi-weekly operational check-ins', 'Open Tier 3 and Tier 2 cases, escalation volume, missed SLAs, failed handoffs, routing issues, and active Shared Account blockers'],
  ['Monthly operational report', 'Tier mix, transmitted Tier 3 and Tier 2 handoffs, speed to care, AuntEdna time-to-acknowledgment / intake / first response, aging buckets, uptime, failed transmissions, unresolved incidents, and shared pipeline status'],
  ['Quarterly business reviews', 'Quarterly SLA attainment, escalation trends, repeated failures, customer feedback themes, and workflow or staffing changes needed'],
];

const MEASUREMENT_ITEMS = [
  'PulseCheck is the operational system of record for escalation creation, consent capture, coach notification, and the PulseCheck-side operational mirror of handoff initiation and related operational status on the PulseCheck side.',
  'AuntEdna is the operational system of record for clinical receipt, assignment, intake progression, clinician response, care completion, and underlying clinical workflow state on the AuntEdna side.',
  'Mirrored operational records are reconciled using API logs, webhook logs, and other contemporaneous system records, with AuntEdna remaining the source of truth for clinical workflow details, care actions, and clinician-owned outcomes.',
  'Operational status metadata means only the limited non-clinical handoff-state metadata permitted by Exhibit A.',
  'PulseCheck is not required to ingest PHI, clinical notes, or AuntEdna clinical documentation in order to satisfy reporting under Exhibit B.',
];

const REMEDIATION_ITEMS = [
  'If either party misses a material metric, the issue is reviewed at the next bi-weekly check-in or sooner if it concerns a Tier 3 event.',
  'A written corrective action plan is required after repeated Tier 3 misses, repeated misses of the same core metric, or multiple core-metric misses in the same quarter.',
  'A party materially fails the performance standards for a quarter if it misses any Tier 3 response metric on two or more separate incidents, or misses any two core metrics and fails to timely implement an agreed corrective action plan.',
  'If material failure continues for two consecutive quarters, the other party may invoke the Section 7.3 cure and exclusivity-release mechanics.',
];

const AuntEdnaExhibitBTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="AuntEdna Integration"
        title="Exhibit B - Performance Standards, Service Levels, and Operating Cadence"
        version="Agreement Draft Lock | April 1, 2026"
        summary="Agreement-facing performance artifact for the PulseCheck to AuntEdna partnership. This page locks the Tier-based response model, AuntEdna post-receipt standards, PulseCheck transmission and uptime obligations, reporting cadence, mirrored-status measurement rules, and remediation mechanics tied to Section 7.3 of the Agreement."
        highlights={[
          {
            title: 'Tier Vocabulary Matches PulseCheck',
            body: 'The performance framework uses PulseCheck’s native Tier 1, Tier 2, and Tier 3 classifications rather than a separate contract-only severity system.',
          },
          {
            title: 'Tier 3 Is Realistic',
            body: 'Tier 3 now uses a middle-ground coordination standard that creates accountability without representing AuntEdna as a full 24x7 emergency-dispatch provider by default.',
          },
          {
            title: 'Mirror and Metadata Rules Stay Tight',
            body: 'Any return flow from AuntEdna remains limited to the Exhibit A operational-status metadata allowed in the PulseCheck-side operational mirror.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Agreement-facing SLA and operating-cadence artifact for the PulseCheck to AuntEdna handoff and follow-up model."
        sourceOfTruth="This page is authoritative for Tier-based response standards, PulseCheck uptime and transmission targets, reporting cadence, measurement rules, and remediation mechanics tied to the AuntEdna partnership."
        masterReference="Use this page when defining post-receipt AuntEdna accountability, PulseCheck transmission obligations, speed-to-care reporting, operational check-ins, or performance-based exclusivity-release triggers."
        relatedDocs={[
          'Exhibit A - Data Architecture, Handoff, and System Boundaries',
          'AuntEdna Integration Strategy',
          'Pilot Outcome Metrics Contract',
          'State & Escalation Orchestration v1.2',
        ]}
      />

      <SectionBlock icon={Activity} title="Tier and Incident Framework">
        <DataTable columns={['Tier / Incident Class', 'Event Type', 'Description', 'Primary Owner']} rows={TIER_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="AuntEdna Clinical Response Standards">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Tier 3 Clinical Safety Events" accent="red" body={<DataTable columns={['Metric', 'Standard', 'Measurement']} rows={TIER3_ROWS} />} />
          <InfoCard title="Tier 2 Clinical Care Escalations" accent="amber" body={<DataTable columns={['Metric', 'Standard', 'Measurement']} rows={TIER2_ROWS} />} />
        </CardGrid>
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Tier 3 Coverage Boundary"
            accent="blue"
            body="Tier 3 events may require customer-specific emergency procedures, campus emergency contacts, emergency services, a crisis hotline, or other urgent-support resources in the applicable operational playbook. AuntEdna’s obligations here relate to receipt, acknowledgment, intake, triage, care coordination, and clinician follow-up after handoff."
          />
          <InfoCard
            title="24/7 Coverage Development"
            accent="green"
            body="24/7 emergency and after-hours coverage protocols may require additional operational infrastructure. The parties should define the applicable coverage model in the relevant statement of work, operational playbook, or deployment protocol for each customer deployment."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Gauge} title="Pulse Intelligence Labs Platform and Integration Standards">
        <DataTable columns={['Metric', 'Standard', 'Measurement']} rows={PULSE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BellRing} title="Reporting and Review Cadence">
        <DataTable columns={['Cadence', 'What It Covers']} rows={CADENCE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Measurement Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Measurement and Source-of-Truth Rules" accent="purple" body={<BulletList items={MEASUREMENT_ITEMS} />} />
          <InfoCard
            title="Tier 2 Exclusions"
            accent="amber"
            body="Tier 2 events remain outside AuntEdna timing metrics while athlete consent is pending or declined. Delays caused by incorrect routing metadata, failed transmission attributable to Pulse Intelligence Labs, force majeure, or customer-side unavailability do not count as AuntEdna SLA failures."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Users} title="Remediation and Cure Process">
        <InfoCard title="Quarterly Accountability Rule" accent="green" body={<BulletList items={REMEDIATION_ITEMS} />} />
      </SectionBlock>
    </div>
  );
};

export default AuntEdnaExhibitBTab;
