const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const escalationPath = path.join(repoRoot, 'netlify/functions/pulsecheck-escalation.js');
const configPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');
const pilotMetricsPath = path.join(repoRoot, 'netlify/functions/utils/pulsecheck-pilot-metrics.js');

function loadEscalationModule({
  runtimeDb,
  decoded = { uid: 'athlete-1' },
  verifyError = null,
  pilotMetrics = {},
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
      applyPilotWatchList: pilotMetrics.applyPilotWatchList || (async () => ({})),
      emitPilotMetricEvent: pilotMetrics.emitPilotMetricEvent || (async () => ({})),
      evaluateCoachWorkflowContinuity: pilotMetrics.evaluateCoachWorkflowContinuity || (async () => ({})),
      recordPilotMetricAlert: pilotMetrics.recordPilotMetricAlert || (async () => ({})),
      recomputePilotMetricRollups: pilotMetrics.recomputePilotMetricRollups || (async () => ({})),
      resolvePilotEnrollmentContext: pilotMetrics.resolvePilotEnrollmentContext || (async () => ({})),
      writePilotMetricOpsStatus: pilotMetrics.writePilotMetricOpsStatus || (async () => ({})),
      isTrueCareEscalationClassification: (classification) => Number(classification?.tier || 0) >= 2,
    },
  };

  return require(escalationPath);
}

