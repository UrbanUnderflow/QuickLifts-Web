import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import admin from '../../../lib/firebase-admin';

type AssessmentId = 'parent' | 'coach' | 'athleticTrainer';

type AssessmentProductConfig = {
  id: AssessmentId;
  productName: string;
  envProductId: string;
  envPaymentLink: string;
  publicEnvPaymentLink: string;
};

type ReferralMetadata = {
  referralType: string;
  coachId: string;
  coachEmail: string;
  teamId: string;
  organizationId: string;
};

const REFERRAL_ATTRIBUTIONS_COLLECTION = 'pulsecheck-referral-attributions';
const PARENT_ASSESSMENT_REFERRAL_TYPE = 'parent-assessment';

const ASSESSMENT_PRODUCTS: AssessmentProductConfig[] = [
  {
    id: 'parent',
    productName: 'Parent Readiness Assessment',
    envProductId: 'STRIPE_PARENT_READINESS_ASSESSMENT_PRODUCT_ID',
    envPaymentLink: 'STRIPE_PARENT_READINESS_ASSESSMENT_PAYMENT_LINK',
    publicEnvPaymentLink: 'NEXT_PUBLIC_STRIPE_PARENT_READINESS_ASSESSMENT_PAYMENT_LINK',
  },
  {
    id: 'coach',
    productName: 'Coach Readiness Assessment',
    envProductId: 'STRIPE_COACH_READINESS_ASSESSMENT_PRODUCT_ID',
    envPaymentLink: 'STRIPE_COACH_READINESS_ASSESSMENT_PAYMENT_LINK',
    publicEnvPaymentLink: 'NEXT_PUBLIC_STRIPE_COACH_READINESS_ASSESSMENT_PAYMENT_LINK',
  },
  {
    id: 'athleticTrainer',
    productName: 'Athletic Trainer Readiness Assessment',
    envProductId: 'STRIPE_ATHLETIC_TRAINER_READINESS_ASSESSMENT_PRODUCT_ID',
    envPaymentLink: 'STRIPE_ATHLETIC_TRAINER_READINESS_ASSESSMENT_PAYMENT_LINK',
    publicEnvPaymentLink: 'NEXT_PUBLIC_STRIPE_ATHLETIC_TRAINER_READINESS_ASSESSMENT_PAYMENT_LINK',
  },
];

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isLocalRequest = (req: NextApiRequest): boolean => {
  const host = normalizeString(req.headers.host);
  const origin = normalizeString(req.headers.origin);
  return [host, origin].some((value) => value.includes('localhost') || value.includes('127.0.0.1'));
};

const getStripe = (req: NextApiRequest): Stripe | null => {
  const secretKey = isLocalRequest(req)
    ? normalizeString(process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY)
    : normalizeString(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY);

  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey, { apiVersion: '2023-10-16' });
};

const formatPrice = (amountCents: number, currency: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);

const siteOrigin = (req: NextApiRequest): string => {
  const origin = normalizeString(req.headers.origin);
  if (origin) return origin;
  const host = normalizeString(req.headers.host);
  if (host.includes('localhost') || host.includes('127.0.0.1')) return `http://${host}`;
  return normalizeString(process.env.SITE_URL) || 'https://fitwithpulse.ai';
};

const configuredPaymentLink = (config: AssessmentProductConfig): string =>
  normalizeString(process.env[config.envPaymentLink] || process.env[config.publicEnvPaymentLink]);

