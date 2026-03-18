import React from 'react';
import { Activity, AlertTriangle, Database, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const READINESS_ROWS = [
  ['Canonical collections populated', 'Confirm `health-context-source-records`, `health-context-snapshots`, `health-context-snapshot-revisions`, and `health-context-assembly-traces` exist for the target environment.', 'Without this, runtime cutover cannot be trusted.'],
  ['Bridge lane producing data', 'Verify legacy `daily-health-summaries` are being bridged into canonical artifacts.', 'Required for QuickLifts-backed athletes.'],
  ['Runtime reads using snapshots', 'Confirm PulseCheck runtime surfaces read canonical snapshots first and only use legacy fallback when appropriate.', 'Prevents hidden regression to the old path.'],
  ['Readiness / freshness honest', 'Check that health-backed outputs branch correctly for ready, no-permission, no-data, and stale states.', 'Required for trustworthy athlete-facing behavior.'],
  ['Parity validation green', 'Confirm canonical-vs-legacy comparisons show no mismatches on scoped fields before broad rollout.', 'Protects migration correctness.'],
];

const SURFACE_ROWS = [
  ['Firestore collections', '`health-context-*` collections in dev and prod', 'Primary operator truth for whether the canonical pipeline is populated.'],
  ['Backfill utility', '`QuickLifts-Web/scripts/backfillHealthContext.js`', 'Seeds canonical artifacts from legacy summaries for migration and repair.'],
  ['Validation mock utility', '`QuickLifts-Web/scripts/seedHealthContextValidationMocks.js`', 'Creates representative dev scenarios for parity and freshness testing.'],
  ['PulseCheck parity command', '`/healthparity` in debug Nora chat', 'Fast athlete-level comparison of canonical vs legacy runtime output.'],
  ['Test harnesses', '`PulseCheckTests` and focused `QuickLiftsTests` health-context cases', 'Verification layer for bridge, freshness, and runtime cutover behavior.'],
];

const COMMAND_ROWS = [
  ['Backfill dev', '`node scripts/backfillHealthContext.js --project=quicklifts-dev-01`', 'Seed canonical collections in development from legacy summaries.'],
  ['Backfill one athlete', '`node scripts/backfillHealthContext.js --project=<project> --user-id=<uid>`', 'Target a specific athlete for migration validation or repair.'],
  ['Seed validation mocks', '`node scripts/seedHealthContextValidationMocks.js --project=quicklifts-dev-01`', 'Create controlled dev scenarios inspired by live shapes.'],
  ['PulseCheck harness', '`xcodebuild test ... -only-testing:PulseCheckTests`', 'Validate runtime resolver and chat/runtime health behavior.'],
  ['QuickLifts harness', '`xcodebuild test ... -only-testing:QuickLiftsTests/testHealthContextBridgeDoesNotTreatZeroValuedMetricsAsFreshData`', 'Validate bridge freshness logic stays honest.'],
];

const CUTOVER_STEPS = [
  {
    title: 'Check collection population',
    owner: 'Platform / ops',
    body: 'Start by verifying canonical collection counts against legacy `daily-health-summaries` in the target environment. Missing snapshots mean runtime parity checks are not yet meaningful.',
  },
  {
    title: 'Run athlete-level parity',
    owner: 'PulseCheck iOS / QA',
    body: 'Use the debug `/healthparity` path on representative bridge-backed athletes and confirm canonical and legacy summaries align on the scoped fields before widening rollout.',
  },
  {
    title: 'Confirm freshness honesty',
    owner: 'PulseCheck iOS / QA',
    body: 'Validate fresh, stale, no-data, and no-permission scenarios so the runtime does not present sparse or contextual data as if it were current and complete.',
  },
  {
    title: 'Verify harness coverage',
    owner: 'Platform / iOS',
    body: 'Keep the focused PulseCheck and QuickLifts health-context tests green before considering the migration slice stable.',
  },
  {
    title: 'Only then widen rollout',
    owner: 'Product / engineering',
    body: 'Broaden consumer surfaces only after population, parity, honesty, and harness checks are all green.',
  },
];

const CURRENT_POSTURE_CARDS = [
  {
    title: 'Production Backfill',
    accent: 'green' as const,
    body: 'Production canonical health-context collections have been backfilled to parity with the current legacy day count for the migration baseline.',
  },
  {
    title: 'Runtime Verification',
    accent: 'blue' as const,
    body: 'Focused PulseCheck runtime cutover harness coverage exists and should be used as the primary engineering gate before additional surface rollout.',
  },
  {
    title: 'Known Remaining Risk',
    accent: 'amber' as const,
    body: 'Generic Nora personalization and proactive stale/contextual messaging still need honesty cleanup even though the core runtime cutover is in place.',
  },
];

const OPERATOR_RULES = [
  'Do not use raw collection counts alone as proof of correctness. Pair them with parity and readiness validation.',
  'Treat backfill as idempotent migration tooling, not as a substitute for the live bridge writer staying healthy.',
  'If parity fails, inspect canonical snapshots and traces before changing runtime logic.',
  'If a health-backed surface speaks about “today” or “last night,” verify freshness state is being carried through that path.',
  'Do not broaden rollout while debug validation is the only path proving honesty on a surface with athlete-facing claims.',
];

const PulseCheckHealthContextOperatorRunbookTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Health Context"
        title="Health Context Operator Runbook"
        version="Version 0.1 | March 17, 2026"
        summary="Operator-facing validation and migration runbook for the health-context pipeline. This page translates the current bridge, snapshot, parity, and harness tooling into a repeatable internal operating surface so the team is not relying on debug-only tribal knowledge."
        highlights={[
          {
            title: 'Operator-Facing',
            body: 'Turns the current scripts, parity checks, and collection inspection steps into a reusable internal runbook.',
          },
          {
            title: 'Migration-Aware',
            body: 'Focuses on the bridge-to-canonical cutover, which is where silent drift and false confidence are most likely.',
          },
          {
            title: 'Honesty-Centered',
            body: 'Treats readiness and freshness validation as operator requirements, not just implementation details.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Operational handbook artifact for validating the health-context pipeline across backfill, bridge production, runtime cutover, and freshness honesty. It is meant for engineers, QA, and internal operators who need to validate whether the pipeline is actually trustworthy."
        sourceOfTruth="This page is subordinate to the actual code, canonical Firestore collections, focused test harnesses, and migration scripts. Its job is to make those validation lanes operationally explicit."
        masterReference="Use this page when validating a rollout wave, diagnosing missing canonical data, confirming parity after backfill, or checking whether a health-backed surface is ready to be widened beyond the current scope."
        relatedDocs={[
          'Health Context Operational Orchestration Spec',
          'Health Context Implementation Rollout Plan',
          'Health Context Engineering Task Breakdown',
          'Health Context Firestore Schema & Index Spec',
        ]}
      />

      <SectionBlock icon={Activity} title="Current Operator Posture">
        <CardGrid columns="md:grid-cols-3">
          {CURRENT_POSTURE_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Readiness Checklist">
        <DataTable columns={['Checkpoint', 'What To Confirm', 'Why']} rows={READINESS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Operator Validation Surfaces">
        <DataTable columns={['Surface', 'Location', 'Role']} rows={SURFACE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Primary Operator Commands">
        <DataTable columns={['Action', 'Command', 'Use']} rows={COMMAND_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Recommended Cutover Sequence">
        <StepRail steps={CUTOVER_STEPS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Operator Guardrails">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Runbook Rules" accent="red" body={<BulletList items={OPERATOR_RULES} />} />
          <InfoCard
            title="What This Does Not Replace"
            accent="blue"
            body={<BulletList items={['It does not replace canonical collection inspection.', 'It does not replace focused iOS test harnesses.', 'It does not replace athlete-level parity checks on real data.', 'It does not turn stale/contextual messaging into an acceptable rollout state.']} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckHealthContextOperatorRunbookTab;
