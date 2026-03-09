import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    FileText,
    Target,
    AlertTriangle,
    Sliders,
    MessageSquare,
    FlaskConical,
    Smartphone,
    Map,
    BarChart3,
    GitBranch,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Info,
    Ruler,
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

/* ---- MEASUREMENT RULES TABLE ---- */
const MEASUREMENT_RULES = [
    { family: 'Kill Switch', minSequence: '2 consecutive correct', minRT: '150 ms', maxWindow: 'Per-tier (spec)', falseStart: 'Response during disruption phase' },
    { family: 'Noise Gate', minSequence: '1 correct (continuous stream)', minRT: '150 ms', maxWindow: 'Per-tier (spec)', falseStart: 'Response to distractor stimulus' },
    { family: 'Brake Point', minSequence: '1 committed inhibition', minRT: '150 ms', maxWindow: 'Per-tier (spec)', falseStart: 'Response before Go stimulus' },
    { family: 'Signal Window', minSequence: '1 committed read', minRT: '150 ms', maxWindow: 'Per-tier (spec)', falseStart: 'Response before display onset' },
    { family: 'Sequence Shift', minSequence: '1 correct post-change', minRT: '150 ms', maxWindow: 'Per-tier (spec)', falseStart: 'Response to previous rule after change' },
    { family: 'Endurance Lock', minSequence: 'Rolling block (spec)', minRT: '150 ms', maxWindow: 'N/A (continuous)', falseStart: 'N/A' },
];

/* ---- TRIAL OUTCOMES ---- */
const TRIAL_OUTCOMES = [
    { label: 'Valid', color: '#22c55e', description: 'Athlete produced a valid response within the response window. Metric data is usable.' },
    { label: 'Timeout', color: '#f59e0b', description: 'Athlete did not respond within the maximum response window. Scored as a failed trial.' },
    { label: 'False Start', color: '#fb923c', description: 'Response before the valid window opened. Logged separately, excluded from core metric.' },
    { label: 'Motor Artifact', color: '#ef4444', description: 'Response faster than 150 ms. Flagged as non-cognitive, excluded from metric calculation.' },
    { label: 'Dropout', color: '#94a3b8', description: 'Trial not completed due to session exit. Saved with dropout flag.' },
];

/* ---- SESSION VALIDITY ---- */
const SESSION_VALIDITY = [
    { status: 'Valid Session', threshold: '≥ 80% usable trials', color: '#22c55e', action: 'Full data included in profile and trends.' },
    { status: 'Partial Session', threshold: '50–79% usable trials', color: '#f59e0b', action: 'Data included with reduced confidence weight. Flagged in research export.' },
    { status: 'Invalid Session', threshold: '< 50% usable trials', color: '#ef4444', action: 'Excluded from profile and trends. Preserved in data log. Athlete may retry.' },
];

/* ---- MODIFIER BOUNDARIES ---- */
const MODIFIER_BOUNDARIES = [
    { family: 'Kill Switch', boundary: 'Modifiers may not introduce a secondary cognitive task that changes the recovery mechanism from "return to primary task" to "solve a new problem." The athlete must always recover to the same task, not pivot to a different one.' },
    { family: 'Noise Gate', boundary: 'Distractors must remain irrelevant. If the distractor becomes a secondary target the athlete must monitor, the sim shifts from selective attention to divided attention (Split Stream territory).' },
    { family: 'Brake Point', boundary: 'The inhibition target must remain response cancellation. If modifiers add deliberation (e.g., "decide which response is correct"), it shifts into Signal Window territory.' },
    { family: 'Signal Window', boundary: 'The task must remain cue discrimination. If modifiers add ambiguity to the point where the athlete must commit without a correct answer, it shifts into Blind Commit territory.' },
    { family: 'Sequence Shift', boundary: 'Rule changes must always have a correct answer. If modifiers create rule ambiguity (no clearly correct response), the sim shifts into Chaos Read territory.' },
    { family: 'Endurance Lock', boundary: 'Endurance Lock exists to measure degradation over time, not to create new cognitive demand. Modifiers should not increase task complexity — they should increase duration, monotony, or fatigue load.' },
];

