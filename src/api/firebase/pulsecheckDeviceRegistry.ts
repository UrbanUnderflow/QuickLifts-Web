// =============================================================================
// PulseCheck Device Registry - Runtime Contract
//
// Phase 1 foundation for the Firestore-backed device capability map. Device
// adapters own vendor-specific connection/auth/extraction; this registry owns
// the shared runtime vocabulary used by support, HCSR writers, Nora, and Phase J.
// =============================================================================

export const PULSECHECK_DEVICE_REGISTRY_COLLECTION = 'pulsecheck-device-registry';

export const PULSECHECK_DEVICE_REGISTRY_CONTRACT_VERSION = 'pulsecheck-device-registry-v0.1';

export type PulseCheckDeviceFamily =
  | 'polar_ble'
  | 'polar_accesslink'
  | 'fitbit'
  | 'oura'
  | 'apple_health'
  | 'whoop'
  | 'garmin';

export type PulseCheckDeviceTransport =
  | 'ble'
  | 'oauth-rest'
  | 'oauth-webhook'
  | 'native-healthkit'
  | 'ant-plus';

export type PulseCheckDeviceAuthModel =
  | 'ble-pairing'
  | 'oauth-pkce'
  | 'oauth-client-credentials'
  | 'apple-permission'
  | 'partner-oauth';

export type PulseCheckDeviceRegistryDataType =
  | 'hr_continuous'
  | 'rr_intervals'
  | 'acc_stream'
  | 'activity_samples'
  | 'steps'
  | 'distance'
  | 'active_energy'
  | 'active_minutes'
  | 'active_zone_minutes'
  | 'activity'
  | 'training'
  | 'workouts'
  | 'sleep'
  | 'recovery'
  | 'readiness'
  | 'hrv'
  | 'resting_hr'
  | 'oxygen_saturation'
  | 'respiratory_rate'
  | 'temperature'
  | 'vo2_max'
  | 'body_weight'
  | 'body_fat'
  | 'cardio_load'
  | 'strain'
  | 'stress'
  | 'training_load'
  | 'body_battery';

export type PulseCheckDeviceSessionBoundarySource =
  | 'caller-asserted-at-start'
  | 'vendor-classified'
  | 'platform-workout-event'
  | 'system-detected-from-primitives'
  | 'post-hoc-cloud-sync';

export type PulseCheckDevicePhaseJSportFingerprint =
  | 'via-vendor-sport-field'
  | 'via-healthkit-workout-type'
  | 'via-primitive-extraction'
  | 'via-coach-schedule-only'
  | 'limited';

export type PulseCheckDeviceIntegrationStatus =
  | 'production'
  | 'pilot'
  | 'experimental'
  | 'planned'
  | 'not-supported';

/**
 * Canonical lifecycle states written to `health-context-source-status/{userId}_{deviceFamily}`.
 *
 * Doctrine for BLE-transport devices:
 *   - 'connected_synced'           → bond is live, data is flowing
 *   - 'connected_waiting_data'     → bond is live, no payload yet (e.g., no session started)
 *   - 'connected_error'            → transient SDK or upstream error
 *   - 'not_connected'              → never paired (cold state)
 *   - 'pairing_lost'               → was paired before, OS bond was wiped (athlete used iOS
 *                                    Settings → Forget This Device, or a phone restart broke the
 *                                    bond). Triggers the BLE reconnect modal on next foreground.
 *   - 'pairing_lost_dismissed'     → athlete saw the modal and tapped "Skip for now". Don't
 *                                    re-prompt until the next pairing attempt or session start.
 *
 * For OAuth-transport devices, only `connected_synced`, `connected_waiting_data`,
 * `connected_error`, and `not_connected` apply — there's no BLE bond to lose.
 */
export type PulseCheckDeviceLifecycleState =
  | 'connected_synced'
  | 'connected_waiting_data'
  | 'connected_error'
  | 'not_connected'
  | 'pairing_lost'
  | 'pairing_lost_dismissed';

export const PULSECHECK_DEVICE_LIFECYCLE_STATES: PulseCheckDeviceLifecycleState[] = [
  'connected_synced',
  'connected_waiting_data',
  'connected_error',
  'not_connected',
  'pairing_lost',
  'pairing_lost_dismissed',
];

