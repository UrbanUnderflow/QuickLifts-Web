import React, { useEffect, useMemo, useState } from 'react';
import type { NextPage } from 'next';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Gauge,
  GraduationCap,
  HeartPulse,
  Home,
  LineChart,
  LockKeyhole,
  Mail,
  RotateCcw,
  Shield,
  Stethoscope,
  Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PageHead from '../components/PageHead';

type StakeholderId = 'parent' | 'coach' | 'athleticTrainer';

type DomainKey =
  | 'neuroscience'
  | 'mentalPerformance'
  | 'patternRecognition'
  | 'communication'
  | 'roleBoundaries'
  | 'escalation'
  | 'privacyTrust'
  | 'returnSupport'
  | 'documentation'
  | 'biometrics'
  | 'mindBody'
  | 'curriculumSupport';

type AnswerOption = {
  label: string;
  detail: string;
  score: 0 | 1 | 2 | 3 | 4;
};

type AssessmentQuestion = {
  id: string;
  domain: DomainKey;
  critical?: boolean;
  prompt: string;
  scenario: string;
  options: AnswerOption[];
};

type TrainingTrack = {
  title: string;
  format: string;
  price: string;
  outcomes: string[];
  href?: string;
};

type StakeholderAssessment = {
  id: StakeholderId;
  title: string;
  shortTitle: string;
  audience: string;
  icon: LucideIcon;
  accent: string;
  secondary: string;
  price: string;
  trainingPrice: string;
  description: string;
  includes: string[];
  domains: DomainKey[];
  questions: AssessmentQuestion[];
  trainingTracks: TrainingTrack[];
  domainCopy?: Partial<Record<DomainKey, { label?: string; description?: string }>>;
  bands?: ScoreBand[];
  resultsCopy?: {
    reportLabel?: string;
    domainMapTitle?: string;
    trainingLabel?: string;
    trainingTitle?: string;
    trainingIntro?: string;
    safetyHoldTitle?: string;
    safetyHoldBody?: string;
  };
};

type ScoreBand = {
  label: string;
  range: string;
  tone: string;
  accent: string;
  summary: string;
};

type ComputedResult = {
  rawScore: number;
  readinessScore: number;
  band: ScoreBand;
  safetyHold: boolean;
  answered: number;
  total: number;
  domainScores: Array<{
    key: DomainKey;
    label: string;
    description: string;
    score: number;
    icon: LucideIcon;
  }>;
  criticalMisses: AssessmentQuestion[];
  weakestDomains: DomainKey[];
};

const COLORS = {
  lime: '#4F6F59',
  sky: '#456978',
  purple: '#6F6888',
  amber: '#A06F2D',
  rose: '#A85353',
  emerald: '#58735E',
  white: '#F8F7F3',
} as const;

const transition = { duration: 0.48, ease: [0.22, 1, 0.36, 1] as const };

const domainConfig: Record<DomainKey, { label: string; icon: LucideIcon; description: string }> = {
  neuroscience: {
    label: 'Stress neuroscience',
    icon: Brain,
    description: 'Arousal, recovery, attention, sleep, and nervous-system load.',
  },
  mentalPerformance: {
    label: 'Mental performance',
    icon: Target,
    description: 'Focus, confidence, motivation, readiness, pressure, and burnout.',
  },
  patternRecognition: {
    label: 'Pattern recognition',
    icon: LineChart,
    description: 'Repeated decline, withdrawal, eating, sleep, mood, and behavior changes.',
  },
  communication: {
    label: 'Supportive communication',
    icon: HeartPulse,
    description: 'Listening, asking, validating, and avoiding shame or performance pressure.',
  },
  roleBoundaries: {
    label: 'Role boundaries',
    icon: Shield,
    description: 'Knowing what the stakeholder can support and what belongs to licensed care.',
  },
  escalation: {
    label: 'Escalation readiness',
    icon: AlertTriangle,
    description: 'Referral timing, notification order, emergency steps, and safety exceptions.',
  },
  privacyTrust: {
    label: 'Privacy and trust',
    icon: LockKeyhole,
    description: 'Minimum necessary sharing, consent awareness, and disclosure safety.',
  },
  returnSupport: {
    label: 'Return support',
    icon: Gauge,
    description: 'Low-pressure return, monitoring, and avoiding premature performance load.',
  },
  documentation: {
    label: 'Documentation',
    icon: ClipboardCheck,
    description: 'Minimum necessary event records, status, and handoff evidence.',
  },
  biometrics: {
    label: 'Biometrics and readiness',
    icon: Gauge,
    description: 'Reading HRV, sleep, and load as signals of mental and physical readiness.',
  },
  mindBody: {
    label: 'Mind-body integration',
    icon: Activity,
    description: 'How psychology and physiology interact through injury, pain, and return to play.',
  },
  curriculumSupport: {
    label: 'Reinforcing the curriculum',
    icon: BookOpen,
    description: 'Supporting the mental-performance skills an athlete is actively learning.',
  },
};

const scoreBands: ScoreBand[] = [
  {
    label: 'Foundational Gap',
    range: '0-49',
    tone: 'Baseline education needed',
    accent: COLORS.rose,
    summary: 'This stakeholder needs foundational education before being relied on inside an athlete support system.',
  },
  {
    label: 'Developing',
    range: '50-69',
    tone: 'Important gaps remain',
    accent: COLORS.amber,
    summary: 'This stakeholder understands parts of the model but needs training before they can route concern consistently.',
  },
  {
    label: 'Ready',
    range: '70-84',
    tone: 'Role-ready with normal oversight',
    accent: COLORS.sky,
    summary: 'This stakeholder can support athletes within role boundaries and identify when concern should move to the next lane.',
  },
  {
    label: 'Advanced Readiness',
    range: '85-100',
    tone: 'Strong support literacy',
    accent: COLORS.lime,
    summary: 'This stakeholder shows strong literacy across performance stress, boundaries, and escalation readiness.',
  },
];

