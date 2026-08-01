import React, { useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  Eye,
  EyeOff,
  Link2,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
  XCircle,
} from 'lucide-react';
import {
  MAX_PULSECHECK_ATHLETE_APP_PRICE_CENTS,
  MIN_PULSECHECK_ATHLETE_APP_PRICE_CENTS,
  formatPulseCheckMonthlyPrice,
  isPulseCheckCoachPricedAthleteOfferActive,
  isPulseCheckSponsoredTeamPlanActive,
  normalizePulseCheckMonthlyPriceCents,
  resolvePulseCheckReferralVisibility,
} from '../../utils/pulsecheckCommercialization';
import {
  buildPulseCheckAthleteOfferWebUrl,
  buildPulseCheckTeamInviteWebUrl,
} from '../../utils/pulsecheckInviteLinks';

type LabStep =
  | 'coach-setup'
  | 'referral-preview'
  | 'invite'
  | 'athlete-account'
  | 'checkout'
  | 'checkout-result'
  | 'complete'
  | 'app-handoff';

type CheckoutScenario =
  | 'successful payment'
  | 'cancelled payment'
  | 'pending activation'
  | 'declined payment';

type AccountMethod = 'email' | 'google' | 'apple';
type Preset = 'all-off' | 'coach-offer' | 'sponsored' | 'paused-after-link';
type FlowLabPreviewAccess = 'paid' | 'sponsored' | 'paused' | 'direct';
type FlowLabCommercialConfig = NonNullable<
  Parameters<typeof resolvePulseCheckReferralVisibility>[0]
>;

interface FlowLabProps {
  initialPreviewAccess: FlowLabPreviewAccess | null;
  initialPreviewPriceCents: number;
}

const INVITE_TOKEN = 'flow-lab-athlete-invite';
const PRODUCTION_EXAMPLE_TOKEN = 'real-invite-token';

const defaultConfig = (): FlowLabCommercialConfig => ({
  commercialModel: 'athlete-pay',
  teamPlanStatus: 'inactive',
  additionalServicesEnabled: false,
  referralKickbackEnabled: false,
  referralRevenueSharePct: 0,
  parentAssessmentReferralKickbackEnabled: false,
  parentAssessmentReferralRevenueSharePct: 0,
  coachReferralKickbackEnabled: false,
  coachReferralRevenueSharePct: 0,
  athleteAppSubscriptionEnabled: false,
  athleteAppSubscriptionMonthlyPriceCents: 1_999,
  athleteAppSubscriptionCurrency: 'usd',
  athleteAppSubscriptionOfferVersion: 1,
  athleteAppSubscriptionRevenueRecipientUserId: 'flow-lab-coach',
  youthTrack: 'junior',
});

const previewConfig = (
  access: FlowLabPreviewAccess | null,
  priceCents: number
): FlowLabCommercialConfig => {
  const base = {
    ...defaultConfig(),
    athleteAppSubscriptionMonthlyPriceCents: priceCents,
  };

  if (access === 'paid') {
    return { ...base, athleteAppSubscriptionEnabled: true };
  }

  if (access === 'sponsored') {
    return {
      ...base,
      commercialModel: 'team-plan',
      teamPlanStatus: 'active',
      athleteAppSubscriptionEnabled: true,
    };
  }

  if (access === 'direct') {
    return { ...base, referralKickbackEnabled: true };
  }

  return base;
};

const labSteps: Array<{ key: LabStep; label: string }> = [
  { key: 'coach-setup', label: 'Coach setup' },
  { key: 'referral-preview', label: 'Visibility' },
  { key: 'invite', label: 'Invite' },
  { key: 'athlete-account', label: 'Account' },
  { key: 'checkout', label: 'Stripe' },
  { key: 'complete', label: 'App handoff' },
];

const checkoutScenarios: Array<{
  value: CheckoutScenario;
  testId: string;
  detail: string;
}> = [
  {
    value: 'successful payment',
    testId: 'checkout-scenario-success',
    detail: 'Stripe succeeds and PulseCheck creates access.',
  },
  {
    value: 'cancelled payment',
    testId: 'checkout-scenario-cancelled',
    detail: 'The athlete leaves Stripe before paying.',
  },
  {
    value: 'pending activation',
    testId: 'checkout-scenario-pending-activation',
    detail: 'Payment arrives while the webhook is still catching up.',
  },
  {
    value: 'declined payment',
    testId: 'checkout-scenario-declined',
    detail: 'Stripe declines the card and keeps access locked.',
  },
];

