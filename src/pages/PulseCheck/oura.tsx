import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Unplug,
  Waves,
} from 'lucide-react';
import { auth } from '../../api/firebase/config';
import { ouraIntegrationService, type OuraConnectionStatus } from '../../api/firebase/mentaltraining/ouraIntegrationService';

type BannerMessage = {
  tone: 'success' | 'error' | 'info';
  text: string;
};

const DEFAULT_SCOPES = ['daily'];

function formatTimestamp(value?: number | null) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function scopesToHumanLabel(scopes?: string[]) {
  if (!scopes?.length) return 'Sleep, activity, and readiness';

  const labels = new Set<string>();
  scopes.forEach((scope) => {
    switch (scope) {
      case 'daily':
        labels.add('Sleep, activity, and readiness');
        break;
      case 'heartrate':
        labels.add('Heart-rate trends');
        break;
      case 'workout':
        labels.add('Workout summaries');
        break;
      case 'session':
        labels.add('Mindfulness sessions');
        break;
      case 'spo2':
        labels.add('Overnight oxygen trends');
        break;
      case 'tag':
        labels.add('Personal tags');
        break;
      case 'personal':
        labels.add('Personal profile details');
        break;
      case 'email':
        labels.add('Email address');
        break;
      default:
        break;
    }
  });

  return Array.from(labels).join(', ') || 'Sleep, activity, and readiness';
}

const glowTransition = {
  duration: 10,
  repeat: Infinity,
  ease: 'easeInOut' as const,
};

const orbitTransition = {
  duration: 14,
  repeat: Infinity,
  ease: 'linear' as const,
};

const pulseTransition = {
  duration: 3.6,
  repeat: Infinity,
  ease: 'easeInOut' as const,
};

const statusToneClasses: Record<BannerMessage['tone'], string> = {
  success: 'border-green-500/20 bg-green-500/[0.06] text-green-200',
  info: 'border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-200',
  error: 'border-red-500/20 bg-red-500/[0.06] text-red-200',
};

const chipToneClasses = {
  connected: 'border-[#E0FE10]/35 bg-[#E0FE10]/10 text-[#F4FF99]',
  idle: 'border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-100',
};

function RingCircuitGraphic() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[34px]">
      <motion.div
        className="absolute left-[-8%] top-[-10%] h-56 w-56 rounded-full blur-3xl"
        style={{ background: 'rgba(46, 226, 255, 0.14)' }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.55, 0.3] }}
        transition={glowTransition}
      />
      <motion.div
        className="absolute bottom-[-6%] right-[-6%] h-52 w-52 rounded-full blur-3xl"
        style={{ background: 'rgba(224, 254, 16, 0.12)' }}
        animate={{ scale: [1.05, 0.92, 1.05], opacity: [0.22, 0.4, 0.22] }}
        transition={{ ...glowTransition, duration: 9 }}
      />

      <div className="absolute inset-0">
        <svg
          viewBox="0 0 600 600"
          className="absolute left-1/2 top-1/2 h-[580px] w-[580px] -translate-x-1/2 -translate-y-1/2 opacity-90"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="oura-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(46,226,255,0.95)" />
              <stop offset="52%" stopColor="rgba(255,255,255,0.72)" />
              <stop offset="100%" stopColor="rgba(224,254,16,0.92)" />
            </linearGradient>
            <linearGradient id="oura-circuit-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(46,226,255,0.08)" />
              <stop offset="50%" stopColor="rgba(46,226,255,0.9)" />
              <stop offset="100%" stopColor="rgba(224,254,16,0.18)" />
            </linearGradient>
            <filter id="oura-ring-glow">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx="300" cy="300" r="156" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.2" />
          <circle cx="300" cy="300" r="146" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="22" />
          <circle
            cx="300"
            cy="300"
            r="148"
            fill="none"
            stroke="url(#oura-ring-gradient)"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray="540 110"
            transform="rotate(-24 300 300)"
            filter="url(#oura-ring-glow)"
          />
          <circle
            cx="300"
            cy="300"
            r="148"
            fill="none"
            stroke="rgba(46,226,255,0.24)"
            strokeWidth="3"
            strokeDasharray="12 20"
            transform="rotate(30 300 300)"
          />

          <path d="M94 238 H210" stroke="url(#oura-circuit-gradient)" strokeWidth="3" strokeLinecap="round" />
          <path d="M392 192 H520 V136" stroke="url(#oura-circuit-gradient)" strokeWidth="3" strokeLinecap="round" />
          <path d="M388 414 H510 V478" stroke="url(#oura-circuit-gradient)" strokeWidth="3" strokeLinecap="round" />
          <path d="M88 366 H180 V462" stroke="url(#oura-circuit-gradient)" strokeWidth="3" strokeLinecap="round" />
          <path d="M210 120 V170" stroke="rgba(224,254,16,0.42)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M456 308 H548" stroke="rgba(224,254,16,0.3)" strokeWidth="2.5" strokeLinecap="round" />

          {[
            { cx: 94, cy: 238, color: '#2ee2ff' },
            { cx: 210, cy: 120, color: '#e0fe10' },
            { cx: 520, cy: 136, color: '#2ee2ff' },
            { cx: 548, cy: 308, color: '#e0fe10' },
            { cx: 510, cy: 478, color: '#2ee2ff' },
            { cx: 180, cy: 462, color: '#e0fe10' },
          ].map((node) => (
            <g key={`${node.cx}-${node.cy}`}>
              <circle cx={node.cx} cy={node.cy} r="7" fill={node.color} fillOpacity="0.12" />
              <circle cx={node.cx} cy={node.cy} r="3.5" fill={node.color} />
            </g>
          ))}
        </svg>
      </div>

      <motion.div
        className="absolute left-1/2 top-1/2 h-[308px] w-[308px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
        animate={{ rotate: 360 }}
        transition={orbitTransition}
      >
        <motion.div
          className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(46,226,255,0.8)]"
          animate={{ scale: [0.9, 1.15, 0.9] }}
          transition={pulseTransition}
        />
      </motion.div>
      <motion.div
        className="absolute left-1/2 top-1/2 h-[358px] w-[358px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#E0FE10]/10"
        animate={{ rotate: -360 }}
        transition={{ ...orbitTransition, duration: 18 }}
      >
        <motion.div
          className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#E0FE10] shadow-[0_0_18px_rgba(224,254,16,0.7)]"
          animate={{ scale: [1, 1.22, 1] }}
          transition={{ ...pulseTransition, duration: 3.2 }}
        />
      </motion.div>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300 backdrop-blur-sm">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function InfoStat({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-black/20 p-5 backdrop-blur-sm">
      <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">{eyebrow}</div>
      <div className="mt-3 text-lg font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-7 text-zinc-400">{body}</p>
    </div>
  );
}

