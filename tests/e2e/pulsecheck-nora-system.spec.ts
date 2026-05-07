import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'fs';
import path from 'path';

const defaultStorageStatePath = path.resolve(process.cwd(), '.playwright/admin-storage-state.json');
const hasAuthState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE) || existsSync(defaultStorageStatePath);
const remoteLoginToken = process.env.PLAYWRIGHT_REMOTE_LOGIN_TOKEN;
const allowWriteTests = process.env.PLAYWRIGHT_ALLOW_WRITE_TESTS === 'true';
const allowSmokeInvocation = process.env.PLAYWRIGHT_ENABLE_ADMIN_SMOKE_INVOCATION === 'true';
const pulseCheckNamespaceBase = process.env.PLAYWRIGHT_E2E_NAMESPACE || 'e2e-pulsecheck';
const pulseCheckNamespace = `${pulseCheckNamespaceBase}-nora-system`;
const appBaseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const appOrigin = new URL(appBaseURL).origin;

interface AuthIdentity {
  uid: string;
  email: string;
}

interface NoraSystemFixture {
  namespace: string;
  organizationId: string;
  teamId: string;
  athleteUserId: string;
  athleteEmail: string;
  conversationId: string;
}

async function waitForStableAppFrame(page: Page) {
  const transientRefreshText = page.getByText(/missing required error components, refreshing/i);

  if (await transientRefreshText.isVisible().catch(() => false)) {
    await transientRefreshText.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => null);
    await page.waitForLoadState('domcontentloaded').catch(() => null);
  }

  await dismissLegalTermsModal(page);
}

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
    await page.evaluate(async ({ email }) => {
      await window.__pulseE2E?.ensureAdminRecord?.(email);
    }, { email: adminIdentity.email }).catch(() => null);
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

