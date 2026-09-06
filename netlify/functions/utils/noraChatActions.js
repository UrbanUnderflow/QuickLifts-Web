// Shared action proposals. Clients render known types; writes still require confirmation.
const PRACTICE = [
  [/breath/i, 'breathing-box', 'breathing', 'Practice breathing'],
  [/visualiz|imagery/i, 'viz-competition-walkthrough', 'visualization', 'Practice visualization'],
  [/self.talk|affirmation/i, 'confidence-affirmations', 'confidence', 'Practice self-talk'],
  [/focus cue|mental cue|anchor word/i, 'focus-cue-word', 'focus', 'Practice a focus cue'],
];
function buildNoraChatActions({message, reply, recentMessages = [], enabled = false, escalationTier = 0}) {
  if (!enabled || escalationTier >= 1) return [];
  const context = [...recentMessages.map(m => m.content || ''), message].join(' ');
  if (/chest|can't breathe|cannot breathe|holding my breath|suicid|self.harm|assault|purge|purging|binge|eating disorder|body image|guilt|poison|allerg|medication|prescription/i.test(context)) return [];
  const actions = PRACTICE.filter(([pattern]) => pattern.test(reply)).map(([, exerciseId, category, label]) => ({id:exerciseId,type:'practice',exerciseId,category,label}));
  if (/\b(?:ate|eaten|had for (?:breakfast|lunch|dinner)|log (?:my |a |this )?(?:meal|food|breakfast|lunch|dinner))\b/i.test(message)) actions.push({id:'log-meal',type:'meal',label:'Log meal'});
  return actions.slice(0,4);
}
module.exports = { buildNoraChatActions };
