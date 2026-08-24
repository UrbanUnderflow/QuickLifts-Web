import React from 'react';
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  Filter,
  FlaskConical,
  LayoutPanelTop,
  Settings2,
  ShieldCheck,
  Users,
  Waypoints,
} from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

const SCOPE_ROWS = [
  ['Team pilot index', 'Top-level team surface showing current pilots for that team.', 'Lets operators see which pilots are live before opening one pilot dashboard.'],
  ['Pilot detail dashboard', 'Primary dashboard scoped to one `pilotId`.', 'Every KPI, alert, participant, finding, and hypothesis resolves inside that pilot.'],
  ['Cohort lens', 'Optional subgroup lens inside one pilot using `cohortId`.', 'Supports a clearly labeled subgroup read while the pilot remains the root reporting object.'],
  ['Pilot participant detail', 'Athlete view opened from inside a pilot.', 'Explains the athlete as a participant in the selected pilot and preserves the pilot context throughout the view.'],
  ['Eligible-to-invite roster', 'Team members who may be invited into the pilot.', 'Stays visually and mathematically separate from enrolled pilot participants.'],
];

const DIRECTORY_ROWS = [
  ['Pilot identity', 'Show pilot name, team, status, dates, owner, objective, cadence, and next checkpoint.', 'Gives the operator enough context to choose the right pilot.'],
  ['Current pilots first', 'Show active pilots first and place completed or archived pilots in a separate history lane.', 'Keeps the default view focused on pilots that may need action today.'],
  ['Needs-attention summary', 'Show the most important unresolved setup, safety, participation, or data issue.', 'Helps operators choose where to act before opening detail.'],
  ['Readiness summary', 'Show the current phase, participant count, participation posture, connected data coverage, and evidence state.', 'Turns the directory into a useful pilot scan.'],
  ['Direct drill-in', 'Every pilot card or row opens the pilot-scoped detail view.', 'Moves operators into the selected pilot with its scope intact.'],
];

const ROUTE_ROWS = [
  ['Active pilot directory', '`/admin/pulsecheckPilotDashboard`', 'Lists current pilots and provides a separate history lane.'],
  ['Pilot detail dashboard', '`/admin/pulsecheckPilotDashboard/[pilotId]`', 'Owns Overview, People, Activity & Outcomes, Operations, Insights & Research, and the Manage Pilot entry point for one pilot.'],
  ['Pilot participant detail', '`/admin/pulsecheckPilotDashboard/[pilotId]/athletes/[athleteId]`', 'Explains one athlete in the context of the selected pilot.'],
];

const AREA_ROWS = [
  ['Overview', 'Where is this pilot, what needs attention, and what happens next?', 'Pilot identity, attention items, phase progress, current-state cards, plain-language interpretation, next actions, and participant preview.'],
  ['People', 'Who is participating and who still needs an enrollment action?', 'Enrolled participants, pending steps, invitations, exits, and a separate eligible-to-invite roster.'],
  ['Activity & Outcomes', 'Are athletes participating, and are the intended outcomes developing?', 'Participation by cycle, connected data coverage, data readiness, outcome measures, athlete feedback, cohort comparisons, and limitations.'],
  ['Operations', 'Is the pilot ready to support athletes and produce dependable data?', 'Support readiness, routing status, source freshness, device coverage, review queues, restrictions, holds, and active operational issues.'],
  ['Insights & Research', 'What is the pilot learning, and how is that learning governed?', 'Findings, hypotheses, evidence notes, Research Readout generation, review history, limitations, and claim status.'],
  ['Manage Pilot', 'Which settings or maintenance actions change how the pilot runs?', 'Pilot settings, enrollment setup, support assignments, cohorts, communications, disclosures, diagnostics, maintenance, transfers, archive, and controlled destructive actions.'],
];

