import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Home,
  Lightbulb,
  Mail,
  MessageSquare,
  PlayCircle,
  Sparkles,
  Tag,
  XCircle,
} from 'lucide-react';
import type { Course, Lesson } from '../../content/education/types';

const AMBER = '#A06F2D';
const ROSE = '#A85353';
const transition = { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const };
const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');
const enrollMailto = (course: Course) => `mailto:tre@fitwithpulse.ai?subject=${encodeURIComponent(`Enroll: ${course.title}`)}`;

const CREDIT_NOTE = 'The $10 you paid for your readiness assessment is credited toward any course.';

export interface CourseExperienceProps {
  courses: Course[];
  accent: string;
  accent2: string;
  eyebrow: string;
  headline: string;
  subhead: string;
  crossHref: string;
  crossLabel: string;
}

/* ---------------------------------- atoms --------------------------------- */

const Wordmark = () => (
  <a href="/pulseintelligencelabs" className="flex items-center gap-3" aria-label="Pulse Intelligence Labs">
    <img src="/pulse-logo.svg" alt="Pulse" className="h-8 w-auto" />
    <span className="hidden text-sm font-semibold tracking-tight text-stone-900 sm:block">Pulse Intelligence Labs</span>
  </a>
);

const CreditChip: React.FC<{ accent: string }> = ({ accent }) => (
  <div className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: `${accent}33`, backgroundColor: `${accent}0d`, color: '#57534e' }}>
    <Tag className="h-3.5 w-3.5" style={{ color: accent }} />
    <span>{CREDIT_NOTE}</span>
  </div>
);

const SayThisBlock: React.FC<{ examples: NonNullable<Lesson['sayThis']>; accent: string }> = ({ examples, accent }) => (
  <div className="grid gap-3">
    {examples.map((ex) => (
      <div key={ex.say} className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ROSE }} />
            <p className="text-sm leading-6 text-stone-500">{ex.avoid}</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
            <p className="text-sm font-medium leading-6 text-stone-800">{ex.say}</p>
          </div>
        </div>
        <p className="mt-3 border-t border-stone-100 pt-3 text-xs leading-5 text-stone-500">{ex.why}</p>
      </div>
    ))}
  </div>
);

