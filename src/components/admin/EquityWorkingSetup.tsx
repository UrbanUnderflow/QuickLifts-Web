import React, { useEffect, useRef, useState } from 'react';
import { doc, getDoc, runTransaction, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../api/firebase/config';

import { buildWorkingCapitalizationSave, restoreWorkingCapitalization, validateWorkingCapitalization, workingSetupBaseline, type WorkingCapitalization, type WorkingAllocation, type WorkingCapitalizationHistory } from '../../lib/equityWorkingCapitalization';
export type { WorkingCapitalization, WorkingAllocation, WorkingCapitalizationHistory } from '../../lib/equityWorkingCapitalization';

export interface EquityWorkingSetupProps {
  document: { id: string; title: string; workingCapitalization?: WorkingCapitalization };
  recordedFounderShares: number;
  initialShowHistory?: boolean;
  onSaved: () => void;
  onClose: () => void;
}

const emptySetup = (): WorkingCapitalization => ({ founderShares: null, strategicReserve: null, allocations: [] });
const inputClass = 'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white';
const buttonClass = 'rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50';
const count = (value: number | null) => value === null ? 'Unspecified' : value.toLocaleString();

export default function EquityWorkingSetup({ document: planDocument, recordedFounderShares, onSaved, onClose, initialShowHistory = false }: EquityWorkingSetupProps) {
  const [setup, setSetup] = useState<WorkingCapitalization>(planDocument.workingCapitalization || emptySetup());
  const [history, setHistory] = useState<WorkingCapitalizationHistory[]>([]);
  const [showHistory, setShowHistory] = useState(initialShowHistory);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);
  const baseline = useRef('');

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, 'equity-documents', 'equity-working-capitalization')).then(snapshot => {
      if (cancelled) return;
      const data = snapshot.exists() ? snapshot.data() : {};
      if (snapshot.exists() && data.documentType !== 'capitalization_working_setup') throw new Error('The working setup record needs review.');
      baseline.current = workingSetupBaseline(data.workingCapitalization);
      setSetup(data.workingCapitalization || emptySetup());
      setHistory(data.workingCapitalizationHistory || []);
      setLoading(false);
    }).catch(reason => { if (!cancelled) { setError(reason.message || 'Could not load the working setup.'); } });
    return () => { cancelled = true; };
  }, [planDocument.id]);

  const updateAllocation = (id: string, changes: Partial<WorkingAllocation>) => {
    setSetup(current => ({ ...current, allocations: current.allocations.map(row => row.id === id ? { ...row, ...changes } : row) }));
  };
  const numberValue = (value: string) => value === '' ? null : Number(value);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try { validateWorkingCapitalization(setup); } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Check the working setup entries.');
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) { setError('Sign in before saving the working setup.'); return; }
    setSaving(true);
    try {
      await runTransaction(db, async transaction => {
        const reference = doc(db, 'equity-documents', 'equity-working-capitalization');
        const source = await transaction.get(doc(db, 'equity-documents', planDocument.id));
        const snapshot = await transaction.get(reference);
        const update = buildWorkingCapitalizationSave({
          current: snapshot.exists() ? snapshot.data() : undefined,
          baseline: baseline.current,
          setup,
          sourcePlanId: planDocument.id,
          sourcePlan: source.exists() ? source.data() : undefined,
          uid,
          now: Timestamp.now(),
        });
        transaction.set(reference, update, { merge: true });
      });
      onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the working setup.');
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="working-setup-title" className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-white">
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="working-setup-title" className="text-2xl font-semibold">Working setup</h2><p className="mt-1 text-sm text-zinc-400">Equity incentive plan</p></div>
        <button type="button" aria-label="Close working setup" disabled={saving} onClick={onClose} className={buttonClass}>Close</button>
      </div>
      <p className="my-4 text-sm text-zinc-300">Planning entries stay pending until approved. Saving here updates the working setup; legal approvals and issued ownership are recorded separately.</p>
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-800 bg-red-950/30 p-3 text-red-200">{error}</p>}
      {loading && !error && <p role="status">Loading working setup…</p>}
      <form onSubmit={save}>
        <fieldset disabled={loading || saving} className="space-y-5 disabled:opacity-50">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">Founder shares<input className={inputClass} type="number" min="0" step="1" value={setup.founderShares ?? ''} onChange={event => setSetup(current => ({ ...current, founderShares: numberValue(event.target.value) }))} /><span className="block text-xs text-zinc-400">Recorded founder shares: {recordedFounderShares.toLocaleString()}. Leave blank if undecided.</span></label>
            <label className="space-y-2 text-sm">Strategic reserve<input className={inputClass} type="number" min="0" step="1" value={setup.strategicReserve ?? ''} onChange={event => setSetup(current => ({ ...current, strategicReserve: numberValue(event.target.value) }))} /><span className="block text-xs text-zinc-400">Shares reserved for strategic allocations.</span></label>
          </div>
          <div className="flex items-center justify-between"><h3 className="font-semibold">Planned allocations</h3><button className={buttonClass} type="button" onClick={() => setSetup(current => ({ ...current, allocations: [...current.allocations, { id: crypto.randomUUID(), name: '', kind: 'other', percentage: null, shares: null, notes: '' }] }))}>Add allocation</button></div>
          {setup.allocations.map((row, index) => <fieldset key={row.id} className="space-y-3 rounded-xl border border-zinc-700 p-4">
            <legend className="px-2 text-sm text-zinc-400">Allocation {index + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">Name<input required className={inputClass} value={row.name} onChange={event => updateAllocation(row.id, { name: event.target.value })} /></label>
              <label className="space-y-1 text-sm">Equity type<select className={inputClass} value={row.kind} onChange={event => updateAllocation(row.id, { kind: event.target.value as WorkingAllocation['kind'] })}><option value="other">Other / undecided</option><option value="options">Options</option><option value="vesting_shares">Vesting shares</option><option value="warrant">Warrant</option></select></label>
              <label className="space-y-1 text-sm">Percentage<input className={inputClass} type="number" min="0" max="100" step="any" value={row.percentage ?? ''} onChange={event => updateAllocation(row.id, { percentage: numberValue(event.target.value) })} /></label>
              <label className="space-y-1 text-sm">Shares<input className={inputClass} type="number" min="0" step="1" value={row.shares ?? ''} onChange={event => updateAllocation(row.id, { shares: numberValue(event.target.value) })} /></label>
            </div>
            <label className="block space-y-1 text-sm">Notes<textarea className={inputClass} rows={2} value={row.notes} onChange={event => updateAllocation(row.id, { notes: event.target.value })} /></label>
            <button type="button" className={buttonClass} aria-label={`Remove allocation ${index + 1}`} onClick={() => setSetup(current => ({ ...current, allocations: current.allocations.filter(item => item.id !== row.id) }))}>Remove allocation</button>
          </fieldset>)}
          {restored && <p role="status" className="text-sm text-amber-200">Earlier entries loaded. Save working setup to make them current and keep today’s saved entries in history.</p>}
          <div className="flex flex-wrap justify-between gap-3">
            <button type="button" className={buttonClass} aria-expanded={showHistory} onClick={() => setShowHistory(value => !value)}>{showHistory ? 'Hide change history' : 'Change history'}</button>
            <button type="submit" className="rounded-lg bg-[#D2FF00] px-4 py-2 font-semibold text-black disabled:opacity-50">{saving ? 'Saving…' : 'Save working setup'}</button>
          </div>
          {showHistory && <div className="space-y-3 border-t border-zinc-700 pt-4"><h3 className="font-semibold">Working setup history</h3><p className="text-sm text-zinc-400">Restoring entries creates a new saved setup. Document approvals keep their own record.</p>{!history.length && <p className="text-sm text-zinc-400">No previous saved setups.</p>}{[...history].reverse().map((entry, index) => <div key={index} className="rounded-lg border border-zinc-700 p-4 text-sm"><p className="mb-2 text-zinc-400">Replaced {entry.replacedAt?.toDate?.().toLocaleString() || 'on an earlier date'}</p><p>Founder shares: {count(entry.founderShares)} · Strategic reserve: {count(entry.strategicReserve)}</p>{entry.allocations.map(row => <p key={row.id} className="mt-1">{row.name}: {count(row.shares)} shares{row.percentage !== null ? ` · ${row.percentage}%` : ''}{row.notes ? ` · ${row.notes}` : ''}</p>)}<button type="button" className={`${buttonClass} mt-3`} onClick={() => { setSetup(restoreWorkingCapitalization(entry)); setRestored(true); setShowHistory(false); }}>Restore these entries</button></div>)}</div>}
        </fieldset>
      </form>
    </section>
  </div>;
}
