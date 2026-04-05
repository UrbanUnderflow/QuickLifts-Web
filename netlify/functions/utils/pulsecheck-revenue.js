const TEAM_REVENUE_EVENTS_COLLECTION = 'pulsecheck-revenue-events';
const TEAM_REVENUE_SUMMARIES_COLLECTION = 'pulsecheck-team-revenue-summaries';
const USER_REVENUE_SUMMARIES_COLLECTION = 'pulsecheck-user-revenue-summaries';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';

const PRICE_CATALOG = {
  athlete: {
    monthlyPriceIds: new Set([
      'price_1PDq26RobSf56MUOucDIKLhd',
      'price_1RMIUNRobSf56MUOfeB4gIot',
      process.env.STRIPE_PRICE_ATHLETE_MONTHLY || '',
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ATHLETE_MONTHLY || '',
    ].filter(Boolean)),
    annualPriceIds: new Set([
      'price_1PDq3LRobSf56MUOng0UxhCC',
      'price_1RMISFRobSf56MUOpcSoohjP',
      process.env.STRIPE_PRICE_ATHLETE_ANNUAL || '',
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ATHLETE_ANNUAL || '',
    ].filter(Boolean)),
    monthlyAmountCents: 1299,
    annualAmountCents: 11900,
  },
  coach: {
    monthlyPriceIds: new Set([
      process.env.STRIPE_PRICE_COACH_MONTHLY || '',
      process.env.NEXT_PUBLIC_STRIPE_PRICE_COACH_MONTHLY || '',
    ].filter(Boolean)),
    annualPriceIds: new Set([
      process.env.STRIPE_PRICE_COACH_ANNUAL || '',
      process.env.NEXT_PUBLIC_STRIPE_PRICE_COACH_ANNUAL || '',
    ].filter(Boolean)),
    monthlyAmountCents: 2499,
    annualAmountCents: 24900,
  },
};

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeString(String(value || '')).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};
const normalizeRevenueSharePct = (value) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed * 100) / 100));
};

const getDefaultCommercialConfig = () => ({
  commercialModel: 'athlete-pay',
  teamPlanStatus: 'inactive',
  referralKickbackEnabled: false,
  referralRevenueSharePct: 0,
  revenueRecipientRole: 'team-admin',
  revenueRecipientUserId: '',
  billingOwnerUserId: '',
  billingCustomerId: '',
  teamPlanActivatedAt: null,
  teamPlanExpiresAt: null,
});

const normalizeCommercialConfig = (value) => {
  const candidate = value && typeof value === 'object' ? value : {};
  const defaults = getDefaultCommercialConfig();
  const commercialModel = normalizeString(candidate.commercialModel || defaults.commercialModel);
  const teamPlanStatus = normalizeString(candidate.teamPlanStatus || defaults.teamPlanStatus);
  const revenueRecipientRole = normalizeString(candidate.revenueRecipientRole || defaults.revenueRecipientRole);

  return {
    commercialModel: commercialModel === 'team-plan' ? 'team-plan' : 'athlete-pay',
    teamPlanStatus: teamPlanStatus === 'active' ? 'active' : 'inactive',
    referralKickbackEnabled: normalizeBoolean(candidate.referralKickbackEnabled ?? defaults.referralKickbackEnabled),
    referralRevenueSharePct: normalizeRevenueSharePct(
      candidate.referralRevenueSharePct ?? defaults.referralRevenueSharePct
    ),
    revenueRecipientRole:
      revenueRecipientRole === 'coach'
        ? 'coach'
        : revenueRecipientRole === 'organization-owner'
          ? 'organization-owner'
          : 'team-admin',
    revenueRecipientUserId: normalizeString(candidate.revenueRecipientUserId ?? defaults.revenueRecipientUserId),
    billingOwnerUserId: normalizeString(candidate.billingOwnerUserId ?? defaults.billingOwnerUserId),
    billingCustomerId: normalizeString(candidate.billingCustomerId ?? defaults.billingCustomerId),
    teamPlanActivatedAt: candidate.teamPlanActivatedAt || null,
    teamPlanExpiresAt: candidate.teamPlanExpiresAt || null,
  };
};

