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
    payloadVersion: 'pulse-manas-v1-draft',
    organizationId: athlete.organizationId,
    teamId: athlete.teamId,
    routingContext: {
      organizationId: athlete.organizationId,
      teamId: athlete.teamId,
      environment: 'synthetic_test',
    },
    consentState: {
      status: Number(tier) >= 3 ? 'emergency_safety_basis' : 'pending',
      disclosureVersion: 'clinical-test-unit-v1',
    },
    stateSnapshot: {
      source: 'clinical_test_unit',
      synthetic: true,
      trendSummary: 'Synthetic test scenario. No athlete health data included.',
    },
  };
}

function summarizeResult(name, result, startedAt, request = null) {
  return {
    name,
    ok: Boolean(result?.ok ?? result?.success),
    success: Boolean(result?.success ?? result?.ok),
    httpStatus: result?.httpStatus || null,
    status: result?.status || result?.data?.status || result?.data?.escalationStatus || null,
    requestId: result?.requestId || null,
    clinicalReferenceId: result?.escalationId || result?.data?.escalationId || result?.data?.caseId || null,
    endpoint: result?.endpoint || null,
    durationMs: result?.durationMs ?? (Date.now() - startedAt),
    data: result?.data || null,
    error: result?.error || null,
    request,
  };
}

function buildWriteBlockedResult(name, writeSafety, allowWrites) {
  return {
    name,
    ok: false,
    success: false,
    skipped: true,
    error: allowWrites
      ? {
          code: writeSafety.reason === 'live_key_blocked'
            ? 'LIVE_CLINICAL_WRITE_TEST_BLOCKED'
            : 'CLINICAL_TEST_CREDENTIAL_REQUIRED',
          message: writeSafety.reason === 'live_key_blocked'
            ? 'Synthetic writes are blocked while a live clinical key is active.'
            : 'Configure a MANAS test key before running synthetic writes.',
        }
      : {
          code: 'WRITE_TEST_NOT_ENABLED',
          message: 'Enable synthetic write tests before calling a partner write endpoint.',
        },
  };
}

async function runStep(name, fn, request = null) {
  const startedAt = Date.now();
  try {
    return summarizeResult(name, await fn(), startedAt, request);
  } catch (error) {
    return {
      name,
      ok: false,
      success: false,
      durationMs: Date.now() - startedAt,
      error: {
        code: error?.code || 'CLINICAL_BRIDGE_STEP_FAILED',
        message: error?.message || 'Clinical bridge smoke test step failed.',
      },
      request,
    };
  }
}

function canRunSyntheticWrites(config) {
  if (config.credentialMode === 'test') return { allowed: true, reason: 'test_key' };
  if (config.credentialMode === 'live' && process.env.CLINICAL_BRIDGE_ALLOW_LIVE_SMOKE_TESTS === 'true') {
    return { allowed: true, reason: 'explicit_live_override' };
  }
  if (config.credentialMode === 'live') {
    return { allowed: false, reason: 'live_key_blocked' };
  }
  return { allowed: false, reason: 'test_key_missing' };
}

function normalizeClassificationTier(classification) {
  if (!classification || typeof classification !== 'object') return null;
  if (classification.tier === null || classification.tier === undefined || classification.tier === '') return null;
  const parsed = Number(classification.tier);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(3, Math.max(0, parsed));
}

function buildChatAssistantMessage(tier, outcomeStatus) {
  if (!Number.isFinite(tier)) {
    return 'The production classifier did not return a tier. Review the failed step before continuing.';
  }
  if (tier >= 3) {
    return outcomeStatus === 'handoff_completed'
      ? 'Tier 3 was detected. The synthetic safety handoff reached the clinical bridge.'
      : 'Tier 3 was detected. The synthetic safety handoff path was prepared for review.';
  }
  if (tier === 2) {
    return outcomeStatus === 'consent_required'
      ? 'Tier 2 was detected. The next step is athlete consent before the clinical handoff.'
      : 'Tier 2 was detected. The synthetic consent and handoff path was tested.';
  }
  if (tier === 1) return 'Tier 1 was detected. This route stays with coach review.';
  return 'The message stayed in the normal conversation route.';
}

