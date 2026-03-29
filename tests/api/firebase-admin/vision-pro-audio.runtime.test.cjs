const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  compileTypeScriptRuntime,
  createFirestoreAdminMock,
  createNextApiResponseRecorder,
  loadCompiledModule,
  repoRoot,
} = require('./_runtimeHarness.cjs');

const visionProResetSoundsFunctionPath = path.join(
  repoRoot,
  'netlify/functions/vision-pro-reset-sounds.js'
);
const audioRunAlertsFunctionPath = path.join(
  repoRoot,
  'netlify/functions/audio-run-alerts.js'
);

const compiledAudioRuntime = compileTypeScriptRuntime({
  cacheKey: 'firebase-admin-vision-pro-audio',
  entryPaths: [
    path.join(repoRoot, 'src/pages/api/vision-pro/reset-sounds.ts'),
    path.join(repoRoot, 'src/pages/api/audio/run-alerts.ts'),
  ],
});

function loadResetSoundsModule(adminMock) {
  return loadCompiledModule({
    compiled: compiledAudioRuntime,
    fileName: 'reset-sounds.js',
    mocks: {
      '/server/firebase/app-registry': {
        admin: adminMock,
        ensureDefaultFirebaseAdminApp() {
          return { name: '[DEFAULT]' };
        },
      },
    },
  });
}

function loadRunAlertsModule(adminMock) {
  return loadCompiledModule({
    compiled: compiledAudioRuntime,
    fileName: 'run-alerts.js',
    mocks: {
      '/server/firebase/app-registry': {
        admin: adminMock,
        ensureDefaultFirebaseAdminApp() {
          return { name: '[DEFAULT]' };
        },
      },
    },
  });
}

function loadNetlifyAudioFunction(modulePath, adminMock) {
  const configPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');

  delete require.cache[modulePath];
  delete require.cache[configPath];

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      initializeFirebaseAdmin() {
        return adminMock;
      },
    },
  };

  try {
    return require(modulePath);
  } finally {
    delete require.cache[modulePath];
    delete require.cache[configPath];
  }
}

test('vision-pro/reset-sounds returns only well-formed reset cues', async () => {
  const { admin } = createFirestoreAdminMock({
    collections: {
      'sim-audio-assets': [
        {
          id: 'cue-1',
          data: {
            family: 'vision-pro-reset',
            cueKey: 'lockInAmbientDrone',
            label: 'Lock In',
            downloadURL: 'https://cdn.example.com/lock-in.mp3',
            updatedAt: 101,
          },
        },
        {
          id: 'cue-2',
          data: {
            family: 'vision-pro-reset',
            cueKey: 'missingDownload',
            label: 'Broken cue',
            updatedAt: 102,
          },
        },
        {
          id: 'cue-3',
          data: {
            family: 'different-family',
            cueKey: 'ignore-me',
            label: 'Ignore',
            downloadURL: 'https://cdn.example.com/ignore.mp3',
            updatedAt: 103,
          },
        },
      ],
    },
  });

  const { default: handler } = loadResetSoundsModule(admin);
  const response = createNextApiResponseRecorder();

  await handler({ method: 'GET' }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    cues: [
      {
        cueKey: 'lockInAmbientDrone',
        label: 'Lock In',
        downloadURL: 'https://cdn.example.com/lock-in.mp3',
        updatedAt: 101,
      },
    ],
  });
});

test('vision-pro/reset-sounds rejects non-GET methods', async () => {
  const admin = {
    firestore() {
      throw new Error('firestore should not be touched for method rejection');
    },
  };
  const { default: handler } = loadResetSoundsModule(admin);
  const response = createNextApiResponseRecorder();

  await handler({ method: 'POST' }, response);

  assert.equal(response.statusCode, 405);
  assert.deepEqual(response.body, { error: 'Method not allowed' });
});

