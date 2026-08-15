import type {
  MentalExercise,
  ModuleInteraction,
  ModuleInteractionRound,
  SportContentPack,
  SportScenarioArchetype,
} from './types';
import { getSimSpecByLegacyExerciseId, type SimSpec } from './taxonomy';

type SupportedArchetype = Exclude<SportScenarioArchetype, 'general'>;

type SportContext = {
  archetype: SupportedArchetype;
  label: string;
  event: string;
  beforeEvent: string;
  pressureMoment: string;
  resetMoment: string;
  perform: string;
  skill: string;
  people: string;
};

export const REQUIRED_SPORT_CONTENT_ARCHETYPES: SupportedArchetype[] = [
  'invasion',
  'net_racket',
  'race',
  'judged',
  'stage',
  'precision',
  'combat',
  'attempt',
];

const SPORT_CONTEXTS: Record<SupportedArchetype, SportContext> = {
  invasion: {
    archetype: 'invasion',
    label: 'Field and court team sports',
    event: 'game',
    beforeEvent: 'before warm-ups or while waiting to enter the game',
    pressureMoment: 'when the score is close and the next possession matters',
    resetMoment: 'after a mistake or before the next play',
    perform: 'make the next play',
    skill: 'your reads, movement, and execution',
    people: 'your teammates and opponents',
  },
  net_racket: {
    archetype: 'net_racket',
    label: 'Net and racket sports',
    event: 'match',
    beforeEvent: 'before the match or while getting ready to serve',
    pressureMoment: 'when the point is important and the match feels tight',
    resetMoment: 'between points or after an error',
    perform: 'play the next point',
    skill: 'your serve, return, footwork, and shot choice',
    people: 'your opponent and the officials',
  },
  race: {
    archetype: 'race',
    label: 'Race sports',
    event: 'race',
    beforeEvent: 'during warm-up or while waiting at the start',
    pressureMoment: 'when the pace changes and the race begins to hurt',
    resetMoment: 'after a rough segment or before the next split',
    perform: 'run the next segment',
    skill: 'your start, rhythm, pacing, and finish',
    people: 'the athletes racing beside you',
  },
  judged: {
    archetype: 'judged',
    label: 'Judged routine sports',
    event: 'competition',
    beforeEvent: 'before your routine or while waiting to be called',
    pressureMoment: 'when the judges are watching and one detail feels huge',
    resetMoment: 'after a wobble or before the next element',
    perform: 'complete the next element',
    skill: 'your setup, timing, body position, and finish',
    people: 'the judges and other competitors',
  },
  stage: {
    archetype: 'stage',
    label: 'Stage sports',
    event: 'show',
    beforeEvent: 'backstage before prejudging or while your class is being called',
    pressureMoment: 'during callouts when your placement is still unknown',
    resetMoment: 'between comparisons or before the next pose',
    perform: 'present your best look',
    skill: 'your posture, posing, transitions, and stage presence',
    people: 'the judges and other competitors in your class',
  },
  precision: {
    archetype: 'precision',
    label: 'Precision sports',
    event: 'competition',
    beforeEvent: 'before your turn or while settling into your setup',
    pressureMoment: 'when the target matters and the margin is small',
    resetMoment: 'after a miss or before the next shot',
    perform: 'execute the next shot',
    skill: 'your setup, aim, tempo, and release',
    people: 'the officials and other competitors',
  },
  combat: {
    archetype: 'combat',
    label: 'Combat sports',
    event: 'bout',
    beforeEvent: 'during warm-up or while waiting to enter the competition area',
    pressureMoment: 'when the exchange gets intense and the opening is small',
    resetMoment: 'between exchanges or during the break',
    perform: 'execute the next exchange',
    skill: 'your stance, distance, timing, and combinations',
    people: 'your opponent, corner, and officials',
  },
  attempt: {
    archetype: 'attempt',
    label: 'Attempt sports',
    event: 'competition',
    beforeEvent: 'during warm-up or while waiting for your attempt',
    pressureMoment: 'when one attempt carries real weight',
    resetMoment: 'after an attempt or before the next one',
    perform: 'execute the next attempt',
    skill: 'your setup, timing, technique, and finish',
    people: 'the officials and other competitors',
  },
};

function choice(
  text: string,
  feedback: string,
  isTarget = false,
) {
  return { text, feedback, ...(isTarget ? { isTarget: true } : {}) };
}