const accountMethods: Array<{
  value: AccountMethod;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  testId: string;
}> = [
  { value: 'email', label: 'Email account', Icon: Mail, testId: 'account-email' },
  { value: 'google', label: 'Google account', Icon: Users, testId: 'account-google' },
  { value: 'apple', label: 'Apple account', Icon: Smartphone, testId: 'account-apple' },
];

const stepIndex = (step: LabStep) => {
  if (step === 'checkout-result') return 4;
  if (step === 'app-handoff') return 5;
  return Math.max(0, labSteps.findIndex((item) => item.key === step));
};

const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  detail: string;
  testId?: string;
}> = ({ checked, onChange, label, detail, testId }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    data-testid={testId}
    onClick={() => onChange(!checked)}
    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
      checked
        ? 'border-[#E0FE10]/40 bg-[#E0FE10]/[0.08]'
        : 'border-white/10 bg-black/20 hover:border-white/20'
    }`}
  >
    <span>
      <span className="block text-sm font-semibold text-white">{label}</span>
      <span className="mt-1 block text-xs leading-5 text-zinc-500">{detail}</span>
    </span>
    <span
      className={`relative ml-4 h-6 w-11 shrink-0 rounded-full transition ${
        checked ? 'bg-[#E0FE10]' : 'bg-zinc-700'
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-black transition ${
          checked ? 'left-6' : 'left-1'
        }`}
      />
    </span>
  </button>
);

const StatusRow: React.FC<{
  label: string;
  present: boolean;
  expected?: boolean;
}> = ({ label, present, expected = present }) => (
  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-2.5 last:border-0">
    <span className="text-xs text-zinc-400">{label}</span>
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
        present === expected
          ? 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300'
          : 'border-amber-300/20 bg-amber-300/[0.07] text-amber-200'
      }`}
    >
      {present === expected ? <Check className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {present ? 'Present' : 'Absent'}
    </span>
  </div>
);

const DecisionCard: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-4">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">
      Decision needed
    </p>
    <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
    <div className="mt-2 text-sm leading-6 text-amber-100/80">{children}</div>
  </div>
);

