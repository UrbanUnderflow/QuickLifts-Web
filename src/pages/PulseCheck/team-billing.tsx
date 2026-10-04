import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import PaymentHistory from '../../components/pulsecheck/billing/PaymentHistory';
import { ArrowRight, CheckCircle2, LockKeyhole, Loader2 } from 'lucide-react';
import styles from './team-billing.module.css';
import { useRouter } from 'next/router';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, OAuthProvider, signOut, User } from 'firebase/auth';
import { auth, getFirebaseModeRequestHeaders, isUsingDevFirebase, setPreferredFirebaseMode } from '../../api/firebase/config';

type Billing = { isTeamAthlete: boolean; team?: { id: string; name: string; logoUrl?: string; primaryColor?: string }; price?: { amountCents: number; currency: string }; status?: string; commercialModel?: string; paymentUrl?: string | null };
export default function TeamBillingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const teamId = typeof router.query.teamId === 'string' ? router.query.teamId : '';
  useEffect(() => {
    if (router.isReady && router.query.devFirebase === '1' && !isUsingDevFirebase()) {
      setPreferredFirebaseMode(true);
      window.location.reload();
    }
  }, [router.isReady, router.query.devFirebase]);
  useEffect(() => onAuthStateChanged(auth, value => { setUser(value); setReady(true); setBilling(null); }), []);
  const request = useCallback(async (name: string, body: object) => {
    if (!user) throw new Error('Sign in to review your team payment.');
    const response = await fetch(`/.netlify/functions/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...getFirebaseModeRequestHeaders(), Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'We could not load your team payment. Please try again.');
    return data;
  }, [user]);
  const refresh = useCallback(async () => {
    setError(''); setBusy(true);
    try { setBilling(await request('get-pulsecheck-athlete-billing-context', { teamId })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { setBusy(false); }
  }, [request, teamId]);
  useEffect(() => { if (user && router.isReady) void refresh(); }, [user, router.isReady, refresh]);
  const signIn = async (provider?: 'google' | 'apple') => {
    setBusy(true); setError('');
    try { if (provider) await signInWithPopup(auth, provider === 'google' ? new GoogleAuthProvider() : new OAuthProvider('apple.com')); else await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch { setError('We could not sign you in. Check your details and try again.'); }
    finally { setBusy(false); }
  };
  const pay = async () => {
    setBusy(true); setError('');
    try {
      const result = await request('create-athlete-checkout-session', { source: 'pulsecheck-coach-athlete-offer', teamBilling: true, teamId: billing?.team?.id });
      const url = new URL(result.url);
      if (url.protocol !== 'https:' || !['checkout.stripe.com', 'invoice.stripe.com'].includes(url.hostname)) throw new Error('The secure payment link is unavailable. Please try again.');
      window.location.assign(url.href);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again.'); setBusy(false); }
  };
  const active = billing?.status === 'active' || billing?.status === 'trialing';
  const price = billing?.price ? new Intl.NumberFormat('en-US', { style: 'currency', currency: billing.price.currency }).format(billing.price.amountCents / 100) : '';
  return (
    <div className={styles.page}>
      <Head>
        <title>{billing?.team?.name || 'Team'} | Payment</title>
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#050506" />
      </Head>
      <header className={styles.header}>
        <a className={styles.brand} href="/PulseCheck" aria-label="PulseCheck home">
          <img className={styles.wordmark} src="/pulsecheck-wordmark-green.png" alt="PulseCheck" width={2400} height={379} />
        </a>
        <span className={styles.secureLabel}><LockKeyhole size={13} /> Secure payment</span>
      </header>
      <main className={styles.main}>
        <section className={styles.card} aria-busy={busy} aria-labelledby="payment-title">
          <div className={styles.identity}>
            {billing?.team?.logoUrl
              ? <img className={styles.logo} src={billing.team.logoUrl} alt={`${billing.team.name} logo`} />
              : <span className={styles.sectionIcon}>{active ? <CheckCircle2 size={22} /> : <LockKeyhole size={22} />}</span>}
            <p className={styles.eyebrow}>{billing?.team?.name || 'Team membership'}</p>
          </div>
          <h1 id="payment-title">{active ? 'You’re ready to train.' : user ? 'Your team. Your training.' : 'Get back to your team.'}</h1>
          {!ready && <p className={styles.loading} role="status"><Loader2 size={18} className={styles.spinner} /> Loading your account…</p>}
          {ready && !user && <>
            <p className={styles.description}>Sign in with your app account to review your team payment.</p>
            <div className={styles.providers}>
              <button className={styles.secondary} disabled={busy} onClick={() => void signIn('google')}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>Google
              </button>
              <button className={styles.secondary} disabled={busy} onClick={() => void signIn('apple')}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>Apple
              </button>
            </div>
            <div className={styles.divider}><span>or continue with email</span></div>
            <form className={styles.form} onSubmit={event => { event.preventDefault(); void signIn(); }}>
              <label>Email<input type="email" inputMode="email" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" required value={email} onChange={event => setEmail(event.target.value)} /></label>
              <label>Password<input type="password" autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
              <button className={styles.primary} disabled={busy}>{busy ? <><Loader2 size={18} className={styles.spinner} /> Signing in…</> : <>Sign in and continue <ArrowRight size={18} /></>}</button>
            </form>
          </>}
          {user && !billing && !error && <p className={styles.loading} role="status"><Loader2 size={18} className={styles.spinner} /> Checking your team payment…</p>}
          {billing?.isTeamAthlete && <>
            <p className={styles.description}>{active ? 'Your team subscription is active. Return to the app to continue.' : billing.paymentUrl ? 'Review your payment to restore your team access.' : 'Your team manages your access. Contact your coach for help getting back in.'}</p>
            {price && <div className={styles.plan}><span>Team subscription</span><p>{price}<span> / month</span></p><span>{billing.team?.name}</span></div>}
            <div className={styles.actions}>
              {!active && billing.price && billing.paymentUrl && <button className={styles.primary} disabled={busy} onClick={() => void pay()}>{busy ? <><Loader2 size={18} className={styles.spinner} /> Opening secure payment…</> : <>Review payment <ArrowRight size={18} /></>}</button>}
              {router.query.checkout === 'complete' && !active && <p className={styles.notice} role="status">Your payment is being confirmed. Refresh your access in a moment.</p>}
              <button className={styles.secondary} disabled={busy} onClick={() => void refresh()}>Refresh access</button>
              <a className={styles.textLink} href="pulsecheck://open">Return to the app <ArrowRight size={16} /></a>
            </div>
          </>}
          {billing && !billing.isTeamAthlete && <p className={styles.description}>We couldn’t find a team for this account. Sign in with your athlete account or contact your coach.</p>}
          {error && <div className={styles.error}><p role="alert">{error}</p>{user && <button className={styles.secondary} disabled={busy} onClick={() => void refresh()}>Try again</button>}</div>}
          {user && <button className={styles.accountSwitch} disabled={busy} onClick={() => void signOut(auth)}>Use a different account</button>}
        </section>
        {user && billing?.isTeamAthlete && billing.team && <PaymentHistory key={`${user.uid}:${billing.team.id}`} teamId={billing.team.id} request={request} />}
        <p className={styles.footer}><LockKeyhole size={13} /> Payments secured by Stripe</p>
      </main>
    </div>
  );
}
