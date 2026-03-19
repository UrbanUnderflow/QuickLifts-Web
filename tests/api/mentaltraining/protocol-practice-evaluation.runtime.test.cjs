const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const { loadProtocolPracticeRuntime } = require('./_tsRuntimeHarness.cjs');
const harnessPath = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/tests/api/mentaltraining/_tsRuntimeHarness.cjs';
const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function createOpenAIMock(resolver) {
  return class OpenAIMock {
    constructor() {
      this.responses = {
        create: async (input) => ({
          output_text: JSON.stringify(await resolver(input)),
        }),
      };
    }
  };
}

test('turn evaluation route returns AI-scored turn feedback and adaptive follow-up', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.PULSECHECK_PROTOCOL_EVALUATION_MODEL = 'gpt-5-nano';

  const { evaluator } = loadProtocolPracticeRuntime({
    openai: createOpenAIMock(async () => ({
        scores: {
          signalAwareness: 4,
          techniqueFidelity: 2,
          languageQuality: 4,
          shiftQuality: 3,
          coachability: 4,
        },
        strengths: ['You named the body signal quickly.'],
        misses: ['Make the breath sequence more concrete.'],
        noraFeedback: 'You found the right signal fast. Now tighten the actual breath step so it sounds usable.',
        shouldUseAdaptiveFollowUp: true,
        followUpPromptId: 'apply-breath-followup',
      }),
    ),
  });

  const specId = 'practice-regulation-acute-downshift';
  const req = {
    method: 'POST',
    body: {
      action: 'turn',
      specId,
      turnSpecId: 'apply-breath',
      input: {
        responseText: 'I will take one full inhale and then a long exhale.',
        modality: 'text',
        usedAdaptiveFollowUp: false,
      },
      priorTurns: [],
    },
  };
  const res = createResponseRecorder();

  await evaluator.default(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.model, 'gpt-5-nano');
  assert.equal(res.body.evaluation.turn.evaluationSource, 'ai');
  assert.equal(res.body.evaluation.turn.evaluationModel, 'gpt-5-nano');
  assert.equal(res.body.evaluation.turn.noraFeedback, 'You found the right signal fast. Now tighten the actual breath step so it sounds usable.');
  assert.deepEqual(res.body.evaluation.turn.strengths, ['You named the body signal quickly.']);
  assert.deepEqual(res.body.evaluation.turn.misses, ['Make the breath sequence more concrete.']);
  assert.equal(res.body.evaluation.shouldUseAdaptiveFollowUp, true);
  assert.equal(res.body.evaluation.followUpPrompt.id, 'apply-breath-followup');
});

test('session evaluation route returns AI-scored final scorecard with voice summary', async () => {
  const script = `
    const assert = require('node:assert/strict');
    const { loadProtocolPracticeRuntime } = require(${JSON.stringify(harnessPath)});

    process.env.OPENAI_API_KEY = 'test-key';
    process.env.PULSECHECK_PROTOCOL_EVALUATION_MODEL = 'gpt-5-nano';

    function createResponseRecorder() {
      return {
        statusCode: 200,
        body: undefined,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };
    }

    const { evaluator } = loadProtocolPracticeRuntime({
      openai: class OpenAIMock {
        constructor() {
          this.responses = {
            create: async () => ({
              output_text: JSON.stringify({
                overallScore: 4.2,
                dimensionScores: {
                  signalAwareness: 4.1,
                  techniqueFidelity: 4.3,
                  languageQuality: 4.0,
                  shiftQuality: 4.2,
                  coachability: 4.4,
                },
                strengths: ['Your language sounded usable under pressure.', 'You kept improving across the reps.'],
                improvementAreas: ['Keep the next rep even more specific to the moment.'],
                evaluationSummary: 'This sounded much more competition-usable. You stayed direct, and the language got sharper as you went.',
                nextRepFocus: 'Keep the same tone and make the next answer even more specific to the pressure moment.',
                coachabilityTrend: 'improving',
              }),
            }),
          };
        }
      },
    });

    (async () => {
      const req = {
        method: 'POST',
        body: {
          action: 'session',
          specId: 'practice-regulation-acute-downshift',
          turns: [
            {
              id: 't1',
              promptId: 'notice-spike',
              promptText: 'What is your body doing right now that tells you the stress spike is real?',
              responseText: 'My chest is tight and my breathing is short.',
              modality: 'voice',
              scores: {
                signalAwareness: 4,
                techniqueFidelity: 3,
                languageQuality: 3,
                shiftQuality: 3,
                coachability: 3,
              },
              strengths: ['You noticed a real body signal.'],
              misses: [],
              noraFeedback: 'Good. Stay with that signal.',
              voiceSignals: {
                transcriptConfidence: 0.9,
                confidenceQualified: true,
                wordsPerMinute: 110,
              },
              submittedAt: Date.now(),
            },
          ],
        },
      };
      const res = createResponseRecorder();
      await evaluator.default(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.scorecard.evaluationSource, 'ai');
      assert.equal(res.body.scorecard.evaluationModel, 'gpt-5-nano');
      assert.equal(res.body.scorecard.evaluationSummary, 'This sounded much more competition-usable. You stayed direct, and the language got sharper as you went.');
      assert.equal(res.body.scorecard.coachabilityTrend, 'improving');
      assert.match(res.body.scorecard.voiceSignalsSummary, /Voice capture looked usable/);
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `;

  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout || 'Session evaluation subprocess failed.');
});

test('route returns 404 when protocol practice spec cannot be found', async () => {
  process.env.OPENAI_API_KEY = 'test-key';

  const { evaluator } = loadProtocolPracticeRuntime({
    openai: createOpenAIMock(async () => ({
        overallScore: 4,
        dimensionScores: {
          signalAwareness: 4,
          techniqueFidelity: 4,
          languageQuality: 4,
          shiftQuality: 4,
          coachability: 4,
        },
        strengths: ['Strong.'],
        improvementAreas: ['Sharpen one thing.'],
        evaluationSummary: 'Good overall.',
        nextRepFocus: 'Stay specific.',
        coachabilityTrend: 'steady',
      }),
    ),
  });

  const req = {
    method: 'POST',
    body: {
      action: 'session',
      specId: 'missing-spec',
      turns: [],
    },
  };
  const res = createResponseRecorder();

  await evaluator.default(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'Protocol practice spec not found');
});
