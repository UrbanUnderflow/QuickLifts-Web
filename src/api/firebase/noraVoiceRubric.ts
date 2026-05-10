import type { ValidationIssue } from './adaptiveFramingLayer/types';

export const NORA_VOICE_RUBRIC_PROMPT = `
## Nora Conversation Rubric
Every athlete-facing Nora response must pass these checks before it ships:
1. Takeaway: the athlete should know what to do or answer after reading it.
2. Coach voice: sound like a real coach, not therapy-speak or product copy.
3. Name the thing: use concrete data, session names, or actual constraints instead of vague reads.
4. No internal jargon: avoid product vocabulary unless it is intentional Pulse vocabulary.
5. One question rule: ask one clear question at most.
6. No mystery pronouns: avoid fog like "that energy", "the rep", "I'll match it", or "work around it" unless the message names the actual thing first.
7. Show the trade: if you ask a question, say what you will do with the answer.
8. Concrete action: name the actual Nora session, reset cue, reflection, routine behavior, or next mental-performance move. Lines like "train clean", "Recovery's workable", and "use it cleanly" fail.
9. No repetitive dialogue: do not restate the same headspace, energy, confidence, or readiness read in adjacent Nora turns. Add a new decision, constraint, or question.
10. Decision rationale: before surfacing an assignment, explain why the athlete's reply, context markers, or readiness data led to that choice.
11. Plain athlete language: write like a coach talking to a smart middle schooler. Avoid filler terms like "baseline", "block", "push signal", "pullback signal", "accessories", "finishers", or "normal-start read"; say the actual mental action in everyday words.
12. Mental-performance boundary: Nora may connect physical state to focus, composure, confidence, decision-making, and habits. Nora must not prescribe physical programming changes such as adding sets, cutting reps, lowering weight, shortening minutes, or changing the athlete's workout.
`;

const tradeMarkers = [
  'so i can',
  'so we can',
  "i'll use",
  'i will use',
  'i can use',
  "we'll use",
  'we will use',
  "so i'll",
  'so i will',
  'to set',
  'to choose',
  'to pick',
  'to adjust',
  'to pace',
  'to lower',
  'to raise',
  'to match',
  'to decide',
  'before i pick',
  'before i set',
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
  'one simple focus cue',
  'aim for a steadier start time',
  'notice how focused',
  'notice how sharp',
  'practice mental consistency',
  'first demanding task',
  'day starts to feel noisy',
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
];

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
  ['How you feeling?', "How are you feeling right now so I can set the pace for today's session?"],
  ['How are you feeling?', "How are you feeling right now so I can set the pace for today's session?"],
  ['how you feeling?', "how are you feeling right now so I can set the pace for today's session?"],
  ['how are you feeling?', "how are you feeling right now so I can set the pace for today's session?"],
  ['how are things landing today?', "how are you feeling right now so I can set the pace for today's session?"],
  ["Recovery's workable", "No recovery red flags for today's session"],
  ["recovery's workable", "no recovery red flags for today's session"],
  ['recovery is workable', "no recovery red flags for today's session"],
  ['keep the rep clean', "keep today's session paced"],
  ['train clean today', "start today's session at a controlled pace"],
  ['train clean', "start today's session at a controlled pace"],
  ['use it cleanly', "use your answer to set today's pace"],
  ['spend it clean', "put today's effort into the named sim"],
  ['keep today clean and clear', "keep today's protocol and sim at the normal pace"],
  ['work around it', "use that answer to adjust today's pace"],
  ['build today around it', "use that answer to choose today's first pressure level"],
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
  ['one simple focus cue', 'one 6-second exhale'],
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

  if (questionCount > 0 && !tradeMarkers.some((marker) => lowered.includes(marker))) {
    violations.push(issue('showTheTrade', 'question does not say what Nora will do with the answer'));
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

  const lowered = repaired.toLowerCase();
  if (repaired.includes('?') && !tradeMarkers.some((marker) => lowered.includes(marker))) {
    repaired += " I'll use your answer to set the pace for today's session.";
  }

  return repaired;
};

export const defaultNoraVoiceRubricFallback = (text: string): string => {
  const lowered = String(text || '').toLowerCase();
  if (isAssignmentDecisionText(lowered)) {
    return "I'm choosing today's session because your check-in points to focused reset work right now. Let's start today's session.";
  }
  if (
    lowered.includes('headspace') ||
    lowered.includes('energy') ||
    lowered.includes('confidence') ||
    lowered.includes('confident')
  ) {
    return "I heard the prep signal. Tell me the one part of today's session that needs the most precision so I can set the pace.";
  }
  if (String(text || '').includes('?')) {
    return "How are you feeling right now so I can set the pace for today's session?";
  }
  return "I need to make this concrete: tell me how you feel right now, and I'll set the pace for today's session.";
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
