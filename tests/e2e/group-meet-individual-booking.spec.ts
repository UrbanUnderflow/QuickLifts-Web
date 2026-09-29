import { expect, test, Page } from '@playwright/test';

// This suite mocks every booking request and blocks external network access.
// It never writes calendar events, sends invitations, or accesses a database.
test.use({ storageState: { cookies: [], origins: [] } });
const profile = { name: 'Tremaine', slug: 'tremaine-test', description: 'A conversation about your next steps.', durations: [15, 30, 60], timezone: 'America/New_York' };
const slots = [{ start: '2099-10-01T15:00:00.000Z', end: '2099-10-01T15:30:00.000Z' }, { start: '2099-10-02T17:00:00.000Z', end: '2099-10-02T17:30:00.000Z' }];
const initialBooking = { ...slots[0], name: 'Test Guest', email: 'confirmed@example.test', status: 'confirmed', managementToken: 'mock-management-token', meetLink: 'https://meet.google.com/mock-test-room' };

async function isolate(page: Page) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: { error: 'Unmocked API blocked by test.' } });
    return route.continue();
  });
}
async function chooseAndFill(page: Page) {
  await page.getByRole('group', { name: 'Choose a time' }).getByRole('button').first().click();
  await page.getByLabel('Your name').fill('Test Guest');
  await page.getByLabel('Email for your invitation').fill('test@example.test');
}
for (const width of [320, 1280]) {
  test(`individual booking and management render and flow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await isolate(page);
    let booking = { ...initialBooking };
    await page.route('**/api/group-meet/book/tremaine-test*', async route => route.fulfill({ json: route.request().method() === 'POST' ? { booking } : { profile, slots } }));
    await page.route('**/api/group-meet/booking/mock-management-token*', async route => {
      if (new URL(route.request().url()).searchParams.has('slots')) return route.fulfill({ json: { slots } });
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        booking = body.action === 'cancel' ? { ...booking, status: 'cancelled' } : { ...booking, start: body.start, end: new Date(Date.parse(body.start) + body.duration * 60000).toISOString() };
      }
      return route.fulfill({ json: { profile, booking } });
    });
    await page.goto('/group-meet/book/tremaine-test');
    await expect(page.getByRole('heading', { name: 'Book time with Tremaine' })).toBeVisible();
    await chooseAndFill(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`booking-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Confirm meeting', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your meeting is booked' })).toBeVisible();
    await expect(page.getByText('Invitation email: confirmed@example.test')).toBeVisible();
    await expect(page.getByText('Guest: Test Guest', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add to Google Calendar' })).toHaveAttribute('href', /calendar.google.com/);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download calendar file (.ics)' }).click();
    expect((await downloadPromise).suggestedFilename()).toBe('group-meet.ics');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`confirmation-${width}.png`), fullPage: true });
    await page.getByRole('link', { name: 'Manage this meeting' }).click();
    await expect(page.getByRole('heading', { name: 'Meeting with Tremaine' })).toBeVisible();
    await page.getByRole('button', { name: 'Reschedule', exact: true }).click();
    await page.getByLabel(/Available times in/).selectOption(slots[1].start);
    await page.getByRole('button', { name: 'Confirm new time' }).click();
    await expect(page.getByRole('status')).toContainText('rescheduled');
    await expect(page.getByRole('button', { name: 'Cancel meeting', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`management-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Cancel meeting', exact: true }).click();
    await page.getByRole('button', { name: 'Keep meeting', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reschedule', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel meeting', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, cancel meeting' }).click();
    await expect(page.getByRole('link', { name: 'Book another meeting' })).toBeVisible();
  });
}

test('uncertain booking survives reload and retries the exact original request', async ({ page }) => {
  await isolate(page);
  const requests: unknown[] = [];
  await page.route('**/api/group-meet/book/tremaine-test*', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: { profile, slots } });
    requests.push(route.request().postDataJSON());
    return requests.length === 1
      ? route.fulfill({ status: 503, json: { error: 'Booking update still being confirmed. Please retry.' } })
      : route.fulfill({ json: { booking: initialBooking } });
  });
  await page.goto('/group-meet/book/tremaine-test');
  await chooseAndFill(page);
  await page.getByRole('button', { name: 'Confirm meeting', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('still being confirmed');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Confirm meeting', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry booking confirmation' }).click();
  await expect(page.getByRole('heading', { name: 'Your meeting is booked' })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(await page.evaluate(() => sessionStorage.getItem('group-meet-booking:tremaine-test'))).toBeNull();
});

test('definitive slot conflict allows another selection with a fresh request id', async ({ page }) => {
  await isolate(page);
  const requests: Array<{ requestId: string }> = [];
  await page.route('**/api/group-meet/book/tremaine-test*', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: { profile, slots } });
    requests.push(route.request().postDataJSON());
    return requests.length === 1 ? route.fulfill({ status: 409, json: { error: 'This time is no longer available.' } }) : route.fulfill({ json: { booking: initialBooking } });
  });
  await page.goto('/group-meet/book/tremaine-test');
  await chooseAndFill(page);
  await page.getByRole('button', { name: 'Confirm meeting', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('no longer available');
  await expect(page.getByRole('button', { name: 'Confirm meeting', exact: true })).toBeEnabled();
  await page.getByLabel('Choose a day').selectOption({ index: 1 });
  await page.getByRole('group', { name: 'Choose a time' }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'Confirm meeting', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your meeting is booked' })).toBeVisible();
  expect(requests[0].requestId).not.toBe(requests[1].requestId);
});

test('management recovers persisted pending action even after meeting start', async ({ page }) => {
  await isolate(page);
  let pending = true;
  const actions: unknown[] = [];
  await page.route('**/api/group-meet/booking/mock-management-token*', async route => {
    if (route.request().method() === 'POST') { actions.push(route.request().postDataJSON()); pending = false; }
    await route.fulfill({ json: { profile, booking: { ...initialBooking, start: '2020-01-01T15:00:00.000Z', end: '2020-01-01T15:30:00.000Z', status: pending ? 'confirmed' : 'cancelled', pendingAction: pending ? { action: 'cancel' } : null } } });
  });
  await page.goto('/group-meet/booking/mock-management-token');
  await expect(page.getByRole('button', { name: 'Retry meeting update' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reschedule', exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Retry meeting update' }).click();
  await expect(page.getByRole('link', { name: 'Book another meeting' })).toBeVisible();
  expect(actions).toEqual([{ action: 'retry' }]);
});