const deriveTeamPlanBypass = (commercialConfig) =>
  normalizeString(commercialConfig?.commercialModel) === 'team-plan' &&
  normalizeString(commercialConfig?.teamPlanStatus) === 'active';

const isSubscriptionActive = (status) => ['active', 'trialing'].includes(normalizeString(status).toLowerCase());

const buildTimestamp = (admin, epochSeconds) => {
  if (!epochSeconds || !Number.isFinite(Number(epochSeconds))) return null;
  return admin.firestore.Timestamp.fromMillis(Number(epochSeconds) * 1000);
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  return 0;
};

const readPulseCheckAttributionFromMetadata = (metadata = {}) => ({
  organizationId: normalizeString(metadata.pulsecheckOrganizationId),
  teamId: normalizeString(metadata.pulsecheckTeamId),
  inviteToken: normalizeString(metadata.pulsecheckInviteToken),
  commercialModel: normalizeString(metadata.pulsecheckCommercialModel),
  teamPlanStatus: normalizeString(metadata.pulsecheckTeamPlanStatus),
  teamPlanBypassesPaywall: normalizeBoolean(metadata.pulsecheckTeamPlanBypassesPaywall),
  referralKickbackEnabled: normalizeBoolean(metadata.pulsecheckReferralKickbackEnabled),
  referralRevenueSharePct: normalizeRevenueSharePct(metadata.pulsecheckReferralRevenueSharePct),
  revenueRecipientUserId: normalizeString(metadata.pulsecheckRevenueRecipientUserId),
  revenueRecipientRole: normalizeString(metadata.pulsecheckRevenueRecipientRole),
});

const priceSnapshotFromKnownPlan = ({ userType, planType }) => {
  const normalizedUserType = normalizeString(userType);
  const normalizedPlanType = normalizeString(planType).toLowerCase();
  const catalog = normalizedUserType === 'coach' ? PRICE_CATALOG.coach : PRICE_CATALOG.athlete;

  if (normalizedPlanType.includes('annual') || normalizedPlanType.includes('1y')) {
    return {
      billingInterval: 'year',
      monthlyRevenueCents: Math.round(catalog.annualAmountCents / 12),
      annualizedRevenueCents: catalog.annualAmountCents,
      planType:
        normalizedUserType === 'coach'
          ? 'coach-annual'
          : normalizedPlanType || 'pulsecheck-annual',
    };
  }

  if (normalizedPlanType.includes('month') || normalizedPlanType.includes('1m')) {
    return {
      billingInterval: 'month',
      monthlyRevenueCents: catalog.monthlyAmountCents,
      annualizedRevenueCents: catalog.monthlyAmountCents * 12,
      planType:
        normalizedUserType === 'coach'
          ? 'coach-monthly'
          : normalizedPlanType || 'pulsecheck-monthly',
    };
  }

  return null;
};

