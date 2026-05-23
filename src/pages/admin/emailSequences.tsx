import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useDispatch } from 'react-redux';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db, getFirebaseModeRequestHeaders } from '../../api/firebase/config';
import {
  Mail,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Edit3,
  Eye,
  Copy,
  Clock,
  FilePlus2,
  Activity,
  MousePointerClick,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  Target,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { showToast } from '../../redux/toastSlice';
import { useUser } from '../../hooks/useUser';

type SequenceRow = {
  id: string;
  name: string;
  trigger: string;
  defaultSubject: string;
  functionPath: string;
  templateDocId: string;
  scheduleConfigDocId?: string; // if present, allows admin to control scheduled automation config
  scheduleDescription?: string;
  supportsScheduleTime?: boolean;
  defaultScheduleEnabled?: boolean;
  deliveryRuntime?: 'netlify' | 'firebase';
  supportsTemplateEditing?: boolean;
  supportsTestSend?: boolean;
  supportsCampaignConfig?: boolean;
  openInAdminPath?: string;
  openInAdminLabel?: string;
};

type TemplatePreviewSource = 'none' | 'firestore' | 'draft' | 'default' | 'generic';
type TemplateBuildMode = 'preview' | 'seed';

type DefaultTemplatePreview = {
  subject: string;
  html: string;
  source: Extract<TemplatePreviewSource, 'none' | 'default' | 'generic'>;
};

type MacraPreviewCopy = {
  eyebrow: string;
  headline: string;
  intro: string;
  proofTitle?: string;
  proofBody: string;
  ctaLabel: string;
  ctaHref?: string;
  contextRows?: Array<{ label: string; value: string }>;
};

type CampaignConfig = {
  delayHours: number;
  batchLimit: number;
  maxSendsPerRun: number;
  scanEveryHours: number;
  sendWindowStartLocal: string;
  sendWindowEndLocal: string;
  sendWindowTimezone: string;
};

type MacraScoreboardTier =
  | 'paid'
  | 'trial_started'
  | 'high_intent_recovery'
  | 'serious_plan_completer'
  | 'onboarding_completer'
  | 'curiosity'
  | 'excluded';

type MacraScoreboardSignals = {
  ageYears: number | null;
  completedOnboarding: boolean;
  hasProfile: boolean;
  hasRealisticGoal: boolean;
  hasMacroTarget: boolean;
  reachedPaywall: boolean;
  explicitPaywallSignal: boolean;
  paywallViewCount: number;
  paywallLastViewedAt: number | null;
  ctaTappedAt: number | null;
  checkoutStartedAt: number | null;
  appleCancelAt: number | null;
  webOfferSentAt: number | null;
  webOfferOpenedAt: number | null;
  webOfferCheckoutStartedAt: number | null;
  webOfferConvertedAt: number | null;
  webOfferTrialEndAt: number | null;
  webOfferTrialDays: number | null;
  webOfferPaidAt: number | null;
  webOfferPaidAmount: number | null;
  webOfferPaidCurrency: string;
  webOfferPlan: string;
  stripeRetargetClickedAt: number | null;
  trialStartedAt: number | null;
  paidAt: number | null;
  appsFlyerTrialStartedAt: number | null;
  appsFlyerPurchaseAt: number | null;
  appsFlyerStartTrialEvents: number;
  appsFlyerPurchaseEvents: number;
  onboardingCompletedAt: number | null;
  latestIntentAt: number | null;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  goalDirection: string;
  pace: string;
  activityLevel: string;
  biggestStruggle: string;
  macroCalories: number | null;
};

type MacraNextRetargetingEmail = {
  sequenceId: string;
  stateKey: string;
  label: string;
  reason: string;
  dueAt: number;
  anchorAt: number;
  status: 'ready' | 'scheduled' | 'pending';
  canSendNow: boolean;
};

type MacraScoreboardUser = {
  id: string;
  email: string;
  displayName: string;
  tier: MacraScoreboardTier;
  tierLabel: string;
  isQualified: boolean;
  isHighIntent: boolean;
  suggestedLane: string;
  nextRetargetingEmail: MacraNextRetargetingEmail | null;
  disqualifiers: string[];
  signals: MacraScoreboardSignals;
};

type MacraScoreboardState = {
  loading: boolean;
  error: string;
  loadedAt: Date | null;
  config: Record<string, any> | null;
  appsFlyerSummary: Record<string, any> | null;
  users: MacraScoreboardUser[];
  userLimit: number;
  emailLogCount: number;
  purchaseLogCount: number;
};

type AppsFlyerAttributionDoc = Record<string, any> & {
  id: string;
  customerUserId?: string | null;
};

type MacraScoreboardRangePreset = 'last_7_days' | 'last_14_days' | 'last_30_days' | 'yesterday' | 'today';

type MacraScoreboardDateRange = {
  preset: MacraScoreboardRangePreset;
  start: string;
  end: string;
  label: string;
  daysBack: number;
};

const MACRA_WEB_OFFER_SEQUENCE_ID = 'macra-web-offer-24h-v1';
const MACRA_RETARGETING_SEQUENCE_CONFIG_ID = 'macra-retargeting-v1';
const CAMPAIGN_SEND_WINDOW_TIMEZONE = 'America/New_York';
const MACRA_APPSFLYER_SCOREBOARD_DAYS_BACK = 7;
const MACRA_APPSFLYER_RAW_SYNC_ENABLED = false;
const MACRA_SCOREBOARD_USER_LIMIT = 300;
const MACRA_SCOREBOARD_LOG_LIMIT = 500;
const MACRA_SCOREBOARD_PROFILE_CHUNK_SIZE = 40;
const MACRA_SCOREBOARD_ATTRIBUTION_CHUNK_SIZE = 30;
const MACRA_SCOREBOARD_DEFAULT_RANGE_PRESET: MacraScoreboardRangePreset = 'last_7_days';
const MACRA_SCOREBOARD_RANGE_OPTIONS: Array<{ value: MacraScoreboardRangePreset; label: string; daysBack: number }> = [
  { value: 'last_7_days', label: 'Last 7 days', daysBack: 7 },
  { value: 'last_14_days', label: 'Last 14 days', daysBack: 14 },
  { value: 'last_30_days', label: 'Last 30 days', daysBack: 30 },
  { value: 'yesterday', label: 'Yesterday', daysBack: 1 },
  { value: 'today', label: 'Today', daysBack: 1 },
];
const MACRA_RETARGETING_SEQUENCE_IDS = [
  MACRA_WEB_OFFER_SEQUENCE_ID,
  'macra-paywall-cancel-trust-v1',
  'macra-web-offer-proof-v1',
  'macra-paywall-view-value-v1',
  'macra-no-trial-7d-challenge-v1',
  'macra-trial-no-activation-24h-v1',
];
const MACRA_APPSFLYER_PAYWALL_EVENT_NAMES = ['macra_onboarding_paywall_reached', 'macra_paywall_viewed_standalone'];
const MACRA_APPSFLYER_PLAN_LOADED_EVENT_NAMES = ['macra_subscription_plans_loaded'];
const MACRA_APPSFLYER_PLAN_SELECTED_EVENT_NAMES = ['macra_subscription_plan_selected'];
const MACRA_APPSFLYER_CTA_EVENT_NAMES = [
  'macra_paywall_primary_button_pressed',
  'macra_paywall_cta_pressed',
  'macra_paywall_cta_tapped',
  'macra_paywall_cta_clicked',
];
const MACRA_APPSFLYER_CHECKOUT_EVENT_NAMES = [
  'af_initiated_checkout',
  'macra_subscription_web_checkout_started',
  'macra_subscription_checkout_started',
];
const MACRA_APPSFLYER_PURCHASE_CANCEL_EVENT_NAMES = [
  'macra_subscription_purchase_cancelled',
  'macra_subscription_purchase_canceled',
];
const MACRA_APPSFLYER_PURCHASE_FAILED_EVENT_NAMES = ['macra_subscription_purchase_failed'];
const MACRA_APPSFLYER_TRIAL_EVENT_NAMES = ['af_start_trial', 'start_trial', 'trial_started', 'macra_trial_started'];
const MACRA_APPSFLYER_PURCHASE_EVENT_NAMES = ['af_subscribe', 'af_purchase', 'subscribe', 'purchase', 'macra_subscription_started'];
const MACRA_RETARGETING_SENT_STATE_FIELDS = [
  'webOffer24hSentAt',
  'paywallCancelTrustSentAt',
  'webOfferProofSentAt',
  'paywallViewValueSentAt',
  'noTrial7dChallengeSentAt',
  'trialNoActivation24hSentAt',
];
const MACRA_RETARGETING_FUNNEL_STEPS = {
  paywallCancelTrust: {
    sequenceId: 'macra-paywall-cancel-trust-v1',
    stateKey: 'paywallCancelTrust',
    label: 'Apple trust recovery',
    delayField: 'paywallCancelDelayHours',
    defaultDelayHours: 1,
  },
  webOfferProof: {
    sequenceId: 'macra-web-offer-proof-v1',
    stateKey: 'webOfferProof',
    label: 'Proof follow-up',
    delayField: 'webOfferProofDelayHours',
    defaultDelayHours: 4,
  },
  paywallViewValue: {
    sequenceId: 'macra-paywall-view-value-v1',
    stateKey: 'paywallViewValue',
    label: 'Paywall value email',
    delayField: 'paywallViewDelayHours',
    defaultDelayHours: 24,
  },
  noTrial7dChallenge: {
    sequenceId: 'macra-no-trial-7d-challenge-v1',
    stateKey: 'noTrial7dChallenge',
    label: '7-day meal challenge',
    delayField: 'noTrialDelayHours',
    defaultDelayHours: 168,
  },
  trialActivation: {
    sequenceId: 'macra-trial-no-activation-24h-v1',
    stateKey: 'trialNoActivation24h',
    label: 'Trial activation',
    delayField: 'trialActivationDelayHours',
    defaultDelayHours: 24,
  },
};
const MACRA_QUALIFIED_TIERS = new Set<MacraScoreboardTier>([
  'paid',
  'trial_started',
  'high_intent_recovery',
  'serious_plan_completer',
]);
const MACRA_TIER_LABELS: Record<MacraScoreboardTier, string> = {
  paid: 'Paid',
  trial_started: 'Trial started',
  high_intent_recovery: 'High-intent recovery',
  serious_plan_completer: 'Serious plan completer',
  onboarding_completer: 'Onboarding completer',
  curiosity: 'Curiosity / incomplete',
  excluded: 'Excluded',
};
const MACRA_TIER_ORDER: MacraScoreboardTier[] = [
  'paid',
  'trial_started',
  'high_intent_recovery',
  'serious_plan_completer',
  'onboarding_completer',
  'curiosity',
  'excluded',
];
const MACRA_DISQUALIFIER_LABELS: Record<string, string> = {
  under_18: 'Under 18',
  missing_age: 'Missing age',
  missing_profile: 'Missing Macra profile',
  missing_goal_weight: 'Missing goal weight',
  missing_current_weight: 'Missing current weight',
  unrealistic_goal: 'Unrealistic goal data',
  missing_goal_direction: 'Missing goal direction',
  missing_pace: 'Missing pace',
  missing_activity_level: 'Missing activity level',
  missing_biggest_struggle: 'Missing biggest struggle',
  missing_macro_target: 'Missing macro target',
  no_paywall_signal: 'No paywall signal',
};
const DEFAULT_CAMPAIGN_CONFIG: CampaignConfig = {
  delayHours: 24,
  batchLimit: 250,
  maxSendsPerRun: 80,
  scanEveryHours: 1,
  sendWindowStartLocal: '09:00',
  sendWindowEndLocal: '17:00',
  sendWindowTimezone: CAMPAIGN_SEND_WINDOW_TIMEZONE,
};

const buildMacraRetargetingSchedulerDefaultConfig = () => ({
  id: MACRA_RETARGETING_SEQUENCE_CONFIG_ID,
  enabled: true,
  delayHours: 24,
  cooldownHours: 24,
  batchLimit: MACRA_SCOREBOARD_USER_LIMIT,
  maxSendsPerRun: 25,
  scanEveryHours: 1,
  paywallCancelDelayHours: 1,
  webOfferProofDelayHours: 4,
  paywallViewDelayHours: 24,
  paywallViewMinCount: 2,
  noTrialDelayHours: 168,
  trialActivationDelayHours: 24,
  sendWindowStartLocal: DEFAULT_CAMPAIGN_CONFIG.sendWindowStartLocal,
  sendWindowEndLocal: DEFAULT_CAMPAIGN_CONFIG.sendWindowEndLocal,
  sendWindowTimezone: CAMPAIGN_SEND_WINDOW_TIMEZONE,
  schedulerAutoseeded: true,
});

const normalizeLocalTime = (value: unknown, fallback: string) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{2}:\d{2}$/.test(raw)) return fallback;

  const [hourRaw, minuteRaw] = raw.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const normalizeCampaignConfig = (data: Record<string, any> = {}): CampaignConfig => ({
  delayHours: Math.max(1, Number(data.delayHours || DEFAULT_CAMPAIGN_CONFIG.delayHours) || DEFAULT_CAMPAIGN_CONFIG.delayHours),
  batchLimit: Math.max(25, Number(data.batchLimit || DEFAULT_CAMPAIGN_CONFIG.batchLimit) || DEFAULT_CAMPAIGN_CONFIG.batchLimit),
  maxSendsPerRun: Math.max(1, Number(data.maxSendsPerRun || DEFAULT_CAMPAIGN_CONFIG.maxSendsPerRun) || DEFAULT_CAMPAIGN_CONFIG.maxSendsPerRun),
  scanEveryHours: Math.max(1, Number(data.scanEveryHours || DEFAULT_CAMPAIGN_CONFIG.scanEveryHours) || DEFAULT_CAMPAIGN_CONFIG.scanEveryHours),
  sendWindowStartLocal: normalizeLocalTime(data.sendWindowStartLocal, DEFAULT_CAMPAIGN_CONFIG.sendWindowStartLocal),
  sendWindowEndLocal: normalizeLocalTime(data.sendWindowEndLocal, DEFAULT_CAMPAIGN_CONFIG.sendWindowEndLocal),
  sendWindowTimezone: typeof data.sendWindowTimezone === 'string' && data.sendWindowTimezone.trim()
    ? data.sendWindowTimezone.trim()
    : DEFAULT_CAMPAIGN_CONFIG.sendWindowTimezone,
});

const parseIntegerDraft = (value: string): number | null => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const hasCampaignControls = (seq: Pick<SequenceRow, 'id' | 'supportsCampaignConfig' | 'scheduleConfigDocId'> | null) =>
  Boolean(
    seq?.supportsCampaignConfig ||
    seq?.id === MACRA_WEB_OFFER_SEQUENCE_ID ||
    seq?.scheduleConfigDocId === MACRA_RETARGETING_SEQUENCE_CONFIG_ID
  );

const EMPTY_TEMPLATE_PREVIEW: DefaultTemplatePreview = { subject: '', html: '', source: 'none' };

const PREVIEW_TEMPLATE_VALUES: Record<string, string> = {
  firstName: 'Tremaine',
  followerName: 'Jordan',
  athleteName: 'Maya',
  teamName: 'PulseCheck Team',
  prizeAmount: '25',
  challengeTitle: 'May Challenge',
  coachName: 'Coach Taylor',
  source: 'App',
  username: 'sample-user',
  milestone: '7',
  completedCount: '4',
  totalPlanned: '6',
  hoursRemaining: '24',
  eventTitle: 'Community Lift Night',
  tipTitle: 'Build one anchor meal',
  resetLink: '#',
  checkoutUrl: '#',
  dashboardUrl: '#',
  openAppUrl: '#',
  gettingStartedUrl: '#',
  roundUrl: '#',
  clubUrl: '#',
  macraUrl: '#',
  daysInactive: '3',
  macroSummary: '2,150 calories, 165g protein, 210g carbs, 65g fat',
  mealPlanLabel: '3 meals plus 1 snack built from your onboarding profile',
  biggestStruggleLabel: 'Evening cravings',
  biggestStruggleProof: 'Keep a protein-first option ready before dinner.',
};

const MACRA_RETARGETING_PREVIEW_CONTEXT_ROWS = [
  { label: 'Your target', value: '{{macroSummary}}' },
  { label: 'Nora plan', value: '{{mealPlanLabel}}' },
  { label: 'Coaching focus', value: '{{biggestStruggleLabel}}. {{biggestStruggleProof}}' },
];

const PULSE_PREVIEW_COPY_BY_SEQUENCE_ID: Record<string, MacraPreviewCopy> = {
  'welcome-v1': {
    eyebrow: 'Welcome',
    headline: 'Welcome to Pulse, {{firstName}}.',
    intro: 'Your account is ready. Set up your profile, find your first workout, and start building momentum inside Pulse.',
    proofTitle: 'Start here',
    proofBody: 'Open Pulse, finish your profile, and choose the next training action that fits your goal.',
    ctaLabel: 'Open Pulse',
    ctaHref: 'https://fitwithpulse.ai/dashboard',
  },
  'username-reminder-v1': {
    eyebrow: 'Almost done',
    headline: 'Finish setting up your Pulse account, {{firstName}}.',
    intro: 'You are one step away from completing registration. Pick your username so your account is ready when you come back.',
    proofTitle: 'Why it matters',
    proofBody: 'Your username helps connect your workouts, challenge activity, and community profile in Pulse.',
    ctaLabel: 'Finish setup',
    ctaHref: 'https://fitwithpulse.ai',
  },
  'new-follower-v1': {
    eyebrow: 'New follower',
    headline: '{{followerName}} is now following you on Pulse.',
    intro: 'Someone new is following your training activity. Open Pulse to view their profile and keep the connection moving.',
    proofTitle: 'Stay connected',
    proofBody: 'Followers help your workouts, challenges, and creator activity travel further through the Pulse community.',
    ctaLabel: 'Open Pulse',
    ctaHref: 'https://fitwithpulse.ai',
  },
  'coach-connection-v1': {
    eyebrow: 'PulseCheck',
    headline: '{{athleteName}} just connected with you on PulseCheck.',
    intro: '{{coachName}}, you can now message this athlete and support their training progress from your coach dashboard.',
    proofTitle: 'Next step',
    proofBody: 'Review their profile, open the conversation, and help them keep their training moving.',
    ctaLabel: 'View coach dashboard',
    ctaHref: '{{dashboardUrl}}',
  },
  'pulsecheck-pilot-activation-v1': {
    eyebrow: 'Access ready',
    headline: '{{teamName}} access is ready in PulseCheck.',
    intro: 'Your pilot access has been activated. Reopen the app to finish consent and complete setup.',
    proofTitle: 'What to do now',
    proofBody: 'Open PulseCheck, review the consent flow, and finish the remaining setup steps for your team experience.',
    ctaLabel: 'Open PulseCheck',
    ctaHref: '{{openAppUrl}}',
  },
  'winner-notification-v1': {
    eyebrow: 'Challenge winner',
    headline: 'You won ${{prizeAmount}} in {{challengeTitle}}!',
    intro: 'Nice work, {{firstName}}. Your challenge result has been confirmed and your prize details are ready to review.',
    proofTitle: 'Prize status',
    proofBody: 'Open your dashboard to review challenge results, payout details, and next steps.',
    ctaLabel: 'View results',
    ctaHref: '{{dashboardUrl}}',
  },
  'approval-v1': {
    eyebrow: 'Approved',
    headline: "You're approved, {{firstName}}.",
    intro: 'Welcome to Pulse Programming. You now have access to the Founding Coach experience.',
    proofTitle: 'Start here',
    proofBody: 'Download the app, complete your profile, create your first Move, Stack, and Round, then launch a challenge with your audience.',
    ctaLabel: 'Open getting started guide',
    ctaHref: '{{gettingStartedUrl}}',
  },
  'joined-round-no-workout-v1': {
    eyebrow: 'Round reminder',
    headline: 'Your Round is waiting, {{firstName}}.',
    intro: 'You joined {{challengeTitle}} but have not started your first workout yet.',
    proofTitle: 'Start with one session',
    proofBody: 'Open the Round and complete your first workout. Momentum starts with one completed training session.',
    ctaLabel: 'Start first workout',
    ctaHref: '{{roundUrl}}',
  },
  'first-workout-celebration-v1': {
    eyebrow: 'First workout complete',
    headline: 'First workout complete. Huge win, {{firstName}}.',
    intro: 'You just finished your first workout in {{challengeTitle}}.',
    proofTitle: 'Next action',
    proofBody: 'Lock in your next workout now while momentum is high, then review your progress on the dashboard.',
    ctaLabel: 'Plan next workout',
    ctaHref: '{{roundUrl}}',
  },
  'streak-milestone-v1': {
    eyebrow: 'Streak milestone',
    headline: '{{milestone}}-day streak unlocked.',
    intro: '{{firstName}}, you hit a {{milestone}}-day consistency milestone in {{challengeTitle}}.',
    proofTitle: 'Keep it alive',
    proofBody: 'Open your Round and complete the next session while your rhythm is still fresh.',
    ctaLabel: 'Keep streak going',
    ctaHref: '{{roundUrl}}',
  },
  'challenge-ending-soon-v1': {
    eyebrow: 'Challenge ending soon',
    headline: '{{hoursRemaining}} hours left in {{challengeTitle}}.',
    intro: '{{firstName}}, finish strong. You are at {{completedCount}}/{{totalPlanned}} planned workouts.',
    proofTitle: 'Final push',
    proofBody: 'Complete your next workout now, then keep momentum going with standalone workouts after this challenge.',
    ctaLabel: 'Finish challenge strong',
    ctaHref: '{{roundUrl}}',
  },
  'irl-event-analytics-report-v1': {
    eyebrow: 'Event analytics',
    headline: 'Your {{eventTitle}} analytics report is ready.',
    intro: 'Your event has wrapped, and the attendance and engagement summary is ready to review.',
    proofTitle: 'Inside the report',
    proofBody: 'Review check-ins, attendance timing, platform breakdown, and share-driven activity from the event.',
    ctaLabel: 'Open report',
    ctaHref: '{{clubUrl}}',
  },
  'inactivity-winback-v1': {
    eyebrow: 'Pulse check-in',
    headline: "Let's get you back in motion, {{firstName}}.",
    intro: 'It has been a few days since your last meaningful activity. Start small and rebuild the rhythm today.',
    proofTitle: 'One useful action',
    proofBody: 'Open Pulse, choose a workout, and complete one training session to get momentum back.',
    ctaLabel: 'Open Pulse',
    ctaHref: '{{dashboardUrl}}',
  },
  'password-reset-v1': {
    eyebrow: 'Password reset',
    headline: 'Reset your Pulse password.',
    intro: 'Use the secure link below to choose a new password for your account.',
    proofTitle: 'Security note',
    proofBody: 'If you did not request this reset, you can ignore this email and your password will stay the same.',
    ctaLabel: 'Reset password',
    ctaHref: '{{resetLink}}',
  },
  'error-alerts-v1': {
    eyebrow: 'Pulse error alert',
    headline: '[Pulse Error Alert] {{source}} ({{username}})',
    intro: 'A new app error was recorded and needs review.',
    proofTitle: 'Review context',
    proofBody: 'Open the error logs dashboard to inspect the source, user, and stack details.',
    ctaLabel: 'Open error logs',
    ctaHref: 'https://fitwithpulse.ai/admin/ErrorLogs',
  },
};

const MACRA_PREVIEW_COPY_BY_SEQUENCE_ID: Record<string, MacraPreviewCopy> = {
  'macra-welcome-v1': {
    eyebrow: 'Plan ready',
    headline: 'Welcome to Macra, {{firstName}}.',
    intro: 'Your plan is live. Nora, your AI nutrition coach, is ready to help you hit your macros every day.',
    proofTitle: 'Three ways to start strong',
    proofBody: 'Log your first meal, ask Nora what to adjust, then check what is left for the day before dinner.',
    ctaLabel: 'Open Macra',
    ctaHref: 'https://fitwithpulse.ai/macra',
  },
  'macra-tips-v1': {
    eyebrow: 'Nora tip',
    headline: 'Build one anchor meal today, {{firstName}}.',
    intro: 'A predictable breakfast or lunch makes the rest of the day easier to adjust. Nora can help you make that meal fit your target.',
    proofTitle: 'Small wins compound',
    proofBody: 'Once one meal is dialed in, Macra can show what is left for the day and help you avoid guessing later.',
    ctaLabel: 'Open Macra',
    ctaHref: '{{macraUrl}}',
  },
  'macra-inactivity-winback-v1': {
    eyebrow: 'Macra check-in',
    headline: "Nora's missing you, {{firstName}}.",
    intro: 'It has been a few days since your last food log. You already have the plan, so the fastest way back is one simple meal entry.',
    proofTitle: 'Pick the day back up',
    proofBody: 'Log one meal and Nora can rebuild the rest of today around your remaining calories, protein, carbs, and fat.',
    ctaLabel: 'Log a meal',
    ctaHref: '{{macraUrl}}',
  },
  [MACRA_WEB_OFFER_SEQUENCE_ID]: {
    eyebrow: 'One free month',
    headline: 'Your Macra plan is ready, {{firstName}}.',
    intro: 'You already built your nutrition profile. Start Macra today and your first month is free before the subscription renews.',
    proofTitle: 'What Nora unlocks',
    proofBody: 'Inside Macra, Nora helps turn your profile into targets, meal feedback, and daily coaching so you know exactly what to adjust next.',
    ctaLabel: 'Start your free month',
    ctaHref: '{{checkoutUrl}}',
  },
  'macra-paywall-cancel-trust-v1': {
    eyebrow: 'Macra trial',
    headline: 'No payment today, {{firstName}}. Apple confirms the details first.',
    intro:
      "You tapped to start Macra, then stopped before the trial began. The next screen is Apple's subscription sheet, where you can review the exact plan and renewal price before approving anything.",
    proofTitle: 'What happens when you try again',
    proofBody:
      'Macra unlocks your target, scanner, meal plan, and Nora coaching after you confirm. If it is not the right fit, you can cancel from Apple Subscriptions before renewal.',
    ctaLabel: 'Open Macra',
    ctaHref: '{{macraUrl}}',
    contextRows: MACRA_RETARGETING_PREVIEW_CONTEXT_ROWS,
  },
  'macra-web-offer-proof-v1': {
    eyebrow: 'Your plan preview',
    headline: '{{firstName}}, your Macra plan was built around your goal.',
    intro:
      'You already gave Macra enough context to build a useful starting point. Your targets, meal plan, and Nora coaching are meant to turn that goal into a clear food decision today.',
    proofTitle: 'Why this is different from a blank food tracker',
    proofBody:
      'Macra starts from your profile instead of asking you to guess. Nora uses your target, plan, and saved meals to help you decide what fits next.',
    ctaLabel: 'Review my plan',
    ctaHref: '{{macraUrl}}',
    contextRows: MACRA_RETARGETING_PREVIEW_CONTEXT_ROWS,
  },
  'macra-paywall-view-value-v1': {
    eyebrow: 'One useful action',
    headline: 'Start with one meal today, {{firstName}}.',
    intro: 'You do not need a perfect tracking day to learn something useful. Scan one real meal and Macra will show how it fits your target.',
    proofTitle: 'The first win is clarity',
    proofBody: 'A single photo can turn guessing into calories, protein, carbs, and fat, then Nora can help with what to eat next.',
    ctaLabel: 'Scan one meal',
    ctaHref: '{{macraUrl}}',
    contextRows: MACRA_RETARGETING_PREVIEW_CONTEXT_ROWS,
  },
  'macra-no-trial-7d-challenge-v1': {
    eyebrow: '7-day check-in',
    headline: 'Try Macra with one real meal, {{firstName}}.',
    intro: 'No hard sell. Open Macra, scan one meal you were already going to eat, and see what Nora does with the numbers.',
    proofTitle: 'One meal is enough to feel the loop',
    proofBody: 'Macra turns the scan into a macro breakdown, compares it to your target, and helps you make the next food choice.',
    ctaLabel: 'Try one meal',
    ctaHref: '{{macraUrl}}',
    contextRows: MACRA_RETARGETING_PREVIEW_CONTEXT_ROWS,
  },
  'macra-trial-no-activation-24h-v1': {
    eyebrow: 'Trial active',
    headline: 'Your trial is active, {{firstName}}. Start with one meal.',
    intro: 'The fastest way to feel Macra is to log one meal now. Nora can coach the day better once she has a first signal.',
    proofTitle: 'Start the trial with context',
    proofBody: 'After your first meal, Macra can show what is left for the day and Nora can help you adjust before dinner.',
    ctaLabel: 'Log my first meal',
    ctaHref: '{{macraUrl}}',
    contextRows: MACRA_RETARGETING_PREVIEW_CONTEXT_ROWS,
  },
};

const escapePreviewHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const applyPreviewTemplateValues = (value: string) =>
  value.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => PREVIEW_TEMPLATE_VALUES[key] || key);

const renderTemplateValue = (value: string, mode: TemplateBuildMode) =>
  mode === 'preview' ? applyPreviewTemplateValues(value) : value;

const renderTemplateHref = (value: string | undefined, mode: TemplateBuildMode) =>
  mode === 'preview' ? '#' : value || '#';

const getPreviewSiteOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://fitwithpulse.ai';
};

const buildMacraTemplateHtml = (seq: SequenceRow, copy: MacraPreviewCopy, subjectOverride?: string, mode: TemplateBuildMode = 'preview'): string => {
  const subject = renderTemplateValue((subjectOverride || seq.defaultSubject).trim() || seq.defaultSubject, mode);
  const logoUrl = `${getPreviewSiteOrigin()}/macra-icon.png`;
  const headline = renderTemplateValue(copy.headline, mode);
  const ctaHref = renderTemplateHref(copy.ctaHref, mode);
  const contextRows = copy.contextRows || [];
  const proofTitleHtml = copy.proofTitle
    ? `<p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#ffffff;font-weight:800;">${escapePreviewHtml(copy.proofTitle)}</p>`
    : '';
  const contextHtml = contextRows.length
    ? `<p style="margin:0;font-size:12px;line-height:1.8;color:#A1A1AA;">
${contextRows
  .map(
    (row) => `
                      <strong style="color:#E4E4E7;">${escapePreviewHtml(row.label)}:</strong> ${escapePreviewHtml(renderTemplateValue(row.value, mode))}<br />`
  )
  .join('')}                    </p>`
    : '';
  const proofBodyMargin = contextRows.length ? '0 0 12px 0' : '0';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapePreviewHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0a0a0b;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
            <tr>
              <td style="padding:6px 8px 18px 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
                  <tr>
                    <td style="vertical-align:middle;padding-right:12px;">
                      <img src="${escapePreviewHtml(logoUrl)}" width="44" height="44" alt="Macra" style="display:block;width:44px;height:44px;border-radius:12px;border:0;outline:none;text-decoration:none;" />
                    </td>
                    <td style="vertical-align:middle;font-weight:800;color:#ffffff;font-size:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">Macra</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid rgba(255,255,255,0.08);background:#18181b;border-radius:20px;overflow:hidden;">
                <div style="height:2px;background:linear-gradient(90deg, transparent, rgba(224,254,16,0.82), transparent);"></div>
                <div style="padding:28px 24px 10px 24px;">
                  <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#E0FE10;font-weight:800;">${escapePreviewHtml(copy.eyebrow)}</p>
                  <h1 style="margin:0 0 12px 0;font-size:29px;line-height:1.18;color:#ffffff;font-weight:900;">
                    ${escapePreviewHtml(headline)}
                  </h1>
                  <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:#D4D4D8;">
                    ${escapePreviewHtml(copy.intro)}
                  </p>
                  <a href="${escapePreviewHtml(ctaHref)}" style="display:inline-block;background:#E0FE10;color:#101113;text-decoration:none;padding:13px 18px;border-radius:12px;font-weight:900;font-size:14px;">
                    ${escapePreviewHtml(copy.ctaLabel)}
                  </a>
                </div>
                <div style="padding:18px 24px 26px 24px;">
                  <div style="padding:16px;border-radius:16px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.06);">
                    ${proofTitleHtml}
                    <p style="margin:${proofBodyMargin};font-size:13px;line-height:1.7;color:#D4D4D8;">${escapePreviewHtml(copy.proofBody)}</p>
                    ${contextHtml}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 8px 0 8px;text-align:center;font-size:12px;line-height:1.6;color:#71717A;">
                Sent by Macra &middot; A Pulse Intelligence Labs app<br />
                Reply to this email if you do not want Macra emails.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const buildGenericTemplateHtml = (seq: SequenceRow, copy: MacraPreviewCopy, subjectOverride?: string, mode: TemplateBuildMode = 'preview'): string => {
  const subject = renderTemplateValue((subjectOverride || seq.defaultSubject).trim() || seq.defaultSubject, mode);
  const headline = renderTemplateValue(copy.headline, mode);
  const intro = renderTemplateValue(copy.intro, mode);
  const proofBody = renderTemplateValue(copy.proofBody, mode);
  const ctaHref = renderTemplateHref(copy.ctaHref, mode);
  const proofTitleHtml = copy.proofTitle
    ? `<p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#ffffff;font-weight:800;">${escapePreviewHtml(copy.proofTitle)}</p>`
    : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapePreviewHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0f1216;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0f1216;padding:28px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background:#1a1e24;border:1px solid #2f3640;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:26px 24px;color:#f4f4f5;">
                <p style="margin:0 0 8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:#d7ff00;font-weight:800;">${escapePreviewHtml(copy.eyebrow)}</p>
                <h1 style="margin:0 0 12px 0;font-size:26px;line-height:1.22;color:#ffffff;">${escapePreviewHtml(headline)}</h1>
                <p style="margin:0 0 18px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  ${escapePreviewHtml(intro)}
                </p>
                <div style="margin:0 0 18px 0;padding:14px 14px;border-radius:14px;background:rgba(0,0,0,0.32);border:1px solid rgba(255,255,255,0.06);">
                  ${proofTitleHtml}
                  <p style="margin:0;font-size:13px;line-height:1.7;color:#d4d4d8;">${escapePreviewHtml(proofBody)}</p>
                </div>
                <a href="${escapePreviewHtml(ctaHref)}" style="display:inline-block;background:#d7ff00;color:#101113;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:800;font-size:14px;">
                  ${escapePreviewHtml(copy.ctaLabel)}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const buildDefaultEmailTemplate = (seq: SequenceRow, subjectOverride?: string, mode: TemplateBuildMode = 'preview'): DefaultTemplatePreview => {
  const subject = renderTemplateValue((subjectOverride || seq.defaultSubject).trim() || seq.defaultSubject, mode);
  const macraCopy = MACRA_PREVIEW_COPY_BY_SEQUENCE_ID[seq.id];
  if (macraCopy) {
    return { subject, html: buildMacraTemplateHtml(seq, macraCopy, subjectOverride, mode), source: 'default' };
  }
  const pulseCopy = PULSE_PREVIEW_COPY_BY_SEQUENCE_ID[seq.id];
  if (pulseCopy) {
    return { subject, html: buildGenericTemplateHtml(seq, pulseCopy, subjectOverride, mode), source: 'default' };
  }
  if (seq.id.startsWith('macra-')) {
    return {
      subject,
      html: buildMacraTemplateHtml(
        seq,
        {
          eyebrow: 'Macra email',
          headline: subjectOverride || seq.defaultSubject,
          intro: 'No custom HTML is saved yet, so this preview shows a Macra-styled fallback for the send function.',
          proofTitle: 'Fallback behavior',
          proofBody: 'Real sends continue to use the send-function fallback until a custom template is saved here.',
          ctaLabel: 'Open Macra',
          ctaHref: 'https://fitwithpulse.ai/macra',
        },
        subjectOverride,
        mode
      ),
      source: 'generic',
    };
  }
  return {
    subject,
    html: buildGenericTemplateHtml(
      seq,
      {
        eyebrow: 'Pulse email',
        headline: subjectOverride || seq.defaultSubject,
        intro: `No custom HTML is saved for ${seq.name} yet. Real sends will use the fallback built into its send function until custom HTML is saved here.`,
        proofTitle: 'Fallback behavior',
        proofBody: 'This generated seed gives the admin dashboard an editable starting point for the sequence.',
        ctaLabel: 'Open Pulse',
        ctaHref: 'https://fitwithpulse.ai',
      },
      subjectOverride,
      mode
    ),
    source: 'generic',
  };
};

const buildEditableDefaultTemplate = (seq: SequenceRow, subjectOverride?: string): DefaultTemplatePreview =>
  buildDefaultEmailTemplate(seq, subjectOverride, 'seed');

const getPreviewSourceLabel = (source: TemplatePreviewSource) => {
  switch (source) {
    case 'firestore':
      return 'Saved HTML';
    case 'draft':
      return 'Unsaved draft';
    case 'default':
      return 'Function default';
    case 'generic':
      return 'Generic fallback';
    default:
      return 'No preview';
  }
};

const getNestedValue = (source: Record<string, any> | null | undefined, path: string): any => {
  if (!source || !path) return undefined;
  return path.split('.').reduce<any>((acc, part) => (acc === null || acc === undefined ? undefined : acc[part]), source);
};

const normalizeScoreboardString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const titleizeScoreboardToken = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const scoreNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const positiveScoreNumber = (value: unknown): number | null => {
  const parsed = scoreNumber(value);
  return parsed && parsed > 0 ? parsed : null;
};

const scoreMillis = (value: unknown): number | null => {
  if (!value) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value < 10000000000 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof (value as any)?.toMillis === 'function') {
    const millis = (value as any).toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof (value as any)?.toDate === 'function') {
    const millis = (value as any).toDate().getTime();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof (value as any)?.seconds === 'number') {
    const millis = (value as any).seconds * 1000 + Math.round(((value as any).nanoseconds || 0) / 1000000);
    return Number.isFinite(millis) ? millis : null;
  }
  return null;
};

const maxScoreMillis = (...values: unknown[]): number | null => {
  const millis = values
    .map(scoreMillis)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return millis.length ? Math.max(...millis) : null;
};

const formatScoreboardDate = (value: unknown): string => {
  const millis = scoreMillis(value);
  if (!millis) return 'Not seen';
  return new Date(millis).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatScoreboardAgo = (value: unknown): string => {
  const millis = scoreMillis(value);
  if (!millis) return 'No timestamp';
  const diffMs = Date.now() - millis;
  const absMs = Math.abs(diffMs);
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minuteMs = 60 * 1000;
  if (absMs >= dayMs) return `${Math.round(absMs / dayMs)}d ${diffMs >= 0 ? 'ago' : 'from now'}`;
  if (absMs >= hourMs) return `${Math.round(absMs / hourMs)}h ${diffMs >= 0 ? 'ago' : 'from now'}`;
  return `${Math.max(1, Math.round(absMs / minuteMs))}m ${diffMs >= 0 ? 'ago' : 'from now'}`;
};

const getScoreboardSendUrgencyClass = (value: unknown): string => {
  const millis = scoreMillis(value);
  if (!millis) return 'text-zinc-500';
  const minutesUntilSend = (millis - Date.now()) / (60 * 1000);
  if (minutesUntilSend <= 30) return 'text-red-300 font-semibold';
  if (minutesUntilSend < 12 * 60) return 'text-yellow-300 font-semibold';
  return 'text-green-300 font-semibold';
};

const scoreboardMinutesFromLocalTime = (value: string): number => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

const getScoreboardLocalMinutes = (millis: number, timezone: string): number => {
  const safeTimezone = timezone || CAMPAIGN_SEND_WINDOW_TIMEZONE;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(new Date(millis));
    const lookup = new Map(parts.map((part) => [part.type, part.value]));
    return Number(lookup.get('hour') || 0) * 60 + Number(lookup.get('minute') || 0);
  } catch (_error) {
    return getScoreboardLocalMinutes(millis, CAMPAIGN_SEND_WINDOW_TIMEZONE);
  }
};

const isWithinScoreboardSendWindow = (millis: number, config: CampaignConfig): boolean => {
  const localMinutes = getScoreboardLocalMinutes(millis, config.sendWindowTimezone);
  const startMinutes = scoreboardMinutesFromLocalTime(config.sendWindowStartLocal);
  const endMinutes = scoreboardMinutesFromLocalTime(config.sendWindowEndLocal);

  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) return localMinutes >= startMinutes && localMinutes < endMinutes;
  return localMinutes >= startMinutes || localMinutes < endMinutes;
};

const roundUpToNextHourlySchedulerRun = (millis: number): number => {
  const date = new Date(millis);
  if (date.getMinutes() || date.getSeconds() || date.getMilliseconds()) {
    date.setHours(date.getHours() + 1, 0, 0, 0);
  } else {
    date.setMinutes(0, 0, 0);
  }
  return date.getTime();
};

const estimateMacraScheduledSendAt = (
  nextEmail: MacraNextRetargetingEmail,
  rawConfig: Record<string, any> | null | undefined
): number | null => {
  if (nextEmail.status === 'pending' || rawConfig?.enabled === false) return null;

  const campaignConfig = normalizeCampaignConfig(rawConfig || {});
  const hourMs = 60 * 60 * 1000;
  const lastScanAt = scoreMillis(rawConfig?.lastScanAt || rawConfig?.lastScanCompletedAt);
  const frequencyReadyAt = lastScanAt ? lastScanAt + campaignConfig.scanEveryHours * hourMs : 0;
  let candidate = roundUpToNextHourlySchedulerRun(Math.max(Date.now(), nextEmail.dueAt, frequencyReadyAt));

  for (let i = 0; i < 24 * 14; i += 1) {
    if (isWithinScoreboardSendWindow(candidate, campaignConfig)) return candidate;
    candidate += hourMs;
  }

  return candidate;
};

const formatScoreboardPercent = (value: number, denominator: number): string =>
  denominator > 0 ? `${Math.round((value / denominator) * 100)}%` : '0%';

const formatScoreboardMoney = (amount: number | null | undefined, currency = 'USD'): string => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return 'No paid invoice';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch (_error) {
    return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
  }
};

const formatDateInputValue = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const relativeDateInputValue = (offsetDays: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return formatDateInputValue(date);
};

const formatDateOnlyLabel = (value: unknown): string => {
  const text = normalizeScoreboardString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  return new Date(`${text}T12:00:00`).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const buildMacraScoreboardDateRange = (preset: MacraScoreboardRangePreset): MacraScoreboardDateRange => {
  const option = MACRA_SCOREBOARD_RANGE_OPTIONS.find((row) => row.value === preset) || MACRA_SCOREBOARD_RANGE_OPTIONS[0];
  if (preset === 'today') {
    const today = relativeDateInputValue(0);
    return { preset, start: today, end: today, label: option.label, daysBack: option.daysBack };
  }
  if (preset === 'yesterday') {
    const yesterday = relativeDateInputValue(-1);
    return { preset, start: yesterday, end: yesterday, label: option.label, daysBack: option.daysBack };
  }

  const days = option.daysBack;
  return {
    preset,
    start: relativeDateInputValue(-(days - 1)),
    end: relativeDateInputValue(0),
    label: option.label,
    daysBack: days,
  };
};

const formatMacraScoreboardRangeLabel = (range: MacraScoreboardDateRange): string => {
  const start = formatDateOnlyLabel(range.start);
  const end = formatDateOnlyLabel(range.end);
  if (!start || !end) return range.label;
  return range.start === range.end ? `${range.label} · ${start}` : `${range.label} · ${start} to ${end}`;
};

const dateOnlyStartMillis = (value: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const millis = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(millis) ? millis : null;
};

const dateOnlyEndMillis = (value: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const millis = new Date(`${value}T23:59:59.999`).getTime();
  return Number.isFinite(millis) ? millis : null;
};

const scoreMillisInDateRange = (value: unknown, range: MacraScoreboardDateRange): boolean => {
  const millis = scoreMillis(value);
  const start = dateOnlyStartMillis(range.start);
  const end = dateOnlyEndMillis(range.end);
  return Boolean(millis && start !== null && end !== null && millis >= start && millis <= end);
};

const emailLogMillis = (log: Record<string, any>): number | null =>
  maxScoreMillis(log.updatedAt, log.createdAt, log.sentAt, log.openedAt, log.clickedAt, log.lastClickAt, log.lastEventAt);

const MACRA_SCOREBOARD_ACTIVITY_SIGNAL_KEYS: Array<keyof MacraScoreboardSignals> = [
  'onboardingCompletedAt',
  'paywallLastViewedAt',
  'ctaTappedAt',
  'checkoutStartedAt',
  'appleCancelAt',
  'webOfferSentAt',
  'webOfferOpenedAt',
  'webOfferCheckoutStartedAt',
  'webOfferConvertedAt',
  'webOfferPaidAt',
  'stripeRetargetClickedAt',
  'trialStartedAt',
  'paidAt',
  'appsFlyerTrialStartedAt',
  'appsFlyerPurchaseAt',
];

const macraScoreboardUserHasDateRangeActivity = (user: MacraScoreboardUser, range: MacraScoreboardDateRange): boolean =>
  MACRA_SCOREBOARD_ACTIVITY_SIGNAL_KEYS.some((key) => scoreMillisInDateRange(user.signals[key], range));

const mergeScoreboardNumberMap = (target: Record<string, number>, source: Record<string, any> | null | undefined) => {
  Object.entries(source || {}).forEach(([key, value]) => {
    const count = Number(value || 0);
    if (!key || !Number.isFinite(count) || count === 0) return;
    target[key] = (target[key] || 0) + count;
  });
};

const scoreboardTopEntriesFromMap = (source: Record<string, number>, limitCount = 8) =>
  Object.entries(source)
    .map(([label, count]) => ({ label, count }))
    .filter((row) => row.label && Number.isFinite(row.count) && row.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limitCount);

const appsFlyerAggregatePeriodFitsRange = (periodStart: string, periodEnd: string, range: MacraScoreboardDateRange): boolean =>
  Boolean(periodStart && periodEnd && periodStart >= range.start && periodEnd <= range.end);

const buildAppsFlyerAggregateSummaryForRange = (
  baseSummary: Record<string, any> | null,
  periodDocs: Record<string, any>[],
  range: MacraScoreboardDateRange
): Record<string, any> | null => {
  if (!baseSummary && !periodDocs.length) return null;

  const selectedPeriods = periodDocs
    .map((period) => {
      const periodStart = normalizeScoreboardString(period.periodStart);
      const periodEnd = normalizeScoreboardString(period.periodEnd);
      const summary = (period.summary || {}) as Record<string, any>;
      return {
        id: normalizeScoreboardString(period.id) || `${periodStart}_${periodEnd}`,
        periodStart,
        periodEnd,
        importedAt: period.importedAt || period.updatedAt || null,
        summary,
      };
    })
    .filter((period) => period.summary && appsFlyerAggregatePeriodFitsRange(period.periodStart, period.periodEnd, range))
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));

  const fallbackAggregateSummary = (baseSummary?.aggregateCsvSummary || {}) as Record<string, any>;
  if (!selectedPeriods.length && appsFlyerAggregatePeriodFitsRange(normalizeScoreboardString(fallbackAggregateSummary.from), normalizeScoreboardString(fallbackAggregateSummary.to), range)) {
    selectedPeriods.push({
      id: 'aggregateCsvSummary',
      periodStart: normalizeScoreboardString(fallbackAggregateSummary.from),
      periodEnd: normalizeScoreboardString(fallbackAggregateSummary.to),
      importedAt: baseSummary?.importedAt || baseSummary?.updatedAt || null,
      summary: fallbackAggregateSummary,
    });
  }

  const eventsByName: Record<string, number> = {};
  const eventMediaSources: Record<string, number> = {};
  const installMediaSources: Record<string, number> = {};
  const installCampaigns: Record<string, number> = {};
  const reports: Record<string, number> = {};
  let rows = 0;
  let maximumRows = 0;
  let duplicateRows = 0;
  let importedUserDocs = 0;
  let matchedCustomerUserRows = 0;
  let unmatchedRows = 0;
  let eventTotal = 0;
  let installTotal = 0;
  let organicInstalls = 0;
  let nonOrganicInstalls = 0;
  let latestImportedAt: unknown = null;
  let appId = normalizeScoreboardString(baseSummary?.appId || getNestedValue(baseSummary || {}, 'aggregateCsvSummary.appId'));

  selectedPeriods.forEach((period) => {
    const summary = period.summary;
    rows += Number(summary.rows || 0) || 0;
    maximumRows += Number(summary.maximumRows || summary.rows || 0) || 0;
    duplicateRows += Number(summary.duplicateRows || 0) || 0;
    importedUserDocs += Number(summary.importedUserDocs || 0) || 0;
    matchedCustomerUserRows += Number(summary.matchedCustomerUserRows || 0) || 0;
    unmatchedRows += Number(summary.unmatchedRows || 0) || 0;
    eventTotal += Number(getNestedValue(summary, 'events.total') || 0) || 0;
    installTotal += Number(getNestedValue(summary, 'installs.total') || 0) || 0;
    organicInstalls += Number(getNestedValue(summary, 'installs.organic') || 0) || 0;
    nonOrganicInstalls += Number(getNestedValue(summary, 'installs.nonOrganic') || 0) || 0;
    mergeScoreboardNumberMap(eventsByName, getNestedValue(summary, 'events.byName'));
    mergeScoreboardNumberMap(eventMediaSources, getNestedValue(summary, 'events.byMediaSource'));
    mergeScoreboardNumberMap(installMediaSources, getNestedValue(summary, 'installs.byMediaSource'));
    mergeScoreboardNumberMap(installCampaigns, getNestedValue(summary, 'installs.byCampaign'));
    mergeScoreboardNumberMap(reports, summary.reports);
    appId = appId || normalizeScoreboardString(summary.appId);
    if (period.importedAt && (!latestImportedAt || (scoreMillis(period.importedAt) || 0) > (scoreMillis(latestImportedAt) || 0))) {
      latestImportedAt = period.importedAt;
    }
  });

  const periodRows = selectedPeriods.map((period) => ({
    id: period.id,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    rows: Number(period.summary.rows || 0) || 0,
    events: Number(getNestedValue(period.summary, 'events.total') || 0) || 0,
    installs: Number(getNestedValue(period.summary, 'installs.total') || 0) || 0,
    trialStarts: MACRA_APPSFLYER_TRIAL_EVENT_NAMES.reduce(
      (total, eventName) => total + Number(getNestedValue(period.summary, `events.byName.${eventName}`) || 0),
      0
    ),
    importedAt: period.importedAt,
  }));
  const coverageStart = periodRows[0]?.periodStart || range.start;
  const coverageEnd = periodRows[periodRows.length - 1]?.periodEnd || range.end;
  const topMediaSources = scoreboardTopEntriesFromMap(eventTotal ? eventMediaSources : installMediaSources);
  const aggregateCsvSummary = {
    id: 'macra',
    product: 'macra',
    provider: 'appsflyer',
    source: 'csv_upload',
    importSource: 'aggregate_csv_upload',
    appId,
    from: coverageStart,
    to: coverageEnd,
    rows,
    maximumRows,
    duplicateRows,
    importedUserDocs,
    matchedCustomerUserRows,
    unmatchedRows,
    tokenSource: '',
    daysBack: range.daysBack,
    timezone: 'aggregate_csv_periods',
    reports,
    installs: {
      total: installTotal,
      organic: organicInstalls,
      nonOrganic: nonOrganicInstalls,
      byMediaSource: installMediaSources,
      byCampaign: installCampaigns,
    },
    events: {
      total: eventTotal,
      byName: eventsByName,
      byMediaSource: eventMediaSources,
    },
    topMediaSources,
    topCampaigns: scoreboardTopEntriesFromMap(installCampaigns),
    topEvents: scoreboardTopEntriesFromMap(eventsByName),
    importedAt: latestImportedAt,
    updatedAt: latestImportedAt,
  };

  return {
    ...aggregateCsvSummary,
    rawCumulativeSummary: baseSummary?.rawCumulativeSummary || null,
    latestRunId: baseSummary?.latestRunId || '',
    latestRunSummary: selectedPeriods.length === 1 ? selectedPeriods[0].summary : aggregateCsvSummary,
    aggregateCsvSummary,
    aggregateCsvPeriods: periodRows,
    aggregateCsvPeriodCount: periodRows.length,
    aggregateCsvCoverageStart: periodRows.length ? coverageStart : null,
    aggregateCsvCoverageEnd: periodRows.length ? coverageEnd : null,
  };
};

