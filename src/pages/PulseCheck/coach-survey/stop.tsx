import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
export default function StopCoachSurveys() {
  const token = useRef(''); const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => { token.current ||= new URLSearchParams(window.location.hash.slice(1)).get('token') || ''; if (window.location.hash) window.history.replaceState(null, '', window.location.pathname); }, []);
  async function stop() {
    setBusy(true); setStatus('');
    try {
      const res = await fetch('/api/pulsecheck/coach-survey/stop', { method: 'POST', cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${token.current}` } });
      const result = await res.json(); if (!res.ok) throw Error(result.error); setDone(true); setStatus('Your survey reminders are off.');
    } catch (error) { setStatus((error as Error).message || 'Please try again.'); } finally { setBusy(false); }
  }
  return <><Head><title>Manage survey reminders | PulseCheck</title><meta name="referrer" content="no-referrer" /><meta name="robots" content="noindex,nofollow" /></Head><main style={{ maxWidth: 600, margin: '60px auto', padding: 24, fontFamily: 'Arial', lineHeight: 1.6 }}><h1>Manage survey reminders</h1><p>Stop recurring coach survey emails and texts for this enrollment.</p>{!done && <button disabled={busy} onClick={stop} style={{ padding: 16, background: '#243d29', color: 'white', borderRadius: 8 }}>{busy ? 'Stopping…' : 'Stop my check-ins'}</button>}<p role="status">{status}</p></main></>;
}
