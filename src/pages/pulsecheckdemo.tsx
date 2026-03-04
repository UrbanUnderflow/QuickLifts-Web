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
    Bell,
    Home,
    Users,
    FileText,
    Pill,
    Building2,
    LogOut,
    BarChart3,
    ClipboardList,
    Settings,
    Calendar,
    Flame,
    Maximize2,
    Minimize2,
    X,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

type DemoAct = 'intro' | 'act1' | 'act2' | 'act3' | 'act4';

interface ScriptMessage {
    role: 'nora' | 'athlete' | 'system';
    content: string;
    delay?: number; // ms delay before showing
    triggerBreathing?: boolean;
    transitionTo?: DemoAct;
    autoAdvance?: boolean; // auto-advance to next message without user input
    autoAdvanceDelay?: number;
    ttsSpeed?: number; // TTS playback speed (default 1.0)
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
        ttsSpeed: 0.85,
    },
    // User responds: "I feel okay, just trying to get locked in."
    {
        role: 'nora',
        content:
            'Your baseline looks great today. You had 8 hours of solid sleep, your Resting Heart Rate (RHR) is at 42 bpm, and your HRV baseline is high, indicating excellent central nervous system (CNS) recovery. Your body is primed for today.',
        delay: 1500,
    },
    // User responds with a reaction to the baseline data, then types their own question about the prep meeting
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
            "Done. I've sent Coach a secure briefing with your physical baseline data and today's conversation context. He'll have the full picture before your 10 AM meeting.",
        delay: 2000,
        autoAdvance: true,
        autoAdvanceDelay: 4000,
        transitionTo: 'act2',
    },
];

// ─────────────────────────────────────────────────────────
// SUGGESTED RESPONSE CHIPS
// ─────────────────────────────────────────────────────────

const SUGGESTED_RESPONSES: Record<number, string[]> = {
    1: [
        'I feel okay, just trying to get locked in.',
        "Eh, I don't know. Just woke up.",
        "Honestly? I barely slept.",
    ],
    2: [
        "That's good to hear. I needed that.",
        "Nice, at least my body showed up today.",
        "OK cool, that makes me feel a little better.",
    ],
    3: [
        "Perfect, 10 AM. That gives me time to get right.",
        "Alright, I'll be there.",
        "Ugh, 10 AM? That feels early on game day.",
    ],
    4: [
        "There's just a lot of pressure. If we lose today, our season is over. And I know there are scouts watching.",
        "I don't know, everything just feels like it's on the line today.",
        "I feel like I'm going to let everyone down.",
    ],
    5: [
        "Sure, let's do it.",
        "I guess I'll try it.",
        "I don't know if that'll help, but fine.",
    ],
    7: [
        "I feel a lot better actually.",
        'A little better, but still tense.',
        "I'm still feeling pretty anxious.",
    ],
    8: [
        'Sure, go ahead and let Coach know.',
        "Yeah, that's fine. Let him know.",
        "Do you have to? I don't want him to think I can't handle it.",
    ],
};

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
// BIOMETRIC HUD (during breathing exercise)
// ─────────────────────────────────────────────────────────

