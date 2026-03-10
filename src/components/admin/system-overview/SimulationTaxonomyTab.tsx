import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain,
    Shield,
    Crosshair,
    Eye,
    Target,
    Zap,
    Activity,
    Gauge,
    BarChart3,
    Layers,
    FlaskConical,
    Cpu,
    Timer,
    Award,
    BookOpen,
    ChevronDown,
    ChevronRight,
    FileText,
} from 'lucide-react';

/* ---- TYPES ---- */
interface Skill {
    name: string;
    construct: string;
    coreMetric: string;
    primarySim: string;
}

interface Modifier {
    name: string;
    key: string;
    type: 'state' | 'stability' | 'decay' | 'sensitivity';
    description: string;
    measureHow: string;
    color: string;
}

interface Sim {
    name: string;
    pillar: 'focus' | 'composure' | 'decision';
    skills: string[];
    coreMetric: string;
    supportingMetrics: string[];
    pressureTypes: string[];
    description: string;
    evidenceStatus: string;
    scientificBasis: string;
}

/* ---- DATA ---- */
const PILLARS = [
    {
        id: 'focus' as const,
        label: 'Focus',
        icon: Eye,
        accent: '#60a5fa',
        accentDim: 'rgba(96,165,250,0.08)',
        description:
            'The ability to direct, sustain, and shift attention in the presence of internal and external distraction. Focus skills determine whether the athlete can lock onto the right cue, hold it, and redirect when disrupted.',
        skills: [
            { name: 'Sustained Attention', construct: 'Holding task-relevant focus over extended time-on-task without decay.', coreMetric: 'Time-on-task before first significant accuracy drop', primarySim: 'Endurance Lock' },
            { name: 'Selective Attention', construct: 'Filtering distractors and prioritizing the right cue under interference.', coreMetric: 'Accuracy under increasing distractor density', primarySim: 'Noise Gate' },
            { name: 'Attentional Shifting', construct: 'Rapidly redirecting focus after disruption without residual interference.', coreMetric: 'Refocus speed after disruption event', primarySim: 'Reset' },
        ] as Skill[],
    },
    {
        id: 'composure' as const,
        label: 'Composure',
        icon: Shield,
        accent: '#22c55e',
        accentDim: 'rgba(34,197,94,0.08)',
        description:
            'The ability to maintain execution quality when emotions, errors, or evaluative pressure threaten to derail performance. Composure skills keep the athlete from spiraling after a mistake or freezing when the moment matters.',
        skills: [
            { name: 'Error Recovery Speed', construct: 'How fast the athlete returns to baseline execution after making a mistake.', coreMetric: 'Post-error recovery time (ms to clean rep)', primarySim: 'Reset' },
            { name: 'Emotional Interference Control', construct: 'Preventing emotional arousal from degrading cognitive or motor performance.', coreMetric: 'Performance delta under emotional load vs. neutral', primarySim: 'Reset' },
            { name: 'Pressure Stability', construct: 'Maintaining quality under evaluative or competitive pressure conditions.', coreMetric: 'Score variance under pressure vs. training reps', primarySim: 'Reset' },
        ] as Skill[],
    },
    {
        id: 'decision' as const,
        label: 'Decision',
        icon: Crosshair,
        accent: '#c084fc',
        accentDim: 'rgba(192,132,252,0.08)',
        description:
            'The ability to process information, inhibit incorrect responses, and act on the right cue at the right time. Decision skills separate athletes who react from athletes who choose.',
        skills: [
            { name: 'Response Inhibition', construct: 'Canceling a prepotent or initiated action when conditions change. Preventing impulsive responses.', coreMetric: 'Go/No-Go accuracy under time pressure', primarySim: 'Brake Point' },
            { name: 'Working Memory Updating', construct: 'Tracking and updating active rules, sequences, or priorities in real time.', coreMetric: 'Rule-switch accuracy across increasing memory load', primarySim: 'Sequence Shift' },
            { name: 'Cue Discrimination', construct: 'Distinguishing the real signal from noise or decoys under time pressure.', coreMetric: 'Correct-detection rate minus false alarm rate (d-prime)', primarySim: 'Signal Window' },
        ] as Skill[],
    },
];

