import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    FileText,
    GitMerge,
    Cpu,
    BarChart3,
    ChevronDown,
    ChevronRight,
    ArrowRight,
    CheckCircle2,
    XCircle,
    Search,
    Hammer,
    LineChart,
    Award,
    Eye,
    AlertTriangle,
    RotateCcw,
    Tag,
    Compass,
    BookOpen,
    SlidersHorizontal,
    ClipboardList,
    Layers,
    RefreshCw,
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

/* ---- GOVERNING PRINCIPLES ---- */
const GOVERNING_PRINCIPLES = [
    { principle: 'Evidence over intuition', detail: 'Promotion decisions should be grounded in measured distinctness, not novelty, enthusiasm, or naming.' },
    { principle: 'Distinct is necessary but not sufficient', detail: 'A candidate must be meaningfully different and important enough to merit its own profile line, programming logic, and validation roadmap.' },
    { principle: 'Nora detects; humans decide', detail: 'Nora automates monitoring, analysis, and recommendations. The team remains the final decision-maker.' },
    { principle: 'Profiles stay clean during evaluation', detail: 'Candidates live inside an existing family until promotion is approved.' },
    { principle: 'Thresholds guide governance, not truth', detail: 'Initial thresholds are operating standards and may be recalibrated as the athlete dataset matures.' },
    { principle: 'The taxonomy is a living system', detail: 'Variants can be re-flagged, families can be merged, and standards can be refined through governed review.' },
];

/* ---- LIFECYCLE STATUSES ---- */
const LIFECYCLE_STATUSES = [
    { status: 'Nominated', color: '#94a3b8', description: 'Proposed by team via team nomination. Spec template submitted.' },
    { status: 'Flagged', color: '#f59e0b', description: 'Identified by Nora via divergence detection. Awaiting team review.' },
    { status: 'In Evaluation', color: '#60a5fa', description: 'Deployed in live environment. Scoring under parent family. Shadow metrics being tracked.' },
    { status: 'Promotion Report Issued', color: '#c084fc', description: 'Data threshold reached. Nora has generated the distinctness analysis.' },
    { status: 'Promoted', color: '#22c55e', description: 'Locked as a new family in the taxonomy. Own profile slot, own programming logic.' },
    { status: 'Classified as Variant', color: '#fb923c', description: 'Permanently filed under parent family. Scores contribute to parent composite.' },
    { status: 'Dismissed', color: '#ef4444', description: 'Flag reviewed and dismissed as artifact (small sample, data quality issue).' },
];

/* ---- PHASE DATA ---- */
const EVALUATION_PHASES = [
    {
        phase: 'Phase 1',
        icon: Search,
        title: 'Spec Review',
        color: '#60a5fa',
        checkpoints: [
            { name: 'Mechanism Articulation', desc: 'Can the candidate\'s mechanism be stated in one sentence that remains clearly different from every locked family?' },
            { name: 'Metric Independence', desc: 'Does the candidate propose a core metric that is not already the primary output of an existing family?' },
            { name: 'Profile Value Hypothesis', desc: 'Can the team name a concrete situation where the candidate\'s score would tell an athlete or coach something the current profile would not?' },
            { name: 'Importance Test', desc: 'Even if distinct, is the candidate important enough to justify a new profile line, Nora programming branch, and validation burden?' },
        ],
        outcome: 'Candidates that fail any checkpoint should be classified as variants under the closest existing family, with the rationale documented.',
    },
    {
        phase: 'Phase 2',
        icon: Hammer,
        title: 'Build and Deploy',
        color: '#c084fc',
        checkpoints: [
            { name: 'Live Availability', desc: 'Candidate assigned through Nora\'s normal programming logic when the athlete profile suggests the relevant skill needs work.' },
            { name: 'Transparent Experience', desc: 'The athlete sees the candidate as part of normal training; no new profile line appears during evaluation.' },
            { name: 'Shadow Scoring', desc: 'Observed score contributes to the provisional parent family in the visible profile. Nora tracks a shadow score separately.' },
            { name: 'Internal Tracking', desc: 'Candidate receives an internal lifecycle status and an evaluation start timestamp.' },
        ],
        outcome: 'No special recruitment needed. Evaluation runs on organic usage data.',
    },
    {
        phase: 'Phase 3',
        icon: LineChart,
        title: 'Data Threshold and Distinctness Analysis',
        color: '#22c55e',
        checkpoints: [
            { name: 'Correlation Score', desc: 'Correlation between the candidate core metric and the parent family core metric. Primary distinctness indicator.' },
            { name: 'Profile Divergence Rate', desc: 'Percentage of athletes whose normalized scores split meaningfully across the two.' },
            { name: 'Divergence Direction Analysis', desc: 'Parent-strong/candidate-weak, parent-weak/candidate-strong, or bidirectional.' },
            { name: 'Coaching Insight Examples', desc: 'Anonymized athlete cases where the candidate reveals something the parent score alone would hide.' },
            { name: 'Context Notes', desc: 'Sport, level, readiness state, or modifier conditions if those factors materially affect interpretation.' },
        ],
        outcome: 'Candidate remains in evaluation until minimum qualifying data threshold is reached. Nora generates a Promotion Report.',
    },
    {
        phase: 'Phase 4',
        icon: Award,
        title: 'Promotion Decision',
        color: '#f59e0b',
        checkpoints: [
            { name: 'Review Report', desc: 'Team reviews Nora\'s Promotion Report and any strategic, scientific, or product considerations.' },
            { name: 'Architectural Weight Test', desc: 'Does this candidate deserve a new family because it is distinct, important, interpretable, and valuable enough to justify permanent architectural weight?' },
            { name: 'Final Decision', desc: 'Promotion requires more than statistical separation — the team makes the final call.' },
        ],
        outcome: 'Team is final decision-maker. Promotion requires distinctness, importance, interpretability, and value.',
    },
];

