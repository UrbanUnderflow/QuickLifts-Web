import React from 'react';
import { AlertTriangle, Database, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const COLLECTION_ROWS = [
  ['`health-context-source-records`', 'Canonical normalized source-record documents.', 'Primary adapter write collection.'],
  ['`health-context-snapshots`', 'Latest active snapshot documents by athlete/date/window.', 'Primary runtime read collection.'],
  ['`health-context-snapshot-revisions`', 'Immutable snapshot revision documents.', 'Audit and rebuild reference collection.'],
  ['`health-context-assembly-traces`', 'Trace docs linked to snapshot revisions.', 'Debugging and operator collection.'],
  ['`health-context-source-status`', 'Per-athlete per-source-family lifecycle and sync posture.', 'Connector-state collection.'],
  ['`health-context-jobs`', 'Queued / running / finished orchestration jobs.', 'Operational queue metadata.'],
];

const SOURCE_RECORD_FIELDS = [
  ['id', 'string', 'Deterministic source-record id.', 'Required'],
  ['athleteUserId', 'string', 'Athlete uid.', 'Required'],
  ['sourceFamily', 'string', 'Examples: `quicklifts`, `healthkit`, `oura`, `pulsecheck_self_report`.', 'Required'],
  ['sourceType', 'string', 'Concrete adapter feed, such as `healthkit_sleep_session`.', 'Required'],
  ['recordType', 'string', 'Examples: `measurement`, `session`, `journal_entry`, `checkin`, `summary_input`.', 'Required'],
  ['domain', 'string', 'Examples: `training`, `recovery`, `activity`, `nutrition`, `behavioral`, `biometrics`.', 'Required'],
  ['observedAt', 'timestamp or epoch', 'Time of measurement / event.', 'Required'],
  ['observedWindowStart', 'timestamp or epoch', 'Interval start for session records.', 'Optional'],
  ['observedWindowEnd', 'timestamp or epoch', 'Interval end for session records.', 'Optional'],
  ['ingestedAt', 'timestamp or epoch', 'Write time into canonical store.', 'Required'],
  ['timezone', 'string', 'Athlete-local timezone.', 'Required'],
  ['status', 'string', 'Examples: `active`, `superseded`, `deleted`, `errored`.', 'Required'],
  ['dedupeKey', 'string', 'Replay-safe dedupe / upsert key.', 'Required'],
  ['payloadVersion', 'string', 'Payload schema version.', 'Required'],
  ['payload', 'map', 'Canonical normalized payload.', 'Required'],
  ['sourceMetadata', 'map', 'Upstream ids, device info, adapter info.', 'Required'],
  ['provenance', 'map', 'Mode, confidence hints, raw references.', 'Required'],
];

const SNAPSHOT_FIELDS = [
  ['id', 'string', 'Stable snapshot id like `{athleteUserId}_{snapshotType}_{snapshotDateKey}`.', 'Required'],
  ['athleteUserId', 'string', 'Athlete uid.', 'Required'],
  ['snapshotType', 'string', 'Examples: `daily`, `rolling_7d`, `rolling_14d`, `rolling_30d`.', 'Required'],
  ['snapshotDateKey', 'string', 'Athlete-local key like `2026-03-17`.', 'Required'],
  ['activeRevisionId', 'string', 'Current winning immutable revision id.', 'Required'],
  ['generatedAt', 'timestamp or epoch', 'Latest assembly time.', 'Required'],
  ['contractVersions', 'map', 'Snapshot/spec/assembler version info.', 'Required'],
  ['sourceWindow', 'map', 'Start/end and window metadata.', 'Required'],
  ['permissions', 'map', 'Consent and permission posture.', 'Required'],
  ['sourceStatus', 'map', 'Per-source-family lifecycle posture.', 'Required'],
  ['freshness', 'map', 'Per-domain and overall freshness.', 'Required'],
  ['provenance', 'map', 'Domain winners, source list, summary mode.', 'Required'],
  ['domains', 'map', 'Identity, training, recovery, activity, nutrition, biometrics, behavioral, summary.', 'Required'],
  ['lastTriggerReason', 'string', 'What caused the latest assembly.', 'Recommended'],
];

const REVISION_FIELDS = [
  ['id', 'string', 'Immutable revision id.', 'Required'],
  ['snapshotId', 'string', 'Parent stable snapshot id.', 'Required'],
  ['revision', 'number or string', 'Monotonic revision marker.', 'Required'],
  ['generatedAt', 'timestamp or epoch', 'Assembly time for this immutable revision.', 'Required'],
  ['triggerReason', 'string', 'Why the revision was created.', 'Required'],
  ['payload', 'map', 'Full canonical immutable snapshot payload.', 'Required'],
  ['diffSummary', 'map', 'Optional changed-domain summary vs prior revision.', 'Recommended'],
];

const TRACE_FIELDS = [
  ['id', 'string', 'Trace id.', 'Required'],
  ['athleteUserId', 'string', 'Athlete uid.', 'Required'],
  ['snapshotId', 'string', 'Stable snapshot id.', 'Required'],
  ['snapshotRevisionId', 'string', 'Linked immutable revision id.', 'Required'],
  ['triggerReason', 'string', 'Recompute trigger.', 'Required'],
  ['selectedRecordIds', 'array<string>', 'Winning source-record ids.', 'Required'],
  ['droppedRecordIds', 'array<string>', 'Records considered but not selected.', 'Recommended'],
  ['dropReasons', 'map', 'Record id to drop reason mapping.', 'Recommended'],
  ['domainWinnerSummary', 'map', 'Per-domain winner explanation.', 'Required'],
  ['contractVersions', 'map', 'Source-record / snapshot / assembler versions.', 'Required'],
];

const STATUS_FIELDS = [
  ['id', 'string', 'Example `{athleteUserId}_{sourceFamily}`.', 'Required'],
  ['athleteUserId', 'string', 'Athlete uid.', 'Required'],
  ['sourceFamily', 'string', 'Connected source family.', 'Required'],
  ['lifecycleState', 'string', 'Examples: `not_connected`, `connecting`, `connected_synced`, `connected_stale`, `error`.', 'Required'],
  ['lastAttemptedSyncAt', 'timestamp or epoch', 'Most recent sync attempt.', 'Recommended'],
  ['lastSuccessfulSyncAt', 'timestamp or epoch', 'Most recent successful sync.', 'Recommended'],
  ['lastObservedRecordAt', 'timestamp or epoch', 'Most recent canonical record from this source.', 'Recommended'],
  ['lastErrorCode', 'string', 'Last connector/system error code.', 'Optional'],
  ['lastErrorCategory', 'string', 'Last error category.', 'Optional'],
  ['consentMetadata', 'map', 'Permission or consent posture.', 'Recommended'],
];

const JOB_FIELDS = [
  ['id', 'string', 'Operational job id.', 'Required'],
  ['jobType', 'string', 'Examples: `initial_sync`, `incremental_sync`, `backfill`, `assembler_recompute`, `stale_recovery`, `migration_replay`.', 'Required'],
  ['athleteUserId', 'string', 'Target athlete.', 'Required'],
  ['sourceFamily', 'string', 'Optional source family if connector-scoped.', 'Optional'],
  ['targetDateKey', 'string', 'Optional date scope.', 'Optional'],
  ['status', 'string', 'Examples: `queued`, `running`, `succeeded`, `failed`, `suppressed`.', 'Required'],
  ['attemptCount', 'number', 'Retry count.', 'Required'],
  ['scheduledAt', 'timestamp or epoch', 'When it should run.', 'Required'],
  ['startedAt', 'timestamp or epoch', 'When it started.', 'Optional'],
  ['completedAt', 'timestamp or epoch', 'When it completed.', 'Optional'],
  ['errorSummary', 'map', 'Last failure info if failed.', 'Optional'],
];

const INDEX_ROWS = [
  ['`health-context-source-records`', '`athleteUserId ASC, status ASC, observedAt DESC`', 'Assembler hot path for recent records.'],
  ['`health-context-source-records`', '`athleteUserId ASC, domain ASC, status ASC, observedAt DESC`', 'Domain-scoped assembly and debugging.'],
  ['`health-context-source-records`', '`athleteUserId ASC, sourceFamily ASC, status ASC, observedAt DESC`', 'Source-family scoped assembly and stale checks.'],
  ['`health-context-source-records`', '`dedupeKey ASC`', 'Idempotent lookup / replay safety.'],
  ['`health-context-snapshots`', '`athleteUserId ASC, snapshotType ASC, snapshotDateKey DESC`', 'Runtime read path for latest daily / rolling snapshots.'],
  ['`health-context-snapshot-revisions`', '`snapshotId ASC, generatedAt DESC`', 'Revision history and audit lookup.'],
  ['`health-context-assembly-traces`', '`athleteUserId ASC, snapshotId ASC, snapshotRevisionId DESC`', 'Trace inspection path.'],
  ['`health-context-source-status`', '`athleteUserId ASC, sourceFamily ASC`', 'Runtime readiness and setup path.'],
  ['`health-context-jobs`', '`status ASC, scheduledAt ASC`', 'Worker queue processing.'],
  ['`health-context-jobs`', '`athleteUserId ASC, jobType ASC, scheduledAt DESC`', 'Athlete-scoped job inspection.'],
];

const QUERY_ROWS = [
  ['Assembler recent-window read', 'Read source records for one athlete across active statuses and relevant windows.', 'Needs source-record composite indexes.'],
  ['Runtime daily snapshot read', 'Read `health-context-snapshots` by athlete + `daily` + date key.', 'Primary PulseCheck read.'],
  ['Runtime rolling snapshot read', 'Read `health-context-snapshots` by athlete + `rolling_*` + date key.', 'Trend-aware consumer path.'],
  ['Trace lookup', 'Read trace by revision or athlete/date scope.', 'Operator tooling path.'],
  ['Job queue worker', 'Read queued jobs ordered by `scheduledAt`.', 'Operational path.'],
];

const SECURITY_ROWS = [
  ['Athlete clients', 'May read only their own filtered snapshot projections and source posture needed for product UX.', 'Should not read raw records or traces directly.'],
  ['Coach clients', 'May read filtered athlete snapshot projections only when allowed by permissions model.', 'No raw health-context record access by default.'],
  ['Admin / operator tools', 'May read raw source records, traces, statuses, and jobs behind privileged roles.', 'Operational visibility boundary.'],
  ['Backend workers', 'May read and write all canonical health-context collections needed for assembly and orchestration.', 'System owner boundary.'],
];

const MIGRATION_ROWS = [
  ['Keep `daily-health-summaries` live', 'Do not break the current shared summary path during initial rollout.', 'Required'],
  ['Write canonical snapshot store in parallel', 'Introduce new collections before cutting consumers.', 'Required'],
  ['Treat legacy summary as bridge input', 'Do not add new runtime logic directly on legacy collection.', 'Required'],
  ['Cut runtime to snapshots', 'Once stable, shift reads to `health-context-snapshots`.', 'Milestone 2'],
  ['Reduce legacy coupling', 'After cutover, legacy becomes compatibility input only.', 'Later'],
];

const PulseCheckHealthContextFirestoreSchemaIndexSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Health Context"
        title="Health Context Firestore Schema & Index Spec"
        version="Version 0.1 | March 17, 2026"
        summary="Implementation-facing Firestore schema and index spec for the health-context system. This artifact maps the persistence model into concrete collections, document fields, index requirements, query shapes, and migration rules so platform work can begin from one storage contract."
        highlights={[
          {
            title: 'Collection-Level Clarity',
            body: 'Defines the canonical Firestore collections and the role of each one in the health-context system.',
          },
          {
            title: 'Index-Aware',
            body: 'Includes the core composite index expectations for the assembler, runtime reads, and operational queues.',
          },
          {
            title: 'Migration-Compatible',
            body: 'Makes the legacy shared summary collection a bridge input, not the future runtime source of truth.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Storage implementation artifact for Firestore modeling of the health-context system. It defines collection names, document fields, index needs, query paths, security posture, and migration boundaries."
        sourceOfTruth="This document is authoritative for Firestore collection structure and index planning for the health-context rollout. It should be used when creating collections, rules, worker queries, or runtime read paths."
        masterReference="Use this page when implementing Firestore collections, composite indexes, query helpers, migration jobs, or security rules for health-context source records, snapshots, traces, statuses, and jobs."
        relatedDocs={[
          'Health Context Persistence & Storage Spec',
          'Health Context Snapshot Assembler Spec',
          'Health Context Engineering Task Breakdown',
          'Health Context Implementation Rollout Plan',
          'Firestore Index Registry',
        ]}
      />

      <SectionBlock icon={Database} title="Canonical Collections">
        <DataTable columns={['Collection', 'Purpose', 'Role']} rows={COLLECTION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Source Record Document Shape">
        <DataTable columns={['Field', 'Type', 'Meaning', 'Rule']} rows={SOURCE_RECORD_FIELDS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Snapshot Document Shape">
        <DataTable columns={['Field', 'Type', 'Meaning', 'Rule']} rows={SNAPSHOT_FIELDS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Snapshot Revision Shape">
        <DataTable columns={['Field', 'Type', 'Meaning', 'Rule']} rows={REVISION_FIELDS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Assembly Trace Shape">
        <DataTable columns={['Field', 'Type', 'Meaning', 'Rule']} rows={TRACE_FIELDS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Source Status Shape">
        <DataTable columns={['Field', 'Type', 'Meaning', 'Rule']} rows={STATUS_FIELDS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Job Document Shape">
        <DataTable columns={['Field', 'Type', 'Meaning', 'Rule']} rows={JOB_FIELDS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Core Composite Indexes">
        <DataTable columns={['Collection', 'Index', 'Why']} rows={INDEX_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Primary Query Patterns">
        <DataTable columns={['Query', 'Pattern', 'Why']} rows={QUERY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Migration Rules">
        <DataTable columns={['Rule', 'Meaning', 'Timing']} rows={MIGRATION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Security Posture">
        <DataTable columns={['Actor', 'Access Pattern', 'Why']} rows={SECURITY_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Runtime Read Rule"
            accent="green"
            body="User-facing clients should primarily read filtered snapshot documents and source posture, not raw source-record or trace collections."
          />
          <InfoCard
            title="Platform Rule"
            accent="red"
            body="Assembler and orchestration workers need privileged access to the full canonical store; avoid overfitting the schema to direct client reads."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Implementation Guardrails">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Schema Discipline"
            accent="blue"
            body={<BulletList items={['Do not add convenience fields to snapshots that bypass domain blocks.', 'Version payload changes explicitly.', 'Keep ids deterministic where the spec requires it.']} />}
          />
          <InfoCard
            title="Index Discipline"
            accent="amber"
            body={<BulletList items={['Create indexes for hot paths before rollout.', 'Do not wait for production failures to define query posture.', 'Keep query shapes aligned with the assembler and runtime specs.', 'Any new index must update the shared Firestore index registry file.', 'Deploy index changes to both dev and prod so the environments stay aligned.']} />}
          />
          <InfoCard
            title="Migration Discipline"
            accent="green"
            body={<BulletList items={['Use canonical collections in parallel first.', 'Keep legacy summary collection as bridge input only.', 'Cut consumers over before deepening source count.']} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckHealthContextFirestoreSchemaIndexSpecTab;