/* ---- FEEDBACK MODES ---- */
const FEEDBACK_MODES = [
    {
        mode: 'Training Mode',
        color: '#60a5fa',
        description: 'Real-time and post-round feedback is enabled. The athlete sees scores, streaks, and encouragement as part of the training experience.',
        rationale: 'Feedback is a feature in training. It motivates, calibrates, and drives engagement. Designed to celebrate improvement, not perfection.',
    },
    {
        mode: 'Trial Mode',
        color: '#c084fc',
        description: 'Intra-session feedback is suppressed. The athlete completes the full session before seeing any performance data.',
        rationale: 'Three reasons: (1) feedback creates self-monitoring that alters performance, (2) seeing poor scores mid-session can trigger frustration spirals, (3) research data must reflect natural performance trajectory.',
    },
];

/* ---- TRIAL STANDARDIZATION ---- */
const TRIAL_FIXED_PARAMS = [
    'Stimulus timing and sequence (identical across athletes and time points)',
    'Difficulty tier (locked for the assessment, not adaptive)',
    'Modifier conditions (standardized set, not randomized)',
    'Session duration and trial count (fixed, not variable)',
    'Feedback mode (Trial mode — no intra-session feedback)',
    'Warm-up protocol (standardized motor baseline + practice trials)',
];

/* ---- VALIDATION STAGES ---- */
const VALIDATION_STAGES = [
    {
        stage: 'Stage 1',
        name: 'Mechanism-Support',
        color: '#94a3b8',
        criteria: 'Peer-reviewed evidence supports the cognitive mechanism the sim targets. The sim is designed to train and measure a real, published construct.',
        example: 'Kill Switch is grounded in inhibitory control and attentional shifting literature.',
    },
    {
        stage: 'Stage 2',
        name: 'Internal Reliability',
        color: '#60a5fa',
        criteria: 'Internal pilot data confirms the core metric is reliable. Test-retest reliability meets acceptable thresholds (r ≥ 0.70). Score distributions are not floor/ceiling-capped.',
        example: 'Kill Switch Recovery Time produces r = 0.78 across two sessions with 40 athletes.',
    },
    {
        stage: 'Stage 3',
        name: 'Discriminant Validity',
        color: '#c084fc',
        criteria: 'Data shows the sim differentiates meaningfully between athlete populations or predicts relevant performance differences. Scores correlate with expected outcomes.',
        example: 'Athletes with higher Kill Switch scores show faster refocus in game-film-coded disruption events.',
    },
    {
        stage: 'Stage 4',
        name: 'Published Validation',
        color: '#22c55e',
        criteria: 'Peer-reviewed publication confirms the sim\'s psychometric properties, normative data, and predictive validity in at least one target population.',
        example: 'Published paper with pre-registered analysis plan, N ≥ 100, and open data.',
    },
];

/* ---- ADDENDUM COVERAGE ---- */
const COVERAGE_ITEMS = [
    { section: 'Core Metric Precision', scope: 'How every metric is measured — response definitions, thresholds, windows' },
    { section: 'Session Validity', scope: 'When data is usable, partially usable, or invalid' },
    { section: 'Modifier Boundaries', scope: 'What modifiers can and cannot change without breaking family identity' },
    { section: 'Feedback Modes', scope: 'When to show and when to suppress performance data' },
    { section: 'Trial Standardization', scope: 'Fixed parameters and export requirements for assessments' },
    { section: 'Motor Confounds', scope: 'Design principles, device tracking, and motor baselines' },
    { section: 'Validation Roadmap', scope: 'Four-stage evidence progression for every family' },
    { section: 'Skill-Score Sourcing', scope: 'Multi-source requirements and pressure stratification' },
    { section: 'Variant / Promotion', scope: 'Reference to Promotion Protocol; boundary violation handling' },
];

