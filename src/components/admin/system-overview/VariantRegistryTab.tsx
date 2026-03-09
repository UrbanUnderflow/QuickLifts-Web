import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown,
    ChevronRight,
    Search,
    Filter,
    Lock,
    FlaskConical,
    BookOpen,
    CheckCircle2,
    Circle,
    Clock,
    AlertTriangle,
    XCircle,
    Layers,
    Zap,
    Shield,
    FileCode2,
    GitBranch,
    Gamepad2,
    Ruler,
    BarChart3,
    Wrench,
    ListChecks,
    ClipboardPaste,
    X,
    Eye,
    Sparkles,
    Save,
    Upload,
    RefreshCw,
} from 'lucide-react';
import {
    ExerciseCategory,
    ExerciseDifficulty,
    simVariantRegistryService,
    type MentalExercise,
} from '../../../api/firebase/mentaltraining';
import {
    buildSimVariantId,
    type SimVariantHistoryEntry,
    type SimVariantFamilyStatus,
    type SimVariantMode,
    type SimVariantModuleDraft,
    type SimVariantRecord,
    type SimVariantSeed,
    type SimVariantSpecStatus,
} from '../../../api/firebase/mentaltraining/variantRegistryService';

/* ---- TYPES ---- */
type SpecStatus = SimVariantSpecStatus;
type FamilyStatus = SimVariantFamilyStatus;
type VariantMode = SimVariantMode;
type VariantEntry = SimVariantSeed;

interface ParsedSpec {
    coreIdentity: string;
    whyExists: string;
    inheritance: string;
    athleteFlow: string;
    measurementNotes: string;
    modeBehavior: string;
    buildNotes: string;
    readinessChecklist: string;
    rawSections: { heading: string; content: string }[];
}

interface FamilySpecBase {
    mechanism: string;
    coreMetric: string;
    skillTargets: string;
    boundaryRule: string;
    trainingModeDefaults: string[];
    trialModeDefaults: string[];
    governingDocs: string[];
}

interface VariantTheme {
    variantType: string;
    purpose: string;
    expectedBenefit: string;
    bestUse: string[];
    changes: string[];
    athleteFlow: string[];
    scoringNotes: string[];
    artifactRisks: string[];
    trainingMode: string[];
    trialMode: string[];
    buildNotes: string[];
    boundarySafeguards: string[];
}

