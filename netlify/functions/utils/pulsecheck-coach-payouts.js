const PAYOUT_REQUESTS_COLLECTION = 'pulsecheck-coach-payout-requests';
const PAYOUT_STATES_COLLECTION = 'pulsecheck-coach-payout-states';
const PAYOUT_METHODS = new Set(['zelle', 'apple_pay', 'cash_app']);

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeEmail = (value) => normalizeString(value).toLowerCase();

const calculatePercentageFeeCents = (amountCents, percentage) => {
  const amount = Math.max(0, Number(amountCents) || 0);
  const rate = Math.min(100, Math.max(0, Number(percentage) || 0));
  return Math.round(amount * (rate / 100));
};

const calculateRevenueBreakdown = ({ amountCents, platformFeePct = 0, sharePct = 0 }) => {
  const grossRevenueCents = Math.max(0, Number(amountCents) || 0);
  const platformFeeCents = calculatePercentageFeeCents(grossRevenueCents, platformFeePct);
  const netRevenueCents = Math.max(0, grossRevenueCents - platformFeeCents);
  const coachShareCents = Math.round(
    netRevenueCents * (Math.min(100, Math.max(0, Number(sharePct) || 0)) / 100)
  );

  return {
    grossRevenueCents,
    platformFeeCents,
    netRevenueCents,
    coachShareCents,
  };
};

const payoutMethodLabel = (method) => ({
  zelle: 'Zelle',
  apple_pay: 'Apple Pay',
  cash_app: 'Cash App',
}[method] || 'Manual payment');

const timestampIso = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.toMillis === 'function') return new Date(value.toMillis()).toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const serializePayoutRequest = (id, data = {}) => ({
  id,
  coachUserId: normalizeString(data.coachUserId),
  coachName: normalizeString(data.coachName) || 'Coach',
  coachEmail: normalizeEmail(data.coachEmail) || null,
  amountCents: Math.max(0, Number(data.amountCents) || 0),
  currency: normalizeString(data.currency).toLowerCase() || 'usd',
  status: normalizeString(data.status).toLowerCase() || 'requested',
  paymentMethod: normalizeString(data.paymentMethod).toLowerCase() || null,
  paymentMethodLabel: payoutMethodLabel(normalizeString(data.paymentMethod).toLowerCase()),
  paymentDestination: normalizeString(data.paymentDestination) || null,
  requestedAt: timestampIso(data.requestedAt),
  paidAt: timestampIso(data.paidAt),
  paidByEmail: normalizeEmail(data.paidByEmail) || null,
  paymentReference: normalizeString(data.paymentReference) || null,
  emailSent: data.emailSent === true,
  teamIds: Array.isArray(data.teamIds) ? data.teamIds.map(normalizeString).filter(Boolean) : [],
  transactionCount: Math.max(0, Number(data.transactionCount) || 0),
});

const buildPayoutSummary = ({ earnedCents, state = {}, activeRequest = null }) => {
  const safeEarnedCents = Math.max(0, Number(earnedCents) || 0);
  const paidCents = Math.max(0, Number(state.paidCents) || 0);
  const requestStatus = normalizeString(activeRequest?.status).toLowerCase();
  const requestedCents = requestStatus === 'requested'
    ? Math.max(0, Number(activeRequest?.amountCents) || Number(state.requestedCents) || 0)
    : 0;
  const availableCents = Math.max(0, safeEarnedCents - paidCents - requestedCents);

  return {
    totalEarnedCents: safeEarnedCents,
    availableCents,
    requestedCents,
    paidCents,
    status: requestedCents > 0 ? 'requested' : 'available',
    activeRequest: activeRequest?.id
      ? serializePayoutRequest(activeRequest.id, activeRequest)
      : null,
  };
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const adminRecipientEmails = () => {
  const configured = [
    process.env.PULSECHECK_PAYOUT_ADMIN_EMAILS,
    process.env.PULSECHECK_PAYOUT_ADMIN_EMAIL,
  ]
    .filter(Boolean)
    .join(',');
  const candidates = configured
    ? configured.split(',')
    : [process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai'];

  return [...new Set(candidates.map(normalizeEmail).filter((email) => email.includes('@')))];
};

const resolveSiteUrl = (event = {}) => {
  const configured = normalizeString(
    process.env.URL
    || process.env.DEPLOY_PRIME_URL
    || process.env.NEXT_PUBLIC_SITE_URL
  ).replace(/\/+$/, '');
  if (configured) return configured;

  const host = normalizeString(
    event.headers?.['x-forwarded-host']
    || event.headers?.['X-Forwarded-Host']
    || event.headers?.host
  );
  if (host) {
    const protocol = normalizeString(
      event.headers?.['x-forwarded-proto']
      || event.headers?.['X-Forwarded-Proto']
    ) || (host.includes('localhost') ? 'http' : 'https');
    return `${protocol}://${host}`;
  }
  return 'https://fitwithpulse.ai';
};

module.exports = {
  PAYOUT_METHODS,
  PAYOUT_REQUESTS_COLLECTION,
  PAYOUT_STATES_COLLECTION,
  adminRecipientEmails,
  buildPayoutSummary,
  calculatePercentageFeeCents,
  calculateRevenueBreakdown,
  escapeHtml,
  normalizeEmail,
  normalizeString,
  payoutMethodLabel,
  resolveSiteUrl,
  serializePayoutRequest,
  timestampIso,
};
