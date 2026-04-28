//
// /1on1-invite/[id]
//
// Landing page for a 1-on-1 training-room invite link. The iOS app
// generates these links via `FirebaseService.createShareable1on1InviteLink`
// and uses this URL as both the OneLink `af_r` fallback AND the
// universal-link path. Three audiences land here:
//
//   1. iMessage / Slack / Twitter / FB link-preview crawlers — they
//      read the OG meta tags emitted by `<TrainingInviteMeta>` and
//      render a branded preview card (the whole reason this page
//      exists; AppsFlyer's `af_og_*` query params don't get scraped).
//   2. Recipients tapping the link on a device with the Pulse iOS app
//      installed — universal links / OneLink hand them off to the app
//      and they never see this page.
//   3. Recipients tapping the link without the app installed (or on
//      desktop) — they hit this page, which surfaces App Store / Play
//      Store CTAs.
//
// We intentionally don't fetch the training doc here; the per-invite
// detail (host name, club name, etc.) lives in the iOS app and is
// shown in the `SendProgramInviteSheet` open-invite flow.
//
import type { GetServerSideProps, NextPage } from 'next';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import TrainingInviteMeta from '../../components/TrainingInviteMeta';

interface OneOnOneInvitePageProps {
  id: string;
  sharedBy?: string;
}

const APP_STORE_URL = 'https://apps.apple.com/us/app/pulse-community-workouts/id6451497729';

const OneOnOneInvitePage: NextPage<OneOnOneInvitePageProps> = ({ id, sharedBy }) => {
  const router = useRouter();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // On iOS, fire the universal-link / custom-scheme deep-link as soon
  // as the page loads. If the app is installed it intercepts the
  // navigation and the recipient never actually sees this page; if
  // it's not installed we fall through to the install CTA below.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as { MSStream?: unknown }).MSStream;

    if (!isIOS) {
      // On desktop / Android we don't try to bounce — just show the
      // landing UI with App Store CTA.
      return;
    }

    const params = new URLSearchParams();
    params.set('trainingId', id);
    if (sharedBy) params.set('sharedBy', sharedBy);
    const deepLink = `pulse://oneOnOneInvite?${params.toString()}`;

    // Trigger the deep-link. If it succeeds, the page unloads. If it
    // fails (app not installed), we surface the install prompt after
    // a short timeout.
    window.location.href = deepLink;
    const timer = window.setTimeout(() => setShowInstallPrompt(true), 1500);
    return () => window.clearTimeout(timer);
  }, [id, sharedBy]);

  const handleOpenApp = () => {
    const params = new URLSearchParams();
    params.set('trainingId', id);
    if (sharedBy) params.set('sharedBy', sharedBy);
    if (typeof window !== 'undefined') {
      window.location.href = `pulse://oneOnOneInvite?${params.toString()}`;
    }
  };

  return (
    <>
      <TrainingInviteMeta id={id} sharedBy={sharedBy} />

      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md flex flex-col items-center text-center">
          <div
            className="w-24 h-24 rounded-3xl bg-[#E0FE10] flex items-center justify-center mb-8 shadow-lg"
            aria-hidden
          >
            <span className="text-5xl">🏆</span>
          </div>

          <h1 className="text-3xl font-bold mb-3">You're invited to 1-on-1 coaching</h1>
          <p className="text-white/70 mb-8">
            A Pulse coach has set up a private training room for the two of you.
            Open the app to accept the invite and start training together.
          </p>

          <button
            onClick={handleOpenApp}
            className="w-full py-4 bg-[#E0FE10] text-black font-bold rounded-xl mb-3 hover:bg-opacity-90 transition-opacity"
          >
            Open in Pulse
          </button>

          <a
            href={APP_STORE_URL}
            className="w-full py-4 border border-white/20 text-white font-semibold rounded-xl text-center hover:bg-white/5 transition-colors"
          >
            Get the app
          </a>

          {showInstallPrompt && (
            <p className="mt-6 text-sm text-white/60">
              Don't have Pulse installed? Tap <span className="text-white">Get the app</span> to download it,
              then tap your invite link again.
            </p>
          )}

          <p className="mt-12 text-xs text-white/40">
            Invite ID: <span className="font-mono">{id}</span>
          </p>
        </div>
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<OneOnOneInvitePageProps> = async ({ params, query, res }) => {
  const id = typeof params?.id === 'string' ? params.id : '';
  const sharedByRaw = query.sharedBy ?? query.sharedby;
  const sharedBy = typeof sharedByRaw === 'string' ? sharedByRaw : undefined;

  if (!id) {
    return { notFound: true };
  }

  // Cache aggressively — the page content is static for a given id.
  // The actual training doc is read by the iOS app, not here.
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  return {
    props: {
      id,
      ...(sharedBy ? { sharedBy } : {}),
    },
  };
};

export default OneOnOneInvitePage;
