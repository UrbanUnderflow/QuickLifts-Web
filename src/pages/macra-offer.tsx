import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

type OfferParams = {
  userId: string;
  campaignId: string;
  plan: string;
  expiresAt: number;
  expiresAtRaw: string;
  signature: string;
  test: string;
};

const normalizeQueryValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
};

const buildCheckoutBridgeUrl = (offerParams: OfferParams) => {
  const target = new URL('/.netlify/functions/create-macra-web-offer-checkout', window.location.origin);
  target.searchParams.set('uid', offerParams.userId);
  target.searchParams.set('campaign', offerParams.campaignId);
  target.searchParams.set('plan', offerParams.plan);
  target.searchParams.set('expires', offerParams.expiresAtRaw);
  target.searchParams.set('sig', offerParams.signature);
  if (offerParams.test) {
    target.searchParams.set('test', offerParams.test);
  }
  return target.toString();
};

const MacraOfferPage: React.FC = () => {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState('');
  const redirectStartedRef = useRef(false);

  const offerParams = useMemo<OfferParams | null>(() => {
    if (!router.isReady) return null;

    const userId = normalizeQueryValue(router.query.uid || router.query.userId);
    const campaignId = normalizeQueryValue(router.query.campaign || router.query.campaignId);
    const plan = normalizeQueryValue(router.query.plan) || 'monthly';
    const expiresAtRaw = normalizeQueryValue(router.query.expires || router.query.expiresAt);
    const signature = normalizeQueryValue(router.query.sig || router.query.signature);
    const test = normalizeQueryValue(router.query.test);
    const expiresAt = Number(expiresAtRaw);

    if (!userId || !campaignId || !expiresAtRaw || !signature || !Number.isFinite(expiresAt)) {
      return null;
    }

    return { userId, campaignId, plan, expiresAt, expiresAtRaw, signature, test };
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!router.isReady || !offerParams || redirectStartedRef.current) {
      return;
    }

    if (Date.now() > offerParams.expiresAt) {
      setError('This offer link has expired. Open the latest Macra offer email and tap the button again.');
      return;
    }

    redirectStartedRef.current = true;
    setIsRedirecting(true);
    setError('');
    window.location.replace(buildCheckoutBridgeUrl(offerParams));
  }, [offerParams, router.isReady]);

  const missingParams = router.isReady && !offerParams;
  const checkingOffer = !router.isReady || (!!offerParams && !error);

  return (
    <>
      <Head>
        <title>Start Macra Offer | Macra</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="min-h-screen bg-[#080b08] text-white flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/macra-icon.png" alt="Macra" className="w-12 h-12 rounded-2xl" />
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[#b8ff5c] font-black">Macra offer</p>
              <h1 className="text-2xl font-black">Start your free month</h1>
            </div>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            {checkingOffer || isRedirecting ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-[#e0fe10] mx-auto mb-4" />
                <h2 className="text-xl font-black mb-2">Opening secure checkout</h2>
                <p className="text-zinc-400 text-sm">
                  You are being sent directly to Stripe. Your free month will be applied to the account that received
                  this offer after checkout.
                </p>
              </div>
            ) : missingParams ? (
              <div className="text-center py-8">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-black mb-2">This offer link is incomplete.</h2>
                <p className="text-zinc-400 text-sm">Open the latest Macra offer email and tap the button again.</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-black mb-2">We could not open checkout.</h2>
                <p className="text-zinc-400 text-sm">{error || 'Open the latest Macra offer email and try again.'}</p>
              </div>
            )}
          </section>

          <a
            href="/Macra"
            className="mt-5 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-[#e0fe10] transition-colors"
          >
            Back to Macra
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </main>
    </>
  );
};

export default MacraOfferPage;
