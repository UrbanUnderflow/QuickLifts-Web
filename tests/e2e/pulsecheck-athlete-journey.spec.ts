import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { ExerciseCategory } from '../../src/api/firebase/mentaltraining/types';

const defaultStorageStatePath = path.resolve(process.cwd(), '.playwright/admin-storage-state.json');
const hasAuthState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE) || existsSync(defaultStorageStatePath);
const remoteLoginToken = process.env.PLAYWRIGHT_REMOTE_LOGIN_TOKEN;
const allowWriteTests = process.env.PLAYWRIGHT_ALLOW_WRITE_TESTS === 'true';
const pulseCheckOrganizationId = process.env.PLAYWRIGHT_PULSECHECK_ORG_ID || '';
const pulseCheckTeamId = process.env.PLAYWRIGHT_PULSECHECK_TEAM_ID || '';
const pulseCheckNamespaceBase = process.env.PLAYWRIGHT_E2E_NAMESPACE || 'e2e-pulsecheck';
const pulseCheckNamespace = `${pulseCheckNamespaceBase}-journey`;
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

  const adminIdentity = await getAuthenticatedIdentity(page).catch(() => null);
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

async function waitForPulseE2EHarness(page: Page) {
  await page.waitForFunction(() => Boolean(window.__pulseE2E), undefined, { timeout: 20_000 });
}

