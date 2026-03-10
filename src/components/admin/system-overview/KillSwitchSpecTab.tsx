import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap,
    Brain,
    Gamepad2,
    Ruler,
    BarChart3,
    Sliders,
    TrendingUp,
    GitBranch,
    FlaskConical,
    Shield,
    Eye,
    Smartphone,
    Palette,
    MessageSquare,
    BookOpen,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    Target,
    AlertTriangle,
} from 'lucide-react';

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

/* ---- GAME FLOW PHASES ---- */
const GAME_PHASES = [
    {
        phase: '1',
        name: 'Lock In',
        color: '#60a5fa',
        duration: '8–15 sec',
        description: 'Sustained, narrow-attention focus task that establishes a baseline engagement state.',
        tiers: [
            'Beginner: Tap a target on screen in rhythm with a pulse',
            'Intermediate: Track a moving target while ignoring peripheral visual noise',
            'Advanced: Execute a sequence from memory while ambient audio plays',
        ],
    },
    {
        phase: '2',
        name: 'Disruption',
        color: '#f59e0b',
        duration: '1–3 sec',
        description: 'Without warning, a disruption breaks focus and triggers an emotional or cognitive response.',
        tiers: [
            'Visual: Screen flashes red, target disappears, layout scrambles',
            'Audio: Sudden crowd noise, whistle, buzzer, or jarring sound',
            'Cognitive: Provocative on-screen message ("You missed it." "Too slow.")',
            'Combined (advanced): Multiple channels hit simultaneously',
        ],
    },
    {
        phase: '3',
        name: 'Reset',
        color: '#22c55e',
        duration: 'Measured',
        description: 'Re-engage with the focus task as fast as possible. Recovery Time is captured — the core metric.',
        tiers: [
            'Moment of accurate re-engagement captured',
            'Recovery Time = disruption end → confirmed re-engagement',
            'Compared to personal average (Training Mode)',
            '5–7 rounds per session, summary at end',
        ],
    },
];

/* ---- SCIENTIFIC REFERENCES ---- */
const SCIENTIFIC_FOUNDATIONS = [
    {
        name: 'Attentional Control Theory',
        authors: 'Eysenck & Calvo, 1992; Eysenck et al., 2007',
        summary: 'Anxiety disrupts the balance between goal-directed and stimulus-driven attention. Reset trains the goal-directed system to override stimulus-driven hijacking.',
    },
    {
        name: 'Stress Inoculation Training',
        authors: 'Meichenbaum, 1985',
        summary: 'Repeated controlled stressor exposure with structured recovery builds resilience. Reset simulates sport-relevant disruptions with graduated intensity.',
    },
    {
        name: 'Refocusing Speed as Expertise Marker',
        authors: 'Sport psychology literature',
        summary: 'Elite athletes refocus faster after mistakes than amateurs. This is a trained skill. Reset makes it visible and trainable.',
    },
    {
        name: 'Distraction-Refocusing Drills',
        authors: 'Nideffer & Sagal, 2006; APA Div 47',
        summary: 'APA sport psychology guidelines recommend distraction drills. Reset is the gamified, measurable version of this established protocol.',
    },
];

/* ---- SKILL SCORES ---- */
const SKILL_SCORES = [
    { skill: 'Attentional Shifting', pillar: 'Focus', description: 'How fast & completely the athlete redirects attention from disruption back to the task. Derived from both re-engagement latency and first-post-reset accuracy.', color: '#60a5fa' },
    { skill: 'Inhibitory Control', pillar: 'Composure', description: 'Ability to suppress the emotional/cognitive response to the disruptor and choose to refocus. Derived from false start rate and premature response patterns.', color: '#22c55e' },
    { skill: 'Pressure Stability', pillar: 'Composure', description: 'Recovery time consistency under evaluative threat and consequence modifiers vs. baseline. Stratified by modifier condition per Standards Addendum §9.', color: '#c084fc' },
];

