import React from 'react';
import { AlertTriangle, ArrowRightLeft, Database, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const PRINCIPLE_CARDS = [
  {
    title: 'Sync Is A Product Surface',
    accent: 'red' as const,
    body: 'Connection state, freshness, retries, and stale-data posture are part of the athlete experience. Operational orchestration should be treated as user-facing product logic, not just background plumbing.',
  },
  {
    title: 'Event-Driven First, Scheduled Second',
    accent: 'blue' as const,
    body: 'When new source data lands, the system should update snapshots quickly through event-driven recompute. Scheduled jobs should mainly catch drift, stale sources, and missed events.',
  },
  {
    title: 'Failures Need States, Not Silence',
    accent: 'green' as const,
    body: 'Health-context failures should move sources into explicit operational states like waiting, stale, or error, so the runtime can branch honestly instead of pretending data is current.',
  },
];

const LIFECYCLE_ROWS = [
  ['Not connected', 'Source has never been linked or permission was never granted.', 'Show setup path only.'],
  ['Connecting', 'User is actively linking or granting permission.', 'Transient onboarding state.'],
  ['Connected waiting for first data', 'Connection exists but no usable source records have arrived yet.', 'Important for new-source onboarding copy.'],
  ['Connected synced', 'Source is healthy and producing records inside expected freshness windows.', 'Ideal state.'],
  ['Connected stale', 'Source was previously healthy but has not produced recent usable data.', 'Needs stale-aware runtime behavior.'],
  ['Error', 'Sync or ingestion failed and requires retry or intervention.', 'Needs explicit operator and runtime handling.'],
  ['Disconnected', 'Source was intentionally removed or revoked.', 'Should clear expectations without deleting historical context.'],
];

const TRIGGER_ROWS = [
  ['User links source', 'Create or update source-status doc, enqueue initial sync, and open first-data waiting window.', 'Initial connector bootstrap.'],
  ['New source record ingested', 'Trigger assembler recompute for affected athlete/date/windows.', 'Primary hot path.'],
  ['Permission revoked', 'Update source-status posture, recompute affected domains, and downshift runtime freshness.', 'Prevents overclaiming.'],
  ['Scheduled freshness sweep', 'Evaluate stale thresholds and queue catch-up sync or rebuild jobs where needed.', 'Keeps sources honest over time.'],
  ['Manual operator rebuild', 'Queue targeted source refresh, record replay, or snapshot rebuild by athlete/date/domain.', 'Operational recovery path.'],
  ['Contract/config revision', 'Queue rebuild jobs for snapshots assembled under outdated rules.', 'Controlled evolution path.'],
];

const JOB_ROWS = [
  ['Initial sync job', 'Runs immediately after a source is linked to fetch recent usable history and establish first source records.', 'Bootstrap job.'],
  ['Incremental sync job', 'Fetches only new or changed source items since the last successful sync marker.', 'Steady-state sync job.'],
  ['Backfill job', 'Fetches historical windows beyond the incremental horizon for richer baselines and rolling context.', 'Catch-up / enrichment job.'],
  ['Assembler recompute job', 'Rebuilds daily and rolling snapshots for windows affected by new or changed records.', 'Core downstream job.'],
  ['Stale-source recovery job', 'Attempts to refresh sources that have crossed stale thresholds or previously errored.', 'Operational reliability job.'],
  ['Migration replay job', 'Converts legacy summary data or old records into canonical source-record inputs during rollout.', 'Migration job.'],
];

const SCHEDULING_ROWS = [
  ['On-link immediate run', 'Start first sync as soon as the source is connected.', 'Reduces time-to-value.'],
  ['Foreground opportunistic sync', 'When the athlete opens Pulse Check or Fit With Pulse and a source is eligible, allow lightweight incremental sync.', 'Good for client-originated data freshness.'],
  ['Periodic freshness sweep', 'Run a scheduled job to detect stale sources, pending backfills, and missed recompute opportunities.', 'Catches drift and gaps.'],
  ['Low-priority historical backfill', 'Backfill older windows without blocking recent-day freshness.', 'Separates baseline building from hot-path freshness.'],
  ['Rate-limited retry schedule', 'Retry failed syncs with bounded exponential backoff and jitter.', 'Protects connectors and avoids loops.'],
];

const FAILURE_ROWS = [
  ['Transient sync failure', 'Mark source as retryable error, preserve last known good data, and schedule retry.', 'Do not erase useful history.'],
  ['Auth / permission failure', 'Move source to permission-denied or disconnected posture and stop pretending fresh data can arrive.', 'Honest runtime branch.'],
  ['Partial domain failure', 'Only degrade affected domains and keep healthy domains usable.', 'Avoid all-or-nothing health collapse.'],
  ['Assembler failure', 'Keep prior active snapshot revision, log trace failure, and flag recompute job for retry.', 'Snapshot continuity matters.'],
  ['Repeated failure threshold reached', 'Escalate to operator visibility and suppress aggressive retries until the next meaningful trigger.', 'Operational sanity guardrail.'],
];

const OPERATOR_ROWS = [
  ['Connector dashboard', 'View source status, last sync, last success, stale posture, and error reasons per athlete.', 'Required.'],
  ['Targeted rebuild controls', 'Rebuild by athlete, date, source family, or snapshot type.', 'Required.'],
  ['Trace inspection', 'Inspect which records won, which were dropped, and why a snapshot changed.', 'Required.'],
  ['Migration observability', 'Track which athletes or windows are still sourced from legacy summary input lanes.', 'Recommended.'],
  ['Pause / suppress controls', 'Temporarily suppress noisy jobs or failing connectors without deleting configuration.', 'Recommended.'],
];

const FLOW_STEPS = [
  {
    title: 'Source Connects',
    body: 'A user links HealthKit, Oura, or another source, or Pulse Check / Fit With Pulse confirms an existing integration path.',
    owner: 'Connector layer',
  },
  {
    title: 'Bootstrap Sync Runs',
    body: 'The orchestrator starts an initial sync job, writes source-status posture, and begins creating canonical source records.',
    owner: 'Sync orchestrator',
  },
  {
    title: 'Assembler Recomputes',
    body: 'New records trigger daily and rolling snapshot rebuilds for affected windows and persist fresh revisions plus traces.',
    owner: 'Assembly orchestrator',
  },
  {
    title: 'Runtime Reads Snapshot',
    body: 'Nora and other consumers read the latest active snapshot and branch on freshness, provenance, and source posture.',
    owner: 'Runtime consumer',
  },
  {
    title: 'Scheduled Maintenance Runs',
    body: 'Periodic sweeps detect stale sources, pending backfills, or missed rebuilds and enqueue recovery work.',
    owner: 'Scheduler',
  },
  {
    title: 'Operator Intervenes When Needed',
    body: 'If repeated failure or migration issues occur, operators can inspect traces and trigger targeted rebuilds or suppressions.',
    owner: 'Ops tooling',
  },
];

const RUNTIME_ROWS = [
  ['Fresh and healthy', 'Allow direct health-backed Nora and dashboard behavior.', 'Best-case branch.'],
  ['Connected but waiting for first data', 'Explain setup progress and avoid pretending the source is already contributing.', 'Early onboarding branch.'],
  ['Connected but stale', 'Use historical or partial context carefully and name staleness where relevant.', 'Degraded but usable branch.'],
  ['Error', 'Avoid health certainty, preserve prior good context where safe, and guide recovery or retry.', 'Protect trust.'],
  ['Disconnected / denied', 'Offer reconnect guidance or fall back to non-health context.', 'Clear user path.'],
];

const BUILD_ORDER_ROWS = [
  ['1. Lock orchestration state machine', 'Finalize connector states, trigger types, and job types.', 'Needed before runtime implementation.'],
  ['2. Build source-status orchestration', 'Track lifecycle state, last success, stale posture, and error posture per source.', 'Foundation for runtime branching.'],
  ['3. Implement event-driven recompute flow', 'Wire source-record ingestion to assembler recompute jobs and snapshot invalidation.', 'Core freshness path.'],
  ['4. Add scheduled sweeps and backfill orchestration', 'Catch stale sources, run historical backfills, and detect missed recomputes.', 'Operational completeness.'],
  ['5. Add operator tools and alerts', 'Expose status, traces, retries, and targeted rebuild controls.', 'Makes the system maintainable at scale.'],
];

const PulseCheckHealthContextOperationalOrchestrationSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Health Context"
        title="Health Context Operational Orchestration Spec"
        version="Version 0.1 | March 17, 2026"
        summary="Canonical operational spec for connector lifecycle, sync scheduling, event-driven recompute, backfill, retry posture, and failure handling across the health-context system. This document defines how the system stays current and trustworthy after the underlying contracts and storage model are in place."
        highlights={[
          {
            title: 'Connector Lifecycle Matters',
            body: 'The system needs explicit operational states from first connect through stale and error posture so product behavior stays honest.',
          },
          {
            title: 'Fast Path Plus Sweep Path',
            body: 'Event-driven recompute should keep the hot path fresh, while scheduled sweeps and backfills catch drift and missed work.',
          },
          {
            title: 'Operator Control Is Part Of The Design',
            body: 'Targeted rebuilds, trace inspection, and source-status dashboards are first-class requirements, not afterthoughts.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Operational runtime artifact for the health-context system. It defines source lifecycle states, sync triggers, job types, scheduled maintenance behavior, failure posture, and operator controls across Fit With Pulse, Macra, HealthKit, Oura, and Pulse Check context ingestion."
        sourceOfTruth="This document is authoritative for how connector lifecycle state should work, when syncs and recomputes should run, how backfills and retries behave, and how the runtime should interpret stale or errored health-context systems."
        masterReference="Use this page before implementing connector state machines, scheduled sync orchestration, incremental or backfill jobs, rebuild tooling, stale-source handling, or operational dashboards for the health-context architecture."
        relatedDocs={[
          'Health Context Architecture',
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
          'Health Context Snapshot Assembler Spec',
          'Health Context Persistence & Storage Spec',
          'Health Context Implementation Rollout Plan',
          'Snapshot Freshness Policy',
        ]}
      />

      <SectionBlock icon={ShieldCheck} title="Operational Principles">
        <CardGrid columns="md:grid-cols-3">
          {PRINCIPLE_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Connector Lifecycle States">
        <DataTable columns={['State', 'Meaning', 'Runtime Implication']} rows={LIFECYCLE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Primary Triggers">
        <DataTable columns={['Trigger', 'Expected System Action', 'Role']} rows={TRIGGER_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Job Types">
        <DataTable columns={['Job', 'Meaning', 'Role']} rows={JOB_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Scheduling Model">
        <DataTable columns={['Pattern', 'Behavior', 'Why']} rows={SCHEDULING_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Failure Handling">
        <DataTable columns={['Failure Mode', 'System Response', 'Why']} rows={FAILURE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="End-to-End Operational Flow">
        <StepRail steps={FLOW_STEPS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Runtime Branching Expectations">
        <DataTable columns={['Operational Posture', 'Runtime Behavior', 'Why']} rows={RUNTIME_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Operator Surface Requirements">
        <DataTable columns={['Surface', 'Capability', 'Priority']} rows={OPERATOR_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Implementation Build Order">
        <DataTable columns={['Step', 'Scope', 'Why']} rows={BUILD_ORDER_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Hot Path Rule"
            accent="green"
            body="New source records should trigger recompute quickly enough that recent athlete actions and syncs show up in the snapshot without waiting on a broad batch sweep."
          />
          <InfoCard
            title="Safety Rule"
            accent="red"
            body="If orchestration fails, the system should degrade into explicit stale or partial posture rather than silently presenting old health context as current."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Operational Guardrails">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Retry Discipline"
            accent="blue"
            body={<BulletList items={['Retry transient failures with bounded backoff.', 'Stop noisy infinite loops.', 'Escalate repeated failures into operator visibility.']} />}
          />
          <InfoCard
            title="Freshness Discipline"
            accent="green"
            body={<BulletList items={['Use sweeps to detect drift.', 'Recompute affected windows only.', 'Keep source-status posture aligned with actual last-success markers.']} />}
          />
          <InfoCard
            title="Consumer Discipline"
            accent="amber"
            body={<BulletList items={['Consumers should react to source posture, not infer it.', 'Do not hide stale/error states from runtime logic.', 'Keep operational truth centralized in source-status and snapshot posture.']} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckHealthContextOperationalOrchestrationSpecTab;
