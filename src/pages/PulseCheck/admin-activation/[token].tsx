import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User as FirebaseAuthUser } from 'firebase/auth';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, LogIn, LogOut, MailPlus, ShieldPlus, UserPlus } from 'lucide-react';
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
    organizationName: string;
    teamName: string;
    status: string;
  };
};

type AuthMode = 'create-account' | 'sign-in';

const AdminActivationPage = ({ invite }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
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
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [redeemedState, setRedeemedState] = useState<{
    organizationId: string;
    organizationName: string;
    teamId: string;
    teamName: string;
  } | null>(null);

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

  const normalizedTargetEmail = useMemo(() => invite.targetEmail.trim().toLowerCase(), [invite.targetEmail]);
  const normalizedAuthEmail = useMemo(() => authUser?.email?.trim().toLowerCase() || '', [authUser]);
  const authEmailMatchesInvite = !normalizedTargetEmail || !normalizedAuthEmail || normalizedTargetEmail === normalizedAuthEmail;

  const completeRedeem = async () => {
    const result = await pulseCheckProvisioningService.redeemAdminActivationInvite(invite.token);
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
        profileImageURL: '',
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
      const usernameAvailable = await isUsernameAvailable(username);
      if (!usernameAvailable) {
        throw new Error('Username already taken.');
      }

      const credential = await createUserWithEmailAndPassword(auth, email, createForm.password);
      await claimUsername(credential.user.uid, username);
      await createPulseCheckAdminUser(credential.user, username);
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

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setMessage(null);
    } catch (error) {
      console.error('[pulsecheck-admin-activation] Failed to sign out:', error);
      setMessage({ type: 'error', text: 'Failed to sign out.' });
    }
  };

  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <Head>
        <title>PulseCheck Admin Activation</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10 md:px-6">
        <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-[32px] border border-zinc-800 bg-[#090f1c] p-8 shadow-2xl">
            <div className="space-y-5">
              <div className="inline-flex rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3">
                <ShieldPlus className="h-6 w-6 text-amber-300" />
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">PulseCheck Admin Activation</p>
                <h1 className="text-3xl font-semibold text-white">Claim the organization handoff</h1>
                <p className="max-w-2xl text-sm leading-7 text-zinc-300">
                  This invite activates <span className="font-medium text-white">{invite.organizationName}</span> and makes the
                  accepted user the initial admin for <span className="font-medium text-white">{invite.teamName}</span>.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <MailPlus className="h-4 w-4 text-amber-300" />
                    <p className="text-sm font-semibold text-white">Target Admin</p>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">{invite.targetEmail || 'Not specified'}</p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-300" />
                    <p className="text-sm font-semibold text-white">Invite Status</p>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">{redeemedState ? 'redeemed' : invite.status}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-4 text-sm leading-7 text-zinc-300">
                Accepting this invite creates org and team admin memberships, marks the invite as redeemed, and moves the organization
                and team from provisioning into active ownership.
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-400">
                <p className="font-medium text-white">What happens on redemption</p>
                <p className="mt-2 leading-7">
                  You become the first organization admin and team admin for this container. The invite is single-use and tied to the
                  target email when one is specified.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-zinc-800 bg-[#090f1c] p-8 shadow-2xl">
            {message ? (
              <div
                className={`mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
                  message.type === 'success'
                    ? 'border-green-500/20 bg-green-500/[0.06] text-green-200'
                    : 'border-red-500/20 bg-red-500/[0.06] text-red-200'
                }`}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <span>{message.text}</span>
              </div>
            ) : null}

            {redeemedState ? (
              <div className="space-y-6">
                <div className="inline-flex rounded-2xl border border-green-500/25 bg-green-500/10 p-3">
                  <CheckCircle2 className="h-6 w-6 text-green-300" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Activation Complete</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">You now own the initial admin handoff</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    <span className="font-medium text-white">{redeemedState.organizationName}</span> is active and your team admin
                    membership for <span className="font-medium text-white">{redeemedState.teamName}</span> has been created.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={`/PulseCheck/post-activation?organizationId=${encodeURIComponent(redeemedState.organizationId)}&teamId=${encodeURIComponent(redeemedState.teamId)}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
                  >
                    Continue Setup
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/PulseCheck"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
                  >
                    Back to PulseCheck
                  </Link>
                </div>
              </div>
            ) : !authReady ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
              </div>
            ) : authUser ? (
              <div className="space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Signed In</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">Finish activation</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    You are currently signed in as <span className="font-medium text-white">{authUser.email}</span>.
                  </p>
                </div>

                {!authEmailMatchesInvite ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm leading-7 text-red-200">
                      This invite is restricted to <span className="font-medium">{invite.targetEmail}</span>. Sign out and continue with
                      the matching account.
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={handleRedeemSignedInUser}
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldPlus className="h-4 w-4" />}
                      {submitting ? 'Activating...' : 'Accept Invite and Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
                    >
                      <LogOut className="h-4 w-4" />
                      Use a Different Account
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Account Required</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">Create or access your admin account</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    Use the invited email, then redeem the organization handoff from this page.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMode('create-account')}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      mode === 'create-account'
                        ? 'border-amber-400 bg-amber-500/[0.12] text-white'
                        : 'border-zinc-800 bg-black/20 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      <span className="text-sm font-semibold">Create Account</span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">Use this if the invited admin does not have a Pulse account yet.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('sign-in')}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      mode === 'sign-in'
                        ? 'border-amber-400 bg-amber-500/[0.12] text-white'
                        : 'border-zinc-800 bg-black/20 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <LogIn className="h-4 w-4" />
                      <span className="text-sm font-semibold">Sign In</span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">Use this if the invited admin already has an account.</p>
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
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Username</span>
                      <input
                        type="text"
                        value={createForm.username}
                        onChange={(event) => setCreateForm((current) => ({ ...current, username: event.target.value }))}
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400"
                        placeholder="pulsecheckadmin"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Password</span>
                      <input
                        type="password"
                        value={createForm.password}
                        onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Confirm Password</span>
                      <input
                        type="password"
                        value={createForm.confirmPassword}
                        onChange={(event) => setCreateForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      {submitting ? 'Creating Account...' : 'Create Account and Activate'}
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
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Password</span>
                      <input
                        type="password"
                        value={signInForm.password}
                        onChange={(event) => setSignInForm((current) => ({ ...current, password: event.target.value }))}
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                      {submitting ? 'Signing In...' : 'Sign In and Activate'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<AdminActivationPageProps> = async ({ params, query, res }) => {
  const token = typeof params?.token === 'string' ? params.token : '';
  const forceDevFirebase = query.devFirebase === '1';
  if (!token) return { notFound: true };

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

    let organizationName = 'PulseCheck Organization';
    let teamName = 'Initial Team';

    try {
      const [organizationSnap, teamSnap] = await Promise.all([
        admin.firestore().collection('pulsecheck-organizations').doc(String(invite.organizationId || '')).get(),
        admin.firestore().collection('pulsecheck-teams').doc(String(invite.teamId || '')).get(),
      ]);

      organizationName = organizationSnap.data()?.displayName || organizationName;
      teamName = teamSnap.data()?.displayName || teamName;
    } catch {
      const [organizationDoc, teamDoc] = await Promise.all([
        getFirestoreDocFallback('pulsecheck-organizations', String(invite.organizationId || ''), forceDevFirebase),
        getFirestoreDocFallback('pulsecheck-teams', String(invite.teamId || ''), forceDevFirebase),
      ]);

      organizationName = String(organizationDoc?.displayName || organizationName);
      teamName = String(teamDoc?.displayName || teamName);
    }

    res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    return {
      props: {
        invite: {
          token,
          organizationId: String(invite.organizationId || ''),
          teamId: String(invite.teamId || ''),
          targetEmail: String(invite.targetEmail || ''),
          organizationName,
          teamName,
          status: String(invite.status || 'active'),
        },
      },
    };
  } catch (error) {
    console.error('[pulsecheck-admin-activation] Failed to load invite:', error);
    return { notFound: true };
  }
};

export default AdminActivationPage;
