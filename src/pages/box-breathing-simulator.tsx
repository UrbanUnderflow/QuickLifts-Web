import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Brain,
  Heart,
  Mail,
  MessageCircle,
  Phone,
  Shield,
  Target,
  Users,
  Wind,
  Zap,
} from 'lucide-react';

const TOTAL_SLIDES = 7;

const SLIDE_META = [
  { label: 'Teams', eyebrow: 'Slide 1' },
  { label: 'Pressure Data', eyebrow: 'Slide 2' },
  { label: 'Simulation', eyebrow: 'Slide 3' },
  { label: 'Handoff Pipeline', eyebrow: 'Slide 4' },
  { label: "What's At Stake", eyebrow: 'Slide 5' },
  { label: 'Impact', eyebrow: 'Slide 6' },
  { label: 'Contact', eyebrow: 'Slide 7' },
] as const;

type ContactCardProps = {
  name: string;
  role: string;
  email: string;
  phone?: string;
  imageSrc?: string;
  accent: string;
  initials: string;
  badges?: Array<{
    label: string;
    className: string;
  }>;
};

const AUNT_EDNA_CONTACTS: ContactCardProps[] = [
  {
    name: 'Dr. Tracey',
    role: 'AuntEdna Team Contact',
    email: 'tracey@auntedna.ai',
    imageSrc: '/dr-tracey.png',
    accent: '#F472B6',
    initials: 'TR',
  },
  {
    name: 'Jelanna',
    role: 'AuntEdna Team Contact',
    email: 'jelanna@auntedna.ai',
    imageSrc: '/jelanna.jpg',
    accent: '#FB7185',
    initials: 'JE',
  },
];

const PULSE_CONTACTS: ContactCardProps[] = [
  {
    name: 'Tremaine Grant',
    role: 'Founder & CEO',
    email: 'tre@fitwithpulse.ai',
    imageSrc: '/TremaineFounder.jpg',
    accent: '#E0FE10',
    initials: 'TG',
    badges: [
      { label: 'D1 Athlete', className: 'bg-blue-600/30 text-blue-300' },
      { label: 'Biotech', className: 'bg-emerald-600/30 text-emerald-300' },
      { label: 'Engineer', className: 'bg-orange-600/30 text-orange-300' },
    ],
  },
  {
    name: 'Bobby Nweke',
    role: 'Chief of Staff',
    email: 'bobby@fitwithpulse.ai',
    imageSrc: '/bobbyAdvisor.jpg',
    accent: '#38BDF8',
    initials: 'BN',
    badges: [
      { label: 'TED', className: 'bg-red-600/30 text-red-300' },
      { label: 'Harvard', className: 'bg-[#A51C30]/30 text-red-200' },
      { label: 'TFA', className: 'bg-red-700/30 text-red-200' },
    ],
  },
];

const transition = { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const };

const useAnimatedNumber = (target: number, active: boolean, duration = 1400) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }

    let animationFrame = 0;
    let startTime: number | null = null;

    const tick = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [active, duration, target]);

  return value;
};

const AuntEdnaWordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={className}>
    <div className="text-xs uppercase tracking-[0.42em] text-zinc-500">Clinical intelligence</div>
    <div className="mt-2 text-4xl font-black text-white md:text-6xl">
      aunt
      <span
        style={{
          background: 'linear-gradient(135deg, #F472B6, #FB7185, #FBBF24)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        EDNA
      </span>
      <span className="text-white/35">.ai</span>
    </div>
  </div>
);

const PulseCheckWordmark: React.FC<{ compact?: boolean; className?: string }> = ({
  compact = false,
  className = '',
}) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <img
      src="/pulsecheck-logo.svg"
      alt="Pulse Check"
      className={compact ? 'h-14 w-auto' : 'h-16 w-auto md:h-20'}
    />
    <div>
      <div className={`uppercase tracking-[0.34em] text-zinc-500 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
        Mental performance
      </div>
      <div className={compact ? 'mt-1 text-3xl font-black text-white' : 'mt-1 text-4xl font-black text-white md:text-5xl'}>
        Pulse <span className="text-[#8B5CF6]">Check</span>
      </div>
    </div>
  </div>
);

const ContactCard: React.FC<ContactCardProps> = ({
  name,
  role,
  email,
  phone,
  imageSrc,
  accent,
  initials,
  badges,
}) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
    <div className="flex items-center gap-4">
      <div
        className="h-18 w-18 overflow-hidden rounded-2xl border md:h-20 md:w-20"
        style={{
          borderColor: `${accent}55`,
          background: `linear-gradient(135deg, ${accent}22, rgba(255,255,255,0.05))`,
        }}
      >
        {imageSrc ? (
          <img src={imageSrc} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-bold" style={{ color: accent }}>
            {initials}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-xl font-semibold text-white md:text-2xl">{name}</div>
        <div className="text-base text-zinc-400">{role}</div>
      </div>
    </div>

    <div className="mt-5 space-y-2.5 text-base">
      <a href={`mailto:${email}`} className="flex items-center gap-2 text-zinc-300 transition hover:text-white">
        <Mail className="h-4 w-4" style={{ color: accent }} />
        <span className="truncate">{email}</span>
      </a>
      {phone ? (
        <div className="flex items-center gap-2 text-zinc-400">
          <Phone className="h-4 w-4" style={{ color: accent }} />
          <span>{phone}</span>
        </div>
      ) : null}
    </div>

    {badges && badges.length > 0 ? (
      <div className="mt-5 flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span
            key={`${name}-${badge.label}`}
            className={`rounded px-2.5 py-1 text-xs font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
        ))}
      </div>
    ) : null}
  </div>
);

const BoxBreathingAnimation: React.FC = () => {
  const phases = ['Inhale', 'Hold', 'Exhale', 'Hold'] as const;
  const [currentPhase, setCurrentPhase] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(4);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) {
          return prev - 1;
        }

        setCurrentPhase((phaseIndex) => {
          const nextPhase = phaseIndex + 1;
          if (nextPhase < phases.length) {
            return nextPhase;
          }

          setCurrentRound((round) => round + 1);

          return 0;
        });

        return 4;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [phases.length]);

  const phase = phases[currentPhase];
  const isExpand = phase === 'Inhale';
  const isShrink = phase === 'Exhale';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col items-center py-4"
    >
      <div className="mb-2 text-xs uppercase tracking-[0.35em] text-zinc-500">
        Live round {currentRound}
      </div>

      <div className="relative flex h-36 w-36 items-center justify-center md:h-44 md:w-44">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(224,254,16,0.18) 0%, rgba(56,189,248,0.08) 45%, transparent 72%)',
          }}
          animate={{
            scale: isExpand ? [1, 1.3] : isShrink ? [1.3, 1] : 1.15,
            opacity: [0.7, 1, 0.7],
          }}
          transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
        />

        <motion.div
          className="relative flex h-28 w-28 items-center justify-center rounded-full border border-[#E0FE10]/40 bg-black/40 md:h-36 md:w-36"
          animate={{
            scale: isExpand ? [0.72, 1.06] : isShrink ? [1.06, 0.72] : currentPhase === 1 ? 1.06 : 0.72,
          }}
          transition={{ duration: 4, ease: 'easeInOut' }}
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-[#E0FE10] md:text-3xl">{secondsLeft}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.28em] text-zinc-400">{phase}</div>
          </div>
        </motion.div>
      </div>

      <div className="mt-4 flex gap-2">
        {phases.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
              index === currentPhase ? 'scale-125 bg-[#E0FE10]' : index < currentPhase ? 'bg-zinc-500' : 'bg-zinc-800'
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
};

const AnimatedDataStream: React.FC<{ delay?: number; duration?: number; color?: string }> = ({
  delay = 0,
  duration = 2.5,
  color = '#E0FE10',
}) => (
  <motion.div
    className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
    style={{ backgroundColor: color, boxShadow: `0 0 14px ${color}90`, left: 0 }}
    initial={{ left: '0%', opacity: 0, scale: 0.5 }}
    animate={{ left: '100%', opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.5] }}
    transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.5 }}
  />
);

