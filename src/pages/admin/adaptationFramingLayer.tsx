// =============================================================================
// /admin/adaptationFramingLayer — Phase E surface.
//
// 4 tabs:
//   1. Translation Table — searchable grid of (domain, state) → athletePhrasing
//   2. Conversation Tree — 4 trigger branches (opener / probe / actionDelivery)
//   3. Off-Limits Config — markers, forbidden phrases, numeric rules
//   4. Translation Log — recent translations with filter (athlete, domain,
//      guardrail outcome, model vs fallback)
//
// Plus a "What would Nora say?" preview that hits /api/admin/test-nora-translation.
//
// All four data tabs are READ-ONLY in v1; edits land in Slice 1B+ via inline
// editors.  The off-limits + table + tree are seeded in Phase B; admin can
// edit them by swapping Firestore values directly until inline editors land.
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Eye,
  Layers,
  Loader2,
  MessageSquare,
  PlayCircle,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import type {
  ConversationBranch,
  OffLimitsConfig,
  TranslationDomain,
  TranslationRow,
  AdaptiveFramingScale,
  ValidationIssue,
} from '../../api/firebase/adaptiveFramingLayer/types';

type TabKey = 'translation' | 'conversation' | 'offlimits' | 'log' | 'preview';

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'translation', label: 'Translation Table', icon: <ClipboardList className="h-4 w-4" /> },
  { key: 'conversation', label: 'Conversation Tree', icon: <MessageSquare className="h-4 w-4" /> },
  { key: 'offlimits', label: 'Off-Limits Config', icon: <ShieldCheck className="h-4 w-4" /> },
  { key: 'log', label: 'Translation Log', icon: <Eye className="h-4 w-4" /> },
  { key: 'preview', label: 'What would Nora say?', icon: <Sparkles className="h-4 w-4" /> },
];

const AdaptationFramingLayerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('translation');

  return (
    <AdminRouteGuard>
      <Head>
        <title>Adaptation Framing Layer | Pulse Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen bg-[#080a14] px-6 py-10 text-zinc-100">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-700/40 bg-violet-950/30 text-violet-200">
              <Layers className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Adaptation Framing Layer</h1>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                Athletes never see numeric biomarker values. Coaches see evidence-rich. This surface manages the
                translation rules, conversation branches, and off-limits guardrails that enforce that doctrine.
              </p>
            </div>
          </header>

          <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/50 p-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${
                  activeTab === t.key
                    ? 'bg-violet-500/20 text-violet-100 border border-violet-500/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>

          {activeTab === 'translation' && <TranslationTab />}
          {activeTab === 'conversation' && <ConversationTab />}
          {activeTab === 'offlimits' && <OffLimitsTab />}
          {activeTab === 'log' && <LogTab />}
          {activeTab === 'preview' && <PreviewTab />}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Tab 1 — Translation Table
// ──────────────────────────────────────────────────────────────────────────────

const TranslationTab: React.FC = () => {
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [domainFilter, setDomainFilter] = useState<TranslationDomain | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'pulsecheck-translation-table'), fsLimit(200)));
        if (cancelled) return;
        setRows(snap.docs.map((d) => ({ ...(d.data() as TranslationRow), id: d.id })));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (domainFilter !== 'all' && r.domain !== domainFilter) return false;
      if (filter && !`${r.domain} ${r.state} ${r.athletePhrasing}`.toLowerCase().includes(filter.toLowerCase())) return false;
      return true;
    });
  }, [rows, filter, domainFilter]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by text…"
          className="flex-1 rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-400/60 focus:outline-none"
        />
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value as any)}
          className="rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="all">All domains</option>
          <option value="sleep">sleep</option>
          <option value="travel">travel</option>
          <option value="autonomic">autonomic</option>
          <option value="load">load</option>
          <option value="circadian">circadian</option>
        </select>
        <span className="text-xs text-zinc-500">{filtered.length}/{rows.length}</span>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading translations…</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-zinc-500">No rows match.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((r) => (
              <li key={r.id} className="rounded-xl border border-zinc-800 bg-black/25 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-200">
                      {r.domain}
                    </span>
                    <span className="ml-2 text-sm font-mono text-zinc-300">{r.state}</span>
                  </div>
                  <ReviewBadge status={r.voiceReviewStatus} />
                </div>
                <p className="mt-2 text-sm text-zinc-100">{r.athletePhrasing}</p>
                <p className="mt-2 text-[11px] text-zinc-500">
                  Required verbs: {r.requiredActionVerbs.join(', ') || '—'} · Forbidden tokens: {r.forbiddenTokens.join(', ') || '—'}
                </p>
                <p className="mt-1 text-[11px] text-zinc-600">revision {r.revisionId.slice(0, 24)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

const ReviewBadge: React.FC<{ status: string }> = ({ status }) => {
  const tone =
    status === 'reviewed'
      ? 'border-emerald-700/40 bg-emerald-950/30 text-emerald-200'
      : status === 'needs-revision'
        ? 'border-rose-700/60 bg-rose-950/40 text-rose-200'
        : 'border-amber-700/50 bg-amber-950/30 text-amber-200';
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${tone}`}>{status}</span>;
};

// ──────────────────────────────────────────────────────────────────────────────
// Tab 2 — Conversation Tree
// ──────────────────────────────────────────────────────────────────────────────

const ConversationTab: React.FC = () => {
  const [branches, setBranches] = useState<ConversationBranch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'pulsecheck-conversation-tree'), fsLimit(50)));
        if (cancelled) return;
        setBranches(snap.docs.map((d) => ({ ...(d.data() as ConversationBranch), id: d.id })));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  return (
    <div className="space-y-3">
      {branches.map((b) => (
        <div key={b.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
          <div className="flex items-start justify-between">
            <div>
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-200">
                {b.trigger}
              </span>
              <p className="mt-2 text-sm font-semibold">{b.id}</p>
              <p className="text-xs text-zinc-500">{b.description}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <NodeCard label="Opener" text={b.opener.text} status={b.opener.voiceReviewStatus} />
            <NodeCard label="Probe" text={b.probe.text} status={b.probe.voiceReviewStatus} />
            <NodeCard label="Action delivery" text={b.actionDelivery.text} status={b.actionDelivery.voiceReviewStatus} />
          </div>
        </div>
      ))}
    </div>
  );
};

const NodeCard: React.FC<{ label: string; text: string; status: string }> = ({ label, text, status }) => (
  <div className="rounded-xl border border-zinc-800 bg-black/25 p-3">
    <div className="flex items-center justify-between">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <ReviewBadge status={status} />
    </div>
    <p className="mt-2 text-xs text-zinc-200">{text}</p>
  </div>
);

// ──────────────────────────────────────────────────────────────────────────────
// Tab 3 — Off-Limits Config
// ──────────────────────────────────────────────────────────────────────────────

const OffLimitsTab: React.FC = () => {
  const [config, setConfig] = useState<OffLimitsConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'pulsecheck-off-limits-config'));
        if (cancelled) return;
        const doc = snap.docs.find((d) => d.id === 'current') || snap.docs[0];
        setConfig(doc ? (doc.data() as OffLimitsConfig) : null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!config) return <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5 text-sm text-zinc-500">No off-limits config found. Run Phase B seeder.</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
        <h3 className="text-sm font-semibold">Forbidden markers ({config.forbiddenMarkers.length})</h3>
        <p className="mt-1 text-xs text-zinc-500">Athletes never see numeric values for these signals.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {config.forbiddenMarkers.map((m) => (
            <span key={m} className="rounded-full border border-rose-700/40 bg-rose-950/30 px-3 py-1 text-xs text-rose-200">{m}</span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
        <h3 className="text-sm font-semibold">Forbidden phrase patterns ({config.forbiddenPhrasePatterns.length})</h3>
        <ul className="mt-2 space-y-1 text-xs">
          {config.forbiddenPhrasePatterns.map((p) => (
            <li key={p} className="rounded bg-black/30 px-2 py-1 font-mono text-rose-200">/{p}/i</li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
        <h3 className="text-sm font-semibold">Numeric value rules ({config.numericValueRules.length})</h3>
        <ul className="mt-2 space-y-2 text-xs">
          {config.numericValueRules.map((r, i) => (
            <li key={i} className="rounded-lg border border-zinc-800 bg-black/30 p-3">
              <code className="text-rose-200">/{r.pattern}/i</code>
              <p className="mt-1 text-zinc-400">{r.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Tab 4 — Translation Log
// ──────────────────────────────────────────────────────────────────────────────

interface TranslationLogEntry {
  id: string;
  athleteUserId?: string;
  domain?: string;
  state?: string;
  providerUsed?: string;
  fallbackTriggered?: boolean;
  fallbackReason?: string;
  guardrailViolations?: ValidationIssue[];
  finalDelivered?: string;
  claudeOutputRaw?: string;
  voiceReviewStatus?: string;
  translationRowRevision?: string;
  timestamp?: number;
}

const LogTab: React.FC = () => {
  const [rows, setRows] = useState<TranslationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'fallback' | 'guardrail-rejected' | 'success'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'pulsecheck-nora-translation-log'), orderBy('timestamp', 'desc'), fsLimit(50)));
        if (cancelled) return;
        setRows(snap.docs.map((d) => ({ ...(d.data() as TranslationLogEntry), id: d.id })));
      } catch {
        /* tolerate */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = rows.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'fallback') return r.fallbackTriggered === true;
    if (filter === 'guardrail-rejected') return r.fallbackReason === 'guardrail-violation';
    if (filter === 'success') return r.fallbackTriggered !== true;
    return true;
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="all">All translations</option>
          <option value="success">Anthropic success path only</option>
          <option value="fallback">Fallback triggered</option>
          <option value="guardrail-rejected">Guardrail rejections</option>
        </select>
        <span className="text-xs text-zinc-500">{filtered.length}/{rows.length}</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading log…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5 text-sm text-zinc-500">No log entries yet.</div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-mono text-zinc-500">{r.athleteUserId}</p>
                  <p className="mt-1 text-sm">
                    <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-violet-200">
                      {r.domain}/{r.state}
                    </span>
                  </p>
                </div>
                <div className="text-right text-[10px] text-zinc-500">
                  <p>{r.providerUsed}</p>
                  {r.fallbackTriggered && <p className="text-amber-300">fallback: {r.fallbackReason}</p>}
                </div>
              </div>
              <p className="mt-2 text-sm text-zinc-100">{r.finalDelivered}</p>
              {r.claudeOutputRaw && r.claudeOutputRaw !== r.finalDelivered && (
                <details className="mt-2 text-xs text-zinc-400">
                  <summary className="cursor-pointer">Claude raw output</summary>
                  <p className="mt-1 italic">{r.claudeOutputRaw}</p>
                </details>
              )}
              {(r.guardrailViolations || []).length > 0 && (
                <div className="mt-2 rounded-lg border border-rose-700/40 bg-rose-950/20 p-2 text-xs text-rose-200">
                  <strong>Guardrail violations:</strong>
                  <ul className="mt-1 list-disc pl-4">
                    {r.guardrailViolations!.map((v, i) => (
                      <li key={i}>{v.field}: {v.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-2 text-[10px] text-zinc-600">
                {r.timestamp ? new Date(r.timestamp).toISOString() : '—'} · row revision {(r.translationRowRevision || '').slice(0, 24)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Tab 5 — "What would Nora say?" preview
// ──────────────────────────────────────────────────────────────────────────────

const PreviewTab: React.FC = () => {
  const [domain, setDomain] = useState<TranslationDomain>('sleep');
  const [state, setState] = useState('debt');
  const [signal, setSignal] = useState<string>('{}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const parsed = signal.trim() ? JSON.parse(signal) : {};
      const res = await fetch('/api/admin/test-nora-translation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, state, signal: parsed, persistLog: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `HTTP ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Domain</p>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value as any)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="sleep">sleep</option>
              <option value="travel">travel</option>
              <option value="autonomic">autonomic</option>
              <option value="load">load</option>
              <option value="circadian">circadian</option>
            </select>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">State</p>
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Signal (JSON, optional)</p>
          <textarea
            value={signal}
            onChange={(e) => setSignal(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-xs font-mono text-zinc-100"
          />
        </div>
        <button
          onClick={handlePreview}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Preview translation
        </button>
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-700/60 bg-rose-950/30 p-3 text-xs text-rose-200">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}
      </div>
      {result && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
          <p className="text-sm font-semibold">Final phrasing</p>
          <p className="mt-1 rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-3 text-sm text-zinc-100">{result.phrasing}</p>
          {result.claudeOutputRaw && (
            <details className="mt-3 text-xs text-zinc-400">
              <summary className="cursor-pointer">Claude raw output</summary>
              <p className="mt-1 italic">{result.claudeOutputRaw}</p>
            </details>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
            <Stat label="Provider" value={result.providerUsed} />
            <Stat label="Fallback" value={result.fallbackTriggered ? `yes — ${result.fallbackReason || '?'}` : 'no'} />
            <Stat label="Voice review" value={result.voiceReviewStatus} />
          </div>
          {(result.guardrailViolations || []).length > 0 && (
            <div className="mt-3 rounded-lg border border-rose-700/60 bg-rose-950/30 p-3 text-xs text-rose-200">
              <strong>Guardrail violations:</strong>
              <ul className="mt-1 list-disc pl-4">
                {result.guardrailViolations.map((v: ValidationIssue, i: number) => (
                  <li key={i}>{v.field}: {v.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const Stat: React.FC<{ label: string; value: any }> = ({ label, value }) => (
  <div className="rounded-lg border border-zinc-800 bg-black/30 p-3">
    <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
    <p className="mt-1 text-zinc-200">{String(value)}</p>
  </div>
);

export default AdaptationFramingLayerPage;