/**
 * The lifecycle states that should trigger the BLE reconnect modal on the
 * next iOS app foreground. `pairing_lost_dismissed` is intentionally
 * excluded — it signals the athlete acknowledged the modal and chose to
 * defer reconnection.
 */
export const PULSECHECK_DEVICE_RECONNECT_PROMPT_STATES: PulseCheckDeviceLifecycleState[] = [
  'pairing_lost',
];

export interface PulseCheckDeviceRegistryEntry {
  deviceFamily: PulseCheckDeviceFamily;
  displayName: string;
  transport: PulseCheckDeviceTransport;
  authModel: PulseCheckDeviceAuthModel;
  dataTypesProvided: PulseCheckDeviceRegistryDataType[];
  liveStreamingSupported: boolean;
  iOSAdapter: string | null;
  webAdapter: string | null;
  sessionBoundarySource: PulseCheckDeviceSessionBoundarySource;
  phaseJSportFingerprint: PulseCheckDevicePhaseJSportFingerprint;
  integrationStatus: PulseCheckDeviceIntegrationStatus;
  lastVerifiedAt: string;
  gaps: string[];
  contractVersion: typeof PULSECHECK_DEVICE_REGISTRY_CONTRACT_VERSION;
}

export const PULSECHECK_DEVICE_REGISTRY_DEVICE_FAMILIES: PulseCheckDeviceFamily[] = [
  'polar_ble',
  'polar_accesslink',
  'fitbit',
  'oura',
  'apple_health',
  'whoop',
  'garmin',
];

export const PULSECHECK_DEVICE_REGISTRY_INTEGRATION_STATUSES: PulseCheckDeviceIntegrationStatus[] = [
  'production',
  'pilot',
  'experimental',
  'planned',
  'not-supported',
];

export const PULSECHECK_DEVICE_REGISTRY_DATA_TYPES: PulseCheckDeviceRegistryDataType[] = [
  'hr_continuous',
  'rr_intervals',
  'acc_stream',
  'activity_samples',
  'steps',
  'distance',
  'active_energy',
  'active_minutes',
  'active_zone_minutes',
  'activity',
  'training',
  'workouts',
  'sleep',
  'recovery',
  'readiness',
  'hrv',
  'resting_hr',
  'oxygen_saturation',
  'respiratory_rate',
  'temperature',
  'vo2_max',
  'body_weight',
  'body_fat',
  'cardio_load',
  'strain',
  'stress',
  'training_load',
  'body_battery',
];

const VERIFIED_AT = '2026-05-01T00:00:00.000Z';

const registryEntry = (
  input: Omit<PulseCheckDeviceRegistryEntry, 'contractVersion' | 'lastVerifiedAt'> & {
    lastVerifiedAt?: string;
  },
): PulseCheckDeviceRegistryEntry => ({
  ...input,
  lastVerifiedAt: input.lastVerifiedAt || VERIFIED_AT,
  contractVersion: PULSECHECK_DEVICE_REGISTRY_CONTRACT_VERSION,
});

