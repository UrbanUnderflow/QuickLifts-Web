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
    Play,
} from 'lucide-react';
import {
    ExerciseCategory,
    ExerciseDifficulty,
    simModuleLibraryService,
    simVariantRegistryService,
    type MentalExercise,
    type SimBuildStatus,
    type SimSyncStatus,
} from '../../../api/firebase/mentaltraining';
import {
    type SimVariantArchetype,
    buildSimVariantId,
    type SimVariantHistoryEntry,
    type SimVariantFamilyStatus,
    type SimVariantLockedSpec,
    type SimVariantMode,
    type SimVariantModuleDraft,
    type SimVariantRecord,
    type SimVariantSeed,
    type SimVariantSpecStatus,
} from '../../../api/firebase/mentaltraining/variantRegistryService';
import {
    applyDraftSyncState,
    buildPublishedModuleFromVariant,
    buildPublishedVariantRecord,
    buildVariantRecordForBuild,
    summarizeVariantSyncDiff,
} from '../../../api/firebase/mentaltraining/simBuild';
import { ExercisePlayer } from '../../mentaltraining';

/* ---- TYPES ---- */
type SpecStatus = SimVariantSpecStatus;
type FamilyStatus = SimVariantFamilyStatus;
type VariantMode = SimVariantMode;
type VariantEntry = SimVariantSeed & Partial<Pick<SimVariantRecord, 'lockedSpec'>>;

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

interface SpecAuditFinding {
    severity: 'error' | 'warning';
    code: string;
    message: string;
}

interface SpecAuditReport {
    status: 'pass' | 'pass_with_warnings' | 'needs_input';
    score: number;
    findings: SpecAuditFinding[];
    autoFixes: string[];
    fixedRaw: string;
}

interface WarningFixAction {
    key: 'protocol_wording' | 'sport_wording' | 'normalize_terms' | 'tighten_wording' | 'consolidate_build_notes';
    label: string;
    codes: string[];
}

interface WarningFixFeedback {
    label: string;
    previousWarningCount: number;
    currentWarningCount: number;
}

interface WarningFixGroup {
    key: string;
    label: string;
    findings: SpecAuditFinding[];
    fixable: boolean;
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
    archetype: SimVariantArchetype;
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

interface VariantArchetypeProfile {
    label: string;
    variantType: string;
    purpose: string;
    expectedBenefit: string;
    bestUse: string[];
    changes: string[];
    athleteFlow: string[];
    scoringNotes: string[];
    artifactRisks: string[];
    buildNotes: string[];
    runtimeDefaults: {
        feedbackMode: 'coached' | 'suppressed';
        adaptiveDifficulty: boolean;
        emphasis: string[];
        analyticsFocus: string[];
    };
}

interface VariantProfileOverride {
    variantType?: string;
    purpose?: string;
    expectedBenefit?: string;
    bestUse?: string[];
    changes?: string[];
    athleteFlow?: string[];
    scoringNotes?: string[];
    artifactRisks?: string[];
    buildNotes?: string[];
    runtimeDefaults?: Partial<VariantArchetypeProfile['runtimeDefaults']>;
    durationMinutes?: number;
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

const BUILD_STATUS_CONFIG: Record<SimBuildStatus, { label: string; color: string }> = {
    not_built: { label: 'Not Built', color: '#71717a' },
    built: { label: 'Built', color: '#38bdf8' },
    published: { label: 'Published', color: '#22c55e' },
    out_of_sync: { label: 'Out of Sync', color: '#f59e0b' },
    build_error: { label: 'Build Error', color: '#ef4444' },
};

const SYNC_STATUS_CONFIG: Record<SimSyncStatus, { label: string; color: string }> = {
    in_sync: { label: 'In Sync', color: '#22c55e' },
    spec_changed: { label: 'Spec Changed', color: '#f59e0b' },
    config_changed: { label: 'Runtime Changed', color: '#f59e0b' },
    module_changed: { label: 'Module Changed', color: '#f59e0b' },
    build_stale: { label: 'Build Stale', color: '#f97316' },
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
        coreMetric: 'Correct Read Under Time Pressure',
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
        coreMetric: 'Update Accuracy After Rule Change',
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

function normalizeSpecText(raw: string) {
    return raw
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function dedupeBulletLines(raw: string) {
    const lines = raw.split('\n');
    const seen = new Set<string>();
    let removed = 0;
    const nextLines = lines.filter((line) => {
        const trimmed = line.trim();
        if (!trimmed.match(/^-\s+/)) {
            return true;
        }
        const key = trimmed.toLowerCase();
        if (seen.has(key)) {
            removed += 1;
            return false;
        }
        seen.add(key);
        return true;
    });
    return {
        raw: nextLines.join('\n'),
        removed,
    };
}

function extractSectionBullets(parsed: ParsedSpec, sectionKeyword: string) {
    const section = parsed.rawSections.find((entry) => entry.heading.toLowerCase().includes(sectionKeyword.toLowerCase()));
    if (!section) return [];
    return section.content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('- '))
        .map((line) => line.replace(/^-+\s*/, '').trim());
}

function extractSectionByKeyword(parsed: ParsedSpec, sectionKeyword: string) {
    return parsed.rawSections.find((entry) => entry.heading.toLowerCase().includes(sectionKeyword.toLowerCase())) ?? null;
}

function replaceSectionBullets(raw: string, sectionKeyword: string, bullets: string[]) {
    const parsed = parseVariantSpec(raw);
    const nextSections = parsed.rawSections.map((entry) => {
        if (!entry.heading.toLowerCase().includes(sectionKeyword.toLowerCase())) {
            return entry;
        }
        return {
            ...entry,
            content: bullets.map((bullet) => `- ${bullet}`).join('\n'),
        };
    });

    return nextSections
        .map((entry) => {
            const body = entry.content?.trim();
            return body ? `${entry.heading}\n${body}` : entry.heading;
        })
        .join('\n\n');
}

function normalizeAuditPhrase(text: string) {
    return text
        .toLowerCase()
        .replace(/late-probe|late probe|finish-phase|finish phase/g, 'final phase')
        .replace(/old-rule|old rule/g, 'old rule')
        .replace(/first-correct-after-shift|first correct after shift/g, 'first correct after shift')
        .replace(/phase-of-play|phase of play/g, 'phase of play')
        .replace(/shot-clock|shot clock/g, 'shot clock')
        .replace(/motor artifacts?/g, 'motor artifact')
        .replace(/responses?/g, 'response')
        .replace(/markers?/g, 'marker')
        .replace(/tags?/g, 'tag')
        .replace(/fields?/g, 'field')
        .replace(/windows?/g, 'window')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeOverlapTokens(line: string) {
    return line
        .toLowerCase()
        .replace(/late-probe|late probe|finish-phase|finish phase/g, 'final_phase')
        .replace(/old-rule|old rule/g, 'old_rule')
        .replace(/first-correct-after-shift|first correct after shift/g, 'first_correct_after_shift')
        .replace(/phase-of-play|phase of play/g, 'phase_of_play')
        .replace(/shot-clock|shot clock/g, 'shot_clock')
        .replace(/[^a-z0-9_ ]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .filter((token) => !new Set([
            'store',
            'export',
            'keep',
            'mark',
            'this',
            'variant',
            'family',
            'mode',
            'session',
            'record',
            'tags',
            'tag',
            'markers',
            'marker',
            'fields',
            'field',
            'notes',
            'build',
            'data',
            'and',
            'the',
            'a',
            'an',
            'to',
            'of',
            'in',
            'so',
            'that',
            'with',
            'rather',
            'than',
            'for',
            'into',
            'all',
            'one',
            'same',
        ]).has(token));
}

function runPolishAudit(parsed: ParsedSpec, findings: SpecAuditFinding[]) {
    const buildBullets = extractSectionBullets(parsed, 'build');
    const measurementBullets = extractSectionBullets(parsed, 'measurement');
    const tagLikeBullets = buildBullets.filter((bullet) => /\b(tag|tags|marker|markers|field|fields)\b/i.test(bullet));
    const seenMessages = new Set<string>();

    const pushFinding = (code: string, message: string) => {
        const key = `${code}:${message}`;
        if (seenMessages.has(key)) {
            return;
        }
        seenMessages.add(key);
        findings.push({
            severity: 'warning',
            code,
            message,
        });
    };

    if (buildBullets.length > 1) {
        const normalizedBullets = buildBullets.map((bullet) => normalizeAuditPhrase(bullet));
        for (let i = 0; i < normalizedBullets.length; i += 1) {
            for (let j = i + 1; j < normalizedBullets.length; j += 1) {
                if (normalizedBullets[i] === normalizedBullets[j]) {
                    pushFinding(
                        'near_duplicate_build_note',
                        'Build notes contain near-duplicate implementation guidance. Consider consolidating repeated bullets.'
                    );
                }
            }
        }
    }

    for (let i = 0; i < tagLikeBullets.length; i += 1) {
        for (let j = i + 1; j < tagLikeBullets.length; j += 1) {
            const left = normalizeOverlapTokens(tagLikeBullets[i]);
            const right = normalizeOverlapTokens(tagLikeBullets[j]);
            const overlap = left.filter((token) => right.includes(token));

            if (overlap.length > 0 && !overlap.every((token) => ['variant', 'assignment'].includes(token))) {
                pushFinding(
                    'overlapping_build_notes',
                    `Build notes may contain overlapping tagging concepts (${overlap.join(', ')}). Consider consolidating closely related storage bullets.`
                );
                return;
            }
        }
    }

    const finalPhaseBullets = buildBullets.filter((bullet) => /finish-phase|finish phase|late-probe|late probe/i.test(bullet));
    if (finalPhaseBullets.length > 1) {
        pushFinding(
            'final_phase_term_overlap',
            'Build notes use overlapping final-phase terms such as "finish-phase" and "late-probe." Consider consolidating to one shared term.'
        );
    }

    const metricLine = measurementBullets.find((bullet) => /headline metric|headline score/i.test(bullet));
    if (metricLine) {
        const normalizedMetricLine = normalizeAuditPhrase(metricLine);
        const overlappingBuildMetric = buildBullets.find((bullet) => {
            const normalizedBuild = normalizeAuditPhrase(bullet);
            return normalizedMetricLine
                .split(' ')
                .filter((token) => token.length > 4)
                .some((token) => normalizedBuild.includes(token));
        });

        if (overlappingBuildMetric && /headline metric|headline score/i.test(overlappingBuildMetric)) {
            pushFinding(
                'metric_build_redundancy',
                'Build notes repeat metric-language that is already defined in Measurement and Scoring Notes. Consider keeping build notes implementation-specific.'
            );
        }
    }

    const buildSection = extractSectionByKeyword(parsed, 'build');
    if (buildSection) {
        const storeCount = buildBullets.filter((bullet) => /^store\b/i.test(bullet)).length;
        const exportCount = buildBullets.filter((bullet) => /^export\b/i.test(bullet)).length;
        if (storeCount >= 3 && exportCount >= 1) {
            pushFinding(
                'dense_build_section',
                'Build notes are dense and may contain overlapping storage/export instructions. Consider collapsing closely related bullets for readability.'
            );
        }
    }
}

function buildExpectedSectionLabels(variant: VariantEntry) {
    if (isTrialVariant(variant)) {
        return [
            '1. Core Identity',
            '2. Variant Rationale',
            '3. Fixed Trial Protocol',
            '4. Family Inheritance vs Variant Changes',
            '5. Athlete Experience Flow',
            '6. Measurement Precision and Scoring Rules',
            '7. Transfer Metric and Reporting',
            '8. Session Validity, Retry, and Dropout Rules',
            '9. Mode Behavior',
            '10. Research Alignment and Validation Status',
            '11. Build and Data Export Requirements',
            '12. Governing Documents',
            '13. Boundary Safeguards',
            '14. Variant Readiness Checklist',
        ];
    }

    return [
        '1. Core Identity',
        '2. Why This Variant Exists',
        '3. Archetype Packaging Defaults',
        '4. Family Inheritance vs Variant Changes',
        '5. Athlete Experience Flow',
        '6. Measurement and Scoring Notes',
        '7. Mode Behavior',
        '8. Build and Implementation Notes',
        '9. Governing Documents',
        '10. Boundary Safeguards',
        '11. Variant Readiness Checklist',
    ];
}

function includesAnyPhrase(lowerRaw: string, phrases: string[]) {
    return phrases.some((phrase) => lowerRaw.includes(phrase.toLowerCase()));
}

function pushArchetypeRequirementFinding(
    findings: SpecAuditFinding[],
    lowerRaw: string,
    code: string,
    message: string,
    phrases: string[]
) {
    if (!includesAnyPhrase(lowerRaw, phrases)) {
        findings.push({
            severity: 'warning',
            code,
            message,
        });
    }
}

function runNonTrialArchetypeAudit(variant: VariantEntry, lowerRaw: string, findings: SpecAuditFinding[]) {
    const archetype = resolveVariantArchetype(variant);

    pushArchetypeRequirementFinding(
        findings,
        lowerRaw,
        'missing_archetype_label',
        `Non-trial spec should explicitly name the resolved archetype (${ARCHETYPE_LABELS[archetype]}).`,
        [`Archetype: ${ARCHETYPE_LABELS[archetype]}`]
    );

    pushArchetypeRequirementFinding(
        findings,
        lowerRaw,
        'missing_runtime_emphasis',
        'Non-trial spec should include runtime emphasis so packaging is not purely narrative.',
        ['runtime emphasis:']
    );

    pushArchetypeRequirementFinding(
        findings,
        lowerRaw,
        'missing_analytics_focus',
        'Non-trial spec should include analytics focus so the module is measurable, not just described.',
        ['analytics focus:']
    );

    pushArchetypeRequirementFinding(
        findings,
        lowerRaw,
        'missing_feedback_default',
        'Non-trial spec should document default feedback mode and adaptation behavior.',
        ['default feedback mode is', 'adaptive difficulty is']
    );

    switch (archetype) {
        case 'short_daily':
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'short_daily_missing_daily_packaging',
                'Short-daily variants should explicitly frame daily compliance or quick-repeat packaging.',
                ['high-compliance daily', 'daily completion', 'quick, high-compliance daily rep', 'short session length']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'short_daily_missing_trend_guidance',
                'Short-daily variants should emphasize trend language over heavy benchmark interpretation.',
                ['trend language', 'trend over single-session volatility', 'trend rather than', 'daily trend']
            );
            break;
        case 'visual_channel':
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'visual_channel_missing_channel_definition',
                'Visual-channel variants should explicitly describe visual interference or clutter as the pressure source.',
                ['visual interference', 'visual clutter', 'peripheral', 'visual presentation']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'visual_channel_missing_artifact_risk',
                'Visual-channel variants should document display-specific artifact risks.',
                ['display lag', 'contrast issues', 'peripheral scaling', 'screen gets noisier']
            );
            break;
        case 'audio_channel':
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'audio_channel_missing_channel_definition',
                'Audio-channel variants should explicitly describe sound-driven interference.',
                ['audio interference', 'crowd', 'commentary', 'whistle', 'sound design']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'audio_channel_missing_artifact_risk',
                'Audio-channel variants should document routing, latency, or hardware risks.',
                ['audio routing', 'latency', 'hardware', 'volume spikes']
            );
            break;
        case 'combined_channel':
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'combined_channel_missing_overlap_logic',
                'Combined-channel variants should explicitly describe layered or overlapping pressure channels.',
                ['multiple channels', 'layered channels', 'channel overlap', 'overlap timing']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'combined_channel_missing_channel_analytics',
                'Combined-channel variants should include per-channel or overlap-tagged analytics language.',
                ['per-channel', 'overlap context', 'channel overlap', 'unlabeled event stream']
            );
            break;
        case 'cognitive_pressure':
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'cognitive_pressure_missing_pressure_definition',
                'Cognitive-pressure variants should name provocation, ambiguity, or evaluative load explicitly.',
                ['provocation', 'ambiguity', 'evaluative', 'psychologically loaded', 'mental rather than purely sensory']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'cognitive_pressure_missing_guardrails',
                'Cognitive-pressure variants should include guardrails so pressure does not drift into a different task.',
                ['same family task', 'same core task', 'tight guardrails', 'not confusing']
            );
            break;
        case 'sport_context':
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'sport_context_missing_framing',
                'Sport-context variants should explicitly describe sport-native or game-day framing.',
                ['sport-native', 'sport-specific', 'game-day relevance', 'sport-recognizable']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'sport_context_missing_boundary',
                'Sport-context variants should explicitly protect against sport wrapper drift changing the family mechanism.',
                ['mechanism and metric remain unchanged', 'without changing core scoring logic', 'without changing the parent-family mechanism', 'without changing the family score architecture']
            );
            break;
        case 'immersive':
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'immersive_missing_fidelity_definition',
                'Immersive variants should explicitly describe environmental fidelity or spatial context.',
                ['immersive environment', 'environmental fidelity', 'spatial', 'device context', 'higher-fidelity pressure']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'immersive_missing_artifact_risk',
                'Immersive variants should document calibration, motion comfort, or rendering risks.',
                ['device calibration', 'motion comfort', 'rendering lag', 'second task']
            );
            break;
        case 'fatigue_load':
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'fatigue_missing_load_progression',
                'Fatigue-load variants should explicitly describe accumulation, late-session load, or deterioration.',
                ['load accumulation', 'late-session', 'fatigue', 'late-round pressure']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'fatigue_missing_segmented_analysis',
                'Fatigue-load variants should separate early, middle, and late performance rather than one flat summary.',
                ['early, middle, and late behavior', 'early-mid-late comparisons', 'late-session deterioration', 'degradation']
            );
            break;
        case 'decoy_discrimination':
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'decoy_missing_decoy_definition',
                'Decoy/discrimination variants should explicitly describe false triggers or near-target cues.',
                ['decoy', 'false trigger', 'near-target', 'false starts']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'decoy_missing_decoy_analytics',
                'Decoy/discrimination variants should explicitly tag decoy-driven errors in analytics.',
                ['decoy-triggered errors', 'false-start / decoy error rates', 'discrimination quality', 'classify decoy']
            );
            break;
        case 'baseline':
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'baseline_missing_packaging_specificity',
                'Baseline variants should still document concrete packaging defaults so the spec does not stay generic.',
                ['recommended session length defaults to', 'family-consistent presentation', 'variant-specific tags']
            );
            break;
        default:
            break;
    }
}