function nervesCueOptions(context: SportContext): string[] {
  switch (context.archetype) {
    case 'invasion':
      return ['My heart is beating faster. Next play.', 'I feel nervous. Read and move.', 'One breath. Find the next play.'];
    case 'net_racket':
      return ['My heart is beating faster. Next point.', 'I feel nervous. See and strike.', 'One breath. Play this point.'];
    case 'race':
      return ['My heart is beating faster. Find my rhythm.', 'I feel nervous. Run my pace.', 'One breath. Settle and drive.'];
    case 'judged':
      return ['My heart is beating faster. Trust my routine.', 'I feel nervous. Stand tall and finish.', 'One breath. Start my routine.'];
    case 'stage':
      return ['My heart beats faster. Present my best look.', 'I feel nervous. Stand tall and pose.', 'One breath. Set my pose.'];
    case 'precision':
      return ['My heart is beating faster. Trust my setup.', 'I feel nervous. Aim and release.', 'One breath. Take the shot.'];
    case 'combat':
      return ['My heart is beating faster. See clearly.', 'I feel nervous. Check range and respond.', 'One breath. Take my stance.'];
    case 'attempt':
      return ['My heart is beating faster. Trust my technique.', 'I feel nervous. Set and finish.', 'One breath. Start my attempt.'];
  }
}

function nervesSetAction(context: SportContext): string {
  switch (context.archetype) {
    case 'stage':
      return 'Picture yourself standing tall onstage, opening your chest, setting your pose, and presenting your best look.';
    case 'race':
      return 'Picture yourself standing tall at the start, relaxing your shoulders, and moving into your race rhythm.';
    case 'combat':
      return 'Picture yourself taking your stance, seeing the distance clearly, and responding to the next opening.';
    case 'precision':
      return 'Picture yourself planting your feet, looking at the target, and completing a smooth shot.';
    case 'attempt':
      return 'Picture yourself planting your feet, bracing, and completing the first movement of your attempt.';
    case 'net_racket':
      return 'Picture yourself on the balls of your feet, facing the next point, and seeing the ball clearly.';
    case 'judged':
      return 'Picture yourself moving into your starting position, beginning the routine, and completing the first element.';
    case 'invasion':
      return 'Picture yourself standing ready, looking up, and reading the next play.';
  }
}

function firstPersonPerformance(context: SportContext): string {
  return context.perform.replace(/\byour\b/gi, 'my');
}

function nervesInteraction(context: SportContext): ModuleInteraction {
  return {
    kind: 'nervesRehearsal',
    nervesRehearsal: {
      contentVersion: 5,
      awarenessPrompt: `As you get ready ${context.beforeEvent}, what changes first in your body?`,
      awarenessChoices: [
        'My heart beats faster',
        'My breathing changes',
        'My muscles tighten',
        'My thoughts speed up',
      ],
      awarenessFeedback: 'This is the first sign that you are feeling nervous. Noticing it early gives you time to take one slow breath, picture what you will do, and choose what to tell yourself.',
      meaningPrompt: `${context.pressureMoment.charAt(0).toUpperCase()}${context.pressureMoment.slice(1)}. What should you tell yourself so you stay focused on ${context.skill}?`,
      meaningChoices: [
        choice(
          `"My faster heartbeat and breathing mean my body is getting ready to ${firstPersonPerformance(context)}."`,
          `This answer names the body changes and brings your attention back to ${context.skill}.`,
          true,
        ),
        choice(
          '"I should double-check the whole plan right now."',
          'Checking every part of your plan at once gives you more to think about. Choose the next action you can control.',
        ),
        choice(
          `"I need to know how ready ${context.people} look."`,
          `Watching ${context.people} takes your attention away from ${context.skill}.`,
        ),
      ],
      cuePrompt: 'Choose a short sentence to repeat when your heart beats faster, your breathing changes, your muscles tighten, or your thoughts speed up.',
      cueChoices: nervesCueOptions(context),
      setAction: nervesSetAction(context),
      rehearsalRounds: [
        {
          pressureCue: `You notice that you feel nervous ${context.beforeEvent}.`,
          support: 'visible',
          windowSeconds: 18,
        },
        {
          pressureCue: `${context.pressureMoment.charAt(0).toUpperCase()}${context.pressureMoment.slice(1)}.`,
          support: 'rebuild',
          windowSeconds: 16,
        },
        {
          pressureCue: `You feel nervous again ${context.resetMoment}.`,
          support: 'recall',
          windowSeconds: 14,
        },
      ],
      reflectionPrompt: 'You practiced noticing the first signs of nerves, taking one slow breath, picturing yourself performing, and repeating your phrase.',
      reflectionChoices: [
        'Notice how nerves first show up in my body.',
        'Take one slow breath and picture myself performing.',
        'Repeat my phrase and focus on what I will do next.',
      ],
      closePrompt: 'Each rehearsal helps you remember the response: notice the first body change, take one slow breath, picture yourself performing, and repeat your phrase. Practice it again so the steps become easier to recall when you feel nervous.',
    },
  };
}

