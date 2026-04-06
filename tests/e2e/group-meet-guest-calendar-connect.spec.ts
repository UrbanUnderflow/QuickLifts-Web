import { test, expect } from '@playwright/test';

test('guest Group Meet page surfaces Google Calendar connect failure details', async ({ page }) => {
  const inviteToken = 'e2e-guest-token';
  const consoleEvents: Array<{ text: string; values: any[] }> = [];

  page.on('console', async (message) => {
    if (message.type() !== 'error') return;

    const values = [];
    for (const arg of message.args()) {
      try {
        values.push(await arg.jsonValue());
      } catch {
        values.push(arg.toString());
      }
    }

    consoleEvents.push({
      text: message.text(),
      values,
    });
  });

  await page.route(`**/api/group-meet/${inviteToken}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        invite: {
          token: inviteToken,
          name: 'Bobby Weke',
          email: 'bobby@fitwithpulse.ai',
          imageUrl: 'https://images.example.com/bobby.png',
          participantType: 'participant',
          shareUrl: `https://fitwithpulse.ai/group-meet/${inviteToken}`,
          responseSubmittedAt: null,
          availabilityEntries: [],
          peerAvailability: [],
          calendarImport: null,
          deadlinePassed: false,
          request: {
            id: 'request-e2e',
            title: 'Pulse Intelligence Labs Advisory Board Meeting',
            targetMonth: '2026-04',
            deadlineAt: '2026-04-08T21:00:00.000Z',
            timezone: 'America/New_York',
            meetingDurationMinutes: 60,
            status: 'collecting',
          },
        },
      }),
    });
  });

  await page.route(`**/api/group-meet/${inviteToken}/calendar/google/connect/start`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Google Calendar connect is not available right now. You can still add your availability manually.',
        debugCode: 'secret_manager_permission_denied',
        debugHint: 'Grant the production runtime service account Secret Manager Secret Accessor on the guest Google OAuth secret.',
        debugId: 'playwright-debug-id',
      }),
    });
  });

  await page.goto(`/group-meet/${inviteToken}`);

  await expect(page.getByRole('heading', { name: 'Pulse Intelligence Labs Advisory Board Meeting' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Google Calendar' })).toBeVisible();

  await page.getByRole('button', { name: 'Connect Google Calendar' }).click();

  await expect(
    page.getByText('Google Calendar connect is not available right now. You can still add your availability manually.')
  ).toBeVisible();

  await expect
    .poll(() => {
      const event = consoleEvents.find((entry) => entry.text.includes('[GroupMeetInvitePage] Google Calendar connect failed'));
      if (!event) return null;
      const payload = event.values[1];
      return payload
        ? JSON.stringify({
            status: payload.status,
            debugCode: payload.payload?.debugCode,
            debugHint: payload.payload?.debugHint,
            debugId: payload.payload?.debugId,
          })
        : null;
    })
    .toBe(
      JSON.stringify({
        status: 500,
        debugCode: 'secret_manager_permission_denied',
        debugHint: 'Grant the production runtime service account Secret Manager Secret Accessor on the guest Google OAuth secret.',
        debugId: 'playwright-debug-id',
      })
    );
});
