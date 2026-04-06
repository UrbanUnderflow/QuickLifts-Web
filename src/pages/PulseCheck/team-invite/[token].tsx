import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User as FirebaseAuthUser } from 'firebase/auth';
import { AlertTriangle, ArrowRight, CheckCircle2, Download, Loader2, LogIn, LogOut, MailPlus, ShieldCheck, Smartphone, UserPlus, Users } from 'lucide-react';
import { getFirestoreDocFallback } from '../../../lib/server-firestore-fallback';
import { auth } from '../../../api/firebase/config';
import { pulseCheckProvisioningService } from '../../../api/firebase/pulsecheckProvisioning/service';
import {
  derivePulseCheckTeamPlanBypass,
  getDefaultPulseCheckTeamCommercialConfig,
} from '../../../api/firebase/pulsecheckProvisioning/types';
import type {
  PulseCheckTeamCommercialSnapshot,
  PulseCheckInviteLinkRedemptionMode,
  PulseCheckTeamMembershipRole,
} from '../../../api/firebase/pulsecheckProvisioning/types';
import { claimUsername, generateUsernameFromEmail, isUsernameAvailable, isValidUsernameFormat, normalizeUsername } from '../../../api/firebase/auth/username';
import { SubscriptionPlatform, SubscriptionType, UserLevel, userService } from '../../../api/firebase/user';
import { resolvePulseCheckInvitePreviewImage } from '../../../utils/pulsecheckInviteLinks';

const PULSECHECK_IOS_APP_STORE_URL = 'https://apps.apple.com/by/app/pulsecheck-mindset-coaching/id6747253393';

type TeamInvitePageProps = {
  invite: {
    token: string;
    activationUrl: string;
    organizationId: string;
    teamId: string;
    pilotId: string;
    pilotName: string;
    cohortId: string;
    cohortName: string;
    targetEmail: string;
    organizationName: string;
    teamName: string;
    status: string;
    redemptionMode: PulseCheckInviteLinkRedemptionMode;
    redemptionCount: number;
    teamMembershipRole: PulseCheckTeamMembershipRole;
    invitedTitle: string;
    recipientName: string;
    previewTitle: string;
    previewDescription: string;
    previewImageUrl: string;
    pageUrl: string;
    commercialSnapshot?: PulseCheckTeamCommercialSnapshot;
  };
};

type AuthMode = 'create-account' | 'sign-in';
type AthleteCompletionMode = 'new-account' | 'existing-account';

const roleLabel: Record<PulseCheckTeamMembershipRole, string> = {
  'team-admin': 'Team Admin',
  coach: 'Coach',
  'performance-staff': 'Performance Staff',
  'support-staff': 'Support Staff',
  clinician: 'Clinician',
  athlete: 'Athlete',
};
const resolveInviteStatus = (status: unknown, redemptionMode: unknown) => {
  const normalizedStatus = String(status || '').trim();
  if (normalizedStatus === 'revoked') {
    return 'revoked';
  }

  if (normalizedStatus === 'redeemed' && redemptionMode !== 'general') {
    return 'redeemed';
  }

  return 'active';
};

const nextHrefByRole = (role: PulseCheckTeamMembershipRole, organizationId: string, teamId: string) => {
  if (role === 'team-admin') {
    return `/PulseCheck/post-activation?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`;
  }

  if (role === 'athlete') {
    return `/PulseCheck/athlete-onboarding?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`;
  }

  return `/PulseCheck/member-setup?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`;
};

