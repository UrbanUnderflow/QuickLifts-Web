import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Crosshair,
  ChevronsUpDown,
  Eye,
  Heart,
  MessageCircle,
  Play,
  Sparkles,
  Wind,
  X,
} from 'lucide-react';
import { athleteProgressService } from '../../api/firebase/mentaltraining';
import {
  BASELINE_BODY_AWARENESS_RESPONSE_PROFILES,
  BASELINE_BREATH_PRACTICE_RESPONSE_PROFILES,
  BASELINE_REFLECTION_RESPONSE_PROFILES,
  BASELINE_SETBACK_RESPONSE_PROFILES,
  baselineAttentionResponseProfiles,
  baselineSelfTalkResponseProfiles,
  baselineSportPack,
  MENTAL_SKILL_FAMILIARITY_LEVELS,
  MENTAL_SKILL_FAMILIES,
  MENTAL_SKILL_FAMILY_LABELS,
  MENTAL_SKILL_STAGE_LABELS,
  scoreSequenceOrder,
  scoreMentalSkillsBaseline,
  type MentalSkillEvidence,
  type MentalSkillFamiliarity,
  type MentalSkillFamily,
  type MentalSkillsCurrentState,
} from '../../api/firebase/mentaltraining/mentalSkillsBaseline';
import { scenarioArchetypeForSport } from '../../api/firebase/mentaltraining/sportScenarioArchetypes';

interface BaselineAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  athleteId: string;
  athleteName?: string;
  sportName?: string;
  persist?: boolean;
  onComplete: (progress: any) => void;
}

type Step =
  | 'intro'
  | 'state'
  | 'tools'
  | 'belief'
  | 'reflection'
  | 'body'
  | 'breath'
  | 'visualization'
  | 'attention'
  | 'emotion'
  | 'coherence'
  | 'result';

const steps: Step[] = ['intro', 'state', 'tools', 'belief', 'reflection', 'body', 'breath', 'visualization', 'attention', 'emotion', 'coherence', 'result'];

const familyIcons: Record<MentalSkillFamily, React.ComponentType<{ className?: string }>> = {
  breathing_body_awareness: Wind,
  visualization: Eye,
  attention_cues: Crosshair,
  self_talk_reframing: MessageCircle,
  emotional_regulation: Heart,
  reflection_learning: BookOpen,
  belief_identity: Sparkles,
  coherence: Activity,
};

const familiarityLabels: Record<MentalSkillFamiliarity, string> = {
  new_to_me: 'I have not learned this yet',
  heard_of_it: 'I have heard of this',
  know_it: 'I understand the basic idea',
  practiced_it: 'I have tried this in practice',
  use_it: 'I use this on purpose',
};

const familiarityLevelPosition = (value: MentalSkillFamiliarity) =>
  MENTAL_SKILL_FAMILIARITY_LEVELS.findIndex((level) => level.id === value) + 1;

const nextFamiliarity: Record<MentalSkillFamiliarity, MentalSkillFamiliarity> = {
  new_to_me: 'heard_of_it',
  heard_of_it: 'know_it',
  know_it: 'practiced_it',
  practiced_it: 'use_it',
  use_it: 'new_to_me',
};

const defaultFamiliarity = MENTAL_SKILL_FAMILIES.reduce((result, family) => {
  result[family] = 'new_to_me';
  return result;
}, {} as Record<MentalSkillFamily, MentalSkillFamiliarity>);

const moodOptions: Array<{ id: MentalSkillsCurrentState['mood']; label: string; symbol: string }> = [
  { id: 'drained', label: 'Drained', symbol: '▁' },
  { id: 'off', label: 'Off', symbol: '▂' },
  { id: 'okay', label: 'Okay', symbol: '▃' },
  { id: 'solid', label: 'Solid', symbol: '▅' },
  { id: 'locked_in', label: 'Locked in', symbol: '▇' },
];

function OptionButton(props: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`w-full border px-5 py-4 text-left text-base font-semibold transition ${
        props.selected
          ? 'border-teal-300 bg-teal-300 text-slate-950'
          : 'border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]'
      }`}
    >
      {props.children}
    </button>
  );
}

function Meter(props: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm font-semibold text-zinc-200">
        <span>{props.label}</span>
        <span>{props.value} / 5</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            type="button"
            key={value}
            aria-label={`${props.label} ${value} of 5`}
            onClick={() => props.onChange(value)}
            className={`h-11 border transition ${value <= props.value ? 'border-teal-300 bg-teal-300' : 'border-white/10 bg-white/[0.06]'}`}
          />
        ))}
      </div>
    </div>
  );
}

