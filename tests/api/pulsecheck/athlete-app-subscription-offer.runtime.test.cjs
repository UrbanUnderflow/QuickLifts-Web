const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  createFirestoreAdminMock,
  repoRoot,
  withModuleMocks,
  withPatchedEnv,
} = require('../firebase-admin/_runtimeHarness.cjs');

const LIB_PATH = path.join(
  repoRoot,
  'netlify/functions/lib/pulsecheck-athlete-app-offers.js'
);
const MANAGE_PATH = path.join(
  repoRoot,
  'netlify/functions/manage-pulsecheck-athlete-subscription-offer.js'
);
const CHECKOUT_PATH = path.join(
  repoRoot,
  'netlify/functions/create-athlete-checkout-session.js'
);
const VERIFY_PATH = path.join(
  repoRoot,
  'netlify/functions/verify-subscription.js'
);
const EARNINGS_PATH = path.join(
  repoRoot,
  'netlify/functions/get-pulsecheck-coach-earnings.js'
);
const ADMIN_PAYOUT_PATH = path.join(
  repoRoot,
  'netlify/functions/pulsecheck-admin-payouts.js'
);
const STRIPE_WEBHOOK_PATH = path.join(
  repoRoot,
  'netlify/functions/stripe-webhook.js'
);

const env = {
  STRIPE_SECRET_KEY: 'sk_live_test',
  STRIPE_TEST_SECRET_KEY: 'sk_test_test',
  PULSECHECK_STRIPE_MODE: 'live',
  SITE_URL: 'https://fitwithpulse.ai',
};

const baseCollections = () => ({
  users: [{ id: 'mock-user', data: { email: 'athlete@example.com' } }],
  admin: [],
  'pulsecheck-organizations': [
    { id: 'org_1', data: { status: 'active', displayName: 'Test Organization' } },
  ],
  'pulsecheck-teams': [
    {
      id: 'team_1',
      data: {
        organizationId: 'org_1',
        status: 'active',
        displayName: 'Test Team',
        commercialConfig: {
          commercialModel: 'athlete-pay',
          teamPlanStatus: 'inactive',
          athleteAppSubscriptionEnabled: false,
        },
      },
    },
  ],
  'pulsecheck-team-memberships': [
    {
      id: 'team_1_coach_1',
      data: {
        organizationId: 'org_1',
        teamId: 'team_1',
        userId: 'coach_1',
        role: 'coach',
        status: 'active',
        staffCapabilities: ['coaching'],
      },
    },
  ],
  'pulsecheck-invite-links': [
    {
      id: 'invite_1',
      data: {
        inviteType: 'team-access',
        status: 'active',
        redemptionMode: 'general',
        organizationId: 'org_1',
        teamId: 'team_1',
        teamMembershipRole: 'athlete',
      },
    },
  ],
  subscriptions: [{ id: 'mock-user', data: { plans: [] } }],
  'pulsecheck-athlete-app-offers': [],
  'pulsecheck-athlete-app-entitlements': [],
  'pulsecheck-athlete-app-checkouts': [],
  'pulsecheck-athlete-app-revenue-events': [],
});

function stripeFactory() {
  const calls = {
    keys: [],
    products: [],
    prices: [],
    priceUpdates: [],
    sessions: [],
  };
  function Stripe(key) {
    calls.keys.push(key);
    return {
      products: {
        async create(params) {
          calls.products.push(params);
          return { id: 'prod_team_1' };
        },
      },
      prices: {
        async create(params) {
          calls.prices.push(params);
          return { id: `price_server_${params.unit_amount}` };
        },
        async update(id, params) {
          calls.priceUpdates.push({ id, params });
          return { id, ...params };
        },
      },
      checkout: {
        sessions: {
          async create(params) {
            calls.sessions.push(params);
            return {
              id: 'cs_offer_1',
              url: 'https://checkout.stripe.com/c/pay/cs_offer_1',
              status: 'open',
              client_reference_id: params.client_reference_id,
              metadata: params.metadata,
            };
          },
          async retrieve(id) {
            const params = calls.sessions[0];
            return {
              id,
              url: 'https://checkout.stripe.com/c/pay/cs_offer_1',
              status: 'open',
              client_reference_id: params.client_reference_id,
              metadata: params.metadata,
            };
          },
        },
      },
    };
  }
  Stripe.calls = calls;
  return Stripe;
}

function webhookStripeFactory() {
  function Stripe() {
    return {
      webhooks: {
        constructEvent(body) {
          return JSON.parse(body);
        },
      },
      checkout: {
        sessions: {
          async listLineItems() { return { data: [] }; },
        },
      },
      subscriptions: {
        async retrieve(id) {
          const subscription = Stripe.subscriptionsById.get(id);
          if (!subscription) throw new Error(`Unexpected subscription lookup: ${id}`);
          return subscription;
        },
      },
    };
  }
  Stripe.subscriptionsById = new Map();
  return Stripe;
}

const coachServicesMock = (firebase, userId = 'coach_1', options = {}) => ({
  normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
  },
  resolveServerStripeMode() {
    return 'live';
  },
  async verifyFirebaseUser() {
    return {
      userId,
      decoded: {
        uid: userId,
        email: options.email || `${userId}@example.com`,
        email_verified: options.emailVerified !== false,
      },
      app: { name: options.appName || 'pulsecheck-prod-admin', firestore: () => firebase.db },
    };
  },
});

const firebaseModule = (firebase) => ({
  admin: firebase.admin,
  db: firebase.db,
  headers: {},
  getFirebaseAdminApp: () => ({
    auth: () => firebase.admin.auth(),
    firestore: () => firebase.db,
  }),
});

function loadManage(firebase, Stripe, userId = 'coach_1') {
  delete require.cache[LIB_PATH];
  delete require.cache[MANAGE_PATH];
  return withModuleMocks({
    stripe: Stripe,
    './config/firebase': firebaseModule(firebase),
    './lib/pulsecheck-coach-services': coachServicesMock(firebase, userId),
    './pulsecheck-coach-services': coachServicesMock(firebase, userId),
  }, () => require(MANAGE_PATH));
}

function loadCheckout(firebase, Stripe, userId = 'mock-user', options = {}) {
  delete require.cache[LIB_PATH];
  delete require.cache[CHECKOUT_PATH];
  return withModuleMocks({
    stripe: Stripe,
    './config/firebase': firebaseModule(firebase),
    './lib/pulsecheck-coach-services': coachServicesMock(firebase, userId, options),
    './pulsecheck-coach-services': coachServicesMock(firebase, userId, options),
  }, () => require(CHECKOUT_PATH));
}

function loadVerify(firebase, Stripe, options = {}) {
  delete require.cache[LIB_PATH];
  delete require.cache[VERIFY_PATH];
  return withModuleMocks({
    stripe: Stripe,
    './config/firebase': firebaseModule(firebase),
    './lib/pulsecheck-coach-services': coachServicesMock(firebase, 'athlete_1', options),
    './pulsecheck-coach-services': coachServicesMock(firebase, 'athlete_1', options),
  }, () => require(VERIFY_PATH));
}

