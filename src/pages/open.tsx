import React, { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { appLinks, openIOSAppOrStore, platformDetection } from '../utils/platformDetection';

/**
 * Email-safe "smart open" page:
 * - iOS: attempts to open the app via `pulse://...`, falls back to App Store
 * - Other platforms: shows a simple page with the App Store link
 *
 * Usage:
 * - `https://fitwithpulse.ai/open` (defaults to `pulse://`)
 * - `https://fitwithpulse.ai/open?dl=pulse://creator-onboarding`
 */
const OpenApp: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;

    const dlParam = router.query.dl;
    const deepLink = typeof dlParam === 'string' && dlParam.trim() ? dlParam.trim() : appLinks.pulseScheme;

    if (platformDetection.isIOS()) {
      openIOSAppOrStore(deepLink, appLinks.appStoreUrl);
    }
  }, [router.isReady, router.query.dl]);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-6">
      <Head>
        <title>Open Pulse</title>
      </Head>

      <div className="w-full max-w-md bg-zinc-900/60 border border-white/10 rounded-2xl p-6 text-center backdrop-blur-xl">
        <div className="w-12 h-12 bg-[#E0FE10] rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-black font-bold text-xl">P</span>
        </div>
        <h1 className="text-xl font-bold mb-2">Open Pulse</h1>
        <p className="text-zinc-400 text-sm mb-5">
          If Pulse is installed, this page will open the app. If not, you can download it from the App Store.
        </p>

        <div className="flex flex-col gap-3">
          <a
            href={appLinks.pulseScheme}
            className="w-full py-3 rounded-xl bg-[#E0FE10] text-black font-bold"
          >
            Open the app
          </a>
          <a
            href={appLinks.appStoreUrl}
            className="w-full py-3 rounded-xl bg-zinc-800 text-white font-semibold"
          >
            Get Pulse on the App Store
          </a>
        </div>

        <p className="text-zinc-500 text-xs mt-4">
          Having trouble? Try opening in Safari.
        </p>
      </div>
    </div>
  );
};

export default OpenApp;

