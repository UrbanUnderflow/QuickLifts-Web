import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Crosshair,
  Eye,
  Heart,
  MessageCircle,
  Play,
  Sparkles,
  Wind,
} from 'lucide-react';
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

export interface ConsolidatedSkillsBaselineProps {
  embedded?: boolean;
  sportName?: string;
  precedingItemCount?: number;
  initialDraft?: ConsolidatedSkillsDraft | null;
  onSaveDraft: (draft: ConsolidatedSkillsDraft) => Promise<void>;
  onComplete: (result: ReturnType<typeof scoreMentalSkillsBaseline>, draft: ConsolidatedSkillsDraft) => Promise<void> | void;
  onBack: () => void;
}

export interface ConsolidatedSkillsDraft {
  version: 1;
  step: Step;
  currentState: MentalSkillsCurrentState;
  familiarity: Record<MentalSkillFamily, MentalSkillFamiliarity>;
  evidence: MentalSkillEvidence[];
  selected: string | null;
  breathComplete: boolean;
  breathPracticeSelected: string | null;
  visualizationOrder: number[];
  coherenceOrder: string[];
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
  { id: 'drained', label: 'Drained', symbol: '🪫' },
  { id: 'off', label: 'Off', symbol: '😔' },
  { id: 'okay', label: 'Okay', symbol: '😐' },
  { id: 'solid', label: 'Solid', symbol: '💪' },
  { id: 'locked_in', label: 'Locked In', symbol: '🔥' },
];

const statePages = [
  { title: 'How do you feel right now?', description: 'Choose what fits you right now.', fields: [] },
  { title: 'How rested and energized do you feel?', description: 'Rate each one from 1 (very low) to 5 (very high).', fields: [
    { key: 'rest', label: 'Rest' }, { key: 'energy', label: 'Energy' },
  ] },
  { title: 'How ready do you feel to train?', description: 'Rate each one from 1 (very low) to 5 (very high).', fields: [
    { key: 'confidence', label: 'Confidence' }, { key: 'motivation', label: 'Motivation' },
  ] },
  { title: 'How do you feel about your sport?', description: 'Rate each one from 1 (very low) to 5 (very high).', fields: [
    { key: 'sportConnection', label: 'Connection to my sport' },
    { key: 'selfBelief', label: 'Belief in myself as an athlete' },
    { key: 'improvementBelief', label: 'Belief that I can improve with practice' },
  ] },
] as const;

function OptionButton(props: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.selected}
      className={`w-full border px-5 py-4 text-left text-base font-semibold transition ${
        props.selected
          ? 'border-[#d7ff00] bg-[#d7ff00]/10 text-white'
          : 'border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]'
      }`}
    >
      {props.children}
    </button>
  );
}

function Meter(props: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="skills-state-meter space-y-2">
      <div className="skill-meter-label flex items-center justify-between text-sm font-semibold text-zinc-200">
        <span>{props.label}</span>
        <span>{props.value} / 5</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            type="button"
            key={value}
            aria-label={`${props.label} ${value} of 5`}
            aria-pressed={value === props.value}
            onClick={() => props.onChange(value)}
            className={`h-11 border transition ${value <= props.value ? 'border-[#d7ff00] bg-[#d7ff00]' : 'border-white/10 bg-white/[0.06]'}`}
          >{value}</button>
        ))}
      </div>
      <div className="skills-meter-anchors"><span>Very low</span><span>Very high</span></div>
    </div>
  );
}

