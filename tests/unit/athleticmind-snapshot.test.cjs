const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../../src/content/consents/athleticmind-processing-v1.json');
const { assembleAthleticMindSnapshot, checkAthleticMindSnapshotEligibility } = require('../../netlify/functions/lib/athleticmind-snapshot');
const T = Date.parse('2026-10-10T00:00:00Z');
const iso = offset => new Date(T + offset).toISOString();
const params = { teamId: 'team', athleteId: 'athlete', windowStart: iso(3600000), windowEnd: iso(7200000), now: T + 7200000 };
const receipt = () => ({ decision: 'accepted', version: policy.version, signedName: 'Test Athlete', decidedAt: iso(0), document: { ...policy } });
function fixture() {
  return {
    'pulsecheck-teams/team': { status: 'active', organizationId: 'org' },
    'pulsecheck-organizations/org': { status: 'active', productBrand: 'athleticmind' },
    'pulsecheck-team-memberships/team_athlete': { status: 'active', teamId: 'team', organizationId: 'org', userId: 'athlete', role: 'athlete', athleteOnboarding: { productConsentAccepted: true, requiredConsents: [{ ...policy }], consentDecisions: { [policy.id]: receipt() }, intakeResponses: { currentGoal: 'Stay focused' }, intakeFormVersion: 'v1', intakeCompletedAt: T - 1000 } },
    'pulsecheck-team-memberships/team_athlete/consent-events/accepted': { actorUserId: 'athlete', recordedAt: T + 100, decisions: { [policy.id]: receipt() } },
  };
}
function fakeDb(rows, times = {}) {
  const reads = [];
  const snapshot = path => ({ id: path.split('/').at(-1), exists: !!rows[path], data: () => rows[path], createTime: new Date(times[path]?.createdAt ?? T + 200), updateTime: new Date(times[path]?.updatedAt ?? T + 4000000) });
  function collection(path, filters = [], max = Infinity) {
    return { doc(id) { const key = `${path}/${id}`; return { get: async () => { reads.push(key); return snapshot(key); }, collection: child => collection(`${key}/${child}`) }; }, where(field, operator, value) { assert.equal(operator, '=='); return collection(path, [...filters, [field, value]], max); }, limit(value) { return collection(path, filters, value); }, async get() { reads.push(path); return { docs: Object.keys(rows).filter(key => key.startsWith(`${path}/`) && key.split('/').length === path.split('/').length + 1 && filters.every(([field, value]) => rows[key][field] === value)).slice(0, max).map(snapshot) }; } };
  }
  return { collection, reads };
}
const membership = rows => rows['pulsecheck-team-memberships/team_athlete'];
function scheduled(rows, id, turns, extra = {}) { rows[`pulsecheck-nora-conversations/${id}`] = { athleteUserId: 'athlete', teamId: 'team', turns, ...extra }; }

test('inactive brands, invalid membership, missing new receipts, and forged evidence fail before sensitive reads', async () => {
  for (const mutate of [
    rows => { rows['pulsecheck-organizations/org'].productBrand = 'pulsecheck'; },
    rows => { delete rows['pulsecheck-organizations/org'].productBrand; },
    rows => { membership(rows).organizationId = 'other'; },
    rows => { membership(rows).status = 'inactive'; },
    rows => { membership(rows).athleteOnboarding.productConsentAccepted = false; },
    rows => { membership(rows).athleteOnboarding.requiredConsents = []; },
    rows => { membership(rows).athleteOnboarding.consentDecisions[policy.id].document.body = 'Old terms'; },
    rows => { delete rows['pulsecheck-team-memberships/team_athlete/consent-events/accepted']; },
    rows => { rows['pulsecheck-team-memberships/team_athlete/consent-events/accepted'].actorUserId = 'other'; },
  ]) {
    const rows = fixture(); mutate(rows); const db = fakeDb(rows);
    const result = await assembleAthleticMindSnapshot(db, params);
    assert.equal(result.eligible, false); assert.equal(result.snapshot, null);
    assert.ok(!db.reads.includes('conversations'));
  }
});

