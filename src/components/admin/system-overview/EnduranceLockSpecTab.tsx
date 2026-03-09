import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Brain, Gamepad2, Ruler, BarChart3, Sliders, TrendingUp, GitBranch, FlaskConical, Shield, Eye, Smartphone, Palette, MessageSquare, BookOpen, ChevronDown, ChevronRight, CheckCircle2, Target, AlertTriangle } from 'lucide-react';

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

const ACCENT = '#f97316'; // orange — sustained burn

const PHASES = [
    { phase: '1', name: 'Baseline Establishment', color: '#60a5fa', duration: '2–3 min', desc: 'First minutes establish the athlete\'s fresh performance level. Accuracy and RT during this phase are the per-session baseline.', bullets: ['Task drawn from any family mechanic', 'Accuracy and RT averaged across this window = 100% baseline', 'Difficulty remains constant'] },
    { phase: '2', name: 'Sustained Load', color: '#f97316', duration: 'Varies by tier', desc: 'Task continues without breaks. System continuously tracks performance vs. baseline.', bullets: ['Beginner: Simple sustained task, no distractor additions', 'Intermediate: Moderate task with periodic distractor layers', 'Advanced: Complex multi-skill task loading multiple executive functions'] },
    { phase: '3', name: 'Late-Session Probe', color: '#22c55e', duration: 'Final minutes', desc: 'Challenge spike in final minutes tests remaining capacity and exposes gradual vs. cliff degradation patterns.', bullets: ['Probe performance vs. equivalent difficulty in baseline phase', 'Gradual slope vs. cliff collapse pattern detection', 'Both patterns captured and tracked longitudinally'] },
];

const SCIENCE = [
    { name: 'Mental Fatigue in Sport', authors: 'Schampheleer et al., 2024', summary: 'Prolonged cognitive effort impairs physical, technical, tactical, and perceptual-cognitive sport performance. Establishes the scientific basis for treating duration as a performance variable.' },
    { name: 'Attentional Control Theory', authors: 'Eysenck et al., 2007', summary: 'Sustained effort depletes resources maintaining goal-directed attention. As resources deplete, distractors become harder to resist and inhibition weakens.' },
    { name: 'Sustained Attention', authors: 'Posner & Petersen, 1990', summary: 'The vigilance/alerting network maintains readiness to respond over time. Endurance Lock loads this network by requiring extended performance quality.' },
    { name: 'Stress Inoculation Training', authors: 'Meichenbaum, 1985', summary: 'Repeated exposure to sustained cognitive load builds tolerance for fatigue-driven degradation.' },
];

const SKILLS = [
    { skill: 'Degradation Slope', pillar: 'Focus', desc: 'Core skill score. Linear slope of accuracy decline over the session\'s second half, expressed as % drop per minute. Flatter = better.', color: ACCENT },
    { skill: 'Cognitive Endurance', pillar: 'Focus', desc: 'Time until first sustained degradation onset (accuracy drops below 90% of baseline for at least one full block). Later onset = stronger endurance.', color: '#f59e0b' },
    { skill: 'Pressure Stability', pillar: 'Composure', desc: 'Degradation slope gap between neutral and pressure modifier conditions. Per Standards Addendum §9.', color: '#c084fc' },
];

const METRICS = [
    { metric: 'Degradation Slope', desc: 'Linear slope of accuracy decline over session\'s second half, % per minute. Core metric.', primary: true },
    { metric: 'Degradation Onset', desc: 'Time point when accuracy first drops below 90% of baseline, sustained for at least one full block.' },
    { metric: 'Baseline Performance', desc: 'Mean accuracy and RT from first 2–3 minutes. Defines the 100% reference for all subsequent blocks.' },
    { metric: 'Late-Probe Score', desc: 'Performance on final challenge spike vs. baseline difficulty equivalent.' },
    { metric: 'Block-by-Block Accuracy', desc: 'Per-block accuracy over the full session. Feeds slope calculation and degradation pattern detection.' },
    { metric: 'Embedded Task Attribution', desc: 'When another family\'s task is embedded, data feeds Endurance Lock profile only — not the embedded family\'s.' },
    { metric: 'Modifier Condition Tag', desc: 'Which modifiers were active. Enables pressure-stratified analysis.' },
];

