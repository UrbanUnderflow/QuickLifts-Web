import type { NextApiRequest, NextApiResponse } from "next";
import admin, {
  getFirebaseAdminApp,
} from "../../../../../../../lib/firebase-admin";
import {
  computeGroupMeetAnalysis,
  resolveGroupMeetStatusFromInvites,
} from "../../../../../../../lib/groupMeet";
import {
  GROUP_MEET_INVITES_SUBCOLLECTION,
  GROUP_MEET_REQUESTS_COLLECTION,
  mapGroupMeetInviteDetail,
  toIso,
} from "../../../../../../../lib/groupMeetAdmin";
import {
  buildGroupMeetFinalSelection,
  scheduleGroupMeetCalendarInvite,
} from "../../../../../../../lib/groupMeetWorkflow";
import { requireAdminRequest } from "../../../../_auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const requestId =
    typeof req.query.requestId === "string" ? req.query.requestId.trim() : "";
  const token =
    typeof req.query.token === "string" ? req.query.token.trim() : "";

  if (!requestId || !token) {
    return res
      .status(400)
      .json({ error: "Request id and invite token are required." });
  }

  const forceDevFirebase =
    req.headers?.["x-force-dev-firebase"] === "true" ||
    req.headers?.["x-force-dev-firebase"] === "1";

  try {
    const requestRef = getFirebaseAdminApp(forceDevFirebase)
      .firestore()
      .collection(GROUP_MEET_REQUESTS_COLLECTION)
      .doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({ error: "Group Meet request not found." });
    }

    const inviteRef = requestRef
      .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
      .doc(token);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
      return res.status(404).json({ error: "Group Meet invite not found." });
    }

    const inviteData = inviteDoc.data() || {};
    if (inviteData.participantType === "host") {
      return res.status(400).json({
        error: "The host cannot be removed from the request.",
      });
    }

    const requestData = requestDoc.data() || {};
    const targetMonth =
      typeof requestData.targetMonth === "string"
        ? requestData.targetMonth
        : "";
    const deadlineAt = toIso(requestData.deadlineAt);
    const removedInviteName = inviteData.name || "Guest";

    await inviteRef.delete();

    const remainingInvitesSnapshot = await requestRef
      .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
      .orderBy("createdAt", "asc")
      .get();
    const remainingInvites = remainingInvitesSnapshot.docs.map((docSnap) =>
      mapGroupMeetInviteDetail(docSnap, targetMonth),
    );
    const responseCount = remainingInvites.filter(
      (invite) => invite.respondedAt || invite.availabilityEntries.length > 0,
    ).length;

    const updatePayload: Record<string, unknown> = {
      participantCount: remainingInvites.length,
      responseCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedByEmail: adminUser.email || null,
      finalConfirmationEmail: null,
      finalReminderEmail: null,
    };

    if (requestData.calendarInvite && requestData.finalSelection) {
      const updatedCalendarInvite = await scheduleGroupMeetCalendarInvite({
        requestId,
        title: requestData.title || "Group Meet",
        timezone: requestData.timezone || "America/New_York",
        finalSelection: requestData.finalSelection,
        aiSummary: requestData.aiRecommendation?.summary || null,
        invites: remainingInvites,
        existingInvite: requestData.calendarInvite || null,
      });

      updatePayload.calendarInvite = updatedCalendarInvite;
      updatePayload.calendarInviteUpdatedByEmail = adminUser.email || null;
      updatePayload.status = resolveGroupMeetStatusFromInvites(
        deadlineAt,
        requestData.status,
        remainingInvites,
        {
          finalSelection: requestData.finalSelection || null,
          calendarInvite: updatedCalendarInvite,
        },
      );
    } else {
      const analysis = computeGroupMeetAnalysis(
        remainingInvites,
        Math.max(15, Number(requestData.meetingDurationMinutes) || 30),
      );
      const existingFinalSelection = requestData.finalSelection || null;

      if (existingFinalSelection?.candidateKey) {
        try {
          updatePayload.finalSelection = buildGroupMeetFinalSelection({
            analysis,
            candidateKey: existingFinalSelection.candidateKey,
            selectedByEmail:
              existingFinalSelection.selectedByEmail || adminUser.email || null,
            hostNote: existingFinalSelection.hostNote || "",
          });
        } catch (_error) {
          updatePayload.finalSelection = null;
        }
      }

      updatePayload.aiRecommendation = null;
      updatePayload.status = resolveGroupMeetStatusFromInvites(
        deadlineAt,
        requestData.status,
        remainingInvites,
        {
          finalSelection: updatePayload.finalSelection || null,
          calendarInvite: null,
        },
      );
    }

    await requestRef.set(updatePayload, { merge: true });

    return res.status(200).json({
      success: true,
      removedInviteName,
      participantCount: remainingInvites.length,
      responseCount,
      calendarInviteUpdated: Boolean(
        requestData.calendarInvite && requestData.finalSelection,
      ),
    });
  } catch (error: any) {
    console.error("[group-meet-remove-invite] Failed to remove invite:", error);
    return res.status(500).json({
      error: error?.message || "Failed to remove guest from Group Meet.",
    });
  }
}