function runNonTrialFamilyAudit(variant: VariantEntry, lowerRaw: string, findings: SpecAuditFinding[]) {
    const archetype = resolveVariantArchetype(variant);

    if (variant.family === 'The Kill Switch') {
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'kill_switch_missing_valid_reengagement',
            'Kill Switch specs should explicitly define valid re-engagement as two consecutive correct responses.',
            ['two consecutive correct responses', 'confirmed re-engagement']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'kill_switch_missing_false_start_logic',
            'Kill Switch specs should explicitly define false starts as responses during the disruption phase.',
            ['false start', 'responses during the disruption phase', 'response during disruption']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'kill_switch_missing_attentional_shift_sourcing',
            'Kill Switch specs should explicitly describe Attentional Shifting as multi-source.',
            ['attentional shifting', 'multi-source', 'first-post-reset accuracy']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'kill_switch_missing_pressure_stability_sourcing',
            'Kill Switch specs should explicitly describe Pressure Stability as modifier-stratified.',
            ['pressure stability', 'modifier-stratified', 'modifier condition']
        );

        if (archetype === 'sport_context') {
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'kill_switch_sport_context_missing_context_tags',
                'Sport-context Kill Switch variants should store sport/scenario/reset-moment tags so transfer claims are inspectable.',
                ['sport', 'scenario', 'reset moment', 'phase of play', 'context tag']
            );
        }
    }

    if (variant.family === 'Noise Gate') {
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'noise_gate_missing_cost_formula',
            'Noise Gate specs should explicitly define Distractor Cost and mention RT shift, not just name the family metric.',
            ['distractor cost =', 'rt shift', 'response time shift']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'noise_gate_missing_false_alarm_logic',
            'Noise Gate specs should explicitly define false alarms as distractor-directed responses.',
            ['false alarm', 'responses directed at distractors', 'distractor rather than the primary target']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'noise_gate_missing_channel_vulnerability',
            'Noise Gate specs should explicitly require channel-vulnerability breakdowns by distractor type.',
            ['channel vulnerability', 'broken down by distractor type', 'per distractor channel']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'noise_gate_missing_valid_response_rule',
            'Noise Gate specs should include the family valid-response definition and 150 ms artifact floor.',
            ['valid response = correct response to the primary target', 'above 150 ms', '150 ms']
        );

        if (archetype === 'audio_channel') {
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'noise_gate_audio_missing_setup_logging',
                'Audio-channel Noise Gate variants should explicitly log audio route and sound-subtype tags.',
                ['audio route', 'crowd', 'commentary', 'whistle', 'off-rhythm sound']
            );
        }

        if (archetype === 'combined_channel') {
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'noise_gate_combined_missing_overlap_export',
                'Combined-channel Noise Gate variants should explicitly store per-channel trigger tags and overlap timing windows.',
                ['overlap timing', 'per-channel trigger tags', 'visual-only', 'audio-only', 'combined overlap']
            );
        }
    }

    if (variant.family === 'Brake Point') {
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'brake_point_missing_valid_response_rule',
            'Brake Point specs should explicitly define valid Go behavior and the 150 ms artifact floor.',
            ['valid go response', 'above 150 ms', '150 ms']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'brake_point_missing_false_alarm_classification',
            'Brake Point specs should classify false alarms by No-Go type.',
            ['false alarm', 'no-go type', 'obvious', 'fakeout', 'late-reveal']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'brake_point_missing_over_inhibition',
            'Brake Point specs should include over-inhibition handling so athletes cannot solve inhibition by slowing down.',
            ['over-inhibition', 'go miss', 'go reaction time']
        );
    }

    if (variant.family === 'Signal Window') {
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'signal_window_missing_valid_commit_rule',
            'Signal Window specs should define the valid response as the first committed response after display onset.',
            ['first committed response', 'display onset', 'one response per trial']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'signal_window_missing_correct_read_formula',
            'Signal Window specs should define the combined read metric and latency logic explicitly.',
            ['correct read under time pressure', 'decision latency', 'weighted by decision latency']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'signal_window_missing_window_utilization',
            'Signal Window specs should include window-utilization tracking for strategy analysis.',
            ['window utilization', 'available display window', 'decision strategy']
        );

        if (archetype === 'sport_context') {
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'signal_window_sport_missing_context_tags',
                'Sport-context Signal Window variants should store sport/scenario/cue-context tags for interpretability.',
                ['sport', 'scenario', 'cue type', 'phase of play', 'shot-clock']
            );
        }
    }

    if (variant.family === 'Sequence Shift') {
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'sequence_shift_missing_post_shift_window',
            'Sequence Shift specs should explicitly define the post-shift measurement window.',
            ['post-shift', 'first 3–5 trials', 'first 3-5 trials']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'sequence_shift_missing_intrusion_logic',
            'Sequence Shift specs should classify old-rule intrusions separately from novel errors.',
            ['old-rule intrusion', 'intrusion', 'novel error']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'sequence_shift_missing_switch_cost',
            'Sequence Shift specs should include switch-cost logic, not just update accuracy alone.',
            ['switch cost', 'pre-shift rolling average']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'sequence_shift_missing_artifact_floor',
            'Sequence Shift specs should include the 150 ms artifact floor on post-shift trials.',
            ['150 ms', 'post-shift trials', 'motor artifacts']
        );
    }

    if (variant.family === 'Endurance Lock') {
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'endurance_missing_baseline_period',
            'Endurance Lock specs should explicitly define the baseline period before degradation is measured.',
            ['first 2-3 minutes', 'first 2–3 minutes', 'baseline period', '100% baseline']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'endurance_missing_onset_definition',
            'Endurance Lock specs should explicitly define degradation onset, not just mention late-session fatigue.',
            ['below 90% of baseline', 'degradation onset', 'one full block']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'endurance_missing_slope_definition',
            'Endurance Lock specs should explicitly define Degradation Slope over the session second half.',
            ['second half', '% drop per minute', 'degradation slope']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'endurance_missing_block_outputs',
            'Endurance Lock specs should include block-level tracking and attribution.',
            ['block-by-block', 'early, mid, and late', 'embedded task attribution']
        );
    }
}

function applySpecAutoFixes(variant: VariantEntry, raw: string) {
    let next = normalizeSpecText(raw);
    const autoFixes: string[] = [];

    if (next.includes('device type')) {
        next = next.replace(/device type/gi, 'device class');
        autoFixes.push('Normalized "device type" to "device class".');
    }

    if (isTrialVariant(variant) && next.includes('for the full 12 minutes session')) {
        next = next.replace(/for the full (\d+) minutes session/gi, 'for the full $1-minute session');
        autoFixes.push('Normalized fixed-duration session phrasing.');
    }

    if (isTrialVariant(variant) && next.includes('Keep environment requirements fixed per assessment point')) {
        next = next.replace(
            /Keep environment requirements fixed per assessment point/gi,
            'Keep environment requirements standardized and logged across all comparison points for the same protocol version'
        );
        autoFixes.push('Tightened environment consistency wording for Trial protocol.');
    }

    const deduped = dedupeBulletLines(next);
    next = deduped.raw;
    if (deduped.removed > 0) {
        autoFixes.push(`Removed ${deduped.removed} duplicate bullet line${deduped.removed === 1 ? '' : 's'}.`);
    }

    return {
        fixedRaw: normalizeSpecText(next),
        autoFixes,
    };
}