function loadEarnings(firebase, Stripe) {
  delete require.cache[EARNINGS_PATH];
  return withModuleMocks({
    stripe: Stripe,
    './config/firebase': firebaseModule(firebase),
    './lib/pulsecheck-coach-services': {
      ...coachServicesMock(firebase, 'coach_1'),
      verifyOrderIntegrity: () => true,
    },
  }, () => require(EARNINGS_PATH));
}

function loadAdminPayout(firebase, loadCoachEarnings) {
  delete require.cache[ADMIN_PAYOUT_PATH];
  return withModuleMocks({
    './config/firebase': firebaseModule(firebase),
    './get-pulsecheck-coach-earnings': { loadCoachEarnings },
  }, () => require(ADMIN_PAYOUT_PATH));
}

function loadStripeWebhook({ prodFirebase, devFirebase, Stripe }) {
  delete require.cache[LIB_PATH];
  delete require.cache[STRIPE_WEBHOOK_PATH];
  const coachServices = {
    ...coachServicesMock(prodFirebase, 'unused'),
    markOrderPaid: async () => {},
    markSubscriptionOrderActive: async () => {},
    orderRef: () => null,
  };
  return withModuleMocks({
    stripe: Stripe,
    './config/firebase': {
      admin: prodFirebase.admin,
      headers: {},
      getFirebaseAdminApp(request) {
        const mode = request?.headers?.['x-pulsecheck-firebase-mode'];
        const firebase = mode === 'dev' ? devFirebase : prodFirebase;
        return { firestore: () => firebase.db };
      },
    },
    './google-secret-manager-utils': {
      getSecretWithEnvFallback: async () => 'whsec_test',
    },
    './utils/pulsecheck-revenue': {
      normalizeCommercialConfig: () => ({}),
      readPulseCheckAttributionFromMetadata: () => ({}),
      recalculatePulseCheckRevenueSummaries: async () => {},
      upsertPulseCheckRevenueEvent: async () => null,
    },
    './utils/macraStripe': {
      isMacraSubscriptionContext: () => false,
      isMacraWebOfferContext: () => false,
      mapMacraPriceIdToPlanType: () => null,
      mapMacraPriceIdToSubscriptionType: () => null,
      markMacraWebOfferState: async () => {},
    },
    './utils/mixpanelAnalytics': {
      MACRA_MIXPANEL_EVENTS: {},
      safeTrackMacraWebOfferEvent: async () => {},
    },
    './lib/coaching': {
      coachingCheckoutResult: () => null,
      isCoachingSession: () => false,
      isCoachingSubscription: () => false,
      subscriptionPaymentStatus: () => 'active',
    },
    './lib/pulsecheck-coach-services': coachServices,
    './pulsecheck-coach-services': coachServices,
  }, () => require(STRIPE_WEBHOOK_PATH));
}

function post(body, authorization = 'Bearer valid-token') {
  return {
    httpMethod: 'POST',
    headers: { authorization },
    body: JSON.stringify(body),
  };
}

test('authorized coach creates a server-owned monthly Stripe price and can pause with zero from the UI', async () => {
  const firebase = createFirestoreAdminMock({ collections: baseCollections() });
  const Stripe = stripeFactory();
  await withPatchedEnv(env, async () => {
    const fn = loadManage(firebase, Stripe);
    const created = await fn.handler(post({
      teamId: 'team_1',
      enabled: true,
      monthlyPriceCents: 1999,
      stripePriceId: 'price_attacker',
    }));
    assert.equal(created.statusCode, 200);
    assert.equal(Stripe.calls.prices[0].unit_amount, 1999);
    const offer = firebase.getDocument('pulsecheck-athlete-app-offers/team_1');
    assert.equal(offer.stripeByMode.live.priceId, 'price_server_1999');
    assert.equal(offer.revenueRecipientUserId, 'coach_1');
    assert.equal(offer.platformSharePercent, 50);
    const team = firebase.getDocument('pulsecheck-teams/team_1');
    assert.equal(team.commercialConfig.athleteAppSubscriptionEnabled, true);
    assert.equal(team.commercialConfig.athleteAppSubscriptionMonthlyPriceCents, 1999);
    assert.equal('athleteAppSubscriptionPriceId' in team.commercialConfig, false);

    const paused = await fn.handler(post({
      teamId: 'team_1',
      enabled: false,
      monthlyPriceCents: 0,
    }));
    assert.equal(paused.statusCode, 200);
    assert.equal(JSON.parse(paused.body).offer.monthlyPriceCents, 1999);
    assert.deepEqual(Stripe.calls.priceUpdates.at(-1), {
      id: 'price_server_1999',
      params: { active: false },
    });
  });
});

test('coach can pause athlete subscription sales even when the Stripe key is unavailable', async () => {
  const collections = baseCollections();
  collections['pulsecheck-teams'][0].data.commercialConfig = {
    commercialModel: 'athlete-pay',
    teamPlanStatus: 'inactive',
    athleteAppSubscriptionEnabled: true,
    athleteAppSubscriptionMonthlyPriceCents: 1999,
    athleteAppSubscriptionOfferVersion: 2,
  };
  collections['pulsecheck-athlete-app-offers'].push({
    id: 'team_1',
    data: {
      offerId: 'team_1',
      organizationId: 'org_1',
      teamId: 'team_1',
      enabled: true,
      status: 'active',
      monthlyPriceCents: 1999,
      currency: 'usd',
      interval: 'month',
      version: 2,
      revenueRecipientUserId: 'coach_1',
      stripeByMode: {
        live: {
          productId: 'prod_team_1',
          priceId: 'price_server_1999',
          unitAmount: 1999,
          active: true,
        },
      },
    },
  });
  const firebase = createFirestoreAdminMock({ collections });
  const Stripe = stripeFactory();
  await withPatchedEnv({ ...env, STRIPE_SECRET_KEY: null }, async () => {
    const fn = loadManage(firebase, Stripe);
    const response = await fn.handler(post({
      teamId: 'team_1',
      enabled: false,
      monthlyPriceCents: 0,
    }));
    assert.equal(response.statusCode, 200);
    assert.equal(firebase.getDocument('pulsecheck-athlete-app-offers/team_1').status, 'inactive');
    assert.equal(
      firebase.getDocument('pulsecheck-teams/team_1').commercialConfig.athleteAppSubscriptionEnabled,
      false
    );
    assert.equal(Stripe.calls.keys.length, 0);
  });
});

test('athlete account cannot manage a team subscription offer', async () => {
  const firebase = createFirestoreAdminMock({ collections: baseCollections() });
  const Stripe = stripeFactory();
  await withPatchedEnv(env, async () => {
    const fn = loadManage(firebase, Stripe, 'mock-user');
    const response = await fn.handler(post({
      teamId: 'team_1',
      enabled: true,
      monthlyPriceCents: 1999,
    }));
    assert.equal(response.statusCode, 403);
    assert.equal(Stripe.calls.prices.length, 0);
  });
});

