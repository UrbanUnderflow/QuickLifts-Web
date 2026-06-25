//
// /macra/buddy/[token]
//
// Landing page for Macra buddy invite links. iMessage and other crawlers
// read the `ogMeta` emitted from getServerSideProps so the preview looks
// like a real invite card instead of falling back to generic app metadata.
// Taps still route into Macra through the custom scheme when universal
// links do not intercept first.
//
import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import React, { useEffect, useMemo, useState } from 'react';

interface MacraBuddyInvitePageProps {
  token: string;
}

const APP_STORE_URL = 'https://apps.apple.com/us/app/macra-ai-calorie/id6463771067';
const OG_TITLE = 'Eat with me on Macra';
const OG_DESCRIPTION =
  'Follow my food journal and share daily eating habits with me on Macra.';
const OG_IMAGE_URL = 'https://fitwithpulse.ai/preview/macra-buddy.png';

const MacraBuddyInvitePage: NextPage<MacraBuddyInvitePageProps> = ({ token }) => {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const pageUrl = useMemo(
    () => `https://fitwithpulse.ai/macra/buddy/${encodeURIComponent(token)}`,
    [token]
  );
  const deepLinkUrl = useMemo(
    () => `macra://buddy/${encodeURIComponent(token)}`,
    [token]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as { MSStream?: unknown }).MSStream;
    if (!isIOS) return;

    window.location.href = deepLinkUrl;
    const timer = window.setTimeout(() => setShowInstallPrompt(true), 1500);
    return () => window.clearTimeout(timer);
  }, [deepLinkUrl]);

  const handleOpenApp = () => {
    if (typeof window !== 'undefined') {
      window.location.href = deepLinkUrl;
    }
  };

  return (
    <>
      <Head>
        <title>{OG_TITLE}</title>
        <meta name="description" content={OG_DESCRIPTION} />
        <meta property="og:title" content={OG_TITLE} />
        <meta property="og:description" content={OG_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:site_name" content="Macra" />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Macra buddy invite" />
        <meta property="al:ios:app_store_id" content="6463771067" />
        <meta property="al:ios:app_name" content="Macra: AI Calorie" />
        <meta property="al:ios:url" content={deepLinkUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={OG_TITLE} />
        <meta name="twitter:description" content={OG_DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE_URL} />
        <link rel="canonical" href={pageUrl} />
        <meta name="theme-color" content="#E0FE10" />
      </Head>

      <main className="min-h-screen bg-[#070A07] text-white flex items-center justify-center px-6 py-12">
        <section className="w-full max-w-md text-center">
          <div
            className="mx-auto mb-8 h-24 w-24 rounded-[28px] bg-[#E0FE10] text-5xl flex items-center justify-center shadow-[0_24px_80px_rgba(224,254,16,0.28)]"
            aria-hidden
          >
            <span>🍽️</span>
          </div>

          <p className="mb-3 text-xs font-black tracking-[0.24em] text-[#E0FE10]">
            MACRA BUDDY INVITE
          </p>
          <h1 className="mb-4 text-4xl font-black tracking-normal">Eat with me on Macra</h1>
          <p className="mb-8 text-base leading-7 text-white/70">
            Follow this buddy's meal journal, see their daily habits, and keep nutrition
            accountability simple.
          </p>

          <button
            onClick={handleOpenApp}
            className="mb-3 w-full rounded-xl bg-[#E0FE10] py-4 font-black text-black transition-opacity hover:opacity-90"
          >
            Open in Macra
          </button>

          <a
            href={APP_STORE_URL}
            className="block w-full rounded-xl border border-white/15 py-4 font-bold text-white transition-colors hover:bg-white/5"
          >
            Get Macra
          </a>

          {showInstallPrompt && (
            <p className="mt-6 text-sm text-white/55">
              Do not have Macra installed yet? Get the app, then tap your buddy invite
              again.
            </p>
          )}
        </section>
      </main>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<MacraBuddyInvitePageProps> = async ({
  params,
  res,
}) => {
  const token = typeof params?.token === 'string' ? params.token : '';

  if (!token) {
    return { notFound: true };
  }

  const pageUrl = `https://fitwithpulse.ai/macra/buddy/${encodeURIComponent(token)}`;
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  return {
    props: {
      token,
      ogMeta: {
        title: OG_TITLE,
        description: OG_DESCRIPTION,
        image: OG_IMAGE_URL,
        url: pageUrl,
        type: 'website',
        siteName: 'Macra',
      },
    } as MacraBuddyInvitePageProps & {
      ogMeta: {
        title: string;
        description: string;
        image: string;
        url: string;
        type: string;
        siteName: string;
      };
    },
  };
};

export default MacraBuddyInvitePage;
