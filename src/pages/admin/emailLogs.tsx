import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Mail,
  MousePointerClick,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { db } from '../../api/firebase/config';

type EmailLog = {
  id: string;
  provider?: string;
  status?: string;
  success?: boolean;
  messageId?: string | null;
  toEmail?: string;
  toName?: string;
  subject?: string;
  senderEmail?: string;
  senderName?: string;
  sequenceId?: string | null;
  campaignId?: string | null;
  product?: string | null;
  userId?: string | null;
  plan?: string | null;
  tags?: string[];
  sentAt?: Timestamp | Date | number | null;
  deliveredAt?: Timestamp | Date | number | null;
  openedAt?: Timestamp | Date | number | null;
  clickedAt?: Timestamp | Date | number | null;
  failedAt?: Timestamp | Date | number | null;
  issueAt?: Timestamp | Date | number | null;
  lastEvent?: string;
  lastEventAt?: Timestamp | Date | number | null;
  openCount?: number;
  clickCount?: number;
  clickedLink?: string | null;
  error?: string | null;
  lastError?: string | null;
  updatedAt?: Timestamp | Date | number | null;
  createdAt?: Timestamp | Date | number | null;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const date = new Date(value < 1_000_000_000_000 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    const date = (value as Timestamp).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const formatTimestamp = (...values: unknown[]) => {
  for (const value of values) {
    const date = toDate(value);
    if (date) return date.toLocaleString();
  }
  return 'N/A';
};

const normalizeStatus = (status?: string) => (status || 'unconfirmed').replace(/[_-]+/g, ' ');

const getStatusClassName = (status?: string) => {
  switch ((status || '').toLowerCase()) {
    case 'sent':
    case 'delivered':
      return 'border-green-500/30 bg-green-500/10 text-green-200';
    case 'opened':
    case 'clicked':
      return 'border-[#d7ff00]/35 bg-[#d7ff00]/10 text-[#f2ff9a]';
    case 'failed':
    case 'hard_bounce':
    case 'soft_bounce':
    case 'blocked':
    case 'spam':
    case 'unsubscribe':
      return 'border-red-500/35 bg-red-500/10 text-red-200';
    case 'deferred':
      return 'border-amber-500/35 bg-amber-500/10 text-amber-200';
    default:
      return 'border-zinc-600 bg-zinc-800 text-zinc-200';
  }
};

const getPrimaryTimestamp = (log: EmailLog) =>
  formatTimestamp(log.lastEventAt, log.updatedAt, log.sentAt, log.createdAt);

const EmailLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setError('');

    try {
      const logsQuery = query(collection(db, 'email-logs'), orderBy('updatedAt', 'desc'), limit(200));
      const snapshot = await getDocs(logsQuery);
      const nextLogs = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...(docSnapshot.data() as Omit<EmailLog, 'id'>),
      }));

      setLogs(nextLogs);
      setSelectedLog((current) => {
        if (!current) return nextLogs[0] || null;
        return nextLogs.find((log) => log.id === current.id) || nextLogs[0] || null;
      });
    } catch (fetchError: any) {
      console.error('[EmailLogs] Failed to fetch email logs:', fetchError);
      setError(fetchError?.message || 'Failed to fetch email logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return logs;

    return logs.filter((log) =>
      [
        log.toEmail,
        log.toName,
        log.subject,
        log.status,
        log.lastEvent,
        log.sequenceId,
        log.campaignId,
        log.product,
        log.userId,
        log.messageId,
        ...(log.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [logs, searchTerm]);

  const stats = useMemo(() => {
    const sent = logs.filter((log) => log.status !== 'failed' && log.success !== false).length;
    const opened = logs.filter((log) => log.openedAt || (log.openCount || 0) > 0 || log.status === 'opened' || log.status === 'clicked').length;
    const clicked = logs.filter((log) => log.clickedAt || (log.clickCount || 0) > 0 || log.status === 'clicked').length;
    const issues = logs.filter((log) => ['failed', 'hard_bounce', 'soft_bounce', 'blocked', 'spam', 'unsubscribe', 'deferred'].includes((log.status || '').toLowerCase())).length;
    return { sent, opened, clicked, issues };
  }, [logs]);

  return (
    <AdminRouteGuard>
      <Head>
        <title>Email Logs | Pulse Admin</title>
      </Head>

      <main className="min-h-screen bg-[#111417] text-white px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-black">
                <Mail className="h-7 w-7 text-[#d7ff00]" />
                Email Logs
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Track Brevo sends, delivery events, opens, clicks, and campaign metadata.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="mb-6 grid gap-3 md:grid-cols-4">
            {[
              { label: 'Logged sends', value: stats.sent, icon: CheckCircle2 },
              { label: 'Opened', value: stats.opened, icon: Mail },
              { label: 'Clicked', value: stats.clicked, icon: MousePointerClick },
              { label: 'Issues', value: stats.issues, icon: AlertCircle },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <section key={item.label} className="rounded-2xl border border-zinc-800 bg-[#1a1e24] p-4">
                  <Icon className="mb-3 h-5 w-5 text-[#d7ff00]" />
                  <div className="text-3xl font-black">{item.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">{item.label}</div>
                </section>
              );
            })}
          </div>

          <div className="mb-6 rounded-2xl border border-zinc-800 bg-[#1a1e24] p-4">
            <div className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3">
              <Search className="h-5 w-5 text-zinc-500" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by email, subject, sequence, campaign, product, or message ID"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
              />
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-2xl border border-red-800 bg-red-900/20 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#1a1e24]">
              <div className="border-b border-zinc-800 px-4 py-3 text-sm font-bold text-zinc-300">
                Recent email activity
              </div>

              {loading ? (
                <div className="p-8 text-center text-zinc-400">Loading email logs...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-zinc-400">No email logs found.</div>
              ) : (
                <div className="max-h-[680px] overflow-y-auto divide-y divide-zinc-800">
                  {filteredLogs.map((log) => (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className={`block w-full px-4 py-4 text-left transition-colors hover:bg-zinc-900/60 ${selectedLog?.id === log.id ? 'bg-zinc-900/80' : ''}`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-white">{log.subject || 'No subject recorded'}</div>
                          <div className="mt-1 truncate text-sm text-zinc-400">{log.toEmail || 'No recipient email recorded'}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {log.sequenceId ? (
                              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300">
                                {log.sequenceId}
                              </span>
                            ) : null}
                            {log.product ? (
                              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300">
                                {log.product}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col gap-2 md:items-end">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${getStatusClassName(log.status)}`}>
                            {normalizeStatus(log.status)}
                          </span>
                          <span className="text-xs text-zinc-500">{getPrimaryTimestamp(log)}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <aside className="rounded-2xl border border-zinc-800 bg-[#1a1e24] p-5 lg:sticky lg:top-6 lg:self-start">
              {selectedLog ? (
                <div>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Selected email</div>
                      <h2 className="mt-2 text-lg font-black text-white">{selectedLog.subject || 'No subject recorded'}</h2>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${getStatusClassName(selectedLog.status)}`}>
                      {normalizeStatus(selectedLog.status)}
                    </span>
                  </div>

                  <dl className="space-y-4 text-sm">
                    {[
                      ['Recipient', selectedLog.toEmail],
                      ['Name', selectedLog.toName],
                      ['Provider', selectedLog.provider || 'brevo'],
                      ['Sequence', selectedLog.sequenceId],
                      ['Campaign', selectedLog.campaignId],
                      ['Product', selectedLog.product],
                      ['User ID', selectedLog.userId],
                      ['Message ID', selectedLog.messageId],
                      ['Sent', formatTimestamp(selectedLog.sentAt)],
                      ['Delivered', formatTimestamp(selectedLog.deliveredAt)],
                      ['Opened', `${formatTimestamp(selectedLog.openedAt)}${selectedLog.openCount ? ` (${selectedLog.openCount})` : ''}`],
                      ['Clicked', `${formatTimestamp(selectedLog.clickedAt)}${selectedLog.clickCount ? ` (${selectedLog.clickCount})` : ''}`],
                      ['Last event', selectedLog.lastEvent ? `${selectedLog.lastEvent} at ${formatTimestamp(selectedLog.lastEventAt)}` : 'N/A'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                        <dt className="text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</dt>
                        <dd className="mt-1 break-words text-zinc-200">{value || 'N/A'}</dd>
                      </div>
                    ))}

                    {selectedLog.clickedLink ? (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                        <dt className="text-xs uppercase tracking-[0.16em] text-zinc-500">Clicked link</dt>
                        <dd className="mt-1 break-words text-zinc-200">
                          <a href={selectedLog.clickedLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#d7ff00] underline">
                            {selectedLog.clickedLink}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </dd>
                      </div>
                    ) : null}

                    {selectedLog.error || selectedLog.lastError ? (
                      <div className="rounded-xl border border-red-800 bg-red-900/20 p-3">
                        <dt className="text-xs uppercase tracking-[0.16em] text-red-300">Issue</dt>
                        <dd className="mt-1 break-words text-red-100">{selectedLog.error || selectedLog.lastError}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ) : (
                <div className="py-10 text-center text-zinc-500">Select an email log to inspect details.</div>
              )}
            </aside>
          </div>
        </div>
      </main>
    </AdminRouteGuard>
  );
};

export default EmailLogsPage;
