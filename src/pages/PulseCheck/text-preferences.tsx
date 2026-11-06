import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';
import PhoneSignIn from '../../components/auth/PhoneSignIn';
import { SMS_CONSENT_TEXT } from '../../lib/coach-communications/consent-copy';

type Preferences = { enabled: boolean; explicitConsentRecorded: boolean; suppressed: boolean; phoneLast4: string | null; version: string; text: string };
type Team = { teamId: string; displayName: string };
export default function TextPreferences() {
  const router = useRouter();
  const teamId = typeof router.query.teamId === 'string' ? router.query.teamId : '';
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [data, setData] = useState<Preferences | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [phoneReady, setPhoneReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const request = useRef(0);

  useEffect(() => onAuthStateChanged(auth, next => { setUser(next); setAuthReady(true); }), []);
  async function load(accepted?: boolean) {
    const current = auth.currentUser;
    if (!current) return;
    const generation = ++request.current;
    setBusy(true); setError('');
    try {
      const token = await current.getIdTokenResult();
      if (generation !== request.current || auth.currentUser?.uid !== current.uid) return;
      const authTime = Number(token.claims.auth_time);
      setPhoneReady(token.signInProvider === 'phone' && Date.now() / 1000 - authTime < 600);
      const response = await fetch(`/api/pulsecheck/text-preferences${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`, {
        method: accepted === undefined ? 'GET' : 'POST', cache: 'no-store',
        headers: { Authorization: `Bearer ${token.token}`, ...getFirebaseModeRequestHeaders(), 'Content-Type': 'application/json' },
        ...(accepted === undefined ? {} : { body: JSON.stringify({ accepted, version: data?.version }) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Your texting choice is unavailable.');
      if (generation !== request.current || auth.currentUser?.uid !== current.uid) return;
      if (teamId) { setData(result); setChecked(false); if (accepted !== undefined) setSaved(true); }
      else setTeams(result.teams || []);
    } catch (e) { if (generation === request.current && auth.currentUser?.uid === current.uid) setError((e as Error).message); }
    finally { if (generation === request.current) setBusy(false); }
  }
  useEffect(() => {
    request.current += 1; setData(null); setTeams([]); setChecked(false); setSaved(false); setError(''); setPhoneReady(false); setBusy(false);
    if (user && router.isReady) void load();
    return () => { request.current += 1; };
  }, [user?.uid, teamId, router.isReady]);

  return <main className="min-h-screen bg-stone-50 px-5 py-12 text-stone-900">
    <Head><title>Team texts | AthleticMind and PulseCheck</title></Head>
    <section className="mx-auto max-w-xl space-y-6 rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
      <Link href="/PulseCheck?web=1" className="text-sm underline">Back to PulseCheck</Link>
      <div><p className="text-sm font-semibold">AthleticMind · PulseCheck</p><h1 className="mt-2 text-3xl font-semibold">Team texts</h1></div>
      <p>Choose whether your coach can text you team updates and app invitations. Sign in, choose your team, and verify your phone before saving your choice.</p>
      <p>{data?.text || SMS_CONSENT_TEXT}</p>
      <p className="text-sm"><Link href="/privacy" className="underline">Privacy Policy</Link> · <Link href="/terms" className="underline">Text messaging terms</Link> · <a href="mailto:info@fitwithpulse.ai" className="underline">Get help</a></p>
      {authReady && !user && <Link href="/PulseCheck/login?returnTo=%2FPulseCheck%2Ftext-preferences" className="inline-block rounded-lg bg-stone-900 px-5 py-3 font-semibold text-white">Sign in to choose</Link>}
      {user && !teamId && <div className="space-y-3"><h2 className="text-xl font-semibold">Choose your team</h2>{teams.map(team => <Link key={team.teamId} href={`/PulseCheck/text-preferences?teamId=${encodeURIComponent(team.teamId)}`} className="block rounded-lg border border-stone-300 px-4 py-3 font-medium">{team.displayName}</Link>)}{!busy && !error && teams.length === 0 && <p>Your account has no active athlete teams. Contact your coach if you need help joining.</p>}</div>}
      {error && <p role="alert" className="text-red-800">{error}</p>}
      {busy && <p role="status">Loading your texting choice…</p>}
      {user && data && <div className="space-y-5">
        <p role="status">{data.explicitConsentRecorded ? 'Your permission for team texts is saved.' : 'You have not saved permission for team texts on this screen.'}{data.phoneLast4 ? ` Phone ending in ${data.phoneLast4}.` : ''}</p>
        {saved && <p role="status">{data.explicitConsentRecorded ? 'Your choice is saved. Your coach can send team texts when messaging is available.' : 'Your choice is saved. Team texts are off.'}</p>}
        {data.suppressed ? <p>A previous STOP is active. Contact <a className="underline" href="mailto:info@fitwithpulse.ai">support</a> to review restarting texts.</p> : !data.explicitConsentRecorded && <>
          {!phoneReady && <div className="rounded-xl bg-stone-950 p-5 text-white"><h2 className="mb-3 text-lg font-semibold">Verify your phone</h2><p className="mb-4 text-sm text-stone-200">Use the phone connected to this account. Verification keeps your texting choice with the right account.</p><PhoneSignIn mode="verify" onSuccess={async () => { await load(); }} />{!user.phoneNumber && <Link href="/settings" className="mt-4 block text-sm underline">Connect your phone in account settings</Link>}</div>}
          <label className="flex items-start gap-3"><input aria-label="I agree to these optional team texts" className="mt-1 h-5 w-5" type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} disabled={busy} /><span>I agree to these optional team texts.</span></label>
          <button type="button" className="rounded-lg bg-stone-900 px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={busy || !checked || !phoneReady} onClick={() => void load(true)}>Save texting permission</button>
          {!phoneReady && <p className="text-sm">Verify your phone before saving. A verification code does not enroll you in team texts.</p>}
        </>}
        {data.enabled && <button type="button" className="block rounded-lg border border-stone-400 px-5 py-3 font-medium disabled:opacity-50" disabled={busy} onClick={() => void load(false)}>Turn team texts off</button>}
        <Link href="/PulseCheck/text-preferences" className="block text-sm underline">Choose another team</Link>
      </div>}
    </section>
  </main>;
}
