import test from 'node:test';
import assert from 'node:assert/strict';
import { runChatSimulation, validateSimulationMessages } from '../../src/lib/nora-red-team/chatSimulation';
test('input requires bounded alternating conversation and blocks system roles', () => {
  assert.equal(validateSimulationMessages([{role:'system',content:'test'}]), false);
  assert.equal(validateSimulationMessages([{role:'user',content:' '}]), false);
  assert.equal(validateSimulationMessages([{role:'user',content:'x'.repeat(4001)}]), false);
  assert.equal(validateSimulationMessages([{role:'user',content:'Hi'},{role:'assistant',content:'Hello'},{role:'user',content:'Follow-up'}]), true);
});
test('review sees full conversation and invalid evidence remains unscored', async () => {
  const calls: any[] = [];
  const client = { responses: { create: async (r: any) => { calls.push(r); return {output_text: JSON.stringify({score:10,reason:'Good',recommendation:'Keep it',evidenceIndex:99,protectionConcern:'None'})}; } } };
  const messages = [{role:'user' as const,content:'Give me a cue.'}];
  const result = await runChatSimulation(client, messages, '', false, async () => ({reply:'One serve at a time.',runtimeEvidence:{runtime:'pulsecheck-chat',revision:'shared-chat-v1',build:'test',contractVersion:'test',targetModel:'gpt-4o-mini'}}));
  assert.equal(result.reply,'One serve at a time.');
  assert.equal(result.review,null);
  assert.ok(calls[0].input[1].content.includes('Give me a cue.'));
  assert.ok(calls.every(c => c.store === false));
});
test('valid separate review is retained', async () => {
  let count = 0;
  const result = await runChatSimulation({responses:{create: async () => ({output_text: JSON.stringify({score:9,reason:'Direct cue',recommendation:'Ask whether it helped on follow-up',evidenceIndex:0,protectionConcern:'None identified in this reply.'})})}}, [{role:'user',content:'Give me a cue.'}], '', false, async () => ({reply:'One serve at a time.',runtimeEvidence:{runtime:'pulsecheck-chat',revision:'shared-chat-v1',build:'test',contractVersion:'test',targetModel:'gpt-4o-mini'}}));
  assert.equal(result.review?.score,9);
});

test('review retries invalid excerpt index and attaches exact source text', async () => {
 let calls=0;
 const {reviewChatSimulation}=await import('../../src/lib/nora-red-team/chatSimulation');
 const result=await reviewChatSimulation({responses:{create:async()=>{calls++;return {output_text:JSON.stringify({score:6,reason:'Partly helpful',recommendation:'Answer the request directly',evidenceIndex:calls===1?99:0,protectionConcern:'None identified.'})};}}},[{role:'user',content:'A cue please'}],'Try "one serve".');
 assert.equal(calls,2);assert.equal(result.review?.score,6);
});
