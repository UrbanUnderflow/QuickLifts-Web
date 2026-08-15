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
        name: 'Practice and Pairing',
        color: '#60a5fa',
        duration: '2 practice rounds',
        description: 'Two unscored rounds teach the interaction. Each scored target is then scheduled once in a reference condition and once with the configured distraction channel.',
        tiers: [
            'Practice responses never enter the score',
            'Matched conditions use the same target with a changed field layout',
            'Reference and distraction order is counterbalanced across pairs',
        ],
    },
    {
        phase: '2',
        name: 'Field Scan',
        color: '#f59e0b',
        duration: '2–3 sec',
        description: 'The athlete taps the matching number while reference and distraction conditions are mixed. The focus cue remains visible throughout every round.',
        tiers: [
            'Visual: One wrong marker flashes or pulses',
            'Audio: Crowd, whistle, or commentary sounds play during the search',
            'Mixed-channel: Visual and audio distractions appear together',
            'Advanced: The flashing wrong marker closely resembles the called number',
        ],
    },
    {
        phase: '3',
        name: 'Condition Estimate',
        color: '#38bdf8',
        duration: 'Per round',
        description: 'Matched reference and distraction rounds are compared after the session. The result is a task-specific within-session estimate, not evidence of sport transfer or a clinical measure.',
        tiers: [
            'Matched accuracy cost = reference accuracy − distraction accuracy',
            'Correct-response RT shift excludes errors, timeouts, and implausibly fast inputs',
            'Wrong taps, highlighted-distractor taps, and timeouts are reported separately',
            'A channel-specific comparison requires separate balanced channel conditions',
        ],
    },
];

const SCIENTIFIC_FOUNDATIONS = [
    {
        name: 'Attentional Control Theory',
        authors: 'Eysenck et al., 2007',
        summary: 'ACT proposes that anxiety can weaken goal-directed attention and increase stimulus-driven capture. This supports the target mechanism; it does not validate Noise Gate by itself.',
    },
    {
        name: 'Visual-Search Attentional Training',
        authors: 'Ducrocq et al., 2016',
        summary: 'A visual-search task with task-irrelevant distractors improved inhibition measures and showed promising transfer to pressured tennis tasks. The new field scan follows that tested task structure more closely than word recall did.',
    },
    {
        name: 'Executive Attention',
        authors: 'Posner & Petersen, 1990; Miyake et al., 2000',
        summary: 'Executive attention and inhibition provide a mechanism for resolving competing information. Noise Gate measures performance change when a salient but irrelevant cue is added to the same search task.',
    },
    {
        name: 'Representative Learning Design',
        authors: 'Pinder et al., 2011; Krause et al., 2019',
        summary: 'Transfer is more plausible when practice preserves sport-relevant information and actions. The mobile field scan is a controlled attention drill; sport-specific transfer must still be tested and should not be assumed.',
    },
];

const SKILL_SCORES = [
    { skill: 'Task-Specific Distraction Control', pillar: 'Focus', description: 'Accuracy difference between matched reference and distraction conditions in Noise Gate. This does not by itself establish a general attention trait.', color: ACCENT },
    { skill: 'Response Selection', pillar: 'Focus', description: 'Wrong taps and highlighted-distractor taps are kept separate so salience-driven errors are not inferred from every mistake.', color: '#60a5fa' },
    { skill: 'Pressure Stability Candidate', pillar: 'Composure', description: 'May be studied only in a separately balanced neutral-versus-pressure design. It is not produced by the standard Noise Gate session.', color: '#c084fc' },
];

