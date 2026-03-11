import React from 'react';
import { Eye, KeyRound, Shield, UserCog, Users, Waypoints } from 'lucide-react';
import { CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const ROLE_ROWS = [
  ['Athlete', 'Own work, own progress, own team connection, pilot participation status.', 'No roster-wide state, support queue, or safety-lane visibility.'],
  ['Coach', 'Roster readiness, performance, pilot participation, and privacy-safe support or safety visibility according to role.', 'No raw sensitive conversation detail or clinical interpretation.'],
  ['Performance staff / support staff', 'Scoped roster state, support visibility, coordination queues, and selected performance context.', 'No unrestricted safety detail unless explicitly authorized.'],
  ['Team admin / org admin', 'Team setup, invite management, pilot setup, cohort structure, and administrative visibility controls.', 'Not automatically entitled to detailed clinical content.'],
  ['Clinician', 'Only the access required to support escalation workflow plus any explicitly granted coordination views.', 'General roster-wide exposure beyond assigned coordination need.'],
];

const INVITE_ROWS = [
  ['Athlete invite', 'Athlete role, baseline flow, pilot enrollment, and cohort assignment.'],
  ['Coach / staff invite', 'Team role, permission set, dashboard views, and notification setup.'],
  ['Clinician invite', 'Clinician role, compliance onboarding, and AuntEdna ClinicianBridge activation.'],
];

const VISIBILITY_ROWS = [
  ['General coach', 'Tier label, athlete name, alert status, coach-notified state, safety mode, and follow-dashboard instructions.', 'Conversation content, clinical summary, diagnostic interpretation, detailed handoff payloads.'],
  ['Authorized support staff', 'General coach view plus support-lane patterning and coordination status.', 'Sensitive conversation detail unless separately authorized.'],
  ['Clinical / administrative authorized view', 'Operational escalation status, consent / handoff state, and workflow coordination fields.', 'Unnecessary roster-wide exposure of sensitive content.'],
];

const RULE_ROWS = [
  ['Role-specific invites only', 'Do not use one generic invite path for all roles. The role model starts at invite time.'],
  ['Minimum necessary visibility', 'Show only what a role needs to know to act well.'],
  ['Support is not safety', 'Support-lane visibility should remain distinct from clinical or escalation-lane visibility.'],
  ['Admin is not clinician', 'Administrative control over teams and pilots does not automatically grant sensitive escalation visibility.'],
  ['Clinician bridge is explicit', 'Clinician access should be tied to a real ClinicianBridge mapping and role assignment, not an ad hoc exception.'],
];

const CONSENT_ROWS = [
  ['Product consent', 'Required for Pulse Check use.'],
  ['Research consent', 'Pilot- and cohort-dependent; determines study-dataset eligibility.'],
  ['Escalation / clinical consent', 'Separate event-driven workflow inside Tier 2 escalation and not part of generic onboarding permissions.'],
];

const PulseCheckPermissionsVisibilityModelTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Governance"
        title="Permissions & Visibility Model"
        version="Version 1.0 | March 10, 2026"
        summary="Governance artifact for role-based access, invite-linked permissions, dashboard visibility, and escalation boundaries across athletes, coaches, staff, admins, and clinicians."
        highlights={[
          {
            title: 'Role Model Starts at Invite Time',
            body: 'The system should not treat permissions as a cleanup step after onboarding. The invite path itself should determine role and access posture.',
          },
          {
            title: 'Visibility Must Stay Scoped',
            body: 'Support visibility, performance visibility, and safety visibility serve different operational needs and should not be collapsed into one permission bucket.',
          },
          {
            title: 'Clinician Access Is Explicit',
            body: 'Clinician workflows should be anchored through a real Pulse Check to AuntEdna mapping, not through broad dashboard access.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        sectionLabel="Governance Alignment"
        role="Governance artifact for permission scope, role-linked invites, dashboard visibility, and minimum-necessary escalation access."
        sourceOfTruth="This document is authoritative for who can see what across onboarding, coach surfaces, support workflows, and escalation-aware product surfaces."
        masterReference="Use this page whenever a product or workflow decision depends on role scope, safety visibility, or permission-linked onboarding behavior."
        relatedDocs={[
          'Team, Pilot, and Cohort Onboarding Architecture',
          'Coach Dashboard Information Architecture',
          'State & Escalation Orchestration v1.2',
          'Escalation Integration Spec v1.1',
        ]}
      />

      <SectionBlock icon={Users} title="Role Model">
        <DataTable columns={['Role', 'Should See', 'Should Not See']} rows={ROLE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="Invite-to-Permission Mapping">
        <DataTable columns={['Invite Type', 'Default Permission Outcome']} rows={INVITE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Eye} title="Dashboard and Safety Visibility Boundaries">
        <DataTable columns={['Viewer', 'Can See', 'Cannot See']} rows={VISIBILITY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={KeyRound} title="Consent Lanes and Permission Boundaries">
        <DataTable columns={['Consent Lane', 'Permission Meaning']} rows={CONSENT_ROWS} />
        <InfoCard
          title="Boundary Rule"
          accent="red"
          body="Permission to use the product, permission to be included in a study dataset, and permission to participate in a clinical escalation workflow are different truths. They should not be conflated."
        />
      </SectionBlock>

      <SectionBlock icon={Shield} title="Operating Rules">
        <CardGrid columns="md:grid-cols-2 xl:grid-cols-3">
          {RULE_ROWS.map(([title, body]) => (
            <InfoCard key={title} title={title} body={body} accent="blue" />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={UserCog} title="Why This Artifact Exists">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Supports Onboarding Architecture" body="The team/pilot/cohort onboarding model depends on clear permission outcomes for athletes, coaches, staff, admins, and clinicians." />
          <InfoCard title="Supports Coach Dashboard IA" body="The coach dashboard cannot be finalized cleanly until role-based visibility boundaries are explicit and auditable." />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckPermissionsVisibilityModelTab;
