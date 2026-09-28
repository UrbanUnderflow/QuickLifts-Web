const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const {
  resolvePulseCheckYouthTrack,
  effectiveYouthTrack,
  parseYouthTrack,
  allowsDirectNoraChat,
} = require(path.join(repoRoot, 'netlify/functions/utils/pulsecheck-youth-track.js'));

/** Firestore double for the two reads the resolver makes. `failTeams` and `failMemberships` simulate read errors. */
function createDb({ memberships = [], teams = {}, failTeams = [], failMemberships = false } = {}) {
  const query = (filters) => ({
    where: (field, _op, value) => query([...filters, [field, value]]),
    async get() {
      if (failMemberships) throw new Error('permission denied');
      const docs = memberships
        .filter((data) => filters.every(([field, value]) => data[field] === value))
        .map((data, index) => ({ id: `m${index}`, data: () => data }));
      return { docs, empty: docs.length === 0 };
    },
  });
  return {
    collection(name) {
      if (name === 'pulsecheck-team-memberships') return { where: (field, op, value) => query([]).where(field, op, value) };
      if (name === 'pulsecheck-teams') {
        return {
          doc: (id) => ({
            async get() {
              if (failTeams.includes(id)) throw new Error('unavailable');
              return { exists: Object.prototype.hasOwnProperty.call(teams, id), data: () => teams[id] };
            },
          }),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
  };
}

const athlete = (teamId, extra = {}) => ({ userId: 'athlete-1', role: 'athlete', teamId, ...extra });
const team = (youthTrack, extra = {}) => ({ commercialConfig: { youthTrack }, ...extra });
const resolve = async (seed) => (await resolvePulseCheckYouthTrack(createDb(seed), 'athlete-1')).track;

test('an athlete with no team, or no user id, defaults to junior', async () => {
  assert.equal(await resolve({}), 'junior');
  assert.equal((await resolvePulseCheckYouthTrack(createDb(), '  ')).track, 'junior');
});

test('the team commercialConfig.youthTrack sets the track, normalized like iOS', async () => {
  assert.equal(await resolve({ memberships: [athlete('t1')], teams: { t1: team('pro') } }), 'pro');
  assert.equal(await resolve({ memberships: [athlete('t1')], teams: { t1: team(' PRO ') } }), 'pro');
  assert.equal(await resolve({ memberships: [athlete('t1')], teams: { t1: team('rookie') } }), 'rookie');
  assert.equal(await resolve({ memberships: [athlete('t1')], teams: { t1: team('elite') } }), 'junior');
  assert.equal(await resolve({ memberships: [athlete('t1')], teams: { t1: { commercialConfig: { youthTrack: true } } } }), 'junior');
  assert.equal(await resolve({ memberships: [athlete('t1')], teams: { t1: {} } }), 'junior');
});

test('a missing team document counts as an eligible junior team', async () => {
  assert.equal(await resolve({ memberships: [athlete('gone'), athlete('t2')], teams: { t2: team('rookie') } }), 'junior');
});

test('the invite override on the membership replaces that team track only', async () => {
  assert.equal(await resolve({ memberships: [athlete('t1', { athleteTrackOverride: 'pro' })], teams: { t1: team('junior') } }), 'pro');
  assert.equal(await resolve({ memberships: [athlete('t1', { athleteTrackOverride: 'Rookie' })], teams: { t1: team('pro') } }), 'rookie');
  assert.equal(await resolve({ memberships: [athlete('t1', { athleteTrackOverride: 'elite' })], teams: { t1: team('pro') } }), 'pro');
  assert.equal(
    await resolve({
      memberships: [athlete('t1', { athleteTrackOverride: 'rookie' }), athlete('t2')],
      teams: { t1: team('junior'), t2: team('pro') },
    }),
    'pro',
  );
});

test('the most permissive eligible track wins across teams', async () => {
  assert.equal(await resolve({ memberships: [athlete('t1'), athlete('t2')], teams: { t1: team('rookie'), t2: team('pro') } }), 'pro');
  assert.equal(await resolve({ memberships: [athlete('t1'), athlete('t2')], teams: { t1: team('rookie'), t2: team('junior') } }), 'junior');
  assert.equal(await resolve({ memberships: [athlete('t1'), athlete('t2')], teams: { t1: team('rookie'), t2: team('rookie') } }), 'rookie');
});

test('paused and archived teams are ignored, and no eligible team means junior', async () => {
  const memberships = [athlete('t1'), athlete('t2')];
  assert.equal(await resolve({ memberships, teams: { t1: team('pro', { status: ' Paused ' }), t2: team('rookie') } }), 'rookie');
  assert.equal(await resolve({ memberships, teams: { t1: team('pro', { status: 'archived' }), t2: team('rookie', { status: 'paused' }) } }), 'junior');
  assert.equal(await resolve({ memberships: [athlete('t1', { athleteTrackOverride: 'pro' })], teams: { t1: team('junior', { status: 'archived' }) } }), 'junior');
  assert.equal(await resolve({ memberships, teams: { t1: team('pro', { status: 'active' }), t2: team('rookie') } }), 'pro');
});

test('only athlete memberships for this user count', async () => {
  assert.equal(
    await resolve({
      memberships: [{ userId: 'athlete-1', role: 'coach', teamId: 't1' }, { userId: 'someone-else', role: 'athlete', teamId: 't1' }, athlete('')],
      teams: { t1: team('pro') },
    }),
    'junior',
  );
});

test('read failures resolve toward junior: a failed team read is ineligible', async () => {
  assert.equal((await resolvePulseCheckYouthTrack(createDb({ failMemberships: true }), 'athlete-1')).track, 'junior');
  assert.equal(
    (await resolvePulseCheckYouthTrack(createDb({ memberships: [athlete('t1'), athlete('t2')], teams: { t2: team('rookie') }, failTeams: ['t1'] }), 'athlete-1')).track,
    'rookie',
  );
  assert.equal(
    (await resolvePulseCheckYouthTrack(createDb({ memberships: [athlete('t1', { athleteTrackOverride: 'pro' })], failTeams: ['t1'] }), 'athlete-1')).track,
    'junior',
  );
});

test('pure helpers match the iOS enum', () => {
  assert.equal(effectiveYouthTrack([]), 'junior');
  assert.equal(effectiveYouthTrack([{ track: 'pro', teamStatus: 'paused' }]), 'junior');
  assert.equal(parseYouthTrack(undefined), null);
  assert.equal(allowsDirectNoraChat('pro'), true);
  assert.equal(allowsDirectNoraChat('junior'), false);
  assert.equal(allowsDirectNoraChat('rookie'), false);
});
