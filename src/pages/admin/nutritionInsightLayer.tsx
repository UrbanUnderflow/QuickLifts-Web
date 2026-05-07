import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Database,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import {
  collectionGroup,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../../api/firebase/config';

interface NutritionInsightRow {
  id: string;
  path: string;
  userId: string;
  dayKey: string;
  title: string;
  type: string;
  generatedAtEpochMs: number;
  source: string;
  fact?: string;
  interpretation?: string;
  action?: string;
  confidenceNote?: string | null;
  facts?: Record<string, unknown>;
  candidates?: Array<Record<string, unknown>>;
  selectedCandidate?: Record<string, unknown>;
  selectedCandidateId?: string;
  rejectedCandidateIds?: string[];
  validationTrace?: {
    passed?: boolean;
    blockedReasons?: string[];
    warnings?: string[];
  };
}

const toStringValue = (value: unknown, fallback = '') => (
  typeof value === 'string' && value.trim() ? value : fallback
);

const toNumberValue = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
);

const parseInsightRow = (docSnapshot: { id: string; ref: { path: string; parent: { parent: { id: string } | null } }; data: () => Record<string, unknown> }): NutritionInsightRow => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    path: docSnapshot.ref.path,
    userId: docSnapshot.ref.parent.parent?.id || '',
    dayKey: toStringValue(data.dayKey, docSnapshot.id),
    title: toStringValue(data.title, 'Untitled insight'),
    type: toStringValue(data.type, 'unknown'),
    generatedAtEpochMs: toNumberValue(data.generatedAtEpochMs),
    source: toStringValue(data.source, 'unknown'),
    fact: toStringValue(data.fact),
    interpretation: toStringValue(data.interpretation),
    action: toStringValue(data.action),
    confidenceNote: data.confidenceNote === null ? null : toStringValue(data.confidenceNote) || null,
    facts: typeof data.facts === 'object' && data.facts !== null ? data.facts as Record<string, unknown> : undefined,
    candidates: Array.isArray(data.candidates) ? data.candidates as Array<Record<string, unknown>> : [],
    selectedCandidate: typeof data.selectedCandidate === 'object' && data.selectedCandidate !== null ? data.selectedCandidate as Record<string, unknown> : undefined,
    selectedCandidateId: toStringValue(data.selectedCandidateId),
    rejectedCandidateIds: Array.isArray(data.rejectedCandidateIds) ? data.rejectedCandidateIds.filter((v): v is string => typeof v === 'string') : [],
    validationTrace: typeof data.validationTrace === 'object' && data.validationTrace !== null ? data.validationTrace as NutritionInsightRow['validationTrace'] : undefined,
  };
};

const formatDateTime = (epochMs: number) => {
  if (!epochMs) return 'Unknown';
  return new Date(epochMs).toLocaleString();
};

const JsonBlock: React.FC<{ value: unknown }> = ({ value }) => (
  <pre className="max-h-96 overflow-auto rounded-xl border border-zinc-800 bg-black/40 p-3 text-xs leading-relaxed text-zinc-300">
    {JSON.stringify(value || {}, null, 2)}
  </pre>
);

const MetricCard: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'text-white' }) => (
  <div className="rounded-2xl border border-zinc-800 bg-[#10141d] p-4">
    <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
    <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
  </div>
);