const assessments: StakeholderAssessment[] = [
  {
    id: 'parent',
    title: 'Supporting Your Child Through Sport: Parent Readiness',
    shortTitle: 'Parent readiness',
    audience: 'Parents and guardians',
    icon: Home,
    accent: COLORS.lime,
    secondary: COLORS.sky,
    price: '$10',
    trainingPrice: '$199',
    description:
      'Find out how ready you are to support your child through the pressure, setbacks, and big emotions that come with competing, without turning home into another place they have to perform.',
    includes: ['11-minute check-in', 'Your readiness report', 'Safety-moment check', 'A personalized next step'],
    domains: [
      'neuroscience',
      'mentalPerformance',
      'patternRecognition',
      'communication',
      'roleBoundaries',
      'escalation',
      'privacyTrust',
      'returnSupport',
    ],
    questions: [
      {
        id: 'parent-neuro-load',
        domain: 'neuroscience',
        prompt: 'Your child looks sharp in practice but falls apart late in a tough tournament weekend. What best explains it?',
        scenario:
          'They say they are trying, but their mood, body language, and decisions change after travel, short sleep, and public criticism.',
        options: [
          { label: 'The results tell the whole story', detail: 'If they are still producing, there is nothing real to worry about.', score: 0 },
          { label: 'They just need to want it more', detail: 'The fix is mostly more effort and motivation when the pressure rises.', score: 1 },
          { label: 'Stress matters a little', detail: 'Stress affects play, but rest and encouragement usually cover it.', score: 2 },
          { label: 'Their state shapes their skill', detail: 'Sleep, nerves, focus, and recovery all change how their ability shows up that day.', score: 3 },
          { label: 'Body, mind, and support all connect', detail: 'How ready they are is a pattern across how they feel, act, recover, and who is supporting them.', score: 4 },
        ],
      },
      {
        id: 'parent-identity',
        domain: 'mentalPerformance',
        prompt: 'After a rough game your child says, "I am embarrassing everyone." What is the most helpful response?',
        scenario:
          'They have not said anything unsafe, but their words tie who they are to how they played.',
        options: [
          { label: 'Go over the mistakes now', detail: 'Use the moment to fix what went wrong before it sticks.', score: 0 },
          { label: 'Tell them they are overreacting', detail: 'Wave the loss off by making the feeling smaller.', score: 1 },
          { label: 'Tell them to rest and move on', detail: 'Give them space, but leave the "I am embarrassing everyone" part unaddressed.', score: 2 },
          { label: 'Separate who they are from the score', detail: 'Hear the feeling, take the pressure down, and come back to it when they are calm.', score: 3 },
          { label: 'Reassure, ease off, and keep watching', detail: 'Protect their sense of self, ease the pressure, and stay alert if the words get darker.', score: 4 },
        ],
      },
      {
        id: 'parent-eating-pattern',
        domain: 'patternRecognition',
        critical: true,
        prompt: 'Your child has skipped dinner after games for two weeks and says food feels pointless after mistakes. What should happen?',
        scenario:
          'Nothing alarming has been said outright, but their eating and mood have shifted the same way for two weeks.',
        options: [
          { label: 'Let it ride and revisit later', detail: 'Treat it as a normal slump and keep things in performance mode.', score: 0 },
          { label: 'Just keep encouraging them', detail: 'Stay supportive, but do not change anything or bring anyone else in.', score: 1 },
          { label: 'Watch for one more sign', detail: 'Keep an eye on it, but hold off involving anyone until it gets clearer.', score: 2 },
          { label: 'Ease the pressure and tell the right person', detail: 'Lighten the load and bring in your support person (trainer, doctor, or counselor).', score: 3 },
          { label: 'Act now and get help', detail: 'Treat two weeks of eating and mood change as a reason to involve a professional, not wait.', score: 4 },
        ],
      },
      {
        id: 'parent-listen',
        domain: 'communication',
        prompt: 'Which first sentence is most likely to keep them talking?',
        scenario: 'Your child gets in the car after practice, silent and clearly tense.',
        options: [
          { label: 'You need to toughen up', detail: 'Treats the struggle as a weakness.', score: 0 },
          { label: 'What did the coach say this time?', detail: 'Jumps to blame before you know what happened.', score: 1 },
          { label: 'Do you want some advice?', detail: 'Can help, but often rushes into fixing.', score: 2 },
          { label: 'I can tell today took a lot out of you', detail: 'Names what you see without forcing them to talk.', score: 3 },
          { label: 'I am just glad you are here, no game talk tonight', detail: 'Takes the pressure off and makes home feel safe.', score: 4 },
        ],
      },
      {
        id: 'parent-boundary',
        domain: 'roleBoundaries',
        prompt: 'Your child asks you not to tell anyone that they feel unable to cope. What is the right way to handle it?',
        scenario:
          'They want privacy, but depending on how serious this is, it may need another person involved.',
        options: [
          { label: 'Handle it all yourself', detail: 'Take it on alone without involving anyone in your support system.', score: 0 },
          { label: 'Give advice from your own life', detail: 'Lean on your own experience as the answer, even if this needs another kind of help.', score: 1 },
          { label: 'Support them and keep watching', detail: 'Stay close, but wait for a clearer sign before involving anyone.', score: 2 },
          { label: 'Stay in your lane and get the right help', detail: 'Support them while bringing the concern to the right person.', score: 3 },
          { label: 'Be honest about the limit and get help', detail: 'Protect their trust, tell them this is bigger than you can carry alone, and involve help without delay.', score: 4 },
        ],
      },
      {
        id: 'parent-safety-language',
        domain: 'escalation',
        critical: true,
        prompt: 'Your child texts, "I do not want to be here anymore," then stops answering. What is the right move?',
        scenario: 'The message is unclear, but it carries safety language and now you cannot reach them.',
        options: [
          { label: 'Give them space until tomorrow', detail: 'Treat a message like this as ordinary stress.', score: 0 },
          { label: 'Send an encouraging text and wait', detail: 'Caring, but it does not match how serious this is.', score: 1 },
          { label: 'Wait for one more sign', detail: 'Holds off acting, when the message and the silence are already the signs.', score: 2 },
          { label: 'Reach them and bring in your support person', detail: 'Make contact and involve your care plan.', score: 3 },
          { label: 'Act now and follow your emergency steps', detail: 'Treat it as an emergency: make contact, do not leave them alone, and get help.', score: 4 },
        ],
      },
      {
        id: 'parent-privacy',
        domain: 'privacyTrust',
        prompt: 'You are asking the school support lead for help. What should you share?',
        scenario:
          'You need to get your child help, but they have not agreed to you repeating every detail of your conversations.',
        options: [
          { label: 'Tell everyone everything', detail: 'Assume that more people knowing more detail keeps them safest.', score: 0 },
          { label: 'Tell whoever has the most pull', detail: 'Share with whoever can make change happen fastest.', score: 1 },
          { label: 'Say nothing until they approve every word', detail: 'Hold off on any help until they sign off on it all, even when safety calls for an exception.', score: 2 },
          { label: 'Share only what is needed', detail: 'Give the smallest useful picture, use their okay where you can, and still act if safety is at risk.', score: 3 },
          { label: 'Protect their trust and follow the rules', detail: 'Share the least needed with the right person, and be clear about their consent or a safety reason.', score: 4 },
        ],
      },
      {
        id: 'parent-return',
        domain: 'returnSupport',
        prompt: 'A professional has cleared your child after a serious concern. What should home focus on first?',
        scenario: 'Your child wants to prove right away that everything is back to normal.',
        options: [
          { label: 'Get back to full pressure fast', detail: 'Show confidence by snapping back to the normal performance routine.', score: 0 },
          { label: 'Keep them away from sport entirely', detail: 'Protect them by blocking all performance demands for the foreseeable future.', score: 1 },
          { label: 'Let them decide on their own', detail: 'Leave it up to them with no real support around it.', score: 2 },
          { label: 'Support a slow, steady return', detail: 'Keep the pressure low and follow the professional or program guidance.', score: 3 },
          { label: 'Match the clearance with low-pressure routines', detail: 'Follow the guidance, watch for patterns, and avoid turning the return into a test.', score: 4 },
        ],
      },
    ],
    trainingTracks: [
      {
        title: 'Parent Foundations: The Athlete Brain Under Pressure',
        format: 'Two live sessions plus a take-home guide',
        price: '$199',
        outcomes: ['Understanding stress and recovery', 'What to say (and what not to)', 'Easing pressure at home'],
        href: '/parent-training?course=parent-foundations',
      },
      {
        title: 'Recognizing the Signs Before a Crisis',
        format: 'Go-at-your-own-pace lessons plus real scenarios',
        price: '$79',
        outcomes: ['Eating and sleep changes', 'Pulling-away signs', 'Knowing when to get help'],
        href: '/parent-training?course=parent-recognizing-the-signs',
      },
    ],
    domainCopy: {
      neuroscience: {
        label: 'How stress affects the body',
        description: 'How pressure, travel, sleep, and nerves change how your child shows up that day.',
      },
      mentalPerformance: {
        label: 'Confidence and pressure',
        description: 'Focus, motivation, and confidence, and handling pressure without burning out.',
      },
      patternRecognition: {
        label: 'Spotting the warning signs',
        description: 'Noticing changes in eating, sleep, mood, and pulling away that repeat over time.',
      },
      communication: {
        label: 'Talking so they open up',
        description: 'Listening and supporting without shame or turning the moment into a performance review.',
      },
      roleBoundaries: {
        label: 'Knowing your role',
        description: 'Knowing what you can support at home and what belongs to a professional.',
      },
      escalation: {
        label: 'Knowing when to get help',
        description: 'When to step in, who to tell first, and what to do in an emergency.',
      },
      privacyTrust: {
        label: 'Trust and privacy',
        description: 'Sharing only what is needed, respecting their privacy, and keeping their trust.',
      },
      returnSupport: {
        label: 'Coming back after a setback',
        description: 'Easing back in after a tough stretch without turning the return into a test.',
      },
    },
    bands: [
      {
        label: 'Getting Started',
        range: '0-49',
        tone: 'A strong place to begin',
        accent: COLORS.rose,
        summary:
          'Caring enough to take this is the foundation. A few core basics about supporting a young athlete are still missing, and those are the most learnable part. Start here and you will move fast.',
      },
      {
        label: 'Building',
        range: '50-69',
        tone: 'You have real instincts',
        accent: COLORS.amber,
        summary:
          'You already understand a lot of this. A bit more on reading the signs and knowing when to get help will make your support steadier in the moments that matter most.',
      },
      {
        label: 'Ready to Support',
        range: '70-84',
        tone: 'Solid and steady',
        accent: COLORS.sky,
        summary:
          'You can support your child through pressure and setbacks, and you know when something needs a professional. A little fine-tuning will sharpen the hardest moments.',
      },
      {
        label: 'Strong Support',
        range: '85-100',
        tone: 'Confident and prepared',
        accent: COLORS.lime,
        summary:
          'You bring real strength across pressure, communication, and knowing when to act. You are the kind of support every young athlete needs in their corner.',
      },
    ],
    resultsCopy: {
      reportLabel: 'Your readiness report',
      domainMapTitle: 'Where you are strongest',
      trainingLabel: 'What to learn next',
      trainingTitle: 'Your next step',
      trainingIntro:
        'These optional courses go deeper on the areas above. Start with whichever feels most useful to you, there is no wrong order.',
      safetyHoldTitle: 'One safety answer needs work',
      safetyHoldBody:
        "On a question about your child's safety, the most protective answer was missed. Until that is shored up we are keeping the result below Ready, because in those moments getting it right matters more than the overall score.",
    },
  },
  {
    id: 'coach',
    title: 'Coaching the Mental Game: Performance Readiness',
    shortTitle: 'Coach readiness',
    audience: 'Head coaches, assistants, and performance staff',
    icon: Target,
    accent: COLORS.sky,
    secondary: COLORS.lime,
    price: '$10',
    trainingPrice: '$399',
    description:
      "Measures how ready you are to deliberately coach the mental game, build mental skills into how you train, and partner with the athlete's mental-performance development, not just run the X's and O's.",
    includes: ['14-minute assessment', 'Team-climate readout', 'Safety-judgment screen', 'Your next coaching step'],
    domains: [
      'neuroscience',
      'biometrics',
      'mentalPerformance',
      'curriculumSupport',
      'communication',
      'patternRecognition',
      'roleBoundaries',
      'escalation',
    ],
    questions: [
      {
        id: 'coach-neuro',
        domain: 'neuroscience',
        prompt: 'An athlete keeps missing reads late in games after a brutal travel stretch. What is the most accurate read on it?',
        scenario: 'They are prepared, but execution drops when fatigue, crowd noise, and stakes pile up.',
        options: [
          { label: 'The scoreboard tells you everything', detail: 'If they are still producing, there is nothing real to manage.', score: 0 },
          { label: 'They just need to lock in', detail: 'The fix is mostly more focus and effort when it gets hard.', score: 1 },
          { label: 'Fatigue matters a little', detail: 'Tiredness affects play, but rest and a pep talk usually handle it.', score: 2 },
          { label: 'Their state changes what they can execute', detail: 'Sleep, fatigue, and pressure change how the skills actually show up.', score: 3 },
          { label: 'Read the whole picture, not just the play', detail: 'Execution is a pattern across fatigue, load, pressure, and how supported they feel.', score: 4 },
        ],
      },
      {
        id: 'coach-biometrics',
        domain: 'biometrics',
        prompt: 'Your readiness dashboard shows several athletes with suppressed recovery and poor sleep after a heavy week, but today is a big scheduled session. What is the best move?',
        scenario: 'The plan says go hard; the data says the group is under-recovered.',
        options: [
          { label: 'Run the session as planned', detail: 'Stick to the schedule no matter what the data says.', score: 0 },
          { label: 'Ignore the data and trust the eye test', detail: 'Dismiss the recovery numbers as unreliable.', score: 1 },
          { label: 'Note it but do not change the plan', detail: 'Acknowledge the trend without adjusting.', score: 2 },
          { label: 'Adjust the session to the readiness signal', detail: 'Modify volume or intensity to match recovery.', score: 3 },
          { label: 'Coach to the data and the room', detail: 'Weigh the readiness data, how they look, and the schedule, then adjust the session and tell them why.', score: 4 },
        ],
      },
      {
        id: 'coach-climate',
        domain: 'mentalPerformance',
        prompt: 'Which coaching behavior most protects performance standards and help-seeking?',
        scenario: 'The team is talented but athletes hide mistakes because they fear losing status.',
        options: [
          { label: 'Praise toughness only', detail: 'Reward athletes who never show strain.', score: 0 },
          { label: 'Keep pressure constant', detail: 'Make every drill feel like selection day.', score: 1 },
          { label: 'Offer open-door support', detail: 'Helpful, but passive if athletes fear using it.', score: 2 },
          { label: 'Correct the behavior, not the person', detail: 'Keep standards high while making it safer to speak up.', score: 3 },
          { label: 'Build both pressure and recovery into the norm', detail: 'Coach the standard, name who to go to for help, and make recovery after stress normal.', score: 4 },
        ],
      },
      {
        id: 'coach-contagion',
        domain: 'mentalPerformance',
        prompt: 'A respected senior is openly spiraling after a benching, and you can feel it spreading through the locker room. What is the best first move?',
        scenario: "One athlete's frustration is starting to set the tone for the whole group.",
        options: [
          { label: 'Make an example of them', detail: 'Call them out publicly so the team knows the standard.', score: 0 },
          { label: 'Ignore it and let it blow over', detail: 'Assume the mood will reset on its own.', score: 1 },
          { label: 'Address the team only', detail: 'Speak to the group but skip the athlete at the center of it.', score: 2 },
          { label: 'Talk to the athlete first, then steady the group', detail: 'Handle the source one-on-one, then reset the team standard.', score: 3 },
          { label: 'Reset the standard and protect the person', detail: 'Support the athlete privately, name the team norm, and keep it from becoming the culture.', score: 4 },
        ],
      },
      {
        id: 'coach-curriculum',
        domain: 'curriculumSupport',
        prompt: 'Your athletes are learning a pre-performance reset routine, breathing and a focus cue, in their mental-performance program. How should practice fit in?',
        scenario: 'You control the environment where they would actually use these skills.',
        options: [
          { label: 'Leave it to the mental team', detail: 'Keep mental skills out of practice entirely.', score: 0 },
          { label: 'Call it a distraction', detail: 'Tell them to skip the routine and just compete.', score: 1 },
          { label: 'Mention it once and move on', detail: 'Acknowledge the routine but never use it.', score: 2 },
          { label: 'Build reps of the routine into practice', detail: 'Create moments where they rehearse the reset under pressure.', score: 3 },
          { label: 'Rehearse it and feed back to the team', detail: 'Build the skill into practice and share what you see with the mental-performance team.', score: 4 },
        ],
      },
      {
        id: 'coach-withdrawal',
        domain: 'patternRecognition',
        prompt: 'A starter is still performing well but has stopped sitting with teammates and avoids film. What do you do first?',
        scenario: 'The output is intact, but the behavior has changed over two weeks.',
        options: [
          { label: 'Leave it alone for now', detail: 'Treat it as a normal stretch and keep things in performance mode.', score: 0 },
          { label: 'Just keep encouraging them', detail: 'Stay supportive, but do not change anything or bring anyone in.', score: 1 },
          { label: 'Watch for one more sign', detail: 'Keep an eye on it, but hold off looping anyone in until it is clearer.', score: 2 },
          { label: 'Ease the demand and loop in the right person', detail: 'Adjust the load and bring in the AT or support staff per your protocol.', score: 3 },
          { label: 'Act on it and follow the protocol', detail: 'Treat two weeks of changed behavior as a signal and move it to your support staff now.', score: 4 },
        ],
      },
      {
        id: 'coach-feedback',
        domain: 'communication',
        prompt: 'Which post-error response best supports mental readiness?',
        scenario: 'A player makes a visible mistake in front of the team.',
        options: [
          { label: 'Make the mistake public', detail: 'Use embarrassment as accountability.', score: 0 },
          { label: 'Bench without explanation', detail: 'Create consequence but no way to learn from it.', score: 1 },
          { label: 'Tell them to forget it', detail: 'Move on quickly without a reset strategy.', score: 2 },
          { label: 'Cue the next action', detail: 'Keep correction specific, short, and task-focused.', score: 3 },
          { label: 'Reset, cue, and return', detail: 'Use a practiced reset and protect the athlete from feeling like the mistake defines them.', score: 4 },
        ],
      },
      {
        id: 'coach-parent',
        domain: 'roleBoundaries',
        prompt: 'A parent corners you after a game, furious about playing time and demanding you change your rotation. What keeps you in your lane?',
        scenario: 'The parent is loud, emotional, and pushing you to make a call on the spot.',
        options: [
          { label: 'Argue your decision right there', detail: 'Defend the rotation in the moment to settle it.', score: 0 },
          { label: 'Promise a change to calm them down', detail: 'Give them what they want so the conflict ends.', score: 1 },
          { label: 'Shut it down and walk away', detail: 'End it fast, but leave the relationship damaged.', score: 2 },
          { label: 'Hold the boundary and set a real time to talk', detail: 'Decline to decide on the spot and move it to a proper meeting.', score: 3 },
          { label: 'Acknowledge, redirect, and keep the focus on the athlete', detail: 'Hear them out, hold the coaching decision, and steer it back to what helps the athlete.', score: 4 },
        ],
      },
      {
        id: 'coach-boundary',
        domain: 'roleBoundaries',
        critical: true,
        prompt: 'An athlete discloses panic, poor sleep, and thoughts that scare them, and asks you to keep it between you two. What is your role?',
        scenario: 'They trust you, but what they described may need more than a coach can carry.',
        options: [
          { label: 'Handle it yourself, quietly', detail: 'Take it on alone to honor their request.', score: 0 },
          { label: 'Coach them through it from experience', detail: 'Lean on your own playing days as the answer.', score: 1 },
          { label: 'Support them and keep watching', detail: 'Stay close, but wait for a clearer sign before involving anyone.', score: 2 },
          { label: 'Stay in your lane and route it', detail: 'Support them while moving it to the AT or support path.', score: 3 },
          { label: 'Name the limit and get the right help', detail: 'Protect the trust, be honest that this is bigger than coaching, and use your protocol without delay.', score: 4 },
        ],
      },
      {
        id: 'coach-emergency',
        domain: 'escalation',
        critical: true,
        prompt: 'An athlete tells you they have a plan to hurt themselves after practice. What is your next move?',
        scenario: 'This has crossed from a support conversation into an emergency.',
        options: [
          { label: 'Finish practice, then check in', detail: 'Treat it as something to handle later.', score: 0 },
          { label: 'Tell them it will pass', detail: 'Reassure them and hope it settles.', score: 1 },
          { label: 'Send them to talk to someone tomorrow', detail: 'Delay it to the next day instead of now.', score: 2 },
          { label: 'Do not leave them alone and call your support staff', detail: 'Stay with them and bring in the AT or clinical contact immediately.', score: 3 },
          { label: 'Activate the emergency protocol now', detail: 'Do not leave them alone, follow your emergency steps, and hand off to the right care immediately.', score: 4 },
        ],
      },
    ],
    trainingTracks: [
      {
        title: 'Coaching the Nervous System',
        format: 'Live workshop plus team language guide',
        price: '$399',
        outcomes: ['Reading pressure and fatigue', 'Task-focused correction', 'Recovery-aware practice design'],
        href: '/coach-training?course=coaching-the-nervous-system',
      },
      {
        title: 'Coaching the Mind in Practice',
        format: 'Scenario-based session',
        price: '$199',
        outcomes: ['Reinforcing mental skills', 'Reading the warning signs', 'When to escalate'],
        href: '/coach-training?course=coaching-the-mind-in-practice',
      },
    ],
    domainCopy: {
      neuroscience: {
        label: 'Coaching the nervous system',
        description: 'Building pressure, arousal, and recovery into how you design practice.',
      },
      biometrics: {
        label: 'Load and readiness',
        description: 'Reading recovery and readiness data to plan smarter sessions.',
      },
      mentalPerformance: {
        label: 'Building mental skills',
        description: 'Confidence, focus, and pressure tolerance coached as trainable skills.',
      },
      curriculumSupport: {
        label: 'Reinforcing the curriculum',
        description: 'Reinforcing the mental skills your athletes are learning, in practice.',
      },
      communication: {
        label: 'Feedback that builds',
        description: 'Correcting and connecting without shame or making it about who they are.',
      },
      patternRecognition: {
        label: 'Reading the warning signs',
        description: 'Spotting changes in behavior, mood, and effort that repeat over time.',
      },
      roleBoundaries: {
        label: 'Staying in your lane',
        description: 'Knowing what a coach supports and what belongs to the AT or clinical staff.',
      },
      escalation: {
        label: 'When to escalate',
        description: 'When to step in, who to notify first, and how to move on an emergency.',
      },
    },
    bands: [
      {
        label: 'Building the Basics',
        range: '0-49',
        tone: 'Start here',
        accent: COLORS.rose,
        summary:
          'You know your sport. This is about coaching the mental game with the same intent, where a few core ideas will change how your athletes handle pressure.',
      },
      {
        label: 'Developing',
        range: '50-69',
        tone: 'Good instincts, room to grow',
        accent: COLORS.amber,
        summary:
          'You already coach a lot of this by feel. Making the mental skills and readiness pieces deliberate will make your program steadier under pressure.',
      },
      {
        label: 'Program-Ready',
        range: '70-84',
        tone: 'Solid and intentional',
        accent: COLORS.sky,
        summary:
          'You coach the mind as well as the body and know when something leaves your lane. Fine-tuning will sharpen the hardest moments.',
      },
      {
        label: 'Culture-Builder',
        range: '85-100',
        tone: 'Strong and prepared',
        accent: COLORS.lime,
        summary:
          'You build an environment where athletes perform, grow mental skills, and still ask for help. This is the standard other programs should learn from.',
      },
    ],
    resultsCopy: {
      reportLabel: 'Your coaching readiness report',
      domainMapTitle: 'Where your coaching is strongest',
      trainingLabel: 'What to train next',
      trainingTitle: 'Your next step',
      trainingIntro:
        'These optional sessions go deeper on coaching the mental game. Start wherever your program needs it most, there is no wrong order.',
      safetyHoldTitle: 'One safety answer needs work',
      safetyHoldBody:
        "On a question about an athlete's safety, the most protective answer was missed. Until that is shored up we are keeping the result below Ready, because in those moments getting it right matters more than the overall score.",
    },
  },
  {
    id: 'athleticTrainer',
    title: 'Performance Neuroscience Readiness for Sports Medicine',
    shortTitle: 'Athletic trainer readiness',
    audience: 'Athletic trainers and sports medicine staff',
    icon: Stethoscope,
    accent: COLORS.purple,
    secondary: COLORS.emerald,
    price: '$10',
    trainingPrice: '$399',
    description:
      'Measures how ready you are to extend your clinical expertise into performance neuroscience and the mental-performance side, supporting an elite athlete who is going through mental-performance training.',
    includes: ['17-minute assessment', 'Performance-readiness readout', 'Safety and scope screen', 'Your next step'],
    domains: [
      'neuroscience',
      'biometrics',
      'mindBody',
      'curriculumSupport',
      'patternRecognition',
      'roleBoundaries',
      'escalation',
      'documentation',
    ],
    questions: [
      {
        id: 'trainer-perf-neuro',
        domain: 'neuroscience',
        prompt: 'An elite athlete is entering a high-pressure stretch. From a performance-neuroscience view, what most determines whether their skills hold up under stress?',
        scenario: 'They are physically prepared; the question is whether their nervous system stays regulated under load.',
        options: [
          { label: 'Raw talent and reps', detail: 'If the skill is trained, stress does not really change the outcome.', score: 0 },
          { label: 'Toughness on the day', detail: 'Performing under pressure is mostly willpower.', score: 1 },
          { label: 'Arousal matters a bit', detail: 'Nerves affect performance, but a warm-up usually settles it.', score: 2 },
          { label: 'Arousal regulation drives access to skill', detail: 'Where their arousal sits changes how well trained skills show up.', score: 3 },
          { label: 'Regulated stress-recovery is the foundation', detail: 'Skill under pressure rests on autonomic balance, recovery, and a regulated nervous system.', score: 4 },
        ],
      },
      {
        id: 'trainer-biometrics',
        domain: 'biometrics',
        prompt: "An athlete's HRV is suppressed for several days and sleep is down, but they feel fine and want a full session. What is the most performance-ready call?",
        scenario: 'The data and the self-report disagree heading into a heavy block.',
        options: [
          { label: 'Trust how they feel and go full', detail: 'Self-report beats the numbers, run the plan.', score: 0 },
          { label: 'Ignore the data as noise', detail: 'Dismiss HRV and sleep as unreliable.', score: 1 },
          { label: 'Note it but change nothing', detail: 'Log the trend without acting on it.', score: 2 },
          { label: 'Adjust load to the readiness signal', detail: 'Modify the session to match the suppressed recovery markers.', score: 3 },
          { label: 'Integrate data, report, and context', detail: 'Weigh HRV, sleep, load, and how they present, then adjust and flag the trend.', score: 4 },
        ],
      },
      {
        id: 'trainer-mindbody',
        domain: 'mindBody',
        prompt: 'An athlete is physically cleared after a long injury but freezes in game-speed drills and avoids the movement that hurt them. What is the right read?',
        scenario: 'The tissue has healed, but performance is being limited by something else.',
        options: [
          { label: 'They are not cleared after all', detail: 'Treat it as an unresolved physical problem only.', score: 0 },
          { label: 'They just need to push through', detail: 'Tell them to stop hesitating and go.', score: 1 },
          { label: 'Give it time, it will fade', detail: 'Wait passively for confidence to return.', score: 2 },
          { label: 'Address fear of reinjury alongside the physical', detail: 'Treat return-to-play confidence as part of the plan.', score: 3 },
          { label: 'Coordinate a graded, confidence-building return', detail: 'Pair graded exposure with the mental-performance team to rebuild trust in the movement.', score: 4 },
        ],
      },
      {
        id: 'trainer-curriculum',
        domain: 'curriculumSupport',
        prompt: 'An athlete is learning a pre-performance breathing and attention routine in their mental-performance program. How should your treatment-room touchpoints fit in?',
        scenario: 'You see them daily, often right before they train or compete.',
        options: [
          { label: 'Stay out of it entirely', detail: 'Leave mental skills completely to the other team.', score: 0 },
          { label: 'Call the routine overthinking', detail: 'Undercut the curriculum with your own take.', score: 1 },
          { label: 'Mention it once and move on', detail: 'Acknowledge it but do not reinforce it.', score: 2 },
          { label: 'Cue and reinforce the routine', detail: 'Prompt the breathing and attention skills during your touchpoints.', score: 3 },
          { label: 'Reinforce and feed back to the team', detail: 'Reinforce the skills consistently and share what you observe with the mental-performance team.', score: 4 },
        ],
      },
      {
        id: 'trainer-triage',
        domain: 'patternRecognition',
        critical: true,
        prompt: 'An athlete shows dropping performance, low mood, poor sleep, and weight loss over two weeks. How do you sort a performance dip from a clinical concern?',
        scenario: 'It could be overtraining, or it could be something that needs clinical care.',
        options: [
          { label: 'Assume it is just a slump', detail: 'Treat it as a performance dip and push through.', score: 0 },
          { label: 'Assume it is overtraining only', detail: 'Deload and expect it to resolve, with no further look.', score: 1 },
          { label: 'Watch one more week', detail: 'Delay sorting it until it is clearer.', score: 2 },
          { label: 'Screen the pattern and route if it crosses clinical', detail: 'Assess the convergence and refer when it points past performance.', score: 3 },
          { label: 'Triage on convergence and escalate per protocol', detail: 'Treat converging mood, sleep, and weight change as clinically relevant and route without waiting.', score: 4 },
        ],
      },
      {
        id: 'trainer-concussion',
        domain: 'patternRecognition',
        prompt: 'Two weeks post-concussion, an athlete reports worsening anxiety, low mood, and irritability that overlap with their symptom profile. What is the right call?',
        scenario: 'Post-concussion symptoms and a possible mood or anxiety concern are hard to separate.',
        options: [
          { label: 'Assume it is all concussion', detail: 'Attribute everything to the injury and wait it out.', score: 0 },
          { label: 'Assume it is unrelated', detail: 'Treat the mood symptoms as separate and ignore the overlap.', score: 1 },
          { label: 'Watch one more week', detail: 'Delay involving anyone until the picture is clearer.', score: 2 },
          { label: 'Flag the overlap and coordinate care', detail: 'Document the change and loop in the physician and behavioral-health lane.', score: 3 },
          { label: 'Manage both in parallel and route', detail: 'Run the concussion protocol and escalate the mental-health concern at the same time, with documentation.', score: 4 },
        ],
      },
      {
        id: 'trainer-scope',
        domain: 'roleBoundaries',
        prompt: 'A coach asks you to just tell the athlete they are mentally fine to compete. What protects both the athlete and your scope?',
        scenario: 'You support performance and recovery, but mental clearance is not yours to give.',
        options: [
          { label: 'Give the reassurance the coach wants', detail: 'Tell the athlete they are fine to satisfy the coach.', score: 0 },
          { label: 'Offer your opinion as clearance', detail: 'Treat your personal read as a clearance decision.', score: 1 },
          { label: 'Dodge it and stay quiet', detail: 'Avoid the question without routing it.', score: 2 },
          { label: 'Stay in scope and route the decision', detail: 'Share what is yours to share and move clearance to the right owner.', score: 3 },
          { label: 'Name the scope and protect the process', detail: 'State that mental clearance sits with the licensed clinician, share minimum necessary, and follow the protocol.', score: 4 },
        ],
      },
      {
        id: 'trainer-crisis',
        domain: 'escalation',
        critical: true,
        prompt: 'During treatment, an athlete discloses current suicidal intent and access to means. What should happen?',
        scenario: 'The disclosure is direct and immediate.',
        options: [
          { label: 'Finish the session, then follow up', detail: 'Treat it as something to address later.', score: 0 },
          { label: 'Reassure and send them home', detail: 'Offer support but take no protective action.', score: 1 },
          { label: 'Schedule a referral for later', detail: 'Route it through normal, non-urgent channels.', score: 2 },
          { label: 'Do not leave them alone and activate the crisis plan', detail: 'Stay with them, contact the clinical or crisis owner, and follow emergency protocol.', score: 3 },
          { label: 'Initiate emergency response and document', detail: 'Do not leave them alone, activate emergency services or EAP per protocol, notify the clinical owner, and document the event.', score: 4 },
        ],
      },
      {
        id: 'trainer-documentation',
        domain: 'documentation',
        critical: true,
        prompt: 'Which record is appropriate for an escalation event?',
        scenario: 'PulseCheck generated a concern signal and the athlete was handed to a clinical route.',
        options: [
          { label: 'Full transcript and all product data', detail: 'Exports too much and may erode trust.', score: 0 },
          { label: 'Only a verbal heads-up', detail: 'Moves fast but leaves no auditable record.', score: 1 },
          { label: 'A broad narrative summary', detail: 'Helpful but may include unrelated sensitive detail.', score: 2 },
          { label: 'Minimum necessary event record', detail: 'Trigger, tier, timestamp, route, consent or safety basis, and status.', score: 3 },
          { label: 'Event record plus status mirror', detail: 'Preserve the handoff trail while keeping clinical notes on the clinical side.', score: 4 },
        ],
      },
    ],
    trainingTracks: [
      {
        title: 'Performance Neuroscience for Sports Medicine',
        format: 'Live applied-neuroscience lab',
        price: '$399',
        outcomes: ['Arousal and recovery regulation', 'Reading readiness data', 'Mind-body return to play'],
        href: '/athletic-trainer-training?course=performance-neuroscience-for-sports-medicine',
      },
      {
        title: 'Reinforcing the Mental-Performance Curriculum',
        format: 'Self-paced module plus scenario lab',
        price: '$149',
        outcomes: ['Supporting daily skills', 'Performance vs. clinical triage', 'Clean team handoffs'],
        href: '/athletic-trainer-training?course=reinforcing-the-mental-performance-curriculum',
      },
    ],
    domainCopy: {
      neuroscience: {
        label: 'Performance neuroscience',
        description: 'Arousal regulation, stress and recovery, and autonomic balance under performance load.',
      },
      biometrics: {
        label: 'Biometrics into readiness',
        description: 'Reading HRV, sleep, and training load as signals of mental readiness, not just physical.',
      },
      mindBody: {
        label: 'Mind-body in injury and return',
        description: 'Fear of reinjury, pain-mood loops, and return-to-play confidence.',
      },
      curriculumSupport: {
        label: 'Reinforcing the curriculum',
        description: 'How your daily touchpoints support the mental skills the athlete is learning.',
      },
      patternRecognition: {
        label: 'Performance vs. clinical triage',
        description: 'Telling a performance-psychology pattern from a clinical concern.',
      },
      roleBoundaries: {
        label: 'Scope and collaboration',
        description: 'Holding scope while partnering with the mental-performance and clinical team.',
      },
      escalation: {
        label: 'Safety and escalation',
        description: 'Recognizing crisis, notification order, and emergency response.',
      },
      documentation: {
        label: 'Documentation and handoff',
        description: 'Minimum necessary records, status, and a clean handoff trail.',
      },
    },
    bands: [
      {
        label: 'Foundational',
        range: '0-49',
        tone: 'Start here',
        accent: COLORS.rose,
        summary:
          'You bring deep clinical expertise. This is about extending it into performance neuroscience and the mental-performance side, where a few core ideas will round out how you support an elite athlete.',
      },
      {
        label: 'Developing',
        range: '50-69',
        tone: 'Strong base, room to extend',
        accent: COLORS.amber,
        summary:
          'Your clinical base is strong. Sharpening how you read readiness data and reinforce the mental-performance curriculum will make you a fuller partner to the athlete.',
      },
      {
        label: 'Practice-Ready',
        range: '70-84',
        tone: 'Solid and integrated',
        accent: COLORS.sky,
        summary:
          'You bridge sports medicine into performance well, hold scope, and route concern correctly. Fine-tuning the neuroscience and curriculum pieces will sharpen the hardest calls.',
      },
      {
        label: 'Advanced',
        range: '85-100',
        tone: 'Strong and prepared',
        accent: COLORS.lime,
        summary:
          'You connect the body and the mind for elite performance, partner cleanly with the mental-performance team, and act decisively on safety. This is the standard for performance-integrated sports medicine.',
      },
    ],
    resultsCopy: {
      reportLabel: 'Your performance-readiness report',
      domainMapTitle: 'Where your readiness is strongest',
      trainingLabel: 'What to learn next',
      trainingTitle: 'Your next step',
      trainingIntro:
        'These optional trainings go deeper on the performance-neuroscience and mental-performance side. Start wherever your practice needs it most.',
      safetyHoldTitle: 'One safety answer needs work',
      safetyHoldBody:
        'On a safety-critical item, the most protective answer was missed. Until that is shored up we are holding the result below Ready, because on acute calls getting it right matters more than the overall score.',
    },
  },
];

