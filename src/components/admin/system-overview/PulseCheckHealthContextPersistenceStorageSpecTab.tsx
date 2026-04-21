import React from 'react';
import { AlertTriangle, Database, ShieldCheck, Workflow } from 'lucide-react';
import { CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const PRINCIPLE_CARDS = [
  {
    title: 'Canonical Storage Follows Canonical Contracts',
    accent: 'red' as const,
    body: 'Storage should mirror the source-record, snapshot, and assembler contracts directly. Do not create storage shortcuts that reintroduce ad hoc shapes underneath the new architecture.',
  },
  {
    title: 'Revisioned And Audit-Friendly',
    accent: 'blue' as const,
    body: 'Source records, snapshots, and traces should be stored in a way that preserves revision history, supports deterministic rebuilds, and allows targeted inspection by athlete and date.',
  },
  {
    title: 'Migrate Without Breaking Current Reads',
    accent: 'green' as const,
    body: 'The existing `daily-health-summaries` collection can remain a live upstream input during migration, but new consumers should move toward the canonical snapshot store rather than adding more direct dependencies.',
  },
];

const COLLECTION_ROWS = [
  ['`health-context-source-records`', 'Normalized adapter-written source records across Fit With Pulse, Macra, HealthKit, Oura, Apple-origin metadata, and Pulse Check self-report.', 'Primary input store.'],
  ['`health-context-snapshots`', 'Canonical assembled `AthleteHealthContextSnapshot` revisions for daily and rolling windows.', 'Primary consumer store.'],
  ['`health-context-assembly-traces`', 'Trace documents describing winner selection, dropped records, trigger reason, and contract versions.', 'Observability and QA store.'],
  ['`health-context-source-status`', 'Per-athlete source connection, permission, sync, and error posture.', 'Runtime and ingestion coordination store.'],
  ['`health-context-jobs`', 'Optional job / rebuild queue records for async assembly and backfill operations.', 'Operational control store.'],
  ['`daily-health-summaries`', 'Legacy shared summary collection currently written primarily by the Fit With Pulse / QuickLifts lineage.', 'Migration input lane, not future canonical output.'],
];

const ID_ROWS = [
  ['Source record id', '`{athleteUserId}_{sourceFamily}_{sourceType}_{dedupeHash}`', 'Deterministic and replay-safe.'],
  ['Snapshot id', '`{athleteUserId}_{snapshotType}_{snapshotDateKey}`', 'Stable lookup key for latest active revision pointer.'],
  ['Snapshot revision id', '`{snapshotId}_{revision}`', 'Immutable revision identifier.'],
  ['Assembly trace id', '`{snapshotRevisionId}_{traceSequence}`', 'One or more traces per assembled revision if needed.'],
  ['Source status id', '`{athleteUserId}_{sourceFamily}`', 'One status doc per athlete per source family.'],
  ['Job id', '`{jobType}_{athleteUserId}_{timestampOrNonce}`', 'Operational uniqueness over deterministic identity.'],
];

const RECORD_STORE_ROWS = [
  ['Write model', 'Upsert by deterministic id or dedupe key; mark superseded / deleted state via status rather than destructive overwrite where meaning changed.', 'Required.'],
  ['Partition strategy', 'Index by athlete, domain, sourceFamily, observedAt, and status for assembler-friendly queries.', 'Required.'],
  ['Payload storage', 'Store canonical payload plus source metadata and provenance in the same document.', 'Required.'],
  ['Retention', 'Keep active records within the main collection and archive or export older superseded records only through a deliberate retention policy.', 'Recommended.'],
  ['Raw references', 'Store upstream raw ids or pointer fields where available, but do not force consumers to parse raw vendor payloads.', 'Recommended.'],
];

const SNAPSHOT_STORE_ROWS = [
  ['Latest pointer pattern', 'Maintain a stable snapshot doc for the latest revision and a revision subcollection or companion docs for immutable history.', 'Recommended pattern.'],
  ['Snapshot body', 'Store the full canonical `AthleteHealthContextSnapshot`, contract versions, generatedAt, source window, freshness summary, and provenance.', 'Required.'],
  ['Revision body', 'Store immutable assembled payload plus revision metadata and assembly trigger summary.', 'Required for auditability.'],
  ['Consumer read path', 'Consumers should read the latest active snapshot for runtime use and optionally reference revision ids for audit.', 'Required consumer rule.'],
  ['Backfill behavior', 'Backfills should create new revisions, not rewrite historical meaning in place without traceability.', 'Required.'],
];

const TRACE_STORE_ROWS = [
  ['Trace linkage', 'Every trace should reference the snapshot id, snapshot revision id, athlete id, and trigger reason.', 'Required.'],
  ['Selection trace', 'Persist selected and dropped source-record ids plus per-domain winner explanations.', 'Required.'],
  ['Version trace', 'Store source-record spec version, snapshot spec version, assembler spec version, and assembly config version.', 'Required.'],
  ['Diff trace', 'Optionally store what changed vs the prior revision to support smarter invalidation and QA.', 'Recommended.'],
];

const STATUS_ROWS = [
  ['Connection posture', 'Track linked, not linked, permission denied, waiting for data, synced, stale, and error posture per source family.', 'Required.'],
  ['Last success markers', 'Store last successful sync and last observed record timestamps per source family.', 'Required.'],
  ['Error posture', 'Store last error code, error category, and last attempted sync time for operator visibility.', 'Recommended.'],
  ['Consent posture', 'Record consent and permission timestamps for high-sensitivity source families.', 'Recommended.'],
];

const MIGRATION_ROWS = [
  {
    title: 'Preserve Current Shared Summary Lane',
    body: 'Keep `daily-health-summaries` live as an upstream shared-data lane while the new storage model is introduced.',
    owner: 'Migration phase 1',
  },
  {
    title: 'Introduce Canonical Collections',
    body: 'Begin writing source records, snapshots, traces, and source-status documents into the new canonical health-context collections without cutting over consumers immediately.',
    owner: 'Migration phase 2',
  },
  {
    title: 'Adapterize Legacy Summary Input',
    body: 'Represent the legacy `daily-health-summaries` data as `summary_input` source records or assembler-fed source lane rather than treating it as the runtime contract itself.',
    owner: 'Migration phase 3',
  },
  {
    title: 'Cut Consumers To Snapshot Store',
    body: 'Move Nora, proactive insights, and future coach surfaces to `health-context-snapshots` so user-facing logic stops depending on legacy direct reads.',
    owner: 'Migration phase 4',
  },
  {
    title: 'Reduce Legacy Contract Dependence',
    body: 'Once new adapters and assembler outputs are stable, treat `daily-health-summaries` as optional upstream compatibility data instead of the core system contract.',
    owner: 'Migration phase 5',
  },
];

const QUERY_ROWS = [
  ['Assembler query pattern', 'Fetch source records by athlete, time window, domain, source family, and active status.', 'Primary hot path.'],
  ['Runtime snapshot query pattern', 'Fetch latest active daily snapshot and relevant rolling snapshots by athlete and date key.', 'Primary consumer path.'],
  ['Trace inspection query pattern', 'Fetch trace by snapshot revision id or athlete/date window for QA and debugging.', 'Operator path.'],
  ['Source-status query pattern', 'Fetch all source-family status docs for an athlete during readiness and onboarding flows.', 'Runtime and setup path.'],
];

const SECURITY_ROWS = [
  ['Minimum necessary reads', 'Coach and athlete surfaces should read filtered consumer-safe snapshot views, not raw source records or traces by default.', 'Required privacy boundary.'],
  ['Raw record access', 'Restrict raw source-record and assembly-trace access to trusted operator, admin, or tightly scoped backend roles.', 'Required.'],
  ['Cross-user guardrails', 'Do not expose one athlete’s raw source records to another user or coach without explicit role-based authorization.', 'Required.'],
  ['Backend mediation', 'Prefer mediated or role-aware reads for sensitive health-context collections as the system matures.', 'Recommended long-term posture.'],
];

const BUILD_ORDER_ROWS = [
  ['1. Create canonical collection map', 'Lock collection names, id patterns, and latest-vs-revision storage shape.', 'Needed before implementation begins.'],
  ['2. Build source-status store', 'Track readiness and connector posture before full adapter rollout.', 'Unblocks runtime branching and setup UX.'],
  ['3. Stand up source-record and snapshot stores', 'Create the main canonical stores and indexes.', 'Foundation for adapters and assembler.'],
  ['4. Add trace persistence and rebuild jobs', 'Enable auditability and operational rebuild tooling.', 'Critical for safe rollout.'],
  ['5. Migrate consumer reads', 'Point runtime consumers at snapshot storage, not legacy summary collections.', 'Completes architecture transition.'],
];

const PulseCheckHealthContextPersistenceStorageSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Health Context"
        title="Health Context Persistence & Storage Spec"
        version="Version 0.1 | March 17, 2026"
        summary="Canonical storage-model spec for the health-context system, covering where normalized source records, assembled snapshots, source-status posture, assembly traces, and migration bridge data should live. This document turns the contract stack into an implementation-ready persistence model."
        highlights={[
          {
            title: 'Concrete Collection Map',
            body: 'Defines the canonical collections and ids for source records, snapshots, traces, source status, and rebuild jobs.',
          },
          {
            title: 'Revision-Safe Storage',
            body: 'Preserves immutable snapshot revisions and traceable source-record changes rather than silently mutating system meaning in place.',
          },
          {
            title: 'Migration-Friendly',
            body: 'Explains how to keep the current shared `daily-health-summaries` lane alive while moving runtime consumers to the canonical health-context stores.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Storage-model artifact for the health-context architecture. It defines collection boundaries, id schemes, revision persistence, trace storage, source-status storage, query patterns, and the migration path from the current shared summary collection."
        sourceOfTruth="This document is authoritative for Firestore collection structure, storage responsibilities, revision strategy, security boundaries, and the migration relationship between legacy `daily-health-summaries` and the new canonical health-context stores."
        masterReference="Use this page before implementing Firestore models, indexes, migration tooling, source-status tracking, snapshot persistence, trace storage, or rebuild-job orchestration for Pulse Check health context."
        relatedDocs={[
          'Health Context Architecture',
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
          'Health Context Snapshot Assembler Spec',
          'Health Context Operational Orchestration Spec',
          'Health Context Implementation Rollout Plan',
          'Health Context Firestore Schema & Index Spec',
          'Permissions & Visibility Model',
        ]}
      />

      <SectionBlock icon={ShieldCheck} title="Storage Principles">
        <CardGrid columns="md:grid-cols-3">
          {PRINCIPLE_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Canonical Collections">
        <DataTable columns={['Collection', 'Purpose', 'Role']} rows={COLLECTION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Document Identity">
        <DataTable columns={['Artifact', 'Id Pattern', 'Rule']} rows={ID_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Source Record Store Rules">
        <DataTable columns={['Rule', 'Meaning', 'Why']} rows={RECORD_STORE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Snapshot Store Rules">
        <DataTable columns={['Rule', 'Meaning', 'Why']} rows={SNAPSHOT_STORE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Trace Store Rules">
        <DataTable columns={['Rule', 'Meaning', 'Why']} rows={TRACE_STORE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Source Status Store Rules">
        <DataTable columns={['Rule', 'Meaning', 'Why']} rows={STATUS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Migration Path">
        <StepRail steps={MIGRATION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Primary Query Patterns">
        <DataTable columns={['Query', 'Pattern', 'Role']} rows={QUERY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Security & Access Boundaries">
        <DataTable columns={['Boundary', 'Rule', 'Why']} rows={SECURITY_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Runtime Read Rule"
            accent="green"
            body="Athlete-facing and coach-facing product surfaces should read canonical snapshots or filtered projections, not raw source-record documents."
          />
          <InfoCard
            title="Operator Read Rule"
            accent="red"
            body="Raw source records and assembly traces are debugging and operational artifacts. Keep them behind trusted roles and avoid broad client exposure."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Implementation Build Order">
        <DataTable columns={['Step', 'Scope', 'Why']} rows={BUILD_ORDER_ROWS} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckHealthContextPersistenceStorageSpecTab;
