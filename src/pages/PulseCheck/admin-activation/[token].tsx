import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { speakStep, stopNarration } from '../../../utils/tts';
import { buildNoraOnboardingWelcome } from '../../../lib/noraOnboardingVoice';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { browserPopupRedirectResolver, createUserWithEmailAndPassword, fetchSignInMethodsForEmail, GoogleAuthProvider, OAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, type User as FirebaseAuthUser } from 'firebase/auth';
import { AlertTriangle, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, LogOut, Sparkles } from 'lucide-react';
import { getFirestoreDocFallback } from '../../../lib/server-firestore-fallback';
import { auth } from '../../../api/firebase/config';
import { pulseCheckProvisioningService } from '../../../api/firebase/pulsecheckProvisioning/service';
import { claimUsername, generateUsernameFromEmail, isUsernameAvailable, isValidUsernameFormat, normalizeUsername } from '../../../api/firebase/auth/username';
import { SubscriptionPlatform, SubscriptionType, UserLevel, userService } from '../../../api/firebase/user';

type AdminActivationPageProps = {
  invite: {
    token: string;
    organizationId: string;
    teamId: string;
    targetEmail: string;
    targetName: string;
    organizationName: string;
    teamName: string;
    status: string;
    prefilledProfileImageUrl: string;
  };
};

type AuthMode = 'create-account' | 'sign-in';

// Canonical PulseCheck brand tokens (see public/pulsecheck-design-system.html).
const PC = {
  pageBg: '#070711',
  deepBg: '#0B0B1C',
  purple: '#7C3AED',
  purpleSoft: '#a78bfa',
  cardBg: 'rgba(255,255,255,0.045)',
  cardBorder: 'rgba(255,255,255,0.10)',
};

