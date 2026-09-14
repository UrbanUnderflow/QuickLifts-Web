// Existing curriculum operations, embedded by the canonical curriculum outline.
import React, { useEffect, useState } from 'react';
import ModuleInsightsPanel from './ModuleInsightsPanel';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Info,
  Loader2,
  Power,
  Route,
  Settings2,
  Target,
} from 'lucide-react';
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import {
  CurriculumConfig,
  PillarWeights,
  ProgressionLevel,
  PROGRESSION_LEVELS,
  DEFAULT_FREQUENCY_PER_30_DAYS,
  resolveFrequency,
  validateCurriculumConfig,
} from '../../api/firebase/dailyCurriculum/types';
import {
  getCurriculumConfig,
  updateCurriculumConfig,
  buildDefaultCurriculumConfig,
} from '../../api/firebase/dailyCurriculum/curriculumConfig';
import type { PulseCheckProtocolDefinition, MentalExercise } from '../../api/firebase/mentaltraining/types';


export type CurriculumOperationsTab = 'pillar' | 'mapping' | 'engine' | 'rollups' | 'transparency';
export interface CurriculumOperationsPanelProps {
  initialTab?: string;
  onTabChange?: (tab: CurriculumOperationsTab) => void;
  mode?: 'settings' | 'reports';
}
const TABS: Array<{ key: CurriculumOperationsTab; label: string; icon: React.ReactNode }> = [
  { key: 'pillar', label: 'Training balance', icon: <Brain className="h-4 w-4" /> },
  { key: 'mapping', label: 'Skill assignment metadata (view only)', icon: <Settings2 className="h-4 w-4" /> },
  { key: 'engine', label: 'Schedule & frequency', icon: <Power className="h-4 w-4" /> },
  { key: 'transparency', label: 'Athlete Transparency', icon: <Info className="h-4 w-4" /> },
];
const resolveOperationsTab = (tab: string | undefined, mode: 'settings' | 'reports'): CurriculumOperationsTab => mode === 'reports' ? 'rollups' : TABS.some(item => item.key === tab && item.key !== 'rollups') ? tab as CurriculumOperationsTab : 'pillar';
const CurriculumOperationsPanel: React.FC<CurriculumOperationsPanelProps> = ({ initialTab, onTabChange, mode = 'settings' }) => {
  const [activeTab, setActiveTab] = useState<CurriculumOperationsTab>(() => resolveOperationsTab(initialTab, mode));
  const [config, setConfig] = useState<CurriculumConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setActiveTab(resolveOperationsTab(initialTab, mode)); }, [initialTab, mode]);
  useEffect(() => {
    if (mode === 'reports') return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        let c = await getCurriculumConfig();
        if (!c) c = buildDefaultCurriculumConfig();
        if (!cancelled) setConfig(c);
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load config'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [mode]);
  return <section className="space-y-6 text-stone-900">
    {mode === 'settings' && <nav aria-label="Curriculum operations" className="flex gap-2 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-2">
      {TABS.filter(tab => tab.key !== 'rollups' && tab.key !== 'transparency').map(tab => <button key={tab.key} onClick={() => { setActiveTab(tab.key); onTabChange?.(tab.key); }} aria-current={activeTab === tab.key ? 'page' : undefined} className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${activeTab === tab.key ? 'border-teal-300 bg-teal-50 text-teal-900' : 'border-transparent text-stone-600 hover:bg-stone-100 hover:text-stone-900'}`}>{tab.icon}{tab.label}</button>)}
    </nav>}
    {mode === 'reports' ? <ModuleInsightsPanel /> : <>
      <details open={activeTab === 'transparency' ? true : undefined} className="rounded-xl border border-stone-200 bg-white p-4"><summary className="cursor-pointer font-medium">What athletes see</summary><div className="mt-4"><TransparencyTab /></div></details>
      {error && <div role="alert" className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertTriangle className="h-4 w-4" /><span>{error}</span></div>}
      {loading ? <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-6 text-stone-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading curriculum config…</div> : config && <>
        <div hidden={activeTab !== 'pillar' && activeTab !== 'transparency'}><PillarTab config={config} setConfig={setConfig} /></div>
        <div hidden={activeTab !== 'mapping'}><MappingTab config={config} /></div>
        <div hidden={activeTab !== 'engine'}><EngineTab config={config} setConfig={setConfig} /></div>
      </>}
    </>}
  </section>;
};

// ──────────────────────────────────────────────────────────────────────────────
// Tab 5 — Athlete Transparency
// ──────────────────────────────────────────────────────────────────────────────

const TransparencyTab: React.FC = () => (
  <section className="space-y-6">
    <div className="rounded-2xl border border-teal-200 bg-teal-50 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-2 text-teal-900">
          <Info className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Assignment Intent Contract</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
            Repeated sims and protocols must feel like coaching, not a stuck queue. Curriculum-engine assignments now
            persist a <code className="rounded bg-stone-50 px-1">curriculumIntent</code> object so athlete surfaces can
            explain why the same work is appearing, how much work is planned, and what moves the athlete forward.
            Home and the Training Room should show that explanation before launch, even when the app falls back to
            today&apos;s DailyTask rationale because older assignment records do not carry the full intent object yet.
          </p>
        </div>
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-stone-500">
          <Info className="h-4 w-4 text-teal-800" />
          Why This Today
        </div>
        <p className="mt-3 text-sm leading-6 text-stone-700">
          The UI should name the actual protocol or sim and the driving pillar gap. If the athlete has seen it before,
          the badge says <span className="font-semibold text-teal-800">Same by design</span>.
        </p>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-stone-500">
          <Target className="h-4 w-4 text-blue-800" />
          How Long
        </div>
        <p className="mt-3 text-sm leading-6 text-stone-700">
          The assignment shows rep progress, target reps, and the review window. The first implementation uses the
          asset&apos;s <code className="rounded bg-stone-50 px-1">recommendedFrequencyPer30Days</code> as the planned dose.
        </p>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-stone-500">
          <Route className="h-4 w-4 text-purple-800" />
          How They Move On
        </div>
        <p className="mt-3 text-sm leading-6 text-stone-700">
          The UI names the progression criteria and the next likely move so repetition has an endpoint instead of
          feeling random.
        </p>
      </div>
    </div>

    <div className="rounded-2xl border border-stone-200 bg-white p-6">
      <h3 className="text-base font-semibold">Athlete-facing copy shape</h3>
      <div className="mt-4 space-y-4 text-sm text-stone-700">
        <div className="border-l border-teal-300 pl-4">
          <p className="text-[10px] uppercase tracking-wide text-stone-500">Badge</p>
          <p className="mt-1 font-semibold text-teal-800">Same by design · Rep 4 of 7</p>
        </div>
        <div className="border-l border-white/10 pl-4">
          <p className="text-[10px] uppercase tracking-wide text-stone-500">Why this today</p>
          <p className="mt-1">
            Fakeout Brake Point is queued because decision control has the biggest practice gap in your recent work.
            You have seen it before because repetition is the point, not a random repeat.
          </p>
        </div>
        <div className="border-l border-white/10 pl-4">
          <p className="text-[10px] uppercase tracking-wide text-stone-500">How you move on</p>
          <p className="mt-1">Move forward after the planned reps in this window or 3 steady completions in a row.</p>
        </div>
      </div>
    </div>

    <div className="rounded-2xl border border-stone-200 bg-white p-6">
      <h3 className="text-base font-semibold">Debug posture</h3>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        If an athlete gets the same work repeatedly, operators should be able to tell whether it came from intentional
        frequency dosing, a coach pin, thin eligible inventory, missing completion events, or a generator fallback. The
        generation trace remains the operator audit trail; <code className="rounded bg-stone-50 px-1">curriculumIntent</code>{' '}
        is the athlete-safe version.
      </p>
    </div>
  </section>
);

// ──────────────────────────────────────────────────────────────────────────────
// Tab 1 — Pillar Configuration
// ──────────────────────────────────────────────────────────────────────────────

const useUnsavedSettingsWarning = (dirty: boolean) => {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
};

const PillarTab: React.FC<{ config: CurriculumConfig; setConfig: (c: CurriculumConfig) => void }> = ({ config, setConfig }) => {
  const [weights, setWeights] = useState<PillarWeights>(config.defaultPillarWeights);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState('');
  const validation = validateCurriculumConfig({ ...config, defaultPillarWeights: weights });
  const dirty = JSON.stringify(weights) !== JSON.stringify(config.defaultPillarWeights);
  useUnsavedSettingsWarning(dirty);

  const handleSave = async () => {
    if (!validation.ok) return;
    setSaveError(''); setSavedAt(null); setSaving(true);
    try {
      const next = await updateCurriculumConfig(
        { defaultPillarWeights: weights },
        { summary: `Default pillar weights updated to ${weights.composure}/${weights.focus}/${weights.decision}.` },
      );
      setConfig(next);
      setSavedAt(Date.now());
    } catch (err) { setSaveError(err instanceof Error ? err.message : 'Could not save training balance.'); } finally {
      setSaving(false);
    }
  };

  const sum = weights.composure + weights.focus + weights.decision;
  const pct = (v: number) => (sum > 0 ? Math.round((v / sum) * 100) : 0);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">Training balance</h2>
        <p className="mt-1 text-sm text-stone-600">
          Drives the daily generator's pillar-balance selection. Equal split (33/33/33) is the default. Per-sport overrides
          override these defaults. The engine normalizes the sum, so values don't need to add to 100.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {(['composure', 'focus', 'decision'] as Array<keyof PillarWeights>).map((p) => (
          <div key={p} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-[10px] uppercase tracking-wide text-stone-500">{p}</p>
            <input
              type="number"
              min={0}
              value={weights[p]}
              onChange={(e) => { setSavedAt(null); setWeights({ ...weights, [p]: Number(e.target.value) || 0 }); }}
              className="mt-2 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-lg font-semibold text-stone-900 focus:border-teal-500 focus:outline-none"
            />
            <p className="mt-2 text-xs text-stone-500">{pct(weights[p])}% normalized share</p>
          </div>
        ))}
      </div>
      {!validation.ok && <p role="alert" className="mt-4 text-sm text-rose-800">{validation.issues.map(issue => issue.message).join('; ')}</p>}
      {saveError && <p role="alert" className="mt-4 text-sm text-rose-800">{saveError}</p>}
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !validation.ok}
          className="inline-flex items-center gap-2 rounded-xl border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-900 transition hover:bg-teal-100 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Save training balance
        </button>
        {savedAt && (
          <span className="text-xs text-emerald-800">Saved · revision {config.revisionId.slice(0, 18)}…</span>
        )}
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold">Per-sport overrides</h3>
        <p className="mt-1 text-xs text-stone-500">
          Sport-specific settings are view only here. Sports without a custom setting use the defaults above.
        </p>
        <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-600">
          {Object.keys(config.pillarWeightsBySport || {}).length === 0
            ? 'No per-sport overrides configured. All sports use the defaults above.'
            : Object.entries(config.pillarWeightsBySport || {}).map(([sportId, w]) => (
                <div key={sportId} className="flex items-center justify-between border-b border-stone-200 py-2 last:border-b-0">
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
  const [error, setError] = useState('');

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
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load assignment metadata.'); } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const unmappedProtocols = protocols.filter((p) => !p.cognitivePillar);
  const unmappedSims = sims.filter((s) => !s.taxonomy?.primaryPillar);

  return (
    <section className="space-y-6">
      <p className="text-sm text-stone-600">View only. Shows up to 100 active protocols and 100 active simulation modules from the current library. This is assignment metadata, separate from the editable sequence.</p>
      {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
      {!loading && !error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>{unmappedProtocols.length}</strong> protocols and <strong>{unmappedSims.length}</strong> sims have no <code className="rounded bg-stone-50 px-1">cognitivePillar</code> set today.
        These skills need assignment metadata before the current scheduler can select them. This section is view only; it does not edit skills or the ordered draft.
      </div>}

      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <h3 className="mb-3 text-base font-semibold">Protocols ({protocols.length})</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-stone-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-stone-500">
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
                    <tr key={p.id} className="border-t border-stone-200">
                      <td className="py-2 pr-4 font-medium">{p.label}</td>
                      <td className="py-2 pr-4">{p.cognitivePillar || <span className="text-rose-700">unset</span>}</td>
                      <td className="py-2 pr-4">{progression}</td>
                      <td className="py-2 pr-4">{p.recommendedFrequencyPer30Days ?? '—'}</td>
                      <td className="py-2 pr-4 text-stone-600">{resolved}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <h3 className="mb-3 text-base font-semibold">Simulations ({sims.length})</h3>
        {loading ? null : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-stone-500">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Pillar (taxonomy)</th>
                  <th className="py-2 pr-4">Progression</th>
                  <th className="py-2 pr-4">Recommended /30d</th>
                </tr>
              </thead>
              <tbody>
                {sims.map((s) => (
                  <tr key={s.id} className="border-t border-stone-200">
                    <td className="py-2 pr-4 font-medium">{s.name}</td>
                    <td className="py-2 pr-4">{s.taxonomy?.primaryPillar || <span className="text-rose-700">unset</span>}</td>
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
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const validation = validateCurriculumConfig({ ...config, engineEnabled: enabled, notificationCadence: cadence, frequencyTargetsByLevel: freqTargets });
  useEffect(() => { setSaved(false); }, [enabled, cadence, freqTargets]);
  const dirty = enabled !== config.engineEnabled || JSON.stringify(cadence) !== JSON.stringify(config.notificationCadence) || JSON.stringify(freqTargets) !== JSON.stringify(config.frequencyTargetsByLevel);
  useUnsavedSettingsWarning(dirty);

  const handleSave = async () => {
    if (!validation.ok) return;
    setSaveError(''); setSaved(false); setSaving(true);
    try {
      const next = await updateCurriculumConfig(
        { engineEnabled: enabled, notificationCadence: cadence, frequencyTargetsByLevel: freqTargets },
        { summary: `Engine config updated. Enabled=${enabled}; cadence morning/midday/evening=${cadence.morningHourLocal}/${cadence.middayHourLocal}/${cadence.eveningHourLocal}.` },
      );
      setConfig(next); setSaved(true);
    } catch (err) { setSaveError(err instanceof Error ? err.message : 'Could not save schedule and frequency.'); } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <h3 className="mb-3 text-base font-semibold">Daily assignments</h3>
        <label className="inline-flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 bg-white"
          />
          <span>{enabled ? 'Daily assignment scheduling is enabled.' : 'Daily assignment scheduling is disabled.'}</span>
        </label>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6">
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

      <div className="rounded-2xl border border-stone-200 bg-white p-6">
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

      {!validation.ok && <p role="alert" className="text-sm text-rose-800">{validation.issues.map(issue => `${issue.field}: ${issue.message}`).join('; ')}</p>}
      {saveError && <p role="alert" className="text-sm text-rose-800">{saveError}</p>}
      {saved && <p role="status" className="text-sm text-emerald-800">Schedule and frequency saved.</p>}
      <button
        onClick={handleSave}
        disabled={saving || !validation.ok}
        className="inline-flex items-center gap-2 rounded-xl border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-900 transition hover:bg-teal-100 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Save schedule & frequency
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
  <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
    <p className="text-[10px] uppercase tracking-wide text-stone-500">{label}</p>
    <div className="mt-2 flex items-center gap-2">
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? (nullable ? null : 0) : Number(e.target.value))}
        className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-lg font-semibold text-stone-900 focus:border-teal-500 focus:outline-none"
      />
      {nullable && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
        >
          off
        </button>
      )}
    </div>
  </div>
);

export default CurriculumOperationsPanel;
