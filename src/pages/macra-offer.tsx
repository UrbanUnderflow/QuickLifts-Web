import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  GoogleAuthProvider,
  OAuthProvider,
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { AlertCircle, ArrowRight, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { auth } from '../api/firebase/config';

type OfferParams = {
  userId: string;
  campaignId: string;
  plan: string;
  expiresAt: string;
  signature: string;
  test: string;
};

const normalizeQueryValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
};

const MacraOfferPage: React.FC = () => {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState('');
  const redirectStartedRef = useRef(false);

  const offerParams = useMemo<OfferParams | null>(() => {
    if (!router.isReady) return null;

    const userId = normalizeQueryValue(router.query.uid || router.query.userId);
    const campaignId = normalizeQueryValue(router.query.campaign || router.query.campaignId);
    const plan = normalizeQueryValue(router.query.plan) || 'monthly';
    const expiresAt = normalizeQueryValue(router.query.expires || router.query.expiresAt);
    const signature = normalizeQueryValue(router.query.sig || router.query.signature);
    const test = normalizeQueryValue(router.query.test);

    if (!userId || !campaignId || !expiresAt || !signature) {
      return null;
    }

    return { userId, campaignId, plan, expiresAt, signature, test };
  }, [router.isReady, router.query]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!router.isReady || !authReady || !offerParams || !currentUser || redirectStartedRef.current) {
      return;
    }

    if (currentUser.uid !== offerParams.userId) {
      setError('This offer belongs to a different account. Sign in with the account that received the email.');
      return;
    }

    const startCheckout = async () => {
      redirectStartedRef.current = true;
      setIsRedirecting(true);
      setError('');

      try {
        const firebaseIdToken = await currentUser.getIdToken(true);
        const target = new URL('/.netlify/functions/create-macra-web-offer-checkout', window.location.origin);
        target.searchParams.set('uid', offerParams.userId);
        target.searchParams.set('campaign', offerParams.campaignId);
        target.searchParams.set('plan', offerParams.plan);
        target.searchParams.set('expires', offerParams.expiresAt);
        target.searchParams.set('sig', offerParams.signature);
        target.searchParams.set('requireAuth', '1');
        target.searchParams.set('firebaseIdToken', firebaseIdToken);
        if (offerParams.test) {
          target.searchParams.set('test', offerParams.test);
        }

        window.location.replace(target.toString());
      } catch (err) {
        redirectStartedRef.current = false;
        setIsRedirecting(false);
        setError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.');
      }
    };

    startCheckout();
  }, [authReady, currentUser, offerParams, router.isReady]);

  const handleEmailSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }

    setIsSigningIn(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleProviderSignIn = async (providerName: 'google' | 'apple') => {
    setIsSigningIn(true);
    setError('');
    try {
      const provider = providerName === 'apple' ? new OAuthProvider('apple.com') : new GoogleAuthProvider();
      if (providerName === 'apple') {
        provider.addScope('email');
        provider.addScope('name');
      }
      const shouldUseRedirect =
        typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent || '');
      if (shouldUseRedirect) {
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSwitchAccount = async () => {
    setError('');
    redirectStartedRef.current = false;
    await signOut(auth);
  };

  const missingParams = router.isReady && !offerParams;
  const signedInWrongAccount = !!currentUser && !!offerParams && currentUser.uid !== offerParams.userId;
  const waiting = !router.isReady || !authReady;

  return (
    <>
      <Head>
        <title>Start Macra Offer | Macra</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="min-h-screen bg-[#080b08] text-white flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/macra-icon.png" alt="Macra" className="w-12 h-12 rounded-2xl" />
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[#b8ff5c] font-black">Macra offer</p>
              <h1 className="text-2xl font-black">Start your free month</h1>
            </div>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            {waiting || isRedirecting ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-[#e0fe10] mx-auto mb-4" />
                <h2 className="text-xl font-black mb-2">
                  {isRedirecting ? 'Opening secure checkout' : 'Checking your offer'}
                </h2>
                <p className="text-zinc-400 text-sm">
                  {isRedirecting ? 'You are being sent directly to Stripe.' : 'One quick check before we continue.'}
                </p>
              </div>
            ) : missingParams ? (
              <div className="text-center py-8">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-black mb-2">This offer link is incomplete.</h2>
                <p className="text-zinc-400 text-sm">Open the latest Macra offer email and tap the button again.</p>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 rounded-xl bg-black/25 border border-white/10 p-4 mb-5">
                  <LockKeyhole className="w-5 h-5 text-[#e0fe10] mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-zinc-300 leading-6">
                    Sign in with the same account that received this email. Then we will take you straight to Stripe for
                    your one-month Macra trial.
                  </p>
                </div>

                {error ? (
                  <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}

                {signedInWrongAccount ? (
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    className="w-full rounded-xl bg-[#e0fe10] text-black font-black py-3 px-4 hover:bg-[#cbed0e] transition-colors"
                  >
                    Sign in with another account
                  </button>
                ) : currentUser ? (
                  <div className="text-center py-6">
                    <Loader2 className="w-7 h-7 animate-spin text-[#e0fe10] mx-auto mb-3" />
                    <p className="text-zinc-300 text-sm">Preparing your checkout session...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <form onSubmit={handleEmailSignIn} className="space-y-3">
                      <div>
                        <label className="block text-xs uppercase tracking-[0.18em] text-zinc-500 font-bold mb-2">
                          Email
                        </label>
                        <input
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          type="email"
                          autoComplete="email"
                          className="w-full rounded-xl bg-black/35 border border-white/10 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#e0fe10]"
                          placeholder="you@example.com"
                          disabled={isSigningIn}
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-[0.18em] text-zinc-500 font-bold mb-2">
                          Password
                        </label>
                        <input
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          type="password"
                          autoComplete="current-password"
                          className="w-full rounded-xl bg-black/35 border border-white/10 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#e0fe10]"
                          placeholder="Password"
                          disabled={isSigningIn}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSigningIn}
                        className="w-full rounded-xl bg-[#e0fe10] text-black font-black py-3 px-4 hover:bg-[#cbed0e] transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                        {isSigningIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        Continue to checkout
                      </button>
                    </form>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleProviderSignIn('apple')}
                        disabled={isSigningIn}
                        className="rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 font-bold hover:bg-white/[0.12] transition-colors disabled:opacity-70"
                      >
                        Apple
                      </button>
                      <button
                        type="button"
                        onClick={() => handleProviderSignIn('google')}
                        disabled={isSigningIn}
                        className="rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 font-bold hover:bg-white/[0.12] transition-colors disabled:opacity-70"
                      >
                        Google
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <a
            href="/Macra"
            className="mt-5 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-[#e0fe10] transition-colors"
          >
            Back to Macra
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </main>
    </>
  );
};

export default MacraOfferPage;
