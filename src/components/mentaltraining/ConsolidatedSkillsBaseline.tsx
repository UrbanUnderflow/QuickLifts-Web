import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Activity, BookOpen, ChevronDown, Crosshair, Eye, Heart, MessageCircle, Sparkles, Wind } from 'lucide-react';
import { CLAY_BASELINE_THEME } from './clayBaselineTheme';
import { MENTAL_SKILL_FAMILIES, type MentalSkillFamily, type MentalSkillFamiliarity } from '../../api/firebase/mentaltraining/mentalSkillsBaseline';

type Step = 'tools' | 'result';
export interface ConsolidatedSkillsDraft {
  version: 2;
  assessmentKind: 'self_report_starting_profile';
  step: Step;
  familiarity: Record<MentalSkillFamily, MentalSkillFamiliarity>;
  answeredFamiliarity: MentalSkillFamily[];
}
export interface ConsolidatedSkillsBaselineProps {
  embedded?: boolean;
  sportName?: string;
  precedingItemCount?: number;
  initialDraft?: ConsolidatedSkillsDraft | null;
  prefilledFamilies?: MentalSkillFamily[];
  onSaveDraft: (draft: ConsolidatedSkillsDraft) => Promise<void>;
  onComplete: (draft: ConsolidatedSkillsDraft) => Promise<void> | void;
  onBack: () => void;
}
const familyInfo: Record<MentalSkillFamily, { label: string; description: string; Icon: typeof Wind }> = {
  breathing_body_awareness: { label: 'Breathing and body awareness', description: 'Noticing body signals and slowing your breathing.', Icon: Wind },
  visualization: { label: 'Picturing yourself performing', description: 'Imagining a movement or performance before you do it.', Icon: Eye },
  attention_cues: { label: 'Focus cues', description: 'Using a word or action to bring your attention back.', Icon: Crosshair },
  self_talk_reframing: { label: 'What you say to yourself', description: 'Choosing words that help you handle a difficult moment.', Icon: MessageCircle },
  emotional_regulation: { label: 'Handling strong emotions', description: 'Responding when you feel nervous, frustrated, or excited.', Icon: Heart },
  reflection_learning: { label: 'Learning from a performance', description: 'Looking back to decide what to keep or change.', Icon: BookOpen },
  belief_identity: { label: 'Belief in yourself', description: 'Practicing how you respond to doubts about your ability.', Icon: Sparkles },
  coherence: { label: 'Putting your skills together', description: 'Using your breathing, thoughts, and next action together.', Icon: Activity },
};
const familiarityLabels: Record<MentalSkillFamiliarity, string> = {
  new_to_me: 'I have not learned this yet', heard_of_it: 'I have heard of this',
  know_it: 'I understand the basic idea', practiced_it: 'I have tried this in practice', use_it: 'I use this on purpose',
};
const STYLES = `
.consolidated-skills { position: relative; background: var(--paper); color: var(--ink); font-family: var(--sans); font-size: 16px; line-height: 1.5; border-radius: 24px; padding: 24px; min-width: 0; }
.consolidated-skills.skills-embedded { padding: 0 0 120px; border-radius: 0; }
.consolidated-skills * { box-sizing: border-box; }
.consolidated-skills h2, .consolidated-skills p { margin: 0; }
.consolidated-skills button { font: inherit; color: inherit; touch-action: manipulation; -webkit-tap-highlight-color: transparent; cursor: pointer; }
.consolidated-skills button:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.consolidated-skills header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.consolidated-skills .skills-back { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; min-height: 36px; padding: 6px 12px 6px 9px; border-radius: 999px; background: transparent; border: 1.5px solid var(--line-strong); font-size: 14px; font-weight: 600; }
.consolidated-skills .skills-progress-track { position: relative; flex: 1; height: 4px; border-radius: 4px; background: rgba(242,242,232,0.12); overflow: hidden; }
.consolidated-skills .skills-progress-fill { height: 100%; border-radius: 4px; background: var(--ink); transition: width .2s ease; }
.consolidated-skills .skills-count { font-size: 13px; color: var(--ink-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.consolidated-skills h2 { font-family: var(--serif); font-weight: 500; font-size: clamp(24px, 6.6vw, 30px); line-height: 1.2; letter-spacing: -0.01em; margin-bottom: 8px; }
.consolidated-skills .skills-description { font-size: 14px; color: var(--ink-2); margin-bottom: 18px; }
.consolidated-skills .skills-experience-list { display: grid; gap: 10px; }
.consolidated-skills .skills-experience-card { display: grid; gap: 4px; padding: 14px; border-radius: 18px; background: var(--surface); border: 1px solid var(--line); min-width: 0; }
.consolidated-skills .skills-family-heading { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; }
.consolidated-skills .skills-family-heading svg { flex-shrink: 0; width: 18px; height: 18px; }
.consolidated-skills .skills-prefilled { font-size: 12px; color: var(--ink-3); }
.consolidated-skills .skills-pick { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; min-height: 48px; margin-top: 8px; padding: 12px 14px; border-radius: 12px; background: var(--raised); border: 1.5px solid var(--line-strong); font-size: 15px; font-weight: 500; text-align: left; }
.consolidated-skills .skills-pick[data-set="true"] { background: var(--ink); border-color: var(--ink); color: var(--paper); font-weight: 600; }
.consolidated-skills .skills-pick span { min-width: 0; }
.consolidated-skills .skills-pick[data-set="false"] span { color: var(--ink-2); }
.consolidated-skills .skills-pick svg { flex-shrink: 0; }
.consolidated-skills .skills-action-area { padding: 14px 0 max(14px, env(safe-area-inset-bottom)); margin-top: 24px; background: var(--paper); }
.consolidated-skills.skills-embedded .skills-action-area { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: calc(100% - 40px); max-width: 640px; z-index: 4; margin: 0; background: linear-gradient(180deg, rgba(23,27,28,0), var(--paper) 18px); }
.consolidated-skills .skills-action-area > button { width: 100%; min-height: 56px; border: 0; border-radius: 18px; background: var(--lime); color: var(--on-lime); font-size: 16px; font-weight: 800; padding: 14px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.12); }
.consolidated-skills .skills-error { margin-bottom: 12px; padding: 12px 14px; border-radius: 14px; background: rgba(240,149,149,0.1); border: 1px solid rgba(240,149,149,0.3); color: #F7C1C1; font-size: 14px; }
.consolidated-skills fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
.consolidated-skills fieldset:disabled { opacity: 0.7; }
.consolidated-skills .skills-review { margin-top: 20px; border-radius: 16px; border: 1px solid var(--line); background: var(--surface); padding: 0 16px; font-size: 14px; }
.consolidated-skills .skills-review summary { display: flex; align-items: center; min-height: 50px; font-weight: 600; cursor: pointer; }
.consolidated-skills .skills-review p { padding: 10px 0; border-top: 1px solid var(--line); color: var(--ink-2); }
.consolidated-skills .skills-review strong { color: var(--ink); font-weight: 600; }
.skills-sheet-backdrop { position: fixed; inset: 0; z-index: 20; display: flex; align-items: flex-end; justify-content: center; background: rgba(8,10,10,0.6); }
.skills-sheet { width: 100%; max-width: 680px; max-height: 90svh; overflow-y: auto; display: grid; gap: 8px; padding: 10px 16px max(20px, env(safe-area-inset-bottom)); border-radius: 26px 26px 0 0; background: var(--surface); border-top: 1px solid var(--line); }
.skills-sheet-handle { justify-self: center; width: 40px; height: 4px; margin-bottom: 6px; border-radius: 4px; background: var(--line-strong); }
.skills-sheet-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; }
.skills-sheet-title svg { width: 18px; height: 18px; flex-shrink: 0; }
.skills-sheet-description { font-size: 13px; color: var(--ink-3); margin-bottom: 4px; }
.skills-sheet [role="radio"] { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 52px; padding: 13px 16px; border-radius: 14px; background: var(--raised); border: 1px solid var(--line); font-size: 15px; font-weight: 500; text-align: left; }
.skills-sheet [role="radio"][aria-checked="true"] { background: var(--raised-selected); border: 2px solid var(--ink); padding: 12px 15px; font-weight: 600; }
.skills-sheet-radio { width: 20px; height: 20px; flex-shrink: 0; border-radius: 50%; border: 2px solid var(--control); }
.skills-sheet [aria-checked="true"] .skills-sheet-radio { border: 6px solid var(--ink); background: var(--paper); }
.skills-sheet-clear { justify-self: center; min-height: 44px; padding: 10px 16px; background: transparent; border: 0; color: var(--ink-2); font-size: 14px; font-weight: 500; }
@media (hover: hover) { .skills-sheet [role="radio"]:hover { border-color: var(--line-strong); } .consolidated-skills .skills-action-area > button:hover { filter: brightness(1.05); } }
@media (max-width: 360px) { .consolidated-skills.skills-embedded .skills-action-area { width: calc(100% - 32px); } }
`;
export default function ConsolidatedSkillsBaseline({ embedded = false, precedingItemCount = 0, initialDraft, prefilledFamilies = [], onSaveDraft, onComplete, onBack }: ConsolidatedSkillsBaselineProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>(() => initialDraft?.version === 2 && initialDraft.step === 'result' ? 'result' : 'tools');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [familiarity, setFamiliarity] = useState<Record<MentalSkillFamily,MentalSkillFamiliarity>>(initialDraft?.familiarity ?? Object.fromEntries(MENTAL_SKILL_FAMILIES.map(f => [f,'new_to_me'])) as Record<MentalSkillFamily,MentalSkillFamiliarity>);
  const [answeredFamiliarity, setAnsweredFamiliarity] = useState<MentalSkillFamily[]>(() => initialDraft?.answeredFamiliarity ?? MENTAL_SKILL_FAMILIES.filter(f => initialDraft?.familiarity?.[f] && initialDraft.familiarity[f] !== 'new_to_me'));
  const [picking, setPicking] = useState<MentalSkillFamily | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const pickerTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!picking) return;
    (sheetRef.current?.querySelector('[aria-checked="true"]') as HTMLElement | null ?? sheetRef.current?.querySelector('[role="radio"]') as HTMLElement | null)?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') closePicker(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [picking]);
  const closePicker = () => { setPicking(null); pickerTrigger.current?.focus(); };
  const pick = (family: MentalSkillFamily, value: MentalSkillFamiliarity | null) => {
    if (value) { setFamiliarity(s => ({...s, [family]: value})); setAnsweredFamiliarity(s => s.includes(family) ? s : [...s, family]); }
    else setAnsweredFamiliarity(s => s.filter(x => x !== family));
    closePicker();
  };
  const total = precedingItemCount + 8;
  const answered = step === 'result' ? total : precedingItemCount;
  useEffect(() => { rootRef.current?.scrollIntoView({block:'start',behavior:'smooth'}); }, [step]);
  const draft = (next: Step = step): ConsolidatedSkillsDraft => ({version:2,assessmentKind:'self_report_starting_profile',step:next,familiarity,answeredFamiliarity});
  const saveAndMove = async () => {
    if (isSaving) return;
    setIsSaving(true); setError('');
    try {
      if (step === 'result') { await onComplete(draft('result')); return; }
      const next: Step = 'result';
      await onSaveDraft(draft(next));
      setStep(next);
    } catch { setError('Your answers could not be saved. Please try Continue again.'); }
    finally { setIsSaving(false); }
  };
  const back = async () => {
    if (isSaving) return;
    setError('');
    if (step === 'result') { setStep('tools'); return; }
    setIsSaving(true);
    try { await onSaveDraft(draft()); onBack(); }
    catch { setError('Your answers could not be saved. Please try again.'); }
    finally { setIsSaving(false); }
  };
  const picked = picking ? familyInfo[picking] : null;
  return <div ref={rootRef} className={`consolidated-skills clay-baseline ${embedded ? 'skills-embedded' : ''}`}>
    <style>{CLAY_BASELINE_THEME + STYLES}</style>
    <header>
      <button type="button" className="skills-back" aria-label="Previous question" onClick={()=>void back()}><ArrowLeft size={16} aria-hidden="true"/>Back</button>
      <div className="skills-progress-track" role="progressbar" aria-label="Mental skills progress" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={total}><div className="skills-progress-fill" style={{width:`${answered/total*100}%`}}/></div>
      <span className="skills-count">{step === 'result' ? `${total} of ${total}` : `${answered+1} of ${total}`}</span>
    </header>
    <fieldset disabled={isSaving}>
      {step === 'tools' && <section>
        <h2>How much have you used each skill?</h2>
        <p className="skills-description">Tap a skill to choose. You can leave any blank.</p>
        <div className="skills-experience-list">{MENTAL_SKILL_FAMILIES.map(f=>{const {label,Icon}=familyInfo[f];const set=answeredFamiliarity.includes(f);return <div key={f} className="skills-experience-card">
          <span className="skills-family-heading"><Icon aria-hidden="true"/>{label}</span>
          {prefilledFamilies.includes(f) && initialDraft?.familiarity[f] === familiarity[f] && set && <p className="skills-prefilled">Prefilled from your previous baseline</p>}
          <button type="button" className="skills-pick" data-set={set} aria-haspopup="dialog" aria-label={`${label} experience: ${set ? familiarityLabels[familiarity[f]] : 'not answered'}`} onClick={e=>{pickerTrigger.current=e.currentTarget;setPicking(f);}}><span>{set ? familiarityLabels[familiarity[f]] : 'Choose an answer'}</span><ChevronDown size={18} aria-hidden="true"/></button>
        </div>;})}</div>
      </section>}
      {step === 'result' && <section><h2>Your experience is saved.</h2><p className="skills-description">We’ll use your goals and experience to choose a first practice. Your plan can change as you train.</p><details className="skills-review"><summary>Review your experience</summary>{MENTAL_SKILL_FAMILIES.map(f=><p key={f}><strong>{familyInfo[f].label}</strong><br/>{answeredFamiliarity.includes(f)?familiarityLabels[familiarity[f]]:'Not answered'}</p>)}</details></section>}
    </fieldset>
    <div className="skills-action-area">{error&&<p className="skills-error" role="alert">{error}</p>}<button type="button" aria-busy={isSaving} onClick={()=>void saveAndMove()}>{isSaving?'Saving…':step==='result'?'Complete Performance':'Continue'}</button></div>
    {picking && picked && <div className="skills-sheet-backdrop" onClick={closePicker}>
      <div ref={sheetRef} className="skills-sheet" role="dialog" aria-modal="true" aria-labelledby="skills-sheet-title" onClick={e=>e.stopPropagation()}>
        <span className="skills-sheet-handle" aria-hidden="true"/>
        <p id="skills-sheet-title" className="skills-sheet-title"><picked.Icon aria-hidden="true"/>{picked.label}</p>
        <p className="skills-sheet-description">{picked.description}</p>
        <div role="radiogroup" aria-labelledby="skills-sheet-title" style={{display:'grid',gap:8}}>
          {(Object.entries(familiarityLabels) as [MentalSkillFamiliarity,string][]).map(([v,label])=>{const checked=answeredFamiliarity.includes(picking)&&familiarity[picking]===v;return <button key={v} type="button" role="radio" aria-checked={checked} onClick={()=>pick(picking,v)}>{label}<span className="skills-sheet-radio" aria-hidden="true"/></button>;})}
        </div>
        {answeredFamiliarity.includes(picking) && <button type="button" className="skills-sheet-clear" onClick={()=>pick(picking,null)}>Clear answer</button>}
      </div>
    </div>}
  </div>;
}
