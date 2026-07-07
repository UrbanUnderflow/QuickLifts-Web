import type { Handler } from '@netlify/functions';
import { admin } from './config/firebase';

const {
  MACRA_MIXPANEL_EVENTS,
  safeTrackMacraWebOfferEvent,
} = require('./utils/mixpanelAnalytics');

const db = admin.firestore();
const PILOT_ATHLETE_COMMUNICATIONS_COLLECTION = 'pulsecheck-pilot-athlete-communications';
const MACRA_WEB_OFFER_CAMPAIGN_ID = 'macra-web-offer-24h-v1';
const EMAIL_LOG_COLLECTION = 'email-logs';
const SIMPBUDGET_USERS_COLLECTION = 'simpbudget-users';
const PIPELISTS_SUBCOLLECTION = 'pipeLists';
const PIPELISTS_STATE_DOCUMENT_ID = 'state';

/**
 * Brevo Webhook Event Types:
 * - request: Email was accepted by Brevo for processing
 * - delivered: Email was delivered to the recipient's mail server
 * - opened / unique_opened / proxy_open / unique_proxy_open: Recipient opened the email (tracked via pixel)
 * - click: Recipient clicked a link in the email
 * - soft_bounce: Temporary delivery failure
 * - hard_bounce: Permanent delivery failure
 * - spam: Recipient marked email as spam
 * - unsubscribe / unsubscribed: Recipient unsubscribed
 */

interface BrevoWebhookEvent {
  event:
    | 'request'
    | 'delivered'
    | 'opened'
    | 'unique_opened'
    | 'uniqueOpened'
    | 'proxy_open'
    | 'unique_proxy_open'
    | 'uniqueProxyOpen'
    | 'click'
    | 'soft_bounce'
    | 'softBounce'
    | 'hard_bounce'
    | 'hardBounce'
    | 'spam'
    | 'unsubscribe'
    | 'unsubscribed'
    | 'blocked'
    | 'deferred'
    | 'invalid'
    | 'invalid_email'
    | 'error';
  email: string;
  id: number;
  date: string;
  ts: number;
  'message-id'?: string;
  ts_event?: number;
  subject?: string;
  tag?: string;
  sending_ip?: string;
  ts_epoch?: number;
  link?: string; // For click events
  'X-Mailin-custom'?: string; // Custom headers we set (contains friendId, signingRequestId, emailRecordId)
}

type CanonicalBrevoEmailEvent =
  | 'request'
  | 'delivered'
  | 'opened'
  | 'click'
  | 'soft_bounce'
  | 'hard_bounce'
  | 'spam'
  | 'unsubscribe'
  | 'blocked'
  | 'deferred'
  | 'invalid_email'
  | 'error';

const normalizeBrevoEmailEvent = (eventType: BrevoWebhookEvent['event']): CanonicalBrevoEmailEvent => {
  if (
    eventType === 'unique_opened' ||
    eventType === 'uniqueOpened' ||
    eventType === 'proxy_open' ||
    eventType === 'unique_proxy_open' ||
    eventType === 'uniqueProxyOpen'
  ) {
    return 'opened';
  }
  if (eventType === 'unsubscribed') return 'unsubscribe';
  if (eventType === 'softBounce') return 'soft_bounce';
  if (eventType === 'hardBounce') return 'hard_bounce';
  if (eventType === 'invalid') return 'invalid_email';
  return eventType;
};

const MACRA_BREVO_EVENT_TO_MIXPANEL: Partial<Record<CanonicalBrevoEmailEvent, string>> = {
  delivered: MACRA_MIXPANEL_EVENTS.emailDelivered,
  opened: MACRA_MIXPANEL_EVENTS.emailOpened,
  click: MACRA_MIXPANEL_EVENTS.emailClicked,
};
const MACRA_BREVO_EVENT_TO_RETARGETING_MIXPANEL: Partial<Record<CanonicalBrevoEmailEvent, string>> = {
  delivered: MACRA_MIXPANEL_EVENTS.retargetingEmailDelivered,
  opened: MACRA_MIXPANEL_EVENTS.retargetingEmailOpened,
  click: MACRA_MIXPANEL_EVENTS.retargetingEmailClicked,
};
const MACRA_BREVO_ISSUE_EVENTS = new Set<CanonicalBrevoEmailEvent>([
  'soft_bounce',
  'hard_bounce',
  'blocked',
  'deferred',
  'spam',
  'unsubscribe',
  'invalid_email',
  'error',
]);
const MACRA_RETARGETING_SEQUENCE_STATE_KEYS: Record<string, string> = {
  'macra-web-offer-24h-v1': 'webOffer24h',
  'macra-paywall-cancel-trust-v1': 'paywallCancelTrust',
  'macra-web-offer-proof-v1': 'webOfferProof',
  'macra-paywall-view-value-v1': 'paywallViewValue',
  'macra-no-trial-7d-challenge-v1': 'noTrial7dChallenge',
  'macra-trial-no-activation-24h-v1': 'trialNoActivation24h',
};

