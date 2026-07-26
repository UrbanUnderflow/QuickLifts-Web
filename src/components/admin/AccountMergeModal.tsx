import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  GitMerge,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';

type MergeUser = {
  id: string;
  email?: string;
  username?: string;
  displayName?: string;
};

type MergePreview = {
  source: { uid: string; email: string | null; providers: string[] };
  canonical: { uid: string; email: string | null; providers: string[] };
  counts: {
    total: number;
    keyedDocuments: number;
    subcollectionDocuments: number;
    references: number;
    conflicts: number;
  };
  entries: Array<{
    kind: string;
    collection: string;
    sourcePath: string;
    destinationPath?: string;
    conflict?: boolean;
  }>;
};

const AccountMergeModal: React.FC<{
  source: MergeUser;
  users: MergeUser[];
  onClose: () => void;
  onMerged: () => void;
}> = ({ source, users, onClose, onMerged }) => {
  const suggestedCanonical = useMemo(
    () => users.find(
      (candidate) =>
        candidate.id !== source.id
        && source.username
        && candidate.username?.toLowerCase() === source.username.toLowerCase(),
    ),
    [source, users],
  );
  const [mergeSource, setMergeSource] = useState(source);
  const [canonicalUid, setCanonicalUid] = useState(suggestedCanonical?.id || '');
  const [accountSearch, setAccountSearch] = useState('');
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [keepAccountConfirmed, setKeepAccountConfirmed] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'merge' | 'rollback' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [merged, setMerged] = useState(false);
  const [mergeId, setMergeId] = useState('');

  const canonical = users.find((candidate) => candidate.id === canonicalUid);
  const canonicalCandidates = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    const matches = users.filter((candidate) => {
      if (candidate.id === mergeSource.id) return false;
      if (!query) return true;
      return [
        candidate.email,
        candidate.username,
        candidate.displayName,
        candidate.id,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
    const visibleMatches = matches.slice(0, 100);
    if (canonical && !visibleMatches.some((candidate) => candidate.id === canonical.id)) {
      return [
        canonical,
        ...visibleMatches.filter((candidate) => candidate.id !== canonical.id),
      ].slice(0, 100);
    }
    return visibleMatches;
  }, [accountSearch, canonical, mergeSource.id, users]);
  const expectedConfirmation = canonicalUid ? `MERGE ${mergeSource.id} INTO ${canonicalUid}` : '';

  const resetReview = () => {
    setPreview(null);
    setConfirmation('');
    setKeepAccountConfirmed(false);
    setError(null);
  };

  const swapAccounts = () => {
    if (!canonical) return;
    const previousSource = mergeSource;
    setMergeSource(canonical);
    setCanonicalUid(previousSource.id);
    setAccountSearch(
      previousSource.email
      || previousSource.username
      || previousSource.displayName
      || previousSource.id,
    );
    resetReview();
  };

  const callMerge = async (body: Record<string, unknown>) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Your admin sign-in expired.');
    const token = await currentUser.getIdToken();
    const mergeFunctionUrl =
      typeof window !== 'undefined'
      && ['localhost', '127.0.0.1'].includes(window.location.hostname)
      && window.location.port !== '8888'
        ? `http://${window.location.hostname}:8888/.netlify/functions/merge-accounts`
        : '/.netlify/functions/merge-accounts';
    const response = await fetch(mergeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...getFirebaseModeRequestHeaders(),
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const localFunctionHint =
        response.status === 404 && typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? ' Open the local site at http://localhost:8888 so its server functions are available.'
          : '';
      throw new Error(
        payload?.error
        || `Account merge request failed (${response.status}).${localFunctionHint}`,
      );
    }
    return payload;
  };

  const loadPreview = async () => {
    if (!canonicalUid) {
      setError('Choose the account that should remain.');
      return;
    }
    setBusy('preview');
    setError(null);
    setPreview(null);
    setConfirmation('');
    setKeepAccountConfirmed(false);
    try {
      const result = await callMerge({
        action: 'preview',
        sourceUid: mergeSource.id,
        canonicalUid,
      });
      setPreview(result as MergePreview);
    } catch (err: any) {
      setError(err?.message || 'The merge preview could not be loaded.');
    } finally {
      setBusy(null);
    }
  };

  const mergeData = async () => {
    setBusy('merge');
    setError(null);
    try {
      const result = await callMerge({
        action: 'merge-data',
        sourceUid: mergeSource.id,
        canonicalUid,
        confirmation,
      });
      setMergeId(result?.mergeId || '');
      setMerged(true);
      onMerged();
    } catch (err: any) {
      setError(err?.message || 'The account data could not be merged.');
    } finally {
      setBusy(null);
    }
  };

  const rollback = async () => {
    if (!mergeId) return;
    const entered = window.prompt(`Type ROLLBACK ${mergeId} to restore the staged records.`);
    if (entered !== `ROLLBACK ${mergeId}`) return;
    setBusy('rollback');
    setError(null);
    try {
      await callMerge({
        action: 'rollback',
        mergeId,
        confirmation: entered,
      });
      setMerged(false);
      setMergeId('');
      setPreview(null);
      setConfirmation('');
      onMerged();
    } catch (err: any) {
      setError(err?.message || 'The staged merge could not be rolled back.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-purple-500/30 bg-[#171a1f] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/10 bg-[#171a1f] p-5">
          <div className="flex gap-3">
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-300">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Combine duplicate accounts</h2>
              <p className="mt-1 text-sm text-gray-400">
                Move this account’s records into the account the person will keep.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-red-300">Account being retired</div>
              <div className="mt-2 text-sm text-white">
                {mergeSource.email || mergeSource.username || mergeSource.id}
              </div>
              <div className="mt-1 break-all font-mono text-xs text-gray-500">{mergeSource.id}</div>
            </div>
            <button
              type="button"
              onClick={swapAccounts}
              disabled={!canonicalUid || busy !== null || merged}
              className="mx-auto inline-flex items-center gap-2 rounded-lg border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              title="Swap which account is kept"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Swap
            </button>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Account to keep</div>
              <label className="relative mt-2 block">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <input
                  value={accountSearch}
                  onChange={(event) => setAccountSearch(event.target.value)}
                  placeholder="Search email, username, or ID"
                  className="w-full rounded-lg border border-white/10 bg-[#22262d] py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-600"
                />
              </label>
              <select
                value={canonicalUid}
                onChange={(event) => {
                  setCanonicalUid(event.target.value);
                  resetReview();
                }}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#22262d] px-3 py-2 text-sm text-white"
              >
                <option value="">Select an account</option>
                {canonicalCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.email || candidate.username || candidate.id}
                    {candidate.username ? ` (${candidate.username})` : ''}
                  </option>
                ))}
              </select>
              {canonical && <div className="mt-1 break-all font-mono text-xs text-gray-500">{canonical.id}</div>}
            </div>
          </div>

          {!preview && !merged && (
            <button
              type="button"
              onClick={() => void loadPreview()}
              disabled={!canonicalUid || busy !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
            >
              {busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
              Review records
            </button>
          )}

          {preview && !merged && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ['Records', preview.counts.total],
                  ['Main records', preview.counts.keyedDocuments],
                  ['Nested records', preview.counts.subcollectionDocuments],
                  ['References', preview.counts.references],
                  ['Conflicts', preview.counts.conflicts],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-gray-500">{label}</div>
                    <div className="mt-1 text-xl font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div>
                    The kept account wins when both accounts contain the same field or record. A full audit
                    snapshot is saved first. The duplicate Firebase login stays active until the owner connects
                    its Apple or Google method from Settings.
                  </div>
                </div>
              </div>

              <label className="flex cursor-pointer gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <input
                  type="checkbox"
                  checked={keepAccountConfirmed}
                  onChange={(event) => setKeepAccountConfirmed(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-emerald-500"
                />
                <span className="text-sm leading-6 text-emerald-100">
                  Keep <strong>{preview.canonical.email || preview.canonical.uid}</strong>. This is the account
                  that will own the combined profile, team, athletes, and earnings records.
                </span>
              </label>

              <details className="rounded-xl border border-white/10 bg-black/20">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-white">
                  View affected records
                </summary>
                <div className="max-h-64 overflow-y-auto border-t border-white/10 p-3">
                  {preview.entries.map((entry) => (
                    <div key={`${entry.kind}-${entry.sourcePath}`} className="border-b border-white/5 px-1 py-2 text-xs last:border-0">
                      <div className="text-gray-300">{entry.collection}</div>
                      <div className="break-all font-mono text-gray-600">{entry.sourcePath}</div>
                    </div>
                  ))}
                </div>
              </details>

              <div>
                <label className="block text-xs font-medium text-gray-400">
                  Type this exact confirmation
                </label>
                <div className="mt-1 break-all font-mono text-xs text-purple-300">{expectedConfirmation}</div>
                <input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white"
                />
              </div>

              <button
                type="button"
                onClick={() => void mergeData()}
                disabled={
                  !keepAccountConfirmed
                  || confirmation !== expectedConfirmation
                  || busy !== null
                }
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {busy === 'merge' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
                Combine account data
              </button>
            </>
          )}

          {merged && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 font-semibold text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
                Account records combined
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-300">
                The owner can now sign in to the kept account and open Settings to connect Apple or Google.
                That final step proves ownership and moves the sign-in method onto the kept account.
              </p>
              {mergeId && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-emerald-500/10 pt-3">
                  <span className="break-all font-mono text-xs text-gray-500">Audit {mergeId}</span>
                  <button
                    type="button"
                    onClick={() => void rollback()}
                    disabled={busy !== null}
                    className="text-xs font-medium text-amber-300 hover:text-amber-200 disabled:opacity-50"
                  >
                    {busy === 'rollback' ? 'Restoring records...' : 'Roll back staged merge'}
                  </button>
                </div>
              )}
            </div>
          )}

          {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default AccountMergeModal;