function createClinicalRuntimeDb(initialRecord = {}) {
  const state = {
    record: { ...initialRecord },
    recordId: 'escalation-1',
    conversation: {},
    conversationWrites: [],
    safetyState: {},
    safetyWrites: [],
    userProfile: {
      displayName: 'Test Athlete',
      email: 'athlete@example.test',
      primarySport: 'Track and Field',
    },
    usersById: {},
    coachesById: {},
    team: {
      id: 'team-1',
      organizationId: 'organization-1',
      displayName: 'Test Team',
      status: 'active',
      defaultEscalationRoute: 'clinician',
    },
    teamMemberships: [],
    notifications: [],
    notificationLogs: [],
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
        const query = {
          where() {
            return query;
          },
          async get() {
            const hasRecord = Boolean(state.record && Object.keys(state.record).length);
            return {
              docs: hasRecord ? [{
                id: state.recordId,
                data: () => ({ ...state.record }),
              }] : [],
              empty: !hasRecord,
            };
          },
        };
        return {
          where() {
            return query;
          },
          async add(payload) {
            state.record = { ...payload };
            return {
              id: state.recordId,
              async update(update) {
                state.record = { ...state.record, ...update };
              },
            };
          },
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
          doc(id) {
            return {
              async get() {
                const profile = state.usersById[id] || (id === 'athlete-1' ? state.userProfile : null);
                return {
                  exists: Boolean(profile),
                  data: () => ({ ...(profile || {}) }),
                };
              },
            };
          },
        };
      }

      if (name === 'coaches') {
        return {
          doc(id) {
            return {
              async get() {
                const profile = state.coachesById[id] || null;
                return {
                  exists: Boolean(profile),
                  data: () => ({ ...(profile || {}) }),
                };
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-organizations') return { doc: () => ({ get: async () => ({ exists: true, data: () => state.organization || {} }) }) };
      if (name === 'pulsecheck-teams') {
        return {
          doc(id) {
            return {
              async get() {
                const exists = id === state.team.id;
                return {
                  exists,
                  id,
                  data: () => (exists ? { ...state.team } : undefined),
                };
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-team-memberships' || name === 'athlete-coach-connections') {
        const makeQuery = (filters = []) => ({
          where(field, op, value) {
            assert.equal(op, '==');
            return makeQuery([...filters, { field, value }]);
          },
          limit() {
            return makeQuery(filters);
          },
          async get() {
            const source = name === 'pulsecheck-team-memberships'
              ? state.teamMemberships
              : [];
            const docs = source
              .filter((entry) => filters.every((filter) => entry[filter.field] === filter.value))
              .map((entry, index) => ({
                id: entry.id || `doc-${index}`,
                data: () => ({ ...entry }),
              }));
            return {
              docs,
              empty: docs.length === 0,
            };
          },
        });
        return {
          doc(id) {
            return {
              async get() {
                const membership = state.teamMemberships.find((entry) => entry.id === id) || null;
                return {
                  exists: Boolean(membership),
                  id,
                  data: () => ({ ...(membership || {}) }),
                  ref: { collection: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({
                    empty: !membership?.athleteOnboarding?.consentDecisions,
                    docs: membership ? [{ data: () => ({ actorUserId: membership.userId, decisions: membership.athleteOnboarding?.consentDecisions }) }] : [],
                  }) }) }) }) },
                };
              },
            };
          },
          where(field, op, value) {
            return makeQuery().where(field, op, value);
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

      if (name === 'notifications') {
        return {
          async add(payload) {
            state.notifications.push(payload);
            return { id: `notification-${state.notifications.length}` };
          },
        };
      }

      if (name === 'notification-logs') {
        return {
          async add(payload) {
            state.notificationLogs.push(payload);
            return { id: `notification-log-${state.notificationLogs.length}` };
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

test('synthetic Tier 3 staging uses the production escalation record path without contacting anyone', async () => {
  let pilotMetricWrites = 0;
  let pilotRollups = 0;
  const { db, state } = createClinicalRuntimeDb();
  state.conversation = { userId: 'nora-red-team-athlete-1' };
  const { runtimeHelpers } = loadEscalationModule({
    runtimeDb: db,
    pilotMetrics: {
      emitPilotMetricEvent: async () => { pilotMetricWrites += 1; },
      recomputePilotMetricRollups: async () => { pilotRollups += 1; },
    },
  });

  const payload = await runtimeHelpers.createEscalationFromTrustedRuntime({
    userId: 'nora-red-team-athlete-1',
    conversationId: 'synthetic-conversation-1',
    tier: 3,
    category: 'immediate_safety',
    triggerMessageId: 'synthetic-message-1',
    triggerContent: 'I cannot stay safe right now.',
    classificationReason: 'Synthetic critical-safety probe.',
    classificationConfidence: 1,
    classificationFamily: 'critical_safety',
    disposition: 'clinical_handoff',
    severity: 'critical',
    requiresCoachReview: true,
    requiresClinicalHandoff: true,
  }, db, {
    syntheticRedTeam: true,
    syntheticRedTeamRunId: 'nrt-staging-run-1',
  });

  assert.equal(payload.success, true);
  assert.equal(payload.syntheticRedTeam, true);
  assert.equal(payload.externalSideEffects, false);
  assert.equal(payload.handoffStatus, 'not_initiated');
  assert.equal(payload.handoffResult.supportRoute, 'synthetic_no_contact');
  assert.equal(payload.handoffResult.externalSideEffects, false);
  assert.equal(state.record.syntheticRedTeam, true);
  assert.equal(state.record.syntheticHandoff, true);
  assert.equal(state.record.externalSideEffects, false);
  assert.equal(Object.prototype.hasOwnProperty.call(state.record, 'coachId'), false);
  assert.equal(state.safetyState.syntheticRedTeam, true);
  assert.equal(state.safetyState.externalSideEffects, false);
  assert.equal(state.notifications.length, 0);
  assert.equal(state.notificationLogs.length, 0);
  assert.equal(pilotMetricWrites, 0);
  assert.equal(pilotRollups, 0);
});

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

test('care-state authorization is owner-bound while admins may reconcile unscoped legacy state', async () => {
  const { db } = createClinicalRuntimeDb();
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
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

test('support-options authorization is owner-bound', async () => {
  const { runtimeHelpers } = loadEscalationModule();
  const owner = await runtimeHelpers.authorizeEscalationAction({
    caller: { uid: 'athlete-1', isAdmin: false },
    action: 'support-options',
    body: { userId: 'athlete-1' },
  });
  const other = await runtimeHelpers.authorizeEscalationAction({
    caller: { uid: 'athlete-1', isAdmin: false },
    action: 'support-options',
    body: { userId: 'athlete-2' },
  });

  assert.equal(owner.ok, true);
  assert.equal(other.ok, false);
  assert.equal(other.statusCode, 403);
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

test('support options return eligible Tier 2 recipients and exclude non-athlete-data roles', async () => {
  const { db, state } = createClinicalRuntimeDb({
    id: 'escalation-1',
    userId: 'athlete-1',
    conversationId: 'conversation-1',
    tier: 2,
    teamId: 'team-1',
    organizationId: 'organization-1',
    category: 'performance_support',
    classificationFamily: 'coach_review',
    disposition: 'coach_review',
    requiresClinicalHandoff: false,
    consentStatus: 'pending',
    handoffStatus: 'pending',
    incident: {},
  });
  state.teamMemberships = [
    {
      id: 'team-1_athlete-1',
      userId: 'athlete-1',
      teamId: 'team-1',
      organizationId: 'organization-1',
      role: 'athlete',
      status: 'active',
    },
    {
      id: 'team-1_staff-at',
      userId: 'staff-at',
      teamId: 'team-1',
      organizationId: 'organization-1',
      role: 'performance-staff',
      title: 'Athletic Trainer',
      staffCapabilities: ['athletic_trainer'],
      status: 'active',
    },
    {
      id: 'team-1_coach-1',
      userId: 'coach-1',
      teamId: 'team-1',
      organizationId: 'organization-1',
      role: 'coach',
      title: 'Coach',
      staffCapabilities: ['coaching'],
      status: 'active',
    },
    {
      id: 'team-1_manager-1',
      userId: 'manager-1',
      teamId: 'team-1',
      organizationId: 'organization-1',
      role: 'support-staff',
      title: 'Manager',
      staffCapabilities: ['administrative'],
      status: 'active',
    },
  ];
  state.usersById['staff-at'] = { displayName: 'Alex Trainer' };
  state.usersById['coach-1'] = { displayName: 'Coach Lane' };
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });

  const response = await runtimeHelpers.handleSupportOptions(
    { escalationId: 'escalation-1', userId: 'athlete-1' },
    db,
  );
  const payload = JSON.parse(response.body);
  const optionIds = payload.options.map((option) => option.id);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.choiceMode, 'recipient_picker');
  assert.equal(payload.requiresClinicalRoute, false);
  assert.equal(payload.defaultOptionId, 'staff:team-1:staff-at');
  assert.deepEqual(optionIds, [
    'staff:team-1:staff-at',
    'staff:team-1:coach-1',
    'configured-team-support',
  ]);
  assert.equal(payload.options[0].label, 'Alex Trainer');
  assert.equal(optionIds.includes('staff:team-1:manager-1'), false);
  assert.equal(optionIds.includes('staff:team-1:athlete-1'), false);
});

test('clinical Tier 2 support options stay locked to the configured care route', async () => {
  const { db, state } = createClinicalRuntimeDb({
    id: 'escalation-1',
    userId: 'athlete-1',
    conversationId: 'conversation-1',
    tier: 2,
    teamId: 'team-1',
    organizationId: 'organization-1',
    category: 'loss_of_function',
    classificationFamily: 'care_escalation',
    disposition: 'clinical_handoff',
    requiresClinicalHandoff: true,
    consentStatus: 'pending',
    handoffStatus: 'pending',
    incident: {},
  });
  state.teamMemberships = [{
    id: 'team-1_staff-at',
    userId: 'staff-at',
    teamId: 'team-1',
    organizationId: 'organization-1',
    role: 'performance-staff',
    staffCapabilities: ['athletic_trainer'],
    status: 'active',
  }];
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });

  const response = await runtimeHelpers.handleSupportOptions(
    { escalationId: 'escalation-1', userId: 'athlete-1' },
    db,
  );
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.choiceMode, 'clinical_locked');
  assert.equal(payload.requiresClinicalRoute, true);
  assert.equal(payload.defaultOptionId, 'configured-clinical-support');
  assert.deepEqual(payload.options.map((option) => option.id), ['configured-clinical-support']);
});

test('accepted Tier 2 consent records the selected support recipient', async () => {
  const { db, state } = createClinicalRuntimeDb({
    id: 'escalation-1',
    userId: 'athlete-1',
    conversationId: 'conversation-1',
    tier: 2,
    teamId: 'team-1',
    organizationId: 'organization-1',
    category: 'performance_support',
    classificationFamily: 'coach_review',
    disposition: 'coach_review',
    requiresClinicalHandoff: false,
    consentStatus: 'pending',
    handoffStatus: 'pending',
    incident: {},
  });
  state.teamMemberships = [{
    id: 'team-1_coach-1',
    userId: 'coach-1',
    teamId: 'team-1',
    organizationId: 'organization-1',
    role: 'coach',
    title: 'Coach',
    staffCapabilities: ['coaching'],
    status: 'active',
  }];
  state.usersById['coach-1'] = { displayName: 'Coach Lane' };
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  state.organization = { productBrand: 'athleticmind', status: 'active' };
  let capturedHandoff = null;

  const missingRecipient = await runtimeHelpers.handleConsent(
    { escalationId: 'escalation-1', userId: 'athlete-1', consent: true },
    db,
    async () => { throw new Error('An implicit staff choice must never start a handoff'); },
  );
  assert.equal(missingRecipient.statusCode, 400);
  assert.equal(JSON.parse(missingRecipient.body).errorCode, 'SUPPORT_RECIPIENT_REQUIRED');
  assert.equal(state.record.consentStatus, 'pending');

  const response = await runtimeHelpers.handleConsent(
    {
      escalationId: 'escalation-1',
      userId: 'athlete-1',
      consent: true,
      supportRecipientOptionId: 'staff:team-1:coach-1',
    },
    db,
    async (handoffUserId, conversationId, escalationId, escalationData, supportContext) => {
      capturedHandoff = {
        handoffUserId,
        conversationId,
        escalationId,
        escalationData,
        supportContext,
      };
      return { success: true, ok: true, status: 'completed', supportRoute: 'selected_staff' };
    },
  );
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.supportSelection.userId, 'coach-1');
  assert.equal(state.record.supportSelectionUserId, 'coach-1');
  assert.equal(state.record.supportSelectionLabel, 'Coach Lane');
  assert.equal(capturedHandoff.escalationData.supportSelectionUserId, 'coach-1');
  assert.equal(capturedHandoff.supportContext.selectedSupportOption.userId, 'coach-1');
  assert.match(payload.message, /Coach Lane/);
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

function authorizeRoutineFixture(state, membershipId = 'team-1_athlete-1') {
  const health = require('../../../src/content/consents/defaults.json').health;
  state.organization = { productBrand: 'athleticmind', status: 'active' };
  state.teamMemberships = [{ id: membershipId, userId: 'athlete-1', teamId: 'team-1', organizationId: 'organization-1', status: 'active', role: 'athlete',
    athleteOnboarding: { consentDecisions: { [health.id]: { decision: 'accepted', version: health.version, document: health, signedName: 'Synthetic Athlete' } } } }];
}

test('real handoff upserts the athlete before creating the clinical case', async () => {
  const { db, state } = createClinicalRuntimeDb();
  authorizeRoutineFixture(state, 'membership-1');
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
  assert.equal(calls[1].input.routingContext.selectedSupportOption, null);
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
  authorizeRoutineFixture(state, 'team-1_athlete-1');
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
    { route: 'clinician', teamId: 'team-1', pilotContext: null },
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
  assert.deepEqual(calls[0].input, { externalId: 'athlete-1', teamId: 'team-1' });
  assert.equal('displayName' in calls[1].input.athlete, false);
  assert.equal('email' in calls[1].input.athlete, false);
  assert.equal(JSON.stringify(calls).includes('Unknown'), false);
});

test('athlete upsert failure stops case creation and records the failed phase', async () => {
  const { db, state } = createClinicalRuntimeDb();
  authorizeRoutineFixture(state, 'team-1_athlete-1');
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  const calls = [];

  const result = await runtimeHelpers.performClinicalHandoff(
    'athlete-1',
    'conversation-1',
    'escalation-1',
    {
      tier: 2,
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

test('safeguarding never auto-selects or notifies a connected coach', async () => {
  const { runtimeHelpers } = loadEscalationModule();
  const writes = [];
  const record = { userId: 'athlete-test', category: 'Abuse Disclosure (immediate danger)', tier: 3 };
  const ref = { async set(value) { writes.push(value); }, async get() { return { exists: true, data: () => record, ref }; } };
  const db = { collection(name) { assert.equal(name, 'escalation-records', 'Must not access coaches, notifications or delivery collections'); return { doc: () => ref }; } };
  const response = await runtimeHelpers.notifyCoach({ escalationId: 'test', userId: 'athlete-test', coachId: 'implicated-coach' }, db);
  assert.equal(JSON.parse(response.body).reason, 'independent_safeguarding_recipient_required');
  assert.equal(writes[0].coachNotificationStatus, 'blocked_safeguarding');
});

for (const exclusions of [{ excludedRecipientIds: ['coach-test'] }, { implicatedCoachId: 'coach-test' }]) {
  test(`coach delivery blocks an excluded recipient: ${Object.keys(exclusions)[0]}`, async () => {
    const { runtimeHelpers } = loadEscalationModule();
    const record = { userId: 'athlete-test', category: 'general', ...exclusions };
    const db = { collection(name) { assert.equal(name, 'escalation-records'); return { doc: () => ({ async get() { return { exists: true, data: () => record }; } }) }; } };
    const response = await runtimeHelpers.notifyCoach({ escalationId: 'test', userId: 'athlete-test', coachId: 'coach-test' }, db);
    assert.equal(JSON.parse(response.body).reason, 'recipient_excluded');
  });
}

function withJournalEntries(db, entries) {
  const entryDoc = (userId, entryId) => ({ async get() { return { exists: Boolean(entries[`${userId}/${entryId}`]), data: () => entries[`${userId}/${entryId}`] }; } });
  return {
    ...db,
    runTransaction: db.runTransaction,
    collection(name) {
      if (name === 'pulsecheck-evidence-journals') {
        return { doc: (userId) => ({ collection: () => ({ doc: (entryId) => entryDoc(userId, entryId) }) }) };
      }
      return db.collection(name);
    },
  };
}

test('journal Tier 2 escalations key on the entry and never write a conversation document', async () => {
  const { db: baseDb, state } = createClinicalRuntimeDb();
  const db = withJournalEntries(baseDb, { 'athlete-1/entry-1': { moment: 'Private entry' } });
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });

  const payload = await runtimeHelpers.createEscalationFromTrustedRuntime({
    userId: 'athlete-1',
    conversationId: 'journal-entry-1',
    sourceType: 'journal',
    sourceRef: 'entry-1',
    tier: 2,
    category: 'persistent-distress',
    triggerMessageId: 'entry-1',
    triggerContent: 'Private entry',
    classificationReason: 'Journal screening test.',
    classificationConfidence: 0.9,
    classificationFamily: 'care_escalation',
    requiresClinicalHandoff: true,
  }, db);

  assert.equal(payload.consentRequired, true);
  assert.equal(state.record.sourceType, 'journal');
  assert.equal(state.record.sourceRef, 'entry-1');
  assert.equal(state.conversationWrites.length, 0);
});

test('journal escalations are refused when the entry does not belong to the athlete', async () => {
  const { db: baseDb } = createClinicalRuntimeDb();
  const db = withJournalEntries(baseDb, { 'someone-else/entry-1': { moment: 'Not theirs' } });
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  await assert.rejects(
    runtimeHelpers.createEscalationFromTrustedRuntime({
      userId: 'athlete-1', conversationId: 'journal-entry-1', sourceType: 'journal', sourceRef: 'entry-1', tier: 2, category: 'persistent-distress',
    }, db),
    (error) => error.statusCode === 403,
  );
});

test('program brand controls new routes while existing cases retain their route', async () => {
  const { db, state } = createClinicalRuntimeDb();
  state.team = { id: 'team-1', organizationId: 'organization-1', defaultEscalationRoute: 'clinician' };
  state.organization = { productBrand: 'pulsecheck', appBranding: { pulsecheck: 'athleticmind' } };
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  const context = { athleteId: 'athlete-1', preferredTeamId: 'team-1' };
  assert.equal((await runtimeHelpers.resolveEscalationSupportContext(context, db)).route, 'hotline');
  assert.equal((await runtimeHelpers.resolveEscalationSupportContext({ ...context, escalationData: { supportRoute: 'clinician' } }, db)).route, 'clinician');
  state.organization = { productBrand: 'athleticmind', status: 'active' };
  assert.equal((await runtimeHelpers.resolveEscalationSupportContext(context, db)).route, 'clinician');
  assert.equal((await runtimeHelpers.resolveEscalationSupportContext({ ...context, escalationData: { supportRoute: 'hotline' } }, db)).route, 'hotline');
});

for (const scenario of [
  { label: 'monitor signal', tier: 1 },
  { label: 'pending elevated concern', tier: 2, consentStatus: 'pending' },
  { label: 'accepted clinical route', tier: 2, consentStatus: 'accepted', supportSelection: { kind: 'configured_route', route: 'clinician' } },
  { label: 'different named recipient', tier: 2, consentStatus: 'accepted', supportSelection: { kind: 'staff', userId: 'other-coach' } },
]) {
  test(`private concern does not notify a coach for ${scenario.label}`, async () => {
    const { runtimeHelpers } = loadEscalationModule();
    const record = { userId: 'athlete-test', teamId: 'team-test', category: 'general', ...scenario };
    const db = { collection(name) {
      if (name === 'pulsecheck-teams') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ organizationId: 'org-test' }) }) }) };
      if (name === 'pulsecheck-organizations') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ productBrand: 'athleticmind' }) }) }) };
      assert.equal(name, 'escalation-records', 'Must not look up a connected coach or create notifications');
      return { doc: () => ({ async get() { return { exists: true, data: () => record }; } }) };
    } };
    const response = await runtimeHelpers.notifyCoach({ escalationId: 'test', userId: 'athlete-test', coachId: 'coach-test' }, db);
    assert.equal(JSON.parse(response.body).reason, 'event_recipient_consent_required');
  });
}