test('athlete checkout requires Firebase auth and ignores a caller supplied Stripe price', async () => {
  const collections = baseCollections();
  collections['pulsecheck-teams'][0].data.commercialConfig = {
    commercialModel: 'athlete-pay',
    teamPlanStatus: 'inactive',
    athleteAppSubscriptionEnabled: true,
    athleteAppSubscriptionOfferVersion: 3,
  };
  collections['pulsecheck-athlete-app-offers'].push({
    id: 'team_1',
    data: {
      offerId: 'team_1',
      organizationId: 'org_1',
      teamId: 'team_1',
      enabled: true,
      status: 'active',
      monthlyPriceCents: 2499,
      currency: 'usd',
      interval: 'month',
      version: 3,
      revenueRecipientUserId: 'coach_1',
      stripeByMode: {
        live: {
          productId: 'prod_server',
          priceId: 'price_server_2499',
          unitAmount: 2499,
          active: true,
        },
      },
    },
  });
  const firebase = createFirestoreAdminMock({ collections });
  const Stripe = stripeFactory();
  await withPatchedEnv(env, async () => {
    const fn = loadCheckout(firebase, Stripe, 'mock-user', {
      appName: 'pulsecheck-dev-admin',
    });
    const unauthenticated = await fn.handler(post({
      inviteToken: 'invite_1',
      teamId: 'team_1',
      source: 'pulsecheck-coach-athlete-offer',
    }, ''));
    assert.equal(unauthenticated.statusCode, 401);

    const checkoutRequest = post({
      inviteToken: 'invite_1',
      teamId: 'team_1',
      source: 'pulsecheck-coach-athlete-offer',
      priceId: 'price_attacker_1',
      plan: 'annual',
    });
    checkoutRequest.headers['x-pulsecheck-firebase-mode'] = 'prod';
    const response = await fn.handler(checkoutRequest);
    assert.equal(response.statusCode, 200);
    const session = Stripe.calls.sessions[0];
    assert.equal(session.line_items[0].price, 'price_server_2499');
    assert.equal(session.client_reference_id, 'mock-user');
    assert.equal(session.metadata.pulsecheckTeamId, 'team_1');
    assert.equal(session.metadata.pulsecheckOfferVersion, '3');
    assert.equal(session.metadata.pulsecheckFirebaseMode, 'dev');
    assert.equal(
      session.success_url,
      'https://fitwithpulse.ai/PulseCheck/athlete-subscription-complete?session_id={CHECKOUT_SESSION_ID}&invite=invite_1&devFirebase=1'
    );
    assert.equal(
      session.cancel_url,
      'https://fitwithpulse.ai/PulseCheck/athlete-offer/invite_1?checkout=cancelled&devFirebase=1'
    );
    const retryRequest = post({
      inviteToken: 'invite_1',
      teamId: 'team_1',
      source: 'pulsecheck-coach-athlete-offer',
    });
    retryRequest.headers['x-pulsecheck-firebase-mode'] = 'prod';
    const retry = await fn.handler(retryRequest);
    assert.equal(retry.statusCode, 200);
    assert.equal(JSON.parse(retry.body).reused, true);
    assert.equal(Stripe.calls.sessions.length, 1);
  });
});

test('single-use invite checkout is reserved to one athlete while general links remain reusable', async () => {
  const makeCollections = (redemptionMode) => {
    const collections = baseCollections();
    collections.users = [
      { id: 'athlete_1', data: { email: 'athlete_1@example.com' } },
      { id: 'athlete_2', data: { email: 'athlete_2@example.com' } },
    ];
    collections.subscriptions = [
      { id: 'athlete_1', data: { plans: [] } },
      { id: 'athlete_2', data: { plans: [] } },
    ];
    collections['pulsecheck-invite-links'][0].data.redemptionMode = redemptionMode;
    collections['pulsecheck-teams'][0].data.commercialConfig = {
      commercialModel: 'athlete-pay',
      teamPlanStatus: 'inactive',
      athleteAppSubscriptionEnabled: true,
      athleteAppSubscriptionOfferVersion: 3,
    };
    collections['pulsecheck-athlete-app-offers'].push({
      id: 'team_1',
      data: {
        offerId: 'team_1',
        organizationId: 'org_1',
        teamId: 'team_1',
        enabled: true,
        status: 'active',
        monthlyPriceCents: 2499,
        currency: 'usd',
        interval: 'month',
        version: 3,
        revenueRecipientUserId: 'coach_1',
        stripeByMode: {
          live: {
            productId: 'prod_server',
            priceId: 'price_server_2499',
            unitAmount: 2499,
            active: true,
          },
        },
      },
    });
    return collections;
  };
  const checkoutBody = {
    inviteToken: 'invite_1',
    teamId: 'team_1',
    source: 'pulsecheck-coach-athlete-offer',
  };

  await withPatchedEnv(env, async () => {
    const singleUseFirebase = createFirestoreAdminMock({
      collections: makeCollections('single-use'),
    });
    const SingleUseStripe = stripeFactory();
    const first = await loadCheckout(singleUseFirebase, SingleUseStripe, 'athlete_1')
      .handler(post(checkoutBody));
    assert.equal(first.statusCode, 200);
    const competing = await loadCheckout(singleUseFirebase, SingleUseStripe, 'athlete_2')
      .handler(post(checkoutBody));
    assert.equal(competing.statusCode, 409);
    assert.equal(JSON.parse(competing.body).checkoutPending, true);
    assert.equal(SingleUseStripe.calls.sessions.length, 1);

    const generalFirebase = createFirestoreAdminMock({
      collections: makeCollections('general'),
    });
    const GeneralStripe = stripeFactory();
    const generalFirst = await loadCheckout(generalFirebase, GeneralStripe, 'athlete_1')
      .handler(post(checkoutBody));
    const generalSecond = await loadCheckout(generalFirebase, GeneralStripe, 'athlete_2')
      .handler(post(checkoutBody));
    assert.equal(generalFirst.statusCode, 200);
    assert.equal(generalSecond.statusCode, 200);
    assert.equal(GeneralStripe.calls.sessions.length, 2);
  });
});

test('targeted athlete checkout requires the invited Firebase email to be verified', async () => {
  const collections = baseCollections();
  collections.users = [{ id: 'athlete_1', data: { email: 'athlete_1@example.com' } }];
  collections.subscriptions = [{ id: 'athlete_1', data: { plans: [] } }];
  collections['pulsecheck-invite-links'][0].data.targetEmail = 'athlete_1@example.com';
  collections['pulsecheck-teams'][0].data.commercialConfig = {
    commercialModel: 'athlete-pay',
    teamPlanStatus: 'inactive',
    athleteAppSubscriptionEnabled: true,
    athleteAppSubscriptionOfferVersion: 1,
  };
  collections['pulsecheck-athlete-app-offers'].push({
    id: 'team_1',
    data: {
      offerId: 'team_1',
      organizationId: 'org_1',
      teamId: 'team_1',
      enabled: true,
      status: 'active',
      monthlyPriceCents: 1999,
      currency: 'usd',
      interval: 'month',
      version: 1,
      revenueRecipientUserId: 'coach_1',
      stripeByMode: {
        live: {
          productId: 'prod_server',
          priceId: 'price_server_1999',
          unitAmount: 1999,
          active: true,
        },
      },
    },
  });
  const firebase = createFirestoreAdminMock({ collections });
  const Stripe = stripeFactory();
  await withPatchedEnv(env, async () => {
    const response = await loadCheckout(firebase, Stripe, 'athlete_1', {
      email: 'athlete_1@example.com',
      emailVerified: false,
    }).handler(post({
      inviteToken: 'invite_1',
      teamId: 'team_1',
      source: 'pulsecheck-coach-athlete-offer',
    }));
    assert.equal(response.statusCode, 403);
    assert.equal(Stripe.calls.sessions.length, 0);
  });
});

