import type { Handler } from '@netlify/functions';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import {
  buildEmailDedupeKey,
  claimScheduledSequenceSend,
  finalizeScheduledSequenceSend,
  getBaseSiteUrl,
  releaseScheduledSequenceSend,
  toMillis,
} from './utils/emailSequenceHelpers';
import { evaluateMacraEmailEligibility } from './utils/macraEmailEligibility';

const {
  hasActiveRootSubscription,
  hasActiveSubscriptionPlan,
} = require('./utils/macraStripe');

const CONFIG_ID = 'macra-retargeting-v1';
const DEFAULT_BATCH_LIMIT = 250;
const DEFAULT_MAX_SENDS_PER_RUN = 80;
const DEFAULT_SCAN_EVERY_HOURS = 1;
const DEFAULT_COOLDOWN_HOURS = 24;
const DEFAULT_SEND_WINDOW_START_LOCAL = '09:00';
const DEFAULT_SEND_WINDOW_END_LOCAL = '17:00';
const DEFAULT_SEND_WINDOW_TIMEZONE = 'America/New_York';

type Config = {
  enabled: boolean;
  batchLimit: number;
  maxSendsPerRun: number;
  scanEveryHours: number;
  cooldownHours: number;
  paywallCancelDelayHours: number;
  webOfferProofDelayHours: number;
  paywallViewDelayHours: number;
  paywallViewMinCount: number;
  noTrialDelayHours: number;
  trialActivationDelayHours: number;
  sendWindowStartLocal: string;
  sendWindowEndLocal: string;
  sendWindowTimezone: string;
  lastScanAt?: any;
  lastScanCursorUserId?: string;
};

type PurchaseSignals = {
  latestAttemptedAt: number | null;
  latestCanceledAt: number | null;
  latestSucceededAt: number | null;
  latestTrialSucceededAt: number | null;
  latestStatus: string;
  latestCancelReason: string;
};

type SubscriptionState = {
  hasActive: boolean;
  rootTrialing: boolean;
  subscriptionDocActive: boolean;
  anchorMs: number | null;
};

type Rule = {
  sequenceId: string;
  stateKey: string;
  sendFunctionPath: string;
};

type RuleMatch = {
  rule: Rule;
  reason: string;
  anchorMs: number;
  metadata?: Record<string, any>;
};

type SendResult = {
  skipped?: boolean;
  messageId?: string;
};

const RULES = {
  paywallCancelTrust: {
    sequenceId: 'macra-paywall-cancel-trust-v1',
    stateKey: 'paywallCancelTrust',
    sendFunctionPath: '/.netlify/functions/send-macra-paywall-cancel-trust-email',
  },
  webOfferProof: {
    sequenceId: 'macra-web-offer-proof-v1',
    stateKey: 'webOfferProof',
    sendFunctionPath: '/.netlify/functions/send-macra-web-offer-proof-email',
  },
  paywallViewValue: {
    sequenceId: 'macra-paywall-view-value-v1',
    stateKey: 'paywallViewValue',
    sendFunctionPath: '/.netlify/functions/send-macra-paywall-view-value-email',
  },
  noTrial7dChallenge: {
    sequenceId: 'macra-no-trial-7d-challenge-v1',
    stateKey: 'noTrial7dChallenge',
    sendFunctionPath: '/.netlify/functions/send-macra-no-trial-challenge-email',
  },
  trialActivation: {
    sequenceId: 'macra-trial-no-activation-24h-v1',
    stateKey: 'trialNoActivation24h',
    sendFunctionPath: '/.netlify/functions/send-macra-trial-activation-email',
  },
} satisfies Record<string, Rule>;

const RETARGETING_SENT_FIELDS = [
  'webOffer24hSentAt',
  'paywallCancelTrustSentAt',
  'webOfferProofSentAt',
  'paywallViewValueSentAt',
  'noTrial7dChallengeSentAt',
  'trialNoActivation24hSentAt',
];

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeLocalTime(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{2}:\d{2}$/.test(raw)) return fallback;

  const [hourRaw, minuteRaw] = raw.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeTimezone(value: unknown): string {
  const timezone = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_SEND_WINDOW_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return DEFAULT_SEND_WINDOW_TIMEZONE;
  }
}

