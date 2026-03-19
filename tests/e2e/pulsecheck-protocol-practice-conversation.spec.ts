import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const defaultStorageStatePath = path.resolve(process.cwd(), '.playwright/admin-storage-state.json');
const hasAuthState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE) || existsSync(defaultStorageStatePath);
const remoteLoginToken = process.env.PLAYWRIGHT_REMOTE_LOGIN_TOKEN;
const appBaseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const appOrigin = new URL(appBaseURL).origin;
const protocolNamespaceBase = process.env.PLAYWRIGHT_E2E_NAMESPACE;
const protocolNamespace = protocolNamespaceBase
  ? `${protocolNamespaceBase}-practice`
  : 'e2e-protocol-practice';
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

async function installProtocolPracticeEvaluationMock(page: Page) {
  const turnEvaluations = [
    {
      noraFeedback: 'You named the body signal quickly. Now tie it to the job you need to do next.',
      strengths: ['You spotted the body cue right away.'],
      misses: ['Name the next action, not just the feeling.'],
      scores: {
        signalAwareness: 4,
        techniqueFidelity: 3,
        languageQuality: 3,
        shiftQuality: 3,
        coachability: 4,
      },
    },
    {
      noraFeedback: 'This is still a little broad. Say exactly what the nerves mean for your next move.',
      strengths: ['You kept the tone steady under pressure.'],
      misses: ['Turn the feeling into a direct action cue.'],
      scores: {
        signalAwareness: 3,
        techniqueFidelity: 2,
        languageQuality: 2,
        shiftQuality: 2,
        coachability: 3,
      },
      followUpPrompt: {
        id: 'clarify-next-move',
        targetDimension: 'shiftQuality',
        promptText: 'Finish this in one line: these nerves mean I should...',
      },
    },
    {
      noraFeedback: 'That was clearer. Keep the same tone and make the next answer just as specific.',
      strengths: ['You turned the feeling into an action cue.'],
      misses: ['Trim extra words so the cue lands even faster.'],
      scores: {
        signalAwareness: 4,
        techniqueFidelity: 4,
        languageQuality: 4,
        shiftQuality: 4,
        coachability: 5,
      },
    },
    {
      noraFeedback: 'That sounded competition-usable. You kept it direct and gave yourself a real cue to act on.',
      strengths: ['You finished with direct, usable language.'],
      misses: ['Start this specific on the first answer next rep.'],
      scores: {
        signalAwareness: 4,
        techniqueFidelity: 4,
        languageQuality: 4,
        shiftQuality: 4,
        coachability: 4,
      },
    },
  ];

  const sessionScorecard = {
    overallScore: 4.1,
    dimensionScores: {
      signalAwareness: 4.0,
      techniqueFidelity: 4.2,
      languageQuality: 4.1,
      shiftQuality: 4.0,
      coachability: 4.4,
    },
    strengths: [
      'You got more specific as the rep went on.',
      'Your final language sounded usable under pressure.',
    ],
    improvementAreas: [
      'Start that specific on the first answer.',
      'Keep each response tied to one concrete action.',
    ],
    evaluationSummary: 'This rep became more competition-ready as it went on. You got more specific and more usable under pressure.',
    nextRepFocus: 'Turn the first body signal into a one-line action cue right away.',
    coachabilityTrend: 'improving',
    voiceSignalsSummary: undefined,
    evaluationSource: 'ai',
    evaluationModel: 'gpt-5-nano',
    evaluationLatencyMs: 37,
  };

  let turnRequestCount = 0;
  let sessionRequestCount = 0;

  await page.route('**/api/mentaltraining/evaluate-protocol-practice', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');

    if (payload.action === 'turn') {
      const template = turnEvaluations[turnRequestCount];
      turnRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          evaluation: {
            turn: {
              id: `mock-turn-${turnRequestCount}`,
              promptId: payload.turnSpecId,
              promptLabel: `Prompt ${turnRequestCount}`,
              promptText: payload.input?.followUpPromptText || `Prompt ${turnRequestCount}`,
              responseText: payload.input?.responseText || '',
              modality: payload.input?.modality || 'text',
              followUpPromptId: payload.input?.followUpPromptId,
              followUpPromptText: payload.input?.followUpPromptText,
              usedAdaptiveFollowUp: Boolean(payload.input?.usedAdaptiveFollowUp),
              transcriptReviewed: Boolean(payload.input?.transcriptReviewed),
              voiceSignals: payload.input?.voiceSignals,
              scores: template.scores,
              strengths: template.strengths,
              misses: template.misses,
              noraFeedback: template.noraFeedback,
              evaluationSource: 'ai',
              evaluationModel: 'gpt-5-nano',
              evaluationLatencyMs: 31,
              submittedAt: Date.now(),
            },
            shouldUseAdaptiveFollowUp: Boolean(template.followUpPrompt),
            followUpPrompt: template.followUpPrompt || null,
          },
        }),
      });
      return;
    }

    if (payload.action === 'session') {
      sessionRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scorecard: sessionScorecard,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unsupported test action' }),
    });
  });

  return {
    getCounts: () => ({
      turnRequestCount,
      sessionRequestCount,
    }),
  };
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
  await page.getByRole('button', { name: /Begin Exercise/i }).click({ force: true });
  await expect(page.getByText(/Before we begin/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Neutral/i }).click({ force: true });
}

