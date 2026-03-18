import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const defaultStorageStatePath = path.resolve(process.cwd(), '.playwright/admin-storage-state.json');
const hasAuthState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE) || existsSync(defaultStorageStatePath);
const remoteLoginToken = process.env.PLAYWRIGHT_REMOTE_LOGIN_TOKEN;
const appBaseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const appOrigin = new URL(appBaseURL).origin;
const protocolNamespace = process.env.PLAYWRIGHT_E2E_NAMESPACE || 'e2e-protocol-practice';
const protocolPreviewAudioPath = path.resolve(process.cwd(), 'public/audio/sfx/half-way-there.mp3');

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function installInstantAudioPlayback(page: Page) {
  await page.addInitScript(() => {
    const originalPlay = HTMLMediaElement.prototype.play;

    HTMLMediaElement.prototype.play = function patchedPlay(this: HTMLMediaElement) {
      const playResult = originalPlay ? originalPlay.call(this) : Promise.resolve();
      window.setTimeout(() => {
        const endedEvent = new Event('ended');
        this.dispatchEvent(endedEvent);
        if (typeof this.onended === 'function') {
          this.onended(endedEvent);
        }
      }, 30);
      return playResult;
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
  await page.waitForTimeout(1500);

  const useWebAppButton = page.getByRole('button', { name: /Use Web App/i });
  if (await useWebAppButton.isVisible().catch(() => false)) {
    await useWebAppButton.click().catch(() => {});
    await page.waitForTimeout(1500);
    await page.goto(nextPath, { waitUntil: 'domcontentloaded' });
  }
}

async function waitForPulseE2EHarness(page: Page) {
  await page.waitForFunction(() => Boolean(window.__pulseE2E), undefined, { timeout: 20_000 }).catch(() => null);
}

async function seedProtocolRegistry(page: Page) {
  await waitForPulseE2EHarness(page);
  await page.evaluate(async () => {
    await window.__pulseE2E?.syncPulseCheckProtocolRegistrySeeds?.();
  }).catch(() => null);
}

async function mockInstantAudioPlayback(page: Page) {
  await page.addInitScript(() => {
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
      queueMicrotask(() => {
        this.dispatchEvent(new Event('ended'));
      });
      return Promise.resolve();
    };

    (window as any).__pulseRestoreAudioPlay = () => {
      HTMLMediaElement.prototype.play = originalPlay;
    };
  });
}

async function selectProtocolRuntime(page: Page, runtimeLabel: string) {
  const runtimeButton = page.getByRole('button', { name: new RegExp(runtimeLabel, 'i') }).last();
  if (await runtimeButton.isVisible().catch(() => false)) {
    await runtimeButton.scrollIntoViewIfNeeded();
    await runtimeButton.click();
    await expect(page.getByRole('button', { name: /Preview Protocol/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Preview Protocol/i }).click();
    return;
  }

  const runtimeRow = page.locator('tr', { hasText: new RegExp(runtimeLabel, 'i') }).first();
  await expect(runtimeRow).toBeVisible({ timeout: 20_000 });
  await runtimeRow.scrollIntoViewIfNeeded();
  await runtimeRow.getByRole('button', { name: /Preview/i }).click();
}

async function openProtocolRuntimeFromHierarchy(page: Page) {
  await seedProtocolRegistry(page);
  const protocolRegistryButton = page.getByRole('button', { name: /Protocol Registry/i }).first();
  if (await protocolRegistryButton.isVisible().catch(() => false)) {
    await protocolRegistryButton.click();
  }
  await expect(page.getByText(/Hierarchy Workspace/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Cognitive Reframe/i }).first().click();
  await expect(page.getByRole('button', { name: /Nerves to Excitement Reframe/i }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Nerves to Excitement Reframe/i }).first().click();
  await expect(page.getByRole('button', { name: /Preview Protocol/i })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Preview Protocol/i }).click();
}

async function openProtocolRegistryPreview(page: Page, runtimeLabel: string) {
  await selectProtocolRuntime(page, runtimeLabel);
}

async function openPublishedProtocolPreview(page: Page) {
  await openProtocolRuntimeFromHierarchy(page);
}

async function startPromptExerciseFromPreview(page: Page) {
  await expect(page.getByRole('button', { name: /Begin Exercise/i })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Begin Exercise/i }).click();
  await expect(page.getByText(/Before we begin/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Neutral/i }).click();
}

async function advanceTeachFlowToPractice(page: Page) {
  for (let step = 0; step < 8; step += 1) {
    const beginPractice = page.getByRole('button', { name: /Begin Practice/i });
    if (await beginPractice.isVisible().catch(() => false)) {
      await beginPractice.click();
      return;
    }

    const nextButton = page.getByRole('button', { name: /^Next$/i });
    if (await nextButton.isVisible().catch(() => false)) {
      await nextButton.click();
      await page.waitForTimeout(150);
      continue;
    }

    await page.waitForTimeout(300);
  }

  await expect(page.getByRole('button', { name: /Begin Practice/i })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Begin Practice/i }).click();
}

