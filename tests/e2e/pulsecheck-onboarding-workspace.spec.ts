import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { existsSync } from 'fs';
import path from 'path';

const defaultStorageStatePath = path.resolve(process.cwd(), '.playwright/admin-storage-state.json');
const hasAuthState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE) || existsSync(defaultStorageStatePath);
const remoteLoginToken = process.env.PLAYWRIGHT_REMOTE_LOGIN_TOKEN;
const allowWriteTests = process.env.PLAYWRIGHT_ALLOW_WRITE_TESTS === 'true';
const pulseCheckOrganizationId = process.env.PLAYWRIGHT_PULSECHECK_ORG_ID || '';
const pulseCheckTeamId = process.env.PLAYWRIGHT_PULSECHECK_TEAM_ID || '';

async function ensureAdminSession(page: Page, nextPath: string) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:3000' });
  await page.addInitScript(() => {
    window.localStorage.setItem('forceDevFirebase', 'true');
    window.localStorage.setItem('pulse_has_seen_marketing', 'true');
  });

  if (remoteLoginToken) {
    await page.goto(`/remote-login?token=${encodeURIComponent(remoteLoginToken)}&next=${encodeURIComponent(nextPath)}`);
    return;
  }

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const useWebAppButton = page.getByRole('button', { name: /Use Web App/i });
  if (await useWebAppButton.isVisible().catch(() => false)) {
    await useWebAppButton.click().catch(() => {});
    await page.waitForTimeout(1500);
  }

  await page.goto(nextPath, { waitUntil: 'domcontentloaded' });
}

function teamWorkspacePath() {
  return `/PulseCheck/team-workspace?organizationId=${encodeURIComponent(pulseCheckOrganizationId)}&teamId=${encodeURIComponent(pulseCheckTeamId)}`;
}

function postActivationPath() {
  return `/PulseCheck/post-activation?organizationId=${encodeURIComponent(pulseCheckOrganizationId)}&teamId=${encodeURIComponent(pulseCheckTeamId)}`;
}

async function createIsolatedPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:3000' });
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
  return match[0];
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
    .locator('div')
    .filter({ has: page.getByText(email, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: /Assign Athletes|Manage Assigned/i }) })
    .last();
}

function getAthleteRosterCard(page: Page, email: string) {
  return page
    .locator('div')
    .filter({ has: page.getByText(email, { exact: true }) })
    .filter({ has: page.getByText(/TEAM MEMBERSHIP/i) })
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
  const recipientCard = page.locator('div').filter({ hasText: email }).last();
  await expect(recipientCard).toBeVisible({ timeout: 15_000 });

  const generateButton = recipientCard.getByRole('button', { name: /Generate Link|Regenerate Link/i });
  await generateButton.click();

  await expect(recipientCard.getByText(/http:\/\/localhost:3000\/pulsecheck\/admin-activation\//i)).toBeVisible({
    timeout: 20_000,
  });

  return extractInviteUrl(recipientCard);
}

