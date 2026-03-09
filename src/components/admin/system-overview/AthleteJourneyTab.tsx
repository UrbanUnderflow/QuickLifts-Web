import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UserCheck,
    Zap,
    CalendarDays,
    TrendingUp,
    Target,
    FlaskConical,
    Trophy,
    ChevronDown,
    ChevronRight,
    Users,
    BookOpen,
    BarChart3,
    Repeat2,
    Globe,
    Layers,
    ShieldCheck,
    Lightbulb,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   PHASE DATA
───────────────────────────────────────────── */
interface Phase {
    id: string;
    number: string;
    label: string;
    icon: React.ElementType;
    accent: string;
    description: string;
    detail: string;
}

const PHASES: Phase[] = [
    {
        id: 'entry',
        number: '0',
        label: 'Entry',
        icon: UserCheck,
        accent: '#60a5fa',
        description: 'Athlete joins through a team, coach, program, or direct sign-up.',
        detail:
            'The system captures only the minimum setup needed to personalize the first experience: sport, role, season context, and current goal. Friction is front-loaded here so every subsequent step feels lighter.',
    },
    {
        id: 'onboarding',
        number: '1',
        label: 'First-Run Onboarding',
        icon: BookOpen,
        accent: '#a78bfa',
        description: 'Pulse Check explains itself in plain language.',
        detail:
            'Nora is introduced as the guide who learns the athlete and assigns the right daily work. The product introduces its mission — training focus, composure, and decision-making under pressure — clearly and without jargon.',
    },
    {
        id: 'baseline',
        number: '2',
        label: 'Starting Baseline',
        icon: BarChart3,
        accent: '#34d399',
        description: 'A short baseline session that samples the major pillars without overwhelming detail.',
        detail:
            'This should be positioned as a "starting read" or "mental baseline," not a high-stakes test. The athlete completes a clean first rep across key mechanisms so Nora can build an initial profile signal.',
    },
    {
        id: 'program',
        number: '3',
        label: 'First Program Assignment',
        icon: Layers,
        accent: '#f59e0b',
        description: 'Immediately after baseline, Nora returns a first Program and assigns a single next session.',
        detail:
            'The athlete should leave the first experience knowing what the system learned and what it wants them to train next. Programs prescribe; sessions deliver.',
    },
    {
        id: 'daily-rhythm',
        number: '4',
        label: 'Daily Rhythm',
        icon: Repeat2,
        accent: '#38bdf8',
        description: 'The athlete settles into a repeatable loop.',
        detail:
            'Check-In, assigned sim, summary, and automatic Program update. Most daily work should remain short and high-compliance. The loop is designed to be low-overhead so adherence is maintained across a full competitive season.',
    },
    {
        id: 'contextualization',
        number: '5',
        label: 'Contextualization',
        icon: Globe,
        accent: '#c084fc',
        description: 'Nora begins to localize the same mechanisms through pressure-type and sport-specific variants.',
        detail:
            'Once the system has enough signal, the experience starts to feel increasingly tailored to the athlete\'s world. Generic mechanisms are gradually wrapped in sport-relevant scenarios without changing the underlying science.',
    },
    {
        id: 'transfer',
        number: '6',
        label: 'Transfer Testing',
        icon: FlaskConical,
        accent: '#fb923c',
        description: 'At meaningful intervals, the athlete enters a Trial layer.',
        detail:
            'Trials test whether improvements survive higher fidelity, longer duration, or more realistic pressure. Trials should feel earned, not constant. They serve as credible checkpoints separated from the noise of daily sims.',
    },
    {
        id: 'competition',
        number: '7',
        label: 'Competition Support',
        icon: Trophy,
        accent: '#facc15',
        description: 'Pulse Check serves as a readiness and development layer before, during, and between competition windows.',
        detail:
            'The product\'s role is to sharpen, detect, and guide — not to compete with competition itself. In-competition and post-competition modes provide targeted sessions tied to the athlete\'s current performance context.',
    },
];

/* ─────────────────────────────────────────────
   PRINCIPLE + RULE DATA
───────────────────────────────────────────── */
const CORE_PRINCIPLES = [
    {
        icon: Zap,
        label: 'Reduce friction first',
        description:
            'The first session should be short, clear, and low choice. The athlete should not need to understand the full taxonomy to begin.',
    },
    {
        icon: BookOpen,
        label: 'Teach before localizing',
        description:
            'Start with universal, sport-agnostic experiences so Nora can establish a clean baseline before introducing sport-specific wrappers.',
    },
    {
        icon: Layers,
        label: 'Programs prescribe; sessions deliver',
        description:
            'The athlete experiences a single assigned session, while Nora and the system reason at the Program, family, and profile layers.',
    },
    {
        icon: TrendingUp,
        label: 'Daily sims build; trials prove',
        description:
            'Short daily reps should build skill. Higher-fidelity Trials should test whether the skill survives context change before competition.',
    },
    {
        icon: Target,
        label: 'Visible progress matters early',
        description:
            'The athlete should quickly see what Pulse Check is training, what is improving, and what comes next.',
    },
];

const IMPL_RULES = [
    'Day 1 should reduce choice, not expand it.',
    'The athlete should always know what today\'s session is and why it was assigned.',
    'Most daily sessions should stay short unless the system is intentionally running a Trial or fatigability probe.',
    'Trials should be meaningful checkpoints, not constant background noise.',
    'Sport-specific variants should increase relevance without changing the underlying family mechanism.',
    'By the end of the first week, the athlete should feel guided.',
    'By the end of the first month, the athlete should see evidence of progression and transfer.',
];

const VARIANT_ORDER = [
    { step: 1, label: 'Generic / Mechanism-Pure', description: 'First sessions are universal and establish clean baseline signal.', accent: '#60a5fa' },
    { step: 2, label: 'Pressure-Type Variants', description: 'Applied once Nora has a basic profile read — same mechanism, different pressure context.', accent: '#a78bfa' },
    { step: 3, label: 'Sport-Context Variants', description: 'Make the mechanism feel closer to competition without changing the family mechanism.', accent: '#34d399' },
    { step: 4, label: 'Immersive / Field-Transfer', description: 'Trial-level fidelity using real-world or high-context scenarios to prove skill transfer.', accent: '#facc15' },
];

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */
function PhaseCard({ phase, isExpanded, onToggle }: { phase: Phase; isExpanded: boolean; onToggle: () => void }) {
    const Icon = phase.icon;
    return (
        <div
            className="rounded-xl border transition-all duration-200 overflow-hidden"
            style={{
                background: isExpanded ? `linear-gradient(135deg, ${phase.accent}12, ${phase.accent}06)` : 'rgba(255,255,255,0.02)',
                borderColor: isExpanded ? `${phase.accent}45` : 'rgba(63,63,70,0.6)',
            }}
        >
            <button
                onClick={onToggle}
                className="w-full text-left px-4 py-3 flex items-center gap-3"
            >
                <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{
                        background: isExpanded ? `${phase.accent}22` : 'rgba(255,255,255,0.05)',
                        color: isExpanded ? phase.accent : '#71717a',
                    }}
                >
                    {phase.number}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{phase.label}</p>
                    <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{phase.description}</p>
                </div>
                <Icon
                    className="w-4 h-4 shrink-0"
                    style={{ color: isExpanded ? phase.accent : '#52525b' }}
                />
                {isExpanded
                    ? <ChevronDown className="w-4 h-4 shrink-0 text-zinc-500" />
                    : <ChevronRight className="w-4 h-4 shrink-0 text-zinc-600" />}
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 pt-1 text-sm text-zinc-300 border-t border-zinc-800/60 mt-1 leading-relaxed">
                            {phase.detail}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const AthleteJourneyTab: React.FC = () => {
    const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>('entry');

    const togglePhase = (id: string) => {
        setExpandedPhaseId((prev) => (prev === id ? null : id));
    };

    return (
        <div className="space-y-8">

            {/* ── HEADER ── */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <CalendarDays className="w-4 h-4 text-sky-400" />
                    <p className="text-xs uppercase tracking-wide text-sky-400 font-semibold">
                        Pulse Check · Athlete Adoption
                    </p>
                </div>
                <h2 className="text-xl font-semibold text-white">Athlete User Journey</h2>
                <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
                    Recommended entry, progression, and system flow for the easiest athlete adoption path through Pulse Check.
                    The goal is to make first use simple, daily use sticky, and long-term progression credible.
                </p>
            </div>

            {/* ── PURPOSE BANNER ── */}
            <div className="bg-sky-500/[0.07] border border-sky-500/20 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-white mb-1">Purpose</p>
                        <p className="text-sm text-zinc-300 leading-relaxed">
                            This document formalizes the recommended athlete entry and progression flow for Pulse Check.
                            The system should feel like guided mental training, not like a lab assessment on first touch.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── CORE PRINCIPLES ── */}
            <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide mb-3">Core Journey Principles</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {CORE_PRINCIPLES.map((p) => {
                        const Icon = p.icon;
                        return (
                            <div
                                key={p.label}
                                className="bg-[#090f1c] border border-zinc-800 rounded-xl p-4 flex flex-col gap-2"
                            >
                                <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4 text-purple-400 shrink-0" />
                                    <p className="text-sm font-semibold text-white">{p.label}</p>
                                </div>
                                <p className="text-xs text-zinc-400 leading-relaxed">{p.description}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── SYSTEM HEARTBEAT ── */}
            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Repeat2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">System Heartbeat</h3>
                </div>
                <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
                    The default athlete rhythm should be simple enough to repeat daily and smart enough to evolve over time.
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    {['Check-In', '→', 'Assigned Sim', '→', 'Session Summary', '→', 'Program Update'].map((item, i) => (
                        item === '→'
                            ? <span key={i} className="text-zinc-600 font-bold">→</span>
                            : (
                                <span
                                    key={item}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-semibold"
                                >
                                    {item}
                                </span>
                            )
                    ))}
                </div>
            </div>

            {/* ── JOURNEY PHASES ── */}
            <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide mb-3">Journey Phases</h3>
                <div className="space-y-2">
                    {PHASES.map((phase) => (
                        <PhaseCard
                            key={phase.id}
                            phase={phase}
                            isExpanded={expandedPhaseId === phase.id}
                            onToggle={() => togglePhase(phase.id)}
                        />
                    ))}
                </div>
            </div>

            {/* ── DAY 1 CALLOUT ── */}
            <div className="bg-purple-500/[0.07] border border-purple-500/20 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                    <UserCheck className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-white mb-1">Day 1 Experience</p>
                        <p className="text-sm text-zinc-300 leading-relaxed">
                            The first athlete experience should feel guided, calm, and obvious. The aim is to get the athlete into
                            a clean first rep quickly. The system must not present a menu of choices — it must present one next step.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── DAILY SIMS vs TRIALS ── */}
            <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide mb-3">Daily Sims vs. Trials</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#090f1c] border border-zinc-800 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <Repeat2 className="w-4 h-4 text-sky-400" />
                            <p className="text-sm font-semibold text-white">Daily Sims</p>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Short, high-compliance reps that build skill over time. They answer: <span className="text-zinc-200 italic">Is the athlete improving in the trained mechanism?</span>
                        </p>
                        <ul className="text-xs text-zinc-500 space-y-1 list-disc pl-4">
                            <li>Mechanism-focused, low duration</li>
                            <li>Repeatable within the daily rhythm</li>
                            <li>Progress tracked against personal baseline</li>
                        </ul>
                    </div>
                    <div className="bg-[#090f1c] border border-zinc-800 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <FlaskConical className="w-4 h-4 text-amber-400" />
                            <p className="text-sm font-semibold text-white">Trials</p>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Higher-fidelity checkpoints that test transfer. They answer: <span className="text-zinc-200 italic">Does the skill survive context change and increased pressure?</span>
                        </p>
                        <ul className="text-xs text-zinc-500 space-y-1 list-disc pl-4">
                            <li>Higher fidelity, longer duration</li>
                            <li>Triggered at meaningful program intervals</li>
                            <li>Results inform Program-level decisions</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* ── SPORT-SPECIFIC VARIANT ORDER ── */}
            <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide mb-3">
                    When Sport-Specific Variants Should Appear
                </h3>
                <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                    Sport-specific variants are valuable, but they should enter after the system has enough signal. The recommended order:
                </p>
                <div className="space-y-2">
                    {VARIANT_ORDER.map((v) => (
                        <div
                            key={v.step}
                            className="flex items-start gap-3 rounded-xl border p-3"
                            style={{
                                background: `${v.accent}08`,
                                borderColor: `${v.accent}25`,
                            }}
                        >
                            <div
                                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5"
                                style={{ background: `${v.accent}20`, color: v.accent }}
                            >
                                {v.step}
                            </div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: v.accent }}>{v.label}</p>
                                <p className="text-xs text-zinc-400 mt-0.5">{v.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── COACH vs ATHLETE VIEWS ── */}
            <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide mb-3">Coach and Athlete Views</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#090f1c] border border-zinc-800 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-sky-400" />
                            <p className="text-sm font-semibold text-white">Athlete View</p>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            Optimizes for adherence, clarity, and momentum. The athlete sees one next action, not the full system model.
                        </p>
                    </div>
                    <div className="bg-[#090f1c] border border-zinc-800 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-purple-400" />
                            <p className="text-sm font-semibold text-white">Coach View</p>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            Optimizes for visibility, comparison, and intervention. Both views sit on the same underlying system but carry different cognitive loads.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── IMPLEMENTATION RULES ── */}
            <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide mb-3">Implementation Rules</h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                    {IMPL_RULES.map((rule, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-zinc-300">{rule}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── SUMMARY ── */}
            <div className="bg-gradient-to-br from-purple-500/10 to-sky-500/5 border border-purple-500/20 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-white mb-2">Summary</h3>
                <p className="text-sm text-zinc-300 leading-relaxed">
                    The easiest athlete entry for Pulse Check is not a menu of all possible sims, variants, and taxonomy objects.
                    It is a guided flow where Nora meets the athlete, learns the athlete quickly, prescribes one clean first rep,
                    and then proves over time that the system is getting smarter and more specific. That is the journey most likely
                    to support adoption, adherence, and believable performance progress.
                </p>
            </div>

        </div>
    );
};

export default AthleteJourneyTab;
