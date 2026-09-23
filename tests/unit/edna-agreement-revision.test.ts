import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAuntEdnaVestingDraft} from '../../src/lib/auntEdnaVestingDraft';
import {reviseEdnaAgreement} from '../../src/lib/ednaAgreementRevision';
test('clean EDNA agreement protects confidentiality and provides defined repurchase mechanics', () => {
 const original=buildAuntEdnaVestingDraft({id:'private-template-id',title:'Valerie Alexander',content:'private'},{id:'side-letter-id',title:'Reciprocal Strategic Equity Side Letter',content:'terms'}).content;
 const clean=reviseEdnaAgreement(original);
 assert.doesNotMatch(clean,/Valerie|private-template-id|Drafting Sources|advisor template|authority to be confirmed|Closing issue requiring|storage does not|AuntEdna|Texas corporation/i);
 assert.match(clean,/EDNA, Inc./);
 assert.match(clean,/original acquisition cost per share actually paid/);
 assert.match(clean,/final binding determination/);
 assert.match(clean,/thirty calendar days/);
 assert.match(clean,/ninety days/);
 assert.match(clean,/including vested shares/);
 assert.match(clean,/concurrently with delivery/);
 assert.match(clean,/over 24 months/);
 assert.match(clean,/fifty percent of the then-unvested award accelerates/);
 assert.match(clean,/Delaware law governs/);
 assert.match(clean,/No blank field is deemed zero/);
});

import {completeEdnaAgreement} from '../../src/lib/ednaAgreementRevision';
test('settled signing-package terms replace stale draft terms without treating a warrant as reciprocal delivery', () => {
 const original=buildAuntEdnaVestingDraft({id:'private-id',title:'Valerie Alexander',content:'private'},{id:'source-id',title:'Reciprocal Strategic Equity Side Letter',content:'source'}).content;
 const text=completeEdnaAgreement(reviseEdnaAgreement(original));
 assert.doesNotMatch(text,/Valerie|private-id|source-id|September 9|24 months|six-month anniversary|\[TO BE|PROPOSED AGREEMENT|Title: _/i);
 assert.match(text,/exactly 200,000 shares of PIL common stock/);
 assert.match(text,/additional to, and does not replace/);
 assert.match(text,/forty-eight months/);
 assert.match(text,/September 11, 2027/);
 assert.match(text,/September 11, 2030/);
 assert.match(text,/No unvested shares are issued at closing/);
 assert.match(text,/null and void and of no force or effect/);
 assert.match(text,/purchase Warrant alone does not satisfy/);
 assert.match(text,/If that fixed count does not represent the required 2.0%/);
 assert.equal((text.match(/Title: Co-Founder\/Co-CEO/g)||[]).length,2);
 assert.match(text,/Absence of that record does not create a zero-cost repurchase right/);
});
