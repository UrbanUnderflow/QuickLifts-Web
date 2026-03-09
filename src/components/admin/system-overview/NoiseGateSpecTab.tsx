import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Volume2,
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

const ACCENT = '#38bdf8'; // sky blue

const GAME_PHASES = [
    {
        phase: '1',
        name: 'Signal Lock',
        color: '#60a5fa',
        duration: '5–10 sec',
        description: 'Clean primary task stream establishes baseline accuracy and response rhythm.',
        tiers: [
            'Beginner: Respond to a single target type in a fixed location',
            'Intermediate: Track a primary target that moves across the screen',
            'Advanced: Multi-step response pattern while the primary stream varies in timing and location',
        ],
    },
    {
        phase: '2',
        name: 'Noise Injection',
        color: '#f59e0b',
        duration: 'Sustained',
        description: 'Salient but task-irrelevant distractors are introduced. Athlete must continue responding to the primary stream.',
        tiers: [
            'Visual: Peripheral movement, color flashes, decoy targets',
            'Audio: Crowd noise, commentary, off-rhythm sounds',
            'Mixed-channel: Visual and audio simultaneously',
            'Baited (advanced): Distractors that closely resemble the real target',
        ],
    },
    {
        phase: '3',
        name: 'Score Capture',
        color: '#38bdf8',
        duration: 'Per round',
        description: 'Accuracy and RT during noise phase compared against clean baseline. Distractor Cost = the difference.',
        tiers: [
            'Distractor Cost = baseline accuracy − noise-phase accuracy (%)',
            'Response time shift also captured and reported',
            'Channel Vulnerability broken down by distractor type',
            'Training Mode: athlete sees cost + trend after each round',
        ],
    },
];

const SCIENTIFIC_FOUNDATIONS = [
    {
        name: 'Attentional Control Theory',
        authors: 'Eysenck et al., 2007',
        summary: 'Anxiety shifts processing toward stimulus-driven capture. Noise Gate trains goal-directed attention to maintain priority over irrelevant stimuli — directly targeting the inhibition function ACT identifies.',
    },
    {
        name: 'Attentional Networks',
        authors: 'Posner & Petersen, 1990',
        summary: 'The executive attention network resolves conflict between competing stimuli. Noise Gate loads this network by presenting simultaneous relevant and irrelevant information streams.',
    },
    {
        name: 'Executive Function: Inhibition',
        authors: 'Miyake et al., 2000',
        summary: 'Inhibition is a separable executive function. Noise Gate isolates it by requiring suppression of task-irrelevant distractors while maintaining primary task performance.',
    },
    {
        name: 'Distraction Drills',
        authors: 'Nideffer & Sagal, 2006; APA Division 47',
        summary: 'Applied sport psychology recommends deliberate distraction exposure as a training method. Noise Gate is the structured, measurable, repeatable version.',
    },
];

const SKILL_SCORES = [
    { skill: 'Distractor Filtering', pillar: 'Focus', description: 'Accuracy maintained during noise phases vs. clean baseline. Primary skill score for Noise Gate. Lower Distractor Cost = stronger filter.', color: ACCENT },
    { skill: 'Interference Control', pillar: 'Focus', description: 'Inverse of false alarm rate. How often the athlete responds to distractors rather than the primary target. Feeds per-channel vulnerability breakdown.', color: '#60a5fa' },
    { skill: 'Pressure Stability', pillar: 'Composure', description: 'Distractor Cost under evaluative threat and consequence modifiers vs. baseline. Stratified by modifier condition per Standards Addendum §9.', color: '#c084fc' },
];

const RAW_METRICS = [
    { metric: 'Distractor Cost', description: 'Baseline accuracy − noise-phase accuracy (%), combined with RT shift. Headline metric.', primary: true },
    { metric: 'False Alarm Rate', description: 'Responses directed at distractors rather than the primary target. Logged per distractor channel.' },
    { metric: 'Baseline Accuracy', description: 'Accuracy during the clean signal phase, establishing the per-round reference.' },
    { metric: 'Noise-Phase Accuracy', description: 'Accuracy during the distractor injection phase.' },
    { metric: 'RT Shift', description: 'Noise-phase response time minus baseline RT, in milliseconds.' },
    { metric: 'Channel Vulnerability', description: 'Distractor Cost broken down by distractor type — visual, audio, mixed, baited. Required output.' },
    { metric: 'Modifier Condition Tag', description: 'Which modifiers were active, enabling pressure-stratified analysis.' },
];

