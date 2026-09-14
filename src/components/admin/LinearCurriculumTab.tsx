import LinearPublicationReview from './LinearPublicationReview';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { validateLinearOrder, type LinearCurriculumEntry } from '../../api/firebase/dailyCurriculum/linearCurriculum';
import { loadLinearCurriculumCatalog, loadLinearCurriculumDraft, saveLinearCurriculumDraft } from '../../api/firebase/dailyCurriculum/linearCurriculumDraft';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Loader2, Lock, Save, Search } from 'lucide-react';

// Data binding is supplied by the curriculum draft service below.
type Entry = LinearCurriculumEntry;
type Draft = { orderedIds: string[]; rationales?: Record<string, string> };
type DataSource = { active: Entry[]; candidates: Entry[]; proposedOrder: string[]; load: () => Promise<Draft | null>; save: (draft: Draft) => Promise<void>; onPreview?: (entry: Entry) => void };

export const LinearCurriculumEditor: React.FC<DataSource> = ({ active, candidates, proposedOrder, load, save, onPreview }) => {
  const [ids, setIds] = useState<string[]>(proposedOrder);
  const [rationales, setRationales] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [candidateView, setCandidateView] = useState(false);
  const [undo, setUndo] = useState<Draft | null>(null);
  const remember = () => setUndo({ orderedIds: [...ids], rationales: { ...rationales } });
  const [positions, setPositions] = useState<Record<string, string>>({});
  const lookup = useMemo(() => new Map(active.map(entry => [entry.id, entry])), [active]);
  useEffect(() => {
    let cancelled = false;
    load().then(draft => {
      if (cancelled) return;
      setLoaded(true);
      if (draft) { setIds(draft.orderedIds); setRationales(draft.rationales || {}); setMessage('Saved draft loaded.'); }
      else { setDirty(true); setMessage(''); }
    }).catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the draft.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const missing = active.filter(entry => !ids.includes(entry.id));
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  const unknown = ids.filter(id => !lookup.has(id));
  const validation = validateLinearOrder(ids, active);
  const valid = validation.length === 0;
  const change = () => { setDirty(true); setMessage(''); };
  const move = (index: number, target: number) => {
    if (index === 0 || index < 0 || !Number.isInteger(target) || target < 1 || target >= ids.length) return;
    remember();
    setIds(current => { const next = [...current]; const [id] = next.splice(index, 1); next.splice(target, 0, id); return next; });
    setPositions({}); change();
  };
  const saveDraft = async () => {
    if (!loaded || !valid || saving) return;
    setSaving(true); setError(''); setMessage('');
    try { await save({ orderedIds: ids, rationales }); setDirty(false); setMessage('Draft saved in this browser. Live assignments are unchanged.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save the draft.'); }
    finally { setSaving(false); }
  };
  const exportDraft = () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, orderedIds: ids, rationales: Object.fromEntries(ids.map(id => [id, rationales[id] ?? lookup.get(id)?.rationale ?? ''])) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'linear-curriculum-draft.json'; link.click(); URL.revokeObjectURL(url);
  };
  const importDraft = async (file?: File) => {
    if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      if (!value || typeof value !== 'object') throw new Error('Choose a curriculum draft JSON file.');
      const draft = value as Record<string, unknown>;
      if (draft.schemaVersion !== 1) throw new Error('Choose a version 1 curriculum draft JSON file.');
      if (!Array.isArray(draft.orderedIds) || !draft.orderedIds.every(id => typeof id === 'string')) throw new Error('The draft must include an orderedIds list.');
      const issues = validateLinearOrder(draft.orderedIds, active);
      if (issues.length) throw new Error(issues.join(' '));
      const notes = draft.rationales ?? {};
      if (!notes || typeof notes !== 'object' || Array.isArray(notes) || Object.entries(notes).some(([id, v]) => !lookup.has(id) || typeof v !== 'string' || v.length > 4000)) throw new Error('Rationales must use active skill IDs and contain at most 4,000 characters each.');
      remember();
      setIds(draft.orderedIds); setRationales(notes as Record<string, string>); setPositions({}); setError(''); change(); setMessage('Imported for review. Save in this browser when ready.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not import this draft.'); }
  };
  const rows = ids.map((id, index) => ({ id, index, entry: lookup.get(id) })).filter(({ entry }) => filter === 'all' || (filter === 'classification' ? Boolean(entry && entry.catalogType !== entry.type) : filter === 'adaptation' ? Boolean(entry?.readiness.includes('adaptation')) : entry?.type === filter)).filter(({ id, entry }) => !search || `${entry?.name || id} ${entry?.type || ''} ${entry?.readiness || ''}`.toLowerCase().includes(search.toLowerCase()));
  const field = 'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 focus:border-teal-700 focus:outline-none';
  const button = 'rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-35';
  if (loading) return <div className="flex items-center gap-2 rounded-2xl border border-stone-200 p-6 text-stone-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading linear curriculum…</div>;
  return <section className="space-y-3">
    <div className="sticky top-0 z-20 rounded-lg border border-stone-200 bg-[#FAFAF7]/95 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Proposed skill sequence</h2><p className="mt-1 text-sm text-stone-600">{ids.length} / {active.length} active skills · {active.filter(e => e.type === 'protocol').length} proposed protocols · {active.filter(e => e.type === 'simulation').length} proposed simulations</p></div>
        <button onClick={saveDraft} disabled={!loaded || !valid || saving || !dirty} className="flex items-center gap-2 rounded-lg bg-stone-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft in this browser</button>
      </div>
      <p className="mt-2 text-xs text-stone-600">{dirty ? 'Unsaved draft changes' : 'No unsaved changes'} · 4-7-8 Breathing stays first · Browser draft only</p>
    </div>
    <details className="rounded-lg border border-stone-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold">Scope, category proposals & phase plan</summary>
      <div className="mt-3 space-y-2 text-sm leading-6 text-stone-600"><p>One shared skill-order proposal for review. Track applicability and enrollment have not been set. Existing Junior lessons and adult daily assignments continue under their current models.</p><p>This list counts each active skill once, combining linked catalog records. Named variants stay separate. Five guided activities are proposed as Protocols; their current catalog categories and review notes appear in row details. Active catalog status does not establish gameplay or content readiness.</p><p>Protocols: Learn → Practice → Use it, with journaling inside Use it. Each phase requires five distinct completion days within fourteen local calendar days. Missed days can be made up within that window. An unsuccessful window restarts only the current phase count, preserving history. Simulations: Practice → Use it, with journaling inside Use it. Simulation phase settings and athlete enrollment still need review.</p></div>
    </details>
    <LinearPublicationReview orderedIds={ids} rationales={rationales} active={active} />
    {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="h-5 w-5 shrink-0" />{error}</div>}
    {message && <div role="status" className="flex gap-2 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />{message}</div>}
    <div className={`rounded-lg border px-3 py-2 text-xs ${valid ? 'border-emerald-200 text-emerald-800' : 'border-amber-200 text-amber-900'}`}>
      {valid ? 'Complete sequence: every expected active skill appears exactly once.' : <><p className="font-semibold">Resolve sequence validation before saving.</p><p className="mt-1">Missing: {missing.length} · Duplicate entries: {duplicates.length} · Unknown entries: {unknown.length}</p>{missing.length > 0 && <p className="mt-2">Missing: {missing.map(e => e.name).join(', ')}</p>}{duplicates.length > 0 && <p>Duplicates: {duplicates.map(id => lookup.get(id)?.name || id).join(', ')}</p>}{unknown.length > 0 && <p>Unknown: {unknown.join(', ')}</p>}{validation.map((issue, i) => <p key={i}>{issue}</p>)}</>}
    </div>
    <div className="flex flex-wrap items-center gap-3">
    <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2"><Search className="h-4 w-4 text-stone-600" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ordered skills" aria-label="Search ordered skills" className={field} /></label><button className={button} disabled={saving} onClick={() => { remember(); setIds([...proposedOrder]); setRationales({}); setPositions({}); change(); }}>Restore proposed order</button></div>
    <div className="flex flex-wrap items-center gap-3"><button className={button} disabled={!valid || saving} onClick={exportDraft}>Export JSON</button><label className={`${button} cursor-pointer`}>Import JSON<input type="file" accept="application/json,.json" disabled={saving} className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void importDraft(file); }} /></label><button className={button} disabled={!undo || saving} onClick={() => { if (undo) { setIds(undo.orderedIds); setRationales(undo.rationales || {}); setUndo(null); change(); } }}>Undo last order change</button></div>
    <div className="flex flex-wrap items-center gap-3"><label className="text-sm text-stone-700">Show <select aria-label="Filter ordered skills" value={filter} onChange={e => setFilter(e.target.value)} className={field}><option value="all">All active skills</option><option value="protocol">Proposed protocols</option><option value="simulation">Proposed simulations</option><option value="classification">Category review</option><option value="adaptation">Mechanics adaptation needed</option></select></label><button className={button} aria-pressed={candidateView} onClick={() => setCandidateView(!candidateView)}>{candidateView ? 'Back to active sequence' : `View ${candidates.length} candidates`}</button></div>
    </div>
    <div hidden={candidateView}>
    <p className="mb-3 text-xs text-stone-600">Showing {rows.length} of {ids.length}. Positions always refer to the full sequence, including while searching.</p>
    <ol className="space-y-3" aria-label="Ordered active curriculum">
      {rows.map(({ id, index, entry }) => <li key={`${id}-${index}`} className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-start gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 font-semibold text-teal-800">{index + 1}</span><div className="min-w-0 flex-1"><h3 className="font-semibold">{entry?.name || id}</h3><div className="mt-1 flex flex-wrap gap-2 text-xs"><span className="rounded bg-stone-100 px-2 py-1 capitalize">{entry?.type || 'Unknown'}</span><span className="rounded bg-stone-100 px-2 py-1">{entry?.readiness || 'Needs review'}</span>{index === 0 && <span className="flex items-center gap-1 text-teal-800"><Lock className="h-3 w-3" /> Fixed first</span>}</div></div>
          <div className="flex flex-wrap items-center gap-2"><button aria-label={`Move ${entry?.name || id} up`} className={button} disabled={index <= 1 || saving} onClick={() => move(index, index - 1)}><ArrowUp className="h-4 w-4" /></button><button aria-label={`Move ${entry?.name || id} down`} className={button} disabled={index === 0 || index === ids.length - 1 || saving} onClick={() => move(index, index + 1)}><ArrowDown className="h-4 w-4" /></button><label className="text-xs text-stone-600">Position <input type="number" min={2} max={ids.length} value={positions[id] ?? index + 1} disabled={index === 0 || saving} onChange={e => setPositions(p => ({ ...p, [id]: e.target.value }))} aria-label={`Destination position for ${entry?.name || id}`} className={`${field} ml-1 w-20`} /></label><button className={button} disabled={index === 0 || saving || !Number.isInteger(Number(positions[id] ?? index + 1)) || Number(positions[id] ?? index + 1) < 2 || Number(positions[id] ?? index + 1) > ids.length} onClick={() => move(index, Number(positions[id] ?? index + 1) - 1)}>Move</button></div>
        </div>
        <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-teal-800">Rationale & review details</summary>
        {entry && onPreview && <button type="button" className={`${button} mt-3`} onClick={() => onPreview(entry)}>Preview {entry.name}</button>}
        {entry?.classificationReason && <p className="mt-3 text-xs leading-5 text-amber-900">Classification review: {entry.classificationReason}</p>}
        <label className="mt-3 block text-xs text-stone-600">Sequence rationale<textarea value={rationales[id] ?? entry?.rationale ?? ''} onChange={e => { setRationales(r => ({ ...r, [id]: e.target.value })); change(); }} disabled={saving} maxLength={4000} rows={2} className={`${field} mt-1 w-full leading-5`} /></label>
        </details>
      </li>)}
    </ol>
    {rows.length === 0 && <p className="text-sm text-stone-600">No ordered skills match this search.</p>}
    </div>
    {candidateView && <section aria-label="Candidate skills" className="rounded-lg border border-stone-200 bg-white p-4"><h3 className="font-semibold">Unpublished / candidate skills ({candidates.length})</h3><p className="mt-3 text-sm text-stone-600">Held outside the active sequence. These entries are not activated by saving this draft.</p><ul className="mt-4 divide-y divide-stone-200">{candidates.map(entry => <li key={entry.id} className="py-3"><p className="text-sm font-medium">{entry.name} <span className="ml-2 text-xs capitalize text-stone-600">{entry.type}</span></p><p className="mt-1 text-xs text-stone-600">{entry.readiness} · {entry.rationale}</p></li>)}</ul></section>}
  </section>;
};

