import React, { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight, ChevronLeft, Send, MapPin, Calendar,
    Users, MessageCircle, Shield, Heart, Target, Footprints,
    CheckCircle2, UserRoundPlus, Radio, Compass, Clock3,
    HeartHandshake, Smartphone, Sparkles, Settings, BarChart3,
    LogOut, Home, Bell, Zap, Activity, Star, Eye, Trophy,
    Crown, QrCode, Globe, TrendingUp, Award, Play, Mic,
    DollarSign, Flame, ChevronUp, Volume2,
} from 'lucide-react';

// Pulse App Icon — extracted from the brand SVG
const PulseIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
    <svg viewBox="0 0 75 75" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M37.085 0C57.5663 0 74.1699 16.6036 74.1699 37.085C74.1699 57.5664 57.5664 74.1699 37.085 74.1699C16.6037 74.1697 0 57.5662 0 37.085C6.49509e-05 16.6037 16.6038 0.000187122 37.085 0ZM33.3516 21.6367C32.3704 21.6369 31.5045 22.2571 31.1816 23.1689L31.125 23.3555L28.1982 34.5283H22.0967C20.8254 34.5285 19.795 35.5588 19.7949 36.8301C19.7951 38.1012 20.8255 39.1317 22.0967 39.1318H29.9756C31.0221 39.1317 31.9368 38.4254 32.2021 37.4131L33.3516 33.0234L37.8779 50.3047C38.1432 51.317 39.058 52.0243 40.1045 52.0244C41.1511 52.0244 42.0657 51.3171 42.3311 50.3047L45.2578 39.1318H52.4844C53.7556 39.1318 54.7859 38.1013 54.7861 36.8301C54.7861 35.5588 53.7557 34.5284 52.4844 34.5283H43.4805C42.4995 34.5286 41.6344 35.149 41.3115 36.0605L41.2539 36.2471L40.1045 40.6357L35.5791 23.3555C35.3139 22.3428 34.3983 21.6367 33.3516 21.6367ZM14.4238 27.7012C12.9407 27.7013 11.7383 28.9035 11.7383 30.3867V34.1455H10.127C8.64387 34.1457 7.44059 35.348 7.44043 36.8311C7.44043 38.3143 8.64378 39.5164 10.127 39.5166H11.7383V43.2783C11.7384 44.7614 12.9407 45.9637 14.4238 45.9639C15.9071 45.9639 17.1092 44.7615 17.1094 43.2783V30.3867C17.1094 28.9034 15.9071 27.7012 14.4238 27.7012ZM59.5459 27.7012C58.0626 27.7012 56.8604 28.9034 56.8604 30.3867V43.2783C56.8605 44.7615 58.0627 45.9639 59.5459 45.9639C61.0291 45.9638 62.2313 44.7615 62.2314 43.2783V39.5166H63.8428C65.3261 39.5166 66.5293 38.3144 66.5293 36.8311C66.5291 35.3479 65.326 34.1455 63.8428 34.1455H62.2314V30.3867C62.2314 28.9034 61.0292 27.7012 59.5459 27.7012Z" fill="#E0FE10"/>
    </svg>
);

// ─────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────

const TOTAL_STEPS = 19;

const STEP_META: Record<number, { act: string; label: string }> = {
    0: { act: 'intro', label: 'Title' },
    1: { act: 'intro', label: 'Meet Nia' },
    2: { act: '1', label: 'Instagram Post' },
    3: { act: '1', label: 'Download Pulse' },
    4: { act: '1', label: 'RSVP' },
    5: { act: '2', label: 'Onboarding' },
    6: { act: '2', label: 'Intro Post' },
    7: { act: '3', label: 'Buddy Match' },
    8: { act: '3', label: 'Club Chat' },
    9: { act: '4', label: 'QR Check-in' },
    10: { act: '4', label: 'World Map' },
    11: { act: '5', label: 'Voice Note' },
    12: { act: '5', label: 'Global Run' },
    13: { act: '5', label: 'Goal Reached' },
    14: { act: '6', label: 'Leaderboard' },
    15: { act: '7', label: 'Nia Climbs' },
    16: { act: '7', label: 'Stage Moment' },
    17: { act: '8', label: 'Dashboard' },
    18: { act: '8', label: 'Analytics' },
    19: { act: 'close', label: 'The Close' },
};

const ONBOARDING_QUESTIONS = [
    { label: "What's your primary running goal?", options: ['5K consistency', '10K training', 'Half marathon prep', 'Just vibes & community'], icon: Target },
    { label: 'What neighborhood do you run in?', options: ['Old Fourth Ward', 'Midtown', 'Buckhead', 'Westside / BeltLine'], icon: MapPin },
    { label: 'When do you prefer to run?', options: ['Saturday mornings', 'Weekday evenings', 'Sunday long runs', 'Flexible'], icon: Clock3 },
    { label: 'What kind of accountability works for you?', options: ['Motivational nudge + same pace', 'Challenge me to push harder', 'Just check in after the run', 'Match me with someone new'], icon: HeartHandshake },
];

const NIA_ANSWERS = ['5K consistency', 'Old Fourth Ward', 'Saturday mornings', 'Motivational nudge + same pace'];

const WORLD_CITIES = [
    { name: 'Atlanta', x: 24, y: 42, isHub: true, runners: 156 },
    { name: 'New York', x: 28, y: 36, runners: 34 },
    { name: 'London', x: 47, y: 28, runners: 28 },
    { name: 'Lagos', x: 49, y: 54, runners: 15 },
    { name: 'Dubai', x: 60, y: 42, runners: 12 },
    { name: 'Tokyo', x: 82, y: 36, runners: 18 },
    { name: 'Sydney', x: 84, y: 68, runners: 9 },
    { name: 'São Paulo', x: 32, y: 65, runners: 22 },
    { name: 'Houston', x: 20, y: 44, runners: 41 },
    { name: 'Nairobi', x: 56, y: 55, runners: 8 },
    { name: 'Paris', x: 48, y: 30, runners: 14 },
    { name: 'Toronto', x: 26, y: 34, runners: 11 },
    { name: 'Los Angeles', x: 14, y: 40, runners: 31 },
    { name: 'Cape Town', x: 52, y: 72, runners: 6 },
    { name: 'Mumbai', x: 65, y: 46, runners: 10 },
];

const LEADERBOARD = [
    { rank: 1, name: 'Marcus T.', pts: 4380, avatar: 'MT', color: '#FFD700' },
    { rank: 2, name: 'Jade W.', pts: 4290, avatar: 'JW', color: '#C0C0C0' },
    { rank: 3, name: 'Devon R.', pts: 4250, avatar: 'DR', color: '#CD7F32' },
    { rank: 4, name: 'Aisha K.', pts: 4180, avatar: 'AK', color: '#E0FE10' },
    { rank: 5, name: 'Tremaine G.', pts: 4120, avatar: 'TG', color: '#E0FE10' },
    { rank: 6, name: 'Kai L.', pts: 3980, avatar: 'KL', color: '#E0FE10' },
    { rank: 7, name: 'Zara M.', pts: 3870, avatar: 'ZM', color: '#E0FE10' },
    { rank: 8, name: 'Rico P.', pts: 3810, avatar: 'RP', color: '#E0FE10' },
    { rank: 9, name: 'Simone H.', pts: 3750, avatar: 'SH', color: '#E0FE10' },
    { rank: 10, name: 'Dre C.', pts: 3690, avatar: 'DC', color: '#E0FE10' },
    { rank: 11, name: 'Lena B.', pts: 3620, avatar: 'LB', color: '#E0FE10' },
    { rank: 12, name: 'Omar F.', pts: 3580, avatar: 'OF', color: '#E0FE10' },
    { rank: 13, name: 'Priya S.', pts: 3510, avatar: 'PS', color: '#E0FE10' },
    { rank: 14, name: 'Nia W.', pts: 3450, avatar: 'NW', color: '#38BDF8', isNia: true },
    { rank: 15, name: 'Elijah D.', pts: 3380, avatar: 'ED', color: '#E0FE10' },
];

