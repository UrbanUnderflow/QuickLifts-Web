import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import SignInModal from '../components/SignInModal';
import { auth, getFirebaseModeRequestHeaders } from '../api/firebase/config';
import { useUser, useUserLoading } from '../hooks/useUser';

type StripeSubscription = {
  id: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  currentPeriodEndIso: string | null;
  customerId: string;
  priceId: string;
  productName: string;
  amountCents: number;
  currency: string;
  interval: string;
  sourceLabel: string;
};

type ListSubscriptionsResponse = {
  stripeMode?: 'test' | 'live';
  subscriptions?: StripeSubscription[];
  message?: string;
};

type CancelSubscriptionResponse = {
  message?: string;
  subscription?: StripeSubscription;
};

const cancelableStatuses = new Set(['active', 'trialing', 'past_due', 'unpaid']);

const moneyFormatter = (amountCents: number, currency: string) => {
  const safeCurrency = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency,
    }).format((Number(amountCents) || 0) / 100);
  } catch (_error) {
    return `$${((Number(amountCents) || 0) / 100).toFixed(2)}`;
  }
};

const dateFormatter = (iso: string | null) => {
  if (!iso) return 'Not available';
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return 'Not available';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const prettyStatus = (status: string) => (
  (status || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
);

const statusClasses = (status: string) => {
  switch ((status || '').toLowerCase()) {
    case 'active':
    case 'trialing':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
    case 'past_due':
    case 'unpaid':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
    case 'canceled':
    case 'incomplete_expired':
      return 'border-red-400/30 bg-red-400/10 text-red-200';
    default:
      return 'border-zinc-700 bg-zinc-900 text-zinc-300';
  }
};

const parseJson = async <T,>(response: Response): Promise<T> => {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload?.message || 'Something went wrong.');
  }
  return payload as T;
};

