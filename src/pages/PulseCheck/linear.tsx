import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../api/firebase/config';
import { requestLinearRuntime, type LinearRuntimeResponse } from '../../api/firebase/dailyCurriculum/linearRuntimeClient';
const Flow = dynamic(() => import('../../components/pulsecheck/linear/LinearSkillFlow'), { ssr: false });
export default function LinearSkillPage() {
  const [state, setState] = useState<LinearRuntimeResponse | null>(null), [error, setError] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let cancelled = false; let generation = 0; const stop = onAuthStateChanged(auth, user => {
    const currentGeneration = ++generation;
    setOwnerId(user?.uid || null); setState(null); setError('');
    if (!user) { setError('Sign in to open your skill plan.'); return; }
    requestLinearRuntime({ action: 'today' }).then(value => { if (!cancelled && currentGeneration === generation && auth.currentUser?.uid === user.uid) setState(value); }).catch(err => { if (!cancelled && currentGeneration === generation && auth.currentUser?.uid === user.uid) setError(err instanceof Error ? err.message : 'Could not open your skill plan.'); });
  }); return () => { cancelled = true; stop(); }; }, [attempt]);
  return <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white"><div className="mx-auto mb-6 max-w-3xl"><Link href="/PulseCheck" className="text-sm text-zinc-300 underline">Back to Today</Link></div>
    {error ? <div role="alert" className="mx-auto max-w-3xl space-y-3"><p>{error}</p><button className="underline" onClick={() => setAttempt(value => value + 1)}>Retry</button></div> : !state ? <p role="status" className="text-center">Opening your skill plan…</p> : state.status === 'assignment' && state.assignment ? <Flow key={`${ownerId}:${state.assignment.id}`} assignment={state.assignment} onSaved={() => setAttempt(value => value + 1)} /> : <p role="status" className="mx-auto max-w-3xl">{state.status === 'legacy' ? 'Your current activities are available on Today. A versioned skill plan has not been enabled for your account.' : state.reason || 'Your skill plan needs review. Your progress is preserved.'}</p>}
  </main>;
}