const AdminActivationPage = ({ invite }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const router = useRouter();
  // Screen Demo mode: bypass auth entirely so anyone can click straight through
  // the onboarding flow. Gated behind ?demo=1 (see /admin/screenDemo).
  const isDemo = router.query.demo === '1';
  const demoNextUrl = `/PulseCheck/post-activation?organizationId=${encodeURIComponent(invite.organizationId)}&teamId=${encodeURIComponent(invite.teamId)}&orgName=${encodeURIComponent(invite.organizationName)}&teamName=${encodeURIComponent(invite.teamName)}&demo=1`;
  const [mode, setMode] = useState<AuthMode>('create-account');
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<FirebaseAuthUser | null>(null);
  const [createForm, setCreateForm] = useState({
    email: invite.targetEmail || '',
    password: '',
    confirmPassword: '',
    username: generateUsernameFromEmail(invite.targetEmail || 'pulsecheckadmin'),
  });
  const [signInForm, setSignInForm] = useState({
    email: invite.targetEmail || '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [activeProvider, setActiveProvider] = useState<'google' | 'apple' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [redeemedState, setRedeemedState] = useState<{
    organizationId: string;
    organizationName: string;
    teamId: string;
    teamName: string;
  } | null>(null);
  // When someone activates via Apple/Google with an email that differs from the
  // provisioned institutional one, we ask where PulseCheck updates should go
  // (institutional pre-selected) before finishing redemption.
  const [emailChoice, setEmailChoice] = useState<{ socialEmail: string; selected: string } | null>(null);

  useEffect(() => {
    setCreateForm((current) => ({
      ...current,
      email: invite.targetEmail || current.email,
      username:
        current.username ||
        generateUsernameFromEmail(invite.targetEmail || 'pulsecheckadmin'),
    }));
    setSignInForm((current) => ({
      ...current,
      email: invite.targetEmail || current.email,
    }));
  }, [invite.targetEmail]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setAuthUser(nextUser);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Auto-detect whether the invited coach already has a Pulse account so we open
  // them on the right path (sign in vs. create) without making them choose blind.
  useEffect(() => {
    const email = invite.targetEmail?.trim();
    if (!email) return;
    let cancelled = false;
    void fetchSignInMethodsForEmail(auth, email)
      .then((methods) => {
        if (cancelled) return;
        if (methods && methods.length > 0) setMode('sign-in');
      })
      .catch(() => {
        /* best-effort; default stays on create-account */
      });
    return () => {
      cancelled = true;
    };
  }, [invite.targetEmail]);

  const normalizedTargetEmail = useMemo(() => invite.targetEmail.trim().toLowerCase(), [invite.targetEmail]);
  const normalizedAuthEmail = useMemo(() => authUser?.email?.trim().toLowerCase() || '', [authUser]);
  const authEmailMatchesInvite = !normalizedTargetEmail || !normalizedAuthEmail || normalizedTargetEmail === normalizedAuthEmail;

  const completeRedeem = async (notificationEmail?: string) => {
    const result = await pulseCheckProvisioningService.redeemAdminActivationInvite(
      invite.token,
      notificationEmail || invite.targetEmail || undefined
    );
    setRedeemedState({
      organizationId: result.organizationId,
      organizationName: result.organizationName,
      teamId: result.teamId,
      teamName: result.teamName,
    });
    setMessage({
      type: 'success',
      text: `Activation complete. ${result.organizationName} is now active and your admin membership is in place.`,
    });
  };

  const createPulseCheckAdminUser = async (user: FirebaseAuthUser, username: string) => {
    const normalizedName = normalizeUsername(username);
    const userData = {
      id: user.uid,
      email: user.email || createForm.email.trim(),
      username: normalizedName,
      displayName: normalizedName,
      role: 'coach' as const,
      registrationComplete: true,
      subscriptionType: SubscriptionType.unsubscribed,
      subscriptionPlatform: SubscriptionPlatform.Web,
      level: UserLevel.Novice,
      goal: [],
      bodyWeight: [],
      macros: {},
      profileImage: {
        // Front-loaded by the admin before activation (see provisioning console),
        // so the coach's onboarding opens with their photo already set.
        profileImageURL: invite.prefilledProfileImageUrl || '',
        imageOffsetWidth: 0,
        imageOffsetHeight: 0,
      },
      bio: '',
      additionalGoals: '',
      blockedUsers: [],
      encouragement: [],
      isCurrentlyActive: false,
      videoCount: 0,
      creator: null,
      winner: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      onboardInvite: {
        source: 'pulsecheck-admin-activation',
        token: invite.token,
        organizationId: invite.organizationId,
        teamId: invite.teamId,
        capturedAt: Math.floor(Date.now() / 1000),
      },
    };

    await userService.createUser(user.uid, userData);
  };

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (isDemo) {
      void router.push(demoNextUrl);
      return;
    }

    const email = createForm.email.trim().toLowerCase();
    const username = normalizeUsername(createForm.username);

    if (!email || !createForm.password || !createForm.confirmPassword || !username) {
      setMessage({ type: 'error', text: 'Email, password, and username are required.' });
      return;
    }
    if (normalizedTargetEmail && email !== normalizedTargetEmail) {
      setMessage({ type: 'error', text: `This invite is restricted to ${invite.targetEmail}.` });
      return;
    }
    if (createForm.password !== createForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (!isValidUsernameFormat(username)) {
      setMessage({ type: 'error', text: 'Use a username with 3-20 lowercase letters, numbers, dots, underscores, or dashes.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      // Create the auth user FIRST so every Firestore read/write below runs
      // authenticated. The username-availability check reads usernames/{name},
      // which the rules only allow for signed-in users — running it pre-auth was
      // the source of the "Missing or insufficient permissions" error new
      // admins hit during activation.
      const credential = await createUserWithEmailAndPassword(auth, email, createForm.password);
      await credential.user.getIdToken(); // ensure the token is live for Firestore

      // Claim a unique username (now authenticated). If the requested one is
      // taken, auto-suffix rather than dead-end — the account already exists.
      let finalUsername = username;
      if (!(await isUsernameAvailable(finalUsername))) {
        for (let suffix = 2; suffix < 1000; suffix += 1) {
          const candidate = `${username}${suffix}`;
          // eslint-disable-next-line no-await-in-loop
          if (await isUsernameAvailable(candidate)) {
            finalUsername = candidate;
            break;
          }
        }
      }

      await claimUsername(credential.user.uid, finalUsername);
      await createPulseCheckAdminUser(credential.user, finalUsername);
      await completeRedeem();
    } catch (error) {
      console.error('[pulsecheck-admin-activation] Failed to create account:', error);
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';
      const messageText =
        code === 'auth/email-already-in-use'
          ? 'An account with that email already exists. Sign in instead.'
          : code === 'auth/invalid-email'
            ? 'Enter a valid email address.'
            : code === 'auth/weak-password'
              ? 'Password must be at least 6 characters.'
              : error instanceof Error
                ? error.message
                : 'Failed to create your account.';
      setMessage({ type: 'error', text: messageText });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (isDemo) {
      void router.push(demoNextUrl);
      return;
    }

    const email = signInForm.email.trim().toLowerCase();
    if (!email || !signInForm.password) {
      setMessage({ type: 'error', text: 'Email and password are required.' });
      return;
    }
    if (normalizedTargetEmail && email !== normalizedTargetEmail) {
      setMessage({ type: 'error', text: `This invite is restricted to ${invite.targetEmail}.` });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await signInWithEmailAndPassword(auth, email, signInForm.password);
      await completeRedeem();
    } catch (error) {
      console.error('[pulsecheck-admin-activation] Failed to sign in:', error);
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';
      const messageText =
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-login-credentials' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
          ? 'Email or password is incorrect.'
          : error instanceof Error
            ? error.message
            : 'Failed to sign in.';
      setMessage({ type: 'error', text: messageText });
    } finally {
      setSubmitting(false);
    }
  };

  // Google / Apple sign-in. Same invite gate as email: the social account's email
  // must match the invited email, otherwise we sign them back out. Phone is not
  // offered here because the invite is keyed on email.
  const handleSocialAuth = async (provider: 'google' | 'apple') => {
    if (submitting) return;
    if (isDemo) {
      void router.push(demoNextUrl);
      return;
    }

    setSubmitting(true);
    setActiveProvider(provider);
    setMessage(null);

    try {
      const authProvider =
        provider === 'google'
          ? (() => {
              const p = new GoogleAuthProvider();
              p.addScope('email');
              p.addScope('profile');
              return p;
            })()
          : (() => {
              const p = new OAuthProvider('apple.com');
              p.addScope('email');
              p.addScope('name');
              return p;
            })();

      const result = await signInWithPopup(auth, authProvider, browserPopupRedirectResolver);
      const user = result.user;
      const email = (user.email || '').trim().toLowerCase();

      if (!email) {
        await signOut(auth);
        throw new Error('That account did not share an email address. Try email & password instead.');
      }

      // First time through, stand up the PulseCheck admin user document.
      const existingUser = await userService.fetchUserFromFirestore(user.uid).catch(() => null);
      if (!existingUser) {
        const username = generateUsernameFromEmail(email);
        try {
          await claimUsername(user.uid, username);
        } catch {
          /* username already reserved for this uid or taken — proceed with the doc */
        }
        await createPulseCheckAdminUser(user, username);
      }

      // The invite link itself is the authorization, so Apple/Google is allowed
      // even when its email differs from the institutional one. When it differs,
      // ask the coach where updates should land before finishing.
      if (normalizedTargetEmail && email !== normalizedTargetEmail) {
        setEmailChoice({ socialEmail: user.email || email, selected: invite.targetEmail });
        return;
      }

      await completeRedeem(invite.targetEmail || email);
    } catch (error) {
      console.error('[pulsecheck-admin-activation] Social sign-in failed:', error);
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';
      const messageText =
        code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
          ? 'Sign-in was cancelled.'
          : code === 'auth/popup-blocked'
            ? 'Enable popups for this site and try again.'
            : code === 'auth/account-exists-with-different-credential'
              ? 'An account already exists with that email using a different sign-in method.'
              : error instanceof Error
                ? error.message
                : 'Failed to sign in.';
      setMessage({ type: 'error', text: messageText });
    } finally {
      setSubmitting(false);
      setActiveProvider(null);
    }
  };

  const handleRedeemSignedInUser = async () => {
    if (!authUser || submitting) return;

    setSubmitting(true);
    setMessage(null);
    try {
      await completeRedeem();
    } catch (error) {
      console.error('[pulsecheck-admin-activation] Failed to redeem for signed-in user:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to redeem invite.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Finish redemption after the coach picks where updates should go.
  const confirmEmailChoice = async () => {
    if (!emailChoice || submitting) return;
    const chosen = emailChoice.selected;
    setSubmitting(true);
    setMessage(null);
    try {
      await completeRedeem(chosen);
      setEmailChoice(null);
    } catch (error) {
      console.error('[pulsecheck-admin-activation] Failed to finish activation:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to finish activation.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setMessage(null);
    } catch (error) {
      console.error('[pulsecheck-admin-activation] Failed to sign out:', error);
      setMessage({ type: 'error', text: 'Failed to sign out.' });
    }
  };

  const passwordInputClass =
    'w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 pr-12 text-sm text-white outline-none transition focus:border-[#7C3AED]';
  const textInputClass =
    'w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-70';
  const primaryBtnStyle: React.CSSProperties = { background: PC.purple };
  const displayFont: React.CSSProperties = { fontFamily: 'Switzer, sans-serif' };
  const coachFirstName = (invite.targetName || '').trim().split(/\s+/)[0] || '';

  // Nora greets the coach by name when they open the link. Browsers block audio
  // autoplay without a gesture, so we fire on the first interaction with the page
  // (and only once). Uses the global Nora ElevenLabs voice (see /admin/ai-voice).
  const noraGreetedRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (invite.status && invite.status !== 'active') return;

    const greet = () => {
      if (noraGreetedRef.current) return;
      noraGreetedRef.current = true;
      events.forEach((event) => window.removeEventListener(event, greet));
      void speakStep(buildNoraOnboardingWelcome(coachFirstName), { fallbackToBrowser: false }).catch(() => {});
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, greet, { passive: true }));

    return () => {
      events.forEach((event) => window.removeEventListener(event, greet));
      stopNarration();
    };
  }, [coachFirstName, invite.status]);

  // Wizard step is derived purely from auth/redeem state.
  // 1 = account (signed out), 2 = review & activate (signed in, not redeemed), 3 = done.
  // In demo mode the auth gate is bypassed, so we hold on step 1 until the demo
  // redirect fires.
  const step: 1 | 2 | 3 = redeemedState ? 3 : authUser && !isDemo ? 2 : 1;
  const wizardSteps: Array<{ index: 1 | 2 | 3; label: string }> = [
    { index: 1, label: 'Account' },
    { index: 2, label: 'Review' },
    { index: 3, label: 'Done' },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden text-white" style={{ background: PC.pageBg, fontFamily: 'Switzer, sans-serif' }}>
      <Head>
        <title>Welcome to PulseCheck</title>
        <meta name="robots" content="noindex,nofollow" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&display=swap"
          rel="stylesheet"
        />
          <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800,900&display=swap" />
      </Head>

      {isDemo ? (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white" style={{ background: PC.purple }}>
          <Sparkles className="h-3.5 w-3.5" />
          Screen Demo — auth is bypassed. Press continue with empty fields to walk the flow.
        </div>
      ) : null}

      {/* Ambient brand glow */}
      <div className="pointer-events-none absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)' }} />
      <div className="pointer-events-none absolute -bottom-40 right-[-10%] h-[460px] w-[460px] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)' }} />

      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 md:px-6">
        <div className="mx-auto w-full max-w-[520px]">
          {/* Brand lockup */}
          <div className="mb-7 flex items-center justify-center gap-3">
            <img src="/pulsecheck-logo.svg" alt="PulseCheck" width={36} height={36} className="rounded-[10px]" />
            <span className="text-base font-bold tracking-tight" style={displayFont}>PulseCheck</span>
          </div>

          {/* Slim progress indicator */}
          <div className="mb-8 flex items-center justify-center gap-2">
            {wizardSteps.map((wizardStep, idx) => {
              const isActive = wizardStep.index === step;
              const isComplete = wizardStep.index < step;
              return (
                <React.Fragment key={wizardStep.index}>
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition"
                      style={
                        isActive
                          ? { background: PC.purpleSoft, color: '#000' }
                          : isComplete
                            ? { background: 'rgba(167,139,250,0.3)', color: PC.purpleSoft }
                            : { border: `1px solid ${PC.cardBorder}`, color: '#71717a' }
                      }
                    >
                      {isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : wizardStep.index}
                    </span>
                    <span
                      className="text-xs font-semibold tracking-wide transition"
                      style={{ color: isActive ? '#fff' : '#71717a' }}
                    >
                      {wizardStep.label}
                    </span>
                  </div>
                  {idx < wizardSteps.length - 1 ? (
                    <span
                      className="h-px w-6"
                      style={{ background: wizardStep.index < step ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.10)' }}
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
          </div>

          <div className="rounded-[28px] border p-8 shadow-2xl" style={{ background: PC.deepBg, borderColor: PC.cardBorder }}>
            {message ? (
              <div
                className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
                  message.type === 'success'
                    ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200'
                    : 'border-red-500/20 bg-red-500/[0.06] text-red-200'
                }`}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{message.text}</span>
              </div>
            ) : null}

            {!authReady && !isDemo ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: PC.purpleSoft }} />
              </div>
            ) : step === 3 && redeemedState ? (
              /* STEP 3 — Done */
              <div className="space-y-6">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(124,58,237,0.16)' }}>
                  <CheckCircle2 className="h-7 w-7" style={{ color: PC.purpleSoft }} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: PC.purpleSoft }}>You&apos;re set up</p>
                  <h2 className="mt-2 text-3xl font-bold text-white" style={displayFont}>
                    {redeemedState.organizationName} is active 🎉
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    <span className="font-semibold text-white">{redeemedState.teamName}</span> is live and your admin access is in place.
                    Next, set up your profile and bring your staff and athletes in — we&apos;ll walk you through it.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={`/PulseCheck/post-activation?organizationId=${encodeURIComponent(redeemedState.organizationId)}&teamId=${encodeURIComponent(redeemedState.teamId)}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                    style={primaryBtnStyle}
                  >
                    Set up my team
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/PulseCheck"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30"
                    style={{ borderColor: PC.cardBorder }}
                  >
                    Explore PulseCheck
                  </Link>
                </div>
              </div>
            ) : step === 2 && authUser && !isDemo ? (
              /* STEP 2 — Review & activate */
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: PC.purpleSoft }}>Review &amp; activate</p>
                  <h2 className="mt-2 text-3xl font-bold text-white" style={displayFont}>Confirm your admin access</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    Activating claims your admin access and turns on the{' '}
                    <span className="font-medium text-white">{invite.organizationName}</span> workspace.
                  </p>
                </div>

                <div className="space-y-px overflow-hidden rounded-2xl border" style={{ borderColor: PC.cardBorder }}>
                  <div className="flex items-center justify-between px-4 py-3 text-sm" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <span className="text-zinc-500">Organization</span>
                    <span className="font-medium text-white">{invite.organizationName}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 text-sm" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <span className="text-zinc-500">Team</span>
                    <span className="font-medium text-white">{invite.teamName}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 text-sm" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <span className="text-zinc-500">Role</span>
                    <span className="font-medium text-white">Team Admin</span>
                  </div>
                </div>

                {!authEmailMatchesInvite ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm leading-7 text-red-200">
                      This invite was sent to <span className="font-medium">{invite.targetEmail}</span>, but you&apos;re signed in as{' '}
                      <span className="font-medium">{authUser.email}</span>. Switch to that account to continue.
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30"
                      style={{ borderColor: PC.cardBorder }}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out &amp; switch account
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleRedeemSignedInUser}
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      style={primaryBtnStyle}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {submitting ? 'Activating…' : 'Activate admin access'}
                    </button>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Signed in as {authUser.email}</span>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition hover:text-white"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Use a different account
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* STEP 1 — Account (signed out) */
              <div className="space-y-6">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: 'rgba(124,58,237,0.14)', color: PC.purpleSoft }}>
                    <Sparkles className="h-3.5 w-3.5" /> You&apos;re invited
                  </span>
                  <h2 className="mt-3 text-3xl font-bold leading-tight text-white" style={displayFont}>
                    {coachFirstName ? (
                      <>
                        Welcome{' '}
                        <span style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontWeight: 500, fontSize: '0.82em', color: PC.purpleSoft }}>
                          Coach
                        </span>{' '}
                        {coachFirstName}
                      </>
                    ) : (
                      <>Set up {invite.organizationName}</>
                    )}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    You&apos;ve been invited to set up{' '}
                    <span className="font-medium text-white">{invite.organizationName}</span>
                    {invite.teamName ? (
                      <>
                        {' · '}
                        <span className="font-medium text-white">{invite.teamName}</span>
                      </>
                    ) : null}
                    . Activate your admin access to get started.
                  </p>
                  {invite.targetEmail ? (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs text-zinc-300" style={{ borderColor: PC.cardBorder }}>
                      <CheckCircle2 className="h-3.5 w-3.5" style={{ color: PC.purpleSoft }} />
                      Invited as <span className="font-medium text-white">{invite.targetEmail}</span>
                    </div>
                  ) : null}
                </div>

                {/* Tabs */}
                <div className="flex gap-6 border-b" style={{ borderColor: PC.cardBorder }}>
                  <button
                    type="button"
                    onClick={() => setMode('sign-in')}
                    className="-mb-px border-b-2 pb-3 text-sm font-semibold transition"
                    style={{
                      borderColor: mode === 'sign-in' ? PC.purpleSoft : 'transparent',
                      color: mode === 'sign-in' ? '#fff' : '#71717a',
                    }}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('create-account')}
                    className="-mb-px border-b-2 pb-3 text-sm font-semibold transition"
                    style={{
                      borderColor: mode === 'create-account' ? PC.purpleSoft : 'transparent',
                      color: mode === 'create-account' ? '#fff' : '#71717a',
                    }}
                  >
                    Create account
                  </button>
                </div>

                {mode === 'create-account' ? (
                  <form className="space-y-4" onSubmit={handleCreateAccount}>
                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Email</span>
                      <input
                        type="email"
                        value={createForm.email}
                        onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                        disabled={!!invite.targetEmail}
                        className={textInputClass}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Username</span>
                      <input
                        type="text"
                        value={createForm.username}
                        onChange={(event) => setCreateForm((current) => ({ ...current, username: event.target.value }))}
                        className={textInputClass}
                        placeholder="coach_name"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Password</span>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={createForm.password}
                          onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                          className={passwordInputClass}
                          placeholder="At least 6 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Confirm password</span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={createForm.confirmPassword}
                        onChange={(event) => setCreateForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                        className={textInputClass}
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      style={primaryBtnStyle}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      {submitting ? 'Creating your account…' : 'Create account & continue'}
                    </button>
                  </form>
                ) : (
                  <form className="space-y-4" onSubmit={handleSignIn}>
                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Email</span>
                      <input
                        type="email"
                        value={signInForm.email}
                        onChange={(event) => setSignInForm((current) => ({ ...current, email: event.target.value }))}
                        disabled={!!invite.targetEmail}
                        className={textInputClass}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Password</span>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={signInForm.password}
                          onChange={(event) => setSignInForm((current) => ({ ...current, password: event.target.value }))}
                          className={passwordInputClass}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </label>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      style={primaryBtnStyle}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      {submitting ? 'Signing in…' : 'Sign in & continue'}
                    </button>
                  </form>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1" style={{ background: PC.cardBorder }} />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">or</span>
                    <span className="h-px flex-1" style={{ background: PC.cardBorder }} />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSocialAuth('google')}
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ borderColor: PC.cardBorder, background: 'rgba(0,0,0,0.3)' }}
                  >
                    {activeProvider === 'google' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <img src="/google-logo.svg" alt="" aria-hidden="true" className="h-5 w-5" />
                    )}
                    Continue with Google
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSocialAuth('apple')}
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ borderColor: PC.cardBorder, background: 'rgba(0,0,0,0.3)' }}
                  >
                    {activeProvider === 'apple' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <img src="/apple-logo.svg" alt="" aria-hidden="true" className="h-5 w-5" />
                    )}
                    Continue with Apple
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Email-routing choice after social sign-in with a non-institutional email */}
      {emailChoice ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(4,4,12,0.72)', backdropFilter: 'blur(6px)' }}
        >
          <div className="w-full max-w-md rounded-[24px] border p-6 shadow-2xl" style={{ background: PC.deepBg, borderColor: PC.cardBorder }}>
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ background: 'rgba(124,58,237,0.14)', color: PC.purpleSoft }}
            >
              <Sparkles className="h-3.5 w-3.5" /> One quick thing
            </span>
            <h2 className="mt-3 text-2xl font-bold text-white" style={displayFont}>Where should updates go?</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              You signed in with a different email than the one your organization set up. Choose where PulseCheck should send reports and updates &mdash; you can change this anytime.
            </p>

            <div className="mt-5 space-y-2.5">
              {[
                { value: invite.targetEmail, tag: 'Institutional · recommended' },
                { value: emailChoice.socialEmail, tag: 'Your sign-in email' },
              ].map((opt) => {
                const active = emailChoice.selected.trim().toLowerCase() === opt.value.trim().toLowerCase();
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEmailChoice((current) => (current ? { ...current, selected: opt.value } : current))}
                    className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition"
                    style={{ borderColor: active ? PC.purple : PC.cardBorder, background: active ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.025)' }}
                  >
                    <span
                      className="flex h-5 w-5 flex-none items-center justify-center rounded-full border"
                      style={{ borderColor: active ? PC.purple : 'rgba(255,255,255,0.3)', background: active ? PC.purple : 'transparent' }}
                    >
                      {active ? <CheckCircle2 className="h-4 w-4 text-white" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{opt.value}</span>
                      <span className="block text-[11px] uppercase tracking-[0.14em]" style={{ color: active ? PC.purpleSoft : 'rgba(255,255,255,0.4)' }}>{opt.tag}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void confirmEmailChoice()}
              disabled={submitting}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
              style={{ background: PC.purple }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {submitting ? 'Finishing…' : 'Confirm & continue'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<AdminActivationPageProps> = async ({ params, query, res }) => {
  const token = typeof params?.token === 'string' ? params.token : '';
  const forceDevFirebase = query.devFirebase === '1';
  if (!token) return { notFound: true };

  // Screen Demo mode (?demo=1): serve a fully self-contained mock invite so the
  // coach-onboarding flow can be walked end-to-end in any environment, without a
  // real seeded invite in Firebase. Mirrors /admin/screenDemo's promise of
  // "bypasses login and backend writes." Keep in sync with the client demo path.
  if (query.demo === '1') {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    return {
      props: {
        invite: {
          token,
          organizationId: 'demo-org',
          teamId: 'demo-team',
          targetEmail: 'coach@demo.pulsecheck',
          targetName: 'Jordan Lee',
          organizationName: 'Demo Athletics',
          teamName: 'Varsity Football',
          status: 'active',
          prefilledProfileImageUrl: '',
        },
      },
    };
  }

  try {
    const admin = (await import('../../../lib/firebase-admin')).default;

    let invite = await admin
      .firestore()
      .collection('pulsecheck-invite-links')
      .doc(token)
      .get()
      .then((snapshot) => (snapshot.exists ? snapshot.data() || {} : null))
      .catch(() => null);

    if (!invite) {
      invite = await getFirestoreDocFallback('pulsecheck-invite-links', token, forceDevFirebase);
    }
    if (!invite) return { notFound: true };
    if (invite.status && invite.status !== 'active') return { notFound: true };
    if (invite.inviteType !== 'admin-activation') return { notFound: true };

    // Record the first time this activation link is opened so the provisioning
    // console can show whether the invited admin has actually viewed it. Recorded
    // once per token (best-effort; never blocks rendering the page).
    try {
      const activityCollection = admin.firestore().collection('pulsecheck-invite-activities');
      const existingView = await activityCollection
        .where('token', '==', token)
        .where('eventType', '==', 'page-view')
        .limit(1)
        .get();
      if (existingView.empty) {
        await activityCollection.add({
          token,
          inviteId: token,
          eventType: 'page-view',
          organizationId: String(invite.organizationId || ''),
          teamId: String(invite.teamId || ''),
          inviteStatus: String(invite.status || 'active'),
          email: String(invite.targetEmail || ''),
          source: 'browser',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (activityError) {
      console.error('[pulsecheck-admin-activation] Failed to record page-view activity:', activityError);
    }

    let organizationName = 'PulseCheck Organization';
    let teamName = 'Initial Team';
    let targetName = '';

    // Resolve the invited coach's name by matching the invite email against the
    // team/org admin contacts, falling back to the default admin name.
    const targetEmailLc = String(invite.targetEmail || '').trim().toLowerCase();
    const resolveTargetName = (
      orgData: Record<string, unknown> | null | undefined,
      teamData: Record<string, unknown> | null | undefined
    ): string => {
      const asContacts = (value: unknown): Array<{ name?: unknown; email?: unknown }> =>
        Array.isArray(value) ? (value as Array<{ name?: unknown; email?: unknown }>) : [];
      const candidates: Array<{ name?: unknown; email?: unknown }> = [
        { name: teamData?.defaultAdminName, email: teamData?.defaultAdminEmail },
        { name: orgData?.primaryCustomerAdminName, email: orgData?.primaryCustomerAdminEmail },
        ...asContacts(teamData?.additionalAdminContacts),
        ...asContacts(orgData?.additionalAdminContacts),
      ];
      const matched = targetEmailLc
        ? candidates.find(
            (contact) =>
              String(contact?.email ?? '').trim().toLowerCase() === targetEmailLc &&
              String(contact?.name ?? '').trim()
          )
        : undefined;
      return String(
        matched?.name ?? teamData?.defaultAdminName ?? orgData?.primaryCustomerAdminName ?? ''
      ).trim();
    };

    try {
      const [organizationSnap, teamSnap] = await Promise.all([
        admin.firestore().collection('pulsecheck-organizations').doc(String(invite.organizationId || '')).get(),
        admin.firestore().collection('pulsecheck-teams').doc(String(invite.teamId || '')).get(),
      ]);

      const organizationData = organizationSnap.data();
      const teamData = teamSnap.data();
      organizationName = organizationData?.displayName || organizationName;
      teamName = teamData?.displayName || teamName;
      targetName = resolveTargetName(organizationData, teamData);
    } catch {
      const [organizationDoc, teamDoc] = await Promise.all([
        getFirestoreDocFallback('pulsecheck-organizations', String(invite.organizationId || ''), forceDevFirebase),
        getFirestoreDocFallback('pulsecheck-teams', String(invite.teamId || ''), forceDevFirebase),
      ]);

      organizationName = String(organizationDoc?.displayName || organizationName);
      teamName = String(teamDoc?.displayName || teamName);
      targetName = resolveTargetName(organizationDoc, teamDoc);
    }

    res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    return {
      props: {
        invite: {
          token,
          organizationId: String(invite.organizationId || ''),
          teamId: String(invite.teamId || ''),
          targetEmail: String(invite.targetEmail || ''),
          targetName,
          organizationName,
          teamName,
          status: String(invite.status || 'active'),
          prefilledProfileImageUrl: String(invite.prefilledProfileImageUrl || ''),
        },
      },
    };
  } catch (error) {
    console.error('[pulsecheck-admin-activation] Failed to load invite:', error);
    return { notFound: true };
  }
};

export default AdminActivationPage;
