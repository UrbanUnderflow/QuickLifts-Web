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
import {
  OuraIntegrationError,
  ouraIntegrationService,
  type OuraConnectionStatus,
} from '../../api/firebase/mentaltraining/ouraIntegrationService';

type BannerMessage = {
  tone: 'success' | 'error' | 'info';
  text: string;
};

const DEFAULT_SCOPES = ['daily'];

type OuraUiAction = 'connect' | 'disconnect' | 'status' | 'refresh';

function withSupportCode(message: string, code: string) {
  return `${message} Code: ${code}.`;
}

function callbackErrorMessage(code: string) {
  switch (code) {
    case 'OURA_CALLBACK_EXPIRED':
    case 'missing_state':
      return withSupportCode('That Oura connection request expired. Start the connection again from this page.', 'OURA_CALLBACK_EXPIRED');
    case 'OURA_CALLBACK_INVALID_STATE':
      return withSupportCode('That Oura connection request is no longer active. Start the connection again from this page.', 'OURA_CALLBACK_INVALID_STATE');
    case 'OURA_CALLBACK_FAILED':
    case 'token_exchange_failed':
      return withSupportCode('We could not finish the Oura connection right now. Try again in a minute.', 'OURA_CALLBACK_FAILED');
    case 'missing_code':
      return withSupportCode('Oura returned without a sign-in code. Start the connection again from this page.', 'OURA_CALLBACK_MISSING_CODE');
    default:
      return withSupportCode('We could not finish the Oura connection right now. Try again in a minute.', code || 'OURA_CALLBACK_FAILED');
  }
}

function ouraBannerErrorMessage(error: unknown, action: OuraUiAction) {
  const fallbackCode =
    action === 'connect'
      ? 'OURA_CONNECT_FAILED'
      : action === 'disconnect'
      ? 'OURA_DISCONNECT_FAILED'
      : action === 'refresh'
      ? 'OURA_SYNC_FAILED'
      : 'OURA_STATUS_FAILED';
  const code =
    error instanceof OuraIntegrationError
      ? error.code || fallbackCode
      : error instanceof TypeError
      ? 'OURA_NETWORK_UNAVAILABLE'
      : fallbackCode;

  switch (code) {
    case 'OURA_AUTH_REQUIRED':
      return withSupportCode(
        action === 'connect'
          ? 'Sign in to PulseCheck again, then start your Oura connection one more time.'
          : 'Sign in to PulseCheck again, then try this Oura step one more time.',
        code
      );
    case 'OURA_NETWORK_UNAVAILABLE':
      return withSupportCode('We could not reach Oura right now. Check your connection and try again.', code);
    case 'OURA_FIREBASE_NOT_READY':
      return withSupportCode('This Oura page is still getting ready. Refresh the page and try again.', code);
    case 'OURA_CONFIG_UNAVAILABLE':
      return withSupportCode('The Oura connection is unavailable right now. Try again a little later.', code);
    case 'OURA_CALLBACK_FAILED':
      return withSupportCode('We could not finish the Oura connection right now. Try again in a minute.', code);
    case 'OURA_INVALID_REQUEST':
      return withSupportCode('That Oura request was missing a detail. Try again.', code);
    default:
      return withSupportCode(
        action === 'connect'
          ? 'We could not start the Oura connection right now. Try again in a minute.'
          : action === 'disconnect'
          ? 'We could not disconnect Oura right now. Try again in a minute.'
          : action === 'refresh'
          ? 'We could not refresh your Oura recovery data right now. Try again in a minute.'
          : 'We could not check your Oura connection right now. Try again in a minute.',
        code
      );
  }
}

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

const statusToneClasses: Record<BannerMessage['tone'], string> = {
  success: 'border-green-500/20 bg-green-500/[0.06] text-green-200',
  info: 'border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-200',
  error: 'border-red-500/20 bg-red-500/[0.06] text-red-200',
};

const chipToneClasses = {
  connected: 'border-[#E0FE10]/35 bg-[#E0FE10]/10 text-[#F4FF99]',
  idle: 'border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-100',
};

const GlassCard: React.FC<{
  children: React.ReactNode;
  accentColor?: string;
  className?: string;
  delay?: number;
  hoverGlow?: boolean;
}> = ({ children, accentColor = '#E0FE10', className = '', delay = 0, hoverGlow = false }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={hoverGlow ? { scale: 1.015, y: -4 } : undefined}
      className={`relative group ${className}`}
    >
      <div
        className="absolute -inset-1 rounded-[32px] blur-xl opacity-0 transition-all duration-700 group-hover:opacity-35"
        style={{ background: `linear-gradient(135deg, ${accentColor}40, transparent 60%)` }}
      />
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-zinc-900/40 backdrop-blur-xl">
        <div
          className="absolute left-0 right-0 top-0 h-[1px] opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${accentColor}80, transparent)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
        {children}
      </div>
    </motion.div>
  );
}

