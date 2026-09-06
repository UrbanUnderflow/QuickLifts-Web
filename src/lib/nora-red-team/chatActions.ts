export type PracticeAction = {id:string;label:string};
export function practiceActions(reply:string, conversation:string):PracticeAction[]{
 // Never turn breathing/chest complaints or crisis disclosures into an exercise shortcut.
 if(/chest|can't breathe|cannot breathe|holding my breath|suicid|self.harm|assault/i.test(conversation))return [];
 const candidates:[RegExp,string,string][]=[[/breath/i,'breathing-box','Practice breathing'],[/visualiz|imagery/i,'viz-competition-walkthrough','Practice visualization'],[/self.talk|affirmation/i,'confidence-affirmations','Practice self-talk'],[/focus cue|mental cue|anchor word/i,'focus-cue-word','Practice a focus cue']];
 return candidates.filter(([pattern])=>pattern.test(reply)).map(([,id,label])=>({id,label})).slice(0,3);
}
export function offersMealLog(message:string){return /\b(ate|eaten|had for (breakfast|lunch|dinner)|log (my |a |this )?(meal|food|breakfast|lunch|dinner))\b/i.test(message);}
export function mealNameFromMessage(message:string):string {
 const meal = message.match(/\b(?:ate|eaten)\s+(.+?)(?=[.!?]|$)/i)?.[1]
   || message.match(/\bhad\s+(.+?)\s+for\s+(?:breakfast|lunch|dinner)\b/i)?.[1]
   || message.match(/\blog\s+(?:my\s+)?(.+?)(?=[.!?]|$)/i)?.[1];
 if(!meal)return '';
 return meal.replace(/\s+for\s+(?:breakfast|lunch|dinner).*$/i,'').replace(/\s+(?:today|yesterday|this morning|tonight).*$/i,'').replace(/^(?:a|an|some)\s+/i,'').trim().slice(0,500);
}