/* ---- DIVERGENCE SIGNALS ---- */
const DIVERGENCE_SIGNALS = [
    {
        signal: 'Signal 1: Low Correlation',
        threshold: 'Below active operating threshold',
        icon: '📉',
        description: 'If the variant\'s core metric correlates below the active operating threshold with the parent family\'s core metric across the same athlete cohort, the variant may be tapping a distinct ability.',
    },
    {
        signal: 'Signal 2: Profile Divergence',
        threshold: 'Exceeds active operating threshold',
        icon: '📊',
        description: 'If the share of athletes showing a meaningful split between parent and variant scores exceeds the active operating threshold, the variant may be generating coaching-relevant information the parent family does not capture.',
    },
    {
        signal: 'Signal 3: Persistent Directional Mismatch',
        threshold: 'Sustained across review cycles',
        icon: '🔄',
        description: 'If divergence stays concentrated within a specific athlete subgroup or context window over multiple review cycles, Nora flags the pattern for human review even when the global signal is borderline.',
    },
];

/* ---- THRESHOLD REVIEW RULES ---- */
const THRESHOLD_REVIEW_RULES = [
    'First formal threshold review occurs after 500 valid athlete-sessions across the system. Subsequent reviews occur every 1,000 valid athlete-sessions or quarterly, whichever comes first.',
    'A valid athlete-session means one completed sim session that meets the active Sim Specification Standards Addendum validity rules. Invalid sessions do not count toward threshold-review cadence.',
    'Threshold updates are reviewed on a fixed cadence, such as quarterly or every major data milestone.',
    'Changes are versioned (for example: Protocol v1.0, v1.1, v1.2) so historical promotion decisions remain auditable.',
    'A recommendation should only move forward when it is stable across multiple review windows and supported by sufficient sample size.',
    'Recommended threshold changes should include uncertainty bounds or equivalent stability evidence and should not advance when cohort-level sample sizes are too small to support reliable interpretation.',
    'The default system uses one global threshold set. Context-specific thresholds by sport cluster, athlete level, sim class, or trial mode may be introduced later only when stable evidence shows the global standard is systematically misfitting those contexts.',
    'Approved threshold changes become active only after human sign-off.',
    'Every approved threshold update must create an audit log recording the prior threshold set, the new threshold set, the reason for change, the approving reviewer(s), the supporting evidence window, and the effective date.',
];

