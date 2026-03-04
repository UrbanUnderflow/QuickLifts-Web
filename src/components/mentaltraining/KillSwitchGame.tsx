/**
 * Kill Switch Game Component
 *
 * The Kill Switch — Mental Recovery Training Game
 * Trains how fast athletes recover after disruption.
 * Simulates disruption, measures recovery time, and tracks improvement.
 *
 * Three phases per round:
 *   1. Lock In — focus task engagement
 *   2. Disruption — sudden visual/cognitive disruption
 *   3. Kill Switch — re-engage and measure recovery time
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
    Award,
} from 'lucide-react';
import { MentalExercise } from '../../api/firebase/mentaltraining/types';

// ============================================================================
// TYPES
// ============================================================================

type GameState = 'intro' | 'preMood' | 'playing' | 'roundResult' | 'postMood' | 'summary';
type GamePhase = 'lockIn' | 'disruption' | 'resetBreath' | 'killSwitch';
type DisruptionType = 'visual' | 'cognitive' | 'combined';

type KillSwitchTier = 'foundation' | 'sharpening' | 'pressure' | 'elite';

const TIER_CONFIG: Record<KillSwitchTier, {
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

interface KillSwitchGameProps {
    exercise: MentalExercise;
    onComplete: (data: {
        durationSeconds: number;
        preExerciseMood?: number;
        postExerciseMood?: number;
        helpfulnessRating?: number;
    }) => void;
    onClose: () => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const KillSwitchGame: React.FC<KillSwitchGameProps> = ({
    exercise,
    onComplete,
    onClose,
}) => {
    // Game state
    const [gameState, setGameState] = useState<GameState>('intro');
    const [currentRound, setCurrentRound] = useState(0);
    const [currentTier] = useState<KillSwitchTier>('foundation');
    const tierConfig = TIER_CONFIG[currentTier];
    const totalRounds = tierConfig.roundCount;

    // Phase state
    const [phase, setPhase] = useState<GamePhase>('lockIn');
    const [lockInRemaining, setLockInRemaining] = useState(tierConfig.lockInDuration);
    const [disruptionType, setDisruptionType] = useState<DisruptionType>('visual');

    // Focus task state
    const [pulseScale, setPulseScale] = useState(1);
    const [pulseActive, setPulseActive] = useState(false);
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
    const [disruptionActive, setDisruptionActive] = useState(false);
    const [showReset, setShowReset] = useState(false);

    // Recovery measurement
    const disruptionEndRef = useRef<number>(0);
    const recoveryStartedRef = useRef(false);
    const [roundRecoveryTimes, setRoundRecoveryTimes] = useState<number[]>([]);
    const preHitsRef = useRef(0);
    const preTotalRef = useRef(0);
    const postHitsRef = useRef(0);
    const postTotalRef = useRef(0);

    // Mood
    const [preExerciseMood, setPreExerciseMood] = useState<number | undefined>();
    const [postExerciseMood, setPostExerciseMood] = useState<number | undefined>();

    // Timers
    const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pulseTimerRef = useRef<NodeJS.Timeout | null>(null);
    const trackingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sessionStartRef = useRef<number>(Date.now());
    const [soundEnabled, setSoundEnabled] = useState(true);

    // Cleanup all timers
    const cleanup = useCallback(() => {
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);
        if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
        if (trackingTimerRef.current) clearInterval(trackingTimerRef.current);
        gameTimerRef.current = null;
        pulseTimerRef.current = null;
        trackingTimerRef.current = null;
    }, []);

    useEffect(() => () => cleanup(), [cleanup]);

    // ============================================================================
    // GAME LOGIC
    // ============================================================================

    const selectDisruption = useCallback((): DisruptionType => {
        switch (currentTier) {
            case 'foundation': return 'visual';
            case 'sharpening': return Math.random() > 0.5 ? 'visual' : 'cognitive';
            case 'pressure': return ['visual', 'cognitive', 'combined'][Math.floor(Math.random() * 3)] as DisruptionType;
            case 'elite': return 'combined';
        }
    }, [currentTier]);

    // Start pulse animation for rhythm task
    const startPulseAnimation = useCallback(() => {
        if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
        pulseTimerRef.current = setInterval(() => {
            expectedTapTimeRef.current = Date.now();
            setPulseActive(true);
            setPulseScale(1.3);
            setTimeout(() => {
                setPulseScale(1);
                setPulseActive(false);
            }, 600);
        }, 1200);
    }, []);

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
            setTimeout(() => {
                expectedTapTimeRef.current = Date.now();
            }, 2000);
        }, 2500);
    }, []);

    // Generate and show sequence
    const showSequence = useCallback((targets: number[]) => {
        setShowingSequence(true);
        setSequenceHighlight(-1);
        setSequenceInputs([]);
        targets.forEach((t, i) => {
            setTimeout(() => setSequenceHighlight(t), (i + 1) * 700);
            setTimeout(() => setSequenceHighlight(-1), (i + 1) * 700 + 400);
        });
        setTimeout(() => {
            setShowingSequence(false);
            expectedTapTimeRef.current = Date.now();
        }, targets.length * 700 + 500);
    }, []);

    // Clear disruption effects
    const clearDisruption = useCallback(() => {
        setFlashActive(false);
        setScrambled(false);
        setShowProvocMessage(false);
        setDisruptionActive(false);
    }, []);

    // Trigger disruption
    const triggerDisruption = useCallback(() => {
        setPhase('disruption');
        setDisruptionActive(true);

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
        setDisruptionType(dt);

        if (dt === 'visual' || dt === 'combined') {
            setFlashActive(true);
            setScrambled(true);
            setTimeout(() => setFlashActive(false), 150);
            setTimeout(() => setFlashActive(true), 300);
            setTimeout(() => setFlashActive(false), 450);
        }
        if (dt === 'cognitive' || dt === 'combined') {
            setProvocMessage(PROVOCATIVE_MESSAGES[Math.floor(Math.random() * PROVOCATIVE_MESSAGES.length)]);
            setShowProvocMessage(true);
        }

        // After disruption duration → reset breath → kill switch
        setTimeout(() => {
            clearDisruption();
            setPhase('resetBreath');
            setShowReset(true);

            setTimeout(() => {
                setShowReset(false);
                setPhase('killSwitch');
                disruptionEndRef.current = Date.now();
                recoveryStartedRef.current = false;
                setTapAccuracy([]);
                setSequenceInputs([]);

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
    }, [tapAccuracy, selectDisruption, clearDisruption, tierConfig.disruptionDuration, currentTier, startPulseAnimation, startTrackingAnimation, showSequence]);

    // Start lock-in phase
    const startLockInPhase = useCallback(() => {
        setPhase('lockIn');
        setTapAccuracy([]);
        recoveryStartedRef.current = false;
        const duration = tierConfig.lockInDuration;
        setLockInRemaining(duration);

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
                triggerDisruption();
            } else {
                setLockInRemaining(remaining);
            }
        }, 100);
    }, [tierConfig.lockInDuration, currentTier, startPulseAnimation, startTrackingAnimation, showSequence, triggerDisruption]);

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
        sessionStartRef.current = Date.now();
        startNextRound();
    }, [startNextRound]);

    // End round
    const endRound = useCallback(() => {
        cleanup();
        setTimeout(() => setGameState('roundResult'), 300);
    }, [cleanup]);

    // Handle focus task tap
    const handleFocusTaskTap = useCallback(() => {
        const now = Date.now();
        const diff = Math.abs(now - expectedTapTimeRef.current);
        const accurate = diff < 400;
        setTapAccuracy((prev) => [...prev, accurate]);

        if (phase === 'killSwitch' && !recoveryStartedRef.current && accurate) {
            recoveryStartedRef.current = true;
            const recoveryTime = Math.max(0.1, (now - disruptionEndRef.current) / 1000);
            setRoundRecoveryTimes((prev) => [...prev, recoveryTime]);
            postHitsRef.current += 1;
            postTotalRef.current += 1;
            endRound();
        } else if (phase === 'killSwitch') {
            postHitsRef.current += accurate ? 1 : 0;
            postTotalRef.current += 1;
        }
    }, [phase, endRound]);

    // Handle sequence tap
    const handleSequenceTap = useCallback((index: number) => {
        if (showingSequence) return;
        setSequenceInputs((prev) => {
            const next = [...prev, index];
            const inputIndex = next.length - 1;
            if (inputIndex < sequenceTargets.length) {
                const correct = next[inputIndex] === sequenceTargets[inputIndex];
                setTapAccuracy((prevAcc) => [...prevAcc, correct]);
            }
            // Sequence complete
            if (next.length >= sequenceTargets.length) {
                if (phase === 'killSwitch' && !recoveryStartedRef.current) {
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
        setTimeout(() => setSequenceHighlight(-1), 150);
    }, [showingSequence, sequenceTargets, phase, tapAccuracy, endRound]);

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

    const metTarget = avgRecovery > 0 && avgRecovery <= tierConfig.recoveryTarget;

    const totalElapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);

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
                        onClick={() => { cleanup(); onClose(); }}
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
                                onClick={onClose}
                                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5 text-white/60" />
                            </button>

                            {/* Icon */}
                            <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                className="mx-auto w-28 h-28 rounded-full bg-red-500/20 flex items-center justify-center mb-8 relative"
                            >
                                <div className="absolute inset-0 rounded-full bg-red-500/10 blur-xl" />
                                <Zap className="w-14 h-14 text-red-500 relative z-10" />
                            </motion.div>

                            <h1 className="text-3xl font-black text-white tracking-wider mb-2">
                                THE KILL SWITCH
                            </h1>
                            <p className="text-red-400/80 font-medium mb-6">Mental Recovery Training</p>
                            <p className="text-white/60 mb-8 leading-relaxed">
                                Train the single most important mental skill in competitive athletics:
                                how fast you recover after something goes wrong.
                            </p>

                            {/* How it works */}
                            <div className="space-y-3 text-left mb-8">
                                {[
                                    { n: '1', t: 'Lock In', d: 'Complete a focus task', c: 'bg-[#E0FE10] text-black' },
                                    { n: '2', t: 'Disruption', d: 'Something breaks your focus', c: 'bg-red-500 text-white' },
                                    { n: '3', t: 'Kill Switch', d: 'Recover and re-engage FAST', c: 'bg-cyan-500 text-white' },
                                ].map((s) => (
                                    <div key={s.n} className="flex items-center gap-3">
                                        <span className={`w-7 h-7 rounded-lg ${s.c} flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                                            {s.n}
                                        </span>
                                        <div>
                                            <span className="text-white font-semibold text-sm">{s.t}</span>
                                            <span className="text-white/40 text-sm"> — {s.d}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-center gap-5 text-white/50 text-sm mb-8">
                                <span>2–4 min</span>
                                <span>•</span>
                                <span>{totalRounds} rounds</span>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setGameState('preMood')}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-lg shadow-lg shadow-red-500/20"
                            >
                                Begin Training
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
                                    {showProvocMessage && (
                                        <motion.p
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="text-4xl font-black text-red-500 text-center px-8"
                                        >
                                            {provocMessage}
                                        </motion.p>
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

                            {/* Kill Switch Phase */}
                            {phase === 'killSwitch' && (
                                <div className="flex flex-col items-center gap-6 w-full max-w-md">
                                    <div className="flex items-center gap-2 self-start">
                                        <motion.div
                                            animate={{ opacity: [1, 0.3, 1] }}
                                            transition={{ duration: 0.6, repeat: Infinity }}
                                            className="w-2 h-2 rounded-full bg-red-500"
                                        />
                                        <span className="text-red-500 text-xs font-bold tracking-widest">RECOVER NOW</span>
                                    </div>

                                    <div className="flex-1 flex items-center justify-center min-h-[300px]">
                                        {/* Same focus task as lock-in */}
                                        {currentTier === 'foundation' && (
                                            <div className="flex flex-col items-center gap-6">
                                                <motion.button
                                                    onClick={handleFocusTaskTap}
                                                    animate={{ scale: pulseScale }}
                                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                    className="relative w-32 h-32 rounded-full flex items-center justify-center"
                                                >
                                                    <div className="absolute inset-0 rounded-full bg-[#E0FE10]/15 blur-xl" />
                                                    <div className="absolute inset-0 rounded-full border-2 border-[#E0FE10]/30" />
                                                    <div className="w-20 h-20 rounded-full bg-gradient-radial from-[#E0FE10] to-[#E0FE10]/60 flex items-center justify-center">
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
                                <p className="text-white/50 text-sm">The Kill Switch • {tierConfig.displayName}</p>
                            </div>

                            {/* Hero metric */}
                            <div className={`text-center py-6 rounded-2xl border mb-6 ${metTarget ? 'bg-[#E0FE10]/5 border-[#E0FE10]/30' : 'bg-white/3 border-white/10'
                                }`}>
                                <p className={`text-6xl font-black ${metTarget ? 'text-[#E0FE10]' : 'text-white'}`}>
                                    {avgRecovery.toFixed(1)}
                                </p>
                                <p className="text-white/50 text-xs font-bold tracking-widest mt-2">AVG RECOVERY TIME</p>
                                {metTarget ? (
                                    <p className="text-[#E0FE10] text-sm mt-2 flex items-center justify-center gap-1">
                                        ✓ Target met: under {tierConfig.recoveryTarget.toFixed(1)}s
                                    </p>
                                ) : (
                                    <p className="text-white/40 text-sm mt-2">
                                        Target: under {tierConfig.recoveryTarget.toFixed(1)}s
                                    </p>
                                )}
                            </div>

                            {/* Metrics grid */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {[
                                    { icon: <Zap className="w-5 h-5" />, value: `${bestRecovery.toFixed(1)}s`, label: 'Best Recovery', color: 'text-[#E0FE10]' },
                                    { icon: <TrendingDown className="w-5 h-5" />, value: `${delta.toFixed(1)}s`, label: 'Worst-to-Best Δ', color: delta < 1 ? 'text-[#E0FE10]' : 'text-red-500' },
                                    { icon: <Shield className="w-5 h-5" />, value: `${resilienceScore}%`, label: 'Resilience Score', color: resilienceScore >= 80 ? 'text-[#E0FE10]' : resilienceScore >= 60 ? 'text-orange-400' : 'text-red-500' },
                                    { icon: <Activity className="w-5 h-5" />, value: consistencyLabel, label: 'Consistency', color: variance < 0.5 ? 'text-[#E0FE10]' : variance < 1 ? 'text-orange-400' : 'text-red-500' },
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

export default KillSwitchGame;