const RAW_METRICS = [
    { metric: 'Matched Accuracy Cost', description: 'Matched reference accuracy − distraction accuracy. Headline task metric.', primary: true },
    { metric: 'Reference Accuracy', description: 'Accuracy in scored rounds without an intentional distraction.' },
    { metric: 'Distraction Accuracy', description: 'Accuracy in scored rounds using the configured visual, audio, or combined condition.' },
    { metric: 'Correct-Response RT Shift', description: 'Median within-pair RT difference for matched correct distraction and reference responses.' },
    { metric: 'Wrong-Tap Rate', description: 'Any selected marker that does not match the visible target. Timeouts are excluded.' },
    { metric: 'Highlighted-Distractor Tap Rate', description: 'Selections of the flashing wrong marker among trials where one was present.' },
    { metric: 'Timeout Rate', description: 'Trials with no response before the window closes, reported separately from wrong taps.' },
    { metric: 'Channel Condition Tag', description: 'Identifies the active distraction channel. It is not a channel-comparison score.' },
    { metric: 'Modifier Condition Tag', description: 'Which modifiers were active, enabling pressure-stratified analysis.' },
];

const CROSSCUTTING_CONTRIBUTIONS = [
    { modifier: 'Readiness', contribution: 'Not inferred from a single Noise Gate session. Predictive validity against an independent readiness criterion would be required.' },
    { modifier: 'Consistency', contribution: 'May be described across repeated valid sessions after reliability is established; a low variance is not automatically a high skill score.' },
    { modifier: 'Fatigability', contribution: 'Requires enough counterbalanced early and late trials to separate time-on-task from condition order. The standard session does not estimate it.' },
    { modifier: 'Pressure Sensitivity', contribution: 'Requires separately balanced neutral and pressure conditions. It cannot be inferred from a standard distraction session.' },
];

const MODIFIER_COMPAT = [
    { modifier: 'Distraction Channel', behavior: 'Visual, audio, or combined distraction while the search task remains constant.', levels: 'Visual / Audio / Combined', status: 'Implemented' },
    { modifier: 'Response Window', behavior: 'Changes the available search time. Comparisons require the same window within a matched estimate.', levels: 'Fixed per configured session', status: 'Implemented' },
    { modifier: 'Evaluative Threat', behavior: 'Would add stakes messaging under a separately approved protocol.', levels: 'Not calibrated', status: 'Proposed' },
    { modifier: 'Consequence', behavior: 'Would add a meaningful response consequence without changing the target task.', levels: 'Not calibrated', status: 'Proposed' },
    { modifier: 'Ambiguity', behavior: 'Would vary distraction timing or predictability under a controlled schedule.', levels: 'Not calibrated', status: 'Proposed' },
    { modifier: 'Fatigue Load', behavior: 'Would require a longer, counterbalanced protocol designed to estimate time-on-task effects.', levels: 'Not calibrated', status: 'Proposed' },
];

const DIFFICULTY_TIERS = [
    { tier: 1, name: 'Foundation', color: '#94a3b8', target: 'Learn the interaction', task: 'Visible call with a nine-marker field', distractors: 'Unscored practice, then a low-salience visual cue', modifiers: 'Fixed response window' },
    { tier: 2, name: 'Single Channel', color: '#60a5fa', target: 'Stable valid sessions', task: 'Matched layouts and targets', distractors: 'Visual or audio, tested separately', modifiers: 'One configured channel' },
    { tier: 3, name: 'Combined Channel', color: '#c084fc', target: 'Calibrated personal progression', task: 'Same matched search task', distractors: 'Visual and audio together', modifiers: 'Combined channel only' },
    { tier: 4, name: 'Representative Variant', color: '#22c55e', target: 'Validation required', task: 'Sport-relevant information and response mapping', distractors: 'Protocol-defined', modifiers: 'Planned, not assumed equivalent' },
];

const VARIANTS = [
    { name: 'Field Scan', description: 'Visible number call, nine-marker field, and one flashing wrong marker. Default mobile mechanic.', status: 'Registered' },
    { name: 'Crowd Audio', description: 'The same field search with crowd, whistle, or commentary sounds and no visual change.', status: 'Registered' },
    { name: 'Mixed Distraction', description: 'The same field search with a flashing wrong marker and crowd audio together.', status: 'Registered' },
    { name: 'Near-Match Field', description: 'The flashing wrong marker closely resembles the called number.', status: 'Registered' },
    { name: 'Extended Noise Gate Trial', description: 'Standardized 10–15 min at fixed Tier 3. Trial-layer assessment.', status: 'Registered' },
    { name: 'Sport-Specific Field', description: 'Uses sport-relevant visual information and an action mapping selected through validation work.', status: 'Planned' },
];

