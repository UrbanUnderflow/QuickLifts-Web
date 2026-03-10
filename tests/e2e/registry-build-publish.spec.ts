import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'fs';
import path from 'path';

const VARIANT_NAME = process.env.PLAYWRIGHT_VARIANT_NAME || 'Late-Pressure Endurance Lock';
const DEFAULT_VARIANT_CASES = [
  { name: 'Sport-Context Kill Switch', family: 'The Kill Switch' },
  { name: 'Crowd-Noise Noise Gate', family: 'Noise Gate' },
  { name: 'False-Start Brake Point', family: 'Brake Point' },
  { name: 'Rapid Recognition Signal Window', family: 'Signal Window' },
  { name: 'Sequence-Memory Sequence Shift', family: 'Sequence Shift' },
  { name: 'Late-Pressure Endurance Lock', family: 'Endurance Lock' },
] as const;
const SYNC_TEST_VARIANT_NAME = process.env.PLAYWRIGHT_SYNC_VARIANT_NAME || 'Late-Pressure Endurance Lock';
const defaultStorageStatePath = path.resolve(process.cwd(), '.playwright/admin-storage-state.json');
const hasAuthState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE) || existsSync(defaultStorageStatePath);
const remoteLoginToken = process.env.PLAYWRIGHT_REMOTE_LOGIN_TOKEN;
const allowWriteTests = process.env.PLAYWRIGHT_ALLOW_WRITE_TESTS === 'true';
const namespace = process.env.PLAYWRIGHT_E2E_NAMESPACE || 'e2e-registry';
const variantCases = process.env.PLAYWRIGHT_VARIANT_NAME
  ? DEFAULT_VARIANT_CASES.filter((entry) => entry.name === VARIANT_NAME)
  : DEFAULT_VARIANT_CASES;
const syncTestVariantCase = DEFAULT_VARIANT_CASES.find((entry) => entry.name === SYNC_TEST_VARIANT_NAME) ?? DEFAULT_VARIANT_CASES[DEFAULT_VARIANT_CASES.length - 1];

function displayFamilyName(name: string) {
  return name === 'The Kill Switch' ? 'Reset' : name;
}

function displayVariantName(name: string) {
  return name.replace(/\bThe Kill Switch\b/g, 'Reset').replace(/\bKill Switch\b/g, 'Reset');
}

async function expectPreviewRuntime(page: Page, familyName: string) {
  if (familyName === 'The Kill Switch') {
    await expect(
      page.getByText(/3-Second Reset|Kill Switch|Reset/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    return;
  }

  await expect(page.getByText('Compiled Runtime')).toBeVisible({ timeout: 15_000 });
}

async function ensureAdminSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('forceDevFirebase', 'true');
    window.localStorage.setItem('pulse_has_seen_marketing', 'true');
  });
  if (remoteLoginToken) {
    await page.goto(`/remote-login?token=${encodeURIComponent(remoteLoginToken)}&next=${encodeURIComponent('/admin/systemOverview#variant-registry')}`);
  } else {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const useWebAppButton = page.getByRole('button', { name: /Use Web App/i });
    if (await useWebAppButton.isVisible().catch(() => false)) {
      await useWebAppButton.click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    await page.goto('/admin/systemOverview#variant-registry', { waitUntil: 'domcontentloaded' });
  }
}

async function waitForE2EHarness(page: Page) {
  await page.waitForFunction(() => Boolean(window.__pulseE2E), undefined, { timeout: 20_000 });
}

async function prepareRegistryFixture(page: Page, variantName: string, caseNamespace: string) {
  await waitForE2EHarness(page);

  await page.evaluate(async ({ sourceName, namespace: e2eNamespace }) => {
    await window.__pulseE2E?.cleanupRegistryFixtures(e2eNamespace);
    await window.__pulseE2E?.cloneVariantFixtureByName(sourceName, e2eNamespace);
  }, { sourceName: variantName, namespace: caseNamespace });

  const fixtureName = `[E2E] ${displayVariantName(variantName)}`;
  const moduleId = `${caseNamespace}-${variantName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return {
    fixtureName,
    moduleId,
  };
}

async function openFixtureWorkspace(page: Page, fixtureName: string, familyName: string) {
  const search = page.getByPlaceholder('Search variants or families...');
  await search.fill(fixtureName);

  const familyGroup = page.getByRole('button', { name: new RegExp(displayFamilyName(familyName), 'i') }).first();
  if (await familyGroup.isVisible()) {
    await familyGroup.click();
  }

  const row = page.locator('div').filter({ hasText: fixtureName }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.locator('button[title=\"Open variant workspace\"]').click();
  await expect(page.getByText('Variant Workspace')).toBeVisible({ timeout: 10_000 });
}

function publishStatusValue(page: Page, label: 'Build Status' | 'Sync Status') {
  return page.locator(`//p[normalize-space()='${label}']/following-sibling::p[1]`).last();
}

