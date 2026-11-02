const { randomUUID, createHash } = require('node:crypto');
const SOURCE = 'athleticmind-sponsorship-v1';
const BATCH_SIZE = 20, CONCURRENCY = 4, CACHE_MS = 60000, COOLDOWN_MS = 15000, LEASE_MS = 45000;
const unavailable = () => Object.assign(new Error('Contribution totals are being verified. Please try again shortly.'), { status: 503 });
function rootFor(db, config) {
  if (!['athleticmind-sponsorship-live', 'athleticmind-sponsorship-test'].includes(config.collection)) throw unavailable();
  return db.collection(config.collection);
}
const fingerprint = input => createHash('sha256').update(JSON.stringify({amount:input.amount,campaign:input.campaign,profile:input.profile || null})).digest('hex');
async function findRegisteredIntent({ db, config, client, input }) {
  const saved = (await rootFor(db,config).doc('ledger').collection('requests').doc(input.requestId).get()).data();
  if (!saved) return null;
  if (saved.fingerprint !== fingerprint(input)) throw Object.assign(new Error('This contribution request has changed. Please start again.'),{status:409});
  return client.paymentIntents.retrieve(saved.intentId);
}
async function registerIntent({ db, config, intent, input, now = Date.now() }) {
  const ledger = rootFor(db, config).doc('ledger');
  const ref = ledger.collection('tracked-intents').doc(intent.id), requestRef = ledger.collection('requests').doc(input.requestId);
  await db.runTransaction(async tx => {
    const [oldSnap, requestSnap] = await Promise.all([tx.get(ref),tx.get(requestRef)]);
    const old = oldSnap.data(), request = requestSnap.data(), hash = fingerprint(input);
    if (request && (request.intentId !== intent.id || request.fingerprint !== hash)) throw unavailable();
    if (old && (old.amount !== input.amount || old.requestId !== input.requestId || old.campaign !== input.campaign)) throw unavailable();
    if (!old) tx.set(ref, { amount: input.amount, requestId: input.requestId, campaign: input.campaign, profile: input.profile || null, createdAt: now });
    if (!request) tx.set(requestRef,{intentId:intent.id,fingerprint:hash});
  });
}
async function verifyIntent(client, id, tracked, config) {
  const pi = await client.paymentIntents.retrieve(id, { expand: ['latest_charge'] });
  if (pi.id !== id || pi.livemode !== config.live || pi.currency !== 'usd' || pi.amount !== tracked.amount
    || pi.metadata?.source !== SOURCE || pi.metadata?.campaign !== tracked.campaign || pi.metadata?.request_id !== tracked.requestId
    || pi.transfer_data || pi.on_behalf_of) throw unavailable();
  if (['requires_payment_method','requires_confirmation','requires_action','processing','requires_capture','canceled'].includes(pi.status)) return null;
  const charge = pi.latest_charge;
  if (pi.status !== 'succeeded' || !charge || charge.livemode !== config.live || charge.currency !== 'usd'
    || charge.status !== 'succeeded' || charge.paid !== true || charge.captured !== true
    || charge.amount !== tracked.amount || charge.amount_captured !== tracked.amount || pi.amount_received !== tracked.amount
    || !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || charge.amount_refunded > tracked.amount) throw unavailable();
  return { id, net: charge.disputed ? 0 : charge.amount_captured - charge.amount_refunded,
    created: charge.created || 0, profile: tracked.profile };
}
function addPayments(cycle, payments) {
  const schools = new Map(cycle.schools.map(s => [s.key, { ...s }]));
  const supporters = [...cycle.supporters]; let net = cycle.net;
  for (const payment of payments) {
    if (!payment) continue;
    net += payment.net;
    if (!Number.isSafeInteger(net)) throw unavailable();
    if (payment.net <= 0 || !payment.profile) continue;
    const { name, school, schoolKey, message } = payment.profile;
    supporters.push({ id: payment.id, created: payment.created, name, school, message, net: payment.net });
    if (schoolKey) {
      const entry = schools.get(schoolKey) || { key: schoolKey, name: school, count: 0 };
      entry.count++; schools.set(schoolKey, entry);
    }
  }
  supporters.sort((a,b) => b.created-a.created || a.id.localeCompare(b.id));
  const updated = { ...cycle, net, supporters: supporters.slice(0,50), schools: [...schools.values()] };
  // Never truncate schools or publish incomplete totals to fit a Firestore document.
  if (Buffer.byteLength(JSON.stringify(updated)) > 750000) throw unavailable();
  return updated;
}
function publicSnapshot(state, now) {
  if (!state?.snapshot) { if (state?.cycle && !state.lastError) return { mode: state.mode, pending: true, refreshing: true }; throw unavailable(); }
  return { ...state.snapshot, stale: !!state.lastError || now-state.snapshot.verifiedAt > CACHE_MS,
    refreshing: !!state.cycle || !!state.leaseUntil, mode: state.mode };
}
async function readSnapshot({ db, client, config, now = Date.now, token = randomUUID }) {
  const root = rootFor(db, config), ref = root.doc('reconciliation');
  const started = now(), lease = token();
  const claim = await db.runTransaction(async tx => {
    const state = (await tx.get(ref)).data() || {};
    if (state.leaseUntil > started || state.nextRunAt > started) return { acquired: false, state };
    const cycle = state.cycle || { cursor: null, startedAt: started, net: 0, supporters: [], schools: [] };
    const next = { ...state, mode: config.mode, cycle, lease, leaseUntil: started+LEASE_MS, nextRunAt: started+COOLDOWN_MS };
    tx.set(ref, next);
    return { acquired: true, state: next };
  });
  if (!claim.acquired) return publicSnapshot(claim.state, started);
  try {
    let query = root.doc('ledger').collection('tracked-intents').orderBy('__name__').limit(BATCH_SIZE+1);
    if (claim.state.cycle.cursor) query = query.startAfter(claim.state.cycle.cursor);
    const page = await query.get(), docs = page.docs.slice(0,BATCH_SIZE);
    const payments = new Array(docs.length); let index = 0;
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY,docs.length) }, async () => {
      while (index < docs.length) { const i = index++; payments[i] = await verifyIntent(client, docs[i].id, docs[i].data(), config); }
    }));
    const cycle = addPayments(claim.state.cycle, payments), more = page.docs.length > BATCH_SIZE;
    cycle.cursor = docs.at(-1)?.id || cycle.cursor;
    const finished = now();
    const result = await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (current?.lease !== lease || current.leaseUntil <= finished) return current;
      const next = { ...current, lease: '', leaseUntil: 0, lastError: false,
        nextRunAt: finished+(more ? COOLDOWN_MS : CACHE_MS), cycle: more ? cycle : null };
      if (!more) next.snapshot = { net: cycle.net,
        supporters: cycle.supporters.map(({name,school,message,net}) => ({name,school,message,net})),
        schools: cycle.schools.map(({name,count}) => ({name,count})).sort((a,b) => b.count-a.count || a.name.localeCompare(b.name)),
        verifiedAt: cycle.startedAt, completedAt: finished };
      tx.set(ref,next); return next;
    });
    return publicSnapshot(result,finished);
  } catch (error) {
    const failedAt = now();
    const result = await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (current?.lease !== lease) return current;
      const next = { ...current, lease: '', leaseUntil: 0, lastError: true, nextRunAt: failedAt+CACHE_MS };
      tx.set(ref,next); return next;
    });
    return publicSnapshot(result,failedAt);
  }
}
module.exports = { findRegisteredIntent, registerIntent, verifyIntent, readSnapshot, BATCH_SIZE, CONCURRENCY, CACHE_MS, COOLDOWN_MS, LEASE_MS };
