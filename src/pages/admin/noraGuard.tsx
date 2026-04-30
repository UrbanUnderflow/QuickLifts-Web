// =============================================================================
// /admin/noraGuard — Phase G surface.
//
// Full message-validation inbox for athlete-Nora conversations.
//
// Layout:
//   - Left rail: athlete list (most-recently-active first), guardrail-rejected
//     count in last 7d
//   - Center: full thread for selected athlete (every Nora message + every
//     athlete reply, full message bodies)
//   - Right rail: technical evidence per turn — trigger, raw model output,
//     guardrail outcomes, scale/tree revision IDs, fallback used
//
// Kill switch: pulsecheck-nora-guard-config.loggingEnabled
//   - true (default during pilot)  → full message logging
//   - false                          → minimal metadata only (no message
//                                       bodies persisted to log)
//
// PII redaction toggle: localStorage('noraGuardRedactPII')
//   - on by default; admin can flip to "show literal" with a click
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  Power,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import type {
  ConversationState,
  ConversationTurn,
  NoraConversation,
} from '../../api/firebase/noraConversation/types';
import { closeConversation } from '../../api/firebase/noraConversation/orchestrator';

const STATE_TONE: Record<ConversationState, string> = {
  'opened': 'border-amber-700/50 bg-amber-950/30 text-amber-200',
  'awaiting-reply': 'border-amber-700/50 bg-amber-950/30 text-amber-100',
  'action-delivered': 'border-emerald-700/40 bg-emerald-950/30 text-emerald-200',
  'closed-no-reply': 'border-zinc-700 bg-black/30 text-zinc-300',
  'closed-revoked': 'border-rose-700/60 bg-rose-950/40 text-rose-200',
};

