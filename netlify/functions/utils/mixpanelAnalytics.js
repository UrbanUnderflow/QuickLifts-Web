const crypto = require('crypto');
const fetchImpl = globalThis.fetch || require('node-fetch');

const DEFAULT_TIMEOUT_MS = 2500;

const MACRA_MIXPANEL_EVENTS = Object.freeze({
  emailSent: 'Macra Web Offer Email Sent',
  emailDelivered: 'Macra Web Offer Email Delivered',
  emailOpened: 'Macra Web Offer Email Opened',
  emailClicked: 'Macra Web Offer Email Clicked',
  emailIssue: 'Macra Web Offer Email Issue',
  retargetingEmailSent: 'Macra Retargeting Email Sent',
  retargetingEmailDelivered: 'Macra Retargeting Email Delivered',
  retargetingEmailOpened: 'Macra Retargeting Email Opened',
  retargetingEmailClicked: 'Macra Retargeting Email Clicked',
  retargetingEmailIssue: 'Macra Retargeting Email Issue',
  checkoutStarted: 'Macra Web Checkout Started',
  checkoutCompleted: 'Macra Web Checkout Completed',
  trialActivated: 'Macra Web Trial Activated',
  purchaseCompleted: 'Macra Web Purchase Completed',
  trialConverted: 'Macra Trial Converted',
  subscriptionRenewed: 'Macra Subscription Renewed',
  subscriptionCancelled: 'Macra Subscription Cancelled',
});

const MACRA_WEB_OFFER_BASE_PROPERTIES = Object.freeze({
  product: 'macra',
  funnel: 'macra_subscription',
  purchase_surface: 'web_stripe_offer',
  payment_provider: 'stripe',
  checkout_source: 'macra_retarget_email',
  campaign_id: 'macra-web-offer-24h-v1',
});

let warnedMissingToken = false;

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const getMixpanelToken = () =>
  normalizeString(process.env.MIXPANEL_PROJECT_TOKEN) ||
  normalizeString(process.env.MIXPANEL_TOKEN) ||
  normalizeString(process.env.NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN);

const getMixpanelEndpoint = () => {
  const explicitEndpoint = normalizeString(process.env.MIXPANEL_TRACK_ENDPOINT);
  if (explicitEndpoint) return explicitEndpoint;

  const region = normalizeString(process.env.MIXPANEL_REGION).toLowerCase();
  if (region === 'eu') return 'https://api-eu.mixpanel.com/track';
  return 'https://api.mixpanel.com/track';
};

const getEnvironment = () =>
  normalizeString(process.env.MIXPANEL_ENVIRONMENT) ||
  normalizeString(process.env.CONTEXT) ||
  normalizeString(process.env.NODE_ENV) ||
  'unknown';

const compactValue = (value) => {
  if (value === undefined || typeof value === 'function') return undefined;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map(compactValue).filter((item) => item !== undefined);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, nestedValue]) => {
      const compacted = compactValue(nestedValue);
      if (compacted !== undefined) acc[key] = compacted;
      return acc;
    }, {});
  }
  return value;
};

const compactProperties = (properties = {}) => compactValue(properties) || {};

const buildInsertId = (eventName, distinctId) => {
  if (crypto.randomUUID) return crypto.randomUUID();
  return crypto
    .createHash('sha256')
    .update([eventName, distinctId, Date.now(), Math.random()].join('|'))
    .digest('hex');
};

async function trackMixpanelEvent(eventName, distinctId, properties = {}) {
  const token = getMixpanelToken();
  if (!token) {
    if (!warnedMissingToken) {
      warnedMissingToken = true;
      console.warn('[Mixpanel] Missing MIXPANEL_PROJECT_TOKEN/NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN. Server event tracking skipped.');
    }
    return { tracked: false, skipped: true, reason: 'missing_token' };
  }

  const cleanedProperties = compactProperties(properties);
  const resolvedDistinctId =
    normalizeString(distinctId) ||
    normalizeString(cleanedProperties.distinct_id) ||
    normalizeString(cleanedProperties.user_id) ||
    normalizeString(cleanedProperties.email) ||
    'macra_server_event';

  const payload = {
    event: eventName,
    properties: {
      ...cleanedProperties,
      token,
      distinct_id: resolvedDistinctId,
      time: cleanedProperties.time || Math.floor(Date.now() / 1000),
      $insert_id: cleanedProperties.$insert_id || buildInsertId(eventName, resolvedDistinctId),
      source_system: cleanedProperties.source_system || 'quicklifts-web-netlify',
      environment: cleanedProperties.environment || getEnvironment(),
    },
  };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(), Number(process.env.MIXPANEL_TIMEOUT_MS || DEFAULT_TIMEOUT_MS))
    : null;

  try {
    const url = new URL(getMixpanelEndpoint());
    url.searchParams.set('verbose', '1');

    const response = await fetchImpl(url.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    if (text) {
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        if (text.trim() === '0') throw new Error('Mixpanel rejected event.');
        if (text.trim() !== '1') {
          const message = parseError instanceof Error ? parseError.message : String(parseError);
          console.warn('[Mixpanel] Unexpected response while tracking event:', eventName, message);
        }
      }

      if (parsed?.status === 0) {
        throw new Error(parsed.error || 'Mixpanel rejected event.');
      }
    }

    return { tracked: true, skipped: false };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function safeTrackMixpanelEvent(eventName, distinctId, properties = {}) {
  try {
    return await trackMixpanelEvent(eventName, distinctId, properties);
  } catch (error) {
    console.warn('[Mixpanel] Failed to track server event:', eventName, error?.message || error);
    return { tracked: false, skipped: false, error: error?.message || String(error) };
  }
}

async function safeTrackMacraWebOfferEvent(args = {}) {
  const {
    eventName,
    userId,
    email,
    insertId,
    properties = {},
  } = args;

  if (!eventName) {
    return { tracked: false, skipped: true, reason: 'missing_event_name' };
  }

  const distinctId = normalizeString(userId) || normalizeString(email);
  return safeTrackMixpanelEvent(eventName, distinctId, {
    ...MACRA_WEB_OFFER_BASE_PROPERTIES,
    user_id: normalizeString(userId) || undefined,
    email: normalizeString(email) || undefined,
    $insert_id: normalizeString(insertId) || undefined,
    ...properties,
  });
}

module.exports = {
  MACRA_MIXPANEL_EVENTS,
  MACRA_WEB_OFFER_BASE_PROPERTIES,
  safeTrackMacraWebOfferEvent,
  safeTrackMixpanelEvent,
  trackMixpanelEvent,
};
