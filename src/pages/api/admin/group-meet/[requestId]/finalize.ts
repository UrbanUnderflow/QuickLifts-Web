import type { NextApiRequest, NextApiResponse } from "next";
import admin, { getFirebaseAdminApp } from "../../../../../lib/firebase-admin";
import { requireAdminRequest } from "../../_auth";
import {
  buildGroupMeetFinalSelectionSignature,
  computeGroupMeetAnalysis,
} from "../../../../../lib/groupMeet";
import {
  buildGroupMeetFinalSelection,
  mapGroupMeetInviteDocs,
} from "../../../../../lib/groupMeetWorkflow";

const REQUESTS_COLLECTION = "groupMeetRequests";
const INVITES_SUBCOLLECTION = "groupMeetInvites";

type FinalizeBody = {
  candidateKey?: string;
  hostNote?: string;
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

  const forceDevFirebase =
    req.headers?.["x-force-dev-firebase"] === "true" ||
    req.headers?.["x-force-dev-firebase"] === "1";

  const body = (req.body || {}) as FinalizeBody;
  const candidateKey =
    typeof body.candidateKey === "string" ? body.candidateKey.trim() : "";
  const hostNote =
    typeof body.hostNote === "string" ? body.hostNote.trim() : "";

  if (!candidateKey) {
    return res.status(400).json({ error: "candidateKey is required." });
  }

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
    const targetMonth =
      typeof requestData.targetMonth === "string"
        ? requestData.targetMonth
        : "";
    const meetingDurationMinutes = Math.max(
      15,
      Number(requestData.meetingDurationMinutes) || 30,
    );
    const invitesSnapshot = await requestRef
      .collection(INVITES_SUBCOLLECTION)
      .orderBy("createdAt", "asc")
      .get();
    const invites = mapGroupMeetInviteDocs(invitesSnapshot, targetMonth);
    const hostInvite = invites.find(
      (invite) => invite.participantType === "host",
    );
    const analysis = computeGroupMeetAnalysis(invites, meetingDurationMinutes);
    const finalSelection = buildGroupMeetFinalSelection({
      analysis,
      candidateKey,
      selectedByEmail: hostInvite?.email || adminUser.email,
      hostNote,
    });
    const previousSelectionSignature = buildGroupMeetFinalSelectionSignature(
      requestData.finalSelection || null,
    );
    const nextSelectionSignature =
      buildGroupMeetFinalSelectionSignature(finalSelection);
    const selectionChanged =
      previousSelectionSignature !== nextSelectionSignature;

    await requestRef.set(
      {
        finalSelection,
        ...(selectionChanged
          ? {
              finalConfirmationEmail: null,
              finalReminderEmail: null,
            }
          : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByEmail: adminUser.email || null,
      },
      { merge: true },
    );

    return res.status(200).json({ finalSelection });
  } catch (error: any) {
    console.error(
      "[group-meet-finalize] Failed to save final selection:",
      error,
    );
    return res
      .status(500)
      .json({ error: error?.message || "Failed to save final meeting block." });
  }
}
