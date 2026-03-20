import React from 'react';
import { ClipboardCheck, Database, FlaskConical, Link2, ShieldCheck, Users, Waypoints } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const OBJECT_MODEL_ROWS = [
  ['Organization', 'Top-level customer account created by Pulse Check. Owns implementation defaults, customer admins, and top-level posture.'],
  ['OrganizationMembership', 'Connects a person to an organization with org-scoped role such as org admin or implementation observer.'],
  ['Team', 'Persistent sport-, unit-, or roster-level container inside the organization. This is created separately from the organization.'],
  ['TeamMembership', 'Connects a person to a team with role and permissions.'],
  ['Pilot', 'Time-bound internal program inside a team with goals, dates, checkpoints, and study posture.'],
  ['PilotCohort', 'Subgroup inside a pilot used for experiments, subgroup reporting, or differentiated programming. Not a substitute for a separate team.'],
  ['PilotEnrollment', 'Connects a person to a pilot and cohort, and stores consent truth and eligibility.'],
  ['InviteLink', 'Permissioned onboarding path for admin activation, staff, athlete, or clinician onboarding.'],
  ['PermissionSet / Role', 'Determines dashboard access, notifications, and escalation visibility.'],
  ['ClinicianBridge', 'Pulse Check to AuntEdna mapping that keeps the escalation pathway live.'],
];

const INVITE_ROWS = [
  ['Admin activation link', 'Initial external customer admin handoff', 'Single-purpose full-access link that makes the first accepted user the org admin and initial team admin.'],
  ['Staff / coach invite', 'Coaches, performance staff, support staff, and secondary admins', 'Starts in a staff lane, but should stamp the selected role before onboarding begins so permissions stay deterministic.'],
  ['Athlete invite', 'Roster onboarding and pilot enrollment', 'Applies athlete-specific onboarding, baseline flow, and cohort assignment.'],
  ['Clinician invite', 'On-staff or third-party clinicians', 'Creates or links AuntEdna clinician identity and activates the escalation bridge.'],
];

const JOURNEY_ROWS = [
  ['Pulse Check implementation admin', 'Create the organization shell, create the initial team in the same internal dashboard flow, attach defaults, and generate the first admin activation link.'],
  ['Org / team admin', 'Arrive through the admin activation link, finish onboarding, become the customer admin for that organization and team, then invite staff and manage roster operations.'],
  ['Athlete', 'Arrive through the team athlete link sent by a coach, staff member, or team admin, complete account and product consent, branch into research consent if required, then enter baseline routing automatically.'],
  ['Coach / staff', 'Arrive through the team staff invite, confirm role, title, and team access, receive the right permission set, and gain athlete-invite ability if their role allows it.'],
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
  ['Phase 1', 'Organization object, team object, admin activation link, and org/team membership.'],
  ['Phase 2', 'Staff and athlete invite links, permission sets, and team membership management.'],
  ['Phase 3', 'Pilot object, pilot enrollment, and cohort support under internal control.'],
  ['Phase 4', 'Clinician invite flow and AuntEdna clinician provisioning bridge.'],
  ['Phase 5', 'Study-mode configuration, research consent fields, and baseline-path branching.'],
  ['Phase 6', 'Directed experiment fields, checkpoint scheduling, and pilot reporting.'],
  ['Phase 7', 'Admin tooling for cohort comparisons, pilot exports, and research-ready configuration.'],
];

const PROVISIONING_ROWS = [
  ['Organization', 'Pulse Check internal admin', 'Implementation-led', 'Top-level customer account should not be open self-serve on day 1 because permissions, research posture, and clinician routing defaults originate here.'],
  ['Team', 'Pulse Check internal admin', 'Implementation-led at launch', 'Separate step from organization creation because sport or unit, roster scope, and invite policy live here.'],
  ['Admin activation', 'System-generated after team creation', 'Customer self-serve after handoff', 'First approved external user becomes the customer admin and can run day-to-day onboarding inside the created container.'],
  ['Staff / coach onboarding', 'Customer org or team admin', 'Self-serve', 'Customer admin should be able to invite coaches and staff without Pulse Check intervention once the team shell exists.'],
  ['Athlete onboarding', 'Coach, staff, or team admin', 'Self-serve', 'Coaches should be able to send the team athlete link directly so roster activation does not bottleneck on Pulse Check staff.'],
  ['Pilot creation', 'Pulse Check internal admin', 'Internal-only for v1', 'Keep pilot objectives, study mode, and cohort design controlled internally until permissions and consent logic are proven stable.'],
];

