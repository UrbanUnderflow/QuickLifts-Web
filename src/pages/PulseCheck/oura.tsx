import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { CheckCircle2, ExternalLink, Link2, Loader2, RefreshCcw, ShieldCheck, Unplug } from 'lucide-react';
import { ouraIntegrationService, type OuraConnectionStatus } from '../../api/firebase/mentaltraining/ouraIntegrationService';
import { useUser, useUserLoading } from '../../hooks/useUser';

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

export default function PulseCheckOuraPage() {
  const router = useRouter();
  const currentUser = useUser();
  const currentUserLoading = useUserLoading();
  const [connection, setConnection] = useState<OuraConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'connect' | 'disconnect' | 'refresh' | null>(null);
  const [message, setMessage] = useState<BannerMessage | null>(null);

  const callbackBanner = useMemo(() => {
    const status = typeof router.query.status === 'string' ? router.query.status : '';
    const error = typeof router.query.error === 'string' ? router.query.error : '';

    if (status === 'connected') {
      return { tone: 'success' as const, text: 'Oura is now connected to PulseCheck.' };
    }
    if (status === 'denied') {
      return { tone: 'info' as const, text: 'Oura access was not granted. You can try again whenever you are ready.' };
    }
    if (status === 'error') {
      return {
        tone: 'error' as const,
        text: error ? `Oura connection failed: ${error.replace(/_/g, ' ')}.` : 'Oura connection failed.',
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
        text: error instanceof Error ? error.message : 'Failed to load the Oura connection status.',
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
    if (currentUserLoading) return;
    if (!currentUser) {
      setLoading(false);
      return;
    }

    loadStatus().catch(() => undefined);
  }, [currentUser, currentUserLoading, loadStatus]);

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
        text: error instanceof Error ? error.message : 'Failed to start the Oura connection flow.',
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
        text: error instanceof Error ? error.message : 'Failed to disconnect Oura.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <Head>
        <title>PulseCheck Oura Connection</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10 md:px-6">
        <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-[32px] border border-cyan-500/15 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_42%),#09111e] p-8 shadow-2xl">
            <div className="space-y-5">
              <div className="inline-flex rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3">
                <Link2 className="h-6 w-6 text-cyan-200" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Wearable Integration</p>
                <h1 className="mt-2 text-3xl font-semibold">Connect Oura to PulseCheck</h1>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  This links your Oura account through the server-side OAuth flow so PulseCheck can use Oura as a direct health-context source.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-300">
                PulseCheck currently requests the minimum Oura scope needed to get the core recovery lane live: <span className="font-medium text-white">daily</span>.
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-300">
                Your registered callback is <span className="font-medium text-white">https://fitwithpulse.ai/.netlify/functions/oura-callback</span>.
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-zinc-800 bg-[#090f1c] p-8 shadow-2xl">
            {message ? (
              <div
                className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
                  message.tone === 'success'
                    ? 'border-green-500/20 bg-green-500/[0.06] text-green-200'
                    : message.tone === 'info'
                    ? 'border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-200'
                    : 'border-red-500/20 bg-red-500/[0.06] text-red-200'
                }`}
              >
                {message.text}
              </div>
            ) : null}

            {currentUserLoading || loading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
              </div>
            ) : !currentUser ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-5 text-sm leading-7 text-zinc-300">
                  Sign in to PulseCheck first, then come back here to connect Oura.
                </div>
                <Link
                  href="/PulseCheck/login"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#E0FE10] px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Open PulseCheck Login
                </Link>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-[28px] border border-zinc-800 bg-black/20 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Connection Status</div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {connection?.connected ? 'Connected' : 'Not connected'}
                      </div>
                      <p className="mt-2 text-sm leading-7 text-zinc-400">
                        {connection?.connected
                          ? 'PulseCheck has an active Oura token pair stored on the server.'
                          : 'No active Oura connection is linked to your PulseCheck account yet.'}
                      </p>
                    </div>
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.18em] ${
                        connection?.connected
                          ? 'border-green-500/25 bg-green-500/[0.08] text-green-200'
                          : 'border-zinc-700 bg-zinc-900/60 text-zinc-400'
                      }`}
                    >
                      {connection?.connected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      {connection?.status || 'not_connected'}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-zinc-800 bg-black/20 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Granted Scopes</div>
                    <div className="mt-3 text-sm text-white">
                      {(connection?.grantedScopes?.length ? connection.grantedScopes : connection?.requestedScopes)?.join(', ') || 'None yet'}
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-zinc-800 bg-black/20 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Connected At</div>
                    <div className="mt-3 text-sm text-white">{formatTimestamp(connection?.connectedAt)}</div>
                  </div>
                  <div className="rounded-[24px] border border-zinc-800 bg-black/20 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Access Token Expires</div>
                    <div className="mt-3 text-sm text-white">{formatTimestamp(connection?.accessTokenExpiresAt)}</div>
                  </div>
                  <div className="rounded-[24px] border border-zinc-800 bg-black/20 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Last Error</div>
                    <div className="mt-3 text-sm text-white">{connection?.lastError || 'None'}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#E0FE10] px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    {connection?.connected ? 'Reconnect Oura' : 'Connect Oura'}
                  </button>

                  <button
                    type="button"
                    onClick={() => loadStatus('refresh')}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading === 'refresh' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    Refresh Status
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={actionLoading !== null || !connection?.connected}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-500/30 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading === 'disconnect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                    Disconnect
                  </button>
                </div>

                <div className="rounded-[24px] border border-zinc-800 bg-black/20 p-5 text-sm leading-7 text-zinc-400">
                  After you connect Oura, the next layer is building the sync job that exchanges refresh tokens for new access tokens and writes Oura data into the health-context source-record pipeline.
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
