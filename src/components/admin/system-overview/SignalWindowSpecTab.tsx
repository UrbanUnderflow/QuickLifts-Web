import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ScanSearch,
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

const ACCENT = '#facc15'; // yellow — decision window

const GAME_PHASES = [
    {
        phase: '1',
        name: 'Display',
        color: '#facc15',
        duration: '0.5–3 sec',
        description: 'Information-rich display with correct cue embedded among neutral or decoy information. Duration is limited.',
        tiers: [
            'Beginner: Simple display, 2–3 second window',
            'Intermediate: Complex display with decoys, 1–2 second window',
            'Advanced: Dense display with ambiguous information, 0.5–1.5 second window',
        ],
    },
    {
        phase: '2',
        name: 'Commit',
        color: '#f97316',
        duration: 'First response',
        description: 'Athlete commits to their read by selecting the correct response. First commitment is final. System captures accuracy and latency.',
        tiers: [
            'One response accepted per trial — first commitment final',
            'Decoy susceptibility logged: plausible-wrong vs. random miss',
            'Window utilization: how much of available time was used before committing',
        ],
    },
    {
        phase: '3',
        name: 'Feedback',
        color: '#22c55e',
        duration: 'Brief',
        description: 'After each trial: correct/incorrect, decision latency, comparison to rolling average. Brief, then next trial.',
        tiers: [
            'Session: 15–25 trials, 3–5 minutes',
            'Training Mode: feedback shown after each trial',
            'Trial Mode: no intra-session feedback shown',
        ],
    },
];

const SCIENTIFIC_FOUNDATIONS = [
    {
        name: 'Perceptual-Cognitive Expertise',
        authors: 'Sport cognition research',
        summary: 'Expert performers extract relevant cues faster and more accurately than novices. Signal Window trains the perceptual-cognitive skills that distinguish expert from novice decision-making under time constraint.',
    },
    {
        name: 'Attentional Control Theory',
        authors: 'Eysenck et al., 2007',
        summary: 'Anxiety slows cue extraction. Signal Window trains the system to maintain decision quality as available processing time shrinks.',
    },
    {
        name: 'Attentional Width and Direction',
        authors: 'Nideffer & Sagal, 2006',
        summary: 'Signal Window exercises external-narrow focus for rapid cue identification and broad-to-narrow transitions for complex display scanning.',
    },
    {
        name: 'Stress Inoculation Training',
        authors: 'Meichenbaum, 1985',
        summary: 'Graduated exposure to time-compressed scenarios builds tolerance for shrinking decision windows.',
    },
];

const SKILL_SCORES = [
    { skill: 'Correct Read Under Time Pressure', pillar: 'Decision', description: 'Combined metric of correct-read rate weighted by decision latency. Core skill score. Both components reported separately and as combined score.', color: ACCENT },
    { skill: 'Decoy Resistance', pillar: 'Decision', description: 'Inverse of decoy false alarm rate. How well the athlete avoids plausible-but-wrong cues. Distinguishes discrimination errors from random misses.', color: '#f97316' },
    { skill: 'Pressure Stability', pillar: 'Composure', description: 'Decision accuracy consistency under evaluative threat and consequence modifiers vs. baseline. Per Standards Addendum §9.', color: '#c084fc' },
];

const RAW_METRICS = [
    { metric: 'Correct Read Under Time Pressure', description: 'Combined accuracy + latency metric. Core metric. Reported as combined score and separately.', primary: true },
    { metric: 'Decision Latency', description: 'Time from display onset to first committed response.' },
    { metric: 'Correct Read Rate', description: 'Percentage of trials with correct target identification.' },
    { metric: 'Decoy Susceptibility', description: 'Errors classified as decoy selections (plausible-wrong) vs. neutral misses. Required classification.' },
    { metric: 'Window Utilization', description: 'How much of available display time athlete uses before committing. Required output for decision strategy analysis.' },
    { metric: 'Per-Difficulty Accuracy', description: 'Accuracy broken down by display density and window length for tier-level analysis.' },
    { metric: 'Modifier Condition Tag', description: 'Which modifiers were active, enabling pressure-stratified analysis.' },
];

