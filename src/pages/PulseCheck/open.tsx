import React, { useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowRight, ExternalLink, Smartphone } from 'lucide-react';
import { useRouter } from 'next/router';
import { openIOSAppOrStore, platformDetection } from '../../utils/platformDetection';

const DEFAULT_PULSECHECK_DEEP_LINK = 'pulsecheck://open';
const DEFAULT_PULSECHECK_IOS_APP_STORE_URL = 'https://apps.apple.com/by/app/pulsecheck-mindset-coaching/id6747253393';
const DEFAULT_PULSECHECK_WEB_URL = '/PulseCheck';

const normalizeQueryValue = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value.trim() : '';

const toWebFallbackUrl = (value: string) => {
  if (!value) return DEFAULT_PULSECHECK_WEB_URL;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return value;
  return DEFAULT_PULSECHECK_WEB_URL;
};

const PulseCheckOpenPage: React.FC = () => {
  const router = useRouter();

  const deepLinkUrl = normalizeQueryValue(router.query.dl) || DEFAULT_PULSECHECK_DEEP_LINK;
  const iosAppUrl = normalizeQueryValue(router.query.ios) || DEFAULT_PULSECHECK_IOS_APP_STORE_URL;
  const webFallbackUrl = toWebFallbackUrl(normalizeQueryValue(router.query.web));

  useEffect(() => {
    if (!router.isReady) return;
    if (!platformDetection.isIOS()) return;

    openIOSAppOrStore(deepLinkUrl, iosAppUrl);
  }, [deepLinkUrl, iosAppUrl, router.isReady]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_45%),#070b12] px-6 py-10 text-white">
      <Head>
        <title>Open PulseCheck</title>
      </Head>

      <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[32px] border border-cyan-400/15 bg-[#0b111a]/95 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(8,11,18,0.92))] px-8 py-8">
            <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
              PulseCheck
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Opening the app…</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
              If PulseCheck is installed on your iPhone, this page will try to open it automatically. If not, use the
              App Store button below and then come back to this message.
            </p>
          </div>

          <div className="grid gap-6 px-8 py-8 lg:grid-cols-[minmax(0,1fr),280px]">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Having trouble?</div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-300">
                <p>Try tapping the button below once more after this page loads.</p>
                <p>If you are in Gmail or another mail app, opening this page in Safari can help the app handoff succeed.</p>
                <p>After the app opens, sign in with the same email address that received the invite.</p>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href={deepLinkUrl}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d7ff00] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#c5eb00]"
                >
                  Open PulseCheck
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href={iosAppUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                >
                  <Smartphone className="h-4 w-4" />
                  Download on iPhone
                </a>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#0f1622] p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Alternate path</div>
              <p className="mt-4 text-sm leading-7 text-zinc-300">
                If you’re opening this from a desktop or want to confirm your account is active first, you can continue
                into the PulseCheck web experience.
              </p>
              <div className="mt-6">
                {webFallbackUrl.startsWith('http') ? (
                  <a
                    href={webFallbackUrl}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
                  >
                    Open PulseCheck Web
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <Link
                    href={webFallbackUrl}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
                  >
                    Open PulseCheck Web
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default PulseCheckOpenPage;
