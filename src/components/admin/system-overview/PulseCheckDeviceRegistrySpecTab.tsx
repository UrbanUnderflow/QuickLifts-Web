import React from 'react';
import {
  ClipboardList,
  Database,
  GitBranch,
  Layers,
  Plug,
  RadioTower,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
  StepRail,
} from './PulseCheckRuntimeDocPrimitives';

// -----------------------------------------------------------------------------
// Pulse Check Device Registry Spec
//
// Canonical architecture for keeping device integrations organized as the
// ecosystem grows. Device adapters stay vendor-specific; normalized writes,
// source lifecycle, provenance, and Phase J candidate emission share a common
// writer/primitive layer.
// -----------------------------------------------------------------------------

const ADAPTER_SPECIFIC_ROWS = [
  ['Connection mechanism', 'BLE vs OAuth vs native HealthKit vs ANT+ vs WebSocket.', 'Polar BLE uses CoreBluetooth + PolarBleSdk; Oura and Whoop use REST/OAuth; HealthKit is iOS-native.'],
  ['Auth model', 'Pairing, OAuth tokens, platform permissions, or enterprise credentials all behave differently.', 'Polar pairs once; Oura refreshes tokens; HealthKit asks per-permission.'],
  ['SDK surface + vendor quirks', 'Each vendor exposes different APIs, units, and semantics.', 'Polar RR intervals, Whoop strain, Garmin stress arrays, Oura readiness are not interchangeable raw payloads.'],
  ['Available data types', 'Devices do not expose the same signal families.', 'Oura is sleep/recovery-heavy; Polar BLE is live HR/RR; Apple Watch/HealthKit can include workouts and HR.'],
  ['Flush cadence', 'Real-time, polled, delayed sync, or webhook-pushed data require different lifecycle handling.', 'Polar BLE can stream live; Oura syncs on demand; Whoop/Garmin may push or poll depending on partner lane.'],
];

const SHARED_BOUNDARY_ROWS = [
  ['HCSR writes', '`health-context-source-records` writes use one canonical contract.', 'Adapters call a shared writer instead of hand-rolling Firestore payloads.'],
  ['Source status lifecycle', '`health-context-source-status` tracks connection, freshness, error, and permission state consistently.', 'Same status model regardless of device family.'],
  ['Normalized HR sample shape', '`NormalizedHRSample` captures bpm, timestamp, source, confidence, and provenance.', 'A heart-rate sample is a heart-rate sample after normalization.'],
  ['Normalized sleep/recovery/workout shapes', '`NormalizedSleepWindow`, `NormalizedRecoverySnapshot`, `NormalizedWorkoutSession`, and related types are vendor-neutral.', 'The writer consumes normalized shapes, not vendor SDK objects.'],
  ['Phase J primitive accumulator', 'Movement density, accel bursts, rest gaps, HR zones, and coverage are source-agnostic primitives.', 'The accumulator sits above adapters and below session_candidate emission.'],
  ['Audit + provenance writes', 'Every normalized write carries source, adapter, observedAt, ingestedAt, quality, and raw ref when available.', 'Operators can explain what produced every signal.'],
];

const ARCHITECTURE_ROWS = [
  ['Per-device adapter', 'Owns auth, connection, SDK calls, vendor payload parsing, permissions, polling/webhook cadence, and device-specific recovery.', 'Does not own final Firestore HCSR shape or Phase J session meaning.'],
  ['Normalized intermediate types', 'Small typed objects such as NormalizedHRSample, NormalizedMotionSample, NormalizedSleepWindow, NormalizedWorkoutSession.', 'This is the handoff from vendor reality to Pulse reality.'],
  ['Shared HCSR writer', 'Writes health-context-source-records and health-context-source-status with consistent provenance, lifecycle, ids, and audit fields.', 'One writer per platform/runtime: Swift for iOS, TypeScript for web/functions.'],
  ['SessionPrimitiveAccumulator', 'Consumes normalized samples/records from any source and computes HR zones, movement density, accel bursts, rest gaps, step/distance, coverage, and candidate windows.', 'Sits above adapters and does not know vendor APIs.'],
  ['Session candidate emitter', 'Emits Phase J session_candidate with evidence refs, missingContext, confidence, and candidate kinds.', 'Device source is provenance, not the product claim.'],
];

