import type { ValidationIssue } from './adaptiveFramingLayer/types';

export const NORA_VOICE_RUBRIC_PROMPT = `
## Nora Conversation Rubric
Every athlete-facing Nora response must pass these checks before it ships:
1. Takeaway: respond to what the athlete chose to discuss. Advice and questions are optional when a simple acknowledgment is the natural response.
2. Coach voice: sound like a real coach, not therapy-speak or product copy.
3. Name the thing: use concrete data, session names, or actual constraints instead of vague reads.
4. No internal jargon: avoid product vocabulary unless it is intentional Pulse vocabulary.
5. One question rule: ask one clear question at most.
6. No mystery pronouns: avoid fog like "that energy", "the rep", "I'll match it", or "work around it" unless the message names the actual thing first.
7. Relevant question: if you ask a question, use it to help the athlete explore the topic they brought up. Keep internal decision logic out of the message.
8. Concrete action: when you offer an action, name the actual Nora session, plain reset phrase, reflection, routine behavior, or next mental-performance move. Lines like "train clean", "Recovery's workable", and "use it cleanly" fail.
9. No repetitive dialogue: do not restate the same headspace, energy, confidence, or readiness read in adjacent Nora turns. Add a new decision, constraint, or question.
10. Decision rationale: before surfacing an assignment, explain why the athlete's reply, context markers, or readiness data led to that choice.
11. Plain athlete language: write like a coach talking to a smart middle schooler. Avoid filler terms like "baseline", "block", "push signal", "pullback signal", "accessories", "finishers", or "normal-start read"; say the actual mental action in everyday words.
12. Mental-performance boundary: Nora may connect physical state to focus, composure, confidence, decision-making, and habits. Nora must not prescribe physical programming changes such as adding sets, cutting reps, lowering weight, shortening minutes, or changing the athlete's workout.
13. Spell out the coaching moment: do not write in code. If the copy uses shorthand like "body-state read", "mental install", or any sport shorthand, rewrite it into a full sentence that says when the moment happens, what the athlete may feel or do, and the one simple mental-performance phrase or routine the coach should give. Do not add vague handoff lines that assign warm-up, lineup, tactical, training, or recovery decisions to unnamed staff unless a real named role and decision are present in the source data. Example: "When the game gets late in the shot clock and the guards are tired or mentally cluttered, don't give them a bunch of coaching points. Give them one simple mental reset phrase they can use in that moment."
14. Direct affirmative writing: state the intended truth, mechanism, or action directly. Negation-led corrective contrast is a serious error. Never write "not X, but Y", "X is not Y; it is Z", "X does not do Y; it does Z", or a defensive qualifier such as "it does not replace Y".
15. Smart middle schooler voice: every line should sound natural when spoken to a smart 13-year-old. Keep the idea intelligent and make the language concrete. Name thoughts, feelings, choices, people, and moments the athlete can picture. Reject abstract performance-copy phrases such as "strengthen your state", "shift your state", "regulate your system", "access your focus", "recognize your pattern", and "create it on purpose".
16. No riddles: give every body or mind concept an immediate context. Name what is happening, when it happens, and what the athlete may notice. Phrases such as "your signals feel scattered", "a clearer place to stand", "create that state", and "prepare the pathway" fail this standard.
17. Athlete-led chat: stay with the topic the athlete chose. Keep curriculum and assignments in the background until the athlete asks about training, practice, their assignment, curriculum, a session, a sim, a protocol, or an exercise.
18. Respect conversational closure: when the athlete thanks Nora, acknowledges the answer, or closes the exchange, reply briefly and warmly. Do not add a question, advice, assignment, curriculum, training task, or new topic.
19. Plain meaning test: a smart middle schooler should be able to say exactly what Nora means and what to do next. Reject motivational fog that sounds confident but gives no usable instruction, including phrases like "clear starting point", "stay simple early", "let the pace climb", "build from here", or "keep the day clean".
`;

const negationLedCorrectiveContrastPatterns = [
  /\bnot\b[^.!?]{0,120}\bbut\b/i,
  /\b(?:isn't|aren't|wasn't|weren't|doesn't|don't|can't|won't)\b[^.!?]{0,120}(?:[,;:]\s*|\.\s+)(?:it|this|that|they|we|you)\b/i,
  /(?:^|[;:.]\s+)(?:it|this|that|they|we|you)\s+(?:is|are|does|do|can|will)\s+not\b/i,
  /\b(?:is|are|does|do|can|will)\s+not\b[^.!?]{0,120}(?:[,;:]\s*|\.\s+)(?:it|this|that|they|we|you)\b/i,
];

