import test from "node:test";
import assert from "node:assert/strict";

import { mapGroupMeetFinalConfirmationEmail } from "../../src/lib/groupMeetAdmin";

test("mapGroupMeetFinalConfirmationEmail normalizes stored metadata", () => {
  const timestampLike = (iso: string) => ({
    toDate() {
      return new Date(iso);
    },
  });

  const mapped = mapGroupMeetFinalConfirmationEmail({
    sentAt: timestampLike("2026-04-10T04:11:00.000Z"),
    sentByEmail: "tre@fitwithpulse.ai",
    sendMode: "automatic",
    recipientCount: 4,
    previewSentAt: timestampLike("2026-04-10T03:58:00.000Z"),
    previewRecipientEmail: "tremaine.grant@gmail.com",
  });

  assert.deepEqual(mapped, {
    sentAt: "2026-04-10T04:11:00.000Z",
    sentByEmail: "tre@fitwithpulse.ai",
    sendMode: "automatic",
    recipientCount: 4,
    previewSentAt: "2026-04-10T03:58:00.000Z",
    previewRecipientEmail: "tremaine.grant@gmail.com",
  });
});

test("mapGroupMeetFinalConfirmationEmail returns null for missing data", () => {
  assert.equal(mapGroupMeetFinalConfirmationEmail(null), null);
  assert.equal(mapGroupMeetFinalConfirmationEmail(undefined), null);
});
