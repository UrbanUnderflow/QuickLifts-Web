import React from 'react';
import type { NextPage, GetServerSideProps } from 'next';
import { motion, useScroll, useTransform } from 'framer-motion';
import PageHead from '../components/PageHead';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';

interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface MovesPageProps {
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

const MovesPage: NextPage<MovesPageProps> = ({ metaData }) => {
  const { scrollYProgress } = useScroll();
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white overflow-hidden">
      <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai/moves"
      />

      {/* Header - Sticky Navigation */}
      <header className="fixed top-0 left-0 right-0 z-[100] bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <a href="/" className="flex items-center">
              <img 
                src="/pulse-logo-green.svg" 
                alt="Pulse" 
                className="h-8 sm:h-10 w-auto"
              />
            </a>

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
                className="text-[#E0FE10] hover:text-[#d4f00f] transition-colors text-sm font-medium font-semibold"
              >
                Moves
              </a>
              <a 
                href="/rounds" 
                className="text-zinc-400 hover:text-white transition-colors text-sm font-medium"
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
                href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                className="flex items-center justify-center px-5 py-2.5 rounded-full bg-[#E0FE10] hover:bg-[#d4f00f] text-black text-sm font-bold transition-all duration-200 shadow-lg shadow-[#E0FE10]/20"
              >
                Download App
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div style={{ y: backgroundY }} className="absolute inset-0">
          <FloatingOrb color="#E0FE10" size="w-[500px] h-[500px]" position={{ top: '-10%', left: '-15%' }} delay={0} />
          <FloatingOrb color="#8B5CF6" size="w-[400px] h-[400px]" position={{ top: '30%', right: '-10%' }} delay={2} />
          <FloatingOrb color="#3B82F6" size="w-[350px] h-[350px]" position={{ bottom: '20%', left: '10%' }} delay={4} />
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
              <div className="absolute inset-0 bg-[#E0FE10]/20 blur-3xl rounded-full scale-75" />
              <div className="relative w-[280px] sm:w-[320px]">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px]">
                  <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-b from-[#E0FE10]/60 via-[#E0FE10]/20 to-[#E0FE10]/10" />
                  <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-950">
              <video
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                src="/mymoves.mp4"
                poster="/sample-moves-poster.jpg"
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
                <span className="w-2 h-2 rounded-full bg-[#E0FE10] animate-pulse" />
                <span className="text-zinc-400 text-sm">Anatomy of a Move</span>
              </motion.div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 tracking-tight">
                <span className="text-white">What is a</span>
                <br />
                <span className="text-[#E0FE10]">Move?</span>
              </h1>
              
              <p className="text-zinc-400 text-lg lg:text-xl leading-relaxed mb-8">
                Moves are bite-sized exercise videos that grab attention, hold focus, and actually 
                convert. Built for how people consume fitness content today.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <motion.a
                  href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-4 rounded-xl bg-[#E0FE10] text-black font-bold shadow-lg shadow-[#E0FE10]/30"
                >
                  Start Creating
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
              The Reality
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 leading-tight">
              Long workout videos don't work anymore.
            </h2>
            
            <div className="space-y-6 text-zinc-300 text-lg leading-relaxed max-w-2xl mx-auto">
              <p>
                You spend hours creating a 45-minute workout video. It gets maybe 200 views. 
                People skip around, watch 2 minutes, then bounce.
              </p>
              <p>
                Meanwhile, a 15-second clip of one exercise gets <span className="text-white font-medium">10x the engagement</span>.
              </p>
              <p className="text-[#E0FE10] font-medium text-xl">
                Attention spans have changed. Your content format should too.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What is a Move - Simple */}
      <section id="how-it-works" className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <span className="text-[#E0FE10] text-sm font-semibold tracking-widest uppercase mb-4 block">
              Simple Format
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              What's a <span className="text-[#E0FE10]">Move</span>?
            </h2>
            <p className="text-zinc-400 text-xl max-w-2xl mx-auto">
              One exercise. One video. Soundless by design. All the details someone needs to do it right.
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
              <div className="absolute inset-0 bg-[#8B5CF6]/20 blur-3xl rounded-full scale-90" />
              <div className="relative w-[260px] sm:w-[280px]">
                <div className="relative aspect-[9/19.5] rounded-[2.5rem] p-[2px]">
                  <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-b from-[#8B5CF6]/60 via-[#8B5CF6]/20 to-[#8B5CF6]/10" />
                  <div className="relative h-full w-full rounded-[2.5rem] overflow-hidden bg-zinc-900">
                    {/* Simplified Move UI */}
                    <div className="h-full flex flex-col">
                      <div className="flex-1 relative bg-zinc-800">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900/80" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </div>
                        <div className="absolute bottom-3 left-3 right-3">
                          <div className="px-3 py-1.5 rounded-lg bg-[#E0FE10] text-black text-xs font-bold inline-block">
                            Oct 27, 2024
                          </div>
                        </div>
                      </div>
                      <div className="px-4 py-4 space-y-2 bg-zinc-900">
                        <h3 className="text-white font-bold text-sm">Narrow Stance Leg Press</h3>
                        <p className="text-zinc-400 text-xs leading-relaxed">
                          Targets the teardrop part of your quads. Keep knees tracking over toes.
                        </p>
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
                  title: 'Video', 
                  desc: 'Your form. Your style. Soundless by design so people can listen to their own music while focusing on the movement. Plugs into any workout alongside other creators.',
                  color: '#E0FE10'
                },
                { 
                  num: '02', 
                  title: 'Name', 
                  desc: 'Clear, specific titles that help people find exactly what they need.',
                  color: '#3B82F6'
                },
                { 
                  num: '03', 
                  title: 'Caption', 
                  desc: 'Quick tips, cues, or muscle focus. The coaching details that make you, you.',
                  color: '#8B5CF6'
                },
                { 
                  num: '04', 
                  title: 'Timestamp', 
                  desc: 'Every Move is dated. Creates a visual history of your content.',
                  color: '#F59E0B'
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

      {/* Why Video Wins */}
      <section className="relative py-24 px-4 bg-zinc-950/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <span className="text-[#3B82F6] text-sm font-semibold tracking-widest uppercase mb-4 block">
              Attention Economy
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Video Wins. <span className="text-[#3B82F6]">Period.</span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              We studied how people actually consume fitness content. Here's what we found.
            </p>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
            <StatCard stat="3x" label="Higher retention vs. static images" color="#E0FE10" delay={0.1} />
            <StatCard stat="47%" label="More shares than long-form" color="#3B82F6" delay={0.2} />
            <StatCard stat="8s" label="Average attention span today" color="#8B5CF6" delay={0.3} />
            <StatCard stat="91%" label="Prefer video for learning exercises" color="#F59E0B" delay={0.4} />
          </div>

          {/* Key Insights */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <GlassCard accentColor="#E0FE10" delay={0.1}>
              <div className="p-6">
                <div className="w-12 h-12 rounded-xl bg-[#E0FE10]/15 flex items-center justify-center mb-4">
                  <span className="text-2xl">👀</span>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Captures Attention</h3>
                <p className="text-zinc-400 text-sm">
                  Video stops the scroll. Static images and text get passed over. 
                  A well-shot Move grabs eyes instantly.
                </p>
              </div>
            </GlassCard>

            <GlassCard accentColor="#3B82F6" delay={0.2}>
              <div className="p-6">
                <div className="w-12 h-12 rounded-xl bg-[#3B82F6]/15 flex items-center justify-center mb-4">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Holds Focus</h3>
                <p className="text-zinc-400 text-sm">
                  Short, single-exercise videos keep people engaged from start to finish. 
                  No skipping, no dropping off halfway.
                </p>
              </div>
            </GlassCard>

            <GlassCard accentColor="#8B5CF6" delay={0.3}>
              <div className="p-6">
                <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/15 flex items-center justify-center mb-4">
                  <span className="text-2xl">🔁</span>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Actually Gets Used</h3>
                <p className="text-zinc-400 text-sm">
                  People reference back to individual exercises, not 45-minute videos. 
                  Moves are the format people actually return to.
                </p>
              </div>
            </GlassCard>

            <GlassCard accentColor="#10B981" delay={0.4}>
              <div className="p-6">
                <div className="w-12 h-12 rounded-xl bg-[#10B981]/15 flex items-center justify-center mb-4">
                  <span className="text-2xl">🔇</span>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Soundless by Design</h3>
                <p className="text-zinc-400 text-sm">
                  No audio keeps the focus on the movement. People listen to their own music while your 
                  Move plugs seamlessly into any workout alongside other trainers and creators.
                </p>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* The Revenue Story */}
      <section className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <span className="text-[#10B981] text-sm font-semibold tracking-widest uppercase mb-4 block">
              Creator Economy
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Get Paid for <span className="text-[#10B981]">Every Play</span>
          </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Your Moves. Your intellectual property. Your revenue. We built the system so you always get credit.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Revenue Sharing */}
            <GlassCard accentColor="#10B981" delay={0.1}>
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-[#10B981]/20 flex items-center justify-center">
                    <span className="text-3xl">💰</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xl">Revenue Sharing Built In</h3>
                    <p className="text-zinc-400 text-sm">Every view, every use, tracked</p>
                  </div>
                </div>
                <p className="text-zinc-300 mb-6">
                  When someone uses your Move in their Movelist or Round, you earn. When your content 
                  drives results, you get rewarded. It's that simple.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-zinc-300 text-sm">Automatic attribution</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-zinc-300 text-sm">Transparent earnings dashboard</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-zinc-300 text-sm">Paid when your content performs</span>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Mix & Match */}
            <GlassCard accentColor="#EC4899" delay={0.2}>
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-[#EC4899]/20 flex items-center justify-center">
                    <span className="text-3xl">🤝</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xl">Mix & Match With Creators</h3>
                    <p className="text-zinc-400 text-sm">Collaboration without coordination</p>
                  </div>
                </div>
                <p className="text-zinc-300 mb-6">
                  Build a Movelist using your Moves plus another creator's. Both of you earn. 
                  It's collaboration that scales — no DMs, no deals, just great content working together.
                </p>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[#EC4899]/5 border border-[#EC4899]/20">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10]/30 border-2 border-zinc-900" />
                    <div className="w-8 h-8 rounded-full bg-[#3B82F6]/30 border-2 border-zinc-900" />
                    <div className="w-8 h-8 rounded-full bg-[#EC4899]/30 border-2 border-zinc-900" />
                  </div>
                  <span className="text-zinc-400 text-sm">Multiple creators, one seamless workout</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Analytics */}
      <section className="relative py-24 px-4 bg-zinc-950/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <span className="text-[#F59E0B] text-sm font-semibold tracking-widest uppercase mb-4 block">
                Deep Insights
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                Know Exactly How Your Content <span className="text-[#F59E0B]">Performs</span>
              </h2>
              <p className="text-zinc-400 text-lg mb-8">
                See which Moves get used the most. Track how people progress. Understand what's 
                actually driving results for your audience.
              </p>
              
              <div className="space-y-4">
                {[
                  { label: 'Views & completions per Move', icon: '📊' },
                  { label: 'Which Movelists feature your content', icon: '📋' },
                  { label: 'User progress with your exercises', icon: '📈' },
                  { label: 'Engagement rates over time', icon: '⏱️' },
                ].map((item, idx) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-white/5"
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-zinc-300">{item.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Analytics Preview */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-[#F59E0B]/10 blur-3xl rounded-full" />
              <div className="relative p-6 rounded-3xl bg-zinc-900/80 border border-white/10 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-white font-semibold">Move Performance</h4>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
                    This Week
                  </span>
                </div>
                
                {/* Chart Placeholder */}
                <div className="h-40 flex items-end gap-2 mb-6">
                  {[40, 65, 45, 80, 55, 90, 70].map((height, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${height}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: idx * 0.1 }}
                      className="flex-1 rounded-t-lg bg-gradient-to-t from-[#F59E0B] to-[#F59E0B]/50"
                    />
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-white">2,847</p>
                    <p className="text-zinc-500 text-xs">Total Views</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#10B981]">89%</p>
                    <p className="text-zinc-500 text-xs">Completion</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#F59E0B]">156</p>
                    <p className="text-zinc-500 text-xs">In Movelists</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Connects */}
      <section className="relative py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-[#8B5CF6] text-sm font-semibold tracking-widest uppercase mb-4 block">
              The System
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Moves Are <span className="text-[#8B5CF6]">Building Blocks</span>
          </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-12">
              Create once. Use everywhere. Your Moves become the foundation for Movelists, Rounds, and entire training programs.
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
              initial={{ opacity: 0, scaleY: 0 }}
              whileInView={{ opacity: 1, scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="md:hidden w-0.5 h-8 bg-gradient-to-b from-[#E0FE10]/50 to-[#F59E0B]/50"
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
                <span className="text-zinc-500 text-xs">Workout</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              whileInView={{ opacity: 1, scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="hidden md:block w-12 h-0.5 bg-gradient-to-r from-[#F59E0B]/50 to-[#8B5CF6]/50"
            />
            <motion.div
              initial={{ opacity: 0, scaleY: 0 }}
              whileInView={{ opacity: 1, scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="md:hidden w-0.5 h-8 bg-gradient-to-b from-[#F59E0B]/50 to-[#8B5CF6]/50"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-[#8B5CF6]/20 blur-xl rounded-full" />
              <div className="relative w-36 h-36 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/40 flex flex-col items-center justify-center">
                <span className="text-3xl mb-1">🏆</span>
                <span className="text-white font-bold">Round</span>
                <span className="text-zinc-500 text-xs">Program</span>
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
            One Move can be featured in dozens of Movelists across the platform. 
            Each use = more reach, more impact, more earnings.
          </motion.p>
        </div>
      </section>

      {/* Quick Record */}
      <section className="relative py-24 px-4 bg-zinc-950/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="max-w-xl"
            >
              <span className="text-[#E0FE10] text-sm font-semibold tracking-widest uppercase mb-4 block">
                Dead Simple
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Record in <span className="text-[#E0FE10]">30 Seconds</span>
              </h2>
              <p className="text-zinc-400 text-lg leading-relaxed mb-8">
                No editing. No production. Just hit record, do the exercise, add a name and notes. Done. 
                Your authentic content is what people want anyway.
              </p>
              
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-4xl font-bold text-[#E0FE10]">30s</p>
                  <p className="text-zinc-500 text-sm">To record</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-[#3B82F6]">10s</p>
                  <p className="text-zinc-500 text-sm">To add details</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-[#8B5CF6]">∞</p>
                  <p className="text-zinc-500 text-sm">To earn from</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative flex-shrink-0"
            >
              <div className="absolute inset-0 bg-[#E0FE10]/15 blur-3xl rounded-full scale-75" />
              <div className="relative w-[280px] sm:w-[320px]">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px]">
                  <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-b from-[#E0FE10]/60 via-[#E0FE10]/20 to-[#E0FE10]/10" />
                  <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-950">
              <video
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                src="/capturemove.mp4"
                poster="/record-move-poster.jpg"
              />
            </div>
                </div>
              </div>
            </motion.div>
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
              <div className="absolute inset-0 bg-gradient-to-r from-[#E0FE10]/20 via-[#8B5CF6]/20 to-[#3B82F6]/20 blur-3xl" />
              
              <div className="relative backdrop-blur-xl bg-zinc-900/30 border border-white/10 rounded-3xl p-12 md:p-16">
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                  Your content deserves to <span className="text-[#E0FE10]">work for you</span>
          </h2>
                <p className="text-zinc-400 text-lg mb-8 max-w-xl mx-auto">
                  Start creating Moves today. Build your library. Earn from every play.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <motion.a
                    href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-8 py-4 rounded-xl bg-[#E0FE10] text-black font-bold text-lg shadow-lg shadow-[#E0FE10]/30"
                  >
                    Download Pulse Free
                  </motion.a>
                  <motion.a
                    href="/movelists"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-8 py-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white font-semibold text-lg hover:bg-white/10 transition-colors"
                  >
                    Learn About Movelists →
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
            <span className="text-zinc-500 text-sm">Built for creators who move</span>
          </div>
          <p className="text-zinc-500 text-sm">
            © {new Date().getFullYear()} Pulse Intelligence Labs, Inc.
          </p>
        </div>
      </footer>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<MovesPageProps> = async (_context) => {
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    rawMetaData = await adminMethods.getPageMetaData('moves');
  } catch (error) {
    console.error("Error fetching page meta data for moves page:", error);
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

export default MovesPage;
