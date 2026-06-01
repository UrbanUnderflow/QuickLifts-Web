import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  HeartPulse,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Unplug,
} from 'lucide-react';
import { auth } from '../../api/firebase/config';
import {
  GoogleHealthIntegrationError,
  googleHealthIntegrationService,
  type GoogleHealthConnectionStatus,
} from '../../api/firebase/mentaltraining/googleHealthIntegrationService';

type BannerMessage = {
  tone: 'success' | 'error' | 'info';
  text: string;
};

type GoogleHealthUiAction = 'connect' | 'disconnect' | 'status' | 'refresh';

interface GoogleHealthConnectionPageProps {
  productName: 'PulseCheck' | 'Fit With Pulse';
  returnTo: string;
  loginHref: string;
  backHref: string;
  backLabel: string;
}

function withSupportCode(message: string, code: string) {
  return `${message} Code: ${code}.`;
}

function callbackErrorMessage(code: string) {
  switch (code) {
    case 'GOOGLE_HEALTH_CALLBACK_EXPIRED':
    case 'missing_state':
      return withSupportCode('That Fitbit connection request expired. Start the connection again from this page.', 'GOOGLE_HEALTH_CALLBACK_EXPIRED');
    case 'GOOGLE_HEALTH_CALLBACK_INVALID_STATE':
      return withSupportCode('That Fitbit connection request is no longer active. Start the connection again from this page.', 'GOOGLE_HEALTH_CALLBACK_INVALID_STATE');
    case 'GOOGLE_HEALTH_CALLBACK_FAILED':
    case 'token_exchange_failed':
      return withSupportCode('We could not finish the Fitbit connection right now. Try again in a minute.', 'GOOGLE_HEALTH_CALLBACK_FAILED');
    case 'missing_code':
      return withSupportCode('Google returned without a sign-in code. Start the connection again from this page.', 'GOOGLE_HEALTH_CALLBACK_MISSING_CODE');
    default:
      return withSupportCode('We could not finish the Fitbit connection right now. Try again in a minute.', code || 'GOOGLE_HEALTH_CALLBACK_FAILED');
  }
}

function googleHealthBannerErrorMessage(error: unknown, action: GoogleHealthUiAction) {
  const fallbackCode =
    action === 'connect'
      ? 'GOOGLE_HEALTH_CONNECT_FAILED'
      : action === 'disconnect'
      ? 'GOOGLE_HEALTH_DISCONNECT_FAILED'
      : action === 'refresh'
      ? 'GOOGLE_HEALTH_SYNC_FAILED'
      : 'GOOGLE_HEALTH_STATUS_FAILED';
  const code =
    error instanceof GoogleHealthIntegrationError
      ? error.code || fallbackCode
      : error instanceof TypeError
      ? 'GOOGLE_HEALTH_NETWORK_UNAVAILABLE'
      : fallbackCode;

  switch (code) {
    case 'GOOGLE_HEALTH_AUTH_REQUIRED':
      return withSupportCode(
        action === 'connect'
          ? 'Sign in again, then start your Fitbit connection one more time.'
          : 'Sign in again, then try this Fitbit step one more time.',
        code
      );
    case 'GOOGLE_HEALTH_NETWORK_UNAVAILABLE':
      return withSupportCode('We could not reach Google Health right now. Check your connection and try again.', code);
    case 'GOOGLE_HEALTH_CONFIG_UNAVAILABLE':
      return withSupportCode('The Fitbit connection is unavailable right now. Try again a little later.', code);
    case 'GOOGLE_HEALTH_CALLBACK_FAILED':
      return withSupportCode('We could not finish the Fitbit connection right now. Try again in a minute.', code);
    case 'GOOGLE_HEALTH_INVALID_REQUEST':
      return withSupportCode('That Fitbit request was missing a detail. Try again.', code);
    default:
      return withSupportCode(
        action === 'connect'
          ? 'We could not start the Fitbit connection right now. Try again in a minute.'
          : action === 'disconnect'
          ? 'We could not disconnect Fitbit right now. Try again in a minute.'
          : action === 'refresh'
          ? 'We could not refresh your Fitbit health data right now. Try again in a minute.'
          : 'We could not check your Fitbit connection right now. Try again in a minute.',
        code
      );
  }
}

function timestampToDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 9999999999 ? value : value * 1000);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed) : null;
  }
  if (typeof value === 'object') {
    const candidate = value as { seconds?: number; _seconds?: number; toMillis?: () => number };
    if (typeof candidate.toMillis === 'function') return new Date(candidate.toMillis());
    const seconds = candidate.seconds ?? candidate._seconds;
    if (typeof seconds === 'number') return new Date(seconds * 1000);
  }
  return null;
}

function formatTimestamp(value?: unknown) {
  const date = timestampToDate(value);
  if (!date) return 'Not available';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function scopesToHumanLabel(scopes?: string[]) {
  if (!scopes?.length) return 'Activity, fitness, health metrics, sleep, and profile';

  const labels = new Set<string>();
  scopes.forEach((scope) => {
    const normalized = scope.toLowerCase();
    if (normalized.includes('activity_and_fitness')) labels.add('Activity and fitness');
    if (normalized.includes('health_metrics_and_measurements')) labels.add('Health metrics');
    if (normalized.includes('sleep')) labels.add('Sleep');
    if (normalized.includes('profile')) labels.add('Profile');
    if (normalized.includes('location')) labels.add('Location');
  });

  return Array.from(labels).join(', ') || 'Activity, fitness, health metrics, sleep, and profile';
}

const statusToneClasses: Record<BannerMessage['tone'], string> = {
  success: 'border-green-500/25 bg-green-500/[0.08] text-green-100',
  info: 'border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-100',
  error: 'border-red-500/25 bg-red-500/[0.08] text-red-100',
};

function DetailTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function CapabilityRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 border-b border-white/10 py-4 last:border-b-0">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 bg-white/[0.04] text-[#E0FE10]">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-white">{title}</div>
        <p className="mt-1 text-sm leading-6 text-zinc-400">{body}</p>
      </div>
    </div>
  );
}

