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
  | 'documentation';

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
    description: 'Referral timing, notification order, emergency pathways, and safety exceptions.',
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
};

const scoreBands: ScoreBand[] = [
  {
    label: 'Foundational Gap',
    range: '0-49',
    tone: 'Baseline education needed',
    accent: COLORS.rose,
    summary: 'This stakeholder needs foundational education before being relied on inside an athlete support pathway.',
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

const optionSet = {
  route: [
    {
      label: 'Push through and reassess later',
      detail: 'Treat the moment as ordinary pressure and keep the athlete in performance mode.',
      score: 0,
    },
    {
      label: 'Offer encouragement only',
      detail: 'Respond with support but do not change load, document, or route the concern.',
      score: 1,
    },
    {
      label: 'Watch for one more signal',
      detail: 'Lower the temperature and monitor, but delay formal routing unless risk becomes clearer.',
      score: 2,
    },
    {
      label: 'Reduce pressure and notify the right lane',
      detail: 'Adjust the demand, preserve minimum necessary context, and involve the defined support path.',
      score: 3,
    },
    {
      label: 'Activate the pathway immediately',
      detail: 'Pause inappropriate training, follow notification rules, and hand the concern to the approved care route.',
      score: 4,
    },
  ] satisfies AnswerOption[],
  boundary: [
    {
      label: 'Solve it personally',
      detail: 'Take ownership of the concern without involving the defined support system.',
      score: 0,
    },
    {
      label: 'Give advice from experience',
      detail: 'Use personal experience as the main response even when the concern may need another role.',
      score: 1,
    },
    {
      label: 'Support and keep watching',
      detail: 'Stay supportive, but wait for a clearer signal before involving anyone else.',
      score: 2,
    },
    {
      label: 'Stay in role and route',
      detail: 'Support the athlete while moving the concern into the correct non-clinical or clinical lane.',
      score: 3,
    },
    {
      label: 'Name the boundary and escalate',
      detail: 'Protect trust, state the limit of your role, and use the approved pathway without delay.',
      score: 4,
    },
  ] satisfies AnswerOption[],
  learning: [
    {
      label: 'Results explain readiness',
      detail: 'If performance output is strong, there is no meaningful readiness concern.',
      score: 0,
    },
    {
      label: 'Motivation explains readiness',
      detail: 'The main job is to increase effort when pressure rises.',
      score: 1,
    },
    {
      label: 'Stress matters sometimes',
      detail: 'Stress affects performance, but the response is mostly encouragement and rest.',
      score: 2,
    },
    {
      label: 'State affects access to skill',
      detail: 'Sleep, arousal, attention, recovery, and stress can change how skill shows up.',
      score: 3,
    },
    {
      label: 'State, skill, and support interact',
      detail: 'Readiness is a pattern across body state, behavior, context, performance, and support.',
      score: 4,
    },
  ] satisfies AnswerOption[],
  trust: [
    {
      label: 'Share broadly so everyone knows',
      detail: 'More people with more detail creates the safest response.',
      score: 0,
    },
    {
      label: 'Tell the most influential person',
      detail: 'Share with whoever can create the fastest behavior change.',
      score: 1,
    },
    {
      label: 'Share after the athlete approves every detail',
      detail: 'Avoid action until consent is explicit, even when safety concern may require an exception.',
      score: 2,
    },
    {
      label: 'Share minimum necessary context',
      detail: 'Use consent where appropriate and follow safety exceptions when risk crosses a boundary.',
      score: 3,
    },
    {
      label: 'Protect trust and follow policy',
      detail: 'Share the smallest useful record with the right role, documenting consent or safety basis.',
      score: 4,
    },
  ] satisfies AnswerOption[],
};

const assessments: StakeholderAssessment[] = [
  {
    id: 'parent',
    title: 'Parent Elite Athlete Readiness',
    shortTitle: 'Parent readiness',
    audience: 'Parents and guardians',
    icon: Home,
    accent: COLORS.lime,
    secondary: COLORS.sky,
    price: '$149',
    trainingPrice: '$399',
    description:
      'Measures whether a parent can support an elite athlete through pressure, recovery, disclosure, and referral without turning home into another performance arena.',
    includes: ['11-minute assessment', 'Readiness report', 'Safety-minimum screen', 'Parent training recommendation'],
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
        prompt: 'What best explains an athlete who looks skilled in practice but shuts down after repeated travel, poor sleep, and public criticism?',
        scenario:
          'Your athlete says they are trying, but their body language, mood, and decision-making change late in a tournament weekend.',
        options: optionSet.learning,
      },
      {
        id: 'parent-identity',
        domain: 'mentalPerformance',
        prompt: 'After a bad game, your athlete says, "I am embarrassing everyone." What is the most readiness-aligned response?',
        scenario:
          'They are not making a direct safety statement, but the language ties identity to performance failure.',
        options: [
          { label: 'Review mistakes immediately', detail: 'Use the moment to correct what went wrong before it settles.', score: 0 },
          { label: 'Say they are being dramatic', detail: 'Normalize the loss by minimizing the statement.', score: 1 },
          { label: 'Tell them to rest and move on', detail: 'Give space but do not address the identity language.', score: 2 },
          { label: 'Separate worth from outcome', detail: 'Validate the feeling, reduce pressure, and revisit support when calm.', score: 3 },
          { label: 'Validate, reduce pressure, and monitor', detail: 'Protect identity, check for pattern risk, and route if language worsens.', score: 4 },
        ],
      },
      {
        id: 'parent-eating-pattern',
        domain: 'patternRecognition',
        critical: true,
        prompt: 'Your athlete has skipped dinner after games for two weeks and says food feels pointless after mistakes. What should happen?',
        scenario:
          'No emergency statement is made, but eating behavior and mood have shifted in a repeated pattern.',
        options: optionSet.route,
      },
      {
        id: 'parent-listen',
        domain: 'communication',
        prompt: 'Which first sentence is most likely to keep disclosure open?',
        scenario: 'The athlete gets in the car after practice, silent and visibly tense.',
        options: [
          { label: 'You need to toughen up', detail: 'Frames the concern as weakness.', score: 0 },
          { label: 'What did coach say this time?', detail: 'Pulls the conversation toward blame before context is known.', score: 1 },
          { label: 'Do you want advice?', detail: 'Can help, but may move too quickly into fixing.', score: 2 },
          { label: 'I can see today took a lot', detail: 'Names the observation without demanding disclosure.', score: 3 },
          { label: 'I am here, no performance review tonight', detail: 'Reduces pressure and protects psychological safety.', score: 4 },
        ],
      },
      {
        id: 'parent-boundary',
        domain: 'roleBoundaries',
        prompt: 'Your athlete asks you not to tell anyone that they feel unable to cope. What is the correct boundary?',
        scenario:
          'The athlete wants privacy, but the statement may require another support role depending severity.',
        options: optionSet.boundary,
      },
      {
        id: 'parent-safety-language',
        domain: 'escalation',
        critical: true,
        prompt: 'Your athlete texts, "I do not want to be here anymore," then stops answering. What is the right lane?',
        scenario: 'The message is ambiguous but contains safety language and loss of contact.',
        options: optionSet.route,
      },
      {
        id: 'parent-privacy',
        domain: 'privacyTrust',
        prompt: 'What should be shared when asking the school support lead for help?',
        scenario:
          'You need to route concern, but your athlete has not consented to a broad account of every conversation.',
        options: optionSet.trust,
      },
      {
        id: 'parent-return',
        domain: 'returnSupport',
        prompt: 'After a clinician clears the athlete from an acute concern, what should home support emphasize first?',
        scenario: 'The athlete wants to prove everything is normal immediately.',
        options: [
          { label: 'Return to full pressure fast', detail: 'Show confidence by restoring the normal performance routine.', score: 0 },
          { label: 'Avoid sport entirely', detail: 'Protect the athlete by blocking all performance demands indefinitely.', score: 1 },
          { label: 'Let the athlete decide alone', detail: 'Respect autonomy without structured support.', score: 2 },
          { label: 'Support a gradual return', detail: 'Keep pressure low and follow clinician or program guidance.', score: 3 },
          { label: 'Match clearance with low-pressure routines', detail: 'Follow guidance, monitor patterns, and avoid turning return into a test.', score: 4 },
        ],
      },
    ],
    trainingTracks: [
      {
        title: 'Parent Foundations: The Athlete Brain Under Pressure',
        format: 'Two live sessions plus a support playbook',
        price: '$399',
        outcomes: ['Stress and recovery literacy', 'Supportive language', 'Home pressure audit'],
      },
      {
        title: 'Recognizing Patterns Before Crisis',
        format: 'Self-paced module plus scenario lab',
        price: '$249',
        outcomes: ['Eating and sleep shifts', 'Withdrawal patterns', 'Referral readiness'],
      },
    ],
  },
  {
    id: 'coach',
    title: 'Coach Elite Athlete Mental Readiness',
    shortTitle: 'Coach readiness',
    audience: 'Head coaches, assistants, and performance staff',
    icon: Target,
    accent: COLORS.sky,
    secondary: COLORS.lime,
    price: '$199',
    trainingPrice: '$599',
    description:
      'Measures whether a coach can create a high-standard environment that protects trust, reads pressure patterns, and routes concern without becoming the clinician.',
    includes: ['14-minute assessment', 'Team-climate readout', 'Escalation judgment screen', 'Coach training recommendation'],
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
        id: 'coach-neuro',
        domain: 'neuroscience',
        prompt: 'An athlete keeps missing reads late in games after a brutal travel stretch. What is the most accurate interpretation?',
        scenario: 'The athlete is prepared, but execution drops when fatigue, crowd noise, and stakes rise.',
        options: optionSet.learning,
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
          { label: 'Correct behavior without attacking identity', detail: 'Keep standards high while making disclosure safer.', score: 3 },
          { label: 'Build pressure and recovery norms', detail: 'Coach standards, name support lanes, and normalize recovery after stress.', score: 4 },
        ],
      },
      {
        id: 'coach-withdrawal',
        domain: 'patternRecognition',
        prompt: 'A starter is still performing well but has stopped sitting with teammates and avoids film. What should you do first?',
        scenario: 'Output is intact, but behavior has changed across two weeks.',
        options: optionSet.route,
      },
      {
        id: 'coach-feedback',
        domain: 'communication',
        prompt: 'Which post-error response best supports mental readiness?',
        scenario: 'A player makes a visible mistake in front of the team.',
        options: [
          { label: 'Make the mistake public', detail: 'Use embarrassment as accountability.', score: 0 },
          { label: 'Bench without explanation', detail: 'Create consequence but no learning path.', score: 1 },
          { label: 'Tell them to forget it', detail: 'Move on quickly without a reset strategy.', score: 2 },
          { label: 'Cue the next action', detail: 'Keep correction specific, short, and task-focused.', score: 3 },
          { label: 'Reset, cue, and return', detail: 'Use a practiced reset and preserve the athlete from identity threat.', score: 4 },
        ],
      },
      {
        id: 'coach-boundary',
        domain: 'roleBoundaries',
        critical: true,
        prompt: 'An athlete discloses panic, poor sleep, and thoughts that scare them. What is the coach role?',
        scenario: 'The athlete trusts you and asks you to keep the conversation between you two.',
        options: optionSet.boundary,
      },
      {
        id: 'coach-emergency',
        domain: 'escalation',
        critical: true,
        prompt: 'An athlete says they have a plan to hurt themselves after practice. What is the next move?',
        scenario: 'This crosses from support conversation into emergency risk.',
        options: optionSet.route,
      },
      {
        id: 'coach-privacy',
        domain: 'privacyTrust',
        prompt: 'What belongs in a team-level update after a concern is routed?',
        scenario: "Staff want details before deciding tomorrow's training plan.",
        options: optionSet.trust,
      },
      {
        id: 'coach-return',
        domain: 'returnSupport',
        prompt: 'A clinician clears an athlete to re-enter team activity with monitoring. What should coaching do first?',
        scenario: 'The athlete wants to regain role status quickly.',
        options: [
          { label: 'Run the normal pressure test', detail: 'Use competition-like stress to show they are back.', score: 0 },
          { label: 'Make them sit out indefinitely', detail: 'Avoid all risk by withholding sport context.', score: 1 },
          { label: 'Ask teammates to watch them', detail: 'Creates informal surveillance and stigma.', score: 2 },
          { label: 'Use a lower-pressure return', detail: 'Follow clearance limits and keep status details contained.', score: 3 },
          { label: 'Stage return with support visibility', detail: 'Coordinate role-appropriate limits, monitor load, and prevent identity pressure.', score: 4 },
        ],
      },
    ],
    trainingTracks: [
      {
        title: 'Coaching the Nervous System',
        format: 'Live workshop plus team language guide',
        price: '$599',
        outcomes: ['Pressure-state literacy', 'Task-focused correction', 'Recovery-aware practice design'],
      },
      {
        title: 'Coach Escalation Protocol Lab',
        format: 'Scenario-based certification session',
        price: '$449',
        outcomes: ['Notification order', 'Boundary language', 'Emergency pathway timing'],
      },
    ],
  },
  {
    id: 'athleticTrainer',
    title: 'Athletic Trainer Athlete Readiness',
    shortTitle: 'Athletic trainer readiness',
    audience: 'Athletic trainers and sports medicine staff',
    icon: Stethoscope,
    accent: COLORS.purple,
    secondary: COLORS.emerald,
    price: '$249',
    trainingPrice: '$799',
    description:
      'Measures whether sports medicine staff can recognize mental-readiness patterns, document minimum necessary context, and coordinate the correct support lane.',
    includes: ['17-minute assessment', 'Pattern-triage readout', 'Documentation screen', 'Sports medicine training recommendation'],
    domains: [
      'neuroscience',
      'mentalPerformance',
      'patternRecognition',
      'roleBoundaries',
      'escalation',
      'privacyTrust',
      'returnSupport',
      'documentation',
    ],
    questions: [
      {
        id: 'trainer-neuro',
        domain: 'neuroscience',
        prompt: 'An injured athlete shows pain flares, poor sleep, irritability, and reduced rehab adherence. What is the best frame?',
        scenario: 'The physical plan is sound, but the athlete is trending down across body state and behavior.',
        options: optionSet.learning,
      },
      {
        id: 'trainer-performance',
        domain: 'mentalPerformance',
        prompt: 'Which statement best separates mental performance support from clinical care?',
        scenario: 'A staff member asks whether PulseCheck training means the athlete is receiving therapy.',
        options: [
          { label: 'It is therapy if it helps stress', detail: 'Blurs the difference between training and treatment.', score: 0 },
          { label: 'It replaces counseling for mild issues', detail: 'Overclaims the role of performance software.', score: 1 },
          { label: 'It is wellness content only', detail: 'Misses the structured readiness and routing function.', score: 2 },
          { label: 'It trains skills and routes concern', detail: 'Correctly keeps care decisions outside the product.', score: 3 },
          { label: 'It supports readiness within hard boundaries', detail: 'Names training, routing, clinical authority, and emergency limits.', score: 4 },
        ],
      },
      {
        id: 'trainer-eating-sleep',
        domain: 'patternRecognition',
        critical: true,
        prompt: 'An athlete has lost noticeable weight, misses rehab, sleeps poorly, and says they are letting everyone down. What is the right pathway?',
        scenario: 'No direct safety statement is made, but the pattern is clinically relevant.',
        options: optionSet.route,
      },
      {
        id: 'trainer-boundary',
        domain: 'roleBoundaries',
        prompt: 'A coach asks you whether the athlete is mentally safe to play. What should your response preserve?',
        scenario: 'You have observed concern, but a licensed clinician owns clinical clearance after elevated risk.',
        options: optionSet.boundary,
      },
      {
        id: 'trainer-crisis',
        domain: 'escalation',
        critical: true,
        prompt: 'During treatment, an athlete discloses current suicidal intent and access to means. What should happen?',
        scenario: 'The disclosure is direct and immediate.',
        options: optionSet.route,
      },
      {
        id: 'trainer-trust',
        domain: 'privacyTrust',
        prompt: 'What is the appropriate information pattern for a non-emergency referral?',
        scenario: 'A clinical partner needs enough context to act, but the athlete has shared sensitive details.',
        options: optionSet.trust,
      },
      {
        id: 'trainer-return',
        domain: 'returnSupport',
        prompt: 'A clinician clears an athlete from an acute concern but keeps monitoring active. What should the sports medicine plan do?',
        scenario: 'The athlete is physically available but still in a limited monitoring state.',
        options: [
          { label: 'Clear all limits immediately', detail: 'Treat clinical clearance as full performance clearance.', score: 0 },
          { label: 'Keep the athlete out of all activity', detail: 'Avoids nuance and may create unnecessary stigma.', score: 1 },
          { label: 'Ask the athlete to self-limit', detail: 'Leaves the return path too informal.', score: 2 },
          { label: 'Coordinate a conservative progression', detail: 'Match activity load to operational status and clinician guidance.', score: 3 },
          { label: 'Stage return with documented status', detail: 'Use low-pressure progression, status updates, and role-appropriate communication.', score: 4 },
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
        title: 'Sports Medicine Mental Readiness Triage',
        format: 'Live clinical-adjacent operations lab',
        price: '$799',
        outcomes: ['Pattern escalation', 'Role coordination', 'Return-to-training status'],
      },
      {
        title: 'Minimum Necessary Documentation',
        format: 'Template workshop plus audit checklist',
        price: '$399',
        outcomes: ['Event records', 'Status mirroring', 'Privacy-preserving handoff'],
      },
    ],
  },
];

