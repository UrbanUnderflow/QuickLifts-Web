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

function fixture({ memberships, team = {}, org = {} } = {}) {
 const records = {
  'pulsecheck-teams/team-a': { organizationId: 'org-a', status: 'active', ...team },
  'pulsecheck-organizations/org-a': { productBrand: 'athleticmind', status: 'active', ...org },
 };
 const members = memberships || [{ userId: 'athlete', role: 'athlete', status: 'active', teamId: 'team-a', organizationId: 'org-a' }, { userId: 'athlete', role: 'athlete', status: 'active', teamId: 'team-b', organizationId: 'org-b' }];
 return { collection(name) {
   return { doc(id) { return { async get() { const value = records[`${name}/${id}`]; return { exists: !!value, data: () => value }; } }; },
    where() { return this; }, limit() { return this; }, async get() { return { docs: members.map((value, i) => ({id: `membership-${i}`,data: () => value})) }; } };
 } };
}
test('trusted explicit journal scope chooses exact AM membership among multiple teams', async () => {
 const db = fixture(); const { resolveTrustedJournalScope } = loadEscalationModule({runtimeDb: db}).runtimeHelpers;
 const result = await resolveTrustedJournalScope(db, 'athlete', {teamId:'team-a',organizationId:'org-a'});
 assert.deepEqual(result, {explicit:true,scope:{teamId:'team-a',organizationId:'org-a',teamMembershipId:'membership-0'}});
});
test('invalid explicit journal scope never falls back to another membership', async () => {
 for (const db of [fixture({team:{status:'inactive'}}),fixture({org:{productBrand:'pulsecheck'}}),fixture({org:{status:'inactive'}}),fixture({team:{organizationId:'different'}}),fixture({memberships:[{teamId:'team-b',organizationId:'org-b'}]})]) {
  const {resolveTrustedJournalScope}=loadEscalationModule({runtimeDb:db}).runtimeHelpers;
  assert.deepEqual(await resolveTrustedJournalScope(db,'athlete',{teamId:'team-a',organizationId:'org-a'}),{explicit:true,scope:null});
 }
});
test('personal journal scope leaves separate emergency membership resolution unchanged', async () => {
 const db = {collection(){throw new Error('personal scope must not resolve routine program');}};
 const {resolveTrustedJournalScope}=loadEscalationModule({runtimeDb:db}).runtimeHelpers;
 for (const scope of [undefined,null,{teamId:null,organizationId:null}]) assert.deepEqual(await resolveTrustedJournalScope(db,'athlete',scope),{explicit:false,scope:null});
 assert.deepEqual(await resolveTrustedJournalScope(db,'athlete',{teamId:'team-a'}),{explicit:true,scope:null});
});