const FloatingOrb: React.FC<{
  color: string;
  size: string;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  delay?: number;
}> = ({ color, size, position, delay = 0 }) => {
  return (
    <motion.div
      className={`absolute ${size} rounded-full blur-3xl pointer-events-none`}
      style={{ backgroundColor: color, ...position }}
      animate={{ scale: [1, 1.18, 1], opacity: [0.22, 0.42, 0.22] }}
      transition={{ duration: 8, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
};

function FeaturePill({
  icon,
  label,
  accent = '#3B82F6',
}: {
  icon: React.ReactNode;
  label: string;
  accent?: string;
}) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300 backdrop-blur-xl"
      style={{ borderColor: `${accent}20`, background: `${accent}10` }}
    >
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
    <GlassCard accentColor="#3B82F6" className="h-full">
      <div className="p-5">
        <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">{eyebrow}</div>
        <div className="mt-3 text-lg font-semibold text-white">{title}</div>
        <p className="mt-2 text-sm leading-7 text-zinc-400">{body}</p>
      </div>
    </GlassCard>
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
        text: callbackErrorMessage(error),
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
        text: ouraBannerErrorMessage(error, mode === 'refresh' ? 'refresh' : 'status'),
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
        text: ouraBannerErrorMessage(error, 'connect'),
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
        text: ouraBannerErrorMessage(error, 'disconnect'),
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
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0b] text-white">
      <Head>
        <title>Connect Oura | PulseCheck</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className="pointer-events-none absolute inset-0">
        <FloatingOrb color="#E0FE10" size="h-[520px] w-[520px]" position={{ top: '-10%', left: '-12%' }} delay={0} />
        <FloatingOrb color="#3B82F6" size="h-[420px] w-[420px]" position={{ top: '22%', right: '-6%' }} delay={2} />
        <FloatingOrb color="#8B5CF6" size="h-[360px] w-[360px]" position={{ bottom: '8%', left: '18%' }} delay={4} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(12,18,32,0.84),rgba(10,10,11,1)_60%)]" />
        <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 md:px-6">
        <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <GlassCard accentColor="#3B82F6" className="overflow-hidden" hoverGlow>
            <div className="relative min-h-[640px] p-8">
              <motion.div
                initial={{ opacity: 0, x: -80, rotate: -12 }}
                animate={{ opacity: 0.55, x: 0, rotate: -12 }}
                transition={{ duration: 0.9, delay: 0.18 }}
                className="pointer-events-none absolute bottom-10 left-[-6%] h-44 w-72 rounded-[32px] border border-cyan-400/15 bg-gradient-to-br from-cyan-400/10 to-transparent backdrop-blur-xl"
              />
              <motion.div
                initial={{ opacity: 0, x: 90, rotate: 14 }}
                animate={{ opacity: 0.45, x: 0, rotate: 14 }}
                transition={{ duration: 0.95, delay: 0.26 }}
                className="pointer-events-none absolute right-[-8%] top-[16%] h-56 w-72 rounded-[32px] border border-[#E0FE10]/15 bg-gradient-to-br from-[#E0FE10]/8 to-transparent backdrop-blur-xl"
              />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.1, delay: 0.28 }}
                className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#3B82F6]/8 via-transparent to-transparent"
              />

              <div className="relative z-10 flex min-h-[576px] flex-col justify-between">
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
                  <FeaturePill icon={<Waves className="h-3.5 w-3.5 text-cyan-200" />} label="Sleep + readiness insights" accent="#3B82F6" />
                  <FeaturePill icon={<Sparkles className="h-3.5 w-3.5 text-[#E0FE10]" />} label="Personalized daily guidance" accent="#E0FE10" />
                  <FeaturePill icon={<ShieldCheck className="h-3.5 w-3.5 text-cyan-200" />} label="Disconnect anytime" accent="#8B5CF6" />
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
            </div>
          </GlassCard>

          <GlassCard accentColor="#E0FE10" className="h-full" delay={0.08}>
            <div className="p-8">
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

                <div className="rounded-[24px] border border-cyan-500/12 bg-cyan-500/[0.04] p-5 text-sm leading-7 text-zinc-300 backdrop-blur-sm">
                  Connecting Oura helps PulseCheck read the rhythm behind your day, so the app can meet you with more relevant support instead of making you start from scratch every time.
                </div>
              </div>
            )}
            </div>
          </GlassCard>
        </section>
      </main>
    </div>
  );
}
