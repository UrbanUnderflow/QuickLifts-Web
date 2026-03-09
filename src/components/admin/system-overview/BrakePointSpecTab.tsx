import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    StopCircle,
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

const ACCENT = '#ef4444'; // red — stop signal

const GAME_PHASES = [
    {
        phase: '1',
        name: 'Go Stream',
        color: '#60a5fa',
        duration: '30–50 trials',
        description: 'Rapid stream of Go stimuli requiring fast responses. The stream establishes a rhythm of momentum.',
        tiers: [
            'Beginner: Single target type, fixed location, consistent rhythm',
            'Intermediate: Multiple target types, varied locations, slightly irregular rhythm',
            'Advanced: Subtle visual differences, unpredictable timing, multiple valid responses',
        ],
    },
    {
        phase: '2',
        name: 'Stop Signal',
        color: '#ef4444',
        duration: 'Unpredictable',
        description: 'At unpredictable intervals, a No-Go stimulus appears. The athlete must cancel the response.',
        tiers: [
            'Obvious No-Go: Clearly different. Tests basic stop ability.',
            'Fakeout No-Go: Visually similar with one subtle differentiator. Tests discrimination under speed.',
            'Late-reveal No-Go: Initially identical to Go, then changes. Tests cancellation of in-flight response.',
        ],
    },
    {
        phase: '3',
        name: 'Score Capture',
        color: '#22c55e',
        duration: 'Per trial',
        description: 'Each trial scored: correct Go, correct Stop, false alarm, or miss. Core metric: Stop Latency.',
        tiers: [
            'Stop Latency derived from stop-signal paradigm distribution',
            'False alarms classified by No-Go type (obvious, fakeout, late-reveal)',
            'Over-inhibition (Go misses) tracked separately',
            'Session: 2–4 minutes, 30–50 trials',
        ],
    },
];

const SCIENTIFIC_FOUNDATIONS = [
    {
        name: 'Executive Function: Inhibition',
        authors: 'Miyake et al., 2000',
        summary: 'Response inhibition — suppressing a prepotent or already-initiated response — is a separable core executive function. The go/no-go and stop-signal paradigms are the direct ancestors of Brake Point.',
    },
    {
        name: 'Attentional Control Theory',
        authors: 'Eysenck et al., 2007',
        summary: 'Anxiety specifically impairs inhibitory control. The skill Brake Point trains is exactly what degrades most under competition pressure.',
    },
    {
        name: 'Stress Inoculation Training',
        authors: 'Meichenbaum, 1985',
        summary: 'Graduated exposure to conditions challenging inhibitory control builds tolerance over time.',
    },
    {
        name: 'Speed-Accuracy Tradeoff',
        authors: 'Sport cognition literature',
        summary: 'Brake Point trains the athlete to push deeper into the speed curve while maintaining inhibitory control — shifting the tradeoff function, not choosing a point on it.',
    },
];

const SKILL_SCORES = [
    { skill: 'Inhibitory Control', pillar: 'Decision', description: 'Core skill score. Derived from Stop Latency and false alarm rate. Lower latency with lower false alarm rate = stronger inhibitory control.', color: ACCENT },
    { skill: 'Speed-Accuracy Balance', pillar: 'Decision', description: 'Combined metric of Go reaction time and false alarm rate. Rewards controlled speed, not cautious slowness.', color: '#f97316' },
    { skill: 'Pressure Stability', pillar: 'Composure', description: 'Stop Latency consistency under evaluative threat and consequence modifiers vs. baseline. Per Standards Addendum §9.', color: '#c084fc' },
];

const RAW_METRICS = [
    { metric: 'Stop Latency', description: 'Estimated minimum time needed to cancel an initiated response. Core metric. Derived from stop-signal paradigm distribution.', primary: true },
    { metric: 'False Alarm Rate', description: 'Responses executed on No-Go trials. Classified by No-Go type (obvious, fakeout, late-reveal).' },
    { metric: 'Go Reaction Time', description: 'Mean correct Go response time. Feeds speed-accuracy balance.' },
    { metric: 'Go Miss Rate', description: 'Failure to respond to valid Go targets. High miss + low false alarm = over-inhibition signal.' },
    { metric: 'Per-Type False Alarm', description: 'False alarm rate broken down by obvious, fakeout, late-reveal No-Go types. Required output.' },
    { metric: 'Over-Inhibition Index', description: 'Combined Go miss + excessively slow RT signal. Flags athletes solving inhibition by slowing down.' },
    { metric: 'Modifier Condition Tag', description: 'Which modifiers were active, enabling pressure-stratified analysis.' },
];

