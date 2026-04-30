// =============================================================================
// /admin/curriculumLayer — Daily Curriculum Layer admin surface (Phase I 1B).
//
// Four tabs:
//   1. Pillar Configuration — composure / focus / decisioning weights, default + per-sport
//   2. Protocol Curriculum Mapping — every protocol's pillar / frequency / progression
//   3. Engine Configuration — daily cadence, notification windows, kill switch
//   4. 30-Day Assessment Rollups — view athlete-by-athlete pillar balance + gaps
//
// Companion to:
//   - /admin/adaptationFramingLayer (Phase E) — the reactive layer
//   - System Overview tab `PulseCheckCurriculumLayerSpecTab.tsx` (architecture doc)
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Power,
  Settings2,
  TrendingUp,
} from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import {
  CurriculumAssessment,
  CurriculumConfig,
  CURRICULUM_ASSESSMENTS_COLLECTION,
  CURRICULUM_CONFIG_COLLECTION,
  CURRICULUM_CONFIG_SINGLETON_ID,
  PillarWeights,
  ProgressionLevel,
  PROGRESSION_LEVELS,
  DEFAULT_FREQUENCY_PER_30_DAYS,
  EQUAL_PILLAR_WEIGHTS,
  DEFAULT_NOTIFICATION_CADENCE,
  resolveFrequency,
} from '../../api/firebase/dailyCurriculum/types';
import {
  getCurriculumConfig,
  updateCurriculumConfig,
  buildDefaultCurriculumConfig,
} from '../../api/firebase/dailyCurriculum/curriculumConfig';
import { TaxonomyPillar } from '../../api/firebase/mentaltraining/taxonomy';
import type { PulseCheckProtocolDefinition, MentalExercise } from '../../api/firebase/mentaltraining/types';

type TabKey = 'pillar' | 'mapping' | 'engine' | 'rollups';

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'pillar', label: 'Pillar Configuration', icon: <Brain className="h-4 w-4" /> },
  { key: 'mapping', label: 'Protocol Curriculum Mapping', icon: <Settings2 className="h-4 w-4" /> },
  { key: 'engine', label: 'Engine Configuration', icon: <Power className="h-4 w-4" /> },
  { key: 'rollups', label: '30-Day Assessment Rollups', icon: <TrendingUp className="h-4 w-4" /> },
];

const CurriculumLayerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('pillar');
  const [config, setConfig] = useState<CurriculumConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let c = await getCurriculumConfig();
        if (!c) c = buildDefaultCurriculumConfig();
        if (!cancelled) setConfig(c);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load config');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AdminRouteGuard>
      <Head>
        <title>Curriculum Layer | Pulse Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen bg-[#080a14] px-6 py-10 text-zinc-100">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-700/40 bg-violet-950/30 text-violet-200">
              <Brain className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Curriculum Layer</h1>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                Proactive daily protocol + simulation assignment. Builds athlete automaticity through spaced repetition across composure, focus, and decisioning pillars.
                Companion to the reactive Adaptation Framing Layer.
              </p>
            </div>
          </header>

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-700/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/50 p-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${
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

          {loading || !config ? (
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6 text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading curriculum config…
            </div>
          ) : (
            <>
              {activeTab === 'pillar' && <PillarTab config={config} setConfig={setConfig} />}
              {activeTab === 'mapping' && <MappingTab config={config} />}
              {activeTab === 'engine' && <EngineTab config={config} setConfig={setConfig} />}
              {activeTab === 'rollups' && <RollupsTab />}
            </>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Tab 1 — Pillar Configuration
// ──────────────────────────────────────────────────────────────────────────────

const PillarTab: React.FC<{ config: CurriculumConfig; setConfig: (c: CurriculumConfig) => void }> = ({ config, setConfig }) => {
  const [weights, setWeights] = useState<PillarWeights>(config.defaultPillarWeights);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const next = await updateCurriculumConfig(
        { defaultPillarWeights: weights },
        { summary: `Default pillar weights updated to ${weights.composure}/${weights.focus}/${weights.decision}.` },
      );
      setConfig(next);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  const sum = weights.composure + weights.focus + weights.decision;
  const pct = (v: number) => (sum > 0 ? Math.round((v / sum) * 100) : 0);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">Default Pillar Weights</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Drives the daily generator's pillar-balance selection. Equal split (33/33/33) is the default. Per-sport overrides
          override these defaults. The engine normalizes the sum, so values don't need to add to 100.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {(['composure', 'focus', 'decision'] as Array<keyof PillarWeights>).map((p) => (
          <div key={p} className="rounded-xl border border-zinc-800 bg-black/30 p-4">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">{p}</p>
            <input
              type="number"
              min={0}
              value={weights[p]}
              onChange={(e) => setWeights({ ...weights, [p]: Number(e.target.value) || 0 })}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-lg font-semibold text-zinc-100 focus:border-violet-400/60 focus:outline-none"
            />
            <p className="mt-2 text-xs text-zinc-500">{pct(weights[p])}% normalized share</p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Save default weights
        </button>
        {savedAt && (
          <span className="text-xs text-emerald-300">Saved · revision {config.revisionId.slice(0, 18)}…</span>
        )}
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold">Per-sport overrides</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Editing per-sport weights from this surface lands in Slice 1B+ — for now, edit{' '}
          <code className="rounded bg-black/40 px-1">pillarWeightsBySport</code> directly in Firestore. Overrides default to equal until set.
        </p>
        <div className="mt-3 rounded-xl border border-zinc-800 bg-black/30 p-4 text-xs text-zinc-400">
          {Object.keys(config.pillarWeightsBySport || {}).length === 0
            ? 'No per-sport overrides configured. All sports use the defaults above.'
            : Object.entries(config.pillarWeightsBySport || {}).map(([sportId, w]) => (
                <div key={sportId} className="flex items-center justify-between border-b border-zinc-800 py-2 last:border-b-0">
                  <span className="font-mono">{sportId}</span>
                  <span>{w.composure} / {w.focus} / {w.decision}</span>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Tab 2 — Protocol Curriculum Mapping
// ──────────────────────────────────────────────────────────────────────────────

const MappingTab: React.FC<{ config: CurriculumConfig }> = ({ config }) => {
  const [protocols, setProtocols] = useState<PulseCheckProtocolDefinition[]>([]);
  const [sims, setSims] = useState<MentalExercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [pSnap, sSnap] = await Promise.all([
          getDocs(query(collection(db, 'pulsecheck-protocols'), where('isActive', '==', true), limit(100))),
          getDocs(query(collection(db, 'sim-modules'), where('isActive', '==', true), limit(100))),
        ]);
        if (cancelled) return;
        setProtocols(pSnap.docs.map((d) => d.data() as PulseCheckProtocolDefinition));
        setSims(sSnap.docs.map((d) => d.data() as MentalExercise));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const unmappedProtocols = protocols.filter((p) => !p.cognitivePillar);
  const unmappedSims = sims.filter((s) => !s.taxonomy?.primaryPillar);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-100">
        <strong>{unmappedProtocols.length}</strong> protocols and <strong>{unmappedSims.length}</strong> sims have no <code className="rounded bg-black/40 px-1">cognitivePillar</code> set today.
        The engine falls back to "skip" for these — they will not be assigned. Inline editing lands in Slice 1B+; edit directly in Firestore for now.
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
        <h3 className="mb-3 text-base font-semibold">Protocols ({protocols.length})</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-2 pr-4">Label</th>
                  <th className="py-2 pr-4">Pillar</th>
                  <th className="py-2 pr-4">Progression</th>
                  <th className="py-2 pr-4">Recommended /30d</th>
                  <th className="py-2 pr-4">Resolved freq</th>
                </tr>
              </thead>
              <tbody>
                {protocols.map((p) => {
                  const progression = (p.progressionLevel || 'foundational') as ProgressionLevel;
                  const resolved = resolveFrequency(
                    { recommendedFrequencyPer30Days: p.recommendedFrequencyPer30Days, progressionLevel: progression },
                    config.frequencyTargetsByLevel,
                  );
                  return (
                    <tr key={p.id} className="border-t border-zinc-800">
                      <td className="py-2 pr-4 font-medium">{p.label}</td>
                      <td className="py-2 pr-4">{p.cognitivePillar || <span className="text-rose-300">unset</span>}</td>
                      <td className="py-2 pr-4">{progression}</td>
                      <td className="py-2 pr-4">{p.recommendedFrequencyPer30Days ?? '—'}</td>
                      <td className="py-2 pr-4 text-zinc-400">{resolved}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
        <h3 className="mb-3 text-base font-semibold">Simulations ({sims.length})</h3>
        {loading ? null : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Pillar (taxonomy)</th>
                  <th className="py-2 pr-4">Progression</th>
                  <th className="py-2 pr-4">Recommended /30d</th>
                </tr>
              </thead>
              <tbody>
                {sims.map((s) => (
                  <tr key={s.id} className="border-t border-zinc-800">
                    <td className="py-2 pr-4 font-medium">{s.name}</td>
                    <td className="py-2 pr-4">{s.taxonomy?.primaryPillar || <span className="text-rose-300">unset</span>}</td>
                    <td className="py-2 pr-4">{s.progressionLevel || 'foundational'}</td>
                    <td className="py-2 pr-4">{s.recommendedFrequencyPer30Days ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Tab 3 — Engine Configuration
// ──────────────────────────────────────────────────────────────────────────────

const EngineTab: React.FC<{ config: CurriculumConfig; setConfig: (c: CurriculumConfig) => void }> = ({ config, setConfig }) => {
  const [enabled, setEnabled] = useState(config.engineEnabled);
  const [cadence, setCadence] = useState(config.notificationCadence);
  const [freqTargets, setFreqTargets] = useState(config.frequencyTargetsByLevel);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const next = await updateCurriculumConfig(
        { engineEnabled: enabled, notificationCadence: cadence, frequencyTargetsByLevel: freqTargets },
        { summary: `Engine config updated. Enabled=${enabled}; cadence morning/midday/evening=${cadence.morningHourLocal}/${cadence.middayHourLocal}/${cadence.eveningHourLocal}.` },
      );
      setConfig(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
        <h3 className="mb-3 text-base font-semibold">Engine Master Switch</h3>
        <label className="inline-flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-700 bg-black"
          />
          <span>{enabled ? 'Engine ENABLED — daily generator runs.' : 'Engine DISABLED — schedulers no-op.'}</span>
        </label>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
        <h3 className="mb-4 text-base font-semibold">Notification Cadence (athlete-local hours, 0-23)</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberInput
            label="Morning push (delivery)"
            value={cadence.morningHourLocal}
            onChange={(v) => setCadence({ ...cadence, morningHourLocal: v ?? 8 })}
          />
          <NumberInput
            label="Midday nudge"
            nullable
            value={cadence.middayHourLocal}
            onChange={(v) => setCadence({ ...cadence, middayHourLocal: v })}
          />
          <NumberInput
            label="Evening recovery push"
            nullable
            value={cadence.eveningHourLocal}
            onChange={(v) => setCadence({ ...cadence, eveningHourLocal: v })}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
        <h3 className="mb-4 text-base font-semibold">Frequency Targets per 30 Days</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {PROGRESSION_LEVELS.map((level) => (
            <NumberInput
              key={level}
              label={level}
              value={freqTargets[level]}
              onChange={(v) => setFreqTargets({ ...freqTargets, [level]: v ?? DEFAULT_FREQUENCY_PER_30_DAYS[level] })}
            />
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Save engine config
      </button>
    </section>
  );
};

const NumberInput: React.FC<{
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  nullable?: boolean;
}> = ({ label, value, onChange, nullable }) => (
  <div className="rounded-xl border border-zinc-800 bg-black/30 p-4">
    <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
    <div className="mt-2 flex items-center gap-2">
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? (nullable ? null : 0) : Number(e.target.value))}
        className="w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-lg font-semibold text-zinc-100 focus:border-violet-400/60 focus:outline-none"
      />
      {nullable && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
        >
          off
        </button>
      )}
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────────────────────
// Tab 4 — 30-Day Assessment Rollups
// ──────────────────────────────────────────────────────────────────────────────

const RollupsTab: React.FC = () => {
  const [rollups, setRollups] = useState<CurriculumAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, CURRICULUM_ASSESSMENTS_COLLECTION),
            orderBy('generatedAt', 'desc'),
            limit(50),
          ),
        );
        if (cancelled) return;
        setRollups(snap.docs.map((d) => d.data() as CurriculumAssessment));
      } catch {
        /* tolerate */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6 text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading rollups…
      </div>
    );
  }
  if (rollups.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6 text-sm text-zinc-400">
        No 30-day assessments yet. The first rollup will land on the 1st of next month.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rollups.map((r) => (
        <div key={r.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-xs text-zinc-500">{r.athleteUserId}</p>
              <h3 className="mt-1 text-base font-semibold">{r.yearMonth}</h3>
            </div>
            <div className="text-right text-xs text-zinc-400">
              <p>Adherence {Math.round(r.adherenceRate * 100)}%</p>
              <p>Streak {r.longestStreakDays} days</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
            {(['composure', 'focus', 'decision'] as TaxonomyPillar[]).map((p) => (
              <div key={p} className="rounded-lg border border-zinc-800 bg-black/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">{p}</p>
                <p className="mt-1 text-sm">{Math.round(r.repsByPillar[p])} / {Math.round(r.targetByPillar[p])}</p>
                <p className={`mt-1 text-xs ${r.gapByPillar[p] > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {r.gapByPillar[p] > 0 ? `${Math.round(r.gapByPillar[p])} short` : 'on target'}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-300">{r.reviewerNote}</p>
        </div>
      ))}
    </div>
  );
};

export default CurriculumLayerPage;