const MODIFIERS: Modifier[] = [
    { name: 'Readiness', key: 'readiness', type: 'state', description: 'Pre-session state derived from daily check-in (sleep, energy, stress, mood). Readiness adjusts session expectations and determines whether a session is a Probe, Skill Rep, or Recovery Rep.', measureHow: 'Daily check-in inputs → composite readiness score 0-100', color: '#22d3ee' },
    { name: 'Fatigability', key: 'fatigability', type: 'decay', description: 'How much a skill degrades over the course of a session due to time-on-task, cumulative cognitive load, or repeated challenge. Some athletes maintain performance; others show late-session decay.', measureHow: 'Performance delta: early-session vs. late-session within the same sim run', color: '#f59e0b' },
    { name: 'Consistency', key: 'consistency', type: 'stability', description: 'Variance in skill scores across repeated sessions. Low variance = the athlete truly owns the skill. High variance = the skill is context-dependent or unstable.', measureHow: 'Coefficient of variation across the last N sessions per skill', color: '#E0FE10' },
    { name: 'Pressure Sensitivity', key: 'pressure_sensitivity', type: 'sensitivity', description: 'How much performance changes when evaluative, competitive, or escalating pressure is applied. Some athletes are pressure-neutral; others show measurable degradation.', measureHow: 'Performance delta: pressure reps vs. neutral reps within the same session', color: '#fb923c' },
];

const SIMS: Sim[] = [
    { name: 'Reset', pillar: 'composure', skills: ['Error Recovery Speed', 'Emotional Interference Control', 'Attentional Shifting'], coreMetric: 'Post-error recovery time (ms to first clean rep after disruption)', supportingMetrics: ['Consistency index', 'Pre-disruption accuracy', 'Disruption-type recovery delta', 'Resilience score'], pressureTypes: ['Escalating (timer shrinks)', 'Error compounding', 'Evaluative (coach watching)'], description: 'Tap a rhythm pattern. The system disrupts with visual noise, rule changes, or emotional interference. The core measurement is how fast the athlete regains clean execution after being thrown off.', evidenceStatus: 'Adjacent', scientificBasis: 'ACT (Eysenck et al., 2007), SIT (Meichenbaum, 1985)' },
    { name: 'Noise Gate', pillar: 'focus', skills: ['Selective Attention', 'Sustained Attention'], coreMetric: 'Accuracy under increasing distractor density (signal vs. noise)', supportingMetrics: ['False alarm rate', 'Distractor cost', 'Sustained accuracy over time'], pressureTypes: ['Distractor escalation', 'Environmental noise injection'], description: "Identify the target cue among increasing visual and auditory distractors. Trains the athlete's ability to filter noise and maintain focus on what matters while the environment gets louder.", evidenceStatus: 'Adjacent', scientificBasis: 'Posner & Petersen (1990), Nideffer & Sagal (2006)' },
    { name: 'Brake Point', pillar: 'decision', skills: ['Response Inhibition'], coreMetric: 'Go/No-Go accuracy under time pressure', supportingMetrics: ['False start rate', 'Inhibition latency', 'Commission errors'], pressureTypes: ['Time compression', 'High-similarity decoys'], description: 'React to valid cues and suppress reactions to no-go cues. Speed and accuracy both matter. Trains the athlete to cancel bad actions before errors cascade — the mental braking system.', evidenceStatus: 'Adjacent', scientificBasis: 'Miyake et al. (2000), USOC Mental Training Manual (2008)' },
    { name: 'Signal Window', pillar: 'decision', skills: ['Cue Discrimination'], coreMetric: 'Correct detection rate minus false alarm rate (d-prime)', supportingMetrics: ['Response time to valid cues', 'Decay rate with time pressure', 'Cross-modal accuracy'], pressureTypes: ['Time window compression', 'Multi-modal distractors'], description: "Detect the real signal from among decoy stimuli within a shrinking time window. Measures the athlete's ability to read the right cue when it matters and ignore convincing fakes.", evidenceStatus: 'Mechanism-Only', scientificBasis: 'Zhu et al. (2024), Signal Detection Theory (Green & Swets)' },
    { name: 'Sequence Shift', pillar: 'decision', skills: ['Working Memory Updating'], coreMetric: 'Rule-switch accuracy across increasing memory load', supportingMetrics: ['Switch cost (ms)', 'Perseveration errors', 'Dual-task interference'], pressureTypes: ['Rule changes mid-trial', 'Increasing cognitive load'], description: "Follow a sequence of rules that change mid-trial. Tracks whether the athlete can update priorities in working memory without perseveration — essential for adapting on the fly.", evidenceStatus: 'Mechanism-Only', scientificBasis: 'Miyake et al. (2000), Task-switching literature' },
    { name: 'Endurance Lock', pillar: 'focus', skills: ['Sustained Attention'], coreMetric: 'Time-on-task before first significant accuracy drop', supportingMetrics: ['Late-session accuracy delta', 'Vigilance decrement slope', 'Recovery after micro-lapse'], pressureTypes: ['Extended duration', 'Monotony with rare targets'], description: "Sustain focus on a repetitive task over an extended duration. Rare target events test vigilance. Measures the athlete's ability to stay locked in when the task is boring but the moment demands it.", evidenceStatus: 'Adjacent', scientificBasis: 'Schampheleer et al. (2024), Parasuraman vigilance decrement research' },
];

const SCORE_LAYERS = [
    { name: 'Headline Layer', description: "Single-number mental readiness score for the athlete and coach to understand at a glance.", examples: ['Focus: 88', 'Composure: 91', 'Decision: 79'], audience: 'Athlete, Coach' },
    { name: 'Skill Layer', description: "Per-skill scores within each pillar. This is the working layer for Nora's prescriptions and the coach's drill-down.", examples: ['Error Recovery Speed: 91', 'Selective Attention: 81', 'Response Inhibition: 76'], audience: 'Coach, Program Engine' },
    { name: 'Raw Metric Layer', description: 'The actual measurement outputs from each sim session. These are the ground-truth numbers that skill scores are derived from.', examples: ['Recovery time: 342ms', 'Accuracy: 94.2%', 'Distractor cost: +180ms'], audience: 'System, Research' },
];

const EVIDENCE_LEVELS = [
    { level: 'Mechanism-Only', color: '#94a3b8', claim: 'The sim exercises a cognitive mechanism that research shows matters for performance.', requirement: 'Published peer-reviewed research on the underlying cognitive construct.' },
    { level: 'Adjacent', color: '#60a5fa', claim: 'The mechanism is established, and related training interventions have shown effects in sport or performance contexts.', requirement: 'Mechanism research + published training studies in adjacent domains.' },
    { level: 'Internally Validated', color: '#22c55e', claim: "Pulse Check's implementation specifically has demonstrated measurable improvement in controlled testing.", requirement: 'Internal pre/post data showing significant improvement on target metrics.' },
    { level: 'Transfer-Validated', color: '#E0FE10', claim: 'The trained skill retains and transfers through Trials of increasing fidelity toward competition.', requirement: 'Transfer testing across Baseline → Immersive → Field trials with measurable Transfer Gap reduction.' },
];

const SESSION_TYPES = [
    { type: 'Probe', description: 'Assessment-focused. Tests current level. No coaching or adaptation applied. Used for baseline and periodic re-assessment.', duration: '2-3 min', when: 'First session, weekly check, or after readiness flag' },
    { type: 'Skill Rep', description: "The standard daily training session. Nora adapts difficulty tier and pressure based on performance. Builds the skill through repetition and progressive overload.", duration: '3-5 min', when: 'Default daily session when readiness is normal' },
    { type: 'Recovery Rep', description: 'Low-pressure, reduced-tempo session for days when readiness is low. Maintains habit and form without pushing for gains.', duration: '2-3 min', when: 'Low readiness day (sleep < 5h, high stress, etc.)' },
    { type: 'Pressure Exposure', description: 'Intentionally escalated pressure conditions. Timer shrinks, penalties increase, evaluative cues added. Tests composure under realistic stress.', duration: '3-5 min', when: 'After athlete has stabilized at current tier' },
];

