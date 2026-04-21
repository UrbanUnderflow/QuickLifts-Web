import React from 'react';
import { AlertTriangle, ArrowRightLeft, Brain, Database, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const PRINCIPLE_CARDS = [
  {
    title: 'Assembler Owns Meaning',
    accent: 'red' as const,
    body: 'Adapters only normalize records and consumers only read snapshots. The assembler is the only layer allowed to decide merge winners, freshness posture, and derived cross-source meaning.',
  },
  {
    title: 'Deterministic Rebuilds',
    accent: 'blue' as const,
    body: 'Given the same source records, the assembler should produce the same snapshot revision every time so debugging, cache invalidation, and QA remain trustworthy.',
  },
  {
    title: 'Daily Plus Rolling Context',
    accent: 'green' as const,
    body: 'The assembler should build both a requested-day view and rolling windows like 7-day, 14-day, and 30-day context because coaching depends on trends, not just a single day.',
  },
];

const INPUT_ROWS = [
  ['Source records', 'Normalized `HealthContextSourceRecord` items scoped by athlete, domain, source family, and time window.', 'Primary required input.'],
  ['Assembly config', 'Contract version, merge precedence map, freshness thresholds, timezone rules, and feature toggles.', 'Required.'],
  ['Permissions posture', 'Current consent and source-availability state for linked sources.', 'Required.'],
  ['Existing snapshot revision', 'Prior snapshot revision for diffing, supersession, or no-op detection.', 'Recommended.'],
];

const OUTPUT_ROWS = [
  ['Daily snapshot', 'Canonical `AthleteHealthContextSnapshot` for a specific athlete-local day.', 'Required.'],
  ['Rolling snapshots', 'Normalized 7d, 14d, and 30d context artifacts for trend-aware runtime behavior.', 'Required for full product behavior.'],
  ['Assembly trace', 'Machine-readable trace of source records selected, dropped, superseded, or down-weighted.', 'Recommended.'],
  ['Recompute metadata', 'Why the assembly ran, what domains changed, and what consumers should invalidate.', 'Recommended.'],
];

const WINDOW_ROWS = [
  ['Daily snapshot', 'Athlete-local midnight to 23:59:59 for the requested date, with overnight session rules where needed.', 'Primary same-day or requested-day context.'],
  ['Rolling 7d snapshot', 'Seven athlete-local calendar days ending on the requested date.', 'Short-term baseline and recent drift.'],
  ['Rolling 14d snapshot', 'Fourteen athlete-local calendar days ending on the requested date.', 'Mid-term stability and comparison layer.'],
  ['Rolling 30d snapshot', 'Thirty athlete-local calendar days ending on the requested date.', 'Longer-term baseline and normalization layer.'],
  ['Overnight recovery window', 'Sleep and recovery sessions may cross midnight and should be assigned using recovery-specific bucketing rules, not naive day splits.', 'Critical for sleep/readiness correctness.'],
];

const WINNER_ROWS = [
  ['Training', 'Prefer Fit With Pulse records when they exist; supplement with HealthKit sessions only where they add missing direct metrics.', 'Preserves richer workout structure and adherence context.'],
  ['Recovery', 'Prefer direct recovery-specific records, such as Oura readiness/recovery or Apple health recovery metrics, over derived general activity heuristics.', 'Recovery should stay recovery-specific.'],
  ['Activity', 'Prefer HealthKit / Apple-device activity totals for steps, movement, stand, and general exertion.', 'Best canonical activity lane.'],
  ['Nutrition', 'Prefer structured Macra nutrition records when present; use legacy Fit With Pulse food journal and HealthKit dietary totals only as supplements, not richer replacements.', 'Dedicated nutrition data is more actionable.'],
  ['Behavioral', 'Prefer Pulse Check self-report and app-native check-ins for subjective state.', 'Subjective state should not be overwritten by devices.'],
  ['Conflicts', 'If two sources provide the same field, choose via domain precedence, recency, directness, and completeness in that order.', 'Stable deterministic conflict resolution.'],
];

const FRESHNESS_ROWS = [
  ['training', 'Fresh when a direct training record exists inside the requested day; recent if inside 72 hours; historical_only if older but still trend-eligible.', 'Training context changes quickly around sessions.'],
  ['recovery', 'Fresh when the latest sleep/readiness block is inside the current coaching relevance window; recent when last valid overnight record is from the immediately prior cycle.', 'Recovery freshness is overnight-oriented, not purely calendar-based.'],
  ['activity', 'Fresh when same-day activity totals or sessions are present and synced; recent when last usable totals are from the prior day.', 'Supports same-day movement awareness.'],
  ['nutrition', 'Fresh when same-day food journal or nutrition totals are present; recent when the last structured nutrition context is within 48 hours.', 'Nutrition context decays quickly.'],
  ['behavioral', 'Fresh when a same-day checkin or reflection exists; recent when inside the configured reflection recency window.', 'Behavioral signals are strongest when recent.'],
  ['overall snapshot', 'Overall freshness should be a composed value derived from domain freshness, not a single timestamp.', 'Keeps runtime branching domain-aware.'],
];

const RECOMPUTE_ROWS = [
  ['New source record ingested', 'Recompute any daily and rolling snapshots whose windows include the new record.', 'Primary trigger.'],
  ['Source record superseded or deleted', 'Recompute all affected windows because winner logic or completeness may change.', 'Required for correctness.'],
  ['Permission or source-status change', 'Recompute affected domains to reflect new `sourceStatus` and missing / connected posture.', 'User-visible branch behavior changes.'],
  ['Assembly config revision change', 'Backfill or lazily recompute snapshots built under outdated merge or freshness rules.', 'Contract-safe evolution path.'],
  ['Manual operator rebuild', 'Allow targeted athlete/date/window rebuilds for debugging or migration.', 'Needed for operational control.'],
];

const STEP_ROWS = [
  {
    title: 'Load Candidate Records',
    body: 'Fetch normalized source records for the athlete across the required window and partition them by domain, source family, and record type.',
    owner: 'Assembler',
  },
  {
    title: 'Apply Time Bucketing',
    body: 'Assign each record to the requested daily and rolling windows using athlete-local timezone and overnight-session rules.',
    owner: 'Assembler',
  },
  {
    title: 'Evaluate Source Status And Freshness',
    body: 'Determine domain-level source availability and freshness before selecting winners so missing and stale posture are explicit inputs, not afterthoughts.',
    owner: 'Assembler',
  },
  {
    title: 'Select Winners And Merge',
    body: 'Apply deterministic precedence, directness, recency, and completeness rules to build each normalized domain block.',
    owner: 'Assembler',
  },
  {
    title: 'Generate Summary Block',
    body: 'Create the high-level summary block and provenance map from merged domains rather than from any raw source payload.',
    owner: 'Assembler',
  },
  {
    title: 'Persist Revision And Trace',
    body: 'Write the new snapshot revision and associated assembly trace so consumers and QA can reference the exact assembled artifact.',
    owner: 'Snapshot store',
  },
];

const TRACE_ROWS = [
  ['selectedRecordIds', 'Source records that directly contributed to the snapshot.', 'Required for audit trace.'],
  ['droppedRecordIds', 'Source records considered but not chosen.', 'Recommended.'],
  ['dropReasons', 'Why records were ignored, such as stale, superseded, lower precedence, incomplete, or outside window.', 'Recommended.'],
  ['domainWinnerSummary', 'Per-domain explanation of which sources won and why.', 'Required.'],
  ['triggerReason', 'What caused the recompute.', 'Required.'],
  ['contractVersions', 'Snapshot-spec, source-record-spec, and assembler-spec versions used.', 'Required.'],
];

const INVALIDATION_ROWS = [
  ['Nora chat cache', 'Invalidate when requested-day summary, behavioral context, or freshness posture changes.', 'Ensures response context stays current.'],
  ['Proactive insights', 'Invalidate when recovery, activity, or behavioral trend inputs change.', 'Insights must reflect latest merged truth.'],
  ['Coach dashboards', 'Invalidate when athlete-visible summary or trend blocks change under allowed permissions.', 'Prevents stale coach context.'],
  ['Operator views', 'Invalidate whenever assembly trace or source-status posture changes.', 'Debug surfaces need trace fidelity.'],
];

const BUILD_ORDER_ROWS = [
  ['1. Lock assembler rules', 'Finalize windowing, precedence, freshness, and recompute behavior.', 'Needed before adapter implementation can be judged against target runtime behavior.'],
  ['2. Implement trace-aware assembler', 'Build the assembly engine with revisioning and trace output.', 'Makes migration and QA far safer.'],
  ['3. Route current shared summaries through assembler path', 'Treat existing Fit With Pulse daily summary inputs as one assembly lane during migration.', 'Bridges current system to target system.'],
  ['4. Attach native adapters', 'Plug HealthKit, self-report, and later Oura source records into the assembler.', 'Uses the same merge engine instead of new branch logic.'],
  ['5. Move consumers fully to assembled snapshots', 'Nora and downstream surfaces should stop doing ad hoc data fetch / merge logic.', 'Completes the architectural transition.'],
];

const PulseCheckHealthContextSnapshotAssemblerSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Health Context"
        title="Health Context Snapshot Assembler Spec"
        version="Version 0.1 | March 17, 2026"
        summary="Canonical spec for the assembly layer that transforms normalized health-context source records into daily and rolling `AthleteHealthContextSnapshot` artifacts. This is the only layer allowed to decide merge winners, freshness posture, trend windows, and recompute behavior."
        highlights={[
          {
            title: 'Single Merge Engine',
            body: 'All sources should flow through one assembly path so merge precedence and freshness behavior stay consistent across the product.',
          },
          {
            title: 'Traceable Decisions',
            body: 'The assembler should explain which records were selected or dropped and why, making health-backed behavior inspectable.',
          },
          {
            title: 'Daily And Rolling Views',
            body: 'The system should build both requested-day context and rolling windows because coaching quality depends on trends, not isolated datapoints.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Contract artifact for the assembly engine that converts normalized source records into canonical athlete-context snapshots. It defines inputs, outputs, windowing behavior, winner selection, freshness evaluation, recompute triggers, and cache invalidation expectations."
        sourceOfTruth="This document is authoritative for how source records become snapshots, how domain winners are chosen, how freshness is evaluated, and when snapshots must be recomputed or invalidated."
        masterReference="Use this page before implementing snapshot assembly, migration of the existing Firestore daily summary path, consumer cache invalidation, proactive insight refresh behavior, or any orchestration involving merged athlete health context."
        relatedDocs={[
          'Health Context Architecture',
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
          'Health Context Persistence & Storage Spec',
          'Health Context Operational Orchestration Spec',
          'Snapshot Freshness Policy',
          'State Signal Layer v1.3',
        ]}
      />

      <SectionBlock icon={Brain} title="Assembler Principles">
        <CardGrid columns="md:grid-cols-3">
          {PRINCIPLE_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Inputs">
        <DataTable columns={['Input', 'Meaning', 'Rule']} rows={INPUT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Outputs">
        <DataTable columns={['Output', 'Meaning', 'Rule']} rows={OUTPUT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Assembly Windows">
        <DataTable columns={['Window', 'Definition', 'Purpose']} rows={WINDOW_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Winner Selection Rules">
        <DataTable columns={['Domain', 'Selection Rule', 'Why']} rows={WINNER_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Freshness Evaluation Rules">
        <DataTable columns={['Domain', 'Evaluation Rule', 'Why']} rows={FRESHNESS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Assembly Flow">
        <StepRail steps={STEP_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Recompute Triggers">
        <DataTable columns={['Trigger', 'Assembler Response', 'Why']} rows={RECOMPUTE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Assembly Trace Contract">
        <DataTable columns={['Field', 'Meaning', 'Rule']} rows={TRACE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Consumer Invalidation Rules">
        <DataTable columns={['Consumer', 'Invalidation Trigger', 'Why']} rows={INVALIDATION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Implementation Build Order">
        <DataTable columns={['Step', 'Scope', 'Why']} rows={BUILD_ORDER_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Migration Guardrail"
            accent="amber"
            body="During migration, existing Fit With Pulse daily-summary data can enter the assembler as one lane, but consumer behavior should still be driven by assembled snapshots and traces rather than old direct-read shortcuts."
          />
          <InfoCard
            title="Runtime Guardrail"
            accent="green"
            body="Nora, proactive insights, and dashboards should never implement their own winner logic once the assembler exists. If a merge rule changes, the assembler is the only place that should change."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Assembler Safety Rules">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Determinism"
            accent="blue"
            body={<BulletList items={['Use stable precedence rules.', 'Version assembly config.', 'Produce the same revision from the same inputs.']} />}
          />
          <InfoCard
            title="Observability"
            accent="green"
            body={<BulletList items={['Persist trace data for winner selection.', 'Record trigger reason and versions.', 'Support targeted rebuilds by athlete and date.']} />}
          />
          <InfoCard
            title="Consumer Discipline"
            accent="red"
            body={<BulletList items={['Do not let consumers bypass assembled snapshots.', 'Do not bury freshness logic inside UI code.', 'Do not allow adapter-specific merge exceptions outside the assembler.']} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckHealthContextSnapshotAssemblerSpecTab;
