import React, { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import act1AudioManifest from '../data/pulsecheckdemo-act1-audio.json';
import athleteAudioManifest from '../data/pulsecheckathletedemo-audio.json';
import {
    Volume2,
    VolumeX,
    Mic,
    MicOff,
    Send,
    Brain,
    Heart,
    Activity,
    Shield,
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    Wind,
    Target,
    Zap,
    Eye,
    EyeOff,
    Lock,
    Check,
    Moon,
    Sparkles,
    Flame,
    TrendingUp,
    Users,
    Phone,
    RotateCcw,
    Star,
    Leaf,
    Wifi,
    BellOff,
    Radio,
    Play,
    ArrowRight,
    MessageSquare,
    MessageCircle,
    Split,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────
// PULSECHECK — ATHLETE-CENTERED DEMO
//
// Sibling to /pulsecheckdemo (the stakeholder cut). Same chat
// engine, but the back half sells the ATHLETE instead of the
// institution:
//   intro → chat1 (game day) → curriculum (the growth)
//         → chat2 (the spiral) → consent (your call) → call (human touch)
//
// No coach dashboard, no escalation tiers. Ends on the warm
// clinician call — the human-connection close.
// ─────────────────────────────────────────────────────────

type DemoAct = 'intro' | 'chat1' | 'curriculum' | 'chat2' | 'consent' | 'call';

interface ScriptMessage {
    role: 'nora' | 'athlete' | 'system';
    content: string;
    delay?: number;
    triggerBreathing?: boolean;
    transitionTo?: DemoAct;
    autoAdvance?: boolean;
    autoAdvanceDelay?: number;
    ttsSpeed?: number;
    audioId?: string; // reuses /audio/pulsecheckdemo manifest when present
}

interface ChatMsg {
    id: string;
    content: string;
    isFromUser: boolean;
    timestamp: number;
}

type AudioManifestEntry = { id: string; filename: string; text: string };

const AUDIO_BASE = '/audio/pulsecheckdemo';
const AUDIO_MANIFEST = [
    ...(act1AudioManifest as AudioManifestEntry[]),
    ...(athleteAudioManifest as AudioManifestEntry[]),
];
const AUDIO_BY_ID = new Map(AUDIO_MANIFEST.map((e) => [e.id, e]));
const getAudioPath = (id?: string | null): string | null => {
    if (!id) return null;
    const entry = AUDIO_BY_ID.get(id);
    return entry ? `${AUDIO_BASE}/${entry.filename}` : null;
};

const NORA_THINKING_MS = 3000;

// ─────────────────────────────────────────────────────────
// SCRIPTS
// ─────────────────────────────────────────────────────────

// Chat 1 — Game Day (reuses the proven game-day moment + audio)
const CHAT1_SCRIPT: ScriptMessage[] = [
    {
        role: 'nora',
        content: 'Hi Tremaine, today is game day. How are you feeling?',
        delay: 1000,
        ttsSpeed: 0.85,
        audioId: 'act1-00-intro',
    },
    {
        role: 'nora',
        content:
            'Your baseline looks great today. You had 8 hours of solid sleep, your Resting Heart Rate (RHR) is at 42 bpm, and your HRV baseline is high, indicating excellent central nervous system (CNS) recovery. Your body is primed for today.',
        delay: 1500,
        audioId: 'act1-01-baseline',
    },
    {
        role: 'nora',
        content:
            "Coach scheduled the competition prep meeting for 10:00 AM in the film room. You've got a couple hours.",
        delay: 1200,
        audioId: 'act1-02-meeting',
    },
    {
        role: 'nora',
        content:
            "Talk to me. What is it about today that feels different from the other days? Why does today's game make you nervous?",
        delay: 1500,
        audioId: 'act1-03-probe',
    },
    {
        role: 'nora',
        content:
            "OK. Let's slow it down.\n\nI want to run you through an exercise called Box Breathing. This is a technique performed by Navy SEALs during acute stress responses to override the body's fight-or-flight system. We can apply it right now, and you can use it again right before you run out of the tunnel.\n\nHere's how it works: Inhale for 4 seconds → Hold for 4 seconds → Exhale for 4 seconds → Hold for 4 seconds. We'll do 4 rounds.\n\nAre you ready?",
        delay: 2000,
        audioId: 'act1-04-box-breathing',
    },
    {
        role: 'system',
        content: 'BREATHING_EXERCISE',
        triggerBreathing: true,
    },
    {
        role: 'nora',
        content: 'Great work. How are you feeling now?',
        delay: 1000,
        audioId: 'act1-05-post-breathing',
    },
    {
        role: 'nora',
        content:
            "That's the win — and here's the part most people miss: this wasn't a one-off trick. Box breathing is one of the skills in your PulseCheck training. The more reps you put in, the faster you can find that calm when it actually counts. Want to see your training?",
        delay: 2000,
        transitionTo: 'curriculum',
        autoAdvanceDelay: 5000,
        audioId: 'athlete-curriculum-handoff',
    },
];

const CHAT1_RESPONSES: Record<number, SuggestedResponse[]> = {
    1: [
        { text: 'I feel okay, just trying to get locked in.', sentiment: 'positive' },
        { text: "Eh, I don't know. Just woke up.", sentiment: 'neutral' },
        { text: 'Honestly? I barely slept.', sentiment: 'negative' },
    ],
    2: [
        { text: "That's good to hear. I needed that.", sentiment: 'positive' },
        { text: 'Nice, at least my body showed up today.', sentiment: 'neutral' },
        { text: "Numbers are cool, but I still don't feel right.", sentiment: 'negative' },
    ],
    3: [
        { text: "Perfect, 10 AM. That gives me time to get right.", sentiment: 'positive' },
        { text: "Alright, I'll be there.", sentiment: 'neutral' },
        { text: 'Ugh, 10 AM? That feels early on game day.', sentiment: 'negative' },
    ],
    4: [
        { text: "I mean, the pressure is there, but I've been here before.", sentiment: 'positive' },
        { text: "I don't know, everything just feels like it's on the line today.", sentiment: 'neutral' },
        { text: 'I feel like I\'m going to let everyone down.', sentiment: 'negative' },
    ],
    5: [
        { text: "Sure, let's do it.", sentiment: 'positive' },
        { text: "I guess I'll try it.", sentiment: 'neutral' },
        { text: "I don't know if that'll help, but fine.", sentiment: 'negative' },
    ],
    7: [
        { text: 'I feel a lot better actually.', sentiment: 'positive' },
        { text: 'A little better, but still tense.', sentiment: 'neutral' },
        { text: 'Still wired, but more in control.', sentiment: 'neutral' },
    ],
};

// Chat 2 — The Spiral (new scenario, no pre-rendered audio yet)
const CHAT2_SCRIPT: ScriptMessage[] = [
    {
        role: 'nora',
        content:
            "Hey Tremaine. Your evening check-in came back different tonight — your HRV dropped and you flagged your mood at a 2. I'm not going anywhere. What's going on?",
        delay: 1000,
        audioId: 'athlete-spiral-00-open',
    },
    {
        role: 'nora',
        content:
            "That sounds really heavy. Thank you for telling me — saying it out loud takes guts. How long have you been carrying this?",
        delay: 1500,
        audioId: 'athlete-spiral-01-howlong',
    },
    {
        role: 'nora',
        content:
            "I hear you, and I want to be honest with you: I can sit with you right now, but what you're describing deserves more than a chat window. It deserves a real person.",
        delay: 1500,
        audioId: 'athlete-spiral-02-realperson',
    },
    {
        role: 'nora',
        content:
            "I can connect you with Dr. Liz Carter, a licensed clinician. Here's what makes this different — she already has the context you've chosen to share. You won't start from zero or re-explain your whole life. And you decide exactly what she sees. Want me to set it up?",
        delay: 2000,
        audioId: 'athlete-spiral-03-connect',
    },
    {
        role: 'nora',
        content:
            "You're in control of every piece of this. Let me show you exactly what gets shared before anything ever reaches her.",
        delay: 1800,
        transitionTo: 'consent',
        autoAdvanceDelay: 4000,
        audioId: 'athlete-spiral-04-consent',
    },
];

const CHAT2_RESPONSES: Record<number, SuggestedResponse[]> = {
    1: [
        { text: "Honestly, I don't know. Everything feels like too much right now.", sentiment: 'negative' },
        { text: "I haven't told anyone this, but I've been really struggling.", sentiment: 'negative' },
        { text: "I'm not okay. I don't even know where to start.", sentiment: 'negative' },
    ],
    2: [
        { text: 'A few weeks. It keeps getting worse.', sentiment: 'negative' },
        { text: "Since the injury, if I'm honest.", sentiment: 'neutral' },
        { text: 'Longer than I want to admit.', sentiment: 'negative' },
    ],
    3: [
        { text: "I've thought about therapy, but starting feels like too much.", sentiment: 'neutral' },
        { text: "I don't even know how to find someone.", sentiment: 'neutral' },
        { text: "Maybe. I'm just tired of explaining myself over and over.", sentiment: 'neutral' },
    ],
    4: [
        { text: 'Yeah. Please.', sentiment: 'positive' },
        { text: "Okay — but I want to know what she'll see.", sentiment: 'neutral' },
        { text: 'I think so.', sentiment: 'positive' },
    ],
};

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

// ─────────────────────────────────────────────────────────
// VOICE-REACTIVE ORB
// ─────────────────────────────────────────────────────────

const VoiceReactiveOrb: React.FC<{
    active: boolean;
    intensity: number;
    pitch: number;
}> = ({ active, intensity, pitch }) => {
    const coreScale = 1 + intensity * 0.15;
    const accentHue = 68 + pitch * 22;
    const glowSize = active ? 20 + intensity * 30 : 12;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center py-6"
        >
            <div className="relative flex items-center justify-center">
                <motion.div
                    className="absolute rounded-full"
                    animate={{
                        scale: active ? [1, 1.3, 1] : [1, 1.1, 1],
                        opacity: active ? [0.3, 0.6, 0.3] : [0.15, 0.25, 0.15],
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                        width: 80,
                        height: 80,
                        background: `radial-gradient(circle, hsla(${accentHue}, 90%, 60%, 0.4) 0%, transparent 70%)`,
                        filter: `blur(${glowSize}px)`,
                    }}
                />
                <motion.div
                    className="relative w-12 h-12 rounded-full"
                    animate={{ scale: coreScale }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    style={{
                        background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5) 0%, hsla(${accentHue}, 90%, 58%, 0.9) 50%, hsla(${accentHue}, 85%, 35%, 0.95) 100%)`,
                        boxShadow: `0 0 ${glowSize}px hsla(${accentHue}, 92%, 64%, 0.3)`,
                    }}
                />
            </div>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="mt-3 text-center"
            >
                <div className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/40">
                    Nora
                </div>
            </motion.div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────
// BOX BREATHING ANIMATION
// ─────────────────────────────────────────────────────────

const BoxBreathingAnimation: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const phases = ['Inhale', 'Hold', 'Exhale', 'Hold'] as const;
    const [currentPhase, setCurrentPhase] = useState(0);
    const [currentRound, setCurrentRound] = useState(1);
    const [secondsLeft, setSecondsLeft] = useState(4);
    const totalRounds = 2;

    useEffect(() => {
        const timer = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    setCurrentPhase((p) => {
                        const next = p + 1;
                        if (next >= 4) {
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
            <div className="relative w-40 h-40 flex items-center justify-center">
                <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(224,254,16,0.15) 0%, transparent 70%)',
                    }}
                    animate={{ scale: isExpand ? [1, 1.3] : isShrink ? [1.3, 1] : 1.3 }}
                    transition={{ duration: 4, ease: 'easeInOut' }}
                />
                <motion.div
                    className="w-28 h-28 rounded-full border-2 border-[#E0FE10]/40 flex items-center justify-center"
                    style={{
                        background: 'radial-gradient(circle, rgba(224,254,16,0.08) 0%, rgba(224,254,16,0.02) 100%)',
                    }}
                    animate={{
                        scale: isExpand ? [0.7, 1.1] : isShrink ? [1.1, 0.7] : phase === 'Hold' && currentPhase === 1 ? 1.1 : 0.7,
                    }}
                    transition={{ duration: 4, ease: 'easeInOut' }}
                >
                    <div className="text-center">
                        <div className="text-2xl font-bold text-[#E0FE10]">{secondsLeft}</div>
                        <div className="text-xs text-zinc-400 uppercase tracking-wider mt-1">{phase}</div>
                    </div>
                </motion.div>
            </div>
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
// BIOMETRIC HUD
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
                <motion.div key={hrv} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-xl font-bold text-blue-400 relative z-10">
                    {hrv}
                </motion.div>
                <div className="text-[10px] text-zinc-500 uppercase relative z-10">HRV</div>
                <div className="text-[9px] text-green-400/70 mt-0.5 relative z-10">↑ Improving</div>
            </div>
            <div className="rounded-xl bg-zinc-900/80 border border-[#E0FE10]/20 p-3 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-[#E0FE10]/5 to-transparent" />
                <Brain className="w-4 h-4 text-[#E0FE10] mx-auto mb-1 relative z-10" />
                <motion.div key={calmScore} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-xl font-bold text-[#E0FE10] relative z-10">
                    {calmScore}
                </motion.div>
                <div className="text-[10px] text-zinc-500 uppercase relative z-10">Calm</div>
                <div className="text-[9px] text-green-400/70 mt-0.5 relative z-10">↑ Stabilizing</div>
            </div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────
// CURRICULUM VIEW (net-new) — faithful recreation of the
// PulseCheck iOS home screen: greeting, live devices strip,
// the Composure Step1/Step2 "Today" card, step cards, active
// toolkit, Talk to Nora, and the bottom tab bar.
// ─────────────────────────────────────────────────────────

// 12-segment protocol/simulation progress meter (matches iOS)
const SegmentBar: React.FC<{ filled: number; total?: number; color?: string }> = ({ filled, total = 12, color = '#E0FE10' }) => (
    <div className="flex gap-[3px]">
        {Array.from({ length: total }).map((_, i) => (
            <div
                key={i}
                className="h-1 flex-1 rounded-full"
                style={{ background: i < filled ? color : 'rgba(82,82,91,0.5)' }}
            />
        ))}
    </div>
);

const CurriculumView: React.FC<{ onContinue: () => void }> = ({ onContinue }) => {
    return (
        <div className="h-full flex flex-col items-center justify-center px-6 py-4">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-[393px] h-[852px] max-h-[92vh] rounded-[44px] overflow-hidden border-[3px] border-zinc-800 shadow-2xl shadow-black/60 flex flex-col"
                style={{ background: '#0a0a0b' }}
            >
                {/* iOS status bar */}
                <div className="flex items-center justify-between px-7 pt-3 pb-1 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[15px] font-semibold text-white tracking-tight">3:14</span>
                        <BellOff className="w-3.5 h-3.5 text-white/70" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="flex items-end gap-[2px] h-3">
                            {[5, 7, 9, 11].map((h, i) => (
                                <div key={i} className="w-[3px] rounded-[1px] bg-white" style={{ height: h }} />
                            ))}
                        </div>
                        <Wifi className="w-4 h-4 text-white" />
                        <div className="flex items-center gap-1">
                            <span className="text-[11px] font-semibold text-white">84</span>
                            <div className="w-6 h-3 rounded-[3px] border border-white/50 relative p-[1px]">
                                <div className="h-full rounded-[1px] bg-green-400" style={{ width: '84%' }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scroll body */}
                <div className="flex-1 overflow-y-auto px-5 pb-6" style={{ overscrollBehavior: 'contain' }}>
                    {/* Greeting */}
                    <div className="flex items-start justify-between pt-3 pb-4">
                        <div>
                            <div className="text-[15px] text-zinc-400 leading-none mb-1">Good morning</div>
                            <h1 className="text-[34px] leading-none font-black text-white tracking-tight">Tremaine</h1>
                        </div>
                        <div className="w-12 h-12 rounded-full p-[2px]" style={{ background: 'linear-gradient(135deg, #E0FE10, #a78bfa)' }}>
                            <div className="w-full h-full rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">
                                <span className="text-sm font-bold text-white">T</span>
                            </div>
                        </div>
                    </div>

                    {/* Live devices card */}
                    <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-4 mb-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-2 min-w-0">
                                <span className="text-[15px] font-bold text-white whitespace-nowrap">2 devices live</span>
                                <span className="text-[13px] text-zinc-500 truncate">Fitbit Air · Oura Ring</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/30">
                                    <Radio className="w-3 h-3 text-orange-400" />
                                    <span className="text-[12px] font-semibold text-orange-400">Polar</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-zinc-600" />
                            </div>
                        </div>
                        <div className="flex items-end justify-between mt-4 pt-4 border-t border-zinc-800/70">
                            <div className="flex flex-col items-start">
                                <span className="w-2 h-2 rounded-full bg-red-500 mb-1.5 animate-pulse" />
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Live</span>
                            </div>
                            {[
                                { label: 'HR', value: '—', unit: 'bpm', accent: '#e4e4e7' },
                                { label: 'HRV', value: '58', unit: 'ms', accent: '#ffffff' },
                                { label: 'RHR', value: '52', unit: 'bpm', accent: '#ffffff' },
                                { label: 'Ready', value: '61', unit: '%', accent: '#E0FE10' },
                            ].map((m) => (
                                <div key={m.label} className="flex flex-col items-start">
                                    <span className="text-[10px] text-zinc-500 mb-0.5">{m.label}</span>
                                    <span className="text-[17px] font-bold leading-none" style={{ color: m.accent }}>
                                        {m.value}
                                        <span className="text-[10px] font-normal text-zinc-500 ml-0.5">{m.unit}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Today */}
                    <div className="flex items-center gap-2 mb-3">
                        <Leaf className="w-5 h-5 text-[#E0FE10]" />
                        <span className="text-[20px] font-bold text-white">Today</span>
                    </div>

                    {/* Composure protocol + simulation card */}
                    <div
                        className="rounded-[20px] p-4 mb-3"
                        style={{
                            border: '1px solid rgba(224,254,16,0.35)',
                            background: 'linear-gradient(180deg, rgba(224,254,16,0.07) 0%, rgba(224,254,16,0.01) 100%)',
                            boxShadow: '0 0 32px rgba(224,254,16,0.08)',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-2.5">
                            <span className="px-2.5 py-1 rounded-md bg-[#E0FE10] text-black text-[11px] font-black tracking-wide">COMPOSURE</span>
                            <span className="text-[13px] text-zinc-400">Step 1 1/12 · Step 2 0/12</span>
                        </div>
                        <h3 className="text-[24px] leading-tight font-black text-white mb-1.5">Stay calm under pressure</h3>
                        <p className="text-[13px] text-zinc-400 leading-snug mb-4">Step 1 and Step 2 progress separately in this 30-day window.</p>

                        <div className="mb-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[13px] font-semibold text-white">Step 1 protocol</span>
                                <span className="text-[12px] text-zinc-400">1/12 complete</span>
                            </div>
                            <SegmentBar filled={1} />
                        </div>
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[13px] font-semibold text-white">Step 2 simulation</span>
                                <span className="text-[12px] text-zinc-400">0/12 complete</span>
                            </div>
                            <SegmentBar filled={0} />
                        </div>

                        <div
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-3"
                            style={{ background: 'rgba(224,254,16,0.08)', border: '1px solid rgba(224,254,16,0.2)' }}
                        >
                            <div className="w-5 h-5 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                                <ArrowRight className="w-3 h-3 text-[#E0FE10]" />
                            </div>
                            <span className="text-[13px] text-zinc-200">Do Step 1 first, then Step 2 simulation.</span>
                        </div>

                        <button className="w-full py-3.5 rounded-2xl bg-[#E0FE10] text-black font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.99] transition-transform">
                            <Play className="w-4 h-4" fill="currentColor" />
                            Start Step 1 protocol
                        </button>
                    </div>

                    {/* Step 1 / Step 2 cards */}
                    <div className="grid grid-cols-2 gap-2.5 mb-5">
                        <div className="rounded-[18px] p-3.5" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)' }}>
                            <Moon className="w-5 h-5 text-purple-300 mb-2" />
                            <div className="text-[12px] font-semibold text-purple-300 mb-1">Step 1 · Start here</div>
                            <div className="text-[14px] font-bold text-white leading-tight mb-1">4-7-8 Relaxation Breat…</div>
                            <div className="text-[12px] text-zinc-400 leading-snug">Calm your body. Reset your focus.</div>
                        </div>
                        <div className="rounded-[18px] p-3.5 bg-zinc-900/60 border border-zinc-800/80">
                            <Split className="w-5 h-5 text-zinc-400 mb-2" />
                            <div className="text-[12px] font-semibold text-zinc-500 mb-1">Step 2 · After Step 1</div>
                            <div className="text-[14px] font-bold text-white leading-tight mb-1">Fakeout Brake Point</div>
                            <div className="text-[12px] text-zinc-400 leading-snug">Practice staying composed under pr…</div>
                        </div>
                    </div>

                    {/* Active toolkit */}
                    <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[16px] font-bold text-white">Active toolkit</span>
                        <span className="text-[12px] text-zinc-500">3 protocols · 3 simulations</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 mb-5">
                        <div className="rounded-[18px] p-3.5 bg-zinc-900/50 border border-zinc-800/80">
                            <Wind className="w-5 h-5 text-[#E0FE10] mb-2" />
                            <div className="text-[14px] font-bold text-white">Box Breathing</div>
                            <div className="text-[12px] text-zinc-500">In toolkit</div>
                        </div>
                        <div className="rounded-[18px] p-3.5 bg-zinc-900/50 border border-zinc-800/80">
                            <Split className="w-5 h-5 text-orange-300 mb-2" />
                            <div className="text-[14px] font-bold text-white">Fakeout Brake Point</div>
                            <div className="text-[12px] text-orange-300/80">Today</div>
                        </div>
                    </div>

                    {/* Talk to Nora — advances the demo into chat 2 */}
                    <motion.button
                        onClick={onContinue}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl relative overflow-hidden"
                        style={{ background: 'rgba(224,254,16,0.06)', border: '1px solid rgba(224,254,16,0.4)' }}
                    >
                        <motion.div
                            className="absolute inset-0 rounded-2xl"
                            animate={{ boxShadow: ['0 0 0px rgba(224,254,16,0)', '0 0 22px rgba(224,254,16,0.22)', '0 0 0px rgba(224,254,16,0)'] }}
                            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 relative z-10">
                            <MessageSquare className="w-5 h-5 text-[#E0FE10]" />
                        </div>
                        <span className="flex-1 text-left text-[17px] font-bold text-white relative z-10">Talk to Nora</span>
                        <ChevronRight className="w-5 h-5 text-zinc-500 relative z-10" />
                    </motion.button>
                </div>

                {/* Bottom tab bar */}
                <div className="flex-shrink-0 flex items-center justify-around px-8 py-3 border-t border-zinc-800/70 bg-black/50 backdrop-blur-xl">
                    <div className="px-5 py-2 rounded-full bg-zinc-800/80">
                        <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <MessageSquare className="w-5 h-5 text-zinc-600" />
                    <Brain className="w-5 h-5 text-zinc-600" />
                    <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">T</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────
// CONSENT / CONTROL SCREEN (net-new) — the privacy moment.
// The athlete decides exactly what the clinician sees.
// ─────────────────────────────────────────────────────────

const Toggle: React.FC<{ on: boolean; onClick: () => void; accent?: string }> = ({ on, onClick, accent = '#E0FE10' }) => (
    <button
        onClick={onClick}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: on ? accent : 'rgba(82,82,91,0.6)' }}
        aria-pressed={on}
    >
        <motion.div
            animate={{ x: on ? 22 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
        />
    </button>
);

interface ShareRow {
    key: string;
    label: string;
    detail: string;
    icon: React.ElementType;
    accent: string;
}

const DATA_ROWS: ShareRow[] = [
    { key: 'biometrics', label: 'Biometric trends', detail: 'HRV, resting heart rate, sleep', icon: Activity, accent: '#38bdf8' },
    { key: 'checkins', label: 'Check-ins & mood', detail: 'Your daily conversations with Nora', icon: Heart, accent: '#f87171' },
    { key: 'skills', label: 'Skill sessions', detail: 'Box breathing, focus, training reps', icon: Wind, accent: '#E0FE10' },
    { key: 'journal', label: 'Private journal', detail: 'Notes you write just for yourself', icon: Lock, accent: '#a78bfa' },
    { key: 'offfield', label: 'Off-field notes', detail: 'Anything outside of sport', icon: Eye, accent: '#fb923c' },
];

const PEOPLE_ROWS = [
    { key: 'family', label: 'Family' },
    { key: 'coachMayo', label: 'Coach Mayo' },
    { key: 'teammates', label: 'Teammates' },
    { key: 'partner', label: 'Partner' },
];

const ConsentControlScreen: React.FC<{ onContinue: () => void }> = ({ onContinue }) => {
    const [shares, setShares] = useState<Record<string, boolean>>({
        biometrics: true,
        checkins: true,
        skills: true,
        journal: false,
        offfield: false,
    });
    const [people, setPeople] = useState<Record<string, boolean>>({
        family: true,
        coachMayo: true,
        teammates: false,
        partner: true,
    });
    const [showSafety, setShowSafety] = useState(false);

    const sharedCount =
        Object.values(shares).filter(Boolean).length + Object.values(people).filter(Boolean).length;

    return (
        <div className="h-full overflow-y-auto px-6 py-8">
            <div className="max-w-xl mx-auto">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E0FE10]/10 border border-[#E0FE10]/25 mb-3">
                        <Shield className="w-3.5 h-3.5 text-[#E0FE10]" />
                        <span className="text-[10px] font-bold text-[#E0FE10] uppercase tracking-[0.2em]">Your privacy, your call</span>
                    </div>
                    <h2 className="text-2xl font-black text-white">Choose what Dr. Carter sees.</h2>
                    <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                        Nothing is shared until you tap connect. She walks in already knowing the context you choose — so you never start from zero.
                    </p>
                </motion.div>

                {/* Data categories */}
                <div className="rounded-2xl bg-zinc-900/60 border border-zinc-700/40 divide-y divide-zinc-800/60 mb-4">
                    {DATA_ROWS.map((row) => {
                        const Icon = row.icon;
                        const on = shares[row.key];
                        return (
                            <div key={row.key} className="flex items-center gap-3 p-3.5">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${row.accent}1a`, border: `1px solid ${row.accent}40` }}>
                                    <Icon className="w-4 h-4" style={{ color: row.accent }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-white">{row.label}</div>
                                    <div className="text-[11px] text-zinc-500">{row.detail}</div>
                                </div>
                                <Toggle on={on} onClick={() => setShares((s) => ({ ...s, [row.key]: !s[row.key] }))} accent={row.accent} />
                            </div>
                        );
                    })}
                </div>

                {/* The characters in your life */}
                <div className="rounded-2xl bg-zinc-900/60 border border-zinc-700/40 p-3.5 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-[#E0FE10]" />
                        <span className="text-sm font-semibold text-white">The people in your life</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mb-3">
                        The characters Nora already knows about. Pick who Dr. Carter can see — she won&apos;t have to learn your whole world from scratch.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {PEOPLE_ROWS.map((p) => {
                            const on = people[p.key];
                            return (
                                <button
                                    key={p.key}
                                    onClick={() => setPeople((s) => ({ ...s, [p.key]: !s[p.key] }))}
                                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all ${on ? 'bg-[#E0FE10]/10 border-[#E0FE10]/30' : 'bg-zinc-800/40 border-zinc-700/40'}`}
                                >
                                    <span className={`text-xs font-medium ${on ? 'text-white' : 'text-zinc-500'}`}>{p.label}</span>
                                    {on ? <Eye className="w-3.5 h-3.5 text-[#E0FE10]" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-600" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Live preview */}
                <div className="rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-700/40 p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Dr. Carter will see</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {DATA_ROWS.filter((r) => shares[r.key]).map((r) => (
                            <span key={r.key} className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-800/70 border border-zinc-700/50 text-zinc-300">{r.label}</span>
                        ))}
                        {PEOPLE_ROWS.filter((p) => people[p.key]).map((p) => (
                            <span key={p.key} className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-800/70 border border-zinc-700/50 text-zinc-300">{p.label}</span>
                        ))}
                        {sharedCount === 0 && <span className="text-[11px] text-zinc-600 italic">Nothing yet — you&apos;re fully private.</span>}
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-2">You can change any of this at any time, even mid-session.</div>
                </div>

                {/* Safety exception — the honest line */}
                <button
                    onClick={() => setShowSafety((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 mb-5"
                >
                    <div className="flex items-center gap-2 text-left">
                        <Shield className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        <span className="text-xs text-zinc-400">The one exception to your privacy</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${showSafety ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                    {showSafety && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden -mt-3 mb-5"
                        >
                            <div className="px-4 py-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 text-[11px] text-zinc-400 leading-relaxed">
                                The only thing we can&apos;t keep private is a genuine safety emergency — if you&apos;re in real danger. It&apos;s rare, it&apos;s clearly defined, and you&apos;ll always be told the moment it happens. Everything else stays exactly where you put it.
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* CTA */}
                <motion.button
                    onClick={onContinue}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full py-3.5 rounded-2xl font-bold text-black flex items-center justify-center gap-2 mb-3"
                    style={{ background: '#E0FE10' }}
                >
                    <Lock className="w-4 h-4" />
                    Share &amp; connect with Dr. Carter
                </motion.button>
                <p className="text-center text-[11px] text-zinc-600">Sharing {sharedCount} item{sharedCount === 1 ? '' : 's'} · You stay in control</p>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────
// CALL HELPERS
// ─────────────────────────────────────────────────────────

const CallTimer: React.FC = () => {
    const [seconds, setSeconds] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setSeconds((s) => s + 1), 1000);
        return () => clearInterval(t);
    }, []);
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return <div className="text-sm text-green-400">{mm}:{ss}</div>;
};

const CallSimulation: React.FC<{
    onRinging: () => void;
    onConnected: () => void;
    onEnded: () => void;
}> = ({ onRinging, onConnected, onEnded }) => {
    const onRingingRef = useRef(onRinging);
    const onConnectedRef = useRef(onConnected);
    const onEndedRef = useRef(onEnded);
    onRingingRef.current = onRinging;
    onConnectedRef.current = onConnected;
    onEndedRef.current = onEnded;

    useEffect(() => {
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
                    gain.gain.setValueAtTime(0.12, time);
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
        const t2 = setTimeout(() => onEndedRef.current(), 11000);
        return () => { clearTimeout(t1); clearTimeout(t2); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
};

// ─────────────────────────────────────────────────────────
// CLINICIAN CALL (adapted welfare-check close) — warm, chosen.
// ─────────────────────────────────────────────────────────

const ClinicianCall: React.FC = () => {
    const [callStatus, setCallStatus] = useState<'ringing' | 'connected' | 'ended'>('ringing');

    return (
        <div className="h-full flex flex-col items-center justify-center py-12 px-6 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-6">
                {/* Phone UI */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-[320px] rounded-[36px] overflow-hidden border border-zinc-700/40 p-8 text-center"
                    style={{ background: 'linear-gradient(180deg, #16161a 0%, #0c0c0e 100%)' }}
                >
                    {/* Avatar */}
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-700/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl font-bold text-emerald-300">LC</span>
                    </div>
                    <div className="text-lg font-bold text-white mb-0.5">Dr. Liz Carter</div>
                    <div className="text-xs text-zinc-500 mb-6">Licensed Clinician · via PulseCheck</div>

                    {/* Status */}
                    <motion.div
                        animate={{ opacity: callStatus === 'ringing' ? [0.5, 1, 0.5] : 1 }}
                        transition={{ duration: 2, repeat: callStatus === 'ringing' ? Infinity : 0 }}
                        className="mb-6"
                    >
                        {callStatus === 'ringing' && <div className="text-sm text-[#E0FE10]">Connecting you&hellip;</div>}
                        {callStatus === 'connected' && <CallTimer />}
                        {callStatus === 'ended' && <div className="text-sm text-zinc-400">Call Ended</div>}
                    </motion.div>

                    {/* Ringing ring */}
                    {callStatus === 'ringing' && (
                        <div className="flex justify-center mb-4 relative h-16">
                            <motion.div
                                animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="w-16 h-16 rounded-full bg-[#E0FE10]/20 absolute"
                            />
                            <div className="w-16 h-16 rounded-full bg-[#E0FE10]/15 flex items-center justify-center">
                                <Phone className="w-6 h-6 text-[#E0FE10]" />
                            </div>
                        </div>
                    )}

                    {/* Connected — waveform */}
                    {callStatus === 'connected' && (
                        <div className="flex flex-col items-center gap-3 mb-2">
                            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center border border-green-500/30 gap-[3px]">
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
                                        transition={{ duration: 0.8 + i * 0.15, repeat: Infinity, ease: 'easeInOut' }}
                                    />
                                ))}
                            </div>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
                                <div className="text-[11px] text-zinc-400 italic">&quot;Hey Tremaine — I&apos;ve got your context. We don&apos;t have to start over.&quot;</div>
                            </motion.div>
                        </div>
                    )}

                    {/* Ended */}
                    {callStatus === 'ended' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 mb-1">
                                <Check className="w-3.5 h-3.5" /> You&apos;re connected
                            </div>
                            <div className="text-[11px] text-zinc-500">First session scheduled · Tomorrow, 4:00 PM</div>
                        </motion.div>
                    )}
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-xs text-zinc-500 uppercase tracking-widest"
                >
                    {callStatus === 'ended' ? 'A human, in your corner' : 'Human Connection'}
                </motion.div>

                {/* Closing reassurance + restart */}
                <AnimatePresence>
                    {callStatus === 'ended' && (
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="flex flex-col items-center gap-4 max-w-sm text-center"
                        >
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/60 border border-zinc-700/40">
                                <Shield className="w-3.5 h-3.5 text-[#E0FE10]" />
                                <span className="text-[11px] text-zinc-400">She saw only what you chose to share.</span>
                            </div>
                            <p className="text-sm text-zinc-300 leading-relaxed">
                                Sometimes a chat is enough to find your calm. Sometimes you need a human. PulseCheck is there for your best day and your worst day — and it&apos;s always your call.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            <CallSimulation
                onRinging={() => setCallStatus('ringing')}
                onConnected={() => setCallStatus('connected')}
                onEnded={() => setCallStatus('ended')}
            />
        </div>
    );
};

// ─────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────

const DEMO_ACT_ORDER: DemoAct[] = ['intro', 'chat1', 'curriculum', 'chat2', 'consent', 'call'];

const ACT_LABEL: Record<DemoAct, string> = {
    intro: '',
    chat1: 'Game Day',
    curriculum: 'Your Training',
    chat2: 'When It Gets Heavy',
    consent: 'Your Privacy, Your Call',
    call: 'Human Connection',
};

const PulseCheckAthleteDemo: React.FC = () => {
    const [currentAct, setCurrentAct] = useState<DemoAct>('intro');
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState('');
    const [scriptIndex, setScriptIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const [showBreathing, setShowBreathing] = useState(false);
    const [introTapped, setIntroTapped] = useState(false);
    const [tapPosition, setTapPosition] = useState<{ x: number; y: number } | null>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);

    // Active script for the current chat act (read via ref inside callbacks)
    const activeScript = currentAct === 'chat2' ? CHAT2_SCRIPT : CHAT1_SCRIPT;
    const activeResponses = currentAct === 'chat2' ? CHAT2_RESPONSES : CHAT1_RESPONSES;
    const scriptRef = useRef(activeScript);
    scriptRef.current = activeScript;

    // Voice state
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [sttEnabled, setSttEnabled] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [voiceOrbIntensity, setVoiceOrbIntensity] = useState(0.08);
    const [voiceOrbPitch, setVoiceOrbPitch] = useState(0.22);
    const recognitionRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const narrationRunRef = useRef(0);
    const orbAudioCtxRef = useRef<AudioContext | null>(null);
    const orbAnalyserRef = useRef<AnalyserNode | null>(null);
    const orbSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const orbAnimationRef = useRef<number | null>(null);
    const orbFrequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const orbTimeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

    const stopVoiceOrb = useCallback(() => {
        if (orbAnimationRef.current) {
            cancelAnimationFrame(orbAnimationRef.current);
            orbAnimationRef.current = null;
        }
        if (orbSourceRef.current) {
            try { orbSourceRef.current.disconnect(); } catch { }
            orbSourceRef.current = null;
        }
        if (orbAnalyserRef.current) {
            try { orbAnalyserRef.current.disconnect(); } catch { }
            orbAnalyserRef.current = null;
        }
        orbFrequencyDataRef.current = null;
        orbTimeDataRef.current = null;
        setVoiceOrbIntensity(0.08);
        setVoiceOrbPitch(0.22);
    }, []);

    const attachVoiceOrb = useCallback((audio: HTMLAudioElement) => {
        if (typeof window === 'undefined') return;
        stopVoiceOrb();
        try {
            const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = orbAudioCtxRef.current ?? new AudioCtx();
            orbAudioCtxRef.current = ctx;
            if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.82;
            const source = ctx.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(ctx.destination);

            orbAnalyserRef.current = analyser;
            orbSourceRef.current = source;
            orbFrequencyDataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
            orbTimeDataRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));

            const tick = () => {
                const freqData = orbFrequencyDataRef.current;
                const timeData = orbTimeDataRef.current;
                const liveAnalyser = orbAnalyserRef.current;
                if (!freqData || !timeData || !liveAnalyser) return;
                liveAnalyser.getByteFrequencyData(freqData);
                liveAnalyser.getByteTimeDomainData(timeData);
                let rmsTotal = 0;
                for (let i = 0; i < timeData.length; i += 1) {
                    const normalized = (timeData[i] - 128) / 128;
                    rmsTotal += normalized * normalized;
                }
                const rms = Math.sqrt(rmsTotal / timeData.length);
                let weightedFreq = 0;
                let totalFreq = 0;
                for (let i = 0; i < freqData.length; i += 1) {
                    weightedFreq += freqData[i] * i;
                    totalFreq += freqData[i];
                }
                const centroid = totalFreq > 0 ? weightedFreq / totalFreq / freqData.length : 0;
                setVoiceOrbIntensity((prev) => prev * 0.72 + Math.min(1, rms * 4.6 + 0.04) * 0.28);
                setVoiceOrbPitch((prev) => prev * 0.7 + centroid * 0.3);
                orbAnimationRef.current = requestAnimationFrame(tick);
            };
            orbAnimationRef.current = requestAnimationFrame(tick);
        } catch (error) {
            console.warn('[TTS] Voice orb visualizer setup failed:', error);
            stopVoiceOrb();
        }
    }, [stopVoiceOrb]);

    const stopNarration = useCallback(() => {
        narrationRunRef.current += 1;
        stopVoiceOrb();
        if (audioRef.current) {
            audioRef.current.onplay = null;
            audioRef.current.onended = null;
            audioRef.current.onerror = null;
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        window.speechSynthesis?.cancel();
        setIsSpeaking(false);
    }, [stopVoiceOrb]);

    const goBackOneStep = useCallback(() => {
        const currentIndex = DEMO_ACT_ORDER.indexOf(currentAct);
        if (currentIndex <= 0) return;
        stopNarration();
        setCurrentAct(DEMO_ACT_ORDER[currentIndex - 1]);
    }, [currentAct, stopNarration]);

    const playNoraWakeup = useCallback(() => {
        if (!ttsEnabled) return;
        try {
            const chime = new Audio('/audio/sfx/mind-coach-greeting.mp3');
            chime.volume = 0.55;
            chime.play().catch(() => { });
        } catch { }
    }, [ttsEnabled]);

    const waitForNoraThinking = useCallback(
        () => new Promise((resolve) => setTimeout(resolve, NORA_THINKING_MS)),
        []
    );

    useEffect(() => {
        scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, showBreathing]);

    const preloadAudio = useCallback(
        async (audioPath: string | null, speed?: number): Promise<(() => void) | null> => {
            if (!ttsEnabled || typeof window === 'undefined' || !audioPath) return null;
            stopNarration();
            const runId = narrationRunRef.current;
            const playbackRate = speed ?? 1.0;
            const audio = new Audio(audioPath);
            audio.preload = 'auto';
            audio.playbackRate = playbackRate;
            audio.defaultPlaybackRate = playbackRate;
            try {
                await new Promise<void>((resolve, reject) => {
                    const handleReady = () => { cleanup(); resolve(); };
                    const handleError = () => { cleanup(); reject(new Error(`Failed to load narration: ${audioPath}`)); };
                    const cleanup = () => {
                        audio.removeEventListener('canplaythrough', handleReady);
                        audio.removeEventListener('error', handleError);
                    };
                    audio.addEventListener('canplaythrough', handleReady, { once: true });
                    audio.addEventListener('error', handleError, { once: true });
                    audio.load();
                });
                if (narrationRunRef.current !== runId) return null;
                audioRef.current = audio;
                audio.onplay = () => { setIsSpeaking(true); attachVoiceOrb(audio); };
                audio.onended = () => {
                    setIsSpeaking(false);
                    stopVoiceOrb();
                    if (audioRef.current === audio) audioRef.current = null;
                };
                audio.onerror = () => {
                    setIsSpeaking(false);
                    stopVoiceOrb();
                    if (audioRef.current === audio) audioRef.current = null;
                };
                return () => {
                    if (narrationRunRef.current !== runId) return;
                    audioRef.current = audio;
                    audio.play().catch(() => {
                        if (audioRef.current === audio) audioRef.current = null;
                        setIsSpeaking(false);
                        stopVoiceOrb();
                    });
                };
            } catch (err) {
                console.warn('[TTS] Error loading narration:', err);
                return null;
            }
        },
        [stopNarration, ttsEnabled, attachVoiceOrb, stopVoiceOrb]
    );

    // Reset chat state whenever we (re)enter a chat act
    useEffect(() => {
        if (currentAct === 'chat1' || currentAct === 'chat2') {
            setMessages([]);
            setScriptIndex(0);
            setShowBreathing(false);
        }
    }, [currentAct]);

    // Play the opening Nora line for the active chat script
    useEffect(() => {
        if (currentAct !== 'chat1' && currentAct !== 'chat2') return;
        if (messages.length > 0) return;
        const script = scriptRef.current;
        const firstMsg = script[0];
        const timer = setTimeout(async () => {
            playNoraWakeup();
            setIsTyping(true);
            const [playFn] = await Promise.all([
                preloadAudio(getAudioPath(firstMsg.audioId), firstMsg.ttsSpeed),
                waitForNoraThinking(),
            ]);
            setIsTyping(false);
            setMessages([{ id: 'msg-0', content: firstMsg.content, isFromUser: false, timestamp: Date.now() }]);
            if (playFn) playFn();
            setScriptIndex(1);
        }, 800);
        return () => clearTimeout(timer);
    }, [currentAct, messages.length, playNoraWakeup, preloadAudio, waitForNoraThinking]);

    // STT
    const toggleSTT = useCallback(() => {
        if (sttEnabled) {
            setSttEnabled(false);
            setIsListening(false);
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }
            return;
        }
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
            if (event.results[event.results.length - 1].isFinal) setIsListening(false);
        };
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognitionRef.current = recognition;
        setSttEnabled(true);
    }, [sttEnabled]);

    const startListening = useCallback(() => {
        if (!recognitionRef.current) return;
        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch { }
    }, []);

    const advanceScript = useCallback(
        (userText: string) => {
            const script = scriptRef.current;
            if (scriptIndex >= script.length) return;

            setMessages((prev) => [...prev, { id: `user-${Date.now()}`, content: userText, isFromUser: true, timestamp: Date.now() }]);

            let nextIdx = scriptIndex;
            const processNext = async () => {
                if (nextIdx >= script.length) return;
                const nextScript = script[nextIdx];

                if (nextScript.role === 'system' && nextScript.triggerBreathing) {
                    setShowBreathing(true);
                    nextIdx++;
                    setScriptIndex(nextIdx);
                    return;
                }

                if (nextScript.role === 'nora') {
                    setIsTyping(true);
                    const [playFn] = await Promise.all([
                        preloadAudio(getAudioPath(nextScript.audioId), nextScript.ttsSpeed),
                        waitForNoraThinking(),
                    ]);
                    setIsTyping(false);
                    setMessages((prev) => [...prev, { id: `nora-${Date.now()}-${nextIdx}`, content: nextScript.content, isFromUser: false, timestamp: Date.now() }]);
                    if (playFn) playFn();
                    nextIdx++;
                    setScriptIndex(nextIdx);

                    if (nextScript.transitionTo) {
                        const act = nextScript.transitionTo;
                        setTimeout(() => setCurrentAct(act), nextScript.autoAdvanceDelay || 3000);
                    } else if (nextScript.autoAdvance) {
                        setTimeout(() => processNext(), nextScript.autoAdvanceDelay || 2000);
                    }
                }
            };
            processNext();
        },
        [preloadAudio, scriptIndex, waitForNoraThinking]
    );

    const handleSend = useCallback(() => {
        if (!input.trim()) return;
        const text = input.trim();
        setInput('');
        advanceScript(text);
    }, [input, advanceScript]);

    const breathingCompletedRef = useRef(false);
    useEffect(() => {
        if (showBreathing) breathingCompletedRef.current = false;
    }, [showBreathing]);

    const handleBreathingComplete = useCallback(async () => {
        if (breathingCompletedRef.current) return;
        breathingCompletedRef.current = true;
        setShowBreathing(false);
        const script = scriptRef.current;
        if (scriptIndex < script.length) {
            const nextScript = script[scriptIndex];
            if (nextScript.role === 'nora') {
                setIsTyping(true);
                const [playFn] = await Promise.all([
                    preloadAudio(getAudioPath(nextScript.audioId), nextScript.ttsSpeed),
                    waitForNoraThinking(),
                ]);
                setIsTyping(false);
                setMessages((prev) => [...prev, { id: `nora-${Date.now()}`, content: nextScript.content, isFromUser: false, timestamp: Date.now() }]);
                if (playFn) playFn();
                setScriptIndex((prev) => prev + 1);
            }
        }
    }, [preloadAudio, scriptIndex, waitForNoraThinking]);

    useEffect(() => stopNarration, [stopNarration]);
    useEffect(
        () => () => {
            stopVoiceOrb();
            orbAudioCtxRef.current?.close().catch(() => undefined);
            orbAudioCtxRef.current = null;
        },
        [stopVoiceOrb]
    );

    const isChatAct = currentAct === 'chat1' || currentAct === 'chat2';

    return (
        <>
            <Head>
                <title>PulseCheck — Athlete Experience</title>
                <meta name="description" content="PulseCheck: mental skills, privacy, and a human in your corner — built around the athlete." />
            </Head>

            <div className="fixed inset-0 bg-[#0a0a0b] flex flex-col overflow-hidden">
                {/* Noise texture */}
                <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />

                {/* Header */}
                {currentAct !== 'intro' && (
                    <header className="relative z-20 flex items-center justify-between px-6 py-4 backdrop-blur-xl bg-zinc-900/30 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#E0FE10]/15 flex items-center justify-center">
                                <Brain className="w-4 h-4 text-[#E0FE10]" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-white">PulseCheck</h1>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{ACT_LABEL[currentAct]}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={goBackOneStep}
                                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all bg-zinc-800/60 border border-zinc-700/40 hover:bg-zinc-700/60"
                                title="Go back"
                            >
                                <ChevronLeft className="w-4 h-4 text-zinc-300" />
                            </button>

                            <button
                                onClick={() => {
                                    setTtsEnabled(!ttsEnabled);
                                    if (ttsEnabled) stopNarration();
                                }}
                                className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all ${ttsEnabled ? 'bg-[#E0FE10]/15 border border-[#E0FE10]/30' : 'bg-zinc-800/60 border border-zinc-700/40'}`}
                                title={ttsEnabled ? 'Mute Nora' : 'Unmute Nora'}
                            >
                                {isSpeaking && (
                                    <motion.div
                                        className="absolute inset-0 rounded-lg border-2 border-[#E0FE10]/50"
                                        animate={{ opacity: [0.5, 1, 0.5] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                    />
                                )}
                                {ttsEnabled ? <Volume2 className="w-4 h-4 text-[#E0FE10]" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
                            </button>

                            {isChatAct && (
                                <button
                                    onClick={toggleSTT}
                                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${sttEnabled ? 'bg-blue-500/15 border border-blue-500/30' : 'bg-zinc-800/60 border border-zinc-700/40'}`}
                                    title={sttEnabled ? 'Disable Voice Input' : 'Enable Voice Input'}
                                >
                                    {sttEnabled ? <Mic className="w-4 h-4 text-blue-400" /> : <MicOff className="w-4 h-4 text-zinc-500" />}
                                </button>
                            )}

                            {/* Act pills */}
                            <div className="flex gap-1 ml-3">
                                {(['chat1', 'curriculum', 'chat2', 'consent', 'call'] as DemoAct[]).map((act) => (
                                    <div
                                        key={act}
                                        className={`w-2 h-2 rounded-full transition-all duration-500 ${act === currentAct
                                            ? act === 'chat2' || act === 'consent'
                                                ? 'bg-purple-400 scale-125'
                                                : act === 'call'
                                                    ? 'bg-emerald-400 scale-125'
                                                    : 'bg-[#E0FE10] scale-125'
                                            : DEMO_ACT_ORDER.indexOf(act) < DEMO_ACT_ORDER.indexOf(currentAct)
                                                ? 'bg-zinc-500'
                                                : 'bg-zinc-700'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                    </header>
                )}

                {/* Main */}
                <main className="flex-1 relative z-10 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {/* INTRO */}
                        {currentAct === 'intro' && (
                            <motion.div
                                key="intro"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="h-full flex flex-col items-center justify-center px-6"
                            >
                                <motion.div
                                    initial={{ opacity: 0, y: 40 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                    className="relative w-[393px] h-[852px] max-h-[88vh] rounded-[40px] overflow-hidden border-2 border-zinc-700/60 shadow-2xl shadow-black/60"
                                    style={{ background: 'linear-gradient(180deg, #111113 0%, #0a0a0b 100%)' }}
                                >
                                    <div className="flex items-center justify-between px-8 pt-4 pb-2">
                                        <span className="text-xs font-semibold text-white">T-Mobile</span>
                                        <div className="flex items-center gap-1">
                                            <div className="w-4 h-2 rounded-sm border border-white/60 relative">
                                                <div className="absolute inset-[1px] right-[2px] bg-green-400 rounded-[1px]" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-center py-12">
                                        <div className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Saturday, March 2</div>
                                        <div className="text-6xl font-thin text-white tracking-tight">6:47</div>
                                        <div className="text-xs text-[#E0FE10]/60 mt-2 font-medium uppercase tracking-wider">★ Game Day</div>
                                    </div>

                                    <motion.div
                                        initial={{ opacity: 0, y: -60 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.5, duration: 0.5, type: 'spring', stiffness: 300, damping: 25 }}
                                        onClick={(e) => {
                                            if (introTapped) return;
                                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                            setTapPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                                            setIntroTapped(true);
                                            setTimeout(() => setCurrentAct('chat1'), 2500);
                                        }}
                                        className="mx-4 mb-8 rounded-2xl p-3.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform relative overflow-hidden"
                                        style={{
                                            background: 'rgba(255,255,255,0.08)',
                                            backdropFilter: 'blur(40px)',
                                            border: introTapped ? '1px solid rgba(224,254,16,0.4)' : '1px solid rgba(255,255,255,0.12)',
                                        }}
                                    >
                                        {introTapped && tapPosition && (
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0.8 }}
                                                animate={{ scale: 6, opacity: 0 }}
                                                transition={{ duration: 2.5, ease: 'easeOut' }}
                                                className="absolute rounded-full pointer-events-none"
                                                style={{
                                                    width: 40, height: 40,
                                                    left: tapPosition.x - 20, top: tapPosition.y - 20,
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
                                                    <span className="text-xs font-bold text-white uppercase tracking-wide">PulseCheck</span>
                                                    <span className="text-[10px] text-zinc-500">now</span>
                                                </div>
                                                <p className="text-sm text-zinc-200 leading-snug">Good morning, Tremaine. Time for your check-in with Nora.</p>
                                            </div>
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 2.5 }}
                                        className="text-center pb-8"
                                    >
                                        <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Tap notification to open</span>
                                    </motion.div>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 2 }}
                                    className="mt-6 text-center"
                                >
                                    <div className="text-xs text-zinc-500 uppercase tracking-widest">Athlete Experience — Game Day Morning</div>
                                </motion.div>
                            </motion.div>
                        )}

                        {/* CHAT (chat1 + chat2 share the same shell) */}
                        {isChatAct && (
                            <motion.div
                                key={currentAct}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, x: -100 }}
                                className="h-full flex flex-col"
                            >
                                <VoiceReactiveOrb active={isSpeaking} intensity={voiceOrbIntensity} pitch={voiceOrbPitch} />

                                <div ref={scrollerRef} className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
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
                                                        {!m.isFromUser && (
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E0FE10]/30 to-[#E0FE10]/10 border border-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                                                                <Brain className="w-3.5 h-3.5 text-[#E0FE10]" />
                                                            </div>
                                                        )}
                                                        <div className={`flex-1 ${m.isFromUser ? 'flex justify-end' : ''}`}>
                                                            <div className={`rounded-2xl px-4 py-3 max-w-[85%] ${m.isFromUser ? 'bg-[#E0FE10]/10 border border-[#E0FE10]/20 ml-auto' : 'bg-zinc-800/60 border border-zinc-700/30'}`}>
                                                                {!m.isFromUser && (
                                                                    <div className="text-[10px] font-bold text-[#E0FE10]/70 uppercase tracking-wider mb-1">Nora</div>
                                                                )}
                                                                <p className={`text-sm leading-relaxed whitespace-pre-line ${m.isFromUser ? 'text-[#E0FE10]/90' : 'text-zinc-200'}`}>{m.content}</p>
                                                            </div>
                                                        </div>
                                                        {m.isFromUser && (
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                                                <span className="text-xs font-bold text-blue-300">TG</span>
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>

                                            <AnimatePresence>
                                                {showBreathing && (
                                                    <div>
                                                        <BoxBreathingAnimation onComplete={handleBreathingComplete} />
                                                        <BiometricHUD isActive={showBreathing} />
                                                    </div>
                                                )}
                                            </AnimatePresence>

                                            {isTyping && (
                                                <motion.div
                                                    initial={{ opacity: 0, filter: 'blur(10px)', y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, filter: 'blur(0px)', y: 0, scale: 1 }}
                                                    transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                                                    className="flex gap-4 items-start py-4"
                                                >
                                                    <motion.div
                                                        className="flex items-center gap-3 px-2"
                                                        animate={{ opacity: [0.5, 1, 0.5] }}
                                                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                                    >
                                                        <motion.div
                                                            className="w-4 h-4 rounded-full"
                                                            style={{
                                                                background: 'radial-gradient(circle, rgba(224,254,16,0.8) 0%, rgba(224,254,16,0) 70%)',
                                                                boxShadow: '0 0 15px rgba(224,254,16,0.3)',
                                                            }}
                                                            animate={{ scale: [0.8, 1.2, 0.8] }}
                                                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                                        />
                                                        <span className="text-[11px] text-[#E0FE10]/70 uppercase tracking-[0.25em] font-light">Thinking...</span>
                                                    </motion.div>
                                                </motion.div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Input bar */}
                                <div className="relative z-20 backdrop-blur-xl bg-zinc-900/40 border-t border-white/5 px-4 py-3">
                                    {activeResponses[scriptIndex] && !showBreathing && !isTyping && (
                                        <div className="max-w-3xl mx-auto mb-3">
                                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Quick Reply</div>
                                            <div className="flex flex-wrap gap-2">
                                                {activeResponses[scriptIndex].map((suggestion, idx) => {
                                                    const styles = sentimentStyles(suggestion.sentiment);
                                                    return (
                                                        <motion.button
                                                            key={idx}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: idx * 0.1 + 0.5 }}
                                                            onClick={() => { setInput(''); advanceScript(suggestion.text); }}
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
                                        {sttEnabled && (
                                            <button
                                                onClick={startListening}
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isListening ? 'bg-red-500/20 border border-red-500/40' : 'bg-zinc-800/60 border border-zinc-700/40 hover:bg-zinc-700/60'}`}
                                            >
                                                {isListening ? (
                                                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
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
                                            placeholder={isListening ? 'Listening...' : 'Type your response...'}
                                            className="flex-1 bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#E0FE10]/40 transition-colors"
                                        />
                                        <button
                                            onClick={handleSend}
                                            disabled={!input.trim()}
                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${input.trim() ? 'bg-[#E0FE10] hover:bg-[#c8e40e]' : 'bg-zinc-800/60 border border-zinc-700/40'}`}
                                        >
                                            <Send className={`w-4 h-4 ${input.trim() ? 'text-black' : 'text-zinc-500'}`} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* CURRICULUM */}
                        {currentAct === 'curriculum' && (
                            <motion.div key="curriculum" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} className="h-full">
                                <CurriculumView onContinue={() => setCurrentAct('chat2')} />
                            </motion.div>
                        )}

                        {/* CONSENT */}
                        {currentAct === 'consent' && (
                            <motion.div key="consent" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} className="h-full">
                                <ConsentControlScreen onContinue={() => setCurrentAct('call')} />
                            </motion.div>
                        )}

                        {/* CALL — the close */}
                        {currentAct === 'call' && (
                            <motion.div key="call" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} className="h-full">
                                <ClinicianCall />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>
        </>
    );
};

export default PulseCheckAthleteDemo;
