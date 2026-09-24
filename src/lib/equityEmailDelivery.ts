export type EquityEmailDeliveryStatus = 'sending' | 'accepted' | 'delivered' | 'deferred' | 'failed' | 'unknown';

export type EquityEmailDelivery = {
  status: EquityEmailDeliveryStatus;
  messageId: string | null;
  recipientEmail: string;
  attemptId?: string;
  attemptedAt?: any;
  acceptedAt?: any;
  eventAt?: any;
  checkedAt?: any;
  reason?: string | null;
  providerEvent?: string | null;
  checkError?: string | null;
  unresolvedFailure?: {reason: string; at: any; messageId?: string | null} | null;
};

export type BrevoDeliveryEvent = {
  event?: unknown;
  email?: unknown;
  messageId?: unknown;
  'message-id'?: unknown;
  date?: unknown;
  ts_event?: unknown;
  ts_epoch?: unknown;
  ts?: unknown;
  reason?: unknown;
};

const STATES = new Set<EquityEmailDeliveryStatus>(['sending', 'accepted', 'delivered', 'deferred', 'failed', 'unknown']);
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
export const normalizeBrevoMessageId = (value: unknown): string => String(value || '').trim().replace(/^<([^<>]+)>$/, '$1');
export const equityEmailTimestamp = (value: any): number => {
  if (value == null) return NaN;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000 + (value.nanoseconds || 0) / 1_000_000;
  if (typeof value._seconds === 'number') return value._seconds * 1000 + (value._nanoseconds || 0) / 1_000_000;
  return new Date(value).getTime();
};

const canonicalEvent = (value: unknown) => String(value || '').replace(/[_\s-]/g, '').toLowerCase();
const eventStatus = (value: unknown): EquityEmailDeliveryStatus | null => {
  switch (canonicalEvent(value)) {
    case 'request': case 'sent': case 'accepted': return 'accepted';
    case 'delivered': case 'opened': case 'uniqueopened': case 'opening': case 'uniqueopening':
    case 'proxyopen': case 'uniqueproxyopen': case 'click': case 'clicked': return 'delivered';
    case 'deferred': case 'softbounce': return 'deferred';
    case 'hardbounce': case 'blocked': case 'invalid': case 'invalidemail': case 'error':
    case 'failed': case 'rejected': case 'spam': case 'unsubscribe': case 'unsubscribed': return 'failed';
    default: return null;
  }
};

const defaultReason = (event: unknown): string => {
  switch (canonicalEvent(event)) {
    case 'deferred': return 'Brevo has delayed delivery and may retry.';
    case 'softbounce': return 'The recipient’s mail server temporarily rejected this email.';
    case 'hardbounce': return 'The recipient’s mail server permanently rejected this email.';
    case 'blocked': return 'Brevo blocked this email.';
    case 'invalid': case 'invalidemail': return 'Brevo reported an invalid recipient email address.';
    case 'spam': return 'Brevo reported a spam complaint for this email.';
    case 'unsubscribe': case 'unsubscribed': return 'Brevo reported that this recipient unsubscribed.';
    default: return 'Brevo reported that this email could not be sent.';
  }
};