const NutritionInsightLayerPage: React.FC = () => {
  const [rows, setRows] = useState<NutritionInsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const insightsQuery = query(
        collectionGroup(db, 'macraInsights'),
        orderBy('generatedAtEpochMs', 'desc'),
        fsLimit(50),
      );
      const snapshot = await getDocs(insightsQuery);
      const nextRows = snapshot.docs.map(parseInsightRow);
      setRows(nextRows);
      setSelectedId((current) => current || nextRows[0]?.id || null);
    } catch (err) {
      console.error('[NutritionInsightLayer] Failed to load insights:', err);
      setError((err as Error).message || 'Failed to load nutrition insights.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInsights();
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [
      row.userId,
      row.dayKey,
      row.title,
      row.type,
      row.source,
      row.selectedCandidateId,
    ].join(' ').toLowerCase().includes(q));
  }, [rows, search]);

  const selected = useMemo(
    () => filteredRows.find((row) => row.id === selectedId) || filteredRows[0] || null,
    [filteredRows, selectedId],
  );

  const validationFailures = rows.filter((row) => row.validationTrace?.passed === false).length;
  const reasoningLayerRows = rows.filter((row) => row.facts?.version === 'nutrition-reasoning-v1').length;

  return (
    <AdminRouteGuard>
      <Head>
        <title>Nutrition Insight Layer | Pulse Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-[#080a14] px-6 py-10 text-zinc-100">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/30 bg-lime-400/10 text-lime-200">
                <Utensils className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-lime-300">Admin QA</p>
                <h1 className="text-2xl font-semibold tracking-tight">Nutrition Insight Layer</h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
                  Review Macra daily insight outputs with their fact ledger, candidate rankings,
                  validation trace, and final copy. This is the tuning surface for the reusable
                  nutrition reasoning layer before it expands into Pulse Check athlete context.
                </p>
              </div>
            </div>
            <button
              onClick={() => void loadInsights()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-black/30 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </header>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="Recent insights" value={String(rows.length)} />
            <MetricCard label="Reasoning v1" value={String(reasoningLayerRows)} tone="text-lime-200" />
            <MetricCard label="Validation fallbacks" value={String(validationFailures)} tone={validationFailures ? 'text-amber-200' : 'text-emerald-200'} />
            <MetricCard label="Selected candidates" value={String(new Set(rows.map((row) => row.selectedCandidateId).filter(Boolean)).size)} />
          </div>

          {error ? (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-700/50 bg-rose-950/30 p-4 text-sm text-rose-200">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-zinc-800 bg-[#0d111a] p-4">
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-zinc-800 bg-black/30 px-3 py-2">
                <Search className="h-4 w-4 text-zinc-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search user, date, type..."
                  className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                />
              </div>

              <div className="max-h-[720px] space-y-2 overflow-auto pr-1">
                {loading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading insights...
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="rounded-xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-500">
                    No insights match this search.
                  </div>
                ) : filteredRows.map((row) => {
                  const active = selected?.path === row.path;
                  const failed = row.validationTrace?.passed === false;
                  return (
                    <button
                      key={row.path}
                      onClick={() => setSelectedId(row.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        active
                          ? 'border-lime-400/60 bg-lime-400/10'
                          : 'border-zinc-800 bg-black/20 hover:border-zinc-700 hover:bg-black/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{row.title}</p>
                        {failed ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">{row.dayKey} · {row.type} · {row.source}</p>
                      <p className="mt-1 truncate text-xs text-zinc-500">{row.userId}</p>
                    </button>
                  );
                })}
              </div>
            </aside>

            <main className="space-y-4">
              {!selected ? (
                <div className="rounded-2xl border border-zinc-800 bg-[#0d111a] p-8 text-center text-zinc-500">
                  Select an insight to inspect the reasoning trace.
                </div>
              ) : (
                <>
                  <section className="rounded-2xl border border-zinc-800 bg-[#0d111a] p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-zinc-500">{formatDateTime(selected.generatedAtEpochMs)}</p>
                        <h2 className="mt-1 text-xl font-semibold text-white">{selected.title}</h2>
                        <p className="mt-1 text-sm text-zinc-500">{selected.path}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs text-lime-200">{selected.type}</span>
                        <span className="rounded-full border border-zinc-700 bg-black/30 px-3 py-1 text-xs text-zinc-300">{selected.source}</span>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
                      <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-wide text-zinc-500">Fact</p>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-200">{selected.fact || 'No fact field stored.'}</p>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-wide text-zinc-500">Interpretation</p>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-200">{selected.interpretation || 'No interpretation field stored.'}</p>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-wide text-zinc-500">Action</p>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-200">{selected.action || 'No action field stored.'}</p>
                      </div>
                    </div>
                  </section>

                  <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-800 bg-[#0d111a] p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-300" />
                        <h3 className="text-sm font-semibold text-white">Validation Trace</h3>
                      </div>
                      <JsonBlock value={selected.validationTrace || { message: 'No validation trace stored.' }} />
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-[#0d111a] p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <Eye className="h-4 w-4 text-blue-300" />
                        <h3 className="text-sm font-semibold text-white">Selected Candidate</h3>
                      </div>
                      <JsonBlock value={selected.selectedCandidate || { selectedCandidateId: selected.selectedCandidateId }} />
                    </div>
                  </section>

                  <section className="rounded-2xl border border-zinc-800 bg-[#0d111a] p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-lime-300" />
                      <h3 className="text-sm font-semibold text-white">Candidate Rankings</h3>
                    </div>
                    <JsonBlock value={selected.candidates || []} />
                  </section>

                  <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-800 bg-[#0d111a] p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <Database className="h-4 w-4 text-purple-300" />
                        <h3 className="text-sm font-semibold text-white">Fact Ledger</h3>
                      </div>
                      <JsonBlock value={selected.facts || { message: 'No fact ledger stored.' }} />
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-[#0d111a] p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-amber-300" />
                        <h3 className="text-sm font-semibold text-white">Rejected Candidate Ids</h3>
                      </div>
                      <JsonBlock value={selected.rejectedCandidateIds || []} />
                    </div>
                  </section>
                </>
              )}
            </main>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default NutritionInsightLayerPage;