const OVERVIEW_ROWS = [
  ['Pilot identity and purpose', 'Name, team, status, dates, owner, objective, review cadence, and next checkpoint.', 'Anchors every metric to the pilot the operator is reviewing.'],
  ['Needs attention', 'One compact list ordered by athlete safety, blocked setup, data risk, and missed review work.', 'Turns alerts into understandable actions.'],
  ['Pilot progress', '`Setup -> Enroll -> Collect baseline -> Review` with the current phase and completion criteria.', 'Explains why some metrics are still forming.'],
  ['Current-state cards', 'Athletes joined, participation this cycle, connected data coverage, data readiness, and athlete feedback.', 'Summarizes the pilot in terms people can act on.'],
  ['Plain-language interpretation', 'A state such as `Setup needs attention`, `Enrolling athletes`, `Collecting baseline`, or `Ready for review`.', 'Gives the numbers a clear meaning.'],
  ['Next actions', 'The three highest-value actions with an owner or destination.', 'Makes the Overview a working surface.'],
  ['Participant preview', 'A short preview of participant status with a direct link to People.', 'Keeps the first screen focused while preserving quick access.'],
];

const OVERVIEW_CARD_ROWS = [
  ['Athletes joined', 'Active `PilotEnrollment` count compared with the pilot target when a target exists.', 'Show a count and progress label.'],
  ['Participation this cycle', 'Eligible pilot athletes who completed the expected pilot actions in the current cadence window.', 'Show numerator, denominator, date window, and the action being measured.'],
  ['Connected data coverage', 'Active pilot athletes with usable connected data inside the freshness window.', 'Show the actual providers contributing coverage and keep device coverage separate from participation.'],
  ['Data readiness', 'Pilot athletes with enough current evidence for the next intended analysis.', 'Show maturity or baseline status with a plain explanation.'],
  ['Athlete feedback', 'Response coverage plus the governed trust, experience, or NPS measure available for this pilot.', 'Show sample size and use a threshold-aware state when the sample is small.'],
];

const PEOPLE_ROWS = [
  ['Active participants', 'Athletes with an active `PilotEnrollment` in the selected pilot.', 'Included in pilot population metrics when they meet each metric definition.'],
  ['Pending participant steps', 'Enrolled or invited athletes waiting on consent, account setup, baseline work, or another required step.', 'Show the exact step and a useful action.'],
  ['Completed or exited participants', 'Pilot enrollments with an explicit completion or exit state.', 'Keep history available while excluding these records from active denominators unless a metric explicitly includes them.'],
  ['Eligible to invite', 'Team members who can be invited into the pilot and have no active enrollment in it.', 'Place this list in a separate section and exclude it from every pilot KPI.'],
];

const ACTIVITY_OUTCOME_ROWS = [
  ['Participation', 'Expected check-ins, assignments, and other governed pilot actions by cadence window.', 'Use the athlete-visible completion state and show excused or suppressed opportunities separately.'],
  ['Connected data coverage', 'Usable source coverage and freshness by provider.', 'Name providers at metric level and avoid implying that one provider supplied every field.'],
  ['Evidence readiness', 'Baseline completion, maturity, completeness, stability, and contradiction posture.', 'Explain whether the pilot is still collecting evidence or ready for interpretation.'],
  ['Outcomes', 'Pilot-defined mental performance, support, care, trust, or experience outcomes.', 'Show the governed denominator, time window, baseline mode, and limitation state.'],
  ['Cohort comparisons', 'Comparison between cohorts inside the same pilot when both groups meet readiness requirements.', 'Name both cohorts, sample sizes, completeness differences, and the selected lens.'],
];

const OPERATIONS_ROWS = [
  ['Support readiness', 'Shows whether urgent support routing has a verified owner and reachable destination.', 'Use a plain action such as `Set support contact`; place role identifiers and response codes in Manage Pilot diagnostics.'],
  ['Data flow status', 'Shows source freshness, failed syncs, missing snapshots, and recompute posture.', 'Summarize the impact first and link to detailed diagnostics when investigation is needed.'],
  ['Restrictions and holds', 'Shows active athlete restrictions, suppression, review queues, and manual holds.', 'Collapse an all-clear state to `No active restrictions or holds`; expand categories when action exists.'],
  ['Operational issues', 'Shows active issues with severity, owner, affected population, and next step.', 'Prioritize athlete safety and pilot-blocking issues.'],
  ['Review cadence', 'Shows the next operational review and unresolved work carried into it.', 'Connects monitoring to a real owner and checkpoint.'],
];

