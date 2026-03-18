import React from 'react';
import { AlertTriangle, Brain, Database, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const PRINCIPLE_CARDS = [
  {
    title: 'Build Contract Stack First',
    accent: 'red' as const,
    body: 'Do not start source-specific implementation by improvising storage or runtime behavior. The rollout should respect the locked contract order already defined in the preceding specs.',
  },
  {
    title: 'Ship A Real MVP, Not A Partial Rewrite',
    accent: 'blue' as const,
    body: 'The first milestone should produce a working canonical snapshot path that still leverages current shared data, not a half-built future architecture with no athlete value.',
  },
  {
    title: 'Preserve Current Value While Migrating',
    accent: 'green' as const,
    body: 'QuickLifts / FitWithPulse context should keep powering PulseCheck during rollout. Migration should add capability without regressing the current shared-context advantage.',
  },
];

const MVP_ROWS = [
  ['Canonical snapshot contract locked', 'Snapshot, source-record, assembler, storage, and orchestration specs are all in place and treated as implementation constraints.', 'Already substantially defined in the handbook.'],
  ['Legacy summary bridge lane', 'Current `daily-health-summaries` can feed the new pipeline as a migration source rather than being the direct runtime contract.', 'Required for safe cutover.'],
  ['Assembler-backed daily snapshot', 'PulseCheck can read a canonical daily snapshot produced by the new system, even if some inputs still originate from legacy shared summary data.', 'Required MVP outcome.'],
  ['Basic source-status posture', 'Runtime can tell the difference between synced, waiting, stale, error, and disconnected posture.', 'Required for honest product behavior.'],
  ['Nora snapshot read path', 'At least one PulseCheck health-backed runtime surface reads the canonical snapshot instead of legacy direct summary logic.', 'Required to prove the architecture works.'],
];

const MILESTONE_STEPS = [
  {
    title: 'Milestone 0: Contract Lock',
    body: 'Treat the architecture, snapshot, source-record, assembler, storage, and orchestration docs as the implementation contract. Resolve any remaining schema disputes before coding adapters.',
    owner: 'Product + architecture',
  },
  {
    title: 'Milestone 1: Bridge The Current System',
    body: 'Build canonical storage and assembler flow using the existing shared QuickLifts summary lane as a migration input so the new runtime can produce first snapshots quickly.',
    owner: 'Platform + iOS',
  },
  {
    title: 'Milestone 2: Cut Nora To Snapshot',
    body: 'Move PulseCheck health-backed chat and basic insight paths to consume the canonical snapshot, source posture, and freshness state rather than legacy direct reads.',
    owner: 'PulseCheck runtime',
  },
  {
    title: 'Milestone 3: Add PulseCheck-Native HealthKit',
    body: 'Implement the first direct source adapter so PulseCheck can generate context even when QuickLifts is not used.',
    owner: 'PulseCheck iOS',
  },
  {
    title: 'Milestone 4: Add Oura And Backfill',
    body: 'Introduce Oura ingestion plus backfill and stale-source recovery flows to deepen recovery and readiness coverage.',
    owner: 'Platform + integrations',
  },
  {
    title: 'Milestone 5: Expand Consumers',
    body: 'Move dashboards, proactive insights, and future coach surfaces onto the canonical snapshot with privacy-aware projections and operator tooling.',
    owner: 'Runtime + web + ops',
  },
];

const WORKSTREAM_ROWS = [
  ['Runtime contract workstream', 'Finalize enums, field names, projection rules, and runtime read shape for the snapshot.', 'Architecture / platform.'],
  ['Persistence workstream', 'Create canonical Firestore collections, revision strategy, and source-status store.', 'Platform.'],
  ['Assembler workstream', 'Implement merge engine, trace persistence, and affected-window recompute logic.', 'Platform / backend leaning.'],
  ['Bridge adapter workstream', 'Convert legacy shared summary flow into a canonical input lane.', 'QuickLifts + platform.'],
  ['PulseCheck runtime workstream', 'Swap health chat and future insight surfaces onto snapshot-backed reads.', 'PulseCheck iOS.'],
  ['Native source adapter workstream', 'Build HealthKit first, then Oura, both targeting source-record contracts.', 'PulseCheck iOS + integrations.'],
  ['Ops and QA workstream', 'Build trace inspection, rebuild controls, stale-source dashboards, and test scenarios.', 'Ops / QA / platform.'],
];

const OWNERSHIP_ROWS = [
  ['Product / architecture', 'Own contract approval, milestone readiness, and scope discipline.', 'Prevent mid-build drift.'],
  ['Platform / backend', 'Own Firestore model, assembler, trace storage, source-status store, and rebuild job orchestration.', 'Core shared system owner.'],
  ['QuickLifts iOS', 'Own the bridge from current shared summary generation into canonical source lanes where needed.', 'Protects current value during migration.'],
  ['PulseCheck iOS', 'Own runtime cutover plus native HealthKit integration and source-state-aware UX.', 'Primary product consumer and new source owner.'],
  ['Integrations', 'Own Oura connector planning, auth, and connector-specific operational posture.', 'Connector expansion owner.'],
  ['Ops / QA', 'Own trace inspection workflows, migration validation, and stale/error scenario coverage.', 'Trust and stability owner.'],
];

const DEFER_ROWS = [
  ['Coach raw-health deep tooling', 'Defer broad coach-facing raw health record access until snapshot projections and privacy rules are proven.', 'Do not expand sensitive surface area too early.'],
  ['Full multi-source parity', 'Do not wait for Oura and every future source to ship before cutting the first snapshot-backed runtime path.', 'Avoid perfectionism blocking the MVP.'],
  ['Overly rich operator UI', 'Start with enough rebuild and trace tooling to validate rollout, then grow the polish layer later.', 'Focus on core operability first.'],
  ['Exhaustive historical migration', 'Do not block the MVP on perfect conversion of all historical legacy data if recent windows are sufficient for first product value.', 'Prefer forward progress with bounded history goals.'],
];

const CUTOVER_ROWS = [
  ['Legacy reads remain allowed', 'Before Milestone 2 cutover only.', 'Temporary bridge period.'],
  ['Snapshot becomes runtime source of truth', 'At Milestone 2 for Nora health-backed flows.', 'First real architectural cutover.'],
  ['Legacy summary becomes migration input only', 'After snapshot runtime path is stable.', 'Prevents new consumer drift.'],
  ['Direct source adapters become value add, not schema creators', 'From Milestone 3 onward.', 'They plug into the existing system rather than redefining it.'],
];

const RISKS_ROWS = [
  ['Schema drift during implementation', 'Force implementation reviews against the contract docs and reject convenience fields that bypass the snapshot model.', 'Highest architectural risk.'],
  ['Cutover regressions in live chat', 'Roll out Nora snapshot reads behind a scoped feature flag or controlled pilot path.', 'Protects athlete experience.'],
  ['Migration confusion between legacy and canonical stores', 'Make legacy-vs-canonical source labeling explicit in traces and operator views.', 'Avoids debugging ambiguity.'],
  ['Connector reliability drag', 'Ship HealthKit before Oura and prove the orchestration / stale-state model on one native source first.', 'Controls complexity.'],
];

const SUCCESS_ROWS = [
  ['MVP success', 'PulseCheck health-backed chat can answer from a canonical snapshot path with clear source posture and without depending on legacy direct reads in the hot path.', 'Primary milestone outcome.'],
  ['Migration success', 'Legacy shared summary still contributes value, but new consumers stop coupling themselves to it directly.', 'Architectural health.'],
  ['Standalone success', 'An athlete without QuickLifts can still generate meaningful PulseCheck context through native HealthKit ingestion.', 'Standalone product promise.'],
  ['Expansion success', 'Adding Oura or future sources does not require consumer schema rewrites.', 'Future-proofing milestone.'],
];

const PulseCheckHealthContextImplementationRolloutPlanTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Health Context"
        title="Health Context Implementation Rollout Plan"
        version="Version 0.1 | March 17, 2026"
        summary="Execution-layer plan for delivering the PulseCheck health-context architecture as a real system. This document translates the contract stack into milestones, workstreams, ownership boundaries, cutover rules, defers, and success criteria so engineering can sequence the build without re-arguing the architecture midstream."
        highlights={[
          {
            title: 'MVP First',
            body: 'The first real win is a canonical snapshot path that already powers PulseCheck while preserving the current shared QuickLifts advantage.',
          },
          {
            title: 'Cut Over Deliberately',
            body: 'Nora and runtime consumers should move to snapshots at a defined milestone, not gradually drift there through mixed direct-read logic.',
          },
          {
            title: 'Native Sources Come After Contracted Runtime',
            body: 'PulseCheck-native HealthKit should arrive after the canonical runtime path exists, so it plugs into a stable system instead of becoming the system by accident.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Execution artifact for the health-context architecture. It defines milestone sequencing, MVP boundaries, workstreams, cutover rules, ownership, defer decisions, and success criteria across the migration from legacy shared summaries to canonical snapshot-backed runtime behavior."
        sourceOfTruth="This document is authoritative for implementation order, what counts as MVP, when runtime cutover should happen, which workstreams own which parts of the build, and which scope areas should intentionally wait until later phases."
        masterReference="Use this page when planning engineering execution, staffing, milestone reviews, migration readiness, or deciding whether a proposed task belongs in the first rollout wave or a later expansion phase."
        relatedDocs={[
          'Health Context Architecture',
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
          'Health Context Snapshot Assembler Spec',
          'Health Context Persistence & Storage Spec',
          'Health Context Operational Orchestration Spec',
          'Health Context Engineering Task Breakdown',
          'Health Context Firestore Schema & Index Spec',
        ]}
      />

      <SectionBlock icon={ShieldCheck} title="Rollout Principles">
        <CardGrid columns="md:grid-cols-3">
          {PRINCIPLE_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Brain} title="MVP Definition">
        <DataTable columns={['MVP Requirement', 'Meaning', 'Status / Role']} rows={MVP_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Milestone Sequence">
        <StepRail steps={MILESTONE_STEPS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Primary Workstreams">
        <DataTable columns={['Workstream', 'Scope', 'Owner']} rows={WORKSTREAM_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Ownership Boundaries">
        <DataTable columns={['Role', 'Responsibility', 'Why']} rows={OWNERSHIP_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Intentional Defers">
        <DataTable columns={['Deferred Area', 'Reason', 'Why']} rows={DEFER_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Cutover Rules">
        <DataTable columns={['Rule', 'When', 'Meaning']} rows={CUTOVER_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Runtime Cutover Rule"
            accent="green"
            body="Once Milestone 2 lands, new health-backed runtime work should build on the canonical snapshot path, not add more branches on top of legacy direct reads."
          />
          <InfoCard
            title="Migration Safety Rule"
            accent="red"
            body="Do not delete the legacy shared summary lane until operator tooling and traces clearly show that snapshot-backed runtime behavior is stable for the intended pilot scope."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Primary Risks And Mitigations">
        <DataTable columns={['Risk', 'Mitigation', 'Why']} rows={RISKS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Success Criteria">
        <DataTable columns={['Success Condition', 'Meaning', 'Role']} rows={SUCCESS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Execution Guardrails">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Scope Discipline"
            accent="blue"
            body={<BulletList items={['Do not start Oura before HealthKit proves the native-source path.', 'Do not widen coach visibility before snapshot projections are ready.', 'Do not expand the runtime contract during active milestone delivery without explicit review.']} />}
          />
          <InfoCard
            title="Migration Discipline"
            accent="green"
            body={<BulletList items={['Use the legacy summary as a bridge, not a forever dependency.', 'Label migration-origin data clearly in traces.', 'Move consumers to snapshots before growing source count.']} />}
          />
          <InfoCard
            title="Runtime Discipline"
            accent="amber"
            body={<BulletList items={['Keep Nora on one source of truth per milestone.', 'Branch on source posture and freshness explicitly.', 'Treat stale/error states as real product states, not invisible backend details.']} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckHealthContextImplementationRolloutPlanTab;
