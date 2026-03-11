import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
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
    ChevronLeft,
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
            "That's okay — anxiety before a high-stakes game is completely normal. I have a few other mental frameworks we can run through, but first — we'd like to notify someone on your support staff so they're in the loop. Who should we notify?",
        delay: 1500,
    },
    // User selects a staff member (or opts out)
    {
        role: 'nora',
        content:
            "Done. I've sent a secure briefing with your physical baseline data and today's conversation context. They'll have the full picture before your 10 AM meeting.",
        delay: 2000,
        autoAdvance: true,
        autoAdvanceDelay: 4000,
        transitionTo: 'act2',
    },
];

// ─────────────────────────────────────────────────────────
// SUGGESTED RESPONSE CHIPS
// ─────────────────────────────────────────────────────────

type ResponseSentiment = 'positive' | 'neutral' | 'negative';

interface SuggestedResponse {
    text: string;
    sentiment: ResponseSentiment;
}

const sentimentStyles = (sentiment: ResponseSentiment) => {
    switch (sentiment) {
        case 'positive':
            return {
                base: 'bg-emerald-500/8 border-emerald-500/25 text-emerald-300',
                hover: 'hover:bg-emerald-500/15 hover:border-emerald-500/40 hover:text-emerald-200',
            };
        case 'neutral':
            return {
                base: 'bg-slate-500/8 border-slate-500/25 text-slate-300',
                hover: 'hover:bg-slate-500/15 hover:border-slate-500/40 hover:text-slate-200',
            };
        case 'negative':
            return {
                base: 'bg-red-500/8 border-red-500/25 text-red-300',
                hover: 'hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-200',
            };
    }
};