const SubscriptionPage: NextPage = () => {
  const currentUser = useUser();
  const userLoading = useUserLoading();
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState<StripeSubscription[]>([]);
  const [stripeMode, setStripeMode] = useState<'test' | 'live' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayName = useMemo(() => (
    currentUser?.username || currentUser?.email || 'your account'
  ), [currentUser?.email, currentUser?.username]);

  const getAuthenticatedHeaders = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      throw new Error('Please sign in again so we can verify your billing access.');
    }

    const idToken = await firebaseUser.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...getFirebaseModeRequestHeaders(),
    };
  }, []);

  const loadSubscriptions = useCallback(async () => {
    if (!currentUser || userLoading) return;

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const headers = await getAuthenticatedHeaders();
      const response = await fetch('/.netlify/functions/user-stripe-subscriptions', {
        method: 'GET',
        headers,
      });
      const data = await parseJson<ListSubscriptionsResponse>(response);
      setSubscriptions(Array.isArray(data.subscriptions) ? data.subscriptions : []);
      setStripeMode(data.stripeMode || null);
    } catch (err) {
      setSubscriptions([]);
      setError(err instanceof Error ? err.message : 'Unable to load subscriptions.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, getAuthenticatedHeaders, userLoading]);

  useEffect(() => {
    if (currentUser && !userLoading) {
      loadSubscriptions();
    } else if (!currentUser && !userLoading) {
      setSubscriptions([]);
      setError(null);
      setMessage(null);
    }
  }, [currentUser, loadSubscriptions, userLoading]);

  const cancelSubscription = async (subscription: StripeSubscription) => {
    if (!subscription?.id || cancelingId) return;

    const confirmed = window.confirm(
      `Cancel renewal for ${subscription.productName || 'this subscription'}? You will keep access until ${dateFormatter(subscription.currentPeriodEndIso)}.`
    );
    if (!confirmed) return;

    setCancelingId(subscription.id);
    setError(null);
    setMessage(null);

    try {
      const headers = await getAuthenticatedHeaders();
      const response = await fetch('/.netlify/functions/cancel-user-stripe-subscription', {
        method: 'POST',
        headers,
        body: JSON.stringify({ subscriptionId: subscription.id }),
      });
      const data = await parseJson<CancelSubscriptionResponse>(response);
      if (data.subscription) {
        setSubscriptions((existing) => existing.map((item) => (
          item.id === data.subscription?.id ? data.subscription : item
        )));
      }
      setMessage(data.message || 'Your subscription renewal has been canceled.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel this subscription.');
    } finally {
      setCancelingId(null);
    }
  };

  const signedOutView = (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 sm:p-8 shadow-2xl shadow-black/40">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E0FE10]/10 text-[#E0FE10]">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-bold text-white">Sign in to manage your subscription</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        We’ll verify your Pulse account first, then show the Stripe subscriptions connected to that account.
      </p>
      <button
        type="button"
        onClick={() => setIsSignInModalOpen(true)}
        className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-[#E0FE10] px-5 py-4 text-sm font-bold text-black transition hover:bg-[#d4f00f] sm:w-auto"
      >
        Sign in to manage subscription
      </button>
    </div>
  );

  const emptyView = (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6 sm:p-8">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-300">
        <CreditCard className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-bold text-white">No Stripe subscription found</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        We could not find a Stripe subscription attached to this signed-in account. If you subscribed with a different email, sign out and sign back in with that account.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={loadSubscriptions}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
        >
          <RefreshCw className="h-4 w-4" />
          Check again
        </button>
        <a
          href="mailto:info@fitwithpulse.ai?subject=Pulse%20subscription%20help"
          className="inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
        >
          Contact support
        </a>
      </div>
    </div>
  );

  return (
    <>
      <Head>
        <title>Manage Subscription — Pulse</title>
        <meta
          name="description"
          content="Sign in to view and cancel the Stripe subscription connected to your Pulse account."
        />
      </Head>

      <SignInModal
        isVisible={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSignInSuccess={() => {
          setIsSignInModalOpen(false);
          setTimeout(() => loadSubscriptions(), 0);
        }}
        onSignUpSuccess={() => {
          setIsSignInModalOpen(false);
          setTimeout(() => loadSubscriptions(), 0);
        }}
      />

      <main className="min-h-screen bg-[#070708] text-white">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute left-[-10rem] top-[-10rem] h-80 w-80 rounded-full bg-[#E0FE10]/10 blur-3xl" />
          <div className="absolute right-[-12rem] top-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 py-8 sm:px-8">
          <header className="mb-12 flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <img src="/pulse-logo-green.svg" alt="Pulse" className="h-9 w-auto" />
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-zinc-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400 transition hover:border-zinc-600 hover:text-white"
            >
              Pricing
            </Link>
          </header>

          <section className="mb-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-[#E0FE10]">
              <CreditCard className="h-3.5 w-3.5" />
              Subscription
            </div>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">
              Manage your Pulse subscription.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
              Sign in to view the Stripe subscription connected to your account. Canceling here stops renewal at the end of your current billing period.
            </p>
          </section>

          {!currentUser && !userLoading ? signedOutView : null}

          {currentUser ? (
            <section className="space-y-5">
              <div className="flex flex-col gap-3 rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Signed in</p>
                  <p className="mt-1 font-semibold text-white">{displayName}</p>
                  {stripeMode === 'test' ? (
                    <p className="mt-1 text-xs text-amber-300">Stripe test mode</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={loadSubscriptions}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </button>
              </div>

              {message ? (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-300" />
                  <span>{message}</span>
                </div>
              ) : null}

              {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-red-300" />
                  <span>{error}</span>
                </div>
              ) : null}

              {isLoading ? (
                <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-8 text-center text-zinc-400">
                  <Loader2 className="mx-auto mb-4 h-6 w-6 animate-spin text-[#E0FE10]" />
                  Loading your Stripe subscriptions…
                </div>
              ) : subscriptions.length === 0 ? (
                emptyView
              ) : (
                <div className="space-y-4">
                  {subscriptions.map((subscription) => {
                    const canCancel = (
                      cancelableStatuses.has((subscription.status || '').toLowerCase())
                      && !subscription.cancelAtPeriodEnd
                    );
                    const renewalCopy = subscription.cancelAtPeriodEnd
                      ? `Cancels on ${dateFormatter(subscription.currentPeriodEndIso)}`
                      : `Renews on ${dateFormatter(subscription.currentPeriodEndIso)}`;
                    const amount = moneyFormatter(subscription.amountCents, subscription.currency);

                    return (
                      <article
                        key={subscription.id}
                        className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-xl shadow-black/30 sm:p-6"
                      >
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(subscription.status)}`}>
                                {prettyStatus(subscription.status)}
                              </span>
                              {subscription.cancelAtPeriodEnd ? (
                                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">
                                  Cancellation scheduled
                                </span>
                              ) : null}
                            </div>
                            <h2 className="text-2xl font-bold text-white">
                              {subscription.productName || 'Pulse subscription'}
                            </h2>
                            <p className="mt-2 text-sm text-zinc-400">
                              {subscription.sourceLabel || 'Stripe subscription'}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-zinc-800 bg-black/30 px-4 py-3 text-left sm:text-right">
                            <p className="text-2xl font-black text-white">
                              {amount}
                              {subscription.interval ? (
                                <span className="ml-1 text-sm font-semibold text-zinc-500">/{subscription.interval}</span>
                              ) : null}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">{renewalCopy}</p>
                          </div>
                        </div>

                        <div className="mt-6 grid gap-3 border-t border-zinc-800 pt-5 text-sm text-zinc-400 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Subscription ID</p>
                            <p className="mt-1 break-all font-mono text-xs text-zinc-300">{subscription.id}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Billing status</p>
                            <p className="mt-1 text-zinc-300">{renewalCopy}</p>
                          </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="flex items-start gap-2 text-sm text-zinc-500">
                            {subscription.cancelAtPeriodEnd ? (
                              <XCircle className="mt-0.5 h-4 w-4 flex-none text-amber-300" />
                            ) : (
                              <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-emerald-300" />
                            )}
                            <span>
                              {subscription.cancelAtPeriodEnd
                                ? 'Your renewal is already canceled. Access remains active until the billing period ends.'
                                : 'Canceling stops the next renewal. Your current access remains active until the billing period ends.'}
                            </span>
                          </p>
                          <button
                            type="button"
                            disabled={!canCancel || cancelingId === subscription.id}
                            onClick={() => cancelSubscription(subscription)}
                            className="inline-flex items-center justify-center rounded-2xl bg-red-500/15 px-5 py-3 text-sm font-bold text-red-100 ring-1 ring-red-400/30 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-500 disabled:ring-zinc-800"
                          >
                            {cancelingId === subscription.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Canceling…
                              </>
                            ) : subscription.cancelAtPeriodEnd ? (
                              'Cancellation scheduled'
                            ) : canCancel ? (
                              'Cancel renewal'
                            ) : (
                              'Cannot cancel here'
                            )}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
};

export default SubscriptionPage;
