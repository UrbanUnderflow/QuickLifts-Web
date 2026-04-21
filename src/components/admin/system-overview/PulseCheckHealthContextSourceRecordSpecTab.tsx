import React from 'react';
import { AlertTriangle, ArrowRightLeft, Database, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const PRINCIPLE_CARDS = [
  {
    title: 'Adapters Emit Records, Not Stories',
    accent: 'red' as const,
    body: 'HealthKit, Oura, Fit With Pulse, Macra, and Pulse Check self-report adapters should emit normalized source records only. They should not create Nora-facing summaries or consumer-specific payloads.',
  },
  {
    title: 'Append-Oriented And Rebuildable',
    accent: 'blue' as const,
    body: 'Source records should be revision-safe and rebuild-friendly so the snapshot assembler can deterministically reconstruct context after schema or merge-rule changes.',
  },
  {
    title: 'Normalize Units Early',
    accent: 'green' as const,
    body: 'Units, timestamps, timezone handling, source ids, and observation windows should be normalized at record-ingest time so downstream assembly stays consistent.',
  },
];

const RECORD_ROWS = [
  ['recordId', 'Deterministic id for the source record.', 'Required.'],
  ['athleteUserId', 'Canonical athlete uid the record belongs to.', 'Required.'],
  ['sourceFamily', 'One of `quicklifts` for legacy Fit With Pulse lineage, `macra`, `healthkit`, `apple_watch`, `oura`, `pulsecheck_self_report`, or future approved families.', 'Required.'],
  ['sourceType', 'The concrete adapter or feed name, such as `healthkit_sleep`, `oura_readiness`, `fit_with_pulse_workout_summary`, or `macra_meal_log`.', 'Required.'],
  ['recordType', 'One of `measurement`, `session`, `journal_entry`, `checkin`, `summary_input`, or `derived_signal`.', 'Required.'],
  ['domain', 'Primary domain such as `training`, `recovery`, `activity`, `nutrition`, `biometrics`, or `behavioral`.', 'Required.'],
  ['observedAt', 'When the underlying event or measurement occurred.', 'Required.'],
  ['observedWindow', 'Start and end timestamps for interval-based records like sleep or workouts.', 'Recommended for interval records.'],
  ['ingestedAt', 'When the adapter wrote the normalized record.', 'Required.'],
  ['timezone', 'Athlete-local timezone used for date bucketing and daily assembly.', 'Required.'],
  ['payload', 'Normalized domain payload in canonical units.', 'Required.'],
  ['payloadVersion', 'Schema version for the payload block.', 'Required.'],
  ['sourceMetadata', 'External source ids, device type, app version, and adapter metadata.', 'Required.'],
  ['provenance', 'Direct / inferred / imported posture, confidence hints, and upstream raw-source references.', 'Required.'],
  ['dedupeKey', 'Stable key for idempotent upsert or duplicate suppression.', 'Required.'],
  ['status', 'One of `active`, `superseded`, `deleted`, or `errored`.', 'Required.'],
];

const TYPE_ROWS = [
  ['measurement', 'A point-in-time or compact time-window metric such as HRV, resting heart rate, weight, VO2 max, oxygen saturation, or steps-total-for-day.', 'Fine-grained health metrics and daily totals.'],
  ['session', 'A bounded activity or recovery interval such as workout, sleep session, meditation session, or recovery block.', 'Workouts, sleep, readiness windows.'],
  ['journal_entry', 'A human-entered log such as meal, hydration, symptom note, or training note.', 'Nutrition and qualitative context.'],
  ['checkin', 'Pulse Check subjective response such as mood, readiness, stress, confidence, or post-session reflection.', 'Behavioral and emotional context.'],
  ['summary_input', 'A pre-aggregated upstream record allowed as an input to assembly, such as Fit With Pulse daily summary fragments.', 'Migration-safe bridge from current system to target system.'],
  ['derived_signal', 'A computed signal produced by an approved derivation step before full snapshot assembly.', 'Gap flags, adherence score inputs, and other reusable signals.'],
];

const PAYLOAD_ROWS = [
  ['training payload', 'Workout title, type, duration, calories, total volume, sets, reps, exercises, body parts, source workout id.', 'Fit With Pulse and HealthKit session records.'],
  ['recovery payload', 'Sleep duration, sleep stages, HRV, resting HR, readiness score, recovery score, temperature delta, source-specific confidence.', 'HealthKit and Oura recovery records.'],
  ['activity payload', 'Steps, active calories, distance, stand hours, exercise minutes, movement load.', 'Daily or interval activity records.'],
  ['nutrition payload', 'Meal id, calories, macros, hydration, nutrient detail, journal confidence, meal timestamp.', 'Macra-owned journal-entry or daily-total inputs, with legacy Fit With Pulse nutrition only as migration support.'],
  ['biometrics payload', 'Weight, body fat, lean mass, respiratory rate, oxygen saturation, VO2 max, and unit-normalized values.', 'Measurement records only.'],
  ['behavioral payload', 'Mood, readiness, stress, perceived recovery, sim outcome, compliance, notes, selected answers.', 'Pulse Check check-ins and reflections.'],
];

const SOURCE_ROWS = [
  ['Fit With Pulse adapter', 'Emit training, profile-health, club, and approved summary-input records from the consumer fitness ecosystem.', 'May preserve richer workout semantics than HealthKit.'],
  ['Macra nutrition adapter', 'Emit meal logs, label scans, macro plans, supplement context, and nutrition summary-input records from the dedicated nutrition surface.', 'Macra owns forward nutrition semantics.'],
  ['HealthKit adapter', 'Emit normalized measurements and sessions from Apple Health-authorized data.', 'Should not skip normalization just because upstream Apple types differ.'],
  ['Apple Watch origin metadata', 'Attach watch-origin detail inside `sourceMetadata` when HealthKit data originated from watch capture.', 'Useful for confidence and device-aware explanation, but not a separate consumer schema.'],
  ['Oura adapter', 'Emit recovery and readiness records normalized to the same contract.', 'Must not create a separate Oura-only snapshot shape.'],
  ['Pulse Check self-report adapter', 'Emit check-in and behavioral records from Pulse Check service flows.', 'Subjective context belongs in the same record system, not a side channel.'],
];

const STORAGE_ROWS = [
  ['Idempotent writes', 'Adapters should be able to safely replay the same upstream item without creating duplicates.', 'Use `dedupeKey` plus record revision / supersession rules.'],
  ['Revision-safe updates', 'When a source changes a previously ingested record, write a superseding record or explicit status transition rather than silently mutating meaning in place.', 'Supports auditability and deterministic rebuilds.'],
  ['Timezone-safe bucketing', 'Store athlete-local timezone and UTC timestamps together.', 'Daily assembly depends on this being right.'],
  ['Canonical units', 'Distance, calories, duration, weight, macros, and sleep values must enter the record in agreed canonical units.', 'Do not defer unit cleanup to the assembler.'],
  ['Raw pointer optionality', 'Keep references to raw upstream ids or payload pointers when available, but do not require every consumer to parse raw vendor formats.', 'Supports debugging without coupling consumers to vendors.'],
];

const HANDOFF_STEPS = [
  {
    title: 'Adapter Fetches Upstream Item',
    body: 'The adapter reads a HealthKit sample, Oura payload, Fit With Pulse workout, Macra nutrition record, or Pulse Check check-in event.',
    owner: 'Source adapter',
  },
  {
    title: 'Normalize Into Source Record',
    body: 'The adapter maps the upstream item into the canonical source-record shape, including units, timestamps, source metadata, provenance, and dedupe key.',
    owner: 'Source adapter',
  },
  {
    title: 'Persist Record',
    body: 'Write the normalized source record into the source-record store with status and revision safety.',
    owner: 'Record store',
  },
  {
    title: 'Assembler Reads Records',
    body: 'The snapshot assembler reads source records by athlete, domain, and time window and applies merge precedence and freshness rules.',
    owner: 'Snapshot assembler',
  },
  {
    title: 'Snapshot Consumers Read Snapshot Only',
    body: 'Nora and downstream product surfaces consume the assembled snapshot, not the raw source records directly, unless explicitly building operator tooling.',
    owner: 'Consumer layer',
  },
];

const GUARDRAIL_ROWS = [
  ['No direct consumer coupling', 'UI, chat, and coach tools should not query vendor-specific HealthKit or Oura records directly for business logic.', 'All product meaning should flow through assembled snapshots.'],
  ['No source-specific schema branches', 'Adding Oura should not introduce an alternate recovery object that only Oura-aware consumers understand.', 'New sources extend records, not runtime contracts.'],
  ['No adapter-owned merge logic', 'Adapters must not decide cross-source winner logic such as “Oura beats HealthKit.”', 'Merge precedence belongs in the snapshot assembler.'],
  ['No hidden unit conversions downstream', 'Assemblers and consumers should assume source records are already unit-normalized.', 'Prevents silent metric drift.'],
  ['No silent schema expansion', 'If an adapter needs a new payload field, update the source-record spec and version it.', 'Keeps ingestion disciplined and observable.'],
];

const BUILD_ORDER_ROWS = [
  ['1. Finalize source-record contract', 'Lock record shape, enums, unit rules, and adapter responsibilities.', 'Needed before adapter implementation.'],
  ['2. Implement HealthKit adapter', 'Map HealthKit-origin measurements and sessions into source records.', 'Targets the contract rather than inventing storage.'],
  ['3. Implement Pulse Check self-report adapter', 'Write check-ins and behavioral context into the same source-record system.', 'Makes subjective context a first-class input.'],
  ['4. Implement Oura adapter', 'Map Oura recovery and readiness inputs into source records.', 'Drops into the same assembler path cleanly.'],
  ['5. Build operator tooling', 'Add inspection tools for raw source records and snapshot assembly traces.', 'Makes ingestion debuggable without leaking raw complexity into product surfaces.'],
];

const EXAMPLE_ROWS = [
  ['sourceFamily', '`healthkit`', 'The record came from a HealthKit adapter.'],
  ['sourceType', '`healthkit_sleep_session`', 'Concrete adapter mapping for overnight sleep.'],
  ['recordType', '`session`', 'The underlying item spans a time interval.'],
  ['domain', '`recovery`', 'This record feeds the recovery domain.'],
  ['dedupeKey', '`athlete123|healthkit_sleep_session|2026-03-17T07:10:00Z`', 'Replay-safe identity for the normalized item.'],
  ['provenance.mode', '`direct`', 'This was directly measured, not inferred.'],
];

const PulseCheckHealthContextSourceRecordSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Health Context"
        title="Health Context Source Record Spec"
        version="Version 0.1 | March 17, 2026"
        summary="Canonical contract for the normalized source-record layer that every health-context adapter must write before snapshot assembly. This spec is the bridge between raw upstream systems and the `AthleteHealthContextSnapshot`, and it exists to stop HealthKit, Oura, Fit With Pulse, Macra, or self-report adapters from creating schema drift beneath the snapshot contract."
        highlights={[
          {
            title: 'Adapter Target Contract',
            body: 'Every ingestion lane should emit the same source-record shape so snapshot assembly stays deterministic and vendor-agnostic.',
          },
          {
            title: 'Snapshot Input Layer',
            body: 'Source records are the only approved raw-input layer for building athlete-context snapshots and later audit traces.',
          },
          {
            title: 'Stable Expansion Path',
            body: 'New sources should add adapters and payload versions, not create new runtime-only schemas.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Contract artifact for the source-record layer that feeds canonical athlete-context snapshots. It defines what every source adapter must write, how records are versioned and deduplicated, and where merge responsibility begins and ends."
        sourceOfTruth="This document is authoritative for the `HealthContextSourceRecord` shape, record types, source-family expectations, payload normalization rules, persistence guardrails, and the handoff boundary between source adapters and the snapshot assembler."
        masterReference="Use this page before implementing native HealthKit ingestion, Oura ingestion, Fit With Pulse snapshot migration adapters, Macra nutrition adapters, Pulse Check self-report ingestion, or operator tooling for health-context debugging."
        relatedDocs={[
          'Health Context Architecture',
          'Athlete Context Snapshot Spec',
          'Health Context Snapshot Assembler Spec',
          'Health Context Persistence & Storage Spec',
          'Health Context Operational Orchestration Spec',
          'Snapshot Freshness Policy',
          'Permissions & Visibility Model',
        ]}
      />

      <SectionBlock icon={ShieldCheck} title="Source-Record Principles">
        <CardGrid columns="md:grid-cols-3">
          {PRINCIPLE_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Canonical Record Shape">
        <DataTable columns={['Field', 'Meaning', 'Rule']} rows={RECORD_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Record Types">
        <DataTable columns={['Type', 'Meaning', 'Typical Usage']} rows={TYPE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Normalized Payload Families">
        <DataTable columns={['Payload Family', 'Core Fields', 'Typical Sources']} rows={PAYLOAD_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Adapter Families">
        <DataTable columns={['Adapter', 'Responsibility', 'Notes']} rows={SOURCE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Persistence And Storage Rules">
        <DataTable columns={['Rule', 'Meaning', 'Why']} rows={STORAGE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Assembler Handoff">
        <StepRail steps={HANDOFF_STEPS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Guardrails">
        <DataTable columns={['Guardrail', 'Rule', 'Why']} rows={GUARDRAIL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Build Order">
        <DataTable columns={['Step', 'Scope', 'Why']} rows={BUILD_ORDER_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Migration Note"
            accent="amber"
            body="The current Firestore daily summary can temporarily enter the new system as a `summary_input` source record while native adapters are phased in."
          />
          <InfoCard
            title="Consumer Note"
            accent="green"
            body="Even when operator tooling reads source records for debugging, product surfaces should still rely on the assembled snapshot contract for user-facing logic."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Example Record Interpretation">
        <DataTable columns={['Example Field', 'Example Value', 'What It Means']} rows={EXAMPLE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Adapter Safety Rules">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="HealthKit Adapter"
            accent="blue"
            body={<BulletList items={['Normalize Apple units and date windows before write.', 'Emit source metadata for device and origin detail.', 'Do not create HealthKit-specific consumer views.']} />}
          />
          <InfoCard
            title="Oura Adapter"
            accent="green"
            body={<BulletList items={['Map readiness and recovery into normalized payloads.', 'Attach Oura-specific confidence and raw reference metadata.', 'Do not create an Oura-only runtime shape.']} />}
          />
          <InfoCard
            title="QuickLifts Adapter"
            accent="amber"
            body={<BulletList items={['Preserve the richer semantics of workouts and food journal records.', 'Use summary-input only where raw records are not yet available.', 'Prefer structured source records over giant opaque snapshot blobs over time.']} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckHealthContextSourceRecordSpecTab;
