import assert from 'node:assert/strict';
import test from 'node:test';
import { baselineAccountIdentity, bindBaselineAccountIdentity } from '../../src/lib/questionnaires/account-identity';
import { splitSubmission, validateSubmission, questions } from '../../src/lib/questionnaires/cau';

test('phone account reuses membership name and verified Auth phone without inventing email', () => {
 const identity = baselineAccountIdentity({uid:'athlete',phone_number:'+12025550123'}, {displayName:'Profile',email:'unverified@example.com'}, {athleteOnboarding:{entryOnboardingName:'Signed Full Name'}});
 assert.deepEqual(identity,{name:'Signed Full Name',email:'',phone:'+12025550123'});
 const input=bindBaselineAccountIdentity({name:'Wrong',email:'spoof@example.com',answers:{},submissionId:'test'},identity);
 const split=splitSubmission(input,{verifiedPhone:identity.phone});
 assert.equal(split.pulseCheck.identity.name,'Signed Full Name');
 assert.equal('email' in split.pulseCheck.identity,false);
 assert.equal(split.auntEdna.identity.phone,'+12025550123');
 assert.equal(Object.keys(split.pulseCheck.fields).length+Object.keys(split.auntEdna.fields).length,questions.length);
});
test('authenticated email account keeps account email even before email verification', () => {
 const identity=baselineAccountIdentity({email:'Account@Example.com',email_verified:false},{preferredName:'Athlete'});
 const input=bindBaselineAccountIdentity({email:'spoof@example.com',name:'Wrong',answers:{}},identity);
 assert.equal(validateSubmission(input).identity.email,'account@example.com');
 assert.equal(validateSubmission(input).identity.verification,'self_reported');
});
test('body phone or allowance flags cannot bypass missing account email', () => {
 const identity=baselineAccountIdentity({uid:'athlete'}, {email:'profile@example.com',phone:'+12025550123'});
 const input=bindBaselineAccountIdentity({name:'Athlete',email:'',phone:'+12025550123',verifiedPhone:'+12025550123',answers:{}},identity);
 assert.throws(()=>validateSubmission(input));
 assert.throws(()=>validateSubmission({...input,email:''},{verifiedPhone:'invalid'}));
});

test('legacy accounts without Auth contact retain explicit self-reported contact without becoming verified', () => {
 const identity=baselineAccountIdentity({uid:'athlete'}, {email:'profile@example.com'});
 const input=bindBaselineAccountIdentity({name:'Athlete',email:'contact@example.com',answers:{}},identity);
 assert.equal(validateSubmission(input).identity.email,'contact@example.com');
 assert.equal(validateSubmission(input).identity.verification,'self_reported');
});