test('latest append-only revocation defeats stale accepted membership; repeated saves preserve acceptance', async () => {
  const rows = fixture();
  rows['pulsecheck-team-memberships/team_athlete/consent-events/repeated'] = { actorUserId: 'athlete', recordedAt: T + 2000, decisions: { [policy.id]: receipt() } };
  let result = await checkAthleticMindSnapshotEligibility(fakeDb(rows), params);
  assert.equal(result.consent.acceptedAt, iso(100));
  rows['pulsecheck-team-memberships/team_athlete/consent-events/revoked'] = { actorUserId: 'athlete', recordedAt: T + 3000, decisions: { [policy.id]: { ...receipt(), decision: 'revoked' } } };
  result = await checkAthleticMindSnapshotEligibility(fakeDb(rows), params);
  assert.equal(result.eligible, false);
});

test('current intake, scoped full messages and deterministic counts exclude unrelated, optional and private fields', async () => {
  const rows = fixture();
  rows['pulsecheck-morning-checkins/check'] = { athleteUserId: 'athlete', teamId: 'team', organizationId: 'org', dayKey: '2026-10-10', level: 'solid', createdAt: T + 3800000, updatedAt: T + 3800000, privateJournal: 'NEVER_COPY' };
  scheduled(rows, 'scheduled', [{ turnId: 'turn1', role: 'athlete-reply', text: 'Full text. '.repeat(100), createdAt: T + 3900000 }, { turnId: 'turn2', role: 'nora-action', text: 'Try this.', createdAt: T + 3900001 }], { staffNotes: 'NEVER_COPY', rawModelOutput: 'NEVER_COPY' });
  scheduled(rows, 'other', [{ turnId: 'other', role: 'athlete-reply', text: 'NEVER_COPY', createdAt: T + 3900000 }], { teamId: 'other-team' });
  rows['conversations/global'] = { userId: 'athlete', messages: [{ id: 'raw', content: 'NEVER_COPY', timestamp: (T + 3900000) / 1000, isFromUser: true }] };
  rows['conversations/scoped'] = { userId: 'athlete', teamId: 'team', organizationId: 'org', messages: [{ id: 'main', trustedSource: { kind: 'nora_chat', recordedBy: 'pulsecheck-chat-v2' }, content: 'Explicitly scoped full message', timestamp: (T + 3900000) / 1000, isFromUser: true }] };
  rows['escalation-records/support'] = { userId: 'athlete', teamId: 'team', organizationId: 'org', status: 'active', handoffStatus: 'pending', createdAt: (T + 3900000) / 1000, summary: 'NEVER_COPY', staffNotes: 'NEVER_COPY' };
  const result = await assembleAthleticMindSnapshot(fakeDb(rows), params);
  assert.equal(result.eligible, true);
  assert.deepEqual(result.snapshot.onboarding.responses, { currentGoal: 'Stay focused' });
  assert.equal(result.snapshot.noraMessages.length, 3); assert.equal(result.snapshot.checkIns.length, 1);
  assert.equal(result.snapshot.summary.noraMessageCount, 3); assert.equal(result.snapshot.supportStatus.length, 1);
  assert.ok(!JSON.stringify(result).includes('NEVER_COPY'));
  assert.equal(result.snapshot.synthetic, false); assert.equal(result.snapshot.coverage.completeFullNoraTranscript, false);
  assert.equal(result.snapshot.snapshotId, (await assembleAthleticMindSnapshot(fakeDb(rows), { ...params, now: T + 7300000 })).snapshot.snapshotId);
});

test('new messages in old documents and restricted transcript placeholders are excluded', async () => {
  const rows = fixture();
  scheduled(rows, 'old', [{ turnId: 'old-turn', role: 'athlete-reply', text: 'Earlier conversation', createdAt: T + 3900000 }]);
  rows['conversations/restricted'] = { userId: 'athlete', teamId: 'team', organizationId: 'org', storagePolicy: { restricted: true }, messages: [{ id: 'secret', content: 'SECRET', timestamp: (T + 3900000) / 1000, isFromUser: true }] };
  const result = await assembleAthleticMindSnapshot(fakeDb(rows, { 'pulsecheck-nora-conversations/old': { createdAt: T - 1000 } }), params);
  assert.equal(result.snapshot.noraMessages.length, 0);
});