test.describe('Protocol Practice Conversation', () => {
  test('system overview exposes the practice conversation spec artifact', async ({ page }) => {
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');

    await ensureAdminSession(page, '/admin/systemOverview#pulsecheck-protocol-governance-spec');
    await page.getByRole('button', { name: /Practice Conversation Spec/i }).first().click();
    await expect(page.getByRole('heading', { name: /Protocol Practice Conversation Spec/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /Runtime State Machine/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Implementation Checklist/i)).toBeVisible({ timeout: 20_000 });
  });

  test('protocol narration requests Nora TTS when the primary request succeeds', async ({ page }) => {
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');

    await installInstantAudioPlayback(page);
    await ensureAdminSession(page, '/admin/systemOverview#protocol-registry');
    await mockInstantAudioPlayback(page);
    await page.route('**/tts-mental-step', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'audio/mpeg',
        body: readFileSync(protocolPreviewAudioPath),
      });
    });

    await openPublishedProtocolPreview(page);
    const ttsRequest = page.waitForRequest(
      (request) => request.url().includes('/tts-mental-step') && request.method() === 'POST'
    );
    await startPromptExerciseFromPreview(page);
    await ttsRequest;

    await expect(page.getByText(/Step 1 of \d+/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^Next$/i })).toBeVisible({ timeout: 20_000 });
  });

  test('protocol narration stays on the current prompt when Nora TTS fails', async ({ page }) => {
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');

    await ensureAdminSession(page, '/admin/systemOverview#protocol-registry');
    await mockInstantAudioPlayback(page);
    await page.route('**/tts-mental-step', async (route) => {
      route.fulfill({
        status: 404,
        contentType: 'text/html; charset=utf-8',
        body: '<html><body>Not Found</body></html>',
      });
    });

    await openPublishedProtocolPreview(page);
    const ttsRequest = page.waitForRequest(
      (request) => request.url().includes('/tts-mental-step') && request.method() === 'POST'
    );
    await startPromptExerciseFromPreview(page);
    await ttsRequest;

    await expect(page.getByText(/Step 1 of \d+/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Step 2 of \d+/i)).not.toBeVisible({ timeout: 5_000 });
  });

  test('protocol preview runs teach, practice, adaptive follow-up, and evaluation with typed responses', async ({ page }) => {
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');

    await ensureAdminSession(page, '/admin/systemOverview#protocol-registry');
    await mockInstantAudioPlayback(page);
    await page.route('**/tts-mental-step', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'audio/mpeg',
        body: readFileSync(protocolPreviewAudioPath),
      });
    });

    await openPublishedProtocolPreview(page);
    await startPromptExerciseFromPreview(page);
    await advanceTeachFlowToPractice(page);

    await expect(page.getByRole('button', { name: /Start Conversation/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Start Conversation/i }).click();

    await expect(page.getByText(/Practice Turn 1 of 3/i)).toBeVisible({ timeout: 20_000 });
    await page.locator('textarea').fill('My heart is racing and my palms are sweaty.');
    await page.getByRole('button', { name: /Submit Answer/i }).click();
    await expect(page.getByText(/Nora Feedback/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^Continue$/i }).click();

    await expect(page.getByText(/Practice Turn 2 of 3/i)).toBeVisible({ timeout: 20_000 });
    await page.locator('textarea').fill('I am nervous.');
    await page.getByRole('button', { name: /Submit Answer/i }).click();
    await expect(page.getByRole('button', { name: /Try Nora’s Follow-Up/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Try Nora’s Follow-Up/i }).click();
    await page.locator('textarea').fill('The same body signal means I am excited, fueled, and ready, not in danger.');
    await page.getByRole('button', { name: /Submit Answer/i }).click();
    await page.getByRole('button', { name: /^Continue$/i }).click();

    await expect(page.getByText(/Practice Turn 3 of 3/i)).toBeVisible({ timeout: 20_000 });
    await page.locator('textarea').fill('These butterflies are fuel. I am ready to compete and execute.');
    await page.getByRole('button', { name: /Submit Answer/i }).click();
    await page.getByRole('button', { name: /^Continue$/i }).click();

    await expect(page.getByText(/Protocol Evaluation/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Here is how your reframe rep looked/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('p').filter({ hasText: /^Signal awareness$/i }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Continue To Closeout/i })).toBeVisible({ timeout: 20_000 });
  });

  test('microphone capture populates the transcript review field when speech recognition is available', async ({ page }) => {
    test.skip(!hasAuthState && !remoteLoginToken, 'Requires PLAYWRIGHT_STORAGE_STATE or PLAYWRIGHT_REMOTE_LOGIN_TOKEN for authenticated admin access.');

    await page.addInitScript(() => {
      class MockSpeechRecognition {
        continuous = false;
        interimResults = true;
        lang = 'en-US';
        onresult: ((event: any) => void) | null = null;
        onerror: ((event: any) => void) | null = null;
        onend: (() => void) | null = null;

        start() {
          setTimeout(() => {
            this.onresult?.({
              resultIndex: 0,
              results: [
                {
                  0: { transcript: 'I am ready and this is fuel.', confidence: 0.91 },
                  isFinal: true,
                  length: 1,
                },
              ],
            });
            this.onend?.();
          }, 60);
        }

        stop() {
          this.onend?.();
        }
      }

      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    });

    await ensureAdminSession(page, '/admin/systemOverview#protocol-registry');
    await page.route('**/tts-mental-step', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'audio/mpeg',
        body: readFileSync(protocolPreviewAudioPath),
      });
    });

    await openPublishedProtocolPreview(page);
    await startPromptExerciseFromPreview(page);
    await advanceTeachFlowToPractice(page);
    await page.getByRole('button', { name: /Start Conversation/i }).click();

    await expect(page.getByText(/Practice Turn 1 of 3/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Start voice capture/i }).click();
    await expect(page.locator('textarea')).toHaveValue(/I am ready and this is fuel\./i, { timeout: 20_000 });
    await expect(page.getByText(/Transcript confidence: 91%/i)).toBeVisible({ timeout: 20_000 });
  });
});
