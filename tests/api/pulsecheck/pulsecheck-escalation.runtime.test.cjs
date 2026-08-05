const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';
const escalationPath = path.join(repoRoot, 'netlify/functions/pulsecheck-escalation.js');
const configPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');
const pilotMetricsPath = path.join(repoRoot, 'netlify/functions/utils/pulsecheck-pilot-metrics.js');

function loadEscalationModule({
  runtimeDb,
  decoded = { uid: 'athlete-1' },
  verifyError = null,
} = {}) {
  delete require.cache[escalationPath];
  delete require.cache[configPath];
  delete require.cache[pilotMetricsPath];

  const fallbackDb = runtimeDb || {
    collection() {
      throw new Error('This test should return before Firestore access.');
    },
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      initializeFirebaseAdmin: () => {},
      db: fallbackDb,
      headers: {},
      admin: {
        auth: () => ({
          verifyIdToken: async () => {
            if (verifyError) throw verifyError;
            return decoded;
          },
        }),
        firestore: {
          FieldValue: {
            serverTimestamp: () => 'server-timestamp',
          },
        },
      },
    },
  };

  require.cache[pilotMetricsPath] = {
    id: pilotMetricsPath,
    filename: pilotMetricsPath,
    loaded: true,
    exports: {
      applyPilotWatchList: async () => ({}),
      emitPilotMetricEvent: async () => ({}),
      evaluateCoachWorkflowContinuity: async () => ({}),
      recordPilotMetricAlert: async () => ({}),
      recomputePilotMetricRollups: async () => ({}),
      resolvePilotEnrollmentContext: async () => ({}),
      writePilotMetricOpsStatus: async () => ({}),
      isTrueCareEscalationClassification: (classification) => Number(classification?.tier || 0) >= 2,
    },
  };

  return require(escalationPath);
}

