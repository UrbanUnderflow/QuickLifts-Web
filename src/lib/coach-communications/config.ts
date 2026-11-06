import { athleticMindTelnyxProfile } from './account-profile';
/** Compact non-secret settings keep legacy Lambda deployments below their 4 KB
 * environment limit. The API key remains a separate server-side secret. */
const fields = {
  COACH_COMMUNICATIONS_SMS_PROVIDER: 'p',
  COACH_COMMUNICATIONS_FIREBASE_MODE: 'm',
  COACH_COMMUNICATIONS_SMS_ENABLED: 's',
  COACH_COMMUNICATIONS_WORKER_ENABLED: 'w',
  COACH_COMMUNICATIONS_SMS_WEBHOOK_ENABLED: 'h',
  COACH_COMMUNICATIONS_REQUIRE_RECORDED_CONSENT: 'c',
  COACH_COMMUNICATIONS_TELNYX_WEBHOOK_URL: 'u',
  TELNYX_FROM_NUMBER: 'n',
  TELNYX_MESSAGING_PROFILE_ID: 'id',
  TELNYX_PUBLIC_KEY: 'k',
} as const;
type Setting = keyof typeof fields;
const gates = new Set<Setting>(['COACH_COMMUNICATIONS_SMS_ENABLED', 'COACH_COMMUNICATIONS_WORKER_ENABLED', 'COACH_COMMUNICATIONS_SMS_WEBHOOK_ENABLED', 'COACH_COMMUNICATIONS_REQUIRE_RECORDED_CONSENT']);

export function communicationSetting(name: Setting): string | undefined {
  // Even an explicitly empty/false legacy value overrides compact settings.
  if (process.env[name] !== undefined) return process.env[name];
  try {
    const config = JSON.parse(process.env.COACH_SMS_CONFIG || '{}');
    if (!config || typeof config !== 'object' || Array.isArray(config)) return undefined;
    const field = fields[name];
    // A known profile supplies only public account data. Provider, database
    // environment, and all activation gates still require explicit settings.
    const profile = config.account === 'athleticmind' ? athleticMindTelnyxProfile : undefined;
    const value = Object.prototype.hasOwnProperty.call(config, field)
      ? config[field]
      : profile && Object.prototype.hasOwnProperty.call(profile, field)
        ? profile[field as keyof typeof profile]
        : undefined;
    if (gates.has(name)) return value === true ? 'true' : value === false ? 'false' : undefined;
    return typeof value === 'string' ? value : undefined;
  } catch { return undefined; }
}
