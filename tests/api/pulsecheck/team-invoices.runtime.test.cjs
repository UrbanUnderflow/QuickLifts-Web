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
    stripe: { subscriptions: { retrieve: async id => subscriptions[id] || sub() }, invoices: { list: async args => { calls.push(args); return {data,has_more:hasMore}; } } } };
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
