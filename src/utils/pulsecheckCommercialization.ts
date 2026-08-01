import type { PulseCheckTeamCommercialConfig } from '../api/firebase/pulsecheckProvisioning/types';

export const MIN_PULSECHECK_ATHLETE_APP_PRICE_CENTS = 100;
export const MAX_PULSECHECK_ATHLETE_APP_PRICE_CENTS = 100_000;

export const normalizePulseCheckMonthlyPriceCents = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
};

export const isPulseCheckCoachPricedAthleteOfferActive = (
  commercialConfig?: Partial<PulseCheckTeamCommercialConfig> | null
): boolean => {
  const monthlyPriceCents = normalizePulseCheckMonthlyPriceCents(
    commercialConfig?.athleteAppSubscriptionMonthlyPriceCents
  );
  return (
    commercialConfig?.athleteAppSubscriptionEnabled === true &&
    monthlyPriceCents >= MIN_PULSECHECK_ATHLETE_APP_PRICE_CENTS &&
    monthlyPriceCents <= MAX_PULSECHECK_ATHLETE_APP_PRICE_CENTS
  );
};

export const isPulseCheckSponsoredTeamPlanActive = (
  commercialConfig?: Partial<PulseCheckTeamCommercialConfig> | null
): boolean =>
  commercialConfig?.commercialModel === 'team-plan' &&
  commercialConfig?.teamPlanStatus === 'active';

export const resolvePulseCheckReferralVisibility = (
  commercialConfig?: Partial<PulseCheckTeamCommercialConfig> | null
) => {
  const athlete = Boolean(
    commercialConfig?.referralKickbackEnabled ||
      isPulseCheckSponsoredTeamPlanActive(commercialConfig) ||
      isPulseCheckCoachPricedAthleteOfferActive(commercialConfig)
  );
  const parent = commercialConfig?.parentAssessmentReferralKickbackEnabled === true;
  const coach = commercialConfig?.coachReferralKickbackEnabled === true;

  return {
    athlete,
    parent,
    coach,
    any: athlete || parent || coach,
  };
};

export const formatPulseCheckMonthlyPrice = (
  priceCents: unknown,
  currency = 'usd'
): string => {
  const amount = normalizePulseCheckMonthlyPriceCents(priceCents) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
};
