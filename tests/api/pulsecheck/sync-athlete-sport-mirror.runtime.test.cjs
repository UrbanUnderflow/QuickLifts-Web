'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const fn = require('../../../netlify/functions/sync-athlete-sport-mirror');

test('sync-athlete-sport-mirror — _private export surface is intact', () => {
  const priv = fn._private;
  assert.equal(typeof priv.resolveCanonicalSport, 'function');
  assert.equal(typeof priv.isAdminClaim, 'function');
  assert.equal(typeof priv.normalizeString, 'function');
});

test('isAdminClaim — false for empty / undefined / non-admin', () => {
  const { isAdminClaim } = fn._private;
  assert.equal(isAdminClaim(undefined), false);
  assert.equal(isAdminClaim(null), false);
  assert.equal(isAdminClaim({}), false);
  assert.equal(isAdminClaim({ role: 'athlete' }), false);
});

test('isAdminClaim — true on any admin signal', () => {
  const { isAdminClaim } = fn._private;
  assert.equal(isAdminClaim({ admin: true }), true);
  assert.equal(isAdminClaim({ adminAccess: true }), true);
  assert.equal(isAdminClaim({ role: 'admin' }), true);
});

test('normalizeString — trims and tolerates non-strings', () => {
  const { normalizeString } = fn._private;
  assert.equal(normalizeString('  basketball '), 'basketball');
  assert.equal(normalizeString(''), '');
  assert.equal(normalizeString(undefined), '');
  assert.equal(normalizeString(42), '');
});

// In-memory Firestore Admin mock — only what resolveCanonicalSport touches.
function createAdminMockDb({ memberships = [], macraProfile = null } = {}) {
  const collections = new Map();

  // pulsecheck-team-memberships
  collections.set('pulsecheck-team-memberships', {
    where(field, op, value) {
      const filterChain = [{ field, op, value }];
      const builder = {
        where(field2, op2, value2) {
          filterChain.push({ field: field2, op: op2, value: value2 });
          return builder;
        },
        async get() {
          const docs = memberships.filter((entry) =>
            filterChain.every(({ field, op, value }) => {
              if (op !== '==') return true;
              return entry[field] === value;
            }),
          );
          return {
            docs: docs.map((data) => ({ data: () => data })),
          };
        },
      };
      return builder;
    },
  });

  // users/{uid}/macra/profile
  return {
    collection(name) {
      if (collections.has(name)) {
        return collections.get(name);
      }
      // users collection — only doc().collection('macra').doc('profile').get() is exercised
      return {
        doc(uid) {
          return {
            collection(sub) {
              return {
                doc(profileId) {
                  return {
                    async get() {
                      if (sub === 'macra' && profileId === 'profile') {
                        return {
                          exists: Boolean(macraProfile),
                          data: () => macraProfile,
                        };
                      }
                      return { exists: false, data: () => undefined };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

test('resolveCanonicalSport — PulseCheck team membership wins over Macra profile', async () => {
  const db = createAdminMockDb({
    memberships: [
      {
        userId: 'athlete-1',
        status: 'active',
        athleteOnboarding: {
          sportId: 'basketball',
          sportName: 'Basketball',
          sportPosition: 'Point Guard',
        },
      },
    ],
    macraProfile: {
      sportId: 'soccer',
      sportName: 'Soccer',
    },
  });
  const result = await fn._private.resolveCanonicalSport(db, 'athlete-1');
  assert.equal(result.source, 'pulsecheck_membership');
  assert.equal(result.fields.athleteSport, 'basketball');
  assert.equal(result.fields.athleteSportPosition, 'Point Guard');
});

test('resolveCanonicalSport — Macra fallback when no PulseCheck membership has a sport', async () => {
  const db = createAdminMockDb({
    memberships: [],
    macraProfile: {
      sportId: 'tennis',
      sportName: 'Tennis',
    },
  });
  const result = await fn._private.resolveCanonicalSport(db, 'athlete-1');
  assert.equal(result.source, 'macra_profile');
  assert.equal(result.fields.athleteSport, 'tennis');
});

test('resolveCanonicalSport — returns no_source when neither has a sport', async () => {
  const db = createAdminMockDb({ memberships: [], macraProfile: null });
  const result = await fn._private.resolveCanonicalSport(db, 'athlete-1');
  assert.equal(result.source, 'no_source');
  assert.deepEqual(result.fields, {});
});

test('resolveCanonicalSport — skips membership rows with empty sport', async () => {
  const db = createAdminMockDb({
    memberships: [
      { userId: 'athlete-1', status: 'active', athleteOnboarding: { sportId: '' } },
    ],
    macraProfile: { sportId: 'volleyball' },
  });
  const result = await fn._private.resolveCanonicalSport(db, 'athlete-1');
  assert.equal(result.source, 'macra_profile');
  assert.equal(result.fields.athleteSport, 'volleyball');
});
