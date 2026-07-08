const { admin, db, headers, initializeFirebaseAdmin } = require('./config/firebase');
const {
  buildPulseCallbackUrl,
  createClinicalBridge,
  resolveClinicalBridgeConfig,
} = require('./lib/clinical-bridge');

const RESPONSE_HEADERS = {
  ...headers,
  'Content-Type': 'application/json',
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(payload),
  };
}

function getHeader(event, name) {
  const wanted = name.toLowerCase();
  const found = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === wanted);
  return found ? String(found[1] || '') : '';
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function verifyAdminRequest(event) {
  const authHeader = normalizeString(getHeader(event, 'authorization'));
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const decoded = await admin.auth().verifyIdToken(match[1]);
  const email = normalizeString(decoded.email).toLowerCase();
  const hasAdminClaim = decoded.admin === true || decoded.isAdmin === true || decoded.role === 'admin';
  if (hasAdminClaim) return { uid: decoded.uid, email, source: 'claim' };
  if (!email) return null;

  const adminSnap = await db.collection('admin').doc(email).get();
  if (!adminSnap.exists) return null;
  return { uid: decoded.uid, email, source: 'admin_collection' };
}

function buildSyntheticAthlete(input = {}) {
  const suffix = normalizeString(input.externalId || input.pulseUserId || input.userId)
    || `clinical-smoke-${Date.now()}`;
  return {
    externalId: suffix,
    displayName: normalizeString(input.displayName) || 'Clinical Smoke Test Athlete',
    email: normalizeString(input.email) || `${suffix.replace(/[^a-zA-Z0-9._-]/g, '-')}@example.test`,
    organizationId: normalizeString(input.organizationId) || 'pulsecheck-smoke-org',
    teamId: normalizeString(input.teamId) || 'pulsecheck-smoke-team',
  };
}

function buildSyntheticEscalation(input = {}, athlete) {
  const escalationRecordId = normalizeString(input.escalationRecordId) || `clinical-smoke-escalation-${Date.now()}`;
  const tier = Number.isFinite(Number(input.tier)) ? Number(input.tier) : 3;
  return {
    escalationRecordId,
    pulseUserId: athlete.externalId,
    pulseConversationId: normalizeString(input.conversationId) || `clinical-smoke-conversation-${Date.now()}`,
    athlete: {
      userId: athlete.externalId,
      displayName: athlete.displayName,
      email: athlete.email,
    },
    tier,
    category: normalizeString(input.category) || 'clinical_bridge_smoke_test',
    triggerContent: 'Synthetic smoke test handoff. No real patient data.',
    classificationReason: 'Admin-triggered clinical bridge endpoint verification.',
    conversationSummary: 'Synthetic smoke test only. No clinical notes or patient content.',
    relevantMentalNotes: [],
    escalationTimestamp: Date.now(),
    pulseApiCallback: buildPulseCallbackUrl(),
  };
}

function summarizeResult(name, result, startedAt) {
  return {
    name,
    ok: Boolean(result?.ok ?? result?.success),
    success: Boolean(result?.success ?? result?.ok),
    httpStatus: result?.httpStatus || null,
    status: result?.status || result?.data?.status || result?.data?.escalationStatus || null,
    requestId: result?.requestId || null,
    endpoint: result?.endpoint || null,
    durationMs: result?.durationMs ?? (Date.now() - startedAt),
    mock: Boolean(result?.mock),
    data: result?.data || null,
    error: result?.error || null,
  };
}

async function runStep(name, fn) {
  const startedAt = Date.now();
  try {
    return summarizeResult(name, await fn(), startedAt);
  } catch (error) {
    return {
      name,
      ok: false,
      success: false,
      durationMs: Date.now() - startedAt,
      error: {
        code: 'CLINICAL_BRIDGE_STEP_FAILED',
        message: error?.message || 'Clinical bridge smoke test step failed.',
      },
    };
  }
}