const ScenarioLab: React.FC<{ items: NonNullable<Course['scenarioLab']>; accent: string }> = ({ items, accent }) => {
  const [picked, setPicked] = useState<Record<string, number>>({});
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Scenario lab</p>
        <h2 className="mt-1 text-2xl font-semibold text-stone-900">Put it into practice</h2>
        <p className="mt-2 text-sm leading-6 text-stone-500">Pick what you would do. You will see why each option helps or misses.</p>
      </div>
      {items.map((item, i) => {
        const sel = picked[item.id];
        return (
          <div key={item.id} className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Scenario {String(i + 1).padStart(2, '0')}</p>
            <h3 className="mt-2 text-lg font-semibold leading-snug text-stone-900">{item.prompt}</h3>
            <div className="mt-4 grid gap-2">
              {item.options.map((opt, idx) => {
                const isSel = sel === idx;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setPicked((p) => ({ ...p, [item.id]: idx }))}
                    className={cx('rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-stone-400', isSel ? 'bg-white' : 'border-stone-200 bg-white/70 hover:border-stone-300')}
                    style={isSel ? { borderColor: opt.best ? accent : AMBER, borderWidth: 2 } : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-stone-900">{opt.label}</span>
                      {isSel && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white" style={{ backgroundColor: opt.best ? accent : AMBER }}>
                          {opt.best ? 'Best move' : 'Reconsider'}
                        </span>
                      )}
                    </div>
                    {isSel && <p className="mt-2 text-sm leading-6 text-stone-600">{opt.feedback}</p>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const LessonView: React.FC<{ lesson: Lesson; moduleTitle: string; accent: string; accent2: string }> = ({ lesson, moduleTitle, accent, accent2 }) => (
  <article className="space-y-6">
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">{moduleTitle} · {lesson.duration}</p>
      <h2 className="mt-1 text-3xl font-semibold leading-tight text-stone-900">{lesson.title}</h2>
    </div>
    <div className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: `${accent}33`, backgroundColor: `${accent}0f` }}>
      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent }} />
      <p className="text-sm font-medium leading-6 text-stone-800">{lesson.bigIdea}</p>
    </div>
    <div className="space-y-4">
      {lesson.body.map((p, i) => (
        <p key={i} className="text-base leading-7 text-stone-700">{p}</p>
      ))}
    </div>
    {lesson.keyPoints && (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Key points</p>
        <ul className="mt-3 space-y-2">
          {lesson.keyPoints.map((kp) => (
            <li key={kp} className="flex gap-2 text-sm leading-6 text-stone-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
              <span>{kp}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
    {lesson.sayThis && (
      <div>
        <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">
          <MessageSquare className="h-3.5 w-3.5" /> Say this, not that
        </p>
        <SayThisBlock examples={lesson.sayThis} accent={accent} />
      </div>
    )}
    {lesson.tryThis && (
      <div className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: `${accent2}33`, backgroundColor: `${accent2}0d` }}>
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent2 }} />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: accent2 }}>Try this</p>
          <p className="mt-1 text-sm leading-6 text-stone-700">{lesson.tryThis}</p>
        </div>
      </div>
    )}
  </article>
);

type Step = { kind: 'lesson'; lesson: Lesson; moduleTitle: string } | { kind: 'lab' };

const SelfPacedCourse: React.FC<{ course: Course; accent: string; accent2: string }> = ({ course, accent, accent2 }) => {
  const steps = useMemo<Step[]>(() => {
    const list: Step[] = [];
    course.modules?.forEach((m) => m.lessons.forEach((lesson) => list.push({ kind: 'lesson', lesson, moduleTitle: m.title })));
    if (course.scenarioLab?.length) list.push({ kind: 'lab' });
    return list;
  }, [course]);
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const progress = Math.round(((index + 1) / steps.length) * 100);
  const activeLessonId = step.kind === 'lesson' ? step.lesson.id : 'lab';

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_1fr] lg:items-start">
      <aside className="lg:sticky lg:top-28">
        <div className="rounded-2xl border border-stone-200 bg-white/85 p-5">
          <div className="mb-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
              <motion.div className="h-full rounded-full" animate={{ width: `${progress}%` }} transition={transition} style={{ backgroundColor: accent }} />
            </div>
            <p className="mt-2 text-xs font-semibold text-stone-500">{progress}% complete</p>
          </div>
          <div className="space-y-4">
            {course.modules?.map((m) => (
              <div key={m.id}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">{m.title}</p>
                <div className="mt-2 space-y-1">
                  {m.lessons.map((lesson) => {
                    const stepIdx = steps.findIndex((s) => s.kind === 'lesson' && s.lesson.id === lesson.id);
                    const active = activeLessonId === lesson.id;
                    return (
                      <button key={lesson.id} type="button" onClick={() => setIndex(stepIdx)} className={cx('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition', active ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100')}>
                        <BookOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span className="leading-snug">{lesson.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {course.scenarioLab?.length ? (
              <button type="button" onClick={() => setIndex(steps.length - 1)} className={cx('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition', activeLessonId === 'lab' ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100')}>
                <ClipboardCheck className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span>Scenario lab</span>
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <AnimatePresence mode="wait">
          <motion.div key={activeLessonId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={transition} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_18px_55px_rgba(68,64,60,0.08)] sm:p-8">
            {step.kind === 'lesson' ? <LessonView lesson={step.lesson} moduleTitle={step.moduleTitle} accent={accent} accent2={accent2} /> : <ScenarioLab items={course.scenarioLab!} accent={accent} />}
          </motion.div>
        </AnimatePresence>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 disabled:opacity-40">
            <ArrowLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-stone-500">{index + 1} of {steps.length}</span>
          <button type="button" onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))} disabled={index === steps.length - 1} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: accent }}>
            Next <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const LiveCourse: React.FC<{ course: Course; accent: string }> = ({ course, accent }) => (
  <div className="space-y-8">
    <div className="rounded-2xl border p-5" style={{ borderColor: `${accent}33`, backgroundColor: `${accent}0d` }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
          <Calendar className="h-4 w-4" style={{ color: accent }} /> Instructor-led · {course.durationLabel}
        </div>
        <a href={enrollMailto(course)} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: accent }}>
          <Mail className="h-4 w-4" /> Enroll — {course.price}
        </a>
      </div>
      <p className="mt-3 text-xs text-stone-500">{CREDIT_NOTE}</p>
    </div>

    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-stone-900">Sessions</h2>
      <div className="grid gap-4">
        {course.sessions?.map((s) => (
          <div key={s.id} className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">{s.duration}</p>
            <h3 className="mt-1 text-lg font-semibold text-stone-900">{s.title}</h3>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.15em] text-stone-500">You will leave able to</p>
            <ul className="mt-2 space-y-1.5">
              {s.objectives.map((o) => (
                <li key={o} className="flex gap-2 text-sm leading-6 text-stone-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                  <span>{o}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-stone-500">Agenda</p>
            <div className="mt-2 space-y-2">
              {s.agenda.map((a) => (
                <div key={a.segment} className="rounded-lg border border-stone-100 bg-stone-50 p-3">
                  <p className="text-sm font-semibold text-stone-800">{a.segment}</p>
                  <p className="mt-0.5 text-sm leading-6 text-stone-600">{a.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>

    {course.takeHomeGuide && (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-stone-900">Take-home guide</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {course.takeHomeGuide.map((g) => (
            <div key={g.title} className="rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-stone-900">{g.title}</h3>
              {g.intro && <p className="mt-1 text-xs leading-5 text-stone-500">{g.intro}</p>}
              <ul className="mt-3 space-y-2">
                {g.items.map((it) => (
                  <li key={it} className="flex gap-2 text-sm leading-6 text-stone-700">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    )}
  </div>
);

const CourseCard: React.FC<{ course: Course; accent: string; accent2: string; onOpen: () => void }> = ({ course, accent, accent2, onOpen }) => (
  <motion.article layout className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
    <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${accent}, ${accent2})` }} />
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border" style={{ borderColor: `${accent}55`, backgroundColor: `${accent}18` }}>
        {course.format === 'live' ? <GraduationCap className="h-6 w-6" style={{ color: accent }} /> : <PlayCircle className="h-6 w-6" style={{ color: accent }} />}
      </div>
      <div className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-right">
        <div className="text-sm font-semibold text-stone-900">{course.price}</div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">{course.format === 'live' ? 'Live' : 'Self-paced'}</div>
      </div>
    </div>
    <h2 className="mt-5 text-2xl font-semibold leading-tight text-stone-900">{course.title}</h2>
    <p className="mt-3 text-base leading-7 text-stone-500">{course.tagline}</p>
    <p className="mt-4 text-sm leading-6 text-stone-600">{course.forWhom}</p>
    <div className="mt-5 flex flex-wrap gap-2">
      {course.domains.map((d) => (
        <span key={d} className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-700">{d}</span>
      ))}
    </div>
    <div className="mt-6 flex items-center justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-[0.15em] text-stone-500">{course.durationLabel}</span>
      <button type="button" onClick={onOpen} className="inline-flex min-h-[46px] items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: accent }}>
        <span>{course.format === 'live' ? 'View course' : 'Start course'}</span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  </motion.article>
);

/* --------------------------------- shell ---------------------------------- */

export default function CourseExperience({ courses, accent, accent2, eyebrow, headline, subhead, crossHref, crossLabel }: CourseExperienceProps) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeCourse = courses.find((c) => c.id === activeId) || null;

  useEffect(() => {
    const q = router.query.course;
    const id = Array.isArray(q) ? q[0] : q;
    if (id && courses.some((c) => c.id === id)) setActiveId(id);
  }, [router.query.course, courses]);

  return (
    <main className="relative min-h-screen bg-[#FAFAF7] text-stone-900">
      <nav className="sticky top-0 z-50 border-b border-stone-200/80 bg-[#FAFAF7]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 sm:px-8">
          <Wordmark />
          <a href={crossHref} className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 transition hover:text-stone-900">
            <ClipboardCheck className="h-4 w-4" /> <span className="hidden sm:inline">{crossLabel}</span>
          </a>
        </div>
      </nav>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-12 sm:px-8">
        {!activeCourse ? (
          <>
            <motion.header initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={transition} className="border-b border-stone-200 pb-10">
              <div className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-600">
                <GraduationCap className="h-3.5 w-3.5" /> {eyebrow}
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-stone-900 sm:text-5xl">{headline}</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-500">{subhead}</p>
              <div className="mt-6"><CreditChip accent={accent} /></div>
            </motion.header>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: 0.08 }} className="grid gap-6 pt-10 lg:grid-cols-2">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} accent={accent} accent2={accent2} onOpen={() => setActiveId(course.id)} />
              ))}
            </motion.div>
          </>
        ) : (
          <div>
            <button type="button" onClick={() => setActiveId(null)} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-stone-500 transition hover:text-stone-900">
              <Home className="h-4 w-4" /> {eyebrow}
            </button>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">{activeCourse.format === 'live' ? 'Live course' : 'Self-paced course'} · {activeCourse.price}</p>
                <h1 className="mt-2 max-w-3xl text-3xl font-semibold leading-tight text-stone-900">{activeCourse.title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{activeCourse.tagline}</p>
              </div>
            </div>
            {activeCourse.format === 'self-paced' ? <SelfPacedCourse course={activeCourse} accent={accent} accent2={accent2} /> : <LiveCourse course={activeCourse} accent={accent} />}
          </div>
        )}
      </section>
    </main>
  );
}