/* ---- RAW METRICS ---- */
const RAW_METRICS = [
    { metric: 'Recovery Time', description: 'Milliseconds from disruption end to confirmed re-engagement (two consecutive correct responses).', primary: true },
    { metric: 'First-Post-Reset Accuracy', description: 'Whether the first response after disruption is correct, capturing quality of initial refocus.' },
    { metric: 'False Start Count', description: 'Responses during the disruption phase before the reset signal. Logged separately.' },
    { metric: 'Pre-Disruption Accuracy', description: 'Focus task accuracy before the disruption, establishing per-round baseline.' },
    { metric: 'Recovery Time Variance', description: 'Within-session consistency of recovery across rounds. Feeds Consistency modifier score.' },
    { metric: 'Disruption Type Tag', description: 'Which disruption channel was active (visual, audio, cognitive, combined) for stratified analysis.' },
    { metric: 'Modifier Condition Tag', description: 'Which modifiers were active, enabling pressure-stratified scoring.' },
];

/* ---- CROSS-CUTTING MODIFIER CONTRIBUTIONS ---- */
const CROSSCUTTING_CONTRIBUTIONS = [
    { modifier: 'Readiness', contribution: 'Session-opening Recovery Time vs. rolling baseline. Faster opening rounds → higher readiness signal.' },
    { modifier: 'Consistency', contribution: 'Recovery Time variance within session. Low variance → high consistency score.' },
    { modifier: 'Fatigability', contribution: 'Recovery Time degradation from early rounds to late rounds within a session.' },
    { modifier: 'Pressure Sensitivity', contribution: 'Recovery Time gap between baseline modifier conditions and pressure modifier conditions.' },
];

/* ---- MODIFIER COMPATIBILITY ---- */
const MODIFIER_COMPAT = [
    { modifier: 'Distraction', behavior: 'Adds irrelevant stimuli during focus phase. Increases cognitive load before disruption.', levels: 'Low / Medium / High' },
    { modifier: 'Time Pressure', behavior: 'Shrinks recovery window. Adds visible countdown or pace escalation.', levels: 'Standard / Tight / Extreme' },
    { modifier: 'Evaluative Threat', behavior: 'Stakes messaging ("Coach is watching", "Recorded session"). Creates social pressure.', levels: 'Subtle / Moderate / Direct' },
    { modifier: 'Consequence', behavior: 'Failed recovery costs something (lose streak, drop score). Raises emotional stakes.', levels: 'Low / Medium / High' },
    { modifier: 'Ambiguity', behavior: 'Unclear which task returns post-disruption, or disruption timing unpredictable.', levels: 'Slight / Moderate / Full' },
    { modifier: 'Fatigue Load', behavior: 'Longer sessions, faster pacing, or higher cognitive demands to induce mental fatigue.', levels: 'Standard / Elevated / Extended' },
];

/* ---- DIFFICULTY TIERS ---- */
const DIFFICULTY_TIERS = [
    {
        tier: 1,
        name: 'Foundation',
        color: '#94a3b8',
        target: '< 3 sec',
        focusTask: 'Rhythmic tapping',
        disruption: 'Single-channel (visual only)',
        modifiers: 'None',
        keyLesson: 'Basic mechanic: disruption happens, you come back.',
    },
    {
        tier: 2,
        name: 'Sharpening',
        color: '#60a5fa',
        target: '< 2 sec',
        focusTask: 'Tracking-based',
        disruption: 'Multi-channel',
        modifiers: 'Distraction + Time Pressure',
        keyLesson: 'Difference between reacting and choosing to refocus.',
    },
    {
        tier: 3,
        name: 'Pressure',
        color: '#c084fc',
        target: '< 1.5 sec',
        focusTask: 'Sequence memory',
        disruption: 'Combined, escalating intensity',
        modifiers: 'Evaluative Threat + Consequence + Ambiguity',
        keyLesson: 'Training starts to feel like competition.',
    },
    {
        tier: 4,
        name: 'Elite',
        color: '#22c55e',
        target: '< 1 sec',
        focusTask: 'Complex with variable rules',
        disruption: 'All channels, unpredictable, back-to-back',
        modifiers: 'All active at high intensity',
        keyLesson: 'Simulates elite competition where recovery must be instantaneous.',
    },
];