test('an accepted named staff selection reaches only that recipient without connection lookup', async () => {
  const { runtimeHelpers } = loadEscalationModule();
  const record = { userId: 'athlete-test', teamId: 'team-test', tier: 2, consentStatus: 'accepted', supportSelection: { kind: 'staff', userId: 'selected-staff' } };
  const reachedDelivery = new Error('delivery boundary');
  const db = { collection(name) {
    if (name === 'pulsecheck-teams') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ organizationId: 'org-test' }) }) }) };
    if (name === 'pulsecheck-organizations') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ productBrand: 'athleticmind' }) }) }) };
    assert.equal(name, 'escalation-records', 'Must not consult the connected-coach fallback');
    return { doc: () => ({
      async get() { return { exists: true, data: () => record }; },
      async update(value) { assert.equal(value.coachId, 'selected-staff'); throw reachedDelivery; },
    }) };
  } };
  await assert.rejects(
    runtimeHelpers.notifyCoach({ escalationId: 'test', userId: 'athlete-test' }, db),
    (error) => error === reachedDelivery,
  );
});

for (const organization of [{ productBrand: 'pulsecheck', appBranding: { pulsecheck: 'athleticmind' } }, {}, { productBrand: 'invalid' }]) {
  test(`program scope rejects inferred Athletic Mind configuration: ${JSON.stringify(organization)}`, async () => {
    const { db, state } = createClinicalRuntimeDb();
    state.organization = organization;
    const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
    assert.equal(await runtimeHelpers.isExplicitAthleticMindIncident(db, { teamId: 'team-1' }), false);
  });
}
test('Athletic Mind incident scope cannot be inferred from another membership or mismatched organization', async () => {
  const { db, state } = createClinicalRuntimeDb();
  state.organization = { productBrand: 'athleticmind', status: 'active' };
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  assert.equal(await runtimeHelpers.isExplicitAthleticMindIncident(db, {}), false);
  assert.equal(await runtimeHelpers.isExplicitAthleticMindIncident(db, { teamId: 'team-1', organizationId: 'other-org' }), false);
  assert.equal(await runtimeHelpers.isExplicitAthleticMindIncident(db, { teamId: 'team-1', organizationId: 'organization-1' }), true);
});

