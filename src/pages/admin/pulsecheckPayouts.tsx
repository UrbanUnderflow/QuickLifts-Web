import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import {
  auth,
  getFirebaseModeRequestHeaders,
} from '../../api/firebase/config';

type PayoutRequest = {
  id: string;
  coachUserId: string;
  coachName: string;
  coachEmail: string | null;
  amountCents: number;
  currency: string;
  status: 'requested' | 'paid';
  paymentMethod: 'zelle' | 'apple_pay' | 'cash_app';
  paymentMethodLabel: string;
  paymentDestination: string | null;
  requestedAt: string | null;
  paidAt: string | null;
  paidByEmail: string | null;
  paymentReference: string | null;
  emailSent: boolean;
  transactionCount: number;
};

const functionUrl = () => {
  const configuredBaseUrl = (
    process.env.NEXT_PUBLIC_FUNCTION_BASE_URL
    || process.env.NEXT_PUBLIC_REMOTE_LOGIN_FUNCTION_BASE_URL
    || ''
  )
    .trim()
    .replace(/\/+$/, '');
  return `${configuredBaseUrl}/.netlify/functions/pulsecheck-admin-payouts`;
};

const money = (cents: number) => `$${(Math.max(0, cents) / 100).toFixed(2)}`;

const formatDate = (value: string | null) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const paymentAction = (request: PayoutRequest) => {
  const destination = (request.paymentDestination || '').trim();
  if (request.paymentMethod === 'cash_app') {
    const cashtag = destination.replace(/^https?:\/\/cash\.app\//i, '').replace(/^\$/, '');
    return cashtag
      ? { label: 'Open Cash App', href: `https://cash.app/$${encodeURIComponent(cashtag)}` }
      : null;
  }
  if (request.paymentMethod === 'apple_pay' && destination) {
    return {
      label: 'Open Messages',
      href: `sms:${encodeURIComponent(destination)}`,
    };
  }
  return null;
};

const PulseCheckPayoutsPage: React.FC = () => {
  const router = useRouter();
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [copied, setCopied] = useState(false);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedId) || requests[0] || null,
    [requests, selectedId],
  );
  const requestedCount = requests.filter((request) => request.status === 'requested').length;
  const requestedTotalCents = requests
    .filter((request) => request.status === 'requested')
    .reduce((sum, request) => sum + request.amountCents, 0);

  const loadRequests = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    setLoading(true);
    setError('');
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(functionUrl(), {
        headers: {
          Authorization: `Bearer ${token}`,
          ...getFirebaseModeRequestHeaders(),
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Payout requests could not be loaded.');
      }
      const nextRequests: PayoutRequest[] = Array.isArray(payload.requests) ? payload.requests : [];
      setRequests(nextRequests);
      const requestedId = typeof router.query.request === 'string' ? router.query.request : '';
      setSelectedId((current) => {
        if (requestedId && nextRequests.some((request) => request.id === requestedId)) return requestedId;
        if (current && nextRequests.some((request) => request.id === current)) return current;
        return nextRequests[0]?.id || '';
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Payout requests could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [router.query.request]);

  useEffect(() => onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) void loadRequests();
  }), [loadRequests]);

  useEffect(() => {
    setPaymentReference(selectedRequest?.paymentReference || '');
    setCopied(false);
    setSuccess('');
  }, [selectedRequest?.id, selectedRequest?.paymentReference]);

  const copyDestination = async () => {
    if (!selectedRequest?.paymentDestination) return;
    await navigator.clipboard.writeText(selectedRequest.paymentDestination);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const markComplete = async () => {
    if (!selectedRequest || selectedRequest.status !== 'requested' || completing) return;
    const confirmed = window.confirm(
      `Confirm that ${money(selectedRequest.amountCents)} was sent to ${selectedRequest.coachName}.`
    );
    if (!confirmed) return;

    setCompleting(true);
    setError('');
    setSuccess('');
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('Sign in again to complete this payout.');
      const token = await firebaseUser.getIdToken();
      const response = await fetch(functionUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...getFirebaseModeRequestHeaders(),
        },
        body: JSON.stringify({
          action: 'complete',
          requestId: selectedRequest.id,
          paymentReference: paymentReference.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'The payout could not be marked complete.');
      }
      setRequests((current) => current.map((request) =>
        request.id === selectedRequest.id ? payload.request : request
      ));
      setSuccess(`${money(selectedRequest.amountCents)} is now recorded as paid.`);
    } catch (completeError) {
      setError(completeError instanceof Error
        ? completeError.message
        : 'The payout could not be marked complete.');
    } finally {
      setCompleting(false);
    }
  };

  const directAction = selectedRequest ? paymentAction(selectedRequest) : null;

  return (
    <AdminRouteGuard>
      <Head>
        <title>PulseCheck Payouts | Pulse Admin</title>
      </Head>
      <main className="min-h-screen bg-[#101214] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-7xl">
          <a
            href="/admin"
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </a>

          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d7ff00]/12">
                  <Wallet className="h-5 w-5 text-[#d7ff00]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">PulseCheck payouts</h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    Review manual coach requests and record completed transfers.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadRequests()}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Requests waiting</div>
              <div className="mt-2 text-2xl font-bold">{requestedCount}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Amount waiting</div>
              <div className="mt-2 text-2xl font-bold text-[#d7ff00]">
                {money(requestedTotalCents)}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Paid requests</div>
              <div className="mt-2 text-2xl font-bold">
                {requests.filter((request) => request.status === 'paid').length}
              </div>
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          {loading && requests.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-12 text-center text-zinc-400">
              Loading payout requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-12 text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400" />
              <div className="mt-3 text-lg font-semibold">No payout requests yet</div>
              <p className="mt-1 text-sm text-zinc-500">
                Coach requests will appear here after they submit an available balance.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
              <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
                <div className="border-b border-zinc-800 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Payout requests
                </div>
                <div className="max-h-[680px] divide-y divide-zinc-800 overflow-y-auto">
                  {requests.map((request) => (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(request.id);
                        void router.replace(
                          { pathname: router.pathname, query: { request: request.id } },
                          undefined,
                          { shallow: true },
                        );
                      }}
                      className={`w-full px-4 py-4 text-left transition ${
                        selectedRequest?.id === request.id
                          ? 'bg-[#d7ff00]/8'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-semibold text-white">{request.coachName}</div>
                        <div className="text-sm font-bold text-[#d7ff00]">{money(request.amountCents)}</div>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                        <span className="truncate text-zinc-500">{request.paymentMethodLabel}</span>
                        <span className={request.status === 'paid' ? 'text-emerald-300' : 'text-amber-200'}>
                          {request.status === 'paid' ? 'Paid' : 'Requested'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedRequest ? (
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {selectedRequest.status === 'paid' ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <Clock3 className="h-5 w-5 text-amber-300" />
                        )}
                        <span className={`text-xs font-semibold uppercase tracking-wide ${
                          selectedRequest.status === 'paid' ? 'text-emerald-300' : 'text-amber-200'
                        }`}>
                          {selectedRequest.status === 'paid' ? 'Paid' : 'Payout requested'}
                        </span>
                      </div>
                      <h2 className="mt-3 text-3xl font-bold text-white">
                        {money(selectedRequest.amountCents)}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        {selectedRequest.coachName}
                        {selectedRequest.coachEmail ? ` · ${selectedRequest.coachEmail}` : ''}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-right text-xs text-zinc-500">
                      <div>{selectedRequest.transactionCount} earning records</div>
                      <div className="mt-1">{formatDate(selectedRequest.requestedAt)}</div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Send with {selectedRequest.paymentMethodLabel}
                    </div>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="break-all text-lg font-semibold text-white">
                        {selectedRequest.paymentDestination || 'Payment destination unavailable'}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void copyDestination()}
                          disabled={!selectedRequest.paymentDestination}
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm font-semibold text-zinc-200 transition hover:text-white disabled:opacity-40"
                        >
                          <Copy className="h-4 w-4" />
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                        {directAction ? (
                          <a
                            href={directAction.href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#d7ff00] px-3 text-sm font-bold text-black transition hover:bg-[#ccef0e]"
                          >
                            <ExternalLink className="h-4 w-4" />
                            {directAction.label}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {selectedRequest.status === 'requested' ? (
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-zinc-300">
                        Payment note or confirmation number
                        <input
                          value={paymentReference}
                          onChange={(event) => setPaymentReference(event.target.value)}
                          placeholder="Optional"
                          className="mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none transition focus:border-[#d7ff00]/60"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void markComplete()}
                        disabled={completing}
                        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-50 sm:w-auto"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {completing
                          ? 'Saving...'
                          : `Mark ${money(selectedRequest.amountCents)} as paid`}
                      </button>
                      <p className="mt-2 text-xs text-zinc-500">
                        Use this after the transfer has been sent. The amount will move from requested funds to paid funds on the coach dashboard.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-4">
                      <div className="flex items-center gap-2 font-semibold text-emerald-200">
                        <CheckCircle2 className="h-4 w-4" />
                        Payment completed
                      </div>
                      <div className="mt-2 text-sm text-zinc-400">
                        Paid {formatDate(selectedRequest.paidAt)}
                        {selectedRequest.paidByEmail ? ` by ${selectedRequest.paidByEmail}` : ''}
                      </div>
                      {selectedRequest.paymentReference ? (
                        <div className="mt-1 text-sm text-zinc-400">
                          Reference: {selectedRequest.paymentReference}
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </AdminRouteGuard>
  );
};

export default PulseCheckPayoutsPage;
