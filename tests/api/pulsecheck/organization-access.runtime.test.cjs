const test = require('node:test');
const assert = require('node:assert/strict');
const { organizationTeamIsActive } = require('../../../netlify/functions/lib/organization-access');
const db = (team, org) => ({ collection: name => ({ doc: () => ({ get: async () => ({ exists: !!(name === 'pulsecheck-teams' ? team : org), data: () => name === 'pulsecheck-teams' ? team : org }) }) }) });
test('team scope requires a live organization and matching binding', async () => {
  const team = { status: 'active', organizationId: 'org' };
  assert.equal(await organizationTeamIsActive(db(team, { status: 'active' }), 'team', 'org'), true);
  for (const org of [null, { status: 'deleted' }, { status: 'active', deletedAt: 1 }, { status: 'active', archivedAt: 1 }]) assert.equal(await organizationTeamIsActive(db(team, org), 'team', 'org'), false);
  assert.equal(await organizationTeamIsActive(db(team, { status: 'active' }), 'team', 'different'), false);
  assert.equal(await organizationTeamIsActive(db({ ...team, status: 'deleted' }, { status: 'active' }), 'team'), false);
});
test('a restored parent allows existing active team scope again', async () => {
  const org = { status: 'deleted', deletedAt: 1 };
  const store = db({ status: 'active', organizationId: 'org' }, org);
  assert.equal(await organizationTeamIsActive(store, 'team'), false);
  org.status = 'active'; org.deletedAt = null;
  assert.equal(await organizationTeamIsActive(store, 'team'), true);
});
