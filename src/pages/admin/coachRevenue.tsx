import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

type UserRevenueSummary = {
  userId: string;
  activeTeamCount?: number;
  activeTeamPlanCount?: number;
  athleteRosterCount?: number;
  activeAthleteSubscriberCount?: number;
  coveredAthleteCount?: number;
  athleteSubscriptionMrrCents?: number;
  teamPlanBillingMrrCents?: number;
  totalGrossMrrCents?: number;
  estimatedPayoutMrrCents?: number;
  teamBreakdown?: Array<{
    teamId: string;
    organizationId?: string | null;
    organizationName?: string | null;
    teamName?: string | null;
    commercialModel?: string | null;
    teamPlanStatus?: string | null;
    teamPlanBypassesPaywall?: boolean;
    athleteRosterCount?: number;
    activeAthleteSubscriberCount?: number;
    coveredAthleteCount?: number;
    athleteSubscriptionMrrCents?: number;
    teamPlanBillingMrrCents?: number;
    totalGrossMrrCents?: number;
    estimatedPayoutMrrCents?: number;
  }>;
};

type RevenueRecipientRow = {
  userId: string;
  username?: string;
  displayName?: string;
  email?: string;
  summary: UserRevenueSummary;
};

const currency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const CoachRevenueAdminPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RevenueRecipientRow[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const summarySnap = await getDocs(collection(db, 'pulsecheck-user-revenue-summaries'));
        const summaryDocs = summarySnap.docs.map((snapshot) => {
          const data = snapshot.data() as UserRevenueSummary;
          return {
            ...data,
            userId: data.userId || snapshot.id,
          };
        });

        const enrichedRows = await Promise.all(
          summaryDocs.map(async (summary) => {
            let username: string | undefined;
            let displayName: string | undefined;
            let email: string | undefined;
            try {
              const userSnap = await getDoc(doc(db, 'users', summary.userId));
              if (userSnap.exists()) {
                const data: any = userSnap.data();
                username = data?.username || undefined;
                displayName = data?.displayName || undefined;
                email = data?.email || undefined;
              }
            } catch {}

            return {
              userId: summary.userId,
              username,
              displayName,
              email,
              summary,
            } satisfies RevenueRecipientRow;
          })
        );

        enrichedRows.sort(
          (left, right) =>
            (right.summary.estimatedPayoutMrrCents || 0) - (left.summary.estimatedPayoutMrrCents || 0)
        );
        setRows(enrichedRows);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const target = search.toLowerCase();
    return rows.filter((row) => {
      const teamNames = (row.summary.teamBreakdown || [])
        .map((team) => `${team.teamName || ''} ${team.organizationName || ''}`.toLowerCase())
        .join(' ');
      return (
        (row.username || '').toLowerCase().includes(target) ||
        (row.displayName || '').toLowerCase().includes(target) ||
        (row.email || '').toLowerCase().includes(target) ||
        teamNames.includes(target)
      );
    });
  }, [rows, search]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Head>
        <title>Admin · PulseCheck Revenue</title>
      </Head>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">PulseCheck Revenue</h1>
            <p className="text-zinc-400">
              Team-level revenue summaries sourced from PulseCheck org/team billing and athlete subscription attribution.
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by coach, email, team, or organization"
            className="w-full max-w-xl rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="text-zinc-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-zinc-400">No PulseCheck revenue summaries found.</div>
        ) : (
          <div className="space-y-6">
            {filtered.map((row) => (
              <div key={row.userId} className="rounded-xl border border-zinc-800 bg-zinc-900">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-lg font-semibold">
                      {row.displayName || row.username || row.userId}
                    </div>
                    <div className="text-sm text-zinc-400">
                      @{row.username || 'unknown'} · {row.email || 'no email'} · Teams:{' '}
                      {row.summary.activeTeamCount || 0}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-zinc-400">
                      Active athlete subscribers: {row.summary.activeAthleteSubscriberCount || 0}
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      Estimated payout MRR: {currency(row.summary.estimatedPayoutMrrCents || 0)}
                    </div>
                    <div className="text-sm text-zinc-400">
                      Gross MRR: {currency(row.summary.totalGrossMrrCents || 0)} · Team plans:{' '}
                      {row.summary.activeTeamPlanCount || 0}
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-zinc-400">
                        <th className="p-3 text-left">Team</th>
                        <th className="p-3 text-left">Commercial Model</th>
                        <th className="p-3 text-left">Roster</th>
                        <th className="p-3 text-left">Subscribers</th>
                        <th className="p-3 text-left">Covered</th>
                        <th className="p-3 text-right">Athlete MRR</th>
                        <th className="p-3 text-right">Team Plan Billing</th>
                        <th className="p-3 text-right">Payout MRR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(row.summary.teamBreakdown || []).map((team) => (
                        <tr key={team.teamId} className="border-t border-zinc-800">
                          <td className="p-3 text-white">
                            <div>{team.teamName || team.teamId}</div>
                            <div className="text-xs text-zinc-500">{team.organizationName || 'Unknown org'}</div>
                          </td>
                          <td className="p-3 text-zinc-300">
                            <div className="capitalize">{team.commercialModel || 'athlete-pay'}</div>
                            <div className="text-xs text-zinc-500">
                              {team.teamPlanBypassesPaywall ? 'Bypasses paywall' : team.teamPlanStatus || 'inactive'}
                            </div>
                          </td>
                          <td className="p-3 text-zinc-300">{team.athleteRosterCount || 0}</td>
                          <td className="p-3 text-zinc-300">{team.activeAthleteSubscriberCount || 0}</td>
                          <td className="p-3 text-zinc-300">{team.coveredAthleteCount || 0}</td>
                          <td className="p-3 text-right text-white">
                            {currency(team.athleteSubscriptionMrrCents || 0)}
                          </td>
                          <td className="p-3 text-right text-white">
                            {currency(team.teamPlanBillingMrrCents || 0)}
                          </td>
                          <td className="p-3 text-right text-white">
                            {currency(team.estimatedPayoutMrrCents || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachRevenueAdminPage;