function pressureInteraction(context: SportContext): ModuleInteraction {
  return {
    kind: 'choiceDrill',
    rounds: [
      {
        prompt: `${context.pressureMoment.charAt(0).toUpperCase()}${context.pressureMoment.slice(1)}. Pick the useful meaning.`,
        windowSeconds: 15,
        choices: [
          choice(`"This matters to me. I am ready to use ${context.skill}."`, 'Pressure shows that the moment matters. Your preparation gives you something useful to do with it.', true),
          choice('"I cannot make a mistake here."', 'That thought makes the whole moment about avoiding failure. Return to the action you trained.'),
          choice('"Everyone else is more ready than I am."', 'You cannot measure someone else from the outside. Use the preparation you brought with you.'),
        ],
      },
      {
        prompt: `You have a demanding job in this ${context.event}. What does that responsibility mean?`,
        windowSeconds: 15,
        choices: [
          choice('"I earned the chance to handle something important."', 'Responsibility can be evidence of trust and preparation.', true),
          choice('"I was given the hardest job because I am unlucky."', 'That meaning spends energy before the work begins.'),
          choice('"I need everything to go perfectly."', 'Perfect is too large to control. The next clear action is available now.'),
        ],
      },
      {
        prompt: `The pressure rises ${context.resetMoment}. Choose your response.`,
        windowSeconds: 15,
        choices: [
          choice(`"Feel it, breathe once, and ${context.perform}."`, 'You let the feeling exist and kept your action clear.', true),
          choice('"Wait until I feel completely confident."', 'Confidence can grow after you begin. Your cue can lead first.'),
          choice('"Think about the final result until I feel safe."', 'The result lives later. Your skill needs your attention now.'),
        ],
      },
    ],
  };
}

function processInteraction(context: SportContext): ModuleInteraction {
  return {
    kind: 'choiceDrill',
    rounds: [
      {
        prompt: `Sort it: "How ${context.people} respond."`,
        windowSeconds: 12,
        choices: [
          choice('"Outside my control."', 'Correct. Notice it, then bring your attention back to your own work.', true),
          choice('"Fully in my control."', 'You can influence the moment, but you cannot control another person.'),
          choice('"I should keep checking it."', 'Checking other people steals attention from the action you can improve.'),
        ],
      },
      {
        prompt: `Sort it: "${context.skill.charAt(0).toUpperCase()}${context.skill.slice(1)}."`,
        windowSeconds: 12,
        choices: [
          choice('"Inside my control."', 'That is your work. Put your attention where it can change the performance.', true),
          choice('"Outside my control."', 'These are trainable actions. Your attention belongs here.'),
          choice('"Only controllable when I feel confident."', 'A practiced action stays available even when confidence moves around.'),
        ],
      },
      {
        prompt: `${context.pressureMoment.charAt(0).toUpperCase()}${context.pressureMoment.slice(1)}. What gets your next ten seconds?`,
        windowSeconds: 12,
        choices: [
          choice(`"${context.perform.charAt(0).toUpperCase()}${context.perform.slice(1)} with one clear cue."`, 'That is process focus: one useful action, done now.', true),
          choice(`"Predict the final result of the ${context.event}."`, 'Prediction pulls you away from the part you can still shape.'),
          choice('"Measure myself against everyone around me."', 'Comparison divides attention. Your next action needs all of it.'),
        ],
      },
    ],
  };
}

