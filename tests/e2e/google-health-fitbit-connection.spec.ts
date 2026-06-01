import { expect, test, type Browser, type Page } from '@playwright/test';
import { existsSync } from 'fs';
import path from 'path';

const appBaseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const defaultStorageStatePath = path.resolve(process.cwd(), '.playwright/admin-storage-state.json');
const hasAuthState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE) || existsSync(defaultStorageStatePath);

async function installGoogleHealthFunctionMocks(page: Page) {
  const connectedStatus = {
    connected: true,
    status: 'connected',
    provider: 'google_health',
    sourceFamily: 'fitbit',
    grantedScopes: [
      'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
      'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
      'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
      'https://www.googleapis.com/auth/googlehealth.profile.readonly',
    ],
    connectedAt: Date.parse('2026-05-30T12:00:00Z'),
    healthUserId: 'health-user-playwright',
    legacyUserId: 'fitbit-user-playwright',
    lastSuccessfulSyncAt: Date.parse('2026-05-31T09:15:00Z'),
    lastSuccessfulSnapshotDateKey: '2026-05-31',
    lastImportedDomains: ['recovery', 'activity', 'biometrics', 'training'],
    lastError: '',
  };

  const routePatterns = [
    '**/api/pulsecheck/functions/google-health-status',
    '**/.netlify/functions/google-health-status',
  ];
  for (const pattern of routePatterns) {
    await page.route(pattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(connectedStatus),
      });
    });
  }

  for (const pattern of ['**/api/pulsecheck/functions/google-health-sync', '**/.netlify/functions/google-health-sync']) {
    await page.route(pattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          status: 'synced',
          snapshotId: 'athlete_daily_2026-05-31',
          snapshotDateKey: '2026-05-31',
          importedDomains: ['recovery', 'activity', 'biometrics', 'training'],
          detail: 'PulseCheck imported the latest Fitbit health context.',
        }),
      });
    });
  }

  for (const pattern of ['**/api/pulsecheck/functions/google-health-disconnect', '**/.netlify/functions/google-health-disconnect']) {
    await page.route(pattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          disconnected: true,
          connection: {
            connected: false,
            status: 'disconnected',
            provider: 'google_health',
            sourceFamily: 'fitbit',
            lastImportedDomains: [],
          },
        }),
      });
    });
  }

  for (const pattern of ['**/api/pulsecheck/functions/google-health-auth-start', '**/.netlify/functions/google-health-auth-start']) {
    await page.route(pattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authorizeUrl: `${appBaseURL}/PulseCheck/fitbit?status=connected`,
          state: 'playwright-state',
          requestedScopes: connectedStatus.grantedScopes,
          redirectUri: `${appBaseURL}/.netlify/functions/google-health-callback`,
          existingStatus: 'disconnected',
        }),
      });
    });
  }
}

async function newUnauthenticatedContext(browser: Browser) {
  return browser.newContext({
    baseURL: appBaseURL,
    storageState: { cookies: [], origins: [] },
  });
}

test.describe('Fitbit / Google Health connection pages', () => {
  test('PulseCheck and Fit With Pulse routes render the signed-out connection state', async ({ browser }) => {
    const context = await newUnauthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto('/PulseCheck/fitbit', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Connect Fitbit through Google Health' })).toBeVisible();
    await expect(page.getByText('Fitbit Air ready')).toBeVisible();
    await expect(page.getByText('Sign in to connect Fitbit')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/PulseCheck/login');

    await page.goto('/fitbit', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Connect Fitbit through Google Health' })).toBeVisible();
    await expect(page.getByText('Fit With Pulse can use Fitbit sleep, heart-rate, activity, and workout summaries')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to settings' })).toHaveAttribute('href', '/settings');

    await context.close();
  });

  test('PulseCheck route shows connected status, syncs now, and disconnects', async ({ page }) => {
    test.skip(!hasAuthState, 'Requires Playwright auth state so Firebase exposes an authenticated user.');

    await installGoogleHealthFunctionMocks(page);
    await page.goto('/PulseCheck/fitbit', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Fitbit is active')).toBeVisible();
    await expect(page.getByText('health-user-playwright')).toBeVisible();
    await expect(page.getByText('recovery, activity, biometrics, training')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reconnect Fitbit' })).toBeVisible();

    await page.getByRole('button', { name: 'Sync now' }).click();
    await expect(page.getByText('PulseCheck imported the latest Fitbit health context.')).toBeVisible();

    await page.getByRole('button', { name: 'Disconnect' }).click();
    await expect(page.getByText('Fitbit has been disconnected from Pulse.')).toBeVisible();
    await expect(page.getByText('Ready when you are')).toBeVisible();

    await page.getByRole('button', { name: 'Connect Fitbit' }).click();
    await expect(page.getByText('Your Fitbit data is now connected through Google Health.')).toBeVisible();
  });
});
