/**
 * Reset Game Component
 *
 * Reset — Mental Recovery Training Game
 * Trains how fast athletes recover after disruption.
 * Simulates disruption, measures recovery time, and tracks improvement.
 *
 * Three phases per round:
 *   1. Lock In — focus task engagement
 *   2. Disruption — sudden visual/cognitive disruption
 *   3. Reset — re-engage and measure recovery time
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Zap,
    Volume2,
    VolumeX,
    ChevronRight,
    Shield,
    TrendingDown,
    Activity,
    Lock,
    Trophy,
} from 'lucide-react';
import { SimModule, GameLevelProgress, TierAdvancementResult } from '../../api/firebase/mentaltraining/types';
import { gameLevelProgressService } from '../../api/firebase/mentaltraining/gameLevelProgressService';
import { simSessionService } from '../../api/firebase/mentaltraining/simSessionService';
import { athleteProgressService } from '../../api/firebase/mentaltraining/athleteProgressService';
import { DurationMode, type ProfileSnapshotMilestone, PressureType, SessionType, TaxonomySkill } from '../../api/firebase/mentaltraining/taxonomy';
import { useUser } from '../../hooks/useUser';
import { useInputIntegrity } from './useInputIntegrity';

// ============================================================================
// TYPES
// ============================================================================

type GameState = 'intro' | 'preMood' | 'playing' | 'roundResult' | 'postMood' | 'summary';
type GamePhase = 'lockIn' | 'disruption' | 'resetBreath' | 'reengage';
type DisruptionType = 'visual' | 'audio' | 'cognitive' | 'combined' | 'immersive';

type ResetTier = 'foundation' | 'sharpening' | 'pressure' | 'elite';

const TIER_CONFIG: Record<ResetTier, {
    displayName: string;
    recoveryTarget: number;
    roundCount: number;
    lockInDuration: number;
    disruptionDuration: number;
}> = {
    foundation: {
        displayName: 'Tier 1 — Foundation',
        recoveryTarget: 3.0,
        roundCount: 5,
        lockInDuration: 12,
        disruptionDuration: 2,
    },
    sharpening: {
        displayName: 'Tier 2 — Sharpening',
        recoveryTarget: 2.0,
        roundCount: 6,
        lockInDuration: 10,
        disruptionDuration: 2.5,
    },
    pressure: {
        displayName: 'Tier 3 — Pressure',
        recoveryTarget: 1.5,
        roundCount: 6,
        lockInDuration: 10,
        disruptionDuration: 2,
    },
    elite: {
        displayName: 'Tier 4 — Elite',
        recoveryTarget: 1.0,
        roundCount: 7,
        lockInDuration: 8,
        disruptionDuration: 1.5,
    },
};

const TIER_NUMBER_MAP: Record<number, ResetTier> = {
    1: 'foundation',
    2: 'sharpening',
    3: 'pressure',
    4: 'elite',
};

const TIER_DISPLAY_NAMES: Record<number, string> = {
    1: 'Foundation',
    2: 'Sharpening',
    3: 'Pressure',
    4: 'Elite',
};

const PROVOCATIVE_MESSAGES = [
    'You missed it.',
    'Too slow.',
    "Everyone's watching.",
    'That was ugly.',
    'Wrong move.',
    "You're falling behind.",
    'Losing focus?',
    'Not your best.',
    'The pressure is on.',
    'Can you handle this?',
    'Tick tock.',
    "They're counting on you.",
    'Momentum lost.',
    'Reset or quit?',
    "Clock's ticking.",
];

const MOODS = [
    { value: 1, emoji: '😰', label: 'Stressed' },
    { value: 2, emoji: '😔', label: 'Low' },
    { value: 3, emoji: '😐', label: 'Neutral' },
    { value: 4, emoji: '😊', label: 'Good' },
    { value: 5, emoji: '🔥', label: 'Great' },
];

// ============================================================================
// PROPS
// ============================================================================

interface ResetGameProps {
    exercise: SimModule;
    onComplete: (data: {
        durationSeconds: number;
        preExerciseMood?: number;
        postExerciseMood?: number;
        helpfulnessRating?: number;
    }) => void;
    onClose: () => void;
    profileSnapshotMilestone?: Extract<ProfileSnapshotMilestone, 'midpoint' | 'endpoint' | 'retention'>;
    previewMode?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ResetGame: React.FC<ResetGameProps> = ({
    exercise,
    onComplete,
    onClose,
    profileSnapshotMilestone,
    previewMode = false,
}) => {
    const currentUser = useUser();
    const buildArtifact = exercise.buildArtifact;
    const variantTitle = buildArtifact?.variantName || exercise.name || 'Reset';
    const variantSubtitle = buildArtifact?.uiModel?.introDescription || exercise.description || 'Mental Recovery Training';
    const normalizedVariantTitle = variantTitle.toLowerCase();
    const isSecondChanceVariant = normalizedVariantTitle.includes('second chance');
    const buildArtifactArchetype = buildArtifact?.sessionModel?.archetype;
    const variantArchetype = buildArtifactArchetype && buildArtifactArchetype !== 'baseline'
        ? buildArtifactArchetype
        : exercise.variantSource?.archetype ?? buildArtifactArchetype ?? 'baseline';
    const stimulusEmphasis = (buildArtifact?.stimulusModel?.emphasis ?? exercise.runtimeConfig?.stimuli?.emphasis ?? []) as string[];
    const audioAssets = (buildArtifact?.stimulusModel?.audioAssets ?? exercise.runtimeConfig?.audioAssets ?? {}) as Record<string, { downloadURL?: string }>;
    const normalizedEmphasis = stimulusEmphasis.map((item) => String(item).toLowerCase());

    // Game state
    const [gameState, setGameState] = useState<GameState>('intro');
    const [currentRound, setCurrentRound] = useState(0);
    const [currentTier, setCurrentTier] = useState<ResetTier>('foundation');
    const [tierNumber, setTierNumber] = useState(1);
    const [levelProgress, setLevelProgress] = useState<GameLevelProgress | null>(null);
    const [advancementResult, setAdvancementResult] = useState<TierAdvancementResult | null>(null);
    const [showAdvancement, setShowAdvancement] = useState(false);
    const [progressLoading, setProgressLoading] = useState(true);
    const tierConfig = TIER_CONFIG[currentTier];
    const totalRounds = tierConfig.roundCount;

    // Phase state
    const [phase, setPhase] = useState<GamePhase>('lockIn');
    const [lockInRemaining, setLockInRemaining] = useState(tierConfig.lockInDuration);
    // Focus task state
    const [pulseScale, setPulseScale] = useState(1);
    const [tapAccuracy, setTapAccuracy] = useState<boolean[]>([]);
    const expectedTapTimeRef = useRef<number>(0);

    // Sequence task state (tier 3/4)
    const [sequenceTargets, setSequenceTargets] = useState<number[]>([]);
    const [sequenceInputs, setSequenceInputs] = useState<number[]>([]);
    const [sequenceHighlight, setSequenceHighlight] = useState(-1);
    const [showingSequence, setShowingSequence] = useState(false);

    // Tracking task state (tier 2)
    const [trackingPos, setTrackingPos] = useState({ x: 50, y: 50 });
    const [noisePoints, setNoisePoints] = useState<{ x: number; y: number }[]>([]);

    // Disruption state
    const [flashActive, setFlashActive] = useState(false);
    const [scrambled, setScrambled] = useState(false);
    const [provocMessage, setProvocMessage] = useState('');
    const [showProvocMessage, setShowProvocMessage] = useState(false);
    const [audioCueLabel, setAudioCueLabel] = useState('');
    const [audioPulseActive, setAudioPulseActive] = useState(false);
    const [immersiveCueLabel, setImmersiveCueLabel] = useState('');
    const [immersiveFieldActive, setImmersiveFieldActive] = useState(false);
    const [secondChancePromptActive, setSecondChancePromptActive] = useState(false);
    const [disruptionActive, setDisruptionActive] = useState(false);
    const [showReset, setShowReset] = useState(false);
    const [phaseMessage, setPhaseMessage] = useState('Hold steady until the disruption hits.');
    const [phaseCountdown, setPhaseCountdown] = useState<number | null>(null);

    // Recovery measurement
    const disruptionEndRef = useRef<number>(0);
    const recoveryStartedRef = useRef(false);
    const [roundRecoveryTimes, setRoundRecoveryTimes] = useState<number[]>([]);
    const preHitsRef = useRef(0);
    const preTotalRef = useRef(0);
    const postHitsRef = useRef(0);
    const postTotalRef = useRef(0);
    const {
        warningActive: spamWarningActive,
        registerInputAttempt,
        resetRound: resetInputRound,
        resetSession: resetInputSession,
        finalizeRound: finalizeInputRound,
        spamDetected,
        spamFlags,
        spamRounds,
    } = useInputIntegrity();

    // Mood
    const [preExerciseMood, setPreExerciseMood] = useState<number | undefined>();
    const [postExerciseMood, setPostExerciseMood] = useState<number | undefined>();

    // Load user's tier progress from Firestore
    useEffect(() => {
        const loadProgress = async () => {
            if (previewMode || !currentUser?.id) {
                setProgressLoading(false);
                return;
            }
            try {
                const progress = await gameLevelProgressService.getProgress(currentUser.id, 'reset');
                setLevelProgress(progress);
                const tierKey = TIER_NUMBER_MAP[progress.currentTier] ?? 'foundation';
                setCurrentTier(tierKey);
                setTierNumber(progress.currentTier);
            } catch (err) {
                console.error('Failed to load tier progress:', err);
            } finally {
                setProgressLoading(false);
            }
        };
        loadProgress();
    }, [currentUser?.id, previewMode]);

    // Select a tier (from unlocked tiers)
    const selectTier = useCallback((tier: number) => {
        const tierKey = TIER_NUMBER_MAP[tier] ?? 'foundation';
        setCurrentTier(tierKey);
        setTierNumber(tier);
    }, []);

    // Timers
    const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pulseTimerRef = useRef<NodeJS.Timeout | null>(null);
    const trackingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sessionStartRef = useRef<number>(Date.now());
    const [soundEnabled, setSoundEnabled] = useState(true);
    const audioContextRef = useRef<AudioContext | null>(null);
    const cueAudioRef = useRef<HTMLAudioElement | null>(null);
    const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
    const isClosedRef = useRef(false);

    const scheduleTimeout = useCallback((callback: () => void, delay: number) => {
        const timeout = setTimeout(() => {
            timeoutRefs.current = timeoutRefs.current.filter((id) => id !== timeout);
            if (isClosedRef.current) return;
            callback();
        }, delay);
        timeoutRefs.current.push(timeout);
        return timeout;
    }, []);

    // Cleanup all timers
    const cleanup = useCallback(() => {
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);
        if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
        if (trackingTimerRef.current) clearInterval(trackingTimerRef.current);
        timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
        timeoutRefs.current = [];
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => undefined);
            audioContextRef.current = null;
        }
        if (cueAudioRef.current) {
            cueAudioRef.current.pause();
            cueAudioRef.current = null;
        }
        gameTimerRef.current = null;
        pulseTimerRef.current = null;
        trackingTimerRef.current = null;
        setPulseScale(1);
        setAudioPulseActive(false);
    }, []);

    const handleClose = useCallback(() => {
        isClosedRef.current = true;
        cleanup();
        onClose();
    }, [cleanup, onClose]);

    useEffect(() => {
        isClosedRef.current = false;
        return () => {
            isClosedRef.current = true;
            cleanup();
        };
    }, [cleanup]);

    // ============================================================================
    // GAME LOGIC
    // ============================================================================

    const getAudioCueLabel = useCallback(() => {
        const options = normalizedEmphasis.some((item) => item.includes('whistle') || item.includes('buzzer'))
            ? ['Whistle blast', 'Buzzer shock', 'Crowd surge']
            : normalizedEmphasis.some((item) => item.includes('crowd'))
                ? ['Crowd surge', 'Commentary burst', 'Startle cue']
                : ['Audio startle', 'Crowd surge', 'Whistle blast'];
        return options[Math.floor(Math.random() * options.length)];
    }, [normalizedEmphasis]);

    const getAudioCueAssetUrl = useCallback((cueLabel: string) => {
        const normalized = cueLabel.toLowerCase();
        if (normalized.includes('whistle')) return audioAssets.whistle_blast?.downloadURL;
        if (normalized.includes('buzzer')) return audioAssets.buzzer_shock?.downloadURL;
        if (normalized.includes('commentary')) return audioAssets.commentary_overlap?.downloadURL;
        if (normalized.includes('crowd')) return audioAssets.crowd_surge?.downloadURL ?? audioAssets.crowd_bed?.downloadURL;
        return audioAssets.startle_cue?.downloadURL;
    }, [audioAssets]);

    const playAudioDisruption = useCallback((cueLabel: string) => {
        if (!soundEnabled || typeof window === 'undefined') return;
        const assetUrl = getAudioCueAssetUrl(cueLabel);
        if (assetUrl) {
            if (cueAudioRef.current) {
                cueAudioRef.current.pause();
                cueAudioRef.current = null;
            }
            const audio = new Audio(assetUrl);
            audio.volume = cueLabel.toLowerCase().includes('crowd') ? 0.75 : 0.92;
            cueAudioRef.current = audio;
            audio.play().catch(() => undefined);
            return;
        }
        const BrowserAudioContext = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext
            || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!BrowserAudioContext) return;

        const context = audioContextRef.current ?? new BrowserAudioContext();
        audioContextRef.current = context;
        if (context.state === 'suspended') {
            context.resume().catch(() => undefined);
        }

        const now = context.currentTime;
        const frequency = cueLabel.toLowerCase().includes('whistle')
            ? 1180
            : cueLabel.toLowerCase().includes('buzzer')
                ? 220
                : 540;

        [0, 0.16, 0.34].forEach((offset) => {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = cueLabel.toLowerCase().includes('crowd') ? 'sawtooth' : 'square';
            oscillator.frequency.setValueAtTime(frequency, now + offset);
            gain.gain.setValueAtTime(0.0001, now + offset);
            gain.gain.exponentialRampToValueAtTime(cueLabel.toLowerCase().includes('crowd') ? 0.06 : 0.12, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.14);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(now + offset);
            oscillator.stop(now + offset + 0.16);
        });
    }, [getAudioCueAssetUrl, soundEnabled]);

    const selectDisruption = useCallback((): DisruptionType => {
        if (variantArchetype === 'visual_channel') return 'visual';
        if (variantArchetype === 'audio_channel') return 'audio';
        if (variantArchetype === 'combined_channel') return 'combined';
        if (variantArchetype === 'cognitive_pressure') return 'cognitive';
        if (variantArchetype === 'immersive') return 'immersive';
        switch (currentTier) {
            case 'foundation': return 'visual';
            case 'sharpening': return Math.random() > 0.5 ? 'visual' : 'cognitive';
            case 'pressure': return ['visual', 'cognitive', 'combined'][Math.floor(Math.random() * 3)] as DisruptionType;
            case 'elite': return 'combined';
        }
    }, [currentTier, variantArchetype]);

    // Start pulse animation for rhythm task
    const triggerPulseBeat = useCallback(() => {
        expectedTapTimeRef.current = Date.now();
        setPulseScale(1.3);
        scheduleTimeout(() => {
            setPulseScale(1);
        }, 420);
    }, [scheduleTimeout]);

    const startPulseAnimation = useCallback(() => {
        if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
        setPulseScale(1);
        triggerPulseBeat();
        pulseTimerRef.current = setInterval(() => {
            triggerPulseBeat();
        }, 1200);
    }, [triggerPulseBeat]);

    // Start tracking animation
    const startTrackingAnimation = useCallback(() => {
        setNoisePoints(
            Array.from({ length: 6 }, () => ({
                x: Math.random() * 80 + 10,
                y: Math.random() * 80 + 10,
            }))
        );
        if (trackingTimerRef.current) clearInterval(trackingTimerRef.current);
        trackingTimerRef.current = setInterval(() => {
            setTrackingPos({
                x: Math.random() * 70 + 15,
                y: Math.random() * 70 + 15,
            });
            scheduleTimeout(() => {
                expectedTapTimeRef.current = Date.now();
            }, 2000);
        }, 2500);
    }, [scheduleTimeout]);

    // Generate and show sequence
    const showSequence = useCallback((targets: number[]) => {
        setShowingSequence(true);
        setSequenceHighlight(-1);
        setSequenceInputs([]);
        targets.forEach((t, i) => {
            scheduleTimeout(() => setSequenceHighlight(t), (i + 1) * 700);
            scheduleTimeout(() => setSequenceHighlight(-1), (i + 1) * 700 + 400);
        });
        scheduleTimeout(() => {
            setShowingSequence(false);
            expectedTapTimeRef.current = Date.now();
        }, targets.length * 700 + 500);
    }, [scheduleTimeout]);

    // Clear disruption effects
    const clearDisruption = useCallback(() => {
        setFlashActive(false);
        setScrambled(false);
        setShowProvocMessage(false);
        setAudioCueLabel('');
        setAudioPulseActive(false);
        setImmersiveCueLabel('');
        setImmersiveFieldActive(false);
        setSecondChancePromptActive(false);
        setDisruptionActive(false);
        setPhaseCountdown(null);
        setPulseScale(1);
    }, []);

    // Trigger disruption
    const triggerDisruption = useCallback(() => {
        setPhase('disruption');
        setDisruptionActive(true);
        setPhaseMessage('Disruption active. Hold steady, then reset immediately.');
        setPhaseCountdown(tierConfig.disruptionDuration);

        // Pre-disruption accuracy
        const hits = tapAccuracy.filter(Boolean).length;
        const total = tapAccuracy.length;
        preHitsRef.current += hits;
        preTotalRef.current += total;

        // Stop focus task timers
        if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
        if (trackingTimerRef.current) clearInterval(trackingTimerRef.current);

        // Apply disruption
        const dt = selectDisruption();

        if (dt === 'visual' || dt === 'combined') {
            setFlashActive(true);
            setScrambled(true);
            scheduleTimeout(() => setFlashActive(false), 150);
            scheduleTimeout(() => setFlashActive(true), 300);
            scheduleTimeout(() => setFlashActive(false), 450);
        }
        if (dt === 'audio' || dt === 'combined') {
            const cueLabel = getAudioCueLabel();
            setAudioCueLabel(cueLabel);
            setAudioPulseActive(true);
            playAudioDisruption(cueLabel);
            scheduleTimeout(() => setAudioPulseActive(false), 520);
        }
        if (dt === 'immersive') {
            const immersiveLabels = [
                'Chamber Shift',
                'Spatial Drift',
                'Tunnel Collapse',
                'Field Reorientation',
            ];
            setImmersiveCueLabel(immersiveLabels[Math.floor(Math.random() * immersiveLabels.length)]);
            setImmersiveFieldActive(true);
            setFlashActive(true);
            scheduleTimeout(() => setFlashActive(false), 180);
            scheduleTimeout(() => setFlashActive(true), 460);
            scheduleTimeout(() => setFlashActive(false), 760);
        }
        if (dt === 'cognitive' || dt === 'combined') {
            setProvocMessage(PROVOCATIVE_MESSAGES[Math.floor(Math.random() * PROVOCATIVE_MESSAGES.length)]);
            setShowProvocMessage(true);
        }

        const disruptionStartedAt = Date.now();
        const disruptionCountdownInterval = setInterval(() => {
            const remaining = Math.max(0, tierConfig.disruptionDuration - ((Date.now() - disruptionStartedAt) / 1000));
            setPhaseCountdown(remaining);
            if (remaining <= 0) {
                clearInterval(disruptionCountdownInterval);
            }
        }, 100);
        timeoutRefs.current.push(disruptionCountdownInterval as unknown as ReturnType<typeof setTimeout>);

        // After disruption duration → reset breath → reset
        scheduleTimeout(() => {
            clearInterval(disruptionCountdownInterval);
            clearDisruption();
            setPhase('resetBreath');
            setShowReset(true);
            setPhaseMessage('Reset cue. Breathe, then re-engage the same task.');
            setPhaseCountdown(0.8);

            const resetStartedAt = Date.now();
            const resetCountdownInterval = setInterval(() => {
                const remaining = Math.max(0, 0.8 - ((Date.now() - resetStartedAt) / 1000));
                setPhaseCountdown(remaining);
                if (remaining <= 0) {
                    clearInterval(resetCountdownInterval);
                }
            }, 100);
            timeoutRefs.current.push(resetCountdownInterval as unknown as ReturnType<typeof setTimeout>);
            scheduleTimeout(() => {
                clearInterval(resetCountdownInterval);
                setShowReset(false);
                setPhase('reengage');
                disruptionEndRef.current = Date.now();
                recoveryStartedRef.current = false;
                setTapAccuracy([]);
                setSequenceInputs([]);
                setSecondChancePromptActive(false);
                setPhaseCountdown(null);
                setPhaseMessage(currentTier === 'foundation'
                    ? 'Tap in rhythm as soon as you have the target again.'
                    : currentTier === 'sharpening'
                        ? 'Track the live cue immediately after the reset.'
                        : variantArchetype === 'immersive'
                            ? 'Re-anchor to the same target immediately inside the chamber.'
                            : 'Re-enter the same sequence cleanly and fast.'
                );

                // Restart focus task
                if (currentTier === 'foundation') startPulseAnimation();
                if (currentTier === 'sharpening') startTrackingAnimation();
                if (currentTier === 'pressure' || currentTier === 'elite') {
                    const seqLen = currentTier === 'elite' ? 5 : 4;
                    const targets = Array.from({ length: seqLen }, () => Math.floor(Math.random() * 4));
                    setSequenceTargets(targets);
                    showSequence(targets);
                }
            }, 800);
        }, tierConfig.disruptionDuration * 1000);
    }, [tapAccuracy, selectDisruption, clearDisruption, tierConfig.disruptionDuration, currentTier, startPulseAnimation, startTrackingAnimation, showSequence, getAudioCueLabel, playAudioDisruption, scheduleTimeout, variantArchetype]);

    // Start lock-in phase
    const startLockInPhase = useCallback(() => {
        setPhase('lockIn');
        setTapAccuracy([]);
        recoveryStartedRef.current = false;
        setSecondChancePromptActive(false);
        resetInputRound();
        setPhaseMessage('Lock in on the primary task. The disruption is coming.');
        const duration = tierConfig.lockInDuration;
        setLockInRemaining(duration);
        setPhaseCountdown(duration);
        setPulseScale(1);

        // Start focus task
        if (currentTier === 'foundation') startPulseAnimation();
        if (currentTier === 'sharpening') startTrackingAnimation();
        if (currentTier === 'pressure' || currentTier === 'elite') {
            const seqLen = currentTier === 'elite' ? 5 : 4;
            const targets = Array.from({ length: seqLen }, () => Math.floor(Math.random() * 4));
            setSequenceTargets(targets);
            showSequence(targets);
        }

        // Lock-in countdown
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);
        const startTime = Date.now();
        gameTimerRef.current = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            const remaining = duration - elapsed;
            if (remaining <= 0) {
                if (gameTimerRef.current) clearInterval(gameTimerRef.current);
                gameTimerRef.current = null;
                setPhaseCountdown(null);
                triggerDisruption();
            } else {
                setLockInRemaining(remaining);
                setPhaseCountdown(remaining);
            }
        }, 100);
    }, [currentTier, resetInputRound, showSequence, startPulseAnimation, startTrackingAnimation, tierConfig.lockInDuration, triggerDisruption]);

    // Start next round
    const startNextRound = useCallback(() => {
        setCurrentRound((prev) => prev + 1);
        setGameState('playing');
        setDisruptionActive(false);
        setShowReset(false);
        setShowProvocMessage(false);
        setScrambled(false);
        setFlashActive(false);
        startLockInPhase();
    }, [startLockInPhase]);

    // Start session
    const startSession = useCallback(() => {
        setCurrentRound(0);
        setRoundRecoveryTimes([]);
        preHitsRef.current = 0;
        preTotalRef.current = 0;
        postHitsRef.current = 0;
        postTotalRef.current = 0;
        resetInputSession();
        sessionStartRef.current = Date.now();
        startNextRound();
    }, [resetInputSession, startNextRound]);

    // End round
    const endRound = useCallback(() => {
        finalizeInputRound();
        cleanup();
        scheduleTimeout(() => setGameState('roundResult'), 300);
    }, [cleanup, finalizeInputRound, scheduleTimeout]);

    // Handle focus task tap
    const handleFocusTaskTap = useCallback(() => {
        const now = Date.now();
        if (phase === 'reengage') {
            if (!registerInputAttempt({ blockedMessage: 'Too fast. Wait for the live target before re-entering.' })) {
                setPhaseMessage('Too fast. Wait for the live target before re-entering.');
                return;
            }
        }
        const diff = Math.abs(now - expectedTapTimeRef.current);
        const accurate = diff < 400;
        setTapAccuracy((prev) => [...prev, accurate]);

        if (phase === 'reengage' && !recoveryStartedRef.current && accurate) {
            recoveryStartedRef.current = true;
            const recoveryTime = Math.max(0.1, (now - disruptionEndRef.current) / 1000);
            setRoundRecoveryTimes((prev) => [...prev, recoveryTime]);
            postHitsRef.current += 1;
            postTotalRef.current += 1;
            endRound();
        } else if (phase === 'reengage') {
            postHitsRef.current += accurate ? 1 : 0;
            postTotalRef.current += 1;
            if (!accurate && isSecondChanceVariant && !secondChancePromptActive) {
                setSecondChancePromptActive(true);
                setPhaseMessage('Missed the first recovery. Second chance - reclaim the same target now.');
            }
        }
    }, [endRound, isSecondChanceVariant, phase, registerInputAttempt, secondChancePromptActive]);

    // Handle sequence tap
    const handleSequenceTap = useCallback((index: number) => {
        if (showingSequence) return;
        if (phase === 'reengage') {
            if (!registerInputAttempt({ blockedMessage: 'Too fast. Wait for the live target before committing again.' })) {
                setPhaseMessage('Too fast. Wait for the live target before committing again.');
                return;
            }
        }
        setSequenceInputs((prev) => {
            const next = [...prev, index];
            const inputIndex = next.length - 1;
            if (inputIndex < sequenceTargets.length) {
                const correct = next[inputIndex] === sequenceTargets[inputIndex];
                setTapAccuracy((prevAcc) => [...prevAcc, correct]);
                if (phase === 'reengage' && !correct && isSecondChanceVariant && !secondChancePromptActive) {
                    setSecondChancePromptActive(true);
                    setPhaseMessage('First re-entry missed. Settle immediately and take the second chance cleanly.');
                }
            }
            // Sequence complete
            if (next.length >= sequenceTargets.length) {
                if (phase === 'reengage' && !recoveryStartedRef.current) {
                    recoveryStartedRef.current = true;
                    const now = Date.now();
                    const recoveryTime = Math.max(0.1, (now - disruptionEndRef.current) / 1000);
                    setRoundRecoveryTimes((prevTimes) => [...prevTimes, recoveryTime]);
                    postHitsRef.current += tapAccuracy.filter(Boolean).length;
                    postTotalRef.current += tapAccuracy.length;
                    endRound();
                }
            }
            return next;
        });
        setSequenceHighlight(index);
        scheduleTimeout(() => setSequenceHighlight(-1), 150);
    }, [endRound, isSecondChanceVariant, phase, registerInputAttempt, secondChancePromptActive, sequenceTargets, showingSequence, tapAccuracy]);

    // ============================================================================
    // DERIVED VALUES
    // ============================================================================

    const avgRecovery = roundRecoveryTimes.length > 0
        ? roundRecoveryTimes.reduce((a, b) => a + b, 0) / roundRecoveryTimes.length
        : 0;
    const bestRecovery = roundRecoveryTimes.length > 0 ? Math.min(...roundRecoveryTimes) : 0;
    const worstRecovery = roundRecoveryTimes.length > 0 ? Math.max(...roundRecoveryTimes) : 0;
    const delta = worstRecovery - bestRecovery;
    const lastRecovery = roundRecoveryTimes[roundRecoveryTimes.length - 1] ?? 0;
    const isBest = lastRecovery === bestRecovery && roundRecoveryTimes.length > 1;
    const isLastRound = currentRound >= totalRounds;

    const variance = (() => {
        if (roundRecoveryTimes.length <= 1) return 0;
        const mean = avgRecovery;
        return Math.sqrt(roundRecoveryTimes.reduce((sum, t) => sum + (t - mean) ** 2, 0) / roundRecoveryTimes.length);
    })();

    const consistencyLabel = variance < 0.3 ? 'Excellent' : variance < 0.6 ? 'Good' : variance < 1.0 ? 'Developing' : 'Variable';

    const resilienceScore = preTotalRef.current > 0 && postTotalRef.current > 0
        ? Math.min(100, Math.round(
            (postHitsRef.current / postTotalRef.current) /
            Math.max(0.01, preHitsRef.current / preTotalRef.current) * 100
        ))
        : 100;

    const metTarget = avgRecovery > 0 && avgRecovery <= tierConfig.recoveryTarget && !spamDetected;

    const totalElapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);

    // Save session progress to Firestore and check for advancement
    const saveSessionProgress = useCallback(async () => {
        if (!currentUser?.id || roundRecoveryTimes.length === 0) return;

        const durationMode =
            totalElapsed >= 300 ? DurationMode.ExtendedStressTest :
            totalElapsed >= 150 ? DurationMode.StandardRep :
            DurationMode.QuickProbe;
        const normalizedScore = Math.max(
            0,
            Math.min(
                100,
                Math.round(
                    ((Math.max(0, 100 - avgRecovery * 22) * 0.6) +
                        (Math.max(0, 100 - variance * 40) * 0.2) +
                        (resilienceScore * 0.2)) * 10
                ) / 10
            )
        );

        const sessionRecord = {
            sessionDate: Date.now(),
            tier: tierNumber,
            avgRecoveryTime: avgRecovery,
            consistencyIndex: variance,
            resilienceScore,
            metTarget,
            spamDetected,
            spamFlags,
            spamRounds,
            roundCount: roundRecoveryTimes.length,
        };

        if (previewMode) {
            return;
        }
        try {
            const [result] = await Promise.all([
                gameLevelProgressService.recordSession(
                    currentUser.id,
                    'reset',
                    sessionRecord
                ),
                simSessionService.recordSession({
                    userId: currentUser.id,
                    simId: 'reset',
                    simName: 'Reset',
                    legacyExerciseId: exercise.id,
                    sessionType: avgRecovery <= tierConfig.recoveryTarget ? SessionType.TrainingRep : SessionType.Reassessment,
                    durationMode,
                    durationSeconds: totalElapsed,
                    coreMetricName: 'recovery_time',
                    coreMetricValue: avgRecovery,
                    supportingMetrics: {
                        recovery_trend: delta,
                        disruption_resilience_score: resilienceScore,
                        consistency_index: variance,
                        rapid_input_flags: spamFlags,
                        rapid_input_rounds: spamRounds,
                        flagged_for_spam: spamDetected ? 1 : 0,
                        worst_to_best_delta: delta,
                        best_recovery: bestRecovery,
                        worst_recovery: worstRecovery,
                        tier: tierNumber,
                    },
                    normalizedScore,
                    targetSkills: [
                        TaxonomySkill.ErrorRecoverySpeed,
                        TaxonomySkill.AttentionalShifting,
                        TaxonomySkill.PressureStability,
                    ],
                    pressureTypes: [
                        PressureType.Visual,
                        PressureType.Evaluative,
                        PressureType.CompoundingError,
                    ],
                    profileSnapshotMilestone,
                    createdAt: Date.now(),
                }),
            ]);

            await athleteProgressService.syncTaxonomyProfile(currentUser.id);
            setLevelProgress(result.progress);
            setAdvancementResult(result.advancementResult);

            if (result.advanced) {
                setShowAdvancement(true);
            }
        } catch (err) {
            console.error('Failed to save session progress:', err);
        }
    }, [bestRecovery, currentUser?.id, delta, exercise.id, metTarget, previewMode, resilienceScore, roundRecoveryTimes, spamDetected, spamFlags, spamRounds, tierConfig.recoveryTarget, tierNumber, totalElapsed, variance, avgRecovery, worstRecovery]);

    // ============================================================================
    // RENDER HELPERS
    // ============================================================================

    const moodEmoji = (v: number) => MOODS.find((m) => m.value === v)?.emoji ?? '😐';

    // ============================================================================
    // RENDER
    // ============================================================================

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0a0a0b] overflow-hidden select-none"
        >
            {/* Ambient background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] transition-colors duration-700 ${showReset ? 'bg-cyan-500/15' : disruptionActive ? 'bg-red-500/10' : 'bg-red-500/8'
                        }`}
                />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[120px] bg-[#E0FE10]/5" />
            </div>

            {/* Flash overlay */}
            <AnimatePresence>
                {flashActive && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-red-500 z-40 pointer-events-none"
                    />
                )}
            </AnimatePresence>

            {/* Top bar */}
            {gameState === 'playing' && (
                <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-4">
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5 text-white/60" />
                    </button>

                    {/* Round dots */}
                    <div className="flex gap-1.5">
                        {Array.from({ length: totalRounds }).map((_, i) => (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full transition-colors ${i < currentRound ? 'bg-[#E0FE10]' : i === currentRound ? 'bg-red-500' : 'bg-white/20'
                                    }`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        {soundEnabled
                            ? <Volume2 className="w-5 h-5 text-white/60" />
                            : <VolumeX className="w-5 h-5 text-white/60" />
                        }
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="relative z-20 h-full flex flex-col items-center justify-center">
                <AnimatePresence mode="wait">

                    {/* ============ INTRO ============ */}
                    {gameState === 'intro' && (
                        <motion.div
                            key="intro"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="text-center max-w-lg mx-auto px-6"
                        >
                            {/* Close button */}
                            <button
                                onClick={handleClose}
                                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5 text-white/60" />
                            </button>

                            {/* Icon */}
                            <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                className="mx-auto w-28 h-28 rounded-full bg-red-500/20 flex items-center justify-center mb-6 relative"
                            >
                                <div className="absolute inset-0 rounded-full bg-red-500/10 blur-xl" />
                                <Zap className="w-14 h-14 text-red-500 relative z-10" />
                            </motion.div>

                            <h1 className="text-3xl font-black text-white tracking-wider mb-2">
                                {variantTitle.toUpperCase()}
                            </h1>
                            <p className="text-red-400/80 font-medium mb-6">{variantSubtitle}</p>

                            {/* Tier selector */}
                            <div className="mb-6">
                                <p className="text-white/40 text-xs font-bold tracking-widest mb-3">SELECT TIER</p>
                                <div className="grid grid-cols-4 gap-2">
                                    {[1, 2, 3, 4].map((tier) => {
                                        const unlocked = levelProgress?.unlockedTiers?.includes(tier) ?? tier === 1;
                                        const selected = tierNumber === tier;
                                        const tierTarget = [3.0, 2.0, 1.5, 1.0][tier - 1];
                                        return (
                                            <button
                                                key={tier}
                                                disabled={!unlocked}
                                                onClick={() => unlocked && selectTier(tier)}
                                                className={`relative p-3 rounded-xl border transition-all ${selected
                                                    ? 'bg-red-500/20 border-red-500/60 ring-1 ring-red-500/30'
                                                    : unlocked
                                                        ? 'bg-white/5 border-white/10 hover:bg-white/10'
                                                        : 'bg-white/2 border-white/5 opacity-40 cursor-not-allowed'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-center mb-1">
                                                    {unlocked ? (
                                                        <span className={`text-lg font-black ${selected ? 'text-red-400' : 'text-white'}`}>{tier}</span>
                                                    ) : (
                                                        <Lock className="w-4 h-4 text-white/30" />
                                                    )}
                                                </div>
                                                <p className={`text-[10px] font-medium ${selected ? 'text-red-400' : 'text-white/50'}`}>
                                                    {TIER_DISPLAY_NAMES[tier]}
                                                </p>
                                                <p className="text-[9px] text-white/30 mt-0.5">
                                                    &lt; {tierTarget}s
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Progression info */}
                            {levelProgress && levelProgress.totalSessions > 0 && (
                                <div className="p-3 rounded-xl bg-white/3 border border-white/8 mb-6 text-left">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-white/50">Sessions played</span>
                                        <span className="text-white font-bold">{levelProgress.totalSessions}</span>
                                    </div>
                                    {levelProgress.bestAvgRecoveryTime && (
                                        <div className="flex items-center justify-between text-sm mt-1.5">
                                            <span className="text-white/50">Best avg recovery</span>
                                            <span className="text-[#E0FE10] font-bold">{levelProgress.bestAvgRecoveryTime.toFixed(1)}s</span>
                                        </div>
                                    )}
                                    {tierNumber < 4 && (
                                        <div className="flex items-center justify-between text-sm mt-1.5">
                                            <span className="text-white/50">Qualifying sessions</span>
                                            <span className="text-white font-bold">
                                                {levelProgress.tierHistory.filter(s => s.tier === tierNumber && s.metTarget).length}/3
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center justify-center gap-5 text-white/50 text-sm mb-6">
                                <span>2–4 min</span>
                                <span>•</span>
                                <span>{totalRounds} rounds</span>
                                <span>•</span>
                                <span>Target: &lt; {tierConfig.recoveryTarget}s</span>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setGameState('preMood')}
                                disabled={progressLoading}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-lg shadow-lg shadow-red-500/20 disabled:opacity-50"
                            >
                                {progressLoading ? 'Loading...' : 'Begin Training'}
                            </motion.button>
                        </motion.div>
                    )}

                    {/* ============ PRE-MOOD ============ */}
                    {gameState === 'preMood' && (
                        <motion.div
                            key="preMood"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="text-center max-w-lg mx-auto px-6"
                        >
                            <h2 className="text-2xl font-bold text-white mb-2">Before we begin...</h2>
                            <p className="text-white/60 mb-10">How are you feeling right now?</p>
                            <div className="flex justify-center gap-4">
                                {MOODS.map((mood) => (
                                    <motion.button
                                        key={mood.value}
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => {
                                            setPreExerciseMood(mood.value);
                                            setGameState('playing');
                                            startSession();
                                        }}
                                        className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                        <span className="text-4xl">{mood.emoji}</span>
                                        <span className="text-sm text-white/60">{mood.label}</span>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ============ PLAYING ============ */}
                    {gameState === 'playing' && (
                        <motion.div
                            key="playing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full h-full flex flex-col items-center justify-center pt-16 pb-8 px-6"
                        >
                            {/* Lock In Phase */}
                            {phase === 'lockIn' && (
                                <div className="flex flex-col items-center gap-6 w-full max-w-md">
                                    {/* Phase label */}
                                    <div className="flex items-center gap-2 self-start">
                                        <div className="w-2 h-2 rounded-full bg-[#E0FE10]" />
                                        <span className="text-[#E0FE10] text-xs font-bold tracking-widest">LOCK IN</span>
                                    </div>

                                    <div className="flex-1 flex items-center justify-center min-h-[300px]">
                                        {/* Foundation: Rhythm tap */}
                                        {currentTier === 'foundation' && (
                                            <div className="flex flex-col items-center gap-6">
                                                <p className="text-white/50 text-sm">Tap in rhythm with the pulse</p>
                                                <motion.button
                                                    onClick={handleFocusTaskTap}
                                                    animate={{ scale: pulseScale }}
                                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                    className="relative w-32 h-32 rounded-full flex items-center justify-center"
                                                >
                                                    <div className="absolute inset-0 rounded-full bg-[#E0FE10]/15 blur-xl" style={{ transform: `scale(${pulseScale * 1.3})` }} />
                                                    <div className="absolute inset-0 rounded-full border-2 border-[#E0FE10]/30" />
                                                    <div className="w-20 h-20 rounded-full bg-gradient-radial from-[#E0FE10] to-[#E0FE10]/60 flex items-center justify-center">
                                                        <div className="w-3 h-3 rounded-full bg-white" />
                                                    </div>
                                                </motion.button>
                                                {tapAccuracy.length > 0 && (
                                                    <div className="flex gap-1">
                                                        {tapAccuracy.slice(-8).map((acc, i) => (
                                                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${acc ? 'bg-[#E0FE10]' : 'bg-red-500/50'}`} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Sharpening: Tracking */}
                                        {currentTier === 'sharpening' && (
                                            <div className="relative w-full h-[300px] rounded-2xl bg-white/3 border border-white/8">
                                                {noisePoints.map((p, i) => (
                                                    <div
                                                        key={i}
                                                        className="absolute w-3 h-3 rounded-full bg-white/15"
                                                        style={{ left: `${p.x}%`, top: `${p.y}%` }}
                                                    />
                                                ))}
                                                <motion.button
                                                    onClick={handleFocusTaskTap}
                                                    animate={{ left: `${trackingPos.x}%`, top: `${trackingPos.y}%` }}
                                                    transition={{ duration: 2, ease: 'easeInOut' }}
                                                    className="absolute w-12 h-12 -ml-6 -mt-6 flex items-center justify-center"
                                                >
                                                    <div className="absolute w-14 h-14 rounded-full bg-[#E0FE10]/20 blur-md" />
                                                    <div className="w-6 h-6 rounded-full bg-[#E0FE10] flex items-center justify-center">
                                                        <div className="w-2 h-2 rounded-full bg-white" />
                                                    </div>
                                                </motion.button>
                                            </div>
                                        )}

                                        {/* Pressure/Elite: Sequence */}
                                        {(currentTier === 'pressure' || currentTier === 'elite') && (
                                            <div className="flex flex-col items-center gap-5 w-full">
                                                <p className="text-[#E0FE10] text-xs font-bold tracking-widest">
                                                    {showingSequence ? 'MEMORIZE THE SEQUENCE' : 'TAP THE SEQUENCE'}
                                                </p>
                                                <div className="grid grid-cols-2 gap-4 w-64">
                                                    {[0, 1, 2, 3].map((idx) => (
                                                        <motion.button
                                                            key={idx}
                                                            onClick={() => handleSequenceTap(idx)}
                                                            disabled={showingSequence}
                                                            animate={{
                                                                scale: sequenceHighlight === idx ? 1.05 : 1,
                                                                borderColor: sequenceHighlight === idx ? '#E0FE10' : 'rgba(255,255,255,0.1)',
                                                            }}
                                                            className={`h-24 rounded-2xl border-2 transition-colors ${showingSequence
                                                                ? sequenceHighlight === idx ? 'bg-[#E0FE10]/40' : 'bg-white/5'
                                                                : sequenceInputs.includes(idx) ? 'bg-[#E0FE10]/20' : 'bg-white/5'
                                                                }`}
                                                        />
                                                    ))}
                                                </div>
                                                {!showingSequence && (
                                                    <div className="flex gap-1">
                                                        {sequenceTargets.map((_, i) => (
                                                            <div key={i} className={`w-2 h-2 rounded-full ${i < sequenceInputs.length ? 'bg-[#E0FE10]' : 'bg-white/20'}`} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Timer bar */}
                                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-[#E0FE10]/40 rounded-full"
                                            animate={{ width: `${(lockInRemaining / tierConfig.lockInDuration) * 100}%` }}
                                            transition={{ duration: 0.2 }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Disruption Phase */}
                            {phase === 'disruption' && (
                                <div className="flex flex-col items-center justify-center h-full">
                                    <div className="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-center">
                                        <p className="text-red-300 text-[11px] font-bold tracking-[0.35em] uppercase">Disruption</p>
                                        <p className="text-white/55 text-sm">{phaseMessage}</p>
                                        {phaseCountdown !== null && (
                                            <p className="text-white/35 text-xs">{phaseCountdown.toFixed(1)}s until reset cue</p>
                                        )}
                                    </div>
                                    {showProvocMessage && (
                                        <motion.p
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="text-4xl font-black text-red-500 text-center px-8"
                                        >
                                            {provocMessage}
                                        </motion.p>
                                    )}
                                    {audioCueLabel && (
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="flex flex-col items-center gap-4"
                                        >
                                            <div className="relative w-40 h-40 flex items-center justify-center">
                                                <motion.div
                                                    animate={{ scale: audioPulseActive ? [0.9, 1.25, 0.95] : 1, opacity: audioPulseActive ? [0.35, 0.12, 0.28] : 0.2 }}
                                                    transition={{ duration: 0.45, ease: 'easeInOut' }}
                                                    className="absolute inset-0 rounded-full border border-red-400/30 bg-red-500/10"
                                                />
                                                <motion.div
                                                    animate={{ scale: audioPulseActive ? [0.75, 1.05, 0.85] : 0.8 }}
                                                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                                                    className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center"
                                                >
                                                    <Volume2 className="w-9 h-9 text-red-300" />
                                                </motion.div>
                                            </div>
                                            <p className="text-2xl font-black text-red-300 tracking-wide uppercase text-center">{audioCueLabel}</p>
                                        </motion.div>
                                    )}
                                    {immersiveFieldActive && (
                                        <motion.div
                                            initial={{ scale: 0.92, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="flex flex-col items-center gap-5"
                                        >
                                            <div className="relative w-64 h-64 flex items-center justify-center">
                                                <motion.div
                                                    animate={{ scale: [0.92, 1.08, 0.96], opacity: [0.16, 0.4, 0.18] }}
                                                    transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
                                                    className="absolute inset-0 rounded-full border border-cyan-400/20"
                                                />
                                                <motion.div
                                                    animate={{ scale: [0.74, 0.98, 0.8], opacity: [0.2, 0.32, 0.16] }}
                                                    transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                                                    className="absolute inset-10 rounded-full border border-red-400/20"
                                                />
                                                <motion.div
                                                    animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.04, 0.98, 1] }}
                                                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                                                    className="w-24 h-24 rounded-full bg-cyan-500/10 border border-cyan-300/25 flex items-center justify-center"
                                                >
                                                    <Shield className="w-10 h-10 text-cyan-200" />
                                                </motion.div>
                                            </div>
                                            <div className="text-center space-y-2">
                                                <p className="text-2xl font-black text-cyan-200 tracking-wide uppercase">{immersiveCueLabel}</p>
                                                <p className="text-white/55 text-sm">Environmental fidelity surges. Keep the same reset target.</p>
                                            </div>
                                        </motion.div>
                                    )}
                                    {scrambled && (
                                        <div className="absolute inset-0 pointer-events-none">
                                            {Array.from({ length: 8 }).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="absolute rounded-full bg-red-500"
                                                    style={{
                                                        width: `${20 + Math.random() * 40}px`,
                                                        height: `${20 + Math.random() * 40}px`,
                                                        left: `${10 + Math.random() * 80}%`,
                                                        top: `${10 + Math.random() * 80}%`,
                                                        opacity: 0.2 + Math.random() * 0.4,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Reset Breath */}
                            {phase === 'resetBreath' && (
                                <div className="flex flex-col items-center gap-6">
                                    <div className="text-center space-y-2">
                                        <p className="text-cyan-300 text-[11px] font-bold tracking-[0.35em] uppercase">Reset Cue</p>
                                        <p className="text-white/55 text-sm">{phaseMessage}</p>
                                        {phaseCountdown !== null && (
                                            <p className="text-white/35 text-xs">{phaseCountdown.toFixed(1)}s</p>
                                        )}
                                    </div>
                                    <motion.div
                                        animate={{ scale: showReset ? 1.2 : 0.8 }}
                                        transition={{ duration: 0.8 }}
                                        className="relative"
                                    >
                                        <div className="absolute inset-0 w-40 h-40 rounded-full bg-cyan-500/10 blur-2xl" />
                                        <div className="w-24 h-24 rounded-full border-2 border-cyan-500/30 flex items-center justify-center">
                                            <div className="w-14 h-14 rounded-full bg-cyan-500/20" />
                                        </div>
                                    </motion.div>
                                    <p className="text-cyan-500/60 font-medium">Reset</p>
                                </div>
                            )}

                            {/* Reset Phase */}
                            {phase === 'reengage' && (
                                <div className="flex flex-col items-center gap-6 w-full max-w-md">
                                    <div className="flex items-center gap-2 self-start">
                                        <motion.div
                                            animate={{ opacity: [1, 0.3, 1] }}
                                            transition={{ duration: 0.6, repeat: Infinity }}
                                            className="w-2 h-2 rounded-full bg-red-500"
                                        />
                                        <span className="text-red-500 text-xs font-bold tracking-widest">RECOVER NOW</span>
                                    </div>
                                    <p className="self-start text-sm text-white/55">{phaseMessage}</p>
                                    {spamWarningActive && (
                                        <div className="self-start px-3 py-2 rounded-xl border border-orange-400/30 bg-orange-500/10 text-orange-200 text-xs font-semibold tracking-[0.18em] uppercase">
                                            Rapid input blocked
                                        </div>
                                    )}
                                    {isSecondChanceVariant && secondChancePromptActive && (
                                        <div className="self-start px-3 py-2 rounded-xl border border-amber-400/25 bg-amber-500/10 text-amber-200 text-xs font-semibold tracking-[0.18em] uppercase">
                                            Second chance active
                                        </div>
                                    )}

                                    <div className="flex-1 flex items-center justify-center min-h-[300px]">
                                        {/* Same focus task as lock-in */}
                                        {currentTier === 'foundation' && (
                                            <div className="flex flex-col items-center gap-6">
                                                {variantArchetype === 'immersive' && (
                                                    <p className="text-cyan-300/80 text-xs font-semibold tracking-[0.25em] uppercase">Re-anchor inside the chamber</p>
                                                )}
                                                <motion.button
                                                    onClick={handleFocusTaskTap}
                                                    animate={{ scale: pulseScale }}
                                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                    className="relative w-32 h-32 rounded-full flex items-center justify-center"
                                                >
                                                    <div className={`absolute inset-0 rounded-full blur-xl ${variantArchetype === 'immersive' ? 'bg-cyan-400/15' : 'bg-[#E0FE10]/15'}`} />
                                                    <div className={`absolute inset-0 rounded-full border-2 ${variantArchetype === 'immersive' ? 'border-cyan-300/30' : 'border-[#E0FE10]/30'}`} />
                                                    <div className={`w-20 h-20 rounded-full flex items-center justify-center ${variantArchetype === 'immersive' ? 'bg-gradient-radial from-cyan-300 to-cyan-500/60' : 'bg-gradient-radial from-[#E0FE10] to-[#E0FE10]/60'}`}>
                                                        <div className="w-3 h-3 rounded-full bg-white" />
                                                    </div>
                                                </motion.button>
                                            </div>
                                        )}
                                        {currentTier === 'sharpening' && (
                                            <div className="relative w-full h-[300px] rounded-2xl bg-white/3 border border-white/8">
                                                {noisePoints.map((p, i) => (
                                                    <div key={i} className="absolute w-3 h-3 rounded-full bg-white/15" style={{ left: `${p.x}%`, top: `${p.y}%` }} />
                                                ))}
                                                <motion.button
                                                    onClick={handleFocusTaskTap}
                                                    animate={{ left: `${trackingPos.x}%`, top: `${trackingPos.y}%` }}
                                                    transition={{ duration: 2, ease: 'easeInOut' }}
                                                    className="absolute w-12 h-12 -ml-6 -mt-6 flex items-center justify-center"
                                                >
                                                    <div className="absolute w-14 h-14 rounded-full bg-[#E0FE10]/20 blur-md" />
                                                    <div className="w-6 h-6 rounded-full bg-[#E0FE10] flex items-center justify-center">
                                                        <div className="w-2 h-2 rounded-full bg-white" />
                                                    </div>
                                                </motion.button>
                                            </div>
                                        )}
                                        {(currentTier === 'pressure' || currentTier === 'elite') && (
                                            <div className="flex flex-col items-center gap-5 w-full">
                                                <p className="text-[#E0FE10] text-xs font-bold tracking-widest">
                                                    {showingSequence ? 'MEMORIZE THE SEQUENCE' : 'TAP THE SEQUENCE'}
                                                </p>
                                                <div className="grid grid-cols-2 gap-4 w-64">
                                                    {[0, 1, 2, 3].map((idx) => (
                                                        <motion.button
                                                            key={idx}
                                                            onClick={() => handleSequenceTap(idx)}
                                                            disabled={showingSequence}
                                                            animate={{
                                                                scale: sequenceHighlight === idx ? 1.05 : 1,
                                                                borderColor: sequenceHighlight === idx ? '#E0FE10' : 'rgba(255,255,255,0.1)',
                                                            }}
                                                            className={`h-24 rounded-2xl border-2 transition-colors ${sequenceHighlight === idx ? 'bg-[#E0FE10]/40' : sequenceInputs.includes(idx) ? 'bg-[#E0FE10]/20' : 'bg-white/5'
                                                                }`}
                                                        />
                                                    ))}
                                                </div>
                                                {!showingSequence && (
                                                    <div className="flex gap-1">
                                                        {sequenceTargets.map((_, i) => (
                                                            <div key={i} className={`w-2 h-2 rounded-full ${i < sequenceInputs.length ? 'bg-[#E0FE10]' : 'bg-white/20'}`} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ============ ROUND RESULT ============ */}
                    {gameState === 'roundResult' && (
                        <motion.div
                            key="roundResult"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-center max-w-sm mx-auto px-6"
                        >
                            {/* Recovery time */}
                            <div className="mb-6">
                                <p className={`text-7xl font-black ${isBest ? 'text-[#E0FE10]' : 'text-white'}`}>
                                    {lastRecovery.toFixed(1)}
                                </p>
                                <p className="text-white/50 text-xs font-bold tracking-widest mt-2">SECONDS</p>
                            </div>

                            {isBest && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#E0FE10] text-black text-xs font-bold mb-4"
                                >
                                    <Zap className="w-3 h-3" />
                                    PERSONAL BEST THIS SESSION
                                </motion.div>
                            )}

                            {roundRecoveryTimes.length > 1 && (
                                <p className="text-white/50 text-sm mb-2">
                                    Session avg: <span className="text-white font-bold">{avgRecovery.toFixed(1)}s</span>
                                </p>
                            )}

                            <p className="text-white/40 text-sm mb-10">
                                Round {currentRound} of {totalRounds}
                            </p>

                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => {
                                    if (isLastRound) {
                                        saveSessionProgress();
                                        setGameState('postMood');
                                    } else {
                                        startNextRound();
                                    }
                                }}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-lg shadow-lg"
                            >
                                {isLastRound ? 'View Results' : 'Next Round'}
                                <ChevronRight className="w-5 h-5 inline ml-1" />
                            </motion.button>
                        </motion.div>
                    )}

                    {/* ============ POST-MOOD ============ */}
                    {gameState === 'postMood' && (
                        <motion.div
                            key="postMood"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="text-center max-w-lg mx-auto px-6"
                        >
                            <h2 className="text-2xl font-bold text-white mb-2">Session complete!</h2>
                            <p className="text-white/60 mb-10">How do you feel now?</p>
                            <div className="flex justify-center gap-4">
                                {MOODS.map((mood) => (
                                    <motion.button
                                        key={mood.value}
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => {
                                            setPostExerciseMood(mood.value);
                                            setGameState('summary');
                                        }}
                                        className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                        <span className="text-4xl">{mood.emoji}</span>
                                        <span className="text-sm text-white/60">{mood.label}</span>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ============ SUMMARY ============ */}
                    {gameState === 'summary' && (
                        <motion.div
                            key="summary"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="w-full max-w-lg mx-auto px-6 max-h-[85vh] overflow-y-auto"
                        >
                            {/* Header */}
                            <div className="text-center mb-8">
                                <Zap className="w-12 h-12 text-red-500 mx-auto mb-3" />
                                <h2 className="text-2xl font-black text-white tracking-wider mb-1">SESSION COMPLETE</h2>
                                <p className="text-white/50 text-sm">Reset • {tierConfig.displayName}</p>
                            </div>

                            {/* Hero metric */}
                            <div className={`text-center py-6 rounded-2xl border mb-6 ${metTarget ? 'bg-[#E0FE10]/5 border-[#E0FE10]/30' : 'bg-white/3 border-white/10'
                                }`}>
                                <p className={`text-6xl font-black ${metTarget ? 'text-[#E0FE10]' : 'text-white'}`}>
                                    {avgRecovery.toFixed(1)}
                                </p>
                                <p className="text-white/50 text-xs font-bold tracking-widest mt-2">AVG RECOVERY TIME</p>
                                {spamDetected ? (
                                    <p className="text-orange-300 text-sm mt-2">
                                        Session flagged: rapid-input spamming detected
                                    </p>
                                ) : metTarget ? (
                                    <p className="text-[#E0FE10] text-sm mt-2 flex items-center justify-center gap-1">
                                        ✓ Target met: under {tierConfig.recoveryTarget.toFixed(1)}s
                                    </p>
                                ) : (
                                    <p className="text-white/40 text-sm mt-2">
                                        Target: under {tierConfig.recoveryTarget.toFixed(1)}s
                                    </p>
                                )}
                            </div>

                            {/* Tier Advancement */}
                            {showAdvancement && advancementResult?.nextTier && (
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="p-5 rounded-2xl bg-gradient-to-br from-[#E0FE10]/10 to-[#E0FE10]/5 border border-[#E0FE10]/30 mb-6 text-center"
                                >
                                    <Trophy className="w-10 h-10 text-[#E0FE10] mx-auto mb-2" />
                                    <p className="text-[#E0FE10] text-lg font-black tracking-wider mb-1">TIER UP!</p>
                                    <p className="text-white text-sm">
                                        You unlocked <span className="font-bold text-[#E0FE10]">
                                            {TIER_DISPLAY_NAMES[advancementResult.nextTier]}
                                        </span>
                                    </p>
                                    <p className="text-white/40 text-xs mt-2">
                                        Your consistency and recovery speed earned this promotion
                                    </p>
                                </motion.div>
                            )}

                            {/* Progression toward next tier */}
                            {!showAdvancement && tierNumber < 4 && advancementResult && (
                                <div className="p-4 rounded-2xl bg-white/3 border border-white/8 mb-6">
                                    <p className="text-white/50 text-xs font-bold tracking-widest mb-3">
                                        NEXT TIER: {TIER_DISPLAY_NAMES[tierNumber + 1]}
                                    </p>
                                    <div className="space-y-2">
                                        {[
                                            {
                                                label: `Recovery < ${tierConfig.recoveryTarget}s`,
                                                count: advancementResult.metTargetCount,
                                                met: advancementResult.metTargetCount >= 2,
                                            },
                                            {
                                                label: 'Consistency',
                                                count: advancementResult.consistencyCount,
                                                met: advancementResult.consistencyCount >= 2,
                                            },
                                            {
                                                label: `Resilience ≥ 70%`,
                                                count: advancementResult.resilienceCount,
                                                met: advancementResult.resilienceCount >= 2,
                                            },
                                        ].map((req, i) => (
                                            <div key={i} className="flex items-center justify-between text-sm">
                                                <span className={req.met ? 'text-[#E0FE10]' : 'text-white/50'}>
                                                    {req.met ? '✓' : '○'} {req.label}
                                                </span>
                                                <span className={`font-bold ${req.met ? 'text-[#E0FE10]' : 'text-white/40'}`}>
                                                    {req.count}/3
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Metrics grid */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {[
                                    { icon: <Zap className="w-5 h-5" />, value: `${bestRecovery.toFixed(1)}s`, label: 'Best Recovery', color: 'text-[#E0FE10]' },
                                    { icon: <TrendingDown className="w-5 h-5" />, value: `${delta.toFixed(1)}s`, label: 'Worst-to-Best Δ', color: delta < 1 ? 'text-[#E0FE10]' : 'text-red-500' },
                                    { icon: <Shield className="w-5 h-5" />, value: `${resilienceScore}%`, label: 'Resilience Score', color: resilienceScore >= 80 ? 'text-[#E0FE10]' : resilienceScore >= 60 ? 'text-orange-400' : 'text-red-500' },
                                    { icon: <Activity className="w-5 h-5" />, value: spamDetected ? `${spamFlags} flags` : consistencyLabel, label: spamDetected ? 'Rapid Input Flags' : 'Consistency', color: spamDetected ? 'text-orange-300' : variance < 0.5 ? 'text-[#E0FE10]' : variance < 1 ? 'text-orange-400' : 'text-red-500' },
                                ].map((m, i) => (
                                    <div key={i} className="p-4 rounded-2xl bg-white/3 border border-white/8 text-center">
                                        <div className={`mx-auto mb-2 ${m.color}`}>{m.icon}</div>
                                        <p className="text-white text-xl font-bold">{m.value}</p>
                                        <p className="text-white/50 text-xs mt-1">{m.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Round breakdown */}
                            <div className="p-4 rounded-2xl bg-white/3 mb-6">
                                <p className="text-white/50 text-xs font-bold tracking-widest mb-3">ROUND BREAKDOWN</p>
                                {roundRecoveryTimes.map((time, i) => (
                                    <div key={i} className="flex items-center gap-3 mb-2">
                                        <span className="text-white/50 text-sm w-16">Round {i + 1}</span>
                                        <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${time === bestRecovery ? 'bg-[#E0FE10]' : 'bg-red-500/60'}`}
                                                style={{ width: `${Math.min(100, (time / Math.max(worstRecovery, 1)) * 100)}%` }}
                                            />
                                        </div>
                                        <span className={`text-sm font-bold tabular-nums w-12 text-right ${time === bestRecovery ? 'text-[#E0FE10]' : 'text-white'}`}>
                                            {time.toFixed(1)}s
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Mood change */}
                            {preExerciseMood && postExerciseMood && preExerciseMood !== postExerciseMood && (
                                <div className="flex items-center justify-center gap-3 text-white/60 text-sm mb-6">
                                    <span>Mood: {moodEmoji(preExerciseMood)}</span>
                                    <span>→</span>
                                    <span>{moodEmoji(postExerciseMood)}</span>
                                    {postExerciseMood > preExerciseMood && (
                                        <span className="text-green-400 font-bold">+{postExerciseMood - preExerciseMood}</span>
                                    )}
                                </div>
                            )}

                            {/* Helpfulness */}
                            <div className="text-center mb-8">
                                <p className="text-white/60 mb-4">How helpful was this session?</p>
                                <div className="flex justify-center gap-2 mb-3">
                                    {[1, 2, 3, 4, 5].map((r) => (
                                        <motion.button
                                            key={r}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() =>
                                                onComplete({
                                                    durationSeconds: totalElapsed,
                                                    preExerciseMood,
                                                    postExerciseMood,
                                                    helpfulnessRating: r,
                                                })
                                            }
                                            className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold transition-colors"
                                        >
                                            {r}
                                        </motion.button>
                                    ))}
                                </div>
                                <p className="text-white/30 text-xs">1 = Not helpful · 5 = Very helpful</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default ResetGame;
