import { schedule } from '@netlify/functions';
import admin, { getFirebaseAdminApp } from '../../src/lib/firebase-admin';
import { computeGroupMeetAnalysis, resolveGroupMeetStatusFromInvites } from '../../src/lib/groupMeet';
import {
  buildGroupMeetFlexRoundOptions,
  buildGroupMeetFlexPromptRecipients,
  getGroupMeetEasternDateKey,
  isGroupMeetFlexDispatchTime,
} from '../../src/lib/groupMeetFlex';
import {
  getGroupMeetConfiguredBaseUrl,
  GROUP_MEET_INVITES_SUBCOLLECTION,
  GROUP_MEET_REQUESTS_COLLECTION,
  mapGroupMeetInviteDetail,
  sendGroupMeetFlexPromptEmail,
  sendGroupMeetNoResponseReminderEmail,
  toIso,
} from '../../src/lib/groupMeetAdmin';

export async function runScheduledGroupMeetFlexPrompts(now = new Date()) {
  if (!isGroupMeetFlexDispatchTime(now)) {
    return {
      success: true,
      skipped: true,
      reason: 'outside-flex-dispatch-window',
      processedRequests: 0,
      emailedRecipients: 0,
      failedRecipients: 0,
      reminderRecipients: 0,
    };
  }

  const localDateKey = getGroupMeetEasternDateKey(now);
  const db = getFirebaseAdminApp(false).firestore();
  const requestsSnapshot = await db.collection(GROUP_MEET_REQUESTS_COLLECTION).get();
  const baseUrl = getGroupMeetConfiguredBaseUrl();

  let processedRequests = 0;
  let emailedRecipients = 0;
  let failedRecipients = 0;
  let reminderRecipients = 0;

  for (const requestDoc of requestsSnapshot.docs) {
    const requestData = requestDoc.data() || {};
    const deadlineAt = toIso(requestData.deadlineAt);
    if (!deadlineAt || getGroupMeetEasternDateKey(deadlineAt) !== localDateKey) {
      continue;
    }

    const invitesSnapshot = await requestDoc.ref
      .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
      .orderBy('createdAt', 'asc')
      .get();
    const targetMonth = requestData.targetMonth || '';
    const rawInviteDataByToken = new Map(
      invitesSnapshot.docs.map((docSnap) => [docSnap.id, docSnap.data() || {}] as const)
    );
    const invites = invitesSnapshot.docs.map((docSnap) =>
      mapGroupMeetInviteDetail(docSnap, targetMonth)
    );
    const resolvedStatus = resolveGroupMeetStatusFromInvites(deadlineAt, requestData.status, invites);

    if (resolvedStatus !== 'collecting') {
      continue;
    }

    if (requestData.deadlineFollowupSentLocalDate === localDateKey) {
      continue;
    }

    const analysis = computeGroupMeetAnalysis(
      invites,
      Math.max(15, Number(requestData.meetingDurationMinutes) || 30)
    );

    if (analysis.fullMatchCandidates.length > 0) {
      continue;
    }

    const recipients = buildGroupMeetFlexPromptRecipients({
      analysis,
      invites,
      maxOptionsPerRecipient: 3,
      includeHost: false,
      referenceDate: now,
    }).filter((recipient) => {
      const rawInviteData = rawInviteDataByToken.get(recipient.inviteToken) || {};
      return rawInviteData.flexPromptSentLocalDate !== localDateKey;
    });
    const sharedRoundOptions = (() => {
      const shared = [];
      for (const recipient of recipients) {
        for (const option of recipient.options) {
          if (shared.some((entry) => entry.candidateKey === option.candidateKey)) {
            continue;
          }
          shared.push(option);
          if (shared.length >= 3) {
            return shared;
          }
        }
      }

      const fallbackOptions = buildGroupMeetFlexRoundOptions({
        analysis,
        maxOptions: 3,
        referenceDate: now,
      });

      for (const option of fallbackOptions) {
        if (shared.some((entry) => entry.candidateKey === option.candidateKey)) {
          continue;
        }
        shared.push(option);
        if (shared.length >= 3) {
          break;
        }
      }

      return shared;
    })();

    const flexRecipientTokens = new Set(recipients.map((recipient) => recipient.inviteToken));
    const reminderCandidates = invites.filter((invite) => {
      if (invite.participantType === 'host' || !invite.email) {
        return false;
      }

      if (flexRecipientTokens.has(invite.token)) {
        return false;
      }

      if (invite.respondedAt || invite.availabilityEntries.length > 0) {
        return false;
      }

      const rawInviteData = rawInviteDataByToken.get(invite.token) || {};
      return rawInviteData.deadlineReminderSentLocalDate !== localDateKey;
    });

    if (!recipients.length && !reminderCandidates.length) {
      continue;
    }

    processedRequests += 1;
    let pendingFailuresForRequest = 0;

    for (const recipient of recipients) {
      const sendResult = await sendGroupMeetFlexPromptEmail({
        requestId: requestDoc.id,
        requestTitle: requestData.title || 'Group Meet',
        targetMonth,
        deadlineAt,
        timezone: requestData.timezone || 'America/New_York',
        inviteToken: recipient.inviteToken,
        recipientName: recipient.name || 'Guest',
        recipientEmail: recipient.email,
        shareUrl: recipient.shareUrl,
        baseUrl,
        options: recipient.options,
      });

      if (sendResult.success) {
        emailedRecipients += sendResult.skipped ? 0 : 1;

        await requestDoc.ref
          .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
          .doc(recipient.inviteToken)
          .set(
            {
              flexPromptSentAt: admin.firestore.FieldValue.serverTimestamp(),
              flexPromptSentLocalDate: localDateKey,
              flexPromptCandidateKeys: recipient.options.map((option) => option.candidateKey),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        continue;
      }

      pendingFailuresForRequest += 1;
      failedRecipients += 1;

      await requestDoc.ref
        .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
        .doc(recipient.inviteToken)
        .set(
          {
            flexPromptError: sendResult.error || 'Failed to send flex prompt email.',
            flexPromptLastAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }

    for (const recipient of reminderCandidates) {
      if (!sharedRoundOptions.length) {
        continue;
      }

      const sendResult = await sendGroupMeetNoResponseReminderEmail({
        requestId: requestDoc.id,
        requestTitle: requestData.title || 'Group Meet',
        targetMonth,
        deadlineAt,
        timezone: requestData.timezone || 'America/New_York',
        inviteToken: recipient.token,
        recipientName: recipient.name || 'Guest',
        recipientEmail: recipient.email || '',
        shareUrl: recipient.shareUrl,
        baseUrl,
        options: sharedRoundOptions,
      });

      if (sendResult.success) {
        reminderRecipients += sendResult.skipped ? 0 : 1;

        await requestDoc.ref
          .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
          .doc(recipient.token)
          .set(
            {
              deadlineReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
              deadlineReminderSentLocalDate: localDateKey,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        continue;
      }

      pendingFailuresForRequest += 1;
      failedRecipients += 1;

      await requestDoc.ref
        .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
        .doc(recipient.token)
        .set(
          {
            deadlineReminderError: sendResult.error || 'Failed to send no-response reminder email.',
            deadlineReminderLastAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }

    if (pendingFailuresForRequest === 0) {
      await requestDoc.ref.set(
        {
          flexRoundSentAt: admin.firestore.FieldValue.serverTimestamp(),
          flexRoundSentLocalDate: localDateKey,
          flexRoundRecipientCount: recipients.length,
          flexRoundCandidateCount: recipients.reduce((total, recipient) => total + recipient.options.length, 0),
          deadlineFollowupSentAt: admin.firestore.FieldValue.serverTimestamp(),
          deadlineFollowupSentLocalDate: localDateKey,
          deadlineFollowupReminderRecipientCount: reminderCandidates.length,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  return {
    success: true,
    skipped: false,
    localDateKey,
    processedRequests,
    emailedRecipients,
    failedRecipients,
    reminderRecipients,
  };
}

export const handler = schedule('*/30 * * * *', async () => {
  try {
    const result = await runScheduledGroupMeetFlexPrompts();
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    console.error('[scheduled-group-meet-flex-prompts] Failed to process flex prompts:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Failed to process Group Meet flex prompts.',
      }),
    };
  }
});
