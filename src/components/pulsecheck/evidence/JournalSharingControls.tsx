import React, {useEffect, useRef, useState} from 'react';
import {getJournalSharing, updateJournalSharing, type JournalSharingContext} from '../../../api/firebase/evidenceJournalClient';
const button = 'rounded-lg border border-white/30 px-4 py-2 text-sm text-white disabled:opacity-40';
export default function JournalSharingControls({ownerId, entryId, disabled = false, refreshKey = 0, onBusyChange}: {ownerId: string; entryId: string; disabled?: boolean; refreshKey?: number; onBusyChange?: (busy: boolean) => void}) {
  const [context, setContext] = useState<JournalSharingContext | null>(null);
  const [scopeKey, setScopeKey] = useState('');
  const [confirm, setConfirm] = useState<'entry' | 'future' | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reply, setReply] = useState('');
  const generation = useRef(0);
  useEffect(() => {onBusyChange?.(busy); return () => onBusyChange?.(false);}, [busy, onBusyChange]);
  const isShared = context?.sharing?.status === 'shared';
  const load = async (token: number) => {const result = await getJournalSharing(ownerId, entryId); if (token === generation.current) setContext(result);};
  useEffect(() => {const token = ++generation.current; setContext(null); setBusy(false); setError(''); setReply(''); setConfirm(null); setScopeKey(''); setAccepted(false); void load(token).catch(() => {if (token === generation.current) setError('Sharing settings could not load. Your entry has not been shared by this action.');}); return () => {generation.current++;};}, [ownerId, entryId, refreshKey]);
  const scope = context?.scopes.find(item => (item.teamId || 'personal') === scopeKey);
  const run = async (action: 'share' | 'unshare' | 'preference', enabled?: boolean) => {
    if (busy || disabled || !context) return;
    if ((action === 'share' || enabled) && (!scope?.eligible || !accepted)) return;
    const token = generation.current; setBusy(true); setError(''); setNotice(''); setReply('');
    try {
      if (action === 'share') {
        await updateJournalSharing(ownerId, {action, entryId, entryRevision: context.entryRevision, teamId: scope!.teamId, disclosureVersion: scope!.disclosure.version, accepted: true});
        if (token !== generation.current) return;
        setConfirm(null); setAccepted(false); await load(token);
        setNotice('This entry is shared under the permission you accepted. Asking Nora to respond…');
        try {
          const analysis = await updateJournalSharing<{message?: string; [key: string]: unknown}>(ownerId, {action: 'analyze', entryId});
          if (token !== generation.current) return;
          if (typeof analysis.message === 'string') setReply(analysis.message);
          setNotice('This entry is shared with Nora.');
        } catch {if (token === generation.current) setNotice('Sharing was saved, but Nora could not respond right now. Your sharing permission is still active. You can stop sharing below.');}
      } else {
        await updateJournalSharing(ownerId, action === 'unshare' ? {action, entryId} : {action, enabled: !!enabled, ...(enabled ? {teamId: scope!.teamId, disclosureVersion: scope!.disclosure.version, accepted: true} : {})});
        if (token !== generation.current) return;
        await load(token); setConfirm(null); setAccepted(false);
        setNotice(action === 'unshare' ? 'Sharing stopped for this entry. Future snapshot releases will exclude its text. Copies already received follow the recipient’s retention and deletion process.' : enabled ? 'Future-entry sharing preference saved. Older entries keep their existing choices.' : 'Future-entry sharing is off. Existing shared entries keep their choices until you stop sharing each one.');
      }
    } catch (failure) {if (token === generation.current) setError(failure instanceof Error ? failure.message : 'Sharing could not be updated. Please try again.');} finally {if (token === generation.current) setBusy(false);}
  };
  return <section aria-label="Nora sharing" className="space-y-3 rounded-xl border border-white/20 p-4">
    <h3 className="font-semibold">Nora sharing</h3>
    {context ? <>
      <p className="text-sm text-zinc-300">{isShared ? 'This entry has a saved sharing permission.' : 'Nora sharing is off for this entry. Review the permission below before sharing.'}</p>
      <p className="text-xs text-zinc-400">Automated safety checks apply to saved entries separately. Sharing here does not give a coach, trainer, parent, or team clinician permission to read your entry.</p>
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy || disabled} onClick={() => {setConfirm('entry'); setAccepted(false);}}>{isShared ? 'Review or change entry sharing' : 'Share this entry with Nora'}</button>{isShared && <button type="button" className={button} disabled={busy || disabled} onClick={() => void run('unshare')}>Stop sharing this entry</button>}</div>
      <div className="border-t border-white/15 pt-3"><h4 className="text-sm font-medium">Future entries</h4><p className="my-2 text-xs text-zinc-400">{context.futurePreference?.enabled ? 'Your saved preference shares new entries under the permission you accepted. Earlier entries keep their own choices.' : 'New entries stay private by default. You can separately choose a sharing preference for entries you save later.'}</p><button type="button" className={button} disabled={busy || disabled} onClick={() => context.futurePreference?.enabled ? void run('preference', false) : (setConfirm('future'), setAccepted(false))}>{context.futurePreference?.enabled ? 'Turn off future sharing' : 'Choose future-entry sharing'}</button></div>
      {confirm && <div className="space-y-3 rounded-lg border border-white/30 bg-zinc-900 p-4"><h4 className="font-medium">{confirm === 'entry' ? 'Share this saved entry' : 'Choose a preference for new entries'}</h4><label className="block text-sm">Sharing scope<select aria-label="Journal sharing scope" className="mt-2 w-full rounded border border-white/30 bg-zinc-950 p-3 text-white" value={scopeKey} disabled={busy || disabled} onChange={event => {setScopeKey(event.target.value); setAccepted(false);}}><option value="">Choose where to share</option>{context.scopes.map(item => <option key={item.teamId || 'personal'} value={item.teamId || 'personal'} disabled={!item.eligible}>{item.label}{item.eligible ? '' : ' (unavailable)'}</option>)}</select></label>
        {confirm === 'entry' && context.entry && <div className="rounded border border-white/20 p-3"><p className="mb-2 text-xs text-zinc-400">Current saved entry</p><p className="whitespace-pre-wrap break-words text-sm">{context.entry.moment}</p>{context.entry.action && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{context.entry.action}</p>}</div>}
        {scope && <><h5 className="font-medium">{scope.disclosure.title}</h5><p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{scope.disclosure.body}</p><p className="text-xs text-zinc-400">Permission version: {scope.disclosure.version}</p><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={accepted} disabled={busy || disabled} onChange={event => setAccepted(event.target.checked)}/><span>{confirm === 'entry' ? 'I agree to share this entry under the permission above.' : 'I agree to use this permission for new entries I save. This does not change older entries.'}</span></label></>}
        <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy || disabled || !scope?.eligible || !accepted} onClick={() => void run(confirm === 'entry' ? 'share' : 'preference', confirm === 'future')}>{confirm === 'entry' ? 'Share and ask Nora' : 'Save future-entry preference'}</button><button type="button" className={button} disabled={busy} onClick={() => {setConfirm(null); setAccepted(false);}}>Cancel</button></div>
      </div>}
    </> : !error && <p role="status" className="text-sm text-zinc-400">Loading sharing choices…</p>}
    {busy && <p role="status" className="text-sm text-zinc-300">Updating journal sharing…</p>}{notice && <p role="status" className="text-sm text-zinc-200">{notice}</p>}{error && <p role="alert" className="text-sm text-rose-200">{error}</p>}{reply && <div className="space-y-2 border-t border-white/20 pt-3"><h4 className="text-sm font-medium">Nora</h4><p className="whitespace-pre-wrap text-sm text-zinc-200">{reply}</p></div>}
  </section>;
}
