import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'fs';
import path from 'path';

const defaultStorageStatePath = path.resolve(process.cwd(), '.playwright/admin-storage-state.json');
const hasAuthState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE) || existsSync(defaultStorageStatePath);
const remoteLoginToken = process.env.PLAYWRIGHT_REMOTE_LOGIN_TOKEN;
const appBaseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const appOrigin = new URL(appBaseURL).origin;

async function dismissLegalTermsModal(page: Page) {
  const agreeButton = page.getByRole('button', { name: /Agree & Continue/i });
  if (!(await agreeButton.isVisible().catch(() => false))) return;

  const checkbox = page.getByRole('checkbox', { name: /I agree to Pulse/i });
  if (await checkbox.isVisible().catch(() => false)) {
    await checkbox.check({ force: true });
  }
  await agreeButton.click();
  await agreeButton.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => null);
}

async function waitForStableAppFrame(page: Page) {
  const transientRefreshText = page.getByText(/missing required error components, refreshing/i);

  if (await transientRefreshText.isVisible().catch(() => false)) {
    await transientRefreshText.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => null);
    await page.waitForLoadState('domcontentloaded').catch(() => null);
  }

  await dismissLegalTermsModal(page);
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

  const useWebAppButton = page.getByRole('button', { name: /Use Web App/i });
  if (await useWebAppButton.isVisible().catch(() => false)) {
    await useWebAppButton.click().catch(() => {});
    await page.waitForTimeout(1_000);
    await page.goto(nextPath, { waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);
  }
}

async function openSystemOverviewSection(page: Page, sectionId: string) {
  await ensureAdminSession(page, `/admin/systemOverview#${sectionId}`);
  await page.getByRole('heading', { name: /System Overview/i }).waitFor({ state: 'visible', timeout: 20_000 });
  await page.evaluate((targetSectionId) => {
    window.dispatchEvent(
      new CustomEvent('system-overview:navigate-section', {
        detail: { sectionId: targetSectionId },
      })
    );
  }, sectionId);
}

test.describe('System Overview detection boundary docs', () => {
  test.skip(!hasAuthState && !remoteLoginToken, 'Requires Playwright admin auth state or PLAYWRIGHT_REMOTE_LOGIN_TOKEN.');

  test('renders the no-fake-session contract across detection layers', async ({ page }) => {
    await openSystemOverviewSection(page, 'pulsecheck-training-load-detection-spec');
    await expect(page.getByText('No Timestamp, No Session Card')).toBeVisible();
    await expect(page.getByText('Evidence Boundary: Daily Rollup vs. Session Candidate')).toBeVisible();
    await expect(
      page.getByText(/Aggregate daily activity evidence can never produce a training-load card/)
    ).toBeVisible();
    await expect(page.getByText(/No timestamped evidence, no session card\. No fake precision\./)).toBeVisible();

    await openSystemOverviewSection(page, 'pulsecheck-session-detection-matching');
    await expect(page.getByRole('heading', { name: 'Session-Candidate Gate' })).toBeVisible();
    await expect(page.getByText('No Window, No Session').first()).toBeVisible();
    await expect(page.getByText('Rejected origin: daily rollup only')).toBeVisible();

    await openSystemOverviewSection(page, 'pulsecheck-contextual-sports-detection-engine');
    await expect(page.getByRole('heading', { name: 'Evidence To Meaning Boundary' })).toBeVisible();
    await expect(page.getByText('Daily Evidence Is Not Session Truth').first()).toBeVisible();
    await expect(page.getByText(/Context clue only/)).toBeVisible();
  });
});
