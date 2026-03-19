import React, { useCallback, useEffect, useState, useMemo } from 'react';
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
    getDisplayFamilyName,
    getDisplaySimText,
    getDisplayVariantName,
    simModuleLibraryService,
    simVariantRegistryService,
    type MentalExercise,
    type SimBuildStatus,
    type SimSyncStatus,
} from '../../../api/firebase/mentaltraining';
import {
    type SimVariantArchetype,
    buildDefaultVisionRuntimePlan,
    buildVisionRuntimePackageManifest,
    buildSimVariantId,
    resolveDefaultVisionPackageId,
    type SimVariantHistoryEntry,
    type SimVariantSpecVersionEntry,
    type SimVariantFamilyStatus,
    type SimVariantLockedSpec,
    type SimVariantMode,
    type SimVariantModuleDraft,
    type SimVariantRecord,
    type SimVariantSeed,
    type SimVariantSpecStatus,
    type SimVariantVisionStatus,
    type VisionRuntimePackageRecord,
    type VisionRuntimeNoiseGateBlockManifest,
    type VisionRuntimeResetBlockManifest,
    type VisionRuntimeSignalBlockManifest,
    type VisionRuntimeTrialPlanManifest,
} from '../../../api/firebase/mentaltraining/variantRegistryService';
import {
    applyDraftSyncState,
    buildPublishedModuleFromVariant,
    buildPublishedVariantRecord,
    buildVariantRecordForBuild,
    stableStringify,
    summarizeVariantSyncDiff,
} from '../../../api/firebase/mentaltraining/simBuild';
import { resolveVariantAudioAssets } from '../../../api/firebase/mentaltraining/audioAssetService';
import { ExercisePlayer } from '../../mentaltraining';

/* ---- TYPES ---- */
type SpecStatus = SimVariantSpecStatus;
type FamilyStatus = SimVariantFamilyStatus;
type VariantMode = SimVariantMode;
type VariantEntry = SimVariantSeed & Partial<Pick<SimVariantRecord, 'lockedSpec' | 'archetypeOverride' | 'publishedModuleId' | 'buildStatus'>>;

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

interface SpecAuditAiReview {
    model: string;
    summary: string;
    findings: SpecAuditFinding[];
    applied: boolean;
    unavailableReason?: string;
}

interface SpecAuditReport {
    status: 'pass' | 'pass_with_warnings' | 'needs_input';
    score: number;
    findings: SpecAuditFinding[];
    autoFixes: string[];
    fixedRaw: string;
    aiReview?: SpecAuditAiReview | null;
}

interface WarningFixAction {
    key: 'protocol_wording' | 'sport_wording' | 'normalize_terms' | 'tighten_wording' | 'consolidate_build_notes' | 'upgrade_family_sections';
    label: string;
    codes: string[];
}

interface WarningFixFeedback {
    label: string;
    previousWarningCount: number;
    currentWarningCount: number;
    remainingFixableSteps: number;
    nextLabel: string | null;
    noEffectiveChange?: boolean;
}