async function writeAudit({ adminContext, action, allowWrites, config, results }) {
  try {
    await db.collection('clinical-bridge-smoke-test-runs').add({
      action,
      allowWrites,
      provider: config.provider,
      baseUrl: config.baseUrl,
      mock: config.mock,
      hasApiKey: config.hasApiKey,
      requestedByUid: adminContext.uid || null,
      requestedByEmail: adminContext.email || null,
      requestedBySource: adminContext.source || null,
      resultSummary: results.map((result) => ({
        name: result.name,
        ok: result.ok,
        httpStatus: result.httpStatus || null,
        status: result.status || null,
        requestId: result.requestId || null,
        durationMs: result.durationMs || null,
        mock: Boolean(result.mock),
      })),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtEpoch: Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    console.error('[clinical-bridge-smoke-test] Failed to write audit log:', error);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed' });
  }

  try {
    initializeFirebaseAdmin(event);
    const adminContext = await verifyAdminRequest(event);
    if (!adminContext) {
      return json(401, { success: false, error: 'Admin authentication is required.' });
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const action = normalizeString(body.action || 'health');
    const allowWrites = body.allowWrites === true;
    const bridge = createClinicalBridge();
    const config = resolveClinicalBridgeConfig();
    const athlete = buildSyntheticAthlete(body.athlete || {});
    const escalation = buildSyntheticEscalation(body.escalation || {}, athlete);
    const results = [];

    if (action === 'health' || action === 'smoke-read' || action === 'smoke-write') {
      results.push(await runStep('health', () => bridge.healthCheck()));
    }

    if (action === 'status' || action === 'smoke-read' || action === 'smoke-write') {
      results.push(await runStep('athlete-status', () => bridge.getAthleteStatus(athlete.externalId)));
    }

    if (action === 'care-state' || action === 'smoke-read' || action === 'smoke-write') {
      results.push(await runStep('care-state', () => bridge.getCareState(athlete.externalId)));
    }

    if (action === 'athlete-upsert' || action === 'smoke-write') {
      if (!allowWrites) {
        results.push({
          name: 'athlete-upsert',
          ok: false,
          success: false,
          skipped: true,
          error: { code: 'WRITE_TEST_NOT_ENABLED', message: 'Enable write tests before upserting a clinical athlete.' },
        });
      } else {
        results.push(await runStep('athlete-upsert', () => bridge.upsertAthlete(athlete)));
      }
    }

    if (action === 'escalation-create' || action === 'smoke-write') {
      if (!allowWrites) {
        results.push({
          name: 'escalation-create',
          ok: false,
          success: false,
          skipped: true,
          error: { code: 'WRITE_TEST_NOT_ENABLED', message: 'Enable write tests before creating a clinical escalation.' },
        });
      } else {
        const escalationResult = await runStep('escalation-create', () => bridge.createEscalation(escalation));
        results.push(escalationResult);
        const createdId = escalationResult.data?.escalationId
          || escalationResult.data?.caseId
          || escalationResult.data?.id
          || null;
        if (createdId && (action === 'smoke-write')) {
          results.push(await runStep('resolve-escalation', () => bridge.resolveEscalation(createdId, {
            status: 'resolved',
            coachNote: 'Synthetic smoke test resolved.',
          })));
        }
      }
    }

    if (action === 'resolve') {
      if (!allowWrites) {
        results.push({
          name: 'resolve-escalation',
          ok: false,
          success: false,
          skipped: true,
          error: { code: 'WRITE_TEST_NOT_ENABLED', message: 'Enable write tests before resolving a clinical escalation.' },
        });
      } else {
        results.push(await runStep('resolve-escalation', () => bridge.resolveEscalation(
          normalizeString(body.escalationId || body.escalation?.escalationId),
          { status: normalizeString(body.status) || 'resolved', coachNote: 'Synthetic smoke test resolved.' },
        )));
      }
    }

    if (results.length === 0) {
      return json(400, { success: false, error: `Unsupported smoke test action "${action}".` });
    }

    await writeAudit({ adminContext, action, allowWrites, config, results });

    return json(200, {
      success: results.every((result) => result.ok || result.skipped),
      action,
      allowWrites,
      provider: config.provider,
      baseUrl: config.baseUrl,
      mock: config.mock,
      hasApiKey: config.hasApiKey,
      callbackUrl: buildPulseCallbackUrl(),
      results,
    });
  } catch (error) {
    console.error('[clinical-bridge-smoke-test] Failed:', error);
    return json(500, {
      success: false,
      error: error?.message || 'Clinical bridge smoke test failed.',
    });
  }
};