const ORGANIZATION_DATA_ROWS = [
  ['id', 'Stable organization id referenced by teams, memberships, pilots, and invite links.'],
  ['displayName + legalName', 'Customer-facing name plus contract or IRB-safe legal name when needed.'],
  ['organizationType', 'Athletic department, school, club, franchise, clinic partner, or other top-level category.'],
  ['status', 'draft, active, archived, or implementation-hold.'],
  ['implementationOwnerUserId', 'Internal Pulse Check operator responsible for setup and handoff.'],
  ['primaryCustomerAdminContact', 'Default external contact who receives the first admin activation link.'],
  ['defaultStudyPosture', 'Operational default for the account; pilots can override this later.'],
  ['defaultClinicianBridgeMode', 'Clinician routing requirement: none, optional, or required depending on rollout posture.'],
];

const TEAM_DATA_ROWS = [
  ['id + organizationId', 'A team belongs to exactly one organization.'],
  ['displayName', "Examples: Hampton Men's Basketball, Hampton Sports Medicine, Hampton Track Sprint Group."],
  ['teamType / sport', 'Sport, program, rehab unit, or other operational grouping.'],
  ['status', 'draft, active, paused, or archived.'],
  ['defaultAdminUserIds', 'Customer admins responsible for roster and staff operations after activation.'],
  ['defaultInvitePolicy', 'Who can create staff and athlete links, link expiry, and max-use rules.'],
  ['branding + roster metadata', 'Logo, colors, site, level, and roster-import defaults.'],
  ['defaultClinicianProfileId', 'AuntEdna clinician profile linked as the team default escalation destination.'],
  ['AthleteClinicianOverride', 'Optional athlete-level AuntEdna profile assignment. If absent, routing falls back to the team default.'],
];

const ACCESS_DATA_ROWS = [
  ['OrganizationMembership', 'organizationId, userId, role, status, grantedBy, grantedAt. Holds org-scoped admin power.'],
  ['TeamMembership', 'teamId, userId, role, title, permissionSetId, onboardingStatus. Holds team-scoped access and title metadata.'],
  ['InviteLink', 'inviteType, organizationId, teamId, defaultRole, createdByUserId, expiresAt, maxUses, status, targetPilotId?'],
];

const PILOT_DATA_ROWS = [
  ['Pilot', 'pilotId, teamId, name, objective, status, studyMode, ownerInternalUserId, startAt, endAt.'],
  ['PilotCohort', 'cohortId, pilotId, name, cohortType, assignmentRule, reportingTags. Use for experimental arms or reporting subgroups, not separate sports.'],
  ['PilotEnrollment', 'pilotId, cohortId, userId or teamMembershipId, enrollmentMode, productConsentAcceptedAt, researchConsentStatus, eligibleForResearchDataset.'],
];

const CREATION_STEPS = [
  {
    title: 'Create organization in the internal Pulse Check dashboard',
    body: 'Pulse Check admin creates the top-level organization record, sets implementation defaults, and records the first customer admin contact.',
    owner: 'Pulse Check internal admin',
  },
  {
    title: 'Create the initial team inside that organization',
    body: 'In the same dashboard workflow, Pulse Check admin creates the first team, picks the sport or unit, assigns routing defaults, and enables invite policy.',
    owner: 'Pulse Check internal admin',
  },
  {
    title: 'Generate the admin activation link',
    body: 'After team creation, the system generates a permissioned admin activation link for the customer lead. This is the handoff from implementation-led setup to customer-run operations.',
    owner: 'System',
  },
  {
    title: 'Customer admin activates and becomes the controlling admin',
    body: 'The external lead completes onboarding through the admin activation link and becomes the org admin plus initial team admin for that container.',
    owner: 'Customer admin',
  },
  {
    title: 'Customer admin invites staff and coaches',
    body: 'Once activated, the customer admin can send staff invites to coaches, performance staff, and operations staff. Staff onboarding should capture title, role, and notification preferences.',
    owner: 'Customer admin',
  },
  {
    title: 'Coaches and staff invite athletes',
    body: 'Permissioned coaches and staff can send the team athlete link directly so athletes enter the right team without waiting on Pulse Check operations.',
    owner: 'Coach / staff',
  },
];

