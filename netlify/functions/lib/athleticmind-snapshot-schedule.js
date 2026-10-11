const { randomUUID } = require('node:crypto');
const { deliverAthleticMindSnapshot } = require('./athleticmind-snapshot-delivery');

/** Resumable, bounded sweep. Caller supplies no scope; every delivery revalidates it. */
async function runScheduledSnapshotBatch({ getDb, env = process.env, clock = Date.now, deliver = deliverAthleticMindSnapshot, maxAttempts = 20 }) {
  if (env.ATHLETICMIND_SNAPSHOT_PUSH_ENABLED !== 'true') return { status: 'disabled', attempted: 0 };
  const db = await getDb();
  const startedAt = clock();
  const ref = db.collection('athleticmind-snapshot-scheduler').doc('daily');
  const owner = randomUUID();
  const claim = await db.runTransaction(async tx => {
    const previous = await tx.get(ref);
    const value = previous.exists ? previous.data() : {};
    if (value.leaseUntil > startedAt) return null;
    tx.set(ref, { owner, leaseUntil: startedAt + 120000 }, { merge: true });
    return { teamCursor: value.teamCursor || null, currentTeamId: value.currentTeamId || null, memberCursor: value.memberCursor || null };
  });
  if (!claim) return { status: 'busy', attempted: 0 };
  let attempted = 0;
  const counts = {};
  const saveCursor = () => db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.data()?.owner !== owner) throw new Error('scheduler_lease_lost');
    tx.set(ref, { ...claim, updatedAtMs: clock() }, { merge: true });
  });
  try {
    // Empty teams also count against the work bound, preventing unbounded scans.
    for (let work = 0; work < maxAttempts && clock() - startedAt < 45000; work += 1) {
      if (!claim.currentTeamId) {
        let query = db.collection('pulsecheck-teams').where('snapshotDelivery.enabled', '==', true).orderBy('__name__').limit(1);
        if (claim.teamCursor) query = query.startAfter(claim.teamCursor);
        const teams = await query.get();
        if (!teams.docs.length) {
          claim.teamCursor = null;
          await saveCursor();
          break;
        }
        claim.currentTeamId = teams.docs[0].id;
        claim.memberCursor = null;
      }
      let members = db.collection('pulsecheck-team-memberships').where('teamId', '==', claim.currentTeamId).where('role', '==', 'athlete').orderBy('__name__').limit(1);
      if (claim.memberCursor) members = members.startAfter(claim.memberCursor);
      const page = await members.get();
      if (!page.docs.length) {
        claim.teamCursor = claim.currentTeamId;
        claim.currentTeamId = null;
        claim.memberCursor = null;
        await saveCursor();
        continue;
      }
      const membership = page.docs[0];
      const athleteId = membership.data()?.userId;
      let status = 'invalid_membership';
      if (typeof athleteId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(athleteId)) {
        try {
          const result = await deliver(db, { teamId: claim.currentTeamId, athleteId, now: clock() }, { env, clock });
          status = result.status || 'unknown';
        } catch { status = 'failed'; }
        attempted += 1;
      }
      counts[status] = (counts[status] || 0) + 1;
      claim.memberCursor = membership.id;
      await saveCursor();
    }
    return { status: 'checked', attempted, counts };
  } finally {
    await db.runTransaction(async tx => {
      const current = await tx.get(ref);
      if (current.data()?.owner === owner) tx.set(ref, { leaseUntil: 0 }, { merge: true });
    });
  }
}
module.exports = { runScheduledSnapshotBatch };
