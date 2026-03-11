import React from 'react';
import Head from 'next/head';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { CheckCircle2, MailPlus, ShieldPlus } from 'lucide-react';
import admin from '../../../lib/firebase-admin';

type AdminActivationPageProps = {
  invite: {
    token: string;
    targetEmail: string;
    organizationName: string;
    teamName: string;
    status: string;
  };
};

const AdminActivationPage = ({ invite }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <Head>
        <title>PulseCheck Admin Activation</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 md:px-6">
        <section className="w-full rounded-[32px] border border-zinc-800 bg-[#090f1c] p-8 shadow-2xl">
          <div className="space-y-5">
            <div className="inline-flex rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3">
              <ShieldPlus className="h-6 w-6 text-amber-300" />
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">PulseCheck Admin Activation</p>
              <h1 className="text-3xl font-semibold text-white">Organization shell is ready for handoff</h1>
              <p className="max-w-2xl text-sm leading-7 text-zinc-300">
                This activation link is tied to <span className="font-medium text-white">{invite.organizationName}</span> and the
                initial team <span className="font-medium text-white">{invite.teamName}</span>.
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
                <p className="mt-3 text-sm text-zinc-300">{invite.status}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-4 text-sm leading-7 text-zinc-300">
              The activation redemption flow is the next build slice. This landing page now confirms the token, team,
              and organization mapping so the activation link is valid and ready for the next onboarding step.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<AdminActivationPageProps> = async ({ params, res }) => {
  const token = typeof params?.token === 'string' ? params.token : '';
  if (!token) return { notFound: true };

  try {
    const inviteSnap = await admin.firestore().collection('pulsecheck-invite-links').doc(token).get();
    if (!inviteSnap.exists) return { notFound: true };

    const invite = inviteSnap.data() || {};
    if (invite.status && invite.status !== 'active') return { notFound: true };
    if (invite.inviteType !== 'admin-activation') return { notFound: true };

    const [organizationSnap, teamSnap] = await Promise.all([
      admin.firestore().collection('pulsecheck-organizations').doc(invite.organizationId || '').get(),
      admin.firestore().collection('pulsecheck-teams').doc(invite.teamId || '').get(),
    ]);

    res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    return {
      props: {
        invite: {
          token,
          targetEmail: invite.targetEmail || '',
          organizationName: organizationSnap.data()?.displayName || 'PulseCheck Organization',
          teamName: teamSnap.data()?.displayName || 'Initial Team',
          status: invite.status || 'active',
        },
      },
    };
  } catch (error) {
    console.error('[pulsecheck-admin-activation] Failed to load invite:', error);
    return { notFound: true };
  }
};

export default AdminActivationPage;
