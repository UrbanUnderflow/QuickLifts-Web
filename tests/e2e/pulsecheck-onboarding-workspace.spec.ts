import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { existsSync } from 'fs';
import path from 'path';

const defaultStorageStatePath = path.resolve(process.cwd(), '.playwright/admin-storage-state.json');
const hasAuthState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE) || existsSync(defaultStorageStatePath);
const remoteLoginToken = process.env.PLAYWRIGHT_REMOTE_LOGIN_TOKEN;
const allowWriteTests = process.env.PLAYWRIGHT_ALLOW_WRITE_TESTS === 'true';
const pulseCheckOrganizationId = process.env.PLAYWRIGHT_PULSECHECK_ORG_ID || '';
const pulseCheckTeamId = process.env.PLAYWRIGHT_PULSECHECK_TEAM_ID || '';
const pulseCheckNamespace = process.env.PLAYWRIGHT_E2E_NAMESPACE || 'e2e-pulsecheck';
const appBaseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const appOrigin = new URL(appBaseURL).origin;
let pulseCheckWorkspaceContextPromise: Promise<PulseCheckWorkspaceContext> | null = null;
const defaultSeededWorkspaceContext: PulseCheckWorkspaceContext = {
  organizationId: `${pulseCheckNamespace}-workspace-org`,
  teamId: `${pulseCheckNamespace}-workspace-team`,
};

interface PulseCheckWorkspaceContext {
  organizationId: string;
  teamId: string;
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

async function waitForStableAppFrame(page: Page) {
  const transientRefreshText = page.getByText(/missing required error components, refreshing/i);

  if (await transientRefreshText.isVisible().catch(() => false)) {
    await transientRefreshText.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => null);
    await page.waitForLoadState('domcontentloaded').catch(() => null);
  }
}

async function getVisibleLabeledField(page: Page, label: string) {
  const fields = page.getByLabel(label);
  const count = await fields.count();

  for (let index = 0; index < count; index += 1) {
    const candidate = fields.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }

  return fields.first();
}

async function fillInviteEmailField(page: Page, email: string) {
  const emailField = await getVisibleLabeledField(page, 'Email');
  if (await emailField.isDisabled().catch(() => false)) {
    await expect(emailField).toHaveValue(email, { timeout: 20_000 });
    return;
  }

  await emailField.fill(email);
}

function teamWorkspacePath(context?: PulseCheckWorkspaceContext) {
  const organizationId = context?.organizationId || pulseCheckOrganizationId;
  const teamId = context?.teamId || pulseCheckTeamId;
  return `/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`;
}

function postActivationPath(context?: PulseCheckWorkspaceContext) {
  const organizationId = context?.organizationId || pulseCheckOrganizationId;
  const teamId = context?.teamId || pulseCheckTeamId;
  return `/PulseCheck/post-activation?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`;
}

function legacyRosterMigrationPath() {
  return '/admin/pulsecheckLegacyRosterMigration';
}

async function waitForPulseE2EHarness(page: Page) {
  await page.waitForFunction(() => Boolean(window.__pulseE2E), undefined, { timeout: 20_000 });
}

async function getAuthenticatedAdminIdentity(page: Page) {
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

async function getPulseCheckWorkspaceContext(page: Page): Promise<PulseCheckWorkspaceContext> {
  if (pulseCheckOrganizationId && pulseCheckTeamId) {
    return {
      organizationId: pulseCheckOrganizationId,
      teamId: pulseCheckTeamId,
    };
  }

  if (!pulseCheckWorkspaceContextPromise) {
    pulseCheckWorkspaceContextPromise = (async () => {
      await ensureAdminSession(page, '/admin/pulsecheckProvisioning');

      try {
        await waitForPulseE2EHarness(page);
      } catch (error) {
        console.warn('[PulseCheck E2E] Falling back to deterministic workspace context because the E2E harness was unavailable.', error);
        return defaultSeededWorkspaceContext;
      }

      const adminIdentity = await getAuthenticatedAdminIdentity(page);

      if (!adminIdentity?.uid || !adminIdentity?.email) {
        return defaultSeededWorkspaceContext;
      }

      const seeded = await page.evaluate(
        async ({ namespace, adminUserId, adminEmail }) => {
          return window.__pulseE2E?.seedPulseCheckAdminWorkspaceFixture(namespace, adminUserId, adminEmail);
        },
        {
          namespace: `${pulseCheckNamespace}-workspace`,
          adminUserId: adminIdentity.uid,
          adminEmail: adminIdentity.email,
        }
      );

      if (!seeded?.organizationId || !seeded?.teamId) {
        return defaultSeededWorkspaceContext;
      }

      return {
        organizationId: seeded.organizationId,
        teamId: seeded.teamId,
      };
    })();
  }

  return pulseCheckWorkspaceContextPromise;
}

async function seedLegacyRosterFixture(
  page: Page,
  namespace: string,
  mode: 'new-container' | 'existing-team'
) {
  await waitForPulseE2EHarness(page);
  return page.evaluate(async ({ fixtureNamespace, fixtureMode }) => {
    await window.__pulseE2E?.cleanupLegacyCoachRosterFixtures(fixtureNamespace);
    return window.__pulseE2E?.seedLegacyCoachRosterFixture(fixtureNamespace, fixtureMode);
  }, { fixtureNamespace: namespace, fixtureMode: mode });
}

async function inspectLegacyRosterFixture(page: Page, namespace: string) {
  await waitForPulseE2EHarness(page);
  return page.evaluate(async ({ fixtureNamespace }) => {
    return window.__pulseE2E?.inspectLegacyCoachRosterFixture(fixtureNamespace);
  }, { fixtureNamespace: namespace });
}

async function cleanupLegacyRosterFixture(page: Page, namespace: string) {
  await waitForPulseE2EHarness(page);
  return page.evaluate(async ({ fixtureNamespace }) => {
    return window.__pulseE2E?.cleanupLegacyCoachRosterFixtures(fixtureNamespace);
  }, { fixtureNamespace: namespace });
}

async function createIsolatedPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [],
    },
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: appOrigin });
  await context.addInitScript(() => {
    window.localStorage.setItem('forceDevFirebase', 'true');
    window.localStorage.setItem('pulse_has_seen_marketing', 'true');
  });
  const page = await context.newPage();
  return { context, page };
}