function runSpecAuditPipeline(variant: VariantEntry, raw: string): SpecAuditReport {
    const { fixedRaw, autoFixes } = applySpecAutoFixes(variant, raw);
    const findings: SpecAuditFinding[] = [];
    const expectedSections = buildExpectedSectionLabels(variant);
    const parsed = parseVariantSpec(fixedRaw);
    const normalizedHeadings = parsed.rawSections.map((section) => section.heading.trim());
    const lowerRaw = fixedRaw.toLowerCase();
    const lockedSpec = ensureLockedSpec(variant);

    expectedSections.forEach((heading) => {
        if (!normalizedHeadings.some((value) => value.toLowerCase() === heading.toLowerCase())) {
            findings.push({
                severity: 'error',
                code: 'missing_section',
                message: `Missing required section: ${heading}.`,
            });
        }
    });

    if (isTrialVariant(variant) && lockedSpec) {
        const requiredTrialPhrases = [
            lockedSpec.fixedTier.toLowerCase(),
            lockedSpec.fixedDuration.toLowerCase(),
            lockedSpec.targetSessionStructure.toLowerCase(),
            'transfer gap',
            'build version',
            'device class',
        ];

        requiredTrialPhrases.forEach((phrase) => {
            if (!lowerRaw.includes(phrase)) {
                findings.push({
                    severity: 'error',
                    code: 'missing_trial_protocol_detail',
                    message: `Trial spec is missing a required protocol detail: "${phrase}".`,
                });
            }
        });

        if (!lowerRaw.includes('75% valid outcomes') || !lowerRaw.includes('50–74% valid outcomes') || !lowerRaw.includes('20% false starts')) {
            findings.push({
                severity: 'error',
                code: 'validity_threshold_mismatch',
                message: 'Trial validity thresholds do not fully reflect the Addendum-aligned valid / partial / invalid rules.',
            });
        }
    }

    if (lowerRaw.includes('device type')) {
        findings.push({
            severity: 'warning',
            code: 'terminology_mismatch',
            message: 'Use "device class" consistently instead of mixing "device type" and "device class".',
        });
    }

    ['roughly', 'typically', 'generally'].forEach((term) => {
        if (lowerRaw.includes(term)) {
            findings.push({
                severity: 'warning',
                code: 'vague_language',
                message: `Spec still contains vague language: "${term}".`,
            });
        }
    });

    if (!isTrialVariant(variant)) {
        runNonTrialArchetypeAudit(variant, lowerRaw, findings);
        runNonTrialFamilyAudit(variant, lowerRaw, findings);
    }

    runPolishAudit(parsed, findings);

    const errorCount = findings.filter((finding) => finding.severity === 'error').length;
    const warningCount = findings.filter((finding) => finding.severity === 'warning').length;
    const autoFixPenalty = autoFixes.length > 0 ? Math.min(6, autoFixes.length * 3) : 0;
    const score = Math.max(0, 100 - (errorCount * 20) - (warningCount * 8) - autoFixPenalty);
    const status: SpecAuditReport['status'] = errorCount > 0
        ? 'needs_input'
        : warningCount > 0 || autoFixes.length > 0
            ? 'pass_with_warnings'
            : 'pass';

    return {
        status,
        score,
        findings,
        autoFixes,
        fixedRaw,
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

const ARCHETYPE_LABELS: Record<SimVariantArchetype, string> = {
    baseline: 'Baseline Variant',
    trial: 'Trial Variant',
    short_daily: 'Short Daily Variant',
    visual_channel: 'Visual Channel Variant',
    audio_channel: 'Audio Channel Variant',
    combined_channel: 'Combined Channel Variant',
    cognitive_pressure: 'Cognitive Pressure Variant',
    sport_context: 'Sport Context Variant',
    immersive: 'Immersive Variant',
    fatigue_load: 'Fatigue Load Variant',
    decoy_discrimination: 'Decoy / Discrimination Variant',
};

function resolveVariantArchetype(variant: VariantEntry): SimVariantArchetype {
    if (variant.archetypeOverride) {
        return variant.archetypeOverride;
    }

    const name = variant.name.toLowerCase();
    if (name.includes('short daily')) return 'short_daily';
    if (name.includes('extended trial') || name.includes('trial-only') || name.includes('field-read trial')) return 'trial';
    if (name.includes('immersive') || name.includes('chamber') || name.includes('tunnel')) return 'immersive';
    if (name.includes('sport') || name.includes('playbook') || name.includes('pre-shot') || name.includes('field-read') || name.includes('shot-clock')) return 'sport_context';
    if (name.includes('visual') || name.includes('clutter') || name.includes('spotlight') || name.includes('peripheral')) return 'visual_channel';
    if (name.includes('audio') || name.includes('crowd') || name.includes('whistle') || name.includes('commentary')) return 'audio_channel';
    if (name.includes('combined') || name.includes('mixed') || name.includes('multi-source') || name.includes('dual-channel') || name.includes('overload')) return 'combined_channel';
    if (name.includes('cognitive') || name.includes('provocation') || name.includes('ambiguous') || name.includes('confidence') || name.includes('late reveal')) return 'cognitive_pressure';
    if (name.includes('fatigue') || name.includes('late') || name.includes('long') || name.includes('burn') || name.includes('endurance')) return 'fatigue_load';
    if (name.includes('false') || name.includes('fakeout') || name.includes('decoy') || name.includes('bait') || name.includes('go/no-go')) return 'decoy_discrimination';
    return 'baseline';
}

function buildArchetypeProfile(
    variant: VariantEntry,
    familyBase: FamilySpecBase | undefined,
    archetype: SimVariantArchetype
): VariantArchetypeProfile {
    const defaultProfile: VariantArchetypeProfile = {
        label: ARCHETYPE_LABELS[archetype],
        variantType: variant.mode === 'library' ? 'Library variant' : variant.mode === 'hybrid' ? 'Hybrid / trial expression' : 'Branch variant',
        purpose: `This variant applies a distinct expression of ${variant.family} while preserving the family mechanism of ${familyBase?.mechanism ?? 'the parent simulation'}.`,
        expectedBenefit: 'Create a buildable draft that localizes the family to a clearer use case without changing the underlying cognitive target.',
        bestUse: [
            `the athlete needs a more specific expression of ${variant.family} without leaving the family boundary`,
            'the registry should be able to generate a build-ready draft without manual pre-authoring',
            'the program needs variety, localization, or packaging changes more than a brand-new family',
        ],
        changes: [
            'surface framing, pacing, and context can shift while the family mechanism remains unchanged',
            'variant packaging should feel distinct without creating a new taxonomy object',
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
        buildNotes: [
            'Keep naming, analytics keys, and admin labels aligned with the registry entry.',
            `Mark this variant as archetype ${ARCHETYPE_LABELS[archetype]} so generation and runtime config stay aligned.`,
            'Store variant assignment, family, mode, and any variant-specific tags in the session record.',
        ],
        runtimeDefaults: {
            feedbackMode: variant.mode === 'hybrid' ? 'suppressed' : 'coached',
            adaptiveDifficulty: variant.mode !== 'hybrid',
            emphasis: ['family-consistent presentation'],
            analyticsFocus: [familyBase?.coreMetric ?? 'family metric'],
        },
    };

    let baseProfile: VariantArchetypeProfile;

    switch (archetype) {
        case 'short_daily':
            baseProfile = {
                ...defaultProfile,
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
                runtimeDefaults: {
                    feedbackMode: 'coached',
                    adaptiveDifficulty: true,
                    emphasis: ['high-compliance daily packaging', 'short session length'],
                    analyticsFocus: [familyBase?.coreMetric ?? 'family metric', 'trend over single-session volatility'],
                },
            };
            break;
        case 'trial':
            baseProfile = {
                ...defaultProfile,
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
                runtimeDefaults: {
                    feedbackMode: 'suppressed',
                    adaptiveDifficulty: false,
                    emphasis: ['standardized protocol', 'non-adaptive assessment'],
                    analyticsFocus: [familyBase?.coreMetric ?? 'family metric', 'Transfer Gap', 'session validity'],
                },
            };
            break;
        case 'immersive':
            baseProfile = {
                ...defaultProfile,
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
                runtimeDefaults: {
                    feedbackMode: variant.mode === 'hybrid' ? 'suppressed' : 'coached',
                    adaptiveDifficulty: true,
                    emphasis: ['immersion', 'spatial/environmental fidelity'],
                    analyticsFocus: [familyBase?.coreMetric ?? 'family metric', 'device context'],
                },
            };
            break;
        case 'sport_context':
            baseProfile = {
                ...defaultProfile,
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
                runtimeDefaults: {
                    feedbackMode: 'coached',
                    adaptiveDifficulty: true,
                    emphasis: ['sport-native framing', 'transfer credibility'],
                    analyticsFocus: [familyBase?.coreMetric ?? 'family metric', 'context tags'],
                },
            };
            break;
        case 'visual_channel':
            baseProfile = {
                ...defaultProfile,
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
                runtimeDefaults: {
                    feedbackMode: 'coached',
                    adaptiveDifficulty: true,
                    emphasis: ['visual interference', 'salience and clutter'],
                    analyticsFocus: [familyBase?.coreMetric ?? 'family metric', 'visual channel performance'],
                },
            };
            break;
        case 'audio_channel':
            baseProfile = {
                ...defaultProfile,
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
                runtimeDefaults: {
                    feedbackMode: 'coached',
                    adaptiveDifficulty: true,
                    emphasis: ['audio interference', 'timing unpredictability'],
                    analyticsFocus: [familyBase?.coreMetric ?? 'family metric', 'audio channel performance'],
                },
            };
            break;
        case 'combined_channel':
            baseProfile = {
                ...defaultProfile,
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
                runtimeDefaults: {
                    feedbackMode: variant.mode === 'hybrid' ? 'suppressed' : 'coached',
                    adaptiveDifficulty: true,
                    emphasis: ['layered channels', 'overlap timing'],
                    analyticsFocus: [familyBase?.coreMetric ?? 'family metric', 'per-channel context'],
                },
            };
            break;
        case 'cognitive_pressure':
            baseProfile = {
                ...defaultProfile,
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
                runtimeDefaults: {
                    feedbackMode: 'coached',
                    adaptiveDifficulty: true,
                    emphasis: ['provocation', 'ambiguity', 'evaluative load'],
                    analyticsFocus: [familyBase?.coreMetric ?? 'family metric', 'message condition tags'],
                },
            };
            break;
        case 'fatigue_load':
            baseProfile = {
                ...defaultProfile,
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
                runtimeDefaults: {
                    feedbackMode: variant.mode === 'hybrid' ? 'suppressed' : 'coached',
                    adaptiveDifficulty: true,
                    emphasis: ['load accumulation', 'late-session degradation'],
                    analyticsFocus: [familyBase?.coreMetric ?? 'family metric', 'early-mid-late comparisons'],
                },
            };
            break;
        case 'decoy_discrimination':
            baseProfile = {
                ...defaultProfile,
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
                runtimeDefaults: {
                    feedbackMode: 'coached',
                    adaptiveDifficulty: true,
                    emphasis: ['decoys', 'false-trigger resistance'],
                    analyticsFocus: [familyBase?.coreMetric ?? 'family metric', 'false-start / decoy error rates'],
                },
            };
            break;
        case 'baseline':
        default:
            baseProfile = defaultProfile;
            break;
    }

    const override = getVariantSpecificProfileOverride(variant, archetype);
    if (!override) {
        return baseProfile;
    }

    return {
        ...baseProfile,
        variantType: override.variantType ?? baseProfile.variantType,
        purpose: override.purpose ?? baseProfile.purpose,
        expectedBenefit: override.expectedBenefit ?? baseProfile.expectedBenefit,
        bestUse: override.bestUse ?? baseProfile.bestUse,
        changes: override.changes ?? baseProfile.changes,
        athleteFlow: override.athleteFlow ?? baseProfile.athleteFlow,
        scoringNotes: override.scoringNotes ?? baseProfile.scoringNotes,
        artifactRisks: override.artifactRisks ?? baseProfile.artifactRisks,
        buildNotes: override.buildNotes ?? baseProfile.buildNotes,
        runtimeDefaults: {
            ...baseProfile.runtimeDefaults,
            ...(override.runtimeDefaults ?? {}),
        },
    };
}

function getVariantSpecificProfileOverride(variant: VariantEntry, archetype: SimVariantArchetype): VariantProfileOverride | null {
    const name = variant.name.toLowerCase();

    if (variant.family === 'The Kill Switch') {
        if (name.includes('visual disruption')) {
            return {
                purpose: 'This variant expresses Kill Switch through screen-based visual interruptions while preserving the same disruption -> reset -> re-engagement mechanic.',
                expectedBenefit: 'Surface visual-triggered reset speed and make recovery breakdowns legible under visual chaos.',
                bestUse: [
                    'the athlete loses composure when the screen flashes, scrambles, or visually collapses',
                    'the program needs a clean visual-channel version before moving to combined-channel pressure',
                    'Nora wants a highly legible reset drill for web and phone delivery',
                ],
                runtimeDefaults: {
                    emphasis: ['screen flashes', 'target disappearance', 'layout scramble'],
                    analyticsFocus: ['Recovery Time', 'visual-trigger false starts', 'first-post-reset accuracy'],
                },
                durationMinutes: 5,
            };
        }

        if (name.includes('audio disruption')) {
            return {
                purpose: 'This variant expresses Kill Switch through crowd, whistle, buzzer, and startle-like sound disruptions while preserving the same recovery mechanic.',
                expectedBenefit: 'Train reset speed in loud sport-like environments and reveal audio-triggered recovery breakdowns.',
                bestUse: [
                    'the athlete destabilizes under crowd, whistle, or buzzer conditions',
                    'the program wants a sport-native audio-pressure version of Kill Switch',
                    'Nora needs an assignment that feels closer to live game noise than abstract visual disruption',
                ],
                runtimeDefaults: {
                    emphasis: ['crowd noise', 'whistle/buzzer timing', 'audio startle events'],
                    analyticsFocus: ['Recovery Time', 'audio-trigger false starts', 'pressure stability under sound'],
                },
                durationMinutes: 5,
            };
        }

        if (name.includes('cognitive-provocation')) {
            return {
                purpose: 'This variant expresses Kill Switch through provocative language, evaluative cues, and psychological disruption without changing the reset mechanic.',
                expectedBenefit: 'Reveal whether the athlete can recover when disruption arrives through thought and self-talk rather than pure sensory noise.',
                bestUse: [
                    'the athlete spirals after mistakes, criticism, or ambiguity',
                    'the program wants the pressure channel to feel mental rather than sensory',
                    'Nora needs a version that targets evaluative threat and internal disruption directly',
                ],
                runtimeDefaults: {
                    emphasis: ['provocative copy', 'evaluative cues', 'psychological interruption'],
                    analyticsFocus: ['Recovery Time', 'pressure stability under provocation', 'post-provocation first accuracy'],
                },
                durationMinutes: 5,
            };
        }

        if (name.includes('combined-channel')) {
            return {
                purpose: 'This variant layers visual, audio, and cognitive disruptions together while preserving the same Kill Switch reset target.',
                expectedBenefit: 'Bridge single-channel reset work into competition-like stacked pressure without promoting to a new family.',
                bestUse: [
                    'the athlete handles isolated resets but breaks down when channels stack together',
                    'the program needs a higher-load branch before moving to formal Trial or immersive work',
                    'Nora wants the default advanced Kill Switch branch for pressure-combination training',
                ],
                runtimeDefaults: {
                    emphasis: ['multi-channel overlap', 'stacked disruption timing', 'pressure layering'],
                    analyticsFocus: ['Recovery Time', 'overlap-condition recovery', 'channel-tagged false starts'],
                },
                durationMinutes: 5,
            };
        }

        if (name.includes('sport-context')) {
            return {
                purpose: 'This variant expresses Kill Switch in recognizable sport situations so the athlete experiences the reset mechanic inside game-like framing.',
                expectedBenefit: 'Increase transfer credibility and coach/athlete buy-in without changing the family scoring model.',
                bestUse: [
                    'the athlete responds better to sport-native framing than abstract drills',
                    'the coach wants the reset language to map directly to game situations',
                    'Nora needs an assignment that feels closer to film room or sideline context',
                ],
                runtimeDefaults: {
                    emphasis: ['sport-context cues', 'game-like reset moments', 'transfer framing'],
                    analyticsFocus: ['Recovery Time', 'context-tagged performance', 'coach-facing transfer notes'],
                },
                durationMinutes: 5,
            };
        }

        if (name.includes('immersive reset chamber')) {
            return {
                purpose: 'This variant raises Kill Switch transfer fidelity through immersive environmental presentation while keeping the same reset target and scoring model.',
                expectedBenefit: 'Test whether reset speed survives richer perceptual pressure and more embodied presentation.',
                bestUse: [
                    'the athlete needs a higher-fidelity pre-field reset check',
                    'the roadmap includes Vision Pro or immersive hardware support',
                    'the program wants an environment-heavy version before sport-field trials',
                ],
                runtimeDefaults: {
                    emphasis: ['spatial disruption', 'environmental fidelity', 'immersive reset context'],
                    analyticsFocus: ['Recovery Time', 'device/environment context', 'transfer readiness'],
                },
                durationMinutes: 6,
            };
        }
    }

    if (variant.family === 'Noise Gate') {
        if (name.includes('visual clutter')) {
            return {
                purpose: 'This variant expresses Noise Gate through heavy visual clutter while preserving the same selective-attention mechanic.',
                expectedBenefit: 'Strengthen filtering under screen noise, motion clutter, and peripheral competition.',
                runtimeDefaults: {
                    emphasis: ['visual clutter', 'peripheral competition', 'screen noise density'],
                    analyticsFocus: ['Distractor Cost', 'visual-channel miss rate', 'target retention under clutter'],
                },
                durationMinutes: 5,
            };
        }

        if (name.includes('crowd-noise')) {
            return {
                purpose: 'This variant expresses Noise Gate through crowd, commentary, and environmental sound while preserving the same target-selection rule.',
                expectedBenefit: 'Improve signal retention in loud competitive environments.',
                runtimeDefaults: {
                    emphasis: ['crowd audio', 'commentary overlap', 'sound-pressure filtering'],
                    analyticsFocus: ['Distractor Cost', 'audio-channel interference', 'clean-target retention'],
                },
                durationMinutes: 5,
            };
        }

        if (name.includes('mixed-channel')) {
            return {
                purpose: 'This variant stacks visual and audio distractors inside Noise Gate while preserving the same target-filtering mechanic.',
                expectedBenefit: 'Bridge single-channel filtering into layered noise conditions that feel closer to competition.',
                runtimeDefaults: {
                    emphasis: ['visual + audio overlap', 'channel-stacked distractors', 'layered filtering'],
                    analyticsFocus: ['Distractor Cost', 'overlap-condition errors', 'channel-tagged misses'],
                },
                durationMinutes: 5,
            };
        }

        if (name.includes('peripheral bait')) {
            return {
                purpose: 'This variant stresses Noise Gate through peripheral lure stimuli that compete for attention while the true target remains central.',
                expectedBenefit: 'Reduce peripheral bait errors and improve discipline around the live cue.',
                runtimeDefaults: {
                    emphasis: ['peripheral lure cues', 'attention bait', 'central-target discipline'],
                    analyticsFocus: ['Distractor Cost', 'peripheral bait error rate', 'target-lock consistency'],
                },
                durationMinutes: 5,
            };
        }

        if (name.includes('fatigue-state')) {
            return {
                purpose: 'This variant expresses Noise Gate under accumulating fatigue so filtering can be measured late, not just fresh.',
                expectedBenefit: 'Expose deterioration in selective attention that only shows up under load accumulation.',
                runtimeDefaults: {
                    emphasis: ['late-session filtering', 'fatigue accumulation', 'signal retention under load'],
                    analyticsFocus: ['Distractor Cost', 'early-mid-late filtering drift', 'fatigue-sensitive miss patterns'],
                },
                durationMinutes: 6,
            };
        }

        if (name.includes('immersive crowd tunnel')) {
            return {
                purpose: 'This variant raises Noise Gate transfer fidelity through immersive crowd and tunnel-like environmental presentation while preserving the same filtering task.',
                expectedBenefit: 'Test whether filtering strength survives richer audio-visual stadium conditions.',
                runtimeDefaults: {
                    emphasis: ['immersive crowd field', 'spatialized noise', 'environmental filtering'],
                    analyticsFocus: ['Distractor Cost', 'device/environment context', 'transfer readiness under crowd fidelity'],
                },
                durationMinutes: 6,
            };
        }
    }

    if (variant.family === 'Brake Point') {
        if (name.includes('go/no-go')) {
            return {
                runtimeDefaults: {
                    emphasis: ['clean go/no-go inhibition', 'stop timing', 'motor restraint'],
                    analyticsFocus: ['Stop Latency', 'false-start rate', 'clean inhibition commits'],
                },
                durationMinutes: 5,
            };
        }
        if (name.includes('high-stakes inhibition')) {
            return {
                runtimeDefaults: {
                    emphasis: ['stakes messaging', 'urgent stop demands', 'pressure-tagged inhibition'],
                    analyticsFocus: ['Stop Latency', 'pressure-stratified inhibition', 'high-stakes false starts'],
                },
                durationMinutes: 5,
            };
        }
    }

    if (variant.family === 'Signal Window') {
        if (name.includes('shot-clock')) {
            return {
                purpose: 'This variant expresses Signal Window through shot-clock pressure and late-clock game framing while preserving the same cue-discrimination mechanic.',
                expectedBenefit: 'Increase transfer to late-clock decision windows where the athlete must read correctly before time collapses.',
                bestUse: [
                    'the athlete reads well with time but degrades when the decision window visibly shrinks',
                    'the coach wants cue-recognition language that maps directly to end-of-clock situations',
                    'Nora needs a sport-native time-pressure version without changing the family scoring model',
                ],
                runtimeDefaults: {
                    emphasis: ['shrinking decision window', 'visible urgency', 'late-read pressure'],
                    analyticsFocus: ['Correct Read Under Time Pressure', 'late-window decisions', 'time-pressure misses'],
                },
                durationMinutes: 5,
            };
        }
        if (name.includes('rapid recognition')) {
            return {
                variantType: 'Recognition-speed variant',
                purpose: 'This variant expresses Signal Window through compressed cue exposure and earlier commitment pressure while preserving the same cue-discrimination mechanic.',
                expectedBenefit: 'Improve first-read speed so the athlete can identify and commit before hesitation collapses the decision window.',
                bestUse: [
                    'the athlete eventually finds the right cue but commits too late',
                    'the program wants a fast-recognition branch before layering in heavier sport-context or trial packaging',
                    'Nora needs an assignment that rewards clean first commitments instead of prolonged scanning',
                ],
                changes: [
                    'cue exposure is compressed so the athlete must extract the signal earlier',
                    'the variant emphasizes first-commit quality over extended scan time',
                    'decision pressure comes from reduced deliberation time, not from changing the correct-answer structure',
                ],
                buildNotes: [
                    'Keep naming, analytics keys, and admin labels aligned with the registry entry.',
                    `Mark this variant as archetype ${ARCHETYPE_LABELS[archetype]} so generation and runtime config stay aligned.`,
                    'Store variant assignment, family, mode, and any variant-specific tags in the session record.',
                    'Add first-commit timing buckets so coaches can distinguish late certainty from early clean recognition.',
                ],
                runtimeDefaults: {
                    emphasis: ['fast cue recognition', 'compressed window', 'quick commit'],
                    analyticsFocus: ['Correct Read Under Time Pressure', 'recognition speed', 'first-commit quality'],
                },
                durationMinutes: 5,
            };
        }
    }

    if (variant.family === 'Sequence Shift') {
        if (name.includes('sequence-memory')) {
            return {
                variantType: 'Memory-interference variant',
                purpose: 'This variant expresses Sequence Shift through memory-linked rule updates so the athlete must hold the active rule, detect the change, and abandon the old pattern quickly.',
                expectedBenefit: 'Improve update speed when the previous sequence remains sticky in working memory and interferes with the new rule.',
                bestUse: [
                    'the athlete keeps executing the old pattern after the rule has already changed',
                    'the program wants a working-memory-heavy Sequence Shift branch before sport-playbook or trial packaging',
                    'Nora needs an assignment that punishes delayed updating more than steady-state execution',
                ],
                changes: [
                    'the outgoing rule is held long enough to create memory interference before the update',
                    'the variant emphasizes post-shift rule abandonment and first-correct-after-shift quality',
                    'difficulty comes from rule-memory carryover, not from making the correct answer ambiguous',
                ],
                buildNotes: [
                    'Keep naming, analytics keys, and admin labels aligned with the registry entry.',
                    `Mark this variant as archetype ${ARCHETYPE_LABELS[archetype]} so generation and runtime config stay aligned.`,
                    'Store variant assignment, family, mode, and any variant-specific tags in the session record.',
                    'Store old-rule pattern tags and first-correct-after-shift markers so coaches can distinguish slow updating from steady-state weakness.',
                ],
                runtimeDefaults: {
                    emphasis: ['memory-linked rule updates', 'old-rule carryover', 'first-correct-after-shift'],
                    analyticsFocus: ['Update Accuracy After Rule Change', 'switch cost', 'old-rule intrusion rate'],
                },
                durationMinutes: 5,
            };
        }
    }

    if (variant.family === 'Endurance Lock') {
        if (name.includes('sustained-focus')) {
            return {
                purpose: 'This variant expresses Endurance Lock through stable sustained-focus demands so the athlete must preserve clean execution over extended duration without late collapse.',
                expectedBenefit: 'Improve vigilance maintenance and delay the onset of duration-driven degradation.',
                runtimeDefaults: {
                    emphasis: ['stable long focus', 'attention maintenance', 'late-session clean execution'],
                    analyticsFocus: ['Degradation Slope', 'block stability', 'late-session deterioration'],
                },
                durationMinutes: 6,
            };
        }
        if (name.includes('late-pressure')) {
            return {
                purpose: 'This variant expresses Endurance Lock through accumulating fatigue plus late-session stakes while preserving the same sustained-execution mechanism.',
                expectedBenefit: 'Expose whether clean execution holds when fatigue and consequence rise together near the finish phase.',
                bestUse: [
                    'the athlete stays stable early but unravels when fatigue and stakes rise at the end',
                    'the program wants a finish-phase endurance branch rather than a neutral sustained-attention rep',
                    'Nora needs a version that reveals late-pressure breakdowns instead of averaging them into one whole-session score',
                ],
                changes: [
                    'late-session pressure is intentionally elevated after the baseline and mid-session blocks are established',
                    'analysis should separate baseline, middle, and finish-phase behavior rather than flattening the session into one average',
                    'difficulty rises through sustained load plus stakes, not by changing the underlying task identity',
                ],
                buildNotes: [
                    'Keep naming, analytics keys, and admin labels aligned with the registry entry.',
                    `Mark this variant as archetype ${ARCHETYPE_LABELS[archetype]} so generation and runtime config stay aligned.`,
                    'Store variant assignment, family, mode, and any variant-specific tags in the session record.',
                    'Store finish-phase challenge markers so coaches can distinguish generic fatigue from late-pressure-specific breakdown.',
                ],
                runtimeDefaults: {
                    emphasis: ['late-session pressure', 'fatigue plus stakes', 'finish-phase control'],
                    analyticsFocus: ['Degradation Slope', 'late-block pressure sensitivity', 'finish-phase breakdown rate'],
                },
                durationMinutes: 6,
            };
        }
    }

    return archetype === 'baseline' ? null : null;
}

function inferVariantTheme(variant: VariantEntry): VariantTheme {
    const familyBase = FAMILY_SPEC_BASES[variant.family];
    const archetype = resolveVariantArchetype(variant);
    const profile = buildArchetypeProfile(variant, familyBase, archetype);

    return {
        archetype,
        variantType: profile.variantType,
        purpose: profile.purpose,
        expectedBenefit: profile.expectedBenefit,
        bestUse: profile.bestUse,
        changes: profile.changes,
        athleteFlow: profile.athleteFlow,
        scoringNotes: profile.scoringNotes,
        artifactRisks: profile.artifactRisks,
        trainingMode: [...(familyBase?.trainingModeDefaults ?? ['show feedback according to the parent family defaults'])],
        trialMode: [...(familyBase?.trialModeDefaults ?? ['standardize conditions and suppress intra-session feedback for comparison use'])],
        buildNotes: profile.buildNotes,
        boundarySafeguards: [
            `Do not violate the family boundary: ${familyBase?.boundaryRule ?? 'the parent family rules still govern'}.`,
            'If the variant starts producing a different mechanism or divergent score logic, flag it for promotion review rather than extending the variant.',
        ],
    };
}

function isTrialVariant(variant: VariantEntry) {
    return resolveVariantArchetype(variant) === 'trial';
}

function getTrialDurationLabel(variant: VariantEntry) {
    switch (variant.family) {
        case 'Brake Point':
            return '10 minutes';
        case 'Endurance Lock':
            return '18 minutes';
        default:
            return '12 minutes';
    }
}

function buildDefaultLockedSpec(variant: VariantEntry): SimVariantLockedSpec | undefined {
    if (!isTrialVariant(variant)) {
        return undefined;
    }

    const duration = getTrialDurationLabel(variant);
    const generic: SimVariantLockedSpec = {
        fixedTier: 'Tier 3',
        fixedDuration: duration,
        targetSessionStructure: variant.family === 'Endurance Lock' ? '6 fixed pacing blocks' : '60 fixed rounds',
        buildVersionPolicy: 'Record the exact build version and preserve it across Baseline, Post-Training, and Retention comparisons.',
        seedPolicy: 'Use one fixed documented seed / schedule per protocol version and preserve it across Baseline, Post-Training, and Retention comparisons.',
        modifierProfile: 'Use a fixed Tier 3 modifier profile with no intra-session adaptation.',
        environmentRequirements: 'Keep environment requirements fixed across all comparison points for the same protocol version, including device class, audio route, and any room/setup constraints.',
        fixedProfileDetails: 'Use the family-standard Trial profile and preserve the same task mapping throughout the session.',
        validResponseRule: 'Parent-family valid response rules remain locked for this Trial variant.',
        artifactFloorRule: 'Any response faster than 150 ms is flagged as a motor artifact and excluded from the headline metric.',
        maxWindowRule: 'Use the parent-family Tier 3 maximum response window with no adaptive changes.',
        failedRoundRule: 'No valid response inside the maximum window is scored as a failed round at the capped value and exported separately.',
        falseStartRule: 'False starts must be logged separately and excluded from the headline metric.',
        validSessionRule: 'Valid session = at least 75% valid outcomes and fewer than 20% false starts.',
        partialSessionRule: 'Partial session = 50–74% valid outcomes and fewer than or equal to 20% false starts.',
        invalidSessionRule: 'Invalid session = fewer than 50% valid outcomes or more than 20% false starts.',
        dropoutRule: 'Trial-mode dropout is classified using Addendum validity rules: if the athlete exits after completing at least 50% of the session and still meets validity / false-start thresholds, mark Partial; otherwise mark Invalid. Preserve the dropout flag in all cases.',
        retryRule: 'Maximum 2 retries per assessment point. If all attempts are invalid, record missing trial data rather than substituting a partial benchmark.',
        transferMetricDefinition: 'Transfer Gap = the difference between daily-training family performance and standardized Trial performance for the same athlete.',
        transferMetricReporting: 'Report Transfer Gap beside the headline metric and trial-specific deterioration / condition-stratified views, not as a standalone score.',
        validationStage: 'Stage 1 Mechanism-Support',
        nextValidationMilestone: 'Stage 2 Internal Reliability',
        motorBaselineRule: 'Require a standardized warm-up / motor-baseline capture before the assessment and preserve completion state in metadata.',
        deviceCovariateRule: 'Log device class and treat it as a covariate in research export and analysis.',
        exportRequirements: 'Export exact build version, timestamps, condition tags, validity status, artifacts, device/environment metadata, and per-round or per-block trial outcomes in a stable schema.',
    };

    switch (variant.family) {
        case 'The Kill Switch':
            return {
                ...generic,
                modifierProfile: 'Use one fixed documented Kill Switch Tier 3 protocol bundle: sequence-memory focus task, combined disruption emphasis, and evaluative threat / consequence / ambiguity held constant across the full session.',
                fixedProfileDetails: 'Do not swap task mappings, disruption channels, or modifier intensities within-session; the full Tier 3 protocol bundle remains constant for every comparison point.',
                validResponseRule: 'Valid re-engagement requires two consecutive correct responses on the refocused task.',
                maxWindowRule: 'Tier 3 maximum recovery window is 1.5 seconds.',
                falseStartRule: 'False start = any input during the disruption phase before the reset signal.',
                transferMetricDefinition: 'Transfer Gap = the difference between adaptive daily-training Recovery Time and standardized Trial Recovery Time for the same athlete.',
                exportRequirements: 'Export exact build version, disruption type, per-round Recovery Time, false starts, motor artifacts, failed-round markers, session validity status, device/environment metadata, and modifier tags in a stable schema.',
            };
        case 'Noise Gate':
            return {
                ...generic,
                targetSessionStructure: '60 fixed rounds',
                fixedProfileDetails: 'Use the standardized Tier 3 Noise Gate profile with fixed distractor density, overlap schedule, and channel stack.',
                validResponseRule: 'Valid target recovery requires one committed correct response while distractors remain irrelevant.',
                falseStartRule: 'False start = response to distractor stimuli or non-target noise.',
            };
        case 'Brake Point':
            return {
                ...generic,
                targetSessionStructure: '175 fixed trials',
                fixedProfileDetails: 'Use the standardized Tier 3 Brake Point profile with fixed stop-signal timing, distribution, and 175 total trials.',
                validResponseRule: 'Valid inhibition requires one committed stop inside the standardized stop window.',
                falseStartRule: 'False start = response before the Go stimulus or outside the valid stop window.',
            };
        case 'Signal Window':
            return {
                ...generic,
                targetSessionStructure: '60 fixed reads',
                fixedProfileDetails: 'Use the standardized Tier 3 Signal Window profile with fixed cue window, ambiguity tier, and presentation order.',
                validResponseRule: 'Valid read requires one committed correct response inside the standardized cue window.',
                falseStartRule: 'False start = response before display onset or before the valid cue window opens.',
            };
        case 'Sequence Shift':
            return {
                ...generic,
                targetSessionStructure: '60 fixed shift opportunities',
                fixedProfileDetails: 'Use the standardized Tier 3 Sequence Shift profile with fixed rule-change schedule, change frequency, and response windows.',
                validResponseRule: 'Valid post-shift recovery requires one correct response after the active rule changes.',
                falseStartRule: 'False start = response to the previous rule after the change signal or before the new valid window opens.',
            };
        case 'Endurance Lock':
            return {
                ...generic,
                fixedProfileDetails: 'Use the standardized Tier 3 Endurance Lock pacing block with fixed duration, block structure, and fatigue-load profile.',
                validResponseRule: 'Usable Endurance Lock performance is evaluated in rolling blocks rather than single reset events.',
                maxWindowRule: 'Continuous-task validity follows the family block thresholds rather than a single reset window.',
                falseStartRule: 'False start is not the primary issue; unusable block segments and dropout handling govern validity.',
            };
        default:
            return generic;
    }
}

function ensureLockedSpec(variant: VariantEntry) {
    return variant.lockedSpec ?? buildDefaultLockedSpec(variant);
}

function getTrialProtocolNotes(variant: VariantEntry) {
    const lockedSpec = ensureLockedSpec(variant);
    if (!lockedSpec) return [];

    return [
        `Assessment tier is locked at ${lockedSpec.fixedTier} for the full ${lockedSpec.fixedDuration.replace(' minutes', '-minute')} session.`,
        `Target session structure is locked at ${lockedSpec.targetSessionStructure}.`,
        lockedSpec.buildVersionPolicy,
        lockedSpec.seedPolicy,
        lockedSpec.modifierProfile,
        lockedSpec.environmentRequirements,
        lockedSpec.fixedProfileDetails,
    ];
}

function getMeasurementPrecisionNotes(variant: VariantEntry) {
    const lockedSpec = ensureLockedSpec(variant);
    const notes = lockedSpec
        ? [
            lockedSpec.validResponseRule,
            lockedSpec.artifactFloorRule,
            lockedSpec.maxWindowRule,
            lockedSpec.failedRoundRule,
            lockedSpec.falseStartRule,
        ]
        : [
            'The parent-family measurement rules remain locked and govern valid response definitions, artifact thresholds, and failed-trial handling.',
            'Any response faster than 150 ms is flagged as a motor artifact and excluded from the headline metric.',
        ];

    if (variant.family === 'The Kill Switch') {
        notes.push('Attentional Shifting scoring remains multi-source, combining re-engagement latency with first-post-reset accuracy exactly as defined in the Kill Switch family spec.');
        notes.push('Pressure Stability scoring remains modifier-stratified, comparing baseline versus pressure conditions exactly as defined in the Kill Switch family spec.');
        notes.push('Trial reporting should emphasize Recovery Time, Recovery Trend, modifier-stratified Pressure Stability, fail rate, and within-session deterioration.');
    }

    return notes;
}

function getTransferMetricNotes(variant: VariantEntry, familyBase?: FamilySpecBase) {
    const lockedSpec = ensureLockedSpec(variant);
    const coreMetric = familyBase?.coreMetric ?? 'the parent-family metric';

    if (lockedSpec) {
        return [
            lockedSpec.transferMetricDefinition,
            'Small Transfer Gap suggests the skill is internalizing across contexts; large Transfer Gap suggests the athlete improves in drill conditions more than in assessment conditions.',
            lockedSpec.transferMetricReporting,
        ];
    }

    return [
        `Primary trial-layer comparison metric is the Transfer Gap between daily-training ${coreMetric} and standardized Trial ${coreMetric}.`,
        'Small Transfer Gap suggests the skill is internalizing across contexts; large Transfer Gap suggests the athlete improves in drill conditions more than in assessment conditions.',
        `Transfer Gap should be reported beside the headline ${coreMetric} and any trial-specific deterioration or condition-stratified views.`,
    ];
}

function getSessionValidityNotes(variant: VariantEntry) {
    const lockedSpec = ensureLockedSpec(variant);
    if (!lockedSpec) {
        return [
            'Valid session = at least 75% valid outcomes and fewer than 20% false starts.',
            'Partial session = 50–74% valid outcomes and fewer than or equal to 20% false starts.',
            'Invalid session = fewer than 50% valid outcomes or more than 20% false starts.',
            'Any Trial-mode dropout is marked invalid and preserved in the data log.',
            'Maximum 2 retries per assessment point.',
        ];
    }

    return [
        lockedSpec.validSessionRule,
        lockedSpec.partialSessionRule,
        lockedSpec.invalidSessionRule,
        lockedSpec.dropoutRule,
        lockedSpec.retryRule,
        'Excessive false starts, device interruption, or environment breaks should be explicitly tagged as the invalidation cause.',
    ];
}

function getTrialModeSection() {
    return [
        'Training Mode (reference only, not default assignment):',
        '- Treat this configuration as a benchmark packaging if it is surfaced outside formal trials.',
        '- Do not use it as the adaptive daily-driver variant.',
        '- Coaching interpretation should compare against prior standardized assessments rather than daily trend feedback.',
        'Trial Mode (operational mode):',
        '- Suppress all intra-session scores, streaks, and round-level feedback.',
        '- Require the athlete to complete the full fixed protocol before any performance summary appears.',
        '- Lock build version, seed/schedule, modifier profile, and environment metadata for comparison-safe reporting.',
    ];
}

function getResearchAlignmentNotes(variant: VariantEntry) {
    const lockedSpec = ensureLockedSpec(variant);
    const baseNotes = lockedSpec
        ? [
            `Validation status: ${lockedSpec.validationStage}.`,
            `Next milestone: ${lockedSpec.nextValidationMilestone}.`,
            lockedSpec.motorBaselineRule,
            lockedSpec.deviceCovariateRule,
        ]
        : [
            'Validation status: Stage 1 Mechanism-Support.',
            'Next milestone: Stage 2 Internal Reliability with test-retest stability at or above acceptable thresholds.',
            'Session metadata must capture device type, audio route, and warm-up / motor-baseline completion for response-time interpretation.',
            'In research export and analysis, device class should be treated as a covariate rather than assumed to be behaviorally neutral.',
        ];

    if (variant.family === 'The Kill Switch') {
        return [
            ...baseNotes,
            'The family is grounded in attentional shifting, inhibitory control, and pressure-stability literature; the Trial variant should preserve that evidence chain rather than introduce a new mechanism.',
        ];
    }

    return baseNotes;
}

function getTrialBuildNotes(variant: VariantEntry) {
    const lockedSpec = ensureLockedSpec(variant);
    return [
        'Use a fixed version identifier and keep the standardized configuration visible in admin / research tooling, not in the athlete-facing UI.',
        lockedSpec?.exportRequirements ?? 'Export round- or block-level timestamps, condition tags, artifact flags, session validity status, and environment metadata in a stable schema.',
        'Store exact build version, seed, modifier profile, device class, audio route, and any trial-specific context tags in the session record.',
    ];
}

function buildGeneratedTrialVariantSpec(variant: VariantEntry, familyBase: FamilySpecBase | undefined, theme: VariantTheme, today: string) {
    return [
        '1. Core Identity',
        `Variant Name: ${variant.name}`,
        `Parent Family: ${variant.family}`,
        'Variant Type: Trial variant',
        `Registry Mode: ${MODE_CONFIG[variant.mode].label}`,
        `Family Status: ${variant.familyStatus === 'locked' ? 'Locked Family' : 'Candidate Family'}`,
        `Status: ${mapVariantStatus(variant)}`,
        `Build Priority: ${mapPriority(variant.priority)}`,
        'Version: v0.2',
        `Generated On: ${today}`,
        '',
        '2. Variant Rationale',
        `Purpose: ${theme.purpose}`,
        `Expected Benefit: ${theme.expectedBenefit}`,
        'When Nora Should Assign:',
        ...theme.bestUse.map((item) => `- ${item}`),
        '',
        '3. Fixed Trial Protocol',
        ...getTrialProtocolNotes(variant).map((item) => `- ${item}`),
        '',
        '4. Family Inheritance vs Variant Changes',
        `Inherited from ${variant.family} and the Sim Specification Standards Addendum:`,
        `- Core mechanism remains ${familyBase?.mechanism ?? 'defined by the parent family spec'}.`,
        `- Core metric remains ${familyBase?.coreMetric ?? 'the parent family metric'}.`,
        `- Primary skill targets remain ${familyBase?.skillTargets ?? 'the parent family skill architecture'}.`,
        ...(variant.family === 'The Kill Switch'
            ? [
                '- Attentional Shifting scoring remains multi-source, combining re-engagement latency with first-post-reset accuracy exactly as defined in the Kill Switch family spec.',
                '- Pressure Stability scoring remains modifier-stratified, comparing baseline versus pressure conditions exactly as defined in the Kill Switch family spec.',
            ]
            : []),
        `- Boundary rule remains ${familyBase?.boundaryRule ?? 'governed by the parent family spec'}.`,
        'What changes in this variant:',
        ...theme.changes.map((item) => `- ${item}`),
        '',
        '5. Athlete Experience Flow',
        ...theme.athleteFlow.map((item) => `- ${item}`),
        '',
        '6. Measurement Precision and Scoring Rules',
        ...getMeasurementPrecisionNotes(variant).map((item) => `- ${item}`),
        '',
        '7. Transfer Metric and Reporting',
        ...getTransferMetricNotes(variant, familyBase).map((item) => `- ${item}`),
        '',
        '8. Session Validity, Retry, and Dropout Rules',
        ...getSessionValidityNotes(variant).map((item) => `- ${item}`),
        '',
        '9. Mode Behavior',
        ...getTrialModeSection(),
        '',
        '10. Research Alignment and Validation Status',
        ...getResearchAlignmentNotes(variant).map((item) => `- ${item}`),
        '',
        '11. Build and Data Export Requirements',
        ...getTrialBuildNotes(variant).map((item) => `- ${item}`),
        '',
        '12. Governing Documents',
        ...(familyBase?.governingDocs ?? [
            'Sim Specification Standards Addendum (v2)',
            `${variant.family} Family Spec`,
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ]).map((item) => `- ${item}`),
        '- When variant wording conflicts with trial standardization rules, the Sim Specification Standards Addendum governs first.',
        '',
        '13. Boundary Safeguards',
        ...theme.boundarySafeguards.map((item) => `- ${item}`),
        '',
        '14. Variant Readiness Checklist',
        '- [ ] Fixed Tier / duration / seed / modifier profile locked for the assessment protocol',
        '- [ ] Measurement precision rules match the parent family spec and standards addendum',
        '- [ ] Transfer Gap reporting and trial analytics outputs defined',
        '- [ ] Valid / partial / invalid / dropout handling documented',
        '- [ ] Device, motor-baseline, and export requirements captured for research use',
        '- [ ] Publish config mirrors the locked trial protocol without adaptive overrides',
    ].join('\n');
}

function getDefaultDurationMinutes(variant: VariantEntry) {
    const archetype = resolveVariantArchetype(variant);
    const lockedSpec = ensureLockedSpec(variant);
    const variantOverride = getVariantSpecificProfileOverride(variant, archetype);
    if (variantOverride?.durationMinutes) {
        return variantOverride.durationMinutes;
    }
    if (archetype === 'trial' && lockedSpec?.fixedDuration) {
        const parsed = Number.parseInt(lockedSpec.fixedDuration, 10);
        if (Number.isFinite(parsed)) return parsed;
    }

    switch (archetype) {
        case 'short_daily':
            return 3;
        case 'trial':
            return 12;
        case 'fatigue_load':
        case 'immersive':
            return 6;
        default:
            return variant.mode === 'hybrid' ? 4 : 5;
    }
}

function getGenericArchetypeSpecNotes(variant: VariantEntry, familyBase: FamilySpecBase | undefined, theme: VariantTheme) {
    const profile = buildArchetypeProfile(variant, familyBase, theme.archetype);
    const archetypeLabel = theme.archetype === 'baseline' && theme.variantType !== 'Branch variant'
        ? `${ARCHETYPE_LABELS[theme.archetype]} (${theme.variantType})`
        : ARCHETYPE_LABELS[theme.archetype];
    return [
        `Archetype: ${archetypeLabel}`,
        `Recommended session length defaults to ${getDefaultDurationMinutes(variant)} minutes unless the registry overrides it.`,
        `Default feedback mode is ${profile.runtimeDefaults.feedbackMode}.`,
        `Adaptive difficulty is ${profile.runtimeDefaults.adaptiveDifficulty ? 'enabled inside family boundaries' : 'disabled by default'}.`,
        `Runtime emphasis: ${profile.runtimeDefaults.emphasis.join('; ')}.`,
        `Analytics focus: ${profile.runtimeDefaults.analyticsFocus.join('; ')}.`,
    ];
}

function getNonTrialMeasurementNotes(variant: VariantEntry, theme: VariantTheme) {
    if (variant.family === 'The Kill Switch') {
        return [
            'Recovery Time = disruption end -> confirmed re-engagement, with valid re-engagement requiring two consecutive correct responses on the refocused task.',
            'First-Post-Reset Accuracy must be reported alongside Recovery Time so the athlete cannot game the sim by reacting fast but inaccurately.',
            'False Start Count = responses during the disruption phase before the reset signal; false starts are logged separately and do not count as recovery.',
            'Responses below 150 ms are motor artifacts and must be excluded from the headline metric.',
            'Attentional Shifting remains a multi-source score combining re-engagement latency with first-post-reset accuracy.',
            'Pressure Stability remains modifier-stratified, comparing Recovery Time under baseline versus pressure conditions instead of averaging modifier states together.',
            'Sport, scenario, or delivery tags may support interpretation, but they must remain context fields and may not replace the family metric.',
        ];
    }

    if (variant.family === 'Noise Gate') {
        const archetype = resolveVariantArchetype(variant);
        const channelBreakdownNote = archetype === 'audio_channel'
            ? 'Channel Vulnerability must be reported by distractor type, with audio-channel breakdowns carried by crowd, commentary, whistle, and off-rhythm sound tags.'
            : 'Channel Vulnerability must be reported by distractor type rather than flattened into one unlabeled distractor score.';

        return [
            'Distractor Cost = baseline accuracy - noise-phase accuracy, with RT shift reported alongside it. Accuracy remains the headline number.',
            'Valid response = correct response to the primary target during the noise phase, inside the target response window, and above 150 ms.',
            'False Alarm Rate = responses directed at distractors rather than the primary target; false alarms must be classified by distractor type.',
            channelBreakdownNote,
            'Pressure Stability should be read as Distractor Cost under baseline versus pressure modifier conditions, stratified by modifier condition rather than averaged together.',
            'Channel, overlap, and context tags may support interpretation, but they must remain decomposition fields rather than a replacement scoring system.',
        ];
    }

    if (variant.family === 'Brake Point') {
        return [
            'Valid Go response = correct response to a Go stimulus within the response window and above 150 ms; responses below 150 ms are motor artifacts.',
            'Stop Latency is the headline metric and should be derived from the stop-signal distribution rather than treated as a simple button-press reaction time.',
            'False Alarm Rate = responses executed on No-Go trials, classified by No-Go type (obvious, fakeout, late-reveal) rather than flattened together.',
            'Over-Inhibition must be tracked through Go misses and excessively slow Go reaction time so the athlete cannot solve inhibition by simply slowing down.',
            'Pressure Stability should be read as Stop Latency under baseline versus pressure modifier conditions, stratified by modifier condition rather than averaged together.',
            'Per-type false alarms and speed-accuracy balance should be preserved as supporting outputs beside the headline Stop Latency metric.',
        ];
    }

    if (variant.family === 'Signal Window') {
        return [
            'Valid response = the first committed response after display onset, above 150 ms; only one response per trial and the first commitment is final.',
            'Correct Read Under Time Pressure is the headline metric, combining correct-read rate with decision latency; both components must be reported separately as well.',
            'Decoy Susceptibility must classify plausible-wrong cue selections separately from neutral misses rather than collapsing both into one error bucket.',
            'Window Utilization must be tracked so the build can distinguish early guesses from late, information-rich commitments.',
            'Pressure Stability should be read as decision quality under baseline versus pressure modifier conditions, stratified by modifier condition rather than averaged together.',
            'Cue type, ambiguity level, and window-length tags should support interpretation, but they must remain context fields rather than a replacement scoring system.',
        ];
    }

    if (variant.family === 'Sequence Shift') {
        return [
            'Update Accuracy After Rule Change is the headline metric and should be measured across the first 3-5 trials after a rule change rather than steady-state performance.',
            'Old-rule intrusions must be classified separately from novel errors so the build can tell the difference between perseveration and general confusion.',
            'Switch Cost = first post-shift reaction time versus the pre-shift rolling average, reported alongside post-shift accuracy.',
            'Responses below 150 ms on post-shift trials are motor artifacts and must be excluded from the headline metric.',
            'Pressure Stability should be read as post-shift decision quality under baseline versus pressure modifier conditions, stratified by modifier condition rather than averaged together.',
            'Shift type, rule-change schedule, and post-shift window tags should support interpretation, but they must remain context fields rather than a replacement scoring system.',
        ];
    }

    if (variant.family === 'Endurance Lock') {
        return [
            'Baseline Performance = the first 2-3 minutes of the session, treated as the 100% reference window for all later blocks.',
            'Degradation Onset = the point when performance first drops below 90% of baseline and stays there for at least one full block; one isolated low block does not count.',
            'Degradation Slope is the headline metric and should be calculated as the accuracy decline over the session second half, expressed as % drop per minute.',
            'Late-Probe scoring should compare final challenge performance against equivalent baseline difficulty rather than treating the final spike as interchangeable with the slope metric.',
            'Embedded task attribution must stay with Endurance Lock; if another family task is embedded, the measured phenomenon is duration-dependent degradation, not the embedded family score.',
            'Block identity, onset timing, and embedded-task tags may support interpretation, but they must remain context fields rather than a replacement scoring system.',
        ];
    }

    return theme.scoringNotes;
}

function getNonTrialModeNotes(variant: VariantEntry, theme: VariantTheme) {
    const archetype = resolveVariantArchetype(variant);
    const trainingMode = [...theme.trainingMode];
    const trialMode = [...theme.trialMode];

    if (variant.family === 'The Kill Switch' && archetype === 'sport_context') {
        return {
            trainingMode: [
                ...trainingMode,
                'use sport-native reset language and scenario tags, but keep coaching anchored to Recovery Time and first clean re-engagement',
            ],
            trialMode: [
                ...trialMode,
                'if trial-layer packaging is used, hold sport scenario, reset-moment tags, and primary-task mapping constant across comparison sessions',
            ],
        };
    }

    if (variant.family === 'Noise Gate' && archetype === 'combined_channel') {
        return {
            trainingMode: [
                ...trainingMode,
                'show per-channel and overlap-tagged coaching so the athlete can see whether misses came from visual-only, audio-only, or combined-overlap conditions',
            ],
            trialMode: [
                ...trialMode,
                'standardize overlap schedule, visual presentation state, audio route, and overlap logging so combined-channel comparisons stay reproducible',
            ],
        };
    }

    if (variant.family === 'Signal Window' && archetype === 'sport_context') {
        return {
            trainingMode: [
                ...trainingMode,
                'use sport-native cue language and shot-clock or scenario tags, but keep coaching anchored to correct reads, decision latency, and cue commitment quality',
            ],
            trialMode: [
                ...trialMode,
                'if trial-layer packaging is used, hold sport scenario, cue type, window length, and ambiguity profile constant across comparison sessions',
            ],
        };
    }

    if (variant.family === 'Endurance Lock' && archetype === 'fatigue_load') {
        return {
            trainingMode: [
                ...trainingMode,
                'show block-by-block fatigue coaching so the athlete can see whether execution is slipping early, mid, or late rather than over-reading one bad moment',
            ],
            trialMode: [
                ...trialMode,
                'if trial-layer packaging is used, hold baseline window, pacing structure, and late-probe timing constant so degradation curves stay comparable',
            ],
        };
    }

    return { trainingMode, trialMode };
}

function getNonTrialBuildNotes(variant: VariantEntry, theme: VariantTheme) {
    if (variant.family === 'The Kill Switch' && resolveVariantArchetype(variant) === 'sport_context') {
        return [
            ...theme.buildNotes,
            'Store sport, scenario, phase-of-play, and reset-moment tags in the session record so sport framing stays inspectable rather than anecdotal.',
            'Keep the same primary-task mapping under the sport wrapper; assets, copy, and environmental cues may change, but the reset target may not.',
            'Preserve disruption-channel tags beneath the sport layer so coaches can distinguish sport context from visual, audio, or cognitive pressure sources.',
        ];
    }

    if (variant.family === 'Noise Gate' && resolveVariantArchetype(variant) === 'combined_channel') {
        return [
            ...theme.buildNotes,
            'Store per-channel trigger tags and overlap timing windows so misses can be attributed to visual-only, audio-only, or combined-overlap conditions.',
            'Export overlap-condition error counts, channel-tagged false alarms, and timing-misalignment flags rather than flattening all misses into one combined distractor bucket.',
            'Keep overlap sequencing reproducible within the approved family bounds so added difficulty comes from layered noise, not uncontrolled timing drift.',
        ];
    }

    if (variant.family === 'Noise Gate' && resolveVariantArchetype(variant) === 'audio_channel') {
        return [
            ...theme.buildNotes,
            'Store audio route, device class, and distractor subtype tags (crowd, commentary, whistle, off-rhythm sound) in the session record.',
            'Keep visual presentation stable enough that audio remains the primary pressure channel rather than drifting into a mixed-channel build.',
        ];
    }

    if (variant.family === 'Brake Point') {
        return [
            ...theme.buildNotes,
            'Store No-Go type tags, stop-signal delay, Go reaction-time window, and lure timing so false alarms can be separated into obvious, fakeout, and late-reveal conditions.',
            'Export false alarms, Go misses, over-inhibition markers, and motor artifacts separately from the headline Stop Latency metric.',
        ];
    }

    if (variant.family === 'Signal Window' && resolveVariantArchetype(variant) === 'sport_context') {
        return [
            ...theme.buildNotes,
            'Store sport, scenario, cue type, phase-of-play, and shot-clock or time-pressure tags in the session record so the sport wrapper is inspectable rather than anecdotal.',
            'Export window length, ambiguity level, decoy classification, and decision-latency fields separately so coaches can see whether misses came from rushed reads or wrong reads.',
            'Keep the underlying cue-discrimination task stable under the sport wrapper; contextual assets may change, but the correct-answer structure may not.',
        ];
    }

    if (variant.family === 'Signal Window') {
        return [
            ...theme.buildNotes,
            'Store cue type, ambiguity level, window length, and decoy classification tags in the session record so read-quality errors are interpretable.',
        ];
    }

    if (variant.family === 'Sequence Shift') {
        return [
            ...theme.buildNotes,
            'Store shift type, rule-change schedule, old-rule intrusion tags, and post-shift window markers in the session record so update failures are interpretable.',
            'Export switch-cost, post-shift accuracy, intrusion classification, and motor artifacts separately rather than flattening all shift errors into one bucket.',
        ];
    }

    if (variant.family === 'Endurance Lock') {
        return [
            ...theme.buildNotes,
            'Store baseline-window markers, block identities, degradation-onset tags, and late-probe markers in the session record so endurance failures are interpretable.',
            'Export baseline performance, block-by-block accuracy, degradation slope, onset timing, and embedded-task attribution separately rather than flattening the full session into one fatigue score.',
        ];
    }

    return theme.buildNotes;
}

function cleanupGeneratedBuildNotes(variant: VariantEntry, notes: string[]) {
    const cleaned: string[] = [];
    const seen = new Set<string>();

    notes.forEach((note) => {
        const key = note.trim().toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            cleaned.push(note);
        }
    });

    if (variant.family === 'Signal Window' && variant.name.toLowerCase().includes('rapid recognition')) {
        const hasFirstCommit = cleaned.some((note) => note.toLowerCase().includes('first-commit timing buckets'));
        const cueIndex = cleaned.findIndex((note) => note.toLowerCase().includes('store cue type, ambiguity level, window length, and decoy classification tags'));
        if (hasFirstCommit && cueIndex >= 0) {
            const next = cleaned.filter((note) => !note.toLowerCase().includes('first-commit timing buckets'));
            next[cueIndex] = 'Store cue type, ambiguity level, window length, decoy classification, and first-commit timing buckets in the session record so read-quality errors are interpretable.';
            return next;
        }
    }

    if (variant.family === 'Sequence Shift' && variant.name.toLowerCase().includes('sequence-memory')) {
        const hasMemorySpecific = cleaned.some((note) => note.toLowerCase().includes('old-rule pattern tags and first-correct-after-shift markers'));
        const familyIndex = cleaned.findIndex((note) => note.toLowerCase().includes('store shift type, rule-change schedule, old-rule intrusion tags'));
        if (hasMemorySpecific && familyIndex >= 0) {
            const next = cleaned.filter((note) => !note.toLowerCase().includes('old-rule pattern tags and first-correct-after-shift markers'));
            next[familyIndex] = 'Store shift type, rule-change schedule, old-rule pattern / intrusion tags, post-shift window markers, and first-correct-after-shift markers in the session record so update failures are interpretable.';
            return next;
        }
    }

    if (variant.family === 'Endurance Lock') {
        const hasFinalPhaseSpecific = cleaned.some((note) => note.toLowerCase().includes('finish-phase challenge markers'));
        const familyIndex = cleaned.findIndex((note) => note.toLowerCase().includes('store baseline-window markers, block identities, degradation-onset tags, and late-probe markers'));
        if (hasFinalPhaseSpecific && familyIndex >= 0) {
            const next = cleaned.filter((note) => !note.toLowerCase().includes('finish-phase challenge markers'));
            next[familyIndex] = 'Store baseline-window markers, block identities, degradation-onset tags, and final-phase challenge markers in the session record so endurance failures are interpretable.';
            return next;
        }
    }

    return cleaned;
}

function buildSupportedWarningFixActions(variant: VariantEntry, findings: SpecAuditFinding[]): WarningFixAction[] {
    const warningCodes = new Set(findings.filter((finding) => finding.severity === 'warning').map((finding) => finding.code));
    const archetype = resolveVariantArchetype(variant);
    const actions: WarningFixAction[] = [];

    if (warningCodes.has('terminology_mismatch')) {
        if (archetype === 'trial') {
            actions.push({
                key: 'protocol_wording',
                label: 'Tighten Trial Protocol',
                codes: ['terminology_mismatch'],
            });
        } else if (archetype === 'sport_context') {
            actions.push({
                key: 'sport_wording',
                label: 'Tighten Sport Context Wording',
                codes: ['terminology_mismatch'],
            });
        } else {
            actions.push({
                key: 'normalize_terms',
                label: 'Normalize Terms',
                codes: ['terminology_mismatch'],
            });
        }
    }

    if (warningCodes.has('vague_language')) {
        if (archetype === 'trial') {
            actions.push({
                key: 'protocol_wording',
                label: 'Tighten Trial Protocol',
                codes: ['vague_language'],
            });
        } else if (archetype === 'sport_context') {
            actions.push({
                key: 'sport_wording',
                label: 'Tighten Sport Context Wording',
                codes: ['vague_language'],
            });
        } else {
            actions.push({
                key: 'tighten_wording',
                label: 'Tighten Wording',
                codes: ['vague_language'],
            });
        }
    }

    if (
        warningCodes.has('overlapping_build_notes')
        || warningCodes.has('near_duplicate_build_note')
        || warningCodes.has('final_phase_term_overlap')
        || warningCodes.has('dense_build_section')
    ) {
        const label = variant.family === 'Endurance Lock'
            ? 'Consolidate Endurance Markers'
            : variant.family === 'Sequence Shift'
                ? 'Consolidate Shift Markers'
                : variant.family === 'Signal Window' && archetype === 'sport_context'
                    ? 'Consolidate Sport Context Tags'
                    : variant.family === 'Noise Gate' && archetype === 'combined_channel'
                        ? 'Consolidate Overlap Tags'
                        : 'Consolidate Build Notes';

        actions.push({
            key: 'consolidate_build_notes',
            label,
            codes: ['overlapping_build_notes', 'near_duplicate_build_note', 'final_phase_term_overlap', 'dense_build_section'],
        });
    }

    const merged = new Map<WarningFixAction['key'], WarningFixAction>();
    actions.forEach((action) => {
        const existing = merged.get(action.key);
        if (!existing) {
            merged.set(action.key, action);
            return;
        }
        merged.set(action.key, {
            ...existing,
            codes: Array.from(new Set([...existing.codes, ...action.codes])),
        });
    });

    return Array.from(merged.values());
}

function buildWarningFixGroups(variant: VariantEntry, findings: SpecAuditFinding[]): WarningFixGroup[] {
    const warningFindings = findings.filter((finding) => finding.severity === 'warning');
    const actions = buildSupportedWarningFixActions(variant, findings);
    const groups = new Map<string, WarningFixGroup>();

    actions.forEach((action) => {
        groups.set(action.key, {
            key: action.key,
            label: action.label,
            findings: [],
            fixable: true,
        });
    });

    warningFindings.forEach((finding) => {
        const action = actions.find((candidate) => candidate.codes.includes(finding.code));
        if (action) {
            groups.get(action.key)?.findings.push(finding);
            return;
        }

        const manualKey = `manual:${finding.code}`;
        if (!groups.has(manualKey)) {
            groups.set(manualKey, {
                key: manualKey,
                label: 'Manual Review',
                findings: [],
                fixable: false,
            });
        }
        groups.get(manualKey)?.findings.push(finding);
    });

    return Array.from(groups.values()).filter((group) => group.findings.length > 0);
}

function applyAuditWarningFixes(variant: VariantEntry, raw: string, action: WarningFixAction) {
    let next = raw;

    if (action.codes.includes('terminology_mismatch')) {
        next = next.replace(/device type/gi, 'device class');
    }

    if (action.codes.includes('vague_language')) {
        next = next
            .replace(/\broughly\b\s*/gi, '')
            .replace(/\btypically\b[\s,]*/gi, '')
            .replace(/\bgenerally\b[\s,]*/gi, '')
            .replace(/\s{2,}/g, ' ')
            .replace(/\n /g, '\n');
    }

    if (action.key === 'consolidate_build_notes') {
        const parsed = parseVariantSpec(next);
        const buildBullets = extractSectionBullets(parsed, 'build');
        if (buildBullets.length > 0) {
            const cleanedBuildBullets = cleanupGeneratedBuildNotes(variant, buildBullets);
            next = replaceSectionBullets(next, 'build', cleanedBuildBullets);
        }
    }

    return normalizeSpecText(next);
}

function buildGeneratedVariantSpec(variant: VariantEntry): string {
    const familyBase = FAMILY_SPEC_BASES[variant.family];
    const theme = inferVariantTheme(variant);
    const modeNotes = getNonTrialModeNotes(variant, theme);
    const buildNotes = cleanupGeneratedBuildNotes(variant, getNonTrialBuildNotes(variant, theme));
    const today = 'March 9, 2026';

    if (isTrialVariant(variant)) {
        return buildGeneratedTrialVariantSpec(variant, familyBase, theme, today);
    }

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
        '3. Archetype Packaging Defaults',
        ...getGenericArchetypeSpecNotes(variant, familyBase, theme).map((item) => `- ${item}`),
        '',
        '4. Family Inheritance vs Variant Changes',
        `Inherited from ${variant.family} and the Sim Specification Standards Addendum:`,
        `- Core mechanism remains ${familyBase?.mechanism ?? 'defined by the parent family spec'}.`,
        `- Core metric remains ${familyBase?.coreMetric ?? 'the parent family metric'}.`,
        `- Primary skill targets remain ${familyBase?.skillTargets ?? 'the parent family skill architecture'}.`,
        `- Boundary rule remains ${familyBase?.boundaryRule ?? 'governed by the parent family spec'}.`,
        'What changes in this variant:',
        ...theme.changes.map((item) => `- ${item}`),
        '',
        '5. Athlete Experience Flow',
        ...theme.athleteFlow.map((item) => `- ${item}`),
        '',
        '6. Measurement and Scoring Notes',
        ...getNonTrialMeasurementNotes(variant, theme).map((item) => `- ${item}`),
        'Artifact / false-start risks:',
        ...theme.artifactRisks.map((item) => `- ${item}`),
        '',
        '7. Mode Behavior',
        'Training Mode:',
        ...modeNotes.trainingMode.map((item) => `- ${item}`),
        'Trial Mode:',
        ...modeNotes.trialMode.map((item) => `- ${item}`),
        '',
        '8. Build and Implementation Notes',
        ...buildNotes.map((item) => `- ${item}`),
        '',
        '9. Governing Documents',
        ...(familyBase?.governingDocs ?? [
            'Sim Specification Standards Addendum (v2)',
            `${variant.family} Family Spec`,
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ]).map((item) => `- ${item}`),
        '',
        '10. Boundary Safeguards',
        ...theme.boundarySafeguards.map((item) => `- ${item}`),
        '',
        '11. Variant Readiness Checklist',
        '- [ ] Core identity fields reviewed against the registry entry',
        '- [ ] Archetype defaults match the intended packaging for this variant',
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
    return getDefaultDurationMinutes(variant);
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
    const archetypeProfile = buildArchetypeProfile(variant, familyBase, theme.archetype);
    const lockedSpec = ensureLockedSpec(variant);

    return {
        schemaVersion: 'sim-variant-config/v1',
        variantId: buildSimVariantId(variant),
        archetype: theme.archetype,
        family: variant.family,
        variantName: variant.name,
        mode: variant.mode,
        specStatus: variant.specStatus,
        mechanism: familyBase?.mechanism ?? '',
        primaryMetric: familyBase?.coreMetric ?? '',
        skillTargets: familyBase?.skillTargets ?? '',
        session: {
            durationMinutes: inferModuleDurationMinutes(variant),
            feedbackMode: archetypeProfile.runtimeDefaults.feedbackMode,
            adaptiveDifficulty: archetypeProfile.runtimeDefaults.adaptiveDifficulty,
        },
        stimuli: {
            variantType: theme.variantType,
            emphasis: archetypeProfile.runtimeDefaults.emphasis,
        },
        scoring: {
            headlineMetric: familyBase?.coreMetric ?? '',
            artifactRisks: theme.artifactRisks,
        },
        analytics: {
            tags: [variant.family, variant.mode, theme.variantType, ARCHETYPE_LABELS[theme.archetype]],
            focus: archetypeProfile.runtimeDefaults.analyticsFocus,
        },
        lockedSpec: lockedSpec ?? null,
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

function normalizeModuleDraft(
    variant: VariantEntry,
    moduleDraft: Partial<SimVariantModuleDraft> | undefined,
    sortOrder: number
): SimVariantModuleDraft {
    const defaultModuleDraft = buildDefaultModuleDraft(variant, sortOrder);
    return {
        ...defaultModuleDraft,
        ...(moduleDraft ?? {}),
        overview: {
            ...defaultModuleDraft.overview,
            ...((moduleDraft?.overview as Partial<SimVariantModuleDraft['overview']> | undefined) ?? {}),
        },
    };
}

function resolveSpecStatus(record: SimVariantRecord): SpecStatus {
    if (record.mode === 'hybrid' || record.specStatus === 'not-required') return 'not-required';
    if (record.specStatus === 'complete') return 'complete';
    if (record.specRaw?.trim()) return 'in-progress';
    return 'needs-spec';
}

function buildVariantWorkspace(seed: VariantEntry, existing: SimVariantRecord | undefined, sortOrder: number): SimVariantRecord {
    return applyDraftSyncState({
        id: existing?.id ?? buildSimVariantId(seed),
        name: existing?.name ?? seed.name,
        family: existing?.family ?? seed.family,
        familyStatus: existing?.familyStatus ?? seed.familyStatus,
        mode: existing?.mode ?? seed.mode,
        priority: existing?.priority ?? seed.priority,
        specStatus: existing ? resolveSpecStatus(existing) : seed.specStatus,
        specRaw: existing?.specRaw ?? '',
        archetypeOverride: existing?.archetypeOverride,
        lockedSpec: existing?.lockedSpec ?? buildDefaultLockedSpec(existing ?? seed),
        runtimeConfig: existing?.runtimeConfig ?? buildDefaultRuntimeConfig(seed),
        moduleDraft: normalizeModuleDraft(seed, existing?.moduleDraft, sortOrder),
        engineKey: existing?.engineKey,
        buildStatus: existing?.buildStatus,
        syncStatus: existing?.syncStatus,
        sourceFingerprint: existing?.sourceFingerprint,
        lastBuiltFingerprint: existing?.lastBuiltFingerprint,
        lastPublishedFingerprint: existing?.lastPublishedFingerprint,
        buildArtifact: existing?.buildArtifact,
        buildMeta: existing?.buildMeta,
        publishedSnapshot: existing?.publishedSnapshot,
        publishedModuleId: existing?.publishedModuleId,
        publishedAt: existing?.publishedAt,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: existing?.updatedAt ?? Date.now(),
    });
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
    const archetype = resolveVariantArchetype(record);
    const nextModule: MentalExercise = {
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
        variantSource: {
            variantId: record.id,
            variantName: record.name,
            family: record.family,
            mode: record.mode,
            archetype,
        },
        createdAt: record.createdAt,
        updatedAt: Date.now(),
    };
    return buildPublishedModuleFromVariant(record, nextModule);
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
    onBuild,
    onPublish,
    initialSpecRaw,
    initialTab = 'spec',
    saving,
    building,
    publishing,
}: {
    variant: SimVariantRecord;
    onClose: () => void;
    onSave: (next: SimVariantRecord) => Promise<void>;
    onBuild: (next: SimVariantRecord) => Promise<void>;
    onPublish: (next: SimVariantRecord) => Promise<void>;
    initialSpecRaw?: string;
    initialTab?: 'general' | 'locks' | 'spec' | 'config' | 'publish' | 'history';
    saving: boolean;
    building: boolean;
    publishing: boolean;
}) {
    const [variantMeta, setVariantMeta] = useState<SimVariantRecord>(variant);
    const familyColor = FAMILY_COLORS[variantMeta.family] || '#6b7280';
    const [activeTab, setActiveTab] = useState<'general' | 'locks' | 'spec' | 'config' | 'publish' | 'history'>(initialTab);
    const [rawSpec, setRawSpec] = useState(initialSpecRaw ?? variant.specRaw ?? '');
    const [parsed, setParsed] = useState<ParsedSpec | null>((initialSpecRaw ?? variant.specRaw)?.trim() ? parseVariantSpec(initialSpecRaw ?? variant.specRaw ?? '') : null);
    const [configText, setConfigText] = useState(JSON.stringify(variant.runtimeConfig ?? buildDefaultRuntimeConfig(variant), null, 2));
    const [configError, setConfigError] = useState<string | null>(null);
    const [moduleDraft, setModuleDraft] = useState<SimVariantModuleDraft>(normalizeModuleDraft(variant, variant.moduleDraft, 0));
    const [benefitsText, setBenefitsText] = useState((normalizeModuleDraft(variant, variant.moduleDraft, 0).benefits ?? []).join('\n'));
    const [bestForText, setBestForText] = useState((normalizeModuleDraft(variant, variant.moduleDraft, 0).bestFor ?? []).join('\n'));
    const [historyEntries, setHistoryEntries] = useState<SimVariantHistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [restoringHistoryId, setRestoringHistoryId] = useState<string | null>(null);
    const [auditReport, setAuditReport] = useState<SpecAuditReport | null>(null);
    const [warningFixFeedback, setWarningFixFeedback] = useState<WarningFixFeedback | null>(null);
    const [showDetailedFindings, setShowDetailedFindings] = useState(false);
    const [previewModule, setPreviewModule] = useState<MentalExercise | null>(null);
    const [loadingPublishedPreview, setLoadingPublishedPreview] = useState(false);
    const trialVariant = isTrialVariant(variantMeta);
    const activeLockedSpec = variantMeta.lockedSpec ?? buildDefaultLockedSpec(variantMeta);
    const warningFindings = useMemo(
        () => auditReport?.findings.filter((finding) => finding.severity === 'warning') ?? [],
        [auditReport]
    );
    const warningFixActions = useMemo(
        () => auditReport ? buildSupportedWarningFixActions(variantMeta, auditReport.findings) : [],
        [auditReport, variantMeta]
    );
    const warningFixGroups = useMemo(
        () => auditReport ? buildWarningFixGroups(variantMeta, auditReport.findings) : [],
        [auditReport, variantMeta]
    );
    const nextWarningFixAction = warningFixActions[0] ?? null;
    const warningFindingCount = warningFindings.length;
    const warningFixStepCount = warningFixActions.length;
    const syncSummary = useMemo(() => summarizeVariantSyncDiff(variantMeta), [variantMeta]);
    const effectiveBuildStatus = variantMeta.buildStatus ?? 'not_built';
    const effectiveSyncStatus = variantMeta.syncStatus ?? 'in_sync';
    const buildStatusConf = BUILD_STATUS_CONFIG[effectiveBuildStatus];
    const syncStatusConf = SYNC_STATUS_CONFIG[effectiveSyncStatus];

    useEffect(() => {
        const nextRawSpec = initialSpecRaw ?? variant.specRaw ?? '';
        const nextModuleDraft = normalizeModuleDraft(variant, variant.moduleDraft, 0);
        setVariantMeta(variant);
        setActiveTab(initialTab);
        setRawSpec(nextRawSpec);
        setParsed(nextRawSpec.trim() ? parseVariantSpec(nextRawSpec) : null);
        setConfigText(JSON.stringify(variant.runtimeConfig ?? buildDefaultRuntimeConfig(variant), null, 2));
        setConfigError(null);
        setAuditReport(nextRawSpec.trim() ? runSpecAuditPipeline(variant, nextRawSpec) : null);
        setWarningFixFeedback(null);
        setShowDetailedFindings(false);
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
        const audit = runSpecAuditPipeline(variantMeta, generated);
        setRawSpec(audit.fixedRaw);
        setParsed(parseVariantSpec(audit.fixedRaw));
        setAuditReport(audit);
        setWarningFixFeedback(null);
        setShowDetailedFindings(false);
        setActiveTab('spec');
    };

    const handleRunAudit = () => {
        const audit = runSpecAuditPipeline(variantMeta, rawSpec);
        setRawSpec(audit.fixedRaw);
        setParsed(audit.fixedRaw.trim() ? parseVariantSpec(audit.fixedRaw) : null);
        setAuditReport(audit);
        setShowDetailedFindings(false);
        return audit;
    };

    const handleFixAuditWarnings = () => {
        if (!auditReport || warningFixActions.length === 0) {
            return;
        }
        const nextAction = warningFixActions[0];
        const previousWarningCount = warningFindings.length;
        const nextRawSpec = applyAuditWarningFixes(variantMeta, rawSpec, nextAction);
        const audit = runSpecAuditPipeline(variantMeta, nextRawSpec);
        setRawSpec(audit.fixedRaw);
        setParsed(audit.fixedRaw.trim() ? parseVariantSpec(audit.fixedRaw) : null);
        setAuditReport(audit);
        setWarningFixFeedback({
            label: nextAction.label,
            previousWarningCount,
            currentWarningCount: audit.findings.filter((finding) => finding.severity === 'warning').length,
        });
    };

    const updateLockedSpec = (field: keyof SimVariantLockedSpec, value: string) => {
        setVariantMeta((current) => ({
            ...current,
            lockedSpec: {
                ...(current.lockedSpec ?? buildDefaultLockedSpec(current)!),
                [field]: value,
            },
        }));
    };

    const buildNextRecord = (nextSpecRaw: string = rawSpec): SimVariantRecord | null => {
        try {
            const runtimeConfig = JSON.parse(configText);
            return applyDraftSyncState({
                ...variantMeta,
                specRaw: nextSpecRaw,
                lockedSpec: isTrialVariant(variantMeta) ? (variantMeta.lockedSpec ?? buildDefaultLockedSpec(variantMeta)) : undefined,
                specStatus: variantMeta.mode === 'hybrid'
                    ? 'not-required'
                    : nextSpecRaw.trim()
                        ? variantMeta.publishedModuleId
                            ? 'complete'
                            : 'in-progress'
                        : 'needs-spec',
                runtimeConfig: {
                    ...runtimeConfig,
                    lockedSpec: isTrialVariant(variantMeta) ? (variantMeta.lockedSpec ?? buildDefaultLockedSpec(variantMeta)) : null,
                },
                moduleDraft: {
                    ...moduleDraft,
                    benefits: benefitsText.split('\n').map((item) => item.trim()).filter(Boolean),
                    bestFor: bestForText.split('\n').map((item) => item.trim()).filter(Boolean),
                },
                updatedAt: Date.now(),
            });
        } catch (error: any) {
            setConfigError(error.message);
            setActiveTab('config');
            return null;
        }
    };

    const handleSave = async () => {
        const audit = handleRunAudit();
        if (audit.status === 'needs_input') {
            setActiveTab('spec');
            return;
        }
        const next = buildNextRecord(audit.fixedRaw);
        if (!next) return;
        if (audit.fixedRaw.trim()) {
            setParsed(parseVariantSpec(audit.fixedRaw));
        }
        await onSave(next);
    };

    const handleBuild = async () => {
        const audit = handleRunAudit();
        if (audit.status === 'needs_input') {
            setActiveTab('spec');
            return;
        }
        const next = buildNextRecord(audit.fixedRaw);
        if (!next) return;
        const builtRecord = buildVariantRecordForBuild(next);
        setVariantMeta(builtRecord);
        await onBuild(builtRecord);
    };

    const handlePublish = async () => {
        const audit = handleRunAudit();
        if (audit.status === 'needs_input') {
            setActiveTab('spec');
            return;
        }
        const next = buildNextRecord(audit.fixedRaw);
        if (!next) return;
        const builtRecord = buildVariantRecordForBuild(next);
        setVariantMeta(builtRecord);
        await onPublish(builtRecord);
    };

    const handlePreviewBuild = () => {
        const audit = handleRunAudit();
        if (audit.status === 'needs_input') {
            setActiveTab('spec');
            return;
        }
        const next = buildNextRecord(audit.fixedRaw);
        if (!next) return;
        const builtRecord = buildVariantRecordForBuild(next);
        setVariantMeta(builtRecord);
        setPreviewModule(buildPublishedModule(builtRecord));
    };

    const handlePreviewPublishedModule = async () => {
        if (!variantMeta.publishedModuleId) return;
        setLoadingPublishedPreview(true);
        try {
            const module = await simModuleLibraryService.getById(variantMeta.publishedModuleId);
            if (module) {
                setPreviewModule(module);
            }
        } catch (error) {
            console.error('Failed to load published module preview:', error);
        } finally {
            setLoadingPublishedPreview(false);
        }
    };

    const handleRestoreSnapshot = (entry: SimVariantHistoryEntry) => {
        setRestoringHistoryId(entry.id);
        const snapshot = applyDraftSyncState(entry.snapshot);
        const nextRawSpec = snapshot.specRaw ?? '';
        const nextModuleDraft = normalizeModuleDraft(snapshot, snapshot.moduleDraft, 0);
        setVariantMeta(snapshot);
        setRawSpec(nextRawSpec);
        setParsed(nextRawSpec.trim() ? parseVariantSpec(nextRawSpec) : null);
        setAuditReport(nextRawSpec.trim() ? runSpecAuditPipeline(snapshot, nextRawSpec) : null);
        setWarningFixFeedback(null);
        setShowDetailedFindings(false);
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
                        ...(trialVariant ? [{ id: 'locks' as const, label: 'Locked Fields' }] : []),
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
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Archetype</label>
                                    <select
                                        value={variantMeta.archetypeOverride ?? resolveVariantArchetype(variantMeta)}
                                        onChange={(event) => setVariantMeta((current) => ({
                                            ...current,
                                            archetypeOverride: event.target.value as SimVariantArchetype,
                                            lockedSpec: event.target.value === 'trial'
                                                ? (current.lockedSpec ?? buildDefaultLockedSpec({ ...current, archetypeOverride: 'trial' }))
                                                : current.lockedSpec,
                                        }))}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    >
                                        {Object.entries(ARCHETYPE_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
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

                    {activeTab === 'locks' && trialVariant && activeLockedSpec && (
                        <div className="space-y-5">
                            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
                                <p className="text-xs text-cyan-300 leading-relaxed">
                                    These are the registry-owned locked trial fields. The generator and runtime config read from this block so the spec stops guessing and starts rendering the exact assessment contract.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Fixed Tier</label>
                                    <input
                                        value={activeLockedSpec.fixedTier}
                                        onChange={(event) => updateLockedSpec('fixedTier', event.target.value)}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Fixed Duration</label>
                                    <input
                                        value={activeLockedSpec.fixedDuration}
                                        onChange={(event) => updateLockedSpec('fixedDuration', event.target.value)}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Target Session Structure</label>
                                    <input
                                        value={activeLockedSpec.targetSessionStructure}
                                        onChange={(event) => updateLockedSpec('targetSessionStructure', event.target.value)}
                                        className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {([
                                    ['buildVersionPolicy', 'Build Version Rule'],
                                    ['seedPolicy', 'Seed / Schedule Rule'],
                                    ['modifierProfile', 'Modifier Profile'],
                                    ['environmentRequirements', 'Environment Requirements'],
                                    ['fixedProfileDetails', 'Fixed Family Profile'],
                                    ['motorBaselineRule', 'Motor Baseline Rule'],
                                    ['deviceCovariateRule', 'Device Covariate Rule'],
                                    ['exportRequirements', 'Export Requirements'],
                                ] as Array<[keyof SimVariantLockedSpec, string]>).map(([field, label]) => (
                                    <div key={field}>
                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{label}</label>
                                        <textarea
                                            value={activeLockedSpec[field]}
                                            onChange={(event) => updateLockedSpec(field, event.target.value)}
                                            className="w-full min-h-[96px] rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500 resize-y"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {([
                                    ['validResponseRule', 'Valid Response Rule'],
                                    ['artifactFloorRule', 'Artifact Floor Rule'],
                                    ['maxWindowRule', 'Max Window Rule'],
                                    ['failedRoundRule', 'Failed Round Rule'],
                                    ['falseStartRule', 'False Start Rule'],
                                    ['validSessionRule', 'Valid Session Rule'],
                                    ['partialSessionRule', 'Partial Session Rule'],
                                    ['invalidSessionRule', 'Invalid Session Rule'],
                                    ['dropoutRule', 'Dropout Rule'],
                                    ['retryRule', 'Retry Rule'],
                                    ['transferMetricDefinition', 'Transfer Metric Definition'],
                                    ['transferMetricReporting', 'Transfer Metric Reporting'],
                                    ['validationStage', 'Validation Stage'],
                                    ['nextValidationMilestone', 'Next Validation Milestone'],
                                ] as Array<[keyof SimVariantLockedSpec, string]>).map(([field, label]) => (
                                    <div key={field}>
                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{label}</label>
                                        {field === 'validationStage' || field === 'nextValidationMilestone' ? (
                                            <input
                                                value={activeLockedSpec[field]}
                                                onChange={(event) => updateLockedSpec(field, event.target.value)}
                                                className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                            />
                                        ) : (
                                            <textarea
                                                value={activeLockedSpec[field]}
                                                onChange={(event) => updateLockedSpec(field, event.target.value)}
                                                className="w-full min-h-[84px] rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500 resize-y"
                                            />
                                        )}
                                    </div>
                                ))}
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
                                    onChange={(event) => {
                                        setRawSpec(event.target.value);
                                        setAuditReport(null);
                                    }}
                                    placeholder="Paste or author the full variant spec here..."
                                    className="w-full min-h-[420px] rounded-xl bg-black/40 border border-zinc-700 text-xs text-zinc-300 placeholder-zinc-600 p-4 focus:outline-none focus:border-zinc-500 transition-colors resize-y font-mono leading-relaxed"
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Formatted Preview</p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => rawSpec.trim() && handleRunAudit()}
                                            disabled={!rawSpec.trim()}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/15 transition-colors disabled:opacity-40"
                                        >
                                            <ListChecks className="w-3.5 h-3.5" />
                                            Audit + Fix
                                        </button>
                                        <button
                                            onClick={() => rawSpec.trim() && setParsed(parseVariantSpec(rawSpec))}
                                            disabled={!rawSpec.trim()}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:bg-purple-500/15 transition-colors disabled:opacity-40"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            Refresh Preview
                                        </button>
                                    </div>
                                </div>
                                {auditReport && (
                                    <div className={`rounded-xl border p-4 space-y-3 ${
                                        auditReport.status === 'pass'
                                            ? 'border-emerald-500/20 bg-emerald-500/5'
                                            : auditReport.status === 'pass_with_warnings'
                                                ? 'border-amber-500/20 bg-amber-500/5'
                                                : 'border-red-500/20 bg-red-500/5'
                                    }`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-bold text-white">Spec Audit</p>
                                                <p className="text-[10px] text-zinc-400">
                                                    Status: {auditReport.status === 'pass' ? 'Pass' : auditReport.status === 'pass_with_warnings' ? 'Pass with Warnings' : 'Needs Input'} · Score {auditReport.score}/100
                                                </p>
                                                {warningFindingCount > 0 && (
                                                    <p className="text-[10px] text-zinc-500 mt-1">
                                                        {warningFindingCount} warning finding{warningFindingCount === 1 ? '' : 's'}
                                                        {warningFixStepCount > 0 ? ` · ${warningFixStepCount} fixable step${warningFixStepCount === 1 ? '' : 's'} remaining` : ' · no supported auto-fix steps'}
                                                        {nextWarningFixAction ? ` · next fix: ${nextWarningFixAction.label}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                                                auditReport.status === 'pass'
                                                    ? 'bg-emerald-500/10 text-emerald-300'
                                                    : auditReport.status === 'pass_with_warnings'
                                                        ? 'bg-amber-500/10 text-amber-300'
                                                        : 'bg-red-500/10 text-red-300'
                                            }`}>
                                                {auditReport.status.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        {warningFixFeedback && (
                                            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                                                <p className="text-[11px] text-blue-200">
                                                    Applied <span className="font-semibold">{warningFixFeedback.label}</span>. Warnings: {warningFixFeedback.previousWarningCount} → {warningFixFeedback.currentWarningCount}
                                                    {warningFixFeedback.currentWarningCount > 0
                                                        ? ` · ${warningFixStepCount} fixable step${warningFixStepCount === 1 ? '' : 's'} remaining`
                                                        : ''}
                                                    {warningFixFeedback.currentWarningCount > 0 && nextWarningFixAction
                                                        ? ` · Next: ${nextWarningFixAction.label}`
                                                        : ''}
                                                </p>
                                            </div>
                                        )}
                                        {nextWarningFixAction && (
                                            <div className="flex items-center justify-end">
                                                <button
                                                    onClick={handleFixAuditWarnings}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/15 transition-colors"
                                                >
                                                    <Wrench className="w-3.5 h-3.5" />
                                                    {nextWarningFixAction.label} ({warningFindingCount})
                                                </button>
                                            </div>
                                        )}
                                        {auditReport.autoFixes.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Auto Fixes</p>
                                                <div className="space-y-1">
                                                    {auditReport.autoFixes.map((fix) => (
                                                        <p key={fix} className="text-[11px] text-zinc-300">- {fix}</p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {auditReport.findings.length === 0 ? (
                                            <p className="text-[11px] text-zinc-300">No audit findings. This draft passed the current registry rule set.</p>
                                        ) : null}
                                        {warningFixGroups.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Warning Groups</p>
                                                <div className="space-y-2">
                                                    {warningFixGroups.map((group, index) => {
                                                        const isNext = nextWarningFixAction?.key === group.key;
                                                        return (
                                                            <div
                                                                key={`${group.key}-${index}`}
                                                                className={`rounded-lg border px-3 py-2 ${
                                                                    group.fixable
                                                                        ? isNext
                                                                            ? 'border-amber-500/30 bg-amber-500/10'
                                                                            : 'border-zinc-800 bg-black/20'
                                                                        : 'border-zinc-800 bg-black/20'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${
                                                                        group.fixable
                                                                            ? isNext
                                                                                ? 'text-amber-300'
                                                                                : 'text-zinc-300'
                                                                            : 'text-zinc-400'
                                                                    }`}>
                                                                        {group.label}
                                                                    </p>
                                                                    <span className="text-[10px] text-zinc-500">
                                                                        {group.findings.length} finding{group.findings.length === 1 ? '' : 's'}
                                                                        {group.fixable && isNext ? ' · next step' : group.fixable ? ' · fixable' : ' · manual'}
                                                                    </span>
                                                                </div>
                                                                <div className="mt-2 space-y-1">
                                                                    {group.findings.map((finding, findingIndex) => (
                                                                        <p key={`${group.key}-${finding.code}-${findingIndex}`} className="text-[11px] text-zinc-300">
                                                                            - {finding.message}
                                                                        </p>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {auditReport.findings.length > 0 && (
                                            <div>
                                                <div className="flex items-center justify-between gap-3 mb-1.5">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Detailed Findings</p>
                                                    <button
                                                        onClick={() => setShowDetailedFindings((current) => !current)}
                                                        className="text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                                                    >
                                                        {showDetailedFindings ? 'Hide' : 'Show'}
                                                    </button>
                                                </div>
                                                {showDetailedFindings && (
                                                    <div className="space-y-1.5">
                                                        {auditReport.findings.map((finding, index) => (
                                                            <div key={`${finding.code}-${index}`} className="rounded-lg border border-zinc-800 bg-black/20 px-3 py-2">
                                                                <p className={`text-[10px] font-bold uppercase tracking-widest ${finding.severity === 'error' ? 'text-red-300' : 'text-amber-300'}`}>
                                                                    {finding.severity}
                                                                </p>
                                                                <p className="text-[11px] text-zinc-300 mt-1">{finding.message}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
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
                                    Publish now compiles a playable build artifact first, then writes the derived `sim-module`. The registry stays canonical; the module is runtime output.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Build Status</p>
                                    <p className="text-sm font-semibold mt-2" style={{ color: buildStatusConf.color }}>{buildStatusConf.label}</p>
                                    <p className="text-[11px] text-zinc-500 mt-1">{variantMeta.engineKey ?? 'engine pending'}</p>
                                </div>
                                <div className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Sync Status</p>
                                    <p className="text-sm font-semibold mt-2" style={{ color: syncStatusConf.color }}>{syncStatusConf.label}</p>
                                    <p className="text-[11px] text-zinc-500 mt-1">{variantMeta.publishedModuleId ? 'Compared to published module' : 'No published module yet'}</p>
                                </div>
                                <div className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Last Built</p>
                                    <p className="text-sm font-semibold mt-2 text-white">
                                        {variantMeta.buildMeta?.builtAt ? new Date(variantMeta.buildMeta.builtAt).toLocaleString() : 'Not built yet'}
                                    </p>
                                    <p className="text-[11px] text-zinc-500 mt-1">{variantMeta.buildMeta?.engineVersion ?? 'registry-runtime/v1'}</p>
                                </div>
                                <div className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Last Published</p>
                                    <p className="text-sm font-semibold mt-2 text-white">
                                        {variantMeta.publishedAt ? new Date(variantMeta.publishedAt).toLocaleString() : 'Not published yet'}
                                    </p>
                                    <p className="text-[11px] text-zinc-500 mt-1">{variantMeta.publishedModuleId ?? 'No live module'}</p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-4 space-y-3">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Source Diff</p>
                                        <p className="text-sm text-white mt-1">
                                            {syncSummary.hasPublishedSnapshot
                                                ? 'This compares the current spec/runtime/module draft against the last published snapshot.'
                                                : 'No published snapshot yet. First publish will establish the live baseline.'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                            onClick={handlePreviewBuild}
                                            disabled={!!configError}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/15 disabled:opacity-40 transition-colors"
                                        >
                                            <Gamepad2 className="w-3.5 h-3.5" />
                                            {variantMeta.buildArtifact ? 'Preview Built Module' : 'Build + Preview'}
                                        </button>
                                        {variantMeta.publishedModuleId && (
                                            <button
                                                onClick={handlePreviewPublishedModule}
                                                disabled={loadingPublishedPreview}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-40 transition-colors"
                                            >
                                                <Play className="w-3.5 h-3.5" />
                                                {loadingPublishedPreview ? 'Loading Live Module...' : 'Play Published Module'}
                                            </button>
                                        )}
                                        <button
                                            onClick={handleBuild}
                                            disabled={building || !!configError}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/15 disabled:opacity-40 transition-colors"
                                        >
                                            <FileCode2 className="w-3.5 h-3.5" />
                                            {building
                                                ? 'Building...'
                                                : variantMeta.publishedModuleId && syncSummary.hasPublishedSnapshot
                                                    ? 'Save + Rebuild Module'
                                                    : 'Build Module'}
                                        </button>
                                        <button
                                            onClick={handlePublish}
                                            disabled={publishing || !!configError}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#E0FE10] text-black hover:bg-[#c8e40e] disabled:opacity-40 transition-colors"
                                        >
                                            <Upload className="w-3.5 h-3.5" />
                                            {publishing
                                                ? 'Publishing...'
                                                : variantMeta.publishedModuleId && syncSummary.hasPublishedSnapshot
                                                    ? 'Save + Rebuild + Publish'
                                                    : 'Publish Built Module'}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {[
                                        { label: 'Spec Changed', active: syncSummary.specChanged },
                                        { label: 'Runtime Changed', active: syncSummary.runtimeChanged },
                                        { label: 'Module Metadata Changed', active: syncSummary.moduleChanged },
                                    ].map((item) => (
                                        <div
                                            key={item.label}
                                            className={`rounded-lg border px-3 py-2 ${item.active ? 'border-amber-500/30 bg-amber-500/10' : 'border-zinc-800 bg-zinc-950/60'}`}
                                        >
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{item.label}</p>
                                            <p className={`text-xs mt-1 font-semibold ${item.active ? 'text-amber-300' : 'text-zinc-400'}`}>
                                                {item.active ? 'Changed since publish' : 'No diff'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                {variantMeta.publishedModuleId && effectiveSyncStatus !== 'in_sync' && (
                                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                                        <p className="text-xs text-amber-200 leading-relaxed">
                                            Save Draft Only keeps the current live module as-is and marks this variant out of sync until you rebuild or republish.
                                        </p>
                                    </div>
                                )}
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
                            {saving ? 'Saving...' : variantMeta.publishedModuleId && effectiveSyncStatus !== 'in_sync' ? 'Save Draft Only' : 'Save Draft'}
                        </button>
                        <button
                            onClick={handleBuild}
                            disabled={building || !!configError}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/15 disabled:opacity-40 transition-colors"
                        >
                            <FileCode2 className="w-3.5 h-3.5" />
                            {building ? 'Building...' : variantMeta.publishedModuleId ? 'Save + Rebuild Module' : 'Build Module'}
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={publishing || !!configError}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#E0FE10] text-black hover:bg-[#c8e40e] disabled:opacity-40 transition-colors"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            {publishing ? 'Publishing...' : variantMeta.publishedModuleId ? 'Save + Rebuild + Publish' : 'Publish Built Module'}
                        </button>
                    </div>
                </div>
            </motion.div>

            <AnimatePresence>
                {previewModule && (
                    <ExercisePlayer
                        exercise={previewModule}
                        previewMode
                        onClose={() => setPreviewModule(null)}
                        onComplete={() => setPreviewModule(null)}
                    />
                )}
            </AnimatePresence>
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
    onOpenWorkspace: (variant: SimVariantRecord, options?: { initialTab?: 'general' | 'locks' | 'spec' | 'config' | 'publish' | 'history'; initialSpecRaw?: string }) => void;
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
                            <div className="grid grid-cols-[1fr_120px_130px_96px_110px_112px] gap-2 px-5 py-2 bg-black/30 text-[9px] uppercase tracking-widest text-zinc-600 font-bold">
                                <span>Variant</span>
                                <span>Mode</span>
                                <span>Spec Status</span>
                                <span>Priority</span>
                                <span>Build</span>
                                <span />
                            </div>
                            {/* Rows */}
                            {variants.map((v) => {
                                const modeConf = MODE_CONFIG[v.mode];
                                const ModeIcon = modeConf.icon;
                                const specConf = SPEC_STATUS_CONFIG[v.specStatus];
                                const SpecIcon = specConf.icon;
                                const priConf = PRIORITY_CONFIG[v.priority];
                                const buildConf = BUILD_STATUS_CONFIG[v.buildStatus ?? 'not_built'];
                                return (
                                    <div
                                        key={v.name}
                                        className="grid grid-cols-[1fr_120px_130px_96px_110px_112px] gap-2 px-5 py-2 border-t border-zinc-800/50 hover:bg-white/[0.02] transition-colors items-center"
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
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: buildConf.color }} />
                                            <span className="text-[10px] font-semibold" style={{ color: buildConf.color }}>{buildConf.label}</span>
                                        </span>
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
    const [buildingVariantId, setBuildingVariantId] = useState<string | null>(null);
    const [publishingVariantId, setPublishingVariantId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterFamilyStatus, setFilterFamilyStatus] = useState<'all' | FamilyStatus>('all');
    const [filterMode, setFilterMode] = useState<'all' | VariantMode>('all');
    const [filterSpecStatus, setFilterSpecStatus] = useState<'all' | SpecStatus>('all');
    const [workspaceModalState, setWorkspaceModalState] = useState<{
        variantId: string;
        initialTab?: 'general' | 'locks' | 'spec' | 'config' | 'publish' | 'history';
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
                .map((record) => applyDraftSyncState(record))
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
            const draftRecord = applyDraftSyncState(next);
            await simVariantRegistryService.save(draftRecord);
            setRegistryVariants((current) => current.map((variant) => variant.id === next.id ? draftRecord : variant));
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

    const handleBuildWorkspace = async (next: SimVariantRecord) => {
        setBuildingVariantId(next.id);
        try {
            const builtRecord = buildVariantRecordForBuild(next);
            await simVariantRegistryService.save(builtRecord);
            setRegistryVariants((current) => current.map((variant) => variant.id === next.id ? builtRecord : variant));
            setToast({
                type: 'success',
                message: `${next.name} built into a playable runtime artifact.`,
            });
        } catch (error) {
            console.error('Failed to build variant workspace:', error);
            setToast({
                type: 'error',
                message: `Failed to build ${next.name}.`,
            });
        } finally {
            setBuildingVariantId(null);
        }
    };

    const handlePublishWorkspace = async (next: SimVariantRecord) => {
        setPublishingVariantId(next.id);
        try {
            const builtRecord = buildVariantRecordForBuild(next);
            const module = buildPublishedModule(builtRecord);
            const moduleId = await simVariantRegistryService.publish(builtRecord, module);
            const publishedRecord = buildPublishedVariantRecord({
                ...builtRecord,
                publishedModuleId: moduleId,
            });
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
                        building={buildingVariantId === selectedVariant.id}
                        publishing={publishingVariantId === selectedVariant.id}
                        onSave={handleSaveWorkspace}
                        onBuild={handleBuildWorkspace}
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