const buildBrevoEmailLogDocId = (messageId: string) =>
  `brevo_${encodeURIComponent(messageId).slice(0, 900)}`;

const getWebhookEventTime = (webhookEvent: BrevoWebhookEvent, fallback: Date) => {
  const candidates = [webhookEvent.ts_event, webhookEvent.ts_epoch, webhookEvent.ts];
  for (const candidate of candidates) {
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) continue;
    const date = new Date(candidate < 1_000_000_000_000 ? candidate * 1000 : candidate);
    if (!Number.isNaN(date.getTime())) return date;
  }

  if (webhookEvent.date) {
    const date = new Date(webhookEvent.date);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return fallback;
};

const updateEmailLogFromBrevoEvent = async (args: {
  webhookEvent: BrevoWebhookEvent;
  eventType: CanonicalBrevoEmailEvent;
  rawEventType: BrevoWebhookEvent['event'];
  email: string;
  messageId?: string;
  link?: string;
  now: Date;
}) => {
  if (!args.messageId) return;

  const FieldValue = admin.firestore.FieldValue;
  const eventAt = getWebhookEventTime(args.webhookEvent, args.now);
  const updateData: Record<string, any> = {
    provider: 'brevo',
    messageId: args.messageId,
    toEmail: args.email || null,
    subject: args.webhookEvent.subject || null,
    lastEvent: args.eventType,
    lastRawEvent: args.rawEventType,
    lastEventAt: eventAt,
    updatedAt: args.now,
  };

  switch (args.eventType) {
    case 'delivered':
      updateData.status = 'delivered';
      updateData.deliveredAt = eventAt;
      break;
    case 'opened':
      updateData.status = 'opened';
      updateData.openedAt = eventAt;
      updateData.openCount = FieldValue.increment(1);
      break;
    case 'click':
      updateData.status = 'clicked';
      updateData.clickedAt = eventAt;
      updateData.clickedLink = args.link || null;
      updateData.clickCount = FieldValue.increment(1);
      break;
    case 'soft_bounce':
    case 'hard_bounce':
    case 'blocked':
    case 'deferred':
    case 'spam':
    case 'unsubscribe':
    case 'invalid_email':
    case 'error':
      updateData.status = args.eventType;
      updateData.issueAt = eventAt;
      updateData.lastError = args.eventType;
      break;
  }

  await db.collection(EMAIL_LOG_COLLECTION).doc(buildBrevoEmailLogDocId(args.messageId)).set(updateData, { merge: true });
};

const applyStatusUpdate = (
  updateData: Record<string, any>,
  eventType: CanonicalBrevoEmailEvent,
  now: Date,
  link?: string,
  periodKey?: string
) => {
  const writePeriodField = (field: string, value: any) => {
    if (!periodKey) return;
    updateData[`${periodKey}.${field}`] = value;
  };

  switch (eventType) {
    case 'delivered':
      updateData.lastEmailDeliveredAt = now;
      updateData.emailStatus = 'delivered';
      writePeriodField('status', 'delivered');
      writePeriodField('deliveredAt', now);
      break;
    case 'opened':
      updateData.lastEmailOpenedAt = now;
      updateData.emailOpenCount = admin.firestore.FieldValue.increment(1);
      updateData.emailStatus = 'opened';
      writePeriodField('status', 'opened');
      writePeriodField('openedAt', now);
      writePeriodField('openCount', admin.firestore.FieldValue.increment(1));
      break;
    case 'click':
      updateData.lastEmailClickedAt = now;
      updateData.emailClickCount = admin.firestore.FieldValue.increment(1);
      updateData.lastEmailClickedLink = link || null;
      updateData.emailStatus = 'clicked';
      writePeriodField('status', 'clicked');
      writePeriodField('clickedAt', now);
      writePeriodField('clickCount', admin.firestore.FieldValue.increment(1));
      writePeriodField('clickedLink', link || null);
      break;
    case 'soft_bounce':
      updateData.emailStatus = 'soft_bounce';
      updateData.emailBounceType = 'soft_bounce';
      writePeriodField('status', 'soft_bounce');
      writePeriodField('bounceType', 'soft_bounce');
      break;
    case 'hard_bounce':
      updateData.emailStatus = 'hard_bounce';
      updateData.emailBounceType = 'hard_bounce';
      writePeriodField('status', 'hard_bounce');
      writePeriodField('bounceType', 'hard_bounce');
      break;
    case 'spam':
      updateData.emailStatus = 'spam';
      writePeriodField('status', 'spam');
      break;
    case 'unsubscribe':
      updateData.emailStatus = 'unsubscribed';
      writePeriodField('status', 'unsubscribed');
      break;
    case 'blocked':
      updateData.emailStatus = 'blocked';
      writePeriodField('status', 'blocked');
      break;
    case 'deferred':
      updateData.emailStatus = 'deferred';
      writePeriodField('status', 'deferred');
      break;
    case 'invalid_email':
    case 'error':
      updateData.emailStatus = eventType;
      writePeriodField('status', eventType);
      break;
  }
};