const CROSSCUTTING_CONTRIBUTIONS = [
    { modifier: 'Readiness', contribution: 'Session-opening decision accuracy vs. rolling baseline. Higher opening accuracy = higher readiness.' },
    { modifier: 'Consistency', contribution: 'Decision accuracy variance within session. Low variance = high consistency score.' },
    { modifier: 'Fatigability', contribution: 'Decision accuracy degradation from early to late trials within a session.' },
    { modifier: 'Pressure Sensitivity', contribution: 'Accuracy gap between neutral and evaluative pressure modifier conditions.' },
];

const MODIFIER_COMPAT = [
    { modifier: 'Distraction', behavior: 'Adds irrelevant visual elements to the display, increasing noise-to-signal ratio.', levels: 'Low / Medium / High' },
    { modifier: 'Time Pressure', behavior: 'Shrinks the display window further, reducing available cue extraction time.', levels: 'Standard / Tight / Extreme' },
    { modifier: 'Evaluative Threat', behavior: 'Stakes messaging during decision window. Social pressure on accuracy under time constraint.', levels: 'Subtle / Moderate / Direct' },
    { modifier: 'Consequence', behavior: 'Wrong reads cost something. Raises emotional stakes of each commitment.', levels: 'Low / Medium / High' },
    { modifier: 'Ambiguity', behavior: 'Display content and cue salience more ambiguous. Reduces certainty before window closes.', levels: 'Slight / Moderate / Full' },
    { modifier: 'Fatigue Load', behavior: 'Longer sessions to measure decision quality degradation under cognitive fatigue.', levels: 'Standard / Elevated / Extended' },
];

const DIFFICULTY_TIERS = [
    { tier: 1, name: 'Foundation', color: '#94a3b8', target: '80%+ Read Rate', display: 'Simple displays', window: '2–3 sec', modifiers: 'None' },
    { tier: 2, name: 'Sharpening', color: '#60a5fa', target: '75%+, < 1.5s latency', display: 'Complex with decoys', window: '1–2 sec', modifiers: 'Distraction + Time Pressure' },
    { tier: 3, name: 'Pressure', color: '#c084fc', target: '70%+, < 1s latency', display: 'Dense, ambiguous', window: '0.5–1.5 sec', modifiers: 'Evaluative Threat + Ambiguity + Consequence' },
    { tier: 4, name: 'Elite', color: '#22c55e', target: '65%+, < 800ms latency', display: 'Maximum complexity', window: 'Sub-second', modifiers: 'All at high intensity' },
];

const VARIANTS = [
    { name: 'Static display', description: 'Fixed information field. Default Tier 1–2.', status: 'Registered' },
    { name: 'Dynamic display', description: 'Moving or time-evolving cues. Intermediate variant.', status: 'Registered' },
    { name: 'Sport-context cue read', description: 'Sport-specific displays (formation reads, ball-flight cues). Applied variant.', status: 'Registered' },
    { name: 'Field-Read Trial Signal Window', description: 'Standardized 10–15 min at fixed Tier 3. Trial-layer assessment.', status: 'Registered' },
    { name: '3D Spatial Read (Vision Pro)', description: 'Cues in spatial 3D environment. Immersive Transfer Trial.', status: 'Planned' },
];

const MEASUREMENT_RULES = [
    { rule: 'Valid response definition', detail: 'First committed response after display onset, above 150ms reaction time. Only one response per trial — first commitment final.' },
    { rule: 'Correct Read calculation', detail: 'Combined metric of correct-read percentage weighted by decision latency. Both components reported separately and as combined score.' },
    { rule: 'Decoy susceptibility classification', detail: 'Errors classified by decoy selection (plausible-wrong) vs. neutral element (random miss). Required classification, not optional.' },
    { rule: 'Window utilization tracking', detail: 'How much of available display window used before committing. Required output for decision strategy analysis.' },
    { rule: 'Minimum reaction time', detail: '150ms floor. Responses below are motor artifacts. Per Standards Addendum §2.1.' },
];

const EXPERIENCE_PRINCIPLES = [
    { title: 'Feel like training, not therapy', detail: 'The sim should feel like a drill. The athlete should want to beat their last score. Competitive energy is the engine.' },
    { title: 'Minimal UI during gameplay', detail: 'Clean, immersive screen. No navigation, no settings. The sim owns the screen during the display window.' },
    { title: 'Data after, not during', detail: 'Performance shown between rounds (Training) or only at session end (Trial).' },
    { title: 'Sound design matters', detail: 'Audio cues signal display onset and commitment windows clearly.' },
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

const SignalWindowSpecTab: React.FC = () => {
    return (
        <div className="space-y-10">
            {/* HEADER */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl" style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}35` }}>
                        <ScanSearch className="w-5 h-5" style={{ color: ACCENT }} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: ACCENT }}>PULSE CHECK · SIM SPECIFICATION</p>
                        <h2 className="text-xl font-semibold">Signal Window</h2>
                        <p className="text-xs text-zinc-500">Cue Discrimination Training Simulation · Spec v2.0 · March 2025</p>
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
                        Signal Window trains the athlete&apos;s ability to <span className="text-white font-semibold">read the right cue and make the correct decision within a shrinking time window</span>. In every sport, critical decisions happen in compressed moments. Signal Window simulates that compression, presents information-rich displays, gives the athlete a limited window to identify the correct read, and measures both accuracy and speed.
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
                <p className="text-sm text-zinc-400">Rapid-fire rounds. 15–25 trials per session, 3–5 minutes.</p>
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
                    <span className="text-zinc-600 flex-shrink-0 text-lg">↻</span>
                </div>
                {GAME_PHASES.map((gp) => (
                    <CollapsibleSection key={gp.phase} title={`Phase ${gp.phase}: ${gp.name}`} defaultOpen={gp.phase === '2'}>
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
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-2">Layer 1 — Pillar Composite Contribution</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                        Feeds primarily into the <span className="text-amber-400 font-semibold">Decision</span> pillar, with secondary contribution to <span className="text-sky-400 font-semibold">Focus</span>.
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
                    <p className="text-[10px] text-zinc-400">Correct Read Rate and Decision Latency trend lines. Ideal: improving accuracy with stable or improving speed.</p>
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
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">Display</p>
                                    <p className="text-[10px] text-zinc-400">{dt.display}</p>
                                </div>
                                <div className="rounded-lg border border-zinc-800 bg-black/20 p-2">
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">Window</p>
                                    <p className="text-[10px] text-zinc-400">{dt.window}</p>
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
                        Family-level spec. Mechanism (cue discrimination under time pressure), core metric (Correct Read Under Time Pressure), and score architecture are <span className="text-white font-semibold">fixed</span>.
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
                            <p className="text-xs font-bold text-cyan-400 mb-1">Field-Read Trial Signal Window</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">Standardized at Tier 3, 10–15 minutes. Per Standards Addendum §6.</p>
                        </div>
                        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                            <p className="text-xs font-bold text-purple-400 mb-1">3D Spatial Read (Vision Pro)</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">Cues in spatial 3D environment. Immersive Transfer Trial — tests read accuracy in richer perceptual context.</p>
                        </div>
                    </div>
                    <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
                        <p className="text-xs font-semibold text-white mb-1">Transfer Gap</p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                            Difference between Correct Read Under Time Pressure in daily training and in the Trial variant. <span className="text-green-400">Small gap</span> = internalized skill. <span className="text-red-400">Large gap</span> = improved in drill, not yet stable under realistic conditions.
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
                            {['Correct Read Rate shown after each trial', 'Compared to personal average', 'Summary data + trend lines at session end', 'Adaptive difficulty active'].map((item) => (
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

export default SignalWindowSpecTab;
