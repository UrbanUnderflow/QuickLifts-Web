import React, { useEffect, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { motion, useScroll, useTransform } from 'framer-motion';

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

// Color Swatch Component
const ColorSwatch: React.FC<{
  name: string;
  color: string;
  hex: string;
  delay?: number;
}> = ({ name, color, hex, delay = 0 }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group cursor-pointer"
    >
      {/* Glow effect */}
      <motion.div
        animate={{ 
          scale: isHovered ? 1.5 : 1,
          opacity: isHovered ? 0.6 : 0.2
        }}
        transition={{ duration: 0.4 }}
        className="absolute inset-0 rounded-2xl blur-2xl"
        style={{ backgroundColor: color }}
      />
      
      <div className="relative h-32 rounded-2xl overflow-hidden border border-white/10 backdrop-blur-sm">
        <div 
          className="absolute inset-0 transition-transform duration-500 group-hover:scale-110"
          style={{ backgroundColor: color }}
        />
        
        {/* Glass overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/30" />
        
        {/* Shimmer effect */}
        <motion.div
          animate={{ x: isHovered ? '200%' : '-100%' }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
        />
        
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/40 backdrop-blur-sm">
          <p className="text-white font-semibold text-sm">{name}</p>
          <p className="text-white/60 text-xs font-mono">{hex}</p>
        </div>
      </div>
    </motion.div>
  );
};

// Animated Pattern Card
const PatternCard: React.FC<{
  title: string;
  description: string;
  children: React.ReactNode;
  accentColor: string;
  delay?: number;
}> = ({ title, description, children, accentColor, delay = 0 }) => {
  return (
    <GlassCard accentColor={accentColor} delay={delay}>
      <div className="p-6 md:p-8">
        <div className="mb-6 h-48 rounded-2xl overflow-hidden bg-zinc-950/50 border border-white/5 flex items-center justify-center">
          {children}
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
      </div>
    </GlassCard>
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

const ChromaticGlassPage: NextPage = () => {
  const { scrollYProgress } = useScroll();
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  
  const colors = {
    primary: {
      green: { name: 'Primary Green', color: '#E0FE10', hex: '#E0FE10' },
      blue: { name: 'Primary Blue', color: '#3B82F6', hex: '#3B82F6' },
      purple: { name: 'Primary Purple', color: '#8B5CF6', hex: '#8B5CF6' },
      red: { name: 'Secondary Red', color: '#EF4444', hex: '#EF4444' },
    },
    foundation: {
      white: { name: 'Secondary White', color: '#FAFAFA', hex: '#FAFAFA' },
      charcoal: { name: 'Secondary Charcoal', color: '#1C1C1E', hex: '#1C1C1E' },
      black: { name: 'Secondary Black', color: '#0D0D0D', hex: '#0D0D0D' },
      slate: { name: 'Slate', color: '#64748B', hex: '#64748B' },
    }
  };

  return (
    <>
      <Head>
        <title>Chromatic Glass | Pulse Design Language</title>
        <meta name="description" content="Chromatic Glass - Pulse's take on glassmorphic design. Dark luxury polish with colors that pop and reflect like glass." />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://fitwithpulse.ai/chromatic-glass" />
        <meta property="og:title" content="Chromatic Glass | Pulse Design Language" />
        <meta property="og:description" content="Our take on glassmorphic design — dark luxury polish with colors that pop and reflect like glass." />
        <meta property="og:image" content="https://fitwithpulse.ai/og-image.png?title=Chromatic%20Glass&subtitle=Dark%20Luxury%20Meets%20Chromatic%20Light" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://fitwithpulse.ai/chromatic-glass" />
        <meta name="twitter:title" content="Chromatic Glass | Pulse Design Language" />
        <meta name="twitter:description" content="Our take on glassmorphic design — dark luxury polish with colors that pop and reflect like glass." />
        <meta name="twitter:image" content="https://fitwithpulse.ai/og-image.png?title=Chromatic%20Glass&subtitle=Dark%20Luxury%20Meets%20Chromatic%20Light" />
      </Head>

      <div className="min-h-screen bg-[#0a0a0b] text-white overflow-hidden">
        {/* Animated Background Layer */}
        <div className="fixed inset-0 pointer-events-none">
          <motion.div style={{ y: backgroundY }} className="absolute inset-0">
            <FloatingOrb color="#E0FE10" size="w-[600px] h-[600px]" position={{ top: '-10%', left: '-10%' }} delay={0} />
            <FloatingOrb color="#3B82F6" size="w-[500px] h-[500px]" position={{ top: '20%', right: '-5%' }} delay={2} />
            <FloatingOrb color="#8B5CF6" size="w-[400px] h-[400px]" position={{ bottom: '10%', left: '20%' }} delay={4} />
            <FloatingOrb color="#EF4444" size="w-[350px] h-[350px]" position={{ bottom: '-5%', right: '30%' }} delay={6} />
          </motion.div>
          
          {/* Noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />
        </div>

        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50">
          <div className="mx-4 mt-4">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-7xl mx-auto px-6 py-4 rounded-2xl backdrop-blur-xl bg-zinc-900/30 border border-white/10"
            >
              <div className="flex items-center justify-between">
                <a href="/" className="flex items-center gap-3">
                  <img src="/pulse-logo-green.svg" alt="Pulse" className="h-8 w-auto" />
                  <span className="text-zinc-400 text-sm">/ Design Language</span>
                </a>
                <nav className="hidden md:flex items-center gap-6">
                  <a href="#philosophy" className="text-zinc-400 hover:text-white text-sm transition-colors">Philosophy</a>
                  <a href="#colors" className="text-zinc-400 hover:text-white text-sm transition-colors">Colors</a>
                  <a href="#patterns" className="text-zinc-400 hover:text-white text-sm transition-colors">Patterns</a>
                  <a href="#components" className="text-zinc-400 hover:text-white text-sm transition-colors">Components</a>
                </nav>
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
          <div className="relative z-10 max-w-5xl mx-auto text-center">
            {/* Floating badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full backdrop-blur-xl bg-white/5 border border-white/10"
            >
              <span className="w-2 h-2 rounded-full bg-[#E0FE10] animate-pulse" />
              <span className="text-zinc-400 text-sm">Pulse Design Language v2.0</span>
            </motion.div>

            {/* Main Title */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-6xl md:text-8xl lg:text-9xl font-bold mb-6 tracking-tight"
            >
              <span className="bg-gradient-to-r from-[#E0FE10] via-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">
                Chromatic
              </span>
              <br />
              <span className="text-white">Glass</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              Our take on glassmorphic design — where dark luxury meets{' '}
              <span className="text-[#E0FE10]">chromatic reflections</span>. 
              Colors that pop and refract like light through stained glass.
            </motion.p>

            {/* Scroll indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="flex flex-col items-center gap-2"
            >
              <span className="text-zinc-500 text-sm">Scroll to explore</span>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-6 h-10 rounded-full border-2 border-zinc-700 flex items-start justify-center p-2"
              >
                <motion.div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10]" />
              </motion.div>
            </motion.div>
          </div>

          {/* Hero Glass Cards */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              initial={{ opacity: 0, x: -100, rotate: -12 }}
              animate={{ opacity: 0.6, x: 0, rotate: -12 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="absolute top-[20%] -left-[5%] w-64 h-80"
            >
              <div className="w-full h-full rounded-3xl backdrop-blur-xl bg-gradient-to-br from-[#E0FE10]/20 to-transparent border border-[#E0FE10]/20" />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 100, rotate: 12 }}
              animate={{ opacity: 0.6, x: 0, rotate: 12 }}
              transition={{ duration: 1, delay: 1 }}
              className="absolute top-[30%] -right-[5%] w-72 h-96"
            >
              <div className="w-full h-full rounded-3xl backdrop-blur-xl bg-gradient-to-br from-[#8B5CF6]/20 to-transparent border border-[#8B5CF6]/20" />
            </motion.div>
          </div>
        </section>

        {/* Editorial: What is Glassmorphism */}
        <section className="relative py-32 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.article
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="prose prose-invert prose-lg"
            >
              <span className="text-zinc-500 text-sm font-semibold tracking-widest uppercase mb-4 block">
                The Foundation
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 leading-tight">
                What is Glassmorphism?
              </h2>
              
              <div className="space-y-6 text-zinc-300 text-lg leading-relaxed">
                <p>
                  Glassmorphism emerged as a design trend around 2020, drawing inspiration from the translucent, 
                  frosted glass panels found in modern architecture and Apple's macOS Big Sur interface. At its core, 
                  it's about creating the illusion of frosted glass — surfaces that blur what's behind them while 
                  maintaining a sense of depth and layering.
                </p>
                
                <p>
                  The technique relies on a few key properties: <span className="text-white font-medium">background blur</span>, 
                  <span className="text-white font-medium"> transparency</span>, and <span className="text-white font-medium">subtle borders</span>. 
                  When combined, these create UI elements that feel like they exist in physical space — floating panels 
                  that catch light, reveal hints of what lies beneath, and stack with natural hierarchy.
                </p>

                <div className="my-12 p-8 rounded-3xl backdrop-blur-xl bg-white/5 border border-white/10">
                  <p className="text-zinc-400 text-base italic m-0">
                    "Glassmorphism isn't just an aesthetic choice — it's a way of creating interfaces that feel 
                    tangible, layered, and alive. When done right, it makes digital spaces feel physical."
                  </p>
                </div>

                <p>
                  But here's the thing: glassmorphism on its own can feel cold. Clinical. It needed something more — 
                  something that would give it warmth and energy without sacrificing that premium, polished feel.
                </p>
              </div>
            </motion.article>
          </div>
        </section>

        {/* Editorial: The Chromatic Fusion */}
        <section className="relative py-32 px-4 overflow-hidden">
          {/* Colored glow accents */}
          <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-[#E0FE10]/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-[#8B5CF6]/10 rounded-full blur-3xl translate-x-1/2" />
          
          <div className="relative max-w-4xl mx-auto">
            <motion.article
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <span className="text-[#E0FE10] text-sm font-semibold tracking-widest uppercase mb-4 block">
                The Evolution
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 leading-tight">
                From Glass to{' '}
                <span className="bg-gradient-to-r from-[#E0FE10] via-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">
                  Chromatic Glass
                </span>
              </h2>
              
              <div className="space-y-6 text-zinc-300 text-lg leading-relaxed">
                <p>
                  We looked at glassmorphism and asked: what if the glass wasn't just frosted, but{' '}
                  <span className="text-[#E0FE10] font-medium">colored</span>? What if light didn't just blur 
                  through it — what if it <span className="text-[#3B82F6] font-medium">refracted</span>, 
                  casting chromatic reflections like stained glass in a cathedral?
                </p>
                
                <p>
                  That's the essence of Chromatic Glass. We took the foundational principles of glassmorphism — 
                  the blur, the layering, the translucency — and infused them with bold, intentional color. 
                  Every surface in Pulse doesn't just exist; it <span className="text-white font-medium">glows</span>. 
                  It catches and reflects our signature palette.
                </p>

                <div className="grid md:grid-cols-2 gap-6 my-12">
                  <div className="p-6 rounded-2xl backdrop-blur-xl bg-[#E0FE10]/5 border border-[#E0FE10]/20">
                    <div className="w-3 h-3 rounded-full bg-[#E0FE10] mb-4" />
                    <h4 className="text-white font-semibold mb-2">Gradient Borders</h4>
                    <p className="text-zinc-400 text-base m-0">
                      Edges that fade from vibrant to subtle, creating the illusion of light catching a glass rim.
                    </p>
                  </div>
                  <div className="p-6 rounded-2xl backdrop-blur-xl bg-[#3B82F6]/5 border border-[#3B82F6]/20">
                    <div className="w-3 h-3 rounded-full bg-[#3B82F6] mb-4" />
                    <h4 className="text-white font-semibold mb-2">Chromatic Glows</h4>
                    <p className="text-zinc-400 text-base m-0">
                      Soft, colored halos that emanate from key elements, drawing focus through luminosity.
                    </p>
                  </div>
                  <div className="p-6 rounded-2xl backdrop-blur-xl bg-[#8B5CF6]/5 border border-[#8B5CF6]/20">
                    <div className="w-3 h-3 rounded-full bg-[#8B5CF6] mb-4" />
                    <h4 className="text-white font-semibold mb-2">Color Washes</h4>
                    <p className="text-zinc-400 text-base m-0">
                      Subtle tinted overlays that give each surface its own chromatic character.
                    </p>
                  </div>
                  <div className="p-6 rounded-2xl backdrop-blur-xl bg-[#EF4444]/5 border border-[#EF4444]/20">
                    <div className="w-3 h-3 rounded-full bg-[#EF4444] mb-4" />
                    <h4 className="text-white font-semibold mb-2">Tinted Shadows</h4>
                    <p className="text-zinc-400 text-base m-0">
                      Shadows that carry the hue of their source, as if light is passing through colored glass.
                    </p>
                  </div>
                </div>

                <p>
                  The result is a design language that feels both futuristic and organic — like holding a prism up to 
                  light and watching colors dance across surfaces. It's glass, but it's <span className="text-white font-medium">alive</span>.
                </p>
              </div>
            </motion.article>
          </div>
        </section>

        {/* Editorial: Why Dark? */}
        <section className="relative py-32 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.article
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <span className="text-zinc-500 text-sm font-semibold tracking-widest uppercase mb-4 block">
                The Canvas
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 leading-tight">
                Why We Chose the Dark
              </h2>
              
              <div className="space-y-6 text-zinc-300 text-lg leading-relaxed">
                <p>
                  Fitness apps are typically bright. White backgrounds, cheerful colors, energy-drink aesthetics. 
                  We went the opposite direction — and it was intentional.
                </p>
                
                <p>
                  <span className="text-white font-medium">Dark interfaces reduce eye strain</span> during early 
                  morning workouts and late-night sessions. When you're pushing through your last set at 6 AM, 
                  the last thing you need is a screen blasting white light into your face.
                </p>

                <p>
                  But beyond function, darkness creates <span className="text-white font-medium">atmosphere</span>. 
                  It's the difference between a fluorescent gym and a premium fitness studio. Dark backgrounds 
                  feel exclusive. Intentional. They say: this isn't just an app — this is an experience.
                </p>

                <div className="my-12 p-8 rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/5">
                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E0FE10]/20 to-[#E0FE10]/5 flex items-center justify-center flex-shrink-0 border border-[#E0FE10]/20">
                      <span className="text-2xl">🌙</span>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold text-xl mb-2">Dark Luxury Fitness</h4>
                      <p className="text-zinc-400 m-0">
                        Our dark foundation isn't just about looking cool — it's about creating a space where 
                        colors can truly shine. Against charcoal and black, our greens glow brighter, our blues 
                        feel deeper, and every chromatic accent commands attention.
                      </p>
                    </div>
                  </div>
                </div>

                <p>
                  Most importantly, darkness lets our chromatic elements <span className="text-[#E0FE10] font-medium">pop</span>. 
                  The lime green that defines Pulse? It would look washed out on white. On our deep charcoal canvas, 
                  it practically <span className="text-white font-medium">glows</span>. Colors become luminous. 
                  Interfaces become immersive. Every interaction feels like touching light.
                </p>

                <p>
                  That's the Pulse philosophy: <span className="text-white font-medium">dark luxury, chromatic energy</span>. 
                  A canvas that elevates every element placed upon it. An experience that feels premium from the 
                  first tap to the final rep.
                </p>
              </div>
            </motion.article>
          </div>
        </section>

        {/* Philosophy Section */}
        <section id="philosophy" className="relative py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-20"
            >
              <span className="text-[#E0FE10] text-sm font-semibold tracking-widest uppercase mb-4 block">
                Design Principles
              </span>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                The Rules We Follow
              </h2>
              <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
                Every design decision in Pulse stems from these core principles — 
                the guidelines that keep Chromatic Glass cohesive and intentional.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Principle 1 */}
              <GlassCard accentColor="#E0FE10" delay={0.1}>
                <div className="p-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E0FE10]/20 to-[#E0FE10]/5 flex items-center justify-center mb-6 border border-[#E0FE10]/20">
                    <svg className="w-8 h-8 text-[#E0FE10]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Hierarchy Through Glow</h3>
                  <p className="text-zinc-400 leading-relaxed">
                    Important elements emanate subtle radial glows. The brighter the glow, 
                    the higher the visual priority.
                  </p>
                </div>
              </GlassCard>

              {/* Principle 2 */}
              <GlassCard accentColor="#3B82F6" delay={0.2}>
                <div className="p-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3B82F6]/20 to-[#3B82F6]/5 flex items-center justify-center mb-6 border border-[#3B82F6]/20">
                    <svg className="w-8 h-8 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Cards With Character</h3>
                  <p className="text-zinc-400 leading-relaxed">
                    Every card surface has depth through gradient borders and chromatic 
                    reflections that shift with interaction.
                  </p>
                </div>
              </GlassCard>

              {/* Principle 3 */}
              <GlassCard accentColor="#8B5CF6" delay={0.3}>
                <div className="p-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B5CF6]/20 to-[#8B5CF6]/5 flex items-center justify-center mb-6 border border-[#8B5CF6]/20">
                    <svg className="w-8 h-8 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Color = Category</h3>
                  <p className="text-zinc-400 leading-relaxed">
                    Each workout type owns a signature color. Instant visual recognition 
                    through consistent chromatic coding.
                  </p>
                </div>
              </GlassCard>
            </div>
          </div>
        </section>

        {/* Color System Section */}
        <section id="colors" className="relative py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-20"
            >
              <span className="text-[#3B82F6] text-sm font-semibold tracking-widest uppercase mb-4 block">
                Color System
              </span>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                The <span className="bg-gradient-to-r from-[#E0FE10] via-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">Chromatic</span> Palette
              </h2>
              <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
                Bold, vibrant colors against deep charcoal create the perfect contrast 
                for our glassmorphic surfaces.
              </p>
            </motion.div>

            {/* Primary Colors */}
            <div className="mb-16">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
                <span className="w-8 h-[2px] bg-gradient-to-r from-[#E0FE10] to-transparent" />
                Category Colors
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ColorSwatch {...colors.primary.green} delay={0.1} />
                <ColorSwatch {...colors.primary.blue} delay={0.2} />
                <ColorSwatch {...colors.primary.purple} delay={0.3} />
                <ColorSwatch {...colors.primary.red} delay={0.4} />
              </div>
              
              {/* Color meanings */}
              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { color: '#E0FE10', label: 'Lift / Strength', icon: '🏋️' },
                  { color: '#3B82F6', label: 'Run / Cardio', icon: '🏃' },
                  { color: '#8B5CF6', label: 'Stretch / Yoga', icon: '🧘' },
                  { color: '#EF4444', label: 'Fat Burn / HIIT', icon: '🔥' },
                ].map((item, idx) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + idx * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-white/5"
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-xs font-mono text-zinc-500">{item.color}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Foundation Colors */}
            <div>
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
                <span className="w-8 h-[2px] bg-gradient-to-r from-zinc-500 to-transparent" />
                Foundation Colors
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ColorSwatch {...colors.foundation.white} delay={0.1} />
                <ColorSwatch {...colors.foundation.charcoal} delay={0.2} />
                <ColorSwatch {...colors.foundation.black} delay={0.3} />
                <ColorSwatch {...colors.foundation.slate} delay={0.4} />
              </div>
            </div>
          </div>
        </section>

        {/* Visual Patterns Section */}
        <section id="patterns" className="relative py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-20"
            >
              <span className="text-[#8B5CF6] text-sm font-semibold tracking-widest uppercase mb-4 block">
                Visual Patterns
              </span>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                Signature <span className="text-[#8B5CF6]">Effects</span>
              </h2>
              <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
                Recurring visual patterns that define the Chromatic Glass aesthetic.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Gradient Border */}
              <PatternCard
                title="Gradient Border"
                description="Premium cards use gradient strokes that fade from vibrant to subtle, creating depth and dimension."
                accentColor="#E0FE10"
                delay={0.1}
              >
                <div className="relative w-48 h-32">
                  {/* Outer glow */}
                  <motion.div
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -inset-4 rounded-3xl blur-xl bg-[#E0FE10]/20"
                  />
                  {/* Gradient border using pseudo-element technique */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#E0FE10]/60 via-[#E0FE10]/20 to-[#E0FE10]/10 p-[1px]">
                    <div className="w-full h-full rounded-2xl bg-zinc-800">
                      {/* Inner gradient wash */}
                      <div 
                        className="absolute inset-0 rounded-2xl"
                        style={{
                          background: 'linear-gradient(135deg, rgba(224,254,16,0.1) 0%, transparent 50%)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </PatternCard>

              {/* Glow Effect */}
              <PatternCard
                title="Radial Glow"
                description="Focal elements emanate soft radial glows that draw the eye and establish visual hierarchy."
                accentColor="#3B82F6"
                delay={0.2}
              >
                <div className="relative">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 w-32 h-32 rounded-full bg-[#3B82F6]/40 blur-2xl"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                    className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center"
                  >
                    <span className="text-3xl">🏆</span>
                  </motion.div>
                </div>
              </PatternCard>

              {/* Shimmer Effect */}
              <PatternCard
                title="Shimmer Loading"
                description="Elegant loading states use a traveling shimmer effect that sweeps across placeholder content."
                accentColor="#8B5CF6"
                delay={0.3}
              >
                <div className="relative w-48 h-24 rounded-xl bg-zinc-800 overflow-hidden">
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 w-1/2"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)'
                    }}
                  />
                </div>
              </PatternCard>

              {/* Pill Badge */}
              <PatternCard
                title="Pill Badges"
                description="Status indicators combine filled backgrounds with subtle strokes for a polished, premium feel."
                accentColor="#EF4444"
                delay={0.4}
              >
                <div className="flex flex-wrap gap-3 justify-center">
                  {[
                    { label: 'AI-POWERED', color: '#E0FE10' },
                    { label: 'COMPLETED', color: '#3B82F6' },
                    { label: 'ACTIVE', color: '#22C55E' },
                  ].map((badge) => (
                    <motion.div
                      key={badge.label}
                      whileHover={{ scale: 1.05 }}
                      className="px-3 py-1.5 rounded-full flex items-center gap-2"
                      style={{
                        backgroundColor: `${badge.color}15`,
                        border: `1px solid ${badge.color}40`
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: badge.color }} />
                      <span className="text-xs font-bold tracking-wider" style={{ color: badge.color }}>
                        {badge.label}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </PatternCard>
            </div>
          </div>
        </section>

        {/* Components Gallery */}
        <section id="components" className="relative py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-20"
            >
              <span className="text-[#EF4444] text-sm font-semibold tracking-widest uppercase mb-4 block">
                Component Gallery
              </span>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                Chromatic in <span className="text-[#EF4444]">Action</span>
              </h2>
              <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
                Real components from the Pulse app — each one embodying our chromatic glass philosophy.
              </p>
            </motion.div>

            {/* Workout Type Selector */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-16"
            >
              <h3 className="text-xl font-bold text-white mb-2">Workout Type Selector</h3>
              <p className="text-zinc-500 text-sm mb-6">Each category owns its chromatic identity</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Lift */}
                <motion.div
                  whileHover={{ scale: 1.03, y: -4 }}
                  className="relative group cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#E0FE10]/20 blur-xl opacity-0 group-hover:opacity-60 transition-opacity" />
                  <div className="relative h-40 rounded-2xl overflow-hidden bg-gradient-to-br from-[#E0FE10]/20 to-[#E0FE10]/5 border border-[#E0FE10]/30 flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-[#E0FE10]/20 border border-[#E0FE10]/40 flex items-center justify-center">
                      <svg className="w-7 h-7 text-[#E0FE10]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
                      </svg>
                    </div>
                    <span className="text-white font-semibold">Lift</span>
                  </div>
                </motion.div>

                {/* Run */}
                <motion.div
                  whileHover={{ scale: 1.03, y: -4 }}
                  className="relative group cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#3B82F6]/20 blur-xl opacity-0 group-hover:opacity-60 transition-opacity" />
                  <div className="relative h-40 rounded-2xl overflow-hidden bg-gradient-to-br from-[#3B82F6]/20 to-[#3B82F6]/5 border border-[#3B82F6]/30 flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-[#3B82F6]/20 border border-[#3B82F6]/40 flex items-center justify-center">
                      <svg className="w-7 h-7 text-[#3B82F6]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
                      </svg>
                    </div>
                    <span className="text-white font-semibold">Run</span>
                  </div>
                </motion.div>

                {/* Fat Burn */}
                <motion.div
                  whileHover={{ scale: 1.03, y: -4 }}
                  className="relative group cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#EF4444]/20 blur-xl opacity-0 group-hover:opacity-60 transition-opacity" />
                  <div className="relative h-40 rounded-2xl overflow-hidden bg-gradient-to-br from-[#EF4444]/20 to-[#EF4444]/5 border border-[#EF4444]/30 flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-[#EF4444]/20 border border-[#EF4444]/40 flex items-center justify-center">
                      <svg className="w-7 h-7 text-[#EF4444]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/>
                      </svg>
                    </div>
                    <span className="text-white font-semibold">Fat Burn</span>
                  </div>
                </motion.div>

                {/* Stretch */}
                <motion.div
                  whileHover={{ scale: 1.03, y: -4 }}
                  className="relative group cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#8B5CF6]/20 blur-xl opacity-0 group-hover:opacity-60 transition-opacity" />
                  <div className="relative h-40 rounded-2xl overflow-hidden bg-gradient-to-br from-[#8B5CF6]/20 to-[#8B5CF6]/5 border border-[#8B5CF6]/30 flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center">
                      <svg className="w-7 h-7 text-[#8B5CF6]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5l-4-4V4h8v3.5l-4 4z"/>
                      </svg>
                    </div>
                    <span className="text-white font-semibold">Stretch</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Run Summary Recreation */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-16"
            >
              <h3 className="text-xl font-bold text-white mb-2">Run Summary</h3>
              <p className="text-zinc-500 text-sm mb-6">A complete page bathed in chromatic blue</p>
              
              <div className="relative max-w-md mx-auto">
                {/* Blue glow background */}
                <div className="absolute inset-0 bg-[#3B82F6]/10 blur-3xl rounded-full" />
                
                <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#0c1929] to-[#0a0a0b] border border-[#3B82F6]/20 p-6">
                  {/* Header */}
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#3B82F6]/10 flex items-center justify-center">
                      <motion.div
                        animate={{ y: [0, -3, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <svg className="w-8 h-8 text-[#3B82F6]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
                        </svg>
                      </motion.div>
                    </div>
                    <h4 className="text-2xl font-bold text-white mb-2">Thursday Run</h4>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/30">
                        🏃 Free Run
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-800/50 text-zinc-400 border border-zinc-700/50">
                        📍 Outdoor
                      </span>
                    </div>
                    <p className="text-zinc-500 text-sm">Dec 31, 2025 at 11:30 PM</p>
                  </div>

                  {/* Map placeholder */}
                  <div className="relative h-40 rounded-2xl overflow-hidden mb-4 bg-gradient-to-br from-[#1a2744] to-[#0f172a] border border-[#3B82F6]/20">
                    <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />
                    <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-[#E0FE10] text-black text-xs font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-black" /> Start
                    </div>
                    <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-[#3B82F6] text-white text-xs font-bold flex items-center gap-1">
                      🏁 Finish
                    </div>
                    {/* Route line */}
                    <svg className="absolute inset-0 w-full h-full">
                      <motion.path
                        d="M 60 120 Q 120 60 180 100 Q 240 140 300 80"
                        fill="none"
                        stroke="#3B82F6"
                        strokeWidth="4"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        whileInView={{ pathLength: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 2, delay: 0.5 }}
                      />
                    </svg>
                  </div>

                  {/* Goal Achieved */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 mb-4">
                    <div className="w-12 h-12 rounded-full bg-[#3B82F6] flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-semibold">Goal Achieved!</p>
                      <p className="text-zinc-400 text-sm">Completed</p>
                    </div>
                    <span className="text-2xl">🏆</span>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-center">
                      <span className="text-[#3B82F6] text-lg mb-1 block">🗺️</span>
                      <p className="text-2xl font-bold text-white">1.4 mi</p>
                      <p className="text-zinc-500 text-xs">Distance</p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-center">
                      <span className="text-[#3B82F6] text-lg mb-1 block">⏱️</span>
                      <p className="text-2xl font-bold text-white">14:41</p>
                      <p className="text-zinc-500 text-xs">Time</p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-center">
                      <span className="text-[#F59E0B] text-lg mb-1 block">⚡</span>
                      <p className="text-2xl font-bold text-white">10:30</p>
                      <p className="text-zinc-500 text-xs">Avg Pace</p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#F97316]/10 border border-[#F97316]/20 text-center">
                      <span className="text-[#F97316] text-lg mb-1 block">🔥</span>
                      <p className="text-2xl font-bold text-white">137</p>
                      <p className="text-zinc-500 text-xs">Calories</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Creator Studio Cards */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-16"
            >
              <h3 className="text-xl font-bold text-white mb-2">Creator Studio</h3>
              <p className="text-zinc-500 text-sm mb-6">Multi-colored action cards with chromatic personalities</p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Create a Move */}
                <motion.div
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="relative group cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#8B5CF6]/20 blur-xl opacity-0 group-hover:opacity-60 transition-opacity" />
                  <div className="relative p-5 rounded-2xl bg-gradient-to-br from-[#8B5CF6]/15 to-[#8B5CF6]/5 border border-[#8B5CF6]/20 h-full">
                    <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 flex items-center justify-center mb-4">
                      <svg className="w-5 h-5 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h4 className="text-white font-semibold mb-1">Create a Move</h4>
                    <p className="text-zinc-500 text-sm">Upload an exercise video</p>
                  </div>
                </motion.div>

                {/* Create a Movelist */}
                <motion.div
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="relative group cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#F59E0B]/20 blur-xl opacity-0 group-hover:opacity-60 transition-opacity" />
                  <div className="relative p-5 rounded-2xl bg-gradient-to-br from-[#F59E0B]/15 to-[#F59E0B]/5 border border-[#F59E0B]/20 h-full">
                    <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/20 border border-[#F59E0B]/30 flex items-center justify-center mb-4">
                      <svg className="w-5 h-5 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h4 className="text-white font-semibold mb-1">Create a Movelist</h4>
                    <p className="text-zinc-500 text-sm">Build a workout stack</p>
                  </div>
                </motion.div>

                {/* Create a Round */}
                <motion.div
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="relative group cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#10B981]/20 blur-xl opacity-0 group-hover:opacity-60 transition-opacity" />
                  <div className="relative p-5 rounded-2xl bg-gradient-to-br from-[#10B981]/15 to-[#10B981]/5 border border-[#10B981]/20 h-full">
                    <div className="w-10 h-10 rounded-xl bg-[#10B981]/20 border border-[#10B981]/30 flex items-center justify-center mb-4">
                      <svg className="w-5 h-5 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <h4 className="text-white font-semibold mb-1">Create a Round</h4>
                    <p className="text-zinc-500 text-sm">Build a training program</p>
                  </div>
                </motion.div>

                {/* Landing Pages */}
                <motion.div
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="relative group cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#EC4899]/20 blur-xl opacity-0 group-hover:opacity-60 transition-opacity" />
                  <div className="relative p-5 rounded-2xl bg-gradient-to-br from-[#EC4899]/15 to-[#EC4899]/5 border border-[#EC4899]/20 h-full">
                    <div className="w-10 h-10 rounded-xl bg-[#EC4899]/20 border border-[#EC4899]/30 flex items-center justify-center mb-4">
                      <svg className="w-5 h-5 text-[#EC4899]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                    </div>
                    <h4 className="text-white font-semibold mb-1">Landing Pages</h4>
                    <p className="text-zinc-500 text-sm">Create event & promo pages</p>
                  </div>
                </motion.div>

                {/* Client Forms */}
                <motion.div
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="relative group cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#06B6D4]/20 blur-xl opacity-0 group-hover:opacity-60 transition-opacity" />
                  <div className="relative p-5 rounded-2xl bg-gradient-to-br from-[#06B6D4]/15 to-[#06B6D4]/5 border border-[#06B6D4]/20 h-full">
                    <div className="w-10 h-10 rounded-xl bg-[#06B6D4]/20 border border-[#06B6D4]/30 flex items-center justify-center mb-4">
                      <svg className="w-5 h-5 text-[#06B6D4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <h4 className="text-white font-semibold mb-1">Client Intake Forms</h4>
                    <p className="text-zinc-500 text-sm">Collect info from clients</p>
                  </div>
                </motion.div>

                {/* Analytics */}
                <motion.div
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="relative group cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#E0FE10]/20 blur-xl opacity-0 group-hover:opacity-60 transition-opacity" />
                  <div className="relative p-5 rounded-2xl bg-gradient-to-br from-[#E0FE10]/15 to-[#E0FE10]/5 border border-[#E0FE10]/20 h-full">
                    <div className="w-10 h-10 rounded-xl bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center mb-4">
                      <svg className="w-5 h-5 text-[#E0FE10]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h4 className="text-white font-semibold mb-1">Analytics</h4>
                    <p className="text-zinc-500 text-sm">Track your growth</p>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Button Gallery */}
            <GlassCard accentColor="#E0FE10" delay={0.1} className="mb-8">
              <div className="p-8">
                <h3 className="text-xl font-bold text-white mb-6">Buttons</h3>
                <div className="flex flex-wrap gap-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl bg-[#E0FE10] text-black font-semibold shadow-lg shadow-[#E0FE10]/20 hover:shadow-[#E0FE10]/40 transition-shadow"
                  >
                    Primary Action
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl bg-white text-zinc-900 font-semibold"
                  >
                    Secondary
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl bg-transparent border border-[#E0FE10]/40 text-[#E0FE10] font-semibold hover:bg-[#E0FE10]/10 transition-colors"
                  >
                    Ghost
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl bg-red-500 text-white font-semibold shadow-lg shadow-red-500/20"
                  >
                    Destructive
                  </motion.button>
                </div>
              </div>
            </GlassCard>

            {/* Card Examples */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Workout Card */}
              <GlassCard accentColor="#E0FE10" delay={0.2}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E0FE10]/15 text-[#E0FE10] border border-[#E0FE10]/30">
                      LIFT
                    </span>
                    <span className="text-zinc-500 text-sm">45 min</span>
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">Upper Body Power</h4>
                  <p className="text-zinc-400 text-sm mb-4">Build strength with compound movements</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-[#E0FE10]">8 moves</span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400">Intermediate</span>
                  </div>
                </div>
              </GlassCard>

              {/* Stats Card */}
              <GlassCard accentColor="#3B82F6" delay={0.3}>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/20 flex items-center justify-center">
                      <span className="text-[#3B82F6] text-lg">📊</span>
                    </div>
                    <span className="text-zinc-400 text-sm">This Week</span>
                  </div>
                  <h4 className="text-3xl font-bold text-white mb-1">2,450</h4>
                  <p className="text-zinc-400 text-sm">Calories Burned</p>
                  <div className="mt-4 h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: '72%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA]"
                    />
                  </div>
                </div>
              </GlassCard>

              {/* Achievement Card */}
              <GlassCard accentColor="#8B5CF6" delay={0.4}>
                <div className="p-6 text-center">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    className="relative w-16 h-16 mx-auto mb-4"
                  >
                    <div className="absolute inset-0 rounded-full bg-yellow-400/30 blur-xl" />
                    <div className="relative w-full h-full rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-2xl">
                      🏆
                    </div>
                  </motion.div>
                  <h4 className="text-lg font-bold text-white mb-1">Achievement Unlocked</h4>
                  <p className="text-zinc-400 text-sm">7-Day Streak Complete!</p>
                </div>
              </GlassCard>
            </div>
          </div>
        </section>

        {/* Typography Section */}
        <section className="relative py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <GlassCard accentColor="#E0FE10" hoverGlow={false}>
              <div className="p-8 md:p-12">
                <h3 className="text-xl font-semibold text-[#E0FE10] mb-8">Typography Scale</h3>
                
                <div className="space-y-6">
                  <div className="border-b border-white/10 pb-6">
                    <span className="text-xs text-zinc-500 font-mono mb-2 block">Display / 6xl-9xl</span>
                    <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                      Chromatic Glass
                    </h1>
                  </div>
                  
                  <div className="border-b border-white/10 pb-6">
                    <span className="text-xs text-zinc-500 font-mono mb-2 block">Headline / 4xl-5xl</span>
                    <h2 className="text-4xl md:text-5xl font-bold text-white">
                      Dark Luxury Polish
                    </h2>
                  </div>
                  
                  <div className="border-b border-white/10 pb-6">
                    <span className="text-xs text-zinc-500 font-mono mb-2 block">Title / 2xl-3xl</span>
                    <h3 className="text-2xl md:text-3xl font-semibold text-white">
                      Colors That Pop and Reflect
                    </h3>
                  </div>
                  
                  <div className="border-b border-white/10 pb-6">
                    <span className="text-xs text-zinc-500 font-mono mb-2 block">Subheading / xl</span>
                    <h4 className="text-xl text-zinc-300">
                      Premium visual language for modern fitness
                    </h4>
                  </div>
                  
                  <div>
                    <span className="text-xs text-zinc-500 font-mono mb-2 block">Body / base-lg</span>
                    <p className="text-zinc-400 text-lg leading-relaxed">
                      Our design system combines glassmorphic depth, gradient accents, 
                      and bold category colors to create an unmistakably Pulse aesthetic.
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Footer CTA */}
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
                    Experience It
                  </span>
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                    See{' '}
                    <span className="bg-gradient-to-r from-[#E0FE10] via-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">
                      Chromatic Glass
                    </span>{' '}
                    in action
                  </h2>
                  <p className="text-zinc-400 text-lg mb-8 max-w-xl mx-auto">
                    This is how we build. Experience dark luxury fitness design across our platform.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <motion.a
                      href="/"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-8 py-4 rounded-xl bg-[#E0FE10] text-black font-bold text-lg shadow-lg shadow-[#E0FE10]/30 hover:shadow-[#E0FE10]/50 transition-shadow"
                    >
                      Explore Pulse
                    </motion.a>
                    <motion.a
                      href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-8 py-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white font-semibold text-lg hover:bg-white/10 transition-colors"
                    >
                      Get the App
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
              <span className="text-zinc-500 text-sm">Chromatic Glass Design Language</span>
            </div>
            <p className="text-zinc-500 text-sm">
              © {new Date().getFullYear()} Pulse Intelligence Labs, Inc. Dark luxury fitness.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default ChromaticGlassPage;
