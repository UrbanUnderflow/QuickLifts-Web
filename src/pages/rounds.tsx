import type { NextPage, GetServerSideProps } from 'next';
import React from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import PageHead from '../components/PageHead';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';

interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface RoundsPageProps {
  metaData: SerializablePageMetaData | null;
}

// Floating orb for background
const FloatingOrb: React.FC<{
  color: string;
  size: string;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  delay?: number;
}> = ({ color, size, position, delay = 0 }) => (
  <motion.div
    className={`absolute ${size} rounded-full blur-3xl pointer-events-none`}
    style={{ backgroundColor: color, ...position }}
    animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
    transition={{ duration: 8, repeat: Infinity, delay, ease: "easeInOut" }}
  />
);

// Glass card component
const GlassCard: React.FC<{
  children: React.ReactNode;
  accentColor?: string;
  className?: string;
  delay?: number;
}> = ({ children, accentColor = '#E0FE10', className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    className={`relative group ${className}`}
  >
    <div 
      className="absolute -inset-1 rounded-3xl blur-xl opacity-0 group-hover:opacity-30 transition-all duration-700"
      style={{ background: `linear-gradient(135deg, ${accentColor}40, transparent 60%)` }}
    />
    <div className="relative rounded-3xl overflow-hidden backdrop-blur-xl bg-zinc-900/60 border border-white/10">
      <div 
        className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}80, transparent)` }}
      />
      {children}
    </div>
  </motion.div>
);

// Stat card for big numbers
const StatCard: React.FC<{
  stat: string;
  label: string;
  color: string;
  delay?: number;
}> = ({ stat, label, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className="text-center"
  >
    <p className="text-4xl md:text-5xl font-bold mb-2" style={{ color }}>{stat}</p>
    <p className="text-zinc-400 text-sm">{label}</p>
  </motion.div>
);

const RoundsPage: NextPage<RoundsPageProps> = ({ metaData }) => {
  const { scrollYProgress } = useScroll();
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white overflow-hidden">
      <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai/rounds"
      />

      {/* Header - Sticky Navigation */}
      <header className="fixed top-0 left-0 right-0 z-[100] bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <img 
                src="/pulse-logo-green.svg" 
                alt="Pulse" 
                className="h-8 sm:h-10 w-auto"
              />
            </Link>

              {/* Center Navigation - Hidden on mobile */}
              <nav className="hidden md:flex items-center gap-8">
                <a 
                  href="/#move-section" 
                  className="text-zinc-400 hover:text-white transition-colors text-sm font-medium"
                >
                  How it works
                </a>
                <a 
                  href="/moves" 
                  className="text-zinc-400 hover:text-white transition-colors text-sm font-medium"
                >
                  Moves
                </a>
                <a 
                  href="/rounds" 
                  className="text-[#E0FE10] hover:text-[#d4f00f] transition-colors text-sm font-medium font-semibold"
                >
                  Rounds
                </a>
                <a 
                  href="/creators" 
                  className="text-zinc-400 hover:text-white transition-colors text-sm font-medium"
                >
                  Creators
                </a>
                <a 
                  href="/pricing" 
                  className="text-zinc-400 hover:text-white transition-colors text-sm font-medium"
                >
                  Pricing
                </a>
              </nav>

            {/* Right Side - CTA Button */}
            <div className="flex items-center gap-3">
              <a
                href="/creator-onboarding"
                className="flex items-center justify-center px-5 py-2.5 rounded-full bg-[#E0FE10] hover:bg-[#d4f00f] text-black text-sm font-bold transition-all duration-200 shadow-lg shadow-[#E0FE10]/20"
              >
                Launch a Round
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div style={{ y: backgroundY }} className="absolute inset-0">
          <FloatingOrb color="#10B981" size="w-[500px] h-[500px]" position={{ top: '-10%', left: '-15%' }} delay={0} />
          <FloatingOrb color="#E0FE10" size="w-[400px] h-[400px]" position={{ top: '30%', right: '-10%' }} delay={2} />
          <FloatingOrb color="#8B5CF6" size="w-[350px] h-[350px]" position={{ bottom: '20%', left: '10%' }} delay={4} />
        </motion.div>
      </div>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-32 pb-20">
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            {/* Phone */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative flex-shrink-0"
            >
              <div className="absolute inset-0 bg-[#10B981]/20 blur-3xl rounded-full scale-75" />
              <div className="relative w-[280px] sm:w-[320px]">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px]">
                  <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-b from-[#10B981]/60 via-[#10B981]/20 to-[#10B981]/10" />
                  <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-950">
              <video
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                src="/rounds.mp4"
                poster="/sample-round-poster.jpg"
              />
            </div>
          </div>
        </div>
            </motion.div>

            {/* Hero Text */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="max-w-xl text-center lg:text-left"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full backdrop-blur-xl bg-white/5 border border-white/10"
              >
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-zinc-400 text-sm">Anatomy of a Round</span>
              </motion.div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 tracking-tight">
                <span className="text-white">What is a</span>
                <br />
                <span className="text-[#10B981]">Round?</span>
          </h1>
              
              <p className="text-zinc-400 text-lg lg:text-xl leading-relaxed mb-8">
                Rounds turn your content into time-bound group challenges. Gamification that 
                drives engagement, builds community, and creates recurring revenue.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <motion.a
                  href="/creator-onboarding"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-4 rounded-xl bg-[#10B981] text-black font-bold shadow-lg shadow-[#10B981]/30"
                >
                  Launch Your First Round
                </motion.a>
                <motion.a
                  href="#how-it-works"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-colors"
                >
                  See How It Works
                </motion.a>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="relative py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-zinc-500 text-sm font-semibold tracking-widest uppercase mb-4 block">
              The Challenge
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 leading-tight">
              One-off workouts don't build loyalty.
          </h2>
            
            <div className="space-y-6 text-zinc-300 text-lg leading-relaxed max-w-2xl mx-auto">
              <p>
                People follow you for a workout, then disappear. No commitment. No community. 
                No reason to come back tomorrow.
              </p>
              <p>
                Meanwhile, SoulCycle built a billion-dollar brand on one thing: 
                <span className="text-white font-medium"> group accountability</span>.
              </p>
              <p className="text-[#10B981] font-medium text-xl">
                Rounds give you that same power — digitally, at scale, with zero overhead.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What is a Round - Simple */}
      <section id="how-it-works" className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <span className="text-[#10B981] text-sm font-semibold tracking-widest uppercase mb-4 block">
              Simple Format
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              What's a <span className="text-[#10B981]">Round</span>?
            </h2>
            <p className="text-zinc-400 text-xl max-w-2xl mx-auto">
              A time-bound fitness challenge with daily workouts, leaderboards, and community. Think of it as a digital bootcamp.
            </p>
          </motion.div>

          {/* Simple Visual Breakdown */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Phone Mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative mx-auto lg:mx-0"
            >
              <div className="absolute inset-0 bg-[#E0FE10]/20 blur-3xl rounded-full scale-90" />
              <div className="relative w-[260px] sm:w-[280px]">
                <div className="relative aspect-[9/19.5] rounded-[2.5rem] p-[2px]">
                  <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-b from-[#E0FE10]/60 via-[#E0FE10]/20 to-[#E0FE10]/10" />
                  <div className="relative h-full w-full rounded-[2.5rem] overflow-hidden bg-zinc-900">
                    {/* Simplified Round UI */}
                    <div className="h-full flex flex-col p-4">
                      {/* Header */}
                      <div className="text-center mb-4">
                        <span className="text-[#10B981] text-xs font-semibold tracking-wider">ROUND PROGRESS</span>
                        <h3 className="text-white font-bold text-sm mt-1">Morning Mobility Challenge</h3>
                      </div>
                      
                      {/* Progress Ring */}
                      <div className="flex justify-center mb-4">
                        <div className="relative w-20 h-20">
                          <svg className="w-full h-full" viewBox="0 0 36 36">
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#27272a"
                              strokeWidth="3"
                            />
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#10B981"
                              strokeWidth="3"
                              strokeDasharray="77, 100"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[#10B981] font-bold text-sm">77%</span>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="text-center p-2 bg-zinc-800/50 rounded-lg">
                          <p className="text-white font-bold text-sm">6/7</p>
                          <p className="text-zinc-500 text-xs">Days</p>
                        </div>
                        <div className="text-center p-2 bg-zinc-800/50 rounded-lg">
                          <p className="text-white font-bold text-sm">175</p>
                          <p className="text-zinc-500 text-xs">Points</p>
                        </div>
                        <div className="text-center p-2 bg-zinc-800/50 rounded-lg">
                          <p className="text-white font-bold text-sm">#2</p>
                          <p className="text-zinc-500 text-xs">Rank</p>
                        </div>
                      </div>

                      {/* Leaderboard Preview */}
                      <div className="flex-1 bg-zinc-800/30 rounded-xl p-3">
                        <p className="text-zinc-400 text-xs mb-2">Leaderboard</p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20" />
                              <span className="text-white text-xs">bobby</span>
                            </div>
                            <span className="text-[#E0FE10] text-xs">👑 275</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-zinc-700" />
                              <span className="text-white text-xs">you</span>
                            </div>
                            <span className="text-zinc-400 text-xs">175</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Components List */}
            <div className="space-y-6">
              {[
                { 
                  num: '01', 
                  title: 'Duration', 
                  desc: 'Set a timeframe — 7 days, 21 days, 30 days. The countdown creates urgency and commitment.',
                  color: '#10B981'
                },
                { 
                  num: '02', 
                  title: 'Daily Workouts', 
                  desc: 'Structure their journey with Movelists for each day. They know exactly what to do.',
                  color: '#E0FE10'
                },
                { 
                  num: '03', 
                  title: 'Leaderboard', 
                  desc: 'Points, rankings, and streaks. Friendly competition that keeps people coming back.',
                  color: '#3B82F6'
                },
                { 
                  num: '04', 
                  title: 'Community', 
                  desc: "Participants see each other's progress, cheer each other on, and hold each other accountable.",
                  color: '#8B5CF6'
                },
              ].map((item, idx) => (
                <motion.div
                  key={item.num}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="flex items-start gap-4"
                >
                  <span 
                    className="text-2xl font-bold opacity-40"
                    style={{ color: item.color }}
                  >
                    {item.num}
                  </span>
                  <div>
                    <h4 className="text-white font-semibold text-lg mb-1">{item.title}</h4>
                    <p className="text-zinc-400">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The Science of Gamification */}
      <section className="relative py-24 px-4 bg-zinc-950/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <span className="text-[#E0FE10] text-sm font-semibold tracking-widest uppercase mb-4 block">
              The Science
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Why <span className="text-[#E0FE10]">Gamification</span> Works
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              This isn't a gimmick. It's behavioral psychology that the most successful fitness brands use daily.
            </p>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
            <StatCard stat="4x" label="Higher completion rates vs solo workouts" color="#10B981" delay={0.1} />
            <StatCard stat="67%" label="More likely to stick to habits with accountability" color="#E0FE10" delay={0.2} />
            <StatCard stat="3x" label="Longer retention with leaderboards" color="#3B82F6" delay={0.3} />
            <StatCard stat="89%" label="Say group challenges motivate them" color="#8B5CF6" delay={0.4} />
          </div>

          {/* Key Insights */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <GlassCard accentColor="#10B981" delay={0.1}>
              <div className="p-6">
                <div className="w-12 h-12 rounded-xl bg-[#10B981]/15 flex items-center justify-center mb-4">
                  <span className="text-2xl">⏰</span>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Time Pressure</h3>
                <p className="text-zinc-400 text-sm">
                  A defined end date creates urgency. "I'll start Monday" becomes "I need to start today or I'll fall behind."
                </p>
              </div>
            </GlassCard>

            <GlassCard accentColor="#E0FE10" delay={0.2}>
              <div className="p-6">
                <div className="w-12 h-12 rounded-xl bg-[#E0FE10]/15 flex items-center justify-center mb-4">
                  <span className="text-2xl">🏆</span>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Status & Rankings</h3>
                <p className="text-zinc-400 text-sm">
                  Leaderboards tap into our competitive drive. Nobody wants to be at the bottom — so they show up.
                </p>
              </div>
            </GlassCard>

            <GlassCard accentColor="#3B82F6" delay={0.3}>
              <div className="p-6">
                <div className="w-12 h-12 rounded-xl bg-[#3B82F6]/15 flex items-center justify-center mb-4">
                  <span className="text-2xl">🔥</span>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Streak Psychology</h3>
                <p className="text-zinc-400 text-sm">
                  Once someone has a 5-day streak, they'll do almost anything to protect it. Loss aversion at its finest.
                </p>
              </div>
            </GlassCard>

            <GlassCard accentColor="#8B5CF6" delay={0.4}>
              <div className="p-6">
                <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/15 flex items-center justify-center mb-4">
                  <span className="text-2xl">👥</span>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Social Proof</h3>
                <p className="text-zinc-400 text-sm">
                  Seeing others check in makes it normal. "If they can do it, so can I." Accountability without nagging.
                </p>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Benefits for Creators */}
      <section className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <span className="text-[#EC4899] text-sm font-semibold tracking-widest uppercase mb-4 block">
              For Creators
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Why Trainers <span className="text-[#EC4899]">Love</span> Rounds
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Rounds solve the biggest problems fitness creators face.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Recurring Revenue */}
            <GlassCard accentColor="#10B981" delay={0.1}>
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-[#10B981]/20 flex items-center justify-center">
                    <span className="text-3xl">💰</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xl">Recurring Revenue</h3>
                    <p className="text-zinc-400 text-sm">Not just one-time purchases</p>
                  </div>
                </div>
                <p className="text-zinc-300 mb-6">
                  People subscribe to join your Rounds. As long as you keep running them, you keep earning. 
                  No more trading time for money one session at a time.
                </p>
                <div className="p-4 rounded-xl bg-[#10B981]/5 border border-[#10B981]/20">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📈</span>
                    <span className="text-zinc-300 text-sm">Creators average <span className="text-[#10B981] font-bold">$2,400/month</span> from recurring Round participants</span>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Deeper Engagement */}
            <GlassCard accentColor="#3B82F6" delay={0.2}>
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-[#3B82F6]/20 flex items-center justify-center">
                    <span className="text-3xl">❤️</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xl">Deeper Engagement</h3>
                    <p className="text-zinc-400 text-sm">Beyond the algorithm</p>
                  </div>
                </div>
                <p className="text-zinc-300 mb-6">
                  Instagram shows your post to 5% of followers. Rounds? 100% of participants see every workout. 
                  Direct, consistent touchpoints without fighting for reach.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-zinc-300 text-sm">Daily check-ins from your community</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-zinc-300 text-sm">Real relationship building at scale</span>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Scalable Impact */}
            <GlassCard accentColor="#8B5CF6" delay={0.3}>
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-[#8B5CF6]/20 flex items-center justify-center">
                    <span className="text-3xl">🚀</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xl">Scalable Impact</h3>
                    <p className="text-zinc-400 text-sm">Train 10 or 10,000 — same effort</p>
                  </div>
                </div>
                <p className="text-zinc-300 mb-6">
                  Create the Round once, let hundreds participate. Your workouts run 24/7 without you 
                  being on a Zoom call or in a gym.
                </p>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-[#8B5CF6]/5 border border-[#8B5CF6]/20">
                  <div className="flex -space-x-3">
                    {[1,2,3,4,5].map((i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-zinc-700 border-2 border-zinc-900" />
                    ))}
                  </div>
                  <span className="text-zinc-400 text-sm">+82 participants in one Round</span>
                </div>
              </div>
            </GlassCard>

            {/* Zero Overhead */}
            <GlassCard accentColor="#F59E0B" delay={0.4}>
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-[#F59E0B]/20 flex items-center justify-center">
                    <span className="text-3xl">⚡</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xl">Zero Overhead</h3>
                    <p className="text-zinc-400 text-sm">No studio, no scheduling</p>
                  </div>
                </div>
                <p className="text-zinc-300 mb-6">
                  No rent. No equipment costs. No coordinating schedules with 30 people. 
                  Just you, your phone, and your expertise.
                </p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-[#F59E0B]">$0</p>
                    <p className="text-zinc-500 text-xs">Startup cost</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#F59E0B]">2min</p>
                    <p className="text-zinc-500 text-xs">To launch</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#F59E0B]">∞</p>
                    <p className="text-zinc-500 text-xs">Reach</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* How Rounds Connect */}
      <section className="relative py-24 px-4 bg-zinc-950/50">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-[#E0FE10] text-sm font-semibold tracking-widest uppercase mb-4 block">
              The System
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Moves → Movelists → <span className="text-[#10B981]">Rounds</span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-12">
              Your Moves combine into Movelists. Your Movelists power your Rounds. One ecosystem, infinite possibilities.
            </p>
          </motion.div>

          {/* Flow Diagram */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-[#E0FE10]/20 blur-xl rounded-full" />
              <div className="relative w-28 h-28 rounded-2xl bg-[#E0FE10]/10 border border-[#E0FE10]/40 flex flex-col items-center justify-center">
                <span className="text-3xl mb-1">🎬</span>
                <span className="text-white font-bold text-sm">Move</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              whileInView={{ opacity: 1, scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="hidden md:block w-12 h-0.5 bg-gradient-to-r from-[#E0FE10]/50 to-[#F59E0B]/50"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-[#F59E0B]/20 blur-xl rounded-full" />
              <div className="relative w-32 h-32 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/40 flex flex-col items-center justify-center">
                <span className="text-3xl mb-1">📚</span>
                <span className="text-white font-bold text-sm">Movelist</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              whileInView={{ opacity: 1, scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="hidden md:block w-12 h-0.5 bg-gradient-to-r from-[#F59E0B]/50 to-[#10B981]/50"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-[#10B981]/20 blur-xl rounded-full" />
              <div className="relative w-36 h-36 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/40 flex flex-col items-center justify-center">
                <span className="text-3xl mb-1">🏆</span>
                <span className="text-white font-bold">Round</span>
                <span className="text-zinc-500 text-xs">Challenge</span>
              </div>
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-zinc-400 mt-12 max-w-lg mx-auto"
          >
            Build once, run forever. The same Movelists can power unlimited Rounds.
          </motion.p>
        </div>
      </section>

      {/* Real Results */}
      <section className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <span className="text-[#3B82F6] text-sm font-semibold tracking-widest uppercase mb-4 block">
              Proven Results
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              What Creators Are <span className="text-[#3B82F6]">Seeing</span>
          </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            <GlassCard accentColor="#10B981" delay={0.1}>
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-300 mb-4 italic">
                  "My first Round had 47 people. By week 2, I had a waitlist for the next one. 
                  This is the community I've been trying to build for years."
                </p>
                <p className="text-white font-semibold">Sarah K.</p>
                <p className="text-zinc-500 text-sm">Yoga Instructor</p>
              </div>
            </GlassCard>

            <GlassCard accentColor="#E0FE10" delay={0.2}>
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-300 mb-4 italic">
                  "Went from $500/month teaching classes to $3,200/month running Rounds. 
                  Same content, completely different business model."
                </p>
                <p className="text-white font-semibold">Marcus T.</p>
                <p className="text-zinc-500 text-sm">HIIT Coach</p>
              </div>
            </GlassCard>

            <GlassCard accentColor="#8B5CF6" delay={0.3}>
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-300 mb-4 italic">
                  "The leaderboard literally does the motivation for me. People message each other, 
                  cheer each other on. It runs itself."
                </p>
                <p className="text-white font-semibold">Jess L.</p>
                <p className="text-zinc-500 text-sm">Personal Trainer</p>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#10B981]/20 via-[#E0FE10]/20 to-[#3B82F6]/20 blur-3xl" />
              
              <div className="relative backdrop-blur-xl bg-zinc-900/30 border border-white/10 rounded-3xl p-12 md:p-16">
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                  Ready to launch your first <span className="text-[#10B981]">Round</span>?
        </h2>
                <p className="text-zinc-400 text-lg mb-8 max-w-xl mx-auto">
                  Turn your followers into a community. Build something that keeps them coming back.
        </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <motion.a
          href="/creator-onboarding"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-8 py-4 rounded-xl bg-[#10B981] text-black font-bold text-lg shadow-lg shadow-[#10B981]/30"
                  >
                    Get Started Free
                  </motion.a>
                  <motion.a
                    href="/moves"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-8 py-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white font-semibold text-lg hover:bg-white/10 transition-colors"
                  >
                    Learn About Moves →
                  </motion.a>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/pulse-logo-green.svg" alt="Pulse" className="h-6 w-auto" />
            <span className="text-zinc-500 text-sm">Gamified fitness challenges</span>
          </div>
          <p className="text-zinc-500 text-sm">
            © {new Date().getFullYear()} Pulse Intelligence Labs, Inc.
          </p>
        </div>
      </footer>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<RoundsPageProps> = async (_context) => {
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    rawMetaData = await adminMethods.getPageMetaData('rounds');
  } catch (error) {
    console.error("Error fetching page meta data for rounds page:", error);
  }

  let serializableMetaData: SerializablePageMetaData | null = null;
  if (rawMetaData) {
    serializableMetaData = {
      ...rawMetaData,
      lastUpdated: rawMetaData.lastUpdated.toDate().toISOString(),
    };
  }

  return {
    props: {
      metaData: serializableMetaData,
    },
  };
};

export default RoundsPage;
