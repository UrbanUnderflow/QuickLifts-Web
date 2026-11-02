const {test}=require('node:test');const assert=require('node:assert/strict');
const {createReadinessHandler}=require('../../netlify/functions/athleticmind-giving-readiness');
test('readiness uses existing live access and returns only availability, never configuration or financial details',async()=>{
 const endpoint={livemode:true,status:'enabled',url:'https://fitwithpulse.ai/.netlify/functions/stripe-webhook',enabled_events:['payment_intent.succeeded','charge.refunded']};
 const client={accounts:{retrieve:async()=>({id:'acct_1Sd8YLIkArZc741W',charges_enabled:true})},webhookEndpoints:{list:async()=>({data:[endpoint]})}};
 const handler=createReadinessHandler({env:{STRIPE_SECRET_KEY:'sk_live_fixture'},stripe:()=>client});
 const result=JSON.parse((await handler({httpMethod:'GET'})).body);const {webhookCoverage,...availability}=result;assert.deepEqual(webhookCoverage,[{handler:'stripe-webhook',subscribedEvents:['charge.refunded','payment_intent.succeeded']},{handler:'stripe-coach-webhook',subscribedEvents:[]},{handler:'stripe-deposit-webhook',subscribedEvents:[]}]);assert.deepEqual(availability,{oneTimeReady:true,monthlyReady:false,monthlyAmountIncrement:null,reason:'existing_success_event_and_readthrough_refunds',refundVerification:'bounded_readthrough',subscribedEvents:['charge.refunded','payment_intent.succeeded'],missingEvents:[],monthlyReason:'no_existing_donation_price'});
 assert.equal(JSON.stringify(result).includes('acct_'),false);assert.equal(JSON.stringify(result).includes('https://'),false);
 endpoint.url='https://pulsecheckmind.ai/.netlify/functions/stripe-webhook';assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).oneTimeReady,true);
 endpoint.enabled_events=['payment_intent.succeeded'];assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).oneTimeReady,true);
 endpoint.url='https://fitwithpulse.ai/.netlify/functions/stripe-deposit-webhook';assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).oneTimeReady,true);
 endpoint.enabled_events=['*'];endpoint.url='https://other.example/webhook';assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).oneTimeReady,false);
 endpoint.url='https://fitwithpulse.ai/.netlify/functions/stripe-webhook';endpoint.livemode=false;assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).oneTimeReady,false);
 client.accounts.retrieve=async()=>({id:'acct_other',charges_enabled:true});assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).oneTimeReady,false);
});
test('missing access and forbidden SDK access fail closed without creating credentials or endpoints',async()=>{
 let used=false;const closed=createReadinessHandler({env:{},stripe:()=>{used=true;throw Error();}});assert.equal(JSON.parse((await closed({httpMethod:'GET'})).body).oneTimeReady,false);assert.equal(used,false);
 const denied=createReadinessHandler({env:{STRIPE_SECRET_KEY:'sk_live_fixture'},stripe:()=>({accounts:{retrieve:async()=>{throw Error('Forbidden');}}})});assert.equal(JSON.parse((await denied({httpMethod:'GET'})).body).reason,'payment_access_unavailable');assert.equal((await denied({httpMethod:'POST'})).statusCode,405);
});
test('monthly remains closed even with an existing compatible price during the one-time-only release',async()=>{
 const endpoint={livemode:true,status:'enabled',url:'https://fitwithpulse.ai/.netlify/functions/stripe-webhook',enabled_events:['payment_intent.succeeded','charge.refunded','invoice.paid']};
 const client={accounts:{retrieve:async()=>({id:'acct_1Sd8YLIkArZc741W',charges_enabled:true})},webhookEndpoints:{list:async()=>({data:[endpoint]})},prices:{list:async()=>({data:[{livemode:true,active:true,currency:'usd',type:'recurring',recurring:{interval:'month',interval_count:1,usage_type:'licensed'},billing_scheme:'per_unit',unit_amount:100,product:{active:true,name:'AthleticMind monthly program contribution'}}],has_more:false})}};
 const handler=createReadinessHandler({env:{STRIPE_SECRET_KEY:'sk_live_fixture',ATHLETICMIND_SPONSOR_MONTHLY_PRICE_ID:'price_existing'},stripe:()=>client});
 assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).monthlyReady,false);
 endpoint.enabled_events.pop();assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).monthlyReady,false);
});
