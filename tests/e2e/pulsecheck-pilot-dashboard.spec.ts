import { expect, test, type Locator, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const defaultStorageStatePath = path.resolve(process.cwd(), '.playwright/admin-storage-state.json');
const hasAuthState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE) || existsSync(defaultStorageStatePath);
const remoteLoginToken = process.env.PLAYWRIGHT_REMOTE_LOGIN_TOKEN;
const hasDevAuthBypass = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';
const allowWriteTests = process.env.PLAYWRIGHT_ALLOW_WRITE_TESTS === 'true';
const pulseCheckNamespaceBase = process.env.PLAYWRIGHT_E2E_NAMESPACE || 'e2e-pulsecheck';
const pulseCheckNamespace = `${pulseCheckNamespaceBase}-pilot-dashboard`;
const appBaseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const appOrigin = new URL(appBaseURL).origin;
const pilotDashboardDetailSource = readFileSync(
  path.resolve(process.cwd(), 'src/pages/admin/pulsecheckPilotDashboard/[pilotId].tsx'),
  'utf8'
);
const pilotDashboardThemeSource = readFileSync(
  path.resolve(process.cwd(), 'src/components/admin/pilot-dashboard/PilotDashboardTheme.tsx'),
  'utf8'
);
const pulseCheckProvisioningServiceSource = readFileSync(
  path.resolve(process.cwd(), 'src/api/firebase/pulsecheckProvisioning/service.ts'),
  'utf8'
);

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

interface PilotDashboardSurveyResponseFixture {
  id?: string;
  respondentUserId: string;
  respondentRole: 'athlete' | 'coach' | 'clinician';
  surveyKind: 'trust' | 'nps';
  score: number;
  athleteId?: string | null;
  pilotEnrollmentId?: string | null;
  cohortId?: string | null;
  source?: 'ios' | 'android' | 'web-admin';
  submittedAt?: string | number | Date;
}