const updatePipeListsContactEmailStatus = async (args: {
  ownerUid: string;
  listId: string;
  itemIds: string[];
  emailType?: string;
  eventType: CanonicalBrevoEmailEvent;
  email: string;
  messageId?: string;
  link?: string;
  now: Date;
}) => {
  const ownerUid = String(args.ownerUid || '').trim();
  const listId = String(args.listId || '').trim();
  const targetItemIds = new Set(args.itemIds.map((itemId) => String(itemId || '').trim()).filter(Boolean));
  const targetEmail = String(args.email || '').trim().toLowerCase();
  if (!ownerUid || !listId || (!targetItemIds.size && !targetEmail)) return;

  const stateRef = db
    .collection(SIMPBUDGET_USERS_COLLECTION)
    .doc(ownerUid)
    .collection(PIPELISTS_SUBCOLLECTION)
    .doc(PIPELISTS_STATE_DOCUMENT_ID);
  const stateSnapshot = await stateRef.get();
  const stateData = stateSnapshot.data() || {};
  const lists = Array.isArray(stateData.lists) ? stateData.lists : [];
  const nowIso = args.now.toISOString();
  let changed = false;

  const status =
    args.eventType === 'request'
      ? 'sent'
      : args.eventType === 'click'
        ? 'clicked'
        : args.eventType === 'unsubscribe'
          ? 'unsubscribed'
          : args.eventType;

  const updatedLists = lists.map((list: any) => {
    if (!list || list.id !== listId || !Array.isArray(list.items)) return list;

    const updatedItems = list.items.map((item: any) => {
      if (!item || typeof item !== 'object') return item;
      const itemEmails = Array.isArray(item.contactEmails)
        ? item.contactEmails.map((emailValue: any) => String(emailValue || '').trim().toLowerCase()).filter(Boolean)
        : [];
      const matchesItem = targetItemIds.has(String(item.id || '')) || (targetEmail && itemEmails.includes(targetEmail));
      if (!matchesItem) return item;

      changed = true;
      const nextItem: Record<string, any> = {
        ...item,
        emailStatus: status,
        lastEmailType: args.emailType || item.lastEmailType || '',
        lastEmailEvent: status,
        lastEmailEventAt: nowIso,
        updatedAt: nowIso,
      };

      if (args.messageId) {
        nextItem.lastEmailMessageId = args.messageId;
      }

      switch (args.eventType) {
        case 'request':
          nextItem.lastEmailSentAt = item.lastEmailSentAt || nowIso;
          break;
        case 'delivered':
          nextItem.lastEmailDeliveredAt = nowIso;
          break;
        case 'opened':
          nextItem.lastEmailOpenedAt = nowIso;
          nextItem.emailOpenCount = (Number(item.emailOpenCount) || 0) + 1;
          break;
        case 'click':
          nextItem.lastEmailClickedAt = nowIso;
          nextItem.emailClickCount = (Number(item.emailClickCount) || 0) + 1;
          nextItem.lastEmailClickedLink = args.link || item.lastEmailClickedLink || '';
          break;
        case 'soft_bounce':
        case 'hard_bounce':
        case 'blocked':
        case 'deferred':
        case 'spam':
        case 'unsubscribe':
        case 'invalid_email':
        case 'error':
          nextItem.lastEmailIssueAt = nowIso;
          break;
      }

      return nextItem;
    });

    return { ...list, items: updatedItems };
  });

  if (!changed) {
    console.warn(`[brevo-webhook] No PipeLists contact matched event for list ${listId} and email ${targetEmail}`);
    return;
  }

  await stateRef.set(
    {
      lists: updatedLists,
      updatedAt: args.now,
    },
    { merge: true },
  );
  console.log(`[brevo-webhook] Updated PipeLists contact email status ${status} for list ${listId}`);
};

