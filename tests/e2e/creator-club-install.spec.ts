import { expect, test, devices, type BrowserContext, type Page } from '@playwright/test';

const fixtureClubId = 'e2e-creator-club';
const fixtureQuery = 'e2eFixture=creator-club-install';
const fixturePath = `/club/${fixtureClubId}?${fixtureQuery}`;
const mobileFixturePath = `${fixturePath}&sharedBy=coach_123&eventId=event_456`;

async function blockRemoteImages(page: Page) {
  await page.route('https://images.unsplash.com/**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
}

test.describe('Creator club mobile install flow', () => {
  test('@smoke desktop keeps the public club landing on the canonical route', async ({ page }) => {
    await blockRemoteImages(page);

    await page.goto(fixturePath, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(new RegExp(`/club/${fixtureClubId}\\?${fixtureQuery}$`));
    await expect(page.getByRole('heading', { name: 'E2E Creator Club', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Club' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share Link' }).first()).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://fitwithpulse.ai/club/${fixtureClubId}`
    );
  });

  test('@smoke mobile redirects to the branded install page and preserves invite context', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 13'],
    });
    const page = await context.newPage();

    await blockRemoteImages(page);
    await page.goto(mobileFixturePath, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(
      new RegExp(
        `/club/${fixtureClubId}/install\\?e2eFixture=creator-club-install&sharedBy=coach_123&eventId=event_456$`
      )
    );
    await expect(page.getByRole('heading', { name: /Download the app to join this club the right way/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download on iPhone' })).toHaveAttribute(
      'href',
      /apps\.apple\.com/
    );
    await expect(page.getByRole('link', { name: 'Get it on Android' })).toHaveAttribute(
      'href',
      /play\.google\.com/
    );

    const openInPulseLink = page.getByRole('link', { name: 'Open event invite in Pulse' });
    await expect(openInPulseLink).toBeVisible();

    const href = await openInPulseLink.getAttribute('href');
    expect(href).toBeTruthy();

    const oneLinkUrl = new URL(href || '');
    expect(oneLinkUrl.hostname).toBe('fitwithpulse.onelink.me');
    expect(oneLinkUrl.searchParams.get('deep_link_value')).toBe('club');
    expect(oneLinkUrl.searchParams.get('clubId')).toBe(fixtureClubId);
    expect(oneLinkUrl.searchParams.get('sharedBy')).toBe('coach_123');
    expect(oneLinkUrl.searchParams.get('eventId')).toBe('event_456');
    expect(oneLinkUrl.searchParams.get('af_force_deeplink')).toBe('true');
    expect(oneLinkUrl.searchParams.get('af_r')).toBe(
      `https://fitwithpulse.ai/club/${fixtureClubId}/install?sharedBy=coach_123&eventId=event_456&web=1`
    );
    expect(oneLinkUrl.searchParams.get('af_dp')).toBe(
      `pulse://club?clubId=${fixtureClubId}&sharedBy=coach_123&eventId=event_456`
    );

    await context.close();
  });
});