const REGISTRY_SCHEMA_ROWS = [
  ['deviceFamily', '`polar`, `oura`, `apple_health`, `whoop`, `garmin`', 'Stable family id used by adapters, source status, and runtime capability checks.'],
  ['displayName', '`Polar 360 Loop`, `Oura Ring Gen 4`, `Apple Watch Ultra`', 'Human-readable name for admin/reviewer/support surfaces.'],
  ['transport', '`ble`, `oauth-rest`, `oauth-webhook`, `native-healthkit`, `ant-plus`', 'How the integration moves data.'],
  ['authModel', '`ble-pairing`, `oauth-pkce`, `oauth-client-credentials`, `apple-permission`', 'How consent/credentials are established and refreshed.'],
  ['dataTypesProvided', '`[hr_continuous, rr_intervals, sleep, recovery, strain, workouts, hrv, temperature]`', 'Runtime capability list read by primitive accumulator and clarification router.'],
  ['liveStreamingSupported', '`true` / `false`', 'Whether the device can support live or near-live session detection.'],
  ['iOSAdapter', '`PolarBleService.swift`, `HealthDataCollectionService.swift`, or `null`', 'Native adapter owner path when supported.'],
  ['webAdapter', '`polar-sync`, `oura-sync`, webhook function, or `null`', 'Cloud/web adapter owner path when supported.'],
  ['sessionBoundarySource', '`caller-asserted-at-start`, `vendor-classified`, `system-detected-from-primitives`', 'How the system knows a workout/session window exists.'],
  ['phaseJSportFingerprint', '`via-vendor-sport-field`, `via-primitive-extraction`, `via-coach-schedule-only`', 'How sport/session type can be inferred for Phase J.'],
  ['integrationStatus', '`production`, `pilot`, `experimental`, `planned`, `not-supported`', 'Operational rollout status.'],
  ['lastVerifiedAt', 'Timestamp', 'Last time the adapter/capability map was verified.'],
  ['gaps', 'Free text array or markdown', 'Known limitations: missing webhook, scope review, no live stream, no accelerometer, etc.'],
];

const SEED_ROWS = [
  [
    'polar_ble',
    'Polar BLE / Polar 360 Loop',
    'ble',
    'ble-pairing',
    'hr_continuous, rr_intervals, acc_stream, activity_samples, steps',
    'PolarBleService.swift',
    'production/pilot',
    'Live HR works; ACC support exists but must be treated as experimental for lift/activity fingerprints until coverage is validated.',
  ],
  [
    'polar_accesslink',
    'Polar AccessLink',
    'oauth-rest',
    'oauth-pkce',
    'training, activity, cardio_load, sleep/recovery if scopes available',
    'null',
    'pilot',
    'Training payload may be empty until Polar classifies/syncs workouts; useful as post-hoc source, not live truth.',
  ],
  [
    'oura',
    'Oura Ring',
    'oauth-rest',
    'oauth-pkce',
    'sleep, readiness, recovery, hrv, resting_hr, active_energy, steps, workouts when available',
    'null',
    'production/pilot',
    'Strong recovery/sleep lane; weak live workout detection. Can validate session windows but should not own GPS pace or live distance.',
  ],
  [
    'apple_health',
    'Apple HealthKit / Apple Watch',
    'native-healthkit',
    'apple-permission',
    'workouts, hr, steps, distance, active_energy, sleep, hrv depending on permissions',
    'HealthDataCollectionService.swift',
    'production',
    'Permission fragmentation is the main gap. Runtime must read denied/notDetermined states from source status.',
  ],
  [
    'whoop',
    'Whoop',
    'oauth-rest / oauth-webhook',
    'oauth-pkce',
    'strain, recovery, sleep, hr, workouts',
    'null',
    'planned',
    'Scope/partner approval pending. Registry entry should exist before adapter work begins.',
  ],
  [
    'garmin',
    'Garmin',
    'oauth-rest / webhook',
    'oauth-client-credentials or partner OAuth',
    'activities, sleep, hrv/status, stress, training load, recovery, body battery where available',
    'null',
    'planned',
    'Best all-around athlete value but partner access path must be confirmed.',
  ],
];

