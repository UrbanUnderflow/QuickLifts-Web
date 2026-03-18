import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'fs';
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
const debugLogDir = path.resolve(process.cwd(), 'test-results', 'debug-logs');
let pulseCheckWorkspaceContextPromise: Promise<PulseCheckWorkspaceContext> | null = null;
const defaultSeededWorkspaceContext: PulseCheckWorkspaceContext = {
  organizationId: `${pulseCheckNamespace}-workspace-org`,
  teamId: `${pulseCheckNamespace}-workspace-team`,
};

interface PulseCheckWorkspaceContext {
  organizationId: string;
  teamId: string;
}

interface AuthIdentity {
  uid: string;
  email: string;
}

interface JourneyActors {
  namespace: string;
  workspaceContext: PulseCheckWorkspaceContext;
  coachName: string;
  coachEmail: string;
  athleteName: string;
  athleteEmail: string;
  coachContext: BrowserContext;
  coachPage: Page;
  athleteContext: BrowserContext;
  athletePage: Page;
  coachIdentity: AuthIdentity;
  athleteIdentity: AuthIdentity;
}

function writeDebugStep(namespace: string, step: string) {
  mkdirSync(debugLogDir, { recursive: true });
  appendFileSync(path.join(debugLogDir, `${namespace}.log`), `${new Date().toISOString()} ${step}\n`);
}