const getPriceSnapshot = ({ userType, priceId, planType, unitAmount, recurringInterval }) => {
  const normalizedPriceId = normalizeString(priceId);
  const normalizedUserType = normalizeString(userType) || 'athlete';
  const normalizedInterval = normalizeString(recurringInterval).toLowerCase();

  if (Number.isFinite(Number(unitAmount)) && (normalizedInterval === 'month' || normalizedInterval === 'year')) {
    const amount = Number(unitAmount);
    return {
      billingInterval: normalizedInterval,
      monthlyRevenueCents: normalizedInterval === 'year' ? Math.round(amount / 12) : amount,
      annualizedRevenueCents: normalizedInterval === 'year' ? amount : amount * 12,
      planType:
        planType ||
        (normalizedUserType === 'coach'
          ? normalizedInterval === 'year'
            ? 'coach-annual'
            : 'coach-monthly'
          : normalizedInterval === 'year'
            ? 'pulsecheck-annual'
            : 'pulsecheck-monthly'),
    };
  }

  const athleteCatalog = PRICE_CATALOG.athlete;
  const coachCatalog = PRICE_CATALOG.coach;

  if (athleteCatalog.monthlyPriceIds.has(normalizedPriceId)) {
    return {
      billingInterval: 'month',
      monthlyRevenueCents: athleteCatalog.monthlyAmountCents,
      annualizedRevenueCents: athleteCatalog.monthlyAmountCents * 12,
      planType: planType || 'pulsecheck-monthly',
    };
  }

  if (athleteCatalog.annualPriceIds.has(normalizedPriceId)) {
    return {
      billingInterval: 'year',
      monthlyRevenueCents: Math.round(athleteCatalog.annualAmountCents / 12),
      annualizedRevenueCents: athleteCatalog.annualAmountCents,
      planType: planType || 'pulsecheck-annual',
    };
  }

  if (coachCatalog.monthlyPriceIds.has(normalizedPriceId)) {
    return {
      billingInterval: 'month',
      monthlyRevenueCents: coachCatalog.monthlyAmountCents,
      annualizedRevenueCents: coachCatalog.monthlyAmountCents * 12,
      planType: planType || 'coach-monthly',
    };
  }

  if (coachCatalog.annualPriceIds.has(normalizedPriceId)) {
    return {
      billingInterval: 'year',
      monthlyRevenueCents: Math.round(coachCatalog.annualAmountCents / 12),
      annualizedRevenueCents: coachCatalog.annualAmountCents,
      planType: planType || 'coach-annual',
    };
  }

  return priceSnapshotFromKnownPlan({ userType: normalizedUserType, planType });
};

const membershipPriority = {
  'team-admin': 0,
  coach: 1,
  'performance-staff': 2,
  'support-staff': 3,
  clinician: 4,
  athlete: 5,
};

const choosePrimaryMembership = (docs) =>
  [...docs].sort((left, right) => {
    const leftPriority = membershipPriority[left?.role] ?? 99;
    const rightPriority = membershipPriority[right?.role] ?? 99;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return toMillis(right?.updatedAt) - toMillis(left?.updatedAt);
  })[0] || null;

const resolveFallbackRevenueRecipientUserId = ({ commercialConfig, memberships }) => {
  if (commercialConfig.revenueRecipientUserId) return commercialConfig.revenueRecipientUserId;
  if (commercialConfig.revenueRecipientRole !== 'team-admin') return '';
  const teamAdmin = memberships.find((membership) => membership.role === 'team-admin');
  return normalizeString(teamAdmin?.userId);
};

async function resolvePulseCheckCommercialContext({ db, userId, metadata = {} }) {
  const pulseMeta = readPulseCheckAttributionFromMetadata(metadata);
  let teamId = pulseMeta.teamId;
  let organizationId = pulseMeta.organizationId;
  let team = null;
  let organization = null;
  let memberships = [];

  if (!teamId && userId) {
    const membershipsSnap = await db
      .collection(TEAM_MEMBERSHIPS_COLLECTION)
      .where('userId', '==', normalizeString(userId))
      .get();
    memberships = membershipsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const primaryMembership = choosePrimaryMembership(memberships);
    teamId = teamId || normalizeString(primaryMembership?.teamId);
    organizationId = organizationId || normalizeString(primaryMembership?.organizationId);
  }

  if (teamId) {
    const teamSnap = await db.collection(TEAMS_COLLECTION).doc(teamId).get();
    if (teamSnap.exists) {
      team = { id: teamSnap.id, ...teamSnap.data() };
      organizationId = organizationId || normalizeString(team.organizationId);
    }

    if (memberships.length === 0) {
      const membershipsSnap = await db
        .collection(TEAM_MEMBERSHIPS_COLLECTION)
        .where('teamId', '==', teamId)
        .get();
      memberships = membershipsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }
  }

  if (organizationId) {
    const organizationSnap = await db.collection(ORGANIZATIONS_COLLECTION).doc(organizationId).get();
    if (organizationSnap.exists) {
      organization = { id: organizationSnap.id, ...organizationSnap.data() };
    }
  }

  const commercialConfig = normalizeCommercialConfig(
    team?.commercialConfig || {
      commercialModel: pulseMeta.commercialModel,
      teamPlanStatus: pulseMeta.teamPlanStatus,
      referralKickbackEnabled: pulseMeta.referralKickbackEnabled,
      referralRevenueSharePct: pulseMeta.referralRevenueSharePct,
      revenueRecipientUserId: pulseMeta.revenueRecipientUserId,
      revenueRecipientRole: pulseMeta.revenueRecipientRole,
    }
  );

  return {
    userId: normalizeString(userId),
    organizationId: normalizeString(organizationId),
    teamId: normalizeString(teamId),
    inviteToken: pulseMeta.inviteToken,
    team,
    organization,
    memberships,
    commercialConfig: {
      ...commercialConfig,
      revenueRecipientUserId:
        commercialConfig.revenueRecipientUserId ||
        pulseMeta.revenueRecipientUserId ||
        resolveFallbackRevenueRecipientUserId({ commercialConfig, memberships }),
    },
  };
}

