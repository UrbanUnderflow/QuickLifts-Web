import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { onAuthStateChanged, type User as FirebaseAuthUser } from 'firebase/auth';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';
import {
  buildPulseCheckAthleteOfferWebUrl,
  buildPulseCheckTeamInviteOneLink,
  resolvePulseCheckInvitePreviewImage,
} from '../../utils/pulsecheckInviteLinks';

// Bare store links. Used only when there's no invite context to build an
// attributed OneLink from (e.g. malformed return URL) — a fresh install via
// these loses all AppsFlyer attribution, which is the exact bug this page
// otherwise avoids. See downloadUrls below.
const PULSECHECK_IOS_APP_STORE_URL =
  'https://apps.apple.com/app/pulsecheck-mindset-coaching/id6747253393';
const PULSECHECK_ANDROID_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.fitwithpulse.pulsecheck';

type ConfirmationState = 'waiting-for-account' | 'confirming' | 'confirmed' | 'pending' | 'error';

const singleQueryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] || '' : typeof value === 'string' ? value : '';

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, durationMs));

const AthleteSubscriptionCompletePage = ({
  inviteContext,
}: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<FirebaseAuthUser | null>(null);
  const [state, setState] = useState<ConfirmationState>('waiting-for-account');
  const [message, setMessage] = useState('Stripe is confirming your payment with PulseCheck.');
  const [attempt, setAttempt] = useState(0);

  const sessionId = router.isReady ? singleQueryValue(router.query.session_id) : '';
  const inviteToken = router.isReady ? singleQueryValue(router.query.invite) : '';
  const alreadyActive =
    router.isReady && singleQueryValue(router.query.access) === 'already-active';
  const forceDevFirebase = router.isReady && router.query.devFirebase === '1';

  const appOpenUrl = useMemo(() => {
    const params = new URLSearchParams({
      inviteToken,
      checkoutComplete: '1',
      resumeInvite: '1',
    });
    if (forceDevFirebase) params.set('devFirebase', '1');
    return `pulsecheck://open?${params.toString()}`;
  }, [forceDevFirebase, inviteToken]);
  const offerUrl = useMemo(
    () =>
      buildPulseCheckAthleteOfferWebUrl(
        inviteToken,
        typeof window !== 'undefined' ? window.location.origin : 'https://fitwithpulse.ai',
        forceDevFirebase
      ),
    [forceDevFirebase, inviteToken]
  );

  // A fresh (not-yet-installed) athlete has no app instance to catch the
  // pulsecheck:// deep link above, so "Download PulseCheck" has to carry the
  // invite token through the App/Play Store install itself. A bare store link
  // strips all of that — AppsFlyer's deferred deep link is what survives an
  // install, so the button must route through the OneLink, not the store
  // directly. The af_r fallback also carries checkoutComplete=1 so the app
  // knows this athlete already paid and should go straight to Join Team
  // instead of the paywall.
  const downloadUrls = useMemo(() => {
    if (!inviteToken || !inviteContext) {
      return { ios: PULSECHECK_IOS_APP_STORE_URL, android: PULSECHECK_ANDROID_PLAY_STORE_URL };
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://fitwithpulse.ai';
    const resumeOfferUrl = buildPulseCheckAthleteOfferWebUrl(inviteToken, origin, forceDevFirebase);
    const resumeFallbackPath = `${resumeOfferUrl}${resumeOfferUrl.includes('?') ? '&' : '?'}checkoutComplete=1`;
    const oneLink = buildPulseCheckTeamInviteOneLink({
      token: inviteToken,
      fallbackPath: resumeFallbackPath,
      role: 'Athlete',
      teamName: inviteContext.teamName,
      organizationName: inviteContext.organizationName,
      pilotName: inviteContext.pilotName,
      cohortName: inviteContext.cohortName,
      imageUrl: inviteContext.previewImageUrl,
    });
    // AppsFlyer OneLink detects the visiting device and routes to the correct
    // store on its own — the same link works for both buttons.
    return { ios: oneLink, android: oneLink };
  }, [forceDevFirebase, inviteContext, inviteToken]);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) setState('waiting-for-account');
    });
  }, []);

  const confirmSubscription = useCallback(async () => {
    if (!router.isReady || !authReady) return;
    if (!inviteToken || (!sessionId && !alreadyActive)) {
      setState('error');
      setMessage('The Stripe return link is missing its payment or invite details.');
      return;
    }
    if (!authUser) {
      setState('waiting-for-account');
      setMessage('Sign in through your invitation to finish connecting this purchase.');
      return;
    }

    if (alreadyActive) {
      setState('confirmed');
      setMessage(
        'This account already has an active PulseCheck subscription. Continue in the app to review and accept the team invite.'
      );
      return;
    }

    setState('confirming');
    setMessage('Stripe is confirming your payment with PulseCheck.');

    for (let pollIndex = 0; pollIndex < 10; pollIndex += 1) {
      try {
        const idToken = await authUser.getIdToken();
        const response = await fetch('/.netlify/functions/verify-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
            ...getFirebaseModeRequestHeaders(),
          },
          body: JSON.stringify({
            sessionId,
            userId: authUser.uid,
            inviteToken,
            source: 'pulsecheck-coach-athlete-offer',
            forceDevFirebase,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload?.success === true) {
          setState('confirmed');
          setMessage(
            payload?.message ||
              'Your subscription is active. Continue in PulseCheck to review and accept the team invite.'
          );
          return;
        }

        const isPending =
          response.status === 202 ||
          payload?.pending === true ||
          payload?.status === 'pending' ||
          payload?.status === 'processing';
        if (!isPending) {
          throw new Error(payload?.message || payload?.error || 'Subscription confirmation failed.');
        }
      } catch (error) {
        if (pollIndex === 9) {
          setState('error');
          setMessage(
            error instanceof Error
              ? error.message
              : 'PulseCheck could not confirm the subscription yet.'
          );
          return;
        }
      }

      setMessage('Payment received. PulseCheck is activating your subscription now.');
      await wait(1500);
    }

    setState('pending');
    setMessage('Payment received. Your subscription is still being activated.');
  }, [alreadyActive, authReady, authUser, forceDevFirebase, inviteToken, router.isReady, sessionId]);

  useEffect(() => {
    void confirmSubscription();
  }, [attempt, confirmSubscription]);

  const handleOpenInstalledApp = useCallback(() => {
    if (!inviteToken) return;

    try {
      window.sessionStorage.setItem('pulsecheck-pending-invite-token', inviteToken);
      window.sessionStorage.setItem('pulsecheck-pending-invite-checkout-complete', '1');
    } catch {
      // The deep link still carries the full handoff when storage is unavailable.
    }

    window.location.assign(appOpenUrl);

    // A native in-app browser can intercept the custom scheme and dismiss
    // itself. window.close() is a harmless fallback for script-opened views.
    window.setTimeout(() => {
      try {
        window.close();
      } catch {
        // Standard browser tabs remain on this page if they cannot be closed.
      }
    }, 750);
  }, [appOpenUrl, inviteToken]);

  const confirmed = state === 'confirmed';
  const busy = state === 'confirming';

  return (
    <>
      <Head>
        <title>PulseCheck Subscription Setup</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="relative min-h-screen overflow-hidden bg-[#070711] px-4 py-8 text-white sm:px-6 sm:py-12">
        <div className="pointer-events-none absolute -left-40 -top-48 h-[560px] w-[560px] rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl">
          <div className="mb-7 flex items-center gap-3">
            <img src="/pulsecheck-logo.svg" alt="PulseCheck" width={38} height={38} className="rounded-xl" />
            <span className="text-lg font-bold">PulseCheck</span>
          </div>

          <section className="rounded-[32px] border border-white/10 bg-[#0B0B1C]/95 p-6 shadow-2xl sm:p-9">
            <div
              className={`inline-flex rounded-2xl border p-3 ${
                confirmed
                  ? 'border-emerald-400/25 bg-emerald-400/10'
                  : 'border-violet-400/25 bg-violet-400/10'
              }`}
            >
              {confirmed ? (
                <CheckCircle2 className="h-7 w-7 text-emerald-300" />
              ) : (
                <Loader2 className={`h-7 w-7 text-violet-300 ${busy ? 'animate-spin' : ''}`} />
              )}
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {confirmed ? 'Payment confirmed' : 'Confirmation in progress'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
              {confirmed ? 'Your PulseCheck subscription is ready' : 'We are connecting your purchase'}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">{message}</p>
            {authUser?.email ? (
              <p className="mt-2 text-sm text-zinc-500">
                App account: <span className="font-medium text-zinc-300">{authUser.email}</span>
              </p>
            ) : null}

            {state === 'waiting-for-account' ? (
              <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                <p className="text-sm leading-6 text-amber-100">
                  Open the invitation and sign in with the account used before Stripe checkout. PulseCheck will continue confirmation from there.
                </p>
                <Link
                  href={offerUrl}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black"
                >
                  Return to invitation
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}

            {(state === 'pending' || state === 'error') && authUser ? (
              <button
                type="button"
                onClick={() => setAttempt((current) => current + 1)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-violet-300/30 bg-violet-300/10 px-4 py-2.5 text-sm font-semibold text-violet-100"
              >
                <RefreshCw className="h-4 w-4" />
                Retry confirmation
              </button>
            ) : null}

            {confirmed ? (
              <div className="mt-9 grid gap-5 lg:grid-cols-[1fr_0.92fr]">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#E0FE10]/25 bg-[#E0FE10]/[0.06] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#E0FE10]">
                      Already installed?
                    </p>
                    <h2 className="mt-2 text-lg font-semibold">Continue your team invite in PulseCheck</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">
                      We&apos;ll return you to this invitation so you can finish onboarding, review the required consents, and choose Join Team.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenInstalledApp}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-3 text-sm font-semibold text-black"
                    >
                      I already have the app
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">Step 1</p>
                    <h2 className="mt-2 text-lg font-semibold">Download PulseCheck</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      Install the app from your phone&apos;s app store.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <a
                        href={downloadUrls.ios}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
                      >
                        <Download className="h-4 w-4" />
                        Download for iPhone
                      </a>
                      <a
                        href={downloadUrls.android}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white"
                      >
                        <Smartphone className="h-4 w-4" />
                        Download for Android
                      </a>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">Step 2</p>
                    <h2 className="mt-2 text-lg font-semibold">Come back and open the app</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      Return to this page after installation, then use the button below. Sign in with the same account shown above and continue through onboarding.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenInstalledApp}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-3 text-sm font-semibold text-black"
                    >
                      Open PulseCheck
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <aside className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
                  <CheckCircle2 className="h-6 w-6 text-emerald-300" />
                  <h2 className="mt-4 text-lg font-semibold">Your subscription follows your account</h2>
                  <p className="mt-2 text-sm leading-7 text-zinc-300">
                    PulseCheck uses the account from checkout to recognize your subscription in the app. Sign in with {authUser?.email || 'the same email used for checkout'}.
                  </p>
                  <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-400">
                    Your invitation stays attached to this handoff. The app will show the normal agreements and Join Team steps before team access is completed.
                  </div>
                </aside>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};

type AthleteSubscriptionCompleteInviteContext = {
  teamName: string;
  organizationName: string;
  pilotName: string;
  cohortName: string;
  previewImageUrl: string;
};

export const getServerSideProps: GetServerSideProps<{
  inviteContext: AthleteSubscriptionCompleteInviteContext | null;
}> = async ({ query }) => {
  const token = typeof query.invite === 'string' ? query.invite.trim() : '';
  if (!token) {
    return { props: { inviteContext: null } };
  }

  const forceDevFirebase = query.devFirebase === '1';

  try {
    const firebaseAdmin = await import('../../lib/firebase-admin');
    const admin = firebaseAdmin.default;
    const adminApp = firebaseAdmin.getFirebaseAdminApp(forceDevFirebase);
    const firestore = admin.firestore(adminApp);

    const inviteSnap = await firestore.collection('pulsecheck-invite-links').doc(token).get();
    const invite = inviteSnap.exists ? inviteSnap.data() || {} : null;
    if (!invite) {
      return { props: { inviteContext: null } };
    }

    const [organizationSnap, teamSnap] = await Promise.all([
      firestore.collection('pulsecheck-organizations').doc(String(invite.organizationId || '')).get(),
      firestore.collection('pulsecheck-teams').doc(String(invite.teamId || '')).get(),
    ]);

    const organizationName = String(organizationSnap.data()?.displayName || 'PulseCheck Organization');
    const teamName = String(teamSnap.data()?.displayName || 'Team');
    const organizationImageUrl = String(organizationSnap.data()?.invitePreviewImageUrl || '');
    const teamImageUrl = String(teamSnap.data()?.invitePreviewImageUrl || '');

    return {
      props: {
        inviteContext: {
          teamName,
          organizationName,
          pilotName: String(invite.pilotName || ''),
          cohortName: String(invite.cohortName || ''),
          previewImageUrl: resolvePulseCheckInvitePreviewImage(teamImageUrl, organizationImageUrl),
        },
      },
    };
  } catch (error) {
    console.error('[pulsecheck-athlete-subscription-complete] Failed to load invite context:', error);
    return { props: { inviteContext: null } };
  }
};

export default AthleteSubscriptionCompletePage;
