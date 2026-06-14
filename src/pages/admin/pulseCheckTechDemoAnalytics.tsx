import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import {
  ArrowLeft,
  BarChart2,
  Clock,
  Download,
  Eye,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

type NotificationEmail = {
  status?: string | null;
  to?: string | null;
  messageId?: string | null;
  error?: string | null;
};

type DemoViewEvent = {
  id: string;
  timestamp: string | null;
  ip: string;
  location: string;
  userAgent: string | null;
  visitorId: string | null;
  pageUrl: string | null;
  referrer: string | null;
  referrerHost: string | null;
  viewerName: string | null;
  viewerEmail: string | null;
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  notificationEmail: NotificationEmail | null;
};

type VisitorSummary = {
  key: string;
  ip: string;
  visitorId: string | null;
  viewerName: string | null;
  viewerEmail: string | null;
  location: string;
  count: number;
  firstSeen: string | null;
  lastSeen: string | null;
  latestSource: string | null;
  latestReferrer: string | null;
  latestReferrerHost: string | null;
  latestUserAgent: string | null;
  emailStatusCounts: Record<string, number>;
};

type CounterRow = {
  label: string;
  count: number;
};

type AnalyticsResponse = {
  generatedAt: string;
  collection: string;
  summary: {
    totalViews: number;
    uniqueVisitors: number;
    knownReviewerViews: number;
    viewsToday: number;
    viewsLast24Hours: number;
    latestViewAt: string | null;
    emailStatusCounts: Record<string, number>;
  };
  visitors: VisitorSummary[];
  recentEvents: DemoViewEvent[];
  sources: CounterRow[];
  referrers: CounterRow[];
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatShortDateTime = (value: string | null | undefined) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const getEmailStatusClassName = (status?: string | null) => {
  switch ((status || '').toLowerCase()) {
    case 'sent':
      return 'border-green-400/30 bg-green-400/10 text-green-200';
    case 'failed':
      return 'border-red-400/30 bg-red-400/10 text-red-200';
    case 'skipped_missing_brevo_key':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
    default:
      return 'border-zinc-700 bg-zinc-900 text-zinc-300';
  }
};

const buildCsv = (events: DemoViewEvent[]) => {
  const headers = [
    'timestamp',
    'viewerName',
    'viewerEmail',
    'ip',
    'location',
    'source',
    'utmSource',
    'utmMedium',
    'utmCampaign',
    'referrer',
    'visitorId',
    'emailStatus',
    'pageUrl',
    'userAgent',
  ];

  const rows = events.map((event) =>
    [
      event.timestamp,
      event.viewerName,
      event.viewerEmail,
      event.ip,
      event.location,
      event.source,
      event.utmSource,
      event.utmMedium,
      event.utmCampaign,
      event.referrer,
      event.visitorId,
      event.notificationEmail?.status || '',
      event.pageUrl,
      event.userAgent,
    ].map((value) => `"${String(value || '').replace(/"/g, '""')}"`)
  );

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
};

const PulseCheckTechDemoAnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVisitorKey, setSelectedVisitorKey] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) {
        throw new Error('Admin auth session not ready. Sign in again, then retry.');
      }

      const response = await fetch('/api/pulse-check-tech-demo/analytics', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Analytics request failed with ${response.status}`);
      }

      const data = (await response.json()) as AnalyticsResponse;
      setAnalytics(data);
      setSelectedVisitorKey((current) => current || data.visitors[0]?.key || null);
    } catch (fetchError: unknown) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to fetch demo analytics.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const filteredVisitors = useMemo(() => {
    if (!analytics) return [];
    const query = searchTerm.trim().toLowerCase();
    if (!query) return analytics.visitors;

    return analytics.visitors.filter((visitor) =>
      [
        visitor.viewerName,
        visitor.viewerEmail,
        visitor.ip,
        visitor.location,
        visitor.visitorId,
        visitor.latestSource,
        visitor.latestReferrerHost,
        visitor.latestUserAgent,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [analytics, searchTerm]);

  const selectedVisitor = useMemo(
    () => filteredVisitors.find((visitor) => visitor.key === selectedVisitorKey) || filteredVisitors[0] || null,
    [filteredVisitors, selectedVisitorKey]
  );

  const selectedVisitorEvents = useMemo(() => {
    if (!analytics || !selectedVisitor) return [];
    return analytics.recentEvents.filter((event) => (event.visitorId || event.ip || event.id) === selectedVisitor.key);
  }, [analytics, selectedVisitor]);

  const downloadCsv = () => {
    if (!analytics) return;
    const blob = new Blob([buildCsv(analytics.recentEvents)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pulse-check-tech-demo-views.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>PulseCheck Tech Demo Analytics | Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#0f1216] px-4 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <Link href="/admin" className="mb-6 inline-flex items-center text-sm text-zinc-400 transition hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Link>

          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-black">
                <BarChart2 className="h-8 w-8 text-[#d7ff00]" />
                PulseCheck Tech Demo Analytics
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-zinc-400">
                Track reviewer visits, sources, email notifications, visitor history, and recent page views for the demo page.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/pulse-check-tech-demo"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-zinc-800"
              >
                Open Demo Page
              </a>
              <button
                type="button"
                onClick={downloadCsv}
                disabled={!analytics}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={fetchAnalytics}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d7ff00] px-4 py-3 text-sm font-black text-black transition hover:bg-[#e6ff4a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
          ) : null}

          <div className="mb-6 grid gap-3 md:grid-cols-5">
            {[
              { label: 'Total views', value: analytics?.summary.totalViews ?? 0, icon: Eye },
              { label: 'Unique visitors', value: analytics?.summary.uniqueVisitors ?? 0, icon: Users },
              { label: 'Known reviewer views', value: analytics?.summary.knownReviewerViews ?? 0, icon: Search },
              { label: 'Views today', value: analytics?.summary.viewsToday ?? 0, icon: Clock },
              { label: 'Last 24 hours', value: analytics?.summary.viewsLast24Hours ?? 0, icon: BarChart2 },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <section key={card.label} className="rounded-2xl border border-zinc-800 bg-[#171b21] p-4">
                  <Icon className="mb-3 h-5 w-5 text-[#d7ff00]" />
                  <div className="text-3xl font-black">{loading ? '...' : card.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">{card.label}</div>
                </section>
              );
            })}
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <section className="rounded-2xl border border-zinc-800 bg-[#171b21] p-5">
              <h2 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-[#d7ff00]">Notification Email</h2>
              <p className="text-sm text-zinc-400">
                New view emails are sent to <span className="font-bold text-white">tre@fitwithpulse.ai</span> when Brevo is configured.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(analytics?.summary.emailStatusCounts || {}).map(([status, count]) => (
                  <span key={status} className={`rounded-full border px-3 py-1 text-xs font-bold ${getEmailStatusClassName(status)}`}>
                    {status.replace(/_/g, ' ')}: {count}
                  </span>
                ))}
                {!analytics || Object.keys(analytics.summary.emailStatusCounts).length === 0 ? (
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-300">
                    No sends logged yet
                  </span>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-[#171b21] p-5">
              <h2 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-[#d7ff00]">Top Sources</h2>
              <div className="space-y-3">
                {(analytics?.sources || []).slice(0, 5).map((source) => (
                  <div key={source.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="truncate text-zinc-300">{source.label}</span>
                    <span className="font-black text-white">{source.count}</span>
                  </div>
                ))}
                {!analytics?.sources?.length ? <div className="text-sm text-zinc-500">No source data yet.</div> : null}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-[#171b21] p-5">
              <h2 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-[#d7ff00]">Top Referrers</h2>
              <div className="space-y-3">
                {(analytics?.referrers || []).slice(0, 5).map((referrer) => (
                  <div key={referrer.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="truncate text-zinc-300">{referrer.label}</span>
                    <span className="font-black text-white">{referrer.count}</span>
                  </div>
                ))}
                {!analytics?.referrers?.length ? <div className="text-sm text-zinc-500">No referrer data yet.</div> : null}
              </div>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
            <section className="rounded-2xl border border-zinc-800 bg-[#171b21]">
              <div className="border-b border-zinc-800 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-black">Visitors</h2>
                    <p className="text-sm text-zinc-500">Grouped by visitor ID when available, otherwise IP address.</p>
                  </div>
                  <div className="relative w-full md:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search visitor, source, location..."
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-[#d7ff00]/40 focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/20"
                    />
                  </div>
                </div>
              </div>

              <div className="max-h-[660px] overflow-auto">
                {filteredVisitors.map((visitor) => (
                  <button
                    key={visitor.key}
                    type="button"
                    onClick={() => setSelectedVisitorKey(visitor.key)}
                    className={`w-full border-b border-zinc-800 p-5 text-left transition hover:bg-zinc-900/70 ${
                      selectedVisitor?.key === visitor.key ? 'bg-[#d7ff00]/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate font-black text-white">
                          {visitor.viewerName || visitor.viewerEmail || visitor.ip || 'Unknown visitor'}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                          <span>{visitor.location}</span>
                          <span>{visitor.count} view{visitor.count === 1 ? '' : 's'}</span>
                          <span>{visitor.latestSource || visitor.latestReferrerHost || 'Direct / unknown'}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-zinc-400">
                        <div className="font-bold text-white">{formatShortDateTime(visitor.lastSeen)}</div>
                        <div>last seen</div>
                      </div>
                    </div>
                  </button>
                ))}

                {!loading && filteredVisitors.length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">No visitors match your search.</div>
                ) : null}
              </div>
            </section>

            <aside className="space-y-6">
              <section className="rounded-2xl border border-zinc-800 bg-[#171b21] p-5">
                <h2 className="text-lg font-black">Selected Visitor</h2>
                {selectedVisitor ? (
                  <div className="mt-5 space-y-4">
                    {[
                      ['Viewer', selectedVisitor.viewerName || selectedVisitor.viewerEmail || 'Unknown'],
                      ['IP', selectedVisitor.ip],
                      ['Location', selectedVisitor.location],
                      ['First seen', formatDateTime(selectedVisitor.firstSeen)],
                      ['Last seen', formatDateTime(selectedVisitor.lastSeen)],
                      ['Views', String(selectedVisitor.count)],
                      ['Source', selectedVisitor.latestSource || 'Direct / unknown'],
                      ['Referrer', selectedVisitor.latestReferrer || 'Direct / none'],
                      ['Visitor ID', selectedVisitor.visitorId || 'None'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                        <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</div>
                        <div className="mt-1 break-words text-sm font-bold text-white">{value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-zinc-500">No visitor selected.</div>
                )}
              </section>

              <section className="rounded-2xl border border-zinc-800 bg-[#171b21] p-5">
                <h2 className="text-lg font-black">Visitor Event History</h2>
                <div className="mt-4 space-y-3">
                  {selectedVisitorEvents.map((event) => (
                    <div key={event.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-bold text-white">{formatShortDateTime(event.timestamp)}</div>
                        <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${getEmailStatusClassName(event.notificationEmail?.status)}`}>
                          <Mail className="mr-1 inline h-3 w-3" />
                          {(event.notificationEmail?.status || 'not recorded').replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                        <span>{event.source || event.utmSource || event.referrerHost || 'Direct / unknown'}</span>
                      </div>
                    </div>
                  ))}
                  {selectedVisitor && selectedVisitorEvents.length === 0 ? (
                    <div className="text-sm text-zinc-500">No detailed events found in the recent event window.</div>
                  ) : null}
                </div>
              </section>
            </aside>
          </div>

          <section className="mt-6 rounded-2xl border border-zinc-800 bg-[#171b21]">
            <div className="border-b border-zinc-800 p-5">
              <h2 className="text-lg font-black">Recent Page Views</h2>
              <p className="text-sm text-zinc-500">Most recent individual view events recorded from the demo page.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
                <thead className="bg-zinc-950/70 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  <tr>
                    <th className="px-5 py-3">Time</th>
                    <th className="px-5 py-3">Viewer</th>
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-5 py-3">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {(analytics?.recentEvents || []).slice(0, 80).map((event) => (
                    <tr key={event.id} className="hover:bg-zinc-900/60">
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-300">{formatShortDateTime(event.timestamp)}</td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-white">{event.viewerName || event.viewerEmail || event.ip}</div>
                        <div className="text-xs text-zinc-500">{event.visitorId || 'No visitor ID'}</div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-300">{event.location}</td>
                      <td className="px-5 py-4 text-zinc-300">{event.source || event.utmSource || event.referrerHost || 'Direct / unknown'}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${getEmailStatusClassName(event.notificationEmail?.status)}`}>
                          {(event.notificationEmail?.status || 'not recorded').replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckTechDemoAnalyticsPage;
