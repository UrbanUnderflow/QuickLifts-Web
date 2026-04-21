import React from 'react';
import { AlertTriangle, Brain, Database, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const STREAM_ROWS = [
  ['Architecture lock', 'Close any remaining naming, enum, field, or ownership ambiguity before implementation starts.', 'Product / architecture', 'Immediate'],
  ['Platform foundation', 'Create canonical stores, ids, traces, source-status model, and assembler scaffolding.', 'Platform', 'Immediate'],
  ['Bridge migration', 'Map current Fit With Pulse shared summaries into the canonical pipeline.', 'Fit With Pulse iOS + platform', 'Immediate'],
  ['Pulse Check runtime cutover', 'Move health-backed runtime logic to canonical snapshot reads.', 'Pulse Check iOS', 'Near-term'],
  ['Native HealthKit ingestion', 'Build Pulse Check-native source adapter targeting source records.', 'Pulse Check iOS', 'After snapshot cutover'],
  ['Connector expansion', 'Add Oura adapter and connector-specific operational handling.', 'Platform + integrations', 'Later'],
  ['Ops + QA', 'Build trace tooling, rebuild controls, validation suites, and migration verification.', 'Ops / QA / platform', 'Continuous'],
];

const M0_ROWS = [
  ['Review every health-context artifact for naming consistency', 'Confirm field names, enums, and source family labels are identical across docs.', 'Product / architecture', 'Required before coding.'],
  ['Freeze contract version 1', 'Mark the current spec stack as the implementation baseline for Milestone 1.', 'Product / architecture', 'Prevents drift.'],
  ['Write implementation acceptance checklist', 'Define what “Milestone 1 complete” means for platform and runtime.', 'Product / architecture', 'Needed for handoff.'],
];

const M1_ROWS = [
  ['Create Firestore collections and security placeholders', 'Stand up canonical collections from the persistence spec.', 'Platform', 'Foundation task.'],
  ['Implement source-status store', 'Persist source lifecycle posture, last success, and stale/error state.', 'Platform', 'Needed for runtime branching.'],
  ['Implement snapshot store and revision pattern', 'Create latest snapshot docs plus revision docs / trace linkage.', 'Platform', 'Foundation task.'],
  ['Build assembler skeleton', 'Create deterministic assembly service with trace output contract even if first input lane is limited.', 'Platform', 'Core system task.'],
  ['Build legacy summary bridge lane', 'Convert `daily-health-summaries` into canonical input for the assembler.', 'Fit With Pulse iOS + platform', 'MVP-critical bridge.'],
  ['Persist first assembled daily snapshot', 'Generate a canonical daily snapshot from the bridge lane.', 'Platform', 'MVP checkpoint.'],
  ['Add trace inspection basics', 'Provide enough trace visibility to validate winner selection and migration behavior.', 'Platform + ops', 'Required for trust.'],
];

const M2_ROWS = [
  ['Audit current Pulse Check health read paths', 'Identify all direct summary reads and legacy branching in chat and insights.', 'Pulse Check iOS', 'Cutover preparation.'],
  ['Implement snapshot-backed health context resolver', 'Create one runtime resolver that reads canonical snapshots plus source posture.', 'Pulse Check iOS', 'Core cutover task.'],
  ['Replace legacy health-chat reads in Nora paths', 'Move health-backed chat to snapshot reads and explicit freshness / posture branching.', 'Pulse Check iOS', 'MVP user-facing cutover.'],
  ['Add feature flag or rollout control', 'Support a scoped pilot or controlled release for snapshot-backed runtime.', 'Pulse Check iOS + product', 'Risk mitigation.'],
  ['Validate parity against current live behavior', 'Ensure shared Fit With Pulse context is still visible after cutover.', 'QA + Pulse Check iOS', 'Regression protection.'],
];

const M3_ROWS = [
  ['Implement HealthKit source adapter contract', 'Write normalized `HealthContextSourceRecord` items from Pulse Check-native HealthKit access.', 'Pulse Check iOS', 'First standalone source.'],
  ['Wire event-driven recompute from native records', 'When a new HealthKit record lands, rebuild affected snapshots.', 'Platform + Pulse Check iOS', 'Freshness path.'],
  ['Update onboarding and permissions UX', 'Expose source connection, waiting, synced, stale, and denied states clearly.', 'Pulse Check iOS', 'Runtime polish and honesty.'],
  ['Validate standalone-athlete path', 'Confirm Pulse Check can produce meaningful context without Fit With Pulse usage.', 'QA + Pulse Check iOS', 'Standalone milestone.'],
];

const M4_ROWS = [
  ['Design Oura auth and sync adapter', 'Implement Oura connector around the existing source-record contract.', 'Platform + integrations', 'Connector expansion.'],
  ['Add historical backfill flows', 'Backfill rolling windows and older readiness context without hurting hot-path freshness.', 'Platform', 'Trend quality.'],
  ['Expand stale-source recovery flows', 'Handle long gaps, reauth needs, and connector-specific recovery behavior.', 'Platform + ops', 'Operational resilience.'],
];

const M5_ROWS = [
  ['Expose snapshot projections to dashboards', 'Let non-chat surfaces consume canonical context safely.', 'Web + platform', 'Consumer expansion.'],
  ['Add coach-facing filtered context views', 'Use privacy-aware projections, not raw health records.', 'Web + product + platform', 'Sensitive-surface milestone.'],
  ['Expand operator tooling', 'Build athlete/date/source rebuild controls, richer traces, and migration dashboards.', 'Ops + platform', 'Scale milestone.'],
];

const FILE_ROWS = [
  ['Fit With Pulse iOS shared-summary writer', 'Bridge and eventually adapt the current `daily-health-summaries` output lane into canonical source input.', 'Fit With Pulse iOS', 'Current upstream dependency.'],
  ['Pulse Check iOS health runtime', 'Replace legacy direct-read paths with snapshot-backed resolver usage.', 'Pulse Check iOS', 'Primary runtime change area.'],
  ['Platform storage and assembler layer', 'Own new Firestore shape, revision logic, traces, and recompute orchestration.', 'Platform', 'Shared system core.'],
  ['Web / admin handbook and operator tooling', 'Expose traces, statuses, rebuild controls, and internal docs.', 'Web + ops', 'Operational enablement.'],
];

const QA_ROWS = [
  ['Bridge-only athlete', 'Athlete uses Fit With Pulse data only, no native Pulse Check HealthKit yet.', 'Must remain strong through Milestone 2.'],
  ['Standalone native athlete', 'Athlete never uses Fit With Pulse and only connects Pulse Check-native HealthKit.', 'Critical for Milestone 3.'],
  ['Stale-source athlete', 'Source connected but no recent data.', 'Runtime should branch honestly.'],
  ['Permission-denied athlete', 'User denied connector access.', 'Runtime should not imply missing sync is temporary.'],
  ['Migration mixed athlete', 'Legacy summary lane plus native records both present.', 'Trace visibility and merge correctness required.'],
];

const HANDOFF_CARDS = [
  {
    title: 'Milestone 1 Exit',
    accent: 'green' as const,
    body: 'Canonical daily snapshot exists, trace exists, source-status exists, and the bridge lane from current shared summaries is functioning.',
  },
  {
    title: 'Milestone 2 Exit',
    accent: 'blue' as const,
    body: 'PulseCheck health-backed runtime reads snapshots instead of legacy direct summaries for the scoped rollout path.',
  },
  {
    title: 'Milestone 3 Exit',
    accent: 'amber' as const,
    body: 'Pulse Check can generate useful standalone context from native HealthKit records even when the athlete does not use Fit With Pulse.',
  },
];

const PulseCheckHealthContextEngineeringTaskBreakdownTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Health Context"
        title="Health Context Engineering Task Breakdown"
        version="Version 0.1 | March 17, 2026"
        summary="Execution-facing breakdown of the health-context rollout into concrete engineering workstreams, milestone tasks, ownership, and validation scenarios. This artifact translates the rollout plan into implementable chunks so teams can start work without re-synthesizing the architecture."
        highlights={[
          {
            title: 'Milestone-Oriented',
            body: 'Tasks are grouped by the rollout milestones so engineering can move in the intended sequence rather than cherry-picking isolated implementation pieces.',
          },
          {
            title: 'Owner-Aware',
            body: 'Each task is mapped to the team most likely to own it, which helps avoid duplication and handoff ambiguity.',
          },
          {
            title: 'Validation-Included',
            body: 'The artifact includes the major athlete scenarios that must be validated as we move from bridge mode into native-source mode.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Execution artifact for engineering decomposition of the health-context rollout. It converts the milestone plan into concrete task groups, owner boundaries, and validation expectations across platform, QuickLifts, PulseCheck, and ops."
        sourceOfTruth="This document is authoritative for how the health-context rollout should be decomposed into engineering workstreams and milestone tasks. It should be used to seed tickets, estimate work, and assign owners."
        masterReference="Use this page when creating tickets, assigning milestone ownership, or checking whether a proposed implementation task belongs in the current rollout wave or a later expansion phase."
        relatedDocs={[
          'Health Context Implementation Rollout Plan',
          'Health Context Persistence & Storage Spec',
          'Health Context Snapshot Assembler Spec',
          'Health Context Operational Orchestration Spec',
        ]}
      />

      <SectionBlock icon={Brain} title="Primary Streams">
        <DataTable columns={['Workstream', 'Scope', 'Owner', 'Timing']} rows={STREAM_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Milestone 0 Tasks">
        <DataTable columns={['Task', 'Meaning', 'Owner', 'Why']} rows={M0_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Milestone 1 Tasks">
        <DataTable columns={['Task', 'Meaning', 'Owner', 'Why']} rows={M1_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Milestone 2 Tasks">
        <DataTable columns={['Task', 'Meaning', 'Owner', 'Why']} rows={M2_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Milestone 3 Tasks">
        <DataTable columns={['Task', 'Meaning', 'Owner', 'Why']} rows={M3_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Later Milestones">
        <DataTable columns={['Task', 'Meaning', 'Owner', 'Why']} rows={[...M4_ROWS, ...M5_ROWS]} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Likely File / Module Ownership">
        <DataTable columns={['Area', 'Expected Responsibility', 'Owner', 'Why']} rows={FILE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="QA Scenarios">
        <DataTable columns={['Scenario', 'Meaning', 'Priority']} rows={QA_ROWS} />
        <CardGrid columns="md:grid-cols-3">
          {HANDOFF_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Execution Guardrails">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Platform Guardrail"
            accent="red"
            body={<BulletList items={['Do not let Firestore implementation drift from the storage spec.', 'Do not let the assembler become a hidden business-logic fork.', 'Treat traces as required, not optional polish.']} />}
          />
          <InfoCard
            title="PulseCheck Guardrail"
            accent="blue"
            body={<BulletList items={['Do not add more legacy direct-read branches once Milestone 2 begins.', 'Use one snapshot-backed resolver in runtime.', 'Make source posture visible in UX.']} />}
          />
          <InfoCard
            title="Migration Guardrail"
            accent="green"
            body={<BulletList items={['Keep the bridge lane until snapshot-backed runtime is stable.', 'Label bridge-origin data in traces.', 'Do not confuse migration convenience with long-term contract design.']} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckHealthContextEngineeringTaskBreakdownTab;
