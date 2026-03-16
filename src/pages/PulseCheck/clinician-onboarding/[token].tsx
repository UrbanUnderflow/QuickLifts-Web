import React from 'react';
import Head from 'next/head';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { MailPlus, ShieldPlus, Stethoscope } from 'lucide-react';
import admin from '../../../lib/firebase-admin';
import { getFirestoreDocFallback } from '../../../lib/server-firestore-fallback';

type ClinicianOnboardingPageProps = {
  invite: {
    token: string;
    targetEmail: string;
    organizationName: string;
    teamName: string;
    clinicianProfileName: string;
    status: string;
  };
};

const ClinicianOnboardingPage = ({ invite }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <Head>
        <title>AuntEdna Clinician Onboarding</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 md:px-6">
        <section className="w-full rounded-[32px] border border-zinc-800 bg-[#090f1c] p-8 shadow-2xl">
          <div className="space-y-5">
            <div className="inline-flex rounded-2xl border border-purple-500/25 bg-purple-500/10 p-3">
              <Stethoscope className="h-6 w-6 text-purple-300" />
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">AuntEdna Clinician Onboarding</p>
              <h1 className="text-3xl font-semibold text-white">Clinician handoff record is ready</h1>
              <p className="max-w-2xl text-sm leading-7 text-zinc-300">
                This onboarding link is tied to <span className="font-medium text-white">{invite.clinicianProfileName}</span> for{' '}
                <span className="font-medium text-white">{invite.teamName}</span> inside{' '}
                <span className="font-medium text-white">{invite.organizationName}</span>.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                <div className="flex items-center gap-2">
                  <MailPlus className="h-4 w-4 text-purple-300" />
                  <p className="text-sm font-semibold text-white">Target Clinician Email</p>
                </div>
                <p className="mt-3 text-sm text-zinc-300">{invite.targetEmail || 'Not specified'}</p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                <div className="flex items-center gap-2">
                  <ShieldPlus className="h-4 w-4 text-amber-300" />
                  <p className="text-sm font-semibold text-white">Invite Status</p>
                </div>
                <p className="mt-3 text-sm text-zinc-300">{invite.status}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4 text-sm leading-7 text-zinc-300">
              This is the PulseCheck-side clinician handoff page for now. Once AuntEdna exposes onboarding-link and SSO APIs,
              this route should continue the clinician into AuntEdna setup instead of stopping here.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<ClinicianOnboardingPageProps> = async ({ params, query, res }) => {
  const token = typeof params?.token === 'string' ? params.token : '';
  const forceDevFirebase = query.devFirebase === '1';
  if (!token) return { notFound: true };

  try {
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
    if (invite.inviteType !== 'clinician-onboarding') return { notFound: true };

    let organizationName = 'PulseCheck Organization';
    let teamName = 'Initial Team';
    let clinicianProfileName = 'Clinician Profile';

    try {
      const [organizationSnap, teamSnap, clinicianSnap] = await Promise.all([
        admin.firestore().collection('pulsecheck-organizations').doc(String(invite.organizationId || '')).get(),
        admin.firestore().collection('pulsecheck-teams').doc(String(invite.teamId || '')).get(),
        admin.firestore().collection('pulsecheck-auntedna-clinician-profiles').doc(String(invite.clinicianProfileId || '')).get(),
      ]);

      organizationName = organizationSnap.data()?.displayName || organizationName;
      teamName = teamSnap.data()?.displayName || teamName;
      clinicianProfileName = clinicianSnap.data()?.displayName || clinicianProfileName;
    } catch {
      const [organizationDoc, teamDoc, clinicianDoc] = await Promise.all([
        getFirestoreDocFallback('pulsecheck-organizations', String(invite.organizationId || ''), forceDevFirebase),
        getFirestoreDocFallback('pulsecheck-teams', String(invite.teamId || ''), forceDevFirebase),
        getFirestoreDocFallback('pulsecheck-auntedna-clinician-profiles', String(invite.clinicianProfileId || ''), forceDevFirebase),
      ]);

      organizationName = String(organizationDoc?.displayName || organizationName);
      teamName = String(teamDoc?.displayName || teamName);
      clinicianProfileName = String(clinicianDoc?.displayName || clinicianProfileName);
    }

    res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    return {
      props: {
        invite: {
          token,
          targetEmail: invite.targetEmail || '',
          organizationName,
          teamName,
          clinicianProfileName,
          status: invite.status || 'active',
        },
      },
    };
  } catch (error) {
    console.error('[pulsecheck-clinician-onboarding] Failed to load invite:', error);
    return { notFound: true };
  }
};

export default ClinicianOnboardingPage;
