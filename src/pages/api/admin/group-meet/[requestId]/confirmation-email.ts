import type { NextApiRequest, NextApiResponse } from "next";
import admin, { getFirebaseAdminApp } from "../../../../../lib/firebase-admin";
import {
  GROUP_MEET_INVITES_SUBCOLLECTION,
  GROUP_MEET_REQUESTS_COLLECTION,
  mapGroupMeetInviteDetail,
  sendGroupMeetFinalConfirmationEmailBatch,
  sendGroupMeetFinalConfirmationPreviewEmail,
} from "../../../../../lib/groupMeetAdmin";
import { requireAdminRequest } from "../../_auth";

type ConfirmationEmailBody = {
  mode?: "preview" | "live";
  recipientName?: string;
  recipientEmail?: string;
};

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

  const body = (req.body || {}) as ConfirmationEmailBody;
  const mode = body.mode === "preview" ? "preview" : "live";
  const recipientName = (
    body.recipientName ||
    adminUser.email ||
    "Preview Recipient"
  ).trim();
  const recipientEmail = (body.recipientEmail || adminUser.email || "")
    .trim()
    .toLowerCase();

  const forceDevFirebase =
    req.headers?.["x-force-dev-firebase"] === "true" ||
    req.headers?.["x-force-dev-firebase"] === "1";

  try {
    const db = getFirebaseAdminApp(forceDevFirebase).firestore();
    const requestRef = db
      .collection(GROUP_MEET_REQUESTS_COLLECTION)
      .doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({ error: "Group Meet request not found." });
    }

    const requestData = requestDoc.data() || {};
    const finalSelection = requestData.finalSelection || null;
    const calendarInvite = requestData.calendarInvite || null;

    if (!finalSelection) {
      return res.status(400).json({
        error:
          "Select a final meeting block before sending confirmation emails.",
      });
    }

    if (!calendarInvite) {
      return res.status(400).json({
        error:
          "Create the Google Calendar invite before sending confirmation emails.",
      });
    }

    const targetMonth =
      typeof requestData.targetMonth === "string"
        ? requestData.targetMonth
        : "";
    const invitesSnapshot = await requestRef
      .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
      .orderBy("createdAt", "asc")
      .get();
    const invites = invitesSnapshot.docs.map((docSnap) =>
      mapGroupMeetInviteDetail(docSnap, targetMonth),
    );

    if (mode === "preview") {
      if (!recipientEmail) {
        return res.status(400).json({ error: "Recipient email is required." });
      }

      const previewResult = await sendGroupMeetFinalConfirmationPreviewEmail({
        requestId,
        requestTitle: requestData.title || "Group Meet",
        timezone: requestData.timezone || "America/New_York",
        finalSelection,
        calendarInvite,
        recipientName,
        recipientEmail,
      });

      if (!previewResult.success) {
        return res.status(500).json({
          error: previewResult.error || "Failed to send preview email.",
        });
      }

      await requestRef.set(
        {
          finalConfirmationEmail: {
            sentAt: requestData.finalConfirmationEmail?.sentAt || null,
            sentByEmail:
              requestData.finalConfirmationEmail?.sentByEmail || null,
            sendMode: requestData.finalConfirmationEmail?.sendMode || null,
            recipientCount:
              Number(requestData.finalConfirmationEmail?.recipientCount) || 0,
            previewSentAt: admin.firestore.FieldValue.serverTimestamp(),
            previewRecipientEmail: recipientEmail,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return res.status(200).json({
        success: true,
        skipped: Boolean(previewResult.skipped),
        messageId: previewResult.messageId || null,
        mode: "preview",
      });
    }

    const sendResult = await sendGroupMeetFinalConfirmationEmailBatch({
      requestId,
      requestTitle: requestData.title || "Group Meet",
      timezone: requestData.timezone || "America/New_York",
      finalSelection,
      calendarInvite,
      invites,
      mode: "manual",
    });

    if (sendResult.sentCount > 0) {
      await requestRef.set(
        {
          finalConfirmationEmail: {
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            sentByEmail: adminUser.email || null,
            sendMode: "manual",
            recipientCount: sendResult.sentCount,
            previewSentAt:
              requestData.finalConfirmationEmail?.previewSentAt || null,
            previewRecipientEmail:
              requestData.finalConfirmationEmail?.previewRecipientEmail || null,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    if (sendResult.sentCount === 0 && sendResult.failedCount > 0) {
      return res.status(500).json({
        error:
          sendResult.errors[0] ||
          "Failed to send confirmation emails to guests.",
        sentCount: 0,
        failedCount: sendResult.failedCount,
        skippedCount: sendResult.skippedCount,
        recipientCount: sendResult.recipientCount,
      });
    }

    return res.status(200).json({
      success: true,
      mode: "live",
      sentCount: sendResult.sentCount,
      failedCount: sendResult.failedCount,
      skippedCount: sendResult.skippedCount,
      recipientCount: sendResult.recipientCount,
      errors: sendResult.errors,
    });
  } catch (error: any) {
    console.error(
      "[group-meet-final-confirmation] Failed to send confirmation email:",
      error,
    );
    return res.status(500).json({
      error: error?.message || "Failed to send confirmation email.",
    });
  }
}
