import React from 'react';
import { ClipboardCheck, Database, FlaskConical, Link2, ShieldCheck, Users, Waypoints } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const OBJECT_MODEL_ROWS = [
  ['Organization', 'School, athletic department, club, franchise, or other top-level entity.'],
  ['Team', 'Persistent sport- or roster-level container inside the organization.'],
  ['TeamMembership', 'Connects a person to a team with role and permissions.'],
  ['Pilot', 'Time-bound program inside a team with goals, dates, checkpoints, and study posture.'],
  ['PilotCohort', 'Subgroup inside a pilot used for experiments, subgroup reporting, or differentiated programming.'],
  ['PilotEnrollment', 'Connects a person to a pilot and cohort, and stores consent truth and eligibility.'],
  ['InviteLink', 'Role-specific onboarding path for athlete, coach, staff, or clinician.'],
  ['PermissionSet / Role', 'Determines dashboard access, notifications, and escalation visibility.'],
  ['ClinicianBridge', 'Pulse Check to AuntEdna mapping that keeps the escalation pathway live.'],
];

const INVITE_ROWS = [
  ['Athlete invite', 'Roster onboarding and pilot enrollment', 'Applies athlete-specific onboarding, baseline flow, and cohort assignment.'],
  ['Coach / staff invite', 'Coaches, performance staff, support staff, admins', 'Applies role-specific permissions, dashboard views, and notification setup.'],
  ['Clinician invite', 'On-staff or third-party clinicians', 'Creates or links AuntEdna clinician identity and activates the escalation bridge.'],
];

const JOURNEY_ROWS = [
  ['Team admin / org admin', 'Create organization and team, assign owners, choose standard mode or create a pilot, then generate role-specific invites.'],
  ['Athlete', 'See team branding and pilot context, complete account and product consent, branch into research consent if required, then enter baseline routing automatically.'],
  ['Coach / staff', 'Confirm role and team access, receive the right permission set, set notifications, and see active pilot objectives and reporting cadence.'],
  ['Clinician', 'Accept invite inside Pulse Check, complete identity and compliance onboarding, then get provisioned into AuntEdna through the ClinicianBridge.'],
];

const STUDY_MODE_ROWS = [
  ['Operational', 'Normal team deployment', 'Product consent only', 'No impact beyond normal onboarding'],
  ['Pilot / evaluation', 'Internal program evaluation or light pilot', 'Product consent plus optional pilot acknowledgment', 'Athlete can use the full product regardless of evaluation participation'],
  ['Research / IRB', 'Formal study or publishable dataset', 'Product consent plus IRB-approved research consent', 'Athlete may still use the product if research consent is declined, depending on pilot settings'],
];

const ENROLLMENT_ROWS = [
  ['productConsentAccepted + timestamp', 'Required for product use.'],
  ['researchConsentStatus', 'not-required, pending, accepted, or declined.'],
  ['researchConsentVersion + timestamp', 'Versioned informed-consent record for IRB studies.'],
  ['eligibleForResearchDataset', 'Determines whether the person’s data is included in study exports.'],
  ['enrollmentMode', 'product-only, pilot, or research.'],
];

const PHASE_ROWS = [
  ['Phase 1', 'Team object, athlete and staff invite links, and team membership.'],
  ['Phase 2', 'Pilot object, pilot enrollment, and cohort support.'],
  ['Phase 3', 'Clinician invite flow and AuntEdna clinician provisioning bridge.'],
  ['Phase 4', 'Study-mode configuration, research consent fields, and baseline-path branching.'],
  ['Phase 5', 'Directed experiment fields, checkpoint scheduling, and pilot reporting.'],
  ['Phase 6', 'Admin tooling for cohort comparisons, pilot exports, and research-ready configuration.'],
];