export const PULSECHECK_DEVICE_REGISTRY_SEED_ENTRIES: PulseCheckDeviceRegistryEntry[] = [
  registryEntry({
    deviceFamily: 'polar_ble',
    displayName: 'Polar BLE / Polar 360 Loop',
    transport: 'ble',
    authModel: 'ble-pairing',
    dataTypesProvided: ['hr_continuous', 'rr_intervals', 'acc_stream', 'activity_samples', 'steps'],
    liveStreamingSupported: true,
    iOSAdapter: 'PolarBleService.swift',
    webAdapter: null,
    sessionBoundarySource: 'system-detected-from-primitives',
    phaseJSportFingerprint: 'via-primitive-extraction',
    integrationStatus: 'pilot',
    gaps: [
      'ACC support must remain experimental for lift/activity fingerprints until athlete-session coverage is validated.',
      'BLE availability depends on local pairing, battery state, and foreground/background runtime constraints.',
    ],
  }),
  registryEntry({
    deviceFamily: 'polar_accesslink',
    displayName: 'Polar AccessLink',
    transport: 'oauth-rest',
    authModel: 'oauth-pkce',
    dataTypesProvided: ['training', 'activity', 'cardio_load', 'sleep', 'recovery'],
    liveStreamingSupported: false,
    iOSAdapter: null,
    webAdapter: 'polar-accesslink-sync',
    sessionBoundarySource: 'vendor-classified',
    phaseJSportFingerprint: 'via-vendor-sport-field',
    integrationStatus: 'pilot',
    gaps: [
      'Training payloads may be delayed or empty until Polar classifies and syncs workouts.',
      'Useful as a post-hoc source, not live session truth.',
    ],
  }),
  registryEntry({
    deviceFamily: 'fitbit',
    displayName: 'Fitbit / Google Health',
    transport: 'oauth-webhook',
    authModel: 'oauth-pkce',
    dataTypesProvided: [
      'steps',
      'distance',
      'active_energy',
      'active_minutes',
      'active_zone_minutes',
      'activity',
      'workouts',
      'training',
      'sleep',
      'recovery',
      'hrv',
      'resting_hr',
      'oxygen_saturation',
      'respiratory_rate',
      'temperature',
      'vo2_max',
      'body_weight',
      'body_fat',
    ],
    liveStreamingSupported: false,
    iOSAdapter: null,
    webAdapter: 'google-health-sync',
    sessionBoundarySource: 'post-hoc-cloud-sync',
    phaseJSportFingerprint: 'via-vendor-sport-field',
    integrationStatus: 'pilot',
    lastVerifiedAt: '2026-05-26T00:00:00.000Z',
    gaps: [
      'Fitbit data arrives after the wearable syncs into Google Health, so it should not be treated as live Phase J evidence.',
      'Webhook notifications queue refresh work; snapshot projection still depends on a successful Google Health read using the athlete consent scopes.',
    ],
  }),
  registryEntry({
    deviceFamily: 'oura',
    displayName: 'Oura Ring',
    transport: 'oauth-rest',
    authModel: 'oauth-pkce',
    dataTypesProvided: [
      'sleep',
      'readiness',
      'recovery',
      'hrv',
      'resting_hr',
      'temperature',
      'active_energy',
      'steps',
      'workouts',
    ],
    liveStreamingSupported: false,
    iOSAdapter: null,
    webAdapter: 'oura-sync',
    sessionBoundarySource: 'post-hoc-cloud-sync',
    phaseJSportFingerprint: 'via-coach-schedule-only',
    integrationStatus: 'production',
    gaps: [
      'Strong recovery and sleep lane; weak live workout detection.',
      'Can validate session windows but should not own GPS pace, lift boundaries, or live distance.',
    ],
  }),
  registryEntry({
    deviceFamily: 'apple_health',
    displayName: 'Apple Health / HealthKit',
    transport: 'native-healthkit',
    authModel: 'apple-permission',
    dataTypesProvided: ['workouts', 'hr_continuous', 'steps', 'distance', 'active_energy', 'sleep', 'hrv'],
    liveStreamingSupported: false,
    iOSAdapter: 'HealthDataCollectionService.swift',
    webAdapter: null,
    sessionBoundarySource: 'platform-workout-event',
    phaseJSportFingerprint: 'via-healthkit-workout-type',
    integrationStatus: 'production',
    gaps: [
      'Permission fragmentation is the main runtime gap.',
      'Registry consumers must pair this capability map with source-status permission states before assuming coverage.',
    ],
  }),
  registryEntry({
    deviceFamily: 'whoop',
    displayName: 'Whoop',
    transport: 'oauth-webhook',
    authModel: 'oauth-pkce',
    dataTypesProvided: ['strain', 'recovery', 'sleep', 'hr_continuous', 'workouts'],
    liveStreamingSupported: false,
    iOSAdapter: 'CloudFunctionsService.swift / WearablePickerSheet + NoraOnboardingView (PulseCheck), QuickLiftsWearableConnectionsView (QuickLifts)',
    webAdapter: 'whoop-sync',
    sessionBoundarySource: 'vendor-classified',
    phaseJSportFingerprint: 'via-vendor-sport-field',
    integrationStatus: 'experimental',
    gaps: [
      'Credentials verified 2026-07-02: client id checked in, redirect URI registered with WHOOP, WHOOP_CLIENT_SECRET readable from Google Secret Manager in production (webhook signing uses the client secret per WHOOP design — no separate webhook secret exists). Remaining: register the webhook URL in the WHOOP Developer Dashboard and obtain WHOOP app approval for use beyond the developer app cap.',
      'Webhook reconciliation worker must promote queued webhook sync jobs into scheduled whoop-sync executions.',
    ],
  }),
  registryEntry({
    deviceFamily: 'garmin',
    displayName: 'Garmin',
    transport: 'oauth-webhook',
    authModel: 'oauth-client-credentials',
    dataTypesProvided: [
      'activity',
      'workouts',
      'sleep',
      'hrv',
      'stress',
      'training_load',
      'recovery',
      'body_battery',
    ],
    liveStreamingSupported: false,
    iOSAdapter: null,
    webAdapter: 'garmin-sync',
    sessionBoundarySource: 'vendor-classified',
    phaseJSportFingerprint: 'via-vendor-sport-field',
    integrationStatus: 'planned',
    gaps: [
      'Best all-around athlete value, but partner access path must be confirmed.',
      'Field availability varies by Garmin program, device model, and permission scope.',
    ],
  }),
];