const normalizeInviteCommercialSnapshot = (
  value: unknown,
  organizationId: string,
  teamId: string,
  inviteToken: string
): PulseCheckTeamCommercialSnapshot => {
  const candidate = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const defaults = getDefaultPulseCheckTeamCommercialConfig();
  const commercialModel =
    String(candidate.commercialModel || defaults.commercialModel).trim() === 'team-plan' ? 'team-plan' : 'athlete-pay';
  const teamPlanStatus =
    String(candidate.teamPlanStatus || defaults.teamPlanStatus).trim() === 'active' ? 'active' : 'inactive';
  const referralRevenueSharePct = Number.isFinite(Number(candidate.referralRevenueSharePct))
    ? Math.max(0, Math.min(100, Number(candidate.referralRevenueSharePct)))
    : defaults.referralRevenueSharePct;
  const snapshot: PulseCheckTeamCommercialSnapshot = {
    commercialModel,
    teamPlanStatus,
    referralKickbackEnabled:
      typeof candidate.referralKickbackEnabled === 'boolean'
        ? candidate.referralKickbackEnabled
        : defaults.referralKickbackEnabled,
    referralRevenueSharePct,
    revenueRecipientRole:
      String(candidate.revenueRecipientRole || defaults.revenueRecipientRole).trim() === 'coach'
        ? 'coach'
        : String(candidate.revenueRecipientRole || defaults.revenueRecipientRole).trim() === 'organization-owner'
          ? 'organization-owner'
          : 'team-admin',
    revenueRecipientUserId: String(candidate.revenueRecipientUserId || defaults.revenueRecipientUserId || ''),
    billingOwnerUserId: String(candidate.billingOwnerUserId || defaults.billingOwnerUserId || ''),
    billingCustomerId: String(candidate.billingCustomerId || defaults.billingCustomerId || ''),
    teamPlanActivatedAt: null,
    teamPlanExpiresAt: null,
    sourceOrganizationId: organizationId,
    sourceTeamId: teamId,
    inviteToken,
    teamPlanBypassesPaywall: false,
  };

  snapshot.teamPlanBypassesPaywall = derivePulseCheckTeamPlanBypass(snapshot);
  return snapshot;
};