const PulseCheckTeamPilotCohortOnboardingArchitectureTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Operations"
        title="Team, Pilot, and Cohort Onboarding Architecture"
        version="Version 1.1 | March 10, 2026"
        summary="System-entry architecture for how organizations, teams, athletes, coaches, staff, clinicians, pilots, and cohorts enter Pulse Check and connect to one another. This artifact defines the object model that keeps onboarding, consent, baseline branching, dashboards, and escalation aligned."
        highlights={[
          {
            title: 'Team and Pilot Are Separate Layers',
            body: 'A team is the persistent container. A pilot is a time-bound program inside that team. Cohorts exist inside pilots, and enrollments store the truth for each person.',
          },
          {
            title: 'Role-Specific Invites Are Required',
            body: 'Athlete, coach/staff, and clinician invites should remain distinct so permissions, questions, and landing experiences stay clean.',
          },
          {
            title: 'Consent Lanes Stay Separate',
            body: 'Product consent, research consent, and escalation / clinical consent are different truths and should never be merged into one onboarding event.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        sectionLabel="System Alignment"
        role="System-entry architecture artifact for onboarding, membership, enrollment truth, pilot structure, cohort modeling, and clinician provisioning."
        sourceOfTruth="This document is authoritative for the organization/team/pilot/cohort object model, role-specific onboarding flows, enrollment truth, and the relationship between onboarding, pilot posture, and clinician bridging."
        masterReference="Use this page when defining who enters the system, how they are connected, and which object should hold truth for pilots, cohorts, and consent."
        relatedDocs={[
          'Athlete User Journey',
          'Permissions & Visibility Model',
          'Coach Dashboard Information Architecture',
          'Escalation Integration Spec v1.1',
        ]}
      />

      <SectionBlock icon={Database} title="Object Model">
        <DataTable columns={['Object', 'Role in System']} rows={OBJECT_MODEL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Link2} title="Role Model and Invite Paths">
        <DataTable columns={['Invite Type', 'Default Use', 'Why It Is Separate']} rows={INVITE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Users} title="Recommended Onboarding Journeys">
        <DataTable columns={['Role', 'Recommended Flow']} rows={JOURNEY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Team Onboarding vs Pilot Onboarding">
        <CardGrid columns="md:grid-cols-2 xl:grid-cols-4">
          <InfoCard title="Team" accent="blue" body="Answers: who is in the system? Teams are persistent even when no pilot is active." />
          <InfoCard title="Pilot" accent="amber" body="Answers: what time-bound initiative are we running? Pilots start and end." />
          <InfoCard title="Cohort" accent="green" body="Answers: how are people grouped inside the pilot for reporting, programming, or experimentation?" />
          <InfoCard title="Enrollment" accent="purple" body="Answers: what is true for this person inside this pilot? This is the pilot-scoped truth object." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={FlaskConical} title="Study Mode and Consent Architecture">
        <DataTable columns={['Study Mode', 'Use Case', 'Consent Requirement', 'Effect on Product Access']} rows={STUDY_MODE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Enrollment Stores Consent Truth"
            body={<DataTable columns={['Enrollment Field', 'Meaning']} rows={ENROLLMENT_ROWS} />}
          />
          <InfoCard
            title="Consent Separation Rule"
            accent="red"
            body={
              <BulletList
                items={[
                  'Product consent is required for Pulse Check use.',
                  'Research consent is pilot- and cohort-dependent and controls dataset eligibility.',
                  'Escalation / clinical consent remains a separate event-driven workflow inside Tier 2 escalation.',
                  'Onboarding should never merge product, research, and clinical consent into one lane.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="Baseline Flow and Pilot Alignment">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard title="Baseline Is the First Trial" accent="green" body="Onboarding should hand the athlete directly into a standardized baseline path instead of making them navigate to it later." />
          <InfoCard title="Pilot-Aware Branching" accent="amber" body="Research-enrolled athletes should enter the research baseline path; product-only athletes should still enter the standard baseline path." />
          <InfoCard title="Clinician Bridge Cohesion" accent="purple" body="Clinicians should be invited and provisioned from inside Pulse Check so the AuntEdna escalation bridge stays administratively coherent." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Operating Rules">
        <InfoCard
          title="Non-Negotiable Rules"
          accent="blue"
          body={
            <BulletList
              items={[
                'Do not make pilot logic part of team logic. Pilots are structured layers inside teams.',
                'Use role-specific invite links. Do not rely on one generic invite for all user types.',
                'Treat clinician onboarding as a first-class workflow inside Pulse Check.',
                'Pilot defines the study posture. Cohort can refine it. Enrollment stores the consent truth.',
                'Keep the object model clean so escalation, reporting, baseline trials, and pilot management all reference the same memberships and enrollments.',
              ]}
            />
          }
        />
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="Suggested Implementation Phases">
        <DataTable columns={['Phase', 'Scope']} rows={PHASE_ROWS} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckTeamPilotCohortOnboardingArchitectureTab;
