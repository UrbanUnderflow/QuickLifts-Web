import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

const CheckoutRedirectPage = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const params = router.query as Record<string, string | string[] | undefined>;

  const targetUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const type = typeof params.type === 'string' ? params.type : 'athlete';
    const userId = typeof params.userId === 'string' ? params.userId : '';
    const priceId = typeof params.priceId === 'string' ? params.priceId : '';
    const email = typeof params.email === 'string' ? params.email : '';
    const coachReferralCode = typeof params.coachReferralCode === 'string' ? params.coachReferralCode : '';
    const debug = typeof params.debug === 'string' ? params.debug : '';

    const q = new URLSearchParams();
    if (userId) q.set('userId', userId);
    if (priceId) q.set('priceId', priceId);
    if (email) q.set('email', email);
    if (coachReferralCode) q.set('coachReferralCode', coachReferralCode);
    if (debug) q.set('debug', debug);

    // Choose the correct Netlify function endpoint; function performs a 302 to Stripe
    if (type === 'subscribe' || type === 'athlete') {
      return `/.netlify/functions/create-athlete-checkout-session?${q.toString()}`;
    }
    // Fallback to generic
    return `/.netlify/functions/create-checkout-session?${q.toString()}`;
  }, [params]);

  useEffect(() => {
    if (!targetUrl) return;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isInApp = /FBAN|FBAV|Instagram|LinkedInApp|Twitter|Outlook|Mail|Messenger|Snapchat|Pinterest/i.test(ua);

    try {
      if (isInApp) {
        // In-app browsers behave best with same-tab navigation
        window.location.replace(targetUrl);
      } else {
        // Try same-tab navigation first; it avoids about:blank flicker entirely
        window.location.assign(targetUrl);
      }
    } catch (e: any) {
      setError(e?.message || 'Navigation blocked');
    }
  }, [targetUrl]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="animate-pulse text-sm text-zinc-400 mb-4">Preparing secure checkout…</div>
        <div className="text-lg font-semibold mb-3">Redirecting to Stripe</div>
        <p className="text-zinc-400 text-sm mb-6">This page will take you to our secure payment provider. If nothing happens, tap the button below.</p>
        <a
          href={targetUrl || '#'}
          className="inline-block px-5 py-3 rounded-lg bg-[#E0FE10] text-black font-semibold"
        >
          Continue to Payment
        </a>
        {error && (
          <div className="mt-4 text-xs text-red-400">{error}</div>
        )}
      </div>
    </div>
  );
};

export default CheckoutRedirectPage;


