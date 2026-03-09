import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain,
    Shield,
    Crosshair,
    Eye,
    TreePine,
    Zap,
    FlaskConical,
    Layers,
    ChevronDown,
    ChevronRight,
    GitBranch,
    Lightbulb,
    Shuffle,
    Lock,
    Beaker,
    Telescope,
    ArrowDown,
    Monitor,
    User,
    Megaphone,
} from 'lucide-react';

/* ---- COLLAPSIBLE ---- */
function CollapsibleSection({ title, defaultOpen = false, accent, children }: { title: string; defaultOpen?: boolean; accent?: string; children: React.ReactNode }) {
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

/* ---- TIER BADGE ---- */
function TierBadge({ tier }: { tier: 'locked' | 'candidate' | 'exploratory' | 'variant' }) {
    const config: Record<string, { color: string; label: string }> = {
        locked: { color: '#22c55e', label: 'Locked' },
        candidate: { color: '#f59e0b', label: 'Candidate' },
        exploratory: { color: '#94a3b8', label: 'Exploratory' },
        variant: { color: '#60a5fa', label: 'Variant' },
    };
    const c = config[tier];
    return (
        <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border font-bold" style={{ color: c.color, borderColor: c.color + '40', background: c.color + '10' }}>
            {c.label}
        </span>
    );
}

/* ---- DATA ---- */
interface LockedFamily {
    name: string;
    pillar: 'focus' | 'composure' | 'decision';
    mechanism: string;
    coreMetric: string;
    description: string;
    variants: string[];
}

const LOCKED_FAMILIES: LockedFamily[] = [
    {
        name: 'The Kill Switch',
        pillar: 'composure',
        mechanism: 'Inhibition under pressure, error recovery speed, and attentional shifting after disruption',
        coreMetric: 'Post-error recovery time (ms to first clean rep after disruption)',
        description: 'Three-phase loop: sustained attention task → unpredictable disruption → recognize, inhibit reflex, recover goal-directed focus. Measures how quickly and completely the athlete recovers.',
        variants: ['Visual disruption Kill Switch', 'Audio disruption Kill Switch', 'Cognitive-provocation Kill Switch', 'Combined-channel Kill Switch', 'Short daily Kill Switch (3–5 min)', 'Extended Trial Kill Switch (10–15 min)', 'Sport-context Kill Switch (basketball, tennis, etc.)', 'Immersive Reset Chamber (Vision Pro)'],
    },
    {
        name: 'Noise Gate',
        pillar: 'focus',
        mechanism: 'Selective attention under escalating irrelevant stimuli',
        coreMetric: 'Distractor Cost — accuracy & speed penalty from distractors vs. baseline',
        description: 'Maintain focus on a primary task stream while the system introduces escalating irrelevant stimuli competing for attention. Directly targets goal-directed vs. stimulus-driven attentional balance.',
        variants: ['Visual clutter Noise Gate', 'Crowd-noise Noise Gate', 'Mixed-channel Noise Gate', 'Peripheral bait Noise Gate', 'Fatigue-state Noise Gate', 'Immersive Crowd Tunnel (Vision Pro)'],
    },
    {
        name: 'Brake Point',
        pillar: 'decision',
        mechanism: 'Response inhibition and impulsive over-commitment',
        coreMetric: 'Stop Latency — how quickly the athlete cancels an initiated response',
        description: 'Rapid-fire stimulus stream: respond to targets, withhold on near-targets. Speed increases progressively, testing the point at which inhibition breaks. Maps to Miyake et al. separable executive function.',
        variants: ['Go/no-go Brake Point', 'Fakeout Brake Point', 'False-start Brake Point', 'Spatial cancel Brake Point', 'High-stakes inhibition Brake Point', 'Immersive Spatial Brake (Vision Pro)'],
    },
    {
        name: 'Signal Window',
        pillar: 'decision',
        mechanism: 'Cue discrimination under time pressure',
        coreMetric: 'Accuracy + latency under time pressure (distinguishes fast readers from accurate readers from athletes who can do both)',
        description: 'Brief, information-rich displays where the athlete identifies the correct read before the window closes. Information completeness and display time decrease with progression. Strong sport-transfer potential.',
        variants: ['Ambiguous cue Signal Window', 'Decoy cue Signal Window', 'Shot-clock Signal Window', 'Rapid recognition Signal Window', 'Spatial read Signal Window', 'Field-read Trial Signal Window'],
    },
    {
        name: 'Sequence Shift',
        pillar: 'decision',
        mechanism: 'Working-memory updating and shift cost under pressure',
        coreMetric: 'Accuracy on trials immediately following a rule change (shift cost, not overall accuracy)',
        description: 'Rule set changes at defined or unpredictable intervals — athlete must update active strategy and suppress the previous one. Relevant for audibles, play changes, and tactical mid-execution adjustments.',
        variants: ['Pattern-change Sequence Shift', 'Dual-rule Sequence Shift', 'Late-audible Sequence Shift', 'Sequence-memory Sequence Shift', 'Sport-playbook Sequence Shift'],
    },
    {
        name: 'Endurance Lock',
        pillar: 'focus',
        mechanism: 'Fatigability, consistency, and late-session deterioration',
        coreMetric: 'Degradation slope — rate of performance decline over time, not just average',
        description: 'Extended-duration assessment and stress-testing tool. Captures the difference between an athlete who maintains 90% for 8 min then drops to 60%, vs. one who declines steadily. Duration as a measurement variable.',
        variants: ['Sustained-focus Endurance Lock', 'Late-pressure Endurance Lock', 'Clutter-fatigue Endurance Lock', 'Long-reset Endurance Lock', 'Trial-only fatigability probe'],
    },
];

interface CandidateFamily {
    name: string;
    pillar: 'focus' | 'composure' | 'decision';
    distinctionFrom: string;
    mechanism: string;
    coreMetric: string;
    description: string;
    promotionCriteria: string;
    variants: string[];
}

const CANDIDATE_FAMILIES: CandidateFamily[] = [
    {
        name: 'Fault Line',
        pillar: 'composure',
        distinctionFrom: 'Kill Switch',
        mechanism: 'Recovering from self-generated errors (not external disruption)',
        coreMetric: 'Error cascade rate — how quickly one mistake triggers additional mistakes',
        description: 'Kill Switch = recovering from something that happens to you. Fault Line = recovering from your own failure. The emotional load includes self-blame, frustration, and rumination. Trains breaking the error-cascade chain.',
        promotionCriteria: 'Correlation below 0.5 with Kill Switch core metric across 50+ athletes; bidirectional divergence in athlete profiles',
        variants: ['Tilt Test', 'Bounce Back', 'Next Play', 'Error spiral', 'Post-miss reset'],
    },
    {
        name: 'Split Stream',
        pillar: 'focus',
        distinctionFrom: 'Noise Gate',
        mechanism: 'Divided attention — monitoring multiple relevant sources simultaneously',
        coreMetric: 'Stream-switch cost & channel neglect index',
        description: 'Noise Gate = filtering one signal from distractors (narrow attention). Split Stream = monitoring multiple relevant sources and allocating attention across them (broad-external width per Nideffer).',
        promotionCriteria: 'Low correlation with Noise Gate; athletes who excel at filtering may struggle with multi-stream monitoring and vice versa',
        variants: ['Multi-Source', 'Priority Stack', 'Dual-channel monitoring', 'Rotating-source load'],
    },
    {
        name: 'Blind Commit',
        pillar: 'decision',
        distinctionFrom: 'Signal Window',
        mechanism: 'Committing to action with incomplete information',
        coreMetric: 'Confidence-accuracy calibration — gap between confidence and actual accuracy',
        description: 'Signal Window = reading the cue correctly. Blind Commit = committing when the read is inherently incomplete. Separates confident-but-wrong from accurate-but-hesitant — both actionable coaching insights.',
        promotionCriteria: 'Novel metric (confidence calibration) diverges from d-prime; distinct coaching insights in 25%+ of profiles',
        variants: ['Partial-information commit', 'Late-reveal commit', 'Forced-commit under timer', 'Confidence-check commit'],
    },
    {
        name: 'Heat Check',
        pillar: 'composure',
        distinctionFrom: 'Kill Switch',
        mechanism: 'Maintaining output as evaluative stakes escalate (not recovery from disruption)',
        coreMetric: 'Output variance and accuracy delta as evaluative intensity increases',
        description: 'Kill Switch = recovery from disruption. Heat Check = performance under mounting pressure where stakes increase. The athlete is not disrupted — they are pressured. Environment gets louder, scoring more visible, consequences more real.',
        promotionCriteria: 'Distinct pressure-response profile; athletes with strong Kill Switch may still degrade under escalating stakes',
        variants: ['Public Eye', 'Last Play', 'Score-on-the-line', 'Ranking pressure', 'Coach-watch mode'],
    },
    {
        name: 'Chaos Read',
        pillar: 'decision',
        distinctionFrom: 'Noise Gate + Signal Window',
        mechanism: 'Simultaneous filtering and reading under ambiguity',
        coreMetric: 'Composite accuracy under simultaneous filter + read demands',
        description: 'Hypothesis: the simultaneous demand of filtering and reading under ambiguity creates a distinct cognitive load that neither Noise Gate nor Signal Window captures independently. Closest sport analog: cluttered, time-compressed game-state read.',
        promotionCriteria: 'Performance diverges from both Noise Gate and Signal Window independently; unique cognitive load profile confirmed',
        variants: ['Blindside read', 'Clutter-to-choice', 'Reset and Read', 'Compressed chaos'],
    },
    {
        name: 'Quiet Eye',
        pillar: 'focus',
        distinctionFrom: 'Signal Window / Chaos Read',
        mechanism: 'Gaze stabilization and pre-action attentional anchoring',
        coreMetric: 'Fixation duration and stability on correct target in the pre-action window',
        description: 'Tightly scoped around gaze-stabilization literature. About holding attentional fixation on the right target in the moment before action. Must stay narrow — not absorb general anticipation tasks.',
        promotionCriteria: 'Distinct from cue-discrimination metrics; novel predictive value for pre-action performance quality',
        variants: ['Pre-shot lock', 'Gaze hold', 'Anticipatory anchor', 'Fixation under pressure'],
    },
];

interface HybridModule {
    name: string;
    families: string;
    description: string;
}

const HYBRID_MODULES: HybridModule[] = [
    { name: 'Overload', families: 'Sequence Shift + Noise Gate + Heat Check', description: 'Working memory, selective attention, and pressure stability all stacking together.' },
    { name: 'Recovery Chain', families: 'Kill Switch + Sequence Shift', description: 'Multiple disruption-reengagement cycles with changing rules between rounds.' },
    { name: 'Noise to Choice', families: 'Noise Gate → Signal Window', description: 'Starts as a filtering task, ends as a decision task.' },
    { name: 'Two-Minute Drill', families: 'Signal Window + Brake Point + Heat Check', description: 'Compressed-duration, high-consequence module combining cue reading, inhibition, and pressured performance.' },
    { name: 'Last Rep', families: 'Endurance Lock + Heat Check', description: 'Longest duration, hardest rounds at the end.' },
    { name: 'Pressure Room', families: 'Trial expression (Vision Pro)', description: 'Immersive composure assessment with sound, spatial complexity, and evaluative pressure.' },
    { name: 'Field Mirror', families: 'Trial expression', description: 'High-fidelity assessment designed to mimic the attentional and pressure demands of real field testing.' },
];

/* ---- PILLAR OWNERSHIP DATA ---- */
const PILLAR_OWNERSHIP = [
    { pillar: 'Focus', color: '#60a5fa', families: ['Noise Gate', 'Endurance Lock', 'Split Stream*', 'Quiet Eye*'], note: '* = Candidate' },
    { pillar: 'Composure', color: '#22c55e', families: ['Kill Switch', 'Fault Line*', 'Heat Check*'], note: '* = Candidate' },
    { pillar: 'Decision', color: '#c084fc', families: ['Brake Point', 'Signal Window', 'Sequence Shift', 'Blind Commit*', 'Chaos Read*'], note: '* = Candidate' },
];

/* ---- VARIANT LIBRARY (grouped by parent) ---- */
interface VariantGroup {
    parent: string;
    pillar: 'focus' | 'composure' | 'decision';
    isCandidate: boolean;
    variants: string[];
}

const VARIANT_LIBRARY: VariantGroup[] = [
    { parent: 'The Kill Switch', pillar: 'composure', isCandidate: false, variants: ['Aftershock (double disruption stacking)', 'Reset Window (shrinking recovery window)', 'Restart (emotional reset after simulated turnover)', 'Second Chance (immediate re-execution after failure)', 'Recovery Chain (repeated disruption-reengagement cycles)', 'Reset Chamber (immersive environmental disruption, Vision Pro)'] },
    { parent: 'Noise Gate', pillar: 'focus', isCandidate: false, variants: ['Crowd Tunnel (immersive crowd distraction)', 'Tunnel Line (narrow focus under peripheral competition)', 'Spotlight (rapid target identification among moving distractors)', 'Channel Filter (pressure rotating across visual, audio, social channels)', 'Peripheral Fade (ignore escalating peripheral decoys)', 'Crowd Control (performance under crowd noise and commentary)'] },
    { parent: 'Brake Point', pillar: 'decision', isCandidate: false, variants: ['Red Light (classic go/no-go at sport tempo)', 'False Start (prevent premature initiation under anticipation pressure)', 'False Key (high-temptation decoy before real cue)', 'Decoy Lane (spatial decoys pull toward wrong action)', 'Spatial Brake (cancel response to spatial decoy, Vision Pro-ready)'] },
    { parent: 'Signal Window', pillar: 'decision', isCandidate: false, variants: ['Snap Read (rapid correct choice from short cue window)', 'Split Second (compressed-time decision with speed-accuracy balance)', 'Shot Clock (decision under shrinking time window)', 'Window Close (correct option briefly available, rewarding controlled recognition)', 'Check Down (choose safer correct option over tempting decoy)', 'Spatial Read (3D cue discrimination, Vision Pro-ready)'] },
    { parent: 'Sequence Shift', pillar: 'decision', isCandidate: false, variants: ['Rule Break (sudden rule change, immediate suppression of old rule)', 'Audible (task mapping changes late, forcing real-time adaptation)', 'Pattern Shift (sequence logic changes midstream under load)', 'Switchboard (response rules rotate rapidly)', 'Broken Play (rules change after initiation, requiring mid-execution update)'] },
    { parent: 'Endurance Lock', pillar: 'focus', isCandidate: false, variants: ['Grind Line (simple task over extended time, mapping attentional decay)', 'Burn Rate (speed of accuracy deterioration under prolonged load)', 'Sharpness Drop (tracking when decision quality falls off)', 'Late Clock (environment hardest in final minutes, not early)', 'Stay Clean (preserve low error rates when mentally taxed)', 'Long Reset (repeated disruptions over longer block to test recovery fatigue)', 'Fatigue Filter (selective attention under prolonged clutter)', 'Volatility Curve (round-to-round performance instability under duration)'] },
    { parent: 'Fault Line', pillar: 'composure', isCandidate: true, variants: ['Tilt Test (frustration sensitivity and emotional carryover)', 'Bounce Back (repeated simulated mistakes, serial recovery)', 'Next Play (immediate simple execution after error)', 'Error spiral (escalating consequence after sequential errors)', 'Post-miss reset (sport-framed recovery after simulated miss)'] },
    { parent: 'Heat Check', pillar: 'composure', isCandidate: true, variants: ['Public Eye (performing while watched, ranked, or compared)', 'Last Play (high-consequence framing on final trials)', 'Score-on-the-line (visible stakes escalation throughout session)', 'Ranking pressure (real-time leaderboard visibility)', 'Coach-watch mode (simulated observation by authority figure)'] },
    { parent: 'Split Stream', pillar: 'focus', isCandidate: true, variants: ['Multi-Source (cues from multiple directions/channels)', 'Priority Stack (multiple active rules, choose by current priority)', 'Dual-channel monitoring (two simultaneous task streams)', 'Rotating-source load (relevant channel changes unpredictably)'] },
    { parent: 'Blind Commit', pillar: 'decision', isCandidate: true, variants: ['Partial-information commit (decide with incomplete data)', 'Late reveal (correct answer revealed after commitment)', 'Forced-commit under timer (escalating cost of hesitation)', 'Confidence calibration (explicit confidence rating before reveal)'] },
    { parent: 'Chaos Read', pillar: 'decision', isCandidate: true, variants: ['Reset and Read (disruption then immediate decision)', 'Blindside (unexpected cue from unattended channel)', 'Noise to Choice (filtering task transitions into decision task)', 'Compressed chaos (maximum information density, minimum time)'] },
    { parent: 'Quiet Eye', pillar: 'focus', isCandidate: true, variants: ['Pre-shot lock (fixation stability before execution)', 'Gaze hold (maintain fixation under increasing peripheral temptation)', 'Anticipatory anchor (pre-position attention based on contextual probability)', 'Fixation under pressure (fixation stability under evaluative threat)'] },
];

/* ---- MAIN TAB ---- */
const SimFamilyTreeTab: React.FC = () => {
    return (
        <div className="space-y-10">
            {/* INTRO */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <TreePine className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">Sim Family Tree v2</h2>
                        <p className="text-xs text-zinc-500">Companion to the System Taxonomy & Promotion Protocol · March 2025</p>
                    </div>
                </div>
                <p className="text-sm text-zinc-300 max-w-4xl">
                    The complete family, candidate, and variant architecture for the Pulse Check simulation system. Includes locked families, candidate families with promotion criteria, exploratory concepts, and the full variant library.
                </p>
            </div>

            {/* WHAT IS A SIM FAMILY? */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" /> What Is a Sim Family?
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-5">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        A <span className="text-white font-semibold">sim family</span> is a distinct training mechanism that targets a named skill, produces a unique core metric, and occupies its own slot in the athlete&apos;s profile. It is the architectural unit of the Pulse Check system — the thing Nora programs against, the thing coaches see in a player&apos;s profile, and the thing the taxonomy is built around.
                    </p>

                    {/* SQUAT ANALOGY */}
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.03] p-5 space-y-4">
                        <p className="text-[9px] uppercase tracking-widest font-bold text-cyan-400">Physical Training Analogy</p>
                        <p className="text-sm text-zinc-300 leading-relaxed">
                            Think of it like the <span className="text-white font-semibold">squat</span> in physical training. &quot;Squat&quot; is the family. Back squat, front squat, goblet squat, pause squat, box squat — those are <span className="text-cyan-300 font-semibold">variants</span>. They all train hip and knee extension under load, but they vary the surface mechanics. You wouldn&apos;t count them as separate exercises in your programming taxonomy — they&apos;re all squats. But an athlete&apos;s actual training program might rotate through several squat variants depending on what phase they&apos;re in.
                        </p>
                        <p className="text-sm text-zinc-300 leading-relaxed">
                            Pulse Check works the same way. <span className="text-white font-semibold">Kill Switch</span> is a family — it trains disruption recovery. Visual disruption Kill Switch, audio disruption Kill Switch, cognitive-provocation Kill Switch — those are variants. They all target the same mechanism (recover goal-directed focus after disruption) and produce the same core metric (post-error recovery time). Nora rotates through them for variety and engagement, but the profile shows one Kill Switch score, not eight different variant scores.
                        </p>

                        {/* SIDE-BY-SIDE COMPARISON */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div className="rounded-xl border border-zinc-700 bg-black/30 p-4">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-500 mb-2">🏋️ Physical Training</p>
                                <p className="text-xs font-bold text-white mb-2">Squat <span className="text-zinc-500 font-normal">← Family</span></p>
                                <div className="space-y-1 pl-3 border-l-2 border-zinc-700">
                                    {['Back Squat', 'Front Squat', 'Goblet Squat', 'Pause Squat', 'Box Squat'].map((v) => (
                                        <p key={v} className="text-[10px] text-zinc-400">{v}</p>
                                    ))}
                                </div>
                                <div className="mt-3 pt-2 border-t border-zinc-800">
                                    <p className="text-[9px] text-zinc-600"><span className="text-zinc-400 font-semibold">Shared mechanism:</span> Hip & knee extension under load</p>
                                    <p className="text-[9px] text-zinc-600"><span className="text-zinc-400 font-semibold">Profile slot:</span> Squat strength</p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.03] p-4">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-500 mb-2">🧠 Pulse Check</p>
                                <p className="text-xs font-bold text-white mb-2">Kill Switch <span className="text-zinc-500 font-normal">← Family</span></p>
                                <div className="space-y-1 pl-3 border-l-2 border-purple-500/30">
                                    {['Visual Disruption Kill Switch', 'Audio Disruption Kill Switch', 'Cognitive-Provocation Kill Switch', 'Sport-Context Kill Switch', 'Immersive Reset Chamber'].map((v) => (
                                        <p key={v} className="text-[10px] text-zinc-400">{v}</p>
                                    ))}
                                </div>
                                <div className="mt-3 pt-2 border-t border-zinc-800">
                                    <p className="text-[9px] text-zinc-600"><span className="text-zinc-400 font-semibold">Shared mechanism:</span> Disruption recovery & attentional shifting</p>
                                    <p className="text-[9px] text-zinc-600"><span className="text-zinc-400 font-semibold">Profile slot:</span> Kill Switch score</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* THREE DEFINING PROPERTIES */}
                    <div>
                        <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-500 mb-3">What Makes a Family Distinct</p>
                        <p className="text-xs text-zinc-400 leading-relaxed mb-3">A sim earns family status — rather than being classified as a variant under an existing family — when it satisfies three criteria:</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {[
                                { num: '1', title: 'Unique Mechanism', desc: 'Trains a cognitive operation that is measurably different from every other family. Not a surface-level variation — a different underlying process.', color: '#60a5fa' },
                                { num: '2', title: 'Unique Core Metric', desc: 'Produces a primary measurement output that no other family already captures. If two families measure the same thing, one is probably a variant of the other.', color: '#22c55e' },
                                { num: '3', title: 'Unique Profile Value', desc: 'Tells the athlete or coach something actionable that no existing family score communicates. A new score that doesn\'t change coaching decisions isn\'t worth the complexity.', color: '#c084fc' },
                            ].map((item) => (
                                <div key={item.num} className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ background: item.color + '15', color: item.color, border: `1px solid ${item.color}30` }}>{item.num}</div>
                                        <p className="text-xs font-bold text-white">{item.title}</p>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-lg border border-zinc-700 bg-black/30 px-4 py-3">
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            <span className="text-white font-semibold">Bottom line:</span> If it doesn&apos;t have its own mechanism, its own metric, and its own coaching value — it&apos;s a variant, not a family. Variants are valuable (they add variety, sport specificity, and engagement), but they don&apos;t add architectural complexity. The taxonomy stays clean.
                        </p>
                    </div>
                </div>
            </section>

            {/* FAMILIES VS VARIANTS IN PRACTICE */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Shuffle className="w-4 h-4 text-amber-400" /> Families vs. Variants in Practice
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-5">
                    {/* CORE DISTINCTION */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-green-500/20 bg-green-500/[0.03] p-4">
                            <p className="text-[9px] uppercase tracking-widest font-bold text-green-400 mb-2">Family</p>
                            <p className="text-sm font-bold text-white mb-1">What is being trained</p>
                            <p className="text-xs text-zinc-400 leading-relaxed">The system&apos;s internal architecture. The taxonomy, product team, and Nora&apos;s logic all think in families. Families define the mechanism, the core metric, and the profile slot.</p>
                        </div>
                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.03] p-4">
                            <p className="text-[9px] uppercase tracking-widest font-bold text-blue-400 mb-2">Variant</p>
                            <p className="text-sm font-bold text-white mb-1">How it is being trained today</p>
                            <p className="text-xs text-zinc-400 leading-relaxed">The actual playable experience the athlete gets. The variant is the session object — the specific surface, context, duration, and modality the athlete interacts with.</p>
                        </div>
                    </div>

                    {/* NORA PRESCRIPTION FLOW */}
                    <div className="rounded-2xl border border-zinc-700 bg-black/30 p-5 space-y-4">
                        <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-500">How Nora Assigns a Session</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">The prescription engine assigns the <span className="text-white font-semibold">family first</span>, then selects the best <span className="text-white font-semibold">variant</span>. This keeps the logic clean: the &quot;why&quot; is always a family-level decision, and the &quot;what you play&quot; is always a variant-level selection.</p>

                        {/* FLOW EXAMPLE */}
                        <div className="space-y-2">
                            <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-1">Nora decides…</p>
                                <p className="text-xs text-zinc-300">This athlete needs <span className="text-green-400 font-semibold">Kill Switch</span> work because their profile shows weak refocus speed and post-error recovery.</p>
                            </div>
                            <div className="flex justify-center">
                                <ArrowDown className="w-4 h-4 text-zinc-600" />
                            </div>
                            <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-1">Nora serves…</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {['Kill Switch: Visual Disruption', 'Kill Switch: Crowd Noise', 'Kill Switch: Basketball Reset', 'Kill Switch: Extended Recovery Trial'].map((v) => (
                                        <span key={v} className="text-[10px] px-2 py-1 rounded-lg bg-green-500/5 border border-green-500/20 text-green-300/80">{v}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3 LAYERS OF ASSIGNMENT */}
                    <div>
                        <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-500 mb-3">Three Layers of Assignment</p>
                        <div className="space-y-2">
                            {[
                                {
                                    num: '1',
                                    icon: Monitor,
                                    title: 'System Assignment',
                                    subtitle: 'What Nora is doing internally',
                                    color: '#22c55e',
                                    example: 'Primary prescription need: Kill Switch family',
                                    reason: 'Reason: low refocus speed, moderate pressure instability',
                                },
                                {
                                    num: '2',
                                    icon: GitBranch,
                                    title: 'Variant Assignment',
                                    subtitle: 'The actual session object',
                                    color: '#60a5fa',
                                    example: 'Assigned sim: Kill Switch / Audio Disruption / 3-minute / Tennis context',
                                    reason: '',
                                },
                                {
                                    num: '3',
                                    icon: User,
                                    title: 'Athlete-Facing Naming',
                                    subtitle: 'What the athlete sees',
                                    color: '#c084fc',
                                    example: 'Kill Switch',
                                    reason: 'Crowd Reset · 3 min',
                                },
                            ].map((layer) => {
                                const Icon = layer.icon;
                                return (
                                    <div key={layer.num} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-black/20 p-4">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: layer.color + '15', border: `1px solid ${layer.color}30` }}>
                                            <Icon className="w-4 h-4" style={{ color: layer.color }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className="text-xs font-bold text-white">{layer.title}</p>
                                                <span className="text-[9px] text-zinc-500">— {layer.subtitle}</span>
                                            </div>
                                            <p className="text-[10px] text-zinc-300 font-mono">{layer.example}</p>
                                            {layer.reason && <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{layer.reason}</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* NAMING RECOMMENDATION */}
                    <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] p-5 space-y-3">
                        <p className="text-[9px] uppercase tracking-widest font-bold text-purple-400">Recommended Athlete-Facing Display</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">Show <span className="text-white font-semibold">family name + variant subtitle</span>. This strikes the best balance: the athlete builds familiarity with the family (what they&apos;re training) while still seeing variation in the experience.</p>
                        <div className="rounded-xl border border-zinc-700 bg-black/40 p-4 max-w-xs">
                            <p className="text-base font-bold text-white">Kill Switch</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Crowd Reset · 3 min</p>
                        </div>
                    </div>

                    {/* INTERNAL ASSIGNMENT RULE */}
                    <div className="rounded-xl border border-green-500/20 bg-green-500/[0.03] px-4 py-3">
                        <p className="text-xs text-green-300 font-semibold mb-1">Internal Rule</p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                            Always assign at both levels — <span className="text-white font-semibold">family</span> and <span className="text-white font-semibold">variant</span> — on every session. This keeps the data architecture clean and allows the reporting layer to show either level depending on the abstraction needed.
                        </p>
                    </div>

                    {/* REPORTING IMPLICATION */}
                    <div className="rounded-2xl border border-zinc-700 bg-black/30 p-5 space-y-3">
                        <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-500">Why This Matters for Reporting</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">The family is what makes the progress story coherent. When an athlete asks &quot;am I getting better?&quot;, the answer should be at the family level.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-green-400 mb-1">✓ Say this</p>
                                <p className="text-xs text-zinc-300 italic">&quot;You improved in Kill Switch over the last 3 weeks.&quot;</p>
                            </div>
                            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-red-400 mb-1">✗ Not this</p>
                                <p className="text-xs text-zinc-300 italic">&quot;You improved in Visual Disruption v2 and Audio Reset v1.&quot;</p>
                            </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">The reporting layer can show either families or variants depending on the audience. Coaches and the profile use families. Data science and sim design drill into variants.</p>
                    </div>

                    {/* OPERATING RULE */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-5 text-center">
                        <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-500 mb-2">The Operating Rule</p>
                        <p className="text-lg md:text-xl font-bold text-white leading-snug">
                            Programs prescribe <span className="text-green-400">families</span>. Sessions deliver <span className="text-blue-400">variants</span>. Profiles score <span className="text-purple-400">both</span>.
                        </p>
                    </div>
                </div>
            </section>

            {/* ARCHITECTURE OVERVIEW */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" /> Architecture Overview
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        The Sim Family Tree organizes every simulation into a clear hierarchy. At the top are <span className="text-white font-semibold">locked families</span>: the permanent backbone, each with a distinct mechanism, core metric, and profile slot. Below are <span className="text-amber-400 font-semibold">candidate families</span> in incubation. Below those are <span className="text-blue-400 font-semibold">variants</span>: expressions of a family&apos;s mechanism that add variety without architectural complexity. At the bottom are <span className="text-zinc-400 font-semibold">exploratory concepts</span> not yet ready for candidate status.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                            { label: 'Tier 1: Locked', count: '6', color: '#22c55e', desc: 'Permanent backbone families' },
                            { label: 'Tier 2: Candidate', count: '6', color: '#f59e0b', desc: 'In evaluation for promotion' },
                            { label: 'Tier 3: Exploratory', count: '1', color: '#94a3b8', desc: 'Not yet ready for candidate' },
                            { label: 'Tier 4: Variants', count: '60+', color: '#60a5fa', desc: 'Content layer expressions' },
                        ].map((t) => (
                            <div key={t.label} className="rounded-xl border p-3 text-center" style={{ borderColor: t.color + '30', background: t.color + '06' }}>
                                <p className="text-2xl font-bold" style={{ color: t.color }}>{t.count}</p>
                                <p className="text-[10px] uppercase tracking-widest font-bold mt-1" style={{ color: t.color }}>{t.label}</p>
                                <p className="text-[9px] text-zinc-500 mt-1">{t.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* PILLAR OWNERSHIP */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" /> Pillar Ownership at a Glance
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {PILLAR_OWNERSHIP.map((p) => (
                        <div key={p.pillar} className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4">
                            <h4 className="text-base font-bold mb-3" style={{ color: p.color }}>{p.pillar}</h4>
                            <div className="space-y-1.5">
                                {p.families.map((f) => (
                                    <div key={f} className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: f.includes('*') ? '#f59e0b' : p.color }} />
                                        <p className="text-xs text-zinc-300">{f}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[9px] text-zinc-600 mt-2">{p.note}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* TIER 1: LOCKED FAMILIES */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Lock className="w-4 h-4 text-green-400" /> Tier 1: Locked Core Families
                </h3>
                <p className="text-sm text-zinc-400">These six families are the official foundation. Each has a defined mechanism, core metric, and profile slot. They match the initial sim portfolio from the System Taxonomy.</p>
                <div className="space-y-3">
                    {LOCKED_FAMILIES.map((fam, idx) => (
                        <div key={fam.name} className="bg-[#090f1c] border border-zinc-800 rounded-2xl overflow-hidden">
                            <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-zinc-800/60">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-zinc-600 font-mono text-xs">{idx + 1})</span>
                                        <h4 className="text-base font-bold text-white">{fam.name}</h4>
                                        <PillarBadge pillar={fam.pillar} />
                                    </div>
                                    <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl">{fam.description}</p>
                                </div>
                                <TierBadge tier="locked" />
                            </div>
                            <div className="px-5 py-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1">Mechanism</p>
                                    <p className="text-[11px] text-zinc-300">{fam.mechanism}</p>
                                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mt-2 mb-1">Core Metric</p>
                                    <p className="text-[11px] text-zinc-400">{fam.coreMetric}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1">Variant Branches</p>
                                    <div className="flex flex-wrap gap-1">
                                        {fam.variants.map((v) => (
                                            <span key={v} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-zinc-800 text-zinc-500">{v}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* TIER 2: CANDIDATE FAMILIES */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Beaker className="w-4 h-4 text-amber-400" /> Tier 2: Candidate Families in Incubation
                </h3>
                <p className="text-sm text-zinc-400">These six families are strong enough to merit incubation but are not yet locked. Each will be evaluated through the Sim Family Promotion Protocol, deployed into the live environment, and promoted or classified as a variant once 50 unique athletes complete both the candidate and closest parent.</p>
                <div className="space-y-3">
                    {CANDIDATE_FAMILIES.map((fam, idx) => (
                        <div key={fam.name} className="bg-[#090f1c] border border-zinc-800 rounded-2xl overflow-hidden">
                            <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-zinc-800/60" style={{ background: 'rgba(245,158,11,0.03)' }}>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-zinc-600 font-mono text-xs">{idx + 7})</span>
                                        <h4 className="text-base font-bold text-white">{fam.name}</h4>
                                        <PillarBadge pillar={fam.pillar} />
                                    </div>
                                    <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl">{fam.description}</p>
                                </div>
                                <TierBadge tier="candidate" />
                            </div>
                            <div className="px-5 py-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1">Distinct From</p>
                                    <p className="text-[11px] text-amber-300/80">{fam.distinctionFrom}</p>
                                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mt-2 mb-1">Mechanism</p>
                                    <p className="text-[11px] text-zinc-300">{fam.mechanism}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1">Core Metric</p>
                                    <p className="text-[11px] text-zinc-400">{fam.coreMetric}</p>
                                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mt-2 mb-1">Promotion Criteria</p>
                                    <p className="text-[10px] text-green-400/70 leading-relaxed">{fam.promotionCriteria}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1">Variant Branches</p>
                                    <div className="flex flex-wrap gap-1">
                                        {fam.variants.map((v) => (
                                            <span key={v} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/5 border border-amber-500/20 text-zinc-500">{v}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* TIER 3: EXPLORATORY */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Telescope className="w-4 h-4 text-zinc-400" /> Tier 3: Exploratory Concepts
                </h3>
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-base font-bold text-white">Mirror Read</h4>
                        <TierBadge tier="exploratory" />
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                        Conceptually distinct — predicting what someone else will do is a different cognitive operation than reading what is currently happening. However, the mechanism is harder to implement cleanly in an app-based sim without drifting into sport-specific complexity that would limit generalizability. Risk of collapsing into a more abstract version of Signal Window or Chaos Read once built.
                    </p>
                    <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
                        <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1">Recommended Next Step</p>
                        <p className="text-[11px] text-zinc-400">Prototype Mirror Read as an experimental branch within Signal Window or Chaos Read. If the prototype produces divergent performance patterns from both parent families, re-evaluate for formal candidate status through the Promotion Protocol.</p>
                    </div>
                </div>
            </section>

            {/* TIER 4: VARIANT LIBRARY */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-blue-400" /> Tier 4: Variant Library
                </h3>
                <p className="text-sm text-zinc-400">The expanding content layer. Variants add training variety, sport-specific contextualization, and engagement without adding architectural complexity. Each variant inherits its parent family&apos;s mechanism, primary metric, and profile slot. Variants can be promoted through the Promotion Protocol if Nora&apos;s divergence detection identifies them as producing divergent performance patterns.</p>
                <div className="space-y-2">
                    {VARIANT_LIBRARY.map((group) => (
                        <CollapsibleSection key={group.parent} title={`${group.parent} ${group.isCandidate ? '(candidate)' : ''} — ${group.variants.length} variants`}>
                            <div className="flex items-center gap-2 mb-2">
                                <PillarBadge pillar={group.pillar} />
                                {group.isCandidate && <TierBadge tier="candidate" />}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {group.variants.map((v) => (
                                    <span key={v} className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-zinc-800 text-zinc-400">{v}</span>
                                ))}
                            </div>
                        </CollapsibleSection>
                    ))}
                </div>
            </section>

            {/* HYBRID MODULES */}
            <section className="space-y-4 pb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Shuffle className="w-4 h-4 text-cyan-400" /> Hybrid Modules and Trial Expressions
                </h3>
                <p className="text-sm text-zinc-400">Cross-family program modules or Trial-layer formats that Nora can assemble. Architecturally they are composites, not distinct mechanisms. They do not need spec templates, profile slots, or promotion criteria.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {HYBRID_MODULES.map((mod) => (
                        <div key={mod.name} className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4">
                            <h4 className="text-sm font-bold text-white mb-1">{mod.name}</h4>
                            <p className="text-[10px] text-cyan-400/70 font-mono mb-2">{mod.families}</p>
                            <p className="text-xs text-zinc-400 leading-relaxed">{mod.description}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default SimFamilyTreeTab;