export default function GoogleHealthConnectionPage({
  productName,
  returnTo,
  loginHref,
  backHref,
  backLabel,
}: GoogleHealthConnectionPageProps) {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [authResolved, setAuthResolved] = useState(Boolean(auth.currentUser));
  const [connection, setConnection] = useState<GoogleHealthConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'connect' | 'disconnect' | 'refresh' | null>(null);
  const [message, setMessage] = useState<BannerMessage | null>(null);

  const callbackBanner = useMemo(() => {
    const status = typeof router.query.status === 'string' ? router.query.status : '';
    const error = typeof router.query.error === 'string' ? router.query.error : '';

    if (status === 'connected') {
      return { tone: 'success' as const, text: 'Your Fitbit data is now connected through Google Health.' };
    }
    if (status === 'denied') {
      return { tone: 'info' as const, text: 'No problem. You can connect Fitbit anytime from this page.' };
    }
    if (status === 'error' || error) {
      return { tone: 'error' as const, text: callbackErrorMessage(error) };
    }
    return null;
  }, [router.query.error, router.query.status]);

  const loadStatus = useCallback(async () => {
    if (!auth.currentUser) {
      setConnection(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const status = await googleHealthIntegrationService.getStatus();
      setConnection(status);
    } catch (error) {
      console.error('[Google Health page] Failed to load status:', error);
      setMessage({ tone: 'error', text: googleHealthBannerErrorMessage(error, 'status') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthResolved(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authResolved) return;
    void loadStatus();
  }, [authResolved, firebaseUser, loadStatus]);

  useEffect(() => {
    if (!callbackBanner) return;
    setMessage(callbackBanner);
    if (router.query.status || router.query.error) {
      const nextQuery = { ...router.query };
      delete nextQuery.status;
      delete nextQuery.error;
      void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    }
  }, [callbackBanner, router]);

  const handleConnect = async () => {
    setActionLoading('connect');
    setMessage(null);
    try {
      await googleHealthIntegrationService.connect({ returnTo });
    } catch (error) {
      console.error('[Google Health page] Failed to start connect flow:', error);
      setMessage({ tone: 'error', text: googleHealthBannerErrorMessage(error, 'connect') });
      setActionLoading(null);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading('disconnect');
    setMessage(null);
    try {
      const status = await googleHealthIntegrationService.disconnect();
      setConnection(status);
      setMessage({ tone: 'success', text: 'Fitbit has been disconnected from Pulse.' });
    } catch (error) {
      console.error('[Google Health page] Failed to disconnect:', error);
      setMessage({ tone: 'error', text: googleHealthBannerErrorMessage(error, 'disconnect') });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefresh = async () => {
    setActionLoading('refresh');
    setMessage(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const result = await googleHealthIntegrationService.sync({ timezone });
      const status = await googleHealthIntegrationService.getStatus();
      setConnection(status);
      setMessage({
        tone: result.status === 'synced' ? 'success' : 'info',
        text: result.detail || 'Fitbit sync finished.',
      });
    } catch (error) {
      console.error('[Google Health page] Failed to refresh:', error);
      setMessage({ tone: 'error', text: googleHealthBannerErrorMessage(error, 'refresh') });
    } finally {
      setActionLoading(null);
    }
  };

  const connected = connection?.connected === true;
  const pageTitle = `Connect Fitbit | ${productName}`;
  const grantedScopes = scopesToHumanLabel(connection?.grantedScopes || connection?.requestedScopes);

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta
          name="description"
          content={`Connect Fitbit and Google Health data to ${productName}.`}
        />
      </Head>

      <main className="min-h-screen bg-[#080B10] text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={backHref} className="text-sm font-semibold text-zinc-400 transition-colors hover:text-white">
              {backLabel}
            </Link>
            <div className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">
              <ShieldCheck className="h-4 w-4 text-[#E0FE10]" />
              Google Health
            </div>
          </div>

          <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div className="space-y-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#E0FE10]">
                  Fitbit Air ready
                </div>
                <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-normal text-white sm:text-5xl">
                  Connect Fitbit through Google Health
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-300">
                  {productName} can use Fitbit sleep, heart-rate, activity, and workout summaries after the wearable syncs into Google Health.
                </p>
              </div>

              {message && (
                <div className={`border px-4 py-3 text-sm leading-6 ${statusToneClasses[message.tone]}`}>
                  {message.text}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <DetailTile
                  label="Status"
                  value={loading ? 'Checking' : connected ? 'Connected' : 'Not connected'}
                />
                <DetailTile
                  label="Last sync"
                  value={formatTimestamp(connection?.lastSuccessfulSyncAt)}
                />
                <DetailTile
                  label="Date"
                  value={connection?.lastSuccessfulSnapshotDateKey || 'Not available'}
                />
              </div>

              {!authResolved || loading ? (
                <div className="flex items-center gap-3 border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-300">
                  <Loader2 className="h-4 w-4 animate-spin text-[#E0FE10]" />
                  Checking your Fitbit connection
                </div>
              ) : !firebaseUser ? (
                <div className="border border-white/10 bg-white/[0.03] p-5">
                  <div className="text-lg font-semibold text-white">Sign in to connect Fitbit</div>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    We connect Fitbit to your Pulse account, so you need to sign in first.
                  </p>
                  <Link
                    href={loginHref}
                    className="mt-5 inline-flex items-center gap-2 bg-[#E0FE10] px-4 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90"
                  >
                    Sign in
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center gap-2 bg-[#E0FE10] px-4 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {connected ? 'Reconnect Fitbit' : 'Connect Fitbit'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={!connected || actionLoading !== null}
                    className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading === 'refresh' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    Sync now
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={!connected || actionLoading !== null}
                    className="inline-flex items-center gap-2 border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading === 'disconnect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            <div className="border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Connection detail</div>
                  <div className="mt-2 text-xl font-bold text-white">
                    {connected ? 'Fitbit is active' : 'Ready when you are'}
                  </div>
                </div>
                <div className={`h-3 w-3 ${connected ? 'bg-[#E0FE10]' : 'bg-zinc-600'}`} />
              </div>

              <div className="mt-6 grid gap-3">
                <DetailTile label="Scopes" value={grantedScopes} />
                <DetailTile label="Health user ID" value={connection?.healthUserId || 'Not available'} />
                <DetailTile label="Imported domains" value={connection?.lastImportedDomains?.join(', ') || 'Not available'} />
              </div>

              <div className="mt-6 border-t border-white/10 pt-2">
                <CapabilityRow
                  icon={<Smartphone className="h-4 w-4" />}
                  title="Post-sync source"
                  body="Fitbit does not stream directly into Pulse. The wearable syncs to Google Health first, then Pulse reads the authorized summaries."
                />
                <CapabilityRow
                  icon={<HeartPulse className="h-4 w-4" />}
                  title="Recovery and biometrics"
                  body="Sleep, resting heart rate, heart-rate variability, oxygen saturation, and respiratory rate can enrich the daily context snapshot."
                />
                <CapabilityRow
                  icon={<Activity className="h-4 w-4" />}
                  title="Activity and training"
                  body="Steps, active minutes, active zone minutes, distance, calories, and workout summaries can fill the activity lane."
                />
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
