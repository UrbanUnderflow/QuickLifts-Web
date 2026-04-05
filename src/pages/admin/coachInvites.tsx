import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { db } from '../../api/firebase/config';
import {
  collection,
  getCountFromServer,
  limit,
  orderBy,
  query,
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

const normalizeInviteCode = (raw: string) => {
  const cleaned = raw.trim().replace(/\s+/g, '_');
  return cleaned.toUpperCase().replace(/[^A-Z0-9_]/g, '');
};

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://fitwithpulse.ai';
};

const CoachInvitesAdminPage: React.FC = () => {
  const [toast, setToast] = useState<string | null>(null);
  const [recent, setRecent] = useState<InviteLog[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [lookupCode, setLookupCode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ usersCount?: number; coachesCount?: number; error?: string } | null>(null);

  const coachLedOrgUrl = useMemo(() => `${getBaseUrl()}/PulseCheck/coach`, []);

  const loadRecent = async () => {
    setLoadingRecent(true);
    try {
      const ref = collection(db, 'coach-onboard-invites');
      const q = query(ref, orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      const rows: InviteLog[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setRecent(rows);
    } catch (_e: any) {
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
          <title>Legacy Coach Invite Links (Admin) | Pulse</title>
        </Head>

        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Legacy Coach Invite Links</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Deprecated legacy invite-code registry. New links now point directly into the canonical <code className="text-zinc-200">/sign-up?type=coach&amp;invite=...</code> path while we finish cleaning up the old coach collections.
            </p>
          </div>

          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            New coach-led organizations should be provisioned through <code className="text-amber-50">/admin/pulsecheckProvisioning</code> and activated through PulseCheck admin activation links. Use this page only for legacy cleanup or historical attribution lookups.
          </div>

          {toast && (
            <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200">
              {toast}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="text-lg font-semibold mb-4">New canonical entry</div>
              <div className="space-y-4 text-sm text-zinc-300">
                <p>
                  We no longer generate coach-onboard invite links from this page. New coach-led organizations should enter
                  through the PulseCheck coach flow or be provisioned directly from the PulseCheck provisioning console.
                </p>
                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Coach-led organization entry</label>
                  <div className="flex items-center gap-2">
                    <input
                      value={coachLedOrgUrl}
                      readOnly
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white"
                    />
                    <button
                      onClick={() => coachLedOrgUrl && copyToClipboard(coachLedOrgUrl)}
                      className="bg-[#E0FE10] text-black px-4 py-3 rounded-lg font-semibold hover:bg-lime-400"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link
                    href="/admin/pulsecheckProvisioning"
                    className="rounded-lg bg-[#E0FE10] px-4 py-2 font-semibold text-black hover:bg-lime-400"
                  >
                    Open PulseCheck Provisioning
                  </Link>
                  <a
                    href={coachLedOrgUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 hover:bg-zinc-700"
                  >
                    Open Coach Entry Page
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="text-lg font-semibold mb-4">Legacy route status</div>
              <div className="space-y-3 text-sm text-zinc-400">
                <p><code className="text-zinc-200">/coach-onboard</code> now redirects into the canonical coach signup bridge.</p>
                <p><code className="text-zinc-200">/coach-invite/[referralCode]</code> and <code className="text-zinc-200">/connect/[referralCode]</code> are retired and only show migration guidance.</p>
                <p>This page is now read-only and should only be used to audit historical invite codes during migration.</p>
              </div>
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
                <div className="text-lg font-semibold">Recent legacy invites</div>
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
                            Copy legacy route
                          </button>
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
