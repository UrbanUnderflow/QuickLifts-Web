import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRight,
  BatteryCharging,
  Brain,
  Check,
  ChevronRight,
  HeartPulse,
  Link2,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Volume2,
  VolumeX,
  Watch,
  Wind,
  Flame,
} from 'lucide-react';

type StepId = 'devices' | 'select' | 'authorize' | 'sync' | 'flagged' | 'breathing' | 'ready';

type DemoStep = {
  id: StepId;
  label: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  nora: string;
  durationMs?: number;
  customHeader?: boolean;
};

const DEFAULT_STEP_MS = 6400;

const demoSteps: DemoStep[] = [
  {
    id: 'devices',
    label: 'Devices',
    eyebrow: 'PulseCheck integrations',
    title: 'Your devices',
    subtitle: 'WHOOP joins the lineup athletes already trust.',
    nora:
      'This is the exact device sheet athletes see today. WHOOP slots in beside Fitbit Air, Polar, and Oura — not as a bolt-on, but as a first-class option.',
    customHeader: true,
  },
  {
    id: 'select',
    label: 'WHOOP',
    eyebrow: 'Device selected',
    title: 'Connect WHOOP',
    subtitle: 'PulseCheck explains exactly what the athlete gets before sign-in.',
    nora:
      'This is the promise: strain, recovery, sleep, heart rate, and workout windows become context Nora can actually coach from.',
  },
  {
    id: 'authorize',
    label: 'Grant',
    eyebrow: 'Secure connection',
    title: 'Authorize with WHOOP',
    subtitle: 'The athlete grants access, then returns directly into PulseCheck.',
    nora:
      'Consent stays explicit. PulseCheck asks for the minimum scopes we need and keeps the athlete in control of the connection.',
    durationMs: 5200,
  },
  {
    id: 'sync',
    label: 'Sync',
    eyebrow: 'Live normalization',
    title: 'WHOOP data is flowing',
    subtitle: 'PulseCheck converts raw reads into one athlete health-context snapshot.',
    nora:
      'Once connected, WHOOP lands in the same canonical pipeline as Polar, Oura, and Fitbit Air — one snapshot, not four dashboards.',
    durationMs: 5200,
  },
  {
    id: 'flagged',
    label: 'Signal',
    eyebrow: 'Pre-competition check-in',
    title: 'Nora reads the pressure building',
    subtitle: "The athlete's words and WHOOP's numbers are telling the same story.",
    nora:
      "WHOOP doesn't diagnose anything on its own — it informs how Nora interprets the check-in. HRV down, resting HR up, strain rising: that combination is what surfaces a regulation protocol.",
    durationMs: 7200,
  },
  {
    id: 'breathing',
    label: 'Protocol',
    eyebrow: 'Regulation protocol matched',
    title: 'Nora runs Box Breathing',
    subtitle: 'Equal-phase inhale, hold, exhale, hold — built to override fight-or-flight in minutes.',
    nora:
      'Box Breathing is the same protocol Navy SEALs use under pressure. Four-second phases, six cycles, and WHOOP keeps reading heart rate the entire time.',
    durationMs: 17000,
  },
  {
    id: 'ready',
    label: 'Proof',
    eyebrow: 'Integration complete',
    title: 'WHOOP confirms the reset',
    subtitle: 'Not a guess — biofeedback proves the rep actually worked.',
    nora:
      'That is the integration: real onboarding, a real protocol, and WHOOP biofeedback that proves the mental rep actually worked.',
  },
];

const sourceRows = [
  ['Recovery', '84%', 'WHOOP', '#22c55e'],
  ['Sleep', '7h 48m', 'WHOOP', '#a78bfa'],
  ['Strain', '13.8', 'WHOOP', '#fb923c'],
  ['Resting HR', '72 bpm', 'WHOOP', '#38bdf8'],
];

const biometricSignals = [
  { label: 'Resting HR', baseline: '49 bpm', current: '72 bpm', direction: 'up' as const, tone: '#fb923c' },
  { label: 'HRV', baseline: '68 ms', current: '54 ms', direction: 'down' as const, tone: '#f87171' },
  { label: 'Strain', baseline: '8.5 avg', current: '13.8', direction: 'up' as const, tone: '#fb923c' },
];

const breathingPhases = [
  { name: 'inhale', label: 'Breathe In', instruction: 'Breathe in slowly through your nose' },
  { name: 'hold', label: 'Hold', instruction: 'Hold your breath gently' },
  { name: 'exhale', label: 'Breathe Out', instruction: 'Exhale slowly through your mouth' },
  { name: 'holdEmpty', label: 'Hold', instruction: 'Hold empty' },
];

const breathingHeartRateTrack = [73, 69, 64, 60];

const proofTiles = [
  { label: 'Resting HR', value: '72 → 58 bpm', source: 'WHOOP', accent: '#22c55e' },
  { label: 'HRV', value: '+12%', source: 'WHOOP', accent: '#a78bfa' },
  { label: 'Stress', value: '-18%', source: 'WHOOP', accent: '#38bdf8' },
];

const getStepState = (index: number, activeIndex: number) => {
  if (index < activeIndex) return 'complete';
  if (index === activeIndex) return 'active';
  return 'upcoming';
};