const MEASUREMENT_RULES = [
    { rule: 'Practice exclusion', detail: 'The first two rounds teach the interaction and never enter accuracy, RT, or error estimates.' },
    { rule: 'Matched condition schedule', detail: 'Every scored target appears once in a reference condition and once in the configured distraction condition. Layout changes and condition order is counterbalanced.' },
    { rule: 'Matched accuracy cost', detail: 'Accuracy cost = matched reference accuracy − distraction accuracy. It is reported as a within-session task estimate, not a causal or clinical conclusion.' },
    { rule: 'Correct-response RT shift', detail: 'Median of distraction RT − reference RT within matched correct pairs. Errors, timeouts, practice, and responses below 150 ms are excluded; at least three valid correct matched pairs are required.' },
    { rule: 'Wrong-tap definition', detail: 'Any selected marker that does not match the visible target. Timeouts are reported separately.' },
    { rule: 'Highlighted-distractor tap definition', detail: 'A wrong tap specifically on the flashing marker, divided by trials where a flashing marker was present. This is not available for audio-only sessions.' },
    { rule: 'Channel reporting guardrail', detail: 'The standard variant tags one configured channel. Channel-specific comparisons require enough separate balanced conditions and are not inferred from a single mixed or audio session.' },
    { rule: 'Minimum RT integrity rule', detail: 'Responses below 150 ms may still be retained for accuracy review but are excluded from RT estimates as anticipatory or implausibly fast inputs.' },
];

const EXPERIENCE_PRINCIPLES = [
    { title: 'Feel like training, not therapy', detail: 'The sim should feel like a drill. The athlete should want to beat their last score. Competitive energy is the engine.' },
    { title: 'Minimal UI during gameplay', detail: 'Focused, immersive screen. No navigation and no settings beyond intentional distractors. The sim owns the screen.' },
    { title: 'Data after, not during', detail: 'Performance shown between rounds (Training) or only at session end (Trial). Focus on performing, not monitoring.' },
    { title: 'Sound design matters', detail: 'Audio signals, ambient sound, feedback tones support immersion and signal state changes clearly.' },
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
    { id: 9, text: 'Ducrocq, E., Wilson, M., Vine, S., & Derakshan, N. (2016). Training attentional control improves cognitive and motor task performance. Journal of Sport & Exercise Psychology, 38(5), 521–533.' },
    { id: 10, text: 'Pinder, R. A., Davids, K., Renshaw, I., & Araújo, D. (2011). Representative learning design and functionality of research and practice in sport. Journal of Sport & Exercise Psychology, 33(1), 146–155.' },
    { id: 11, text: 'Krause, L., Farrow, D., Pinder, R., Buszard, T., Kovalchik, S., & Reid, M. (2019). Enhancing skill transfer in tennis using representative learning design. Journal of Sports Sciences, 37(22), 2560–2568.' },
];

