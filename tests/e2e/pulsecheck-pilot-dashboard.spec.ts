import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'fs';
import path from 'path';

const defaultStorageStatePath = path.resolve(process.cwd(), '.playwright/admin-storage-state.json');
const hasAuthState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE) || existsSync(defaultStorageStatePath);
const remoteLoginToken = process.env.PLAYWRIGHT_REMOTE_LOGIN_TOKEN;
const allowWriteTests = process.env.PLAYWRIGHT_ALLOW_WRITE_TESTS === 'true';
const pulseCheckNamespaceBase = process.env.PLAYWRIGHT_E2E_NAMESPACE || 'e2e-pulsecheck';
const pulseCheckNamespace = `${pulseCheckNamespaceBase}-pilot-dashboard`;
const appBaseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const appOrigin = new URL(appBaseURL).origin;

interface AuthIdentity {
  uid: string;
  email: string;
}

interface PilotDashboardFixture {
  namespace: string;
  organizationId: string;
  teamId: string;
  pilotId: string;
  pilotName: string;
  cohortIds: string[];
  athleteIds: string[];
  athleteNames: string[];
  athleteEmails: string[];
  readoutIds: string[];
}

async function waitForStableAppFrame(page: Page) {
  const transientRefreshText = page.getByText(/missing required error components, refreshing/i);

  if (await transientRefreshText.isVisible().catch(() => false)) {
    await transientRefreshText.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => null);
    await page.waitForLoadState('domcontentloaded').catch(() => null);
  }
}

async function waitForPulseE2EHarness(page: Page) {
  await page.waitForFunction(() => Boolean(window.__pulseE2E), undefined, { timeout: 20_000 });
}

async function getAuthenticatedAdminIdentity(page: Page): Promise<AuthIdentity | null> {
  return page.evaluate(() => {
    const authStorageKey = Object.keys(window.localStorage).find((key) => key.startsWith('firebase:authUser:'));
    if (!authStorageKey) return null;

    const rawValue = window.localStorage.getItem(authStorageKey);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue);
    return {
      uid: parsed?.uid || '',
      email: parsed?.email || '',
    };
  });
}