const getFirstString = (sources: Array<Record<string, any> | null | undefined>, paths: string[]): string => {
  for (const source of sources) {
    for (const path of paths) {
      const value = path.includes('.') ? getNestedValue(source, path) : source?.[path];
      const normalized = normalizeScoreboardString(value);
      if (normalized) return normalized;
    }
  }
  return '';
};

const getFirstNumber = (sources: Array<Record<string, any> | null | undefined>, paths: string[]): number | null => {
  for (const source of sources) {
    for (const path of paths) {
      const value = path.includes('.') ? getNestedValue(source, path) : source?.[path];
      const parsed = scoreNumber(value);
      if (parsed !== null) return parsed;
    }
  }
  return null;
};

const getFirstMillis = (sources: Array<Record<string, any> | null | undefined>, paths: string[]): number | null => {
  for (const source of sources) {
    for (const path of paths) {
      const value = path.includes('.') ? getNestedValue(source, path) : source?.[path];
      const millis = scoreMillis(value);
      if (millis) return millis;
    }
  }
  return null;
};

const inferAgeYears = (data: Record<string, any>, profile: Record<string, any> | null, purchaseLogs: Record<string, any>[]): number | null => {
  const directAge = getFirstNumber([profile, data], [
    'ageYears',
    'age',
    'macraAgeYears',
    'macraProfile.ageYears',
    'macraProfile.age',
  ]);
  if (directAge !== null && directAge >= 0 && directAge < 120) return Math.floor(directAge);

  for (const log of purchaseLogs) {
    const metadataAge = getFirstNumber([log], ['metadata.age_years', 'cancelFeedbackMetadata.age_years']);
    if (metadataAge !== null && metadataAge >= 0 && metadataAge < 120) return Math.floor(metadataAge);
  }

  const birthdateMs = getFirstMillis([profile, data], [
    'birthdate',
    'dateOfBirth',
    'dob',
    'macraProfile.birthdate',
    'macraProfile.dateOfBirth',
  ]);
  if (!birthdateMs) return null;

  const ageMs = Date.now() - birthdateMs;
  const ageYears = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  return ageYears >= 0 && ageYears < 120 ? ageYears : null;
};

const latestEmailMillis = (logs: Record<string, any>[], predicate: (log: Record<string, any>) => boolean, fields: string[]): number | null =>
  maxScoreMillis(
    ...logs
      .filter(predicate)
      .flatMap((log) => fields.map((field) => (field.includes('.') ? getNestedValue(log, field) : log[field])))
  );

const purchaseLogMillis = (log: Record<string, any>): number | null =>
  maxScoreMillis(log.updatedAtEpoch, log.createdAtEpoch, log.updatedAt, log.createdAt, log.sentAt, log.lastEventAt);

const purchaseLogStartedMillis = (log: Record<string, any>): number | null =>
  maxScoreMillis(
    log.createdAtEpoch,
    log.createdAt,
    log.startedAtEpoch,
    log.startedAt,
    getNestedValue(log, 'metadata.checkout_started_at'),
    getNestedValue(log, 'metadata.checkoutStartedAt')
  ) || purchaseLogMillis(log);

const normalizePurchaseStatus = (value: unknown): string => normalizeScoreboardString(value).toLowerCase();

const purchaseStatusIsSuccess = (status: string): boolean =>
  ['success', 'succeeded', 'paid', 'active', 'trial_started', 'trialing'].includes(status);

const purchaseStatusIsCanceled = (status: string): boolean =>
  ['canceled', 'cancelled', 'user_cancelled', 'abandoned'].includes(status);

const purchaseLogTrialDays = (log: Record<string, any>): number | null =>
  positiveScoreNumber(log.trialDays) ||
  positiveScoreNumber(getNestedValue(log, 'plan.trialDays')) ||
  positiveScoreNumber(getNestedValue(log, 'metadata.trial_days')) ||
  positiveScoreNumber(getNestedValue(log, 'metadata.trialDays'));

const purchaseLogSourceText = (log: Record<string, any>): string => {
  const metadata = (log.metadata || {}) as Record<string, any>;
  return [
    log.source,
    log.provider,
    log.platform,
    metadata.source,
    metadata.channel,
    metadata.checkout_source,
    metadata.checkoutSource,
    metadata.purchase_channel,
    metadata.purchaseChannel,
    metadata.checkout_provider,
    metadata.checkoutProvider,
  ]
    .map((value) => normalizeScoreboardString(value).toLowerCase())
    .filter(Boolean)
    .join(' ');
};

const purchaseLogIsCheckoutLifecycle = (log: Record<string, any>): boolean => {
  const sourceText = purchaseLogSourceText(log);
  if (!sourceText) return true;
  if (sourceText.includes('restore')) return false;
  return [
    'checkout',
    'paywall',
    'purchase',
    'subscription',
    'storekit',
    'stripe',
    'revenuecat',
    'macra_ios',
    'macra_retarget',
    'web_offer',
  ].some((token) => sourceText.includes(token));
};

const matchesUserOrEmail = (row: Record<string, any>, userId: string, email: string): boolean => {
  const rowUserId = normalizeScoreboardString(row.userId || row.uid || row.authUid || row.appUserId);
  if (rowUserId && rowUserId === userId) return true;

  const rowEmail = normalizeScoreboardString(row.email || row.toEmail || row.recipientEmail || row.to);
  return Boolean(email && rowEmail && rowEmail.toLowerCase() === email.toLowerCase());
};

const purchaseLogIsRetargetingOffer = (log: Record<string, any>): boolean => {
  const metadata = (log.metadata || {}) as Record<string, any>;
  const source = normalizeScoreboardString(
    log.source ||
      metadata.source ||
      metadata.checkout_source ||
      metadata.checkoutSource ||
      metadata.purchase_channel ||
      metadata.channel
  ).toLowerCase();
  const campaignId = normalizeScoreboardString(
    log.campaignId ||
      log.offerId ||
      metadata.campaignId ||
      metadata.campaign_id ||
      metadata.offerId ||
      metadata.offer_id
  );
  return (
    source.includes('macra_retarget') ||
    source.includes('macra_web_offer') ||
    source.includes('web_offer') ||
    campaignId === MACRA_WEB_OFFER_SEQUENCE_ID
  );
};

const appsFlyerEventCount = (appsFlyer: Record<string, any> | null | undefined, eventNames: string[]): number =>
  eventNames.reduce((total, eventName) => total + (scoreNumber(getNestedValue(appsFlyer, `eventCounts.${eventName}`)) || 0), 0);

const appsFlyerLatestEventAt = (appsFlyer: Record<string, any> | null | undefined, eventNames: string[]): number | null =>
  maxScoreMillis(...eventNames.map((eventName) => getNestedValue(appsFlyer, `eventLatestAt.${eventName}`)));

const appsFlyerSummaryEventCount = (appsFlyerSummary: Record<string, any>, eventNames: string[]): number =>
  eventNames.reduce((total, eventName) => total + Number(getNestedValue(appsFlyerSummary, `events.byName.${eventName}`) || 0), 0);

const macraRetargetingDelayHours = (config: Record<string, any> | null | undefined, delayField: string, fallback: number): number => {
  const value = scoreNumber(config?.[delayField]);
  return value !== null && value >= 0 ? value : fallback;
};

const macraRetargetingRuleResolved = (state: Record<string, any>, stateKey: string): boolean =>
  Boolean(state[`${stateKey}SentAt`] || state[`${stateKey}SkippedAt`]);

const macraRetargetingRulePending = (state: Record<string, any>, stateKey: string): boolean =>
  Boolean(getNestedValue(state, `${stateKey}Pending.runId`) || state[`${stateKey}Pending`]);

const buildMacraNextRetargetingEmail = (args: {
  step: typeof MACRA_RETARGETING_FUNNEL_STEPS[keyof typeof MACRA_RETARGETING_FUNNEL_STEPS];
  state: Record<string, any>;
  config: Record<string, any> | null | undefined;
  anchorAt: number | null;
  reason: string;
  latestRetargetingSentAt: number | null;
  nowMs: number;
}): MacraNextRetargetingEmail | null => {
  if (!args.anchorAt || macraRetargetingRuleResolved(args.state, args.step.stateKey)) return null;

  const delayHours = macraRetargetingDelayHours(args.config, args.step.delayField, args.step.defaultDelayHours);
  const cooldownHours = Math.max(0, macraRetargetingDelayHours(args.config, 'cooldownHours', 24));
  const dueByRule = args.anchorAt + delayHours * 60 * 60 * 1000;
  const dueByCooldown = args.latestRetargetingSentAt ? args.latestRetargetingSentAt + cooldownHours * 60 * 60 * 1000 : 0;
  const dueAt = Math.max(dueByRule, dueByCooldown);
  const pending = macraRetargetingRulePending(args.state, args.step.stateKey);

  return {
    sequenceId: args.step.sequenceId,
    stateKey: args.step.stateKey,
    label: args.step.label,
    reason: args.reason,
    dueAt,
    anchorAt: args.anchorAt,
    status: pending ? 'pending' : dueAt <= args.nowMs ? 'ready' : 'scheduled',
    canSendNow: !pending,
  };
};

const buildMacraScoreboardUser = (args: {
  id: string;
  data: Record<string, any>;
  profile: Record<string, any> | null;
  appsFlyer: Record<string, any> | null;
  config: Record<string, any> | null;
  emailLogs: Record<string, any>[];
  purchaseLogs: Record<string, any>[];
}): MacraScoreboardUser => {
  const { id, data, profile, appsFlyer, config, emailLogs, purchaseLogs } = args;
  const profileSources = [profile, data.macraProfile, getNestedValue(data, 'macra.profile'), data];
  const email = normalizeScoreboardString(data.email);
  const displayName = getFirstString([data], ['firstName', 'displayName', 'username', 'name']) || email || id;
  const state = (data.macraEmailSequenceState || {}) as Record<string, any>;
  const retargetingLogs = emailLogs.filter((log) => {
    const sequenceId = normalizeScoreboardString(log.sequenceId || log.campaignId || log.templateId);
    const product = normalizeScoreboardString(log.product || log.app).toLowerCase();
    return product === 'macra' || sequenceId.startsWith('macra-') || MACRA_RETARGETING_SEQUENCE_IDS.includes(sequenceId);
  });

  const statuses = purchaseLogs.map((log) => ({
    log,
    status: normalizePurchaseStatus(log.purchaseStatus || log.status),
    millis: purchaseLogMillis(log),
    startedMillis: purchaseLogStartedMillis(log),
    isCheckoutLifecycle: purchaseLogIsCheckoutLifecycle(log),
  }));
  const checkoutStatuses = statuses.filter((row) => row.isCheckoutLifecycle);
  const retargetingStatuses = statuses.filter((row) => purchaseLogIsRetargetingOffer(row.log));
  const latestCheckoutStartedAt = maxScoreMillis(
    ...checkoutStatuses.map((row) => row.startedMillis || row.millis)
  );
  const latestAttemptedAt = maxScoreMillis(
    ...statuses
      .filter((row) => row.status === 'attempted' || row.status === 'started' || row.status === 'initiated')
      .map((row) => row.startedMillis || row.millis),
    latestCheckoutStartedAt
  );
  const latestCanceledAt = maxScoreMillis(
    ...statuses
      .filter((row) => purchaseStatusIsCanceled(row.status))
      .map((row) => row.millis)
  );
  const latestSucceededAt = maxScoreMillis(
    ...statuses
      .filter((row) => purchaseStatusIsSuccess(row.status))
      .map((row) => row.millis)
  );
  const latestTrialSucceededAt = maxScoreMillis(
    ...statuses
      .filter((row) => purchaseStatusIsSuccess(row.status) && (purchaseLogTrialDays(row.log) || row.status.includes('trial')))
      .map((row) => row.millis)
  );
  const latestRetargetingCheckoutStartedAt = maxScoreMillis(
    ...retargetingStatuses.map((row) => row.startedMillis || row.millis)
  );
  const latestRetargetingTrialSucceededAt = maxScoreMillis(
    ...retargetingStatuses
      .filter((row) => purchaseStatusIsSuccess(row.status) && (purchaseLogTrialDays(row.log) || row.status.includes('trial')))
      .map((row) => row.millis)
  );
  const latestRetargetingPaidStatus = retargetingStatuses
    .filter((row) => purchaseStatusIsSuccess(row.status) && !purchaseLogTrialDays(row.log) && !row.status.includes('trial'))
    .sort((a, b) => (b.millis || 0) - (a.millis || 0))[0];
  const latestRetargetingPaidAt = latestRetargetingPaidStatus?.millis || null;

  const ageYears = inferAgeYears(data, profile, purchaseLogs);
  const completedOnboarding = data.hasCompletedMacraOnboarding === true;
  const onboardingCompletedAt = getFirstMillis([data], ['macraOnboardingCompletedAt', 'createdAt', 'updatedAt']);
  const currentWeightKg = getFirstNumber(profileSources, ['currentWeightKg']);
  const goalWeightKg = getFirstNumber(profileSources, ['goalWeightKg']);
  const goalDirection = getFirstString(profileSources, ['goalDirection']);
  const pace = getFirstString(profileSources, ['pace']);
  const activityLevel = getFirstString(profileSources, ['activityLevel']);
  const biggestStruggle = getFirstString(profileSources, ['biggestStruggle']);
  const currentWeightRealistic = currentWeightKg !== null && currentWeightKg >= 35 && currentWeightKg <= 250;
  const goalWeightRealistic = goalWeightKg !== null && goalWeightKg >= 35 && goalWeightKg <= 250;
  const goalDeltaKg = currentWeightKg !== null && goalWeightKg !== null ? Math.abs(goalWeightKg - currentWeightKg) : null;
  const hasRealisticGoal =
    currentWeightRealistic &&
    goalWeightRealistic &&
    goalDeltaKg !== null &&
    goalDeltaKg <= Math.max(80, (currentWeightKg || 0) * 0.55) &&
    Boolean(goalDirection && pace && activityLevel && biggestStruggle);

  const macroCalories = getFirstNumber([data, profile], [
    'macros.personal.calories',
    'macroTargets.calories',
    'macraMacroTargets.calories',
    'planMacros.calories',
    'dailyCalorieTarget',
    'calorieTarget',
    'targetCalories',
  ]);
  const macroProtein = getFirstNumber([data, profile], [
    'macros.personal.protein',
    'macroTargets.protein',
    'macraMacroTargets.protein',
    'planMacros.protein',
    'proteinGrams',
    'targetProtein',
  ]);
  const macroCarbs = getFirstNumber([data, profile], [
    'macros.personal.carbs',
    'macroTargets.carbs',
    'macraMacroTargets.carbs',
    'planMacros.carbs',
    'carbsGrams',
    'targetCarbs',
  ]);
  const macroFat = getFirstNumber([data, profile], [
    'macros.personal.fat',
    'macroTargets.fat',
    'macraMacroTargets.fat',
    'planMacros.fat',
    'fatGrams',
    'targetFat',
  ]);
  const hasMacroTarget = Boolean(
    (macroCalories !== null && macroCalories >= 900 && macroCalories <= 6000) ||
      [macroProtein, macroCarbs, macroFat].filter((value) => value !== null && value > 0).length >= 2
  );

  const paywallViewCount = Math.max(
    scoreNumber(data.macraPaywallViewCount) || 0,
    scoreNumber(getNestedValue(data, 'macraPaywall.viewCount')) || 0,
    scoreNumber(getNestedValue(data, 'macraAnalytics.paywallViewCount')) || 0,
    scoreNumber(state.paywallViewCount) || 0,
    scoreNumber(getNestedValue(state, 'paywallView.count')) || 0
  );
  const paywallLastViewedAt = maxScoreMillis(
    data.macraLatestPaywallViewedAt,
    data.macraPaywallViewedAt,
    data.macraOnboardingPaywallReachedAt,
    data.macraPaywallReachedAt,
    getNestedValue(data, 'macraPaywall.lastViewedAt'),
    getNestedValue(data, 'macraAnalytics.lastPaywallViewedAt'),
    state.paywallViewedAt,
    state.paywallLastViewedAt,
    getNestedValue(state, 'paywallView.lastViewedAt')
  );
  const explicitPaywallSignal = Boolean(paywallViewCount > 0 || paywallLastViewedAt);
  const reachedPaywall = Boolean(explicitPaywallSignal || completedOnboarding);
  const checkoutStartedAt = maxScoreMillis(
    data.macraCheckoutStartedAt,
    data.macraPaywallCheckoutStartedAt,
    getNestedValue(data, 'macraPaywall.checkoutStartedAt'),
    getNestedValue(data, 'macraAnalytics.checkoutStartedAt'),
    state.checkoutStartedAt,
    state.paywallCheckoutStartedAt,
    latestAttemptedAt
  );
  const ctaTappedAt = maxScoreMillis(
    data.macraPaywallCtaTappedAt,
    data.macraPaywallPrimaryButtonPressedAt,
    getNestedValue(data, 'macraPaywall.ctaTappedAt'),
    getNestedValue(data, 'macraAnalytics.paywallPrimaryButtonPressedAt'),
    state.paywallCtaTappedAt,
    state.paywallPrimaryButtonPressedAt,
    checkoutStartedAt
  );
  const appleCancelAt = maxScoreMillis(
    data.macraLatestPaywallCancelFeedbackAt,
    getNestedValue(data, 'macraLatestPaywallCancelFeedback.capturedAt'),
    latestCanceledAt
  );
  const webOfferOpenedAt = maxScoreMillis(
    state.webOffer24hOpenedAt,
    latestEmailMillis(
      retargetingLogs,
      (log) => normalizeScoreboardString(log.sequenceId || log.campaignId) === MACRA_WEB_OFFER_SEQUENCE_ID,
      ['openedAt', 'lastEventAt', 'updatedAt']
    )
  );
  const webOfferSentAt = maxScoreMillis(
    state.webOffer24hSentAt,
    latestEmailMillis(
      retargetingLogs,
      (log) => normalizeScoreboardString(log.sequenceId || log.campaignId) === MACRA_WEB_OFFER_SEQUENCE_ID,
      ['sentAt', 'createdAt', 'updatedAt']
    )
  );
  const webOfferCheckoutStartedAt = maxScoreMillis(state.webOffer24hCheckoutStartedAt, latestRetargetingCheckoutStartedAt);
  const webOfferConvertedAt = maxScoreMillis(
    state.webOffer24hConvertedAt,
    state.webOffer24hCheckoutCompletedAt,
    latestRetargetingTrialSucceededAt
  );
  const webOfferTrialEndAt = maxScoreMillis(state.webOffer24hTrialEndAt, webOfferConvertedAt ? data.trialEndDate : null);
  const webOfferTrialDays = positiveScoreNumber(state.webOffer24hTrialDays) || (webOfferConvertedAt ? 30 : null);
  const latestRetargetingPaidLog = (latestRetargetingPaidStatus?.log || {}) as Record<string, any>;
  const webOfferPaidAt = maxScoreMillis(state.webOffer24hPaidAt, state.webOffer24hFirstPaidAt, latestRetargetingPaidAt);
  const webOfferPaidAmount =
    positiveScoreNumber(state.webOffer24hPaidAmount) ||
    positiveScoreNumber(getNestedValue(latestRetargetingPaidLog, 'metadata.amount_paid')) ||
    positiveScoreNumber(getNestedValue(latestRetargetingPaidLog, 'plan.price'));
  const webOfferPaidCurrency = normalizeScoreboardString(
    state.webOffer24hPaidCurrency ||
      getNestedValue(latestRetargetingPaidLog, 'metadata.currency') ||
      state.webOffer24hPriceCurrency
  ).toUpperCase();
  const webOfferPlan =
    normalizeScoreboardString(state.webOffer24hPlan) ||
    normalizeScoreboardString(getNestedValue(latestRetargetingPaidLog, 'plan.period')) ||
    normalizeScoreboardString(getNestedValue(latestRetargetingPaidLog, 'plan.title')) ||
    normalizeScoreboardString(getNestedValue(latestRetargetingPaidLog, 'plan.id'));
  const stripeRetargetClickedAt = maxScoreMillis(
    state.webOffer24hClickedAt,
    state.webOfferProofClickedAt,
    latestEmailMillis(
      retargetingLogs,
      (log) => {
        const sequenceId = normalizeScoreboardString(log.sequenceId || log.campaignId);
        return sequenceId === MACRA_WEB_OFFER_SEQUENCE_ID || sequenceId === 'macra-web-offer-proof-v1';
      },
      ['clickedAt', 'lastClickAt', 'lastEventAt']
    )
  );
  const appsFlyerStartTrialEvents = appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_TRIAL_EVENT_NAMES);
  const appsFlyerPurchaseEvents = appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_PURCHASE_EVENT_NAMES);
  const appsFlyerTrialStartedAt = appsFlyerLatestEventAt(appsFlyer, MACRA_APPSFLYER_TRIAL_EVENT_NAMES);
  const appsFlyerPurchaseAt = appsFlyerLatestEventAt(appsFlyer, MACRA_APPSFLYER_PURCHASE_EVENT_NAMES);
  const trialEndAt = scoreMillis(data.trialEndDate);
  const rootTrialing = Boolean(data.isTrialing && trialEndAt && trialEndAt > Date.now());
  const trialStartedAt = maxScoreMillis(
    data.trialStartDate,
    data.macraTrialStartedAt,
    webOfferConvertedAt,
    appsFlyerTrialStartedAt,
    latestTrialSucceededAt,
    rootTrialing && trialEndAt ? trialEndAt - 30 * 24 * 60 * 60 * 1000 : null
  );
  const subscriptionStatus = normalizeScoreboardString(data.subscriptionStatus || data.macraSubscriptionStatus || data.revenueCatStatus).toLowerCase();
  const activeSubscriptionFlag = Boolean(
    data.isSubscribed ||
      data.hasActiveSubscription ||
      data.macraSubscriptionActive ||
      data.hasMacraPlus ||
      ['active', 'paid', 'subscribed', 'premium'].includes(subscriptionStatus)
  );
  const paidAt = maxScoreMillis(
    data.subscriptionStartedAt,
    data.macraSubscriptionStartedAt,
    webOfferPaidAt,
    appsFlyerPurchaseAt,
    activeSubscriptionFlag && !rootTrialing ? data.updatedAt : null,
    latestSucceededAt && latestSucceededAt !== latestTrialSucceededAt ? latestSucceededAt : null
  );
  const latestIntentAt = maxScoreMillis(
    paidAt,
    trialStartedAt,
    appleCancelAt,
    ctaTappedAt,
    checkoutStartedAt,
    webOfferCheckoutStartedAt,
    stripeRetargetClickedAt,
    webOfferOpenedAt,
    paywallLastViewedAt,
    onboardingCompletedAt
  );

  const disqualifiers: string[] = [];
  if (ageYears !== null && ageYears < 18) disqualifiers.push('under_18');
  if (ageYears === null) disqualifiers.push('missing_age');
  if (!profile) disqualifiers.push('missing_profile');
  if (currentWeightKg === null) disqualifiers.push('missing_current_weight');
  if (goalWeightKg === null) disqualifiers.push('missing_goal_weight');
  if ((currentWeightKg !== null && !currentWeightRealistic) || (goalWeightKg !== null && !goalWeightRealistic)) disqualifiers.push('unrealistic_goal');
  if (!goalDirection) disqualifiers.push('missing_goal_direction');
  if (!pace) disqualifiers.push('missing_pace');
  if (!activityLevel) disqualifiers.push('missing_activity_level');
  if (!biggestStruggle) disqualifiers.push('missing_biggest_struggle');
  if (!hasMacroTarget) disqualifiers.push('missing_macro_target');
  if (!reachedPaywall) disqualifiers.push('no_paywall_signal');

  const highIntent = Boolean(ctaTappedAt || appleCancelAt || webOfferCheckoutStartedAt || stripeRetargetClickedAt || webOfferOpenedAt || paywallViewCount >= 2);
  const seriousPlanCompleter =
    completedOnboarding &&
    ageYears !== null &&
    ageYears >= 18 &&
    Boolean(profile) &&
    hasRealisticGoal &&
    hasMacroTarget &&
    reachedPaywall;
  const excluded = disqualifiers.includes('under_18') || disqualifiers.includes('unrealistic_goal');

  let tier: MacraScoreboardTier = 'curiosity';
  if (paidAt) tier = 'paid';
  else if (trialStartedAt) tier = 'trial_started';
  else if (excluded) tier = 'excluded';
  else if (seriousPlanCompleter && highIntent) tier = 'high_intent_recovery';
  else if (seriousPlanCompleter) tier = 'serious_plan_completer';
  else if (completedOnboarding || profile) tier = 'onboarding_completer';

  let suggestedLane = '24h web offer';
  if (webOfferPaidAt) suggestedLane = 'Paid after offer';
  else if (webOfferConvertedAt) suggestedLane = 'Offer redeemed';
  else if (paidAt) suggestedLane = 'Converted';
  else if (trialStartedAt) suggestedLane = 'Trial activation';
  else if (appleCancelAt || ctaTappedAt) suggestedLane = 'Apple trust recovery';
  else if (stripeRetargetClickedAt || webOfferOpenedAt) suggestedLane = 'Proof follow-up';
  else if (paywallViewCount >= 2) suggestedLane = 'Paywall value email';
  else if (onboardingCompletedAt && Date.now() - onboardingCompletedAt >= 7 * 24 * 60 * 60 * 1000) suggestedLane = '7-day meal challenge';

  const nowMs = Date.now();
  const latestRetargetingSentAt = maxScoreMillis(...MACRA_RETARGETING_SENT_STATE_FIELDS.map((field) => state[field]));
  const webOfferEngagedAt = maxScoreMillis(state.webOffer24hClickedAt, state.webOffer24hOpenedAt, stripeRetargetClickedAt, webOfferOpenedAt);
  const nextRetargetingEmail = (() => {
    if (paidAt || trialStartedAt || excluded || ageYears === null || data.macraEmailPreferences?.retargeting === false) return null;

    const paywallCancelNext = buildMacraNextRetargetingEmail({
      step: MACRA_RETARGETING_FUNNEL_STEPS.paywallCancelTrust,
      state,
      config,
      anchorAt: maxScoreMillis(appleCancelAt, ctaTappedAt),
      reason: appleCancelAt ? 'Apple sheet cancelled' : 'CTA tapped, no trial',
      latestRetargetingSentAt,
      nowMs,
    });
    if (paywallCancelNext) return paywallCancelNext;

    const webOfferProofNext = webOfferSentAt && webOfferEngagedAt && !webOfferCheckoutStartedAt && !webOfferConvertedAt
      ? buildMacraNextRetargetingEmail({
          step: MACRA_RETARGETING_FUNNEL_STEPS.webOfferProof,
          state,
          config,
          anchorAt: webOfferEngagedAt,
          reason: state.webOffer24hClickedAt || stripeRetargetClickedAt ? 'Offer clicked, no checkout' : 'Offer opened, no checkout',
          latestRetargetingSentAt,
          nowMs,
        })
      : null;
    if (webOfferProofNext) return webOfferProofNext;

    const paywallViewMinCount = Math.max(1, scoreNumber(config?.paywallViewMinCount) || 2);
    const paywallViewNext =
      paywallViewCount >= paywallViewMinCount && paywallLastViewedAt && !latestAttemptedAt && !latestCanceledAt && !latestSucceededAt
        ? buildMacraNextRetargetingEmail({
            step: MACRA_RETARGETING_FUNNEL_STEPS.paywallViewValue,
            state,
            config,
            anchorAt: paywallLastViewedAt,
            reason: `${paywallViewCount} paywall views, no CTA`,
            latestRetargetingSentAt,
            nowMs,
          })
        : null;
    if (paywallViewNext) return paywallViewNext;

    return buildMacraNextRetargetingEmail({
      step: MACRA_RETARGETING_FUNNEL_STEPS.noTrial7dChallenge,
      state,
      config,
      anchorAt: onboardingCompletedAt,
      reason: 'No trial after onboarding',
      latestRetargetingSentAt,
      nowMs,
    });
  })();

  const signals: MacraScoreboardSignals = {
    ageYears,
    completedOnboarding,
    hasProfile: Boolean(profile),
    hasRealisticGoal,
    hasMacroTarget,
    reachedPaywall,
    explicitPaywallSignal,
    paywallViewCount,
    paywallLastViewedAt,
    ctaTappedAt,
    checkoutStartedAt,
    appleCancelAt,
    webOfferSentAt,
    webOfferOpenedAt,
    webOfferCheckoutStartedAt,
    webOfferConvertedAt,
    webOfferTrialEndAt,
    webOfferTrialDays,
    webOfferPaidAt,
    webOfferPaidAmount,
    webOfferPaidCurrency,
    webOfferPlan,
    stripeRetargetClickedAt,
    trialStartedAt,
    paidAt,
    appsFlyerTrialStartedAt,
    appsFlyerPurchaseAt,
    appsFlyerStartTrialEvents,
    appsFlyerPurchaseEvents,
    onboardingCompletedAt,
    latestIntentAt,
    currentWeightKg,
    goalWeightKg,
    goalDirection,
    pace,
    activityLevel,
    biggestStruggle,
    macroCalories,
  };

  return {
    id,
    email,
    displayName,
    tier,
    tierLabel: MACRA_TIER_LABELS[tier],
    isQualified: MACRA_QUALIFIED_TIERS.has(tier),
    isHighIntent: highIntent,
    suggestedLane,
    nextRetargetingEmail,
    disqualifiers,
    signals,
  };
};

