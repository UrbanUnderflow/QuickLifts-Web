import React, { useEffect, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { motion, useScroll, useTransform } from 'framer-motion';
import PageHead from '../components/PageHead';

// Custom hook for intersection observer animations
const useInView = (threshold = 0.1) => {
  const [ref, setRef] = useState<HTMLElement | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold }
    );
    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref, threshold]);

  return { ref: setRef, isInView };
};

// Animated Glass Card Component
const GlassCard: React.FC<{
  children: React.ReactNode;
  accentColor?: string;
  className?: string;
  delay?: number;
  hoverGlow?: boolean;
}> = ({ children, accentColor = '#E0FE10', className = '', delay = 0, hoverGlow = true }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={hoverGlow ? { scale: 1.02, y: -5 } : undefined}
      className={`relative group ${className}`}
    >
      {/* Chromatic glow background */}
      <div 
        className="absolute -inset-1 rounded-3xl blur-xl opacity-0 group-hover:opacity-40 transition-all duration-700"
        style={{ background: `linear-gradient(135deg, ${accentColor}40, transparent 60%)` }}
      />
      
      {/* Glass surface */}
      <div className="relative rounded-3xl overflow-hidden backdrop-blur-xl bg-zinc-900/40 border border-white/10">
        {/* Chromatic reflection line */}
        <div 
          className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${accentColor}80, transparent)` }}
        />
        
        {/* Inner highlight */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
        
        {children}
      </div>
    </motion.div>
  );
};

// Floating orb component for background
const FloatingOrb: React.FC<{
  color: string;
  size: string;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  delay?: number;
}> = ({ color, size, position, delay = 0 }) => {
  return (
    <motion.div
      className={`absolute ${size} rounded-full blur-3xl pointer-events-none`}
      style={{ 
        backgroundColor: color,
        ...position
      }}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.3, 0.5, 0.3],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        delay,
        ease: "easeInOut"
      }}
    />
  );
};

// Stat Badge Component
const StatBadge: React.FC<{
  value: string;
  label: string;
  accentColor?: string;
  delay?: number;
}> = ({ value, label, accentColor = '#E0FE10', delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="text-center"
    >
      <div className="relative inline-block">
        <div 
          className="absolute inset-0 rounded-2xl blur-xl opacity-30"
          style={{ backgroundColor: accentColor }}
        />
        <div 
          className="relative px-6 py-4 rounded-2xl backdrop-blur-xl bg-zinc-900/60 border"
          style={{ borderColor: `${accentColor}40` }}
        >
          <p 
            className="text-3xl md:text-4xl font-bold mb-1"
            style={{ color: accentColor }}
          >
            {value}
          </p>
          <p className="text-zinc-400 text-sm">{label}</p>
        </div>
      </div>
    </motion.div>
  );
};

const OnePager: NextPage = () => {
  const { scrollYProgress } = useScroll();
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);

  return (
    <>
      <PageHead 
        metaData={{
          pageId: "one-pager",
          pageTitle: "Pulse Fitness Collective | Business Overview",
          metaDescription: "Pulse is a creator-first, AI-powered fitness platform where subscribers create personalized workouts the same way they build Spotify playlists, combining short exercise videos from multiple creators.",
          ogTitle: "Pulse Fitness Collective | Business Overview",
          ogDescription: "Creator-first, AI-powered fitness platform. $6.2k recurring revenue, 144 active subscribers, 74% retention. Seeking $1.4M pre-seed.",
          ogImage: "https://fitwithpulse.ai/og-image.png?title=Pulse%20Fitness%20Collective",
          ogType: "website",
          twitterCard: "summary_large_image",
          twitterTitle: "Pulse Fitness Collective | Business Overview",
          twitterDescription: "Creator-first, AI-powered fitness platform. $6.2k recurring revenue, 144 active subscribers, 74% retention.",
          lastUpdated: new Date().toISOString()
        }}
        pageOgUrl="https://fitwithpulse.ai/one-pager"
      />
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="min-h-screen bg-[#0a0a0b] text-white overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Animated Background Layer */}
        <div className="fixed inset-0 pointer-events-none">
          <motion.div style={{ y: backgroundY }} className="absolute inset-0">
            <FloatingOrb color="#E0FE10" size="w-[600px] h-[600px]" position={{ top: '-10%', left: '-10%' }} delay={0} />
            <FloatingOrb color="#3B82F6" size="w-[500px] h-[500px]" position={{ top: '20%', right: '-5%' }} delay={2} />
            <FloatingOrb color="#8B5CF6" size="w-[400px] h-[400px]" position={{ bottom: '10%', left: '20%' }} delay={4} />
          </motion.div>
          
          {/* Noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />
        </div>

        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="mx-4 mt-4" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-7xl mx-auto px-6 py-4 rounded-2xl backdrop-blur-xl bg-zinc-900/30 border border-white/10"
            >
              <div className="flex items-center justify-between">
                <a href="/" className="flex items-center gap-3">
                  <img src="/pulse-logo-green.svg" alt="Pulse" className="h-8 w-auto" />
                  <span className="text-zinc-400 text-sm">Business Overview</span>
                </a>
                <a 
                  href="/"
                  className="px-4 py-2 rounded-full bg-[#E0FE10] text-black text-sm font-semibold hover:bg-[#d4f00f] transition-colors"
                >
                  Back to Pulse
                </a>
              </div>
            </motion.div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center px-4 pt-32 pb-20">
          <div className="relative z-10 max-w-6xl mx-auto">
            {/* Company Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full backdrop-blur-xl bg-white/5 border border-white/10"
            >
              <span className="w-2 h-2 rounded-full bg-[#E0FE10] animate-pulse" />
              <span className="text-zinc-400 text-sm">Pre-seed • Founded 2024</span>
            </motion.div>

            {/* Main Title */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight"
            >
              <span className="bg-gradient-to-r from-[#E0FE10] via-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">
                Pulse Fitness
              </span>
              <br />
              <span className="text-white">Collective</span>
            </motion.h1>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="text-xl md:text-2xl text-zinc-400 max-w-3xl mb-12 leading-relaxed"
            >
              Creator-first, AI-powered fitness platform where subscribers create personalized workouts 
              the same way they build Spotify playlists, combining short exercise videos from multiple creators.
            </motion.p>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="flex flex-wrap items-center gap-6 text-zinc-400"
            >
              <a href="mailto:tre@fitwithpulse.ai" className="hover:text-[#E0FE10] transition-colors">
                tre@fitwithpulse.ai
              </a>
              <span className="text-zinc-600">•</span>
              <a href="tel:+19545484221" className="hover:text-[#E0FE10] transition-colors">
                (954) 548-4221
              </a>
              <span className="text-zinc-600">•</span>
              <a href="https://fitwithpulse.ai" className="hover:text-[#E0FE10] transition-colors">
                fitwithpulse.ai
              </a>
            </motion.div>
          </div>
        </section>

        {/* Product Section */}
        <section className="relative py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <span className="text-[#E0FE10] text-sm font-semibold tracking-widest uppercase mb-4 block">
                The Product
              </span>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">How Pulse Works</h2>
            </motion.div>

            <GlassCard accentColor="#E0FE10" delay={0.1}>
              <div className="p-8 md:p-12">
                <p className="text-xl text-zinc-300 leading-relaxed mb-6">
                  Pulse turns short exercise videos from creators into personalized, playlist-style workouts 
                  that subscribers build and follow. Creators can reach new audiences, deepen engagement, and 
                  earn recurring income based on the usage of their content.
                </p>
                
                <div className="grid md:grid-cols-2 gap-6 mt-8">
                  <div className="p-6 rounded-2xl bg-[#E0FE10]/5 border border-[#E0FE10]/20">
                    <div className="w-3 h-3 rounded-full bg-[#E0FE10] mb-4" />
                    <h4 className="text-white font-semibold mb-2">Community-Driven Experience</h4>
                    <p className="text-zinc-400 text-sm m-0">
                      Creators benefit from cross-discovery across the entire platform
                    </p>
                  </div>
                  <div className="p-6 rounded-2xl bg-[#3B82F6]/5 border border-[#3B82F6]/20">
                    <div className="w-3 h-3 rounded-full bg-[#3B82F6] mb-4" />
                    <h4 className="text-white font-semibold mb-2">AI-Powered Personalization</h4>
                    <p className="text-zinc-400 text-sm m-0">
                      AI helps personalize recommendations and streamline creation workflows
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Problem Section */}
        <section className="relative py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <GlassCard accentColor="#EF4444" delay={0.1}>
              <div className="p-8 md:p-12">
                <span className="text-[#EF4444] text-sm font-semibold tracking-widest uppercase mb-4 block">
                  The Problem
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                  Fitness Creators Have No Scalable Way to Monetize
                </h2>
                <p className="text-xl text-zinc-300 leading-relaxed">
                  Fitness creators and instructors have no scalable way to monetize their expertise. 
                  They rely on social media or one-to-one training, which limits reach, and creates financial 
                  instability. Also, fitness seekers want to workout with creators they love.
                </p>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Founder Section */}
        <section className="relative py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <span className="text-[#3B82F6] text-sm font-semibold tracking-widest uppercase mb-4 block">
                Leadership
              </span>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">Tremaine Grant</h2>
              <p className="text-zinc-400 text-lg">CEO / Technical Founder</p>
            </motion.div>

            <GlassCard accentColor="#3B82F6" delay={0.1}>
              <div className="p-8 md:p-12">
                <div className="grid md:grid-cols-3 gap-8">
                  <div className="md:col-span-1">
                    <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-[#3B82F6]/20 to-[#3B82F6]/5 border border-[#3B82F6]/30 flex items-center justify-center mb-6">
                      <span className="text-5xl">👤</span>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-lg text-zinc-300 leading-relaxed mb-4">
                      Tremaine brings 10+ years of tech experience, personal training, and elite athletic 
                      background as a former Division 1 Track & Field athlete at Florida State University. 
                      His career spans as a Principle Engineer leading technical development and system 
                      architecture across the industry at General Motors, Meridian Healthcare, IQVIA, 
                      Pfizer, Eli Lilly, and Warby Parker.
                    </p>
                    <p className="text-lg text-zinc-300 leading-relaxed">
                      As a serial entrepreneur, he founded and scaled a previous fitness app called BULK 
                      to over 200k+ users across 70+ countries, demonstrating his ability to build impactful 
                      global communities. His unique blend of technical expertise and athletic ability drives 
                      his passion for innovating in the fitness technology space.
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Traction Section */}
        <section className="relative py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <span className="text-[#8B5CF6] text-sm font-semibold tracking-widest uppercase mb-4 block">
                Traction
              </span>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">Our Progress</h2>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
              <StatBadge value="$6.2k" label="Recurring Revenue" accentColor="#E0FE10" delay={0.1} />
              <StatBadge value="144" label="Active Subscribers" accentColor="#3B82F6" delay={0.2} />
              <StatBadge value="74%" label="Retention Rate" accentColor="#8B5CF6" delay={0.3} />
              <StatBadge value="1,000+" label="Total Users" accentColor="#EF4444" delay={0.4} />
            </div>

            <GlassCard accentColor="#8B5CF6" delay={0.5}>
              <div className="p-8 md:p-12">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-4">Key Milestones</h3>
                    <ul className="space-y-3 text-zinc-300">
                      <li className="flex items-start gap-3">
                        <span className="text-[#8B5CF6] mt-1">✓</span>
                        <span>Launched on iOS and Web January 2025</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-[#8B5CF6] mt-1">✓</span>
                        <span>Tier 1 partnership w/ SoulCycle with a path to deeper collaboration</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-[#8B5CF6] mt-1">✓</span>
                        <span>5-star Apple App Store rating</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-[#8B5CF6] mt-1">✓</span>
                        <span>Hired Chief of Staff, Product & Brand Designer, and Digital Creators Lead</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-[#8B5CF6] mt-1">✓</span>
                        <span>Provisional Patent on end-to-end system architecture</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-4">Growth Drivers</h3>
                    <p className="text-zinc-300 leading-relaxed mb-4">
                      Three creator-led challenges that consistently drive new subscriptions
                    </p>
                    <div className="p-4 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20">
                      <p className="text-sm text-zinc-400 mb-2">Current Raise</p>
                      <p className="text-3xl font-bold text-[#8B5CF6]">$1.4M</p>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Revenue Model Section */}
        <section className="relative py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <span className="text-[#E0FE10] text-sm font-semibold tracking-widest uppercase mb-4 block">
                Revenue Model
              </span>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">How We Monetize</h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              <GlassCard accentColor="#E0FE10" delay={0.1}>
                <div className="p-8">
                  <div className="w-12 h-12 rounded-xl bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center mb-4">
                    <span className="text-2xl">👥</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">User Subscriptions</h3>
                  <p className="text-zinc-400 mb-4">$4.99 monthly or $39.99 annual subscription for users</p>
                </div>
              </GlassCard>

              <GlassCard accentColor="#3B82F6" delay={0.2}>
                <div className="p-8">
                  <div className="w-12 h-12 rounded-xl bg-[#3B82F6]/20 border border-[#3B82F6]/30 flex items-center justify-center mb-4">
                    <span className="text-2xl">🎨</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Creator Accounts</h3>
                  <p className="text-zinc-400 mb-4">$79.99 annual creator monetization account</p>
                </div>
              </GlassCard>

              <GlassCard accentColor="#8B5CF6" delay={0.3}>
                <div className="p-8">
                  <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 flex items-center justify-center mb-4">
                    <span className="text-2xl">🏆</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Premium Challenges</h3>
                  <p className="text-zinc-400 mb-4">3% on premium priced digital fitness challenges</p>
                </div>
              </GlassCard>
            </div>
          </div>
        </section>

        {/* Market Section */}
        <section className="relative py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <span className="text-[#3B82F6] text-sm font-semibold tracking-widest uppercase mb-4 block">
                Market Opportunity
              </span>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">Total Addressable Market</h2>
            </motion.div>

            <GlassCard accentColor="#3B82F6" delay={0.1}>
              <div className="p-8 md:p-12">
                <div className="grid md:grid-cols-3 gap-8">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-[#3B82F6] mb-2">$4.2B</p>
                    <p className="text-zinc-400 text-sm mb-1">Beachhead TAM</p>
                    <p className="text-zinc-500 text-xs">350,000 trainers × $12,000</p>
                  </div>
                  <div className="text-center">
                    <p className="text-4xl font-bold text-[#8B5CF6] mb-2">$12B</p>
                    <p className="text-zinc-400 text-sm mb-1">Adjacent Market TAM</p>
                    <p className="text-zinc-500 text-xs">~1M creators × $12,000</p>
                  </div>
                  <div className="text-center">
                    <p className="text-4xl font-bold text-[#E0FE10] mb-2">$16.2B</p>
                    <p className="text-zinc-400 text-sm mb-1">Total Creator TAM</p>
                    <p className="text-zinc-500 text-xs">Combined opportunity</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Comparables Section */}
        <section className="relative py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <span className="text-[#EF4444] text-sm font-semibold tracking-widest uppercase mb-4 block">
                Comparables
              </span>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">Market Context</h2>
            </motion.div>

            <GlassCard accentColor="#EF4444" delay={0.1}>
              <div className="p-8 md:p-12 overflow-x-auto">
                <div className="min-w-full">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-4 px-4 text-zinc-400 font-semibold text-sm">Company</th>
                        <th className="text-left py-4 px-4 text-zinc-400 font-semibold text-sm">Launch</th>
                        <th className="text-left py-4 px-4 text-zinc-400 font-semibold text-sm">Total Funding/Exit</th>
                        <th className="text-left py-4 px-4 text-zinc-400 font-semibold text-sm">Revenue/ARR</th>
                        <th className="text-left py-4 px-4 text-zinc-400 font-semibold text-sm">Revenue Model</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-white/5">
                        <td className="py-4 px-4 text-white font-medium">Instagram</td>
                        <td className="py-4 px-4 text-zinc-300">2020</td>
                        <td className="py-4 px-4 text-zinc-300">$12M raised</td>
                        <td className="py-4 px-4 text-zinc-300">$8M-$12M ARR</td>
                        <td className="py-4 px-4 text-zinc-300">$29.99/mo</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-4 px-4 text-white font-medium">FitBod</td>
                        <td className="py-4 px-4 text-zinc-300">2015</td>
                        <td className="py-4 px-4 text-zinc-300">$25.9M raised</td>
                        <td className="py-4 px-4 text-zinc-300">$10-20M</td>
                        <td className="py-4 px-4 text-zinc-300">$12.99/month</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-4 px-4 text-white font-medium">Trainerize</td>
                        <td className="py-4 px-4 text-zinc-300">2008</td>
                        <td className="py-4 px-4 text-zinc-300">Acquired by ABC Financial</td>
                        <td className="py-4 px-4 text-zinc-300">$30-40M</td>
                        <td className="py-4 px-4 text-zinc-300">$75-$225/month</td>
                      </tr>
                      <tr className="bg-[#E0FE10]/10">
                        <td className="py-4 px-4 text-[#E0FE10] font-bold">Pulse</td>
                        <td className="py-4 px-4 text-[#E0FE10] font-bold">2024</td>
                        <td className="py-4 px-4 text-[#E0FE10] font-bold">Seeking $1.4M</td>
                        <td className="py-4 px-4 text-[#E0FE10] font-bold">$6.2k</td>
                        <td className="py-4 px-4 text-[#E0FE10] font-bold">$4.99/month $39.99/annual</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-32 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="relative">
                {/* Glow background */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#E0FE10]/20 via-[#3B82F6]/20 to-[#8B5CF6]/20 blur-3xl" />
                
                <div className="relative backdrop-blur-xl bg-zinc-900/30 border border-white/10 rounded-3xl p-12 md:p-16">
                  <span className="text-[#E0FE10] text-sm font-semibold tracking-widest uppercase mb-4 block">
                    Get In Touch
                  </span>
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                    Let's Build the Future of Fitness Together
                  </h2>
                  <p className="text-zinc-400 text-lg mb-8 max-w-xl mx-auto">
                    Interested in learning more, investing, or partnering? We'd love to connect.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <motion.a
                      href="mailto:tre@fitwithpulse.ai"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-8 py-4 rounded-xl bg-[#E0FE10] text-black font-bold text-lg shadow-lg shadow-[#E0FE10]/30 hover:shadow-[#E0FE10]/50 transition-shadow"
                    >
                      Contact Us
                    </motion.a>
                    <motion.a
                      href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-8 py-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white font-semibold text-lg hover:bg-white/10 transition-colors"
                    >
                      Download the App
                    </motion.a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative py-12 px-4 border-t border-white/10" style={{ paddingBottom: 'calc(3rem + env(safe-area-inset-bottom))' }}>
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/pulse-logo-green.svg" alt="Pulse" className="h-6 w-auto" />
              <span className="text-zinc-500 text-sm">Pulse Fitness Collective</span>
            </div>
            <p className="text-zinc-500 text-sm">
              © {new Date().getFullYear()} Pulse Intelligence Labs, Inc.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default OnePager;