test('late ingestion includes post-acceptance event before window; replay gives stable revision identity', async () => {
  const rows = fixture();
  scheduled(rows, 'late', [{ turnId: 'late-turn', role: 'athlete-reply', text: 'Late arriving', createdAt: T + 300000 }]);
  const result = await assembleAthleticMindSnapshot(fakeDb(rows), params);
  assert.equal(result.snapshot.noraMessages.length, 1);
  assert.equal(result.snapshot.noraMessages[0].eventAt, iso(300000));
  assert.equal(result.snapshot.noraMessages[0].sourceIngestedAt, iso(4000000));
  assert.match(result.snapshot.noraMessages[0].revision, /^[a-f0-9]{64}$/);
  const replay = await assembleAthleticMindSnapshot(fakeDb(rows, { 'pulsecheck-nora-conversations/late': { updatedAt: T + 5000000 } }), params);
  assert.equal(result.snapshot.noraMessages[0].revision, replay.snapshot.noraMessages[0].revision);
});

test('combined checkin components without separate scope are omitted with explicit gap', async () => {
  const rows = fixture();
  rows['pulsecheck-morning-checkins/combined'] = { athleteUserId: 'athlete', teamId: 'team', organizationId: 'org', level: 'solid', createdAt: T + 3800000, eveningCheckIn: { level: 'locked', createdAt: T + 3900000 } };
  const result = await assembleAthleticMindSnapshot(fakeDb(rows), params);
  assert.equal(result.snapshot.checkIns.length, 0);
  assert.ok(result.snapshot.coverage.missing.includes('checkin_component_scope_ambiguous'));
});

test('bounded scans throw rather than export silently truncated data; future windows fail closed', async () => {
  const rows = fixture();
  for (let index = 0; index < 5001; index += 1) scheduled(rows, `record${index}`, []);
  await assert.rejects(assembleAthleticMindSnapshot(fakeDb(rows), params), /SCAN_LIMIT:scheduled_nora/);
  assert.equal((await assembleAthleticMindSnapshot(fakeDb(fixture()), { ...params, windowEnd: iso(9000000) })).eligible, false);
});