function attachPageDebugLogging(page: Page, namespace: string, label: string) {
  page.on('console', (message) => {
    const text = message.text().replace(/\s+/g, ' ').slice(0, 500);
    writeDebugStep(namespace, `${label}:console:${message.type()}:${text}`);
  });
  page.on('pageerror', (error) => {
    writeDebugStep(namespace, `${label}:pageerror:${error.message.replace(/\s+/g, ' ').slice(0, 500)}`);
  });
  page.on('requestfailed', (request) => {
    writeDebugStep(
      namespace,
      `${label}:requestfailed:${request.failure()?.errorText || 'unknown'}:${request.method()} ${request.url().slice(0, 300)}`
    );
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

async function waitForPulseE2EHarness(page: Page) {
  await page.waitForFunction(() => Boolean(window.__pulseE2E), undefined, { timeout: 20_000 });
}

async function getAuthenticatedIdentity(page: Page): Promise<AuthIdentity | null> {
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

      const adminIdentity = await getAuthenticatedIdentity(page);

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
    window.localStorage.setItem('pulsecheck_has_seen_nora_onboarding', 'true');
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
    await waitForStableAppFrame(page);
    await expect(page.getByRole('heading', { name: /Join/i })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.getByRole('button', { name: /Create Account and Join/i }).click();

    await expect(page.getByText(/Your team access is live/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('link', { name: /Continue/i }).click();
    await waitForStableAppFrame(page);

    await expect(page).toHaveURL(/\/PulseCheck\/member-setup/i, { timeout: 20_000 });
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: /Complete Member Setup/i }).click();

    await Promise.race([
      page.waitForURL(/\/PulseCheck\/team-workspace/i, { timeout: 20_000 }),
      page.getByText(/Your member setup is complete/i).waitFor({ state: 'visible', timeout: 20_000 }),
    ]);

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
    debugNamespace,
    name,
    username,
    password,
  }: {
    debugNamespace?: string;
    name: string;
    username: string;
    password: string;
  }
) {
  const { context, page } = await createIsolatedPage(browser);

  try {
    if (debugNamespace) writeDebugStep(debugNamespace, 'athlete-redeem:goto');
    await page.goto(inviteUrl, { waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);
    if (debugNamespace) writeDebugStep(debugNamespace, 'athlete-redeem:invite-open');
    await expect(page.getByRole('heading', { name: /Join/i })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.getByRole('button', { name: /Create Account and Join/i }).click();
    if (debugNamespace) writeDebugStep(debugNamespace, 'athlete-redeem:submitted');

    await expect(page.getByText(/Your team access is live/i)).toBeVisible({ timeout: 20_000 });
    if (debugNamespace) writeDebugStep(debugNamespace, 'athlete-redeem:success-visible');
    await page.getByRole('link', { name: /Continue/i }).click();
    await waitForStableAppFrame(page);
    if (debugNamespace) writeDebugStep(debugNamespace, `athlete-redeem:continued:${page.url()}`);

    await expect(page).toHaveURL(/\/PulseCheck\/athlete-onboarding/i, { timeout: 20_000 });
    if (debugNamespace) writeDebugStep(debugNamespace, 'athlete-redeem:onboarding-open');
    await page.getByLabel('Your Name').fill(name);
    await page.locator('label').filter({ hasText: /I agree to get started with PulseCheck for my team\./i }).click();
    await page.getByRole('button', { name: /Complete Athlete Onboarding/i }).click();
    if (debugNamespace) writeDebugStep(debugNamespace, 'athlete-redeem:onboarding-submitted');

    await Promise.race([
      page.waitForURL(/\/PulseCheck\/team-workspace/i, { timeout: 20_000 }),
      page.getByText(/Athlete onboarding complete/i).waitFor({ state: 'visible', timeout: 20_000 }),
    ]);
    if (debugNamespace) writeDebugStep(debugNamespace, `athlete-redeem:done:${page.url()}`);

    return { context, page };
  } catch (error) {
    if (debugNamespace) {
      const bodyText = await page.locator('body').innerText().catch(() => '');
      writeDebugStep(debugNamespace, `athlete-redeem:error-url:${page.url()}`);
      writeDebugStep(debugNamespace, `athlete-redeem:error-body:${bodyText.replace(/\s+/g, ' ').slice(0, 400)}`);
    }
    await context.close().catch(() => null);
    throw error;
  }
}

async function seedAthleteJourneyFixture(
  adminPage: Page,
  input: {
    namespace: string;
    adminIdentity: AuthIdentity;
    coachIdentity: AuthIdentity;
    coachEmail: string;
    athleteIdentity: AuthIdentity;
    athleteEmail: string;
  }
) {
  await waitForPulseE2EHarness(adminPage);

  await adminPage.evaluate(async ({ namespace, athleteUserId, coachUserId }) => {
    return window.__pulseE2E?.cleanupPulseCheckAthleteJourneyFixture({ namespace, athleteUserId, coachUserId });
  }, {
    namespace: input.namespace,
    athleteUserId: input.athleteIdentity.uid,
    coachUserId: input.coachIdentity.uid,
  });

  return adminPage.evaluate(async (payload) => {
    return window.__pulseE2E?.seedPulseCheckAthleteJourneyFixture(payload);
  }, {
    namespace: input.namespace,
    adminUserId: input.adminIdentity.uid,
    adminEmail: input.adminIdentity.email,
    coachUserId: input.coachIdentity.uid,
    coachEmail: input.coachEmail,
    athleteUserId: input.athleteIdentity.uid,
    athleteEmail: input.athleteEmail,
  });
}

async function inspectAthleteJourneyState(adminPage: Page, athleteUserId: string, coachUserId: string) {
  await waitForPulseE2EHarness(adminPage);
  return adminPage.evaluate(async ({ athleteUserId: athleteId, coachUserId: coachId }) => {
    return window.__pulseE2E?.inspectPulseCheckAthleteJourneyState({ athleteUserId: athleteId, coachUserId: coachId });
  }, { athleteUserId, coachUserId });
}

async function recordJourneyCompletion(adminPage: Page, athleteUserId: string, dailyAssignmentId: string) {
  await waitForPulseE2EHarness(adminPage);
  return adminPage.evaluate(async ({ athleteUserId: athleteId, dailyAssignmentId: assignmentId }) => {
    return window.__pulseE2E?.recordPulseCheckJourneyCompletion({ athleteUserId: athleteId, dailyAssignmentId: assignmentId });
  }, { athleteUserId, dailyAssignmentId });
}

async function upsertCoachNotifications(adminPage: Page, athleteUserId: string, coachUserId: string) {
  await waitForPulseE2EHarness(adminPage);
  return adminPage.evaluate(async ({ athleteUserId: athleteId, coachUserId: coachId }) => {
    return window.__pulseE2E?.upsertPulseCheckCoachNotifications({ athleteUserId: athleteId, coachUserId: coachId });
  }, { athleteUserId, coachUserId });
}

async function seedProtocolResponsivenessProfile(
  adminPage: Page,
  input: {
    athleteUserId: string;
    familyResponses?: Record<string, any>;
    variantResponses?: Record<string, any>;
    staleAt?: number;
  }
) {
  await waitForPulseE2EHarness(adminPage);
  return adminPage.evaluate(async (payload) => {
    return window.__pulseE2E?.seedPulseCheckProtocolResponsivenessProfile(payload);
  }, input);
}

async function seedProtocolAssignmentFixture(
  adminPage: Page,
  input: {
    namespace: string;
    athleteUserId: string;
    coachUserId: string;
    protocolId?: string;
    sourceDate?: string;
  }
) {
  await waitForPulseE2EHarness(adminPage);
  return adminPage.evaluate(async (payload) => {
    return window.__pulseE2E?.seedPulseCheckProtocolAssignmentFixture(payload);
  }, input);
}

async function cleanupAthleteJourneyFixture(adminPage: Page, namespace: string, athleteUserId: string, coachUserId: string) {
  await waitForPulseE2EHarness(adminPage);
  return adminPage.evaluate(async ({ namespace: fixtureNamespace, athleteUserId: athleteId, coachUserId: coachId }) => {
    return window.__pulseE2E?.cleanupPulseCheckAthleteJourneyFixture({
      namespace: fixtureNamespace,
      athleteUserId: athleteId,
      coachUserId: coachId,
    });
  }, { namespace, athleteUserId, coachUserId });
}

function humanizeAssignmentLabel(value?: string | null) {
  if (!value) return 'Nora task';
  return value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function preparePulseCheckApp(page: Page, section: 'today' | 'nora') {
  await page.goto(`/PulseCheck?web=1&section=${section}`, { waitUntil: 'domcontentloaded' });
  await waitForStableAppFrame(page);
  await page.evaluate(() => {
    window.localStorage.setItem('pulsecheck_has_seen_nora_onboarding', 'true');
    window.localStorage.setItem('pulse_has_seen_marketing', 'true');
  });
}

async function provisionJourneyActors(browser: Browser, adminPage: Page): Promise<JourneyActors> {
  const workspaceContext = await getPulseCheckWorkspaceContext(adminPage);
  const uniqueSuffix = Date.now().toString().slice(-6);
  const coachName = `E2E Journey Coach ${uniqueSuffix}`;
  const coachTitle = 'Journey Coach';
  const coachEmail = `e2e-journey-coach-${uniqueSuffix}@pulsecheck.test`;
  const coachUsername = `e2ejourneycoach${uniqueSuffix}`;
  const coachPassword = `PulseCheck!${uniqueSuffix}`;

  const athleteName = `E2E Journey Athlete ${uniqueSuffix}`;
  const athleteEmail = `e2e-journey-athlete-${uniqueSuffix}@pulsecheck.test`;
  const athleteUsername = `e2ejourneyath${uniqueSuffix}`;
  const athletePassword = `PulseCheck!${uniqueSuffix}A`;
  const namespace = `${pulseCheckNamespace}-journey-${uniqueSuffix}`;
  writeDebugStep(namespace, 'provision:start');

  await ensureAdminSession(adminPage, postActivationPath(workspaceContext));
  writeDebugStep(namespace, 'provision:admin-post-activation-ready');
  await pageGenerateAdultInvite(adminPage, coachName, coachTitle, coachEmail);
  const coachInviteUrl = await extractInviteUrl(getPostActivationAdultInviteCard(adminPage, coachName));
  writeDebugStep(namespace, 'provision:coach-invite-generated');

  await ensureAdminSession(adminPage, teamWorkspacePath(workspaceContext));
  writeDebugStep(namespace, 'provision:admin-team-workspace-ready');
  await pageGenerateAthleteInvite(adminPage, athleteName, athleteEmail);
  const athleteInviteUrl = await extractInviteUrl(getWorkspaceAthleteInviteCard(adminPage, athleteEmail));
  writeDebugStep(namespace, 'provision:athlete-invite-generated');

  const { context: coachContext, page: coachPage } = await redeemAdultInvite(browser, coachInviteUrl, {
    name: coachName,
    title: coachTitle,
    username: coachUsername,
    password: coachPassword,
  });
  attachPageDebugLogging(coachPage, namespace, 'coach-page');
  writeDebugStep(namespace, 'provision:coach-redeemed');

  const { context: athleteContext, page: athletePage } = await redeemAthleteInvite(browser, athleteInviteUrl, {
    debugNamespace: namespace,
    name: athleteName,
    username: athleteUsername,
    password: athletePassword,
  });
  attachPageDebugLogging(athletePage, namespace, 'athlete-page');
  writeDebugStep(namespace, 'provision:athlete-redeemed');

  const [coachIdentity, athleteIdentity] = await Promise.all([
    getAuthenticatedIdentity(coachPage),
    getAuthenticatedIdentity(athletePage),
  ]);

  if (!coachIdentity?.uid || !coachIdentity.email || !athleteIdentity?.uid || !athleteIdentity.email) {
    throw new Error('Unable to resolve coach or athlete auth identity after invite redemption.');
  }

  return {
    namespace,
    workspaceContext,
    coachName,
    coachEmail,
    athleteName,
    athleteEmail,
    coachContext,
    coachPage,
    athleteContext,
    athletePage,
    coachIdentity,
    athleteIdentity,
  };
}

async function pageGenerateAdultInvite(page: Page, name: string, title: string, email: string) {
  await page.getByRole('combobox', { name: /^Role$/ }).selectOption('coach');
  await page.getByPlaceholder('Jordan Ellis').fill(name);
  await page.getByPlaceholder('Associate Head Coach').fill(title);
  await page.getByPlaceholder('coach@school.edu').fill(email);
  await page.getByRole('button', { name: /Generate Adult Invite Link/i }).click();
  await expect(page.getByText(/Adult onboarding link created and copied/i)).toBeVisible({ timeout: 15_000 });
}

async function pageGenerateAthleteInvite(page: Page, athleteName: string, athleteEmail: string) {
  await page.getByPlaceholder('Athlete name').fill(athleteName);
  await page.getByPlaceholder('athlete@school.edu').fill(athleteEmail);
  await page.getByRole('button', { name: /Invite Athlete/i }).click();
  await expect(page.getByText(/Athlete invite link created and copied/i)).toBeVisible({ timeout: 15_000 });
}

test.describe('PulseCheck athlete journey', () => {
  test('athlete daily loop creates a shared Nora task and a post-session summary', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const actors = await provisionJourneyActors(browser, page);
    const adminIdentity = await getAuthenticatedIdentity(page);

    if (!adminIdentity?.uid || !adminIdentity.email) {
      throw new Error('Unable to resolve the authenticated admin identity.');
    }

    try {
      await seedAthleteJourneyFixture(page, {
        namespace: actors.namespace,
        adminIdentity,
        coachIdentity: actors.coachIdentity,
        coachEmail: actors.coachEmail,
        athleteIdentity: actors.athleteIdentity,
        athleteEmail: actors.athleteEmail,
      });
      writeDebugStep(actors.namespace, 'test1:fixture-seeded');

      await preparePulseCheckApp(actors.athletePage, 'today');
      writeDebugStep(actors.namespace, 'test1:athlete-today-open');
      await expect(actors.athletePage.getByRole('heading', { name: /Where is your head at today\?/i })).toBeVisible({ timeout: 20_000 });
      await actors.athletePage.getByRole('button', { name: /Locked In/i }).click();
      writeDebugStep(actors.namespace, 'test1:readiness-clicked');

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return state?.latestAssignment?.status || 'missing';
      }, { timeout: 30_000 }).toBe('assigned');

      await expect(actors.athletePage.getByRole('link', { name: /Start today'?s task/i }).first()).toBeVisible({ timeout: 20_000 });

      const assignmentState = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
      writeDebugStep(actors.namespace, 'test1:assignment-materialized');
      const latestAssignmentId = assignmentState?.latestAssignment?.id;
      if (!latestAssignmentId) {
        throw new Error('Expected a Nora daily assignment id after the athlete check-in.');
      }
      expect(assignmentState?.latestAssignment?.plannerAudit?.rankedCandidates?.length || 0).toBeGreaterThan(0);
      const assignmentLabel = humanizeAssignmentLabel(
        assignmentState?.latestAssignment?.simSpecId ||
          assignmentState?.latestAssignment?.legacyExerciseId ||
          assignmentState?.latestAssignment?.sessionType
      );

      await preparePulseCheckApp(actors.athletePage, 'nora');
      writeDebugStep(actors.namespace, 'test1:nora-open');
      await expect(actors.athletePage.getByText(/Today's Nora Task/i)).toBeVisible({ timeout: 20_000 });
      await expect(actors.athletePage.getByRole('heading', { name: new RegExp(assignmentLabel, 'i') })).toBeVisible({ timeout: 20_000 });

      await actors.athletePage.getByRole('button', { name: /Open today'?s task/i }).click();
      writeDebugStep(actors.namespace, 'test1:launch-clicked');
      await expect(actors.athletePage).toHaveURL(/\/mental-training/i, { timeout: 20_000 });
      writeDebugStep(actors.namespace, 'test1:mental-training-open');

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return state?.latestAssignment?.status || 'missing';
      }, { timeout: 20_000 }).toBe('started');

      await recordJourneyCompletion(page, actors.athleteIdentity.uid, latestAssignmentId);
      writeDebugStep(actors.namespace, 'test1:completion-recorded');
      await actors.athletePage.reload({ waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(actors.athletePage);

      const completedState = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
      expect(completedState?.latestAssignment?.status).toBe('completed');
      expect(completedState?.latestCompletion?.sessionSummary?.athleteHeadline).toBeTruthy();
      expect(completedState?.latestCompletion?.sessionSummary?.nextActionLabel).toBeTruthy();

      await preparePulseCheckApp(actors.athletePage, 'today');
      writeDebugStep(actors.namespace, 'test1:today-reopened');
      await expect(actors.athletePage.getByText(new RegExp(completedState.latestCompletion.sessionSummary.athleteHeadline, 'i'))).toBeVisible({ timeout: 20_000 });
    } finally {
      await cleanupAthleteJourneyFixture(page, actors.namespace, actors.athleteIdentity.uid, actors.coachIdentity.uid).catch(() => null);
      await actors.coachContext.close().catch(() => null);
      await actors.athleteContext.close().catch(() => null);
    }
  });

  test('protocol responsiveness changes bounded candidate ranking and protocol completion refreshes the athlete profile', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const actors = await provisionJourneyActors(browser, page);
    const adminIdentity = await getAuthenticatedIdentity(page);

    if (!adminIdentity?.uid || !adminIdentity.email) {
      throw new Error('Unable to resolve the authenticated admin identity.');
    }

    try {
      await seedAthleteJourneyFixture(page, {
        namespace: actors.namespace,
        adminIdentity,
        coachIdentity: actors.coachIdentity,
        coachEmail: actors.coachEmail,
        athleteIdentity: actors.athleteIdentity,
        athleteEmail: actors.athleteEmail,
      });
      writeDebugStep(actors.namespace, 'test3:fixture-seeded');

      const now = Date.now();
      await seedProtocolResponsivenessProfile(page, {
        athleteUserId: actors.athleteIdentity.uid,
        familyResponses: {
          'priming-confidence_priming': {
            protocolFamilyId: 'priming-confidence_priming',
            protocolFamilyLabel: 'Confidence Priming',
            responseDirection: 'positive',
            confidence: 'high',
            freshness: 'current',
            sampleSize: 6,
            positiveSignals: 5,
            neutralSignals: 1,
            negativeSignals: 0,
            stateFit: ['yellow_snapshot', 'protocol_then_sim', 'medium_readiness'],
            supportingEvidence: ['This athlete responds well to confidence-priming protocols in yellow readiness windows.'],
            lastObservedAt: now,
            lastConfirmedAt: now,
          },
          'priming-focus_narrowing': {
            protocolFamilyId: 'priming-focus_narrowing',
            protocolFamilyLabel: 'Focus Narrowing',
            responseDirection: 'negative',
            confidence: 'high',
            freshness: 'current',
            sampleSize: 5,
            positiveSignals: 0,
            neutralSignals: 1,
            negativeSignals: 4,
            stateFit: ['yellow_snapshot', 'protocol_then_sim', 'medium_readiness'],
            supportingEvidence: ['Focus-narrowing protocols have backfired in similar yellow readiness windows.'],
            lastObservedAt: now,
            lastConfirmedAt: now,
          },
        },
      });
      writeDebugStep(actors.namespace, 'test3:responsiveness-seeded');

      await preparePulseCheckApp(actors.athletePage, 'today');
      await expect(actors.athletePage.getByRole('heading', { name: /Where is your head at today\?/i })).toBeVisible({ timeout: 20_000 });
      await actors.athletePage.getByRole('button', { name: /Okay/i }).click();
      writeDebugStep(actors.namespace, 'test3:readiness-clicked');

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return state?.latestAssignment?.status || 'missing';
      }, { timeout: 30_000 }).toBe('assigned');

      const rankingState = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
      const protocolCandidates = (rankingState?.latestCandidateSet?.candidates || []).filter((candidate: Record<string, any>) => candidate.type === 'protocol');
      expect(protocolCandidates.length).toBeGreaterThan(0);
      expect(protocolCandidates[0]?.protocolId).toBe('protocol-power-pose');
      expect(protocolCandidates[0]?.responsivenessDirection).toBe('positive');
      expect(rankingState?.latestAssignment?.plannerAudit?.rankedCandidates?.length || 0).toBeGreaterThan(0);

      const seededProtocol = await seedProtocolAssignmentFixture(page, {
        namespace: actors.namespace,
        athleteUserId: actors.athleteIdentity.uid,
        coachUserId: actors.coachIdentity.uid,
        protocolId: 'protocol-cue-word-anchoring',
      });
      writeDebugStep(actors.namespace, 'test3:protocol-assignment-seeded');

      await preparePulseCheckApp(actors.athletePage, 'nora');
      await expect(actors.athletePage.getByText(/Today's Nora Task/i)).toBeVisible({ timeout: 20_000 });
      await actors.athletePage.getByRole('button', { name: /Open today'?s task/i }).click();
      await expect(actors.athletePage).toHaveURL(/\/mental-training/i, { timeout: 20_000 });

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return state?.latestAssignment?.status || 'missing';
      }, { timeout: 20_000 }).toBe('started');

      await recordJourneyCompletion(page, actors.athleteIdentity.uid, seededProtocol.assignmentId);
      writeDebugStep(actors.namespace, 'test3:protocol-completion-recorded');

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return state?.latestAssignment?.status || 'missing';
      }, { timeout: 20_000 }).toBe('completed');

      const refreshedState = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
      expect(refreshedState?.responsivenessProfile?.familyResponses?.['priming-focus_narrowing']?.sampleSize || 0).toBeGreaterThan(0);
      expect(refreshedState?.responsivenessProfile?.sourceEventIds?.length || 0).toBeGreaterThan(0);
    } finally {
      await cleanupAthleteJourneyFixture(page, actors.namespace, actors.athleteIdentity.uid, actors.coachIdentity.uid).catch(() => null);
      await actors.coachContext.close().catch(() => null);
      await actors.athleteContext.close().catch(() => null);
    }
  });

  test('coach follow-up surfaces show Nora updates and allow same-day intervention', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const actors = await provisionJourneyActors(browser, page);
    const adminIdentity = await getAuthenticatedIdentity(page);

    if (!adminIdentity?.uid || !adminIdentity.email) {
      throw new Error('Unable to resolve the authenticated admin identity.');
    }

    try {
      await seedAthleteJourneyFixture(page, {
        namespace: actors.namespace,
        adminIdentity,
        coachIdentity: actors.coachIdentity,
        coachEmail: actors.coachEmail,
        athleteIdentity: actors.athleteIdentity,
        athleteEmail: actors.athleteEmail,
      });
      writeDebugStep(actors.namespace, 'test2:fixture-seeded');

      await preparePulseCheckApp(actors.athletePage, 'today');
      await actors.athletePage.getByRole('button', { name: /Solid/i }).click();
      writeDebugStep(actors.namespace, 'test2:readiness-clicked');

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return state?.latestAssignment?.status || 'missing';
      }, { timeout: 30_000 }).toBe('assigned');

      await upsertCoachNotifications(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
      writeDebugStep(actors.namespace, 'test2:coach-notifications-upserted');

      await actors.coachPage.goto('/coach/dashboard', { waitUntil: 'domcontentloaded' });
      writeDebugStep(actors.namespace, 'test2:coach-dashboard-open');
      await waitForStableAppFrame(actors.coachPage);
      await expect(actors.coachPage.getByText(/Coach Follow-Up/i)).toBeVisible({ timeout: 20_000 });
      const coachReviewCard = actors.coachPage
        .getByRole('button')
        .filter({ hasText: new RegExp(`${actors.athleteName}.*Review or override in Mental Training`, 'i') })
        .first();
      await expect(coachReviewCard).toBeVisible({ timeout: 20_000 });
      await expect(actors.coachPage.getByText(/Review Suggested/i)).toBeVisible({ timeout: 20_000 });
      await expect(actors.coachPage.getByText(/Awareness Only/i)).toBeVisible({ timeout: 20_000 });

      await actors.coachPage.goto('/coach/notifications', { waitUntil: 'domcontentloaded' });
      writeDebugStep(actors.namespace, 'test2:coach-notifications-open');
      await expect(actors.coachPage.getByText(/Coach Follow-Up Queue/i)).toBeVisible({ timeout: 20_000 });
      await expect(actors.coachPage.getByText(/Nora assigned today'?s task/i)).toBeVisible({ timeout: 20_000 });

      await actors.coachPage.goto('/coach/mentalGames?tab=assignments', { waitUntil: 'domcontentloaded' });
      writeDebugStep(actors.namespace, 'test2:coach-assignments-open');
      await expect(actors.coachPage.getByRole('heading', { name: /Nora Daily Auto-Assignments/i })).toBeVisible({ timeout: 20_000 });
      const dailyAssignmentCard = actors.coachPage
        .locator('div')
        .filter({ hasText: /Daily Nora Task/i })
        .filter({ hasText: new RegExp(actors.athleteName, 'i') })
        .first();
      await expect(dailyAssignmentCard).toBeVisible({ timeout: 20_000 });
      await dailyAssignmentCard.getByRole('button', { name: /^Defer Today$/i }).click();
      await expect(actors.coachPage.getByText(/Nora task was deferred/i)).toBeVisible({ timeout: 20_000 });

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return state?.latestAssignment?.status || 'missing';
      }, { timeout: 20_000 }).toBe('deferred');

      await expect(actors.coachPage.getByText(/paused until a coach or later cycle creates the next step/i)).toBeVisible({ timeout: 20_000 });
    } finally {
      await cleanupAthleteJourneyFixture(page, actors.namespace, actors.athleteIdentity.uid, actors.coachIdentity.uid).catch(() => null);
      await actors.coachContext.close().catch(() => null);
      await actors.athleteContext.close().catch(() => null);
    }
  });
});