const FINAL_LEADERBOARD = [
    { rank: 1, name: 'Nia W.', pts: 4210, avatar: 'NW', color: '#FFD700', isNia: true },
    { rank: 2, name: 'Marcus T.', pts: 4180, avatar: 'MT', color: '#C0C0C0' },
    { rank: 3, name: 'Jade W.', pts: 4090, avatar: 'JW', color: '#CD7F32' },
    { rank: 4, name: 'Devon R.', pts: 3950, avatar: 'DR', color: '#E0FE10' },
    { rank: 5, name: 'Tremaine G.', pts: 3920, avatar: 'TG', color: '#E0FE10' },
];

const CLUB_MESSAGES = [
    { name: 'Tremaine', text: 'Welcome to Wunna Run Club! Drop your intro — where you run, what you\'re training for. 🏃‍♂️', delay: 800 },
    { name: 'Marcus', text: 'Training for my first half. Piedmont Park every Saturday. Let\'s get it!', delay: 2000 },
    { name: 'Jules', text: 'I usually run BeltLine eastside. Looking for a pace buddy — anyone around 9:00/mi?', delay: 3200 },
    { name: 'Nia', text: 'Hey everyone! 5K consistency is my goal. Old Fourth Ward runner. Excited to meet y\'all Saturday! 🙌', delay: 4500, isNia: true },
];

const MEMBER_ROSTER = [
    { name: 'Nia W.', status: 'Paired', goal: '5K consistency', neighborhood: 'Old Fourth Ward', paired: true, pairName: 'Jules M.', color: '#34D399' },
    { name: 'Jules M.', status: 'Paired', goal: '5K consistency', neighborhood: 'Piedmont Park', paired: true, pairName: 'Nia W.', color: '#38BDF8' },
    { name: 'Marcus T.', status: 'Introduced', goal: 'Half marathon', neighborhood: 'Midtown', paired: true, pairName: 'Devon R.', color: '#34D399' },
    { name: 'Devon R.', status: 'Paired', goal: '10K training', neighborhood: 'Buckhead', paired: true, pairName: 'Marcus T.', color: '#38BDF8' },
    { name: 'Aisha K.', status: 'Onboarded', goal: 'Community vibes', neighborhood: 'Westside', paired: false, pairName: '', color: '#E0FE10' },
    { name: 'Reese K.', status: 'Needs Intro', goal: '5K consistency', neighborhood: 'Midtown', paired: false, pairName: '', color: '#F97316' },
    { name: 'Chris L.', status: 'RSVP Only', goal: '—', neighborhood: '—', paired: false, pairName: '', color: '#71717A' },
    { name: 'Kayla J.', status: 'Introduced', goal: 'Half marathon', neighborhood: 'Midtown', paired: false, pairName: '', color: '#34D399' },
];

// ─────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────

const PhoneStatusBar = () => (
    <div className="flex items-center justify-between px-8 pt-4 pb-2">
        <span className="text-xs font-semibold text-white">T-Mobile</span>
        <div className="flex items-center gap-1">
            <div className="w-4 h-2 rounded-sm border border-white/60 relative">
                <div className="absolute inset-[1px] right-[2px] bg-green-400 rounded-[1px]" />
            </div>
        </div>
    </div>
);

const PhoneFrame: React.FC<{ children: React.ReactNode; borderColor?: string; glowColor?: string }> = ({
    children, borderColor = 'rgba(224,254,16,0.2)', glowColor = 'rgba(224,254,16,0.08)'
}) => (
    <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative w-[393px] h-[852px] rounded-[40px] overflow-hidden border-2 shadow-2xl flex flex-col"
        style={{ background: 'linear-gradient(180deg, #111113 0%, #0a0a0b 100%)', borderColor, boxShadow: `0 0 60px ${glowColor}, 0 20px 40px rgba(0,0,0,0.5)` }}
    >
        <PhoneStatusBar />
        {children}
    </motion.div>
);

const AnimatedCursor: React.FC<{ x: number; y: number; clicking?: boolean; visible?: boolean }> = ({
    x, y, clicking = false, visible = true
}) => (
    <AnimatePresence>
        {visible && (
            <motion.div
                className="absolute z-50 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, x, y }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="white" stroke="black" strokeWidth="1" />
                </svg>
                {clicking && (
                    <motion.div
                        className="absolute top-0 left-0 rounded-full"
                        initial={{ width: 8, height: 8, opacity: 0.8, x: -4, y: -4 }}
                        animate={{ width: 60, height: 60, opacity: 0, x: -30, y: -30 }}
                        transition={{ duration: 0.6 }}
                        style={{ background: 'radial-gradient(circle, rgba(224,254,16,0.6) 0%, transparent 70%)' }}
                    />
                )}
            </motion.div>
        )}
    </AnimatePresence>
);

const ActTitle: React.FC<{ act: string; title: string; subtitle?: string }> = ({ act, title, subtitle }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center px-8"
    >
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-[11px] font-bold uppercase tracking-[0.4em] text-[#E0FE10]/60 mb-4">{act}</motion.div>
        <motion.h2 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="text-5xl md:text-6xl font-black text-white text-center leading-tight mb-4">{title}</motion.h2>
        {subtitle && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                className="text-lg text-zinc-400 text-center max-w-xl leading-relaxed">{subtitle}</motion.p>
        )}
    </motion.div>
);

const InsightCard: React.FC<{ text: string; highlight?: string }> = ({ text, highlight }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center px-8 max-w-3xl mx-auto"
    >
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
            className="rounded-3xl border border-[#E0FE10]/15 bg-[#E0FE10]/[0.03] p-10 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-[#E0FE10]/10 flex items-center justify-center mb-6">
                <Sparkles className="w-5 h-5 text-[#E0FE10]" />
            </div>
            <p className="text-xl md:text-2xl text-zinc-200 leading-relaxed font-light">{text}</p>
            {highlight && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                    className="mt-6 text-lg font-bold text-[#E0FE10]">{highlight}</motion.p>
            )}
        </motion.div>
    </motion.div>
);

const AnimatedCounter: React.FC<{ end: number; duration?: number; prefix?: string; suffix?: string; className?: string }> = ({
    end, duration = 2, prefix = '', suffix = '', className = ''
}) => {
    const [val, setVal] = useState(0);
    useEffect(() => {
        let start = 0;
        const step = end / (duration * 60);
        const timer = setInterval(() => {
            start += step;
            if (start >= end) { setVal(end); clearInterval(timer); }
            else setVal(Math.floor(start));
        }, 1000 / 60);
        return () => clearInterval(timer);
    }, [end, duration]);
    return <span className={className}>{prefix}{val.toLocaleString()}{suffix}</span>;
};

// ─────────────────────────────────────────────────────────
// WORLD MAP COMPONENT
// ─────────────────────────────────────────────────────────

