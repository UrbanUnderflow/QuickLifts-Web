import { schedule } from "@netlify/functions";
import admin, { getFirebaseAdminApp } from "../../src/lib/firebase-admin";
import { getGroupMeetFinalReminderDispatchDecision } from "../../src/lib/groupMeetReminder";
import {
  GROUP_MEET_INVITES_SUBCOLLECTION,
  GROUP_MEET_REQUESTS_COLLECTION,
  mapGroupMeetInviteDetail,
  sendGroupMeetFinalReminderEmailBatch,
} from "../../src/lib/groupMeetAdmin";

export async function runScheduledGroupMeetFinalReminders(now = new Date()) {
  const db = getFirebaseAdminApp(false).firestore();
  const requestsSnapshot = await db
    .collection(GROUP_MEET_REQUESTS_COLLECTION)
    .get();

  let processedRequests = 0;
  let emailedRecipients = 0;
  let failedRecipients = 0;

  for (const requestDoc of requestsSnapshot.docs) {
    const requestData = requestDoc.data() || {};
    const finalSelection = requestData.finalSelection || null;
    const calendarInvite = requestData.calendarInvite || null;

    if (!finalSelection || !calendarInvite) {
      continue;
    }

    const dispatchDecision = getGroupMeetFinalReminderDispatchDecision({
      now,
      finalSelection,
      timezone: requestData.timezone || "America/New_York",
      sentSelectionSignature:
        requestData.finalReminderEmail?.selectionSignature || null,
      leadMinutes: 60,
    });

    if (!dispatchDecision.due) {
      continue;
    }

    const invitesSnapshot = await requestDoc.ref
      .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
      .orderBy("createdAt", "asc")
      .get();
    const invites = invitesSnapshot.docs.map((docSnap) =>
      mapGroupMeetInviteDetail(docSnap, requestData.targetMonth || ""),
    );
    const hasReminderRecipients = invites.some(
      (invite) =>
        invite.participantType !== "host" &&
        typeof invite.email === "string" &&
        invite.email.trim().length > 0,
    );

    if (!hasReminderRecipients) {
      continue;
    }

    processedRequests += 1;
    const sendResult = await sendGroupMeetFinalReminderEmailBatch({
      requestId: requestDoc.id,
      requestTitle: requestData.title || "Group Meet",
      timezone: requestData.timezone || "America/New_York",
      finalSelection,
      calendarInvite,
      invites,
      mode: "automatic",
    });

    emailedRecipients += sendResult.sentCount;
    failedRecipients += sendResult.failedCount;

    if (sendResult.failedCount > 0) {
      await requestDoc.ref.set(
        {
          finalReminderEmailError: sendResult.errors.join(" | "),
          finalReminderEmailLastAttemptedAt:
            admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      continue;
    }

    const deliveredCount = Math.max(
      sendResult.sentCount,
      sendResult.recipientCount - sendResult.failedCount,
    );

    await requestDoc.ref.set(
      {
        finalReminderEmail: {
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          sentByEmail: null,
          sendMode: "automatic",
          recipientCount: deliveredCount,
          selectionSignature: dispatchDecision.selectionSignature,
        },
        finalReminderEmailError: null,
        finalReminderEmailLastAttemptedAt:
          admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  return {
    success: true,
    processedRequests,
    emailedRecipients,
    failedRecipients,
  };
}

export const handler = schedule("*/15 * * * *", async () => {
  try {
    const result = await runScheduledGroupMeetFinalReminders();
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    console.error(
      "[scheduled-group-meet-final-reminders] Failed to process reminders:",
      error,
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error:
          error?.message || "Failed to process Group Meet final reminders.",
      }),
    };
  }
});