for (const organization of [{ productBrand: 'pulsecheck', appBranding: { pulsecheck: 'athleticmind' } }, {}]) {
  test(`noncritical notifyCoach preserves connection fallback for ${JSON.stringify(organization)}`, async () => {
    const { runtimeHelpers } = loadEscalationModule();
    const fallbackReached = new Error('existing connection fallback');
    const db = { collection(name) {
      if (name === 'escalation-records') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ userId: 'athlete', teamId: 'team', tier: 2, consentStatus: 'pending' }) }) }) };
      if (name === 'pulsecheck-teams') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ organizationId: 'org' }) }) }) };
      if (name === 'pulsecheck-organizations') return { doc: () => ({ get: async () => ({ exists: true, data: () => organization }) }) };
      assert.equal(name, 'athlete-coach-connections');
      throw fallbackReached;
    } };
    await assert.rejects(runtimeHelpers.notifyCoach({ escalationId: 'event', userId: 'athlete' }, db), (error) => error === fallbackReached);
  });
}

async function withEmergencyDelivery(enabled, callback) {
  const previous = process.env.ATHLETICMIND_EMERGENCY_HANDOFF_ENABLED;
  if (enabled) process.env.ATHLETICMIND_EMERGENCY_HANDOFF_ENABLED = 'true';
  else delete process.env.ATHLETICMIND_EMERGENCY_HANDOFF_ENABLED;
  try { return await callback(); } finally {
    if (previous === undefined) delete process.env.ATHLETICMIND_EMERGENCY_HANDOFF_ENABLED;
    else process.env.ATHLETICMIND_EMERGENCY_HANDOFF_ENABLED = previous;
  }
}
function emergencyRecord() {
  return { userId: 'athlete-1', teamId: 'team-1', organizationId: 'organization-1', conversationId: 'conversation-1', tier: 3,
    category: 'immediate_safety', triggerContent: 'Synthetic current safety concern.', classificationReason: 'Synthetic immediate risk.',
    conversationSummary: 'Unrelated historical conversation must not be sent.', handoffStatus: 'pending', consentStatus: 'not-required', incident: {} };
}
const emergencyContext = { route: 'hotline', teamId: 'team-1', pilotContext: { organizationId: 'organization-1', pilotId: 'pilot-1', teamMembershipId: 'team-1_athlete-1' } };
const liveFixtureBridge = overrides => ({
  config: { provider: 'auntedna', credentialMode: 'live', apiKey: 'synthetic-fixture-only' },
  upsertAthlete: async () => ({ success: true, ok: true, deliveryMode: 'live', httpStatus: 200 }),
  createEscalation: async () => ({ success: true, ok: true, deliveryMode: 'live', httpStatus: 201, escalationId: 'case-1', requestId: 'receipt-1', status: 'received', data: { status: 'received' } }),
  ...overrides,
});

