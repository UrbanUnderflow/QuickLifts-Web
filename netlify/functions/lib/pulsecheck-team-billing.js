const clean = (value) => typeof value === 'string' ? value.trim() : '';
const active = (record) => record && (!record.status || record.status === 'active') && !record.revokedAt && !record.deletedAt && !record.archivedAt;
const fail = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const safeId = (value) => Boolean(clean(value)) && value.length <= 240 && !value.includes('/') && value !== '.' && value !== '..';

async function loadTeamBilling({ database, userId, teamId }) {
  if (teamId && !safeId(teamId)) throw fail('Choose a valid team.', 400);
  const [members, userSnap] = await Promise.all([
    database.collection('pulsecheck-team-memberships').where('userId', '==', userId).get(),
    database.collection('users').doc(userId).get(),
  ]);
  const user = userSnap.data() || {};
  const eligible = members.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(member => member.role === 'athlete' && active(member));
  const preferred = clean(teamId || user.pulseCheckTeamId);
  const member = eligible.find(item => item.teamId === preferred) || (!teamId ? eligible.sort((a,b) => a.id.localeCompare(b.id))[0] : null);
  if (!member) {
    if (teamId || user.pulseCheckTeamId || user.pulseCheckTeamCommercialAccess?.teamId) {
      throw fail('Your team access could not be confirmed. Please contact your coach.', 409);
    }
    return { isTeamAthlete: false };
  }
  const id = clean(member.teamId);
  if (!safeId(id)) throw fail('Your team details are unavailable.');
  const [teamSnap, offerSnap, entitlementSnap] = await Promise.all([
    database.collection('pulsecheck-teams').doc(id).get(),
    database.collection('pulsecheck-athlete-app-offers').doc(id).get(),
    database.collection('pulsecheck-athlete-app-entitlements').doc(`${id}_${userId}`).get(),
  ]);
  if (!teamSnap.exists) throw fail('Your team details are unavailable.');
  const team = teamSnap.data();
  const organizationId = clean(team.organizationId);
  if (!safeId(organizationId) || member.organizationId !== organizationId) throw fail('Your team membership could not be verified.', 403);
  const organizationSnap = await database.collection('pulsecheck-organizations').doc(organizationId).get();
  const organization = organizationSnap.data() || {};
  const offer = offerSnap.data() || {};
  const entitlement = entitlementSnap.data() || {};
  const config = team.commercialConfig || {};
  const branding = team.branding || {};
  const rawLogo = clean(branding.logoUrl || team.logoUrl || team.logoURL);
  const logoUrl = /^https:\/\//i.test(rawLogo) ? rawLogo : '';
  const rawColor = clean(branding.primaryColor || team.primaryColor);
  const price = Number(config.athleteAppSubscriptionMonthlyPriceCents);
  return {
    isTeamAthlete: true, user, member, rawTeam: team, offer, entitlement,
    team: { id, name: clean(team.displayName || team.name || team.teamName) || 'Your team', logoUrl, primaryColor: /^#[0-9a-f]{6}$/i.test(rawColor) ? rawColor : '#24483F' },
    price: config.commercialModel === 'athlete-pay' && Number.isSafeInteger(price) && price > 0
      ? { amountCents: price, currency: clean(config.athleteAppSubscriptionCurrency) || 'usd', interval: 'month' } : null,
    commercialModel: clean(config.commercialModel),
    status: team.status !== 'active' || !active(team) || organization.status !== 'active' || !active(organization) ? 'team_inactive' : clean(entitlement.status) || 'not_subscribed',
  };
}

async function loadMemberCheckout({ database, userId, requestedTeamId, stripeMode, stripe, authenticatedEmail, firebaseMode = 'prod' }) {
  const context = await loadTeamBilling({ database, userId, teamId: requestedTeamId });
  if (!context.isTeamAthlete) throw fail('Team membership is required.', 403);
  const { rawTeam: team, offer, entitlement, member } = context;
  const organizationId = clean(team.organizationId);
  if (!safeId(organizationId)) throw fail('Your team organization is unavailable.');
  const orgSnap = await database.collection('pulsecheck-organizations').doc(organizationId).get();
  const config = team.commercialConfig || {};
  const mode = offer.stripeByMode?.[stripeMode] || {};
  if (member.organizationId !== organizationId) throw fail('Your team membership could not be verified.', 403);
  if (team.status !== 'active' || !active(team) || !orgSnap.exists || orgSnap.data().status !== 'active' || !active(orgSnap.data())) throw fail('Your team is inactive. Please contact your coach.');
  let subscriptionId = clean(entitlement.stripeSubscriptionId);
  if (!subscriptionId) {
    const subSnap = await database.collection('subscriptions').doc(userId).get();
    const sub = subSnap.data() || {};
    if (sub.pulseCheckTeamId === context.team.id) subscriptionId = clean(sub.stripeSubscriptionId);
  }
  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] });
    if (sub.metadata?.userId !== userId || sub.metadata?.pulsecheckTeamId !== context.team.id
      || (clean(sub.metadata?.pulsecheckFirebaseMode) || 'prod') !== firebaseMode
      || (typeof sub.livemode === 'boolean' && sub.livemode !== (stripeMode === 'live'))) throw fail('Your subscription could not be verified.', 403);
    if (['active', 'trialing'].includes(sub.status)) throw Object.assign(fail('Your team subscription is active.'), { alreadyActive: true });
    if (!['canceled', 'incomplete_expired'].includes(sub.status)) {
      const invoice = typeof sub.latest_invoice === 'string' ? await stripe.invoices.retrieve(sub.latest_invoice) : sub.latest_invoice;
      if (invoice?.status === 'open' && /^https:\/\/invoice\.stripe\.com\//.test(invoice.hosted_invoice_url || '')) return { recoveryUrl: invoice.hosted_invoice_url };
      throw fail('Your payment is still being processed. Please try again shortly.');
    }
  }
  if (config.commercialModel !== 'athlete-pay' || config.athleteAppSubscriptionEnabled !== true) throw fail('Please contact your team to restore access.');
  if (!context.price || offer.enabled !== true || offer.status !== 'active' || offer.teamId !== context.team.id
    || offer.organizationId !== organizationId || mode.active !== true || !clean(mode.priceId)
    || offer.interval !== 'month' || Number(offer.monthlyPriceCents) !== context.price.amountCents || offer.currency !== context.price.currency
    || Number(offer.version) !== Number(config.athleteAppSubscriptionOfferVersion)) throw fail('Your team price is being updated. Please try again shortly.');
  return { ...context, userData: context.user, organizationId, organization: orgSnap.data(), teamId: context.team.id,
    email: clean(authenticatedEmail), inviteToken: '', invite: { redemptionMode: 'general' },
    priceId: mode.priceId, revenueRecipientUserId: clean(offer.revenueRecipientUserId), member };
}
module.exports = { loadTeamBilling, loadMemberCheckout };