const CC = [
    { modifier: 'Readiness', contribution: 'Session-opening accuracy vs. rolling baseline. High opening performance = higher readiness.' },
    { modifier: 'Consistency', contribution: 'Block-by-block accuracy variance before onset. Low variance = high consistency score.' },
    { modifier: 'Fatigability', contribution: 'Degradation slope and onset. The primary Fatigability signal across all families.' },
    { modifier: 'Pressure Sensitivity', contribution: 'Slope gap between neutral and pressure modifier conditions.' },
];

const MODS = [
    { modifier: 'Distraction', behavior: 'Distractor layers added after baseline window. Tests filter degradation under fatigue.', levels: 'Low / Medium / High' },
    { modifier: 'Time Pressure', behavior: 'Response windows tighten as session progresses. Tests RT maintenance under fatigue.', levels: 'Standard / Tight / Extreme' },
    { modifier: 'Evaluative Threat', behavior: 'Stakes messaging in late session. Tests composure maintenance under dual pressure.', levels: 'Subtle / Moderate / Direct' },
    { modifier: 'Consequence', behavior: 'Late-session errors cost something. Raises stakes at peak fatigue.', levels: 'Low / Medium / High' },
    { modifier: 'Ambiguity', behavior: 'Task parameters become less clear in late session. Tests adaptability under fatigue.', levels: 'Slight / Moderate / Full' },
    { modifier: 'Fatigue Load', behavior: 'Already intrinsic to this sim. Modifier increases session length or cognitive load further.', levels: 'Standard / Elevated / Extended' },
];

const TIERS = [
    { tier: 1, name: 'Foundation', color: '#94a3b8', target: 'Onset after min 4+', duration: '5–8 min', task: 'Simple sustained task', mods: 'None' },
    { tier: 2, name: 'Sharpening', color: '#60a5fa', target: 'Onset 6+, slope < 3%/min', duration: '8–12 min', task: 'Moderate + distractor layer', mods: 'Distraction + Time Pressure' },
    { tier: 3, name: 'Pressure', color: '#c084fc', target: 'Onset 8+, slope < 2%/min', duration: '12–15 min', task: 'Complex, multi-skill', mods: 'All except Consequence' },
    { tier: 4, name: 'Elite', color: '#22c55e', target: 'Onset 12+, slope < 1.5%/min', duration: '15–20 min', task: 'Max complexity', mods: 'All at high intensity' },
];

const VARIANTS = [
    { name: 'Sustained Attention Simple', desc: 'Simple task, 5–8 min. Default Tier 1.', status: 'Registered' },
    { name: 'Endurance + Distractor', desc: 'Noise Gate mechanic embedded as Tier 2 task layer.', status: 'Registered' },
    { name: 'Multi-Skill Endurance', desc: 'Rotating mechanic mix loading multiple executive functions. Advanced variant.', status: 'Registered' },
    { name: 'Fatigability Probe (Trial)', desc: 'Standardized 15–20 min at fixed Tier 3. Produces complete degradation curve.', status: 'Registered' },
    { name: 'Immersive Endurance Trial (Vision Pro)', desc: 'Extended duration in immersive environment. Tests vigilance/attention endurance in richer context.', status: 'Planned' },
];

const RULES = [
    { rule: 'Baseline period definition', detail: 'First 2–3 minutes of session. Performance in this window = 100% baseline. All subsequent blocks measured as % of baseline.' },
    { rule: 'Degradation onset definition', detail: 'Time when accuracy first drops below 90% of baseline, sustained for at least one full block. A single low block followed by recovery does not count as onset.' },
    { rule: 'Degradation slope calculation', detail: 'Linear slope of accuracy decline over session\'s second half, expressed as % drop per minute. Flatter is better.' },
    { rule: 'Late-probe scoring', detail: 'Performance on final challenge spike vs. how athlete handled equivalent difficulty in baseline phase. Separate metric from slope.' },
    { rule: 'Embedded task attribution', detail: 'When Endurance Lock embeds another family\'s task (e.g., Noise Gate filtering), the measured phenomenon is duration-dependent degradation. Data feeds Endurance Lock\'s profile only.' },
];