function createClinicalRuntimeDb(initialRecord = {}) {
  const state = {
    record: { ...initialRecord },
    conversation: {},
    conversationWrites: [],
    safetyState: {},
    safetyWrites: [],
    userProfile: {
      displayName: 'Test Athlete',
      email: 'athlete@example.test',
      primarySport: 'Track and Field',
    },
  };

  const notesQuery = {
    where() {
      return notesQuery;
    },
    orderBy() {
      return notesQuery;
    },
    limit() {
      return notesQuery;
    },
    async get() {
      return { docs: [], empty: true };
    },
  };

  const db = {
    async runTransaction(callback) {
      return callback({
        get: (ref) => ref.get(),
        update: (ref, payload) => ref.update(payload),
        set: (ref, payload, options) => ref.set(payload, options),
      });
    },
    collection(name) {
      if (name === 'escalation-records') {
        return {
          doc(id) {
            return {
              id,
              async get() {
                return {
                  exists: Boolean(state.record && Object.keys(state.record).length),
                  id,
                  data: () => ({ ...state.record }),
                };
              },
              async set(payload, options = {}) {
                state.record = options.merge
                  ? { ...state.record, ...payload }
                  : { ...payload };
              },
              async update(payload) {
                state.record = { ...state.record, ...payload };
              },
            };
          },
        };
      }

      if (name === 'users') {
        return {
          doc() {
            return {
              async get() {
                return {
                  exists: true,
                  data: () => ({ ...state.userProfile }),
                };
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-athlete-safety-state') {
        return {
          doc() {
            return {
              async get() {
                return {
                  exists: Boolean(Object.keys(state.safetyState).length),
                  data: () => ({ ...state.safetyState }),
                };
              },
              async set(payload, options = {}) {
                state.safetyState = options.merge
                  ? { ...state.safetyState, ...payload }
                  : { ...payload };
                state.safetyWrites.push(payload);
              },
            };
          },
        };
      }

      if (name === 'conversations') {
        return {
          doc() {
            return {
              async get() {
                return {
                  exists: true,
                  data: () => ({ ...state.conversation, messages: [] }),
                };
              },
              async set(payload) {
                state.conversation = { ...state.conversation, ...payload };
                state.conversationWrites.push(payload);
              },
            };
          },
        };
      }

      if (name === 'user-mental-notes') {
        return {
          doc() {
            return {
              collection() {
                return notesQuery;
              },
            };
          },
        };
      }

      if (name === 'admin') {
        return {
          doc() {
            return {
              async get() {
                return { exists: false, data: () => undefined };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };

  return { db, state };
}

test('dispatcher rejects anonymous requests before Firestore access', async () => {
  let firestoreReads = 0;
  const runtimeDb = {
    collection() {
      firestoreReads += 1;
      throw new Error('Anonymous request reached Firestore.');
    },
  };
  const { handler } = loadEscalationModule({ runtimeDb });

  const response = await handler({
    httpMethod: 'POST',
    headers: {},
    body: JSON.stringify({ action: 'create', userId: 'athlete-1' }),
  });

  assert.equal(response.statusCode, 401);
  assert.equal(firestoreReads, 0);
});

test('dispatcher blocks athlete actions for a different user id', async () => {
  let firestoreReads = 0;
  const runtimeDb = {
    collection() {
      firestoreReads += 1;
      throw new Error('Cross-user request reached Firestore.');
    },
  };
  const { handler } = loadEscalationModule({ runtimeDb, decoded: { uid: 'athlete-1' } });

  const response = await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer valid-athlete-token' },
    body: JSON.stringify({
      action: 'consent',
      escalationId: 'escalation-for-athlete-2',
      userId: 'athlete-2',
      consent: true,
    }),
  });

  assert.equal(response.statusCode, 403);
  assert.equal(firestoreReads, 0);
});

test('care-state authorization is owner-bound while admins may reconcile another athlete', async () => {
  const { runtimeHelpers } = loadEscalationModule();
  const owner = await runtimeHelpers.authorizeEscalationAction({
    caller: { uid: 'athlete-1', isAdmin: false },
    action: 'care-state',
    body: { userId: 'athlete-1' },
  });
  const other = await runtimeHelpers.authorizeEscalationAction({
    caller: { uid: 'athlete-1', isAdmin: false },
    action: 'care-state',
    body: { userId: 'athlete-2' },
  });
  const admin = await runtimeHelpers.authorizeEscalationAction({
    caller: { uid: 'admin-1', isAdmin: true },
    action: 'care-state',
    body: { userId: 'athlete-2' },
  });

  assert.equal(owner.ok, true);
  assert.equal(other.ok, false);
  assert.equal(other.statusCode, 403);
  assert.equal(admin.ok, true);
});

test('dispatcher reserves record creation and direct handoff for admins and trusted runtime code', async () => {
  let firestoreReads = 0;
  const runtimeDb = {
    collection() {
      firestoreReads += 1;
      throw new Error('Athlete create request reached Firestore.');
    },
  };
  const { handler } = loadEscalationModule({ runtimeDb, decoded: { uid: 'athlete-1' } });

  const response = await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer valid-athlete-token' },
    body: JSON.stringify({ action: 'create', userId: 'athlete-1' }),
  });

  assert.equal(response.statusCode, 403);
  assert.equal(firestoreReads, 0);
});

test('accepted consent retries return completed state without a duplicate handoff', async () => {
  const { db, state } = createClinicalRuntimeDb({
    id: 'escalation-1',
    userId: 'athlete-1',
    conversationId: 'conversation-1',
    tier: 2,
    consentStatus: 'pending',
    handoffStatus: 'pending',
    incident: {},
  });
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  let handoffCalls = 0;
  const handoff = async () => {
    handoffCalls += 1;
    state.record.handoffStatus = 'completed';
    state.record.clinicalReferenceId = 'clinical-case-1';
    return {
      success: true,
      ok: true,
      escalationId: 'clinical-case-1',
      requestId: 'handoff-request-1',
    };
  };

  const first = await runtimeHelpers.handleConsent(
    { escalationId: 'escalation-1', userId: 'athlete-1', consent: true },
    db,
    handoff,
  );
  const repeated = await runtimeHelpers.handleConsent(
    { escalationId: 'escalation-1', userId: 'athlete-1', consent: true },
    db,
    handoff,
  );
  const repeatedPayload = JSON.parse(repeated.body);

  assert.equal(first.statusCode, 200);
  assert.equal(repeated.statusCode, 200);
  assert.equal(repeatedPayload.success, true);
  assert.equal(repeatedPayload.deduped, true);
  assert.equal(repeatedPayload.providerConfirmed, true);
  assert.equal(handoffCalls, 1);
});

test('failed handoff returns 502 with recorded consent and retry does not duplicate provider work', async () => {
  const { db, state } = createClinicalRuntimeDb({
    id: 'escalation-1',
    userId: 'athlete-1',
    conversationId: 'conversation-1',
    tier: 2,
    consentStatus: 'pending',
    handoffStatus: 'pending',
    incident: {},
  });
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  let handoffCalls = 0;
  const handoff = async () => {
    handoffCalls += 1;
    return {
      success: false,
      ok: false,
      status: 'failed',
      requestId: 'handoff-request-failed',
      error: { code: 'PROVIDER_UNAVAILABLE', message: 'Provider unavailable.' },
    };
  };

  const first = await runtimeHelpers.handleConsent(
    { escalationId: 'escalation-1', userId: 'athlete-1', consent: true },
    db,
    handoff,
  );
  const firstPayload = JSON.parse(first.body);
  const repeated = await runtimeHelpers.handleConsent(
    { escalationId: 'escalation-1', userId: 'athlete-1', consent: true },
    db,
    handoff,
  );
  const repeatedPayload = JSON.parse(repeated.body);

  assert.equal(first.statusCode, 502);
  assert.equal(firstPayload.success, false);
  assert.equal(firstPayload.consentRecorded, true);
  assert.equal(firstPayload.handoffStatus, 'failed');
  assert.equal(firstPayload.providerError.code, 'PROVIDER_UNAVAILABLE');
  assert.equal(firstPayload.providerRequestId, 'handoff-request-failed');
  assert.equal(repeated.statusCode, 502);
  assert.equal(repeatedPayload.success, false);
  assert.equal(repeatedPayload.deduped, true);
  assert.equal(repeatedPayload.providerError.message, 'Provider unavailable.');
  assert.equal(handoffCalls, 1);
  assert.equal(state.record.consentStatus, 'accepted');
  assert.equal(state.record.handoffStatus, 'failed');
});

test('a conflicting second consent decision fails explicitly without changing the first decision', async () => {
  const { db, state } = createClinicalRuntimeDb({
    id: 'escalation-1',
    userId: 'athlete-1',
    conversationId: 'conversation-1',
    tier: 2,
    consentStatus: 'pending',
    handoffStatus: 'pending',
    incident: {},
  });
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });

  const declined = await runtimeHelpers.handleConsent(
    { escalationId: 'escalation-1', userId: 'athlete-1', consent: false },
    db,
  );
  const conflict = await runtimeHelpers.handleConsent(
    { escalationId: 'escalation-1', userId: 'athlete-1', consent: true },
    db,
    async () => {
      throw new Error('Conflicting retry reached handoff.');
    },
  );
  const payload = JSON.parse(conflict.body);

  assert.equal(declined.statusCode, 200);
  assert.equal(conflict.statusCode, 409);
  assert.equal(payload.errorCode, 'CONSENT_DECISION_CONFLICT');
  assert.equal(payload.existingConsentStatus, 'declined');
  assert.equal(state.record.consentStatus, 'declined');
});

test('real handoff upserts the athlete before creating the clinical case', async () => {
  const { db, state } = createClinicalRuntimeDb();
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  const calls = [];
  const bridgeFactory = () => ({
    async upsertAthlete(input) {
      calls.push({ operation: 'athlete-upsert', input });
      return { success: true, ok: true, requestId: 'upsert-request-1' };
    },
    async createEscalation(input) {
      calls.push({ operation: 'escalation-create', input });
      return {
        success: true,
        ok: true,
        escalationId: 'clinical-case-1',
        requestId: 'escalation-request-1',
        status: 'received',
      };
    },
  });

  const result = await runtimeHelpers.performClinicalHandoff(
    'athlete-1',
    'conversation-1',
    'escalation-1',
    {
      tier: 2,
      category: 'care_escalation',
      triggerContent: 'I need help.',
      classificationReason: 'Elevated concern.',
      conversationSummary: 'Approved minimum-necessary summary.',
      consentStatus: 'accepted',
      consentTimestamp: 1785945600,
      handoffStatus: 'pending',
      stateSnapshot: {
        snapshotId: 'snapshot-1',
        overallReadiness: 'red',
        confidence: 'high',
        trendSummary: 'Readiness moved down across the current reporting window.',
        supportFlag: true,
        stateDimensions: {
          activation: 72,
          focusReadiness: 38,
          emotionalLoad: 84,
          cognitiveFatigue: 120,
        },
        sourcesUsed: ['self_report_checkin', 'conversation_signal_runtime'],
      },
      incident: {},
    },
    db,
    {
      route: 'clinician',
      teamId: 'team-1',
      pilotContext: {
        organizationId: 'organization-1',
        pilotId: 'pilot-1',
        pilotEnrollmentId: 'enrollment-1',
        teamMembershipId: 'membership-1',
      },
    },
    bridgeFactory
  );

  assert.deepEqual(calls.map((entry) => entry.operation), ['athlete-upsert', 'escalation-create']);
  assert.equal(calls[0].input.externalId, 'athlete-1');
  assert.equal(calls[0].input.organizationId, 'organization-1');
  assert.equal(calls[0].input.teamId, 'team-1');
  assert.equal(calls[1].input.payloadVersion, 'pulse-manas-v1-draft');
  assert.equal(calls[1].input.organizationId, 'organization-1');
  assert.equal(calls[1].input.teamId, 'team-1');
  assert.equal(calls[1].input.routingContext.teamMembershipId, 'membership-1');
  assert.equal(calls[1].input.consentState.status, 'opted_in');
  assert.deepEqual(calls[1].input.stateSnapshot, {
    snapshotId: 'snapshot-1',
    overallReadiness: 'red',
    confidence: 'high',
    trendSummary: 'Readiness moved down across the current reporting window.',
    supportFlag: true,
    stateDimensions: {
      activation: 72,
      focusReadiness: 38,
      emotionalLoad: 84,
      cognitiveFatigue: 100,
    },
    sourcesUsed: ['self_report_checkin', 'conversation_signal_runtime'],
  });
  assert.equal(result.success, true);
  assert.equal(result.escalationId, 'clinical-case-1');
  assert.equal(state.record.handoffStatus, 'completed');
  assert.equal(state.record.clinicalReferenceId, 'clinical-case-1');
});

test('clinical handoff does not invent a display name for an incomplete athlete profile', async () => {
  const { db, state } = createClinicalRuntimeDb();
  state.userProfile = {};
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  const calls = [];

  const result = await runtimeHelpers.performClinicalHandoff(
    'athlete-1',
    'conversation-1',
    'escalation-1',
    {
      tier: 2,
      category: 'care_escalation',
      conversationSummary: 'Approved minimum-necessary summary.',
      consentStatus: 'accepted',
      consentTimestamp: 1785945600,
      handoffStatus: 'pending',
      incident: {},
    },
    db,
    { route: 'clinician', teamId: '', pilotContext: null },
    () => ({
      async upsertAthlete(input) {
        calls.push({ operation: 'athlete-upsert', input });
        return { success: true, ok: true };
      },
      async createEscalation(input) {
        calls.push({ operation: 'escalation-create', input });
        return { success: true, ok: true, escalationId: 'clinical-case-1' };
      },
    })
  );

  assert.equal(result.success, true);
  assert.deepEqual(calls[0].input, { externalId: 'athlete-1' });
  assert.equal('displayName' in calls[1].input.athlete, false);
  assert.equal('email' in calls[1].input.athlete, false);
  assert.equal(JSON.stringify(calls).includes('Unknown'), false);
});

test('athlete upsert failure stops case creation and records the failed phase', async () => {
  const { db, state } = createClinicalRuntimeDb();
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  const calls = [];

  const result = await runtimeHelpers.performClinicalHandoff(
    'athlete-1',
    'conversation-1',
    'escalation-1',
    {
      tier: 3,
      category: 'immediate_safety',
      conversationSummary: 'Approved minimum-necessary summary.',
      consentStatus: 'not-required',
      handoffStatus: 'pending',
      incident: {},
    },
    db,
    { route: 'clinician', teamId: 'team-1', pilotContext: { organizationId: 'organization-1' } },
    () => ({
      async upsertAthlete() {
        calls.push('athlete-upsert');
        return {
          success: false,
          ok: false,
          error: { code: 'ATHLETE_REJECTED', message: 'Athlete upsert rejected.' },
        };
      },
      async createEscalation() {
        calls.push('escalation-create');
        return { success: true, ok: true, escalationId: 'must-not-exist' };
      },
    })
  );

  assert.deepEqual(calls, ['athlete-upsert']);
  assert.equal(result.success, false);
  assert.equal(result.phase, 'athlete_upsert');
  assert.equal(state.record.handoffStatus, 'failed');
  assert.equal(state.record.handoffFailurePhase, 'athlete_upsert');
});

test('Tier 3 provider handoff still runs when the private safety-state write fails', async () => {
  const auditWrites = [];
  const runtimeDb = {
    collection(name) {
      if (name === 'pulsecheck-athlete-safety-state') {
        return {
          doc() {
            return {
              async set() {
                const error = new Error('Safety-state storage unavailable.');
                error.code = 'SAFETY_STATE_UNAVAILABLE';
                throw error;
              },
            };
          },
        };
      }

      if (name === 'escalation-records') {
        return {
          doc() {
            return {
              async set(payload) {
                auditWrites.push(payload);
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb });
  let handoffCalls = 0;

  const result = await runtimeHelpers.executeCriticalSafetyOperations({
    userId: 'athlete-1',
    conversationId: 'conversation-1',
    escalationId: 'escalation-1',
    escalationData: { tier: 3, category: 'immediate_safety' },
    supportContext: { route: 'clinician', teamId: 'team-1' },
    nowSec: 1785945600,
    runtimeDb,
    handoffRunner: async () => {
      handoffCalls += 1;
      return {
        success: true,
        status: 'completed',
        escalationId: 'clinical-case-1',
        requestId: 'critical-handoff-request-1',
      };
    },
  });

  assert.equal(handoffCalls, 1);
  assert.equal(result.safetyStateWriteStatus, 'failed');
  assert.equal(result.safetyStateError.code, 'SAFETY_STATE_UNAVAILABLE');
  assert.equal(result.handoffResult.success, true);
  assert.equal(result.handoffResult.escalationId, 'clinical-case-1');
  assert.equal(auditWrites[0].safetyStateWriteStatus, 'failed');
});

test('coach notification failure is contained so a clinical handoff can continue', async () => {
  const auditWrites = [];
  const runtimeDb = {
    collection(name) {
      assert.equal(name, 'escalation-records');
      return {
        doc(id) {
          assert.equal(id, 'escalation-1');
          return {
            async set(payload) {
              auditWrites.push(payload);
            },
          };
        },
      };
    },
  };
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb });

  const result = await runtimeHelpers.notifyCoachForClinicalHandoff(
    { escalationId: 'escalation-1', userId: 'athlete-1' },
    runtimeDb,
    async () => {
      const error = new Error('Notification provider unavailable.');
      error.code = 'NOTIFICATION_PROVIDER_UNAVAILABLE';
      throw error;
    },
  );

  assert.equal(result.success, false);
  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'NOTIFICATION_PROVIDER_UNAVAILABLE');
  assert.equal(auditWrites[0].coachNotificationStatus, 'failed');
});

test('resolve awaits provider confirmation before closing a linked record', async () => {
  const { db, state } = createClinicalRuntimeDb({
    id: 'escalation-1',
    userId: 'athlete-1',
    conversationId: 'conversation-1',
    clinicalReferenceId: 'clinical-case-1',
    status: 'active',
    incidentStatus: 'open',
    incident: {},
  });
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  let providerCall = null;

  const response = await runtimeHelpers.handleResolve(
    {
      escalationId: 'escalation-1',
      userId: 'athlete-1',
      resolvedBy: 'admin-1',
      resolutionNote: 'Support team completed the follow-up.',
    },
    db,
    () => ({
      async resolveEscalation(id, resolution) {
        providerCall = { id, resolution };
        return { success: true, ok: true, status: 'resolved', requestId: 'resolve-request-1' };
      },
    })
  );

  assert.equal(response.statusCode, 200);
  assert.equal(providerCall.id, 'clinical-case-1');
  assert.equal(providerCall.resolution.coachNote, 'Support team completed the follow-up.');
  assert.equal(state.record.clinicalResolutionStatus, 'completed');
  assert.equal(state.record.status, 'resolved');
  assert.equal(state.conversation.escalationStatus, 'resolved');
});

test('provider resolution failure leaves the local record open with an explicit failure state', async () => {
  const { db, state } = createClinicalRuntimeDb({
    id: 'escalation-1',
    userId: 'athlete-1',
    conversationId: 'conversation-1',
    clinicalReferenceId: 'clinical-case-1',
    status: 'active',
    incidentStatus: 'open',
    incident: {},
  });
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });

  const response = await runtimeHelpers.handleResolve(
    { escalationId: 'escalation-1', userId: 'athlete-1', resolvedBy: 'admin-1' },
    db,
    () => ({
      async resolveEscalation() {
        return {
          success: false,
          ok: false,
          error: { code: 'PROVIDER_UNAVAILABLE', message: 'Provider unavailable.' },
        };
      },
    })
  );

  assert.equal(response.statusCode, 502);
  assert.equal(state.record.status, 'active');
  assert.equal(state.record.clinicalResolutionStatus, 'failed');
  assert.equal(state.record.clinicalResolutionFailureReason, 'Provider unavailable.');
  assert.equal(state.conversationWrites.length, 0);
});

test('provider-confirmed case resolution never clears the protective safety state', async () => {
  const { db, state } = createClinicalRuntimeDb({
    id: 'escalation-1',
    userId: 'athlete-1',
    teamId: 'team-1',
    conversationId: 'conversation-1',
    clinicalReferenceId: 'clinical-case-1',
    status: 'active',
    incidentStatus: 'open',
    incident: {},
  });
  state.safetyState = {
    athleteUserId: 'athlete-1',
    teamId: 'team-1',
    crisisWallActive: true,
    crisisWallActiveEscalationId: 'escalation-1',
  };
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });

  const response = await runtimeHelpers.handleResolve(
    {
      escalationId: 'escalation-1',
      userId: 'athlete-1',
      resolvedBy: 'clinician-1',
      resolutionNote: 'Provider confirmed that the case is resolved.',
      // A legacy caller may still send this flag; the server must ignore it.
      clearCrisisWall: true,
    },
    db,
    () => ({
      async resolveEscalation() {
        return { success: true, ok: true, status: 'resolved', requestId: 'resolve-request-2' };
      },
    })
  );
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.providerConfirmed, true);
  assert.equal(payload.crisisWallCleared, false);
  assert.equal(payload.clearancePending, true);
  assert.equal(payload.clearanceRequiresAuthoritativeSignal, true);
  assert.equal(state.safetyWrites.length, 0);
  assert.equal(state.safetyState.athleteUserId, 'athlete-1');
  assert.equal(state.safetyState.teamId, 'team-1');
  assert.equal(state.safetyState.crisisWallActive, true);
  assert.equal(state.safetyState.crisisWallActiveEscalationId, 'escalation-1');
  assert.equal('isInSafetyMode' in state.conversation, false);
});

test('resolution leaves safety state untouched when clearance is omitted', async () => {
  const { db, state } = createClinicalRuntimeDb({
    id: 'escalation-1',
    userId: 'athlete-1',
    conversationId: 'conversation-1',
    clinicalReferenceId: 'clinical-case-1',
    status: 'active',
    incidentStatus: 'open',
    incident: {},
  });
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });

  const response = await runtimeHelpers.handleResolve(
    { escalationId: 'escalation-1', userId: 'athlete-1', resolvedBy: 'clinician-1' },
    db,
    () => ({
      async resolveEscalation() {
        return { success: true, ok: true, status: 'resolved' };
      },
    })
  );
  const payload = JSON.parse(response.body);

  assert.equal(payload.crisisWallCleared, false);
  assert.equal(payload.clearancePending, true);
  assert.equal(state.safetyWrites.length, 0);
  assert.equal('isInSafetyMode' in state.conversation, false);
});