export default function PulseCheckOuraPage() {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [authResolved, setAuthResolved] = useState(Boolean(auth.currentUser));
  const [connection, setConnection] = useState<OuraConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'connect' | 'disconnect' | 'refresh' | null>(null);
  const [message, setMessage] = useState<BannerMessage | null>(null);

  const callbackBanner = useMemo(() => {
    const status = typeof router.query.status === 'string' ? router.query.status : '';
    const error = typeof router.query.error === 'string' ? router.query.error : '';

    if (status === 'connected') {
      return { tone: 'success' as const, text: 'Your Oura account is now connected to PulseCheck.' };
    }
    if (status === 'denied') {
      return { tone: 'info' as const, text: 'No problem. You can connect Oura anytime from this page.' };
    }
    if (status === 'error') {
      return {
        tone: 'error' as const,
        text: error ? `We could not finish the connection: ${error.replace(/_/g, ' ')}.` : 'We could not finish the Oura connection.',
      };
    }
    return null;
  }, [router.query.error, router.query.status]);

  const loadStatus = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') {
      setActionLoading('refresh');
    } else {
      setLoading(true);
    }

    try {
      const nextStatus = await ouraIntegrationService.getStatus();
      setConnection(nextStatus);
    } catch (error) {
      console.error('[PulseCheck Oura page] Failed to load status:', error);
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'We could not load your Oura connection status.',
      });
    } finally {
      if (mode === 'refresh') {
        setActionLoading(null);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (callbackBanner) {
      setMessage(callbackBanner);
      const nextQuery = { ...router.query };
      delete nextQuery.status;
      delete nextQuery.error;
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true }).catch(() => undefined);
    }
  }, [callbackBanner, router]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setFirebaseUser(nextUser);
      setAuthResolved(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authResolved) return;
    if (!firebaseUser) {
      setLoading(false);
      return;
    }

    loadStatus().catch(() => undefined);
  }, [authResolved, firebaseUser, loadStatus]);

  const handleConnect = async () => {
    setActionLoading('connect');
    setMessage(null);
    try {
      await ouraIntegrationService.connect({
        returnTo: '/PulseCheck/oura',
        scopes: DEFAULT_SCOPES,
      });
    } catch (error) {
      console.error('[PulseCheck Oura page] Failed to start connect flow:', error);
      setActionLoading(null);
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'We could not start the Oura connection flow.',
      });
    }
  };

  const handleDisconnect = async () => {
    setActionLoading('disconnect');
    setMessage(null);
    try {
      const nextConnection = await ouraIntegrationService.disconnect();
      setConnection(nextConnection);
      setMessage({ tone: 'success', text: 'Oura has been disconnected from PulseCheck.' });
    } catch (error) {
      console.error('[PulseCheck Oura page] Failed to disconnect:', error);
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'We could not disconnect Oura.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const connectionState = connection?.connected ? 'connected' : 'idle';
  const statusTitle = connection?.connected ? 'Your Oura ring is connected' : 'Bring your recovery data into PulseCheck';
  const statusBody = connection?.connected
    ? 'PulseCheck can now use your Oura trends to personalize your daily experience.'
    : 'Connect once to bring your sleep, activity, and readiness trends into your PulseCheck account.';
  const sharedDataLabel = scopesToHumanLabel(connection?.grantedScopes?.length ? connection.grantedScopes : DEFAULT_SCOPES);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070c] text-white">
      <Head>
        <title>Connect Oura | PulseCheck</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(8,18,38,0.88),rgba(5,7,12,1)_58%)]" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 md:px-6">
        <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[34px] border border-cyan-500/15 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(224,254,16,0.08),_transparent_28%),#08101d] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
          >
            <RingCircuitGraphic />

            <div className="relative z-10 flex min-h-[640px] flex-col justify-between">
              <div className="max-w-lg space-y-6">
                <div className="inline-flex rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3">
                  <Link2 className="h-6 w-6 text-cyan-200" />
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Wearable Connection</p>
                  <h1 className="mt-3 max-w-md text-4xl font-semibold leading-tight md:text-5xl">
                    Connect your Oura ring to PulseCheck
                  </h1>
                  <p className="mt-5 max-w-lg text-base leading-8 text-zinc-300">
                    Turn your Oura sleep and recovery trends into a calmer, more personalized PulseCheck experience. One secure connection helps PulseCheck understand how you are showing up today.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <FeaturePill icon={<Waves className="h-3.5 w-3.5 text-cyan-200" />} label="Sleep + readiness insights" />
                  <FeaturePill icon={<Sparkles className="h-3.5 w-3.5 text-[#E0FE10]" />} label="Personalized daily guidance" />
                  <FeaturePill icon={<ShieldCheck className="h-3.5 w-3.5 text-cyan-200" />} label="Disconnect anytime" />
                </div>
              </div>

              <div className="relative z-10 grid gap-4 md:grid-cols-3">
                <InfoStat
                  eyebrow="What comes in"
                  title="Recovery trends"
                  body="PulseCheck starts with your daily Oura summaries so it can better understand how recovered you feel."
                />
                <InfoStat
                  eyebrow="What it helps with"
                  title="More useful check-ins"
                  body="The app can respond with context instead of treating every day like it feels the same."
                />
                <InfoStat
                  eyebrow="Your control"
                  title="Connect or disconnect"
                  body="You stay in control of the link. You can remove Oura from PulseCheck whenever you want."
                />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[34px] border border-zinc-800 bg-[linear-gradient(180deg,rgba(15,22,39,0.96),rgba(9,15,28,0.98))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
          >
            {message ? (
              <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${statusToneClasses[message.tone]}`}>
                {message.text}
              </div>
            ) : null}

            {!authResolved || loading ? (
              <div className="flex min-h-[520px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
              </div>
            ) : !firebaseUser ? (
              <div className="flex min-h-[520px] flex-col justify-center space-y-5">
                <div className="rounded-[28px] border border-white/8 bg-black/20 p-6">
                  <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Before you connect</div>
                  <h2 className="mt-3 text-3xl font-semibold text-white">Sign in to PulseCheck</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    We connect Oura to your PulseCheck account, so you will need to sign in first.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/PulseCheck/login"
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#E0FE10] px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                  >
                    Open PulseCheck Login
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-[28px] border border-white/8 bg-black/20 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-md">
                      <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Connection status</div>
                      <h2 className="mt-3 text-3xl font-semibold text-white">{statusTitle}</h2>
                      <p className="mt-3 text-sm leading-7 text-zinc-300">{statusBody}</p>
                    </div>
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.18em] ${
                        connectionState === 'connected' ? chipToneClasses.connected : chipToneClasses.idle
                      }`}
                    >
                      {connection?.connected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      {connection?.connected ? 'Connected' : 'Ready to connect'}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <InfoStat
                    eyebrow="PulseCheck uses"
                    title={sharedDataLabel}
                    body="We start with the essentials so PulseCheck can personalize your experience without asking for more than it needs."
                  />
                  <InfoStat
                    eyebrow="Connection started"
                    title={connection?.connected ? formatTimestamp(connection?.connectedAt) : 'Not connected yet'}
                    body={connection?.connected ? 'Your Oura account is actively linked to PulseCheck.' : 'Once connected, your Oura account will appear here.'}
                  />
                  <InfoStat
                    eyebrow="Privacy"
                    title="You stay in control"
                    body="You can disconnect Oura at any time, and PulseCheck only uses the shared data to improve your experience."
                  />
                  <InfoStat
                    eyebrow="Need a refresh?"
                    title="Check your latest status"
                    body="If you just connected Oura in another tab, refresh here to confirm the link is active."
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#E0FE10] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    {connection?.connected ? 'Reconnect Oura' : 'Connect Oura'}
                  </button>

                  <button
                    type="button"
                    onClick={() => loadStatus('refresh')}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading === 'refresh' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    Refresh Status
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={actionLoading !== null || !connection?.connected}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-500/30 px-5 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading === 'disconnect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                    Disconnect
                  </button>
                </div>

                <div className="rounded-[24px] border border-cyan-500/12 bg-cyan-500/[0.04] p-5 text-sm leading-7 text-zinc-300">
                  Connecting Oura helps PulseCheck read the rhythm behind your day, so the app can meet you with more relevant support instead of making you start from scratch every time.
                </div>
              </div>
            )}
          </motion.div>
        </section>
      </main>
    </div>
  );
}