const REFS = [
    { id: 1, text: 'Eysenck, M. W., & Calvo, M. G. (1992). Anxiety and performance. Cognition & Emotion, 6(6), 409–434.' },
    { id: 2, text: 'Eysenck, M. W., et al. (2007). Attentional control theory. Emotion, 7(2), 336–353.' },
    { id: 3, text: 'Meichenbaum, D. (1985). Stress Inoculation Training. Pergamon Press.' },
    { id: 4, text: 'Miyake, A., et al. (2000). Unity and diversity of executive functions. Cognitive Psychology, 41(1), 49–100.' },
    { id: 5, text: 'Posner, M. I., & Petersen, S. E. (1990). The attention system. Annual Review of Neuroscience, 13, 25–42.' },
    { id: 6, text: 'Schampheleer, E., et al. (2024). Mental fatigue in sport. Sports Medicine, 54, 1947–1968.' },
    { id: 7, text: 'Nideffer, R., & Sagal, M. (2006). Concentration and attention control training. Applied Sport Psychology. McGraw-Hill.' },
    { id: 8, text: 'APA Division 47. (2014). Concentration and Attention in Sport. Sport Psychology Works Fact Sheet.' },
];

const GDOCS = [
    { name: 'Sim Specification Standards Addendum (v2)', desc: 'Shared measurement precision, session validity, modifier boundaries, feedback modes, trial standardization, motor confounds, validation roadmap.' },
    { name: 'Pulse Check System Taxonomy (v3)', desc: 'Three pillars, skill map, cross-cutting modifiers, score architecture, AI adaptation, session length, trial architecture.' },
    { name: 'Sim Family Promotion Protocol (v2)', desc: 'How families are proposed, evaluated, promoted. Variant classification, divergence detection.' },
    { name: 'Sim Family Tree (v2)', desc: 'Complete family, candidate, variant, and exploratory hierarchy for all Pulse Check simulations.' },
];

const EXP = [
    { title: 'Feel like training, not therapy', detail: 'The sim should feel like a drill. The athlete should want to beat their last score. Competitive energy is the engine.' },
    { title: 'Duration is the mechanism, not the punishment', detail: 'The length is the point. The task should be engaging enough that degradation is a meaningful measurement, not a boredom artifact.' },
    { title: 'Minimal UI during gameplay', detail: 'Clean, immersive screen. No navigation, no settings. The sim owns the screen.' },
    { title: 'Data after, not during', detail: 'Performance shown between rounds (Training) or only at session end (Trial).' },
    { title: 'Celebrate improvement, not perfection', detail: 'Highlight personal bests and trend improvements. Progress is the reward.' },
];

