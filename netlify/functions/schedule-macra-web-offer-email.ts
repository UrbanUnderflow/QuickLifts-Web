import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import {
  buildEmailDedupeKey,
  claimScheduledSequenceSend,
  finalizeScheduledSequenceSend,
  getBaseSiteUrl,
  releaseScheduledSequenceSend,
  toMillis,
} from './utils/emailSequenceHelpers';

const {
  MACRA_WEB_OFFER_CAMPAIGN_ID,
  ageFromBirthdateMs,
  getMacraBirthdateMs,
  hasActiveRootSubscription,
  hasActiveSubscriptionPlan,
} = require('./utils/macraStripe');

const DEFAULT_BATCH_LIMIT = 250;
const DEFAULT_DELAY_HOURS = 24;
const DEFAULT_MAX_SENDS_PER_RUN = 80;
const DEFAULT_SCAN_EVERY_HOURS = 1;
const DEFAULT_SEND_WINDOW_START_LOCAL = '09:00';
const DEFAULT_SEND_WINDOW_END_LOCAL = '17:00';
const DEFAULT_SEND_WINDOW_TIMEZONE = 'America/New_York';

type Config = {
  enabled: boolean;
  delayHours: number;
  batchLimit: number;
  maxSendsPerRun: number;
  scanEveryHours: number;
  sendWindowStartLocal: string;
  sendWindowEndLocal: string;
  sendWindowTimezone: string;
  lastScanAt?: any;
};