export const ConsolidatedSkillsBaseline: React.FC<ConsolidatedSkillsBaselineProps> = ({
  embedded = false,
  sportName,
  precedingItemCount = 0,
  initialDraft,
  onSaveDraft,
  onComplete,
  onBack,
}) => {
  const contentRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState<Step>(initialDraft?.step ?? 'state');
  // Local presentation pages retain the existing persisted state-step contract.
  const [statePage, setStatePage] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState<MentalSkillsCurrentState>(initialDraft?.currentState ?? {
    mood: 'okay',
    rest: 3,
    energy: 3,
    confidence: 3,
    motivation: 3,
    sportConnection: 3,
    selfBelief: 3,
    improvementBelief: 3,
  });
  const [familiarity, setFamiliarity] = useState(initialDraft?.familiarity ?? defaultFamiliarity);
  const [evidence, setEvidence] = useState<MentalSkillEvidence[]>(initialDraft?.evidence ?? []);
  const [selected, setSelected] = useState<string | null>(initialDraft?.selected ?? null);
  const [breathComplete, setBreathComplete] = useState(initialDraft?.breathComplete ?? false);
  const [breathPracticeSelected, setBreathPracticeSelected] = useState<string | null>(initialDraft?.breathPracticeSelected ?? null);
  const [visualizationOrder, setVisualizationOrder] = useState<number[]>(initialDraft?.visualizationOrder ?? []);
  const [coherenceOrder, setCoherenceOrder] = useState<string[]>(initialDraft?.coherenceOrder ?? []);
  const [result, setResult] = useState<ReturnType<typeof scoreMentalSkillsBaseline> | null>(() => initialDraft?.step === 'result' ? scoreMentalSkillsBaseline({ source: 'mental-skills-starting-point-web', sportName, sportArchetype: scenarioArchetypeForSport(sportName), currentState: initialDraft.currentState, familiarity: initialDraft.familiarity, evidence: initialDraft.evidence }) : null);

  const archetype = useMemo(() => scenarioArchetypeForSport(sportName), [sportName]);
  const sportPack = useMemo(() => baselineSportPack(archetype), [archetype]);
  const attentionResponses = useMemo(() => baselineAttentionResponseProfiles(sportPack), [sportPack]);
  const selfTalkResponses = useMemo(() => baselineSelfTalkResponseProfiles(sportPack), [sportPack]);
  const stepIndex = steps.indexOf(step);
  const totalItems = precedingItemCount + 24;
  const completedItems = precedingItemCount + (step === 'intro' ? 0 : step === 'state' ? [0, 1, 3, 5][statePage] : step === 'tools' ? 8 : step === 'result' ? 24 : 16 + Math.max(0, stepIndex - 3));
  const progress = completedItems / totalItems * 100;

  useEffect(() => {
    const target = embedded ? contentRef.current?.closest('.consolidated-skills') : contentRef.current;
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [step, statePage, embedded]);

  const replaceEvidence = (items: MentalSkillEvidence[]) => {
    const ids = new Set(items.map((item) => `${item.challengeId}:${item.family}:${item.component}`));
    setEvidence((current) => [
      ...current.filter((item) => !ids.has(`${item.challengeId}:${item.family}:${item.component}`)),
      ...items,
    ]);
  };

  const draft = (nextStep: Step = step): ConsolidatedSkillsDraft => ({
    version: 1, step: nextStep, currentState, familiarity, evidence,
    selected: nextStep === step ? selected : null,
    breathComplete, breathPracticeSelected, visualizationOrder, coherenceOrder,
  });

  const advance = async (next: Step) => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveDraft(draft(next));
      setSelected(null);
      setStep(next);
    } catch {
      setSaveError('Your progress could not be saved. Check your connection and try Continue again.');
    } finally {
      setIsSaving(false);
    }
  };

  const advanceStatePage = async () => {
    if (statePage === statePages.length - 1) return advance('tools');
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveDraft(draft('state'));
      setStatePage(statePage + 1);
    } catch {
      setSaveError('Your progress could not be saved. Check your connection and try Continue again.');
    } finally {
      setIsSaving(false);
    }
  };

  const backToSections = async () => {
    if (isSaving) return;
    if (step === 'state' && statePage > 0) {
      setStatePage(statePage - 1);
      setSaveError(null);
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveDraft(draft());
      onBack();
    } catch {
      setSaveError('Your progress could not be saved. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
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
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveDraft(draft('result'));
      setResult(baseline);
      setStep('result');
    } catch {
      setSaveError('Your starting point could not be saved. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const complete = async () => {
    if (!result || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onComplete(result, draft('result'));
    } catch {
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


  const action = (() => {
    if (step === 'intro') return { label: 'Begin', run: () => advance('state'), disabled: false };
    if (step === 'state') return { label: 'Continue', run: advanceStatePage, disabled: false };
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
    <div className={`consolidated-skills ${embedded ? 'skills-embedded' : ''} relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b10] text-white`}>
      <style>{`.consolidated-skills .skills-mood-options{grid-template-columns:repeat(auto-fit,minmax(64px,1fr))}.consolidated-skills button.skills-reset{background:#19191f;border:1px solid #ffffff30;color:#f5f5f5;padding:12px 16px;min-height:44px;border-radius:12px}.consolidated-skills button.skills-reset:hover{background:#25252d;border-color:#ffffff60}.consolidated-skills .skill-meter-label{gap:12px;align-items:flex-start}.consolidated-skills .skill-meter-label>span:last-child{white-space:nowrap;flex-shrink:0}.consolidated-skills .skills-progress-label{gap:8px;flex-wrap:wrap}.consolidated-skills button{touch-action:manipulation;min-height:44px}.consolidated-skills main{overflow-x:hidden}.consolidated-skills [class~="min-w-0"]{min-width:0}@media(max-width:480px){.consolidated-skills h2{font-size:26px;line-height:1.2}.consolidated-skills [class~="px-5"]{padding-left:16px;padding-right:16px}.consolidated-skills [class~="grid-cols-5"]{gap:6px}.consolidated-skills button{overflow-wrap:anywhere}}.consolidated-skills .familiarity-indicators{display:flex;gap:7px;margin-top:14px}.consolidated-skills .familiarity-light{display:block;width:23px;height:6px;border-radius:99px;background:#ffffff24;border:1px solid #ffffff30}.consolidated-skills .familiarity-light.is-lit{background:#d7ff00;border-color:#d7ff00;box-shadow:0 0 7px #d7ff0038}.consolidated-skills{position:relative;border:1px solid #ffffff1a;border-radius:24px;background:#0b0b10;color:#f5f5f5;overflow:hidden}.consolidated-skills *{box-sizing:border-box}.consolidated-skills fieldset{border:0;padding:0;margin:0;min-width:0}.consolidated-skills button{font:inherit;cursor:pointer;border-radius:16px;color:inherit}.consolidated-skills button:disabled{cursor:wait;opacity:.55}.consolidated-skills button:focus-visible{outline:3px solid #d7ff00;outline-offset:3px}.consolidated-skills h1,.consolidated-skills h2,.consolidated-skills h3,.consolidated-skills p{margin-bottom:0}.consolidated-skills svg{width:24px;height:24px;flex-shrink:0}.consolidated-skills header>button{width:44px;height:44px}.consolidated-skills .contents{display:contents}.consolidated-skills [class~="relative"]{position:relative}.consolidated-skills [class~="absolute"]{position:absolute}.consolidated-skills [class~="inset-0"]{inset:0;pointer-events:none}.consolidated-skills [class~="flex"]{display:flex}.consolidated-skills [class~="grid"]{display:grid}.consolidated-skills [class~="block"]{display:block}.consolidated-skills [class~="inline-grid"]{display:inline-grid}.consolidated-skills [class~="inline"]{display:inline}.consolidated-skills [class~="flex-col"]{flex-direction:column}.consolidated-skills [class~="flex-1"]{flex:1}.consolidated-skills [class~="flex-shrink-0"]{flex-shrink:0}.consolidated-skills [class~="items-center"]{align-items:center}.consolidated-skills [class~="items-end"]{align-items:flex-end}.consolidated-skills [class~="justify-center"]{justify-content:center}.consolidated-skills [class~="justify-between"]{justify-content:space-between}.consolidated-skills [class~="place-items-center"]{place-items:center}.consolidated-skills [class~="self-center"]{align-self:center}.consolidated-skills [class~="w-full"]{width:100%}.consolidated-skills [class~="h-full"]{height:100%}.consolidated-skills [class~="min-w-0"]{min-width:0}.consolidated-skills [class~="min-h-0"]{min-height:0}.consolidated-skills [class~="overflow-hidden"]{overflow:hidden}.consolidated-skills [class~="overflow-y-auto"]{overflow-y:auto}.consolidated-skills [class~="text-left"]{text-align:left}.consolidated-skills [class~="text-center"]{text-align:center}.consolidated-skills [class~="font-bold"]{font-weight:700}.consolidated-skills [class~="font-semibold"]{font-weight:600}.consolidated-skills [class~="font-black"]{font-weight:800}.consolidated-skills [class~="uppercase"]{text-transform:uppercase}.consolidated-skills [class~="rounded-full"]{border-radius:999px}.consolidated-skills [class~="border"]{border:1px solid #ffffff1a}.consolidated-skills [class~="border-2"]{border:2px solid}.consolidated-skills [class~="grid-cols-5"]{grid-template-columns:repeat(5,minmax(0,1fr))}.consolidated-skills [class~="max-w-3xl"]{max-width:768px}.consolidated-skills [class~="max-w-2xl"]{max-width:672px}.consolidated-skills [class~="max-w-xl"]{max-width:576px}.consolidated-skills [class~="mx-auto"]{margin-left:auto;margin-right:auto}.consolidated-skills [class~="text-xs"]{font-size:12px}.consolidated-skills [class~="text-sm"]{font-size:14px}.consolidated-skills [class~="text-base"]{font-size:16px}.consolidated-skills [class~="text-lg"]{font-size:18px}.consolidated-skills [class~="text-xl"]{font-size:20px}.consolidated-skills [class~="text-2xl"]{font-size:24px}.consolidated-skills [class~="text-3xl"]{font-size:30px;line-height:1.2}.consolidated-skills [class~="text-4xl"]{font-size:36px;line-height:1.2}.consolidated-skills [class~="text-7xl"]{font-size:64px;line-height:1}.consolidated-skills [class~="leading-8"]{line-height:1.7}.consolidated-skills [class~="text-white"]{color:#fff}.consolidated-skills [class~="text-zinc-200"]{color:#e4e4e7}.consolidated-skills [class~="text-zinc-300"]{color:#d4d4d8}.consolidated-skills [class~="text-zinc-400"]{color:#a1a1aa}.consolidated-skills [class~="text-amber-300"]{color:#fcd34d}.consolidated-skills [class~="text-slate-950"]{color:#09090b}.consolidated-skills [class~="text-[#d7ff00]"]{color:#d7ff00}.consolidated-skills [class~="bg-[#d7ff00]"]{background:#d7ff00}.consolidated-skills [class~="bg-[#d7ff00]/10"]{background:#d7ff001a}.consolidated-skills [class~="border-[#d7ff00]"]{border-color:#d7ff00}.consolidated-skills [class~="border-[#d7ff00]/40"]{border-color:#d7ff0066}.consolidated-skills [class~="bg-black/20"]{background:#0003}.consolidated-skills [class~="bg-white/10"]{background:#ffffff1a}.consolidated-skills [class~="bg-white/[0.06]"]{background:#ffffff0f}.consolidated-skills [class~="bg-white/[0.05]"]{background:#ffffff0d}.consolidated-skills [class~="border-white/10"]{border-color:#ffffff1a}.consolidated-skills [class~="transition"]{transition:background .15s,border-color .15s}.consolidated-skills [class~="fill-current"]{fill:currentColor}.consolidated-skills [class~="mt-1"]{margin-top:0.25rem}.consolidated-skills [class~="mb-1"]{margin-bottom:0.25rem}.consolidated-skills [class~="mr-1"]{margin-right:0.25rem}.consolidated-skills [class~="gap-1"]{gap:0.25rem}.consolidated-skills [class~="p-1"]{padding:0.25rem}.consolidated-skills [class~="pt-1"]{padding-top:0.25rem}.consolidated-skills [class~="pb-1"]{padding-bottom:0.25rem}.consolidated-skills [class~="h-1"]{height:0.25rem}.consolidated-skills [class~="w-1"]{width:0.25rem}.consolidated-skills [class~="px-1"]{padding-left:0.25rem;padding-right:0.25rem}.consolidated-skills [class~="py-1"]{padding-top:0.25rem;padding-bottom:0.25rem}.consolidated-skills [class~="mt-2"]{margin-top:0.5rem}.consolidated-skills [class~="mb-2"]{margin-bottom:0.5rem}.consolidated-skills [class~="mr-2"]{margin-right:0.5rem}.consolidated-skills [class~="gap-2"]{gap:0.5rem}.consolidated-skills [class~="p-2"]{padding:0.5rem}.consolidated-skills [class~="pt-2"]{padding-top:0.5rem}.consolidated-skills [class~="pb-2"]{padding-bottom:0.5rem}.consolidated-skills [class~="h-2"]{height:0.5rem}.consolidated-skills [class~="w-2"]{width:0.5rem}.consolidated-skills [class~="px-2"]{padding-left:0.5rem;padding-right:0.5rem}.consolidated-skills [class~="py-2"]{padding-top:0.5rem;padding-bottom:0.5rem}.consolidated-skills [class~="mt-3"]{margin-top:0.75rem}.consolidated-skills [class~="mb-3"]{margin-bottom:0.75rem}.consolidated-skills [class~="mr-3"]{margin-right:0.75rem}.consolidated-skills [class~="gap-3"]{gap:0.75rem}.consolidated-skills [class~="p-3"]{padding:0.75rem}.consolidated-skills [class~="pt-3"]{padding-top:0.75rem}.consolidated-skills [class~="pb-3"]{padding-bottom:0.75rem}.consolidated-skills [class~="h-3"]{height:0.75rem}.consolidated-skills [class~="w-3"]{width:0.75rem}.consolidated-skills [class~="px-3"]{padding-left:0.75rem;padding-right:0.75rem}.consolidated-skills [class~="py-3"]{padding-top:0.75rem;padding-bottom:0.75rem}.consolidated-skills [class~="mt-4"]{margin-top:1.0rem}.consolidated-skills [class~="mb-4"]{margin-bottom:1.0rem}.consolidated-skills [class~="mr-4"]{margin-right:1.0rem}.consolidated-skills [class~="gap-4"]{gap:1.0rem}.consolidated-skills [class~="p-4"]{padding:1.0rem}.consolidated-skills [class~="pt-4"]{padding-top:1.0rem}.consolidated-skills [class~="pb-4"]{padding-bottom:1.0rem}.consolidated-skills [class~="h-4"]{height:1.0rem}.consolidated-skills [class~="w-4"]{width:1.0rem}.consolidated-skills [class~="px-4"]{padding-left:1.0rem;padding-right:1.0rem}.consolidated-skills [class~="py-4"]{padding-top:1.0rem;padding-bottom:1.0rem}.consolidated-skills [class~="mt-5"]{margin-top:1.25rem}.consolidated-skills [class~="mb-5"]{margin-bottom:1.25rem}.consolidated-skills [class~="mr-5"]{margin-right:1.25rem}.consolidated-skills [class~="gap-5"]{gap:1.25rem}.consolidated-skills [class~="p-5"]{padding:1.25rem}.consolidated-skills [class~="pt-5"]{padding-top:1.25rem}.consolidated-skills [class~="pb-5"]{padding-bottom:1.25rem}.consolidated-skills [class~="h-5"]{height:1.25rem}.consolidated-skills [class~="w-5"]{width:1.25rem}.consolidated-skills [class~="px-5"]{padding-left:1.25rem;padding-right:1.25rem}.consolidated-skills [class~="py-5"]{padding-top:1.25rem;padding-bottom:1.25rem}.consolidated-skills [class~="mt-6"]{margin-top:1.5rem}.consolidated-skills [class~="mb-6"]{margin-bottom:1.5rem}.consolidated-skills [class~="mr-6"]{margin-right:1.5rem}.consolidated-skills [class~="gap-6"]{gap:1.5rem}.consolidated-skills [class~="p-6"]{padding:1.5rem}.consolidated-skills [class~="pt-6"]{padding-top:1.5rem}.consolidated-skills [class~="pb-6"]{padding-bottom:1.5rem}.consolidated-skills [class~="h-6"]{height:1.5rem}.consolidated-skills [class~="w-6"]{width:1.5rem}.consolidated-skills [class~="px-6"]{padding-left:1.5rem;padding-right:1.5rem}.consolidated-skills [class~="py-6"]{padding-top:1.5rem;padding-bottom:1.5rem}.consolidated-skills [class~="mt-7"]{margin-top:1.75rem}.consolidated-skills [class~="mb-7"]{margin-bottom:1.75rem}.consolidated-skills [class~="mr-7"]{margin-right:1.75rem}.consolidated-skills [class~="gap-7"]{gap:1.75rem}.consolidated-skills [class~="p-7"]{padding:1.75rem}.consolidated-skills [class~="pt-7"]{padding-top:1.75rem}.consolidated-skills [class~="pb-7"]{padding-bottom:1.75rem}.consolidated-skills [class~="h-7"]{height:1.75rem}.consolidated-skills [class~="w-7"]{width:1.75rem}.consolidated-skills [class~="px-7"]{padding-left:1.75rem;padding-right:1.75rem}.consolidated-skills [class~="py-7"]{padding-top:1.75rem;padding-bottom:1.75rem}.consolidated-skills [class~="mt-8"]{margin-top:2.0rem}.consolidated-skills [class~="mb-8"]{margin-bottom:2.0rem}.consolidated-skills [class~="mr-8"]{margin-right:2.0rem}.consolidated-skills [class~="gap-8"]{gap:2.0rem}.consolidated-skills [class~="p-8"]{padding:2.0rem}.consolidated-skills [class~="pt-8"]{padding-top:2.0rem}.consolidated-skills [class~="pb-8"]{padding-bottom:2.0rem}.consolidated-skills [class~="h-8"]{height:2.0rem}.consolidated-skills [class~="w-8"]{width:2.0rem}.consolidated-skills [class~="px-8"]{padding-left:2.0rem;padding-right:2.0rem}.consolidated-skills [class~="py-8"]{padding-top:2.0rem;padding-bottom:2.0rem}.consolidated-skills [class~="mt-9"]{margin-top:2.25rem}.consolidated-skills [class~="mb-9"]{margin-bottom:2.25rem}.consolidated-skills [class~="mr-9"]{margin-right:2.25rem}.consolidated-skills [class~="gap-9"]{gap:2.25rem}.consolidated-skills [class~="p-9"]{padding:2.25rem}.consolidated-skills [class~="pt-9"]{padding-top:2.25rem}.consolidated-skills [class~="pb-9"]{padding-bottom:2.25rem}.consolidated-skills [class~="h-9"]{height:2.25rem}.consolidated-skills [class~="w-9"]{width:2.25rem}.consolidated-skills [class~="px-9"]{padding-left:2.25rem;padding-right:2.25rem}.consolidated-skills [class~="py-9"]{padding-top:2.25rem;padding-bottom:2.25rem}.consolidated-skills [class~="mt-11"]{margin-top:2.75rem}.consolidated-skills [class~="mb-11"]{margin-bottom:2.75rem}.consolidated-skills [class~="mr-11"]{margin-right:2.75rem}.consolidated-skills [class~="gap-11"]{gap:2.75rem}.consolidated-skills [class~="p-11"]{padding:2.75rem}.consolidated-skills [class~="pt-11"]{padding-top:2.75rem}.consolidated-skills [class~="pb-11"]{padding-bottom:2.75rem}.consolidated-skills [class~="h-11"]{height:2.75rem}.consolidated-skills [class~="w-11"]{width:2.75rem}.consolidated-skills [class~="px-11"]{padding-left:2.75rem;padding-right:2.75rem}.consolidated-skills [class~="py-11"]{padding-top:2.75rem;padding-bottom:2.75rem}.consolidated-skills [class~="mt-12"]{margin-top:3.0rem}.consolidated-skills [class~="mb-12"]{margin-bottom:3.0rem}.consolidated-skills [class~="mr-12"]{margin-right:3.0rem}.consolidated-skills [class~="gap-12"]{gap:3.0rem}.consolidated-skills [class~="p-12"]{padding:3.0rem}.consolidated-skills [class~="pt-12"]{padding-top:3.0rem}.consolidated-skills [class~="pb-12"]{padding-bottom:3.0rem}.consolidated-skills [class~="h-12"]{height:3.0rem}.consolidated-skills [class~="w-12"]{width:3.0rem}.consolidated-skills [class~="px-12"]{padding-left:3.0rem;padding-right:3.0rem}.consolidated-skills [class~="py-12"]{padding-top:3.0rem;padding-bottom:3.0rem}.consolidated-skills [class~="mt-16"]{margin-top:4.0rem}.consolidated-skills [class~="mb-16"]{margin-bottom:4.0rem}.consolidated-skills [class~="mr-16"]{margin-right:4.0rem}.consolidated-skills [class~="gap-16"]{gap:4.0rem}.consolidated-skills [class~="p-16"]{padding:4.0rem}.consolidated-skills [class~="pt-16"]{padding-top:4.0rem}.consolidated-skills [class~="pb-16"]{padding-bottom:4.0rem}.consolidated-skills [class~="h-16"]{height:4.0rem}.consolidated-skills [class~="w-16"]{width:4.0rem}.consolidated-skills [class~="px-16"]{padding-left:4.0rem;padding-right:4.0rem}.consolidated-skills [class~="py-16"]{padding-top:4.0rem;padding-bottom:4.0rem}.consolidated-skills [class~="mt-24"]{margin-top:6.0rem}.consolidated-skills [class~="mb-24"]{margin-bottom:6.0rem}.consolidated-skills [class~="mr-24"]{margin-right:6.0rem}.consolidated-skills [class~="gap-24"]{gap:6.0rem}.consolidated-skills [class~="p-24"]{padding:6.0rem}.consolidated-skills [class~="pt-24"]{padding-top:6.0rem}.consolidated-skills [class~="pb-24"]{padding-bottom:6.0rem}.consolidated-skills [class~="h-24"]{height:6.0rem}.consolidated-skills [class~="w-24"]{width:6.0rem}.consolidated-skills [class~="px-24"]{padding-left:6.0rem;padding-right:6.0rem}.consolidated-skills [class~="py-24"]{padding-top:6.0rem;padding-bottom:6.0rem}.consolidated-skills [class~="mt-32"]{margin-top:8.0rem}.consolidated-skills [class~="mb-32"]{margin-bottom:8.0rem}.consolidated-skills [class~="mr-32"]{margin-right:8.0rem}.consolidated-skills [class~="gap-32"]{gap:8.0rem}.consolidated-skills [class~="p-32"]{padding:8.0rem}.consolidated-skills [class~="pt-32"]{padding-top:8.0rem}.consolidated-skills [class~="pb-32"]{padding-bottom:8.0rem}.consolidated-skills [class~="h-32"]{height:8.0rem}.consolidated-skills [class~="w-32"]{width:8.0rem}.consolidated-skills [class~="px-32"]{padding-left:8.0rem;padding-right:8.0rem}.consolidated-skills [class~="py-32"]{padding-top:8.0rem;padding-bottom:8.0rem}.consolidated-skills [class~="mt-40"]{margin-top:10.0rem}.consolidated-skills [class~="mb-40"]{margin-bottom:10.0rem}.consolidated-skills [class~="mr-40"]{margin-right:10.0rem}.consolidated-skills [class~="gap-40"]{gap:10.0rem}.consolidated-skills [class~="p-40"]{padding:10.0rem}.consolidated-skills [class~="pt-40"]{padding-top:10.0rem}.consolidated-skills [class~="pb-40"]{padding-bottom:10.0rem}.consolidated-skills [class~="h-40"]{height:10.0rem}.consolidated-skills [class~="w-40"]{width:10.0rem}.consolidated-skills [class~="px-40"]{padding-left:10.0rem;padding-right:10.0rem}.consolidated-skills [class~="py-40"]{padding-top:10.0rem;padding-bottom:10.0rem}.consolidated-skills .space-y-2>*+*{margin-top:0.5rem}.consolidated-skills .space-y-3>*+*{margin-top:0.75rem}.consolidated-skills .space-y-6>*+*{margin-top:1.5rem}@media(min-width:640px){.consolidated-skills [class~="sm:grid-cols-2"]{grid-template-columns:repeat(2,minmax(0,1fr))}.consolidated-skills [class~="sm:px-8"]{padding-left:2rem;padding-right:2rem}}`}</style>
      <style>{`
        .consolidated-skills{background:#161c1c;color:#f2f2e7;font-size:18px;line-height:1.5}
        .consolidated-skills.skills-embedded{border:0;border-radius:0;overflow:visible;background:transparent}
        .consolidated-skills.skills-embedded>.absolute{display:none}
        .consolidated-skills.skills-embedded>div.relative{padding:0;max-width:none}
        .consolidated-skills header{gap:12px}
        .consolidated-skills .skills-progress-label{font-size:13px;letter-spacing:.04em;color:#c8cdca;font-weight:500}
        .consolidated-skills header>button{background:transparent;border:0;border-radius:12px}
        .consolidated-skills main{padding-top:28px;padding-bottom:20px;overflow:visible}
        .consolidated-skills .skills-state-page h2{font-size:32px;line-height:1.15;letter-spacing:-.025em}
        .consolidated-skills .skills-state-page>p:first-child{font-size:13px;letter-spacing:.07em;color:#c8cdca}
        .consolidated-skills .skills-mood-options{grid-template-columns:1fr;gap:10px;margin-top:24px}
        .consolidated-skills button.skills-mood-option{min-height:64px;display:flex;gap:14px;align-items:center;padding:14px 18px;border:1px solid #ffffff30;border-radius:16px;background:#ffffff04;text-align:left;font-size:19px;font-weight:500;color:#f2f2e7}
        .consolidated-skills button.skills-mood-option[data-selected="true"]{background:#d4f00012;border-color:#d4f000}
        .consolidated-skills .skills-mood-emoji{font-size:28px;line-height:1}
        .consolidated-skills .skills-radio{margin-left:auto;display:grid;place-items:center;width:23px;height:23px;flex-shrink:0;border:1.5px solid #9aa5a5;border-radius:50%}
        .consolidated-skills [data-selected="true"] .skills-radio{border-color:#d4f000}
        .consolidated-skills .skills-radio>span{width:13px;height:13px;border-radius:50%;background:#d4f000}
        .consolidated-skills .skills-state-note{margin-top:24px;font-size:16px;line-height:1.5;color:#c0c6c3}
        .consolidated-skills .skills-next-note{margin-top:32px;font-size:16px;color:#c0c6c3}
        .consolidated-skills .skills-state-meters{display:grid;gap:28px}
        .consolidated-skills .skill-meter-label{font-size:19px;line-height:1.35;margin-bottom:12px}
        .consolidated-skills .skills-state-meter button{min-height:52px;font-size:19px;font-weight:600}
        .consolidated-skills .skills-state-meter button[aria-pressed="true"]{outline:2px solid #d4f000;outline-offset:3px}
        .consolidated-skills .skills-state-meter button[aria-pressed="true"],.consolidated-skills .skills-state-meter button[class~="bg-[#d7ff00]"]{color:#161c1c}
        .consolidated-skills .skills-meter-anchors{display:flex;justify-content:space-between;font-size:15px;color:#c0c6c3;margin-top:10px}
        .consolidated-skills .skills-action-area{display:block;position:sticky;bottom:0;z-index:2;background:#161c1c;padding:12px 0 max(12px,env(safe-area-inset-bottom))}
        .consolidated-skills .skills-action-area button{min-height:58px;border:0;background:#d4f000;color:#161c1c;font-size:19px}
        .consolidated-skills button[class~="text-base"]{font-size:18px;line-height:1.45}
        .consolidated-skills [class~="text-sm"]{font-size:16px}
        .consolidated-skills.skills-embedded{padding-bottom:108px}.consolidated-skills.skills-embedded .skills-action-area{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:calc(100% - 48px);max-width:632px;z-index:4}@media(max-width:360px){.consolidated-skills.skills-embedded .skills-action-area{width:calc(100% - 36px)}}
        .consolidated-skills h2{font-size:32px;line-height:1.18;letter-spacing:-.025em}
        @media(min-width:700px){.consolidated-skills .skills-state-page h2{font-size:38px}}
      `}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(45,212,191,0.16),transparent_36%),radial-gradient(circle_at_85%_80%,rgba(132,204,22,0.1),transparent_32%)]" />
      <div className="relative mx-auto flex w-full max-w-3xl flex-col px-5 pb-5 pt-6 sm:px-8">
        <header className="flex items-center gap-4">
          <button type="button" onClick={() => void backToSections()} disabled={isSaving} className="grid h-11 w-11 place-items-center rounded-full bg-white/10" aria-label={step === 'state' && statePage > 0 ? 'Back to previous question' : 'Save and return to sections'}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="skills-progress-label flex items-center justify-between text-xs font-bold uppercase tracking-[0.18em] text-[#d7ff00]">
              <span>Your mental skills</span>
              {step !== 'intro' && step !== 'result' ? <span>{completedItems + 1}{step === 'tools' ? `–${precedingItemCount + 16}` : ''} of {totalItems}</span> : null}
            </div>
            <div className="mt-3 h-1 overflow-hidden bg-white/10">
              <motion.div className="h-full bg-[#d7ff00]" animate={{ width: `${progress}%` }} />
            </div>
          </div>
        </header>

        {!embedded && archetype !== 'general' ? (
          <div className="mt-5 self-center bg-[#d7ff00]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#d7ff00]">
            <Sparkles className="mr-2 inline h-4 w-4" /> Personalized for {sportName}
          </div>
        ) : null}

        <main aria-busy={isSaving} ref={contentRef} className="min-h-0 flex-1 overflow-y-auto py-7 [scrollbar-width:none]">
          <fieldset disabled={isSaving} className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.section
              key={step === 'state' ? `state-${statePage}` : step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="mx-auto max-w-2xl"
            >
              {step === 'intro' ? (
                <div className="pt-8 text-center">
                  <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.4, repeat: Infinity }} className="mx-auto grid h-32 w-32 place-items-center rounded-full bg-[#d7ff00]/10">
                    <Brain className="h-16 w-16 text-[#d7ff00]" />
                  </motion.div>
                  <p className="mt-8 text-sm font-bold uppercase tracking-[0.2em] text-[#d7ff00]">Your first mental training session</p>
                  <h1 className="mt-4 text-4xl font-black sm:text-6xl">Show us how you think.</h1>
                  <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-zinc-300">
                    Try a few short mental-skills activities. Your choices help Nora choose where your training starts.
                  </p>
                </div>
              ) : null}

              {step === 'state' ? (
                <div className="skills-state-page">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d7ff00]">How you feel now</p>
                  <h2 className="mt-3 text-3xl font-black sm:text-5xl">{statePages[statePage].title}</h2>
                  <p className="mt-3 text-zinc-300">{statePages[statePage].description}</p>
                  {statePage === 0 ? (
                    <div className="skills-mood-options mt-7 grid gap-2" role="group" aria-label="How you feel right now">
                      {moodOptions.map((option) => (
                        <button key={option.id} type="button" aria-pressed={currentState.mood === option.id} onClick={() => setCurrentState({ ...currentState, mood: option.id })} className="skills-mood-option" data-selected={currentState.mood === option.id}>
                          <span className="skills-mood-emoji" aria-hidden="true">{option.symbol}</span>
                          <span>{option.label}</span>
                          <span className="skills-radio" aria-hidden="true">{currentState.mood === option.id ? <span /> : null}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="skills-state-meters mt-8 space-y-6">
                      {statePages[statePage].fields.map(({ key, label }) => (
                        <Meter key={key} label={label} value={currentState[key]} onChange={(value) => setCurrentState({ ...currentState, [key]: value })} />
                      ))}
                    </div>
                  )}
                  <p className="skills-state-note">Today’s mood is saved separately from your mental skills.</p>
                  <p className="skills-next-note">{statePage === 0 ? 'Up next: Rest and energy' : statePage === 1 ? 'Up next: Confidence and motivation' : statePage === 2 ? 'Up next: How you feel about your sport' : 'Up next: Your experience with mental skills'}</p>
                </div>
              ) : null}

              {step === 'tools' ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d7ff00]">Skill experience</p>
                  <h2 className="mt-3 text-3xl font-black sm:text-5xl">Which skills have you used?</h2>
                  <p className="mt-3 text-zinc-400">Tap each card until the description matches your experience.</p>
                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    {MENTAL_SKILL_FAMILIES.map((family) => {
                      const Icon = familyIcons[family];
                      const currentLevel = familiarity[family];
                      return (
                        <button key={family} type="button" onClick={() => setFamiliarity({ ...familiarity, [family]: nextFamiliarity[currentLevel] })} className="flex items-center gap-4 border border-white/10 bg-white/[0.05] p-4 text-left" aria-label={`${MENTAL_SKILL_FAMILY_LABELS[family]}: ${familiarityLabels[currentLevel]}. Tap to change your answer, currently level ${familiarityLevelPosition(currentLevel)} of ${MENTAL_SKILL_FAMILIARITY_LEVELS.length}.`}>
                          <Icon className="h-7 w-7 text-[#d7ff00]" />
                          <span className="min-w-0 flex-1"><span className="block font-bold">{MENTAL_SKILL_FAMILY_LABELS[family]}</span><span className="mt-1 block text-sm text-[#d7ff00]">{familiarityLabels[currentLevel]}</span><span className="familiarity-indicators" aria-hidden="true">{MENTAL_SKILL_FAMILIARITY_LEVELS.map((level, index) => <span key={level.id} className={`familiarity-light${index < familiarityLevelPosition(currentLevel) ? ' is-lit' : ''}`} />)}</span><span className="mt-2 block text-sm text-zinc-400">Tap to change</span></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {step === 'belief' ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d7ff00]">Challenge 1 · Belief</p>
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
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d7ff00]">Challenge 2 · Reflection</p>
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
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d7ff00]">Challenge 3 · Body awareness</p>
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
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d7ff00]">Breath practice</p>
                  <h2 className="mt-3 text-3xl font-black sm:text-5xl">Breathe in slowly, then breathe out slowly</h2>
                  <button type="button" onClick={() => {
                    setBreathComplete(true);
                  }} className={`mx-auto mt-8 grid h-40 w-40 place-items-center rounded-full border-2 ${breathComplete ? 'border-[#d7ff00] bg-[#d7ff00] text-slate-950' : 'border-[#d7ff00]/40 bg-[#d7ff00]/10 text-[#d7ff00]'}`}>
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
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d7ff00]">Challenge 4 · Visualization</p>
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
                  {visualizationOrder.length ? <button type="button" onClick={() => setVisualizationOrder([])} className="skills-reset mt-4 text-sm font-bold">Start the order again</button> : null}
                </div>
              ) : null}

              {step === 'attention' ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d7ff00]">Challenge 5 · Attention</p>
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
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d7ff00]">Challenge 6 · Self-talk</p>
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
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d7ff00]">Final challenge · Coherence</p>
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
                  {coherenceOrder.length ? <button type="button" onClick={() => setCoherenceOrder([])} className="skills-reset mt-4 text-sm font-bold">Start the order again</button> : null}
                </div>
              ) : null}

              {step === 'result' && result ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d7ff00]">Your starting point</p>
                  <h2 className="mt-3 text-4xl font-black sm:text-6xl">Your mental skills today.</h2>
                  <div className="mt-7 flex items-end gap-4"><span className="text-7xl font-black text-[#d7ff00]">{result.overallCompetencyScore}</span><span className="pb-2 text-zinc-400">mental skill competency</span></div>
                  <p className="mt-3 max-w-xl text-zinc-300">This score shows what you recognized and practiced today. How you feel today stays separate from your skill score.</p>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {MENTAL_SKILL_FAMILIES.map((family) => {
                      const Icon = familyIcons[family];
                      const familyResult = result.familyScores[family];
                      return <div key={family} className="flex items-center gap-4 border border-white/10 bg-white/[0.05] p-4"><Icon className="h-6 w-6 text-[#d7ff00]" /><span className="flex-1"><span className="block font-bold">{MENTAL_SKILL_FAMILY_LABELS[family]}</span><span className="text-sm text-zinc-400">{MENTAL_SKILL_STAGE_LABELS[familyResult.stage]}</span></span><span className="text-xl font-black">{familyResult.score}</span></div>;
                    })}
                  </div>
                  <h3 className="mt-9 text-xl font-black">Your opportunities to improve</h3>
                  <p className="mt-3 text-zinc-300">Your answers suggest these skills have room to grow. You’ll build your skills through your team’s training curriculum.</p>
                  <div className="mt-3 space-y-2">
                    {Object.values(result.disciplineFocus).map((family, index) => <div key={`${family}-${index}`} className="flex items-center gap-3 bg-[#d7ff00]/10 px-4 py-3 font-bold text-white"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#d7ff00] text-slate-950">•</span>{MENTAL_SKILL_FAMILY_LABELS[family]}</div>)}
                  </div>
                </div>
              ) : null}
            </motion.section>
          </AnimatePresence>
          </fieldset>
        </main>

        {saveError ? <p role="alert" className="mb-4 font-semibold text-amber-300">{saveError}</p> : null}
        <fieldset aria-busy={isSaving} className="skills-action-area">
        {action ? (
          <button type="button" aria-busy={isSaving} onClick={() => {
            if (isSaving) return;
            if (action.disabled) {
              setSaveError(step === 'breath' ? 'Take one slow breath, then choose how it went.' : step === 'visualization' || step === 'coherence' ? 'Tap all four steps in the order you choose, then continue.' : 'Choose an answer above, then continue.');
              contentRef.current?.scrollIntoView({block:'start',behavior:'smooth'});
              return;
            }
            setSaveError(null); action.run();
          }} className="flex h-16 w-full items-center justify-center gap-3 bg-[#d7ff00] text-lg font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
            {step === 'intro' ? <Play className="h-5 w-5 fill-current" /> : null}{isSaving ? 'Saving…' : action.label}<ChevronRight className="h-5 w-5" />
          </button>
        ) : step === 'result' ? (
          <button
            type="button"
            aria-busy={isSaving}
            onClick={() => void complete()}
            className="h-16 w-full bg-[#d7ff00] text-lg font-black text-slate-950 disabled:opacity-50"
          >
            {isSaving ? 'Saving your starting point…' : saveError ? 'Try saving again' : 'Complete Performance'}
          </button>
        ) : null}
        </fieldset>
      </div>
    </div>
  );
};

export default ConsolidatedSkillsBaseline;
