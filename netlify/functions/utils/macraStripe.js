const crypto = require('crypto');

const MACRA_WEB_OFFER_CAMPAIGN_ID = 'macra-web-offer-24h-v1';

const ACTIVE_SUBSCRIPTION_TYPES = new Set([
  'beta user',
  'beta',
  'monthly subscriber',
  'monthly',
  'annual subscriber',
  'annual',
  'subscriber',
  'lifetime subscriber',
  'lifetime',
]);

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const firstEnv = (names) => {
  for (const name of names) {
    const value = normalizeString(process.env[name]);
    if (value) return value;
  }
  return '';
};

const normalizePlan = (value) => {
  const normalized = normalizeString(value).toLowerCase();
  if (['monthly', 'month', 'mo'].includes(normalized)) return 'monthly';
  if (['annual', 'yearly', 'year', 'yr'].includes(normalized)) return 'annual';
  return 'monthly';
};

const getMacraPriceIds = () => ({
  liveMonthly: firstEnv([
    'STRIPE_PRICE_MACRA_MONTHLY',
    'STRIPE_MACRA_MONTHLY_PRICE_ID',
    'NEXT_PUBLIC_STRIPE_PRICE_MACRA_MONTHLY',
    'NEXT_PUBLIC_STRIPE_MACRA_MONTHLY_PRICE_ID',
  ]),
  liveAnnual: firstEnv([
    'STRIPE_PRICE_MACRA_ANNUAL',
    'STRIPE_MACRA_ANNUAL_PRICE_ID',
    'NEXT_PUBLIC_STRIPE_PRICE_MACRA_ANNUAL',
    'NEXT_PUBLIC_STRIPE_MACRA_ANNUAL_PRICE_ID',
  ]),
  testMonthly: firstEnv([
    'STRIPE_TEST_PRICE_MACRA_MONTHLY',
    'STRIPE_TEST_MACRA_MONTHLY_PRICE_ID',
    'NEXT_PUBLIC_STRIPE_TEST_PRICE_MACRA_MONTHLY',
    'NEXT_PUBLIC_STRIPE_TEST_MACRA_MONTHLY_PRICE_ID',
  ]),
  testAnnual: firstEnv([
    'STRIPE_TEST_PRICE_MACRA_ANNUAL',
    'STRIPE_TEST_MACRA_ANNUAL_PRICE_ID',
    'NEXT_PUBLIC_STRIPE_TEST_PRICE_MACRA_ANNUAL',
    'NEXT_PUBLIC_STRIPE_TEST_MACRA_ANNUAL_PRICE_ID',
  ]),
});

const resolveMacraPriceId = ({ plan, isTestMode, priceId }) => {
  const explicitPriceId = normalizeString(priceId);
  if (explicitPriceId) return explicitPriceId;

  const priceIds = getMacraPriceIds();
  const normalizedPlan = normalizePlan(plan);

  if (normalizedPlan === 'annual') {
    return isTestMode ? priceIds.testAnnual : priceIds.liveAnnual;
  }

  return isTestMode ? priceIds.testMonthly : priceIds.liveMonthly;
};

const mapMacraPriceIdToPlan = (priceId) => {
  const normalizedPriceId = normalizeString(priceId);
  if (!normalizedPriceId) return null;

  const priceIds = getMacraPriceIds();
  if ([priceIds.liveMonthly, priceIds.testMonthly].filter(Boolean).includes(normalizedPriceId)) {
    return 'monthly';
  }
  if ([priceIds.liveAnnual, priceIds.testAnnual].filter(Boolean).includes(normalizedPriceId)) {
    return 'annual';
  }

  return null;
};

const mapMacraPriceIdToPlanType = (priceId) => {
  const plan = mapMacraPriceIdToPlan(priceId);
  if (plan === 'monthly') return 'macra-monthly';
  if (plan === 'annual') return 'macra-annual';
  return null;
};

const mapMacraPriceIdToSubscriptionType = (priceId, SubscriptionType) => {
  const plan = mapMacraPriceIdToPlan(priceId);
  if (plan === 'monthly') return SubscriptionType.monthly;
  if (plan === 'annual') return SubscriptionType.annual;
  return null;
};

const isMacraMetadata = (metadata = {}) => {
  const userType = normalizeString(metadata.userType).toLowerCase();
  const product = normalizeString(metadata.product).toLowerCase();
  const campaignId = normalizeString(metadata.campaignId);
  const checkoutSource = normalizeString(metadata.checkoutSource).toLowerCase();
  return (
    userType === 'macra' ||
    product === 'macra' ||
    campaignId.startsWith('macra-') ||
    checkoutSource.includes('macra')
  );
};

const isMacraSubscriptionContext = ({ subscription, session, priceId }) => {
  if (mapMacraPriceIdToPlan(priceId)) return true;
  if (isMacraMetadata(subscription?.metadata || {})) return true;
  if (isMacraMetadata(session?.metadata || {})) return true;
  return false;
};

const isMacraWebOfferContext = ({ subscription, session }) => {
  const metadata = {
    ...(subscription?.metadata || {}),
    ...(session?.metadata || {}),
  };
  return (
    normalizeString(metadata.campaignId) === MACRA_WEB_OFFER_CAMPAIGN_ID ||
    normalizeString(metadata.offerId) === MACRA_WEB_OFFER_CAMPAIGN_ID ||
    normalizeString(metadata.webOffer).toLowerCase() === 'true'
  );
};

const getMacraOfferSigningSecret = () =>
  firstEnv([
    'MACRA_WEB_OFFER_LINK_SECRET',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_SECRET_KEY',
    'BREVO_MARKETING_KEY',
    'BREVO_API_KEY',
  ]);