const WorldMap: React.FC<{ showRunners?: boolean; showMileage?: boolean; mileageGoal?: number; showFundraising?: boolean; showGunna?: boolean }> = ({
    showRunners = true, showMileage = false, mileageGoal = 500, showFundraising = false, showGunna = false
}) => {
    const [visibleCities, setVisibleCities] = useState<number>(0);

    useEffect(() => {
        if (!showRunners) return;
        const timer = setInterval(() => {
            setVisibleCities(prev => {
                if (prev >= WORLD_CITIES.length) { clearInterval(timer); return prev; }
                return prev + 1;
            });
        }, 200);
        return () => clearInterval(timer);
    }, [showRunners]);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative w-full h-full rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #0c0c14 0%, #080810 100%)' }}>
            {/* Grid */}
            <div className="absolute inset-0 opacity-[0.06]"
                style={{ backgroundImage: 'radial-gradient(circle, rgba(224,254,16,0.3) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

            {/* City dots */}
            {WORLD_CITIES.slice(0, visibleCities).map((city, i) => (
                <motion.div key={city.name} className="absolute" style={{ left: `${city.x}%`, top: `${city.y}%` }}
                    initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', delay: i * 0.05 }}>
                    {/* Pulse ring */}
                    <motion.div className="absolute rounded-full" animate={{ scale: [1, 2.5, 1], opacity: [0.4, 0, 0.4] }}
                        transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
                        style={{ width: city.isHub ? 20 : 10, height: city.isHub ? 20 : 10, left: city.isHub ? -10 : -5, top: city.isHub ? -10 : -5, background: city.isHub ? 'rgba(224,254,16,0.3)' : 'rgba(56,189,248,0.2)' }} />
                    {/* Dot */}
                    <div className={`rounded-full ${city.isHub ? 'w-4 h-4 -ml-2 -mt-2' : 'w-2 h-2 -ml-1 -mt-1'}`}
                        style={{ background: city.isHub ? '#E0FE10' : '#38BDF8', boxShadow: city.isHub ? '0 0 12px rgba(224,254,16,0.6)' : '0 0 8px rgba(56,189,248,0.4)' }} />
                    {/* Label */}
                    <div className={`absolute whitespace-nowrap text-[9px] font-bold uppercase tracking-wider ${city.isHub ? 'text-[#E0FE10]' : 'text-[#38BDF8]/70'}`}
                        style={{ left: 8, top: -6 }}>{city.name} {city.runners > 0 && <span className="text-white/40 font-normal">({city.runners})</span>}</div>
                </motion.div>
            ))}

            {/* Gunna marker */}
            {showGunna && (
                <motion.div className="absolute" style={{ left: '24%', top: '42%' }}
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1, type: 'spring' }}>
                    <motion.div className="w-8 h-8 -ml-4 -mt-4 rounded-full bg-[#E0FE10]/20 border-2 border-[#E0FE10] flex items-center justify-center"
                        animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                        <span className="text-[8px] font-black text-[#E0FE10]">🎤</span>
                    </motion.div>
                    <div className="absolute left-10 top--2 text-xs font-bold text-[#E0FE10] whitespace-nowrap">Gunna — Live</div>
                </motion.div>
            )}

            {/* Overlays */}
            <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                {showMileage && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                        className="rounded-2xl bg-black/60 backdrop-blur-xl border border-[#E0FE10]/20 p-5">
                        <div className="text-[10px] text-[#E0FE10] font-bold uppercase tracking-[0.3em] mb-1">Community Miles</div>
                        <div className="text-4xl font-black text-white"><AnimatedCounter end={mileageGoal} duration={4} /></div>
                        <div className="text-xs text-zinc-400 mt-1">of {mileageGoal.toLocaleString()} mile goal</div>
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                            <motion.div className="h-full rounded-full bg-gradient-to-r from-[#E0FE10] to-[#38BDF8]"
                                initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 4 }} />
                        </div>
                    </motion.div>
                )}
                {showFundraising && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
                        className="rounded-2xl bg-black/60 backdrop-blur-xl border border-green-500/20 p-5">
                        <div className="text-[10px] text-green-400 font-bold uppercase tracking-[0.3em] mb-1">Funds Raised</div>
                        <div className="text-4xl font-black text-white"><AnimatedCounter end={25000} duration={4} prefix="$" /></div>
                        <div className="text-xs text-zinc-400 mt-1">$12.50 per mile • Sponsor matched</div>
                    </motion.div>
                )}
            </div>

            {/* Participant count */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}
                className="absolute top-6 right-6 rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-3 text-center">
                <div className="text-2xl font-bold text-white"><AnimatedCounter end={showGunna ? 847 : 312} duration={3} /></div>
                <div className="text-[9px] text-zinc-400 uppercase tracking-wider">Runners Live</div>
            </motion.div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────
// SCENE: INTRODUCTION
// ─────────────────────────────────────────────────────────

const SceneIntroTitle: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center px-8">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8 w-16 h-16 rounded-2xl bg-[#E0FE10]/10 border border-[#E0FE10]/20 flex items-center justify-center">
            <Footprints className="w-8 h-8 text-[#E0FE10]" />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8 }}
            className="text-6xl md:text-7xl font-black text-center leading-none mb-4">
            <span className="text-white">Pulse</span>
            <span className="text-[#E0FE10]"> × </span>
            <span className="text-white">Wunna Run</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="text-zinc-400 text-lg text-center max-w-lg">The Full Experience — From first post to crowned champion</motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
            className="mt-12 flex items-center gap-2 text-zinc-600 text-sm"><span>Click anywhere to continue</span>
            <ChevronRight className="w-4 h-4 animate-pulse" /></motion.div>
    </motion.div>
);

const SceneMeetNia: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center px-8 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-[#E0FE10]/60 mb-6">The Question</div>
            <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-8">
                What if a run club could be <span className="text-[#E0FE10]">local and global</span> at the same time?
            </h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                className="text-lg text-zinc-400 leading-relaxed mb-8">
                Today you're going to meet <span className="text-white font-bold">Nia</span>. She's going to show us the whole thing — from the first time she discovers Wunna Run on Instagram, all the way to the moment her name gets called on stage.
            </motion.p>
        </motion.div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────
// ACT 1 — DISCOVERY
// ─────────────────────────────────────────────────────────

const SceneInstagramPost: React.FC = () => {
    const [liked, setLiked] = useState(false);
    useEffect(() => { setTimeout(() => setLiked(true), 2000); }, []);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center px-6">
            <PhoneFrame>
                <div className="flex-1 px-4 py-3 overflow-hidden">
                    {/* IG Header */}
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E0FE10]/30 to-purple-500/30 border border-[#E0FE10]/20 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-[#E0FE10]">WR</span>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-white">wunnarun</div>
                            <div className="text-[9px] text-zinc-500">Atlanta, GA</div>
                        </div>
                    </div>
                    {/* Post Image */}
                    <div className="relative rounded-xl overflow-hidden h-[340px] mb-3"
                        style={{ background: 'linear-gradient(135deg, rgba(224,254,16,0.15) 0%, rgba(139,92,246,0.1) 50%, rgba(56,189,248,0.1) 100%)' }}>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <motion.div animate={{ scale: [1,1.05,1] }} transition={{ duration: 3, repeat: Infinity }}
                                className="text-6xl mb-3">🏃‍♂️</motion.div>
                            <div className="text-2xl font-black text-white text-center px-6">THIS SATURDAY</div>
                            <div className="text-sm text-[#E0FE10] font-bold mt-1">WUNNA RUN ATLANTA</div>
                            <div className="text-xs text-zinc-400 mt-4">March 21 • 8:30 AM • Midtown</div>
                        </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-4 mb-2">
                        <motion.div animate={liked ? { scale: [1, 1.4, 1] } : {}} transition={{ duration: 0.3 }}>
                            <Heart className={`w-6 h-6 ${liked ? 'text-red-500 fill-red-500' : 'text-white'}`} />
                        </motion.div>
                        <MessageCircle className="w-6 h-6 text-white" />
                        <Send className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-xs text-white font-bold mb-1">2,847 likes</div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                        <span className="font-bold text-white">wunnarun</span> The energy last Saturday was UNREAL 🔥 We're doing it again.
                        Wunna Run Atlanta — March 21. <span className="text-[#E0FE10]">Download Pulse to RSVP and join the club.</span>
                    </p>
                    <p className="text-[10px] text-[#38BDF8] font-bold mt-2 uppercase tracking-wider">🔗 Link in bio</p>
                </div>
            </PhoneFrame>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-4 text-xs text-zinc-500 uppercase tracking-widest">
                Nia sees a post that stops her scroll
            </motion.div>
        </motion.div>
    );
};

