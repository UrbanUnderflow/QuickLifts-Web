import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import PipeListsQueueView from '../components/pipelists/PipeListsQueueView';
import { isPipeListsProductionBrowser } from '../utils/pipelistsRuntime';
import { readQueueSequences, validateQueueListId, type QueueIdentity, type QueueSequence } from '../utils/pipelistsQueue';

type Session = { status: 'checking' | 'blocked' | 'signed-out' | 'ready' | 'error'; identity: QueueIdentity | null };
type Result = { listId: string; sequences: QueueSequence[]; loadedAt: string };

// Intentionally separate from PipeLists: no profile bootstrap, autosave, editor or provider refresh.
export default function PipeListsQueue() {
  const router = useRouter();
  const activeRead = useRef<AbortController | null>(null);
  const [session, setSession] = useState<Session>({ status: 'checking', identity: null });
  const [listIdInput, setListIdInput] = useState('');
  const [request, setRequest] = useState<{ listId: string; revision: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isPipeListsProductionBrowser()) {
      setSession({ status: 'blocked', identity: null });
      return;
    }
    let stopped = false;
    let unsubscribe: (() => void) | undefined;
    // Both Firebase imports stay behind the runtime gate. Observing an existing
    // identity does not create an account, update a profile or change access.
    void Promise.all([import('firebase/auth'), import('../api/firebase/simpBudgetConfig')]).then(([auth, config]) => {
      if (stopped) return;
      unsubscribe = auth.onAuthStateChanged(config.simpBudgetAuth, identity => {
        if (stopped) return;
        activeRead.current?.abort();
        setResult(null);
        setSession({ status: identity ? 'ready' : 'signed-out', identity });
      }, () => {
        if (!stopped) {
          activeRead.current?.abort();
          setResult(null);
          setSession({ status: 'error', identity: null });
        }
      });
    }).catch(() => {
      if (!stopped) setSession({ status: 'error', identity: null });
    });
    return () => { stopped = true; activeRead.current?.abort(); unsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const value = router.query.listId;
    if (value === undefined) return;
    try {
      const listId = validateQueueListId(value);
      setListIdInput(listId);
      setRequest(current => ({ listId, revision: (current?.revision || 0) + 1 }));
      setError('');
    } catch (cause) {
      setRequest(null);
      setResult(null);
      setError((cause as Error).message);
    }
  }, [router.isReady, router.query.listId]);

  useEffect(() => {
    setResult(null);
    if (session.status !== 'ready' || !session.identity || !request || !isPipeListsProductionBrowser()) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    activeRead.current = controller;
    setLoading(true);
    setError('');
    void readQueueSequences({ identity: session.identity, listId: request.listId, signal: controller.signal }).then(sequences => {
      if (!controller.signal.aborted) setResult({ listId: request.listId, sequences, loadedAt: new Date().toISOString() });
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Stored queue status could not be read.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [session, request]);

  const inspect = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const listId = validateQueueListId(listIdInput);
      setListIdInput(listId);
      setRequest(current => ({ listId, revision: (current?.revision || 0) + 1 }));
    } catch (cause) {
      setRequest(null);
      setResult(null);
      setError((cause as Error).message);
    }
  };

  return <>
    <Head><title>PipeLists email queue</title><meta name="robots" content="noindex, nofollow" /><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <main className="min-h-screen bg-stone-50 px-4 py-8 text-stone-900 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">PipeLists · Owner status</p><h1 className="mt-2 text-3xl font-semibold">Email queue</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">Read-only stored sequence status for an explicit list. Inspecting does not send, schedule, pause, resume, save, or refresh provider tracking.</p></header>
        {session.status === 'checking' && <p role="status">Checking the existing session…</p>}
        {session.status === 'blocked' && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This read-only queue is disabled outside the approved production runtime. No identity or queue data has been loaded.</p>}
        {session.status === 'signed-out' && <p role="status" className="rounded-xl border border-stone-200 bg-white p-4 text-sm">An existing signed-in PipeLists owner session is required. Sign in to PipeLists, then return to this page.</p>}
        {session.status === 'error' && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">The existing session could not be loaded. No queue data is available.</p>}
        {session.status === 'ready' && <form onSubmit={inspect} className="rounded-xl border border-stone-200 bg-white p-5">
          <label htmlFor="queue-list-id" className="text-sm font-semibold">List ID</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row"><input id="queue-list-id" value={listIdInput} onChange={event => setListIdInput(event.target.value)} maxLength={200} autoComplete="off" placeholder="Paste a PipeLists list ID" className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" /><button type="submit" disabled={!listIdInput.trim()} className="rounded-lg bg-stone-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">Inspect stored status</button></div>
          <p className="mt-2 text-xs text-stone-500">Existing owner access is checked by the server. This page does not enumerate all lists.</p>
        </form>}
        {error && session.status === 'ready' && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p>}
        {loading && <p role="status">Reading stored queue status…</p>}
        {result && <PipeListsQueueView {...result} />}
      </div>
    </main>
  </>;
}
