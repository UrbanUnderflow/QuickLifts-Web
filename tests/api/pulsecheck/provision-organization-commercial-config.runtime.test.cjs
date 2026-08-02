const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildProvisioningPayload,
} = require('../../../src/lib/server/pulsecheck/provisionOrganizationAndTeam');

const provisioningInput = (commercialConfig) => ({
  actorLabel: 'commercial-config-test',
  organization: {
    id: 'org-1',
    displayName: 'Test Organization',
  },
  team: {
    id: 'team-1',
    displayName: 'Test Team',
    teamType: 'club',
    sportOrProgram: 'Track',
    commercialConfig,
  },
});

test('server provisioning preserves athlete subscription and additional-services config', () => {
  const { teamPayload } = buildProvisioningPayload(provisioningInput({
    additionalServicesEnabled: true,
    athleteAppSubscriptionEnabled: true,
    athleteAppSubscriptionMonthlyPriceCents: 1999,
    athleteAppSubscriptionCurrency: 'cad',
    athleteAppSubscriptionOfferVersion: 4,
    athleteAppSubscriptionRevenueRecipientUserId: '  coach-1  ',
  }));

  assert.deepEqual(
    {
      additionalServicesEnabled: teamPayload.commercialConfig.additionalServicesEnabled,
      athleteAppSubscriptionEnabled: teamPayload.commercialConfig.athleteAppSubscriptionEnabled,
      athleteAppSubscriptionMonthlyPriceCents:
        teamPayload.commercialConfig.athleteAppSubscriptionMonthlyPriceCents,
      athleteAppSubscriptionCurrency:
        teamPayload.commercialConfig.athleteAppSubscriptionCurrency,
      athleteAppSubscriptionOfferVersion:
        teamPayload.commercialConfig.athleteAppSubscriptionOfferVersion,
      athleteAppSubscriptionRevenueRecipientUserId:
        teamPayload.commercialConfig.athleteAppSubscriptionRevenueRecipientUserId,
    },
    {
      additionalServicesEnabled: true,
      athleteAppSubscriptionEnabled: true,
      athleteAppSubscriptionMonthlyPriceCents: 1999,
      athleteAppSubscriptionCurrency: 'usd',
      athleteAppSubscriptionOfferVersion: 4,
      athleteAppSubscriptionRevenueRecipientUserId: 'coach-1',
    }
  );
});

test('server provisioning applies safe subscription defaults to malformed config', () => {
  const { teamPayload } = buildProvisioningPayload(provisioningInput({
    additionalServicesEnabled: 'true',
    athleteAppSubscriptionEnabled: 'true',
    athleteAppSubscriptionMonthlyPriceCents: -1200,
    athleteAppSubscriptionCurrency: 'eur',
    athleteAppSubscriptionOfferVersion: 'not-a-version',
    athleteAppSubscriptionRevenueRecipientUserId: 42,
  }));

  assert.equal(teamPayload.commercialConfig.additionalServicesEnabled, false);
  assert.equal(teamPayload.commercialConfig.athleteAppSubscriptionEnabled, false);
  assert.equal(teamPayload.commercialConfig.athleteAppSubscriptionMonthlyPriceCents, 0);
  assert.equal(teamPayload.commercialConfig.athleteAppSubscriptionCurrency, 'usd');
  assert.equal(teamPayload.commercialConfig.athleteAppSubscriptionOfferVersion, 0);
  assert.equal(teamPayload.commercialConfig.athleteAppSubscriptionRevenueRecipientUserId, '');
});