const SceneDownloadPulse: React.FC = () => {
    const [downloaded, setDownloaded] = useState(false);
    useEffect(() => { setTimeout(() => setDownloaded(true), 2500); }, []);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center px-6">
            <PhoneFrame>
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
                        className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-[#E0FE10]/20 to-[#38BDF8]/10 border border-[#E0FE10]/25 flex items-center justify-center mb-4">
                        <PulseIcon className="w-12 h-12" />
                    </motion.div>
                    <h3 className="text-xl font-black text-white mb-1">Pulse</h3>
                    <p className="text-xs text-zinc-500 mb-1">FitWithPulse, Inc.</p>
                    <div className="flex items-center gap-1 mb-6">
                        {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 text-[#E0FE10] fill-[#E0FE10]" />)}
                        <span className="text-[10px] text-zinc-400 ml-1">4.9</span>
                    </div>
                    <motion.div animate={downloaded ? { scale: [1, 0.95, 1] } : {}}
                        className={`w-full max-w-[200px] rounded-2xl px-6 py-3 text-center text-sm font-black uppercase tracking-[0.2em] transition-all ${
                            downloaded ? 'bg-green-500 text-white' : 'bg-[#E0FE10] text-black'}`}>
                        {downloaded ? '✓ Opening...' : 'GET'}
                    </motion.div>
                    <p className="text-[10px] text-zinc-600 text-center mt-3 max-w-[250px]">Download Pulse to Reserve Your Spot at Wunna Run Atlanta</p>
                </div>
            </PhoneFrame>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-4 text-xs text-zinc-500 uppercase tracking-widest">
                Nia downloads Pulse
            </motion.div>
        </motion.div>
    );
};

const SceneRSVP: React.FC = () => {
    const [rsvpd, setRsvpd] = useState(false);
    useEffect(() => { setTimeout(() => setRsvpd(true), 2000); }, []);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center px-6">
            <PhoneFrame>
                <div className="flex-1 px-5 py-4 overflow-y-auto">
                    <div className="rounded-[24px] border border-white/10 overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(224,254,16,0.08), rgba(255,255,255,0.02))' }}>
                        <div className="relative h-44 flex items-end p-5" style={{ background: 'linear-gradient(135deg, rgba(224,254,16,0.15) 0%, rgba(56,189,248,0.1) 100%)' }}>
                            <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                <Footprints className="w-32 h-32 text-[#E0FE10]" />
                            </div>
                            <div className="relative z-10">
                                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#E0FE10] mb-1">Wunna Run</div>
                                <div className="text-2xl font-black text-white leading-tight">Wunna Run 5K Run</div>
                            </div>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-2 text-sm text-white/55"><MapPin className="h-4 w-4 text-[#38BDF8]" />Midtown Atlanta</div>
                            <div className="flex items-center gap-2 text-sm text-white/55"><Calendar className="h-4 w-4 text-[#FB7185]" />Saturday, March 21 — 8:30 AM</div>
                            <div className="flex items-center gap-2 text-sm text-white/55"><Users className="h-4 w-4 text-[#A78BFA]" />1,000 runners RSVP&apos;d</div>
                            <motion.div animate={rsvpd ? { scale: [1, 0.95, 1] } : {}}
                                className={`mt-2 w-full rounded-2xl px-4 py-3.5 text-sm font-black uppercase tracking-[0.2em] text-center transition-all ${
                                    rsvpd ? 'bg-green-500 text-white' : 'bg-[#E0FE10] text-black'}`}>
                                {rsvpd ? '✓ Spot Reserved!' : 'Reserve Your Spot'}
                            </motion.div>
                        </div>
                    </div>
                    {rsvpd && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                            className="mt-4 rounded-2xl border border-green-500/20 bg-green-500/5 p-4 text-center">
                            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                            <div className="text-sm font-bold text-white">You&apos;re in!</div>
                            <div className="text-xs text-zinc-400 mt-1">The real experience begins now...</div>
                        </motion.div>
                    )}
                </div>
            </PhoneFrame>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────
// ACT 2 — ACTIVATION
// ─────────────────────────────────────────────────────────

const SceneOnboarding: React.FC = () => {
    const [currentQ, setCurrentQ] = useState(0);
    const [done, setDone] = useState(false);
    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = [];
        ONBOARDING_QUESTIONS.forEach((_, i) => {
            timers.push(setTimeout(() => {
                if (i < ONBOARDING_QUESTIONS.length - 1) setCurrentQ(i + 1);
                else setDone(true);
            }, (i + 1) * 1800));
        });
        return () => timers.forEach(clearTimeout);
    }, []);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center px-6">
            <PhoneFrame>
                <div className="flex-1 px-5 py-4">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <div className="text-[10px] text-[#E0FE10] font-bold uppercase tracking-[0.3em]">Wunna Run Club</div>
                            <div className="text-sm text-zinc-400 mt-1">{done ? 'Complete!' : `Onboarding — Step ${currentQ + 1} of ${ONBOARDING_QUESTIONS.length}`}</div>
                        </div>
                        <div className="flex gap-1">
                            {ONBOARDING_QUESTIONS.map((_, i) => (
                                <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i <= currentQ ? 'w-6 bg-[#E0FE10]' : 'w-3 bg-zinc-700'}`} />
                            ))}
                        </div>
                    </div>
                    <AnimatePresence mode="wait">
                        {!done && (
                            <motion.div key={currentQ} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                                {(() => {
                                    const q = ONBOARDING_QUESTIONS[currentQ];
                                    const Icon = q.icon;
                                    const selectedAnswer = NIA_ANSWERS[currentQ];
                                    return (
                                        <div>
                                            <div className="w-12 h-12 rounded-2xl bg-[#E0FE10]/10 border border-[#E0FE10]/20 flex items-center justify-center mb-4">
                                                <Icon className="w-6 h-6 text-[#E0FE10]" />
                                            </div>
                                            <h3 className="text-lg font-bold text-white mb-5">{q.label}</h3>
                                            <div className="space-y-2.5">
                                                {q.options.map((opt) => (
                                                    <div key={opt} className={`w-full text-left rounded-2xl border px-4 py-3.5 text-sm transition-all ${
                                                        opt === selectedAnswer ? 'border-[#E0FE10]/40 bg-[#E0FE10]/10 text-[#E0FE10]' : 'border-white/10 bg-white/[0.04] text-white'}`}>
                                                        {opt === selectedAnswer && <CheckCircle2 className="w-3.5 h-3.5 inline mr-2 text-[#E0FE10]" />}{opt}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </motion.div>
                        )}
                        {done && (
                            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center py-12">
                                <motion.div animate={{ scale: [1,1.2,1] }} transition={{ duration: 0.5 }}>
                                    <CheckCircle2 className="w-16 h-16 text-[#E0FE10] mb-4" />
                                </motion.div>
                                <div className="text-xl font-bold text-white mb-2">Onboarding Complete</div>
                                <div className="text-sm text-zinc-400">Pulse knows who Nia is</div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </PhoneFrame>
        </motion.div>
    );
};

const SceneIntroPost: React.FC = () => {
    const [posted, setPosted] = useState(false);
    useEffect(() => { setTimeout(() => setPosted(true), 2500); }, []);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center px-6">
            <PhoneFrame>
                <div className="flex-1 px-5 py-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-[#E0FE10]/15 flex items-center justify-center">
                            <MessageCircle className="w-4 h-4 text-[#E0FE10]" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white">Post Your Intro</div>
                            <div className="text-[10px] text-zinc-500">Let the club know who you are</div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-4">
                        <div className="text-xs text-zinc-500 mb-2">Nia&apos;s profile</div>
                        <div className="space-y-2 text-sm">
                            {NIA_ANSWERS.map((a, i) => (
                                <div key={i} className="flex items-center gap-2 text-zinc-300">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#E0FE10]" />{a}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="w-full h-24 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 px-4 py-3 text-sm text-white">
                        Hey everyone! I run for clarity and community. Old Fourth Ward runner training for my first 5K. Looking forward to Saturday! 🏃‍♀️
                    </div>
                    <motion.div animate={posted ? { scale: [1, 0.95, 1] } : {}}
                        className={`mt-3 w-full rounded-2xl px-4 py-3.5 text-sm font-black uppercase tracking-[0.2em] text-center ${
                            posted ? 'bg-green-500 text-white' : 'bg-[#E0FE10] text-black'}`}>
                        {posted ? '✓ Posted!' : 'Post Intro & Join Club'}
                    </motion.div>
                    {posted && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-center">
                            <div className="text-xs text-zinc-400">Welcome to Wunna Run Club, Nia 🎉</div>
                        </motion.div>
                    )}
                </div>
            </PhoneFrame>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────
// ACT 3 — BEFORE THE RUN
// ─────────────────────────────────────────────────────────

const SceneBuddyMatch: React.FC = () => {
    const [phase, setPhase] = useState<'notif' | 'profile' | 'accepted'>('notif');
    useEffect(() => {
        setTimeout(() => setPhase('profile'), 2500);
        setTimeout(() => setPhase('accepted'), 5500);
    }, []);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center px-6">
            <PhoneFrame borderColor="rgba(56,189,248,0.2)" glowColor="rgba(56,189,248,0.08)">
                <AnimatePresence mode="wait">
                    {phase === 'notif' && (
                        <motion.div key="notif" exit={{ opacity: 0, scale: 0.95 }} className="flex-1 flex flex-col">
                            <div className="text-center py-10">
                                <div className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Friday, March 20</div>
                                <div className="text-6xl font-thin text-white tracking-tight">7:22</div>
                                <div className="text-xs text-[#38BDF8]/60 mt-2 font-medium uppercase tracking-wider">Run Day — Tomorrow</div>
                            </div>
                            <motion.div initial={{ opacity: 0, y: -60, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.8 }}
                                className="mx-4 mb-4 rounded-2xl p-3.5" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}>
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#38BDF8]/15 flex items-center justify-center flex-shrink-0">
                                        <UserRoundPlus className="w-5 h-5 text-[#38BDF8]" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-[10px] font-bold text-[#38BDF8] uppercase tracking-wider">Wunna Run Club</span>
                                            <span className="text-[10px] text-zinc-500">now</span>
                                        </div>
                                        <p className="text-xs font-bold text-white mb-0.5">You&apos;ve been matched with a buddy!</p>
                                        <p className="text-[11px] text-zinc-300 leading-snug">Tap to see your match →</p>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                    {(phase === 'profile' || phase === 'accepted') && (
                        <motion.div key="profile" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 px-5 py-4">
                            <div className="text-[10px] text-[#38BDF8] font-bold uppercase tracking-[0.3em] mb-4">Buddy Match</div>
                            {/* Jules Profile */}
                            <div className="flex flex-col items-center mb-5">
                                <div className="w-20 h-20 rounded-full bg-[#38BDF8]/15 border-2 border-[#38BDF8]/30 flex items-center justify-center mb-3">
                                    <span className="text-3xl font-bold text-[#38BDF8]">J</span>
                                </div>
                                <div className="text-xl font-bold text-white">Jules M.</div>
                                <div className="text-xs text-zinc-400 mt-0.5">Old Fourth Ward • BeltLine Eastside</div>
                            </div>
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-2 mb-5">
                                {[{ label: 'Avg Pace', value: '9:02/mi' }, { label: 'Weekly Miles', value: '12.4' }, { label: 'Runs', value: '23' }].map(s => (
                                    <div key={s.label} className="rounded-xl bg-zinc-800/60 border border-zinc-700/30 p-3 text-center">
                                        <div className="text-sm font-bold text-white">{s.value}</div>
                                        <div className="text-[9px] text-zinc-500 uppercase tracking-wider">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                            {/* Match reasons */}
                            <div className="rounded-xl border border-[#38BDF8]/15 bg-[#38BDF8]/5 p-3 mb-5 space-y-1.5">
                                {['Similar pace (~9:00/mi)', 'Same neighborhood', 'Saturday morning runner', 'Accountability style match'].map(r => (
                                    <div key={r} className="flex items-center gap-2 text-xs text-zinc-300">
                                        <CheckCircle2 className="w-3 h-3 text-[#38BDF8] flex-shrink-0" />{r}
                                    </div>
                                ))}
                            </div>
                            {/* Accept button */}
                            <motion.div animate={phase === 'accepted' ? { scale: [1, 0.95, 1] } : {}}
                                className={`w-full rounded-2xl px-4 py-3.5 text-sm font-black uppercase tracking-[0.2em] text-center transition-all ${
                                    phase === 'accepted' ? 'bg-green-500 text-white' : 'bg-[#38BDF8] text-black'}`}>
                                {phase === 'accepted' ? '✓ Paired!' : 'Accept Pairing'}
                            </motion.div>
                            {phase === 'accepted' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-center text-xs text-zinc-400">
                                    Meet at the warm-up circle • 8:20 AM
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </PhoneFrame>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="mt-4 text-xs text-zinc-500 uppercase tracking-widest text-center max-w-md">
                Someone is expecting her. That&apos;s the difference between a 40% and 75% show rate.
            </motion.div>
        </motion.div>
    );
};

const PRE_RUN_MESSAGES = [
    { name: 'Tremaine', text: 'Route is locked in — BeltLine East to Piedmont Park, 5K loop. See y\'all at the warm-up circle 🔥', delay: 600 },
    { name: 'Marcus', text: 'Ready for tomorrow! Who\'s in pace group B?', delay: 1800 },
    { name: 'Jules', text: 'So excited! First Wunna Run. Nia — see you at the warm-up circle! 🙌', delay: 3000 },
    { name: 'Aisha', text: 'Anyone coming in from out of town? Got a friend flying in from Houston for this 🤯', delay: 4200 },
    { name: 'Nia', text: 'Can\'t wait!! See you all in the morning 🏃‍♀️', delay: 5500, isNia: true },
];

const SceneClubChat: React.FC = () => {
    const [msgs, setMsgs] = useState<typeof PRE_RUN_MESSAGES>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const timers = PRE_RUN_MESSAGES.map((m) => setTimeout(() => setMsgs(prev => [...prev, m]), m.delay));
        return () => timers.forEach(clearTimeout);
    }, []);
    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs]);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center px-6">
            <PhoneFrame>
                <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] text-[#E0FE10] font-bold uppercase tracking-[0.3em]">Wunna Run Club</div>
                        <div className="text-xs text-zinc-500 mt-0.5">Friday Night • Run Day Eve</div>
                    </div>
                    <div className="rounded-full bg-[#E0FE10]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#E0FE10]">Live</div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {msgs.map((m, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${m.isNia ? 'justify-end' : ''}`}>
                            {!m.isNia && (
                                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                                    style={{ backgroundColor: m.name === 'Tremaine' ? 'rgba(224,254,16,0.15)' : 'rgba(255,255,255,0.08)', color: m.name === 'Tremaine' ? '#E0FE10' : '#a1a1aa' }}>
                                    {m.name[0]}
                                </div>
                            )}
                            <div className={`rounded-2xl px-3.5 py-2.5 max-w-[80%] ${m.isNia ? 'bg-[#38BDF8]/10 border border-[#38BDF8]/20' : 'bg-zinc-800/60 border border-zinc-700/30'}`}>
                                {!m.isNia && <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">{m.name}</div>}
                                <div className={`text-sm leading-relaxed ${m.isNia ? 'text-[#38BDF8]/90' : 'text-zinc-200'}`}>{m.text}</div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </PhoneFrame>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────
// ACT 4 — RUN DAY
// ─────────────────────────────────────────────────────────

const SceneQRCheckin: React.FC = () => {
    const [scanned, setScanned] = useState(false);
    useEffect(() => { setTimeout(() => setScanned(true), 2000); }, []);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center px-6">
            <PhoneFrame borderColor="rgba(52,211,153,0.2)" glowColor="rgba(52,211,153,0.08)">
                <div className="flex-1 px-5 py-4">
                    <div className="text-center mb-4">
                        <div className="text-[10px] text-[#E0FE10] font-bold uppercase tracking-[0.3em]">Run Day</div>
                        <div className="text-lg font-bold text-white mt-1">Saturday, March 21 • 8:15 AM</div>
                    </div>
                    <AnimatePresence mode="wait">
                        {!scanned ? (
                            <motion.div key="scan" exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center py-6">
                                <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
                                    className="w-48 h-48 rounded-2xl border-2 border-dashed border-[#E0FE10]/30 flex items-center justify-center mb-4"
                                    style={{ background: 'rgba(224,254,16,0.03)' }}>
                                    <QrCode className="w-20 h-20 text-[#E0FE10]/40" />
                                </motion.div>
                                <div className="text-sm text-zinc-400">Scanning QR code at entrance...</div>
                            </motion.div>
                        ) : (
                            <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                                <div className="rounded-2xl border border-green-500/25 bg-green-500/5 p-5 text-center">
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}>
                                        <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-2" />
                                    </motion.div>
                                    <div className="text-lg font-bold text-white">Checked In!</div>
                                    <div className="text-xs text-zinc-400 mt-1">In-person attendance confirmed • +50 bonus pts</div>
                                    <div className="flex items-center justify-center gap-2 mt-3">
                                        <div className="px-3 py-1 rounded-full bg-[#E0FE10]/10 border border-[#E0FE10]/20 text-[10px] font-bold text-[#E0FE10]">🏅 In-Person Badge</div>
                                    </div>
                                </div>
                                {/* Buddy card */}
                                <div className="rounded-2xl border border-[#38BDF8]/20 bg-[#38BDF8]/5 p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#38BDF8]/15 flex items-center justify-center">
                                            <span className="text-sm font-bold text-[#38BDF8]">J</span></div>
                                        <div>
                                            <div className="text-sm font-bold text-white">Jules M. <span className="text-green-400 text-xs">✓ Checked in</span></div>
                                            <div className="text-xs text-zinc-400">Warm-up circle • 8:20 AM</div>
                                        </div>
                                    </div>
                                </div>
                                {/* Pace group */}
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                    <div className="text-[10px] text-[#E0FE10] font-bold uppercase tracking-wider mb-2">Your Pace Group</div>
                                    <div className="text-sm font-bold text-white mb-1">Group B — BeltLine East → Piedmont Park</div>
                                    <div className="text-xs text-zinc-400">5K • 6 runners • ~9:00/mi pace</div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </PhoneFrame>
        </motion.div>
    );
};

const SceneWorldMap: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-6">
        <div className="h-full flex flex-col">
            <div className="text-center mb-4">
                <div className="text-[10px] text-[#38BDF8] font-bold uppercase tracking-[0.3em]">Track 2 — Global</div>
                <h3 className="text-2xl font-black text-white mt-1">Runners Around the World</h3>
            </div>
            <div className="flex-1"><WorldMap showRunners showMileage mileageGoal={500} /></div>
        </div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────
// ACT 5 — RUN WITH GUNNA
// ─────────────────────────────────────────────────────────

const SceneVoiceNote: React.FC = () => {
    const [playing, setPlaying] = useState(false);
    useEffect(() => { setTimeout(() => setPlaying(true), 1500); }, []);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center px-6">
            <PhoneFrame borderColor="rgba(139,92,246,0.2)" glowColor="rgba(139,92,246,0.08)">
                <div className="px-5 py-4 border-b border-white/8">
                    <div className="text-[10px] text-[#E0FE10] font-bold uppercase tracking-[0.3em]">Wunna Run Club</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Wednesday Night</div>
                </div>
                <div className="flex-1 px-4 py-6 flex flex-col items-center justify-center">
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                        className="w-full max-w-[320px] rounded-2xl border border-purple-500/25 bg-purple-500/5 p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                                <span className="text-lg">🎤</span>
                            </div>
                            <div>
                                <div className="text-sm font-bold text-white">Gunna</div>
                                <div className="text-[10px] text-purple-400 uppercase tracking-wider">Voice Note</div>
                            </div>
                        </div>
                        {/* Waveform */}
                        <div className="flex items-center gap-1 mb-3 h-8">
                            {Array.from({ length: 32 }).map((_, i) => (
                                <motion.div key={i} className="w-1 rounded-full bg-purple-400"
                                    animate={playing ? { height: [4, Math.random() * 24 + 8, 4] } : { height: 4 }}
                                    transition={{ duration: 0.5, repeat: playing ? Infinity : 0, delay: i * 0.05, repeatType: 'reverse' }} />
                            ))}
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed italic">
                            &quot;Yo, Wunna Run gang — I&apos;m going on a run tomorrow morning. 9 AM. I want y&apos;all running with me. Wherever you are in the world, open Pulse at 9 AM and we run together. Let&apos;s go.&quot;
                        </p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }}
                        className="mt-6 rounded-2xl border border-[#E0FE10]/20 bg-[#E0FE10]/5 px-6 py-4 text-center">
                        <div className="text-[10px] text-[#E0FE10] font-bold uppercase tracking-[0.3em] mb-1">Event Created</div>
                        <div className="text-lg font-black text-white">Run With Gunna</div>
                        <div className="text-xs text-zinc-400 mt-1">Tomorrow • 9:00 AM • Global</div>
                        <div className="text-sm font-bold text-[#E0FE10] mt-2">847 RSVPs</div>
                    </motion.div>
                </div>
            </PhoneFrame>
        </motion.div>
    );
};

const SceneGlobalRun: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-6 relative">
        <div className="h-full flex flex-col">
            <div className="text-center mb-4">
                <div className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.3em]">Run With Gunna</div>
                <h3 className="text-2xl font-black text-white mt-1">The World Is Running</h3>
            </div>
            <div className="flex-1"><WorldMap showRunners showMileage mileageGoal={2000} showFundraising showGunna /></div>
        </div>
        {/* Fundraising note */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3 }}
            className="absolute top-16 left-8 max-w-[260px] rounded-xl bg-black/60 backdrop-blur-xl border border-green-500/15 px-4 py-3">
            <div className="text-[9px] text-green-400 font-bold uppercase tracking-[0.25em] mb-1">Fundraising Model</div>
            <p className="text-[11px] text-zinc-400 leading-snug">Every mile converts to dollars raised. Sponsors pledge $12.50/mile logged. Donation total climbs in real time alongside mileage.</p>
        </motion.div>
    </motion.div>
);