/* ---- STATUS CONFIG ---- */
const SPEC_STATUS_CONFIG: Record<SpecStatus, { label: string; color: string; icon: React.ElementType }> = {
    'needs-spec': { label: 'Needs Spec', color: '#ef4444', icon: AlertTriangle },
    'in-progress': { label: 'In Progress', color: '#f59e0b', icon: Clock },
    'complete': { label: 'Complete', color: '#22c55e', icon: CheckCircle2 },
    'not-required': { label: 'Not Required', color: '#64748b', icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    high: { label: 'High', color: '#ef4444' },
    medium: { label: 'Medium', color: '#f59e0b' },
    low: { label: 'Low', color: '#64748b' },
};

const MODE_CONFIG: Record<VariantMode, { label: string; color: string; icon: React.ElementType }> = {
    branch: { label: 'Branch Variant', color: '#60a5fa', icon: Layers },
    library: { label: 'Library Variant', color: '#c084fc', icon: BookOpen },
    hybrid: { label: 'Hybrid / Trial', color: '#64748b', icon: Zap },
};

/* ---- FAMILY COLOR MAP ---- */
const FAMILY_COLORS: Record<string, string> = {
    'The Kill Switch': '#ef4444',
    'Noise Gate': '#f59e0b',
    'Brake Point': '#22c55e',
    'Signal Window': '#3b82f6',
    'Sequence Shift': '#8b5cf6',
    'Endurance Lock': '#06b6d4',
    'Fault Line': '#f97316',
    'Split Stream': '#14b8a6',
    'Blind Commit': '#ec4899',
    'Heat Check': '#eab308',
    'Chaos Read': '#6366f1',
    'Quiet Eye': '#84cc16',
};

const FAMILY_SPEC_BASES: Record<string, FamilySpecBase> = {
    'The Kill Switch': {
        mechanism: 'disruption -> reset -> rapid re-engagement to the same primary task',
        coreMetric: 'Recovery Time',
        skillTargets: 'Attentional Shifting, Error Recovery Speed, and Pressure Stability',
        boundaryRule: 'the athlete must always return to the same task rather than pivoting into a new problem or secondary challenge',
        trainingModeDefaults: [
            'show round-level recovery feedback and reinforce fast, clean re-engagement',
            'allow light adaptation inside family limits without changing the recovery mechanic',
            'keep the session compact enough to feel like a competitive drill rather than a benchmark battery',
        ],
        trialModeDefaults: [
            'suppress intra-session feedback and lock the disruption schedule for comparison-grade consistency',
            'standardize duration, seed, device logging, and modifier profile',
            'report results only after the full assessment completes',
        ],
        governingDocs: [
            'Sim Specification Standards Addendum (v2)',
            'The Kill Switch Sim Spec v3',
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ],
    },
    'Noise Gate': {
        mechanism: 'maintain the live cue while filtering irrelevant noise',
        coreMetric: 'Distractor Cost',
        skillTargets: 'Selective Attention, Interference Control, and Pressure Stability',
        boundaryRule: 'distractors must stay irrelevant and may not become a second monitored target or a divided-attention task',
        trainingModeDefaults: [
            'show round-level distractor filtering feedback with channel-specific coaching language',
            'adapt density and timing only inside approved family boundaries',
            'treat the session like a drill for staying clean under noise, not like a new rule-learning exercise',
        ],
        trialModeDefaults: [
            'hide intra-session scores and keep overlap schedules fixed or seeded',
            'standardize device class, audio route, and logging fields for reliable comparison',
            'report the family metric first, with channel breakdowns as secondary analysis',
        ],
        governingDocs: [
            'Sim Specification Standards Addendum (v2)',
            'Noise Gate Sim Spec v3',
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ],
    },
    'Brake Point': {
        mechanism: 'cancel or inhibit the wrong action when the stop signal appears',
        coreMetric: 'Stop Latency',
        skillTargets: 'Response Inhibition, Impulse Control, and Pressure Stability',
        boundaryRule: 'the task must remain response cancellation rather than shifting into a cue-reading or multi-step decision task',
        trainingModeDefaults: [
            'surface stop-quality feedback without overwhelming the athlete with analytics',
            'scale stop-signal timing or decoy intensity inside fixed family boundaries',
            'maintain the feeling of urgent control, not deliberative puzzle solving',
        ],
        trialModeDefaults: [
            'lock stop-signal timing, difficulty tier, and modifier settings',
            'remove intra-session feedback to prevent self-monitoring effects',
            'export false starts and motor artifacts separately from the headline score',
        ],
        governingDocs: [
            'Sim Specification Standards Addendum (v2)',
            'Brake Point Sim Spec v3',
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ],
    },
    'Signal Window': {
        mechanism: 'identify and commit to the correct cue before the decision window closes',
        coreMetric: 'Read Accuracy',
        skillTargets: 'Rapid Cue Recognition, Decision Accuracy, and Pressure Stability',
        boundaryRule: 'the task must remain cue discrimination with a clearly correct answer rather than a blind or ambiguous commitment task',
        trainingModeDefaults: [
            'show concise decision feedback and reinforce fast-but-correct reads',
            'adapt cue complexity and window duration only within family limits',
            'keep the sim feeling like a read, not a memorization or inhibition task',
        ],
        trialModeDefaults: [
            'fix cue timing, presentation order, and difficulty tier for standardized comparison',
            'suppress feedback until the session ends',
            'log cue type, ambiguity level, and response timing for analysis',
        ],
        governingDocs: [
            'Sim Specification Standards Addendum (v2)',
            'Signal Window Sim Spec v3',
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ],
    },
    'Sequence Shift': {
        mechanism: 'update immediately to the new rule when the sequence or rule changes',
        coreMetric: 'Update Accuracy',
        skillTargets: 'Cognitive Flexibility, Rule Updating, and Pressure Stability',
        boundaryRule: 'each shift must preserve a clearly correct answer and may not drift into unresolved ambiguity or chaos-read logic',
        trainingModeDefaults: [
            'show clean post-shift feedback and reinforce correct updates over guessing',
            'adapt change frequency and rule complexity inside family bounds',
            'frame difficulty as rapid updating, not raw speed alone',
        ],
        trialModeDefaults: [
            'standardize the shift schedule, difficulty tier, and response windows',
            'suppress intra-session feedback and use fixed sequences or seeds',
            'report post-shift accuracy as the primary lens',
        ],
        governingDocs: [
            'Sim Specification Standards Addendum (v2)',
            'Sequence Shift Sim Spec v3',
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ],
    },
    'Endurance Lock': {
        mechanism: 'preserve clean execution as time, monotony, and fatigue load accumulate',
        coreMetric: 'Degradation Slope',
        skillTargets: 'Sustained Attention, Fatigability Control, and Pressure Stability',
        boundaryRule: 'difficulty should rise through duration or load, not by changing the underlying task into another family',
        trainingModeDefaults: [
            'show trend-oriented feedback across blocks rather than overreacting to single moments',
            'adjust duration and pacing while preserving the same task identity',
            'reinforce late-session discipline and clean maintenance',
        ],
        trialModeDefaults: [
            'fix duration, pacing, and modifier profile to expose deterioration cleanly',
            'suppress intra-session feedback so the late-session curve stays interpretable',
            'log early, mid, and late block behavior separately',
        ],
        governingDocs: [
            'Sim Specification Standards Addendum (v2)',
            'Endurance Lock Sim Spec v3',
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ],
    },
    'Fault Line': {
        mechanism: 'stabilize after an error event before it cascades into a broader performance spiral',
        coreMetric: 'Reset Stability',
        skillTargets: 'Emotional Recovery, Next-Rep Control, and Pressure Stability',
        boundaryRule: 'the sim must stay focused on post-error stabilization rather than becoming a full Kill Switch or Heat Check duplicate',
        trainingModeDefaults: [
            'give clear, low-friction post-error feedback that keeps the athlete moving forward',
            'scale consequence and emotional salience within candidate-family limits',
            'emphasize next-play quality rather than punishment',
        ],
        trialModeDefaults: [
            'use fixed post-error scenarios and comparison-grade conditions',
            'suppress feedback until the session ends',
            'tag the triggering error context for later analysis',
        ],
        governingDocs: [
            'Sim Specification Standards Addendum (v2)',
            'Fault Line Candidate Spec',
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ],
    },
    'Split Stream': {
        mechanism: 'monitor multiple relevant sources and allocate attention across them correctly',
        coreMetric: 'Multi-Source Accuracy',
        skillTargets: 'Divided Attention, Source Prioritization, and Pressure Stability',
        boundaryRule: 'all monitored streams must remain relevant so the task does not collapse back into simple distractor filtering',
        trainingModeDefaults: [
            'show source-level feedback and prioritization coaching',
            'scale stream count and switching load inside family boundaries',
            'preserve the broad-attention identity of the task',
        ],
        trialModeDefaults: [
            'fix source cadence, weighting, and difficulty tier',
            'suppress intra-session feedback',
            'log per-source misses and prioritization tradeoffs separately',
        ],
        governingDocs: [
            'Sim Specification Standards Addendum (v2)',
            'Split Stream Candidate Spec',
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ],
    },
    'Blind Commit': {
        mechanism: 'force a commit before full information becomes available',
        coreMetric: 'Commit Quality',
        skillTargets: 'Decision Commitment, Confidence Calibration, and Pressure Stability',
        boundaryRule: 'the task must stay focused on committing under incomplete information rather than a normal cue-read with a fully visible answer',
        trainingModeDefaults: [
            'show decision-outcome feedback after the commitment point',
            'scale information availability and time pressure inside candidate boundaries',
            'keep the focus on commitment quality, not trivia or memory',
        ],
        trialModeDefaults: [
            'fix reveal timing, information limits, and stakes profile',
            'withhold performance feedback until the end of the session',
            'log confidence markers and reveal timing alongside outcome',
        ],
        governingDocs: [
            'Sim Specification Standards Addendum (v2)',
            'Blind Commit Candidate Spec',
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ],
    },
    'Heat Check': {
        mechanism: 'execute the same task cleanly while evaluative pressure and stakes rise',
        coreMetric: 'Pressure Execution Score',
        skillTargets: 'Pressure Tolerance, Composure, and Performance Stability',
        boundaryRule: 'pressure framing can rise, but the base task should not morph into a different family mechanism',
        trainingModeDefaults: [
            'show compact pressure-context feedback without breaking immersion',
            'escalate stakes and evaluative cues within family limits',
            'preserve a performance-under-pressure feel rather than a fear-based experience',
        ],
        trialModeDefaults: [
            'fix pressure cues, timing, and stakes profile',
            'suppress mid-session feedback and log context conditions carefully',
            'separate baseline and pressure-condition reporting',
        ],
        governingDocs: [
            'Sim Specification Standards Addendum (v2)',
            'Heat Check Candidate Spec',
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ],
    },
    'Chaos Read': {
        mechanism: 'convert unstable, noisy situations into a usable decision quickly',
        coreMetric: 'Choice Quality Under Chaos',
        skillTargets: 'Adaptive Reading, Rapid Reorientation, and Pressure Stability',
        boundaryRule: 'the task must stay about extracting signal from unstable conditions rather than becoming pure noise filtering or pure blind commitment',
        trainingModeDefaults: [
            'show choice-quality feedback with emphasis on staying functional under disruption',
            'scale instability and compression without removing the decision layer',
            'preserve a read-in-chaos identity rather than an attention-only drill',
        ],
        trialModeDefaults: [
            'standardize scenario order, seed, and instability profile',
            'remove feedback until session completion',
            'log pre-choice context, response timing, and final decision quality',
        ],
        governingDocs: [
            'Sim Specification Standards Addendum (v2)',
            'Chaos Read Candidate Spec',
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ],
    },
    'Quiet Eye': {
        mechanism: 'stabilize gaze and attention before the decisive action',
        coreMetric: 'Fixation Stability',
        skillTargets: 'Gaze Control, Pre-Action Focus, and Pressure Stability',
        boundaryRule: 'the task must remain fixation-led preparation rather than a general reaction or distraction drill',
        trainingModeDefaults: [
            'show concise pre-action stability feedback',
            'scale hold duration and pressure context without changing the fixation mechanic',
            'keep the experience deliberate and precise rather than frantic',
        ],
        trialModeDefaults: [
            'fix timing, target presentation, and pressure cues',
            'hide feedback until the full session ends',
            'log fixation timing and break points for later analysis',
        ],
        governingDocs: [
            'Sim Specification Standards Addendum (v2)',
            'Quiet Eye Candidate Spec',
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ],
    },
};

/* ---- VARIANT DATA ---- */
const VARIANT_REGISTRY: VariantEntry[] = [
    // ── THE KILL SWITCH (LOCKED) ── Branch Variants
    { name: 'Visual Disruption Kill Switch', family: 'The Kill Switch', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Audio Disruption Kill Switch', family: 'The Kill Switch', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Cognitive-Provocation Kill Switch', family: 'The Kill Switch', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Combined-Channel Kill Switch', family: 'The Kill Switch', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Short Daily Kill Switch', family: 'The Kill Switch', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Extended Trial Kill Switch', family: 'The Kill Switch', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Sport-Context Kill Switch', family: 'The Kill Switch', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Immersive Reset Chamber', family: 'The Kill Switch', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    // ── THE KILL SWITCH ── Library Variants
    { name: 'Aftershock', family: 'The Kill Switch', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Reset Window', family: 'The Kill Switch', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Restart', family: 'The Kill Switch', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Second Chance', family: 'The Kill Switch', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Recovery Chain', family: 'The Kill Switch', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Reset Chamber', family: 'The Kill Switch', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },

    // ── NOISE GATE (LOCKED) ── Branch Variants
    { name: 'Visual Clutter Noise Gate', family: 'Noise Gate', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Crowd-Noise Noise Gate', family: 'Noise Gate', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Mixed-Channel Noise Gate', family: 'Noise Gate', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Peripheral Bait Noise Gate', family: 'Noise Gate', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Fatigue-State Noise Gate', family: 'Noise Gate', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Immersive Crowd Tunnel', family: 'Noise Gate', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    // ── NOISE GATE ── Library Variants
    { name: 'Crowd Tunnel', family: 'Noise Gate', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Tunnel Line', family: 'Noise Gate', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Spotlight', family: 'Noise Gate', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Channel Filter', family: 'Noise Gate', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Peripheral Fade', family: 'Noise Gate', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Crowd Control', family: 'Noise Gate', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },

    // ── BRAKE POINT (LOCKED) ── Branch Variants
    { name: 'Go/No-Go Brake Point', family: 'Brake Point', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Fakeout Brake Point', family: 'Brake Point', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'False-Start Brake Point', family: 'Brake Point', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Spatial Cancel Brake Point', family: 'Brake Point', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'High-Stakes Inhibition Brake Point', family: 'Brake Point', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Immersive Spatial Brake', family: 'Brake Point', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    // ── BRAKE POINT ── Library Variants
    { name: 'Red Light', family: 'Brake Point', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'False Start', family: 'Brake Point', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'False Key', family: 'Brake Point', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Decoy Lane', family: 'Brake Point', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Spatial Brake', family: 'Brake Point', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },

    // ── SIGNAL WINDOW (LOCKED) ── Branch Variants
    { name: 'Ambiguous Cue Signal Window', family: 'Signal Window', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Decoy Cue Signal Window', family: 'Signal Window', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Shot-Clock Signal Window', family: 'Signal Window', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Rapid Recognition Signal Window', family: 'Signal Window', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Spatial Read Signal Window', family: 'Signal Window', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Field-Read Trial Signal Window', family: 'Signal Window', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    // ── SIGNAL WINDOW ── Library Variants
    { name: 'Snap Read', family: 'Signal Window', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Split Second', family: 'Signal Window', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Shot Clock', family: 'Signal Window', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Window Close', family: 'Signal Window', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Check Down', family: 'Signal Window', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Spatial Read', family: 'Signal Window', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },

    // ── SEQUENCE SHIFT (LOCKED) ── Branch Variants
    { name: 'Pattern-Change Sequence Shift', family: 'Sequence Shift', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Dual-Rule Sequence Shift', family: 'Sequence Shift', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Late-Audible Sequence Shift', family: 'Sequence Shift', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Sequence-Memory Sequence Shift', family: 'Sequence Shift', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Sport-Playbook Sequence Shift', family: 'Sequence Shift', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    // ── SEQUENCE SHIFT ── Library Variants
    { name: 'Rule Break', family: 'Sequence Shift', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Audible', family: 'Sequence Shift', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Pattern Shift', family: 'Sequence Shift', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Switchboard', family: 'Sequence Shift', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Broken Play', family: 'Sequence Shift', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },

    // ── ENDURANCE LOCK (LOCKED) ── Branch Variants
    { name: 'Sustained-Focus Endurance Lock', family: 'Endurance Lock', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Late-Pressure Endurance Lock', family: 'Endurance Lock', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Clutter-Fatigue Endurance Lock', family: 'Endurance Lock', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Long-Reset Endurance Lock', family: 'Endurance Lock', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Trial-Only Fatigability Probe', family: 'Endurance Lock', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    // ── ENDURANCE LOCK ── Library Variants
    { name: 'Grind Line', family: 'Endurance Lock', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Burn Rate', family: 'Endurance Lock', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Sharpness Drop', family: 'Endurance Lock', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Late Clock', family: 'Endurance Lock', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Stay Clean', family: 'Endurance Lock', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Long Reset', family: 'Endurance Lock', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Fatigue Filter', family: 'Endurance Lock', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Volatility Curve', family: 'Endurance Lock', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },

    // ── FAULT LINE (CANDIDATE) ── Branch Variants
    { name: 'Tilt Test', family: 'Fault Line', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Bounce Back', family: 'Fault Line', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Next Play', family: 'Fault Line', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Error Spiral', family: 'Fault Line', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Post-Miss Reset', family: 'Fault Line', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },

    // ── SPLIT STREAM (CANDIDATE) ── Branch Variants
    { name: 'Multi-Source', family: 'Split Stream', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Priority Stack', family: 'Split Stream', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Dual-Channel Monitoring', family: 'Split Stream', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Rotating-Source Load', family: 'Split Stream', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },

    // ── BLIND COMMIT (CANDIDATE) ── Branch Variants
    { name: 'Partial-Information Commit', family: 'Blind Commit', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Late Reveal', family: 'Blind Commit', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Forced-Commit Under Timer', family: 'Blind Commit', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Confidence Calibration', family: 'Blind Commit', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },

    // ── HEAT CHECK (CANDIDATE) ── Branch Variants
    { name: 'Public Eye', family: 'Heat Check', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Last Play', family: 'Heat Check', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Score-On-The-Line', family: 'Heat Check', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Ranking Pressure', family: 'Heat Check', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Coach-Watch Mode', family: 'Heat Check', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },

    // ── CHAOS READ (CANDIDATE) ── Branch Variants
    { name: 'Reset and Read', family: 'Chaos Read', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Blindside', family: 'Chaos Read', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Noise to Choice', family: 'Chaos Read', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'low' },
    { name: 'Compressed Chaos', family: 'Chaos Read', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },

    // ── QUIET EYE (CANDIDATE) ── Branch Variants
    { name: 'Pre-Shot Lock', family: 'Quiet Eye', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Gaze Hold', family: 'Quiet Eye', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Anticipatory Anchor', family: 'Quiet Eye', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Fixation Under Pressure', family: 'Quiet Eye', familyStatus: 'candidate', mode: 'branch', specStatus: 'needs-spec', priority: 'medium' },

    // ── HYBRIDS / TRIAL EXPRESSIONS (No spec needed) ──
    { name: 'Overload', family: 'The Kill Switch', familyStatus: 'locked', mode: 'hybrid', specStatus: 'not-required', priority: 'low' },
    { name: 'Recovery Chain', family: 'The Kill Switch', familyStatus: 'locked', mode: 'hybrid', specStatus: 'not-required', priority: 'low' },
    { name: 'Noise to Choice (Hybrid)', family: 'Chaos Read', familyStatus: 'candidate', mode: 'hybrid', specStatus: 'not-required', priority: 'low' },
    { name: 'Two-Minute Drill', family: 'Endurance Lock', familyStatus: 'locked', mode: 'hybrid', specStatus: 'not-required', priority: 'low' },
    { name: 'Last Rep', family: 'Endurance Lock', familyStatus: 'locked', mode: 'hybrid', specStatus: 'not-required', priority: 'low' },
    { name: 'Pressure Room', family: 'Heat Check', familyStatus: 'candidate', mode: 'hybrid', specStatus: 'not-required', priority: 'low' },
    { name: 'Field Mirror', family: 'Signal Window', familyStatus: 'locked', mode: 'hybrid', specStatus: 'not-required', priority: 'low' },
];

/* ---- SPEC PARSER ---- */
function parseVariantSpec(raw: string): ParsedSpec {
    // Normalise line endings
    const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split on numbered section headings (1. / §2 / 3) — compatible without dotAll flag
    const rawSections: { heading: string; content: string }[] = [];
    const SECTION_HEADING = /^(§?\d{1,2}[.):\-]\s+.+)$/m;
    // Split the text on lines that look like numbered headings
    const lines = text.split('\n');
    let currentHeading = '';
    let currentContent: string[] = [];

    const flushSection = () => {
        if (currentHeading) {
            rawSections.push({ heading: currentHeading.trim(), content: currentContent.join('\n').trim() });
        }
    };

    lines.forEach((line) => {
        if (SECTION_HEADING.test(line.trim())) {
            flushSection();
            currentHeading = line.trim();
            currentContent = [];
        } else {
            currentContent.push(line);
        }
    });
    flushSection();

    if (rawSections.length === 0) {
        // Fallback: split on blank-line-separated paragraphs
        const parts = text.split(/\n{2,}/).filter(Boolean);
        parts.forEach((p, i) => rawSections.push({ heading: `Section ${i + 1}`, content: p.trim() }));
    }

    const getSection = (...keywords: string[]) => {
        const s = rawSections.find((s) =>
            keywords.some((k) => s.heading.toLowerCase().includes(k.toLowerCase()))
        );
        return s ? `**${s.heading}**\n\n${s.content}` : '';
    };

    return {
        coreIdentity: getSection('core identity', '3', 'identity'),
        whyExists: getSection('why this variant', '4', 'rationale', 'why'),
        inheritance: getSection('inheritance', '5', 'family inheritance', 'changes'),
        athleteFlow: getSection('athlete experience', '6', 'experience flow', 'flow'),
        measurementNotes: getSection('measurement', '7', 'scoring'),
        modeBehavior: getSection('mode behavior', '8', 'mode'),
        buildNotes: getSection('build', '9', 'implementation', 'engineering'),
        readinessChecklist: getSection('readiness', '10', 'checklist'),
        rawSections,
    };
}

function mapPriority(priority: VariantEntry['priority']) {
    if (priority === 'high') return 'P0';
    if (priority === 'medium') return 'P1';
    return 'P2';
}

function mapVariantStatus(variant: VariantEntry) {
    if (variant.specStatus === 'complete') return 'Build-Ready';
    if (variant.specStatus === 'in-progress') return 'In Progress';
    if (variant.mode === 'hybrid' || variant.specStatus === 'not-required') return 'Not Required';
    if (variant.familyStatus === 'candidate') return 'Exploratory Candidate Draft';
    return 'Draft Auto-Generated';
}

function inferVariantTheme(variant: VariantEntry): VariantTheme {
    const name = variant.name.toLowerCase();
    const familyBase = FAMILY_SPEC_BASES[variant.family];

    const genericTheme: VariantTheme = {
        variantType: variant.mode === 'library' ? 'Library variant' : variant.mode === 'hybrid' ? 'Hybrid / trial expression' : 'Branch variant',
        purpose: `This variant applies a distinct expression of ${variant.family} while preserving the family mechanism of ${familyBase?.mechanism ?? 'the parent simulation'}.`,
        expectedBenefit: 'Create a buildable draft that localizes the family to a clearer use case without changing the underlying cognitive target.',
        bestUse: [
            `the athlete needs a more specific expression of ${variant.family} without leaving the family boundary`,
            'Nora wants a draftable variant that can later be tightened with authored implementation details',
            'the program needs variety, localization, or packaging changes more than a brand-new family',
        ],
        changes: [
            'surface framing, pacing, and context can shift while the family mechanism remains unchanged',
            'variant packaging should make the athlete experience feel distinct without creating a new taxonomy object',
            'all scoring stays anchored to the parent family metric unless the family spec explicitly allows a tagged breakdown',
        ],
        athleteFlow: [
            'Entry framing should explain the pressure type or packaging difference in one short line.',
            'The athlete should move through the standard family loop with this variant-specific emphasis layered on top.',
            'Exit feedback should preserve family score language first and variant context second.',
        ],
        scoringNotes: [
            `${familyBase?.coreMetric ?? 'The family metric'} remains the headline score and follows parent-family rules.`,
            'Variant-specific annotations may be logged if they help analysis, but they should not replace the family metric.',
            'Any new tags should be treated as decomposition or context fields rather than a new scoring system.',
        ],
        artifactRisks: [
            'variant-specific presentation changes may create UI or interpretation artifacts if the family mechanic is not kept clear',
            'very fast responses below the addendum floor should be tagged as motor artifacts rather than interpreted cognitively',
        ],
        trainingMode: [...(familyBase?.trainingModeDefaults ?? ['show feedback according to the parent family defaults'])],
        trialMode: [...(familyBase?.trialModeDefaults ?? ['standardize conditions and suppress intra-session feedback for comparison use'])],
        buildNotes: [
            'Keep naming, analytics keys, and admin labels aligned with the registry entry.',
            'Store variant assignment, family, mode, and any variant-specific tags in the session record.',
            'Use this draft as a first-pass authored spec, not as the final implementation contract.',
        ],
        boundarySafeguards: [
            `Do not violate the family boundary: ${familyBase?.boundaryRule ?? 'the parent family rules still govern'}.`,
            'If the variant starts producing a different mechanism or divergent score logic, flag it for promotion review rather than extending the variant.',
        ],
    };

    if (name.includes('short daily')) {
        return {
            ...genericTheme,
            variantType: 'Duration variant',
            purpose: `This variant compresses ${variant.family} into the fastest useful daily rep while preserving ${familyBase?.mechanism ?? 'the core family mechanic'}.`,
            expectedBenefit: 'Increase compliance, repetition frequency, and low-friction daily usage.',
            bestUse: [
                'Nora wants the highest-probability daily completion format',
                'the athlete benefits from consistent exposure more than an extended benchmark session',
                'the program needs a default daily package with minimal startup friction',
            ],
            changes: [
                'session length is shortened and round count is reduced',
                'difficulty should stay useful but not so punishing that compliance drops',
                'the variant optimizes for repeatability and habit formation rather than exhaustive assessment',
            ],
            athleteFlow: [
                'Entry framing should signal that this is a quick, high-compliance daily rep.',
                'The athlete should move into the family loop with minimal setup and minimal instruction overhead.',
                'Exit feedback should be compact and motivational, with trend language over heavy analysis.',
            ],
            scoringNotes: [
                `${familyBase?.coreMetric ?? 'The family metric'} remains unchanged; the variant only changes packaging and exposure length.`,
                'Low trial count means summary views should emphasize median, consistency, and trend rather than over-reading one outlier.',
            ],
            artifactRisks: [
                'short sessions are unusually sensitive to one anomalous round or false start',
                'aggressive pre-emption can look like improvement unless false starts are logged clearly',
            ],
        };
    }

    if (name.includes('extended trial') || name.includes('trial-only') || name.includes('field-read trial')) {
        return {
            ...genericTheme,
            variantType: 'Trial variant',
            purpose: `This variant packages ${variant.family} as a standardized comparison-grade assessment while preserving ${familyBase?.mechanism ?? 'the family mechanism'}.`,
            expectedBenefit: 'Support research use, baseline/post comparisons, and cleaner benchmarking.',
            bestUse: [
                'the program needs a fixed assessment rather than an adaptive training rep',
                'results will be compared across time points, cohorts, or formal trial conditions',
                'Nora wants a version that exposes deterioration, pressure effects, or standardized performance under controlled settings',
            ],
            changes: [
                'duration expands into a comparison-grade session structure',
                'difficulty, schedule, and modifier profile are fixed instead of adapting live',
                'feedback is delayed until the end of the session',
            ],
            athleteFlow: [
                'Entry framing should set expectations without coaching away the challenge.',
                'The athlete should complete the full fixed protocol before any performance summary appears.',
                'Exit output should prioritize standardized reporting and comparison-friendly summaries.',
            ],
            scoringNotes: [
                `${familyBase?.coreMetric ?? 'The family metric'} remains the headline measure, with trial-specific breakdowns treated as secondary analytics.`,
                'Failed rounds, invalid trials, and environment/device metadata should be exported separately rather than flattened into the top-line result.',
            ],
            artifactRisks: [
                'dropout, device changes, and environmental inconsistency can invalidate comparison quality',
                'feedback leakage or adaptive behavior mid-session undermines trial standardization',
            ],
        };
    }

    if (name.includes('immersive') || name.includes('chamber') || name.includes('tunnel')) {
        return {
            ...genericTheme,
            variantType: 'Immersive variant',
            purpose: `This variant raises transfer fidelity by expressing ${variant.family} inside a more immersive environment while keeping ${familyBase?.mechanism ?? 'the same family mechanic'} intact.`,
            expectedBenefit: 'Increase realism, transfer credibility, and environmental specificity.',
            bestUse: [
                'the athlete needs a more embodied or environmental version of the family challenge',
                'the program wants higher-fidelity pressure without changing the family score architecture',
                'the build roadmap includes platform-specific immersive hardware or richer scene presentation',
            ],
            changes: [
                'environmental presentation, spatial cues, and atmosphere become more prominent',
                'pressure comes from immersion and contextual fidelity rather than a rule change',
                'analytics should capture immersion-specific state and device context',
            ],
            artifactRisks: [
                'device calibration, motion comfort, or rendering lag can distort the cognitive signal',
                'immersive presentation can accidentally add a second task if visual design is not tightly bounded',
            ],
        };
    }

    if (name.includes('sport') || name.includes('playbook') || name.includes('pre-shot') || name.includes('field-read')) {
        return {
            ...genericTheme,
            variantType: 'Sport-context variant',
            purpose: `This variant localizes ${variant.family} to a sport-recognizable situation without changing the parent-family mechanism.`,
            expectedBenefit: 'Increase transfer credibility, coach intuitiveness, and athlete buy-in.',
            bestUse: [
                'the athlete or coach responds better to sport-native framing than abstract drills',
                'the program wants stronger game-day relevance without changing core scoring logic',
                'Nora needs a version that is easier to explain in team or sport-specific language',
            ],
            changes: [
                'stimulus framing, copy, and environmental cues become sport-specific',
                'the family mechanism and metric remain unchanged beneath the sport wrapper',
                'variant assets should support transfer without introducing sport-specific rule drift',
            ],
        };
    }

    if (name.includes('visual') || name.includes('clutter') || name.includes('spotlight') || name.includes('peripheral')) {
        return {
            ...genericTheme,
            variantType: 'Visual-channel variant',
            purpose: `This variant emphasizes visual interference inside ${variant.family} while preserving the parent-family mechanism.`,
            expectedBenefit: 'Target visual-channel vulnerability and make the pressure source immediately legible.',
            bestUse: [
                'the athlete loses stability under visual clutter, peripheral bait, or screen-based interference',
                'Nora wants a clear visual-channel expression before layering in more channels',
                'the program needs a highly legible variant for visual attentional stress',
            ],
            changes: [
                'pressure is carried primarily through visual presentation rather than audio or cognitive provocation',
                'density, salience, and peripheral competition can scale by tier',
                'the target rule should remain clear even when the screen gets noisier',
            ],
            artifactRisks: [
                'overdesigned clutter can blur the live cue and accidentally change the task itself',
                'display lag, peripheral scaling, or contrast issues can distort difficulty',
            ],
        };
    }

    if (name.includes('audio') || name.includes('crowd') || name.includes('whistle') || name.includes('commentary')) {
        return {
            ...genericTheme,
            variantType: 'Audio-channel variant',
            purpose: `This variant emphasizes auditory interference inside ${variant.family} while preserving the parent-family mechanism.`,
            expectedBenefit: 'Target noise-heavy performance breakdowns and improve transfer to loud environments.',
            bestUse: [
                'the athlete is vulnerable to crowd, whistle, commentary, or startle-like sound environments',
                'Nora wants a sport-realistic audio-pressure version of the same family challenge',
                'the program needs channel-specific variety without changing task identity',
            ],
            changes: [
                'pressure is carried primarily through sound design and timing unpredictability',
                'visual presentation stays relatively stable so the channel emphasis remains auditory',
                'audio intensity and overlap should scale without becoming a second rule system',
            ],
            artifactRisks: [
                'audio routing, latency, or inconsistent hardware can distort the challenge',
                'volume spikes can create hardware artifacts that look cognitive if they are not logged',
            ],
        };
    }

    if (name.includes('combined') || name.includes('mixed') || name.includes('multi-source') || name.includes('dual-channel') || name.includes('overload')) {
        return {
            ...genericTheme,
            variantType: 'Combined-channel variant',
            purpose: `This variant layers multiple pressure channels at once while staying inside ${variant.family}.`,
            expectedBenefit: 'Bridge clean single-channel work into higher-load, competition-like complexity.',
            bestUse: [
                'the athlete handles isolated pressure but destabilizes when multiple channels compete simultaneously',
                'Nora wants a higher-load expression without promoting to a new family',
                'the program is preparing the athlete for immersive, sport-context, or trial-layer work',
            ],
            changes: [
                'multiple channels can overlap or stagger while the family mechanism remains the same',
                'analytics should log per-channel and overlap context rather than flattening everything into one unlabeled event stream',
                'difficulty should feel harder because of layered pressure, not because the task identity changed',
            ],
            artifactRisks: [
                'channel overlap can inflate random taps or rushed decisions if trigger-type tagging is missing',
                'timing misalignment across channels can create artificial difficulty spikes',
            ],
        };
    }

    if (name.includes('cognitive') || name.includes('provocation') || name.includes('ambiguous') || name.includes('confidence') || name.includes('late reveal')) {
        return {
            ...genericTheme,
            variantType: 'Cognitive-pressure variant',
            purpose: `This variant adds interpretive or psychological load to ${variant.family} without replacing the core family mechanism.`,
            expectedBenefit: 'Train stability when pressure arrives through thought disruption, self-talk, ambiguity, or evaluation rather than pure sensory noise.',
            bestUse: [
                'the athlete destabilizes under provocations, uncertainty, or evaluative messaging',
                'Nora wants the pressure channel to feel mental rather than purely sensory',
                'the program needs a more psychologically realistic expression of the same core task',
            ],
            changes: [
                'pressure comes from language, ambiguity, reveal timing, or psychologically loaded cues',
                'the athlete should still be solving the same family task underneath the provocation',
                'copy and pacing need tight guardrails so pressure stays sharp but not confusing',
            ],
        };
    }

    if (name.includes('fatigue') || name.includes('late') || name.includes('long') || name.includes('burn') || name.includes('endurance')) {
        return {
            ...genericTheme,
            variantType: 'Fatigue-load variant',
            purpose: `This variant expresses ${variant.family} under accumulating fatigue or late-session load while preserving the parent mechanism.`,
            expectedBenefit: 'Expose deterioration patterns and late-session breakdowns that shorter reps can miss.',
            bestUse: [
                'the athlete looks stable early but loses control late',
                'Nora needs a version that highlights fatigue sensitivity instead of fresh-state performance',
                'the program wants clearer late-session differentiation without changing the family task',
            ],
            changes: [
                'session pacing, duration, or late-round pressure are increased',
                'analysis should separate early, middle, and late behavior rather than relying on one average',
                'difficulty should rise through load accumulation, not by rewriting the task',
            ],
        };
    }

    if (name.includes('false') || name.includes('fakeout') || name.includes('decoy') || name.includes('bait') || name.includes('go/no-go')) {
        return {
            ...genericTheme,
            variantType: 'Discrimination / decoy variant',
            purpose: `This variant sharpens response control inside ${variant.family} by making the athlete resist convincing false triggers.`,
            expectedBenefit: 'Improve discrimination quality and reduce false starts or decoy-driven mistakes.',
            bestUse: [
                'the athlete is vulnerable to decoys, false starts, or convincing near-target signals',
                'Nora needs a stricter response-control expression of the family task',
                'the program wants to stress discrimination without changing the family score model',
            ],
            changes: [
                'decoy quality, false triggers, or near-correct cues become the main pressure source',
                'the real cue must stay definable so the variant remains measurable and fair',
                'analytics should classify decoy-triggered errors explicitly',
            ],
        };
    }

    return genericTheme;
}

function buildGeneratedVariantSpec(variant: VariantEntry): string {
    const familyBase = FAMILY_SPEC_BASES[variant.family];
    const theme = inferVariantTheme(variant);
    const today = 'March 9, 2026';

    return [
        '1. Core Identity',
        `Variant Name: ${variant.name}`,
        `Parent Family: ${variant.family}`,
        `Variant Type: ${theme.variantType}`,
        `Registry Mode: ${MODE_CONFIG[variant.mode].label}`,
        `Family Status: ${variant.familyStatus === 'locked' ? 'Locked Family' : 'Candidate Family'}`,
        `Status: ${mapVariantStatus(variant)}`,
        `Build Priority: ${mapPriority(variant.priority)}`,
        'Version: v0.1',
        `Generated On: ${today}`,
        '',
        '2. Why This Variant Exists',
        `Purpose: ${theme.purpose}`,
        `Expected Benefit: ${theme.expectedBenefit}`,
        'When Nora Should Assign:',
        ...theme.bestUse.map((item) => `- ${item}`),
        '',
        '3. Family Inheritance vs Variant Changes',
        `Inherited from ${variant.family} and the Sim Specification Standards Addendum:`,
        `- Core mechanism remains ${familyBase?.mechanism ?? 'defined by the parent family spec'}.`,
        `- Core metric remains ${familyBase?.coreMetric ?? 'the parent family metric'}.`,
        `- Primary skill targets remain ${familyBase?.skillTargets ?? 'the parent family skill architecture'}.`,
        `- Boundary rule remains ${familyBase?.boundaryRule ?? 'governed by the parent family spec'}.`,
        'What changes in this variant:',
        ...theme.changes.map((item) => `- ${item}`),
        '',
        '4. Athlete Experience Flow',
        ...theme.athleteFlow.map((item) => `- ${item}`),
        '',
        '5. Measurement and Scoring Notes',
        ...theme.scoringNotes.map((item) => `- ${item}`),
        'Artifact / false-start risks:',
        ...theme.artifactRisks.map((item) => `- ${item}`),
        '',
        '6. Mode Behavior',
        'Training Mode:',
        ...theme.trainingMode.map((item) => `- ${item}`),
        'Trial Mode:',
        ...theme.trialMode.map((item) => `- ${item}`),
        '',
        '7. Build and Implementation Notes',
        ...theme.buildNotes.map((item) => `- ${item}`),
        '',
        '8. Governing Documents',
        ...(familyBase?.governingDocs ?? [
            'Sim Specification Standards Addendum (v2)',
            `${variant.family} Family Spec`,
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ]).map((item) => `- ${item}`),
        '',
        '9. Boundary Safeguards',
        ...theme.boundarySafeguards.map((item) => `- ${item}`),
        '',
        '10. Variant Readiness Checklist',
        '- [ ] Core identity fields reviewed against the registry entry',
        '- [ ] Family inheritance and variant-specific changes confirmed',
        '- [ ] Measurement notes checked against family metric rules',
        '- [ ] Training Mode and Trial Mode behavior reviewed',
        '- [ ] Artifact risks and boundary safeguards documented',
        '- [ ] Build and data notes translated into implementation tasks',
    ].join('\n');
}

function inferModuleDifficulty(variant: VariantEntry): ExerciseDifficulty {
    if (variant.priority === 'high') return ExerciseDifficulty.Advanced;
    if (variant.priority === 'medium') return ExerciseDifficulty.Intermediate;
    return ExerciseDifficulty.Beginner;
}

function inferModuleDurationMinutes(variant: VariantEntry) {
    const name = variant.name.toLowerCase();
    if (name.includes('short daily')) return 3;
    if (name.includes('extended trial') || name.includes('trial')) return 8;
    if (name.includes('endurance') || name.includes('fatigue') || name.includes('long')) return 6;
    if (variant.mode === 'hybrid') return 4;
    return 5;
}

function inferModuleIcon(variant: VariantEntry) {
    if (variant.family === 'The Kill Switch') return 'rotate-ccw';
    if (variant.family === 'Noise Gate') return 'volume-x';
    if (variant.family === 'Brake Point') return 'hand';
    if (variant.family === 'Signal Window') return 'radar';
    if (variant.family === 'Sequence Shift') return 'shuffle';
    if (variant.family === 'Endurance Lock') return 'timer';
    return 'brain';
}

function mapFamilyToFocusType(variant: VariantEntry): 'single_point' | 'distraction' | 'cue_word' | 'body_scan' | 'kill_switch' {
    if (variant.family === 'The Kill Switch') return 'kill_switch';
    if (variant.family === 'Noise Gate') return 'distraction';
    if (variant.family === 'Quiet Eye') return 'single_point';
    return 'cue_word';
}

function buildDefaultRuntimeConfig(variant: VariantEntry) {
    const familyBase = FAMILY_SPEC_BASES[variant.family];
    const theme = inferVariantTheme(variant);

    return {
        schemaVersion: 'sim-variant-config/v1',
        variantId: buildSimVariantId(variant),
        family: variant.family,
        variantName: variant.name,
        mode: variant.mode,
        specStatus: variant.specStatus,
        mechanism: familyBase?.mechanism ?? '',
        primaryMetric: familyBase?.coreMetric ?? '',
        skillTargets: familyBase?.skillTargets ?? '',
        session: {
            durationMinutes: inferModuleDurationMinutes(variant),
            feedbackMode: variant.mode === 'hybrid' ? 'suppressed' : 'coached',
            adaptiveDifficulty: variant.mode !== 'hybrid',
        },
        stimuli: {
            variantType: theme.variantType,
            emphasis: theme.changes,
        },
        scoring: {
            headlineMetric: familyBase?.coreMetric ?? '',
            artifactRisks: theme.artifactRisks,
        },
        analytics: {
            tags: [variant.family, variant.mode, theme.variantType],
        },
        safeguards: theme.boundarySafeguards,
    };
}

function buildDefaultModuleDraft(variant: VariantEntry, sortOrder: number): SimVariantModuleDraft {
    const familyBase = FAMILY_SPEC_BASES[variant.family];
    const theme = inferVariantTheme(variant);

    return {
        moduleId: buildSimVariantId(variant),
        name: variant.name,
        description: theme.purpose,
        category: ExerciseCategory.Focus,
        difficulty: inferModuleDifficulty(variant),
        durationMinutes: inferModuleDurationMinutes(variant),
        benefits: [
            theme.expectedBenefit,
            familyBase?.skillTargets ?? 'Build pressure-ready execution',
            `${familyBase?.coreMetric ?? 'Core metric'} remains measurable inside the parent family`,
        ],
        bestFor: theme.bestUse.slice(0, 4),
        origin: `${variant.family} family module generated from the variant registry and governed by the family specification stack.`,
        neuroscience: `Targets ${familyBase?.skillTargets ?? 'pressure-ready cognitive execution'} through ${familyBase?.mechanism ?? 'the parent family mechanism'} while preserving the parent-family scoring model.`,
        overview: {
            when: theme.bestUse[0] || 'When the athlete needs this specific pressure expression',
            focus: familyBase?.skillTargets ?? 'Execution stability under pressure',
            timeScale: `${inferModuleDurationMinutes(variant)} minutes`,
            skill: familyBase?.coreMetric ?? 'Family metric reinforcement',
            analogy: `A focused ${theme.variantType.toLowerCase()} of ${variant.family}.`,
        },
        iconName: inferModuleIcon(variant),
        isActive: true,
        sortOrder,
    };
}

function resolveSpecStatus(record: SimVariantRecord): SpecStatus {
    if (record.mode === 'hybrid' || record.specStatus === 'not-required') return 'not-required';
    if (record.specStatus === 'complete') return 'complete';
    if (record.specRaw?.trim()) return 'in-progress';
    return 'needs-spec';
}

function buildVariantWorkspace(seed: VariantEntry, existing: SimVariantRecord | undefined, sortOrder: number): SimVariantRecord {
    const defaultModuleDraft = buildDefaultModuleDraft(seed, sortOrder);

    return {
        id: existing?.id ?? buildSimVariantId(seed),
        name: existing?.name ?? seed.name,
        family: existing?.family ?? seed.family,
        familyStatus: existing?.familyStatus ?? seed.familyStatus,
        mode: existing?.mode ?? seed.mode,
        priority: existing?.priority ?? seed.priority,
        specStatus: existing ? resolveSpecStatus(existing) : seed.specStatus,
        specRaw: existing?.specRaw ?? '',
        runtimeConfig: existing?.runtimeConfig ?? buildDefaultRuntimeConfig(seed),
        moduleDraft: {
            ...defaultModuleDraft,
            ...(existing?.moduleDraft ?? {}),
        },
        publishedModuleId: existing?.publishedModuleId,
        publishedAt: existing?.publishedAt,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: existing?.updatedAt ?? Date.now(),
    };
}

function createDraftVariantRecord(seed?: Partial<SimVariantSeed>, sortOrder: number = 999): SimVariantRecord {
    const draftSeed: VariantEntry = {
        name: seed?.name ?? 'New Variant',
        family: seed?.family ?? 'New Family',
        familyStatus: seed?.familyStatus ?? 'candidate',
        mode: seed?.mode ?? 'branch',
        specStatus: seed?.specStatus ?? 'needs-spec',
        priority: seed?.priority ?? 'medium',
    };
    const id = buildSimVariantId(draftSeed);
    const now = Date.now();
    return {
        ...buildVariantWorkspace(draftSeed, undefined, sortOrder),
        id,
        createdAt: now,
        updatedAt: now,
    };
}

function buildPublishedModule(record: SimVariantRecord): MentalExercise {
    const moduleDraft = record.moduleDraft ?? buildDefaultModuleDraft(record, 0);

    return {
        id: moduleDraft.moduleId,
        name: moduleDraft.name,
        description: moduleDraft.description,
        category: moduleDraft.category,
        difficulty: moduleDraft.difficulty,
        durationMinutes: moduleDraft.durationMinutes,
        exerciseConfig: {
            type: 'focus',
            config: {
                type: mapFamilyToFocusType(record),
                duration: moduleDraft.durationMinutes * 60,
                progressionLevel: record.priority === 'high' ? 4 : record.priority === 'medium' ? 3 : 2,
                instructions: [
                    `Run ${record.name} inside the ${record.family} family boundary.`,
                    `Train ${FAMILY_SPEC_BASES[record.family]?.skillTargets ?? 'execution stability under pressure'}.`,
                    'Keep the family metric interpretable and the runtime behavior consistent with the registry spec.',
                ],
            },
        },
        benefits: moduleDraft.benefits,
        bestFor: moduleDraft.bestFor,
        origin: moduleDraft.origin,
        neuroscience: moduleDraft.neuroscience,
        overview: moduleDraft.overview,
        iconName: moduleDraft.iconName,
        isActive: moduleDraft.isActive,
        sortOrder: moduleDraft.sortOrder,
        simSpecId: record.id,
        runtimeConfig: record.runtimeConfig,
        createdAt: record.createdAt,
        updatedAt: Date.now(),
    };
}

function formatVariantHistoryTimestamp(timestamp: number) {
    return new Date(timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function CreateVariantModal({
    onClose,
    onCreate,
    creating,
}: {
    onClose: () => void;
    onCreate: (seed: SimVariantSeed) => Promise<void>;
    creating: boolean;
}) {
    const [form, setForm] = useState<SimVariantSeed>({
        name: '',
        family: '',
        familyStatus: 'candidate',
        mode: 'branch',
        specStatus: 'needs-spec',
        priority: 'medium',
    });

    const canCreate = form.name.trim() && form.family.trim();

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
            onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
            <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 16 }}
                className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-[#0d1117] overflow-hidden"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                    <div>
                        <p className="text-sm font-bold text-white">Create Variant</p>
                        <p className="text-[10px] text-zinc-500">Add a new canonical variant directly into the Firestore-backed registry.</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                        <X className="w-4 h-4 text-zinc-400" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Variant Name</label>
                            <input
                                value={form.name}
                                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                                className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                placeholder="e.g. Pressure-Crowd Kill Switch"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Family</label>
                            <input
                                list="variant-family-options"
                                value={form.family}
                                onChange={(event) => setForm((current) => ({ ...current, family: event.target.value }))}
                                className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                placeholder="Select or type a family name"
                            />
                            <datalist id="variant-family-options">
                                {Object.keys(FAMILY_SPEC_BASES).map((family) => (
                                    <option key={family} value={family} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Family Status</label>
                            <select
                                value={form.familyStatus}
                                onChange={(event) => setForm((current) => ({ ...current, familyStatus: event.target.value as FamilyStatus }))}
                                className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                            >
                                <option value="locked">Locked</option>
                                <option value="candidate">Candidate</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Mode</label>
                            <select
                                value={form.mode}
                                onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as VariantMode }))}
                                className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                            >
                                <option value="branch">Branch</option>
                                <option value="library">Library</option>
                                <option value="hybrid">Hybrid</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Priority</label>
                            <select
                                value={form.priority}
                                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as VariantEntry['priority'] }))}
                                className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                            >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Spec Status</label>
                            <select
                                value={form.specStatus}
                                onChange={(event) => setForm((current) => ({ ...current, specStatus: event.target.value as SpecStatus }))}
                                className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                            >
                                <option value="needs-spec">Needs Spec</option>
                                <option value="in-progress">In Progress</option>
                                <option value="complete">Complete</option>
                                <option value="not-required">Not Required</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800 bg-black/20">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => canCreate && onCreate(form)}
                        disabled={!canCreate || creating}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#E0FE10] text-black hover:bg-[#c8e40e] disabled:opacity-40 transition-colors"
                    >
                        <Wrench className="w-3.5 h-3.5" />
                        {creating ? 'Creating...' : 'Create Variant'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

/* ---- VARIANT WORKSPACE MODAL ---- */
function VariantWorkspaceModal({
    variant,
    onClose,
    onSave,
    onPublish,
    initialSpecRaw,
    initialTab = 'spec',
    saving,
    publishing,
}: {
    variant: SimVariantRecord;
    onClose: () => void;
    onSave: (next: SimVariantRecord) => Promise<void>;
    onPublish: (next: SimVariantRecord) => Promise<void>;
    initialSpecRaw?: string;
    initialTab?: 'general' | 'spec' | 'config' | 'publish' | 'history';
    saving: boolean;
    publishing: boolean;
}) {
    const [variantMeta, setVariantMeta] = useState<SimVariantRecord>(variant);
    const familyColor = FAMILY_COLORS[variantMeta.family] || '#6b7280';
    const [activeTab, setActiveTab] = useState<'general' | 'spec' | 'config' | 'publish' | 'history'>(initialTab);
    const [rawSpec, setRawSpec] = useState(initialSpecRaw ?? variant.specRaw ?? '');
    const [parsed, setParsed] = useState<ParsedSpec | null>((initialSpecRaw ?? variant.specRaw)?.trim() ? parseVariantSpec(initialSpecRaw ?? variant.specRaw ?? '') : null);
    const [configText, setConfigText] = useState(JSON.stringify(variant.runtimeConfig ?? buildDefaultRuntimeConfig(variant), null, 2));
    const [configError, setConfigError] = useState<string | null>(null);
    const [moduleDraft, setModuleDraft] = useState<SimVariantModuleDraft>(variant.moduleDraft ?? buildDefaultModuleDraft(variant, 0));
    const [benefitsText, setBenefitsText] = useState((variant.moduleDraft?.benefits ?? []).join('\n'));
    const [bestForText, setBestForText] = useState((variant.moduleDraft?.bestFor ?? []).join('\n'));
    const [historyEntries, setHistoryEntries] = useState<SimVariantHistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [restoringHistoryId, setRestoringHistoryId] = useState<string | null>(null);

    useEffect(() => {
        const nextRawSpec = initialSpecRaw ?? variant.specRaw ?? '';
        const nextModuleDraft = variant.moduleDraft ?? buildDefaultModuleDraft(variant, 0);
        setVariantMeta(variant);
        setActiveTab(initialTab);
        setRawSpec(nextRawSpec);
        setParsed(nextRawSpec.trim() ? parseVariantSpec(nextRawSpec) : null);
        setConfigText(JSON.stringify(variant.runtimeConfig ?? buildDefaultRuntimeConfig(variant), null, 2));
        setConfigError(null);
        setModuleDraft(nextModuleDraft);
        setBenefitsText((nextModuleDraft.benefits ?? []).join('\n'));
        setBestForText((nextModuleDraft.bestFor ?? []).join('\n'));
    }, [variant, initialSpecRaw, initialTab]);

    useEffect(() => {
        let cancelled = false;

        const loadHistory = async () => {
            setHistoryLoading(true);
            try {
                const entries = await simVariantRegistryService.listHistory(variant.id);
                if (!cancelled) {
                    setHistoryEntries(entries);
                }
            } catch (error) {
                console.error('Failed to load variant history:', error);
                if (!cancelled) {
                    setHistoryEntries([]);
                }
            } finally {
                if (!cancelled) {
                    setHistoryLoading(false);
                }
            }
        };

        loadHistory();

        return () => {
            cancelled = true;
        };
    }, [variant.id, variant.updatedAt, variant.publishedAt]);

    const parseConfig = (value: string) => {
        setConfigText(value);
        try {
            JSON.parse(value);
            setConfigError(null);
        } catch (error: any) {
            setConfigError(error.message);
        }
    };

    const handleGenerateSpec = () => {
        const generated = buildGeneratedVariantSpec(variantMeta);
        setRawSpec(generated);
        setParsed(parseVariantSpec(generated));
        setActiveTab('spec');
    };

    const buildNextRecord = (): SimVariantRecord | null => {
        try {
            const runtimeConfig = JSON.parse(configText);
            return {
                ...variantMeta,
                specRaw: rawSpec,
                specStatus: variantMeta.mode === 'hybrid'
                    ? 'not-required'
                    : rawSpec.trim()
                        ? variantMeta.publishedModuleId
                            ? 'complete'
                            : 'in-progress'
                        : 'needs-spec',
                runtimeConfig,
                moduleDraft: {
                    ...moduleDraft,
                    benefits: benefitsText.split('\n').map((item) => item.trim()).filter(Boolean),
                    bestFor: bestForText.split('\n').map((item) => item.trim()).filter(Boolean),
                },
                updatedAt: Date.now(),
            };
        } catch (error: any) {
            setConfigError(error.message);
            setActiveTab('config');
            return null;
        }
    };

    const handleSave = async () => {
        const next = buildNextRecord();
        if (!next) return;
        if (rawSpec.trim()) {
            setParsed(parseVariantSpec(rawSpec));
        }
        await onSave(next);
    };

    const handlePublish = async () => {
        const next = buildNextRecord();
        if (!next) return;
        await onPublish(next);
    };

    const handleRestoreSnapshot = (entry: SimVariantHistoryEntry) => {
        setRestoringHistoryId(entry.id);
        const snapshot = entry.snapshot;
        const nextRawSpec = snapshot.specRaw ?? '';
        const nextModuleDraft = snapshot.moduleDraft ?? buildDefaultModuleDraft(snapshot, 0);
        setVariantMeta(snapshot);
        setRawSpec(nextRawSpec);
        setParsed(nextRawSpec.trim() ? parseVariantSpec(nextRawSpec) : null);
        setConfigText(JSON.stringify(snapshot.runtimeConfig ?? buildDefaultRuntimeConfig(snapshot), null, 2));
        setConfigError(null);
        setModuleDraft(nextModuleDraft);
        setBenefitsText((nextModuleDraft.benefits ?? []).join('\n'));
        setBestForText((nextModuleDraft.bestFor ?? []).join('\n'));
        setActiveTab('general');
        setRestoringHistoryId(null);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
            onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
            <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 16 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-zinc-800 overflow-hidden"
                style={{ background: '#0d1117' }}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: familyColor }} />
                        <div>
                            <p className="text-sm font-bold text-white">{variantMeta.name}</p>
                            <p className="text-[10px] text-zinc-500">
                                {variantMeta.family} · Variant Workspace · {variantMeta.publishedModuleId ? `Published as ${variantMeta.publishedModuleId}` : 'Not yet published'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                        <X className="w-4 h-4 text-zinc-400" />
                    </button>
                </div>

                <div className="flex items-center gap-1 px-5 pt-3 pb-0 border-b border-zinc-800 flex-shrink-0">
                    {([
                        { id: 'general' as const, label: 'General' },
                        { id: 'spec' as const, label: 'Spec' },
                        { id: 'config' as const, label: 'Runtime Config' },
                        { id: 'publish' as const, label: 'Publish' },
                        { id: 'history' as const, label: 'History' },
                    ]).map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${activeTab === tab.id
                                ? 'text-white border-purple-500'
                                : 'text-zinc-500 border-transparent hover:text-zinc-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {activeTab === 'general' && (
                        <div className="space-y-5">
                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                                <p className="text-xs text-blue-300 leading-relaxed">
                                    This is the canonical variant metadata. Edit it here so the spec, runtime config, and published module all stay aligned to one registry record.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Variant Name</label>
                                    <input
                                        value={variantMeta.name}
                                        onChange={(event) => setVariantMeta((current) => ({ ...current, name: event.target.value }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Family</label>
                                    <input
                                        list="workspace-family-options"
                                        value={variantMeta.family}
                                        onChange={(event) => setVariantMeta((current) => ({ ...current, family: event.target.value }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    />
                                    <datalist id="workspace-family-options">
                                        {Object.keys(FAMILY_SPEC_BASES).map((family) => (
                                            <option key={family} value={family} />
                                        ))}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Family Status</label>
                                    <select
                                        value={variantMeta.familyStatus}
                                        onChange={(event) => setVariantMeta((current) => ({ ...current, familyStatus: event.target.value as FamilyStatus }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    >
                                        <option value="locked">Locked</option>
                                        <option value="candidate">Candidate</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Mode</label>
                                    <select
                                        value={variantMeta.mode}
                                        onChange={(event) => setVariantMeta((current) => ({ ...current, mode: event.target.value as VariantMode }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    >
                                        <option value="branch">Branch</option>
                                        <option value="library">Library</option>
                                        <option value="hybrid">Hybrid</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Priority</label>
                                    <select
                                        value={variantMeta.priority}
                                        onChange={(event) => setVariantMeta((current) => ({ ...current, priority: event.target.value as VariantEntry['priority'] }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    >
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Current Spec Status</label>
                                    <div className="rounded-xl bg-black/40 border border-zinc-700 px-3 py-2.5 text-sm text-zinc-300">
                                        {SPEC_STATUS_CONFIG[
                                            variantMeta.mode === 'hybrid'
                                                ? 'not-required'
                                                : rawSpec.trim()
                                                    ? variantMeta.publishedModuleId
                                                        ? 'complete'
                                                        : 'in-progress'
                                                    : 'needs-spec'
                                        ].label}
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Variant Id</label>
                                    <div className="rounded-xl bg-black/40 border border-zinc-700 px-3 py-2.5 text-sm text-zinc-500 font-mono">
                                        {variantMeta.id}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'spec' && (
                        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                                    <p className="text-xs text-blue-300 leading-relaxed">
                                        The variant spec is the canonical design document. Save it here, then publish the resulting module from this same workspace.
                                    </p>
                                    <button
                                        onClick={handleGenerateSpec}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/15 transition-colors"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        Generate Draft
                                    </button>
                                </div>
                                <textarea
                                    value={rawSpec}
                                    onChange={(event) => setRawSpec(event.target.value)}
                                    placeholder="Paste or author the full variant spec here..."
                                    className="w-full min-h-[420px] rounded-xl bg-black/40 border border-zinc-700 text-xs text-zinc-300 placeholder-zinc-600 p-4 focus:outline-none focus:border-zinc-500 transition-colors resize-y font-mono leading-relaxed"
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Formatted Preview</p>
                                    <button
                                        onClick={() => rawSpec.trim() && setParsed(parseVariantSpec(rawSpec))}
                                        disabled={!rawSpec.trim()}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:bg-purple-500/15 transition-colors disabled:opacity-40"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        Refresh Preview
                                    </button>
                                </div>
                                <div className="rounded-xl border border-zinc-800 bg-black/20 p-4 min-h-[420px]">
                                    {!parsed ? (
                                        <div className="h-full flex items-center justify-center text-center text-zinc-600 text-sm">
                                            Parse the spec to see the structured preview.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {parsed.rawSections.map((section, index) => (
                                                <div key={`${section.heading}-${index}`} className="rounded-lg border border-zinc-800 overflow-hidden">
                                                    <div
                                                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white"
                                                        style={{ background: `${familyColor}10`, borderBottom: `1px solid ${familyColor}20` }}
                                                    >
                                                        <div
                                                            className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold"
                                                            style={{ background: `${familyColor}20`, color: familyColor }}
                                                        >
                                                            {index + 1}
                                                        </div>
                                                        {section.heading}
                                                    </div>
                                                    <div className="px-3 py-3 space-y-1">
                                                        {section.content.split('\n').filter(Boolean).map((line, lineIndex) => (
                                                            <p key={lineIndex} className="text-[11px] text-zinc-400 leading-relaxed">
                                                                {line.replace(/^[-•*]\s*/, '')}
                                                            </p>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'config' && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                                <p className="text-xs text-amber-300 leading-relaxed">
                                    Runtime config is where the registry defines the publishable sim behavior. Keep the family mechanism intact and treat this JSON as the module contract.
                                </p>
                            </div>
                            <textarea
                                value={configText}
                                onChange={(event) => parseConfig(event.target.value)}
                                className={`w-full min-h-[520px] rounded-xl bg-black/40 border text-xs text-zinc-300 p-4 focus:outline-none transition-colors resize-y font-mono leading-relaxed ${configError ? 'border-red-500/50' : 'border-zinc-700 focus:border-zinc-500'}`}
                            />
                            {configError && (
                                <p className="text-xs text-red-400">{configError}</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'publish' && (
                        <div className="space-y-5">
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                                <p className="text-xs text-emerald-300 leading-relaxed">
                                    Publish creates or updates a `sim-module` derived from this variant workspace. The registry remains the editing surface; the module is the runtime artifact.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Module Id</label>
                                    <input
                                        value={moduleDraft.moduleId}
                                        onChange={(event) => setModuleDraft((current) => ({ ...current, moduleId: event.target.value }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Module Name</label>
                                    <input
                                        value={moduleDraft.name}
                                        onChange={(event) => setModuleDraft((current) => ({ ...current, name: event.target.value }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Description</label>
                                <textarea
                                    value={moduleDraft.description}
                                    onChange={(event) => setModuleDraft((current) => ({ ...current, description: event.target.value }))}
                                    className="w-full min-h-[100px] rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500 resize-y"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Category</label>
                                    <select
                                        value={moduleDraft.category}
                                        onChange={(event) => setModuleDraft((current) => ({ ...current, category: event.target.value as ExerciseCategory }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    >
                                        {Object.values(ExerciseCategory).map((category) => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Difficulty</label>
                                    <select
                                        value={moduleDraft.difficulty}
                                        onChange={(event) => setModuleDraft((current) => ({ ...current, difficulty: event.target.value as ExerciseDifficulty }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    >
                                        {Object.values(ExerciseDifficulty).map((difficulty) => (
                                            <option key={difficulty} value={difficulty}>{difficulty}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Duration (min)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={moduleDraft.durationMinutes}
                                        onChange={(event) => setModuleDraft((current) => ({ ...current, durationMinutes: Number(event.target.value) || 1 }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Icon</label>
                                    <input
                                        value={moduleDraft.iconName}
                                        onChange={(event) => setModuleDraft((current) => ({ ...current, iconName: event.target.value }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Benefits (one per line)</label>
                                    <textarea
                                        value={benefitsText}
                                        onChange={(event) => setBenefitsText(event.target.value)}
                                        className="w-full min-h-[120px] rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500 resize-y"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Best For (one per line)</label>
                                    <textarea
                                        value={bestForText}
                                        onChange={(event) => setBestForText(event.target.value)}
                                        className="w-full min-h-[120px] rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500 resize-y"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Origin</label>
                                    <textarea
                                        value={moduleDraft.origin}
                                        onChange={(event) => setModuleDraft((current) => ({ ...current, origin: event.target.value }))}
                                        className="w-full min-h-[120px] rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500 resize-y"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Neuroscience</label>
                                    <textarea
                                        value={moduleDraft.neuroscience}
                                        onChange={(event) => setModuleDraft((current) => ({ ...current, neuroscience: event.target.value }))}
                                        className="w-full min-h-[120px] rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500 resize-y"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">When to Use</label>
                                    <input
                                        value={moduleDraft.overview.when}
                                        onChange={(event) => setModuleDraft((current) => ({ ...current, overview: { ...current.overview, when: event.target.value } }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Focus</label>
                                    <input
                                        value={moduleDraft.overview.focus}
                                        onChange={(event) => setModuleDraft((current) => ({ ...current, overview: { ...current.overview, focus: event.target.value } }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Time Scale</label>
                                    <input
                                        value={moduleDraft.overview.timeScale}
                                        onChange={(event) => setModuleDraft((current) => ({ ...current, overview: { ...current.overview, timeScale: event.target.value } }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Skill</label>
                                    <input
                                        value={moduleDraft.overview.skill}
                                        onChange={(event) => setModuleDraft((current) => ({ ...current, overview: { ...current.overview, skill: event.target.value } }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Analogy</label>
                                <input
                                    value={moduleDraft.overview.analogy}
                                    onChange={(event) => setModuleDraft((current) => ({ ...current, overview: { ...current.overview, analogy: event.target.value } }))}
                                    className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
                                <p className="text-xs text-cyan-300 leading-relaxed">
                                    Every save, seed, and publish writes a snapshot to Firestore. Load an earlier snapshot into the workspace if you need to inspect or restore a prior state before saving again.
                                </p>
                            </div>

                            {historyLoading ? (
                                <div className="min-h-[280px] flex items-center justify-center rounded-xl border border-zinc-800 bg-black/20">
                                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Loading version history...
                                    </div>
                                </div>
                            ) : historyEntries.length === 0 ? (
                                <div className="min-h-[280px] flex items-center justify-center rounded-xl border border-zinc-800 bg-black/20 text-sm text-zinc-500">
                                    No history entries yet for this variant.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {historyEntries.map((entry) => {
                                        const snapshotStatus = resolveSpecStatus(entry.snapshot);
                                        return (
                                            <div key={entry.id} className="rounded-xl border border-zinc-800 bg-black/20 p-4 space-y-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="px-2 py-1 rounded-md border border-zinc-700 bg-zinc-900 text-[10px] font-bold uppercase tracking-widest text-zinc-300">
                                                                {entry.action}
                                                            </span>
                                                            <span className="text-[10px] text-zinc-500">
                                                                {formatVariantHistoryTimestamp(entry.createdAt)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-white">{entry.summary}</p>
                                                        <p className="text-[11px] text-zinc-500">
                                                            Snapshot: {entry.snapshot.name} · {entry.snapshot.family} · {MODE_CONFIG[entry.snapshot.mode].label}
                                                            {entry.moduleId ? ` · Module ${entry.moduleId}` : ''}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRestoreSnapshot(entry)}
                                                        disabled={restoringHistoryId === entry.id}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 border border-zinc-700 text-white hover:border-zinc-500 disabled:opacity-50 transition-colors"
                                                    >
                                                        <RefreshCw className={`w-3.5 h-3.5 ${restoringHistoryId === entry.id ? 'animate-spin' : ''}`} />
                                                        {restoringHistoryId === entry.id ? 'Loading...' : 'Load Snapshot'}
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Spec Status</p>
                                                        <p className="text-xs text-white mt-1">{SPEC_STATUS_CONFIG[snapshotStatus].label}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Priority</p>
                                                        <p className="text-xs text-white mt-1">{mapPriority(entry.snapshot.priority)}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Runtime Schema</p>
                                                        <p className="text-xs text-white mt-1">{entry.snapshot.runtimeConfig?.schemaVersion ?? 'n/a'}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Published Module</p>
                                                        <p className="text-xs text-white mt-1">{entry.snapshot.publishedModuleId ?? 'Not published'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800 bg-black/20 flex-shrink-0">
                    <div className="text-[10px] text-zinc-500">
                        {variantMeta.publishedAt
                            ? `Last published ${new Date(variantMeta.publishedAt).toLocaleString()}`
                            : 'This variant has not been published to sim-modules yet'}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !!configError}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-800 border border-zinc-700 text-white hover:border-zinc-500 disabled:opacity-40 transition-colors"
                        >
                            <Save className="w-3.5 h-3.5" />
                            {saving ? 'Saving...' : 'Save Draft'}
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={publishing || !!configError}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#E0FE10] text-black hover:bg-[#c8e40e] disabled:opacity-40 transition-colors"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            {publishing ? 'Publishing...' : 'Publish to Sim Modules'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

/* ---- COLLAPSIBLE FAMILY GROUP ---- */
function FamilyGroup({
    familyName,
    familyStatus,
    variants,
    familyColor,
    onOpenWorkspace,
    onPasteSpec,
    onGenerateSpec,
}: {
    familyName: string;
    familyStatus: FamilyStatus;
    variants: SimVariantRecord[];
    familyColor: string;
    onOpenWorkspace: (variant: SimVariantRecord, options?: { initialTab?: 'general' | 'spec' | 'config' | 'publish' | 'history'; initialSpecRaw?: string }) => void;
    onPasteSpec: (variant: SimVariantRecord) => void;
    onGenerateSpec: (variant: SimVariantRecord) => void;
}) {
    const [open, setOpen] = useState(false);

    const specCounts = useMemo(() => {
        const counts = { 'needs-spec': 0, 'in-progress': 0, 'complete': 0, 'not-required': 0 };
        variants.forEach((v) => counts[v.specStatus]++);
        return counts;
    }, [variants]);

    const branchCount = variants.filter((v) => v.mode === 'branch').length;
    const libraryCount = variants.filter((v) => v.mode === 'library').length;
    const hybridCount = variants.filter((v) => v.mode === 'hybrid').length;

    return (
        <div className="border border-zinc-800 rounded-2xl overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-3 px-5 py-4 bg-black/20 hover:bg-black/40 transition-colors text-left"
            >
                {/* Family color dot */}
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: familyColor }} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{familyName}</span>
                        {familyStatus === 'locked' ? (
                            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 font-bold uppercase tracking-widest">
                                <Lock className="w-2.5 h-2.5" /> Locked
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold uppercase tracking-widest">
                                <FlaskConical className="w-2.5 h-2.5" /> Candidate
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-500">
                        <span>{variants.length} variants</span>
                        {branchCount > 0 && <span className="text-blue-400">{branchCount} branch</span>}
                        {libraryCount > 0 && <span className="text-purple-400">{libraryCount} library</span>}
                        {hybridCount > 0 && <span className="text-zinc-500">{hybridCount} hybrid</span>}
                        <span className="text-zinc-700">|</span>
                        {specCounts['needs-spec'] > 0 && (
                            <span className="text-red-400">{specCounts['needs-spec']} need spec</span>
                        )}
                        {specCounts['complete'] > 0 && (
                            <span className="text-green-400">{specCounts['complete']} complete</span>
                        )}
                    </div>
                </div>
                {/* Progress mini-bar */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                    {variants.map((v, i) => (
                        <div
                            key={i}
                            className="w-1.5 h-3 rounded-sm"
                            style={{ background: SPEC_STATUS_CONFIG[v.specStatus].color + '80' }}
                            title={`${v.name}: ${SPEC_STATUS_CONFIG[v.specStatus].label}`}
                        />
                    ))}
                </div>
                {open ? <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-zinc-800">
                            {/* Table header */}
                            <div className="grid grid-cols-[1fr_120px_130px_80px_112px] gap-2 px-5 py-2 bg-black/30 text-[9px] uppercase tracking-widest text-zinc-600 font-bold">
                                <span>Variant</span>
                                <span>Mode</span>
                                <span>Spec Status</span>
                                <span>Priority</span>
                                <span />
                            </div>
                            {/* Rows */}
                            {variants.map((v) => {
                                const modeConf = MODE_CONFIG[v.mode];
                                const ModeIcon = modeConf.icon;
                                const specConf = SPEC_STATUS_CONFIG[v.specStatus];
                                const SpecIcon = specConf.icon;
                                const priConf = PRIORITY_CONFIG[v.priority];
                                return (
                                    <div
                                        key={v.name}
                                        className="grid grid-cols-[1fr_120px_130px_80px_112px] gap-2 px-5 py-2 border-t border-zinc-800/50 hover:bg-white/[0.02] transition-colors items-center"
                                    >
                                        <span className="text-xs text-zinc-300 truncate">{v.name}</span>
                                        <span className="flex items-center gap-1.5">
                                            <ModeIcon className="w-3 h-3" style={{ color: modeConf.color }} />
                                            <span className="text-[10px]" style={{ color: modeConf.color }}>{modeConf.label}</span>
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <SpecIcon className="w-3 h-3" style={{ color: specConf.color }} />
                                            <span className="text-[10px] font-semibold" style={{ color: specConf.color }}>{specConf.label}</span>
                                        </span>
                                        <span className="text-[10px] font-semibold" style={{ color: priConf.color }}>{priConf.label}</span>
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onOpenWorkspace(v); }}
                                                title="Open variant workspace"
                                                className="flex items-center justify-center w-7 h-7 rounded-lg border border-zinc-700 bg-black/20 hover:border-blue-500/60 hover:bg-blue-500/10 transition-all group"
                                            >
                                                <Wrench className="w-3.5 h-3.5 text-zinc-600 group-hover:text-blue-400 transition-colors" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onGenerateSpec(v); }}
                                                title="Generate variant spec draft"
                                                className="flex items-center justify-center w-7 h-7 rounded-lg border border-zinc-700 bg-black/20 hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-all group"
                                            >
                                                <Sparkles className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onPasteSpec(v); }}
                                                title="Paste &amp; format variant spec"
                                                className="flex items-center justify-center w-7 h-7 rounded-lg border border-zinc-700 bg-black/20 hover:border-purple-500/60 hover:bg-purple-500/10 transition-all group"
                                            >
                                                <ClipboardPaste className="w-3.5 h-3.5 text-zinc-600 group-hover:text-purple-400 transition-colors" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ---- VARIANT SPEC TEMPLATE ---- */
function TemplateSection({ title, icon: Icon, accent = '#a1a1aa', children }: { title: string; icon: React.ElementType; accent?: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-black/20">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
                <p className="text-xs font-bold text-white">{title}</p>
            </div>
            <div className="px-4 py-3 space-y-2">{children}</div>
        </div>
    );
}

function FieldRow({ label, placeholder }: { label: string; placeholder: string }) {
    return (
        <div className="grid grid-cols-[140px_1fr] gap-3 items-start">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pt-0.5">{label}</p>
            <p className="text-[10px] text-zinc-600 italic leading-relaxed">{placeholder}</p>
        </div>
    );
}

function VariantSpecTemplate() {
    const [open, setOpen] = useState(false);
    return (
        <div className="bg-[#090f1c] border border-purple-500/20 rounded-2xl overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <FileCode2 className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white">Variant Specification Template</p>
                        <p className="text-[10px] text-zinc-500">Shared build-ready template for all core Sim variants</p>
                    </div>
                </div>
                {open ? <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-purple-500/20 p-5 space-y-5">

                            {/* Governing note */}
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                                <p className="text-xs text-amber-300 leading-relaxed">
                                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                                    Use this template when a Variant Registry entry has been prioritized for build, pilot testing, research use, or formal Trial deployment. Governed by the <span className="font-semibold">Sim Specification Standards Addendum</span>, the parent Family Spec, the Sim Family Tree, and the Promotion Protocol.
                                </p>
                            </div>

                            {/* §1 Purpose */}
                            <TemplateSection title="§1 · Purpose of This Template" icon={BookOpen} accent="#a78bfa">
                                <p className="text-[10px] text-zinc-400 leading-relaxed">
                                    A Variant Spec is created when a registry entry is prioritized for <span className="text-white font-semibold">build, pilot, research use, or formal Trial deployment</span>. Exploratory variants may remain in the registry until promoted into active scope.
                                </p>
                            </TemplateSection>

                            {/* §2 Design Rules */}
                            <TemplateSection title="§2 · Variant Design Rules" icon={Shield} accent="#22c55e">
                                <div className="space-y-1.5">
                                    {[
                                        { rule: 'May change', detail: 'Surface design, modifier configuration, pressure framing, duration, channel emphasis, sport context, or mode.' },
                                        { rule: 'Must not change', detail: "Parent family's core mechanism, core metric logic, skill targets, or family boundaries — unless being evaluated for promotion." },
                                        { rule: 'Mode separation', detail: 'Training Mode and Trial Mode behavior must be explicitly separated when the variant supports both.' },
                                    ].map((item) => (
                                        <div key={item.rule} className="flex items-start gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${item.rule === 'Must not change' ? 'bg-red-500' : 'bg-green-500'}`} />
                                            <div>
                                                <span className="text-[10px] font-bold text-white">{item.rule}: </span>
                                                <span className="text-[10px] text-zinc-400">{item.detail}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TemplateSection>

                            {/* §3 Core Identity */}
                            <TemplateSection title="§3 · Core Identity" icon={FileCode2} accent="#60a5fa">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {[
                                        { label: 'Variant Name', ph: 'Official name as registered in the Sim Family Tree.' },
                                        { label: 'Parent Family', ph: 'Which locked or candidate family this belongs to.' },
                                        { label: 'Variant Type', ph: 'Branch Variant / Library Variant / Hybrid / Trial.' },
                                        { label: 'Spec Version', ph: 'e.g. v1.0 · [Month Year]' },
                                        { label: 'Governing Docs', ph: 'List parent Family Spec version, Addendum version, Family Tree version.' },
                                        { label: 'Variant Status', ph: 'Build-Ready / In Pilot / Research Use / Trial Deployment / Exploratory.' },
                                    ].map(({ label, ph }) => (
                                        <div key={label} className="rounded-lg border border-zinc-800 bg-black/20 px-3 py-2">
                                            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-0.5">{label}</p>
                                            <p className="text-[10px] text-zinc-600 italic">{ph}</p>
                                        </div>
                                    ))}
                                </div>
                            </TemplateSection>

                            {/* §4 Why This Variant Exists */}
                            <TemplateSection title="§4 · Why This Variant Exists" icon={Zap} accent="#facc15">
                                <div className="space-y-2">
                                    <FieldRow label="Variant Rationale" placeholder="Explain why this variant exists and what gap it fills inside the parent family." />
                                    <FieldRow label="Expected Benefit" placeholder="What this variant should improve: adherence, transfer credibility, pressure specificity, sport localization, or trial fidelity." />
                                    <FieldRow label="When Nora Should Assign" placeholder="Define the athlete profile, modifier condition, or use case that should trigger this variant." />
                                </div>
                            </TemplateSection>

                            {/* §5 Inheritance vs Changes */}
                            <TemplateSection title="§5 · Family Inheritance vs Variant Changes" icon={GitBranch} accent="#34d399">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                                        <p className="text-[9px] uppercase tracking-widest font-bold text-green-400 mb-2">Inherited from Family Spec</p>
                                        <p className="text-[10px] text-zinc-600 italic">List every element inherited unchanged: core mechanism, core metric, skill targets, scoring logic, modifier compatibility categories, evidence framework.</p>
                                    </div>
                                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                                        <p className="text-[9px] uppercase tracking-widest font-bold text-blue-400 mb-2">Variant-Specific Changes</p>
                                        <p className="text-[10px] text-zinc-600 italic">List every element that changes in this variant: stimulus type, pressure framing, duration, channel, context, mode behavior. Each change must stay within allowed bounds.</p>
                                    </div>
                                </div>
                            </TemplateSection>

                            {/* §6 Athlete Experience Flow */}
                            <TemplateSection title="§6 · Athlete Experience Flow" icon={Gamepad2} accent="#f97316">
                                <div className="space-y-2">
                                    <FieldRow label="Entry Framing" placeholder="How this variant should be introduced to the athlete in-product." />
                                    <FieldRow label="Core Interaction Loop" placeholder="Step-by-step athlete flow from start screen to end-of-session summary." />
                                    <FieldRow label="Pressure Presentation" placeholder="How the pressure type appears without changing the family mechanism." />
                                    <FieldRow label="Session Exit Summary" placeholder="What feedback is shown after the session by mode (Training vs Trial)." />
                                </div>
                            </TemplateSection>

                            {/* §7 Measurement and Scoring Notes */}
                            <TemplateSection title="§7 · Measurement and Scoring Notes" icon={Ruler} accent="#38bdf8">
                                <div className="space-y-2">
                                    <FieldRow label="Rules Inheritance" placeholder="State exactly which rules are inherited from the Family Spec and Addendum." />
                                    <FieldRow label="Variant-Specific Scoring" placeholder="Any additional handling: channel weighting, decoy classification, timing windows, or sport-context annotations." />
                                    <FieldRow label="Artifact / False Start Risk" placeholder="Call out any variant-specific artifact risks and how they should be flagged." />
                                    <FieldRow label="Research Notes" placeholder="State whether this variant is acceptable for standardized comparison, exploratory use only, or trial deployment." />
                                </div>
                            </TemplateSection>

                            {/* §8 Mode Behavior */}
                            <TemplateSection title="§8 · Mode Behavior" icon={BarChart3} accent="#c084fc">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                                        <p className="text-[9px] uppercase tracking-widest font-bold text-blue-400 mb-2">Training Mode</p>
                                        <p className="text-[10px] text-zinc-600 italic">Feedback behavior, adaptive difficulty handling, intra-session data display, and session length for Training Mode.</p>
                                    </div>
                                    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3">
                                        <p className="text-[9px] uppercase tracking-widest font-bold text-purple-400 mb-2">Trial Mode</p>
                                        <p className="text-[10px] text-zinc-600 italic">Standardized duration, fixed difficulty level, feedback suppression rules, and output format for Trial Mode.</p>
                                    </div>
                                </div>
                            </TemplateSection>

                            {/* §9 Build and Implementation Notes */}
                            <TemplateSection title="§9 · Build and Implementation Notes" icon={Wrench} accent="#fb923c">
                                <div className="space-y-2">
                                    <FieldRow label="Engineering Notes" placeholder="Implementation details, seeds, asset dependencies, or analytics hooks unique to this variant." />
                                    <FieldRow label="Design Notes" placeholder="UI, motion, audio, or environment notes specific to this variant." />
                                    <FieldRow label="Data Notes" placeholder="Fields that must be logged for assignment, scoring, and later analysis." />
                                    <FieldRow label="Boundary Safeguards" placeholder="How to ensure this variant remains inside the parent family and does not drift into another family or hybrid." />
                                </div>
                            </TemplateSection>

                            {/* §10 Readiness Checklist */}
                            <TemplateSection title="§10 · Variant Readiness Checklist" icon={ListChecks} accent="#22c55e">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                    {[
                                        'Core Identity fields complete',
                                        'Family inheritance vs. variant changes documented',
                                        'Measurement rules inheritance explicitly stated',
                                        'Variant-specific scoring notes complete',
                                        'Artifact / false start risks documented',
                                        'Training Mode behavior documented',
                                        'Trial Mode behavior documented (if applicable)',
                                        'Engineering, design, and data notes complete',
                                        'Boundary safeguards specified',
                                        'Research use classification stated',
                                    ].map((item) => (
                                        <div key={item} className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-black/20 px-3 py-2">
                                            <Circle className="w-3 h-3 text-zinc-700 flex-shrink-0 mt-0.5" />
                                            <p className="text-[10px] text-zinc-500">{item}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3 mt-2">
                                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                                        <span className="text-zinc-400 font-semibold">Note:</span> Create a full Variant Spec only for prioritized build variants, pilot variants, research variants, or formal Trial variants. Exploratory variants may remain in the Variant Registry until promoted into active scope.
                                    </p>
                                </div>
                            </TemplateSection>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ---- MAIN TAB ---- */
const VariantRegistryTab: React.FC = () => {
    const [registryVariants, setRegistryVariants] = useState<SimVariantRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [creatingVariant, setCreatingVariant] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [savingVariantId, setSavingVariantId] = useState<string | null>(null);
    const [publishingVariantId, setPublishingVariantId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterFamilyStatus, setFilterFamilyStatus] = useState<'all' | FamilyStatus>('all');
    const [filterMode, setFilterMode] = useState<'all' | VariantMode>('all');
    const [filterSpecStatus, setFilterSpecStatus] = useState<'all' | SpecStatus>('all');
    const [workspaceModalState, setWorkspaceModalState] = useState<{
        variantId: string;
        initialTab?: 'general' | 'spec' | 'config' | 'publish' | 'history';
        initialRaw?: string;
    } | null>(null);

    const loadRegistry = async (showSeedToast: boolean = false) => {
        setLoading(true);
        try {
            const { records, created } = await simVariantRegistryService.syncSeeds(VARIANT_REGISTRY);
            const existingById = new Map(records.map((record) => [record.id, record]));
            const seededIds = new Set(VARIANT_REGISTRY.map((seed) => buildSimVariantId(seed)));
            const merged = VARIANT_REGISTRY.map((seed, index) =>
                buildVariantWorkspace(seed, existingById.get(buildSimVariantId(seed)), index + 1)
            );
            const customVariants = records
                .filter((record) => !seededIds.has(record.id))
                .sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));
            setRegistryVariants([...merged, ...customVariants]);

            if (created > 0 && showSeedToast) {
                setToast({
                    type: 'success',
                    message: `Synced ${created} registry variants into Firestore.`,
                });
            }
        } catch (error) {
            console.error('Failed to load variant registry:', error);
            setToast({
                type: 'error',
                message: 'Failed to load the Firestore-backed variant registry.',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRegistry(true);
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timer = window.setTimeout(() => setToast(null), 3000);
        return () => window.clearTimeout(timer);
    }, [toast]);

    const filteredVariants = useMemo(() => {
        return registryVariants.filter((v) => {
            if (searchQuery && !v.name.toLowerCase().includes(searchQuery.toLowerCase()) && !v.family.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            if (filterFamilyStatus !== 'all' && v.familyStatus !== filterFamilyStatus) return false;
            if (filterMode !== 'all' && v.mode !== filterMode) return false;
            if (filterSpecStatus !== 'all' && resolveSpecStatus(v) !== filterSpecStatus) return false;
            return true;
        });
    }, [registryVariants, searchQuery, filterFamilyStatus, filterMode, filterSpecStatus]);

    // Group by family
    const familyGroups = useMemo(() => {
        const groups: Record<string, { familyStatus: FamilyStatus; variants: SimVariantRecord[] }> = {};
        filteredVariants.forEach((v) => {
            if (!groups[v.family]) {
                groups[v.family] = { familyStatus: v.familyStatus, variants: [] };
            }
            groups[v.family].variants.push(v);
        });
        // Sort: locked families first, then candidates
        return Object.entries(groups).sort(([, a], [, b]) => {
            if (a.familyStatus === 'locked' && b.familyStatus === 'candidate') return -1;
            if (a.familyStatus === 'candidate' && b.familyStatus === 'locked') return 1;
            return 0;
        });
    }, [filteredVariants]);

    // Summary stats
    const stats = useMemo(() => {
        const total = registryVariants.length;
        const needsSpec = registryVariants.filter((v) => resolveSpecStatus(v) === 'needs-spec').length;
        const inProgress = registryVariants.filter((v) => resolveSpecStatus(v) === 'in-progress').length;
        const complete = registryVariants.filter((v) => resolveSpecStatus(v) === 'complete').length;
        const notRequired = registryVariants.filter((v) => resolveSpecStatus(v) === 'not-required').length;
        const lockedFamilies = new Set(registryVariants.filter((v) => v.familyStatus === 'locked').map((v) => v.family)).size;
        const candidateFamilies = new Set(registryVariants.filter((v) => v.familyStatus === 'candidate').map((v) => v.family)).size;
        const published = registryVariants.filter((v) => !!v.publishedModuleId).length;
        return { total, needsSpec, inProgress, complete, notRequired, lockedFamilies, candidateFamilies, published };
    }, [registryVariants]);

    const activeFilters = [filterFamilyStatus, filterMode, filterSpecStatus].filter((f) => f !== 'all').length + (searchQuery ? 1 : 0);
    const selectedVariant = workspaceModalState
        ? registryVariants.find((variant) => variant.id === workspaceModalState.variantId) ?? null
        : null;

    const handleSaveWorkspace = async (next: SimVariantRecord) => {
        setSavingVariantId(next.id);
        try {
            await simVariantRegistryService.save(next);
            setRegistryVariants((current) => current.map((variant) => variant.id === next.id ? next : variant));
            setToast({
                type: 'success',
                message: `${next.name} saved to the variant registry.`,
            });
        } catch (error) {
            console.error('Failed to save variant workspace:', error);
            setToast({
                type: 'error',
                message: `Failed to save ${next.name}.`,
            });
        } finally {
            setSavingVariantId(null);
        }
    };

    const handlePublishWorkspace = async (next: SimVariantRecord) => {
        setPublishingVariantId(next.id);
        try {
            const module = buildPublishedModule(next);
            const moduleId = await simVariantRegistryService.publish(next, module);
            const publishedRecord: SimVariantRecord = {
                ...next,
                publishedModuleId: moduleId,
                publishedAt: Date.now(),
                specStatus: next.mode === 'hybrid' ? 'not-required' : 'complete',
            };
            setRegistryVariants((current) => current.map((variant) => variant.id === next.id ? publishedRecord : variant));
            setWorkspaceModalState(null);
            setToast({
                type: 'success',
                message: `${next.name} published to sim-modules as ${moduleId}.`,
            });
        } catch (error) {
            console.error('Failed to publish variant workspace:', error);
            setToast({
                type: 'error',
                message: `Failed to publish ${next.name}.`,
            });
        } finally {
            setPublishingVariantId(null);
        }
    };

    const handleCreateVariant = async (seed: SimVariantSeed) => {
        const nextRecord = createDraftVariantRecord(seed, registryVariants.length + 1);
        setCreatingVariant(true);
        try {
            await simVariantRegistryService.save(nextRecord);
            setRegistryVariants((current) => [...current, nextRecord]);
            setShowCreateModal(false);
            setWorkspaceModalState({
                variantId: nextRecord.id,
                initialTab: 'general',
            });
            setToast({
                type: 'success',
                message: `${nextRecord.name} created in the variant registry.`,
            });
        } catch (error) {
            console.error('Failed to create variant:', error);
            setToast({
                type: 'error',
                message: 'Failed to create the new variant.',
            });
        } finally {
            setCreatingVariant(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[420px] flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading Firestore-backed variant registry...
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-8">
                {/* HEADER */}
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <BookOpen className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">PULSE CHECK</p>
                                <h2 className="text-xl font-semibold">Variant Registry</h2>
                                <p className="text-xs text-zinc-500">Canonical control plane for specs, runtime configs, and published sim modules</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={async () => {
                                setSyncing(true);
                                await loadRegistry(true);
                                setSyncing(false);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-semibold text-white hover:border-zinc-500 transition-colors"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Syncing...' : 'Sync Registry'}
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E0FE10] text-black text-xs font-semibold hover:bg-[#c8e40e] transition-colors"
                        >
                            <Wrench className="w-3.5 h-3.5" />
                            New Variant
                        </button>
                    </div>
                </div>

                {/* SUMMARY CARDS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-[#090f1c] border border-zinc-800 rounded-xl px-4 py-3">
                        <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Total Variants</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
                        <p className="text-[10px] text-zinc-500">{stats.lockedFamilies} locked + {stats.candidateFamilies} candidate families</p>
                    </div>
                    <div className="bg-[#090f1c] border border-red-500/20 rounded-xl px-4 py-3">
                        <p className="text-[9px] uppercase tracking-widest text-red-400 font-bold">Needs Spec</p>
                        <p className="text-2xl font-bold text-red-400 mt-1">{stats.needsSpec}</p>
                        <p className="text-[10px] text-zinc-500">{Math.round((stats.needsSpec / stats.total) * 100)}% of total registry</p>
                    </div>
                    <div className="bg-[#090f1c] border border-green-500/20 rounded-xl px-4 py-3">
                        <p className="text-[9px] uppercase tracking-widest text-green-400 font-bold">Complete</p>
                        <p className="text-2xl font-bold text-green-400 mt-1">{stats.complete}</p>
                        <p className="text-[10px] text-zinc-500">{stats.published} published modules</p>
                    </div>
                    <div className="bg-[#090f1c] border border-zinc-800 rounded-xl px-4 py-3">
                        <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Not Required</p>
                        <p className="text-2xl font-bold text-zinc-400 mt-1">{stats.notRequired}</p>
                        <p className="text-[10px] text-zinc-500">Hybrids / trial expressions</p>
                    </div>
                </div>

                {/* RULES CALLOUT */}
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Shield className="w-4 h-4 text-purple-400" /> Registry Rules
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                            <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-1">Need Variant Specs</p>
                            <div className="space-y-1">
                                {[
                                    'All named variants under locked families',
                                    'All named variants under candidate families (if build-ready during incubation)',
                                ].map((r) => (
                                    <div key={r} className="flex items-start gap-1.5">
                                        <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-zinc-400">{r}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-xl border border-zinc-700 bg-black/30 p-3">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Do Not Need Variant Specs</p>
                            <div className="space-y-1">
                                {[
                                    'Hybrid modules (composites assembled from existing families)',
                                    'Trial expressions as standalone taxonomy objects',
                                ].map((r) => (
                                    <div key={r} className="flex items-start gap-1.5">
                                        <Circle className="w-3 h-3 text-zinc-600 flex-shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-zinc-500">{r}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* VARIANT SPEC TEMPLATE */}
                <VariantSpecTemplate />

                {/* FILTERS */}
                <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-zinc-500" />
                        <span className="text-xs font-semibold text-zinc-400">Filters</span>
                        {activeFilters > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">{activeFilters} active</span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Search variants or families..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-zinc-700 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                            />
                        </div>
                        {/* Family status filter */}
                        <select
                            value={filterFamilyStatus}
                            onChange={(e) => setFilterFamilyStatus(e.target.value as 'all' | FamilyStatus)}
                            className="px-3 py-2 rounded-xl bg-black/40 border border-zinc-700 text-xs text-white focus:outline-none focus:border-zinc-500 transition-colors appearance-none cursor-pointer"
                        >
                            <option value="all">All Families</option>
                            <option value="locked">Locked Only</option>
                            <option value="candidate">Candidate Only</option>
                        </select>
                        {/* Mode filter */}
                        <select
                            value={filterMode}
                            onChange={(e) => setFilterMode(e.target.value as 'all' | VariantMode)}
                            className="px-3 py-2 rounded-xl bg-black/40 border border-zinc-700 text-xs text-white focus:outline-none focus:border-zinc-500 transition-colors appearance-none cursor-pointer"
                        >
                            <option value="all">All Modes</option>
                            <option value="branch">Branch Variants</option>
                            <option value="library">Library Variants</option>
                            <option value="hybrid">Hybrids / Trials</option>
                        </select>
                        {/* Spec status filter */}
                        <select
                            value={filterSpecStatus}
                            onChange={(e) => setFilterSpecStatus(e.target.value as 'all' | SpecStatus)}
                            className="px-3 py-2 rounded-xl bg-black/40 border border-zinc-700 text-xs text-white focus:outline-none focus:border-zinc-500 transition-colors appearance-none cursor-pointer"
                        >
                            <option value="all">All Spec Statuses</option>
                            <option value="needs-spec">Needs Spec</option>
                            <option value="in-progress">In Progress</option>
                            <option value="complete">Complete</option>
                            <option value="not-required">Not Required</option>
                        </select>
                    </div>
                </div>

                {/* REGISTRY TABLE — GROUPED BY FAMILY */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-zinc-400">
                            Showing <span className="text-white font-semibold">{filteredVariants.length}</span> variants across <span className="text-white font-semibold">{familyGroups.length}</span> families
                        </p>
                        {activeFilters > 0 && (
                            <button
                                onClick={() => { setSearchQuery(''); setFilterFamilyStatus('all'); setFilterMode('all'); setFilterSpecStatus('all'); }}
                                className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>

                    {familyGroups.map(([familyName, group]) => (
                        <FamilyGroup
                            key={familyName}
                            familyName={familyName}
                            familyStatus={group.familyStatus}
                            variants={group.variants}
                            familyColor={FAMILY_COLORS[familyName] || '#6b7280'}
                            onOpenWorkspace={(variant, options) => setWorkspaceModalState({
                                variantId: variant.id,
                                initialTab: options?.initialTab,
                                initialRaw: options?.initialSpecRaw,
                            })}
                            onPasteSpec={(variant) => setWorkspaceModalState({ variantId: variant.id, initialTab: 'spec' })}
                            onGenerateSpec={(variant) => setWorkspaceModalState({
                                variantId: variant.id,
                                initialTab: 'spec',
                                initialRaw: buildGeneratedVariantSpec(variant),
                            })}
                        />
                    ))}

                    {familyGroups.length === 0 && (
                        <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-10 text-center">
                            <Search className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                            <p className="text-sm text-zinc-500">No variants match the current filters.</p>
                        </div>
                    )}
                </div>

                {/* PROGRESS OVERVIEW */}
                <section className="space-y-4 pb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-400" /> Spec Completion by Family
                    </h3>
                    <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                        {Object.entries(
                            registryVariants.reduce((acc, v) => {
                                if (!acc[v.family]) acc[v.family] = { total: 0, complete: 0, inProgress: 0, needsSpec: 0, notRequired: 0, familyStatus: v.familyStatus };
                                acc[v.family].total++;
                                acc[v.family][
                                    resolveSpecStatus(v) === 'needs-spec' ? 'needsSpec' :
                                        resolveSpecStatus(v) === 'in-progress' ? 'inProgress' :
                                            resolveSpecStatus(v) === 'complete' ? 'complete' : 'notRequired'
                                ]++;
                                return acc;
                            }, {} as Record<string, { total: number; complete: number; inProgress: number; needsSpec: number; notRequired: number; familyStatus: FamilyStatus }>)
                        )
                            .sort(([, a], [, b]) => {
                                if (a.familyStatus === 'locked' && b.familyStatus === 'candidate') return -1;
                                if (a.familyStatus === 'candidate' && b.familyStatus === 'locked') return 1;
                                return 0;
                            })
                            .map(([family, data]) => {
                                const specRequired = data.total - data.notRequired;
                                const pct = specRequired > 0 ? Math.round((data.complete / specRequired) * 100) : 100;
                                return (
                                    <div key={family} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ background: FAMILY_COLORS[family] || '#6b7280' }} />
                                                <span className="text-xs font-semibold text-white">{family}</span>
                                                {data.familyStatus === 'candidate' && (
                                                    <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase tracking-widest font-bold">Candidate</span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-zinc-500">{data.complete}/{specRequired} specs ({pct}%)</span>
                                        </div>
                                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
                                            {data.complete > 0 && (
                                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(data.complete / data.total) * 100}%` }} />
                                            )}
                                            {data.inProgress > 0 && (
                                                <div className="h-full bg-amber-500" style={{ width: `${(data.inProgress / data.total) * 100}%` }} />
                                            )}
                                            {data.needsSpec > 0 && (
                                                <div className="h-full bg-red-500/30" style={{ width: `${(data.needsSpec / data.total) * 100}%` }} />
                                            )}
                                            {data.notRequired > 0 && (
                                                <div className="h-full bg-zinc-700" style={{ width: `${(data.notRequired / data.total) * 100}%` }} />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        <div className="flex items-center gap-4 mt-2 text-[9px] text-zinc-600">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Complete</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> In Progress</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500/30" /> Needs Spec</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-zinc-700" /> Not Required</span>
                        </div>
                    </div>
                </section>
            </div>

            {/* VARIANT WORKSPACE MODAL */}
            <AnimatePresence>
                {selectedVariant && workspaceModalState && (
                    <VariantWorkspaceModal
                        variant={selectedVariant}
                        initialSpecRaw={workspaceModalState.initialRaw}
                        initialTab={workspaceModalState.initialTab}
                        saving={savingVariantId === selectedVariant.id}
                        publishing={publishingVariantId === selectedVariant.id}
                        onSave={handleSaveWorkspace}
                        onPublish={handlePublishWorkspace}
                        onClose={() => setWorkspaceModalState(null)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showCreateModal && (
                    <CreateVariantModal
                        creating={creatingVariant}
                        onCreate={handleCreateVariant}
                        onClose={() => setShowCreateModal(false)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border text-xs font-semibold shadow-xl ${toast.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/10 border-red-500/20 text-red-300'
                            }`}
                    >
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default VariantRegistryTab;
