const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createApiResponseRecorder,
  createRequestDetailHandlerRuntime,
  loadGroupMeetRuntime,
  makeTimestamp,
} = require("./_runtimeHarness.cjs");

test("PATCH on Group Meet detail clears derived scheduling state when timing rules change", async () => {
  const { handler, state } = createRequestDetailHandlerRuntime({
    requestData: {
      title: "April team sync",
      targetMonth: "2026-04",
      deadlineAt: makeTimestamp("2026-03-25T17:00:00.000Z"),
      timezone: "America/New_York",
      meetingDurationMinutes: 30,
      createdByEmail: "tre@fitwithpulse.ai",
      createdAt: makeTimestamp("2026-03-19T14:00:00.000Z"),
      participantCount: 2,
      responseCount: 2,
      aiRecommendation: {
        generatedAt: "2026-03-19T15:00:00.000Z",
        model: "gpt-5.4",
        summary: "Tuesday morning works best.",
        caveats: [],
        recommendations: [],
      },
      finalSelection: {
        candidateKey: "2026-04-10|600",
        date: "2026-04-10",
        startMinutes: 600,
        endMinutes: 630,
        participantCount: 2,
        totalParticipants: 2,
        participantNames: ["Avery", "Blake"],
        missingParticipantNames: [],
        selectedAt: "2026-03-19T15:10:00.000Z",
        selectedByEmail: "tre@fitwithpulse.ai",
        hostNote: "Looks clean.",
      },
      calendarInvite: {
        status: "scheduled",
        eventId: "evt_123",
        htmlLink: "https://calendar.google.com/event?eid=evt_123",
        meetLink: "https://meet.google.com/abc-defg-hij",
        calendarId: "primary",
        createdAt: "2026-03-19T15:12:00.000Z",
        updatedAt: "2026-03-19T15:12:00.000Z",
        attendeeEmails: ["avery@example.com", "blake@example.com"],
        skippedParticipantNames: [],
        organizerEmail: "tre@fitwithpulse.ai",
      },
      finalReminderEmail: {
        sentAt: makeTimestamp("2026-03-19T16:00:00.000Z"),
        sentByEmail: "tre@fitwithpulse.ai",
        sendMode: "automatic",
        recipientCount: 2,
        selectionSignature: "2026-04-10|600|630",
      },
    },
    inviteDocs: [
      {
        id: "token-a",
        data: {
          name: "Avery",
          email: "avery@example.com",
          shareUrl: "https://example.com/a",
          emailStatus: "sent",
          emailError: null,
          responseSubmittedAt: makeTimestamp("2026-03-20T10:00:00.000Z"),
          availabilityEntries: [
            { date: "2026-04-10", startMinutes: 540, endMinutes: 720 },
          ],
        },
      },
      {
        id: "token-b",
        data: {
          name: "Blake",
          email: "blake@example.com",
          shareUrl: "https://example.com/b",
          emailStatus: "sent",
          emailError: null,
          responseSubmittedAt: makeTimestamp("2026-03-20T10:05:00.000Z"),
          availabilityEntries: [
            { date: "2026-04-10", startMinutes: 600, endMinutes: 780 },
          ],
        },
      },
    ],
    setupStatus: {
      ready: true,
      source: "secret_manager",
      message: "Ready from Secret Manager.",
      secretName: "GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON",
      delegatedUserEmail: "tre@fitwithpulse.ai",
      organizerEmail: "tre@fitwithpulse.ai",
      calendarId: "primary",
    },
  });

  const req = {
    method: "PATCH",
    query: { requestId: "request-1" },
    body: {
      title: "April team sync",
      deadlineAt: "2026-03-26T17:00:00.000Z",
      timezone: "America/Chicago",
      meetingDurationMinutes: 60,
    },
  };
  const res = createApiResponseRecorder();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.resetDerivedSelections, true);
  assert.equal(res.payload.request.meetingDurationMinutes, 60);
  assert.equal(res.payload.request.timezone, "America/Chicago");
  assert.equal(res.payload.request.aiRecommendation, null);
  assert.equal(res.payload.request.finalSelection, null);
  assert.equal(res.payload.request.calendarInvite, null);
  assert.equal(res.payload.request.finalReminderEmail, null);
  assert.equal(res.payload.request.calendarSetup.ready, true);

  assert.equal(state.requestData.meetingDurationMinutes, 60);
  assert.equal(state.requestData.timezone, "America/Chicago");
  assert.equal(state.requestData.aiRecommendation, null);
  assert.equal(state.requestData.finalSelection, null);
  assert.equal(state.requestData.calendarInvite, null);
  assert.equal(state.requestData.finalReminderEmail, null);
});

test("resolveGroupMeetStatusFromInvites treats a sent invite as an active request even if raw status is draft", async () => {
  const { resolveGroupMeetStatusFromInvites } = loadGroupMeetRuntime();

  assert.equal(
    resolveGroupMeetStatusFromInvites("2030-04-08T21:00:00.000Z", "draft", [
      { emailStatus: "sent", emailedAt: null },
      { emailStatus: "manual_only", emailedAt: null },
    ]),
    "collecting",
  );
});

test("hasGroupMeetInviteBeenSent treats emailedAt as sent even when emailStatus has not been updated yet", async () => {
  const { hasGroupMeetInviteBeenSent, resolveGroupMeetStatusFromInvites } =
    loadGroupMeetRuntime();

  assert.equal(
    hasGroupMeetInviteBeenSent({
      emailStatus: "not_sent",
      emailedAt: "2026-04-04T13:00:00.000Z",
    }),
    true,
  );

  assert.equal(
    resolveGroupMeetStatusFromInvites("2030-04-08T21:00:00.000Z", "draft", [
      { emailStatus: "not_sent", emailedAt: "2026-04-04T13:00:00.000Z" },
      { emailStatus: "manual_only", emailedAt: null },
    ]),
    "collecting",
  );
});