test('audio/run-alerts dedupes bundle targets and keeps the newest cue', async () => {
  const { admin } = createFirestoreAdminMock({
    collections: {
      'sim-audio-assets': [
        {
          id: 'alert-old',
          data: {
            family: 'community-run-alerts',
            cueKey: 'paceWarningV1',
            label: 'Pace Warning',
            bundleTarget: 'pace-warning',
            downloadURL: 'https://cdn.example.com/pace-v1.mp3',
            updatedAt: 5,
          },
        },
        {
          id: 'alert-new',
          data: {
            family: 'community-run-alerts',
            cueKey: 'paceWarningV2',
            label: 'Pace Warning',
            bundleTarget: 'pace-warning',
            downloadURL: 'https://cdn.example.com/pace-v2.mp3',
            updatedAt: 9,
          },
        },
        {
          id: 'alert-other',
          data: {
            family: 'community-run-alerts',
            cueKey: 'hydrationPrompt',
            label: 'Hydrate',
            bundleTarget: 'hydration',
            downloadURL: 'https://cdn.example.com/hydrate.mp3',
            updatedAt: 4,
          },
        },
        {
          id: 'alert-malformed',
          data: {
            family: 'community-run-alerts',
            cueKey: 'broken',
            label: 'Broken',
            updatedAt: 100,
          },
        },
      ],
    },
  });

  const { default: handler } = loadRunAlertsModule(admin);
  const response = createNextApiResponseRecorder();

  await handler({ method: 'GET' }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    cues: [
      {
        cueKey: 'paceWarningV2',
        label: 'Pace Warning',
        bundleTarget: 'pace-warning',
        downloadURL: 'https://cdn.example.com/pace-v2.mp3',
        updatedAt: 9,
      },
      {
        cueKey: 'hydrationPrompt',
        label: 'Hydrate',
        bundleTarget: 'hydration',
        downloadURL: 'https://cdn.example.com/hydrate.mp3',
        updatedAt: 4,
      },
    ],
  });
});

test('audio/run-alerts rejects non-GET methods', async () => {
  const { default: handler } = loadRunAlertsModule({ firestore() { throw new Error('should not run'); } });
  const response = createNextApiResponseRecorder();

  await handler({ method: 'POST' }, response);

  assert.equal(response.statusCode, 405);
  assert.deepEqual(response.body, { error: 'Method not allowed' });
});

test('vision-pro-reset-sounds Netlify function returns only well-formed reset cues', async () => {
  const { admin } = createFirestoreAdminMock({
    collections: {
      'sim-audio-assets': [
        {
          id: 'cue-1',
          data: {
            family: 'vision-pro-reset',
            cueKey: 'lockInAmbientDrone',
            label: 'Lock In',
            downloadURL: 'https://cdn.example.com/lock-in.mp3',
            updatedAt: 101,
          },
        },
        {
          id: 'cue-2',
          data: {
            family: 'vision-pro-reset',
            cueKey: 'missingDownload',
            label: 'Broken cue',
            updatedAt: 102,
          },
        },
      ],
    },
  });

  const { handler } = loadNetlifyAudioFunction(visionProResetSoundsFunctionPath, admin);
  const response = await handler({ httpMethod: 'GET', headers: {} });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    cues: [
      {
        cueKey: 'lockInAmbientDrone',
        label: 'Lock In',
        downloadURL: 'https://cdn.example.com/lock-in.mp3',
        updatedAt: 101,
      },
    ],
  });
});

test('audio-run-alerts Netlify function dedupes bundle targets and keeps the newest cue', async () => {
  const { admin } = createFirestoreAdminMock({
    collections: {
      'sim-audio-assets': [
        {
          id: 'alert-old',
          data: {
            family: 'community-run-alerts',
            cueKey: 'paceWarningV1',
            label: 'Pace Warning',
            bundleTarget: 'pace-warning',
            downloadURL: 'https://cdn.example.com/pace-v1.mp3',
            updatedAt: 5,
          },
        },
        {
          id: 'alert-new',
          data: {
            family: 'community-run-alerts',
            cueKey: 'paceWarningV2',
            label: 'Pace Warning',
            bundleTarget: 'pace-warning',
            downloadURL: 'https://cdn.example.com/pace-v2.mp3',
            updatedAt: 9,
          },
        },
        {
          id: 'alert-other',
          data: {
            family: 'community-run-alerts',
            cueKey: 'hydrationPrompt',
            label: 'Hydrate',
            bundleTarget: 'hydration',
            downloadURL: 'https://cdn.example.com/hydrate.mp3',
            updatedAt: 4,
          },
        },
      ],
    },
  });

  const { handler } = loadNetlifyAudioFunction(audioRunAlertsFunctionPath, admin);
  const response = await handler({ httpMethod: 'GET', headers: {} });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    cues: [
      {
        cueKey: 'paceWarningV2',
        label: 'Pace Warning',
        bundleTarget: 'pace-warning',
        downloadURL: 'https://cdn.example.com/pace-v2.mp3',
        updatedAt: 9,
      },
      {
        cueKey: 'hydrationPrompt',
        label: 'Hydrate',
        bundleTarget: 'hydration',
        downloadURL: 'https://cdn.example.com/hydrate.mp3',
        updatedAt: 4,
      },
    ],
  });
});
