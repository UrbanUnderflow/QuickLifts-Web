import type { NextPage } from 'next';
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { signInWithPopup, OAuthProvider, UserCredential } from 'firebase/auth';
import { Loader2, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { auth } from '../../api/firebase/config';
import authService from '../../api/firebase/auth';
import { userService, User, SubscriptionType } from '../../api/firebase/user';
import { useUser } from '../../hooks/useUser';

// Coach sign-in for the PulseCheck coach dashboard. Mirrors the other auth
// surfaces (PulseCheck/login, SignInModal): email + password, Google, Apple.
// On success (or if already signed in) we send the coach to `?redirect=` when
// it's a safe in-app path, else /coach/dashboard.
const PC_PURPLE = '#8B5CF6';
const PC_PURPLE_SOFT = '#A78BFA';
const PC_PURPLE_DEEP = '#7C3AED';
const DEFAULT_DEST = '/coach/dashboard';
const MAGIC_LINK_EMAIL_STORAGE_KEY = 'coach_magic_link_email';

type Provider = 'email' | 'google' | 'apple' | null;

// Only honor same-origin app paths ("/coach/dashboard"), never "//evil.com"
// or absolute URLs — guards against open-redirect via the query param.
const safeRedirect = (value: unknown): string => {
  if (typeof value !== 'string') return DEFAULT_DEST;
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_DEST;
  return value;
};

const CoachLogin: NextPage = () => {
  const router = useRouter();
  const currentUser = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailAuthMode, setEmailAuthMode] = useState<'magic' | 'password'>('magic');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<Provider>(null);
  const [error, setError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const isBusy = pending !== null;
  const dest = safeRedirect(router.query.redirect);

  const goToApp = useCallback(() => {
    router.replace(dest);
  }, [router, dest]);

  // Already signed in → straight to the dashboard (or the requested path).
  useEffect(() => {
    if (currentUser) goToApp();
  }, [currentUser, goToApp]);

  const ensureFirestoreUser = async (firebaseUser: any) => {
    let firestoreUser = await userService.fetchUserFromFirestore(firebaseUser.uid);
    if (!firestoreUser) {
      if (!firebaseUser.email) {
        throw new Error('Authentication did not provide an email address.');
      }
      firestoreUser = new User(firebaseUser.uid, {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || '',
        registrationComplete: false,
        subscriptionType: SubscriptionType.unsubscribed,
      });
      await userService.createUser(firebaseUser.uid, firestoreUser);
    }
    userService.nonUICurrentUser = firestoreUser;
    return firestoreUser;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!authService.isMagicLink(window.location.href)) return;

    let isMounted = true;

    const completeMagicLink = async () => {
      const storedEmail = window.localStorage.getItem(MAGIC_LINK_EMAIL_STORAGE_KEY);
      if (!storedEmail) {
        setError('Enter your email and request a fresh magic link on this device.');
        return;
      }

      try {
        setPending('email');
        setError(null);
        const result = await authService.completeMagicLink(storedEmail, window.location.href);
        if (!isMounted) return;
        window.localStorage.removeItem(MAGIC_LINK_EMAIL_STORAGE_KEY);
        await ensureFirestoreUser(result.user);
        goToApp();
      } catch (err) {
        if (!isMounted) return;
        console.error('[Coach Login] Magic link completion failed:', err);
        setError(err instanceof Error ? err.message : 'Magic link sign-in failed. Please request a new link.');
      } finally {
        if (isMounted) setPending(null);
      }
    };

    completeMagicLink();

    return () => {
      isMounted = false;
    };
  }, [goToApp]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (emailAuthMode === 'password' && !password) {
      setError('Please enter your password.');
      return;
    }
    try {
      setPending('email');
      setError(null);
      const normalizedEmail = email.trim().toLowerCase();
      if (emailAuthMode === 'password') {
        const result = await authService.signInWithEmail(normalizedEmail, password);
        await ensureFirestoreUser(result.user);
        goToApp();
      } else {
        await authService.sendMagicLink(normalizedEmail, window.location.href);
        window.localStorage.setItem(MAGIC_LINK_EMAIL_STORAGE_KEY, normalizedEmail);
        setMagicLinkSent(true);
      }
    } catch (err: any) {
      console.error('[Coach Login] Email auth error:', err);
      switch (err?.code) {
        case 'auth/user-not-found':
          setError('No account found with this email address.');
          break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Invalid email or password. Please try again.');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address.');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Please wait a moment and try again.');
          break;
        default:
          setError(err?.message || 'Sign in failed. Please try again.');
      }
    } finally {
      setPending(null);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Enter your email address and we’ll send a reset link.');
      return;
    }
    try {
      setPending('email');
      setError(null);
      await authService.resetPassword(email);
      setResetSent(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to send reset email.');
    } finally {
      setPending(null);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setPending('google');
      setError(null);
      const result = await authService.signInWithGoogle();
      const user = result.user;
      if (!user || !user.email) {
        setError('Sign-in failed: an email address is required.');
        setPending(null);
        return;
      }
      await ensureFirestoreUser(user);
      goToApp();
    } catch (err: any) {
      console.error('[Coach Login] Google auth error:', err);
      switch (err?.code) {
        case 'auth/popup-blocked':
          setError('Please enable popups for this site and try again.');
          break;
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
          setError(null);
          break;
        case 'auth/unauthorized-domain':
          setError('This domain isn’t authorized for sign-in yet. Contact support.');
          break;
        default:
          setError(err?.message || 'Sign in failed. Please try again.');
      }
      setPending(null);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setPending('apple');
      setError(null);
      const appleProvider = new OAuthProvider('apple.com');
      appleProvider.addScope('email');
      appleProvider.addScope('name');
      const result: UserCredential = await signInWithPopup(auth, appleProvider);
      const user = result.user;
      if (!user || !user.email) {
        setError('Apple sign-in did not return an email address.');
        setPending(null);
        return;
      }
      await ensureFirestoreUser(user);
      goToApp();
    } catch (err: any) {
      console.error('[Coach Login] Apple auth error:', err);
      switch (err?.code) {
        case 'auth/popup-blocked':
          setError('Please enable popups for this site and try again.');
          break;
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
          setError(null);
          break;
        case 'auth/account-exists-with-different-credential':
          setError('An account already exists with this email using a different sign-in method.');
          break;
        case 'auth/operation-not-allowed':
          setError('Apple sign-in isn’t available here. Try Google or email instead.');
          break;
        case 'auth/unauthorized-domain':
          setError('This domain isn’t authorized for sign-in yet. Contact support.');
          break;
        default:
          setError(err?.message || 'Sign in failed. Please try again.');
      }
      setPending(null);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#A78BFA]/50';

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4"
      style={{ background: 'linear-gradient(180deg, #0c0b14 0%, #07060c 100%)', fontFamily: 'Switzer, sans-serif' }}
    >
      <Head>
        <title>Coach sign in | PulseCheck</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${PC_PURPLE}33 0%, transparent 70%)` }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pulseCheckIcon.png" alt="PulseCheck" className="mb-4 h-12 w-12 rounded-2xl" />
          <h1 className="text-2xl font-bold text-white">Welcome back, Coach</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {forgotMode ? 'Reset your password.' : 'Sign in to your PulseCheck coach dashboard.'}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resetSent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-8 w-8" style={{ color: PC_PURPLE_SOFT }} />
              <p className="text-sm text-zinc-300">
                If an account exists for <span className="font-medium text-white">{email}</span>, a reset link is on its way.
              </p>
              <button
                type="button"
                onClick={() => {
                  setResetSent(false);
                  setForgotMode(false);
                }}
                className="mt-1 text-sm font-medium"
                style={{ color: PC_PURPLE_SOFT }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={forgotMode ? handleForgotPassword : handleEmailSignIn} className="space-y-3">
                {!forgotMode && (
                  <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-white/[0.04] p-1">
                    {[
                      { mode: 'magic' as const, label: 'Magic link' },
                      { mode: 'password' as const, label: 'Password' },
                    ].map((item) => (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => {
                          setEmailAuthMode(item.mode);
                          setError(null);
                          setMagicLinkSent(false);
                        }}
                        className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                          emailAuthMode === item.mode
                            ? 'text-white'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                        style={emailAuthMode === item.mode ? { background: PC_PURPLE } : undefined}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setMagicLinkSent(false);
                  }}
                  placeholder="Email"
                  autoComplete="email"
                  className={inputCls}
                />
                {!forgotMode && emailAuthMode === 'password' && (
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete="current-password"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                )}

                {!forgotMode && emailAuthMode === 'magic' && (
                  magicLinkSent ? (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-2.5 text-sm leading-6 text-emerald-100">
                      Magic link sent. Open it from this device to enter the coach dashboard.
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-zinc-500">
                      No password needed. We&apos;ll send a secure email link tied to your PulseCheck invite.
                    </p>
                  )
                )}

                {!forgotMode && emailAuthMode === 'password' && (
                  <p className="text-sm leading-6 text-zinc-500">
                    Use this only if your account already has a password.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${PC_PURPLE} 0%, ${PC_PURPLE_DEEP} 100%)` }}
                >
                  {pending === 'email' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {forgotMode ? 'Send reset link' : emailAuthMode === 'password' ? 'Sign in with password' : 'Send magic link'}
                </button>
              </form>

              {(forgotMode || emailAuthMode === 'password') && (
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode((m) => !m);
                      setError(null);
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    {forgotMode ? 'Back to sign in' : 'Forgot password?'}
                  </button>
                </div>
              )}

              {!forgotMode && (
                <>
                  <div className="my-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-white/10" />
                    <span className="text-[11px] uppercase tracking-wider text-zinc-600">or</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isBusy}
                      className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      {pending === 'google' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
                          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
                          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
                          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.3-.4-3.5z" />
                        </svg>
                      )}
                      Continue with Google
                    </button>

                    <button
                      type="button"
                      onClick={handleAppleSignIn}
                      disabled={isBusy}
                      className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      {pending === 'apple' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M17.05 12.04c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.95 1.16 9.22.77 1.11 1.69 2.36 2.89 2.31 1.16-.05 1.6-.75 3-.75 1.39 0 1.79.75 3.01.72 1.24-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.42-.93-2.44-3.69zM14.77 5.1c.64-.78 1.07-1.86.95-2.94-.92.04-2.04.61-2.7 1.39-.59.69-1.11 1.79-.97 2.85 1.03.08 2.08-.52 2.72-1.3z" />
                        </svg>
                      )}
                      Continue with Apple
                    </button>
                  </div>

                  <p className="mt-4 text-center text-[11px] leading-5 text-zinc-500">
                    Use the account tied to your PulseCheck invite.
                  </p>
                </>
              )}
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: PC_PURPLE_SOFT }}>
          PulseCheck — Coaching Platform
        </p>
      </div>
    </div>
  );
};

export default CoachLogin;
