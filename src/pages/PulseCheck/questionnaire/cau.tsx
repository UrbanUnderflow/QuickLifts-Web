import ConsentChoices from '../../../components/pulsecheck/consent/ConsentChoices';
import type { ConsentDecisions } from '../../../api/firebase/pulsecheckProvisioning/consentPolicy';
import type { PulseCheckRequiredConsentDocument } from '../../../api/firebase/pulsecheckProvisioning/types';
import ConsolidatedSkillsBaseline, { ConsolidatedSkillsDraft } from '../../../components/mentaltraining/ConsolidatedSkillsBaseline';
import { QUESTIONNAIRE_VERSION } from '../../../lib/questionnaires/cau';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithCustomToken, signOut, User } from 'firebase/auth';
import { auth, isUsingDevFirebase } from '../../../api/firebase/config';
import { questionCustodian, questionVisible } from '../../../lib/questionnaires/cau-routing';
import Head from 'next/head';
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronDown, ChevronRight,
  CalendarDays, Clock, Copy, Download, HeartPulse, History, Loader2, Lock, LogOut, Pencil, Smartphone, Target,
} from 'lucide-react';
import { getNativeAppDistribution } from '../../../utils/pulsecheckAppDistribution';
import { CLAY_BASELINE_THEME } from '../../../components/mentaltraining/clayBaselineTheme';
import source from '../../../content/questionnaires/athlete-starting-point.json';

// iOS injects webkit.messageHandlers.baselineSession; Android injects
// pulseCheckBaseline (a WebMessageListener limited to this origin, strings only).
function notifyNative(action: 'signIn' | 'completed' | 'signOut' | 'menu', items?: string) {
  if (typeof window === 'undefined') return false;
  const native = window as unknown as { webkit?: { messageHandlers?: { baselineSession?: { postMessage: (value: Record<string, string>) => void } } }; pulseCheckBaseline?: { postMessage: (value: string) => void } };
  const payload: Record<string, string> = items === undefined ? {action} : {action, items};
  const ios = native.webkit?.messageHandlers?.baselineSession;
  if (ios) { ios.postMessage(payload); return true; }
  if (native.pulseCheckBaseline) { native.pulseCheckBaseline.postMessage(JSON.stringify(payload)); return true; }
  return false;
}

// Secondary section actions. In the app they appear in the native ⋯ menu,
// which shows its own labels for these ids; on the web they sit under More options.
type MenuActionId = 'completePerformanceOnly' | 'reviewHealthSharing' | 'editMentalSkills';
const menuLabels: Record<MenuActionId, string> = {
  completePerformanceOnly: 'Complete performance only',
  reviewHealthSharing: 'Review health sharing',
  editMentalSkills: 'Edit mental skill answers',
};

const allQuestions = source.questions;
const performanceQuestionCount = allQuestions.filter(q => questionCustodian(q.id) === 'PulseCheck').length;
const performanceItemCount = performanceQuestionCount + 8;

// Friendly labels are presentation only. Persist the existing answer values.
const trainingGoalLabels: Record<string, string> = {
  Preparation: 'Getting ready', Resilience: 'Handling setbacks',
  'Self-talk': 'What I say to myself', 'Emotional regulation': 'Handling strong emotions',
  Visualization: 'Picturing myself performing', 'Consistent routines': 'Keeping a routine',
  'I am not sure yet': 'I’m not sure yet',
};
const questionTitle = (question: typeof allQuestions[number]) => question.id === 'cau-starting-point-46'
  ? 'What do you want to get better at?' : question.question;
const choiceLabel = (question: typeof allQuestions[number], answer: string) =>
  question.id === 'cau-starting-point-46' ? trainingGoalLabels[answer] || answer : answer;

export function getServerSideProps({ res }: any) {
  res.setHeader('Cache-Control', 'no-store');
  return { props: { collectionEnabled: process.env.ATHLETE_BASELINE_ENABLED !== 'false' } };
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
.cau-shell ::selection { background: rgba(212,234,4,0.3); }
.cau-shell { position: relative; min-height: 100vh; overflow-x: clip; font-size: 17px; line-height: 1.5; }

.cau-layout { position: relative; z-index: 1; width: 100%; max-width: 680px; margin: 0 auto; padding: 18px 20px 28px; display: grid; gap: 18px; }
.cau-layout.cau-flow-active { padding-bottom: 150px; }
.cau-page-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 0 6px; font-size: 15px; font-weight: 600; }
.cau-page-header img { width: 96px; height: auto; object-fit: contain; }
.cau-page-body { min-width: 0; }

.cau-h1 { font-family: var(--serif); font-weight: 500; font-size: clamp(28px, 7.4vw, 34px); line-height: 1.15; letter-spacing: -0.015em; color: var(--ink); }
.cau-h2 { font-size: 17px; font-weight: 600; color: var(--ink); }
.cau-body { font-size: 16px; line-height: 1.5; color: var(--ink-2); }
.cau-body-sm { font-size: 14px; line-height: 1.5; color: var(--ink-2); }
.cau-muted, .cau-muted-sm { font-size: 14px; line-height: 1.5; color: var(--ink-3); }
.cau-pre-line { white-space: pre-line; }
.cau-eyebrow { font-size: 13px; font-weight: 500; color: var(--ink-3); }

.cau-stage { display: grid; gap: 16px; }
.cau-stage-center { justify-items: center; text-align: center; padding: 24px 0 4px; }
.cau-form { display: grid; gap: 16px; }
.cau-field { display: grid; gap: 8px; }
.cau-field-label { font-size: 13px; font-weight: 500; color: var(--ink-3); }
.cau-input { width: 100%; min-width: 0; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 16px; outline: none; transition: border-color .15s ease; }
.cau-input:focus { border-color: var(--ink); }
.cau-input::placeholder { color: var(--ink-3); }
.cau-input:read-only { opacity: 0.65; }
.cau-textarea { resize: vertical; min-height: 110px; line-height: 1.5; }
.cau-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; line-height: 1.6; }

.cau-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 52px; padding: 14px 18px; border-radius: 16px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 16px; font-weight: 500; text-align: center; text-decoration: none; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: background-color .15s ease, border-color .15s ease, transform .12s ease, filter .15s ease; }
.cau-btn:active:not(:disabled) { transform: scale(0.985); }
.cau-btn:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.cau-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.cau-btn-primary { border: 0; border-radius: 18px; min-height: 56px; background: var(--lime); color: var(--on-lime); font-weight: 800; box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.12); }
.cau-btn-secondary { background: transparent; border: 1.5px solid var(--line-strong); font-weight: 600; }
.cau-btn-ghost { width: auto; min-height: 44px; padding: 10px 4px; background: transparent; border-color: transparent; color: var(--ink-2); font-size: 15px; }
.cau-back { width: auto; min-height: 36px; padding: 6px 12px 6px 9px; gap: 6px; border-radius: 999px; background: transparent; border: 1.5px solid var(--line-strong); font-size: 14px; font-weight: 600; flex-shrink: 0; }
@media (hover: hover) {
  .cau-btn:hover:not(:disabled) { border-color: var(--line-strong); }
  .cau-btn-primary:hover:not(:disabled) { filter: brightness(1.05); }
  .cau-btn-ghost:hover:not(:disabled) { color: var(--ink); border-color: transparent; }
}

.cau-banner { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 16px; background: rgba(242,242,232,0.05); font-size: 14px; line-height: 1.5; color: var(--ink-2); }
.cau-banner > svg { flex-shrink: 0; margin-top: 2px; color: var(--ink); }
.cau-banner strong { display: block; font-weight: 600; color: var(--ink); }
.cau-banner p + p { margin-top: 6px; }

.cau-track-list { display: grid; gap: 10px; }
.cau-shell button.cau-track-card { justify-content: flex-start; text-align: left; gap: 14px; min-height: 76px; padding: 16px; border-radius: 18px; }
.cau-track-icon { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 12px; background: rgba(242,242,232,0.08); color: var(--ink); flex-shrink: 0; }
.cau-track-copy { display: grid; gap: 3px; flex: 1; min-width: 0; }
.cau-track-title { font-size: 16px; font-weight: 600; color: var(--ink); }
.cau-track-status { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--ink-3); }
.cau-track-status[data-done="true"] { color: var(--lime); }
.cau-track-action { display: inline-flex; align-items: center; gap: 2px; flex-shrink: 0; padding: 7px 10px 7px 12px; border-radius: 999px; border: 1.5px solid var(--line-strong); color: var(--ink); font-size: 13px; font-weight: 700; white-space: nowrap; }
.cau-track-action[data-filled="true"] { background: var(--ink); border-color: var(--ink); color: var(--paper); }

.cau-privacy { display: flex; align-items: flex-start; gap: 10px; font-size: 13.5px; line-height: 1.5; color: var(--ink-2); }
.cau-privacy svg { flex-shrink: 0; margin-top: 2px; }
.cau-note { padding: 14px 16px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); font-size: 14px; line-height: 1.5; color: var(--ink-2); }
.cau-progress-note { font-size: 13px; line-height: 1.5; color: var(--ink-3); text-align: center; }

.cau-disclosure { border-radius: 16px; border: 1px solid var(--line); background: var(--surface); overflow: hidden; }
.cau-disclosure-summary { width: 100%; min-height: 50px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; background: transparent; border: 0; color: var(--ink); font-size: 15px; font-weight: 600; cursor: pointer; text-align: left; }
.cau-disclosure-summary:focus-visible { outline: 2px solid var(--ink); outline-offset: -2px; border-radius: 16px; }
.cau-disclosure-body { overflow: hidden; }
.cau-disclosure-inner { padding: 0 16px 16px; display: grid; gap: 10px; }

.cau-menu { display: grid; }
.cau-shell .cau-menu button { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 12px 0; background: transparent; border: 0; border-top: 1px solid var(--line); color: var(--ink); font-size: 15px; text-align: left; cursor: pointer; }
.cau-shell .cau-menu button:first-child { border-top: 0; }

.cau-review-list { display: grid; }
.cau-review-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); }
.cau-review-item:first-child { border-top: none; }
.cau-review-q { font-size: 14px; font-weight: 600; color: var(--ink); margin-bottom: 3px; }
.cau-review-a { font-size: 13.5px; color: var(--ink-3); }
.cau-icon-btn { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; border: 1.5px solid var(--line-strong); background: transparent; color: var(--ink); cursor: pointer; }