async function redeemAdultInvite(
  browser: Browser,
  inviteUrl: string,
  {
    name,
    title,
    username,
    password,
  }: {
    name: string;
    title: string;
    username: string;
    password: string;
  }
) {
  const { context, page } = await createIsolatedPage(browser);

  try {
    await page.goto(inviteUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Join/i })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.getByRole('button', { name: /Create Account and Join/i }).click();

    await expect(page.getByText(/Your team access is live/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('link', { name: /Continue/i }).click();

    await expect(page).toHaveURL(/\/PulseCheck\/member-setup/i, { timeout: 20_000 });
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: /Complete Member Setup/i }).click();

    await expect(page).toHaveURL(/\/PulseCheck\/team-workspace/i, { timeout: 20_000 });
    await expect(page.getByText(/Staff and Adult Team Members/i)).toBeVisible({ timeout: 20_000 });

    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function redeemAthleteInvite(
  browser: Browser,
  inviteUrl: string,
  {
    name,
    username,
    password,
  }: {
    name: string;
    username: string;
    password: string;
  }
) {
  const { context, page } = await createIsolatedPage(browser);

  try {
    await page.goto(inviteUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Join/i })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.getByRole('button', { name: /Create Account and Join/i }).click();

    await expect(page.getByText(/Your team access is live/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('link', { name: /Continue/i }).click();

    await expect(page).toHaveURL(/\/PulseCheck\/athlete-onboarding/i, { timeout: 20_000 });
    await page.getByLabel('Your Name').fill(name);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Complete Athlete Onboarding/i }).click();

    await expect(page).toHaveURL(/\/PulseCheck\/team-workspace/i, { timeout: 20_000 });
    await expect(page.getByText(/Athlete Roster/i)).toBeVisible({ timeout: 20_000 });

    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

test.describe('PulseCheck onboarding and team workspace', () => {
  test('internal provisioning surface loads', async ({ page }) => {
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');

    await ensureAdminSession(page, '/admin/pulsecheckProvisioning');
    await expect(page.getByRole('heading', { name: /PulseCheck Provisioning/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Connected Provisioning Map/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /^Create Organization$/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /^Create Team$/i })).toBeVisible({ timeout: 15_000 });
  });

  test('post-activation surface loads for an active team admin context', async ({ page }) => {
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!pulseCheckOrganizationId || !pulseCheckTeamId, 'Requires PLAYWRIGHT_PULSECHECK_ORG_ID and PLAYWRIGHT_PULSECHECK_TEAM_ID.');

    await ensureAdminSession(page, postActivationPath());
    await expect(page.getByRole('heading', { name: /Shape how you operate inside/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/1\. Complete Your Profile/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/2\. Invite Adults/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/3\. Invite Athletes/i)).toBeVisible({ timeout: 15_000 });
  });

  test('team workspace loads core roster and invite controls', async ({ page }) => {
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!pulseCheckOrganizationId || !pulseCheckTeamId, 'Requires PLAYWRIGHT_PULSECHECK_ORG_ID and PLAYWRIGHT_PULSECHECK_TEAM_ID.');

    await ensureAdminSession(page, teamWorkspacePath());
    await expect(page.getByText(/^PulseCheck Team Workspace$/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Migration Status/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Staff and Adult Team Members/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Athlete Roster/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Athlete Invite Controls/i)).toBeVisible({ timeout: 15_000 });
  });

  test('team admin can create and revoke an athlete invite from the workspace', async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!pulseCheckOrganizationId || !pulseCheckTeamId, 'Requires PLAYWRIGHT_PULSECHECK_ORG_ID and PLAYWRIGHT_PULSECHECK_TEAM_ID.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    await ensureAdminSession(page, teamWorkspacePath());
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
    test.skip(!pulseCheckOrganizationId || !pulseCheckTeamId, 'Requires PLAYWRIGHT_PULSECHECK_ORG_ID and PLAYWRIGHT_PULSECHECK_TEAM_ID.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    await ensureAdminSession(page, postActivationPath());
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
      name: adultName,
      title: adultTitle,
      username: adultUsername,
      password,
    });

    try {
      await page.goto(teamWorkspacePath(), { waitUntil: 'domcontentloaded' });
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
    test.skip(!pulseCheckOrganizationId || !pulseCheckTeamId, 'Requires PLAYWRIGHT_PULSECHECK_ORG_ID and PLAYWRIGHT_PULSECHECK_TEAM_ID.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    await ensureAdminSession(page, teamWorkspacePath());
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
      name: athleteName,
      username: athleteUsername,
      password,
    });

    try {
      await page.goto(teamWorkspacePath(), { waitUntil: 'domcontentloaded' });
      const athleteRosterCard = getAthleteRosterCard(page, athleteEmail);
      await expect(athleteRosterCard).toBeVisible({ timeout: 20_000 });
      await expect(athleteRosterCard.getByText(/^Ready$/)).toHaveCount(2, { timeout: 20_000 });
    } finally {
      await context.close();
    }
  });

  test('assigned athlete scope restricts a coach to only the athletes they were granted', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!pulseCheckOrganizationId || !pulseCheckTeamId, 'Requires PLAYWRIGHT_PULSECHECK_ORG_ID and PLAYWRIGHT_PULSECHECK_TEAM_ID.');
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

    await ensureAdminSession(page, postActivationPath());

    await page.getByRole('combobox', { name: /^Role$/ }).selectOption('coach');
    await page.getByPlaceholder('Jordan Ellis').fill(coachName);
    await page.getByPlaceholder('Associate Head Coach').fill(coachTitle);
    await page.getByPlaceholder('coach@school.edu').fill(coachEmail);
    await page.getByRole('button', { name: /Generate Adult Invite Link/i }).click();
    await expect(page.getByText(/Adult onboarding link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const coachInviteCard = getPostActivationAdultInviteCard(page, coachName);
    const coachInviteUrl = await extractInviteUrl(coachInviteCard);

    await page.goto(teamWorkspacePath(), { waitUntil: 'domcontentloaded' });
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
      name: coachName,
      title: coachTitle,
      username: coachUsername,
      password: coachPassword,
    });

    const { context: athleteOneContext } = await redeemAthleteInvite(browser, athleteOneInviteUrl, {
      name: athleteOneName,
      username: athleteOneUsername,
      password: athleteOnePassword,
    });

    const { context: athleteTwoContext } = await redeemAthleteInvite(browser, athleteTwoInviteUrl, {
      name: athleteTwoName,
      username: athleteTwoUsername,
      password: athleteTwoPassword,
    });

    try {
      await page.goto(teamWorkspacePath(), { waitUntil: 'domcontentloaded' });
      const coachCard = page.locator('div').filter({ hasText: coachEmail }).last();
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

      await coachPage.goto(teamWorkspacePath(), { waitUntil: 'domcontentloaded' });
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
    test.skip(!pulseCheckOrganizationId || !pulseCheckTeamId, 'Requires PLAYWRIGHT_PULSECHECK_ORG_ID and PLAYWRIGHT_PULSECHECK_TEAM_ID.');
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

    await ensureAdminSession(page, postActivationPath());

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
      name: coachName,
      title: coachTitle,
      username: coachUsername,
      password: coachPassword,
    });
    const { context: staffContext, page: staffPage } = await redeemAdultInvite(browser, staffInviteUrl, {
      name: staffName,
      title: staffTitle,
      username: staffUsername,
      password: staffPassword,
    });

    try {
      await page.goto(teamWorkspacePath(), { waitUntil: 'domcontentloaded' });

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

        await coachPage.goto(teamWorkspacePath(), { waitUntil: 'domcontentloaded' });
        await staffPage.goto(teamWorkspacePath(), { waitUntil: 'domcontentloaded' });

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
    test.skip(!pulseCheckOrganizationId || !pulseCheckTeamId, 'Requires PLAYWRIGHT_PULSECHECK_ORG_ID and PLAYWRIGHT_PULSECHECK_TEAM_ID.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    await ensureAdminSession(page, teamWorkspacePath());
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
      await expect(revokedPage.getByRole('heading', { name: /Page Not Found/i })).toBeVisible({ timeout: 20_000 });
      await expect(revokedPage.getByText(/404/i)).toBeVisible({ timeout: 20_000 });
    } finally {
      await context.close();
    }
  });

  test('target-email mismatch blocks a signed-in user from accepting another adult invite', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!pulseCheckOrganizationId || !pulseCheckTeamId, 'Requires PLAYWRIGHT_PULSECHECK_ORG_ID and PLAYWRIGHT_PULSECHECK_TEAM_ID.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    await ensureAdminSession(page, postActivationPath());

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
    test.skip(!pulseCheckOrganizationId || !pulseCheckTeamId, 'Requires PLAYWRIGHT_PULSECHECK_ORG_ID and PLAYWRIGHT_PULSECHECK_TEAM_ID.');
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

    await ensureAdminSession(page, postActivationPath());

    await page.getByRole('combobox', { name: /^Role$/ }).selectOption('support-staff');
    await page.getByPlaceholder('Jordan Ellis').fill(staffName);
    await page.getByPlaceholder('Associate Head Coach').fill(staffTitle);
    await page.getByPlaceholder('coach@school.edu').fill(staffEmail);
    await page.getByRole('button', { name: /Generate Adult Invite Link/i }).click();
    await expect(page.getByText(/Adult onboarding link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const staffInviteUrl = await extractInviteUrl(getPostActivationAdultInviteCard(page, staffName));

    await page.goto(teamWorkspacePath(), { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('Athlete name').fill(athleteName);
    await page.getByPlaceholder('athlete@school.edu').fill(athleteEmail);
    await page.getByRole('button', { name: /Invite Athlete/i }).click();
    await expect(page.getByText(/Athlete invite link created and copied/i)).toBeVisible({ timeout: 15_000 });
    const athleteInviteUrl = await extractInviteUrl(getWorkspaceAthleteInviteCard(page, athleteEmail));

    const { context: staffContext, page: staffPage } = await redeemAdultInvite(browser, staffInviteUrl, {
      name: staffName,
      title: staffTitle,
      username: staffUsername,
      password: staffPassword,
    });

    const { context: athleteContext } = await redeemAthleteInvite(browser, athleteInviteUrl, {
      name: athleteName,
      username: athleteUsername,
      password: athletePassword,
    });

    try {
      await page.goto(teamWorkspacePath(), { waitUntil: 'domcontentloaded' });
      const staffCard = page.locator('div').filter({ hasText: staffEmail }).last();
      await expect(staffCard).toBeVisible({ timeout: 20_000 });
      await staffCard.locator('select').first().selectOption('none');
      await expect(page.getByText(/Roster visibility updated/i)).toBeVisible({ timeout: 15_000 });

      await staffPage.goto(teamWorkspacePath(), { waitUntil: 'domcontentloaded' });
      await expect(staffPage.getByText(/Current scope: No roster visibility/i)).toBeVisible({ timeout: 20_000 });
      await expect(staffPage.getByText(/Visible athletes right now: 0/i)).toBeVisible({ timeout: 20_000 });
      await expect(staffPage.getByText(athleteEmail)).toHaveCount(0);
      await expect(staffPage.getByText(/No athletes are connected to this team yet/i)).toBeVisible({ timeout: 20_000 });
    } finally {
      await staffContext.close();
      await athleteContext.close();
    }
  });
});
