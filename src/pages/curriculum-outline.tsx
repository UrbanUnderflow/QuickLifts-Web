// =============================================================================
// /curriculum-outline — PulseCheck curriculum outline by track.
//
// Two audiences, one page:
//   1. Non-technical teammates (CMO et al) get the default view: the
//      curriculum as content — pillars, units, lessons, and a click-to-
//      preview modal that shows what the athlete actually experiences
//      in each module (steps, interactive mechanic, reflection).
//   2. Developer tools (toggle, persisted per browser) reveal the
//      seed/sync machinery: doc counts, validation, Seed/Sync buttons,
//      lesson ids, and module reassignment.
//
// Admin surface for the `junior-curriculum` collection: the content
// source of truth for the Junior Track guided curriculum (PulseCheck
// repo: docs/specs/junior-track-guided-curriculum-spec.md) and for the
// junior-lesson-conversation Netlify function.
//
// Uses the CLIENT Firebase SDK with the signed-in admin account, like
// every other admin Firestore surface (curriculumLayer et al) — no
// server credentials needed, works on localhost, and follows the
// global prod/dev database selector. Writes are protected by
// firestore.rules (junior-curriculum is admin-write-only).
//
// Module mapping is a launch gate: iOS refuses to play unmapped or
// chat-handoff-mapped lessons (no fallback). Developer view shows the gate.
//
// The Pro tab is not seeded from a bundled outline — pro is generated
// by the curriculum engine (daily slates, 14-day assignment cycles,
// monthly assessments, pathway ladder). This page renders that system
// honestly instead of "not configured".
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CloudUpload,
  Eye,
  Flag,
  GraduationCap,
  HeartPulse,
  Infinity,
  Layers3,
  Lightbulb,
  Loader2,
  MessageSquarePlus,
  MessageSquareText,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  Wrench,
  X,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import AdminRouteGuard from '../components/auth/AdminRouteGuard';
import { ExercisePlayer } from '../components/mentaltraining';
import { auth, db } from '../api/firebase/config';
import { simModuleLibraryService } from '../api/firebase/mentaltraining/exerciseLibraryService';
import { exerciseFromFirestore } from '../api/firebase/mentaltraining/types';
import curriculumData from '../../scripts/data/junior-curriculum.json';

type JuniorLessonSeed = {
  id: string;
  pillarId: string;
  unitIndex: number;
  unitTitle: string;
  lessonIndex: number;
  title: string;
  durationMinutes: number;
  exerciseId: string;
  exerciseCategory: string;
  noraOpener: string;
  noraProbe: string;
  takeawayCue: string;
  kind: string;
};

type ExerciseOption = {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  handoffRisk: boolean;
  isSim: boolean;
  data: Record<string, any>;
};

type LessonExerciseStatus = 'ok' | 'missing' | 'handoff' | 'category-mismatch';

type LessonRow = JuniorLessonSeed & {
  seeded: boolean;
  effectiveExerciseId: string;
  exerciseStatus: LessonExerciseStatus;
  exerciseName?: string;
};

type CurriculumTrackId = 'rookie' | 'junior' | 'pro';

type CurriculumNoteKind = 'update' | 'issue' | 'idea';
type CurriculumNoteStatus = 'open' | 'resolved';

type CurriculumNote = {
  id: string;
  trackId: CurriculumTrackId;
  targetId: string;
  targetLabel: string;
  kind: CurriculumNoteKind;
  body: string;
  status: CurriculumNoteStatus;
  authorUid: string;
  authorName: string;
  authorEmail: string;
  createdAt?: any;
  updatedAt?: any;
  resolvedAt?: any;
  resolvedByName?: string;
};

type CurriculumTrack = {
  id: CurriculumTrackId;
  label: string;
  ageRange: string;
  description: string;
  status: 'configured' | 'live' | 'planned';
};

const CURRICULUM_TRACKS: CurriculumTrack[] = [
  {
    id: 'rookie',
    label: 'Rookie',
    ageRange: '7-12',
    description: 'Youth-first guided pathway for younger athletes.',
    status: 'planned',
  },
  {
    id: 'junior',
    label: 'Junior',
    ageRange: '13-17',
    description: 'Guided curriculum: three pillars, sequenced units, every lesson mapped to a real module.',
    status: 'configured',
  },
  {
    id: 'pro',
    label: 'Pro',
    ageRange: '18+',
    description: 'Adaptive curriculum generated daily from the full module library.',
    status: 'live',
  },
];

const TRACK_STATUS_LABELS: Record<CurriculumTrack['status'], string> = {
  configured: 'Configured',
  live: 'Live · engine-generated',
  planned: 'In design',
};

const NOTE_KIND_META: Record<CurriculumNoteKind, {
  label: string;
  description: string;
  badge: string;
  button: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  update: {
    label: 'Update needed',
    description: 'A specific curriculum change to make.',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    button: 'border-amber-300 bg-amber-50 text-amber-800',
    icon: MessageSquareText,
  },
  issue: {
    label: 'Issue',
    description: 'Something inaccurate, blocked, or concerning.',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    button: 'border-rose-300 bg-rose-50 text-rose-800',
    icon: CircleAlert,
  },
  idea: {
    label: 'Idea',
    description: 'An improvement worth considering.',
    badge: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    button: 'border-indigo-300 bg-indigo-50 text-indigo-800',
    icon: Lightbulb,
  },
};

const PILLAR_LABELS: Record<string, string> = {
  'champion-mindset': 'Champion Mindset',
  'mental-performance': 'Mental Performance',
  'emotional-regulation': 'Emotional Regulation',
};

const PILLAR_ORDER = ['champion-mindset', 'mental-performance', 'emotional-regulation'];
const PILLAR_META: Record<string, { description: string; accent: string; icon: React.ComponentType<{ className?: string }> }> = {
  'champion-mindset': {
    description: 'Confidence, resilience, and constructive self-talk.',
    accent: 'bg-amber-400',
    icon: Brain,
  },
  'mental-performance': {
    description: 'Focus control and repeatable pressure routines.',
    accent: 'bg-teal-500',
    icon: Target,
  },
  'emotional-regulation': {
    description: 'Emotional awareness, recovery, and body regulation.',
    accent: 'bg-rose-500',
    icon: HeartPulse,
  },
};

type CurriculumJourneyModel = {
  title: string;
  description: string;
  stages: Array<{
    label: string;
    detail: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
  }>;
  continuityRules: string[];
};

const CURRICULUM_JOURNEYS: Record<CurriculumTrackId, CurriculumJourneyModel> = {
  rookie: {
    title: 'A guided beginning that grows into lifelong practice',
    description: 'Rookie is planned around short, age-appropriate guided work that will continue through honest mastery rotations instead of ending after the first sequence.',
    stages: [
      { label: 'Daily practice', detail: 'Short bounded sessions', icon: CalendarDays, tone: 'bg-amber-50 text-amber-700' },
      { label: 'Guided pathway', detail: 'Build the three pillars', icon: BookOpen, tone: 'bg-teal-50 text-teal-700' },
      { label: 'Milestones', detail: 'Celebrate showing up', icon: Trophy, tone: 'bg-indigo-50 text-indigo-700' },
      { label: 'Mastery rotation', detail: 'Practice returns with purpose', icon: RotateCcw, tone: 'bg-rose-50 text-rose-700' },
    ],
    continuityRules: ['Progress only moves forward', 'Gaps pause the journey', 'Returning is a win'],
  },
  junior: {
    title: 'The guided season ends. The training journey does not.',
    description: 'Junior athletes complete the seeded sequence once, earn a Season milestone, then rotate through the same proven modules as mastery practice. Each trained day advances the journey.',
    stages: [
      { label: 'Train all 3', detail: 'One lesson per pillar today', icon: CalendarDays, tone: 'bg-teal-50 text-teal-700' },
      { label: 'Guided season', detail: 'Lessons build the foundation', icon: BookOpen, tone: 'bg-indigo-50 text-indigo-700' },
      { label: 'Season milestone', detail: 'Celebrate the first pass', icon: Trophy, tone: 'bg-amber-50 text-amber-700' },
      { label: 'Mastery rotation', detail: 'Lessons return as practice', icon: RotateCcw, tone: 'bg-rose-50 text-rose-700' },
    ],
    continuityRules: ['Trained days keep increasing', 'Earned milestones never reset', 'A return after a gap is celebrated'],
  },
  pro: {
    title: 'A prescription loop that always creates the next right work',
    description: 'Pro has no fixed course. Daily training feeds adherence and performance signals into repeating blocks, reassessment, and pathway progression so the next prescription stays meaningful.',
    stages: [
      { label: 'Daily slate', detail: '3 protocols and 3 sims', icon: CalendarDays, tone: 'bg-teal-50 text-teal-700' },
      { label: '14-day block', detail: 'Practice toward one focus', icon: Layers3, tone: 'bg-indigo-50 text-indigo-700' },
      { label: 'Adherence gate', detail: 'Below 80% extends 7 days', icon: TrendingUp, tone: 'bg-amber-50 text-amber-700' },
      { label: 'Monthly rebalance', detail: 'Next block targets the gap', icon: RotateCcw, tone: 'bg-rose-50 text-rose-700' },
    ],
    continuityRules: ['The work waits for the athlete', 'Pathway progress never moves backward', 'Repeats are framed as sharpening'],
  },
};
const LESSON_ID_PATTERN = /^[a-z0-9-]{3,64}$/;

const CATEGORY_LABELS: Record<string, string> = {
  breathing: 'Breathing',
  visualization: 'Visualization',
  focus: 'Focus',
  mindset: 'Mindset',
  confidence: 'Confidence',
};

// Pro pathway ladder — raw values match MentalPathway on the engine
// side; display names match the iOS Program tab (plain language, no
// "arousal" on any surface).
const PRO_PATHWAYS: Array<{ raw: string; display: string; blurb: string }> = [
  { raw: 'foundation', display: 'Foundation', blurb: 'Core protocols across all three pillars.' },
  { raw: 'arousal_mastery', display: 'State Control', blurb: 'Shifting energy up or down on command.' },
  { raw: 'focus_mastery', display: 'Focus Mastery', blurb: 'Holding and recovering attention under noise.' },
  { raw: 'confidence_resilience', display: 'Confidence & Resilience', blurb: 'Evidence-based confidence and bounce-back.' },
  { raw: 'pressure_performance', display: 'Pressure Performance', blurb: 'Executing when the moment is biggest.' },
  { raw: 'elite_refinement', display: 'Elite Refinement', blurb: 'Precision work for high performers (MPR 8+).' },
];

// Mirrors exerciseRequiresNoraChatHandoff on iOS (SimRuntimePlayerView.swift):
// mindset journal/reframe/growth and confidence journal/inventory/affirmation
// exercises hand off to Nora chat, which junior athletes cannot access.
const exerciseHandoffRisk = (data: Record<string, any>): boolean => {
  const configType = String(data?.exerciseConfig?.type || '').toLowerCase();
  const config = data?.exerciseConfig?.config || {};
  const innerType = String(config?.type || '').trim().toLowerCase();
  if (configType === 'mindset') {
    return config?.journalRequired === true || innerType === 'reframe' || innerType === 'growth_mindset';
  }
  if (configType === 'confidence') {
    return innerType === 'evidence_journal' || innerType === 'inventory' || innerType === 'affirmations';
  }
  return false;
};

// Mirrors validateLesson in scripts/seedJuniorCurriculum.cjs.
const validateLesson = (lesson: JuniorLessonSeed): string[] => {
  const problems: string[] = [];
  const requiredStrings: Array<keyof JuniorLessonSeed> = [
    'id', 'pillarId', 'unitTitle', 'title', 'exerciseCategory', 'noraOpener', 'noraProbe', 'takeawayCue', 'kind',
  ];
  for (const key of requiredStrings) {
    const value = lesson[key];
    if (typeof value !== 'string' || value.trim() === '') problems.push(`missing/empty ${key}`);
  }
  if (!LESSON_ID_PATTERN.test(lesson.id || '')) problems.push('id must be kebab-case');
  if (!['lesson', 'checkpoint'].includes(lesson.kind)) problems.push(`bad kind: ${lesson.kind}`);
  if (!PILLAR_ORDER.includes(lesson.pillarId)) problems.push(`bad pillarId: ${lesson.pillarId}`);
  if (!Number.isInteger(lesson.unitIndex) || !Number.isInteger(lesson.lessonIndex)) {
    problems.push('unitIndex/lessonIndex must be integers');
  }
  if (!Number.isInteger(lesson.durationMinutes) || lesson.durationMinutes < 1) {
    problems.push('durationMinutes must be a positive integer');
  }
  // PulseCheck AGENTS.md athlete-copy rule: never "rep(s)".
  const copy = `${lesson.title} ${lesson.noraOpener} ${lesson.noraProbe} ${lesson.takeawayCue}`;
  if (/\brep(s|etition|etitions)?\b/i.test(copy)) problems.push('athlete copy contains banned word "rep"');
  return problems;
};

const DEV_MODE_STORAGE_KEY = 'pulsecheck-curriculum-dev-mode';

// ---------------------------------------------------------------------------
// Module preview — what the athlete actually experiences, rendered from
// the live Firestore doc (the same content the apps play).
// ---------------------------------------------------------------------------

type PreviewTarget = { exercise: ExerciseOption; lesson?: LessonRow };

const asStringList = (value: any): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return String(item.text || item.prompt || item.instruction || '');
      return '';
    })
    .map((s) => s.trim())
    .filter(Boolean);
};

const INTERACTION_KIND_LABELS: Record<string, string> = {
  choiceDrill: 'Rapid choice drill',
  guidedDwell: 'Pick, then build the scene',
  lockedReplay: 'Locked replay',
};

