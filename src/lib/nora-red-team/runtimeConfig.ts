// Shared by Next routes and Netlify workers, where public build variables may be absent.
export function resolveNoraFirebaseApiKey(dev: boolean, env: Record<string, string | undefined> = process.env): string {
  const keys = dev
    ? [env.DEV_FIREBASE_WEB_API_KEY, env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY]
    : [env.FIREBASE_WEB_API_KEY, env.NEXT_PUBLIC_FIREBASE_API_KEY];
  return keys.map(key => key?.trim()).find(key => key && key !== 'local-preview-placeholder') || '';
}

export function resolveNoraRuntimeOrigin(env: Record<string, string | undefined> = process.env): string {
  const origin = env.NORA_RED_TEAM_STAGING_CHAT_ORIGIN
    || env.PULSECHECK_LOCAL_FUNCTIONS_ORIGIN
    || env.URL
    || env.NEXT_PUBLIC_SITE_URL
    || 'https://fitwithpulse.ai';
  const url = new URL(origin);
  if (url.username || url.password || (url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw new Error('APP_RUNTIME_UNAVAILABLE: Use HTTPS or a loopback development endpoint.');
  }
  return url.origin;
}
