import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, Brain, Gamepad2, Ruler, BarChart3, Sliders, TrendingUp, GitBranch, FlaskConical, Shield, Eye, Smartphone, Palette, MessageSquare, BookOpen, ChevronDown, ChevronRight, CheckCircle2, Target, AlertTriangle } from 'lucide-react';

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

const ACCENT = '#a78bfa';

const PHASES = [
    { phase: '1', name: 'Rule Establishment', color: '#60a5fa', duration: '5–10 trials', desc: 'Athlete learns the active rule set and executes trials to establish fluency before the shift.', bullets: ['Beginner: One simple rule', 'Intermediate: Two active rules', 'Advanced: Multi-dimensional conditional rules'] },
    { phase: '2', name: 'Shift', color: '#a78bfa', duration: 'Unpredictable', desc: 'The active rule changes. Detect, suppress old rule, load new rule, execute.', bullets: ['Signaled shift: Clear cue. Default Tier 1–2.', 'Unsignaled shift: No explicit cue. Default Tier 3+.', 'Late audible: Signal arrives after execution begins.'] },
    { phase: '3', name: 'Score Capture', color: '#22c55e', duration: 'Per block', desc: 'Accuracy and RT on post-shift trials vs. pre-shift baseline. Core metric: Update Accuracy After Rule Change.', bullets: ['Post-shift window: first 3–5 trials after rule change', 'Old-rule intrusion errors classified separately', 'Switch cost: first post-shift RT vs. pre-shift rolling average', 'Session: 4–6 blocks, 1–3 shifts per block, 3–5 minutes'] },
];

const SCIENCE = [
    { name: 'Executive Function: Updating and Shifting', authors: 'Miyake et al., 2000', summary: 'Both are separable core executive functions required when task rules change mid-execution. Sequence Shift loads both simultaneously.' },
    { name: 'Attentional Control Theory', authors: 'Eysenck et al., 2007', summary: 'ACT identifies shifting as specifically impaired by anxiety. Under pressure, disengaging from the current mental set becomes slower and more error-prone.' },
    { name: 'Stress Inoculation Training', authors: 'Meichenbaum, 1985', summary: 'Controlled exposure to unpredictable rule changes builds tolerance for cognitive disruption.' },
    { name: 'Task-Switching Cost Literature', authors: 'Cognitive psychology research', summary: 'Switch cost is measurable and trainable. Sequence Shift captures this cost and tracks its reduction over time.' },
];

const SKILLS = [
    { skill: 'Update Accuracy After Rule Change', pillar: 'Decision', desc: 'Core skill score. Accuracy on first 3–5 post-shift trials vs. pre-shift baseline.', color: ACCENT },
    { skill: 'Working-Memory Updating', pillar: 'Decision', desc: 'Based on old-rule intrusion error rate. Fewer intrusions = cleaner mental model update.', color: '#60a5fa' },
    { skill: 'Pressure Stability', pillar: 'Composure', desc: 'Update accuracy under pressure modifiers vs. baseline. Per Standards Addendum §9.', color: '#c084fc' },
];

const METRICS = [
    { metric: 'Update Accuracy After Rule Change', desc: 'Core metric. Accuracy on first 3–5 trials after each shift vs. pre-shift baseline.', primary: true },
    { metric: 'Switch Cost', desc: 'First post-shift trial RT vs. pre-shift rolling average, in milliseconds.' },
    { metric: 'Old-Rule Intrusion Rate', desc: 'Errors where athlete executed old rule post-shift. Required classification.' },
    { metric: 'Novel Error Rate', desc: 'Post-shift errors not attributable to old-rule intrusion. Separate classification.' },
    { metric: 'Pre-Shift Accuracy', desc: 'Performance during steady-state before each shift. Per-block baseline.' },
    { metric: 'Shift Type Tag', desc: 'Signaled, unsignaled, or late audible. Difficulty-stratified analysis.' },
    { metric: 'Modifier Condition Tag', desc: 'Which modifiers were active. Enables pressure-stratified analysis.' },
];

