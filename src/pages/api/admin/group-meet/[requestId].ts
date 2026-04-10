import type { NextApiRequest, NextApiResponse } from "next";
import admin, { getFirebaseAdminApp } from "../../../../lib/firebase-admin";
import { getGoogleCalendarSetupStatus } from "../../../../lib/googleCalendar";
import {
  computeGroupMeetAnalysis,
  type GroupMeetAiRecommendation,
  type GroupMeetCalendarInvite,
  type GroupMeetFinalConfirmationEmail,
  type GroupMeetFinalReminderEmail,
  type GroupMeetFinalSelection,
  type GroupMeetRequestDetail,
  isValidGroupMeetMonth,
  resolveGroupMeetStatus,
  resolveGroupMeetStatusFromInvites,
} from "../../../../lib/groupMeet";
import {
  GROUP_MEET_INVITES_SUBCOLLECTION,
  GROUP_MEET_REQUESTS_COLLECTION,
  mapGroupMeetInviteDetail,
  toIso,
} from "../../../../lib/groupMeetAdmin";
import { requireAdminRequest } from "../_auth";

type UpdateGroupMeetRequestBody = {
  title?: string;
  deadlineAt?: string | null;
  timezone?: string;
  meetingDurationMinutes?: number;
};

async function buildRequestDetail(
  requestRef: FirebaseFirestore.DocumentReference,
  requestDoc: FirebaseFirestore.DocumentSnapshot,
): Promise<GroupMeetRequestDetail> {
  const requestData = requestDoc.data() || {};
  const targetMonth =
    typeof requestData.targetMonth === "string" ? requestData.targetMonth : "";
  const deadlineAt = toIso(requestData.deadlineAt);
  const meetingDurationMinutes = Math.max(
    15,
    Number(requestData.meetingDurationMinutes) || 30,
  );
  const invitesSnapshot = await requestRef
    .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
    .orderBy("createdAt", "asc")
    .get();
  const invites = invitesSnapshot.docs.map((docSnap) =>
    mapGroupMeetInviteDetail(docSnap, targetMonth),
  );
  const finalConfirmationEmailData = requestData.finalConfirmationEmail || null;
  const finalReminderEmailData = requestData.finalReminderEmail || null;

  return {
    id: requestDoc.id,
    title: requestData.title || "Group Meet",
    targetMonth,
    deadlineAt,
    timezone: requestData.timezone || "America/New_York",
    meetingDurationMinutes,
    createdByEmail: requestData.createdByEmail || null,
    createdAt: toIso(requestData.createdAt),
    participantCount: Number(requestData.participantCount) || invites.length,
    responseCount: invites.filter((invite) => invite.respondedAt).length,
    status: resolveGroupMeetStatusFromInvites(
      deadlineAt,
      requestData.status,
      invites,
      {
        finalSelection: requestData.finalSelection || null,
        calendarInvite: requestData.calendarInvite || null,
      },
    ),
    invites,
    analysis: computeGroupMeetAnalysis(invites, meetingDurationMinutes),
    aiRecommendation: (requestData.aiRecommendation ||
      null) as GroupMeetAiRecommendation | null,
    finalSelection: (requestData.finalSelection ||
      null) as GroupMeetFinalSelection | null,
    calendarInvite: (requestData.calendarInvite ||
      null) as GroupMeetCalendarInvite | null,
    finalConfirmationEmail: finalConfirmationEmailData
      ? ({
          sentAt: toIso(finalConfirmationEmailData.sentAt),
          sentByEmail:
            typeof finalConfirmationEmailData.sentByEmail === "string"
              ? finalConfirmationEmailData.sentByEmail
              : null,
          sendMode:
            finalConfirmationEmailData.sendMode === "automatic" ||
            finalConfirmationEmailData.sendMode === "manual"
              ? finalConfirmationEmailData.sendMode
              : null,
          recipientCount: Math.max(
            0,
            Number(finalConfirmationEmailData.recipientCount) || 0,
          ),
          previewSentAt: toIso(finalConfirmationEmailData.previewSentAt),
          previewRecipientEmail:
            typeof finalConfirmationEmailData.previewRecipientEmail === "string"
              ? finalConfirmationEmailData.previewRecipientEmail
              : null,
        } satisfies GroupMeetFinalConfirmationEmail)
      : null,
    finalReminderEmail: finalReminderEmailData
      ? ({
          sentAt: toIso(finalReminderEmailData.sentAt),
          sentByEmail:
            typeof finalReminderEmailData.sentByEmail === "string"
              ? finalReminderEmailData.sentByEmail
              : null,
          sendMode:
            finalReminderEmailData.sendMode === "automatic" ||
            finalReminderEmailData.sendMode === "manual"
              ? finalReminderEmailData.sendMode
              : null,
          recipientCount: Math.max(
            0,
            Number(finalReminderEmailData.recipientCount) || 0,
          ),
          selectionSignature:
            typeof finalReminderEmailData.selectionSignature === "string"
              ? finalReminderEmailData.selectionSignature
              : null,
        } satisfies GroupMeetFinalReminderEmail)
      : null,
    calendarSetup: await getGoogleCalendarSetupStatus(),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const requestId =
    typeof req.query.requestId === "string" ? req.query.requestId.trim() : "";
  if (!requestId) {
    return res.status(400).json({ error: "Request id is required." });
  }

  const forceDevFirebase =
    req.headers?.["x-force-dev-firebase"] === "true" ||
    req.headers?.["x-force-dev-firebase"] === "1";
  const requestRef = getFirebaseAdminApp(forceDevFirebase)
    .firestore()
    .collection(GROUP_MEET_REQUESTS_COLLECTION)
    .doc(requestId);

  if (req.method === "GET") {
    try {
      const requestDoc = await requestRef.get();

      if (!requestDoc.exists) {
        return res.status(404).json({ error: "Group Meet request not found." });
      }

      return res
        .status(200)
        .json({ request: await buildRequestDetail(requestRef, requestDoc) });
    } catch (error: any) {
      console.error("[group-meet-admin-detail] Failed to load request:", error);
      return res.status(500).json({
        error: error?.message || "Failed to load Group Meet request.",
      });
    }
  }

  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({ error: "Group Meet request not found." });
    }

    const requestData = requestDoc.data() || {};
    const body = (req.body || {}) as UpdateGroupMeetRequestBody;
    const title = (body.title || requestData.title || "Group Meet").trim();
    const timezone =
      (body.timezone || requestData.timezone || "America/New_York").trim() ||
      "America/New_York";
    const deadlineRaw =
      typeof body.deadlineAt === "string"
        ? body.deadlineAt
        : toIso(requestData.deadlineAt) || "";
    const deadline = new Date(deadlineRaw);
    const targetMonth = String(requestData.targetMonth || "").trim();
    const meetingDurationMinutes = Math.max(
      15,
      Math.min(
        240,
        Number(body.meetingDurationMinutes) ||
          Number(requestData.meetingDurationMinutes) ||
          30,
      ),
    );

    if (!title) {
      return res.status(400).json({ error: "A title is required." });
    }

    if (!isValidGroupMeetMonth(targetMonth)) {
      return res.status(400).json({
        error: "This Group Meet request is missing a valid target month.",
      });
    }

    if (Number.isNaN(deadline.getTime())) {
      return res.status(400).json({ error: "A valid deadline is required." });
    }

    const durationChanged =
      meetingDurationMinutes !==
      Math.max(15, Number(requestData.meetingDurationMinutes) || 30);
    const timezoneChanged =
      timezone !== (requestData.timezone || "America/New_York");

    const updatePayload: Record<string, unknown> = {
      title,
      deadlineAt: admin.firestore.Timestamp.fromDate(deadline),
      timezone,
      meetingDurationMinutes,
      status: resolveGroupMeetStatus(
        deadline.toISOString(),
        requestData.status,
        {
          finalSelection: requestData.finalSelection || null,
          calendarInvite: requestData.calendarInvite || null,
        },
      ),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedByEmail: adminUser.email || null,
    };

    if (durationChanged || timezoneChanged) {
      updatePayload.aiRecommendation = null;
      updatePayload.finalSelection = null;
      updatePayload.calendarInvite = null;
      updatePayload.finalConfirmationEmail = null;
      updatePayload.finalReminderEmail = null;
      updatePayload.finalizedByEmail = null;
      updatePayload.calendarInviteUpdatedByEmail = null;
    }

    await requestRef.set(updatePayload, { merge: true });
    const updatedDoc = await requestRef.get();

    return res.status(200).json({
      request: await buildRequestDetail(requestRef, updatedDoc),
      resetDerivedSelections: durationChanged || timezoneChanged,
    });
  } catch (error: any) {
    console.error("[group-meet-admin-edit] Failed to update request:", error);
    return res.status(500).json({
      error: error?.message || "Failed to update Group Meet request.",
    });
  }
}