function minutesFromLocalTime(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function getLocalTimeState(nowMs: number, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(new Date(nowMs));
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  const hour = Number(lookup.get('hour') || 0);
  const minute = Number(lookup.get('minute') || 0);
  const dateKey = `${lookup.get('year')}-${lookup.get('month')}-${lookup.get('day')}`;

  return {
    dateKey,
    minutesSinceMidnight: hour * 60 + minute,
    label: `${dateKey} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${timezone}`,
  };
}

function isWithinSendWindow(args: {
  nowMs: number;
  startLocal: string;
  endLocal: string;
  timezone: string;
}) {
  const local = getLocalTimeState(args.nowMs, args.timezone);
  const startMinutes = minutesFromLocalTime(args.startLocal);
  const endMinutes = minutesFromLocalTime(args.endLocal);
  const withinWindow =
    startMinutes === endMinutes
      ? true
      : startMinutes < endMinutes
        ? local.minutesSinceMidnight >= startMinutes && local.minutesSinceMidnight < endMinutes
        : local.minutesSinceMidnight >= startMinutes || local.minutesSinceMidnight < endMinutes;

  return { withinWindow, local };
}

function getScanFrequencyState(config: Config, nowMs: number) {
  const lastScanMs = toMillis(config.lastScanAt);
  if (!lastScanMs) {
    return { due: true, lastScanMs: null, nextScanAt: null };
  }

  const intervalMs = config.scanEveryHours * 60 * 60 * 1000;
  const nextScanAt = lastScanMs + intervalMs;
  return {
    due: nowMs >= nextScanAt,
    lastScanMs,
    nextScanAt,
  };
}

function maxMillis(...values: unknown[]): number | null {
  const millis = values
    .map((value) => toMillis(value))
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return millis.length ? Math.max(...millis) : null;
}

function firstMillis(...values: unknown[]): number | null {
  for (const value of values) {
    const millis = toMillis(value);
    if (typeof millis === 'number' && Number.isFinite(millis)) return millis;
  }
  return null;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getNestedValue(source: Record<string, any>, path: string): any {
  if (!source || !path) return undefined;
  return path.split('.').reduce<any>((acc, part) => (acc === null || acc === undefined ? undefined : acc[part]), source);
}

function isRuleResolved(state: Record<string, any>, rule: Rule): boolean {
  return Boolean(state[`${rule.stateKey}SentAt`] || state[`${rule.stateKey}SkippedAt`]);
}

function hasRecentEnoughAnchor(anchorMs: number | null, nowMs: number, delayHours: number): boolean {
  return Boolean(anchorMs && nowMs - anchorMs >= delayHours * 60 * 60 * 1000);
}

function hasMacraOrigin(data: Record<string, any>): boolean {
  const entryPoint = String(data.registrationEntryPoint || data.originRegistrationSource || '').trim().toLowerCase();
  return entryPoint === 'macra' || Boolean(data.hasCompletedMacraOnboarding);
}

function latestRetargetingSentMs(state: Record<string, any>): number | null {
  return maxMillis(...RETARGETING_SENT_FIELDS.map((field) => state[field]));
}

function onboardingAnchorMs(data: Record<string, any>): number | null {
  return firstMillis(data.macraOnboardingCompletedAt, data.createdAt, data.updatedAt);
}

function paywallViewSignal(data: Record<string, any>, state: Record<string, any>) {
  const count = Math.max(
    numberValue(data.macraPaywallViewCount),
    numberValue(getNestedValue(data, 'macraPaywall.viewCount')),
    numberValue(getNestedValue(data, 'macraAnalytics.paywallViewCount')),
    numberValue(state.paywallViewCount),
    numberValue(getNestedValue(state, 'paywallView.count'))
  );
  const lastViewedAt = maxMillis(
    data.macraLatestPaywallViewedAt,
    data.macraPaywallViewedAt,
    getNestedValue(data, 'macraPaywall.lastViewedAt'),
    getNestedValue(data, 'macraAnalytics.lastPaywallViewedAt'),
    state.paywallViewedAt,
    state.paywallLastViewedAt,
    getNestedValue(state, 'paywallView.lastViewedAt')
  );

  return { count, lastViewedAt };
}

function cancelFeedbackAnchorMs(data: Record<string, any>): number | null {
  return maxMillis(
    data.macraLatestPaywallCancelFeedbackAt,
    getNestedValue(data, 'macraLatestPaywallCancelFeedback.capturedAt')
  );
}

async function loadConfig(db: any): Promise<Config> {
  const snap = await db.collection('email-sequence-config').doc(CONFIG_ID).get();
  const data = (snap.exists ? snap.data() || {} : {}) as Record<string, any>;
  return {
    enabled: data.enabled === true,
    batchLimit: Math.max(25, Number(data.batchLimit || DEFAULT_BATCH_LIMIT) || DEFAULT_BATCH_LIMIT),
    maxSendsPerRun: Math.max(1, Number(data.maxSendsPerRun || DEFAULT_MAX_SENDS_PER_RUN) || DEFAULT_MAX_SENDS_PER_RUN),
    scanEveryHours: Math.max(1, Number(data.scanEveryHours || DEFAULT_SCAN_EVERY_HOURS) || DEFAULT_SCAN_EVERY_HOURS),
    cooldownHours: Math.max(1, Number(data.cooldownHours || data.delayHours || DEFAULT_COOLDOWN_HOURS) || DEFAULT_COOLDOWN_HOURS),
    paywallCancelDelayHours: Math.max(0, Number(data.paywallCancelDelayHours ?? 1) || 0),
    webOfferProofDelayHours: Math.max(0, Number(data.webOfferProofDelayHours ?? 4) || 0),
    paywallViewDelayHours: Math.max(1, Number(data.paywallViewDelayHours || 24) || 24),
    paywallViewMinCount: Math.max(1, Number(data.paywallViewMinCount || 2) || 2),
    noTrialDelayHours: Math.max(24, Number(data.noTrialDelayHours || 168) || 168),
    trialActivationDelayHours: Math.max(1, Number(data.trialActivationDelayHours || 24) || 24),
    sendWindowStartLocal: normalizeLocalTime(data.sendWindowStartLocal, DEFAULT_SEND_WINDOW_START_LOCAL),
    sendWindowEndLocal: normalizeLocalTime(data.sendWindowEndLocal, DEFAULT_SEND_WINDOW_END_LOCAL),
    sendWindowTimezone: normalizeTimezone(data.sendWindowTimezone),
    lastScanAt: data.lastScanAt,
    lastScanCursorUserId: typeof data.lastScanCursorUserId === 'string' ? data.lastScanCursorUserId : '',
  };
}

async function loadUserBatch(db: any, config: Config) {
  const FieldPath = initAdmin().firestore.FieldPath;
  const collection = db.collection('users');
  const baseQuery = collection.orderBy(FieldPath.documentId()).limit(config.batchLimit);
  const cursor = (config.lastScanCursorUserId || '').trim();
  let snap = cursor ? await baseQuery.startAfter(cursor).get() : await baseQuery.get();
  let wrapped = false;

  if (snap.empty && cursor) {
    snap = await baseQuery.get();
    wrapped = true;
  }

  const docs = snap.docs || [];
  const nextCursorUserId = docs.length ? docs[docs.length - 1].id : cursor || '';
  return { docs, nextCursorUserId, wrapped };
}

async function loadPurchaseSignals(db: any, userId: string): Promise<PurchaseSignals> {
  const empty: PurchaseSignals = {
    latestAttemptedAt: null,
    latestCanceledAt: null,
    latestSucceededAt: null,
    latestTrialSucceededAt: null,
    latestStatus: '',
    latestCancelReason: '',
  };

  try {
    const snap = await db
      .collection('Macra-purchase-logs')
      .where('userId', '==', userId)
      .limit(25)
      .get();

    const rows = snap.docs
      .map((doc: any) => doc.data() || {})
      .map((data: Record<string, any>) => {
        const status = normalizeStatus(data.purchaseStatus || data.status);
        const occurredAt =
          toMillis(data.updatedAtEpoch) ||
          toMillis(data.createdAtEpoch) ||
          toMillis(data.updatedAt) ||
          toMillis(data.createdAt);
        return { data, status, occurredAt };
      })
      .filter((row: any) => row.occurredAt)
      .sort((a: any, b: any) => b.occurredAt - a.occurredAt);

    if (!rows.length) return empty;

    const latest = rows[0];
    const latestAttempted = rows.find((row: any) => row.status === 'attempted');
    const latestCanceled = rows.find((row: any) => row.status === 'canceled' || row.status === 'cancelled');
    const latestSucceeded = rows.find((row: any) => row.status === 'success' || row.status === 'succeeded');
    const latestTrialSucceeded = rows.find((row: any) => {
      if (!(row.status === 'success' || row.status === 'succeeded')) return false;
      return numberValue(row.data?.plan?.trialDays) > 0;
    });

    return {
      latestAttemptedAt: latestAttempted?.occurredAt || null,
      latestCanceledAt: latestCanceled?.occurredAt || null,
      latestSucceededAt: latestSucceeded?.occurredAt || null,
      latestTrialSucceededAt: latestTrialSucceeded?.occurredAt || null,
      latestStatus: latest.status || '',
      latestCancelReason: latestCanceled?.data?.cancelReasonCode || latestCanceled?.data?.failureReason || '',
    };
  } catch (error) {
    console.warn('[schedule-macra-retargeting-email] Failed to load purchase logs:', userId, error);
    return empty;
  }
}

async function loadSubscriptionState(
  db: any,
  userId: string,
  data: Record<string, any>,
  state: Record<string, any>,
  nowMs: number
): Promise<SubscriptionState> {
  const trialEndMs = toMillis(data.trialEndDate);
  const rootTrialing = Boolean(data.isTrialing && trialEndMs && trialEndMs > nowMs);
  const inferredTrialStartMs = rootTrialing && trialEndMs ? trialEndMs - 30 * 24 * 60 * 60 * 1000 : null;
  const rootActive = hasActiveRootSubscription(data, nowMs);
  let subscriptionDocActive = false;
  let subscriptionAnchorMs: number | null = null;

  try {
    const snap = await db.collection('subscriptions').doc(userId).get();
    if (snap.exists) {
      const sub = snap.data() || {};
      subscriptionAnchorMs = firstMillis(sub.createdAt, sub.startedAt, sub.updatedAt);
      subscriptionDocActive = await hasActiveSubscriptionPlan({ db, userId, nowMs });
    }
  } catch (error) {
    console.warn('[schedule-macra-retargeting-email] Failed to load subscription state:', userId, error);
  }

  return {
    hasActive: Boolean(rootActive || subscriptionDocActive),
    rootTrialing,
    subscriptionDocActive,
    anchorMs: firstMillis(data.trialStartDate, data.subscriptionStartedAt, state.webOffer24hConvertedAt, subscriptionAnchorMs, inferredTrialStartMs),
  };
}

async function hasMacraActivation(db: any, userId: string, data: Record<string, any>): Promise<boolean> {
  if (maxMillis(data.lastMacraLogAt, data.firstMacraLogAt, data.lastMacraMealLoggedAt)) return true;

  const checks = [
    db.collection('users').doc(userId).collection('mealLogs').limit(1).get(),
    db.collection('users').doc(userId).collection('labelScans').limit(1).get(),
    db.collection('users').doc(userId).collection('noraChat').limit(1).get(),
  ];

  try {
    const snaps = await Promise.all(checks);
    return snaps.some((snap: any) => !snap.empty);
  } catch (error) {
    console.warn('[schedule-macra-retargeting-email] Failed to load activation state:', userId, error);
    return false;
  }
}

async function sendRetargetingEmail(args: { rule: Rule; userId: string }): Promise<SendResult> {
  const resp = await fetch(`${getBaseSiteUrl()}${args.rule.sendFunctionPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: args.userId }),
  });
  const json = await resp.json().catch(() => ({} as any));
  if (!resp.ok || json?.success === false) {
    throw new Error(json?.error || `HTTP ${resp.status}`);
  }
  return { skipped: Boolean(json?.skipped), messageId: json?.messageId };
}

async function chooseRule(args: {
  db: any;
  userId: string;
  data: Record<string, any>;
  state: Record<string, any>;
  config: Config;
  nowMs: number;
}): Promise<{ match: RuleMatch | null; skipReason: string }> {
  const { db, userId, data, state, config, nowMs } = args;
  const subscriptionState = await loadSubscriptionState(db, userId, data, state, nowMs);
  const purchaseSignals = await loadPurchaseSignals(db, userId);
  const latestSentMs = latestRetargetingSentMs(state);
  if (latestSentMs && nowMs - latestSentMs < config.cooldownHours * 60 * 60 * 1000) {
    return { match: null, skipReason: 'cooldown' };
  }

  if (subscriptionState.hasActive) {
    if (isRuleResolved(state, RULES.trialActivation)) {
      return { match: null, skipReason: 'trial_activation_resolved' };
    }
    const trialAnchorMs = maxMillis(subscriptionState.anchorMs, purchaseSignals.latestTrialSucceededAt);
    if (!trialAnchorMs || !hasRecentEnoughAnchor(trialAnchorMs, nowMs, config.trialActivationDelayHours)) {
      return { match: null, skipReason: 'active_not_trial_activation_due' };
    }
    if (!subscriptionState.rootTrialing && !purchaseSignals.latestTrialSucceededAt && !state.webOffer24hConvertedAt) {
      return { match: null, skipReason: 'active_not_confirmed_trial' };
    }
    const hasActivation = await hasMacraActivation(db, userId, data);
    if (hasActivation) {
      return { match: null, skipReason: 'already_activated' };
    }
    return {
      match: {
        rule: RULES.trialActivation,
        reason: 'trial_no_activation',
        anchorMs: trialAnchorMs,
        metadata: {
          trialAnchorAt: new Date(trialAnchorMs),
          subscriptionDocActive: subscriptionState.subscriptionDocActive,
        },
      },
      skipReason: '',
    };
  }

  if (purchaseSignals.latestSucceededAt || state.webOffer24hConvertedAt) {
    return { match: null, skipReason: 'historical_trial_or_subscription' };
  }

  const cancelAnchor = maxMillis(cancelFeedbackAnchorMs(data), purchaseSignals.latestCanceledAt);
  if (
    !isRuleResolved(state, RULES.paywallCancelTrust) &&
    cancelAnchor &&
    hasRecentEnoughAnchor(cancelAnchor, nowMs, config.paywallCancelDelayHours)
  ) {
    return {
      match: {
        rule: RULES.paywallCancelTrust,
        reason: 'purchase_cancelled_or_cta_abandoned',
        anchorMs: cancelAnchor,
        metadata: {
          cancelReason: purchaseSignals.latestCancelReason || getNestedValue(data, 'macraLatestPaywallCancelFeedback.reason') || null,
        },
      },
      skipReason: '',
    };
  }

  const webOfferEngagedAt = maxMillis(state.webOffer24hClickedAt, state.webOffer24hOpenedAt);
  if (
    !isRuleResolved(state, RULES.webOfferProof) &&
    state.webOffer24hSentAt &&
    webOfferEngagedAt &&
    !state.webOffer24hCheckoutStartedAt &&
    !state.webOffer24hConvertedAt &&
    hasRecentEnoughAnchor(webOfferEngagedAt, nowMs, config.webOfferProofDelayHours)
  ) {
    return {
      match: {
        rule: RULES.webOfferProof,
        reason: state.webOffer24hClickedAt ? 'web_offer_clicked_no_checkout' : 'web_offer_opened_no_checkout',
        anchorMs: webOfferEngagedAt,
      },
      skipReason: '',
    };
  }

  const paywallView = paywallViewSignal(data, state);
  if (
    !isRuleResolved(state, RULES.paywallViewValue) &&
    paywallView.count >= config.paywallViewMinCount &&
    paywallView.lastViewedAt &&
    hasRecentEnoughAnchor(paywallView.lastViewedAt, nowMs, config.paywallViewDelayHours) &&
    !purchaseSignals.latestAttemptedAt &&
    !purchaseSignals.latestCanceledAt &&
    !purchaseSignals.latestSucceededAt
  ) {
    return {
      match: {
        rule: RULES.paywallViewValue,
        reason: 'repeat_paywall_views_no_cta',
        anchorMs: paywallView.lastViewedAt,
        metadata: {
          paywallViewCount: paywallView.count,
        },
      },
      skipReason: '',
    };
  }

  const onboardedAt = onboardingAnchorMs(data);
  if (
    !isRuleResolved(state, RULES.noTrial7dChallenge) &&
    onboardedAt &&
    hasRecentEnoughAnchor(onboardedAt, nowMs, config.noTrialDelayHours)
  ) {
    return {
      match: {
        rule: RULES.noTrial7dChallenge,
        reason: 'seven_day_no_trial',
        anchorMs: onboardedAt,
      },
      skipReason: '',
    };
  }

  return { match: null, skipReason: 'no_rule_due' };
}

export const handler: Handler = async () => {
  try {
    const db = await getFirestore();
    const config = await loadConfig(db);

    if (!config.enabled) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, disabled: true, scanned: 0, sent: 0, skipped: 0 }),
      };
    }

    const nowMs = Date.now();
    const sendWindowState = isWithinSendWindow({
      nowMs,
      startLocal: config.sendWindowStartLocal,
      endLocal: config.sendWindowEndLocal,
      timezone: config.sendWindowTimezone,
    });

    if (!sendWindowState.withinWindow) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          windowBlocked: true,
          scanned: 0,
          sent: 0,
          skipped: 0,
          sendWindowStartLocal: config.sendWindowStartLocal,
          sendWindowEndLocal: config.sendWindowEndLocal,
          sendWindowTimezone: config.sendWindowTimezone,
          localTime: sendWindowState.local.label,
        }),
      };
    }

    const scanFrequencyState = getScanFrequencyState(config, nowMs);
    if (!scanFrequencyState.due) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          frequencyBlocked: true,
          scanned: 0,
          sent: 0,
          skipped: 0,
          scanEveryHours: config.scanEveryHours,
          lastScanAt: scanFrequencyState.lastScanMs ? new Date(scanFrequencyState.lastScanMs).toISOString() : null,
          nextScanAt: scanFrequencyState.nextScanAt ? new Date(scanFrequencyState.nextScanAt).toISOString() : null,
        }),
      };
    }

    const runId = `macra-retargeting-${nowMs}-${Math.random().toString(36).slice(2, 10)}`;
    const userBatch = await loadUserBatch(db, config);

    const skippedByReason: Record<string, number> = {};
    const sentBySequence: Record<string, number> = {};
    const bumpSkip = (reason: string) => {
      skippedByReason[reason] = (skippedByReason[reason] || 0) + 1;
    };
    const bumpSent = (sequenceId: string) => {
      sentBySequence[sequenceId] = (sentBySequence[sequenceId] || 0) + 1;
    };

    let scanned = 0;
    let claimed = 0;
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of userBatch.docs) {
      scanned += 1;

      if (sent >= config.maxSendsPerRun) {
        bumpSkip('run_send_limit');
        skipped += 1;
        continue;
      }

      const data = (doc.data() || {}) as Record<string, any>;
      const state = (data.macraEmailSequenceState || {}) as Record<string, any>;
      const email = normalizeEmail(data.email);

      if (data.hasCompletedMacraOnboarding !== true) {
        bumpSkip('macra_onboarding_not_complete');
        skipped += 1;
        continue;
      }
      if (!hasMacraOrigin(data)) {
        bumpSkip('not_macra_origin');
        skipped += 1;
        continue;
      }
      if (!email) {
        bumpSkip('missing_email');
        skipped += 1;
        continue;
      }

      const prefs = data.macraEmailPreferences || {};
      if (prefs.retargeting === false) {
        bumpSkip('retargeting_pref_off');
        skipped += 1;
        continue;
      }

      const ageEligibility = await evaluateMacraEmailEligibility({
        db,
        userId: doc.id,
        userData: data,
        nowMs,
        sequenceId: CONFIG_ID,
        markSkipped: true,
      });
      if (!ageEligibility.eligible) {
        bumpSkip(ageEligibility.reason || 'age_ineligible');
        skipped += 1;
        continue;
      }

      const { match, skipReason } = await chooseRule({
        db,
        userId: doc.id,
        data,
        state,
        config,
        nowMs,
      });
      if (!match) {
        bumpSkip(skipReason);
        skipped += 1;
        continue;
      }

      const pendingField = `macraEmailSequenceState.${match.rule.stateKey}Pending`;
      const dedupeKey = buildEmailDedupeKey([match.rule.sequenceId, doc.id]);
      const didClaim = await claimScheduledSequenceSend({
        docRef: doc.ref,
        pendingField,
        completionFields: [
          `macraEmailSequenceState.${match.rule.stateKey}SentAt`,
          `macraEmailSequenceState.${match.rule.stateKey}SkippedAt`,
        ],
        dedupeKey,
        runId,
        nowMs,
        metadata: {
          sequence: match.rule.sequenceId,
          userId: doc.id,
          email,
          reason: match.reason,
        },
      });

      if (!didClaim) {
        bumpSkip('claim_blocked');
        skipped += 1;
        continue;
      }

      claimed += 1;
      try {
        const result = await sendRetargetingEmail({ rule: match.rule, userId: doc.id });
        await finalizeScheduledSequenceSend({
          docRef: doc.ref,
          pendingField,
          resultField: result.skipped
            ? `macraEmailSequenceState.${match.rule.stateKey}SkippedAt`
            : `macraEmailSequenceState.${match.rule.stateKey}SentAt`,
          dedupeKey,
          runId,
          markSent: !result.skipped,
          updateFields: {
            [`macraEmailSequenceState.${match.rule.stateKey}Status`]: result.skipped ? 'skipped:send_idempotent' : 'sent',
            [`macraEmailSequenceState.${match.rule.stateKey}EmailMessageId`]: result.messageId || null,
            [`macraEmailSequenceState.${match.rule.stateKey}ScheduledReason`]: match.reason,
            [`macraEmailSequenceState.${match.rule.stateKey}EligibilityAnchorAt`]: new Date(match.anchorMs),
            [`macraEmailSequenceState.${match.rule.stateKey}LastUpdatedAt`]: new Date(),
            ...(match.metadata
              ? {
                  [`macraEmailSequenceState.${match.rule.stateKey}SchedulerMetadata`]: match.metadata,
                }
              : {}),
          },
        });

        if (result.skipped) {
          bumpSkip('send_idempotent');
          skipped += 1;
        } else {
          bumpSent(match.rule.sequenceId);
          sent += 1;
        }
      } catch (error: any) {
        errors += 1;
        await releaseScheduledSequenceSend({
          docRef: doc.ref,
          pendingField,
          dedupeKey,
          runId,
        });
        console.warn('[schedule-macra-retargeting-email] Failed for user', doc.id, match.rule.sequenceId, error?.message || error);
      }
    }

    await db.collection('email-sequence-config').doc(CONFIG_ID).set(
      {
        lastScanAt: new Date(nowMs),
        lastScanCompletedAt: new Date(),
        lastScanCursorUserId: userBatch.nextCursorUserId,
        lastScanWrapped: userBatch.wrapped,
        lastScanRunId: runId,
        lastScanLocalTime: sendWindowState.local.label,
        lastScanSummary: {
          scanned,
          claimed,
          sent,
          skipped,
          errors,
          skippedByReason,
          sentBySequence,
        },
      },
      { merge: true }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        scanned,
        claimed,
        sent,
        skipped,
        errors,
        skippedByReason,
        sentBySequence,
        maxSendsPerRun: config.maxSendsPerRun,
        scanEveryHours: config.scanEveryHours,
        cooldownHours: config.cooldownHours,
        sendWindowStartLocal: config.sendWindowStartLocal,
        sendWindowEndLocal: config.sendWindowEndLocal,
        sendWindowTimezone: config.sendWindowTimezone,
        localTime: sendWindowState.local.label,
      }),
    };
  } catch (error: any) {
    console.error('[schedule-macra-retargeting-email] Fatal error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error?.message || 'Internal error' }),
    };
  }
};
