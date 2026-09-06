const { AuntEdnaClinicalBridge } = require('./clinical-bridge');

// Always isolated: caller supplies neither credentials nor a network transport.
async function runClinicalBridgeContractSimulation() {
  const requests = [];
  const baseUrl = 'https://clinical-partner.invalid';
  const key = 'synthetic-contract-key';
  const bridge = new AuntEdnaClinicalBridge({ provider: 'auntedna', baseUrl, apiKey: key, timeoutMs: 1000 }, async (url, options) => {
    const path = new URL(url).pathname;
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ path, method: options.method, authenticated: options.headers.Authorization === `Bearer ${key}`, integrationHeader: options.headers['X-Pulse-Integration'] === 'true', body });
    if (!url.startsWith(`${baseUrl}/`)) throw new Error('Unexpected destination');
    return new Response(JSON.stringify({ success: true, data: path === '/escalations' ? { escalationId: 'synthetic-clinical-reference', status: 'received' } : { status: 'received', watchListActive: false } }), { status: 200 });
  });
  const checks = [];
  const record = (name, passed) => checks.push({ name, passed: !!passed });
  try {
    const health = await bridge.healthCheck();
    record('Health request uses GET without a partner credential', health.success && requests.at(-1).path === '/health' && !requests.at(-1).authenticated);
    await bridge.upsertAthlete({ externalId: 'synthetic-athlete', organizationId: 'synthetic-org' });
    record('Athlete registration uses the expected authenticated payload', requests.at(-1).path === '/athletes' && requests.at(-1).method === 'POST' && requests.at(-1).body.externalId === 'synthetic-athlete' && requests.at(-1).authenticated);
    const result = await bridge.createEscalation({ escalationRecordId: 'synthetic-escalation', pulseUserId: 'synthetic-athlete', pulseApiCallback: 'https://pulse-callback.invalid/clinical-callback', consentState: { status: 'opted_in' }, conversationSummary: 'Synthetic clinical summary' });
    record('Escalation includes its stable reference, callback and consent', requests.at(-1).path === '/escalations' && requests.at(-1).method === 'POST' && requests.at(-1).authenticated && requests.at(-1).body.escalationRecordId === 'synthetic-escalation' && requests.at(-1).body.pulseApiCallback === 'https://pulse-callback.invalid/clinical-callback' && requests.at(-1).body.consentState.status === 'opted_in');
    record('Partner receipt exposes the clinical reference', result.success && result.escalationId === 'synthetic-clinical-reference');
    await bridge.getAthleteStatus('synthetic-athlete');
    record('Athlete-status request uses the expected route', requests.at(-1).path === '/athletes/synthetic-athlete/status' && requests.at(-1).method === 'GET' && requests.at(-1).authenticated);
    await bridge.getCareState('synthetic-athlete');
    record('Care-state request uses the expected route', requests.at(-1).path === '/athletes/synthetic-athlete/care-state' && requests.at(-1).method === 'GET' && requests.at(-1).authenticated);
    await bridge.resolveEscalation('synthetic-clinical-reference');
    record('Resolution uses the returned reference', requests.at(-1).path === '/escalations/synthetic-clinical-reference/resolve' && requests.at(-1).method === 'POST' && requests.at(-1).body.status === 'resolved');
    record('Integration header is present on every request', requests.every(r => r.integrationHeader));
    const failed = new AuntEdnaClinicalBridge({ baseUrl, apiKey: key, timeoutMs: 1000 }, async () => new Response(JSON.stringify({ success: true, data: {} }), { status: 503 }));
    record('Partner outage cannot become a successful handoff', !(await failed.createEscalation({ escalationRecordId: 'synthetic-failure' })).success);
    let blocked = false;
    const unconfigured = new AuntEdnaClinicalBridge({ baseUrl, apiKey: '', timeoutMs: 1000 }, async () => { throw new Error('Transport should not run'); });
    try { await unconfigured.createEscalation({ escalationRecordId: 'synthetic-no-key' }); } catch (e) { blocked = e.code === 'CLINICAL_BRIDGE_API_KEY_MISSING'; }
    record('Real bridge still blocks missing credentials', blocked);
  } catch { record('Bridge contract execution completed', false); }
  return { mode: 'mock_partner', verdict: checks.every(c => c.passed) ? 'pass' : 'fail', note: 'Simulation pass means the existing bridge formed and handled requests against a mock partner. No live API call or clinical storage occurred. Live readiness still requires credentials, callback configuration, partner contract verification and an end-to-end test.', requestCount: requests.length, checks };
}
module.exports = { runClinicalBridgeContractSimulation };