const GOVERNING_DOCS = [
    { name: 'Sim Specification Standards Addendum (v2)', description: 'Shared measurement precision, session validity, modifier boundaries, feedback modes, trial standardization, motor confounds, validation roadmap, skill-score sourcing.' },
    { name: 'PulseCheck System Taxonomy (v3)', description: 'Three pillars, skill map, cross-cutting modifiers, score architecture, evidence framework, AI adaptation, session length, trial architecture.' },
    { name: 'Sim Family Promotion Protocol (v2)', description: 'How families are proposed, evaluated, promoted. Variant classification, divergence detection, adaptive threshold governance.' },
    { name: 'Sim Family Tree (v2)', description: 'Complete family, candidate, variant, and exploratory hierarchy for all PulseCheck simulations.' },
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
                        <p className="text-xs text-zinc-500">Selective Attention Training Simulation · Spec v3.1 · August 2026</p>
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
                        Noise Gate is a visual-search drill. <span className="text-white font-semibold">A number stays visible at the top while the athlete finds and taps that same number in a field of similar markers.</span> After two unscored practice rounds, matched reference and distraction conditions appear in a counterbalanced order. The comparison estimates the within-session difference in task accuracy and correct-response speed. The drill is designed to practice goal-directed selection under interference; sport transfer remains a validation question, not a product claim.
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
                <p className="text-sm text-zinc-400">At least 12 total rounds: two unscored practice rounds plus an even number of matched scored rounds.</p>
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
                    <p className="text-[10px] text-zinc-400">7-day and 30-day matched accuracy-cost trends may describe performance on this task after reliability and minimum-valid-session rules are established. A declining value does not by itself prove a stronger brain filter or transfer to sport.</p>
                </div>
            </section>

            {/* MODIFIER COMPATIBILITY */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" /> Modifier Compatibility Matrix
                </h3>
                <p className="text-sm text-zinc-400">Only the configured distraction channel and response window are implemented. Proposed pressure modifiers require protocol review, calibration, and validation before use.</p>
                <div className="overflow-x-auto border border-zinc-800 rounded-xl">
                    <table className="w-full text-xs min-w-[600px]">
                        <thead className="bg-black/30 text-zinc-500 uppercase text-[9px] tracking-wider">
                            <tr>
                                <th className="text-left px-3 py-2">Modifier</th>
                                <th className="text-left px-3 py-2">Behavior</th>
                                <th className="text-left px-3 py-2">Levels</th>
                                <th className="text-left px-3 py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MODIFIER_COMPAT.map((mc) => (
                                <tr key={mc.modifier} className="border-t border-zinc-800/50">
                                    <td className="px-3 py-2 font-semibold text-white whitespace-nowrap">{mc.modifier}</td>
                                    <td className="px-3 py-2 text-zinc-400">{mc.behavior}</td>
                                    <td className="px-3 py-2 text-zinc-500 font-mono text-[9px]">{mc.levels}</td>
                                    <td className="px-3 py-2 text-zinc-500 text-[9px]">{mc.status}</td>
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
                <p className="text-sm text-zinc-400">These are progression concepts, not validated mastery bands. No universal percentage threshold or automatic advancement is authorized until reliability and calibration work is complete.</p>
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
                            <p className="text-[10px] text-zinc-400 leading-relaxed">Proposed non-adaptive reliability protocol. Duration, trial count, and condition schedule must be set before data collection and held constant.</p>
                        </div>
                        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                            <p className="text-xs font-bold text-purple-400 mb-1">Representative Environment Study</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">Planned study using sport-relevant information and actions. Greater visual realism alone would not establish representative design or transfer.</p>
                        </div>
                    </div>
                    <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
                        <p className="text-xs font-semibold text-white mb-1">Transfer Gap</p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                            A difference between daily-task and representative-task performance may be explored only after both measures are reliable and comparable. A small gap does not prove an internalized skill, and a large gap has several possible explanations.
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
                        <p className="text-[10px] text-zinc-400">Stage 2: Internal reliability — preregister minimum valid trials, inspect score distributions and practice effects, and estimate test-retest reliability with confidence intervals across intended athlete groups.</p>
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
                            {['No live score during scored rounds', 'Correct/incorrect feedback after each training round', 'Matched-condition summary at session end', 'No automatic mastery or difficulty decision from one session'].map((item) => (
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
                        Noise Gate combines visual search, decision, and tapping time. The simple response reduces motor demands but does not remove them. The current standard session does not capture a separate motor baseline, so RT must be interpreted as task response time rather than pure attentional speed. Research exports should add device and input-method metadata before cross-device RT comparisons are attempted.
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