export default function LinearCurriculumTab({ onPreview }: { onPreview?: (entry: Entry) => void }) {
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof loadLinearCurriculumCatalog>> | null>(null);
  const [error, setError] = useState('');
  const revision = useRef<number | null>(null);
  useEffect(() => { let cancelled = false; loadLinearCurriculumCatalog().then(value => { if (!cancelled) setCatalog(value); }).catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load curriculum catalog.'); }); return () => { cancelled = true; }; }, []);
  const source = useMemo<DataSource | null>(() => catalog ? {
    active: catalog.active, candidates: catalog.candidates, proposedOrder: catalog.proposedOrder,
    load: async () => { const draft = await loadLinearCurriculumDraft(); revision.current = draft?.revision ?? null; return draft; },
    save: async draft => { const saved = await saveLinearCurriculumDraft({ ...draft, rationales: draft.rationales || {}, expectedRevision: revision.current, catalogFingerprint: catalog.fingerprint }); revision.current = saved.revision; },
  } : null, [catalog]);
  if (error) return <div role="alert" className="rounded-xl border border-rose-200 p-5 text-sm text-rose-800">{error}</div>;
  if (!source) return <div className="flex items-center gap-2 rounded-2xl border border-stone-200 p-6 text-sm text-stone-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading curriculum catalog…</div>;
  return <div className="space-y-4"><p role="status" className="text-xs leading-5 text-stone-600">{catalog?.sourceLabel}</p><LinearCurriculumEditor {...source} onPreview={onPreview} /></div>;
}