async function syncProtocolRegistrySeeds(adminPage: Page) {
  await waitForPulseE2EHarness(adminPage);
  return adminPage.evaluate(async () => {
    return window.__pulseE2E?.syncPulseCheckProtocolRegistrySeeds?.();
  });
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
    debugNamespace,
    name,
    username,
    password,
  }: {
    email: string;
    debugNamespace?: string;
    name: string;
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

    if (debugNamespace) writeDebugStep(debugNamespace, 'athlete-redeem:goto');
    await page.goto(inviteUrl, { waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);
    if (debugNamespace) writeDebugStep(debugNamespace, 'athlete-redeem:invite-open');
    await expect(page.getByRole('heading', { name: /Join/i })).toBeVisible({ timeout: 20_000 });
    await fillInviteEmailField(page, email);
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.getByRole('button', { name: /Create Account and Join/i }).click();
    if (debugNamespace) writeDebugStep(debugNamespace, 'athlete-redeem:submitted');
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

    const postAcceptBody = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    console.log('[PulseCheck Invite Helper] athlete after post-accept wait', {
      url: page.url(),
      body: postAcceptBody.slice(0, 300),
    });

    if (/\/PulseCheck\/team-workspace/i.test(page.url())) {
      await waitForStableAppFrame(page);
      return { context, page };
    }

    if (debugNamespace) writeDebugStep(debugNamespace, 'athlete-redeem:success-visible');
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
    if (debugNamespace) writeDebugStep(debugNamespace, `athlete-redeem:continued:${page.url()}`);

    if (/\/PulseCheck\/team-workspace/i.test(page.url())) {
      return { context, page };
    }

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

async function saveProtocolPracticeSession(
  adminPage: Page,
  input: {
    assignmentId: string;
    session: Record<string, any>;
  }
) {
  await waitForPulseE2EHarness(adminPage);
  return adminPage.evaluate(async (payload) => {
    return window.__pulseE2E?.savePulseCheckProtocolPracticeSession(payload);
  }, input);
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
    candidateProtocols?: Array<{
      id: string;
      label: string;
      legacyExerciseId: string;
      protocolClass: 'priming' | 'regulation' | 'recovery';
      protocolCategory: ExerciseCategory;
      protocolResponseFamily: string;
      protocolDeliveryMode: string;
      durationSeconds: number;
      responsivenessDirection?: 'positive' | 'neutral' | 'negative';
    }>;
  }
) {
  await waitForPulseE2EHarness(adminPage);
  return adminPage.evaluate(async (payload) => {
    return window.__pulseE2E?.seedPulseCheckProtocolAssignmentFixture(payload);
  }, input);
}

async function captureProtocolRuntimeRecords(
  adminPage: Page,
  input: {
    protocolIds?: string[];
    protocolClass?: string;
  }
) {
  await waitForPulseE2EHarness(adminPage);
  return adminPage.evaluate(async (payload) => {
    return window.__pulseE2E?.capturePulseCheckProtocolRuntimeRecords(payload);
  }, input);
}

async function upsertProtocolRuntimeRecords(
  adminPage: Page,
  records: Array<Record<string, any>>
) {
  await waitForPulseE2EHarness(adminPage);
  return adminPage.evaluate(async (payload) => {
    return window.__pulseE2E?.upsertPulseCheckProtocolRuntimeRecords(payload);
  }, { records });
}

async function deleteProtocolRuntimeRecords(
  adminPage: Page,
  protocolIds: string[]
) {
  await waitForPulseE2EHarness(adminPage);
  return adminPage.evaluate(async (payload) => {
    return window.__pulseE2E?.deletePulseCheckProtocolRuntimeRecords(payload);
  }, { protocolIds });
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function preparePulseCheckApp(page: Page, section: 'today' | 'nora') {
  await page.goto(`/PulseCheck?web=1&section=${section}`, { waitUntil: 'domcontentloaded' });
  await waitForStableAppFrame(page);
  await page.evaluate(() => {
    window.localStorage.setItem('pulsecheck_has_seen_nora_onboarding', 'true');
    window.localStorage.setItem('pulse_has_seen_marketing', 'true');
  });
}

async function submitReadinessCheckIn(page: Page, readinessLabel: RegExp) {
  await preparePulseCheckApp(page, 'today');
  await expect(page.getByRole('heading', { name: /Where is your head at today\?/i })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: readinessLabel }).click();
}

async function submitReadinessCheckInViaHarness(
  adminPage: Page,
  athleteUserId: string,
  overrides?: Partial<{
    readinessScore: number;
    moodWord: string;
    energyLevel: number;
    stressLevel: number;
    sleepQuality: number;
    notes: string;
    protocolRuntimeOverrides: Array<Record<string, any>>;
  }>
) {
  await waitForPulseE2EHarness(adminPage);
  return adminPage.evaluate(async (payload) => {
    return window.__pulseE2E?.submitPulseCheckCheckIn(payload);
  }, {
    userId: athleteUserId,
    type: 'morning',
    readinessScore: overrides?.readinessScore ?? 3,
    moodWord: overrides?.moodWord ?? 'okay',
    energyLevel: overrides?.energyLevel,
    stressLevel: overrides?.stressLevel,
    sleepQuality: overrides?.sleepQuality,
    notes: overrides?.notes,
    protocolRuntimeOverrides: overrides?.protocolRuntimeOverrides,
    sourceDate: new Date().toISOString().split('T')[0],
  });
}

function buildPublishedProtocolRuntimeFixture(input: {
  id: string;
  label: string;
  familyId: string;
  familyLabel: string;
  variantId: string;
  variantKey: string;
  variantLabel: string;
  variantVersion?: string;
  protocolClass?: 'priming' | 'regulation' | 'recovery';
  category?: 'focus' | 'confidence' | 'breathing' | 'visualization' | 'mindset';
  responseFamily?: string;
  deliveryMode?: string;
  triggerTags?: string[];
  preferredContextTags?: string[];
  useWindowTags?: string[];
  avoidWindowTags?: string[];
  contraindicationTags?: string[];
  sortOrder?: number;
  publishStatus?: 'draft' | 'published' | 'archived';
  governanceStage?: string;
  isActive?: boolean;
}) {
  const now = Date.now();
  const publishedAt = input.publishStatus === 'archived' ? now - 10_000 : now;
  const protocolId = input.id;

  return {
    id: protocolId,
    label: input.label,
    familyId: input.familyId,
    familyLabel: input.familyLabel,
    familyStatus: 'locked',
    variantId: input.variantId,
    variantKey: input.variantKey,
    variantLabel: input.variantLabel,
    variantVersion: input.variantVersion || 'v1',
    publishedRevisionId: `${protocolId}@${publishedAt}`,
    governanceStage: input.governanceStage || (input.publishStatus === 'archived' ? 'archived' : 'published'),
    legacyExerciseId: 'focus-cue-word',
    protocolClass: input.protocolClass || 'priming',
    category: input.category || 'focus',
    responseFamily: input.responseFamily || 'focus_narrowing',
    deliveryMode: input.deliveryMode || 'guided_focus',
    triggerTags: input.triggerTags || ['pre_rep_prep'],
    preferredContextTags: input.preferredContextTags || ['pre_training'],
    useWindowTags: input.useWindowTags || ['pre_training'],
    avoidWindowTags: input.avoidWindowTags || [],
    contraindicationTags: input.contraindicationTags || [],
    rationale: `[E2E] ${input.label} runtime fixture.`,
    mechanism: `[E2E] ${input.label} mechanism.`,
    expectedStateShift: '[E2E] Increase readiness before execution.',
    durationSeconds: 180,
    sortOrder: input.sortOrder ?? 1,
    publishStatus: input.publishStatus || 'published',
    isActive: input.isActive ?? input.publishStatus !== 'archived',
    reviewStatus: 'approved',
    reviewChecklist: [],
    evidenceStatus: 'developing',
    reviewCadenceDays: 30,
    lastReviewedAt: now,
    nextReviewAt: now + 30 * 24 * 60 * 60 * 1000,
    publishedAt,
    archivedAt: input.publishStatus === 'archived' ? now : null,
    createdAt: now,
    updatedAt: now,
  };
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
    email: coachEmail,
    name: coachName,
    title: coachTitle,
    username: coachUsername,
    password: coachPassword,
  });
  attachPageDebugLogging(coachPage, namespace, 'coach-page');
  writeDebugStep(namespace, 'provision:coach-redeemed');

  const { context: athleteContext, page: athletePage } = await redeemAthleteInvite(browser, athleteInviteUrl, {
    email: athleteEmail,
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
  await Promise.race([
    page.getByText(/Adult onboarding link created and copied/i).waitFor({ state: 'visible', timeout: 15_000 }),
    getPostActivationAdultInviteCard(page, name).waitFor({ state: 'visible', timeout: 15_000 }),
  ]);
}

async function pageGenerateAthleteInvite(page: Page, athleteName: string, athleteEmail: string) {
  await page.getByPlaceholder('Athlete name').fill(athleteName);
  await page.getByPlaceholder('athlete@school.edu').fill(athleteEmail);
  await page.getByRole('button', { name: /Invite Athlete/i }).click();
  await Promise.race([
    page.getByText(/Athlete invite link created and copied/i).waitFor({ state: 'visible', timeout: 15_000 }),
    getWorkspaceAthleteInviteCard(page, athleteEmail).waitFor({ state: 'visible', timeout: 15_000 }),
  ]);
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

      const launchMentalTrainingLink = actors.athletePage.getByRole('link', { name: /Start today'?s task/i });
      const openNoraTaskButton = actors.athletePage.getByRole('button', { name: /Open today'?s task/i });
      if (await launchMentalTrainingLink.isVisible().catch(() => false)) {
        await launchMentalTrainingLink.click();
      } else {
        await openNoraTaskButton.click();
      }
      writeDebugStep(actors.namespace, 'test1:launch-clicked');
      await expect(actors.athletePage).toHaveURL(/\/mental-training/i, { timeout: 20_000 });
      writeDebugStep(actors.namespace, 'test1:mental-training-open');
      await expect(actors.athletePage.getByText(new RegExp(assignmentLabel, 'i'))).toBeVisible({ timeout: 20_000 });

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

      await actors.athletePage.reload({ waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(actors.athletePage);
      await expect(actors.athletePage.getByText(new RegExp(completedState.latestCompletion.sessionSummary.athleteHeadline, 'i'))).toBeVisible({ timeout: 20_000 });

      await actors.athletePage.goto('/mental-training', { waitUntil: 'domcontentloaded' });
      writeDebugStep(actors.namespace, 'test1:mental-training-reopened');
      await waitForStableAppFrame(actors.athletePage);
      await expect(actors.athletePage.getByText(new RegExp(assignmentLabel, 'i'))).toBeVisible({ timeout: 20_000 });
      await expect(actors.athletePage.getByText(new RegExp(completedState.latestCompletion.sessionSummary.athleteHeadline, 'i'))).toBeVisible({ timeout: 20_000 });

      await preparePulseCheckApp(actors.athletePage, 'today');
      writeDebugStep(actors.namespace, 'test1:today-reopened');
      await expect(actors.athletePage.getByText(new RegExp(completedState.latestCompletion.sessionSummary.athleteHeadline, 'i'))).toBeVisible({ timeout: 20_000 });
    } finally {
      await cleanupAthleteJourneyFixture(page, actors.namespace, actors.athleteIdentity.uid, actors.coachIdentity.uid).catch(() => null);
      await actors.coachContext.close().catch(() => null);
      await actors.athleteContext.close().catch(() => null);
    }
  });

  test('authored training plans stay aligned across home, Nora, mental training, and coach review replacement', async ({ browser, page }) => {
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
      writeDebugStep(actors.namespace, 'test-authoring:fixture-seeded');

      await preparePulseCheckApp(actors.athletePage, 'today');
      await expect(actors.athletePage.getByRole('heading', { name: /Where is your head at today\?/i })).toBeVisible({ timeout: 20_000 });
      await actors.athletePage.getByRole('button', { name: /Solid/i }).click();
      writeDebugStep(actors.namespace, 'test-authoring:readiness-clicked');

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return Boolean(
          state?.latestAssignment?.trainingPlanId
          && state?.latestAssignment?.trainingPlanStepId
          && state?.latestTrainingPlan?.id
          && state?.latestCandidateSet?.planDrivenCandidateId
        );
      }, { timeout: 30_000 }).toBe(true);

      const authoredState = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
      expect(authoredState?.latestAssignment?.trainingPlanId).toBeTruthy();
      expect(authoredState?.latestAssignment?.trainingPlanStepId).toBeTruthy();
      expect(authoredState?.latestCandidateSet?.planDrivenCandidateId).toBeTruthy();
      expect(
        authoredState?.recentTrainingPlanEvents?.some((event: Record<string, any>) => event.eventType === 'training_plan_authored')
      ).toBe(true);
      expect(
        authoredState?.recentTrainingPlanEvents?.some((event: Record<string, any>) => event.eventType === 'training_plan_step_authored')
      ).toBe(true);

      const initialPlanId = authoredState?.latestTrainingPlan?.id;
      const initialPlanTitle = authoredState?.latestTrainingPlan?.title || 'Plan';
      const assignmentLabel = humanizeAssignmentLabel(
        authoredState?.latestAssignment?.simSpecId
        || authoredState?.latestAssignment?.legacyExerciseId
        || authoredState?.latestAssignment?.protocolLabel
        || authoredState?.latestAssignment?.sessionType
      );

      await actors.athletePage.goto(teamWorkspacePath(actors.workspaceContext), { waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(actors.athletePage);
      writeDebugStep(actors.namespace, 'test-authoring:workspace-open');
      await expect(actors.athletePage.getByText(/Today's Nora Task/i)).toBeVisible({ timeout: 20_000 });
      await expect(actors.athletePage.getByText(new RegExp(escapeRegExp(assignmentLabel), 'i')).first()).toBeVisible({ timeout: 20_000 });

      await preparePulseCheckApp(actors.athletePage, 'nora');
      writeDebugStep(actors.namespace, 'test-authoring:nora-open');
      await expect(actors.athletePage.getByText(/Today's Nora Task/i)).toBeVisible({ timeout: 20_000 });
      await expect(actors.athletePage.getByRole('heading', { name: new RegExp(escapeRegExp(assignmentLabel), 'i') })).toBeVisible({ timeout: 20_000 });

      const launchMentalTrainingLink = actors.athletePage.getByRole('link', { name: /Start today'?s task/i });
      const openNoraTaskButton = actors.athletePage.getByRole('button', { name: /Open today'?s task/i });
      if (await launchMentalTrainingLink.isVisible().catch(() => false)) {
        await launchMentalTrainingLink.click();
      } else {
        await openNoraTaskButton.click();
      }
      writeDebugStep(actors.namespace, 'test-authoring:mental-training-launch');
      await expect(actors.athletePage).toHaveURL(/\/mental-training/i, { timeout: 20_000 });
      await expect(actors.athletePage.getByText(new RegExp(escapeRegExp(assignmentLabel), 'i')).first()).toBeVisible({ timeout: 20_000 });

      await actors.coachPage.goto('/coach/mentalGames?tab=athletes', { waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(actors.coachPage);
      writeDebugStep(actors.namespace, 'test-authoring:coach-athletes-open');
      const athleteCard = actors.coachPage
        .locator('div')
        .filter({ hasText: new RegExp(escapeRegExp(actors.athleteName), 'i') })
        .filter({ has: actors.coachPage.getByRole('button', { name: /Review Plan/i }) })
        .first();
      await expect(athleteCard).toBeVisible({ timeout: 20_000 });
      await athleteCard.getByRole('button', { name: /Review Plan/i }).click();
      await expect(actors.coachPage.getByText(/Coach primary plan review/i)).toBeVisible({ timeout: 20_000 });
      await expect(actors.coachPage.getByRole('heading', { name: new RegExp(escapeRegExp(initialPlanTitle), 'i') })).toBeVisible({ timeout: 20_000 });

      await actors.coachPage.getByPlaceholder('REBUILD').fill('REBUILD');
      await actors.coachPage.getByRole('button', { name: /Replace primary plan/i }).click();
      writeDebugStep(actors.namespace, 'test-authoring:coach-plan-replaced');
      await expect(actors.coachPage.getByText(/Primary plan replaced and superseded successfully/i)).toBeVisible({ timeout: 30_000 });

      await expect.poll(async () => {
        const refreshedState = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return Boolean(
          refreshedState?.latestTrainingPlan?.id
          && refreshedState.latestTrainingPlan.id !== initialPlanId
          && refreshedState.trainingPlans?.some((plan: Record<string, any>) => plan.status === 'superseded')
          && refreshedState.recentTrainingPlanEvents?.some((event: Record<string, any>) => event.eventType === 'training_plan_superseded')
        );
      }, { timeout: 30_000 }).toBe(true);

      const refreshedState = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
      expect(refreshedState?.latestTrainingPlan?.id).not.toBe(initialPlanId);
      expect(refreshedState?.trainingPlans?.filter((plan: Record<string, any>) => plan.status === 'superseded').length || 0).toBeGreaterThan(0);
      expect(
        refreshedState?.recentTrainingPlanEvents?.some((event: Record<string, any>) => event.eventType === 'training_plan_superseded')
      ).toBe(true);
      expect(
        refreshedState?.recentTrainingPlanEvents?.some((event: Record<string, any>) => event.eventType === 'training_plan_authored')
      ).toBe(true);
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
      await seedProtocolAssignmentFixture(page, {
        namespace: actors.namespace,
        athleteUserId: actors.athleteIdentity.uid,
        coachUserId: actors.coachIdentity.uid,
        sourceDate: new Date().toISOString().split('T')[0],
        candidateProtocols: [
          {
            id: 'protocol-power-pose',
            label: 'Power Posing',
            legacyExerciseId: 'confidence-power-pose',
            protocolClass: 'priming',
            protocolCategory: ExerciseCategory.Confidence,
            protocolResponseFamily: 'confidence_priming',
            protocolDeliveryMode: 'embodied_reset',
            durationSeconds: 120,
            responsivenessDirection: 'positive',
          },
          {
            id: 'protocol-cue-word-anchoring',
            label: 'Cue Word Anchoring',
            legacyExerciseId: 'focus-cue-word',
            protocolClass: 'priming',
            protocolCategory: ExerciseCategory.Focus,
            protocolResponseFamily: 'focus_narrowing',
            protocolDeliveryMode: 'guided_focus',
            durationSeconds: 300,
            responsivenessDirection: 'negative',
          },
        ],
      });
      writeDebugStep(actors.namespace, 'test3:protocol-ranking-fixture-seeded');

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

  test('protocol daily assignment persists practice-session review surfaces into coach mental training', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    await ensureAdminSession(page, '/admin/pulsecheckProvisioning');
    const adminIdentity = await getAuthenticatedIdentity(page);

    if (!adminIdentity?.uid || !adminIdentity.email) {
      throw new Error('Unable to resolve the authenticated admin identity.');
    }

    const uniqueSuffix = Date.now().toString().slice(-6);
    const namespace = `${pulseCheckNamespace}-practice-review-${uniqueSuffix}`;
    const coachIdentity = { uid: `${namespace}-coach`, email: `e2e-practice-review-coach-${uniqueSuffix}@pulsecheck.test` };
    const athleteIdentity = { uid: `${namespace}-athlete`, email: `e2e-practice-review-athlete-${uniqueSuffix}@pulsecheck.test` };

    try {
      await seedAthleteJourneyFixture(page, {
        namespace,
        adminIdentity,
        coachIdentity,
        coachEmail: coachIdentity.email,
        athleteIdentity,
        athleteEmail: athleteIdentity.email,
      });
      writeDebugStep(namespace, 'test4:fixture-seeded');

      const seededProtocol = await seedProtocolAssignmentFixture(page, {
        namespace,
        athleteUserId: athleteIdentity.uid,
        coachUserId: coachIdentity.uid,
        protocolId: 'protocol-cue-word-anchoring',
      });
      writeDebugStep(namespace, 'test4:protocol-assignment-seeded');

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, athleteIdentity.uid, coachIdentity.uid);
        return state?.latestAssignment?.status || 'missing';
      }, { timeout: 20_000 }).toBe('assigned');

      const practiceSession = {
        specId: 'protocol-practice-conversation',
        specVersion: 'v1',
        protocolId: seededProtocol.protocolId,
        protocolFamilyId: 'family-cue-word-anchoring',
        protocolVariantId: 'variant-cue-word-anchoring',
        inputModesAllowed: ['text', 'voice'],
        inputModeUsed: 'text',
        teachCompletedAt: Date.now() - 20_000,
        practiceStartedAt: Date.now() - 10_000,
        completedAt: Date.now(),
        transcriptReviewEnabled: true,
        transcriptReviewUsed: true,
        adaptiveFollowUpsUsed: 1,
        turns: [
          {
            id: 'turn-1',
            promptLabel: 'Signal awareness',
            promptText: 'What is your body telling you right now?',
            responseText: 'My heart is racing, but that means I am ready to compete.',
            responseMode: 'text',
            strengths: ['named the signal', 'reframed the signal'],
            misses: [],
            noraFeedback: 'Good. You named the sensation and converted it into readiness.',
            submittedAt: Date.now() - 9_000,
          },
          {
            id: 'turn-2',
            promptLabel: 'Technique fidelity',
            promptText: 'Say your competition version out loud.',
            responseText: 'These butterflies are fuel. I am locked in and ready.',
            responseMode: 'text',
            strengths: ['clear reframe', 'competitive language'],
            misses: [],
            noraFeedback: 'That keeps the reframe short and usable under pressure.',
            submittedAt: Date.now() - 5_000,
          },
        ],
        scorecard: {
          overallScore: 4.4,
          dimensionScores: {
            signalAwareness: 4.5,
            techniqueFidelity: 4.3,
            languageQuality: 4.4,
            shiftQuality: 4.2,
            coachability: 4.6,
          },
          strengths: ['Recognized the arousal signal', 'Converted anxiety into readiness'],
          improvementAreas: ['Keep the reframe even shorter under pressure'],
          evaluationSummary: 'Strong practice rep with clear signal recognition and a credible readiness reframe.',
          nextRepFocus: 'Shorten the competition cue and repeat it once before the next rep.',
          coachabilityTrend: 'improving',
          voiceSignalsSummary: 'Text-first practice session with no voice capture.',
        },
      };

      await saveProtocolPracticeSession(page, {
        assignmentId: seededProtocol.assignmentId,
        session: practiceSession,
      });
      writeDebugStep(namespace, 'test4:practice-session-saved');

      const refreshedState = await inspectAthleteJourneyState(page, athleteIdentity.uid, coachIdentity.uid);
      expect(refreshedState?.latestAssignment?.protocolPracticeSession?.scorecard?.overallScore).toBeGreaterThan(4);
      expect(refreshedState?.latestAssignment?.protocolPracticeSession?.turns?.length || 0).toBeGreaterThan(1);
      expect(refreshedState?.latestAssignment?.protocolPracticeSession?.scorecard?.evaluationSummary).toContain('Strong practice rep');
      expect(refreshedState?.latestAssignment?.protocolPracticeSession?.turns?.[0]?.responseText).toContain('ready to compete');
    } finally {
      await cleanupAthleteJourneyFixture(page, namespace, athleteIdentity.uid, coachIdentity.uid).catch(() => null);
    }
  });

  test('published inventory includes active runtimes and excludes archived runtimes', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const actors = await provisionJourneyActors(browser, page);
    const adminIdentity = await getAuthenticatedIdentity(page);

    if (!adminIdentity?.uid || !adminIdentity.email) {
      throw new Error('Unable to resolve the authenticated admin identity.');
    }

    const publishedProtocolId = `${actors.namespace}-protocol-live`;
    const archivedProtocolId = `${actors.namespace}-protocol-archived`;
    const runtimeRecords = [
      buildPublishedProtocolRuntimeFixture({
        id: publishedProtocolId,
        label: 'E2E Live Priming Protocol',
        familyId: `${publishedProtocolId}-family`,
        familyLabel: 'E2E Live Priming',
        variantId: `${publishedProtocolId}-variant`,
        variantKey: 'e2e-live-priming',
        variantLabel: 'E2E Live Priming',
        sortOrder: 1,
      }),
      buildPublishedProtocolRuntimeFixture({
        id: archivedProtocolId,
        label: 'E2E Archived Priming Protocol',
        familyId: `${archivedProtocolId}-family`,
        familyLabel: 'E2E Archived Priming',
        variantId: `${archivedProtocolId}-variant`,
        variantKey: 'e2e-archived-priming',
        variantLabel: 'E2E Archived Priming',
        sortOrder: 2,
        publishStatus: 'archived',
        governanceStage: 'archived',
        isActive: false,
      }),
    ];

    try {
      await upsertProtocolRuntimeRecords(page, runtimeRecords);
      await upsertProtocolRuntimeRecords(actors.athletePage, runtimeRecords);

      await seedAthleteJourneyFixture(page, {
        namespace: actors.namespace,
        adminIdentity,
        coachIdentity: actors.coachIdentity,
        coachEmail: actors.coachEmail,
        athleteIdentity: actors.athleteIdentity,
        athleteEmail: actors.athleteEmail,
      });

      await submitReadinessCheckInViaHarness(page, actors.athleteIdentity.uid, {
        protocolRuntimeOverrides: runtimeRecords,
      });

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return state?.latestAssignment?.status || 'missing';
      }, { timeout: 30_000 }).toBe('assigned');

      const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
      const protocolCandidates = (state?.latestCandidateSet?.candidates || []).filter((candidate: Record<string, any>) => candidate.type === 'protocol');
      const protocolIds = protocolCandidates.map((candidate: Record<string, any>) => candidate.protocolId);

      expect(protocolIds).toContain(publishedProtocolId);
      expect(protocolIds).not.toContain(archivedProtocolId);
    } finally {
      await cleanupAthleteJourneyFixture(page, actors.namespace, actors.athleteIdentity.uid, actors.coachIdentity.uid).catch(() => null);
      await actors.coachContext.close().catch(() => null);
      await actors.athleteContext.close().catch(() => null);
    }
  });

  test('trigger and use-window policy excludes mismatched published protocols', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const actors = await provisionJourneyActors(browser, page);
    const adminIdentity = await getAuthenticatedIdentity(page);

    if (!adminIdentity?.uid || !adminIdentity.email) {
      throw new Error('Unable to resolve the authenticated admin identity.');
    }

    const matchingProtocolId = `${actors.namespace}-protocol-match`;
    const mismatchedProtocolId = `${actors.namespace}-protocol-mismatch`;
    const runtimeRecords = [
      buildPublishedProtocolRuntimeFixture({
        id: matchingProtocolId,
        label: 'E2E Matching Priming Protocol',
        familyId: `${matchingProtocolId}-family`,
        familyLabel: 'E2E Matching Priming',
        variantId: `${matchingProtocolId}-variant`,
        variantKey: 'e2e-matching-priming',
        variantLabel: 'E2E Matching Priming',
        sortOrder: 1,
        triggerTags: ['pre_rep_prep'],
        useWindowTags: ['pre_training'],
        preferredContextTags: ['pre_training'],
      }),
      buildPublishedProtocolRuntimeFixture({
        id: mismatchedProtocolId,
        label: 'E2E Mismatched Priming Protocol',
        familyId: `${mismatchedProtocolId}-family`,
        familyLabel: 'E2E Mismatched Priming',
        variantId: `${mismatchedProtocolId}-variant`,
        variantKey: 'e2e-mismatched-priming',
        variantLabel: 'E2E Mismatched Priming',
        sortOrder: 2,
        triggerTags: ['post_competition'],
        useWindowTags: ['recovery_day'],
        preferredContextTags: ['recovery_day'],
      }),
    ];

    try {
      await upsertProtocolRuntimeRecords(page, runtimeRecords);
      await upsertProtocolRuntimeRecords(actors.athletePage, runtimeRecords);

      await seedAthleteJourneyFixture(page, {
        namespace: actors.namespace,
        adminIdentity,
        coachIdentity: actors.coachIdentity,
        coachEmail: actors.coachEmail,
        athleteIdentity: actors.athleteIdentity,
        athleteEmail: actors.athleteEmail,
      });

      await submitReadinessCheckInViaHarness(page, actors.athleteIdentity.uid, {
        protocolRuntimeOverrides: runtimeRecords,
      });

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return state?.latestAssignment?.status || 'missing';
      }, { timeout: 30_000 }).toBe('assigned');

      const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
      const protocolCandidates = (state?.latestCandidateSet?.candidates || []).filter((candidate: Record<string, any>) => candidate.type === 'protocol');
      const protocolIds = protocolCandidates.map((candidate: Record<string, any>) => candidate.protocolId);

      expect(protocolIds).toContain(matchingProtocolId);
      expect(protocolIds).not.toContain(mismatchedProtocolId);
    } finally {
      await cleanupAthleteJourneyFixture(page, actors.namespace, actors.athleteIdentity.uid, actors.coachIdentity.uid).catch(() => null);
      await actors.coachContext.close().catch(() => null);
      await actors.athleteContext.close().catch(() => null);
    }
  });

  test('stale responsiveness does not overpower current protocol policy ordering', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const actors = await provisionJourneyActors(browser, page);
    const adminIdentity = await getAuthenticatedIdentity(page);

    if (!adminIdentity?.uid || !adminIdentity.email) {
      throw new Error('Unable to resolve the authenticated admin identity.');
    }

    const baselineProtocolId = `${actors.namespace}-protocol-baseline`;
    const staleFavoredProtocolId = `${actors.namespace}-protocol-stale-favored`;
    const now = Date.now();
    const runtimeRecords = [
      buildPublishedProtocolRuntimeFixture({
        id: baselineProtocolId,
        label: 'E2E Baseline Priming Protocol',
        familyId: `${baselineProtocolId}-family`,
        familyLabel: 'E2E Baseline Priming',
        variantId: `${baselineProtocolId}-variant`,
        variantKey: 'e2e-baseline-priming',
        variantLabel: 'E2E Baseline Priming',
        sortOrder: 1,
      }),
      buildPublishedProtocolRuntimeFixture({
        id: staleFavoredProtocolId,
        label: 'E2E Stale Favored Priming Protocol',
        familyId: `${staleFavoredProtocolId}-family`,
        familyLabel: 'E2E Stale Favored Priming',
        variantId: `${staleFavoredProtocolId}-variant`,
        variantKey: 'e2e-stale-favored-priming',
        variantLabel: 'E2E Stale Favored Priming',
        sortOrder: 2,
      }),
    ];

    try {
      await upsertProtocolRuntimeRecords(page, runtimeRecords);
      await upsertProtocolRuntimeRecords(actors.athletePage, runtimeRecords);

      await seedAthleteJourneyFixture(page, {
        namespace: actors.namespace,
        adminIdentity,
        coachIdentity: actors.coachIdentity,
        coachEmail: actors.coachEmail,
        athleteIdentity: actors.athleteIdentity,
        athleteEmail: actors.athleteEmail,
      });

      await seedProtocolResponsivenessProfile(page, {
        athleteUserId: actors.athleteIdentity.uid,
        familyResponses: {
          [`${baselineProtocolId}-family`]: {
            protocolFamilyId: `${baselineProtocolId}-family`,
            protocolFamilyLabel: 'E2E Baseline Priming',
            responseDirection: 'negative',
            confidence: 'high',
            freshness: 'refresh_required',
            sampleSize: 5,
            positiveSignals: 0,
            neutralSignals: 1,
            negativeSignals: 4,
            stateFit: ['yellow_snapshot', 'protocol_then_sim', 'medium_readiness'],
            supportingEvidence: ['This stale profile should not suppress the current bounded ordering.'],
            lastObservedAt: now - 60 * 24 * 60 * 60 * 1000,
            lastConfirmedAt: now - 60 * 24 * 60 * 60 * 1000,
          },
          [`${staleFavoredProtocolId}-family`]: {
            protocolFamilyId: `${staleFavoredProtocolId}-family`,
            protocolFamilyLabel: 'E2E Stale Favored Priming',
            responseDirection: 'positive',
            confidence: 'high',
            freshness: 'refresh_required',
            sampleSize: 6,
            positiveSignals: 5,
            neutralSignals: 1,
            negativeSignals: 0,
            stateFit: ['yellow_snapshot', 'protocol_then_sim', 'medium_readiness'],
            supportingEvidence: ['This stale profile should not overpower current-state policy.'],
            lastObservedAt: now - 60 * 24 * 60 * 60 * 1000,
            lastConfirmedAt: now - 60 * 24 * 60 * 60 * 1000,
          },
        },
        staleAt: now - 1_000,
      });

      await submitReadinessCheckInViaHarness(page, actors.athleteIdentity.uid, {
        protocolRuntimeOverrides: runtimeRecords,
      });

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return state?.latestAssignment?.status || 'missing';
      }, { timeout: 30_000 }).toBe('assigned');

      const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
      const protocolCandidates = (state?.latestCandidateSet?.candidates || []).filter((candidate: Record<string, any>) =>
        candidate.type === 'protocol' &&
        [baselineProtocolId, staleFavoredProtocolId].includes(candidate.protocolId)
      );

      expect(protocolCandidates).toHaveLength(2);
      expect(protocolCandidates[0]?.protocolId).toBe(baselineProtocolId);
      expect(protocolCandidates[0]?.responsivenessDirection).toBeFalsy();
      expect(protocolCandidates[1]?.responsivenessDirection).toBeFalsy();
    } finally {
      await cleanupAthleteJourneyFixture(page, actors.namespace, actors.athleteIdentity.uid, actors.coachIdentity.uid).catch(() => null);
      await actors.coachContext.close().catch(() => null);
      await actors.athleteContext.close().catch(() => null);
    }
  });

  test('inventory gaps are recorded when no live priming protocol remains eligible', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const actors = await provisionJourneyActors(browser, page);
    const adminIdentity = await getAuthenticatedIdentity(page);

    if (!adminIdentity?.uid || !adminIdentity.email) {
      throw new Error('Unable to resolve the authenticated admin identity.');
    }

    const originalPrimingProtocols = await captureProtocolRuntimeRecords(page, { protocolClass: 'priming' });

    try {
      const archivedPrimingProtocols = originalPrimingProtocols.map((record: Record<string, any>) => ({
        ...record,
        publishStatus: 'archived',
        governanceStage: 'archived',
        isActive: false,
        archivedAt: Date.now(),
        updatedAt: Date.now(),
      }));

      await upsertProtocolRuntimeRecords(page, archivedPrimingProtocols);
      await upsertProtocolRuntimeRecords(actors.athletePage, archivedPrimingProtocols);

      await seedAthleteJourneyFixture(page, {
        namespace: actors.namespace,
        adminIdentity,
        coachIdentity: actors.coachIdentity,
        coachEmail: actors.coachEmail,
        athleteIdentity: actors.athleteIdentity,
        athleteEmail: actors.athleteEmail,
      });

      await submitReadinessCheckInViaHarness(page, actors.athleteIdentity.uid, {
        protocolRuntimeOverrides: [],
      });

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return state?.latestAssignment?.status || 'missing';
      }, { timeout: 30_000 }).toBe('assigned');

      const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
      const protocolCandidates = (state?.latestCandidateSet?.candidates || []).filter((candidate: Record<string, any>) => candidate.type === 'protocol');
      const inventoryGaps = state?.latestCandidateSet?.inventoryGaps || [];

      expect(protocolCandidates).toHaveLength(0);
      expect(inventoryGaps.some((gap: string) => /No live priming protocol/i.test(gap))).toBe(true);
    } finally {
      await upsertProtocolRuntimeRecords(page, originalPrimingProtocols).catch(() => null);
      await upsertProtocolRuntimeRecords(actors.athletePage, originalPrimingProtocols).catch(() => null);
      await cleanupAthleteJourneyFixture(page, actors.namespace, actors.athleteIdentity.uid, actors.coachIdentity.uid).catch(() => null);
      await actors.coachContext.close().catch(() => null);
      await actors.athleteContext.close().catch(() => null);
    }
  });

  test('seeded protocol registry drives live assignment selection without runtime overrides', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const actors = await provisionJourneyActors(browser, page);
    const adminIdentity = await getAuthenticatedIdentity(page);

    if (!adminIdentity?.uid || !adminIdentity.email) {
      throw new Error('Unable to resolve the authenticated admin identity.');
    }

    try {
      await syncProtocolRegistrySeeds(page);
      await syncProtocolRegistrySeeds(actors.athletePage);

      const seededPrimingProtocols = await captureProtocolRuntimeRecords(page, { protocolClass: 'priming' });
      const publishedPrimingProtocols = seededPrimingProtocols.filter((record: Record<string, any>) =>
        record?.isActive !== false &&
        String(record?.publishStatus || '').toLowerCase() === 'published' &&
        !['archived', 'restricted'].includes(String(record?.governanceStage || '').toLowerCase())
      );

      expect(publishedPrimingProtocols.length).toBeGreaterThan(0);

      await seedAthleteJourneyFixture(page, {
        namespace: actors.namespace,
        adminIdentity,
        coachIdentity: actors.coachIdentity,
        coachEmail: actors.coachEmail,
        athleteIdentity: actors.athleteIdentity,
        athleteEmail: actors.athleteEmail,
      });

      await submitReadinessCheckInViaHarness(page, actors.athleteIdentity.uid);

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return state?.latestAssignment?.status || 'missing';
      }, { timeout: 30_000 }).toBe('assigned');

      const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
      const protocolCandidates = (state?.latestCandidateSet?.candidates || []).filter((candidate: Record<string, any>) => candidate.type === 'protocol');
      const protocolIds = protocolCandidates.map((candidate: Record<string, any>) => candidate.protocolId);

      expect(protocolCandidates.length).toBeGreaterThan(0);
      expect(protocolIds.every((protocolId: string) => publishedPrimingProtocols.some((record: Record<string, any>) => record.id === protocolId))).toBe(true);
      expect(protocolCandidates.every((candidate: Record<string, any>) => !candidate.publishStatus || candidate.publishStatus === 'published')).toBe(true);
    } finally {
      await cleanupAthleteJourneyFixture(page, actors.namespace, actors.athleteIdentity.uid, actors.coachIdentity.uid).catch(() => null);
      await actors.coachContext.close().catch(() => null);
      await actors.athleteContext.close().catch(() => null);
    }
  });

  test('restricted protocol runtimes stay excluded even when responsiveness strongly favors them', async ({ browser, page }) => {
    test.setTimeout(240_000);
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const actors = await provisionJourneyActors(browser, page);
    const adminIdentity = await getAuthenticatedIdentity(page);

    if (!adminIdentity?.uid || !adminIdentity.email) {
      throw new Error('Unable to resolve the authenticated admin identity.');
    }

    try {
      const baselineProtocolId = `${actors.namespace}-protocol-baseline`;
      const restrictedProtocolId = `${actors.namespace}-protocol-restricted`;
      const now = Date.now();
      const runtimeRecords = [
        buildPublishedProtocolRuntimeFixture({
          id: baselineProtocolId,
          label: 'E2E Baseline Priming Protocol',
          familyId: `${baselineProtocolId}-family`,
          familyLabel: 'E2E Baseline Priming',
          variantId: `${baselineProtocolId}-variant`,
          variantKey: 'e2e-baseline-priming',
          variantLabel: 'E2E Baseline Priming',
          sortOrder: 1,
        }),
        buildPublishedProtocolRuntimeFixture({
          id: restrictedProtocolId,
          label: 'E2E Restricted Priming Protocol',
          familyId: `${restrictedProtocolId}-family`,
          familyLabel: 'E2E Restricted Priming',
          variantId: `${restrictedProtocolId}-variant`,
          variantKey: 'e2e-restricted-priming',
          variantLabel: 'E2E Restricted Priming',
          sortOrder: 2,
          publishStatus: 'published',
          governanceStage: 'restricted',
          isActive: true,
        }),
      ];

      await upsertProtocolRuntimeRecords(page, runtimeRecords);
      await upsertProtocolRuntimeRecords(actors.athletePage, runtimeRecords);

      await seedAthleteJourneyFixture(page, {
        namespace: actors.namespace,
        adminIdentity,
        coachIdentity: actors.coachIdentity,
        coachEmail: actors.coachEmail,
        athleteIdentity: actors.athleteIdentity,
        athleteEmail: actors.athleteEmail,
      });

      await seedProtocolResponsivenessProfile(page, {
        athleteUserId: actors.athleteIdentity.uid,
        familyResponses: {
          [`${restrictedProtocolId}-family`]: {
            protocolFamilyId: `${restrictedProtocolId}-family`,
            protocolFamilyLabel: 'E2E Restricted Priming',
            responseDirection: 'positive',
            confidence: 'high',
            freshness: 'current',
            sampleSize: 6,
            positiveSignals: 5,
            neutralSignals: 1,
            negativeSignals: 0,
            stateFit: ['yellow_snapshot', 'protocol_then_sim', 'medium_readiness'],
            supportingEvidence: ['Strong response history should still be bounded by restricted governance.'],
            lastObservedAt: now,
            lastConfirmedAt: now,
          },
        },
      });

      await submitReadinessCheckInViaHarness(page, actors.athleteIdentity.uid, {
        protocolRuntimeOverrides: runtimeRecords,
      });

      await expect.poll(async () => {
        const state = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
        return state?.latestAssignment?.status || 'missing';
      }, { timeout: 30_000 }).toBe('assigned');

      const refreshedState = await inspectAthleteJourneyState(page, actors.athleteIdentity.uid, actors.coachIdentity.uid);
      const protocolCandidates = (refreshedState?.latestCandidateSet?.candidates || []).filter((candidate: Record<string, any>) => candidate.type === 'protocol');
      const protocolIds = protocolCandidates.map((candidate: Record<string, any>) => candidate.protocolId);

      expect(protocolIds).toContain(baselineProtocolId);
      expect(protocolIds).not.toContain(restrictedProtocolId);
      expect(protocolCandidates.some((candidate: Record<string, any>) => candidate.protocolId === restrictedProtocolId)).toBe(false);
    } finally {
      await cleanupAthleteJourneyFixture(page, actors.namespace, actors.athleteIdentity.uid, actors.coachIdentity.uid).catch(() => null);
      await actors.coachContext.close().catch(() => null);
      await actors.athleteContext.close().catch(() => null);
    }
  });
});
