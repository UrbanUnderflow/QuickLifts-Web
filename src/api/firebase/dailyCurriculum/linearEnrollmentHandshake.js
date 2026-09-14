const ROOT = 'pulsecheck-linear-curriculum';
const ACTIVE = new Set(['started', 'in_progress', 'inProgress', 'paused']);
const TERMINAL = new Set(['completed', 'done', 'expired', 'superseded', 'overridden', 'deferred', 'skipped', 'cancelled', 'canceled']);
const LEGACY_COLLECTIONS = ['pulsecheck-daily-assignments', 'sim-assignments', 'mental-exercise-assignments'];
function hasActiveLegacyWork(data) {
  if (TERMINAL.has(data.status)) return false;
  return ACTIVE.has(data.status) || (typeof data.startedAt === 'number' && data.startedAt > 0);
}
async function assertNoActiveLegacyWork(tx, db, athleteId) {
  // Query all known owner aliases. A cap or conflicting ownership is a review hold, never a guessed clean state.
  for (const collection of LEGACY_COLLECTIONS) {
    for (const field of ['athleteId', 'athleteUserId', 'userId']) {
      const snap = await tx.get(db.collection(collection).where(field, '==', athleteId).limit(1001));
      if (snap.size > 1000) throw Object.assign(new Error('Legacy assignment history exceeds the safe enrollment review limit.'), { code: 'legacy_review_required' });
      if (snap.docs.some(doc => hasActiveLegacyWork(doc.data()))) throw Object.assign(new Error('Finish or review existing started or paused work before beginning the new skill journey.'), { code: 'legacy_work_active' });
    }
  }
}
async function commitLegacyStart(db, assignmentRef, athleteId, buildUpdates) {
  return db.runTransaction(async tx => {
    const [current, state] = await Promise.all([tx.get(assignmentRef), tx.get(db.collection(ROOT).doc('states').collection('items').doc(athleteId))]);
    const owners = current.exists ? [current.data().athleteId, current.data().athleteUserId, current.data().userId].filter(value => typeof value === 'string' && value) : [];
    if (!current.exists || !owners.length || owners.some(owner => owner !== athleteId)) throw Object.assign(new Error('Assignment ownership changed. Refresh before starting.'), { statusCode: 409 });
    if (state.exists) throw Object.assign(new Error('This athlete uses the versioned skill journey. Refresh or update the app before starting.'), { statusCode: 409 });
    const updates = buildUpdates(current.data());
    if (!updates) throw Object.assign(new Error('This assignment cannot start. Refresh your current skill.'), { statusCode: 409 });
    if (updates) tx.set(assignmentRef, updates, { merge: true });
    return { assignment: { id: current.id, ...current.data() }, updates };
  });
}
module.exports = { hasActiveLegacyWork, assertNoActiveLegacyWork, commitLegacyStart };
