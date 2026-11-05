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
// Durable session ownership is written before exposing Checkout's URL. No account-wide invoice scan.
async function findRegisteredSession({ db, config, client, input }) {
  const saved = (await rootFor(db,config).doc('ledger').collection('monthly-requests').doc(input.requestId).get()).data();
  if (!saved) return null;
  if (saved.fingerprint !== fingerprint(input)) throw Object.assign(new Error('This contribution request has changed. Please start again.'),{status:409});
  const session = await client.checkout.sessions.retrieve(saved.sessionId);
  if (session.status !== 'open') throw Object.assign(new Error('This giving checkout has already finished or expired. Please start a new contribution.'),{status:409});
  return session;
}
async function registerSession({ db, config, session, input, now = Date.now() }) {
  if (session.mode !== 'subscription' || session.metadata?.source !== SOURCE || session.metadata?.request_id !== input.requestId) throw unavailable();
  const ledger = rootFor(db,config).doc('ledger');
  const ref = ledger.collection('tracked-sessions').doc(session.id), requestRef = ledger.collection('monthly-requests').doc(input.requestId);
  await db.runTransaction(async tx => {
    const [oldSnap, requestSnap] = await Promise.all([tx.get(ref),tx.get(requestRef)]);
    const old = oldSnap.data(), request = requestSnap.data(), hash = fingerprint(input);
    if (request && (request.sessionId !== session.id || request.fingerprint !== hash)) throw unavailable();
    if (old && (old.amount !== input.amount || old.requestId !== input.requestId)) throw unavailable();
    if (!old) tx.set(ref,{amount:input.amount,requestId:input.requestId,campaign:input.campaign,profile:input.profile || null,createdAt:now});
    if (!request) tx.set(requestRef,{sessionId:session.id,fingerprint:hash});
  });
}
async function verifyMonthlyPage(client, id, tracked, config, cursor) {
  const session = await client.checkout.sessions.retrieve(id);
  if (session.livemode !== config.live || session.mode !== 'subscription' || session.metadata?.source !== SOURCE
    || session.metadata?.request_id !== tracked.requestId || session.metadata?.campaign !== tracked.campaign) throw unavailable();
  if (!session.subscription) return {payments:[],more:false};
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
  const plan = await client.subscriptions.retrieve(subscriptionId);
  const item = plan.items?.data?.[0];
  if (plan.livemode !== config.live || plan.metadata?.source !== SOURCE || plan.metadata?.request_id !== tracked.requestId
    || plan.metadata?.recurring_consent !== 'monthly-v1' || plan.metadata?.campaign !== tracked.campaign
    || plan.transfer_data || plan.on_behalf_of || plan.application_fee_percent
    || plan.items?.data?.length !== 1 || item.quantity !== 1 || item.price?.unit_amount !== tracked.amount
    || item.price.currency !== 'usd' || item.price.recurring?.interval !== 'month' || item.price.recurring?.interval_count !== 1) throw unavailable();
  const page = await client.invoices.list({subscription:subscriptionId,limit:BATCH_SIZE,...(cursor ? {starting_after:cursor} : {})});
  const payments = new Array(page.data.length); let index = 0;
  await Promise.all(Array.from({length:Math.min(CONCURRENCY,page.data.length)},async()=>{
    while(index<page.data.length) {
      const i=index++, invoice=page.data[i];
      if (invoice.livemode !== config.live || invoice.subscription !== subscriptionId || invoice.currency !== 'usd') throw unavailable();
      if (!invoice.paid || !invoice.payment_intent) { payments[i]=null; continue; }
      const pi=await client.paymentIntents.retrieve(typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent.id,{expand:['latest_charge']});
      const charge=pi.latest_charge;
      if (pi.livemode !== config.live || pi.status !== 'succeeded' || pi.currency !== 'usd' || pi.transfer_data || pi.on_behalf_of
        || pi.amount !== tracked.amount || pi.amount_received !== tracked.amount || invoice.amount_paid !== tracked.amount
        || !charge || charge.invoice !== invoice.id || charge.livemode !== config.live || charge.currency !== 'usd'
        || charge.status !== 'succeeded' || charge.paid !== true || charge.captured !== true || charge.amount_captured !== tracked.amount
        || !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded<0 || charge.amount_refunded>tracked.amount) throw unavailable();
      payments[i]={id:pi.id,group:subscriptionId,net:charge.disputed?0:charge.amount_captured-charge.amount_refunded,created:charge.created||0,profile:tracked.profile};
    }
  }));
  if (page.has_more && !page.data.length) throw unavailable();
  return {payments,more:!!page.has_more,cursor:page.data.at(-1)?.id || null};
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
  const supporters = [...cycle.supporters]; const groups = {...(cycle.groups || {})}; let net = cycle.net;
  for (const payment of payments) {
    if (!payment) continue;
    net += payment.net;
    if (!Number.isSafeInteger(net)) throw unavailable();
    if (payment.net <= 0 || !payment.profile) continue;
    const { name, school, schoolKey, message } = payment.profile;
    const group = payment.group || payment.id, prior = groups[group] || {net:0,created:0};
    const total = prior.net + payment.net;
    groups[group] = {net:total,created:Math.max(prior.created,payment.created)};
    const existingIndex = supporters.findIndex(s => s.id === group);
    if (existingIndex >= 0) supporters.splice(existingIndex,1);
    supporters.push({id:group,created:groups[group].created,name,school,message,net:total});
    if (schoolKey) {
      const entry = schools.get(schoolKey) || { key: schoolKey, name: school, count: 0 };
      if (!prior.net) entry.count++; schools.set(schoolKey, entry);
    }
  }
  supporters.sort((a,b) => b.created-a.created || a.id.localeCompare(b.id));
  const updated = { ...cycle, net, groups, supporters: supporters.slice(0,50), schools: [...schools.values()] };
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
    const cycle = state.cycle || { phase: 'intents', cursor: null, invoiceCursor: null, startedAt: started, net: 0, supporters: [], schools: [], groups: {} };
    const next = { ...state, mode: config.mode, cycle, lease, leaseUntil: started+LEASE_MS, nextRunAt: started+COOLDOWN_MS };
    tx.set(ref, next);
    return { acquired: true, state: next };
  });
  if (!claim.acquired) return publicSnapshot(claim.state, started);
  try {
    const active = claim.state.cycle;
    let cycle, more;
    if ((active.phase || 'intents') === 'intents') {
      let query = root.doc('ledger').collection('tracked-intents').orderBy('__name__').limit(BATCH_SIZE+1);
      if (active.cursor) query=query.startAfter(active.cursor);
      const page=await query.get(), docs=page.docs.slice(0,BATCH_SIZE);
      const payments=new Array(docs.length); let index=0;
      await Promise.all(Array.from({length:Math.min(CONCURRENCY,docs.length)},async()=>{
        while(index<docs.length){const i=index++;payments[i]=await verifyIntent(client,docs[i].id,docs[i].data(),config);}
      }));
      cycle=addPayments(active,payments);
      if(page.docs.length>BATCH_SIZE){cycle.cursor=docs.at(-1).id;more=true;}
      else {cycle.phase='sessions';cycle.cursor=null;cycle.invoiceCursor=null;more=true;
        // Preserve the fast path when there are no monthly checkouts at all.
        const any=await root.doc('ledger').collection('tracked-sessions').limit(1).get();
        if(!any.docs.length)more=false;
      }
    } else {
      let query=root.doc('ledger').collection('tracked-sessions').orderBy('__name__').limit(2);
      if(active.cursor)query=active.invoiceCursor ? query.startAt(active.cursor) : query.startAfter(active.cursor);
      const page=await query.get(), doc=page.docs[0];
      if(!doc){cycle=active;more=false;}
      else {
        const result=await verifyMonthlyPage(client,doc.id,doc.data(),config,active.invoiceCursor);
        cycle=addPayments(active,result.payments);cycle.cursor=doc.id;
        cycle.invoiceCursor=result.more?result.cursor:null;
        more=result.more || page.docs.length>1;
      }
    }
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
module.exports = { findRegisteredSession, registerSession, verifyMonthlyPage, findRegisteredIntent, registerIntent, verifyIntent, readSnapshot, BATCH_SIZE, CONCURRENCY, CACHE_MS, COOLDOWN_MS, LEASE_MS };