const SubscriptionFlowLab: React.FC<FlowLabProps> = ({
  initialPreviewAccess,
  initialPreviewPriceCents,
}) => {
  const previewStartsWithCheckout =
    initialPreviewAccess === 'paid' || initialPreviewAccess === 'paused';
  const [step, setStep] = useState<LabStep>(
    initialPreviewAccess ? 'athlete-account' : 'coach-setup'
  );
  const [config, setConfig] = useState<FlowLabCommercialConfig>(() =>
    previewConfig(initialPreviewAccess, initialPreviewPriceCents)
  );
  const [priceInput, setPriceInput] = useState(
    (initialPreviewPriceCents / 100).toFixed(2)
  );
  const [inviteIssued, setInviteIssued] = useState(Boolean(initialPreviewAccess));
  const [issuedInviteRequiresCheckout, setIssuedInviteRequiresCheckout] =
    useState(previewStartsWithCheckout);
  const [accountMethod, setAccountMethod] = useState<AccountMethod>('email');
  const [checkoutScenario, setCheckoutScenario] =
    useState<CheckoutScenario>('successful payment');
  const [checkoutRan, setCheckoutRan] = useState(false);
  const [activationConfirmed, setActivationConfirmed] = useState(false);
  const [appAccount, setAppAccount] = useState<'same' | 'different'>('same');
  const [reviewNotes, setReviewNotes] = useState('');
  const [flowLabOrigin, setFlowLabOrigin] = useState('');

  useEffect(() => {
    setFlowLabOrigin(window.location.origin);
  }, []);

  const priceCents = normalizePulseCheckMonthlyPriceCents(
    Number.parseFloat(priceInput || '0') * 100
  );
  const liveConfig = useMemo(
    () => ({
      ...config,
      athleteAppSubscriptionMonthlyPriceCents: priceCents,
    }),
    [config, priceCents]
  );
  const visibility = resolvePulseCheckReferralVisibility(liveConfig);
  const sponsored = isPulseCheckSponsoredTeamPlanActive(liveConfig);
  const offerActive = isPulseCheckCoachPricedAthleteOfferActive(liveConfig);
  const requiresCheckout = offerActive && !sponsored;
  const pausedAfterIssue =
    inviteIssued && issuedInviteRequiresCheckout && !requiresCheckout && !sponsored;

  const invitePreviewAccess: FlowLabPreviewAccess = pausedAfterIssue
    ? 'paused'
    : sponsored
      ? 'sponsored'
      : issuedInviteRequiresCheckout
        ? 'paid'
        : 'direct';
  const flowLabPreviewPath =
    `/PulseCheck/subscription-flow-lab?preview=athlete` +
    `&access=${invitePreviewAccess}&price=${priceCents}`;
  const flowLabPreviewUrl = flowLabOrigin
    ? `${flowLabOrigin}${flowLabPreviewPath}`
    : flowLabPreviewPath;
  const productionInviteUrlExample = issuedInviteRequiresCheckout
    ? buildPulseCheckAthleteOfferWebUrl(PRODUCTION_EXAMPLE_TOKEN)
    : buildPulseCheckTeamInviteWebUrl(PRODUCTION_EXAMPLE_TOKEN);

  const paymentSucceeded =
    checkoutRan && checkoutScenario === 'successful payment';
  const membershipPresent = sponsored
    ? stepIndex(step) >= stepIndex('complete')
    : pausedAfterIssue
      ? stepIndex(step) >= stepIndex('complete')
      : paymentSucceeded && stepIndex(step) >= stepIndex('complete');
  const entitlementPresent = paymentSucceeded && activationConfirmed;
  const revenuePresent = paymentSucceeded && activationConfirmed;
  const appAccessGranted =
    appAccount === 'same' && (sponsored || entitlementPresent);

  const platformShareCents = Math.round(priceCents * 0.5);
  const exampleStripeFeeCents = Math.max(0, Math.round(priceCents * 0.029) + 30);
  const exampleCoachNetCents = Math.max(
    0,
    priceCents - platformShareCents - exampleStripeFeeCents
  );

  const updateConfig = (patch: FlowLabCommercialConfig) => {
    setConfig((current) => ({ ...current, ...patch }));
  };

  const resetFlow = () => {
    setStep('coach-setup');
    setConfig(defaultConfig());
    setPriceInput('19.99');
    setInviteIssued(false);
    setIssuedInviteRequiresCheckout(false);
    setAccountMethod('email');
    setCheckoutScenario('successful payment');
    setCheckoutRan(false);
    setActivationConfirmed(false);
    setAppAccount('same');
  };

  const applyPreset = (preset: Preset) => {
    setCheckoutRan(false);
    setActivationConfirmed(false);
    setAppAccount('same');

    if (preset === 'all-off') {
      setConfig(defaultConfig());
      setInviteIssued(false);
      setIssuedInviteRequiresCheckout(false);
      setStep('coach-setup');
      return;
    }

    if (preset === 'coach-offer') {
      setConfig({
        ...defaultConfig(),
        athleteAppSubscriptionEnabled: true,
      });
      setInviteIssued(false);
      setIssuedInviteRequiresCheckout(false);
      setStep('coach-setup');
      return;
    }

    if (preset === 'sponsored') {
      setConfig({
        ...defaultConfig(),
        commercialModel: 'team-plan',
        teamPlanStatus: 'active',
        athleteAppSubscriptionEnabled: true,
      });
      setInviteIssued(false);
      setIssuedInviteRequiresCheckout(false);
      setStep('coach-setup');
      return;
    }

    setConfig({
      ...defaultConfig(),
      athleteAppSubscriptionEnabled: false,
    });
    setInviteIssued(true);
    setIssuedInviteRequiresCheckout(true);
    setStep('invite');
  };

  const generateInvite = () => {
    setInviteIssued(true);
    setIssuedInviteRequiresCheckout(requiresCheckout);
  };

  const continueFromAccount = () => {
    if (sponsored || pausedAfterIssue || !issuedInviteRequiresCheckout) {
      setStep('complete');
      return;
    }
    setStep('checkout');
  };

  const runCheckout = () => {
    setCheckoutRan(true);
    setActivationConfirmed(false);
    setStep('checkout-result');
  };

  const continueToComplete = () => {
    if (checkoutScenario !== 'successful payment') return;
    setActivationConfirmed(true);
    setStep('complete');
  };

  const renderCoachSetup = () => (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E0FE10]">
          Coach setup
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Choose how this team pays for PulseCheck
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Change the controls, then check which Referral Links items a coach would see.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['all-off', 'All off'],
          ['coach-offer', 'Coach offer live'],
          ['sponsored', 'Sponsored team'],
          ['paused-after-link', 'Offer paused after link issued'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => applyPreset(value as Preset)}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-violet-300/40 hover:text-white"
          >
            {label}
          </button>
        ))}
      </div>

      <Toggle
        checked={config.athleteAppSubscriptionEnabled === true}
        onChange={(checked) =>
          updateConfig({ athleteAppSubscriptionEnabled: checked })
        }
        label="Sell athlete app subscriptions"
        detail="A paid athlete link opens the account and Stripe flow."
        testId="coach-offer-toggle"
      />

      <label className="block rounded-2xl border border-white/10 bg-black/20 p-4">
        <span className="text-sm font-semibold text-white">Monthly athlete price</span>
        <span className="mt-1 block text-xs text-zinc-500">
          The live range is $1.00 to $1,000.00.
        </span>
        <div className="mt-3 flex items-center rounded-xl border border-white/10 bg-black/30 px-3">
          <span className="text-zinc-500">$</span>
          <input
            data-testid="coach-price-input"
            aria-label="Monthly athlete price"
            type="number"
            min="1"
            max="1000"
            step="0.01"
            value={priceInput}
            onChange={(event) => setPriceInput(event.target.value)}
            className="w-full bg-transparent px-2 py-3 text-sm text-white outline-none"
          />
          <span className="text-xs text-zinc-500">per month</span>
        </div>
      </label>

      <Toggle
        checked={sponsored}
        onChange={(checked) =>
          updateConfig({
            commercialModel: checked ? 'team-plan' : 'athlete-pay',
            teamPlanStatus: checked ? 'active' : 'inactive',
          })
        }
        label="Team sponsors every athlete"
        detail="Sponsored athletes skip Stripe and use the direct app invite."
      />
      <Toggle
        checked={config.parentAssessmentReferralKickbackEnabled === true}
        onChange={(checked) =>
          updateConfig({ parentAssessmentReferralKickbackEnabled: checked })
        }
        label="Parent assessment referral"
        detail="Show the parent readiness assessment card."
      />
      <Toggle
        checked={config.coachReferralKickbackEnabled === true}
        onChange={(checked) =>
          updateConfig({ coachReferralKickbackEnabled: checked })
        }
        label="Coach referral"
        detail="Show the coach referral card."
      />

      <button
        type="button"
        data-testid="continue-to-referrals"
        onClick={() => setStep('referral-preview')}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-3 text-sm font-bold text-black"
      >
        Preview Referral Links
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );

  const renderReferralPreview = () => (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E0FE10]">
          Coach view
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Referral Links visibility
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          This preview uses the same visibility helper as the live dashboard.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {visibility.any ? (
              <Eye className="h-5 w-5 text-emerald-300" />
            ) : (
              <EyeOff className="h-5 w-5 text-zinc-500" />
            )}
            <div>
              <p className="text-sm font-semibold text-white">Referral Links tab</p>
              <p className="text-xs text-zinc-500">
                {visibility.any ? 'Visible in the coach navigation' : 'Hidden from the coach navigation'}
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              visibility.any
                ? 'bg-emerald-400/10 text-emerald-300'
                : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            {visibility.any ? 'VISIBLE' : 'HIDDEN'}
          </span>
        </div>
      </div>

      {visibility.any ? (
        <div className="grid gap-3">
          {visibility.athlete ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-emerald-300" />
                <div>
                  <p className="font-semibold text-white">Athlete team invite</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {sponsored
                      ? 'The team covers app access. Athlete skips checkout.'
                      : offerActive
                        ? `${formatPulseCheckMonthlyPrice(priceCents)} per month through Stripe.`
                        : 'Athlete invite referral is active.'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {visibility.parent ? (
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-4">
              <p className="font-semibold text-white">Parent readiness assessment</p>
            </div>
          ) : null}
          {visibility.coach ? (
            <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.06] p-4">
              <p className="font-semibold text-white">Coach referral</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <EyeOff className="mx-auto h-7 w-7 text-zinc-600" />
          <p className="mt-3 text-sm font-semibold text-zinc-300">
            The coach sees no Referral Links tab or empty page.
          </p>
        </div>
      )}

      <button
        type="button"
        data-testid="continue-to-invite"
        onClick={() => setStep('invite')}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black"
      >
        Continue to athlete invite
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );

  const renderInvite = () => (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E0FE10]">
          Coach invite step
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Generate the athlete link
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          The lab creates a sample link in memory. It sends nothing and creates no records.
        </p>
      </div>

      {pausedAfterIssue ? (
        <DecisionCard title="What should happen when a coach pauses an offer after sharing its link?">
          <p>
            Current behavior lets the athlete join the team without a paid plan. The mobile app still shows the paywall. Choose whether this link should show an unavailable message, offer an in-app purchase, or grant sponsored access.
          </p>
        </DecisionCard>
      ) : null}

      {!inviteIssued ? (
        <button
          type="button"
          data-testid="generate-invite"
          onClick={generateInvite}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-3 text-sm font-bold text-black"
        >
          <Link2 className="h-4 w-4" />
          Generate invite
        </button>
      ) : (
        <div className="space-y-3 rounded-2xl border border-[#E0FE10]/25 bg-[#E0FE10]/[0.06] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#E0FE10]">
            <CheckCircle2 className="h-4 w-4" />
            Sample invite ready
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Working local preview link
            </p>
            <a
              data-testid="flow-lab-preview-url"
              href={flowLabPreviewPath}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block break-all rounded-xl bg-black/30 p-3 font-mono text-xs leading-5 text-[#E0FE10] underline decoration-[#E0FE10]/40 underline-offset-4"
            >
              {flowLabPreviewUrl}
            </a>
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              This opens a separate athlete preview inside the local Flow Lab. Keep the local development server running while you test it.
            </p>
          </div>
          <div
            data-testid="flow-lab-production-url-example"
            className="rounded-xl border border-white/[0.07] bg-black/20 p-3"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Production URL shape, example only
            </p>
            <p className="mt-2 break-all font-mono text-[10px] leading-5 text-zinc-600">
              {productionInviteUrlExample}
            </p>
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">
              A live invite replaces the example token with a server-generated invite.
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        data-testid="continue-to-athlete"
        disabled={!inviteIssued}
        onClick={() => setStep('athlete-account')}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        Open athlete preview here
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );

  const renderAthleteAccount = () => (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
          Athlete landing
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Join Riverside Track on PulseCheck
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          {sponsored
            ? 'Your team covers your app access. Use an account to save it.'
            : pausedAfterIssue
              ? 'This shared link points to an offer that the coach paused.'
              : issuedInviteRequiresCheckout
                ? `${formatPulseCheckMonthlyPrice(priceCents)} per month. Choose your account before Stripe.`
                : 'Choose the PulseCheck account that will join the team.'}
        </p>
      </div>

      {initialPreviewAccess ? (
        <div className="rounded-2xl border border-violet-300/20 bg-violet-300/[0.06] p-4 text-xs leading-5 text-zinc-400">
          <p className="font-semibold text-violet-200">Flow Lab athlete preview</p>
          <p className="mt-1">
            Saved test price:{' '}
            <span
              data-testid="flow-lab-preview-price"
              className="font-semibold text-white"
            >
              {formatPulseCheckMonthlyPrice(priceCents)}
            </span>
            {sponsored ? '. The sponsored path still skips checkout.' : '.'}
          </p>
        </div>
      ) : null}

      {pausedAfterIssue ? (
        <DecisionCard title="The current flow reaches a paywall after team join">
          <p>
            The account can join the roster, while app access remains locked because there is no active paid plan or sponsored plan.
          </p>
        </DecisionCard>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {accountMethods.map(({ value, label, Icon, testId }) => (
          <button
            key={value}
            type="button"
            data-testid={testId}
            onClick={() => setAccountMethod(value)}
            className={`rounded-2xl border p-4 text-left transition ${
              accountMethod === value
                ? 'border-violet-300/50 bg-violet-300/[0.08]'
                : 'border-white/10 bg-black/20'
            }`}
          >
            <Icon className="h-5 w-5 text-violet-300" />
            <p className="mt-3 text-sm font-semibold text-white">{label}</p>
            <p className="mt-1 text-xs text-zinc-500">Simulated sign in</p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-400">
        <LockKeyhole className="mr-2 inline h-4 w-4 text-emerald-300" />
        The subscription follows this account across phones and reinstalls.
      </div>

      <button
        type="button"
        data-testid="continue-to-checkout"
        onClick={continueFromAccount}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-3 text-sm font-bold text-black"
      >
        {sponsored || pausedAfterIssue || !issuedInviteRequiresCheckout
          ? 'Accept invite and continue'
          : 'Continue to secure checkout'}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );

  const renderCheckout = () => (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
          Simulated Stripe checkout
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Choose the result you want to review
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Every result stays inside this page. No card or Stripe account is used.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {checkoutScenarios.map((scenario) => (
          <button
            key={scenario.value}
            type="button"
            data-testid={scenario.testId}
            onClick={() => setCheckoutScenario(scenario.value)}
            className={`rounded-2xl border p-4 text-left transition ${
              checkoutScenario === scenario.value
                ? 'border-violet-300/50 bg-violet-300/[0.08]'
                : 'border-white/10 bg-black/20'
            }`}
          >
            <p className="text-sm font-semibold capitalize text-white">
              {scenario.value}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{scenario.detail}</p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Monthly total</span>
          <span className="font-semibold text-white">
            {formatPulseCheckMonthlyPrice(priceCents)}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          Server-owned price. The browser cannot replace it.
        </div>
      </div>

      <button
        type="button"
        data-testid="run-checkout"
        onClick={runCheckout}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black"
      >
        <CreditCard className="h-4 w-4" />
        Run simulated checkout
      </button>
    </div>
  );

  const renderCheckoutResult = () => {
    if (checkoutScenario === 'successful payment') {
      return (
        <div className="space-y-5">
          <CheckCircle2 className="h-10 w-10 text-emerald-300" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
              Payment received
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              PulseCheck is confirming access
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              The real page waits for both the Stripe entitlement and team membership before it shows app instructions.
            </p>
          </div>
          <button
            type="button"
            data-testid="continue-to-complete"
            onClick={continueToComplete}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-3 text-sm font-bold text-black"
          >
            Confirm activation
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      );
    }

    if (checkoutScenario === 'cancelled payment') {
      return (
        <div className="space-y-5">
          <XCircle className="h-10 w-10 text-amber-300" />
          <DecisionCard title="Should the athlete see a checkout cancellation message?">
            <p>
              Current behavior returns the signed-in athlete to the offer page without a cancellation banner. They can try checkout again, while the page gives no clear explanation of what happened.
            </p>
          </DecisionCard>
          <button
            type="button"
            onClick={() => setStep('checkout')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white"
          >
            Try checkout again
          </button>
        </div>
      );
    }

    if (checkoutScenario === 'pending activation') {
      return (
        <div className="space-y-5">
          <RefreshCw className="h-10 w-10 animate-spin text-violet-300" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
              Pending activation
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Payment received. Team access is still being activated.
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              App instructions stay hidden until the server confirms access. The athlete can retry confirmation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCheckoutScenario('successful payment');
              setCheckoutRan(true);
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-300/30 bg-violet-300/[0.08] px-4 py-3 text-sm font-bold text-violet-100"
          >
            Simulate webhook arrival
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <XCircle className="h-10 w-10 text-red-300" />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-300">
            Declined payment
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Stripe could not approve this card
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            The athlete can use another card or leave checkout. No entitlement, membership, or earnings appear.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStep('checkout')}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white"
        >
          Choose another result
        </button>
      </div>
    );
  };

  const renderComplete = () => (
    <div className="space-y-5">
      <CheckCircle2
        className={`h-10 w-10 ${
          sponsored || entitlementPresent ? 'text-emerald-300' : 'text-amber-300'
        }`}
      />
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
          {sponsored || entitlementPresent ? 'Access ready' : 'Team joined'}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          {sponsored || entitlementPresent
            ? 'Download PulseCheck and open your invite'
            : 'The app still needs an active access plan'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          {sponsored || entitlementPresent
            ? 'The same account can sign in on any phone and continue onboarding.'
            : 'This is the current paused-offer dead end. The roster membership exists while app access stays locked.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-300">Step 1</p>
          <p className="mt-2 font-semibold text-white">Download the app</p>
          <div className="mt-3 flex gap-2 text-xs text-zinc-400">
            <span className="rounded-lg border border-white/10 px-2 py-1">iPhone</span>
            <span className="rounded-lg border border-white/10 px-2 py-1">Android</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-300">Step 2</p>
          <p className="mt-2 font-semibold text-white">Open the saved invite</p>
          <p className="mt-3 break-all font-mono text-[10px] text-zinc-500">
            pulsecheck://open?inviteToken={INVITE_TOKEN}
          </p>
        </div>
      </div>

      <button
        type="button"
        data-testid="simulate-open-app"
        onClick={() => setStep('app-handoff')}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-3 text-sm font-bold text-black"
      >
        <Smartphone className="h-4 w-4" />
        Simulate opening the app
      </button>
    </div>
  );

  const renderAppHandoff = () => (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
          Mobile app handoff
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Which account signs into the app?
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          The invite token opens the team flow. Server-owned access decides whether the paywall appears.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setAppAccount('same')}
          className={`rounded-2xl border p-4 text-left ${
            appAccount === 'same'
              ? 'border-emerald-300/40 bg-emerald-300/[0.07]'
              : 'border-white/10 bg-black/20'
          }`}
        >
          <p className="font-semibold text-white">Same checkout account</p>
          <p className="mt-1 text-xs text-zinc-500">athlete@example.com</p>
        </button>
        <button
          type="button"
          onClick={() => setAppAccount('different')}
          className={`rounded-2xl border p-4 text-left ${
            appAccount === 'different'
              ? 'border-amber-300/40 bg-amber-300/[0.07]'
              : 'border-white/10 bg-black/20'
          }`}
        >
          <p className="font-semibold text-white">Different account</p>
          <p className="mt-1 text-xs text-zinc-500">another@example.com</p>
        </button>
      </div>

      <div
        className={`rounded-2xl border p-5 ${
          appAccessGranted
            ? 'border-emerald-300/30 bg-emerald-300/[0.07]'
            : 'border-amber-300/30 bg-amber-300/[0.07]'
        }`}
      >
        {appAccessGranted ? (
          <>
            <CheckCircle2 className="h-6 w-6 text-emerald-300" />
            <p className="mt-3 font-semibold text-white">Paywall bypassed</p>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              The app continues into team onboarding with the active plan.
            </p>
          </>
        ) : (
          <>
            <LockKeyhole className="h-6 w-6 text-amber-300" />
            <p className="mt-3 font-semibold text-white">Paywall remains</p>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              This account has no matching sponsored or paid access.
            </p>
          </>
        )}
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 'coach-setup':
        return renderCoachSetup();
      case 'referral-preview':
        return renderReferralPreview();
      case 'invite':
        return renderInvite();
      case 'athlete-account':
        return renderAthleteAccount();
      case 'checkout':
        return renderCheckout();
      case 'checkout-result':
        return renderCheckoutResult();
      case 'complete':
        return renderComplete();
      case 'app-handoff':
        return renderAppHandoff();
      default:
        return null;
    }
  };

  return (
    <>
      <Head>
        <title>Subscription Flow Lab | PulseCheck</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="min-h-screen bg-[#07070D] px-4 py-6 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <div>
                <p className="text-sm font-semibold text-emerald-100">Safe simulation</p>
                <p className="mt-1 text-xs leading-5 text-emerald-100/65">
                  This Flow Lab creates no accounts, charges, emails, or Firebase records.
                </p>
              </div>
            </div>
            <button
              type="button"
              data-testid="flow-lab-reset"
              onClick={resetFlow}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/25 px-3 py-2 text-xs font-bold text-emerald-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset flow
            </button>
          </div>

          <header className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">
              PulseCheck product review
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
              Athlete subscription Flow Lab
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
              Walk through the coach setup, athlete purchase, and mobile handoff. Use the choices to decide what the final experience should feel like.
            </p>
          </header>

          <div className="mb-6 overflow-x-auto pb-2">
            <div className="flex min-w-max gap-2">
              {labSteps.map((item, index) => {
                const active = index === stepIndex(step);
                const complete = index < stepIndex(step);
                return (
                  <div
                    key={item.key}
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
                      active
                        ? 'border-violet-300/40 bg-violet-300/[0.08] text-white'
                        : complete
                          ? 'border-emerald-300/20 text-emerald-300'
                          : 'border-white/10 text-zinc-600'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        complete ? 'bg-emerald-300 text-black' : 'bg-white/10'
                      }`}
                    >
                      {complete ? <Check className="h-3 w-3" /> : index + 1}
                    </span>
                    {item.label}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-[28px] border border-white/10 bg-[#101018] p-5 shadow-2xl sm:p-7">
              {renderCurrentStep()}
            </section>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#101018] p-4">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-violet-300" />
                  <h2 className="text-sm font-semibold text-white">Flow records</h2>
                </div>
                <div className="mt-3">
                  <StatusRow label="Invite" present={inviteIssued} />
                  <StatusRow
                    label="Checkout record"
                    present={checkoutRan}
                    expected={checkoutRan}
                  />
                  <StatusRow
                    label="Active entitlement"
                    present={entitlementPresent}
                    expected={paymentSucceeded && activationConfirmed}
                  />
                  <StatusRow
                    label="Team membership"
                    present={membershipPresent}
                    expected={membershipPresent}
                  />
                  <StatusRow
                    label="Revenue event"
                    present={revenuePresent}
                    expected={paymentSucceeded && activationConfirmed}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#101018] p-4">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="h-5 w-5 text-[#E0FE10]" />
                  <h2 className="text-sm font-semibold text-white">Example split</h2>
                </div>
                {sponsored ? (
                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    Sponsored access creates no athlete Stripe charge or revenue event.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>Gross</span>
                      <span>{formatPulseCheckMonthlyPrice(priceCents)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>PulseCheck 50%</span>
                      <span>{formatPulseCheckMonthlyPrice(platformShareCents)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Example Stripe fee</span>
                      <span>{formatPulseCheckMonthlyPrice(exampleStripeFeeCents)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-2 font-semibold text-white">
                      <span>Example coach net</span>
                      <span>{formatPulseCheckMonthlyPrice(exampleCoachNetCents)}</span>
                    </div>
                    <p className="pt-1 text-[10px] leading-4 text-zinc-600">
                      Live payouts use Stripe&apos;s actual processing fee.
                    </p>
                  </div>
                )}
              </div>

              <label className="block rounded-2xl border border-white/10 bg-[#101018] p-4">
                <span className="text-sm font-semibold text-white">Review notes</span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                  Capture wording, order, or behavior you want changed. Notes stay here when you reset the flow.
                </span>
                <textarea
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  rows={5}
                  placeholder="Example: Show the app download buttons before the confirmation details."
                  className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-white outline-none placeholder:text-zinc-700 focus:border-violet-300/40"
                />
              </label>

              <div className="rounded-2xl border border-white/10 bg-[#101018] p-4 text-xs leading-5 text-zinc-500">
                <p className="font-semibold text-zinc-300">Current test choices</p>
                <p className="mt-2">Account: {accountMethod}</p>
                <p>Checkout: {checkoutScenario}</p>
                <p>App account: {appAccount}</p>
                <p>External writes: 0</p>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
};

const firstQueryValue = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] || '' : value || '';

export const getServerSideProps: GetServerSideProps<FlowLabProps> = async ({
  query,
}) => {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.PULSECHECK_FLOW_LAB_ENABLED !== 'true'
  ) {
    return { notFound: true };
  }

  const previewRequested = firstQueryValue(query.preview) === 'athlete';
  const requestedAccess = firstQueryValue(query.access);
  const allowedAccess: FlowLabPreviewAccess[] = [
    'paid',
    'sponsored',
    'paused',
    'direct',
  ];
  const initialPreviewAccess =
    previewRequested &&
    allowedAccess.includes(requestedAccess as FlowLabPreviewAccess)
      ? (requestedAccess as FlowLabPreviewAccess)
      : null;
  const requestedPriceCents = normalizePulseCheckMonthlyPriceCents(
    firstQueryValue(query.price)
  );
  const initialPreviewPriceCents =
    requestedPriceCents >= MIN_PULSECHECK_ATHLETE_APP_PRICE_CENTS &&
    requestedPriceCents <= MAX_PULSECHECK_ATHLETE_APP_PRICE_CENTS
      ? requestedPriceCents
      : 1_999;

  return {
    props: {
      initialPreviewAccess,
      initialPreviewPriceCents,
    },
  };
};

export default SubscriptionFlowLab;
