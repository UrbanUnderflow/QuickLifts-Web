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

type Config = {
  enabled: boolean;
  delayHours: number;
  batchLimit: number;
  maxSendsPerRun: number;
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

async function loadConfig(): Promise<Config> {
  const db = await getFirestore();
  const snap = await db.collection('email-sequence-config').doc(MACRA_WEB_OFFER_CAMPAIGN_ID).get();
  const data = (snap.exists ? snap.data() || {} : {}) as Record<string, any>;
  return {
    enabled: data.enabled !== false,
    delayHours: Math.max(1, Number(data.delayHours || DEFAULT_DELAY_HOURS) || DEFAULT_DELAY_HOURS),
    batchLimit: Math.max(25, Number(data.batchLimit || DEFAULT_BATCH_LIMIT) || DEFAULT_BATCH_LIMIT),
    maxSendsPerRun: Math.max(1, Number(data.maxSendsPerRun || DEFAULT_MAX_SENDS_PER_RUN) || DEFAULT_MAX_SENDS_PER_RUN),
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