const getBand = (score: number): ScoreBand => {
  if (score < 50) return scoreBands[0];
  if (score < 70) return scoreBands[1];
  if (score < 85) return scoreBands[2];
  return scoreBands[3];
};

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const answerLabel = (index: number) => String.fromCharCode(65 + index);

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
    return {
      key: domain,
      label: domainConfig[domain].label,
      score,
      icon: domainConfig[domain].icon,
    };
  });

  const weakestDomains = [...domainScores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((domain) => domain.key);

  return {
    rawScore,
    readinessScore,
    band: getBand(readinessScore),
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
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Training path</div>
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
            Stakeholder readiness assessments
          </div>
          <h1 className="mt-7 max-w-3xl text-4xl font-bold leading-[1.02] tracking-tight text-stone-900 sm:text-6xl">
            Assess the humans around the athlete.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-500">
            Paid stakeholder assessments for the support system that surrounds elite athletes: parents, coaches, and athletic trainers. Each path scores readiness, flags safety-critical gaps, and routes the stakeholder into role-specific education.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Readiness score', value: '0-100', icon: Gauge },
            { label: 'Scenario judgment', value: 'Role-based', icon: Target },
            { label: 'Training path', value: 'Separate cost', icon: GraduationCap },
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
          <h2 className="mt-2 text-3xl font-semibold text-stone-900">Three role-specific readiness pathways</h2>
          <p className="mt-3 text-base leading-7 text-stone-500">
            Each assessment has its own scoring lens and education path so the stakeholder is evaluated against the responsibilities they actually hold.
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
                <h2 className="text-lg font-semibold text-stone-900">{domainConfig[question.domain].label}</h2>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-stone-500">{domainConfig[question.domain].description}</p>

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
                      'group grid min-h-[86px] grid-cols-[42px_1fr_auto] items-center gap-4 rounded-lg border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-stone-400 sm:p-5',
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
                      <span className={classNames('mt-1 block text-sm leading-6', isSelected ? 'text-stone-700' : 'text-stone-500')}>
                        {option.detail}
                      </span>
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
            <div className="mt-1 text-xs text-stone-500">{domainConfig[domain.key].description}</div>
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

const ResultsView: React.FC<{
  assessment: StakeholderAssessment;
  answers: Record<string, number>;
  onRestart: () => void;
  onExit: () => void;
}> = ({ assessment, answers, onRestart, onExit }) => {
  const result = useMemo(() => computeResult(assessment, answers), [assessment, answers]);
  const Icon = assessment.icon;
  const scoreGradient = `conic-gradient(${result.band.accent} ${result.readinessScore * 3.6}deg, rgba(255,255,255,0.08) 0deg)`;
  const weakestLabels = result.weakestDomains.map((domain) => domainConfig[domain].label);

  return (
    <section className="relative z-10 mx-auto min-h-screen w-full max-w-6xl px-6 pb-12 pt-28 sm:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
          <div className="rounded-lg border border-stone-200 bg-white/85 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Readiness report</p>
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
                        <div className="font-semibold text-stone-900">Safety minimum applied</div>
                        <p className="mt-1 text-sm leading-6 text-stone-600">
                          One or more safety-critical items fell below the readiness threshold, so the result is held below Ready until training is completed.
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
                <h2 className="mt-1 text-2xl font-semibold text-stone-900">Where readiness is strongest</h2>
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Training recommendation</p>
                <h2 className="mt-1 text-2xl font-semibold text-stone-900">Next paid education path</h2>
              </div>
              <GraduationCap className="h-6 w-6" style={{ color: assessment.secondary }} />
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
                </div>
              ))}
            </div>

            <a
              href="mailto:tre@fitwithpulse.ai?subject=Elite%20Athlete%20Support%20Readiness%20Training"
              className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: assessment.secondary, color: '#FAFAF8' }}
            >
              <Mail className="h-4 w-4" />
              <span>Request training package</span>
            </a>
          </div>
        </motion.div>
      </div>
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
          pageTitle: 'Elite Athlete Support Readiness Assessments | Pulse Intelligence Labs',
          metaDescription:
            'Interactive readiness assessments for parents, coaches, and athletic trainers supporting elite athletes through pressure, readiness, referral, and return-to-training pathways.',
          ogTitle: 'Elite Athlete Support Readiness Assessments',
          ogDescription:
            'Assess stakeholder readiness across mental performance literacy, pressure support, role boundaries, and escalation pathways.',
          ogImage: 'https://pulseintelligencelabs.com/pil-og.png',
          ogType: 'website',
          twitterCard: 'summary_large_image',
          twitterTitle: 'Elite Athlete Support Readiness Assessments',
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
