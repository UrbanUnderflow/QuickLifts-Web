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
    status: 'live' | 'partial' | 'target';
    description: string;
    detail: string;
}

type JourneyChecklistItem = {
    title: string;
    detail: string;
    priority: 'Now' | 'Next' | 'Later';
};

const PHASES: Phase[] = [
    {
        id: 'entry',
        number: '0',
        label: 'Entry',
        icon: UserCheck,
        accent: '#60a5fa',
        status: 'live',
        description: 'Athlete joins today through a team invite or a pilot/cohort-linked team invite.',
        detail:
            'Current v1 is team-container first. Pilot and cohort context now attach correctly behind the scenes, but a true direct-signup or fully standalone product-only athlete path is still future-state.',
    },
    {
        id: 'onboarding',
        number: '1',
        label: 'First-Run Onboarding',
        icon: BookOpen,
        accent: '#a78bfa',
        status: 'partial',
        description: 'Pulse Check explains itself in plain language and confirms why this athlete is here.',
        detail:
            'Current v1 covers name capture, product consent, and research consent when a pilot requires it. Nora-as-guide language is still directionally right, but Nora is not yet the true onboarding orchestrator, and clinical consent remains future safety-lane work.',
    },
    {
        id: 'baseline',
        number: '2',
        label: 'Starting Baseline',
        icon: BarChart3,
        accent: '#34d399',
        status: 'partial',
        description: 'A short baseline session that samples the major pillars without overwhelming detail.',
        detail:
            'This is mostly live now, and the framing should stay calm and low-stakes. The remaining gap is that all athletes still route into the same core baseline path; research-aware enrollment truth exists, but research-specific baseline branching is still not implemented.',
    },
    {
        id: 'program',
        number: '3',
        label: 'First Program Assignment',
        icon: Layers,
        accent: '#f59e0b',
        status: 'partial',
        description: 'Immediately after baseline, Nora returns a first Program and assigns a single next session.',
        detail:
            'The underlying data model already supports active programs and recommendation logic, and the workspace can preview what comes next. The missing piece is a true athlete-facing first-session handoff that feels prescribed, obvious, and launchable.',
    },
    {
        id: 'daily-rhythm',
        number: '4',
        label: 'Daily Rhythm',
        icon: Repeat2,
        accent: '#38bdf8',
        status: 'partial',
        description: 'The athlete settles into a repeatable loop.',
        detail:
            'This loop now exists in partial form. Today view persists the daily check-in, Nora materializes one shared task, Mental Training can launch that task directly, and completion now writes a session summary plus next-program update. Athlete history, coach push updates, and Nora follow-up now exist in lightweight form. The remaining gap is making that rhythm feel fully end-to-end across every athlete and coach surface.',
    },
    {
        id: 'contextualization',
        number: '5',
        label: 'Contextualization',
        icon: Globe,
        accent: '#c084fc',
        status: 'target',
        description: 'Nora begins to localize the same mechanisms through pressure-type and sport-specific variants.',
        detail:
            'This remains a good north star. It should stay in the spec, but the product does not yet expose a visible athlete progression from generic mechanism work into pressure-type and sport-context variants.',
    },
    {
        id: 'transfer',
        number: '6',
        label: 'Transfer Testing',
        icon: FlaskConical,
        accent: '#fb923c',
        status: 'target',
        description: 'At meaningful intervals, the athlete enters a Trial layer.',
        detail:
            'This remains target-state on web. We have some related foundations in the mental training and Vision Pro systems, but we do not yet have a clear athlete-facing cadence of earned trials and transfer checkpoints.',
    },
    {
        id: 'competition',
        number: '7',
        label: 'Competition Support',
        icon: Trophy,
        accent: '#facc15',
        status: 'target',
        description: 'Pulse Check serves as a readiness and development layer before, during, and between competition windows.',
        detail:
            'This is still a future product layer. The current athlete flow has no true competition-mode surface yet beyond general readiness language and optional Vision Pro checkpoint messaging.',
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

const ENTRY_CONTEXTS = [
    { label: 'Standard team onboarding', description: 'Athlete enters through a team invite, sees team branding, and is linked to the persistent team container.', accent: '#60a5fa' },
    { label: 'Pilot-linked onboarding', description: 'Athlete enters through a pilot-aware invite and is automatically connected to the correct pilot and cohort context.', accent: '#a78bfa' },
    { label: 'Product-only onboarding (target)', description: 'Still planned, but not yet a first-class athlete entry path in the current team-centered provisioning flow.', accent: '#34d399' },
];

const CONSENT_BRANCHES = [
    { lane: 'Product consent', meaning: 'Required for Pulse Check use and should happen in every athlete path.' },
    { lane: 'Research consent', meaning: 'Shown only when the pilot or cohort requires it. Decline should not necessarily block product use.' },
    { lane: 'Escalation / clinical consent', meaning: 'Still future safety-lane work. Keep separate from onboarding, but do not treat it as live athlete flow until the clinical stack exists.' },
];

const DAY_ONE_RULES = [
    'Show one next step, not a menu of possible sims or system objects.',
    'Confirm why the athlete is here: team context, pilot context, and baseline expectation.',
    'Branch automatically into the right baseline path based on enrollment truth rather than making the athlete choose.',
    'Keep research / product branching invisible to the athlete unless consent or study posture requires explanation.',
];

const CURRENT_V1_FLOW = [
    'Athlete redeems a team invite or pilot-linked team invite.',
    'Athlete completes onboarding: name, product consent, and research choice when required.',
    'System marks the athlete baseline-ready and routes them into the shared team workspace.',
    'Athlete completes the in-app baseline to unlock training.',
    'After baseline, the athlete can move between Today, Nora, Profile, and the team workspace, but the full daily training rhythm is still partial.',
];

const BUILD_CHECKLIST: JourneyChecklistItem[] = [
    {
        title: 'Persist the daily check-in as real product state',
        detail: 'Replace the Today-view local readiness tap with a true stored check-in event that Nora, profile, and coach surfaces can all reason over.',
        priority: 'Now',
    },
    {
        title: 'Deliver one clear assigned session after baseline',
        detail: 'Turn active program and pending assignment data into a real athlete-facing launch surface instead of summary copy only.',
        priority: 'Now',
    },
    {
        title: 'Add session summary and program-update loop',
        detail: 'Now partial: completion writes a durable session summary and next-program update, and those updates are visible to the athlete and coach. The remaining work is tightening the rhythm across all surfaces and follow-up notifications.',
        priority: 'Now',
    },
    {
        title: 'Keep the athlete journey green in automated regression',
        detail: 'The daily loop now needs Playwright coverage as part of the standard PulseCheck suite: post-baseline fixture seeding, Today check-in, Nora task visibility, mental-training handoff, session-summary rendering, and coach follow-up surfaces.',
        priority: 'Now',
    },
    {
        title: 'Branch baseline by enrollment truth',
        detail: 'Use product-only vs pilot vs research enrollment to route into the correct baseline path instead of one global baseline id.',
        priority: 'Next',
    },
    {
        title: 'Make product-only entry real or remove it from surrounding specs',
        detail: 'Decide whether standalone athlete onboarding exists in v1.x, then align the docs and routes to that decision.',
        priority: 'Next',
    },
    {
        title: 'Introduce contextualized variants and explicit trials',
        detail: 'Expose the progression from generic reps into pressure-type, sport-context, and transfer-checkpoint experiences.',
        priority: 'Later',
    },
    {
        title: 'Define competition-support modes',
        detail: 'Specify what changes before, during, and after competition so the athlete experience can adapt to real performance windows.',
        priority: 'Later',
    },
    {
        title: 'Re-introduce clinical consent only when the safety lane is live',
        detail: 'Keep it out of the current journey until AuntEdna and escalation workflows are operational.',
        priority: 'Later',
    },
];

const phaseStatusMeta: Record<Phase['status'], { label: string; textColor: string; borderColor: string; background: string }> = {
    live: {
        label: 'Live',
        textColor: '#86efac',
        borderColor: 'rgba(134,239,172,0.28)',
        background: 'rgba(134,239,172,0.08)',
    },
    partial: {
        label: 'Partial',
        textColor: '#fcd34d',
        borderColor: 'rgba(252,211,77,0.26)',
        background: 'rgba(252,211,77,0.08)',
    },
    target: {
        label: 'Target',
        textColor: '#93c5fd',
        borderColor: 'rgba(147,197,253,0.24)',
        background: 'rgba(147,197,253,0.08)',
    },
};

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */
function PhaseCard({ phase, isExpanded, onToggle }: { phase: Phase; isExpanded: boolean; onToggle: () => void }) {
    const Icon = phase.icon;
    const status = phaseStatusMeta[phase.status];
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
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white truncate">{phase.label}</p>
                        <span
                            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                            style={{
                                color: status.textColor,
                                borderColor: status.borderColor,
                                background: status.background,
                            }}
                        >
                            {status.label}
                        </span>
                    </div>
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
                            This document now distinguishes between the current athlete journey that is actually live in the web product and the target journey that still serves as the longer-range north star.
                            The system should feel like guided mental training, not like a lab assessment on first touch.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── CURRENT STATUS ── */}
            <div className="bg-emerald-500/[0.07] border border-emerald-500/20 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-white mb-1">Current V1 Status</p>
                        <p className="text-sm text-zinc-300 leading-relaxed">
                            Phases 0 through 2 are mostly live, Phase 3 is partially live through program and assignment data, and Phases 4 through 7 should be treated as target-state rather than current shipped behavior.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── CURRENT FLOW ── */}
            <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide mb-3">Current V1 Athlete Flow</h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                    {CURRENT_V1_FLOW.map((step, i) => (
                        <div key={step} className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-[#E0FE10] border border-[#E0FE10]/25 bg-[#E0FE10]/10 mt-0.5">
                                {i + 1}
                            </div>
                            <p className="text-sm text-zinc-300">{step}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── ENTRY CONTEXTS ── */}
            <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide mb-3">Entry Contexts the Journey Must Support</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {ENTRY_CONTEXTS.map((entry) => (
                        <div
                            key={entry.label}
                            className="rounded-xl border p-4"
                            style={{ background: `${entry.accent}08`, borderColor: `${entry.accent}25` }}
                        >
                            <p className="text-sm font-semibold text-white">{entry.label}</p>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">{entry.description}</p>
                        </div>
                    ))}
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

            {/* ── CONSENT + BASELINE BRANCHING ── */}
            <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide mb-3">Consent and Baseline Branching</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#090f1c] border border-zinc-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            <p className="text-sm font-semibold text-white">Consent Lanes Stay Separate</p>
                        </div>
                        {CONSENT_BRANCHES.map((branch) => (
                            <div key={branch.lane}>
                                <p className="text-xs font-semibold text-zinc-200">{branch.lane}</p>
                                <p className="text-xs leading-relaxed text-zinc-500 mt-1">{branch.meaning}</p>
                            </div>
                        ))}
                    </div>
                    <div className="bg-[#090f1c] border border-zinc-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-sky-400" />
                            <p className="text-sm font-semibold text-white">Baseline Branching Rule</p>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            The first Trial an athlete takes is their baseline. Once onboarding is complete, the system should route them directly into the correct baseline path based on enrollment truth.
                        </p>
                        <div className="space-y-2">
                            <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                                <p className="text-xs font-semibold text-white">Product-only athlete</p>
                                <p className="mt-1 text-xs text-zinc-500">Enter the standard baseline path and continue into the normal Program rhythm.</p>
                            </div>
                            <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                                <p className="text-xs font-semibold text-white">Research-enrolled athlete</p>
                                <p className="mt-1 text-xs text-zinc-500">Enter the research-aligned baseline path while preserving clean dataset eligibility rules.</p>
                            </div>
                        </div>
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

            {/* ── DAY 1 RULES ── */}
            <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide mb-3">Day 1 Rules for Pilot-Aware Onboarding</h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                    {DAY_ONE_RULES.map((rule, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-zinc-300">{rule}</p>
                        </div>
                    ))}
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

            {/* ── BUILD CHECKLIST ── */}
            <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide mb-3">Build Checklist</h3>
                <div className="space-y-3">
                    {BUILD_CHECKLIST.map((item) => (
                        <div key={item.title} className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-4">
                            <div className="flex items-center gap-3">
                                <span
                                    className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                                    style={{
                                        color: item.priority === 'Now' ? '#86efac' : item.priority === 'Next' ? '#fcd34d' : '#93c5fd',
                                        borderColor: item.priority === 'Now'
                                            ? 'rgba(134,239,172,0.28)'
                                            : item.priority === 'Next'
                                                ? 'rgba(252,211,77,0.26)'
                                                : 'rgba(147,197,253,0.24)',
                                        background: item.priority === 'Now'
                                            ? 'rgba(134,239,172,0.08)'
                                            : item.priority === 'Next'
                                                ? 'rgba(252,211,77,0.08)'
                                                : 'rgba(147,197,253,0.08)',
                                    }}
                                >
                                    {item.priority}
                                </span>
                                <p className="text-sm font-semibold text-white">{item.title}</p>
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.detail}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── SUMMARY ── */}
            <div className="bg-gradient-to-br from-purple-500/10 to-sky-500/5 border border-purple-500/20 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-white mb-2">Summary</h3>
                <p className="text-sm text-zinc-300 leading-relaxed">
                    The current athlete journey is now clearer: invite or enrollment entry, athlete onboarding, baseline unlock, baseline completion, and then movement between Today, Nora, Profile, and the team workspace.
                    The longer-range journey still matters, but it should be treated as the target system we are building toward rather than the system we have already shipped.
                </p>
            </div>

        </div>
    );
};

export default AthleteJourneyTab;