/* ---- VARIANTS ---- */
const VARIANTS = [
    { name: 'Visual Disruption', description: 'Screen-based visual interruptions only. Default variant for Tier 1–2.', status: 'Registered' },
    { name: 'Audio Disruption', description: 'Crowd noise, whistles, jarring sounds. Sport-atmosphere variant.', status: 'Registered' },
    { name: 'Cognitive Disruption', description: 'Provocative messaging and evaluative cues. Psychological pressure variant.', status: 'Registered' },
    { name: 'Combined Disruption', description: 'Multi-channel disruptions. Default for Tier 3–4.', status: 'Registered' },
    { name: 'Basketball Reset', description: 'Basketball-context disruptions (buzzer, turnover cue, crowd). Sport-specific variant.', status: 'Registered' },
    { name: 'Extended Recovery Trial', description: 'Standardized 10–15 min session at fixed Tier 3. Trial-layer assessment variant.', status: 'Registered' },
    { name: 'Reset Chamber (Vision Pro)', description: 'Immersive spatial audio + environmental disruptions. Transfer fidelity variant.', status: 'Planned' },
];

/* ---- MEASUREMENT RULES ---- */
const MEASUREMENT_RULES = [
    { rule: 'Valid re-engagement', detail: 'Two consecutive correct responses on the refocused task. A single correct + error = false start, not recovery.' },
    { rule: 'Minimum reaction time', detail: '150 ms threshold. Any response faster is flagged as motor artifact. Per Standards Addendum §2.1.' },
    { rule: 'Maximum recovery window', detail: 'Tier 1: 3s · Tier 2: 2s · Tier 3: 1.5s · Tier 4: 1s. No valid re-engagement → failed trial at max value.' },
    { rule: 'False start definition', detail: 'Input during disruption phase before reset signal. Logged separately, not counted toward Recovery Time.' },
    { rule: 'Attentional Shifting sourcing', detail: 'Multi-source: re-engagement latency + first-post-reset accuracy (§9). Prevents gaming via fast but inaccurate responding.' },
    { rule: 'Pressure Stability sourcing', detail: 'Modifier-stratified: baseline vs. pressure conditions (§9). Isolates pressure effects from fatigue/randomness.' },
];

/* ---- EXPERIENCE DESIGN PRINCIPLES ---- */
const EXPERIENCE_PRINCIPLES = [
    { title: 'Feel like training, not therapy', detail: 'The sim should feel like a drill. The athlete should want to beat their last score. Competitive energy is the engine.' },
    { title: 'Minimal UI during gameplay', detail: 'Clean, immersive screen. No navigation, no settings, no distractions beyond intentional ones. The sim owns the screen.' },
    { title: 'Data after, not during', detail: 'Performance shown between rounds (Training) or only at session end (Trial). Focus on performing, not monitoring.' },
    { title: 'Sound design matters', detail: 'Audio cues, ambient sound, feedback tones support immersion and signal state changes clearly.' },
    { title: 'Celebrate improvement, not perfection', detail: 'Highlight personal bests and trend improvements, not absolute scores. Progress is the reward.' },
];

/* ---- RESEARCH REFERENCES ---- */
const REFERENCES = [
    { id: 1, text: 'Eysenck, M. W., & Calvo, M. G. (1992). Anxiety and performance: The processing efficiency theory. Cognition & Emotion, 6(6), 409–434.' },
    { id: 2, text: 'Eysenck, M. W., Derakshan, N., Santos, R., & Calvo, M. G. (2007). Anxiety and cognitive performance: Attentional control theory. Emotion, 7(2), 336–353.' },
    { id: 3, text: 'Meichenbaum, D. (1985). Stress Inoculation Training. Pergamon Press.' },
    { id: 4, text: 'Miyake, A., Friedman, N. P., et al. (2000). The unity and diversity of executive functions. Cognitive Psychology, 41(1), 49–100.' },
    { id: 5, text: 'Posner, M. I., & Petersen, S. E. (1990). The attention system of the human brain. Annual Review of Neuroscience, 13, 25–42.' },
    { id: 6, text: 'Nideffer, R., & Sagal, M. (2006). Concentration and attention control training. In J. M. Williams (Ed.), Applied Sport Psychology (pp. 382–403). McGraw-Hill.' },
    { id: 7, text: 'APA Division 47. (2014). Concentration and Attention in Sport. Sport Psychology Works Fact Sheet.' },
    { id: 8, text: 'United States Olympic Committee, Performance Services Division. (2008). Sport Psychology Mental Training Manual.' },
];

