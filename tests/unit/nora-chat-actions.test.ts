import test from 'node:test';
import assert from 'node:assert/strict';
import {practiceActions,offersMealLog} from '../../src/lib/nora-red-team/chatActions';
test('practice links use known IDs and suppress shortcuts for chest symptoms',()=>{
 assert.deepEqual(practiceActions('Try visualization.','I want a skill').map(a=>a.id),['viz-competition-walkthrough']);
 assert.deepEqual(practiceActions('Try breathing.','My chest feels tight'),[]);
});
test('meal offer requires an eating or logging statement',()=>{assert.equal(offersMealLog('I ate rice today'),true);assert.equal(offersMealLog('Log my lunch'),true);assert.equal(offersMealLog('I had anxiety'),false);});
test('meal name excludes chat wrapper and logging question',async()=>{
 const {mealNameFromMessage}=await import('../../src/lib/nora-red-team/chatActions');
 assert.equal(mealNameFromMessage('For this fictional test, I ate a chicken and rice bowl for lunch. Can you help me log it?'),'chicken and rice bowl');
 assert.equal(mealNameFromMessage('I ate toast today.'),'toast');
 assert.equal(mealNameFromMessage('Please help'),'');
});
