const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

const normalizeString = (value) => (typeof value === "string" ? value.trim() : "");
const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return 0;
};

exports.repairPulseCheckGeneralInviteStatus = onDocumentWritten(
  "pulsecheck-invite-links/{inviteId}",
  async (event) => {
    const change = event.data;
    if (!change || !change.after.exists) {
      return;
    }

    const before = change.before.exists ? change.before.data() || {} : {};
    const after = change.after.data() || {};
    if (normalizeString(after.inviteType) !== "team-access") {
      return;
    }
    if (normalizeString(after.redemptionMode) !== "general") {
      return;
    }

    const afterStatus = normalizeString(after.status) || "active";
    const beforeStatus = normalizeString(before.status) || "active";
    const afterRedeemedAtMillis = toMillis(after.redeemedAt);
    const beforeRedeemedAtMillis = toMillis(before.redeemedAt);
    const shouldRepairStatus = afterStatus !== "active";
    const shouldCountRedemption =
      afterStatus === "redeemed" &&
      (
        afterRedeemedAtMillis !== beforeRedeemedAtMillis ||
        normalizeString(after.redeemedByUserId) !== normalizeString(before.redeemedByUserId) ||
        normalizeString(after.redeemedByEmail) !== normalizeString(before.redeemedByEmail) ||
        beforeStatus !== "redeemed"
      );

    if (!shouldRepairStatus && !shouldCountRedemption) {
      return;
    }

    const repairPayload = {
      status: "active",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (shouldCountRedemption) {
      repairPayload.redemptionCount = admin.firestore.FieldValue.increment(1);
    }

    await change.after.ref.set(repairPayload, { merge: true });
  }
);
