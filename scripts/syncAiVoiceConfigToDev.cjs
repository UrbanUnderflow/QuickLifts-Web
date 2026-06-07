'use strict';

/**
 * Copy the Nora voice config (app-config/ai-voice) from PRODUCTION to DEV so the
 * dev environment plays the same voice you chose in prod.
 *
 *   - Reads  PROD (quicklifts-dd3f1) via the shared admin credential resolver.
 *   - Writes DEV  (quicklifts-dev-01) via your gcloud Application Default
 *     Credentials (so no dev service-account key is needed).
 *
 * READ-ONLY on prod. The only write is the single dev `app-config/ai-voice` doc.
 *
 *   node scripts/syncAiVoiceConfigToDev.cjs            # dry run — prints prod config
 *   node scripts/syncAiVoiceConfigToDev.cjs --confirm  # write it to dev
 */

const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const PROD_PROJECT = 'quicklifts-dd3f1';
const DEV_PROJECT = process.env.DEV_FIREBASE_PROJECT_ID || 'quicklifts-dev-01';
const COLLECTION = 'app-config';
const DOC_ID = 'ai-voice';

async function main() {
  const confirm = process.argv.includes('--confirm');

  // The dev admin key is on disk (GOOGLE_APPLICATION_CREDENTIALS). Use it for the
  // dev write, then clear it so the prod read falls back to the developer's
  // gcloud user ADC (owner), which can read prod — the dev key cannot.
  const devKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const devCredential = devKeyPath ? cert(require(devKeyPath)) : applicationDefault();
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const prodApp = initializeApp({ credential: applicationDefault(), projectId: PROD_PROJECT }, 'ai-voice-prod');
  const devApp = initializeApp({ credential: devCredential, projectId: DEV_PROJECT }, 'ai-voice-dev');
  const prodDb = getFirestore(prodApp);
  const devDb = getFirestore(devApp);

  const prodSnap = await prodDb.collection(COLLECTION).doc(DOC_ID).get();
  if (!prodSnap.exists) {
    console.error(`✗ Prod ${COLLECTION}/${DOC_ID} not found in ${PROD_PROJECT}. Nothing to copy.`);
    process.exit(1);
  }

  const data = prodSnap.data() || {};
  // Only the voice-selection fields. NOT the narration asset maps
  // (pulseCheckTutorialNarrations / macraOnboardingNarrations) — those point at
  // env-specific Storage and belong to each project's own libraries.
  const voiceConfig = {
    provider: data.provider,
    voiceId: data.voiceId,
    presetId: data.presetId ?? null,
    elevenLabsSettings: data.elevenLabsSettings ?? null,
    punctuationPauses: data.punctuationPauses ?? null,
  };

  console.log(`\nProd Nora voice selection (${PROD_PROJECT}):`);
  console.log(JSON.stringify(voiceConfig, null, 2));

  const devSnap = await devDb.collection(COLLECTION).doc(DOC_ID).get();
  const devData = devSnap.exists ? devSnap.data() : null;
  console.log(`\nCurrent dev voice selection (${DEV_PROJECT}):`);
  console.log(
    devData
      ? JSON.stringify(
          {
            provider: devData.provider,
            voiceId: devData.voiceId,
            presetId: devData.presetId ?? null,
          },
          null,
          2
        )
      : '(none — using built-in default OpenAI/Alloy)'
  );

  if (!confirm) {
    console.log(`\n[dry-run] Re-run with --confirm to copy the prod voice selection into dev ${DEV_PROJECT} (merge — narration libraries untouched).`);
    return;
  }

  await devDb.collection(COLLECTION).doc(DOC_ID).set({ ...voiceConfig, updatedAt: Date.now() }, { merge: true });
  console.log(`\n✅ Dev ${DEV_PROJECT} Nora voice now matches prod (ElevenLabs ${voiceConfig.voiceId} / ${voiceConfig.presetId}).`);
}

main().catch((error) => {
  console.error('✗ Failed to sync ai-voice config:', error?.message || error);
  process.exit(1);
});
