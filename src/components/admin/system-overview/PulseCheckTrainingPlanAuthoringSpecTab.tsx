import React from 'react';
import { ArrowRightLeft, BookOpen, Clock3, Database, GitBranch, Layers, ShieldCheck, Target } from 'lucide-react';
import { CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const CORE_SEPARATION_ROWS = [
  ['ProgramPrescription', 'Next-step recommendation layer.', 'What is the best next practice candidate?', 'Useful for fallback or override logic, but not athlete-facing plan truth.'],
  ['TrainingPlan', 'Authored block across days or sessions.', 'What is the athlete building over time?', 'Persisted, athlete-facing, and the primary source for Active Plans.'],
  ['CurriculumSlate', 'Six active exercise slots owned by the plan layer.', 'Which three protocols and three simulations are in the athlete toolkit?', 'Persists slot status, mastery evidence, and backfill decisions.'],
  ['DailyTask', 'Execution truth for one date.', 'What is today’s practice item?', 'Materialized from the active plan’s next due step or active curriculum slate when a plan exists.'],
];

const TRIGGER_ROWS = [
  ['Baseline complete', 'Author the athlete’s first real block unless confidence is too low.'],
  ['Exploratory window complete', 'Use 1 to 3 early practice sessions before committing to the first authored plan.'],
  ['Plan completion', 'Author the next primary block from the updated profile.'],
  ['Significant profile change', 'Supersede the active block when the bottleneck or readiness pattern changes materially.'],
  ['Coach or pilot programming', 'Allow staff to author, constrain, or replace the primary plan directly.'],
];

const PLAN_TYPE_ROWS = [
  ['sim_focused', 'Stable enough to train skill directly. Keep three simulations active, keep three protocols available for regulation and priming, and prioritize sim exposure in daily materialization.'],
  ['protocol_focused', 'State volatility is the bottleneck. Keep three protocols active as the lead lane while maintaining three simulations for light sharpening and transfer checks.'],
  ['mixed', 'State and skill both matter. Keep the full three-protocol plus three-simulation slate active and materialize protocol_then_sim work when state support improves execution quality.'],
  ['assessment', 'Reserved for baseline or reassessment blocks. Keep it out of the default steady-state loop and do not let assessment replace the standing toolkit.'],
];

const ARCHETYPE_ROWS = [
  ['steady_focus_build', 'sim_focused', 'Weakest skill is sustained or selective attention and the athlete is stable enough to push direct skill work.'],
  ['reset_under_pressure', 'sim_focused', 'Weakest skill is reset, attentional shifting, or error recovery under compounding disruption.'],
  ['regulation_first_stabilization', 'protocol_focused', 'State volatility is the main blocker and readiness is fragile.'],
  ['protocol_to_skill_bridge', 'mixed', 'The athlete needs a short regulation or recovery phase before skill practice will transfer.'],
  ['reassessment_bridge', 'assessment or mixed', 'Nora needs to confirm whether the prior bottleneck has changed enough to start a new block.'],
];

const STORAGE_ROWS = [
  ['authoringTrigger', 'Why the block was authored now.'],
  ['authoringArchetype', 'Template key such as `steady_focus_build`.'],
  ['targetSkills', 'Skills the block is trying to move.'],
  ['targetStateGoal', 'State-oriented goal when applicable.'],
  ['activeProtocolSlots', 'Three protocol slot records with protocol id, lane, status, assigned reason, mastery evidence, and freshness.'],
  ['activeSimulationSlots', 'Three simulation slot records with sim id, target skill, status, mastery evidence, and transfer role.'],
  ['slotBackfillQueue', 'Ordered list of eligible protocol or simulation candidates that can fill a slot after graduation.'],
  ['masteryRulesVersion', 'Version of the slot-level graduation and maintenance evaluator.'],
  ['progressionShape', 'High-level intent such as `build`, `stabilize`, `bridge`, or `reassess`.'],
  ['completionRule', 'Human-readable completion rule.'],
  ['authoringConfidence', '`low`, `medium`, or `high`.'],
  ['currentStepIndex', 'The authored step currently active in the block.'],
  ['lastCompletedStepIndex', 'The most recently completed authored step.'],
  ['nextDueStepIndex', 'Operational pointer to the next due authored step.'],
  ['sourceProfileSnapshotId', 'Profile snapshot or revision Nora used while authoring.'],
  ['sourceProgramPrescriptionId', 'Recommendation-layer context used at authoring time, when relevant.'],
  ['authoringRulesVersion', 'Version of the ruleset used by the authoring engine.'],
  ['archetypeVersion', 'Version of the template used to author the block.'],
];

const STEP_RULES = [
  ['All steps are authored up front', 'The initial sequence is persisted at plan creation time instead of being filled in opportunistically.'],
  ['Six slots stay active', 'The plan layer should maintain exactly three protocol slots and three simulation slots unless safety, coach review, or onboarding status blocks assignment.'],
  ['Progression stays bounded', 'Start with the clearest bottleneck practice, repeat once if needed, then increase difficulty or pressure carefully.'],
  ['Composite steps stay single', 'A `protocol_then_sim` step is one authored `PlanStep` and one `DailyTask`.'],
  ['Completion counting is strict', '`completedCount` increments only when the authored step is fully completed.'],
  ['Mastery causes rotation', 'A mastered protocol or simulation moves to maintenance and the next eligible candidate backfills the open slot.'],
  ['Overrides preserve the plan', 'Same-day overrides mark the original step overridden; they do not erase the authored intent.'],
];

const AUTHORING_FLOW = [
  {
    title: 'Identify the primary development need',
    body: 'Read the weakest skill, stability trend, recent result pattern, protocol responsiveness, and coach context before deciding whether the athlete needs direct skill work, regulation-first work, or a bridge between the two.',
  },
  {
    title: 'Choose the plan type',
    body: 'Use `protocol_focused` when state instability is the main limiter, `mixed` when state and skill both matter, and `sim_focused` when the athlete is trainable and the bottleneck is mostly executional.',
  },
  {
    title: 'Choose the active slate',
    body: 'Populate three protocol slots and three simulation slots from the canonical registries, using the plan type to decide which lane leads daily materialization.',
  },
  {
    title: 'Save the authored plan',
    body: 'Persist the step sequence, active slate, pointer fields, mastery rules, and provenance metadata so the runtime can consume the plan directly without reconstructing it every day.',
  },
];

const LIFECYCLE_ROWS = [
  ['active', 'Guiding daily task materialization.'],
  ['paused', 'Held temporarily while preserving `nextDueStepIndex` and `currentStepIndex`.'],
  ['completed', 'Primary block finished and ready for the next authored plan.'],
  ['superseded', 'Replaced by a new plan after a significant profile change or staff action.'],
];

const GUARDRAIL_ROWS = [
  ['One primary active plan in v1', 'Exactly one active plan should be primary at a time.'],
  ['Six active slots per primary plan', 'The primary plan should hold exactly three protocol slots and three simulation slots when the six-exercise curriculum model is enabled.'],
  ['No silent daily replanning', 'Daily runtime consumes the plan; it should not author a fresh block every day by default.'],
  ['Fallback allowed, but secondary', 'ProgramPrescription may still drive fallback or override logic when no active plan exists.'],
  ['Coach replacement preserves history', 'Coach-authored replacement should supersede the old plan, not delete it.'],
  ['Assessment is special-case only', 'Use assessment for baseline or reassessment, not as the default steady-state mode.'],
];

const PulseCheckTrainingPlanAuthoringSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Training Plan Authoring Spec"
        version="Version 1.1 | June 2026"
        summary="Runtime contract for how Nora authors longer-horizon mental training blocks. This spec defines the relationship between ProgramPrescription, TrainingPlan, CurriculumSlate, and DailyTask; the trigger model for creating a new plan; the bounded archetype library; the stored provenance fields; and the daily materialization contract so Training Room can show a real programming surface instead of a hollow daily-recommendation wrapper."
        highlights={[
          {
            title: 'TrainingPlan Is Programming Truth',
            body: 'A real plan is an authored block with steps, a six-slot active toolkit, pointers, and provenance, not a byproduct of daily task generation.',
          },
          {
            title: 'CurriculumSlate Holds The Toolkit',
            body: 'The slate keeps three protocols and three simulations active while mastery evidence decides when Nora rotates a slot.',
          },
          {
            title: 'DailyTask Consumes The Plan',
            body: 'When a plan exists, the runtime should materialize today’s work from the next due step or active slate rather than inventing a new block.',
          },
          {
            title: 'Plan Authors, Then Daily Materializes',
            body: 'Authoring happens at explicit runtime moments such as baseline completion, plan completion, or meaningful profile change.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Runtime contract for authored mental-training blocks, step sequencing, and the relationship between recommendation logic, programming truth, and today’s execution truth."
        sourceOfTruth="This document is authoritative for how a TrainingPlan gets authored, what metadata is persisted with it, and how the runtime should advance plan pointers without reconstructing the block on each read."
        masterReference="Use the Daily Task + Training Plan Alignment Spec for execution truth and this page for the layer above it: how the authored block and six-slot toolkit are created in the first place."
        relatedDocs={[
          'Daily Task + Training Plan Alignment Spec',
          'Nora Assignment Rules v1.5',
          'State Signal Layer v1.2',
          'Profile Architecture v1.3',
        ]}
      />

      <SectionBlock icon={BookOpen} title="Runtime Separation">
        <DataTable columns={['Layer', 'Role', 'Answers', 'Rule']} rows={CORE_SEPARATION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Clock3} title="Authoring Triggers">
        <DataTable columns={['Trigger', 'Behavior']} rows={TRIGGER_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Layers} title="Plan Types">
        <DataTable columns={['Type', 'When To Use']} rows={PLAN_TYPE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Archetypes And Metadata">
        <DataTable columns={['Archetype', 'Plan Type', 'Use Case']} rows={ARCHETYPE_ROWS} />
        <DataTable columns={['Field', 'Purpose']} rows={STORAGE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Authoring Flow">
        <CardGrid columns="md:grid-cols-2">
          {AUTHORING_FLOW.map((step) => (
            <InfoCard key={step.title} title={step.title} body={step.body} accent="blue" />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Target} title="Step Rules">
        <DataTable columns={['Rule', 'Definition']} rows={STEP_RULES} />
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Lifecycle And Guardrails">
        <DataTable columns={['Status', 'Meaning']} rows={LIFECYCLE_ROWS} />
        <DataTable columns={['Guardrail', 'Behavior']} rows={GUARDRAIL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Implementation Notes">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Exploratory Window"
            accent="amber"
            body="Default to 2 exploratory practice sessions, allow up to 3, and then author a short starter block instead of leaving the athlete in recommendation-only mode."
          />
          <InfoCard
            title="Pause / Resume"
            accent="green"
            body="Pause should preserve the current pointers by default. Resume should continue the authored block unless a higher-priority supersession trigger fires."
          />
          <InfoCard
            title="Coach Replacement"
            accent="purple"
            body="If staff replaces the primary plan, keep the old block in history, mark it superseded, and let Nora resume authorship after the coach block completes."
          />
          <InfoCard
            title="Current Runtime Gap"
            accent="blue"
            body="The live authoring helper currently creates finite 3 to 5 step blocks and does not persist activeProtocolSlots, activeSimulationSlots, slot mastery, maintenance, or backfill. Those fields are the next schema step for the six-exercise model."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckTrainingPlanAuthoringSpecTab;
