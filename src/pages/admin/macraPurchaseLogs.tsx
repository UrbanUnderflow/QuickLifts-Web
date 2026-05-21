import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  RefreshCw,
  Search,
  ShoppingCart,
  XCircle,
} from 'lucide-react';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

type FirestoreDateLike = Timestamp | Date | number | string | { seconds?: number; nanoseconds?: number } | null | undefined;

type PurchasePlan = {
  id?: string;
  name?: string;
  packageId?: string;
  packageIdentifier?: string;
  productId?: string;
  title?: string;
  period?: string;
  periodUnit?: string | number;
  price?: number | string;
  priceLabel?: string;
  localizedPrice?: string;
  trialDays?: number;
  hasTrial?: boolean;
  provider?: string;
};

type PurchaseLogRow = {
  id: string;
  userId?: string;
  email?: string;
  status?: 'attempted' | 'success' | 'failed' | 'canceled' | string;
  plan?: PurchasePlan | string;
  source?: string;
  errorDomain?: string;
  errorCode?: string | number;
  readableErrorCode?: string;
  errorDescription?: string;
  failureReason?: string;
  cancelReasonCode?: string;
  cancelReasonLabel?: string;
  cancelFeedbackTrigger?: string;
  app?: string;
  platform?: string;
  metadata?: Record<string, unknown>;
  cancelFeedbackMetadata?: Record<string, unknown>;
  createdAt?: FirestoreDateLike;
  updatedAt?: FirestoreDateLike;
};

const PAGE_SIZE = 350;

type PurchaseLogSourceID = 'macra' | 'pulseRitual';

type PurchaseLogSource = {
  id: PurchaseLogSourceID;
  label: string;
  shortLabel: string;
  collectionName: string;
  description: string;
};

const PURCHASE_LOG_SOURCES: PurchaseLogSource[] = [
  {
    id: 'macra',
    label: 'Macra',
    shortLabel: 'Macra',
    collectionName: 'Macra-purchase-logs',
    description: 'Macra purchase attempts, successes, failures, cancellations, and cancellation reasons.',
  },
  {
    id: 'pulseRitual',
    label: 'Pulse Ritual',
    shortLabel: 'Ritual',
    collectionName: 'PulseRitual-purchase-logs',
    description: 'Pulse Ritual App Store and Stripe fallback purchase lifecycle records.',
  },
];

const DEFAULT_SOURCE_ID: PurchaseLogSourceID = 'macra';

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

const humanize = (value?: string | number) => {
  if (value === undefined || value === null || value === '') return 'None';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
};

const stringifySearchValue = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const normalizePlan = (plan?: PurchasePlan | string): PurchasePlan => {
  if (!plan) return {};
  if (typeof plan === 'string') return { id: plan, title: plan };
  return plan;
};

const planLabel = (row: PurchaseLogRow) => {
  const plan = normalizePlan(row.plan);
  return plan.title
    || plan.name
    || plan.id
    || plan.productId
    || plan.packageIdentifier
    || plan.packageId
    || 'Unknown plan';
};

const planMeta = (row: PurchaseLogRow) => {
  const plan = normalizePlan(row.plan);
  const parts = [
    plan.period ? humanize(plan.period) : plan.periodUnit ? humanize(plan.periodUnit) : '',
    plan.priceLabel || plan.localizedPrice || (plan.price ? `$${plan.price}` : ''),
    plan.trialDays ? `${plan.trialDays} trial days` : plan.hasTrial ? 'Trial eligible' : '',
    plan.provider ? humanize(plan.provider) : '',
  ].filter(Boolean);
  return parts.join(' · ') || 'No plan metadata';
};

const firstPresentMetadataValue = (...values: unknown[]) => (
  values.find(value => value !== undefined && value !== null && value !== '')
);

const metadataChannel = (row: PurchaseLogRow) => {
  const metadata = row.metadata || {};
  const value = firstPresentMetadataValue(
    metadata.purchase_channel,
    metadata.channel,
    metadata.checkoutProvider,
    metadata.checkout_provider,
    metadata.provider
  );
  return value === undefined || value === null || value === ''
    ? 'unknown_channel'
    : String(value);
};

const statusStyles = (status?: string) => {
  switch ((status || '').toLowerCase()) {
  case 'success':
    return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  case 'failed':
    return 'border-red-400/30 bg-red-400/10 text-red-200';
  case 'canceled':
  case 'cancelled':
    return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
  case 'attempted':
    return 'border-blue-400/30 bg-blue-400/10 text-blue-200';
  default:
    return 'border-gray-400/30 bg-gray-400/10 text-gray-200';
  }
};

