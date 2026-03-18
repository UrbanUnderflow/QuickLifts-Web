import React from 'react';
import { AlertTriangle, Bell, Brain, ClipboardCheck, Database, KeyRound, ShieldCheck, Smartphone, Users, UserCog, Waypoints, FileText, Building2 } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';
import ArtifactPageLibrary, { ArtifactPageEntry } from './ArtifactPageLibrary';
import PulseCheckTeamPilotCohortOnboardingArchitectureTab from './PulseCheckTeamPilotCohortOnboardingArchitectureTab';

const READINESS_ROWS = [
  ['Organization readiness', 'Pulse Check has created the organization shell internally and attached implementation defaults.'],
  ['Team readiness', 'At least one team exists with branding, invite policy, default admins, and escalation routing defaults.'],
  ['Clinical readiness', 'A default clinician profile and ClinicianBridge posture are defined when the rollout requires escalation support.'],
  ['Invite readiness', 'Role-specific invite paths exist for admin activation, coach or staff, athlete, and clinician entry.'],
];

const SYSTEM_SETUP_STEPS = [
  {
    title: 'Create the organization in the internal Pulse Check dashboard',
    body: 'Pulse Check implementation creates the top-level organization record, assigns the implementation owner, sets the study posture default, and records the initial operational admin contact.',
    owner: 'Pulse Check internal admin',
  },
  {
    title: 'Create the first team inside that organization',
    body: 'Pulse Check creates the team shell separately from the organization so sport, roster scope, branding, invite policy, and team-level defaults live in the right object.',
    owner: 'Pulse Check internal admin',
  },
  {
    title: 'Configure the team operating defaults',
    body: 'Set the team type, sport or unit, default invite policy, team admins, and any baseline routing defaults that the roster should inherit at entry.',
    owner: 'Pulse Check internal admin',
  },
  {
    title: 'Create or attach the clinical route',
    body: 'If the rollout uses clinical escalation, attach the team default clinician profile and establish the ClinicianBridge posture so future safety events have a real destination.',
    owner: 'Pulse Check internal admin',
  },
  {
    title: 'Create pilot and cohort structure when the rollout needs it',
    body: 'If the rollout is pilot-based, define the pilot object, study mode, checkpoint cadence, and any cohort grouping before athlete invites go out.',
    owner: 'Pulse Check internal admin',
  },
  {
    title: 'Provision operational admin access',
    body: 'After organization and team setup are correct, provision the right org or team admin access. That may be an admin activation link or an implementation-led handoff, depending on how the rollout is being operated.',
    owner: 'System',
  },
];

const ROLE_HANDOFF_ROWS = [
  ['Org or team admin', 'Receives administrative access through the rollout handoff, becomes the operating admin for the container, and can manage staff and roster operations when that responsibility is delegated.'],
  ['Coach or staff', 'Arrives through a role-specific staff invite, confirms role and title, receives scoped visibility, and can invite athletes if permissions allow it.'],
  ['Clinician', 'Arrives through a clinician invite, completes identity or compliance onboarding, and is linked to the AuntEdna bridge through the ClinicianBridge model.'],
  ['Athlete', 'Arrives through an athlete invite or direct team-linked entry, completes product onboarding, and is routed into baseline automatically.'],
];

const COACH_AND_STAFF_STEPS = [
  {
    title: 'Operational admin invites coaches and staff',
    body: 'Once the team is live, the operational admin sends role-specific invites to coaches, performance staff, support staff, and any secondary admins if those responsibilities are not still being managed by Pulse Check.',
    owner: 'Operational admin',
  },
  {
    title: 'Coach or staff confirms team context and role',
    body: 'The invited user should see which team and pilot they are joining, what scoped role they hold, and what visibility posture they are entering before roster data appears.',
    owner: 'Coach or staff',
  },
  {
    title: 'Coach or staff completes day-one setup',
    body: 'Notification preferences, unit defaults, and initial dashboard expectations are configured so the first coach moment is a useful roster read rather than a blank analytics shell.',
    owner: 'Coach or staff',
  },
  {
    title: 'Permissioned coaches and staff begin athlete invite operations',
    body: 'The correct next move is to send the team athlete link directly so roster activation does not bottleneck on Pulse Check implementation staff.',
    owner: 'Coach or staff',
  },
];