/* ---- MAIN TAB ---- */
const SimSpecStandardsTab: React.FC = () => {
    return (
        <div className="space-y-10">
            {/* INTRO */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <Ruler className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">Sim Specification Standards Addendum</h2>
                        <p className="text-xs text-zinc-500">Addendum to the System Taxonomy &amp; Sim Specifications · March 2025</p>
                    </div>
                </div>
                <p className="text-sm text-zinc-300 max-w-4xl">
                    Shared measurement precision rules, fail conditions, trial standardization requirements, feedback mode definitions, motor confound protocols, and validation roadmap structure that apply to all Pulse Check sim family specifications.
                </p>
            </div>

            {/* 1. PURPOSE */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" /> 1. Purpose
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        This document defines the shared measurement standards, session logic, and research protocols that apply to <span className="text-white font-semibold">every</span> Pulse Check sim family specification. Individual sim specs define what is unique to each family: the mechanism, game flow, skill targets, and modifier behavior. This addendum defines what is <span className="text-white font-semibold">universal</span>.
                    </p>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                        <p className="text-xs text-amber-300 leading-relaxed">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            <span className="font-semibold">Governing rule:</span> Every sim spec should reference this addendum. When a precision rule defined here conflicts with a statement in an individual spec, this addendum governs.
                        </p>
                    </div>
                </div>
            </section>

            {/* 2. CORE METRIC MEASUREMENT PRECISION */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-green-400" /> 2. Core Metric Measurement Precision
                </h3>
                <p className="text-sm text-zinc-400">Every sim family has a core metric. The individual spec defines <em>what</em> is measured. This section defines <em>how</em> it is measured.</p>

                <CollapsibleSection title="2.1 Valid Response Definition" defaultOpen>
                    <div className="space-y-3">
                        {[
                            { label: 'Minimum Response Sequence', desc: 'A single correct input is not sufficient. Kill Switch requires 2 consecutive correct responses. Single-event sims (Signal Window, Brake Point) require 1 committed response.', color: '#60a5fa' },
                            { label: 'Minimum Reaction Time', desc: 'Any response faster than 150 ms is flagged as a motor artifact, not a cognitive response. Excluded from metric calculations and logged separately.', color: '#22c55e' },
                            { label: 'Maximum Response Window', desc: 'Each sim defines a maximum allowable response window. No valid response within this window → failed trial (Section 3).', color: '#c084fc' },
                            { label: 'False Start Definition', desc: 'A response that occurs before the valid response window opens. Kill Switch: response during disruption. Brake Point: response before Go stimulus. Logged separately, not counted toward core metric.', color: '#f59e0b' },
                        ].map((rule) => (
                            <div key={rule.label} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-black/20 p-3">
                                <div className="w-1.5 h-8 rounded-full flex-shrink-0 mt-0.5" style={{ background: rule.color }} />
                                <div>
                                    <p className="text-xs font-bold text-white">{rule.label}</p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{rule.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="2.2 Per-Family Measurement Rules">
                    <div className="overflow-x-auto border border-zinc-800 rounded-xl">
                        <table className="w-full text-xs min-w-[700px]">
                            <thead className="bg-black/30 text-zinc-500 uppercase text-[9px] tracking-wider">
                                <tr>
                                    <th className="text-left px-3 py-2">Family</th>
                                    <th className="text-left px-3 py-2">Min Sequence</th>
                                    <th className="text-left px-3 py-2">Min RT</th>
                                    <th className="text-left px-3 py-2">Max Window</th>
                                    <th className="text-left px-3 py-2">False Start</th>
                                </tr>
                            </thead>
                            <tbody>
                                {MEASUREMENT_RULES.map((row) => (
                                    <tr key={row.family} className="border-t border-zinc-800/50">
                                        <td className="px-3 py-2 font-semibold text-white">{row.family}</td>
                                        <td className="px-3 py-2 text-zinc-400">{row.minSequence}</td>
                                        <td className="px-3 py-2 text-zinc-400 font-mono">{row.minRT}</td>
                                        <td className="px-3 py-2 text-zinc-400">{row.maxWindow}</td>
                                        <td className="px-3 py-2 text-zinc-500">{row.falseStart}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[10px] text-zinc-600">Individual specs may override these with tighter rules but not looser ones.</p>
                </CollapsibleSection>

                <CollapsibleSection title="2.3 Product Targets vs. Research Benchmarks">
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                        <p className="text-xs text-zinc-300 leading-relaxed">
                            Performance targets in individual specs (e.g., Kill Switch Tier 1 targets recovery under 3 seconds) are <span className="text-amber-300 font-semibold">Pulse Check product progression thresholds</span>. They are not validated population norms.
                        </p>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Published research from Pulse Check studies will establish normative data over time. Until that data exists, all targets should be framed as <span className="text-white font-semibold">internal product standards</span> when referenced in external materials, proposals, or research documentation.
                        </p>
                    </div>
                </CollapsibleSection>
            </section>

            {/* 3. SESSION VALIDITY */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> 3. Session Validity and Fail Conditions
                </h3>
                <p className="text-sm text-zinc-400">Not every session produces usable data. These rules define when a session is valid, partially valid, or invalid.</p>

                <CollapsibleSection title="3.1 Trial-Level Outcomes" defaultOpen>
                    <div className="space-y-1.5">
                        {TRIAL_OUTCOMES.map((outcome) => (
                            <div key={outcome.label} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-black/20 px-4 py-3">
                                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: outcome.color }} />
                                <div>
                                    <p className="text-xs font-bold" style={{ color: outcome.color }}>{outcome.label}</p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">{outcome.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="3.2 Session-Level Validity" defaultOpen>
                    <div className="space-y-2">
                        {SESSION_VALIDITY.map((sv) => (
                            <div key={sv.status} className="rounded-xl border p-4" style={{ borderColor: sv.color + '30', background: sv.color + '05' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-xs font-bold" style={{ color: sv.color }}>{sv.status}</p>
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/30 border border-zinc-700 text-zinc-400">{sv.threshold}</span>
                                </div>
                                <p className="text-[10px] text-zinc-500">{sv.action}</p>
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="3.3 Retry Rules">
                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-zinc-400 leading-relaxed">Invalid sessions are preserved in the data log (never deleted) but do not count toward profile or trends.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-1">Daily Training</p>
                                <p className="text-[10px] text-zinc-400">No limit on retries.</p>
                            </div>
                            <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-1">Trial Mode</p>
                                <p className="text-[10px] text-zinc-400">Maximum 2 retries per assessment point. If all attempts are invalid → recorded as missing data.</p>
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="3.4 Dropout Handling">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                        If the athlete exits before completion, partial data is saved with a <span className="text-white font-semibold">dropout flag</span>. For daily training, partial sessions use the criteria above. For Trial mode, a dropout results in an invalid session and the athlete is offered a retry at the next available opportunity.
                    </p>
                </CollapsibleSection>
            </section>

            {/* 4. MODIFIER BOUNDARIES */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-400" /> 4. Modifier Boundary Rules
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3">
                        <p className="text-xs text-purple-300 font-semibold mb-1">The Boundary Principle</p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                            Modifiers change the <span className="text-white font-semibold">psychological context</span> of a sim without changing the underlying <span className="text-white font-semibold">mechanism</span>. If a modifier changes the mechanism, the sim is no longer the same family.
                        </p>
                    </div>

                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-500">Per-Family Boundaries</p>
                    <div className="space-y-2">
                        {MODIFIER_BOUNDARIES.map((mb) => (
                            <CollapsibleSection key={mb.family} title={mb.family}>
                                <p className="text-xs text-zinc-400 leading-relaxed">{mb.boundary}</p>
                            </CollapsibleSection>
                        ))}
                    </div>

                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                        <p className="text-[10px] text-amber-300 leading-relaxed">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            When Nora combines high-intensity modifiers across multiple dimensions, the session may cross family boundaries. In those cases, the session should be classified as a <span className="text-white font-semibold">hybrid module</span> and logged separately — not fed into any single family&apos;s core metric.
                        </p>
                    </div>
                </div>
            </section>

            {/* 5. FEEDBACK MODES */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" /> 5. Feedback Mode Rules
                </h3>
                <p className="text-sm text-zinc-400">Two feedback modes determine when and how performance data is shown during a session.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {FEEDBACK_MODES.map((fm) => (
                        <div key={fm.mode} className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ background: fm.color }} />
                                <h4 className="text-sm font-bold" style={{ color: fm.color }}>{fm.mode}</h4>
                            </div>
                            <p className="text-xs text-zinc-300 leading-relaxed">{fm.description}</p>
                            <div className="rounded-lg border border-zinc-700 bg-black/30 px-3 py-2">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-1">Rationale</p>
                                <p className="text-[10px] text-zinc-500 leading-relaxed">{fm.rationale}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 6. TRIAL STANDARDIZATION */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-cyan-400" /> 6. Trial Standardization Requirements
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        For any Trial-mode session to produce data that is comparable across athletes and time points, the following fixed parameters must be met. These rules apply to <span className="text-white font-semibold">any session intended for longitudinal comparison, pilot analysis, internal validation, or research export</span> — not only formal academic studies.
                    </p>

                    <CollapsibleSection title="6.1 Fixed Parameters" defaultOpen>
                        <div className="space-y-1.5">
                            {TRIAL_FIXED_PARAMS.map((param) => (
                                <div key={param} className="flex items-center gap-2">
                                    <CheckCircle2 className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                                    <p className="text-[10px] text-zinc-400">{param}</p>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="6.2 Trial Data Export Requirements">
                        <div className="space-y-2">
                            {[
                                { label: 'Raw Metric Data', items: 'Per-trial timestamps, response times, accuracy classifications, modifier conditions, stimulus identifiers' },
                                { label: 'Session Metadata', items: 'Sim family, variant, version, trial mode flag, date, time, device type, session duration' },
                                { label: 'Athlete Identifier', items: 'Anonymized study ID for research; internal athlete ID for product use' },
                                { label: 'Validity Status', items: 'Valid, partial, or invalid per Section 3' },
                            ].map((block) => (
                                <div key={block.label} className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                                    <p className="text-xs font-semibold text-white mb-0.5">{block.label}</p>
                                    <p className="text-[10px] text-zinc-500">{block.items}</p>
                                </div>
                            ))}
                            <p className="text-[10px] text-zinc-600">Export format: CSV or JSON with documented data dictionary.</p>
                        </div>
                    </CollapsibleSection>
                </div>
            </section>

            {/* 7. MOTOR CONFOUND PROTOCOL */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-amber-400" /> 7. Motor and Device Confound Protocol
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Pulse Check sims measure <span className="text-white font-semibold">cognitive-perceptual skills</span>, not motor speed or device proficiency. Because all sims require physical interaction with a device, some measured variance reflects motor execution rather than the target cognitive skill.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                            <p className="text-xs font-bold text-white mb-1">Design Principle</p>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">Minimize motor complexity. Use simple taps, swipes, binary selections. Measured variance should be dominated by cognitive processing.</p>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                            <p className="text-xs font-bold text-white mb-1">Device Tracking</p>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">Every session logs device type and input method. Research: treat as covariate. Product: Nora normalizes scores within device type.</p>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                            <p className="text-xs font-bold text-white mb-1">Motor Baseline</p>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">Brief reaction-time trials with no cognitive load at session start. Provides per-session motor speed estimate. Logged, not displayed to athlete.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 8. VALIDATION ROADMAP */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Map className="w-4 h-4 text-green-400" /> 8. Validation Roadmap Structure
                </h3>
                <p className="text-sm text-zinc-400">Every sim family must progress through four evidence stages. Stages are not permanent — if new data undermines a previously achieved stage, the sim is flagged for re-evaluation.</p>

                {/* Stage progress */}
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                    {VALIDATION_STAGES.map((vs, i) => (
                        <React.Fragment key={vs.stage}>
                            <div className="flex-shrink-0 rounded-xl border px-3 py-2 min-w-[140px]" style={{ borderColor: vs.color + '30', background: vs.color + '08' }}>
                                <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: vs.color }}>{vs.stage}</p>
                                <p className="text-[10px] text-zinc-400">{vs.name}</p>
                            </div>
                            {i < VALIDATION_STAGES.length - 1 && <span className="text-zinc-600 flex-shrink-0">→</span>}
                        </React.Fragment>
                    ))}
                </div>

                <div className="space-y-2">
                    {VALIDATION_STAGES.map((vs) => (
                        <div key={vs.stage} className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold" style={{ background: vs.color + '15', color: vs.color, border: `1px solid ${vs.color}30` }}>
                                    {vs.stage.split(' ')[1]}
                                </div>
                                <p className="text-sm font-bold text-white">{vs.name}</p>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed mb-2">{vs.criteria}</p>
                            <div className="rounded-lg border border-zinc-700 bg-black/30 px-3 py-2">
                                <p className="text-[9px] text-zinc-600"><span className="text-zinc-500 font-semibold">Example:</span> {vs.example}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 9. SKILL-SCORE SOURCING */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-purple-400" /> 9. Skill-Score Sourcing Standards
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <CollapsibleSection title="9.1 Multi-Source Requirement" defaultOpen>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            No skill score should be derived from a single raw metric alone. Each score must be sourced from <span className="text-white font-semibold">at least two raw metrics</span> or from one metric conditioned on a second factor. This prevents any single measurement artifact from dominating the score.
                        </p>
                        <div className="rounded-xl border border-zinc-700 bg-black/30 p-3 mt-2">
                            <p className="text-[10px] text-zinc-500 leading-relaxed">
                                <span className="text-zinc-400 font-semibold">Example:</span> Kill Switch&apos;s Attentional Shifting score uses both re-engagement latency (speed) <em>and</em> first-post-reset accuracy (completeness). Latency alone could be gamed by fast but inaccurate responding.
                            </p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="9.2 Pressure-Related Score Stratification">
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Any score claiming to measure <span className="text-white font-semibold">performance under pressure</span> must be derived from data stratified by modifier condition — not from overall session variance. Overall variance conflates pressure, fatigue, difficulty, and random variation.
                        </p>
                        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 mt-2">
                            <p className="text-[10px] text-green-300 leading-relaxed">
                                <span className="font-semibold">Correct approach:</span> Compare core metric under baseline (no pressure modifiers) vs. pressure conditions (evaluative threat active). The gap is the pressure-specific signal.
                            </p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="9.3 Cross-Cutting Modifier Score Sourcing">
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            The four cross-cutting modifier scores (Readiness, Consistency, Fatigability, Pressure Sensitivity) are composites fed by data from multiple families. Each family contributes based on recency, volume, and relevance. No single family should dominate unless the athlete has only trained with that family.
                        </p>
                    </CollapsibleSection>
                </div>
            </section>

            {/* 10. VARIANT CLASSIFICATION */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-blue-400" /> 10. Variant Classification and Promotion Protocol Reference
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                    <p className="text-sm text-zinc-300 leading-relaxed">Key rules from the Promotion Protocol that apply to all sim specs:</p>
                    <div className="space-y-1.5">
                        {[
                            'Variants inherit the parent family\'s mechanism, core metric, and profile slot. Scores contribute to the parent composite.',
                            'Nora monitors all variants for divergence. If data diverges beyond thresholds, she sends a New Family Candidate email.',
                            'Promotion requires 50 unique athlete completions and a formal distinctness analysis.',
                            'Modifier boundary violations (Section 4) may trigger reclassification as a hybrid module.',
                        ].map((rule) => (
                            <div key={rule} className="flex items-start gap-2">
                                <CheckCircle2 className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                                <p className="text-[10px] text-zinc-400 leading-relaxed">{rule}</p>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-lg border border-zinc-700 bg-black/30 px-3 py-2">
                        <p className="text-[10px] text-zinc-500">The full Sim Family Promotion Protocol is maintained as a separate document and should be consulted for all variant evaluation, candidate incubation, and promotion decisions.</p>
                    </div>
                </div>
            </section>

            {/* SUMMARY COVERAGE TABLE */}
            <section className="space-y-4 pb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyan-400" /> Addendum Coverage Summary
                </h3>
                <div className="overflow-x-auto border border-zinc-800 rounded-2xl">
                    <table className="w-full text-sm min-w-[500px]">
                        <thead className="bg-black/20 text-zinc-500 uppercase text-[9px] tracking-wider">
                            <tr>
                                <th className="text-left px-4 py-2.5">Section</th>
                                <th className="text-left px-4 py-2.5">Scope</th>
                            </tr>
                        </thead>
                        <tbody>
                            {COVERAGE_ITEMS.map((item) => (
                                <tr key={item.section} className="border-t border-zinc-800/50">
                                    <td className="px-4 py-2.5 text-xs font-semibold text-white whitespace-nowrap">{item.section}</td>
                                    <td className="px-4 py-2.5 text-xs text-zinc-400">{item.scope}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                    <p className="text-xs text-blue-300 leading-relaxed">
                        This addendum applies to all current and future Pulse Check sim family specifications. Individual specs should reference this document by name. When precision rules defined here conflict with statements in an individual spec, <span className="text-white font-semibold">this addendum governs</span>.
                    </p>
                </div>
            </section>
        </div>
    );
};

export default SimSpecStandardsTab;