function growthInteraction(context: SportContext): ModuleInteraction {
  return {
    kind: 'choiceDrill',
    rounds: [
      {
        prompt: `The thought: "I am just bad at ${context.skill}." Choose the growth response.`,
        windowSeconds: 15,
        choices: [
          choice(`"These skills are still growing. My next repetition has a job."`, 'You turned a label into a plan for the next repetition.', true),
          choice('"Some athletes are simply born with it."', 'Talent can help, and skilled performance still grows through specific practice.'),
          choice('"I should avoid the part that exposes me."', 'Avoiding the skill keeps it unfamiliar. Useful practice makes it clearer.'),
        ],
      },
      {
        prompt: `Another athlete looks stronger during this ${context.event}. Choose the growth response.`,
        windowSeconds: 15,
        choices: [
          choice('"Their performance can teach me what to study. My work continues."', 'Comparison became information you can use.', true),
          choice('"Their ability proves my ceiling is lower."', 'One moment cannot define how far you can develop.'),
          choice('"I should stop paying attention to my own progress."', 'Your progress becomes clearer when you track your own repetitions and choices.'),
        ],
      },
      {
        prompt: `A part of ${context.skill} breaks down. What comes next?`,
        windowSeconds: 15,
        choices: [
          choice('"Name the exact detail, adjust it, and take another clear repetition."', 'Specific feedback gives the next repetition a purpose.', true),
          choice('"Call the whole performance a failure."', 'A broad label hides the exact detail that can improve.'),
          choice('"Repeat it faster without changing anything."', 'More repetitions help when each one uses the lesson from the last.'),
        ],
      },
    ],
  };
}

function adversityInteraction(context: SportContext): ModuleInteraction {
  const rounds: ModuleInteractionRound[] = [
    {
      prompt: `Something goes wrong ${context.resetMoment}. What is your next move?`,
      windowSeconds: 15,
      choices: [
        choice(`"One slow breath, one clear cue, then ${context.perform}."`, 'You interrupted the reaction and returned to a useful action.', true),
        choice('"Replay the mistake until I understand every detail."', 'Review can happen later. Right now, your attention belongs to the next action.'),
        choice('"Force the next action to make up for it."', 'Forcing adds a second problem. Reset your rhythm before you respond.'),
      ],
    },
    {
      prompt: `${context.people.charAt(0).toUpperCase()}${context.people.slice(1)} react in a way you did not expect. What stays yours?`,
      windowSeconds: 15,
      choices: [
        choice(`"${context.skill.charAt(0).toUpperCase()}${context.skill.slice(1)}."`, 'You returned to the part of the moment you can train and control.', true),
        choice('"Their reaction."', 'You can notice their reaction. You cannot run it for them.'),
        choice('"The final result."', 'The final result is still forming. Your next action is available now.'),
      ],
    },
    {
      prompt: `${context.pressureMoment.charAt(0).toUpperCase()}${context.pressureMoment.slice(1)}. How do you stay present?`,
      windowSeconds: 15,
      choices: [
        choice(`"Shrink the moment to ${context.perform}."`, 'A smaller target gives your attention somewhere clear to land.', true),
        choice('"Think through every possible ending."', 'Too many endings crowd out the action happening now.'),
        choice('"Wait for the pressure to disappear."', 'Pressure can stay in the room while your practiced response leads.'),
      ],
    },
  ];

  return {
    kind: 'choiceDrill',
    pickPrompt: `Pick the three situations from your ${context.event} that feel most real to you.`,
    pickChoices: [
      `A mistake during ${context.skill}`,
      `An unexpected decision from ${context.people}`,
      `Feeling behind during the ${context.event}`,
      'My body feeling more tired than expected',
      'Watching another competitor perform well',
      'A result that feels disappointing',
    ],
    pickCount: 3,
    rounds,
  };
}