async function seedNoraSystemFixture(page: Page): Promise<{ fixture: NoraSystemFixture; adminIdentity: AuthIdentity }> {
  await ensureAdminSession(page, '/admin/adminLevers');
  await waitForPulseE2EHarness(page);

  const adminIdentity = await getAuthenticatedAdminIdentity(page);
  if (!adminIdentity?.uid || !adminIdentity?.email) {
    throw new Error('An authenticated admin identity is required for the Nora system E2E fixture.');
  }

  const fixture = await page.evaluate(
    async ({ namespace, adminUserId, adminEmail }) => {
      return window.__pulseE2E?.seedPulseCheckNoraSystemFixture({
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

  if (!fixture?.conversationId || !fixture?.athleteUserId) {
    throw new Error('Failed to seed the Nora system fixture.');
  }

  return {
    fixture,
    adminIdentity,
  };
}

async function openSystemOverviewSection(page: Page, sectionId: string) {
  await page.goto(`/admin/systemOverview#${sectionId}`, { waitUntil: 'domcontentloaded' });
  await waitForStableAppFrame(page);
  await page.getByRole('heading', { name: /System Overview/i }).waitFor({ state: 'visible', timeout: 20_000 });
  await page.evaluate((targetSectionId) => {
    window.dispatchEvent(
      new CustomEvent('system-overview:navigate-section', {
        detail: { sectionId: targetSectionId },
      })
    );
  }, sectionId);
}

async function cleanupNoraSystemFixture(page: Page, adminIdentity: AuthIdentity) {
  if (page.isClosed()) return;
  await waitForPulseE2EHarness(page).catch(() => null);
  await page.evaluate(
    async ({ namespace, adminUserId }) => {
      await window.__pulseE2E?.cleanupPulseCheckNoraSystemFixture({
        namespace,
        adminUserId,
      });
    },
    {
      namespace: pulseCheckNamespace,
      adminUserId: adminIdentity.uid,
    }
  ).catch(() => null);
}

test.describe.serial('PulseCheck Nora system coverage', () => {
  test.skip(!hasAuthState && !remoteLoginToken, 'Requires Playwright admin auth state or PLAYWRIGHT_REMOTE_LOGIN_TOKEN.');

  test('@smoke exposes Nora and Phase I smoke controls plus system docs', async ({ page }) => {
    await ensureAdminSession(page, '/admin/adminLevers');

    await expect(page.getByRole('heading', { name: /Admin Levers/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /PulseCheck Nora \/ Phase I Smoke/i })).toBeVisible();
    await expect(page.getByText('Scheduled Nora Conversation', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Nora Timeout Sweep', { exact: true })).toBeVisible();
    await expect(page.getByText('Daily Curriculum Assignment', { exact: true })).toBeVisible();
    await expect(page.getByText('Curriculum Reminder', { exact: true })).toBeVisible();
    await expect(page.getByText('Curriculum Assessment', { exact: true })).toBeVisible();

    await page.goto('/admin/noraGuard', { waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);
    await expect(page.getByRole('heading', { name: 'Nora Guard' })).toBeVisible();

    await page.goto('/admin/curriculumLayer', { waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);
    await expect(page.getByRole('heading', { name: 'Curriculum Layer' })).toBeVisible();
    await page.getByRole('button', { name: /Athlete Transparency/i }).click();
    await expect(page.getByRole('heading', { name: /Assignment Intent Contract/i })).toBeVisible();
    await expect(page.getByText(/Same by design/i).first()).toBeVisible();

    await openSystemOverviewSection(page, 'pulsecheck-curriculum-layer-spec');
    await expect(page.getByRole('heading', { name: /Daily Curriculum Layer/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Assignment intent contract/i })).toBeVisible();
    await expect(page.getByText(/curriculumIntent/i).first()).toBeVisible();

    await openSystemOverviewSection(page, 'pulsecheck-nora-conversation-orchestrator-spec');
    await expect(page.getByRole('heading', { name: /Nora Conversation Orchestrator/i })).toBeVisible();

    await openSystemOverviewSection(page, 'pulsecheck-nora-guard-spec');
    await expect(page.getByRole('heading', { name: /Nora Guard/i })).toBeVisible();
  });

  test('Nora Guard renders a seeded thread, evidence, redaction, and revoke state', async ({ page }) => {
    test.skip(!allowWriteTests, 'Set PLAYWRIGHT_ALLOW_WRITE_TESTS=true to seed dev Firestore fixtures.');

    const { fixture, adminIdentity } = await seedNoraSystemFixture(page);

    try {
      await page.goto('/admin/noraGuard', { waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);

      await page.getByPlaceholder(/search/i).fill(fixture.athleteUserId);
      await page.getByRole('button', { name: new RegExp(fixture.athleteUserId) }).click();

      await expect(page.getByText('coach-context-flag').first()).toBeVisible();
      await expect(page.getByText('E2E smoke test trigger')).toBeVisible();
      await expect(page.getByText('[email]').first()).toBeVisible();
      await expect(page.getByText(fixture.athleteEmail)).toHaveCount(0);
      await expect(page.getByText('fallback: E2E fallback proof')).toBeVisible();
      await expect(page.getByText(/1 guardrail violation/i)).toBeVisible();
      await expect(page.getByText('E2E guardrail proof')).toBeVisible();

      await page.getByRole('button', { name: /PII redacted/i }).click();
      await expect(page.getByText(fixture.athleteEmail).first()).toBeVisible();

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: /Revoke/i }).click();
      await expect(page.getByText('closed-revoked').first()).toBeVisible({ timeout: 20_000 });
    } finally {
      await cleanupNoraSystemFixture(page, adminIdentity);
    }
  });

  test('Consent v6 re-prompts a seeded athlete who only accepted v5', async ({ page }) => {
    test.skip(!allowWriteTests, 'Set PLAYWRIGHT_ALLOW_WRITE_TESTS=true to seed dev Firestore fixtures.');

    const { fixture, adminIdentity } = await seedNoraSystemFixture(page);

    try {
      await page.goto(
        `/PulseCheck/athlete-onboarding?organizationId=${encodeURIComponent(fixture.organizationId)}&teamId=${encodeURIComponent(fixture.teamId)}`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForStableAppFrame(page);

      await expect(page.getByText('Pilot Participation Agreement')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('Athlete Privacy Notice')).toBeVisible();
      await expect(page.getByText(/^Agreed$/)).toHaveCount(0);

      const agreementChecks = page.getByLabel('I have read this and I agree.');
      await expect(agreementChecks).toHaveCount(2);
      await agreementChecks.nth(0).check({ force: true });
      await agreementChecks.nth(1).check({ force: true });

      await expect(page.getByText(/^Agreed$/)).toHaveCount(2);
    } finally {
      await cleanupNoraSystemFixture(page, adminIdentity);
    }
  });

  test('can invoke a smoke target when Netlify functions are available', async ({ page }) => {
    test.skip(!allowSmokeInvocation, 'Set PLAYWRIGHT_ENABLE_ADMIN_SMOKE_INVOCATION=true when running against Netlify dev or a deploy preview.');

    await ensureAdminSession(page, '/admin/adminLevers');
    const timeoutSweepCard = page
      .locator('div')
      .filter({ has: page.getByText('Nora Timeout Sweep') })
      .filter({ has: page.getByRole('button', { name: /Run smoke/i }) })
      .first();

    await expect(timeoutSweepCard).toBeVisible({ timeout: 20_000 });
    await timeoutSweepCard.getByRole('button', { name: /Run smoke/i }).click();
    await expect(timeoutSweepCard.getByText('Completed')).toBeVisible({ timeout: 60_000 });
  });
});