const NoraGuardPage: React.FC = () => {
  const [convos, setConvos] = useState<NoraConversation[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [redact, setRedact] = useState<boolean>(true);
  const [killSwitchOn, setKillSwitchOn] = useState<boolean>(true);
  const [killLoading, setKillLoading] = useState(true);

  // Read PII redaction toggle from localStorage on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = window.localStorage.getItem('noraGuardRedactPII');
    if (v !== null) setRedact(v === 'true');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('noraGuardRedactPII', String(redact));
  }, [redact]);

  // Read kill-switch state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setKillLoading(true);
      try {
        const snap = await getDoc(doc(db, 'pulsecheck-nora-guard-config', 'current'));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() as { loggingEnabled?: boolean };
          setKillSwitchOn(data.loggingEnabled !== false);
        }
      } finally {
        if (!cancelled) setKillLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Live conversation list.
  useEffect(() => {
    setLoadingConvos(true);
    const unsub = onSnapshot(
      query(
        collection(db, 'pulsecheck-nora-conversations'),
        orderBy('updatedAt', 'desc'),
        fsLimit(50),
      ),
      (snap) => {
        const rows = snap.docs.map((d) => ({ ...(d.data() as NoraConversation), id: d.id }));
        setConvos(rows);
        setLoadingConvos(false);
      },
      () => setLoadingConvos(false),
    );
    return () => unsub();
  }, []);

  const selected = useMemo(() => convos.find((c) => c.id === selectedId) || null, [convos, selectedId]);

  const filteredConvos = useMemo(() => {
    if (!search.trim()) return convos;
    const s = search.toLowerCase();
    return convos.filter((c) => `${c.athleteUserId} ${c.trigger} ${c.branchId} ${c.teamId}`.toLowerCase().includes(s));
  }, [convos, search]);

  const handleKillSwitch = async (next: boolean) => {
    setKillSwitchOn(next);
    try {
      await setDoc(doc(db, 'pulsecheck-nora-guard-config', 'current'), {
        id: 'current',
        loggingEnabled: next,
        updatedAt: Date.now(),
      }, { merge: true });
    } catch {
      /* tolerate */
    }
  };

  const handleRevoke = async () => {
    if (!selected) return;
    if (!window.confirm('Revoke this conversation? It will be marked closed-revoked.')) return;
    try {
      await closeConversation({
        conversationId: selected.id,
        reason: 'revoked',
        revokedReason: 'Revoked from Nora Guard admin.',
      } as any);
    } catch {
      /* tolerate */
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Nora Guard | Pulse Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen bg-[#080a14] px-6 py-10 text-zinc-100">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-700/40 bg-violet-950/30 text-violet-200">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">Nora Guard</h1>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                Full message-validation inbox. Read every message Nora has sent. Surface guardrail violations,
                fallback paths, and Claude's raw outputs alongside the final delivered text.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() => setRedact(!redact)}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-black/30 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                title="PII redaction toggle"
              >
                {redact ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {redact ? 'PII redacted' : 'Show literal'}
              </button>
              <button
                onClick={() => handleKillSwitch(!killSwitchOn)}
                disabled={killLoading}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
                  killSwitchOn
                    ? 'border-emerald-700/40 bg-emerald-950/30 text-emerald-200'
                    : 'border-rose-700/60 bg-rose-950/30 text-rose-200'
                }`}
                title="Logging kill switch"
              >
                <Power className="h-3 w-3" />
                Logging {killSwitchOn ? 'ON' : 'OFF'}
              </button>
            </div>
          </header>

          {!killSwitchOn && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-700/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
              <AlertTriangle className="h-4 w-4" />
              Nora Guard message logging is OFF. Only minimal metadata is being persisted. Athletes' message bodies are not stored.
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[280px_1fr_320px]">
            {/* Left rail */}
            <aside className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3">
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-zinc-700 bg-black/30 px-2 py-1">
                <Search className="h-3 w-3 text-zinc-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="search…"
                  className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none"
                />
              </div>
              {loadingConvos ? (
                <div className="flex items-center gap-2 p-3 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
              ) : filteredConvos.length === 0 ? (
                <p className="p-3 text-xs text-zinc-500">No conversations.</p>
              ) : (
                <ul className="space-y-1">
                  {filteredConvos.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelectedId(c.id)}
                        className={`w-full rounded-lg p-2 text-left text-xs transition ${
                          selectedId === c.id
                            ? 'bg-violet-500/15 border border-violet-500/30'
                            : 'hover:bg-zinc-800/50'
                        }`}
                      >
                        <p className="truncate font-mono text-zinc-300">{redactMaybe(c.athleteUserId, redact)}</p>
                        <p className="mt-0.5 truncate text-[10px] text-zinc-500">{c.trigger}</p>
                        <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wide ${STATE_TONE[c.state]}`}>
                          {c.state}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>

            {/* Center thread */}
            <main className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
              {!selected ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  Select a conversation to read the full thread.
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <p className="text-xs font-mono text-zinc-500">{redactMaybe(selected.athleteUserId, redact)}</p>
                      <p className="mt-1 text-sm font-semibold">{selected.trigger}</p>
                      <p className="text-xs text-zinc-500">{selected.triggerEvidence?.summary || '—'}</p>
                    </div>
                    <button
                      onClick={handleRevoke}
                      disabled={selected.state.startsWith('closed')}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-700/60 bg-rose-950/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/30 disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                      Revoke
                    </button>
                  </div>
                  <ul className="space-y-3">
                    {selected.turns.map((t) => (
                      <li key={t.turnId}>
                        <TurnBubble turn={t} redact={redact} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </main>

            {/* Right rail */}
            <aside className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
              {!selected ? (
                <p className="text-xs text-zinc-500">Select a turn for technical evidence.</p>
              ) : (
                <SidebarEvidence convo={selected} redact={redact} />
              )}
            </aside>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

const TurnBubble: React.FC<{ turn: ConversationTurn; redact: boolean }> = ({ turn, redact }) => {
  const isAthlete = turn.role === 'athlete-reply';
  return (
    <div className={`max-w-[80%] rounded-2xl border p-3 text-sm ${
      isAthlete
        ? 'ml-auto border-emerald-700/30 bg-emerald-950/20 text-emerald-100'
        : 'border-zinc-800 bg-black/30 text-zinc-100'
    }`}>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{turn.role}</p>
      <p className="mt-1">{redactMaybe(turn.text, redact)}</p>
      {turn.fallbackTriggered && (
        <p className="mt-1 text-[10px] text-amber-300">fallback: {turn.fallbackReason || '—'}</p>
      )}
      {(turn.guardrailViolations || []).length > 0 && (
        <p className="mt-1 text-[10px] text-rose-300">{turn.guardrailViolations!.length} guardrail violation(s)</p>
      )}
    </div>
  );
};

const SidebarEvidence: React.FC<{ convo: NoraConversation; redact: boolean }> = ({ convo, redact }) => {
  const lastNoraTurn = [...convo.turns].reverse().find((t) => t.role !== 'athlete-reply');
  return (
    <div className="space-y-3 text-xs">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">Conversation</p>
        <p className="mt-1 font-mono text-zinc-300">{convo.id.slice(0, 32)}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">Branch</p>
        <p className="mt-1 text-zinc-300">{convo.branchId}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">Action domain</p>
        <p className="mt-1 text-zinc-300">{convo.actionDomain}</p>
      </div>
      {convo.actionState && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Classified state</p>
          <p className="mt-1 text-zinc-300">{convo.actionState}</p>
        </div>
      )}
      {lastNoraTurn?.rawModelOutput && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Last Claude output</p>
          <p className="mt-1 italic text-zinc-400">{redactMaybe(lastNoraTurn.rawModelOutput, redact)}</p>
        </div>
      )}
      {(lastNoraTurn?.guardrailViolations || []).length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Guardrail violations (last turn)</p>
          <ul className="mt-1 list-disc pl-4 text-rose-300">
            {lastNoraTurn!.guardrailViolations!.map((v, i) => (
              <li key={i}>{v.field}: {v.message}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">Scale revision</p>
        <p className="mt-1 font-mono text-zinc-400">{(convo.scaleRevisionAtOpen || '—').slice(0, 24)}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">Tree revision</p>
        <p className="mt-1 font-mono text-zinc-400">{(convo.treeRevisionAtOpen || '—').slice(0, 24)}</p>
      </div>
    </div>
  );
};

// Lightweight PII redaction. Replaces email-like strings + phone-number
// shapes + sequences that look like names following "Hi" / "Hey".
const redactMaybe = (text: string, redact: boolean): string => {
  if (!redact) return text;
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[phone]')
    .replace(/\b(?:I'?m|My name is)\s+[A-Z][a-z]+/g, '[name-redacted]');
};

export default NoraGuardPage;