const CC = [
    { modifier: 'Readiness', contribution: 'Post-shift accuracy in opening blocks vs. rolling baseline.' },
    { modifier: 'Consistency', contribution: 'Update accuracy variance across blocks within session.' },
    { modifier: 'Fatigability', contribution: 'Accuracy degradation from early to late blocks.' },
    { modifier: 'Pressure Sensitivity', contribution: 'Accuracy gap between neutral and pressure conditions.' },
];

const MODS = [
    { modifier: 'Distraction', behavior: 'Adds stimuli during rule establishment, increasing cognitive load before shift.', levels: 'Low / Medium / High' },
    { modifier: 'Time Pressure', behavior: 'Shorter window between rule change signal and required response.', levels: 'Standard / Tight / Extreme' },
    { modifier: 'Evaluative Threat', behavior: 'Stakes messaging around shift moments. Raises emotional cost of adaptation errors.', levels: 'Subtle / Moderate / Direct' },
    { modifier: 'Consequence', behavior: 'Intrusion errors cost something. Raises stakes at each shift.', levels: 'Low / Medium / High' },
    { modifier: 'Ambiguity', behavior: 'Rule change signal less clear or delayed. Increases detection uncertainty.', levels: 'Slight / Moderate / Full' },
    { modifier: 'Fatigue Load', behavior: 'More blocks/shifts to measure adaptation under cognitive fatigue.', levels: 'Standard / Elevated / Extended' },
];

const TIERS = [
    { tier: 1, name: 'Foundation', color: '#94a3b8', target: '70%+ Update Accuracy', rules: 'Simple rules', shifts: 'Signaled', mods: 'None' },
    { tier: 2, name: 'Sharpening', color: '#60a5fa', target: '75%+, SC < 400ms', rules: 'Multi-dimension rules', shifts: 'Signaled, shorter prep', mods: 'Ambiguity' },
    { tier: 3, name: 'Pressure', color: '#c084fc', target: '70%+, SC < 300ms', rules: 'Conditional rules', shifts: 'Unsignaled', mods: 'All pressure modifiers' },
    { tier: 4, name: 'Elite', color: '#22c55e', target: '65%+, SC < 200ms', rules: 'Max complexity', shifts: 'Late audibles', mods: 'All at high intensity' },
];

const VARIANTS = [
    { name: 'Simple Shift', desc: 'Single rule, signaled shifts. Default Tier 1–2.', status: 'Registered' },
    { name: 'Conditional Shift', desc: 'Multi-dimensional conditional rules. Default Tier 3.', status: 'Registered' },
    { name: 'Audible Series', desc: 'Sport-context rule changes via audible-style signals.', status: 'Registered' },
    { name: 'Extended Trial Sequence Shift', desc: 'Standardized 10–15 min at Tier 3 with frequent rule changes.', status: 'Registered' },
    { name: 'Sport-Playbook Trial (Vision Pro)', desc: 'Rule changes via spatial/environmental cues. Immersive Transfer Trial.', status: 'Planned' },
];

const RULES = [
    { rule: 'Post-shift measurement window', detail: 'Update Accuracy measured across first 3–5 trials after a rule change. Captures shift cost rather than steady-state performance.' },
    { rule: 'Old-rule intrusion classification', detail: 'Post-shift errors classified by old-rule execution (intrusion) vs. novel error. Required for Working-Memory Updating skill score.' },
    { rule: 'Switch cost calculation', detail: 'RT on first post-shift trial vs. pre-shift rolling average. In milliseconds.' },
    { rule: 'Minimum reaction time', detail: '150ms floor applies on post-shift trials. Responses below are motor artifacts. Per Standards Addendum §2.1.' },
];