test.describe('Variant registry harness', () => {
  test('admin system overview page responds', async ({ page }) => {
    await page.goto('/admin/systemOverview#variant-registry');
    await expect(page).toHaveTitle(/Pulse|System Overview|Mental Training/i);
  });

  for (const variantCase of variantCases) {
    test(`registry build preview and publish smoke: ${variantCase.name}`, async ({ page }) => {
      test.setTimeout(180_000);
      test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');

      const caseNamespace = `${namespace}-${variantCase.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      await ensureAdminSession(page);
      await waitForE2EHarness(page);

      await expect(page.getByRole('button', { name: /Variant Registry/i }).first()).toBeVisible({ timeout: 20_000 });
      const { fixtureName, moduleId } = await prepareRegistryFixture(page, variantCase.name, caseNamespace);

      try {
        await page.getByRole('button', { name: /Sync Registry/i }).click();

        await openFixtureWorkspace(page, fixtureName, variantCase.family);
        await page.getByRole('button', { name: /Generate Draft/i }).click();
        await expect(page.getByText(/Status:\s+(Pass|Pass with Warnings)/i)).toBeVisible({ timeout: 20_000 });

        const publishTab = page.getByRole('button', { name: 'Publish', exact: true }).last();
        await publishTab.click();
        await expect(page.getByText('Build Status')).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText('Source Diff')).toBeVisible({ timeout: 10_000 });

        const previewButton = page.getByRole('button', { name: /Build \+ Preview|Preview Built Module/i }).first();
        await previewButton.click();
        await expect(page.getByRole('button', { name: /Begin Exercise/i })).toBeVisible({ timeout: 15_000 });
        await page.getByRole('button', { name: /Begin Exercise/i }).click();
        await expect(page.getByText('Before we begin...')).toBeVisible({ timeout: 10_000 });
        await page.getByRole('button', { name: /Neutral|Good|Great/i }).first().click();
        await expectPreviewRuntime(page, variantCase.family);
        await page.getByRole('button', { name: /Close module preview/i }).click();
        await expect(page.getByRole('button', { name: /Close module preview/i })).not.toBeVisible({ timeout: 10_000 });

        const moduleIdInput = page.locator("//label[contains(., 'Module Id')]/following-sibling::input").first();
        if (await moduleIdInput.isVisible().catch(() => false)) {
          await moduleIdInput.fill(moduleId);
        }

        if (!allowWriteTests) {
          await expect(page.getByRole('button', { name: /Publish Built Module|Save \+ Rebuild \+ Publish/i }).first()).toBeVisible();
          return;
        }

        const publishButton = page.getByRole('button', { name: /Publish Built Module|Save \+ Rebuild \+ Publish/i }).first();
        await publishButton.click();

        await expect(page.getByText(/published to sim-modules/i)).toBeVisible({ timeout: 20_000 });
      } finally {
        if (!page.isClosed()) {
          await page.evaluate(async ({ namespace: e2eNamespace }) => {
            await window.__pulseE2E?.cleanupRegistryFixtures(e2eNamespace);
          }, { namespace: caseNamespace });
        }
      }
    });
  }

  test(`registry sync-state smoke: ${syncTestVariantCase.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true to verify publish and out-of-sync behavior.');

    const caseNamespace = `${namespace}-sync-${syncTestVariantCase.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    await ensureAdminSession(page);
    await waitForE2EHarness(page);
    await expect(page.getByRole('button', { name: /Variant Registry/i }).first()).toBeVisible({ timeout: 20_000 });
    const { fixtureName, moduleId } = await prepareRegistryFixture(page, syncTestVariantCase.name, caseNamespace);

    try {
      await page.getByRole('button', { name: /Sync Registry/i }).click();
      await openFixtureWorkspace(page, fixtureName, syncTestVariantCase.family);

      await page.getByRole('button', { name: /Generate Draft/i }).click();
      await expect(page.getByText(/Status:\s+(Pass|Pass with Warnings)/i)).toBeVisible({ timeout: 20_000 });

      const publishTab = page.getByRole('button', { name: 'Publish', exact: true }).last();
      await publishTab.click();
      await expect(page.getByText('Build Status')).toBeVisible({ timeout: 10_000 });

      const moduleIdInput = page.locator("//label[contains(., 'Module Id')]/following-sibling::input").first();
      if (await moduleIdInput.isVisible().catch(() => false)) {
        await moduleIdInput.fill(moduleId);
      }

      await page.getByRole('button', { name: /Publish Built Module/i }).first().click();
      await expect(page.getByText(new RegExp(`${fixtureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} published to sim-modules`, 'i'))).toBeVisible({ timeout: 20_000 });

      await openFixtureWorkspace(page, fixtureName, syncTestVariantCase.family);
      await page.getByRole('button', { name: 'Publish', exact: true }).last().click();
      await expect(page.getByText('Sync Status')).toBeVisible({ timeout: 10_000 });

      const descriptionInput = page.locator("//label[contains(., 'Description')]/following-sibling::textarea").first();
      const currentDescription = await descriptionInput.inputValue();
      await descriptionInput.fill(`${currentDescription} E2E sync drift.`);

      await page.getByRole('button', { name: /Save Draft|Save Draft Only/i }).first().click();
      await expect(page.getByText(new RegExp(`${fixtureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} saved to the variant registry`, 'i'))).toBeVisible({ timeout: 20_000 });

      await page.getByRole('button', { name: 'Publish', exact: true }).last().click();
      await expect(publishStatusValue(page, 'Build Status')).toHaveText('Out of Sync', { timeout: 10_000 });
      await expect(publishStatusValue(page, 'Sync Status')).toHaveText('Module Changed', { timeout: 10_000 });

      await page.getByRole('button', { name: /Save \+ Rebuild \+ Publish/i }).first().click();
      await expect(page.getByText(new RegExp(`${fixtureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} published to sim-modules`, 'i'))).toBeVisible({ timeout: 20_000 });

      await openFixtureWorkspace(page, fixtureName, syncTestVariantCase.family);
      await page.getByRole('button', { name: 'Publish', exact: true }).last().click();
      await expect(publishStatusValue(page, 'Build Status')).toHaveText('Published', { timeout: 10_000 });
      await expect(publishStatusValue(page, 'Sync Status')).toHaveText('In Sync', { timeout: 10_000 });
    } finally {
      if (!page.isClosed()) {
        await page.evaluate(async ({ namespace: e2eNamespace }) => {
          await window.__pulseE2E?.cleanupRegistryFixtures(e2eNamespace);
        }, { namespace: caseNamespace });
      }
    }
  });
});