const ATHLETE_STEPS = [
  {
    title: 'Athlete enters through the correct team or pilot-aware path',
    body: 'The athlete should arrive through the team athlete invite or a pilot-aware invite so the system can preserve team context, pilot participation, and cohort truth without asking the athlete to decode internal objects.',
    owner: 'Athlete',
  },
  {
    title: 'Account creation happens inside PulseCheck auth',
    body: 'A new athlete creates an account with email and password. Sign-up deliberately marks local onboarding as not yet seen so the signed-in flow can launch Nora onboarding.',
    owner: 'Athlete + app',
  },
  {
    title: 'The app evaluates onboarding truth',
    body: 'After auth succeeds, PulseCheck checks local state and Firestore. If onboarding is incomplete or core context such as sport is missing, NoraOnboardingView appears full-screen.',
    owner: 'App runtime',
  },
  {
    title: 'Nora captures member profile and rhythm',
    body: 'The athlete provides preferred name, sport, optional position, season phase, primary mental challenge, and daily reflection preference.',
    owner: 'Athlete',
  },
  {
    title: 'Consent and study posture stay in the correct lane',
    body: 'Product consent belongs in every athlete path. Research consent should only appear if the pilot requires it. Clinical or escalation consent should remain separate from generic onboarding.',
    owner: 'System design',
  },
  {
    title: 'Onboarding writes athlete state and opens the task gate',
    body: 'PulseCheck persists onboarding completion to users/{uid}, sets athlete-mental-progress/{uid}.assessmentNeeded = true, and moves athleteOnboarding.baselinePathStatus to ready so the athlete lands in a required-task lane instead of a generic workspace.',
    owner: 'App + Firestore',
  },
  {
    title: 'Required tasks stay visible until they are complete',
    body: 'The athlete-facing workspace should keep the first decision simple: consent is done, the in-app baseline is the next required task, and standard training assignments remain locked until baseline finishes. The shared task model treats either web baselineAssessment or native baselineProbe as valid completion evidence.',
    owner: 'App runtime + workspace shell',
  },
  {
    title: 'Optional Vision Pro session stays separate',
    body: 'If staff queue a Vision Pro trial, show it as an optional task or queued handoff. It can become an official checkpoint when tagged as midpoint, endpoint, or retention, but it does not block the standard unlock gate.',
    owner: 'Staff + runtime',
  },
  {
    title: 'Baseline completion clears the unlock gate',
    body: 'Once the athlete finishes the in-app baseline on web or iOS, baselinePathStatus becomes complete, assessmentNeeded flips false, the first canonical profile snapshot is written, and standard training delivery can begin.',
    owner: 'Athlete + app',
  },
];

const OBJECT_ROWS = [
  ['Organization', 'Top-level organization account created internally by Pulse Check.'],
  ['Team', 'Persistent sport, program, or unit container under the organization.'],
  ['Pilot', 'Time-bound initiative inside a team with its own study posture and checkpoints.'],
  ['PilotCohort', 'Subgroup inside a pilot used for reporting, experimentation, or differentiated programming.'],
  ['InviteLink', 'Role-specific entry path for admin, staff, athlete, or clinician onboarding.'],
  ['OrganizationMembership / TeamMembership', 'Role and permission truth for admins, coaches, staff, and athletes.'],
  ['ClinicianBridge', 'Explicit Pulse Check to AuntEdna bridge that keeps escalation routing coherent.'],
  ['users/{uid}', 'Athlete or staff profile record and onboarding completion truth.'],
  ['athlete-mental-progress/{uid}', 'Baseline routing, pathway seed, and post-baseline recommendations.'],
];