const getBand = (score: number, bands: ScoreBand[] = scoreBands): ScoreBand => {
  if (score < 50) return bands[0];
  if (score < 70) return bands[1];
  if (score < 85) return bands[2];
  return bands[3];
};

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const answerLabel = (index: number) => String.fromCharCode(65 + index);

const domainCopyFor = (assessment: StakeholderAssessment, key: DomainKey) => ({
  label: assessment.domainCopy?.[key]?.label ?? domainConfig[key].label,
  description: assessment.domainCopy?.[key]?.description ?? domainConfig[key].description,
  icon: domainConfig[key].icon,
});

const computeResult = (assessment: StakeholderAssessment, answers: Record<string, number>): ComputedResult => {
  const answeredQuestions = assessment.questions.filter((question) => answers[question.id] !== undefined);
  const sum = answeredQuestions.reduce((total, question) => total + question.options[answers[question.id]].score, 0);
  const max = assessment.questions.length * 4;
  const rawScore = Math.round((sum / max) * 100);
  const criticalMisses = assessment.questions.filter((question) => {
    const answerIndex = answers[question.id];
    if (!question.critical || answerIndex === undefined) return false;
    return question.options[answerIndex].score < 3;
  });
  const readinessScore = criticalMisses.length > 0 ? Math.min(rawScore, 69) : rawScore;

  const domainScores = assessment.domains.map((domain) => {
    const domainQuestions = assessment.questions.filter((question) => question.domain === domain);
    const domainSum = domainQuestions.reduce((total, question) => {
      const answerIndex = answers[question.id];
      if (answerIndex === undefined) return total;
      return total + question.options[answerIndex].score;
    }, 0);
    const score = domainQuestions.length ? Math.round((domainSum / (domainQuestions.length * 4)) * 100) : 0;
    const copy = domainCopyFor(assessment, domain);
    return {
      key: domain,
      label: copy.label,
      description: copy.description,
      score,
      icon: copy.icon,
    };
  });

  const weakestDomains = [...domainScores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((domain) => domain.key);

  return {
    rawScore,
    readinessScore,
    band: getBand(readinessScore, assessment.bands),
    safetyHold: criticalMisses.length > 0,
    answered: answeredQuestions.length,
    total: assessment.questions.length,
    domainScores,
    criticalMisses,
    weakestDomains,
  };
};

const PrimaryButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  icon?: LucideIcon;
  accent?: string;
  className?: string;
}> = ({ children, onClick, type = 'button', disabled, icon: Icon = ArrowRight, accent = COLORS.lime, className }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={classNames(
      'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    style={{ backgroundColor: accent, color: '#FAFAF8' }}
  >
    <span>{children}</span>
    <Icon className="h-4 w-4" />
  </button>
);

const GhostButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  icon?: LucideIcon;
  className?: string;
}> = ({ children, onClick, icon: Icon = ArrowLeft, className }) => (
  <button
    type="button"
    onClick={onClick}
    className={classNames(
      'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white/70 px-5 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400',
      className,
    )}
  >
    <Icon className="h-4 w-4" />
    <span>{children}</span>
  </button>
);

const PulseWordmark = () => (
  <a href="/pulseintelligencelabs" className="flex items-center gap-3" aria-label="Pulse Intelligence Labs">
    <img src="/pulse-logo.svg" alt="Pulse" className="h-8 w-auto" />
    <span className="hidden text-sm font-semibold tracking-tight text-stone-900 sm:block">Pulse Intelligence Labs</span>
  </a>
);

const GridBackdrop = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-[#FAFAF7]" />
    <div className="absolute inset-x-0 top-0 h-px bg-stone-200/80" />
  </div>
);

const AssessmentCard: React.FC<{
  assessment: StakeholderAssessment;
  active: boolean;
  onSelect: () => void;
  onStart: () => void;
}> = ({ assessment, active, onSelect, onStart }) => {
  const Icon = assessment.icon;
  const featuredDomains = assessment.domains.slice(0, 5);

  return (
    <motion.article
      onMouseEnter={onSelect}
      layout
      className={classNames(
        'relative overflow-hidden rounded-lg border bg-white p-6 text-left transition sm:p-8',
        active
          ? 'border-stone-300 shadow-[0_18px_55px_rgba(68,64,60,0.09)]'
          : 'border-stone-200 hover:border-stone-300',
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${assessment.accent}, ${assessment.secondary})`,
        }}
      />
      <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: `${assessment.accent}55`, backgroundColor: `${assessment.accent}18` }}
            >
              <Icon className="h-6 w-6" style={{ color: assessment.accent }} />
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-right">
              <div className="text-sm font-semibold text-stone-900">{assessment.price}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Assessment</div>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">{assessment.audience}</p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight text-stone-900 sm:text-4xl">{assessment.title}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-500">{assessment.description}</p>
          </div>

          <button
            type="button"
            onClick={onStart}
            className="mt-7 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{ backgroundColor: assessment.accent, color: '#FAFAF8' }}
          >
            <span>Start {assessment.shortTitle}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Included report outputs</p>
            <div className="mt-4 grid gap-3">
              {assessment.includes.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm font-medium text-stone-600">
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: assessment.accent }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Measured domains</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {featuredDomains.map((domain) => (
                <span
                  key={domain}
                  className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-700"
                >
                  {domainConfig[domain].label}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-stone-200 pt-5 sm:col-span-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <div className="text-2xl font-semibold text-stone-900">{assessment.questions.length}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Scenarios</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-stone-900">{assessment.trainingPrice}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Training</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-stone-900">0-100</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Readiness score</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

const HubView: React.FC<{
  selected: StakeholderAssessment;
  onSelect: (id: StakeholderId) => void;
  onStart: (id: StakeholderId) => void;
}> = ({ selected, onSelect, onStart }) => {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 pt-24 sm:px-8">
      <motion.header
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
        className="border-b border-stone-200 pb-12 pt-10"
      >
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-600">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Mental performance readiness
          </div>
          <h1 className="mt-7 max-w-3xl text-4xl font-bold leading-[1.02] tracking-tight text-stone-900 sm:text-6xl">
            Every athlete is shaped by the people around them.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-500">
            Mental-performance readiness checks for the parents, coaches, and athletic trainers who support elite athletes. Each one shows you where you are strong, flags the safety moments that matter most, and points you to what to learn next.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Readiness score', value: '0-100', icon: Gauge },
            { label: 'Scenario judgment', value: 'Role-based', icon: Target },
            { label: 'Training', value: 'Separate cost', icon: GraduationCap },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border border-stone-200 bg-white/75 p-4">
                <Icon className="h-5 w-5 text-stone-500" />
                <div className="mt-3 text-xl font-semibold text-stone-900">{item.value}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">{item.label}</div>
              </div>
            );
          })}
        </div>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: 0.08 }}
        className="pt-12"
      >
        <div className="mb-7 max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Assessment suite</p>
          <h2 className="mt-2 text-3xl font-semibold text-stone-900">A readiness check for the people who support the athlete</h2>
          <p className="mt-3 text-base leading-7 text-stone-500">
            Each one walks you through real situations you may experience as a parent, a coach, or an athletic trainer supporting your athlete's mental performance.
          </p>
        </div>

        <div className="grid gap-7">
          {assessments.map((assessment) => (
            <AssessmentCard
              key={assessment.id}
              assessment={assessment}
              active={selected.id === assessment.id}
              onSelect={() => onSelect(assessment.id)}
              onStart={() => onStart(assessment.id)}
            />
          ))}
        </div>

        <div className="mt-7 rounded-lg border border-stone-200 bg-white/80 p-4 text-sm leading-6 text-stone-500">
          <span className="font-semibold text-stone-900">Boundary:</span> this score measures education and referral readiness. It is not clinical licensure, diagnosis authority, or clearance authority.
        </div>
      </motion.div>
    </section>
  );
};

const ProgressRail: React.FC<{
  assessment: StakeholderAssessment;
  currentIndex: number;
  answers: Record<string, number>;
}> = ({ assessment, currentIndex, answers }) => {
  const progress = Math.round(((currentIndex + 1) / assessment.questions.length) * 100);

  return (
    <div className="fixed left-0 right-0 top-[61px] z-40 border-b border-stone-200/80 bg-[#FAFAF7]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3 sm:px-8">
        <div className="hidden min-w-[190px] text-xs font-semibold uppercase tracking-[0.15em] text-stone-500 sm:block">
          {assessment.shortTitle}
        </div>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
          <motion.div
            className="h-full rounded-full"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={transition}
            style={{ background: `linear-gradient(90deg, ${assessment.accent}, ${assessment.secondary})` }}
          />
        </div>
        <div className="w-[78px] text-right text-xs font-semibold text-stone-900">
          {Object.keys(answers).length}/{assessment.questions.length}
        </div>
      </div>
    </div>
  );
};

const QuestionView: React.FC<{
  assessment: StakeholderAssessment;
  currentIndex: number;
  answers: Record<string, number>;
  onAnswer: (questionId: string, answerIndex: number) => void;
  onPrevious: () => void;
  onExit: () => void;
}> = ({ assessment, currentIndex, answers, onAnswer, onPrevious, onExit }) => {
  const question = assessment.questions[currentIndex];
  const selectedIndex = answers[question.id];
  const DomainIcon = domainConfig[question.domain].icon;
  const progressLabel = `${currentIndex + 1}`.padStart(2, '0');

  return (
    <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 pb-10 pt-36 sm:px-8">
      <div className="grid w-full items-start gap-8 lg:grid-cols-[0.75fr_1.25fr]">
        <motion.aside
          key={`${assessment.id}-aside-${currentIndex}`}
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={transition}
          className="lg:sticky lg:top-36"
        >
          <button
            type="button"
            onClick={onExit}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-stone-500 transition hover:text-stone-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Assessment suite
          </button>

          <div className="rounded-lg border border-stone-200 bg-white/85 p-6">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl border"
                style={{ borderColor: `${assessment.accent}55`, backgroundColor: `${assessment.accent}18` }}
              >
                <DomainIcon className="h-6 w-6" style={{ color: assessment.accent }} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Domain</p>
                <h2 className="text-lg font-semibold text-stone-900">{domainCopyFor(assessment, question.domain).label}</h2>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-stone-500">{domainCopyFor(assessment, question.domain).description}</p>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-stone-200 bg-white/80 p-4">
                <div className="text-3xl font-semibold text-stone-900">{progressLabel}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Scenario</div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white/80 p-4">
                <div className="text-3xl font-semibold text-stone-900">{question.critical ? 'Yes' : 'No'}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Safety item</div>
              </div>
            </div>
          </div>
        </motion.aside>

        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, y: 34, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.98 }}
            transition={transition}
            className="rounded-lg border border-stone-200 bg-white p-5 shadow-[0_18px_55px_rgba(68,64,60,0.09)] sm:p-8 lg:p-10"
          >
            <div className="mb-7 flex flex-wrap items-center gap-3">
              <div
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em]"
                style={{ borderColor: `${assessment.accent}45`, backgroundColor: `${assessment.accent}12`, color: assessment.accent }}
              >
                <Activity className="h-3.5 w-3.5" />
                {assessment.audience}
              </div>
              {question.critical && (
                <div className="inline-flex items-center gap-2 rounded-lg border border-[#A85353]/25 bg-[#A85353]/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#A85353]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Safety minimum
                </div>
              )}
            </div>

            <p className="text-sm font-semibold leading-6 text-stone-500">{question.scenario}</p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-stone-900 sm:text-4xl">{question.prompt}</h1>

            <div className="mt-8 grid gap-3">
              {question.options.map((option, index) => {
                const isSelected = selectedIndex === index;
                return (
                  <motion.button
                    key={option.label}
                    type="button"
                    data-question-id={question.id}
                    data-option-index={index}
                    onClick={() => onAnswer(question.id, index)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    className={classNames(
                      'group grid min-h-[64px] grid-cols-[42px_1fr_auto] items-center gap-4 rounded-lg border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-stone-400 sm:p-5',
                      isSelected
                        ? 'border-stone-400 bg-white text-stone-900'
                        : 'border-stone-200 bg-white/75 text-stone-900 hover:border-stone-300 hover:bg-white',
                    )}
                  >
                    <span
                      className={classNames(
                        'flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold',
                        isSelected ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500',
                      )}
                    >
                      {answerLabel(index)}
                    </span>
                    <span>
                      <span className="block text-base font-semibold leading-snug">{option.label}</span>
                    </span>
                    <CheckCircle2
                      className={classNames('h-5 w-5 transition', isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-40')}
                      style={{ color: isSelected ? '#090A0C' : assessment.accent }}
                    />
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <GhostButton onClick={onPrevious} className={currentIndex === 0 ? 'invisible' : ''}>
                Previous
              </GhostButton>
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-stone-500">
                {currentIndex + 1} of {assessment.questions.length}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

const DomainScoreRow: React.FC<{
  domain: ComputedResult['domainScores'][number];
  accent: string;
}> = ({ domain, accent }) => {
  const Icon = domain.icon;

  return (
    <div className="rounded-lg border border-stone-200 bg-white/85 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100">
            <Icon className="h-5 w-5" style={{ color: accent }} />
          </div>
          <div>
            <div className="text-sm font-semibold text-stone-900">{domain.label}</div>
            <div className="mt-1 text-xs text-stone-500">{domain.description}</div>
          </div>
        </div>
        <div className="text-xl font-semibold text-stone-900">{domain.score}</div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-200">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${domain.score}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${accent}, ${COLORS.white})` }}
        />
      </div>
    </div>
  );
};

