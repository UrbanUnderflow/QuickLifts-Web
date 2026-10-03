import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
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
  return <><Head><title>{billing?.team?.name || 'Team'} | Payment</title><meta name="robots" content="noindex" /></Head>
    <main><section aria-busy={busy}>
      {billing?.team?.logoUrl && <img className="logo" src={billing.team.logoUrl} alt={`${billing.team.name} logo`} />}
      <p className="eyebrow">{billing?.team?.name || 'Your team'}</p>
      <h1>{active ? 'You’re ready to train.' : 'Keep training with your team.'}</h1>
      {!ready && <p>Loading your account…</p>}
      {ready && !user && <><p>Sign in with the account you use in the app to review your team payment.</p><form onSubmit={event => { event.preventDefault(); void signIn(); }}><label>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label><button disabled={busy}>Sign in</button></form><button className="secondary" disabled={busy} onClick={() => void signIn('google')}>Continue with Google</button><button className="secondary" disabled={busy} onClick={() => void signIn('apple')}>Continue with Apple</button></>}
      {user && !billing && !error && <p>Checking your team and payment details…</p>}
      {billing?.isTeamAthlete && <>
        {price && <p className="price">{price}<span> / month</span></p>}
        <p>{active ? 'Your team subscription is active. Return to the app to continue.' : billing.paymentUrl ? 'Review your payment securely to restore your team access. Your team’s monthly price is shown above.' : 'Your team manages your access. Contact your coach for help getting back in.'}</p>
        {!active && billing.price && billing.paymentUrl && <button disabled={busy} onClick={() => void pay()}>{busy ? 'Opening secure payment…' : 'Review payment'}</button>}
        {router.query.checkout === 'complete' && !active && <p role="status">Your payment is being confirmed. Refresh your access in a moment.</p>}
        <button className="secondary" disabled={busy} onClick={() => void refresh()}>Refresh access</button>
        <a href="pulsecheck://open">Return to the app</a>
      </>}
      {billing && !billing.isTeamAthlete && <p>We couldn’t find a team for this account. Sign in with your athlete account or contact your coach.</p>}
      {error && <><p role="alert">{error}</p>{user && <button className="secondary" disabled={busy} onClick={() => void refresh()}>Try again</button>}</>}
      <p className="footer">Secure payment through Stripe</p>{user && <button className="secondary" disabled={busy} onClick={() => void signOut(auth)}>Use a different account</button>}
    </section></main>
    <style jsx>{`
      main{min-height:100vh;background:#f5f2eb;display:flex;align-items:center;justify-content:center;padding:32px 20px;color:#192b26;font-family:system-ui,sans-serif}section{width:100%;max-width:480px;background:white;padding:38px;border-radius:24px;border-top:6px solid ${billing?.team?.primaryColor || '#24483F'};box-shadow:0 12px 48px #1527200c}.logo{width:76px;height:76px;object-fit:contain;margin-bottom:20px}.eyebrow{font-weight:700;font-size:14px}h1{font-size:34px;line-height:1.12;margin:16px 0 24px;letter-spacing:-1px}p{line-height:1.6}.price{font-size:36px;font-weight:700;margin-bottom:10px}.price span{font-size:16px;font-weight:400}label{display:block;margin:18px 0;font-size:14px}input{display:block;width:100%;padding:12px;margin-top:8px;border:1px solid #86968e;border-radius:8px}button{display:block;width:100%;padding:14px;border:0;border-radius:10px;background:#24483f;color:white;font-size:16px;font-weight:600;margin:14px 0;cursor:pointer}button:disabled{opacity:.6;cursor:wait}.secondary{background:#eef2ef;color:#192b26}a{display:block;text-align:center;color:#24483f;padding:12px}.footer{font-size:12px;color:#53665e;text-align:center;margin-top:28px}[role=alert]{color:#9b2727}@media(max-width:480px){section{padding:26px}h1{font-size:30px}}
    `}</style></>;
}
