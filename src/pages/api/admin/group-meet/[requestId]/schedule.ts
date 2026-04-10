import type { NextApiRequest, NextApiResponse } from "next";
import admin, { getFirebaseAdminApp } from "../../../../../lib/firebase-admin";
import { requireAdminRequest } from "../../_auth";
import { buildGroupMeetFinalSelectionSignature } from "../../../../../lib/groupMeet";
import {
  mapGroupMeetInviteDocs,
  scheduleGroupMeetCalendarInvite,
} from "../../../../../lib/groupMeetWorkflow";
import { sendGroupMeetFinalConfirmationEmailBatch } from "../../../../../lib/groupMeetAdmin";

const REQUESTS_COLLECTION = "groupMeetRequests";
const INVITES_SUBCOLLECTION = "groupMeetInvites";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const requestId =
    typeof req.query.requestId === "string" ? req.query.requestId.trim() : "";
  if (!requestId) {
    return res.status(400).json({ error: "Request id is required." });
  }

  const forceDevFirebase =
    req.headers?.["x-force-dev-firebase"] === "true" ||
    req.headers?.["x-force-dev-firebase"] === "1";

  try {
    const requestRef = getFirebaseAdminApp(forceDevFirebase)
      .firestore()
      .collection(REQUESTS_COLLECTION)
      .doc(requestId);
    const requestDoc = await requestRef.get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: "Group Meet request not found." });
    }

    const requestData = requestDoc.data() || {};
    const finalSelection = requestData.finalSelection || null;
    if (!finalSelection) {
      return res.status(400).json({
        error: "Select a final meeting block before creating the invite.",
      });
    }

    const timezone = requestData.timezone || "America/New_York";
    const title = requestData.title || "Group Meet";
    const invitesSnapshot = await requestRef
      .collection(INVITES_SUBCOLLECTION)
      .orderBy("createdAt", "asc")
      .get();
    const invites = mapGroupMeetInviteDocs(
      invitesSnapshot,
      requestData.targetMonth || "",
    );
    const calendarInvite = await scheduleGroupMeetCalendarInvite({
      requestId,
      title,
      timezone,
      finalSelection,
      aiSummary: requestData.aiRecommendation?.summary || null,
      invites,
      existingInvite: requestData.calendarInvite || null,
    });

    const existingFinalConfirmationEmail =
      requestData.finalConfirmationEmail || null;
    const existingFinalReminderEmail = requestData.finalReminderEmail || null;
    const currentSelectionSignature =
      buildGroupMeetFinalSelectionSignature(finalSelection);
    const shouldAutoSendFinalConfirmation =
      !existingFinalConfirmationEmail?.sentAt;
    let confirmationEmailResult: {
      attempted: boolean;
      sentCount: number;
      failedCount: number;
      skippedCount: number;
      recipientCount: number;
      mode: "automatic";
    } = {
      attempted: false,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      recipientCount: 0,
      mode: "automatic",
    };

    if (shouldAutoSendFinalConfirmation) {
      const finalConfirmationSendResult =
        await sendGroupMeetFinalConfirmationEmailBatch({
          requestId,
          requestTitle: title,
          timezone,
          finalSelection,
          calendarInvite,
          invites,
          mode: "automatic",
        });

      confirmationEmailResult = {
        attempted: true,
        sentCount: finalConfirmationSendResult.sentCount,
        failedCount: finalConfirmationSendResult.failedCount,
        skippedCount: finalConfirmationSendResult.skippedCount,
        recipientCount: finalConfirmationSendResult.recipientCount,
        mode: "automatic",
      };
    }

    const nextFinalConfirmationEmail =
      confirmationEmailResult.sentCount > 0
        ? {
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            sentByEmail: adminUser.email || null,
            sendMode: "automatic",
            recipientCount: confirmationEmailResult.sentCount,
            previewSentAt:
              existingFinalConfirmationEmail?.previewSentAt || null,
            previewRecipientEmail:
              existingFinalConfirmationEmail?.previewRecipientEmail || null,
          }
        : requestData.finalConfirmationEmail || null;
    const nextFinalReminderEmail =
      existingFinalReminderEmail?.selectionSignature &&
      currentSelectionSignature &&
      existingFinalReminderEmail.selectionSignature ===
        currentSelectionSignature
        ? existingFinalReminderEmail
        : null;

    await requestRef.set(
      {
        status: "closed",
        calendarInvite,
        finalConfirmationEmail: nextFinalConfirmationEmail,
        finalReminderEmail: nextFinalReminderEmail,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        finalizedByEmail:
          requestData.finalSelection?.selectedByEmail ||
          adminUser.email ||
          null,
        calendarInviteUpdatedByEmail: adminUser.email,
      },
      { merge: true },
    );

    return res
      .status(200)
      .json({ calendarInvite, confirmationEmail: confirmationEmailResult });
  } catch (error: any) {
    console.error(
      "[group-meet-schedule] Failed to create calendar invite:",
      error,
    );
    return res.status(500).json({
      error: error?.message || "Failed to create Google Calendar invite.",
    });
  }
}