async function sharedJournal(rows, { entryId = 'journal', teamId = 'team', organizationId = 'org' } = {}) {
  const { journalEntryRevision } = require('../../netlify/functions/lib/journal-sharing');
  const eligibility = await checkAthleticMindSnapshotEligibility(fakeDb(rows), params);
  const entry = { moment: 'Synthetic private journal text', action: null, createdAt: T - 86400000, updatedAt: T - 86400000 };
  rows[`pulsecheck-evidence-journals/athlete/entries/${entryId}`] = entry;
  const permission = { entryId, athleteId: 'athlete', teamId, organizationId, status: 'shared', entryRevision: journalEntryRevision(entry), permissionVersion: 'athleticmind-journal-sharing-v1', permissionEventId: `permission-${entryId}`, sharedAt: T + 3700000, updatedAt: T + 3700000, processingConsentEventId: eligibility.consent.eventId, processingDocumentHash: eligibility.consent.documentHash, processingConsentVersion: eligibility.consent.version };
  rows[`pulsecheck-evidence-journals/athlete/sharing/${entryId}`] = permission;
  return { entry, permission };
}
test('only newly authorized exact-entry journals are read/exported; explicit sharing can include earlier writing', async () => {
  const rows = fixture();
  rows['pulsecheck-evidence-journals/athlete/entries/private'] = { moment: 'NEVER_READ_PRIVATE', createdAt: T, updatedAt: T };
  const { entry } = await sharedJournal(rows);
  const db = fakeDb(rows), result = await assembleAthleticMindSnapshot(db, params);
  assert.equal(result.snapshot.schemaVersion, 'athleticmind-snapshot-v2');
  assert.equal(result.snapshot.journalEntries.length, 1);
  assert.equal(result.snapshot.journalEntries[0].moment, entry.moment);
  assert.equal(result.snapshot.journalEntries[0].action, null);
  assert.equal(result.snapshot.journalEntries[0].sharing.status, 'shared');
  assert.equal(result.snapshot.journalEntries[0].type, 'evidence');
  assert.equal(result.snapshot.journalEntries[0].createdAt, iso(-86400000));
  assert.equal(result.snapshot.journalEntries[0].sharing.permissionVersion, 'athleticmind-journal-sharing-v1');
  assert.equal(db.reads.some(path => path.endsWith('/entries/private')), false);
  const Ajv = require('ajv');
  const validate = new Ajv({ allErrors: true }).compile(require('../../docs/developer/athleticmind-snapshots/snapshot.schema.json'));
  assert.equal(validate(result.snapshot), true, JSON.stringify(validate.errors));
});
test('other-team, personal, legacy, stale consent and untrusted entry permissions cannot read or export journal text', async () => {
  for (const change of [p => { p.teamId = 'other'; }, p => { p.organizationId = 'other'; }, p => { p.teamId = null; p.organizationId = null; p.permissionVersion = 'nora-journal-sharing-v1'; }, p => { delete p.permissionVersion; }, p => { p.processingConsentEventId = 'old'; }, p => { p.processingDocumentHash = 'old'; }, p => { p.athleteId = 'other'; }]) {
    const rows = fixture(), { permission } = await sharedJournal(rows); change(permission);
    const db = fakeDb(rows), result = await assembleAthleticMindSnapshot(db, params);
    assert.equal(result.snapshot.journalEntries.length, 0);
    assert.equal(db.reads.some(path => path.endsWith('/entries/journal')), false);
  }
});
test('edit, unshare and deletion block frozen journal replay and produce text-free withdrawals', async () => {
  const { isSnapshotReplayPermitted } = require('../../netlify/functions/lib/athleticmind-snapshot-delivery');
  const { revalidateSnapshotJournalSources } = require('../../netlify/functions/lib/athleticmind-snapshot');
  for (const change of [({entry}) => { entry.moment = 'Changed after sharing'; }, ({permission}) => { permission.status = 'unshared'; }, (_state, rows) => { delete rows['pulsecheck-evidence-journals/athlete/entries/journal']; }]) {
    const rows = fixture(), state = await sharedJournal(rows), db = fakeDb(rows);
    const first = (await assembleAthleticMindSnapshot(db, params)).snapshot;
    assert.equal(await revalidateSnapshotJournalSources(db, first, { now: params.now }), true);
    change(state, rows);
    assert.equal(await revalidateSnapshotJournalSources(db, first, { now: params.now }), false);
    const current = (await assembleAthleticMindSnapshot(db, params)).snapshot;
    assert.equal(current.journalEntries.length, 0);
    assert.equal(current.journalWithdrawals.length, 1);
    assert.equal(JSON.stringify(current.journalWithdrawals).includes('Synthetic private'), false);
    assert.equal(isSnapshotReplayPermitted(first, current), false);
  }
});
test('withdrawal events preserve former scope after moving current sharing to another team and repeat outside the window', async () => {
  const rows = fixture(), { permission } = await sharedJournal(rows);
  rows['pulsecheck-evidence-journals/athlete/sharing-events/withdrawal'] = { ...permission, status: 'unshared', updatedAt: T + 3500000 };
  permission.teamId = 'other'; permission.organizationId = 'other-org';
  const result = (await assembleAthleticMindSnapshot(fakeDb(rows), params)).snapshot;
  assert.equal(result.journalEntries.length, 0);
  assert.equal(result.journalWithdrawals.length, 1);
  assert.equal(result.journalWithdrawals[0].permissionEventId, 'permission-journal');
  rows['pulsecheck-evidence-journals/athlete/sharing-events/withdrawal'].teamId = 'other';
  assert.equal((await assembleAthleticMindSnapshot(fakeDb(rows), params)).snapshot.journalWithdrawals.length, 0);
});
test('journal-derived and ambiguous legacy Nora conversations cannot duplicate journal text or dependent responses', async () => {
  const rows = fixture();
  const trustedSource = { kind: 'nora_chat', recordedBy: 'pulsecheck-chat-v2' };
  const messages = [{ id: 'user', isFromUser: true, content: 'Journal copy', timestamp: T + 3800000 }, { id: 'reply', isFromUser: false, content: 'Dependent quoted text', timestamp: T + 3900000, trustedSource }];
  rows['conversations/legacy'] = { userId: 'athlete', teamId: 'team', organizationId: 'org', messages };
  rows['conversations/journal'] = { userId: 'athlete', teamId: 'team', organizationId: 'org', trustedSource: { kind: 'journal', recordedBy: 'pulsecheck-chat-v2' }, messages: messages.map(m => ({ ...m, trustedSource })) };
  const result = (await assembleAthleticMindSnapshot(fakeDb(rows), params)).snapshot;
  assert.equal(result.noraMessages.length, 0);
  assert.ok(result.coverage.missing.includes('legacy_nora_conversation_provenance_unverified'));
  assert.ok(result.coverage.missing.includes('journal_derived_nora_conversation_excluded'));
});