const DATA_WRITE_ROWS = [
  ['Organization setup', 'displayName, legalName, organizationType, implementationOwnerUserId, primaryOperationalAdminContact, defaultStudyPosture, defaultClinicianBridgeMode', 'Establishes the organization shell and the defaults that downstream teams and pilots inherit.'],
  ['Team setup', 'organizationId, displayName, teamType or sport, defaultAdminUserIds, defaultInvitePolicy, branding, defaultClinicianProfileId', 'Defines the operating container that coaches, athletes, and clinicians actually join.'],
  ['Pilot and cohort setup', 'pilotId, teamId, studyMode, checkpoint cadence, cohort grouping, enrollment rules', 'Controls pilot-aware branching, research posture, and cohort-specific reporting or experimentation.'],
  ['Role and invite setup', 'inviteType, defaultRole, permissionSetId, teamId, targetPilotId, status, expiresAt', 'Determines who can enter, what they become at entry, and which onboarding questions or views they should see.'],
  ['Clinician routing setup', 'ClinicianBridge mapping, team default clinician profile, athlete override when needed', 'Ensures the clinical escalation route exists before any real support or safety events occur.'],
  ['Athlete runtime onboarding', 'preferredName, pulseCheckOnboardingComplete, dailyReflectionPreferences, sport, position, seasonPhase, primaryMentalChallenge, initialPathway', 'Stores the in-app athlete onboarding truth and the first training signal.'],
  ['Athlete task gate', 'athleteOnboarding.productConsentAccepted, athleteOnboarding.baselinePathStatus, athlete-mental-progress/{uid}.assessmentNeeded', 'Creates the required-task lane that must clear before normal assignments or simulations should unlock. Team membership task state is synchronized from either web or native baseline completion.'],
  ['Athlete baseline routing', 'assessmentNeeded, currentPathway, recommendedPathway, baselineAssessment or baselineProbe', 'Connects onboarding to the first training prescription, writes the first canonical snapshot, and closes the onboarding loop no matter which client captured the baseline.'],
];

const ROLE_JOURNEY_ROWS = [
  ['Org or team admin', 'Receive administrative access, become the controlling admin for the operating container, then invite and manage the team when that responsibility has been handed off.'],
  ['Coach', 'Enter through a role-specific invite, confirm scoped visibility, complete setup, and land on an immediately useful roster read.'],
  ['Athlete', 'Enter through the correct team or pilot path, complete Nora onboarding, run the baseline, and leave with one clear next program direction.'],
  ['Clinician', 'Enter through a clinician-specific path, complete compliance and identity steps, and join the escalation route without broad roster-wide exposure.'],
];

const VISIBILITY_ROWS = [
  ['Athlete invite', 'Athlete role, team connection, baseline flow, pilot enrollment, and cohort alignment.'],
  ['Coach or staff invite', 'Scoped team role, dashboard visibility, notification setup, and athlete-invite ability when permitted.'],
  ['Clinician invite', 'Clinician role, compliance onboarding, and explicit bridge activation.'],
  ['Admin activation', 'Org and team admin authority for setup, invites, and administrative controls.'],
];

const VERIFICATION_ROWS = [
  ['Organization truth', 'Organization and team objects exist before downstream role onboarding begins.'],
  ['Clinical route', 'The team has a valid default clinician profile or an intentional no-clinician posture.'],
  ['Coach onboarding', 'The coach sees team and pilot context, the correct role, and a scoped dashboard experience.'],
  ['Athlete onboarding', 'users/{uid}.pulseCheckOnboardingComplete is true and sport is populated after Nora onboarding.'],
  ['Baseline trigger', 'athlete-mental-progress/{uid}.assessmentNeeded is true immediately after athlete onboarding save.'],
  ['Task gate state', 'pulsecheck-team-memberships/{membershipId}.athleteOnboarding.baselinePathStatus moves ready -> started -> complete and the athlete workspace keeps assignments locked until complete.'],
  ['Shared baseline evidence', 'The gate clears when assessmentNeeded is false and the athlete has either baselineAssessment (web) or baselineProbe (native), with membership task state reconciled to complete.'],
  ['Baseline completion', 'assessmentNeeded flips to false, baselinePathStatus is complete, and the first profile snapshot is present after baseline.'],
];

const FAILURE_ROWS = [
  ['Operational admin access is granted before the team is configured', 'Check whether organization and team setup were completed before administrative access was handed off.'],
  ['Coach lands with the wrong access or no useful dashboard', 'Check the invite type, default role, permission set, and team membership mapping.'],
  ['Athlete enters without team or pilot context', 'Check whether the athlete used the correct invite path and whether pilot or cohort fields were attached to the invite or enrollment flow.'],
  ['Clinical routing is missing when needed', 'Check the default clinician profile, ClinicianBridge mapping, and team escalation defaults.'],
  ['Baseline never appears', 'Check athlete-mental-progress/{uid}.assessmentNeeded and confirm the app reaches MainTabView after onboarding closes.'],
  ['Athlete can receive normal sim assignments before baseline completes', 'Check the athlete task gate in the workspace and confirm coach assignment surfaces respect the baseline lock for baseline-incomplete athletes.'],
];