for (const organization of [{ productBrand: 'pulsecheck', appBranding: { pulsecheck: 'athleticmind' } }, {}, { productBrand: 'athleticmind' }]) {
  test(`critical direct coach notification is blocked regardless of product ${JSON.stringify(organization)}`, async () => {
    const { db, state } = createClinicalRuntimeDb(emergencyRecord());
    state.organization = organization;
    const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
    const result = await runtimeHelpers.notifyCoach({ escalationId: 'escalation-1', userId: 'athlete-1', coachId: 'coach-1' }, db);
    assert.equal(JSON.parse(result.body).reason, 'clinical_emergency_route_only');
    assert.equal(state.notifications.length, 0);
    assert.equal(state.record.coachNotified, undefined);
  });
}

for (const organization of [{ productBrand: 'pulsecheck' }, {}, { productBrand: 'invalid' }]) {
  test(`critical PulseCheck or unknown program provides resources without any handoff ${JSON.stringify(organization)}`, async () => {
    const record = emergencyRecord();
    const { db, state } = createClinicalRuntimeDb(record);
    state.organization = organization;
    let watchLists = 0;
    const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db, pilotMetrics: { applyPilotWatchList: async () => { watchLists++; } } });
    const result = await runtimeHelpers.triggerCriticalHandoff('athlete-1', 'conversation-1', 'escalation-1', record, { ...emergencyContext, route: 'clinician' }, db);
    assert.equal(result.success, true);
    assert.equal(result.resourcesOnly, true);
    assert.equal(result.providerConfirmed, false);
    assert.equal(state.record.handoffStatus, 'not_initiated');
    assert.equal(state.record.clinicalReferenceId, undefined);
    assert.equal(state.safetyState.emergencySupportMode, 'resources_only');
    assert.equal(state.safetyState.emergencyHandoffStatus, 'not_applicable');
    assert.match(result.message, /988/);
    assert.match(result.message, /Outside the U.S./);
    assert.equal(watchLists, 0);
    assert.equal(state.notifications.length, 0);
  });
}