const RUNTIME_USAGE_ROWS = [
  ['Coach/support asks whether a device is supported', 'Read registry by deviceFamily/status and expose clear supported/pilot/planned state.', 'No guessing from stale code comments.'],
  ['Adapter writes a new signal', 'Look up device capability and write through shared HCSR writer with canonical provenance.', 'Keeps adapter work scoped to extraction.'],
  ['Primitive accumulator builds a candidate', 'Check available dataTypesProvided and liveStreamingSupported before expecting HR, ACC, GPS, or workout windows.', 'Prevents false assumptions about athlete device coverage.'],
  ['Nora clarification router decides what to ask', 'If no live HR and no workout lane, ask for direct self-report sooner; if Polar live HR exists, ask session type instead of HR confidence.', 'Nora asks better questions because she knows source capability.'],
  ['New device onboarding starts', 'Create registry entry first, then adapter, then writer mapping, then test coverage.', 'The registry becomes the architectural map before code spreads.'],
];

const FIRESTORE_CONTRACT_ROWS = [
  ['Collection', '`pulsecheck-device-registry/{deviceFamily}`', 'Runtime-readable registry seeded from code/config, not manually edited in production.'],
  ['Runtime cache', 'Backend and iOS may cache entries by deviceFamily with short TTL.', 'Capability checks should be fast but refreshable.'],
  ['Write ownership', 'Seed script or admin-only ops function.', 'Product runtime reads registry; it does not mutate capability definitions.'],
  ['Drift rule', 'System Overview spec is the contract; Firestore is the runtime instance. Seed process should diff before apply.', 'Prevents hand-edited production drift.'],
  ['Indexing', 'Index integrationStatus, transport, dataTypesProvided if admin/device support surfaces need filtering.', 'Do not over-index until real queries exist.'],
];

const SHARED_MODULE_ROWS = [
  ['iOS', '`HCSRRecordWriter.swift`', 'Writes normalized source records/status from Polar BLE and HealthKit adapters.'],
  ['Web/functions', '`hcsr-record-writer.ts`', 'Writes normalized source records/status from Oura, Polar AccessLink, future Whoop/Garmin/cloud adapters.'],
  ['Shared model names', '`NormalizedHRSample`, `NormalizedMotionSample`, `NormalizedSleepWindow`, `NormalizedRecoverySnapshot`, `NormalizedWorkoutSession`', 'Names should match across Swift and TypeScript even when implementation differs.'],
  ['Adapter contract', '`adapter extracts -> normalizes -> calls writer -> writer persists -> accumulator consumes`', 'No adapter should inline canonical HCSR Firestore writes after the cleanup.'],
];

const BUILD_ORDER = [
  {
    title: 'Ship Device Registry Spec + Runtime Schema',
    owner: 'System Overview + platform',
    body: 'Lock the registry fields, Firestore collection name, status values, runtime usage, and seeded devices before refactoring adapter code.',
  },
  {
    title: 'Seed Current Device Families',
    owner: 'Backend/config',
    body: 'Create registry entries for Polar BLE, Polar AccessLink, Oura, Apple HealthKit, Whoop, and Garmin with explicit status and gaps.',
  },
  {
    title: 'Extract Shared HCSR Writers',
    owner: 'iOS + web/functions',
    body: 'Move inline source-record/status writes into HCSRRecordWriter.swift and hcsr-record-writer.ts. Existing adapters stay vendor-specific.',
  },
  {
    title: 'Introduce Normalized Types',
    owner: 'iOS + web/functions',
    body: 'Add vendor-neutral HR, motion, sleep, recovery, and workout shapes so writers and primitive accumulation do not depend on vendor payloads.',
  },
  {
    title: 'Wire Phase J Primitive Accumulator',
    owner: 'Sports Intelligence',
    body: 'Read normalized output and device capabilities to produce primitives and session_candidate records with honest missingContext.',
  },
  {
    title: 'Add Admin Audit Surface',
    owner: 'Web/admin',
    body: 'Expose registry status, adapter paths, capabilities, source freshness, and gaps so support and engineering can debug missing device data quickly.',
  },
];

const EXIT_CRITERIA = [
  'Every supported/planned device has a registry entry with deviceFamily, transport, authModel, dataTypesProvided, adapter paths, status, and gaps.',
  'No new device adapter may write health-context-source-records directly without going through the shared writer boundary.',
  'Phase J and Nora clarification logic can read device capabilities to decide what evidence should exist and what question to ask.',
  'Registry entries distinguish live streaming, post-hoc cloud sync, platform bridge, and self-report fallback behavior.',
  'Operators can answer "which adapter writes this data type?" and "why is this athlete missing that signal?" from the registry and source status together.',
  'Firestore registry is seeded from code/config with diff/apply behavior so runtime state does not drift from the System Overview contract.',
];

const PulseCheckDeviceRegistrySpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Device Integrations"
        title="Device Registry + Shared Writer Boundary"
        version="Version 0.1 | May 1, 2026"
        summary="Canonical spec for keeping wearable and health-platform integrations organized as PulseCheck scales. Device adapters stay vendor-specific for connection, auth, SDK quirks, and extraction. Shared writer modules own normalized Health Context Source Record writes, source-status lifecycle, provenance, and the handoff into Phase J primitive accumulation."
        highlights={[
          {
            title: 'Adapters Own Vendor Reality',
            body: 'Polar, Oura, HealthKit, Whoop, Garmin, and future devices remain separate where the vendor differences are irreducible: transport, auth, SDK semantics, cadence, and available data.',
          },
          {
            title: 'Writers Own Pulse Reality',
            body: 'After extraction, every adapter crosses the same boundary: normalized types into shared HCSR writers, then source status, provenance, primitive accumulation, and session candidates.',
          },
          {
            title: 'Registry Becomes Runtime Context',
            body: 'The registry is both a System Overview contract and a Firestore runtime capability map so Nora and Phase J know what each athlete device can actually provide.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Device integration control plane: tracks supported device families, adapter ownership, capabilities, gaps, and the shared writer boundary all adapters must use."
        sourceOfTruth="This page owns the registry schema, status vocabulary, per-device adapter vs shared writer split, seeded device inventory, Firestore runtime collection contract, and implementation sequence."
        masterReference="System Overview is the spec source of truth. Firestore `pulsecheck-device-registry` is the runtime instance seeded from code/config. Device adapters consume registry capability definitions but do not mutate them."
        relatedDocs={[
          'Device & Wearable Integrations',
          'Health Context Source Record Spec',
          'Health Context Operational Orchestration Spec',
          'Contextual Detection Engine',
          'Session Detection + Matching',
          'Oura Integration Strategy',
          'Sport Load Model',
        ]}
      />

      <SectionBlock icon={GitBranch} title="Architectural Read">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Per-Device Adapter"
            accent="blue"
            body="Keep Polar BLE, Polar AccessLink, Oura, HealthKit, Whoop, Garmin, and future vendors separate for connection and extraction. Trying to merge these concerns creates a device god-object."
          />
          <InfoCard
            title="Shared Writer Layer"
            accent="green"
            body="Once data is normalized, every adapter should call the same writer boundary. HCSR writes, source status, provenance, and Phase J primitive handoff are Pulse contracts, not vendor contracts."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Plug} title="What Is Device-Specific">
        <DataTable columns={['Concern', 'Why It Varies', 'Example']} rows={ADAPTER_SPECIFIC_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Layers} title="What Is Shared Across Devices">
        <DataTable columns={['Concern', 'Shared Contract', 'Why']} rows={SHARED_BOUNDARY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Adapter -> Writer -> Primitive Architecture">
        <InfoCard
          title="Boundary"
          accent="amber"
          body="Vendor Adapter -> Normalized Types -> HCSRRecordWriter -> SessionPrimitiveAccumulator -> session_candidate. Device source remains provenance; it does not become the product claim."
        />
        <DataTable columns={['Layer', 'Responsibility', 'Constraint']} rows={ARCHITECTURE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Registry Schema">
        <DataTable columns={['Field', 'Example', 'Purpose']} rows={REGISTRY_SCHEMA_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Firestore Runtime Registry">
        <DataTable columns={['Concern', 'Contract', 'Rule']} rows={FIRESTORE_CONTRACT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={RadioTower} title="Initial Seed Inventory">
        <DataTable
          columns={['deviceFamily', 'Display', 'Transport', 'Auth', 'Data Types', 'Primary Adapter', 'Status', 'Gaps']}
          rows={SEED_ROWS}
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Runtime Usage">
        <DataTable columns={['Use Case', 'Registry Role', 'Why It Matters']} rows={RUNTIME_USAGE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Shared Writer Modules">
        <DataTable columns={['Runtime', 'Module', 'Responsibility']} rows={SHARED_MODULE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Build Order">
        <StepRail steps={BUILD_ORDER} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Build Exit Criteria">
        <InfoCard title="Done When" accent="green" body={<BulletList items={EXIT_CRITERIA} />} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckDeviceRegistrySpecTab;
