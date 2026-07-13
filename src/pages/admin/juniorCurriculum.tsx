// =============================================================================
// /admin/juniorCurriculum — PulseCheck Junior Track curriculum seeder + module mapper.
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
// chat-handoff-mapped lessons (no fallback). The header shows the gate.
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Flag,
  GraduationCap,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { auth, db } from '../../api/firebase/config';
import curriculumData from '../../../scripts/data/junior-curriculum.json';

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
};

type LessonExerciseStatus = 'ok' | 'missing' | 'handoff' | 'category-mismatch';

type LessonRow = JuniorLessonSeed & {
  seeded: boolean;
  effectiveExerciseId: string;
  exerciseStatus: LessonExerciseStatus;
  exerciseName?: string;
};

const PILLAR_LABELS: Record<string, string> = {
  'champion-mindset': 'Champion Mindset',
  'mental-performance': 'Mental Performance',
  'emotional-regulation': 'Emotional Regulation',
};

const PILLAR_ORDER = ['champion-mindset', 'mental-performance', 'emotional-regulation'];
const LESSON_ID_PATTERN = /^[a-z0-9-]{3,64}$/;

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

const JuniorCurriculumPage: React.FC = () => {
  const bundled = curriculumData as JuniorLessonSeed[];
  const [seededExerciseIds, setSeededExerciseIds] = useState<Map<string, string>>(new Map());
  const [seededIds, setSeededIds] = useState<Set<string>>(new Set());
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [mappingLessonId, setMappingLessonId] = useState<string | null>(null);
  // Lesson whose mapping is being changed: mapped rows show a Reassign
  // button and only reveal the dropdown while this matches their id.
  const [reassigningLessonId, setReassigningLessonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

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
        const payload: Record<string, unknown> = { ...fields, updatedAt: now, seededBy: `admin/juniorCurriculum (${auth.currentUser?.email || 'unknown'})` };
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
  }, [seeding, validationIssues.length, bundled, seededExerciseIds, checkpointCount, refresh]);

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
          exerciseMappedBy: `admin/juniorCurriculum (${auth.currentUser?.email || 'unknown'})`,
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
    switch (lesson.exerciseStatus) {
      case 'ok':
        return <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">{lesson.exerciseName}</span>;
      case 'category-mismatch':
        return <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200" title="Mapped exercise is a different category than the lesson">{lesson.exerciseName} · other category</span>;
      case 'handoff':
        return <span className="rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-200" title="This exercise hands off to Nora chat, which juniors cannot access; the junior player refuses to play it. Remap to a junior-safe module.">{lesson.exerciseName} · chat handoff · will not play</span>;
      case 'missing':
      default:
        return <span className="rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-200" title="exerciseId does not exist in mental-exercises. The junior player refuses to play unmapped lessons (no fallback) — assign a module before launch.">no module · will not play</span>;
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

  return (
    <AdminRouteGuard>
      <Head>
        <title>Junior Curriculum | Pulse Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen bg-[#080a14] px-6 py-10 text-zinc-100">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-700/40 bg-teal-950/30 text-teal-200">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Junior Track Curriculum</h1>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                Content source of truth for the Junior guided curriculum. Seeds `junior-curriculum` from the bundled JSON
                (mirrors the iOS seed) and maps every lesson to a real module. iOS refuses to play unmapped lessons.
              </p>
            </div>
          </header>

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-700/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {actionResult && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-700/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              <span>{actionResult}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6 text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading curriculum and module inventory…
            </div>
          ) : (
            <>
              <section className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
                <div className="flex-1">
                  <div className="text-sm text-zinc-400">
                    Bundled: <span className="font-semibold text-zinc-100">{bundled.length} docs</span>
                    {' '}({checkpointCount} checkpoints) · Seeded:{' '}
                    <span className={`font-semibold ${seededIds.size >= bundled.length ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {seededIds.size}
                    </span>
                    {blockedCount > 0 ? (
                      <span className="font-semibold text-rose-300"> · {blockedCount} module{blockedCount === 1 ? '' : 's'} unmapped (will not play)</span>
                    ) : (
                      <span className="font-semibold text-emerald-300"> · all modules mapped</span>
                    )}
                    {' '}· {juniorSafeExercises.length} junior-safe modules in library
                  </div>
                  {validationIssues.length > 0 && (
                    <div className="mt-2 text-sm text-rose-300">
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
                  className="flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:text-zinc-100"
                >
                  <RefreshCw className="h-4 w-4" /> Refresh
                </button>
                <button
                  onClick={runSeed}
                  disabled={seeding || validationIssues.length > 0}
                  className="flex items-center gap-2 rounded-xl border border-teal-500/40 bg-teal-500/15 px-4 py-2 text-sm font-medium text-teal-100 transition hover:bg-teal-500/25 disabled:opacity-50"
                >
                  {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                  {seeding ? 'Seeding…' : `Seed ${bundled.length} Docs`}
                </button>
              </section>

              <div className="space-y-6">
                {groupedByPillar.map((pillar) => (
                  <section key={pillar.pillarId} className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
                    <h2 className="mb-4 text-lg font-semibold text-zinc-100">{pillar.label}</h2>
                    <div className="space-y-4">
                      {pillar.units.map((unit) => (
                        <div key={unit.unitIndex}>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Unit {unit.unitIndex} · {unit.unitTitle}
                          </div>
                          <div className="space-y-1">
                            {unit.lessons.map((lesson) => (
                              <div
                                key={lesson.id}
                                className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-3 py-2 text-sm"
                              >
                                <div className="flex items-center gap-3">
                                  {lesson.kind === 'checkpoint'
                                    ? <Flag className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                                    : <span className="w-3.5 shrink-0 text-center text-xs text-zinc-500">{lesson.lessonIndex}</span>}
                                  <span className="flex-1 text-zinc-200">{lesson.title}</span>
                                  <span className="text-xs text-zinc-500">{lesson.durationMinutes} min</span>
                                  <span className="font-mono text-xs text-zinc-600">{lesson.id}</span>
                                  {lesson.seeded ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                  ) : (
                                    <span className="text-xs text-amber-300">not seeded</span>
                                  )}
                                </div>
                                {lesson.kind !== 'checkpoint' && (() => {
                                  const isMapped = lesson.exerciseStatus === 'ok' || lesson.exerciseStatus === 'category-mismatch';
                                  const showPicker = !isMapped || reassigningLessonId === lesson.id;
                                  return (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-6">
                                      <span className="text-[11px] uppercase tracking-wide text-zinc-600">Module</span>
                                      {exerciseStatusChip(lesson)}
                                      {showPicker ? (
                                        <>
                                          <select
                                            value=""
                                            disabled={!lesson.seeded || mappingLessonId !== null || !juniorSafeExercises.length}
                                            onChange={(e) => mapExercise(lesson.id, e.target.value)}
                                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 disabled:opacity-40"
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
                                              className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-500 transition hover:text-zinc-300"
                                            >
                                              Cancel
                                            </button>
                                          )}
                                        </>
                                      ) : (
                                        <button
                                          onClick={() => setReassigningLessonId(lesson.id)}
                                          disabled={mappingLessonId !== null}
                                          className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
                                        >
                                          Reassign
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default JuniorCurriculumPage;