const REFS = [
    { id: 1, text: 'Eysenck, M. W., & Calvo, M. G. (1992). Anxiety and performance. Cognition & Emotion, 6(6), 409–434.' },
    { id: 2, text: 'Eysenck, M. W., et al. (2007). Attentional control theory. Emotion, 7(2), 336–353.' },
    { id: 3, text: 'Meichenbaum, D. (1985). Stress Inoculation Training. Pergamon Press.' },
    { id: 4, text: 'Miyake, A., et al. (2000). Unity and diversity of executive functions. Cognitive Psychology, 41(1), 49–100.' },
    { id: 5, text: 'Posner, M. I., & Petersen, S. E. (1990). The attention system. Annual Review of Neuroscience, 13, 25–42.' },
    { id: 6, text: 'Nideffer, R., & Sagal, M. (2006). Concentration and attention control training. Applied Sport Psychology. McGraw-Hill.' },
    { id: 7, text: 'APA Division 47. (2014). Concentration and Attention in Sport. Sport Psychology Works Fact Sheet.' },
    { id: 8, text: 'USOC Performance Services Division. (2008). Sport Psychology Mental Training Manual.' },
];

const GDOCS = [
    { name: 'Sim Specification Standards Addendum (v2)', desc: 'Shared measurement precision, session validity, modifier boundaries, feedback modes, trial standardization, motor confounds, validation roadmap.' },
    { name: 'Pulse Check System Taxonomy (v3)', desc: 'Three pillars, skill map, cross-cutting modifiers, score architecture, AI adaptation, session length, trial architecture.' },
    { name: 'Sim Family Promotion Protocol (v2)', desc: 'How families are proposed, evaluated, promoted. Variant classification, divergence detection.' },
    { name: 'Sim Family Tree (v2)', desc: 'Complete family, candidate, variant, and exploratory hierarchy for all Pulse Check simulations.' },
];

const EXP = [
    { title: 'Feel like training, not therapy', detail: 'The sim should feel like a drill. The athlete should want to beat their last score.' },
    { title: 'Minimal UI during gameplay', detail: 'Clean, immersive screen. No navigation, no settings during active rule execution.' },
    { title: 'Data after, not during', detail: 'Performance shown between rounds (Training) or only at session end (Trial).' },
    { title: 'Sound design matters', detail: 'Audio cues signal shift moments clearly — the audible should feel like a real sport call.' },
    { title: 'Celebrate improvement, not perfection', detail: 'Highlight personal bests and trend improvements. Progress is the reward.' },
];