async function writeAudit({ adminContext, action, allowWrites, config, results }) {
  try {
    await db.collection('clinical-bridge-smoke-test-runs').add({
      action,
      allowWrites,
      provider: config.provider,
      baseUrl: config.baseUrl,
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
    const writeSafety = canRunSyntheticWrites(config);
    const athlete = buildSyntheticAthlete(body.athlete || {});
    const escalation = buildSyntheticEscalation(body.escalation || {}, athlete);
    const results = [];
    let chat = null;

    if (action === 'chat-scenario') {
      const chatInput = body.chat && typeof body.chat === 'object' ? body.chat : {};
      const message = normalizeString(chatInput.message);
      if (!message) {
        return json(400, { success: false, error: 'A synthetic chat message is required.' });
      }

      const recentMessages = Array.isArray(chatInput.recentMessages)
        ? chatInput.recentMessages.slice(-8).map((entry) => ({
            isFromUser: entry?.isFromUser !== false,
            content: normalizeString(entry?.content).slice(0, 1000),
          })).filter((entry) => entry.content)
        : [];
      const expectedTier = Number.isFinite(Number(chatInput.expectedTier))
        ? Math.min(3, Math.max(0, Number(chatInput.expectedTier)))
        : null;
      const conversationId = normalizeString(chatInput.conversationId) || `clinical-test-chat-${Date.now()}`;
      const classifier = require('./pulsecheck-chat').runtimeHelpers?.classifyEscalation;

      if (typeof classifier !== 'function') {
        results.push({
          name: 'chat-classification',
          ok: false,
          success: false,
          error: {
            code: 'CLINICAL_TEST_CLASSIFIER_UNAVAILABLE',
            message: 'The production chat classifier is not available to the test unit.',
          },
        });
      } else {
        const classificationStep = await runStep(
          'chat-classification',
          async () => {
            const classification = await classifier(
              db,
              `clinical-test-${adminContext.uid}`,
              message,
              recentMessages,
              conversationId,
            );
            if (!classification) {
              const error = new Error('The production classifier returned no result. Check the OpenAI key and escalation conditions.');
              error.code = 'CLINICAL_TEST_CLASSIFICATION_EMPTY';
              throw error;
            }
            return { success: true, ok: true, data: classification };
          },
          {
            mode: 'production_classifier_dry_run',
            message,
            expectedTier,
            recentMessageCount: recentMessages.length,
          },
        );
        results.push(classificationStep);

        const classification = classificationStep.ok && classificationStep.data && typeof classificationStep.data === 'object'
          ? classificationStep.data
          : null;
        const actualTier = normalizeClassificationTier(classification);
        let outcome = {
          status: actualTier === null
            ? 'classification_failed'
            : actualTier === 2
              ? 'consent_required'
              : actualTier >= 3
                ? 'dry_run'
                : 'no_partner_handoff',
          consentRequired: actualTier === 2,
          consent: chatInput.consent === true ? 'accepted' : chatInput.consent === false ? 'declined' : 'not_recorded',
          partnerWriteAttempted: false,
          partnerWriteAllowed: writeSafety.allowed,
          handoffStatus: actualTier === null
            ? 'unavailable'
            : actualTier === 2
              ? 'pending_consent'
              : actualTier >= 3
                ? 'ready'
                : 'not_required',
          escalationRecordId: null,
          clinicalReferenceId: null,
        };

        const consentAllowsHandoff = actualTier !== null
          && (actualTier >= 3 || (actualTier === 2 && chatInput.consent === true));
        if (classification && actualTier !== null && actualTier >= 2 && consentAllowsHandoff && allowWrites && writeSafety.allowed) {
          const testEscalation = buildSyntheticEscalation({
            ...(body.escalation || {}),
            tier: actualTier,
            category: normalizeString(classification.category) || 'clinical_test_chat',
            escalationRecordId: normalizeString(body.escalation?.escalationRecordId)
              || `clinical-test-chat-escalation-${Date.now()}`,
          }, athlete);
          testEscalation.triggerContent = message;
          testEscalation.classificationReason = normalizeString(classification.reason) || 'Synthetic chat scenario classification.';
          testEscalation.consentState = {
            ...testEscalation.consentState,
            status: actualTier >= 3 ? 'emergency_safety_basis' : 'opted_in',
            consentedAt: actualTier === 2 ? new Date().toISOString() : null,
          };

          const upsertStep = await runStep(
            'chat-athlete-upsert',
            () => bridge.upsertAthlete(athlete),
            { method: 'POST', endpoint: '/athletes', body: athlete },
          );
          results.push(upsertStep);

          if (upsertStep.ok) {
            const handoffStep = await runStep(
              'chat-escalation-create',
              () => bridge.createEscalation(testEscalation),
              { method: 'POST', endpoint: '/escalations', body: testEscalation },
            );
            results.push(handoffStep);
            outcome = {
              ...outcome,
              status: handoffStep.ok ? 'handoff_completed' : 'handoff_failed',
              partnerWriteAttempted: true,
              handoffStatus: handoffStep.ok ? 'completed' : 'failed',
              escalationRecordId: testEscalation.escalationRecordId,
              clinicalReferenceId: handoffStep.clinicalReferenceId || null,
            };
          } else {
            outcome = {
              ...outcome,
              status: 'athlete_upsert_failed',
              partnerWriteAttempted: true,
              handoffStatus: 'blocked',
            };
          }
        } else if (classification && actualTier !== null && actualTier >= 2 && consentAllowsHandoff && allowWrites && !writeSafety.allowed) {
          results.push(buildWriteBlockedResult('chat-escalation-create', writeSafety, allowWrites));
          outcome = {
            ...outcome,
            status: 'write_blocked',
            handoffStatus: 'blocked',
          };
        } else if (actualTier === 2 && chatInput.consent === false) {
          outcome = {
            ...outcome,
            status: 'consent_declined',
            handoffStatus: 'declined',
          };
        }

        chat = {
          message,
          assistantMessage: buildChatAssistantMessage(actualTier, outcome.status),
          expectedTier,
          actualTier,
          matchedExpectation: expectedTier === null || actualTier === null ? null : expectedTier === actualTier,
          classification,
          outcome,
        };
      }
    }

    if (action === 'health' || action === 'smoke-read' || action === 'smoke-write') {
      results.push(await runStep('health', () => bridge.healthCheck(), { method: 'GET', endpoint: '/health' }));
    }

    if (action === 'status' || action === 'smoke-read' || action === 'smoke-write') {
      results.push(await runStep(
        'athlete-status',
        () => bridge.getAthleteStatus(athlete.externalId),
        { method: 'GET', endpoint: `/athletes/${encodeURIComponent(athlete.externalId)}/status` },
      ));
    }

    if (action === 'care-state' || action === 'smoke-read' || action === 'smoke-write') {
      results.push(await runStep(
        'care-state',
        () => bridge.getCareState(athlete.externalId),
        { method: 'GET', endpoint: `/athletes/${encodeURIComponent(athlete.externalId)}/care-state` },
      ));
    }

    if (action === 'athlete-upsert' || action === 'smoke-write') {
      if (!allowWrites || !writeSafety.allowed) {
        results.push(buildWriteBlockedResult('athlete-upsert', writeSafety, allowWrites));
      } else {
        results.push(await runStep(
          'athlete-upsert',
          () => bridge.upsertAthlete(athlete),
          { method: 'POST', endpoint: '/athletes', body: athlete },
        ));
      }
    }

    if (action === 'escalation-create' || action === 'smoke-write') {
      if (!allowWrites || !writeSafety.allowed) {
        results.push(buildWriteBlockedResult('escalation-create', writeSafety, allowWrites));
      } else {
        const escalationResult = await runStep(
          'escalation-create',
          () => bridge.createEscalation(escalation),
          { method: 'POST', endpoint: '/escalations', body: escalation },
        );
        results.push(escalationResult);
        const createdId = escalationResult.clinicalReferenceId
          || escalationResult.data?.escalationId
          || escalationResult.data?.caseId
          || escalationResult.data?.id
          || null;
        if (createdId && (action === 'smoke-write')) {
          const resolution = { status: 'resolved', coachNote: 'Synthetic smoke test resolved.' };
          results.push(await runStep(
            'resolve-escalation',
            () => bridge.resolveEscalation(createdId, resolution),
            { method: 'POST', endpoint: `/escalations/${encodeURIComponent(createdId)}/resolve`, body: resolution },
          ));
        }
      }
    }

    if (action === 'resolve') {
      if (!allowWrites || !writeSafety.allowed) {
        results.push(buildWriteBlockedResult('resolve-escalation', writeSafety, allowWrites));
      } else {
        const requestedId = normalizeString(body.escalationId || body.escalation?.escalationId);
        const resolution = { status: normalizeString(body.status) || 'resolved', coachNote: 'Synthetic smoke test resolved.' };
        results.push(await runStep(
          'resolve-escalation',
          () => bridge.resolveEscalation(requestedId, resolution),
          { method: 'POST', endpoint: `/escalations/${encodeURIComponent(requestedId)}/resolve`, body: resolution },
        ));
      }
    }

    if (results.length === 0) {
      return json(400, { success: false, error: `Unsupported smoke test action "${action}".` });
    }

    await writeAudit({ adminContext, action, allowWrites, config, results });

    return json(200, {
      success: results.every((result) => result.ok || (result.skipped && !allowWrites)),
      action,
      allowWrites,
      provider: config.provider,
      baseUrl: config.baseUrl,
      hasApiKey: config.hasApiKey,
      credentialMode: config.credentialMode,
      writeSafety,
      callbackUrl: buildPulseCallbackUrl(),
      chat,
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

exports.__test = {
  buildChatAssistantMessage,
  buildSyntheticAthlete,
  buildSyntheticEscalation,
  buildWriteBlockedResult,
  canRunSyntheticWrites,
  normalizeClassificationTier,
  summarizeResult,
};