const TeamInvitePage = ({ invite }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('create-account');
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<FirebaseAuthUser | null>(null);
  const [createForm, setCreateForm] = useState({
    email: invite.targetEmail || '',
    password: '',
    confirmPassword: '',
    username: generateUsernameFromEmail(invite.targetEmail || invite.recipientName || invite.teamMembershipRole),
  });
  const [signInForm, setSignInForm] = useState({
    email: invite.targetEmail || '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [redeemedState, setRedeemedState] = useState<{
    organizationName: string;
    teamName: string;
    teamMembershipRole: PulseCheckTeamMembershipRole;
  } | null>(null);
  const [redirectingAfterRedeem, setRedirectingAfterRedeem] = useState(false);
  const [athleteCompletionMode, setAthleteCompletionMode] = useState<AthleteCompletionMode>('existing-account');
  const [showWebOnboarding, setShowWebOnboarding] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setAuthUser(nextUser);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    setShowWebOnboarding(router.query.web === '1');
  }, [router.isReady, router.query.web]);

  const normalizedTargetEmail = useMemo(() => invite.targetEmail.trim().toLowerCase(), [invite.targetEmail]);
  const normalizedAuthEmail = useMemo(() => authUser?.email?.trim().toLowerCase() || '', [authUser]);
  const authEmailMatchesInvite = !normalizedTargetEmail || !normalizedAuthEmail || normalizedTargetEmail === normalizedAuthEmail;
  const isGeneralInvite = invite.redemptionMode === 'general';
  const teamPlanBypassesPaywall = invite.commercialSnapshot?.teamPlanBypassesPaywall === true;
  const shouldPreferAppDownload = invite.teamMembershipRole === 'athlete' && Boolean(invite.pilotId || invite.cohortId);
  const shouldShowDownloadFirst = shouldPreferAppDownload && !showWebOnboarding && !redeemedState;
  const inviteScopeLabel = invite.pilotName || invite.teamName;
  const inviteHeadline = shouldPreferAppDownload
    ? `Download the Pulse Check app to join ${inviteScopeLabel}.`
    : `Join ${invite.teamName}`;

  const updateWebOnboardingPreference = (nextValue: boolean) => {
    setShowWebOnboarding(nextValue);

    const nextQuery = { ...router.query };
    if (nextValue) {
      nextQuery.web = '1';
    } else {
      delete nextQuery.web;
    }

    router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true }
    ).catch((error) => {
      console.error('[pulsecheck-team-invite] Failed to sync onboarding preference with query params:', error);
    });
  };

  const createTeamInviteUser = async (user: FirebaseAuthUser, username: string) => {
    const normalizedName = normalizeUsername(username);
    const isAthlete = invite.teamMembershipRole === 'athlete';

    await userService.updateUser(user.uid, {
      id: user.uid,
      email: user.email || createForm.email.trim().toLowerCase(),
      username: normalizedName,
      displayName: normalizedName,
      role: isAthlete ? 'athlete' : 'coach',
      registrationComplete: true,
      subscriptionType: isAthlete && teamPlanBypassesPaywall ? SubscriptionType.teamPlan : SubscriptionType.unsubscribed,
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
      onboardInvite: {
        source: 'pulsecheck-team-invite',
        token: invite.token,
        organizationId: invite.organizationId,
        teamId: invite.teamId,
        pilotId: invite.pilotId,
        cohortId: invite.cohortId,
        teamMembershipRole: invite.teamMembershipRole,
        commercialModel: invite.commercialSnapshot?.commercialModel || 'athlete-pay',
        teamPlanStatus: invite.commercialSnapshot?.teamPlanStatus || 'inactive',
        teamPlanBypassesPaywall,
        referralKickbackEnabled: invite.commercialSnapshot?.referralKickbackEnabled || false,
        referralRevenueSharePct: invite.commercialSnapshot?.referralRevenueSharePct || 0,
        capturedAt: Math.floor(Date.now() / 1000),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  const completeRedeem = async (completionMode: AthleteCompletionMode = 'existing-account') => {
    if (invite.teamMembershipRole === 'athlete') {
      setAthleteCompletionMode(completionMode);
    }
    const result = await pulseCheckProvisioningService.redeemTeamInvite(invite.token);
    setRedeemedState({
      organizationName: result.organizationName,
      teamName: result.teamName,
      teamMembershipRole: result.teamMembershipRole,
    });
    setMessage({
      type: 'success',
      text: `Your ${roleLabel[result.teamMembershipRole]} access for ${result.teamName} is active.`,
    });
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
      await createTeamInviteUser(credential.user, username);
      await completeRedeem('new-account');
    } catch (error) {
      console.error('[pulsecheck-team-invite] Failed to create account:', error);
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
      await completeRedeem('existing-account');
    } catch (error) {
      console.error('[pulsecheck-team-invite] Failed to sign in:', error);
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
      await completeRedeem('existing-account');
    } catch (error) {
      console.error('[pulsecheck-team-invite] Failed to redeem for signed-in user:', error);
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
      console.error('[pulsecheck-team-invite] Failed to sign out:', error);
      setMessage({ type: 'error', text: 'Failed to sign out.' });
    }
  };

  const completionHref = useMemo(() => {
    if (invite.teamMembershipRole !== 'athlete') {
      return nextHrefByRole(invite.teamMembershipRole, invite.organizationId, invite.teamId);
    }

    const params = new URLSearchParams({
      organizationId: invite.organizationId,
      teamId: invite.teamId,
      pilotId: invite.pilotId,
      cohortId: invite.cohortId,
      organizationName: invite.organizationName,
      teamName: invite.teamName,
      pilotName: invite.pilotName,
      cohortName: invite.cohortName,
      targetEmail: invite.targetEmail,
      mode: athleteCompletionMode,
    });

    return `/PulseCheck/pilot-invite-next-steps?${params.toString()}`;
  }, [
    athleteCompletionMode,
    invite.cohortId,
    invite.cohortName,
    invite.organizationId,
    invite.organizationName,
    invite.pilotId,
    invite.pilotName,
    invite.targetEmail,
    invite.teamId,
    invite.teamMembershipRole,
    invite.teamName,
  ]);

  useEffect(() => {
    if (!redeemedState || redirectingAfterRedeem) return;

    setRedirectingAfterRedeem(true);
    const timeoutId = window.setTimeout(() => {
      router.replace(completionHref).catch((error) => {
        console.error('[pulsecheck-team-invite] Failed to redirect after redeem:', error);
        setRedirectingAfterRedeem(false);
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [completionHref, redeemedState, redirectingAfterRedeem, router]);

  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <Head>
        <title>{invite.previewTitle}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="description" content={invite.previewDescription} />
        <meta property="og:title" content={invite.previewTitle} />
        <meta property="og:description" content={invite.previewDescription} />
        <meta property="og:image" content={invite.previewImageUrl} />
        <meta property="og:image:secure_url" content={invite.previewImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={invite.pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="PulseCheck" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={invite.previewTitle} />
        <meta name="twitter:description" content={invite.previewDescription} />
        <meta name="twitter:image" content={invite.previewImageUrl} />
      </Head>

      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 md:px-6">
        <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="rounded-[32px] border border-cyan-500/15 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_42%),#09111e] p-8 shadow-2xl">
              <div className="space-y-5">
              <div className="overflow-hidden rounded-[24px] border border-cyan-500/20 bg-black/20">
                <img
                  src={invite.previewImageUrl}
                  alt={invite.previewTitle}
                  className="h-44 w-full object-cover"
                />
              </div>

              <div className="inline-flex rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3">
                <Users className="h-6 w-6 text-cyan-200" />
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">PulseCheck Team Invite</p>
                <h1 className="text-3xl font-semibold text-white">{inviteHeadline}</h1>
                <p className="max-w-2xl text-sm leading-7 text-zinc-300">
                  {shouldPreferAppDownload ? (
                    <>
                      Pulse Check helps athletes build readiness, mindset, and performance habits with guided check-ins and coaching.
                      Download the iPhone app to join <span className="font-medium text-white">{invite.teamName}</span> inside{' '}
                      <span className="font-medium text-white">{invite.organizationName}</span>.
                    </>
                  ) : (
                    <>
                      This invite grants <span className="font-medium text-white">{roleLabel[invite.teamMembershipRole]}</span> access
                      inside <span className="font-medium text-white">{invite.organizationName}</span>.
                    </>
                  )}
                </p>
              </div>

              {shouldPreferAppDownload ? null : (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-cyan-200" />
                        <p className="text-sm font-semibold text-white">Role</p>
                      </div>
                      <p className="mt-3 text-sm text-zinc-300">{roleLabel[invite.teamMembershipRole]}</p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                      <div className="flex items-center gap-2">
                        <MailPlus className="h-4 w-4 text-cyan-200" />
                        <p className="text-sm font-semibold text-white">{isGeneralInvite ? 'Link Type' : 'Target Email'}</p>
                      </div>
                      <p className="mt-3 text-sm text-zinc-300">
                        {isGeneralInvite ? 'General athlete access link' : invite.targetEmail || 'Open invite link'}
                      </p>
                    </div>
                  </div>

                  {invite.invitedTitle ? (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-sm leading-7 text-zinc-200">
                      Invited title: <span className="font-medium text-white">{invite.invitedTitle}</span>
                    </div>
                  ) : null}

                  {invite.cohortId ? (
                    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-4 text-sm leading-7 text-zinc-200">
                      This athlete invite is linked to{' '}
                      <span className="font-medium text-white">{invite.cohortName || 'a cohort'}</span>
                      {invite.pilotName ? (
                        <>
                          {' '}inside <span className="font-medium text-white">{invite.pilotName}</span>
                        </>
                      ) : null}
                      . Redeeming this link joins the athlete to the team and preserves that cohort assignment automatically.
                    </div>
                  ) : null}

                  {isGeneralInvite ? (
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-4 text-sm leading-7 text-cyan-50">
                      This is a reusable pilot access link. Each athlete who opens it can join this pilot from the same QR code or shared URL.
                    </div>
                  ) : null}

                  {invite.teamMembershipRole === 'athlete' ? (
                    <div
                      className={`rounded-2xl border p-4 text-sm leading-7 ${
                        teamPlanBypassesPaywall
                          ? 'border-green-500/20 bg-green-500/[0.08] text-green-100'
                          : 'border-amber-500/20 bg-amber-500/[0.08] text-amber-100'
                      }`}
                    >
                      {teamPlanBypassesPaywall
                        ? 'This team has an active team plan. Athlete access is sponsored through the team, so there is no separate athlete checkout after redemption.'
                        : 'This team uses athlete-paid access. If you subscribe later, your team and invite attribution will stay attached to the subscription so the configured referral share can flow back to this team setup.'}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-400">
                    <p className="font-medium text-white">What happens on redemption</p>
                    <p className="mt-2 leading-7">
                      Your team membership is created
                      {isGeneralInvite ? ' and this general invite stays active for additional athletes.' : ' and this invite is marked redeemed.'}
                      {invite.cohortId
                        ? ' Because this link is cohort-linked, the athlete is attached directly to that pilot scope and the next-steps page explains whether onboarding is needed.'
                        : ' Team admins continue into setup, while other roles land in the shared team workspace.'}
                    </p>
                  </div>
                </>
              )}
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

            {shouldPreferAppDownload && showWebOnboarding && !redeemedState ? (
              <button
                type="button"
                onClick={() => updateWebOnboardingPreference(false)}
                className="mb-5 inline-flex items-center gap-2 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
              >
                <Smartphone className="h-4 w-4" />
                Prefer the iPhone app instead
              </button>
            ) : null}

            {redeemedState ? (
              <div className="space-y-6">
                <div className="inline-flex rounded-2xl border border-green-500/25 bg-green-500/10 p-3">
                  <CheckCircle2 className="h-6 w-6 text-green-300" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Access Ready</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">Your team access is live</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    {redeemedState.organizationName} has attached your {roleLabel[redeemedState.teamMembershipRole].toLowerCase()} access to{' '}
                    <span className="font-medium text-white">{redeemedState.teamName}</span>.
                  </p>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    Taking you into your next step now. If nothing happens, use Continue below.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={completionHref}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
                  >
                    Continue
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
            ) : shouldShowDownloadFirst ? (
              <div className="space-y-6">
                <div className="inline-flex rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3">
                  <Smartphone className="h-6 w-6 text-cyan-200" />
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">iPhone-First Onboarding</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">Download the app to join this pilot</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    Download Pulse Check on iPhone, then sign in with{' '}
                    <span className="font-medium text-white">{invite.targetEmail || 'your invited email'}</span> to continue into{' '}
                    <span className="font-medium text-white">{inviteScopeLabel}</span>.
                  </p>
                </div>

                <div className="rounded-3xl border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(34,211,238,0.16),rgba(8,15,28,0.9))] p-5">
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-white">Recommended path</div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm leading-7 text-zinc-200">
                      Install the Pulse Check app, create your account with the invited email, then come back to this browser page and tap Join Now to finish entering the pilot in-app.
                    </div>
                    <a
                      href={PULSECHECK_IOS_APP_STORE_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
                    >
                      <Download className="h-4 w-4" />
                      Download the Pulse Check App
                    </a>
                    <a
                      href={invite.activationUrl}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-400/[0.12] px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.18]"
                    >
                      Join Now
                      <ArrowRight className="h-4 w-4" />
                    </a>
                    <p className="text-xs uppercase tracking-[0.16em] text-cyan-100/70">Available on iPhone</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-4 text-sm leading-7 text-zinc-300">
                    1. Download the app on your iPhone.
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-4 text-sm leading-7 text-zinc-300">
                    2. Sign in or create your account with the invited email.
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-4 text-sm leading-7 text-zinc-300">
                    3. Come back to this browser page and tap Join Now to open the app and complete joining the pilot.
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-4 text-sm leading-7 text-zinc-300">
                    4. If you do not have an iPhone device, use the web fallback below instead.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => updateWebOnboardingPreference(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
                >
                  I don&apos;t have an iPhone device
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : !authReady ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
              </div>
            ) : authUser ? (
              <div className="space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Signed In</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">Finish access setup</h2>
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
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      {submitting ? 'Joining...' : 'Accept Invite'}
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
                  <h2 className="mt-2 text-3xl font-semibold text-white">Create or access your Pulse account</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    Use the invited email when one is specified, then accept the invite from this page. Existing Pulse athletes will be attached directly to the pilot. New athletes will get a mobile setup walkthrough after redemption.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMode('create-account')}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      mode === 'create-account'
                        ? 'border-cyan-300 bg-cyan-400/[0.12] text-white'
                        : 'border-zinc-800 bg-black/20 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      <span className="text-sm font-semibold">Create Account</span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">Use this if you do not have a Pulse account yet.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('sign-in')}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      mode === 'sign-in'
                        ? 'border-cyan-300 bg-cyan-400/[0.12] text-white'
                        : 'border-zinc-800 bg-black/20 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <LogIn className="h-4 w-4" />
                      <span className="text-sm font-semibold">Sign In</span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">Use this if you already have an account.</p>
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
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Username</span>
                      <input
                        type="text"
                        value={createForm.username}
                        onChange={(event) => setCreateForm((current) => ({ ...current, username: event.target.value }))}
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Password</span>
                      <input
                        type="password"
                        value={createForm.password}
                        onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Confirm Password</span>
                      <input
                        type="password"
                        value={createForm.confirmPassword}
                        onChange={(event) => setCreateForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      {submitting ? 'Creating Account...' : 'Create Account and Join'}
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
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Password</span>
                      <input
                        type="password"
                        value={signInForm.password}
                        onChange={(event) => setSignInForm((current) => ({ ...current, password: event.target.value }))}
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                      {submitting ? 'Signing In...' : 'Sign In and Join'}
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

export const getServerSideProps: GetServerSideProps<TeamInvitePageProps> = async ({ params, query, res }) => {
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
    const redemptionMode = invite.redemptionMode === 'general' ? 'general' : 'single-use';
    const effectiveStatus = resolveInviteStatus(invite.status, redemptionMode);
    if (effectiveStatus !== 'active') return { notFound: true };
    if (invite.inviteType !== 'team-access') return { notFound: true };

    let organizationName = 'PulseCheck Organization';
    let teamName = 'Team';
    let organizationImageUrl = '';
    let teamImageUrl = '';
    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai';
    const pageUrl = `${siteOrigin}/PulseCheck/team-invite/${encodeURIComponent(token)}${forceDevFirebase ? '?devFirebase=1' : ''}`;

    try {
      const [organizationSnap, teamSnap] = await Promise.all([
        admin.firestore().collection('pulsecheck-organizations').doc(String(invite.organizationId || '')).get(),
        admin.firestore().collection('pulsecheck-teams').doc(String(invite.teamId || '')).get(),
      ]);

      organizationName = organizationSnap.data()?.displayName || organizationName;
      teamName = teamSnap.data()?.displayName || teamName;
      organizationImageUrl = String(organizationSnap.data()?.invitePreviewImageUrl || '');
      teamImageUrl = String(teamSnap.data()?.invitePreviewImageUrl || '');
    } catch {
      const [organizationDoc, teamDoc] = await Promise.all([
        getFirestoreDocFallback('pulsecheck-organizations', String(invite.organizationId || ''), forceDevFirebase),
        getFirestoreDocFallback('pulsecheck-teams', String(invite.teamId || ''), forceDevFirebase),
      ]);

      organizationName = String(organizationDoc?.displayName || organizationName);
      teamName = String(teamDoc?.displayName || teamName);
      organizationImageUrl = String(organizationDoc?.invitePreviewImageUrl || '');
      teamImageUrl = String(teamDoc?.invitePreviewImageUrl || '');
    }

    const previewTitle = String(invite.pilotName || '').trim()
      ? `You're Invited to Join ${String(invite.pilotName).trim()}`
      : `You're Invited to Join ${teamName}`;
    const previewDescription = invite.cohortId
      ? `Join ${teamName} inside ${organizationName}. This ${redemptionMode === 'general' ? 'general ' : ''}pilot invite places you into ${String(invite.cohortName || 'the assigned cohort')} automatically.`
      : `Join ${teamName} inside ${organizationName} on PulseCheck.`;
    const previewImageUrl = resolvePulseCheckInvitePreviewImage(teamImageUrl, organizationImageUrl);

    res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    return {
      props: {
        invite: {
          token,
          activationUrl: String(invite.activationUrl || pageUrl),
          organizationId: String(invite.organizationId || ''),
          teamId: String(invite.teamId || ''),
          pilotId: String(invite.pilotId || ''),
          pilotName: String(invite.pilotName || ''),
          cohortId: String(invite.cohortId || ''),
          cohortName: String(invite.cohortName || ''),
          targetEmail: String(invite.targetEmail || ''),
          organizationName,
          teamName,
          status: effectiveStatus,
          redemptionMode,
          redemptionCount: Math.max(0, Number(invite.redemptionCount || 0)),
          teamMembershipRole: (String(invite.teamMembershipRole || 'coach') as PulseCheckTeamMembershipRole),
          invitedTitle: String(invite.invitedTitle || ''),
          recipientName: String(invite.recipientName || ''),
          previewTitle,
          previewDescription,
          previewImageUrl,
          pageUrl,
          commercialSnapshot: normalizeInviteCommercialSnapshot(
            invite.commercialSnapshot,
            String(invite.organizationId || ''),
            String(invite.teamId || ''),
            token
          ),
        },
      },
    };
  } catch (error) {
    console.error('[pulsecheck-team-invite] Failed to load invite:', error);
    return { notFound: true };
  }
};

export default TeamInvitePage;