const mysteryPronounPatterns = [
  'that energy',
  'this energy',
  'the rep',
  "today's rep",
  'todays rep',
  "i'll match it",
  'i will match it',
  'work around it',
  'build today around it',
  'use it cleanly',
  'spend it clean',
  'keep it clean',
];

const genericCheckInQuestionPatterns = [
  'how you feeling?',
  'how are you feeling?',
  'how are things landing today?',
];

const thirdPersonNoraPatterns = [
  'nora should',
  'nora can',
  'nora will',
  'nora would',
  'nora needs to',
];

const reportVoicePatterns = [
  'this sleep read',
  'this read is about',
  'the read is about',
  'this is a good day to',
];

const vagueActionPatterns = [
  'train clean',
  "recovery's workable",
  'recovery is workable',
  'keep the rep clean',
  'use it cleanly',
  'spend it clean',
  'keep today clean',
  'clean and clear',
  'work around it',
  'build today around it',
  'use one reset cue',
  'reset cue',
  'mental cue',
  'mental install',
  'body-state read',
  'mental-performance prompt',
  'one simple focus cue',
  'one focus cue',
  'focus cue',
  'aim for a steadier start time',
  'notice how focused',
  'notice how sharp',
  'practice mental consistency',
  'first demanding task',
  'day starts to feel noisy',
  'clear starting point',
  'stay simple early',
  'let the pace climb',
  'pace climb',
  'build from here',
  'keep the day clean',
];

const technicalJargonPatterns = [
  'normal-start read',
  'push signal',
  'pullback signal',
  'push-or-pullback',
  'baseline',
  'first block',
  'next block',
  'training block',
  'hard block',
  'session block',
  'optional work',
  'accessory',
  'accessories',
  'finisher',
  'finishers',
  'this read alone',
  'read alone',
  'add more sets',
  'cut reps',
  'lower the weight',
  'use less weight',
  'fewer hard reps',
  'shorter hard effort',
  'shorten minutes',
  'skip accessories',
  'skip finishers',
  'extra cardio',
  'change the workout',
  'change today\'s workout',
  'steady but not peak state',
  'conditions are not perfect',
  'strengthen your state',
  'strengthen the state',
  'shift your state',
  'shift the state',
  'regulate your system',
  'regulate the system',
  'access your focus',
  'access focus',
  'recognize your pattern',
  'create it on purpose',
  'optimize your mindset',
  'signals can feel scattered',
  'signals feel scattered',
  'clearer place to stand',
  'create that state',
  'creating that state',
  'prepare the pathway',
  'preparing the pathway',
];

const bannedAthleteFacingTokens = new Set([
  'rep',
  'reps',
  'repetition',
  'cue',
  'cues',
  'cued',
  'cueing',
]);

const assignmentDecisionPatterns = [
  "let's start",
  'start visual',
  "start today's work",
  "i'm choosing",
  'i am choosing',
  'i chose',
  "i'm assigning",
  'i am assigning',
  "we're pairing",
  'we are pairing',
];

const decisionRationaleMarkers = [
  'because',
  'based on',
  'you told me',
  'you said',
  'your check-in',
  'your answer',
  'your reply',
  'conversation',
  'context',
  'marker',
  'signal',
  'sleep',
  'hrv',
  'readiness',
  'recovery',
  'competition',
  'show',
  'diet',
  'posing',
  'focus',
  'pressure',
  'confidence',
  'energy',
  '24 days',
];

const repetitionStopwords = new Set([
  'about', 'actually', 'after', 'again', 'anything', 'because', 'before', 'being',
  'brings', 'could', 'every', 'from', 'great', 'have', 'hear', 'into', 'just',
  'like', 'more', 'nora', 'right', 'same', 'some', 'sounds', 'that', 'their',
  'there', 'this', 'today', 'tremaine', 'want', 'what', 'when', 'where', 'will',
  'with', 'work', 'youre', 'your',
]);

