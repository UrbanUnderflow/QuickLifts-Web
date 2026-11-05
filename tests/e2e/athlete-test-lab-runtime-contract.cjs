#!/usr/bin/env node
'use strict';
// Service contract proof, not native UI coverage. All records are isolated emulator fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {seed,cleanup,client}=require('../../scripts/test-lab/emulator-fixtures.cjs');
const origin=process.env.ATHLETE_TEST_LAB_ORIGIN||'http://127.0.0.1:8787';
const parsed=new URL(origin);if(parsed.protocol!=='http:'||!['localhost','127.0.0.1'].includes(parsed.hostname))throw Error('Loopback origin required.');
(async()=>{let manifest;try{
 const out=process.env.ATHLETE_TEST_LAB_OUTPUT||'/tmp/athlete-test-lab-runtime-contract';fs.mkdirSync(out,{recursive:true});
 manifest=await seed({'run-id':'contract-'+Date.now().toString(36),scenario:'existing-member',training:'true',output:path.join(out,'fixture.json')});
 const account=manifest.accounts.athlete,session=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=lab',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...account,returnSecureToken:true})}).then(r=>r.json());assert.equal(session.localId,account.uid);
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+session.idToken};
 const request=async(route,b)=>{const r=await fetch(origin+route,{method:b?'POST':'GET',headers,body:b?JSON.stringify(b):undefined});assert.equal(r.status,200,await r.clone().text());return r.json();};
 const plan=await request('/api/curriculum/plan');assert.equal(plan.enrolled,true);
 const issued=await request('/api/curriculum/runtime',{action:'today'});assert.equal(issued.status,'assignment');assert.equal(issued.assignment.requiresCheckIn,true);
 assert.equal((await request('/api/curriculum/runtime',{action:'start',assignmentId:issued.assignment.id})).status,'blocked');
 await request('/api/pulsecheck/functions/record-morning-checkin',{level:'okay',levelLabel:'Okay',timezone:'UTC',startConversation:false});
 assert.equal((await request('/api/curriculum/runtime',{action:'start',assignmentId:issued.assignment.id})).status,'recorded');
 const completed=await request('/api/curriculum/runtime',{action:'complete',assignmentId:issued.assignment.id});assert.equal(completed.status,'recorded');assert.equal(completed.qualified,true);
 assert.equal((await request('/api/curriculum/runtime',{action:'complete',assignmentId:issued.assignment.id})).duplicate,true);
 const {db}=await client(),records=await db.collection('pulsecheck-linear-curriculum').doc('states').collection('items').doc(account.uid).collection('completions').get();assert.equal(records.size,1);assert.equal(records.docs[0].data().athleteId,account.uid);
 const reopened=await request('/api/curriculum/runtime',{action:'today'});assert.equal(reopened.assignment.completedDayCount,1);assert.equal(reopened.assignment.phaseCompletedToday,true);
 fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify({status:'passed',evidenceMode:'actual-runtime-helpers; synthetic-published-content; auth-firestore-emulators; service-contract-not-ui',uid:account.uid,completion:records.docs[0].data(),reopened:reopened.assignment},null,2));
 await cleanup({manifest:path.join(out,'fixture.json')});manifest=null;console.log(JSON.stringify({status:'passed',receipt:path.join(out,'receipt.json')}));
 }catch(e){console.error(JSON.stringify({status:'failed',reason:e.message,retainedNamespace:manifest?.namespace}));process.exitCode=1;}})();
