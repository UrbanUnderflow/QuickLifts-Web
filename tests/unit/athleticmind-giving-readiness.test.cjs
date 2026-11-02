const {test}=require('node:test');const assert=require('node:assert/strict');
const {createReadinessHandler}=require('../../netlify/functions/athleticmind-giving-readiness');
test('readiness uses existing live access and returns only availability, never configuration or financial details',async()=>{
 const endpoint={livemode:true,status:'enabled',url:'https://fitwithpulse.ai/.netlify/functions/stripe-webhook',enabled_events:['payment_intent.succeeded','charge.refunded']};
 const client={accounts:{retrieve:async()=>({id:'acct_1Sd8YLIkArZc741W',charges_enabled:true})},webhookEndpoints:{list:async()=>({data:[endpoint]})}};
 const handler=createReadinessHandler({env:{STRIPE_SECRET_KEY:'sk_live_fixture'},stripe:()=>client});
 const result=JSON.parse((await handler({httpMethod:'GET'})).body);assert.deepEqual(result,{oneTimeReady:true,monthlyReady:false,monthlyAmountIncrement:null,reason:'existing_payment_setup_verified'});
 assert.equal(JSON.stringify(result).includes('acct_'),false);assert.equal(JSON.stringify(result).includes('stripe-webhook'),false);
 endpoint.enabled_events=['payment_intent.succeeded'];assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).oneTimeReady,false);
 endpoint.enabled_events=['*'];endpoint.url='https://other.example/webhook';assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).oneTimeReady,false);
 endpoint.url='https://fitwithpulse.ai/.netlify/functions/stripe-webhook';endpoint.livemode=false;assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).oneTimeReady,false);
 client.accounts.retrieve=async()=>({id:'acct_other',charges_enabled:true});assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).oneTimeReady,false);
});
test('missing access and forbidden SDK access fail closed without creating credentials or endpoints',async()=>{
 let used=false;const closed=createReadinessHandler({env:{},stripe:()=>{used=true;throw Error();}});assert.equal(JSON.parse((await closed({httpMethod:'GET'})).body).oneTimeReady,false);assert.equal(used,false);
 const denied=createReadinessHandler({env:{STRIPE_SECRET_KEY:'sk_live_fixture'},stripe:()=>({accounts:{retrieve:async()=>{throw Error('Forbidden');}}})});assert.equal(JSON.parse((await denied({httpMethod:'GET'})).body).reason,'payment_access_unavailable');assert.equal((await denied({httpMethod:'POST'})).statusCode,405);
});
test('monthly readiness recognizes an existing compatible recurring price and invoice event subscription without catalog writes',async()=>{
 const endpoint={livemode:true,status:'enabled',url:'https://fitwithpulse.ai/.netlify/functions/stripe-webhook',enabled_events:['payment_intent.succeeded','charge.refunded','invoice.paid']};
 const client={accounts:{retrieve:async()=>({id:'acct_1Sd8YLIkArZc741W',charges_enabled:true})},webhookEndpoints:{list:async()=>({data:[endpoint]})},prices:{list:async()=>({data:[{livemode:true,active:true,currency:'usd',type:'recurring',recurring:{interval:'month',interval_count:1,usage_type:'licensed'},billing_scheme:'per_unit',unit_amount:100,product:{active:true,name:'AthleticMind monthly program contribution'}}],has_more:false})}};
 const handler=createReadinessHandler({env:{STRIPE_SECRET_KEY:'sk_live_fixture',ATHLETICMIND_SPONSOR_MONTHLY_PRICE_ID:'price_existing'},stripe:()=>client});
 assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).monthlyReady,true);
 endpoint.enabled_events.pop();assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).monthlyReady,false);
});