const CROSSCUTTING_CONTRIBUTIONS = [
    { modifier: 'Readiness', contribution: 'Session-opening Stop Latency vs. rolling baseline. Faster opening = higher readiness signal.' },
    { modifier: 'Consistency', contribution: 'Stop Latency variance within session. Low variance = high consistency score.' },
    { modifier: 'Fatigability', contribution: 'Stop Latency degradation from early to late trials within a session.' },
    { modifier: 'Pressure Sensitivity', contribution: 'Stop Latency gap under neutral vs. pressure modifier conditions.' },
];

const MODIFIER_COMPAT = [
    { modifier: 'Distraction', behavior: 'Adds visual noise around No-Go stimuli, making them harder to identify.', levels: 'Low / Medium / High' },
    { modifier: 'Time Pressure', behavior: 'Shrinks the response window for Go trials, increasing go-stream momentum.', levels: 'Standard / Tight / Extreme' },
    { modifier: 'Evaluative Threat', behavior: 'Stakes messaging (coach watching, recorded). Social pressure on inhibition.', levels: 'Subtle / Moderate / Direct' },
    { modifier: 'Consequence', behavior: 'Failed stops cost something (lose streak, drop score). Raises emotional stakes.', levels: 'Low / Medium / High' },
    { modifier: 'Ambiguity', behavior: 'No-Go timing and type harder to predict. Reduces ability to pre-load stop response.', levels: 'Slight / Moderate / Full' },
    { modifier: 'Fatigue Load', behavior: 'Longer sessions or faster pace to measure inhibitory degradation under fatigue.', levels: 'Standard / Elevated / Extended' },
];

const DIFFICULTY_TIERS = [
    { tier: 1, name: 'Foundation', color: '#94a3b8', target: 'FAR < 20%', goSpeed: 'Moderate', noGo: 'Obvious', modifiers: 'None' },
    { tier: 2, name: 'Sharpening', color: '#60a5fa', target: 'FAR < 12%, SL < 250ms', goSpeed: 'Faster', noGo: 'Fakeout', modifiers: 'Ambiguity' },
    { tier: 3, name: 'Pressure', color: '#c084fc', target: 'FAR < 8%, SL < 200ms', goSpeed: 'Near-max', noGo: 'Late-reveal', modifiers: 'All pressure modifiers' },
    { tier: 4, name: 'Elite', color: '#22c55e', target: 'FAR < 5%, SL < 175ms', goSpeed: 'Maximum', noGo: 'All types at max similarity', modifiers: 'All at high intensity' },
];

const VARIANTS = [
    { name: 'Standard Go/No-Go', description: 'Simple visual targets. Default Tier 1–2.', status: 'Registered' },
    { name: 'Fakeout Series', description: 'Near-identical No-Go stimuli. Discrimination under speed variant.', status: 'Registered' },
    { name: 'Sport-Context Brake', description: 'Sport-specific stimuli (ball trajectory, player movement cues). Applied variant.', status: 'Registered' },
    { name: 'Extended Trial Brake Point', description: 'Standardized 8–12 min at fixed Tier 3, 150–200 trials. Trial-layer assessment.', status: 'Registered' },
    { name: 'Immersive Spatial Brake (Vision Pro)', description: '3D spatial stimuli. Immersive Transfer Trial.', status: 'Planned' },
];