test('redeemed single-use checkout only self-heals for its original active subscriber', async () => {
  const nowSec = Math.floor(Date.now() / 1000);
  const firebase = createFirestoreAdminMock({
    collections: {
      users: [
        { id: 'athlete_1', data: { email: 'athlete_1@example.com' } },
        { id: 'athlete_2', data: { email: 'athlete_2@example.com' } },
      ],
      subscriptions: [
        {
          id: 'athlete_1',
          data: { plans: [{ type: 'pulsecheck-monthly', expiration: nowSec + 3600 }] },
        },
        { id: 'athlete_2', data: { plans: [] } },
      ],
      'pulsecheck-invite-links': [
        {
          id: 'invite_1',
          data: {
            inviteType: 'team-access',
            status: 'redeemed',
            redemptionMode: 'single-use',
            redeemedByUserId: 'athlete_1',
            organizationId: 'org_1',
            teamId: 'team_1',
            teamMembershipRole: 'athlete',
          },
        },
      ],
      'pulsecheck-organizations': [{ id: 'org_1', data: { status: 'active' } }],
      'pulsecheck-teams': [
        {
          id: 'team_1',
          data: {
            status: 'active',
            organizationId: 'org_1',
            commercialConfig: {
              commercialModel: 'athlete-pay',
              teamPlanStatus: 'inactive',
              athleteAppSubscriptionEnabled: true,
              athleteAppSubscriptionOfferVersion: 1,
            },
          },
        },
      ],
      'pulsecheck-athlete-app-offers': [
        {
          id: 'team_1',
          data: {
            offerId: 'team_1',
            organizationId: 'org_1',
            teamId: 'team_1',
            enabled: true,
            status: 'active',
            monthlyPriceCents: 1999,
            currency: 'usd',
            interval: 'month',
            version: 1,
            stripeByMode: {
              live: { productId: 'prod_1', priceId: 'price_1', active: true },
            },
          },
        },
      ],
      'pulsecheck-athlete-app-entitlements': [],
    },
  });
  delete require.cache[LIB_PATH];
  const lib = withModuleMocks({
    './pulsecheck-coach-services': coachServicesMock(firebase, 'athlete_1'),
  }, () => require(LIB_PATH));
  await assert.rejects(
    () => lib.loadCoachPricedInviteCheckout({
      database: firebase.db,
      userId: 'athlete_1',
      authenticatedEmail: 'athlete_1@example.com',
      authenticatedEmailVerified: true,
      inviteToken: 'invite_1',
      requestedTeamId: 'team_1',
      stripeMode: 'live',
    }),
    (error) => error.statusCode === 409 && error.alreadyActive === true
  );
  await firebase.db.collection('subscriptions').doc('athlete_1').set({ plans: [] }, { merge: true });
  await assert.rejects(
    () => lib.loadCoachPricedInviteCheckout({
      database: firebase.db,
      userId: 'athlete_1',
      authenticatedEmail: 'athlete_1@example.com',
      authenticatedEmailVerified: true,
      inviteToken: 'invite_1',
      requestedTeamId: 'team_1',
      stripeMode: 'live',
    }),
    (error) => error.statusCode === 409 && error.alreadyActive !== true
  );
  await assert.rejects(
    () => lib.loadCoachPricedInviteCheckout({
      database: firebase.db,
      userId: 'athlete_2',
      authenticatedEmail: 'athlete_2@example.com',
      authenticatedEmailVerified: true,
      inviteToken: 'invite_1',
      requestedTeamId: 'team_1',
      stripeMode: 'live',
    }),
    (error) => error.statusCode === 403
  );
});

test('coach-offer webhooks honor server-set Firebase mode while legacy events stay on production', async () => {
  const prodFirebase = createFirestoreAdminMock({
    collections: {
      users: [
        { id: 'prod_athlete', data: { subscriptionType: 'Unsubscribed' } },
        { id: 'legacy_athlete', data: { subscriptionType: 'Unsubscribed' } },
      ],
      subscriptions: [
        { id: 'prod_athlete', data: { plans: [] } },
        { id: 'legacy_athlete', data: { plans: [] } },
      ],
      'pulsecheck-athlete-app-entitlements': [],
    },
  });
  const devFirebase = createFirestoreAdminMock({
    collections: {
      users: [
        { id: 'dev_athlete', data: { subscriptionType: 'Unsubscribed' } },
        { id: 'legacy_athlete', data: { subscriptionType: 'Dev untouched' } },
      ],
      subscriptions: [
        { id: 'dev_athlete', data: { plans: [] } },
        { id: 'legacy_athlete', data: { plans: [] } },
      ],
      'pulsecheck-athlete-app-entitlements': [],
    },
  });
  const WebhookStripe = webhookStripeFactory();
  const webhook = loadStripeWebhook({
    prodFirebase,
    devFirebase,
    Stripe: WebhookStripe,
  });
  const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const offerSubscription = (firebaseMode, userId, teamId) => ({
    id: `sub_${firebaseMode}`,
    status: 'active',
    customer: `cus_${firebaseMode}`,
    current_period_end: periodEnd,
    metadata: {
      payment_type: 'pulsecheck_athlete_app_subscription',
      pulsecheckAthleteAppOffer: 'true',
      pulsecheckFirebaseMode: firebaseMode,
      userId,
      pulsecheckOrganizationId: `org_${firebaseMode}`,
      pulsecheckTeamId: teamId,
      pulsecheckInviteToken: `invite_${firebaseMode}`,
      pulsecheckOfferId: teamId,
    },
    items: { data: [{ price: { id: `price_${firebaseMode}` } }] },
  });
  const invokeEvent = (type, object, extraHeaders = {}) => webhook.handler({
    httpMethod: 'POST',
    headers: { 'stripe-signature': 'sig', ...extraHeaders },
    body: JSON.stringify({
      type,
      data: { object },
    }),
  });
  const invoke = (subscription, extraHeaders = {}) => invokeEvent(
    'customer.subscription.updated',
    subscription,
    extraHeaders
  );

  const devResponse = await invoke(
    offerSubscription('dev', 'dev_athlete', 'team_dev'),
    { 'x-pulsecheck-firebase-mode': 'prod' }
  );
  assert.equal(devResponse.statusCode, 200);
  assert.equal(
    devFirebase.getDocument(
      'pulsecheck-athlete-app-entitlements/team_dev_dev_athlete'
    ).firebaseMode,
    'dev'
  );
  assert.equal(
    prodFirebase.getDocument(
      'pulsecheck-athlete-app-entitlements/team_dev_dev_athlete'
    ),
    undefined
  );

  const prodResponse = await invoke(
    offerSubscription('prod', 'prod_athlete', 'team_prod'),
    { 'x-pulsecheck-firebase-mode': 'dev' }
  );
  assert.equal(prodResponse.statusCode, 200);
  assert.equal(
    prodFirebase.getDocument(
      'pulsecheck-athlete-app-entitlements/team_prod_prod_athlete'
    ).firebaseMode,
    'prod'
  );
  assert.equal(
    devFirebase.getDocument(
      'pulsecheck-athlete-app-entitlements/team_prod_prod_athlete'
    ),
    undefined
  );

  const devInvoiceSubscription = {
    ...offerSubscription('dev', 'dev_athlete', 'team_dev'),
    id: 'sub_dev_invoice',
    latest_invoice: 'in_dev_only',
  };
  WebhookStripe.subscriptionsById.set(devInvoiceSubscription.id, devInvoiceSubscription);
  const devInvoiceResponse = await invokeEvent('invoice.paid', {
    id: 'in_dev_only',
    subscription: devInvoiceSubscription.id,
    livemode: true,
    amount_paid: 2000,
    total_excluding_tax: 2000,
    currency: 'usd',
    created: Math.floor(Date.now() / 1000),
    charge: { balance_transaction: { id: 'txn_dev_only', fee: 88 } },
    lines: { data: [{ period: { end: periodEnd } }] },
  }, { 'x-pulsecheck-firebase-mode': 'prod' });
  assert.equal(devInvoiceResponse.statusCode, 200);
  assert.equal(
    devFirebase.getDocument(
      'pulsecheck-athlete-app-revenue-events/in_dev_only'
    ).firebaseMode,
    'dev'
  );
  assert.equal(
    prodFirebase.getDocument(
      'pulsecheck-athlete-app-revenue-events/in_dev_only'
    ),
    undefined
  );

  const legacyResponse = await invoke({
    id: 'sub_legacy',
    status: 'active',
    customer: 'cus_legacy',
    current_period_end: periodEnd,
    metadata: { userId: 'legacy_athlete' },
    items: {
      data: [{ price: { id: 'price_1TfN9QIkArZc741WdNmcTHPv' } }],
    },
  }, { 'x-pulsecheck-firebase-mode': 'dev' });
  assert.equal(legacyResponse.statusCode, 200);
  assert.equal(
    prodFirebase.getDocument('users/legacy_athlete').subscriptionType,
    'Monthly Subscriber'
  );
  assert.equal(
    devFirebase.getDocument('users/legacy_athlete').subscriptionType,
    'Dev untouched'
  );
});