export const BaselineAssessmentModal: React.FC<BaselineAssessmentModalProps> = ({
  isOpen,
  onClose,
  athleteId,
  athleteName = 'Athlete',
  sportName,
  persist = true,
  onComplete,
}) => {
  const contentRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState<Step>('intro');
  const [isSaving, setIsSaving] = useState(false);
  const [savedProgress, setSavedProgress] = useState<any>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState<MentalSkillsCurrentState>({
    mood: 'okay',
    rest: 3,
    energy: 3,
    confidence: 3,
    motivation: 3,
    sportConnection: 3,
    selfBelief: 3,
    improvementBelief: 3,
  });
  const [familiarity, setFamiliarity] = useState(defaultFamiliarity);
  const [evidence, setEvidence] = useState<MentalSkillEvidence[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [breathComplete, setBreathComplete] = useState(false);
  const [breathPracticeSelected, setBreathPracticeSelected] = useState<string | null>(null);
  const [visualizationOrder, setVisualizationOrder] = useState<number[]>([]);
  const [coherenceOrder, setCoherenceOrder] = useState<string[]>([]);
  const [result, setResult] = useState<ReturnType<typeof scoreMentalSkillsBaseline> | null>(null);

  const archetype = useMemo(() => scenarioArchetypeForSport(sportName), [sportName]);
  const sportPack = useMemo(() => baselineSportPack(archetype), [archetype]);
  const attentionResponses = useMemo(() => baselineAttentionResponseProfiles(sportPack), [sportPack]);
  const selfTalkResponses = useMemo(() => baselineSelfTalkResponseProfiles(sportPack), [sportPack]);
  const stepIndex = steps.indexOf(step);
  const progress = Math.max(0, (stepIndex / (steps.length - 1)) * 100);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const replaceEvidence = (items: MentalSkillEvidence[]) => {
    const ids = new Set(items.map((item) => `${item.challengeId}:${item.family}:${item.component}`));
    setEvidence((current) => [
      ...current.filter((item) => !ids.has(`${item.challengeId}:${item.family}:${item.component}`)),
      ...items,
    ]);
  };

  const advance = (next: Step) => {
    setSelected(null);
    setStep(next);
  };

  const selectScored = (id: string, items: MentalSkillEvidence[]) => {
    setSelected(id);
    replaceEvidence(items.map((item) => ({ ...item, selectedOptionId: id })));
  };

  const finish = async () => {
    const baseline = scoreMentalSkillsBaseline({
      source: 'mental-skills-starting-point-web',
      sportName,
      sportArchetype: archetype,
      currentState,
      familiarity,
      evidence,
    });
    setResult(baseline);
    setStep('result');
    setIsSaving(true);
    setSaveError(null);
    if (!persist) {
      setSavedProgress(baseline);
      setIsSaving(false);
      return;
    }
    try {
      const progressRecord = await athleteProgressService.saveMentalSkillsBaseline(athleteId, baseline);
      setSavedProgress(progressRecord);
    } catch (error) {
      console.error('[Mental skills starting point] Failed to save:', error);
      setSaveError('Your starting point could not be saved. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const visualizationItems = [2, 0, 3, 1].map((index) => ({
    label: sportPack.mentalRehearsalSteps[index],
    index,
  }));
  const coherenceItems = [
    { id: 'signal', label: 'Notice: my heart is beating faster' },
    { id: 'breath', label: 'Breathe: one slow breath in and out' },
    { id: 'thought', label: 'Think: my body is preparing me' },
    { id: 'action', label: `Choose: ${sportPack.controllableCue}` },
  ];
  const scrambledCoherenceItems = [coherenceItems[3], coherenceItems[0], coherenceItems[2], coherenceItems[1]];

  if (!isOpen) return null;

  const action = (() => {
    if (step === 'intro') return { label: 'Begin', run: () => advance('state'), disabled: false };
    if (step === 'state') return { label: 'Continue', run: () => advance('tools'), disabled: false };
    if (step === 'tools') return { label: 'Start the challenges', run: () => advance('belief'), disabled: false };
    if (step === 'belief') return { label: 'Continue', run: () => advance('reflection'), disabled: !selected };
    if (step === 'reflection') return { label: 'Continue', run: () => advance('body'), disabled: !selected };
    if (step === 'body') return { label: 'Continue', run: () => advance('breath'), disabled: !selected };
    if (step === 'breath') return { label: 'Continue', run: () => advance('visualization'), disabled: !breathComplete || !breathPracticeSelected };
    if (step === 'visualization') return { label: 'Continue', run: () => advance('attention'), disabled: visualizationOrder.length !== 4 };
    if (step === 'attention') return { label: 'Continue', run: () => advance('emotion'), disabled: !selected };
    if (step === 'emotion') return { label: 'Continue', run: () => advance('coherence'), disabled: !selected };
    if (step === 'coherence') return { label: 'See my starting point', run: finish, disabled: coherenceOrder.length !== 4 };
    return null;
  })();

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#05080d] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(45,212,191,0.16),transparent_36%),radial-gradient(circle_at_85%_80%,rgba(132,204,22,0.1),transparent_32%)]" />
      <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col px-5 pb-5 pt-6 sm:px-8">
        <header className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-white/10" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.18em] text-teal-300">
              <span>Mental Skills Starting Point</span>
              {step !== 'intro' && step !== 'result' ? <span>{stepIndex} of {steps.length - 2}</span> : null}
            </div>
            <div className="mt-3 h-1 overflow-hidden bg-white/10">
              <motion.div className="h-full bg-teal-300" animate={{ width: `${progress}%` }} />
            </div>
          </div>
        </header>

        {archetype !== 'general' ? (
          <div className="mt-5 self-center bg-teal-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-teal-200">
            <Sparkles className="mr-2 inline h-4 w-4" /> Personalized for {sportName}
          </div>
        ) : null}

        <main ref={contentRef} className="min-h-0 flex-1 overflow-y-auto py-7 [scrollbar-width:none]">
          <AnimatePresence mode="wait">
            <motion.section
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="mx-auto max-w-2xl"
            >
              {step === 'intro' ? (
                <div className="pt-8 text-center">
                  <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.4, repeat: Infinity }} className="mx-auto grid h-32 w-32 place-items-center rounded-full bg-teal-300/10">
                    <Brain className="h-16 w-16 text-teal-300" />
                  </motion.div>
                  <p className="mt-8 text-sm font-bold uppercase tracking-[0.2em] text-teal-300">Your first mental training session</p>
                  <h1 className="mt-4 text-4xl font-black sm:text-6xl">Show us how you think.</h1>
                  <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-zinc-300">
                    You will work through short challenges that use breathing, visualization, attention, self-talk, reflection, belief, and coherence. Your choices help Nora pick the right first skills for you.
                  </p>
                </div>
              ) : null}

              {step === 'state' ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">State check</p>
                  <h2 className="mt-3 text-3xl font-black sm:text-5xl">How do you feel right now?</h2>
                  <p className="mt-3 text-zinc-400">We save how today feels separately from your mental skill results.</p>
                  <div className="mt-7 grid grid-cols-5 gap-2">
                    {moodOptions.map((option) => (
                      <button key={option.id} type="button" onClick={() => setCurrentState({ ...currentState, mood: option.id })} className={`min-h-24 border p-2 text-center ${currentState.mood === option.id ? 'border-teal-300 bg-teal-300 text-slate-950' : 'border-white/10 bg-white/[0.05]'}`}>
                        <div className="text-2xl">{option.symbol}</div><div className="mt-2 text-xs font-bold sm:text-sm">{option.label}</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-8 space-y-6">
                    <Meter label="Rest" value={currentState.rest} onChange={(rest) => setCurrentState({ ...currentState, rest })} />
                    <Meter label="Energy" value={currentState.energy} onChange={(energy) => setCurrentState({ ...currentState, energy })} />
                    <Meter label="Confidence" value={currentState.confidence} onChange={(confidence) => setCurrentState({ ...currentState, confidence })} />
                    <Meter label="Motivation" value={currentState.motivation} onChange={(motivation) => setCurrentState({ ...currentState, motivation })} />
                    <Meter label="Connection to my sport" value={currentState.sportConnection} onChange={(sportConnection) => setCurrentState({ ...currentState, sportConnection })} />
                    <Meter label="Belief in myself as an athlete" value={currentState.selfBelief} onChange={(selfBelief) => setCurrentState({ ...currentState, selfBelief })} />
                    <Meter label="Belief that I can improve with practice" value={currentState.improvementBelief} onChange={(improvementBelief) => setCurrentState({ ...currentState, improvementBelief })} />
                  </div>
                </div>
              ) : null}

              {step === 'tools' ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">Skill experience</p>
                  <h2 className="mt-3 text-3xl font-black sm:text-5xl">Which skills have you used?</h2>
                  <p className="mt-3 text-zinc-400">Choose the description that best matches your experience with each skill.</p>
                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    {MENTAL_SKILL_FAMILIES.map((family) => {
                      const Icon = familyIcons[family];
                      const currentLevel = familiarity[family];
                      return (
                        <button key={family} type="button" onClick={() => setFamiliarity({ ...familiarity, [family]: nextFamiliarity[currentLevel] })} className="flex items-center gap-4 border border-white/10 bg-white/[0.05] p-4 text-left" aria-label={`${MENTAL_SKILL_FAMILY_LABELS[family]}: ${familiarityLabels[currentLevel]}. Tap to change your answer, currently level ${familiarityLevelPosition(currentLevel)} of ${MENTAL_SKILL_FAMILIARITY_LEVELS.length}.`}>
                          <Icon className="h-7 w-7 text-teal-300" />
                          <span className="min-w-0 flex-1"><span className="block font-bold">{MENTAL_SKILL_FAMILY_LABELS[family]}</span><span className="mt-1 block text-sm text-teal-200">{familiarityLabels[currentLevel]}</span><span className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-zinc-400"><ChevronsUpDown className="h-3.5 w-3.5" />Tap to change your answer · level {familiarityLevelPosition(currentLevel)} of {MENTAL_SKILL_FAMILIARITY_LEVELS.length}</span></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {step === 'belief' ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">Challenge 1 · Belief</p>
                  <h2 className="mt-3 text-3xl font-black sm:text-5xl">What is your first thought?</h2>
                  <p className="mt-5 text-xl leading-8 text-zinc-200">{sportPack.setbackPrompt}</p>
                  <div className="mt-7 space-y-3">
                    {BASELINE_SETBACK_RESPONSE_PROFILES.map((response) => (
                      <OptionButton
                        key={response.id}
                        selected={selected === response.id}
                        onClick={() => selectScored(response.id, [
                          { challengeId: 'setback', family: 'belief_identity', component: 'choose', score: response.beliefScore },
                          { challengeId: 'setback', family: 'self_talk_reframing', component: 'choose', score: response.selfTalkScore },
                          { challengeId: 'setback', family: 'reflection_learning', component: 'understand', score: response.reflectionScore },
                        ])}
                      >
                        {response.label}
                      </OptionButton>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 'reflection' ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">Challenge 2 · Reflection</p>
                  <h2 className="mt-3 text-3xl font-black sm:text-5xl">What would you do first?</h2>
                  <p className="mt-5 text-xl leading-8 text-zinc-200">{sportPack.reflectionPrompt}</p>
                  <div className="mt-7 space-y-3">
                    {BASELINE_REFLECTION_RESPONSE_PROFILES.map((response) => (
                      <OptionButton key={response.id} selected={selected === response.id} onClick={() => selectScored(response.id, [
                        { challengeId: 'reflection', family: 'reflection_learning', component: 'choose', score: response.reflectionScore },
                        { challengeId: 'reflection', family: 'belief_identity', component: 'understand', score: response.beliefScore },
                      ])}>{response.label}</OptionButton>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 'body' ? (
                <div className="text-center">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">Challenge 3 · Body awareness</p>
                  <h2 className="mt-3 text-3xl font-black sm:text-5xl">Catch the first signal</h2>
                  <p className="mt-5 text-xl text-zinc-200">{sportPack.bodyPrompt}</p>
                  <div className="mt-7 space-y-3 text-left">
                    {BASELINE_BODY_AWARENESS_RESPONSE_PROFILES.map((response) => (
                      <OptionButton key={response.id} selected={selected === response.id} onClick={() => selectScored(response.id, [
                        { challengeId: 'body_signal', family: 'breathing_body_awareness', component: 'recognize', score: response.bodyAwarenessScore },
                        { challengeId: 'body_signal', family: 'emotional_regulation', component: 'recognize', score: response.emotionalAwarenessScore },
                      ])}>{response.label}</OptionButton>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 'breath' ? (
                <div className="text-center">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">Breath practice</p>
                  <h2 className="mt-3 text-3xl font-black sm:text-5xl">Breathe in slowly, then breathe out slowly</h2>
                  <button type="button" onClick={() => {
                    setBreathComplete(true);
                  }} className={`mx-auto mt-8 grid h-40 w-40 place-items-center rounded-full border-2 ${breathComplete ? 'border-teal-200 bg-teal-300 text-slate-950' : 'border-teal-300/40 bg-teal-300/10 text-teal-200'}`}>
                    {breathComplete ? <Check className="h-16 w-16" /> : <span><Wind className="mx-auto h-12 w-12" /><span className="mt-2 block text-sm font-bold">One slow breath</span></span>}
                  </button>
                  <p className="mt-4 text-sm text-zinc-400">Breathe in slowly. Breathe out slowly. Tap the circle after you finish breathing out.</p>
                  {breathComplete ? (
                    <div className="mt-8 text-left">
                      <h3 className="text-xl font-black">Which statement best describes what you did?</h3>
                      <div className="mt-4 space-y-3">
                        {BASELINE_BREATH_PRACTICE_RESPONSE_PROFILES.map((response) => (
                          <OptionButton key={response.id} selected={breathPracticeSelected === response.id} onClick={() => {
                            setBreathPracticeSelected(response.id);
                            replaceEvidence([
                              { challengeId: 'guided_breath', family: 'breathing_body_awareness', component: 'rehearse', score: response.breathingScore, selectedOptionId: response.id },
                              { challengeId: 'guided_breath', family: 'coherence', component: 'rehearse', score: response.coherenceScore, selectedOptionId: response.id },
                            ]);
                          }}>{response.label}</OptionButton>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === 'visualization' ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">Challenge 4 · Visualization</p>
                  <h2 className="mt-3 text-3xl font-black sm:text-5xl">Build a complete mental rehearsal</h2>
                  <p className="mt-3 text-zinc-400">Tap the scenes in the order you would rehearse them.</p>
                  <div className="mt-7 space-y-3">
                    {visualizationItems.map((item) => {
                      const position = visualizationOrder.indexOf(item.index);
                      return <OptionButton key={item.index} selected={position >= 0} onClick={() => {
                        if (position >= 0) return;
                        const next = [...visualizationOrder, item.index];
                        setVisualizationOrder(next);
                        if (next.length === 4) {
                          const sequenceScore = scoreSequenceOrder(next, [0, 1, 2, 3]);
                          const orderId = `visualization_order_${next.join('-')}`;
                          replaceEvidence([
                            { challengeId: 'visualization_order', family: 'visualization', component: 'understand', score: sequenceScore, selectedOptionId: orderId },
                            { challengeId: 'visualization_order', family: 'visualization', component: 'choose', score: sequenceScore, selectedOptionId: orderId },
                            { challengeId: 'visualization_order', family: 'visualization', component: 'rehearse', score: Math.min(100, sequenceScore + 5), selectedOptionId: orderId },
                          ]);
                        }
                      }}><span className="mr-3 inline-grid h-7 w-7 place-items-center rounded-full bg-black/20">{position >= 0 ? position + 1 : '·'}</span>{item.label}</OptionButton>;
                    })}
                  </div>
                  {visualizationOrder.length ? <button type="button" onClick={() => setVisualizationOrder([])} className="mt-4 text-sm font-bold text-teal-300">Start the order again</button> : null}
                </div>
              ) : null}

              {step === 'attention' ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">Challenge 5 · Attention</p>
                  <h2 className="mt-3 text-3xl font-black sm:text-5xl">Where would your attention go first?</h2>
                  <p className="mt-5 text-xl text-zinc-200">{sportPack.pressurePrompt}</p>
                  <div className="mt-7 space-y-3">
                    {attentionResponses.map((response) => (
                      <OptionButton key={response.id} selected={selected === response.id} onClick={() => selectScored(response.id, [
                        { challengeId: 'attention', family: 'attention_cues', component: 'choose', score: response.score },
                      ])}>{response.label}</OptionButton>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 'emotion' ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">Challenge 6 · Self-talk</p>
                  <h2 className="mt-3 text-3xl font-black sm:text-5xl">What would you tell yourself first?</h2>
                  <p className="mt-5 text-xl text-zinc-200">You notice that you feel nervous {sportPack.setting}.</p>
                  <div className="mt-7 space-y-3">
                    {selfTalkResponses.map((response) => (
                      <OptionButton key={response.id} selected={selected === response.id} onClick={() => selectScored(response.id, [
                        { challengeId: 'emotion', family: 'emotional_regulation', component: 'choose', score: response.emotionalRegulationScore },
                        { challengeId: 'emotion', family: 'self_talk_reframing', component: 'understand', score: response.selfTalkScore },
                      ])}>{response.label}</OptionButton>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 'coherence' ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">Final challenge · Coherence</p>
                  <h2 className="mt-3 text-3xl font-black sm:text-5xl">Build a response you can repeat</h2>
                  <p className="mt-3 text-zinc-400">Tap the four parts in the order that makes the most sense to you.</p>
                  <div className="mt-7 space-y-3">
                    {scrambledCoherenceItems.map((item) => {
                      const position = coherenceOrder.indexOf(item.id);
                      return <OptionButton key={item.id} selected={position >= 0} onClick={() => {
                        if (position >= 0) return;
                        const next = [...coherenceOrder, item.id];
                        setCoherenceOrder(next);
                        if (next.length === 4) {
                          const expectedOrder = coherenceItems.map((coherenceItem) => coherenceItem.id);
                          const sequenceScore = scoreSequenceOrder(next, expectedOrder);
                          const orderId = `coherence_order_${next.join('-')}`;
                          replaceEvidence([
                            { challengeId: 'coherence_chain', family: 'coherence', component: 'understand', score: sequenceScore, selectedOptionId: orderId },
                            { challengeId: 'coherence_chain', family: 'coherence', component: 'choose', score: sequenceScore, selectedOptionId: orderId },
                            { challengeId: 'coherence_chain', family: 'reflection_learning', component: 'choose', score: Math.max(0, sequenceScore - 5), selectedOptionId: orderId },
                          ]);
                        }
                      }}><span className="mr-3 inline-grid h-7 w-7 place-items-center rounded-full bg-black/20">{position >= 0 ? position + 1 : '·'}</span>{item.label}</OptionButton>;
                    })}
                  </div>
                  {coherenceOrder.length ? <button type="button" onClick={() => setCoherenceOrder([])} className="mt-4 text-sm font-bold text-teal-300">Start the order again</button> : null}
                </div>
              ) : null}

              {step === 'result' && result ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">Your starting point</p>
                  <h2 className="mt-3 text-4xl font-black sm:text-6xl">Here is where your training begins.</h2>
                  <div className="mt-7 flex items-end gap-4"><span className="text-7xl font-black text-teal-300">{result.overallCompetencyScore}</span><span className="pb-2 text-zinc-400">mental skill competency</span></div>
                  <p className="mt-3 max-w-xl text-zinc-300">This score shows what you recognized and practiced today. Your current mood was saved separately.</p>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {MENTAL_SKILL_FAMILIES.map((family) => {
                      const Icon = familyIcons[family];
                      const familyResult = result.familyScores[family];
                      return <div key={family} className="flex items-center gap-4 border border-white/10 bg-white/[0.05] p-4"><Icon className="h-6 w-6 text-teal-300" /><span className="flex-1"><span className="block font-bold">{MENTAL_SKILL_FAMILY_LABELS[family]}</span><span className="text-sm text-zinc-400">{MENTAL_SKILL_STAGE_LABELS[familyResult.stage]}</span></span><span className="text-xl font-black">{familyResult.score}</span></div>;
                    })}
                  </div>
                  <h3 className="mt-9 text-xl font-black">Your first three skills</h3>
                  <div className="mt-3 space-y-2">
                    {Object.values(result.disciplineFocus).map((family, index) => <div key={`${family}-${index}`} className="flex items-center gap-3 bg-teal-300/10 px-4 py-3 font-bold text-teal-100"><span className="grid h-7 w-7 place-items-center rounded-full bg-teal-300 text-slate-950">{index + 1}</span>{MENTAL_SKILL_FAMILY_LABELS[family]}</div>)}
                  </div>
                  {saveError ? <p className="mt-5 font-semibold text-amber-300">{saveError}</p> : null}
                </div>
              ) : null}
            </motion.section>
          </AnimatePresence>
        </main>

        {action ? (
          <button type="button" disabled={action.disabled || isSaving} onClick={action.run} className="flex h-16 w-full items-center justify-center gap-3 bg-teal-300 text-lg font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
            {step === 'intro' ? <Play className="h-5 w-5 fill-current" /> : null}{action.label}<ChevronRight className="h-5 w-5" />
          </button>
        ) : step === 'result' ? (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              if (saveError) {
                void finish();
                return;
              }
              if (savedProgress) onComplete(savedProgress);
            }}
            className="h-16 w-full bg-teal-300 text-lg font-black text-slate-950 disabled:opacity-50"
          >
            {isSaving ? 'Saving your starting point…' : saveError ? 'Try saving again' : `Start training, ${athleteName.split(' ')[0]}`}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default BaselineAssessmentModal;
