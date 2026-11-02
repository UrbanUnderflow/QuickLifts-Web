const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, record, validate, configuration, SOURCE } = require('../../netlify/functions/lib/athleticmind-sponsorship');
const Stripe = require('stripe');
const env = { ATHLETICMIND_SPONSOR_MODE: 'test', STRIPE_TEST_SECRET_KEY: 'sk_test_mock', ATHLETICMIND_STRIPE_ACCOUNT_ID: 'acct_expected', ATHLETICMIND_SPONSOR_ORIGIN: 'http://localhost:3100', ATHLETICMIND_SPONSOR_WEBHOOK_SECRET: 'whsec_mock' };
const input = { amount: 2500, campaign: 'general', requestId: '12345678-1234-1234-1234-123456789abc' };
function memory() {
 const values = new Map();
 const ref = path => ({ doc: id => ref(`${path}/${id}`), collection: id => ref(`${path}/${id}`), path, orderBy: () => ref(path), limit: () => ref(path), get: async () => ({ exists: values.has(path), data: () => values.get(path), docs: [...values.entries()].filter(([key]) => key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/')).map(([,value]) => ({data: () => value})) }) });
 return { values, collection: ref, runTransaction: async fn => fn({ get: r => r.get(), set: (r, value) => values.set(r.path, value) }) };
}
function setup() {
 const db = memory(), calls = [];
 const client = { accounts: { retrieve: async () => ({ id: 'acct_expected' }) }, checkout: { sessions: { create: async (...args) => { calls.push(args); return { url: 'https://checkout.stripe.com/c/pay/test', livemode: false }; }, retrieve: async () => ({ livemode: false, metadata: { source: SOURCE }, payment_status: 'paid', customer_email: 'PRIVATE' }) } }, webhooks: new Stripe('sk_test_mock').webhooks, paymentIntents: { retrieve: async () => ({ id: 'pi_1', currency: 'usd', livemode: false, metadata: { source: SOURCE, campaign: 'general' }, latest_charge: { paid: true, currency: 'usd', amount: 2500, amount_refunded: 0, livemode: false } }) } };
 return { db, calls, client, handler: createHandler({ env, stripe: () => client, database: () => db }) };
}
const event = (action, body = input) => ({ httpMethod: 'POST', headers: { origin: env.ATHLETICMIND_SPONSOR_ORIGIN }, queryStringParameters: { action }, body: JSON.stringify(body) });
test('amounts, campaigns, and test-only gate', () => {
 for (const amount of [0,-1,499,1000001,5.2,'2500',NaN]) assert.throws(() => validate({ ...input, amount }));
 assert.throws(() => validate({ ...input, campaign: 'CAU' }));
 assert.throws(() => configuration({ ...env, STRIPE_TEST_SECRET_KEY: 'sk_live_no' }));
 assert.throws(() => configuration({ ...env, ATHLETICMIND_SPONSOR_MODE: 'live' }));
});
test('checkout fixes account, amount and return URLs; retries preserve key', async () => {
 const { handler, calls, client } = setup();
 assert.equal((await handler(event('checkout'))).statusCode,200); await handler(event('checkout'));
 assert.deepEqual(calls[0][1],calls[1][1]); assert.equal(calls[0][0].mode,'payment');
 assert.equal(calls[0][0].line_items[0].price_data.unit_amount,2500);
 assert.equal(calls[0][0].payment_intent_data.transfer_data,undefined);
 assert.match(calls[0][0].success_url,/^http:\/\/localhost:3100\/sponsor/);
 assert.equal((await handler({...event('checkout'),headers:{origin:'https://evil.example'}})).statusCode,403);
 client.accounts.retrieve = async () => ({ id: 'acct_wrong' });
 assert.equal((await handler(event('checkout'))).statusCode,503);
});
test('duplicate and out-of-order refund snapshots cannot inflate totals', async () => {
 const db=memory(), p={id:'pi_1',campaign:'general',gross:2500,refunded:500};
 await record(db,'evt_refund',p); await record(db,'evt_refund',p);
 await record(db,'evt_paid_late',{...p,refunded:0}); await record(db,'evt_full',{...p,refunded:2500});
 assert.deepEqual(db.values.get('athleticmind-sponsorship-test/totals'),{gross:2500,refunded:2500,payments:1});
});
test('SDK signature validation, base64, duplicates, live and Connect rejection',async()=>{
 const {handler,client,db}=setup();
 const signed={id:'evt_1',livemode:false,type:'checkout.session.completed',data:{object:{payment_status:'paid',payment_intent:'pi_1',metadata:{source:SOURCE,campaign:'general'}}}};
 const request=value=>{const payload=JSON.stringify(value);return {...event('webhook'),body:Buffer.from(payload).toString('base64'),isBase64Encoded:true,headers:{'stripe-signature':client.webhooks.generateTestHeaderString({payload,secret:env.ATHLETICMIND_SPONSOR_WEBHOOK_SECRET})}};};
 assert.equal((await handler({...request(signed),headers:{}})).statusCode,400);
 assert.equal((await handler(request({...signed,livemode:true}))).statusCode,400);
 assert.equal((await handler(request({...signed,account:'acct_connect'}))).statusCode,400);
 assert.equal((await handler(request(signed))).statusCode,200); assert.equal((await handler(request(signed))).statusCode,200);
 assert.equal(db.values.get('athleticmind-sponsorship-test/totals').gross,2500);
});
test('public status and totals contain no donor data',async()=>{
 const {handler}=setup();
 const r=await handler({...event('status'),httpMethod:'GET',queryStringParameters:{action:'status',session_id:'cs_test_123'}});
 assert.deepEqual(JSON.parse(r.body),{paid:true,mode:'test'});
 assert.deepEqual(JSON.parse((await handler({...event('totals'),httpMethod:'GET'})).body),{mode:'test',currency:'usd',net:0});
});
test('signed refund event records authoritative Stripe refund and rejects currency mismatch', async () => {
 const {handler,client,db}=setup();
 const refund={id:'evt_refund',livemode:false,type:'charge.refunded',data:{object:{payment_intent:'pi_1',metadata:{source:SOURCE,campaign:'general'}}}};
 client.paymentIntents.retrieve=async()=>({id:'pi_1',currency:'usd',livemode:false,metadata:{source:SOURCE,campaign:'general'},latest_charge:{paid:true,currency:'usd',amount:2500,amount_refunded:1000,livemode:false}});
 const send=async value=>{const payload=JSON.stringify(value);return handler({...event('webhook'),body:payload,headers:{'stripe-signature':client.webhooks.generateTestHeaderString({payload,secret:env.ATHLETICMIND_SPONSOR_WEBHOOK_SECRET})}});};
 assert.equal((await send(refund)).statusCode,200);
 assert.deepEqual(db.values.get('athleticmind-sponsorship-test/totals'),{gross:2500,refunded:1000,payments:1});
 client.paymentIntents.retrieve=async()=>({currency:'eur',metadata:{source:SOURCE,campaign:'general'}});
 assert.equal((await send({...refund,id:'evt_bad'})).statusCode,500);
});
test('API parameters cannot override test mode, account, currency, URLs or database selection', async () => {
 const {handler,calls}=setup();
 const request=event('checkout',{...input,mode:'live',livemode:true,currency:'eur',stripeAccount:'acct_attacker',destination:'acct_attacker',success_url:'https://evil.example',firebaseMode:'prod'});
 request.queryStringParameters.mode='live'; request.headers['x-pulsecheck-firebase-mode']='prod';
 assert.equal((await handler(request)).statusCode,200);
 assert.equal(calls[0][0].line_items[0].price_data.currency,'usd');
 assert.equal(calls[0][0].success_url,env.ATHLETICMIND_SPONSOR_ORIGIN+'/sponsor?result=success&session_id={CHECKOUT_SESSION_ID}');
 assert.equal(calls[0][1].stripeAccount,undefined);
 let initialized=false;
 const disabled=createHandler({env:{...env,ATHLETICMIND_SPONSOR_MODE:'disabled'},stripe:()=>{initialized=true;},database:()=>{throw Error('Unexpected database access');}});
 assert.equal((await disabled(request)).statusCode,503); assert.equal(initialized,false);
});
test('monthly consent, frequency and public profile boundaries',async()=>{
 const {handler,calls}=setup();
 assert.equal((await handler(event('checkout',{...input,frequency:'monthly'}))).statusCode,400);
 assert.equal((await handler(event('checkout',{...input,frequency:'weekly',recurringConsent:true}))).statusCode,400);
 await handler(event('checkout',{...input,name:'PRIVATE',school:'PRIVATE',message:'PRIVATE'}));
 assert.equal(calls[0][0].metadata.public_name,'');assert.equal(calls[0][0].metadata.public_message,'');
 await handler(event('checkout',{...input,frequency:'monthly',recurringConsent:true,publicDisplay:true,anonymous:true,name:'PRIVATE',school:' Example   University '}));
 const c=calls[1][0];assert.equal(c.mode,'subscription');assert.deepEqual(c.line_items[0].price_data.recurring,{interval:'month'});
 assert.equal(c.subscription_data.metadata.public_name,'Anonymous supporter');assert.equal(c.subscription_data.metadata.public_school,'Example University');assert.equal(c.payment_intent_data,undefined);
});
test('normalized schools, renewals, duplicates and refunds count one vote per plan',async()=>{
 const {publicProfile}=require('../../netlify/functions/lib/athleticmind-sponsorship');
 const db=memory(),profile=publicProfile({publicDisplay:true,name:'Example',school:' EXAMPLE   University! ',message:'Keep going'});
 assert.equal(profile.schoolKey,publicProfile({publicDisplay:true,school:'example university'}).schoolKey);
 const p={id:'pi_a',group:'sub_a',campaign:'general',gross:2500,refunded:0,profile,created:1};
 await record(db,'a',p);await record(db,'a',p);await record(db,'b',{...p,id:'pi_b'});
 const school=()=>[...db.values.entries()].find(([k])=>k.includes('/schools/'))[1];
 assert.equal(school().count,1);assert.equal(db.values.get('athleticmind-sponsorship-test/board/supporters/sub_a').net,5000);
 await record(db,'ra',{...p,refunded:2500});assert.equal(school().count,1);
 await record(db,'rb',{...p,id:'pi_b',refunded:2500});assert.equal(school().count,0);
 await record(db,'stale',p);assert.equal(school().count,0);
 await record(db,'private',{id:'pi_private',campaign:'general',gross:1000,refunded:0});assert.equal(db.values.has('athleticmind-sponsorship-test/board/supporters/pi_private'),false);
});
test('monthly invoice verification, duplicate delivery, refunds and unpaid invoices',async()=>{
 const {handler,client,db}=setup();const metadata={source:SOURCE,campaign:'general',public_display:'yes',public_name:'Example'};
 client.invoices={retrieve:async()=>({paid:true,livemode:false,payment_intent:'pi_month',subscription:'sub_month',subscription_details:{metadata}})};
 client.paymentIntents.retrieve=async()=>({id:'pi_month',currency:'usd',livemode:false,latest_charge:{paid:true,currency:'usd',amount:2500,amount_refunded:0,livemode:false}});
 const send=async(type,object,id='evt_month')=>{const payload=JSON.stringify({id,type,livemode:false,data:{object}});return handler({...event('webhook'),body:payload,headers:{'stripe-signature':client.webhooks.generateTestHeaderString({payload,secret:env.ATHLETICMIND_SPONSOR_WEBHOOK_SECRET})}});};
 await send('checkout.session.completed',{mode:'subscription',payment_status:'paid',metadata});assert.equal(db.values.size,0);
 assert.equal((await send('invoice.payment_succeeded',{id:'in_month'})).statusCode,200);await send('invoice.payment_succeeded',{id:'in_month'});
 assert.equal(db.values.get('athleticmind-sponsorship-test/totals').gross,2500);
 client.paymentIntents.retrieve=async()=>({id:'pi_month',currency:'usd',livemode:false,latest_charge:{paid:true,currency:'usd',amount:2500,amount_refunded:2500,livemode:false}});
 client.charges={retrieve:async id=>{assert.equal(id,'ch_month');return {invoice:'in_month'};}};
 await send('charge.refunded',{id:'ch_month'},'refund');assert.equal(db.values.get('athleticmind-sponsorship-test/totals').refunded,2500);
 client.invoices.retrieve=async()=>({paid:false,livemode:false,payment_intent:'pi_future',subscription_details:{metadata}});
 await send('invoice.payment_succeeded',{id:'in_future'},'future');assert.equal(db.values.get('athleticmind-sponsorship-test/totals').payments,1);
});
test('cancel authenticates the private test session and ignores user supplied plan ids',async()=>{
 const {handler,client}=setup();let update;
 client.checkout.sessions.retrieve=async()=>({livemode:false,metadata:{source:SOURCE},subscription:'sub_own'});
 client.subscriptions={retrieve:async()=>({id:'sub_own',livemode:false,metadata:{source:SOURCE},status:'active'}),update:async(...args)=>{update=args;return {cancel_at_period_end:true};}};
 assert.equal((await handler(event('cancel',{session_id:'cs_test_secret',subscription:'sub_other'}))).statusCode,200);assert.deepEqual(update,['sub_own',{cancel_at_period_end:true},{idempotencyKey:SOURCE+':cancel:sub_own'}]);
 client.checkout.sessions.retrieve=async()=>({livemode:true,metadata:{source:SOURCE},subscription:'sub_own'});
 assert.equal((await handler(event('cancel',{session_id:'cs_test_secret'}))).statusCode,404);
});

test('public board projects only opted-in display fields and excludes refunded entries',async()=>{
 const {handler,db}=setup();
 db.values.set('athleticmind-sponsorship-test/board/supporters/public',{name:'Example',net:1000,school:'Example School',message:'Go team',email:'PRIVATE',customer:'PRIVATE'});
 db.values.set('athleticmind-sponsorship-test/board/supporters/refunded',{name:'Refunded',net:0});
 db.values.set('athleticmind-sponsorship-test/ledger/payments/legacy',{gross:5000,email:'PRIVATE'});
 db.values.set('athleticmind-sponsorship-test/board/schools/example',{name:'Example School',count:1});
 const response=await handler({...event('board'),httpMethod:'GET'});assert.equal(response.statusCode,200);
 assert.deepEqual(JSON.parse(response.body).supporters,[{name:'Example',net:1000,school:'Example School',message:'Go team'}]);
 assert.equal(response.body.includes('PRIVATE'),false);
});
const liveEnv={...env,ATHLETICMIND_SPONSOR_MODE:'live',STRIPE_SECRET_KEY:'sk_live_synthetic_fixture',ATHLETICMIND_STRIPE_ACCOUNT_ID:'acct_synthetic',ATHLETICMIND_SPONSOR_ORIGIN:'https://giving.example',ATHLETICMIND_SPONSOR_LIVE_APPROVED:'true',ATHLETICMIND_SPONSOR_RECIPIENT_NAME:'Synthetic Approved Recipient',ATHLETICMIND_SPONSOR_TERMS_VERSION:'synthetic-v1',ATHLETICMIND_SPONSOR_TERMS_URL:'https://giving.example/terms',ATHLETICMIND_SPONSOR_REFUND_URL:'https://giving.example/refunds',ATHLETICMIND_SPONSOR_SUPPORT_EMAIL:'support@giving.example'};
function liveSetup(){const fixture=setup();fixture.client.accounts.retrieve=async()=>({id:'acct_synthetic'});fixture.client.checkout.sessions.create=async(...args)=>{fixture.calls.push(args);return {id:'cs_live_synthetic',mode:args[0].mode,metadata:args[0].metadata,url:'https://checkout.stripe.com/synthetic',livemode:true};};return {...fixture,handler:createHandler({env:liveEnv,stripe:()=>fixture.client,database:()=>fixture.db})};}
const liveRequest=(action,body={...input,termsAccepted:true,termsVersion:'synthetic-v1'})=>({...event(action,body),headers:{origin:liveEnv.ATHLETICMIND_SPONSOR_ORIGIN}});
test('live launch configuration fails closed without every explicit approval and disclosure',()=>{
 for(const key of ['ATHLETICMIND_SPONSOR_LIVE_APPROVED','STRIPE_SECRET_KEY','ATHLETICMIND_SPONSOR_RECIPIENT_NAME','ATHLETICMIND_SPONSOR_TERMS_VERSION','ATHLETICMIND_SPONSOR_TERMS_URL','ATHLETICMIND_SPONSOR_REFUND_URL','ATHLETICMIND_SPONSOR_SUPPORT_EMAIL'])assert.throws(()=>configuration({...liveEnv,[key]:''}),key);
 assert.throws(()=>configuration({...liveEnv,STRIPE_SECRET_KEY:'sk_test_not_live'}));
 assert.throws(()=>configuration({...liveEnv,ATHLETICMIND_SPONSOR_ORIGIN:'http://localhost:3100'}));
 assert.throws(()=>configuration({...liveEnv,ATHLETICMIND_SPONSOR_TERMS_URL:'https://other.example/terms'}));
 const c=configuration(liveEnv);assert.equal(c.collection,'athleticmind-sponsorship-live');assert.equal(c.firebaseMode,'prod');assert.equal(c.keyName,'STRIPE_SECRET_KEY');assert.equal(JSON.stringify(c).includes('sk_live'),false);
});
test('live checkout binds recipient/version and requires payment terms as well as monthly consent',async()=>{
 const {handler,calls}=liveSetup();
 assert.equal((await handler(liveRequest('checkout',input))).statusCode,400);
 assert.equal((await handler(liveRequest('checkout',{...input,termsAccepted:true,termsVersion:'old'}))).statusCode,400);
 assert.equal((await handler(liveRequest('checkout',{...input,termsAccepted:true,termsVersion:'synthetic-v1',frequency:'monthly'}))).statusCode,400);
 assert.equal((await handler(liveRequest('checkout',{...input,termsAccepted:true,termsVersion:'synthetic-v1',frequency:'monthly',recurringConsent:true}))).statusCode,503);
 assert.equal(calls.length,0);

});
test('live and test webhooks cannot cross ledgers; live payments/refunds remain idempotent',async()=>{
 const {handler,client,db}=liveSetup();
 client.paymentIntents.retrieve=async()=>({id:'pi_live_fixture',livemode:true,currency:'usd',metadata:{source:SOURCE,campaign:'general'},latest_charge:{livemode:true,paid:true,currency:'usd',amount:2500,amount_refunded:0}});
 const payload={id:'evt_live_fixture',livemode:true,type:'checkout.session.completed',data:{object:{livemode:true,payment_status:'paid',payment_intent:'pi_live_fixture',metadata:{source:SOURCE,campaign:'general'}}}};
 const send=async p=>{const body=JSON.stringify(p);return handler({...liveRequest('webhook'),body,headers:{'stripe-signature':client.webhooks.generateTestHeaderString({payload:body,secret:liveEnv.ATHLETICMIND_SPONSOR_WEBHOOK_SECRET})}});};
 assert.equal((await send({...payload,livemode:false})).statusCode,400);
 assert.equal((await send(payload)).statusCode,200);await send(payload);
 assert.equal(db.values.get('athleticmind-sponsorship-live/totals').gross,2500);assert.equal(db.values.has('athleticmind-sponsorship-test/totals'),false);
 client.paymentIntents.retrieve=async()=>({id:'pi_live_fixture',livemode:true,currency:'usd',metadata:{source:SOURCE,campaign:'general'},latest_charge:{livemode:true,paid:true,currency:'usd',amount:2500,amount_refunded:2500}});
 await send({...payload,id:'evt_live_refund',type:'charge.refunded'});assert.equal(db.values.get('athleticmind-sponsorship-live/totals').refunded,2500);
 const totals=await handler({...liveRequest('totals'),httpMethod:'GET'});const result=JSON.parse(totals.body);assert.equal(result.net,0);assert.equal(result.mode,'live');assert.equal(result.stale,false);assert.ok(Number.isSafeInteger(result.verifiedAt));
});
test('live handler rejects test Checkout responses and request attempts to grant launch approval',async()=>{
 const {handler,client}=liveSetup();client.checkout.sessions.create=async()=>({livemode:false,url:'https://checkout.stripe.com/test'});
 assert.equal((await handler(liveRequest('checkout'))).statusCode,503);
 let initialized=false;const closed=createHandler({env:{...liveEnv,ATHLETICMIND_SPONSOR_LIVE_APPROVED:''},stripe:()=>{initialized=true;},database:()=>{throw Error('Unexpected');}});
 assert.equal((await closed(liveRequest('checkout',{...input,ATHLETICMIND_SPONSOR_LIVE_APPROVED:'true',termsAccepted:true,termsVersion:'synthetic-v1'}))).statusCode,503);assert.equal(initialized,false);
});

test('existing webhook event names use the same verified ledger without a new signing secret', async()=>{
 const {processVerifiedEvent}=require('../../netlify/functions/lib/athleticmind-sponsorship');
 const {client,db}=setup();
 const config={live:false,collection:'athleticmind-sponsorship-test'};
 const piEvent={id:'evt_pi',livemode:false,type:'payment_intent.succeeded',data:{object:{id:'pi_1',metadata:{source:SOURCE,campaign:'general'}}}};
 assert.equal(await processVerifiedEvent({signed:piEvent,client,database:db,config}),true);
 await processVerifiedEvent({signed:piEvent,client,database:db,config});
 assert.equal(db.values.get(config.collection+'/totals').gross,2500);
 client.invoices={retrieve:async()=>({paid:true,livemode:false,payment_intent:'pi_1',subscription:'sub_mock',subscription_details:{metadata:{source:SOURCE,campaign:'general'}}})};
 assert.equal(await processVerifiedEvent({signed:{id:'evt_invoice',livemode:false,type:'invoice.paid',data:{object:{id:'in_mock'}}},client,database:db,config}),true);
 assert.equal(db.values.get(config.collection+'/totals').gross,2500);
});

test('one-time adapter uses existing platform account without catalog, recurring or Connect mutations', async () => {
 const {client,db}=setup();const intents=[];
 client.paymentIntents.create=async(params,options)=>{intents.push({params,options});return {id:'pi_mock',client_secret:'pi_mock_secret_fixture',amount:params.amount,currency:'usd',livemode:false};};
 client.checkout.sessions.create=async()=>{throw Error('Must not create a Checkout catalog item');};
 const handler=createHandler({env,stripe:()=>client,database:()=>db,publishableKey:()=> 'pk_test_fixture'});
 const body={...input,publicDisplay:true,anonymous:true,name:'Private name',school:'  Example School  ',message:'Keep going',destination:'acct_other',setup_future_usage:'off_session'};
 const first=await handler(event('payment-intent',body));assert.equal(first.statusCode,200);
 assert.deepEqual(JSON.parse(first.body),{clientSecret:'pi_mock_secret_fixture',publishableKey:'pk_test_fixture',amount:2500,mode:'test'});
 await handler(event('payment-intent',body));assert.deepEqual(intents[0],intents[1]);
 assert.deepEqual(Object.keys(intents[0].params).sort(),['amount','currency','description','metadata','payment_method_types']);
 assert.equal(intents[0].params.metadata.public_name,'Anonymous supporter');assert.equal(intents[0].params.metadata.public_school,'Example School');
 assert.deepEqual(intents[0].params.payment_method_types,['card']);
 assert.equal(intents[0].params.metadata.recurring_consent,'');assert.equal(intents[0].options.stripeAccount,undefined);
 assert.equal(db.values.size,0,'unpaid intents must not count as donations');
 const monthly=await handler(event('payment-intent',{...input,frequency:'monthly',recurringConsent:true}));assert.equal(monthly.statusCode,409);assert.equal(intents.length,2);
 const bad=await handler(event('payment-intent',{...input,amount:499}));assert.equal(bad.statusCode,400);assert.equal(intents.length,2);
});
test('one-time live adapter enforces terms, account and mode and keeps private profile out of Stripe metadata',async()=>{
 const {client,db}=liveSetup();let created=0;
 client.paymentIntents.create=async p=>{created++;assert.equal(p.metadata.public_name,'');assert.equal(p.metadata.public_school,'');assert.equal(p.metadata.public_message,'');return {id:'pi_mock',client_secret:'pi_mock_secret_fixture',amount:p.amount,currency:'usd',livemode:true};};
 const handler=createHandler({env:liveEnv,stripe:()=>client,database:()=>db,publishableKey:()=> 'pk_live_fixture'});
 assert.equal((await handler(liveRequest('payment-intent',input))).statusCode,400);assert.equal(created,0);
 assert.equal((await handler(liveRequest('payment-intent',{...input,termsAccepted:true,termsVersion:'synthetic-v1',name:'Private',school:'Private',message:'Private'}))).statusCode,200);
 client.accounts.retrieve=async()=>({id:'acct_wrong'});
 assert.equal((await handler(liveRequest('payment-intent'))).statusCode,503);assert.equal(created,1);
 client.accounts.retrieve=async()=>({id:'acct_synthetic'});
 client.paymentIntents.create=async p=>({id:'pi_mock',client_secret:'pi_mock_secret_fixture',amount:p.amount,currency:'usd',livemode:false});
 assert.equal((await handler(liveRequest('payment-intent'))).statusCode,502);
});

test('monthly existing price and exact quantity reuse creates no products or prices',async()=>{
 const {monthlyLineItem}=require('../../netlify/functions/lib/athleticmind-sponsorship');
 const price={id:'price_existing',livemode:true,active:true,currency:'usd',type:'recurring',recurring:{interval:'month',interval_count:1,usage_type:'licensed'},billing_scheme:'per_unit',unit_amount:100,product:{active:true,name:'AthleticMind monthly program contribution'}};
 const client={prices:{retrieve:async id=>{assert.equal(id,'price_existing');return price;}}};
 const input={env:{ATHLETICMIND_SPONSOR_MONTHLY_PRICE_ID:'price_existing'},client,config:{live:true},amount:2500};
 assert.deepEqual(await monthlyLineItem(input),{price:'price_existing',quantity:25});
 await assert.rejects(monthlyLineItem({...input,amount:2550}),/exact amount/);
 price.recurring.interval='year';await assert.rejects(monthlyLineItem(input),/unavailable/);price.recurring.interval='month';
 price.livemode=false;await assert.rejects(monthlyLineItem(input),/unavailable/);price.livemode=true;
 price.transform_quantity={divide_by:10,round:'up'};await assert.rejects(monthlyLineItem(input),/unavailable/);
});
test('Pulse inline monthly pattern is locally supported but cannot create live catalog records without explicit server authorization',async()=>{
 const {monthlyLineItem}=require('../../netlify/functions/lib/athleticmind-sponsorship');
 await assert.rejects(monthlyLineItem({env:{},client:{},config:{live:true},amount:2550}),/awaiting activation/);
 const item=await monthlyLineItem({env:{ATHLETICMIND_SPONSOR_ALLOW_NEW_PRICE_RECORDS:'true'},client:{},config:{live:true},amount:2550});
 assert.equal(item.price_data.unit_amount,2550);assert.deepEqual(item.price_data.recurring,{interval:'month'});assert.equal(item.quantity,1);
});
test('live monthly checkout reuses configured price, preserves exact amount/consent, and never provisions Pulse memberships or transfers',async()=>{
 const {client,db,calls}=liveSetup();
 client.prices={retrieve:async()=>({id:'price_existing',livemode:true,active:true,currency:'usd',type:'recurring',recurring:{interval:'month',interval_count:1,usage_type:'licensed'},billing_scheme:'per_unit',unit_amount:100,product:{active:true,name:'AthleticMind monthly program contribution'}})};
 const handler=createHandler({env:{...liveEnv,ATHLETICMIND_SPONSOR_MONTHLY_PRICE_ID:'price_existing'},stripe:()=>client,database:()=>db});
 const body={...input,termsAccepted:true,termsVersion:'synthetic-v1',frequency:'monthly',recurringConsent:true,priceId:'price_attacker',subscription_data:{transfer_data:{destination:'acct_attacker'}}};
 assert.equal((await handler(liveRequest('checkout',body))).statusCode,200);
 const params=calls[0][0];assert.equal(params.mode,'subscription');assert.deepEqual(params.line_items,[{price:'price_existing',quantity:25}]);
 assert.deepEqual(Object.keys(params.subscription_data),['metadata']);assert.equal(params.subscription_data.metadata.recurring_consent,'monthly-v1');assert.equal(params.subscription_data.metadata.source,SOURCE);assert.equal(params.subscription_data.metadata.userType,undefined);assert.equal(params.subscription_data.trial_period_days,undefined);
 assert.equal((await handler(liveRequest('checkout',{...body,amount:2550}))).statusCode,409);assert.equal(calls.length,1);
});
test('monthly status reports current schedule and cancellation without billing identity',async()=>{
 const {handler,client}=setup();client.checkout.sessions.retrieve=async()=>({livemode:false,metadata:{source:SOURCE},payment_status:'paid',subscription:'sub_month'});
 const plan={id:'sub_month',livemode:false,status:'active',metadata:{source:SOURCE},current_period_end:1900000000,cancel_at_period_end:false,items:{data:[{quantity:25,price:{unit_amount:100,currency:'usd',recurring:{interval:'month'}}}]},customer_email:'private@example.com'};
 client.subscriptions={retrieve:async()=>plan};
 const request={...event('status'),httpMethod:'GET',queryStringParameters:{action:'status',session_id:'cs_test_private'}};
 assert.deepEqual(JSON.parse((await handler(request)).body),{paid:true,mode:'test',recurring:true,amount:2500,interval:'month',cancelAtPeriodEnd:false,nextPaymentAt:1900000000});
 plan.cancel_at_period_end=true;assert.equal(JSON.parse((await handler(request)).body).nextPaymentAt,null);
});
test('renewal invoice and refund retrieve subscription metadata when invoice metadata is absent',async()=>{
 const {processVerifiedEvent}=require('../../netlify/functions/lib/athleticmind-sponsorship');const {client,db}=setup();
 const metadata={source:SOURCE,campaign:'general',public_display:'yes',public_name:'Synthetic renewal',public_school:'Synthetic School'};
 let refunded=0;client.invoices={retrieve:async()=>({paid:true,livemode:false,payment_intent:'pi_renew',subscription:'sub_same'})};client.subscriptions={retrieve:async()=>({livemode:false,metadata})};
 client.paymentIntents.retrieve=async()=>({id:'pi_renew',livemode:false,currency:'usd',latest_charge:{livemode:false,paid:true,currency:'usd',amount:2550,amount_refunded:refunded}});
 const send=(id,type,object)=>processVerifiedEvent({signed:{id,type,livemode:false,data:{object}},client,database:db,config:{live:false,collection:'athleticmind-sponsorship-test'}});
 await send('evt_paid','invoice.paid',{id:'in_renew'});await send('evt_paid','invoice.paid',{id:'in_renew'});assert.equal(db.values.get('athleticmind-sponsorship-test/totals').gross,2550);
 refunded=2550;await send('evt_refund','charge.refunded',{invoice:'in_renew'});assert.equal(db.values.get('athleticmind-sponsorship-test/totals').refunded,2550);
});

test('live payment creation cannot disclose a client secret when durable tracking fails',async()=>{
 const {client}=liveSetup();client.paymentIntents.create=async p=>({id:'pi_fixture',client_secret:'pi_fixture_secret_private',amount:p.amount,currency:'usd',livemode:true});
 const db=memory();db.runTransaction=async()=>{throw Error('Synthetic storage failure')};
 const handler=createHandler({env:liveEnv,stripe:()=>client,database:()=>db,publishableKey:()=> 'pk_live_fixture'});
 const result=await handler(liveRequest('payment-intent',{...input,termsAccepted:true,termsVersion:'synthetic-v1'}));
 assert.equal(result.statusCode,500);assert.equal(result.body.includes('clientSecret'),false);assert.equal(result.body.includes('secret_private'),false);
});

test('approved monthly inline record is donation-only, exact cents, durable and private by default',async()=>{
 const {client,db,calls}=liveSetup();const handler=createHandler({env:{...liveEnv,ATHLETICMIND_SPONSOR_ALLOW_NEW_PRICE_RECORDS:'true'},stripe:()=>client,database:()=>db});
 const body={...input,amount:537,termsAccepted:true,termsVersion:'synthetic-v1',frequency:'monthly',recurringConsent:true,name:'PRIVATE',school:'PRIVATE',message:'PRIVATE'};
 assert.equal((await handler(liveRequest('checkout',body))).statusCode,200);
 const params=calls[0][0];const item=params.line_items[0];assert.equal(item.quantity,1);assert.equal(item.price_data.unit_amount,537);assert.deepEqual(item.price_data.recurring,{interval:'month'});assert.equal(item.price_data.product_data.metadata.source,SOURCE);assert.equal(params.metadata.public_name,'');assert.equal(params.subscription_data.metadata.recurring_consent,'monthly-v1');assert.equal(params.subscription_data.transfer_data,undefined);
 assert.equal(JSON.stringify([...db.values.values()]).includes('PRIVATE'),false);
 client.checkout.sessions.retrieve=async()=>({id:'cs_live_synthetic',status:'open',mode:'subscription',metadata:params.metadata,livemode:true,url:'https://checkout.stripe.com/synthetic'});
 assert.equal((await handler(liveRequest('checkout',body))).statusCode,200);assert.equal(calls.length,1);
 assert.equal((await handler(liveRequest('checkout',{...body,amount:538}))).statusCode,409);
});
test('monthly storage failure withholds Checkout URL',async()=>{
 const {client,db}=liveSetup();db.runTransaction=async()=>{throw Error('storage failure')};const handler=createHandler({env:{...liveEnv,ATHLETICMIND_SPONSOR_ALLOW_NEW_PRICE_RECORDS:'true'},stripe:()=>client,database:()=>db});
 const result=await handler(liveRequest('checkout',{...input,termsAccepted:true,termsVersion:'synthetic-v1',frequency:'monthly',recurringConsent:true}));assert.equal(result.statusCode,500);assert.equal(JSON.parse(result.body).url,undefined);
});