const TRIAL_SEQUENCE = [
    { stage: 'Baseline Trial', surface: 'Phone / Web', description: 'Establishes starting profile before a Program begins. Standardized assessment conditions.', color: '#60a5fa' },
    { stage: 'Program', surface: 'Phone / Web', description: 'Daily Sim training — repetition, progression, and AI adaptation through Nora.', color: '#22c55e' },
    { stage: 'Immersive Transfer Trial', surface: 'Apple Vision Pro', description: 'Optional bridge. Higher psychological and perceptual fidelity. Tests skill retention in immersive context.', color: '#c084fc' },
    { stage: 'Field Transfer Trial', surface: 'Physical / Coach-Led', description: 'Same skill language, real-world environment. Movement, noise, timing pressure, sport-adjacent execution.', color: '#fb923c' },
    { stage: 'Competition', surface: 'Game / Match', description: 'Ultimate external endpoint. Self-report + coach observation. Not directly measured by system.', color: '#ef4444' },
];

const REFERENCES = [
    { id: 1, text: 'Eysenck, M. W., & Calvo, M. G. (1992). Anxiety and performance: The processing efficiency theory. Cognition & Emotion, 6(6), 409-434.' },
    { id: 2, text: 'Eysenck, M. W., Derakshan, N., Santos, R., & Calvo, M. G. (2007). Anxiety and cognitive performance: Attentional control theory. Emotion, 7(2), 336-353.' },
    { id: 3, text: 'Meichenbaum, D. (1985). Stress Inoculation Training. Pergamon Press.' },
    { id: 4, text: 'Posner, M. I., & Petersen, S. E. (1990). The attention system of the human brain. Annual Review of Neuroscience, 13, 25-42.' },
    { id: 5, text: 'Miyake, A., et al. (2000). The unity and diversity of executive functions. Cognitive Psychology, 41(1), 49-100.' },
    { id: 6, text: 'Nideffer, R., & Sagal, M. (2006). Concentration and attention control training. In Applied Sport Psychology (pp. 382-403). McGraw-Hill.' },
    { id: 7, text: 'APA Division 47. (2014). Concentration and Attention in Sport. Sport Psychology Works Fact Sheet.' },
    { id: 8, text: 'USOC Performance Services Division. (2008). Sport Psychology Mental Training Manual.' },
    { id: 9, text: 'Zhu, R., et al. (2024). Effects of perceptual-cognitive training on anticipation and decision-making skills. Behavioral Sciences, 14(10), 919.' },
    { id: 10, text: 'Harris, D. J., et al. (2020). A framework for testing and validation of simulated environments. Frontiers in Psychology, 11, 605.' },
    { id: 11, text: 'Saunders, T., et al. (1996). The effect of stress inoculation training on anxiety and performance. JOHP, 1(2), 170-186.' },
    { id: 12, text: 'Stinson, C., & Bowman, D. A. (2014). Feasibility of training athletes for high-pressure situations using VR. IEEE TVCG, 20(4), 606-615.' },
    { id: 13, text: 'Schampheleer, E., et al. (2024). Mental fatigue in sport - from impaired performance to underlying mechanisms. Sports Medicine, 54, 1947-1968.' },
];