const PurchaseLogsAdminPage: React.FC = () => {
  const [activeSourceId, setActiveSourceId] = useState<PurchaseLogSourceID>(DEFAULT_SOURCE_ID);
  const [rows, setRows] = useState<PurchaseLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRow, setSelectedRow] = useState<PurchaseLogRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeSource = useMemo(
    () => PURCHASE_LOG_SOURCES.find(source => source.id === activeSourceId) || PURCHASE_LOG_SOURCES[0],
    [activeSourceId]
  );

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const logsQuery = query(
        collection(db, activeSource.collectionName),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(logsQuery);
      setRows(snapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...(docSnapshot.data() as Omit<PurchaseLogRow, 'id'>),
      })));
    } catch (err: any) {
      setError(err?.message || `Failed to load ${activeSource.label} purchase logs`);
    } finally {
      setLoading(false);
    }
  }, [activeSource.collectionName, activeSource.label]);

  useEffect(() => {
    setRows([]);
    setSelectedRow(null);
    setStatusFilter('all');
    loadRows();
  }, [loadRows]);

  const statusOptions = useMemo(() => {
    const statuses = Array.from(new Set(rows.map(row => row.status).filter(Boolean))) as string[];
    return statuses.sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter(row => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      const haystack = [
        row.id,
        row.userId,
        row.email,
        row.status,
        row.source,
        row.app,
        planLabel(row),
        planMeta(row),
        metadataChannel(row),
        row.failureReason,
        row.errorDomain,
        row.errorCode,
        row.readableErrorCode,
        row.errorDescription,
        row.cancelReasonCode,
        row.cancelReasonLabel,
        row.cancelFeedbackTrigger,
        stringifySearchValue(row.metadata),
        stringifySearchValue(row.cancelFeedbackMetadata),
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const count = (status: string) => rows.filter(row => row.status === status).length;
    const success = count('success');
    const failed = count('failed');
    const canceled = rows.filter(row => row.status === 'canceled' || row.status === 'cancelled').length;
    const attempted = count('attempted');
    const completed = success + failed + canceled;
    return {
      total: rows.length,
      success,
      failed,
      canceled,
      attempted,
      successRate: completed ? `${Math.round((success / completed) * 100)}%` : '0%',
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
        <title>Purchase Logs | Admin</title>
      </Head>

      <div className="min-h-screen bg-[#111317] text-white">
        <div className="mx-auto max-w-[1500px] px-6 py-8">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/admin" className="mb-3 inline-flex text-sm text-gray-400 hover:text-[#d7ff00]">
                ← Back to admin
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-400/10 text-[#d7ff00]">
                  <ShoppingCart className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Purchase Logs</h1>
                  <p className="mt-1 text-sm text-gray-400">
                    {activeSource.description}
                    {' '}
                    <span className="font-mono text-gray-300">{activeSource.collectionName}</span>
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

          <div className="mb-6 flex flex-wrap gap-2 rounded-xl border border-[#343941] bg-[#1a1e24] p-2">
            {PURCHASE_LOG_SOURCES.map(source => {
              const isActive = source.id === activeSourceId;
              return (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => setActiveSourceId(source.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-[#d7ff00] text-[#111317]'
                      : 'text-gray-300 hover:bg-[#22262d] hover:text-white'
                  }`}
                >
                  {source.label}
                </button>
              );
            })}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Total logs" value={stats.total.toString()} />
            <MetricCard label="Success" value={stats.success.toString()} accent="text-emerald-200" />
            <MetricCard label="Failed" value={stats.failed.toString()} accent="text-red-200" />
            <MetricCard label="Canceled" value={stats.canceled.toString()} accent="text-amber-200" />
            <MetricCard label="Attempted" value={stats.attempted.toString()} accent="text-blue-200" />
            <MetricCard label="Resolved success rate" value={stats.successRate} />
          </div>

          <div className="mb-6 rounded-xl border border-[#343941] bg-[#1a1e24] p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search email, user ID, status, source, plan, error, cancel reason, metadata..."
                  className="w-full rounded-lg border border-[#343941] bg-[#111317] py-2 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#d7ff00]/60"
                />
              </label>

              <select
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}
                className="rounded-lg border border-[#343941] bg-[#111317] px-3 py-2 text-sm text-white outline-none focus:border-[#d7ff00]/60"
              >
                <option value="all">All statuses</option>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{humanize(status)}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Could not load purchase logs</p>
                <p className="text-sm text-red-200/80">{error}</p>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-[#343941] bg-[#1a1e24] shadow-2xl">
            <div className="border-b border-[#343941] px-4 py-3 text-sm text-gray-400">
              Showing {filteredRows.length} of {rows.length} purchase records
            </div>

            {loading ? (
              <div className="flex min-h-[260px] items-center justify-center text-gray-400">
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                Loading {activeSource.shortLabel} purchase logs...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center text-center text-gray-400">
                <ShoppingCart className="mb-3 h-10 w-10 text-gray-600" />
                <p className="font-semibold text-gray-300">No matching purchase logs</p>
                <p className="mt-1 text-sm">Adjust the search or filter to widen the table.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1280px] text-left text-sm">
                  <thead className="bg-[#111317] text-xs uppercase tracking-[0.16em] text-gray-500">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Failure</th>
                      <th className="px-4 py-3">Cancel reason</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2b3037]">
                    {filteredRows.map(row => (
                      <tr key={row.id} className="transition hover:bg-[#22262d]">
                        <td className="px-4 py-4 align-top">
                          <div className="font-medium text-gray-200">{formatDateTime(row.createdAt)}</div>
                          <div className="mt-1 text-xs text-gray-500">Updated {formatDateTime(row.updatedAt)}</div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles(row.status)}`}>
                            {row.status === 'success' ? <CheckCircle2 className="h-3 w-3" /> : row.status === 'failed' ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {humanize(row.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <p className="max-w-[260px] truncate font-semibold text-white">{row.email || 'No email saved'}</p>
                          <button
                            onClick={() => row.userId && copyToClipboard(row.userId, `user-${row.id}`)}
                            className="mt-1 inline-flex max-w-[260px] items-center gap-1 truncate font-mono text-[11px] text-gray-500 hover:text-[#d7ff00]"
                            disabled={!row.userId}
                          >
                            {copiedId === `user-${row.id}` ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {row.userId || 'missing user id'}
                          </button>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <p className="font-semibold text-white">{planLabel(row)}</p>
                          <p className="mt-1 text-xs text-gray-400">{planMeta(row)}</p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-2 py-1 text-xs font-semibold text-lime-200">
                            {row.source || 'unknown'}
                          </span>
                          <p className="mt-2 font-mono text-[11px] text-gray-500">
                            {metadataChannel(row)}
                          </p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <p className="max-w-[260px] truncate text-gray-200">{humanize(row.failureReason)}</p>
                          <p className="mt-1 max-w-[260px] truncate font-mono text-xs text-gray-500">
                            {row.readableErrorCode || row.errorCode || row.errorDomain || 'no error payload'}
                          </p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <p className="font-semibold text-gray-200">{row.cancelReasonLabel || humanize(row.cancelReasonCode)}</p>
                          <p className="mt-1 font-mono text-xs text-gray-500">{row.cancelReasonCode || 'none'}</p>
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
            <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-[#343941] bg-[#1a1e24] shadow-2xl">
              <div className="flex items-start justify-between border-b border-[#343941] p-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Purchase log detail</p>
                  <h2 className="mt-1 text-2xl font-bold text-white">{humanize(selectedRow.status)} · {planLabel(selectedRow)}</h2>
                  <p className="mt-1 text-sm text-gray-400">{selectedRow.email || 'No email'} · {formatDateTime(selectedRow.createdAt)}</p>
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
                  <DetailItem label="Log ID" value={selectedRow.id} mono />
                  <DetailItem label="Product" value={activeSource.label} />
                  <DetailItem label="Collection" value={activeSource.collectionName} mono />
                  <DetailItem label="User ID" value={selectedRow.userId || 'Missing'} mono />
                  <DetailItem label="Email" value={selectedRow.email || 'No email saved'} />
                  <DetailItem label="Status" value={humanize(selectedRow.status)} />
                  <DetailItem label="Plan" value={`${planLabel(selectedRow)} · ${planMeta(selectedRow)}`} />
                  <DetailItem label="Source" value={selectedRow.source || 'Unknown'} />
                  <DetailItem label="Failure reason" value={humanize(selectedRow.failureReason)} />
                  <DetailItem label="Cancel reason" value={selectedRow.cancelReasonLabel || humanize(selectedRow.cancelReasonCode)} />
                  <DetailItem label="Error domain" value={selectedRow.errorDomain || 'None'} mono />
                  <DetailItem
                    label="Error code"
                    value={selectedRow.errorCode === undefined || selectedRow.errorCode === '' ? 'None' : String(selectedRow.errorCode)}
                    mono
                  />
                  <DetailItem label="Readable error code" value={selectedRow.readableErrorCode || 'None'} mono />
                  <DetailItem label="Error description" value={selectedRow.errorDescription || 'None'} />
                </div>

                <JsonBlock title="Plan payload" value={normalizePlan(selectedRow.plan)} />
                <JsonBlock title="Metadata" value={selectedRow.metadata || {}} />
                <JsonBlock title="Cancel feedback metadata" value={selectedRow.cancelFeedbackMetadata || {}} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminRouteGuard>
  );
};

const MetricCard: React.FC<{ label: string; value: string; caption?: string; accent?: string }> = ({
  label,
  value,
  caption,
  accent = 'text-white',
}) => (
  <div className="rounded-xl border border-[#343941] bg-[#1a1e24] p-4">
    <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{label}</p>
    <p className={`mt-2 truncate text-2xl font-bold ${accent}`}>{value}</p>
    {caption && <p className="mt-1 text-xs text-gray-400">{caption}</p>}
  </div>
);

const DetailItem: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="rounded-xl border border-[#343941] bg-[#111317] p-4">
    <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{label}</p>
    <p className={`mt-2 break-words text-sm text-gray-200 ${mono ? 'font-mono' : ''}`}>{value}</p>
  </div>
);

const JsonBlock: React.FC<{ title: string; value: unknown }> = ({ title, value }) => (
  <div className="mt-5 rounded-xl border border-[#343941] bg-[#111317] p-4">
    <p className="mb-2 text-xs uppercase tracking-[0.16em] text-gray-500">{title}</p>
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-gray-300">
      {JSON.stringify(value || {}, null, 2)}
    </pre>
  </div>
);

export default PurchaseLogsAdminPage;
