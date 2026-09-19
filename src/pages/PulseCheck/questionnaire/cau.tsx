import { isDerivedQuestion, isRemovedQuestion } from '../../../lib/questionnaires/cau-derived';
import ConsolidatedSkillsBaseline, { ConsolidatedSkillsDraft } from '../../../components/mentaltraining/ConsolidatedSkillsBaseline';
import { VERSION } from '../../../lib/questionnaires/cau';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { auth, isUsingDevFirebase } from '../../../api/firebase/config';
import { questionCustodian, questionVisible } from '../../../lib/questionnaires/cau-routing';
import Head from 'next/head';
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronRight,
  Clock, Copy, HeartPulse, Loader2, LogOut, Pencil, Target,
} from 'lucide-react';
import source from '../../../content/questionnaires/cau-operational.json';

// Preserve source items; the user requested name and email in place of onboarding ID.
const allQuestions = source.questions.filter(q => q.id !== 'cau-operational-04' && !isDerivedQuestion(q.id) && !isRemovedQuestion(q.id));

export function getServerSideProps({ res }: any) {
  res.setHeader('Cache-Control', 'no-store');
  return { props: { collectionEnabled: process.env.CAU_QUESTIONNAIRE_COLLECTION_ENABLED === 'true' } };
}

type TestReceipt = { baselineId?: string; athleteId?: string; externalId?: string; submissionId?: string; receivedAt?: string; requestId?: string };

// ─────────────────────────────────────────────────────────────────────────
// This page ships two ways: through the normal Next.js/Tailwind build, and
// through scripts/build-cau-team-test.cjs, a standalone esbuild bundle for
// the internal sandbox deploy that never loads Tailwind or globals.css. So
// every style here is either an inline style object or lives in the <style>
// tag below — nothing depends on a CSS build step.
// ─────────────────────────────────────────────────────────────────────────

