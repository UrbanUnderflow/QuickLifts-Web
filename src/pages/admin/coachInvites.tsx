import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { useUser } from '../../hooks/useUser';
import { db } from '../../api/firebase/config';
import {
  addDoc,
  collection,
  getCountFromServer,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  getDocs,
} from 'firebase/firestore';

type InviteLog = {
  id: string;
  code: string;
  label?: string;
  coachType?: string | null;
  earningsAccess?: boolean | null;
  createdAt?: any;
  createdByUserId?: string;
  createdByEmail?: string;
};

const DEFAULT_CODE_HINTS = [
  'DEC_2025_OUTREACH',
  'IG_DM',
  'EMAIL_OUTREACH',
  'TREMAINE',
  'TEAM_SALES',
] as const;

const normalizeInviteCode = (raw: string) => {
  const cleaned = raw.trim().replace(/\s+/g, '_');
  return cleaned.toUpperCase().replace(/[^A-Z0-9_]/g, '');
};

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://fitwithpulse.ai';
};

const CoachInvitesAdminPage: React.FC = () => {
  const currentUser = useUser();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [coachType, setCoachType] = useState<string>('partnered');
  const [earningsAccess, setEarningsAccess] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [recent, setRecent] = useState<InviteLog[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [lookupCode, setLookupCode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ usersCount?: number; coachesCount?: number; error?: string } | null>(null);

  const inviteCode = useMemo(() => normalizeInviteCode(code), [code]);
  const inviteUrl = useMemo(() => {
    if (!inviteCode) return '';
    return `${getBaseUrl()}/coach-onboard?invite=${encodeURIComponent(inviteCode)}`;
  }, [inviteCode]);

  const qrCodeUrl = useMemo(() => {
    if (!inviteUrl) return '';
    // We already use qrserver elsewhere in the codebase; safe for an admin convenience tool.
    return `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(inviteUrl)}`;
  }, [inviteUrl]);

  const loadRecent = async () => {
    setLoadingRecent(true);
    try {
      const ref = collection(db, 'coach-onboard-invites');
      const q = query(ref, orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      const rows: InviteLog[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setRecent(rows);
    } catch (e: any) {
      // Non-blocking; admin page still usable without this list
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    loadRecent();
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast('Copied');
      setTimeout(() => setToast(null), 1800);
    } catch (_) {
      setToast('Copy failed');
      setTimeout(() => setToast(null), 1800);
    }
  };

  const createInvite = async () => {
    if (!inviteCode) {
      setToast('Enter an invite code');
      setTimeout(() => setToast(null), 2000);
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'coach-onboard-invites'), {
        code: inviteCode,
        label: label.trim() || null,
        coachType: coachType?.trim() || null,
        earningsAccess: !!earningsAccess,
        createdAt: serverTimestamp(),
        createdByUserId: currentUser?.id || null,
        createdByEmail: currentUser?.email || null,
      });
      setToast('Invite saved');
      setTimeout(() => setToast(null), 2000);
      await loadRecent();
    } catch (e: any) {
      setToast(e?.message || 'Failed to save invite');
      setTimeout(() => setToast(null), 2400);
    } finally {
      setSaving(false);
    }
  };

  const lookupAttribution = async () => {
    const clean = normalizeInviteCode(lookupCode);
    if (!clean) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      // Primary: users collection (we write onboardInvite here during signup).
      const usersRef = collection(db, 'users');
      const usersQ = query(usersRef, where('onboardInvite.code', '==', clean));
      const usersCountSnap = await getCountFromServer(usersQ);

      // Secondary: coaches collection (we also copy onboardInvite here when coach profile is created).
      const coachesRef = collection(db, 'coaches');
      const coachesQ = query(coachesRef, where('onboardInvite.code', '==', clean));
      const coachesCountSnap = await getCountFromServer(coachesQ);

      setLookupResult({
        usersCount: usersCountSnap.data().count,
        coachesCount: coachesCountSnap.data().count,
      });
    } catch (e: any) {
      setLookupResult({
        error: e?.message || 'Lookup failed (may need Firestore index/permissions)',
      });
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-black text-white">
        <Head>
          <title>Coach Invite Links (Admin) | Pulse</title>
        </Head>

        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Coach Invite Links</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Generate team-owned coach invite links for outreach. These use <code className="text-zinc-200">invite</code> (not <code className="text-zinc-200">ref</code>).
            </p>
          </div>

          {toast && (
            <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200">
              {toast}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="text-lg font-semibold mb-4">Generate a link</div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Invite Code (recommended: campaign/channel/person)</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. DEC_2025_OUTREACH"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white"
                  />
                  <div className="text-xs text-zinc-500 mt-2">
                    Normalized as: <span className="text-zinc-300">{inviteCode || '—'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {DEFAULT_CODE_HINTS.map((h) => (
                      <button
                        key={h}
                        onClick={() => setCode(h)}
                        className="px-3 py-1.5 rounded-full text-xs bg-zinc-800 border border-zinc-700 hover:bg-zinc-700"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Label (optional)</label>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Tremaine cold outreach list"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-300 mb-2">Coach Type</label>
                    <select
                      value={coachType}
                      onChange={(e) => setCoachType(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white"
                    >
                      <option value="partnered">Partnered (earnings eligible)</option>
                      <option value="self_serve">Self-serve</option>
                      <option value="enterprise">Enterprise</option>
                      <option value="other">Other</option>
                    </select>
                    <div className="text-xs text-zinc-500 mt-2">
                      This is stored on the invite and copied to the coach profile on signup.
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-2">Earnings Tab Access</label>
                    <button
                      type="button"
                      onClick={() => setEarningsAccess(v => !v)}
                      className={`w-full border rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                        earningsAccess
                          ? 'bg-[#E0FE10] text-black border-[#E0FE10]'
                          : 'bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900'
                      }`}
                    >
                      {earningsAccess ? 'Enabled' : 'Disabled'}
                    </button>
                    <div className="text-xs text-zinc-500 mt-2">
                      When disabled, the coach will not see the Earnings tab or `/coach/revenue`.
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Generated Link</label>
                  <div className="flex items-center gap-2">
                    <input
                      value={inviteUrl}
                      readOnly
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white"
                    />
                    <button
                      disabled={!inviteUrl}
                      onClick={() => inviteUrl && copyToClipboard(inviteUrl)}
                      className="bg-[#E0FE10] text-black px-4 py-3 rounded-lg font-semibold hover:bg-lime-400 disabled:opacity-50"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      disabled={!inviteUrl || saving}
                      onClick={createInvite}
                      className="bg-zinc-800 border border-zinc-700 px-4 py-2 rounded-lg hover:bg-zinc-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save invite'}
                    </button>
                    <a
                      href={inviteUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className={`px-4 py-2 rounded-lg border ${
                        inviteUrl ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700' : 'bg-zinc-900 border-zinc-800 text-zinc-600 pointer-events-none'
                      }`}
                    >
                      Open
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="text-lg font-semibold mb-4">QR Code</div>
              {qrCodeUrl ? (
                <div className="bg-white rounded-xl p-4 inline-block">
                  <img src={qrCodeUrl} alt="Invite QR" className="w-56 h-56" />
                </div>
              ) : (
                <div className="text-zinc-500 text-sm">Enter an invite code to generate a QR.</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="text-lg font-semibold mb-4">Lookup (monitor)</div>
              <p className="text-zinc-400 text-sm mb-4">
                Counts coaches/users who signed up with a given <code className="text-zinc-200">invite</code> code.
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value)}
                  placeholder="Enter invite code to lookup"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white"
                />
                <button
                  disabled={lookupLoading || !normalizeInviteCode(lookupCode)}
                  onClick={lookupAttribution}
                  className="bg-[#E0FE10] text-black px-4 py-3 rounded-lg font-semibold hover:bg-lime-400 disabled:opacity-50"
                >
                  {lookupLoading ? 'Checking…' : 'Lookup'}
                </button>
              </div>

              {lookupResult && (
                <div className="mt-4 bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm">
                  {lookupResult.error ? (
                    <div className="text-red-300">{lookupResult.error}</div>
                  ) : (
                    <div className="space-y-1">
                      <div><span className="text-zinc-400">Users with invite:</span> <span className="text-white font-semibold">{lookupResult.usersCount ?? 0}</span></div>
                      <div><span className="text-zinc-400">Coaches with invite:</span> <span className="text-white font-semibold">{lookupResult.coachesCount ?? 0}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-semibold">Recent generated invites</div>
                <button
                  onClick={loadRecent}
                  disabled={loadingRecent}
                  className="bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg text-sm hover:bg-zinc-700 disabled:opacity-50"
                >
                  {loadingRecent ? 'Loading…' : 'Refresh'}
                </button>
              </div>

              {recent.length === 0 ? (
                <div className="text-zinc-500 text-sm">
                  {loadingRecent ? 'Loading…' : 'No saved invites yet.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {recent.map((r) => {
                    const url = `${getBaseUrl()}/coach-onboard?invite=${encodeURIComponent(r.code)}`;
                    return (
                      <div key={r.id} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-white font-medium truncate">{r.code}</div>
                          <div className="text-xs text-zinc-500 truncate">
                            {r.label || '—'}
                            {typeof r.earningsAccess === 'boolean' && (
                              <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] ${
                                r.earningsAccess ? 'border-[#E0FE10]/40 text-[#E0FE10]' : 'border-zinc-700 text-zinc-400'
                              }`}>
                                earnings {r.earningsAccess ? 'on' : 'off'}
                              </span>
                            )}
                            {r.coachType ? (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-300 text-[10px]">
                                {r.coachType}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => copyToClipboard(url)}
                            className="bg-[#E0FE10] text-black px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-lime-400"
                          >
                            Copy
                          </button>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg text-sm hover:bg-zinc-700"
                          >
                            Open
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default CoachInvitesAdminPage;


