function closedError() { const error = new Error('Account closure prevents provider sync'); error.code = 'account_closing'; return error; }
async function assertAccountOpen(db, uid) {
  if (!uid || (await db.collection('account-closure-jobs').doc(uid).get()).exists) throw closedError();
}
// Read the durable tombstone in the same transaction as provider writes. A closure
// arriving during network fetches conflicts/retries instead of recreating deleted data.
function accountOpenBatch(db, uid) {
  const writes = [];
  return {
    set(...args) { writes.push(['set', args]); return this; },
    update(...args) { writes.push(['update', args]); return this; },
    delete(...args) { writes.push(['delete', args]); return this; },
    async commit() {
      return db.runTransaction(async tx => {
        if (!uid || (await tx.get(db.collection('account-closure-jobs').doc(uid))).exists) throw closedError();
        for (const [method, args] of writes) tx[method](...args);
      });
    },
  };
}
async function accountOpenSet(db, uid, ref, ...args) { return accountOpenBatch(db, uid).set(ref, ...args).commit(); }
module.exports = {assertAccountOpen, accountOpenBatch, accountOpenSet};