function guidedInteraction(
  context: SportContext,
  exerciseId: string,
): ModuleInteraction | undefined {
  if (exerciseId === 'viz-competition-walkthrough') {
    return {
      kind: 'guidedDwell',
      pickPrompt: `Pick three parts of your ${context.event} you want to rehearse clearly.`,
      pickChoices: [
        `Arriving for the ${context.event}`,
        context.beforeEvent,
        `Beginning ${context.skill}`,
        context.pressureMoment,
        context.resetMoment,
        `Finishing the ${context.event} with purpose`,
      ],
      pickCount: 3,
      dwellSeconds: 30,
      dwellPrompt: `Build the scene around you. See the setting, hear the sounds, and feel yourself use ${context.skill}.`,
      closePrompt: `You rehearsed the ${context.event} from the inside. The important cues will feel more familiar when you meet them.`,
    };
  }

  if (exerciseId === 'viz-highlight-reel') {
    return {
      kind: 'guidedDwell',
      pickPrompt: `Pick three moments from your ${context.event} or training when you performed at your best.`,
      pickChoices: [
        `A ${context.event} where I performed at my best`,
        `A moment when ${context.skill} came together`,
        'A time I delivered under pressure',
        'A comeback after a mistake',
        'A training session where everything clicked',
        'A time I stayed steady while others reacted',
      ],
      pickCount: 3,
      dwellSeconds: 25,
      dwellPrompt: 'Put yourself back inside this moment. See it, hear it, and feel the details in your body.',
      closePrompt: 'Those moments are real evidence. Carry that proof into what comes next.',
    };
  }

  if (exerciseId === 'confidence-evidence-journal') {
    return {
      kind: 'guidedDwell',
      pickPrompt: `Bank three pieces of real evidence from your ${context.event} and training.`,
      pickChoices: [
        `A part of ${context.skill} that has improved`,
        'A moment I performed under pressure',
        'Work I completed when nobody was watching',
        'A weakness I have already improved',
        `A moment I was trusted during a ${context.event}`,
        'A goal I set and reached',
      ],
      pickCount: 3,
      dwellSeconds: 20,
      dwellPrompt: 'Picture the exact day and the exact action. Specific details turn a memory into evidence.',
      closePrompt: 'You now have three facts you can return to when confidence feels less steady.',
    };
  }

  if (exerciseId === 'confidence-affirmations') {
    return {
      kind: 'guidedDwell',
      pickPrompt: `Choose three statements that are true when you perform ${context.skill} well.`,
      pickChoices: [
        `I trust ${context.skill}.`,
        `I know how to reset ${context.resetMoment}.`,
        'I have done the work. I am prepared.',
        'Pressure gives my attention a target.',
        'My preparation shows up when it counts.',
        `I can ${context.perform} with purpose.`,
      ],
      pickCount: 3,
      dwellSeconds: 15,
      dwellPrompt: 'Say the statement slowly in your mind three times. Connect every word to work you have actually done.',
      closePrompt: `These statements belong to you. Use them ${context.beforeEvent} or whenever your attention needs a clear direction.`,
    };
  }

  if (exerciseId === 'confidence-inventory') {
    return {
      kind: 'guidedDwell',
      pickPrompt: `Choose the three strengths you bring to every ${context.event}.`,
      pickChoices: [
        'My physical preparation',
        context.skill,
        'My ability to adjust',
        'My composure',
        'My work ethic',
        'My awareness',
        'My consistency',
        'My courage',
      ],
      pickCount: 3,
      dwellSeconds: 20,
      dwellPrompt: `Recall one specific time this strength showed up in training or a ${context.event}. Hold the exact picture.`,
      closePrompt: 'That is your inventory. These strengths came from your work, and you can call on them again.',
    };
  }

  if (exerciseId === 'viz-perfect-execution') {
    return {
      kind: 'lockedReplay',
      setupPrompts: [
        `Choose one part of ${context.skill} to rehearse.`,
        `See the exact starting position you use ${context.beforeEvent}.`,
      ],
      loops: 5,
      loopSeconds: 20,
      loopPrompt: `Run the action in your mind at real speed. When the key detail feels clear, lock it in.`,
      lockCue: 'Lock It In',
      closePrompt: 'Five clear mental repetitions are complete. Take the same cue into your next physical repetition.',
    };
  }

  return undefined;
}

function interactionFor(
  exercise: Pick<MentalExercise, 'id'>,
  context: SportContext,
): ModuleInteraction | undefined {
  switch (exercise.id) {
    case 'mindset-nerves-excitement':
      return nervesInteraction(context);
    case 'mindset-pressure-privilege':
      return pressureInteraction(context);
    case 'mindset-process-focus':
      return processInteraction(context);
    case 'mindset-growth':
      return growthInteraction(context);
    case 'viz-adversity-response':
      return adversityInteraction(context);
    default:
      return guidedInteraction(context, exercise.id);
  }
}