test('Athletic Mind emergency delivery stays off and visibly failed until enabled', async () => withEmergencyDelivery(false, async () => {
  const record = emergencyRecord();
  const { db, state } = createClinicalRuntimeDb(record);
  state.organization = { productBrand: 'athleticmind', status: 'active' };
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  const result = await runtimeHelpers.triggerCriticalHandoff('athlete-1', 'conversation-1', 'escalation-1', record, { ...emergencyContext }, db);
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'ATHLETICMIND_EMERGENCY_HANDOFF_DISABLED');
  assert.equal(state.record.handoffStatus, 'failed');
  assert.equal(state.safetyState.emergencySupportMode, 'auntedna');
  assert.equal(state.safetyState.emergencyHandoffStatus, 'failed');
  assert.equal(state.notifications.length, 0);
}));

test('Athletic Mind emergency packet excludes unrelated profile, conversation, notes and state data', async () => withEmergencyDelivery(true, async () => {
  const record = { ...emergencyRecord(), stateSnapshot: { overallReadiness: 'red', stateDimensions: { focusReadiness: 20 } } };
  const { db: originalDb, state } = createClinicalRuntimeDb(record);
  state.organization = { productBrand: 'athleticmind', status: 'active' };
  state.userProfile = { displayName: 'Synthetic Athlete', email: 'athlete@example.test', phone: '+15550000000', goals: 'private goals', dateOfBirth: '2000-01-01', emergencyContact: { name: 'not a designated responder' }, primarySport: 'Track' };
  const db = { ...originalDb, collection(name) { assert.ok(!['user-mental-notes', 'conversations'].includes(name), 'Emergency must not load unrelated text'); return originalDb.collection(name); } };
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  let packet;
  const result = await runtimeHelpers.performClinicalHandoff('athlete-1', 'conversation-1', 'escalation-1', record, db, emergencyContext,
    () => liveFixtureBridge({ createEscalation: async payload => { packet = payload; return liveFixtureBridge().createEscalation(); } }));
  assert.equal(result.success, true);
  const Ajv = require('ajv');
  const schema = require('../../../docs/developer/clinical-bridge/emergency-handoff.schema.json');
  const validate = new Ajv({ allErrors: true }).compile(schema);
  assert.equal(validate(packet), true, JSON.stringify(validate.errors));
  assert.equal(packet.consentState.status, 'emergency_safety_basis');
  assert.deepEqual(Object.keys(packet.athlete).sort(), ['displayName', 'email', 'phone', 'userId']);
  assert.deepEqual(packet.relevantMentalNotes, []);
  assert.equal(packet.stateSnapshot, undefined);
  assert.notEqual(packet.conversationSummary, record.conversationSummary);
  assert.equal(packet.triggerContent, record.triggerContent);
  assert.equal(state.record.clinicalReceiptVerified, true);
  assert.equal(state.record.clinicalReceiptStatus, 'received');
  assert.equal(state.safetyState.appState, undefined, 'Receipt never means active care');
}));