async function upsertPulseCheckRevenueEvent({
  db,
  admin,
  subscription,
  sessionId = null,
  source,
  userId,
  metadata = {},
  context = null,
}) {
  const resolvedContext =
    context ||
    (await resolvePulseCheckCommercialContext({
      db,
      userId: normalizeString(userId) || normalizeString(subscription?.metadata?.userId),
      metadata,
    }));

  if (!resolvedContext.teamId) {
    return null;
  }

  const item = subscription?.items?.data?.[0] || {};
  const price = item.price || {};
  const priceSnapshot = getPriceSnapshot({
    userType: normalizeString(metadata.userType) || normalizeString(subscription?.metadata?.userType),
    priceId: normalizeString(price.id),
    planType: normalizeString(subscription?.metadata?.planType),
    unitAmount: typeof price.unit_amount === 'number' ? price.unit_amount : null,
    recurringInterval: normalizeString(price?.recurring?.interval),
  });

  const stripeSubscriptionId = normalizeString(subscription?.id);
  const stripeCustomerId =
    typeof subscription?.customer === 'string'
      ? normalizeString(subscription.customer)
      : normalizeString(subscription?.customer?.id);
  const subscriberUserId = normalizeString(userId) || normalizeString(metadata.userId);
  const commercialConfig = resolvedContext.commercialConfig;
  const eventId = `${stripeSubscriptionId}_${subscriberUserId || resolvedContext.teamId || source}`;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const active = isSubscriptionActive(subscription?.status);

  await db.collection(TEAM_REVENUE_EVENTS_COLLECTION).doc(eventId).set(
    {
      stripeSubscriptionId: stripeSubscriptionId || null,
      stripeCustomerId: stripeCustomerId || null,
      stripeSessionId: normalizeString(sessionId) || null,
      subscriberUserId: subscriberUserId || null,
      organizationId: resolvedContext.organizationId || null,
      teamId: resolvedContext.teamId || null,
      inviteToken: resolvedContext.inviteToken || null,
      commercialModel: commercialConfig.commercialModel,
      teamPlanStatus: commercialConfig.teamPlanStatus,
      teamPlanBypassesPaywall: deriveTeamPlanBypass(commercialConfig),
      referralKickbackEnabled: commercialConfig.referralKickbackEnabled,
      referralRevenueSharePct: commercialConfig.referralRevenueSharePct,
      revenueRecipientUserId: commercialConfig.revenueRecipientUserId || null,
      revenueRecipientRole: commercialConfig.revenueRecipientRole || null,
      billingOwnerUserId: commercialConfig.billingOwnerUserId || null,
      billingCustomerId: commercialConfig.billingCustomerId || stripeCustomerId || null,
      priceId: normalizeString(price.id) || null,
      billingInterval: priceSnapshot?.billingInterval || null,
      planType: priceSnapshot?.planType || null,
      monthlyRevenueCents: priceSnapshot?.monthlyRevenueCents || 0,
      annualizedRevenueCents: priceSnapshot?.annualizedRevenueCents || 0,
      subscriptionStatus: normalizeString(subscription?.status) || null,
      active,
      source,
      currentPeriodEnd: buildTimestamp(admin, subscription?.current_period_end),
      updatedAt: now,
      createdAt: now,
    },
    { merge: true }
  );

  return {
    eventId,
    organizationId: resolvedContext.organizationId,
    teamId: resolvedContext.teamId,
    revenueRecipientUserId: commercialConfig.revenueRecipientUserId || null,
    active,
  };
}