const INSIGHTS_RESEARCH_ROWS = [
  ['Findings', 'Evidence-backed observations produced inside the selected pilot frame.', 'Show strength, eligible sample, supporting evidence, contradicting evidence, and limitations.'],
  ['Hypotheses', 'The pilot beliefs being tested over time.', 'Preserve leading indicators, status, confidence, review notes, reviewer, and review history.'],
  ['Research Readout', 'AI-assisted interpretation of a frozen governed evidence frame.', 'Keep manual generation, claim tags, citations, limitations, and human review inside this area.'],
  ['Research history', 'Approved, revised, rejected, and superseded readouts and hypothesis decisions.', 'Preserves a reproducible governance record.'],
];

const MANAGE_PILOT_ROWS = [
  ['Pilot setup', 'Pilot identity, dates, objective, cadence, owner, status, and completion criteria.', 'Changes the pilot contract and requires an authorized role.'],
  ['Enrollment experience', 'Join links, invitations, welcome-page copy, consent, and disclosures.', 'Keeps participant acquisition controls together.'],
  ['Cohorts and support roles', 'Cohort setup, support assignments, clinician routing, and staff access.', 'Centralizes configuration that changes scope or support readiness.'],
  ['Communications', 'Pilot reminders, enrollment recovery, and approved participant messaging.', 'Separates communication controls from monitoring.'],
  ['Diagnostics and maintenance', 'Detailed error codes, raw status, demo mode, seed data, recomputes, and repair tools.', 'Keeps technical controls available while the monitoring areas stay focused on the pilot story.'],
  ['Transfers, archive, and removal', 'Roster transfers, pilot archive, and controlled destructive actions.', 'Require clear confirmation, authorization, and an audit record.'],
];

const DISPLAY_STATE_ROWS = [
  ['Measured zero', 'The metric ran against a valid eligible population and the measured count is zero.', 'Show `0` with its denominator and period.'],
  ['Waiting for data', 'The pilot needs more baseline days, responses, or connected-source history.', 'Name the missing evidence and the next readiness checkpoint.'],
  ['Not available', 'The service returned no usable value or required source coverage is absent.', 'Show the unavailable reason and keep this state distinct from zero.'],
  ['Insufficient sample', 'The sample remains below a governed interpretation threshold.', 'Show sample size and suppress the unsupported interpretation.'],
  ['Setup required', 'A required owner, route, permission, or pilot setting is incomplete.', 'Show a plain-language action with the correct destination.'],
  ['Not applicable', 'The pilot design excludes this measure or workflow.', 'Explain the pilot rule that makes it inapplicable.'],
];

const LAYER_ROWS = [
  ['System health', 'Is the pilot data flow running?', 'Operations', 'Connection health, stale sources, failed recomputes, missing snapshots, and export issues.'],
  ['Evidence quality', 'Is there enough trustworthy signal to interpret?', 'Activity & Outcomes', 'Maturity stages, linked days, source mix, completeness, diversity, and contradictions.'],
  ['Insight production', 'What stable patterns is the engine discovering?', 'Insights & Research', 'Pattern families, thresholds, projection volume, confidence distribution, and suppressed outputs.'],
  ['Outcome validation', 'Are the learned relationships useful within the governed frame?', 'Activity & Outcomes', 'Within-athlete comparisons, protocol effectiveness by body state, and milestone outcomes by context flag.'],
  ['Adoption', 'Are athletes and coaches following through?', 'Activity & Outcomes', 'Participation, recommendation engagement, follow-through, coach view rate, and override posture.'],
  ['Hypothesis governance', 'How are pilot beliefs changing with the evidence?', 'Insights & Research', 'Leading indicators, status, confidence, evidence notes, reviewer action, and review cadence.'],
];

