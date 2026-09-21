import React, { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../api/firebase/config';
import { evidenceRequest, saveEvidence, recordEvidenceEvent, type EvidenceEntry } from '../../../api/firebase/evidenceJournalClient';

type Props = { initialMoment?: string; sourceAssignmentId?: string; sourceSkillName?: string; onClose?: () => void };
const button = 'rounded-lg border border-white/30 px-4 py-2 text-sm text-white disabled:opacity-40';
const field = 'w-full rounded-lg border border-white/25 bg-zinc-950 p-3 text-white';

export default function EvidenceJournal(props: Props) {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, user => setOwnerId(user?.uid || null)), []);
  if (!ownerId || auth.currentUser?.uid !== ownerId) return null;
  return <AccountEvidence key={ownerId} ownerId={ownerId} {...props} />;
}

function AccountEvidence({ ownerId, initialMoment, sourceAssignmentId, sourceSkillName, onClose }: Props & { ownerId: string }) {
  const [view, setView] = useState<'closed' | 'add' | 'history'>(initialMoment === undefined ? 'closed' : 'add');
  const [moment, setMoment] = useState(initialMoment || ''), [action, setAction] = useState('');
  const [entries, setEntries] = useState<EvidenceEntry[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false), [query, setQuery] = useState(''), [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [usedThisVisit, setUsedThisVisit] = useState(false), [revisitFailed, setRevisitFailed] = useState(false);
  const visit = useRef<{ entryId: string; revisitId: string; useId: string; used: boolean } | null>(null);
  const mounted = useRef(true), draftId = useRef<string | null>(null), operation = useRef(false);
  const active = () => mounted.current && auth.currentUser?.uid === ownerId;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (work: () => Promise<void>) => {
    if (operation.current || !active()) return;
    operation.current = true; setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (err) { if (active()) setError(err instanceof Error ? err.message : 'Please try again.'); }
    finally { operation.current = false; if (active()) setBusy(false); }
  };
  const load = (more = false) => run(async () => {
    const result = await evidenceRequest<{ entries: EvidenceEntry[]; nextCursor: string | null }>(ownerId, `?${new URLSearchParams({ limit: '20', ...(more && cursor ? { cursor } : {}) })}`);
    if (!active()) return;
    setEntries(previous => more ? [...previous, ...result.entries.filter(entry => !previous.some(old => old.id === entry.id))] : result.entries);
    setCursor(result.nextCursor); setLoaded(true);
  });
  const save = () => run(async () => {
    draftId.current ||= crypto.randomUUID();
    const result = await saveEvidence(ownerId, { entryId: draftId.current, moment: moment.trim(), ...(action.trim() ? { action: action.trim() } : {}), ...(sourceAssignmentId ? { sourceAssignmentId } : {}), ...(sourceSkillName ? { sourceSkillName } : {}) });
    if (!active()) return;
    setEntries(previous => [result.entry, ...previous.filter(entry => entry.id !== result.entry.id)]);
    if (!result.created && (result.entry.moment !== moment.trim() || (result.entry.action || '') !== action.trim())) {
      setNotice('This reflection already has a saved entry. Your new writing is still here. Open Look back to see the saved moment.');
      return;
    }
    setMoment(''); setAction(''); draftId.current = null; setView('closed'); setNotice('Moment saved to your evidence.');
  });
  const recordVisit = () => run(async () => {
    const current = visit.current;
    if (!current) return;
    try {
      await recordEvidenceEvent(ownerId, current.entryId, 'revisited', current.revisitId);
      if (active() && visit.current === current) setRevisitFailed(false);
    } catch (err) {
      if (active() && visit.current === current) setRevisitFailed(true);
      throw err;
    }
  });
  const useReminder = () => run(async () => {
    const current = visit.current;
    if (!current || current.used) return;
    await recordEvidenceEvent(ownerId, current.entryId, 'used', current.useId);
    if (!active() || visit.current !== current) return;
    current.used = true; setUsedThisVisit(true); setNotice('Recorded that you used this reminder.');
  });
  const openEntry = (entry: EvidenceEntry) => {
    if (operation.current || !active()) return;
    visit.current = { entryId: entry.id, revisitId: crypto.randomUUID(), useId: crypto.randomUUID(), used: false };
    setSelected(entry.id); setDeleteId(null); setUsedThisVisit(false); setRevisitFailed(false);
    void recordVisit();
  };
  const share = (entry: EvidenceEntry, copy: boolean) => run(async () => {
    const text = `${entry.moment}${entry.action ? `\n\nWhat I did: ${entry.action}` : ''}`;
    if (copy) { await navigator.clipboard.writeText(text); if (active()) setNotice('This entry was copied. You choose where to share it.'); }
    else { try { await navigator.share({ title: 'A moment I want to remember', text }); } catch (err) { if (err instanceof Error && err.name === 'AbortError') return; throw err; } }
  });
  const remove = (id: string) => run(async () => {
    await evidenceRequest(ownerId, `?${new URLSearchParams({ entryId: id })}`, { method: 'DELETE' });
    if (!active()) return;
    setEntries(previous => previous.filter(entry => entry.id !== id)); setSelected(null); setDeleteId(null);
    if (cursor === id) { setCursor(null); setLoaded(false); }
    setNotice('Entry deleted.');
  });
  const filtered = entries.filter(entry => `${entry.moment} ${entry.action || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const selectedEntry = entries.find(entry => entry.id === selected);
  return <section aria-label="Your evidence" className="space-y-4 rounded-2xl border border-white/15 bg-zinc-900 p-5 text-white">
    <header className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Your evidence</h2><p className="mt-1 text-sm text-zinc-300">Keep moments you want to remember, in sport or outside it. An imperfect day can still hold a moment when you tried, learned, or kept going.</p></div>{onClose && <button type="button" onClick={onClose} className={button}>Close</button>}</header>
    <p className="text-xs text-zinc-400">Private to you. You choose if you share an entry.</p>
    <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className={button} onClick={() => { setView('add'); setNotice(''); }}>Add a moment</button><button type="button" disabled={busy} className={button} onClick={() => { setView('history'); setSelected(null); if (!loaded) void load(); }}>Look back</button></div>
    {view === 'add' && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label className="block space-y-2"><span>What happened today that you want to remember?</span><textarea required maxLength={4000} rows={4} className={field} value={moment} disabled={busy} onChange={event => { setMoment(event.target.value); draftId.current = null; }} /></label>
      <label className="block space-y-2"><span>What did you do that made that possible? <span className="text-zinc-400">(optional)</span></span><textarea maxLength={2000} rows={2} className={field} value={action} disabled={busy} onChange={event => { setAction(event.target.value); draftId.current = null; }} /></label>
      <div className="flex gap-3"><button type="submit" disabled={busy || !moment.trim()} className={button}>{busy ? 'Saving…' : 'Save moment'}</button><button type="button" disabled={busy} className={button} onClick={() => setView('closed')}>Keep writing later</button></div>
      <p className="text-xs text-zinc-400">Unsaved writing stays here until you leave this page.</p>
    </form>}
    {view === 'history' && <div className="space-y-4">
      <label className="block space-y-2"><span className="text-sm">Search loaded entries</span><input type="search" className={field} value={query} onChange={event => setQuery(event.target.value)} /></label>
      {loaded && filtered.length === 0 && <p className="text-sm text-zinc-300">{entries.length ? 'No matching moments in the entries loaded so far.' : 'Your moments will appear here after you save one.'}</p>}
      <ul className="space-y-2">{filtered.map(entry => <li key={entry.id}><button type="button" disabled={busy} onClick={() => openEntry(entry)} className="w-full rounded-lg border border-white/20 p-3 text-left disabled:opacity-40"><span className="block text-xs text-zinc-400">{new Date(entry.createdAt).toLocaleDateString()}</span><span className="mt-1 block whitespace-pre-wrap break-words">{entry.moment.slice(0, 180)}{entry.moment.length > 180 ? '…' : ''}</span></button></li>)}</ul>
      {selectedEntry && <article aria-label="Saved moment" className="space-y-3 rounded-xl border border-white/25 bg-zinc-950 p-4"><p className="whitespace-pre-wrap break-words">{selectedEntry.moment}</p>{selectedEntry.action && <div><h3 className="text-sm text-zinc-400">What I did</h3><p className="whitespace-pre-wrap break-words">{selectedEntry.action}</p></div>}
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || usedThisVisit} className={button} onClick={() => void useReminder()}>{usedThisVisit ? 'Use recorded' : 'I used this reminder'}</button>{typeof navigator !== 'undefined' && !!navigator.share && <button type="button" disabled={busy} className={button} onClick={() => void share(selectedEntry, false)}>Share this entry</button>}<button type="button" disabled={busy} className={button} onClick={() => void share(selectedEntry, true)}>Copy this entry</button><button type="button" disabled={busy} className={button} onClick={() => setDeleteId(selectedEntry.id)}>Delete</button></div>
        {revisitFailed && <button type="button" disabled={busy} className={button} onClick={() => void recordVisit()}>Retry recording this visit</button>}
        {deleteId === selectedEntry.id && <div className="space-y-2"><p>Delete this moment from your evidence?</p><button type="button" disabled={busy} className={button} onClick={() => void remove(selectedEntry.id)}>Delete entry</button><button type="button" disabled={busy} className={`${button} ml-2`} onClick={() => setDeleteId(null)}>Keep entry</button></div>}
      </article>}
      {cursor && <button type="button" disabled={busy} className={button} onClick={() => void load(true)}>Load older moments</button>}
      {!loaded && !busy && <button type="button" className={button} onClick={() => void load()}>Load moments</button>}
    </div>}
    {busy && <p role="status" className="text-sm text-zinc-300">Updating your evidence…</p>}{notice && <p role="status" className="text-sm text-zinc-200">{notice}</p>}{error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
  </section>;
}