test('webhook utility writes canonical mobile plan and exact fee waterfall, then revokes only paid access', async () => {
  const firebase = createFirestoreAdminMock({
    collections: {
      users: [{ id: 'athlete_1', data: { email: 'athlete@example.com', subscriptionType: 'Unsubscribed' } }],
      subscriptions: [{ id: 'athlete_1', data: { plans: [] } }],
      'pulsecheck-athlete-app-entitlements': [],
      'pulsecheck-athlete-app-revenue-events': [],
      'pulsecheck-team-memberships': [
        { id: 'team_1_athlete_1', data: { userId: 'athlete_1', teamId: 'team_1', role: 'athlete', status: 'active' } },
      ],
    },
  });
  const coachMock = coachServicesMock(firebase, 'athlete_1');
  delete require.cache[LIB_PATH];
  const lib = withModuleMocks({
    './pulsecheck-coach-services': coachMock,
  }, () => require(LIB_PATH));
  const nowSec = Math.floor(Date.now() / 1000);
  const subscription = {
    id: 'sub_offer_1',
    status: 'active',
    customer: 'cus_1',
    current_period_end: nowSec + 30 * 24 * 60 * 60,
    metadata: {
      payment_type: 'pulsecheck_athlete_app_subscription',
      pulsecheckAthleteAppOffer: 'true',
      userId: 'athlete_1',
      pulsecheckOrganizationId: 'org_1',
      pulsecheckTeamId: 'team_1',
      pulsecheckInviteToken: 'invite_1',
      pulsecheckOfferId: 'team_1',
      pulsecheckOfferVersion: '4',
      pulsecheckRevenueRecipientUserId: 'coach_1',
    },
    items: { data: [{ price: { id: 'price_dynamic_1' } }] },
  };

  await lib.reconcileAthleteAppSubscription({
    database: firebase.db,
    admin: firebase.admin,
    subscription,
    source: 'invoice.paid',
    forcedStatus: 'active',
  });
  const subscriptionRecord = firebase.getDocument('subscriptions/athlete_1');
  const plan = subscriptionRecord.plans.find((entry) => entry.source === 'pulsecheck-coach-athlete-offer');
  assert.equal(plan.type, 'pulsecheck-monthly');
  assert.equal(plan.status, 'active');
  assert.ok(plan.expiration > nowSec);

  assert.deepEqual(lib.revenueBreakdown({ grossCents: 2000, actualStripeFeeCents: 88 }), {
    grossRevenueCents: 2000,
    platformSharePercent: 50,
    platformShareCents: 1000,
    stripeProcessingFeeCents: 88,
    coachNetCents: 912,
    platformNetCents: 1000,
  });
  await lib.recordPaidAthleteAppInvoice({
    database: firebase.db,
    admin: firebase.admin,
    stripeClient: {},
    invoice: {
      id: 'in_1',
      amount_paid: 2000,
      total_excluding_tax: 2000,
      currency: 'usd',
      created: nowSec,
      charge: { balance_transaction: { id: 'txn_1', fee: 88 } },
    },
    subscription,
  });
  const ledger = firebase.getDocument('pulsecheck-athlete-app-revenue-events/in_1');
  assert.equal(ledger.platformShareCents, 1000);
  assert.equal(ledger.stripeProcessingFeeCents, 88);
  assert.equal(ledger.coachNetCents, 912);

  await lib.recordAthleteAppRefund({
    database: firebase.db,
    admin: firebase.admin,
    charge: { amount: 2000, amount_refunded: 2000, refunded: true },
    invoice: { id: 'in_1' },
    subscription,
  });
  const refundedLedger = firebase.getDocument('pulsecheck-athlete-app-revenue-events/in_1');
  assert.equal(refundedLedger.status, 'refunded');
  assert.equal(refundedLedger.coachNetCents, 0);

  await lib.reconcileAthleteAppSubscription({
    database: firebase.db,
    admin: firebase.admin,
    subscription,
    source: 'customer.subscription.deleted',
    forcedStatus: 'canceled',
  });
  const canceledPlan = firebase
    .getDocument('subscriptions/athlete_1')
    .plans.find((entry) => entry.source === 'pulsecheck-coach-athlete-offer');
  assert.equal(canceledPlan.status, 'inactive');
  assert.ok(canceledPlan.expiration <= Math.floor(Date.now() / 1000));
  assert.equal(firebase.getDocument('pulsecheck-team-memberships/team_1_athlete_1').status, 'active');
});