const SEQUENCES: SequenceRow[] = [
  {
    id: 'welcome-v1',
    name: 'Welcome to Pulse',
    trigger: 'On registration (new user created)',
    defaultSubject: 'Welcome to Pulse — you’re in',
    functionPath: '/.netlify/functions/send-welcome-email',
    templateDocId: 'welcome-v1',
  },
  {
    id: 'username-reminder-v1',
    name: 'Forgot Username Reminder',
    trigger: 'User forgot to select username (registration incomplete after ~30 minutes)',
    defaultSubject: 'Finish setting up your Pulse account',
    functionPath: '/.netlify/functions/send-username-reminder-email',
    templateDocId: 'username-reminder-v1',
    scheduleConfigDocId: 'username-reminder-v1',
    scheduleDescription: 'Configurable daily UTC send window',
    defaultScheduleEnabled: true,
  },
  {
    id: 'new-follower-v1',
    name: 'New Follower Notification',
    trigger: 'When someone follows a user',
    defaultSubject: '{{followerName}} is now following you on Pulse',
    functionPath: '/.netlify/functions/send-new-follower-email',
    templateDocId: 'new-follower-v1',
  },
  {
    id: 'coach-connection-v1',
    name: 'Coach Connection Notification',
    trigger: 'When an athlete subscribes and connects with a coach',
    defaultSubject: '{{athleteName}} just connected with you on PulseCheck',
    functionPath: '/.netlify/functions/send-coach-connection-email',
    templateDocId: 'coach-connection-v1',
  },
  {
    id: 'pulsecheck-pilot-activation-v1',
    name: 'PulseCheck Pilot Activation',
    trigger: 'Manual from the PulseCheck pilot dashboard when an athlete is admitted and needs to reopen the app to finish consent',
    defaultSubject: '{{teamName}} access is ready in PulseCheck',
    functionPath: '/.netlify/functions/send-pulsecheck-pilot-activation-email',
    templateDocId: 'pulsecheck-pilot-activation-v1',
  },
  {
    id: 'winner-notification-v1',
    name: 'Winner Notification',
    trigger: 'When prize distribution is confirmed for challenge winners',
    defaultSubject: '🏆 You won ${{prizeAmount}} in {{challengeTitle}}!',
    functionPath: '/.netlify/functions/send-winner-notification-email',
    templateDocId: 'winner-notification-v1',
  },
  {
    id: 'approval-v1',
    name: 'Approval Notification',
    trigger: 'When a creator / coach application is approved',
    defaultSubject: "Congratulations, {{firstName}}! You're approved for Pulse Programming",
    functionPath: '/.netlify/functions/send-approval-email',
    templateDocId: 'approval-v1',
  },
  {
    id: 'joined-round-no-workout-v1',
    name: 'Joined Round, No First Workout',
    trigger: '24h after joining a Round with no completed workouts',
    defaultSubject: 'Your Round is waiting - start your first workout',
    functionPath: '/.netlify/functions/send-joined-round-no-workout-email',
    templateDocId: 'joined-round-no-workout-v1',
    scheduleConfigDocId: 'joined-round-no-workout-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends after the 24h no-workout delay',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'first-workout-celebration-v1',
    name: 'First Workout Completion Celebration',
    trigger: 'On first completed workout in a Round',
    defaultSubject: 'You completed your first workout - keep it rolling',
    functionPath: '/.netlify/functions/send-first-workout-celebration-email',
    templateDocId: 'first-workout-celebration-v1',
    scheduleConfigDocId: 'first-workout-celebration-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; detects recent first workout completions',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'streak-milestone-v1',
    name: 'Streak Milestones',
    trigger: 'When user reaches a 3, 7, 14, or 30-day streak',
    defaultSubject: '🔥 {{milestone}}-day streak - keep it alive',
    functionPath: '/.netlify/functions/send-streak-milestone-email',
    templateDocId: 'streak-milestone-v1',
    scheduleConfigDocId: 'streak-milestone-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends 3/7/14/30-day streak milestones',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'challenge-ending-soon-v1',
    name: 'Challenge Ending Soon',
    trigger: '72h and 24h before challenge end',
    defaultSubject: '{{hoursRemaining}}h left in {{challengeTitle}} - finish strong',
    functionPath: '/.netlify/functions/send-challenge-ending-soon-email',
    templateDocId: 'challenge-ending-soon-v1',
    scheduleConfigDocId: 'challenge-ending-soon-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends at roughly 72h and 24h remaining',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'irl-event-analytics-report-v1',
    name: 'IRL Event Analytics Report',
    trigger: '~1 hour after IRL event ends',
    defaultSubject: 'Your {{eventTitle}} analytics report',
    functionPath: '/.netlify/functions/send-irl-event-analytics-report-email',
    templateDocId: 'irl-event-analytics-report-v1',
    scheduleConfigDocId: 'irl-event-analytics-report-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends host report about 1 hour after an event ends',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'inactivity-winback-v1',
    name: 'Inactivity Winback',
    trigger: '3d, 7d, and 14d since last meaningful activity',
    defaultSubject: "Let's get you back in motion on Pulse",
    functionPath: '/.netlify/functions/send-inactivity-winback-email',
    templateDocId: 'inactivity-winback-v1',
    scheduleConfigDocId: 'inactivity-winback-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends at 3/7/14 days of inactivity',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'password-reset-v1',
    name: 'Password Reset',
    trigger: 'When user requests password reset',
    defaultSubject: 'Reset your Pulse password',
    functionPath: '/.netlify/functions/send-password-reset-email',
    templateDocId: 'password-reset-v1',
  },
  {
    id: 'error-alerts-v1',
    name: 'Error Alert Emails',
    trigger: 'On new Firestore error log creation (`errorLogs/{logId}`)',
    defaultSubject: '[Pulse Error Alert] {{source}} ({{username}})',
    functionPath: '',
    templateDocId: 'error-alerts-v1',
    deliveryRuntime: 'firebase',
    supportsTemplateEditing: false,
    supportsTestSend: false,
    openInAdminPath: '/admin/ErrorLogs',
    openInAdminLabel: 'Open error logs',
  },
  // ── Macra Nutrition ───────────────────────────────────
  {
    id: 'macra-welcome-v1',
    name: 'Macra Welcome',
    trigger: 'Fires once when a user finishes the Macra onboarding notification-preferences step (iOS) — plus an hourly server-side sweep that catches users whose client-side send never landed. Idempotent via users.macraWelcomeEmailSentAt.',
    defaultSubject: 'Welcome to Macra — your plan is ready',
    functionPath: '/.netlify/functions/send-macra-welcome-email',
    templateDocId: 'macra-welcome-v1',
    scheduleConfigDocId: 'macra-welcome-v1',
    scheduleDescription: 'Netlify cron: hourly safety-net sweep for missed client-side welcome sends',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'macra-tips-v1',
    name: 'Macra Tips Series',
    trigger: 'Scheduled function. Sends tip emails on day 2, day 4, and day 7 after Macra onboarding completion.',
    defaultSubject: 'Nora tip: {{tipTitle}}',
    functionPath: '/.netlify/functions/send-macra-tips-email',
    templateDocId: 'macra-tips-v1',
    scheduleConfigDocId: 'macra-tips-v1',
    scheduleDescription: 'Netlify cron: daily at 2:30 PM UTC',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'macra-inactivity-winback-v1',
    name: 'Macra Inactivity Winback',
    trigger: 'Scheduled function. Fires at 3, 7, and 14 days since last Macra food log.',
    defaultSubject: "You haven't logged in {{daysInactive}} days — Nora misses you",
    functionPath: '/.netlify/functions/send-macra-inactivity-email',
    templateDocId: 'macra-inactivity-winback-v1',
    scheduleConfigDocId: 'macra-inactivity-winback-v1',
    scheduleDescription: 'Netlify cron: daily at 3:00 PM UTC',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: MACRA_WEB_OFFER_SEQUENCE_ID,
    name: 'Macra Retargeting 1 - 24h Web Offer',
    trigger: 'Scheduled function. Sends once 24h after Macra onboarding when no active trial/subscription exists. Excludes missing-age and under-18 profiles. Checkout uses Stripe web, not StoreKit.',
    defaultSubject: 'Your Macra plan is ready, plus a free month',
    functionPath: '/.netlify/functions/send-macra-web-offer-email',
    templateDocId: 'macra-web-offer-24h-v1',
    scheduleConfigDocId: 'macra-web-offer-24h-v1',
    scheduleDescription: 'Netlify cron: hourly; sends only eligible users after the 24h delay',
    supportsScheduleTime: false,
    defaultScheduleEnabled: false,
    supportsCampaignConfig: true,
  },
  {
    id: 'macra-paywall-cancel-trust-v1',
    name: 'Macra Retargeting 2 - Paywall Cancel Trust',
    trigger: 'Shared scheduler. Sends after the paywall CTA was pressed and Apple purchase was cancelled or no trial started. Trust-focused message explaining Apple confirmation, visible renewal price, and no payment today.',
    defaultSubject: 'No payment today - Apple confirms the details first',
    functionPath: '/.netlify/functions/send-macra-paywall-cancel-trust-email',
    templateDocId: 'macra-paywall-cancel-trust-v1',
    scheduleConfigDocId: MACRA_RETARGETING_SEQUENCE_CONFIG_ID,
    scheduleDescription: 'Netlify cron: hourly shared scheduler for Macra retargeting rows 2-6; sends the next eligible email for each user.',
    supportsScheduleTime: false,
    defaultScheduleEnabled: false,
    supportsCampaignConfig: true,
  },
  {
    id: 'macra-web-offer-proof-v1',
    name: 'Macra Retargeting 3 - Offer Proof',
    trigger: 'Shared scheduler. Sends after the 24h web offer email is opened or clicked but no checkout starts. Proof-focused message using onboarding intent such as goal direction, biggest struggle, daily target, and meal plan count.',
    defaultSubject: 'Your Macra plan was built around your goal',
    functionPath: '/.netlify/functions/send-macra-web-offer-proof-email',
    templateDocId: 'macra-web-offer-proof-v1',
  },
  {
    id: 'macra-paywall-view-value-v1',
    name: 'Macra Retargeting 4 - Paywall View Value',
    trigger: 'Shared scheduler. Sends after multiple paywall views with no CTA tap and no trial. Value-objection recovery focused on one useful meal scan instead of another price push.',
    defaultSubject: 'Start with one useful scan today',
    functionPath: '/.netlify/functions/send-macra-paywall-view-value-email',
    templateDocId: 'macra-paywall-view-value-v1',
  },
  {
    id: 'macra-no-trial-7d-challenge-v1',
    name: 'Macra Retargeting 5 - 7d Meal Challenge',
    trigger: 'Shared scheduler. Sends 7 days after Macra onboarding when no trial/subscription exists and earlier retargeting did not convert. Softer one-real-meal challenge, no hard discount push.',
    defaultSubject: 'Try Macra with one real meal',
    functionPath: '/.netlify/functions/send-macra-no-trial-challenge-email',
    templateDocId: 'macra-no-trial-7d-challenge-v1',
  },
  {
    id: 'macra-trial-no-activation-24h-v1',
    name: 'Macra Retargeting 6 - Trial Activation',
    trigger: 'Shared scheduler. Sends 24h after trial start when no first Macra activation event exists, such as a meal scan, meal log, label scan, or Ask Nora message. Activation email focused on the first useful action.',
    defaultSubject: 'Your Macra trial is active - start with one meal',
    functionPath: '/.netlify/functions/send-macra-trial-activation-email',
    templateDocId: 'macra-trial-no-activation-24h-v1',
  },
];

