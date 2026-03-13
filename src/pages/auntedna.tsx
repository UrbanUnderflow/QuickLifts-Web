import React, { useEffect, useState, useCallback, useRef } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
    Bell, Shield, Brain, Heart, Activity, TrendingDown, TrendingUp,
    BookOpen, Trophy, Users, ChevronLeft, ChevronUp, Plug, Building2,
    GraduationCap, Handshake, DollarSign, Target, ArrowRight,
    MessageCircle, FileText, Calendar, AlertTriangle, Lock,
    Stethoscope, BarChart3, Globe, Award, Home, LogOut, ChevronRight, Pill,
} from 'lucide-react';

const TOTAL_STEPS = 11;

const STEP_META: Record<number, { section: string; label: string }> = {
    0: { section: 'intro', label: 'Title' },
    1: { section: 'intro', label: 'Notification' },
    2: { section: 'act1', label: "Maya's Profile" },
    3: { section: 'act1', label: 'The Stat' },
    4: { section: 'act1', label: 'The API' },
    5: { section: 'act2', label: 'Handoff' },
    6: { section: 'act2', label: 'Outcome' },
    7: { section: 'act3', label: 'Traction' },
    8: { section: 'act3', label: 'Unit Economics' },
    9: { section: 'act3', label: 'Path to $100M' },
    10: { section: 'act3', label: 'The Ask' },
    11: { section: 'close', label: 'CTA' },
};

// ─────────────────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────────────────

const AEBadge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = '#F472B6' }) => (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
        style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>{children}</span>
);

// ─────────────────────────────────────────────────────────
// STEP 0 — TITLE
// ─────────────────────────────────────────────────────────

