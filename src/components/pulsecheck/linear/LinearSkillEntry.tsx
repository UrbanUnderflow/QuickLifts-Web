import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../api/firebase/config';
import { requestLinearRuntime } from '../../../api/firebase/dailyCurriculum/linearRuntimeClient';
/** Default-off discovery. An enabled request may issue today's pinned assignment. */
export default function LinearSkillEntry() {
  const [label, setLabel] = useState(''), [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0), [loading, setLoading] = useState(false);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_LINEAR_CURRICULUM_ENABLED !== 'true') return;
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, user => {
      setLabel(''); setNotice(''); if (!user) return;
      setLoading(true);
      requestLinearRuntime({ action: 'today' }).then(result => {
        if (cancelled) return;
        if (result.status === 'assignment' && result.assignment) setLabel(result.assignment.skillName);
        else if (result.status !== 'legacy') setNotice(result.reason || 'Your skill plan needs review. Your progress is preserved.');
      }).catch(error => { if (!cancelled) setNotice(error instanceof Error ? error.message : 'Your skill plan could not be opened.'); })
        .finally(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [attempt]);
  if (!label && !notice && !loading) return null;
  return <section className="relative z-10 mx-4 mt-4 rounded-xl border border-white/20 bg-zinc-900 p-4 text-white" aria-label="Your skill plan">
    {loading ? <p role="status" className="text-sm text-zinc-300">Opening your skill plan…</p> : label ? <Link href="/PulseCheck/linear"><span className="text-xs text-zinc-400">Your skill plan</span><span className="mt-1 block font-semibold">Continue {label}</span></Link> : <><p role="status" className="text-sm text-zinc-300">{notice}</p><div className="mt-3 flex gap-4 text-sm"><button type="button" onClick={() => setAttempt(value => value + 1)} className="underline">Retry skill plan</button><Link href="/PulseCheck/linear" className="underline">Open skill plan</Link></div></>}
  </section>;
}
