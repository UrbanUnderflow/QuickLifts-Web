const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createApiResponseRecorder,
  createRemoveInviteHandlerRuntime,
  makeTimestamp,
} = require("./_runtimeHarness.cjs");

test("DELETE on Group Meet invite removes the guest and updates the scheduled calendar invite attendee list", async () => {
  const { handler, state } = createRemoveInviteHandlerRuntime({
    requestData: {
      title: "Pulse Intelligence Labs Advisory Board Meeting",
      targetMonth: "2026-04",
      deadlineAt: makeTimestamp("2026-04-08T21:00:00.000Z"),
      timezone: "America/New_York",
      meetingDurationMinutes: 60,
      status: "collecting",
      participantCount: 3,
      responseCount: 2,
      finalSelection: {
        candidateKey: "2026-04-14|540",
        date: "2026-04-14",
        startMinutes: 540,
        endMinutes: 600,
        participantCount: 3,
        totalParticipants: 3,
        participantNames: ["Tre", "Bobby", "Valerie"],
        missingParticipantNames: [],
        selectedAt: "2026-04-09T22:21:00.000Z",
        selectedByEmail: "tre@fitwithpulse.ai",
        hostNote: "",
      },
      calendarInvite: {
        status: "scheduled",
        eventId: "evt_live",
        htmlLink: "https://calendar.google.com/event?eid=evt_live",
        meetLink: "https://meet.google.com/live-link",
        calendarId: "primary",
        createdAt: "2026-04-09T22:22:00.000Z",
        updatedAt: "2026-04-09T22:22:00.000Z",
        attendeeEmails: [
          "tre@fitwithpulse.ai",
          "bobby@fitwithpulse.ai",
          "valerie@speakhappiness.com",
        ],
        skippedParticipantNames: [],
        organizerEmail: "tre@fitwithpulse.ai",
      },
      finalConfirmationEmail: {
        sentAt: "2026-04-09T22:23:00.000Z",
      },
      finalReminderEmail: {
        sentAt: "2026-04-14T12:00:00.000Z",
      },
    },
    inviteDocs: [
      {
        id: "host-token",
        data: {
          name: "Tre",
          email: "tre@fitwithpulse.ai",
          participantType: "host",
          availabilityEntries: [
            { date: "2026-04-14", startMinutes: 540, endMinutes: 600 },
          ],
          responseSubmittedAt: makeTimestamp("2026-04-01T15:00:00.000Z"),
        },
      },
      {
        id: "bobby-token",
        data: {
          name: "Bobby",
          email: "bobby@fitwithpulse.ai",
          participantType: "participant",
          availabilityEntries: [
            { date: "2026-04-14", startMinutes: 540, endMinutes: 600 },
          ],
          responseSubmittedAt: makeTimestamp("2026-04-02T15:00:00.000Z"),
        },
      },
      {
        id: "valerie-token",
        data: {
          name: "Valerie",
          email: "valerie@speakhappiness.com",
          participantType: "participant",
          availabilityEntries: [],
          responseSubmittedAt: null,
        },
      },
    ],
  });

  const req = {
    method: "DELETE",
    query: {
      requestId: "request-1",
      token: "valerie-token",
    },
  };
  const res = createApiResponseRecorder();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.removedInviteName, "Valerie");
  assert.equal(res.payload.participantCount, 2);
  assert.equal(res.payload.responseCount, 2);
  assert.equal(res.payload.calendarInviteUpdated, true);

  assert.deepEqual(state.deletedInviteIds, ["valerie-token"]);
  assert.equal(state.scheduledCalendarInviteCalls.length, 1);
  assert.deepEqual(
    state.scheduledCalendarInviteCalls[0].invites.map((invite) => invite.email),
    ["tre@fitwithpulse.ai", "bobby@fitwithpulse.ai"],
  );
  assert.deepEqual(state.requestData.calendarInvite.attendeeEmails, [
    "tre@fitwithpulse.ai",
    "bobby@fitwithpulse.ai",
  ]);
  assert.equal(state.requestData.finalConfirmationEmail, null);
  assert.equal(state.requestData.finalReminderEmail, null);
});

test("DELETE on Group Meet invite rejects attempts to remove the host", async () => {
  const { handler, state } = createRemoveInviteHandlerRuntime({
    requestData: {
      title: "Pulse Intelligence Labs Advisory Board Meeting",
      targetMonth: "2026-04",
      deadlineAt: makeTimestamp("2026-04-08T21:00:00.000Z"),
      timezone: "America/New_York",
      meetingDurationMinutes: 60,
      status: "draft",
    },
    inviteDocs: [
      {
        id: "host-token",
        data: {
          name: "Tre",
          email: "tre@fitwithpulse.ai",
          participantType: "host",
          availabilityEntries: [
            { date: "2026-04-14", startMinutes: 540, endMinutes: 600 },
          ],
          responseSubmittedAt: makeTimestamp("2026-04-01T15:00:00.000Z"),
        },
      },
    ],
  });

  const req = {
    method: "DELETE",
    query: {
      requestId: "request-1",
      token: "host-token",
    },
  };
  const res = createApiResponseRecorder();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /host cannot be removed/i);
  assert.deepEqual(state.deletedInviteIds, []);
  assert.equal(state.scheduledCalendarInviteCalls.length, 0);
});