const MODELING_ROWS = [
  ['Organization', 'One top-level organization container per customer or deployment account.'],
  ['Teams', 'One persistent team per sport or operational unit rather than using cohorts to replace teams.'],
  ['Pilot posture', 'Use one pilot per team in v1 unless there is a true cross-team study with shared governance.'],
  ['Clinician setup', 'A launch-ready team should have a default clinician profile whenever day-one escalation support is expected.'],
];

const MemberOnboardingGuideOverviewDoc: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Operations"
        title="Member Onboarding Guide"
        version="Version 1.3 | March 14, 2026"
        summary="Operational onboarding guide for how a new PulseCheck member actually enters the system from upstream setup through the athlete task gate and in-app baseline completion. This page covers the full chain: organization creation, team setup, pilot and cohort posture, clinician routing, role-specific invites, coach onboarding, athlete first-run experience, and the pre-training unlock boundary."
        highlights={[
          {
            title: 'Setup Starts Before The Athlete',
            body: 'A member onboarding flow is only correct when the organization, team, invite path, and escalation route already exist.',
          },
          {
            title: 'Role-Specific Entry Is Required',
            body: 'Admin, coach or staff, athlete, and clinician paths should stay distinct so permissions and experiences remain deterministic.',
          },
          {
            title: 'Task Gate Before Training',
            body: 'Even after consent is complete, the athlete should stay in a required-task lane until the in-app baseline finishes and standard training unlocks.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        sectionLabel="Operational Alignment"
        role="Source-of-truth runbook for how PulseCheck should onboard a new member across system setup, role assignment, coach enablement, athlete first-run flow, and clinician routing."
        sourceOfTruth="This document is authoritative for the full operational onboarding chain for a new PulseCheck member and should be read alongside the Athlete Journey, Coach Journey, Team and Pilot Onboarding Architecture, and Permissions & Visibility artifacts."
        masterReference="Use this artifact when preparing a launch, training staff, testing onboarding end to end, or validating that a member is entering the correct team, pilot, and baseline path."
        relatedDocs={[
          'Athlete User Journey',
          'Coach User Journey',
          'Team & Pilot Onboarding',
          'Permissions & Visibility',
        ]}
      />

      <SectionBlock icon={Users} title="Scope and Preconditions">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="What This Covers"
            accent="blue"
            body="This guide covers the whole operational chain required to onboard a new member correctly, not just the in-app athlete profile flow."
          />
          <InfoCard
            title="What Counts As Done"
            accent="green"
            body="A member onboarding is only complete when the system shell is ready, the right role enters through the right invite, and the athlete clears the required task gate by finishing baseline."
          />
        </CardGrid>
        <DataTable columns={['Checkpoint', 'Expectation']} rows={READINESS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="System Setup Before Any Member Is Invited">
        <StepRail steps={SYSTEM_SETUP_STEPS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Core Object Model">
        <DataTable columns={['Object', 'Operational Role']} rows={OBJECT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="Organization vs Team vs Pilot vs Cohort">
        <CardGrid columns="xl:grid-cols-4">
          <InfoCard
            title="Organization"
            accent="blue"
            body="The top-level customer container. Organizations hold the legal identity, primary admin handoff, and the set of teams that belong to the same partner."
          />
          <InfoCard
            title="Team"
            accent="blue"
            body="The persistent container for a sport, program, or operational unit. Teams hold the long-lived identity, membership, and invite structure."
          />
          <InfoCard
            title="Pilot"
            accent="amber"
            body="A time-bound initiative inside a team. Use a pilot when you need rollout structure, checkpointing, study posture, or a defined program window."
          />
          <InfoCard
            title="Cohort"
            accent="green"
            body="A subgroup inside a pilot. Use cohorts for intervention arms, position groups, rehab groups, or reporting splits without creating a separate team."
          />
        </CardGrid>
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Simple Rule"
            accent="purple"
            body="If something needs its own customer identity or legal/admin umbrella, it should probably be a separate organization. If it needs its own long-term roster, admins, or invite flow inside that customer, it should probably be a separate team. If it is just a subgroup inside a pilot, it should be a cohort."
          />
          <InfoCard
            title="Hierarchy"
            accent="red"
            body="Organization -> Team -> Pilot -> Cohort"
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Critical Data Written During Onboarding">
        <DataTable columns={['Layer', 'Key Fields', 'Why It Matters']} rows={DATA_WRITE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={UserCog} title="Role Handoff Model">
        <DataTable columns={['Role', 'Expected Handoff']} rows={ROLE_HANDOFF_ROWS} />
        <DataTable columns={['Role', 'Recommended Journey']} rows={ROLE_JOURNEY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Users} title="Coach and Staff Onboarding Flow">
        <StepRail steps={COACH_AND_STAFF_STEPS} />
      </SectionBlock>

      <SectionBlock icon={Brain} title="Athlete Onboarding and Baseline Flow">
        <StepRail steps={ATHLETE_STEPS} />
      </SectionBlock>

      <SectionBlock icon={KeyRound} title="Invite and Permission Rules">
        <DataTable columns={['Invite Type', 'What It Should Establish']} rows={VISIBILITY_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Boundary Rule"
            accent="red"
            body="Do not use one generic invite for all user types. The invite path should establish role, permission scope, and which onboarding lane the person enters."
          />
          <InfoCard
            title="Consent Rule"
            accent="amber"
            body="Product consent, research consent, and clinical or escalation consent are different truths and should stay in separate operational lanes."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Clinician and Escalation Readiness">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Default Team Clinical Route"
            accent="purple"
            body="If a rollout expects live escalation support, every launch-ready team should have a default clinician profile linked before athletes begin onboarding."
          />
          <InfoCard
            title="Clinician Access Rule"
            accent="blue"
            body="Clinicians should enter through a clinician-specific onboarding path and an explicit ClinicianBridge mapping, not through broad admin or coach access."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Operator Verification Checklist">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Before Athlete Testing"
            accent="purple"
            body={
              <BulletList
                items={[
                  'Organization and team are live and correctly modeled.',
                  'Coach or staff can enter with the right scoped role.',
                  'Clinical routing exists if the team needs safety escalation support.',
                ]}
              />
            }
          />
          <InfoCard
            title="After Athlete Completion"
            accent="green"
            body={
              <BulletList
                items={[
                  'Athlete reaches Nora onboarding without staff rescue.',
                  'Baseline auto-launches after onboarding.',
                  'Recommended pathway is written back after the 3-sim baseline.',
                ]}
              />
            }
          />
        </CardGrid>
        <DataTable columns={['Validation Point', 'What To Confirm']} rows={VERIFICATION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Smartphone} title="General Modeling Rules">
        <DataTable columns={['Layer', 'Recommended Shape']} rows={MODELING_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Bell} title="Reminder and Day-One Experience Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Coach Experience Rule"
            accent="green"
            body="The first coach moment should be a useful roster read with scoped visibility, not a blank configuration-heavy dashboard."
          />
          <InfoCard
            title="Athlete Experience Rule"
            accent="amber"
            body="The first athlete moment should feel like guided performance work. The athlete should see one clear next step, not a menu of internal system objects."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Failure Checks and Debug Path">
        <DataTable columns={['Issue', 'What To Check First']} rows={FAILURE_ROWS} />
      </SectionBlock>
    </div>
  );
};

const ONBOARDING_ACCESS_PAGES: ArtifactPageEntry[] = [
  {
    id: 'member-onboarding-guide',
    label: 'Member Onboarding Guide',
    subtitle: 'End-to-end entry flow from setup through baseline unlock.',
    icon: FileText,
    accent: '#c084fc',
    render: () => <MemberOnboardingGuideOverviewDoc />,
  },
  {
    id: 'team-pilot-onboarding',
    label: 'Team & Pilot Onboarding',
    subtitle: 'How orgs, teams, pilots, cohorts, clinicians, and enrollments enter the system.',
    icon: Building2,
    accent: '#38bdf8',
    render: () => <PulseCheckTeamPilotCohortOnboardingArchitectureTab />,
  },
];

const PulseCheckMemberOnboardingGuideTab: React.FC = () => {
  return (
    <ArtifactPageLibrary
      eyebrow="Pulse Check · Onboarding & Access"
      title="Onboarding & Access Library"
      summary="Operational parent artifact with internal pages for member entry flow, team and pilot onboarding architecture, and PulseCheck permissions posture."
      entries={ONBOARDING_ACCESS_PAGES}
    />
  );
};

export default PulseCheckMemberOnboardingGuideTab;
