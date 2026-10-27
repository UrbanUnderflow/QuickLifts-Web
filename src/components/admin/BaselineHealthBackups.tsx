import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';

export type BaselineHealthBackup = {
  id: string;
  athleteId: string;
  athleteName: string | null;
  organizationId: string;
  organizationName?: string;
  teamId: string;
  teamName?: string;
  createdAt: string;
  deliveryStatus: 'pending' | 'verified' | 'blocked' | 'retryable' | 'processing';
  deliveryIssue?: 'connection_not_configured' | 'authorization_changed' | 'route_changed' | 'provider_unconfirmed' | null;
  lastAttemptAt: string | null;
  verifiedAt: string | null;
  backupRetained: boolean;
  canDelete: boolean;
  receipt: { baselineId: string; athleteId: string; receivedAt: string; requestId: string } | null;
};

type BackupList = { backups: BaselineHealthBackup[]; nextCursor: string | null };
const endpoint = '/api/admin/pulsecheck/baseline-backups';
const statusLabels: Record<BaselineHealthBackup['deliveryStatus'], string> = {
  pending: 'Waiting for delivery', verified: 'AuntEdna received', blocked: 'Program connection needed',
  retryable: 'Ready to try again', processing: 'Checking delivery',
};
const issueLabels = {
  connection_not_configured: 'Check the program’s approved AuntEdna connection and sending key before trying again.',
  authorization_changed: 'The athlete’s sharing choice changed. Review the current authorization before trying again.',
  route_changed: 'The program’s AuntEdna destination changed. Check the approved destination before trying again.',
  provider_unconfirmed: 'Still waiting for an AuntEdna receipt. Keep the private Pulse copy and try again later.',
};
const dateLabel = (value: string | null) => {
  if (!value) return 'Not yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};
const athleteLabel = (backup: BaselineHealthBackup) => backup.athleteName || `Athlete ${backup.athleteId}`;
const canRemove = (backup: BaselineHealthBackup) => backup.backupRetained && backup.canDelete
  && backup.deliveryStatus === 'verified' && Boolean(backup.receipt?.baselineId);

async function request<T>(url: string, body?: Record<string, string>): Promise<T> {
  const current = auth.currentUser;
  if (!current) throw new Error('Sign in with an admin account to continue.');
  let response: Response;
  try { response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${await current.getIdToken()}`, ...getFirebaseModeRequestHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    signal: AbortSignal.timeout(45000),
    ...(body ? { body: JSON.stringify(body) } : {}),
  }); } catch { throw new Error('The server could not be reached. Refresh and try again.'); }
  const data = await response.json().catch(() => { throw new Error('The server could not finish this request. Refresh and try again.'); });
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'This request could not be completed. Refresh and try again.');
  return data;
}

export default function BaselineHealthBackups() {
  const [backups, setBackups] = useState<BaselineHealthBackup[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [confirmation, setConfirmation] = useState<BaselineHealthBackup | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (cursor?: string) => {
    setLoading(true); setError('');
    try {
      const data = await request<BackupList>(`${endpoint}?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      setBackups(old => cursor ? Array.from(new Map([...old, ...data.backups].map(backup => [backup.id, backup])).values()) : data.backups);
      setNextCursor(data.nextCursor);
    } catch (_error) {
      setError(_error instanceof Error ? _error.message : 'Backups could not be loaded. Try again.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!confirmation) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyId) { event.preventDefault(); setConfirmation(null); setError(''); }
      if (event.key !== 'Tab' || !dialog) return;
      const elements = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = elements[0], last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
  }, [confirmation, busyId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return backups.filter(backup => !term || [backup.athleteName, backup.athleteId, backup.organizationName, backup.organizationId, backup.teamName, backup.teamId, backup.id].some(value => value?.toLowerCase().includes(term)));
  }, [backups, search]);

  async function act(action: 'retry' | 'delete', backup: BaselineHealthBackup) {
    if (busyId) return;
    setBusyId(backup.id); setError(''); setNotice('');
    try {
      const result = await request<{ backup: BaselineHealthBackup }>(endpoint, { action, backupId: backup.id });
      setBackups(old => old.map(item => item.id === result.backup.id ? result.backup : item));
      if (action === 'delete') {
        if (result.backup.backupRetained !== false) throw new Error('The Pulse backup is still saved. Refresh and check its delivery receipt.');
        setConfirmation(null);
        setNotice(`The Pulse backup for ${athleteLabel(backup)} was removed. AuntEdna’s receipt is kept.`);
      } else if (result.backup.deliveryStatus === 'verified') {
        setNotice(`AuntEdna confirmed receipt for ${athleteLabel(backup)}. You can remove the Pulse backup.`);
      } else if (result.backup.deliveryStatus === 'blocked') {
        setNotice('Delivery is waiting for the program’s connection. The private Pulse backup is still saved.');
      } else if (result.backup.deliveryStatus === 'retryable') {
        setNotice('Delivery did not finish. The private Pulse backup is still saved. You can try again later.');
      } else {
        setNotice('Delivery is being checked. Refresh to see the latest result. The private Pulse backup is still saved.');
      }
    } catch (_error) {
      setError(_error instanceof Error ? _error.message : 'This request could not be completed. Refresh and try again.');
    } finally { setBusyId(''); }
  }

  return <section className="space-y-5" aria-label="Private baseline backups">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex min-w-0 items-center gap-2 rounded-xl border border-clay-line bg-clay-surface px-3 py-2.5 sm:w-96">
        <Search size={17} className="shrink-0 text-clay-ink2" aria-hidden="true" />
        <span className="sr-only">Find an athlete, team or program</span>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find an athlete, team or program" className="min-w-0 w-full bg-transparent text-sm text-clay-ink placeholder:text-clay-ink3 focus:outline-none" />
      </label>
      <button type="button" disabled={loading || Boolean(busyId)} onClick={() => { setNotice(''); void load(); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-clay-line bg-clay-surface px-4 py-2.5 text-sm font-semibold text-clay-ink disabled:opacity-50">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh
      </button>
    </div>

    {error && !confirmation && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-200"><AlertCircle size={17} className="shrink-0" />{error}</p>}
    {notice && <p role="status" className="flex items-start gap-2 rounded-xl border border-clay-line bg-clay-surface p-4 text-sm text-clay-ink"><CheckCircle2 size={17} className="shrink-0" />{notice}</p>}
    <p className="text-sm text-clay-ink2">{filtered.length} of {backups.length} loaded backups shown. Health answers stay in private storage.</p>
    {loading && backups.length === 0 ? <p role="status" className="py-10 text-center text-clay-ink2">Loading private backups…</p>
      : !filtered.length ? <p className="rounded-2xl border border-clay-line bg-clay-surface p-8 text-center text-clay-ink2">{search ? 'No loaded backups match your search.' : error ? 'Refresh after the issue is resolved.' : 'No private baseline backups found.'}</p>
        : <div className="grid gap-4 lg:grid-cols-2">{filtered.map(backup => <article key={backup.id} aria-label={`Backup for ${athleteLabel(backup)}`} className="min-w-0 rounded-2xl border border-clay-line bg-clay-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="break-words text-xl text-clay-ink">{athleteLabel(backup)}</h2><p className="mt-1 break-all text-xs text-clay-ink2">Backup {backup.id}</p></div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${backup.deliveryStatus === 'verified' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-amber-200/30 bg-amber-200/10 text-amber-100'}`}>{statusLabels[backup.deliveryStatus]}</span>
          </div>
          <dl className="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            <div className="min-w-0"><dt className="text-xs text-clay-ink2">Athlete ID</dt><dd className="break-all text-clay-ink">{backup.athleteId}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-clay-ink2">Pulse copy</dt><dd className="text-clay-ink">{backup.backupRetained ? 'Saved privately' : 'Removed'}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-clay-ink2">Program</dt><dd className="break-words text-clay-ink">{backup.organizationName || backup.organizationId || 'Not listed'}{backup.organizationName && <span className="mt-1 block break-all text-xs text-clay-ink2">{backup.organizationId}</span>}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-clay-ink2">Team</dt><dd className="break-words text-clay-ink">{backup.teamName || backup.teamId || 'Not listed'}{backup.teamName && <span className="mt-1 block break-all text-xs text-clay-ink2">{backup.teamId}</span>}</dd></div>
            <div><dt className="text-xs text-clay-ink2">Saved in Pulse</dt><dd className="text-clay-ink">{dateLabel(backup.createdAt)}</dd></div>
            <div><dt className="text-xs text-clay-ink2">Last delivery attempt</dt><dd className="text-clay-ink">{dateLabel(backup.lastAttemptAt)}</dd></div>
            <div><dt className="text-xs text-clay-ink2">AuntEdna receipt verified</dt><dd className="text-clay-ink">{dateLabel(backup.verifiedAt)}</dd></div>
          </dl>
          {backup.receipt && <div className="mt-4 rounded-xl border border-clay-line p-3 text-xs text-clay-ink2">
            <p className="flex items-center gap-2 font-semibold text-clay-ink"><ShieldCheck size={15} />AuntEdna receipt</p>
            <p className="mt-2 break-all">Baseline: {backup.receipt.baselineId}</p>
            <p className="mt-1 break-all">Request: {backup.receipt.requestId}</p>
            <p className="mt-1">Received: {dateLabel(backup.receipt.receivedAt)}</p>
          </div>}
          {backup.backupRetained && backup.deliveryStatus !== 'verified' && backup.deliveryIssue && <p className="mt-4 rounded-xl border border-amber-200/20 bg-amber-200/5 p-3 text-sm leading-6 text-amber-100">{issueLabels[backup.deliveryIssue]}</p>}
          {backup.backupRetained && <div className="mt-4 flex flex-wrap gap-2">
            {backup.deliveryStatus !== 'verified' && <button type="button" disabled={Boolean(busyId) || backup.deliveryStatus === 'processing'} onClick={() => void act('retry', backup)} className="inline-flex items-center gap-2 rounded-xl bg-clay-lime px-4 py-2.5 text-sm font-semibold text-clay-on-lime disabled:opacity-50">
              {busyId === backup.id ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}Try delivery again
            </button>}
            {canRemove(backup) && <button type="button" aria-label={`Remove backup for ${athleteLabel(backup)}`} disabled={Boolean(busyId)} onClick={() => { setError(''); setConfirmation(backup); }} className="inline-flex items-center gap-2 rounded-xl border border-clay-line px-4 py-2.5 text-sm font-semibold text-clay-ink disabled:opacity-50"><Trash2 size={15} />Remove backup</button>}
          </div>}
          {backup.backupRetained && !canRemove(backup) && <p className="mt-3 text-xs text-clay-ink2">Keep this copy until AuntEdna confirms receipt.</p>}
        </article>)}</div>}
    {nextCursor && <div className="text-center"><button type="button" disabled={loading || Boolean(busyId)} onClick={() => void load(nextCursor)} className="rounded-xl border border-clay-line bg-clay-surface px-5 py-3 text-sm font-semibold text-clay-ink disabled:opacity-50">{loading ? 'Loading…' : 'Load more backups'}</button></div>}

    {confirmation && <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="remove-backup-title" aria-describedby="remove-backup-description" tabIndex={-1} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-clay-line bg-clay-paper p-6 text-clay-ink shadow-2xl">
        <div className="flex items-start justify-between gap-3"><h2 id="remove-backup-title" className="text-2xl">Remove this verified Pulse backup?</h2><button type="button" aria-label="Close removal confirmation" disabled={Boolean(busyId)} onClick={() => { setConfirmation(null); setError(''); }} className="p-1"><X size={20} /></button></div>
        <p id="remove-backup-description" className="mt-4 text-sm leading-6 text-clay-ink2">This removes the private health-answer copy for <strong className="text-clay-ink">{athleteLabel(confirmation)}</strong> from Pulse. AuntEdna’s verified receipt and delivery history stay saved.</p>
        <div className="mt-4 rounded-xl border border-clay-line bg-clay-surface p-3 text-sm"><p className="break-all">Backup: {confirmation.id}</p><p className="mt-2 break-all">AuntEdna receipt: {confirmation.receipt?.baselineId}</p><p className="mt-2">Verified: {dateLabel(confirmation.verifiedAt)}</p></div>
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-200">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3"><button data-cancel type="button" disabled={Boolean(busyId)} onClick={() => { setConfirmation(null); setError(''); }} className="rounded-xl border border-clay-line px-4 py-3 text-sm font-semibold disabled:opacity-50">Keep backup</button><button type="button" disabled={Boolean(busyId)} onClick={() => void act('delete', confirmation)} className="inline-flex items-center gap-2 rounded-xl bg-rose-200 px-4 py-3 text-sm font-semibold text-rose-950 disabled:opacity-50">{busyId ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}Remove verified backup</button></div>
      </div>
    </div>}
  </section>;
}