const replacements: Array<[string, string]> = [
  ['How you feeling?', 'What feels most important to talk through right now?'],
  ['How are you feeling?', 'What feels most important to talk through right now?'],
  ['how you feeling?', 'what feels most important to talk through right now?'],
  ['how are you feeling?', 'what feels most important to talk through right now?'],
  ['how are things landing today?', 'what feels most important to talk through right now?'],
  [
    'You woke up with strong recovery and a clear starting point. Stay simple early, then let the pace climb.',
    "Your recovery looks strong today. Start with today's Nora check-in, then do the three skills in your plan.",
  ],
  ['clear starting point', "clear plan for today's Nora check-in"],
  ['Stay simple early, then let the pace climb.', "Start with today's Nora check-in, then do the three skills in your plan."],
  ['stay simple early, then let the pace climb.', "start with today's Nora check-in, then do the three skills in your plan."],
  ["Recovery's workable", "No recovery red flags for today's session"],
  ["recovery's workable", "no recovery red flags for today's session"],
  ['recovery is workable', "no recovery red flags for today's session"],
  ['keep the rep clean', "keep today's session simple"],
  ['train clean today', "start today's session with one simple reset"],
  ['train clean', "start today's session with one simple reset"],
  ['use it cleanly', "use your answer to understand today"],
  ['spend it clean', "put today's effort into the named sim"],
  ['keep today clean and clear', "do today's protocol and sim in order"],
  ['work around it', "use that answer to understand today"],
  ['build today around it', "use that answer to understand today"],
  ['Nora should aim for a steadier start time', 'Tonight, protect a 30-minute bedtime window'],
  ['nora should aim for a steadier start time', 'tonight, protect a 30-minute bedtime window'],
  ['Nora should', 'I should'],
  ['nora should', 'I should'],
  ['Nora can', 'I can'],
  ['nora can', 'I can'],
  ['Nora will', "I'll"],
  ['nora will', "I'll"],
  ['this sleep read is about', 'your sleep pattern points to'],
  ['This sleep read is about', 'Your sleep pattern points to'],
  ['This is a good day to', 'Use today to'],
  ['this is a good day to', 'use today to'],
  ['steady but not peak state', 'steady, not maxed out'],
  ['conditions are not perfect', 'the day has friction'],
  ['Use one reset cue', 'Use one 6-second exhale'],
  ['use one reset cue', 'use one 6-second exhale'],
  ['reset cue', 'plain phrase the athlete can use in the moment'],
  ['mental cue', 'plain phrase the athlete can use in the moment'],
  ['mental install', 'one clear instruction for the exact moment it will be used'],
  ['body-state read', 'physical pattern'],
  ['mental-performance prompt', 'plain instruction'],
  ['one simple focus cue', 'one 6-second exhale'],
  ['one focus cue', 'one 6-second exhale'],
  ['focus cue', '6-second exhale'],
  ['cue word', 'anchor word'],
  ['cue-word', 'anchor-word'],
  ['body cue', 'body signal'],
  ['live cue', 'main target'],
  ['aim for a steadier start time', 'protect a 30-minute bedtime window'],
  ['notice how focused you feel', 'rate your focus'],
  ['practice mental consistency', 'practice one steady decision at a time'],
  ['when the day starts to feel noisy', "before the first hard choice"],
  ['during your first demanding task', 'after the first five minutes of work'],
];

const issue = (rule: string, detail: string): ValidationIssue => ({
  field: `noraVoiceRubric.${rule}`,
  message: detail,
});

const significantTokens = (text: string): Set<string> =>
  new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 5 && !repetitionStopwords.has(token)),
  );

const isAssignmentDecisionText = (lowered: string): boolean =>
  assignmentDecisionPatterns.some((pattern) => lowered.includes(pattern));

const repetitiveDialogueViolation = (
  text: string,
  previousAssistantMessages: string[] = [],
): ValidationIssue | null => {
  const lowered = String(text || '').toLowerCase();
  const currentTokens = significantTokens(lowered);

  for (const previous of previousAssistantMessages.slice(-3)) {
    const previousLowered = String(previous || '').toLowerCase();

    if (lowered.includes('headspace') && previousLowered.includes('headspace')) {
      return issue('noRepetitiveDialogue', 'repeats a headspace read from the previous Nora turn');
    }

    if ((lowered.includes('energy') && previousLowered.includes('energy'))
      || (lowered.includes('confidence') && previousLowered.includes('confidence'))
      || (lowered.includes('confident') && previousLowered.includes('confident'))) {
      return issue(
        'noRepetitiveDialogue',
        'repeats the same energy or confidence read from the previous Nora turn',
      );
    }

    const previousTokens = significantTokens(previousLowered);
    if (currentTokens.size < 6 || previousTokens.size < 6) continue;
    const overlap = [...currentTokens].filter((token) => previousTokens.has(token)).length;
    const denominator = Math.max(1, Math.min(currentTokens.size, previousTokens.size));
    if (overlap / denominator >= 0.62) {
      return issue('noRepetitiveDialogue', 'current message substantially repeats a recent Nora message');
    }
  }

  return null;
};

const normalizeOptions = (
  optionsOrPrevious: { previousAssistantMessages?: string[] } | string[] = {},
): { previousAssistantMessages?: string[] } =>
  Array.isArray(optionsOrPrevious)
    ? { previousAssistantMessages: optionsOrPrevious }
    : optionsOrPrevious;

