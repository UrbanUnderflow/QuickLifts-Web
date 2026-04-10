import test from "node:test";
import assert from "node:assert/strict";

import { mapGroupMeetFinalReminderEmail } from "../../src/lib/groupMeetAdmin";
import { getGroupMeetFinalReminderDispatchDecision } from "../../src/lib/groupMeetReminder";

test("mapGroupMeetFinalReminderEmail normalizes stored metadata", () => {
  const timestampLike = (iso: string) => ({
    toDate() {
      return new Date(iso);
    },
  });

  const mapped = mapGroupMeetFinalReminderEmail({
    sentAt: timestampLike("2026-04-14T12:15:00.000Z"),
    sentByEmail: "tre@fitwithpulse.ai",
    sendMode: "automatic",
    recipientCount: 4,
    selectionSignature: "2026-04-14|540|600",
  });

  assert.deepEqual(mapped, {
    sentAt: "2026-04-14T12:15:00.000Z",
    sentByEmail: "tre@fitwithpulse.ai",
    sendMode: "automatic",
    recipientCount: 4,
    selectionSignature: "2026-04-14|540|600",
  });
});

test("mapGroupMeetFinalReminderEmail returns null for missing data", () => {
  assert.equal(mapGroupMeetFinalReminderEmail(null), null);
  assert.equal(mapGroupMeetFinalReminderEmail(undefined), null);
});

test("getGroupMeetFinalReminderDispatchDecision is due inside the final hour", () => {
  const decision = getGroupMeetFinalReminderDispatchDecision({
    now: "2026-04-14T12:20:00.000Z",
    finalSelection: {
      candidateKey: "2026-04-14|540",
      date: "2026-04-14",
      startMinutes: 540,
      endMinutes: 600,
      participantCount: 4,
      totalParticipants: 5,
      participantNames: ["A", "B", "C", "D"],
      missingParticipantNames: ["E"],
      selectedAt: "2026-04-10T12:00:00.000Z",
      selectedByEmail: "tre@fitwithpulse.ai",
      hostNote: null,
    },
    timezone: "America/New_York",
  });

  assert.equal(decision.due, true);
  assert.equal(decision.reason, "within-window");
  assert.equal(decision.selectionSignature, "2026-04-14|540|600");
  assert.equal(decision.startsAtIso, "2026-04-14T13:00:00.000Z");
  assert.equal(decision.minutesUntilStart, 40);
});

test("getGroupMeetFinalReminderDispatchDecision skips when already sent for the same final block", () => {
  const decision = getGroupMeetFinalReminderDispatchDecision({
    now: "2026-04-14T12:20:00.000Z",
    finalSelection: {
      candidateKey: "2026-04-14|540",
      date: "2026-04-14",
      startMinutes: 540,
      endMinutes: 600,
      participantCount: 4,
      totalParticipants: 5,
      participantNames: ["A", "B", "C", "D"],
      missingParticipantNames: ["E"],
      selectedAt: "2026-04-10T12:00:00.000Z",
      selectedByEmail: "tre@fitwithpulse.ai",
      hostNote: null,
    },
    timezone: "America/New_York",
    sentSelectionSignature: "2026-04-14|540|600",
  });

  assert.equal(decision.due, false);
  assert.equal(decision.reason, "already-sent");
});