function shiftDateKey(dateKey: string, dayOffset: number): string {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Expected a YYYY-MM-DD date key, received: ${dateKey}`);
  }

  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + dayOffset));
  return shifted.toISOString().slice(0, 10);
}

async function confirmPilotStartDateSave(page: Page) {
  const confirmationPromise = page.waitForEvent('dialog');
  const clickPromise = page.getByTestId('pilot-start-date-save').click();
  const confirmation = await confirmationPromise;

  expect(confirmation.type()).toBe('confirm');
  expect(confirmation.message()).toContain('can change which athlete activity qualifies for pilot reporting after study metrics refresh');
  await confirmation.accept();
  await clickPromise;
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

async function seedPilotDashboardFixture(
  page: Page,
  overrides: { surveyResponses?: PilotDashboardSurveyResponseFixture[] } = {}
): Promise<{ fixture: PilotDashboardFixture; adminIdentity: AuthIdentity }> {
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
    async ({ namespace, adminUserId, adminEmail, surveyResponses }) => {
      return window.__pulseE2E?.seedPulseCheckPilotDashboardFixture({
        namespace,
        adminUserId,
        adminEmail,
        surveyResponses,
      });
    },
    {
      namespace: pulseCheckNamespace,
      adminUserId: adminIdentity.uid,
      adminEmail: adminIdentity.email,
      surveyResponses: overrides.surveyResponses || [],
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
  if (page.isClosed()) {
    return;
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
}

interface ComputedReadability {
  backgroundColor: string;
  color: string;
  contrastRatio: number;
  fontFamily: string;
  fontSizePx: number;
}

async function measureComputedReadability(locator: Locator): Promise<ComputedReadability> {
  await expect(locator).toBeVisible();

  return locator.evaluate((element) => {
    interface RgbaColor {
      red: number;
      green: number;
      blue: number;
      alpha: number;
    }

    const parseColor = (value: string): RgbaColor => {
      const channels = value.match(/[\d.]+/g)?.map(Number) || [];
      if (channels.length < 3) {
        throw new Error(`Unable to parse computed color: ${value}`);
      }

      return {
        red: channels[0],
        green: channels[1],
        blue: channels[2],
        alpha: channels.length >= 4 ? channels[3] : 1,
      };
    };

    const composite = (foreground: RgbaColor, background: RgbaColor): RgbaColor => {
      const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
      if (alpha === 0) {
        return { red: 0, green: 0, blue: 0, alpha: 0 };
      }

      return {
        red: (foreground.red * foreground.alpha + background.red * background.alpha * (1 - foreground.alpha)) / alpha,
        green: (foreground.green * foreground.alpha + background.green * background.alpha * (1 - foreground.alpha)) / alpha,
        blue: (foreground.blue * foreground.alpha + background.blue * background.alpha * (1 - foreground.alpha)) / alpha,
        alpha,
      };
    };

    const channelLuminance = (channel: number) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };

    const relativeLuminance = (color: RgbaColor) =>
      0.2126 * channelLuminance(color.red) +
      0.7152 * channelLuminance(color.green) +
      0.0722 * channelLuminance(color.blue);

    const ancestors: Element[] = [];
    let current: Element | null = element;
    while (current) {
      ancestors.push(current);
      current = current.parentElement;
    }

    let effectiveBackground: RgbaColor = { red: 255, green: 255, blue: 255, alpha: 1 };
    ancestors.reverse().forEach((ancestor) => {
      effectiveBackground = composite(parseColor(window.getComputedStyle(ancestor).backgroundColor), effectiveBackground);
    });

    const style = window.getComputedStyle(element);
    const effectiveForeground = composite(parseColor(style.color), effectiveBackground);
    const foregroundLuminance = relativeLuminance(effectiveForeground);
    const backgroundLuminance = relativeLuminance(effectiveBackground);
    const contrastRatio =
      (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
      (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
    const formatColor = (color: RgbaColor) =>
      `rgb(${Math.round(color.red)}, ${Math.round(color.green)}, ${Math.round(color.blue)})`;

    return {
      backgroundColor: formatColor(effectiveBackground),
      color: formatColor(effectiveForeground),
      contrastRatio,
      fontFamily: style.fontFamily,
      fontSizePx: Number.parseFloat(style.fontSize),
    };
  });
}

async function expectReadableContrast(locator: Locator, label: string): Promise<ComputedReadability> {
  const readability = await measureComputedReadability(locator);
  expect(
    readability.contrastRatio,
    `${label} rendered at ${readability.contrastRatio.toFixed(2)}:1 (${readability.color} on ${readability.backgroundColor}).`
  ).toBeGreaterThanOrEqual(4.5);
  return readability;
}

test('production pilot dashboard repairs a stale development invite without rotating its token', () => {
  expect(pilotDashboardDetailSource).toMatch(
    /const canonicalInviteNeedsProductionRepair = Boolean\([\s\S]*?canonicalInvite[\s\S]*?!demoModeEnabled[\s\S]*?!isUsingDevFirebase\(\)[\s\S]*?hasPulseCheckInviteDevFirebaseMarker\(canonicalInvite\.activationUrl\)/
  );
  expect(pilotDashboardDetailSource).toMatch(
    /\(canonicalInvite && !canonicalInviteNeedsProductionRepair\)[\s\S]*?inviteEnsureAttemptedScopeKeysRef\.current\.has\(selectedInviteScopeKey\)[\s\S]*?inviteEnsureAttemptedScopeKeysRef\.current\.add\(selectedInviteScopeKey\);[\s\S]*?void ensureCanonicalInviteLink\(\)/
  );
  expect(pulseCheckProvisioningServiceSource).toMatch(
    /const token =[\s\S]*?mostRecentMatchingLink\?\.data\(\)[\s\S]*?\.token[\s\S]*?\|\| crypto\.randomUUID\(\)/
  );
  expect(pulseCheckProvisioningServiceSource).toMatch(
    /if \(redemptionMode === 'general' && mostRecentMatchingLink\) \{[\s\S]*?updateDoc\(mostRecentMatchingLink\.ref,[\s\S]*?token,[\s\S]*?activationUrl,[\s\S]*?return mostRecentMatchingLink\.id/
  );
});

test.describe('PulseCheck pilot dashboard light-mode readability', () => {
  test.skip(
    !hasAuthState && !remoteLoginToken && !hasDevAuthBypass,
    'Requires Playwright admin auth state, PLAYWRIGHT_REMOTE_LOGIN_TOKEN, or NEXT_PUBLIC_DEV_AUTH_BYPASS=true.'
  );

  test('keeps critical activity text readable in light mode', async ({ page }) => {
    const demoPilotPath = '/admin/pulsecheckPilotDashboard/demo-pilot-correlation-2026';
    await page.addInitScript(() => {
      window.localStorage.setItem('pulsecheckPilotDashboardTheme', 'light');
      window.localStorage.setItem('pulsecheckPilotDashboardDemoMode', 'true');
    });

    if (!hasDevAuthBypass) {
      await ensureAdminSession(page, demoPilotPath);
    }
    await page.goto(demoPilotPath, { waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);

    await expect(page.getByTestId('pilot-dashboard-theme-frame')).toHaveAttribute('data-pilot-theme', 'light');
    await expect(page.getByRole('heading', { name: 'Correlation Engine Spring Pilot Demo' })).toBeVisible();
    await page.getByTestId('pilot-dashboard-tab-activity-outcomes').click();
    await expect(page.getByRole('heading', { name: 'Latest saved participation' })).toBeVisible();

    const participationPanel = page.getByTestId('pilot-dashboard-adherence-orchestrator');
    await expect(participationPanel).toContainText('Participation has not been measured for this pilot yet.');

    const requiredLightThemeTokens = [
      'text-sky-100',
      'text-orange-100',
      'text-emerald-50/90',
      'text-emerald-100/75',
      'text-amber-100/90',
      'text-zinc-500',
    ];
    requiredLightThemeTokens.forEach((token) => {
      expect(pilotDashboardDetailSource, `Pilot activity markup must retain the ${token} semantic token.`).toContain(token);
      expect(pilotDashboardThemeSource, `Light mode must explicitly map ${token}.`).toContain(`[class~='${token}']`);
    });

    const activityCardMarkup = pilotDashboardDetailSource.match(
      /\{adherenceOrchestratorCards\.map\(\(card\) => \([\s\S]*?\)\)\}/
    )?.[0];
    expect(activityCardMarkup, 'Expected to find the participation-card markup.').toBeTruthy();
    expect(activityCardMarkup).toContain('text-xs font-semibold uppercase');
    expect(activityCardMarkup).toContain('text-2xl font-semibold leading-none tabular-nums');
    expect(activityCardMarkup).not.toContain('pilot-font-mono');

    const probeRoot = page.locator('.pilot-detail-theme');
    await expect(probeRoot).toBeVisible();
    await probeRoot.evaluate((root) => {
      root.querySelector('[data-testid="pilot-light-readability-probe"]')?.remove();
      const probe = document.createElement('section');
      probe.dataset.testid = 'pilot-light-readability-probe';
      probe.className = 'rounded-3xl border border-white/10 bg-[#11151f] p-5';
      probe.style.cssText = [
        'position:fixed',
        'left:16px',
        'top:16px',
        'z-index:2147483647',
        'width:720px',
        'display:grid',
        'grid-template-columns:1fr 1fr',
        'gap:12px',
      ].join(';');
      probe.innerHTML = `
        <div class="rounded-2xl border border-white/5 bg-black/20 p-4">
          <div data-readability-probe="small-label" class="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Check-in only</div>
          <div data-readability-probe="sky-value" class="mt-3 text-2xl font-semibold leading-none tabular-nums text-sky-100">14</div>
          <div data-readability-probe="orange-value" class="mt-3 text-2xl font-semibold leading-none tabular-nums text-orange-100">1</div>
          <div data-readability-probe="muted-helper" class="mt-2 text-[13px] leading-5 text-zinc-500">Athlete days included in the current participation total.</div>
        </div>
        <div class="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 p-4">
          <p data-readability-probe="privacy-body" class="text-sm leading-6 text-emerald-50/90">This aggregate excludes private check-in content.</p>
          <div data-readability-probe="privacy-footer" class="mt-3 text-[13px] leading-5 text-emerald-100/75">Private check-in content is excluded from this summary.</div>
        </div>
        <div class="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4">
          <p data-readability-probe="closed-enrollment-body" class="text-sm leading-6 text-amber-100/90">This join link is preserved and cannot be shared while enrollment is closed.</p>
        </div>
      `;
      root.appendChild(probe);
    });

    const readabilityProbe = page.getByTestId('pilot-light-readability-probe');
    await expect(readabilityProbe).toBeVisible();
    const checkInLabel = readabilityProbe.locator('[data-readability-probe="small-label"]');
    const checkInValue = readabilityProbe.locator('[data-readability-probe="sky-value"]');
    const followUpValue = readabilityProbe.locator('[data-readability-probe="orange-value"]');
    const privacyBody = readabilityProbe.locator('[data-readability-probe="privacy-body"]');
    const privacyFooter = readabilityProbe.locator('[data-readability-probe="privacy-footer"]');
    const closedEnrollmentBody = readabilityProbe.locator('[data-readability-probe="closed-enrollment-body"]');
    const mutedHelper = readabilityProbe.locator('[data-readability-probe="muted-helper"]');

    const checkInReadability = await expectReadableContrast(checkInValue, 'Check-in-only value');
    await expectReadableContrast(followUpValue, 'Follow-up-needed value');
    await expectReadableContrast(privacyBody, 'Privacy explanation');
    await expectReadableContrast(privacyFooter, 'Privacy footer');
    await expectReadableContrast(closedEnrollmentBody, 'Closed-enrollment explanation');
    await expectReadableContrast(mutedHelper, 'Expected-days helper');

    const smallLabelReadability = await measureComputedReadability(checkInLabel);
    expect(
      smallLabelReadability.fontSizePx,
      `Check-in-only label rendered at ${smallLabelReadability.fontSizePx}px.`
    ).toBeGreaterThanOrEqual(12);
    expect(
      checkInReadability.fontFamily.toLowerCase(),
      `Check-in-only value rendered with ${checkInReadability.fontFamily}.`
    ).not.toContain('dm mono');
  });
});

test.describe('PulseCheck pilot dashboard QR invites', () => {
  test.skip(
    !hasAuthState && !remoteLoginToken && !hasDevAuthBypass,
    'Requires Playwright admin auth state, PLAYWRIGHT_REMOTE_LOGIN_TOKEN, or NEXT_PUBLIC_DEV_AUTH_BYPASS=true.'
  );

  test('shows one automatic athlete join link per destination without creation choices', async ({ page }) => {
    const demoPilotPath = '/admin/pulsecheckPilotDashboard/demo-pilot-correlation-2026';
    await page.addInitScript(() => {
      window.localStorage.setItem('pulsecheckPilotDashboardTheme', 'light');
      window.localStorage.setItem('pulsecheckPilotDashboardDemoMode', 'true');
      if (window.localStorage.getItem('pulsecheckPilotDashboardQrTestInitialized') !== 'true') {
        window.localStorage.removeItem('pulsecheckPilotDashboardDemoStore');
        window.localStorage.setItem('pulsecheckPilotDashboardQrTestInitialized', 'true');
      }
    });

    if (!hasDevAuthBypass) {
      await ensureAdminSession(page, demoPilotPath);
    }
    await page.goto(demoPilotPath, { waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);

    const headerQrButton = page.getByTestId('pilot-dashboard-header-join-qr');
    await expect(headerQrButton).toBeVisible();
    await page.getByTestId('pilot-dashboard-tab-people').click();
    await expect(page.getByTestId('pilot-dashboard-people-invitations')).toContainText('Join link & QR');
    await page.getByTestId('pilot-dashboard-people-invitations').click();
    const joinLinkCard = page.getByTestId('pilot-athlete-invite-qr-card');
    await expect(joinLinkCard).toBeVisible();
    await expect(page.getByTestId('pilot-invite-qr-scope')).toHaveValue('');
    await expect(
      joinLinkCard.getByText(
        'PulseCheck Demo Labs / QuickLifts Performance Demo Team / Correlation Engine Spring Pilot Demo',
        { exact: true }
      )
    ).toBeVisible();
    await expect(joinLinkCard.getByRole('button', { name: /Create Single-Use Link|Create Reusable Link|Create reusable QR/i })).toHaveCount(0);
    await expect(page.getByText('Active Links', { exact: true })).toHaveCount(0);

    const canonicalLink = page.getByTestId('pilot-canonical-athlete-invite-link');
    await expect(canonicalLink).toHaveCount(1);
    await expect(canonicalLink).toBeVisible();
    const pilotJoinUrl = (await canonicalLink.innerText()).trim();
    expect(pilotJoinUrl).toBeTruthy();
    await page.getByTestId('pilot-invite-qr-show-active').click();
    const modal = page.getByTestId('pilot-invite-qr-modal');
    const qrImage = page.getByTestId('pilot-invite-qr-image');
    await expect(modal).toBeVisible();
    await expect(qrImage).toHaveAttribute('src', /^data:image\/png;base64,/);

    const encodedValue = await qrImage.getAttribute('data-encoded-value');
    expect(encodedValue).toBe(pilotJoinUrl);
    expect(new URL(encodedValue || '').origin).toBe(appOrigin);
    await expect(page.getByTestId('pilot-invite-qr-open-link')).toHaveAttribute('href', encodedValue || '');
    await expect(modal).toContainText('QuickLifts Performance Demo Team / Correlation Engine Spring Pilot Demo');
    await page.getByRole('button', { name: /Close QR modal/i }).click();
    await expect(modal).toBeHidden();

    await expect(headerQrButton).toContainText('Show join QR');
    await headerQrButton.click();
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(headerQrButton).toBeFocused();

    await page.getByTestId('pilot-dashboard-people-invitations').click();
    await page.getByTestId('pilot-invite-qr-scope').selectOption('__team__');
    await expect(
      joinLinkCard.getByText(
        'PulseCheck Demo Labs / QuickLifts Performance Demo Team',
        { exact: true }
      )
    ).toBeVisible();
    await expect(canonicalLink).toBeVisible();
    const teamJoinUrl = (await canonicalLink.innerText()).trim();
    expect(teamJoinUrl).toBeTruthy();
    expect(teamJoinUrl).not.toBe(pilotJoinUrl);
    await page.getByTestId('pilot-invite-qr-show-active').click();
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Scan to join QuickLifts Performance Demo Team');
    await expect(modal).toContainText('assigned to this team.');
    await expect(modal).not.toContainText('assigned to this team and pilot.');
    await expect(modal).not.toContainText('QuickLifts Performance Demo Team / Correlation Engine Spring Pilot Demo');
    await expect(qrImage).toHaveAttribute('data-encoded-value', teamJoinUrl);
    await page.getByRole('button', { name: /Close QR modal/i }).click();

    await page.getByTestId('pilot-invite-qr-scope').selectOption('demo-cohort-starters');
    await expect(canonicalLink).toBeVisible();
    const cohortJoinUrl = (await canonicalLink.innerText()).trim();
    expect(cohortJoinUrl).toBeTruthy();
    expect(cohortJoinUrl).not.toBe(pilotJoinUrl);
    expect(cohortJoinUrl).not.toBe(teamJoinUrl);

    await page.getByTestId('pilot-invite-qr-scope').selectOption('');
    await expect(canonicalLink).toHaveText(pilotJoinUrl);

    await page.evaluate(() => {
      const rawStore = window.localStorage.getItem('pulsecheckPilotDashboardDemoStore');
      if (!rawStore) throw new Error('Expected the Pilot dashboard demo store.');
      const store = JSON.parse(rawStore);
      store.pilot.status = 'completed';
      window.localStorage.setItem('pulsecheckPilotDashboardDemoStore', JSON.stringify(store));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);

    await expect(page.getByTestId('pilot-dashboard-header-join-qr')).toContainText('View join link');
    await page.getByTestId('pilot-dashboard-tab-people').click();
    await page.getByTestId('pilot-dashboard-people-invitations').click();
    await expect(page.getByTestId('pilot-canonical-athlete-invite-link')).toHaveText(pilotJoinUrl);
    await expect(page.getByText('Pilot enrollment is closed', { exact: true })).toBeVisible();
    await expect(page.getByText(/is completed and no longer accepts new athletes/i)).toBeVisible();
    await expect(page.getByTestId('pilot-invite-qr-show-active')).toHaveCount(0);
    await expect(page.getByTestId('pilot-canonical-invite-copy')).toHaveCount(0);
    await expect(page.getByTestId('pilot-canonical-invite-open')).toHaveCount(0);

    await page.getByTestId('pilot-dashboard-manage-pilot').click();
    await expect(page.getByTestId('pilot-schedule-reopen-note')).toContainText(
      'The pilot is still marked completed'
    );
    await expect(page.getByTestId('pilot-start-date-save')).toHaveText('Reopen enrollment');
    await confirmPilotStartDateSave(page);
    await expect(
      page.getByText('Pilot schedule updated and enrollment reopened.', { exact: true }).first()
    ).toBeVisible();

    await page.getByTestId('pilot-dashboard-tab-people').click();
    await page.getByTestId('pilot-dashboard-people-invitations').click();
    await expect(page.getByTestId('pilot-invite-qr-show-active')).toBeVisible();
    await expect(page.getByTestId('pilot-canonical-athlete-invite-link')).toHaveText(pilotJoinUrl);
  });
});

test.describe.serial('PulseCheck pilot dashboard', () => {
  test.skip(!hasAuthState && !remoteLoginToken, 'Requires Playwright admin auth state or PLAYWRIGHT_REMOTE_LOGIN_TOKEN.');

  test('@smoke switches into dashboard demo mode', async ({ page }) => {
    await ensureAdminSession(page, '/admin/pulsecheckPilotDashboard');

    await page.goto('/admin/pulsecheckPilotDashboard', { waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);
    await page.evaluate(() => window.localStorage.setItem('pulsecheckPilotDashboardTheme', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('pilot-dashboard-theme-frame')).toHaveAttribute('data-pilot-theme', 'dark');
    await page.getByTestId('pilot-dashboard-theme-toggle').click();
    await expect(page.getByTestId('pilot-dashboard-theme-frame')).toHaveAttribute('data-pilot-theme', 'light');
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('pulsecheckPilotDashboardTheme'))).toBe('light');

    await page.getByTestId('pilot-dashboard-demo-toggle').click();

    await expect(page.getByTestId('pilot-dashboard-demo-banner')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Correlation Engine Spring Pilot Demo' })).toBeVisible();
    await page.getByTestId('pilot-dashboard-metric-help-stable-rate').click();
    await expect(page.getByTestId('pilot-dashboard-metric-help-stable-rate-modal')).toBeVisible();
    await expect(page.getByText('Stable rate is the share of active pilot athletes with at least one stable pattern', { exact: false })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pilot-dashboard-metric-help-stable-rate-modal')).toBeHidden();

    await page.getByRole('link', { name: 'Correlation Engine Spring Pilot Demo' }).click();
    await expect(page.getByTestId('pilot-dashboard-theme-frame')).toHaveAttribute('data-pilot-theme', 'light');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('pilot-dashboard-theme-frame')).toHaveAttribute('data-pilot-theme', 'light');
    await page.getByTestId('pilot-dashboard-theme-toggle').click();
    await expect(page.getByTestId('pilot-dashboard-theme-frame')).toHaveAttribute('data-pilot-theme', 'dark');
    await expect(page.getByTestId('pilot-dashboard-detail-demo-banner')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Correlation Engine Spring Pilot Demo' })).toBeVisible();
    await expect(page.getByTestId('pilot-detail-organization-link')).toHaveAttribute(
      'href',
      '/admin/pulsecheckPilotDashboard/organizations/demo-org-pulsecheck-labs'
    );
    await expect(page.getByTestId('pilot-detail-team-link')).toHaveAttribute(
      'href',
      '/admin/pulsecheckPilotDashboard/teams/demo-team-quicklifts-performance'
    );
    await expect(page.getByTestId('pilot-dashboard-tab-people')).toBeVisible();
    await expect(page.getByTestId('pilot-dashboard-tab-activity-outcomes')).toBeVisible();
    await expect(page.getByTestId('pilot-dashboard-tab-operations')).toBeVisible();
    await expect(page.getByTestId('pilot-dashboard-tab-insights-research')).toBeVisible();

    await page.getByTestId('pilot-dashboard-tab-insights-research').click();
    await expect(page.getByTestId('pilot-dashboard-insights-learning')).toBeVisible();
    await expect(page.getByTestId('pilot-dashboard-insights-hypotheses')).toBeVisible();
    await expect(page.getByTestId('pilot-dashboard-insights-reports')).toBeVisible();
    await page.getByTestId('pilot-dashboard-insights-hypotheses').click();
    await page.getByTestId('pilot-hypothesis-assist-generate').click();
    await expect(page.locator('[data-testid^="pilot-hypothesis-assist-suggestion-"]').first()).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('pilot-dashboard-manage-pilot').click();
    await expect(page.getByRole('heading', { name: 'Settings and admin tools' })).toBeVisible();

    await expect(page.getByTestId('pilot-start-date-settings')).toBeVisible();
    await expect(page.getByText(/Demo mode: this schedule is saved only in this browser/i)).toBeVisible();
    await page.getByTestId('pilot-dashboard-detail-demo-reset').click();

    const originalDemoStartDate = await page.getByTestId('pilot-start-date-input').inputValue();
    const originalDemoEndDate = await page.getByTestId('pilot-end-date-input').inputValue();
    const nextDemoStartDate = shiftDateKey(originalDemoStartDate, 2);
    await page.getByTestId('pilot-start-date-input').fill(nextDemoStartDate);
    await page.getByTestId('pilot-schedule-length').selectOption('14');
    const expectedDemoEndDate = shiftDateKey(nextDemoStartDate, 13);
    await expect(page.getByTestId('pilot-end-date-input')).toHaveValue(expectedDemoEndDate);
    await confirmPilotStartDateSave(page);
    await expect(page.getByText('Pilot schedule updated.', { exact: true }).first()).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForStableAppFrame(page);
    await page.getByTestId('pilot-dashboard-manage-pilot').click();
    await expect(page.getByTestId('pilot-start-date-input')).toHaveValue(nextDemoStartDate);
    await expect(page.getByTestId('pilot-end-date-input')).toHaveValue(expectedDemoEndDate);

    await page.getByTestId('pilot-dashboard-detail-demo-reset').click();
    await expect(page.getByTestId('pilot-start-date-input')).toHaveValue(originalDemoStartDate);
    await expect(page.getByTestId('pilot-end-date-input')).toHaveValue(originalDemoEndDate);
    await page.getByTestId('pilot-dashboard-detail-demo-toggle').click();
    await expect(page).toHaveURL(/\/admin\/pulsecheckPilotDashboard$/);
  });

  test('edits and persists a pilot schedule from Manage pilot', async ({ page }) => {
    const { fixture, adminIdentity } = await seedPilotDashboardFixture(page);

    try {
      const pilotPath = `/admin/pulsecheckPilotDashboard/${encodeURIComponent(fixture.pilotId)}`;
      await page.goto(pilotPath, { waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);
      await page.getByTestId('pilot-dashboard-manage-pilot').click();

      const startDateInput = page.getByTestId('pilot-start-date-input');
      const endDateInput = page.getByTestId('pilot-end-date-input');
      const lengthSelect = page.getByTestId('pilot-schedule-length');
      await expect(page.getByTestId('pilot-start-date-settings')).toBeVisible();
      await expect(page.getByLabel('Start date')).toBeVisible();
      await expect(page.getByLabel('Length')).toBeVisible();
      await expect(page.getByLabel('End date')).toBeVisible();

      const originalStartDate = await startDateInput.inputValue();
      const originalEndDate = await endDateInput.inputValue();
      expect(originalStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(originalEndDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const nextStartDate = shiftDateKey(originalStartDate, 1);
      await startDateInput.fill(nextStartDate);
      await lengthSelect.selectOption('30');
      const expectedEndDate = shiftDateKey(nextStartDate, 29);
      await expect(endDateInput).toHaveValue(expectedEndDate);
      await expect(page.getByTestId('pilot-start-date-save')).toBeEnabled();
      await confirmPilotStartDateSave(page);

      await expect(page.getByText('Pilot schedule updated.', { exact: true }).first()).toBeVisible();
      await expect(endDateInput).toHaveValue(expectedEndDate);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);
      await expect(page.getByRole('heading', { name: fixture.pilotName })).toBeVisible();
      await page.getByTestId('pilot-dashboard-manage-pilot').click();
      await expect(page.getByTestId('pilot-start-date-input')).toHaveValue(nextStartDate);
      await expect(page.getByTestId('pilot-end-date-input')).toHaveValue(expectedEndDate);
      await expect(page.getByTestId('pilot-schedule-length')).toHaveValue('30');

      await page.getByTestId('pilot-schedule-clear').click();
      await expect(page.getByTestId('pilot-start-date-input')).toHaveValue('');
      await expect(page.getByTestId('pilot-end-date-input')).toHaveValue('');
      await confirmPilotStartDateSave(page);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);
      await page.getByTestId('pilot-dashboard-manage-pilot').click();
      await expect(page.getByTestId('pilot-start-date-input')).toHaveValue('');
      await expect(page.getByTestId('pilot-end-date-input')).toHaveValue('');
      await expect(page.getByTestId('pilot-schedule-length')).toHaveValue('custom');
    } finally {
      await cleanupPilotDashboardFixture(page, adminIdentity);
    }
  });

  test('rejects a custom pilot schedule when the start date is after the end date', async ({ page }) => {
    const { fixture, adminIdentity } = await seedPilotDashboardFixture(page);

    try {
      const pilotPath = `/admin/pulsecheckPilotDashboard/${encodeURIComponent(fixture.pilotId)}`;
      await page.goto(pilotPath, { waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);
      await page.getByTestId('pilot-dashboard-manage-pilot').click();

      const startDateInput = page.getByTestId('pilot-start-date-input');
      const originalStartDate = await startDateInput.inputValue();
      const endDateInput = page.getByTestId('pilot-end-date-input');
      const endDate = await endDateInput.inputValue();
      expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      await page.getByTestId('pilot-schedule-length').selectOption('custom');
      await startDateInput.fill(shiftDateKey(endDate!, 1));
      await expect(page.getByTestId('pilot-start-date-error')).toHaveText(
        'Start date must be on or before the pilot end date.'
      );
      await expect(page.getByTestId('pilot-start-date-save')).toBeDisabled();

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);
      await page.getByTestId('pilot-dashboard-manage-pilot').click();
      await expect(page.getByTestId('pilot-start-date-input')).toHaveValue(originalStartDate);
    } finally {
      await cleanupPilotDashboardFixture(page, adminIdentity);
    }
  });

  test('shows a real-time athlete join toast and opens the correct team roster', async ({ page }) => {
    const { fixture, adminIdentity } = await seedPilotDashboardFixture(page);

    try {
      await page.goto('/admin/pulsecheckPilotDashboard', { waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);
      const joinToastRegion = page.getByTestId('pilot-dashboard-athlete-join-toasts');
      await expect(joinToastRegion).toHaveAttribute('data-listener-state', 'ready', { timeout: 30_000 });
      await expect(page.getByTestId('pilot-dashboard-athlete-join-toast')).toHaveCount(0);

      const joinedAthlete = await page.evaluate(
        async ({ namespace }) => window.__pulseE2E?.addPulseCheckPilotDashboardAthlete({ namespace }),
        { namespace: fixture.namespace }
      );
      if (!joinedAthlete?.athleteId) {
        throw new Error('Failed to add the live-join Pilot dashboard athlete fixture.');
      }

      const joinToast = page.getByTestId('pilot-dashboard-athlete-join-toast');
      await expect(joinToast).toBeVisible({ timeout: 30_000 });
      await expect(joinToast).toContainText('New athlete joined');
      await expect(joinToast).toContainText(`${joinedAthlete.athleteName} joined ${joinedAthlete.teamName}.`);
      const athleteTeamFilter = page.getByTestId('pilot-athlete-team-filter');
      const allTeamsPill = athleteTeamFilter.getByTestId('pilot-athlete-team-filter-all');
      const teamSearch = athleteTeamFilter.getByRole('combobox', { name: 'Search roster teams or organizations' });
      await expect(allTeamsPill).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 });
      await teamSearch.fill(joinedAthlete.teamName);
      const joinedTeamOption = athleteTeamFilter.getByTestId(
        `pilot-athlete-team-filter-option-${joinedAthlete.teamId}`
      );
      await expect(joinedTeamOption).toBeVisible();
      await expect(joinedTeamOption).toContainText(joinedAthlete.teamName);
      await joinedTeamOption.click();
      const joinedTeamPill = athleteTeamFilter.getByTestId(
        `pilot-athlete-team-filter-pill-${joinedAthlete.teamId}`
      );
      await expect(joinedTeamPill).toBeVisible();
      await expect(allTeamsPill).toHaveAttribute('aria-pressed', 'false');
      await page.keyboard.press('Escape');
      await joinToast.getByTestId('pilot-dashboard-athlete-join-view').click();

      await expect(page).toHaveURL(new RegExp(
        `teamId=${encodeURIComponent(joinedAthlete.teamId)}.*athleteId=${encodeURIComponent(joinedAthlete.athleteId)}`
      ));
      await expect(page.locator('select').nth(1)).toHaveValue(joinedAthlete.teamId);
      await expect(joinedTeamPill).toBeVisible();
      const athleteDrawer = page.locator('.pilot-drawer');
      await expect(athleteDrawer).toBeVisible({ timeout: 30_000 });
      await expect(athleteDrawer.getByText(joinedAthlete.athleteName, { exact: true })).toBeVisible();

      await joinedTeamPill.getByRole('button', { name: `Remove ${joinedAthlete.teamName}` }).click();
      await expect(joinedTeamPill).toHaveCount(0);
      await expect(allTeamsPill).toHaveAttribute('aria-pressed', 'true');
      await expect(athleteDrawer).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`athleteId=${encodeURIComponent(joinedAthlete.athleteId)}`));
      await expect(page).not.toHaveURL(/teamId=/);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);
      await expect(page.locator('.pilot-drawer')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.pilot-drawer').getByText(joinedAthlete.athleteName, { exact: true })).toBeVisible();

      await page.getByTestId(`pilot-athlete-remove-team-${joinedAthlete.teamId}`).click();
      const removalModal = page.getByTestId('pilot-athlete-removal-modal');
      await expect(removalModal).toBeVisible();
      await expect(page.getByTestId('pilot-athlete-removal-description')).toContainText(
        `Remove ${joinedAthlete.athleteName} from ${joinedAthlete.teamName}?`
      );
      await page.getByTestId('pilot-athlete-removal-confirm').click();
      await expect(page.getByTestId('pilot-athlete-removal-notice')).toContainText(
        `${joinedAthlete.athleteName} was removed from ${joinedAthlete.teamName}.`,
        { timeout: 30_000 }
      );
      await expect(page.locator('.pilot-drawer')).toHaveCount(0);
      await expect(joinToastRegion).toHaveAttribute('data-listener-state', 'ready');

      const rejoinedAthlete = await page.evaluate(
        async ({ namespace }) => window.__pulseE2E?.addPulseCheckPilotDashboardAthlete({ namespace }),
        { namespace: fixture.namespace }
      );
      if (!rejoinedAthlete?.athleteId) {
        throw new Error('Failed to reactivate the live-join Pilot dashboard athlete fixture.');
      }

      await expect(joinToast).toBeVisible({ timeout: 30_000 });
      await expect(joinToast).toContainText('New athlete joined');
      await expect(joinToast).toContainText(
        `${rejoinedAthlete.athleteName} joined ${rejoinedAthlete.teamName}.`
      );
      await joinToast.getByTestId('pilot-dashboard-athlete-join-view').click();
      await expect(page.locator('.pilot-drawer')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.pilot-drawer').getByText(rejoinedAthlete.athleteName, { exact: true })).toBeVisible();
    } finally {
      await cleanupPilotDashboardFixture(page, adminIdentity);
    }
  });

  test('keeps pilot detail visible after its final athlete is unenrolled', async ({ page }) => {
    test.setTimeout(180_000);

    const { fixture, adminIdentity } = await seedPilotDashboardFixture(page);

    try {
      const pilotPath = `/admin/pulsecheckPilotDashboard/${encodeURIComponent(fixture.pilotId)}`;
      await page.goto(pilotPath, { waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);
      await expect(page.getByRole('heading', { name: fixture.pilotName })).toBeVisible();
      await page.getByTestId('pilot-dashboard-tab-people').click();

      for (const athleteName of fixture.athleteNames) {
        const athleteRow = page
          .locator('tr')
          .filter({ has: page.getByText(athleteName, { exact: true }) })
          .first();
        await expect(athleteRow).toBeVisible({ timeout: 30_000 });
        const confirmationHandled = new Promise<{ type: string; message: string }>((resolve, reject) => {
          page.once('dialog', async (dialog) => {
            try {
              const confirmation = { type: dialog.type(), message: dialog.message() };
              await dialog.accept();
              resolve(confirmation);
            } catch (dialogError) {
              reject(dialogError);
            }
          });
        });

        await athleteRow.getByRole('button', { name: 'Unenroll from pilot' }).click();
        const confirmation = await confirmationHandled;
        expect(confirmation.type).toBe('confirm');
        expect(confirmation.message).toContain(`Unenroll ${athleteName} from ${fixture.pilotName}?`);
        await expect(
          page.getByRole('status').filter({
            hasText: `${athleteName} was unenrolled from this pilot and no longer counts toward active pilot reporting.`,
          })
        ).toBeVisible({ timeout: 30_000 });
      }

      await expect(page).toHaveURL(new RegExp(`${pilotPath}$`));
      await expect(page.getByRole('heading', { name: fixture.pilotName })).toBeVisible();
      await expect(page.getByText('Pilot not found.', { exact: true })).toHaveCount(0);
      const activeParticipantsValue = page
        .getByText('Active participants', { exact: true })
        .locator('xpath=../div[contains(@class, "text-2xl")]');
      await expect(activeParticipantsValue).toHaveText('0');

      await page.getByTestId('pilot-dashboard-tab-overview').click();
      const athletesJoinedValue = page
        .getByText('Athletes joined', { exact: true })
        .locator('xpath=../div[contains(@class, "text-2xl")]');
      await expect(athletesJoinedValue).toHaveText('0');

      await page.getByTestId('pilot-dashboard-tab-people').click();
      await page.getByTestId('pilot-dashboard-people-eligible').click();
      const eligibleAthleteRow = page
        .locator('tr')
        .filter({ has: page.getByText(fixture.athleteNames[0], { exact: true }) })
        .first();
      await expect(eligibleAthleteRow).toBeVisible({ timeout: 30_000 });
      await eligibleAthleteRow.getByRole('button', { name: 'Remove from team' }).click();
      await expect(page.getByTestId('pilot-athlete-removal-modal')).toBeVisible();
      await expect(page.getByTestId('pilot-athlete-removal-description')).toContainText(
        `Remove ${fixture.athleteNames[0]} from`
      );
      await page.getByTestId('pilot-athlete-removal-cancel').click();
      await expect(page.getByTestId('pilot-athlete-removal-modal')).toHaveCount(0);
    } finally {
      await cleanupPilotDashboardFixture(page, adminIdentity);
    }
  });

  test('navigates organization and team detail routes and handles missing hierarchy records', async ({ page }) => {
    const { fixture, adminIdentity } = await seedPilotDashboardFixture(page);

    const dashboardPath = '/admin/pulsecheckPilotDashboard';
    const organizationPath = `${dashboardPath}/organizations/${encodeURIComponent(fixture.organizationId)}`;
    const teamPath = `${dashboardPath}/teams/${encodeURIComponent(fixture.teamId)}`;
    const pilotPath = `${dashboardPath}/${encodeURIComponent(fixture.pilotId)}`;

    try {
      await page.goto(dashboardPath, { waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);

      const organizationOpenLink = page.getByTestId(`pilot-organization-open-${fixture.organizationId}`);
      const teamOpenLink = page.getByTestId(`pilot-team-open-${fixture.teamId}`);
      await expect(organizationOpenLink).toBeVisible({ timeout: 30_000 });
      await expect(organizationOpenLink).toHaveAttribute('href', organizationPath);
      await expect(teamOpenLink).toBeVisible();
      await expect(teamOpenLink).toHaveAttribute('href', teamPath);

      await organizationOpenLink.click();
      await expect(page).toHaveURL(new URL(organizationPath, appBaseURL).toString());
      const organizationDetail = page.getByTestId('pilot-organization-detail');
      await expect(organizationDetail).toBeVisible({ timeout: 30_000 });

      await page.getByTestId('pilot-hierarchy-tab-pilots').click();
      await expect(page.getByTestId('pilots-section')).toBeVisible();
      await expect(page.getByTestId(`pilot-pilot-open-${fixture.pilotId}`)).toContainText(fixture.pilotName);

      await page.getByTestId('pilot-hierarchy-tab-teams').click();
      await expect(page.getByTestId('teams-section')).toBeVisible();
      const organizationTeamLink = page.getByTestId(`pilot-team-open-${fixture.teamId}`);
      await expect(organizationTeamLink).toBeVisible();
      await expect(organizationTeamLink).toHaveAttribute('href', teamPath);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);
      await expect(page).toHaveURL(new URL(organizationPath, appBaseURL).toString());
      await expect(page.getByTestId('pilot-organization-detail')).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('pilot-hierarchy-tab-teams').click();
      await page.getByTestId(`pilot-team-open-${fixture.teamId}`).click();

      await expect(page).toHaveURL(new URL(teamPath, appBaseURL).toString());
      const teamDetail = page.getByTestId('pilot-team-detail');
      await expect(teamDetail).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('pilot-hierarchy-tab-pilots').click();
      await expect(page.getByTestId('pilots-section')).toBeVisible();
      const teamPilotLink = page.getByTestId(`pilot-pilot-open-${fixture.pilotId}`);
      await expect(teamPilotLink).toBeVisible();
      await expect(teamPilotLink).toContainText(fixture.pilotName);
      await expect(teamPilotLink).toHaveAttribute('href', pilotPath);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);
      await expect(page).toHaveURL(new URL(teamPath, appBaseURL).toString());
      await expect(page.getByTestId('pilot-team-detail')).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('pilot-hierarchy-tab-pilots').click();
      await page.getByTestId(`pilot-pilot-open-${fixture.pilotId}`).click();

      await expect(page).toHaveURL(new URL(pilotPath, appBaseURL).toString());
      await expect(page.getByRole('heading', { name: fixture.pilotName })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('pilot-detail-organization-link')).toHaveAttribute('href', organizationPath);
      await expect(page.getByTestId('pilot-detail-team-link')).toHaveAttribute('href', teamPath);

      await page.goto(dashboardPath, { waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);
      await page.getByTestId(`pilot-team-open-${fixture.teamId}`).click();
      await expect(page).toHaveURL(new URL(teamPath, appBaseURL).toString());
      await expect(page.getByTestId('pilot-team-detail')).toBeVisible({ timeout: 30_000 });

      const missingOrganizationPath = `${dashboardPath}/organizations/missing-organization`;
      await page.goto(missingOrganizationPath, { waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);
      await expect(page).toHaveURL(new URL(missingOrganizationPath, appBaseURL).toString());
      await expect(page.getByTestId('pilot-organization-not-found')).toBeVisible({ timeout: 30_000 });
      const missingOrganizationBackLink = page.getByTestId('pilot-organization-not-found-back');
      await expect(missingOrganizationBackLink).toHaveAttribute('href', dashboardPath);
      await missingOrganizationBackLink.click();
      await expect(page).toHaveURL(new URL(dashboardPath, appBaseURL).toString());

      const missingTeamPath = `${dashboardPath}/teams/missing-team`;
      await page.goto(missingTeamPath, { waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);
      await expect(page).toHaveURL(new URL(missingTeamPath, appBaseURL).toString());
      await expect(page.getByTestId('pilot-team-not-found')).toBeVisible({ timeout: 30_000 });
      const missingTeamBackLink = page.getByTestId('pilot-team-not-found-back');
      await expect(missingTeamBackLink).toHaveAttribute('href', dashboardPath);
      await missingTeamBackLink.click();
      await expect(page).toHaveURL(new URL(dashboardPath, appBaseURL).toString());
    } finally {
      await cleanupPilotDashboardFixture(page, adminIdentity);
    }
  });

  test('@smoke shows the active pilot directory and research brief in pilot scope', async ({ page }) => {
    const { fixture, adminIdentity } = await seedPilotDashboardFixture(page);

    try {
      await page.goto('/admin/pulsecheckPilotDashboard', { waitUntil: 'domcontentloaded' });
      await waitForStableAppFrame(page);

      await expect(page.getByRole('heading', { name: 'Pilot Dashboard' })).toBeVisible();
      await expect(page.getByRole('link', { name: fixture.pilotName })).toBeVisible();

      await page.getByRole('link', { name: fixture.pilotName }).click();

      await expect(page.getByRole('heading', { name: fixture.pilotName })).toBeVisible();
      await expect(page.getByText('Follow enrollment, participation, data readiness, and pilot learning in one place.')).toBeVisible();

      await page.getByTestId('pilot-dashboard-tab-people').click();
      await expect(page.getByRole('heading', { name: 'Pilot participants' })).toBeVisible();
      await expect(page.getByTestId('pilot-dashboard-people-participants')).toBeVisible();
      await expect(page.getByTestId('pilot-dashboard-people-eligible')).toBeVisible();
      await expect(page.getByTestId('pilot-dashboard-people-invitations')).toBeVisible();
      await expect(page.getByText(fixture.athleteNames[0], { exact: true })).toBeVisible();

      await page.getByTestId('pilot-dashboard-people-eligible').click();
      await expect(page.getByRole('heading', { name: 'Eligible team athletes' })).toBeVisible();
      await expect(page.getByText('No eligible team athletes match this search.')).toBeVisible();
      await page.getByTestId('pilot-dashboard-people-invitations').click();

      const joinLinkCard = page.getByTestId('pilot-athlete-invite-qr-card');
      await expect(joinLinkCard).toBeVisible();
      await expect(joinLinkCard.getByRole('button', { name: /Create Single-Use Link|Create Reusable Link|Create reusable QR/i })).toHaveCount(0);
      const canonicalJoinLink = page.getByTestId('pilot-canonical-athlete-invite-link');
      await expect(canonicalJoinLink).toHaveCount(1);
      await expect(canonicalJoinLink).toBeVisible();
      const inviteDiagnostics = page.getByTestId('pilot-invite-diagnostics');
      await expect(inviteDiagnostics).toBeVisible();
      await expect(inviteDiagnostics).toContainText('Link Check');
      await expect(inviteDiagnostics).toContainText('Needs attention');
      await expect(page.getByTestId('pilot-canonical-invite-copy')).toBeVisible();
      await page.getByTestId('pilot-invite-qr-show-active').click();
      await expect(page.getByTestId('pilot-invite-qr-modal')).toBeVisible();
      const inviteQrImage = page.getByTestId('pilot-invite-qr-image');
      await expect(inviteQrImage).toHaveAttribute('src', /^data:image\/png;base64,/);
      const encodedInviteUrl = await inviteQrImage.getAttribute('data-encoded-value');
      expect(encodedInviteUrl).toBeTruthy();
      await expect(page.getByTestId('pilot-invite-qr-open-link')).toHaveAttribute('href', encodedInviteUrl || '');
      await page.getByRole('button', { name: /Close QR modal/i }).click();
      await expect(page.getByTestId('pilot-invite-qr-modal')).toBeHidden();

      await page.getByTestId('pilot-dashboard-tab-insights-research').click();
      await page.getByTestId('pilot-dashboard-insights-reports').click();

      await expect(page.getByRole('heading', { name: 'Research Brief' })).toBeVisible();
      await expect(page.locator('[data-testid^="pilot-readout-history-"]')).toHaveCount(2);
      await expect(page.getByTestId('pilot-readout-section-pilot-summary')).toBeVisible();
      await expect(page.getByTestId('pilot-readout-section-hypothesis-mapper')).toBeVisible();
      await expect(
        page.getByTestId('pilot-readout-section-hypothesis-mapper').getByTestId('pilot-readout-hypothesis-H1')
      ).toContainText('Promising');
      await expect(page.getByTestId('pilot-readout-section-research-notes')).toContainText('Candidate findings only');
    } finally {
      await cleanupPilotDashboardFixture(page, adminIdentity);
    }
  });

  test('shows the low-sample trust and NPS fallback copy on the pilot dashboard', async ({ page }) => {
    test.setTimeout(120_000);
    const { fixture, adminIdentity } = await seedPilotDashboardFixture(page, {
      surveyResponses: [
        {
          id: 'trust-response-1',
          respondentUserId: 'athlete-low-sample-a',
          respondentRole: 'athlete',
          surveyKind: 'trust',
          score: 8,
        },
        {
          id: 'trust-response-2',
          respondentUserId: 'athlete-low-sample-b',
          respondentRole: 'athlete',
          surveyKind: 'trust',
          score: 7,
        },
        {
          id: 'nps-response-1',
          respondentUserId: 'athlete-low-sample-c',
          respondentRole: 'athlete',
          surveyKind: 'nps',
          score: 9,
        },
        {
          id: 'nps-response-2',
          respondentUserId: 'athlete-low-sample-d',
          respondentRole: 'athlete',
          surveyKind: 'nps',
          score: 6,
        },
        {
          id: 'coach-trust-response-1',
          respondentUserId: 'coach-low-sample-a',
          respondentRole: 'coach',
          surveyKind: 'trust',
          score: 8,
        },
        {
          id: 'coach-nps-response-1',
          respondentUserId: 'coach-low-sample-b',
          respondentRole: 'coach',
          surveyKind: 'nps',
          score: 7,
        },
        {
          id: 'clinician-trust-response-1',
          respondentUserId: 'clinician-low-sample-a',
          respondentRole: 'clinician',
          surveyKind: 'trust',
          score: 9,
        },
        {
          id: 'clinician-nps-response-1',
          respondentUserId: 'clinician-low-sample-b',
          respondentRole: 'clinician',
          surveyKind: 'nps',
          score: 8,
        },
      ],
    });

    try {
      await page.goto(`/admin/pulsecheckPilotDashboard/${encodeURIComponent(fixture.pilotId)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForStableAppFrame(page);

      await page.getByTestId('pilot-dashboard-manage-pilot').click();
      await page.getByRole('button', { name: 'Refresh pilot data' }).click();
      await waitForStableAppFrame(page);
      await page.getByTestId('pilot-dashboard-tab-activity-outcomes').click();

      const trustDiagnosticsSection = page.locator('section,div').filter({ hasText: 'Role-Sliced Trust and NPS' }).first();
      await expect(page.getByText('Not enough responses yet').first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/2\/5 responses collected · below sample threshold/).first()).toBeVisible({ timeout: 30_000 });
      await expect(trustDiagnosticsSection).toContainText('Coach Trust');
      await expect(trustDiagnosticsSection).toContainText('Coach NPS');
      await expect(trustDiagnosticsSection).toContainText('Clinician Trust');
      await expect(trustDiagnosticsSection).toContainText('Clinician NPS');
      await expect(trustDiagnosticsSection).toContainText('below sample threshold');
    } finally {
      await cleanupPilotDashboardFixture(page, adminIdentity);
    }
  });

  test('keeps cohort filtering local to activity and research measures', async ({ page }) => {
    const { fixture, adminIdentity } = await seedPilotDashboardFixture(page);

    try {
      await page.goto(`/admin/pulsecheckPilotDashboard/${encodeURIComponent(fixture.pilotId)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForStableAppFrame(page);

      await expect(page.getByRole('combobox', { name: 'View by cohort' })).toHaveCount(0);
      await page.getByTestId('pilot-dashboard-tab-activity-outcomes').click();
      const activityCohortFilter = page.getByRole('combobox', { name: 'View by cohort' });
      await expect(activityCohortFilter).toBeVisible();
      await expect(page.getByText(/This filter applies to the activity, learning, and research measures/i)).toBeVisible();
      await activityCohortFilter.selectOption(fixture.cohortIds[1]);

      await expect(page.getByText('Cohort view')).toBeVisible();
      await expect(page.getByText('79.0% adherence')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('6.7 trust')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('83.0% adherence')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('7.0 trust')).toBeVisible({ timeout: 30_000 });

      await page.getByTestId('pilot-dashboard-tab-insights-research').click();
      await expect(page.getByRole('combobox', { name: 'View by cohort' })).toHaveValue(fixture.cohortIds[1]);
      await expect(page.getByTestId('pilot-dashboard-insights-learning')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Learning by cohort' })).toBeVisible();

      await page.getByTestId('pilot-dashboard-tab-people').click();
      await expect(page.getByRole('combobox', { name: 'View by cohort' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Pilot participants' })).toBeVisible();

      await page.getByTestId('pilot-dashboard-tab-activity-outcomes').click();
      await expect(page.getByRole('combobox', { name: 'View by cohort' })).toHaveValue('');
    } finally {
      await cleanupPilotDashboardFixture(page, adminIdentity);
    }
  });

  test('uses progressive disclosure and distinguishes missing measures from measured zero states', async ({ page }) => {
    const { fixture, adminIdentity } = await seedPilotDashboardFixture(page);

    try {
      await page.goto(`/admin/pulsecheckPilotDashboard/${encodeURIComponent(fixture.pilotId)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForStableAppFrame(page);

      await expect(page.getByText('Participation has not been measured for this pilot yet.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Refresh pilot data' })).toHaveCount(0);

      await page.getByTestId('pilot-dashboard-tab-activity-outcomes').click();
      const adherencePanel = page.getByTestId('pilot-dashboard-adherence-orchestrator');
      await expect(adherencePanel).toContainText('Participation has not been measured for this pilot yet.');
      await expect(page.getByText('Trust and adherence by recommendation path')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('State-Aware vs Fallback')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('Coach notified')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('Handoff accepted')).toBeVisible({ timeout: 30_000 });

      await page.getByTestId('pilot-dashboard-tab-operations').click();
      await expect(page.getByText('No active restrictions, holds, or queued reviews across this pilot.')).toBeVisible();
      await expect(page.getByText(/Counts in Operations use active participants across the whole pilot/i)).toBeVisible();

      await page.getByTestId('pilot-dashboard-tab-insights-research').click();
      await expect(page.getByTestId('pilot-dashboard-insights-learning')).toBeVisible();
      await page.getByTestId('pilot-dashboard-insights-hypotheses').click();
      await expect(page.getByText(/Hypothesis records and status totals belong to the whole pilot/i)).toBeVisible();
      await page.getByTestId('pilot-dashboard-insights-reports').click();
      await expect(page.getByText('Readiness Gates').first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('sample-size: passed').first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('denominator-availability: passed').first()).toBeVisible({ timeout: 30_000 });

      await page.getByTestId('pilot-dashboard-manage-pilot').click();
      await expect(page.getByRole('heading', { name: 'Settings and data tools' })).toBeVisible();
      await page.getByRole('button', { name: 'Refresh pilot data' }).click();
      await waitForStableAppFrame(page);
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

      await page.getByTestId('pilot-dashboard-tab-people').click();
      const athleteRow = page.locator('tr').filter({ hasText: fixture.athleteNames[0] }).first();
      await athleteRow.getByRole('link', { name: 'Open athlete' }).click();

      await expect(page.getByRole('heading', { name: fixture.athleteNames[0] })).toBeVisible();
      await expect(page.getByText(/Athlete drill-down inside one pilot/i)).toBeVisible();
      await expect(page.getByText('Enrollment status: active')).toBeVisible();
      await expect(page.getByText('Normalized Incidents')).toBeVisible();
      await expect(page.getByText('This uses the same grouped-incident normalization shown in the pilot dashboard rollout review.')).toBeVisible();
      await expect(page.getByText('Stable Patterns')).toBeVisible();
      await expect(page.getByText('Recent Patterns')).toBeVisible();
    } finally {
      await cleanupPilotDashboardFixture(page, adminIdentity);
    }
  });

  test('supports per-athlete Seed data backfill from the pilot athletes table', async ({ page }) => {
    test.skip(!allowWriteTests, 'Requires PLAYWRIGHT_ALLOW_WRITE_TESTS=true.');

    const { fixture, adminIdentity } = await seedPilotDashboardFixture(page);

    try {
      await page.goto(`/admin/pulsecheckPilotDashboard/${encodeURIComponent(fixture.pilotId)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForStableAppFrame(page);

      await page.getByTestId('pilot-dashboard-tab-people').click();
      const athleteRow = page.locator('tr').filter({ hasText: fixture.athleteNames[0] }).first();
      const seedButton = athleteRow.getByRole('button', { name: 'Seed data' });

      await expect(seedButton).toBeVisible();
      await seedButton.click();
      await expect(athleteRow.getByRole('button', { name: 'Seeding data...' })).toBeVisible({ timeout: 10_000 });
      await expect(athleteRow.getByRole('button', { name: 'Seed data' })).toBeVisible({ timeout: 60_000 });
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

      await page.getByTestId('pilot-dashboard-tab-insights-research').click();
      await page.getByTestId('pilot-dashboard-insights-reports').click();

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