async function extractInviteUrl(inviteCard: ReturnType<Page['locator']>) {
  const text = (await inviteCard.innerText()).trim();
  const match = text.match(/https?:\/\/\S+/);
  if (!match) {
    throw new Error('Could not find activation URL in invite card.');
  }
  const resolved = new URL(match[0]);
  resolved.protocol = new URL(appOrigin).protocol;
  resolved.host = new URL(appOrigin).host;
  return resolved.toString();
}

function getWorkspaceAthleteInviteCard(page: Page, email: string) {
  return page
    .locator('div')
    .filter({ has: page.getByText(email, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: /^Revoke$/ }) })
    .last();
}

function getPostActivationAdultInviteCard(page: Page, recipientName: string) {
  return page
    .locator('div')
    .filter({ has: page.getByText(recipientName, { exact: true }) })
    .filter({ has: page.getByRole('link', { name: /^Open$/ }) })
    .last();
}

function getAdultMemberCard(page: Page, email: string) {
  return page
    .locator('div.rounded-2xl')
    .filter({ hasText: email })
    .filter({ has: page.getByRole('button', { name: /Assign Athletes|Manage Assigned/i }) })
    .last();
}

function getAthleteRosterCard(page: Page, email: string) {
  return page
    .locator('div.rounded-2xl')
    .filter({ hasText: email })
    .filter({ hasText: /team membership/i })
    .last();
}

async function openAdminOnboardingModal(page: Page) {
  await page.locator('button:has-text("Send Onboarding Link"):not([disabled])').first().click();
  await expect(page.getByRole('heading', { name: /PulseCheck Admin Onboarding/i })).toBeVisible({ timeout: 20_000 });
}

async function addAdditionalAdminRecipient(page: Page, name: string, email: string) {
  await page.getByPlaceholder('Additional admin name').fill(name);
  await page.getByPlaceholder('admin2@school.edu').fill(email);
  await page.getByRole('button', { name: /^Add Admin$/i }).click();
  await expect(page.getByText(email, { exact: true }).last()).toBeVisible({ timeout: 15_000 });
}

async function generateAdminActivationLink(page: Page, email: string) {
  const recipientCard = page
    .getByText(email, { exact: true })
    .locator(
      'xpath=ancestor::div[count(.//button[contains(normalize-space(.), "Generate Link") or contains(normalize-space(.), "Regenerate Link")]) = 1][1]'
    );
  await expect(recipientCard).toBeVisible({ timeout: 15_000 });

  const existingCardText = (await recipientCard.innerText()).trim();
  const existingUrlMatch = existingCardText.match(/https?:\/\/\S+/);
  const existingUrl = existingUrlMatch ? existingUrlMatch[0] : '';
  const generateButton = recipientCard.getByRole('button', { name: /Generate Link|Regenerate Link/i });
  await generateButton.click();

  if (existingUrl) {
    await expect(recipientCard).not.toContainText(existingUrl, { timeout: 20_000 });
  }

  const activationUrlPattern = new RegExp(
    `${appOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/pulsecheck/admin-activation/`,
    'i'
  );

  await expect(recipientCard.getByText(activationUrlPattern)).toBeVisible({
    timeout: 20_000,
  });

  return extractInviteUrl(recipientCard);
}