async function syncTeamCommercialConfigFromSubscription({
  db,
  admin,
  subscription,
  userId,
  context = null,
  forceTeamPlan = false,
}) {
  const resolvedContext =
    context ||
    (await resolvePulseCheckCommercialContext({
      db,
      userId: normalizeString(userId) || normalizeString(subscription?.metadata?.userId),
      metadata: subscription?.metadata || {},
    }));

  if (!resolvedContext.teamId || !resolvedContext.team) {
    return null;
  }

  const currentConfig = normalizeCommercialConfig(resolvedContext.team.commercialConfig);
  const nextConfig = {
    ...currentConfig,
    billingCustomerId:
      (typeof subscription?.customer === 'string'
        ? normalizeString(subscription.customer)
        : normalizeString(subscription?.customer?.id)) || currentConfig.billingCustomerId,
    billingOwnerUserId: currentConfig.billingOwnerUserId || normalizeString(userId),
  };

  if (forceTeamPlan) {
    nextConfig.commercialModel = 'team-plan';
  }

  if (isSubscriptionActive(subscription?.status)) {
    nextConfig.teamPlanStatus = 'active';
    if (!nextConfig.teamPlanActivatedAt) {
      nextConfig.teamPlanActivatedAt = admin.firestore.Timestamp.now();
    }
  } else if (normalizeString(subscription?.status)) {
    nextConfig.teamPlanStatus = 'inactive';
  }

  const periodEnd = buildTimestamp(admin, subscription?.current_period_end);
  if (periodEnd) {
    nextConfig.teamPlanExpiresAt = periodEnd;
  }

  await db.collection(TEAMS_COLLECTION).doc(resolvedContext.teamId).set(
    {
      commercialConfig: nextConfig,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    teamId: resolvedContext.teamId,
    organizationId: resolvedContext.organizationId,
    commercialConfig: nextConfig,
  };
}

async function recalculatePulseCheckRevenueSummaries({ db, admin, teamIds = [], userIds = [] }) {
  const targetTeamIds = [...new Set(teamIds.map(normalizeString).filter(Boolean))];
  const teamDocs = new Map();
  const organizationDocs = new Map();
  const teamMembershipsMap = new Map();
  const eventsByTeam = new Map();

  const loadTeam = async (teamId) => {
    if (!teamId || teamDocs.has(teamId)) return teamDocs.get(teamId);
    const teamSnap = await db.collection(TEAMS_COLLECTION).doc(teamId).get();
    if (!teamSnap.exists) return null;
    const teamData = { id: teamSnap.id, ...teamSnap.data() };
    teamDocs.set(teamId, teamData);
    return teamData;
  };

  const loadOrganization = async (organizationId) => {
    if (!organizationId || organizationDocs.has(organizationId)) return organizationDocs.get(organizationId);
    const organizationSnap = await db.collection(ORGANIZATIONS_COLLECTION).doc(organizationId).get();
    if (!organizationSnap.exists) return null;
    const organizationData = { id: organizationSnap.id, ...organizationSnap.data() };
    organizationDocs.set(organizationId, organizationData);
    return organizationData;
  };

  const loadMemberships = async (teamId) => {
    if (!teamId || teamMembershipsMap.has(teamId)) return teamMembershipsMap.get(teamId);
    const membershipsSnap = await db.collection(TEAM_MEMBERSHIPS_COLLECTION).where('teamId', '==', teamId).get();
    const memberships = membershipsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    teamMembershipsMap.set(teamId, memberships);
    return memberships;
  };

  if (targetTeamIds.length === 0) {
    const eventsSnap = await db.collection(TEAM_REVENUE_EVENTS_COLLECTION).get();
    eventsSnap.docs.forEach((doc) => {
      const data = doc.data() || {};
      const teamId = normalizeString(data.teamId);
      if (!teamId) return;
      targetTeamIds.push(teamId);
      const existing = eventsByTeam.get(teamId) || [];
      existing.push({ id: doc.id, ...data });
      eventsByTeam.set(teamId, existing);
    });
  } else {
    await Promise.all(
      targetTeamIds.map(async (teamId) => {
        const eventsSnap = await db.collection(TEAM_REVENUE_EVENTS_COLLECTION).where('teamId', '==', teamId).get();
        eventsByTeam.set(
          teamId,
          eventsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      })
    );
  }

  const uniqueTeamIds = [...new Set(targetTeamIds)];
  const teamSummaries = [];
  const recipientAggregation = new Map();
  const billingAggregation = new Map();

  for (const teamId of uniqueTeamIds) {
    const team = await loadTeam(teamId);
    if (!team) continue;

    const organizationId = normalizeString(team.organizationId);
    const organization = organizationId ? await loadOrganization(organizationId) : null;
    const memberships = await loadMemberships(teamId);
    const commercialConfig = normalizeCommercialConfig(team.commercialConfig);
    const resolvedRevenueRecipientUserId =
      commercialConfig.revenueRecipientUserId ||
      resolveFallbackRevenueRecipientUserId({ commercialConfig, memberships });

    const teamEvents = eventsByTeam.get(teamId) || [];
    const activeAthleteEvents = teamEvents.filter(
      (event) => event.active && normalizeString(event.source) === 'stripe-athlete-subscription'
    );
    const activeTeamPlanEvents = teamEvents.filter(
      (event) => event.active && normalizeString(event.source) === 'stripe-team-plan-subscription'
    );

    const activeAthleteSubscriberIds = new Set(
      activeAthleteEvents.map((event) => normalizeString(event.subscriberUserId)).filter(Boolean)
    );
    const athleteSubscriptionMrrCents = activeAthleteEvents.reduce(
      (sum, event) => sum + (Number(event.monthlyRevenueCents) || 0),
      0
    );
    const teamPlanBillingMrrCents = activeTeamPlanEvents.reduce(
      (sum, event) => sum + (Number(event.monthlyRevenueCents) || 0),
      0
    );

    const athleteRoster = memberships.filter((membership) => membership.role === 'athlete');
    const teamPlanBypassesPaywall = deriveTeamPlanBypass(commercialConfig);
    const coveredAthleteCount = teamPlanBypassesPaywall ? athleteRoster.length : 0;
    const payoutRatePct = commercialConfig.referralKickbackEnabled ? commercialConfig.referralRevenueSharePct : 0;
    const recipientPayoutMrrCents = Math.round(athleteSubscriptionMrrCents * (payoutRatePct / 100));
    const totalGrossMrrCents = athleteSubscriptionMrrCents + teamPlanBillingMrrCents;
    const platformNetMrrCents = totalGrossMrrCents - recipientPayoutMrrCents;
    const lastRevenueEventAt = teamEvents.reduce((latest, event) => {
      const value = Math.max(toMillis(event.updatedAt), toMillis(event.createdAt));
      return value > latest ? value : latest;
    }, 0);

    const teamSummary = {
      teamId,
      organizationId: organizationId || null,
      organizationName: normalizeString(organization?.displayName) || null,
      teamName: normalizeString(team.displayName) || teamId,
      teamType: normalizeString(team.teamType) || null,
      sportOrProgram: normalizeString(team.sportOrProgram) || null,
      commercialModel: commercialConfig.commercialModel,
      teamPlanStatus: commercialConfig.teamPlanStatus,
      teamPlanBypassesPaywall,
      referralKickbackEnabled: commercialConfig.referralKickbackEnabled,
      referralRevenueSharePct: commercialConfig.referralRevenueSharePct,
      revenueRecipientUserId: resolvedRevenueRecipientUserId || null,
      revenueRecipientRole: commercialConfig.revenueRecipientRole || null,
      billingOwnerUserId: commercialConfig.billingOwnerUserId || null,
      billingCustomerId: commercialConfig.billingCustomerId || null,
      athleteRosterCount: athleteRoster.length,
      activeAthleteSubscriberCount: activeAthleteSubscriberIds.size,
      coveredAthleteCount,
      activeAthleteSubscriptionCount: activeAthleteEvents.length,
      activeTeamPlanSubscriptionCount: activeTeamPlanEvents.length,
      athleteSubscriptionMrrCents,
      teamPlanBillingMrrCents,
      totalGrossMrrCents,
      recipientPayoutMrrCents,
      platformNetMrrCents,
      lastRevenueEventAt: lastRevenueEventAt ? admin.firestore.Timestamp.fromMillis(lastRevenueEventAt) : null,
      calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    teamSummaries.push(teamSummary);
    await db.collection(TEAM_REVENUE_SUMMARIES_COLLECTION).doc(teamId).set(teamSummary, { merge: true });

    if (resolvedRevenueRecipientUserId) {
      const recipientCurrent = recipientAggregation.get(resolvedRevenueRecipientUserId) || {
        userId: resolvedRevenueRecipientUserId,
        teamIds: new Set(),
        teamBreakdown: [],
        athleteRosterCount: 0,
        activeAthleteSubscriberCount: 0,
        coveredAthleteCount: 0,
        athleteSubscriptionMrrCents: 0,
        teamPlanBillingMrrCents: 0,
        totalGrossMrrCents: 0,
        estimatedPayoutMrrCents: 0,
        platformNetMrrCents: 0,
        lastRevenueEventAt: 0,
      };
      recipientCurrent.teamIds.add(teamId);
      recipientCurrent.teamBreakdown.push({
        teamId,
        organizationId: organizationId || null,
        organizationName: teamSummary.organizationName,
        teamName: teamSummary.teamName,
        commercialModel: teamSummary.commercialModel,
        teamPlanStatus: teamSummary.teamPlanStatus,
        teamPlanBypassesPaywall: teamSummary.teamPlanBypassesPaywall,
        athleteRosterCount: teamSummary.athleteRosterCount,
        activeAthleteSubscriberCount: teamSummary.activeAthleteSubscriberCount,
        coveredAthleteCount: teamSummary.coveredAthleteCount,
        athleteSubscriptionMrrCents: teamSummary.athleteSubscriptionMrrCents,
        teamPlanBillingMrrCents: teamSummary.teamPlanBillingMrrCents,
        totalGrossMrrCents: teamSummary.totalGrossMrrCents,
        estimatedPayoutMrrCents: teamSummary.recipientPayoutMrrCents,
      });
      recipientCurrent.athleteRosterCount += teamSummary.athleteRosterCount;
      recipientCurrent.activeAthleteSubscriberCount += teamSummary.activeAthleteSubscriberCount;
      recipientCurrent.coveredAthleteCount += teamSummary.coveredAthleteCount;
      recipientCurrent.athleteSubscriptionMrrCents += teamSummary.athleteSubscriptionMrrCents;
      recipientCurrent.teamPlanBillingMrrCents += teamSummary.teamPlanBillingMrrCents;
      recipientCurrent.totalGrossMrrCents += teamSummary.totalGrossMrrCents;
      recipientCurrent.estimatedPayoutMrrCents += teamSummary.recipientPayoutMrrCents;
      recipientCurrent.platformNetMrrCents += teamSummary.platformNetMrrCents;
      recipientCurrent.lastRevenueEventAt = Math.max(recipientCurrent.lastRevenueEventAt, lastRevenueEventAt);
      recipientAggregation.set(resolvedRevenueRecipientUserId, recipientCurrent);
    }

    const billingOwnerUserId = normalizeString(commercialConfig.billingOwnerUserId);
    if (billingOwnerUserId) {
      const billingCurrent = billingAggregation.get(billingOwnerUserId) || {
        userId: billingOwnerUserId,
        billedTeamIds: new Set(),
        activeTeamPlanCount: 0,
        teamPlanBillingMrrCents: 0,
      };
      billingCurrent.billedTeamIds.add(teamId);
      if (teamSummary.teamPlanStatus === 'active') {
        billingCurrent.activeTeamPlanCount += 1;
      }
      billingCurrent.teamPlanBillingMrrCents += teamSummary.teamPlanBillingMrrCents;
      billingAggregation.set(billingOwnerUserId, billingCurrent);
    }
  }

  const targetUserIds = [
    ...new Set([
      ...Array.from(recipientAggregation.keys()),
      ...Array.from(billingAggregation.keys()),
      ...userIds.map(normalizeString).filter(Boolean),
    ]),
  ];
  const userSummaries = [];

  for (const userId of targetUserIds) {
    const recipientSummary = recipientAggregation.get(userId);
    const billingSummary = billingAggregation.get(userId);
    const summary = {
      userId,
      attributedTeamIds: recipientSummary ? Array.from(recipientSummary.teamIds) : [],
      billedTeamIds: billingSummary ? Array.from(billingSummary.billedTeamIds) : [],
      activeTeamCount: recipientSummary ? recipientSummary.teamIds.size : 0,
      activeTeamPlanCount: billingSummary ? billingSummary.activeTeamPlanCount : 0,
      athleteRosterCount: recipientSummary ? recipientSummary.athleteRosterCount : 0,
      activeAthleteSubscriberCount: recipientSummary ? recipientSummary.activeAthleteSubscriberCount : 0,
      coveredAthleteCount: recipientSummary ? recipientSummary.coveredAthleteCount : 0,
      athleteSubscriptionMrrCents: recipientSummary ? recipientSummary.athleteSubscriptionMrrCents : 0,
      teamPlanBillingMrrCents:
        (recipientSummary ? recipientSummary.teamPlanBillingMrrCents : 0) +
        (billingSummary ? billingSummary.teamPlanBillingMrrCents : 0),
      totalGrossMrrCents: recipientSummary ? recipientSummary.totalGrossMrrCents : 0,
      estimatedPayoutMrrCents: recipientSummary ? recipientSummary.estimatedPayoutMrrCents : 0,
      platformNetMrrCents: recipientSummary ? recipientSummary.platformNetMrrCents : 0,
      teamBreakdown: recipientSummary ? recipientSummary.teamBreakdown : [],
      lastRevenueEventAt:
        recipientSummary && recipientSummary.lastRevenueEventAt
          ? admin.firestore.Timestamp.fromMillis(recipientSummary.lastRevenueEventAt)
          : null,
      calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    userSummaries.push(summary);
    await db.collection(USER_REVENUE_SUMMARIES_COLLECTION).doc(userId).set(summary, { merge: true });
  }

  return {
    teamSummaries,
    userSummaries,
  };
}

module.exports = {
  TEAM_REVENUE_EVENTS_COLLECTION,
  TEAM_REVENUE_SUMMARIES_COLLECTION,
  USER_REVENUE_SUMMARIES_COLLECTION,
  normalizeString,
  normalizeBoolean,
  normalizeRevenueSharePct,
  normalizeCommercialConfig,
  deriveTeamPlanBypass,
  readPulseCheckAttributionFromMetadata,
  getPriceSnapshot,
  resolvePulseCheckCommercialContext,
  upsertPulseCheckRevenueEvent,
  syncTeamCommercialConfigFromSubscription,
  recalculatePulseCheckRevenueSummaries,
};
