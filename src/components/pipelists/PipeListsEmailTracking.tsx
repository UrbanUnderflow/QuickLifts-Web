import React from 'react';
import { normalizeSyncedEmailStatus } from '../../utils/pipelistsEmailEventSync';

type Tracking = {
  status?: string;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  openCount?: number;
  clickCount?: number;
  lastClickedLink?: string;
  lastIssueAt?: string;
};

export function trackingStatusLabel(status?: string, sentAt?: string) {
  const normalized = normalizeSyncedEmailStatus(status || (sentAt ? 'sent' : ''));
  if (normalized === 'not_sent') return 'Not sent';
  return normalized.split(/[_-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function EmailTrackingBadge({ status, sentAt }: Pick<Tracking, 'status' | 'sentAt'>) {
  const normalized = normalizeSyncedEmailStatus(status || (sentAt ? 'sent' : ''));
  const tone = ['opened', 'clicked'].includes(normalized)
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : normalized === 'delivered'
      ? 'border-sky-200 bg-sky-50 text-sky-800'
      : ['sent', 'not_sent'].includes(normalized)
        ? 'border-stone-200 bg-stone-50 text-stone-700'
        : 'border-rose-200 bg-rose-50 text-rose-800';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
    {trackingStatusLabel(status, sentAt)}
  </span>;
}

const formatTime = (value?: string) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York', timeZoneName: 'short',
  }).format(new Date(value));
};

export default function PipeListsEmailTracking({ tracking, title = 'Email activity', onViewLogs }: {
  tracking: Tracking;
  title?: string;
  onViewLogs?: () => void;
}) {
  const safeLink = /^https?:\/\//i.test(tracking.lastClickedLink || '') ? tracking.lastClickedLink : '';
  return <section aria-label={title} className="rounded-lg border border-stone-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold text-stone-900">{title}</h4>
      <EmailTrackingBadge status={tracking.status} sentAt={tracking.sentAt} />
    </div>
    <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      {[
        ['Sent', tracking.sentAt], ['Delivered', tracking.deliveredAt],
        ['Last opened', tracking.openedAt], ['Last clicked', tracking.clickedAt],
      ].map(([label, value]) => <div key={label}>
        <dt className="text-xs font-medium text-stone-500">{label}</dt>
        <dd className="mt-1 text-stone-800">{formatTime(value)}</dd>
      </div>)}
    </dl>
    <p className="mt-3 text-sm text-stone-700">
      {tracking.openCount || 0} tracked {(tracking.openCount || 0) === 1 ? 'open' : 'opens'} · {tracking.clickCount || 0} tracked {(tracking.clickCount || 0) === 1 ? 'click' : 'clicks'}
    </p>
    {tracking.lastIssueAt && <p className="mt-2 text-sm text-rose-800">Delivery issue: {formatTime(tracking.lastIssueAt)}</p>}
    {safeLink && <p className="mt-2 text-xs text-stone-600">Last clicked link: <a href={safeLink} target="_blank" rel="noopener noreferrer" className="break-all text-stone-900 underline underline-offset-2">{safeLink}</a></p>}
    <p className="mt-2 text-xs leading-5 text-stone-500">Opens and clicks reflect email-provider tracking. An open does not confirm the message was read.</p>
    {onViewLogs && <button type="button" onClick={onViewLogs} className="mt-3 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50">View email activity</button>}
  </section>;
}