const PulseCheckTeamPilotCohortOnboardingArchitectureTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Operations"
        title="Team, Pilot, and Cohort Onboarding Architecture"
        version="Version 1.2 | March 11, 2026"
        summary="System-entry architecture for how organizations, teams, athletes, coaches, staff, clinicians, pilots, and cohorts enter Pulse Check and connect to one another. This artifact now makes the provisioning model explicit: Pulse Check creates the organization and initial team internally, then hands off ongoing staff and athlete onboarding through permissioned invite links."
        highlights={[
          {
            title: 'Team and Pilot Are Separate Layers',
            body: 'A team is the persistent container. A pilot is a time-bound program inside that team. Cohorts exist inside pilots, and enrollments store the truth for each person.',
          },
          {
            title: 'Implementation-Led Setup, Self-Serve Onboarding',
            body: 'Pulse Check should create the organization and first team. Customer admins, coaches, and staff should then handle ongoing staff and athlete onboarding.',
          },
          {
            title: 'Role-Specific Invites Are Required',
            body: 'Admin activation, athlete, staff, and clinician invites should remain distinct so permissions, questions, and landing experiences stay clean.',
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

      <SectionBlock icon={Waypoints} title="Provisioning Model">
        <DataTable columns={['Layer', 'Created By', 'Operating Mode', 'Why']} rows={PROVISIONING_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Users} title="Organization and Team Creation Flow">
        <StepRail steps={CREATION_STEPS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Object Model">
        <DataTable columns={['Object', 'Role in System']} rows={OBJECT_MODEL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Core Data Models for Organization and Team Creation">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Organization" accent="blue" body={<DataTable columns={['Field', 'Purpose']} rows={ORGANIZATION_DATA_ROWS} />} />
          <InfoCard title="Team" accent="green" body={<DataTable columns={['Field', 'Purpose']} rows={TEAM_DATA_ROWS} />} />
        </CardGrid>
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Access and Invite Objects" accent="purple" body={<DataTable columns={['Object', 'Minimum Required Fields']} rows={ACCESS_DATA_ROWS} />} />
          <InfoCard title="Pilot and Cohort Objects" accent="amber" body={<DataTable columns={['Object', 'Minimum Required Fields']} rows={PILOT_DATA_ROWS} />} />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Link2} title="Role Model and Invite Paths">
        <DataTable columns={['Invite Type', 'Default Use', 'Why It Is Separate']} rows={INVITE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Users} title="Recommended Onboarding Journeys">
        <DataTable columns={['Role', 'Recommended Flow']} rows={JOURNEY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Team Onboarding vs Pilot Onboarding">
        <CardGrid columns="md:grid-cols-2 xl:grid-cols-4">
          <InfoCard title="Team" accent="blue" body="Answers: who is in the system, and which persistent sport or unit do they belong to? Teams stay alive even when no pilot is active." />
          <InfoCard title="Pilot" accent="amber" body="Answers: what internal time-bound initiative are we running inside this team? Pilots start and end." />
          <InfoCard title="Cohort" accent="green" body="Answers: how are people grouped inside the pilot for reporting, programming, or experimentation? Use this for control vs intervention or subgroups, not for different sports that should be separate teams." />
          <InfoCard title="Enrollment" accent="purple" body="Answers: what is true for this person inside this pilot? This is the pilot-scoped truth object." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Reporting Boundary">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Pilot Dashboard Scope"
            accent="green"
            body="Pilot dashboards should be rooted in `Pilot` and `PilotEnrollment`. They may use organization and team context for navigation, but the monitored population comes from active pilot enrollments, not from all team members."
          />
          <InfoCard
            title="Cohort Reporting Rule"
            accent="amber"
            body="Cohorts are filters and subgroups inside one pilot dashboard. They should not replace the pilot as the root reporting object, and athletes outside the pilot should never leak into cohort reads."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="How to Model Hampton Correctly">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Recommended Structure"
            accent="green"
            body={
              <BulletList
                items={[
                  'Organization: Hampton University Athletics.',
                  "Team: one persistent team per sport or operational unit, such as Men's Basketball or Women's Track.",
                  'Pilot: one internal pilot per team in v1 unless there is a true cross-team study with shared governance.',
                  'Cohort: use for control vs intervention, position groups, rehab groups, or other subgroups inside that pilot.',
                ]}
              />
            }
          />
          <InfoCard
            title="Boundary Rule"
            accent="amber"
            body="If a subgroup should have its own admins, roster, staff permissions, or long-lived identity, it probably needs to be a separate team. Cohorts are for pilot subgroups, not for replacing the team layer."
          />
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
                'Pulse Check creates the organization and initial team internally; customers should not create orgs freely at launch.',
                'Generate the admin activation link only after the team shell exists and is correctly configured.',
                'Do not make pilot logic part of team logic. Pilots are structured layers inside teams.',
                'Use role-specific invite links. Do not rely on one generic invite for all user types.',
                'Allow coaches and staff with the right permission to send the team athlete link directly.',
                'Treat clinician onboarding as a first-class workflow inside Pulse Check.',
                'Pilot defines the study posture. Cohort can refine it. Enrollment stores the consent truth.',
                'Pilot dashboards and pilot reports must read athlete populations from active `PilotEnrollment` truth rather than from whole-team membership.',
                'Keep pilots internal-only until permissioning, consent, and reporting behavior are stable enough for customer self-serve.',
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