test('provider resolution failure never clears safety state even when requested', async () => {
  const { db, state } = createClinicalRuntimeDb({
    id: 'escalation-1',
    userId: 'athlete-1',
    clinicalReferenceId: 'clinical-case-1',
    status: 'active',
    incidentStatus: 'open',
    incident: {},
  });
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });

  const response = await runtimeHelpers.handleResolve(
    {
      escalationId: 'escalation-1',
      userId: 'athlete-1',
      resolvedBy: 'clinician-1',
      clearCrisisWall: true,
    },
    db,
    () => ({
      async resolveEscalation() {
        return { success: false, ok: false, error: { message: 'Provider unavailable.' } };
      },
    })
  );

  assert.equal(response.statusCode, 502);
  assert.equal(state.safetyWrites.length, 0);
});

test('care-state reconciliation mirrors only recognized coarse safety fields', async () => {
  const { db, state } = createClinicalRuntimeDb();
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });

  const response = await runtimeHelpers.handleCareState(
    { userId: 'athlete-1' },
    db,
    () => ({
      async getCareState() {
        return {
          success: true,
          ok: true,
          requestId: 'care-request-1',
          data: {
            externalId: 'athlete-1',
            teamId: 'team-1',
            watchList: true,
            appState: 'protective',
            returnToTrainingStatus: 'not_cleared',
            clinicalCaseId: 'clinical-case-1',
            pulseEscalationId: 'escalation-1',
            clinicalNotes: 'must not persist',
            checkInCadence: { frequency: 'daily' },
          },
        };
      },
    })
  );
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(payload.careState, {
    watchListActive: true,
    appState: 'protective',
    returnToTrainingStatus: 'not_cleared',
    crisisWallActive: true,
    clearanceApplied: false,
  });
  assert.equal(state.safetyState.athleteUserId, 'athlete-1');
  assert.equal(state.safetyState.crisisWallActive, true);
  assert.equal(state.safetyState.crisisWallActiveEscalationId, 'escalation-1');
  assert.equal(state.safetyState.clinicalCaseId, 'clinical-case-1');
  assert.equal('clinicalNotes' in state.safetyState, false);
  assert.equal('checkInCadence' in state.safetyState, false);
});