const EmailSequencesAdmin: React.FC = () => {
  const dispatch = useDispatch();
  const currentUser = useUser();
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [activeAdminTab, setActiveAdminTab] = useState<'scoreboard' | 'sequences'>('scoreboard');
  const [seedingTemplates, setSeedingTemplates] = useState(false);
  const [macraScoreboard, setMacraScoreboard] = useState<MacraScoreboardState>({
    loading: false,
    error: '',
    loadedAt: null,
    config: null,
    appsFlyerSummary: null,
    users: [],
    userLimit: MACRA_SCOREBOARD_USER_LIMIT,
    emailLogCount: 0,
    purchaseLogCount: 0,
  });
  const [syncingAppsFlyer, setSyncingAppsFlyer] = useState(false);
  const [uploadingAppsFlyerCsv, setUploadingAppsFlyerCsv] = useState(false);
  const [appsFlyerCsvPeriodPreset, setAppsFlyerCsvPeriodPreset] = useState<MacraScoreboardRangePreset>(MACRA_SCOREBOARD_DEFAULT_RANGE_PRESET);
  const [appsFlyerCsvPeriodStart, setAppsFlyerCsvPeriodStart] = useState(() => buildMacraScoreboardDateRange(MACRA_SCOREBOARD_DEFAULT_RANGE_PRESET).start);
  const [appsFlyerCsvPeriodEnd, setAppsFlyerCsvPeriodEnd] = useState(() => buildMacraScoreboardDateRange(MACRA_SCOREBOARD_DEFAULT_RANGE_PRESET).end);

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [activeSequence, setActiveSequence] = useState<SequenceRow | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');
  const [testUserId, setTestUserId] = useState('');
  const [lastTestCheckoutUrl, setLastTestCheckoutUrl] = useState('');
  const [sending, setSending] = useState(false);
    const [copyingScoreboard, setCopyingScoreboard] = useState(false);
    const [sendingRetargetingNowUserId, setSendingRetargetingNowUserId] = useState<string | null>(null);
    const [runningRetargetingScheduler, setRunningRetargetingScheduler] = useState(false);

  const selectedMacraScoreboardRange = useMemo<MacraScoreboardDateRange>(() => {
    const option = MACRA_SCOREBOARD_RANGE_OPTIONS.find((row) => row.value === appsFlyerCsvPeriodPreset) || MACRA_SCOREBOARD_RANGE_OPTIONS[0];
    return {
      preset: appsFlyerCsvPeriodPreset,
      start: appsFlyerCsvPeriodStart,
      end: appsFlyerCsvPeriodEnd,
      label: option.label,
      daysBack: option.daysBack,
    };
  }, [appsFlyerCsvPeriodEnd, appsFlyerCsvPeriodPreset, appsFlyerCsvPeriodStart]);
  const selectedMacraScoreboardRangeLabel = useMemo(
    () => formatMacraScoreboardRangeLabel(selectedMacraScoreboardRange),
    [selectedMacraScoreboardRange]
  );

  // Template editing
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
  const [templateLoadedFromFirestore, setTemplateLoadedFromFirestore] = useState(false);
  const [templatePreviewSource, setTemplatePreviewSource] = useState<TemplatePreviewSource>('none');

  // Schedule config (daily send time)
  const [scheduleTimeById, setScheduleTimeById] = useState<Record<string, string>>({});
  const [scheduleEnabledById, setScheduleEnabledById] = useState<Record<string, boolean>>({});
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleEditingSequence, setScheduleEditingSequence] = useState<SequenceRow | null>(null);
  const [scheduleTimeDraft, setScheduleTimeDraft] = useState('14:00');
  const [scheduleEnabledDraft, setScheduleEnabledDraft] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingScheduleId, setSavingScheduleId] = useState<string | null>(null);
  const [campaignConfigById, setCampaignConfigById] = useState<Record<string, CampaignConfig>>({});
  const [delayHoursDraft, setDelayHoursDraft] = useState(String(DEFAULT_CAMPAIGN_CONFIG.delayHours));
  const [batchLimitDraft, setBatchLimitDraft] = useState(String(DEFAULT_CAMPAIGN_CONFIG.batchLimit));
  const [maxSendsPerRunDraft, setMaxSendsPerRunDraft] = useState(String(DEFAULT_CAMPAIGN_CONFIG.maxSendsPerRun));
  const [scanEveryHoursDraft, setScanEveryHoursDraft] = useState(String(DEFAULT_CAMPAIGN_CONFIG.scanEveryHours));
  const [sendWindowStartDraft, setSendWindowStartDraft] = useState(DEFAULT_CAMPAIGN_CONFIG.sendWindowStartLocal);
  const [sendWindowEndDraft, setSendWindowEndDraft] = useState(DEFAULT_CAMPAIGN_CONFIG.sendWindowEndLocal);

  const scheduleOptions = useMemo(() => {
    const out: string[] = [];
    for (let h = 0; h < 24; h++) {
      out.push(`${String(h).padStart(2, '0')}:00`);
      out.push(`${String(h).padStart(2, '0')}:30`);
    }
    return out;
  }, []);

  const loadMacraScoreboard = useCallback(async () => {
    const activeRange = selectedMacraScoreboardRange;
    setMacraScoreboard((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const [configSnap, usersSnap] = await Promise.all([
        getDoc(doc(db, 'email-sequence-config', MACRA_RETARGETING_SEQUENCE_CONFIG_ID)),
        getDocs(query(collection(db, 'users'), where('hasCompletedMacraOnboarding', '==', true), limit(MACRA_SCOREBOARD_USER_LIMIT))),
      ]);
      const [appsFlyerSummarySnap, appsFlyerAggregatePeriodsSnap] = await Promise.all([
        getDoc(doc(db, 'appsflyer-scoreboards', 'macra')).catch((error) => {
          console.warn('[EmailSequences] Failed to load AppsFlyer scoreboard summary', error);
          return null;
        }),
        getDocs(query(collection(db, 'appsflyer-aggregate-periods'), where('product', '==', 'macra'))).catch((error) => {
          console.warn('[EmailSequences] Failed to load AppsFlyer aggregate periods for selected range', error);
          return null;
        }),
      ]);
      const appsFlyerAggregatePeriodDocs = appsFlyerAggregatePeriodsSnap?.docs.map((snapshot) => ({
        id: snapshot.id,
        ...((snapshot.data() || {}) as Record<string, any>),
      })) || [];

      const userDocs = usersSnap.docs.map((snapshot) => ({
        id: snapshot.id,
        data: (snapshot.data() || {}) as Record<string, any>,
      }));
      let configData = configSnap.exists() ? ((configSnap.data() || {}) as Record<string, any>) : null;
      if (!configSnap.exists()) {
        const seededConfig = buildMacraRetargetingSchedulerDefaultConfig();
        try {
          await setDoc(
            doc(db, 'email-sequence-config', MACRA_RETARGETING_SEQUENCE_CONFIG_ID),
            {
              ...seededConfig,
              seededFrom: 'email-sequences-admin',
              seededAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          configData = seededConfig;
        } catch (error) {
          console.warn('[EmailSequences] Failed to seed Macra retargeting scheduler config', error);
        }
      }

      const loadRecentDocs = async (collectionName: string, orderField: string, rowLimit: number) => {
        try {
          const snap = await getDocs(query(collection(db, collectionName), orderBy(orderField, 'desc'), limit(rowLimit)));
          return snap.docs.map((snapshot) => ({ id: snapshot.id, ...((snapshot.data() || {}) as Record<string, any>) }));
        } catch (error) {
          console.warn(`[EmailSequences] Failed to load ${collectionName} for Macra scoreboard`, error);
          return [] as Record<string, any>[];
        }
      };

      const loadProfiles = async () => {
        const entries: Array<[string, Record<string, any> | null]> = [];
        for (let i = 0; i < userDocs.length; i += MACRA_SCOREBOARD_PROFILE_CHUNK_SIZE) {
          const chunk = userDocs.slice(i, i + MACRA_SCOREBOARD_PROFILE_CHUNK_SIZE);
          const resolved = await Promise.all(
            chunk.map(async (user) => {
              try {
                const profileSnap = await getDoc(doc(db, 'users', user.id, 'macra', 'profile'));
                return [user.id, profileSnap.exists() ? ((profileSnap.data() || {}) as Record<string, any>) : null] as [string, Record<string, any> | null];
              } catch (error) {
                console.warn('[EmailSequences] Failed to load Macra profile for scoreboard', user.id, error);
                return [user.id, null] as [string, Record<string, any> | null];
              }
            })
          );
          entries.push(...resolved);
        }
        return Object.fromEntries(entries) as Record<string, Record<string, any> | null>;
      };

      const loadAppsFlyerAttribution = async () => {
        const byUserId: Record<string, AppsFlyerAttributionDoc | null> = {};
        userDocs.forEach((user) => {
          byUserId[user.id] = null;
        });

        for (let i = 0; i < userDocs.length; i += MACRA_SCOREBOARD_ATTRIBUTION_CHUNK_SIZE) {
          const chunk = userDocs.slice(i, i + MACRA_SCOREBOARD_ATTRIBUTION_CHUNK_SIZE);
          const userIds = chunk.map((user) => user.id).filter(Boolean);
          if (!userIds.length) continue;

          try {
            const attributionSnap = await getDocs(
              query(collection(db, 'appsflyer-macra-users'), where('customerUserId', 'in', userIds))
            );
            attributionSnap.docs.forEach((snapshot) => {
              const data: AppsFlyerAttributionDoc = { id: snapshot.id, ...((snapshot.data() || {}) as Record<string, any>) };
              const customerUserId = normalizeScoreboardString(data.customerUserId);
              if (customerUserId) byUserId[customerUserId] = data;
            });
          } catch (error) {
            console.warn('[EmailSequences] Failed to load AppsFlyer attribution chunk for scoreboard', error);
          }

          await Promise.all(
            chunk
              .filter((user) => !byUserId[user.id])
              .map(async (user) => {
                try {
                  const directSnap = await getDoc(doc(db, 'appsflyer-macra-users', user.id));
                  if (directSnap.exists()) {
                    byUserId[user.id] = { id: directSnap.id, ...((directSnap.data() || {}) as Record<string, any>) } as AppsFlyerAttributionDoc;
                  }
                } catch (error) {
                  console.warn('[EmailSequences] Failed to load direct AppsFlyer attribution for scoreboard', user.id, error);
                }
              })
          );
        }

        return byUserId;
      };

      const [profileByUserId, appsFlyerByUserId, emailLogs, purchaseLogs] = await Promise.all([
        loadProfiles(),
        loadAppsFlyerAttribution(),
        loadRecentDocs('email-logs', 'updatedAt', MACRA_SCOREBOARD_LOG_LIMIT),
        loadRecentDocs('Macra-purchase-logs', 'createdAt', MACRA_SCOREBOARD_LOG_LIMIT),
      ]);

      const emailLogsInRange = emailLogs.filter((log) => scoreMillisInDateRange(emailLogMillis(log), activeRange));
      const purchaseLogsInRange = purchaseLogs.filter(
        (log) => scoreMillisInDateRange(purchaseLogMillis(log), activeRange) || scoreMillisInDateRange(purchaseLogStartedMillis(log), activeRange)
      );
      const appsFlyerBaseSummary = appsFlyerSummarySnap?.exists() ? ((appsFlyerSummarySnap.data() || {}) as Record<string, any>) : null;
      const appsFlyerSummaryForRange = buildAppsFlyerAggregateSummaryForRange(appsFlyerBaseSummary, appsFlyerAggregatePeriodDocs, activeRange);
      const allUsers = userDocs.map((user) => {
        const email = normalizeScoreboardString(user.data.email);
        const userEmailLogs = emailLogsInRange.filter((log) => matchesUserOrEmail(log, user.id, email));
        const userPurchaseLogs = purchaseLogsInRange.filter((log) => matchesUserOrEmail(log, user.id, email));
        return buildMacraScoreboardUser({
          id: user.id,
          data: user.data,
          profile: profileByUserId[user.id] || null,
          appsFlyer: appsFlyerByUserId[user.id] || null,
          config: configData,
          emailLogs: userEmailLogs,
          purchaseLogs: userPurchaseLogs,
        });
      });
      const users = allUsers.filter((user) => macraScoreboardUserHasDateRangeActivity(user, activeRange));

      setMacraScoreboard({
        loading: false,
        error: '',
        loadedAt: new Date(),
        config: configData,
        appsFlyerSummary: appsFlyerSummaryForRange,
        users,
        userLimit: MACRA_SCOREBOARD_USER_LIMIT,
        emailLogCount: emailLogsInRange.length,
        purchaseLogCount: purchaseLogsInRange.length,
      });
    } catch (e: any) {
      setMacraScoreboard((prev) => ({
        ...prev,
        loading: false,
        error: e?.message || 'Failed to load Macra retargeting scoreboard',
      }));
    }
  }, [selectedMacraScoreboardRange]);

  useEffect(() => {
    loadMacraScoreboard();
  }, [loadMacraScoreboard]);

  useEffect(() => {
    // Load schedule times for sequences that support scheduling (UTC time)
    const load = async () => {
      try {
        const updates: Record<string, string> = {};
        const enabledUpdates: Record<string, boolean> = {};
        const campaignConfigUpdates: Record<string, CampaignConfig> = {};
          for (const seq of SEQUENCES) {
            if (!seq.scheduleConfigDocId) continue;
            const ref = doc(db, 'email-sequence-config', seq.scheduleConfigDocId);
            const snap = await getDoc(ref);
            let scheduleDocExists = snap.exists();
            let data = snap.exists() ? ((snap.data() || {}) as any) : {};
            if (!snap.exists() && seq.scheduleConfigDocId === MACRA_RETARGETING_SEQUENCE_CONFIG_ID) {
              data = buildMacraRetargetingSchedulerDefaultConfig();
              await setDoc(
                ref,
                {
                  ...data,
                  seededFrom: 'email-sequences-admin',
                  seededAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
              scheduleDocExists = true;
            }
            const time = (data?.sendTimeUtc as string) || '';
            updates[seq.id] = (time || '14:00').trim();
            enabledUpdates[seq.id] = scheduleDocExists
              ? seq.defaultScheduleEnabled === false
                ? data?.enabled === true
                : data?.enabled !== false
            : seq.defaultScheduleEnabled === true;
          if (hasCampaignControls(seq)) {
            campaignConfigUpdates[seq.id] = normalizeCampaignConfig(data);
          }
        }
        setScheduleTimeById(updates);
        setScheduleEnabledById(enabledUpdates);
        setCampaignConfigById(campaignConfigUpdates);
      } catch (_) {
        // Non-blocking; default values will display
      }
    };
    load();
  }, []);

  const defaultTemplatePreview = useMemo(
    () => (activeSequence ? buildDefaultEmailTemplate(activeSequence, templateSubject, 'preview') : EMPTY_TEMPLATE_PREVIEW),
    [activeSequence, templateSubject]
  );
  const hasTemplateHtml = Boolean(templateHtml.trim());
  const effectivePreviewSource: TemplatePreviewSource = hasTemplateHtml
    ? templatePreviewSource
    : defaultTemplatePreview.source;
  const previewSourceLabel = getPreviewSourceLabel(effectivePreviewSource);
  const previewSrcDoc = useMemo(() => {
    if (templateHtml.trim()) return applyPreviewTemplateValues(templateHtml);
    return defaultTemplatePreview.html;
  }, [defaultTemplatePreview.html, templateHtml]);

  const openTestModal = (seq: SequenceRow) => {
    setActiveSequence(seq);
    setTestEmail('');
    setTestName('');
    setTestUserId('');
    setLastTestCheckoutUrl('');
    setIsTestModalOpen(true);
    setMessage(null);
  };

  const isScheduleEnabled = (seq: SequenceRow) =>
    scheduleEnabledById[seq.id] ?? (seq.defaultScheduleEnabled === true);

  const getCampaignConfig = (seq: SequenceRow): CampaignConfig =>
    campaignConfigById[seq.id] || DEFAULT_CAMPAIGN_CONFIG;

  const openScheduleModal = (seq: SequenceRow) => {
    setScheduleEditingSequence(seq);
    const existing = scheduleTimeById[seq.id] || '14:00';
    const campaignConfig = getCampaignConfig(seq);
    setScheduleTimeDraft(existing);
    setScheduleEnabledDraft(isScheduleEnabled(seq));
    setDelayHoursDraft(String(campaignConfig.delayHours));
    setBatchLimitDraft(String(campaignConfig.batchLimit));
    setMaxSendsPerRunDraft(String(campaignConfig.maxSendsPerRun));
    setScanEveryHoursDraft(String(campaignConfig.scanEveryHours));
    setSendWindowStartDraft(campaignConfig.sendWindowStartLocal);
    setSendWindowEndDraft(campaignConfig.sendWindowEndLocal);
    setIsScheduleModalOpen(true);
    setMessage(null);
  };

  const saveScheduleTime = async () => {
    if (!scheduleEditingSequence?.scheduleConfigDocId) return;
    const t = (scheduleTimeDraft || '').trim();
    if (scheduleEditingSequence.supportsScheduleTime !== false && !/^\d{2}:\d{2}$/.test(t)) {
      setMessage({ type: 'error', text: 'Invalid time format' });
      return;
    }

      let nextCampaignConfig: (CampaignConfig & Record<string, any>) | null = null;
    if (hasCampaignControls(scheduleEditingSequence)) {
      const delayHours = parseIntegerDraft(delayHoursDraft);
      const batchLimit = parseIntegerDraft(batchLimitDraft);
      const maxSendsPerRun = parseIntegerDraft(maxSendsPerRunDraft);
      const scanEveryHours = parseIntegerDraft(scanEveryHoursDraft);
      const sendWindowStartLocal = normalizeLocalTime(sendWindowStartDraft, '');
      const sendWindowEndLocal = normalizeLocalTime(sendWindowEndDraft, '');

      if (!delayHours || delayHours < 1 || delayHours > 168) {
        setMessage({
          type: 'error',
          text: scheduleEditingSequence.scheduleConfigDocId === MACRA_RETARGETING_SEQUENCE_CONFIG_ID
            ? 'Cooldown must be between 1 and 168 hours.'
            : 'Delay must be between 1 and 168 hours.',
        });
        return;
      }
      if (!batchLimit || batchLimit < 25 || batchLimit > 1000) {
        setMessage({ type: 'error', text: 'Batch limit must be between 25 and 1000 users.' });
        return;
      }
      if (!maxSendsPerRun || maxSendsPerRun < 1 || maxSendsPerRun > 500) {
        setMessage({ type: 'error', text: 'Max sends per run must be between 1 and 500.' });
        return;
      }
      if (maxSendsPerRun > batchLimit) {
        setMessage({ type: 'error', text: 'Max sends per run cannot be higher than the batch limit.' });
        return;
      }
      if (!scanEveryHours || scanEveryHours < 1 || scanEveryHours > 24) {
        setMessage({ type: 'error', text: 'Scan frequency must be between 1 and 24 hours.' });
        return;
      }
      if (!sendWindowStartLocal || !sendWindowEndLocal) {
        setMessage({ type: 'error', text: 'Send window times must use HH:MM format.' });
        return;
      }

        nextCampaignConfig = {
          delayHours,
          ...(scheduleConfigIsRetargeting ? { cooldownHours: delayHours } : {}),
          batchLimit,
          maxSendsPerRun,
        scanEveryHours,
        sendWindowStartLocal,
        sendWindowEndLocal,
        sendWindowTimezone: CAMPAIGN_SEND_WINDOW_TIMEZONE,
      };
    }

    setSavingSchedule(true);
    try {
      const ref = doc(db, 'email-sequence-config', scheduleEditingSequence.scheduleConfigDocId);
      await setDoc(
        ref,
        {
          id: scheduleEditingSequence.scheduleConfigDocId,
          ...(scheduleEditingSequence.supportsScheduleTime === false ? {} : { sendTimeUtc: t }),
          ...(nextCampaignConfig || {}),
          enabled: scheduleEnabledDraft,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setScheduleTimeById((prev) => ({ ...prev, [scheduleEditingSequence.id]: t || prev[scheduleEditingSequence.id] || '14:00' }));
      setScheduleEnabledById((prev) => ({ ...prev, [scheduleEditingSequence.id]: scheduleEnabledDraft }));
      if (nextCampaignConfig) {
        setCampaignConfigById((prev) => ({ ...prev, [scheduleEditingSequence.id]: nextCampaignConfig }));
      }
      setMessage({
        type: 'success',
        text: nextCampaignConfig
          ? `${scheduleEditingSequence.name} ${scheduleEnabledDraft ? 'enabled' : 'paused'} with ${nextCampaignConfig.maxSendsPerRun} max sends per run every ${nextCampaignConfig.scanEveryHours}h.`
          : `${scheduleEditingSequence.name} ${scheduleEnabledDraft ? 'enabled' : 'paused'}${scheduleEditingSequence.supportsScheduleTime === false ? '' : ` at ${t} UTC`}.`,
      });
      setIsScheduleModalOpen(false);
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to save scheduled time' });
    } finally {
      setSavingSchedule(false);
    }
  };

  const toggleScheduleEnabled = async (seq: SequenceRow) => {
    if (!seq.scheduleConfigDocId) return;
    const nextEnabled = !isScheduleEnabled(seq);
    setSavingScheduleId(seq.id);
    setMessage(null);
    try {
      const ref = doc(db, 'email-sequence-config', seq.scheduleConfigDocId);
      await setDoc(
        ref,
        {
          id: seq.scheduleConfigDocId,
          enabled: nextEnabled,
          ...(seq.supportsScheduleTime === false ? {} : { sendTimeUtc: scheduleTimeById[seq.id] || '14:00' }),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setScheduleEnabledById((prev) => ({ ...prev, [seq.id]: nextEnabled }));
      setMessage({ type: 'success', text: `${seq.name} ${nextEnabled ? 'enabled' : 'paused'}.` });
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to update automation status' });
    } finally {
      setSavingScheduleId(null);
    }
  };

  const scheduleConfigIsRetargeting = scheduleEditingSequence?.scheduleConfigDocId === MACRA_RETARGETING_SEQUENCE_CONFIG_ID;

  const saveDefaultTemplateForSequence = async (seq: SequenceRow, subjectOverride?: string, docExists = false) => {
    const ref = doc(db, 'email-templates', seq.templateDocId);
    const seedTemplate = buildEditableDefaultTemplate(seq, subjectOverride);
    const nextSubject = (subjectOverride || seedTemplate.subject || seq.defaultSubject).trim();
    const seededBy = currentUser?.email || currentUser?.username || currentUser?.id || 'admin';

    await setDoc(
      ref,
      {
        id: seq.templateDocId,
        sequenceId: seq.id,
        subject: nextSubject,
        html: seedTemplate.html,
        seededFrom: 'email-sequences-admin',
        seededFromSource: seedTemplate.source,
        seededBy,
        seededAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(docExists ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true }
    );

    return { ...seedTemplate, subject: nextSubject };
  };

  const loadTemplate = async (seq: SequenceRow) => {
    setLoadingTemplate(true);
    setTemplateLoadedFromFirestore(false);
    setTemplatePreviewSource('none');
    try {
      const ref = doc(db, 'email-templates', seq.templateDocId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        const loadedHtml = (data?.html as string) || '';
        const loadedSubject = (data?.subject as string) || seq.defaultSubject;
        const hasSavedHtml = Boolean(loadedHtml.trim());
        const seededTemplate = hasSavedHtml ? null : await saveDefaultTemplateForSequence(seq, loadedSubject, true);
        setTemplateSubject(loadedSubject);
        setTemplateHtml(hasSavedHtml ? loadedHtml : seededTemplate?.html || '');
        setTemplateLoadedFromFirestore(true);
        setTemplatePreviewSource('firestore');
      } else {
        const seededTemplate = await saveDefaultTemplateForSequence(seq);
        setTemplateSubject(seededTemplate.subject || seq.defaultSubject);
        setTemplateHtml(seededTemplate.html);
        setTemplateLoadedFromFirestore(true);
        setTemplatePreviewSource('firestore');
      }
    } catch (_e) {
      const editableDefault = buildEditableDefaultTemplate(seq);
      setTemplateSubject(editableDefault.subject || seq.defaultSubject);
      setTemplateHtml(editableDefault.html);
      setTemplateLoadedFromFirestore(false);
      setTemplatePreviewSource(editableDefault.source);
      setMessage({ type: 'error', text: 'Failed to load email template' });
    } finally {
      setLoadingTemplate(false);
    }
  };

  const seedMissingTemplates = async () => {
    setSeedingTemplates(true);
    setMessage(null);

    let created = 0;
    let repaired = 0;
    let skipped = 0;
    let unsupported = 0;
    const seededTemplateIds: string[] = [];

    try {
      for (const seq of SEQUENCES) {
        if (seq.supportsTemplateEditing === false) {
          unsupported += 1;
          continue;
        }

        const ref = doc(db, 'email-templates', seq.templateDocId);
        const snap = await getDoc(ref);
        const data = snap.exists() ? ((snap.data() || {}) as any) : {};
        const existingSubject = typeof data?.subject === 'string' ? data.subject.trim() : '';
        const existingHtml = typeof data?.html === 'string' ? data.html.trim() : '';

        if (existingSubject && existingHtml) {
          skipped += 1;
          continue;
        }

        await saveDefaultTemplateForSequence(seq, existingSubject || undefined, snap.exists());
        seededTemplateIds.push(seq.templateDocId);
        if (snap.exists()) {
          repaired += 1;
        } else {
          created += 1;
        }
      }

      const repairedText = repaired ? ` Repaired ${repaired} empty template${repaired === 1 ? '' : 's'}.` : '';
      const unsupportedText = unsupported ? ` Skipped ${unsupported} non-editable sequence${unsupported === 1 ? '' : 's'}.` : '';
      setMessage({
        type: 'success',
        text: `Seeded ${created} missing template${created === 1 ? '' : 's'}.${repairedText} ${skipped} already had saved HTML.${unsupportedText}`,
      });

      if (activeSequence && seededTemplateIds.includes(activeSequence.templateDocId)) {
        await loadTemplate(activeSequence);
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to seed email templates' });
    } finally {
      setSeedingTemplates(false);
    }
  };

  const openEditModal = async (seq: SequenceRow) => {
    setActiveSequence(seq);
    setIsEditModalOpen(true);
    setMessage(null);
    await loadTemplate(seq);
  };

  const openRetargetingTemplatePreview = async (user: MacraScoreboardUser) => {
    const sequenceId = user.nextRetargetingEmail?.sequenceId;
    const sequence = SEQUENCES.find((seq) => seq.id === sequenceId || seq.templateDocId === sequenceId);
    if (!sequence) {
      setMessage({ type: 'error', text: 'No editable template was found for this retargeting email.' });
      return;
    }

    await openEditModal(sequence);
  };

  const saveTemplate = async () => {
    if (!activeSequence) return;
    if (!templateSubject.trim()) {
      setMessage({ type: 'error', text: 'Subject is required' });
      return;
    }
    if (!templateHtml.trim()) {
      setMessage({ type: 'error', text: 'HTML is required (paste your full HTML email)' });
      return;
    }

    setSavingTemplate(true);
    try {
      const ref = doc(db, 'email-templates', activeSequence.templateDocId);
      await setDoc(
        ref,
        {
          id: activeSequence.templateDocId,
          subject: templateSubject.trim(),
          html: templateHtml,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setTemplateLoadedFromFirestore(true);
      setTemplatePreviewSource('firestore');
      setMessage({ type: 'success', text: 'Template saved.' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to save template' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const copyHtmlToClipboard = async () => {
    try {
      const text = templateHtml || '';
      if (!text.trim()) {
        setMessage({ type: 'error', text: 'No HTML to copy' });
        return;
      }
      await navigator.clipboard.writeText(text);
      setMessage({ type: 'success', text: 'HTML copied to clipboard.' });
    } catch (_e) {
      // Fallback for older browsers / denied permissions
      try {
        const el = document.createElement('textarea');
        el.value = templateHtml || '';
        el.setAttribute('readonly', 'true');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setMessage({ type: 'success', text: 'HTML copied to clipboard.' });
      } catch {
        setMessage({ type: 'error', text: 'Failed to copy HTML to clipboard' });
      }
    }
  };

  const sendTest = async () => {
    if (!activeSequence) return;
    if (!testEmail.trim()) {
      setMessage({ type: 'error', text: 'Please enter a test email address' });
      return;
    }
    if (activeSequence.id === 'macra-web-offer-24h-v1' && !testUserId.trim()) {
      setMessage({ type: 'error', text: 'Macra web offer tests need a real user ID so the CTA can apply checkout to the correct account.' });
      return;
    }

    setSending(true);
    setMessage(null);
    setLastTestCheckoutUrl('');
    try {
      const resp = await fetch(activeSequence.functionPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: testEmail.trim(),
          firstName: testName.trim() || undefined,
          userId: testUserId.trim() || undefined,
          subjectOverride: templateSubject.trim() || undefined,
          htmlOverride: templateHtml.trim() || undefined,
          isTest: true,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.error || `Failed to send test email (HTTP ${resp.status})`);
      }
      const successMessage = 'Test email sent successfully.';
      setLastTestCheckoutUrl(typeof json?.checkoutUrl === 'string' ? json.checkoutUrl : '');
      setMessage({ type: 'success', text: successMessage });
      dispatch(showToast({ message: successMessage, type: 'success' }));
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to send test email';
      setMessage({ type: 'error', text: errorMessage });
      dispatch(showToast({ message: errorMessage, type: 'error', duration: 5000 }));
    } finally {
      setSending(false);
    }
  };

  const copyLastTestCheckoutUrl = async () => {
    if (!lastTestCheckoutUrl) return;
    await navigator.clipboard.writeText(lastTestCheckoutUrl);
    setMessage({ type: 'success', text: 'Generated offer link copied to clipboard.' });
  };

  const syncAppsFlyerRawData = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setMessage({ type: 'error', text: 'Sign in again before syncing AppsFlyer data.' });
      return;
    }

    setSyncingAppsFlyer(true);
    setMessage(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch('/.netlify/functions/sync-macra-appsflyer-raw-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          ...getFirebaseModeRequestHeaders(),
        },
        body: JSON.stringify({
          daysBack: selectedMacraScoreboardRange.daysBack || MACRA_APPSFLYER_SCOREBOARD_DAYS_BACK,
          maximumRows: 50000,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || `AppsFlyer sync failed (HTTP ${response.status})`);
      }
      const summary = json?.summary || {};
      setMessage({
        type: 'success',
        text: `AppsFlyer sync complete: ${Number(summary?.installs?.total || 0)} installs and ${Number(summary?.events?.total || 0)} events imported.`,
      });
      await loadMacraScoreboard();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to sync AppsFlyer raw data' });
    } finally {
      setSyncingAppsFlyer(false);
    }
  };

  const updateAppsFlyerCsvPeriodPreset = (preset: MacraScoreboardRangePreset) => {
    const nextRange = buildMacraScoreboardDateRange(preset);
    setAppsFlyerCsvPeriodPreset(preset);
    setAppsFlyerCsvPeriodStart(nextRange.start);
    setAppsFlyerCsvPeriodEnd(nextRange.end);
  };

    const uploadAppsFlyerCsvFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      event.target.value = '';
    if (!files.length) return;

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setMessage({ type: 'error', text: 'Sign in again before uploading AppsFlyer CSV data.' });
      return;
    }

    if (!appsFlyerCsvPeriodStart || !appsFlyerCsvPeriodEnd || appsFlyerCsvPeriodStart > appsFlyerCsvPeriodEnd) {
      setMessage({ type: 'error', text: 'Choose a valid AppsFlyer CSV date range before uploading.' });
      return;
    }

    setUploadingAppsFlyerCsv(true);
    setMessage(null);
    try {
      const csvFiles = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          lastModified: file.lastModified,
          content: await file.text(),
        }))
      );
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch('/.netlify/functions/sync-macra-appsflyer-raw-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          ...getFirebaseModeRequestHeaders(),
        },
        body: JSON.stringify({
          mode: 'csv_upload',
          csvFiles,
          csvPeriodPreset: appsFlyerCsvPeriodPreset,
          csvPeriodStart: appsFlyerCsvPeriodStart,
          csvPeriodEnd: appsFlyerCsvPeriodEnd,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || `AppsFlyer CSV upload failed (HTTP ${response.status})`);
      }

      const importedRows = Number(json?.importedRows || json?.summary?.rows || 0);
      const duplicateRows = Number(json?.duplicateRows || json?.summary?.duplicateRows || 0);
      const uploadedEventActions = Number(getNestedValue(json?.summary || {}, 'events.total') || 0);
      const uploadedTrialStarts = appsFlyerSummaryEventCount(json?.summary || {}, MACRA_APPSFLYER_TRIAL_EVENT_NAMES);
      const replacedPeriod = json?.replacedPeriod ? ` for ${appsFlyerCsvPeriodStart} to ${appsFlyerCsvPeriodEnd}` : '';
      setMessage({
        type: 'success',
        text: `AppsFlyer CSV import complete${replacedPeriod}: ${importedRows} rows saved${duplicateRows ? `, ${duplicateRows} duplicate rows skipped` : ''}${
          uploadedEventActions ? `, ${uploadedEventActions} event actions counted${uploadedTrialStarts ? `, including ${uploadedTrialStarts} trial starts` : ''}` : ''
        }.`,
      });
      await loadMacraScoreboard();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to upload AppsFlyer CSV data' });
    } finally {
        setUploadingAppsFlyerCsv(false);
      }
    };

    const runMacraRetargetingSchedulerNow = async () => {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        setMessage({ type: 'error', text: 'Sign in again before running the retargeting scheduler.' });
        return;
      }

      setRunningRetargetingScheduler(true);
      setMessage(null);
      try {
        const idToken = await firebaseUser.getIdToken();
        const response = await fetch('/.netlify/functions/schedule-macra-retargeting-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
            ...getFirebaseModeRequestHeaders(),
          },
          body: JSON.stringify({
            action: 'runNow',
            force: true,
          }),
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || json?.success === false) {
          throw new Error(json?.error || `Scheduler run failed (HTTP ${response.status})`);
        }

        const messageText = json?.disabled
          ? 'Macra retargeting scheduler is paused.'
          : `Macra retargeting scheduler verified: ${Number(json?.sent || 0)} sent, ${Number(json?.skipped || 0)} skipped, ${Number(json?.errors || 0)} errors.`;
        setMessage({ type: json?.disabled ? 'info' : 'success', text: messageText });
        dispatch(showToast({ message: messageText, type: json?.disabled ? 'info' : 'success' }));
        await loadMacraScoreboard();
      } catch (e: any) {
        const errorMessage = e?.message || 'Failed to run Macra retargeting scheduler';
        setMessage({ type: 'error', text: errorMessage });
        dispatch(showToast({ message: errorMessage, type: 'error', duration: 5000 }));
      } finally {
        setRunningRetargetingScheduler(false);
      }
    };

    const sendMacraRetargetingNow = async (user: MacraScoreboardUser) => {
    const nextEmail = user.nextRetargetingEmail;
    if (!nextEmail) {
      setMessage({ type: 'error', text: 'No retargeting email is available for this user yet.' });
      return;
    }

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setMessage({ type: 'error', text: 'Sign in again before sending a retargeting email.' });
      return;
    }

    setSendingRetargetingNowUserId(user.id);
    setMessage(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch('/.netlify/functions/schedule-macra-retargeting-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          ...getFirebaseModeRequestHeaders(),
        },
        body: JSON.stringify({
          action: 'sendNow',
          userId: user.id,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || `Send now failed (HTTP ${response.status})`);
      }

      const messageText = json?.skipped
        ? `${nextEmail.label} was skipped: ${json?.reason || 'already handled'}.`
        : `${nextEmail.label} sent to ${user.email || user.displayName}.`;
      setMessage({ type: json?.skipped ? 'info' : 'success', text: messageText });
      dispatch(showToast({ message: messageText, type: json?.skipped ? 'info' : 'success' }));
      await loadMacraScoreboard();
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to send retargeting email now';
      setMessage({ type: 'error', text: errorMessage });
      dispatch(showToast({ message: errorMessage, type: 'error', duration: 5000 }));
    } finally {
      setSendingRetargetingNowUserId(null);
    }
  };

  const activeTestRequiresUserId = activeSequence?.id === 'macra-web-offer-24h-v1';
  const macraScoreboardSummary = useMemo(() => {
    const users = macraScoreboard.users;
    const appsFlyerSummary = macraScoreboard.appsFlyerSummary || {};
    const appsFlyerInstalls = Number(getNestedValue(appsFlyerSummary, 'installs.total') || 0);
    const appsFlyerOrganicInstalls = Number(getNestedValue(appsFlyerSummary, 'installs.organic') || 0);
    const appsFlyerNonOrganicInstalls = Number(getNestedValue(appsFlyerSummary, 'installs.nonOrganic') || 0);
    const appsFlyerEvents = Number(getNestedValue(appsFlyerSummary, 'events.total') || 0);
    const appsFlyerPaywallEvents = appsFlyerSummaryEventCount(appsFlyerSummary, MACRA_APPSFLYER_PAYWALL_EVENT_NAMES);
    const appsFlyerPlanLoadedEvents = appsFlyerSummaryEventCount(appsFlyerSummary, MACRA_APPSFLYER_PLAN_LOADED_EVENT_NAMES);
    const appsFlyerPlanSelectedEvents = appsFlyerSummaryEventCount(appsFlyerSummary, MACRA_APPSFLYER_PLAN_SELECTED_EVENT_NAMES);
    const appsFlyerCtaEvents = appsFlyerSummaryEventCount(appsFlyerSummary, MACRA_APPSFLYER_CTA_EVENT_NAMES);
    const appsFlyerCheckoutEvents = appsFlyerSummaryEventCount(appsFlyerSummary, MACRA_APPSFLYER_CHECKOUT_EVENT_NAMES);
    const appsFlyerPurchaseCancelEvents = appsFlyerSummaryEventCount(appsFlyerSummary, MACRA_APPSFLYER_PURCHASE_CANCEL_EVENT_NAMES);
    const appsFlyerPurchaseFailedEvents = appsFlyerSummaryEventCount(appsFlyerSummary, MACRA_APPSFLYER_PURCHASE_FAILED_EVENT_NAMES);
    const appsFlyerStartTrialEvents = appsFlyerSummaryEventCount(appsFlyerSummary, MACRA_APPSFLYER_TRIAL_EVENT_NAMES);
    const appsFlyerSubscribeEvents = appsFlyerSummaryEventCount(appsFlyerSummary, ['af_subscribe', 'subscribe']);
    const appsFlyerPurchaseEvents = appsFlyerSummaryEventCount(appsFlyerSummary, ['af_purchase', 'purchase']);
    const appsFlyerMatchedRows = Number(appsFlyerSummary.matchedCustomerUserRows || 0);
    const appsFlyerTopMediaSources = Array.isArray(appsFlyerSummary.topMediaSources) ? appsFlyerSummary.topMediaSources : [];
    const appsFlyerTopCampaigns = Array.isArray(appsFlyerSummary.topCampaigns) ? appsFlyerSummary.topCampaigns : [];
    const appsFlyerTopEvents = Array.isArray(appsFlyerSummary.topEvents) ? appsFlyerSummary.topEvents : [];
    const appsFlyerAggregatePeriods = Array.isArray(appsFlyerSummary.aggregateCsvPeriods) ? appsFlyerSummary.aggregateCsvPeriods : [];
    const appsFlyerImportSource = normalizeScoreboardString(
      appsFlyerSummary.importSource || appsFlyerSummary.source || getNestedValue(appsFlyerSummary, 'latestRunSummary.importSource')
    );
    const appsFlyerReportKeys = Object.keys((appsFlyerSummary.reports || {}) as Record<string, any>);
    const appsFlyerIsAggregateCsv =
      Boolean(appsFlyerSummary.aggregateCsvSummary) ||
      appsFlyerImportSource === 'aggregate_csv_upload' ||
      appsFlyerImportSource === 'layered_raw_and_aggregate_csv' ||
      appsFlyerReportKeys.some((key) => key.includes('csv_aggregate_'));
    const appsFlyerEventSourceLabel = appsFlyerIsAggregateCsv ? 'AppsFlyer aggregate events' : 'AppsFlyer raw events';
    const appsFlyerEventCardLabel = appsFlyerIsAggregateCsv ? 'Aggregate events' : 'Raw events';
    const appsFlyerTrialCardLabel = appsFlyerIsAggregateCsv ? 'Aggregate trial starts' : 'Raw trial starts';
    const appsFlyerEventIdentityLabel = appsFlyerIsAggregateCsv
      ? 'CSV totals validate event volume; first-party data identifies qualified users'
      : `${appsFlyerMatchedRows} rows had a customer user ID`;
    const appsFlyerTopSourceUnit = appsFlyerInstalls ? 'installs' : 'events';
    const appsFlyerCoverageStart = normalizeScoreboardString(appsFlyerSummary.aggregateCsvCoverageStart);
    const appsFlyerCoverageEnd = normalizeScoreboardString(appsFlyerSummary.aggregateCsvCoverageEnd);
    const appsFlyerCoverageLabel =
      appsFlyerAggregatePeriods.length && appsFlyerCoverageStart && appsFlyerCoverageEnd
        ? `${formatDateOnlyLabel(appsFlyerCoverageStart)} to ${formatDateOnlyLabel(appsFlyerCoverageEnd)} · ${appsFlyerAggregatePeriods.length} saved ${appsFlyerAggregatePeriods.length === 1 ? 'period' : 'periods'}`
        : 'No aggregate CSV periods saved';
    const count = (predicate: (user: MacraScoreboardUser) => boolean) => users.filter(predicate).length;
    const signalInRange = (value: unknown) => scoreMillisInDateRange(value, selectedMacraScoreboardRange);
    const onboardingCompleters = count((user) => user.signals.completedOnboarding && signalInRange(user.signals.onboardingCompletedAt));
    const qualified = count((user) => user.isQualified && signalInRange(user.signals.onboardingCompletedAt));
    const seriousPlanCompleters = count((user) =>
      ['paid', 'trial_started', 'high_intent_recovery', 'serious_plan_completer'].includes(user.tier) &&
      signalInRange(user.signals.onboardingCompletedAt)
    );
    const highIntentSignalInRange = (user: MacraScoreboardUser) =>
      [
        user.signals.ctaTappedAt,
        user.signals.checkoutStartedAt,
        user.signals.appleCancelAt,
        user.signals.webOfferCheckoutStartedAt,
        user.signals.stripeRetargetClickedAt,
        user.signals.webOfferOpenedAt,
        user.signals.paywallLastViewedAt,
      ].some(signalInRange);
    const highIntentRecovery = count((user) => user.tier === 'high_intent_recovery' && highIntentSignalInRange(user));
    const qualifiedPaywallViews = count(
      (user) => user.isQualified && user.signals.reachedPaywall && (signalInRange(user.signals.paywallLastViewedAt) || signalInRange(user.signals.onboardingCompletedAt))
    );
    const qualifiedCtaTaps = count((user) => user.isQualified && signalInRange(user.signals.ctaTappedAt));
    const qualifiedCheckoutStarts = count((user) => user.isQualified && signalInRange(user.signals.checkoutStartedAt));
    const qualifiedAppleCancels = count((user) => user.isQualified && signalInRange(user.signals.appleCancelAt));
    const qualifiedTrialStarts = count((user) => user.isQualified && signalInRange(user.signals.trialStartedAt));
    const qualifiedPaid = count((user) => user.isQualified && signalInRange(user.signals.paidAt));
    const qualifiedStripeClicks = count((user) => user.isQualified && signalInRange(user.signals.stripeRetargetClickedAt));
    const appsFlyerQualifiedCtaLabel = appsFlyerIsAggregateCsv
      ? `${qualifiedCtaTaps} first-party qualified taps · ${appsFlyerCtaEvents} AppsFlyer aggregate events · ${appsFlyerCheckoutEvents} aggregate checkout starts`
      : `${qualifiedCtaTaps} matched qualified users · ${appsFlyerCtaEvents} AppsFlyer raw events · ${appsFlyerCheckoutEvents} checkout starts`;
    const appsFlyerQualifiedTrialLabel = appsFlyerIsAggregateCsv
      ? `${qualifiedTrialStarts} first-party qualified trial starts · ${appsFlyerStartTrialEvents} AppsFlyer aggregate events`
      : `${qualifiedTrialStarts} matched qualified users · ${appsFlyerStartTrialEvents} AppsFlyer raw events`;
    const webOfferSentUsers = count((user) => user.isQualified && signalInRange(user.signals.webOfferSentAt));
    const webOfferOpenedUsers = count((user) => user.isQualified && signalInRange(user.signals.webOfferOpenedAt));
    const webOfferCheckoutStarts = count((user) => user.isQualified && signalInRange(user.signals.webOfferCheckoutStartedAt));
    const retargetingRecoveredUsers = count(
      (user) => user.isQualified && (signalInRange(user.signals.webOfferConvertedAt) || signalInRange(user.signals.webOfferPaidAt))
    );
    const retargetingTrialRedemptions = count((user) => user.isQualified && signalInRange(user.signals.webOfferConvertedAt));
    const retargetingPaidConversions = count((user) => user.isQualified && signalInRange(user.signals.webOfferPaidAt));
    const retargetingRecoveredRevenue = users.reduce(
      (total, user) => total + (user.isQualified && signalInRange(user.signals.webOfferPaidAt) ? user.signals.webOfferPaidAmount || 0 : 0),
      0
    );
    const recoveryPool = users
      .filter((user) => user.isQualified && user.isHighIntent && highIntentSignalInRange(user) && !user.signals.trialStartedAt && !user.signals.paidAt)
      .sort((a, b) => (b.signals.latestIntentAt || 0) - (a.signals.latestIntentAt || 0))
      .slice(0, 10);
    const recoveredUsers = users
      .filter((user) => user.isQualified && (signalInRange(user.signals.webOfferConvertedAt) || signalInRange(user.signals.webOfferPaidAt)))
      .sort((a, b) => Math.max(b.signals.webOfferPaidAt || 0, b.signals.webOfferConvertedAt || 0) - Math.max(a.signals.webOfferPaidAt || 0, a.signals.webOfferConvertedAt || 0))
      .slice(0, 12);

    const tierRows = MACRA_TIER_ORDER.map((tier) => ({
      tier,
      label: MACRA_TIER_LABELS[tier],
      count: count((user) => user.tier === tier),
    })).filter((row) => row.count > 0);

    const disqualifierCounts = users.reduce<Record<string, number>>((acc, user) => {
      user.disqualifiers.forEach((key) => {
        acc[key] = (acc[key] || 0) + 1;
      });
      return acc;
    }, {});
    const disqualifierRows = Object.entries(disqualifierCounts)
      .map(([key, value]) => ({
        key,
        label: MACRA_DISQUALIFIER_LABELS[key] || titleizeScoreboardToken(key),
        count: value,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const lastScanSummary = (macraScoreboard.config?.lastScanSummary || {}) as Record<string, any>;
    const sentBySequence = Object.entries((lastScanSummary.sentBySequence || {}) as Record<string, number>).sort(
      (a, b) => Number(b[1]) - Number(a[1])
    );
    const skippedByReason = Object.entries((lastScanSummary.skippedByReason || {}) as Record<string, number>)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 6);
    const appsFlyerPaywallFunnelRows = [
      { label: 'Paywall reached', value: appsFlyerPaywallEvents, sublabel: 'Onboarding or standalone paywall views' },
      { label: 'Plans loaded', value: appsFlyerPlanLoadedEvents, sublabel: 'StoreKit plan sheet ready' },
      { label: 'Plan selected', value: appsFlyerPlanSelectedEvents, sublabel: 'Plan choice before Apple confirmation' },
      { label: 'Primary button pressed', value: appsFlyerCtaEvents, sublabel: 'AppsFlyer CTA tap events' },
      { label: 'Checkout started', value: appsFlyerCheckoutEvents, sublabel: 'AppsFlyer checkout initiation events' },
      { label: 'Purchase cancelled', value: appsFlyerPurchaseCancelEvents, sublabel: 'Apple sheet cancelled' },
      { label: 'Purchase failed', value: appsFlyerPurchaseFailedEvents, sublabel: 'StoreKit purchase failure events' },
      { label: 'Trial starts', value: appsFlyerStartTrialEvents, sublabel: 'AppsFlyer trial start events' },
    ].filter((row) => row.value > 0 || macraScoreboard.appsFlyerSummary);

    return {
      users,
      onboardingCompleters,
      qualified,
      seriousPlanCompleters,
      highIntentRecovery,
      qualifiedPaywallViews,
      qualifiedCtaTaps,
      qualifiedCheckoutStarts,
      qualifiedAppleCancels,
      qualifiedTrialStarts,
      qualifiedPaid,
      qualifiedStripeClicks,
      webOfferSentUsers,
      webOfferOpenedUsers,
      webOfferCheckoutStarts,
      retargetingRecoveredUsers,
      retargetingTrialRedemptions,
      retargetingPaidConversions,
      retargetingRecoveredRevenue,
      recoveryPool,
      recoveredUsers,
      tierRows,
      disqualifierRows,
      lastScanSummary,
      sentBySequence,
      skippedByReason,
      appsFlyerInstalls,
      appsFlyerOrganicInstalls,
      appsFlyerNonOrganicInstalls,
      appsFlyerEvents,
      appsFlyerPaywallEvents,
      appsFlyerPlanLoadedEvents,
      appsFlyerPlanSelectedEvents,
      appsFlyerCtaEvents,
      appsFlyerCheckoutEvents,
      appsFlyerPurchaseCancelEvents,
      appsFlyerPurchaseFailedEvents,
      appsFlyerStartTrialEvents,
      appsFlyerSubscribeEvents,
      appsFlyerPurchaseEvents,
      appsFlyerMatchedRows,
      appsFlyerTopMediaSources,
      appsFlyerTopCampaigns,
      appsFlyerTopEvents,
      appsFlyerAggregatePeriods,
      appsFlyerImportSource,
      appsFlyerIsAggregateCsv,
      appsFlyerEventSourceLabel,
      appsFlyerEventCardLabel,
      appsFlyerTrialCardLabel,
      appsFlyerQualifiedCtaLabel,
      appsFlyerQualifiedTrialLabel,
      appsFlyerEventIdentityLabel,
      appsFlyerTopSourceUnit,
      appsFlyerCoverageLabel,
      appsFlyerPaywallFunnelRows,
    };
  }, [macraScoreboard.appsFlyerSummary, macraScoreboard.config, macraScoreboard.users, selectedMacraScoreboardRange]);

  const macraMetricCards = [
    {
      label: 'Qualified onboarding completions',
      value: macraScoreboardSummary.qualified,
      sublabel: `${formatScoreboardPercent(macraScoreboardSummary.qualified, macraScoreboardSummary.onboardingCompleters)} of loaded completers`,
      icon: Target,
      tone: 'text-[#d7ff00]',
    },
    {
      label: 'Serious plan completers',
      value: macraScoreboardSummary.seriousPlanCompleters,
      sublabel: 'Adult, realistic goal, macros, paywall',
      icon: TrendingUp,
      tone: 'text-emerald-300',
    },
    {
      label: 'High-intent recovery pool',
      value: macraScoreboardSummary.highIntentRecovery,
      sublabel: 'CTA, cancel, click, open, or repeat paywall view',
      icon: ShieldAlert,
      tone: 'text-amber-300',
    },
    {
      label: 'Retargeting recoveries',
      value: macraScoreboardSummary.retargetingRecoveredUsers,
      sublabel: `${macraScoreboardSummary.retargetingTrialRedemptions} 30-day offer redemptions · ${macraScoreboardSummary.retargetingPaidConversions} paid after trial`,
      icon: CheckCircle,
      tone: 'text-lime-300',
    },
    {
      label: 'Paid plan conversions',
      value: Math.max(macraScoreboardSummary.qualifiedPaid, macraScoreboardSummary.retargetingPaidConversions),
      sublabel: `${macraScoreboardSummary.retargetingPaidConversions} paid after web offer · ${macraScoreboardSummary.appsFlyerSubscribeEvents + macraScoreboardSummary.appsFlyerPurchaseEvents} AppsFlyer subscribe/purchase events · ${formatScoreboardMoney(macraScoreboardSummary.retargetingRecoveredRevenue)}`,
      icon: ShoppingCart,
      tone: 'text-green-300',
    },
    {
      label: 'Qualified paywall views',
      value: macraScoreboardSummary.qualifiedPaywallViews,
      sublabel: 'Explicit or inferred from completed onboarding',
      icon: Eye,
      tone: 'text-blue-300',
    },
    {
      label: 'Paywall CTA taps',
      value: macraScoreboardSummary.qualifiedCtaTaps,
      sublabel: macraScoreboard.appsFlyerSummary
        ? macraScoreboardSummary.appsFlyerQualifiedCtaLabel
        : `${formatScoreboardPercent(macraScoreboardSummary.qualifiedCtaTaps, macraScoreboardSummary.qualifiedPaywallViews)} of qualified paywall users`,
      icon: MousePointerClick,
      tone: 'text-sky-300',
    },
    {
      label: 'Qualified checkout starts',
      value: macraScoreboardSummary.qualifiedCheckoutStarts,
      sublabel: macraScoreboard.appsFlyerSummary
        ? `${macraScoreboardSummary.appsFlyerCheckoutEvents} AppsFlyer aggregate checkout events`
        : `${formatScoreboardPercent(macraScoreboardSummary.qualifiedCheckoutStarts, macraScoreboardSummary.qualifiedCtaTaps)} of qualified CTA taps`,
      icon: ShoppingCart,
      tone: 'text-cyan-300',
    },
    {
      label: 'Qualified Apple cancels',
      value: macraScoreboardSummary.qualifiedAppleCancels,
      sublabel: 'Trust-recovery audience',
      icon: AlertCircle,
      tone: 'text-orange-300',
    },
    {
      label: 'Trial starts',
      value: macraScoreboardSummary.qualifiedTrialStarts,
      sublabel: macraScoreboard.appsFlyerSummary
        ? macraScoreboardSummary.appsFlyerQualifiedTrialLabel
        : `${formatScoreboardPercent(macraScoreboardSummary.qualifiedTrialStarts, macraScoreboardSummary.qualified)} of qualified users · upload AppsFlyer CSV events`,
      icon: CheckCircle,
      tone: 'text-green-300',
    },
    {
      label: 'Stripe retarget clicks',
      value: macraScoreboardSummary.qualifiedStripeClicks,
      sublabel: 'Qualified web offer or proof clicks',
      icon: ShoppingCart,
      tone: 'text-violet-300',
    },
  ];

  const macraFunnelRows = [
    {
      label: 'All installs',
      value:
        macraScoreboardSummary.appsFlyerInstalls ||
        (macraScoreboard.appsFlyerSummary && macraScoreboardSummary.appsFlyerAggregatePeriods.length ? 'Upload install report' : 'Upload CSV'),
      sublabel: macraScoreboard.appsFlyerSummary
        ? macraScoreboardSummary.appsFlyerInstalls
          ? `${macraScoreboardSummary.appsFlyerNonOrganicInstalls} paid · ${macraScoreboardSummary.appsFlyerOrganicInstalls} organic`
          : macraScoreboardSummary.appsFlyerAggregatePeriods.length
            ? 'Current AppsFlyer upload has event aggregates, not install rows'
            : 'No aggregate CSV periods saved for this range'
        : 'Acquisition quality source',
    },
    {
      label: 'Onboarding completers',
      value: macraScoreboardSummary.onboardingCompleters,
      sublabel: `${macraScoreboard.users.length >= macraScoreboard.userLimit ? `Latest ${macraScoreboard.userLimit}` : 'Loaded'} Macra users`,
    },
    {
      label: 'Serious plan completers',
      value: macraScoreboardSummary.seriousPlanCompleters,
      sublabel: `${formatScoreboardPercent(macraScoreboardSummary.seriousPlanCompleters, macraScoreboardSummary.onboardingCompleters)} of onboarding completers`,
    },
    {
      label: 'High-intent recovery',
      value: macraScoreboardSummary.highIntentRecovery,
      sublabel: 'Highest-intent recovery audience',
    },
    {
      label: 'Paywall CTA taps',
      value: macraScoreboardSummary.qualifiedCtaTaps,
      sublabel: macraScoreboard.appsFlyerSummary
        ? macraScoreboardSummary.appsFlyerQualifiedCtaLabel
        : `${formatScoreboardPercent(macraScoreboardSummary.qualifiedCtaTaps, macraScoreboardSummary.qualifiedPaywallViews)} of qualified paywall users`,
    },
    {
      label: 'Checkout starts',
      value: macraScoreboardSummary.qualifiedCheckoutStarts,
      sublabel: macraScoreboard.appsFlyerSummary
        ? `${macraScoreboardSummary.qualifiedCheckoutStarts} first-party qualified · ${macraScoreboardSummary.appsFlyerCheckoutEvents} AppsFlyer aggregate events`
        : `${formatScoreboardPercent(macraScoreboardSummary.qualifiedCheckoutStarts, macraScoreboardSummary.qualifiedCtaTaps)} of qualified CTA taps`,
    },
    {
      label: 'Web offer checkout starts',
      value: macraScoreboardSummary.webOfferCheckoutStarts,
      sublabel: `${formatScoreboardPercent(macraScoreboardSummary.webOfferCheckoutStarts, macraScoreboardSummary.webOfferSentUsers || macraScoreboardSummary.qualifiedStripeClicks)} of matched retargeting offer users`,
    },
    {
      label: 'Retargeting recoveries',
      value: macraScoreboardSummary.retargetingRecoveredUsers,
      sublabel: `${formatScoreboardPercent(macraScoreboardSummary.retargetingRecoveredUsers, macraScoreboardSummary.webOfferCheckoutStarts)} of matched web offer checkout starts`,
    },
    {
      label: 'Trial starts',
      value: macraScoreboardSummary.qualifiedTrialStarts,
      sublabel: macraScoreboard.appsFlyerSummary
        ? macraScoreboardSummary.appsFlyerQualifiedTrialLabel
        : `${formatScoreboardPercent(macraScoreboardSummary.qualifiedTrialStarts, macraScoreboardSummary.seriousPlanCompleters)} of serious plan completers`,
    },
    {
      label: 'Paid users',
      value: Math.max(macraScoreboardSummary.qualifiedPaid, macraScoreboardSummary.retargetingPaidConversions),
      sublabel: `${macraScoreboardSummary.retargetingPaidConversions} paid after offer · ${formatScoreboardPercent(macraScoreboardSummary.qualifiedPaid, macraScoreboardSummary.seriousPlanCompleters)} of serious plan completers`,
    },
  ];

  const serializeScoreboardValue = (value: any): any => {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'function') return undefined;
    if (typeof value?.toDate === 'function') {
      try {
        return value.toDate().toISOString();
      } catch (_error) {
        return String(value);
      }
    }
    if (Array.isArray(value)) return value.map(serializeScoreboardValue);
    if (typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .map(([key, nestedValue]) => [key, serializeScoreboardValue(nestedValue)])
          .filter(([, nestedValue]) => nestedValue !== undefined)
      );
    }
    return String(value);
  };

  const buildScoreboardUserExport = (user: MacraScoreboardUser, index: number) => ({
    row: index + 1,
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    tier: user.tier,
    tierLabel: user.tierLabel,
    isQualified: user.isQualified,
    isHighIntent: user.isHighIntent,
    suggestedLane: user.suggestedLane,
    nextRetargetingEmail: user.nextRetargetingEmail
      ? {
          ...user.nextRetargetingEmail,
          dueAtIso: new Date(user.nextRetargetingEmail.dueAt).toISOString(),
          anchorAtIso: new Date(user.nextRetargetingEmail.anchorAt).toISOString(),
        }
      : null,
    disqualifiers: user.disqualifiers.map((key) => MACRA_DISQUALIFIER_LABELS[key] || titleizeScoreboardToken(key)),
    signals: {
      ...user.signals,
      paywallLastViewedAtIso: user.signals.paywallLastViewedAt ? new Date(user.signals.paywallLastViewedAt).toISOString() : null,
      ctaTappedAtIso: user.signals.ctaTappedAt ? new Date(user.signals.ctaTappedAt).toISOString() : null,
      checkoutStartedAtIso: user.signals.checkoutStartedAt ? new Date(user.signals.checkoutStartedAt).toISOString() : null,
      appleCancelAtIso: user.signals.appleCancelAt ? new Date(user.signals.appleCancelAt).toISOString() : null,
      webOfferSentAtIso: user.signals.webOfferSentAt ? new Date(user.signals.webOfferSentAt).toISOString() : null,
      webOfferOpenedAtIso: user.signals.webOfferOpenedAt ? new Date(user.signals.webOfferOpenedAt).toISOString() : null,
      webOfferCheckoutStartedAtIso: user.signals.webOfferCheckoutStartedAt ? new Date(user.signals.webOfferCheckoutStartedAt).toISOString() : null,
      webOfferConvertedAtIso: user.signals.webOfferConvertedAt ? new Date(user.signals.webOfferConvertedAt).toISOString() : null,
      webOfferTrialEndAtIso: user.signals.webOfferTrialEndAt ? new Date(user.signals.webOfferTrialEndAt).toISOString() : null,
      webOfferPaidAtIso: user.signals.webOfferPaidAt ? new Date(user.signals.webOfferPaidAt).toISOString() : null,
      stripeRetargetClickedAtIso: user.signals.stripeRetargetClickedAt ? new Date(user.signals.stripeRetargetClickedAt).toISOString() : null,
      trialStartedAtIso: user.signals.trialStartedAt ? new Date(user.signals.trialStartedAt).toISOString() : null,
      paidAtIso: user.signals.paidAt ? new Date(user.signals.paidAt).toISOString() : null,
      appsFlyerTrialStartedAtIso: user.signals.appsFlyerTrialStartedAt ? new Date(user.signals.appsFlyerTrialStartedAt).toISOString() : null,
      appsFlyerPurchaseAtIso: user.signals.appsFlyerPurchaseAt ? new Date(user.signals.appsFlyerPurchaseAt).toISOString() : null,
      onboardingCompletedAtIso: user.signals.onboardingCompletedAt ? new Date(user.signals.onboardingCompletedAt).toISOString() : null,
      latestIntentAtIso: user.signals.latestIntentAt ? new Date(user.signals.latestIntentAt).toISOString() : null,
    },
  });

  const copyMacraScoreboardReport = async () => {
    setCopyingScoreboard(true);
    try {
      const payload = serializeScoreboardValue({
        reportType: 'macra-retargeting-scoreboard',
        generatedAt: new Date().toISOString(),
        refreshedAt: macraScoreboard.loadedAt,
        loadedUserCount: macraScoreboard.users.length,
        loadedUserLimit: macraScoreboard.userLimit,
        emailLogCount: macraScoreboard.emailLogCount,
        purchaseLogCount: macraScoreboard.purchaseLogCount,
        dateRange: {
          preset: selectedMacraScoreboardRange.preset,
          label: selectedMacraScoreboardRangeLabel,
          start: selectedMacraScoreboardRange.start,
          end: selectedMacraScoreboardRange.end,
          daysBack: selectedMacraScoreboardRange.daysBack,
        },
        headlineMetrics: macraMetricCards.map((card) => ({
          label: card.label,
          value: card.value,
          sublabel: card.sublabel,
        })),
        funnel: macraFunnelRows,
        rates: {
          qualifiedOnboardingRate: formatScoreboardPercent(macraScoreboardSummary.qualified, macraScoreboardSummary.onboardingCompleters),
          seriousPlanCompleterRate: formatScoreboardPercent(macraScoreboardSummary.seriousPlanCompleters, macraScoreboardSummary.onboardingCompleters),
          qualifiedCtaTapRate: formatScoreboardPercent(macraScoreboardSummary.qualifiedCtaTaps, macraScoreboardSummary.qualifiedPaywallViews),
          qualifiedCheckoutStartRate: formatScoreboardPercent(macraScoreboardSummary.qualifiedCheckoutStarts, macraScoreboardSummary.qualifiedCtaTaps),
          appsFlyerCtaTapRate: formatScoreboardPercent(macraScoreboardSummary.appsFlyerCtaEvents, macraScoreboardSummary.appsFlyerPaywallEvents),
          appsFlyerCheckoutStartRate: formatScoreboardPercent(macraScoreboardSummary.appsFlyerCheckoutEvents, macraScoreboardSummary.appsFlyerCtaEvents),
          webOfferCheckoutStartRate: formatScoreboardPercent(macraScoreboardSummary.webOfferCheckoutStarts, macraScoreboardSummary.webOfferSentUsers || macraScoreboardSummary.qualifiedStripeClicks),
          retargetingRecoveryRate: formatScoreboardPercent(macraScoreboardSummary.retargetingRecoveredUsers, macraScoreboardSummary.webOfferCheckoutStarts),
          retargetingPaidRate: formatScoreboardPercent(macraScoreboardSummary.retargetingPaidConversions, macraScoreboardSummary.retargetingTrialRedemptions),
          qualifiedTrialStartRate: formatScoreboardPercent(macraScoreboardSummary.qualifiedTrialStarts, macraScoreboardSummary.qualified),
          trialStartRateFromSeriousPlan: formatScoreboardPercent(macraScoreboardSummary.qualifiedTrialStarts, macraScoreboardSummary.seriousPlanCompleters),
          paidRateFromSeriousPlan: formatScoreboardPercent(macraScoreboardSummary.qualifiedPaid, macraScoreboardSummary.seriousPlanCompleters),
        },
        buckets: {
          seriousVsCuriosity: macraScoreboardSummary.tierRows,
          qualificationGaps: macraScoreboardSummary.disqualifierRows,
        },
        scheduler: {
          config: macraScoreboard.config,
          lastScanCompletedAt: macraScoreboard.config?.lastScanCompletedAt || macraScoreboard.config?.lastScanAt || null,
          lastScanCompletedAtLabel: formatScoreboardDate(macraScoreboard.config?.lastScanCompletedAt || macraScoreboard.config?.lastScanAt),
          lastScanLocalTime: macraScoreboard.config?.lastScanLocalTime || null,
          lastScanSummary: macraScoreboardSummary.lastScanSummary,
          sentBySequence: Object.fromEntries(macraScoreboardSummary.sentBySequence),
          skippedByReason: Object.fromEntries(macraScoreboardSummary.skippedByReason),
        },
        recovery: {
          webOfferSentUsers: macraScoreboardSummary.webOfferSentUsers,
          webOfferOpenedUsers: macraScoreboardSummary.webOfferOpenedUsers,
          webOfferCheckoutStarts: macraScoreboardSummary.webOfferCheckoutStarts,
          recoveredUsers: macraScoreboardSummary.retargetingRecoveredUsers,
          trialRedemptions: macraScoreboardSummary.retargetingTrialRedemptions,
          paidConversions: macraScoreboardSummary.retargetingPaidConversions,
          paidRevenue: macraScoreboardSummary.retargetingRecoveredRevenue,
          paidRevenueLabel: formatScoreboardMoney(macraScoreboardSummary.retargetingRecoveredRevenue),
        },
        personLevelJourney: {
          source: 'first_party_firebase_email_purchase_stripe',
          onboardingCompleters: macraScoreboardSummary.onboardingCompleters,
          qualifiedLeads: macraScoreboardSummary.qualified,
          qualifiedPaywallViews: macraScoreboardSummary.qualifiedPaywallViews,
          qualifiedCtaTaps: macraScoreboardSummary.qualifiedCtaTaps,
          qualifiedCheckoutStarts: macraScoreboardSummary.qualifiedCheckoutStarts,
          qualifiedAppleCancels: macraScoreboardSummary.qualifiedAppleCancels,
          webOfferSentUsers: macraScoreboardSummary.webOfferSentUsers,
          webOfferOpenedUsers: macraScoreboardSummary.webOfferOpenedUsers,
          stripeRetargetClicks: macraScoreboardSummary.qualifiedStripeClicks,
          webOfferCheckoutStarts: macraScoreboardSummary.webOfferCheckoutStarts,
          retargetingRecoveries: macraScoreboardSummary.retargetingRecoveredUsers,
          trialStarts: macraScoreboardSummary.qualifiedTrialStarts,
          paidUsers: macraScoreboardSummary.qualifiedPaid,
        },
        aggregateValidation: {
          source: macraScoreboardSummary.appsFlyerIsAggregateCsv ? 'appsflyer_aggregate_csv' : 'appsflyer_raw_or_layered',
          ctaEvents: macraScoreboardSummary.appsFlyerCtaEvents,
          firstPartyQualifiedCtaTaps: macraScoreboardSummary.qualifiedCtaTaps,
          ctaEventGap: Math.max(0, macraScoreboardSummary.appsFlyerCtaEvents - macraScoreboardSummary.qualifiedCtaTaps),
          checkoutEvents: macraScoreboardSummary.appsFlyerCheckoutEvents,
          firstPartyQualifiedCheckoutStarts: macraScoreboardSummary.qualifiedCheckoutStarts,
          checkoutEventGap: Math.max(0, macraScoreboardSummary.appsFlyerCheckoutEvents - macraScoreboardSummary.qualifiedCheckoutStarts),
          startTrialEvents: macraScoreboardSummary.appsFlyerStartTrialEvents,
          firstPartyQualifiedTrialStarts: macraScoreboardSummary.qualifiedTrialStarts,
          trialEventGap: Math.max(0, macraScoreboardSummary.appsFlyerStartTrialEvents - macraScoreboardSummary.qualifiedTrialStarts),
          subscribeOrPurchaseEvents: macraScoreboardSummary.appsFlyerSubscribeEvents + macraScoreboardSummary.appsFlyerPurchaseEvents,
          firstPartyQualifiedPaidUsers: macraScoreboardSummary.qualifiedPaid,
          paidEventGap: Math.max(0, macraScoreboardSummary.appsFlyerSubscribeEvents + macraScoreboardSummary.appsFlyerPurchaseEvents - macraScoreboardSummary.qualifiedPaid),
        },
        appsFlyer: {
          summary: macraScoreboard.appsFlyerSummary,
          importSource: macraScoreboardSummary.appsFlyerImportSource,
          isAggregateCsv: macraScoreboardSummary.appsFlyerIsAggregateCsv,
          installs: macraScoreboardSummary.appsFlyerInstalls,
          organicInstalls: macraScoreboardSummary.appsFlyerOrganicInstalls,
          nonOrganicInstalls: macraScoreboardSummary.appsFlyerNonOrganicInstalls,
          events: macraScoreboardSummary.appsFlyerEvents,
          paywallEvents: macraScoreboardSummary.appsFlyerPaywallEvents,
          planLoadedEvents: macraScoreboardSummary.appsFlyerPlanLoadedEvents,
          planSelectedEvents: macraScoreboardSummary.appsFlyerPlanSelectedEvents,
          ctaEvents: macraScoreboardSummary.appsFlyerCtaEvents,
          checkoutEvents: macraScoreboardSummary.appsFlyerCheckoutEvents,
          purchaseCancelEvents: macraScoreboardSummary.appsFlyerPurchaseCancelEvents,
          purchaseFailedEvents: macraScoreboardSummary.appsFlyerPurchaseFailedEvents,
          startTrialEvents: macraScoreboardSummary.appsFlyerStartTrialEvents,
          subscribeEvents: macraScoreboardSummary.appsFlyerSubscribeEvents,
          purchaseEvents: macraScoreboardSummary.appsFlyerPurchaseEvents,
          paywallIntentFunnel: macraScoreboardSummary.appsFlyerPaywallFunnelRows,
          matchedCustomerUserRows: macraScoreboardSummary.appsFlyerMatchedRows,
          topMediaSources: macraScoreboardSummary.appsFlyerTopMediaSources,
          topCampaigns: macraScoreboardSummary.appsFlyerTopCampaigns,
          topEvents: macraScoreboardSummary.appsFlyerTopEvents,
          aggregateCoverage: macraScoreboardSummary.appsFlyerCoverageLabel,
          aggregatePeriods: macraScoreboardSummary.appsFlyerAggregatePeriods,
        },
        recoveredPeople: macraScoreboardSummary.recoveredUsers.map(buildScoreboardUserExport),
        highestIntentRecoveryPool: macraScoreboardSummary.recoveryPool.map(buildScoreboardUserExport),
        loadedUsers: macraScoreboard.users.map(buildScoreboardUserExport),
      });
      const report = [
        'Macra Retargeting Scoreboard Export',
        `Generated: ${new Date().toLocaleString()}`,
        `Loaded users: ${macraScoreboard.users.length}`,
        '',
        '```json',
        JSON.stringify(payload, null, 2),
        '```',
      ].join('\n');

      await navigator.clipboard.writeText(report);
      setMessage({ type: 'success', text: 'Macra scoreboard report copied to clipboard.' });
      dispatch(showToast({ message: 'Macra scoreboard report copied.', type: 'success' }));
    } catch (_error) {
      setMessage({ type: 'error', text: 'Failed to copy Macra scoreboard report.' });
    } finally {
      setCopyingScoreboard(false);
    }
  };

  const canCopyMacraScoreboard = Boolean(macraScoreboard.loadedAt || macraScoreboard.users.length || macraScoreboard.appsFlyerSummary);
  const adminTabs = [
    {
      id: 'scoreboard' as const,
      label: 'Macra scoreboard',
      icon: Activity,
      detail: `${macraScoreboard.users.length} loaded`,
    },
    {
      id: 'sequences' as const,
      label: 'Email sequences',
      icon: Mail,
      detail: `${SEQUENCES.length} rows`,
    },
  ];

  return (
    <AdminRouteGuard>
      <Head>
        <title>Email Sequences | Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="w-full max-w-6xl mx-auto lg:max-w-none">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Mail className="w-7 h-7 text-[#d7ff00]" />
                Email Sequences
              </h1>
              <p className="text-zinc-400 mt-1">See what emails get sent when, and send test emails.</p>
            </div>
            {activeAdminTab === 'sequences' ? (
              <button
                type="button"
                onClick={seedMissingTemplates}
                disabled={seedingTemplates}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${seedingTemplates
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                  }`}
                title="Create Firestore templates for editable sequences that do not have saved HTML yet"
              >
                {seedingTemplates ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
                Seed missing templates
              </button>
            ) : null}
          </div>

          {message && (
            <div
              className={`mb-6 p-4 rounded-xl border ${message.type === 'success'
                ? 'bg-green-900/20 border-green-800 text-green-400'
                : message.type === 'error'
                  ? 'bg-red-900/20 border-red-800 text-red-400'
                  : 'bg-blue-900/20 border-blue-800 text-blue-400'
                }`}
            >
              <div className="flex items-center gap-2">
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                {message.text}
              </div>
            </div>
          )}

          <div className="mb-6 flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
            {adminTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeAdminTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveAdminTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                    ? 'bg-[#d7ff00] text-black'
                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${isActive ? 'bg-black/10 text-black/70' : 'bg-zinc-950 text-zinc-500'}`}>
                    {tab.detail}
                  </span>
                </button>
              );
            })}
          </div>

          {activeAdminTab === 'scoreboard' ? (
          <section className="mb-8">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-[#d7ff00]" />
                  Macra Retargeting Scoreboard
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Qualified-user lens for onboarding completers, paywall intent, recovery, trials, and paid conversion.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="hidden text-right text-xs text-zinc-500 sm:block">
                  <div>Loaded {macraScoreboard.users.length} user{macraScoreboard.users.length === 1 ? '' : 's'}</div>
                  <div>{selectedMacraScoreboardRangeLabel}</div>
                  <div>
                    {macraScoreboard.loadedAt ? `Refreshed ${formatScoreboardAgo(macraScoreboard.loadedAt)}` : 'Waiting for first load'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyMacraScoreboardReport}
                  disabled={copyingScoreboard || !canCopyMacraScoreboard}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${copyingScoreboard || !canCopyMacraScoreboard
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                    }`}
                  title="Copy Macra scoreboard report"
                >
                  {copyingScoreboard ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  Copy report
                </button>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5">
                  <select
                    value={appsFlyerCsvPeriodPreset}
                    onChange={(event) => updateAppsFlyerCsvPeriodPreset(event.target.value as MacraScoreboardRangePreset)}
                    className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-200 outline-none focus:border-[#d7ff00]"
                    aria-label="Macra scoreboard date range"
                  >
                    {MACRA_SCOREBOARD_RANGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex h-8 items-center rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-400">
                    {appsFlyerCsvPeriodStart === appsFlyerCsvPeriodEnd
                      ? formatDateOnlyLabel(appsFlyerCsvPeriodStart)
                      : `${formatDateOnlyLabel(appsFlyerCsvPeriodStart)} to ${formatDateOnlyLabel(appsFlyerCsvPeriodEnd)}`}
                  </div>
                </div>
                <input
                  id="macra-appsflyer-csv-upload"
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  className="hidden"
                  onChange={uploadAppsFlyerCsvFiles}
                  disabled={uploadingAppsFlyerCsv}
                />
                <label
                  htmlFor="macra-appsflyer-csv-upload"
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${uploadingAppsFlyerCsv
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 cursor-pointer'
                    }`}
                  title="Upload AppsFlyer CSV exports for the selected date range"
                >
                  {uploadingAppsFlyerCsv ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload CSV
                </label>
                <button
                  type="button"
                  onClick={syncAppsFlyerRawData}
                  disabled={syncingAppsFlyer || !MACRA_APPSFLYER_RAW_SYNC_ENABLED}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${syncingAppsFlyer
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : MACRA_APPSFLYER_RAW_SYNC_ENABLED
                      ? 'bg-[#d7ff00] text-black hover:bg-[#c5eb00]'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                    }`}
                  title={
                    MACRA_APPSFLYER_RAW_SYNC_ENABLED
                      ? 'Sync AppsFlyer raw-data reports'
                      : 'Raw AppsFlyer reports are not included on this account. Upload aggregate CSV reports instead.'
                  }
                >
                  {syncingAppsFlyer ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                  {MACRA_APPSFLYER_RAW_SYNC_ENABLED ? 'Sync AppsFlyer' : 'Raw sync unavailable'}
                </button>
                <button
                  type="button"
                  onClick={loadMacraScoreboard}
                  disabled={macraScoreboard.loading}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${macraScoreboard.loading
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                    }`}
                >
                  {macraScoreboard.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </button>
              </div>
            </div>

            {macraScoreboard.error ? (
              <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-300">
                {macraScoreboard.error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {macraMetricCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="rounded-lg border border-zinc-800 bg-[#1a1e24] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{card.label}</p>
                      <Icon className={`h-4 w-4 ${card.tone}`} />
                    </div>
                    <div className="text-2xl font-bold text-white">{card.value}</div>
                    <div className="mt-1 text-xs text-zinc-500">{card.sublabel}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 rounded-lg border border-zinc-800 bg-[#1a1e24] overflow-hidden">
                <div className="border-b border-zinc-800 px-4 py-3">
                  <h3 className="text-sm font-semibold text-zinc-200">Cohort Funnel</h3>
                </div>
                <div className="divide-y divide-zinc-800">
                  {macraFunnelRows.map((row) => (
                    <div key={row.label} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[180px_1fr_220px] sm:items-center">
                      <div className="text-sm font-medium text-zinc-300">{row.label}</div>
                      <div className="text-xl font-bold text-white">{row.value}</div>
                      <div className="text-xs text-zinc-500 sm:text-right">{row.sublabel}</div>
                    </div>
                  ))}
                </div>
              </div>

                <div className="rounded-lg border border-zinc-800 bg-[#1a1e24] overflow-hidden">
                  <div className="flex flex-col gap-2 border-b border-zinc-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-semibold text-zinc-200">Scheduler Last Run</h3>
                    <button
                      onClick={runMacraRetargetingSchedulerNow}
                      disabled={runningRetargetingScheduler}
                      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        runningRetargetingScheduler
                          ? 'bg-zinc-800 text-zinc-400'
                          : 'border border-[#d7ff00]/40 bg-[#d7ff00]/10 text-[#d7ff00] hover:bg-[#d7ff00]/20'
                      }`}
                      title="Run the shared Macra retargeting scheduler now"
                    >
                      {runningRetargetingScheduler ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Run now
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-zinc-500">Status</div>
                        <div className={macraScoreboard.config?.enabled === false ? 'mt-1 text-amber-300' : 'mt-1 text-green-300'}>
                          {macraScoreboard.config?.enabled === false ? 'Paused' : 'Enabled'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">Completed</div>
                        <div className="mt-1 text-zinc-200">
                          {formatScoreboardDate(macraScoreboard.config?.lastScanCompletedAt || macraScoreboard.config?.lastScanAt)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-zinc-500">Local time</div>
                        <div className="mt-1 text-zinc-200">{macraScoreboard.config?.lastScanLocalTime || 'Not seen'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">Send cap</div>
                        <div className="mt-1 text-zinc-200">
                          {Number(macraScoreboard.config?.maxSendsPerRun || DEFAULT_CAMPAIGN_CONFIG.maxSendsPerRun)} per run
                        </div>
                      </div>
                    </div>
                  <div className="grid grid-cols-5 gap-2">
                    {['scanned', 'claimed', 'sent', 'skipped', 'errors'].map((key) => (
                      <div key={key} className="rounded-lg bg-zinc-950/70 px-2 py-2 text-center">
                        <div className="text-sm font-bold text-white">{Number(macraScoreboardSummary.lastScanSummary[key] || 0)}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">{key}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Sent by sequence</div>
                    {macraScoreboardSummary.sentBySequence.length ? (
                      <div className="space-y-1.5">
                        {macraScoreboardSummary.sentBySequence.map(([sequenceId, value]) => (
                          <div key={sequenceId} className="flex items-center justify-between gap-3 text-xs">
                            <span className="truncate text-zinc-400">{sequenceId}</span>
                            <span className="font-semibold text-zinc-200">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-500">No sends recorded in the latest summary.</div>
                    )}
                  </div>
                  {macraScoreboardSummary.skippedByReason.length ? (
                    <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Top skips</div>
                      <div className="space-y-1.5">
                        {macraScoreboardSummary.skippedByReason.map(([reason, value]) => (
                          <div key={reason} className="flex items-center justify-between gap-3 text-xs">
                            <span className="truncate text-zinc-400">{titleizeScoreboardToken(reason)}</span>
                            <span className="font-semibold text-zinc-200">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-zinc-800 bg-[#1a1e24] overflow-hidden">
              <div className="flex flex-col gap-1 border-b border-zinc-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold text-zinc-200">AppsFlyer CSV Validation</h3>
                <div className="text-right text-xs text-zinc-500">
                  <div>
                    {macraScoreboard.appsFlyerSummary?.importedAt
                      ? `Imported ${formatScoreboardAgo(macraScoreboard.appsFlyerSummary.importedAt)}`
                      : 'No AppsFlyer import yet'}
                  </div>
                  {macraScoreboardSummary.appsFlyerIsAggregateCsv ? (
                    <div>{macraScoreboardSummary.appsFlyerCoverageLabel}</div>
                  ) : null}
                </div>
              </div>
                <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg bg-zinc-950/60 p-3">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">
                    {macraScoreboardSummary.appsFlyerIsAggregateCsv ? 'Install rows' : 'Raw installs'}
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white">{macraScoreboardSummary.appsFlyerInstalls}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {macraScoreboardSummary.appsFlyerIsAggregateCsv
                      ? 'Aggregate performance CSV does not include install rows'
                      : `${macraScoreboardSummary.appsFlyerNonOrganicInstalls} paid · ${macraScoreboardSummary.appsFlyerOrganicInstalls} organic`}
                  </div>
                </div>
                <div className="rounded-lg bg-zinc-950/60 p-3">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">{macraScoreboardSummary.appsFlyerEventCardLabel}</div>
                  <div className="mt-2 text-2xl font-bold text-white">{macraScoreboardSummary.appsFlyerEvents}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {macraScoreboardSummary.appsFlyerEventIdentityLabel}
                  </div>
                </div>
                  <div className="rounded-lg bg-zinc-950/60 p-3">
                    <div className="text-xs uppercase tracking-wider text-zinc-500">{macraScoreboardSummary.appsFlyerTrialCardLabel}</div>
                    <div className="mt-2 text-2xl font-bold text-white">{macraScoreboardSummary.appsFlyerStartTrialEvents}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {macraScoreboardSummary.appsFlyerSubscribeEvents + macraScoreboardSummary.appsFlyerPurchaseEvents} subscribe or purchase events
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-950/60 p-3">
                    <div className="text-xs uppercase tracking-wider text-zinc-500">Paywall CTA taps</div>
                    <div className="mt-2 text-2xl font-bold text-white">{macraScoreboardSummary.appsFlyerCtaEvents}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {formatScoreboardPercent(macraScoreboardSummary.appsFlyerCtaEvents, macraScoreboardSummary.appsFlyerPaywallEvents)} of paywall events
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-950/60 p-3">
                    <div className="text-xs uppercase tracking-wider text-zinc-500">Checkout starts</div>
                    <div className="mt-2 text-2xl font-bold text-white">{macraScoreboardSummary.appsFlyerCheckoutEvents}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {formatScoreboardPercent(macraScoreboardSummary.appsFlyerCheckoutEvents, macraScoreboardSummary.appsFlyerCtaEvents)} of CTA taps
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-950/60 p-3">
                    <div className="text-xs uppercase tracking-wider text-zinc-500">Cancel or failed</div>
                    <div className="mt-2 text-2xl font-bold text-white">
                      {macraScoreboardSummary.appsFlyerPurchaseCancelEvents + macraScoreboardSummary.appsFlyerPurchaseFailedEvents}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {macraScoreboardSummary.appsFlyerPurchaseCancelEvents} cancelled · {macraScoreboardSummary.appsFlyerPurchaseFailedEvents} failed
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-950/60 p-3">
                    <div className="text-xs uppercase tracking-wider text-zinc-500">Top source</div>
                  <div className="mt-2 text-lg font-bold text-white">
                    {macraScoreboardSummary.appsFlyerTopMediaSources[0]?.label || 'Not imported'}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {macraScoreboardSummary.appsFlyerTopMediaSources[0]?.count
                      ? `${macraScoreboardSummary.appsFlyerTopMediaSources[0].count} ${macraScoreboardSummary.appsFlyerTopSourceUnit}`
                      : 'Upload CSV to populate'}
                  </div>
                </div>
                <div className="rounded-lg bg-zinc-950/60 p-3">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Top event</div>
                  <div className="mt-2 text-lg font-bold text-white">
                    {macraScoreboardSummary.appsFlyerTopEvents[0]?.label
                      ? titleizeScoreboardToken(macraScoreboardSummary.appsFlyerTopEvents[0].label)
                      : 'Not imported'}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {macraScoreboardSummary.appsFlyerTopEvents[0]?.count
                      ? `${macraScoreboardSummary.appsFlyerTopEvents[0].count} events`
                      : 'In-app events from AppsFlyer'}
                  </div>
                  </div>
                </div>
                {macraScoreboardSummary.appsFlyerPaywallFunnelRows.length ? (
                  <div className="border-t border-zinc-800 px-4 py-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Paywall intent funnel</div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                      {macraScoreboardSummary.appsFlyerPaywallFunnelRows.map((row) => (
                        <div key={row.label} className="rounded-lg border border-zinc-800 bg-black/20 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-medium text-zinc-400">{row.label}</span>
                            <span className="text-sm font-bold text-white">{row.value}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-zinc-500">{row.sublabel}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {macraScoreboardSummary.appsFlyerTopCampaigns.length ? (
                <div className="border-t border-zinc-800 px-4 py-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Top campaigns</div>
                  <div className="flex flex-wrap gap-2">
                    {macraScoreboardSummary.appsFlyerTopCampaigns.slice(0, 6).map((campaign: any) => (
                      <span key={campaign.label} className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
                        {campaign.label}: {campaign.count}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
	            </div>

	            <div className="mt-4 rounded-lg border border-zinc-800 bg-[#1a1e24] overflow-hidden">
	              <div className="flex flex-col gap-1 border-b border-zinc-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
	                <h3 className="text-sm font-semibold text-zinc-200">Recovered From Retargeting</h3>
	                <div className="text-xs text-zinc-500">
	                  {macraScoreboardSummary.retargetingTrialRedemptions} offer redemptions · {macraScoreboardSummary.retargetingPaidConversions} paid after trial
	                </div>
	              </div>
	              <div className="overflow-x-auto">
	                <table className="w-full min-w-[1120px] text-sm">
	                  <thead className="bg-zinc-900/70">
	                    <tr>
	                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">User</th>
	                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Recovery status</th>
	                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Offer activity</th>
	                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Plan</th>
	                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Paid invoice</th>
	                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Latest signal</th>
	                    </tr>
	                  </thead>
	                  <tbody className="divide-y divide-zinc-800">
	                    {macraScoreboardSummary.recoveredUsers.length ? (
	                      macraScoreboardSummary.recoveredUsers.map((user) => {
	                        const offerActivity = [
	                          user.signals.webOfferSentAt ? `Sent ${formatScoreboardAgo(user.signals.webOfferSentAt)}` : '',
	                          user.signals.stripeRetargetClickedAt ? `Clicked ${formatScoreboardAgo(user.signals.stripeRetargetClickedAt)}` : '',
	                          user.signals.webOfferCheckoutStartedAt ? `Checkout ${formatScoreboardAgo(user.signals.webOfferCheckoutStartedAt)}` : '',
	                          user.signals.webOfferConvertedAt ? `Redeemed ${formatScoreboardAgo(user.signals.webOfferConvertedAt)}` : '',
	                        ].filter(Boolean);
	                        const statusLabel = user.signals.webOfferPaidAt ? 'Paid after trial' : '30-day offer redeemed';
	                        return (
	                          <tr key={user.id} className="hover:bg-zinc-900/30">
	                            <td className="px-4 py-3">
	                              <div className="font-medium text-zinc-100">{user.displayName}</div>
	                              <div className="text-xs text-zinc-500">{user.email || user.id}</div>
	                            </td>
	                            <td className="px-4 py-3">
	                              <span className={`inline-flex w-max whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${
	                                user.signals.webOfferPaidAt
	                                  ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
	                                  : 'border-lime-400/30 bg-lime-400/10 text-lime-200'
	                              }`}>
	                                {statusLabel}
	                              </span>
	                            </td>
	                            <td className="px-4 py-3 text-zinc-400">{offerActivity.join(' · ') || 'Recovered from offer link'}</td>
	                            <td className="px-4 py-3 text-zinc-300">
	                              {user.signals.webOfferPlan ? titleizeScoreboardToken(user.signals.webOfferPlan) : 'Macra web offer'}
	                              {user.signals.webOfferTrialDays ? (
	                                <div className="mt-0.5 text-xs text-zinc-500">{user.signals.webOfferTrialDays}-day trial</div>
	                              ) : null}
	                            </td>
	                            <td className="px-4 py-3 text-zinc-300">
	                              <div>{formatScoreboardMoney(user.signals.webOfferPaidAmount, user.signals.webOfferPaidCurrency || 'USD')}</div>
	                              {user.signals.webOfferPaidAt ? (
	                                <div className="mt-0.5 text-xs text-zinc-500">{formatScoreboardDate(user.signals.webOfferPaidAt)}</div>
	                              ) : null}
	                            </td>
	                            <td className="px-4 py-3 text-xs text-zinc-500">
	                              {formatScoreboardDate(Math.max(user.signals.webOfferPaidAt || 0, user.signals.webOfferConvertedAt || 0))}
	                            </td>
	                          </tr>
	                        );
	                      })
	                    ) : (
	                      <tr>
	                        <td className="px-4 py-5 text-sm text-zinc-500" colSpan={6}>
	                          {macraScoreboard.loading ? 'Loading recovered users...' : 'No retargeting recoveries found in the loaded cohort yet.'}
	                        </td>
	                      </tr>
	                    )}
	                  </tbody>
	                </table>
	              </div>
	            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-zinc-800 bg-[#1a1e24] overflow-hidden">
                <div className="border-b border-zinc-800 px-4 py-3">
                  <h3 className="text-sm font-semibold text-zinc-200">Serious vs Curiosity Buckets</h3>
                </div>
                <div className="divide-y divide-zinc-800">
                  {macraScoreboardSummary.tierRows.length ? (
                    macraScoreboardSummary.tierRows.map((row) => (
                      <div key={row.tier} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-zinc-200">{row.label}</div>
                          <div className="text-xs text-zinc-500">{formatScoreboardPercent(row.count, macraScoreboard.users.length)} of loaded users</div>
                        </div>
                        <div className="text-lg font-bold text-white">{row.count}</div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-5 text-sm text-zinc-500">
                      {macraScoreboard.loading ? 'Loading cohorts...' : 'No Macra users loaded yet.'}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-[#1a1e24] overflow-hidden">
                <div className="border-b border-zinc-800 px-4 py-3">
                  <h3 className="text-sm font-semibold text-zinc-200">Qualification Gaps</h3>
                </div>
                <div className="divide-y divide-zinc-800">
                  {macraScoreboardSummary.disqualifierRows.length ? (
                    macraScoreboardSummary.disqualifierRows.map((row) => (
                      <div key={row.key} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="text-sm text-zinc-300">{row.label}</div>
                        <div className="text-sm font-bold text-zinc-100">{row.count}</div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-5 text-sm text-zinc-500">
                      {macraScoreboard.loading ? 'Loading gaps...' : 'No qualification gaps in the loaded cohort.'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-zinc-800 bg-[#1a1e24] overflow-hidden">
              <div className="flex flex-col gap-1 border-b border-zinc-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold text-zinc-200">Highest-Intent Recovery Pool</h3>
                <div className="text-xs text-zinc-500">
                  Email logs loaded: {macraScoreboard.emailLogCount} · Purchase logs loaded: {macraScoreboard.purchaseLogCount}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1350px] text-sm">
                  <thead className="bg-zinc-900/70">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Bucket</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Intent</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 whitespace-nowrap">Suggested lane</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Next email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 whitespace-nowrap">Eligible since</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {macraScoreboardSummary.recoveryPool.length ? (
                      macraScoreboardSummary.recoveryPool.map((user) => {
                        const intentSignals = [
                          user.signals.appleCancelAt ? `Apple cancel ${formatScoreboardAgo(user.signals.appleCancelAt)}` : '',
                          user.signals.ctaTappedAt ? `CTA tap ${formatScoreboardAgo(user.signals.ctaTappedAt)}` : '',
                          user.signals.stripeRetargetClickedAt ? `Stripe click ${formatScoreboardAgo(user.signals.stripeRetargetClickedAt)}` : '',
                          user.signals.webOfferOpenedAt ? `Offer open ${formatScoreboardAgo(user.signals.webOfferOpenedAt)}` : '',
                          user.signals.paywallViewCount >= 2 ? `${user.signals.paywallViewCount} paywall views` : '',
                        ].filter(Boolean);
                        const nextEmail = user.nextRetargetingEmail;
                        const isSendingNow = sendingRetargetingNowUserId === user.id;
                        const scheduledSendAt = nextEmail ? estimateMacraScheduledSendAt(nextEmail, macraScoreboard.config) : null;
                        const schedulerPaused = Boolean(nextEmail && macraScoreboard.config?.enabled === false);
                        return (
                          <tr key={user.id} className="hover:bg-zinc-900/30">
                            <td className="px-4 py-3">
                              <div className="font-medium text-zinc-100">{user.displayName}</div>
                              <div className="text-xs text-zinc-500">{user.email || user.id}</div>
                            </td>
                            <td className="px-4 py-3 text-zinc-300">{user.tierLabel}</td>
                            <td className="px-4 py-3 text-zinc-400">
                              {intentSignals.length ? intentSignals.join(' · ') : 'No recent intent signal'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex w-max whitespace-nowrap rounded-full border border-[#d7ff00]/30 bg-[#d7ff00]/10 px-2.5 py-1 text-xs font-semibold text-[#d7ff00]">
                                {user.suggestedLane}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {nextEmail ? (
                                <div className="flex flex-col gap-2">
                                  <div>
                                    <div className="font-medium text-zinc-200">{nextEmail.label}</div>
                                    <div className="text-xs text-zinc-500">
                                      {nextEmail.status === 'pending' ? (
                                        'Send already in progress'
                                      ) : schedulerPaused ? (
                                        'Scheduler paused'
                                      ) : scheduledSendAt ? (
                                        <>
                                          <span>Sends {formatScoreboardDate(scheduledSendAt)} · </span>
                                          <span className={getScoreboardSendUrgencyClass(scheduledSendAt)}>
                                            {formatScoreboardAgo(scheduledSendAt)}
                                          </span>
                                        </>
                                      ) : (
                                        'No scheduled send time'
                                      )}
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-zinc-600">{nextEmail.reason}</div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => openRetargetingTemplatePreview(user)}
                                      disabled={loadingTemplate}
                                      className={`inline-flex w-fit items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${loadingTemplate
                                        ? 'cursor-not-allowed border-zinc-800 bg-zinc-800 text-zinc-500'
                                        : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                                        }`}
                                      title={`Preview and edit ${nextEmail.label}`}
                                    >
                                      {loadingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                                      Preview
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => sendMacraRetargetingNow(user)}
                                      disabled={!nextEmail.canSendNow || isSendingNow}
                                      className={`inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${!nextEmail.canSendNow || isSendingNow
                                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                        : 'bg-[#d7ff00] text-black hover:bg-[#c5eb00]'
                                        }`}
                                    >
                                      {isSendingNow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                      Send now
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-zinc-500">
                                  {user.tier === 'excluded' || user.disqualifiers.includes('missing_age')
                                    ? 'Not eligible for retargeting email'
                                    : 'No remaining retargeting email'}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-zinc-500">
                              {nextEmail ? (
                                <div>
                                  <div>{formatScoreboardDate(nextEmail.dueAt)}</div>
                                  <div className="mt-0.5 text-[11px] text-zinc-600">{formatScoreboardAgo(nextEmail.dueAt)}</div>
                                </div>
                              ) : (
                                'Not eligible'
                              )}
                            </td>
                            <td className="px-4 py-3 text-zinc-400">
                              <div>
                                {user.signals.goalDirection ? titleizeScoreboardToken(user.signals.goalDirection) : 'Goal unknown'}
                                {user.signals.macroCalories ? ` · ${Math.round(user.signals.macroCalories)} cal` : ''}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {user.signals.biggestStruggle ? titleizeScoreboardToken(user.signals.biggestStruggle) : 'Struggle unknown'}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-sm text-zinc-500">
                          {macraScoreboard.loading ? 'Loading recovery pool...' : 'No high-intent, unconverted users in the loaded cohort.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
          ) : null}

          {activeAdminTab === 'sequences' ? (
          <div className="bg-[#1a1e24] rounded-xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold">Sequence List</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/70">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Trigger</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Subject</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {SEQUENCES.map((seq) => {
                    const scheduleEnabled = isScheduleEnabled(seq);
                    const campaignConfig = getCampaignConfig(seq);
                    const showCampaignControls = hasCampaignControls(seq);
                    return (
                    <tr key={seq.id} className="hover:bg-zinc-900/30">
                      <td className="px-4 py-3 text-zinc-200 font-medium">{seq.name}</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {seq.trigger}
                        <div className="text-xs text-zinc-500 mt-1">
                          Runtime: {seq.deliveryRuntime === 'firebase' ? 'Firebase Functions' : 'Netlify Functions'}
                        </div>
                        {seq.scheduleConfigDocId ? (
                          <div className="mt-2 space-y-1">
                            <div
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${scheduleEnabled
                                ? 'bg-green-900/20 border-green-700/70 text-green-300'
                                : 'bg-amber-900/20 border-amber-700/70 text-amber-300'
                                }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${scheduleEnabled ? 'bg-green-300' : 'bg-amber-300'}`} />
                              {scheduleEnabled ? 'Enabled' : 'Paused'}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {seq.scheduleDescription || 'Scheduled automation'}
                            </div>
                            {showCampaignControls ? (
                              <>
                                <div className="text-xs text-zinc-500">
                                  Delay: {campaignConfig.delayHours}h · Batch: {campaignConfig.batchLimit} · Max sends/run: {campaignConfig.maxSendsPerRun}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  Scan every {campaignConfig.scanEveryHours}h · Window: {campaignConfig.sendWindowStartLocal}-{campaignConfig.sendWindowEndLocal} Eastern
                                </div>
                              </>
                            ) : null}
                            {seq.supportsScheduleTime !== false ? (
                              <div className="text-xs text-zinc-500">
                                Send time: {(scheduleTimeById[seq.id] || '14:00').trim()} UTC
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{seq.defaultSubject}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {seq.openInAdminPath ? (
                            <a
                              href={seq.openInAdminPath}
                              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                              title={seq.openInAdminLabel || 'Open in admin'}
                            >
                              <Eye className="w-4 h-4" />
                              {seq.openInAdminLabel || 'Open'}
                            </a>
                          ) : null}
                          {seq.scheduleConfigDocId ? (
                            <>
                              <button
                                onClick={() => toggleScheduleEnabled(seq)}
                                disabled={savingScheduleId === seq.id}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${scheduleEnabled
                                  ? 'bg-amber-900/30 hover:bg-amber-900/50 text-amber-200 border border-amber-800/60'
                                  : 'bg-green-900/30 hover:bg-green-900/50 text-green-200 border border-green-800/60'
                                  }`}
                                title={scheduleEnabled ? 'Pause this automation' : 'Enable this automation'}
                              >
                                {savingScheduleId === seq.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {scheduleEnabled ? 'Pause' : 'Enable'}
                              </button>
                              <button
                                onClick={() => openScheduleModal(seq)}
                                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                                title="Edit automation settings"
                              >
                                <Clock className="w-4 h-4" />
                                {showCampaignControls ? 'Configure' : 'Settings'}
                              </button>
                            </>
                          ) : null}
                          {seq.supportsTemplateEditing !== false ? (
                            <button
                              onClick={() => openEditModal(seq)}
                              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                              View / edit
                            </button>
                          ) : null}
                          {seq.supportsTestSend !== false ? (
                            <button
                              onClick={() => openTestModal(seq)}
                              className="flex items-center gap-2 px-3 py-2 bg-[#d7ff00] text-black hover:bg-[#c5eb00] rounded-lg text-sm font-medium transition-colors"
                            >
                              <Send className="w-4 h-4" />
                              Send test
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          ) : null}
        </div>
      </div>

      {isTestModalOpen && activeSequence && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white">Send test email</h2>
                <p className="text-sm text-zinc-400 mt-1">{activeSequence.name}</p>
              </div>
              <button
                onClick={() => setIsTestModalOpen(false)}
                disabled={sending}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Test email address</label>
                <input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors"
                  disabled={sending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Name (optional)</label>
                <input
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="Tremaine"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors"
                  disabled={sending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  User ID {activeTestRequiresUserId ? '(required for this sequence)' : '(optional)'}
                </label>
                <input
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  placeholder="Paste a real user ID for signed offer links"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors"
                  disabled={sending}
                />
                <p className="text-xs text-zinc-500 mt-2">
                  Macra offer CTAs need this so the signed checkout bridge can apply the offer to the correct account.
                </p>
                {lastTestCheckoutUrl ? (
                  <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-900/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-zinc-400 truncate">{lastTestCheckoutUrl}</p>
                      <button
                        type="button"
                        onClick={copyLastTestCheckoutUrl}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => setIsTestModalOpen(false)}
                disabled={sending}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendTest}
                disabled={sending || !testEmail.trim() || (activeTestRequiresUserId && !testUserId.trim())}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${sending || !testEmail.trim() || (activeTestRequiresUserId && !testUserId.trim())
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-[#d7ff00] text-black hover:bg-[#c5eb00]'
                  }`}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send test
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isScheduleModalOpen && scheduleEditingSequence && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-zinc-300" />
                  {hasCampaignControls(scheduleEditingSequence) ? 'Configure campaign' : 'Automation settings'}
                </h2>
                <p className="text-sm text-zinc-400 mt-1">{scheduleEditingSequence.name}</p>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                disabled={savingSchedule}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(90vh-180px)] overflow-y-auto">
              <label className="flex items-center justify-between gap-4 rounded-xl border border-zinc-700 bg-zinc-900/70 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-white">Automation enabled</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Disabled automations exit before scanning users or sending email.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={scheduleEnabledDraft}
                  onChange={(e) => setScheduleEnabledDraft(e.target.checked)}
                  disabled={savingSchedule}
                  className="h-5 w-5 accent-[#d7ff00]"
                />
              </label>

              {scheduleEditingSequence.scheduleDescription ? (
                <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Schedule</div>
                  <div className="text-sm text-zinc-300">{scheduleEditingSequence.scheduleDescription}</div>
                </div>
              ) : null}

              {hasCampaignControls(scheduleEditingSequence) ? (
                <div className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-4">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="text-sm font-semibold text-white">Campaign launch controls</div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Use a small max-send cap for canaries, then increase it after the first run looks clean.
                      </div>
                    </div>
                    <span className="rounded-full border border-[#d7ff00]/30 bg-[#d7ff00]/10 px-2.5 py-1 text-[11px] font-bold text-[#d7ff00]">
                      Canary-safe
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">
                        {scheduleConfigIsRetargeting ? 'Cooldown between emails' : 'Delay after onboarding'}
                      </label>
                      <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 focus-within:border-[#d7ff00]">
                        <input
                          type="number"
                          min={1}
                          max={168}
                          step={1}
                          value={delayHoursDraft}
                          onChange={(e) => setDelayHoursDraft(e.target.value)}
                          disabled={savingSchedule}
                          className="w-full bg-transparent px-3 py-3 text-white outline-none"
                        />
                        <span className="pr-3 text-xs text-zinc-500">hours</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Users scanned/run</label>
                      <input
                        type="number"
                        min={25}
                        max={1000}
                        step={1}
                        value={batchLimitDraft}
                        onChange={(e) => setBatchLimitDraft(e.target.value)}
                        disabled={savingSchedule}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-[#d7ff00]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Max sends/run</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        step={1}
                        value={maxSendsPerRunDraft}
                        onChange={(e) => setMaxSendsPerRunDraft(e.target.value)}
                        disabled={savingSchedule}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-[#d7ff00]"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Scan frequency</label>
                      <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 focus-within:border-[#d7ff00]">
                        <input
                          type="number"
                          min={1}
                          max={24}
                          step={1}
                          value={scanEveryHoursDraft}
                          onChange={(e) => setScanEveryHoursDraft(e.target.value)}
                          disabled={savingSchedule}
                          className="w-full bg-transparent px-3 py-3 text-white outline-none"
                        />
                        <span className="pr-3 text-xs text-zinc-500">hours</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Window starts</label>
                      <select
                        value={sendWindowStartDraft}
                        onChange={(e) => setSendWindowStartDraft(e.target.value)}
                        disabled={savingSchedule}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-[#d7ff00]"
                      >
                        {scheduleOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Window ends</label>
                      <select
                        value={sendWindowEndDraft}
                        onChange={(e) => setSendWindowEndDraft(e.target.value)}
                        disabled={savingSchedule}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-[#d7ff00]"
                      >
                        {scheduleOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    Send windows use Eastern time. If the start time is later than the end time, the window wraps overnight.
                  </p>

                  <div className="mt-3 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
                    {scheduleConfigIsRetargeting
                      ? 'Recommended first launch: 24h cooldown, scan 50 users, max 5 sends per run, scan every 3h during your preferred Eastern-time window.'
                      : 'Recommended first launch: delay 24h, scan 50 users, max 5 sends per run, scan every 3h during your preferred Eastern-time window.'}
                  </div>
                </div>
              ) : null}

              {scheduleEditingSequence.supportsScheduleTime !== false ? (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Daily send time (UTC)</label>
                  <select
                    value={scheduleTimeDraft}
                    onChange={(e) => setScheduleTimeDraft(e.target.value)}
                    disabled={savingSchedule}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-[#d7ff00] transition-colors"
                  >
                    {scheduleOptions.map((t) => (
                      <option key={t} value={t}>
                        {t} UTC
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-zinc-500 mt-2">
                    Note: times are in 30-minute increments.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  This automation runs on the Netlify cron schedule shown above; this admin switch controls whether it is allowed to send.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                disabled={savingSchedule}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveScheduleTime}
                disabled={savingSchedule}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${savingSchedule ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' : 'bg-[#d7ff00] text-black hover:bg-[#c5eb00]'
                  }`}
              >
                {savingSchedule ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save automation'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && activeSequence && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-zinc-300" />
                  Edit email template
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  {activeSequence.name}
                  {templateLoadedFromFirestore ? ' • Saved template' : ' • Default loaded for editing'}
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                disabled={savingTemplate || loadingTemplate}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Modal message banner (so Save feedback is visible even with the overlay) */}
            {message && (
              <div className="px-6 pt-6">
                <div
                  className={`p-4 rounded-xl border ${message.type === 'success'
                    ? 'bg-green-900/20 border-green-800 text-green-400'
                    : message.type === 'error'
                      ? 'bg-red-900/20 border-red-800 text-red-400'
                      : 'bg-blue-900/20 border-blue-800 text-blue-400'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    {message.type === 'success' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                    {message.text}
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {loadingTemplate ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-10 h-10 animate-spin text-[#d7ff00]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Subject</label>
                      <input
                        value={templateSubject}
                        onChange={(e) => setTemplateSubject(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-zinc-400">HTML</label>
                        <button
                          type="button"
                          onClick={copyHtmlToClipboard}
                          disabled={!templateHtml.trim()}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200"
                          title="Copy HTML to clipboard"
                        >
                          <Copy className="w-4 h-4" />
                          Copy HTML
                        </button>
                      </div>
                      <textarea
                        value={templateHtml}
                        onChange={(e) => {
                          const nextHtml = e.target.value;
                          setTemplateHtml(nextHtml);
                          setTemplatePreviewSource(nextHtml.trim() ? 'draft' : 'default');
                        }}
                        placeholder="Paste the full HTML email here (<!doctype html> ...)"
                        className="w-full h-[520px] px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors resize-none font-mono text-xs"
                      />
                      <p className="text-xs text-zinc-500 mt-2">
                        This HTML is what gets sent to users when saved. Defaults are loaded as an editable draft until you save a custom template.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          Preview
                        </h3>
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${hasTemplateHtml
                          ? 'bg-blue-900/20 border-blue-700/60 text-blue-200'
                          : 'bg-[#d7ff00]/10 border-[#d7ff00]/30 text-[#d7ff00]'
                          }`}>
                          {previewSourceLabel}
                        </span>
                      </div>
                      <a
                        className="shrink-0 text-xs text-zinc-400 underline"
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          const w = window.open('', '_blank');
                          if (w) {
                            w.document.open();
                            w.document.write(previewSrcDoc || '<p>No preview available</p>');
                            w.document.close();
                          }
                        }}
                      >
                        Open in new tab
                      </a>
                    </div>
                    {!hasTemplateHtml ? (
                      <p className="text-xs text-zinc-500">
                        Previewing the default fallback. Add HTML to override it.
                      </p>
                    ) : null}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                      <iframe
                        title="Email preview"
                        srcDoc={previewSrcDoc || '<p style=\"color:#999;font-family:Arial\">No preview available</p>'}
                        style={{ width: '100%', height: 640, border: 'none', background: '#0a0a0b' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => setIsEditModalOpen(false)}
                disabled={savingTemplate || loadingTemplate}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
              <button
                onClick={saveTemplate}
                disabled={savingTemplate || loadingTemplate || !templateSubject.trim() || !templateHtml.trim()}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${savingTemplate || loadingTemplate || !templateSubject.trim() || !templateHtml.trim()
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-[#d7ff00] text-black hover:bg-[#c5eb00]'
                  }`}
              >
                {savingTemplate ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save template'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default EmailSequencesAdmin;