const NoraOrb: React.FC<{ speaking: boolean }> = ({ speaking }) => (
  <div className="whoop-nora-orb" aria-hidden="true">
    <motion.div
      className="whoop-nora-orb__glow"
      animate={{
        scale: speaking ? [1, 1.26, 1] : [1, 1.08, 1],
        opacity: speaking ? [0.38, 0.72, 0.38] : [0.2, 0.36, 0.2],
      }}
      transition={{ duration: speaking ? 1.1 : 3, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="whoop-nora-orb__core"
      animate={{ scale: speaking ? [1, 1.08, 0.98, 1] : 1 }}
      transition={{ duration: 0.8, repeat: speaking ? Infinity : 0, ease: 'easeInOut' }}
    >
      <Brain size={16} />
    </motion.div>
  </div>
);

const PhoneStatusBar = () => (
  <div className="whoop-status">
    <span>2:11</span>
    <div className="whoop-status__right">
      <span className="whoop-signal" />
      <span>5G</span>
      <span className="whoop-battery">
        <span />
      </span>
    </div>
  </div>
);

const WhoopBand: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <svg
    className={compact ? 'device-art device-art--compact' : 'device-art'}
    viewBox="0 0 150 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="WHOOP band illustration"
  >
    <defs>
      <linearGradient id="whoopStrap" x1="40" y1="12" x2="112" y2="168" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3c3743" />
        <stop offset="0.5" stopColor="#1b1921" />
        <stop offset="1" stopColor="#0c0b11" />
      </linearGradient>
      <linearGradient id="whoopSheen" x1="48" y1="20" x2="74" y2="20" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffffff" stopOpacity="0.16" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="whoopBezel" x1="49" y1="56" x2="101" y2="118" gradientUnits="userSpaceOnUse">
        <stop stopColor="#56505f" />
        <stop offset="0.5" stopColor="#2a2733" />
        <stop offset="1" stopColor="#141219" />
      </linearGradient>
      <radialGradient id="whoopFace" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(75 90) scale(26)">
        <stop stopColor="#211e2a" />
        <stop offset="1" stopColor="#0d0c12" />
      </radialGradient>
      <radialGradient id="whoopGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(75 92) scale(70 82)">
        <stop stopColor="#e0fe10" stopOpacity="0.42" />
        <stop offset="1" stopColor="#e0fe10" stopOpacity="0" />
      </radialGradient>
      <pattern id="whoopKnit" width="4" height="4" patternUnits="userSpaceOnUse">
        <line x1="1" y1="0" x2="1" y2="4" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="3" y1="0" x2="3" y2="4" stroke="rgba(0,0,0,0.22)" strokeWidth="1" />
      </pattern>
    </defs>
    <ellipse cx="75" cy="92" rx="66" ry="80" fill="url(#whoopGlow)" />
    <g transform="rotate(-9 75 90)">
      <rect x="46" y="12" width="58" height="156" rx="26" fill="url(#whoopStrap)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.4" />
      <rect x="46" y="12" width="58" height="156" rx="26" fill="url(#whoopKnit)" />
      <rect x="50" y="15" width="16" height="150" rx="8" fill="url(#whoopSheen)" />
      <rect x="61" y="24" width="28" height="38" rx="12" fill="#08070c" />
      <rect x="61" y="118" width="28" height="40" rx="12" fill="#08070c" />
      <rect x="48" y="56" width="54" height="60" rx="18" fill="url(#whoopBezel)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.3" />
      <rect x="54" y="62" width="42" height="48" rx="13" fill="url(#whoopFace)" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
      <path d="M54 70 Q54 62 62 62 L74 62 Q60 66 58 80 Z" fill="rgba(255,255,255,0.07)" />
      <circle cx="75" cy="99" r="11" fill="#e0fe10" opacity="0.22" />
      <circle cx="75" cy="86" r="4.6" fill="#34d399" />
      <circle cx="64" cy="92" r="3.4" fill="#2bb47e" />
      <circle cx="86" cy="92" r="3.4" fill="#2bb47e" />
      <circle cx="75" cy="99" r="5.6" fill="#e0fe10" />
      <circle cx="72.6" cy="97" r="1.8" fill="#f4ff8a" />
    </g>
  </svg>
);

const FitbitLoop: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <svg
    className={compact ? 'device-art device-art--compact' : 'device-art'}
    viewBox="0 0 150 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Fitbit Air illustration"
  >
    <defs>
      <linearGradient id="fitbitBand" x1="36" y1="14" x2="116" y2="166" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f7eedd" />
        <stop offset="0.5" stopColor="#e5d4b6" />
        <stop offset="1" stopColor="#bda684" />
      </linearGradient>
      <radialGradient id="fitbitGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(75 92) scale(66 80)">
        <stop stopColor="#ff8a3d" stopOpacity="0.5" />
        <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
      </radialGradient>
      <pattern id="fitbitWeave" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(120,80,30,0.13)" strokeWidth="1.4" />
      </pattern>
    </defs>
    <ellipse cx="75" cy="92" rx="64" ry="80" fill="url(#fitbitGlow)" />
    <g transform="rotate(-7 75 92)">
      <rect x="44" y="11" width="62" height="160" rx="31" stroke="#ff8a3d" strokeWidth="6" opacity="0.92" />
      <rect x="46" y="13" width="58" height="156" rx="29" fill="url(#fitbitBand)" />
      <rect x="46" y="13" width="58" height="156" rx="29" fill="url(#fitbitWeave)" />
      <rect x="61" y="28" width="28" height="126" rx="14" fill="#0c0a08" />
      <rect x="61" y="28" width="28" height="126" rx="14" stroke="#ff8a3d" strokeWidth="2.4" opacity="0.85" />
      <rect x="50" y="17" width="13" height="148" rx="6.5" fill="rgba(255,255,255,0.3)" />
    </g>
  </svg>
);

const PolarSensor: React.FC = () => (
  <svg
    className="device-art"
    viewBox="0 0 150 150"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Polar heart-rate sensor illustration"
  >
    <defs>
      <radialGradient id="polarGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(75 75) scale(68)">
        <stop stopColor="#a78bfa" stopOpacity="0.42" />
        <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="polarPod" x1="48" y1="54" x2="102" y2="98" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2c2742" />
        <stop offset="1" stopColor="#15121f" />
      </linearGradient>
    </defs>
    <ellipse cx="75" cy="75" rx="68" ry="68" fill="url(#polarGlow)" />
    <circle cx="75" cy="75" r="62" stroke="#8b5cf6" strokeOpacity="0.16" strokeWidth="2" />
    <circle cx="75" cy="75" r="48" stroke="#8b5cf6" strokeOpacity="0.32" strokeWidth="2" />
    <circle cx="75" cy="75" r="34" stroke="#a78bfa" strokeOpacity="0.55" strokeWidth="2" />
    <rect x="48" y="54" width="54" height="42" rx="17" fill="url(#polarPod)" stroke="rgba(167,139,250,0.55)" strokeWidth="1.4" />
    <path
      d="M75 88c-8-5.1-13.2-9.2-13.2-14.6 0-3.3 2.6-5.8 5.9-5.8 2.1 0 4 1.1 5.1 2.8 1.1-1.7 3-2.8 5.1-2.8 3.3 0 5.9 2.5 5.9 5.8 0 5.4-5.2 9.5-13.2 14.6z"
      fill="#c4b5fd"
    />
  </svg>
);