const CROSSCUTTING_CONTRIBUTIONS = [
    { modifier: 'Readiness', contribution: 'Session-opening Distractor Cost vs. rolling baseline. Lower opening cost = higher readiness.' },
    { modifier: 'Consistency', contribution: 'Distractor Cost variance within session. Low variance = high consistency score.' },
    { modifier: 'Fatigability', contribution: 'Distractor Cost increase from early to late rounds within a session.' },
    { modifier: 'Pressure Sensitivity', contribution: 'Gap between cost under neutral vs. pressure modifier conditions.' },
];

const MODIFIER_COMPAT = [
    { modifier: 'Distraction', behavior: 'Increases visual/audio distractor density and salience beyond the standard noise injection.', levels: 'Low / Medium / High' },
    { modifier: 'Time Pressure', behavior: 'Shorter response windows for the primary task, increasing urgency.', levels: 'Standard / Tight / Extreme' },
    { modifier: 'Evaluative Threat', behavior: 'Stakes messaging during noise phases. Raises social pressure.', levels: 'Subtle / Moderate / Direct' },
    { modifier: 'Consequence', behavior: 'Failed filtering costs something. Raises emotional stakes.', levels: 'Low / Medium / High' },
    { modifier: 'Ambiguity', behavior: 'Noise injection timing unpredictable; channel type not signaled in advance.', levels: 'Slight / Moderate / Full' },
    { modifier: 'Fatigue Load', behavior: 'Longer sessions or higher cognitive load to measure fatigue-driven filter degradation.', levels: 'Standard / Elevated / Extended' },
];

const DIFFICULTY_TIERS = [
    { tier: 1, name: 'Foundation', color: '#94a3b8', target: '< 15% Cost', task: 'Single target, fixed location', distractors: 'Single-channel visual', modifiers: 'None' },
    { tier: 2, name: 'Sharpening', color: '#60a5fa', target: '< 10% Cost', task: 'Tracking-based primary task', distractors: 'Multi-channel', modifiers: 'Distraction + Time Pressure' },
    { tier: 3, name: 'Pressure', color: '#c084fc', target: '< 7% Cost', task: 'Pattern-based task', distractors: 'Baited distractors', modifiers: 'Evaluative Threat + Ambiguity + Consequence' },
    { tier: 4, name: 'Elite', color: '#22c55e', target: '< 5% Cost', task: 'Complex task', distractors: 'All types at max density', modifiers: 'All at high intensity' },
];

const VARIANTS = [
    { name: 'Visual Noise', description: 'Peripheral movement, color flashes, decoy targets only. Default Tier 1–2.', status: 'Registered' },
    { name: 'Audio Noise', description: 'Crowd noise, commentary, off-rhythm sounds. Sport-atmosphere variant.', status: 'Registered' },
    { name: 'Mixed Noise', description: 'Simultaneous visual and audio distractors. Default Tier 3–4.', status: 'Registered' },
    { name: 'Baited Noise', description: 'Distractors closely resembling real targets. Discrimination under noise.', status: 'Registered' },
    { name: 'Extended Noise Gate Trial', description: 'Standardized 10–15 min at fixed Tier 3. Trial-layer assessment.', status: 'Registered' },
    { name: 'Crowd Tunnel (Vision Pro)', description: 'Immersive spatial audio and 3D clutter. Transfer fidelity variant.', status: 'Planned' },
];

const MEASUREMENT_RULES = [
    { rule: 'Valid response definition', detail: 'Correct response to the primary target during the noise phase, within the target response window and above 150ms. Responses to distractors classified separately as false alarms.' },
    { rule: 'Distractor Cost calculation', detail: 'DC = (baseline accuracy − noise-phase accuracy) as percentage, combined with RT shift. Both components reported; accuracy is the headline number.' },
    { rule: 'False alarm definition', detail: 'Response directed at a distractor rather than the primary target. Classified by distractor type — required, not optional.' },
    { rule: 'Channel Vulnerability isolation', detail: 'Distractor Cost broken down by distractor type (visual, audio, mixed, baited). Required output, not optional.' },
    { rule: 'Minimum reaction time', detail: '150ms floor. Responses below are motor artifacts. Per Standards Addendum §2.1.' },
];