interface WarningFixGroup {
    key: string;
    label: string;
    findings: SpecAuditFinding[];
    state: 'next' | 'fixable' | 'manual' | 'exhausted';
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

interface VariantSpecAiAuditResult {
    success: boolean;
    model: string;
    summary: string;
    findings: SpecAuditFinding[];
    suggestedSpecRaw: string;
}

interface VariantSpecAiGenerationResult {
    success: boolean;
    model: string;
    summary: string;
    generatedSpecRaw: string;
}

const AI_SPEC_GENERATION_TIMEOUT_MS = 120_000;
const AI_SPEC_AUDIT_TIMEOUT_MS = 45_000;

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

const VISION_STATUS_CONFIG: Record<SimVariantVisionStatus, { label: string; color: string }> = {
    spec_only: { label: 'Spec Only', color: '#71717a' },
    runtime_mapped: { label: 'Runtime Mapped', color: '#38bdf8' },
    in_package: { label: 'In Package', color: '#a855f7' },
    validated: { label: 'Validated', color: '#22c55e' },
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
    'Reset': '#ef4444',
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

function displayFamilyName(family: string) {
    return getDisplayFamilyName(family);
}

function displayVariantName(name: string) {
    return getDisplayVariantName(name);
}

function displayCopy(text: string) {
    return getDisplaySimText(text);
}

const EMPTY_VISION_RUNTIME_PLAN: VisionRuntimeTrialPlanManifest = {
    controlledBreakSeconds: 60,
    totalSessionCapSeconds: 20 * 60,
    resetBlocks: [],
    signalWindowBlocks: [],
    noiseGateBlocks: [],
};

function buildEditableVisionRuntimePlan(variant: SimVariantRecord, packageId: string | null) {
    if (variant.visionRuntimePlan) return variant.visionRuntimePlan;
    if (packageId) {
        const defaultPlan = buildDefaultVisionRuntimePlan(packageId);
        if (defaultPlan) return defaultPlan;
    }
    return EMPTY_VISION_RUNTIME_PLAN;
}

function buildDefaultResetBlock(): VisionRuntimeResetBlockManifest {
    return {
        pressureTags: [],
        disruptionLabel: 'New reset pressure block',
        lockInSeconds: 4.5,
        disruptionSeconds: 1.3,
        responseWindowSeconds: 3.0,
        interBlockGapSeconds: 2.0,
    };
}

function buildDefaultSignalBlock(): VisionRuntimeSignalBlockManifest {
    return {
        correctChoice: 'left',
        decoyChoice: 'right',
        pressureTags: [],
        cueWindowSeconds: 1.2,
        readySeconds: 2.0,
        responseWindowSeconds: 2.0,
        interBlockGapSeconds: 2.0,
    };
}

function buildDefaultNoiseGateBlock(): VisionRuntimeNoiseGateBlockManifest {
    return {
        targetChoice: 'center',
        distractorChoice: 'right',
        noiseLabel: 'Crowd tunnel surge',
        noiseIntensity: 0.7,
        pressureTags: [],
        readySeconds: 2.0,
        exposureSeconds: 1.4,
        responseWindowSeconds: 2.2,
        interBlockGapSeconds: 2.0,
    };
}

function parseCommaTags(raw: string) {
    return raw.split(',').map((tag) => tag.trim()).filter(Boolean);
}

const FAMILY_SPEC_BASES: Record<string, FamilySpecBase> = {
    'Reset': {
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
            'Reset Sim Spec v3',
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
        boundaryRule: 'the sim must stay focused on post-error stabilization rather than becoming a full Reset or Heat Check duplicate',
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
    // ── RESET (LOCKED) ── Branch Variants
    { name: 'Visual Disruption Reset', family: 'Reset', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Audio Disruption Reset', family: 'Reset', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Cognitive-Provocation Reset', family: 'Reset', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Combined-Channel Reset', family: 'Reset', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Short Daily Reset', family: 'Reset', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Extended Trial Reset', family: 'Reset', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Sport-Context Reset', family: 'Reset', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    { name: 'Immersive Reset Chamber', family: 'Reset', familyStatus: 'locked', mode: 'branch', specStatus: 'needs-spec', priority: 'high' },
    // ── RESET ── Library Variants
    { name: 'Aftershock', family: 'Reset', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Reset Window', family: 'Reset', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Restart', family: 'Reset', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Second Chance', family: 'Reset', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Recovery Chain', family: 'Reset', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },
    { name: 'Reset Chamber', family: 'Reset', familyStatus: 'locked', mode: 'library', specStatus: 'needs-spec', priority: 'medium' },

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
    { name: 'Overload', family: 'Reset', familyStatus: 'locked', mode: 'hybrid', specStatus: 'not-required', priority: 'low' },
    { name: 'Recovery Chain', family: 'Reset', familyStatus: 'locked', mode: 'hybrid', specStatus: 'not-required', priority: 'low' },
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

function replaceSectionContent(raw: string, sectionKeyword: string, content: string) {
    const parsed = parseVariantSpec(raw);
    const nextSections = parsed.rawSections.map((entry) => {
        if (!entry.heading.toLowerCase().includes(sectionKeyword.toLowerCase())) {
            return entry;
        }
        return {
            ...entry,
            content: content.trim(),
        };
    });

    return nextSections
        .map((entry) => {
            const body = entry.content?.trim();
            return body ? `${entry.heading}\n${body}` : entry.heading;
        })
        .join('\n\n');
}

function normalizeSectionHeadingTitle(heading: string) {
    return heading
        .replace(/^§?\d{1,2}[.):\-]\s*/, '')
        .toLowerCase()
        .replace(/[`*_]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function rebuildSpecWithCanonicalSections(variant: VariantEntry, raw: string) {
    const referenceSpec = buildGeneratedVariantSpec(variant);
    const referenceParsed = parseVariantSpec(referenceSpec);
    const currentParsed = parseVariantSpec(raw);
    const expectedHeadings = buildExpectedSectionLabels(variant);

    const referenceByTitle = new Map(
        referenceParsed.rawSections.map((section) => [normalizeSectionHeadingTitle(section.heading), section])
    );
    const currentByTitle = new Map(
        currentParsed.rawSections.map((section) => [normalizeSectionHeadingTitle(section.heading), section])
    );

    const rebuilt = expectedHeadings.map((heading) => {
        const normalizedTitle = normalizeSectionHeadingTitle(heading);
        const sourceSection = currentByTitle.get(normalizedTitle) ?? referenceByTitle.get(normalizedTitle);
        const content = sourceSection?.content?.trim() ?? '';
        return content ? `${heading}\n${content}` : heading;
    });

    return normalizeSpecText(rebuilt.join('\n\n'));
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
            'audio',
            'sound',
            'visual',
            'screen',
            'sport',
            'scenario',
            'delivery',
            'context',
        ]).has(token));
}

const BUILD_NOTE_OVERLAP_SIGNAL_TOKENS = new Set([
    'route',
    'device',
    'class',
    'type',
    'subtype',
    'trigger',
    'timing',
    'window',
    'schedule',
    'seed',
    'profile',
    'modifier',
    'overlap',
    'baseline',
    'block',
    'onset',
    'probe',
    'phase',
    'ambiguity',
    'density',
    'contrast',
    'load',
    'classification',
    'latency',
    'artifact',
    'false',
    'start',
    'intrusion',
    'shift',
    'cue',
]);

function runPolishAudit(variant: VariantEntry, parsed: ParsedSpec, findings: SpecAuditFinding[]) {
    const buildBullets = extractSectionBullets(parsed, 'build');
    const measurementBullets = extractSectionBullets(parsed, 'measurement');
    const tagLikeBullets = buildBullets.filter((bullet) => /\b(tag|tags|marker|markers|field|fields)\b/i.test(bullet));
    const cleanedBuildBullets = cleanupGeneratedBuildNotes(variant, buildBullets);
    const buildNotesCanBeConsolidated = stableStringify(cleanedBuildBullets) !== stableStringify(buildBullets);
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

    if (buildNotesCanBeConsolidated) {
        for (let i = 0; i < tagLikeBullets.length; i += 1) {
            for (let j = i + 1; j < tagLikeBullets.length; j += 1) {
                const left = normalizeOverlapTokens(tagLikeBullets[i]);
                const right = normalizeOverlapTokens(tagLikeBullets[j]);
                const overlap = left.filter((token) => right.includes(token));
                const signalOverlap = overlap.filter((token) => (
                    BUILD_NOTE_OVERLAP_SIGNAL_TOKENS.has(token)
                    || token.includes('_')
                ));

                if (signalOverlap.length >= 2) {
                    pushFinding(
                        'overlapping_build_notes',
                        `Build notes may contain overlapping tagging concepts (${signalOverlap.join(', ')}). Consider consolidating closely related storage bullets.`
                    );
                    return;
                }
            }
        }
    }

    const finalPhaseBullets = buildBullets.filter((bullet) => /finish-phase|finish phase|late-probe|late probe/i.test(bullet));
    if (finalPhaseBullets.length > 1 && buildNotesCanBeConsolidated) {
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
        if (storeCount >= 3 && exportCount >= 1 && buildNotesCanBeConsolidated) {
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
        '6. Variant Modifier Matrix',
        '7. Measurement and Scoring Notes',
        '8. Mode Behavior',
        '9. Canonical Analytics Tag Vocabulary',
        '10. Build and Implementation Notes',
        '11. Governing Documents',
        '12. Boundary Safeguards',
        '13. Variant Readiness Checklist',
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
        [
            'default feedback mode is',
            'default feedback mode:',
            'adaptive difficulty is',
            'adaptive difficulty:',
        ]
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

    if (variant.family === 'Reset') {
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'reset_missing_valid_reengagement',
            'Reset specs should explicitly define valid re-engagement as two consecutive correct responses.',
            ['two consecutive correct responses', 'confirmed re-engagement']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'reset_missing_false_start_logic',
            'Reset specs should explicitly define false starts as responses during the disruption phase.',
            ['false start', 'responses during the disruption phase', 'response during disruption']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'reset_missing_attentional_shift_sourcing',
            'Reset specs should explicitly describe Attentional Shifting as multi-source.',
            ['attentional shifting', 'multi-source', 'first-post-reset accuracy']
        );
        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'reset_missing_pressure_stability_sourcing',
            'Reset specs should explicitly describe Pressure Stability as modifier-stratified.',
            ['pressure stability', 'modifier-stratified', 'modifier condition']
        );

        if (archetype === 'sport_context') {
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'reset_sport_context_missing_context_tags',
                'Sport-context Reset variants should store sport/scenario/reset-moment tags so transfer claims are inspectable.',
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
        if (archetype === 'fatigue_load') {
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'endurance_missing_fixed_block_schema',
                'Endurance Lock fatigue-load variants should define a fixed or formulaic block structure for baseline, middle, and finish segmentation.',
                ['6 fixed pacing blocks', 'blocks 1-2', 'blocks 3-4', 'blocks 5-6', 'six-block']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'endurance_missing_schema_grade_vocab',
                'Endurance Lock fatigue-load variants should define schema-grade analytics fields and enums for block identity, device class, delivery surface, and modifier profile.',
                ['modifier_profile_id', 'block_identity', 'device_class', 'delivery_surface']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'endurance_missing_training_adaptation_guardrails',
                'Endurance Lock fatigue-load variants should explicitly constrain what Training Mode adaptation may change so the family mechanic does not drift.',
                ['training-mode adaptation may', 'may change pacing', 'may not change the task identity', 'may not change the block schema']
            );
        }

        if (archetype === 'visual_channel') {
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'endurance_visual_missing_fixed_block_schema',
                'Endurance Lock visual-channel variants should define a fixed or formulaic block structure for baseline, middle, and finish segmentation.',
                ['blocks 1-2', 'blocks 3-4', 'blocks 5-6', 'six-block', 'clean-reference baseline']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'endurance_visual_missing_modifier_profiles',
                'Endurance Lock visual-channel variants should define named visual modifier profiles, co-occurrence tiers, and display-state constraints.',
                ['visual_profile_id', 'visual_density', 'peripheral_bait', 'contrast_drift']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'endurance_visual_missing_profile_schedule',
                'Endurance Lock visual-channel variants should define a fixed per-block display-state recipe for each approved visual profile.',
                ['clutter_ramp_v1', 'peripheral_bait_v1', 'contrast_decay_v1', 'fixed recipe', 'blocks 1-2', 'blocks 3-4', 'blocks 5-6']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'endurance_visual_missing_schema_grade_vocab',
                'Endurance Lock visual-channel variants should define schema-grade analytics fields and enums for block identity, visual state, device class, and delivery surface.',
                ['block_identity', 'visual_density_tier', 'peripheral_load_tier', 'contrast_profile', 'device_class', 'delivery_surface']
            );
            pushArchetypeRequirementFinding(
                findings,
                lowerRaw,
                'endurance_visual_missing_training_adaptation_guardrails',
                'Endurance Lock visual-channel variants should explicitly constrain what Training Mode adaptation may change so the family mechanic does not drift.',
                ['training-mode adaptation may', 'density step size', 'may not change the task identity', 'may not change the block schema']
            );
        }

        pushArchetypeRequirementFinding(
            findings,
            lowerRaw,
            'endurance_missing_baseline_period',
            'Endurance Lock specs should explicitly define the baseline period before degradation is measured.',
            ['first 2-3 minutes', 'first 2–3 minutes', 'baseline period', '100% baseline', 'baseline performance = mean accuracy across blocks 1-2', 'block 1-2 baseline', 'blocks 1-2 baseline', 'baseline (blocks 1-2)', 'blocks 1-2']
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
            const normalizedPhrase = phrase.trim().toLowerCase();
            const matchesDurationPhrase = (() => {
                const durationMatch = normalizedPhrase.match(/^(\d+)\s+minutes?$/);
                if (!durationMatch) {
                    return false;
                }

                const amount = durationMatch[1];
                return lowerRaw.includes(`${amount} minutes`)
                    || lowerRaw.includes(`${amount} minute`)
                    || lowerRaw.includes(`${amount}-minute`)
                    || lowerRaw.includes(`${amount}‑minute`);
            })();

            if (!lowerRaw.includes(normalizedPhrase) && !matchesDurationPhrase) {
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

    runPolishAudit(variant, parsed, findings);

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
        aiReview: null,
    };
}

function dedupeAuditFindings(findings: SpecAuditFinding[]) {
    const seen = new Set<string>();
    return findings.filter((finding) => {
        const key = `${finding.severity}:${finding.code}:${finding.message}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function mergeAuditReportWithAiReview(base: SpecAuditReport, aiReview: SpecAuditAiReview | null): SpecAuditReport {
    if (!aiReview) {
        return {
            ...base,
            aiReview: null,
        };
    }

    const findings = dedupeAuditFindings([...base.findings, ...aiReview.findings]);
    const errorCount = findings.filter((finding) => finding.severity === 'error').length;
    const warningCount = findings.filter((finding) => finding.severity === 'warning').length;
    const autoFixPenalty = base.autoFixes.length > 0 ? Math.min(6, base.autoFixes.length * 3) : 0;
    const score = Math.max(0, 100 - (errorCount * 20) - (warningCount * 8) - autoFixPenalty);
    const status: SpecAuditReport['status'] = errorCount > 0
        ? 'needs_input'
        : warningCount > 0 || base.autoFixes.length > 0
            ? 'pass_with_warnings'
            : 'pass';

    return {
        ...base,
        status,
        score,
        findings,
        aiReview,
    };
}

function normalizeAiReviewSummaryForFinalAudit(
    aiReview: SpecAuditAiReview | null,
    audit: SpecAuditReport,
    variant: VariantEntry
): SpecAuditAiReview | null {
    if (!aiReview) return null;
    if (aiReview.unavailableReason) return aiReview;

    const warningCount = audit.findings.filter((finding) => finding.severity === 'warning').length;
    const errorCount = audit.findings.filter((finding) => finding.severity === 'error').length;

    if (errorCount === 0 && warningCount === 0 && audit.status === 'pass') {
        const maturity = getAuditPromotedSpecReleaseMetadata(variant, audit);
        const summary = aiReview.applied
            ? `Gold-standard review completed. The draft now aligns with the ${variant.family} publishing standard, all supported fixes have been applied, and the spec currently passes the registry audit as ${maturity.status}.`
            : `Gold-standard review completed. The draft aligns with the ${variant.family} publishing standard and currently passes the registry audit as ${maturity.status}.`;

        return {
            ...aiReview,
            summary,
        };
    }

    return aiReview;
}

function mapPriority(priority: VariantEntry['priority']) {
    if (priority === 'high') return 'P0';
    if (priority === 'medium') return 'P1';
    return 'P2';
}

function mapVariantStatus(variant: VariantEntry) {
    if (variant.publishedModuleId || variant.buildStatus === 'published') return 'Published Registry Spec';
    if (variant.specStatus === 'complete') return 'Build-Ready';
    if (variant.specStatus === 'in-progress') return 'In Progress';
    if (variant.mode === 'hybrid' || variant.specStatus === 'not-required') return 'Not Required';
    if (variant.familyStatus === 'candidate') return 'Exploratory Candidate Draft';
    return 'Draft Auto-Generated';
}

function formatGeneratedSpecDate() {
    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date());
}

function getGeneratedSpecReleaseMetadata(variant: VariantEntry) {
    const isPublished = Boolean(variant.publishedModuleId) || variant.buildStatus === 'published' || Boolean((variant as Partial<SimVariantRecord>).publishedAt);
    const isBuildReady = variant.specStatus === 'complete' || variant.buildStatus === 'built' || variant.buildStatus === 'out_of_sync' || Boolean((variant as Partial<SimVariantRecord>).buildArtifact);
    const isReviewedDraft = variant.specStatus === 'in-progress' || Boolean((variant as Partial<SimVariantRecord>).specRaw?.trim());

    if (isPublished) {
        return {
            status: 'Published Registry Spec',
            version: 'v1.0',
        };
    }

    if (isBuildReady) {
        return {
            status: 'Build-Ready Registry Spec',
            version: 'v0.9',
        };
    }

    if (isReviewedDraft) {
        return {
            status: 'Reviewed Registry Draft',
            version: 'v0.7',
        };
    }

    if (variant.familyStatus === 'candidate') {
        return {
            status: 'Exploratory Candidate Draft',
            version: 'v0.3',
        };
    }

    return {
        status: 'Draft Auto-Generated',
        version: 'v0.1',
    };
}

function getAuditPromotedSpecReleaseMetadata(variant: VariantEntry, audit: SpecAuditReport) {
    const current = getGeneratedSpecReleaseMetadata(variant);

    if (current.status === 'Published Registry Spec' || current.status === 'Build-Ready Registry Spec') {
        return current;
    }

    if (audit.status === 'pass' && audit.score >= 95) {
        return {
            status: 'Reviewed Registry Draft',
            version: 'v0.7',
        };
    }

    return current;
}

function promoteSpecReleaseMetadata(raw: string, variant: VariantEntry, audit: SpecAuditReport) {
    const parsed = parseVariantSpec(raw);
    const coreSection = extractSectionByKeyword(parsed, 'core identity');
    if (!coreSection) return raw;

    const release = getAuditPromotedSpecReleaseMetadata(variant, audit);
    const nextLines = coreSection.content.split('\n').map((line) => {
        if (/^Status:/i.test(line.trim())) {
            return `Status: ${release.status}`;
        }
        if (/^Version:/i.test(line.trim())) {
            return `Version: ${release.version}`;
        }
        return line;
    });

    return replaceSectionContent(raw, 'core identity', nextLines.join('\n'));
}

function syncReadinessChecklist(raw: string, variant: VariantEntry) {
    const parsed = parseVariantSpec(raw);
    const checklistSection = extractSectionByKeyword(parsed, 'variant readiness checklist');
    if (!checklistSection) return raw;

    const isPublished = Boolean(variant.publishedModuleId) || variant.buildStatus === 'published' || Boolean((variant as Partial<SimVariantRecord>).publishedAt);
    if (!isPublished) {
        return raw;
    }

    const nextContent = checklistSection.content
        .split('\n')
        .map((line) => line.replace(/^- \[ \]/, '- [x]'))
        .join('\n');

    return replaceSectionContent(raw, 'variant readiness checklist', nextContent);
}

function finalizeSpecForVariantState(
    raw: string,
    variant: VariantEntry,
    audit?: SpecAuditReport,
) {
    let nextRaw = normalizeSpecText(raw);
    let nextAudit = audit ?? runSpecAuditPipeline(variant, nextRaw);

    const promotedRaw = normalizeSpecText(promoteSpecReleaseMetadata(nextRaw, variant, nextAudit));
    if (promotedRaw !== nextRaw) {
        nextRaw = promotedRaw;
        nextAudit = runSpecAuditPipeline(variant, nextRaw);
    }

    const checklistAlignedRaw = normalizeSpecText(syncReadinessChecklist(nextRaw, variant));
    if (checklistAlignedRaw !== nextRaw) {
        nextRaw = checklistAlignedRaw;
        nextAudit = runSpecAuditPipeline(variant, nextRaw);
    }

    return {
        raw: nextRaw,
        audit: nextAudit,
    };
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

function resolveVariantArchetype(variant: Pick<SimVariantRecord, 'name' | 'archetypeOverride'>): SimVariantArchetype {
    if (variant.archetypeOverride) {
        return variant.archetypeOverride;
    }

    const name = variant.name.toLowerCase();
    if (name.includes('short daily')) return 'short_daily';
    if (name.includes('extended trial') || name.includes('trial-only') || name.includes('field-read trial')) return 'trial';
    if (name.includes('immersive') || name.includes('vision pro') || name.includes('chamber') || name.includes('tunnel')) return 'immersive';
    if (name.includes('sport') || name.includes('playbook') || name.includes('pre-shot') || name.includes('field-read') || name.includes('shot-clock')) return 'sport_context';
    if (name.includes('visual') || name.includes('clutter') || name.includes('spotlight') || name.includes('peripheral')) return 'visual_channel';
    if (name.includes('audio') || name.includes('crowd') || name.includes('whistle') || name.includes('commentary')) return 'audio_channel';
    if (name.includes('combined') || name.includes('mixed') || name.includes('multi-source') || name.includes('dual-channel') || name.includes('overload')) return 'combined_channel';
    if (name.includes('cognitive') || name.includes('provocation') || name.includes('ambiguous') || name.includes('confidence') || name.includes('late reveal')) return 'cognitive_pressure';
    if (name.includes('fatigue') || name.includes('late') || name.includes('long') || name.includes('burn') || name.includes('endurance')) return 'fatigue_load';
    if (name.includes('false') || name.includes('fakeout') || name.includes('decoy') || name.includes('bait') || name.includes('go/no-go')) return 'decoy_discrimination';
    return 'baseline';
}

function isVisionVariantEntry(variant: Pick<SimVariantRecord, 'name' | 'archetypeOverride'>) {
    const name = variant.name.toLowerCase();
    return resolveVariantArchetype(variant) === 'immersive' || name.includes('vision pro');
}

function resolveVisionPackageStatus(variant: Pick<SimVariantRecord, 'visionPackageStatus' | 'name' | 'family' | 'archetypeOverride'> & Partial<Pick<SimVariantRecord, 'specRaw'>>) {
    if (!isVisionVariantEntry(variant)) return null;
    return variant.visionPackageStatus ?? 'spec_only';
}

function resolveWorkspaceSpecStatus(variant: SimVariantRecord, rawSpec: string) {
    if (variant.mode === 'hybrid') return 'not-required' as const;
    if (!rawSpec.trim()) return 'needs-spec' as const;
    if (isVisionVariantEntry(variant)) return 'complete' as const;
    return variant.publishedModuleId ? 'complete' : 'in-progress';
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

    if (variant.family === 'Reset') {
        if (name.includes('visual disruption')) {
            return {
                purpose: 'This variant expresses Reset through screen-based visual interruptions while preserving the same disruption -> reset -> re-engagement mechanic.',
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
                purpose: 'This variant expresses Reset through crowd, whistle, buzzer, and startle-like sound disruptions while preserving the same recovery mechanic.',
                expectedBenefit: 'Train reset speed in loud sport-like environments and reveal audio-triggered recovery breakdowns.',
                bestUse: [
                    'the athlete destabilizes under crowd, whistle, or buzzer conditions',
                    'the program wants a sport-native audio-pressure version of Reset',
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
                purpose: 'This variant expresses Reset through provocative language, evaluative cues, and psychological disruption without changing the reset mechanic.',
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
                purpose: 'This variant layers visual, audio, and cognitive disruptions together while preserving the same Reset reset target.',
                expectedBenefit: 'Bridge single-channel reset work into competition-like stacked pressure without promoting to a new family.',
                bestUse: [
                    'the athlete handles isolated resets but breaks down when channels stack together',
                    'the program needs a higher-load branch before moving to formal Trial or immersive work',
                    'Nora wants the default advanced Reset branch for pressure-combination training',
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
                purpose: 'This variant expresses Reset in recognizable sport situations so the athlete experiences the reset mechanic inside game-like framing.',
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

        if (name.includes('second chance')) {
            return {
                purpose: 'This variant expresses Reset through immediate recovery after an initially missed re-entry, forcing the athlete to reclaim the same target without spiraling.',
                expectedBenefit: 'Train bounce-back speed when the first recovery attempt is sloppy, late, or unstable rather than letting one miss become a sequence.',
                bestUse: [
                    'the athlete misses the first recovery moment and then unravels on the next one',
                    'the program wants a reclaim-focused Reset branch before adding heavier channel pressure',
                    'Nora needs an assignment that reinforces immediate recovery after a bad first response rather than punishing one miss as terminal',
                ],
                runtimeDefaults: {
                    emphasis: ['immediate reclaim window', 'miss-to-recover bounceback', 'second-attempt stabilization'],
                    analyticsFocus: ['Recovery Time', 'first-miss recovery rate', 'bounceback after false starts'],
                },
                durationMinutes: 5,
            };
        }

        if (name.includes('immersive reset chamber')) {
            return {
                purpose: 'This variant raises Reset transfer fidelity through immersive environmental presentation while keeping the same reset target and scoring model.',
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
                bestUse: [
                    'the athlete looks stable early but loses control late when monotony and duration compound',
                    'Nora needs a variant that highlights fatigue sensitivity instead of finish-phase stakes',
                    'the program wants a long-form endurance branch with reproducible sustained-focus packaging',
                ],
                changes: [
                    'the six-block schema stays fixed while the pressure source remains monotony plus sustained load rather than finish-phase consequence',
                    'modifier profiles map one-to-one to approved sustained-focus compositions so analytics can reconstruct the active load package deterministically',
                    'training adaptation may adjust pacing only inside approved block-level bounds and may not change the named profile or block segmentation',
                ],
                buildNotes: [
                    'Keep naming, analytics keys, and admin labels aligned with the registry entry.',
                    `Mark this variant as archetype ${ARCHETYPE_LABELS[archetype]} so generation and runtime config stay aligned.`,
                    'Store variant assignment, family, mode, and any variant-specific tags in the session record.',
                    'Store fixed block duration, inter-block micro-rest schedule, and named sustained-focus profile id so long-form deterioration is reproducible rather than interpretive.',
                ],
                runtimeDefaults: {
                    emphasis: ['stable long focus', 'attention maintenance', 'late-session clean execution'],
                    analyticsFocus: ['Degradation Slope', 'block stability', 'late-session deterioration'],
                },
                durationMinutes: 6,
            };
        }
        if (name.includes('long-reset')) {
            return {
                purpose: 'This variant expresses Endurance Lock through an extended-load endurance package that preserves the same task while forcing the athlete to repeatedly re-stabilize clean execution across a fixed long-form six-block schema.',
                expectedBenefit: 'Expose deterioration patterns and long-run reset weakness that shorter endurance reps can miss.',
                bestUse: [
                    'the athlete looks stable early but loses control late under accumulating duration and reduced recovery room',
                    'Nora needs a long-form endurance branch that emphasizes repeated re-stabilization rather than late-phase stakes',
                    'the program wants a publish-grade long-duration profile with fixed block and recovery structure',
                ],
                changes: [
                    'the pressure source is extended sustained load plus progressively tighter recovery room, not finish-phase consequence or channel interference',
                    'analysis must separate baseline, middle, and finish blocks inside the same fixed six-block schema',
                    'one named endurance profile remains fixed for the full session so load progression is reproducible and interpretable',
                ],
                buildNotes: [
                    'Keep naming, analytics keys, and admin labels aligned with the registry entry.',
                    `Mark this variant as archetype ${ARCHETYPE_LABELS[archetype]} so generation and runtime config stay aligned.`,
                    'Store variant assignment, family, mode, and any variant-specific tags in the session record.',
                    'Store fixed block duration, inter-block micro-rest schedule, and the named long-reset profile id so repeated re-stabilization is reproducible across builds.',
                ],
                runtimeDefaults: {
                    emphasis: ['extended sustained load', 're-stabilization under fatigue', 'late-session clean execution'],
                    analyticsFocus: ['Degradation Slope', 'block recovery stability', 'late-session deterioration'],
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
    const boundarySafeguards = [
        `Do not violate the family boundary: ${familyBase?.boundaryRule ?? 'the parent family rules still govern'}.`,
        'If the variant starts producing a different mechanism or divergent score logic, flag it for promotion review rather than extending the variant.',
    ];

    if (variant.family === 'Endurance Lock' && archetype === 'fatigue_load') {
        boundarySafeguards.push(
            'Block structure must remain fixed to the approved six-block schema; do not alter baseline, middle, or finish-phase segmentation for this variant.',
            'One `modifier_profile_id` must remain fixed per published module and per session; no profile mixing or in-session rotation is allowed.'
        );
    }

    if (variant.family === 'Endurance Lock' && archetype === 'visual_channel') {
        boundarySafeguards.push(
            'Block structure must remain fixed to the approved six-block schema; do not alter baseline, middle, or finish-phase segmentation for this variant.',
            'One `visual_profile_id` must remain fixed per published module and per session; no profile mixing or in-session rotation is allowed.'
        );
    }

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
        boundarySafeguards,
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
        case 'Reset':
            return {
                ...generic,
                modifierProfile: 'Use one fixed documented Reset Tier 3 protocol bundle: sequence-memory focus task, combined disruption emphasis, and evaluative threat / consequence / ambiguity held constant across the full session.',
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

    if (variant.family === 'Reset') {
        notes.push('Attentional Shifting scoring remains multi-source, combining re-engagement latency with first-post-reset accuracy exactly as defined in the Reset family spec.');
        notes.push('Pressure Stability scoring remains modifier-stratified, comparing baseline versus pressure conditions exactly as defined in the Reset family spec.');
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

    if (variant.family === 'Reset') {
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
    const release = getGeneratedSpecReleaseMetadata(variant);
    return displayCopy([
        '1. Core Identity',
        `Variant Name: ${variant.name}`,
        `Parent Family: ${variant.family}`,
        'Variant Type: Trial variant',
        `Registry Mode: ${MODE_CONFIG[variant.mode].label}`,
        `Family Status: ${variant.familyStatus === 'locked' ? 'Locked Family' : 'Candidate Family'}`,
        `Status: ${release.status}`,
        `Build Priority: ${mapPriority(variant.priority)}`,
        `Version: ${release.version}`,
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
        ...(variant.family === 'Reset'
            ? [
                '- Attentional Shifting scoring remains multi-source, combining re-engagement latency with first-post-reset accuracy exactly as defined in the Reset family spec.',
                '- Pressure Stability scoring remains modifier-stratified, comparing baseline versus pressure conditions exactly as defined in the Reset family spec.',
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
    ].join('\n'));
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

function getAssignmentLanguagePattern(theme: VariantTheme) {
    return theme.bestUse;
}

function getMeasurementLanguagePattern(variant: VariantEntry, theme: VariantTheme) {
    return getNonTrialMeasurementNotes(variant, theme);
}

function getArtifactRiskPattern(variant: VariantEntry, theme: VariantTheme) {
    if (variant.family === 'Reset' && resolveVariantArchetype(variant) === 'visual_channel') {
        return [
            ...theme.artifactRisks,
            'If a visual modifier makes the live cue ambiguous enough to create a new decision problem, classify it as a build defect rather than athlete failure.',
        ];
    }

    if (variant.family === 'Endurance Lock' && resolveVariantArchetype(variant) === 'visual_channel') {
        return [
            ...theme.artifactRisks,
            'If visual clutter, peripheral bait, or contrast drift makes the live cue ambiguous enough to create a new search task, classify it as a build defect rather than athlete failure.',
        ];
    }

    return theme.artifactRisks;
}

function getVariantSpecificModifierMatrix(variant: VariantEntry) {
    if (variant.family === 'Reset' && resolveVariantArchetype(variant) === 'visual_channel') {
        return [
            '`flash` = a full-field luminance pulse, strobe burst, or abrupt overlay that competes with the live cue for <= 500 ms without changing the task rule or the correct target.',
            '`target_disappearance` = the live cue is masked, hidden, or dropped for a bounded interval, then restored to the same task context so the athlete must reacquire the original target rather than solve a new problem.',
            '`layout_scramble` = non-target anchors, peripheral elements, or surrounding layout positions shift while the live cue rule remains the same and the athlete must re-engage the original task.',
            'Tier 1 allows one modifier at a time only: `flash` or `target_disappearance` or `layout_scramble`.',
            'Tier 2 allows one modifier at a time or `flash + layout_scramble`; `target_disappearance` may pair only with low-salience flash and may not pair with simultaneous scramble.',
            'Tier 3 allows `flash + target_disappearance` or `flash + layout_scramble`; `target_disappearance + layout_scramble` remains disallowed because it risks changing the mechanic from reset recovery into target-search or rule-discovery.',
        ];
    }

    if (variant.family === 'Endurance Lock' && resolveVariantArchetype(variant) === 'fatigue_load') {
        const name = variant.name.toLowerCase();
        if (name.includes('late-pressure')) {
            return [
                '`sustained_load` = a fixed six-block endurance structure with minimal rest, stable task identity, and load carried through repetition density rather than task-switching.',
                '`late_pressure_profile` = one named finish-phase pressure package applied only in Blocks 5-6; approved profile ids are `clock_compression_v1`, `score_weight_v1`, or `error_consequence_v1` and they may not be mixed inside the same build.',
                '`stakes_messaging` = optional explicit finish-phase cueing that reminds the athlete the final blocks matter more; it may amplify the named late-pressure profile but may not introduce a new mechanic.',
                'Tier 2 = `sustained_load + one late_pressure_profile`.',
                'Tier 3 = `sustained_load + one late_pressure_profile + stakes_messaging`.',
                '`late_pressure_profile` may not rotate between time pressure, scoring weight, and consequence inside a single assignment; choose one normalized profile per published module so comparisons stay interpretable.',
            ];
        }

        if (name.includes('sustained-focus')) {
            return [
                '`sustained_load` = a fixed six-block endurance structure with stable task identity, minimal rest, and repetition density that rises without introducing a new problem.',
                '`micro_rest_suppression` = reduced recovery room between blocks while preserving the same target rule and pacing architecture.',
                '`attention_hold` = monotony-preserving presentation that keeps the task visually and cognitively stable so deterioration comes from time-on-task rather than surprise.',
                '`modifier_profile_id` = one named sustained-focus package selected per published module; approved profile ids are `steady_focus_v1`, `reduced_rest_v1`, or `steady_focus_monotony_v1` and they may not be mixed inside the same build.',
                '`steady_focus_v1` maps one-to-one to Tier 1 = `sustained_load` only across all six blocks with fixed 60-second blocks and fixed 4-second micro-rest after Blocks 1-5.',
                '`reduced_rest_v1` maps one-to-one to Tier 2 = `sustained_load + micro_rest_suppression`, with fixed 60-second blocks, 4-second micro-rest after Blocks 1-2, and 2-second micro-rest after Blocks 3-5.',
                '`steady_focus_monotony_v1` maps one-to-one to Tier 3 = `sustained_load + micro_rest_suppression + attention_hold`, with fixed 60-second blocks, 2-second micro-rest after Blocks 1-5, and monotony-preserving presentation held constant across the full session.',
                'No pressure-profile or distraction modifier may be layered into this variant; the pressure source must remain duration-dependent maintenance rather than finish-phase stakes or channel noise.',
            ];
        }

        if (name.includes('long-reset')) {
            return [
                '`sustained_load` = a fixed six-block endurance structure with stable task identity, 60-second blocks, and repetition density that stays high enough to require repeated re-stabilization without changing the task.',
                '`micro_rest_suppression` = fixed recovery-room compression between blocks that raises long-form endurance demand without changing the target rule or response mapping.',
                '`attention_hold` = monotony-preserving presentation that keeps the same task active so deterioration comes from extended load rather than novelty or stakes.',
                '`modifier_profile_id` = one named long-reset endurance package selected per published module; approved profile ids are `long_reset_v1` only and it may not be mixed with any other profile inside the same build.',
                '`long_reset_v1` maps one-to-one to Tier 1 in Blocks 1-2 = `sustained_load`, Tier 2 in Blocks 3-4 = `sustained_load + micro_rest_suppression`, and Tier 3 in Blocks 5-6 = `sustained_load + micro_rest_suppression + attention_hold`.',
                'The `long_reset_v1` package requires fixed 60-second blocks, 4-second micro-rest after Blocks 1-2, and 2-second micro-rest after Blocks 3-5; no alternative rest schedule or profile rotation is allowed within a published module.',
            ];
        }

        return [
            '`sustained_load` = a fixed block-based endurance structure where the same task identity is preserved while repetition density and fatigue load accumulate.',
            '`load_modifier_profile` = one named endurance-load packaging profile chosen per published module; it must be normalized and may not change mid-session.',
            'If a second modifier is used, its co-occurrence rules must be explicit and block-stable rather than improvised round to round.',
            'Every fatigue-load variant must define valid Tier 1, Tier 2, and Tier 3 combinations before publish; undefined overlap rules mean the build is not ready.',
        ];
    }

    if (variant.family === 'Endurance Lock' && resolveVariantArchetype(variant) === 'visual_channel') {
        return [
            '`visual_density` = a fixed six-block endurance structure where non-target visual clutter increases through approved density tiers while the task identity and correct target mapping remain unchanged.',
            '`peripheral_bait` = peripheral motion, decoy pulses, or edge-loaded competition that competes for attention without becoming a second task or changing the correct response rule.',
            '`contrast_drift` = a bounded reduction in cue salience or background contrast that preserves live-cue legibility above the approved floor and may not turn the task into target search.',
            '`visual_profile_id` = one named visual-load package selected per published module; approved profile ids are `clutter_ramp_v1`, `peripheral_bait_v1`, or `contrast_decay_v1` and they may not be mixed inside the same build.',
            'Tier 1 = `visual_density + one visual_profile_id`.',
            'Tier 2 = `visual_density + one visual_profile_id + peripheral_bait` or `visual_density + one visual_profile_id + contrast_drift`.',
            'Tier 3 = `visual_density + one visual_profile_id + peripheral_bait + contrast_drift` only if cue legibility remains above the approved threshold for the full six-block session.',
            '`visual_profile_id` may not rotate between clutter, peripheral bait, and contrast-decay packages inside a single assignment; choose one normalized visual profile per published module so degradation curves stay interpretable.',
            '`clutter_ramp_v1` fixed recipe = Blocks 1-2 clean-reference baseline with `visual_density_tier=low`; Blocks 3-4 controlled clutter ramp at `visual_density_tier=medium`; Blocks 5-6 high-clutter continuation at `visual_density_tier=high` with no added peripheral bait or contrast drift.',
            '`peripheral_bait_v1` fixed recipe = Blocks 1-2 clean-reference baseline with `peripheral_load_tier=low`; Blocks 3-4 low-salience edge decoys at `peripheral_load_tier=medium`; Blocks 5-6 repeated peripheral competition at `peripheral_load_tier=high` while `visual_density_tier` stays fixed at `medium` and `contrast_profile` stays `normal_contrast`.',
            '`contrast_decay_v1` fixed recipe = Blocks 1-2 clean-reference baseline with `contrast_profile=normal_contrast`; Blocks 3-4 controlled cue-salience reduction at `contrast_profile=reduced_contrast`; Blocks 5-6 repeated low-salience continuation at `contrast_profile=glare_wash` while `visual_density_tier` stays `medium` and `peripheral_load_tier` stays `low`.',
        ];
    }

    return [
        'Define each approved modifier in runtime terms before publish so the pressure source is operationally clear rather than purely descriptive.',
        'Lock which modifiers can co-occur by tier; if overlap rules are undefined, the build is not ready for publish.',
    ];
}

function getVariantSpecificTrialProfile(variant: VariantEntry) {
    if (variant.family === 'Reset' && resolveVariantArchetype(variant) === 'visual_channel') {
        return [
            'If this variant is run in Trial Mode, lock a single Tier 3 profile: 5 minutes, adaptive difficulty off, coached feedback suppressed, fixed seed, fixed device logging, and one approved visual modifier schedule.',
            'Recommended fixed schedule: Block 1 baseline clean read, Block 2 `flash` only, Block 3 `target_disappearance`, Block 4 `layout_scramble`, Block 5 `flash + layout_scramble` overlap.',
            'Keep contrast profile, peripheral load tier, and visual density tier fixed for the whole trial protocol so the result reflects recovery quality rather than drifting presentation conditions.',
        ];
    }

    if (variant.family === 'Endurance Lock' && resolveVariantArchetype(variant) === 'fatigue_load') {
        const name = variant.name.toLowerCase();
        if (name.includes('late-pressure')) {
            return [
                'If Trial Mode is used for this variant, lock one named six-block profile: 6 minutes, adaptive difficulty off, fixed seed, fixed device class, and one approved late-pressure profile id.',
                'Recommended fixed schedule: Blocks 1-2 baseline reference, Blocks 3-4 controlled sustained-load continuation, Block 5 late-pressure activation, Block 6 repeated late-pressure activation at the same normalized severity.',
                'Keep block duration, pacing cadence, and finish-phase profile constant for the full trial so degradation curves and finish-phase comparisons remain reproducible.',
            ];
        }

        if (name.includes('sustained-focus')) {
            return [
                'If Trial Mode is used for this variant, lock one named six-block profile: `modifier_profile_id=steady_focus_monotony_v1`, 6 minutes, adaptive difficulty off, fixed seed, fixed device class, fixed 60-second blocks, and fixed micro-rest schedule.',
                'Recommended fixed schedule: Blocks 1-2 baseline reference with 60-second blocks and 2-second micro-rest, Blocks 3-4 steady sustained-load continuation with the same block duration and rest schedule, Blocks 5-6 finish-phase endurance continuation with the same monotony-preserving profile and no added pressure overlays.',
                'Keep block duration, micro-rest values, monotony profile, and selected `modifier_profile_id` fixed for the full trial so the score reflects duration-driven deterioration rather than implementation interpretation.',
            ];
        }

        if (name.includes('long-reset')) {
            return [
                'If Trial Mode is used for this variant, lock one named six-block profile: `modifier_profile_id=long_reset_v1`, 6 minutes, adaptive difficulty off, fixed seed, fixed device class, fixed 60-second blocks, and the approved long-reset micro-rest schedule.',
                'Recommended fixed schedule: Blocks 1-2 baseline reference with 60-second blocks and 4-second micro-rest, Blocks 3-4 controlled sustained-load continuation with 60-second blocks and 2-second micro-rest, Blocks 5-6 finish-phase continuation with the same 60-second block duration, 2-second micro-rest, and fixed `attention_hold` overlay.',
                'Keep block duration, micro-rest values, block identities, and the `long_reset_v1` profile fixed for the full trial so long-form deterioration and repeated re-stabilization are reproducible across builds.',
            ];
        }

        return [
            'If Trial Mode is used for this variant, lock one named endurance profile with fixed block structure, fixed seed, fixed device class, fixed duration, and adaptive difficulty disabled.',
        ];
    }

    if (variant.family === 'Endurance Lock' && resolveVariantArchetype(variant) === 'visual_channel') {
        return [
            'If Trial Mode is used for this variant, lock one named six-block profile: 6 minutes, adaptive difficulty off, fixed seed, fixed device class, and one approved `visual_profile_id`.',
            'Recommended fixed schedule: Blocks 1-2 clean-reference baseline, then apply the exact per-block display-state recipe defined by the selected `visual_profile_id` with no substitutions or in-session profile changes.',
            'Keep block duration, block schema, selected `visual_profile_id`, and selected `visual_profile_schedule_version` fixed for the full trial; per-block display-state values must follow the locked recipe exactly and may not be manually varied or substituted.',
        ];
    }

    return [
        'If Trial Mode is used for this variant, lock one named modifier profile with fixed seed, fixed device class, fixed duration, and adaptive difficulty disabled rather than relying on prose-only standardization.',
    ];
}

function getCanonicalAnalyticsTagVocabulary(variant: VariantEntry) {
    if (variant.family === 'Reset' && resolveVariantArchetype(variant) === 'visual_channel') {
        return [
            '`visual_disruption_subtype`: allowed values = `flash`, `target_disappearance`, `layout_scramble`.',
            '`visual_disruption_overlap_mode`: allowed values = `single_modifier`, `flash_plus_target_disappearance`, `flash_plus_layout_scramble`.',
            '`contrast_profile`: allowed values = `normal_contrast`, `reduced_contrast`, `glare_wash`.',
            '`peripheral_load_tier`: allowed values = `low`, `medium`, `high`.',
            '`visual_density_tier`: allowed values = `tier_1`, `tier_2`, `tier_3`.',
            '`delivery_surface`: allowed values = `web_desktop`, `web_mobile`, `phone_native`, `tablet_native`.',
        ];
    }

    if (variant.family === 'Endurance Lock' && resolveVariantArchetype(variant) === 'fatigue_load') {
        const name = variant.name.toLowerCase();
        const modifierProfileValues = name.includes('late-pressure')
            ? '`clock_compression_v1`, `score_weight_v1`, `error_consequence_v1`'
            : name.includes('sustained-focus')
                ? '`steady_focus_v1`, `reduced_rest_v1`, `steady_focus_monotony_v1`'
                : name.includes('long-reset')
                    ? '`long_reset_v1`'
                : '`endurance_profile_v1`';
        const activeModifierValues = name.includes('late-pressure')
            ? '`sustained_load`, `late_pressure_profile`, `stakes_messaging`'
            : '`sustained_load`, `micro_rest_suppression`, `attention_hold`';

        return [
            'Session fields must stay distinct from event tags and derived metrics; do not flatten them into one unlabeled analytics list.',
            `\`modifier_profile_id\`: session field, allowed values = ${modifierProfileValues}.`,
            '`device_class`: session field, allowed values = `web_desktop`, `web_mobile`, `phone_native`, `tablet_native`.',
            '`delivery_surface`: session field, allowed values = `browser`, `native_phone`, `native_tablet`, `headset`.',
            '`block_structure_version`: session field, allowed values = `six_block_v1`.',
            '`block_identity`: event tag, allowed values = `baseline_1`, `baseline_2`, `mid_1`, `mid_2`, `finish_1`, `finish_2`.',
            `\`active_modifier\`: event tag, allowed values = ${activeModifierValues}.`,
            '`baseline_performance`, `degradation_onset_block`, and `degradation_slope`: derived metrics and must not be stored as free-form tags.',
        ];
    }

    if (variant.family === 'Endurance Lock' && resolveVariantArchetype(variant) === 'visual_channel') {
        return [
            'Session fields must stay distinct from event tags and derived metrics; do not flatten them into one unlabeled analytics list.',
            '`visual_profile_id`: session field, allowed values = `clutter_ramp_v1`, `peripheral_bait_v1`, `contrast_decay_v1`.',
            '`visual_profile_schedule_version`: session field, allowed values = `clutter_ramp_v1_schedule`, `peripheral_bait_v1_schedule`, `contrast_decay_v1_schedule`.',
            '`device_class`: session field, allowed values = `web_desktop`, `web_mobile`, `phone_native`, `tablet_native`.',
            '`delivery_surface`: session field, allowed values = `browser`, `native_phone`, `native_tablet`, `headset`.',
            '`block_structure_version`: session field, allowed values = `six_block_v1`.',
            '`visual_density_tier`: block-scoped event tag, allowed values = `low`, `medium`, `high`.',
            '`peripheral_load_tier`: block-scoped event tag, allowed values = `low`, `medium`, `high`.',
            '`contrast_profile`: block-scoped event tag, allowed values = `normal_contrast`, `reduced_contrast`, `glare_wash`.',
            '`block_identity`: event tag, allowed values = `baseline_1`, `baseline_2`, `mid_1`, `mid_2`, `finish_1`, `finish_2`.',
            '`active_modifier`: event tag, allowed values = `visual_density`, `peripheral_bait`, `contrast_drift`.',
            '`baseline_performance`, `degradation_onset_block`, and `degradation_slope`: derived metrics and must not be stored as free-form tags.',
        ];
    }

    return [
        'Use canonical lower_snake_case tag families for modifier subtype, overlap mode, device class, and delivery surface; do not introduce near-duplicate labels at the session layer.',
    ];
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
    if (variant.family === 'Reset') {
        const archetype = resolveVariantArchetype(variant);
        const contextTagNote = archetype === 'visual_channel'
            ? 'Visual-channel, display-state, and delivery tags may support interpretation, but they must remain context fields and may not replace the family metric.'
            : archetype === 'audio_channel'
                ? 'Audio-channel, audio-route, and delivery tags may support interpretation, but they must remain context fields and may not replace the family metric.'
            : 'Sport, scenario, or delivery tags may support interpretation, but they must remain context fields and may not replace the family metric.';

        return [
            'Recovery Time = disruption end -> confirmed re-engagement, with valid re-engagement requiring two consecutive correct responses on the refocused task.',
            'First-Post-Reset Accuracy must be reported alongside Recovery Time so the athlete cannot game the sim by reacting fast but inaccurately.',
            'False Start Count = responses during the disruption phase before the reset signal; false starts are logged separately and do not count as recovery.',
            'Responses below 150 ms are motor artifacts and must be excluded from the headline metric.',
            'Attentional Shifting remains a multi-source score combining re-engagement latency with first-post-reset accuracy.',
            'Pressure Stability remains modifier-stratified, comparing Recovery Time under baseline versus pressure conditions instead of averaging modifier states together.',
            contextTagNote,
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
        const archetype = resolveVariantArchetype(variant);
        if (archetype === 'fatigue_load') {
            const name = variant.name.toLowerCase();
            const latePhaseLine = name.includes('late-pressure')
                ? 'Late-pressure profiles must stay normalized: Training Mode may change pacing cadence or rest ratio only inside the approved six-block schema, but it may not swap the active late-pressure profile, change block identities, alter finish-phase segmentation, or rewrite the finish-phase scoring logic.'
                : 'Training-mode adaptation may change pacing cadence or micro-rest only inside the approved six-block schema, but it may not change the task identity, block identities, or headline measurement logic.';

            return [
                'Baseline Performance = mean accuracy across Blocks 1-2.',
                'Mid-Session Performance = mean accuracy across Blocks 3-4.',
                'Finish-Phase Performance = mean accuracy across Blocks 5-6.',
                'Degradation Onset = the first block where performance drops below 90% of the Block 1-2 baseline and stays below that threshold through the next block.',
                'Degradation Slope is the headline metric and should be calculated from the fitted drop across Blocks 4-6, reported as % accuracy loss per minute.',
                name.includes('late-pressure')
                    ? 'Late-phase comparison must compare Blocks 5-6 against the same athlete\'s Block 1-2 baseline under the same core task mapping; the pressure profile may change, the task may not.'
                    : 'Finish-phase comparison must compare Blocks 5-6 against the same athlete\'s Block 1-2 baseline under the same core task mapping.',
                'Embedded task attribution must stay with Endurance Lock; if another family task is embedded, the measured phenomenon is duration-dependent degradation, not the embedded family score.',
                'Block identity, onset timing, modifier profile id, and device class may support interpretation, but they must remain context fields rather than a replacement scoring system.',
                latePhaseLine,
            ];
        }

        if (archetype === 'visual_channel') {
            return [
                'Baseline Performance = mean accuracy across Blocks 1-2 under the clean-reference visual state.',
                'Mid-Session Performance = mean accuracy across Blocks 3-4 under the approved visual-load continuation state.',
                'Finish-Phase Performance = mean accuracy across Blocks 5-6 under the same named `visual_profile_id` at fixed normalized severity.',
                'Degradation Onset = the first block where performance drops below 90% of the Block 1-2 baseline and stays below that threshold through the next block.',
                'Degradation Slope is the headline metric and should be calculated from the fitted drop across Blocks 4-6, reported as % accuracy loss per minute.',
                'Finish-phase comparison must compare Blocks 5-6 against the same athlete\'s Block 1-2 baseline under the same core task mapping; the active visual profile may change the display state, but it may not change the task.',
                'Embedded task attribution must stay with Endurance Lock; if another family task is embedded, the measured phenomenon is duration-dependent degradation, not the embedded family score.',
                'Block identity, visual_profile_id, visual density tier, peripheral load tier, contrast profile, and device class may support interpretation, but they must remain context fields rather than a replacement scoring system.',
                'Visual-channel profiles must stay normalized: Training Mode may change pacing cadence or density step size inside approved family bounds, but it may not swap the active visual profile, change block identities, or rewrite the finish-phase scoring logic.',
            ];
        }

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
    const trialMode = [...theme.trialMode, ...getVariantSpecificTrialProfile(variant)];

    if (variant.family === 'Reset' && archetype === 'sport_context') {
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
        const name = variant.name.toLowerCase();
        return {
            trainingMode: [
                ...trainingMode,
                'show block-by-block fatigue coaching so the athlete can see whether execution is slipping early, mid, or late rather than over-reading one bad moment',
                name.includes('late-pressure')
                    ? 'training-mode adaptation may change pacing cadence or rest ratio only inside the approved six-block schema, but it may not change the task identity, block schema, baseline/middle/finish segmentation, or the named late-pressure profile'
                    : 'training-mode adaptation may change pacing cadence only inside the approved six-block schema, but it may not change total session duration, fixed block duration, baseline/middle/finish segmentation, the approved micro-rest schedule, or the named modifier_profile_id',
            ],
            trialMode: [
                ...trialMode,
                name.includes('late-pressure')
                    ? 'if trial-layer packaging is used, hold baseline window, pacing structure, and late-probe timing constant so degradation curves stay comparable'
                    : 'if trial-layer packaging is used, hold baseline window, six-block structure, fixed block duration, named modifier_profile_id, and approved micro-rest schedule constant so degradation curves stay comparable',
            ],
        };
    }

    if (variant.family === 'Endurance Lock' && archetype === 'visual_channel') {
        return {
            trainingMode: [
                ...trainingMode,
                'show block-by-block visual-load coaching so the athlete can see whether degradation came from clutter density, peripheral competition, or contrast drift rather than over-reading one bad block',
                'training-mode adaptation may change pacing cadence, density step size, or micro-rest inside approved family bounds, but it may not change the task identity, block schema, or named visual profile',
            ],
            trialMode: [
                ...trialMode,
                'if trial-layer packaging is used, hold baseline window, block schema, visual profile id, and display-state progression constant so visual endurance comparisons stay reproducible',
            ],
        };
    }

    return { trainingMode, trialMode };
}

function getNonTrialBuildNotes(variant: VariantEntry, theme: VariantTheme) {
    if (variant.family === 'Reset' && resolveVariantArchetype(variant) === 'visual_channel') {
        return [
            ...theme.buildNotes,
            'Store `visual_disruption_subtype`, `visual_disruption_overlap_mode`, `contrast_profile`, `peripheral_load_tier`, `visual_density_tier`, and `delivery_surface` using the canonical allowed values only.',
            'Preserve which visual disruption was active when a false start, motor artifact, or slow recovery occurred so coaches can separate reset speed from display-driven artifacts.',
            'Keep the live cue visually legible under every modifier state; if the build changes the task identity instead of the disruption pressure, fail the variant for review.',
        ];
    }

    if (variant.family === 'Reset' && resolveVariantArchetype(variant) === 'audio_channel') {
        return [
            ...theme.buildNotes,
            'Store audio disruption subtype tags such as crowd surge, whistle, buzzer, and startle cue in the session record so recovery failures are attributable to the active sound event.',
            'Store audio-route, output-device class, and volume-profile tags so sound-driven difficulty is inspectable rather than anecdotal.',
            'Preserve which audio disruption was active when a false start, motor artifact, or slow recovery occurred so coaches can separate reset speed from audio-routing artifacts.',
        ];
    }

    if (variant.family === 'Reset' && resolveVariantArchetype(variant) === 'sport_context') {
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
        if (resolveVariantArchetype(variant) === 'visual_channel') {
            return [
                ...theme.buildNotes,
                'Store visual_profile_id, visual_profile_schedule_version, device_class, delivery_surface, and block_structure_version as session fields, plus baseline-window markers and block identities so visual endurance failures are interpretable.',
                'Export baseline performance, mid-session performance, finish-phase performance, block-by-block accuracy, degradation slope, onset timing, and display-state transitions separately rather than flattening the full session into one fatigue score.',
                'Treat block_identity, active_modifier, visual_density_tier, peripheral_load_tier, and contrast_profile as block-scoped event tags; treat visual_profile_id / visual_profile_schedule_version / device_class / delivery_surface / block_structure_version as session fields; and treat baseline_performance / degradation_onset_block / degradation_slope as derived metrics.',
                'Keep the live cue visually legible under every approved display state; if clutter, contrast drift, or peripheral bait changes the task identity instead of visual endurance pressure, fail the variant for review.',
            ];
        }

        return [
            ...theme.buildNotes,
            'Store baseline-window markers, block identities, degradation-onset tags, modifier_profile_id, device_class, and delivery_surface in the session record so endurance failures are interpretable.',
            'Export baseline performance, mid-session performance, finish-phase performance, block-by-block accuracy, degradation slope, onset timing, and embedded-task attribution separately rather than flattening the full session into one fatigue score.',
            'Treat block_identity and active_modifier as event tags, modifier_profile_id / device_class / delivery_surface as session fields, and baseline_performance / degradation_onset_block / degradation_slope as derived metrics.',
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

    if (variant.family === 'Reset' && resolveVariantArchetype(variant) === 'visual_channel') {
        const disruptionIndex = cleaned.findIndex((note) => note.toLowerCase().includes('store `visual_disruption_subtype`, `visual_disruption_overlap_mode`, `contrast_profile`, `peripheral_load_tier`, `visual_density_tier`, and `delivery_surface`'));
        const preserveIndex = cleaned.findIndex((note) => note.toLowerCase().includes('preserve which visual disruption was active when a false start'));
        if (disruptionIndex >= 0 && preserveIndex >= 0) {
            const next = cleaned.filter((_, index) => index !== preserveIndex);
            next[disruptionIndex] = 'Store `visual_disruption_subtype`, `visual_disruption_overlap_mode`, `contrast_profile`, `peripheral_load_tier`, `visual_density_tier`, and `delivery_surface` using the canonical allowed values only, and preserve which visual disruption was active when a false start, motor artifact, or slow recovery occurred so recovery failures are attributable to the active visual disruption style.';
            return next;
        }
    }

    if (variant.family === 'Reset' && resolveVariantArchetype(variant) === 'audio_channel') {
        const disruptionIndex = cleaned.findIndex((note) => note.toLowerCase().includes('store audio disruption subtype tags such as crowd surge, whistle, buzzer, and startle cue'));
        const routeIndex = cleaned.findIndex((note) => note.toLowerCase().includes('store audio-route, output-device class, and volume-profile tags'));
        const preserveIndex = cleaned.findIndex((note) => note.toLowerCase().includes('preserve which audio disruption was active when a false start'));
        if (disruptionIndex >= 0 && routeIndex >= 0 && preserveIndex >= 0) {
            const next = cleaned.filter((_, index) => index !== routeIndex && index !== preserveIndex);
            next[disruptionIndex] = 'Store audio disruption subtype tags such as crowd surge, whistle, buzzer, and startle cue, plus audio-route, output-device class, and volume-profile tags, and preserve which sound event was active when a false start, motor artifact, or slow recovery occurred so recovery failures are attributable to the active audio disruption.';
            return next;
        }
    }

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

    const familyUpgradeSignals = findings.filter((finding) => {
        const lowerMessage = finding.message.toLowerCase();
        return finding.code.startsWith('endurance_missing_')
            || finding.code.startsWith('reset_missing_')
            || finding.code.startsWith('noise_gate_missing_')
            || finding.code.startsWith('brake_point_missing_')
            || finding.code.startsWith('signal_window_missing_')
            || finding.code.startsWith('sequence_shift_missing_')
            || lowerMessage.includes('modifier matrix')
            || lowerMessage.includes('modifier/profile')
            || lowerMessage.includes('trial standardization')
            || lowerMessage.includes('schema-grade')
            || lowerMessage.includes('analytics vocab')
            || lowerMessage.includes('baseline, middle, and finish')
            || lowerMessage.includes('adaptive difficulty');
    });

    if (familyUpgradeSignals.length > 0) {
        actions.push({
            key: 'upgrade_family_sections',
            label: 'Upgrade Family Gold Standard',
            codes: Array.from(new Set(familyUpgradeSignals.map((finding) => finding.code))),
        });
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
            state: 'fixable',
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
                state: 'manual',
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

    if (action.key === 'upgrade_family_sections') {
        const referenceSpec = buildGeneratedVariantSpec(variant);
        const referenceParsed = parseVariantSpec(referenceSpec);
        const sectionKeywords = ['archetype packaging', 'variant modifier', 'measurement', 'mode behavior', 'canonical analytics', 'build', 'boundary'];

        sectionKeywords.forEach((keyword) => {
            const referenceSection = extractSectionByKeyword(referenceParsed, keyword);
            if (referenceSection) {
                next = replaceSectionContent(next, keyword, referenceSection.content);
            }
        });
    }

    return normalizeSpecText(next);
}

function autoApplySupportedAuditFixes(
    variant: VariantEntry,
    raw: string,
    auditReport: SpecAuditReport,
) {
    let currentRaw = normalizeSpecText(raw);
    let currentAudit = auditReport;
    const appliedLabels: string[] = [];
    const exhaustedKeys = new Set<string>();

    const hasMissingSections = currentAudit.findings.some((finding) => finding.code === 'missing_section');
    if (hasMissingSections) {
        const rebuiltRaw = rebuildSpecWithCanonicalSections(variant, currentRaw);
        if (rebuiltRaw !== currentRaw) {
            currentRaw = rebuiltRaw;
            currentAudit = runSpecAuditPipeline(variant, currentRaw);
            appliedLabels.push('Restore Required Sections');
        }
    }

    for (let index = 0; index < 6; index += 1) {
        const nextAction = buildSupportedWarningFixActions(variant, currentAudit.findings)
            .find((action) => !exhaustedKeys.has(action.key));
        if (!nextAction) {
            break;
        }

        const nextRaw = applyAuditWarningFixes(variant, currentRaw, nextAction);
        exhaustedKeys.add(nextAction.key);
        if (normalizeSpecText(nextRaw) === currentRaw) {
            continue;
        }

        appliedLabels.push(nextAction.label);
        currentRaw = normalizeSpecText(nextRaw);
        currentAudit = runSpecAuditPipeline(variant, currentRaw);
    }

    const promotedRaw = normalizeSpecText(promoteSpecReleaseMetadata(currentRaw, variant, currentAudit));
    if (promotedRaw !== currentRaw) {
        currentRaw = promotedRaw;
        currentAudit = runSpecAuditPipeline(variant, currentRaw);
        appliedLabels.push('Promote Spec Metadata');
    }

    const checklistAlignedRaw = normalizeSpecText(syncReadinessChecklist(currentRaw, variant));
    if (checklistAlignedRaw !== currentRaw) {
        currentRaw = checklistAlignedRaw;
        currentAudit = runSpecAuditPipeline(variant, currentRaw);
        appliedLabels.push('Complete Published Checklist');
    }

    return {
        raw: currentRaw,
        audit: currentAudit,
        appliedLabels,
    };
}

function materializeWarningFixGroups(
    variant: VariantEntry,
    findings: SpecAuditFinding[],
    disabledKeys: string[],
    nextActionKey: string | null
) {
    return buildWarningFixGroups(variant, findings).map((group) => {
        if (group.state === 'manual') {
            return group;
        }
        if (disabledKeys.includes(group.key)) {
            return { ...group, state: 'exhausted' as const };
        }
        if (group.key === nextActionKey) {
            return { ...group, state: 'next' as const };
        }
        return { ...group, state: 'fixable' as const };
    });
}

function buildGeneratedVariantSpec(variant: VariantEntry): string {
    const familyBase = FAMILY_SPEC_BASES[variant.family];
    const theme = inferVariantTheme(variant);
    const modeNotes = getNonTrialModeNotes(variant, theme);
    const buildNotes = cleanupGeneratedBuildNotes(variant, getNonTrialBuildNotes(variant, theme));
    const today = formatGeneratedSpecDate();
    const release = getGeneratedSpecReleaseMetadata(variant);
    const assignmentPattern = getAssignmentLanguagePattern(theme);
    const modifierMatrix = getVariantSpecificModifierMatrix(variant);
    const measurementPattern = getMeasurementLanguagePattern(variant, theme);
    const artifactRiskPattern = getArtifactRiskPattern(variant, theme);
    const canonicalAnalyticsVocabulary = getCanonicalAnalyticsTagVocabulary(variant);

    if (isTrialVariant(variant)) {
        return buildGeneratedTrialVariantSpec(variant, familyBase, theme, today);
    }

    return displayCopy([
        '1. Core Identity',
        `Variant Name: ${variant.name}`,
        `Parent Family: ${variant.family}`,
        `Variant Type: ${theme.variantType}`,
        `Registry Mode: ${MODE_CONFIG[variant.mode].label}`,
        `Family Status: ${variant.familyStatus === 'locked' ? 'Locked Family' : 'Candidate Family'}`,
        `Status: ${release.status}`,
        `Build Priority: ${mapPriority(variant.priority)}`,
        `Version: ${release.version}`,
        `Generated On: ${today}`,
        '',
        '2. Why This Variant Exists',
        `Purpose: ${theme.purpose}`,
        `Expected Benefit: ${theme.expectedBenefit}`,
        'When Nora Should Assign:',
        ...assignmentPattern.map((item) => `- ${item}`),
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
        '6. Variant Modifier Matrix',
        ...modifierMatrix.map((item) => `- ${item}`),
        '',
        '7. Measurement and Scoring Notes',
        ...measurementPattern.map((item) => `- ${item}`),
        'Artifact / false-start risks:',
        ...artifactRiskPattern.map((item) => `- ${item}`),
        '',
        '8. Mode Behavior',
        'Training Mode:',
        ...modeNotes.trainingMode.map((item) => `- ${item}`),
        'Trial Mode:',
        ...modeNotes.trialMode.map((item) => `- ${item}`),
        '',
        '9. Canonical Analytics Tag Vocabulary',
        ...canonicalAnalyticsVocabulary.map((item) => `- ${item}`),
        '',
        '10. Build and Implementation Notes',
        ...buildNotes.map((item) => `- ${item}`),
        '',
        '11. Governing Documents',
        ...(familyBase?.governingDocs ?? [
            'Sim Specification Standards Addendum (v2)',
            `${variant.family} Family Spec`,
            'Sim Family Tree v2',
            'Sim Family Promotion Protocol v2.1',
        ]).map((item) => `- ${item}`),
        '',
        '12. Boundary Safeguards',
        ...theme.boundarySafeguards.map((item) => `- ${item}`),
        '',
        '13. Variant Readiness Checklist',
        '- [ ] Core identity fields and status language reviewed against the registry entry and publish state',
        '- [ ] Archetype defaults match the intended packaging for this variant',
        '- [ ] Family inheritance and variant-specific changes confirmed',
        '- [ ] Modifier matrix and co-occurrence rules locked before publish',
        '- [ ] Measurement notes checked against family metric rules',
        '- [ ] Training Mode and Trial Mode behavior reviewed, including any fixed trial profile',
        '- [ ] Canonical analytics tag vocabulary locked to approved values',
        '- [ ] Artifact risks and boundary safeguards documented',
        '- [ ] Build and data notes translated into implementation tasks',
    ].join('\n'));
}

async function requestAiVariantSpecAudit(
    variant: VariantEntry,
    rawSpec: string,
    findings: SpecAuditFinding[]
): Promise<VariantSpecAiAuditResult> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), AI_SPEC_AUDIT_TIMEOUT_MS);
    try {
        const response = await fetch('/api/admin/audit-variant-spec', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
            body: JSON.stringify({
                variant: {
                    name: variant.name,
                    family: variant.family,
                    familyStatus: variant.familyStatus,
                    mode: variant.mode,
                    priority: variant.priority,
                    specStatus: variant.specStatus,
                    archetype: resolveVariantArchetype(variant),
                    publishedModuleId: variant.publishedModuleId ?? null,
                    buildStatus: variant.buildStatus ?? null,
                },
                rawSpec,
                deterministicFindings: findings,
            }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to run AI spec audit');
        }
        return data as VariantSpecAiAuditResult;
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            throw new Error('AI spec audit timed out after 45 seconds.');
        }
        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

async function requestAiVariantSpecGeneration(
    variant: VariantEntry,
    seedSpec: string
): Promise<VariantSpecAiGenerationResult> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), AI_SPEC_GENERATION_TIMEOUT_MS);
    try {
        const response = await fetch('/api/admin/generate-variant-spec', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
            body: JSON.stringify({
                variant: {
                    name: variant.name,
                    family: variant.family,
                    familyStatus: variant.familyStatus,
                    mode: variant.mode,
                    priority: variant.priority,
                    specStatus: variant.specStatus,
                    archetype: resolveVariantArchetype(variant),
                    publishedModuleId: variant.publishedModuleId ?? null,
                    buildStatus: variant.buildStatus ?? null,
                },
                seedSpec,
            }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to generate AI variant spec');
        }
        return data as VariantSpecAiGenerationResult;
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            throw new Error('AI draft generation timed out after 120 seconds.');
        }
        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }
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
    if (variant.family === 'Reset') return 'rotate-ccw';
    if (variant.family === 'Noise Gate') return 'volume-x';
    if (variant.family === 'Brake Point') return 'hand';
    if (variant.family === 'Signal Window') return 'radar';
    if (variant.family === 'Sequence Shift') return 'shuffle';
    if (variant.family === 'Endurance Lock') return 'timer';
    return 'brain';
}

function mapFamilyToFocusType(variant: VariantEntry): 'single_point' | 'distraction' | 'cue_word' | 'body_scan' | 'reset' {
    if (variant.family === 'Reset') return 'reset';
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
    const displayFamily = displayFamilyName(variant.family);
    const displayVariant = displayVariantName(variant.name);

    return {
        moduleId: buildSimVariantId(variant),
        name: displayVariant,
        description: displayCopy(theme.purpose),
        category: ExerciseCategory.Focus,
        difficulty: inferModuleDifficulty(variant),
        durationMinutes: inferModuleDurationMinutes(variant),
        benefits: [
            displayCopy(theme.expectedBenefit),
            displayCopy(familyBase?.skillTargets ?? 'Build pressure-ready execution'),
            displayCopy(`${familyBase?.coreMetric ?? 'Core metric'} remains measurable inside the parent family`),
        ],
        bestFor: theme.bestUse.slice(0, 4).map(displayCopy),
        origin: displayCopy(`${displayFamily} family module generated from the variant registry and governed by the family specification stack.`),
        neuroscience: displayCopy(`Targets ${familyBase?.skillTargets ?? 'pressure-ready cognitive execution'} through ${familyBase?.mechanism ?? 'the parent family mechanism'} while preserving the parent-family scoring model.`),
        overview: {
            when: displayCopy(theme.bestUse[0] || 'When the athlete needs this specific pressure expression'),
            focus: displayCopy(familyBase?.skillTargets ?? 'Execution stability under pressure'),
            timeScale: `${inferModuleDurationMinutes(variant)} minutes`,
            skill: displayCopy(familyBase?.coreMetric ?? 'Family metric reinforcement'),
            analogy: displayCopy(`A focused ${theme.variantType.toLowerCase()} of ${displayFamily}.`),
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
        name: displayVariantName(moduleDraft.name),
        description: displayCopy(moduleDraft.description),
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
                    displayCopy(`Run ${record.name} inside the ${record.family} family boundary.`),
                    displayCopy(`Train ${FAMILY_SPEC_BASES[record.family]?.skillTargets ?? 'execution stability under pressure'}.`),
                    'Keep the family metric interpretable and the runtime behavior consistent with the registry spec.',
                ],
            },
        },
        benefits: moduleDraft.benefits.map(displayCopy),
        bestFor: moduleDraft.bestFor.map(displayCopy),
        origin: displayCopy(moduleDraft.origin),
        neuroscience: displayCopy(moduleDraft.neuroscience),
        overview: {
            ...moduleDraft.overview,
            when: displayCopy(moduleDraft.overview.when),
            focus: displayCopy(moduleDraft.overview.focus),
            skill: displayCopy(moduleDraft.overview.skill),
            analogy: displayCopy(moduleDraft.overview.analogy),
        },
        iconName: moduleDraft.iconName,
        isActive: moduleDraft.isActive,
        sortOrder: moduleDraft.sortOrder,
        simSpecId: record.id,
        runtimeConfig: record.runtimeConfig,
        variantSource: {
            variantId: record.id,
            variantName: displayVariantName(record.name),
            family: displayFamilyName(record.family),
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
                                placeholder="e.g. Pressure-Crowd Reset"
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
    onRollback,
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
    onRollback: (next: SimVariantRecord) => void;
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
    const [specVersions, setSpecVersions] = useState<SimVariantSpecVersionEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [restoringHistoryId, setRestoringHistoryId] = useState<string | null>(null);
    const [rollingBackVersionId, setRollingBackVersionId] = useState<string | null>(null);
    const [timelineRefreshToken, setTimelineRefreshToken] = useState(0);
    const [auditReport, setAuditReport] = useState<SpecAuditReport | null>(null);
    const [specGenerationLoading, setSpecGenerationLoading] = useState(false);
    const [aiAuditLoading, setAiAuditLoading] = useState(false);
    const [warningFixFeedback, setWarningFixFeedback] = useState<WarningFixFeedback | null>(null);
    const [disabledWarningFixKeys, setDisabledWarningFixKeys] = useState<string[]>([]);
    const [showDetailedFindings, setShowDetailedFindings] = useState(false);
    const [previewModule, setPreviewModule] = useState<MentalExercise | null>(null);
    const [loadingPublishedPreview, setLoadingPublishedPreview] = useState(false);
    const [workspaceActionLabel, setWorkspaceActionLabel] = useState<string | null>(null);
    const [workspaceActionError, setWorkspaceActionError] = useState<string | null>(null);
    const [specCopied, setSpecCopied] = useState(false);
    const trialVariant = isTrialVariant(variantMeta);
    const activeLockedSpec = variantMeta.lockedSpec ?? buildDefaultLockedSpec(variantMeta);
    const warningFindings = useMemo(
        () => auditReport?.findings.filter((finding) => finding.severity === 'warning') ?? [],
        [auditReport]
    );
    const warningFixActions = useMemo(
        () => auditReport
            ? buildSupportedWarningFixActions(variantMeta, auditReport.findings)
                .filter((action) => !disabledWarningFixKeys.includes(action.key))
            : [],
        [auditReport, disabledWarningFixKeys, variantMeta]
    );
    const warningFixGroups = useMemo(
        () => auditReport
            ? materializeWarningFixGroups(variantMeta, auditReport.findings, disabledWarningFixKeys, warningFixActions[0]?.key ?? null)
            : [],
        [auditReport, disabledWarningFixKeys, variantMeta, warningFixActions]
    );
    const nextWarningFixAction = warningFixActions[0] ?? null;
    const warningFindingCount = warningFindings.length;
    const warningFixStepCount = warningFixActions.length;
    const syncSummary = useMemo(() => summarizeVariantSyncDiff(variantMeta), [variantMeta]);
    const effectiveBuildStatus = variantMeta.buildStatus ?? 'not_built';
    const effectiveSyncStatus = variantMeta.syncStatus ?? 'in_sync';
    const buildStatusConf = BUILD_STATUS_CONFIG[effectiveBuildStatus];
    const syncStatusConf = SYNC_STATUS_CONFIG[effectiveSyncStatus];
    const isVisionVariant = isVisionVariantEntry(variantMeta);
    const effectiveVisionStatus = resolveVisionPackageStatus(variantMeta);
    const visionStatusConf = effectiveVisionStatus ? VISION_STATUS_CONFIG[effectiveVisionStatus] : null;
    const effectiveVisionPackageId = isVisionVariant ? (variantMeta.visionPackageId ?? resolveDefaultVisionPackageId(variantMeta)) : null;
    const editableVisionRuntimePlan = useMemo(
        () => (isVisionVariant ? buildEditableVisionRuntimePlan(variantMeta, effectiveVisionPackageId) : null),
        [effectiveVisionPackageId, isVisionVariant, variantMeta]
    );
    const visionPackagePreview = isVisionVariant && effectiveVisionPackageId
        ? buildVisionRuntimePackageManifest(
            [{
                ...variantMeta,
                visionPackageId: effectiveVisionPackageId,
                visionPackageStatus: effectiveVisionStatus ?? 'spec_only',
            }],
            effectiveVisionPackageId,
            {
                preferredSurface: variantMeta.visionSurface,
                authoredRuntimePlan: variantMeta.visionRuntimePlan ?? editableVisionRuntimePlan,
            }
        )
        : null;
    const workspaceBusy = Boolean(workspaceActionLabel);

    useEffect(() => {
        const nextRawSpec = initialSpecRaw ?? variant.specRaw ?? '';
        const nextModuleDraft = normalizeModuleDraft(variant, variant.moduleDraft, 0);
        const normalizedNextRawSpec = normalizeSpecText(nextRawSpec);
        setVariantMeta(variant);
        setActiveTab(initialTab);
        setRawSpec(nextRawSpec);
        setParsed(nextRawSpec.trim() ? parseVariantSpec(nextRawSpec) : null);
        setConfigText(JSON.stringify(variant.runtimeConfig ?? buildDefaultRuntimeConfig(variant), null, 2));
        setConfigError(null);
        setAuditReport((current) => {
            if (
                current
                && normalizeSpecText(current.fixedRaw) === normalizedNextRawSpec
            ) {
                return current;
            }
            return nextRawSpec.trim() ? runSpecAuditPipeline(variant, nextRawSpec) : null;
        });
        setSpecGenerationLoading(false);
        setAiAuditLoading(false);
        setWarningFixFeedback(null);
        setDisabledWarningFixKeys([]);
        setShowDetailedFindings(false);
        setWorkspaceActionLabel(null);
        setWorkspaceActionError(null);
        setSpecCopied(false);
        setModuleDraft(nextModuleDraft);
        setBenefitsText((nextModuleDraft.benefits ?? []).join('\n'));
        setBestForText((nextModuleDraft.bestFor ?? []).join('\n'));
    }, [variant, initialSpecRaw, initialTab]);

    const loadTimeline = useCallback(async (variantId: string, cancelledRef?: { cancelled: boolean }) => {
        setHistoryLoading(true);
        try {
            const [entries, versionEntries] = await Promise.all([
                simVariantRegistryService.listHistory(variantId),
                simVariantRegistryService.listSpecVersions(variantId),
            ]);
            if (!cancelledRef?.cancelled) {
                setHistoryEntries(entries);
                setSpecVersions(versionEntries);
            }
        } catch (error) {
            console.error('Failed to load variant timeline:', error);
            if (!cancelledRef?.cancelled) {
                setHistoryEntries([]);
                setSpecVersions([]);
            }
        } finally {
            if (!cancelledRef?.cancelled) {
                setHistoryLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        const cancelledRef = { cancelled: false };
        loadTimeline(variant.id, cancelledRef);

        return () => {
            cancelledRef.cancelled = true;
        };
    }, [loadTimeline, variant.id, variant.updatedAt, variant.publishedAt, timelineRefreshToken]);

    const parseConfig = (value: string) => {
        setConfigText(value);
        try {
            JSON.parse(value);
            setConfigError(null);
        } catch (error: any) {
            setConfigError(error.message);
        }
    };

    const runAuditWithOptionalAi = useCallback(async (specRaw: string) => {
        const deterministicAudit = runSpecAuditPipeline(variantMeta, specRaw);
        let nextRawSpec = deterministicAudit.fixedRaw;
        let nextAudit = deterministicAudit;
        let aiReview: SpecAuditAiReview | null = null;
        let autoFixFeedback: WarningFixFeedback | null = null;

        setRawSpec(deterministicAudit.fixedRaw);
        setParsed(deterministicAudit.fixedRaw.trim() ? parseVariantSpec(deterministicAudit.fixedRaw) : null);
        setAuditReport(deterministicAudit);
        setWarningFixFeedback(null);
        setDisabledWarningFixKeys([]);
        setShowDetailedFindings(false);

        try {
            setAiAuditLoading(true);
            const aiAudit = await requestAiVariantSpecAudit(variantMeta, deterministicAudit.fixedRaw, deterministicAudit.findings);
            const suggestedSpecRaw = normalizeSpecText(aiAudit.suggestedSpecRaw || deterministicAudit.fixedRaw);
            const shouldApplyAiSpec = Boolean(suggestedSpecRaw.trim()) && suggestedSpecRaw !== normalizeSpecText(deterministicAudit.fixedRaw);
            const validatedAudit = runSpecAuditPipeline(variantMeta, shouldApplyAiSpec ? suggestedSpecRaw : deterministicAudit.fixedRaw);

            nextRawSpec = validatedAudit.fixedRaw;
            aiReview = {
                model: aiAudit.model,
                summary: aiAudit.summary,
                findings: aiAudit.findings ?? [],
                applied: shouldApplyAiSpec,
            };
            nextAudit = mergeAuditReportWithAiReview(validatedAudit, aiReview);

            const warningCountBeforeAutoFix = nextAudit.findings.filter((finding) => finding.severity === 'warning').length;
            const autoApplied = autoApplySupportedAuditFixes(variantMeta, nextRawSpec, nextAudit);
            if (autoApplied.appliedLabels.length > 0) {
                nextRawSpec = autoApplied.raw;
                nextAudit = {
                    ...autoApplied.audit,
                    aiReview: {
                        ...aiReview,
                        applied: true,
                        summary: `${aiReview.summary} System auto-applied: ${autoApplied.appliedLabels.join(', ')}.`,
                    },
                };
                const remainingActions = buildSupportedWarningFixActions(variantMeta, nextAudit.findings);
                autoFixFeedback = {
                    label: autoApplied.appliedLabels.join(', '),
                    previousWarningCount: warningCountBeforeAutoFix,
                    currentWarningCount: nextAudit.findings.filter((finding) => finding.severity === 'warning').length,
                    remainingFixableSteps: remainingActions.length,
                    nextLabel: remainingActions[0]?.label ?? null,
                };
            }
        } catch (error: any) {
            aiReview = {
                model: 'unavailable',
                summary: 'AI gold-standard review was unavailable, so the registry rule set remained the source of truth for this pass.',
                findings: [],
                applied: false,
                unavailableReason: error?.message || 'Failed to reach the AI audit service.',
            };
            nextAudit = mergeAuditReportWithAiReview(deterministicAudit, aiReview);
        } finally {
            setAiAuditLoading(false);
        }

        const promotedAfterAudit = normalizeSpecText(promoteSpecReleaseMetadata(nextRawSpec, variantMeta, nextAudit));
        if (promotedAfterAudit !== nextRawSpec) {
            nextRawSpec = promotedAfterAudit;
            nextAudit = runSpecAuditPipeline(variantMeta, nextRawSpec);
        }

        const checklistAlignedAfterAudit = normalizeSpecText(syncReadinessChecklist(nextRawSpec, variantMeta));
        if (checklistAlignedAfterAudit !== nextRawSpec) {
            nextRawSpec = checklistAlignedAfterAudit;
            nextAudit = runSpecAuditPipeline(variantMeta, nextRawSpec);
        }

        const normalizedAiReview = normalizeAiReviewSummaryForFinalAudit(nextAudit.aiReview ?? aiReview, nextAudit, variantMeta);
        if (normalizedAiReview) {
            nextAudit = {
                ...nextAudit,
                aiReview: normalizedAiReview,
            };
        }

        setRawSpec(nextRawSpec);
        setParsed(nextRawSpec.trim() ? parseVariantSpec(nextRawSpec) : null);
        setAuditReport(nextAudit);
        setWarningFixFeedback(autoFixFeedback);
        return nextAudit;
    }, [variantMeta]);

    const handleGenerateSpec = async () => {
        setWorkspaceActionError(null);
        setSpecGenerationLoading(true);
        let generationFallbackReason: string | null = null;
        try {
            const seedSpec = buildGeneratedVariantSpec(variantMeta);
            let generated = seedSpec;

            try {
                const aiGeneration = await requestAiVariantSpecGeneration(variantMeta, seedSpec);
                const candidate = normalizeSpecText(aiGeneration.generatedSpecRaw || seedSpec);
                if (candidate.trim()) {
                    generated = candidate;
                }
            } catch (error: any) {
                generationFallbackReason = `AI draft generation via GPT-4.1 was unavailable, so the registry fell back to the local scaffold. ${error?.message || ''}`.trim();
            }

            await runAuditWithOptionalAi(generated);
            setActiveTab('spec');
            if (generationFallbackReason) {
                setWorkspaceActionError(generationFallbackReason);
            }
        } finally {
            setSpecGenerationLoading(false);
        }
    };

    const handleRunAudit = async () => {
        return runAuditWithOptionalAi(rawSpec);
    };

    const handleFixAuditWarnings = () => {
        if (!auditReport || warningFixActions.length === 0) {
            return;
        }
        const nextAction = warningFixActions[0];
        const previousWarningCount = warningFindings.length;
        const nextRawSpec = applyAuditWarningFixes(variantMeta, rawSpec, nextAction);
        if (normalizeSpecText(nextRawSpec) === normalizeSpecText(rawSpec)) {
            const nextDisabledWarningFixKeys = Array.from(new Set([...disabledWarningFixKeys, nextAction.key]));
            const remainingActions = buildSupportedWarningFixActions(variantMeta, auditReport.findings)
                .filter((action) => !nextDisabledWarningFixKeys.includes(action.key));
            setDisabledWarningFixKeys(nextDisabledWarningFixKeys);
            setWarningFixFeedback({
                label: nextAction.label,
                previousWarningCount,
                currentWarningCount: previousWarningCount,
                remainingFixableSteps: remainingActions.length,
                nextLabel: remainingActions[0]?.label ?? null,
                noEffectiveChange: true,
            });
            return;
        }
        const audit = runSpecAuditPipeline(variantMeta, nextRawSpec);
        const promotedRaw = normalizeSpecText(promoteSpecReleaseMetadata(audit.fixedRaw, variantMeta, audit));
        const promotedAudit = promotedRaw === audit.fixedRaw ? audit : runSpecAuditPipeline(variantMeta, promotedRaw);
        const checklistAlignedRaw = normalizeSpecText(syncReadinessChecklist(promotedRaw, variantMeta));
        const checklistAlignedAudit = checklistAlignedRaw === promotedRaw ? promotedAudit : runSpecAuditPipeline(variantMeta, checklistAlignedRaw);
        setRawSpec(checklistAlignedRaw);
        setParsed(checklistAlignedRaw.trim() ? parseVariantSpec(checklistAlignedRaw) : null);
        setAuditReport(checklistAlignedAudit);
        setDisabledWarningFixKeys([]);
        const remainingActions = buildSupportedWarningFixActions(variantMeta, checklistAlignedAudit.findings);
        setWarningFixFeedback({
            label: [
                nextAction.label,
                promotedRaw !== audit.fixedRaw ? 'Promote Spec Metadata' : null,
                checklistAlignedRaw !== promotedRaw ? 'Complete Published Checklist' : null,
            ].filter(Boolean).join(', '),
            previousWarningCount,
            currentWarningCount: checklistAlignedAudit.findings.filter((finding) => finding.severity === 'warning').length,
            remainingFixableSteps: remainingActions.length,
            nextLabel: remainingActions[0]?.label ?? null,
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

    const updateVisionRuntimePlan = (updater: (current: VisionRuntimeTrialPlanManifest) => VisionRuntimeTrialPlanManifest) => {
        if (!isVisionVariant) return;
        setVariantMeta((current) => {
            const packageId = current.visionPackageId ?? resolveDefaultVisionPackageId(current);
            const nextPlan = updater(buildEditableVisionRuntimePlan(current, packageId));
            return {
                ...current,
                visionRuntimePlan: nextPlan,
            };
        });
    };

    const updateResetBlock = (index: number, updater: (block: VisionRuntimeResetBlockManifest) => VisionRuntimeResetBlockManifest) => {
        updateVisionRuntimePlan((current) => ({
            ...current,
            resetBlocks: current.resetBlocks.map((block, blockIndex) => (blockIndex === index ? updater(block) : block)),
        }));
    };

    const updateSignalBlock = (index: number, updater: (block: VisionRuntimeSignalBlockManifest) => VisionRuntimeSignalBlockManifest) => {
        updateVisionRuntimePlan((current) => ({
            ...current,
            signalWindowBlocks: current.signalWindowBlocks.map((block, blockIndex) => (blockIndex === index ? updater(block) : block)),
        }));
    };

    const updateNoiseGateBlock = (index: number, updater: (block: VisionRuntimeNoiseGateBlockManifest) => VisionRuntimeNoiseGateBlockManifest) => {
        updateVisionRuntimePlan((current) => ({
            ...current,
            noiseGateBlocks: current.noiseGateBlocks.map((block, blockIndex) => (blockIndex === index ? updater(block) : block)),
        }));
    };

    const addResetBlock = () => {
        updateVisionRuntimePlan((current) => ({
            ...current,
            resetBlocks: [...current.resetBlocks, buildDefaultResetBlock()],
        }));
    };

    const removeResetBlock = (index: number) => {
        updateVisionRuntimePlan((current) => ({
            ...current,
            resetBlocks: current.resetBlocks.filter((_, blockIndex) => blockIndex !== index),
        }));
    };

    const addSignalBlock = () => {
        updateVisionRuntimePlan((current) => ({
            ...current,
            signalWindowBlocks: [...current.signalWindowBlocks, buildDefaultSignalBlock()],
        }));
    };

    const removeSignalBlock = (index: number) => {
        updateVisionRuntimePlan((current) => ({
            ...current,
            signalWindowBlocks: current.signalWindowBlocks.filter((_, blockIndex) => blockIndex !== index),
        }));
    };

    const addNoiseGateBlock = () => {
        updateVisionRuntimePlan((current) => ({
            ...current,
            noiseGateBlocks: [...current.noiseGateBlocks, buildDefaultNoiseGateBlock()],
        }));
    };

    const removeNoiseGateBlock = (index: number) => {
        updateVisionRuntimePlan((current) => ({
            ...current,
            noiseGateBlocks: current.noiseGateBlocks.filter((_, blockIndex) => blockIndex !== index),
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
                    : resolveWorkspaceSpecStatus(variantMeta, nextSpecRaw),
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
        setWorkspaceActionError(null);
        setWorkspaceActionLabel('Saving draft...');
        try {
            const next = buildNextRecord(rawSpec);
            if (!next) return;
            if (rawSpec.trim()) {
                setParsed(parseVariantSpec(rawSpec));
            }
            await onSave(next);
        } catch (error: any) {
            setWorkspaceActionError(error?.message || 'Failed to save draft.');
        } finally {
            setWorkspaceActionLabel(null);
        }
    };

    const prepareBuildRecord = async (raw: string) => {
        const next = buildNextRecord(raw);
        if (!next) return null;
        const nextWithAudio = await resolveVariantAudioAssets(next);
        return buildVariantRecordForBuild(nextWithAudio);
    };

    const getResolvedAuditForAction = async () => {
        const normalizedCurrentRaw = normalizeSpecText(rawSpec);
        if (
            auditReport
            && auditReport.status !== 'needs_input'
            && normalizeSpecText(auditReport.fixedRaw) === normalizedCurrentRaw
        ) {
            return auditReport;
        }
        return handleRunAudit();
    };

    const handleBuild = async () => {
        setWorkspaceActionError(null);
        setWorkspaceActionLabel('Auditing + compiling module...');
        try {
            const audit = await getResolvedAuditForAction();
            if (audit.status === 'needs_input') {
                setActiveTab('spec');
                return;
            }
            const builtRecord = await prepareBuildRecord(audit.fixedRaw);
            if (!builtRecord) return;
            setVariantMeta(builtRecord);
            await onBuild(builtRecord);
        } catch (error: any) {
            setWorkspaceActionError(error?.message || 'Failed to build module.');
        } finally {
            setWorkspaceActionLabel(null);
        }
    };

    const handlePublish = async () => {
        setWorkspaceActionError(null);
        setWorkspaceActionLabel('Auditing + compiling + publishing module...');
        try {
            const audit = await getResolvedAuditForAction();
            if (audit.status === 'needs_input') {
                setActiveTab('spec');
                return;
            }
            const publishStateVariant: SimVariantRecord = {
                ...variantMeta,
                buildStatus: 'published',
            };
            const publishStateSeedAudit = runSpecAuditPipeline(publishStateVariant, audit.fixedRaw);
            const publishStateAuto = autoApplySupportedAuditFixes(publishStateVariant, audit.fixedRaw, publishStateSeedAudit);
            const finalizedPublishState = finalizeSpecForVariantState(
                publishStateAuto.raw,
                publishStateVariant,
                publishStateAuto.audit,
            );

            setRawSpec(finalizedPublishState.raw);
            setParsed(finalizedPublishState.raw.trim() ? parseVariantSpec(finalizedPublishState.raw) : null);
            setAuditReport(finalizedPublishState.audit);

            if (publishStateAuto.audit.status === 'needs_input' || finalizedPublishState.audit.status === 'needs_input') {
                setActiveTab('spec');
                return;
            }

            if (publishStateAuto.appliedLabels.length > 0) {
                const beforeWarnings = audit.findings.filter((finding) => finding.severity === 'warning').length;
                const remainingActions = buildSupportedWarningFixActions(publishStateVariant, finalizedPublishState.audit.findings);
                setWarningFixFeedback({
                    label: publishStateAuto.appliedLabels.join(', '),
                    previousWarningCount: beforeWarnings,
                    currentWarningCount: finalizedPublishState.audit.findings.filter((finding) => finding.severity === 'warning').length,
                    remainingFixableSteps: remainingActions.length,
                    nextLabel: remainingActions[0]?.label ?? null,
                });
            }

            const builtRecord = await prepareBuildRecord(finalizedPublishState.raw);
            if (!builtRecord) return;
            setVariantMeta(builtRecord);
            await onPublish(builtRecord);
        } catch (error: any) {
            setWorkspaceActionError(error?.message || 'Failed to publish module.');
        } finally {
            setWorkspaceActionLabel(null);
        }
    };

    const handlePreviewBuild = async () => {
        setWorkspaceActionError(null);
        if (variantMeta.buildArtifact) {
            setWorkspaceActionLabel('Opening built module...');
            try {
                setPreviewModule(buildPublishedModule(variantMeta));
            } catch (error: any) {
                setWorkspaceActionError(error?.message || 'Failed to open built module preview.');
            } finally {
                setWorkspaceActionLabel(null);
            }
            return;
        }

        setWorkspaceActionLabel('Auditing + compiling preview...');
        try {
            const audit = await getResolvedAuditForAction();
            if (audit.status === 'needs_input') {
                setActiveTab('spec');
                return;
            }
            const builtRecord = await prepareBuildRecord(audit.fixedRaw);
            if (!builtRecord) return;
            setPreviewModule(buildPublishedModule(builtRecord));
        } catch (error: any) {
            setWorkspaceActionError(error?.message || 'Failed to prepare preview.');
        } finally {
            setWorkspaceActionLabel(null);
        }
    };

    const handlePreviewPublishedModule = async () => {
        if (!variantMeta.publishedModuleId) return;
        setWorkspaceActionError(null);
        setWorkspaceActionLabel('Fetching published module...');
        setLoadingPublishedPreview(true);
        try {
            const module = await simModuleLibraryService.getById(variantMeta.publishedModuleId);
            if (module) {
                setPreviewModule(module);
            }
        } catch (error: any) {
            console.error('Failed to load published module preview:', error);
            setWorkspaceActionError(error?.message || 'Failed to load published module.');
        } finally {
            setLoadingPublishedPreview(false);
            setWorkspaceActionLabel(null);
        }
    };

    const handleSaveVisionPackage = async (nextStatus?: SimVariantVisionStatus) => {
        if (!isVisionVariant) return;
        setWorkspaceActionError(null);
        setWorkspaceActionLabel('Saving Vision package state...');
        try {
            const audit = await getResolvedAuditForAction();
            if (audit.status === 'needs_input') {
                setActiveTab('spec');
                return;
            }
            const next = buildNextRecord(audit.fixedRaw);
            if (!next) return;
            const nextRecord = applyDraftSyncState({
                ...next,
                visionPackageStatus: nextStatus ?? resolveVisionPackageStatus(next) ?? 'spec_only',
                visionPackageId: next.visionPackageId?.trim() ? next.visionPackageId : resolveDefaultVisionPackageId(next),
                visionSurface: next.visionSurface?.trim() ? next.visionSurface : 'football_stadium',
                visionRuntimePlan: next.visionRuntimePlan ?? editableVisionRuntimePlan ?? undefined,
            });
            setVariantMeta(nextRecord);
            await simVariantRegistryService.saveVisionPackage(nextRecord);
        } catch (error: any) {
            setWorkspaceActionError(error?.message || 'Failed to save Vision package state.');
        } finally {
            setWorkspaceActionLabel(null);
        }
    };

    const handleCopySpec = async () => {
        if (!rawSpec.trim()) return;
        try {
            await navigator.clipboard.writeText(rawSpec);
            setSpecCopied(true);
            window.setTimeout(() => setSpecCopied(false), 1800);
        } catch (error) {
            console.error('Failed to copy spec:', error);
            setWorkspaceActionError('Failed to copy spec to clipboard.');
        }
    };

    const loadRecordIntoWorkspace = (record: SimVariantRecord, nextTab: 'general' | 'spec' = 'general') => {
        const snapshot = applyDraftSyncState(record);
        const nextRawSpec = snapshot.specRaw ?? '';
        const nextModuleDraft = normalizeModuleDraft(snapshot, snapshot.moduleDraft, 0);
        setVariantMeta(snapshot);
        setRawSpec(nextRawSpec);
        setParsed(nextRawSpec.trim() ? parseVariantSpec(nextRawSpec) : null);
        setAuditReport(nextRawSpec.trim() ? runSpecAuditPipeline(snapshot, nextRawSpec) : null);
        setWarningFixFeedback(null);
        setDisabledWarningFixKeys([]);
        setShowDetailedFindings(false);
        setConfigText(JSON.stringify(snapshot.runtimeConfig ?? buildDefaultRuntimeConfig(snapshot), null, 2));
        setConfigError(null);
        setModuleDraft(nextModuleDraft);
        setBenefitsText((nextModuleDraft.benefits ?? []).join('\n'));
        setBestForText((nextModuleDraft.bestFor ?? []).join('\n'));
        setActiveTab(nextTab);
    };

    const handleRestoreSnapshot = (entry: SimVariantHistoryEntry) => {
        setRestoringHistoryId(entry.id);
        loadRecordIntoWorkspace(entry.snapshot);
        setRestoringHistoryId(null);
    };

    const handleRollbackToSpecVersion = async (entry: SimVariantSpecVersionEntry) => {
        setRollingBackVersionId(entry.id);
        setWorkspaceActionError(null);
        setWorkspaceActionLabel('Rolling back to saved spec version...');
        try {
            const rolledBackRecord = await simVariantRegistryService.rollbackToSpecVersion(variantMeta.id, entry.id);
            loadRecordIntoWorkspace(rolledBackRecord, 'spec');
            onRollback(rolledBackRecord);
            setTimelineRefreshToken((current) => current + 1);
        } catch (error: any) {
            setWorkspaceActionError(error?.message || 'Failed to roll back to the saved spec version.');
        } finally {
            setWorkspaceActionLabel(null);
            setRollingBackVersionId(null);
        }
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
                                <p className="text-sm font-bold text-white">{displayVariantName(variantMeta.name)}</p>
                                <p className="text-[10px] text-zinc-500">
                                {displayFamilyName(variantMeta.family)} · Variant Workspace · {variantMeta.publishedModuleId ? `Published as ${variantMeta.publishedModuleId}` : 'Not yet published'}
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

                {(workspaceActionLabel || workspaceActionError) && (
                    <div className="px-5 pt-4 flex-shrink-0 space-y-2">
                        {workspaceActionLabel && (
                            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
                                <p className="text-xs font-semibold text-cyan-200 flex items-center gap-2">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    {workspaceActionLabel}
                                </p>
                                <p className="text-[11px] text-cyan-100/70 mt-1">
                                    The registry is working in the background. Please wait for the action to finish.
                                </p>
                            </div>
                        )}
                        {workspaceActionError && (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                                <p className="text-xs font-semibold text-red-200">Action failed</p>
                                <p className="text-[11px] text-red-100/80 mt-1">{workspaceActionError}</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {activeTab === 'general' && (
                        <div className="space-y-5">
                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                                <p className="text-xs text-blue-300 leading-relaxed">
                                    This is the canonical variant metadata. Edit it here so the spec, runtime config, and published module all stay aligned to one registry record.
                                </p>
                            </div>
                            {isVisionVariant && (
                                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
                                    <p className="text-xs text-cyan-300 leading-relaxed">
                                        Vision variants use the same spec workflow as app and web sims, but after the spec stage they branch into a Vision package track instead of ending only at <span className="font-mono">sim-modules</span>.
                                    </p>
                                </div>
                            )}
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
                                        {SPEC_STATUS_CONFIG[resolveWorkspaceSpecStatus(variantMeta, rawSpec)].label}
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
                                {isVisionVariant && (
                                    <>
                                        <div>
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Vision Package Status</label>
                                            <select
                                                value={effectiveVisionStatus ?? 'spec_only'}
                                                onChange={(event) => setVariantMeta((current) => ({
                                                    ...current,
                                                    visionPackageStatus: event.target.value as SimVariantVisionStatus,
                                                }))}
                                                className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                            >
                                                {Object.entries(VISION_STATUS_CONFIG).map(([value, config]) => (
                                                    <option key={value} value={value}>{config.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Vision Surface</label>
                                            <input
                                                value={variantMeta.visionSurface ?? 'football_stadium'}
                                                onChange={(event) => setVariantMeta((current) => ({ ...current, visionSurface: event.target.value }))}
                                                className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Vision Package Id</label>
                                            <input
                                                value={variantMeta.visionPackageId ?? resolveDefaultVisionPackageId(variantMeta)}
                                                onChange={(event) => setVariantMeta((current) => ({ ...current, visionPackageId: event.target.value }))}
                                                className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500 font-mono"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Vision Validation Notes</label>
                                            <textarea
                                                value={variantMeta.visionValidationNotes ?? ''}
                                                onChange={(event) => setVariantMeta((current) => ({ ...current, visionValidationNotes: event.target.value }))}
                                                className="w-full min-h-[96px] rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500 resize-y"
                                            />
                                        </div>
                                        {editableVisionRuntimePlan && (
                                            <div className="md:col-span-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-4">
                                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Vision Runtime Plan</p>
                                                        <p className="text-sm text-white mt-1">Author the immersive package flow here so the headset runtime reads this plan instead of only falling back to the default football template.</p>
                                                        <p className="text-[11px] text-cyan-100/70 mt-1">This is package-level structure: session cap, controlled break, reset blocks, noise gate blocks, and signal window blocks.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setVariantMeta((current) => ({
                                                            ...current,
                                                            visionRuntimePlan: buildDefaultVisionRuntimePlan(current.visionPackageId ?? resolveDefaultVisionPackageId(current))
                                                                ?? EMPTY_VISION_RUNTIME_PLAN,
                                                        }))}
                                                        className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/15 transition-colors"
                                                    >
                                                        Load Package Default
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Controlled Break (Seconds)</label>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step="1"
                                                            value={editableVisionRuntimePlan.controlledBreakSeconds}
                                                            onChange={(event) => updateVisionRuntimePlan((current) => ({
                                                                ...current,
                                                                controlledBreakSeconds: Number(event.target.value || 0),
                                                            }))}
                                                            className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Session Cap (Seconds)</label>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step="1"
                                                            value={editableVisionRuntimePlan.totalSessionCapSeconds}
                                                            onChange={(event) => updateVisionRuntimePlan((current) => ({
                                                                ...current,
                                                                totalSessionCapSeconds: Number(event.target.value || 0),
                                                            }))}
                                                            className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className="text-xs font-semibold text-white">Reset Blocks</p>
                                                                <p className="text-[11px] text-zinc-500 mt-1">{editableVisionRuntimePlan.resetBlocks.length} authored blocks in the reset sequence.</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={addResetBlock}
                                                                className="rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-zinc-500 transition-colors"
                                                            >
                                                                Add Reset Block
                                                            </button>
                                                        </div>
                                                        <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                                                            {editableVisionRuntimePlan.resetBlocks.map((block, index) => (
                                                                <div key={`reset-${index}`} className="rounded-xl border border-zinc-800 bg-black/20 p-3 space-y-3">
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Reset Block {index + 1}</p>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeResetBlock(index)}
                                                                            className="rounded-md border border-red-500/20 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/15 transition-colors"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Disruption Label</label>
                                                                        <input
                                                                            value={block.disruptionLabel}
                                                                            onChange={(event) => updateResetBlock(index, (current) => ({ ...current, disruptionLabel: event.target.value }))}
                                                                            className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Pressure Tags</label>
                                                                        <input
                                                                            value={block.pressureTags.join(', ')}
                                                                            onChange={(event) => updateResetBlock(index, (current) => ({ ...current, pressureTags: parseCommaTags(event.target.value) }))}
                                                                            className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                                                        />
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Lock In</label>
                                                                            <input type="number" step="0.1" min={0} value={block.lockInSeconds} onChange={(event) => updateResetBlock(index, (current) => ({ ...current, lockInSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Disruption</label>
                                                                            <input type="number" step="0.1" min={0} value={block.disruptionSeconds} onChange={(event) => updateResetBlock(index, (current) => ({ ...current, disruptionSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Response Window</label>
                                                                            <input type="number" step="0.1" min={0} value={block.responseWindowSeconds} onChange={(event) => updateResetBlock(index, (current) => ({ ...current, responseWindowSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Gap</label>
                                                                            <input type="number" step="0.1" min={0} value={block.interBlockGapSeconds} onChange={(event) => updateResetBlock(index, (current) => ({ ...current, interBlockGapSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className="text-xs font-semibold text-white">Noise Gate Blocks</p>
                                                                <p className="text-[11px] text-zinc-500 mt-1">{editableVisionRuntimePlan.noiseGateBlocks.length} authored blocks in the distractor-filter sequence.</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={addNoiseGateBlock}
                                                                className="rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-zinc-500 transition-colors"
                                                            >
                                                                Add Noise Gate Block
                                                            </button>
                                                        </div>
                                                        <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                                                            {editableVisionRuntimePlan.noiseGateBlocks.map((block, index) => (
                                                                <div key={`noise-${index}`} className="rounded-xl border border-zinc-800 bg-black/20 p-3 space-y-3">
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Noise Gate Block {index + 1}</p>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeNoiseGateBlock(index)}
                                                                            className="rounded-md border border-red-500/20 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/15 transition-colors"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Target Choice</label>
                                                                            <select value={block.targetChoice} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, targetChoice: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500">
                                                                                <option value="left">Left</option>
                                                                                <option value="center">Center</option>
                                                                                <option value="right">Right</option>
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Distractor Choice</label>
                                                                            <select value={block.distractorChoice} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, distractorChoice: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500">
                                                                                <option value="left">Left</option>
                                                                                <option value="center">Center</option>
                                                                                <option value="right">Right</option>
                                                                            </select>
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Noise Label</label>
                                                                        <input
                                                                            value={block.noiseLabel}
                                                                            onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, noiseLabel: event.target.value }))}
                                                                            className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Pressure Tags</label>
                                                                        <input
                                                                            value={block.pressureTags.join(', ')}
                                                                            onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, pressureTags: parseCommaTags(event.target.value) }))}
                                                                            className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                                                        />
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Noise Intensity</label>
                                                                            <input type="number" step="0.1" min={0} max={1} value={block.noiseIntensity} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, noiseIntensity: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Ready</label>
                                                                            <input type="number" step="0.1" min={0} value={block.readySeconds} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, readySeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Exposure</label>
                                                                            <input type="number" step="0.1" min={0} value={block.exposureSeconds} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, exposureSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Response Window</label>
                                                                            <input type="number" step="0.1" min={0} value={block.responseWindowSeconds} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, responseWindowSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                                        </div>
                                                                        <div className="col-span-2">
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Gap</label>
                                                                            <input type="number" step="0.1" min={0} value={block.interBlockGapSeconds} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, interBlockGapSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className="text-xs font-semibold text-white">Signal Window Blocks</p>
                                                                <p className="text-[11px] text-zinc-500 mt-1">{editableVisionRuntimePlan.signalWindowBlocks.length} authored blocks in the cue-read sequence.</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={addSignalBlock}
                                                                className="rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-zinc-500 transition-colors"
                                                            >
                                                                Add Signal Block
                                                            </button>
                                                        </div>
                                                        <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                                                            {editableVisionRuntimePlan.signalWindowBlocks.map((block, index) => (
                                                                <div key={`signal-${index}`} className="rounded-xl border border-zinc-800 bg-black/20 p-3 space-y-3">
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Signal Block {index + 1}</p>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeSignalBlock(index)}
                                                                            className="rounded-md border border-red-500/20 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/15 transition-colors"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Correct Choice</label>
                                                                            <select value={block.correctChoice} onChange={(event) => updateSignalBlock(index, (current) => ({ ...current, correctChoice: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500">
                                                                                <option value="left">Left</option>
                                                                                <option value="center">Center</option>
                                                                                <option value="right">Right</option>
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Decoy Choice</label>
                                                                            <select value={block.decoyChoice} onChange={(event) => updateSignalBlock(index, (current) => ({ ...current, decoyChoice: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500">
                                                                                <option value="left">Left</option>
                                                                                <option value="center">Center</option>
                                                                                <option value="right">Right</option>
                                                                            </select>
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Pressure Tags</label>
                                                                        <input
                                                                            value={block.pressureTags.join(', ')}
                                                                            onChange={(event) => updateSignalBlock(index, (current) => ({ ...current, pressureTags: parseCommaTags(event.target.value) }))}
                                                                            className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"
                                                                        />
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Cue Window</label>
                                                                            <input type="number" step="0.1" min={0} value={block.cueWindowSeconds} onChange={(event) => updateSignalBlock(index, (current) => ({ ...current, cueWindowSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Ready</label>
                                                                            <input type="number" step="0.1" min={0} value={block.readySeconds} onChange={(event) => updateSignalBlock(index, (current) => ({ ...current, readySeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Response Window</label>
                                                                            <input type="number" step="0.1" min={0} value={block.responseWindowSeconds} onChange={(event) => updateSignalBlock(index, (current) => ({ ...current, responseWindowSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Gap</label>
                                                                            <input type="number" step="0.1" min={0} value={block.interBlockGapSeconds} onChange={(event) => updateSignalBlock(index, (current) => ({ ...current, interBlockGapSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
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
                                        onClick={() => void handleGenerateSpec()}
                                        disabled={aiAuditLoading || specGenerationLoading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/15 transition-colors disabled:opacity-40"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        {specGenerationLoading ? 'Generating...' : 'Generate Draft'}
                                    </button>
                                </div>
                                <div className="relative">
                                    <button
                                        onClick={handleCopySpec}
                                        disabled={!rawSpec.trim()}
                                        className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900/90 border border-zinc-700 text-zinc-200 hover:border-zinc-500 disabled:opacity-40 transition-colors"
                                    >
                                        <ClipboardPaste className="w-3.5 h-3.5" />
                                        {specCopied ? 'Copied' : 'Copy'}
                                    </button>
                                    <textarea
                                        value={rawSpec}
                                        onChange={(event) => {
                                            setRawSpec(event.target.value);
                                            setAuditReport(null);
                                            setAiAuditLoading(false);
                                            setWarningFixFeedback(null);
                                            setDisabledWarningFixKeys([]);
                                            setSpecCopied(false);
                                        }}
                                        placeholder="Paste or author the full variant spec here..."
                                        className="w-full min-h-[420px] rounded-xl bg-black/40 border border-zinc-700 text-xs text-zinc-300 placeholder-zinc-600 p-4 pr-24 focus:outline-none focus:border-zinc-500 transition-colors resize-y font-mono leading-relaxed"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Formatted Preview</p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => rawSpec.trim() && void handleRunAudit()}
                                            disabled={!rawSpec.trim() || aiAuditLoading || specGenerationLoading}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/15 transition-colors disabled:opacity-40"
                                        >
                                            <ListChecks className="w-3.5 h-3.5" />
                                            {aiAuditLoading ? 'Auditing...' : 'Audit + Fix'}
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
                                                {auditReport.aiReview && (
                                                    <p className="text-[10px] text-zinc-500 mt-1">
                                                        AI review: {auditReport.aiReview.model}
                                                        {auditReport.aiReview.applied ? ' · upgrade applied' : ' · no AI rewrite applied'}
                                                        {auditReport.aiReview.unavailableReason ? ' · unavailable' : ''}
                                                    </p>
                                                )}
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
                                                    {warningFixFeedback.noEffectiveChange
                                                        ? <>No effective change from <span className="font-semibold">{warningFixFeedback.label}</span>. Warnings remain {warningFixFeedback.currentWarningCount}.</>
                                                        : <>Applied <span className="font-semibold">{warningFixFeedback.label}</span>. Warnings: {warningFixFeedback.previousWarningCount} → {warningFixFeedback.currentWarningCount}</>}
                                                    {warningFixFeedback.remainingFixableSteps > 0
                                                        ? ` · ${warningFixFeedback.remainingFixableSteps} fixable step${warningFixFeedback.remainingFixableSteps === 1 ? '' : 's'} remaining`
                                                        : ' · no supported auto-fix steps remaining'}
                                                    {warningFixFeedback.nextLabel
                                                        ? ` · Next: ${warningFixFeedback.nextLabel}`
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
                                        {auditReport.aiReview && (
                                            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300 mb-1.5">AI Review</p>
                                                <p className="text-[11px] text-cyan-100 leading-relaxed">{displayCopy(auditReport.aiReview.summary)}</p>
                                                {auditReport.aiReview.unavailableReason && (
                                                    <p className="text-[11px] text-cyan-200/80 mt-2">{displayCopy(auditReport.aiReview.unavailableReason)}</p>
                                                )}
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
                                                        const isNext = group.state === 'next';
                                                        const isFixable = group.state === 'next' || group.state === 'fixable';
                                                        return (
                                                            <div
                                                                key={`${group.key}-${index}`}
                                                                className={`rounded-lg border px-3 py-2 ${
                                                                    isFixable
                                                                        ? isNext
                                                                            ? 'border-amber-500/30 bg-amber-500/10'
                                                                            : 'border-zinc-800 bg-black/20'
                                                                        : group.state === 'exhausted'
                                                                            ? 'border-blue-500/20 bg-blue-500/5'
                                                                            : 'border-zinc-800 bg-black/20'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${
                                                                        isFixable
                                                                            ? isNext
                                                                                ? 'text-amber-300'
                                                                                : 'text-zinc-300'
                                                                            : group.state === 'exhausted'
                                                                                ? 'text-blue-300'
                                                                                : 'text-zinc-400'
                                                                    }`}>
                                                                        {group.label}
                                                                    </p>
                                                                    <span className="text-[10px] text-zinc-500">
                                                                        {group.findings.length} finding{group.findings.length === 1 ? '' : 's'}
                                                                        {group.state === 'next'
                                                                            ? ' · next step'
                                                                            : group.state === 'fixable'
                                                                                ? ' · fixable'
                                                                                : group.state === 'exhausted'
                                                                                    ? ' · no effective auto-fix'
                                                                                    : ' · manual'}
                                                                    </span>
                                                                </div>
                                                                <div className="mt-2 space-y-1">
                                                                    {group.findings.map((finding, findingIndex) => (
                                                                        <p key={`${group.key}-${finding.code}-${findingIndex}`} className="text-[11px] text-zinc-300">
                                                                            - {displayCopy(finding.message)}
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
                                                                <p className="text-[11px] text-zinc-300 mt-1">{displayCopy(finding.message)}</p>
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
                                    {isVisionVariant
                                        ? 'Vision variants still use the shared spec and runtime-config workflow, but their downstream path also needs a Vision package state. Treat sim-modules as the app/web artifact and the Vision package track as the headset-runtime artifact.'
                                        : 'Publish now compiles a playable build artifact first, then writes the derived `sim-module`. The registry stays canonical; the module is runtime output.'}
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

                            {isVisionVariant && visionStatusConf && (
                                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Vision Package Track</p>
                                            <p className="text-sm text-white mt-1">
                                                Current immersive pipeline status: <span style={{ color: visionStatusConf.color }} className="font-semibold">{visionStatusConf.label}</span>
                                            </p>
                                            <p className="text-[11px] text-cyan-100/70 mt-1">
                                                Package id: <span className="font-mono">{effectiveVisionPackageId}</span>
                                                {visionPackagePreview && (
                                                    <>
                                                        <br />
                                                        Runtime manifest target: <span className="font-mono">vision-runtime-packages/{visionPackagePreview.packageId}</span>
                                                        <br />
                                                        Package metadata: <span className="font-mono">{visionPackagePreview.environmentVersion}</span> / <span className="font-mono">{visionPackagePreview.trialPackageVersion}</span>
                                                        {visionPackagePreview.runtimePlan && (
                                                            <>
                                                                <br />
                                                                Runtime plan: <span className="font-mono">{visionPackagePreview.runtimePlan.resetBlocks.length}</span> reset blocks / <span className="font-mono">{visionPackagePreview.runtimePlan.noiseGateBlocks.length}</span> noise gate blocks / <span className="font-mono">{visionPackagePreview.runtimePlan.signalWindowBlocks.length}</span> signal blocks / <span className="font-mono">{visionPackagePreview.runtimePlan.controlledBreakSeconds}s</span> controlled break
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleSaveVisionPackage()}
                                            disabled={saving || !!configError || workspaceBusy}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/15 disabled:opacity-40 transition-colors"
                                        >
                                            <Save className="w-3.5 h-3.5" />
                                            Save Vision State
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {(Object.entries(VISION_STATUS_CONFIG) as Array<[SimVariantVisionStatus, { label: string; color: string }]>).map(([status, config]) => (
                                            <button
                                                key={status}
                                                onClick={() => handleSaveVisionPackage(status)}
                                                disabled={workspaceBusy}
                                                className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                                                    effectiveVisionStatus === status
                                                        ? 'border-cyan-400/40 bg-cyan-500/10'
                                                        : 'border-zinc-800 bg-black/20 hover:border-zinc-600'
                                                } disabled:opacity-40`}
                                            >
                                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: config.color }}>{config.label}</p>
                                                <p className="text-[11px] text-zinc-500 mt-1">
                                                    {status === 'spec_only' && 'Spec exists, but not yet mapped into the Vision runtime.'}
                                                    {status === 'runtime_mapped' && 'The spec has a real runtime target in the immersive package manifest.'}
                                                    {status === 'in_package' && 'This variant is bundled into a named immersive package.'}
                                                    {status === 'validated' && 'The runtime package has passed live validation or pilot checks.'}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

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
                                            disabled={!!configError || workspaceBusy}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/15 disabled:opacity-40 transition-colors"
                                        >
                                            <Gamepad2 className="w-3.5 h-3.5" />
                                            {variantMeta.buildArtifact ? 'Preview Built Module' : 'Build + Preview'}
                                        </button>
                                        {variantMeta.publishedModuleId && (
                                            <button
                                                onClick={handlePreviewPublishedModule}
                                                disabled={loadingPublishedPreview || workspaceBusy}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-40 transition-colors"
                                            >
                                                <Play className="w-3.5 h-3.5" />
                                                {loadingPublishedPreview ? 'Loading Live Module...' : 'Play Published Module'}
                                            </button>
                                        )}
                                        <button
                                            onClick={handleBuild}
                                            disabled={building || !!configError || workspaceBusy}
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
                                            disabled={publishing || !!configError || workspaceBusy}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#E0FE10] text-black hover:bg-[#c8e40e] disabled:opacity-40 transition-colors"
                                        >
                                            <Upload className="w-3.5 h-3.5" />
                                            {publishing
                                                ? 'Publishing...'
                                                : variantMeta.publishedModuleId && syncSummary.hasPublishedSnapshot
                                                    ? 'Save + Rebuild + Republish'
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
                                    Every save, publish, and rollback writes both a workspace snapshot and a spec version to Firestore. Use spec rollback to restore the canonical draft on the variant record, or load any older snapshot into the workspace if you want to inspect it before deciding.
                                </p>
                            </div>

                            {historyLoading ? (
                                <div className="min-h-[280px] flex items-center justify-center rounded-xl border border-zinc-800 bg-black/20">
                                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Loading version history...
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-white">Spec Versions</p>
                                                <p className="text-[11px] text-zinc-500">Rollback writes directly to the registry record and leaves the live published module untouched until you rebuild or republish.</p>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                                                {specVersions.length} version{specVersions.length === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                        {specVersions.length === 0 ? (
                                            <div className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-6 text-sm text-zinc-500">
                                                No spec versions captured yet for this variant.
                                            </div>
                                        ) : (
                                            specVersions.map((entry) => (
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
                                                            <p className="text-[11px] text-zinc-500 font-mono">
                                                                {entry.sourceFingerprint}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRollbackToSpecVersion(entry)}
                                                            disabled={rollingBackVersionId === entry.id}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#E0FE10]/10 border border-[#E0FE10]/20 text-[#E0FE10] hover:bg-[#E0FE10]/15 disabled:opacity-50 transition-colors"
                                                        >
                                                            <RefreshCw className={`w-3.5 h-3.5 ${rollingBackVersionId === entry.id ? 'animate-spin' : ''}`} />
                                                            {rollingBackVersionId === entry.id ? 'Rolling Back...' : 'Rollback Draft'}
                                                        </button>
                                                    </div>
                                                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Spec Preview</p>
                                                        <p className="text-xs text-zinc-300 mt-1 line-clamp-3 whitespace-pre-wrap">
                                                            {entry.snapshot.specRaw?.trim() || 'No saved spec text on this version.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-white">Workspace Snapshots</p>
                                                <p className="text-[11px] text-zinc-500">Load a past snapshot into the editor without changing the saved registry record until you explicitly save again.</p>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                                                {historyEntries.length} snapshot{historyEntries.length === 1 ? '' : 's'}
                                            </span>
                                        </div>

                                        {historyEntries.length === 0 ? (
                                            <div className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-6 text-sm text-zinc-500">
                                                No history entries yet for this variant.
                                            </div>
                                        ) : (
                                            historyEntries.map((entry) => {
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
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800 bg-black/20 flex-shrink-0">
                    <div className="text-[10px] text-zinc-500">
                        {isVisionVariant
                            ? `Vision package status: ${visionStatusConf?.label ?? 'Spec Only'}${variantMeta.visionPublishedAt ? ` · updated ${new Date(variantMeta.visionPublishedAt).toLocaleString()}` : ''}`
                            : variantMeta.publishedAt
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
                            disabled={saving || !!configError || workspaceBusy}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-800 border border-zinc-700 text-white hover:border-zinc-500 disabled:opacity-40 transition-colors"
                        >
                            <Save className="w-3.5 h-3.5" />
                            {saving ? 'Saving...' : variantMeta.publishedModuleId && effectiveSyncStatus !== 'in_sync' ? 'Save Draft Only' : 'Save Draft'}
                        </button>
                        <button
                            onClick={handleBuild}
                            disabled={building || !!configError || workspaceBusy}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/15 disabled:opacity-40 transition-colors"
                        >
                            <FileCode2 className="w-3.5 h-3.5" />
                            {building ? 'Building...' : variantMeta.publishedModuleId ? 'Save + Rebuild Module' : 'Build Module'}
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={publishing || !!configError || workspaceBusy}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#E0FE10] text-black hover:bg-[#c8e40e] disabled:opacity-40 transition-colors"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            {publishing ? 'Publishing...' : variantMeta.publishedModuleId ? 'Save + Rebuild + Republish' : 'Publish Built Module'}
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
    inlineGenerationStates,
}: {
    familyName: string;
    familyStatus: FamilyStatus;
    variants: SimVariantRecord[];
    familyColor: string;
    onOpenWorkspace: (variant: SimVariantRecord, options?: { initialTab?: 'general' | 'locks' | 'spec' | 'config' | 'publish' | 'history'; initialSpecRaw?: string }) => void;
    onPasteSpec: (variant: SimVariantRecord) => void;
    onGenerateSpec: (variant: SimVariantRecord) => void;
    inlineGenerationStates: Record<string, InlineGenerationJobState>;
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
                                        <span className="text-sm font-bold text-white">{displayFamilyName(familyName)}</span>
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
                            title={`${displayVariantName(v.name)}: ${SPEC_STATUS_CONFIG[v.specStatus].label}`}
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
                                const visionStatus = resolveVisionPackageStatus(v);
                                const visionStatusConf = visionStatus ? VISION_STATUS_CONFIG[visionStatus] : null;
                                const generationState = inlineGenerationStates[v.id] ?? null;
                                const generationBusy = generationState?.status === 'queued'
                                    || generationState?.status === 'generating'
                                    || generationState?.status === 'auditing'
                                    || generationState?.status === 'saving'
                                    || generationState?.status === 'publishing';
                                return (
                                    <div
                                        key={v.name}
                                        className="grid grid-cols-[1fr_120px_130px_96px_110px_112px] gap-2 px-5 py-2 border-t border-zinc-800/50 hover:bg-white/[0.02] transition-colors items-center"
                                    >
                                        <span className="text-xs text-zinc-300 truncate">{displayVariantName(v.name)}</span>
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
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: buildConf.color }} />
                                                    <span className="text-[10px] font-semibold" style={{ color: buildConf.color }}>{buildConf.label}</span>
                                                </div>
                                                {visionStatusConf && (
                                                    <div className="text-[9px] font-semibold" style={{ color: visionStatusConf.color }}>
                                                        {visionStatusConf.label}
                                                    </div>
                                                )}
                                            </div>
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
                                                disabled={generationBusy}
                                                title={generationState?.message || 'Queue variant spec generation'}
                                                className={`flex items-center justify-center w-7 h-7 rounded-lg border bg-black/20 transition-all group ${
                                                    generationState?.status === 'published'
                                                        ? 'border-emerald-500/50 bg-emerald-500/10'
                                                        : generationState?.status === 'saved_for_review'
                                                            ? 'border-amber-500/50 bg-amber-500/10'
                                                            : generationState?.status === 'error'
                                                                ? 'border-red-500/50 bg-red-500/10'
                                                                : generationBusy
                                                                    ? 'border-cyan-500/50 bg-cyan-500/10 cursor-wait'
                                                                    : 'border-zinc-700 hover:border-emerald-500/60 hover:bg-emerald-500/10'
                                                } disabled:opacity-100`}
                                            >
                                                {generationState?.status === 'published' ? (
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                ) : generationState?.status === 'saved_for_review' ? (
                                                    <Save className="w-3.5 h-3.5 text-amber-400" />
                                                ) : generationState?.status === 'error' ? (
                                                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                                ) : generationBusy ? (
                                                    generationState?.status === 'queued' ? (
                                                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                                                    ) : (
                                                        <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                                                    )
                                                ) : (
                                                    <Sparkles className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                                                )}
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

type InlineGenerationJobStatus =
    | 'queued'
    | 'generating'
    | 'auditing'
    | 'saving'
    | 'publishing'
    | 'published'
    | 'saved_for_review'
    | 'error';

interface InlineGenerationJobState {
    status: InlineGenerationJobStatus;
    message: string;
    updatedAt: number;
}

const INLINE_GENERATION_RESULT_TTL_MS = 2 * 60 * 1000;

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

function VisionPackageWorkspaceModal({
    packageRecord,
    variants,
    saving,
    onClose,
    onSave,
}: {
    packageRecord: VisionRuntimePackageRecord;
    variants: SimVariantRecord[];
    saving: boolean;
    onClose: () => void;
    onSave: (record: VisionRuntimePackageRecord) => Promise<void>;
}) {
    const [draft, setDraft] = useState<VisionRuntimePackageRecord>(packageRecord);

    useEffect(() => {
        setDraft(packageRecord);
    }, [packageRecord]);

    const updateResetBlock = (index: number, updater: (block: VisionRuntimeResetBlockManifest) => VisionRuntimeResetBlockManifest) => {
        setDraft((current) => ({
            ...current,
            runtimePlan: current.runtimePlan ? {
                ...current.runtimePlan,
                resetBlocks: current.runtimePlan.resetBlocks.map((block, blockIndex) => (blockIndex === index ? updater(block) : block)),
            } : current.runtimePlan,
        }));
    };

    const updateSignalBlock = (index: number, updater: (block: VisionRuntimeSignalBlockManifest) => VisionRuntimeSignalBlockManifest) => {
        setDraft((current) => ({
            ...current,
            runtimePlan: current.runtimePlan ? {
                ...current.runtimePlan,
                signalWindowBlocks: current.runtimePlan.signalWindowBlocks.map((block, blockIndex) => (blockIndex === index ? updater(block) : block)),
            } : current.runtimePlan,
        }));
    };

    const updateNoiseGateBlock = (index: number, updater: (block: VisionRuntimeNoiseGateBlockManifest) => VisionRuntimeNoiseGateBlockManifest) => {
        setDraft((current) => ({
            ...current,
            runtimePlan: current.runtimePlan ? {
                ...current.runtimePlan,
                noiseGateBlocks: current.runtimePlan.noiseGateBlocks.map((block, blockIndex) => (blockIndex === index ? updater(block) : block)),
            } : current.runtimePlan,
        }));
    };

    const toggleVariant = (variantId: string) => {
        setDraft((current) => {
            const included = current.includedVariantIds.includes(variantId)
                ? current.includedVariantIds.filter((id) => id !== variantId)
                : [...current.includedVariantIds, variantId];
            return {
                ...current,
                includedVariantIds: included,
            };
        });
    };

    const packageVariants = variants.filter((variant) => draft.includedVariantIds.includes(variant.id));

    return (
        <motion.div
            className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#060b14] shadow-2xl flex flex-col"
            >
                <div className="px-6 py-5 border-b border-zinc-800 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Vision Package</p>
                        <h3 className="text-2xl font-semibold text-white mt-1">{draft.packageName}</h3>
                        <p className="text-sm text-zinc-400 mt-2">Edit the immersive runtime package directly: metadata, included variants, and the authored block plan the headset will run.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl border border-zinc-700 bg-black/30 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors flex items-center justify-center"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Package Name</label>
                            <input value={draft.packageName} onChange={(event) => setDraft((current) => ({ ...current, packageName: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Surface</label>
                            <input value={draft.surface} onChange={(event) => setDraft((current) => ({ ...current, surface: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Package Status</label>
                            <select value={draft.packageStatus} onChange={(event) => setDraft((current) => ({ ...current, packageStatus: event.target.value as SimVariantVisionStatus }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500">
                                {Object.entries(VISION_STATUS_CONFIG).map(([value, config]) => (
                                    <option key={value} value={value}>{config.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Package Id</label>
                            <div className="rounded-xl bg-black/40 border border-zinc-700 px-3 py-2.5 text-sm text-zinc-400 font-mono">{draft.packageId}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Environment Version</label>
                            <input value={draft.environmentVersion} onChange={(event) => setDraft((current) => ({ ...current, environmentVersion: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Trial Package Version</label>
                            <input value={draft.trialPackageVersion} onChange={(event) => setDraft((current) => ({ ...current, trialPackageVersion: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Event Script Version</label>
                            <input value={draft.eventScriptVersion} onChange={(event) => setDraft((current) => ({ ...current, eventScriptVersion: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Metric Mapping Version</label>
                            <input value={draft.metricMappingVersion} onChange={(event) => setDraft((current) => ({ ...current, metricMappingVersion: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Seed / Script Id</label>
                            <input value={draft.seedOrScriptId} onChange={(event) => setDraft((current) => ({ ...current, seedOrScriptId: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Validation Notes</label>
                            <textarea value={draft.validationNotes ?? ''} onChange={(event) => setDraft((current) => ({ ...current, validationNotes: event.target.value }))} className="w-full min-h-[96px] rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500 resize-y" />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold text-white">Included Vision Variants</p>
                                <p className="text-[11px] text-zinc-500 mt-1">Packages own composition now. Choose which immersive variants are assembled into this runtime.</p>
                            </div>
                            <div className="text-[11px] text-cyan-300 font-semibold">{packageVariants.length} included</div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {variants.map((variant) => {
                                const included = draft.includedVariantIds.includes(variant.id);
                                return (
                                    <label key={variant.id} className={`rounded-xl border px-3 py-3 flex items-start gap-3 cursor-pointer transition-colors ${included ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'}`}>
                                        <input type="checkbox" checked={included} onChange={() => toggleVariant(variant.id)} className="mt-1" />
                                        <div>
                                            <p className="text-sm font-semibold text-white">{displayVariantName(variant.name)}</p>
                                            <p className="text-[11px] text-zinc-500 mt-1">{displayFamilyName(variant.family)} · {MODE_CONFIG[variant.mode].label}</p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {draft.runtimePlan && (
                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-4">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Authored Runtime Plan</p>
                                <p className="text-sm text-white mt-1">This package-level plan is what the headset runtime should execute.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Controlled Break (Seconds)</label>
                                    <input type="number" min={0} step="1" value={draft.runtimePlan.controlledBreakSeconds} onChange={(event) => setDraft((current) => ({ ...current, runtimePlan: current.runtimePlan ? { ...current.runtimePlan, controlledBreakSeconds: Number(event.target.value || 0) } : current.runtimePlan }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Session Cap (Seconds)</label>
                                    <input type="number" min={0} step="1" value={draft.runtimePlan.totalSessionCapSeconds} onChange={(event) => setDraft((current) => ({ ...current, runtimePlan: current.runtimePlan ? { ...current.runtimePlan, totalSessionCapSeconds: Number(event.target.value || 0) } : current.runtimePlan }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs font-semibold text-white">Reset Blocks</p>
                                        <button type="button" onClick={() => setDraft((current) => ({ ...current, runtimePlan: current.runtimePlan ? { ...current.runtimePlan, resetBlocks: [...current.runtimePlan.resetBlocks, buildDefaultResetBlock()] } : current.runtimePlan }))} className="rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-zinc-500 transition-colors">Add Reset Block</button>
                                    </div>
                                    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                                        {draft.runtimePlan.resetBlocks.map((block, index) => (
                                            <div key={`pkg-reset-${index}`} className="rounded-xl border border-zinc-800 bg-black/20 p-3 space-y-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Reset Block {index + 1}</p>
                                                    <button type="button" onClick={() => setDraft((current) => ({ ...current, runtimePlan: current.runtimePlan ? { ...current.runtimePlan, resetBlocks: current.runtimePlan.resetBlocks.filter((_, blockIndex) => blockIndex !== index) } : current.runtimePlan }))} className="rounded-md border border-red-500/20 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/15 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                                </div>
                                                <input value={block.disruptionLabel} onChange={(event) => updateResetBlock(index, (current) => ({ ...current, disruptionLabel: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                <input value={block.pressureTags.join(', ')} onChange={(event) => updateResetBlock(index, (current) => ({ ...current, pressureTags: parseCommaTags(event.target.value) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input type="number" step="0.1" min={0} value={block.lockInSeconds} onChange={(event) => updateResetBlock(index, (current) => ({ ...current, lockInSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                    <input type="number" step="0.1" min={0} value={block.disruptionSeconds} onChange={(event) => updateResetBlock(index, (current) => ({ ...current, disruptionSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                    <input type="number" step="0.1" min={0} value={block.responseWindowSeconds} onChange={(event) => updateResetBlock(index, (current) => ({ ...current, responseWindowSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                    <input type="number" step="0.1" min={0} value={block.interBlockGapSeconds} onChange={(event) => updateResetBlock(index, (current) => ({ ...current, interBlockGapSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs font-semibold text-white">Noise Gate Blocks</p>
                                        <button type="button" onClick={() => setDraft((current) => ({ ...current, runtimePlan: current.runtimePlan ? { ...current.runtimePlan, noiseGateBlocks: [...current.runtimePlan.noiseGateBlocks, buildDefaultNoiseGateBlock()] } : current.runtimePlan }))} className="rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-zinc-500 transition-colors">Add Noise Gate Block</button>
                                    </div>
                                    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                                        {draft.runtimePlan.noiseGateBlocks.map((block, index) => (
                                            <div key={`pkg-noise-${index}`} className="rounded-xl border border-zinc-800 bg-black/20 p-3 space-y-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Noise Gate Block {index + 1}</p>
                                                    <button type="button" onClick={() => setDraft((current) => ({ ...current, runtimePlan: current.runtimePlan ? { ...current.runtimePlan, noiseGateBlocks: current.runtimePlan.noiseGateBlocks.filter((_, blockIndex) => blockIndex !== index) } : current.runtimePlan }))} className="rounded-md border border-red-500/20 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/15 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <select value={block.targetChoice} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, targetChoice: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
                                                    <select value={block.distractorChoice} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, distractorChoice: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
                                                </div>
                                                <input value={block.noiseLabel} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, noiseLabel: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                <input value={block.pressureTags.join(', ')} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, pressureTags: parseCommaTags(event.target.value) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input type="number" step="0.1" min={0} max={1} value={block.noiseIntensity} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, noiseIntensity: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                    <input type="number" step="0.1" min={0} value={block.readySeconds} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, readySeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                    <input type="number" step="0.1" min={0} value={block.exposureSeconds} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, exposureSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                    <input type="number" step="0.1" min={0} value={block.responseWindowSeconds} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, responseWindowSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                    <div className="col-span-2">
                                                        <input type="number" step="0.1" min={0} value={block.interBlockGapSeconds} onChange={(event) => updateNoiseGateBlock(index, (current) => ({ ...current, interBlockGapSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs font-semibold text-white">Signal Window Blocks</p>
                                        <button type="button" onClick={() => setDraft((current) => ({ ...current, runtimePlan: current.runtimePlan ? { ...current.runtimePlan, signalWindowBlocks: [...current.runtimePlan.signalWindowBlocks, buildDefaultSignalBlock()] } : current.runtimePlan }))} className="rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-zinc-500 transition-colors">Add Signal Block</button>
                                    </div>
                                    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                                        {draft.runtimePlan.signalWindowBlocks.map((block, index) => (
                                            <div key={`pkg-signal-${index}`} className="rounded-xl border border-zinc-800 bg-black/20 p-3 space-y-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Signal Block {index + 1}</p>
                                                    <button type="button" onClick={() => setDraft((current) => ({ ...current, runtimePlan: current.runtimePlan ? { ...current.runtimePlan, signalWindowBlocks: current.runtimePlan.signalWindowBlocks.filter((_, blockIndex) => blockIndex !== index) } : current.runtimePlan }))} className="rounded-md border border-red-500/20 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/15 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <select value={block.correctChoice} onChange={(event) => updateSignalBlock(index, (current) => ({ ...current, correctChoice: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
                                                    <select value={block.decoyChoice} onChange={(event) => updateSignalBlock(index, (current) => ({ ...current, decoyChoice: event.target.value }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
                                                </div>
                                                <input value={block.pressureTags.join(', ')} onChange={(event) => updateSignalBlock(index, (current) => ({ ...current, pressureTags: parseCommaTags(event.target.value) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input type="number" step="0.1" min={0} value={block.cueWindowSeconds} onChange={(event) => updateSignalBlock(index, (current) => ({ ...current, cueWindowSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                    <input type="number" step="0.1" min={0} value={block.readySeconds} onChange={(event) => updateSignalBlock(index, (current) => ({ ...current, readySeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                    <input type="number" step="0.1" min={0} value={block.responseWindowSeconds} onChange={(event) => updateSignalBlock(index, (current) => ({ ...current, responseWindowSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                    <input type="number" step="0.1" min={0} value={block.interBlockGapSeconds} onChange={(event) => updateSignalBlock(index, (current) => ({ ...current, interBlockGapSeconds: Number(event.target.value || 0) }))} className="w-full rounded-xl bg-black/40 border border-zinc-700 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-zinc-500" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-zinc-800 bg-black/20 flex items-center justify-between">
                    <div className="text-[11px] text-zinc-500">
                        {draft.includedVariantIds.length} variants · {draft.runtimePlan?.resetBlocks.length ?? 0} reset blocks · {draft.runtimePlan?.noiseGateBlocks.length ?? 0} noise gate blocks · {draft.runtimePlan?.signalWindowBlocks.length ?? 0} signal blocks
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors">Close</button>
                        <button onClick={() => void onSave(draft)} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/15 disabled:opacity-40 transition-colors">
                            <Save className="w-3.5 h-3.5" />
                            {saving ? 'Saving...' : 'Save Package'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

/* ---- MAIN TAB ---- */
const VariantRegistryTab: React.FC = () => {
    const [registryVariants, setRegistryVariants] = useState<SimVariantRecord[]>([]);
    const [visionPackages, setVisionPackages] = useState<VisionRuntimePackageRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [creatingVariant, setCreatingVariant] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [savingVariantId, setSavingVariantId] = useState<string | null>(null);
    const [buildingVariantId, setBuildingVariantId] = useState<string | null>(null);
    const [publishingVariantId, setPublishingVariantId] = useState<string | null>(null);
    const [inlineGenerationQueue, setInlineGenerationQueue] = useState<string[]>([]);
    const [activeInlineGenerationId, setActiveInlineGenerationId] = useState<string | null>(null);
    const [inlineGenerationStates, setInlineGenerationStates] = useState<Record<string, InlineGenerationJobState>>({});
    const [savingVisionPackageId, setSavingVisionPackageId] = useState<string | null>(null);
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
    const [packageWorkspaceId, setPackageWorkspaceId] = useState<string | null>(null);

    const loadRegistry = async (showSeedToast: boolean = false) => {
        setLoading(true);
        try {
            const { records, created, updated } = await simVariantRegistryService.syncSeeds(VARIANT_REGISTRY);
            const existingById = new Map(records.map((record) => [record.id, record]));
            const seededIds = new Set(VARIANT_REGISTRY.map((seed) => buildSimVariantId(seed)));
            const merged = VARIANT_REGISTRY.map((seed, index) =>
                buildVariantWorkspace(seed, existingById.get(buildSimVariantId(seed)), index + 1)
            );
            const customVariants = records
                .filter((record) => !seededIds.has(record.id))
                .map((record) => applyDraftSyncState(record))
                .sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));
            const mergedVariants = [...merged, ...customVariants];
            setRegistryVariants(mergedVariants);
            const packages = await simVariantRegistryService.listVisionPackages();
            setVisionPackages(packages);

            if ((created > 0 || updated > 0) && showSeedToast) {
                setToast({
                    type: 'success',
                    message: `Registry sync applied ${created} new and ${updated} reconciled variants.`,
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
            if (
                searchQuery
                && !v.name.toLowerCase().includes(searchQuery.toLowerCase())
                && !displayVariantName(v.name).toLowerCase().includes(searchQuery.toLowerCase())
                && !v.family.toLowerCase().includes(searchQuery.toLowerCase())
                && !displayFamilyName(v.family).toLowerCase().includes(searchQuery.toLowerCase())
            ) return false;
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

    const visionVariants = useMemo(
        () => filteredVariants.filter((variant) => isVisionVariantEntry(variant)),
        [filteredVariants]
    );

    const visionFamilyGroups = useMemo(() => {
        const groups: Record<string, { familyStatus: FamilyStatus; variants: SimVariantRecord[] }> = {};
        visionVariants.forEach((variant) => {
            if (!groups[variant.family]) {
                groups[variant.family] = { familyStatus: variant.familyStatus, variants: [] };
            }
            groups[variant.family].variants.push(variant);
        });

        return Object.entries(groups).sort(([, a], [, b]) => {
            if (a.familyStatus === 'locked' && b.familyStatus === 'candidate') return -1;
            if (a.familyStatus === 'candidate' && b.familyStatus === 'locked') return 1;
            return 0;
        });
    }, [visionVariants]);

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

    const visionStats = useMemo(() => {
        const total = visionVariants.length;
        const families = new Set(visionVariants.map((variant) => variant.family)).size;
        const complete = visionVariants.filter((variant) => resolveSpecStatus(variant) === 'complete').length;
        const needsSpec = visionVariants.filter((variant) => resolveSpecStatus(variant) === 'needs-spec').length;
        const runtimeMapped = visionVariants.filter((variant) => resolveVisionPackageStatus(variant) === 'runtime_mapped').length;
        const inPackage = visionVariants.filter((variant) => resolveVisionPackageStatus(variant) === 'in_package').length;
        const validated = visionVariants.filter((variant) => resolveVisionPackageStatus(variant) === 'validated').length;
        return { total, families, complete, needsSpec, runtimeMapped, inPackage, validated };
    }, [visionVariants]);

    const visionPackageStats = useMemo(() => {
        const total = visionPackages.length;
        const validated = visionPackages.filter((record) => record.packageStatus === 'validated').length;
        const inPackage = visionPackages.filter((record) => record.packageStatus === 'in_package').length;
        const runtimeMapped = visionPackages.filter((record) => record.packageStatus === 'runtime_mapped').length;
        return { total, validated, inPackage, runtimeMapped };
    }, [visionPackages]);

    const activeFilters = [filterFamilyStatus, filterMode, filterSpecStatus].filter((f) => f !== 'all').length + (searchQuery ? 1 : 0);
    const selectedVariant = workspaceModalState
        ? registryVariants.find((variant) => variant.id === workspaceModalState.variantId) ?? null
        : null;
    const selectedVisionPackage = packageWorkspaceId
        ? visionPackages.find((record) => record.packageId === packageWorkspaceId) ?? null
        : null;

    const setInlineGenerationState = useCallback((variantId: string, status: InlineGenerationJobStatus, message: string) => {
        setInlineGenerationStates((current) => ({
            ...current,
            [variantId]: {
                status,
                message,
                updatedAt: Date.now(),
            },
        }));
    }, []);

    const buildAutomatedWorkspaceRecord = useCallback((variant: SimVariantRecord, specRaw: string) => {
        const normalizedSpecRaw = normalizeSpecText(specRaw);
        const sortOrder = registryVariants.findIndex((entry) => entry.id === variant.id) + 1;
        const lockedSpec = isTrialVariant(variant) ? (variant.lockedSpec ?? buildDefaultLockedSpec(variant)) : undefined;
        const runtimeConfig = {
            ...(variant.runtimeConfig ?? buildDefaultRuntimeConfig(variant)),
            lockedSpec: lockedSpec ?? null,
        };
        const moduleDraft = normalizeModuleDraft(variant, variant.moduleDraft, sortOrder > 0 ? sortOrder : 0);

        return applyDraftSyncState({
            ...variant,
            specRaw: normalizedSpecRaw,
            lockedSpec,
            specStatus: variant.mode === 'hybrid'
                ? 'not-required'
                : resolveWorkspaceSpecStatus(variant, normalizedSpecRaw),
            runtimeConfig,
            moduleDraft,
            updatedAt: Date.now(),
        });
    }, [registryVariants]);

    const runAutomatedAuditLifecycle = useCallback(async (variant: SimVariantRecord, specRaw: string) => {
        const deterministicAudit = runSpecAuditPipeline(variant, specRaw);
        let nextRawSpec = deterministicAudit.fixedRaw;
        let nextAudit = deterministicAudit;
        let aiReview: SpecAuditAiReview | null = null;

        try {
            const aiAudit = await requestAiVariantSpecAudit(variant, deterministicAudit.fixedRaw, deterministicAudit.findings);
            const suggestedSpecRaw = normalizeSpecText(aiAudit.suggestedSpecRaw || deterministicAudit.fixedRaw);
            const shouldApplyAiSpec = Boolean(suggestedSpecRaw.trim()) && suggestedSpecRaw !== normalizeSpecText(deterministicAudit.fixedRaw);
            const validatedAudit = runSpecAuditPipeline(variant, shouldApplyAiSpec ? suggestedSpecRaw : deterministicAudit.fixedRaw);

            nextRawSpec = validatedAudit.fixedRaw;
            aiReview = {
                model: aiAudit.model,
                summary: aiAudit.summary,
                findings: aiAudit.findings ?? [],
                applied: shouldApplyAiSpec,
            };
            nextAudit = mergeAuditReportWithAiReview(validatedAudit, aiReview);

            const autoApplied = autoApplySupportedAuditFixes(variant, nextRawSpec, nextAudit);
            if (autoApplied.appliedLabels.length > 0) {
                nextRawSpec = autoApplied.raw;
                nextAudit = {
                    ...autoApplied.audit,
                    aiReview: {
                        ...aiReview,
                        applied: true,
                        summary: `${aiReview.summary} System auto-applied: ${autoApplied.appliedLabels.join(', ')}.`,
                    },
                };
            }
        } catch (error: any) {
            aiReview = {
                model: 'unavailable',
                summary: 'AI gold-standard review was unavailable, so the registry rule set remained the source of truth for this pass.',
                findings: [],
                applied: false,
                unavailableReason: error?.message || 'Failed to reach the AI audit service.',
            };
            nextAudit = mergeAuditReportWithAiReview(deterministicAudit, aiReview);
        }

        const promotedAfterAudit = normalizeSpecText(promoteSpecReleaseMetadata(nextRawSpec, variant, nextAudit));
        if (promotedAfterAudit !== nextRawSpec) {
            nextRawSpec = promotedAfterAudit;
            nextAudit = runSpecAuditPipeline(variant, nextRawSpec);
        }

        const checklistAlignedAfterAudit = normalizeSpecText(syncReadinessChecklist(nextRawSpec, variant));
        if (checklistAlignedAfterAudit !== nextRawSpec) {
            nextRawSpec = checklistAlignedAfterAudit;
            nextAudit = runSpecAuditPipeline(variant, nextRawSpec);
        }

        const normalizedAiReview = normalizeAiReviewSummaryForFinalAudit(nextAudit.aiReview ?? aiReview, nextAudit, variant);
        if (normalizedAiReview) {
            nextAudit = {
                ...nextAudit,
                aiReview: normalizedAiReview,
            };
        }

        return {
            raw: nextRawSpec,
            audit: nextAudit,
        };
    }, []);

    const prepareAutomatedBuildRecord = useCallback(async (variant: SimVariantRecord, specRaw: string) => {
        const draftRecord = buildAutomatedWorkspaceRecord(variant, specRaw);
        const nextWithAudio = await resolveVariantAudioAssets(draftRecord);
        return buildVariantRecordForBuild(nextWithAudio);
    }, [buildAutomatedWorkspaceRecord]);

    const processInlineGenerationJob = useCallback(async (variantId: string) => {
        const variant = registryVariants.find((entry) => entry.id === variantId);
        if (!variant) {
            throw new Error('Variant no longer exists in the registry.');
        }

        setInlineGenerationState(variantId, 'generating', `Generating draft for ${displayVariantName(variant.name)}...`);
        const seedSpec = buildGeneratedVariantSpec(variant);
        let generatedSpec = seedSpec;
        try {
            const aiGeneration = await requestAiVariantSpecGeneration(variant, seedSpec);
            const candidate = normalizeSpecText(aiGeneration.generatedSpecRaw || seedSpec);
            if (candidate.trim()) {
                generatedSpec = candidate;
            }
        } catch {
            generatedSpec = seedSpec;
        }

        setInlineGenerationState(variantId, 'auditing', `Auditing ${displayVariantName(variant.name)}...`);
        const audited = await runAutomatedAuditLifecycle(variant, generatedSpec);

        const saveDraftRecord = async (raw: string, message: string) => {
            setInlineGenerationState(variantId, 'saving', message);
            const draftRecord = buildAutomatedWorkspaceRecord(variant, raw);
            const savedRecord = await simVariantRegistryService.save(draftRecord);
            setRegistryVariants((current) => current.map((entry) => entry.id === variantId ? savedRecord : entry));
            setInlineGenerationState(variantId, 'saved_for_review', `${displayVariantName(variant.name)} saved for review.`);
            setToast({
                type: 'success',
                message: `${displayVariantName(variant.name)} saved as draft because the audit still needs review.`,
            });
        };

        if (audited.audit.status !== 'pass') {
            await saveDraftRecord(audited.raw, `Saving ${displayVariantName(variant.name)} draft for review...`);
            return;
        }

        const publishStateVariant: SimVariantRecord = {
            ...variant,
            buildStatus: 'published',
        };
        const publishStateSeedAudit = runSpecAuditPipeline(publishStateVariant, audited.raw);
        const publishStateAuto = autoApplySupportedAuditFixes(publishStateVariant, audited.raw, publishStateSeedAudit);
        const finalizedPublishState = finalizeSpecForVariantState(
            publishStateAuto.raw,
            publishStateVariant,
            publishStateAuto.audit,
        );

        if (finalizedPublishState.audit.status !== 'pass') {
            await saveDraftRecord(finalizedPublishState.raw, `Saving ${displayVariantName(variant.name)} draft after publish validation...`);
            return;
        }

        setInlineGenerationState(variantId, 'publishing', `Building + publishing ${displayVariantName(variant.name)}...`);
        const builtRecord = await prepareAutomatedBuildRecord(variant, finalizedPublishState.raw);
        const module = buildPublishedModule(builtRecord);
        const moduleId = await simVariantRegistryService.publish(builtRecord, module);
        const publishedRecord = buildPublishedVariantRecord({
            ...builtRecord,
            publishedModuleId: moduleId,
        });
        setRegistryVariants((current) => current.map((entry) => entry.id === variantId ? publishedRecord : entry));
        setInlineGenerationState(variantId, 'published', `${displayVariantName(variant.name)} published as ${moduleId}.`);
        setToast({
            type: 'success',
            message: `${displayVariantName(variant.name)} generated, audited, and published automatically.`,
        });
    }, [buildAutomatedWorkspaceRecord, prepareAutomatedBuildRecord, registryVariants, runAutomatedAuditLifecycle, setInlineGenerationState]);

    const handleQueueInlineGeneration = useCallback((variant: SimVariantRecord) => {
        if (activeInlineGenerationId === variant.id || inlineGenerationQueue.includes(variant.id)) {
            return;
        }
        setInlineGenerationState(variant.id, 'queued', `${displayVariantName(variant.name)} queued for generation.`);
        setInlineGenerationQueue((current) => [...current, variant.id]);
    }, [activeInlineGenerationId, inlineGenerationQueue, setInlineGenerationState]);

    useEffect(() => {
        if (activeInlineGenerationId || inlineGenerationQueue.length === 0) return;

        const nextVariantId = inlineGenerationQueue[0];
        setActiveInlineGenerationId(nextVariantId);

        void (async () => {
            try {
                await processInlineGenerationJob(nextVariantId);
            } catch (error: any) {
                console.error('Failed to process inline generation queue job:', error);
                setInlineGenerationState(nextVariantId, 'error', error?.message || 'Failed to process queued generation.');
                const failedVariant = registryVariants.find((entry) => entry.id === nextVariantId);
                setToast({
                    type: 'error',
                    message: failedVariant
                        ? `Failed to generate ${displayVariantName(failedVariant.name)}.`
                        : 'Failed to process queued variant generation.',
                });
            } finally {
                setInlineGenerationQueue((current) => current.filter((id) => id !== nextVariantId));
                setActiveInlineGenerationId(null);
            }
        })();
    }, [activeInlineGenerationId, inlineGenerationQueue, processInlineGenerationJob, registryVariants, setInlineGenerationState]);

    useEffect(() => {
        const terminalStates: InlineGenerationJobStatus[] = ['published', 'saved_for_review', 'error'];
        const now = Date.now();
        const timers = Object.entries(inlineGenerationStates)
            .filter(([, state]) => terminalStates.includes(state.status))
            .map(([variantId, state]) => window.setTimeout(() => {
                setInlineGenerationStates((current) => {
                    const entry = current[variantId];
                    if (!entry || entry.updatedAt !== state.updatedAt || !terminalStates.includes(entry.status)) {
                        return current;
                    }

                    const next = { ...current };
                    delete next[variantId];
                    return next;
                });
            }, Math.max(0, INLINE_GENERATION_RESULT_TTL_MS - (now - state.updatedAt))));

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [inlineGenerationStates]);

    const handleSaveWorkspace = async (next: SimVariantRecord) => {
        setSavingVariantId(next.id);
        try {
            const draftRecord = applyDraftSyncState(next);
            const savedRecord = await simVariantRegistryService.save(draftRecord);
            setRegistryVariants((current) => current.map((variant) => variant.id === next.id ? savedRecord : variant));
            setToast({
                type: 'success',
                message: `${displayVariantName(next.name)} saved to the variant registry.`,
            });
        } catch (error) {
            console.error('Failed to save variant workspace:', error);
            setToast({
                type: 'error',
                message: `Failed to save ${displayVariantName(next.name)}.`,
            });
        } finally {
            setSavingVariantId(null);
        }
    };

    const handleBuildWorkspace = async (next: SimVariantRecord) => {
        setBuildingVariantId(next.id);
        try {
            const builtRecord = buildVariantRecordForBuild(next);
            const savedBuiltRecord = await simVariantRegistryService.save(builtRecord);
            setRegistryVariants((current) => current.map((variant) => variant.id === next.id ? savedBuiltRecord : variant));
            setToast({
                type: 'success',
                message: `${displayVariantName(next.name)} built into a playable runtime artifact.`,
            });
        } catch (error) {
            console.error('Failed to build variant workspace:', error);
            setToast({
                type: 'error',
                message: `Failed to build ${displayVariantName(next.name)}.`,
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
                message: `${displayVariantName(next.name)} published to sim-modules as ${moduleId}.`,
            });
        } catch (error) {
            console.error('Failed to publish variant workspace:', error);
            setToast({
                type: 'error',
                message: `Failed to publish ${displayVariantName(next.name)}.`,
            });
        } finally {
            setPublishingVariantId(null);
        }
    };

    const handleRollbackWorkspace = (next: SimVariantRecord) => {
        setRegistryVariants((current) => current.map((variant) => variant.id === next.id ? next : variant));
        setToast({
            type: 'success',
            message: `${displayVariantName(next.name)} rolled back to the selected saved spec version.`,
        });
    };

    const handleCreateVariant = async (seed: SimVariantSeed) => {
        const nextRecord = createDraftVariantRecord(seed, registryVariants.length + 1);
        setCreatingVariant(true);
        try {
            const savedRecord = await simVariantRegistryService.save(nextRecord);
            setRegistryVariants((current) => [...current, savedRecord]);
            setShowCreateModal(false);
            setWorkspaceModalState({
                variantId: savedRecord.id,
                initialTab: 'general',
            });
            setToast({
                type: 'success',
                message: `${displayVariantName(savedRecord.name)} created in the variant registry.`,
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

    const handleSaveVisionPackageWorkspace = async (next: VisionRuntimePackageRecord) => {
        setSavingVisionPackageId(next.packageId);
        try {
            await simVariantRegistryService.saveVisionPackageRecord(next);
            await loadRegistry(false);
            setToast({
                type: 'success',
                message: `${next.packageName} saved as a Vision package.`,
            });
        } catch (error) {
            console.error('Failed to save Vision package:', error);
            setToast({
                type: 'error',
                message: `Failed to save ${next.packageName}.`,
            });
        } finally {
            setSavingVisionPackageId(null);
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

                {/* VISION PACKAGES */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">Immersive Assembly</p>
                            <h3 className="text-lg font-semibold text-white">Vision Packages</h3>
                            <p className="text-xs text-zinc-500">First-class immersive package objects for runtime composition, metadata, and authored block plans.</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                            <span className="px-2 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 font-semibold">
                                {visionPackageStats.total} packages
                            </span>
                            <span className="px-2 py-1 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-300 font-semibold">
                                {visionPackageStats.inPackage} in package
                            </span>
                            <span className="px-2 py-1 rounded-full border border-green-500/20 bg-green-500/10 text-green-300 font-semibold">
                                {visionPackageStats.validated} validated
                            </span>
                        </div>
                    </div>

                    {visionPackages.length > 0 ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {visionPackages.map((record) => {
                                const statusConf = VISION_STATUS_CONFIG[record.packageStatus];
                                return (
                                    <button
                                        key={record.packageId}
                                        onClick={() => setPackageWorkspaceId(record.packageId)}
                                        className="text-left rounded-2xl border border-zinc-800 bg-[#090f1c] p-5 hover:border-cyan-500/30 hover:bg-white/[0.02] transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white">{record.packageName}</p>
                                                <p className="text-[11px] text-zinc-500 mt-1 font-mono">{record.packageId}</p>
                                            </div>
                                            <span className="px-2 py-1 rounded-full border text-[10px] font-semibold" style={{ color: statusConf.color, borderColor: `${statusConf.color}40`, background: `${statusConf.color}12` }}>
                                                {statusConf.label}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                                            <div className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-2">
                                                <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Variants</p>
                                                <p className="text-lg font-semibold text-white mt-1">{record.includedVariantIds.length}</p>
                                            </div>
                                            <div className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-2">
                                                <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Reset Blocks</p>
                                                <p className="text-lg font-semibold text-white mt-1">{record.runtimePlan?.resetBlocks.length ?? 0}</p>
                                            </div>
                                            <div className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-2">
                                                <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Signal Blocks</p>
                                                <p className="text-lg font-semibold text-white mt-1">{record.runtimePlan?.signalWindowBlocks.length ?? 0}</p>
                                            </div>
                                            <div className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-2">
                                                <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Noise Blocks</p>
                                                <p className="text-lg font-semibold text-white mt-1">{record.runtimePlan?.noiseGateBlocks.length ?? 0}</p>
                                            </div>
                                            <div className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-2">
                                                <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Surface</p>
                                                <p className="text-sm font-semibold text-white mt-1">{record.surface}</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-zinc-500">
                                            <span>{record.environmentVersion}</span>
                                            <span>{record.runtimePlan?.controlledBreakSeconds ?? 0}s break</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-8 text-center">
                            <p className="text-sm text-zinc-400">No Vision packages have been assembled yet.</p>
                        </div>
                    )}
                </div>

                {/* VISION VARIANTS */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">Immersive Layer</p>
                            <h3 className="text-lg font-semibold text-white">Vision Variants</h3>
                            <p className="text-xs text-zinc-500">Dedicated registry slice for Vision Pro and immersive trial expressions.</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                            <span className="px-2 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 font-semibold">
                                {visionStats.total} variants
                            </span>
                            <span className="px-2 py-1 rounded-full border border-zinc-700 bg-black/30 text-zinc-400 font-semibold">
                                {visionStats.families} families
                            </span>
                            <span className="px-2 py-1 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-300 font-semibold">
                                {visionStats.inPackage} in package
                            </span>
                            <span className="px-2 py-1 rounded-full border border-green-500/20 bg-green-500/10 text-green-300 font-semibold">
                                {visionStats.validated} validated
                            </span>
                        </div>
                    </div>

                    {visionVariants.length > 0 ? (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-[#090f1c] border border-cyan-500/20 rounded-xl px-4 py-3">
                                    <p className="text-[9px] uppercase tracking-widest text-cyan-400 font-bold">Vision Variants</p>
                                    <p className="text-2xl font-bold text-white mt-1">{visionStats.total}</p>
                                    <p className="text-[10px] text-zinc-500">Immersive and headset-linked expressions</p>
                                </div>
                                <div className="bg-[#090f1c] border border-zinc-800 rounded-xl px-4 py-3">
                                    <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Families</p>
                                    <p className="text-2xl font-bold text-white mt-1">{visionStats.families}</p>
                                    <p className="text-[10px] text-zinc-500">Represented in the immersive slice</p>
                                </div>
                                <div className="bg-[#090f1c] border border-green-500/20 rounded-xl px-4 py-3">
                                    <p className="text-[9px] uppercase tracking-widest text-green-400 font-bold">Complete</p>
                                    <p className="text-2xl font-bold text-green-400 mt-1">{visionStats.complete}</p>
                                    <p className="text-[10px] text-zinc-500">Build-ready immersive specs</p>
                                </div>
                                <div className="bg-[#090f1c] border border-red-500/20 rounded-xl px-4 py-3">
                                    <p className="text-[9px] uppercase tracking-widest text-red-400 font-bold">Need Spec</p>
                                    <p className="text-2xl font-bold text-red-400 mt-1">{visionStats.needsSpec}</p>
                                    <p className="text-[10px] text-zinc-500">Still missing immersive spec work</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {visionFamilyGroups.map(([familyName, group]) => (
                                    <FamilyGroup
                                        key={`vision-${familyName}`}
                                        familyName={familyName}
                                        familyStatus={group.familyStatus}
                                        variants={group.variants}
                                        familyColor={FAMILY_COLORS[familyName] || '#06b6d4'}
                                        inlineGenerationStates={inlineGenerationStates}
                                        onOpenWorkspace={(variant, options) => setWorkspaceModalState({
                                            variantId: variant.id,
                                            initialTab: options?.initialTab,
                                            initialRaw: options?.initialSpecRaw,
                                        })}
                                        onPasteSpec={(variant) => setWorkspaceModalState({ variantId: variant.id, initialTab: 'spec' })}
                                        onGenerateSpec={handleQueueInlineGeneration}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-8 text-center">
                            <p className="text-sm text-zinc-400">No Vision variants match the current filters yet.</p>
                        </div>
                    )}
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
                            inlineGenerationStates={inlineGenerationStates}
                            onOpenWorkspace={(variant, options) => setWorkspaceModalState({
                                variantId: variant.id,
                                initialTab: options?.initialTab,
                                initialRaw: options?.initialSpecRaw,
                            })}
                            onPasteSpec={(variant) => setWorkspaceModalState({ variantId: variant.id, initialTab: 'spec' })}
                            onGenerateSpec={handleQueueInlineGeneration}
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
                        onRollback={handleRollbackWorkspace}
                        onClose={() => setWorkspaceModalState(null)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {selectedVisionPackage && (
                    <VisionPackageWorkspaceModal
                        packageRecord={selectedVisionPackage}
                        variants={visionVariants}
                        saving={savingVisionPackageId === selectedVisionPackage.packageId}
                        onSave={handleSaveVisionPackageWorkspace}
                        onClose={() => setPackageWorkspaceId(null)}
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