const AnswerReviewCard: React.FC<{
  question: AssessmentQuestion;
  selectedIndex: number | undefined;
  accent: string;
  index: number;
}> = ({ question, selectedIndex, accent, index }) => {
  const bestIndex = question.options.reduce(
    (best, option, i) => (option.score > question.options[best].score ? i : best),
    0,
  );

  const nailedIt = selectedIndex === bestIndex;

  return (
    <details
      open={!nailedIt}
      className="group rounded-lg border border-stone-200 bg-white/85 p-5 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">
            <span>Scenario {String(index + 1).padStart(2, '0')}</span>
            {question.critical && <span className="text-[#A85353]">Safety item</span>}
            <span style={{ color: nailedIt ? accent : COLORS.amber }}>{nailedIt ? 'Nailed it' : 'Review this'}</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold leading-snug text-stone-900">{question.prompt}</h3>
        </div>
        <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4 grid gap-2">
        {question.options.map((option, i) => {
          const isBest = i === bestIndex;
          const isPicked = i === selectedIndex;
          return (
            <div
              key={option.label}
              className={classNames('rounded-lg border p-3', isBest ? 'bg-white' : 'border-stone-200 bg-white/70')}
              style={isBest ? { borderColor: accent, borderWidth: 2 } : undefined}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-stone-900">
                  {answerLabel(i)}. {option.label}
                </span>
                <span className="flex flex-wrap gap-1">
                  {isBest && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white"
                      style={{ backgroundColor: accent }}
                    >
                      Best answer
                    </span>
                  )}
                  {isPicked && (
                    <span
                      className={classNames(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]',
                        isBest ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-700',
                      )}
                    >
                      Your answer
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-stone-500">{option.detail}</p>
            </div>
          );
        })}
      </div>
    </details>
  );
};

