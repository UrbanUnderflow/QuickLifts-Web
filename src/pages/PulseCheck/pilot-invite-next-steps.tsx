import React, { useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { ArrowRight, CheckCircle2, Download, Smartphone, Users2 } from 'lucide-react';
import { getFirestoreDocFallback } from '../../lib/server-firestore-fallback';
import type { PulseCheckPilotInviteConfig } from '../../api/firebase/pulsecheckPilotDashboard/types';
import { appLinks } from '../../utils/platformDetection';

type InviteMode = 'new-account' | 'existing-account';

type PilotInviteNextStepsProps = {
  mode: InviteMode;
  organizationName: string;
  teamName: string;
  pilotName: string;
  cohortName: string;
  organizationId: string;
  teamId: string;
  targetEmail: string;
  config: PulseCheckPilotInviteConfig;
};

const PILOT_INVITE_CONFIGS_COLLECTION = 'pulsecheck-pilot-invite-configs';
const TEAM_INVITE_DEFAULTS_COLLECTION = 'pulsecheck-team-invite-defaults';
const ORGANIZATION_INVITE_DEFAULTS_COLLECTION = 'pulsecheck-organization-invite-defaults';
const PULSECHECK_IOS_APP_STORE_URL = 'https://apps.apple.com/by/app/pulsecheck-mindset-coaching/id6747253393';
const LEGACY_FIT_WITH_PULSE_IOS_APP_ID = 'id6451497729';

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const resolvePulseCheckIosAppUrl = (value: unknown) => {
  const normalizedValue = normalizeString(value);
  if (!normalizedValue || normalizedValue.includes(LEGACY_FIT_WITH_PULSE_IOS_APP_ID)) {
    return PULSECHECK_IOS_APP_STORE_URL;
  }
  return normalizedValue;
};

const splitInstructionLines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const buildFallbackConfig = (
  pilotId: string,
  organizationId: string,
  teamId: string,
  organizationName: string,
  teamName: string,
  pilotName: string
): PulseCheckPilotInviteConfig => ({
  id: pilotId || 'pilot-invite-config',
  pilotId,
  organizationId,
  teamId,
  welcomeHeadline: `Welcome to ${pilotName || 'your PulseCheck pilot'}`,
  welcomeBody: `You are joining ${teamName || 'your team'} inside ${organizationName || 'PulseCheck'}. This page explains what to do next so you can move into the pilot cleanly.`,
  existingAthleteInstructions:
    'Open the Pulse app and sign in with your existing account.\nConfirm the team and pilot appear.\nComplete only any pilot-specific checkpoint that appears.',
  newAthleteInstructions:
    'Download the Pulse app on your phone.\nSign in with the invited email and complete athlete onboarding.\nFinish the baseline setup so the pilot can start correctly.',
  wearableRequirements:
    'Connect the wearable or health data source expected for this pilot as early as possible.',
  baselineExpectations:
    'Complete your baseline path promptly after joining so the pilot can start collecting usable signal.',
  supportName: '',
  supportEmail: '',
  supportPhone: '',
  iosAppUrl: PULSECHECK_IOS_APP_STORE_URL,
  androidAppUrl: appLinks.playStoreUrl,
  createdAt: null,
  updatedAt: null,
});

const applyConfigLayer = (base: PulseCheckPilotInviteConfig, data: Record<string, unknown> | null): PulseCheckPilotInviteConfig => ({
  ...base,
  welcomeHeadline: normalizeString(data?.welcomeHeadline) || base.welcomeHeadline,
  welcomeBody: normalizeString(data?.welcomeBody) || base.welcomeBody,
  existingAthleteInstructions: normalizeString(data?.existingAthleteInstructions) || base.existingAthleteInstructions,
  newAthleteInstructions: normalizeString(data?.newAthleteInstructions) || base.newAthleteInstructions,
  wearableRequirements: normalizeString(data?.wearableRequirements) || base.wearableRequirements,
  baselineExpectations: normalizeString(data?.baselineExpectations) || base.baselineExpectations,
  supportName: normalizeString(data?.supportName) || base.supportName,
  supportEmail: normalizeString(data?.supportEmail) || base.supportEmail,
  supportPhone: normalizeString(data?.supportPhone) || base.supportPhone,
  iosAppUrl: resolvePulseCheckIosAppUrl(data?.iosAppUrl) || base.iosAppUrl,
  androidAppUrl: normalizeString(data?.androidAppUrl) || base.androidAppUrl,
});

const PilotInviteNextStepsPage = ({
  mode,
  organizationName,
  teamName,
  pilotName,
  cohortName,
  organizationId,
  teamId,
  targetEmail,
  config,
}: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const webAthleteOnboardingHref = useMemo(() => {
    if (!organizationId || !teamId) return '/PulseCheck';
    return `/PulseCheck/athlete-onboarding?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`;
  }, [organizationId, teamId]);

  const primaryInstructions = mode === 'new-account' ? config.newAthleteInstructions : config.existingAthleteInstructions;
  const steps = splitInstructionLines(primaryInstructions);
  const supportLines = [config.supportName, config.supportEmail, config.supportPhone].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <Head>
        <title>Pilot Invite Next Steps</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10 md:px-6">
        <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-[32px] border border-cyan-500/15 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_42%),#09111e] p-8 shadow-2xl">
            <div className="space-y-5">
              <div className="inline-flex rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3">
                <Users2 className="h-6 w-6 text-cyan-200" />
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Pilot Access Ready</p>
                <h1 className="text-3xl font-semibold text-white">{config.welcomeHeadline}</h1>
                <p className="max-w-2xl text-sm leading-7 text-zinc-300">{config.welcomeBody}</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Pilot Scope</div>
                  <div className="mt-3 text-sm text-zinc-200">
                    {pilotName || 'Pilot assignment pending'}
                    {cohortName ? ` / ${cohortName}` : ''}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    {teamName} inside {organizationName}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm leading-7 text-zinc-300">
                  {mode === 'new-account'
                    ? `Because this is a new Pulse account, sign in with ${targetEmail || 'your invited email'}, complete onboarding, and follow the pilot setup requirements below.`
                    : 'Because you already have a Pulse account, this invite should attach the pilot directly to your account without replaying full onboarding.'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-zinc-800 bg-[#090f1c] p-8 shadow-2xl">
            <div className="space-y-6">
              <div className="inline-flex rounded-2xl border border-green-500/25 bg-green-500/10 p-3">
                <CheckCircle2 className="h-6 w-6 text-green-300" />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Next Steps</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">
                  {mode === 'new-account' ? 'What needs to happen next' : 'What to expect next'}
                </h2>
              </div>

              <div className="space-y-3">
                {steps.map((step) => (
                  <div key={step} className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-4 text-sm leading-7 text-zinc-300">
                    {step}
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Wearable Requirements</div>
                <div className="mt-3 text-sm leading-7 text-zinc-300">{config.wearableRequirements}</div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Baseline Expectations</div>
                <div className="mt-3 text-sm leading-7 text-zinc-300">{config.baselineExpectations}</div>
              </div>

              {supportLines.length > 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Support Contact</div>
                  <div className="mt-3 space-y-1 text-sm leading-7 text-zinc-300">
                    {supportLines.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <a
                  href={resolvePulseCheckIosAppUrl(config.iosAppUrl) || PULSECHECK_IOS_APP_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
                >
                  <Download className="h-4 w-4" />
                  iPhone App Store
                </a>
                <a
                  href={config.androidAppUrl || appLinks.playStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
                >
                  <Smartphone className="h-4 w-4" />
                  Android Play Store
                </a>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {mode === 'new-account' ? (
                  <Link
                    href={webAthleteOnboardingHref}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                  >
                    Open Web Onboarding
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
                <Link
                  href="/PulseCheck"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
                >
                  Open PulseCheck Web
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<PilotInviteNextStepsProps> = async ({ query }) => {
  const forceDevFirebase = query.devFirebase === '1';
  const mode = normalizeString(query.mode) === 'new-account' ? 'new-account' : 'existing-account';
  const organizationName = normalizeString(query.organizationName) || 'PulseCheck Organization';
  const teamName = normalizeString(query.teamName) || 'Team';
  const pilotName = normalizeString(query.pilotName);
  const cohortName = normalizeString(query.cohortName);
  const organizationId = normalizeString(query.organizationId);
  const teamId = normalizeString(query.teamId);
  const pilotId = normalizeString(query.pilotId);
  const targetEmail = normalizeString(query.targetEmail);
  const admin = (await import('../../lib/firebase-admin')).default;

  const fallback = buildFallbackConfig(pilotId, organizationId, teamId, organizationName, teamName, pilotName);

  const readConfigDoc = async (collectionName: string, documentId: string) => {
    if (!documentId) return null;
    try {
      const adminDoc = await admin
        .firestore()
        .collection(collectionName)
        .doc(documentId)
        .get()
        .then((snapshot) => (snapshot.exists ? snapshot.data() || {} : null))
        .catch(() => null);
      if (adminDoc) return adminDoc as Record<string, unknown>;
    } catch {
      // Fallback handled below.
    }

    return getFirestoreDocFallback(collectionName, documentId, forceDevFirebase);
  };

  const [organizationConfigData, teamConfigData, pilotConfigData] = await Promise.all([
    readConfigDoc(ORGANIZATION_INVITE_DEFAULTS_COLLECTION, organizationId),
    readConfigDoc(TEAM_INVITE_DEFAULTS_COLLECTION, teamId),
    readConfigDoc(PILOT_INVITE_CONFIGS_COLLECTION, pilotId),
  ]);

  const config = applyConfigLayer(
    applyConfigLayer(
      applyConfigLayer(fallback, organizationConfigData),
      teamConfigData
    ),
    pilotConfigData
  );

  return {
    props: {
      mode,
      organizationName,
      teamName,
      pilotName,
      cohortName,
      organizationId,
      teamId,
      targetEmail,
      config,
    },
  };
};

export default PilotInviteNextStepsPage;
