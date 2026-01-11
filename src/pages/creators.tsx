import React, { useState, useEffect } from 'react';
import type { NextPage, GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, useScroll, useTransform } from 'framer-motion';
import { FaArrowRight, FaChevronDown, FaPlay } from 'react-icons/fa6';
import PageHead from '../components/PageHead';
import Footer from '../components/Footer/Footer';
import { platformDetection, appLinks, openIOSAppOrStore } from '../utils/platformDetection';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';

interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface CreatorsPageProps {
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

// FAQ Item
interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, isOpen, onToggle }) => (
  <motion.div 
    className="border-b border-zinc-800"
    initial={{ opacity: 0 }}
    whileInView={{ opacity: 1 }}
    viewport={{ once: true }}
  >
    <button
      onClick={onToggle}
      className="w-full py-5 flex items-center justify-between text-left hover:text-[#E0FE10] transition-colors"
    >
      <span className="text-lg font-medium text-white">{question}</span>
      <FaChevronDown className={`h-5 w-5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && (
      <div className="pb-5 text-zinc-400 leading-relaxed">
        {answer}
      </div>
    )}
  </motion.div>
);

const CreatorsPage: NextPage<CreatorsPageProps> = ({ metaData }) => {
  const router = useRouter();
  const { scrollYProgress } = useScroll();
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    setPlatform(platformDetection.getPlatform());
  }, []);

  const handleLaunchChallenge = () => {
    if (platform === 'ios') {
      openIOSAppOrStore(
        appLinks.creatorOnboardingDeepLink(),
        appLinks.appStoreUrl
      );
    } else {
      router.push('/creator-onboarding');
    }
  };

  const faqItems = [
    {
      question: "Do I need a big following?",
      answer: "No. Most creators start with 20-50 people. Pulse helps you build deeper engagement with a small community, not chase follower counts."
    },
    {
      question: "Can this work with my studio?",
      answer: "Absolutely. Studios like SoulCycle use Pulse to run instructor-led challenges that bring new customers in and re-engage lapsed members."
    },
    {
      question: "How do I get paid?",
      answer: "Participants subscribe to Pulse to join challenges. You earn from their ongoing participation. Payments are processed monthly via Stripe."
    },
    {
      question: "What kind of content works best?",
      answer: "Short 5-30 second exercise clips from workouts you already do. No fancy production needed — authenticity beats polish."
    },
    {
      question: "How long does a challenge last?",
      answer: "You decide. Most run 7-30 days, but you have full control. Start short to test what works for your community."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white overflow-hidden">
      <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai/creators"
      />

      {/* Header - Sticky Navigation */}
      <header className="fixed top-0 left-0 right-0 z-[100] bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <Link href="/" className="flex items-center">
              <img 
                src="/pulse-logo-green.svg" 
                alt="Pulse" 
                className="h-8 sm:h-10 w-auto"
              />
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <a href="/#move-section" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">
                How it works
              </a>
              <a href="/moves" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">
                Moves
              </a>
              <a href="/rounds" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">
                Rounds
              </a>
              <a href="/creators" className="text-[#E0FE10] hover:text-[#d4f00f] transition-colors text-sm font-medium font-semibold">
                Creators
              </a>
              <a href="/subscribe" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">
                Pricing
              </a>
        </nav>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleLaunchChallenge}
                className="flex items-center justify-center px-5 py-2.5 rounded-full bg-[#E0FE10] hover:bg-[#d4f00f] text-black text-sm font-bold transition-all duration-200 shadow-lg shadow-[#E0FE10]/20"
              >
                Launch a Round
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div style={{ y: backgroundY }} className="absolute inset-0">
          <FloatingOrb color="#F59E0B" size="w-[500px] h-[500px]" position={{ top: '-10%', left: '-15%' }} delay={0} />
          <FloatingOrb color="#E0FE10" size="w-[400px] h-[400px]" position={{ top: '30%', right: '-10%' }} delay={2} />
          <FloatingOrb color="#10B981" size="w-[350px] h-[350px]" position={{ bottom: '20%', left: '10%' }} delay={4} />
        </motion.div>
            </div>
            
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-32 pb-20">
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            {/* Phone Mockup - Creator Dashboard */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative flex-shrink-0"
            >
              <div className="absolute inset-0 bg-[#F59E0B]/20 blur-3xl rounded-full scale-75" />
              <div className="relative w-[280px] sm:w-[320px]">
                <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px]">
                  <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-b from-[#F59E0B]/60 via-[#F59E0B]/20 to-[#F59E0B]/10" />
                  <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
                    {/* Creator Dashboard UI Mockup */}
                    <div className="h-full flex flex-col p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#E0FE10]" />
                          <div>
                            <p className="text-white font-semibold text-sm">Your Profile</p>
                            <p className="text-zinc-500 text-xs">Creator Dashboard</p>
                          </div>
                        </div>
                        <div className="px-2 py-1 bg-[#E0FE10]/20 rounded-full">
                          <span className="text-[#E0FE10] text-xs font-semibold">PRO</span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="text-center p-2 bg-zinc-800/50 rounded-lg">
                          <p className="text-[#E0FE10] font-bold text-lg">47</p>
                          <p className="text-zinc-500 text-xs">Moves</p>
                        </div>
                        <div className="text-center p-2 bg-zinc-800/50 rounded-lg">
                          <p className="text-[#10B981] font-bold text-lg">3</p>
                          <p className="text-zinc-500 text-xs">Rounds</p>
                        </div>
                        <div className="text-center p-2 bg-zinc-800/50 rounded-lg">
                          <p className="text-[#F59E0B] font-bold text-lg">156</p>
                          <p className="text-zinc-500 text-xs">Followers</p>
                        </div>
                      </div>

                      {/* Active Round */}
                      <div className="bg-zinc-800/30 rounded-xl p-3 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-zinc-400 text-xs">Active Round</span>
                          <span className="text-[#10B981] text-xs font-medium">● Live</span>
                        </div>
                        <p className="text-white font-semibold text-sm mb-1">7-Day Core Challenge</p>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500 text-xs">32 participants</span>
                          <span className="text-zinc-500 text-xs">Day 4/7</span>
                        </div>
                      </div>

                      {/* Earnings Preview */}
                      <div className="bg-gradient-to-br from-[#F59E0B]/20 to-transparent rounded-xl p-3 mb-3 border border-[#F59E0B]/20">
                        <p className="text-zinc-400 text-xs mb-1">This Month</p>
                        <p className="text-[#F59E0B] font-bold text-2xl">$247</p>
                        <p className="text-zinc-500 text-xs">+18% from last month</p>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex-1 flex flex-col justify-end gap-2">
                        <div className="bg-[#E0FE10] rounded-xl py-3 text-center">
                          <span className="text-black font-bold text-sm">+ New Move</span>
                        </div>
                        <div className="bg-zinc-800 rounded-xl py-3 text-center">
                          <span className="text-white font-medium text-sm">Launch Round</span>
                        </div>
                      </div>
                    </div>
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
                <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                <span className="text-zinc-400 text-sm">Built for Creators</span>
              </motion.div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 tracking-tight">
                <span className="text-white">Turn Workouts Into</span>
                <br />
                <span className="text-[#F59E0B]">Revenue</span>
              </h1>
              
              <p className="text-zinc-400 text-lg lg:text-xl leading-relaxed mb-8">
                Launch challenges. Build community. Earn recurring income — without 
                needing a massive following or selling programs.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <motion.button
                  onClick={handleLaunchChallenge}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-4 rounded-xl bg-[#F59E0B] text-black font-bold shadow-lg shadow-[#F59E0B]/30 flex items-center justify-center gap-2"
                >
                  Start Creating
                  <FaArrowRight className="h-4 w-4" />
                </motion.button>
                <motion.a
                  href="#how-it-works"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-colors text-center"
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
              Growing as a fitness creator is <span className="text-zinc-500">broken</span>.
              </h2>
            
            <div className="space-y-6 text-zinc-300 text-lg leading-relaxed max-w-2xl mx-auto">
              <p>
                Social platforms pay pennies. Programs take months to build. One-on-one coaching 
                doesn't scale. And communities lose momentum between launches.
              </p>
              <p>
                You're stuck choosing between <span className="text-white font-medium">grinding for views</span> or 
                <span className="text-white font-medium"> building courses</span> that take forever.
              </p>
              <p className="text-[#F59E0B] font-medium text-xl">
                There's a better way — challenges that pay you when people show up.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The Numbers - Stats Grid */}
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
              Why Creators Switch to Pulse
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              The <span className="text-[#E0FE10]">Numbers</span> Speak
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Challenges outperform every other monetization model for fitness creators.
            </p>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
            <StatCard stat="4x" label="Higher engagement vs posting to feed" color="#E0FE10" delay={0.1} />
            <StatCard stat="73%" label="Of participants complete challenges" color="#F59E0B" delay={0.2} />
            <StatCard stat="$0" label="Upfront cost to get started" color="#10B981" delay={0.3} />
            <StatCard stat="20" label="People is all you need to start" color="#3B82F6" delay={0.4} />
          </div>

          {/* Key Benefits */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <GlassCard accentColor="#F59E0B" delay={0.1}>
              <div className="p-6">
                <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/15 flex items-center justify-center mb-4">
                  <span className="text-2xl">💰</span>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Recurring Revenue</h3>
                <p className="text-zinc-400 text-sm">
                  Earn monthly from participants. No more one-time sales or chasing brand deals.
                </p>
              </div>
            </GlassCard>

            <GlassCard accentColor="#E0FE10" delay={0.2}>
              <div className="p-6">
                <div className="w-12 h-12 rounded-xl bg-[#E0FE10]/15 flex items-center justify-center mb-4">
                  <span className="text-2xl">📱</span>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Phone-Quality Content</h3>
                <p className="text-zinc-400 text-sm">
                  No studio needed. Record 5-30 second clips from workouts you already do.
                </p>
              </div>
            </GlassCard>

            <GlassCard accentColor="#10B981" delay={0.3}>
              <div className="p-6">
                <div className="w-12 h-12 rounded-xl bg-[#10B981]/15 flex items-center justify-center mb-4">
                  <span className="text-2xl">🔥</span>
                    </div>
                <h3 className="text-white font-bold text-lg mb-2">Built-in Retention</h3>
                <p className="text-zinc-400 text-sm">
                  Leaderboards, streaks, and community keep people coming back daily.
                </p>
                    </div>
            </GlassCard>

            <GlassCard accentColor="#3B82F6" delay={0.4}>
              <div className="p-6">
                <div className="w-12 h-12 rounded-xl bg-[#3B82F6]/15 flex items-center justify-center mb-4">
                  <span className="text-2xl">📊</span>
                  </div>
                <h3 className="text-white font-bold text-lg mb-2">Real Analytics</h3>
                <p className="text-zinc-400 text-sm">
                  See exactly who's engaging, what content works, and how you're growing.
                </p>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Video Walkthrough */}
      <section className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <span className="text-[#F59E0B] text-4xl sm:text-5xl font-bold italic mb-2 block">2 minutes</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              to launch your first challenge
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Watch how easy it is to go from zero to earning.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="flex justify-center"
          >
            <GlassCard accentColor="#F59E0B" className="max-w-[420px] w-full">
              <div className="aspect-[9/16] rounded-2xl overflow-hidden">
                  <iframe
                    className="w-full h-full"
                    src="https://www.youtube-nocookie.com/embed/MZ_CSr0Cyzs?rel=0&modestbranding=1&playsinline=1"
                    title="How to Launch Your First Challenge on Pulse"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
            </GlassCard>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-8"
          >
              <a
                href="https://www.youtube.com/watch?v=MZ_CSr0Cyzs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors"
              >
                <FaPlay className="h-3 w-3" />
              Watch on YouTube
              </a>
          </motion.div>
          </div>
        </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative py-24 px-4 bg-zinc-950/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <span className="text-[#10B981] text-sm font-semibold tracking-widest uppercase mb-4 block">
              Simple Process
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Three Steps to <span className="text-[#10B981]">Earning</span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              No courses to build. No funnels to set up. Just create, launch, and earn.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Create Moves',
                desc: 'Record short exercise clips from workouts you already do. 5-30 seconds each. Phone quality is perfect.',
                color: '#E0FE10',
                icon: '🎬'
              },
              {
                step: '02',
                title: 'Launch a Round',
                desc: 'Bundle your Moves into a challenge. Set the duration, rules, and invite your community.',
                color: '#10B981',
                icon: '🚀'
              },
              {
                step: '03',
                title: 'Earn Monthly',
                desc: 'Participants subscribe to join. You earn when they show up. Real engagement, real revenue.',
                color: '#F59E0B',
                icon: '💰'
              }
            ].map((item, idx) => (
              <GlassCard key={item.step} accentColor={item.color} delay={idx * 0.15}>
                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <span 
                      className="text-5xl font-bold opacity-30"
                      style={{ color: item.color }}
                    >
                      {item.step}
                    </span>
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${item.color}20` }}
                    >
                      <span className="text-2xl">{item.icon}</span>
            </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              </GlassCard>
              ))}
            </div>
          </div>
        </section>

      {/* SoulCycle Case Study */}
      <section className="relative py-24 px-4">
          <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <span className="text-[#E0FE10] text-sm font-semibold tracking-widest uppercase mb-4 block">
              Case Study
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Real Results from <span className="text-[#E0FE10]">Real Creators</span>
            </h2>
          </motion.div>

          <GlassCard accentColor="#E0FE10" delay={0.2}>
            <div className="p-0">
              {/* Header */}
              <div className="bg-zinc-800/50 px-8 py-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center">
                    <span className="text-black font-bold text-xl">SC</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">SoulCycle Buckhead, Atlanta</h3>
                    <p className="text-zinc-400">Two instructor-led challenges</p>
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-8">
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <h4 className="text-lg font-bold mb-4 text-[#E0FE10]">What They Did</h4>
                    <ul className="space-y-3">
                      {[
                        'Kickoff ride hosted in studio',
                        'Daily at-home workouts via Pulse',
                        'Closing event and prize presentation'
                      ].map((item, idx) => (
                        <motion.li 
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-start gap-3 text-zinc-300"
                        >
                          <span className="text-[#E0FE10] mt-1">✓</span>
                          <span>{item}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold mb-4 text-[#E0FE10]">The Results</h4>
                    <div className="space-y-4">
                      <div className="bg-zinc-800/50 rounded-xl p-4 border border-[#E0FE10]/20">
                        <div className="text-4xl font-bold text-[#E0FE10]">25%</div>
                        <div className="text-zinc-400">of participants had never ridden SoulCycle</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-xl p-4 border border-[#10B981]/20">
                        <div className="text-4xl font-bold text-[#10B981]">30%</div>
                        <div className="text-zinc-400">of lapsed riders returned after the challenge</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-xl p-6">
                  <p className="text-zinc-300 text-center">
                    <strong className="text-white">The takeaway:</strong> Challenges drive new customer acquisition, 
                    re-engage lapsed members, and empower instructors to build their own following.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>
          </div>
        </section>

      {/* Who This Is For */}
      <section className="relative py-24 px-4 bg-zinc-950/50">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <span className="text-[#3B82F6] text-sm font-semibold tracking-widest uppercase mb-4 block">
              Built For You
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              If You Teach <span className="text-[#3B82F6]">Fitness</span>, This Is For You
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
            {[
              { title: 'Personal Trainers', icon: '💪' },
              { title: 'Group Fitness Instructors', icon: '🏋️' },
              { title: 'Studio Instructors', icon: '🚴' },
              { title: 'Online Coaches', icon: '📱' },
              { title: 'Yoga & Pilates Teachers', icon: '🧘' },
              { title: 'Fitness Content Creators', icon: '🎥' }
            ].map((type, idx) => (
              <motion.div 
                key={type.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-center gap-3 bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-4"
              >
                <span className="text-2xl">{type.icon}</span>
                <span className="text-zinc-300 font-medium">{type.title}</span>
              </motion.div>
            ))}
          </div>

          <GlassCard accentColor="#8B5CF6" delay={0.3}>
            <div className="p-8 text-center">
              <h3 className="text-xl font-bold mb-6 text-white">You don't need:</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  'A massive following',
                  'A production studio',
                  'A custom app',
                  'A marketing team'
                ].map((item, idx) => (
                  <motion.div 
                    key={item}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    className="text-zinc-500"
                  >
                    <span className="line-through">{item}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </GlassCard>
          </div>
        </section>

      {/* CTA */}
      <section className="relative py-32 px-4">
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Ready to <span className="text-[#F59E0B]">start earning</span>?
            </h2>
            <p className="text-zinc-400 text-xl mb-10 max-w-2xl mx-auto">
              No contracts. No upfront cost. Launch your first challenge today.
            </p>
            
            <motion.button
              onClick={handleLaunchChallenge}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="px-10 py-5 rounded-xl bg-[#F59E0B] text-black font-bold text-xl shadow-lg shadow-[#F59E0B]/30 inline-flex items-center gap-3"
            >
              Launch Your First Round
              <FaArrowRight className="h-5 w-5" />
            </motion.button>
          </motion.div>
          </div>
        </section>

      {/* FAQ */}
      <section className="relative py-24 px-4 bg-zinc-950/50">
          <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Questions?
            </h2>
            <p className="text-zinc-400 text-lg">We've got answers.</p>
          </motion.div>
            
            <div className="divide-y divide-zinc-800">
              {faqItems.map((item, index) => (
                <FAQItem
                  key={index}
                  question={item.question}
                  answer={item.answer}
                  isOpen={openFAQ === index}
                  onToggle={() => setOpenFAQ(openFAQ === index ? null : index)}
                />
              ))}
            </div>
          </div>
        </section>

        <Footer />
      </div>
  );
};

export const getServerSideProps: GetServerSideProps = async () => {
  let metaData: SerializablePageMetaData | null = null;

  try {
    const firestoreData = await adminMethods.getPageMetaData('creators');
    if (firestoreData) {
      metaData = {
        ...firestoreData,
        lastUpdated: firestoreData.lastUpdated?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      };
    }
  } catch (error) {
    console.error('Error fetching page metadata:', error);
  }

  return {
    props: {
      metaData: metaData || {
        title: 'Creators | Pulse',
        description: 'Turn your workouts into recurring revenue. Launch fitness challenges, build community, and earn when people show up.',
        keywords: ['fitness creator', 'challenge', 'revenue', 'workout', 'community'],
        lastUpdated: new Date().toISOString(),
      },
    },
  };
};

export default CreatorsPage;
