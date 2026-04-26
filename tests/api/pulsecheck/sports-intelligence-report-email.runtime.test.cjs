const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';
const functionPath = path.join(repoRoot, 'netlify/functions/send-sports-intelligence-report-email.js');
const configPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');
const brevoHelperPath = path.join(repoRoot, 'netlify/functions/utils/sendBrevoTransactionalEmail.js');

const deepMerge = (target, patch) => {
  for (const [key, value] of Object.entries(patch || {})) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
};

const buildEmailDedupeKey = (parts) =>
  parts
    .map((part) => String(part || '').trim().toLowerCase())
    .filter(Boolean)
    .join('::')
    .replace(/\//g, '%2f');

function createReportFixture(overrides = {}) {
  return deepMerge(
    {
      teamId: 'team-umes-basketball',
      sportId: 'basketball',
      weekStart: '2026-04-20',
      reportType: 'weekly',
      reviewStatus: 'published',
      deliveryStatus: 'queued',
      coachSurface: {
        meta: {
          teamId: 'team-umes-basketball',
          teamName: 'UMES Women',
          sportId: 'basketball',
          sportName: 'Basketball',
          reportType: 'weekly',
          weekStart: '2026-04-20',
          weekLabel: 'Week of Apr 20, 2026',
          reviewStatus: 'published',
        },
        topLine: {
          whatChanged: 'The high-minute guard group is carrying more practice stress into late-clock work.',
          who: 'D. Miles and K. Johnson',
          firstAction: 'Keep Tuesday walkthrough short and protect the first live segment.',
        },
        dimensionState: {
          focus: 'solid',
          composure: 'watch',
          decisioning: 'watch',
        },
        watchlist: [],
        coachActions: [],
        gameDayLookFors: [],
        closer: 'Bring this into the Sunday staff plan and keep the first action simple.',
        adherence: {
          deviceCoveragePct: 0.86,
          noraCompletionPct: 0.78,
          protocolSimulationCompletionPct: 0.74,
          trainingNutritionCoveragePct: 0.7,
          confidenceLabel: 'Usable read',
        },
      },
      reviewerOnly: {
        evidence: {
          confidenceTier: 'high_confidence',
          thresholdTrace: ['rmssdMs and externalLoadAU stay internal-only here'],
        },
        auditTrace: {},
      },
    },
    overrides
  );
}

function createDb({ report = createReportFixture(), memberships = [], sports = [] } = {}) {
  const writes = {
    reportSets: [],
  };
  const reportStore = JSON.parse(JSON.stringify(report));

  const reportRef = {
    async get() {
      return {
        id: 'report-week-1',
        exists: Boolean(reportStore),
        data: () => reportStore,
      };
    },
    async set(data, options) {
      writes.reportSets.push({ data, options });
      if (options?.merge) {
        deepMerge(reportStore, data);
      } else {
        Object.keys(reportStore).forEach((key) => delete reportStore[key]);
        Object.assign(reportStore, data);
      }
    },
  };

  const makeDocSnap = (entry) => ({
    id: entry.id,
    exists: true,
    data: () => entry.data,
  });

  return {
    writes,
    reportStore,
    collection(name) {
      if (name === 'teams') {
        return {
          doc(teamId) {
            assert.equal(teamId, 'team-umes-basketball');
            return {
              collection(subcollectionName) {
                assert.equal(subcollectionName, 'coachReports');
                return {
                  doc(reportId) {
                    assert.equal(reportId, 'report-week-1');
                    return reportRef;
                  },
                };
              },
            };
          },
        };
      }

      if (name === 'company-config') {
        return {
          doc(docId) {
            assert.equal(docId, 'pulsecheck-sports');
            return {
              async get() {
                return {
                  exists: true,
                  data: () => ({ sports }),
                };
              },
            };
          },
        };
      }

      if (name === 'users') {
        return {
          doc(userId) {
            return {
              async get() {
                return {
                  exists: false,
                  data: () => ({ userId }),
                };
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-team-memberships') {
        const constraints = [];
        const queryRef = {
          where(field, op, value) {
            constraints.push({ field, op, value });
            return queryRef;
          },
          async get() {
            const filtered = memberships.filter((entry) =>
              constraints.every((constraint) => {
                const actual = entry.data[constraint.field];
                if (constraint.op === '==') return actual === constraint.value;
                if (constraint.op === 'in') return constraint.value.includes(actual);
                throw new Error(`Unsupported op ${constraint.op}`);
              })
            );
            return { docs: filtered.map(makeDocSnap) };
          },
        };
        return queryRef;
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

function loadHandler({ db, sendCalls }) {
  delete require.cache[functionPath];
  delete require.cache[configPath];
  delete require.cache[brevoHelperPath];

  const firestoreFn = () => db;
  firestoreFn.FieldValue = {
    serverTimestamp: () => 'server-timestamp',
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      initializeFirebaseAdmin: () => {},
      getFirebaseAdminApp: () => ({}),
      admin: {
        firestore: firestoreFn,
      },
      headers: {},
    },
  };

  require.cache[brevoHelperPath] = {
    id: brevoHelperPath,
    filename: brevoHelperPath,
    loaded: true,
    exports: {
      buildEmailDedupeKey,
      sendBrevoTransactionalEmail: async (args) => {
        sendCalls.push(args);
        return { success: true, messageId: `brevo-${sendCalls.length}` };
      },
    },
  };

  return require(functionPath).handler;
}

test('sends published Sports Intelligence reports to active coach recipients and persists sent audit', async () => {
  const sendCalls = [];
  const db = createDb({
    memberships: [
      {
        id: 'm-admin',
        data: {
          teamId: 'team-umes-basketball',
          userId: 'coach-admin',
          email: 'Coach@UMES.edu',
          role: 'team-admin',
          status: 'active',
        },
      },
      {
        id: 'm-duplicate',
        data: {
          teamId: 'team-umes-basketball',
          userId: 'coach-admin-copy',
          email: ' coach@umes.edu ',
          role: 'coach',
          status: 'active',
        },
      },
      {
        id: 'm-staff',
        data: {
          teamId: 'team-umes-basketball',
          userId: 'perf-1',
          email: 'performance@umes.edu',
          role: 'performance-staff',
          status: 'active',
        },
      },
      {
        id: 'm-inactive',
        data: {
          teamId: 'team-umes-basketball',
          userId: 'inactive-1',
          email: 'inactive@umes.edu',
          role: 'coach',
          status: 'inactive',
        },
      },
      {
        id: 'm-athlete',
        data: {
          teamId: 'team-umes-basketball',
          userId: 'athlete-1',
          email: 'athlete@umes.edu',
          role: 'athlete',
          status: 'active',
        },
      },
    ],
    sports: [
      {
        id: 'basketball',
        reportPolicy: {
          languagePosture: {
            mustAvoid: ['Generic hustle advice'],
          },
        },
      },
    ],
  });
  const handler = loadHandler({ db, sendCalls });

  const response = await handler({
    httpMethod: 'POST',
    headers: {},
    body: JSON.stringify({ teamId: 'team-umes-basketball', reportId: 'report-week-1' }),
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.success, true);
  assert.equal(body.sentCount, 2);
  assert.equal(sendCalls.length, 2);
  assert.deepEqual(sendCalls.map((call) => call.toEmail).sort(), ['coach@umes.edu', 'performance@umes.edu']);
  assert.equal(sendCalls[0].subject, 'Basketball · Week of Apr 20, 2026 — your Sports Intelligence read');
  assert.match(sendCalls[0].htmlContent, /Open the report/);
  assert.doesNotMatch(sendCalls[0].htmlContent, /rmssdMs|high_confidence|externalLoadAU/);
  assert.equal(sendCalls[0].idempotencyMetadata.baseIdempotencyKey, 'si-report-v1::team-umes-basketball::report-week-1');
  assert.match(sendCalls[0].idempotencyKey, /^si-report-v1::team-umes-basketball::report-week-1::/);
  assert.equal(sendCalls[0].bypassDailyRecipientLimit, undefined);
  assert.equal(sendCalls[0].dailyRecipientMetadata.sequence, 'si-report-v1');

  assert.equal(db.reportStore.reviewStatus, 'sent');
  assert.equal(db.reportStore.deliveryStatus, 'sent');
  assert.equal(db.reportStore.sentAt, 'server-timestamp');
  assert.equal(db.reportStore.sentTo.length, 2);
  assert.equal(db.reportStore.emailDelivery.sentCount, 2);
});

test('blocks delivery when coach-facing copy fails the language posture audit', async () => {
  const sendCalls = [];
  const db = createDb({
    report: createReportFixture({
      coachSurface: {
        topLine: {
          whatChanged: 'ACWR jumped past the line this week.',
        },
      },
    }),
    memberships: [
      {
        id: 'm-admin',
        data: {
          teamId: 'team-umes-basketball',
          userId: 'coach-admin',
          email: 'coach@umes.edu',
          role: 'team-admin',
          status: 'active',
        },
      },
    ],
  });
  const handler = loadHandler({ db, sendCalls });

  const response = await handler({
    httpMethod: 'POST',
    headers: {},
    body: JSON.stringify({ teamId: 'team-umes-basketball', reportId: 'report-week-1' }),
  });

  assert.equal(response.statusCode, 422);
  const body = JSON.parse(response.body);
  assert.equal(body.success, false);
  assert.equal(body.auditResult.passed, false);
  assert.ok(body.auditResult.violations.some((violation) => violation.phrase === 'ACWR'));
  assert.equal(sendCalls.length, 0);
  assert.equal(db.reportStore.deliveryStatus, 'failed');
  assert.equal(db.reportStore.reviewerOnly.auditTrace.localizationAuditResult.passed, false);
});

test('rejects non-POST requests before touching Firestore or Brevo', async () => {
  const sendCalls = [];
  const db = createDb();
  const handler = loadHandler({ db, sendCalls });

  const response = await handler({
    httpMethod: 'GET',
    headers: {},
    body: '',
  });

  assert.equal(response.statusCode, 405);
  assert.equal(sendCalls.length, 0);
  assert.equal(db.writes.reportSets.length, 0);
});
