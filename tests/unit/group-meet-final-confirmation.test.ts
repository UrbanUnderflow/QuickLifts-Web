import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGroupMeetFinalConfirmationRecipientInvites,
  mapGroupMeetFinalConfirmationEmail,
} from "../../src/lib/groupMeetAdmin";

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

test("buildGroupMeetFinalConfirmationRecipientInvites includes the host when they have an email", () => {
  const recipients = buildGroupMeetFinalConfirmationRecipientInvites([
    {
      token: "host-token",
      name: "Tre",
      email: "tre@fitwithpulse.ai",
      imageUrl: null,
      participantType: "host",
      contactId: "contact-host",
      shareUrl: "https://fitwithpulse.ai/group-meet/host-token",
      emailStatus: "manual_only",
      emailedAt: null,
      emailError: null,
      respondedAt: "2026-04-01T12:00:00.000Z",
      availabilityCount: 1,
      availabilityEntries: [
        { date: "2026-04-14", startMinutes: 540, endMinutes: 600 },
      ],
    },
    {
      token: "guest-token",
      name: "Bobby",
      email: "bobby@fitwithpulse.ai",
      imageUrl: null,
      participantType: "participant",
      contactId: "contact-bobby",
      shareUrl: "https://fitwithpulse.ai/group-meet/guest-token",
      emailStatus: "sent",
      emailedAt: "2026-04-01T14:00:00.000Z",
      emailError: null,
      respondedAt: "2026-04-02T12:00:00.000Z",
      availabilityCount: 1,
      availabilityEntries: [
        { date: "2026-04-14", startMinutes: 540, endMinutes: 600 },
      ],
    },
    {
      token: "no-email-token",
      name: "No Email",
      email: null,
      imageUrl: null,
      participantType: "participant",
      contactId: "contact-no-email",
      shareUrl: "https://fitwithpulse.ai/group-meet/no-email-token",
      emailStatus: "not_sent",
      emailedAt: null,
      emailError: null,
      respondedAt: null,
      availabilityCount: 0,
      availabilityEntries: [],
    },
  ]);

  assert.deepEqual(
    recipients.map((invite) => invite.email),
    ["tre@fitwithpulse.ai", "bobby@fitwithpulse.ai"],
  );
});