const updateMacraRetargetingEmailSequenceStatus = async (args: {
  userId: string;
  stateKey: string;
  eventType: CanonicalBrevoEmailEvent;
  email: string;
  messageId?: string;
  link?: string;
  now: Date;
}) => {
  const { userId, stateKey, eventType, email, messageId, link, now } = args;
  if (!userId || !stateKey) return;

  const stateUpdate: Record<string, any> = {
    [`${stateKey}LastEmailEvent`]: eventType,
    [`${stateKey}LastEmailEventAt`]: now,
    [`${stateKey}LastEmailEventEmail`]: email || null,
    [`${stateKey}LastUpdatedAt`]: now,
  };

  if (messageId) {
    stateUpdate[`${stateKey}EmailMessageId`] = messageId;
  }

  switch (eventType) {
    case 'delivered':
      stateUpdate[`${stateKey}DeliveredAt`] = now;
      break;
    case 'opened':
      stateUpdate[`${stateKey}OpenedAt`] = now;
      stateUpdate[`${stateKey}OpenCount`] = admin.firestore.FieldValue.increment(1);
      break;
    case 'click':
      stateUpdate[`${stateKey}ClickedAt`] = now;
      stateUpdate[`${stateKey}ClickCount`] = admin.firestore.FieldValue.increment(1);
      stateUpdate[`${stateKey}ClickedLink`] = link || null;
      break;
    case 'soft_bounce':
    case 'hard_bounce':
    case 'blocked':
    case 'deferred':
    case 'spam':
    case 'unsubscribe':
    case 'invalid_email':
    case 'error':
      stateUpdate[`${stateKey}Status`] = `email_${eventType}`;
      stateUpdate[`${stateKey}EmailIssueAt`] = now;
      break;
  }

  await db.collection('users').doc(userId).set(
    {
      macraEmailSequenceState: stateUpdate,
    },
    { merge: true }
  );
};

const applyPilotAthleteCommunicationStatusUpdate = (
  updateData: Record<string, any>,
  eventType: CanonicalBrevoEmailEvent,
  now: Date,
  link?: string
) => {
  switch (eventType) {
    case 'delivered':
      updateData.status = 'delivered';
      updateData.deliveredAt = now;
      break;
    case 'opened':
      updateData.status = 'opened';
      updateData.openedAt = now;
      break;
    case 'click':
      updateData.status = 'opened';
      updateData.openedAt = updateData.openedAt || now;
      updateData.clickedAt = now;
      updateData.clickedLink = link || null;
      break;
    case 'soft_bounce':
    case 'hard_bounce':
    case 'spam':
    case 'unsubscribe':
    case 'blocked':
    case 'deferred':
    case 'invalid_email':
    case 'error':
      updateData.status = 'failed';
      updateData.lastError = eventType;
      break;
  }
};

const SIGNING_REQUEST_STATUS_RANK: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  viewed: 4,
  signed: 5,
};

const getSigningRequestStatusForEmailEvent = (eventType: CanonicalBrevoEmailEvent) => {
  switch (eventType) {
    case 'delivered':
      return 'delivered';
    case 'opened':
    case 'click':
      return 'opened';
    case 'soft_bounce':
    case 'hard_bounce':
    case 'spam':
    case 'unsubscribe':
    case 'blocked':
    case 'invalid_email':
    case 'error':
      return 'failed';
    case 'deferred':
      return 'deferred';
    default:
      return null;
  }
};