const MEASUREMENT_RULES = [
    { rule: 'Valid Go response', detail: 'Correct response to a Go stimulus within the response window and above 150ms reaction time. Responses below 150ms are motor artifacts.' },
    { rule: 'Stop Latency estimation', detail: 'Derived from stop-signal paradigm: estimated minimum time to cancel an initiated response. Calculated from the distribution of Go RTs and the probability of successful stops at different stop-signal delays.' },
    { rule: 'False alarm definition', detail: 'Response executed on a No-Go trial. Classified by No-Go type (obvious, fakeout, late-reveal) for per-type analysis.' },
    { rule: 'Over-inhibition detection', detail: 'Go misses tracked separately. High miss + low false alarm = over-inhibition: athlete solving inhibition by slowing down, not improving control.' },
    { rule: 'Minimum reaction time', detail: '150ms floor. Responses below are motor artifacts. Per Standards Addendum §2.1.' },
];

const EXPERIENCE_PRINCIPLES = [
    { title: 'Feel like training, not therapy', detail: 'The sim should feel like a drill. The athlete should want to beat their last score. Competitive energy is the engine.' },
    { title: 'Speed is the engine, not the enemy', detail: 'Brake Point should feel fast. The sim rewards controlled speed, not cautious slowness.' },
    { title: 'Minimal UI during gameplay', detail: 'Clean, immersive screen. No navigation, no settings. The sim owns the screen.' },
    { title: 'Data after, not during', detail: 'Performance shown between rounds (Training) or only at session end (Trial).' },
    { title: 'Sound design matters', detail: 'Audio cues, ambient sound, feedback tones support immersion and signal state changes clearly.' },
    { title: 'Celebrate improvement, not perfection', detail: 'Highlight personal bests and trend improvements, not absolute scores. Progress is the reward.' },
];

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

const GOVERNING_DOCS = [
    { name: 'Sim Specification Standards Addendum (v2)', description: 'Shared measurement precision, session validity, modifier boundaries, feedback modes, trial standardization, motor confounds, validation roadmap, skill-score sourcing.' },
    { name: 'Pulse Check System Taxonomy (v3)', description: 'Three pillars, skill map, cross-cutting modifiers, score architecture, evidence framework, AI adaptation, session length, trial architecture.' },
    { name: 'Sim Family Promotion Protocol (v2)', description: 'How families are proposed, evaluated, promoted. Variant classification, divergence detection, adaptive threshold governance.' },
    { name: 'Sim Family Tree (v2)', description: 'Complete family, candidate, variant, and exploratory hierarchy for all Pulse Check simulations.' },
];