const SequenceShiftSpecTab: React.FC = () => (
    <div className="space-y-10">
        <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl" style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}>
                <Shuffle className="w-5 h-5" style={{ color: ACCENT }} />
            </div>
            <div>
                <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: ACCENT }}>PULSE CHECK · SIM SPECIFICATION</p>
                <h2 className="text-xl font-semibold">Sequence Shift</h2>
                <p className="text-xs text-zinc-500">Working Memory and Task-Switching Training Simulation · Spec v2.0 · March 2025</p>
            </div>
        </div>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Target className="w-4 h-4" style={{ color: ACCENT }} /> Concept</h3>
            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5">
                <p className="text-sm text-zinc-300 leading-relaxed">Sequence Shift trains the athlete&apos;s ability to <span className="text-white font-semibold">maintain active rules, detect when they change, and update their mental model in real time</span>. In sport, this is the audible at the line, the tactical adjustment mid-rally, the defensive scheme shift after a timeout. Athletes who execute cleanly after a rule change have a trained advantage in working-memory updating and attentional shifting.</p>
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
            <p className="text-sm text-zinc-400">Runs in blocks. 4–6 blocks with 1–3 rule changes per block, 3–5 minutes.</p>
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {PHASES.map((gp, i) => (
                    <React.Fragment key={gp.phase}>
                        <div className="flex-shrink-0 rounded-xl border px-4 py-2.5 min-w-[170px]" style={{ borderColor: gp.color + '30', background: gp.color + '08' }}>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: gp.color + '20', color: gp.color }}>{gp.phase}</div>
                                <p className="text-xs font-bold" style={{ color: gp.color }}>{gp.name}</p>
                            </div>
                            <p className="text-[9px] text-zinc-500">{gp.duration}</p>
                        </div>
                        {i < PHASES.length - 1 && <span className="text-zinc-600 flex-shrink-0 text-lg">→</span>}
                    </React.Fragment>
                ))}
                <span className="text-zinc-600 flex-shrink-0 text-lg">↻</span>
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
                <p className="text-xs text-zinc-400">Feeds primarily into <span className="text-amber-400 font-semibold">Decision</span>, with secondary contribution to <span className="text-sky-400 font-semibold">Focus</span>.</p>
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
                <p className="text-[10px] text-zinc-400">Update Accuracy and Switch Cost trend lines. Ideal: rising accuracy with declining cost.</p>
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
                    <div className="flex-shrink-0 rounded-xl border px-3 py-2 min-w-[120px]" style={{ borderColor: dt.color + '30', background: dt.color + '08' }}>
                        <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: dt.color }}>Tier {dt.tier}</p>
                        <p className="text-[10px] text-zinc-400">{dt.name}</p>
                        <p className="text-[9px] font-mono text-zinc-600">{dt.target}</p>
                    </div>
                    {i < TIERS.length - 1 && <span className="text-zinc-600 flex-shrink-0">→</span>}
                </React.Fragment>
            ))}</div>
            <div className="space-y-2">{TIERS.map((dt) => (
                <CollapsibleSection key={dt.tier} title={`Tier ${dt.tier} — ${dt.name}`}>
                    <div className="grid grid-cols-2 gap-2">
                        {[{ label: 'Rules', val: dt.rules }, { label: 'Shift Type', val: dt.shifts }, { label: 'Modifiers', val: dt.mods }, { label: 'Target', val: dt.target }].map(({ label, val }) => (
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
                <p className="text-sm text-zinc-300 leading-relaxed">Family-level spec. Mechanism (update rules mid-task), core metric (Update Accuracy After Rule Change), and score architecture are <span className="text-white font-semibold">fixed</span>.</p>
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
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4"><p className="text-xs font-bold text-cyan-400 mb-1">Extended Trial Sequence Shift</p><p className="text-[10px] text-zinc-400 leading-relaxed">Standardized at Tier 3, 10–15 min with frequent rule changes. Per Standards Addendum §6.</p></div>
                    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4"><p className="text-xs font-bold text-purple-400 mb-1">Sport-Playbook Trial (Vision Pro)</p><p className="text-[10px] text-zinc-400 leading-relaxed">Rule changes via spatial/environmental cues. Tests rule updating in immersive contexts.</p></div>
                </div>
                <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
                    <p className="text-xs font-semibold text-white mb-1">Transfer Gap</p>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">Difference between Update Accuracy in daily training and in the Trial variant. <span className="text-green-400">Small gap</span> = internalized. <span className="text-red-400">Large gap</span> = improved in drill, not yet stable under realistic conditions.</p>
                </div>
            </div>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-green-400" /> Evidence Status</h3>
            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">{[1, 2, 3, 4].map((s) => (<div key={s} className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border" style={{ background: s === 1 ? '#22c55e15' : '#00000020', borderColor: s === 1 ? '#22c55e30' : '#27272a', color: s === 1 ? '#22c55e' : '#52525b' }}>{s}</div>))}</div>
                    <div><p className="text-xs font-bold text-green-400">Stage 1: Mechanism Support</p><p className="text-[10px] text-zinc-500">Peer-reviewed evidence supports targeted cognitive mechanism.</p></div>
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
                    <div className="space-y-1">{['Update Accuracy shown after each round', 'Compared to personal average', 'Summary data + trends at session end', 'Adaptive difficulty active'].map((it) => (<div key={it} className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" /><p className="text-[10px] text-zinc-400">{it}</p></div>))}</div>
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

export default SequenceShiftSpecTab;
