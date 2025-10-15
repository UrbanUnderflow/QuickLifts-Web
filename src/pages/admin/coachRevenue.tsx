import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { db } from '../../api/firebase/config';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { convertFirestoreTimestamp } from '../../utils/formatDate';

type CoachDoc = {
  id: string;
  userId?: string;
  username?: string;
  displayName?: string;
  email?: string;
  referralCode?: string;
};

type AthleteRow = {
  athleteUserId: string;
  username?: string;
  displayName?: string;
  email?: string;
  planType: 'pulsecheck-monthly' | 'pulsecheck-annual' | null;
  expiration?: Date | null;
  isActive: boolean;
};

type CoachRow = {
  coach: CoachDoc;
  athletes: AthleteRow[];
  activeCount: number;
  mrrCents: number; // based on active plan types
};

const PRICE_CENTS: Record<'pulsecheck-monthly' | 'pulsecheck-annual', number> = {
  'pulsecheck-monthly': 2499,
  'pulsecheck-annual': 21999,
};

const DEFAULT_SPLIT_COACH = 0.6; // coach gets 60%

const currency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const CoachRevenueAdminPage: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CoachRow[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // 1) Load all coaches
        const coachSnap = await getDocs(collection(db, 'coaches'));
        const coachDocs: CoachDoc[] = [];
        for (const d of coachSnap.docs) {
          const data: any = d.data();
          let details: Partial<CoachDoc> = {};
          const coachUserId = data?.userId;
          if (coachUserId) {
            try {
              const u = await getDoc(doc(db, 'users', coachUserId));
              if (u.exists()) {
                const ud: any = u.data();
                details = {
                  userId: coachUserId,
                  username: ud?.username,
                  displayName: ud?.displayName,
                  email: ud?.email,
                };
              }
            } catch {}
          }
          coachDocs.push({ id: d.id, referralCode: data?.referralCode, ...details });
        }

        // 2) For each coach, load coachAthletes, then each athlete subscription
        const coachRows: CoachRow[] = [];
        for (const coach of coachDocs) {
          const caQ = query(
            collection(db, 'coachAthletes'),
            where('coachId', '==', coach.id)
          );
          const caSnap = await getDocs(caQ);
          const athleteRows: AthleteRow[] = [];
          for (const caDoc of caSnap.docs) {
            const ca: any = caDoc.data();
            const athleteUserId: string | undefined = ca?.athleteUserId || ca?.athleteId;
            if (!athleteUserId) continue;

            let username: string | undefined;
            let displayName: string | undefined;
            let email: string | undefined;
            try {
              const u = await getDoc(doc(db, 'users', athleteUserId));
              if (u.exists()) {
                const ud: any = u.data();
                username = ud?.username;
                displayName = ud?.displayName;
                email = ud?.email;
              }
            } catch {}

            // subscription doc
            let planType: AthleteRow['planType'] = null;
            let expiration: Date | null | undefined = null;
            let isActive = false;
            try {
              const sref = doc(db, 'subscriptions', athleteUserId);
              const sdoc = await getDoc(sref);
              if (sdoc.exists()) {
                const sd: any = sdoc.data();
                const plans: any[] = Array.isArray(sd?.plans) ? sd.plans : [];
                // find latest pulsecheck-* by expiration
                const pulsePlans = plans.filter(p => p && typeof p.type === 'string' && p.type.startsWith('pulsecheck-'));
                pulsePlans.sort((a, b) => (b?.expiration || 0) - (a?.expiration || 0));
                const latest = pulsePlans[0];
                if (latest) {
                  planType = latest.type as AthleteRow['planType'];
                  expiration = latest?.expiration ? convertFirestoreTimestamp(latest.expiration * 1000) : null;
                  const nowSec = Math.floor(Date.now() / 1000);
                  isActive = typeof latest.expiration === 'number' && latest.expiration > nowSec;
                }
              }
            } catch {}

            athleteRows.push({ athleteUserId, username, displayName, email, planType, expiration, isActive });
          }

          const active = athleteRows.filter(a => a.isActive);
          const mrrCents = active.reduce((sum, a) => {
            if (!a.planType) return sum;
            // monthly contributes full price to MRR; annual contributes monthly-equivalent (annual/12)
            if (a.planType === 'pulsecheck-annual') return sum + Math.round(PRICE_CENTS['pulsecheck-annual'] / 12);
            return sum + PRICE_CENTS['pulsecheck-monthly'];
          }, 0);

          coachRows.push({ coach, athletes: athleteRows, activeCount: active.length, mrrCents });
        }

        setRows(coachRows);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const t = search.toLowerCase();
    return rows.filter(r =>
      (r.coach.username || '').toLowerCase().includes(t) ||
      (r.coach.displayName || '').toLowerCase().includes(t) ||
      (r.coach.email || '').toLowerCase().includes(t) ||
      (r.coach.referralCode || '').toLowerCase().includes(t)
    );
  }, [rows, search]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Head>
        <title>Admin · Coach Revenue</title>
      </Head>
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Coach Revenue</h1>
            <p className="text-zinc-400">Monitor coach connections, subscription status, and 60/40 split.</p>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <input
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
            placeholder="Search coaches (name, username, email, referral)"
            className="w-full max-w-xl bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="text-zinc-400">Loading…</div>
        ) : (
          <div className="space-y-6">
            {filtered.map((row) => {
              const coachShare = Math.round(row.mrrCents * DEFAULT_SPLIT_COACH);
              const pulseShare = row.mrrCents - coachShare;
              return (
                <div key={row.coach.id} className="bg-zinc-900 border border-zinc-800 rounded-xl">
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-lg">{row.coach.displayName || row.coach.username || 'Coach'}</div>
                      <div className="text-zinc-400 text-sm">@{row.coach.username} · {row.coach.email || 'no email'} · Ref: {row.coach.referralCode || '—'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-zinc-400">Active athletes: {row.activeCount} / {row.athletes.length}</div>
                      <div className="mt-1 text-white font-semibold">MRR: {currency(row.mrrCents)}</div>
                      <div className="text-zinc-400 text-sm">Coach 60%: {currency(coachShare)} · Pulse 40%: {currency(pulseShare)}</div>
                    </div>
                  </div>
                  <div className="border-t border-zinc-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-zinc-400">
                          <th className="text-left p-3">Athlete</th>
                          <th className="text-left p-3">Email</th>
                          <th className="text-left p-3">Plan</th>
                          <th className="text-left p-3">Expires</th>
                          <th className="text-left p-3">Status</th>
                          <th className="text-right p-3">MRR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.athletes.map(a => {
                          const perMonth = a.planType === 'pulsecheck-annual' ? Math.round(PRICE_CENTS['pulsecheck-annual'] / 12) : (a.planType ? PRICE_CENTS['pulsecheck-monthly'] : 0);
                          return (
                            <tr key={a.athleteUserId} className="border-t border-zinc-800">
                              <td className="p-3 text-white">{a.displayName || a.username || a.athleteUserId.slice(0,6)}</td>
                              <td className="p-3 text-zinc-300">{a.email || '—'}</td>
                              <td className="p-3 text-zinc-300">{a.planType || '—'}</td>
                              <td className="p-3 text-zinc-300">{a.expiration ? a.expiration.toLocaleDateString() : '—'}</td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded-md text-xs ${a.isActive ? 'bg-green-600/20 text-green-300 border border-green-700/40' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                                  {a.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="p-3 text-right text-white">{perMonth ? currency(perMonth) : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-zinc-400">No coaches found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachRevenueAdminPage;