const SceneGoalReached: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center px-8 relative overflow-hidden">
        {/* Celebration particles */}
        {Array.from({ length: 30 }).map((_, i) => (
            <motion.div key={i} className="absolute w-2 h-2 rounded-full"
                style={{ background: ['#E0FE10', '#38BDF8', '#A78BFA', '#FB7185', '#34D399'][i % 5], left: `${Math.random() * 100}%`, top: '-5%' }}
                animate={{ y: [0, window?.innerHeight ? window.innerHeight + 50 : 900], x: [0, (Math.random() - 0.5) * 200], rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)] }}
                transition={{ duration: 3 + Math.random() * 2, delay: Math.random() * 1.5, repeat: Infinity }} />
        ))}
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.3 }}
            className="text-7xl mb-6">🏆</motion.div>
        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="text-5xl font-black text-white text-center mb-4">GOAL REACHED</motion.h2>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="text-center">
            <div className="text-4xl font-black text-[#E0FE10]"><AnimatedCounter end={2000} duration={2} suffix=" miles" /></div>
            <div className="text-2xl font-bold text-green-400 mt-2"><AnimatedCounter end={25000} duration={2.5} prefix="$" suffix=" raised" /></div>
            <p className="text-zinc-400 mt-4 max-w-md">847 runners. 6 continents. One community. The whole app lights up.</p>
        </motion.div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────