const updateSigningRequestEmailStatus = async (args: {
  signingRequestId: string;
  eventType: CanonicalBrevoEmailEvent;
  email: string;
  messageId?: string;
  link?: string;
  now: Date;
}) => {
  const requestRef = db.collection('signingRequests').doc(args.signingRequestId);
  const requestSnap = await requestRef.get();

  if (!requestSnap.exists) {
    console.warn(`[brevo-webhook] Signing request ${args.signingRequestId} not found`);
    return;
  }

  const data = requestSnap.data() || {};
  const FieldValue = admin.firestore.FieldValue;
  const updateData: Record<string, any> = {
    recipientEmail: data.recipientEmail || args.email,
    emailStatus: args.eventType,
    lastEmailEvent: args.eventType,
    lastEmailEventAt: args.now,
    updatedAt: args.now,
  };

  if (args.messageId) {
    updateData.messageId = args.messageId;
  }

  switch (args.eventType) {
    case 'delivered':
      updateData.deliveredAt = data.deliveredAt || args.now;
      break;
    case 'opened':
      updateData.openedAt = data.openedAt || args.now;
      updateData.openCount = FieldValue.increment(1);
      break;
    case 'click':
      updateData.clickedAt = args.now;
      updateData.clickedLink = args.link || null;
      if (!data.openedAt) {
        updateData.openedAt = args.now;
      }
      updateData.clickCount = FieldValue.increment(1);
      break;
    case 'soft_bounce':
    case 'hard_bounce':
    case 'spam':
    case 'unsubscribe':
    case 'blocked':
    case 'deferred':
    case 'invalid_email':
    case 'error':
      updateData.lastEmailError = args.eventType;
      break;
  }

  const nextStatus = getSigningRequestStatusForEmailEvent(args.eventType);
  if (nextStatus) {
    const currentStatus = typeof data.status === 'string' ? data.status : 'pending';
    if (['failed', 'deferred'].includes(nextStatus) && !['signed', 'viewed'].includes(currentStatus)) {
      updateData.status = nextStatus;
    } else {
      const currentRank = SIGNING_REQUEST_STATUS_RANK[currentStatus] ?? 0;
      const nextRank = SIGNING_REQUEST_STATUS_RANK[nextStatus] ?? 0;

      if (currentStatus !== 'signed' && currentStatus !== 'viewed' && nextRank >= currentRank) {
        updateData.status = nextStatus;
      }
    }
  }

  await requestRef.set(updateData, { merge: true });
  console.log(`[brevo-webhook] Updated signing request ${args.signingRequestId} with ${args.eventType}`);
};

