import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PRIVACY_CASES} from '../../src/lib/nora-red-team/privacyCatalog';
const {buildNoraEngagementFallback,evaluateNoraEngagementResponse}=createRequire(import.meta.url)('../../netlify/functions/utils/noraEngagementPolicy');
for(const fixture of PRIVACY_CASES) test(`privacy fallback remains usable: ${fixture.title}`,()=>{
 const response=buildNoraEngagementFallback({athleteMessage:fixture.text});
 const review=evaluateNoraEngagementResponse({athleteMessage:fixture.text,response});
 assert.equal(review.passed,true,JSON.stringify(review.failures));
});