const EnduranceLockSpecTab: React.FC = () => (
    <div className="space-y-10">
        <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl" style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}>
                <Timer className="w-5 h-5" style={{ color: ACCENT }} />
            </div>
            <div>
                <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: ACCENT }}>PULSE CHECK · SIM SPECIFICATION</p>
                <h2 className="text-xl font-semibold">Endurance Lock</h2>
                <p className="text-xs text-zinc-500">Sustained Attention and Cognitive Fatigue Training Simulation · Spec v2.0 · March 2025</p>
            </div>
        </div>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Target className="w-4 h-4" style={{ color: ACCENT }} /> Concept</h3>
            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5">
                <p className="text-sm text-zinc-300 leading-relaxed">Endurance Lock is fundamentally different from the other five families. While those sims train short, repeatable skills, Endurance Lock answers a question only duration can reveal: <span className="text-white font-semibold">what happens to mental performance when you have to sustain it?</span> In the fourth quarter, the final set, the last miles — focus, composure, and decision quality all face degradation. Endurance Lock measures that degradation and trains the athlete to delay its onset.</p>
            </div>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Brain className="w-4 h-4 text-purple-400" /> Scientific Foundation</h3>
            <p className="text-xs text-zinc-500">These references support the mechanism. They do not validate the full implementation; that requires internal validation and transfer testing.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SCIENCE.map((s) => (
                    <div key={s.name} className="bg-[#090f1c] border border-zinc-800 rounded-xl px-4 py-3 space-y-1">
                        <p className="text-xs font-bold text-white">{s.name}</p>
                        <p className="text-[9px] text-zinc-600">{s.authors}</p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">{s.summary}</p>
                    </div>
                ))}
            </div>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Gamepad2 className="w-4 h-4 text-blue-400" /> Game Flow</h3>
            <p className="text-sm text-zinc-400">Intentionally longer than other sims. Short probes: 5–8 min. Full assessments: 10–20 min.</p>
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {PHASES.map((gp, i) => (
                    <React.Fragment key={gp.phase}>
                        <div className="flex-shrink-0 rounded-xl border px-4 py-2.5 min-w-[175px]" style={{ borderColor: gp.color + '30', background: gp.color + '08' }}>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: gp.color + '20', color: gp.color }}>{gp.phase}</div>
                                <p className="text-xs font-bold" style={{ color: gp.color }}>{gp.name}</p>
                            </div>
                            <p className="text-[9px] text-zinc-500">{gp.duration}</p>
                        </div>
                        {i < PHASES.length - 1 && <span className="text-zinc-600 flex-shrink-0 text-lg">→</span>}
                    </React.Fragment>
                ))}
            </div>
            {PHASES.map((gp) => (
                <CollapsibleSection key={gp.phase} title={`Phase ${gp.phase}: ${gp.name}`} defaultOpen={gp.phase === '3'}>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-2">{gp.desc}</p>
                    <div className="space-y-1">{gp.bullets.map((t) => (
                        <div key={t} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: gp.color }} />
                            <p className="text-[10px] text-zinc-500">{t}</p>
                        </div>
                    ))}</div>
                </CollapsibleSection>
            ))}
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Ruler className="w-4 h-4 text-green-400" /> Measurement Rules</h3>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3"><p className="text-xs text-amber-300"><AlertTriangle className="w-3 h-3 inline mr-1" />Governed by the <span className="font-semibold">Sim Specification Standards Addendum</span>. Addendum governs when rules conflict.</p></div>
            <div className="space-y-2">{RULES.map((mr) => (
                <div key={mr.rule} className="bg-[#090f1c] border border-zinc-800 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-white mb-0.5">{mr.rule}</p>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">{mr.detail}</p>
                </div>
            ))}</div>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-400" /> Score Architecture</h3>
            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4">
                <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-2">Layer 1 — Pillar Composite Contribution</p>
                <p className="text-xs text-zinc-400">Feeds primarily into <span className="text-sky-400 font-semibold">Focus</span> (sustained attention), with secondary contribution to <span className="text-green-400 font-semibold">Composure</span> (stability under fatigue).</p>
            </div>
            <CollapsibleSection title="Layer 2 — Skill Scores" defaultOpen>
                <div className="space-y-2">{SKILLS.map((ss) => (
                    <div key={ss.skill} className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ background: ss.color }} />
                            <p className="text-xs font-bold text-white">{ss.skill}</p>
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/30 border border-zinc-700 text-zinc-500">{ss.pillar}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">{ss.desc}</p>
                    </div>
                ))}</div>
            </CollapsibleSection>
            <CollapsibleSection title="Layer 3 — Raw Performance Metrics">
                <div className="space-y-1.5">{METRICS.map((rm) => (
                    <div key={rm.metric} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-black/20 px-3 py-2">
                        <div className="w-1.5 h-6 rounded-full flex-shrink-0 mt-0.5" style={{ background: rm.primary ? ACCENT : '#52525b' }} />
                        <div>
                            <p className="text-xs font-semibold" style={{ color: rm.primary ? ACCENT : '#fff' }}>{rm.metric}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{rm.desc}</p>
                        </div>
                    </div>
                ))}</div>
            </CollapsibleSection>
            <CollapsibleSection title="Cross-Cutting Modifier Scores">
                <div className="space-y-1.5">{CC.map((cc) => (
                    <div key={cc.modifier} className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-2">
                        <p className="text-xs font-bold text-white">{cc.modifier}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{cc.contribution}</p>
                    </div>
                ))}</div>
            </CollapsibleSection>
            <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
                <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-1">Longitudinal Tracking</p>
                <p className="text-[10px] text-zinc-400">Degradation Slope and Onset tracked over time. Ideal: flattening slope and later onset.</p>
            </div>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Sliders className="w-4 h-4 text-amber-400" /> Modifier Compatibility Matrix</h3>
            <div className="overflow-x-auto border border-zinc-800 rounded-xl">
                <table className="w-full text-xs min-w-[600px]">
                    <thead className="bg-black/30 text-zinc-500 uppercase text-[9px] tracking-wider"><tr><th className="text-left px-3 py-2">Modifier</th><th className="text-left px-3 py-2">Behavior</th><th className="text-left px-3 py-2">Levels</th></tr></thead>
                    <tbody>{MODS.map((mc) => (
                        <tr key={mc.modifier} className="border-t border-zinc-800/50">
                            <td className="px-3 py-2 font-semibold text-white whitespace-nowrap">{mc.modifier}</td>
                            <td className="px-3 py-2 text-zinc-400">{mc.behavior}</td>
                            <td className="px-3 py-2 text-zinc-500 font-mono text-[9px]">{mc.levels}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan-400" /> Difficulty Progression</h3>
            <div className="flex items-center gap-1 overflow-x-auto pb-2">{TIERS.map((dt, i) => (
                <React.Fragment key={dt.tier}>
                    <div className="flex-shrink-0 rounded-xl border px-3 py-2 min-w-[130px]" style={{ borderColor: dt.color + '30', background: dt.color + '08' }}>
                        <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: dt.color }}>Tier {dt.tier}</p>
                        <p className="text-[10px] text-zinc-400">{dt.name}</p>
                        <p className="text-[9px] font-mono text-zinc-600">{dt.duration}</p>
                    </div>
                    {i < TIERS.length - 1 && <span className="text-zinc-600 flex-shrink-0">→</span>}
                </React.Fragment>
            ))}</div>
            <div className="space-y-2">{TIERS.map((dt) => (
                <CollapsibleSection key={dt.tier} title={`Tier ${dt.tier} — ${dt.name}`}>
                    <div className="grid grid-cols-2 gap-2">
                        {[{ label: 'Duration', val: dt.duration }, { label: 'Task', val: dt.task }, { label: 'Modifiers', val: dt.mods }, { label: 'Target', val: dt.target }].map(({ label, val }) => (
                            <div key={label} className="rounded-lg border border-zinc-800 bg-black/20 p-2">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">{label}</p>
                                <p className="text-[10px] text-zinc-400">{val}</p>
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>
            ))}</div>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><GitBranch className="w-4 h-4 text-green-400" /> Family and Variant Structure</h3>
            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                <p className="text-sm text-zinc-300 leading-relaxed">Family-level spec. Mechanism (preserve execution under accumulated load), core metric (Degradation Slope), and score architecture are <span className="text-white font-semibold">fixed</span>. Variants that embed other families&apos; tasks still belong to Endurance Lock because the measured phenomenon is duration-dependent degradation.</p>
                <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">Registered Variants</p>
                <div className="space-y-1.5">{VARIANTS.map((v) => (
                    <div key={v.name} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-black/20 px-3 py-2">
                        <div className={`w-1.5 h-8 rounded-full flex-shrink-0 mt-0.5 ${v.status === 'Planned' ? 'bg-zinc-600' : 'bg-green-500/60'}`} />
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold text-white">{v.name}</p>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded border ${v.status === 'Planned' ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>{v.status}</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{v.desc}</p>
                        </div>
                    </div>
                ))}</div>
            </div>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><FlaskConical className="w-4 h-4 text-cyan-400" /> Trial Layer Connection</h3>
            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4"><p className="text-xs font-bold text-cyan-400 mb-1">Fatigability Probe (Trial)</p><p className="text-[10px] text-zinc-400 leading-relaxed">Standardized 15–20 min at fixed Tier 3. Produces complete degradation curve. Per Standards Addendum §6.</p></div>
                    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4"><p className="text-xs font-bold text-purple-400 mb-1">Immersive Endurance Trial (Vision Pro)</p><p className="text-[10px] text-zinc-400 leading-relaxed">Extended duration in immersive environment. Tests whether sustained attention endurance transfers to richer perceptual context.</p></div>
                </div>
                <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
                    <p className="text-xs font-semibold text-white mb-1">Transfer Gap</p>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">Difference between Degradation Slope in daily training and in the Trial variant. <span className="text-green-400">Small gap</span> = internalized. <span className="text-red-400">Large gap</span> = improved in drill, not yet stable under realistic conditions.</p>
                </div>
            </div>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-green-400" /> Evidence Status</h3>
            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">{[1, 2, 3, 4].map((s) => (<div key={s} className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border" style={{ background: s === 1 ? '#22c55e15' : '#00000020', borderColor: s === 1 ? '#22c55e30' : '#27272a', color: s === 1 ? '#22c55e' : '#52525b' }}>{s}</div>))}</div>
                    <div><p className="text-xs font-bold text-green-400">Stage 1: Mechanism Support</p><p className="text-[10px] text-zinc-500">The mental fatigue literature is especially robust for this family.</p></div>
                </div>
                <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-1">Next Milestone</p>
                    <p className="text-[10px] text-zinc-400">Stage 2: Internal Reliability — ICC ≥ 0.70 across athlete populations.</p>
                </div>
            </div>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Eye className="w-4 h-4 text-blue-400" /> Feedback Mode Behavior</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#090f1c] border border-blue-500/20 rounded-2xl p-4 space-y-2">
                    <p className="text-xs font-bold text-blue-400">Training Mode</p>
                    <div className="space-y-1">{['Degradation Slope shown after each round', 'Compared to personal average', 'Summary data + trends at session end', 'Adaptive difficulty active'].map((it) => (<div key={it} className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" /><p className="text-[10px] text-zinc-400">{it}</p></div>))}</div>
                </div>
                <div className="bg-[#090f1c] border border-purple-500/20 rounded-2xl p-4 space-y-2">
                    <p className="text-xs font-bold text-purple-400">Trial Mode</p>
                    <div className="space-y-1">{['No intra-session feedback', 'Full session without scores', 'Results only at session end', 'Fixed difficulty at Trial level'].map((it) => (<div key={it} className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-purple-400 flex-shrink-0 mt-0.5" /><p className="text-[10px] text-zinc-400">{it}</p></div>))}</div>
                </div>
            </div>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Smartphone className="w-4 h-4 text-amber-400" /> Motor and Device Considerations</h3>
            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5"><p className="text-sm text-zinc-300 leading-relaxed">Measures <span className="text-white font-semibold">cognitive-perceptual skill</span>, not motor speed. Physical responses kept simple. Motor baseline captured at session start per Standards Addendum §7.</p></div>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Palette className="w-4 h-4 text-pink-400" /> Experience Design Principles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{EXP.map((ep) => (<div key={ep.title} className="bg-[#090f1c] border border-zinc-800 rounded-xl px-4 py-3 space-y-1"><p className="text-xs font-bold text-white">{ep.title}</p><p className="text-[10px] text-zinc-400 leading-relaxed">{ep.detail}</p></div>))}</div>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-400" /> Governing Documents</h3>
            <div className="space-y-2">{GDOCS.map((gd) => (<div key={gd.name} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-[#090f1c] px-4 py-3"><CheckCircle2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" /><div><p className="text-xs font-semibold text-white">{gd.name}</p><p className="text-[10px] text-zinc-500 mt-0.5">{gd.desc}</p></div></div>))}</div>
        </section>

        <section className="space-y-4 pb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><BookOpen className="w-4 h-4 text-zinc-400" /> Research References</h3>
            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5">
                <div className="space-y-1.5">{REFS.map((ref) => (<div key={ref.id} className="flex items-start gap-2"><span className="text-[9px] font-mono text-zinc-600 flex-shrink-0 mt-0.5">[{ref.id}]</span><p className="text-[10px] text-zinc-500 leading-relaxed">{ref.text}</p></div>))}</div>
            </div>
        </section>
    </div>
);

export default EnduranceLockSpecTab;