for (const acknowledgement of [
  { deliveryMode: 'mock' }, { httpStatus: 503 }, { data: {} }, { escalationId: null }, { data: { status: 'failed' } },
]) {
  test(`unconfirmed Athletic Mind emergency response fails visibly ${JSON.stringify(acknowledgement)}`, async () => withEmergencyDelivery(true, async () => {
    const record = emergencyRecord();
    const { db, state } = createClinicalRuntimeDb(record);
    state.organization = { productBrand: 'athleticmind', status: 'active' };
    const alerts = [];
    const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db, pilotMetrics: { recordPilotMetricAlert: async alert => { alerts.push(alert); } } });
    const result = await runtimeHelpers.performClinicalHandoff('athlete-1', 'conversation-1', 'escalation-1', record, db, emergencyContext,
      () => liveFixtureBridge({ createEscalation: async () => ({ ...await liveFixtureBridge().createEscalation(), ...acknowledgement }) }));
    assert.equal(result.success, false);
    assert.equal(state.record.handoffStatus, 'failed');
    assert.equal(state.record.clinicalReceiptVerified, false);
    assert.equal(state.record.clinicalReferenceId, undefined);
    assert.equal(alerts.length, 1);
    assert.equal(JSON.stringify(alerts).includes(record.triggerContent), false);
  }));
}

test('lost emergency acknowledgement is retryable with the same incident ID and successful receipt dedupes', async () => withEmergencyDelivery(true, async () => {
  const { db, state } = createClinicalRuntimeDb(emergencyRecord());
  state.organization = { productBrand: 'athleticmind', status: 'active' };
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  const ids = [];
  const factory = () => liveFixtureBridge({ createEscalation: async payload => {
    ids.push(payload.escalationRecordId);
    if (ids.length === 1) throw new Error('Synthetic acknowledgement lost');
    return liveFixtureBridge().createEscalation();
  } });
  const attempt = () => runtimeHelpers.performClinicalHandoff('athlete-1', 'conversation-1', 'escalation-1', { ...state.record }, db, emergencyContext, factory);
  assert.equal((await attempt()).success, false);
  assert.equal(state.record.handoffStatus, 'failed');
  assert.equal((await attempt()).success, true);
  assert.deepEqual(ids, ['escalation-1', 'escalation-1']);
  assert.equal((await attempt()).deduped, true);
  assert.equal(ids.length, 2);
}));