const buildClientReferenceId = (metadata: Record<string, string>): string => {
  const payload = {
    payment_type: metadata.payment_type,
    assessmentId: metadata.assessmentId,
    referralType: metadata.referralType,
    coachId: metadata.coachId,
    coachEmail: metadata.coachEmail,
    teamId: metadata.teamId,
    organizationId: metadata.organizationId,
    purchaserUserId: metadata.purchaserUserId,
    purchaserEmail: metadata.purchaserEmail,
  };
  return `pc_assessment_${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
};

const buildPaymentLinkUrl = (paymentLink: string, metadata: Record<string, string>): string => {
  const url = new URL(paymentLink);
  url.searchParams.set('client_reference_id', buildClientReferenceId(metadata));
  return url.toString();
};

const fallbackProducts = () =>
  ASSESSMENT_PRODUCTS.map((config) => {
    const paymentLink = configuredPaymentLink(config);
    return {
      id: config.id,
      productName: config.productName,
      available: Boolean(paymentLink),
      checkoutMode: paymentLink ? 'payment_link' : 'not_configured',
      priceLabel: '$49.99',
    };
  });

const findProduct = async (
  stripe: Stripe,
  config: AssessmentProductConfig
): Promise<Stripe.Product | null> => {
  const configuredProductId = normalizeString(process.env[config.envProductId]);
  if (configuredProductId) {
    const product = await stripe.products.retrieve(configuredProductId);
    return product.deleted ? null : product;
  }

  let startingAfter: string | undefined;
  do {
    const page = await stripe.products.list({
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const match = page.data.find((product) => product.name === config.productName);
    if (match) return match;
    startingAfter = page.has_more && page.data.length ? page.data[page.data.length - 1].id : undefined;
  } while (startingAfter);

  return null;
};

const resolveActivePrice = async (
  stripe: Stripe,
  product: Stripe.Product
): Promise<Stripe.Price | null> => {
  const defaultPriceId =
    typeof product.default_price === 'string'
      ? product.default_price
      : product.default_price?.id;

  if (defaultPriceId) {
    const defaultPrice = await stripe.prices.retrieve(defaultPriceId);
    if (defaultPrice.active && typeof defaultPrice.unit_amount === 'number') {
      return defaultPrice;
    }
  }

  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });

  return (
    prices.data
      .filter((price) => typeof price.unit_amount === 'number')
      .sort((left, right) => right.created - left.created)[0] || null
  );
};

const loadAssessmentProducts = async (stripe: Stripe) => {
  const products = await Promise.all(
    ASSESSMENT_PRODUCTS.map(async (config) => {
      const product = await findProduct(stripe, config);
      if (!product) {
        const paymentLink = configuredPaymentLink(config);
        return {
          id: config.id,
          productName: config.productName,
          available: Boolean(paymentLink),
          checkoutMode: paymentLink ? 'payment_link' : 'not_configured',
          priceLabel: '$49.99',
        };
      }

      const price = await resolveActivePrice(stripe, product);
      if (!price || typeof price.unit_amount !== 'number') {
        const paymentLink = configuredPaymentLink(config);
        return {
          id: config.id,
          productName: product.name,
          productId: product.id,
          available: Boolean(paymentLink),
          checkoutMode: paymentLink ? 'payment_link' : 'not_configured',
          priceLabel: '$49.99',
        };
      }

      return {
        id: config.id,
        productName: product.name,
        productId: product.id,
        priceId: price.id,
        amountCents: price.unit_amount,
        currency: price.currency,
        priceLabel: formatPrice(price.unit_amount, price.currency),
        available: true,
        checkoutMode: 'checkout_session',
      };
    })
  );

  return products;
};

const sanitizeMetadataValue = (value: unknown): string => normalizeString(value).slice(0, 450);

const hasCompleteReferralMetadata = (metadata: ReferralMetadata): boolean =>
  Boolean(metadata.referralType && metadata.coachId && metadata.teamId && metadata.organizationId);

const referralAttributionDocId = (userId: string, referralType: string): string => `${userId}_${referralType}`;

const loadSavedReferralAttribution = async (
  userId: string,
  assessmentId: AssessmentId
): Promise<ReferralMetadata | null> => {
  if (assessmentId !== 'parent') return null;

  const snapshot = await admin
    .firestore()
    .collection(REFERRAL_ATTRIBUTIONS_COLLECTION)
    .doc(referralAttributionDocId(userId, PARENT_ASSESSMENT_REFERRAL_TYPE))
    .get();

  if (!snapshot.exists) return null;
  const data = snapshot.data() || {};
  const metadata = {
    referralType: sanitizeMetadataValue(data.referralType),
    coachId: sanitizeMetadataValue(data.coachId),
    coachEmail: sanitizeMetadataValue(data.coachEmail),
    teamId: sanitizeMetadataValue(data.teamId),
    organizationId: sanitizeMetadataValue(data.organizationId),
  };

  return hasCompleteReferralMetadata(metadata) ? metadata : null;
};

const verifyPurchaser = async (req: NextApiRequest) => {
  const authHeader = normalizeString(req.headers.authorization);
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Sign in before purchasing this assessment.');
  }

  const decoded = await admin.auth().verifyIdToken(authHeader.slice('Bearer '.length));
  return {
    userId: decoded.uid,
    email: normalizeString(decoded.email),
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ success: false, message: 'Method not allowed.' });
    return;
  }

  try {
    const stripe = getStripe(req);

    if (req.method === 'GET') {
      if (!stripe) {
        res.status(200).json({ success: true, products: fallbackProducts(), stripeConfigured: false });
        return;
      }

      const products = await loadAssessmentProducts(stripe);
      res.status(200).json({ success: true, products, stripeConfigured: true });
      return;
    }

    const assessmentId = sanitizeMetadataValue(req.body?.assessmentId) as AssessmentId;
    const config = ASSESSMENT_PRODUCTS.find((item) => item.id === assessmentId);
    if (!config) {
      res.status(400).json({ success: false, message: 'Unknown assessment.' });
      return;
    }

    const purchaser = await verifyPurchaser(req);

    const requestReferralMetadata = {
      referralType: sanitizeMetadataValue(req.body?.referralType),
      coachId: sanitizeMetadataValue(req.body?.coachId),
      coachEmail: sanitizeMetadataValue(req.body?.coachEmail),
      teamId: sanitizeMetadataValue(req.body?.teamId),
      organizationId: sanitizeMetadataValue(req.body?.organizationId),
    };
    const savedReferralMetadata = hasCompleteReferralMetadata(requestReferralMetadata)
      ? null
      : await loadSavedReferralAttribution(purchaser.userId, assessmentId);
    const referralMetadata = savedReferralMetadata || requestReferralMetadata;

    const metadata = {
      payment_type: 'pulsecheck_assessment',
      assessmentId,
      referralType: referralMetadata.referralType,
      coachId: referralMetadata.coachId,
      coachEmail: referralMetadata.coachEmail,
      teamId: referralMetadata.teamId,
      organizationId: referralMetadata.organizationId,
      purchaserUserId: purchaser.userId,
      purchaserEmail: purchaser.email || sanitizeMetadataValue(req.body?.purchaserEmail),
    };

    if (!stripe) {
      const paymentLink = configuredPaymentLink(config);
      if (paymentLink) {
        res.status(200).json({
          success: true,
          url: buildPaymentLinkUrl(paymentLink, metadata),
          checkoutMode: 'payment_link',
        });
        return;
      }

      res.status(503).json({
        success: false,
        message: isLocalRequest(req)
          ? 'Stripe checkout needs STRIPE_TEST_SECRET_KEY locally, or an assessment Payment Link in the local env.'
          : 'Stripe checkout needs STRIPE_SECRET_KEY, or an assessment Payment Link in the environment.',
      });
      return;
    }

    const product = await findProduct(stripe, config);
    if (!product) {
      res.status(404).json({ success: false, message: `${config.productName} is not active in Stripe.` });
      return;
    }

    const price = await resolveActivePrice(stripe, product);
    if (!price) {
      res.status(404).json({ success: false, message: `${product.name} does not have an active Stripe price.` });
      return;
    }

    const origin = siteOrigin(req);
    const referralParams = new URLSearchParams({
      assessment: assessmentId,
      payment: 'success',
    });
    const cancelParams = new URLSearchParams({ assessment: assessmentId });

    const checkoutMetadata = {
      ...metadata,
      assessmentProductName: product.name,
      stripeProductId: product.id,
      stripePriceId: price.id,
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${origin}/PulseCheck/assessments?${referralParams.toString()}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/elite-athlete-support-readiness-assessments?${cancelParams.toString()}&purchase=cancelled`,
      client_reference_id: buildClientReferenceId(metadata),
      metadata: checkoutMetadata,
      payment_intent_data: { metadata: checkoutMetadata },
      ...(metadata.purchaserEmail ? { customer_email: metadata.purchaserEmail } : {}),
      allow_promotion_codes: true,
    });

    res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('[assessment-checkout] Failed:', error);
    const message = error instanceof Error ? error.message : 'Assessment checkout failed.';
    const status = message.includes('Sign in before purchasing') || message.includes('Firebase ID token')
      ? 401
      : 500;
    res.status(status).json({
      success: false,
      message,
    });
  }
}
