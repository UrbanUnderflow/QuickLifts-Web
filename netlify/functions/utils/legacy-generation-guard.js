// State presence is a permanent boundary, independent of rollout flags or opt-in toggles.
const stateRef = (db, athleteId) => db.collection('pulsecheck-linear-curriculum/states/items').doc(athleteId);
async function hasProtectedLinearState(db, athleteId) {
  return (await stateRef(db, athleteId).get()).exists;
}
async function commitLegacyGeneration(db, athleteId, write) {
  return db.runTransaction(async (tx) => {
    if ((await tx.get(stateRef(db, athleteId))).exists) return false;
    await write(tx);
    return true;
  });
}
module.exports = { hasProtectedLinearState, commitLegacyGeneration };