const SceneTitle: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className="text-6xl mb-4">🧠</div>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-3">
                aunt<span style={{ background: 'linear-gradient(135deg, #F472B6, #EC4899, #DB2777)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EDNA</span><span className="text-white/30">.ai</span>
            </h1>
            <p className="text-lg text-zinc-400 max-w-xl mx-auto mt-4">AI-Powered Access to Care</p>
        </motion.div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────
// STEP 1 — THE NOTIFICATION (Phone Lock Screen)
// ─────────────────────────────────────────────────────────

const SceneNotification: React.FC = () => {
    const [showNotif, setShowNotif] = useState(false);
    useEffect(() => { const t = setTimeout(() => setShowNotif(true), 1500); return () => clearTimeout(t); }, []);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="h-full flex flex-col items-center justify-center px-6">
            {/* Phone frame */}
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="relative w-[393px] h-[852px] rounded-[40px] overflow-hidden border-2 border-[#FBBF24]/30 shadow-2xl"
                style={{
                    background: 'linear-gradient(180deg, #111113 0%, #0a0a0b 100%)',
                    boxShadow: '0 0 60px rgba(251,191,36,0.1), 0 20px 40px rgba(0,0,0,0.5)',
                }}>
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
                    <div className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Wednesday, March 12</div>
                    <div className="text-6xl font-thin text-white tracking-tight">8:47</div>
                    <div className="text-xs text-zinc-500 mt-2 font-medium uppercase tracking-wider">Office Hours</div>
                </div>

                {/* Clinical Alert Notification */}
                <AnimatePresence>
                    {showNotif && (
                        <motion.div
                            initial={{ opacity: 0, y: -60, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="mx-4 mb-6 rounded-2xl p-3.5 relative overflow-hidden"
                            style={{
                                background: 'rgba(251,191,36,0.12)',
                                backdropFilter: 'blur(40px)',
                                border: '1px solid rgba(251,191,36,0.3)',
                            }}>
                            <div className="flex items-start gap-3 relative z-10">
                                <div className="relative flex-shrink-0 mt-0.5">
                                    <div className="w-10 h-10 rounded-xl bg-[#FBBF24]/25 flex items-center justify-center">
                                        <Shield className="w-5 h-5 text-[#FBBF24]" />
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#FBBF24] animate-pulse" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-[10px] font-black text-[#FBBF24] uppercase tracking-wider">⚠ Clinical Alert — Elevated</span>
                                        <span className="text-[10px] text-zinc-500">now</span>
                                    </div>
                                    <p className="text-xs font-bold text-white mb-0.5">AuntEdna — Clinical Escalation</p>
                                    <p className="text-[11px] text-zinc-300 leading-snug">
                                        Maya Thompson has been flagged for clinical attention. Tap to review full briefing.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: showNotif ? 1 : 0 }} transition={{ delay: 0.5 }}
                    className="text-center pb-6">
                    <span className="text-[9px] text-[#FBBF24]/50 uppercase tracking-widest">
                        Clinical Alert • Bypasses Do Not Disturb
                    </span>
                </motion.div>
            </motion.div>

            {/* Context label */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="mt-6 text-center">
                <div className="text-xs text-zinc-500 uppercase tracking-widest">
                    Dr. Keisha Williams — Licensed Sports Psychologist
                </div>
            </motion.div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────
// STEP 2 — MAYA'S FULL PROFILE (Full Clinician Dashboard)
// ─────────────────────────────────────────────────────────

const SceneMayaProfile: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="h-full overflow-y-auto py-6 px-4">
        <div className="flex gap-0 pb-12" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* ── Sidebar ── */}
            <motion.aside initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
                className="w-56 shrink-0 rounded-2xl border border-zinc-700/40 mr-5 flex flex-col overflow-hidden"
                style={{ background: 'linear-gradient(180deg, rgba(230,126,34,0.05) 0%, rgba(15,15,18,0.95) 100%)' }}>
                <div className="px-4 pt-5 pb-3 border-b border-zinc-800/60">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#E67E22]/15 border border-[#E67E22]/20 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-[#E67E22]" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white">AuntEdna</div>
                            <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Clinical Platform</div>
                        </div>
                    </div>
                </div>
                <div className="px-4 py-4 border-b border-zinc-800/60">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F472B6]/30 to-[#E67E22]/20 border border-[#F472B6]/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-[#F472B6]">KW</span>
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-white">Dr. Keisha Williams</div>
                            <div className="text-[10px] text-zinc-500">Licensed Sports Psychologist</div>
                            <div className="text-[9px] text-[#F472B6]/70">Staff Clinician</div>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 px-2 py-3 space-y-0.5">
                    {[
                        { icon: Home, label: 'Home', active: false },
                        { icon: Users, label: 'Patients', active: true, badge: '5' },
                        { icon: Pill, label: 'Care Plans', active: false },
                        { icon: Building2, label: 'Programs', active: false },
                        { icon: FileText, label: 'Documents', active: false },
                    ].map((item) => (
                        <div key={item.label}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${item.active
                                ? 'bg-[#E67E22]/15 text-[#E67E22] border border-[#E67E22]/20'
                                : 'text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300 border border-transparent'}`}>
                            <item.icon className={`w-4 h-4 ${item.active ? 'text-[#E67E22]' : ''}`} />
                            <span className="text-sm font-medium">{item.label}</span>
                            {item.badge && (
                                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-[#FBBF24]/20 text-[#FBBF24] border border-[#FBBF24]/25 font-bold">
                                    {item.badge}
                                </span>
                            )}
                        </div>
                    ))}
                </nav>
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
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-500">Patients</span>
                        <ChevronRight className="w-3 h-3 text-zinc-600" />
                        <span className="text-sm text-white font-medium">M. Thompson</span>
                    </div>
                    <span className="text-xs px-3 py-1.5 rounded-full bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/25 font-bold animate-pulse">
                        ELEVATED
                    </span>
                </div>

                {/* Player Profile Card */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="rounded-2xl border border-zinc-700/40 p-5"
                    style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.04) 0%, rgba(244,114,182,0.04) 100%)' }}>
                    <div className="flex items-start gap-4 mb-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#F472B6]/25 to-[#E67E22]/25 flex items-center justify-center border border-[#F472B6]/20">
                            <span className="text-xl font-bold text-[#F472B6]">MT</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-white">Maya Thompson</h3>
                            <p className="text-xs text-zinc-500">Guard • Junior • Team Captain • 5&apos;9&quot;</p>
                            <p className="text-xs text-zinc-600 mt-0.5">Escalated: March 12, 2026 at 8:47 AM</p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-[#FBBF24]">6.4</div>
                            <div className="text-[9px] text-zinc-500 uppercase">Distress Score</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { label: 'Resting HR', value: '78 bpm', color: 'text-amber-400', note: '↑ Elevated' },
                            { label: 'HRV', value: '38 ms', color: 'text-[#FBBF24]', note: '↓ Low' },
                            { label: 'Sleep', value: '5.2h', color: 'text-[#FBBF24]', note: '↓ Declining' },
                            { label: 'Stress Index', value: 'High', color: 'text-amber-400', note: '↑ 2 weeks' },
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
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="rounded-2xl border border-[#FBBF24]/20 p-5" style={{ background: 'rgba(251,191,36,0.03)' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-[#FBBF24]" />
                        <h4 className="text-sm font-bold text-white">Flagged Conversation Excerpts</h4>
                        <span className="text-[9px] text-zinc-600 ml-auto">Check-in • 7:30 AM</span>
                    </div>
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#E67E22]/15 flex items-center justify-center shrink-0 mt-0.5">
                                <Brain className="w-3 h-3 text-[#E67E22]" />
                            </div>
                            <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 px-3 py-2 text-sm text-zinc-300">
                                How are you feeling headed into this week?
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/30 px-3 py-2 text-sm text-zinc-200 max-w-[80%]">
                                Honestly? I&apos;m{' '}
                                <span className="bg-[#FBBF24]/20 text-[#FBBF24] px-1 rounded border-b border-[#FBBF24]/50 font-medium">struggling</span>
                                . The rehab has been{' '}
                                <span className="bg-[#FBBF24]/20 text-[#FBBF24] px-1 rounded border-b border-[#FBBF24]/50 font-medium">harder than I expected</span>.
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/30 px-3 py-2 text-sm text-zinc-200 max-w-[80%]">
                                I feel like I&apos;m{' '}
                                <span className="bg-[#FBBF24]/20 text-[#FBBF24] px-1 rounded border-b border-[#FBBF24]/50 font-medium">behind everyone</span>
                                . And now with the NIL stuff,{' '}
                                <span className="bg-[#FBBF24]/20 text-[#FBBF24] px-1 rounded border-b border-[#FBBF24]/50 font-medium">everyone&apos;s watching</span>.
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 rounded-xl bg-zinc-900/60 border border-zinc-700/20 p-3">
                        <div className="text-[9px] text-[#FBBF24] uppercase font-bold tracking-wider mb-1">AI Sentiment Analysis</div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div><div className="text-sm font-bold text-[#FBBF24]">Elevated</div><div className="text-[9px] text-zinc-500">Severity</div></div>
                            <div><div className="text-sm font-bold text-[#FBBF24]">4 Keywords</div><div className="text-[9px] text-zinc-500">Flagged</div></div>
                            <div><div className="text-sm font-bold text-amber-400">Sustained</div><div className="text-[9px] text-zinc-500">14-Day Trend</div></div>
                        </div>
                    </div>
                </motion.div>

                {/* Life Context Cards */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="rounded-2xl border border-zinc-700/40 p-5" style={{ background: 'rgba(59,130,246,0.03)' }}>
                    <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-blue-400" />
                        <h4 className="text-sm font-bold text-white">Life Context</h4>
                        <span className="text-[9px] text-zinc-600 ml-auto">Non-Sport Stressors</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mb-4 leading-relaxed">
                        Active contributors to Maya&apos;s current mental state identified by AuntEdna&apos;s intelligence layer.
                    </p>
                    <div className="space-y-3">
                        {[
                            { icon: '📄', label: 'NIL Deal — Nike Partnership', note: 'Signed Dec 2025. Increased public visibility, social media scrutiny. Maya mentioned feeling "like everyone is watching me fail."', impact: 'Identity Stress', impactColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
                            { icon: '🔄', label: 'Program Transfer — Oregon State → Current', note: 'Transferred after sophomore year. Still adjusting to new coaching staff, team culture, and playbook. Described feeling "like an outsider."', impact: 'Adjustment', impactColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                            { icon: '📚', label: 'Academic Overload — 18 Credit Hours', note: 'Midterms in 10 days. Taking overloaded schedule to graduate on time. Sleep deprivation correlates with academic stress windows.', impact: 'Cognitive Load', impactColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
                            { icon: '🏀', label: 'Rivalry Game in 3 Days', note: 'Conference leadership game. Coach noted Maya has been "quieter than usual in practice." Travel fatigue: 3 away games in 10 days.', impact: 'Performance Anxiety', impactColor: 'text-[#FBBF24] bg-[#FBBF24]/10 border-[#FBBF24]/20' },
                        ].map((item) => (
                            <div key={item.label} className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 flex gap-3">
                                <div className="text-xl flex-shrink-0 mt-0.5">{item.icon}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="text-xs font-semibold text-zinc-200 leading-snug">{item.label}</div>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${item.impactColor}`}>{item.impact}</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-500 leading-relaxed">{item.note}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Medical History */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                    className="rounded-2xl border border-zinc-700/40 p-5" style={{ background: 'rgba(244,114,182,0.03)' }}>
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-4 h-4 text-[#F472B6]" />
                        <h4 className="text-sm font-bold text-white">Medical History</h4>
                        <span className="text-[9px] text-zinc-600 ml-auto">HIPAA Protected</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3">
                            <div className="text-[9px] text-zinc-500 uppercase font-bold mb-2">Injury History</div>
                            <div className="space-y-2">
                                {[
                                    { injury: 'ACL Tear (Left Knee)', date: 'Jan 2025', note: 'Full surgical repair — cleared Aug 2025' },
                                    { injury: 'Ankle Sprain (Right)', date: 'Mar 2024', note: 'Grade 1 — conservative treatment, 2 weeks' },
                                ].map((inj) => (
                                    <div key={inj.injury} className="border-l-2 border-zinc-700 pl-2">
                                        <div className="text-xs font-medium text-zinc-200">{inj.injury}</div>
                                        <div className="text-[10px] text-zinc-500">{inj.date} • {inj.note}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3">
                                <div className="text-[9px] text-zinc-500 uppercase font-bold mb-2">Surgical History</div>
                                <div className="border-l-2 border-[#F472B6]/30 pl-2">
                                    <div className="text-xs font-medium text-zinc-200">ACL Reconstruction</div>
                                    <div className="text-[10px] text-zinc-500">Jan 20, 2025 • Dr. Aisha Patel, MD</div>
                                    <div className="text-[10px] text-zinc-500">Patellar tendon autograft — cleared for full activity Aug 2025</div>
                                </div>
                            </div>
                            <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3">
                                <div className="text-[9px] text-zinc-500 uppercase font-bold mb-2">Current Medications</div>
                                <div className="text-xs text-zinc-400">None on record</div>
                            </div>
                            <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3">
                                <div className="text-[9px] text-zinc-500 uppercase font-bold mb-2">Previous MH Engagement</div>
                                <div className="text-xs text-zinc-400">None on record</div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────
// STEP 3 — THE 1-IN-3 STAT
// ─────────────────────────────────────────────────────────

const SceneStat: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}>
            <h2 className="text-7xl md:text-9xl font-black text-white mb-4">1 in 3</h2>
        </motion.div>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            className="text-xl text-zinc-300 max-w-lg">women collegiate athletes report clinically significant anxiety.</motion.p>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
            className="text-lg text-zinc-500 mt-4">Fewer than 10% ever access support.</motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
            className="text-sm text-[#F472B6] mt-6 italic">The gap isn&apos;t willingness. It&apos;s access.</motion.p>
    </motion.div>
);

// ─────────────────────────────────────────────────────────
// STEP 4 — CLINICAL HANDOFF (API + HIPAA + Escalation + Pulse)
// ─────────────────────────────────────────────────────────

const SceneClinicalHandoff: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center px-6 overflow-y-auto py-10">
        <div className="w-full max-w-3xl">
            <div className="text-center mb-8">
                <Plug className="w-10 h-10 text-[#E67E22] mx-auto mb-3" />
                <h2 className="text-3xl font-black text-white mb-2">The Clinical Handoff</h2>
                <p className="text-sm text-zinc-400 max-w-lg mx-auto">AuntEdna is a standalone clinical intelligence product — and it <em className="text-white not-italic font-semibold">also</em> works as an API, plugging into any software your organization already uses.</p>
            </div>

            {/* Three pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="rounded-xl border border-[#E67E22]/20 p-5" style={{ background: 'rgba(230,126,34,0.04)' }}>
                    <Plug className="w-6 h-6 text-[#E67E22] mb-3" />
                    <h3 className="text-sm font-bold text-white mb-2">API-First Platform</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">Other platforms don&apos;t have a clinical side. AuntEdna gives them one — plug in our API and instantly add clinical triage, escalation, and care delivery.</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {['REST API', 'Webhooks', 'SSO'].map(t => (
                            <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-[#E67E22]/10 text-[#E67E22] border border-[#E67E22]/20 font-medium">{t}</span>
                        ))}
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="rounded-xl border border-[#2DD4BF]/20 p-5" style={{ background: 'rgba(45,212,191,0.04)' }}>
                    <Shield className="w-6 h-6 text-[#2DD4BF] mb-3" />
                    <h3 className="text-sm font-bold text-white mb-2">HIPAA Compliant</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">End-to-end encryption. Athlete-controlled privacy. Clinician-only access to clinical data. Staff receives awareness — never details.</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {['HIPAA', 'Encrypted', 'Audit Trail'].map(t => (
                            <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-[#2DD4BF]/10 text-[#2DD4BF] border border-[#2DD4BF]/20 font-medium">{t}</span>
                        ))}
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                    className="rounded-xl border border-[#F472B6]/20 p-5" style={{ background: 'rgba(244,114,182,0.04)' }}>
                    <AlertTriangle className="w-6 h-6 text-[#F472B6] mb-3" />
                    <h3 className="text-sm font-bold text-white mb-2">Escalation System</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">AI-driven severity triage. Automatic clinician matching. Crisis pathway with real-time routing. Average connection time: 47 minutes.</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {['AI Triage', 'Auto-Match', 'Crisis Path'].map(t => (
                            <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-[#F472B6]/10 text-[#F472B6] border border-[#F472B6]/20 font-medium">{t}</span>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Escalation flow */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                className="rounded-xl border border-zinc-700/40 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-3">Escalation Flow</div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {[
                        { label: 'Partner Signal', sub: 'Pulse, Teamworks, etc.' },
                        { label: 'AuntEdna Triage', sub: 'AI severity assessment' },
                        { label: 'Clinician Matched', sub: 'Specialty + proximity' },
                        { label: 'Care Delivered', sub: 'Session booked' },
                    ].map((s, i) => (
                        <React.Fragment key={s.label}>
                            <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/30 px-3 py-2 text-center min-w-[120px]">
                                <div className="text-xs text-white font-bold">{s.label}</div>
                                <div className="text-[9px] text-zinc-500">{s.sub}</div>
                            </div>
                            {i < 3 && <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />}
                        </React.Fragment>
                    ))}
                </div>
            </motion.div>

            {/* Pulse partnership callout */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
                className="mt-4 rounded-xl border border-[#E0FE10]/20 p-4 flex items-center gap-4" style={{ background: 'rgba(224,254,16,0.03)' }}>
                <div className="w-12 h-12 rounded-xl bg-[#E0FE10]/10 border border-[#E0FE10]/20 flex items-center justify-center shrink-0">
                    <Handshake className="w-6 h-6 text-[#E0FE10]" />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-white">First Integration Partner: <span className="text-[#E0FE10]">Pulse</span></h4>
                    <p className="text-xs text-zinc-400 mt-0.5">PulseCheck by Pulse is the first platform to integrate AuntEdna&apos;s clinical handoff API — creating a seamless pipeline from mental performance training to clinical care delivery.</p>
                </div>
            </motion.div>
        </div>
    </motion.div>
);


// ─────────────────────────────────────────────────────────
// STEP 5 — AUNTEDNA IS ALSO AN API
// ─────────────────────────────────────────────────────────

const SceneAPI: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-2xl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}>
                <Plug className="w-12 h-12 text-[#E67E22] mx-auto mb-4" />
                <h2 className="text-4xl md:text-5xl font-black text-white mb-3">Standalone Software.<br /><span className="text-[#E67E22]">Also an API.</span></h2>
                <p className="text-base text-zinc-400 max-w-lg mx-auto mt-4 leading-relaxed">
                    AuntEdna is a complete clinical intelligence product on its own — clinicians use it independently to manage care.
                </p>
                <p className="text-base text-zinc-300 max-w-lg mx-auto mt-3 leading-relaxed">
                    But it <em className="text-white not-italic font-semibold">also</em> works as an API, allowing other companies to integrate AuntEdna&apos;s clinical capability directly into their own platforms.
                </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                className="mt-10 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#F472B6]/20 p-5 text-left" style={{ background: 'rgba(244,114,182,0.04)' }}>
                    <div className="text-2xl mb-2">🪩</div>
                    <h3 className="text-sm font-bold text-[#F472B6] mb-1">Standalone Product</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">Universities and clinics use AuntEdna directly — clinical triage, clinician matching, care tracking, all out of the box.</p>
                </div>
                <div className="rounded-xl border border-[#E67E22]/20 p-5 text-left" style={{ background: 'rgba(230,126,34,0.04)' }}>
                    <div className="text-2xl mb-2">🔌</div>
                    <h3 className="text-sm font-bold text-[#E67E22] mb-1">API for Partners</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">Other companies plug AuntEdna into their software — adding clinical escalation, triage, and care delivery to any platform.</p>
                </div>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {['Fitness Apps', 'Athletic Platforms', 'Wellness Software', 'University Systems'].map((s) => (
                    <span key={s} className="rounded-xl border border-[#E67E22]/20 bg-[#E67E22]/5 px-5 py-2.5 text-sm text-white font-medium">{s}</span>
                ))}
            </motion.div>
        </div>
    </motion.div>
);


// ─────────────────────────────────────────────────────────
// STEP 6 — MAYA'S OUTCOME
// ─────────────────────────────────────────────────────────

const SceneOutcome: React.FC = () => {
    useEffect(() => {
        const timer = setTimeout(() => {
            // Left burst
            confetti({
                particleCount: 80,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.6 },
                colors: ['#F472B6', '#EC4899', '#FBBF24', '#A78BFA', '#E67E22'],
            });
            // Right burst
            confetti({
                particleCount: 80,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.6 },
                colors: ['#F472B6', '#EC4899', '#FBBF24', '#A78BFA', '#E67E22'],
            });
        }, 1200);
        return () => clearTimeout(timer);
    }, []);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="h-full flex flex-col items-center justify-center px-6 text-center">
            <div className="w-full max-w-lg">
                <Trophy className="w-10 h-10 text-[#FBBF24] mx-auto mb-4" />
                <h3 className="text-xl font-black text-white mb-4">Two Weeks Later</h3>
                <div className="grid grid-cols-2 gap-3 mb-6">
                    {[{ v: '4', l: 'AuntEdna check-ins' }, { v: '2', l: 'Sessions with Dr. Williams' }, { v: '7.4 hrs', l: 'Sleep (↑)' }, { v: '58', l: 'HRV (recovering)' }].map(s => (
                        <div key={s.l} className="rounded-xl border border-white/10 p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <div className="text-2xl font-black text-white">{s.v}</div>
                            <div className="text-[10px] text-zinc-500">{s.l}</div>
                        </div>
                    ))}
                </div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
                    <p className="text-lg text-white font-bold mb-1">Maya puts up 24 points. Team wins.</p>
                    <p className="text-sm text-zinc-500 mb-2">What the crowd sees: a clutch performance.</p>
                    <p className="text-sm text-[#F472B6] font-semibold">What AuntEdna sees: a woman who was heard in time.</p>
                </motion.div>
            </div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────
// STEP 11 — TRACTION
// ─────────────────────────────────────────────────────────

const SceneTraction: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center px-6 overflow-y-auto py-10">
        <div className="w-full max-w-3xl">
            <h2 className="text-2xl font-black text-white text-center mb-6">Our Traction</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {[{
                    title: 'HBCU Strong', color: '#8E44AD', items: ['155 clinical interviews + 1,300 athletes', '53 clinical contracts in review', 'Jan–Mar 2026 clinical BETA'],
                }, {
                    title: 'Pilot Programs', color: '#E67E22', items: ['🎓 Hampton University', '🎓 Clark Atlanta University', '🎓 UMES'],
                }, {
                    title: 'Strategic Partners', color: '#F472B6', items: ['🤝 PulseCheck by Pulse — first platform partner', '🏈 New England Patriots — potential pilot'],
                }, {
                    title: 'Accelerators', color: '#2DD4BF', items: ['Indiana University: Kelley Hope', 'Northeastern: EVOLVE'],
                }].map(s => (
                    <div key={s.title} className="rounded-xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: s.color }}>{s.title}</h3>
                        {s.items.map(item => <p key={item} className="text-sm text-zinc-300 mb-1">{item}</p>)}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="rounded-xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-2 text-[#A78BFA]">Speaker Series</h3>
                    <p className="text-sm text-zinc-300 mb-1">MLK Day Youth Breakfast — Worcester, MA</p>
                    <p className="text-sm text-zinc-300">APRIL Family Office Fireside — West Palm Springs, FL</p>
                </div>
                <div className="rounded-xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-2 text-[#FBBF24]">NCAA + NSF</h3>
                    <p className="text-sm text-zinc-300 mb-1">Brave Hearts Tour 2026</p>
                    <p className="text-sm text-zinc-300 mb-1">National Science Foundation $275K grant</p>
                    <p className="text-sm text-zinc-300">NCAA NGO Sponsor</p>
                </div>
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="rounded-xl border border-[#34D399]/20 p-4 text-center" style={{ background: 'rgba(52,211,153,0.05)' }}>
                <p className="text-lg font-black text-[#34D399]">$500K raised so far</p>
                <p className="text-xs text-zinc-400">$275K non-dilutive capital already committed (NSF)</p>
            </motion.div>
        </div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────
// STEP 8 — UNIT ECONOMICS
// ─────────────────────────────────────────────────────────

const SceneUnitEconomics: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center px-6 overflow-y-auto py-10">
        <div className="w-full max-w-3xl">
            <DollarSign className="w-8 h-8 text-[#E67E22] mx-auto mb-3" />
            <h2 className="text-2xl font-black text-white text-center mb-6">Three Revenue Streams</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Stream 1: Clinics */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="rounded-xl border border-[#F472B6]/20 p-5" style={{ background: 'rgba(244,114,182,0.04)' }}>
                    <div className="text-2xl mb-2">🩺</div>
                    <h3 className="text-sm font-bold text-[#F472B6] mb-1">Clinics</h3>
                    <div className="text-3xl font-black text-white my-3">$15K</div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">per clinician / year</p>
                    <p className="text-xs text-zinc-400 mt-3 leading-relaxed">Private practices and group clinics license AuntEdna per clinician seat.</p>
                </motion.div>

                {/* Stream 2: Universities */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="rounded-xl border border-[#E67E22]/20 p-5" style={{ background: 'rgba(230,126,34,0.04)' }}>
                    <div className="text-2xl mb-2">🎓</div>
                    <h3 className="text-sm font-bold text-[#E67E22] mb-1">Universities</h3>
                    <div className="text-3xl font-black text-white my-3">$75K–$150K</div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">per university / year</p>
                    <p className="text-xs text-zinc-400 mt-3 leading-relaxed">Full platform contract — clinical infrastructure for the entire athletic department.</p>
                </motion.div>

                {/* Stream 3: API Usage */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                    className="rounded-xl border border-[#FBBF24]/20 p-5" style={{ background: 'rgba(251,191,36,0.04)' }}>
                    <div className="text-2xl mb-2">🔌</div>
                    <h3 className="text-sm font-bold text-[#FBBF24] mb-1">API Usage</h3>
                    <div className="text-3xl font-black text-white my-3">$3–$10</div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">per active user / month</p>
                    <p className="text-xs text-zinc-400 mt-3 leading-relaxed">3rd-party platforms pay per active user leveraging AuntEdna&apos;s clinical capability.</p>
                </motion.div>
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                className="rounded-xl border border-zinc-700/40 p-4 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Blended Average</p>
                <p className="text-sm text-zinc-300">University avg: <span className="text-white font-bold">$100K</span> &nbsp;•&nbsp; Clinician: <span className="text-white font-bold">$15K</span> &nbsp;•&nbsp; API: <span className="text-white font-bold">~$6/user/mo ($72/yr)</span></p>
            </motion.div>
        </div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────
// STEP 9 — PATH TO $100M
// ─────────────────────────────────────────────────────────

const MILESTONES = [
    { rev: '$1M', unis: 5, clinicians: 30, apiUsers: '2K', pct: 12 },
    { rev: '$10M', unis: 40, clinicians: 200, apiUsers: '40K', pct: 30 },
    { rev: '$25M', unis: 100, clinicians: 500, apiUsers: '100K', pct: 50 },
    { rev: '$50M', unis: 200, clinicians: 800, apiUsers: '250K', pct: 72 },
    { rev: '$100M', unis: 400, clinicians: 1500, apiUsers: '500K', pct: 95 },
];

const ScenePathTo100M: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-3xl">
            <h2 className="text-2xl font-black text-white text-center mb-2">Our Path to $100M</h2>
            <p className="text-xs text-zinc-500 text-center mb-6">Based on $100K/university • $15K/clinician • ~$72/API user/year</p>
            <div className="space-y-3">
                {MILESTONES.map((m, i) => (
                    <motion.div key={m.rev} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.25 }}
                        className="flex items-center gap-4">
                        <div className="w-16 text-right text-lg font-black" style={{ color: i === 4 ? '#FBBF24' : '#E67E22' }}>{m.rev}</div>
                        <div className="flex-1 h-8 bg-zinc-800/60 rounded-full overflow-hidden border border-zinc-700/30">
                            <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${m.pct}%` }}
                                transition={{ delay: i * 0.25 + 0.3, duration: 0.8 }}
                                style={{ background: i === 4 ? 'linear-gradient(90deg, #E67E22, #FBBF24)' : 'linear-gradient(90deg, #8E44AD, #E67E22)' }} />
                        </div>
                        <div className="w-64 text-xs text-zinc-400">
                            <span className="text-[#E67E22]">{m.unis}</span> unis • <span className="text-[#F472B6]">{m.clinicians.toLocaleString()}</span> clinicians • <span className="text-[#FBBF24]">{m.apiUsers}</span> API users
                        </div>
                    </motion.div>
                ))}
            </div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
                className="text-xs text-zinc-500 text-center mt-6">TAM: 6,000+ universities • 100K+ licensed clinicians • Millions of platform users</motion.p>
        </div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────
// STEP 14 — THE ASK
// ─────────────────────────────────────────────────────────

const SceneAsk: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-lg">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="mb-6">
                <p className="text-sm text-zinc-400 mb-1">$500K raised • $275K non-dilutive committed</p>
                <h2 className="text-5xl md:text-7xl font-black text-white">$750K</h2>
                <p className="text-lg text-[#E67E22] font-bold mt-2">Our Ask</p>
            </motion.div>
            <div className="grid grid-cols-2 gap-4 text-left">
                <div className="rounded-xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <h4 className="text-xs text-[#8E44AD] font-bold uppercase tracking-widest mb-2">This Round Funds</h4>
                    <p className="text-sm text-zinc-300 mb-1">AI Development</p>
                    <p className="text-sm text-zinc-300 mb-1">Research Validation</p>
                    <p className="text-sm text-zinc-300 mb-1">Clinical Service Mgmt</p>
                </div>
                <div className="rounded-xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <h4 className="text-xs text-[#E67E22] font-bold uppercase tracking-widest mb-2">Unlocks</h4>
                    <p className="text-sm text-zinc-300 mb-1">Go-To-Market Playbook</p>
                    <p className="text-sm text-zinc-300 mb-1">University Clients</p>
                    <p className="text-sm text-zinc-300 mb-1">Insurance Partners</p>
                </div>
            </div>
        </div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────
// STEP 15 — CTA
// ─────────────────────────────────────────────────────────

const SceneCTA: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
            <div className="text-5xl mb-4">🧠</div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
                aunt<span style={{ color: '#E67E22' }}>EDNA</span><span className="text-white/30">.ai</span>
            </h1>
            <p className="text-xl text-zinc-300 max-w-lg mx-auto mt-4 leading-relaxed">
                Every athlete deserves to be heard.<br />Every clinician deserves to show up prepared.
            </p>
            <p className="text-[#F472B6] font-bold mt-4">Let&apos;s bring AuntEdna to your organization.</p>
        </motion.div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────

const AuntEdnaDemo: React.FC = () => {
    const [step, setStep] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const advance = useCallback(() => setStep(prev => Math.min(prev + 1, TOTAL_STEPS)), []);
    const goBack = useCallback(() => setStep(prev => Math.max(prev - 1, 0)), []);

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

    useEffect(() => { containerRef.current?.focus(); }, []);

    const meta = STEP_META[step] || { section: '', label: '' };

    const renderScene = () => {
        switch (step) {
            case 0: return <SceneTitle />;
            case 1: return <SceneNotification />;
            case 2: return <SceneMayaProfile />;
            case 3: return <SceneStat />;
            case 4: return <SceneAPI />;
            case 5: return <SceneClinicalHandoff />;
            case 6: return <SceneOutcome />;
            case 7: return <SceneTraction />;
            case 8: return <SceneUnitEconomics />;
            case 9: return <ScenePathTo100M />;
            case 10: return <SceneAsk />;
            case 11: return <SceneCTA />;
            default: return <SceneTitle />;
        }
    };

    return (
        <>
            <Head>
                <title>AuntEdna Demo — Clinical Intelligence for Mental Performance</title>
                <meta name="description" content="Interactive demo: AuntEdna clinical intelligence platform for mental performance in athletics." />
            </Head>
            <div ref={containerRef} tabIndex={0} className="fixed inset-0 flex flex-col overflow-hidden cursor-pointer select-none outline-none" onClick={advance}
                style={{ background: '#0C0A09' }}>
                <div className="absolute top-0 left-0 right-0 z-30 h-1.5 bg-zinc-800">
                    <motion.div className="h-full" animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }} transition={{ duration: 0.5 }}
                        style={{ background: 'linear-gradient(90deg, #F472B6, #E67E22)' }} />
                </div>
                {step > 0 && (
                    <div className="absolute top-4 right-6 z-30 flex items-center gap-3">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{meta.label}</span>
                        <button onClick={(e) => { e.stopPropagation(); goBack(); }}
                            className="w-7 h-7 rounded-full bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center hover:bg-zinc-700/60 transition-all">
                            <ChevronLeft className="w-3 h-3 text-zinc-400" />
                        </button>
                    </div>
                )}
                <main className="flex-1 relative z-10 overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div key={step} className="h-full">{renderScene()}</motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </>
    );
};

export default AuntEdnaDemo;
