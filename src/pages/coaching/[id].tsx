import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

// Buyer-facing checkout for a paid 1-on-1 coaching room. The app opens
// this page (https://fitwithpulse.ai/coaching/{trainingId}?buyer={userId}).
// We resolve the coach + price, then redirect to Stripe-hosted Checkout
// (one-time or subscription based on the room's pricing mode). On
// success Stripe returns to ?status=success, where we deep-link back to
// the app so the (now-unlocked) room opens.

interface TrainingInfo {
  trainingId: string;
  clubName: string;
  status: string;
  paymentStatus: string;
  coachUsername: string;
  coachProfileImage: string;
  inviteMessage: string;
  mode: 'oneTime' | 'recurring' | null;
  interval: 'week' | 'month' | 'year' | null;
  priceLabel: string | null;
}

const LIME = '#E0FE10';

// Deep-link back into the app to open the now-unlocked room. Uses the
// Firebase Dynamic Link wrapper around the /1on1/{id} universal link
// (handled by AppState.extractOneOnOneLinkContext), with App Store
// fallback for users without the app.
const openApp = (trainingId: string) => {
  const target = `https://fitwithpulse.ai/1on1/${trainingId}`;
  const encoded = encodeURIComponent(target);
  window.location.href = `https://quicklifts.page.link/?link=${encoded}&apn=com.pulse.fitnessapp&ibi=Tremaine.QuickLifts&isi=6451497729`;
};

export default function CoachingCheckoutPage() {
  const router = useRouter();
  const { id, buyer, status } = router.query as { id?: string; buyer?: string; status?: string };

  const [info, setInfo] = useState<TrainingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/.netlify/functions/get-1on1-training?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setInfo(data);
      })
      .catch(() => setError('Could not load this coaching room.'))
      .finally(() => setLoading(false));
  }, [id]);

  const startCheckout = async () => {
    if (!info || !id || !buyer) return;
    setRedirecting(true);
    setError(null);
    try {
      const fn = info.mode === 'recurring'
        ? 'create-1on1-subscription-checkout'
        : 'create-1on1-checkout';
      const res = await fetch(`/.netlify/functions/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainingId: id, buyerId: buyer })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Could not start checkout.');
        setRedirecting(false);
      }
    } catch (e) {
      setError('Could not start checkout.');
      setRedirecting(false);
    }
  };

  const card: React.CSSProperties = {
    maxWidth: 420,
    margin: '0 auto',
    background: '#18181b',
    borderRadius: 18,
    padding: 28,
    border: '1px solid rgba(255,255,255,0.08)'
  };
  const cta: React.CSSProperties = {
    width: '100%',
    padding: '14px 0',
    background: LIME,
    color: '#000',
    fontWeight: 800,
    fontSize: 16,
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer'
  };

  // --- Success state -------------------------------------------------
  if (status === 'success') {
    const step: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 16 };
    const num: React.CSSProperties = {
      flex: '0 0 auto', width: 26, height: 26, borderRadius: 13, background: LIME,
      color: '#000', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center'
    };
    const stepText: React.CSSProperties = { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.4 };
    return (
      <Shell>
        <div style={card}>
          <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>✅</div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, textAlign: 'center', margin: 0 }}>
            Payment complete!
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 8, fontSize: 14 }}>
            One last thing to unlock your private training room:
          </p>

          <div style={step}>
            <div style={num}>1</div>
            <div style={stepText}><b style={{ color: '#fff' }}>Get the Fit With Pulse app</b> (free) if you don&apos;t have it yet.</div>
          </div>
          <div style={step}>
            <div style={num}>2</div>
            <div style={stepText}><b style={{ color: '#fff' }}>Create your account</b> (or sign in) — use the same email if you can.</div>
          </div>
          <div style={step}>
            <div style={num}>3</div>
            <div style={stepText}><b style={{ color: '#fff' }}>Tap your invite link again.</b> Now that you&apos;ve paid, it drops you straight into your training room with your plan.</div>
          </div>

          <a
            href="https://apps.apple.com/app/id6451497729"
            style={{ ...cta, marginTop: 22, display: 'block', textDecoration: 'none', textAlign: 'center', lineHeight: '20px' }}
          >
            Download Fit With Pulse
          </a>
          <button
            style={{
              width: '100%', padding: '13px 0', marginTop: 10, background: 'transparent',
              color: LIME, fontWeight: 700, fontSize: 14, border: `1px solid rgba(224,254,16,0.4)`,
              borderRadius: 12, cursor: 'pointer'
            }}
            onClick={() => id && openApp(String(id))}
          >
            I already have the app — open my room
          </button>
        </div>
      </Shell>
    );
  }

  // --- Cancelled state ----------------------------------------------
  if (status === 'cancelled') {
    return (
      <Shell>
        <div style={card}>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, textAlign: 'center', margin: 0 }}>
            Checkout canceled
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginTop: 8 }}>
            No charge was made. You can try again anytime.
          </p>
          <button style={{ ...cta, marginTop: 20 }} onClick={() => router.replace(`/coaching/${id}?buyer=${buyer || ''}`)}>
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  // --- Loading / error ----------------------------------------------
  if (loading) {
    return <Shell><p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p></Shell>;
  }
  if (error || !info) {
    return (
      <Shell>
        <div style={card}>
          <p style={{ color: '#ff6b6b', textAlign: 'center' }}>{error || 'Coaching room not found.'}</p>
        </div>
      </Shell>
    );
  }

  // Free room — nothing to pay for; bounce into the app.
  if (!info.mode) {
    return (
      <Shell>
        <div style={card}>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 800, textAlign: 'center', margin: 0 }}>
            This room is free
          </h1>
          <button style={{ ...cta, marginTop: 20 }} onClick={() => id && openApp(String(id))}>
            Open in app
          </button>
        </div>
      </Shell>
    );
  }

  // --- Checkout state -----------------------------------------------
  return (
    <Shell>
      <div style={card}>
        <div style={{ textAlign: 'center' }}>
          {info.coachProfileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={info.coachProfileImage}
              alt={info.coachUsername}
              style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${LIME}` }}
            />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#27272a', margin: '0 auto' }} />
          )}
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginTop: 14, marginBottom: 2 }}>
            Train 1-on-1 with @{info.coachUsername}
          </h1>
          {info.clubName ? (
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>{info.clubName}</p>
          ) : null}
        </div>

        {info.inviteMessage ? (
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 18, lineHeight: 1.5 }}>
            “{info.inviteMessage}”
          </p>
        ) : null}

        <div style={{
          marginTop: 18, padding: '14px 16px', background: 'rgba(224,254,16,0.08)',
          border: `1px solid rgba(224,254,16,0.25)`, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>
            {info.mode === 'recurring' ? 'Auto-pay subscription' : 'One-time payment'}
          </span>
          <span style={{ color: LIME, fontSize: 18, fontWeight: 800 }}>{info.priceLabel}</span>
        </div>

        <button style={{ ...cta, marginTop: 18, opacity: redirecting ? 0.6 : 1 }} disabled={redirecting} onClick={startCheckout}>
          {redirecting
            ? 'Redirecting…'
            : info.mode === 'recurring'
              ? `Start ${info.priceLabel}`
              : `Pay ${info.priceLabel} & unlock`}
        </button>

        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 12 }}>
          {info.mode === 'recurring' ? 'Cancel anytime. ' : ''}Secured by Stripe.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#000', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      {children}
    </div>
  );
}