type SendResult = {
  skipped?: boolean;
  messageId?: string;
};

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasMacraOrigin(data: Record<string, any>): boolean {
  const entryPoint = String(data.registrationEntryPoint || data.originRegistrationSource || '').trim().toLowerCase();
  return entryPoint === 'macra' || Boolean(data.hasCompletedMacraOnboarding);
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
    hour,
    minute,
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

async function loadConfig(): Promise<Config> {
  const db = await getFirestore();
  const snap = await db.collection('email-sequence-config').doc(MACRA_WEB_OFFER_CAMPAIGN_ID).get();
  const data = (snap.exists ? snap.data() || {} : {}) as Record<string, any>;
  return {
    enabled: data.enabled === true,
    delayHours: Math.max(1, Number(data.delayHours || DEFAULT_DELAY_HOURS) || DEFAULT_DELAY_HOURS),
    batchLimit: Math.max(25, Number(data.batchLimit || DEFAULT_BATCH_LIMIT) || DEFAULT_BATCH_LIMIT),
    maxSendsPerRun: Math.max(1, Number(data.maxSendsPerRun || DEFAULT_MAX_SENDS_PER_RUN) || DEFAULT_MAX_SENDS_PER_RUN),
    scanEveryHours: Math.max(1, Number(data.scanEveryHours || DEFAULT_SCAN_EVERY_HOURS) || DEFAULT_SCAN_EVERY_HOURS),
    sendWindowStartLocal: normalizeLocalTime(data.sendWindowStartLocal, DEFAULT_SEND_WINDOW_START_LOCAL),
    sendWindowEndLocal: normalizeLocalTime(data.sendWindowEndLocal, DEFAULT_SEND_WINDOW_END_LOCAL),
    sendWindowTimezone: normalizeTimezone(data.sendWindowTimezone),
    lastScanAt: data.lastScanAt,
  };
}

async function sendOffer(args: { userId: string }): Promise<SendResult> {
  const resp = await fetch(`${getBaseSiteUrl()}/.netlify/functions/send-macra-web-offer-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: args.userId, plan: 'monthly' }),
  });
  const json = await resp.json().catch(() => ({} as any));
  if (!resp.ok || json?.success === false) {
    throw new Error(json?.error || `HTTP ${resp.status}`);
  }
  return { skipped: Boolean(json?.skipped), messageId: json?.messageId };
}

async function markSkipped(args: {
  docRef: any;
  reason: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  await args.docRef.set(
    {
      macraEmailSequenceState: {
        webOffer24hSkippedAt: new Date(),
        webOffer24hSkipReason: args.reason,
        webOffer24hStatus: `skipped:${args.reason}`,
        webOffer24hLastUpdatedAt: new Date(),
        ...(args.metadata || {}),
      },
    },
    { merge: true }
  );
}

export const handler: Handler = async () => {
  try {
    const db = await getFirestore();
    const config = await loadConfig();

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

    const eligibleAfterMs = config.delayHours * 60 * 60 * 1000;
    const runId = `macra-web-offer-${nowMs}-${Math.random().toString(36).slice(2, 10)}`;

    const snap = await db
      .collection('users')
      .where('hasCompletedMacraOnboarding', '==', true)
      .limit(config.batchLimit)
      .get();

    const skippedByReason: Record<string, number> = {};
    const bumpSkip = (reason: string) => {
      skippedByReason[reason] = (skippedByReason[reason] || 0) + 1;
    };

    let scanned = 0;
    let claimed = 0;
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snap.docs) {
      scanned += 1;
      if (sent >= config.maxSendsPerRun) {
        bumpSkip('run_send_limit');
        skipped += 1;
        continue;
      }

      const data = (doc.data() || {}) as Record<string, any>;
      const state = (data.macraEmailSequenceState || {}) as Record<string, any>;
      const email = normalizeEmail(data.email);

      if (state.webOffer24hSentAt || state.webOffer24hConvertedAt || state.webOffer24hSkippedAt) {
        bumpSkip('already_resolved');
        skipped += 1;
        continue;
      }
      if (!hasMacraOrigin(data)) {
        bumpSkip('not_macra_origin');
        skipped += 1;
        continue;
      }
      if (!email) {
        await markSkipped({ docRef: doc.ref, reason: 'missing_email' });
        bumpSkip('missing_email');
        skipped += 1;
        continue;
      }

      const anchorMs = toMillis(data.macraOnboardingCompletedAt) ?? toMillis(data.createdAt);
      if (!anchorMs || nowMs - anchorMs < eligibleAfterMs) {
        bumpSkip('not_old_enough');
        skipped += 1;
        continue;
      }

      const birthdateMs = await getMacraBirthdateMs({ db, userId: doc.id, userData: data });
      const age = ageFromBirthdateMs(birthdateMs, nowMs);
      if (age === null) {
        await markSkipped({ docRef: doc.ref, reason: 'missing_birthdate' });
        bumpSkip('missing_birthdate');
        skipped += 1;
        continue;
      }
      if (age < 18) {
        await markSkipped({
          docRef: doc.ref,
          reason: 'under_18',
          metadata: {
            webOffer24hEligibilityAge: age,
          },
        });
        bumpSkip('under_18');
        skipped += 1;
        continue;
      }

      if (hasActiveRootSubscription(data, nowMs) || (await hasActiveSubscriptionPlan({ db, userId: doc.id, nowMs }))) {
        await markSkipped({ docRef: doc.ref, reason: 'already_subscribed_or_trialing' });
        bumpSkip('already_subscribed_or_trialing');
        skipped += 1;
        continue;
      }

      const pendingField = 'macraEmailSequenceState.webOffer24hPending';
      const dedupeKey = buildEmailDedupeKey([MACRA_WEB_OFFER_CAMPAIGN_ID, doc.id]);
      const didClaim = await claimScheduledSequenceSend({
        docRef: doc.ref,
        pendingField,
        completionFields: [
          'macraEmailSequenceState.webOffer24hSentAt',
          'macraEmailSequenceState.webOffer24hSkippedAt',
          'macraEmailSequenceState.webOffer24hConvertedAt',
        ],
        dedupeKey,
        runId,
        nowMs,
        metadata: {
          sequence: MACRA_WEB_OFFER_CAMPAIGN_ID,
          userId: doc.id,
          email,
        },
      });

      if (!didClaim) {
        bumpSkip('claim_blocked');
        skipped += 1;
        continue;
      }

      claimed += 1;
      try {
        const result = await sendOffer({ userId: doc.id });
        await finalizeScheduledSequenceSend({
          docRef: doc.ref,
          pendingField,
          resultField: result.skipped
            ? 'macraEmailSequenceState.webOffer24hSkippedAt'
            : 'macraEmailSequenceState.webOffer24hSentAt',
          dedupeKey,
          runId,
          markSent: !result.skipped,
          updateFields: {
            'macraEmailSequenceState.webOffer24hStatus': result.skipped ? 'skipped:send_idempotent' : 'sent',
            'macraEmailSequenceState.webOffer24hEmailMessageId': result.messageId || null,
            'macraEmailSequenceState.webOffer24hPlan': 'monthly',
            'macraEmailSequenceState.webOffer24hLastUpdatedAt': new Date(),
          },
        });

        if (result.skipped) {
          bumpSkip('send_idempotent');
          skipped += 1;
        } else {
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
        console.warn('[schedule-macra-web-offer-email] Failed for user', doc.id, error?.message || error);
      }
    }

    await db.collection('email-sequence-config').doc(MACRA_WEB_OFFER_CAMPAIGN_ID).set(
      {
        lastScanAt: new Date(nowMs),
        lastScanCompletedAt: new Date(),
        lastScanRunId: runId,
        lastScanLocalTime: sendWindowState.local.label,
        lastScanSummary: {
          scanned,
          claimed,
          sent,
          skipped,
          errors,
          skippedByReason,
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
        delayHours: config.delayHours,
        maxSendsPerRun: config.maxSendsPerRun,
        scanEveryHours: config.scanEveryHours,
        sendWindowStartLocal: config.sendWindowStartLocal,
        sendWindowEndLocal: config.sendWindowEndLocal,
        sendWindowTimezone: config.sendWindowTimezone,
        localTime: sendWindowState.local.label,
      }),
    };
  } catch (error: any) {
    console.error('[schedule-macra-web-offer-email] Fatal error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error?.message || 'Internal error' }),
    };
  }
};