function applicationCueFor(
  exercise: Pick<MentalExercise, 'id' | 'name'>,
  context: SportContext,
): string {
  const simSpec = getSimSpecByLegacyExerciseId(exercise.id);
  if (simSpec) {
    return `${simSportContextFor(simSpec, context)} ${simSpec.resultBoundary}`;
  }

  const cues: Record<string, (sport: SportContext) => string> = {
    'breathing-box': (sport) => `Use this steady rhythm ${sport.beforeEvent} when you want your attention ready for ${sport.skill}.`,
    'breathing-physiological-sigh': (sport) => `Use this quick reset ${sport.resetMoment} when tension builds faster than you expected.`,
    'breathing-478': (sport) => `Use this slower rhythm after training or the night before a ${sport.event} when your body needs help settling.`,
    'breathing-activation': (sport) => `Use this energizing rhythm ${sport.beforeEvent} when your body feels flat and you need to wake up your attention.`,
    'breathing-recovery': (sport) => `Use this after a ${sport.event} or demanding training session to begin your recovery on purpose.`,
    'viz-competition-walkthrough': (sport) => `Rehearse the full ${sport.event}, from ${sport.beforeEvent} through the finish.`,
    'viz-perfect-execution': (sport) => `Mentally repeat one exact part of ${sport.skill} before your next physical repetition.`,
    'viz-highlight-reel': (sport) => `Replay real moments when ${sport.skill} worked under pressure.`,
    'viz-adversity-response': (sport) => `Practice your response to disruptions ${sport.resetMoment} before they happen for real.`,
    'focus-single-point': (sport) => `Build the attention you need to stay with ${sport.skill} one cue at a time.`,
    'focus-cue-word': (sport) => `Choose a short cue that brings you back to ${sport.skill} ${sport.resetMoment}.`,
    'focus-body-scan': (sport) => `Notice which muscles are tight ${sport.beforeEvent}. Relax any muscle that is not needed for your next movement.`,
    'mindset-pressure-privilege': (sport) => `Practice reading pressure as a sign that this ${sport.event} matters to you.`,
    'mindset-nerves-excitement': (sport) => `Practice noticing nerves and bringing your attention back to ${sport.skill}.`,
    'mindset-process-focus': (sport) => `Bring your attention back to ${sport.skill} when the result or other people pull it away.`,
    'mindset-growth': (sport) => `Use hard repetitions of ${sport.skill} as information for what to train next.`,
    'confidence-evidence-journal': (sport) => `Collect specific proof from training and each ${sport.event} that your work is building.`,
    'confidence-power-pose': (sport) => `Use an open, grounded posture ${sport.beforeEvent} to remind your body how you want to enter the moment.`,
    'confidence-affirmations': (sport) => `Build true statements from the work you have done on ${sport.skill}.`,
    'confidence-inventory': (sport) => `Review the preparation you bring to this ${sport.event}, including ${sport.skill}.`,
  };

  return cues[exercise.id]?.(context)
    ?? `Use ${exercise.name} to prepare for ${context.skill} in your ${context.event}.`;
}

function simSportContextFor(spec: SimSpec, context: SportContext): string {
  switch (spec.id) {
    case 'reset':
      return `Use ${context.resetMoment} as a familiar example for the pause-and-return routine.`;
    case 'noise_gate':
      return `Think about moments when ${context.people} or the surroundings compete for your attention during a ${context.event}.`;
    case 'brake_point':
      return `Think about moments when a clear cue tells you to hold before you ${context.perform}.`;
    case 'signal_window':
      return `Think about moments when brief visual information guides how you ${context.perform}.`;
    case 'sequence_shift':
      return `Think about a plan change during a ${context.event} that asks you to use a different rule.`;
    case 'endurance_lock':
      return `Think about staying with one simple cue across the later part of a ${context.event}.`;
    default:
      return `Use a moment from your ${context.event} as familiar context for this task.`;
  }
}

function promptsFor(
  exercise: Pick<MentalExercise, 'id'>,
  context: SportContext,
): string[] | undefined {
  if (exercise.id === 'confidence-power-pose') {
    return [
      `Find enough space to stand comfortably ${context.beforeEvent}.`,
      'Place both feet firmly on the ground.',
      'Stand tall with your chest open and your shoulders relaxed.',
      'Keep your eyes level and take slow, steady breaths.',
      `Picture yourself using ${context.skill} with purpose.`,
      'Hold the posture for two minutes and notice what changes in your attention.',
    ];
  }
  return undefined;
}

export function buildSportContentPacks(
  exercise: Pick<MentalExercise, 'id' | 'name'>,
): SportContentPack[] {
  return REQUIRED_SPORT_CONTENT_ARCHETYPES.map((archetype) => {
    const context = SPORT_CONTEXTS[archetype];
    const prompts = promptsFor(exercise, context);
    const interaction = interactionFor(exercise, context);
    return {
      archetype,
      label: context.label,
      applicationCue: applicationCueFor(exercise, context),
      ...(prompts ? { prompts } : {}),
      ...(interaction ? { interaction } : {}),
    };
  });
}