test('taxed refunds allocate pre-tax gross proportionally and disputes close idempotently', async () => {
  const firebase = createFirestoreAdminMock({
    collections: {
      'pulsecheck-athlete-app-revenue-events': [],
    },
  });
  delete require.cache[LIB_PATH];
  const lib = withModuleMocks({
    './pulsecheck-coach-services': coachServicesMock(firebase, 'athlete_1'),
  }, () => require(LIB_PATH));
  const nowSec = Math.floor(Date.now() / 1000);
  const subscription = {
    id: 'sub_taxed_1',
    status: 'active',
    latest_invoice: 'in_taxed_1',
    current_period_end: nowSec + 30 * 24 * 60 * 60,
    customer: 'cus_taxed_1',
    metadata: {
      payment_type: 'pulsecheck_athlete_app_subscription',
      pulsecheckAthleteAppOffer: 'true',
      userId: 'athlete_1',
      pulsecheckOrganizationId: 'org_1',
      pulsecheckTeamId: 'team_1',
      pulsecheckOfferId: 'team_1',
      pulsecheckRevenueRecipientUserId: 'coach_1',
    },
    items: { data: [{ price: { id: 'price_taxed_1' } }] },
  };
  const invoice = {
    id: 'in_taxed_1',
    amount_paid: 2200,
    total_excluding_tax: 2000,
    tax: 200,
    currency: 'usd',
    created: nowSec,
    charge: { balance_transaction: { id: 'txn_taxed_1', fee: 94 } },
  };
  await lib.recordPaidAthleteAppInvoice({
    database: firebase.db,
    admin: firebase.admin,
    stripeClient: {},
    invoice,
    subscription,
  });
  await lib.recordPaidAthleteAppInvoice({
    database: firebase.db,
    admin: firebase.admin,
    stripeClient: {},
    invoice: {
      ...invoice,
      id: 'in_nullable_tax_fields',
      amount_paid: 1500,
      total_excluding_tax: null,
      subtotal_excluding_tax: null,
      subtotal: null,
      charge: { balance_transaction: { id: 'txn_nullable_1', fee: 74 } },
    },
    subscription,
  });
  assert.equal(
    firebase.getDocument(
      'pulsecheck-athlete-app-revenue-events/in_nullable_tax_fields'
    ).grossRevenueCents,
    1500
  );
  const refundResult = await lib.recordAthleteAppRefund({
    database: firebase.db,
    admin: firebase.admin,
    charge: { amount: 2200, amount_refunded: 1100, refunded: false },
    invoice,
    subscription,
  });
  const partiallyRefunded = firebase.getDocument(
    'pulsecheck-athlete-app-revenue-events/in_taxed_1'
  );
  assert.equal(partiallyRefunded.refundedCents, 1100);
  assert.equal(partiallyRefunded.refundedGrossRevenueCents, 1000);
  assert.equal(partiallyRefunded.remainingGrossRevenueCents, 1000);
  assert.equal(partiallyRefunded.coachNetCents, 406);
  assert.equal(refundResult.fullyRefunded, false);
  await lib.recordAthleteAppRefund({
    database: firebase.db,
    admin: firebase.admin,
    charge: { amount: 2200, amount_refunded: 500, refunded: false },
    invoice,
    subscription,
  });
  const afterStaleRefundEvent = firebase.getDocument(
    'pulsecheck-athlete-app-revenue-events/in_taxed_1'
  );
  assert.equal(afterStaleRefundEvent.refundedCents, 1100);
  assert.equal(afterStaleRefundEvent.coachNetCents, 406);
  assert.equal(lib.athleteAppInvoiceCoversCurrentPeriod({
    invoice,
    subscription,
    ledger: refundResult.ledger,
  }), true);
  assert.equal(lib.athleteAppInvoiceCoversCurrentPeriod({
    invoice,
    subscription: { ...subscription, latest_invoice: 'in_newer_renewal' },
    ledger: refundResult.ledger,
  }), false);

  const opened = await lib.recordAthleteAppDisputeCreated({
    database: firebase.db,
    admin: firebase.admin,
    dispute: { id: 'dp_taxed_1', amount: 1100, status: 'needs_response' },
    invoice,
    subscription,
  });
  assert.equal(opened.ledger.coachNetCents, 0);
  assert.equal(opened.ledger.platformNetCents, 0);
  assert.equal(opened.ledger.preDisputeCoachNetCents, 406);
  await lib.recordAthleteAppDisputeCreated({
    database: firebase.db,
    admin: firebase.admin,
    dispute: { id: 'dp_taxed_1', amount: 1100, status: 'under_review' },
    invoice,
    subscription,
  });
  assert.equal(
    firebase.getDocument('pulsecheck-athlete-app-revenue-events/in_taxed_1').preDisputeCoachNetCents,
    406
  );

  await lib.recordAthleteAppDisputeClosed({
    database: firebase.db,
    admin: firebase.admin,
    dispute: { id: 'dp_taxed_1', status: 'won' },
    invoice,
    subscription,
  });
  const won = firebase.getDocument('pulsecheck-athlete-app-revenue-events/in_taxed_1');
  assert.equal(won.status, 'partially_refunded');
  assert.equal(won.disputeOutcome, 'won');
  assert.equal(won.coachNetCents, 406);
  assert.equal(won.platformNetCents, 500);
  const lateCreated = await lib.recordAthleteAppDisputeCreated({
    database: firebase.db,
    admin: firebase.admin,
    dispute: { id: 'dp_taxed_1', amount: 1100, status: 'needs_response' },
    invoice,
    subscription,
  });
  assert.equal(lateCreated.alreadyClosed, true);
  assert.equal(
    firebase.getDocument('pulsecheck-athlete-app-revenue-events/in_taxed_1').coachNetCents,
    406
  );

  await lib.recordAthleteAppDisputeCreated({
    database: firebase.db,
    admin: firebase.admin,
    dispute: { id: 'dp_taxed_2', amount: 1100, status: 'needs_response' },
    invoice,
    subscription,
  });
  await lib.recordAthleteAppDisputeClosed({
    database: firebase.db,
    admin: firebase.admin,
    dispute: { id: 'dp_taxed_2', status: 'lost' },
    invoice,
    subscription,
  });
  const lost = firebase.getDocument('pulsecheck-athlete-app-revenue-events/in_taxed_1');
  assert.equal(lost.status, 'dispute_lost');
  assert.equal(lost.coachNetCents, 0);
  assert.equal(lost.platformNetCents, 0);
});