const BiometricHUD: React.FC<{ isActive: boolean }> = ({ isActive }) => {
    const [hr, setHr] = useState(72);
    const [hrv, setHrv] = useState(45);
    const [calmScore, setCalmScore] = useState(34);

    useEffect(() => {
        if (!isActive) return;
        const interval = setInterval(() => {
            setHr((prev) => Math.max(56, prev - Math.floor(Math.random() * 3 + 1)));
            setHrv((prev) => Math.min(72, prev + Math.floor(Math.random() * 3 + 1)));
            setCalmScore((prev) => Math.min(85, prev + Math.floor(Math.random() * 4 + 2)));
        }, 2000);
        return () => clearInterval(interval);
    }, [isActive]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-3 gap-3 mt-6 max-w-md mx-auto"
        >
            <div className="rounded-xl bg-zinc-900/80 border border-red-500/20 p-3 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-red-500/5 to-transparent" />
                <Heart className="w-4 h-4 text-red-400 mx-auto mb-1 relative z-10" />
                <motion.div
                    key={hr}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1, color: hr <= 62 ? '#4ade80' : '#f87171' }}
                    className="text-xl font-bold relative z-10"
                >
                    {hr}
                </motion.div>
                <div className="text-[10px] text-zinc-500 uppercase relative z-10">BPM</div>
                <div className="text-[9px] text-green-400/70 mt-0.5 relative z-10">↓ Decreasing</div>
            </div>
            <div className="rounded-xl bg-zinc-900/80 border border-blue-500/20 p-3 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent" />
                <Activity className="w-4 h-4 text-blue-400 mx-auto mb-1 relative z-10" />
                <motion.div
                    key={hrv}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className="text-xl font-bold text-blue-400 relative z-10"
                >
                    {hrv}
                </motion.div>
                <div className="text-[10px] text-zinc-500 uppercase relative z-10">HRV</div>
                <div className="text-[9px] text-green-400/70 mt-0.5 relative z-10">↑ Improving</div>
            </div>
            <div className="rounded-xl bg-zinc-900/80 border border-[#E0FE10]/20 p-3 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-[#E0FE10]/5 to-transparent" />
                <Brain className="w-4 h-4 text-[#E0FE10] mx-auto mb-1 relative z-10" />
                <motion.div
                    key={calmScore}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className="text-xl font-bold text-[#E0FE10] relative z-10"
                >
                    {calmScore}
                </motion.div>
                <div className="text-[10px] text-zinc-500 uppercase relative z-10">Calm</div>
                <div className="text-[9px] text-green-400/70 mt-0.5 relative z-10">↑ Stabilizing</div>
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
    const [showRoster, setShowRoster] = useState(false);
    const [showExercises, setShowExercises] = useState(false);
    const [showHandoff, setShowHandoff] = useState(false);
    const [showRosterHint, setShowRosterHint] = useState(false);

    useEffect(() => {
        const t1 = setTimeout(() => setShowAlert(true), 800);
        const t2 = setTimeout(() => setShowRoster(true), 2200);
        const t3 = setTimeout(() => setShowExercises(true), 3800);
        const t4 = setTimeout(() => setShowHandoff(true), 5200);
        const t5 = setTimeout(() => setShowRosterHint(true), 7000);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
            clearTimeout(t5);
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
            name: 'The Kill Switch',
            category: 'Focus',
            icon: Zap,
            color: '#EF4444',
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

    const roster = [
        { name: 'T. Grant', pos: 'DB', num: 24, status: 'elevated', text: 'Elevated Anxiety', time: '8:15 AM', hl: true },
        { name: 'K. Thompson', pos: 'LB', num: 52, status: 'critical', text: 'Escalated — Clinical', time: '6:50 AM', hl: true },
        { name: 'D. Okafor', pos: 'DT', num: 94, status: 'warning', text: 'Low Sleep (4.5h)', time: '7:55 AM', hl: false },
        { name: 'B. Washington', pos: 'TE', num: 87, status: 'warning', text: 'Elevated Stress', time: '7:50 AM', hl: false },
        { name: 'J. Rodriguez', pos: 'QB', num: 7, status: 'optimal', text: 'Game Ready', time: '7:30 AM', hl: false },
        { name: 'M. Williams', pos: 'WR', num: 11, status: 'optimal', text: 'Optimal', time: '7:45 AM', hl: false },
        { name: 'A. Johnson', pos: 'RB', num: 28, status: 'optimal', text: 'Game Ready', time: '8:00 AM', hl: false },
        { name: 'C. Martinez', pos: 'OG', num: 75, status: 'optimal', text: 'Optimal', time: '7:20 AM', hl: false },
        { name: 'R. Davis', pos: 'S', num: 21, status: 'optimal', text: 'Optimal', time: '7:40 AM', hl: false },
        { name: 'L. Chen', pos: 'K', num: 3, status: 'optimal', text: 'Optimal', time: '7:15 AM', hl: false },
        { name: 'J. Patel', pos: 'CB', num: 32, status: 'optimal', text: 'Game Ready', time: '8:05 AM', hl: false },
        { name: 'S. Brooks', pos: 'WR', num: 15, status: 'optimal', text: 'Optimal', time: '7:35 AM', hl: false },
        { name: 'T. Morrison', pos: 'DE', num: 91, status: 'optimal', text: 'Game Ready', time: '7:25 AM', hl: false },
        { name: 'E. Campbell', pos: 'OT', num: 68, status: 'nocheckin', text: 'No Check-in', time: '—', hl: false },
        { name: 'M. Foster', pos: 'LB', num: 56, status: 'optimal', text: 'Optimal', time: '7:55 AM', hl: false },
        { name: 'D. Rivera', pos: 'CB', num: 29, status: 'optimal', text: 'Game Ready', time: '8:10 AM', hl: false },
        { name: 'K. Wright', pos: 'RB', num: 33, status: 'optimal', text: 'Optimal', time: '7:30 AM', hl: false },
        { name: 'J. Harper', pos: 'WR', num: 84, status: 'nocheckin', text: 'No Check-in', time: '—', hl: false },
        { name: 'N. Cooper', pos: 'DT', num: 97, status: 'optimal', text: 'Optimal', time: '7:45 AM', hl: false },
        { name: 'C. Bell', pos: 'S', num: 26, status: 'optimal', text: 'Optimal', time: '7:50 AM', hl: false },
        { name: 'P. Adams', pos: 'C', num: 62, status: 'optimal', text: 'Game Ready', time: '7:40 AM', hl: false },
        { name: 'R. Mitchell', pos: 'DE', num: 95, status: 'optimal', text: 'Optimal', time: '7:55 AM', hl: false },
        { name: 'L. Turner', pos: 'FB', num: 45, status: 'optimal', text: 'Optimal', time: '7:25 AM', hl: false },
        { name: 'A. Scott', pos: 'P', num: 8, status: 'optimal', text: 'Optimal', time: '7:35 AM', hl: false },
        { name: 'H. Baker', pos: 'LS', num: 48, status: 'nocheckin', text: 'No Check-in', time: '—', hl: false },
    ];

    const statusDot = (s: string) => (
        s === 'optimal' ? 'bg-green-400' :
            s === 'warning' ? 'bg-amber-400' :
                s === 'elevated' ? 'bg-orange-400' :
                    s === 'critical' ? 'bg-red-400 animate-pulse' :
                        'bg-zinc-600'
    );

    const statusColor = (s: string) => (
        s === 'optimal' ? 'text-green-400/80' :
            s === 'warning' ? 'text-amber-400/80' :
                s === 'elevated' ? 'text-orange-400/80' :
                    s === 'critical' ? 'text-red-400/80' :
                        'text-zinc-600'
    );

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex h-full"
        >
            {/* ── Coach Sidebar ── */}
            <motion.aside
                initial={{ x: -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="w-[240px] flex-shrink-0 border-r border-zinc-800/60 flex flex-col py-4 px-3"
                style={{ background: 'linear-gradient(180deg, rgba(17,17,19,0.95) 0%, rgba(10,10,11,0.98) 100%)' }}
            >
                {/* Logo */}
                <div className="flex items-center gap-2 px-2 mb-6">
                    <div className="w-7 h-7 rounded-lg bg-[#E0FE10]/15 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-[#E0FE10]" />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white">PulseCheck</div>
                        <div className="text-[8px] text-zinc-500 uppercase tracking-widest">Coaching Platform</div>
                    </div>
                </div>

                {/* Coach Profile */}
                <div className="flex items-center gap-2.5 px-2 py-3 rounded-xl bg-zinc-800/30 border border-zinc-700/20 mb-5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E0FE10]/30 to-green-500/20 flex items-center justify-center border border-[#E0FE10]/20">
                        <span className="text-xs font-bold text-[#E0FE10]">CW</span>
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-white">Coach Williams</div>
                        <div className="text-[9px] text-zinc-500">Head Performance Coach</div>
                    </div>
                </div>

                {/* Nav Menu */}
                <nav className="flex-1 space-y-0.5">
                    {[
                        { icon: Home, label: 'Home', active: false },
                        { icon: Flame, label: 'Athlete Alerts', active: true, badge: '2' },
                        { icon: Users, label: 'Team Roster', active: false },
                        { icon: ClipboardList, label: 'Training Library', active: false },
                        { icon: Calendar, label: 'Schedule', active: false },
                        { icon: BarChart3, label: 'Reports', active: false },
                        { icon: Settings, label: 'Settings', active: false },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm cursor-pointer transition-colors ${item.active
                                ? 'bg-[#E0FE10]/10 text-[#E0FE10] font-medium'
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                                }`}
                        >
                            <item.icon className="w-4 h-4" />
                            <span>{item.label}</span>
                            {item.badge && (
                                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/25 font-bold">
                                    {item.badge}
                                </span>
                            )}
                        </div>
                    ))}
                </nav>

                {/* Logout */}
                <div className="mt-auto pt-3 border-t border-zinc-800/60">
                    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors">
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                    </div>
                </div>
            </motion.aside>

            {/* ── Main Content ── */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* Header breadcrumb */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between"
                >
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-500">Athlete Alerts</span>
                        <ChevronRight className="w-3 h-3 text-zinc-600" />
                        <span className="text-white font-medium">Game Day Overview</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-bold">
                            2 ALERTS
                        </span>
                        <span className="text-[10px] text-zinc-500">March 2, 2026 • 8:15 AM</span>
                    </div>
                </motion.div>

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

                {/* Full Team Roster */}
                <AnimatePresence>
                    {showRoster && (
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                                    Team Status Overview — All Athletes
                                </h3>
                                <div className="flex items-center gap-3 text-[11px]">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> 19 Optimal</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 2 Flagged</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> 1 Elevated</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> 1 Escalated</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-600 inline-block" /> 3 Pending</span>
                                </div>
                            </div>

                            {/* Check-in progress */}
                            <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 mb-3 flex items-center gap-4">
                                <div className="text-sm text-zinc-300">
                                    <span className="text-white font-bold">22</span>/25 checked in
                                </div>
                                <div className="flex-1 h-2 bg-zinc-700/50 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: '88%' }}
                                        transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
                                        className="h-full rounded-full"
                                        style={{ background: 'linear-gradient(90deg, #22C55E, #E0FE10)' }}
                                    />
                                </div>
                                <div className="text-xs text-zinc-500">88%</div>
                            </div>

                            {/* Roster table */}
                            <div className="rounded-xl border border-zinc-700/30 overflow-hidden">
                                <div className="grid grid-cols-[44px_1fr_44px_1fr_64px] gap-0 text-[10px] font-bold text-zinc-500 uppercase tracking-wide px-3 py-2 bg-zinc-800/60 border-b border-zinc-700/30">
                                    <div>#</div>
                                    <div>Player</div>
                                    <div>Pos</div>
                                    <div>Status</div>
                                    <div className="text-right">Time</div>
                                </div>
                                <div className="max-h-[340px] overflow-y-auto">
                                    {roster.map((p, i) => (
                                        <motion.div
                                            key={p.name}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            className={`grid grid-cols-[44px_1fr_44px_1fr_64px] gap-0 items-center px-3 py-2 border-b border-zinc-800/50 text-sm transition-colors ${p.hl ? 'bg-orange-500/5' : ''
                                                } ${p.status === 'critical' ? 'cursor-pointer hover:bg-red-500/10' : 'hover:bg-zinc-800/40'
                                                }`}
                                            onClick={() => {
                                                if (p.status === 'critical') {
                                                    onContinue();
                                                }
                                            }}
                                        >
                                            <div className="text-zinc-500 font-mono text-xs">{p.num}</div>
                                            <div className={`font-medium ${p.hl ? 'text-orange-400' : 'text-white'}`}>{p.name}</div>
                                            <div className="text-zinc-500 text-xs">{p.pos}</div>
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot(p.status)}`} />
                                                <span className={`text-xs truncate ${statusColor(p.status)}`}>{p.text}</span>
                                            </div>
                                            <div className="flex items-center justify-end gap-1">
                                                <span className="text-zinc-500 text-xs">{p.time}</span>
                                                {p.status === 'critical' && (
                                                    <ChevronRight className="w-3 h-3 text-red-400" />
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
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

                {/* Roster hint */}
                <AnimatePresence>
                    {showRosterHint && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex justify-center pt-2"
                        >
                            <div className="flex items-center gap-2 text-xs text-red-400/80">
                                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                Click K. Thompson to explore clinical escalation
                                <ChevronRight className="w-3 h-3" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>{/* end main content */}
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────
// CLINICAL ESCALATION — Act 3
// ─────────────────────────────────────────────────────────

// ── Call Timer — live elapsed counter ────────────────────
const CallTimer: React.FC = () => {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
        return () => clearInterval(interval);
    }, []);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return (
        <div className="text-sm text-green-400 font-medium">
            Connected • {mins}:{secs.toString().padStart(2, '0')}
        </div>
    );
};

const ClinicalEscalation: React.FC<{ onContinue: () => void }> = ({ onContinue }) => {
    const [phase, setPhase] = useState<'phone' | 'clinicianView' | 'calling'>('phone');
    const [alertTapped, setAlertTapped] = useState(false);
    const [alertTapPos, setAlertTapPos] = useState<{ x: number; y: number } | null>(null);
    const [showNotifCard, setShowNotifCard] = useState(false);
    const [callStatus, setCallStatus] = useState<'ringing' | 'connected' | 'ended'>('ringing');

    // Play critical alert sound using Web Audio API
    const playCriticalAlert = useCallback(() => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const playTone = (freq: number, startTime: number, duration: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.3, startTime);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
                osc.start(startTime);
                osc.stop(startTime + duration);
            };
            // Urgent tri-tone pattern
            playTone(880, ctx.currentTime, 0.15);
            playTone(1046, ctx.currentTime + 0.18, 0.15);
            playTone(880, ctx.currentTime + 0.36, 0.15);
            // repeat
            playTone(880, ctx.currentTime + 0.7, 0.15);
            playTone(1046, ctx.currentTime + 0.88, 0.15);
            playTone(880, ctx.currentTime + 1.06, 0.15);
        } catch (e) {
            // Audio not available — silent fallback
        }
    }, []);

    useEffect(() => {
        const t1 = setTimeout(() => {
            setShowNotifCard(true);
            playCriticalAlert();
        }, 1500);
        return () => clearTimeout(t1);
    }, [playCriticalAlert]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto px-4 py-6"
        >
            <AnimatePresence mode="wait">
                {/* ── PHASE 1: Clinician Phone Screen ── */}
                {phase === 'phone' && (
                    <motion.div
                        key="clinician-phone"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center justify-center py-8"
                    >
                        {/* Phone frame */}
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="relative w-[393px] h-[852px] rounded-[40px] overflow-hidden border-2 border-red-500/30 shadow-2xl"
                            style={{
                                background: 'linear-gradient(180deg, #111113 0%, #0a0a0b 100%)',
                                boxShadow: '0 0 60px rgba(239,68,68,0.15), 0 20px 40px rgba(0,0,0,0.5)',
                            }}
                        >
                            {/* Status bar */}
                            <div className="flex items-center justify-between px-8 pt-4 pb-2">
                                <span className="text-xs font-semibold text-white">T-Mobile</span>
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-2 rounded-sm border border-white/60 relative">
                                        <div className="absolute inset-[1px] right-[2px] bg-green-400 rounded-[1px]" />
                                    </div>
                                </div>
                            </div>

                            {/* Lock screen */}
                            <div className="text-center py-10">
                                <div className="text-zinc-500 text-xs uppercase tracking-widest mb-1">
                                    Saturday, March 2
                                </div>
                                <div className="text-6xl font-thin text-white tracking-tight">
                                    7:14
                                </div>
                                <div className="text-xs text-zinc-500 mt-2 font-medium uppercase tracking-wider">
                                    Office Hours
                                </div>
                            </div>

                            {/* Critical Alert Notification */}
                            <AnimatePresence>
                                {showNotifCard && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -60, scale: 0.9 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                        onClick={(e) => {
                                            if (alertTapped) return;
                                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                            setAlertTapPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                                            setAlertTapped(true);
                                            setTimeout(() => setPhase('clinicianView'), 2500);
                                        }}
                                        className="mx-4 mb-6 rounded-2xl p-3.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform relative overflow-hidden"
                                        style={{
                                            background: 'rgba(239,68,68,0.12)',
                                            backdropFilter: 'blur(40px)',
                                            border: alertTapped ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(239,68,68,0.3)',
                                        }}
                                    >
                                        {/* Tap ripple — red */}
                                        {alertTapped && alertTapPos && (
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0.8 }}
                                                animate={{ scale: 6, opacity: 0 }}
                                                transition={{ duration: 2.5, ease: 'easeOut' }}
                                                className="absolute rounded-full pointer-events-none"
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    left: alertTapPos.x - 20,
                                                    top: alertTapPos.y - 20,
                                                    background: 'radial-gradient(circle, rgba(239,68,68,0.6) 0%, rgba(239,68,68,0) 70%)',
                                                    boxShadow: '0 0 30px rgba(239,68,68,0.5)',
                                                }}
                                            />
                                        )}

                                        <div className="flex items-start gap-3 relative z-10">
                                            <div className="relative flex-shrink-0 mt-0.5">
                                                <div className="w-10 h-10 rounded-xl bg-red-500/25 flex items-center justify-center">
                                                    <Shield className="w-5 h-5 text-red-400" />
                                                </div>
                                                {/* Pulsing red dot */}
                                                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">⚠ Critical Alert</span>
                                                    </div>
                                                    <span className="text-[10px] text-zinc-500">now</span>
                                                </div>
                                                <p className="text-xs font-bold text-white mb-0.5">AuntEdna — Clinical Escalation</p>
                                                <p className="text-[11px] text-zinc-300 leading-snug">
                                                    K. Thompson (#52) has been flagged for immediate clinical attention. Tap to review full briefing.
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* iOS Critical Alert note */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: showNotifCard ? 1 : 0 }}
                                transition={{ delay: 0.5 }}
                                className="text-center pb-6"
                            >
                                <span className="text-[9px] text-red-400/50 uppercase tracking-widest">
                                    Critical Alert • Bypasses Do Not Disturb
                                </span>
                            </motion.div>
                        </motion.div>

                        {/* Context label */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 2 }}
                            className="mt-6 text-center"
                        >
                            <div className="text-xs text-zinc-500 uppercase tracking-widest">
                                Clinician Experience — Critical Escalation Alert
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* ── PHASE 2: Full Clinician Interface ── */}
                {phase === 'clinicianView' && (
                    <motion.div
                        key="clinician-interface"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="flex gap-0 pb-12"
                        style={{ maxWidth: '1200px', margin: '0 auto' }}
                    >
                        {/* ── Sidebar ── */}
                        <motion.aside
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5 }}
                            className="w-56 shrink-0 rounded-2xl border border-zinc-700/40 mr-5 flex flex-col overflow-hidden"
                            style={{ background: 'linear-gradient(180deg, rgba(147,51,234,0.05) 0%, rgba(15,15,18,0.95) 100%)' }}
                        >
                            {/* App Logo */}
                            <div className="px-4 pt-5 pb-3 border-b border-zinc-800/60">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                                        <Shield className="w-4 h-4 text-purple-400" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-white">AuntEdna</div>
                                        <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Clinical Platform</div>
                                    </div>
                                </div>
                            </div>

                            {/* Dr. Mitchell Profile */}
                            <div className="px-4 py-4 border-b border-zinc-800/60">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/20 border border-purple-500/20 flex items-center justify-center">
                                        <span className="text-sm font-bold text-purple-300">DM</span>
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-white">Dr. R. Mitchell</div>
                                        <div className="text-[10px] text-zinc-500">PsyD, CMPC</div>
                                        <div className="text-[9px] text-purple-400/70">Team Psychologist</div>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation */}
                            <nav className="flex-1 px-2 py-3 space-y-0.5">
                                {[
                                    { icon: Home, label: 'Home', active: false },
                                    { icon: Users, label: 'Patients', active: true, badge: '3' },
                                    { icon: Pill, label: 'Prescriptions', active: false },
                                    { icon: Building2, label: 'Pharmacies', active: false },
                                    { icon: FileText, label: 'Documents', active: false },
                                ].map((item) => (
                                    <div
                                        key={item.label}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${item.active
                                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                                            : 'text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300 border border-transparent'
                                            }`}
                                    >
                                        <item.icon className={`w-4 h-4 ${item.active ? 'text-purple-400' : ''}`} />
                                        <span className="text-sm font-medium">{item.label}</span>
                                        {item.badge && (
                                            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/25 font-bold">
                                                {item.badge}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </nav>

                            {/* Logout */}
                            <div className="px-2 pb-4 mt-auto">
                                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-600 hover:bg-zinc-800/40 hover:text-zinc-400 cursor-pointer transition-colors border border-transparent">
                                    <LogOut className="w-4 h-4" />
                                    <span className="text-sm font-medium">Logout</span>
                                </div>
                            </div>
                        </motion.aside>

                        {/* ── Main Content ── */}
                        <div className="flex-1 space-y-5 min-w-0">
                            {/* Top Bar */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-zinc-500">Patients</span>
                                        <ChevronRight className="w-3 h-3 text-zinc-600" />
                                        <span className="text-sm text-white font-medium">K. Thompson</span>
                                    </div>
                                </div>
                                <span className="text-xs px-3 py-1.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 font-bold animate-pulse">
                                    CRITICAL
                                </span>
                            </div>

                            {/* Player Profile Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 }}
                                className="rounded-2xl border border-zinc-700/40 p-5"
                                style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.04) 0%, rgba(147,51,234,0.04) 100%)' }}
                            >
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-14 h-14 rounded-xl bg-red-500/20 flex items-center justify-center border border-red-500/20">
                                        <span className="text-xl font-bold text-red-400">#52</span>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-white">Kevin Thompson</h3>
                                        <p className="text-xs text-zinc-500">Linebacker • Junior • 6&apos;2&quot; 235 lbs</p>
                                        <p className="text-xs text-zinc-600 mt-0.5">Escalated: March 2, 2026 at 7:12 AM</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-red-400">8.2</div>
                                        <div className="text-[9px] text-zinc-500 uppercase">Distress Score</div>
                                    </div>
                                </div>

                                {/* Biometric Snapshot */}
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { label: 'Resting HR', value: '78 bpm', color: 'text-amber-400', note: '↑ Elevated' },
                                        { label: 'HRV', value: '28 ms', color: 'text-red-400', note: '↓ Low' },
                                        { label: 'Sleep', value: '3.5h', color: 'text-red-400', note: '↓ Poor' },
                                        { label: 'Cortisol', value: 'High', color: 'text-amber-400', note: '↑ Elevated' },
                                    ].map((m) => (
                                        <div key={m.label} className="rounded-xl bg-zinc-800/50 border border-zinc-700/30 p-2.5 text-center">
                                            <div className={`text-base font-bold ${m.color}`}>{m.value}</div>
                                            <div className="text-[9px] text-zinc-500 uppercase">{m.label}</div>
                                            <div className={`text-[8px] mt-0.5 ${m.color}`}>{m.note}</div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>

                            {/* Flagged Conversation */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="rounded-2xl border border-red-500/20 p-5"
                                style={{ background: 'rgba(239,68,68,0.03)' }}
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                    <h4 className="text-sm font-bold text-white">Flagged Conversation Excerpts</h4>
                                    <span className="text-[9px] text-zinc-600 ml-auto">Check-in • 6:50 AM</span>
                                </div>

                                <div className="space-y-3">
                                    {/* Nora asks */}
                                    <div className="flex gap-2">
                                        <div className="w-6 h-6 rounded-full bg-[#E0FE10]/15 flex items-center justify-center shrink-0 mt-0.5">
                                            <Brain className="w-3 h-3 text-[#E0FE10]" />
                                        </div>
                                        <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 px-3 py-2 text-sm text-zinc-300">
                                            Hey Kevin, good morning. How are you feeling heading into today?
                                        </div>
                                    </div>

                                    {/* Athlete response — flagged */}
                                    <div className="flex gap-2 justify-end">
                                        <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/30 px-3 py-2 text-sm text-zinc-200 max-w-[80%]">
                                            Honestly I don&apos;t even want to be here today. Everything just feels{' '}
                                            <span className="bg-red-500/20 text-red-300 px-1 rounded border-b border-red-400/50 font-medium">
                                                pointless
                                            </span>
                                            . I don&apos;t know why I even bother anymore.
                                        </div>
                                    </div>

                                    {/* Nora follows up */}
                                    <div className="flex gap-2">
                                        <div className="w-6 h-6 rounded-full bg-[#E0FE10]/15 flex items-center justify-center shrink-0 mt-0.5">
                                            <Brain className="w-3 h-3 text-[#E0FE10]" />
                                        </div>
                                        <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 px-3 py-2 text-sm text-zinc-300">
                                            I appreciate you being honest with me. Can you tell me more about what&apos;s going on?
                                        </div>
                                    </div>

                                    {/* Second flagged response */}
                                    <div className="flex gap-2 justify-end">
                                        <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/30 px-3 py-2 text-sm text-zinc-200 max-w-[80%]">
                                            I&apos;ve been having these thoughts like{' '}
                                            <span className="bg-red-500/20 text-red-300 px-1 rounded border-b border-red-400/50 font-medium">
                                                maybe everyone would be better off without me
                                            </span>
                                            . I can&apos;t sleep. I haven&apos;t eaten. I just{' '}
                                            <span className="bg-red-500/20 text-red-300 px-1 rounded border-b border-red-400/50 font-medium">
                                                feel completely empty
                                            </span>
                                            .
                                        </div>
                                    </div>

                                    {/* Nora escalation response */}
                                    <div className="flex gap-2">
                                        <div className="w-6 h-6 rounded-full bg-[#E0FE10]/15 flex items-center justify-center shrink-0 mt-0.5">
                                            <Brain className="w-3 h-3 text-[#E0FE10]" />
                                        </div>
                                        <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 px-3 py-2 text-sm text-zinc-300">
                                            Kevin, thank you for trusting me with that. What you&apos;re describing sounds like something that would really benefit from talking to someone who specializes in this. I&apos;m going to connect you with Dr. Mitchell right now&hellip;
                                            <div className="text-[9px] text-purple-400 mt-1 uppercase font-bold tracking-wider">
                                                → Clinical handoff initiated
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* AI Analysis */}
                                <div className="mt-4 rounded-xl bg-zinc-900/60 border border-zinc-700/20 p-3">
                                    <div className="text-[9px] text-red-400 uppercase font-bold tracking-wider mb-1">AI Sentiment Analysis</div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <div className="text-sm font-bold text-red-400">Critical</div>
                                            <div className="text-[9px] text-zinc-500">Severity</div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-red-400">3 Triggers</div>
                                            <div className="text-[9px] text-zinc-500">Flagged Phrases</div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-amber-400">Escalating</div>
                                            <div className="text-[9px] text-zinc-500">7-Day Trend</div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Medical History */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.45 }}
                                className="rounded-2xl border border-zinc-700/40 p-5"
                                style={{ background: 'rgba(147,51,234,0.03)' }}
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <Shield className="w-4 h-4 text-purple-400" />
                                    <h4 className="text-sm font-bold text-white">Medical History</h4>
                                    <span className="text-[9px] text-zinc-600 ml-auto">HIPAA Protected</span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Past Injuries */}
                                    <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3">
                                        <div className="text-[9px] text-zinc-500 uppercase font-bold mb-2">Injury History</div>
                                        <div className="space-y-2">
                                            {[
                                                { injury: 'ACL Tear (Left Knee)', date: 'Oct 2024', note: 'Full surgical repair — 8 mo recovery' },
                                                { injury: 'Grade 2 Concussion', date: 'Sep 2023', note: 'Missed 3 games — cleared Nov 2023' },
                                                { injury: 'Shoulder Sprain (Right)', date: 'Nov 2022', note: 'Conservative treatment — 4 weeks' },
                                            ].map((inj) => (
                                                <div key={inj.injury} className="border-l-2 border-zinc-700 pl-2">
                                                    <div className="text-xs font-medium text-zinc-200">{inj.injury}</div>
                                                    <div className="text-[10px] text-zinc-500">{inj.date} • {inj.note}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Surgery & Medications */}
                                    <div className="space-y-3">
                                        <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3">
                                            <div className="text-[9px] text-zinc-500 uppercase font-bold mb-2">Surgical History</div>
                                            <div className="border-l-2 border-purple-500/30 pl-2">
                                                <div className="text-xs font-medium text-zinc-200">ACL Reconstruction</div>
                                                <div className="text-[10px] text-zinc-500">Oct 15, 2024 • Dr. Sarah Chen, MD</div>
                                                <div className="text-[10px] text-zinc-500">Patellar tendon autograft — cleared for full contact Feb 2025</div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3">
                                            <div className="text-[9px] text-zinc-500 uppercase font-bold mb-2">Current Medications</div>
                                            <div className="space-y-1.5">
                                                {[
                                                    { med: 'Sertraline 50mg', purpose: 'SSRI — prescribed Jan 2026', status: 'Active' },
                                                    { med: 'Melatonin 5mg', purpose: 'Sleep aid — OTC', status: 'Active' },
                                                    { med: 'Ibuprofen 400mg', purpose: 'Anti-inflammatory — PRN', status: 'As needed' },
                                                ].map((rx) => (
                                                    <div key={rx.med} className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-xs font-medium text-zinc-200">{rx.med}</div>
                                                            <div className="text-[10px] text-zinc-500">{rx.purpose}</div>
                                                        </div>
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                            {rx.status}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Recommended Next Steps */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                                className="rounded-2xl border border-purple-500/20 p-5"
                                style={{ background: 'linear-gradient(135deg, rgba(147,51,234,0.05) 0%, rgba(59,130,246,0.03) 100%)' }}
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <Zap className="w-4 h-4 text-purple-400" />
                                    <h4 className="text-sm font-bold text-white">Recommended Clinical Actions</h4>
                                </div>
                                <div className="space-y-2.5">
                                    {[
                                        { step: 'Initiate immediate welfare check — contact K. Thompson directly', priority: 'Urgent', color: 'bg-red-500/15 text-red-400 border-red-500/25', clickable: true },
                                        { step: 'Schedule same-day clinical session with Dr. Mitchell (team psychologist)', priority: 'High', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25', clickable: false },
                                        { step: 'Review medication compliance — Sertraline prescribed 8 weeks ago, verify adherence', priority: 'High', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25', clickable: false },
                                        { step: 'Coordinate with athletic training on practice status — recommend hold pending evaluation', priority: 'Medium', color: 'bg-blue-500/15 text-blue-400 border-blue-500/25', clickable: false },
                                        { step: 'Notify head coach of availability status only (no clinical details per HIPAA)', priority: 'Medium', color: 'bg-blue-500/15 text-blue-400 border-blue-500/25', clickable: false },
                                        { step: 'Document all actions and clearance decision in clinical record', priority: 'Standard', color: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30', clickable: false },
                                    ].map((item, i) => (
                                        <div
                                            key={i}
                                            className={`flex items-start gap-3 p-2.5 rounded-xl bg-zinc-800/30 border border-zinc-700/20 ${item.clickable ? 'cursor-pointer hover:bg-red-500/10 hover:border-red-500/20 transition-colors' : ''
                                                }`}
                                            onClick={() => {
                                                if (item.clickable) {
                                                    setPhase('calling');
                                                }
                                            }}
                                        >
                                            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400 shrink-0 mt-0.5">
                                                {i + 1}
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-sm text-zinc-200">{item.step}</span>
                                            </div>
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold shrink-0 ${item.color}`}>
                                                {item.priority}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        </div>{/* end main content */}
                    </motion.div>
                )}

                {/* ── PHASE 3: Calling K. Thompson ── */}
                {phase === 'calling' && (
                    <motion.div
                        key="calling-phase"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => { if (callStatus === 'ended') onContinue(); }}
                        className={`flex flex-col items-center justify-center py-16 space-y-6 ${callStatus === 'ended' ? 'cursor-pointer' : ''}`}
                    >
                        {/* Phone UI */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-[300px] rounded-[36px] overflow-hidden border border-zinc-700/40 p-8 text-center"
                            style={{ background: 'linear-gradient(180deg, #16161a 0%, #0c0c0e 100%)' }}
                        >
                            {/* Avatar */}
                            <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl font-bold text-zinc-400">KT</span>
                            </div>
                            <div className="text-lg font-bold text-white mb-1">Kevin Thompson</div>
                            <div className="text-xs text-zinc-500 mb-6">#52 • Linebacker</div>

                            {/* Status */}
                            <motion.div
                                animate={{ opacity: callStatus === 'ringing' ? [0.5, 1, 0.5] : 1 }}
                                transition={{ duration: 2, repeat: callStatus === 'ringing' ? Infinity : 0 }}
                                className="mb-6"
                            >
                                {callStatus === 'ringing' && (
                                    <div className="text-sm text-[#E0FE10]">Calling&hellip;</div>
                                )}
                                {callStatus === 'connected' && (
                                    <CallTimer />
                                )}
                                {callStatus === 'ended' && (
                                    <div className="text-sm text-zinc-400">Call Ended</div>
                                )}
                            </motion.div>

                            {/* Pulsing ring indicator */}
                            {callStatus === 'ringing' && (
                                <div className="flex justify-center mb-4">
                                    <motion.div
                                        animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                        className="w-16 h-16 rounded-full bg-[#E0FE10]/20 absolute"
                                    />
                                    <div className="w-16 h-16 rounded-full bg-[#E0FE10]/15 flex items-center justify-center">
                                        <Volume2 className="w-6 h-6 text-[#E0FE10]" />
                                    </div>
                                </div>
                            )}

                            {/* Connected indicator — voice waveform */}
                            {callStatus === 'connected' && (
                                <div className="flex flex-col items-center gap-3 mb-4">
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                    >
                                        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center border border-green-500/30 gap-[3px]">
                                            {/* Voice bars */}
                                            {[0.6, 1.0, 0.7, 0.9, 0.5].map((baseHeight, i) => (
                                                <motion.div
                                                    key={i}
                                                    className="w-[3px] rounded-full bg-green-400"
                                                    animate={{
                                                        height: [
                                                            `${baseHeight * 8}px`,
                                                            `${baseHeight * 20}px`,
                                                            `${baseHeight * 6}px`,
                                                            `${baseHeight * 16}px`,
                                                            `${baseHeight * 10}px`,
                                                        ],
                                                    }}
                                                    transition={{
                                                        duration: 0.8 + i * 0.15,
                                                        repeat: Infinity,
                                                        ease: 'easeInOut',
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </motion.div>
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 1 }}
                                    >
                                        <div className="text-[10px] text-zinc-500">&quot;Hey Doc, thanks for calling...&quot;</div>
                                    </motion.div>
                                </div>
                            )}

                            {callStatus === 'ended' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                                    <div className="text-xs text-green-400 mb-1">✓ Welfare check complete</div>
                                    <div className="text-[10px] text-zinc-600">Session scheduled for 10:00 AM</div>
                                </motion.div>
                            )}
                        </motion.div>

                        {/* Label */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="text-xs text-zinc-500 uppercase tracking-widest"
                        >
                            Welfare Check In Progress
                        </motion.div>

                        {/* Auto-advance the call */}
                        <CallSimulation
                            onRinging={() => setCallStatus('ringing')}
                            onConnected={() => setCallStatus('connected')}
                            onEnded={() => {
                                setCallStatus('ended');
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// Helper to drive call timing
const CallSimulation: React.FC<{
    onRinging: () => void;
    onConnected: () => void;
    onEnded: () => void;
}> = ({ onRinging, onConnected, onEnded }) => {
    // Use refs to avoid re-running the effect when callbacks change
    const onRingingRef = useRef(onRinging);
    const onConnectedRef = useRef(onConnected);
    const onEndedRef = useRef(onEnded);
    onRingingRef.current = onRinging;
    onConnectedRef.current = onConnected;
    onEndedRef.current = onEnded;

    useEffect(() => {
        // Play ringing tone
        const playRing = () => {
            try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const ring = (time: number) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.value = 440;
                    gain.gain.setValueAtTime(0.15, time);
                    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
                    osc.start(time);
                    osc.stop(time + 0.4);
                };
                ring(ctx.currentTime);
                ring(ctx.currentTime + 0.6);
                ring(ctx.currentTime + 1.8);
                ring(ctx.currentTime + 2.4);
            } catch (e) { /* silent */ }
        };

        onRingingRef.current();
        playRing();
        const t1 = setTimeout(() => onConnectedRef.current(), 5000);
        const t2 = setTimeout(() => onEndedRef.current(), 10000);
        return () => { clearTimeout(t1); clearTimeout(t2); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
};

// ─────────────────────────────────────────────────────────
// THE CLOSE — Act 4: Performance Showcase + The Kill Switch
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// THE CLOSE — Act 4: Performance Showcase + The Kill Switch
// ─────────────────────────────────────────────────────────

const TheClose: React.FC = () => {
    const [phase, setPhase] = useState<'phone' | 'chat'>('phone');
    const [notifTapped, setNotifTapped] = useState(false);
    const [notifTapPos, setNotifTapPos] = useState<{ x: number; y: number } | null>(null);
    const [showNotifCard, setShowNotifCard] = useState(false);
    const [chatMessages, setChatMessages] = useState<Array<{
        id: string;
        role: 'nora' | 'athlete' | 'system';
        text: string;
        type?: 'drill-card' | 'progress-card';
    }>>([]);
    const [chatStep, setChatStep] = useState(0);
    const [isNTyping, setIsNTyping] = useState(false);
    const [resetPhase, setResetPhase] = useState<
        'idle' | 'lockIn' | 'disruption' | 'killSwitch' | 'done'
    >('idle');
    const [drillActive, setDrillActive] = useState(false);
    const [gameExpanded, setGameExpanded] = useState(false);
    // Kill Switch game state
    const [ksPulseScale, setKsPulseScale] = useState(1);
    const [ksPulseActive, setKsPulseActive] = useState(false);
    const [ksTapAccuracy, setKsTapAccuracy] = useState<boolean[]>([]);
    const ksExpectedTapRef = useRef<number>(0);
    const ksPulseTimerRef = useRef<NodeJS.Timeout | null>(null);
    const ksLockInTimerRef = useRef<NodeJS.Timeout | null>(null);
    const ksDisruptionEndRef = useRef<number>(0);
    const ksRecoveryStartedRef = useRef(false);
    const [ksRecoveryTime, setKsRecoveryTime] = useState<number | null>(null);
    const [ksFlashActive, setKsFlashActive] = useState(false);
    const [ksProvocMessage, setKsProvocMessage] = useState('');
    const [ksLockInRemaining, setKsLockInRemaining] = useState(10);
    const [ksCurrentRound, setKsCurrentRound] = useState(1);
    const [ksRoundTimes, setKsRoundTimes] = useState<number[]>([]);
    const [ksRoundPhase, setKsRoundPhase] = useState<'playing' | 'result' | 'summary'>('playing');
    const ksTotalRounds = 3; // shorter for demo
    const closeScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const t = setTimeout(() => setShowNotifCard(true), 1500);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (closeScrollRef.current) {
            closeScrollRef.current.scrollTop = closeScrollRef.current.scrollHeight;
        }
    }, [chatMessages, isNTyping, drillActive, resetPhase, ksPulseScale, ksFlashActive, ksRoundPhase]);

    const addNoraMsg = useCallback((text: string, type?: 'drill-card' | 'progress-card') => {
        setIsNTyping(true);
        setTimeout(() => {
            setIsNTyping(false);
            setChatMessages((prev) => [...prev, { id: `close-${Date.now()}`, role: 'nora', text, type }]);
        }, 1200);
    }, []);

    const advanceChat = useCallback((choice?: string) => {
        const step = chatStep;
        setChatStep(step + 1);

        if (step === 0) {
            addNoraMsg("Hey! 👋 Your coach assigned you The Kill Switch today. This is the single most important mental recovery exercise in your program — it trains how fast you bounce back after something goes wrong. Ready to jump in, or do you want me to walk you through the details first?");
        } else if (step === 1 && choice === 'walk') {
            setChatMessages((prev) => [...prev, { id: `close-${Date.now()}`, role: 'athlete', text: 'Walk me through it first.' }]);
            setTimeout(() => {
                addNoraMsg("The Kill Switch trains your brain to recover from any disruption — a bad play, a missed shot, a mental error — as fast as possible. It simulates real pressure and measures your recovery speed. Here's how it works:");
            }, 300);
        } else if (step === 2) {
            setTimeout(() => {
                addNoraMsg("Phase 1: LOCK IN — You'll engage a focus task. Get in rhythm and stay locked.");
                setTimeout(() => {
                    addNoraMsg("Phase 2: DISRUPTION — Something will break your focus. A flash, a provocative message, chaos. Just like a bad play in a game.");
                    setTimeout(() => {
                        addNoraMsg("Phase 3: KILL SWITCH — Re-engage as fast as possible. We measure exactly how long it takes you to recover. That's your Kill Switch time.");
                        setTimeout(() => {
                            addNoraMsg("Most athletes take 30-60 seconds to recover from a mistake. Elite athletes? Under 3 seconds. Ready to train yours?", 'drill-card');
                        }, 1400);
                    }, 1400);
                }, 1400);
            }, 300);
        } else if (step === 3 && choice === 'ready') {
            setChatMessages((prev) => [...prev, { id: `close-${Date.now()}`, role: 'athlete', text: "Let's do it. I'm ready." }]);
            setTimeout(() => {
                addNoraMsg("Starting The Kill Switch now. Lock in and stay focused...");
                setTimeout(() => setDrillActive(true), 1500);
            }, 300);
        }
    }, [chatStep, addNoraMsg]);

    useEffect(() => {
        if (phase === 'chat' && chatStep === 0) {
            advanceChat();
        }
    }, [phase, chatStep, advanceChat]);

    const ksProvocMessages = [
        'You missed it.',
        'Too slow.',
        "Everyone's watching.",
        'That was ugly.',
        'Wrong move.',
        "You're falling behind.",
        'Losing focus?',
    ];

    // Start the pulse animation for the focus task
    const startKsPulse = useCallback(() => {
        if (ksPulseTimerRef.current) clearInterval(ksPulseTimerRef.current);
        setKsTapAccuracy([]);
        ksPulseTimerRef.current = setInterval(() => {
            ksExpectedTapRef.current = Date.now();
            setKsPulseActive(true);
            setKsPulseScale(1.3);
            setTimeout(() => {
                setKsPulseScale(1);
                setKsPulseActive(false);
            }, 600);
        }, 1200);
    }, []);

    // Trigger the disruption
    const triggerKsDisruption = useCallback(() => {
        setResetPhase('disruption');
        if (ksPulseTimerRef.current) clearInterval(ksPulseTimerRef.current);
        // Red flash
        setKsFlashActive(true);
        setTimeout(() => setKsFlashActive(false), 150);
        setTimeout(() => setKsFlashActive(true), 300);
        setTimeout(() => setKsFlashActive(false), 450);
        // Provocative message
        setKsProvocMessage(ksProvocMessages[Math.floor(Math.random() * ksProvocMessages.length)]);

        // After disruption → kill switch phase
        setTimeout(() => {
            setResetPhase('killSwitch');
            ksDisruptionEndRef.current = Date.now();
            ksRecoveryStartedRef.current = false;
            setKsTapAccuracy([]);
            // Restart pulse
            startKsPulse();
        }, 2000);
    }, [startKsPulse]);

    // Start a round (lock in → disruption → kill switch)
    const startKsRound = useCallback(() => {
        setResetPhase('lockIn');
        setKsRecoveryTime(null);
        setKsTapAccuracy([]);
        setKsRoundPhase('playing');
        ksRecoveryStartedRef.current = false;

        // Start pulse
        startKsPulse();

        // Lock-in countdown
        const duration = 8; // seconds of lock-in before disruption
        const startTime = Date.now();
        setKsLockInRemaining(duration);
        if (ksLockInTimerRef.current) clearInterval(ksLockInTimerRef.current);
        ksLockInTimerRef.current = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            const remaining = duration - elapsed;
            if (remaining <= 0) {
                if (ksLockInTimerRef.current) clearInterval(ksLockInTimerRef.current);
                ksLockInTimerRef.current = null;
                triggerKsDisruption();
            } else {
                setKsLockInRemaining(remaining);
            }
        }, 100);
    }, [startKsPulse, triggerKsDisruption]);

    // Handle focus task tap
    const handleKsTap = useCallback(() => {
        const now = Date.now();
        const diff = Math.abs(now - ksExpectedTapRef.current);
        const accurate = diff < 400;
        setKsTapAccuracy((prev) => [...prev, accurate]);

        if (resetPhase === 'killSwitch' && !ksRecoveryStartedRef.current && accurate) {
            ksRecoveryStartedRef.current = true;
            const recoveryTime = Math.max(0.1, (now - ksDisruptionEndRef.current) / 1000);
            setKsRecoveryTime(recoveryTime);
            setKsRoundTimes((prev) => [...prev, recoveryTime]);
            if (ksPulseTimerRef.current) clearInterval(ksPulseTimerRef.current);

            // Show round result
            setTimeout(() => {
                setKsRoundPhase('result');
            }, 800);
        }
    }, [resetPhase]);

    // Advance to next round or show summary
    const advanceKsRound = useCallback(() => {
        if (ksCurrentRound >= ksTotalRounds) {
            // All rounds done → summary
            setKsRoundPhase('summary');
            setResetPhase('done');
        } else {
            setKsCurrentRound((prev) => prev + 1);
            startKsRound();
        }
    }, [ksCurrentRound, ksTotalRounds, startKsRound]);

    // Finish the drill → post results to chat
    const finishKsDrill = useCallback(() => {
        if (ksPulseTimerRef.current) clearInterval(ksPulseTimerRef.current);
        if (ksLockInTimerRef.current) clearInterval(ksLockInTimerRef.current);
        setDrillActive(false);
        setGameExpanded(false);
        setResetPhase('idle');
        const avgTime = ksRoundTimes.length > 0
            ? (ksRoundTimes.reduce((a, b) => a + b, 0) / ksRoundTimes.length).toFixed(1)
            : '2.8';
        const bestTime = ksRoundTimes.length > 0
            ? Math.min(...ksRoundTimes).toFixed(1)
            : '2.4';
        setChatMessages((prev) => [...prev, { id: `close-${Date.now()}`, role: 'system', text: `✓ Kill Switch Complete — ${avgTime}s avg recovery (best: ${bestTime}s)` }]);
        setTimeout(() => {
            addNoraMsg(`That was incredible. ${avgTime} seconds average recovery across ${ksTotalRounds} rounds. You're consistently under 3 seconds now — that's elite-level recovery. Let me show you how far you've come over the past 90 days...`, 'progress-card');
        }, 800);
    }, [ksRoundTimes, ksTotalRounds, addNoraMsg]);

    // Start the game (called when user clicks "Begin Training")
    const runResetExercise = () => {
        setKsCurrentRound(1);
        setKsRoundTimes([]);
        startKsRound();
    };

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (ksPulseTimerRef.current) clearInterval(ksPulseTimerRef.current);
            if (ksLockInTimerRef.current) clearInterval(ksLockInTimerRef.current);
        };
    }, []);

    const closeResponses: Record<number, Array<{ label: string; value: string }>> = {
        1: [
            { label: 'Walk me through it first', value: 'walk' },
            { label: "I'm ready, let's go", value: 'ready-now' },
        ],
        3: [
            { label: "Let's do it. I'm ready.", value: 'ready' },
        ],
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full"
        >
            <AnimatePresence mode="wait">
                {/* PHONE NOTIFICATION */}
                {phase === 'phone' && (
                    <motion.div
                        key="close-phone"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center justify-center py-8"
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="relative w-[393px] h-[852px] rounded-[40px] overflow-hidden border-2 border-green-500/20 shadow-2xl"
                            style={{
                                background: 'linear-gradient(180deg, #111113 0%, #0a0a0b 100%)',
                                boxShadow: '0 0 60px rgba(34,197,94,0.1), 0 20px 40px rgba(0,0,0,0.5)',
                            }}
                        >
                            <div className="flex items-center justify-between px-8 pt-4 pb-2">
                                <span className="text-xs font-semibold text-white">T-Mobile</span>
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-2 rounded-sm border border-white/60 relative">
                                        <div className="absolute inset-[1px] right-[2px] bg-green-400 rounded-[1px]" />
                                    </div>
                                </div>
                            </div>
                            <div className="text-center py-10">
                                <div className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Saturday, March 2</div>
                                <div className="text-6xl font-thin text-white tracking-tight">2:30</div>
                                <div className="text-xs text-zinc-500 mt-2 font-medium uppercase tracking-wider">Pre-Game</div>
                            </div>
                            <AnimatePresence>
                                {showNotifCard && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -60, scale: 0.9 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                        onClick={(e) => {
                                            if (notifTapped) return;
                                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                            setNotifTapPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                                            setNotifTapped(true);
                                            setTimeout(() => setPhase('chat'), 2500);
                                        }}
                                        className="mx-4 mb-6 rounded-2xl p-3.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform relative overflow-hidden"
                                        style={{
                                            background: 'rgba(34,197,94,0.08)',
                                            backdropFilter: 'blur(40px)',
                                            border: notifTapped ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(34,197,94,0.2)',
                                        }}
                                    >
                                        {notifTapped && notifTapPos && (
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0.8 }}
                                                animate={{ scale: 6, opacity: 0 }}
                                                transition={{ duration: 2.5, ease: 'easeOut' }}
                                                className="absolute rounded-full pointer-events-none"
                                                style={{
                                                    width: 40, height: 40,
                                                    left: notifTapPos.x - 20, top: notifTapPos.y - 20,
                                                    background: 'radial-gradient(circle, rgba(34,197,94,0.6) 0%, rgba(34,197,94,0) 70%)',
                                                    boxShadow: '0 0 30px rgba(34,197,94,0.4)',
                                                }}
                                            />
                                        )}
                                        <div className="flex items-start gap-3 relative z-10">
                                            <div className="relative flex-shrink-0 mt-0.5">
                                                <div className="w-10 h-10 rounded-xl bg-[#E0FE10]/15 flex items-center justify-center">
                                                    <Brain className="w-5 h-5 text-[#E0FE10]" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-[10px] font-bold text-[#E0FE10] uppercase tracking-wider">Nora — Mental Training</span>
                                                    <span className="text-[10px] text-zinc-500">now</span>
                                                </div>
                                                <p className="text-xs font-bold text-white mb-0.5">Assigned Drill Ready</p>
                                                <p className="text-[11px] text-zinc-300 leading-snug">Coach assigned you The Kill Switch drill. Complete by end of day. Tap to start.</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div className="text-center pb-6">
                                <span className="text-[9px] text-green-400/40 uppercase tracking-widest">Mental Training • Assigned by Coach</span>
                            </div>
                        </motion.div>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="mt-6 text-center">
                            <div className="text-xs text-zinc-500 uppercase tracking-widest">Athlete Experience — Assigned Mental Training</div>
                        </motion.div>
                    </motion.div>
                )}

                {/* CHAT — matches Act 1 UI exactly */}
                {phase === 'chat' && (
                    <motion.div
                        key="close-chat"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-full flex flex-col"
                    >
                        {/* Chat messages area — same as Act 1 */}
                        <div
                            ref={closeScrollRef}
                            className="flex-1 overflow-y-auto"
                            style={{ overscrollBehavior: 'contain' }}
                        >
                            <div className="max-w-3xl mx-auto px-4 py-8">
                                <div className="space-y-6">
                                    <AnimatePresence>
                                        {chatMessages.map((m) => (
                                            <motion.div
                                                key={m.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.4 }}
                                                className="flex gap-4 items-start"
                                            >
                                                {/* Nora Avatar — same as Act 1 */}
                                                {m.role === 'nora' && (
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E0FE10]/30 to-[#E0FE10]/10 border border-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                                                        <Brain className="w-3.5 h-3.5 text-[#E0FE10]" />
                                                    </div>
                                                )}

                                                {/* Message bubble — same as Act 1 */}
                                                <div className={`flex-1 ${m.role === 'athlete' ? 'flex justify-end' : m.role === 'system' ? 'flex justify-center' : ''}`}>
                                                    {m.role === 'system' ? (
                                                        <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full font-medium">
                                                            {m.text}
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div
                                                                className={`rounded-2xl px-4 py-3 max-w-[85%] ${m.role === 'athlete'
                                                                    ? 'bg-[#E0FE10]/10 border border-[#E0FE10]/20 ml-auto'
                                                                    : 'bg-zinc-800/60 border border-zinc-700/30'
                                                                    }`}
                                                            >
                                                                {m.role === 'nora' && (
                                                                    <div className="text-[10px] font-bold text-[#E0FE10]/70 uppercase tracking-wider mb-1">Nora</div>
                                                                )}
                                                                <p className={`text-sm leading-relaxed whitespace-pre-line ${m.role === 'athlete' ? 'text-[#E0FE10]/90' : 'text-zinc-200'
                                                                    }`}>
                                                                    {m.text}
                                                                </p>
                                                            </div>

                                                            {/* Drill card inline */}
                                                            {m.type === 'drill-card' && chatStep === 3 && !drillActive && resetPhase === 'idle' && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: 0.5 }}
                                                                    className="mt-2 rounded-xl border border-red-500/20 p-3 max-w-[85%]"
                                                                    style={{ background: 'rgba(239,68,68,0.06)' }}
                                                                >
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <Zap className="w-4 h-4 text-red-400" />
                                                                        <span className="text-xs font-bold text-white">The Kill Switch</span>
                                                                    </div>
                                                                    <div className="text-[10px] text-zinc-500">Lock In → Disruption → Kill Switch</div>
                                                                </motion.div>
                                                            )}

                                                            {/* Progress card inline */}
                                                            {m.type === 'progress-card' && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: 0.5 }}
                                                                    className="mt-2 rounded-xl border border-green-500/20 p-4 space-y-3 max-w-[85%]"
                                                                    style={{ background: 'rgba(34,197,94,0.04)' }}
                                                                >
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <Star className="w-4 h-4 text-green-400" />
                                                                        <span className="text-xs font-bold text-white">90-Day Progress Report</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        {[
                                                                            { label: 'Mental Score', value: '42 → 82', color: 'text-green-400', change: '+95%' },
                                                                            { label: 'Recovery Time', value: '45s → 2.8s', color: 'text-green-400', change: '-94%' },
                                                                            { label: 'Check-in Streak', value: '87 days', color: 'text-[#E0FE10]', change: '🔥' },
                                                                            { label: 'Drills Completed', value: '156', color: 'text-purple-400', change: '' },
                                                                        ].map((s) => (
                                                                            <div key={s.label} className="rounded-lg bg-zinc-800/50 border border-zinc-700/20 p-2 text-center">
                                                                                <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
                                                                                <div className="text-[8px] text-zinc-500 uppercase">{s.label}</div>
                                                                                {s.change && <div className={`text-[8px] ${s.color}`}>{s.change}</div>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <div className="pt-2">
                                                                        <div className="text-[9px] text-zinc-500 uppercase mb-1">Mental Performance Trend</div>
                                                                        <div className="flex items-end gap-[3px] h-12">
                                                                            {[42, 45, 48, 44, 52, 55, 60, 58, 65, 70, 74, 82].map((v, i) => (
                                                                                <motion.div
                                                                                    key={i}
                                                                                    initial={{ height: 0 }}
                                                                                    animate={{ height: `${(v / 100) * 100}%` }}
                                                                                    transition={{ delay: i * 0.06, duration: 0.4 }}
                                                                                    className={`flex-1 rounded-t ${i < 4 ? 'bg-zinc-600' : i < 8 ? 'bg-amber-400/70' : 'bg-green-400'}`}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 gap-2 pt-1">
                                                                        {[
                                                                            { month: 'Month 1', status: 'Foundation', dot: 'bg-zinc-500' },
                                                                            { month: 'Month 2', status: 'Building', dot: 'bg-amber-400' },
                                                                            { month: 'Month 3', status: 'Game Ready', dot: 'bg-green-400' },
                                                                        ].map((m2) => (
                                                                            <div key={m2.month} className="text-center">
                                                                                <div className="flex items-center justify-center gap-1">
                                                                                    <div className={`w-1.5 h-1.5 rounded-full ${m2.dot}`} />
                                                                                    <span className="text-[8px] text-zinc-500">{m2.month}</span>
                                                                                </div>
                                                                                <div className="text-[9px] text-zinc-300 font-medium">{m2.status}</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* User Avatar — same as Act 1 */}
                                                {m.role === 'athlete' && (
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                                        <span className="text-xs font-bold text-blue-300">TG</span>
                                                    </div>
                                                )}
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {/* Inline Kill Switch Drill — Full Interactive Game */}
                                    {drillActive && !gameExpanded && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="max-w-3xl mx-auto rounded-2xl border border-red-500/20 overflow-hidden relative"
                                            style={{ background: 'rgba(10,10,11,0.95)' }}
                                        >
                                            {/* Red flash overlay */}
                                            <AnimatePresence>
                                                {ksFlashActive && (
                                                    <motion.div
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 0.5 }}
                                                        exit={{ opacity: 0 }}
                                                        className="absolute inset-0 bg-red-500 z-40 pointer-events-none rounded-2xl"
                                                    />
                                                )}
                                            </AnimatePresence>

                                            {/* Header */}
                                            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
                                                <div className="flex items-center gap-2">
                                                    <Zap className="w-4 h-4 text-red-400" />
                                                    <span className="text-sm font-bold text-white">The Kill Switch</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {/* Round dots */}
                                                    <div className="flex gap-1.5">
                                                        {Array.from({ length: ksTotalRounds }).map((_, i) => (
                                                            <div
                                                                key={i}
                                                                className={`w-2 h-2 rounded-full transition-colors ${i < ksCurrentRound - 1 ? 'bg-[#E0FE10]' :
                                                                    i === ksCurrentRound - 1 ? (resetPhase === 'disruption' ? 'bg-red-500 animate-pulse' : resetPhase === 'killSwitch' ? 'bg-cyan-400' : 'bg-[#E0FE10]') :
                                                                        'bg-white/20'
                                                                    }`}
                                                            />
                                                        ))}
                                                    </div>
                                                    {/* Phase label */}
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${resetPhase === 'lockIn' ? 'text-[#E0FE10]' :
                                                        resetPhase === 'disruption' ? 'text-red-400' :
                                                            resetPhase === 'killSwitch' ? 'text-cyan-400' :
                                                                'text-zinc-500'
                                                        }`}>
                                                        {resetPhase === 'lockIn' ? 'Lock In' :
                                                            resetPhase === 'disruption' ? 'Disruption!' :
                                                                resetPhase === 'killSwitch' ? 'Kill Switch' :
                                                                    resetPhase === 'done' ? 'Complete' :
                                                                        `Round ${ksCurrentRound}`}
                                                    </span>
                                                    {/* Expand to fullscreen */}
                                                    <button
                                                        onClick={() => setGameExpanded(true)}
                                                        className="w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center hover:bg-zinc-700/60 hover:border-zinc-600/60 transition-all group"
                                                        title="Expand to fullscreen"
                                                    >
                                                        <Maximize2 className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Game Content */}
                                            <div className="px-4 py-6 min-h-[260px] flex flex-col items-center justify-center relative z-10">
                                                {resetPhase === 'idle' ? (
                                                    /* Start Button */
                                                    <div className="text-center space-y-4">
                                                        <motion.div
                                                            className="mx-auto w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center"
                                                            animate={{ scale: [1, 1.05, 1] }}
                                                            transition={{ duration: 2, repeat: Infinity }}
                                                        >
                                                            <Zap className="w-10 h-10 text-red-500" />
                                                        </motion.div>
                                                        <p className="text-zinc-400 text-sm">{ksTotalRounds} rounds • Tap in rhythm • Recover fast</p>
                                                        <button
                                                            onClick={runResetExercise}
                                                            className="px-8 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-sm hover:from-red-400 hover:to-red-500 transition-all shadow-lg shadow-red-500/20"
                                                        >
                                                            Begin Training →
                                                        </button>
                                                    </div>

                                                ) : ksRoundPhase === 'result' ? (
                                                    /* Round Result */
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="text-center space-y-4 w-full max-w-sm"
                                                    >
                                                        <div className="text-xs text-zinc-500 uppercase tracking-widest">Round {ksCurrentRound} of {ksTotalRounds}</div>
                                                        <div className="text-4xl font-black text-[#E0FE10]">
                                                            {ksRecoveryTime !== null ? `${ksRecoveryTime.toFixed(1)}s` : '—'}
                                                        </div>
                                                        <div className="text-sm text-zinc-400">Recovery Time</div>
                                                        {ksRecoveryTime !== null && ksRecoveryTime < 3.0 && (
                                                            <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full inline-block">
                                                                🔥 Under 3 seconds — Elite level
                                                            </div>
                                                        )}
                                                        <button
                                                            onClick={advanceKsRound}
                                                            className="mt-4 px-6 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-sm hover:bg-white/15 transition-colors"
                                                        >
                                                            {ksCurrentRound >= ksTotalRounds ? 'View Results' : 'Next Round →'}
                                                        </button>
                                                    </motion.div>

                                                ) : ksRoundPhase === 'summary' ? (
                                                    /* Summary */
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="text-center space-y-4 w-full max-w-sm"
                                                    >
                                                        <div className="text-xs text-zinc-500 uppercase tracking-widest">Training Complete</div>
                                                        <div className="text-2xl font-black text-[#E0FE10]">Kill Switch ✓</div>

                                                        {/* Round breakdown */}
                                                        <div className="grid grid-cols-3 gap-2 mt-4">
                                                            {ksRoundTimes.map((t, i) => (
                                                                <div key={i} className="rounded-lg bg-zinc-800/60 border border-zinc-700/30 p-2 text-center">
                                                                    <div className="text-[10px] text-zinc-500 uppercase">R{i + 1}</div>
                                                                    <div className={`text-sm font-bold ${t < 3.0 ? 'text-green-400' : 'text-amber-400'}`}>
                                                                        {t.toFixed(1)}s
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Stats */}
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="rounded-lg bg-zinc-800/40 border border-zinc-700/20 p-3 text-center">
                                                                <div className="text-lg font-bold text-[#E0FE10]">
                                                                    {ksRoundTimes.length > 0 ? (ksRoundTimes.reduce((a, b) => a + b, 0) / ksRoundTimes.length).toFixed(1) : '—'}s
                                                                </div>
                                                                <div className="text-[9px] text-zinc-500 uppercase">Avg Recovery</div>
                                                            </div>
                                                            <div className="rounded-lg bg-zinc-800/40 border border-zinc-700/20 p-3 text-center">
                                                                <div className="text-lg font-bold text-green-400">
                                                                    {ksRoundTimes.length > 0 ? Math.min(...ksRoundTimes).toFixed(1) : '—'}s
                                                                </div>
                                                                <div className="text-[9px] text-zinc-500 uppercase">Best Round</div>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={finishKsDrill}
                                                            className="mt-2 px-8 py-3 rounded-xl bg-gradient-to-r from-[#E0FE10] to-[#c5dc0e] text-black font-bold text-sm hover:from-[#d4ee14] hover:to-[#b8cf0d] transition-all"
                                                        >
                                                            Done — View Progress
                                                        </button>
                                                    </motion.div>

                                                ) : (
                                                    /* Active Game — Lock In / Disruption / Kill Switch */
                                                    <div className="flex flex-col items-center gap-4 w-full">
                                                        {/* Phase indicator */}
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${resetPhase === 'lockIn' ? 'bg-[#E0FE10]' :
                                                                resetPhase === 'disruption' ? 'bg-red-500 animate-pulse' :
                                                                    'bg-cyan-400'
                                                                }`} />
                                                            <span className={`text-xs font-bold tracking-widest uppercase ${resetPhase === 'lockIn' ? 'text-[#E0FE10]' :
                                                                resetPhase === 'disruption' ? 'text-red-400' :
                                                                    'text-cyan-400'
                                                                }`}>
                                                                {resetPhase === 'lockIn' ? 'Lock In — Tap in rhythm' :
                                                                    resetPhase === 'disruption' ? 'Disruption!' :
                                                                        'Kill Switch — Re-engage NOW'}
                                                            </span>
                                                        </div>

                                                        {/* Disruption content OR Focus task */}
                                                        {resetPhase === 'disruption' ? (
                                                            <motion.div
                                                                initial={{ scale: 0.5, opacity: 0 }}
                                                                animate={{ scale: 1, opacity: 1 }}
                                                                className="flex flex-col items-center justify-center py-8"
                                                            >
                                                                <motion.p
                                                                    initial={{ scale: 0.5 }}
                                                                    animate={{ scale: [1, 1.1, 1] }}
                                                                    transition={{ duration: 0.5 }}
                                                                    className="text-3xl font-black text-red-500 text-center"
                                                                >
                                                                    {ksProvocMessage}
                                                                </motion.p>
                                                                {/* Scramble circles */}
                                                                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                                                                    {Array.from({ length: 6 }).map((_, i) => (
                                                                        <motion.div
                                                                            key={i}
                                                                            initial={{ opacity: 0 }}
                                                                            animate={{ opacity: [0, 0.4, 0] }}
                                                                            transition={{ duration: 1, delay: i * 0.1 }}
                                                                            className="absolute rounded-full bg-red-500"
                                                                            style={{
                                                                                width: `${20 + Math.random() * 30}px`,
                                                                                height: `${20 + Math.random() * 30}px`,
                                                                                left: `${10 + Math.random() * 80}%`,
                                                                                top: `${10 + Math.random() * 80}%`,
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </motion.div>
                                                        ) : (
                                                            /* Focus Task — Pulsing Circle */
                                                            <div className="flex flex-col items-center gap-4 py-4">
                                                                {resetPhase === 'killSwitch' && (
                                                                    <motion.div
                                                                        initial={{ opacity: 0 }}
                                                                        animate={{ opacity: 1 }}
                                                                        className="text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full"
                                                                    >
                                                                        ⏱ Recovery timer running...
                                                                    </motion.div>
                                                                )}
                                                                <motion.button
                                                                    onClick={handleKsTap}
                                                                    animate={{ scale: ksPulseScale }}
                                                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                                    className="relative w-28 h-28 rounded-full flex items-center justify-center"
                                                                >
                                                                    {/* Outer glow */}
                                                                    <div
                                                                        className={`absolute inset-0 rounded-full blur-xl transition-colors duration-300 ${resetPhase === 'killSwitch' ? 'bg-cyan-400/20' : 'bg-[#E0FE10]/15'
                                                                            }`}
                                                                        style={{ transform: `scale(${ksPulseScale * 1.3})` }}
                                                                    />
                                                                    {/* Ring */}
                                                                    <div className={`absolute inset-0 rounded-full border-2 transition-colors duration-300 ${resetPhase === 'killSwitch' ? 'border-cyan-400/40' : 'border-[#E0FE10]/30'
                                                                        }`} />
                                                                    {/* Core */}
                                                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${resetPhase === 'killSwitch'
                                                                        ? 'bg-gradient-to-br from-cyan-400 to-cyan-500'
                                                                        : 'bg-gradient-to-br from-[#E0FE10] to-[#c5dc0e]'
                                                                        }`}>
                                                                        <div className="w-3 h-3 rounded-full bg-white" />
                                                                    </div>
                                                                </motion.button>

                                                                {/* Accuracy dots */}
                                                                {ksTapAccuracy.length > 0 && (
                                                                    <div className="flex gap-1">
                                                                        {ksTapAccuracy.slice(-8).map((acc, i) => (
                                                                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${acc ? (resetPhase === 'killSwitch' ? 'bg-cyan-400' : 'bg-[#E0FE10]') : 'bg-red-500/50'}`} />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Lock-in timer bar */}
                                                        {resetPhase === 'lockIn' && (
                                                            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                                                <motion.div
                                                                    className="h-full bg-[#E0FE10]/40 rounded-full"
                                                                    animate={{ width: `${(ksLockInRemaining / 8) * 100}%` }}
                                                                    transition={{ duration: 0.2 }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Fullscreen Game Overlay */}
                                    {drillActive && gameExpanded && (
                                        <AnimatePresence>
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="fixed inset-0 z-[9999] flex flex-col"
                                                style={{ background: 'linear-gradient(180deg, rgba(5,5,7,0.98) 0%, rgba(10,10,14,0.99) 100%)' }}
                                            >
                                                {/* Fullscreen header */}
                                                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
                                                            <Zap className="w-5 h-5 text-red-400" />
                                                        </div>
                                                        <div>
                                                            <span className="text-base font-bold text-white">The Kill Switch</span>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <div className="flex gap-1.5">
                                                                    {Array.from({ length: ksTotalRounds }).map((_, i) => (
                                                                        <div
                                                                            key={i}
                                                                            className={`w-2 h-2 rounded-full transition-colors ${i < ksCurrentRound - 1 ? 'bg-[#E0FE10]' :
                                                                                i === ksCurrentRound - 1 ? (resetPhase === 'disruption' ? 'bg-red-500 animate-pulse' : resetPhase === 'killSwitch' ? 'bg-cyan-400' : 'bg-[#E0FE10]') :
                                                                                    'bg-white/20'
                                                                                }`}
                                                                        />
                                                                    ))}
                                                                </div>
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${resetPhase === 'lockIn' ? 'text-[#E0FE10]' :
                                                                    resetPhase === 'disruption' ? 'text-red-400' :
                                                                        resetPhase === 'killSwitch' ? 'text-cyan-400' : 'text-zinc-500'
                                                                    }`}>
                                                                    {resetPhase === 'lockIn' ? 'Lock In' :
                                                                        resetPhase === 'disruption' ? 'Disruption!' :
                                                                            resetPhase === 'killSwitch' ? 'Kill Switch' :
                                                                                resetPhase === 'done' ? 'Complete' : `Round ${ksCurrentRound}`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setGameExpanded(false)}
                                                        className="w-9 h-9 rounded-xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center hover:bg-zinc-700/60 hover:border-zinc-600/60 transition-all group"
                                                        title="Exit fullscreen"
                                                    >
                                                        <Minimize2 className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                                                    </button>
                                                </div>

                                                {/* Fullscreen game content */}
                                                <div className="flex-1 flex items-center justify-center relative overflow-hidden">
                                                    {/* Red flash overlay */}
                                                    <AnimatePresence>
                                                        {ksFlashActive && (
                                                            <motion.div
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 0.5 }}
                                                                exit={{ opacity: 0 }}
                                                                className="absolute inset-0 bg-red-500 z-40 pointer-events-none"
                                                            />
                                                        )}
                                                    </AnimatePresence>

                                                    <div className="w-full max-w-lg px-6 py-8 flex flex-col items-center justify-center relative z-10">
                                                        {resetPhase === 'idle' ? (
                                                            <div className="text-center space-y-6">
                                                                <motion.div
                                                                    className="mx-auto w-28 h-28 rounded-full bg-red-500/20 flex items-center justify-center"
                                                                    animate={{ scale: [1, 1.05, 1] }}
                                                                    transition={{ duration: 2, repeat: Infinity }}
                                                                >
                                                                    <Zap className="w-14 h-14 text-red-500" />
                                                                </motion.div>
                                                                <p className="text-zinc-400 text-base">{ksTotalRounds} rounds • Tap in rhythm • Recover fast</p>
                                                                <button
                                                                    onClick={runResetExercise}
                                                                    className="px-10 py-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-base hover:from-red-400 hover:to-red-500 transition-all shadow-lg shadow-red-500/20"
                                                                >
                                                                    Begin Training →
                                                                </button>
                                                            </div>
                                                        ) : ksRoundPhase === 'result' ? (
                                                            <motion.div
                                                                initial={{ opacity: 0, scale: 0.95 }}
                                                                animate={{ opacity: 1, scale: 1 }}
                                                                className="text-center space-y-5 w-full"
                                                            >
                                                                <div className="text-sm text-zinc-500 uppercase tracking-widest">Round {ksCurrentRound} of {ksTotalRounds}</div>
                                                                <div className="text-6xl font-black text-[#E0FE10]">
                                                                    {ksRecoveryTime !== null ? `${ksRecoveryTime.toFixed(1)}s` : '—'}
                                                                </div>
                                                                <div className="text-base text-zinc-400">Recovery Time</div>
                                                                {ksRecoveryTime !== null && ksRecoveryTime < 3.0 && (
                                                                    <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 px-4 py-1.5 rounded-full inline-block">
                                                                        🔥 Under 3 seconds — Elite level
                                                                    </div>
                                                                )}
                                                                <button
                                                                    onClick={advanceKsRound}
                                                                    className="mt-4 px-8 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-base hover:bg-white/15 transition-colors"
                                                                >
                                                                    {ksCurrentRound >= ksTotalRounds ? 'View Results' : 'Next Round →'}
                                                                </button>
                                                            </motion.div>
                                                        ) : ksRoundPhase === 'summary' ? (
                                                            <motion.div
                                                                initial={{ opacity: 0, scale: 0.95 }}
                                                                animate={{ opacity: 1, scale: 1 }}
                                                                className="text-center space-y-5 w-full"
                                                            >
                                                                <div className="text-sm text-zinc-500 uppercase tracking-widest">Training Complete</div>
                                                                <div className="text-3xl font-black text-[#E0FE10]">Kill Switch ✓</div>
                                                                <div className="grid grid-cols-3 gap-3 mt-4">
                                                                    {ksRoundTimes.map((t, i) => (
                                                                        <div key={i} className="rounded-lg bg-zinc-800/60 border border-zinc-700/30 p-3 text-center">
                                                                            <div className="text-[10px] text-zinc-500 uppercase">R{i + 1}</div>
                                                                            <div className={`text-lg font-bold ${t < 3.0 ? 'text-green-400' : 'text-amber-400'}`}>{t.toFixed(1)}s</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div className="rounded-lg bg-zinc-800/40 border border-zinc-700/20 p-4 text-center">
                                                                        <div className="text-2xl font-bold text-[#E0FE10]">
                                                                            {ksRoundTimes.length > 0 ? (ksRoundTimes.reduce((a, b) => a + b, 0) / ksRoundTimes.length).toFixed(1) : '—'}s
                                                                        </div>
                                                                        <div className="text-[10px] text-zinc-500 uppercase">Avg Recovery</div>
                                                                    </div>
                                                                    <div className="rounded-lg bg-zinc-800/40 border border-zinc-700/20 p-4 text-center">
                                                                        <div className="text-2xl font-bold text-green-400">
                                                                            {ksRoundTimes.length > 0 ? Math.min(...ksRoundTimes).toFixed(1) : '—'}s
                                                                        </div>
                                                                        <div className="text-[10px] text-zinc-500 uppercase">Best Round</div>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={finishKsDrill}
                                                                    className="mt-3 px-10 py-4 rounded-xl bg-gradient-to-r from-[#E0FE10] to-[#c5dc0e] text-black font-bold text-base hover:from-[#d4ee14] hover:to-[#b8cf0d] transition-all"
                                                                >
                                                                    Done — View Progress
                                                                </button>
                                                            </motion.div>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-6 w-full">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-3 h-3 rounded-full ${resetPhase === 'lockIn' ? 'bg-[#E0FE10]' : resetPhase === 'disruption' ? 'bg-red-500 animate-pulse' : 'bg-cyan-400'}`} />
                                                                    <span className={`text-sm font-bold tracking-widest uppercase ${resetPhase === 'lockIn' ? 'text-[#E0FE10]' : resetPhase === 'disruption' ? 'text-red-400' : 'text-cyan-400'}`}>
                                                                        {resetPhase === 'lockIn' ? 'Lock In — Tap in rhythm' : resetPhase === 'disruption' ? 'Disruption!' : 'Kill Switch — Re-engage NOW'}
                                                                    </span>
                                                                </div>
                                                                {resetPhase === 'disruption' ? (
                                                                    <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center py-12">
                                                                        <motion.p initial={{ scale: 0.5 }} animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5 }} className="text-5xl font-black text-red-500 text-center">
                                                                            {ksProvocMessage}
                                                                        </motion.p>
                                                                    </motion.div>
                                                                ) : (
                                                                    <div className="flex flex-col items-center gap-6 py-4">
                                                                        {resetPhase === 'killSwitch' && (
                                                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-4 py-1.5 rounded-full">
                                                                                ⏱ Recovery timer running...
                                                                            </motion.div>
                                                                        )}
                                                                        <motion.button
                                                                            onClick={handleKsTap}
                                                                            animate={{ scale: ksPulseScale }}
                                                                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                                            className="relative w-40 h-40 rounded-full flex items-center justify-center"
                                                                        >
                                                                            <div className={`absolute inset-0 rounded-full blur-xl transition-colors duration-300 ${resetPhase === 'killSwitch' ? 'bg-cyan-400/20' : 'bg-[#E0FE10]/15'}`} style={{ transform: `scale(${ksPulseScale * 1.3})` }} />
                                                                            <div className={`absolute inset-0 rounded-full border-2 transition-colors duration-300 ${resetPhase === 'killSwitch' ? 'border-cyan-400/40' : 'border-[#E0FE10]/30'}`} />
                                                                            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${resetPhase === 'killSwitch' ? 'bg-gradient-to-br from-cyan-400 to-cyan-500' : 'bg-gradient-to-br from-[#E0FE10] to-[#c5dc0e]'}`}>
                                                                                <div className="w-4 h-4 rounded-full bg-white" />
                                                                            </div>
                                                                        </motion.button>
                                                                        {ksTapAccuracy.length > 0 && (
                                                                            <div className="flex gap-1.5">
                                                                                {ksTapAccuracy.slice(-8).map((acc, i) => (
                                                                                    <div key={i} className={`w-2 h-2 rounded-full ${acc ? (resetPhase === 'killSwitch' ? 'bg-cyan-400' : 'bg-[#E0FE10]') : 'bg-red-500/50'}`} />
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {resetPhase === 'lockIn' && (
                                                                    <div className="w-full max-w-sm h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                                        <motion.div className="h-full bg-[#E0FE10]/40 rounded-full" animate={{ width: `${(ksLockInRemaining / 8) * 100}%` }} transition={{ duration: 0.2 }} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </AnimatePresence>
                                    )}

                                    {/* Typing indicator — same as Act 1 */}
                                    {isNTyping && (
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
                                                    <motion.div className="w-2 h-2 rounded-full bg-zinc-500" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} />
                                                    <motion.div className="w-2 h-2 rounded-full bg-zinc-500" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} />
                                                    <motion.div className="w-2 h-2 rounded-full bg-zinc-500" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Input bar — same as Act 1 */}
                        <div className="relative z-20 backdrop-blur-xl bg-zinc-900/40 border-t border-white/5 px-4 py-3">
                            {/* Response Chips */}
                            {closeResponses[chatStep] && !isNTyping && !drillActive && (
                                <div className="max-w-3xl mx-auto mb-3">
                                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Suggested Responses</div>
                                    <div className="flex flex-wrap gap-2">
                                        {closeResponses[chatStep].map((resp, idx) => (
                                            <motion.button
                                                key={idx}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.1 + 0.5 }}
                                                onClick={() => advanceChat(resp.value)}
                                                className="px-4 py-2.5 rounded-xl text-sm text-left bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 hover:bg-[#E0FE10]/10 hover:border-[#E0FE10]/30 hover:text-[#E0FE10] transition-all duration-200 max-w-[90%]"
                                            >
                                                &quot;{resp.label}&quot;
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!closeResponses[chatStep] && !isNTyping && !drillActive && chatStep > 1 && chatStep < 3 && (
                                <div className="max-w-3xl mx-auto mb-3">
                                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Suggested Responses</div>
                                    <motion.button
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1 }}
                                        onClick={() => advanceChat()}
                                        className="px-4 py-2.5 rounded-xl text-sm text-left bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 hover:bg-[#E0FE10]/10 hover:border-[#E0FE10]/30 hover:text-[#E0FE10] transition-all duration-200"
                                    >
                                        &quot;Continue&quot;
                                    </motion.button>
                                </div>
                            )}

                            {/* Input field — same as Act 1 */}
                            <div className="max-w-3xl mx-auto flex items-center gap-3">
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        placeholder="Type a response..."
                                        disabled
                                        className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-[#E0FE10]/40 transition-colors"
                                    />
                                </div>
                                <button className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/40">
                                    <Send className="w-4 h-4 text-zinc-500" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )
                }
            </AnimatePresence >
        </motion.div >
    );
};




const PulseCheckDemo: React.FC = () => {
    // ── State ─────────────────────────────────────────────
    const [currentAct, setCurrentAct] = useState<DemoAct>('intro');
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState('');
    const [scriptIndex, setScriptIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const [showBreathing, setShowBreathing] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [introTapped, setIntroTapped] = useState(false);
    const [tapPosition, setTapPosition] = useState<{ x: number; y: number } | null>(null);
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

    // ── Initial Nora greeting (only after intro dismissed) ─
    useEffect(() => {
        if (currentAct !== 'act1') return;
        if (messages.length > 0) return; // already greeted
        const firstMsg = DEMO_SCRIPT[0];
        const timer = setTimeout(async () => {
            setIsTyping(true);
            // Preload audio while "typing" indicator is showing
            const playFn = await preloadAudio(firstMsg.content, firstMsg.ttsSpeed);
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
        }, 800);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentAct]);

    // ── TTS: preload audio and return a play() function ────
    // Call this while typing indicator is showing → audio loads in background
    // When ready, show message and call play() simultaneously
    const preloadAudio = useCallback(
        async (text: string, speed?: number): Promise<(() => void) | null> => {
            if (!ttsEnabled || typeof window === 'undefined') return null;

            // Stop any currently playing audio
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }

            const ttsSpeed = speed ?? 1.0;

            try {
                const res = await fetch('/api/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text,
                        voice: 'rachel',
                        speed: ttsSpeed,
                    }),
                });

                if (!res.ok) {
                    console.warn('[TTS] TTS API failed, falling back to Web Speech API');
                    return () => fallbackSpeak(text, ttsSpeed);
                }

                const data = await res.json();
                if (!data.audio) {
                    return () => fallbackSpeak(text, ttsSpeed);
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
                    audio.play().catch(() => fallbackSpeak(text, ttsSpeed));
                };
            } catch (err) {
                console.warn('[TTS] Error preloading TTS:', err);
                return () => fallbackSpeak(text, ttsSpeed);
            }
        },
        [ttsEnabled]
    );

    // Fallback to Web Speech API if TTS API fails
    const fallbackSpeak = useCallback((text: string, speed?: number) => {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speed ?? 1.0;
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
                    const playFn = await preloadAudio(nextScript.content, nextScript.ttsSpeed);

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
    const breathingCompletedRef = useRef(false);

    // Reset the guard whenever breathing starts
    useEffect(() => {
        if (showBreathing) {
            breathingCompletedRef.current = false;
        }
    }, [showBreathing]);

    const handleBreathingComplete = useCallback(async () => {
        // Guard: only process once per breathing exercise
        if (breathingCompletedRef.current) return;
        breathingCompletedRef.current = true;

        setShowBreathing(false);
        // Continue script — preload audio then show message + play together
        if (scriptIndex < DEMO_SCRIPT.length) {
            const nextScript = DEMO_SCRIPT[scriptIndex];
            if (nextScript.role === 'nora') {
                setIsTyping(true);
                const playFn = await preloadAudio(nextScript.content, nextScript.ttsSpeed);
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

                {/* Header — hide on intro */}
                {currentAct !== 'intro' && (
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

                            {/* Skip button — only during Act 1 */}
                            {currentAct === 'act1' && (
                                <button
                                    onClick={() => {
                                        // Stop any TTS
                                        if (audioRef.current) {
                                            audioRef.current.pause();
                                            audioRef.current = null;
                                            setIsSpeaking(false);
                                        }
                                        window.speechSynthesis?.cancel();
                                        setShowBreathing(false);
                                        setCurrentAct('act2');
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-[10px] font-bold text-zinc-400 uppercase tracking-wider hover:bg-zinc-700/60 hover:text-zinc-300 transition-all"
                                >
                                    Skip to Dashboard →
                                </button>
                            )}

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
                )}

                {/* Main Content */}
                <main className="flex-1 relative z-10 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {/* ── INTRO: Phone Notification ──── */}
                        {currentAct === 'intro' && (
                            <motion.div
                                key="intro"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="h-full flex flex-col items-center justify-center px-6"
                            >
                                {/* Phone frame */}
                                <motion.div
                                    initial={{ opacity: 0, y: 40 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                    className="relative w-[393px] h-[852px] rounded-[40px] overflow-hidden border-2 border-zinc-700/60 shadow-2xl shadow-black/60"
                                    style={{ background: 'linear-gradient(180deg, #111113 0%, #0a0a0b 100%)' }}
                                >
                                    {/* Status bar */}
                                    <div className="flex items-center justify-between px-8 pt-4 pb-2">
                                        <span className="text-xs font-semibold text-white">T-Mobile</span>
                                        <div className="flex items-center gap-1">
                                            <div className="w-4 h-2 rounded-sm border border-white/60 relative">
                                                <div className="absolute inset-[1px] right-[2px] bg-green-400 rounded-[1px]" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Lock screen content */}
                                    <div className="text-center py-12">
                                        <div className="text-zinc-500 text-xs uppercase tracking-widest mb-1">
                                            Saturday, March 2
                                        </div>
                                        <div className="text-6xl font-thin text-white tracking-tight">
                                            6:47
                                        </div>
                                        <div className="text-xs text-[#E0FE10]/60 mt-2 font-medium uppercase tracking-wider">
                                            ★ Game Day
                                        </div>
                                    </div>

                                    {/* Push notification — slides in */}
                                    <motion.div
                                        initial={{ opacity: 0, y: -60 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.5, duration: 0.5, type: 'spring', stiffness: 300, damping: 25 }}
                                        onClick={(e) => {
                                            if (introTapped) return;
                                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                            setTapPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                                            setIntroTapped(true);
                                            setTimeout(() => setCurrentAct('act1'), 2500);
                                        }}
                                        className="mx-4 mb-8 rounded-2xl p-3.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform relative overflow-hidden"
                                        style={{
                                            background: 'rgba(255,255,255,0.08)',
                                            backdropFilter: 'blur(40px)',
                                            border: introTapped ? '1px solid rgba(224,254,16,0.4)' : '1px solid rgba(255,255,255,0.12)',
                                        }}
                                    >
                                        {/* Tap ripple */}
                                        {introTapped && tapPosition && (
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0.8 }}
                                                animate={{ scale: 6, opacity: 0 }}
                                                transition={{ duration: 2.5, ease: 'easeOut' }}
                                                className="absolute rounded-full pointer-events-none"
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    left: tapPosition.x - 20,
                                                    top: tapPosition.y - 20,
                                                    background: 'radial-gradient(circle, rgba(224,254,16,0.5) 0%, rgba(224,254,16,0) 70%)',
                                                    boxShadow: '0 0 30px rgba(224,254,16,0.4)',
                                                }}
                                            />
                                        )}
                                        <div className="flex items-start gap-3 relative z-10">
                                            <div className="w-10 h-10 rounded-xl bg-[#E0FE10]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Brain className="w-5 h-5 text-[#E0FE10]" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-xs font-bold text-white uppercase tracking-wide">Pulse Check</span>
                                                    <span className="text-[10px] text-zinc-500">now</span>
                                                </div>
                                                <p className="text-sm text-zinc-200 leading-snug">
                                                    Good morning, Tremaine. Time for your check-in with Nora.
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* Swipe hint */}
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 2.5 }}
                                        className="text-center pb-8"
                                    >
                                        <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
                                            Tap notification to open
                                        </span>
                                    </motion.div>
                                </motion.div>

                                {/* Context label below phone */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 2 }}
                                    className="mt-6 text-center"
                                >
                                    <div className="text-xs text-zinc-500 uppercase tracking-widest">
                                        Athlete Experience — Game Day Morning
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}

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

                                            {/* Box Breathing + Biometric HUD */}
                                            <AnimatePresence>
                                                {showBreathing && (
                                                    <div>
                                                        <BoxBreathingAnimation
                                                            onComplete={handleBreathingComplete}
                                                        />
                                                        <BiometricHUD isActive={showBreathing} />
                                                    </div>
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
                                    {/* Response Chips */}
                                    {SUGGESTED_RESPONSES[scriptIndex] && !showBreathing && !isTyping && (
                                        <div className="max-w-3xl mx-auto mb-3">
                                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Suggested Responses</div>
                                            <div className="flex flex-wrap gap-2">
                                                {SUGGESTED_RESPONSES[scriptIndex].map((suggestion, idx) => (
                                                    <motion.button
                                                        key={idx}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: idx * 0.1 + 0.5 }}
                                                        onClick={() => {
                                                            setInput('');
                                                            advanceScript(suggestion);
                                                        }}
                                                        className="px-4 py-2.5 rounded-xl text-sm text-left bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 hover:bg-[#E0FE10]/10 hover:border-[#E0FE10]/30 hover:text-[#E0FE10] transition-all duration-200 max-w-[90%]"
                                                    >
                                                        &quot;{suggestion}&quot;
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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
                                <ClinicalEscalation onContinue={() => setCurrentAct('act4')} />
                            </motion.div>
                        )}

                        {currentAct === 'act4' && (
                            <motion.div
                                key="act4"
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
