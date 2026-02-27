import React, { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Volume2,
    VolumeX,
    Mic,
    MicOff,
    Send,
    Brain,
    Heart,
    Activity,
    AlertTriangle,
    Shield,
    ChevronRight,
    RotateCcw,
    Eye,
    Target,
    Zap,
    Star,
    Wind,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

type DemoAct = 'act1' | 'act2' | 'act3';

interface ScriptMessage {
    role: 'nora' | 'athlete' | 'system';
    content: string;
    delay?: number; // ms delay before showing
    triggerBreathing?: boolean;
    transitionTo?: DemoAct;
    autoAdvance?: boolean; // auto-advance to next message without user input
    autoAdvanceDelay?: number;
}

interface ChatMsg {
    id: string;
    content: string;
    isFromUser: boolean;
    timestamp: number;
}

// ─────────────────────────────────────────────────────────
// DEMO SCRIPT — Act 1 Conversation Flow
// ─────────────────────────────────────────────────────────

const DEMO_SCRIPT: ScriptMessage[] = [
    {
        role: 'nora',
        content: 'Hi Tremaine, today is game day. How are you feeling?',
        delay: 1000,
    },
    // User responds: "I feel okay, just trying to get locked in."
    {
        role: 'nora',
        content:
            'Your baseline looks great today. You had 8 hours of solid sleep, your Resting Heart Rate (RHR) is at 42 bpm, and your HRV baseline is high, indicating excellent central nervous system (CNS) recovery. Your body is primed for today.',
        delay: 1500,
    },
    // User responds: "That's good to hear. Hey what time did Coach say to meet for competition prep today?"
    {
        role: 'nora',
        content:
            "Coach scheduled the competition prep meeting for 10:00 AM in the film room. You've got a couple hours.",
        delay: 1200,
    },
    // User responds: "Cool. I'm not going to lie, I'm a little nervous about today's game."
    {
        role: 'nora',
        content:
            "Talk to me. What is it about today that feels different from the other days? Why does today's game make you nervous?",
        delay: 1500,
    },
    // User responds about anxiety
    {
        role: 'nora',
        content:
            "OK. Let's slow it down.\n\nI want to run you through an exercise called Box Breathing. This is a technique performed by Navy SEALs during acute stress responses to override the body's fight-or-flight system. We can apply it right now, and you can use it again right before you run out of the tunnel.\n\nHere's how it works: Inhale for 4 seconds → Hold for 4 seconds → Exhale for 4 seconds → Hold for 4 seconds. We'll do 4 rounds.\n\nAre you ready?",
        delay: 2000,
    },
    // User responds: "Sure"
    {
        role: 'system',
        content: 'BREATHING_EXERCISE',
        triggerBreathing: true,
    },
    {
        role: 'nora',
        content: 'Great work. How are you feeling now?',
        delay: 1000,
        autoAdvance: true,
        autoAdvanceDelay: 1500,
    },
    // User responds: "I'm still feeling pretty anxious."
    {
        role: 'nora',
        content:
            "That's okay — anxiety before a high-stakes game is completely normal. I have a few other mental frameworks we can run through, but first — would you mind if I notified Coach about how you're feeling so he's in the loop and can support you today?",
        delay: 1500,
    },
    // User responds: "Sure"
    {
        role: 'nora',
        content:
            "Done. I've sent Coach a secure briefing with your physical baseline data and today's conversation context. He'll have the full picture before your 10 AM meeting.\n\nIn the meantime, let me show your coaching staff what they see on their end.",
        delay: 2000,
        autoAdvance: true,
        autoAdvanceDelay: 4000,
        transitionTo: 'act2',
    },
];

// ─────────────────────────────────────────────────────────
// FLOATING ORB COMPONENT
// ─────────────────────────────────────────────────────────

const FloatingOrb: React.FC<{
    color: string;
    size: string;
    position: React.CSSProperties;
    delay?: number;
}> = ({ color, size, position, delay = 0 }) => (
    <motion.div
        className={`absolute ${size} rounded-full blur-3xl pointer-events-none opacity-30`}
        style={{ backgroundColor: color, ...position }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 8, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
);

// ─────────────────────────────────────────────────────────
// BOX BREATHING ANIMATION
// ─────────────────────────────────────────────────────────

const BoxBreathingAnimation: React.FC<{ onComplete: () => void }> = ({
    onComplete,
}) => {
    const phases = ['Inhale', 'Hold', 'Exhale', 'Hold'] as const;
    const [currentPhase, setCurrentPhase] = useState(0);
    const [currentRound, setCurrentRound] = useState(1);
    const [secondsLeft, setSecondsLeft] = useState(4);
    const totalRounds = 2; // shorter for demo

    useEffect(() => {
        const timer = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    // Move to the next phase
                    setCurrentPhase((p) => {
                        const next = p + 1;
                        if (next >= 4) {
                            // End of a round
                            setCurrentRound((r) => {
                                if (r >= totalRounds) {
                                    clearInterval(timer);
                                    setTimeout(onComplete, 500);
                                    return r;
                                }
                                return r + 1;
                            });
                            return 0;
                        }
                        return next;
                    });
                    return 4;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [onComplete]);

    const phase = phases[currentPhase];
    const isExpand = phase === 'Inhale';
    const isShrink = phase === 'Exhale';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center py-8"
        >
            <div className="text-xs text-zinc-500 mb-2 uppercase tracking-widest">
                Round {currentRound} of {totalRounds}
            </div>

            {/* Breathing circle */}
            <div className="relative w-40 h-40 flex items-center justify-center">
                {/* Outer glow */}
                <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                        background:
                            'radial-gradient(circle, rgba(224,254,16,0.15) 0%, transparent 70%)',
                    }}
                    animate={{
                        scale: isExpand ? [1, 1.3] : isShrink ? [1.3, 1] : 1.3,
                    }}
                    transition={{ duration: 4, ease: 'easeInOut' }}
                />
                {/* Main circle */}
                <motion.div
                    className="w-28 h-28 rounded-full border-2 border-[#E0FE10]/40 flex items-center justify-center"
                    style={{
                        background:
                            'radial-gradient(circle, rgba(224,254,16,0.08) 0%, rgba(224,254,16,0.02) 100%)',
                    }}
                    animate={{
                        scale: isExpand ? [0.7, 1.1] : isShrink ? [1.1, 0.7] : phase === 'Hold' && currentPhase === 1 ? 1.1 : 0.7,
                    }}
                    transition={{ duration: 4, ease: 'easeInOut' }}
                >
                    <div className="text-center">
                        <div className="text-2xl font-bold text-[#E0FE10]">
                            {secondsLeft}
                        </div>
                        <div className="text-xs text-zinc-400 uppercase tracking-wider mt-1">
                            {phase}
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Phase dots */}
            <div className="flex gap-2 mt-4">
                {phases.map((p, i) => (
                    <div
                        key={p + i}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${i === currentPhase
                            ? 'bg-[#E0FE10] scale-125'
                            : i < currentPhase
                                ? 'bg-zinc-500'
                                : 'bg-zinc-700'
                            }`}
                    />
                ))}
            </div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────
// COACH DASHBOARD (Act 2)
// ─────────────────────────────────────────────────────────

const CoachDashboard: React.FC<{ onContinue: () => void }> = ({
    onContinue,
}) => {
    const [showAlert, setShowAlert] = useState(false);
    const [showExercises, setShowExercises] = useState(false);
    const [showHandoff, setShowHandoff] = useState(false);

    useEffect(() => {
        const t1 = setTimeout(() => setShowAlert(true), 800);
        const t2 = setTimeout(() => setShowExercises(true), 2500);
        const t3 = setTimeout(() => setShowHandoff(true), 4000);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, []);

    const exercises = [
        {
            name: 'Box Breathing',
            category: 'Breathing',
            icon: Wind,
            color: '#22D3EE',
            status: 'Completed',
        },
        {
            name: 'Competition Walkthrough',
            category: 'Visualization',
            icon: Eye,
            color: '#8B5CF6',
            status: 'Assigned',
        },
        {
            name: 'The 3-Second Reset',
            category: 'Focus',
            icon: RotateCcw,
            color: '#F59E0B',
            status: 'Assigned',
        },
        {
            name: 'Cue Word Anchoring',
            category: 'Focus',
            icon: Target,
            color: '#F59E0B',
            status: 'Suggested',
        },
        {
            name: 'Highlight Reel',
            category: 'Confidence',
            icon: Star,
            color: '#10B981',
            status: 'Suggested',
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto px-4 py-8 space-y-6"
        >
            {/* Dashboard Header */}
            <div className="text-center mb-8">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/60 border border-zinc-700/50 mb-4"
                >
                    <Shield className="w-4 h-4 text-[#E0FE10]" />
                    <span className="text-sm text-zinc-300">Coach Dashboard</span>
                </motion.div>
                <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl font-bold text-white"
                >
                    Athlete Intelligence
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-zinc-400 mt-1"
                >
                    Here&apos;s what your coaching staff receives
                </motion.p>
            </div>

            {/* Nora Alert Card */}
            <AnimatePresence>
                {showAlert && (
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="rounded-2xl overflow-hidden"
                        style={{
                            background:
                                'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(239,68,68,0.05) 100%)',
                            border: '1px solid rgba(249,115,22,0.25)',
                        }}
                    >
                        <div className="p-5">
                            <div className="flex items-start gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-white">
                                            Nora Alert — Tremaine Grant
                                        </h3>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                            Elevated Anxiety
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        Today at 8:15 AM • Game Day
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                                Tremaine is experiencing elevated game-day anxiety related to
                                season-ending pressure. I ran a Box Breathing protocol (4
                                rounds), but residual tension persists. His physical baseline is
                                excellent (RHR 42, HRV high, 8h sleep), so this appears to be{' '}
                                <span className="text-orange-400 font-semibold">
                                    purely psychological
                                </span>
                                .
                            </p>

                            {/* Stats Row */}
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                {[
                                    { label: 'RHR', value: '42 bpm', icon: Heart, color: '#EF4444' },
                                    { label: 'HRV', value: 'High', icon: Activity, color: '#22C55E' },
                                    { label: 'Sleep', value: '8h', icon: Brain, color: '#3B82F6' },
                                ].map((stat) => (
                                    <div
                                        key={stat.label}
                                        className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 text-center"
                                    >
                                        <stat.icon
                                            className="w-4 h-4 mx-auto mb-1"
                                            style={{ color: stat.color }}
                                        />
                                        <div className="text-sm font-bold text-white">
                                            {stat.value}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 uppercase">
                                            {stat.label}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/30 p-3">
                                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                                    Recommendation
                                </div>
                                <p className="text-sm text-zinc-300">
                                    Check in with Tremaine before the 10:00 AM competition prep
                                    meeting. Monitor throughout the day in case escalation to
                                    clinical support is needed.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Assigned Mental Exercises */}
            <AnimatePresence>
                {showExercises && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                            Mental Training Assignments
                        </h3>
                        <div className="space-y-2">
                            {exercises.map((ex, i) => (
                                <motion.div
                                    key={ex.name}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.15 }}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30 hover:bg-zinc-800/60 transition-colors"
                                >
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: `${ex.color}15` }}
                                    >
                                        <ex.icon
                                            className="w-4 h-4"
                                            style={{ color: ex.color }}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-white">
                                            {ex.name}
                                        </div>
                                        <div className="text-xs text-zinc-500">{ex.category}</div>
                                    </div>
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full ${ex.status === 'Completed'
                                            ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                                            : ex.status === 'Assigned'
                                                ? 'bg-[#E0FE10]/10 text-[#E0FE10] border border-[#E0FE10]/25'
                                                : 'bg-zinc-700/40 text-zinc-400 border border-zinc-600/30'
                                            }`}
                                    >
                                        {ex.status}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AuntEdna Clinical Handoff */}
            <AnimatePresence>
                {showHandoff && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="rounded-2xl bg-gradient-to-br from-purple-500/8 to-blue-500/5 border border-purple-500/20 p-5"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <Shield className="w-4 h-4 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">
                                    Clinical Handoff Available
                                </h3>
                                <p className="text-xs text-zinc-500">
                                    HIPAA-Compliant • AuntEdna Integration
                                </p>
                            </div>
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed">
                            If Nora detects that a player&apos;s anxiety is scaling into a
                            clinical zone, Pulse automatically packages the full context —
                            sleep data, HRV trends, chat sentiment analysis — and initiates a
                            secure handoff to{' '}
                            <span className="text-purple-400 font-semibold">AuntEdna</span>,
                            the team&apos;s clinical mental health platform.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Continue button */}
            <AnimatePresence>
                {showHandoff && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.5 }}
                        className="flex justify-center pt-4"
                    >
                        <button
                            onClick={onContinue}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E0FE10] text-black font-bold hover:bg-[#c8e40e] transition-colors"
                        >
                            Continue to The Close
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────
// THE CLOSE — Act 3
// ─────────────────────────────────────────────────────────

const TheClose: React.FC = () => {
    const [showMonologue, setShowMonologue] = useState(false);
    const [showExercise, setShowExercise] = useState(false);
    const [resetPhase, setResetPhase] = useState<
        'idle' | 'acknowledge' | 'release' | 'execute' | 'done'
    >('idle');

    useEffect(() => {
        const t1 = setTimeout(() => setShowMonologue(true), 800);
        const t2 = setTimeout(() => setShowExercise(true), 2000);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, []);

    const runResetExercise = () => {
        setResetPhase('acknowledge');
        setTimeout(() => setResetPhase('release'), 1500);
        setTimeout(() => setResetPhase('execute'), 3000);
        setTimeout(() => setResetPhase('done'), 4500);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-3xl mx-auto px-4 py-8 space-y-8"
        >
            {/* Title */}
            <div className="text-center">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/60 border border-zinc-700/50 mb-4"
                >
                    <Brain className="w-4 h-4 text-[#E0FE10]" />
                    <span className="text-sm text-zinc-300">The Close</span>
                </motion.div>
            </div>

            {/* 3-Second Reset Exercise */}
            <AnimatePresence>
                {showExercise && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl overflow-hidden"
                        style={{
                            background:
                                'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(224,254,16,0.04) 100%)',
                            border: '1px solid rgba(245,158,11,0.2)',
                        }}
                    >
                        <div className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                    <RotateCcw className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">
                                        The 3-Second Reset
                                    </h3>
                                    <p className="text-xs text-zinc-500">
                                        Advanced Focus Exercise • Military Sniper Protocol
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                                When something goes wrong mid-competition, you have 3 seconds
                                before your brain spirals. Train yourself to compress recovery
                                from minutes to seconds.
                            </p>

                            {/* Overview Table */}
                            <div className="rounded-xl overflow-hidden border border-zinc-700/40 mb-4">
                                <div className="divide-y divide-zinc-800/80">
                                    {[
                                        {
                                            label: 'When',
                                            value:
                                                'In real-time, during competition — the moment something goes wrong',
                                        },
                                        {
                                            label: 'Focus',
                                            value:
                                                'Something just went wrong — recover NOW and dominate the next play',
                                        },
                                        {
                                            label: 'Time',
                                            value: '3 seconds (instant deployment)',
                                        },
                                        {
                                            label: 'Skill',
                                            value: 'Real-time cognitive recovery',
                                        },
                                        {
                                            label: 'Analogy',
                                            value:
                                                "Like a fighter jet's automatic stabilization system — turbulence hits, it corrects instantly",
                                        },
                                    ].map((row) => (
                                        <div key={row.label} className="flex">
                                            <div className="w-20 shrink-0 px-3 py-2 bg-zinc-800/40">
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase">
                                                    {row.label}
                                                </span>
                                            </div>
                                            <div className="flex-1 px-3 py-2">
                                                <span className="text-xs text-zinc-300 leading-relaxed">
                                                    {row.value}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Interactive Reset */}
                            {resetPhase === 'idle' ? (
                                <button
                                    onClick={runResetExercise}
                                    className="w-full py-3 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold hover:bg-amber-500/30 transition-colors"
                                >
                                    Run The 3-Second Reset →
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    {/* Second 1: Acknowledge */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{
                                            opacity:
                                                resetPhase === 'acknowledge' ||
                                                    resetPhase === 'release' ||
                                                    resetPhase === 'execute' ||
                                                    resetPhase === 'done'
                                                    ? 1
                                                    : 0.3,
                                            x: 0,
                                        }}
                                        className={`p-3 rounded-xl border transition-all duration-500 ${resetPhase === 'acknowledge'
                                            ? 'bg-red-500/10 border-red-500/30'
                                            : 'bg-zinc-800/40 border-zinc-700/30'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-xs font-bold text-red-400">
                                                1
                                            </div>
                                            <span className="text-sm font-bold text-white">
                                                ACKNOWLEDGE
                                            </span>
                                            {resetPhase === 'acknowledge' && (
                                                <motion.span
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="text-xs text-red-400 ml-auto"
                                                >
                                                    &quot;I missed. Bad play.&quot;
                                                </motion.span>
                                            )}
                                        </div>
                                    </motion.div>

                                    {/* Second 2: Release */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{
                                            opacity:
                                                resetPhase === 'release' ||
                                                    resetPhase === 'execute' ||
                                                    resetPhase === 'done'
                                                    ? 1
                                                    : 0.3,
                                            x: 0,
                                        }}
                                        transition={{ delay: 0.1 }}
                                        className={`p-3 rounded-xl border transition-all duration-500 ${resetPhase === 'release'
                                            ? 'bg-amber-500/10 border-amber-500/30'
                                            : 'bg-zinc-800/40 border-zinc-700/30'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400">
                                                2
                                            </div>
                                            <span className="text-sm font-bold text-white">
                                                RELEASE
                                            </span>
                                            {resetPhase === 'release' && (
                                                <motion.span
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="text-xs text-amber-400 ml-auto"
                                                >
                                                    Sharp exhale. Drop shoulders. It&apos;s dead.
                                                </motion.span>
                                            )}
                                        </div>
                                    </motion.div>

                                    {/* Second 3: Re-Execute */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{
                                            opacity:
                                                resetPhase === 'execute' || resetPhase === 'done'
                                                    ? 1
                                                    : 0.3,
                                            x: 0,
                                        }}
                                        transition={{ delay: 0.2 }}
                                        className={`p-3 rounded-xl border transition-all duration-500 ${resetPhase === 'execute'
                                            ? 'bg-green-500/10 border-green-500/30'
                                            : 'bg-zinc-800/40 border-zinc-700/30'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-bold text-green-400">
                                                3
                                            </div>
                                            <span className="text-sm font-bold text-white">
                                                RE-EXECUTE
                                            </span>
                                            {resetPhase === 'execute' && (
                                                <motion.span
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="text-xs text-green-400 ml-auto"
                                                >
                                                    &quot;Next play, I attack.&quot;
                                                </motion.span>
                                            )}
                                        </div>
                                    </motion.div>

                                    {resetPhase === 'done' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-center py-3"
                                        >
                                            <div className="text-[#E0FE10] font-bold text-lg">
                                                Reset Complete ✓
                                            </div>
                                            <p className="text-xs text-zinc-400 mt-1">
                                                3 seconds. That&apos;s all it takes to go from
                                                interception to touchdown drive.
                                            </p>
                                        </motion.div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Monologue */}
            <AnimatePresence>
                {showMonologue && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-center space-y-6 pt-4"
                    >
                        <p className="text-lg text-zinc-200 leading-relaxed max-w-2xl mx-auto">
                            &quot;When we think of the greatest athletes to ever live — the
                            LeBron James, the Serena Williams, the Tom Bradys of the world —
                            everyone will vouch for one common trait.&quot;
                        </p>
                        <p className="text-lg text-zinc-200 leading-relaxed max-w-2xl mx-auto">
                            &quot;Their physical gifts were incredible. But their{' '}
                            <span className="text-[#E0FE10] font-bold">minds</span>{' '}
                            absolutely exceeded the fortitude of everyone else on the
                            field.&quot;
                        </p>
                        <p className="text-lg text-zinc-200 leading-relaxed max-w-2xl mx-auto">
                            &quot;In the NFL, every team is equipping their players with
                            physical weapons — the best facilities, the best nutrition, the
                            best recovery technology.&quot;
                        </p>
                        <motion.p
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 1 }}
                            className="text-xl font-bold text-white max-w-2xl mx-auto pt-4"
                        >
                            &quot;
                            <span className="text-[#E0FE10]">Pulse Check</span> is how the
                            Patriots equip them with{' '}
                            <span className="text-[#E0FE10]">mental ones</span>.&quot;
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────
// MAIN DEMO PAGE
// ─────────────────────────────────────────────────────────

const PulseCheckDemo: React.FC = () => {
    // ── State ─────────────────────────────────────────────
    const [currentAct, setCurrentAct] = useState<DemoAct>('act1');
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState('');
    const [scriptIndex, setScriptIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const [showBreathing, setShowBreathing] = useState(false);
    const scrollerRef = useRef<HTMLDivElement>(null);

    // Voice state
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [sttEnabled, setSttEnabled] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const recognitionRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ttsQueueRef = useRef<string[]>([]);
    const ttsProcessingRef = useRef(false);

    // ── Scroll to bottom on new messages ──────────────────
    useEffect(() => {
        scrollerRef.current?.scrollTo({
            top: scrollerRef.current.scrollHeight,
            behavior: 'smooth',
        });
    }, [messages, showBreathing]);

    // ── Initial Nora greeting ─────────────────────────────
    useEffect(() => {
        const firstMsg = DEMO_SCRIPT[0];
        const timer = setTimeout(async () => {
            setIsTyping(true);
            // Preload audio while "typing" indicator is showing
            const playFn = await preloadAudio(firstMsg.content);
            setIsTyping(false);
            const msg: ChatMsg = {
                id: 'msg-0',
                content: firstMsg.content,
                isFromUser: false,
                timestamp: Date.now(),
            };
            setMessages([msg]);
            if (playFn) playFn(); // plays instantly — audio is already loaded
            setScriptIndex(1);
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── TTS: preload audio and return a play() function ────
    // Call this while typing indicator is showing → audio loads in background
    // When ready, show message and call play() simultaneously
    const preloadAudio = useCallback(
        async (text: string): Promise<(() => void) | null> => {
            if (!ttsEnabled || typeof window === 'undefined') return null;

            // Stop any currently playing audio
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }

            try {
                const res = await fetch('/api/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text,
                        voice: 'rachel',
                        speed: 1.0,
                    }),
                });

                if (!res.ok) {
                    console.warn('[TTS] TTS API failed, falling back to Web Speech API');
                    return () => fallbackSpeak(text);
                }

                const data = await res.json();
                if (!data.audio) {
                    return () => fallbackSpeak(text);
                }

                // Decode base64 MP3 and prepare audio element (but don't play yet)
                const audioBytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
                const blob = new Blob([audioBytes], { type: 'audio/mp3' });
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audioRef.current = audio;

                audio.onplay = () => setIsSpeaking(true);
                audio.onended = () => {
                    setIsSpeaking(false);
                    URL.revokeObjectURL(url);
                    audioRef.current = null;
                };
                audio.onerror = () => {
                    setIsSpeaking(false);
                    URL.revokeObjectURL(url);
                    audioRef.current = null;
                };

                // Return a function that plays instantly when called
                return () => {
                    audio.play().catch(() => fallbackSpeak(text));
                };
            } catch (err) {
                console.warn('[TTS] Error preloading TTS:', err);
                return () => fallbackSpeak(text);
            }
        },
        [ttsEnabled]
    );

    // Fallback to Web Speech API if TTS API fails
    const fallbackSpeak = useCallback((text: string) => {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(
            (v) =>
                v.name.includes('Samantha') ||
                v.name.includes('Google UK English Female')
        );
        if (preferred) utterance.voice = preferred;
        window.speechSynthesis.speak(utterance);
    }, []);


    // ── STT: speech recognition ───────────────────────────
    const toggleSTT = useCallback(() => {
        if (sttEnabled) {
            // Turn off
            setSttEnabled(false);
            setIsListening(false);
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }
            return;
        }

        // Turn on
        const SpeechRecognition =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Voice input is not supported in this browser. Please use Chrome.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                transcript += event.results[i][0].transcript;
            }
            setInput(transcript);

            if (event.results[event.results.length - 1].isFinal) {
                setIsListening(false);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onerror = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        setSttEnabled(true);
    }, [sttEnabled]);

    const startListening = useCallback(() => {
        if (!recognitionRef.current) return;
        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch { /* already started */ }
    }, []);

    // ── Advance the script ────────────────────────────────
    const advanceScript = useCallback(
        (userText: string) => {
            if (scriptIndex >= DEMO_SCRIPT.length) return;

            // Add user message
            const userMsg: ChatMsg = {
                id: `user-${Date.now()}`,
                content: userText,
                isFromUser: true,
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, userMsg]);

            // Find next Nora message(s)
            let nextIdx = scriptIndex;
            const processNext = async () => {
                if (nextIdx >= DEMO_SCRIPT.length) return;
                const nextScript = DEMO_SCRIPT[nextIdx];

                if (nextScript.role === 'system' && nextScript.triggerBreathing) {
                    // Show breathing exercise
                    setShowBreathing(true);
                    nextIdx++;
                    setScriptIndex(nextIdx);
                    return;
                }

                if (nextScript.role === 'nora') {
                    setIsTyping(true);

                    // Preload audio WHILE typing indicator shows
                    const playFn = await preloadAudio(nextScript.content);

                    // Now reveal message and play audio simultaneously
                    setIsTyping(false);
                    const noraMsg: ChatMsg = {
                        id: `nora-${Date.now()}-${nextIdx}`,
                        content: nextScript.content,
                        isFromUser: false,
                        timestamp: Date.now(),
                    };
                    setMessages((prev) => [...prev, noraMsg]);
                    if (playFn) playFn();
                    nextIdx++;
                    setScriptIndex(nextIdx);

                    // Handle transition
                    if (nextScript.transitionTo) {
                        const act = nextScript.transitionTo;
                        setTimeout(() => {
                            setCurrentAct(act);
                        }, nextScript.autoAdvanceDelay || 3000);
                    }

                    // Auto-advance chain
                    if (nextScript.autoAdvance && !nextScript.transitionTo) {
                        setTimeout(() => {
                            processNext();
                        }, nextScript.autoAdvanceDelay || 2000);
                    }
                }
            };

            processNext();
        },
        [scriptIndex, preloadAudio]
    );

    // ── Handle send ───────────────────────────────────────
    const handleSend = useCallback(() => {
        if (!input.trim()) return;
        const text = input.trim();
        setInput('');
        advanceScript(text);
    }, [input, advanceScript]);

    // ── Handle breathing complete ─────────────────────────
    const handleBreathingComplete = useCallback(async () => {
        setShowBreathing(false);
        // Continue script — preload audio then show message + play together
        if (scriptIndex < DEMO_SCRIPT.length) {
            const nextScript = DEMO_SCRIPT[scriptIndex];
            if (nextScript.role === 'nora') {
                setIsTyping(true);
                const playFn = await preloadAudio(nextScript.content);
                setIsTyping(false);
                const msg: ChatMsg = {
                    id: `nora-${Date.now()}`,
                    content: nextScript.content,
                    isFromUser: false,
                    timestamp: Date.now(),
                };
                setMessages((prev) => [...prev, msg]);
                if (playFn) playFn();
                setScriptIndex((prev) => prev + 1);
            }
        }
    }, [scriptIndex, preloadAudio]);

    // ── Render ────────────────────────────────────────────
    return (
        <>
            <Head>
                <title>Pulse Check Demo — Patriots</title>
                <meta
                    name="description"
                    content="Pulse Check: AI-powered mental performance coaching for elite athletes."
                />
            </Head>

            <div className="fixed inset-0 bg-[#0a0a0b] flex flex-col overflow-hidden">
                {/* Ambient Orbs */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <FloatingOrb
                        color="#E0FE10"
                        size="w-[400px] h-[400px]"
                        position={{ top: '-15%', left: '-10%' }}
                        delay={0}
                    />
                    <FloatingOrb
                        color="#3B82F6"
                        size="w-[300px] h-[300px]"
                        position={{ top: '40%', right: '-5%' }}
                        delay={2}
                    />
                    <FloatingOrb
                        color="#8B5CF6"
                        size="w-[250px] h-[250px]"
                        position={{ bottom: '10%', left: '20%' }}
                        delay={4}
                    />
                </div>

                {/* Noise texture */}
                <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />

                {/* Header */}
                <header className="relative z-20 flex items-center justify-between px-6 py-4 backdrop-blur-xl bg-zinc-900/30 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#E0FE10]/15 flex items-center justify-center">
                            <Brain className="w-4 h-4 text-[#E0FE10]" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-white">Pulse Check</h1>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                {currentAct === 'act1'
                                    ? 'Athlete Experience'
                                    : currentAct === 'act2'
                                        ? 'Coach Dashboard'
                                        : 'The Close'}
                            </p>
                        </div>
                    </div>

                    {/* Voice controls */}
                    <div className="flex items-center gap-2">
                        {/* TTS Toggle */}
                        <button
                            onClick={() => {
                                setTtsEnabled(!ttsEnabled);
                                if (ttsEnabled) {
                                    // Stop OpenAI audio
                                    if (audioRef.current) {
                                        audioRef.current.pause();
                                        audioRef.current = null;
                                        setIsSpeaking(false);
                                    }
                                    // Also stop Web Speech fallback
                                    window.speechSynthesis?.cancel();
                                }
                            }}
                            className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all ${ttsEnabled
                                ? 'bg-[#E0FE10]/15 border border-[#E0FE10]/30'
                                : 'bg-zinc-800/60 border border-zinc-700/40'
                                }`}
                            title={ttsEnabled ? 'Mute Nora' : 'Unmute Nora'}
                        >
                            {isSpeaking && (
                                <motion.div
                                    className="absolute inset-0 rounded-lg border-2 border-[#E0FE10]/50"
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                            )}
                            {ttsEnabled ? (
                                <Volume2 className="w-4 h-4 text-[#E0FE10]" />
                            ) : (
                                <VolumeX className="w-4 h-4 text-zinc-500" />
                            )}
                        </button>

                        {/* STT Toggle */}
                        <button
                            onClick={toggleSTT}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${sttEnabled
                                ? 'bg-blue-500/15 border border-blue-500/30'
                                : 'bg-zinc-800/60 border border-zinc-700/40'
                                }`}
                            title={
                                sttEnabled ? 'Disable Voice Input' : 'Enable Voice Input'
                            }
                        >
                            {sttEnabled ? (
                                <Mic className="w-4 h-4 text-blue-400" />
                            ) : (
                                <MicOff className="w-4 h-4 text-zinc-500" />
                            )}
                        </button>

                        {/* Act indicator pills */}
                        <div className="flex gap-1 ml-3">
                            {(['act1', 'act2', 'act3'] as DemoAct[]).map((act) => (
                                <div
                                    key={act}
                                    className={`w-2 h-2 rounded-full transition-all duration-500 ${act === currentAct
                                        ? 'bg-[#E0FE10] scale-125'
                                        : act < currentAct
                                            ? 'bg-zinc-500'
                                            : 'bg-zinc-700'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 relative z-10 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {currentAct === 'act1' && (
                            <motion.div
                                key="act1"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, x: -100 }}
                                className="h-full flex flex-col"
                            >
                                {/* Chat messages */}
                                <div
                                    ref={scrollerRef}
                                    className="flex-1 overflow-y-auto"
                                    style={{ overscrollBehavior: 'contain' }}
                                >
                                    <div className="max-w-3xl mx-auto px-4 py-8">
                                        <div className="space-y-6">
                                            <AnimatePresence>
                                                {messages.map((m) => (
                                                    <motion.div
                                                        key={m.id}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.4 }}
                                                        className="flex gap-4 items-start"
                                                    >
                                                        {/* Avatar */}
                                                        {!m.isFromUser && (
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E0FE10]/30 to-[#E0FE10]/10 border border-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                                                                <Brain className="w-3.5 h-3.5 text-[#E0FE10]" />
                                                            </div>
                                                        )}

                                                        {/* Message bubble */}
                                                        <div
                                                            className={`flex-1 ${m.isFromUser ? 'flex justify-end' : ''
                                                                }`}
                                                        >
                                                            <div
                                                                className={`rounded-2xl px-4 py-3 max-w-[85%] ${m.isFromUser
                                                                    ? 'bg-[#E0FE10]/10 border border-[#E0FE10]/20 ml-auto'
                                                                    : 'bg-zinc-800/60 border border-zinc-700/30'
                                                                    }`}
                                                            >
                                                                {!m.isFromUser && (
                                                                    <div className="text-[10px] font-bold text-[#E0FE10]/70 uppercase tracking-wider mb-1">
                                                                        Nora
                                                                    </div>
                                                                )}
                                                                <p
                                                                    className={`text-sm leading-relaxed whitespace-pre-line ${m.isFromUser
                                                                        ? 'text-[#E0FE10]/90'
                                                                        : 'text-zinc-200'
                                                                        }`}
                                                                >
                                                                    {m.content}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* User avatar */}
                                                        {m.isFromUser && (
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                                                <span className="text-xs font-bold text-blue-300">
                                                                    TG
                                                                </span>
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>

                                            {/* Box Breathing */}
                                            <AnimatePresence>
                                                {showBreathing && (
                                                    <BoxBreathingAnimation
                                                        onComplete={handleBreathingComplete}
                                                    />
                                                )}
                                            </AnimatePresence>

                                            {/* Typing indicator */}
                                            {isTyping && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="flex gap-4 items-start"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E0FE10]/30 to-[#E0FE10]/10 border border-[#E0FE10]/20 flex items-center justify-center">
                                                        <Brain className="w-3.5 h-3.5 text-[#E0FE10]" />
                                                    </div>
                                                    <div className="bg-zinc-800/60 border border-zinc-700/30 rounded-2xl px-4 py-3">
                                                        <div className="flex gap-1">
                                                            <motion.div
                                                                className="w-2 h-2 rounded-full bg-zinc-500"
                                                                animate={{ opacity: [0.3, 1, 0.3] }}
                                                                transition={{
                                                                    duration: 1,
                                                                    repeat: Infinity,
                                                                    delay: 0,
                                                                }}
                                                            />
                                                            <motion.div
                                                                className="w-2 h-2 rounded-full bg-zinc-500"
                                                                animate={{ opacity: [0.3, 1, 0.3] }}
                                                                transition={{
                                                                    duration: 1,
                                                                    repeat: Infinity,
                                                                    delay: 0.2,
                                                                }}
                                                            />
                                                            <motion.div
                                                                className="w-2 h-2 rounded-full bg-zinc-500"
                                                                animate={{ opacity: [0.3, 1, 0.3] }}
                                                                transition={{
                                                                    duration: 1,
                                                                    repeat: Infinity,
                                                                    delay: 0.4,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Input bar */}
                                <div className="relative z-20 backdrop-blur-xl bg-zinc-900/40 border-t border-white/5 px-4 py-3">
                                    <div className="max-w-3xl mx-auto flex items-center gap-3">
                                        {/* Mic button (when STT is on) */}
                                        {sttEnabled && (
                                            <button
                                                onClick={startListening}
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isListening
                                                    ? 'bg-red-500/20 border border-red-500/40'
                                                    : 'bg-zinc-800/60 border border-zinc-700/40 hover:bg-zinc-700/60'
                                                    }`}
                                            >
                                                {isListening ? (
                                                    <motion.div
                                                        animate={{ scale: [1, 1.2, 1] }}
                                                        transition={{
                                                            duration: 1,
                                                            repeat: Infinity,
                                                        }}
                                                    >
                                                        <Mic className="w-4 h-4 text-red-400" />
                                                    </motion.div>
                                                ) : (
                                                    <Mic className="w-4 h-4 text-zinc-400" />
                                                )}
                                            </button>
                                        )}

                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                            placeholder={
                                                isListening
                                                    ? 'Listening...'
                                                    : 'Type your response...'
                                            }
                                            className="flex-1 bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#E0FE10]/40 transition-colors"
                                        />

                                        <button
                                            onClick={handleSend}
                                            disabled={!input.trim()}
                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${input.trim()
                                                ? 'bg-[#E0FE10] hover:bg-[#c8e40e]'
                                                : 'bg-zinc-800/60 border border-zinc-700/40'
                                                }`}
                                        >
                                            <Send
                                                className={`w-4 h-4 ${input.trim() ? 'text-black' : 'text-zinc-500'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {currentAct === 'act2' && (
                            <motion.div
                                key="act2"
                                initial={{ opacity: 0, x: 100 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -100 }}
                                className="h-full overflow-y-auto"
                            >
                                <CoachDashboard onContinue={() => setCurrentAct('act3')} />
                            </motion.div>
                        )}

                        {currentAct === 'act3' && (
                            <motion.div
                                key="act3"
                                initial={{ opacity: 0, x: 100 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="h-full overflow-y-auto"
                            >
                                <TheClose />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>
        </>
    );
};

export default PulseCheckDemo;