test('financial reversal blocks survive active Stripe updates until a newer payment or won dispute', async () => {
  const firebase = createFirestoreAdminMock({
    collections: {
      users: [{ id: 'athlete_1', data: { subscriptionType: 'Unsubscribed' } }],
      subscriptions: [{ id: 'athlete_1', data: { plans: [] } }],
      'pulsecheck-athlete-app-entitlements': [],
    },
  });
  delete require.cache[LIB_PATH];
  const lib = withModuleMocks({
    './pulsecheck-coach-services': coachServicesMock(firebase, 'athlete_1'),
  }, () => require(LIB_PATH));
  const nowSec = Math.floor(Date.now() / 1000);
  const firstPeriodEnd = nowSec + 30 * 24 * 60 * 60;
  const subscription = {
    id: 'sub_block_1',
    status: 'active',
    latest_invoice: 'in_block_1',
    current_period_end: firstPeriodEnd,
    customer: 'cus_block_1',
    metadata: {
      payment_type: 'pulsecheck_athlete_app_subscription',
      pulsecheckAthleteAppOffer: 'true',
      userId: 'athlete_1',
      pulsecheckOrganizationId: 'org_1',
      pulsecheckTeamId: 'team_1',
      pulsecheckOfferId: 'team_1',
    },
    items: { data: [{ price: { id: 'price_block_1' } }] },
  };
  await lib.reconcileAthleteAppSubscription({
    database: firebase.db,
    admin: firebase.admin,
    subscription,
    source: 'invoice.paid',
  });
  await lib.reconcileAthleteAppSubscription({
    database: firebase.db,
    admin: firebase.admin,
    subscription,
    source: 'charge.refunded',
    forcedStatus: 'refunded',
    accessBlock: {
      reason: 'refunded',
      stripeInvoiceId: 'in_block_1',
      currentPeriodEndEpochSeconds: firstPeriodEnd,
    },
  });
  await lib.reconcileAthleteAppSubscription({
    database: firebase.db,
    admin: firebase.admin,
    subscription,
    source: 'customer.subscription.updated',
  });
  let entitlement = firebase.getDocument(
    'pulsecheck-athlete-app-entitlements/team_1_athlete_1'
  );
  assert.equal(entitlement.active, false);
  assert.equal(entitlement.financialAccessBlock.active, true);

  await lib.reconcileAthleteAppSubscription({
    database: firebase.db,
    admin: firebase.admin,
    subscription,
    source: 'invoice.paid',
    accessClear: {
      reason: 'newer_paid_invoice',
      stripeInvoiceId: 'in_block_1',
      currentPeriodEndEpochSeconds: firstPeriodEnd,
    },
  });
  entitlement = firebase.getDocument(
    'pulsecheck-athlete-app-entitlements/team_1_athlete_1'
  );
  assert.equal(entitlement.active, false);

  const renewalSubscription = {
    ...subscription,
    latest_invoice: 'in_block_2',
    current_period_end: firstPeriodEnd + 30 * 24 * 60 * 60,
  };
  await lib.reconcileAthleteAppSubscription({
    database: firebase.db,
    admin: firebase.admin,
    subscription: renewalSubscription,
    source: 'invoice.paid',
    accessClear: {
      reason: 'newer_paid_invoice',
      stripeInvoiceId: 'in_block_2',
      currentPeriodEndEpochSeconds: renewalSubscription.current_period_end,
    },
  });
  entitlement = firebase.getDocument(
    'pulsecheck-athlete-app-entitlements/team_1_athlete_1'
  );
  assert.equal(entitlement.active, true);
  assert.equal(entitlement.financialAccessBlock.active, false);

  await lib.reconcileAthleteAppSubscription({
    database: firebase.db,
    admin: firebase.admin,
    subscription: renewalSubscription,
    source: 'charge.dispute.created',
    forcedStatus: 'disputed',
    accessBlock: {
      reason: 'disputed',
      stripeInvoiceId: 'in_block_2',
      disputeId: 'dp_block_2',
      currentPeriodEndEpochSeconds: renewalSubscription.current_period_end,
    },
  });
  await lib.reconcileAthleteAppSubscription({
    database: firebase.db,
    admin: firebase.admin,
    subscription: renewalSubscription,
    source: 'charge.dispute.closed',
    accessClear: {
      reason: 'dispute_won',
      stripeInvoiceId: 'in_block_2',
      disputeId: 'dp_block_2',
      currentPeriodEndEpochSeconds: renewalSubscription.current_period_end,
      allowSameInvoice: true,
    },
  });
  entitlement = firebase.getDocument(
    'pulsecheck-athlete-app-entitlements/team_1_athlete_1'
  );
  assert.equal(entitlement.active, true);
  assert.equal(entitlement.financialAccessBlock.clearedBy, 'dispute_won');
});