const buildMacraOfferSignaturePayload = ({ userId, campaignId, plan, expiresAt }) =>
  [normalizeString(userId), normalizeString(campaignId), normalizePlan(plan), String(expiresAt || '')].join('|');

const signMacraOfferLink = ({ userId, campaignId, plan, expiresAt, secret }) => {
  const signingSecret = normalizeString(secret) || getMacraOfferSigningSecret();
  if (!signingSecret) {
    throw new Error('MACRA_WEB_OFFER_LINK_SECRET or fallback signing secret is not configured.');
  }
  return crypto
    .createHmac('sha256', signingSecret)
    .update(buildMacraOfferSignaturePayload({ userId, campaignId, plan, expiresAt }))
    .digest('hex');
};

const verifyMacraOfferLinkSignature = ({ userId, campaignId, plan, expiresAt, signature }) => {
  const expected = signMacraOfferLink({ userId, campaignId, plan, expiresAt });
  const provided = normalizeString(signature);
  if (!expected || !provided || expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
};

const toMillis = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      try {
        return value.toDate().getTime();
      } catch {
        return null;
      }
    }
    const seconds = value.seconds ?? value._seconds;
    if (typeof seconds === 'number') return seconds * 1000;
  }
  return null;
};

const ageFromBirthdateMs = (birthdateMs, nowMs = Date.now()) => {
  if (!birthdateMs) return null;
  const birthdate = new Date(birthdateMs);
  if (Number.isNaN(birthdate.getTime())) return null;
  const now = new Date(nowMs);
  let age = now.getUTCFullYear() - birthdate.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - birthdate.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < birthdate.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 && age < 120 ? age : null;
};

const hasActiveRootSubscription = (userData = {}, nowMs = Date.now()) => {
  const type = normalizeString(userData.subscriptionType).toLowerCase();
  if (ACTIVE_SUBSCRIPTION_TYPES.has(type)) return true;
  const trialEndMs = toMillis(userData.trialEndDate);
  return Boolean(userData.isTrialing && trialEndMs && trialEndMs > nowMs);
};

const hasActiveSubscriptionPlan = async ({ db, userId, nowMs = Date.now() }) => {
  const snap = await db.collection('subscriptions').doc(userId).get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  const plans = Array.isArray(data.plans) ? data.plans : [];
  const nowSec = Math.floor(nowMs / 1000);
  return plans.some((plan) => {
    const expiration = Number(plan?.expiration || 0);
    if (expiration <= nowSec) return false;
    const type = normalizeString(plan?.type).toLowerCase();
    return type.includes('macra') || type.includes('pulsecheck') || type.includes('annual') || type.includes('monthly');
  });
};

const getMacraBirthdateMs = async ({ db, userId, userData = {} }) => {
  try {
    const profileSnap = await db.collection('users').doc(userId).collection('macra').doc('profile').get();
    if (profileSnap.exists) {
      const profileData = profileSnap.data() || {};
      const profileBirthdateMs = toMillis(profileData.birthdate);
      if (profileBirthdateMs) return profileBirthdateMs;
    }
  } catch (error) {
    console.warn('[macraStripe] Failed to load Macra profile birthdate:', userId, error?.message || error);
  }
  return toMillis(userData.birthdate);
};

const markMacraWebOfferState = async ({ db, admin, userId, subscription, session, stage, extra = {} }) => {
  if (!userId) return;
  const metadata = {
    ...(subscription?.metadata || {}),
    ...(session?.metadata || {}),
  };
  if (!isMacraWebOfferContext({ subscription, session })) return;

  const plan =
    normalizePlan(metadata.checkoutPlan) ||
    mapMacraPriceIdToPlan(subscription?.items?.data?.[0]?.price?.id) ||
    mapMacraPriceIdToPlan(session?.line_items?.data?.[0]?.price?.id);

  const stateUpdate = {
    webOffer24hStatus: stage,
    webOffer24hLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    webOffer24hCampaignId: normalizeString(metadata.campaignId) || MACRA_WEB_OFFER_CAMPAIGN_ID,
    webOffer24hPlan: plan,
    ...extra,
  };

  if (session?.id) stateUpdate.webOffer24hCheckoutSessionId = session.id;
  if (subscription?.id) stateUpdate.webOffer24hStripeSubscriptionId = subscription.id;
  const customerId = subscription?.customer || session?.customer;
  if (customerId) {
    stateUpdate.webOffer24hStripeCustomerId =
      typeof customerId === 'string' ? customerId : customerId.id;
  }
  if (stage === 'checkout_completed' || stage === 'converted') {
    stateUpdate.webOffer24hCheckoutCompletedAt = admin.firestore.FieldValue.serverTimestamp();
    stateUpdate.webOffer24hConvertedAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await db.collection('users').doc(userId).set(
    { macraEmailSequenceState: stateUpdate },
    { merge: true }
  );
};

module.exports = {
  ACTIVE_SUBSCRIPTION_TYPES,
  MACRA_WEB_OFFER_CAMPAIGN_ID,
  ageFromBirthdateMs,
  getMacraBirthdateMs,
  hasActiveRootSubscription,
  hasActiveSubscriptionPlan,
  isMacraSubscriptionContext,
  isMacraWebOfferContext,
  mapMacraPriceIdToPlan,
  mapMacraPriceIdToPlanType,
  mapMacraPriceIdToSubscriptionType,
  markMacraWebOfferState,
  normalizePlan,
  normalizeString,
  resolveMacraPriceId,
  signMacraOfferLink,
  toMillis,
  verifyMacraOfferLinkSignature,
};