test('critical source scope requires unique membership or matching persisted conversation scope', async () => {
  const { db, state } = createClinicalRuntimeDb();
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  const member = { id: 'membership-1', userId: 'athlete-1', role: 'athlete', status: 'active', teamId: 'team-1', organizationId: 'organization-1' };
  assert.equal(await runtimeHelpers.resolveCriticalSourceScope(db, 'athlete-1'), null);
  state.teamMemberships = [member];
  assert.deepEqual(await runtimeHelpers.resolveCriticalSourceScope(db, 'athlete-1'), { teamId: 'team-1', organizationId: 'organization-1', teamMembershipId: 'membership-1' });
  state.teamMemberships.push({ ...member, id: 'membership-2', teamId: 'team-2' });
  assert.equal(await runtimeHelpers.resolveCriticalSourceScope(db, 'athlete-1'), null);
  assert.equal((await runtimeHelpers.resolveCriticalSourceScope(db, 'athlete-1', { teamId: 'team-1', organizationId: 'organization-1' })).teamId, 'team-1');
  assert.equal(await runtimeHelpers.resolveCriticalSourceScope(db, 'athlete-1', { teamId: 'team-1', organizationId: 'different-org' }), null);
  state.teamMemberships = [{ ...member, organizationId: 'different-org' }];
  assert.equal(await runtimeHelpers.resolveCriticalSourceScope(db, 'athlete-1'), null);
  state.teamMemberships = [{ ...member, revokedAt: '2026-01-01' }];
  assert.equal(await runtimeHelpers.resolveCriticalSourceScope(db, 'athlete-1'), null);
});


test('private emergency actions deny role-only access but retain athlete handoff retry', async () => {
  const { db: originalDb, state } = createClinicalRuntimeDb(emergencyRecord());
  const db = { ...originalDb, collection(name) {
    if (name === 'pulsecheck-clinical-escalations') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ ...state.record }) }) }) };
    return originalDb.collection(name);
  } };
  state.organization = { productBrand: 'athleticmind', status: 'active' };
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  for (const action of ['consent', 'handoff', 'resolve']) {
    const result = await runtimeHelpers.authorizeEscalationAction({ caller: { uid: 'administrator', isAdmin: true }, action, body: { escalationId: 'escalation-1', userId: 'athlete-1' }, runtimeDb: db });
    assert.equal(result.ok, false, action);
    assert.equal(result.statusCode, 403);
  }
  assert.equal((await runtimeHelpers.authorizeEscalationAction({ caller: { uid: 'athlete-1' }, action: 'handoff', body: { escalationId: 'escalation-1' }, runtimeDb: db })).ok, true);
});


test('routine handoff refuses absent current membership before content or delivery', async () => {
  const { db } = createClinicalRuntimeDb();
  const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
  let delivered = false;
  const result = await runtimeHelpers.performClinicalHandoff('athlete-1', 'conversation-1', 'escalation-1',
    { tier: 2, consentStatus: 'accepted' }, db, { route: 'clinician', teamId: 'team-1', pilotContext: null },
    () => { delivered = true; throw new Error('Must not deliver'); });
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'HEALTH_AUTHORIZATION_REQUIRED');
  assert.equal(delivered, false);
});


for (const invalidScope of ['ended-team', 'archived-organization', 'wrong-organization', 'revoked-membership']) {
  test(`routine handoff refuses ${invalidScope} before delivery`, async () => {
    const { db, state } = createClinicalRuntimeDb();
    authorizeRoutineFixture(state);
    if (invalidScope === 'ended-team') state.team.status = 'inactive';
    if (invalidScope === 'archived-organization') state.organization.archivedAt = 'synthetic-time';
    if (invalidScope === 'wrong-organization') state.teamMemberships[0].organizationId = 'other-organization';
    if (invalidScope === 'revoked-membership') state.teamMemberships[0].revokedAt = 'synthetic-time';
    const { runtimeHelpers } = loadEscalationModule({ runtimeDb: db });
    let delivered = false;
    const result = await runtimeHelpers.performClinicalHandoff('athlete-1', 'conversation-1', 'escalation-1',
      { tier: 2, consentStatus: 'accepted' }, db, { route: 'clinician', teamId: 'team-1', pilotContext: null },
      () => { delivered = true; throw new Error('Must not deliver'); });
    assert.equal(result.success, false);
    assert.equal(result.error.code, 'HEALTH_AUTHORIZATION_REQUIRED');
    assert.equal(delivered, false);
  });
}
