import { expect, test, devices, type Page } from '@playwright/test';

const fixtureClubId = 'e2e-creator-club';
const fixtureQuery = 'e2eFixture=creator-club-install';
const fixturePath = `/club/${fixtureClubId}?${fixtureQuery}`;
const mobileFixturePath = `${fixturePath}&sharedBy=coach_123&eventId=event_456`;

async function blockRemoteImages(page: Page) {
  await page.route('https://images.unsplash.com/**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route('https://firebasestorage.googleapis.com/**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
}

test.describe('Creator club mobile install flow', () => {
  test('@smoke desktop keeps the public club landing on the canonical route', async ({ page }) => {
    await blockRemoteImages(page);

    await page.goto(fixturePath, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(new RegExp(`/club/${fixtureClubId}\\?${fixtureQuery}$`));
    await expect(page.getByRole('heading', { name: 'Fitness With Benefits(FWB)', exact: true })).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'Fitness With Benefits(FWB)', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Get in in 60 seconds/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download on iOS' })).toHaveAttribute(
      'href',
      /apps\.apple\.com/
    );
    await expect(page.getByRole('link', { name: 'Download on Android' })).toHaveAttribute(
      'href',
      /play\.google\.com/
    );

    const openInPulseButton = page.getByRole('button', { name: /Join this club in Pulse/i }).first();
    await expect(openInPulseButton).toBeVisible();

    const href = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
        candidate.textContent?.includes('Join this club in Pulse')
      );

      if (!button) {
        return null;
      }

      return button.getAttribute('data-invite-deep-link') || null;
    });
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
