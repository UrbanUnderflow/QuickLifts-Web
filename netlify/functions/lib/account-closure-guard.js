function closedError() { const error = new Error('Account closure prevents provider sync'); error.code = 'account_closing'; error.statusCode = 403; return error; }
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

// Scope legacy assignment materialization to one authenticated athlete without
// changing its reads. Every write checks closure in the same transaction.
function accountOpenDatabase(db, uid) {
  const originals = new WeakMap();
  const unwrap = value => originals.get(value) || value;
  function batch() {
    const guarded = accountOpenBatch(db, uid);
    const result = { commit: () => guarded.commit() };
    for (const method of ['set', 'update', 'delete']) result[method] = (ref, ...args) => {
      guarded[method](unwrap(ref), ...args); return result;
    };
    return result;
  }
  function wrap(target) {
    const proxy = new Proxy(target, { get(object, key) {
      if (['set', 'update', 'delete'].includes(key)) return (...args) => batch()[key](object, ...args).commit();
      if (key === 'add') return async data => { const ref = object.doc(); await accountOpenSet(db, uid, ref, data); return wrap(ref); };
      const value = Reflect.get(object, key, object);
      if (['collection', 'doc', 'where', 'orderBy', 'limit', 'limitToLast', 'offset', 'select', 'startAt', 'startAfter', 'endAt', 'endBefore'].includes(key)) return (...args) => wrap(value.apply(object, args));
      return typeof value === 'function' ? value.bind(object) : value;
    }});
    originals.set(proxy, target); return proxy;
  }
  return new Proxy(db, { get(target, key) {
    if (key === 'collection' || key === 'doc') return (...args) => wrap(target[key](...args));
    if (key === 'batch') return batch;
    if (key === 'runTransaction') return (callback, ...options) => target.runTransaction(async tx => {
      if (!uid || (await tx.get(target.collection('account-closure-jobs').doc(uid))).exists) throw closedError();
      const guarded = new Proxy(tx, { get(transaction, method) {
        const value = Reflect.get(transaction, method, transaction);
        if (['get', 'set', 'update', 'delete'].includes(method)) return (ref, ...args) => value.call(transaction, unwrap(ref), ...args);
        return typeof value === 'function' ? value.bind(transaction) : value;
      }});
      return callback(guarded);
    }, ...options);
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  }});
}
module.exports.accountOpenDatabase = accountOpenDatabase;