// ACT 6 — POINTS & LEADERBOARD
// ─────────────────────────────────────────────────────────

const SceneLeaderboard: React.FC<{ data: typeof LEADERBOARD; title?: string }> = ({ data, title = 'Wunna Run Leaderboard' }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-lg">
            <div className="text-center mb-6">
                <Trophy className="w-8 h-8 text-[#E0FE10] mx-auto mb-2" />
                <h3 className="text-xl font-black text-white">{title}</h3>
            </div>
            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                {data.map((r, i) => (
                    <motion.div key={r.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                        className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 ${r.isNia ? 'bg-[#38BDF8]/8 border-l-2 border-l-[#38BDF8]' : ''}`}>
                        <div className={`w-7 text-center font-bold text-sm ${r.rank <= 3 ? 'text-white' : 'text-zinc-500'}`}>
                            {r.rank === 1 ? '👑' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`}
                        </div>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{ backgroundColor: `${r.color}20`, color: r.color }}>{r.avatar}</div>
                        <div className="flex-1">
                            <div className={`text-sm font-medium ${r.isNia ? 'text-[#38BDF8]' : 'text-white'}`}>
                                {r.name} {r.isNia && <span className="text-[10px] text-[#38BDF8]/60">← Nia</span>}
                            </div>
                        </div>
                        <div className="text-sm font-bold text-zinc-300">{r.pts.toLocaleString()} pts</div>
                    </motion.div>
                ))}
            </div>
        </div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────
// ACT 7 — THE CROWN (Nia Climbs)
// ─────────────────────────────────────────────────────────