const PulseCheckToAuntEdnaFlow: React.FC = () => {
  const streams = [
    { delay: 0, color: '#E0FE10', duration: 2.8 },
    { delay: 0.7, color: '#10b981', duration: 3.1 },
    { delay: 1.4, color: '#ef4444', duration: 2.6 },
    { delay: 2.1, color: '#f59e0b', duration: 3.3 },
    { delay: 2.8, color: '#8b5cf6', duration: 2.9 },
  ];

  return (
    <div className="relative flex w-full items-center gap-4 xl:gap-5" style={{ minHeight: 200 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="flex shrink-0 flex-col items-center gap-3"
      >
        <div className="relative">
          <motion.div
            className="absolute inset-0 rounded-[28px]"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{
              background: 'radial-gradient(circle, rgba(224,254,16,0.28) 0%, transparent 70%)',
              filter: 'blur(14px)',
            }}
          />
          <div className="relative flex h-[118px] w-[118px] flex-col items-center justify-center gap-2 rounded-[28px] border border-[#E0FE10]/30 bg-zinc-900/80 backdrop-blur-xl">
            <Brain className="h-8 w-8 text-[#E0FE10]" />
            <div className="text-xs font-bold uppercase tracking-[0.32em] text-[#E0FE10]">Pulse</div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Check</div>
          </div>
        </div>
        <div className="text-center text-[11px] uppercase tracking-[0.28em] text-zinc-600">
          Athlete check-in
          <br />
          Biometric data
        </div>
      </motion.div>

      <div className="relative h-16 flex-1 overflow-visible">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-[#E0FE10]/40 via-[#E0FE10]/20 to-zinc-700/60" />
        {streams.slice(0, 3).map((stream, index) => (
          <AnimatedDataStream
            key={`pulse-stream-${stream.color}-${index}`}
            delay={stream.delay}
            duration={stream.duration}
            color={stream.color}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="flex shrink-0 flex-col items-center gap-3"
      >
        <div className="relative">
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.18, 1] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            style={{
              background: 'radial-gradient(circle, rgba(139,92,246,0.36) 0%, transparent 70%)',
              filter: 'blur(18px)',
            }}
          />
          <div
            className="relative flex h-[144px] w-[144px] flex-col items-center justify-center gap-2 rounded-full border-2 border-purple-500/40 bg-zinc-900/90 backdrop-blur-xl"
            style={{ boxShadow: '0 0 34px rgba(139,92,246,0.2), inset 0 0 22px rgba(139,92,246,0.05)' }}
          >
            <Zap className="h-8 w-8 text-purple-400" />
            <div className="text-xs font-bold uppercase tracking-[0.32em] text-purple-300">Signal</div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Layer</div>
            <motion.div
              className="absolute inset-1 rounded-full border border-purple-500/20"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        </div>
        <div className="text-center text-[11px] uppercase tracking-[0.28em] text-zinc-600">
          Tier classification
          <br />
          AI analysis engine
        </div>
      </motion.div>

      <div className="relative h-16 flex-1 overflow-visible">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-purple-500/40 via-red-500/30 to-red-500/60" />
        {streams.slice(2).map((stream, index) => (
          <AnimatedDataStream
            key={`handoff-stream-${stream.color}-${index}`}
            delay={stream.delay}
            duration={stream.duration}
            color={stream.color}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="flex shrink-0 flex-col items-center gap-3"
      >
        <div className="relative">
          <motion.div
            className="absolute inset-0 rounded-[28px]"
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 2.8, repeat: Infinity, delay: 0.5 }}
            style={{
              background: 'radial-gradient(circle, rgba(239,68,68,0.32) 0%, transparent 70%)',
              filter: 'blur(14px)',
            }}
          />
          <div
            className="relative flex h-[118px] w-[118px] flex-col items-center justify-center gap-2 rounded-[28px] border border-red-500/40 bg-zinc-900/80 backdrop-blur-xl"
            style={{ boxShadow: '0 0 20px rgba(239,68,68,0.16)' }}
          >
            <Shield className="h-8 w-8 text-red-400" />
            <div className="text-xs font-bold uppercase tracking-[0.32em] text-red-400">Aunt</div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-red-400/70">Edna</div>
          </div>
        </div>
        <div className="text-center text-[11px] uppercase tracking-[0.28em] text-zinc-600">
          Clinical platform
          <br />
          HIPAA compliant
        </div>
      </motion.div>
    </div>
  );
};

const BiometricHUD: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const [heartRate, setHeartRate] = useState(72);
  const [hrv, setHrv] = useState(45);
  const [calmScore, setCalmScore] = useState(34);

  useEffect(() => {
    if (!isActive) return;

    const interval = window.setInterval(() => {
      setHeartRate((prev) => Math.max(56, prev - Math.floor(Math.random() * 3 + 1)));
      setHrv((prev) => Math.min(72, prev + Math.floor(Math.random() * 3 + 1)));
      setCalmScore((prev) => Math.min(86, prev + Math.floor(Math.random() * 4 + 2)));
    }, 1800);

    return () => window.clearInterval(interval);
  }, [isActive]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="grid max-w-xl grid-cols-3 gap-2.5"
    >
      <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-zinc-950/85 p-2.5 text-center">
        <div className="absolute inset-0 bg-gradient-to-t from-red-500/8 to-transparent" />
        <Heart className="relative z-10 mx-auto mb-1 h-4 w-4 text-red-400" />
        <div className="relative z-10 text-xl font-bold text-white">{heartRate}</div>
        <div className="relative z-10 text-[10px] uppercase tracking-[0.24em] text-zinc-500">BPM</div>
        <div className="relative z-10 mt-1 text-[10px] text-green-400">Decreasing</div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-sky-400/20 bg-zinc-950/85 p-2.5 text-center">
        <div className="absolute inset-0 bg-gradient-to-t from-sky-400/8 to-transparent" />
        <Activity className="relative z-10 mx-auto mb-1 h-4 w-4 text-sky-400" />
        <div className="relative z-10 text-xl font-bold text-sky-300">{hrv}</div>
        <div className="relative z-10 text-[10px] uppercase tracking-[0.24em] text-zinc-500">HRV</div>
        <div className="relative z-10 mt-1 text-[10px] text-green-400">Improving</div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[#E0FE10]/20 bg-zinc-950/85 p-2.5 text-center">
        <div className="absolute inset-0 bg-gradient-to-t from-[#E0FE10]/8 to-transparent" />
        <Brain className="relative z-10 mx-auto mb-1 h-4 w-4 text-[#E0FE10]" />
        <div className="relative z-10 text-xl font-bold text-[#E0FE10]">{calmScore}</div>
        <div className="relative z-10 text-[10px] uppercase tracking-[0.24em] text-zinc-500">Calm</div>
        <div className="relative z-10 mt-1 text-[10px] text-green-400">Stabilizing</div>
      </div>
    </motion.div>
  );
};

const SceneIntro: React.FC = () => (
  <motion.div
    key="intro"
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -24 }}
    transition={transition}
    className="grid min-h-[calc(100vh-180px)] items-center gap-8 lg:grid-cols-2"
  >
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-sm md:p-8">
      <AuntEdnaWordmark />
      <p className="mt-5 max-w-full text-[2rem] font-semibold leading-[1.02] text-white md:text-[2.75rem]">
        Clinical Technology connecting athletes to the humans that care for their minds.
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {AUNT_EDNA_CONTACTS.map((contact) => (
          <ContactCard key={contact.email} {...contact} />
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-pink-400/20 bg-pink-400/8 p-5 text-base text-pink-100">
        <div className="text-sm uppercase tracking-[0.28em] text-pink-300">Primary contacts</div>
        <div className="mt-3 flex flex-wrap gap-5">
          <a href="mailto:tracey@auntedna.ai" className="text-lg font-medium transition hover:text-white">
            tracey@auntedna.ai
          </a>
          <a href="mailto:jelanna@auntedna.ai" className="text-lg font-medium transition hover:text-white">
            jelanna@auntedna.ai
          </a>
        </div>
      </div>
    </section>

    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-sm md:p-8">
      <PulseCheckWordmark />
      <p className="mt-5 max-w-full text-[2rem] font-semibold leading-[1.02] text-white md:text-[2.75rem]">
        Mental Performance technology training athletes cognitive ability during high pressure moments.
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {PULSE_CONTACTS.map((contact) => (
          <ContactCard key={contact.email + contact.name} {...contact} />
        ))}
      </div>

        <div className="mt-6 rounded-2xl border border-[#E0FE10]/20 bg-[#E0FE10]/8 p-5 text-base text-[#effaa7]">
        <div className="text-sm uppercase tracking-[0.28em] text-[#dff171]">Primary contacts</div>
        <div className="mt-3 flex flex-wrap gap-5">
          <a href="mailto:tre@fitwithpulse.ai" className="text-lg font-medium transition hover:text-white">
            tre@fitwithpulse.ai
          </a>
          <a href="mailto:bobby@fitwithpulse.ai" className="text-lg font-medium transition hover:text-white">
            bobby@fitwithpulse.ai
          </a>
        </div>
      </div>
    </section>
  </motion.div>
);

const SceneData: React.FC<{ active: boolean }> = ({ active }) => {
  const crisis = useAnimatedNumber(4, active);
  const anxiety = useAnimatedNumber(60, active);
  const disclosure = useAnimatedNumber(10, active);
  const activeAnxietyCount = Math.round((anxiety / 100) * 10);
  const activeDisclosureCount = Math.max(1, Math.round((disclosure / 100) * 10));

  return (
    <motion.div
      key="data"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={transition}
      className="min-h-[calc(100vh-180px)]"
    >
      <div className="max-w-4xl">
        <div className="text-xs uppercase tracking-[0.32em] text-sky-300">Pressure builds before the breakdown</div>
        <h1 className="mt-4 text-4xl font-black leading-tight text-white md:text-6xl">
          The performance moment is where the signal starts to spike.
        </h1>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...transition, delay: 0.08 }}
          className="rounded-[28px] border border-red-400/20 bg-gradient-to-br from-red-500/10 via-zinc-950/90 to-zinc-950/90 p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-red-300">Crisis risk</div>
              <div className="mt-3 text-6xl font-black text-white md:text-7xl">{crisis}x</div>
              <p className="mt-3 max-w-md text-base leading-7 text-zinc-300">
                Student athletes are <span className="font-semibold text-white">4x more likely</span> to have a mental health crisis.
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-300" />
          </div>

          <div className="mt-8 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm text-zinc-400">
                <span>Baseline population</span>
                <span>1x</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '24%' }}
                  transition={{ delay: 0.25, duration: 0.8 }}
                  className="h-full rounded-full bg-zinc-500"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm text-red-100">
                <span>Student athletes</span>
                <span>4x</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '96%' }}
                  transition={{ delay: 0.4, duration: 1 }}
                  className="h-full rounded-full bg-gradient-to-r from-red-400 via-rose-400 to-orange-300"
                />
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-5">
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...transition, delay: 0.14 }}
            className="rounded-[28px] border border-sky-400/20 bg-gradient-to-br from-sky-400/10 via-zinc-950/90 to-zinc-950/90 p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-sky-300">Pre-competition anxiety</div>
                <div className="mt-3 text-5xl font-black text-white md:text-6xl">{anxiety}%</div>
                <p className="mt-3 text-base leading-7 text-zinc-300">
                  <span className="font-semibold text-white">60% of athletes</span> experience elevated anxiety leading up to competition.
                </p>
              </div>
              <Activity className="h-8 w-8 text-sky-300" />
            </div>

            <div className="mt-6 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({ length: 10 }).map((_, index) => (
                <motion.div
                  key={`anxiety-${index}`}
                  initial={{ opacity: 0.35, y: 12 }}
                  animate={{
                    opacity: index < activeAnxietyCount ? 1 : 0.3,
                    y: 0,
                    scale: index < activeAnxietyCount ? [1, 1.08, 1] : 1,
                  }}
                  transition={{ delay: 0.05 * index, duration: 0.45 }}
                  className={`flex h-12 items-center justify-center rounded-2xl border ${
                    index < activeAnxietyCount
                      ? 'border-sky-300/35 bg-sky-400/18 shadow-[0_0_18px_rgba(56,189,248,0.2)]'
                      : 'border-white/8 bg-white/[0.02]'
                  }`}
                >
                  <Activity
                    className={`h-4 w-4 ${
                      index < activeAnxietyCount ? 'text-sky-200' : 'text-zinc-700'
                    }`}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...transition, delay: 0.2 }}
            className="rounded-[28px] border border-[#E0FE10]/20 bg-gradient-to-br from-[#E0FE10]/10 via-zinc-950/90 to-zinc-950/90 p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-[#dff171]">Coach visibility gap</div>
                <div className="mt-3 text-5xl font-black text-white md:text-6xl">{disclosure}%</div>
                <p className="mt-3 text-base leading-7 text-zinc-300">
                  Only <span className="font-semibold text-white">10%</span> actually say something to their coach about it.
                </p>
              </div>
              <MessageCircle className="h-8 w-8 text-[#dff171]" />
            </div>

            <div className="mt-6 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({ length: 10 }).map((_, index) => (
                <motion.div
                  key={`disclosure-${index}`}
                  initial={{ opacity: 0.35, y: 12 }}
                  animate={{
                    opacity: index < activeDisclosureCount ? 1 : 0.25,
                    y: 0,
                    scale: index < activeDisclosureCount ? [1, 1.12, 1] : 1,
                  }}
                  transition={{ delay: 0.06 * index, duration: 0.45 }}
                  className={`flex h-12 items-center justify-center rounded-2xl border ${
                    index < activeDisclosureCount
                      ? 'border-[#E0FE10]/35 bg-[#E0FE10]/16'
                      : 'border-white/8 bg-white/[0.02]'
                  }`}
                >
                  <MessageCircle
                    className={`h-4 w-4 ${
                      index < activeDisclosureCount ? 'text-[#eefb8a]' : 'text-zinc-700'
                    }`}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