const SOURCE_ROWS = [
  ['Provisioning model', 'Pilot, PilotCohort, and PilotEnrollment define dashboard scope and denominator pools.'],
  ['Correlation engine objects', 'Evidence records, pattern models, recommendation projections, and assessment context flags provide the evaluation layer.'],
  ['Health-context operations telemetry', 'Source freshness, provider identity, sync posture, and recompute failure data support operations and coverage reporting.'],
  ['Profile snapshots and exports', 'Milestone context flags and pilot-scoped snapshot lineage support validation and exports.'],
  ['Assignment and interaction telemetry', 'Participation, recommendation engagement, coach overrides, protocol follow-through, and dashboard usage support activity and adoption metrics.'],
  ['Governed pilot read model', 'Frozen dashboard snapshots or equivalent read-model payloads define the allowed evidence frame for Research Readout generation.'],
];

const SCOPING_RULES = [
  'The primary scope key is `pilotId`. Team and organization provide navigation and filter context.',
  'Every monitored athlete has an active `PilotEnrollment` for the selected pilot.',
  'Each KPI declares whether its denominator is pilot enrollments, active pilot athletes, or eligible pilot athletes.',
  'The eligible-to-invite roster stays outside pilot KPI calculations until an active enrollment exists.',
  'Cohorts refine a read inside one pilot while the pilot remains the root reporting scope.',
  'Each card states whether the cohort lens applies. A cohort-scoped card returns cohort data or a clear unavailable state. Silent fallback to a whole-pilot result is prohibited.',
  'The cohort control appears when the pilot has usable cohorts and stays out of the interface when no cohort choice exists.',
  'Completed and archived pilots appear in a separate history lane.',
  'Pre-pilot baseline and longitudinal context carry explicit labels and remain visually separate from pilot-period KPIs.',
  'Every metric distinguishes measured zero, waiting for data, unavailable, insufficient sample, setup required, and not applicable states.',
];

const RELEASE_ROWS = [
  ['V1', 'Task-based navigation, state-aware Overview, participant separation, scoped activity and outcome cards, operations summary, governed Insights & Research area, and role-gated Manage Pilot controls.', 'Creates a pilot surface that explains status, action, and evidence while preserving existing capability.'],
  ['V2', 'Richer outcome comparisons, saved operator views, review queue automation, assisted pilot summary, and guided hypothesis updates.', 'Unlocks after the telemetry, sample sizes, and review workflow can support these reads.'],
];

