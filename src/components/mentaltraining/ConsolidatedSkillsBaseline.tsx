import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Activity, BookOpen, Crosshair, Eye, Heart, MessageCircle, Sparkles, Wind } from 'lucide-react';
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
  belief_identity: { label: 'Belief in yourself', description: 'Practising how you respond to doubts about your ability.', Icon: Sparkles },
  coherence: { label: 'Putting your skills together', description: 'Using your breathing, thoughts, and next action together.', Icon: Activity },
};
const familiarityLabels: Record<MentalSkillFamiliarity, string> = {
  new_to_me: 'I have not learned this yet', heard_of_it: 'I have heard of this',
  know_it: 'I understand the basic idea', practiced_it: 'I have tried this in practice', use_it: 'I use this on purpose',
};
const STYLES = `
.consolidated-skills{position:relative;background:#161c1c;color:#f2f2e7;font:18px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;border-radius:24px;padding:24px;min-width:0}
.consolidated-skills.skills-embedded{padding:0 0 108px;border:0;border-radius:0}
.consolidated-skills *{box-sizing:border-box}.consolidated-skills h2,.consolidated-skills p{margin:0}
.consolidated-skills button,.consolidated-skills select{font:inherit;touch-action:manipulation}
.consolidated-skills button{cursor:pointer}.consolidated-skills button:focus-visible,.consolidated-skills select:focus-visible{outline:3px solid #d4f000;outline-offset:3px}
.consolidated-skills header{display:flex;gap:12px;align-items:center;margin-bottom:28px}
.consolidated-skills header>button{display:grid;place-items:center;flex-shrink:0;width:44px;height:44px;background:#ffffff10;border:0;border-radius:50%;color:inherit}
.consolidated-skills .skills-progress{flex:1;min-width:0}.consolidated-skills .skills-progress-label{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:13px;letter-spacing:.04em;color:#c8cdca;text-transform:uppercase}
.consolidated-skills .skills-progress-track{height:4px;background:#ffffff15;margin-top:12px;overflow:hidden}.consolidated-skills .skills-progress-fill{height:100%;background:#d4f000;transition:width .2s}
.consolidated-skills .skills-eyebrow{font-size:13px;letter-spacing:.07em;color:#c8cdca;text-transform:uppercase;margin-bottom:12px}
.consolidated-skills h2{font-size:32px;line-height:1.15;letter-spacing:-.025em;margin-bottom:14px;font-weight:750}
.consolidated-skills .skills-description{color:#d5dcd8;margin-bottom:24px}.consolidated-skills .skills-experience-list{display:grid;gap:16px}.consolidated-skills .skills-experience-card{border:1px solid #ffffff25;border-radius:16px;padding:16px;display:grid;gap:12px;background:#ffffff04;min-width:0}
.consolidated-skills .skills-family-heading{display:flex;align-items:center;gap:12px;font-weight:650;font-size:19px}.consolidated-skills .skills-family-heading svg{color:#d4f000;flex-shrink:0;width:24px;height:24px}
.consolidated-skills .skills-experience-card p{font-size:16px;color:#c5cfca}.consolidated-skills select{width:100%;min-width:0;min-height:52px;border:1px solid #85928c;border-radius:12px;background:#202a27;color:#f2f2e7;padding:10px;font-size:16px}
.consolidated-skills .skills-action-area{background:#161c1c;padding:12px 0 max(12px,env(safe-area-inset-bottom));margin-top:28px}
.consolidated-skills.skills-embedded .skills-action-area{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:calc(100% - 48px);max-width:632px;z-index:4;margin:0}
.consolidated-skills .skills-action-area>button{width:100%;min-height:58px;border:0;border-radius:16px;background:#d4f000;color:#161c1c;font-size:19px;font-weight:700;padding:14px}
.consolidated-skills .skills-error{margin-bottom:12px;padding:12px;border:1px solid #fca5a580;color:#fca5a5;border-radius:12px;background:#311e1e;font-size:17px}
.consolidated-skills fieldset{border:0;margin:0;padding:0;min-width:0}.consolidated-skills fieldset:disabled{opacity:.7}
.consolidated-skills .skills-review{margin-top:24px;font-size:16px}.consolidated-skills .skills-review summary{cursor:pointer;min-height:44px}.consolidated-skills .skills-review p{padding:10px 0;border-bottom:1px solid #ffffff15;color:#d5dcd8}
@media(max-width:360px){.consolidated-skills.skills-embedded .skills-action-area{width:calc(100% - 36px)}}
`;
export default function ConsolidatedSkillsBaseline({ embedded = false, precedingItemCount = 0, initialDraft, onSaveDraft, onComplete, onBack }: ConsolidatedSkillsBaselineProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>(() => initialDraft?.version === 2 && initialDraft.step === 'result' ? 'result' : 'tools');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [familiarity, setFamiliarity] = useState<Record<MentalSkillFamily,MentalSkillFamiliarity>>(initialDraft?.familiarity ?? Object.fromEntries(MENTAL_SKILL_FAMILIES.map(f => [f,'new_to_me'])) as Record<MentalSkillFamily,MentalSkillFamiliarity>);
  const [answeredFamiliarity, setAnsweredFamiliarity] = useState<MentalSkillFamily[]>(() => initialDraft?.answeredFamiliarity ?? MENTAL_SKILL_FAMILIES.filter(f => initialDraft?.familiarity?.[f] && initialDraft.familiarity[f] !== 'new_to_me'));
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
  return <div ref={rootRef} className={`consolidated-skills ${embedded ? 'skills-embedded' : ''}`}>
    <style>{STYLES}</style>
    <header><button type="button" aria-label="Previous question" onClick={()=>void back()}><ArrowLeft size={22}/></button><div className="skills-progress"><div className="skills-progress-label"><span>Your mental skills</span><span>{step === 'result' ? `${total} of ${total}` : `${answered+1} of ${total}`}</span></div><div className="skills-progress-track" role="progressbar" aria-label="Mental skills progress" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={total}><div className="skills-progress-fill" style={{width:`${answered/total*100}%`}}/></div></div></header>
    <fieldset disabled={isSaving}>
      {step === 'tools' && <section><p className="skills-eyebrow">Your experience</p><h2>Which skills have you tried?</h2><p className="skills-description">Choose what fits your experience with each skill. You can leave any unanswered.</p><div className="skills-experience-list">{MENTAL_SKILL_FAMILIES.map(f=>{const {label,description,Icon}=familyInfo[f];return <label key={f} className="skills-experience-card"><span className="skills-family-heading"><Icon/>{label}</span><p>{description}</p><select aria-label={`${label} experience`} value={answeredFamiliarity.includes(f)?familiarity[f]:''} onChange={e=>{const v=e.target.value as MentalSkillFamiliarity;if(v){setFamiliarity(s=>({...s,[f]:v}));setAnsweredFamiliarity(s=>s.includes(f)?s:[...s,f]);}else setAnsweredFamiliarity(s=>s.filter(x=>x!==f));}}><option value="">Not answered</option>{Object.entries(familiarityLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>;})}</div></section>}
      {step === 'result' && <section><p className="skills-eyebrow">Your starting profile</p><h2>Your experience is saved.</h2><p className="skills-description">We’ll use your goals and experience to choose a first practice. Your plan can change as you train.</p><details className="skills-review"><summary>Review your experience</summary>{MENTAL_SKILL_FAMILIES.map(f=><p key={f}><strong>{familyInfo[f].label}</strong><br/>{answeredFamiliarity.includes(f)?familiarityLabels[familiarity[f]]:'Not answered'}</p>)}</details></section>}
    </fieldset>
    <div className="skills-action-area">{error&&<p className="skills-error" role="alert">{error}</p>}<button type="button" aria-busy={isSaving} onClick={()=>void saveAndMove()}>{isSaving?'Saving…':step==='result'?'Complete Performance':'Continue'}</button></div>
  </div>;
}