const BrakePointSpecTab: React.FC = () => {
    return (
        <div className="space-y-10">
            {/* HEADER */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl" style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}>
                        <StopCircle className="w-5 h-5" style={{ color: ACCENT }} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: ACCENT }}>PULSE CHECK · SIM SPECIFICATION</p>
                        <h2 className="text-xl font-semibold">Brake Point</h2>
                        <p className="text-xs text-zinc-500">Response Inhibition Training Simulation · Spec v2.0 · March 2025</p>
                    </div>
                </div>
            </div>

            {/* CONCEPT */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4" style={{ color: ACCENT }} /> Concept
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Brake Point trains the athlete&apos;s ability to <span className="text-white font-semibold">cancel a wrong action before it executes</span>. In sport, this is the defender who holds position on the fake, the goalkeeper who reads the feint, the hitter who checks the swing. The ability to initiate a response and then stop it when new information arrives is a measurable, trainable executive function that degrades under pressure and speed.
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
                <p className="text-sm text-zinc-400">Rapid rounds, 30–50 trials per session, 2–4 minutes. The pace is fast by design.</p>
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                    {GAME_PHASES.map((gp, i) => (
                        <React.Fragment key={gp.phase}>
                            <div className="flex-shrink-0 rounded-xl border px-4 py-2.5 min-w-[160px]" style={{ borderColor: gp.color + '30', background: gp.color + '08' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: gp.color + '20', color: gp.color }}>{gp.phase}</div>
                                    <p className="text-xs font-bold" style={{ color: gp.color }}>{gp.name}</p>
                                </div>
                                <p className="text-[9px] text-zinc-500">{gp.duration}</p>
                            </div>
                            {i < GAME_PHASES.length - 1 && <span className="text-zinc-600 flex-shrink-0 text-lg">→</span>}
                        </React.Fragment>
                    ))}
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
                        Governed by the <span className="font-semibold">Sim Specification Standards Addendum</span>. When any rule conflicts with the Addendum, the Addendum governs.
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
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-2">Layer 1 — Pillar Composite Contribution</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                        Feeds primarily into the <span className="text-amber-400 font-semibold">Decision</span> pillar, with secondary contribution to <span className="text-green-400 font-semibold">Composure</span>.
                    </p>
                </div>
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
                <CollapsibleSection title="Layer 3 — Raw Performance Metrics">
                    <div className="space-y-1.5">
                        {RAW_METRICS.map((rm) => (
                            <div key={rm.metric} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-black/20 px-3 py-2">
                                <div className="w-1.5 h-6 rounded-full flex-shrink-0 mt-0.5" style={{ background: rm.primary ? ACCENT : '#52525b' }} />
                                <div>
                                    <p className="text-xs font-semibold" style={{ color: rm.primary ? ACCENT : '#fff' }}>{rm.metric}</p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">{rm.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>
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
                <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-1">Longitudinal Tracking</p>
                    <p className="text-[10px] text-zinc-400">Stop Latency and False Alarm Rate trend lines. Ideal: declining Stop Latency with stable or declining False Alarm Rate.</p>
                </div>
            </section>

            {/* MODIFIER COMPATIBILITY */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" /> Modifier Compatibility Matrix
                </h3>
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
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">Go Speed</p>
                                    <p className="text-[10px] text-zinc-400">{dt.goSpeed}</p>
                                </div>
                                <div className="rounded-lg border border-zinc-800 bg-black/20 p-2">
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">No-Go Type</p>
                                    <p className="text-[10px] text-zinc-400">{dt.noGo}</p>
                                </div>
                                <div className="rounded-lg border border-zinc-800 bg-black/20 p-2">
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">Modifiers</p>
                                    <p className="text-[10px] text-zinc-400">{dt.modifiers}</p>
                                </div>
                                <div className="rounded-lg border border-zinc-800 bg-black/20 p-2">
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">Target</p>
                                    <p className="text-[10px] font-mono" style={{ color: dt.color }}>{dt.target}</p>
                                </div>
                            </div>
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
                        Family-level spec. Mechanism (stop the wrong action), core metric (Stop Latency), and score architecture are <span className="text-white font-semibold">fixed</span>. Divergent patterns trigger Nora&apos;s evaluation per the Promotion Protocol.
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
                </div>
            </section>

            {/* TRIAL LAYER */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-cyan-400" /> Trial Layer Connection
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                            <p className="text-xs font-bold text-cyan-400 mb-1">Extended Trial Brake Point</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">Standardized at Tier 3, 8–12 minutes, 150–200 trials. Per Standards Addendum §6.</p>
                        </div>
                        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                            <p className="text-xs font-bold text-purple-400 mb-1">Immersive Spatial Brake (Vision Pro)</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">3D spatial stimuli for immersive transfer testing. Tests whether stop control holds in richer environments.</p>
                        </div>
                    </div>
                    <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
                        <p className="text-xs font-semibold text-white mb-1">Transfer Gap</p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                            Difference between Stop Latency in daily training and in the Trial variant. <span className="text-green-400">Small gap</span> = internalized skill. <span className="text-red-400">Large gap</span> = improved in drill, not yet stable under realistic conditions.
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
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4].map((stage) => (
                                <div key={stage} className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border"
                                    style={{ background: stage === 1 ? '#22c55e15' : '#00000020', borderColor: stage === 1 ? '#22c55e30' : '#27272a', color: stage === 1 ? '#22c55e' : '#52525b' }}>
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
                            {['Round-by-round Stop Latency shown between rounds', 'Compared to personal average', 'Summary data + trend lines at session end', 'Adaptive difficulty active'].map((item) => (
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
                            {['No intra-session feedback', 'Full session without scores or comparisons', 'Results shown only at session end', 'Fixed difficulty at standardized Trial level'].map((item) => (
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
                        Measures <span className="text-white font-semibold">cognitive-perceptual skill</span>, not motor speed. Physical responses kept simple. Per Standards Addendum §7: motor baseline captured at session start, device type and input method logged as covariates.
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

export default BrakePointSpecTab;
