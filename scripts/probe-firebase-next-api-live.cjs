const BASE_URL = (process.env.SMOKE_BASE_URL || 'https://fitwithpulse.ai').replace(/\/+$/, '');

const PROBES = [
  { path: '/api/admin/group-meet', method: 'GET' },
  { path: '/api/admin/group-meet/request-smoke', method: 'GET' },
  { path: '/api/admin/group-meet/request-smoke/finalize', method: 'GET' },
  { path: '/api/admin/group-meet/request-smoke/invites/token-smoke/resend', method: 'GET' },
  { path: '/api/admin/group-meet/request-smoke/recommend', method: 'GET' },
  { path: '/api/admin/group-meet/request-smoke/schedule', method: 'GET' },
  { path: '/api/admin/group-meet/contacts', method: 'GET' },
  { path: '/api/admin/pulsecheck/pilot-research-readout/generate', method: 'GET' },
  { path: '/api/admin/pulsecheck/pilot-research-readout/review', method: 'GET' },
  { path: '/api/admin/system-overview/share-links', method: 'GET' },
  { path: '/api/admin/system-overview/share-links/token-smoke', method: 'GET' },
  { path: '/api/agent/kickoff-mission', method: 'GET' },
  { path: '/api/backfill-badges', method: 'GET' },
  { path: '/api/group-meet/token-smoke', method: 'GET' },
  { path: '/api/invest/analytics', method: 'GET' },
  { path: '/api/invest/record-view', method: 'GET' },
  { path: '/api/migrate/fitness-seeker-leads', method: 'GET' },
  { path: '/api/outreach/activate-campaign', method: 'GET' },
  { path: '/api/outreach/add-leads', method: 'GET' },
  { path: '/api/outreach/create', method: 'GET' },
  { path: '/api/outreach/create-campaign', method: 'GET' },
  { path: '/api/outreach/deploy-campaign', method: 'GET' },
  { path: '/api/outreach/sync-campaign-settings', method: 'GET' },
  { path: '/api/pitch/analytics', method: 'GET' },
  { path: '/api/pitch/record-view', method: 'GET' },
  { path: '/api/pulsecheck/admin-activation/redeem', method: 'GET' },
  { path: '/api/pulsecheck/team-invite/redeem', method: 'GET' },
  { path: '/api/reset-badges', method: 'GET' },
  { path: '/api/review/capture-reply', method: 'GET' },
  { path: '/api/review/send-draft-reminder', method: 'GET' },
  { path: '/api/shared/system-overview/token-smoke/unlock', method: 'GET' },
  { path: '/api/surveys/notify-completed', method: 'GET' },
  { path: '/api/wunna-run/analytics', method: 'GET' },
  { path: '/api/wunna-run/record-view', method: 'GET' },
];

function isHtml(contentType = '', body = '') {
  return contentType.toLowerCase().includes('text/html')
    || /^<!doctype html/i.test(body.trim());
}

async function runProbe(probe) {
  const response = await fetch(`${BASE_URL}${probe.path}`, {
    method: probe.method,
    headers: {
      Accept: 'application/json',
      'x-smoke-probe': 'firebase-next-api-live',
    },
  });

  const body = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const ok = response.status < 500 && !isHtml(contentType, body);

  return {
    ...probe,
    status: response.status,
    contentType,
    ok,
    preview: body.slice(0, 180).replace(/\s+/g, ' ').trim(),
  };
}

async function main() {
  console.log(`[probe-firebase-next-api-live] Base URL: ${BASE_URL}`);

  const results = [];
  for (const probe of PROBES) {
    const result = await runProbe(probe);
    results.push(result);
    console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.method} ${result.path} -> ${result.status} ${result.contentType || 'no-content-type'}`);
  }

  const failures = results.filter((result) => !result.ok);
  if (failures.length > 0) {
    console.log('');
    console.log('[probe-firebase-next-api-live] Failures');
    for (const failure of failures) {
      console.log(`- ${failure.method} ${failure.path} -> ${failure.status} ${failure.contentType || 'no-content-type'}`);
      console.log(`  preview: ${failure.preview}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log(`[probe-firebase-next-api-live] ${results.length}/${results.length} probes passed`);
}

main().catch((error) => {
  console.error('[probe-firebase-next-api-live] Failed:', error);
  process.exitCode = 1;
});