/* ---- MAIN TAB ---- */
const PromotionProtocolTab: React.FC = () => {
    return (
        <div className="space-y-10">
            {/* INTRO */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <Shield className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-purple-400 font-bold">PULSE CHECK</p>
                        <h2 className="text-xl font-semibold">Sim Family Promotion Protocol</h2>
                        <p className="text-xs text-zinc-500">System protocol addendum · governance refinement v2.1</p>
                    </div>
                </div>
                <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3 mt-2 max-w-4xl">
                    <p className="text-[10px] text-zinc-400 leading-relaxed italic">
                        Supersedes v2 with final operational clarifications on threshold review cadence, valid session counting, stability requirements, context-specific threshold governance, and audit logging.
                    </p>
                </div>
            </div>

            {/* 1. PURPOSE */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" /> 1. Purpose
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        The Pulse Check System Taxonomy defines what a sim family <em className="text-white">is</em>: a distinct training mechanism that targets a named skill, produces a unique core metric, and earns its own place in the athlete profile. This protocol defines how new families come into existence, how candidates are evaluated against existing families, and how the taxonomy stays disciplined as the system grows.
                    </p>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                        <p className="text-xs text-amber-300 leading-relaxed">
                            <span className="font-semibold">Why this matters:</span> Families are expensive. Every new family adds scoring surface area, programming complexity for Nora, coaching interpretation burden, and validation obligations. Variants are cheap — they create training variety without adding architectural weight. A sim should only become a family when the evidence shows it is measuring something existing families do not already capture.
                        </p>
                    </div>
                </div>
            </section>

            {/* 2. GOVERNING PRINCIPLES */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-400" /> 2. Governing Principles
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {GOVERNING_PRINCIPLES.map((gp) => (
                        <div key={gp.principle} className="bg-[#090f1c] border border-zinc-800 rounded-xl px-4 py-3 space-y-1">
                            <p className="text-xs font-bold text-white">{gp.principle}</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">{gp.detail}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* 3. ENTRY PATHWAYS */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <GitMerge className="w-4 h-4 text-purple-400" /> 3. Entry Pathways Into the Pipeline
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 3.1 Team Nomination */}
                    <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">3.1</div>
                            <h4 className="text-sm font-bold text-white">Team Nomination</h4>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Any member of the team may nominate a candidate family based on research, product insight, athlete feedback, coaching requests, or competitive intelligence.
                        </p>
                        <div className="rounded-xl border border-zinc-700 bg-black/30 px-3 py-2 space-y-1">
                            <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Required to Enter Pipeline</p>
                            {[
                                'Completed Sim Specification Template (primary pillar, target skill, mechanism, scientific basis, core metric, modifier compatibility, difficulty progression)',
                                'Distinctness argument identifying closest locked family and what the candidate measures differently',
                                'Profile value hypothesis describing a specific coaching/athlete scenario where the candidate reveals something actionable',
                            ].map((req) => (
                                <div key={req} className="flex items-start gap-1.5">
                                    <CheckCircle2 className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-zinc-400">{req}</p>
                                </div>
                            ))}
                        </div>
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                            <p className="text-[10px] text-red-300">
                                <XCircle className="w-3 h-3 inline mr-1" />
                                Nominations that cannot complete the spec or articulate a distinctness argument do not enter the pipeline. They should be filed as proposed variants under the closest existing family.
                            </p>
                        </div>
                    </div>

                    {/* 3.2 Nora Divergence Detection */}
                    <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-xs font-bold text-green-400">3.2</div>
                            <h4 className="text-sm font-bold text-white">Nora Divergence Detection</h4>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Nora continuously monitors performance patterns across active variants. When a variant begins behaving unlike its provisional parent family, Nora can flag it as a New Family Candidate.
                        </p>
                        <div className="rounded-xl border border-zinc-700 bg-black/30 px-3 py-2">
                            <p className="text-[10px] text-zinc-400">
                                <span className="font-semibold text-zinc-300">Minimum observation floor:</span> 30 unique athlete completions before a variant is eligible for automated divergence detection.
                            </p>
                        </div>
                        <div className="space-y-2">
                            {DIVERGENCE_SIGNALS.map((sig) => (
                                <div key={sig.signal} className="rounded-xl border border-zinc-700 bg-black/20 p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm">{sig.icon}</span>
                                        <p className="text-[10px] font-bold text-white">{sig.signal}</p>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono">{sig.threshold}</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 leading-relaxed">{sig.description}</p>
                                </div>
                            ))}
                        </div>
                        <div className="rounded-xl border border-zinc-700 bg-black/30 px-3 py-2">
                            <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1">Nora&apos;s Alert Includes</p>
                            <p className="text-[10px] text-zinc-400">
                                Variant name, current parent family, qualifying athlete count, correlation score, divergence rate, anonymized example splits, and Nora&apos;s provisional hypothesis about the distinct mechanism.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. PROVISIONAL PARENT-FAMILY ASSIGNMENT */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" /> 4. Provisional Parent-Family Assignment
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Every candidate in evaluation must have a provisional parent family because the candidate&apos;s shadow score is compared against a specific existing family.
                    </p>
                    <div className="space-y-2">
                        {[
                            { label: 'Team nominations', detail: 'The nominating team member proposes the closest parent family in the spec.' },
                            { label: 'Nora-generated flags', detail: 'Nora recommends the closest parent family based on mechanism similarity, metric overlap, and current score behavior.' },
                            { label: 'Confirmation', detail: 'The product/research review group confirms the provisional parent before a candidate enters evaluation.' },
                            { label: 'Dual comparison', detail: 'If two parent families are plausible, the team should record the primary comparison family and the secondary comparison family. The primary governs shadow scoring; the secondary can be included in the Promotion Report for sanity checking.' },
                        ].map((item) => (
                            <div key={item.label} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-black/20 p-3">
                                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-indigo-400" />
                                <div>
                                    <p className="text-xs font-semibold text-white">{item.label}</p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">{item.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 5. EVALUATION PIPELINE */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-green-400" /> 5. Evaluation Pipeline
                </h3>
                <p className="text-sm text-zinc-400">Once a candidate enters through either pathway, it follows the same four-phase process.</p>

                {/* Phase progress bar */}
                <div className="flex items-center gap-0.5 overflow-x-auto pb-2">
                    {EVALUATION_PHASES.map((phase, i) => {
                        const Icon = phase.icon;
                        return (
                            <React.Fragment key={phase.phase}>
                                <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ borderColor: phase.color + '30', background: phase.color + '08' }}>
                                    <Icon className="w-4 h-4" style={{ color: phase.color }} />
                                    <div>
                                        <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: phase.color }}>{phase.phase}</p>
                                        <p className="text-[10px] text-zinc-400">{phase.title}</p>
                                    </div>
                                </div>
                                {i < EVALUATION_PHASES.length - 1 && <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />}
                            </React.Fragment>
                        );
                    })}
                </div>

                <div className="space-y-3">
                    {EVALUATION_PHASES.map((phase) => {
                        const Icon = phase.icon;
                        return (
                            <div key={phase.phase} className="bg-[#090f1c] border border-zinc-800 rounded-2xl overflow-hidden">
                                <div className="px-5 py-4 flex items-center gap-3 border-b border-zinc-800/60" style={{ background: phase.color + '05' }}>
                                    <div className="p-2 rounded-xl border" style={{ borderColor: phase.color + '30', background: phase.color + '15' }}>
                                        <Icon className="w-4 h-4" style={{ color: phase.color }} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white">{phase.phase}: {phase.title}</h4>
                                    </div>
                                </div>
                                <div className="px-5 py-4 space-y-2">
                                    {phase.checkpoints.map((cp) => (
                                        <div key={cp.name} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-black/20 p-3">
                                            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: phase.color }} />
                                            <div>
                                                <p className="text-xs font-semibold text-white">{cp.name}</p>
                                                <p className="text-[10px] text-zinc-500 mt-0.5">{cp.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 mt-2">
                                        <p className="text-[10px] text-zinc-400"><span className="font-semibold text-zinc-300">Outcome:</span> {phase.outcome}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* 6. SCORING BEHAVIOR DURING EVALUATION */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Eye className="w-4 h-4 text-cyan-400" /> 6. Scoring Behavior During Evaluation
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        While a candidate is in evaluation, its scores contribute to the provisional parent family&apos;s visible composite score. Nora simultaneously maintains a shadow score that is never shown to the athlete and is used only for distinctness analysis.
                    </p>
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
                        <p className="text-xs text-cyan-300 font-semibold mb-1">Shadow Score</p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                            Nora maintains a separate internal metric tracked but never displayed to the athlete. This shadow score powers the distinctness analysis. It exists only in Nora&apos;s analytical layer until a promotion decision is made.
                        </p>
                    </div>
                    <CollapsibleSection title="6.1 On Promotion — Score Separation">
                        <div className="space-y-1.5">
                            {[
                                'The candidate receives a permanent taxonomy slot with a locked mechanism, skill target, and core metric.',
                                'Historical candidate data is retroactively separated from the parent family and assigned to the new family line.',
                                'The parent family composite is recalculated to preserve profile accuracy.',
                                'Nora begins programming the promoted family independently.',
                            ].map((item) => (
                                <div key={item} className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 mt-1.5" />
                                    <p className="text-[10px] text-zinc-400 leading-relaxed">{item}</p>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>
                    <CollapsibleSection title="6.2 On Variant Classification — Scores Remain">
                        <div className="space-y-1.5">
                            {[
                                'The candidate stays permanently inside the parent family.',
                                'The shadow score is archived for audit and future review but does not surface in the athlete profile.',
                                'The candidate remains assignable for variety and engagement, but not as a separate skill target.',
                            ].map((item) => (
                                <div key={item} className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                                    <p className="text-[10px] text-zinc-400 leading-relaxed">{item}</p>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>
                </div>
            </section>

            {/* 7. ADAPTIVE THRESHOLD GOVERNANCE */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-amber-400" /> 7. Adaptive Threshold Governance
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Thresholds should not be frozen forever. They should begin as fixed operating standards, then be reviewed and recalibrated through a governed process as the athlete dataset grows.
                    </p>

                    <CollapsibleSection title="7.1 Threshold Recommendation Engine" defaultOpen={true}>
                        <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                            Nora may automatically generate threshold recommendations, but should not silently change live governance rules in production.
                        </p>
                        <div className="space-y-1.5">
                            {[
                                'Monitor the distribution of family-to-variant correlations, divergence rates, and merger signals over time.',
                                'Estimate false-promotion and false-non-promotion patterns using retrospective decision review.',
                                'Check whether threshold behavior varies materially by sport cluster, athlete level, session type, or major modifier context.',
                                'Detect data drift or population shifts that make the current thresholds too permissive or too strict.',
                            ].map((item) => (
                                <div key={item} className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                                    <p className="text-[10px] text-zinc-400 leading-relaxed">{item}</p>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="7.2 Review and Rollout Rules" defaultOpen={true}>
                        <div className="space-y-1.5">
                            {THRESHOLD_REVIEW_RULES.map((rule) => (
                                <div key={rule} className="flex items-start gap-2">
                                    <CheckCircle2 className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-zinc-400 leading-relaxed">{rule}</p>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>

                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                        <p className="text-xs text-amber-300 leading-relaxed italic">
                            <span className="font-semibold">Protocol statement:</span> Thresholds are initial operating standards. Pulse Check may recommend recalibration as the athlete dataset matures, but threshold updates are versioned, reviewed against valid athlete-session volume, and approved before deployment.
                        </p>
                    </div>
                </div>
            </section>

            {/* 8. CANDIDATE LIFECYCLE STATUSES */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-400" /> 8. Candidate Lifecycle Statuses
                </h3>
                <p className="text-sm text-zinc-400">Every candidate carries a status tag visible internally but not to athletes.</p>
                <div className="space-y-2">
                    {LIFECYCLE_STATUSES.map((s) => (
                        <div key={s.status} className="flex items-start gap-3 bg-[#090f1c] border border-zinc-800 rounded-xl px-4 py-3">
                            <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: s.color }} />
                            <div>
                                <p className="text-xs font-bold" style={{ color: s.color }}>{s.status}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">{s.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 9. ONGOING MONITORING */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-cyan-400" /> 9. Ongoing Monitoring After Classification
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                            <h4 className="text-xs font-bold text-amber-400 mb-2">Variants Can Be Re-Flagged</h4>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">
                                If new data shows that a previously locked variant is diverging from its parent family, Nora re-flags it for review. The team decides whether to re-enter the evaluation pipeline.
                            </p>
                        </div>
                        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                            <h4 className="text-xs font-bold text-purple-400 mb-2">Families Can Be Flagged for Merger</h4>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">
                                When sustained high overlap suggests two families may no longer be measuring distinct abilities, they can be flagged for merger.
                            </p>
                        </div>
                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                            <h4 className="text-xs font-bold text-blue-400 mb-2">Threshold Recommendations Updated</h4>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">
                                Threshold recommendations can be updated as the population grows and the taxonomy matures.
                            </p>
                        </div>
                        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                            <h4 className="text-xs font-bold text-green-400 mb-2">Coaching Impact Review</h4>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">
                                Major merger or separation decisions should include coaching impact review, not just statistical overlap.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 10. OPERATIONAL SUMMARY */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-green-400" /> 10. Operational Summary
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-2">
                    {[
                        'A candidate enters through team nomination or Nora divergence detection.',
                        'The team reviews the candidate for mechanism clarity, metric independence, profile value, and importance.',
                        'The candidate is deployed as part of normal training and scored in shadow mode against a provisional parent family.',
                        'After enough comparable athlete data accumulates, Nora generates a Promotion Report.',
                        'The team either promotes the candidate into its own family or locks it as a variant.',
                        'Nora keeps monitoring the system so the taxonomy can adapt without becoming noisy or unstable.',
                    ].map((step, i) => (
                        <div key={step} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-black/20 p-3">
                            <div className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-[9px] font-bold text-green-400">{i + 1}</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">{step}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* APPENDIX A */}
            <section className="space-y-4 pb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-zinc-400" /> Appendix A — Suggested Initial Operating Standards
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Use these as initial defaults unless superseded by the active protocol version.
                    </p>
                    <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
                        <p className="text-[10px] text-zinc-400 leading-relaxed italic">
                            These defaults are operating standards, not scientific truths. They are expected to become more precise as Pulse Check accumulates broader athlete data.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default PromotionProtocolTab;
