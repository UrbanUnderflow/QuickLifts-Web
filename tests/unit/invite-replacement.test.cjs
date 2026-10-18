const test = require('node:test');
const assert = require('node:assert/strict');
const { replaceInviteAtomically } = require('../../src/lib/pulsecheck/replaceInvite');

function fixture() {
  const rows = { team: { organizationId: 'org', status: 'active' }, org: { status: 'active' }, old: { status: 'active', token: 'old', teamId: 'team', organizationId: 'org', inviteType: 'admin-activation' } };
  const ref = id => ({ id });
  let tail = Promise.resolve();
  const runTransaction = body => {
    const result = tail.then(async () => {
      const staged = structuredClone(rows);
      const value = await body({
        get: async reference => ({ id: reference.id, ref: reference, exists: () => Boolean(staged[reference.id]), data: () => staged[reference.id] }),
        set: (reference, data, options) => { staged[reference.id] = options?.merge ? { ...staged[reference.id], ...data } : data; },
        update: (reference, data) => {
          for (const [key, value] of Object.entries(data)) {
            const parts = key.split('.');
            if (parts.length === 2) { staged[reference.id][parts[0]] ||= {}; staged[reference.id][parts[0]][parts[1]] = value; }
            else staged[reference.id][key] = value;
          }
        },
      });
      if (rows.failCommit) throw new Error('commit interrupted');
      Object.assign(rows, staged);
      return value;
    });
    tail = result.catch(() => {});
    return result;
  };
  const replace = token => replaceInviteAtomically({ runTransaction, teamRef: ref('team'), organizationRef: ref('org'), inviteRefFor: ref,
    previousRefs: [ref('old')], pointerKey: 'scope', reuse: false, timestamp: 1,
    payload: { token, teamId: 'team', organizationId: 'org', status: 'active', inviteType: 'admin-activation', activationUrl: `https://example.test/${token}` } });
  return { rows, replace };
}

test('failed replacement preserves the previously usable link', async () => {
  const { rows, replace } = fixture();
  rows.failCommit = true;
  await assert.rejects(replace('new'));
  assert.equal(rows.old.status, 'active');
  assert.equal(rows.new, undefined);
  delete rows.failCommit;
  await replace('new');
  assert.equal(rows.old.status, 'revoked');
  assert.equal(rows.new.status, 'active');
});

test('concurrent replacements converge through parent pointer even with stale query results', async () => {
  const { rows, replace } = fixture();
  await Promise.all([replace('first'), replace('second')]);
  assert.equal(rows.old.status, 'revoked');
  assert.equal(rows.first.status, 'revoked');
  assert.equal(rows.second.status, 'active');
  assert.equal(rows.team.inviteReplacementPointers.scope, 'second');
});