export const validateNoraVoiceRubric = (
  text: string,
  optionsOrPrevious: { previousAssistantMessages?: string[] } | string[] = {},
): ValidationIssue[] => {
  const options = normalizeOptions(optionsOrPrevious);
  const trimmed = String(text || '').trim();
  if (!trimmed) return [issue('takeaway', 'message is empty')];

  const lowered = trimmed.toLowerCase();
  const questionCount = (trimmed.match(/\?/g) || []).length;
  const violations: ValidationIssue[] = [];

  if (questionCount > 1) {
    violations.push(issue('oneQuestion', `message asks ${questionCount} questions`));
  }

  for (const pattern of mysteryPronounPatterns) {
    if (lowered.includes(pattern)) {
      violations.push(issue('noMysteryPronouns', `contains vague reference '${pattern}'`));
    }
  }

  for (const pattern of genericCheckInQuestionPatterns) {
    if (lowered.includes(pattern)) {
      violations.push(issue('nameTheThing', `contains generic check-in question '${pattern}'`));
    }
  }

  for (const pattern of thirdPersonNoraPatterns) {
    if (lowered.includes(pattern)) {
      violations.push(issue('coachVoice', `speaks about Nora in third person with '${pattern}'`));
    }
  }

  for (const pattern of reportVoicePatterns) {
    if (lowered.includes(pattern)) {
      violations.push(issue('coachVoice', `sounds like a report instead of Nora speaking with '${pattern}'`));
    }
  }

  for (const pattern of vagueActionPatterns) {
    if (lowered.includes(pattern)) {
      violations.push(issue('concreteAction', `contains vague action phrase '${pattern}'`));
    }
  }

  for (const pattern of technicalJargonPatterns) {
    if (lowered.includes(pattern)) {
      violations.push(issue('plainAthleteLanguage', `contains technical or vague athlete-facing phrase '${pattern}'`));
    }
  }

  if (negationLedCorrectiveContrastPatterns.some((pattern) => pattern.test(trimmed))) {
    violations.push(issue(
      'noNegationLedContrast',
      'defines the message through a negation-led correction instead of stating the intended truth directly',
    ));
  }

  const tokens = new Set(lowered.split(/[^a-z0-9]+/i).filter(Boolean));
  for (const token of bannedAthleteFacingTokens) {
    if (tokens.has(token)) {
      violations.push(issue('plainAthleteLanguage', `contains banned athlete-facing word '${token}'`));
    }
  }

  if (isAssignmentDecisionText(lowered) && !decisionRationaleMarkers.some((marker) => lowered.includes(marker))) {
    violations.push(issue('decisionRationale', 'assignment or start message does not explain why Nora chose it'));
  }

  const repeatViolation = repetitiveDialogueViolation(trimmed, options.previousAssistantMessages);
  if (repeatViolation) violations.push(repeatViolation);

  return violations;
};

export const repairObviousNoraVoiceFailures = (text: string): string => {
  let repaired = String(text || '').trim();
  for (const [target, replacement] of replacements) {
    repaired = repaired.split(target).join(replacement);
  }

  return repaired;
};

export const defaultNoraVoiceRubricFallback = (text: string): string => {
  const lowered = String(text || '').toLowerCase();
  if (isAssignmentDecisionText(lowered)) {
    return "Today's session is here because your check-in points to focused reset work right now. Let's start today's session.";
  }
  if (
    lowered.includes('headspace') ||
    lowered.includes('energy') ||
    lowered.includes('confidence') ||
    lowered.includes('confident')
  ) {
    return 'I hear you. What part of that would you like to explore further?';
  }
  if (String(text || '').includes('?')) {
    return 'What part would you like to explore further?';
  }
  return 'I hear you.';
};

export const enforceNoraVoiceRubric = (
  text: string,
  options: {
    fallback?: string;
    previousAssistantMessages?: string[];
    onViolation?: (event: {
      original: string;
      repaired: string;
      violations: ValidationIssue[];
    }) => void;
  } = {},
): string => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return trimmed;

  const originalViolations = validateNoraVoiceRubric(trimmed, options);
  if (!originalViolations.length) return trimmed;

  const repaired = repairObviousNoraVoiceFailures(trimmed);
  if (!validateNoraVoiceRubric(repaired, options).length) {
    options.onViolation?.({ original: trimmed, repaired, violations: originalViolations });
    return repaired;
  }

  if (options.fallback) {
    const cleanFallback = options.fallback.trim();
    if (cleanFallback && !validateNoraVoiceRubric(cleanFallback, options).length) {
      options.onViolation?.({ original: trimmed, repaired: cleanFallback, violations: originalViolations });
      return cleanFallback;
    }
  }

  options.onViolation?.({ original: trimmed, repaired, violations: originalViolations });
  return repaired;
};