async function redeemAdultInvite(
  browser: Browser,
  inviteUrl: string,
  {
    email,
    name,
    title,
    username,
    password,
  }: {
    email: string;
    name: string;
    title: string;
    username: string;
    password: string;
  }
) {
  const { context, page } = await createIsolatedPage(browser);

  try {
    page.on('console', (message) => {
      const text = message.text().replace(/\s+/g, ' ').slice(0, 300);
      console.log('[PulseCheck Invite Helper][console]', message.type(), text);
    });
    page.on('pageerror', (error) => {
      console.log('[PulseCheck Invite Helper][pageerror]', error.message);
    });

    const accessReadyText = page.getByText(/Your .* access for .* is active\./i);
    const acceptInviteButton = page.getByRole('button', { name: /Accept Invite/i });
    const continueLink = page.getByRole('link', { name: /Continue/i });
    const redeemFailureText = page.getByText(/PERMISSION_DENIED|Missing or insufficient permissions|Failed to redeem invite/i);

    await page.goto(inviteUrl, { waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);
    await expect(page.getByRole('heading', { name: /Join/i })).toBeVisible({ timeout: 20_000 });
    await fillInviteEmailField(page, email);
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.getByRole('button', { name: /Create Account and Join/i }).click();
    console.log('[PulseCheck Invite Helper] account created submit complete', { url: page.url() });

    await Promise.race([
      accessReadyText.waitFor({ state: 'visible', timeout: 20_000 }),
      acceptInviteButton.waitFor({ state: 'visible', timeout: 20_000 }),
      continueLink.waitFor({ state: 'visible', timeout: 20_000 }),
      page.waitForURL(/\/PulseCheck\/member-setup/i, { timeout: 20_000 }).catch(() => null),
      page.waitForURL(/\/PulseCheck\/team-workspace/i, { timeout: 20_000 }).catch(() => null),
    ]).catch(() => null);

    await Promise.race([
      page.waitForURL(/\/PulseCheck\/member-setup/i, { timeout: 20_000 }),
      continueLink.waitFor({ state: 'visible', timeout: 20_000 }),
      accessReadyText.waitFor({ state: 'visible', timeout: 20_000 }),
    ]).catch(() => null);

    if (
      !/\/PulseCheck\/member-setup/i.test(page.url()) &&
      !/\/PulseCheck\/team-workspace/i.test(page.url()) &&
      (await acceptInviteButton.isVisible().catch(() => false)) &&
      (await redeemFailureText.isVisible().catch(() => false))
    ) {
      console.log('[PulseCheck Invite Helper] retrying redeem from signed-in fallback', { url: page.url() });
      await acceptInviteButton.click();
      await Promise.race([
        page.waitForURL(/\/PulseCheck\/member-setup/i, { timeout: 20_000 }),
        page.waitForURL(/\/PulseCheck\/team-workspace/i, { timeout: 20_000 }),
        continueLink.waitFor({ state: 'visible', timeout: 20_000 }),
        accessReadyText.waitFor({ state: 'visible', timeout: 20_000 }),
      ]).catch(() => null);
    }

    const postAcceptBody = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    console.log('[PulseCheck Invite Helper] after post-accept wait', {
      url: page.url(),
      hasContinue: /Continue/i.test(postAcceptBody),
      hasFailure: /Failed|error|restricted|already exists/i.test(postAcceptBody),
      body: postAcceptBody.slice(0, 300),
    });

    if (/\/PulseCheck\/team-workspace/i.test(page.url())) {
      await waitForStableAppFrame(page);
      return { context, page };
    }

    if (!/\/PulseCheck\/member-setup/i.test(page.url())) {
      const continueCount = await continueLink.count().catch(() => 0);
      if (continueCount > 0) {
        const continueHref = await continueLink.first().getAttribute('href').catch(() => null);
        console.log('[PulseCheck Invite Helper] continue handoff', { continueHref, url: page.url() });
        if (continueHref) {
          await page.goto(continueHref, { waitUntil: 'domcontentloaded' });
        } else {
          await continueLink.first().click({ timeout: 5_000 });
        }
      }
    }

    await waitForStableAppFrame(page);

    if (/\/PulseCheck\/team-workspace/i.test(page.url())) {
      return { context, page };
    }

    await expect(page).toHaveURL(/\/PulseCheck\/member-setup/i, { timeout: 20_000 });
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: /Complete Member Setup/i }).click();

    await Promise.race([
      page.waitForURL(/\/PulseCheck\/team-workspace/i, { timeout: 20_000 }),
      page.getByText(/Your member setup is complete/i).waitFor({ state: 'visible', timeout: 20_000 }),
    ]);

    if (!/\/PulseCheck\/team-workspace/i.test(page.url())) {
      const currentUrl = new URL(page.url());
      const organizationId = currentUrl.searchParams.get('organizationId') || '';
      const teamId = currentUrl.searchParams.get('teamId') || '';
      await page.goto(
        `/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForStableAppFrame(page);
    }

    await expect(page).toHaveURL(/\/PulseCheck\/team-workspace/i, { timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });

    return { context, page };
  } catch (error) {
    await context.close().catch(() => null);
    throw error;
  }
}

async function redeemAthleteInvite(
  browser: Browser,
  inviteUrl: string,
  {
    email,
    name,
    username,
    password,
  }: {
    email: string;
    name: string;
    username: string;
    password: string;
  }
) {
  const { context, page } = await createIsolatedPage(browser);

  try {
    const accessReadyText = page.getByText(/Your .* access for .* is active\./i);
    const acceptInviteButton = page.getByRole('button', { name: /Accept Invite/i });
    const continueLink = page.getByRole('link', { name: /Continue/i });
    const redeemFailureText = page.getByText(/PERMISSION_DENIED|Missing or insufficient permissions|Failed to redeem invite/i);

    await page.goto(inviteUrl, { waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);
    await expect(page.getByRole('heading', { name: /Join/i })).toBeVisible({ timeout: 20_000 });
    await fillInviteEmailField(page, email);
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.getByRole('button', { name: /Create Account and Join/i }).click();
    console.log('[PulseCheck Invite Helper] athlete account created submit complete', { url: page.url() });

    await Promise.race([
      accessReadyText.waitFor({ state: 'visible', timeout: 20_000 }),
      acceptInviteButton.waitFor({ state: 'visible', timeout: 20_000 }),
      continueLink.waitFor({ state: 'visible', timeout: 20_000 }),
      page.waitForURL(/\/PulseCheck\/athlete-onboarding/i, { timeout: 20_000 }).catch(() => null),
      page.waitForURL(/\/PulseCheck\/team-workspace/i, { timeout: 20_000 }).catch(() => null),
    ]).catch(() => null);

    await Promise.race([
      page.waitForURL(/\/PulseCheck\/athlete-onboarding/i, { timeout: 20_000 }),
      continueLink.waitFor({ state: 'visible', timeout: 20_000 }),
      accessReadyText.waitFor({ state: 'visible', timeout: 20_000 }),
    ]).catch(() => null);

    if (
      !/\/PulseCheck\/athlete-onboarding/i.test(page.url()) &&
      !/\/PulseCheck\/team-workspace/i.test(page.url()) &&
      (await acceptInviteButton.isVisible().catch(() => false)) &&
      (await redeemFailureText.isVisible().catch(() => false))
    ) {
      console.log('[PulseCheck Invite Helper] athlete retrying redeem from signed-in fallback', { url: page.url() });
      await acceptInviteButton.click();
      await Promise.race([
        page.waitForURL(/\/PulseCheck\/athlete-onboarding/i, { timeout: 20_000 }),
        page.waitForURL(/\/PulseCheck\/team-workspace/i, { timeout: 20_000 }),
        continueLink.waitFor({ state: 'visible', timeout: 20_000 }),
        accessReadyText.waitFor({ state: 'visible', timeout: 20_000 }),
      ]).catch(() => null);
    }

    console.log('[PulseCheck Invite Helper] athlete after post-accept wait', {
      url: page.url(),
      body: (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300),
    });

    if (!/\/PulseCheck\/athlete-onboarding/i.test(page.url())) {
      const continueCount = await continueLink.count().catch(() => 0);
      if (continueCount > 0) {
        const continueHref = await continueLink.first().getAttribute('href').catch(() => null);
        console.log('[PulseCheck Invite Helper] athlete continue handoff', { continueHref, url: page.url() });
        if (continueHref) {
          await page.goto(continueHref, { waitUntil: 'domcontentloaded' });
        } else {
          await continueLink.first().click({ timeout: 5_000 });
        }
      }
    }

    await waitForStableAppFrame(page);

    await expect(page).toHaveURL(/\/PulseCheck\/athlete-onboarding/i, { timeout: 20_000 });
    await page.getByLabel('Your Name').fill(name);
  await page.locator('label').filter({ hasText: /I agree to get started with PulseCheck for my team\./i }).click();
    await page.getByRole('button', { name: /Complete Athlete Onboarding/i }).click();

    await Promise.race([
      page.waitForURL(/\/PulseCheck\/team-workspace/i, { timeout: 20_000 }),
      page.getByText(/Athlete onboarding complete/i).waitFor({ state: 'visible', timeout: 20_000 }),
    ]);

    if (!/\/PulseCheck\/team-workspace/i.test(page.url())) {
      const currentUrl = new URL(page.url());
      const organizationId = currentUrl.searchParams.get('organizationId') || '';
      const teamId = currentUrl.searchParams.get('teamId') || '';
      await page.goto(
        `/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForStableAppFrame(page);
    }

    await expect(page).toHaveURL(/\/PulseCheck\/team-workspace/i, { timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });

    return { context, page };
  } catch (error) {
    await context.close().catch(() => null);
    throw error;
  }
}