/* ---- GOVERNING DOCUMENTS ---- */
const GOVERNING_DOCS = [
    { name: 'Sim Specification Standards Addendum (v2)', description: 'Shared measurement precision, session validity, modifier boundaries, feedback modes, trial standardization, motor confounds, validation roadmap, skill-score sourcing.' },
    { name: 'Pulse Check System Taxonomy (v3)', description: 'Three pillars, skill map, cross-cutting modifiers, score architecture, evidence framework, AI adaptation, session length, trial architecture.' },
    { name: 'Sim Family Promotion Protocol (v2)', description: 'How families are proposed, evaluated, promoted. Variant classification, divergence detection, adaptive threshold governance.' },
    { name: 'Sim Family Tree (v2)', description: 'Complete family, candidate, variant, and exploratory hierarchy for all Pulse Check simulations.' },
];

/* ---- MAIN TAB ---- */
const KillSwitchSpecTab: React.FC = () => {
    return (
        <div className="space-y-10">
            {/* HEADER */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                        <Zap className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-red-400 font-bold">PULSE CHECK · SIM SPECIFICATION</p>
                        <h2 className="text-xl font-semibold">Reset</h2>
                        <p className="text-xs text-zinc-500">Mental Recovery Training Simulation · Spec v2.0 · March 2025</p>
                    </div>
                </div>
            </div>

            {/* CONCEPT */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-red-400" /> Concept
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Reset trains the single most important mental skill in competitive athletics: <span className="text-white font-semibold">how fast you recover after something goes wrong</span>. It simulates disruption, measures the athlete&apos;s recovery time back to focused execution, and tracks that recovery speed over days and weeks. The athlete is not just practicing calm — they are building a measurable, improvable reflex.
                    </p>
                </div>
            </section>

            {/* SCIENTIFIC FOUNDATION */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" /> Scientific Foundation
                </h3>
                <p className="text-xs text-zinc-500 max-w-3xl">These references support the mechanism behind the sim. They do not, by themselves, validate the full implementation; that must be established through internal validation and transfer testing.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {SCIENTIFIC_FOUNDATIONS.map((sf) => (
                        <div key={sf.name} className="bg-[#090f1c] border border-zinc-800 rounded-xl px-4 py-3 space-y-1">
                            <p className="text-xs font-bold text-white">{sf.name}</p>
                            <p className="text-[9px] text-zinc-600">{sf.authors}</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">{sf.summary}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* GAME FLOW */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4 text-blue-400" /> Game Flow
                </h3>
                <p className="text-sm text-zinc-400">Three repeating phases, 5–7 rounds per session, ~2–4 minutes for daily training.</p>

                {/* Phase flow bar */}
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                    {GAME_PHASES.map((gp, i) => (
                        <React.Fragment key={gp.phase}>
                            <div className="flex-shrink-0 rounded-xl border px-4 py-2.5 min-w-[160px]" style={{ borderColor: gp.color + '30', background: gp.color + '08' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: gp.color + '20', color: gp.color }}>
                                        {gp.phase}
                                    </div>
                                    <p className="text-xs font-bold" style={{ color: gp.color }}>{gp.name}</p>
                                </div>
                                <p className="text-[9px] text-zinc-500">{gp.duration}</p>
                            </div>
                            {i < GAME_PHASES.length - 1 && <span className="text-zinc-600 flex-shrink-0 text-lg">→</span>}
                        </React.Fragment>
                    ))}
                    <span className="text-zinc-600 flex-shrink-0 text-lg">↻</span>
                </div>

                {GAME_PHASES.map((gp) => (
                    <CollapsibleSection key={gp.phase} title={`Phase ${gp.phase}: ${gp.name}`} defaultOpen={gp.phase === '3'}>
                        <p className="text-xs text-zinc-400 leading-relaxed mb-2">{gp.description}</p>
                        <div className="space-y-1">
                            {gp.tiers.map((t) => (
                                <div key={t} className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: gp.color }} />
                                    <p className="text-[10px] text-zinc-500">{t}</p>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>
                ))}
            </section>

            {/* MEASUREMENT RULES */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-green-400" /> Measurement Rules
                </h3>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 mb-2">
                    <p className="text-xs text-amber-300 leading-relaxed">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        Governed by the <span className="font-semibold">Sim Specification Standards Addendum</span>. When any rule here conflicts with the Addendum, the Addendum governs.
                    </p>
                </div>
                <div className="space-y-2">
                    {MEASUREMENT_RULES.map((mr) => (
                        <div key={mr.rule} className="bg-[#090f1c] border border-zinc-800 rounded-xl px-4 py-3">
                            <p className="text-xs font-bold text-white mb-0.5">{mr.rule}</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">{mr.detail}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* SCORE ARCHITECTURE */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-purple-400" /> Score Architecture
                </h3>
                <p className="text-sm text-zinc-400">Three-layer architecture: pillar composites → skill scores → raw metrics.</p>

                {/* Layer 1 */}
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-2">Layer 1 — Pillar Composite Contribution</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                        Feeds primarily into the <span className="text-green-400 font-semibold">Composure</span> pillar composite, with secondary contribution to <span className="text-blue-400 font-semibold">Focus</span>. Weighting managed by Nora&apos;s profile engine.
                    </p>
                </div>

                {/* Layer 2 — Skill Scores */}
                <CollapsibleSection title="Layer 2 — Skill Scores" defaultOpen>
                    <div className="space-y-2">
                        {SKILL_SCORES.map((ss) => (
                            <div key={ss.skill} className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full" style={{ background: ss.color }} />
                                    <p className="text-xs font-bold text-white">{ss.skill}</p>
                                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/30 border border-zinc-700 text-zinc-500">{ss.pillar}</span>
                                </div>
                                <p className="text-[10px] text-zinc-400 leading-relaxed">{ss.description}</p>
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>

                {/* Layer 3 — Raw Metrics */}
                <CollapsibleSection title="Layer 3 — Raw Performance Metrics">
                    <div className="space-y-1.5">
                        {RAW_METRICS.map((rm) => (
                            <div key={rm.metric} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-black/20 px-3 py-2">
                                <div className={`w-1.5 h-6 rounded-full flex-shrink-0 mt-0.5 ${rm.primary ? 'bg-red-400' : 'bg-zinc-600'}`} />
                                <div>
                                    <p className={`text-xs font-semibold ${rm.primary ? 'text-red-300' : 'text-white'}`}>{rm.metric}</p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">{rm.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>

                {/* Cross-Cutting Modifier Scores */}
                <CollapsibleSection title="Cross-Cutting Modifier Scores">
                    <div className="space-y-1.5">
                        {CROSSCUTTING_CONTRIBUTIONS.map((cc) => (
                            <div key={cc.modifier} className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-2">
                                <p className="text-xs font-bold text-white">{cc.modifier}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">{cc.contribution}</p>
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>

                {/* Longitudinal */}
                <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-1">Longitudinal Tracking</p>
                    <p className="text-[10px] text-zinc-400">7-day and 30-day Recovery Time trend lines showing improvement, plateauing, or decline — the primary evidence of training adaptation.</p>
                </div>
            </section>

            {/* MODIFIER COMPATIBILITY */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" /> Modifier Compatibility Matrix
                </h3>
                <p className="text-sm text-zinc-400">Supports all six cross-cutting modifiers. Nora selects based on athlete profile and graduated exposure principle.</p>
                <div className="overflow-x-auto border border-zinc-800 rounded-xl">
                    <table className="w-full text-xs min-w-[600px]">
                        <thead className="bg-black/30 text-zinc-500 uppercase text-[9px] tracking-wider">
                            <tr>
                                <th className="text-left px-3 py-2">Modifier</th>
                                <th className="text-left px-3 py-2">Behavior</th>
                                <th className="text-left px-3 py-2">Levels</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MODIFIER_COMPAT.map((mc) => (
                                <tr key={mc.modifier} className="border-t border-zinc-800/50">
                                    <td className="px-3 py-2 font-semibold text-white whitespace-nowrap">{mc.modifier}</td>
                                    <td className="px-3 py-2 text-zinc-400">{mc.behavior}</td>
                                    <td className="px-3 py-2 text-zinc-500 font-mono text-[9px]">{mc.levels}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* DIFFICULTY PROGRESSION */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" /> Difficulty Progression
                </h3>
                <p className="text-sm text-zinc-400">Four tiers. Athletes advance automatically based on sustained performance. Nora manages assignment.</p>

                {/* Tier progress */}
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                    {DIFFICULTY_TIERS.map((dt, i) => (
                        <React.Fragment key={dt.tier}>
                            <div className="flex-shrink-0 rounded-xl border px-3 py-2 min-w-[120px]" style={{ borderColor: dt.color + '30', background: dt.color + '08' }}>
                                <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: dt.color }}>Tier {dt.tier}</p>
                                <p className="text-[10px] text-zinc-400">{dt.name}</p>
                                <p className="text-[9px] font-mono text-zinc-600">{dt.target}</p>
                            </div>
                            {i < DIFFICULTY_TIERS.length - 1 && <span className="text-zinc-600 flex-shrink-0">→</span>}
                        </React.Fragment>
                    ))}
                </div>

                <div className="space-y-2">
                    {DIFFICULTY_TIERS.map((dt) => (
                        <CollapsibleSection key={dt.tier} title={`Tier ${dt.tier} — ${dt.name}`}>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg border border-zinc-800 bg-black/20 p-2">
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">Focus Task</p>
                                    <p className="text-[10px] text-zinc-400">{dt.focusTask}</p>
                                </div>
                                <div className="rounded-lg border border-zinc-800 bg-black/20 p-2">
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">Disruption</p>
                                    <p className="text-[10px] text-zinc-400">{dt.disruption}</p>
                                </div>
                                <div className="rounded-lg border border-zinc-800 bg-black/20 p-2">
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">Modifiers</p>
                                    <p className="text-[10px] text-zinc-400">{dt.modifiers}</p>
                                </div>
                                <div className="rounded-lg border border-zinc-800 bg-black/20 p-2">
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">Recovery Target</p>
                                    <p className="text-[10px] font-mono" style={{ color: dt.color }}>{dt.target}</p>
                                </div>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-2 italic">{dt.keyLesson}</p>
                        </CollapsibleSection>
                    ))}
                </div>
            </section>

            {/* FAMILY AND VARIANT STRUCTURE */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-green-400" /> Family and Variant Structure
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        This spec defines Reset at the <span className="text-white font-semibold">family level</span>. The family&apos;s mechanism (disruption → reset → rapid re-engagement), core metric (Recovery Time), and score architecture are <span className="text-white font-semibold">fixed</span>. Variants inherit all of these and vary the disruption channel, sport context, duration, or delivery surface.
                    </p>
                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">Registered Variants</p>
                    <div className="space-y-1.5">
                        {VARIANTS.map((v) => (
                            <div key={v.name} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-black/20 px-3 py-2">
                                <div className={`w-1.5 h-8 rounded-full flex-shrink-0 mt-0.5 ${v.status === 'Planned' ? 'bg-zinc-600' : 'bg-green-500/60'}`} />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-semibold text-white">{v.name}</p>
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded border ${v.status === 'Planned' ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>{v.status}</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">{v.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-lg border border-zinc-700 bg-black/30 px-3 py-2">
                        <p className="text-[10px] text-zinc-500">New variants can be added without taxonomy changes. If any variant produces divergent performance patterns (per the Promotion Protocol), it will be flagged for evaluation.</p>
                    </div>
                </div>
            </section>

            {/* TRIAL LAYER CONNECTION */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-cyan-400" /> Trial Layer Connection
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                            <p className="text-xs font-bold text-cyan-400 mb-1">Extended Trial Reset</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">Standardized, non-adaptive, 10–15 min at fixed Tier 3. Identical conditions per Standards Addendum §6. Used for Baseline, Post-Training, and Retention assessments.</p>
                        </div>
                        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                            <p className="text-xs font-bold text-purple-400 mb-1">Reset Chamber (Vision Pro)</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">Immersive Transfer Trial. Spatial audio, environmental disruptions, immersive visual fields. Tests whether trained recovery holds up in more realistic environments.</p>
                        </div>
                    </div>
                    <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
                        <p className="text-xs font-semibold text-white mb-1">Transfer Gap</p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                            The difference between Recovery Time in daily training (adaptive, phone/web) and Recovery Time in the Trial variant (standardized, higher fidelity). <span className="text-green-400">Small gap</span> = internalized skill. <span className="text-red-400">Large gap</span> = improvement in drill, not yet stabilized under realistic conditions.
                        </p>
                    </div>
                </div>
            </section>

            {/* EVIDENCE STATUS */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-400" /> Evidence Status and Validation Roadmap
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    {/* Current stage */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4].map((stage) => (
                                <div
                                    key={stage}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border"
                                    style={{
                                        background: stage === 1 ? '#22c55e15' : '#00000020',
                                        borderColor: stage === 1 ? '#22c55e30' : '#27272a',
                                        color: stage === 1 ? '#22c55e' : '#52525b',
                                    }}
                                >
                                    {stage}
                                </div>
                            ))}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-green-400">Stage 1: Mechanism Support</p>
                            <p className="text-[10px] text-zinc-500">Peer-reviewed evidence supports targeted cognitive mechanism.</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
                        <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-1">Next Milestone</p>
                        <p className="text-[10px] text-zinc-400">Stage 2: Internal Reliability — demonstrate test-retest ICC ≥ 0.70 across athlete populations.</p>
                    </div>

                    <div className="space-y-1">
                        {[
                            { stage: 'Stage 2', req: 'Test-retest ICC ≥ 0.70' },
                            { stage: 'Stage 3', req: 'Correlation with established attentional control measures' },
                            { stage: 'Stage 4', req: 'Demonstrated transfer to higher-fidelity conditions' },
                        ].map((s) => (
                            <div key={s.stage} className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                <p className="text-[10px] text-zinc-500"><span className="text-zinc-400 font-semibold">{s.stage}:</span> {s.req}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FEEDBACK MODE */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-400" /> Feedback Mode Behavior
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#090f1c] border border-blue-500/20 rounded-2xl p-4 space-y-2">
                        <p className="text-xs font-bold text-blue-400">Training Mode</p>
                        <div className="space-y-1">
                            {[
                                'Round-by-round Recovery Time shown between rounds',
                                'Compared to personal average',
                                'Summary data + trend lines at session end',
                                'Adaptive difficulty active',
                            ].map((item) => (
                                <div key={item} className="flex items-start gap-1.5">
                                    <CheckCircle2 className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-zinc-400">{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-[#090f1c] border border-purple-500/20 rounded-2xl p-4 space-y-2">
                        <p className="text-xs font-bold text-purple-400">Trial Mode</p>
                        <div className="space-y-1">
                            {[
                                'No intra-session feedback',
                                'Full session completed without scores or comparisons',
                                'Results shown only at session end',
                                'Fixed difficulty at standardized Trial level',
                            ].map((item) => (
                                <div key={item} className="flex items-start gap-1.5">
                                    <CheckCircle2 className="w-3 h-3 text-purple-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-zinc-400">{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* MOTOR AND DEVICE */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-amber-400" /> Motor and Device Considerations
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Measures <span className="text-white font-semibold">cognitive-perceptual skill</span>, not motor speed. Physical responses (tapping, swiping) kept as simple as possible. Per Standards Addendum §7: motor baseline captured at session start, device type and input method logged for every session and treated as covariates in research.
                    </p>
                </div>
            </section>

            {/* EXPERIENCE DESIGN */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Palette className="w-4 h-4 text-pink-400" /> Experience Design Principles
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {EXPERIENCE_PRINCIPLES.map((ep) => (
                        <div key={ep.title} className="bg-[#090f1c] border border-zinc-800 rounded-xl px-4 py-3 space-y-1">
                            <p className="text-xs font-bold text-white">{ep.title}</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">{ep.detail}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* GOVERNING DOCUMENTS */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" /> Governing Documents
                </h3>
                <div className="space-y-2">
                    {GOVERNING_DOCS.map((gd) => (
                        <div key={gd.name} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-[#090f1c] px-4 py-3">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-semibold text-white">{gd.name}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">{gd.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* RESEARCH REFERENCES */}
            <section className="space-y-4 pb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-zinc-400" /> Research References
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5">
                    <div className="space-y-1.5">
                        {REFERENCES.map((ref) => (
                            <div key={ref.id} className="flex items-start gap-2">
                                <span className="text-[9px] font-mono text-zinc-600 flex-shrink-0 mt-0.5">[{ref.id}]</span>
                                <p className="text-[10px] text-zinc-500 leading-relaxed">{ref.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default KillSwitchSpecTab;