const OuraRing: React.FC = () => (
  <svg
    className="device-art"
    viewBox="0 0 150 150"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Oura Ring illustration"
  >
    <defs>
      <radialGradient id="ouraGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(75 86) scale(62 60)">
        <stop stopColor="#a78bfa" stopOpacity="0.4" />
        <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="ouraMetal" x1="32" y1="36" x2="120" y2="116" gradientUnits="userSpaceOnUse">
        <stop stopColor="#544f5f" />
        <stop offset="0.5" stopColor="#24212c" />
        <stop offset="1" stopColor="#100e15" />
      </linearGradient>
    </defs>
    <ellipse cx="75" cy="84" rx="60" ry="56" fill="url(#ouraGlow)" />
    <ellipse cx="75" cy="74" rx="49" ry="45" stroke="url(#ouraMetal)" strokeWidth="17" fill="none" />
    <ellipse cx="75" cy="74" rx="57.5" ry="53.5" stroke="rgba(255,255,255,0.1)" strokeWidth="1" fill="none" />
    <ellipse cx="75" cy="74" rx="40.5" ry="36.5" stroke="rgba(0,0,0,0.55)" strokeWidth="1.2" fill="none" />
    <path d="M93 33 A49 45 0 0 1 122 61" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="5" strokeLinecap="round" />
    <path d="M88 30 A49 45 0 0 1 100 35" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M40 101 A49 45 0 0 0 57 116" stroke="#a78bfa" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const StatusPill: React.FC<{ children: React.ReactNode; tone?: 'green' | 'purple' | 'orange' | 'muted' }> = ({
  children,
  tone = 'green',
}) => <span className={`whoop-pill whoop-pill--${tone}`}>{children}</span>;

const DeviceCard: React.FC<{
  name: string;
  description: string;
  badge?: 'signature' | 'new';
  connected?: boolean;
  active?: boolean;
  visual: React.ReactNode;
}> = ({ name, description, badge, connected, active, visual }) => (
  <div className={active ? 'whoop-device-card whoop-device-card--active' : 'whoop-device-card'}>
    <div className="whoop-device-card__copy">
      {badge === 'signature' && (
        <div className="whoop-signature">
          <Star size={13} fill="currentColor" />
          <span>Our signature device</span>
        </div>
      )}
      {badge === 'new' && (
        <div className="whoop-signature whoop-signature--new">
          <Sparkles size={13} />
          <span>New</span>
        </div>
      )}
      <h3>{name}</h3>
      <p>{description}</p>
      {connected ? (
        <StatusPill>
          <Check size={14} />
          Connected
        </StatusPill>
      ) : (
        <StatusPill tone="purple">
          <Link2 size={13} />
          Tap to connect
        </StatusPill>
      )}
      {connected && (
        <div className="whoop-card-link">
          View Sports Intel <ArrowRight size={16} />
        </div>
      )}
    </div>
    <div className="whoop-device-card__visual">{visual}</div>
  </div>
);

const AddDeviceRow = () => (
  <button type="button" className="whoop-add-device-row">
    <span className="whoop-add-device-row__icon">
      <Plus size={16} />
    </span>
    <span className="whoop-add-device-row__label">Add another device</span>
    <ChevronRight size={16} />
  </button>
);

const PermissionRow: React.FC<{ Icon: LucideIcon; title: string; detail: string }> = ({ Icon, title, detail }) => (
  <div className="whoop-permission-row">
    <div className="whoop-permission-row__icon">
      <Icon size={18} />
    </div>
    <div>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  </div>
);

const MetricTile: React.FC<{ label: string; value: string; source: string; accent: string }> = ({
  label,
  value,
  source,
  accent,
}) => (
  <div className="whoop-metric-tile" style={{ '--accent': accent } as React.CSSProperties}>
    <span>{label}</span>
    <strong>{value}</strong>
    <em>via {source}</em>
  </div>
);