const FIXED_ROSTER = [
    { name: 'Marcus T.', pts: 4380, avatar: 'MT', color: '#FFD700' },
    { name: 'Jade W.', pts: 4290, avatar: 'JW', color: '#C0C0C0' },
    { name: 'Devon R.', pts: 4250, avatar: 'DR', color: '#CD7F32' },
    { name: 'Aisha K.', pts: 4180, avatar: 'AK', color: '#E0FE10' },
    { name: 'Tremaine G.', pts: 4120, avatar: 'TG', color: '#E0FE10' },
    { name: 'Kai L.', pts: 3980, avatar: 'KL', color: '#E0FE10' },
    { name: 'Zara M.', pts: 3850, avatar: 'ZM', color: '#E0FE10' },
    { name: 'Rico P.', pts: 3810, avatar: 'RP', color: '#E0FE10' },
    { name: 'Simone H.', pts: 3750, avatar: 'SH', color: '#E0FE10' },
];

const CLIMB_STAGES = [
    { niaPts: 3900, week: 'Week 4' },
    { niaPts: 4200, week: 'Week 7' },
    { niaPts: 4350, week: 'Week 10' },
    { niaPts: 4420, week: 'Week 12' },
];

const SceneNiaClimb: React.FC = () => {
    const [stageIdx, setStageIdx] = useState(0);
    const [showFireworks, setShowFireworks] = useState(false);

    useEffect(() => {
        const t1 = setTimeout(() => setStageIdx(1), 2000);
        const t2 = setTimeout(() => setStageIdx(2), 3800);
        const t3 = setTimeout(() => setStageIdx(3), 5600);
        const t4 = setTimeout(() => setShowFireworks(true), 6400);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }, []);

    const niaPts = CLIMB_STAGES[stageIdx].niaPts;
    const week = CLIMB_STAGES[stageIdx].week;
    const niaEntry = { name: 'Nia W.', pts: niaPts, avatar: 'NW', color: '#38BDF8', isNia: true as const };
    const board = [...FIXED_ROSTER.map(r => ({ ...r, isNia: false as const })), niaEntry]
        .sort((a, b) => b.pts - a.pts)
        .map((r, i) => ({ ...r, rank: i + 1 }));
    const niaRank = board.find(r => r.isNia)?.rank || 7;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="h-full flex flex-col items-center justify-center px-6 relative overflow-hidden">
            {showFireworks && Array.from({ length: 50 }).map((_, i) => {
                const dx = (Math.random() - 0.5) * 800;
                const dy = (Math.random() - 0.5) * 600;
                const sz = Math.random() * 8 + 3;
                const dl = Math.random() * 0.3;
                const dr = Math.random() * 720;
                const du = 2 + Math.random();
                return (
                    <motion.div key={`fw-${i}`} className="absolute rounded-full"
                        style={{ width: sz, height: sz, background: ['#E0FE10','#38BDF8','#FFD700','#FB7185','#A78BFA','#34D399'][i % 6], left: '50%', top: '40%' }}
                        initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                        animate={{ x: dx, y: dy, opacity: [1, 1, 0], scale: [0, 1.5, 0.5], rotate: dr }}
                        transition={{ duration: du, delay: dl, ease: 'easeOut' }} />
                );
            })}
            {showFireworks && (
                <motion.div className="absolute inset-0 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(255,215,0,0.12) 0%, transparent 60%)' }} />
            )}
            <div className="w-full max-w-lg relative z-10">
                <div className="text-center mb-5">
                    {showFireworks ? (
                        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring' }}>
                            <Crown className="w-10 h-10 text-[#FFD700] mx-auto mb-2" />
                        </motion.div>
                    ) : (
                        <TrendingUp className="w-8 h-8 text-[#E0FE10] mx-auto mb-2" />
                    )}
                    <h3 className="text-xl font-black text-white">Nia&apos;s Rise</h3>
                    <motion.div key={week} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                        className="mt-2 inline-block rounded-full bg-[#E0FE10]/10 border border-[#E0FE10]/20 px-4 py-1.5">
                        <span className="text-xs font-bold text-[#E0FE10]">{week}</span>
                        <span className="text-xs text-zinc-400 ml-2">Rank #{niaRank}</span>
                    </motion.div>
                </div>
                <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {board.map((r) => (
                        <motion.div key={r.name} layout transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/5 ${
                                r.isNia && r.rank === 1 ? 'bg-[#FFD700]/10 border-l-2 border-l-[#FFD700]' :
                                r.isNia ? 'bg-[#38BDF8]/8 border-l-2 border-l-[#38BDF8]' : ''}`}>
                            <div className={`w-7 text-center font-bold text-sm ${r.rank <= 3 ? 'text-white' : 'text-zinc-500'}`}>
                                {r.rank === 1 ? '\ud83d\udc51' : r.rank === 2 ? '\ud83e\udd48' : r.rank === 3 ? '\ud83e\udd49' : `#${r.rank}`}
                            </div>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold"
                                style={{ backgroundColor: `${r.isNia && r.rank === 1 ? '#FFD700' : r.color}20`, color: r.isNia && r.rank === 1 ? '#FFD700' : r.color }}>
                                {r.avatar}
                            </div>
                            <div className="flex-1">
                                <div className={`text-sm font-medium ${r.isNia && r.rank === 1 ? 'text-[#FFD700] font-bold' : r.isNia ? 'text-[#38BDF8]' : 'text-white'}`}>
                                    {r.name} {r.isNia && <span className="text-[10px] opacity-60">&larr; Nia</span>}
                                </div>
                            </div>
                            <div className="text-sm font-bold text-zinc-400">{r.pts.toLocaleString()} pts</div>
                        </motion.div>
                    ))}
                </div>
                <motion.div key={stageIdx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-center">
                    <div className="text-xs text-zinc-500">
                        {showFireworks ? (
                            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="text-[#FFD700] font-bold text-sm">{'\ud83c\udfc6'} Nia claims the top spot!</motion.span>
                        ) : (
                            <span><ChevronUp className="w-3 h-3 inline text-[#E0FE10]" /> {niaPts.toLocaleString()} points</span>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};



const SceneStageMoment: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center px-8 relative overflow-hidden">
        {/* Spotlights */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(224,254,16,0.08) 0%, transparent 60%)' }} />
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.3 }}>
            <Crown className="w-20 h-20 text-[#FFD700] mb-6" />
        </motion.div>
        <motion.h2 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="text-5xl md:text-6xl font-black text-center mb-4">
            <span className="text-[#FFD700]">Nia</span> <span className="text-white">is crowned</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
            className="text-lg text-zinc-400 text-center max-w-md leading-relaxed">
            The Wunna Run finale. Her name gets called. The whole community is there.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }}
            className="mt-8 flex flex-col gap-3 items-center">
            <div className="rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/5 px-8 py-4 text-center">
                <div className="text-sm text-[#FFD700] font-bold">🏆 Crowned Wunna Run Champion</div>
            </div>
            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 px-8 py-4 text-center">
                <div className="text-sm text-purple-300 font-bold">🎤 Backstage Meet &amp; Greet with Gunna</div>
                <div className="text-xs text-zinc-500 mt-1">Something you can&apos;t buy. Something you have to run for.</div>
            </div>
        </motion.div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────
// ACT 8 — OPERATOR CONSOLE
// ─────────────────────────────────────────────────────────