const SUGGESTED_RESPONSES: Record<number, SuggestedResponse[]> = {
    1: [
        { text: 'I feel okay, just trying to get locked in.', sentiment: 'positive' },
        { text: "Eh, I don't know. Just woke up.", sentiment: 'neutral' },
        { text: "Honestly? I barely slept.", sentiment: 'negative' },
    ],
    2: [
        { text: "That's good to hear. I needed that.", sentiment: 'positive' },
        { text: "Nice, at least my body showed up today.", sentiment: 'neutral' },
        { text: "Numbers are cool, but I still don't feel right.", sentiment: 'negative' },
    ],
    3: [
        { text: "Perfect, 10 AM. That gives me time to get right.", sentiment: 'positive' },
        { text: "Alright, I'll be there.", sentiment: 'neutral' },
        { text: "Ugh, 10 AM? That feels early on game day.", sentiment: 'negative' },
    ],
    4: [
        { text: "I mean, the pressure is there, but I've been here before. I'll figure it out.", sentiment: 'positive' },
        { text: "I don't know, everything just feels like it's on the line today.", sentiment: 'neutral' },
        { text: "I feel like I'm going to let everyone down.", sentiment: 'negative' },
    ],
    5: [
        { text: "Sure, let's do it.", sentiment: 'positive' },
        { text: "I guess I'll try it.", sentiment: 'neutral' },
        { text: "I don't know if that'll help, but fine.", sentiment: 'negative' },
    ],
    7: [
        { text: "I feel a lot better actually.", sentiment: 'positive' },
        { text: 'A little better, but still tense.', sentiment: 'neutral' },
        { text: "I'm still feeling pretty anxious.", sentiment: 'negative' },
    ],
    8: [
        { text: 'Coach Mayo (Head Coach)', sentiment: 'positive' },
        { text: 'Coach Van Pelt (Offensive Coordinator)', sentiment: 'neutral' },
        { text: "Coach Covington (Defensive Coordinator)", sentiment: 'neutral' },
        { text: 'Jim Whalen (Head Athletic Trainer)', sentiment: 'neutral' },
        { text: 'Dr. Liz Carter (Staff Clinician)', sentiment: 'positive' },
        { text: "Don't notify anyone", sentiment: 'negative' },
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

const CoachDashboard: React.FC<{ onContinue: () => void; notifiedStaff: { name: string; initials: string; role: string } }> = ({
    onContinue,
    notifiedStaff,
}) => {
    // Which panel is active in the sidebar nav
    const [coachView, setCoachView] = useState<'alerts' | 'roster'>('alerts');
    const [alertIndex, setAlertIndex] = useState(0);

    const [showAlert, setShowAlert] = useState(false);
    const [showExercises, setShowExercises] = useState(false);
    const [showHandoff, setShowHandoff] = useState(false);

    useEffect(() => {
        const t1 = setTimeout(() => setShowAlert(true), 800);
        const t2 = setTimeout(() => setShowExercises(true), 2800);
        const t3 = setTimeout(() => setShowHandoff(true), 4800);
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
            name: '3-Second Reset',
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

                {/* Coach Profile — driven by Act 1 staff selection */}
                <div className="flex items-center gap-2.5 px-2 py-3 rounded-xl bg-zinc-800/30 border border-zinc-700/20 mb-5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E0FE10]/30 to-green-500/20 flex items-center justify-center border border-[#E0FE10]/20">
                        <span className="text-xs font-bold text-[#E0FE10]">{notifiedStaff.initials}</span>
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-white">{notifiedStaff.name}</div>
                        <div className="text-[9px] text-zinc-500">{notifiedStaff.role}</div>
                    </div>
                </div>

                {/* Nav Menu — Athlete Alerts and Team Roster are now clickable */}
                <nav className="flex-1 space-y-0.5">
                    {[
                        { icon: Home, label: 'Home', view: null },
                        { icon: Flame, label: 'Athlete Alerts', view: 'alerts', badge: '2' },
                        { icon: Users, label: 'Team Roster', view: 'roster' },
                        { icon: ClipboardList, label: 'Training Library', view: null },
                        { icon: Calendar, label: 'Schedule', view: null },
                        { icon: BarChart3, label: 'Reports', view: null },
                        { icon: Settings, label: 'Settings', view: null },
                    ].map((item) => {
                        const isActive = item.view === coachView;
                        return (
                            <div
                                key={item.label}
                                onClick={() => {
                                    if (item.view === 'alerts' || item.view === 'roster') {
                                        setCoachView(item.view);
                                    }
                                }}
                                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${isActive
                                    ? 'bg-[#E0FE10]/10 text-[#E0FE10] font-medium'
                                    : item.view
                                        ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 cursor-pointer'
                                        : 'text-zinc-500 cursor-default'
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
                        );
                    })}
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
            <AnimatePresence mode="wait">

                {/* ── ATHLETE ALERTS VIEW ── */}
                {coachView === 'alerts' && (
                    <motion.div
                        key="alerts-view"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.25 }}
                        className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <span className="text-white font-medium text-sm">Athlete Alerts</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-bold">
                                    2 ALERTS
                                </span>
                                <span className="text-[10px] text-zinc-500">March 2, 2026 • 8:15 AM</span>
                            </div>
                        </div>

                        {/* Nora Alert Card */}
                        <AnimatePresence>
                            {showAlert && (
                                <motion.div
                                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.5 }}
                                >
                                    {/* Carousel wrapper */}
                                    <div className="relative">
                                        {/* Dot indicators */}
                                        <div className="flex justify-center gap-1.5 mb-3">
                                            {[0, 1].map((i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setAlertIndex(i)}
                                                    className={`rounded-full transition-all duration-300 ${alertIndex === i ? 'w-5 h-1.5 bg-[#E0FE10]' : 'w-1.5 h-1.5 bg-zinc-600 hover:bg-zinc-500'}`}
                                                />
                                            ))}
                                        </div>

                                        {/* Cards track */}
                                        <div className="overflow-hidden rounded-2xl">
                                            <motion.div
                                                className="flex"
                                                animate={{ x: `${-alertIndex * 100}%` }}
                                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                                drag="x"
                                                dragConstraints={{ left: 0, right: 0 }}
                                                onDragEnd={(_, info) => {
                                                    if (info.offset.x < -50 && alertIndex < 1) setAlertIndex(1);
                                                    if (info.offset.x > 50 && alertIndex > 0) setAlertIndex(0);
                                                }}
                                            >
                                                {/* ── ALERT 1: Tremaine Grant ── */}
                                                <div className="w-full flex-shrink-0 rounded-2xl overflow-hidden"
                                                    style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(239,68,68,0.05) 100%)', border: '1px solid rgba(249,115,22,0.25)' }}
                                                >
                                                    <div className="p-5">
                                                        <div className="flex items-start gap-3 mb-4">
                                                            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                                                                <AlertTriangle className="w-5 h-5 text-orange-400" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="font-bold text-white">Nora Alert — Tremaine Grant</h3>
                                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">Elevated Anxiety</span>
                                                                </div>
                                                                <p className="text-xs text-zinc-500 mt-0.5">Today at 8:15 AM • Game Day</p>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                                                            Tremaine is experiencing elevated game-day anxiety related to season-ending pressure. I ran a Box Breathing protocol (4 rounds), but residual tension persists. His physical baseline is excellent (RHR 42, HRV high, 8h sleep), so this appears to be{' '}
                                                            <span className="text-orange-400 font-semibold">purely psychological</span>.
                                                        </p>
                                                        <div className="grid grid-cols-3 gap-3 mb-4">
                                                            {[
                                                                { label: 'RHR', value: '42 bpm', icon: Heart, color: '#EF4444' },
                                                                { label: 'HRV', value: 'High', icon: Activity, color: '#22C55E' },
                                                                { label: 'Sleep', value: '8h', icon: Brain, color: '#3B82F6' },
                                                            ].map((stat) => (
                                                                <div key={stat.label} className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 text-center">
                                                                    <stat.icon className="w-4 h-4 mx-auto mb-1" style={{ color: stat.color }} />
                                                                    <div className="text-sm font-bold text-white">{stat.value}</div>
                                                                    <div className="text-[10px] text-zinc-500 uppercase">{stat.label}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/30 p-3">
                                                            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Recommendation</div>
                                                            <p className="text-sm text-zinc-300">Check in with Tremaine before the 10:00 AM competition prep meeting. Monitor throughout the day in case escalation to clinical support is needed.</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* ── ALERT 2: K. Thompson ── */}
                                                <div className="w-full flex-shrink-0 rounded-2xl overflow-hidden"
                                                    style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(185,28,28,0.06) 100%)', border: '1px solid rgba(239,68,68,0.35)' }}
                                                >
                                                    <div className="p-5">
                                                        <div className="flex items-start gap-3 mb-4">
                                                            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                                                <AlertTriangle className="w-5 h-5 text-red-400" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <h3 className="font-bold text-white">Nora Alert — K. Thompson</h3>
                                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold">Escalated — Clinical</span>
                                                                </div>
                                                                <p className="text-xs text-zinc-500 mt-0.5">Today at 6:50 AM • Flagged for Clinical Review</p>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                                                            Kevin expressed statements during his morning check-in that indicate{' '}
                                                            <span className="text-red-400 font-semibold">significant psychological distress</span> — including feelings of hopelessness and withdrawal. This has been escalated beyond coaching scope and requires immediate clinical attention.
                                                        </p>
                                                        <div className="grid grid-cols-3 gap-3 mb-4">
                                                            {[
                                                                { label: 'RHR', value: '78 bpm', icon: Heart, color: '#EF4444', flag: '↑ Elevated' },
                                                                { label: 'HRV', value: '28 ms', icon: Activity, color: '#EF4444', flag: '↓ Low' },
                                                                { label: 'Sleep', value: '3.5h', icon: Brain, color: '#F59E0B', flag: '↓ Poor' },
                                                            ].map((stat) => (
                                                                <div key={stat.label} className="rounded-xl bg-zinc-800/40 border border-red-500/20 p-3 text-center">
                                                                    <stat.icon className="w-4 h-4 mx-auto mb-1" style={{ color: stat.color }} />
                                                                    <div className="text-sm font-bold text-white">{stat.value}</div>
                                                                    <div className="text-[10px] text-zinc-500 uppercase">{stat.label}</div>
                                                                    <div className="text-[9px] text-red-400 mt-0.5">{stat.flag}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="rounded-xl bg-red-500/8 border border-red-500/30 p-3">
                                                            <div className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-1">⚠ Immediate Action Required</div>
                                                            <p className="text-sm text-zinc-300">Do not discuss availability or performance with Kevin today. A clinical handoff to Dr. Liz Carter has been initiated. Review full case in Team Roster.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </div>

                                        {/* Prev / Next buttons */}
                                        {alertIndex === 1 && (
                                            <button onClick={() => setAlertIndex(0)} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:bg-zinc-700 transition-colors">
                                                <ChevronLeft className="w-3 h-3 text-zinc-400" />
                                            </button>
                                        )}
                                        {alertIndex === 0 && (
                                            <button onClick={() => setAlertIndex(1)} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:bg-zinc-700 transition-colors">
                                                <ChevronRight className="w-3 h-3 text-zinc-400" />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>


                        {/* Nora-Assigned Sims */}
                        <AnimatePresence>
                            {showExercises && (
                                <motion.div
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5 }}
                                >
                                    {/* Section header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                                            Nora-Assigned Sims
                                        </h3>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E0FE10]/10 text-[#E0FE10] border border-[#E0FE10]/20 font-medium">
                                            Auto-Queued • 8:15 AM
                                        </span>
                                    </div>

                                    {/* Trigger context banner */}
                                    <div className="rounded-xl bg-orange-500/6 border border-orange-500/20 px-4 py-3 mb-3 flex items-start gap-3">
                                        <Brain className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-zinc-300 leading-relaxed">
                                            Based on Tremaine&apos;s check-in — <span className="text-orange-400 font-medium">elevated pre-game anxiety</span>, high self-pressure sentiment, and residual tension post-breathing — Nora selected and queued these sims to address his cognitive state before the 10 AM meeting.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        {[
                                            {
                                                name: 'Box Breathing',
                                                desc: 'Regulated autonomic response — 4 rounds completed this session',
                                                icon: Wind,
                                                color: '#22D3EE',
                                                status: 'Completed',
                                            },
                                            {
                                                name: 'Competition Walkthrough',
                                                desc: 'Mental rehearsal of key game scenarios to build execution confidence',
                                                icon: Eye,
                                                color: '#8B5CF6',
                                                status: 'Assigned',
                                            },
                                            {
                                                name: '3-Second Reset',
                                                desc: 'Interrupt rumination loops — rapid refocus drill for high-pressure moments',
                                                icon: Zap,
                                                color: '#EF4444',
                                                status: 'Assigned',
                                            },
                                            {
                                                name: 'Cue Word Anchoring',
                                                desc: 'Lock a personal trigger word to an optimal performance state',
                                                icon: Target,
                                                color: '#F59E0B',
                                                status: 'In Queue',
                                            },
                                            {
                                                name: 'Highlight Reel',
                                                desc: 'Replay peak performance memories to prime confidence before tip-off',
                                                icon: Star,
                                                color: '#10B981',
                                                status: 'In Queue',
                                            },
                                        ].map((ex, i) => (
                                            <motion.div
                                                key={ex.name}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.12 }}
                                                className="flex items-start gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30 hover:bg-zinc-800/60 transition-colors"
                                            >
                                                <div
                                                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                                    style={{ backgroundColor: `${ex.color}15` }}
                                                >
                                                    <ex.icon className="w-4 h-4" style={{ color: ex.color }} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-white">{ex.name}</div>
                                                    <div className="text-xs text-zinc-500 leading-relaxed mt-0.5">{ex.desc}</div>
                                                </div>
                                                <span
                                                    className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${ex.status === 'Completed'
                                                        ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                                                        : ex.status === 'Assigned'
                                                            ? 'bg-[#E0FE10]/10 text-[#E0FE10] border border-[#E0FE10]/25'
                                                            : 'bg-zinc-700/40 text-zinc-500 border border-zinc-600/30'
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

                    </motion.div>
                )}

                {/* ── TEAM ROSTER VIEW ── */}
                {coachView === 'roster' && (
                    <motion.div
                        key="roster-view"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.25 }}
                        className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <span className="text-white font-medium text-sm">Team Roster</span>
                            <span className="text-[10px] text-zinc-500">March 2, 2026 • 8:15 AM</span>
                        </div>

                        {/* Roster stats legend */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
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
                        <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 flex items-center gap-4">
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
                            <div className="max-h-[420px] overflow-y-auto">
                                {[
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
                                ].map((p, i) => {
                                    const dotClass = p.status === 'optimal' ? 'bg-green-400' : p.status === 'warning' ? 'bg-amber-400' : p.status === 'elevated' ? 'bg-orange-400' : p.status === 'critical' ? 'bg-red-400 animate-pulse' : 'bg-zinc-600';
                                    const textClass = p.status === 'optimal' ? 'text-green-400/80' : p.status === 'warning' ? 'text-amber-400/80' : p.status === 'elevated' ? 'text-orange-400/80' : p.status === 'critical' ? 'text-red-400/80' : 'text-zinc-600';
                                    return (
                                        <motion.div
                                            key={p.name}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            className={`grid grid-cols-[44px_1fr_44px_1fr_64px] gap-0 items-center px-3 py-2 border-b border-zinc-800/50 text-sm transition-colors ${p.hl ? 'bg-orange-500/5' : ''} ${p.status === 'critical' ? 'cursor-pointer hover:bg-red-500/10' : 'hover:bg-zinc-800/40'}`}
                                            onClick={() => { if (p.status === 'critical') { onContinue(); } }}
                                        >
                                            <div className="text-zinc-500 font-mono text-xs">{p.num}</div>
                                            <div className={`font-medium ${p.hl ? 'text-orange-400' : 'text-white'}`}>{p.name}</div>
                                            <div className="text-zinc-500 text-xs">{p.pos}</div>
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                                                <span className={`text-xs truncate ${textClass}`}>{p.text}</span>
                                            </div>
                                            <div className="flex items-center justify-end gap-1">
                                                <span className="text-zinc-500 text-xs">{p.time}</span>
                                                {p.status === 'critical' && (
                                                    <ChevronRight className="w-3 h-3 text-red-400" />
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>


                    </motion.div>
                )}

            </AnimatePresence>
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

                            {/* Dr. Liz Carter Profile */}
                            <div className="px-4 py-4 border-b border-zinc-800/60">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/20 border border-purple-500/20 flex items-center justify-center">
                                        <span className="text-sm font-bold text-purple-300">LC</span>
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-white">Dr. Liz Carter</div>
                                        <div className="text-[10px] text-zinc-500">Ph.D., Licensed Clinician</div>
                                        <div className="text-[9px] text-purple-400/70">Staff Clinician</div>
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
                                            Kevin, thank you for trusting me with that. What you&apos;re describing sounds like something that would really benefit from talking to someone who specializes in this. I&apos;m going to connect you with Dr. Liz Carter right now&hellip;
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
                            {/* Personal / Professional Context */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="rounded-2xl border border-zinc-700/40 p-5"
                                style={{ background: 'rgba(59,130,246,0.03)' }}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Users className="w-4 h-4 text-blue-400" />
                                    <h4 className="text-sm font-bold text-white">Personal / Professional</h4>
                                    <span className="text-[9px] text-zinc-600 ml-auto">Non-Sport Stressors</span>
                                </div>
                                <p className="text-[10px] text-zinc-500 mb-4 leading-relaxed">
                                    These are life factors outside of sport that Nora has identified as active contributors to Kevin&apos;s current mental state.
                                </p>

                                <div className="space-y-3">
                                    {[
                                        {
                                            icon: '👶',
                                            label: 'New Father — 6 Weeks Postpartum',
                                            note: 'First child born Jan 18. Sleep disruption averaging 3–4h/night. Kevin has mentioned feeling "torn between being present at home and being locked in for the season."',
                                            impact: 'Sleep & Focus',
                                            impactColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                                        },
                                        {
                                            icon: '💼',
                                            label: 'Brand Deal Pressure — Pending Contract',
                                            note: 'Negotiating a $2.1M endorsement deal contingent on end-of-season performance metrics. Kevin flagged anxiety around "performing for the contract, not the team."',
                                            impact: 'Identity Stress',
                                            impactColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                                        },
                                        {
                                            icon: '📋',
                                            label: 'Contract Year — Free Agency Eligible',
                                            note: 'Entering the final year of his rookie deal. Self-described pressure: "every game feels like an audition." Nora detected this framing across 4 check-ins this month.',
                                            impact: 'Performance Anxiety',
                                            impactColor: 'text-red-400 bg-red-500/10 border-red-500/20',
                                        },
                                        {
                                            icon: '👨‍👩‍👦',
                                            label: 'Estranged Relationship — Father',
                                            note: 'Kevin mentioned his father reached out for the first time in 3 years last week. He described it as "bad timing" and has not followed up. Unresolved tension flagged as background stressor.',
                                            impact: 'Emotional Load',
                                            impactColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                                        },
                                    ].map((item) => (
                                        <div
                                            key={item.label}
                                            className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 flex gap-3"
                                        >
                                            <div className="text-xl flex-shrink-0 mt-0.5">{item.icon}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <div className="text-xs font-semibold text-zinc-200 leading-snug">{item.label}</div>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${item.impactColor}`}>
                                                        {item.impact}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-zinc-500 leading-relaxed">{item.note}</p>
                                            </div>
                                        </div>
                                    ))}
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
                                        { step: 'Schedule same-day clinical session with Dr. Liz Carter (staff clinician)', priority: 'High', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25', clickable: false },
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
// THE CLOSE — Act 4: Performance Showcase + Reset
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// THE CLOSE — Act 4: Performance Showcase + Reset
// ─────────────────────────────────────────────────────────

const TheClose: React.FC<{ coachName: string }> = ({ coachName }) => {
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
        'idle' | 'lockIn' | 'disruption' | 'reengage' | 'done'
    >('idle');
    const [drillActive, setDrillActive] = useState(false);
    const [gameExpanded, setGameExpanded] = useState(false);
    // Reset game state
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
    // ── Audio engine ──────────────────────────────────────────
    const audioCtxRef = useRef<AudioContext | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const soundEnabledRef = useRef(true);
    const [showSkillProfile, setShowSkillProfile] = useState(false);
    const [skillProfileTab, setSkillProfileTab] = useState<'composure' | 'focus' | 'decision'>('composure');
    useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

    const getAudioCtx = useCallback((): AudioContext | null => {
        if (typeof window === 'undefined') return null;
        try {
            if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }
            return audioCtxRef.current;
        } catch { return null; }
    }, []);

    /** Crisp metronome tick — played on each pulse beat */
    const playTick = useCallback((isReengage = false) => {
        if (!soundEnabledRef.current) return;
        const ctx = getAudioCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        // Primary tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isReengage ? 880 : 660, now);
        osc.frequency.exponentialRampToValueAtTime(isReengage ? 660 : 440, now + 0.08);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(isReengage ? 0.4 : 0.25, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.15);
        // Click transient
        const click = ctx.createOscillator();
        const clickGain = ctx.createGain();
        click.connect(clickGain);
        clickGain.connect(ctx.destination);
        click.type = 'triangle';
        click.frequency.setValueAtTime(2200, now);
        clickGain.gain.setValueAtTime(isReengage ? 0.3 : 0.18, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
        click.start(now);
        click.stop(now + 0.03);
    }, [getAudioCtx]);

    /** Harsh disruption burst — dissonant, jarring, short */
    const playDisruption = useCallback(() => {
        if (!soundEnabledRef.current) return;
        const ctx = getAudioCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        // White noise burst
        const bufferSize = ctx.sampleRate * 0.35;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = buffer;
        const noiseGain = ctx.createGain();
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1800, now);
        noiseFilter.Q.setValueAtTime(0.5, now);
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noiseGain.gain.setValueAtTime(0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        noiseSource.start(now);
        noiseSource.stop(now + 0.35);
        // Low dissonant tone
        const tones = [120, 183, 247];
        tones.forEach((freq, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(freq, now);
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.15, now + 0.01 + i * 0.005);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            o.start(now);
            o.stop(now + 0.42);
        });
    }, [getAudioCtx]);

    // Cleanup AudioContext on unmount
    useEffect(() => {
        return () => { audioCtxRef.current?.close(); };
    }, []);
    // ─────────────────────────────────────────────────────────

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
            // Intro message only — no drill card yet
            addNoraMsg(
                `${coachName} assigned you 3-Second Reset today. Research shows elite athletes recover from disruption in under 3 seconds — the average is 30 to 60. This drill measures and trains exactly that. Ready for it?`
            );
        } else if (step === 1 && choice === 'ready') {
            // User responds, then Nora sends the drill card
            setChatMessages((prev) => [...prev, { id: `close-${Date.now()}`, role: 'athlete', text: "Let's do it. I'm ready." }]);
            setTimeout(() => {
                addNoraMsg(
                    "Let's get after it. Here's what you're about to do.",
                    'drill-card'
                );
            }, 300);
        }
    }, [chatStep, addNoraMsg, coachName]);

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
            playTick(false);
            setTimeout(() => {
                setKsPulseScale(1);
                setKsPulseActive(false);
            }, 600);
        }, 1200);
    }, [playTick]);

    // Trigger the disruption
    const triggerKsDisruption = useCallback(() => {
        setResetPhase('disruption');
        if (ksPulseTimerRef.current) clearInterval(ksPulseTimerRef.current);
        // Jarring sound burst
        playDisruption();
        // Red flash
        setKsFlashActive(true);
        setTimeout(() => setKsFlashActive(false), 150);
        setTimeout(() => setKsFlashActive(true), 300);
        setTimeout(() => setKsFlashActive(false), 450);
        // Provocative message
        setKsProvocMessage(ksProvocMessages[Math.floor(Math.random() * ksProvocMessages.length)]);

        // After disruption → reset phase (re-engage ticks are a different pitch)
        setTimeout(() => {
            setResetPhase('reengage');
            ksDisruptionEndRef.current = Date.now();
            ksRecoveryStartedRef.current = false;
            setKsTapAccuracy([]);
            // Restart pulse with re-engage sound cue
            if (ksPulseTimerRef.current) clearInterval(ksPulseTimerRef.current);
            setKsTapAccuracy([]);
            ksPulseTimerRef.current = setInterval(() => {
                ksExpectedTapRef.current = Date.now();
                setKsPulseActive(true);
                setKsPulseScale(1.3);
                playTick(true); // higher-pitched tick = re-engage cue
                setTimeout(() => {
                    setKsPulseScale(1);
                    setKsPulseActive(false);
                }, 600);
            }, 1200);
        }, 2000);
    }, [playDisruption, playTick]);

    // Start a round (lock in → disruption → reset)
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

        if (resetPhase === 'reengage' && !ksRecoveryStartedRef.current && accurate) {
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
        setChatMessages((prev) => [...prev, { id: `close-${Date.now()}`, role: 'system', text: `✓ 3-Second Reset Complete — ${avgTime}s avg recovery (best: ${bestTime}s)` }]);
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

    const closeResponses: Record<number, Array<{ label: string; value: string; sentiment: ResponseSentiment }>> = {
        1: [
            { label: "Let's do it. I'm ready.", value: 'ready', sentiment: 'positive' },
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
                                                <p className="text-[11px] text-zinc-300 leading-snug">Coach assigned you the 3-Second Reset drill. Complete by end of day. Tap to start.</p>
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
                                                            {m.type === 'drill-card' && chatStep >= 2 && !drillActive && resetPhase === 'idle' && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: 0.5 }}
                                                                    className="mt-3 rounded-2xl border border-red-500/25 p-4 max-w-[90%] space-y-4"
                                                                    style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.03) 100%)' }}
                                                                >
                                                                    {/* Header + Pillar badge */}
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center">
                                                                                <Zap className="w-4 h-4 text-red-400" />
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-sm font-bold text-white">3-Second Reset</div>
                                                                                <div className="text-[10px] text-red-400/70 uppercase tracking-wider font-medium">Composure Sim</div>
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 font-medium flex-shrink-0">Evidence: Adjacent</span>
                                                                    </div>

                                                                    {/* Target skills */}
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {['Error Recovery Speed', 'Attentional Shifting', 'Pressure Stability'].map((skill) => (
                                                                            <span key={skill} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-300">{skill}</span>
                                                                        ))}
                                                                    </div>

                                                                    {/* Why it matters */}
                                                                    <p className="text-xs text-zinc-400 leading-relaxed">
                                                                        When something goes wrong — a bad play, a missed assignment, blown coverage — your brain enters a <span className="text-red-400 font-medium">disruption loop</span>. 3-Second Reset trains you to exit that loop and re-lock into the moment. It measures your exact recovery time every round.
                                                                    </p>

                                                                    {/* 3 Phases */}
                                                                    <div className="space-y-1.5">
                                                                        {[
                                                                            { phase: '01', label: 'Lock In', desc: 'Sustain focused engagement on the task', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                                                                            { phase: '02', label: 'Disruption', desc: 'Evaluative pressure hits — a provocative flash or message', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                                                                            { phase: '03', label: '3-Second Reset', desc: 'Re-engage as fast as possible — this is your measured recovery time', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                                                                        ].map((p) => (
                                                                            <div key={p.phase} className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${p.bg}`}>
                                                                                <span className={`text-[10px] font-black ${p.color} mt-0.5 flex-shrink-0`}>{p.phase}</span>
                                                                                <div>
                                                                                    <div className={`text-xs font-bold ${p.color}`}>{p.label}</div>
                                                                                    <div className="text-[11px] text-zinc-500 leading-snug">{p.desc}</div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    {/* Benchmark + Science */}
                                                                    <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/30 px-3 py-2 flex items-center gap-3">
                                                                        <div className="text-center flex-shrink-0">
                                                                            <div className="text-lg font-black text-red-400">&lt;3s</div>
                                                                            <div className="text-[9px] text-zinc-500 uppercase">Elite</div>
                                                                        </div>
                                                                        <div className="w-px h-8 bg-zinc-700 flex-shrink-0" />
                                                                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                                                                            Attentional Control Theory (Eysenck et al., 2007) shows the recovery gap is trainable and can shorten by <span className="text-white font-medium">40–60%</span> with structured reps. Average athletes: 30–60s. Elite: under 3s.
                                                                        </p>
                                                                    </div>

                                                                    {/* Tier ladder */}
                                                                    <div>
                                                                        <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1.5">Progression</div>
                                                                        <div className="grid grid-cols-4 gap-1">
                                                                            {[
                                                                                { label: 'Foundation', color: 'text-zinc-400 bg-zinc-800/60 border-zinc-700/40' },
                                                                                { label: 'Sharpening', color: 'text-amber-400 bg-amber-500/8 border-amber-500/20' },
                                                                                { label: 'Pressure', color: 'text-orange-400 bg-orange-500/8 border-orange-500/20' },
                                                                                { label: 'Elite', color: 'text-red-400 bg-red-500/10 border-red-500/25' },
                                                                            ].map((t) => (
                                                                                <div key={t.label} className={`rounded-lg border px-1.5 py-1 text-center ${t.color}`}>
                                                                                    <div className="text-[9px] font-bold leading-none">{t.label}</div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Start this Sim button */}
                                                                    <motion.button
                                                                        initial={{ opacity: 0, y: 10 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        transition={{ delay: 0.8 }}
                                                                        onClick={() => {
                                                                            setDrillActive(true);
                                                                            runResetExercise();
                                                                        }}
                                                                        className="w-full py-3 rounded-xl font-bold text-sm text-black bg-[#E0FE10] hover:bg-[#d4f00e] active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2"
                                                                    >
                                                                        <Zap className="w-4 h-4" />
                                                                        Start this Sim
                                                                    </motion.button>
                                                                </motion.div>

                                                            )}

                                                            {/* Progress card inline */}
                                                            {m.type === 'progress-card' && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: 0.5 }}
                                                                    className="mt-2 rounded-xl border border-green-500/20 p-4 space-y-3 max-w-[90%]"
                                                                    style={{ background: 'rgba(34,197,94,0.04)' }}
                                                                >
                                                                    {/* Header */}
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <Star className="w-4 h-4 text-green-400" />
                                                                            <span className="text-xs font-bold text-white">90-Day Profile</span>
                                                                        </div>
                                                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 font-medium">Tier: Elite</span>
                                                                    </div>

                                                                    {/* Pillar Scores */}
                                                                    <div>
                                                                        <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1.5">Pillars</div>
                                                                        <div className="grid grid-cols-3 gap-1.5">
                                                                            {[
                                                                                { label: 'Focus', start: 61, end: 88, color: 'text-blue-400', bar: 'bg-blue-400' },
                                                                                { label: 'Composure', start: 38, end: 91, color: 'text-green-400', bar: 'bg-green-400' },
                                                                                { label: 'Decision', start: 54, end: 79, color: 'text-purple-400', bar: 'bg-purple-400' },
                                                                            ].map((p) => (
                                                                                <div key={p.label} className="rounded-lg bg-zinc-800/50 border border-zinc-700/20 p-2">
                                                                                    <div className={`text-[10px] font-bold ${p.color}`}>{p.label}</div>
                                                                                    <div className="text-[11px] font-black text-white">{p.start} <span className={p.color}>→ {p.end}</span></div>
                                                                                    <div className="mt-1 h-1 rounded-full bg-zinc-700">
                                                                                        <motion.div
                                                                                            initial={{ width: `${p.start}%` }}
                                                                                            animate={{ width: `${p.end}%` }}
                                                                                            transition={{ delay: 0.8, duration: 1 }}
                                                                                            className={`h-full rounded-full ${p.bar}`}
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Reset skills */}
                                                                    <div>
                                                                        <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1.5">3-Second Reset Target Skills</div>
                                                                        <div className="space-y-1">
                                                                            {[
                                                                                { skill: 'Error Recovery Speed', before: 'Avg 45s', after: 'Avg 2.8s', delta: '↓ 94%', color: 'text-green-400' },
                                                                                { skill: 'Attentional Shifting', before: '42', after: '87', delta: '+107%', color: 'text-blue-400' },
                                                                                { skill: 'Pressure Stability', before: '35', after: '82', delta: '+134%', color: 'text-purple-400' },
                                                                            ].map((s) => (
                                                                                <div key={s.skill} className="flex items-center justify-between rounded-lg bg-zinc-800/40 border border-zinc-700/20 px-2.5 py-1.5">
                                                                                    <div>
                                                                                        <div className="text-[10px] font-semibold text-zinc-300">{s.skill}</div>
                                                                                        <div className="text-[9px] text-zinc-500">{s.before} → {s.after}</div>
                                                                                    </div>
                                                                                    <span className={`text-[10px] font-black ${s.color}`}>{s.delta}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Recovery trend chart */}
                                                                    <div>
                                                                        <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Composure Score Trend</div>
                                                                        <div className="flex items-end gap-[3px] h-10">
                                                                            {[38, 41, 40, 46, 52, 57, 60, 63, 71, 79, 85, 91].map((v, i) => (
                                                                                <motion.div
                                                                                    key={i}
                                                                                    initial={{ height: 0 }}
                                                                                    animate={{ height: `${(v / 100) * 100}%` }}
                                                                                    transition={{ delay: i * 0.06, duration: 0.4 }}
                                                                                    className={`flex-1 rounded-t ${i < 3 ? 'bg-zinc-600' : i < 6 ? 'bg-amber-400/70' : i < 9 ? 'bg-orange-400/80' : 'bg-green-400'}`}
                                                                                />
                                                                            ))}
                                                                        </div>

                                                                        {/* Tier labels */}
                                                                        <div className="grid grid-cols-4 gap-1 mt-2">
                                                                            {[
                                                                                { label: 'Foundation', dot: 'bg-zinc-500' },
                                                                                { label: 'Sharpening', dot: 'bg-amber-400' },
                                                                                { label: 'Pressure', dot: 'bg-orange-400' },
                                                                                { label: 'Elite', dot: 'bg-green-400' },
                                                                            ].map((t) => (
                                                                                <div key={t.label} className="text-center">
                                                                                    <div className="flex items-center justify-center gap-0.5 mb-0.5">
                                                                                        <div className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                                                                                        <span className="text-[7px] text-zinc-500">{t.label}</span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Check-in streak */}
                                                                    <div className="flex items-center justify-between rounded-lg bg-zinc-800/40 border border-zinc-700/20 px-2.5 py-1.5">
                                                                        <div className="text-[10px] text-zinc-400">Check-in Streak</div>
                                                                        <div className="text-[10px] font-bold text-[#E0FE10]">87 days 🔥</div>
                                                                    </div>

                                                                    {/* Skill profile CTA */}
                                                                    <button
                                                                        onClick={() => setShowSkillProfile(true)}
                                                                        className="w-full flex items-center justify-between rounded-lg bg-zinc-800/60 border border-zinc-700/30 hover:border-[#E0FE10]/30 hover:bg-zinc-800 px-2.5 py-2 transition-all group"
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-5 h-5 rounded-md bg-[#E0FE10]/10 flex items-center justify-center">
                                                                                <Brain className="w-3 h-3 text-[#E0FE10]" />
                                                                            </div>
                                                                            <span className="text-[10px] font-semibold text-zinc-300 group-hover:text-white transition-colors">View My Skill Profile</span>
                                                                        </div>
                                                                        <ChevronRight className="w-3 h-3 text-zinc-500 group-hover:text-[#E0FE10] transition-colors" />
                                                                    </button>
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

                                    {/* ── Skill Profile Modal (portal) ── */}
                                    {typeof document !== 'undefined' && ReactDOM.createPortal(
                                        <AnimatePresence>
                                            {showSkillProfile && (() => {
                                                const pillars = [
                                                    {
                                                        id: 'composure' as const,
                                                        label: 'Composure', score: 91,
                                                        accent: '#22c55e', accentDim: 'rgba(34,197,94,0.12)',
                                                        definition: 'Your ability to maintain execution quality when things go wrong. Composure is the gap between disruption and re-engagement — trained through deliberate exposure to pressure, error, and evaluation.',
                                                        skills: [
                                                            { name: 'Error Recovery Speed', score: 91, prev: 34, sim: '3-Second Reset', desc: 'How fast you bounce back after a mistake' },
                                                            { name: 'Emotional Interference Control', score: 78, prev: 41, sim: '3-Second Reset', desc: 'Prevent emotion from degrading execution' },
                                                            { name: 'Pressure Stability', score: 82, prev: 35, sim: '3-Second Reset', desc: 'Maintain quality under evaluative pressure' },
                                                        ],
                                                        modifierContext: [
                                                            { label: 'Readiness', score: 82, color: '#22d3ee', impact: 'Higher readiness = faster error recovery and better composure under fatigue' },
                                                            { label: 'Consistency', score: 88, color: '#E0FE10', impact: 'Low variance in composure scores across repeated sessions' },
                                                            { label: 'Fatigability', score: 71, color: '#f59e0b', impact: 'Composure degrades 29% in late-session reps — recovery slows' },
                                                            { label: 'Pressure Sensitivity', score: 78, color: '#fb923c', impact: 'Composure holds under evaluative pressure but dips under compounding errors' },
                                                        ],
                                                    },
                                                    {
                                                        id: 'focus' as const,
                                                        label: 'Focus', score: 88,
                                                        accent: '#60a5fa', accentDim: 'rgba(96,165,250,0.1)',
                                                        definition: 'Your ability to lock attention onto the right thing, hold it under load, and redirect it immediately after disruption. Focus is not about blocking everything out — it is about rapid, accurate reallocation of mental resources.',
                                                        skills: [
                                                            { name: 'Sustained Attention', score: 85, prev: 58, sim: 'Endurance Lock', desc: 'Maintain focus over extended time-on-task' },
                                                            { name: 'Selective Attention', score: 81, prev: 50, sim: 'Noise Gate', desc: 'Filter distractors and hold the right cue' },
                                                            { name: 'Attentional Shifting', score: 87, prev: 42, sim: '3-Second Reset', desc: 'Rapidly redirect after disruption' },
                                                        ],
                                                        modifierContext: [
                                                            { label: 'Readiness', score: 82, color: '#22d3ee', impact: 'Focus sharpness tracks directly with daily readiness check-in' },
                                                            { label: 'Consistency', score: 88, color: '#E0FE10', impact: 'Attention scores stay tight across sessions — low drift' },
                                                            { label: 'Fatigability', score: 71, color: '#f59e0b', impact: 'Sustained attention drops 29% after 3+ min on-task' },
                                                            { label: 'Pressure Sensitivity', score: 78, color: '#fb923c', impact: 'Selective attention narrows under high-stakes — distractor cost rises' },
                                                        ],
                                                    },
                                                    {
                                                        id: 'decision' as const,
                                                        label: 'Decision', score: 79,
                                                        accent: '#c084fc', accentDim: 'rgba(192,132,252,0.1)',
                                                        definition: 'Your ability to read the right cue, suppress the wrong impulse, and act precisely under time pressure. Decision quality degrades faster than any other pillar under fatigue — it is the last pillar trained and the first one lost.',
                                                        skills: [
                                                            { name: 'Response Inhibition', score: 76, prev: 54, sim: 'Brake Point', desc: 'Cancel bad actions before error cascades' },
                                                            { name: 'Working Memory Updating', score: 74, prev: 55, sim: 'Sequence Shift', desc: 'Update rules and priorities mid-execution' },
                                                            { name: 'Cue Discrimination', score: 80, prev: 52, sim: 'Signal Window', desc: 'Read the real signal from decoys in time' },
                                                        ],
                                                        modifierContext: [
                                                            { label: 'Readiness', score: 82, color: '#22d3ee', impact: 'Low readiness = more impulsive errors and slower cue reads' },
                                                            { label: 'Consistency', score: 88, color: '#E0FE10', impact: 'Decision accuracy varies the most across sessions of all pillars' },
                                                            { label: 'Fatigability', score: 71, color: '#f59e0b', impact: 'Inhibition degrades fastest under fatigue — false starts increase' },
                                                            { label: 'Pressure Sensitivity', score: 78, color: '#fb923c', impact: 'Decision speed holds but accuracy drops under evaluative threat' },
                                                        ],
                                                    },
                                                ];
                                                const active = pillars.find(p => p.id === skillProfileTab)!;
                                                return (
                                                    <>
                                                        {/* Backdrop */}
                                                        <motion.div
                                                            key="sp-backdrop"
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                            transition={{ duration: 0.25 }}
                                                            className="fixed inset-0 z-[9999]"
                                                            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
                                                            onClick={() => setShowSkillProfile(false)}
                                                        />
                                                        {/* Modal */}
                                                        <motion.div
                                                            key="sp-modal"
                                                            initial={{ opacity: 0, scale: 0.92, y: 24 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.95, y: 16 }}
                                                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                                            className="fixed inset-x-4 z-[9999] flex flex-col overflow-hidden rounded-2xl border border-zinc-700/50"
                                                            style={{
                                                                top: '3%',
                                                                bottom: '3%',
                                                                maxWidth: '440px',
                                                                margin: '0 auto',
                                                                background: 'rgba(14,14,16,0.97)',
                                                                boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 1px 0 rgba(255,255,255,0.06) inset',
                                                            }}
                                                        >
                                                            {/* Gradient glow */}
                                                            <div className="absolute top-0 inset-x-0 h-32 pointer-events-none rounded-t-2xl" style={{ background: `radial-gradient(ellipse at 50% 0%, ${active.accentDim} 0%, transparent 70%)` }} />

                                                            {/* Header */}
                                                            <div className="relative flex-shrink-0 px-5 pt-5 pb-3">
                                                                {/* Drag handle */}
                                                                <div className="w-8 h-1 rounded-full bg-zinc-700 mx-auto mb-4" />
                                                                <div className="flex items-start justify-between">
                                                                    <div>
                                                                        <div className="text-[10px] uppercase tracking-widest font-bold mb-0.5" style={{ color: active.accent }}>Pulse Check</div>
                                                                        <div className="text-lg font-black text-white leading-tight">Skill Profile</div>
                                                                        <div className="text-[10px] text-zinc-500 mt-0.5">Tremaine Grant</div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => setShowSkillProfile(false)}
                                                                        className="w-7 h-7 rounded-full bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center hover:bg-zinc-600 transition-colors"
                                                                    >
                                                                        <X className="w-3 h-3 text-zinc-400" />
                                                                    </button>
                                                                </div>

                                                                {/* Pillar tabs */}
                                                                <div className="flex gap-1.5 mt-4">
                                                                    {pillars.map((p) => {
                                                                        const isActive = skillProfileTab === p.id;
                                                                        return (
                                                                            <button
                                                                                key={p.id}
                                                                                onClick={() => setSkillProfileTab(p.id)}
                                                                                className="flex-1 rounded-xl py-2 px-2 border transition-all duration-200 text-center relative overflow-hidden"
                                                                                style={{
                                                                                    background: isActive ? p.accentDim : 'rgba(39,39,42,0.3)',
                                                                                    borderColor: isActive ? p.accent + '50' : 'rgba(63,63,70,0.3)',
                                                                                }}
                                                                            >
                                                                                <div className="text-[8px] uppercase tracking-widest font-bold" style={{ color: isActive ? p.accent : '#52525b' }}>{p.label}</div>
                                                                                <div className="text-lg font-black leading-tight mt-0.5" style={{ color: isActive ? p.accent : '#71717a' }}>{p.score}</div>
                                                                                {isActive && (
                                                                                    <motion.div
                                                                                        layoutId="pillar-underline"
                                                                                        className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                                                                                        style={{ background: p.accent }}
                                                                                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                                                                    />
                                                                                )}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>



                                                            {/* Skills — scrollable */}
                                                            <div className="flex-1 overflow-y-auto px-5 pb-5" style={{ scrollbarWidth: 'none' }}>
                                                                <AnimatePresence mode="wait">
                                                                    <motion.div
                                                                        key={skillProfileTab}
                                                                        initial={{ opacity: 0, x: 14 }}
                                                                        animate={{ opacity: 1, x: 0 }}
                                                                        exit={{ opacity: 0, x: -14 }}
                                                                        transition={{ duration: 0.15 }}
                                                                        className="space-y-2.5"
                                                                    >
                                                                        {/* Pillar definition callout */}
                                                                        <motion.div
                                                                            initial={{ opacity: 0, y: -6 }}
                                                                            animate={{ opacity: 1, y: 0 }}
                                                                            transition={{ duration: 0.2 }}
                                                                            className="rounded-xl px-3.5 py-3 mb-1"
                                                                            style={{ background: active.accentDim, border: `1px solid ${active.accent}22` }}
                                                                        >
                                                                            <div className="text-[8px] uppercase tracking-widest font-bold mb-1" style={{ color: active.accent }}>What is {active.label}?</div>
                                                                            <p className="text-[11px] text-zinc-300 leading-relaxed">{active.definition}</p>
                                                                        </motion.div>
                                                                        {active.skills.map((skill, si) => (
                                                                            <motion.div
                                                                                key={skill.name}
                                                                                initial={{ opacity: 0, y: 6 }}
                                                                                animate={{ opacity: 1, y: 0 }}
                                                                                transition={{ delay: si * 0.05 }}
                                                                                className="rounded-xl border p-3.5"
                                                                                style={{ borderColor: active.accent + '18', background: 'rgba(24,24,27,0.7)' }}
                                                                            >
                                                                                <div className="flex items-start justify-between gap-3 mb-2.5">
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <div className="text-[13px] font-bold text-white leading-snug">{skill.name}</div>
                                                                                        <div className="text-[9px] text-zinc-500 mt-0.5 leading-snug">{skill.desc}</div>
                                                                                    </div>
                                                                                    <div className="text-right flex-shrink-0">
                                                                                        <div className="text-2xl font-black leading-none" style={{ color: active.accent }}>{skill.score}</div>
                                                                                        <div className="text-[8px] font-bold mt-0.5" style={{ color: active.accent }}>+{skill.score - skill.prev}</div>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="relative h-1.5 rounded-full bg-zinc-800/80 overflow-hidden mb-2">
                                                                                    <div className="absolute top-0 bottom-0 rounded-full opacity-25" style={{ width: `${skill.prev}%`, background: active.accent }} />
                                                                                    <motion.div
                                                                                        initial={{ width: `${skill.prev}%` }}
                                                                                        animate={{ width: `${skill.score}%` }}
                                                                                        transition={{ delay: 0.2 + si * 0.08, duration: 0.9, ease: 'easeOut' }}
                                                                                        className="absolute top-0 bottom-0 rounded-full"
                                                                                        style={{ background: `linear-gradient(90deg, ${active.accent}88, ${active.accent})` }}
                                                                                    />
                                                                                </div>
                                                                                <div className="flex items-center justify-between">
                                                                                    <div className="flex items-center gap-1">
                                                                                        <Zap className="w-2.5 h-2.5" style={{ color: active.accent + '99' }} />
                                                                                        <span className="text-[8px] font-medium text-zinc-500">{skill.sim}</span>
                                                                                    </div>
                                                                                    <span className="text-[8px] text-zinc-600">{skill.prev} → {skill.score}</span>
                                                                                </div>
                                                                            </motion.div>
                                                                        ))}

                                                                        {/* Cross-cutting Modifiers — shown on every tab */}
                                                                        <div className="pt-2">
                                                                            <div className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-2">
                                                                                How modifiers affect {active.label}
                                                                            </div>
                                                                            <div className="space-y-1.5">
                                                                                {active.modifierContext.map((mod: { label: string; score: number; color: string; impact: string }) => (
                                                                                    <div key={mod.label} className="rounded-lg border border-zinc-800/60 px-3 py-2" style={{ background: 'rgba(24,24,27,0.5)' }}>
                                                                                        <div className="flex items-center justify-between mb-1">
                                                                                            <div className="text-[8px] font-bold uppercase tracking-wide" style={{ color: mod.color }}>{mod.label}</div>
                                                                                            <div className="text-xs font-black leading-none" style={{ color: mod.color }}>{mod.score}</div>
                                                                                        </div>
                                                                                        <div className="text-[8px] text-zinc-500 leading-snug mb-1.5">{mod.impact}</div>
                                                                                        <div className="h-0.5 rounded-full bg-zinc-800">
                                                                                            <motion.div
                                                                                                initial={{ width: 0 }}
                                                                                                animate={{ width: `${mod.score}%` }}
                                                                                                transition={{ delay: 0.6, duration: 0.8 }}
                                                                                                className="h-full rounded-full"
                                                                                                style={{ background: mod.color }}
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>

                                                                        {/* Evidence */}
                                                                        <div className="pt-2 pb-1">
                                                                            <p className="text-[8px] text-zinc-600 text-center leading-relaxed">
                                                                                <span className="text-zinc-500">Adjacent Evidence</span> — ACT (Eysenck 2007) &amp; SIT (Meichenbaum 1985)
                                                                            </p>
                                                                        </div>
                                                                    </motion.div>
                                                                </AnimatePresence>
                                                            </div>
                                                        </motion.div>
                                                    </>
                                                );
                                            })()}
                                        </AnimatePresence>,
                                        document.body
                                    )}

                                    {/* Inline Reset Drill — Full Interactive Game */}
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
                                                    <span className="text-sm font-bold text-white">3-Second Reset</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {/* Round dots */}
                                                    <div className="flex gap-1.5">
                                                        {Array.from({ length: ksTotalRounds }).map((_, i) => (
                                                            <div
                                                                key={i}
                                                                className={`w-2 h-2 rounded-full transition-colors ${i < ksCurrentRound - 1 ? 'bg-[#E0FE10]' :
                                                                    i === ksCurrentRound - 1 ? (resetPhase === 'disruption' ? 'bg-red-500 animate-pulse' : resetPhase === 'reengage' ? 'bg-cyan-400' : 'bg-[#E0FE10]') :
                                                                        'bg-white/20'
                                                                    }`}
                                                            />
                                                        ))}
                                                    </div>
                                                    {/* Phase label */}
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${resetPhase === 'lockIn' ? 'text-[#E0FE10]' :
                                                        resetPhase === 'disruption' ? 'text-red-400' :
                                                            resetPhase === 'reengage' ? 'text-cyan-400' :
                                                                'text-zinc-500'
                                                        }`}>
                                                        {resetPhase === 'lockIn' ? 'Lock In' :
                                                            resetPhase === 'disruption' ? 'Disruption!' :
                                                                resetPhase === 'reengage' ? '3-Second Reset' :
                                                                    resetPhase === 'done' ? 'Complete' :
                                                                        `Round ${ksCurrentRound}`}
                                                    </span>
                                                    {/* Sound toggle */}
                                                    <button
                                                        onClick={() => setSoundEnabled(v => !v)}
                                                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all group ${soundEnabled ? 'bg-zinc-800/60 border-zinc-700/40 hover:bg-zinc-700/60' : 'bg-red-500/10 border-red-500/30'}`}
                                                        title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
                                                    >
                                                        {soundEnabled
                                                            ? <Volume2 className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
                                                            : <VolumeX className="w-3.5 h-3.5 text-red-400" />
                                                        }
                                                    </button>
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
                                                        <div className="text-2xl font-black text-[#E0FE10]">3-Second Reset ✓</div>

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
                                                    /* Active Game — Lock In / Disruption / Reset */
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
                                                                        '3-Second Reset — Re-engage NOW'}
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
                                                                {resetPhase === 'reengage' && (
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
                                                                        className={`absolute inset-0 rounded-full blur-xl transition-colors duration-300 ${resetPhase === 'reengage' ? 'bg-cyan-400/20' : 'bg-[#E0FE10]/15'
                                                                            }`}
                                                                        style={{ transform: `scale(${ksPulseScale * 1.3})` }}
                                                                    />
                                                                    {/* Ring */}
                                                                    <div className={`absolute inset-0 rounded-full border-2 transition-colors duration-300 ${resetPhase === 'reengage' ? 'border-cyan-400/40' : 'border-[#E0FE10]/30'
                                                                        }`} />
                                                                    {/* Core */}
                                                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${resetPhase === 'reengage'
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
                                                                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${acc ? (resetPhase === 'reengage' ? 'bg-cyan-400' : 'bg-[#E0FE10]') : 'bg-red-500/50'}`} />
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
                                                            <span className="text-base font-bold text-white">3-Second Reset</span>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <div className="flex gap-1.5">
                                                                    {Array.from({ length: ksTotalRounds }).map((_, i) => (
                                                                        <div
                                                                            key={i}
                                                                            className={`w-2 h-2 rounded-full transition-colors ${i < ksCurrentRound - 1 ? 'bg-[#E0FE10]' :
                                                                                i === ksCurrentRound - 1 ? (resetPhase === 'disruption' ? 'bg-red-500 animate-pulse' : resetPhase === 'reengage' ? 'bg-cyan-400' : 'bg-[#E0FE10]') :
                                                                                    'bg-white/20'
                                                                                }`}
                                                                        />
                                                                    ))}
                                                                </div>
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${resetPhase === 'lockIn' ? 'text-[#E0FE10]' :
                                                                    resetPhase === 'disruption' ? 'text-red-400' :
                                                                        resetPhase === 'reengage' ? 'text-cyan-400' : 'text-zinc-500'
                                                                    }`}>
                                                                    {resetPhase === 'lockIn' ? 'Lock In' :
                                                                        resetPhase === 'disruption' ? 'Disruption!' :
                                                                            resetPhase === 'reengage' ? '3-Second Reset' :
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
                                                                <div className="text-3xl font-black text-[#E0FE10]">3-Second Reset ✓</div>
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
                                                                        {resetPhase === 'lockIn' ? 'Lock In — Tap in rhythm' : resetPhase === 'disruption' ? 'Disruption!' : '3-Second Reset — Re-engage NOW'}
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
                                                                        {resetPhase === 'reengage' && (
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
                                                                            <div className={`absolute inset-0 rounded-full blur-xl transition-colors duration-300 ${resetPhase === 'reengage' ? 'bg-cyan-400/20' : 'bg-[#E0FE10]/15'}`} style={{ transform: `scale(${ksPulseScale * 1.3})` }} />
                                                                            <div className={`absolute inset-0 rounded-full border-2 transition-colors duration-300 ${resetPhase === 'reengage' ? 'border-cyan-400/40' : 'border-[#E0FE10]/30'}`} />
                                                                            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${resetPhase === 'reengage' ? 'bg-gradient-to-br from-cyan-400 to-cyan-500' : 'bg-gradient-to-br from-[#E0FE10] to-[#c5dc0e]'}`}>
                                                                                <div className="w-4 h-4 rounded-full bg-white" />
                                                                            </div>
                                                                        </motion.button>
                                                                        {ksTapAccuracy.length > 0 && (
                                                                            <div className="flex gap-1.5">
                                                                                {ksTapAccuracy.slice(-8).map((acc, i) => (
                                                                                    <div key={i} className={`w-2 h-2 rounded-full ${acc ? (resetPhase === 'reengage' ? 'bg-cyan-400' : 'bg-[#E0FE10]') : 'bg-red-500/50'}`} />
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
                                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Quick Reply</div>
                                    <div className="flex flex-wrap gap-2">
                                        {closeResponses[chatStep].map((resp, idx) => {
                                            const styles = sentimentStyles(resp.sentiment);
                                            return (
                                                <motion.button
                                                    key={idx}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.1 + 0.5 }}
                                                    onClick={() => advanceChat(resp.value)}
                                                    className={`px-4 py-2.5 rounded-xl text-sm text-left border transition-all duration-200 max-w-[90%] ${styles.base} ${styles.hover}`}
                                                >
                                                    &quot;{resp.label}&quot;
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {!closeResponses[chatStep] && !isNTyping && !drillActive && chatStep > 1 && chatStep < 3 && (
                                <div className="max-w-3xl mx-auto mb-3">
                                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Quick Reply</div>
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
    const [selectedStaff, setSelectedStaff] = useState('Coach Mayo (Head Coach)');
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

            // ── Staff notification step override ──────────────
            // scriptIndex 8 = staff-selection step. Personalize Nora's reply
            // based on which staff member (or opt-out) the athlete chose.
            const isStaffStep = nextIdx === 8;
            const didOptOut = userText === "Don't notify anyone";

            // Capture staff selection for Act 2 sidebar
            if (isStaffStep && !didOptOut) {
                setSelectedStaff(userText);
            }

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

                    // Override content for the staff notification confirmation step
                    const overrideContent = isStaffStep
                        ? didOptOut
                            ? "Totally understood — your privacy comes first. Let's keep working through this together. I've got a few more tools that can help you reset before game time."
                            : `Done. I've sent a secure briefing to ${userText.split(' (')[0]} with your physical baseline data and today's conversation context. They'll have the full picture before your 10 AM meeting.`
                        : undefined;

                    const contentToPlay = overrideContent ?? nextScript.content;

                    // Preload audio WHILE typing indicator shows
                    const playFn = await preloadAudio(contentToPlay, nextScript.ttsSpeed);

                    // Now reveal message and play audio simultaneously
                    setIsTyping(false);
                    const noraMsg: ChatMsg = {
                        id: `nora-${Date.now()}-${nextIdx}`,
                        content: contentToPlay,
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
                                            : ''}
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
                                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Quick Reply</div>
                                            <div className="flex flex-wrap gap-2">
                                                {SUGGESTED_RESPONSES[scriptIndex].map((suggestion, idx) => {
                                                    const styles = sentimentStyles(suggestion.sentiment);
                                                    return (
                                                        <motion.button
                                                            key={idx}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: idx * 0.1 + 0.5 }}
                                                            onClick={() => {
                                                                setInput('');
                                                                advanceScript(suggestion.text);
                                                            }}
                                                            className={`px-4 py-2.5 rounded-xl text-sm text-left border transition-all duration-200 max-w-[90%] ${styles.base} ${styles.hover}`}
                                                        >
                                                            &quot;{suggestion.text}&quot;
                                                        </motion.button>
                                                    );
                                                })}
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
                                <CoachDashboard
                                    onContinue={() => setCurrentAct('act3')}
                                    notifiedStaff={(() => {
                                        const staffMap: Record<string, { name: string; initials: string; role: string }> = {
                                            'Coach Mayo (Head Coach)': { name: 'Coach Mayo', initials: 'JM', role: 'Head Coach' },
                                            'Coach Van Pelt (Offensive Coordinator)': { name: 'Coach Van Pelt', initials: 'BV', role: 'Offensive Coordinator' },
                                            'Coach Covington (Defensive Coordinator)': { name: 'Coach Covington', initials: 'DC', role: 'Defensive Coordinator' },
                                            'Jim Whalen (Head Athletic Trainer)': { name: 'Jim Whalen', initials: 'JW', role: 'Head Athletic Trainer' },
                                            'Dr. Liz Carter (Staff Clinician)': { name: 'Dr. Liz Carter', initials: 'LC', role: 'Staff Clinician' },
                                        };
                                        return staffMap[selectedStaff] ?? { name: 'Coach Mayo', initials: 'JM', role: 'Head Coach' };
                                    })()}
                                />
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
                                <TheClose coachName={selectedStaff.split(' (')[0]} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>
        </>
    );
};

export default PulseCheckDemo;
