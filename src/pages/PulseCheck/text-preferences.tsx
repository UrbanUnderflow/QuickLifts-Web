import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
type Preferences = { enabled: boolean; suppressed: boolean; phoneLast4: string | null; version: string; text: string };
export default function TextPreferences() {
  const router = useRouter(), teamId = typeof router.query.teamId === 'string' ? router.query.teamId : '';
  const [data,setData] = useState<Preferences | null>(null),[error,setError] = useState(''),[busy,setBusy] = useState(false),[checked,setChecked] = useState(false);
  async function load(accepted?: boolean) {
    if (!teamId) return;
    setBusy(true); setError('');
    try {
      const token = await auth.currentUser?.getIdToken(); if (!token) throw new Error('Sign in to manage your team texts.');
      const response = await fetch(`/api/pulsecheck/text-preferences?teamId=${encodeURIComponent(teamId)}`, { method: accepted === undefined ? 'GET' : 'POST', cache:'no-store', headers: { Authorization:`Bearer ${token}`, ...getFirebaseModeRequestHeaders(), 'Content-Type':'application/json' }, ...(accepted === undefined ? {} : {body:JSON.stringify({accepted,version:data?.version})}) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Your texting choice is unavailable.');setData(result);setChecked(false);
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => onAuthStateChanged(auth, () => { if (teamId) void load(); }),[teamId]);
  return <main className="min-h-screen bg-stone-50 px-5 py-12 text-stone-900"><section className="mx-auto max-w-xl rounded-2xl border bg-white p-7 space-y-5"><h1 className="text-3xl font-semibold">Team texts</h1><p>Choose whether your coach can text you team updates and app invitations.</p>{!teamId && <p>Open this page from your team's texting preferences link.</p>}{error && <p role="alert">{error}</p>}{data && <><p role="status">Texts are {data.enabled?'on':'off'}{data.phoneLast4 ? ` for the number ending in ${data.phoneLast4}` : ''}.</p>{data.suppressed && <p>A previous STOP is active. Contact support to review restarting texts.</p>}<p>{data.text}</p>{!data.enabled && <label className="flex gap-3"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} disabled={busy || data.suppressed} /><span>I agree to these optional team texts.</span></label>}<button type="button" className="rounded-lg bg-stone-900 px-5 py-3 text-white disabled:opacity-50" disabled={busy || (!data.enabled && (!checked || data.suppressed))} onClick={()=>void load(!data.enabled)}>{busy?'Saving…':data.enabled?'Turn texts off':'Turn texts on'}</button><p className="text-sm">Turning texts on requires a recent sign-in with your verified phone. You can turn texts off without receiving a code.</p></>}</section></main>;
}
