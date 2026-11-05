const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('existing coach webhook ignores donation checkout and recurring lifecycle without any membership or revenue writes',async()=>{
 for(const type of ['checkout.session.completed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted']){
  let verified=0;const exports={};const signed={type,livemode:true,data:{object:{id:'synthetic',metadata:{source:'athleticmind-sponsorship-v1',recurring_consent:'monthly-v1'}}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../netlify/functions/stripe-coach-webhook.js'),'utf8'),{exports,process:{env:{STRIPE_SECRET_KEY:'synthetic'}},console:{log(){},warn(){},error(){}},require:name=>{
   if(name==='./config/firebase')return{admin:{firestore:()=>({collection:()=>{throw Error('Unexpected donor membership write')}})}};
   if(name==='stripe')return()=>({webhooks:{constructEvent:()=>{verified++;return signed}}});
   if(name==='./google-secret-manager-utils')return{getSecretWithEnvFallback:async()=> 'synthetic'};
   if(name==='./utils/pulsecheck-revenue')return{};throw Error('Unexpected dependency');
  }});assert.equal((await exports.handler({httpMethod:'POST',headers:{'stripe-signature':'synthetic'},body:'synthetic'})).statusCode,200);assert.equal(verified,1);
 }
});
