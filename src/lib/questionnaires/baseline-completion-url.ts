/** Keep canonical completion in the same hosted release, including branch builds.
 * Never forward an athlete token to a browser-supplied Host or return URL.
 */
const builtOrigin = process.env.PULSECHECK_BASELINE_DEPLOYMENT_ORIGIN;
export function baselineCompletionUrl(env: Record<string, string | undefined> = process.env): string {
  const origin = new URL(env.PULSECHECK_BASELINE_DEPLOYMENT_ORIGIN || builtOrigin || env.DEPLOY_URL || env.DEPLOY_PRIME_URL || env.URL || 'https://fitwithpulse.ai');
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port
    || !(['fitwithpulse.ai', 'quickliftsapp.netlify.app'].includes(origin.hostname)
      || origin.hostname.endsWith('--quickliftsapp.netlify.app'))) throw Error('Baseline completion host is unavailable.');
  return new URL('/.netlify/functions/complete-pulsecheck-baseline', origin.origin).href;
}