test('verified success self-heals the Stripe entitlement and confirms only after athlete membership exists', async () => {
  const firebase = createFirestoreAdminMock({
    collections: {
      users: [{ id: 'athlete_1', data: { email: 'athlete@example.com', subscriptionType: 'Unsubscribed' } }],
      subscriptions: [{ id: 'athlete_1', data: { plans: [] } }],
      'pulsecheck-athlete-app-entitlements': [],
      'pulsecheck-team-memberships': [],
    },
  });
  const nowSec = Math.floor(Date.now() / 1000);
  const subscription = {
    id: 'sub_verify_1',
    status: 'active',
    customer: { id: 'cus_verify_1' },
    current_period_end: nowSec + 30 * 24 * 60 * 60,
    metadata: {
      payment_type: 'pulsecheck_athlete_app_subscription',
      pulsecheckAthleteAppOffer: 'true',
      userId: 'athlete_1',
      pulsecheckOrganizationId: 'org_1',
      pulsecheckTeamId: 'team_1',
      pulsecheckInviteToken: 'invite_1',
      pulsecheckOfferId: 'team_1',
      pulsecheckOfferVersion: '1',
      pulsecheckRevenueRecipientUserId: 'coach_1',
    },
    items: { data: [{ price: { id: 'price_verify_1' } }] },
  };
  function VerifyStripe() {
    return {
      checkout: {
        sessions: {
          async retrieve() {
            return {
              id: 'cs_verify_1',
              status: 'complete',
              payment_status: 'paid',
              client_reference_id: 'athlete_1',
              metadata: subscription.metadata,
              subscription,
              customer: subscription.customer,
              line_items: { data: [{ price: { id: 'price_verify_1' } }] },
            };
          },
        },
      },
    };
  }
  const originalFetch = global.fetch;
  global.fetch = async () => {
    await firebase.db.collection('pulsecheck-team-memberships').doc('team_1_athlete_1').set({
      userId: 'athlete_1',
      teamId: 'team_1',
      organizationId: 'org_1',
      role: 'athlete',
      status: 'active',
    });
    return {
      ok: true,
      async text() { return ''; },
    };
  };
  try {
    await withPatchedEnv(env, async () => {
      const fn = loadVerify(firebase, VerifyStripe);
      const response = await fn.handler(post({
        sessionId: 'cs_verify_1',
        userId: 'athlete_1',
        inviteToken: 'invite_1',
        source: 'pulsecheck-coach-athlete-offer',
      }));
      assert.equal(response.statusCode, 200);
      assert.equal(JSON.parse(response.body).teamAccessActive, true);
      const entitlement = firebase.getDocument('pulsecheck-athlete-app-entitlements/team_1_athlete_1');
      assert.equal(entitlement.active, true);
      const plan = firebase
        .getDocument('subscriptions/athlete_1')
        .plans.find((entry) => entry.source === 'pulsecheck-coach-athlete-offer');
      assert.equal(plan.type, 'pulsecheck-monthly');
      assert.equal(firebase.getDocument('pulsecheck-team-memberships/team_1_athlete_1').role, 'athlete');
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('payment verification refuses to reconcile a coach offer into the wrong Firebase environment', async () => {
  const firebase = createFirestoreAdminMock({
    collections: {
      users: [{ id: 'athlete_1', data: { email: 'athlete@example.com', subscriptionType: 'Unsubscribed' } }],
      subscriptions: [{ id: 'athlete_1', data: { plans: [] } }],
      'pulsecheck-athlete-app-entitlements': [],
      'pulsecheck-team-memberships': [],
    },
  });
  const subscription = {
    id: 'sub_verify_dev_1',
    status: 'active',
    customer: { id: 'cus_verify_dev_1' },
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    metadata: {
      payment_type: 'pulsecheck_athlete_app_subscription',
      pulsecheckAthleteAppOffer: 'true',
      pulsecheckFirebaseMode: 'dev',
      userId: 'athlete_1',
      pulsecheckOrganizationId: 'org_1',
      pulsecheckTeamId: 'team_1',
      pulsecheckInviteToken: 'invite_1',
      pulsecheckOfferId: 'team_1',
      pulsecheckOfferVersion: '1',
      pulsecheckRevenueRecipientUserId: 'coach_1',
    },
    items: { data: [{ price: { id: 'price_verify_dev_1' } }] },
  };
  function VerifyStripe() {
    return {
      checkout: {
        sessions: {
          async retrieve() {
            return {
              id: 'cs_verify_dev_1',
              status: 'complete',
              payment_status: 'paid',
              client_reference_id: 'athlete_1',
              metadata: subscription.metadata,
              subscription,
              customer: subscription.customer,
              line_items: { data: [{ price: { id: 'price_verify_dev_1' } }] },
            };
          },
        },
      },
    };
  }

  await withPatchedEnv(env, async () => {
    const fn = loadVerify(firebase, VerifyStripe, { appName: 'pulsecheck-prod-admin' });
    const response = await fn.handler(post({
      sessionId: 'cs_verify_dev_1',
      userId: 'athlete_1',
      inviteToken: 'invite_1',
      source: 'pulsecheck-coach-athlete-offer',
    }));
    assert.equal(response.statusCode, 403);
    assert.equal(
      firebase.getDocument('pulsecheck-athlete-app-entitlements/team_1_athlete_1'),
      undefined
    );
    assert.deepEqual(firebase.getDocument('subscriptions/athlete_1').plans, []);
  });
});

test('coach earnings and payout eligibility consume the exact offer ledger without referral double counting', async () => {
  const firebase = createFirestoreAdminMock({
    collections: {
      'pulsecheck-organizations': [
        { id: 'org_1', data: { status: 'active', displayName: 'Test Organization' } },
      ],
      'pulsecheck-teams': [
        {
          id: 'team_1',
          data: {
            organizationId: 'org_1',
            status: 'active',
            commercialConfig: {
              commercialModel: 'athlete-pay',
              teamPlanStatus: 'inactive',
              referralKickbackEnabled: false,
              referralRevenueSharePct: 0,
              athleteAppSubscriptionEnabled: true,
              athleteAppSubscriptionRevenueRecipientUserId: 'coach_1',
            },
          },
        },
      ],
      'pulsecheck-team-memberships': [
        {
          id: 'team_1_coach_1',
          data: {
            organizationId: 'org_1',
            teamId: 'team_1',
            userId: 'coach_1',
            role: 'coach',
            status: 'active',
          },
        },
      ],
      'pulsecheck-athlete-app-offers': [
        {
          id: 'team_1',
          data: {
            teamId: 'team_1',
            organizationId: 'org_1',
            revenueRecipientUserId: 'coach_1',
            enabled: true,
            status: 'active',
          },
        },
      ],
      'pulsecheck-athlete-app-revenue-events': [
        {
          id: 'in_paid',
          data: {
            type: 'athlete_app_subscription_invoice',
            status: 'paid',
            provider: 'stripe',
            source: 'pulsecheck-coach-athlete-offer',
            revenueRecipientUserId: 'coach_1',
            organizationId: 'org_1',
            teamId: 'team_1',
            userId: 'athlete_1',
            grossRevenueCents: 2000,
            amountPaidCents: 2000,
            platformShareCents: 1000,
            stripeProcessingFeeCents: 88,
            coachNetCents: 912,
            platformNetCents: 1000,
            currency: 'usd',
            paidAtEpochSeconds: Math.floor(Date.now() / 1000),
          },
        },
        {
          id: 'in_refunded',
          data: {
            type: 'athlete_app_subscription_invoice',
            status: 'refunded',
            provider: 'stripe',
            source: 'pulsecheck-coach-athlete-offer',
            revenueRecipientUserId: 'coach_1',
            organizationId: 'org_1',
            teamId: 'team_1',
            userId: 'athlete_2',
            grossRevenueCents: 2000,
            amountPaidCents: 2000,
            refundedCents: 2000,
            platformShareCentsAfterRefund: 0,
            stripeProcessingFeeCents: 88,
            coachNetCents: 0,
            platformNetCents: 0,
            currency: 'usd',
            paidAtEpochSeconds: Math.floor(Date.now() / 1000),
          },
        },
      ],
      'pulsecheck-coach-service-orders': [],
      'pulsecheck-assessment-purchases': [],
      'pulsecheck-coach-payout-states': [],
      'pulsecheck-coach-payout-requests': [],
    },
  });
  function NoopStripe() { return {}; }
  await withPatchedEnv(env, async () => {
    const earningsModule = loadEarnings(firebase, NoopStripe);
    const earnings = await earningsModule.loadCoachEarnings('coach_1', 'team_1', firebase.db);
    assert.equal(earnings.athleteAppSubscriptionEarnings.lifetimeNetCents, 912);
    assert.equal(earnings.lifetimeShareCents, 912);
    assert.equal(earnings.payoutEligibleCents, 912);
    assert.equal(earnings.members.length, 0);
  });
});

test('admin payout completion revalidates refunded offer earnings inside the transaction', async () => {
  const firebase = createFirestoreAdminMock({
    collections: {
      'pulsecheck-coach-payout-requests': [
        {
          id: 'request_1',
          data: {
            coachUserId: 'coach_1',
            teamId: 'team_1',
            organizationId: 'org_1',
            amountCents: 912,
            status: 'requested',
            paymentMethod: 'zelle',
            paymentDestination: 'coach@example.com',
          },
        },
      ],
      'pulsecheck-coach-payout-states': [
        {
          id: 'coach_1__team_1',
          data: {
            coachUserId: 'coach_1',
            teamId: 'team_1',
            organizationId: 'org_1',
            paidCents: 0,
            requestedCents: 912,
            activeRequestId: 'request_1',
          },
        },
      ],
      'pulsecheck-athlete-app-revenue-events': [
        {
          id: 'in_adjusted',
          data: {
            type: 'athlete_app_subscription_invoice',
            status: 'partially_refunded',
            provider: 'stripe',
            source: 'pulsecheck-coach-athlete-offer',
            revenueRecipientUserId: 'coach_1',
            organizationId: 'org_1',
            teamId: 'team_1',
            coachNetCents: 406,
          },
        },
      ],
    },
  });
  const payoutModule = loadAdminPayout(firebase, async () => ({
    payoutEligibleCents: 912,
    athleteAppSubscriptionEarnings: { lifetimeNetCents: 912 },
  }));
  const adjusted = await payoutModule.completePayout({
    body: { requestId: 'request_1', paymentReference: 'pending-review' },
    decoded: { uid: 'admin_1', email: 'admin@example.com' },
  });
  assert.equal(adjusted.statusCode, 409);
  assert.equal(JSON.parse(adjusted.body).amountCents, 406);
  assert.equal(
    firebase.getDocument('pulsecheck-coach-payout-requests/request_1').amountCents,
    406
  );
  assert.equal(
    firebase.getDocument('pulsecheck-coach-payout-states/coach_1__team_1').paidCents,
    0
  );

  const completed = await payoutModule.completePayout({
    body: { requestId: 'request_1', paymentReference: 'paid-406' },
    decoded: { uid: 'admin_1', email: 'admin@example.com' },
  });
  assert.equal(completed.statusCode, 200);
  assert.equal(
    firebase.getDocument('pulsecheck-coach-payout-states/coach_1__team_1').paidCents,
    406
  );
});