.cau-question-stage { min-height: calc(100svh - 120px); display: flex; flex-direction: column; }
.cau-question-content { flex: 1; min-width: 0; }
.cau-question-meta { display: flex; align-items: center; gap: 12px; }
.cau-progress-track { position: relative; flex: 1; height: 4px; border-radius: 4px; background: rgba(242,242,232,0.12); overflow: hidden; }
.cau-progress-fill { position: absolute; inset: 0 auto 0 0; height: 100%; border-radius: 4px; background: var(--ink); }
.cau-step-label { font-size: 13px; color: var(--ink-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.cau-context { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--ink-3); }
.cau-context svg { flex-shrink: 0; }
.cau-question-title { font-family: var(--serif); font-weight: 500; font-size: clamp(24px, 6.6vw, 30px); line-height: 1.2; letter-spacing: -0.01em; color: var(--ink); }

.cau-choice-list { display: grid; gap: 8px; }
.cau-shell button.cau-choice-btn { justify-content: space-between; text-align: left; min-height: 52px; padding: 13px 16px; border-radius: 14px; font-weight: 500; }
.cau-shell button.cau-choice-btn[data-selected="true"] { background: var(--raised-selected); border: 2px solid var(--ink); padding: 12px 15px; font-weight: 600; }
.cau-choice-radio { width: 20px; height: 20px; flex-shrink: 0; border-radius: 50%; border: 2px solid var(--control); }
.cau-choice-btn[data-selected="true"] .cau-choice-radio { border: 6px solid var(--ink); background: var(--paper); }
.cau-choice-box { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; flex-shrink: 0; border-radius: 6px; border: 2px solid var(--control); color: transparent; }
.cau-choice-btn[data-selected="true"] .cau-choice-box { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.cau-goal-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cau-shell .cau-goal-grid button.cau-choice-btn { min-height: 60px; padding: 10px 12px; gap: 6px; line-height: 1.3; overflow-wrap: anywhere; }
.cau-shell .cau-goal-grid button.cau-choice-btn[data-selected="true"] { padding: 9px 11px; }
.cau-selection-hint { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 15px; color: var(--ink-2); }
.cau-selection-count { border: 1px solid var(--line-strong); border-radius: 999px; padding: 3px 10px; font-size: 13px; color: var(--ink); white-space: nowrap; }
.cau-date-picks { display: grid; gap: 8px; }

.cau-question-actions { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: calc(100% - 40px); max-width: 640px; z-index: 3; padding: 14px 0 max(14px, env(safe-area-inset-bottom)); background: linear-gradient(180deg, rgba(23,27,28,0), var(--paper) 18px); display: grid; gap: 8px; }
.cau-action-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 10px; }
.cau-action-row[data-single="true"] { grid-template-columns: minmax(0, 1fr); }
.cau-action-row .cau-btn-secondary { min-height: 56px; }
.cau-save-status { font-size: 12px; color: var(--ink-3); text-align: center; min-height: 18px; }

.cau-intro-parts { display: grid; gap: 14px; padding: 4px 0; }
.cau-intro-part { display: flex; align-items: center; gap: 16px; }
.cau-intro-part > span { font-family: var(--serif); font-size: 22px; color: var(--ink-3); }
.cau-intro-part strong { font-size: 17px; font-weight: 600; }
.cau-intro-facts { display: grid; gap: 12px; font-size: 15px; line-height: 1.5; color: var(--ink-2); }
.cau-intro-facts p { display: flex; gap: 12px; }
.cau-intro-facts svg { flex-shrink: 0; margin-top: 2px; color: var(--ink); }

.cau-error { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 14px; background: rgba(240,149,149,0.1); border: 1px solid rgba(240,149,149,0.3); color: #F7C1C1; font-size: 14px; line-height: 1.5; overflow: hidden; }
.cau-error svg { flex-shrink: 0; margin-top: 3px; }
.cau-sandbox-banner { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 14px; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.28); color: #FDE68A; font-size: 13.5px; line-height: 1.55; }
.cau-success-badge { display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 999px; background: rgba(212,234,4,0.14); color: var(--lime); }
.cau-empty-icon { display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 999px; background: rgba(242,242,232,0.08); color: var(--ink-2); }
.cau-receipt { display: grid; gap: 10px; text-align: left; width: 100%; }
.cau-receipt-head { display: flex; align-items: center; justify-content: space-between; }
.cau-copy-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px; border: 1.5px solid var(--line-strong); background: transparent; color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; }
.cau-join-card { display: grid; gap: 16px; padding: 20px; border-radius: 22px; background: var(--surface); border: 1px solid var(--line); }
.cau-join-card .cau-input { text-transform: uppercase; letter-spacing: 0.04em; }
.cau-join-card .cau-input::placeholder { text-transform: none; letter-spacing: 0; }
.cau-shell .cau-centered { justify-self: center; text-align: center; }
.cau-store-list { display: grid; gap: 10px; width: 100%; }
.cau-store-list span[aria-disabled="true"] { opacity: 0.5; cursor: default; }
.cau-crisis-line { font-size: 12.5px; line-height: 1.5; color: var(--ink-2); text-align: center; }
.cau-crisis-line a { color: var(--ink); text-decoration: underline; text-underline-offset: 2px; }

@keyframes cau-spin { to { transform: rotate(360deg); } }
.cau-spinner { animation: cau-spin 0.8s linear infinite; }
@media (prefers-reduced-motion: reduce) { .cau-btn { transition: none; } .cau-btn:active:not(:disabled) { transform: none; } }
@media (max-width: 360px) { .cau-layout { padding-inline: 16px; } .cau-question-actions { width: calc(100% - 32px); } .cau-goal-grid { grid-template-columns: 1fr; } }
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
  const [status, setStatus] = useState<{available: boolean; completed: boolean; required?: boolean; healthSharingAllowed: boolean; healthBaselineEnabled?: boolean; healthAuthorizationRequired?: boolean; healthAuthorizationDecision?: string; healthDocuments?: PulseCheckRequiredConsentDocument[]; healthConsentDecisions?: ConsentDecisions; healthCollectionAvailable?: boolean; submissionSharing?: boolean | null; sportName?: string; productBrand?: string; reviewId?: string; teamName?: string; teamWorkspaceUrl?: string; prefill?: {answers: Record<string,string|string[]>; name: string; email?: string; prefilledQuestionCount: number; performanceQuestionsComplete?: boolean; unavailableHealthAnswers: boolean; hasPreviousBaseline: boolean; skillsDraft?: ConsolidatedSkillsDraft}} | null>(null);
  const [healthChoices, setHealthChoices] = useState<ConsentDecisions>({});
  const [reviewHealthChoice, setReviewHealthChoice] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [shareHealth, setShareHealth] = useState(true);
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [sharingLocked, setSharingLocked] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState('');
  useEffect(() => { setEmbedded(new URLSearchParams(window.location.search).get('embedded') === '1'); }, []);
  const [nativePending, setNativePending] = useState(false);
  const [nativeError, setNativeError] = useState('');
  const nativeUID = useRef<string | null>(null);
  useEffect(() => {
    const receive = async (event: Event) => {
      const session = (event as CustomEvent<{customToken?: string; userID?: string}>).detail;
      if (!session?.customToken || !session.userID) return;
      if (nativeUID.current && nativeUID.current !== session.userID) {
        setNativePending(true);setNativeError('Please reopen the baseline from your app account.');return;
      }
      setNativeError(''); nativeUID.current = session.userID;
      try {
        const credential = await signInWithCustomToken(auth, session.customToken);
        if (credential.user.uid !== session.userID) { await signOut(auth); throw Error('Account mismatch'); }
        setNativePending(false);
      } catch { setNativeError('Your app session could not be opened. Try again or use Open on web in the app menu.'); }
    };
    window.addEventListener('pulse-baseline-session', receive);
    if (notifyNative('signIn')) setNativePending(true);
    return () => window.removeEventListener('pulse-baseline-session', receive);
  }, []);
  useEffect(() => { if (saved) notifyNative('completed'); }, [saved]);
  const sessionUid = useRef<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, next => {
    if (next && nativeUID.current && next.uid !== nativeUID.current) { setNativeError('Please reopen the baseline from your app account.'); return; }
    sessionUid.current = next?.uid || null;
    setPriorSubmission(false);skillsRevision.current=0;setSkillsState(null);setShowSkills(false);setPerformanceQuestionsComplete(false);
    draftRevision.current = 0; draftBusy.current = false; setDraftSaving(false); setDraftSaved(false);
    setHealthChoices({});setReviewHealthChoice(false);setConsentSaving(false);
    setSignOutError(''); setUser(next); setAuthReady(true); setStatus(null); setAnswers({}); setStarted(false);
    setCompleted({performance:false,health:false}); setPositions({performance:0,health:0}); setIndex(0); setTrack(null);
    clearTimeout(timer.current); setReceipt(null); setSaved(false); setSaving(false); setSubmittedOnce(false); setSharingLocked(false); setShareHealth(true); setError('');
    setName(sandboxTest ? '' : next?.displayName || ''); setEmail(next?.email || '');
    if (next) next.getIdToken().then(token => fetch(endpoint, {
      headers: {...testHeaders(), Authorization: `Bearer ${token}`, 'X-PulseCheck-Firebase-Mode': isUsingDevFirebase() ? 'dev' : 'prod'},
    })).then(async response => { const result = await response.json(); if (!response.ok) throw Error(result.error || 'Could not check your questionnaire. Refresh to try again.'); if (!result.completed && result.questionnaireVersion !== QUESTIONNAIRE_VERSION) throw Error('The questionnaire has been updated. Refresh this page to continue.'); return result; })
      .then(result => { if (sessionUid.current === next.uid) {setStatus(result);setSaved(result.completed);
        const sharing = typeof result.submissionSharing === 'boolean' ? result.submissionSharing : result.healthBaselineEnabled !== false && !['declined','revoked','disabled'].includes(result.healthAuthorizationDecision || '');
        setHealthChoices(result.healthConsentDecisions || {});setShareHealth(sharing); setSharingLocked(typeof result.submissionSharing === 'boolean');
        setCompleted(old=>({...old,health:!sharing}));setReceipt(result.receipt || null);
        setPriorSubmission(result.questionnaireSubmitted === true);setSkillsState(result.skills || null);skillsRevision.current=result.skills?.revision || 0;
        if (result.reviewId && result.prefill) {
          const prefill = result.prefill;
          setAnswers(prefill.answers || {});
          if (prefill.name) setName(prefill.name);
          if (!next.email && prefill.email) setEmail(prefill.email);
          if ((prefill.prefilledQuestionCount > 0 || prefill.hasPreviousBaseline) && (prefill.name || next.displayName) && (next.email || prefill.email)) setStarted(true);
          const performanceReady = prefill.performanceQuestionsComplete === true || Object.keys(prefill.answers || {}).length > 0;
          setPerformanceQuestionsComplete(performanceReady);
          setCompleted({performance:performanceReady && result.skills?.completed === true,health:!sharing});
        }
        if (result.draft?.version === QUESTIONNAIRE_VERSION && !result.completed) {
          const draft = result.draft; draftRevision.current = draft.revision;
          setAnswers(draft.answers); setName(draft.name); setStarted(true); setDraftSaved(true);
          setPerformanceQuestionsComplete(draft.completed);
          setCompleted({performance:draft.completed && result.skills?.completed===true,health:result.questionnaireSubmitted === true || !sharing});
          const resume = Math.min(draft.position, performanceQuestionCount - 1);
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
        const response = await fetch(endpoint, {method:'POST',signal:AbortSignal.timeout(20000),headers:{...testHeaders(),'Content-Type':'application/json',Authorization:`Bearer ${await user.getIdToken()}`,'X-PulseCheck-Firebase-Mode':isUsingDevFirebase() ? 'dev' : 'prod'},body:JSON.stringify({questionnaireVersion:QUESTIONNAIRE_VERSION,reviewId:status?.reviewId,action:'savePerformanceDraft',draft:{flowVersion:4,version:QUESTIONNAIRE_VERSION,name,answers:performanceAnswers,position:next >= questions.length ? 0 : next,completed:next >= questions.length,revision:draftRevision.current}})});
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
    if (q.type === 'multi_select' && q.maxSelections && next.length > q.maxSelections) { setError(`You’ve picked ${q.maxSelections}. Tap a selected answer to remove it, then choose another.`); return; }
    setError('');
    setAnswers(old => { const updated = { ...old, [q.id]: q.type === 'multi_select' ? next : option }; return updated; });
    if (q.type !== 'multi_select' && (!q.requiresConfirmation || option === 'Yes')) timer.current = setTimeout(() => move(index + 1, {...answers,[q.id]:option}), 450);
  }
  async function saveSkillsProgress(draft: ConsolidatedSkillsDraft, complete = false) {
    if(!user) throw Error('Sign in to continue.');
    const uid=user.uid;
    const response=await fetch(endpoint,{method:'POST',signal:AbortSignal.timeout(45000),headers:{...testHeaders(),'Content-Type':'application/json',Authorization:`Bearer ${await user.getIdToken()}`,'X-PulseCheck-Firebase-Mode':isUsingDevFirebase()?'dev':'prod'},body:JSON.stringify({questionnaireVersion:QUESTIONNAIRE_VERSION,reviewId:status?.reviewId,action:complete?'completeSkills':'saveSkillsDraft',draft,revision:skillsRevision.current})});
    const result=await response.json();
    if(!response.ok || !result.skills)throw Error(result.error || 'Could not save your skills. Try again.');
    if(sessionUid.current!==uid)throw Error('Your account changed. Reopen the baseline.');
    skillsRevision.current=result.skills.revision || 0;setSkillsState(result.skills);
    if(complete && result.completed){setSaved(true);setReceipt(result.receipt || null);}
    if(complete){setCompleted(old=>({...old,performance:performanceQuestionsComplete && result.skills.completed}));setShowSkills(false);setTrack(null);}
  }
  async function saveHealthChoice() {
    if (!user || consentSaving) return;
    const uid = user.uid;
    setConsentSaving(true);setError('');
    try {
      const headers = {...testHeaders(), 'Content-Type':'application/json', Authorization:`Bearer ${await user.getIdToken()}`, 'X-PulseCheck-Firebase-Mode':isUsingDevFirebase()?'dev':'prod'};
      const response = await fetch(endpoint, {method:'POST',headers,body:JSON.stringify({questionnaireVersion:QUESTIONNAIRE_VERSION,reviewId:status?.reviewId,action:'saveHealthDecision',decisions:Object.fromEntries(Object.entries(healthChoices).filter(([id])=>status?.healthDocuments?.some(document=>document.id===id)))})});
      const result = await response.json();
      if (!response.ok || !result.saved) throw Error(result.error || 'Your choice could not be saved. Try again.');
      const checked = await fetch(endpoint, {headers});
      const latest = await checked.json();
      if (!checked.ok || latest.healthAuthorizationRequired) throw Error('Review every current health agreement and save your choice.');
      if (sessionUid.current !== uid) return;
      setStatus(latest);setHealthChoices(latest.healthConsentDecisions || {});setReviewHealthChoice(false);
      if (typeof latest.submissionSharing !== 'boolean') {
        const sharing = latest.healthBaselineEnabled !== false && latest.healthSharingAllowed;
        setShareHealth(sharing);
        setCompleted(old => ({...old,health:!sharing}));
        if (!sharing) setAnswers(old => Object.fromEntries(Object.entries(old).filter(([id])=>questionCustodian(id)==='PulseCheck')));
      }
    } catch(e) { if (sessionUid.current === uid) setError(e instanceof Error ? e.message : 'Your choice could not be saved. Try again.'); }
    finally { if (sessionUid.current === uid) setConsentSaving(false); }
  }
  async function submit() {
    if (saving || saved || !user) return;
    const missingSections = [
      ...(!completed.performance ? ['Performance baseline'] : []),
      ...(status?.healthBaselineEnabled !== false && shareHealth && !completed.health ? ['Well-being and support'] : []),
    ];
    if (missingSections.length) {
      setError(`Complete ${missingSections.join(' and ')} before you submit your baseline.`);
      return;
    }
    if (!collectionEnabled) { setError('Saving is temporarily unavailable. Please try again shortly.'); return; }
    if (status?.healthAuthorizationRequired) {setReviewHealthChoice(true);return;}
    if (shareHealth && status?.healthCollectionAvailable === false) {setError('Your program’s health connection is not ready. Your answers remain on this page. Try again later or choose Complete performance only.');return;}
    setSaving(true); setSubmittedOnce(true); setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST', signal: AbortSignal.timeout(45000), headers: { ...testHeaders(), 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}`, 'X-PulseCheck-Firebase-Mode': isUsingDevFirebase() ? 'dev' : 'prod' }, body: JSON.stringify({ questionnaireVersion: QUESTIONNAIRE_VERSION, reviewId:status?.reviewId, acceptPrefilled:Boolean(status?.reviewId), name, email, answers, shareHealth, completedSections: completed }) });
      const result = await response.json();
      if (sessionUid.current !== user.uid) return;
      if (!response.ok || !result.saved) throw Error(result.error || 'Unable to save answers.');
      setReceipt(result.receipt || null);
 setSaved(true); setAnswers({}); setName(''); setEmail('');
     } catch (e) {
      if (sessionUid.current === user.uid) {
        setError((e as Error).message || 'Saving failed. Press Submit answers to retry.');
        setSubmittedOnce(false); setSharingLocked(true);
        try {
          const checked = await fetch(endpoint, {signal:AbortSignal.timeout(20000),headers:{...testHeaders(),Authorization:`Bearer ${await user.getIdToken()}`,'X-PulseCheck-Firebase-Mode':isUsingDevFirebase()?'dev':'prod'}});
          const latest = await checked.json();
          if (checked.ok && sessionUid.current === user.uid) {
            setStatus(latest);
            if (latest.completed) { setSaved(true); return; }
            if (latest.reviewId !== status?.reviewId) {window.location.reload();return;}
            const reserved = typeof latest.submissionSharing === 'boolean';
            setSharingLocked(reserved);
            if (reserved) setShareHealth(latest.submissionSharing);
            else if (latest.healthBaselineEnabled === false || ['declined','revoked'].includes(latest.healthAuthorizationDecision)) {
              setShareHealth(false);setCompleted(old=>({...old,health:true}));
              setAnswers(old=>Object.fromEntries(Object.entries(old).filter(([id])=>questionCustodian(id)==='PulseCheck')));
            }
          }
        } catch { /* Retain the unknown attempt until a connected retry confirms its state. */ }
      }
    } finally { if (sessionUid.current === user.uid) setSaving(false); }
  }
  async function login(event: React.FormEvent) {
    event.preventDefault(); setSigningIn(true); setError('');
    try { await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword); setLoginPassword(''); }
    catch { setError('Unable to sign in. Check your PulseCheck email and password and try again.'); }
    finally { setSigningIn(false); }
  }
  async function continueAfterBaseline() {
    if (!user) return;
    setError('');
    try {
      const response = await fetch(endpoint, {headers:{...testHeaders(),Authorization:`Bearer ${await user.getIdToken()}`,'X-PulseCheck-Firebase-Mode':isUsingDevFirebase()?'dev':'prod'}});
      const latest = await response.json();
      if (!response.ok || sessionUid.current !== user.uid) throw Error('Please check your connection and try again.');
      if (latest.required || embedded) {window.location.reload();return;}
      const target = status?.teamWorkspaceUrl;
      window.location.assign(target?.startsWith('/PulseCheck/team-workspace?') ? target : '/PulseCheck?web=1');
    } catch {setError('We could not check your next step. Please try again.');}
  }
  // Web front door: the same team lookup the app uses, then the existing web join flow.
  // That flow ends on the team page, which sends athletes back here while the baseline is due.
  async function findProgram(event: React.FormEvent) {
    event.preventDefault();
    const code = joinCode.trim();
    if (!code || joinBusy) return;
    setJoinBusy(true); setJoinError('');
    try {
      const dev = isUsingDevFirebase();
      const response = await fetch('/api/pulsecheck/activation/resolve', {method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json','X-PulseCheck-Firebase-Mode':dev ? 'dev' : 'prod'},body:JSON.stringify({code,forceDevFirebase:dev})});
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.inviteToken !== 'string' || !result.inviteToken) throw Error(result.error || 'We couldn’t find your invitation. Check the code with your team staff and try again.');
      window.location.assign(`/PulseCheck/team-invite/${encodeURIComponent(result.inviteToken)}`);
    } catch (e) {
      setJoinError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Program lookup is unavailable. Please try again.');
      setJoinBusy(false);
    }
  }

  function renderJoin(signedIn: boolean) {
    return (
      <motion.form key={signedIn ? 'join-signed-in' : 'join'} {...fadeMotion} onSubmit={findProgram} className="cau-stage cau-form">
        <p className="cau-eyebrow">Your team starts here</p>
        <h1 className="cau-h1">Find your program.</h1>
        <p className="cau-body">{signedIn ? 'Your baseline opens after you join your team. Enter the code your team shared.' : 'Enter the code your team shared to join your team and take your baseline.'}</p>
        <div className="cau-join-card">
          <label className="cau-field">
            <span className="cau-field-label">Organization or team code</span>
            <input value={joinCode} onChange={e => { setJoinCode(e.target.value); setJoinError(''); }} disabled={joinBusy} autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} placeholder="Enter your code" className="cau-input" />
          </label>
          <AnimatePresence>{joinError && <ErrorBanner>{joinError}</ErrorBanner>}</AnimatePresence>
          <button type="submit" disabled={joinBusy || !joinCode.trim()} className="cau-btn cau-btn-primary">{joinBusy ? <><Loader2 size={16} className="cau-spinner" /> Finding your program…</> : 'Continue'}</button>
        </div>
        {signedIn
          ? <button type="button" className="cau-btn cau-btn-ghost cau-centered" onClick={() => { setSignOutError(''); signOut(auth).catch(() => setSignOutError('Could not sign out. Please try again.')); }}>Use a different account</button>
          : <a href="/PulseCheck/login?returnTo=%2FPulseCheck%2Fbaseline" className="cau-btn cau-btn-ghost cau-centered">Already have an account? Sign in</a>}
      </motion.form>
    );
  }

  function renderDownload() {
    const app = getNativeAppDistribution(status?.productBrand);
    return (
      <div className="cau-store-list">
        {app.iosUrl
          ? <a href={app.iosUrl} target="_blank" rel="noreferrer" className="cau-btn cau-btn-primary"><Download size={18} aria-hidden="true" />Download for iPhone</a>
          : <span className="cau-btn cau-btn-secondary" aria-disabled="true">iPhone app coming soon</span>}
        {app.androidUrl
          ? <a href={app.androidUrl} target="_blank" rel="noreferrer" className="cau-btn cau-btn-secondary"><Smartphone size={18} aria-hidden="true" />Download for Android</a>
          : <span className="cau-btn cau-btn-secondary" aria-disabled="true">Android app coming soon</span>}
      </div>
    );
  }

  async function copyReceipt() {
    if (!receipt) return;
    try { await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable, user can still select the text */ }
  }

  function sectionMenuActions(): {id: MenuActionId; run: () => void}[] {
    if (!status || sandboxTest || status.healthBaselineEnabled === false) return status?.reviewId && skillsState?.draft ? [{id:'editMentalSkills',run:editMentalSkills}] : [];
    const actions: {id: MenuActionId; run: () => void}[] = [];
    if (!sharingLocked && !submittedOnce && shareHealth) actions.push({id:'completePerformanceOnly',run:() => { setShareHealth(false); setAnswers(old => Object.fromEntries(Object.entries(old).filter(([id]) => questionCustodian(id) === 'PulseCheck'))); setCompleted(old => ({ ...old, health: true })); }});
    if (!sharingLocked) actions.push({id:'reviewHealthSharing',run:() => setReviewHealthChoice(true)});
    if (status.reviewId && skillsState?.draft) actions.push({id:'editMentalSkills',run:editMentalSkills});
    return actions;
  }
  function editMentalSkills() { setSkillsState({...skillsState,draft:{...skillsState.draft,step:'tools'}});setCompleted(old=>({...old,performance:false}));setShowSkills(true); }

  function renderSections() {
    if (!status) return null;
    const sections = ['performance', ...(status.healthBaselineEnabled === false ? [] : ['health'])] as ('performance'|'health')[];
    const doneCount = sections.filter(section => completed[section]).length;
    const menuActions = sectionMenuActions();
    sectionsMenu.current = menuActions;
    const prefilledCount = status.prefill?.prefilledQuestionCount || 0;
    const teamName = status.teamName || 'your team';
    return (
      <motion.div key="sections" {...fadeMotion} className="cau-stage">
        {status.reviewId && <div role="status" className="cau-banner"><History size={18} aria-hidden="true"/><div>
          <strong>{prefilledCount ? 'Prefilled answers' : 'Baseline for your new team'}</strong>
          <p>{prefilledCount ? `Your baseline for ${teamName} has ${prefilledCount} answers from your previous baseline. Accept them or change any.` : `Complete this baseline for ${teamName}, even if you have done one before.`}</p>
          {status.prefill?.unavailableHealthAnswers && status.healthBaselineEnabled !== false && <p>Previous health answers are not available here. Answer them again if you choose to share them.</p>}
        </div></div>}
        <h1 className="cau-h1">{status.reviewId ? 'Review your baseline' : 'Your baseline'}</h1>
        {!status.reviewId && <p className="cau-body">Finish each section, then submit. Your progress saves as you go.</p>}

        <div className="cau-track-list">
          {sections.map(section => {
            const Icon = section === 'health' ? HeartPulse : Target;
            const healthUnavailable = section === 'health' && (priorSubmission || !status.healthSharingAllowed || !shareHealth);
            const notShared = section === 'health' && !shareHealth;
            const inProgress = positions[section] > 0;
            const statusText = notShared ? 'Optional · not shared' : completed[section] ? 'Done' : inProgress ? 'In progress' : section === 'health' ? 'Optional · not started' : 'Not started';
            const action = notShared ? 'Change' : completed[section] ? 'Review' : inProgress ? 'Continue' : 'Start';
            return (
              <button key={section} type="button" onClick={() => { if (saving) return; if (sharingLocked) {setError('Saving has started. Press Submit answers to finish or retry this submission.');return;} if (healthUnavailable) { if (!sandboxTest && status.healthDocuments?.length) setReviewHealthChoice(true); else setError('Health sharing follows your consent choices. You can complete performance only.'); return; } openTrack(section); }} className="cau-btn cau-track-card">
                <span className="cau-track-icon"><Icon size={20} aria-hidden="true" /></span>
                <span className="cau-track-copy">
                  <span className="cau-track-title">{section === 'health' ? 'Well-being and support' : 'Performance baseline'}</span>
                  <span className="cau-track-status" data-done={completed[section] && !notShared}>{completed[section] && !notShared && <CheckCircle2 size={14} aria-hidden="true" />}{statusText}</span>
                </span>
                <span className="cau-track-action" data-filled={!completed[section] && !notShared} aria-hidden="true">{action}<ChevronRight size={15} /></span>
              </button>
            );
          })}
        </div>

        <p className="cau-privacy"><Lock size={15} aria-hidden="true" /><span>Coaches and teammates never see your mental-health answers. Health sharing is your choice.</span></p>
        <Disclosure summary="How your answers are used">
          <p className="cau-muted-sm cau-pre-line">{source.purpose}</p>
          <p className="cau-muted-sm">This questionnaire supports onboarding, service delivery, and internal pilot evaluation. It is not a diagnostic assessment or an IRB-approved research study.</p>
          <p className="cau-muted-sm">Your individual mental-health and help-seeking responses will not be provided to coaches, teammates, or performance personnel. Health sharing is optional and follows your current authorization.</p>
          <p className="cau-muted-sm">This questionnaire is not monitored as an emergency service. For immediate help, contact your local urgent support service, call or text 988, or call 911 in an emergency.</p>
        </Disclosure>

        {!shareHealth && <p className="cau-note">Your health responses will remain unshared. {status.reviewId && completed.performance ? 'Review your answers, then accept them for this team.' : 'Complete the performance section, then submit to finish your baseline.'}</p>}
        {sharingLocked && !saved && <p className="cau-note">Your sharing choice is saved for this submission. If saving was interrupted, press Submit answers to retry.</p>}

        {!priorSubmission && !submittedOnce && !sharingLocked && completed.health && completed.performance && (
          <Disclosure summary="Review all answers">
            <div className="cau-review-list">
              {allQuestions.filter(question => (shareHealth || !isHealth(question)) && questionVisible(question.id, answers)).map(question => (
                <div key={question.id} className="cau-review-item">
                  <div>
                    <p className="cau-review-q">{questionTitle(question)}</p>
                    <p className="cau-review-a">{Array.isArray(answers[question.id]) ? (answers[question.id] as string[]).map(answer => choiceLabel(question, answer)).join(', ') : choiceLabel(question, (answers[question.id] as string) || 'Skipped')}</p>
                  </div>
                  <button type="button" className="cau-icon-btn" aria-label={`Edit answer for ${question.question}`} onClick={() => { const section = isHealth(question) ? 'health' : 'performance'; const items = allQuestions.filter(item => isHealth(item) === isHealth(question) && questionVisible(item.id, answers)); setDir(1); setTrack(section); setIndex(items.findIndex(item => item.id === question.id)); }}>
                    <Pencil size={15} />
                  </button>
                </div>
              ))}
            </div>
          </Disclosure>
        )}

        {!embedded && menuActions.length > 0 && (
          <Disclosure summary="More options">
            <div className="cau-menu">{menuActions.map(item => <button key={item.id} type="button" onClick={item.run}>{menuLabels[item.id]}</button>)}</div>
          </Disclosure>
        )}

        <AnimatePresence>{error && <ErrorBanner>{error}</ErrorBanner>}</AnimatePresence>
        <p className="cau-progress-note">{doneCount} of {sections.length} {sections.length === 1 ? 'section' : 'sections'} done.{shareHealth && status.healthBaselineEnabled !== false ? ' Well-being answers save when you submit.' : ''}</p>
        <button type="button" aria-busy={saving} onClick={submit} className="cau-btn cau-btn-primary">
          {saving ? <><Loader2 size={16} className="cau-spinner" /> Saving…</> : collectionEnabled ? (status.reviewId ? 'Accept answers for this team' : 'Submit answers') : 'Try saving answers'}
        </button>
      </motion.div>
    );
  }

  function renderQuestion() {
    if (!track || !q) return null;
    const total = track === 'performance' ? performanceItemCount : questions.length;
    return (
      <motion.div key="question-flow" {...fadeMotion} className="cau-stage cau-question-stage">
        <div className="cau-question-meta">
          <button type="button" aria-label={index === 0 ? "Back to sections" : "Previous question"} onClick={() => { if (draftSaving) return; if (index === 0) setTrack(null); else void move(index - 1); }} className="cau-btn cau-back"><ArrowLeft size={16} aria-hidden="true" />Back</button>
          <div className="cau-progress-track" role="progressbar" aria-label="Questionnaire progress" aria-valuenow={index} aria-valuemin={0} aria-valuemax={total}>
            <motion.div className="cau-progress-fill" animate={{ width: `${questions.length ? (index / total) * 100 : 0}%` }} transition={{ type: 'spring', stiffness: 280, damping: 32 }} />
          </div>
          <span className="cau-step-label">{index + 1} of {total}</span>
        </div>

        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div key={q.id} custom={dir} variants={questionVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }} className="cau-question-content" style={{ display: 'grid', alignContent: 'start', gap: 14, paddingTop: 6 }}>
            {q.instructions && (
              q.type !== 'multi_select' && <div className="cau-context">{q.instructions.includes('past seven days') ? <CalendarDays size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}<p className="cau-pre-line">{q.instructions}</p></div>
            )}
            <h1 className="cau-question-title">{questionTitle(q)}</h1>
            {status?.reviewId && status.prefill?.answers[q.id] !== undefined && JSON.stringify(status.prefill.answers[q.id]) === JSON.stringify(value) && <p className="cau-eyebrow">Prefilled from your previous baseline</p>}
            {q.type === 'multi_select' && <div className="cau-selection-hint"><span>{q.maxSelections ? `Choose up to ${q.maxSelections}.` : 'Choose all that fit.'}</span><span className="cau-selection-count" aria-live="polite">{Array.isArray(value) ? value.length : 0} selected</span></div>}

            {q.type === 'multi_select' && <p className="cau-muted-sm">Tap a selected answer to remove it.</p>}

            {q.choices.length ? (
              <motion.div className={`cau-choice-list ${q.id === 'cau-starting-point-46' ? 'cau-goal-grid' : ''}`} variants={listVariants} initial="hidden" animate="show">
                {q.choices.map(option => {
                  const selected = Array.isArray(value) ? value.includes(option) : value === option;
                  return (
                    <motion.button key={option} type="button" variants={itemVariants} aria-pressed={selected} data-selected={selected} onClick={() => choose(option)} className="cau-btn cau-choice-btn">
                      <span>{choiceLabel(q, option)}</span>
                      {q.type === 'multi_select'
                        ? <span className="cau-choice-box" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
                        : <span className="cau-choice-radio" aria-hidden="true" />}
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

        <div className="cau-question-actions">
          <p className="cau-save-status" role="status">{track === 'performance' ? (draftSaving ? 'Saving…' : draftSaved ? 'Progress saved' : '') : 'Well-being answers save when you submit'}</p>
          <div className="cau-action-row" data-single={Boolean(q.requiresConfirmation)}>
            {!q.requiresConfirmation && <button type="button" aria-label="Skip this question" className="cau-btn cau-btn-secondary" onClick={() => { if (draftSaving) return; const next = {...answers}; delete next[q.id]; setAnswers(next); void move(index + 1, next); }}>Skip</button>}
            <button type="button" aria-busy={draftSaving} onClick={() => { if (!draftSaving) void move(index + 1); }} className="cau-btn cau-btn-primary">
              {draftSaving ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  function renderStage() {
    if (nativePending) {
      return <div className="cau-stage cau-stage-center"><Spinner /><p role="status">{nativeError || 'Opening your app account…'}</p><button className="cau-btn cau-btn-primary" onClick={()=>{setNativeError('');notifyNative('signIn');}}>Try again</button></div>;
    }
    if (!authReady) {
      return (
        <motion.div key="auth-loading" {...fadeMotion} className="cau-stage cau-stage-center">
          <Spinner />
          <p className="cau-muted">Checking your account…</p>
        </motion.div>
      );
    }

    if (!user && !sandboxTest && !embedded) return renderJoin(false);
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
              <button disabled={signingIn} className="cau-btn cau-btn-primary">
                {signingIn ? <><Loader2 size={16} className="cau-spinner" /> Signing in…</> : <>Sign in to PulseCheck</>}
              </button>
            </form>
          ) : (
            <a href="/PulseCheck/login?returnTo=%2FPulseCheck%2Fbaseline" className="cau-btn cau-btn-primary">
              Sign in to PulseCheck
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
          {error && <button className="cau-btn cau-btn-primary" onClick={()=>window.location.reload()}>Try again</button>}
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
          {sandboxTest ? <p className="cau-body">Your test is complete. Share the receipt below so the team can check both systems.</p>
            : embedded ? <p className="cau-body">Thank you for sharing your starting point. You can return to the app.</p>
            : <p className="cau-body">Thank you for sharing your starting point. Download the {getNativeAppDistribution(status.productBrand).name} app to start training, and sign in with this same account.</p>}
          {!sandboxTest && !embedded ? renderDownload()
            : (status.reviewId || status.teamWorkspaceUrl) && <button type="button" className="cau-btn cau-btn-primary" onClick={continueAfterBaseline}>Continue</button>}
          {error && <ErrorBanner>{error}</ErrorBanner>}
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

    if (!status.available && !status.required && !sandboxTest && !embedded) return renderJoin(true);
    if (!status.available) {
      return (
        <motion.div key="unavailable" {...fadeMotion} className="cau-stage cau-stage-center">
          <div className="cau-empty-icon"><Clock size={24} /></div>
          <h1 className="cau-h1">{status.required ? 'Your baseline is temporarily unavailable' : 'No baseline is required for this account'}</h1>
          <p className="cau-body">{status.required ? 'Please try again. Your saved progress stays connected to your account.' : 'You can return to the app.'}</p>
          <button className="cau-btn cau-btn-primary" onClick={()=>window.location.reload()}>Check again</button>
        </motion.div>
      );
    }

    if ((status.healthAuthorizationRequired || reviewHealthChoice) && status.healthBaselineEnabled !== false) {
      return <div className="cau-stage">
        <h1 className="cau-h1">Your health authorization</h1>
        <ConsentChoices documents={status.healthDocuments || []} decisions={healthChoices} onChange={setHealthChoices} name={name} />
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <button type="button" disabled={consentSaving} className="cau-btn cau-btn-primary" onClick={saveHealthChoice}>{consentSaving ? 'Saving choice…' : 'Save health choice and continue'}</button>
        {!status.healthAuthorizationRequired && <button type="button" className="cau-btn cau-btn-ghost" onClick={()=>setReviewHealthChoice(false)}>Back to baseline</button>}
      </div>;
    }
    if (!started) {
      const accountFields = <>
          <label className="cau-field">
            <span className="cau-field-label">Your name</span>
            <input required maxLength={150} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="cau-input" />
          </label>
          <label className="cau-field">
            <span className="cau-field-label">Email address</span>
            <input readOnly={sandboxTest || Boolean(user.email)} required type="email" maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="cau-input" />
          </label>
      </>;
      return (
        <motion.form key="intro" {...fadeMotion} onSubmit={e => { e.preventDefault(); if (!name.trim()) {setError('Enter your name to begin.');return;} setError('');setStarted(true); }} className="cau-stage cau-form">
          <p className="cau-eyebrow">Your baseline</p>
          <h1 className="cau-h1">Let’s find your starting point.</h1>
          {status.reviewId && <p role="status" className="cau-body">Complete your baseline for {status.teamName || 'your new team'}.</p>}
          <p className="cau-body">{shareHealth ? 'Tell us how you’ve been feeling and which mental skills you’ve used.' : 'Tell us your training goal and which mental skills you’ve used.'}</p>
          <div className="cau-intro-parts">{shareHealth && <div className="cau-intro-part"><span>01</span><strong>How you’ve been feeling</strong></div>}<div className="cau-intro-part"><span>{shareHealth ? '02' : '01'}</span><strong>Your mental skills</strong></div></div>
          <h2 className="cau-h2">A few things to know</h2>
          <div className="cau-intro-facts"><p><Check size={21}/>Answer honestly. You can skip questions.</p><p><HeartPulse size={21}/>Your mental-health answers are not shared with coaches or teammates.</p><p><Target size={21}/>Health sharing is your choice.</p></div>
          <Disclosure summary="How your answers are used"><p className="cau-body-sm">{source.purpose}</p><p className="cau-body-sm">This questionnaire supports onboarding, service delivery, and internal pilot evaluation. It is not a diagnostic assessment or an IRB-approved research study.</p><p className="cau-body-sm">Health sharing follows your current authorization. This questionnaire is not monitored as an emergency service.</p></Disclosure>
          {user.displayName && user.email ? <Disclosure summary="Your account details">{accountFields}</Disclosure> : accountFields}
          <AnimatePresence>{error && <ErrorBanner>{error}</ErrorBanner>}</AnimatePresence>
          <button className="cau-btn cau-btn-primary">Start baseline</button>
        </motion.form>
      );
    }

    if (showSkills) return <ConsolidatedSkillsBaseline embedded precedingItemCount={performanceQuestionCount} sportName={status?.sportName || "Sport"} initialDraft={skillsState?.draft} prefilledFamilies={status?.prefill?.skillsDraft?.answeredFamiliarity} onSaveDraft={draft=>saveSkillsProgress(draft)} onComplete={draft=>saveSkillsProgress(draft,true)} onBack={()=>{setShowSkills(false);setTrack(null);}} />;
    if (track && q) return renderQuestion();
    return renderSections();
  }

  // renderSections fills this during render, so it always holds the actions
  // available on screen right now (empty on every other stage).
  const sectionsMenu = useRef<{id: MenuActionId; run: () => void}[]>([]);
  sectionsMenu.current = [];
  const stage = renderStage();
  const menuKey = sectionsMenu.current.map(item => item.id).join(',');
  useEffect(() => { if (embedded) notifyNative('menu', menuKey); }, [embedded, menuKey]);
  useEffect(() => {
    const run = (event: Event) => sectionsMenu.current.find(item => item.id === (event as CustomEvent<string>).detail)?.run();
    window.addEventListener('pulse-baseline-menu', run);
    return () => window.removeEventListener('pulse-baseline-menu', run);
  }, []);

  return (
    <main className="cau-shell clay-baseline">
      <style dangerouslySetInnerHTML={{ __html: CLAY_BASELINE_THEME + STYLES }} />
      <Head><title>Athlete baseline questionnaire</title><meta name="robots" content="noindex,nofollow" /><meta name="referrer" content="no-referrer" /></Head>

      <div className={`cau-layout ${showSkills || (track && q) ? 'cau-flow-active' : ''}`}>
        {!embedded && <header className="cau-page-header"><span>Your starting point</span><img src="/pulsecheck-wordmark-green.png" alt="PulseCheck" /></header>}
        <div className="cau-page-body"><AnimatePresence mode="wait" initial={false}>{stage}</AnimatePresence></div>

        <AnimatePresence>{signOutError && <ErrorBanner>{signOutError}</ErrorBanner>}</AnimatePresence>

        {user && !embedded && (
          <button type="button" className="cau-btn cau-btn-ghost" style={{ justifySelf: 'center' }} onClick={() => { setSignOutError(''); if (notifyNative('signOut')) return; signOut(auth).catch(() => setSignOutError('Could not sign out. Please try again.')); }}>
            <LogOut size={15} aria-hidden="true" /> Sign out
          </button>
        )}

        <p className="cau-crisis-line">If you need urgent support, call <a href="tel:988">988</a>. In an emergency, call <a href="tel:911">911</a>.</p>
      </div>
    </main>
  );
}