/* ---- COLLAPSIBLE ---- */
function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-black/20 hover:bg-black/40 transition-colors text-left">
                <span className="text-sm font-semibold text-white">{title}</span>
                {open ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                        <div className="p-4 space-y-3">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ---- PILLAR BADGE ---- */
function PillarBadge({ pillar }: { pillar: 'focus' | 'composure' | 'decision' }) {
    const config = { focus: { color: '#60a5fa', label: 'Focus' }, composure: { color: '#22c55e', label: 'Composure' }, decision: { color: '#c084fc', label: 'Decision' } };
    const c = config[pillar];
    return (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border" style={{ color: c.color, borderColor: c.color + '40', background: c.color + '12' }}>
            {c.label}
        </span>
    );
}

/* ---- MAIN TAB ---- */
const SimulationTaxonomyTab: React.FC = () => {
    return (
        <div className="space-y-10">
            {/* INTRO */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <Brain className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">Simulation Taxonomy</h2>
                        <p className="text-xs text-zinc-500">Version 1.0 · March 2026</p>
                    </div>
                </div>
                <p className="text-sm text-zinc-300 max-w-4xl">
                    The complete reference for Pulse Check&apos;s mental performance system — pillars, skills, modifiers, sims, scoring, evidence framework, and program orchestration.
                </p>
            </div>

            {/* 1. PURPOSE */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-400" /> 1. Purpose and Strategic Stance
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Pulse Check exists to train measurable mental performance under pressure. It is not a library of disconnected mini-games and it is not a wellness app with a performance wrapper.
                    </p>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Pulse Check is a <span className="text-white font-semibold">simulation system</span>: a serious training lane that helps athletes and coaches build, measure, and improve the mental side of execution in the same way physical systems build measurable strength, speed, and conditioning.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                        {['Not a library of disconnected mini-games', 'Not a wellness app with a performance wrapper', 'A simulation system for measurable mental performance'].map((point, i) => (
                            <div key={i} className={`rounded-xl border px-4 py-3 text-xs ${i === 2 ? 'border-green-500/30 bg-green-500/5 text-green-300' : 'border-red-500/20 bg-red-500/5 text-red-300'}`}>
                                <span className="font-bold mr-1">{i === 2 ? '✓' : '✗'}</span>{point}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 2. PRODUCT LANGUAGE */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" /> 2. Product Language and System Objects
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5">
                    <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                        Pulse Check uses a simple, durable object model. This document intentionally uses <span className="text-white font-semibold">Program</span> as the curriculum layer and avoids legacy vocabulary that creates unnecessary education overhead.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                            { term: 'Sim', def: 'A single interactive mental exercise targeting one or more skills' },
                            { term: 'Program', def: 'A multi-week curriculum of Sims, check-ins, and progression rules' },
                            { term: 'Trial', def: 'A formal assessment event that tests skill retention and transfer' },
                            { term: 'Session', def: 'A single play-through of a Sim with recorded metrics' },
                        ].map((item) => (
                            <div key={item.term} className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                                <p className="text-xs font-bold text-white mb-1">{item.term}</p>
                                <p className="text-[10px] text-zinc-500 leading-snug">{item.def}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 3. PILLARS & SKILL MAP */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" /> 3. Core Pillars and Official Skill Map
                </h3>
                <p className="text-sm text-zinc-400">Three permanent pillars. Nine trainable skills. The athlete is never reduced to a single generic cognitive score.</p>
                <div className="space-y-4">
                    {PILLARS.map((pillar) => {
                        const Icon = pillar.icon;
                        return (
                            <div key={pillar.id} className="bg-[#090f1c] border border-zinc-800 rounded-2xl overflow-hidden">
                                <div className="px-5 py-4 flex items-start gap-3 border-b border-zinc-800" style={{ background: pillar.accentDim }}>
                                    <div className="p-2 rounded-xl border" style={{ borderColor: pillar.accent + '30', background: pillar.accent + '15' }}>
                                        <Icon className="w-5 h-5" style={{ color: pillar.accent }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-lg font-bold" style={{ color: pillar.accent }}>{pillar.label}</h4>
                                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{pillar.description}</p>
                                    </div>
                                </div>
                                <div className="divide-y divide-zinc-800/60">
                                    {pillar.skills.map((skill) => (
                                        <div key={skill.name} className="px-5 py-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-start">
                                            <div>
                                                <p className="text-sm font-semibold text-white">{skill.name}</p>
                                                <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{skill.construct}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Core Metric</p>
                                                <p className="text-[11px] text-zinc-400 mt-0.5">{skill.coreMetric}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Primary Sim</p>
                                                <p className="text-[11px] font-medium mt-0.5" style={{ color: pillar.accent }}>{skill.primarySim}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* 4. MODIFIERS */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" /> 4. Cross-Cutting Modifiers
                </h3>
                <p className="text-sm text-zinc-400">Modifiers are not pillars. They are overlays that can affect every skill in the system. They help Pulse Check separate trait from state and distinguish stable strengths from context-dependent breakdowns.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {MODIFIERS.map((mod) => (
                        <div key={mod.key} className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold" style={{ color: mod.color }}>{mod.name}</h4>
                                <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border font-bold" style={{ color: mod.color, borderColor: mod.color + '40', background: mod.color + '10' }}>{mod.type}</span>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed">{mod.description}</p>
                            <div className="pt-1 border-t border-zinc-800">
                                <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Measured By</p>
                                <p className="text-[11px] text-zinc-500 mt-0.5">{mod.measureHow}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 5. SCORE ARCHITECTURE */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-green-400" /> 5. Score Architecture
                </h3>
                <p className="text-sm text-zinc-400">The score system operates in layers — a simple headline story without sacrificing scientific depth.</p>
                <div className="space-y-3">
                    {SCORE_LAYERS.map((layer, i) => (
                        <div key={layer.name} className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-400">{i + 1}</div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">{layer.name}</h4>
                                    <p className="text-[10px] text-zinc-500">Audience: {layer.audience}</p>
                                </div>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed mb-2">{layer.description}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {layer.examples.map((ex) => (
                                    <span key={ex} className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-zinc-800 text-zinc-300 font-mono">{ex}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 6. EVIDENCE FRAMEWORK */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-blue-400" /> 6. Scientific Evidence Framework
                </h3>
                <p className="text-sm text-zinc-400">Every sim includes a Scientific Basis section. Citations alone are not enough — a paper can support the mechanism without proving the Pulse Check implementation is effective.</p>
                <div className="space-y-2">
                    {EVIDENCE_LEVELS.map((ev) => (
                        <div key={ev.level} className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4 flex items-start gap-4">
                            <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: ev.color }} />
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold" style={{ color: ev.color }}>{ev.level}</h4>
                                <p className="text-xs text-zinc-300 mt-1">{ev.claim}</p>
                                <p className="text-[10px] text-zinc-500 mt-1.5"><span className="font-semibold text-zinc-400">Requires:</span> {ev.requirement}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 7. SIM SPEC TEMPLATE */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" /> 7. Sim Specification Template
                </h3>
                <p className="text-sm text-zinc-400">Every Pulse Check sim is authored against one common template. If a proposed sim cannot fill out these fields cleanly, it should not ship.</p>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {['Sim Name', 'Primary Pillar', 'Target Skills', 'Core Metric', 'Supporting Metrics', 'Pressure Types', 'Tier Progression Rules', 'Duration (per tier)', 'Scientific Basis', 'Evidence Status', 'Transfer Hypothesis', 'Validation Plan'].map((field) => (
                            <div key={field} className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2">
                                <p className="text-[10px] text-zinc-400 font-medium">{field}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 8. AI ADAPTATION */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-lime-400" /> 8. AI Adaptation and Program Orchestration
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        <span className="text-white font-semibold">Nora</span> functions as the program director for Pulse Check, not just a recommendation bot. The adaptation engine runs on a state-and-profile model rather than a single generic score.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                            { title: 'Daily Check-In', desc: 'Readiness score from sleep, energy, stress, mood → adjusts session type (Probe / Skill Rep / Recovery Rep)', icon: '🌅' },
                            { title: 'Prescription Engine', desc: 'TaxonomyProfile + CheckInState → prescribeNextSession() → Sim selection, session type, duration, and rationale', icon: '🔮' },
                            { title: 'Adaptive Difficulty', desc: "Within-session tier adjustment based on real-time performance. Nora scales pressure and complexity to the athlete's edge.", icon: '📈' },
                        ].map((item) => (
                            <div key={item.title} className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                                <p className="text-lg mb-2">{item.icon}</p>
                                <p className="text-xs font-bold text-white mb-1">{item.title}</p>
                                <p className="text-[10px] text-zinc-500 leading-snug">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 9. SESSION & DURATION */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Timer className="w-4 h-4 text-orange-400" /> 9. Session Length and Duration Framework
                </h3>
                <p className="text-sm text-zinc-400">Duration is part of what Pulse Check measures. Some weaknesses only appear with time-on-task.</p>
                <div className="overflow-x-auto border border-zinc-800 rounded-2xl">
                    <table className="w-full text-sm min-w-[640px]">
                        <thead className="bg-black/20 text-zinc-400 uppercase text-xs tracking-wide">
                            <tr>
                                <th className="text-left px-4 py-2.5">Session Type</th>
                                <th className="text-left px-4 py-2.5">Duration</th>
                                <th className="text-left px-4 py-2.5">When</th>
                                <th className="text-left px-4 py-2.5">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {SESSION_TYPES.map((s) => (
                                <tr key={s.type} className="border-t border-zinc-800">
                                    <td className="px-4 py-3 text-white font-semibold text-xs">{s.type}</td>
                                    <td className="px-4 py-3 text-zinc-300 text-xs font-mono">{s.duration}</td>
                                    <td className="px-4 py-3 text-zinc-400 text-xs">{s.when}</td>
                                    <td className="px-4 py-3 text-zinc-500 text-xs">{s.description}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 10. TRIAL ARCHITECTURE */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Award className="w-4 h-4 text-yellow-400" /> 10. Trial Architecture
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Trials are formal assessment events that sit above daily Sim training and below competition. A Trial is not just a harder session — it tests whether a trained skill <span className="text-white font-semibold">retains and transfers</span> when fidelity, pressure, duration, or context changes.
                    </p>
                    <div className="flex items-center gap-1 overflow-x-auto py-4 px-2">
                        {TRIAL_SEQUENCE.map((stage, i) => (
                            <React.Fragment key={stage.stage}>
                                <div className="flex-shrink-0 w-44 rounded-xl border p-3 text-center" style={{ borderColor: stage.color + '40', background: stage.color + '08' }}>
                                    <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: stage.color }}>{stage.stage}</p>
                                    <p className="text-[10px] text-zinc-500 mt-1">{stage.surface}</p>
                                    <p className="text-[9px] text-zinc-600 mt-1 leading-snug">{stage.description}</p>
                                </div>
                                {i < TRIAL_SEQUENCE.length - 1 && <div className="flex-shrink-0 text-zinc-600 text-lg">→</div>}
                            </React.Fragment>
                        ))}
                    </div>
                    <CollapsibleSection title="Why Trials Exist">
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Sims answer: <em className="text-zinc-300">can the athlete build the skill in a controlled training environment?</em> Trials answer: <em className="text-zinc-300">does the skill retain and transfer when the context changes?</em>
                        </p>
                    </CollapsibleSection>
                    <CollapsibleSection title="Transfer Gap">
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            <span className="text-white font-semibold">Transfer Gap</span> = the difference between performance in training and performance in a higher-fidelity Trial. A small Transfer Gap suggests the athlete owns the skill across contexts.
                        </p>
                    </CollapsibleSection>
                    <CollapsibleSection title="Vision Pro as Immersive Transfer Layer">
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Apple Vision Pro is positioned as an optional Immersive Transfer Trial surface, not the daily driver. Its value: increased psychological, affective, perceptual, and ergonomic fidelity before full field testing.
                        </p>
                    </CollapsibleSection>
                </div>
            </section>

            {/* 11. SIM PORTFOLIO */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-lime-400" /> 11. Initial Sim Portfolio
                </h3>
                <p className="text-sm text-zinc-400">The first sim library covers the full taxonomy. Each sim below is a family, not a locked final design.</p>
                <div className="space-y-3">
                    {SIMS.map((sim) => (
                        <div key={sim.name} className="bg-[#090f1c] border border-zinc-800 rounded-2xl overflow-hidden">
                            <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-zinc-800/60">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-base font-bold text-white">{sim.name}</h4>
                                        <PillarBadge pillar={sim.pillar} />
                                    </div>
                                    <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">{sim.description}</p>
                                </div>
                                <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-zinc-700 bg-black/30 text-zinc-400 flex-shrink-0">{sim.evidenceStatus}</span>
                            </div>
                            <div className="px-5 py-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1">Target Skills</p>
                                    <div className="space-y-0.5">{sim.skills.map((s) => <p key={s} className="text-[11px] text-zinc-300">{s}</p>)}</div>
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1">Core Metric</p>
                                    <p className="text-[11px] text-zinc-400">{sim.coreMetric}</p>
                                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mt-2 mb-1">Supporting Metrics</p>
                                    <div className="flex flex-wrap gap-1">{sim.supportingMetrics.map((m) => <span key={m} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-zinc-800 text-zinc-500">{m}</span>)}</div>
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1">Pressure Types</p>
                                    <div className="space-y-0.5">{sim.pressureTypes.map((p) => <p key={p} className="text-[11px] text-zinc-400">{p}</p>)}</div>
                                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mt-2 mb-1">Scientific Basis</p>
                                    <p className="text-[10px] text-zinc-500 italic">{sim.scientificBasis}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 12. VALIDATION ROADMAP */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-green-400" /> 12. Validation Roadmap and Operating Rules
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed">Pulse Check builds credibility through disciplined validation. Every new sim moves through the same ladder from mechanism to transfer.</p>
                    <div className="space-y-2">
                        {[
                            { step: '1', title: 'Mechanism Review', desc: 'Identify the cognitive construct. Confirm peer-reviewed research supports the mechanism.', color: '#94a3b8' },
                            { step: '2', title: 'Sim Design & Build', desc: 'Author the sim against the spec template. Define metrics, tiers, and pressure types.', color: '#60a5fa' },
                            { step: '3', title: 'Internal Pilot', desc: 'Run the sim with internal testers. Validate measurement reliability and UX completion rates.', color: '#a78bfa' },
                            { step: '4', title: 'Pre/Post Validation', desc: 'Measure improvement on target metrics before and after a training block. Establish effect sizes.', color: '#22c55e' },
                            { step: '5', title: 'Transfer Testing', desc: 'Test whether trained skills transfer through Trials of increasing fidelity (Immersive → Field).', color: '#E0FE10' },
                            { step: '6', title: 'Outcome Correlation', desc: 'Correlate Pulse Check data with real competition performance and coach assessments.', color: '#fb923c' },
                        ].map((item) => (
                            <div key={item.step} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-black/20 p-3">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: item.color + '20', color: item.color, border: `1px solid ${item.color}40` }}>{item.step}</div>
                                <div>
                                    <p className="text-xs font-bold text-white">{item.title}</p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* APPENDIX: REFERENCES */}
            <section className="space-y-4 pb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-zinc-400" /> Appendix A. Foundational References
                </h3>
                <p className="text-sm text-zinc-400">These references support the mechanisms behind the taxonomy, sim architecture, and Trial layer.</p>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5">
                    <div className="space-y-2">
                        {REFERENCES.map((ref) => (
                            <div key={ref.id} className="flex items-start gap-3 text-xs">
                                <span className="text-zinc-600 font-mono flex-shrink-0 w-6 text-right">[{ref.id}]</span>
                                <p className="text-zinc-400 leading-relaxed">{ref.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default SimulationTaxonomyTab;
