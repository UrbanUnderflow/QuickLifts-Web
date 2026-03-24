import React from 'react';
import {
  ArrowRightLeft,
  CheckSquare,
  ClipboardList,
  Clock3,
  Database,
  GitBranch,
  Layers,
  ShieldCheck,
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

const OBJECT_MODEL_ROWS = [
  ['DailyTask', 'Execution truth for a specific date.', 'What is my rep today? What state is it in? What happened when I finished?', 'Exactly one primary due-today task per athlete per date.'],
  ['TrainingPlan', 'Programming truth across days or sessions.', 'What is Nora building over time? Where am I in the sequence?', 'Provides context and progression but does not replace the active DailyTask by itself.'],
  ['PlanStep', 'A sequenced unit inside a TrainingPlan.', 'What was today supposed to be inside the plan?', 'Overridden steps are marked overridden, not silently completed.'],
];

const MATERIALIZATION_ROWS = [
  ['First app open', 'Primary v1 materialization path. Create today’s DailyTask from the latest state snapshot, active plan, and assignment rules.'],
  ['Structured check-in', 'May materialize or rematerialize the task when the task is still mutable.'],
  ['Coach manual assignment', 'May supersede an unmaterialized or mutable task for the date.'],
  ['State-triggered rematerialization', 'Allows same-day replacement when fresh state meaningfully changes routing.'],
  ['No pre-materialized truth', 'Do not treat days-ahead tasks as committed execution truth. Materialize on the day the task is due.'],
];

const LIFECYCLE_ROWS = [
  ['assigned', 'Materialized and due today, not yet started.', 'started, deferred, superseded, expired'],
  ['started', 'Athlete has begun the task.', 'completed, paused, superseded'],
  ['paused', 'Mid-session pause with state preserved.', 'started (resume), superseded, expired'],
  ['completed', 'Task finished and result summary is available.', 'terminal'],
  ['deferred', 'Task explicitly deferred for the date.', 'terminal'],
  ['superseded', 'Task replaced by another DailyTask for the same date.', 'terminal'],
  ['expired', 'Date passed without usable completion.', 'terminal'],
];

const TIME_BOUNDARY_ROWS = [
  ['Athlete-local sourceDate', 'Bind DailyTask.sourceDate to the athlete local timezone captured at materialization time.'],
  ['Timezone captured once', 'Mid-day travel does not re-date the active task. The next day uses the new timezone.'],
  ['4:00 AM rollover', 'Use a 4:00 AM athlete-local boundary for expiration and next-day materialization.'],
  ['Cross-midnight continuity', 'A task started before midnight and finished before 4:00 AM stays attached to its original sourceDate.'],
];

const COEXISTENCE_ROWS = [
  ['Protocol -> Sim chain', 'Yes', 'Represent as one composite DailyTask with internal phase progress, not two competing primary tasks.'],
  ['Coach secondary work', 'Yes', 'Allow as non-primary work. Show under Active Plans or coach-tagged training, not as the Home primary task.'],
  ['Post-completion follow-up suggestion', 'Yes', 'Keep as a suggestion in the completed card or Nora chat, not a second Home task.'],
  ['Two simultaneous Nora primary tasks', 'No', 'Never allow this. Nora must resolve to one primary due-today task.'],
];

const EMPTY_AND_OVERRIDE_ROWS = [
  ['no_task_yet', 'Athlete finished onboarding or baseline, but today’s first Nora task has not materialized yet.', 'Show live baseline context plus a Nora message that the first program is being shaped. This is a derived render state, not a DailyTask.status.'],
  ['between_programs', 'No active plan and no due-today task after plan completion or pause.', 'Show recent progress plus a next-plan message. This is a derived render state, not a DailyTask.status.'],
  ['state-based override', 'A planned step is replaced because fresh same-day state changes what the athlete should do now.', 'The new DailyTask becomes execution truth. The plan stays visible, and the original PlanStep is marked overridden, not completed.'],
];

const SURFACE_ROWS = [
  ['Home', 'DailyTask surface', 'Active DailyTask.id', 'Shows the one current rep, why it was assigned, whether it is done, and what the athlete should do next.'],
  ['Mental Training', 'TrainingPlan surface with Today mirror', 'Active DailyTask.id + active TrainingPlan context', 'Uses the three-section model: Today -> Active Plans -> Recent Results.'],
  ['Nora chat', 'Conversation surface', 'Active DailyTask.id + TrainingPlan.id + latest state snapshot', 'Must launch and speak from the same assignment truth rather than inventing a second task narrative.'],
];

const METRIC_ROWS = [
  ['Sim', 'Primary metric plus up to two secondary metrics.', 'Stability, accuracy, degradation onset, recovery speed.', '“Your focus held up better under fatigue today.”'],
  ['Protocol', 'Primary metric plus Nora takeaway even when telemetry is lighter.', 'Completion quality, self-rated shift, reflection depth, voice stability.', '“Your breathing pattern was more consistent this time.”'],
  ['Trial', 'Checkpoint result with transfer framing.', 'Checkpoint score, Transfer Gap, transfer framing.', '“Your baseline is locked. This is where we start measuring.”'],
];

const EVENT_ROWS = [
  ['daily_task_materialized', 'dailyTaskId, athleteId, sourceDate, actionType, materializedBy, trainingPlanId if plan-backed, stateSnapshotId'],
  ['daily_task_started', 'dailyTaskId, athleteId, startedAt'],
  ['daily_task_paused', 'dailyTaskId, athleteId, pausedAt'],
  ['daily_task_resumed', 'dailyTaskId, athleteId, resumedAt'],
  ['daily_task_completed', 'dailyTaskId, athleteId, completedAt, primaryMetric, noraTakeaway, planStepIndex if plan-backed'],
  ['daily_task_deferred', 'dailyTaskId, athleteId, deferReason, deferredAt'],
  ['daily_task_superseded', 'dailyTaskId, supersededByDailyTaskId, supersededReason, athleteId'],
  ['daily_task_expired', 'dailyTaskId, athleteId, sourceDate, expiredAt'],
  ['plan_step_activated', 'trainingPlanId, stepIndex, linkedDailyTaskId, athleteId'],
  ['plan_step_completed', 'trainingPlanId, stepIndex, linkedDailyTaskId, resultSummary'],
  ['plan_step_overridden', 'trainingPlanId, stepIndex, overrideReason, replacementDailyTaskId'],
  ['empty_state_rendered', 'athleteId, emptyStateType, surface'],
];

const MIGRATION_ROWS = [
  ['Phase 1', 'Create the unified read model joining pulsecheck-daily-assignments, active program data, and mapped legacy assignments.', 'Home and Mental Training can read from the shared DailyTask + TrainingPlan view model.'],
  ['Phase 2', 'Render Home and Mental Training from the shared DailyTask + TrainingPlan model.', 'Both surfaces show the same task for the same date.'],
  ['Phase 3', 'De-prioritize legacy mental-exercise-assignments and mental-curriculum-assignments from the primary athlete surface.', 'Legacy content no longer drives the main card when Nora-assigned work exists.'],
  ['Phase 4', 'Retire legacy primary-card fallbacks and keep only adapters or admin-only visibility where needed.', 'All live programming flows through the new model.'],
];

const SOURCE_OF_TRUTH_ROWS = [
  ['1. Safety and escalation policy', 'Tier 2 and Tier 3 states override all training assignment.'],
  ['2. Current state snapshot and freshness', 'Same-day state may cause Nora to override the planned step.'],
  ['3. DailyTask execution truth', 'The primary DailyTask is what every athlete surface shows for the date.'],
  ['4. Active TrainingPlan context', 'Provides progression and longitudinal framing without replacing the active task by itself.'],
  ['5. Legacy assignment data', 'Only valid when mapped into the new model. Never show it as a competing primary truth.'],
];

const ACCEPTANCE_ITEMS = [
  'Home, Nora chat, and Mental Training all reference the same DailyTask.id for the same date.',
  'The athlete never sees two different answers to what today’s rep is.',
  'Completing a rep changes Home from launch-ready to completed state.',
  'Mental Training mirrors today’s status correctly.',
  'Plan-backed tasks show progress in athlete-facing terms.',
  'Overrides are visible and explained instead of silent.',
  'Empty states use live baseline or progress context instead of stale legacy fallbacks.',
  'Superseded tasks are preserved with reason but are no longer shown as primary.',
  'Cross-midnight sessions remain attached to their original sourceDate.',
];

const OPEN_QUESTION_ITEMS = [
  'Whether completed Home cards should lead with the primary metric or Nora’s takeaway.',
  'How coach-manual work should appear when it is valid but outside the current Nora plan.',
  'Whether plan cadence should enforce rest-day posture or remain daily Nora judgment at materialization time.',
];

const PulseCheckDailyTaskTrainingPlanAlignmentSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Daily Task + Training Plan Alignment Spec"
        version="Version 1.0 | March 2026"
        summary="Runtime surface-coherence contract for athlete work in PulseCheck. This artifact defines the canonical DailyTask, TrainingPlan, and PlanStep model; materialization rules; lifecycle state machine; date-boundary rules; event contract; and migration path so Home, Mental Training, and Nora chat always speak from one assignment truth."
        highlights={[
          {
            title: 'DailyTask Is Execution Truth',
            body: 'The athlete should see one primary due-today task for the date, and every runtime surface should reference the same DailyTask id.',
          },
          {
            title: 'TrainingPlan Is Programming Truth',
            body: 'The plan explains what Nora is building over time, but it does not create a second competing answer about what matters right now.',
          },
          {
            title: 'Programs Prescribe; Sessions Deliver',
            body: 'Plan steps are candidates for the day, not guarantees. Same-day state may override the planned step without breaking longitudinal integrity.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Runtime surface-coherence spec for how Nora-assigned athlete work should be materialized, persisted, rendered, and updated across Home, Mental Training, and Nora chat."
        sourceOfTruth="This document is authoritative for DailyTask and TrainingPlan object definitions, lifecycle rules, date-boundary logic, surface ownership, empty states, override behavior, and the event contract. It is not authoritative for how Nora chooses the task in the first place."
        masterReference="Use Nora Assignment Rules for bounded selection logic, State Signal Layer for state and freshness logic, Runtime Architecture for source-of-truth ordering, and this page for what athlete-facing execution truth should look like once a task exists."
        relatedDocs={[
          'Runtime Architecture v1',
          'Nora Assignment Rules v1.1',
          'State Signal Layer v1.2',
          'Profile Architecture v1.3',
          'Onboarding Architecture v1',
        ]}
      />

      <SectionBlock icon={Layers} title="Canonical Object Model">
        <DataTable columns={['Object', 'Role', 'What It Answers', 'Key Integrity Rule']} rows={OBJECT_MODEL_ROWS} />
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="DailyTask"
            accent="purple"
            body="One date-bound execution artifact. This is what launches, starts, completes, defers, expires, or gets superseded."
          />
          <InfoCard
            title="TrainingPlan"
            accent="blue"
            body="Longer-horizon programming context. It should explain what Nora is building without conflicting with the current-day execution truth."
          />
          <InfoCard
            title="PlanStep"
            accent="green"
            body="The plan’s sequenced step object. It preserves whether the intended step was completed, skipped, or overridden by a same-day state change."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Clock3} title="Materialization And Lifecycle">
        <DataTable columns={['Trigger Or Rule', 'Operating Behavior']} rows={MATERIALIZATION_ROWS} />
        <DataTable columns={['Status', 'Meaning', 'Allowed Transitions']} rows={LIFECYCLE_ROWS} />
        <InfoCard
          title="Expiration Rule"
          accent="amber"
          body="A DailyTask expires at 4:00 AM athlete-local on the following day. If the athlete started before midnight and is still in progress at 4:00 AM, the task stays in progress until completion or timeout rather than expiring mid-session."
        />
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Date Boundaries, Coexistence, And Empty States">
        <DataTable columns={['Rule', 'Definition']} rows={TIME_BOUNDARY_ROWS} />
        <DataTable columns={['Scenario', 'Allowed?', 'Display Rule']} rows={COEXISTENCE_ROWS} />
        <DataTable columns={['State', 'When It Exists', 'Required UI Behavior']} rows={EMPTY_AND_OVERRIDE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Surface Ownership">
        <DataTable columns={['Surface', 'Primary Job', 'Must Read', 'Key Behavior']} rows={SURFACE_ROWS} />
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Home"
            accent="purple"
            body="Home is the DailyTask surface. It answers what today’s rep is, why it was assigned, whether it is done, and what the next action should be."
          />
          <InfoCard
            title="Mental Training"
            accent="blue"
            body="Mental Training is the TrainingPlan surface with a mirrored Today section at the top. The intended information architecture is Today -> Active Plans -> Recent Results."
          />
          <InfoCard
            title="Nora Chat"
            accent="green"
            body="Nora chat must open aware of the same DailyTask and plan context rather than inventing a second assignment narrative from conversation alone."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Metrics And Event Contract">
        <DataTable columns={['Task Type', 'Metric Contract', 'Example Metrics', 'Example Nora Takeaway']} rows={METRIC_ROWS} />
        <DataTable columns={['Event', 'Required Payload']} rows={EVENT_ROWS} />
        <InfoCard
          title="Composite Task Analytics"
          accent="amber"
          body="A protocol_then_sim chain still counts as one DailyTask for surface truth and completion accounting. If deeper analytics are needed later, phase-level sub-events can be added without changing the one-task model."
        />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Source Of Truth And Migration">
        <DataTable columns={['Priority', 'What It Governs']} rows={SOURCE_OF_TRUTH_ROWS} />
        <DataTable columns={['Phase', 'Scope', 'Exit Criteria']} rows={MIGRATION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Implementation Decisions Locked For v1">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Materialization Strategy"
            accent="green"
            body={
              <BulletList
                items={[
                  'Locked v1 rule: first app open is the primary materialization path.',
                  'Same-day check-in may materialize or rematerialize the task while it is still mutable.',
                  'Future-scale option: overnight provisional materialization with same-day rematerialization before the task is locked.',
                ]}
              />
            }
          />
          <InfoCard
            title="Composite Completion"
            accent="blue"
            body={
              <BulletList
                items={[
                  'protocol_then_sim is one DailyTask.',
                  'Home should treat it as one due-today rep.',
                  'The runtime may show internal phase progress, but the Home card completes only when the full chain completes.',
                ]}
              />
            }
          />
          <InfoCard
            title="Status Mapping Discipline"
            accent="purple"
            body={
              <BulletList
                items={[
                  'DailyTask.status is execution truth.',
                  'PlanStep.stepStatus is programming truth.',
                  'Transitions should flow through one shared mapping layer so plan and execution states cannot drift semantically in code.',
                ]}
              />
            }
          />
        </CardGrid>
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Mutability And Coach Freeze"
            accent="amber"
            body="For automatic rematerialization, a task should be treated as mutable only while it is still assigned. Coach-frozen is an execution lock created by coach override or coach defer behavior, stored on the DailyTask as task-level control metadata, not as a DailyTask status of its own."
          />
          <InfoCard
            title="Plan Cardinality And Pause Posture"
            accent="blue"
            body="V1 allows multiple active plans in the model, but exactly one may be primary. Paused and resumed remain reserved extension states or events rather than launch-blocking v1 requirements across all execution surfaces."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={CheckSquare} title="Acceptance Criteria And Open Questions">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Acceptance Criteria"
            accent="green"
            body={<BulletList items={ACCEPTANCE_ITEMS} />}
          />
          <InfoCard
            title="Open Questions"
            accent="amber"
            body={<BulletList items={OPEN_QUESTION_ITEMS} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckDailyTaskTrainingPlanAlignmentSpecTab;