async function advanceTeachFlowToPractice(page: Page) {
  for (let step = 0; step < 8; step += 1) {
    const beginPractice = page.getByRole('button', { name: /Begin Practice/i });
    if (await beginPractice.isVisible().catch(() => false)) {
      await beginPractice.click({ force: true });
      return;
    }

    const nextButton = page.getByRole('button', { name: /^Next$/i });
    if (await nextButton.isVisible().catch(() => false)) {
      await nextButton.click({ force: true });
      await page.waitForTimeout(150);
      continue;
    }

    await page.waitForTimeout(300);
  }

  await expect(page.getByRole('button', { name: /Begin Practice/i })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Begin Practice/i }).click({ force: true });
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
    const evaluationMock = await installProtocolPracticeEvaluationMock(page);
    const spokenTexts: string[] = [];
    await page.route('**/tts-mental-step', async (route) => {
      const body = route.request().postDataJSON() as { text?: string } | undefined;
      if (body?.text) {
        spokenTexts.push(body.text);
      }
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
    await expect(page.getByRole('heading', { name: /You named the body signal quickly\. Now tie it to the job you need to do next\./i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/You spotted the body cue right away\./i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Name the next action, not just the feeling\./i)).toBeVisible({ timeout: 20_000 });
    await expect.poll(() =>
      spokenTexts.some((text) =>
        text.includes('You named the body signal quickly. Now tie it to the job you need to do next.')
        && text.includes('What landed: You spotted the body cue right away.')
        && text.includes('What to sharpen: Name the next action, not just the feeling.')
      )
    ).toBe(true);
    await expect(page.getByRole('button', { name: /^Continue$/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^Continue$/i }).click({ force: true });

    await expect(page.getByText(/Practice Turn 2 of 3/i)).toBeVisible({ timeout: 20_000 });
    await page.locator('textarea').fill('I am nervous.');
    await page.getByRole('button', { name: /Submit Answer/i }).click();
    await expect(page.getByRole('heading', { name: /This is still a little broad\. Say exactly what the nerves mean for your next move\./i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Try Nora’s Follow-Up/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Try Nora’s Follow-Up/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Try Nora’s Follow-Up/i }).click({ force: true });
    await expect(page.getByText(/Finish this in one line: these nerves mean I should\.\.\./i)).toBeVisible({ timeout: 20_000 });
    await page.locator('textarea').fill('The same body signal means I am excited, fueled, and ready, not in danger.');
    await page.getByRole('button', { name: /Submit Answer/i }).click();
    await expect(page.getByRole('heading', { name: /That was clearer\. Keep the same tone and make the next answer just as specific\./i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/You turned the feeling into an action cue\./i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^Continue$/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^Continue$/i }).click({ force: true });

    await expect(page.getByText(/Practice Turn 3 of 3/i)).toBeVisible({ timeout: 20_000 });
    await page.locator('textarea').fill('These butterflies are fuel. I am ready to compete and execute.');
    await page.getByRole('button', { name: /Submit Answer/i }).click();
    await expect(page.getByRole('heading', { name: /That sounded competition-usable\. You kept it direct and gave yourself a real cue to act on\./i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^Continue$/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^Continue$/i }).click({ force: true });

    await expect(page.getByText(/Protocol Evaluation/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /This rep became more competition-ready as it went on\. You got more specific and more usable under pressure\./i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/You got more specific as the rep went on\./i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Start that specific on the first answer\./i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/4\.2 \/ 5/i)).toBeVisible({ timeout: 20_000 });
    await expect.poll(() =>
      spokenTexts.some((text) =>
        text.includes('This rep became more competition-ready as it went on. You got more specific and more usable under pressure.')
        && text.includes('What landed: You got more specific as the rep went on.')
        && text.includes('Next rep focus: Start that specific on the first answer.')
      )
    ).toBe(true);
    await expect(page.locator('p').filter({ hasText: /^Signal awareness$/i }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Continue To Closeout/i })).toBeVisible({ timeout: 20_000 });
    expect(evaluationMock.getCounts()).toEqual({
      turnRequestCount: 4,
      sessionRequestCount: 1,
    });
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