/** "Sent" with a provider message ID means accepted, never verified delivery. */
export function getEquityEmailDelivery(request: any): EquityEmailDelivery {
  const saved = request?.emailDelivery;
  if (saved && STATES.has(saved.status)) {
    const delivery: EquityEmailDelivery = {...saved, messageId: saved.messageId ?? null, recipientEmail: normalizeEmail(saved.recipientEmail || request?.recipientEmail)};
    // Older sends could report success when the email helper suppressed the send.
    if (delivery.status === 'accepted' && !normalizeBrevoMessageId(delivery.messageId)) delivery.status = 'unknown';
    if (delivery.status === 'failed' && !delivery.unresolvedFailure) {
      delivery.unresolvedFailure = {reason: delivery.reason || defaultReason(delivery.providerEvent), at: delivery.eventAt || delivery.attemptedAt || null, messageId: delivery.messageId};
    }
    return delivery;
  }
  const legacyStatus = eventStatus(request?.emailStatus);
  const signatureStatus = eventStatus(request?.status);
  const inferredStatus = legacyStatus || (signatureStatus === 'failed' || signatureStatus === 'deferred' ? signatureStatus
    : request?.status === 'sent' && (request?.messageId || request?.sentAt) ? 'accepted' : 'unknown');
  const status = inferredStatus === 'accepted' && !normalizeBrevoMessageId(request?.messageId) ? 'unknown' : inferredStatus;
  const legacyEventAt = request?.lastEmailEventAt || request?.emailDeliveredAt || request?.emailOpenedAt || request?.deliveredAt || request?.openedAt;
  const delivery: EquityEmailDelivery = {
    status, messageId: request?.messageId || null, recipientEmail: normalizeEmail(request?.recipientEmail),
    ...(request?.lastSentAt || request?.sentAt ? {attemptedAt: request.lastSentAt || request.sentAt} : {}),
    ...(legacyEventAt ? {eventAt: legacyEventAt} : {}),
    reason: status === 'failed' || status === 'deferred' ? String(request?.lastEmailError || request?.emailError || request?.emailFailureReason || defaultReason(request?.emailStatus || request?.status)) : null,
  };
  if (status === 'failed') delivery.unresolvedFailure = {reason: delivery.reason!, at: delivery.eventAt || delivery.attemptedAt || null, messageId: delivery.messageId};
  return delivery;
}

export function brevoEmailEventTimestamp(event: BrevoDeliveryEvent): number {
  // The webhook's date is CET/CEST; prefer its UTC numeric event time. API reports use ISO UTC.
  for (const candidate of [event.ts_event, event.ts_epoch, event.ts]) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) return candidate < 1_000_000_000_000 ? candidate * 1000 : candidate;
  }
  if (typeof event.date !== 'string' || !/(Z|[+-]\d{2}:?\d{2})$/i.test(event.date)) return NaN;
  return Date.parse(event.date);
}

/** Apply only evidence for the current send attempt; delivery and failures cannot regress to queued. */
export function applyBrevoEmailEvent(current: EquityEmailDelivery, event: BrevoDeliveryEvent): EquityEmailDelivery {
  const messageId = normalizeBrevoMessageId(event.messageId || event['message-id']);
  if (!messageId || messageId !== normalizeBrevoMessageId(current.messageId)
    || !current.recipientEmail || normalizeEmail(event.email) !== normalizeEmail(current.recipientEmail)) return current;
  const status = eventStatus(event.event);
  const eventAt = brevoEmailEventTimestamp(event);
  if (!status || !Number.isFinite(eventAt)) return current;
  // Brevo timestamps can have second precision, so tolerate rounding within the send's second.
  const attemptedAt = equityEmailTimestamp(current.attemptedAt);
  if (Number.isFinite(attemptedAt) && eventAt < Math.floor(attemptedAt / 1000) * 1000) return current;
  const previousAt = equityEmailTimestamp(current.eventAt);
  if (Number.isFinite(previousAt) && eventAt < previousAt) return current;
  if (current.status === 'delivered' && status !== 'delivered') return current;
  if (current.status === 'failed' && (status === 'accepted' || status === 'deferred')) return current;
  if (current.status === 'deferred' && status === 'accepted') return current;
  const reason = status === 'failed' || status === 'deferred'
    ? (typeof event.reason === 'string' && event.reason.trim() ? event.reason.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 600) : defaultReason(event.event)) : null;
  return {
    ...current, status, providerEvent: String(event.event), eventAt: new Date(eventAt).toISOString(), reason,
    ...(status === 'accepted' && !current.acceptedAt ? {acceptedAt: new Date(eventAt).toISOString()} : {}),
    ...(status === 'failed' ? {unresolvedFailure: {reason: reason!, at: new Date(eventAt).toISOString(), messageId: current.messageId}}
      : status === 'delivered' ? {unresolvedFailure: null} : {}),
  };
}

export const isEquityEmailRequest = (request: any): boolean => Boolean(request && (
  request.equityDocumentId || request.documentType === 'strategic_signing_package'
  || ['eip', 'option_agreement', 'board_consent', 'stockholder_consent', 'fast_agreement', 'advisor_nso_agreement', 'warrant', 'restricted_stock_agreement', 'stock_purchase_agreement', 'founder_share_return', 'equity_reserve_approval'].includes(request.documentType)
  || String(request.documentType || '').startsWith('strategic_')
));
