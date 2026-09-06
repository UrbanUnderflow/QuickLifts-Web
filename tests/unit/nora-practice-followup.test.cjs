const {test}=require('node:test');const assert=require('node:assert/strict');
const {buildNoraEngagementFallback,evaluateNoraEngagementResponse}=require('../../netlify/functions/utils/noraEngagementPolicy');
const {buildNoraChatActions}=require('../../netlify/functions/utils/noraChatActions');
test('serving practice follow-up remains relevant and offers practice',()=>{
 const athleteMessage='How can I practice that cue right now?';
 const groundingMessages=['I play volleyball as an outside hitter. Give me a focus cue for serving.','For volleyball, try this focus cue: “One serve at a time.” Bring your attention to this serve.'];
 const response=buildNoraEngagementFallback({athleteMessage,groundingMessages});
 const result=evaluateNoraEngagementResponse({athleteMessage,response,groundingMessages:groundingMessages.slice(0,1),previousAssistantMessages:groundingMessages.slice(1)});
 assert.equal(result.passed,true,JSON.stringify(result.failures));assert.match(response,/One serve at a time/);
 assert.ok(buildNoraChatActions({message:athleteMessage,reply:response,enabled:true}).some(a=>a.id==='focus-cue-word'));
});
test('clinical practice requests keep their boundary',()=>{const response=buildNoraEngagementFallback({athleteMessage:'Give me a therapy exercise to practice.'});assert.doesNotMatch(response,/picture the next play/)});

test('repeating the same cue without a practice step still fails',()=>{const response='For volleyball, try this focus cue: “One serve at a time.” Bring your attention to this serve.';const result=evaluateNoraEngagementResponse({athleteMessage:'How can I practice that cue right now?',response,previousAssistantMessages:[response]});assert.ok(result.failures.some(f=>f.id==='no_repetition'));});