export const getPulseCheckDeviceRegistryEntryByFamily = (
  deviceFamily: PulseCheckDeviceFamily,
): PulseCheckDeviceRegistryEntry | null =>
  PULSECHECK_DEVICE_REGISTRY_SEED_ENTRIES.find((entry) => entry.deviceFamily === deviceFamily) || null;

export const getPulseCheckDeviceRegistryEntriesByStatus = (
  integrationStatus: PulseCheckDeviceIntegrationStatus,
): PulseCheckDeviceRegistryEntry[] =>
  PULSECHECK_DEVICE_REGISTRY_SEED_ENTRIES.filter((entry) => entry.integrationStatus === integrationStatus);

export const getPulseCheckDeviceRegistryEntriesByDataType = (
  dataType: PulseCheckDeviceRegistryDataType,
): PulseCheckDeviceRegistryEntry[] =>
  PULSECHECK_DEVICE_REGISTRY_SEED_ENTRIES.filter((entry) => entry.dataTypesProvided.includes(dataType));

/**
 * Returns every device family in the registry that uses a BLE-class
 * transport (currently `'ble'`; in the future could include `'ant-plus'`
 * if we ship sensor support that needs the same disconnect-recovery UX).
 *
 * The BLE disconnect monitor on iOS uses this to know which source-status
 * docs to watch and which modal copy to render.
 */
export const getPulseCheckDeviceRegistryBleEntries = (): PulseCheckDeviceRegistryEntry[] =>
  PULSECHECK_DEVICE_REGISTRY_SEED_ENTRIES.filter((entry) => entry.transport === 'ble');

export const isPulseCheckDeviceLifecycleState = (
  value: unknown,
): value is PulseCheckDeviceLifecycleState =>
  typeof value === 'string' &&
  PULSECHECK_DEVICE_LIFECYCLE_STATES.includes(value as PulseCheckDeviceLifecycleState);

export const isPulseCheckDeviceReconnectPromptState = (
  value: unknown,
): value is PulseCheckDeviceLifecycleState =>
  typeof value === 'string' &&
  PULSECHECK_DEVICE_RECONNECT_PROMPT_STATES.includes(value as PulseCheckDeviceLifecycleState);

export const isPulseCheckDeviceFamily = (value: unknown): value is PulseCheckDeviceFamily =>
  typeof value === 'string' && PULSECHECK_DEVICE_REGISTRY_DEVICE_FAMILIES.includes(value as PulseCheckDeviceFamily);

export const isPulseCheckDeviceIntegrationStatus = (
  value: unknown,
): value is PulseCheckDeviceIntegrationStatus =>
  typeof value === 'string' &&
  PULSECHECK_DEVICE_REGISTRY_INTEGRATION_STATUSES.includes(value as PulseCheckDeviceIntegrationStatus);

export const isPulseCheckDeviceRegistryDataType = (
  value: unknown,
): value is PulseCheckDeviceRegistryDataType =>
  typeof value === 'string' &&
  PULSECHECK_DEVICE_REGISTRY_DATA_TYPES.includes(value as PulseCheckDeviceRegistryDataType);
