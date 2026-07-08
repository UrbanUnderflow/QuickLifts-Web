export type SyncedEmailStatus =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'soft_bounce'
  | 'hard_bounce'
  | 'blocked'
  | 'deferred'
  | 'spam'
  | 'unsubscribed'
  | 'invalid_email'
  | 'error';

export type SyncedEmailEventSummary = {
  status: SyncedEmailStatus;
  eventAt: string | null;
  link?: string;
};

export type SyncedEmailLog = {
  id: string;
  type: 'metrics' | 'update';
  weekOf: string;
  summary: string;
  nextStep: string;
  followUpDate: string;
  rosteredAthletes: string;
  completedCheckIns: string;
  checkInRate: string;
  biometricSyncRate: string;
  signalEvents: string;
  noraEngagementRate: string;
  noraSessions: string;
  escalations: string;
  staffFeedbackScore: string;
  notes: string;
  createdAt: string;
  systemAction: 'email-sent';
  relatedItemId: string;
};

const normalizeEmailStatus = (value: unknown) => String(value || '').trim().toLowerCase();

export const normalizeSyncedEmailStatus = (value: unknown) => {
  const status = normalizeEmailStatus(value);
  if (!status) return 'not_sent';
  if (status === 'request') return 'sent';
  if (
    status === 'unique_opened' ||
    status === 'uniqueopened' ||
    status === 'proxy_open' ||
    status === 'unique_proxy_open' ||
    status === 'uniqueproxyopen'
  ) {
    return 'opened';
  }
  if (status === 'click') return 'clicked';
  if (status === 'unsubscribe') return 'unsubscribed';
  return status;
};

export const emailStatusRank = (status: string) => {
  const normalized = normalizeSyncedEmailStatus(status);
  if (normalized === 'sent') return 1;
  if (normalized === 'delivered') return 2;
  if (normalized === 'opened') return 3;
  if (normalized === 'click' || normalized === 'clicked') return 4;
  if (
    [
      'soft_bounce',
      'hard_bounce',
      'blocked',
      'deferred',
      'spam',
      'unsubscribe',
      'unsubscribed',
      'invalid_email',
      'error',
    ].includes(normalized)
  ) {
    return 10;
  }
  return 0;
};

const normalizeContactEmails = (emails: unknown) =>
  Array.isArray(emails)
    ? Array.from(
        new Set(
          emails
            .map((email) => (typeof email === 'string' ? email.trim().toLowerCase() : ''))
            .filter(Boolean),
        ),
      )
    : [];

export const emailEventSummaryLabel = (status: SyncedEmailStatus) => {
  if (status === 'clicked') return 'clicked';
  if (status === 'opened') return 'opened';
  if (status === 'delivered') return 'delivered';
  if (status === 'sent') return 'sent';
  if (status === 'unsubscribed') return 'unsubscribed';
  return status.replace(/_/g, ' ');
};

export const emailEventStatusLabel = (status: SyncedEmailStatus) =>
  emailEventSummaryLabel(status)
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const buildSyncedEmailEventLog = (args: {
  item: { id: string; contactEmails: string[]; lastEmailType?: string };
  status: SyncedEmailStatus;
  messageId: string;
  eventAt: string;
  link?: string;
}): SyncedEmailLog => {
  const isGeneralUpdate = args.item.lastEmailType === 'general-update';
  const email = normalizeContactEmails(args.item.contactEmails)[0] || '';
  const label = isGeneralUpdate ? 'General Update' : 'Investor Update';
  const eventLabel = emailEventSummaryLabel(args.status);
  const stableEventKey = args.status === 'clicked' && args.link ? `clicked-${args.link.slice(0, 80)}` : args.status;

  return {
    id: ['email-event', args.messageId, stableEventKey].join('-').replace(/[^\w.-]/g, '-').slice(0, 180),
    type: isGeneralUpdate ? 'update' : 'metrics',
    weekOf: args.eventAt.slice(0, 10),
    summary: `${label} ${eventLabel} by ${email || 'recipient'}.`,
    nextStep: '',
    followUpDate: '',
    rosteredAthletes: '',
    completedCheckIns: '',
    checkInRate: '',
    biometricSyncRate: '',
    signalEvents: '',
    noraEngagementRate: '',
    noraSessions: '',
    escalations: '',
    staffFeedbackScore: '',
    notes: [
      email ? `To: ${email}` : '',
      `Status: ${emailEventStatusLabel(args.status)}`,
      args.link ? `Link: ${args.link}` : '',
      `Message ID: ${args.messageId}`,
    ].filter(Boolean).join('\n'),
    createdAt: args.eventAt,
    systemAction: 'email-sent',
    relatedItemId: args.item.id,
  };
};