const EXPERIENCE_PRINCIPLES = [
    { title: 'Feel like training, not therapy', detail: 'The sim should feel like a drill. The athlete should want to beat their last score. Competitive energy is the engine.' },
    { title: 'Minimal UI during gameplay', detail: 'Clean, immersive screen. No navigation, no settings beyond intentional distractors. The sim owns the screen.' },
    { title: 'Data after, not during', detail: 'Performance shown between rounds (Training) or only at session end (Trial). Focus on performing, not monitoring.' },
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

const NoiseGateSpecTab: React.FC = () => {
    return (
        <div className="space-y-10">
            {/* HEADER */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl" style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}>
                        <Volume2 className="w-5 h-5" style={{ color: ACCENT }} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: ACCENT }}>PULSE CHECK · SIM SPECIFICATION</p>
                        <h2 className="text-xl font-semibold">Noise Gate</h2>
                        <p className="text-xs text-zinc-500">Selective Attention Training Simulation · Spec v2.0 · March 2025</p>
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
                        Noise Gate trains the athlete&apos;s ability to hold attention on the right signal while irrelevant information competes for processing. In every sport, the environment is full of noise. The athletes who perform best are not the ones who experience less noise — they are the ones whose <span className="text-white font-semibold">attentional filter is strong enough to keep the live cue in focus while the noise fades to background</span>. Noise Gate makes that filter measurable and trainable.
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
                <p className="text-sm text-zinc-400">Continuous rounds. 8–12 rounds per session, 3–5 minutes for daily training.</p>
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
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-2">Layer 1 — Pillar Composite Contribution</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                        Feeds primarily into the <span className="text-sky-400 font-semibold">Focus</span> pillar composite, with secondary contribution to <span className="text-amber-400 font-semibold">Decision</span>.
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
                                <div className={`w-1.5 h-6 rounded-full flex-shrink-0 mt-0.5`} style={{ background: rm.primary ? ACCENT : '#52525b' }} />
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
                    <p className="text-[10px] text-zinc-400">7-day and 30-day Distractor Cost trend lines. Declining cost over time means the filter is getting stronger.</p>
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
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">Primary Task</p>
                                    <p className="text-[10px] text-zinc-400">{dt.task}</p>
                                </div>
                                <div className="rounded-lg border border-zinc-800 bg-black/20 p-2">
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">Distractors</p>
                                    <p className="text-[10px] text-zinc-400">{dt.distractors}</p>
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
                        This spec defines Noise Gate at the <span className="text-white font-semibold">family level</span>. Mechanism (filter irrelevant noise), core metric (Distractor Cost), and score architecture are <span className="text-white font-semibold">fixed</span>. New variants can be added without taxonomy changes.
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
                            <p className="text-xs font-bold text-cyan-400 mb-1">Extended Trial Noise Gate</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">Standardized at Tier 3, 10–15 minutes, non-adaptive. Per Standards Addendum §6.</p>
                        </div>
                        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                            <p className="text-xs font-bold text-purple-400 mb-1">Crowd Tunnel (Vision Pro)</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">Immersive Transfer Trial — spatial audio and 3D clutter. Tests filter strength in more realistic environments.</p>
                        </div>
                    </div>
                    <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
                        <p className="text-xs font-semibold text-white mb-1">Transfer Gap</p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                            Difference between Distractor Cost in daily training and in the Trial variant. <span className="text-green-400">Small gap</span> = internalized skill. <span className="text-red-400">Large gap</span> = improved in drill, not yet stable under realistic conditions.
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
                            {['Round-by-round Distractor Cost shown between rounds', 'Compared to personal average', 'Summary data + trend lines at session end', 'Adaptive difficulty active'].map((item) => (
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
                        Measures <span className="text-white font-semibold">cognitive-perceptual skill</span>, not motor speed. Physical responses kept simple. Per Standards Addendum §7: motor baseline captured at session start, device type and input method logged as covariates in research analysis.
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

export default NoiseGateSpecTab;