const SceneOperatorDashboard: React.FC = () => {
    const [showStats, setShowStats] = useState(false);
    const [showRoster, setShowRoster] = useState(false);
    useEffect(() => { setTimeout(() => setShowStats(true), 500); setTimeout(() => setShowRoster(true), 1200); }, []);
    const statusDot = (s: string) => s === 'Introduced' || s === 'Paired' ? 'bg-green-400' : s === 'Onboarded' ? 'bg-[#E0FE10]' : s === 'Needs Intro' ? 'bg-orange-400' : 'bg-zinc-600';
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex">
            {/* Sidebar */}
            <motion.aside initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                className="w-[220px] flex-shrink-0 border-r border-zinc-800/60 flex flex-col py-4 px-3"
                style={{ background: 'linear-gradient(180deg, rgba(17,17,19,0.95) 0%, rgba(10,10,11,0.98) 100%)' }}>
                <div className="flex items-center gap-2 px-2 mb-6">
                    <div className="w-7 h-7 rounded-lg bg-[#E0FE10]/15 flex items-center justify-center"><Radio className="w-4 h-4 text-[#E0FE10]" /></div>
                    <div><div className="text-sm font-bold text-white">Wunna Run</div><div className="text-[8px] text-zinc-500 uppercase tracking-widest">Operator Console</div></div>
                </div>
                <nav className="flex-1 space-y-0.5">
                    {[{ icon: Home, label: 'Home' }, { icon: Users, label: 'Members', badge: '8' }, { icon: HeartHandshake, label: 'Pairings' },
                      { icon: Globe, label: 'Global Events' }, { icon: BarChart3, label: 'Analytics' }, { icon: DollarSign, label: 'Fundraising' },
                      { icon: Settings, label: 'Settings' }].map((item, i) => (
                        <div key={item.label} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm ${i === 1 ? 'bg-[#E0FE10]/10 text-[#E0FE10] font-medium' : 'text-zinc-500'}`}>
                            <item.icon className="w-4 h-4" /><span>{item.label}</span>
                            {item.badge && <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-[#E0FE10]/15 text-[#E0FE10] font-bold">{item.badge}</span>}
                        </div>
                    ))}
                </nav>
            </motion.aside>
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                <div className="text-white font-medium text-sm">Member Activation</div>
                {showStats && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-3">
                        {[{ label: "RSVP'd", value: '42' }, { label: 'Joined', value: '38' }, { label: 'Onboarded', value: '34' }, { label: 'Paired', value: '28' }].map(s => (
                            <div key={s.label} className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 text-center">
                                <div className="text-2xl font-bold text-white">{s.value}</div>
                                <div className="text-[10px] uppercase tracking-wider text-zinc-500">{s.label}</div>
                            </div>
                        ))}
                    </motion.div>
                )}
                {showRoster && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="rounded-xl border border-zinc-700/30 overflow-hidden">
                            <div className="grid grid-cols-[1fr_90px_1fr_80px_80px] text-[10px] font-bold text-zinc-500 uppercase tracking-wide px-3 py-2 bg-zinc-800/60 border-b border-zinc-700/30">
                                <div>Name</div><div>Status</div><div>Goal</div><div>Area</div><div>Paired</div>
                            </div>
                            {MEMBER_ROSTER.map((m, i) => (
                                <motion.div key={m.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                                    className="grid grid-cols-[1fr_90px_1fr_80px_80px] items-center px-3 py-2.5 border-b border-zinc-800/50 text-sm hover:bg-zinc-800/40">
                                    <div className="font-medium text-white">{m.name}</div>
                                    <div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${statusDot(m.status)}`} /><span className="text-xs" style={{ color: m.color }}>{m.status}</span></div>
                                    <div className="text-xs text-zinc-400">{m.goal}</div>
                                    <div className="text-xs text-zinc-500 truncate">{m.neighborhood}</div>
                                    <div className="text-xs">{m.paired ? <span className="text-green-400">{m.pairName}</span> : <span className="text-zinc-600">—</span>}</div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};

const SceneAnalytics: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-6">
        <div className="h-full flex flex-col gap-6">
            <div className="text-center">
                <div className="text-[10px] text-[#E0FE10] font-bold uppercase tracking-[0.3em]">Operator Console</div>
                <h3 className="text-xl font-black text-white mt-1">Run With Gunna — Analytics</h3>
            </div>
            <div className="grid grid-cols-4 gap-3">
                {[{ label: 'Participants', value: '847', icon: Users }, { label: 'Miles Logged', value: '2,147', icon: Activity },
                  { label: 'Funds Raised', value: '$25,000', icon: DollarSign }, { label: 'Top Market', value: 'London', icon: Globe }].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-4 text-center">
                        <s.icon className="w-5 h-5 text-[#E0FE10] mx-auto mb-2" />
                        <div className="text-xl font-bold text-white">{s.value}</div>
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">{s.label}</div>
                    </motion.div>
                ))}
            </div>
            <div className="flex-1"><WorldMap showRunners showMileage={false} /></div>
        </div>
    </motion.div>
);

const SceneClose: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center px-8 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center">
            <Footprints className="w-12 h-12 text-[#E0FE10]/40 mx-auto mb-8" />
            <p className="text-xl text-zinc-300 leading-relaxed mb-8">
                Wunna Run on Pulse is a living community with a real operating system. Every runner is known. Every run compounds. In-person events stay premium. Global participation scales without limits.
            </p>
            <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                className="text-4xl md:text-5xl font-black text-white leading-tight">
                The run is the spark.<br /><span className="text-[#E0FE10]">Pulse is what turns it into a movement.</span>
            </motion.h2>
        </motion.div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────

const WunnaRunDemo: React.FC = () => {
    const [step, setStep] = useState(0);

    const advance = useCallback(() => {
        setStep(prev => Math.min(prev + 1, TOTAL_STEPS));
    }, []);

    const goBack = useCallback(() => {
        setStep(prev => Math.max(prev - 1, 0));
    }, []);

    // Keyboard navigation — supports clickers (PageDown/PageUp) + arrows + space + enter
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const fwd = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'];
            const bwd = ['ArrowLeft', 'ArrowUp', 'PageUp'];
            if (fwd.includes(e.key)) { e.preventDefault(); advance(); }
            if (bwd.includes(e.key)) { e.preventDefault(); goBack(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [advance, goBack]);

    // Auto-focus the container so clicker events aren't swallowed by the address bar
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => { containerRef.current?.focus(); }, []);

    const meta = STEP_META[step] || { act: '', label: '' };

    const renderScene = () => {
        switch (step) {
            case 0: return <SceneIntroTitle />;
            case 1: return <SceneMeetNia />;
            case 2: return <SceneInstagramPost />;
            case 3: return <SceneDownloadPulse />;
            case 4: return <SceneRSVP />;
            case 5: return <SceneOnboarding />;
            case 6: return <SceneIntroPost />;
            case 7: return <SceneBuddyMatch />;
            case 8: return <SceneClubChat />;
            case 9: return <SceneQRCheckin />;
            case 10: return <SceneWorldMap />;
            case 11: return <SceneVoiceNote />;
            case 12: return <SceneGlobalRun />;
            case 13: return <SceneGoalReached />;
            case 14: return <SceneLeaderboard data={LEADERBOARD} />;
            case 15: return <SceneNiaClimb />;
            case 16: return <SceneStageMoment />;
            case 17: return <SceneOperatorDashboard />;
            case 18: return <SceneAnalytics />;
            case 19: return <SceneClose />;
            default: return <SceneIntroTitle />;
        }
    };

    return (
        <>
            <Head>
                <title>Wunna Run Demo — Pulse</title>
                <meta name="description" content="Interactive demo: Pulse × Wunna Run. From first post to crowned champion." />
            </Head>
            <div ref={containerRef} tabIndex={0} className="fixed inset-0 bg-[#0a0a0b] flex flex-col overflow-hidden cursor-pointer select-none outline-none" onClick={advance}>
                {/* Noise texture */}
                <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />

                {/* Progress bar */}
                <div className="absolute top-0 left-0 right-0 z-30 h-1.5 bg-zinc-800">
                    <motion.div className="h-full bg-gradient-to-r from-[#E0FE10] to-[#38BDF8]"
                        animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                        transition={{ duration: 0.5 }} />
                </div>

                {/* Step indicator */}
                {step > 0 && (
                    <div className="absolute top-4 right-6 z-30 flex items-center gap-3">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                            {meta.act !== 'intro' && meta.act !== 'close' ? `Act ${meta.act}` : meta.act === 'close' ? 'Close' : ''} — {meta.label}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); goBack(); }}
                            className="w-7 h-7 rounded-full bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center hover:bg-zinc-700/60 transition-all">
                            <ChevronLeft className="w-3 h-3 text-zinc-400" />
                        </button>
                    </div>
                )}

                {/* Main content */}
                <main className="flex-1 relative z-10 overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div key={step} className="h-full">
                            {renderScene()}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </>
    );
};

export default WunnaRunDemo;