const ResultsView: React.FC<{
  assessment: StakeholderAssessment;
  answers: Record<string, number>;
  onRestart: () => void;
  onExit: () => void;
}> = ({ assessment, answers, onRestart, onExit }) => {
  const result = useMemo(() => computeResult(assessment, answers), [assessment, answers]);
  const Icon = assessment.icon;
  const scoreGradient = `conic-gradient(${result.band.accent} ${result.readinessScore * 3.6}deg, rgba(255,255,255,0.08) 0deg)`;
  const weakestLabels = result.weakestDomains.map((domain) => domainCopyFor(assessment, domain).label);

  return (
    <section className="relative z-10 mx-auto min-h-screen w-full max-w-6xl px-6 pb-12 pt-28 sm:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
          <div className="rounded-lg border border-stone-200 bg-white/85 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">{assessment.resultsCopy?.reportLabel ?? 'Readiness report'}</p>
                <h1 className="mt-2 text-3xl font-semibold text-stone-900 sm:text-4xl">{assessment.title}</h1>
              </div>
              <div
                className="flex h-14 w-14 items-center justify-center rounded-lg border"
                style={{ borderColor: `${assessment.accent}55`, backgroundColor: `${assessment.accent}18` }}
              >
                <Icon className="h-7 w-7" style={{ color: assessment.accent }} />
              </div>
            </div>

            <div className="mt-8 grid items-center gap-8 md:grid-cols-[220px_1fr]">
              <div className="relative mx-auto flex h-[220px] w-[220px] items-center justify-center rounded-full" style={{ background: scoreGradient }}>
                <div className="flex h-[168px] w-[168px] flex-col items-center justify-center rounded-full border border-stone-200 bg-white">
                  <div className="text-6xl font-semibold text-stone-900">{result.readinessScore}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Readiness</div>
                </div>
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-stone-500">
                  <Gauge className="h-4 w-4" style={{ color: result.band.accent }} />
                  {result.band.range}
                </div>
                <h2 className="mt-4 text-3xl font-semibold text-stone-900">{result.band.label}</h2>
                <p className="mt-2 text-sm font-semibold text-stone-600">{result.band.tone}</p>
                <p className="mt-4 text-base leading-7 text-stone-500">{result.band.summary}</p>

                {result.safetyHold && (
                  <div className="mt-5 rounded-lg border border-[#A85353]/30 bg-[#A85353]/10 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-[#A85353]" />
                      <div>
                        <div className="font-semibold text-stone-900">{assessment.resultsCopy?.safetyHoldTitle ?? 'Safety minimum applied'}</div>
                        <p className="mt-1 text-sm leading-6 text-stone-600">
                          {assessment.resultsCopy?.safetyHoldBody ?? 'One or more safety-critical items fell below the readiness threshold, so the result is held below Ready until training is completed.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-stone-200 bg-white/80 p-4">
                <div className="text-2xl font-semibold text-stone-900">{result.rawScore}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Raw score</div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white/80 p-4">
                <div className="text-2xl font-semibold text-stone-900">{result.criticalMisses.length}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Safety gaps</div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white/80 p-4">
                <div className="text-2xl font-semibold text-stone-900">{result.answered}/{result.total}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Completed</div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <PrimaryButton onClick={onRestart} icon={RotateCcw} accent={assessment.accent}>
              Retake assessment
            </PrimaryButton>
            <GhostButton onClick={onExit} icon={ArrowLeft}>
              Assessment suite
            </GhostButton>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: 0.08 }} className="grid gap-5">
          <div className="rounded-lg border border-stone-200 bg-white/85 p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Domain map</p>
                <h2 className="mt-1 text-2xl font-semibold text-stone-900">{assessment.resultsCopy?.domainMapTitle ?? 'Where readiness is strongest'}</h2>
              </div>
              <LineChart className="h-6 w-6" style={{ color: assessment.accent }} />
            </div>
            <div className="grid gap-3">
              {result.domainScores.map((domain) => (
                <DomainScoreRow key={domain.key} domain={domain} accent={assessment.accent} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white/85 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">{assessment.resultsCopy?.trainingLabel ?? 'Training recommendation'}</p>
                <h2 className="mt-1 text-2xl font-semibold text-stone-900">{assessment.resultsCopy?.trainingTitle ?? 'Next paid education path'}</h2>
              </div>
              <GraduationCap className="h-6 w-6" style={{ color: assessment.secondary }} />
            </div>

            {assessment.resultsCopy?.trainingIntro && (
              <p className="mt-3 text-sm leading-6 text-stone-500">{assessment.resultsCopy.trainingIntro}</p>
            )}

            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: `${assessment.secondary}33`, backgroundColor: `${assessment.secondary}0d`, color: '#57534e' }}>
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: assessment.secondary }} />
              <span>The $10 you paid for this assessment is credited toward any training below.</span>
            </div>

            <div className="mt-5 rounded-lg border border-stone-200 bg-white/80 p-4">
              <div className="text-sm font-semibold text-stone-500">Priority domains</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {weakestLabels.map((label) => (
                  <span key={label} className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-800">
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {assessment.trainingTracks.map((track) => (
                <div key={track.title} className="rounded-lg border border-stone-200 bg-white/80 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-stone-900">{track.title}</h3>
                      <p className="mt-1 text-sm text-stone-500">{track.format}</p>
                    </div>
                    <div className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: assessment.secondary, color: '#FAFAF8' }}>
                      {track.price}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {track.outcomes.map((outcome) => (
                      <div key={outcome} className="flex items-center gap-2 text-xs font-medium text-stone-600">
                        <BookOpen className="h-3.5 w-3.5" style={{ color: assessment.secondary }} />
                        <span>{outcome}</span>
                      </div>
                    ))}
                  </div>
                  {track.href && (
                    <a
                      href={track.href}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80"
                      style={{ color: assessment.secondary }}
                    >
                      <span>Open course</span>
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>

            {assessment.trainingTracks.some((track) => track.href) ? (
              <p className="mt-5 text-center text-xs text-stone-500">
                Prefer a tailored package?{' '}
                <a
                  href="mailto:tre@fitwithpulse.ai?subject=Elite%20Athlete%20Support%20Readiness%20Training"
                  className="font-semibold underline-offset-2 hover:underline"
                  style={{ color: assessment.secondary }}
                >
                  Request a training package
                </a>
              </p>
            ) : (
              <a
                href="mailto:tre@fitwithpulse.ai?subject=Elite%20Athlete%20Support%20Readiness%20Training"
                className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition hover:opacity-90"
                style={{ backgroundColor: assessment.secondary, color: '#FAFAF8' }}
              >
                <Mail className="h-4 w-4" />
                <span>Request training package</span>
              </a>
            )}
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: 0.16 }}
        className="mt-8"
      >
        <div className="mb-4 max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Answer review</p>
          <h2 className="mt-1 text-2xl font-semibold text-stone-900">What each answer means</h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Now that you are scored, here is the thinking behind every option, including the strongest answer for each scenario.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {assessment.questions.map((question, i) => (
            <AnswerReviewCard
              key={question.id}
              question={question}
              selectedIndex={answers[question.id]}
              accent={assessment.accent}
              index={i}
            />
          ))}
        </div>
      </motion.div>
    </section>
  );
};

const AssessmentExperience: React.FC<{
  assessment: StakeholderAssessment;
  onExit: () => void;
}> = ({ assessment, onExit }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }, [assessment.id, currentIndex, complete]);

  const handleAnswer = (questionId: string, answerIndex: number) => {
    setAnswers((current) => ({ ...current, [questionId]: answerIndex }));
    window.setTimeout(() => {
      if (currentIndex < assessment.questions.length - 1) {
        setCurrentIndex((index) => Math.min(index + 1, assessment.questions.length - 1));
      } else {
        setComplete(true);
      }
    }, 260);
  };

  const handlePrevious = () => {
    setCurrentIndex((index) => Math.max(index - 1, 0));
  };

  const handleRestart = () => {
    setAnswers({});
    setCurrentIndex(0);
    setComplete(false);
  };

  if (complete) {
    return (
      <ResultsView
        assessment={assessment}
        answers={answers}
        onRestart={handleRestart}
        onExit={onExit}
      />
    );
  }

  return (
    <>
      <ProgressRail assessment={assessment} currentIndex={currentIndex} answers={answers} />
      <QuestionView
        assessment={assessment}
        currentIndex={currentIndex}
        answers={answers}
        onAnswer={handleAnswer}
        onPrevious={handlePrevious}
        onExit={onExit}
      />
    </>
  );
};

const EliteAthleteSupportReadinessAssessmentsPage: NextPage = () => {
  const [selectedId, setSelectedId] = useState<StakeholderId>('parent');
  const [activeId, setActiveId] = useState<StakeholderId | null>(null);

  const selectedAssessment = assessments.find((assessment) => assessment.id === selectedId) || assessments[0];
  const activeAssessment = activeId
    ? assessments.find((assessment) => assessment.id === activeId) || selectedAssessment
    : null;

  const startAssessment = (id: StakeholderId) => {
    setSelectedId(id);
    setActiveId(id);
  };

  return (
    <>
      <PageHead
        metaData={{
          pageId: 'elite-athlete-support-readiness-assessments',
          pageTitle: 'Mental Performance Readiness Assessments | Pulse Intelligence Labs',
          metaDescription:
            'Interactive readiness assessments for parents, coaches, and athletic trainers supporting elite athletes through pressure, recovery, communication, and knowing when to get help.',
          ogTitle: 'Mental Performance Readiness Assessments',
          ogDescription:
            'Assess how ready parents, coaches, and athletic trainers are to support an athlete under pressure, read the warning signs, and know when to get help.',
          ogImage: 'https://pulseintelligencelabs.com/pil-og.png',
          ogType: 'website',
          twitterCard: 'summary_large_image',
          twitterTitle: 'Mental Performance Readiness Assessments',
          twitterDescription:
            'Role-specific readiness scoring for the support system around elite athletes.',
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl="https://pulseintelligencelabs.com/elite-athlete-support-readiness-assessments"
        pageOgImage="/pil-og.png"
        themeColor="#FAFAF7"
      />

      <main data-assessment-page="true" className="relative min-h-screen overflow-hidden bg-[#FAFAF7] text-stone-900">
        <GridBackdrop />

        <nav className="fixed left-0 right-0 top-0 z-50 border-b border-stone-200/80 bg-[#FAFAF7]/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 sm:px-8">
            <PulseWordmark />
            <div className="hidden items-center gap-2 md:flex">
              {assessments.map((assessment) => (
                <button
                  key={assessment.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(assessment.id);
                    setActiveId(null);
                  }}
                  className={classNames(
                    'rounded-lg px-3 py-2 text-xs font-semibold transition',
                    selectedId === assessment.id && !activeId
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-500 hover:bg-stone-200/70 hover:text-stone-900',
                  )}
                >
                  {assessment.shortTitle}
                </button>
              ))}
            </div>
            <a
              href="mailto:tre@fitwithpulse.ai?subject=Elite%20Athlete%20Support%20Readiness%20Assessments"
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-700"
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Partner access</span>
            </a>
          </div>
        </nav>

        <AnimatePresence mode="wait">
          {activeAssessment ? (
            <motion.div key={activeAssessment.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
              <AssessmentExperience
                assessment={activeAssessment}
                onExit={() => {
                  setActiveId(null);
                }}
              />
            </motion.div>
          ) : (
            <motion.div key="hub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
              <HubView selected={selectedAssessment} onSelect={setSelectedId} onStart={startAssessment} />
            </motion.div>
          )}
        </AnimatePresence>

        <style jsx global>{`
          [data-assessment-page] {
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #292524;
          }

          [data-assessment-page] .text-white {
            color: #292524 !important;
          }

          [data-assessment-page] .text-black {
            color: #292524 !important;
          }

          [data-assessment-page] .bg-stone-900.text-white,
          [data-assessment-page] a.bg-stone-900 {
            color: #ffffff !important;
          }

          [data-assessment-page] .text-zinc-300,
          [data-assessment-page] .text-zinc-400 {
            color: #57534e !important;
          }

          [data-assessment-page] .text-zinc-500 {
            color: #78716c !important;
          }

          [data-assessment-page] .border-white\\/10,
          [data-assessment-page] .border-white\\/15,
          [data-assessment-page] .border-white\\/20,
          [data-assessment-page] .border-white\\/25,
          [data-assessment-page] .border-white\\/30,
          [data-assessment-page] .border-white\\/35,
          [data-assessment-page] .border-white\\/40 {
            border-color: rgba(214, 211, 209, 0.9) !important;
          }

          [data-assessment-page] [class*="bg-white/"],
          [data-assessment-page] [class*="bg-black/"],
          [data-assessment-page] .bg-\\[\\#0D0F13\\]\\/95,
          [data-assessment-page] .bg-\\[\\#090A0C\\] {
            background-color: rgba(255, 255, 255, 0.78) !important;
          }

          [data-assessment-page] .bg-white {
            background-color: #ffffff !important;
          }

          [data-assessment-page] .shadow-\\[0_40px_120px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\],
          [data-assessment-page] .shadow-\\[0_40px_160px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\] {
            box-shadow: 0 24px 80px rgba(68, 64, 60, 0.12) !important;
          }

          [data-assessment-page] h1,
          [data-assessment-page] h2,
          [data-assessment-page] h3 {
            letter-spacing: 0 !important;
          }

          [data-assessment-page] [style*="background-color: rgb(79, 111, 89)"],
          [data-assessment-page] [style*="background-color:#4F6F59"],
          [data-assessment-page] [style*="background-color: #4F6F59"] {
            color: #ffffff !important;
          }
        `}</style>
      </main>
    </>
  );
};

export default EliteAthleteSupportReadinessAssessmentsPage;