export const handler: Handler = async (event) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Verify the webhook secret if configured (recommended for production)
  const webhookSecret = process.env.BREVO_WEBHOOK_SECRET;
  if (webhookSecret) {
    const providedSecret = event.headers['x-brevo-secret'] || event.headers['X-Brevo-Secret'];
    if (providedSecret !== webhookSecret) {
      console.warn('[brevo-webhook] Invalid webhook secret');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }
  }

  try {
    const body = event.body ? JSON.parse(event.body) : null;
    
    if (!body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No body provided' }),
      };
    }

    // Brevo can send single events or batches
    const events: BrevoWebhookEvent[] = Array.isArray(body) ? body : [body];
    
    console.log(`[brevo-webhook] Received ${events.length} event(s)`);

    if (!db) {
      console.error('[brevo-webhook] Firebase not initialized');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Database not available' }),
      };
    }

    for (const webhookEvent of events) {
      const { event: rawEventType, email, 'message-id': messageId, link } = webhookEvent;
      const eventType = normalizeBrevoEmailEvent(rawEventType);
      const now = new Date();
      
      console.log(
        `[brevo-webhook] Processing event: ${rawEventType}${rawEventType !== eventType ? ` as ${eventType}` : ''} for ${email}`
      );

      await updateEmailLogFromBrevoEvent({
        webhookEvent,
        eventType,
        rawEventType,
        email,
        messageId,
        link,
        now,
      }).catch((error) => {
        console.warn('[brevo-webhook] Failed to update email log:', error?.message || error);
      });

      // Parse custom headers to get friendId and updatePeriodId
      let friendId: string | null = null;
      let emailRecordId: string | null = null;
      let updatePeriodId: string | null = null;
      let pilotAthleteCommunicationId: string | null = null;
      let signingRequestId: string | null = null;
      let emailSequenceId: string | null = null;
      let campaignId: string | null = null;
      let product: string | null = null;
      let userId: string | null = null;
      let plan: string | null = null;
      let ctaUrlMode: string | null = null;
      let checkoutCampaignId: string | null = null;
      let pipeListsOwnerUid: string | null = null;
      let pipeListsListId: string | null = null;
      let pipeListsItemIds: string[] = [];
      let pipeListsEmailType: string | null = null;
      let pipeListsEmailBatchId: string | null = null;
      let pipeListsEmailRecordId: string | null = null;
      
      if (webhookEvent['X-Mailin-custom']) {
        try {
          const custom = JSON.parse(webhookEvent['X-Mailin-custom']);
          friendId = custom.friendId || null;
          emailRecordId = custom.emailRecordId || null;
          updatePeriodId = custom.updatePeriodId || null;
          pilotAthleteCommunicationId = custom.pilotAthleteCommunicationId || null;
          signingRequestId = custom.signingRequestId || null;
          emailSequenceId = custom.emailSequenceId || null;
          campaignId = custom.campaignId || null;
          product = custom.product || null;
          userId = custom.userId || null;
          plan = custom.plan || null;
          ctaUrlMode = custom.ctaUrlMode || null;
          checkoutCampaignId = custom.checkoutCampaignId || null;
          pipeListsOwnerUid = custom.pipeListsOwnerUid || null;
          pipeListsListId = custom.pipeListsListId || null;
          pipeListsItemIds = Array.isArray(custom.pipeListsItemIds)
            ? custom.pipeListsItemIds.map((itemId: any) => String(itemId || '').trim()).filter(Boolean)
            : [];
          pipeListsEmailType = custom.pipeListsEmailType || null;
          pipeListsEmailBatchId = custom.pipeListsEmailBatchId || null;
          pipeListsEmailRecordId = custom.pipeListsEmailRecordId || null;
        } catch (e) {
          console.warn('[brevo-webhook] Failed to parse X-Mailin-custom:', e);
        }
      }

      const macraSequenceId =
        [emailSequenceId, campaignId].find((sequenceId) =>
          Boolean(sequenceId && MACRA_RETARGETING_SEQUENCE_STATE_KEYS[sequenceId])
        ) || '';
      const macraStateKey = MACRA_RETARGETING_SEQUENCE_STATE_KEYS[macraSequenceId];

      if (product === 'macra' && macraStateKey && userId) {
        await updateMacraRetargetingEmailSequenceStatus({
          userId,
          stateKey: macraStateKey,
          eventType,
          email,
          messageId,
          link,
          now,
        });

        const baseInsertParts = [
          macraSequenceId,
          `email-${eventType}`,
          messageId || userId,
          webhookEvent.ts_event || webhookEvent.ts || webhookEvent.ts_epoch || Date.now(),
          eventType === 'click' ? link || '' : '',
        ].filter(Boolean);
        const commonProperties = {
          plan,
          email_provider: 'brevo',
          email_sequence_id: macraSequenceId,
          sequence_id: macraSequenceId,
          sequence_state_key: macraStateKey,
          campaign_id: campaignId || macraSequenceId,
          cta_url_mode: ctaUrlMode || null,
          checkout_campaign_id: checkoutCampaignId || null,
          brevo_message_id: messageId || null,
          brevo_event_type: eventType,
          brevo_raw_event_type: rawEventType,
          recipient_email: email || null,
          clicked_link: eventType === 'click' ? link || null : null,
          time: webhookEvent.ts_event || webhookEvent.ts || webhookEvent.ts_epoch || Math.floor(now.getTime() / 1000),
        };
        const retargetingMixpanelEventName =
          MACRA_BREVO_EVENT_TO_RETARGETING_MIXPANEL[eventType] ||
          (MACRA_BREVO_ISSUE_EVENTS.has(eventType) ? MACRA_MIXPANEL_EVENTS.retargetingEmailIssue : null);

        if (retargetingMixpanelEventName) {
          await safeTrackMacraWebOfferEvent({
            eventName: retargetingMixpanelEventName,
            userId,
            email,
            insertId: ['macra-retargeting', ...baseInsertParts].join(':'),
            properties: commonProperties,
          });
        }

        if (macraSequenceId === MACRA_WEB_OFFER_CAMPAIGN_ID) {
          const mixpanelEventName =
            MACRA_BREVO_EVENT_TO_MIXPANEL[eventType] ||
            (MACRA_BREVO_ISSUE_EVENTS.has(eventType) ? MACRA_MIXPANEL_EVENTS.emailIssue : null);

          if (mixpanelEventName) {
            await safeTrackMacraWebOfferEvent({
              eventName: mixpanelEventName,
              userId,
              email,
              insertId: ['macra-web-offer', ...baseInsertParts].join(':'),
              properties: commonProperties,
            });
          }
        }
      }

      if (signingRequestId) {
        await updateSigningRequestEmailStatus({
          signingRequestId,
          eventType,
          email,
          messageId,
          link,
          now,
        });
      }

      if (pilotAthleteCommunicationId) {
        const outreachRef = db.collection(PILOT_ATHLETE_COMMUNICATIONS_COLLECTION).doc(pilotAthleteCommunicationId);
        const outreachUpdate: Record<string, any> = {
          lastEmailEvent: eventType,
          lastEmailEventAt: now,
          updatedAt: now,
        };
        applyPilotAthleteCommunicationStatusUpdate(outreachUpdate, eventType, now, link);
        if (messageId) {
          outreachUpdate.messageId = messageId;
        }
        await outreachRef.set(outreachUpdate, { merge: true });
      }

      if (pipeListsOwnerUid && pipeListsListId) {
        await updatePipeListsContactEmailStatus({
          ownerUid: pipeListsOwnerUid,
          listId: pipeListsListId,
          itemIds: pipeListsItemIds,
          emailType: pipeListsEmailType || undefined,
          eventType,
          email,
          messageId,
          link,
          now,
        }).catch((error) => {
          console.warn(
            `[brevo-webhook] Failed to update PipeLists email status for ${pipeListsEmailRecordId || pipeListsEmailBatchId || pipeListsListId}:`,
            error?.message || error,
          );
        });
      }

      // If we have a friendId, update the friend's email tracking
      if (friendId) {
        const friendRef = db.collection('friends-of-business').doc(friendId);
        const friendDoc = await friendRef.get();
        
        if (friendDoc.exists) {
          const updateData: Record<string, any> = {
            lastEmailEvent: eventType,
            lastEmailEventAt: now,
          };

          applyStatusUpdate(
            updateData,
            eventType,
            now,
            link,
            updatePeriodId ? `emailUpdates.${updatePeriodId}` : undefined
          );

          await friendRef.update(updateData);
          console.log(`[brevo-webhook] Updated friend ${friendId} with event ${eventType}${updatePeriodId ? ` for period ${updatePeriodId}` : ''}`);

          // Also store in email history subcollection for detailed tracking
          const historyRef = friendRef.collection('emailHistory').doc(emailRecordId || messageId || `${Date.now()}`);
          const historyDoc = await historyRef.get();
          
          if (historyDoc.exists) {
            // Update existing record
            const historyUpdate: Record<string, any> = {
              [`events.${eventType}`]: admin.firestore.FieldValue.arrayUnion({
                timestamp: now,
                link: link || null,
              }),
            };
            
            if (eventType === 'opened' && !historyDoc.data()?.firstOpenedAt) {
              historyUpdate.firstOpenedAt = now;
            }
            if (eventType === 'click' && !historyDoc.data()?.firstClickedAt) {
              historyUpdate.firstClickedAt = now;
            }
            
            await historyRef.update(historyUpdate);
          } else {
            // Create new record if it doesn't exist (fallback)
            await historyRef.set({
              email,
              messageId,
              createdAt: now,
              events: {
                [eventType]: [{
                  timestamp: now,
                  link: link || null,
                }],
              },
              ...(eventType === 'opened' ? { firstOpenedAt: now } : {}),
              ...(eventType === 'click' ? { firstClickedAt: now } : {}),
            });
          }
        } else {
          console.warn(`[brevo-webhook] Friend ${friendId} not found`);
        }
      } else {
        // No friendId - try to find by email
        console.log(`[brevo-webhook] No friendId, looking up by email: ${email}`);
        const friendsSnapshot = await db.collection('friends-of-business')
          .where('email', '==', email)
          .limit(1)
          .get();
        
        if (!friendsSnapshot.empty) {
          const friendDoc = friendsSnapshot.docs[0];
          const updateData: Record<string, any> = {
            lastEmailEvent: eventType,
            lastEmailEventAt: now,
          };

          applyStatusUpdate(updateData, eventType, now, link);

          await friendDoc.ref.update(updateData);
          console.log(`[brevo-webhook] Updated friend by email lookup with event ${eventType}`);
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, processed: events.length }),
    };
  } catch (e: any) {
    console.error('[brevo-webhook] Error:', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e?.message || 'Internal error' }),
    };
  }
};
