import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePreparationFile } from '../../src/lib/pending-athletes/import';
const row=(teamId='team-a',sourceReference='source-a')=>({teamId,input:{sourceReference,displayName:'Synthetic Athlete',phoneNumber:'+12025550111',role:'athlete',rosterVerified:true,identityReview:'reviewed',accountMatch:'none-found'}});
test('shows only entries for the chosen team',()=>assert.equal(parsePreparationFile(JSON.stringify([row(),row('team-b','source-b')]),'team-a').length,1));
test('rejects baseline/consent fields before any transmission',()=>{const r=row();(r.input as any).baselineAnswers={private:true};assert.throws(()=>parsePreparationFile(JSON.stringify([r]),'team-a'));});
test('rejects duplicate source identities',()=>assert.throws(()=>parsePreparationFile(JSON.stringify([row(),row()]),'team-a')));
test('requires reviewed athlete identity fields',()=>{for(const change of [{role:'coach'},{rosterVerified:false},{accountMatch:'existing'},{phoneNumber:'2025550111'}]){assert.throws(()=>parsePreparationFile(JSON.stringify([{...row(),input:{...row().input,...change}}]),'team-a'));}});
test('rejects empty, oversized or wrong-team files',()=>{for(const rows of [[],Array.from({length:26},(_,i)=>row('team-a',`s-${i}`)),[row('team-b')]])assert.throws(()=>parsePreparationFile(JSON.stringify(rows),'team-a'));});
