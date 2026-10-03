const test = require('node:test');
const assert = require('node:assert/strict');
const { createFirestoreAdminMock, withModuleMocks } = require('../firebase-admin/_runtimeHarness.cjs');
const { loadTeamBilling, loadMemberCheckout } = require('../../../netlify/functions/lib/pulsecheck-team-billing');
const records = () => ({
  users: [{id:'athlete',data:{pulseCheckTeamId:'team'}}],
  'pulsecheck-team-memberships': [{id:'team_athlete',data:{userId:'athlete',teamId:'team',organizationId:'org',role:'athlete',status:'active'}}],
  'pulsecheck-teams': [{id:'team',data:{displayName:'Building Bodies',organizationId:'org',status:'active',commercialConfig:{commercialModel:'athlete-pay',athleteAppSubscriptionEnabled:true,athleteAppSubscriptionMonthlyPriceCents:4000,athleteAppSubscriptionCurrency:'usd',athleteAppSubscriptionOfferVersion:1}}}],
  'pulsecheck-organizations': [{id:'org',data:{status:'active'}}],
  'pulsecheck-athlete-app-offers': [{id:'team',data:{teamId:'team',organizationId:'org',enabled:true,status:'active',monthlyPriceCents:4000,currency:'usd',interval:'month',version:1,stripeByMode:{live:{active:true,priceId:'price_team'}}}}],
  'pulsecheck-athlete-app-entitlements':[{id:'team_athlete',data:{stripeSubscriptionId:'sub_team',status:'canceled'}}]
});
const database = collections => createFirestoreAdminMock({collections}).db;
const stripe = (status, metadata = {userId:'athlete',pulsecheckTeamId:'team'}) => ({subscriptions:{retrieve:async()=>({status,metadata,latest_invoice:{status:'open',hosted_invoice_url:'https://invoice.stripe.com/i/example'}})}});
const args = (db, client) => ({database:db,userId:'athlete',requestedTeamId:'team',stripeMode:'live',stripe:client,authenticatedEmail:'athlete@example.com'});
test('team athlete retains team identity and configured $40 price after cancellation', async()=>{
  const result=await loadTeamBilling({database:database(records()),userId:'athlete'});
  assert.equal(result.isTeamAthlete,true); assert.equal(result.team.name,'Building Bodies'); assert.equal(result.price.amountCents,4000); assert.equal(result.status,'canceled');
});
test('individual account explicitly resolves false, unresolved team hint fails closed',async()=>{
  assert.equal((await loadTeamBilling({database:database({users:[{id:'athlete',data:{}}]}),userId:'athlete'})).isTeamAthlete,false);
  await assert.rejects(loadTeamBilling({database:database({users:[{id:'athlete',data:{pulseCheckTeamId:'team'}}]}),userId:'athlete'}),/could not be confirmed/);
});
test('foreign team selection cannot load billing or create checkout',async()=>{
  await assert.rejects(loadTeamBilling({database:database(records()),userId:'athlete',teamId:'foreign'}),/could not be confirmed/);
});
test('past due goes to existing invoice while canceled creates same team offer without redeemed invite',async()=>{
  const db=database(records());
  assert.equal((await loadMemberCheckout(args(db,stripe('past_due')))).recoveryUrl,'https://invoice.stripe.com/i/example');
  const checkout=await loadMemberCheckout(args(db,stripe('canceled')));
  assert.equal(checkout.priceId,'price_team'); assert.equal(checkout.inviteToken,''); assert.equal(checkout.teamId,'team');
});
test('active subscription and mismatched Stripe identity cannot create a second subscription',async()=>{
  const db=database(records());
  await assert.rejects(loadMemberCheckout(args(db,stripe('active'))),error=>error.alreadyActive===true);
  await assert.rejects(loadMemberCheckout(args(db,stripe('canceled',{userId:'other',pulsecheckTeamId:'team'}))),/could not be verified/);
});
test('team managed access and out of date price never fall back to individual checkout',async()=>{
  const teamPlan=records(); teamPlan['pulsecheck-teams'][0].data.commercialConfig.commercialModel='team-plan';
  assert.equal((await loadTeamBilling({database:database(teamPlan),userId:'athlete'})).price,null);
  await assert.rejects(loadMemberCheckout(args(database(teamPlan),stripe('canceled'))),/contact your team/);
  const stale=records(); stale['pulsecheck-athlete-app-offers'][0].data.monthlyPriceCents=2900;
  await assert.rejects(loadMemberCheckout(args(database(stale),stripe('canceled'))),/price is being updated/);
});


test('billing context endpoint hides payment URL for inactive or sponsored teams and requires auth', async () => {
  const endpoint = require.resolve('../../../netlify/functions/get-pulsecheck-athlete-billing-context');
  const load = (db, authError, appName = 'pulsecheck-prod-admin') => {
    delete require.cache[endpoint];
    return withModuleMocks({
      './config/firebase': { headers: {} },
      './lib/pulsecheck-coach-services': { verifyFirebaseUser: async () => {
        if (authError) throw Object.assign(new Error('Sign in'), { statusCode: 401 });
        return { userId: 'athlete', app: { name: appName, firestore: () => db } };
      } },
    }, () => require(endpoint));
  };
  for (const variant of ['team-inactive', 'org-inactive', 'sponsored', 'disabled']) {
    const rows = records();
    if (variant === 'team-inactive') rows['pulsecheck-teams'][0].data.status = 'inactive';
    if (variant === 'org-inactive') rows['pulsecheck-organizations'][0].data.status = 'inactive';
    if (variant === 'sponsored') rows['pulsecheck-teams'][0].data.commercialConfig.commercialModel = 'team-plan';
    if (variant === 'disabled') rows['pulsecheck-teams'][0].data.commercialConfig.athleteAppSubscriptionEnabled = false;
    const result = await load(database(rows)).handler({ httpMethod: 'POST', body: '{}' });
    assert.equal(result.statusCode, 200);
    assert.equal(JSON.parse(result.body).paymentUrl, null);
    assert.equal(JSON.parse(result.body).isTeamAthlete, true);
  }
  assert.equal((await load(database(records()), true).handler({ httpMethod: 'POST', body: '{}' })).statusCode, 401);
  const dev = await load(database(records()), false, 'pulsecheck-dev-admin').handler({ httpMethod: 'POST', body: '{}' });
  assert.match(JSON.parse(dev.body).paymentUrl, /devFirebase=1/);
});

test('recovery validates organization and environment and preserves existing invoice when new-sale price changes', async () => {
  const wrongOrg = records();
  wrongOrg['pulsecheck-team-memberships'][0].data.organizationId = 'other';
  await assert.rejects(loadMemberCheckout(args(database(wrongOrg), stripe('canceled'))), /membership could not be verified/);
  await assert.rejects(loadMemberCheckout(args(database(records()), stripe('canceled', { userId: 'athlete', pulsecheckTeamId: 'team', pulsecheckFirebaseMode: 'dev' }))), /could not be verified/);
  const stale = records(); stale['pulsecheck-athlete-app-offers'][0].data.monthlyPriceCents = 2900;
  assert.equal((await loadMemberCheckout(args(database(stale), stripe('past_due')))).recoveryUrl, 'https://invoice.stripe.com/i/example');
});