const PulseCheckCorrelationEnginePilotDashboardTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Physiology-Cognition Correlation Engine"
        title="Correlation Engine Pilot Dashboard"
        version="Version 1.1 | August 23, 2026"
        summary="Pilot-scoped working surface for understanding progress, participation, outcomes, support readiness, and research learning. The dashboard starts with the pilot's current state and the next useful action, then organizes detail around the jobs an operator needs to complete."
        highlights={[
          {
            title: 'Task-Based Structure',
            body: 'Overview, People, Activity & Outcomes, Operations, and Insights & Research each answer one clear operator question. Manage Pilot holds settings, diagnostics, and controlled maintenance actions.',
          },
          {
            title: 'PilotEnrollment Defines Inclusion',
            body: 'An athlete enters pilot monitoring through an active PilotEnrollment. Eligible team members remain in a separate invitation roster until they enroll.',
          },
          {
            title: 'Every Number Has Meaning',
            body: 'Cards show their population, time window, data state, and next action so an operator can distinguish measured results from setup or evidence gaps.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Pilot-scoped monitoring and evaluation artifact for the correlation engine. It defines the active-pilot directory, task-based pilot detail areas, Overview hierarchy, participant separation, Manage Pilot boundary, drill-down behavior, and scope rules rooted in Pilot, Cohort, and PilotEnrollment."
        sourceOfTruth="This document is authoritative for the Correlation Engine Pilot Dashboard structure, pilot directory behavior, information architecture, Overview cards, display states, drill-down model, and scope boundary. Engine object definitions, confidence rules, and onboarding object definitions remain governed by their respective artifacts."
        masterReference="Use this page when designing or implementing pilot dashboard surfaces, pilot-level KPI cards, pilot filters, participant drill-down behavior, pilot-health reporting, or settings placement. Use the data-model and onboarding artifacts for canonical scope keys and joins."
        relatedDocs={[
          'Physiology-Cognition Correlation Engine',
          'Correlation Data Model Spec',
          'Correlation Engine Pilot Dashboard Addendum',
          'Correlation Engine Engineering Task Breakdown',
          'Pilot Research Readout Implementation Spec',
          'Team & Pilot Onboarding',
          'Profile Snapshot & Export Spec',
          'Coach Dashboard IA',
        ]}
      />

      <SectionBlock icon={Waypoints} title="Scope Model">
        <DataTable columns={['Surface', 'Scope', 'Rule']} rows={SCOPE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={LayoutPanelTop} title="Active Pilot Directory">
        <DataTable columns={['Directory Element', 'Behavior', 'Why']} rows={DIRECTORY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Filter} title="Admin Route Contract">
        <DataTable columns={['Surface', 'Route', 'Rule']} rows={ROUTE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Task-Based Information Architecture">
        <DataTable columns={['Area', 'Primary Question', 'Contents']} rows={AREA_ROWS} />
      </SectionBlock>

      <SectionBlock icon={LayoutPanelTop} title="Overview Information Hierarchy">
        <DataTable columns={['Block', 'Contents', 'Purpose']} rows={OVERVIEW_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Overview Cards">
        <DataTable columns={['Card', 'Pilot-Scoped Meaning', 'Display Rule']} rows={OVERVIEW_CARD_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Users} title="People Structure">
        <DataTable columns={['People Group', 'Definition', 'Reporting Rule']} rows={PEOPLE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Activity & Outcomes Structure">
        <DataTable columns={['Lane', 'Meaning', 'Display Rule']} rows={ACTIVITY_OUTCOME_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Operations Structure">
        <DataTable columns={['Lane', 'Meaning', 'Display Rule']} rows={OPERATIONS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={FlaskConical} title="Insights & Research Structure">
        <DataTable columns={['Lane', 'Meaning', 'Governance Rule']} rows={INSIGHTS_RESEARCH_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Settings2} title="Manage Pilot Boundary">
        <DataTable columns={['Control Group', 'Contents', 'Rule']} rows={MANAGE_PILOT_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Monitoring Shows Status"
            accent="green"
            body="Overview and Operations explain the issue, its impact, and the next useful action. The action can open the exact Manage Pilot control needed to resolve it."
          />
          <InfoCard
            title="Management Changes State"
            accent="amber"
            body="Manage Pilot contains configuration, maintenance, access, and high-impact controls. Each control follows role permissions, confirmation requirements, and audit logging."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Meaningful Data States">
        <DataTable columns={['State', 'Meaning', 'Required Display']} rows={DISPLAY_STATE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Evaluation Layer Placement">
        <DataTable columns={['Layer', 'Primary Question', 'Primary Area', 'Meaning']} rows={LAYER_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Users} title="Pilot Scoping Rules">
        <InfoCard title="Non-Negotiable Scope Boundary" accent="red" body={<BulletList items={SCOPING_RULES} />} />
      </SectionBlock>

      <SectionBlock icon={Filter} title="Data Source Mapping">
        <DataTable columns={['Source Layer', 'How It Feeds The Dashboard']} rows={SOURCE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={FlaskConical} title="Release Phasing">
        <DataTable columns={['Phase', 'Scope', 'Why']} rows={RELEASE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Participant Drill-Down Rule"
            accent="green"
            body="Participant detail opens from a pilot context and keeps that pilot context visible. The page explains the athlete's participation, evidence, and outcomes inside the selected pilot."
          />
          <InfoCard
            title="History Rule"
            accent="amber"
            body="Completed and archived pilots remain available in a separate history mode so the current directory stays focused on pilots that need action today."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Design Principle">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Pilot Intelligence Comes First"
            accent="blue"
            body="The first screen explains what phase the pilot is in, what needs attention, how athletes are participating, whether evidence is ready, and what the operator should do next. Operational counters support those questions."
          />
          <InfoCard
            title="Clear Feedback And Calm Motion"
            accent="green"
            body="Copy, save, generate, refresh, and review actions give immediate visible feedback on the control or nearby. Motion stays subtle and purposeful so state changes are easy to follow."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckCorrelationEnginePilotDashboardTab;
