'use strict';
// Actual isolated seed/readback/cleanup plus the production contact validator.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {seed, cleanup, client} = require('./emulator-fixtures.cjs');
require('tsx/cjs');
const {schoolContactComplete} = require('../../src/api/firebase/pulsecheckProvisioning/schoolActivationFlow.ts');

for (const scenario of ['existing-member','baseline-required','onboarding-required','no-membership']) {
  test(`${scenario} seed preserves the intended school contact and onboarding gate`, async () => {
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'school-contact-fixture-'));
    const manifestPath=path.join(directory,'fixture.json');
    let manifest;
    try {
      manifest=await seed({'run-id':'contact-'+crypto.randomBytes(5).toString('hex'),scenario,output:manifestPath});
      const {auth,db}=await client();
      const uid=manifest.accounts.athlete.uid;
      const account=await auth.getUser(uid);
      const user=(await db.doc('users/'+uid).get()).data();
      const member=(await db.doc('pulsecheck-team-memberships/'+manifest.teamId+'_'+uid).get()).data();
      const completedContact=['existing-member','baseline-required'].includes(scenario);
      assert.equal(schoolContactComplete({institutionalEmail:user.institutionalEmail,phone:user.phoneNumber}),completedContact);
      if(completedContact) {
        assert.equal(user.institutionalEmail,account.email);
        assert.equal(member.institutionalEmail,account.email);
        assert.equal(schoolContactComplete(member),true);
        assert.equal(member.onboardingStatus,'complete');
        assert.equal(member.athleteOnboarding.entryOnboardingStep,'complete');
        assert.equal(member.athleteOnboarding.productConsentAccepted,true);
        assert.equal(member.athleteOnboarding.baselinePathStatus,scenario==='baseline-required'?'pending':'complete');
      } else {
        assert.equal(user.institutionalEmail,undefined);
        if(scenario==='no-membership')assert.equal(member,undefined);
        else {
          assert.equal(member.institutionalEmail,undefined);
          assert.equal(member.onboardingStatus,'pending');
          assert.equal(member.athleteOnboarding.productConsentAccepted,false);
          assert.deepEqual(member.athleteOnboarding.completedConsentIds,[]);
        }
      }
    } finally {
      if(manifest)await cleanup({manifest:manifestPath});
      fs.rmSync(directory,{recursive:true,force:true});
    }
  });
}
