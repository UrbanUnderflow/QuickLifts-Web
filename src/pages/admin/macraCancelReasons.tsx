import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  RefreshCw,
  Search,
  User,
  XCircle,
} from 'lucide-react';
import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

type FirestoreDateLike = Timestamp | Date | number | string | { seconds?: number; nanoseconds?: number } | null | undefined;

type MacraCancelUser = {
  id: string;
  displayName?: string;
  username?: string;
  email?: string;
  subscriptionType?: string;
  registrationEntryPoint?: string;
  hasCompletedMacraOnboarding?: boolean;
  macraPaywallCancelFeedbackCount?: number;
};

type MacraCancelReasonRow = {
  id: string;
  userId?: string;
  email?: string;
  reason?: string;
  reasonLabel?: string;
  trigger?: string;
  source?: string;
  selectedPlanId?: string;
  selectedPlanPeriod?: string;
  surface?: string;
  app?: string;
  isScreenDemo?: boolean;
  capturedAt?: FirestoreDateLike;
  createdAt?: FirestoreDateLike;
  metadata?: Record<string, unknown>;
  user?: MacraCancelUser | null;
};

const PAGE_SIZE = 250;
const COLLECTION_NAME = 'Macrafeedbackreason';

const toDate = (value: FirestoreDateLike): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1_000_000));
  }
  if (typeof value === 'number') {
    const date = new Date(value < 1_000_000_000_000 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && value.trim() !== '') return toDate(numeric);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const formatDateTime = (value: FirestoreDateLike) => {
  const date = toDate(value);
  if (!date) return 'Unknown';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const humanize = (value?: string) => {
  if (!value) return 'Unknown';
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
};

const getUserName = (row: MacraCancelReasonRow) =>
  row.user?.displayName || row.user?.username || row.email || row.user?.email || 'Unknown user';

const getUserEmail = (row: MacraCancelReasonRow) => row.email || row.user?.email || '';

const stringifySearchValue = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const chunkItems = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const MacraCancelReasonsAdminPage: React.FC = () => {
  const [rows, setRows] = useState<MacraCancelReasonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [hideScreenDemo, setHideScreenDemo] = useState(true);
  const [selectedRow, setSelectedRow] = useState<MacraCancelReasonRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const feedbackQuery = query(
        collection(db, COLLECTION_NAME),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(feedbackQuery);
      const feedbackRows = snapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...(docSnapshot.data() as Omit<MacraCancelReasonRow, 'id'>),
      }));

      const userIds = Array.from(new Set(feedbackRows.map(row => row.userId).filter(Boolean))) as string[];
      const usersById = new Map<string, MacraCancelUser>();

      for (const chunk of chunkItems(userIds, 10)) {
        const usersSnapshot = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)));
        usersSnapshot.docs.forEach(userDoc => {
          const data = userDoc.data() as Record<string, any>;
          usersById.set(userDoc.id, {
            id: userDoc.id,
            displayName: data.displayName || data.name || '',
            username: data.username || '',
            email: data.email || '',
            subscriptionType: data.subscriptionType || '',
            registrationEntryPoint: data.registrationEntryPoint || '',
            hasCompletedMacraOnboarding: Boolean(data.hasCompletedMacraOnboarding),
            macraPaywallCancelFeedbackCount: data.macraPaywallCancelFeedbackCount || 0,
          });
        });
      }

      setRows(feedbackRows.map(row => ({
        ...row,
        user: row.userId ? usersById.get(row.userId) || null : null,
      })));
    } catch (err: any) {
      setError(err?.message || 'Failed to load Macra cancel reasons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const reasonOptions = useMemo(() => {
    const reasons = Array.from(new Set(rows.map(row => row.reason || row.reasonLabel).filter(Boolean))) as string[];
    return reasons.sort((left, right) => humanize(left).localeCompare(humanize(right)));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter(row => {
      if (hideScreenDemo && row.isScreenDemo) return false;
      if (reasonFilter !== 'all' && row.reason !== reasonFilter && row.reasonLabel !== reasonFilter) return false;
      if (!normalizedSearch) return true;
      const haystack = [
        row.id,
        row.userId,
        getUserName(row),
        getUserEmail(row),
        row.reason,
        row.reasonLabel,
        row.trigger,
        row.source,
        row.selectedPlanId,
        row.selectedPlanPeriod,
        row.surface,
        row.user?.subscriptionType,
        row.user?.registrationEntryPoint,
        stringifySearchValue(row.metadata),
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [rows, search, reasonFilter, hideScreenDemo]);

  const stats = useMemo(() => {
    const productionRows = rows.filter(row => !row.isScreenDemo);
    const users = new Set(productionRows.map(row => row.userId).filter(Boolean));
    const reasonCounts = productionRows.reduce<Record<string, number>>((acc, row) => {
      const key = row.reasonLabel || humanize(row.reason);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      total: productionRows.length,
      uniqueUsers: users.size,
      screenDemo: rows.length - productionRows.length,
      topReasonLabel: topReason?.[0] || 'None yet',
      topReasonCount: topReason?.[1] || 0,
    };
  }, [rows]);

  const copyToClipboard = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Macra Cancel Reasons | Admin</title>
      </Head>

      <div className="min-h-screen bg-[#111317] text-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/admin" className="mb-3 inline-flex text-sm text-gray-400 hover:text-[#d7ff00]">
                ← Back to admin
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-400/10 text-[#d7ff00]">
                  <XCircle className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Macra Cancel Reasons</h1>
                  <p className="mt-1 text-sm text-gray-400">
                    Saved paywall cancellation feedback from <span className="font-mono text-gray-300">{COLLECTION_NAME}</span>, enriched with user profile context.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={loadRows}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#343941] bg-[#1a1e24] px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-[#d7ff00]/50 hover:text-[#d7ff00] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard label="Production responses" value={stats.total.toString()} />
            <MetricCard label="Unique users" value={stats.uniqueUsers.toString()} />
            <MetricCard label="Top reason" value={stats.topReasonLabel} caption={stats.topReasonCount ? `${stats.topReasonCount} response${stats.topReasonCount === 1 ? '' : 's'}` : 'No responses'} />
            <MetricCard label="Screen demo" value={stats.screenDemo.toString()} caption={hideScreenDemo ? 'Hidden from table' : 'Visible in table'} />
          </div>

          <div className="mb-6 rounded-xl border border-[#343941] bg-[#1a1e24] p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_240px_180px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search user, email, reason, trigger, plan, metadata..."
                  className="w-full rounded-lg border border-[#343941] bg-[#111317] py-2 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#d7ff00]/60"
                />
              </label>

              <select
                value={reasonFilter}
                onChange={event => setReasonFilter(event.target.value)}
                className="rounded-lg border border-[#343941] bg-[#111317] px-3 py-2 text-sm text-white outline-none focus:border-[#d7ff00]/60"
              >
                <option value="all">All reasons</option>
                {reasonOptions.map(reason => (
                  <option key={reason} value={reason}>{humanize(reason)}</option>
                ))}
              </select>

              <label className="flex items-center justify-between rounded-lg border border-[#343941] bg-[#111317] px-3 py-2 text-sm text-gray-300">
                <span>Hide demos</span>
                <input
                  type="checkbox"
                  checked={hideScreenDemo}
                  onChange={event => setHideScreenDemo(event.target.checked)}
                  className="h-4 w-4 accent-[#d7ff00]"
                />
              </label>
            </div>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Could not load cancel reasons</p>
                <p className="text-sm text-red-200/80">{error}</p>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-[#343941] bg-[#1a1e24] shadow-2xl">
            <div className="border-b border-[#343941] px-4 py-3 text-sm text-gray-400">
              Showing {filteredRows.length} of {rows.length} saved responses
            </div>

            {loading ? (
              <div className="flex min-h-[260px] items-center justify-center text-gray-400">
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                Loading Macra cancel reasons...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center text-center text-gray-400">
                <XCircle className="mb-3 h-10 w-10 text-gray-600" />
                <p className="font-semibold text-gray-300">No matching cancel reasons</p>
                <p className="mt-1 text-sm">Adjust the search or filter to widen the table.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-left text-sm">
                  <thead className="bg-[#111317] text-xs uppercase tracking-[0.16em] text-gray-500">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Trigger</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2b3037]">
                    {filteredRows.map(row => (
                      <tr key={row.id} className="transition hover:bg-[#22262d]">
                        <td className="px-4 py-4 align-top">
                          <div className="font-medium text-gray-200">{formatDateTime(row.createdAt || row.capturedAt)}</div>
                          {row.isScreenDemo && (
                            <span className="mt-2 inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-200">
                              screen demo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#d7ff00]/10 text-[#d7ff00]">
                              <User className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-white">{getUserName(row)}</p>
                              <p className="truncate text-xs text-gray-400">{getUserEmail(row) || 'No email saved'}</p>
                              <button
                                onClick={() => row.userId && copyToClipboard(row.userId, `user-${row.id}`)}
                                className="mt-1 inline-flex max-w-[220px] items-center gap-1 truncate font-mono text-[11px] text-gray-500 hover:text-[#d7ff00]"
                                disabled={!row.userId}
                              >
                                {copiedId === `user-${row.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {row.userId || 'missing user id'}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <p className="font-semibold text-white">{row.reasonLabel || humanize(row.reason)}</p>
                          <p className="mt-1 font-mono text-xs text-gray-500">{row.reason || 'unknown_reason'}</p>
                        </td>
                        <td className="px-4 py-4 align-top text-gray-300">{humanize(row.trigger)}</td>
                        <td className="px-4 py-4 align-top">
                          <p className="font-medium text-gray-200">{humanize(row.selectedPlanPeriod)}</p>
                          <p className="mt-1 font-mono text-xs text-gray-500">{row.selectedPlanId || 'none'}</p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-2 py-1 text-xs font-semibold text-lime-200">
                            {row.source || 'unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top text-right">
                          <button
                            onClick={() => setSelectedRow(row)}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#343941] px-3 py-2 text-xs font-semibold text-gray-200 transition hover:border-[#d7ff00]/50 hover:text-[#d7ff00]"
                          >
                            <Eye className="h-4 w-4" />
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {selectedRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[#343941] bg-[#1a1e24] shadow-2xl">
              <div className="flex items-start justify-between border-b border-[#343941] p-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Cancel reason detail</p>
                  <h2 className="mt-1 text-2xl font-bold text-white">{selectedRow.reasonLabel || humanize(selectedRow.reason)}</h2>
                  <p className="mt-1 text-sm text-gray-400">{getUserName(selectedRow)} · {formatDateTime(selectedRow.createdAt || selectedRow.capturedAt)}</p>
                </div>
                <button
                  onClick={() => setSelectedRow(null)}
                  className="rounded-full border border-[#343941] p-2 text-gray-400 hover:border-[#d7ff00]/50 hover:text-[#d7ff00]"
                  aria-label="Close details"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[calc(90vh-96px)] overflow-y-auto p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <DetailItem label="User" value={getUserName(selectedRow)} />
                  <DetailItem label="Email" value={getUserEmail(selectedRow) || 'No email saved'} />
                  <DetailItem label="User ID" value={selectedRow.userId || 'Missing'} mono />
                  <DetailItem label="Feedback ID" value={selectedRow.id} mono />
                  <DetailItem label="Trigger" value={humanize(selectedRow.trigger)} />
                  <DetailItem label="Source" value={selectedRow.source || 'Unknown'} />
                  <DetailItem label="Selected plan" value={`${humanize(selectedRow.selectedPlanPeriod)} · ${selectedRow.selectedPlanId || 'none'}`} />
                  <DetailItem label="Subscription" value={selectedRow.user?.subscriptionType || 'Unknown'} />
                  <DetailItem label="Registration origin" value={selectedRow.user?.registrationEntryPoint || 'Unknown'} />
                  <DetailItem label="User total feedback count" value={String(selectedRow.user?.macraPaywallCancelFeedbackCount || 0)} />
                </div>

                <div className="mt-5 rounded-xl border border-[#343941] bg-[#111317] p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-gray-500">Raw metadata</p>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-gray-300">
                    {JSON.stringify(selectedRow.metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminRouteGuard>
  );
};

const MetricCard: React.FC<{ label: string; value: string; caption?: string }> = ({ label, value, caption }) => (
  <div className="rounded-xl border border-[#343941] bg-[#1a1e24] p-4">
    <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{label}</p>
    <p className="mt-2 truncate text-2xl font-bold text-white">{value}</p>
    {caption && <p className="mt-1 text-xs text-gray-400">{caption}</p>}
  </div>
);

const DetailItem: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="rounded-xl border border-[#343941] bg-[#111317] p-4">
    <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{label}</p>
    <p className={`mt-2 break-words text-sm text-gray-200 ${mono ? 'font-mono' : ''}`}>{value}</p>
  </div>
);

export default MacraCancelReasonsAdminPage;
