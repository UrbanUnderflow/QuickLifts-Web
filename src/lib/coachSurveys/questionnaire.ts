import { cadenceLabel } from './cadence';
export type SurveyKind = 'baseline' | 'check-in';
export type Answer = string | string[];
export type Question = { id: string; text: string; options: { value: string; label: string }[]; multiple?: boolean; max?: number; exclusive?: string; };
export const VERSION = 'coach-experience-review-v2';
export const contentApproved = { baseline: true, 'check-in': true };
export const CADENCE_DAYS = 21;
export const options: { value: string; label: string }[] = [
  { value: '1', label: 'Strongly disagree' }, { value: '2', label: 'Disagree' },
  { value: '3', label: 'Neither' }, { value: '4', label: 'Agree' },
  { value: '5', label: 'Strongly agree' }, { value: 'NO', label: 'Not observed' },
];
export const questions = [
  { id: 'q1', text: 'Athletes appear comfortable using available mental performance and well-being resources.' },
  { id: 'q2', text: 'Athletes use mental performance skills during training or competition.' },
  { id: 'q3', text: 'Athletes communicate when they need support or an adjustment.' },
  { id: 'q4', text: 'Our staff understands the difference between mental performance support and clinical mental-health care.' },
  { id: 'q5', text: 'I know what to do when an athlete may need additional support.' },
  { id: 'q6', text: 'The pathway between Pulse and auntEDNA is clear.' },
  { id: 'q7', text: 'The current support process protects athlete privacy.' },
  { id: 'q8', text: 'Athletes can access support early, before a concern becomes a crisis.' },
  { id: 'q9', text: 'Our team environment allows athletes to ask for help without being viewed as weak.' },
  { id: 'q10', text: 'I can support an athlete without asking for private mental-health or clinical information.' },
];
export const COMMENT = "Without naming an athlete or sharing private information, what is one change that would improve the team's support environment?";
export const isSurveyKind = (value: unknown): value is SurveyKind => value === 'baseline' || value === 'check-in';
// Original source questions remain above for provenance; neither new flow uses
// the Support Environment index. The user approved the new six/two flows.
const choices = (labels: string[]) => labels.map(label => ({ value: label, label }));
export const questionsFor = (kind: SurveyKind, recallDays=21): Question[] => kind === 'baseline' ? [
  { id: 'recognize-support', text: 'How confident are you recognizing when an athlete may need additional support?', options: choices(['Not at all', 'Slightly', 'Moderately', 'Very', 'Extremely']) },
  { id: 'support-pathway', text: 'How clear are you on who to contact and what steps to take when an athlete needs support?', options: choices(['Not at all clear', 'Slightly clear', 'Moderately clear', 'Very clear', 'Extremely clear']) },
  { id: 'conversation-comfort', text: "How comfortable are you starting a supportive conversation with an athlete about how they're doing?", options: choices(['Not at all comfortable', 'Slightly comfortable', 'Moderately comfortable', 'Very comfortable', 'Extremely comfortable']) },
  { id: 'current-process', text: 'How do you currently check in on your athletes beyond their physical performance?', multiple: true, exclusive: 'No consistent process', options: choices(['Individual conversations', 'Team check-ins', 'Surveys or forms', 'Coordination with support staff', 'No consistent process', 'Other']) },
  { id: 'barriers', text: 'What gets in the way of supporting your athletes?', multiple: true, exclusive: 'Nothing currently', options: choices(['Limited time', 'Not knowing when to check in', 'Unsure what to say', 'Unclear referral process', 'Limited support resources', 'Privacy concerns', 'Nothing currently', 'Other']) },
  { id: 'pilot-needs', text: 'What would you most like AthleticMind to help you with during this pilot?', multiple: true, max: 3, options: choices(['Knowing when to check in', 'Having better conversations', 'Bringing mental skills into coaching', 'Connecting athletes with appropriate support', 'Understanding team-level trends', 'Other']) },
] : [
  { id: 'usefulness', text: `In the past ${cadenceLabel(recallDays)}, how useful has AthleticMind been in supporting your work with the team?`, options: choices(['Not at all', 'Slightly', 'Moderately', 'Very', 'Extremely', "Haven’t used it enough to tell"]) },
  { id: 'informed-action', text: `In the past ${cadenceLabel(recallDays)}, did anything from AthleticMind help you decide to check in with an athlete or adjust your approach?`, options: choices(['Yes', 'No', "Haven’t used it"]) },
];
export const commentFor = (_kind: SurveyKind) => 'Additional thoughts or feedback';

export function validateSubmission(kind: SurveyKind, body: unknown) {
  const data = body as Record<string, unknown> | null;
  if (!data || data.version !== VERSION) throw new Error('This questionnaire has changed. Reopen your link to continue.');
  if (Object.keys(data).some(key => !['version', 'answers', 'comment', 'otherText'].includes(key))) throw new Error('Unexpected submission fields.');
  if (!data.answers || typeof data.answers !== 'object' || Array.isArray(data.answers)) throw new Error('Choose a response for every statement.');
  const answers = data.answers as Record<string, unknown>, items = questionsFor(kind);
  if (Object.keys(answers).length !== items.length) throw new Error('Choose a response for every question.');
  for (const q of items) {
    const answer = answers[q.id];
    if (q.multiple) {
      if (!Array.isArray(answer) || !answer.length || new Set(answer).size !== answer.length || answer.length > (q.max || q.options.length) ||
        (q.exclusive && answer.includes(q.exclusive) && answer.length > 1) || answer.some(v => !q.options.some(o => o.value === v))) throw new Error(`Check your choices for: ${q.text}`);
    } else if (typeof answer !== 'string' || !q.options.some(o => o.value === answer)) throw new Error('Choose a response for every question.');
  }
  const otherText: Record<string, string> = {};
  if (data.otherText !== undefined) {
    if (!data.otherText || typeof data.otherText !== 'object' || Array.isArray(data.otherText)) throw new Error('Check your Other text.');
    for (const [id, value] of Object.entries(data.otherText)) {
      const answer = answers[id];
      if (!items.some(q => q.id === id && q.multiple) || !Array.isArray(answer) || !answer.includes('Other') || typeof value !== 'string' || value.length > 300) throw new Error('Check your Other text.');
      otherText[id] = value.trim();
    }
  }
  if (data.comment !== undefined && typeof data.comment !== 'string') throw new Error('Enter a text comment.');
  const comment = ((data.comment as string) || '').trim();
  if (comment.length > 1000) throw new Error('Keep your comment to 1,000 characters.');
  return { version: VERSION, kind, answers: Object.fromEntries(items.map(q => [q.id, answers[q.id] as Answer])), comment, otherText,
    responseCount: items.length, recallDays: kind === 'baseline' ? null : 21 };
}
