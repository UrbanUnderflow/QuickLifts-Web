import React from 'react';
import { AlertTriangle, ArrowRightLeft, Brain, Database, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const SNAPSHOT_PRINCIPLES = [
  {
    title: 'Contract Before Pipes',
    accent: 'red' as const,
    body: 'Do not build PulseCheck-native HealthKit or Oura ingestion against an ad hoc shape. The canonical snapshot contract must be locked first so every ingestion lane targets the same normalized model.',
  },
  {
    title: 'One Snapshot, Many Sources',
    accent: 'blue' as const,
    body: 'QuickLifts, HealthKit, Apple Watch, Oura, and PulseCheck self-report should all merge into one athlete-context artifact rather than branching into separate runtime-specific models.',
  },
  {
    title: 'Provenance Is Product Logic',
    accent: 'green' as const,
    body: 'Freshness, source attribution, and direct-vs-inferred status are not just metadata. Nora, coach surfaces, and alerts should branch on them intentionally.',
  },
];

const TOP_LEVEL_ROWS = [
  ['snapshotId', 'Deterministic snapshot id for the athlete and scope window.', 'Required.'],
  ['athleteUserId', 'Canonical athlete uid.', 'Required.'],
  ['snapshotDate', 'Primary date this snapshot describes in athlete-local time.', 'Required for daily snapshots.'],
  ['snapshotType', 'One of `daily`, `rolling_7d`, `rolling_14d`, `rolling_30d`, or `point_in_time`.', 'Required.'],
  ['generatedAt', 'When the snapshot was assembled.', 'Required.'],
  ['sourceWindow', 'Time window used to build the snapshot.', 'Required.'],
  ['revision', 'Monotonic revision or hash for auditability and cache safety.', 'Required.'],
  ['permissions', 'Source permissions and consent posture.', 'Required.'],
  ['sourceStatus', 'Availability and sync status for each configured source.', 'Required.'],
  ['freshness', 'Freshness status for each major domain plus an overall summary.', 'Required.'],
  ['provenance', 'Exact source list, merge notes, and domain-level source winners.', 'Required.'],
  ['domains', 'Normalized health, training, recovery, nutrition, and behavioral context blocks.', 'Required.'],
  ['audit', 'Assembly notes, missing-source reasons, and branch-safe QA fields.', 'Recommended.'],
];

const DOMAIN_ROWS = [
  ['identity', 'Athlete id, team / org references, timezone, age-band-safe profile context, and personalization fields safe for runtime use.', 'Required.'],
  ['training', 'QuickLifts workout summaries, workout count, volume, body parts worked, recent workload, adherence, and training recency.', 'Required when training context exists.'],
  ['recovery', 'Sleep, HRV, resting heart rate, readiness, overnight recovery, and wearable-origin recovery signals.', 'Required when recovery sources exist.'],
  ['activity', 'Steps, active calories, distance, exercise minutes, stand hours, cardio and general movement context.', 'Required when activity sources exist.'],
  ['nutrition', 'Meal count, calories, macros, hydration, journal confidence, and energy-balance interpretation.', 'Required when nutrition context exists.'],
  ['biometrics', 'Weight, body fat, muscle mass, respiratory rate, oxygen saturation, VO2 max, and other body / fitness metrics.', 'Optional but normalized when present.'],
  ['behavioral', 'PulseCheck check-ins, mood, subjective readiness, sim outcomes, compliance, and recent self-report context.', 'Required for PulseCheck personalization.'],
  ['summary', 'High-level merged takeaways safe for Nora and dashboard consumption.', 'Required.'],
];

const SOURCE_STATUS_ROWS = [
  ['not_connected', 'Source has not been linked or permission has never been granted.', 'Offer connection path, do not infer availability.'],
  ['permission_denied', 'The athlete explicitly denied required access.', 'Do not keep prompting as if the source were simply missing.'],
  ['connected_waiting_for_data', 'Source is connected but insufficient data has arrived yet.', 'Explain “not enough data yet” rather than “no data.”'],
  ['connected_synced', 'Source is connected and has recent usable data.', 'Eligible for direct use.'],
  ['connected_stale', 'Source was connected but has not produced recent usable data.', 'Eligible only for stale-aware or historical-only behavior.'],
  ['error', 'Source sync or parse failed.', 'Needs operational visibility and user-safe fallback language.'],
];

const FRESHNESS_ROWS = [
  ['fresh', 'Direct data inside the acceptable recency window for that domain.', 'Safe for confident runtime use.'],
  ['recent', 'Still useful, but outside the ideal freshness band.', 'Use with softer language where needed.'],
  ['historical_only', 'Only prior-baseline or non-current data is available.', 'Good for context, not for same-day claims.'],
  ['stale', 'Data exists but is older than product-safe expectations.', 'Must be labeled or down-weighted.'],
  ['missing', 'No usable data for this domain.', 'Do not fabricate the domain.'],
  ['inferred', 'Derived from other domains rather than measured directly.', 'Must be called out in provenance.'],
];

const PROVENANCE_ROWS = [
  ['sourcesUsed', 'Array of source records used in assembly, such as QuickLifts, HealthKit, Apple Watch, Oura, and SelfReport.', 'Required.'],
  ['domainWinners', 'For each domain, which source or merge strategy won.', 'Required.'],
  ['summaryMode', 'One of `direct`, `merged_direct`, `historical_contextual`, `inferred_partial`, or `empty`.', 'Required.'],
  ['sourceObservationTimes', 'Most recent observed timestamps per source and domain.', 'Required.'],
  ['mergeNotes', 'Human-readable notes for debugging and QA.', 'Recommended.'],
  ['dataConfidence', 'Domain-level confidence values derived from freshness and source completeness.', 'Recommended.'],
];

const MERGE_ROWS = [
  ['Training domain', 'QuickLifts / FitWithPulse wins when available because it carries app-native exercise structure and lift detail. HealthKit workout summaries may supplement but should not replace richer training context.', 'Preserve product-native workout richness.'],
  ['Recovery domain', 'Oura and Apple Health sources merge, with direct wearable recovery signals preferred over broader inferred heuristics.', 'Choose the most recovery-specific direct signal.'],
  ['Activity domain', 'HealthKit / Apple Watch-origin activity metrics are canonical for general movement and daily exertion.', 'Avoid duplicating derived totals from less precise sources.'],
  ['Nutrition domain', 'QuickLifts food journal wins for logged nutrition; HealthKit dietary energy can supplement where journal detail is missing.', 'Prefer explicit meal context over calorie-only readings.'],
  ['Behavioral domain', 'PulseCheck self-report and app-native state always win because they express athlete intent and subjective state.', 'Do not let device metrics overwrite self-report.'],
  ['Summary domain', 'The summary block is generated from normalized domains and their freshness / provenance metadata, not from a raw source payload.', 'Keep runtime language source-aware and consistent.'],
];

const LIFECYCLE_STEPS = [
  {
    title: 'Collect Source Records',
    body: 'Each source writes normalized source records first, not direct Nora-facing payloads. Source records should be append-only or revision-safe so the assembler can rebuild snapshots deterministically.',
    owner: 'Source adapters',
  },
  {
    title: 'Assemble Snapshot',
    body: 'A snapshot assembler merges current-day and rolling-window source records into the canonical `AthleteHealthContextSnapshot` contract.',
    owner: 'Snapshot assembler',
  },
  {
    title: 'Store Revisioned Snapshot',
    body: 'Persist the canonical snapshot with revision metadata so chat, dashboards, and alerts can reference the exact artifact they consumed.',
    owner: 'Snapshot store',
  },
  {
    title: 'Expose Consumer Views',
    body: 'Nora and downstream product surfaces read consumer-safe projections of the same snapshot rather than rebuilding health context independently.',
    owner: 'Consumer adapters',
  },
  {
    title: 'Emit Audit Event',
    body: 'When a product surface uses the snapshot, emit an event with snapshot revision, consumer, branch path, and source/freshness posture.',
    owner: 'Observability',
  },
];

const BUILD_ORDER_ROWS = [
  ['1. Lock contract', 'Finalize the `AthleteHealthContextSnapshot` schema, enums, merge precedence, and provenance rules.', 'Required before new ingestion work starts.'],
  ['2. Build source adapters', 'Implement PulseCheck-native HealthKit and later Oura source adapters to output normalized source records targeting the contract.', 'Adapters should not invent their own storage shape.'],
  ['3. Implement assembler', 'Create the snapshot builder that merges shared QuickLifts context plus native PulseCheck sources.', 'Assembler enforces one product truth.'],
  ['4. Migrate consumers', 'Point Nora, proactive insights, and coach surfaces at the snapshot contract.', 'Stops schema drift from spreading.'],
  ['5. Expand safely', 'Add new domains or fields through contract revisioning, not one-off consumer fields.', 'Keeps future expansion disciplined.'],
];

const EXAMPLE_ROWS = [
  ['summaryMode', '`merged_direct`', 'QuickLifts training + HealthKit activity + PulseCheck self-report all present on the same day.'],
  ['training.freshness', '`fresh`', 'Athlete completed a QuickLifts workout recently and it synced.'],
  ['recovery.freshness', '`historical_only`', 'Only prior-night recovery data exists for a same-day coaching turn.'],
  ['nutrition.sourceStatus.quicklifts', '`connected_synced`', 'Meals were logged in the shared app ecosystem.'],
  ['behavioral.primarySource', '`pulsecheck_self_report`', 'Mood and readiness came from a PulseCheck check-in.'],
  ['audit.missingDomains', '`["biometrics"]`', 'No body-composition source reported today.'],
];

const PulseCheckAthleteHealthContextSnapshotSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Health Context"
        title="AthleteHealthContextSnapshot Spec"
        version="Version 0.1 | March 17, 2026"
        summary="Canonical contract for the normalized athlete health-context artifact that PulseCheck, Nora, dashboards, and future automation should consume. This spec exists to prevent schema drift by locking the merged context model before native HealthKit or Oura ingestion work begins."
        highlights={[
          {
            title: 'Contract First',
            body: 'This artifact should be treated as the target schema for Phase 2 and the prerequisite for Phase 3 ingestion work.',
          },
          {
            title: 'Shared Plus Standalone',
            body: 'The snapshot is designed to merge shared QuickLifts / FitWithPulse context with PulseCheck-native wearable and self-report signals.',
          },
          {
            title: 'Runtime-Safe Context',
            body: 'Freshness, provenance, permissions, and merge rules are part of the contract so consumers can behave safely and consistently.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Schema and lifecycle artifact for the canonical athlete health-context snapshot. It defines the normalized object that all ingestion lanes must target and all runtime consumers should read from."
        sourceOfTruth="This document is authoritative for the top-level `AthleteHealthContextSnapshot` contract, domain blocks, source-status enums, freshness enums, provenance rules, merge precedence, and implementation sequencing."
        masterReference="Use this page before implementing HealthKit ingestion, Oura ingestion, snapshot persistence, Nora health context, proactive alerts, or coach-facing health explanations. If an implementation proposal conflicts with this contract, update the contract first."
        relatedDocs={[
          'Health Context Architecture',
          'Health Context Source Record Spec',
          'Health Context Snapshot Assembler Spec',
          'Health Context Persistence & Storage Spec',
          'Health Context Operational Orchestration Spec',
          'Snapshot Freshness Policy',
          'State Signal Layer v1.3',
          'Permissions & Visibility Model',
          'Profile Snapshot & Export Spec',
        ]}
      />

      <SectionBlock icon={Brain} title="Contract Principles">
        <CardGrid columns="md:grid-cols-3">
          {SNAPSHOT_PRINCIPLES.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Top-Level Snapshot Shape">
        <DataTable columns={['Field', 'Meaning', 'Rule']} rows={TOP_LEVEL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Normalized Domain Blocks">
        <DataTable columns={['Domain', 'Contents', 'Rule']} rows={DOMAIN_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Source Status Enum">
        <DataTable columns={['Value', 'Meaning', 'Consumer Rule']} rows={SOURCE_STATUS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Freshness Enum">
        <DataTable columns={['Value', 'Meaning', 'Consumer Rule']} rows={FRESHNESS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Provenance Contract">
        <DataTable columns={['Field', 'Meaning', 'Rule']} rows={PROVENANCE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Merge Precedence Rules">
        <DataTable columns={['Domain', 'Merge Rule', 'Why']} rows={MERGE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Snapshot Lifecycle">
        <StepRail steps={LIFECYCLE_STEPS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Implementation Build Order">
        <DataTable columns={['Step', 'Scope', 'Guardrail']} rows={BUILD_ORDER_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Engineering Guardrail"
            accent="red"
            body="Do not allow a native HealthKit adapter to become the de facto schema. Adapters should emit normalized source records defined by the source-record contract or contract-conforming snapshots only."
          />
          <InfoCard
            title="Migration Guardrail"
            accent="green"
            body="Current Firestore daily summaries can remain as an upstream input during migration, but they should eventually become one source lane feeding the canonical snapshot instead of the only contract consumers understand."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Example Interpretation">
        <DataTable columns={['Example Field', 'Example Value', 'What It Means']} rows={EXAMPLE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Consumer Safety Rules">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Nora"
            accent="blue"
            body={<BulletList items={['Read from the snapshot only.', 'Branch on freshness and provenance before making claims.', 'Never treat `historical_only`, `stale`, or `empty` as direct same-day certainty.']} />}
          />
          <InfoCard
            title="Coach Views"
            accent="amber"
            body={<BulletList items={['Consume filtered projections of the snapshot.', 'Respect permissions and minimum-necessary exposure.', 'Do not expose raw wearable payloads when higher-level interpreted context is sufficient.']} />}
          />
          <InfoCard
            title="Ingestion Adapters"
            accent="green"
            body={<BulletList items={['Target this contract, not a local convenience shape.', 'Emit source-specific provenance and observation times.', 'Version changes to the contract instead of silently adding drift fields.']} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckAthleteHealthContextSnapshotSpecTab;