const BiometricReadout: React.FC<{ rows: typeof biometricSignals }> = ({ rows }) => (
  <div className="whoop-signal-stack">
    {rows.map((row) => (
      <div key={row.label} className="whoop-signal-row" style={{ '--accent': row.tone } as React.CSSProperties}>
        <span className="whoop-signal-row__label">{row.label}</span>
        <span className="whoop-signal-row__values">
          <em>{row.baseline}</em>
          <ArrowRight size={12} />
          <strong>{row.current}</strong>
        </span>
        {row.direction === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
      </div>
    ))}
  </div>
);

const BreathingCycle: React.FC = () => {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhaseIndex((index) => (index + 1) % breathingPhases.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  const phase = breathingPhases[phaseIndex];
  const heartRate = breathingHeartRateTrack[phaseIndex];
  const scale = phase.name === 'inhale' || phase.name === 'hold' ? 1.18 : 0.86;

  return (
    <div className="whoop-breathing-stage">
      <div className="whoop-breathing-ring-wrap">
        <motion.div className="whoop-breathing-ring" animate={{ scale }} transition={{ duration: 3.6, ease: 'easeInOut' }}>
          <span className="whoop-breathing-ring__phase">{phase.label}</span>
        </motion.div>
        <div className="whoop-breathing-hr">
          <HeartPulse size={13} />
          {heartRate} bpm
        </div>
      </div>
      <p className="whoop-breathing-instruction">{phase.instruction}</p>
      <div className="whoop-breathing-dots">
        {breathingPhases.map((p, index) => (
          <span
            key={p.name}
            className={index === phaseIndex ? 'whoop-breathing-dot whoop-breathing-dot--active' : 'whoop-breathing-dot'}
          />
        ))}
      </div>
      <span className="whoop-breathing-cycle-label">Cycle 1 of 6</span>
    </div>
  );
};

const NoraBrief: React.FC<{ text: string; speaking: boolean }> = ({ text, speaking }) => (
  <div className="whoop-nora-brief">
    <NoraOrb speaking={speaking} />
    <div>
      <span>Nora briefing</span>
      <p>{text}</p>
    </div>
  </div>
);

const StepTracker: React.FC<{ activeIndex: number; progress: number }> = ({ activeIndex, progress }) => (
  <div className="whoop-step-tracker">
    <div className="whoop-step-tracker__header">
      <span>{demoSteps[activeIndex].eyebrow}</span>
      <strong>
        {activeIndex + 1}/{demoSteps.length}
      </strong>
    </div>
    <div className="whoop-step-tracker__bar">
      <motion.div
        animate={{ width: `${((activeIndex + progress) / demoSteps.length) * 100}%` }}
        transition={{ duration: 0.18, ease: 'linear' }}
      />
    </div>
    <div className="whoop-step-tracker__dots">
      {demoSteps.map((step, index) => {
        const state = getStepState(index, activeIndex);
        return (
          <div key={step.id} className={`whoop-step-dot whoop-step-dot--${state}`}>
            {state === 'complete' ? <Check size={10} /> : index + 1}
          </div>
        );
      })}
    </div>
  </div>
);

const StepContent: React.FC<{ step: DemoStep }> = ({ step }) => {
  switch (step.id) {
    case 'devices':
      return (
        <>
          <div className="whoop-sheet-nav">
            <button type="button" className="whoop-sheet-nav__close" aria-label="Close devices">
              ×
            </button>
            <span className="whoop-sheet-nav__title">Your devices</span>
            <span className="whoop-sheet-nav__spacer" aria-hidden="true" />
          </div>
          <div className="whoop-sheet-heading">
            <h1>Your devices</h1>
            <p>Tap any device to see its data. Add another anytime — your live reads keep flowing in the background.</p>
          </div>
          <div className="whoop-device-stack">
            <DeviceCard
              name="WHOOP"
              badge="new"
              active
              description="Strain, recovery, sleep, heart rate, and workout windows from WHOOP."
              visual={<WhoopBand />}
            />
            <DeviceCard
              name="Fitbit Air"
              badge="signature"
              connected
              description="Sleep, heart rate, and activity from Fitbit through Google Health."
              visual={<FitbitLoop />}
            />
            <DeviceCard
              name="Polar"
              connected
              description="Live heart rate during sims plus deep recovery from Polar Flow."
              visual={<PolarSensor />}
            />
            <DeviceCard
              name="Oura Ring"
              connected
              description="Recovery, readiness, and sleep quality from your Oura ring."
              visual={<OuraRing />}
            />
            <AddDeviceRow />
          </div>
        </>
      );
    case 'select':
      return (
        <>
          <HeroWhoopCard />
          <div className="whoop-panel">
            <h2>What PulseCheck unlocks</h2>
            <div className="whoop-benefit-grid">
              <PermissionRow Icon={Flame} title="Strain" detail="Daily load and high-effort windows" />
              <PermissionRow Icon={Moon} title="Sleep" detail="Duration, consistency, and recovery drag" />
              <PermissionRow Icon={HeartPulse} title="Heart" detail="Resting HR, HRV, and stress signals" />
            </div>
          </div>
          <button className="whoop-primary-button" type="button">
            Connect WHOOP <ChevronRight size={18} />
          </button>
        </>
      );
    case 'authorize':
      return (
        <>
          <div className="whoop-oauth-card">
            <div className="whoop-oauth-card__brand">
              <WhoopBand compact />
              <div>
                <span>WHOOP</span>
                <strong>Connect to PulseCheck</strong>
              </div>
            </div>
            <p>PulseCheck is requesting permission to read performance and recovery data for athlete coaching context.</p>
            <div className="whoop-scope-list">
              <StatusPill tone="muted">
                <ShieldCheck size={13} />
                Recovery
              </StatusPill>
              <StatusPill tone="muted">
                <Moon size={13} />
                Sleep
              </StatusPill>
              <StatusPill tone="muted">
                <Activity size={13} />
                Workouts
              </StatusPill>
              <StatusPill tone="muted">
                <HeartPulse size={13} />
                Heart rate
              </StatusPill>
            </div>
            <button className="whoop-primary-button whoop-primary-button--dark" type="button">
              Authorize <ArrowRight size={18} />
            </button>
          </div>
          <div className="whoop-security-note">
            <ShieldCheck size={18} />
            <span>Scopes are logged against the device source record and can be revoked from settings.</span>
          </div>
        </>
      );
    case 'sync':
      return (
        <>
          <div className="whoop-sync-stage">
            <motion.div
              className="whoop-sync-ring"
              animate={{ rotate: 360 }}
              transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
            >
              <WhoopBand compact />
            </motion.div>
            <h2>Building health-context snapshot</h2>
            <p>WHOOP writes into the shared PulseCheck device registry before Nora sees the data.</p>
          </div>
          <div className="whoop-source-stack">
            {sourceRows.map(([label, value, source, accent]) => (
              <MetricTile key={label} label={label} value={value} source={source} accent={accent} />
            ))}
          </div>
        </>
      );
    case 'flagged':
      return (
        <>
          <div className="whoop-checkin-quote">
            <span>Athlete check-in</span>
            <p>&ldquo;Nervous, can&rsquo;t focus. Tough to settle in before today.&rdquo;</p>
          </div>
          <BiometricReadout rows={biometricSignals} />
          <div className="whoop-match-tag">
            <ShieldCheck size={14} />
            <span>Regulation protocol matched</span>
          </div>
          <div className="whoop-panel whoop-panel--compact">
            <h2>Nora&rsquo;s read</h2>
            <p>
              WHOOP doesn&rsquo;t decide anything on its own — it informs how Nora interprets the check-in. HRV down,
              resting HR up, strain rising: that combination is what surfaces a regulation protocol, not a guess.
            </p>
          </div>
        </>
      );
    case 'breathing':
      return (
        <>
          <BreathingCycle />
          <div className="whoop-panel whoop-panel--compact">
            <h2>Why Box Breathing</h2>
            <p>
              Equal four-second phases stimulate the vagus nerve and lower cortisol within minutes — the same protocol
              Navy SEALs use to stay composed under pressure.
            </p>
          </div>
        </>
      );
    case 'ready':
      return (
        <>
          <div className="whoop-source-stack">
            {proofTiles.map((tile) => (
              <MetricTile key={tile.label} label={tile.label} value={tile.value} source={tile.source} accent={tile.accent} />
            ))}
          </div>
          <div className="whoop-complete-card">
            <motion.div
              className="whoop-complete-card__check"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            >
              <Check size={34} />
            </motion.div>
            <h2>WHOOP connected</h2>
            <p>PulseCheck can now turn WHOOP signal into athlete readiness, Nora context, and validated protocols.</p>
          </div>
          <div className="whoop-live-summary">
            <div>
              <Watch size={17} />
              <span>Device registry</span>
              <strong>Live</strong>
            </div>
            <div>
              <Brain size={17} />
              <span>Nora context</span>
              <strong>Updated</strong>
            </div>
            <div>
              <Wind size={17} />
              <span>Protocol completed</span>
              <strong>Box Breathing</strong>
            </div>
          </div>
        </>
      );
  }
};

const HeroWhoopCard = () => (
  <div className="whoop-hero-card">
    <div>
      <div className="whoop-signature">
        <Star size={13} fill="currentColor" />
        <span>Performance device</span>
      </div>
      <h2>WHOOP</h2>
      <p>Continuous strain, recovery, sleep, and heart-rate context for PulseCheck athletes.</p>
      <StatusPill tone="purple">
        <BatteryCharging size={13} />
        Ready to pair
      </StatusPill>
    </div>
    <WhoopBand />
  </div>
);

export default function WhoopPulseCheckDemo() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const timerStartedAt = useRef<number>(Date.now());

  const activeStep = demoSteps[activeIndex];

  useEffect(() => {
    if (paused) return undefined;

    const stepMs = demoSteps[activeIndex].durationMs ?? DEFAULT_STEP_MS;
    timerStartedAt.current = Date.now() - progress * stepMs;
    const interval = window.setInterval(() => {
      const nextProgress = Math.min((Date.now() - timerStartedAt.current) / stepMs, 1);
      setProgress(nextProgress);

      if (nextProgress >= 1) {
        setActiveIndex((current) => (current + 1) % demoSteps.length);
        setProgress(0);
      }
    }, 80);

    return () => window.clearInterval(interval);
  }, [activeIndex, paused]);

  useEffect(() => {
    if (typeof window === 'undefined' || !voiceEnabled || !('speechSynthesis' in window)) {
      setSpeaking(false);
      return undefined;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(activeStep.nora);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((voice) =>
      /samantha|ava|allison|victoria|google us english/i.test(voice.name)
    );

    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.rate = 0.93;
    utterance.pitch = 1.03;
    utterance.volume = 0.9;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);

    return () => {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    };
  }, [activeStep.nora, voiceEnabled]);

  const resetDemo = () => {
    setActiveIndex(0);
    setProgress(0);
    setPaused(false);
  };

  return (
    <>
      <Head>
        <title>WHOOP × PulseCheck Integration Demo</title>
        <meta
          name="description"
          content="How WHOOP plugs into PulseCheck: device onboarding, biometric-informed coaching, and a real mental-training protocol — Box Breathing — validated by WHOOP data."
        />
      </Head>

      <main className="whoop-demo-page">
        <div className="whoop-demo-intro">
          <span className="whoop-demo-intro__eyebrow">PulseCheck × WHOOP</span>
          <h1>How WHOOP plugs into PulseCheck</h1>
          <p>
            A live walkthrough of device onboarding, biometric-informed coaching, and a real mental-training protocol —
            Box Breathing — validated by WHOOP&rsquo;s own data.
          </p>
        </div>

        <div className="whoop-demo-layout">
          <section className="whoop-demo-shell" aria-label="WHOOP and PulseCheck phone demo">
            <div className="whoop-phone">
              <PhoneStatusBar />
              <StepTracker activeIndex={activeIndex} progress={progress} />

              <div className="whoop-phone__screen">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep.id}
                    className="whoop-step"
                    initial={{ opacity: 0, y: 24, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -18, scale: 0.985 }}
                    transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {!activeStep.customHeader && (
                      <div className="whoop-step__header">
                        <span>{activeStep.eyebrow}</span>
                        <h1>{activeStep.title}</h1>
                        <p>{activeStep.subtitle}</p>
                      </div>
                    )}
                    <StepContent step={activeStep} />
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="whoop-nora-slot">
                <NoraBrief text={activeStep.nora} speaking={speaking || !paused} />
              </div>

              <div className="whoop-controls">
                <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Play' : 'Pause'}>
                  {paused ? <Play size={16} /> : <Pause size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceEnabled((value) => !value)}
                  aria-label={voiceEnabled ? 'Mute Nora' : 'Unmute Nora'}
                >
                  {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button type="button" onClick={resetDemo} aria-label="Restart demo">
                  <RefreshCcw size={16} />
                </button>
              </div>
            </div>
          </section>

          <aside className="whoop-demo-side">
            <div className="whoop-demo-side__item">
              <ShieldCheck size={18} />
              <div>
                <strong>OAuth-secured connection</strong>
                <span>Minimum scopes, explicit consent, revocable anytime.</span>
              </div>
            </div>
            <div className="whoop-demo-side__item">
              <Activity size={18} />
              <div>
                <strong>One canonical pipeline</strong>
                <span>WHOOP lands beside Polar, Oura, and Fitbit Air in the same health-context snapshot.</span>
              </div>
            </div>
            <div className="whoop-demo-side__item">
              <Brain size={18} />
              <div>
                <strong>Protocols that prove out</strong>
                <span>Box Breathing assigned from real signal, confirmed by WHOOP biofeedback.</span>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <style jsx global>{`
        body {
          background: #050508;
        }

        .whoop-demo-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 18% 18%, rgba(168, 85, 247, 0.18), transparent 30%),
            radial-gradient(circle at 78% 24%, rgba(224, 254, 16, 0.13), transparent 24%),
            linear-gradient(135deg, #050508 0%, #111018 48%, #050508 100%);
          color: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 28px;
          padding: 40px 24px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          letter-spacing: 0;
          overflow-x: hidden;
          overflow-y: auto;
        }

        .whoop-demo-intro {
          max-width: 620px;
          text-align: center;
        }

        .whoop-demo-intro__eyebrow {
          display: block;
          color: rgba(224, 254, 16, 0.78);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .whoop-demo-intro h1 {
          margin: 0 0 10px;
          color: #fff;
          font-size: 32px;
          font-weight: 900;
          line-height: 1.08;
        }

        .whoop-demo-intro p {
          margin: 0;
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
          line-height: 1.5;
        }

        .whoop-demo-layout {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 36px;
          width: 100%;
          flex-wrap: wrap;
        }

        .whoop-demo-shell {
          width: min(520px, 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .whoop-demo-side {
          display: flex;
          flex-direction: column;
          gap: 14px;
          width: min(280px, 100%);
        }

        .whoop-demo-side__item {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          border-radius: 18px;
          padding: 14px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015));
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #e0fe10;
        }

        .whoop-demo-side__item strong {
          display: block;
          color: #fff;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 3px;
        }

        .whoop-demo-side__item span {
          display: block;
          color: rgba(255, 255, 255, 0.56);
          font-size: 12px;
          line-height: 1.4;
          font-weight: 600;
        }

        .whoop-phone {
          position: relative;
          width: min(430px, calc(100vw - 32px));
          height: min(900px, calc(100vh - 48px));
          min-height: 680px;
          border-radius: 42px;
          border: 2px solid rgba(255, 255, 255, 0.12);
          background:
            linear-gradient(180deg, rgba(13, 12, 20, 0.98), rgba(5, 5, 8, 0.98)),
            #09090d;
          box-shadow:
            0 34px 110px rgba(0, 0, 0, 0.72),
            inset 0 0 0 8px rgba(0, 0, 0, 0.42);
          overflow: hidden;
        }

        .whoop-phone::before {
          content: '';
          position: absolute;
          z-index: 4;
          top: 11px;
          left: 50%;
          transform: translateX(-50%);
          width: 118px;
          height: 28px;
          border-radius: 0 0 18px 18px;
          background: #050508;
        }

        .whoop-status {
          position: relative;
          z-index: 5;
          height: 48px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          padding: 0 30px 8px;
          color: rgba(255, 255, 255, 0.92);
          font-size: 13px;
          font-weight: 800;
        }

        .whoop-status__right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .whoop-signal {
          width: 19px;
          height: 12px;
          display: inline-block;
          background: linear-gradient(90deg, #fff 0 20%, transparent 20% 28%, #fff 28% 48%, transparent 48% 56%, #fff 56% 76%, transparent 76%);
          border-radius: 2px;
          opacity: 0.9;
        }

        .whoop-battery {
          width: 24px;
          height: 12px;
          border: 1.5px solid rgba(255, 255, 255, 0.64);
          border-radius: 4px;
          padding: 2px;
          display: inline-flex;
        }

        .whoop-battery span {
          flex: 1;
          border-radius: 2px;
          background: #e0fe10;
        }

        .whoop-step-tracker {
          position: relative;
          z-index: 3;
          padding: 8px 22px 12px;
        }

        .whoop-step-tracker__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .whoop-step-tracker__header span {
          color: rgba(224, 254, 16, 0.74);
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.16em;
        }

        .whoop-step-tracker__header strong {
          color: rgba(255, 255, 255, 0.58);
          font-size: 11px;
        }

        .whoop-step-tracker__bar {
          height: 5px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }

        .whoop-step-tracker__bar div {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #8b5cf6, #e0fe10);
          box-shadow: 0 0 22px rgba(224, 254, 16, 0.26);
        }

        .whoop-step-tracker__dots {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 5px;
          margin-top: 10px;
        }

        .whoop-step-dot {
          height: 22px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 900;
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.34);
          border: 1px solid rgba(255, 255, 255, 0.06);
          transition: all 0.25s ease;
        }

        .whoop-step-dot--active {
          background: rgba(224, 254, 16, 0.14);
          color: #e0fe10;
          border-color: rgba(224, 254, 16, 0.35);
        }

        .whoop-step-dot--complete {
          background: rgba(34, 197, 94, 0.16);
          color: #34d399;
          border-color: rgba(52, 211, 153, 0.26);
        }

        .whoop-phone__screen {
          height: calc(100% - 248px);
          overflow: hidden;
          padding: 0 22px;
        }

        .whoop-step {
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-bottom: 18px;
          scrollbar-width: none;
        }

        .whoop-step::-webkit-scrollbar {
          display: none;
        }

        .whoop-step__header {
          flex-shrink: 0;
        }

        .whoop-step__header span {
          color: rgba(167, 139, 250, 0.82);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .whoop-step__header h1 {
          margin: 5px 0 5px;
          color: #fff;
          font-size: 32px;
          line-height: 1.02;
          font-weight: 900;
        }

        .whoop-step__header p {
          margin: 0;
          color: rgba(255, 255, 255, 0.58);
          font-size: 14px;
          line-height: 1.42;
          font-weight: 550;
        }

        .whoop-sheet-nav {
          display: grid;
          grid-template-columns: 41px 1fr 41px;
          align-items: center;
          margin-bottom: 14px;
          flex-shrink: 0;
        }

        .whoop-sheet-nav__close {
          width: 41px;
          height: 41px;
          border: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          font-size: 22px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .whoop-sheet-nav__title {
          text-align: center;
          color: #fff;
          font-size: 15px;
          font-weight: 900;
        }

        .whoop-sheet-nav__spacer {
          display: block;
        }

        .whoop-sheet-heading {
          padding: 0;
          flex-shrink: 0;
          margin-bottom: 4px;
        }

        .whoop-sheet-heading h1 {
          margin: 2px 0 8px;
          color: #fff;
          font-size: 30px;
          line-height: 1.02;
          font-weight: 900;
        }

        .whoop-sheet-heading p {
          margin: 0;
          color: rgba(255, 255, 255, 0.58);
          font-size: 14px;
          line-height: 1.42;
          font-weight: 550;
        }

        .whoop-device-stack {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .whoop-source-stack {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          min-height: 0;
        }

        .whoop-device-card {
          min-height: 162px;
          border-radius: 28px;
          padding: 18px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 132px;
          gap: 8px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.025));
          border: 1px solid rgba(255, 255, 255, 0.1);
          overflow: hidden;
        }

        .whoop-device-card--active {
          background:
            radial-gradient(circle at 76% 42%, rgba(224, 254, 16, 0.16), transparent 34%),
            linear-gradient(135deg, rgba(98, 68, 155, 0.7), rgba(23, 21, 33, 0.92));
          border-color: rgba(167, 139, 250, 0.58);
        }

        .whoop-device-card__copy {
          min-width: 0;
        }

        .whoop-signature {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 5px 9px;
          background: #a78bfa;
          color: #080711;
          font-size: 9px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 10px;
        }

        .whoop-signature--new {
          background: #e0fe10;
          color: #080711;
        }

        .whoop-device-card h3,
        .whoop-hero-card h2 {
          margin: 0;
          font-size: 32px;
          line-height: 1;
          font-weight: 950;
          color: #fff;
        }

        .whoop-device-card p,
        .whoop-hero-card p {
          margin: 9px 0 10px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 13px;
          line-height: 1.36;
          font-weight: 600;
        }

        .whoop-pill {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          white-space: nowrap;
        }

        .whoop-pill--green {
          color: #34d399;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.35);
        }

        .whoop-pill--purple {
          color: #c4b5fd;
          background: rgba(139, 92, 246, 0.13);
          border: 1px solid rgba(167, 139, 250, 0.35);
        }

        .whoop-pill--orange {
          color: #fdba74;
          background: rgba(249, 115, 22, 0.13);
          border: 1px solid rgba(251, 146, 60, 0.35);
        }

        .whoop-pill--muted {
          color: rgba(255, 255, 255, 0.72);
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .whoop-card-link {
          margin-top: 13px;
          display: flex;
          align-items: center;
          gap: 7px;
          color: #a78bfa;
          font-size: 12px;
          font-weight: 900;
        }

        .whoop-device-card__visual {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
          margin: -10px -6px -10px 0;
          color: #a78bfa;
        }

        .device-art {
          width: 100%;
          height: 100%;
          max-height: 158px;
          object-fit: contain;
          filter: drop-shadow(0 16px 22px rgba(0, 0, 0, 0.42));
        }

        .device-art--compact {
          width: 56px;
          height: 72px;
        }

        .whoop-add-device-row {
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr) 16px;
          align-items: center;
          gap: 12px;
          width: 100%;
          border-radius: 18px;
          padding: 14px 16px;
          margin-top: 2px;
          flex-shrink: 0;
          background: rgba(255, 255, 255, 0.04);
          border: 1px dashed rgba(255, 255, 255, 0.16);
          color: rgba(255, 255, 255, 0.82);
          cursor: pointer;
        }

        .whoop-add-device-row__icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .whoop-add-device-row__label {
          text-align: left;
          font-size: 13px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.86);
        }

        .whoop-hero-card,
        .whoop-oauth-card,
        .whoop-complete-card,
        .whoop-panel {
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.028));
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .whoop-hero-card {
          min-height: 204px;
          padding: 16px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 106px;
          gap: 10px;
          background:
            radial-gradient(circle at 82% 36%, rgba(224, 254, 16, 0.18), transparent 34%),
            linear-gradient(135deg, rgba(77, 61, 126, 0.72), rgba(18, 17, 28, 0.94));
          border-color: rgba(167, 139, 250, 0.55);
        }

        .whoop-panel {
          padding: 14px;
        }

        .whoop-panel h2 {
          margin: 0 0 10px;
          color: #fff;
          font-size: 15px;
          font-weight: 900;
        }

        .whoop-panel p {
          margin: 0;
          color: rgba(255, 255, 255, 0.66);
          font-size: 13px;
          line-height: 1.45;
          font-weight: 570;
        }

        .whoop-panel--compact {
          padding: 13px;
        }

        .whoop-benefit-grid,
        .whoop-scope-list {
          display: grid;
          gap: 8px;
        }

        .whoop-permission-row {
          display: grid;
          grid-template-columns: 36px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
        }

        .whoop-permission-row__icon {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: rgba(224, 254, 16, 0.11);
          color: #e0fe10;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .whoop-permission-row strong,
        .whoop-permission-row span {
          display: block;
        }

        .whoop-permission-row strong {
          color: #fff;
          font-size: 13px;
          font-weight: 900;
        }

        .whoop-permission-row span {
          color: rgba(255, 255, 255, 0.55);
          font-size: 12px;
          line-height: 1.3;
          margin-top: 2px;
        }

        .whoop-primary-button {
          min-height: 48px;
          border: 0;
          border-radius: 14px;
          background: #e0fe10;
          color: #080711;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 950;
          box-shadow: 0 18px 44px rgba(224, 254, 16, 0.18);
        }

        .whoop-primary-button--dark {
          width: 100%;
          background: #fff;
          box-shadow: none;
        }

        .whoop-oauth-card {
          padding: 16px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(230, 231, 236, 0.94));
          color: #111116;
        }

        .whoop-oauth-card__brand {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .whoop-oauth-card__brand span {
          display: block;
          color: rgba(17, 17, 22, 0.55);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .whoop-oauth-card__brand strong {
          display: block;
          color: #111116;
          font-size: 19px;
          line-height: 1.1;
          font-weight: 950;
        }

        .whoop-oauth-card p {
          color: rgba(17, 17, 22, 0.66);
          font-size: 13px;
          line-height: 1.45;
          font-weight: 650;
          margin: 14px 0;
        }

        .whoop-scope-list {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-bottom: 14px;
        }

        .whoop-security-note {
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 14px;
          padding: 12px;
          color: #c4b5fd;
          background: rgba(139, 92, 246, 0.12);
          border: 1px solid rgba(167, 139, 250, 0.22);
          font-size: 12px;
          line-height: 1.35;
          font-weight: 700;
        }

        .whoop-sync-stage {
          text-align: center;
          border-radius: 18px;
          padding: 20px 16px;
          background: radial-gradient(circle at 50% 42%, rgba(224, 254, 16, 0.15), transparent 46%);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .whoop-sync-ring {
          width: 120px;
          height: 120px;
          margin: 0 auto 10px;
          border-radius: 50%;
          border: 1px dashed rgba(224, 254, 16, 0.42);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .whoop-sync-stage h2 {
          margin: 0;
          color: #fff;
          font-size: 19px;
          font-weight: 950;
        }

        .whoop-sync-stage p {
          margin: 7px 0 0;
          color: rgba(255, 255, 255, 0.58);
          font-size: 13px;
          line-height: 1.4;
          font-weight: 600;
        }

        .whoop-metric-tile {
          border-radius: 14px;
          padding: 12px;
          background: color-mix(in srgb, var(--accent) 13%, rgba(255, 255, 255, 0.035));
          border: 1px solid color-mix(in srgb, var(--accent) 28%, rgba(255, 255, 255, 0.08));
        }

        .whoop-metric-tile span,
        .whoop-metric-tile strong,
        .whoop-metric-tile em {
          display: block;
        }

        .whoop-metric-tile span {
          color: rgba(255, 255, 255, 0.54);
          font-size: 11px;
          font-weight: 800;
        }

        .whoop-metric-tile strong {
          margin-top: 5px;
          color: #fff;
          font-size: 20px;
          font-weight: 950;
        }

        .whoop-metric-tile em {
          margin-top: 5px;
          color: var(--accent);
          font-size: 10px;
          font-style: normal;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .whoop-checkin-quote {
          border-radius: 18px;
          padding: 14px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .whoop-checkin-quote span {
          display: block;
          color: rgba(255, 255, 255, 0.5);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          margin-bottom: 6px;
        }

        .whoop-checkin-quote p {
          margin: 0;
          color: #fff;
          font-size: 14px;
          font-style: italic;
          line-height: 1.4;
          font-weight: 650;
        }

        .whoop-signal-stack {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .whoop-signal-row {
          display: grid;
          grid-template-columns: 84px minmax(0, 1fr) 20px;
          align-items: center;
          gap: 10px;
          border-radius: 14px;
          padding: 10px 12px;
          background: color-mix(in srgb, var(--accent) 12%, rgba(255, 255, 255, 0.035));
          border: 1px solid color-mix(in srgb, var(--accent) 26%, rgba(255, 255, 255, 0.08));
          color: var(--accent);
        }

        .whoop-signal-row__label {
          color: rgba(255, 255, 255, 0.62);
          font-size: 12px;
          font-weight: 800;
        }

        .whoop-signal-row__values {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #fff;
          font-size: 13px;
          font-weight: 900;
        }

        .whoop-signal-row__values em {
          color: rgba(255, 255, 255, 0.4);
          font-style: normal;
          font-weight: 700;
        }

        .whoop-match-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 8px 14px;
          background: rgba(224, 254, 16, 0.1);
          border: 1px solid rgba(224, 254, 16, 0.28);
          color: #e0fe10;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          width: fit-content;
        }

        .whoop-breathing-stage {
          text-align: center;
          border-radius: 18px;
          padding: 22px 16px;
          background: radial-gradient(circle at 50% 38%, rgba(224, 254, 16, 0.16), transparent 48%);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .whoop-breathing-ring-wrap {
          position: relative;
          width: 150px;
          height: 150px;
          margin: 0 auto 14px;
        }

        .whoop-breathing-ring {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid rgba(224, 254, 16, 0.45);
          background: radial-gradient(circle, rgba(224, 254, 16, 0.16), transparent 70%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .whoop-breathing-ring__phase {
          color: #fff;
          font-size: 15px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .whoop-breathing-hr {
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          padding: 5px 10px;
          background: rgba(10, 9, 16, 0.9);
          border: 1px solid rgba(248, 113, 113, 0.35);
          color: #f87171;
          font-size: 11px;
          font-weight: 900;
        }

        .whoop-breathing-instruction {
          margin: 4px 0 12px;
          color: rgba(255, 255, 255, 0.68);
          font-size: 13px;
          font-weight: 650;
        }

        .whoop-breathing-dots {
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-bottom: 8px;
        }

        .whoop-breathing-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.18);
        }

        .whoop-breathing-dot--active {
          background: #e0fe10;
          box-shadow: 0 0 10px rgba(224, 254, 16, 0.6);
        }

        .whoop-breathing-cycle-label {
          display: block;
          color: rgba(255, 255, 255, 0.46);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .whoop-complete-card {
          padding: 24px 18px;
          text-align: center;
          background:
            radial-gradient(circle at 50% 30%, rgba(224, 254, 16, 0.2), transparent 42%),
            linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(139, 92, 246, 0.13));
        }

        .whoop-complete-card__check {
          width: 74px;
          height: 74px;
          border-radius: 50%;
          margin: 0 auto 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #080711;
          background: #e0fe10;
          box-shadow: 0 0 50px rgba(224, 254, 16, 0.26);
        }

        .whoop-complete-card h2 {
          margin: 0;
          color: #fff;
          font-size: 28px;
          line-height: 1;
          font-weight: 950;
        }

        .whoop-complete-card p {
          margin: 10px 0 0;
          color: rgba(255, 255, 255, 0.62);
          font-size: 13px;
          line-height: 1.42;
          font-weight: 650;
        }

        .whoop-live-summary {
          display: grid;
          gap: 9px;
        }

        .whoop-live-summary div {
          border-radius: 14px;
          padding: 12px;
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr) auto;
          gap: 9px;
          align-items: center;
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.09);
          color: #a78bfa;
        }

        .whoop-live-summary span {
          color: rgba(255, 255, 255, 0.62);
          font-size: 12px;
          font-weight: 800;
        }

        .whoop-live-summary strong {
          color: #e0fe10;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .whoop-nora-slot {
          position: absolute;
          left: 20px;
          right: 20px;
          bottom: 66px;
          z-index: 6;
        }

        .whoop-nora-brief {
          position: relative;
          min-height: 88px;
          border-radius: 28px;
          padding: 14px 16px;
          display: grid;
          grid-template-columns: 45px minmax(0, 1fr);
          gap: 12px;
          align-items: center;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.02));
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 1px 0 inset rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(20px);
          overflow: hidden;
        }

        .whoop-nora-brief::before {
          content: '';
          position: absolute;
          top: 0;
          left: 14%;
          right: 14%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(224, 254, 16, 0.65), transparent);
        }

        .whoop-nora-brief span {
          display: block;
          color: #e0fe10;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .whoop-nora-brief p {
          margin: 0;
          color: rgba(255, 255, 255, 0.78);
          font-size: 12px;
          line-height: 1.33;
          font-weight: 650;
        }

        .whoop-nora-orb {
          position: relative;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .whoop-nora-orb__glow {
          position: absolute;
          inset: 2px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(224, 254, 16, 0.42), transparent 68%);
          filter: blur(8px);
        }

        .whoop-nora-orb__core {
          position: relative;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #080711;
          background: linear-gradient(135deg, #e0fe10, #a78bfa);
        }

        .whoop-controls {
          position: absolute;
          z-index: 8;
          left: 50%;
          bottom: 18px;
          transform: translateX(-50%);
          display: flex;
          gap: 9px;
        }

        .whoop-controls button {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.075);
          color: rgba(255, 255, 255, 0.86);
          backdrop-filter: blur(18px);
        }

        @media (max-width: 1040px) {
          .whoop-demo-side {
            width: min(430px, 100%);
            flex-direction: row;
            flex-wrap: wrap;
          }

          .whoop-demo-side__item {
            flex: 1 1 200px;
          }
        }

        @media (max-width: 900px) {
          .whoop-demo-page {
            padding: 24px 16px;
          }
        }

        @media (max-width: 470px) {
          .whoop-demo-intro,
          .whoop-demo-side {
            display: none;
          }

          .whoop-demo-page {
            padding: 0;
            gap: 0;
            background: #050508;
          }

          .whoop-demo-layout {
            gap: 0;
          }

          .whoop-demo-shell {
            width: 100%;
          }

          .whoop-phone {
            width: 100vw;
            height: 100vh;
            min-height: 680px;
            border-radius: 0;
            border: 0;
          }

          .whoop-step__header h1,
          .whoop-sheet-heading h1 {
            font-size: 29px;
          }

          .whoop-device-card {
            grid-template-columns: minmax(0, 1fr) 116px;
          }
        }
      `}</style>
    </>
  );
}
