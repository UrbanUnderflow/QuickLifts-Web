import { expect, test, type Locator, type Page } from '@playwright/test';
import { existsSync } from 'fs';
import path from 'path';

const VARIANT_NAME = process.env.PLAYWRIGHT_VARIANT_NAME || 'Late-Pressure Endurance Lock';
const DEFAULT_VARIANT_CASES = [
  { name: 'Sport-Context Reset', family: 'Reset' },
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
const testTimeoutMs = Number(process.env.PLAYWRIGHT_TEST_TIMEOUT_MS || 180_000);
const variantCases = process.env.PLAYWRIGHT_VARIANT_NAME
  ? DEFAULT_VARIANT_CASES.filter((entry) => entry.name === VARIANT_NAME)
  : DEFAULT_VARIANT_CASES;
const syncTestVariantCase = DEFAULT_VARIANT_CASES.find((entry) => entry.name === SYNC_TEST_VARIANT_NAME) ?? DEFAULT_VARIANT_CASES[DEFAULT_VARIANT_CASES.length - 1];

function displayFamilyName(name: string) {
  return name;
}

function displayVariantName(name: string) {
  return name;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function previewRoot(page: Page): Locator {
  return page
    .locator('button[aria-label="Close module preview"]')
    .locator('xpath=ancestor::div[contains(@class,"fixed") and contains(@class,"inset-0") and contains(@class,"z-50")][1]')
    .first();
}

async function closePreviewRuntime(page: Page) {
  const closeButton = previewRoot(page).getByRole('button', { name: /Close module preview/i });
  await closeButton.evaluate((element: HTMLElement) => element.click());
  await expect(closeButton).not.toBeVisible({ timeout: 10_000 });
}

async function expectPreviewRuntime(page: Page, familyName: string) {
  const root = previewRoot(page);
  await expect(root.getByRole('button', { name: /Close module preview/i })).toBeVisible({ timeout: 15_000 });
  await expect(root.getByRole('button', { name: /Begin Exercise/i })).not.toBeVisible({ timeout: 15_000 });
  await expect(root.getByRole('button', { name: /Begin Training/i })).not.toBeVisible({ timeout: 15_000 });
  await expect(root.getByRole('button', { name: /Start Built Module|Start Noise Gate|Start Brake Point|Start Signal Window|Start Sequence Shift|Begin Endurance Run/i })).not.toBeVisible({ timeout: 15_000 });
  await expect(root.getByText('Before we begin...')).not.toBeVisible({ timeout: 15_000 });

  const activeAssertions: Record<string, RegExp> = {
    Reset: /Target:|rounds?|Recover|Lock In/i,
    'Noise Gate': /Live Cue|Decision Field|Noise accuracy/i,
    'Brake Point': /Brake Cue|Action Field|Clean rate/i,
    'Signal Window': /Read Window|Decision Field|window collapsing/i,
    'Sequence Shift': /Active Rule|Stimulus|Clean rate/i,
    'Endurance Lock': /Maintain Form|Cadence|Finish-Phase Control|Clean Execution Under Load/i,
  };

  const marker = activeAssertions[familyName];
  if (marker) {
    await expect(root.getByText(marker).first()).toBeVisible({ timeout: 15_000 });
  }
}

async function startPreviewRuntime(page: Page) {
  const root = previewRoot(page);
  const entryButtonNames = [
    /Begin Exercise/i,
    /Begin Training/i,
    /Start Built Module/i,
    /Start Noise Gate/i,
    /Start Brake Point/i,
    /Start Signal Window/i,
    /Start Sequence Shift/i,
    /Begin Endurance Run/i,
  ];

  for (let step = 0; step < 6; step += 1) {
    const preMoodHeading = root.getByText('Before we begin...').first();
    if (await preMoodHeading.isVisible().catch(() => false)) {
      await root.getByRole('button', { name: /Neutral|Good|Great/i }).first().click();
      await expect(preMoodHeading).not.toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(250);
      continue;
    }

    let clickedEntryButton = false;
    for (const buttonName of entryButtonNames) {
      const button = root.getByRole('button', { name: buttonName }).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click({ force: true });
        await page.waitForTimeout(500);
        clickedEntryButton = true;
        break;
      }
    }

    if (!clickedEntryButton) {
      break;
    }
  }
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

  const fixture = await page.evaluate(async ({ sourceName, namespace: e2eNamespace }) => {
    await window.__pulseE2E?.cleanupRegistryFixtures(e2eNamespace);
    return await window.__pulseE2E?.cloneVariantFixtureByName(sourceName, e2eNamespace);
  }, { sourceName: variantName, namespace: caseNamespace });

  const fixtureName = fixture?.variantName || `[E2E] ${displayVariantName(variantName)}`;
  const moduleId = fixture?.moduleId || `${caseNamespace}-${variantName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const variantId = fixture?.variantId || `${caseNamespace}-${variantName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  await page.waitForFunction(async (nextVariantId) => {
    return Boolean(await window.__pulseE2E?.inspectVariant(nextVariantId));
  }, variantId, { timeout: 20_000 });

  return {
    fixtureName,
    moduleId,
    variantId,
  };
}

async function cleanupRegistryFixtureNamespace(page: Page, caseNamespace: string, label: string) {
  if (page.isClosed()) return;

  try {
    await Promise.race([
      page.evaluate(async ({ namespace: e2eNamespace }) => {
        await window.__pulseE2E?.cleanupRegistryFixtures(e2eNamespace);
      }, { namespace: caseNamespace }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timed out cleaning registry fixture namespace for ${label}.`)), 15_000);
      }),
    ]);
  } catch (error) {
    console.warn(`[registry-build-publish] ${label}:`, error);
  }
}

async function dismissRegistryOverlays(page: Page) {
  const closeButton = page.getByRole('button', { name: /^Close$/ }).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    await expect(closeButton).not.toBeVisible({ timeout: 10_000 });
  }
}

async function openFixtureWorkspace(page: Page, fixtureName: string, familyName: string) {
  await dismissRegistryOverlays(page);

  const search = page.getByPlaceholder('Search variants or families...');
  await search.fill(fixtureName);

  const familyGroup = page.getByRole('button', {
    name: new RegExp(`^${escapeRegex(displayFamilyName(familyName))}\\s+(Locked|Candidate)\\b`, 'i'),
  }).first();
  const openWorkspaceButton = page
    .locator('div')
    .filter({ hasText: fixtureName })
    .locator('button[title="Open variant workspace"]')
    .first();

  if (!(await openWorkspaceButton.isVisible().catch(() => false))) {
    await expect(familyGroup).toBeVisible({ timeout: 15_000 });
    await familyGroup.click();
  }

  await expect(openWorkspaceButton).toBeVisible({ timeout: 15_000 });
  await openWorkspaceButton.click();
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
      test.setTimeout(testTimeoutMs);
      test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');

      const caseNamespace = `${namespace}-${variantCase.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      await ensureAdminSession(page);
      await waitForE2EHarness(page);

      await expect(page.getByRole('button', { name: /Variant Registry/i }).first()).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: /Sync Registry/i }).click();
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
        await expect(
          previewRoot(page).getByRole('button', { name: /Begin Exercise|Begin Training/i }).first(),
        ).toBeVisible({ timeout: 15_000 });
        await startPreviewRuntime(page);
        await expectPreviewRuntime(page, variantCase.family);
        await closePreviewRuntime(page);

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
        await cleanupRegistryFixtureNamespace(page, caseNamespace, `cleanup ${fixtureName}`);
      }
    });
  }

  test(`registry sync-state smoke: ${syncTestVariantCase.name}`, async ({ page }) => {
    test.setTimeout(testTimeoutMs);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true to verify publish and out-of-sync behavior.');

    const caseNamespace = `${namespace}-sync-${syncTestVariantCase.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    await ensureAdminSession(page);
    await waitForE2EHarness(page);
    await expect(page.getByRole('button', { name: /Variant Registry/i }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Sync Registry/i }).click();
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
      await cleanupRegistryFixtureNamespace(page, caseNamespace, `sync cleanup ${fixtureName}`);
    }
  });
});