const STYLES = `
.cau-shell, .cau-shell *, .cau-shell *::before, .cau-shell *::after { box-sizing: border-box; }
.cau-shell h1, .cau-shell h2, .cau-shell p { margin: 0; }
.cau-shell button, .cau-shell input, .cau-shell textarea { font-family: inherit; }
.cau-shell ::selection { background: rgba(224,254,16,0.35); }

.cau-accent-performance { --accent: #E0FE10; --accent-deep: #A6C900; --accent-soft: rgba(224,254,16,0.12); --accent-text: #0A0F02; }
.cau-accent-health { --accent: #A78BFA; --accent-deep: #7C5CFC; --accent-soft: rgba(167,139,250,0.14); --accent-text: #0B0714; }

.cau-h1 { font-size: 26px; font-weight: 700; line-height: 1.2; color: #F5F6F2; letter-spacing: -0.01em; }
.cau-h2 { font-size: 15px; font-weight: 700; color: #F5F6F2; }
.cau-body { font-size: 15px; line-height: 1.65; color: rgba(245,246,242,0.72); }
.cau-body-sm { font-size: 13.5px; line-height: 1.55; color: rgba(245,246,242,0.72); }
.cau-muted { font-size: 14px; color: rgba(245,246,242,0.55); }
.cau-muted-sm { font-size: 13px; line-height: 1.6; color: rgba(245,246,242,0.55); }
.cau-pre-line { white-space: pre-line; }

.cau-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(245,246,242,0.5); }

.cau-stage { display: grid; gap: 18px; }
.cau-stage-center { justify-items: center; text-align: center; padding: 12px 0 4px; }

.cau-form { display: grid; gap: 16px; }
.cau-field { display: grid; gap: 8px; }
.cau-field-label { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(245,246,242,0.5); }

.cau-input { width: 100%; padding: 13px 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.09); background: rgba(255,255,255,0.04); color: #F5F6F2; font-size: 15px; outline: none; transition: border-color .18s ease, background-color .18s ease; }
.cau-input:focus { border-color: var(--accent, #E0FE10); background: rgba(255,255,255,0.06); }
.cau-input::placeholder { color: rgba(245,246,242,0.32); }
.cau-input:read-only { opacity: 0.65; }
.cau-textarea { resize: vertical; min-height: 96px; line-height: 1.5; }
.cau-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; line-height: 1.6; }

.cau-btn { box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 14px 18px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.09); background: rgba(255,255,255,0.04); color: #F5F6F2; font-size: 15px; font-weight: 500; cursor: pointer; transition: border-color .18s ease, background-color .18s ease, transform .12s ease, box-shadow .18s ease, opacity .18s ease; text-align: center; -webkit-tap-highlight-color: transparent; }
.cau-btn:hover:not(:disabled) { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.075); }
.cau-btn:active:not(:disabled) { transform: scale(0.985); }
.cau-btn:focus-visible { outline: 2px solid var(--accent, #E0FE10); outline-offset: 2px; }
.cau-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.cau-btn-primary { border: none; color: var(--accent-text, #0A0F02); font-weight: 700; background: linear-gradient(135deg, var(--accent, #E0FE10), var(--accent-deep, #A6C900)); box-shadow: 0 4px 20px rgba(224,254,16,0.2); }
.cau-btn-primary:hover:not(:disabled) { filter: brightness(1.08); border-color: transparent; background: linear-gradient(135deg, var(--accent, #E0FE10), var(--accent-deep, #A6C900)); }

.cau-btn-ghost { width: auto; background: transparent; border-color: transparent; color: rgba(245,246,242,0.6); padding: 10px 4px; font-size: 13.5px; font-weight: 500; }
.cau-btn-ghost:hover:not(:disabled) { background: transparent; border-color: transparent; color: #F5F6F2; }

.cau-choice-list { display: grid; gap: 10px; }
.cau-choice-btn, .cau-shell button.cau-choice-btn { justify-content: space-between; text-align: left; font-weight: 500; }
.cau-choice-btn[data-selected="true"] { border-color: var(--accent, #E0FE10); background: var(--accent-soft, rgba(224,254,16,0.12)); color: #F5F6F2; }
.cau-choice-check { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 999px; background: var(--accent, #E0FE10); color: var(--accent-text, #0A0F02); flex-shrink: 0; }

.cau-date-picks { display: grid; gap: 10px; }

.cau-nav-row { display: flex; gap: 12px; }
.cau-nav-row .cau-btn-ghost { flex: 0 0 auto; justify-content: flex-start; padding: 14px 4px; }
.cau-nav-row .cau-btn-primary { flex: 1; }

.cau-question-top { display: flex; }
.cau-question-top .cau-btn-ghost { padding: 8px 0; }

.cau-progress-track { position: relative; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; }
.cau-progress-fill { position: absolute; inset: 0 auto 0 0; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--accent, #E0FE10), var(--accent-deep, #A6C900)); }
.cau-step-label { font-size: 12.5px; font-weight: 600; letter-spacing: 0.04em; color: rgba(245,246,242,0.45); }
.cau-question-title { font-size: 23px; font-weight: 700; line-height: 1.28; color: #F5F6F2; letter-spacing: -0.01em; }

.cau-track-list { display: grid; gap: 12px; }
.cau-track-card, .cau-shell button.cau-track-card { justify-content: flex-start; text-align: left; gap: 16px; padding: 18px; }
.cau-track-card:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 30px rgba(0,0,0,0.25); }
.cau-track-card[data-selected="true"] { border-color: var(--accent, #E0FE10); background: var(--accent-soft, rgba(224,254,16,0.12)); }
.cau-track-icon { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 12px; background: var(--accent-soft, rgba(224,254,16,0.12)); color: var(--accent, #E0FE10); flex-shrink: 0; }
.cau-track-copy { display: grid; gap: 3px; flex: 1; min-width: 0; }
.cau-track-title { display: flex; align-items: center; gap: 6px; font-size: 15.5px; font-weight: 700; color: #F5F6F2; }
.cau-track-status { font-size: 12.5px; color: rgba(245,246,242,0.5); }
.cau-track-chevron { flex-shrink: 0; color: rgba(245,246,242,0.35); }

.cau-note { display: grid; gap: 12px; padding: 14px 16px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); }
.cau-checkbox-row { position: relative; display: flex; align-items: flex-start; gap: 12px; cursor: pointer; }
.cau-checkbox-input { position: absolute; inset: 0; width: 20px; height: 20px; opacity: 0; margin: 0; cursor: pointer; }
.cau-checkbox-box { width: 20px; height: 20px; margin-top: 1px; border-radius: 6px; border: 1.5px solid rgba(255,255,255,0.26); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; color: transparent; transition: background-color .15s ease, border-color .15s ease, color .15s ease; }
.cau-checkbox-input:checked + .cau-checkbox-box { background: var(--accent, #E0FE10); border-color: var(--accent, #E0FE10); color: var(--accent-text, #0A0F02); }
.cau-checkbox-input:focus-visible + .cau-checkbox-box { outline: 2px solid var(--accent, #E0FE10); outline-offset: 2px; }

.cau-disclosure { border-radius: 14px; border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); overflow: hidden; }
.cau-disclosure-summary { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 16px; background: transparent; border: none; color: rgba(245,246,242,0.75); font-size: 13.5px; font-weight: 600; cursor: pointer; text-align: left; }
.cau-disclosure-summary:hover { color: #F5F6F2; }
.cau-disclosure-body { overflow: hidden; }
.cau-disclosure-inner { padding: 0 16px 16px; }

.cau-review-list { display: grid; gap: 4px; }
.cau-review-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid rgba(255,255,255,0.06); }
.cau-review-item:first-child { border-top: none; }
.cau-review-q { font-size: 13.5px; font-weight: 600; color: #F5F6F2; margin-bottom: 3px; }
.cau-review-a { font-size: 13px; color: rgba(245,246,242,0.55); }
.cau-icon-btn { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.09); background: rgba(255,255,255,0.03); color: rgba(245,246,242,0.6); cursor: pointer; transition: border-color .15s ease, color .15s ease; }
.cau-icon-btn:hover { border-color: rgba(255,255,255,0.2); color: #F5F6F2; }

.cau-error { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 12px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.22); color: #FCA5A5; font-size: 13.5px; line-height: 1.5; overflow: hidden; }

.cau-sandbox-banner { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 14px; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.28); color: #FDE68A; font-size: 13.5px; line-height: 1.55; }
.cau-sandbox-banner svg { flex-shrink: 0; margin-top: 1px; color: #FBBF24; }

.cau-success-badge { display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 999px; background: var(--accent-soft, rgba(224,254,16,0.12)); color: var(--accent, #E0FE10); }
.cau-empty-icon { display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 999px; background: rgba(255,255,255,0.05); color: rgba(245,246,242,0.5); }

.cau-receipt { display: grid; gap: 10px; text-align: left; width: 100%; }
.cau-receipt-head { display: flex; align-items: center; justify-content: space-between; }
.cau-copy-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: rgba(245,246,242,0.75); font-size: 12.5px; font-weight: 600; cursor: pointer; transition: border-color .15s ease, color .15s ease; }
.cau-copy-btn:hover { border-color: rgba(255,255,255,0.22); color: #F5F6F2; }

.cau-crisis-line { font-size: 12.5px; color: rgba(245,246,242,0.4); text-align: center; }
.cau-crisis-line a { color: rgba(245,246,242,0.65); text-decoration: underline; text-underline-offset: 2px; }
.cau-crisis-line a:hover { color: #F5F6F2; }

@keyframes cau-spin { to { transform: rotate(360deg); } }
.cau-spinner { animation: cau-spin 0.8s linear infinite; }

@media (max-width: 480px) {
  .cau-h1 { font-size: 22px; }
  .cau-input { font-size: 16px; min-width: 0; }
  .cau-icon-btn { width: 44px; height: 44px; }
  .cau-btn { min-height: 44px; touch-action: manipulation; }
  .cau-track-title { flex-wrap: wrap; }
  .cau-question-title { font-size: 20px; }
}
`;

const fadeMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
};

const listVariants = { hidden: {}, show: { transition: { staggerChildren: 0.045 } } };
const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };
const questionVariants = {
  enter: (d: number) => ({ opacity: 0, x: d >= 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d >= 0 ? -28 : 28 }),
};

function Spinner() {
  return <Loader2 size={22} className="cau-spinner" aria-hidden="true" />;
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="cau-error" role="alert">
      <AlertCircle size={15} />
      <span>{children}</span>
    </motion.div>
  );
}

function Disclosure({ summary, children }: { summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cau-disclosure">
      <button type="button" className="cau-disclosure-summary" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span>{summary}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown size={15} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="cau-disclosure-body"
          >
            <div className="cau-disclosure-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CAUQuestionnaire({ collectionEnabled, sandboxTest = false }: { collectionEnabled: boolean; sandboxTest?: boolean }) {
  const endpoint = sandboxTest ? '/api/pulsecheck/questionnaire/cau-team-test' : '/api/pulsecheck/questionnaire/cau';
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [receipt, setReceipt] = useState<TestReceipt | null>(null);
  const [priorSubmission, setPriorSubmission] = useState(false);
  const [skillsState, setSkillsState] = useState<any>(null);
  const skillsRevision = useRef(0);
  const [showSkills, setShowSkills] = useState(false);
  const [performanceQuestionsComplete, setPerformanceQuestionsComplete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const draftBusy = useRef(false);
  const draftRevision = useRef(0);
  const testHeaders = (): Record<string, string> => sandboxTest ? {'X-Questionnaire-Test': sessionStorage.getItem('cau-team-test-invite') || ''} : {};
  useEffect(() => {
    if (!sandboxTest) return;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('test');
    if (token) {
      sessionStorage.setItem('cau-team-test-invite', token);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [sandboxTest]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [status, setStatus] = useState<{available: boolean; completed: boolean; healthSharingAllowed: boolean} | null>(null);
  const [shareHealth, setShareHealth] = useState(true);
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const sessionUid = useRef<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, next => {
    sessionUid.current = next?.uid || null;
    setPriorSubmission(false);skillsRevision.current=0;setSkillsState(null);setShowSkills(false);setPerformanceQuestionsComplete(false);
    draftRevision.current = 0; draftBusy.current = false; setDraftSaving(false); setDraftSaved(false);
    setSignOutError(''); setUser(next); setAuthReady(true); setStatus(null); setAnswers({}); setStarted(false);
    setCompleted({performance:false,health:false}); setPositions({performance:0,health:0}); setIndex(0); setTrack(null);
    clearTimeout(timer.current); setReceipt(null); setSaved(false); setSaving(false); setSubmittedOnce(false); setShareHealth(true); setError('');
    setName(sandboxTest ? '' : next?.displayName || ''); setEmail(next?.email || '');
    if (next) next.getIdToken().then(token => fetch(endpoint, {
      headers: {...testHeaders(), Authorization: `Bearer ${token}`, 'X-PulseCheck-Firebase-Mode': isUsingDevFirebase() ? 'dev' : 'prod'},
    })).then(async response => { const result = await response.json(); if (!response.ok) throw Error(result.error || 'Could not check your questionnaire. Refresh to try again.'); return result; })
      .then(result => { if (sessionUid.current === next.uid) {setStatus(result);setSaved(result.completed);setShareHealth(result.healthSharingAllowed);setReceipt(result.receipt || null);
        setPriorSubmission(result.questionnaireSubmitted === true);setSkillsState(result.skills || null);skillsRevision.current=result.skills?.revision || 0;
        if (result.draft?.version === VERSION && !result.completed) {
          const draft = result.draft; draftRevision.current = draft.revision;
          setAnswers(draft.answers); setName(draft.name); setStarted(true); setDraftSaved(true);
          setPerformanceQuestionsComplete(draft.completed);
          setCompleted({performance:draft.completed && result.skills?.completed===true,health:result.questionnaireSubmitted === true});
          const oldPerformance = source.questions.filter(q => q.id !== 'cau-operational-04' && questionCustodian(q.id) === 'PulseCheck');
          const performance = allQuestions.filter(q=>questionCustodian(q.id)==='PulseCheck');
          const previousOrder = draft.flowVersion === 2 ? oldPerformance.filter(q=>!isDerivedQuestion(q.id)) : oldPerformance;
          const resume = draft.flowVersion === 3 ? Math.min(draft.position,performance.length-1) : Math.min(previousOrder.slice(0,draft.position).filter(q=>!isDerivedQuestion(q.id) && !isRemovedQuestion(q.id)).length,performance.length-1);
          setPositions({performance:resume,health:0});
          if (!draft.completed) {setTrack('performance');setIndex(resume);}
          else if (!result.skills?.completed) setShowSkills(true);
        }} })
      .catch(e => { if (sessionUid.current === next.uid) setError(e.message || 'Could not check your questionnaire. Refresh to try again.'); });
  }), [sandboxTest]);
  const [started, setStarted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [track, setTrack] = useState<'performance' | 'health' | null>(null);
  const [completed, setCompleted] = useState({ performance: false, health: false });
  const [positions, setPositions] = useState({ performance: 0, health: 0 });
  const isHealth = (q: typeof allQuestions[number]) => questionCustodian(q.id) === 'auntEDNA';
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [error, setError] = useState('');
  const questions = allQuestions.filter(q => (track === 'health' ? isHealth(q) : !isHealth(q)) && questionVisible(q.id, answers));
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const q = questions[index];
  const value = q && answers[q.id];
  useEffect(() => () => clearTimeout(timer.current), []);
  const move = async (next: number, currentAnswers = answers) => {
    if (draftBusy.current) return;
    clearTimeout(timer.current); setError(''); setDir(next >= index ? 1 : -1);
    if (!track) return;
    if (track === 'performance' && user) {
      const uid = user.uid;
      draftBusy.current = true; setDraftSaving(true); setDraftSaved(false);
      try {
        const performanceAnswers = Object.fromEntries(Object.entries(currentAnswers).filter(([id]) => questionCustodian(id) === 'PulseCheck'));
        const response = await fetch(endpoint, {method:'POST',signal:AbortSignal.timeout(20000),headers:{...testHeaders(),'Content-Type':'application/json',Authorization:`Bearer ${await user.getIdToken()}`,'X-PulseCheck-Firebase-Mode':isUsingDevFirebase() ? 'dev' : 'prod'},body:JSON.stringify({action:'savePerformanceDraft',draft:{flowVersion:3,version:VERSION,name,answers:performanceAnswers,position:next >= questions.length ? 0 : next,completed:next >= questions.length,revision:draftRevision.current}})});
        const result = await response.json();
        if (!response.ok || !result.draft) throw Error(result.error || 'Could not save progress. Press Continue to retry.');
        if (sessionUid.current !== uid) return;
        draftRevision.current = result.draft.revision; setDraftSaved(true);
      } catch (e) {if (sessionUid.current === uid) setError(e instanceof Error ? e.message : 'Could not save progress. Press Continue to retry.');return;}
      finally {if (sessionUid.current === uid) {draftBusy.current = false;setDraftSaving(false);}}
      if (sessionUid.current !== uid) return;
    }
    if (next >= questions.length) { if(track==='performance'){setPerformanceQuestionsComplete(true);if(!skillsState?.completed)setShowSkills(true);} setCompleted(old => ({ ...old, [track]: track==='performance' ? skillsState?.completed===true : true })); setPositions(old => ({ ...old, [track]: 0 })); setTrack(null); setIndex(0); }
    else { setIndex(next); setPositions(old => ({ ...old, [track]: next })); }
    window.scrollTo({ top: 0 });
  };
  const openTrack = (next: 'performance' | 'health') => { if(next==='performance' && performanceQuestionsComplete && !skillsState?.completed){setShowSkills(true);return;} clearTimeout(timer.current); setError(''); setDir(1); setTrack(next); setIndex(positions[next]); window.scrollTo({ top: 0 }); };
  function choose(option: string) {
    if (draftBusy.current) return;
    clearTimeout(timer.current); setDraftSaved(false);
    const previous = Array.isArray(value) ? value : [];
    const selected = previous.includes(option);
    const exclusive = q.exclusiveChoices as string[];
    const next = selected ? previous.filter(v => v !== option) : exclusive.includes(option) ? [option] : [...previous.filter(v => !exclusive.includes(v)), option];
    if (q.type === 'multi_select' && q.maxSelections && next.length > q.maxSelections) { setError(`Choose up to ${q.maxSelections} answers.`); return; }
    setError('');
    setAnswers(old => { const updated = { ...old, [q.id]: q.type === 'multi_select' ? next : option }; if (q.id === 'cau-operational-12' && option !== 'Yes') delete updated['cau-operational-13']; return updated; });
    if (q.type !== 'multi_select' && (!q.requiresConfirmation || option === 'Yes')) timer.current = setTimeout(() => move(index + 1, {...answers,[q.id]:option}), 450);
  }
  async function saveSkillsProgress(draft: ConsolidatedSkillsDraft, complete = false) {
    if(!user) throw Error('Sign in to continue.');
    const uid=user.uid;
    const response=await fetch(endpoint,{method:'POST',signal:AbortSignal.timeout(45000),headers:{...testHeaders(),'Content-Type':'application/json',Authorization:`Bearer ${await user.getIdToken()}`,'X-PulseCheck-Firebase-Mode':isUsingDevFirebase()?'dev':'prod'},body:JSON.stringify({action:complete?'completeSkills':'saveSkillsDraft',draft,revision:skillsRevision.current})});
    const result=await response.json();
    if(!response.ok || !result.skills)throw Error(result.error || 'Could not save your skills. Try again.');
    if(sessionUid.current!==uid)throw Error('Your account changed. Reopen the baseline.');
    skillsRevision.current=result.skills.revision || 0;setSkillsState(result.skills);
    if(complete && result.completed){setSaved(true);setReceipt(result.receipt || null);}
    if(complete){setCompleted(old=>({...old,performance:performanceQuestionsComplete && result.skills.completed}));setShowSkills(false);setTrack(null);}
  }
  async function submit() {
    if (saving || saved || !user || !completed.health || !completed.performance) return;
    setSaving(true); setSubmittedOnce(true); setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { ...testHeaders(), 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}`, 'X-PulseCheck-Firebase-Mode': isUsingDevFirebase() ? 'dev' : 'prod' }, body: JSON.stringify({ name, email, answers, shareHealth, completedSections: completed }) });
      const result = await response.json();
      if (sessionUid.current !== user.uid) return;
      if (!response.ok || !result.saved) throw Error(result.error || 'Unable to save answers.');
      setReceipt(result.receipt || null);
 setSaved(true); setAnswers({}); setName(''); setEmail('');
    } catch (e) { if (sessionUid.current === user.uid) setError((e as Error).message); } finally { if (sessionUid.current === user.uid) setSaving(false); }
  }
  async function login(event: React.FormEvent) {
    event.preventDefault(); setSigningIn(true); setError('');
    try { await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword); setLoginPassword(''); }
    catch { setError('Unable to sign in. Check your PulseCheck email and password and try again.'); }
    finally { setSigningIn(false); }
  }
  async function copyReceipt() {
    if (!receipt) return;
    try { await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable, user can still select the text */ }
  }

  function renderSections() {
    if (!status) return null;
    return (
      <motion.div key="sections" {...fadeMotion} className="cau-stage">
        <h1 className="cau-h1">Your starting point</h1>
        <p className="cau-body">Choose either section to begin. Finish both, then submit your answers.</p>
        <Disclosure summary="Before you begin: privacy and questionnaire context">
          <p className="cau-muted-sm cau-pre-line">{source.questions[0].instructions}</p>
        </Disclosure>

        <div className="cau-track-list">
          {(['performance', 'health'] as const).map(section => {
            const accentClass = section === 'health' ? 'cau-accent-health' : 'cau-accent-performance';
            const Icon = section === 'health' ? HeartPulse : Target;
            const disabled = submittedOnce || (section === 'health' && (priorSubmission || !status.healthSharingAllowed || !shareHealth));
            return (
              <button key={section} type="button" disabled={disabled} data-selected={completed[section]} onClick={() => openTrack(section)} className={`cau-btn cau-track-card ${accentClass}`}>
                <span className="cau-track-icon"><Icon size={18} /></span>
                <span className="cau-track-copy">
                  <span className="cau-track-title">{completed[section] && <Check size={14} />}{section === 'health' ? 'Well-being and support' : 'Performance baseline'}</span>
                  <span className="cau-body-sm">{section === 'health' ? 'Health, injury, well-being, and support.' : 'Your context, how you feel today, and eight mental-skills activities.'}</span>
                  <span className="cau-track-status">{section === 'health' && !shareHealth ? 'Health sharing is optional · not shared' : completed[section] ? 'Complete · review answers' : positions[section] > 0 ? 'In progress · continue' : 'Still to do'}</span>
                </span>
                <ChevronRight size={16} className="cau-track-chevron" />
              </button>
            );
          })}
        </div>

        {!sandboxTest && !submittedOnce && (
          <button type="button" className="cau-btn cau-btn-ghost" style={{ justifyContent: 'center', width: '100%' }} onClick={() => { setShareHealth(false); setAnswers(old => Object.fromEntries(Object.entries(old).filter(([id]) => questionCustodian(id) === 'PulseCheck'))); setCompleted(old => ({ ...old, health: true })); }}>
            Complete performance only
          </button>
        )}

        <p className="cau-muted-sm">{Number(completed.performance) + Number(completed.health)} of 2 sections complete. Performance progress saves as you go. Well-being answers save when you submit; keep this page open until then.</p>

        {!priorSubmission && !submittedOnce && completed.health && completed.performance && (
          <Disclosure summary="Review all answers">
            <div className="cau-review-list">
              {allQuestions.filter(question => (shareHealth || !isHealth(question)) && questionVisible(question.id, answers)).map(question => (
                <div key={question.id} className="cau-review-item">
                  <div>
                    <p className="cau-review-q">{question.question}</p>
                    <p className="cau-review-a">{Array.isArray(answers[question.id]) ? (answers[question.id] as string[]).join(', ') : (answers[question.id] as string) || 'Skipped'}</p>
                  </div>
                  <button type="button" className="cau-icon-btn" aria-label={`Edit answer for ${question.question}`} onClick={() => { const section = isHealth(question) ? 'health' : 'performance'; const items = allQuestions.filter(item => isHealth(item) === isHealth(question) && questionVisible(item.id, answers)); setDir(1); setTrack(section); setIndex(items.findIndex(item => item.id === question.id)); }}>
                    <Pencil size={14} />
                  </button>
                </div>
              ))}
            </div>
          </Disclosure>
        )}

        <AnimatePresence>{error && <ErrorBanner>{error}</ErrorBanner>}</AnimatePresence>

        <button type="button" disabled={!collectionEnabled || saving || !completed.health || !completed.performance} onClick={submit} className="cau-btn cau-btn-primary">
          {saving ? <><Loader2 size={16} className="cau-spinner" /> Saving…</> : collectionEnabled ? <>Submit answers <ArrowRight size={16} /></> : 'Preview: saving is unavailable'}
        </button>
      </motion.div>
    );
  }

  function renderQuestion() {
    if (!track || !q) return null;
    const accentClass = track === 'health' ? 'cau-accent-health' : 'cau-accent-performance';
    return (
      <motion.div key="question-flow" {...fadeMotion} className={`cau-stage ${accentClass}`}>
        <div className="cau-question-top">
          <button type="button" disabled={draftSaving} onClick={() => { clearTimeout(timer.current); setTrack(null); }} className="cau-btn cau-btn-ghost">
            <ArrowLeft size={15} /> Back to sections
          </button>
        </div>

        <div className="cau-progress-track" role="progressbar" aria-label="Questionnaire progress" aria-valuenow={index} aria-valuemin={0} aria-valuemax={track === 'performance' ? 30 : questions.length}>
          <motion.div className="cau-progress-fill" animate={{ width: `${questions.length ? (index / (track === 'performance' ? 30 : questions.length)) * 100 : 0}%` }} transition={{ type: 'spring', stiffness: 280, damping: 32 }} />
        </div>
        <p className="cau-step-label">{index + 1} of {track === 'performance' ? 30 : questions.length} · {q.sectionTitle.replace(/\s*[—–-]\s*auntEDNA only/gi, '')}</p>

        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div key={q.id} custom={dir} variants={questionVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }} style={{ display: 'grid', gap: 16 }}>
            {q.instructions && (
              <Disclosure summary="Question context and privacy">
                <p className="cau-muted-sm cau-pre-line">{q.instructions}</p>
              </Disclosure>
            )}
            <h1 className="cau-question-title">{q.question}</h1>
            {q.type === 'multi_select' && <p className="cau-muted-sm">Choose all that fit{q.maxSelections ? `, up to ${q.maxSelections}` : ''}.</p>}

            {q.choices.length ? (
              <motion.div className="cau-choice-list" variants={listVariants} initial="hidden" animate="show">
                {q.choices.map(option => {
                  const selected = Array.isArray(value) ? value.includes(option) : value === option;
                  return (
                    <motion.button key={option} type="button" variants={itemVariants} aria-pressed={selected} data-selected={selected} onClick={() => choose(option)} className="cau-btn cau-choice-btn">
                      <span>{option}</span>
                      {selected && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 22 }} className="cau-choice-check">
                          <Check size={13} />
                        </motion.span>
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>
            ) : q.type === 'date' ? (
              <div className="cau-date-picks">
                {[0, -1].map(offset => {
                  const date = new Date(); date.setDate(date.getDate() + offset);
                  const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                  return (
                    <button key={offset} type="button" className="cau-btn cau-choice-btn" aria-pressed={value === dateValue} data-selected={value === dateValue} onClick={() => setAnswers(old => ({ ...old, [q.id]: dateValue }))}>
                      <span>{offset === 0 ? 'Today' : 'Yesterday'} · {date.toLocaleDateString()}</span>
                    </button>
                  );
                })}
                <label className="cau-field">
                  <span className="cau-field-label">Choose a date</span>
                  <input type="date" value={typeof value === 'string' ? value : ''} onChange={e => setAnswers(old => ({ ...old, [q.id]: e.target.value }))} className="cau-input" />
                </label>
              </div>
            ) : (
              <label className="cau-field">
                <span className="cau-field-label">Your answer</span>
                <textarea maxLength={4000} rows={4} value={typeof value === 'string' ? value : ''} onChange={e => setAnswers(old => ({ ...old, [q.id]: e.target.value }))} className="cau-input cau-textarea" />
              </label>
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>{error && <ErrorBanner>{error}</ErrorBanner>}</AnimatePresence>

        <div className="cau-nav-row">
          <button type="button" disabled={draftSaving || index === 0} onClick={() => move(index - 1)} className="cau-btn cau-btn-ghost">
            <ArrowLeft size={15} /> Back
          </button>
          <button type="button" disabled={draftSaving} onClick={() => move(index + 1)} className="cau-btn cau-btn-primary">
            {draftSaving ? 'Saving…' : 'Continue'} <ArrowRight size={15} />
          </button>
        </div>
      </motion.div>
    );
  }

  function renderStage() {
    if (!authReady) {
      return (
        <motion.div key="auth-loading" {...fadeMotion} className="cau-stage cau-stage-center">
          <Spinner />
          <p className="cau-muted">Checking your account…</p>
        </motion.div>
      );
    }

    if (!user) {
      return (
        <motion.div key="signin" {...fadeMotion} className="cau-stage">
          <h1 className="cau-h1">Sign in to continue</h1>
          <p className="cau-body">Use your PulseCheck account so your questionnaire stays connected to you.</p>
          {sandboxTest ? (
            <form onSubmit={login} className="cau-form">
              <label className="cau-field">
                <span className="cau-field-label">Account email</span>
                <input required type="email" autoComplete="username" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="cau-input" />
              </label>
              <label className="cau-field">
                <span className="cau-field-label">Password</span>
                <input required type="password" autoComplete="current-password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="cau-input" />
              </label>
              <AnimatePresence>{error && <ErrorBanner>{error}</ErrorBanner>}</AnimatePresence>
              <button disabled={signingIn} className="cau-btn cau-btn-primary cau-accent-performance">
                {signingIn ? <><Loader2 size={16} className="cau-spinner" /> Signing in…</> : <>Sign in to PulseCheck <ArrowRight size={16} /></>}
              </button>
            </form>
          ) : (
            <a href="/PulseCheck/login?returnTo=%2FPulseCheck%2Fquestionnaire%2Fcau" className="cau-btn cau-btn-primary cau-accent-performance">
              Sign in to PulseCheck <ArrowRight size={16} />
            </a>
          )}
        </motion.div>
      );
    }

    if (!status) {
      return (
        <motion.div key="status-loading" {...fadeMotion} className="cau-stage cau-stage-center">
          <Spinner />
          <p className="cau-muted" role="status">{error || 'Checking your questionnaire…'}</p>
        </motion.div>
      );
    }

    if (saved) {
      return (
        <motion.div key="saved" {...fadeMotion} className="cau-stage cau-stage-center">
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="cau-success-badge">
            <CheckCircle2 size={30} />
          </motion.div>
          <h1 className="cau-h1">Your answers are saved.</h1>
          <p className="cau-body">{sandboxTest ? 'Your test is complete. Share the receipt below so the team can check both systems.' : 'Thank you for sharing your starting point. You can return to the app.'}</p>
          {sandboxTest && receipt && (
            <div className="cau-receipt">
              <div className="cau-receipt-head">
                <h2 className="cau-h2">Test receipt</h2>
                <button type="button" onClick={copyReceipt} className="cau-copy-btn">
                  {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                </button>
              </div>
              <textarea aria-label="Test receipt" readOnly rows={12} value={JSON.stringify(receipt, null, 2)} className="cau-input cau-mono" />
              <p className="cau-muted-sm">Select and copy this receipt to share with Chai.</p>
            </div>
          )}
        </motion.div>
      );
    }

    if (!status.available) {
      return (
        <motion.div key="unavailable" {...fadeMotion} className="cau-stage cau-stage-center">
          <div className="cau-empty-icon"><Clock size={24} /></div>
          <h1 className="cau-h1">No questionnaire is assigned</h1>
          <p className="cau-body">Your program team will let you know when it is ready.</p>
        </motion.div>
      );
    }

    if (!started) {
      return (
        <motion.form key="intro" {...fadeMotion} onSubmit={e => { e.preventDefault(); if (!name.trim()) return; setStarted(true); }} className="cau-stage cau-form">
          <h1 className="cau-h1">Hey, I’m Nora. Let’s start with you.</h1>
          <p className="cau-body">These questions help us understand how you’re feeling and where you’d like support. Answer from where you are today. We’ll take it one step at a time.</p>
          <label className="cau-field">
            <span className="cau-field-label">Your name</span>
            <input required maxLength={150} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="cau-input" />
          </label>
          <label className="cau-field">
            <span className="cau-field-label">Email address</span>
            <input readOnly={sandboxTest} required type="email" maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="cau-input" />
          </label>
          <button className="cau-btn cau-btn-primary cau-accent-performance">Begin <ArrowRight size={16} /></button>
        </motion.form>
      );
    }

    if (showSkills) return <ConsolidatedSkillsBaseline sportName="Volleyball" initialDraft={skillsState?.draft} onSaveDraft={draft=>saveSkillsProgress(draft)} onComplete={(_result,draft)=>saveSkillsProgress(draft,true)} onBack={()=>{setShowSkills(false);setTrack(null);}} />;
    if (track && q) return renderQuestion();
    return renderSections();
  }

  const stageAccent = track === 'health' ? 'cau-accent-health' : 'cau-accent-performance';

  return (
    <main className="cau-shell" style={{ position: 'relative', minHeight: '100vh', background: '#050506', color: '#F5F6F2', overflowX: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' }}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <Head><title>CAU baseline questionnaire</title><meta name="robots" content="noindex,nofollow" /><meta name="referrer" content="no-referrer" /></Head>

      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(135deg, rgba(224,254,16,0.07) 0%, transparent 30%, rgba(124,92,252,0.08) 100%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 40%)' }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 620, margin: '0 auto', padding: '48px 20px 40px', display: 'grid', gap: 22 }} className={stageAccent}>
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(224,254,16,0.1)', border: '1px solid rgba(224,254,16,0.25)', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#E0FE10" strokeWidth={2.5} width={17} height={17}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          </div>
          <div>
            <p className="cau-eyebrow" style={{ color: '#E0FE10' }}>PulseCheck</p>
            <p className="cau-muted" style={{ fontSize: 12.5 }}>CAU baseline questionnaire</p>
          </div>
        </motion.div>

        <p className="cau-muted-sm">These questions help us understand how you’re feeling and where you’d like support, so we can set a starting point for your mental training.</p>

        <motion.div initial={{ opacity: 0, y: 16, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, delay: 0.08 }} style={{ position: 'relative', borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(135deg, rgba(18,18,20,0.96) 0%, rgba(10,10,12,0.98) 100%)', boxShadow: '0 24px 80px rgba(0,0,0,0.45), 0 1px 0 inset rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, opacity: 0.6, background: 'linear-gradient(90deg, transparent 5%, rgba(224,254,16,0.4), transparent 95%)' }} />
          <div style={{ padding: '26px 24px' }}>
            <AnimatePresence mode="wait" initial={false}>
              {renderStage()}
            </AnimatePresence>
          </div>
        </motion.div>

        {(draftSaving || draftSaved) && <p className="cau-muted-sm" role="status">{draftSaving ? 'Saving performance progress…' : 'Performance progress saved. You can return later to continue.'}</p>}
        <AnimatePresence>{signOutError && <ErrorBanner>{signOutError}</ErrorBanner>}</AnimatePresence>

        {user && (
          <button type="button" className="cau-btn cau-btn-ghost" style={{ justifySelf: 'center' }} onClick={() => { setSignOutError(''); signOut(auth).catch(() => setSignOutError('Could not sign out. Please try again.')); }}>
            <LogOut size={14} /> Sign out
          </button>
        )}

        <p className="cau-crisis-line">If you need urgent support, call <a href="tel:988">988</a>. In an emergency, call <a href="tel:911">911</a>.</p>
      </div>
    </main>
  );
}