const SimulatorPanel: React.FC = () => {
  return (
    <div className="rounded-[32px] border border-white/10 bg-black/55 p-3 shadow-2xl backdrop-blur-xl md:p-4">
      <div className="rounded-[28px] border border-white/8 bg-[#090b10]">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E0FE10]/14 text-[#E0FE10]">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Nora</div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Mental training</div>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-[92%] rounded-3xl rounded-tl-md border border-[#E0FE10]/14 bg-[#E0FE10]/10 px-4 py-2.5"
          >
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[#E0FE10]/75">Nora</div>
            <p className="text-sm leading-6 text-zinc-100">
              I&apos;m sensing some anxiety in your responses today. I think you would benefit from a
              {' '}
              <span className="font-semibold text-[#E0FE10]">box breathing protocol</span>.
              Let&apos;s run it live right now and bring your system back down before the next rep.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="ml-auto max-w-[82%] rounded-3xl rounded-tr-md border border-sky-400/16 bg-sky-400/10 px-4 py-2.5 text-right"
          >
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.28em] text-sky-300/80">Athlete</div>
            <p className="text-sm leading-6 text-zinc-100">Okay. I need that right now.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26 }}
            className="rounded-[28px] border border-white/8 bg-white/[0.02] p-3"
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              <Wind className="h-4 w-4 text-[#E0FE10]" />
              Box breathing protocol
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <BoxBreathingAnimation />
              <BiometricHUD isActive />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const SceneSimulation: React.FC = () => (
  <motion.div
    key="simulation"
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -24 }}
    transition={transition}
    className="grid h-full min-h-0 items-center gap-5 lg:grid-cols-[0.72fr_1.28fr]"
  >
    <div className="max-w-xl">
      <div className="text-xs uppercase tracking-[0.32em] text-[#dff171]">Box breathing in context</div>
      <h1 className="mt-3 text-4xl font-black leading-[0.96] text-white md:text-5xl">
        Detect.
        <br />
        Intervene.
        <br />
        Regulate.
      </h1>

      <div className="mt-6 space-y-3">
        {[
          'Nora sees the spike',
          'Breathing starts in chat',
          'Biofeedback shows recovery',
        ].map((point, index) => (
          <motion.div
            key={point}
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 * index }}
            className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-lg font-semibold leading-tight text-zinc-100 md:text-xl"
          >
            {point}
          </motion.div>
        ))}
      </div>
    </div>

    <SimulatorPanel />
  </motion.div>
);

