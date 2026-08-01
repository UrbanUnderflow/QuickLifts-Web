import assert from 'node:assert/strict';
import test from 'node:test';
import { getDefaultPulseCheckTeamCommercialConfig } from '../../src/api/firebase/pulsecheckProvisioning/types';
import {
  formatPulseCheckMonthlyPrice,
  isPulseCheckCoachPricedAthleteOfferActive,
  resolvePulseCheckReferralVisibility,
} from '../../src/utils/pulsecheckCommercialization';
import { buildPulseCheckAthleteOfferWebUrl } from '../../src/utils/pulsecheckInviteLinks';

test('coach-priced athlete offers are disabled by default', () => {
  const config = getDefaultPulseCheckTeamCommercialConfig();

  assert.equal(config.athleteAppSubscriptionEnabled, false);
  assert.equal(config.athleteAppSubscriptionMonthlyPriceCents, 0);
  assert.equal(isPulseCheckCoachPricedAthleteOfferActive(config), false);
  assert.deepEqual(resolvePulseCheckReferralVisibility(config), {
    athlete: false,
    parent: false,
    coach: false,
    any: false,
  });
});

test('athlete invite visibility includes paid offers, sponsored teams, and athlete referrals', () => {
  const base = getDefaultPulseCheckTeamCommercialConfig();

  const paidOffer = {
    ...base,
    athleteAppSubscriptionEnabled: true,
    athleteAppSubscriptionMonthlyPriceCents: 2000,
  };
  assert.equal(isPulseCheckCoachPricedAthleteOfferActive(paidOffer), true);
  assert.deepEqual(resolvePulseCheckReferralVisibility(paidOffer), {
    athlete: true,
    parent: false,
    coach: false,
    any: true,
  });

  assert.equal(
    resolvePulseCheckReferralVisibility({
      ...base,
      commercialModel: 'team-plan',
      teamPlanStatus: 'active',
    }).athlete,
    true
  );
  assert.equal(
    resolvePulseCheckReferralVisibility({ ...base, referralKickbackEnabled: true }).athlete,
    true
  );
});

test('inactive parent and coach referrals stay hidden independently', () => {
  const config = {
    ...getDefaultPulseCheckTeamCommercialConfig(),
    parentAssessmentReferralKickbackEnabled: true,
  };

  assert.deepEqual(resolvePulseCheckReferralVisibility(config), {
    athlete: false,
    parent: true,
    coach: false,
    any: true,
  });
});

test('monthly price and the web-only purchase URL are stable', () => {
  assert.equal(formatPulseCheckMonthlyPrice(2000), '$20');
  assert.equal(formatPulseCheckMonthlyPrice(2099), '$20.99');
  assert.equal(
    buildPulseCheckAthleteOfferWebUrl('invite token', 'https://example.com/', true),
    'https://example.com/PulseCheck/athlete-offer/invite%20token?devFirebase=1'
  );
});