test('care-state provider failures and ambiguous responses do not write or clear safety state', async () => {
  const { db, state } = createClinicalRuntimeDb();
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });

  const failed = await runtimeHelpers.handleCareState(
    { userId: 'athlete-1' },
    db,
    () => ({
      async getCareState() {
        const error = new Error('Clinical bridge API key is required.');
        error.code = 'CLINICAL_BRIDGE_API_KEY_MISSING';
        throw error;
      },
    })
  );
  assert.equal(failed.statusCode, 503);
  assert.equal(state.safetyWrites.length, 0);

  const ambiguous = await runtimeHelpers.handleCareState(
    { userId: 'athlete-1' },
    db,
    () => ({
      async getCareState() {
        return { success: true, ok: true, data: { status: 'unknown' } };
      },
    })
  );
  assert.equal(ambiguous.statusCode, 502);
  assert.equal(state.safetyWrites.length, 0);
});

test('care-state clear requires an explicit successful provider clear state', async () => {
  const { db, state } = createClinicalRuntimeDb();
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });

  const response = await runtimeHelpers.handleCareState(
    { userId: 'athlete-1' },
    db,
    () => ({
      async getCareState() {
        return {
          success: true,
          ok: true,
          data: { watchListActive: false },
        };
      },
    })
  );
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.careState.clearanceApplied, true);
  assert.equal(state.safetyState.crisisWallActive, false);
  assert.equal(state.safetyState.crisisWallReason, null);
});