test.describe('PulseCheck onboarding and team workspace', () => {
  test('@smoke internal provisioning surface loads', async ({ page }) => {
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');

    await ensureAdminSession(page, '/admin/pulsecheckProvisioning');
    await expect(page.getByRole('heading', { name: /PulseCheck Provisioning/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Connected Provisioning Map/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /^Create Organization$/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /^Create Team$/i })).toBeVisible({ timeout: 15_000 });
  });

  test('@smoke legacy roster migration surface loads', async ({ page }) => {
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');

    await ensureAdminSession(page, legacyRosterMigrationPath());
    await expect(page.getByRole('heading', { name: /Legacy coach roster cleanup/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Migration rules/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible({ timeout: 15_000 });
  });

  test('@smoke post-activation surface loads for an active team admin context', async ({ page }) => {
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');

    const workspaceContext = await getPulseCheckWorkspaceContext(page);
    await ensureAdminSession(page, postActivationPath(workspaceContext));
    await expect(page.getByRole('heading', { name: /Shape how you operate inside/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/1\. Complete Your Profile/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/2\. Invite Adults/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/3\. Invite Athletes/i)).toBeVisible({ timeout: 15_000 });
  });

  test('@smoke team workspace loads core roster and invite controls', async ({ page }) => {
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');

    const workspaceContext = await getPulseCheckWorkspaceContext(page);
    await ensureAdminSession(page, teamWorkspacePath(workspaceContext));
    await expect(page.getByText(/^PulseCheck Team Workspace$/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Migration Status/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Staff and Adult Team Members/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Athlete Roster/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Athlete Invite Controls/i)).toBeVisible({ timeout: 15_000 });
  });

  test('team admin can create and revoke an athlete invite from the workspace', async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const workspaceContext = await getPulseCheckWorkspaceContext(page);
    await ensureAdminSession(page, teamWorkspacePath(workspaceContext));
    await expect(page.getByText(/Athlete Invite Controls/i)).toBeVisible({ timeout: 15_000 });

    const uniqueSuffix = Date.now().toString().slice(-6);
    const athleteName = `E2E Athlete ${uniqueSuffix}`;
    const athleteEmail = `e2e-athlete-${uniqueSuffix}@pulsecheck.test`;

    await page.getByPlaceholder('Athlete name').fill(athleteName);
    await page.getByPlaceholder('athlete@school.edu').fill(athleteEmail);
    await page.getByRole('button', { name: /Invite Athlete/i }).click();

    await expect(page.getByText(/Athlete invite link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const inviteCard = getWorkspaceAthleteInviteCard(page, athleteEmail);
    await expect(inviteCard).toBeVisible({ timeout: 15_000 });

    await inviteCard.getByRole('button', { name: /Revoke/i }).click();
    await expect(page.getByText(/Invite link revoked/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('div').filter({ hasText: athleteEmail })).toHaveCount(0, { timeout: 15_000 });
  });

  test('adult invite can be redeemed end-to-end into member setup and workspace', async ({ browser, page }) => {
    test.setTimeout(180_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const workspaceContext = await getPulseCheckWorkspaceContext(page);
    await ensureAdminSession(page, postActivationPath(workspaceContext));
    await expect(page.getByText(/2\. Invite Adults/i)).toBeVisible({ timeout: 15_000 });

    const uniqueSuffix = Date.now().toString().slice(-6);
    const adultName = `E2E Coach ${uniqueSuffix}`;
    const adultTitle = 'Assistant Coach';
    const adultEmail = `e2e-coach-${uniqueSuffix}@pulsecheck.test`;
    const adultUsername = `e2ecoach${uniqueSuffix}`;
    const password = `PulseCheck!${uniqueSuffix}`;

    await page.getByRole('combobox', { name: /^Role$/ }).selectOption('coach');
    await page.getByPlaceholder('Jordan Ellis').fill(adultName);
    await page.getByPlaceholder('Associate Head Coach').fill(adultTitle);
    await page.getByPlaceholder('coach@school.edu').fill(adultEmail);
    await page.getByRole('button', { name: /Generate Adult Invite Link/i }).click();

    await expect(page.getByText(/Adult onboarding link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const inviteCard = getPostActivationAdultInviteCard(page, adultName);
    await expect(inviteCard).toBeVisible({ timeout: 15_000 });
    const inviteUrl = await extractInviteUrl(inviteCard);

    const { context } = await redeemAdultInvite(browser, inviteUrl, {
      email: adultEmail,
      name: adultName,
      title: adultTitle,
      username: adultUsername,
      password,
    });

    try {
      await page.goto(teamWorkspacePath(workspaceContext), { waitUntil: 'domcontentloaded' });
      const memberCard = getAdultMemberCard(page, adultEmail);
      await expect(memberCard).toBeVisible({ timeout: 20_000 });
      await expect(memberCard.getByText(new RegExp(adultTitle, 'i'))).toBeVisible({ timeout: 20_000 });
    } finally {
      await context.close();
    }
  });

  test('athlete invite can be redeemed through consent and baseline onboarding', async ({ browser, page }) => {
    test.setTimeout(180_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const workspaceContext = await getPulseCheckWorkspaceContext(page);
    await ensureAdminSession(page, teamWorkspacePath(workspaceContext));
    await expect(page.getByText(/Athlete Invite Controls/i)).toBeVisible({ timeout: 15_000 });

    const uniqueSuffix = `${Date.now()}`.slice(-6);
    const athleteName = `E2E Athlete ${uniqueSuffix}`;
    const athleteEmail = `e2e-athlete-full-${uniqueSuffix}@pulsecheck.test`;
    const athleteUsername = `e2eath${uniqueSuffix}`;
    const password = `PulseCheck!${uniqueSuffix}`;

    await page.getByPlaceholder('Athlete name').fill(athleteName);
    await page.getByPlaceholder('athlete@school.edu').fill(athleteEmail);
    await page.getByRole('button', { name: /Invite Athlete/i }).click();

    await expect(page.getByText(/Athlete invite link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const inviteCard = getWorkspaceAthleteInviteCard(page, athleteEmail);
    await expect(inviteCard).toBeVisible({ timeout: 15_000 });
    const inviteUrl = await extractInviteUrl(inviteCard);

    const { context } = await redeemAthleteInvite(browser, inviteUrl, {
      email: athleteEmail,
      name: athleteName,
      username: athleteUsername,
      password,
    });

    try {
      await page.goto(teamWorkspacePath(workspaceContext), { waitUntil: 'domcontentloaded' });
      const athleteRosterCard = getAthleteRosterCard(page, athleteEmail);
      await expect(athleteRosterCard).toBeVisible({ timeout: 20_000 });
      await expect(athleteRosterCard).toContainText(/Ready/i);
    } finally {
      await context.close();
    }
  });

  test('assigned athlete scope restricts a coach to only the athletes they were granted', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const uniqueSuffix = Date.now().toString().slice(-6);
    const coachName = `E2E Scoped Coach ${uniqueSuffix}`;
    const coachTitle = 'Scoped Coach';
    const coachEmail = `e2e-scoped-coach-${uniqueSuffix}@pulsecheck.test`;
    const coachUsername = `e2escopedcoach${uniqueSuffix}`;
    const coachPassword = `PulseCheck!${uniqueSuffix}`;

    const athleteOneName = `E2E Scoped Athlete A ${uniqueSuffix}`;
    const athleteOneEmail = `e2e-scoped-athlete-a-${uniqueSuffix}@pulsecheck.test`;
    const athleteOneUsername = `e2eatha${uniqueSuffix}`;
    const athleteOnePassword = `PulseCheck!${uniqueSuffix}A`;

    const athleteTwoName = `E2E Scoped Athlete B ${uniqueSuffix}`;
    const athleteTwoEmail = `e2e-scoped-athlete-b-${uniqueSuffix}@pulsecheck.test`;
    const athleteTwoUsername = `e2eathb${uniqueSuffix}`;
    const athleteTwoPassword = `PulseCheck!${uniqueSuffix}B`;

    const workspaceContext = await getPulseCheckWorkspaceContext(page);
    await ensureAdminSession(page, postActivationPath(workspaceContext));

    await page.getByRole('combobox', { name: /^Role$/ }).selectOption('coach');
    await page.getByPlaceholder('Jordan Ellis').fill(coachName);
    await page.getByPlaceholder('Associate Head Coach').fill(coachTitle);
    await page.getByPlaceholder('coach@school.edu').fill(coachEmail);
    await page.getByRole('button', { name: /Generate Adult Invite Link/i }).click();
    await expect(page.getByText(/Adult onboarding link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const coachInviteCard = getPostActivationAdultInviteCard(page, coachName);
    const coachInviteUrl = await extractInviteUrl(coachInviteCard);

    await page.goto(teamWorkspacePath(workspaceContext), { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('Athlete name').fill(athleteOneName);
    await page.getByPlaceholder('athlete@school.edu').fill(athleteOneEmail);
    await page.getByRole('button', { name: /Invite Athlete/i }).click();
    await expect(page.getByText(/Athlete invite link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const athleteOneInviteCard = getWorkspaceAthleteInviteCard(page, athleteOneEmail);
    const athleteOneInviteUrl = await extractInviteUrl(athleteOneInviteCard);

    await page.getByPlaceholder('Athlete name').fill(athleteTwoName);
    await page.getByPlaceholder('athlete@school.edu').fill(athleteTwoEmail);
    await page.getByRole('button', { name: /Invite Athlete/i }).click();
    await expect(page.getByText(/Athlete invite link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const athleteTwoInviteCard = getWorkspaceAthleteInviteCard(page, athleteTwoEmail);
    const athleteTwoInviteUrl = await extractInviteUrl(athleteTwoInviteCard);

    const { context: coachContext, page: coachPage } = await redeemAdultInvite(browser, coachInviteUrl, {
      email: coachEmail,
      name: coachName,
      title: coachTitle,
      username: coachUsername,
      password: coachPassword,
    });

    const { context: athleteOneContext } = await redeemAthleteInvite(browser, athleteOneInviteUrl, {
      email: athleteOneEmail,
      name: athleteOneName,
      username: athleteOneUsername,
      password: athleteOnePassword,
    });

    const { context: athleteTwoContext } = await redeemAthleteInvite(browser, athleteTwoInviteUrl, {
      email: athleteTwoEmail,
      name: athleteTwoName,
      username: athleteTwoUsername,
      password: athleteTwoPassword,
    });

    try {
      await page.goto(teamWorkspacePath(workspaceContext), { waitUntil: 'domcontentloaded' });
      const coachCard = getAdultMemberCard(page, coachEmail);
      await expect(coachCard).toBeVisible({ timeout: 20_000 });
      await coachCard.locator('select').first().selectOption('assigned');
      await expect(page.getByText(/Roster visibility updated/i)).toBeVisible({ timeout: 15_000 });
      await coachCard.getByRole('button', { name: /Assign Athletes|Manage Assigned/i }).click();

      await expect(page.getByText(/Assign Athlete Scope/i)).toBeVisible({ timeout: 15_000 });

      const athleteOneLabel = page.locator('label').filter({ hasText: athleteOneEmail }).first();
      await athleteOneLabel.locator('input[type="checkbox"]').check();
      const athleteTwoLabel = page.locator('label').filter({ hasText: athleteTwoEmail }).first();
      await expect(athleteTwoLabel.locator('input[type="checkbox"]')).not.toBeChecked();

      await page.getByRole('button', { name: /Save Assigned Scope/i }).click();
      await expect(page.getByText(/Assigned athlete scope updated/i)).toBeVisible({ timeout: 15_000 });

      await coachPage.goto(teamWorkspacePath(workspaceContext), { waitUntil: 'domcontentloaded' });
      await expect(coachPage.getByText(/Roster Visibility Scope/i)).toBeVisible({ timeout: 20_000 });
      await expect(coachPage.getByText(/Current scope: Assigned athletes only/i)).toBeVisible({ timeout: 20_000 });
      await expect(coachPage.getByText(/Visible athletes right now: 1/i)).toBeVisible({ timeout: 20_000 });
      await expect(coachPage.getByText(athleteOneEmail)).toBeVisible({ timeout: 20_000 });
      await expect(coachPage.getByText(athleteTwoEmail)).toHaveCount(0);
    } finally {
      await coachContext.close();
      await athleteOneContext.close();
      await athleteTwoContext.close();
    }
  });

  test('invite policy matrix gates athlete invite creation by role', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const uniqueSuffix = Date.now().toString().slice(-6);

    const coachName = `E2E Matrix Coach ${uniqueSuffix}`;
    const coachTitle = 'Matrix Coach';
    const coachEmail = `e2e-matrix-coach-${uniqueSuffix}@pulsecheck.test`;
    const coachUsername = `e2ematrixcoach${uniqueSuffix}`;
    const coachPassword = `PulseCheck!${uniqueSuffix}`;

    const staffName = `E2E Matrix Staff ${uniqueSuffix}`;
    const staffTitle = 'Matrix Staff';
    const staffEmail = `e2e-matrix-staff-${uniqueSuffix}@pulsecheck.test`;
    const staffUsername = `e2ematrixstaff${uniqueSuffix}`;
    const staffPassword = `PulseCheck!${uniqueSuffix}S`;

    const workspaceContext = await getPulseCheckWorkspaceContext(page);
    await ensureAdminSession(page, postActivationPath(workspaceContext));

    await page.getByRole('combobox', { name: /^Role$/ }).selectOption('coach');
    await page.getByPlaceholder('Jordan Ellis').fill(coachName);
    await page.getByPlaceholder('Associate Head Coach').fill(coachTitle);
    await page.getByPlaceholder('coach@school.edu').fill(coachEmail);
    await page.getByRole('button', { name: /Generate Adult Invite Link/i }).click();
    await expect(page.getByText(/Adult onboarding link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const coachInviteUrl = await extractInviteUrl(getPostActivationAdultInviteCard(page, coachName));

    await page.getByRole('combobox', { name: /^Role$/ }).selectOption('performance-staff');
    await page.getByPlaceholder('Jordan Ellis').fill(staffName);
    await page.getByPlaceholder('Associate Head Coach').fill(staffTitle);
    await page.getByPlaceholder('coach@school.edu').fill(staffEmail);
    await page.getByRole('button', { name: /Generate Adult Invite Link/i }).click();
    await expect(page.getByText(/Adult onboarding link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const staffInviteUrl = await extractInviteUrl(getPostActivationAdultInviteCard(page, staffName));

    const { context: coachContext, page: coachPage } = await redeemAdultInvite(browser, coachInviteUrl, {
      email: coachEmail,
      name: coachName,
      title: coachTitle,
      username: coachUsername,
      password: coachPassword,
    });
    const { context: staffContext, page: staffPage } = await redeemAdultInvite(browser, staffInviteUrl, {
      email: staffEmail,
      name: staffName,
      title: staffTitle,
      username: staffUsername,
      password: staffPassword,
    });

    try {
      await page.goto(teamWorkspacePath(workspaceContext), { waitUntil: 'domcontentloaded' });

      const adminPolicySelect = page.getByLabel('Team invite policy');
      await expect(adminPolicySelect).toBeVisible({ timeout: 20_000 });

      const assertPolicyState = async (
        policy: 'admin-only' | 'admin-and-staff' | 'admin-staff-and-coaches',
        expectations: {
          coachCanInvite: boolean;
          staffCanInvite: boolean;
        }
      ) => {
        await adminPolicySelect.selectOption(policy);
        await expect(page.getByText(/Team invite policy updated/i)).toBeVisible({ timeout: 15_000 });

        await coachPage.goto(teamWorkspacePath(workspaceContext), { waitUntil: 'domcontentloaded' });
        await staffPage.goto(teamWorkspacePath(workspaceContext), { waitUntil: 'domcontentloaded' });

        if (expectations.coachCanInvite) {
          await expect(coachPage.getByRole('button', { name: /Invite Athlete/i })).toBeEnabled({ timeout: 15_000 });
          await expect(coachPage.getByText(/does not currently allow athlete invite creation/i)).toHaveCount(0);
        } else {
          await expect(coachPage.getByText(/does not currently allow athlete invite creation/i)).toBeVisible({ timeout: 15_000 });
        }

        if (expectations.staffCanInvite) {
          await expect(staffPage.getByRole('button', { name: /Invite Athlete/i })).toBeEnabled({ timeout: 15_000 });
          await expect(staffPage.getByText(/does not currently allow athlete invite creation/i)).toHaveCount(0);
        } else {
          await expect(staffPage.getByText(/does not currently allow athlete invite creation/i)).toBeVisible({ timeout: 15_000 });
        }
      };

      await assertPolicyState('admin-only', {
        coachCanInvite: false,
        staffCanInvite: false,
      });

      await assertPolicyState('admin-and-staff', {
        coachCanInvite: false,
        staffCanInvite: true,
      });

      await assertPolicyState('admin-staff-and-coaches', {
        coachCanInvite: true,
        staffCanInvite: true,
      });
    } finally {
      await coachContext.close();
      await staffContext.close();
    }
  });

  test('revoked athlete invite link returns a clean not-found state', async ({ browser, page }) => {
    test.setTimeout(120_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const workspaceContext = await getPulseCheckWorkspaceContext(page);
    await ensureAdminSession(page, teamWorkspacePath(workspaceContext));
    await expect(page.getByText(/Athlete Invite Controls/i)).toBeVisible({ timeout: 15_000 });

    const uniqueSuffix = Date.now().toString().slice(-6);
    const athleteName = `E2E Revoked Athlete ${uniqueSuffix}`;
    const athleteEmail = `e2e-revoked-athlete-${uniqueSuffix}@pulsecheck.test`;

    await page.getByPlaceholder('Athlete name').fill(athleteName);
    await page.getByPlaceholder('athlete@school.edu').fill(athleteEmail);
    await page.getByRole('button', { name: /Invite Athlete/i }).click();

    await expect(page.getByText(/Athlete invite link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const inviteCard = getWorkspaceAthleteInviteCard(page, athleteEmail);
    await expect(inviteCard).toBeVisible({ timeout: 15_000 });
    const inviteUrl = await extractInviteUrl(inviteCard);

    await inviteCard.getByRole('button', { name: /Revoke/i }).click();
    await expect(page.getByText(/Invite link revoked/i)).toBeVisible({ timeout: 15_000 });

    const { context, page: revokedPage } = await createIsolatedPage(browser);
    try {
      await revokedPage.goto(inviteUrl, { waitUntil: 'domcontentloaded' });
      await expect(revokedPage.getByText(/Page not found/i)).toBeVisible({ timeout: 20_000 });
    } finally {
      await context.close();
    }
  });

  test('target-email mismatch blocks a signed-in user from accepting another adult invite', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const workspaceContext = await getPulseCheckWorkspaceContext(page);
    await ensureAdminSession(page, postActivationPath(workspaceContext));

    const uniqueSuffix = Date.now().toString().slice(-6);
    const signedInAdultName = `E2E Signed Adult ${uniqueSuffix}`;
    const signedInAdultTitle = 'Signed In Coach';
    const signedInAdultEmail = `e2e-signed-adult-${uniqueSuffix}@pulsecheck.test`;
    const signedInAdultUsername = `e2esignedadult${uniqueSuffix}`;
    const signedInAdultPassword = `PulseCheck!${uniqueSuffix}`;

    const targetAdultName = `E2E Target Adult ${uniqueSuffix}`;
    const targetAdultTitle = 'Target Coach';
    const targetAdultEmail = `e2e-target-adult-${uniqueSuffix}@pulsecheck.test`;

    await page.getByRole('combobox', { name: /^Role$/ }).selectOption('coach');
    await page.getByPlaceholder('Jordan Ellis').fill(signedInAdultName);
    await page.getByPlaceholder('Associate Head Coach').fill(signedInAdultTitle);
    await page.getByPlaceholder('coach@school.edu').fill(signedInAdultEmail);
    await page.getByRole('button', { name: /Generate Adult Invite Link/i }).click();
    await expect(page.getByText(/Adult onboarding link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const signedInInviteUrl = await extractInviteUrl(getPostActivationAdultInviteCard(page, signedInAdultName));

    await page.getByRole('combobox', { name: /^Role$/ }).selectOption('coach');
    await page.getByPlaceholder('Jordan Ellis').fill(targetAdultName);
    await page.getByPlaceholder('Associate Head Coach').fill(targetAdultTitle);
    await page.getByPlaceholder('coach@school.edu').fill(targetAdultEmail);
    await page.getByRole('button', { name: /Generate Adult Invite Link/i }).click();
    await expect(page.getByText(/Adult onboarding link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const targetInviteUrl = await extractInviteUrl(getPostActivationAdultInviteCard(page, targetAdultName));

    const { context, page: signedInPage } = await redeemAdultInvite(browser, signedInInviteUrl, {
      email: signedInAdultEmail,
      name: signedInAdultName,
      title: signedInAdultTitle,
      username: signedInAdultUsername,
      password: signedInAdultPassword,
    });

    try {
      await signedInPage.goto(targetInviteUrl, { waitUntil: 'domcontentloaded' });
      await expect(signedInPage.getByText(new RegExp(`This invite is restricted to\\s*${targetAdultEmail}`, 'i'))).toBeVisible({
        timeout: 20_000,
      });
      await expect(signedInPage.getByRole('button', { name: /Sign Out/i })).toBeVisible({ timeout: 15_000 });
      await expect(signedInPage.getByRole('button', { name: /Accept Invite/i })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('regenerating an admin activation link invalidates the prior link for that recipient', async ({ browser, page }) => {
    test.setTimeout(180_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    await ensureAdminSession(page, '/admin/pulsecheckProvisioning');
    await openAdminOnboardingModal(page);

    const uniqueSuffix = Date.now().toString().slice(-6);
    const adminName = `E2E Extra Admin ${uniqueSuffix}`;
    const adminEmail = `e2e-extra-admin-${uniqueSuffix}@pulsecheck.test`;

    await addAdditionalAdminRecipient(page, adminName, adminEmail);

    const firstInviteUrl = await generateAdminActivationLink(page, adminEmail);
    const secondInviteUrl = await generateAdminActivationLink(page, adminEmail);

    expect(secondInviteUrl).not.toBe(firstInviteUrl);

    const { context: oldContext, page: oldLinkPage } = await createIsolatedPage(browser);
    try {
      await oldLinkPage.goto(firstInviteUrl, { waitUntil: 'domcontentloaded' });
      await expect(oldLinkPage.getByRole('heading', { name: /Page Not Found/i })).toBeVisible({ timeout: 20_000 });
    } finally {
      await oldContext.close();
    }

    const { context: newContext, page: newLinkPage } = await createIsolatedPage(browser);
    try {
      await newLinkPage.goto(secondInviteUrl, { waitUntil: 'domcontentloaded' });
      await expect(newLinkPage.getByRole('heading', { name: /Claim the organization handoff/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(newLinkPage.getByText(adminEmail)).toBeVisible({ timeout: 15_000 });
    } finally {
      await newContext.close();
    }
  });

  test('no-roster visibility leaves a non-admin adult with zero visible athletes', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const uniqueSuffix = Date.now().toString().slice(-6);
    const staffName = `E2E No Scope Staff ${uniqueSuffix}`;
    const staffTitle = 'Support Specialist';
    const staffEmail = `e2e-no-scope-staff-${uniqueSuffix}@pulsecheck.test`;
    const staffUsername = `e2enoscopestaff${uniqueSuffix}`;
    const staffPassword = `PulseCheck!${uniqueSuffix}`;

    const athleteName = `E2E No Scope Athlete ${uniqueSuffix}`;
    const athleteEmail = `e2e-no-scope-athlete-${uniqueSuffix}@pulsecheck.test`;
    const athleteUsername = `e2enoscopeath${uniqueSuffix}`;
    const athletePassword = `PulseCheck!${uniqueSuffix}A`;

    const workspaceContext = await getPulseCheckWorkspaceContext(page);
    await ensureAdminSession(page, postActivationPath(workspaceContext));

    await page.getByRole('combobox', { name: /^Role$/ }).selectOption('support-staff');
    await page.getByPlaceholder('Jordan Ellis').fill(staffName);
    await page.getByPlaceholder('Associate Head Coach').fill(staffTitle);
    await page.getByPlaceholder('coach@school.edu').fill(staffEmail);
    await page.getByRole('button', { name: /Generate Adult Invite Link/i }).click();
    await expect(page.getByText(/Adult onboarding link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const staffInviteUrl = await extractInviteUrl(getPostActivationAdultInviteCard(page, staffName));

    await page.goto(teamWorkspacePath(workspaceContext), { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('Athlete name').fill(athleteName);
    await page.getByPlaceholder('athlete@school.edu').fill(athleteEmail);
    await page.getByRole('button', { name: /Invite Athlete/i }).click();
    await expect(page.getByText(/Athlete invite link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const athleteInviteUrl = await extractInviteUrl(getWorkspaceAthleteInviteCard(page, athleteEmail));

    const { context: staffContext, page: staffPage } = await redeemAdultInvite(browser, staffInviteUrl, {
      email: staffEmail,
      name: staffName,
      title: staffTitle,
      username: staffUsername,
      password: staffPassword,
    });

    const { context: athleteContext } = await redeemAthleteInvite(browser, athleteInviteUrl, {
      email: athleteEmail,
      name: athleteName,
      username: athleteUsername,
      password: athletePassword,
    });

    try {
      await page.goto(teamWorkspacePath(workspaceContext), { waitUntil: 'domcontentloaded' });
      const staffCard = getAdultMemberCard(page, staffEmail);
      await expect(staffCard).toBeVisible({ timeout: 20_000 });
      await staffCard.locator('select').first().selectOption('none');
      await expect(page.getByText(/Roster visibility updated/i)).toBeVisible({ timeout: 15_000 });

      await staffPage.goto(teamWorkspacePath(workspaceContext), { waitUntil: 'domcontentloaded' });
      await expect(staffPage.getByText(/Current scope: No roster visibility/i)).toBeVisible({ timeout: 20_000 });
      await expect(staffPage.getByText(/Visible athletes right now: 0/i)).toBeVisible({ timeout: 20_000 });
      await expect(staffPage.getByText(athleteEmail)).toHaveCount(0);
      await expect(staffPage.getByText(/No athletes are connected to this team yet/i)).toBeVisible({ timeout: 20_000 });
    } finally {
      await staffContext.close();
      await athleteContext.close();
    }
  });

  test('legacy roster migration creates a PulseCheck org and team for an unmapped legacy coach roster', async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const namespace = `${pulseCheckNamespace}-legacy-new-${Date.now().toString().slice(-6)}`;

    await ensureAdminSession(page, legacyRosterMigrationPath());

    let fixture: Awaited<ReturnType<typeof seedLegacyRosterFixture>> | null = null;
    try {
      fixture = await seedLegacyRosterFixture(page, namespace, 'new-container');
      await page.goto(legacyRosterMigrationPath(), { waitUntil: 'domcontentloaded' });
      const customOrganizationName = `[E2E] ${namespace} Organization`;
      const customTeamName = `[E2E] ${namespace} Team`;

      const candidateCard = page.getByTestId(`legacy-roster-card-${fixture.coachId}`);

      await expect(candidateCard).toBeVisible({ timeout: 20_000 });
      await expect(candidateCard.getByText(/New organization \+ team will be created/i)).toBeVisible({ timeout: 15_000 });
      await candidateCard.getByLabel(`Organization name for ${fixture.coachDisplayName}`).fill(customOrganizationName);
      await candidateCard.getByLabel(`Team name for ${fixture.coachDisplayName}`).fill(customTeamName);

      await candidateCard.getByRole('button', { name: /Migrate Roster/i }).click();

      await expect(page.getByText(/Recent migration results/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Created org/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Created team/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(customOrganizationName)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(customTeamName)).toBeVisible({ timeout: 20_000 });
      await expect(candidateCard).toHaveCount(0);

      const inspection = await inspectLegacyRosterFixture(page, namespace);
      expect(inspection?.legacyOrganizations?.length).toBe(1);
      expect(inspection?.legacyTeams?.length).toBe(1);
      expect(inspection?.legacyAthleteMemberships?.length).toBe(2);
      expect(inspection?.legacyOrganizations?.[0]?.displayName).toBe(customOrganizationName);
      expect(inspection?.legacyTeams?.[0]?.displayName).toBe(customTeamName);
      expect(inspection?.migrationEntries?.length).toBe(1);
      expect(inspection?.migrationEntries?.[0]?.organizationName).toBe(customOrganizationName);
      expect(inspection?.migrationEntries?.[0]?.teamName).toBe(customTeamName);
      expect(inspection?.migrationEntries?.[0]?.createdOrganization).toBe(true);
      expect(inspection?.migrationEntries?.[0]?.createdTeam).toBe(true);
      expect(inspection?.migrationEntries?.[0]?.migratedAthleteCount).toBe(2);
      expect(inspection?.migrationEntries?.[0]?.alreadyPresentAthleteCount).toBe(0);
    } finally {
      await cleanupLegacyRosterFixture(page, namespace);
    }
  });

  test('legacy roster migration reuses an existing PulseCheck team and only backfills missing athletes', async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const namespace = `${pulseCheckNamespace}-legacy-existing-${Date.now().toString().slice(-6)}`;

    await ensureAdminSession(page, legacyRosterMigrationPath());

    try {
      const fixture = await seedLegacyRosterFixture(page, namespace, 'existing-team');
      await page.goto(legacyRosterMigrationPath(), { waitUntil: 'domcontentloaded' });

      const candidateCard = page.getByTestId(`legacy-roster-card-${fixture.coachId}`);

      await expect(candidateCard).toBeVisible({ timeout: 20_000 });
      await expect(candidateCard.getByText(fixture.existingOrganizationName, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(candidateCard.getByText(fixture.existingTeamName, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(candidateCard.getByText(/1 to add/i)).toBeVisible({ timeout: 15_000 });
      await expect(candidateCard.getByText(/1 already present/i)).toBeVisible({ timeout: 15_000 });

      await candidateCard.getByRole('button', { name: /Migrate Roster/i }).click();
      await expect(page.getByText(/Recent migration results/i)).toBeVisible({ timeout: 20_000 });

      const inspection = await inspectLegacyRosterFixture(page, namespace);
      expect(inspection?.explicitExistingOrganization?.id).toBe(fixture.existingOrganizationId);
      expect(inspection?.explicitExistingTeam?.id).toBe(fixture.existingTeamId);
      expect(inspection?.explicitCoachMembership?.role).toBe('coach');
      expect(inspection?.explicitAthleteOneMembership?.role).toBe('athlete');
      expect(inspection?.explicitAthleteTwoMembership?.role).toBe('athlete');
      expect(inspection?.migrationEntries?.length).toBe(1);
      expect(inspection?.migrationEntries?.[0]?.createdOrganization).toBe(false);
      expect(inspection?.migrationEntries?.[0]?.createdTeam).toBe(false);
      expect(inspection?.migrationEntries?.[0]?.migratedAthleteCount).toBe(1);
      expect(inspection?.migrationEntries?.[0]?.alreadyPresentAthleteCount).toBe(1);
    } finally {
      await cleanupLegacyRosterFixture(page, namespace);
    }
  });
});