const ModulePreviewModal: React.FC<{ target: PreviewTarget; devMode: boolean; onClose: () => void }> = ({ target, devMode, onClose }) => {
  const { exercise, lesson } = target;
  const data = exercise.data;
  const cfg = data?.exerciseConfig?.config || {};
  const phases = Array.isArray(cfg.phases) ? cfg.phases : [];
  const prompts = asStringList(cfg.prompts);
  const instructions = asStringList(data?.instructions);
  const benefits = asStringList(data?.benefits);
  const overview = data?.overview && typeof data.overview === 'object' ? data.overview : null;
  const interaction = data?.interaction && typeof data.interaction === 'object' ? data.interaction : null;
  const reflectionQuestions: any[] = Array.isArray(data?.reflection?.questions) ? data.reflection.questions : [];
  const steps = phases.length ? [] : prompts.length ? prompts : instructions;
  const [isPlaying, setIsPlaying] = useState(false);
  const playableExercise = React.useMemo(
    () => exerciseFromFirestore(exercise.id, data),
    [data, exercise.id],
  );
  const duration = exercise.durationMinutes || lesson?.durationMinutes || 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sectionTitle = (text: string) => (
    <div className="text-[11px] font-bold uppercase tracking-wide text-stone-500">{text}</div>
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-3 backdrop-blur-[2px] sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-preview-title"
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-200 px-5 py-4 sm:px-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Module preview</div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="module-preview-title" className="mt-1 text-xl font-semibold text-stone-950 sm:text-2xl">{exercise.name}</h2>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                {CATEGORY_LABELS[exercise.category] || exercise.category}
              </span>
              {exercise.isSim && (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                  Scored sim
                </span>
              )}
              <span className="text-xs text-stone-400">{duration ? `${duration} min` : 'Self-paced'}</span>
            </div>
            {devMode && <div className="mt-1 font-mono text-xs text-stone-400">{exercise.id}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(true)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              <Play className="h-4 w-4 fill-current text-[#E0FE10]" aria-hidden="true" />
              <span className="hidden sm:inline">Play module</span>
              <span className="sm:hidden">Play</span>
            </button>
            <button onClick={onClose} className="rounded-md border border-stone-200 bg-white p-2 text-stone-500 shadow-sm transition hover:border-stone-300 hover:text-stone-950" aria-label="Close preview">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="space-y-7 overflow-y-auto px-5 py-6 sm:px-6">
          {lesson && (
            <section className="border-l-2 border-teal-500 bg-teal-50/70 px-4 py-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-teal-800">Junior curriculum · {lesson.title}</div>
              <p className="mt-2 text-sm leading-6 text-stone-800">“{lesson.noraOpener}”</p>
              <div className="mt-3 flex items-start gap-2 border-t border-teal-100 pt-3 text-sm text-stone-600">
                <Flag className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
                <p><span className="font-semibold text-stone-800">Takeaway:</span> {lesson.takeawayCue}</p>
              </div>
            </section>
          )}

          {data?.description && (
            <section className="grid gap-4 bg-stone-950 px-5 py-5 text-white sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-teal-300">What the athlete will practice</div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300 sm:text-base">{String(data.description)}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPlaying(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#E0FE10] px-5 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-[#cfe90f]"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Start preview
              </button>
            </section>
          )}

          {overview && (
            <section>
              {sectionTitle('At a glance')}
              <div className="mt-3 grid divide-y divide-stone-200 border-y border-stone-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              {[
                ['Best moment', overview.when],
                ['Training focus', overview.skill || overview.focus],
                ['Time to use', overview.timeScale],
                ['Easy comparison', overview.analogy],
              ]
                .filter(([, v]) => typeof v === 'string' && v)
                .map(([label, value]) => (
                  <div key={String(label)} className="px-0 py-3 sm:px-4 sm:first:pl-0">
                    {sectionTitle(String(label))}
                    <p className="mt-1 text-sm leading-5 text-stone-700">{String(value)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {phases.length > 0 && (
            <section>
              {sectionTitle(`The breath pattern${cfg.cycles ? ` · ${cfg.cycles} rounds` : ''}`)}
              <div className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
                {phases.map((phase: any, i: number) => (
                  <div key={i} className="grid grid-cols-[2.75rem_1fr] items-center gap-3 py-3 text-sm">
                    <span className="font-mono text-sm font-semibold text-teal-700">{Number(phase?.duration) || '—'}s</span>
                    <span className="leading-5 text-stone-700">{String(phase?.instruction || phase?.name || '')}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {steps.length > 0 && (
            <section>
              {sectionTitle(`Guided experience · ${steps.length} steps`)}
              <ol className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
                {steps.map((step, i) => (
                  <li key={i} className="grid grid-cols-[1.75rem_1fr] gap-3 py-3 text-sm">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 text-[11px] font-bold text-stone-600">{i + 1}</span>
                    <span className="pt-0.5 leading-5 text-stone-700">{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {interaction && (
            <section className="border-l-2 border-violet-500 bg-violet-50/70 px-4 py-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-violet-800">Interactive experience</div>
              <h3 className="mt-1 text-base font-semibold text-stone-900">{INTERACTION_KIND_LABELS[String(interaction.kind)] || String(interaction.kind)}</h3>
              <div className="mt-3 space-y-3 text-sm leading-5 text-stone-700">
                {interaction.kind === 'choiceDrill' && Array.isArray(interaction.rounds) && (
                  <>
                    <p className="text-stone-500">{interaction.rounds.length} timed rounds. Each round the athlete picks the right answer before the window closes.</p>
                    {interaction.rounds.slice(0, 3).map((round: any, i: number) => (
                      <div key={i} className="border-t border-violet-100 pt-3">
                        <p className="font-medium text-stone-800">{String(round?.prompt || '')}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {(Array.isArray(round?.choices) ? round.choices : []).map((choice: any, j: number) => (
                            <span key={j} className={`rounded-full px-2 py-0.5 text-[11px] ${choice?.isTarget ? 'bg-emerald-50 text-emerald-700' : 'border border-stone-200 text-stone-500'}`}>
                              {String(choice?.text || choice || '')}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {interaction.rounds.length > 3 && <p className="text-xs text-stone-400">+ {interaction.rounds.length - 3} more rounds</p>}
                  </>
                )}
                {interaction.kind === 'guidedDwell' && (
                  <>
                    <p>{String(interaction.pickPrompt || '')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {asStringList(interaction.pickChoices).map((choice, i) => (
                        <span key={i} className="rounded-full border border-violet-100 bg-white px-2 py-0.5 text-[11px] text-stone-600">{choice}</span>
                      ))}
                    </div>
                    <p className="text-stone-500">
                      They choose {Number(interaction.pickCount) || 3}, then dwell {Number(interaction.dwellSeconds) || 30} seconds in each: “{String(interaction.dwellPrompt || '')}”
                    </p>
                    {interaction.closePrompt && <p className="text-stone-500">Closes with: “{String(interaction.closePrompt)}”</p>}
                  </>
                )}
                {interaction.kind === 'lockedReplay' && (
                  <>
                    {asStringList(interaction.setupPrompts).map((prompt, i) => <p key={i}>{prompt}</p>)}
                    <p className="text-stone-500">
                      Then {Number(interaction.loops) || 5} runs of ~{Number(interaction.loopSeconds) || 20} seconds each: “{String(interaction.loopPrompt || '')}” The athlete taps “{String(interaction.lockCue || 'Lock It In')}” after each clean run.
                    </p>
                    {interaction.closePrompt && <p className="text-stone-500">Closes with: “{String(interaction.closePrompt)}”</p>}
                  </>
                )}
              </div>
            </section>
          )}

          {reflectionQuestions.length > 0 && (
            <section>
              {sectionTitle('Reflection · after the module')}
              <div className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
                {reflectionQuestions.map((question: any, i: number) => (
                  <div key={i} className="py-3 text-sm">
                    <p className="font-medium text-stone-800">{String(question?.prompt || '')}</p>
                    {question?.kind === 'scale' ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 font-semibold text-stone-700">1</span>
                        <span>{String(question?.scaleLowLabel || 'Low')}</span>
                        <span className="h-px flex-1 bg-stone-200" />
                        <span>{String(question?.scaleHighLabel || 'High')}</span>
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 font-semibold text-stone-700">10</span>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {asStringList(question?.choices).map((choice, j) => (
                          <span key={j} className="rounded-full border border-stone-200 px-2 py-0.5 text-[11px] text-stone-500">{choice}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {benefits.length > 0 && (
            <section>
              {sectionTitle('Why it matters')}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {benefits.map((benefit, i) => (
                  <span key={i} className="rounded-full border border-stone-200 bg-[#FAFAF7] px-2.5 py-1 text-xs text-stone-600">{benefit}</span>
                ))}
              </div>
            </section>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-3 border-t border-stone-200 bg-[#FAFAF7] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-5 text-stone-500">Runs the real module player in preview mode. Results are not saved to an athlete profile.</p>
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            <Play className="h-4 w-4 fill-current text-[#E0FE10]" aria-hidden="true" />
            Play module
          </button>
        </div>
      </div>

      </div>

      {isPlaying && (
        <ExercisePlayer
          key={`curriculum-preview-${exercise.id}`}
          exercise={playableExercise}
          previewMode
          onClose={() => setIsPlaying(false)}
          onComplete={() => setIsPlaying(false)}
        />
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const JuniorCurriculumPage: React.FC = () => {
  const bundled = curriculumData as JuniorLessonSeed[];
  const [activeTrackId, setActiveTrackId] = useState<CurriculumTrackId>('junior');
  const [curriculumQuery, setCurriculumQuery] = useState('');
  const [activePillarFilter, setActivePillarFilter] = useState('all');
  const [moduleQuery, setModuleQuery] = useState('');
  const [activeModuleFilter, setActiveModuleFilter] = useState('all');
  const [devMode, setDevMode] = useState(false);
  const [notes, setNotes] = useState<CurriculumNote[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [noteComposerTarget, setNoteComposerTarget] = useState<{ id: string; label: string }>({ id: 'track:junior', label: 'Junior overview' });
  const [noteKind, setNoteKind] = useState<CurriculumNoteKind>('update');
  const [noteBody, setNoteBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingNoteId, setUpdatingNoteId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [seededExerciseIds, setSeededExerciseIds] = useState<Map<string, string>>(new Map());
  const [seededIds, setSeededIds] = useState<Set<string>>(new Set());
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [syncingCopy, setSyncingCopy] = useState(false);
  const [mappingLessonId, setMappingLessonId] = useState<string | null>(null);
  // Lesson whose mapping is being changed: mapped rows show a Reassign
  // button and only reveal the dropdown while this matches their id.
  const [reassigningLessonId, setReassigningLessonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDevMode(window.localStorage.getItem(DEV_MODE_STORAGE_KEY) === '1');
    } catch { /* private mode etc. — default stays off */ }
  }, []);

  const toggleDevMode = useCallback(() => {
    setDevMode((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(DEV_MODE_STORAGE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const validationIssues = React.useMemo(() => {
    const issues: Array<{ id: string; problems: string[] }> = [];
    const seen = new Set<string>();
    for (const lesson of bundled) {
      const problems = validateLesson(lesson);
      if (seen.has(lesson.id)) problems.push('duplicate id');
      seen.add(lesson.id);
      if (problems.length) issues.push({ id: lesson.id || '(no id)', problems });
    }
    return issues;
  }, [bundled]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [curriculumSnap, exercisesSnap] = await Promise.all([
        getDocs(collection(db, 'junior-curriculum')),
        getDocs(query(collection(db, 'mental-exercises'), where('isActive', '==', true))),
      ]);

      const ids = new Set<string>();
      const mappings = new Map<string, string>();
      curriculumSnap.docs.forEach((d) => {
        ids.add(d.id);
        const exerciseId = String(d.data().exerciseId || '');
        if (exerciseId) mappings.set(d.id, exerciseId);
      });
      setSeededIds(ids);
      setSeededExerciseIds(mappings);

      setExercises(
        exercisesSnap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: String(data.name || d.id),
              category: String(data.category || ''),
              durationMinutes: Number(data.durationMinutes || 0),
              handoffRisk: exerciseHandoffRisk(data),
              isSim: Boolean(data.simSpecId),
              data,
            };
          })
          .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let unsubscribeNotes = () => {};
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeNotes();
      if (!firebaseUser) {
        setNotes([]);
        setNotesLoading(false);
        return;
      }
      setNotesLoading(true);
      unsubscribeNotes = onSnapshot(
        collection(db, 'curriculum-notes'),
        (snapshot) => {
          const nextNotes = snapshot.docs
            .map((noteDoc) => ({ id: noteDoc.id, ...noteDoc.data() } as CurriculumNote))
            .filter((note) => ['rookie', 'junior', 'pro'].includes(note.trackId))
            .sort((a, b) => {
              const aTime = a.createdAt?.toMillis?.() || 0;
              const bTime = b.createdAt?.toMillis?.() || 0;
              return bTime - aTime;
            });
          setNotes(nextNotes);
          setNotesError(null);
          setNotesLoading(false);
        },
        (snapshotError) => {
          setNotesError(snapshotError.message);
          setNotesLoading(false);
        },
      );
    });
    return () => {
      unsubscribeNotes();
      unsubscribeAuth();
    };
  }, []);

  const exercisesById = React.useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const juniorSafeExercises = React.useMemo(() => exercises.filter((e) => !e.handoffRisk), [exercises]);

  const rows: LessonRow[] = React.useMemo(() => bundled.map((lesson) => {
    // The seeded doc's exerciseId is the live mapping iOS resolves.
    const effectiveExerciseId = seededExerciseIds.get(lesson.id) ?? lesson.exerciseId;
    const exercise = exercisesById.get(effectiveExerciseId);
    let exerciseStatus: LessonExerciseStatus = 'missing';
    if (lesson.kind === 'checkpoint') exerciseStatus = 'ok';
    else if (exercise?.handoffRisk) exerciseStatus = 'handoff';
    else if (exercise && exercise.category !== lesson.exerciseCategory) exerciseStatus = 'category-mismatch';
    else if (exercise) exerciseStatus = 'ok';
    return {
      ...lesson,
      seeded: seededIds.has(lesson.id),
      effectiveExerciseId,
      exerciseStatus,
      exerciseName: exercise?.name,
    };
  }), [bundled, seededExerciseIds, seededIds, exercisesById]);

  const blockedCount = rows.filter((r) => r.kind !== 'checkpoint' && (r.exerciseStatus === 'missing' || r.exerciseStatus === 'handoff')).length;
  const checkpointCount = bundled.filter((l) => l.kind === 'checkpoint').length;
  const lessonCount = bundled.length - checkpointCount;
  const totalMinutes = bundled.reduce((sum, l) => sum + (Number(l.durationMinutes) || 0), 0);

  const openLessonPreview = useCallback((lesson: LessonRow) => {
    const exercise = exercisesById.get(lesson.effectiveExerciseId);
    if (exercise) setPreview({ exercise, lesson });
  }, [exercisesById]);

  const runSeed = useCallback(async () => {
    if (seeding || validationIssues.length) return;
    if (!window.confirm(`Seed ${bundled.length} curriculum docs into the active Firestore database? Re-running is safe (merge writes, manual module mappings preserved, athlete progress untouched).`)) {
      return;
    }
    setSeeding(true);
    setError(null);
    setActionResult(null);
    try {
      const batch = writeBatch(db);
      const now = Date.now();
      let preservedMappings = 0;
      for (const lesson of bundled) {
        const { id, ...fields } = lesson;
        // Never clobber a manual module mapping with the bundled default:
        // re-seeding refreshes copy, not mappings. Only ids that resolve
        // to a REAL library module count as mappings — dead placeholder
        // ids from earlier seeds are replaced by the bundled defaults.
        const mapped = seededExerciseIds.get(id);
        const payload: Record<string, unknown> = { ...fields, updatedAt: now, seededBy: `curriculum-outline (${auth.currentUser?.email || 'unknown'})` };
        if (mapped && mapped !== lesson.exerciseId && exercisesById.has(mapped)) {
          payload.exerciseId = mapped;
          preservedMappings += 1;
        }
        batch.set(doc(db, 'junior-curriculum', id), payload, { merge: true });
      }
      await batch.commit();
      setActionResult(`Seeded ${bundled.length} docs (${checkpointCount} checkpoints)${preservedMappings ? `, preserved ${preservedMappings} module mapping(s)` : ''}.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSeeding(false);
    }
  }, [seeding, validationIssues.length, bundled, seededExerciseIds, exercisesById, checkpointCount, refresh]);

  const mapExercise = useCallback(async (lessonId: string, exerciseId: string) => {
    if (!exerciseId || mappingLessonId) return;
    const exercise = exercisesById.get(exerciseId);
    if (!exercise || exercise.handoffRisk) {
      setError('That exercise hands off to Nora chat, which junior athletes cannot access.');
      return;
    }
    setMappingLessonId(lessonId);
    setError(null);
    try {
      await setDoc(
        doc(db, 'junior-curriculum', lessonId),
        {
          exerciseId,
          exerciseMappedBy: `curriculum-outline (${auth.currentUser?.email || 'unknown'})`,
          updatedAt: Date.now(),
        },
        { merge: true },
      );
      const lesson = bundled.find((l) => l.id === lessonId);
      const mismatch = lesson && exercise.category !== lesson.exerciseCategory;
      setActionResult(`Mapped ${lessonId} to "${exercise.name}"${mismatch ? ' (note: different category than the lesson)' : ''}.`);
      setReassigningLessonId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMappingLessonId(null);
    }
  }, [mappingLessonId, exercisesById, bundled, refresh]);

  const exerciseStatusChip = (lesson: LessonRow) => {
    const previewable = exercisesById.has(lesson.effectiveExerciseId);
    const baseProps = previewable
      ? { onClick: () => openLessonPreview(lesson), title: 'Preview this module' }
      : {};
    switch (lesson.exerciseStatus) {
      case 'ok':
        return <button type="button" {...baseProps} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100">{lesson.exerciseName}</button>;
      case 'category-mismatch':
        return <button type="button" {...baseProps} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100" title="Mapped exercise is a different category than the lesson">{lesson.exerciseName} · other category</button>;
      case 'handoff':
        return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700" title="This exercise hands off to Nora chat, which juniors cannot access; the junior player refuses to play it. Remap to a junior-safe module.">{lesson.exerciseName} · chat handoff</span>;
      case 'missing':
      default:
        return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700" title="exerciseId does not exist in mental-exercises. The junior player refuses to play unmapped lessons (no fallback) — assign a module before launch.">No module</span>;
    }
  };

  const groupedByPillar = PILLAR_ORDER.map((pillarId) => ({
    pillarId,
    label: PILLAR_LABELS[pillarId] || pillarId,
    units: Object.values(
      rows
        .filter((l) => l.pillarId === pillarId)
        .reduce<Record<number, { unitIndex: number; unitTitle: string; lessons: LessonRow[] }>>((acc, lesson) => {
          acc[lesson.unitIndex] ||= { unitIndex: lesson.unitIndex, unitTitle: lesson.unitTitle, lessons: [] };
          acc[lesson.unitIndex].lessons.push(lesson);
          return acc;
        }, {}),
    ).sort((a, b) => a.unitIndex - b.unitIndex),
  }));

  const mappedLessonCount = Math.max(0, lessonCount - blockedCount);
  const mappingCoverage = lessonCount ? Math.round((mappedLessonCount / lessonCount) * 100) : 0;
  const seededCoverage = bundled.length ? Math.min(100, Math.round((seededIds.size / bundled.length) * 100)) : 0;
  const curriculumReady = blockedCount === 0 && seededIds.size >= bundled.length;
  const normalizedCurriculumQuery = curriculumQuery.trim().toLowerCase();
  const filteredGroupedByPillar = groupedByPillar
    .filter((pillar) => activePillarFilter === 'all' || pillar.pillarId === activePillarFilter)
    .map((pillar) => ({
      ...pillar,
      units: pillar.units
        .map((unit) => ({
          ...unit,
          lessons: unit.lessons.filter((lesson) => {
            if (!normalizedCurriculumQuery) return true;
            return [
              lesson.title,
              lesson.exerciseName,
              lesson.unitTitle,
              lesson.id,
              pillar.label,
            ].some((value) => String(value || '').toLowerCase().includes(normalizedCurriculumQuery));
          }),
        }))
        .filter((unit) => unit.lessons.length > 0),
    }))
    .filter((pillar) => pillar.units.length > 0);

  const exercisesByCategory = React.useMemo(() => {
    const protocols = exercises.filter((e) => !e.isSim);
    const sims = exercises.filter((e) => e.isSim);
    const groups: Array<{ key: string; label: string; items: ExerciseOption[] }> = [];
    for (const category of Object.keys(CATEGORY_LABELS)) {
      const items = protocols.filter((e) => e.category === category);
      if (items.length) groups.push({ key: category, label: CATEGORY_LABELS[category], items });
    }
    const uncategorized = protocols.filter((e) => !CATEGORY_LABELS[e.category]);
    if (uncategorized.length) groups.push({ key: 'other', label: 'Other', items: uncategorized });
    if (sims.length) groups.push({ key: 'sims', label: 'Scored Simulations', items: sims });
    return groups;
  }, [exercises]);

  const filteredExercisesByCategory = React.useMemo(() => {
    const normalizedQuery = moduleQuery.trim().toLowerCase();
    return exercisesByCategory
      .filter((group) => activeModuleFilter === 'all' || group.key === activeModuleFilter)
      .map((group) => ({
        ...group,
        items: group.items.filter((exercise) => {
          if (!normalizedQuery) return true;
          return [exercise.name, exercise.id, group.label]
            .some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [activeModuleFilter, exercisesByCategory, moduleQuery]);

  const activeTrack = CURRICULUM_TRACKS.find((track) => track.id === activeTrackId) || CURRICULUM_TRACKS[1];
  const activeJourney = CURRICULUM_JOURNEYS[activeTrack.id];
  useEffect(() => {
    setNoteComposerTarget({ id: `track:${activeTrack.id}`, label: `${activeTrack.label} overview` });
  }, [activeTrack.id, activeTrack.label]);
  const noteTargetOptions = React.useMemo(() => {
    const baseTargets = [
      { id: `track:${activeTrack.id}`, label: `${activeTrack.label} overview` },
      { id: `journey:${activeTrack.id}`, label: 'Ongoing curriculum model' },
    ];
    if (activeTrack.id === 'junior') {
      return [
        ...baseTargets,
        ...PILLAR_ORDER.map((pillarId) => ({ id: `pillar:${pillarId}`, label: PILLAR_LABELS[pillarId] })),
      ];
    }
    if (activeTrack.id === 'pro') {
      return [
        ...baseTargets,
        { id: 'pro:pathway', label: 'Pathway ladder' },
        { id: 'pro:library', label: 'Module library' },
      ];
    }
    return [...baseTargets, { id: 'rookie:outline', label: 'Planned Rookie outline' }];
  }, [activeTrack.id, activeTrack.label]);
  const activeTrackNotes = notes.filter((note) => note.trackId === activeTrack.id);
  const activeOpenNotes = activeTrackNotes.filter((note) => note.status === 'open');
  const resolvedTrackNotes = activeTrackNotes.filter((note) => note.status === 'resolved');
  const journeyInventoryLabel = activeTrack.id === 'rookie'
    ? 'Library planned'
    : activeTrack.id === 'junior'
      ? `${juniorSafeExercises.length} junior-safe modules`
      : `${exercises.length} active modules`;

  const notesForTarget = useCallback((targetId: string, trackId: CurriculumTrackId = activeTrack.id) => (
    notes.filter((note) => note.trackId === trackId && note.targetId === targetId && note.status === 'open')
  ), [activeTrack.id, notes]);

  const noteTone = useCallback((targetNotes: CurriculumNote[]) => {
    if (targetNotes.some((note) => note.kind === 'issue')) return NOTE_KIND_META.issue.badge;
    if (targetNotes.some((note) => note.kind === 'update')) return NOTE_KIND_META.update.badge;
    return NOTE_KIND_META.idea.badge;
  }, []);

  const openNotesPanel = useCallback((target: { id: string; label: string }) => {
    setNoteComposerTarget(target);
    setNotesOpen(true);
  }, []);

  const noteBadge = (targetId: string, targetLabel: string) => {
    const targetNotes = notesForTarget(targetId);
    const hasNotes = targetNotes.length > 0;
    return (
      <button
        type="button"
        onClick={() => openNotesPanel({ id: targetId, label: targetLabel })}
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition ${hasNotes ? noteTone(targetNotes) : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-900'}`}
        title={hasNotes ? `${targetNotes.length} open note${targetNotes.length === 1 ? '' : 's'} for ${targetLabel}` : `Leave a note for ${targetLabel}`}
      >
        {hasNotes ? <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" /> : <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />}
        {hasNotes ? targetNotes.length : 'Add note'}
      </button>
    );
  };

  const submitNote = useCallback(async () => {
    const body = noteBody.trim();
    if (!body || savingNote) return;
    setSavingNote(true);
    setNotesError(null);
    try {
      const currentAdmin = auth.currentUser;
      const authorEmail = currentAdmin?.email || '';
      const authorName = currentAdmin?.displayName || authorEmail.split('@')[0] || 'Pulse admin';
      await addDoc(collection(db, 'curriculum-notes'), {
        trackId: activeTrack.id,
        targetId: noteComposerTarget.id,
        targetLabel: noteComposerTarget.label,
        kind: noteKind,
        body,
        status: 'open',
        authorUid: currentAdmin?.uid || '',
        authorName,
        authorEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNoteBody('');
      setNoteKind('update');
    } catch (noteError) {
      setNotesError(noteError instanceof Error ? noteError.message : String(noteError));
    } finally {
      setSavingNote(false);
    }
  }, [activeTrack.id, noteBody, noteComposerTarget.id, noteComposerTarget.label, noteKind, savingNote]);

  const setNoteStatus = useCallback(async (note: CurriculumNote, status: CurriculumNoteStatus) => {
    if (updatingNoteId) return;
    setUpdatingNoteId(note.id);
    setNotesError(null);
    try {
      const currentAdmin = auth.currentUser;
      const adminName = currentAdmin?.displayName || currentAdmin?.email?.split('@')[0] || 'Pulse admin';
      await updateDoc(doc(db, 'curriculum-notes', note.id), {
        status,
        updatedAt: serverTimestamp(),
        resolvedAt: status === 'resolved' ? serverTimestamp() : null,
        resolvedByUid: status === 'resolved' ? currentAdmin?.uid || '' : null,
        resolvedByName: status === 'resolved' ? adminName : null,
      });
    } catch (noteError) {
      setNotesError(noteError instanceof Error ? noteError.message : String(noteError));
    } finally {
      setUpdatingNoteId(null);
    }
  }, [updatingNoteId]);

  const formatNoteTime = (value: any) => {
    const date = value?.toDate?.();
    if (!date) return 'Just now';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
  };

  // -------------------------------------------------------------------------
  // Clean (default) lesson row — content only, click to preview.
  // -------------------------------------------------------------------------
  const cleanLessonRow = (lesson: LessonRow) => {
    const previewable = lesson.kind !== 'checkpoint' && exercisesById.has(lesson.effectiveExerciseId);
    if (lesson.kind === 'checkpoint') {
      return (
        <div key={lesson.id} className="flex min-h-14 items-center gap-3 bg-amber-50/70 px-3 py-2.5 text-sm">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-white text-amber-600">
            <Flag className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-stone-800">{lesson.title}</span>
            <span className="block text-xs text-amber-700">Unit checkpoint</span>
          </span>
          <span className="text-xs font-medium text-stone-500">{lesson.durationMinutes} min</span>
        </div>
      );
    }

    if (!previewable) {
      return (
        <div key={lesson.id} className="grid min-h-14 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-stone-100 text-xs font-semibold text-stone-500">{lesson.lessonIndex}</span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-stone-800">{lesson.title}</span>
            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-rose-600">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Needs a playable module
            </span>
          </span>
          <span className="text-xs font-medium text-stone-500">{lesson.durationMinutes} min</span>
        </div>
      );
    }

    return (
      <button
        key={lesson.id}
        type="button"
        onClick={() => openLessonPreview(lesson)}
        aria-label={`Preview ${lesson.title}: ${lesson.exerciseName || 'module'}`}
        className="group grid min-h-14 w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-stone-50 focus:bg-stone-50 focus:outline-none"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-stone-100 text-xs font-semibold text-stone-500 transition group-hover:bg-stone-900 group-hover:text-white">{lesson.lessonIndex}</span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-stone-900">{lesson.title}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-stone-500">
            <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
            <span className="truncate">{lesson.exerciseName}</span>
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className="text-xs font-medium text-stone-500">{lesson.durationMinutes} min</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 transition group-hover:border-stone-900 group-hover:bg-stone-900 group-hover:text-[#E0FE10]">
            <Eye className="h-4 w-4" aria-hidden="true" />
          </span>
        </span>
      </button>
    );
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Curriculum Outline | Pulse Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen bg-[#FAFAF7] text-stone-900">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-teal-700" />
                  <span className="text-xs font-bold uppercase tracking-wide text-stone-400">Curriculum administration</span>
                </div>
                <h1 className="text-3xl font-bold tracking-normal text-stone-950 md:text-4xl">
                  {activeTrack.label} Curriculum
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
                  {devMode
                    ? 'Source-of-truth curriculum view with seed status, module mapping, and Firestore maintenance tools.'
                    : activeTrack.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openNotesPanel({ id: `track:${activeTrack.id}`, label: `${activeTrack.label} overview` })}
                  className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold shadow-sm transition ${activeOpenNotes.length ? noteTone(activeOpenNotes) : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-950'}`}
                >
                  <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                  Notes
                  {activeOpenNotes.length > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-stone-900 px-1.5 py-0.5 text-[10px] text-white">
                      {activeOpenNotes.length}
                    </span>
                  )}
                </button>
                <span className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-600 shadow-sm">
                  <span className={`h-2 w-2 rounded-full ${activeTrack.status === 'live' ? 'bg-emerald-500' : activeTrack.status === 'configured' ? 'bg-teal-500' : 'bg-amber-400'}`} />
                  {TRACK_STATUS_LABELS[activeTrack.status]}
                </span>
                <button
                  type="button"
                  onClick={toggleDevMode}
                  aria-pressed={devMode}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${
                    devMode
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-stone-200 bg-white text-stone-600 shadow-sm hover:border-stone-300 hover:text-stone-950'
                  }`}
                >
                  <Wrench className="h-4 w-4" aria-hidden="true" />
                  {devMode ? 'Developer tools on' : 'Developer tools'}
                </button>
              </div>
          </header>

          <nav aria-label="Curriculum tracks" className="my-6 grid overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm md:grid-cols-3">
            {CURRICULUM_TRACKS.map((track) => {
              const selected = track.id === activeTrack.id;
              const dotClassName = track.id === 'rookie' ? 'bg-amber-400' : track.id === 'junior' ? 'bg-teal-500' : 'bg-indigo-500';
              const trackNotes = notes.filter((note) => note.trackId === track.id && note.status === 'open');
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => setActiveTrackId(track.id)}
                  aria-pressed={selected}
                  style={{ backgroundColor: selected ? '#1c1917' : '#ffffff' }}
                  className={`flex min-h-20 items-center gap-3 border-b px-4 py-3 text-left transition last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 ${
                    selected ? 'text-white' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClassName}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{track.label} <span className={selected ? 'text-stone-300' : 'text-stone-400'}>({track.ageRange})</span></span>
                    <span className={`mt-0.5 block truncate text-xs ${selected ? 'text-stone-300' : 'text-stone-400'}`}>{TRACK_STATUS_LABELS[track.status]}</span>
                  </span>
                  {trackNotes.length > 0 && (
                    <span className={`inline-flex min-w-6 items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${selected ? 'border-white/20 bg-white/10 text-white' : noteTone(trackNotes)}`} title={`${trackNotes.length} open note${trackNotes.length === 1 ? '' : 's'}`}>
                      {trackNotes.length}
                    </span>
                  )}
                  {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#E0FE10]" aria-hidden="true" />}
                </button>
              );
            })}
          </nav>

          <main className="min-w-0">
          <section className="mb-6 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            <div className="grid gap-6 bg-stone-950 px-5 py-5 text-white lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-6">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#E0FE10] text-stone-950">
                  <Infinity className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-teal-300">Ongoing curriculum model</div>
                  <h2 className="mt-1 text-xl font-semibold sm:text-2xl">{activeJourney.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-300">{activeJourney.description}</p>
                  <button
                    type="button"
                    onClick={() => openNotesPanel({ id: `journey:${activeTrack.id}`, label: 'Ongoing curriculum model' })}
                    className={`mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition ${notesForTarget(`journey:${activeTrack.id}`).length ? 'border-white/20 bg-white/10 text-white' : 'border-stone-700 bg-stone-900 text-stone-300 hover:border-stone-500 hover:text-white'}`}
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
                    {notesForTarget(`journey:${activeTrack.id}`).length ? `${notesForTarget(`journey:${activeTrack.id}`).length} open` : 'Leave note'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-stone-700 text-center text-xs lg:min-w-[340px]">
                <div className="px-3">
                  <span className="block font-bold text-white">Finite content</span>
                  <span className="mt-1 block text-stone-400">{loading ? 'Loading library' : journeyInventoryLabel}</span>
                </div>
                <div className="px-3">
                  <span className="block font-bold text-white">No end state</span>
                  <span className="mt-1 block text-stone-400">Practice keeps cycling</span>
                </div>
                <div className="px-3">
                  <span className="block font-bold text-white">Visible win</span>
                  <span className="mt-1 block text-stone-400">Consistency over speed</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-5 lg:px-6">
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch">
                {activeJourney.stages.map((stage, index) => {
                  const StageIcon = stage.icon;
                  return (
                    <React.Fragment key={stage.label}>
                      <div className="flex min-h-24 items-start gap-3 py-2 md:block md:text-center">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md md:mx-auto ${stage.tone}`}>
                          <StageIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 md:mt-3">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Stage {index + 1}</div>
                          <h3 className="mt-0.5 text-sm font-semibold text-stone-900">{stage.label}</h3>
                          <p className="mt-1 text-xs leading-5 text-stone-500">{stage.detail}</p>
                        </div>
                      </div>
                      {index < activeJourney.stages.length - 1 && (
                        <span className="hidden items-center text-stone-300 md:flex" aria-hidden="true">
                          <ArrowRight className="h-5 w-5" />
                        </span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 border-t border-stone-100 pt-4 text-xs font-semibold text-stone-600">
                <RotateCcw className="h-4 w-4 text-teal-600" aria-hidden="true" />
                {activeTrack.id === 'pro' ? 'Reassessment shapes the next daily slate' : 'Mastery rotation feeds the next trained day'}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-stone-200 bg-[#FAFAF7] px-5 py-3 sm:flex-row sm:items-center sm:gap-5 lg:px-6">
              <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Forward-only rules</span>
              {activeJourney.continuityRules.map((rule) => (
                <span key={rule} className="flex items-center gap-1.5 text-xs text-stone-600">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  {rule}
                </span>
              ))}
            </div>
          </section>

          {error && (
            <div className="mb-5 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {actionResult && (
            <div className="mb-5 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{actionResult}</span>
            </div>
          )}

          {loading && activeTrack.id !== 'rookie' ? (
            <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-500 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading curriculum and module library…
            </div>
          ) : activeTrack.id === 'rookie' ? (
            <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase text-stone-400">Rookie · Ages 7-12</div>
                  <h2 className="mt-2 text-lg font-semibold text-stone-950">Rookie Curriculum</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
                    Planned. Rookie will follow the Junior model — three pillars, short guided lessons, no free typing —
                    with younger copy and shorter sessions for ages 7-12.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {noteBadge('rookie:outline', 'Planned Rookie outline')}
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    In design
                  </span>
                </div>
              </div>
              {devMode && (
                <div className="mt-6 rounded-lg border border-dashed border-stone-300 bg-[#FAFAF7] p-5 text-sm text-stone-500">
                  No bundled rookie outline is wired yet — there is no rookie seed JSON or collection.
                </div>
              )}
            </section>
          ) : activeTrack.id === 'pro' ? (
            <>
              <section aria-label="Pro curriculum summary" className="mb-6 grid overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Active modules', value: exercises.length, detail: 'Finite engine inventory', icon: Layers3, tone: 'text-teal-700 bg-teal-50' },
                  { label: 'Daily slate', value: '3 + 3', detail: 'Protocols and simulations', icon: CalendarDays, tone: 'text-indigo-700 bg-indigo-50' },
                  { label: 'Training block', value: '14 days', detail: 'Extends 7 days below 80%', icon: TrendingUp, tone: 'text-amber-700 bg-amber-50' },
                  { label: 'Reassessment', value: '30 days', detail: 'Targets the largest gap', icon: RotateCcw, tone: 'text-rose-700 bg-rose-50' },
                ].map((metric) => {
                  const MetricIcon = metric.icon;
                  return (
                    <div key={metric.label} className="flex items-center gap-3 border-b border-stone-200 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:[&:nth-child(2)]:border-r-0 lg:[&:nth-child(2)]:border-r lg:last:border-r-0">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${metric.tone}`}>
                        <MetricIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-stone-400">{metric.label}</span>
                        <span className="mt-0.5 block text-xl font-bold text-stone-950">{metric.value}</span>
                        <span className="block truncate text-xs text-stone-500">{metric.detail}</span>
                      </span>
                    </div>
                  );
                })}
              </section>

              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Adaptive content map</div>
                  <h2 className="mt-1 text-xl font-semibold text-stone-950">Pathway and module inventory</h2>
                  <p className="mt-1 text-sm text-stone-500">The pathway defines long-term progression. The engine selects daily work from the finite module inventory below.</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                  <Infinity className="h-3.5 w-3.5" aria-hidden="true" /> New work is prescribed continuously
                </span>
              </div>

              <section className="mb-5 flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                <label className="relative block min-w-0 flex-1 lg:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
                  <span className="sr-only">Search module inventory</span>
                  <input
                    value={moduleQuery}
                    onChange={(event) => setModuleQuery(event.target.value)}
                    placeholder="Search modules"
                    className="h-10 w-full rounded-md border border-stone-200 bg-[#FAFAF7] pl-9 pr-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                  />
                </label>
                <div className="flex min-w-0 gap-1 overflow-x-auto" aria-label="Filter module inventory by category">
                  {[{ key: 'all', label: 'All modules' }, ...exercisesByCategory.map((group) => ({ key: group.key, label: group.label }))].map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setActiveModuleFilter(filter.key)}
                      aria-pressed={activeModuleFilter === filter.key}
                      className={`h-9 shrink-0 rounded-md px-3 text-xs font-semibold transition ${activeModuleFilter === filter.key ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'}`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </section>

              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-6">
                  <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                    <header className="flex flex-col gap-3 border-b border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
                          <TrendingUp className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <h2 className="text-lg font-semibold text-stone-950">Pathway ladder</h2>
                          <p className="text-xs text-stone-500">Six forward-only stages of athlete development</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {noteBadge('pro:pathway', 'Pathway ladder')}
                        <span className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-500">6 stages</span>
                      </div>
                    </header>
                    <div className="grid gap-px bg-stone-200 sm:grid-cols-2">
                      {PRO_PATHWAYS.map((pathway, index) => (
                        <div key={pathway.raw} className="flex min-h-24 gap-3 bg-white p-4">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-950 text-xs font-bold text-[#E0FE10]">{index + 1}</span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-stone-900">{pathway.display}</span>
                            <span className="mt-1 block text-xs leading-5 text-stone-500">{pathway.blurb}</span>
                            {devMode && <span className="mt-1 block font-mono text-[10px] text-stone-400">{pathway.raw}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                    <header className="flex flex-col gap-3 border-b border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
                          <Layers3 className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <h2 className="text-lg font-semibold text-stone-950">Module library</h2>
                          <p className="text-xs text-stone-500">Active content available to the prescription engine</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {noteBadge('pro:library', 'Module library')}
                        <span className="text-xs font-medium text-stone-500">{exercises.length} active modules</span>
                      </div>
                    </header>

                    <div className="grid gap-px bg-stone-200 xl:grid-cols-2">
                      {filteredExercisesByCategory.map((group) => (
                        <div key={group.key} className="bg-white p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{group.label}</div>
                            <span className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-500">{group.items.length}</span>
                          </div>
                          <div className="divide-y divide-stone-200 overflow-hidden rounded-md border border-stone-200">
                            {group.items.map((exercise) => (
                              <button
                                key={exercise.id}
                                type="button"
                                onClick={() => setPreview({ exercise })}
                                aria-label={`Preview ${exercise.name}`}
                                className="group grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-stone-50 focus:bg-stone-50 focus:outline-none"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-stone-800">{exercise.name}</span>
                                  <span className="mt-0.5 block truncate text-xs text-stone-400">
                                    {exercise.isSim ? 'Scored simulation' : group.label}{devMode ? ` · ${exercise.id}` : ''}
                                  </span>
                                </span>
                                <span className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-stone-500">{exercise.durationMinutes || '—'} min</span>
                                  <span className="flex h-8 w-8 items-center justify-center rounded-md text-teal-700 transition group-hover:bg-teal-50" title="Preview module">
                                    <Eye className="h-4 w-4" aria-hidden="true" />
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {filteredExercisesByCategory.length === 0 && (
                      <div className="px-6 py-12 text-center">
                        <Search className="mx-auto h-6 w-6 text-stone-300" aria-hidden="true" />
                        <h3 className="mt-3 text-sm font-semibold text-stone-900">No modules found</h3>
                        <p className="mt-1 text-sm text-stone-500">Try a different search or show all modules.</p>
                      </div>
                    )}
                  </section>

                  {devMode && (
                    <section className="rounded-lg border border-dashed border-stone-300 bg-[#FAFAF7] p-4 text-xs leading-5 text-stone-500">
                      Engine surfaces: `ensure-todays-curriculum-assignment` (daily slate), `mental-curriculum-assignments`
                      (14-day cycles), `pulsecheck-curriculum-assessments` (monthly rollups), `athlete-mental-progress`
                      (pathway state). Pro has no bundled seed JSON.
                    </section>
                  )}
                </div>

                <aside className="space-y-4 lg:sticky lg:top-24">
                  <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                    <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-emerald-700">
                          <Infinity className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Engine policy</div>
                          <h2 className="text-base font-semibold text-stone-950">Always generating work</h2>
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="divide-y divide-stone-100 border-y border-stone-100 text-xs">
                        {[
                          { label: 'Daily inventory', value: '3 + 3', icon: CalendarDays },
                          { label: 'Block length', value: '14 days', icon: Layers3 },
                          { label: 'Extension rule', value: '+7 days', icon: TrendingUp },
                          { label: 'Reassessment', value: '30 days', icon: RotateCcw },
                          { label: 'Pathway stages', value: '6 total', icon: Trophy },
                        ].map((policy) => {
                          const PolicyIcon = policy.icon;
                          return (
                            <div key={policy.label} className="flex items-center justify-between py-2.5">
                              <span className="flex items-center gap-2 text-stone-500"><PolicyIcon className="h-3.5 w-3.5" aria-hidden="true" /> {policy.label}</span>
                              <span className="font-semibold text-stone-800">{policy.value}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 rounded-md bg-[#FAFAF7] p-3">
                        <div className="flex items-start gap-2 text-xs font-semibold leading-5 text-stone-700">
                          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                          The work waits for the athlete. Pathway progress never moves backward.
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Admin guide</div>
                    <p className="mt-2 text-xs leading-5 text-stone-600">Select any module to inspect the athlete experience and run it in preview mode. Developer tools expose the engine collection details.</p>
                  </section>
                </aside>
              </div>
            </>
          ) : (
            <>
              <section aria-label="Curriculum summary" className="mb-6 grid overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'First-season lessons', value: lessonCount, detail: 'Across 3 pillars', icon: BookOpen, tone: 'text-teal-700 bg-teal-50' },
                  { label: 'Checkpoints', value: checkpointCount, detail: 'One per unit', icon: Flag, tone: 'text-amber-700 bg-amber-50' },
                  { label: 'Training time', value: `${totalMinutes} min`, detail: 'First guided season', icon: Clock3, tone: 'text-indigo-700 bg-indigo-50' },
                  { label: 'Module coverage', value: `${mappingCoverage}%`, detail: blockedCount ? `${blockedCount} need attention` : 'All lessons playable', icon: ShieldCheck, tone: blockedCount ? 'text-rose-700 bg-rose-50' : 'text-emerald-700 bg-emerald-50' },
                ].map((metric) => {
                  const MetricIcon = metric.icon;
                  return (
                    <div key={metric.label} className="flex items-center gap-3 border-b border-stone-200 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:[&:nth-child(2)]:border-r-0 lg:[&:nth-child(2)]:border-r lg:last:border-r-0">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${metric.tone}`}>
                        <MetricIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-stone-400">{metric.label}</span>
                        <span className="mt-0.5 block text-xl font-bold text-stone-950">{metric.value}</span>
                        <span className="block truncate text-xs text-stone-500">{metric.detail}</span>
                      </span>
                    </div>
                  );
                })}
              </section>

              {devMode && (
                <section className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="flex-1">
                    <div className="text-sm text-stone-500">
                      Bundled: <span className="font-semibold text-stone-950">{bundled.length} docs</span>
                      {' '}({checkpointCount} checkpoints) · Seeded:{' '}
                      <span className={`font-semibold ${seededIds.size >= bundled.length ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {seededIds.size}
                      </span>
                      {blockedCount > 0 ? (
                        <span className="font-semibold text-rose-700"> · {blockedCount} module{blockedCount === 1 ? '' : 's'} unmapped</span>
                      ) : (
                        <span className="font-semibold text-emerald-700"> · all modules mapped</span>
                      )}
                      {' '}· {juniorSafeExercises.length} junior-safe modules in library
                    </div>
                    {validationIssues.length > 0 && (
                      <div className="mt-2 text-sm text-rose-700">
                        {validationIssues.length} validation issue(s) — seeding is blocked until fixed:
                        {validationIssues.map((issue) => (
                          <div key={issue.id} className="ml-2 mt-1">• {issue.id}: {issue.problems.join('; ')}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={refresh}
                    disabled={loading}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-500 shadow-sm transition hover:text-stone-950 disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" /> Refresh
                  </button>
                  <button
                    onClick={async () => {
                      if (syncingCopy) return;
                      if (!window.confirm('Push seeded module copy (names, instructions, prompts, configs) onto the existing library docs in the active Firestore database? Merge-writes; runtime fields survive.')) return;
                      setSyncingCopy(true);
                      setError(null);
                      try {
                        const result = await simModuleLibraryService.syncSeededCopy();
                        setActionResult(`Synced seeded copy onto ${result.updated} library modules.`);
                        await refresh();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                      } finally {
                        setSyncingCopy(false);
                      }
                    }}
                    disabled={syncingCopy}
                    title="Pushes copy fixes from the bundled module seed (e.g. instruction wording) onto existing sim-modules docs."
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-500 shadow-sm transition hover:text-stone-950 disabled:opacity-50"
                  >
                    {syncingCopy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {syncingCopy ? 'Syncing…' : 'Sync Module Copy'}
                  </button>
                  <button
                    onClick={runSeed}
                    disabled={seeding || validationIssues.length > 0}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-700 disabled:opacity-50"
                  >
                    {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                    {seeding ? 'Seeding…' : `Seed ${bundled.length} Docs`}
                  </button>
                </section>
              )}

              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Finite content map</div>
                  <h2 className="mt-1 text-xl font-semibold text-stone-950">Guided season outline</h2>
                  <p className="mt-1 text-sm text-stone-500">This seeded sequence is the athlete&apos;s first pass. After it, these lessons feed the mastery rotation above.</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Continues through mastery
                </span>
              </div>

              <section className="mb-5 flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                <label className="relative block min-w-0 flex-1 lg:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
                  <span className="sr-only">Search curriculum</span>
                  <input
                    value={curriculumQuery}
                    onChange={(event) => setCurriculumQuery(event.target.value)}
                    placeholder="Search lessons, modules, or units"
                    className="h-10 w-full rounded-md border border-stone-200 bg-[#FAFAF7] pl-9 pr-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                  />
                </label>
                <div className="flex min-w-0 gap-1 overflow-x-auto" aria-label="Filter by curriculum pillar">
                  {[{ id: 'all', label: 'All pillars' }, ...PILLAR_ORDER.map((id) => ({ id, label: PILLAR_LABELS[id].replace('Emotional ', '') }))].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setActivePillarFilter(filter.id)}
                      aria-pressed={activePillarFilter === filter.id}
                      className={`h-9 shrink-0 rounded-md px-3 text-xs font-semibold transition ${activePillarFilter === filter.id ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'}`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </section>

              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-6">
                {filteredGroupedByPillar.map((pillar) => {
                  const meta = PILLAR_META[pillar.pillarId];
                  const PillarIcon = meta.icon;
                  const visibleLessons = pillar.units.flatMap((unit) => unit.lessons);
                  const visibleLessonCount = visibleLessons.filter((lesson) => lesson.kind !== 'checkpoint').length;
                  const visibleMinutes = visibleLessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0);
                  return (
                  <section key={pillar.pillarId} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                    <header className="flex flex-col gap-3 border-b border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-md text-stone-950 ${meta.accent}`}>
                          <PillarIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <h2 className="text-lg font-semibold text-stone-950">{pillar.label}</h2>
                          <p className="text-xs text-stone-500">{meta.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium text-stone-500">
                        {noteBadge(`pillar:${pillar.pillarId}`, pillar.label)}
                        <span>{visibleLessonCount} lessons</span>
                        <span className="h-1 w-1 rounded-full bg-stone-300" />
                        <span>{visibleMinutes} min</span>
                      </div>
                    </header>
                    <div className="grid gap-px bg-stone-200 xl:grid-cols-2">
                      {pillar.units.map((unit) => (
                        <div key={unit.unitIndex} className="bg-white p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Unit {unit.unitIndex}</div>
                              <h3 className="mt-0.5 text-sm font-semibold text-stone-900">{unit.unitTitle}</h3>
                            </div>
                            <span className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-500">{unit.lessons.length} items</span>
                          </div>
                          <div className={devMode ? 'space-y-1' : 'divide-y divide-stone-200 overflow-hidden rounded-md border border-stone-200'}>
                            {devMode ? unit.lessons.map((lesson) => (
                              <div
                                key={lesson.id}
                                className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm"
                              >
                                <div className="flex items-center gap-3">
                                  {lesson.kind === 'checkpoint'
                                    ? <Flag className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                    : <span className="w-3.5 shrink-0 text-center text-xs text-stone-400">{lesson.lessonIndex}</span>}
                                  <span className="flex-1 text-stone-800">{lesson.title}</span>
                                  <span className="text-xs text-stone-400">{lesson.durationMinutes} min</span>
                                  <span className="font-mono text-xs text-stone-400">{lesson.id}</span>
                                  {lesson.seeded ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <span className="text-xs font-semibold text-amber-700">not seeded</span>
                                  )}
                                </div>
                                {lesson.kind !== 'checkpoint' && (() => {
                                  const isMapped = lesson.exerciseStatus === 'ok' || lesson.exerciseStatus === 'category-mismatch';
                                  const showPicker = !isMapped || reassigningLessonId === lesson.id;
                                  return (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-6">
                                      <span className="text-[11px] uppercase tracking-wide text-stone-400">Module</span>
                                      {exerciseStatusChip(lesson)}
                                      {showPicker ? (
                                        <>
                                          <select
                                            value=""
                                            disabled={!lesson.seeded || mappingLessonId !== null || !juniorSafeExercises.length}
                                            onChange={(e) => mapExercise(lesson.id, e.target.value)}
                                            className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs text-stone-600 outline-none transition focus:border-stone-400 disabled:opacity-40"
                                            title={!lesson.seeded ? 'Seed the curriculum before mapping modules' : 'Assign a junior-safe module'}
                                          >
                                            <option value="" disabled>
                                              {mappingLessonId === lesson.id ? 'Saving…' : isMapped ? 'Reassign module…' : 'Assign module…'}
                                            </option>
                                            {juniorSafeExercises.map((exercise) => (
                                              <option key={exercise.id} value={exercise.id}>
                                                {exercise.category} · {exercise.name}{exercise.category !== lesson.exerciseCategory ? ' (other category)' : ''}
                                              </option>
                                            ))}
                                          </select>
                                          {isMapped && (
                                            <button
                                              onClick={() => setReassigningLessonId(null)}
                                              disabled={mappingLessonId !== null}
                                              className="rounded-full border border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-500 transition hover:text-stone-950"
                                            >
                                              Cancel
                                            </button>
                                          )}
                                        </>
                                      ) : (
                                        <button
                                          onClick={() => setReassigningLessonId(lesson.id)}
                                          disabled={mappingLessonId !== null}
                                          className="rounded-full border border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-500 transition hover:text-stone-950"
                                        >
                                          Reassign
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )) : unit.lessons.map(cleanLessonRow)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                  );
                })}

                {filteredGroupedByPillar.length === 0 && (
                  <div className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
                    <Search className="mx-auto h-6 w-6 text-stone-300" aria-hidden="true" />
                    <h2 className="mt-3 text-sm font-semibold text-stone-900">No curriculum items found</h2>
                    <p className="mt-1 text-sm text-stone-500">Try a different search or show all pillars.</p>
                  </div>
                )}
                </div>

                <aside className="space-y-4 lg:sticky lg:top-24">
                  <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                    <div className={`border-b px-4 py-4 ${curriculumReady ? 'border-emerald-100 bg-emerald-50' : 'border-amber-100 bg-amber-50'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-md bg-white ${curriculumReady ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {curriculumReady ? <ShieldCheck className="h-5 w-5" aria-hidden="true" /> : <AlertTriangle className="h-5 w-5" aria-hidden="true" />}
                        </span>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Curriculum health</div>
                          <h2 className="text-base font-semibold text-stone-950">{curriculumReady ? 'Ready for athletes' : 'Needs attention'}</h2>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5 p-4">
                      <div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-stone-700">Module coverage</span>
                          <span className="font-bold text-stone-950">{mappingCoverage}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                          <div className={`h-full rounded-full ${blockedCount ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${mappingCoverage}%` }} />
                        </div>
                        <p className="mt-1.5 text-xs text-stone-500">{mappedLessonCount} of {lessonCount} lessons mapped</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-stone-700">Published documents</span>
                          <span className="font-bold text-stone-950">{seededCoverage}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${seededCoverage}%` }} />
                        </div>
                        <p className="mt-1.5 text-xs text-stone-500">{Math.min(seededIds.size, bundled.length)} of {bundled.length} docs seeded</p>
                      </div>

                      <div className="divide-y divide-stone-100 border-y border-stone-100 text-xs">
                        <div className="flex items-center justify-between py-2.5">
                          <span className="flex items-center gap-2 text-stone-500"><Layers3 className="h-3.5 w-3.5" aria-hidden="true" /> Module library</span>
                          <span className="font-semibold text-stone-800">{juniorSafeExercises.length} safe</span>
                        </div>
                        <div className="flex items-center justify-between py-2.5">
                          <span className="flex items-center gap-2 text-stone-500"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Curriculum units</span>
                          <span className="font-semibold text-stone-800">6 total</span>
                        </div>
                        <div className="flex items-center justify-between py-2.5">
                          <span className="flex items-center gap-2 text-stone-500"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Guided season</span>
                          <span className="font-semibold text-stone-800">{totalMinutes} min</span>
                        </div>
                      </div>

                      {blockedCount > 0 ? (
                        <button type="button" onClick={toggleDevMode} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-stone-800">
                          <Wrench className="h-3.5 w-3.5" aria-hidden="true" /> Resolve mapping issues
                        </button>
                      ) : (
                        <p className="flex items-start gap-2 text-xs leading-5 text-stone-500">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                          Every guided lesson has a playable, junior-safe module.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Admin guide</div>
                    <p className="mt-2 text-xs leading-5 text-stone-600">Select any lesson to inspect its athlete-facing copy and run the mapped module. Developer tools expose publishing and reassignment controls.</p>
                  </section>
                </aside>
              </div>
            </>
          )}
          </main>
        </div>
      </div>
      {preview && <ModulePreviewModal target={preview} devMode={devMode} onClose={() => setPreview(null)} />}
      {notesOpen && (
        <div className="fixed inset-0 z-[80] flex justify-end bg-stone-950/35 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label={`${activeTrack.label} curriculum notes`}>
          <button type="button" className="min-w-0 flex-1 cursor-default" onClick={() => setNotesOpen(false)} aria-label="Close notes" />
          <aside className="flex h-full w-full max-w-lg flex-col border-l border-stone-200 bg-[#FAFAF7] shadow-2xl">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-200 bg-white px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-stone-950 text-[#E0FE10]">
                  <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Curriculum feedback</div>
                  <h2 className="truncate text-lg font-semibold text-stone-950">{activeTrack.label} notes</h2>
                  <p className="mt-0.5 text-xs text-stone-500">{activeOpenNotes.length} open · {resolvedTrackNotes.length} resolved</p>
                </div>
              </div>
              <button type="button" onClick={() => setNotesOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 transition hover:bg-stone-100 hover:text-stone-950" aria-label="Close notes">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              <section className="border-b border-stone-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400">New note</div>
                    <h3 className="mt-0.5 text-sm font-semibold text-stone-900">What should change?</h3>
                  </div>
                  <span className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-500">Shared with admins</span>
                </div>

                <label className="mt-4 block">
                  <span className="mb-1.5 block text-xs font-semibold text-stone-700">Curriculum area</span>
                  <select
                    value={noteComposerTarget.id}
                    onChange={(event) => {
                      const target = noteTargetOptions.find((option) => option.id === event.target.value);
                      if (target) setNoteComposerTarget(target);
                    }}
                    className="h-10 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm text-stone-800 outline-none transition focus:border-stone-400 focus:bg-white"
                  >
                    {noteTargetOptions.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
                  </select>
                </label>

                <div className="mt-4">
                  <div className="mb-1.5 text-xs font-semibold text-stone-700">Note type</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(NOTE_KIND_META) as CurriculumNoteKind[]).map((kind) => {
                      const meta = NOTE_KIND_META[kind];
                      const KindIcon = meta.icon;
                      return (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => setNoteKind(kind)}
                          aria-pressed={noteKind === kind}
                          className={`flex h-10 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition ${noteKind === kind ? meta.button : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-900'}`}
                          title={meta.description}
                        >
                          <KindIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className="sr-only">Curriculum note</span>
                  <textarea
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    placeholder="Describe the change, concern, or idea for the curriculum..."
                    rows={4}
                    className="w-full resize-none rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2.5 text-sm leading-6 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                  />
                </label>

                {notesError && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {notesError}
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={submitNote}
                    disabled={!noteBody.trim() || savingNote}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingNote ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />}
                    {savingNote ? 'Adding note' : 'Add note'}
                  </button>
                </div>
              </section>

              <section className="p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-stone-900">Open notes</h3>
                  <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-bold text-stone-600">{activeOpenNotes.length}</span>
                </div>

                {notesLoading ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading notes</div>
                ) : activeOpenNotes.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-stone-300 bg-white px-5 py-8 text-center">
                    <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" aria-hidden="true" />
                    <h4 className="mt-2 text-sm font-semibold text-stone-900">No open notes</h4>
                    <p className="mt-1 text-xs leading-5 text-stone-500">This track has no outstanding curriculum feedback.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeOpenNotes.map((note) => {
                      const meta = NOTE_KIND_META[note.kind] || NOTE_KIND_META.update;
                      const NoteIcon = meta.icon;
                      return (
                        <article key={note.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                          <div className={`h-1 ${note.kind === 'issue' ? 'bg-rose-500' : note.kind === 'idea' ? 'bg-indigo-500' : 'bg-amber-400'}`} />
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>
                                  <NoteIcon className="h-3 w-3" aria-hidden="true" /> {meta.label}
                                </span>
                                <span className="ml-2 text-[11px] font-medium text-stone-400">{note.targetLabel}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setNoteStatus(note, 'resolved')}
                                disabled={updatingNoteId === note.id}
                                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-stone-200 px-2.5 text-[11px] font-semibold text-stone-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                              >
                                {updatingNoteId === note.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                Resolve
                              </button>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">{note.body}</p>
                            <div className="mt-3 text-[11px] text-stone-400">{note.authorName || note.authorEmail || 'Pulse admin'} · {formatNoteTime(note.createdAt)}</div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {resolvedTrackNotes.length > 0 && (
                  <details className="mt-5 border-t border-stone-200 pt-4">
                    <summary className="cursor-pointer text-xs font-semibold text-stone-500">Resolved history ({resolvedTrackNotes.length})</summary>
                    <div className="mt-3 space-y-2">
                      {resolvedTrackNotes.map((note) => (
                        <div key={note.id} className="rounded-md border border-stone-200 bg-white p-3 opacity-75">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-semibold text-stone-500">{note.targetLabel}</div>
                              <p className="mt-1 text-xs leading-5 text-stone-600">{note.body}</p>
                            </div>
                            <button type="button" onClick={() => setNoteStatus(note, 'open')} disabled={updatingNoteId === note.id} className="shrink-0 text-[11px] font-semibold text-teal-700 hover:text-teal-900 disabled:opacity-50">Reopen</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default JuniorCurriculumPage;