async function ensureAdminSession(page: Page, nextPath: string) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: appOrigin });
  await page.addInitScript(() => {
    window.localStorage.setItem('forceDevFirebase', 'true');
    window.localStorage.setItem('pulse_has_seen_marketing', 'true');
  });

  if (remoteLoginToken) {
    await page.goto(`/remote-login?token=${encodeURIComponent(remoteLoginToken)}&next=${encodeURIComponent(nextPath)}`);
    return;
  }

  await page.goto(nextPath, { waitUntil: 'domcontentloaded' });
  await waitForStableAppFrame(page);
  await page.waitForTimeout(1500);

  const adminIdentity = await getAuthenticatedAdminIdentity(page).catch(() => null);
  if (adminIdentity?.email) {
    await waitForPulseE2EHarness(page).catch(() => null);
    await page
      .evaluate(async ({ email }) => {
        await window.__pulseE2E?.ensureAdminRecord?.(email);
      }, { email: adminIdentity.email })
      .catch(() => null);
    await page.goto(nextPath, { waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);
    await page.waitForTimeout(1500);
  }

  const useWebAppButton = page.getByRole('button', { name: /Use Web App/i });
  if (await useWebAppButton.isVisible().catch(() => false)) {
    await useWebAppButton.click().catch(() => {});
    await page.waitForTimeout(1500);
    await page.goto(nextPath, { waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);
  }
}

async function seedPilotDashboardFixture(page: Page): Promise<{ fixture: PilotDashboardFixture; adminIdentity: AuthIdentity }> {
  await ensureAdminSession(page, '/admin/pulsecheckPilotDashboard');
  await waitForPulseE2EHarness(page);

  const adminIdentity = await getAuthenticatedAdminIdentity(page);
  if (!adminIdentity?.uid || !adminIdentity?.email) {
    throw new Error('An authenticated admin identity is required for the pilot dashboard E2E fixture.');
  }

  await page.evaluate(
    async ({ namespace, adminUserId }) => {
      await window.__pulseE2E?.cleanupPulseCheckPilotDashboardFixture({
        namespace,
        adminUserId,
      });
    },
    {
      namespace: pulseCheckNamespace,
      adminUserId: adminIdentity.uid,
    }
  );

  const fixture = await page.evaluate(
    async ({ namespace, adminUserId, adminEmail }) => {
      return window.__pulseE2E?.seedPulseCheckPilotDashboardFixture({
        namespace,
        adminUserId,
        adminEmail,
      });
    },
    {
      namespace: pulseCheckNamespace,
      adminUserId: adminIdentity.uid,
      adminEmail: adminIdentity.email,
    }
  );

  if (!fixture?.pilotId || !fixture?.pilotName) {
    throw new Error('Failed to seed the pilot dashboard fixture.');
  }

  return {
    fixture,
    adminIdentity,
  };
}

async function cleanupPilotDashboardFixture(page: Page, adminIdentity: AuthIdentity) {
  await waitForPulseE2EHarness(page);
  await page.evaluate(
    async ({ namespace, adminUserId }) => {
      await window.__pulseE2E?.cleanupPulseCheckPilotDashboardFixture({
        namespace,
        adminUserId,
      });
    },
    {
      namespace: pulseCheckNamespace,
      adminUserId: adminIdentity.uid,
    }
  );
}

test.describe.serial('PulseCheck pilot dashboard', () => {
  test.skip(!hasAuthState && !remoteLoginToken, 'Requires Playwright admin auth state or PLAYWRIGHT_REMOTE_LOGIN_TOKEN.');

  test('@smoke switches into dashboard demo mode', async ({ page }) => {
    await ensureAdminSession(page, '/admin/pulsecheckPilotDashboard');

    await page.goto('/admin/pulsecheckPilotDashboard', { waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);

    await page.getByTestId('pilot-dashboard-demo-toggle').click();

    await expect(page.getByTestId('pilot-dashboard-demo-banner')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Correlation Engine Spring Pilot Demo' })).toBeVisible();
    await page.getByTestId('pilot-dashboard-metric-help-stable-rate').click();
    await expect(page.getByTestId('pilot-dashboard-metric-help-stable-rate-modal')).toBeVisible();
    await expect(page.getByText('Stable rate is the share of active pilot athletes with at least one stable pattern', { exact: false })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pilot-dashboard-metric-help-stable-rate-modal')).toBeHidden();

    await page.getByRole('link', { name: 'Correlation Engine Spring Pilot Demo' }).click();
    await expect(page.getByTestId('pilot-dashboard-detail-demo-banner')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Correlation Engine Spring Pilot Demo' })).toBeVisible();
    await expect(page.getByTestId('pilot-dashboard-tab-research-readout')).toBeVisible();
    await page.getByTestId('pilot-dashboard-tab-hypotheses').click();
    await page.getByTestId('pilot-hypothesis-assist-generate').click();
    await expect(page.locator('[data-testid^="pilot-hypothesis-assist-suggestion-"]').first()).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('pilot-dashboard-detail-demo-toggle').click();
    await expect(page).toHaveURL(/\/admin\/pulsecheckPilotDashboard$/);
  });

  test('@smoke shows the active pilot directory and research brief in pilot scope', async ({ page }) => {
    const { fixture, adminIdentity } = await seedPilotDashboardFixture(page);

    try {
      await page.goto('/admin/pulsecheckPilotDashboard', { waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);

      await expect(page.getByRole('heading', { name: 'Active Pilot Dashboard' })).toBeVisible();
      await expect(page.getByRole('link', { name: fixture.pilotName })).toBeVisible();

      await page.getByRole('link', { name: fixture.pilotName }).click();

      await expect(page.getByRole('heading', { name: fixture.pilotName })).toBeVisible();
      await expect(page.getByText(/Athletes outside this pilot are excluded/i)).toBeVisible();
      await expect(page.getByTestId('pilot-invite-diagnostics')).toBeVisible();
      await expect(page.getByTestId('pilot-invite-diagnostics')).toContainText('Fallback redirect');
      const copyButtons = page.locator('[data-testid^="pilot-invite-copy-"]');
      await copyButtons.first().click();
      await expect(copyButtons.first()).toContainText('Copied to Clipboard');

      await page.getByTestId('pilot-dashboard-tab-research-readout').click();

      await expect(page.getByRole('heading', { name: 'Research Brief' })).toBeVisible();
      await expect(page.locator('[data-testid^="pilot-readout-history-"]')).toHaveCount(2);
      await expect(page.getByTestId('pilot-readout-section-pilot-summary')).toBeVisible();
      await expect(page.getByTestId('pilot-readout-section-hypothesis-mapper')).toBeVisible();
      await expect(page.getByTestId('pilot-readout-hypothesis-H1')).toContainText('Promising');
      await expect(page.getByTestId('pilot-readout-section-research-notes')).toContainText('Candidate findings only');

      await page.getByTestId('pilot-readout-compare-select').selectOption(fixture.readoutIds[0]);
      await expect(page.getByText('Compare Readout Diff')).toBeVisible();
    } finally {
      await cleanupPilotDashboardFixture(page, adminIdentity);
    }
  });

  test('@smoke opens the athlete drill-down inside the pilot enrollment boundary', async ({ page }) => {
    const { fixture, adminIdentity } = await seedPilotDashboardFixture(page);

    try {
      await page.goto(`/admin/pulsecheckPilotDashboard/${encodeURIComponent(fixture.pilotId)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForStableAppFrame(page);

      const athleteRow = page.locator('tr').filter({ hasText: fixture.athleteNames[0] }).first();
      await athleteRow.getByRole('link', { name: 'Open athlete' }).click();

      await expect(page.getByRole('heading', { name: fixture.athleteNames[0] })).toBeVisible();
      await expect(page.getByText(/Athlete drill-down inside one pilot/i)).toBeVisible();
      await expect(page.getByText('Enrollment status: active')).toBeVisible();
      await expect(page.getByText('Stable Patterns')).toBeVisible();
      await expect(page.getByText('Recent Patterns')).toBeVisible();
    } finally {
      await cleanupPilotDashboardFixture(page, adminIdentity);
    }
  });

  test('generates and approves a pilot research brief', async ({ page }) => {
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const { fixture, adminIdentity } = await seedPilotDashboardFixture(page);

    try {
      await page.goto(`/admin/pulsecheckPilotDashboard/${encodeURIComponent(fixture.pilotId)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForStableAppFrame(page);

      await page.getByTestId('pilot-dashboard-tab-research-readout').click();

      await page.getByTestId('pilot-readout-generate-button').click();
      await expect(page.getByText('Pilot research readout generated and saved as a draft.')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-testid^="pilot-readout-history-"]')).toHaveCount(3);

      await page.getByTestId('pilot-readout-review-state').selectOption('approved');
      await page.getByTestId('pilot-readout-resolution-pilot-summary').selectOption('accepted');
      await page.getByTestId('pilot-readout-save-review').click();

      await expect(page.getByText('Research readout review was saved.')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('pilot-readout-review-state')).toHaveValue('approved');
    } finally {
      await cleanupPilotDashboardFixture(page, adminIdentity);
    }
  });
});