const SceneHandoff: React.FC = () => (
  <motion.div
    key="handoff"
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -24 }}
    transition={transition}
    className="grid h-full min-h-0 content-center"
  >
    <div className="relative overflow-hidden rounded-[36px] border border-red-500/18 bg-zinc-900/60 p-6 md:p-8">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/6 via-transparent to-red-500/6" />
      <div className="relative h-full">
        <div className="text-xs font-bold uppercase tracking-[0.32em] text-zinc-500">
          Live handoff pipeline
        </div>

        <div className="mt-8">
          <PulseCheckToAuntEdnaFlow />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              label: 'Trigger',
              value: 'Flagged context + biometric snapshot',
            },
            {
              label: 'Decision',
              value: 'Tier 3 override + clinical routing',
            },
            {
              label: 'Destination',
              value: 'AuntEdna chart seed + immediate response path',
            },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 + index * 0.08 }}
              className="rounded-[28px] border border-white/70 bg-black/20 px-5 py-5 text-center"
            >
              <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">{item.label}</div>
              <div className="mt-3 text-lg font-medium leading-snug text-zinc-100 md:text-[1.4rem]">
                {item.value}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </motion.div>
);

const SceneStake: React.FC = () => (
  <motion.div
    key="stake"
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -24 }}
    transition={transition}
    className="grid h-full min-h-0 content-start gap-5"
  >
    <div className="max-w-5xl">
      <h1 className="text-5xl font-black leading-[0.94] text-white md:text-7xl">
        What&apos;s at stake
      </h1>
    </div>

    <div className="grid flex-1 min-h-0 auto-rows-fr gap-5 lg:grid-cols-2">
      {[
        {
          title: 'Personal',
          icon: Heart,
          accent: '#F472B6',
          chips: ['Burnout', 'Anxiety', 'Identity struggles', 'Injury recovery', 'Self-harm risk', 'Mental health crisis'],
        },
        {
          title: 'Performance',
          icon: Target,
          accent: '#38BDF8',
          chips: ['Lost consistency', 'Slower decisions', 'Weaker focus', 'Less trust in leadership', 'Pressure performance drops'],
        },
        {
          title: 'Team',
          icon: Users,
          accent: '#E0FE10',
          chips: ['Weak culture', 'Poor communication', 'Unsafe environments', 'Leadership issues'],
        },
        {
          title: 'Societal',
          icon: Shield,
          accent: '#A78BFA',
          chips: ['Performance vs well-being', 'Care comes too late', 'Toughness = suppression', 'Distress becomes the threshold'],
        },
      ].map((item, index) => {
        const Icon = item.icon;

        return (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * index, duration: 0.55 }}
            className="relative h-full min-h-[240px] overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.03] p-7 md:p-8"
          >
            <div
              className="absolute inset-x-0 top-0 h-[2px]"
              style={{ background: `linear-gradient(90deg, ${item.accent}, transparent)` }}
            />
            <div className="flex items-start gap-5">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border"
                style={{
                  borderColor: `${item.accent}40`,
                  background: `${item.accent}12`,
                  color: item.accent,
                }}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.32em] text-zinc-500">Level</div>
                <h2 className="mt-2 text-4xl font-black text-white md:text-5xl">{item.title}</h2>
                <div className="mt-5 flex flex-wrap gap-3">
                  {item.chips.map((chip) => (
                    <span
                      key={`${item.title}-${chip}`}
                      className="rounded-full border px-4 py-2 text-base font-medium leading-none text-zinc-100 md:text-lg"
                      style={{
                        borderColor: `${item.accent}35`,
                        background: `${item.accent}14`,
                      }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  </motion.div>
);

const SceneImpact: React.FC = () => (
  <motion.div
    key="impact"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={transition}
    className="relative flex h-full min-h-0 items-center justify-center overflow-hidden rounded-[36px] border border-white/8 bg-black/20 px-6 py-10 text-center"
  >
    <motion.div
      className="absolute inset-0"
      animate={{ opacity: [0.35, 0.65, 0.35] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="absolute left-[-8%] top-[12%] h-72 w-72 rounded-full bg-pink-500/12 blur-3xl" />
      <div className="absolute right-[-6%] top-[18%] h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="absolute bottom-[-10%] left-[28%] h-80 w-80 rounded-full bg-[#E0FE10]/10 blur-3xl" />
    </motion.div>

    <div className="relative z-10 mx-auto max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-xs uppercase tracking-[0.34em] text-zinc-500"
      >
        Impact
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.22, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mt-6 text-4xl font-black leading-[1.02] text-white md:text-6xl xl:text-7xl"
      >
        Our impact is the ability to create an ecosystem where people can be
        {' '}
        <span
          style={{
            background: 'linear-gradient(135deg, #ffffff, #8B5CF6, #E0FE10)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          high-performing
        </span>
        {' '}
        without being
        {' '}
        <span
          style={{
            background: 'linear-gradient(135deg, #FB7185, #FBBF24)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          hollowed out.
        </span>
      </motion.h1>
    </div>
  </motion.div>
);

const SceneContact: React.FC = () => <SceneIntro />;

const BoxBreathingSimulatorPage: React.FC = () => {
  const [slide, setSlide] = useState(0);

  const goNext = useCallback(() => setSlide((current) => Math.min(current + 1, TOTAL_SLIDES - 1)), []);
  const goBack = useCallback(() => setSlide((current) => Math.max(current - 1, 0)), []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown', ' '];
      const backKeys = ['ArrowLeft', 'ArrowUp', 'PageUp'];

      if (nextKeys.includes(event.key)) {
        event.preventDefault();
        goNext();
      }

      if (backKeys.includes(event.key)) {
        event.preventDefault();
        goBack();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [goBack, goNext]);

  const scene = useMemo(() => {
    if (slide === 0) return <SceneIntro />;
    if (slide === 1) return <SceneData active={slide === 1} />;
    if (slide === 2) return <SceneSimulation />;
    if (slide === 3) return <SceneHandoff />;
    if (slide === 4) return <SceneStake />;
    if (slide === 5) return <SceneImpact />;
    return <SceneContact />;
  }, [slide]);

  return (
    <>
      <Head>
        <title>Box Breathing Simulator | Pulse Check x AuntEdna</title>
        <meta
          name="description"
          content="Presentation for the Pulse Check and AuntEdna box breathing simulator story."
        />
      </Head>

      <div className="h-screen overflow-hidden bg-[#05070b] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-10%] top-[-10%] h-[36rem] w-[36rem] rounded-full bg-pink-500/10 blur-3xl" />
          <div className="absolute right-[-8%] top-[15%] h-[30rem] w-[30rem] rounded-full bg-sky-500/10 blur-3xl" />
          <div className="absolute bottom-[-12%] left-[18%] h-[28rem] w-[28rem] rounded-full bg-[#E0FE10]/8 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col px-4 py-4 md:px-8">
          <main className="relative flex-1 min-h-0 overflow-hidden py-3">
            <AnimatePresence mode="wait">{scene}</AnimatePresence>
          </main>

          <footer className="mt-2 flex items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-black/25 px-5 py-4 backdrop-blur-xl">
            <button
              type="button"
              onClick={goBack}
              disabled={slide === 0}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </button>

            <div className="hidden items-center gap-2 md:flex">
              {SLIDE_META.map((item, index) => (
                <div
                  key={item.label}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    slide === index ? 'w-12 bg-[#E0FE10]' : 'w-2.5 bg-white/20'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={slide === TOTAL_SLIDES - 1}
              className="inline-flex items-center gap-2 rounded-full bg-[#E0FE10] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#ccef13] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          </footer>
        </div>
      </div>
    </>
  );
};

export default BoxBreathingSimulatorPage;
