const test = require('node:test');
const assert = require('node:assert/strict');
const { createFirestoreAdminMock } = require('../firebase-admin/_runtimeHarness.cjs');
const { loadTeamInvoices } = require('../../../netlify/functions/lib/pulsecheck-team-invoices');
const sub = (metadata = {}, customer = 'cus_ours', livemode = true) => ({ customer, livemode, metadata: { userId: 'athlete', pulsecheckTeamId: 'team', ...metadata } });
const invoice = (id, subscription = 'sub_current', overrides = {}) => ({ id, subscription, customer: 'cus_ours', livemode: true, status: 'paid', number: 'A-1', created: 123, currency: 'usd', amount_paid: 4000, amount_due: 4000, total: 4000, hosted_invoice_url: 'https://invoice.stripe.com/i/a', invoice_pdf: 'https://pay.stripe.com/invoice/a/pdf', ...overrides });
function fixture(data = [], subscriptions = {}, hasMore = false) {
  const { db } = createFirestoreAdminMock({ collections: {
    users: [{id:'athlete',data:{pulseCheckTeamId:'team'}}],
    'pulsecheck-team-memberships': [{id:'membership',data:{userId:'athlete',teamId:'team',organizationId:'org',role:'athlete',status:'active'}}],
    'pulsecheck-teams': [{id:'team',data:{organizationId:'org',status:'active'}}],
    'pulsecheck-organizations': [{id:'org',data:{status:'active'}}],
    'pulsecheck-athlete-app-entitlements': [{id:'team_athlete',data:{stripeSubscriptionId:'sub_current'}}]
  }});
  const calls = [];
  return { database: db, userId: 'athlete', teamId: 'team', stripeMode: 'live', firebaseMode: 'prod', cursorSecret: 'test-secret', calls,
    stripe: { subscriptions: { search: async () => ({data:Object.entries(subscriptions).map(([id,record])=>({id,...record})),has_more:false}), retrieve: async id => subscriptions[id] || sub() }, invoices: { list: async args => { calls.push(args); return {data,has_more:hasMore}; } } } };
}
test('returns canceled/restarted subscription history and both Stripe link types', async () => {
  const args = fixture([invoice('in_old', 'sub_old'), invoice('in_new')], { sub_old: {...sub(),status:'canceled'} });
  const result = await loadTeamInvoices(args);
  assert.deepEqual(result.invoices.map(x => x.id), ['in_old','in_new']);
  assert.equal(result.invoices[0].amountPaid, 4000);
  assert.equal(result.invoices[0].invoicePdf, 'https://pay.stripe.com/invoice/a/pdf');
  assert.equal(result.nextCursor,null);
  assert.equal(args.calls[0].customer, 'cus_ours');
});
test('rejects another team membership and foreign subscription before listing invoices', async () => {
  const args = fixture();
  await assert.rejects(loadTeamInvoices({...args,teamId:'foreign'}), /could not be confirmed/);
  await assert.rejects(loadTeamInvoices(fixture([], {sub_current:sub({userId:'other'})})), /could not be verified/);
  assert.equal(args.calls.length,0);
});
test('filters other users, teams, environments, customers, drafts, and non-subscription invoices', async () => {
  const entries = ['user','team','dev','test','customer'].map((id) => invoice(`in_${id}`,`sub_${id}`));
  const args = fixture([...entries, invoice('in_draft','sub_current',{status:'draft'}), invoice('in_once',null), invoice('in_customerBad','sub_current',{customer:'cus_other'}), invoice('in_ok')], {
    sub_user:sub({userId:'other'}), sub_team:sub({pulsecheckTeamId:'other'}), sub_dev:sub({pulsecheckFirebaseMode:'dev'}), sub_test:sub({},'cus_ours',false), sub_customer:sub({},'cus_other')
  });
  assert.deepEqual((await loadTeamInvoices(args)).invoices.map(x=>x.id),['in_ok']);
});
test('supports modern invoice subscription parent and strips unsafe links', async () => {
  const result = await loadTeamInvoices(fixture([invoice('in_modern',null,{ parent:{subscription_details:{subscription:'sub_current'}}, hosted_invoice_url:'https://invoice.stripe.com.evil.example/a', invoice_pdf:'javascript:alert(1)' })]));
  assert.equal(result.invoices.length,1);
  assert.equal(result.invoices[0].hostedInvoiceUrl,null);
  assert.equal(result.invoices[0].invoicePdf,null);
});
test('pagination cursor is tamper resistant and scoped to user/team/customer/environment', async () => {
  const args = fixture([invoice('in_123')],{},true);
  const { nextCursor } = await loadTeamInvoices(args);
  await loadTeamInvoices({...args,cursor:nextCursor});
  assert.equal(args.calls[1].starting_after,'in_123');
  await assert.rejects(loadTeamInvoices({...args,cursor:`${nextCursor}x`}), /Invalid payment history cursor/);
  const other = fixture([], {sub_current:sub({},'cus_changed')});
  await assert.rejects(loadTeamInvoices({...other,cursor:nextCursor}), /Invalid payment history cursor/);
});
test('endpoint authenticates before Stripe access and ignores client-supplied identity and environment', async () => {
  const { withModuleMocks } = require('../firebase-admin/_runtimeHarness.cjs');
  const endpoint = require.resolve('../../../netlify/functions/get-pulsecheck-athlete-invoices');
  const oldKey = process.env.STRIPE_TEST_SECRET_KEY;
  process.env.STRIPE_TEST_SECRET_KEY = 'server-test-key';
  let received;
  let stripeCalls = 0;
  const load = (rejectAuth) => {
    delete require.cache[endpoint];
    return withModuleMocks({
      stripe: function(key) { stripeCalls++; assert.equal(key,'server-test-key'); },
      './config/firebase': {headers:{}},
      './lib/pulsecheck-coach-services': {
        resolveServerStripeMode: () => 'test',
        verifyFirebaseUser: async () => {
          if (rejectAuth) throw Object.assign(new Error('Sign in'),{statusCode:401});
          return {userId:'authenticated-athlete',app:{name:'pulsecheck-dev-admin',firestore:()=>({})}};
        }
      },
      './lib/pulsecheck-team-invoices': { loadTeamInvoices: async args => { received=args; return {invoices:[],nextCursor:null}; } }
    }, () => require(endpoint));
  };
  try {
    const denied = await load(true).handler({httpMethod:'POST',body:'{}'});
    assert.equal(denied.statusCode,401); assert.equal(stripeCalls,0);
    const result = await load(false).handler({httpMethod:'POST',body:JSON.stringify({teamId:'team',userId:'victim',stripeMode:'live',firebaseMode:'prod'})});
    assert.equal(result.statusCode,200);
    assert.equal(received.userId,'authenticated-athlete');
    assert.equal(received.stripeMode,'test'); assert.equal(received.firebaseMode,'dev');
    assert.equal(result.headers['Cache-Control'],'private, no-store');
  } finally {
    if (oldKey === undefined) delete process.env.STRIPE_TEST_SECRET_KEY; else process.env.STRIPE_TEST_SECRET_KEY=oldKey;
    delete require.cache[endpoint];
  }
});
test('restart on a new customer preserves globally ordered history across pagination', async () => {
  const args = fixture([], {sub_old:sub({},'cus_old')});
  const all = Array.from({length:30},(_,i) => invoice(`in_${String(30-i).padStart(2,'0')}`, i%2 ? 'sub_old':'sub_current', {created:300-i,customer:i%2?'cus_old':'cus_ours'}));
  args.stripe.invoices.list = async ({customer,starting_after,limit}) => {
    const stream=all.filter(x=>x.customer===customer);
    const offset=starting_after ? stream.findIndex(x=>x.id===starting_after)+1 : 0;
    return {data:stream.slice(offset,offset+limit),has_more:stream.length>offset+limit};
  };
  const first=await loadTeamInvoices(args);
  assert.deepEqual(first.invoices.map(x=>x.id),all.slice(0,20).map(x=>x.id));
  assert.ok(first.nextCursor);
  const second=await loadTeamInvoices({...args,cursor:first.nextCursor});
  assert.deepEqual(second.invoices.map(x=>x.id),all.slice(20).map(x=>x.id));
  assert.equal(second.nextCursor,null);
});
test('same-second invoices retain Stripe stream order at page boundaries', async () => {
  const args = fixture();
  const all=Array.from({length:25},(_,i)=>invoice(`in_${String(i).padStart(2,'0')}`, 'sub_current', {created:100}));
  args.stripe.invoices.list=async({starting_after,limit})=>{
    const offset=starting_after?all.findIndex(x=>x.id===starting_after)+1:0;
    return {data:all.slice(offset,offset+limit),has_more:all.length>offset+limit};
  };
  const first=await loadTeamInvoices(args);
  const second=await loadTeamInvoices({...args,cursor:first.nextCursor});
  assert.deepEqual([...first.invoices,...second.invoices].map(x=>x.id),all.map(x=>x.id));
  assert.equal(second.nextCursor,null);
});
test('membership history includes ended and restarted periods without treating scheduled cancellation as an end', async () => {
  const args = fixture([invoice('in_123')], {
    sub_current: {...sub(),status:'active',start_date:300,canceled_at:400,ended_at:null,cancel_at_period_end:true},
    sub_old: {...sub({},'cus_old'),status:'canceled',start_date:100,canceled_at:180,ended_at:200,cancellation_details:{reason:'payment_failed'}},
    sub_foreign: {...sub({userId:'other'}),status:'canceled',start_date:500,ended_at:600}
  },true);
  const first = await loadTeamInvoices(args);
  assert.deepEqual(first.memberships,[
    {id:'sub_current',status:'active',startedAt:300,endedAt:null,canceledAt:400,cancellationReason:null},
    {id:'sub_old',status:'canceled',startedAt:100,endedAt:200,canceledAt:180,cancellationReason:'payment_failed'}
  ]);
  assert.ok(first.nextCursor);
  const second=await loadTeamInvoices({...args,cursor:first.nextCursor});
  assert.equal(Object.hasOwn(second,'memberships'),false);
});
test('membership history preserves unknown dates and uses fresh anchor over stale search result', async () => {
  const args=fixture();
  args.stripe.subscriptions.retrieve=async()=>({...sub(),status:'canceled',ended_at:900});
  args.stripe.subscriptions.search=async()=>({data:[{id:'sub_current',...sub(),status:'active',start_date:100}],has_more:false});
  const result=await loadTeamInvoices(args);
  assert.deepEqual(result.memberships,[{id:'sub_current',status:'canceled',startedAt:null,endedAt:900,canceledAt:null,cancellationReason:null}]);
});
