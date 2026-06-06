#!/usr/bin/env node

/**
 * One-off migration cleanup: clear Stripe Connect linkage so connected users
 * re-onboard on the new Pulse Intelligence Labs account.
 *
 * The old `acct_…RobSf56MUO…` connected accounts belong to the old platform and are
 * invalid under the new PIL keys. create-connected-account.js reuses an existing
 * `creator.stripeAccountId` if present (and errors under new keys), so we clear it.
 *
 * For each user that has `creator.stripeAccountId`, this:
 *   1. deletes `creator.stripeAccountId`, `stripeAccountId`, `stripeAccountDetails`,
 *      `creator.stripeAccountDetails` on users/{uid}
 *   2. deletes the stripeConnect/{uid} doc
 * Next time the user opens Connect onboarding, a fresh PIL account is created.
 *
 * Usage:
 *   node scripts/clear-stripe-connect-for-migration.js            # DRY RUN (default — no writes)
 *   node scripts/clear-stripe-connect-for-migration.js --apply    # actually clear
 *
 * Credentials (no key is hardcoded — provide one of):
 *   - ./serviceAccountKey.json (gitignored), or
 *   - FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON env (full service-account JSON string), or
 *   - GOOGLE_APPLICATION_CREDENTIALS (ADC) for project quicklifts-dd3f1
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const PROJECT_ID = 'quicklifts-dd3f1';

function resolveCredential() {
  const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    console.log('🔑 Using serviceAccountKey.json');
    return cert(require(keyPath));
  }
  const envJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (envJson) {
    console.log('🔑 Using FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON');
    return cert(JSON.parse(envJson));
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('🔑 Using application default credentials');
    return applicationDefault();
  }
  console.error(
    '❌ No admin credentials. Provide serviceAccountKey.json, FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON, or GOOGLE_APPLICATION_CREDENTIALS.',
  );
  process.exit(1);
}

const app = initializeApp({ credential: resolveCredential(), projectId: PROJECT_ID }, 'clear-stripe-connect');
const db = getFirestore(app);

const apply = process.argv.slice(2).includes('--apply');

async function findAffectedUserIds() {
  const ids = new Set();

  // 1) Users with a creator.stripeAccountId (the re-onboard trigger).
  try {
    const snap = await db.collection('users').orderBy('creator.stripeAccountId').get();
    snap.forEach((doc) => {
      const v = doc.get('creator.stripeAccountId');
      if (v) ids.add(doc.id);
    });
  } catch (err) {
    console.warn('⚠️  users orderBy(creator.stripeAccountId) failed (continuing with stripeConnect scan):', err.message);
  }

  // 2) Anything in the stripeConnect collection (one doc per connected account).
  const connectSnap = await db.collection('stripeConnect').get();
  connectSnap.forEach((doc) => ids.add(doc.id));

  return [...ids];
}

async function run() {
  console.log(`\n🚀 Clear Stripe Connect for migration  ${apply ? '(APPLY — WILL WRITE)' : '(DRY RUN — no writes)'}\n`);

  const userIds = await findAffectedUserIds();
  console.log(`Found ${userIds.length} affected user(s):`);

  for (const uid of userIds) {
    const userRef = db.collection('users').doc(uid);
    const connectRef = db.collection('stripeConnect').doc(uid);
    const [userSnap, connectSnap] = await Promise.all([userRef.get(), connectRef.get()]);

    const creatorAcct = userSnap.exists ? userSnap.get('creator.stripeAccountId') : null;
    const topAcct = userSnap.exists ? userSnap.get('stripeAccountId') : null;
    const connectAcct = connectSnap.exists ? connectSnap.get('stripeAccountId') : null;
    console.log(
      `  • ${uid}  creator.stripeAccountId=${creatorAcct || '-'}  stripeAccountId=${topAcct || '-'}  stripeConnect=${connectAcct || '-'}`,
    );

    if (!apply) continue;

    if (userSnap.exists) {
      await userRef.update({
        'creator.stripeAccountId': FieldValue.delete(),
        'creator.stripeAccountDetails': FieldValue.delete(),
        stripeAccountId: FieldValue.delete(),
        stripeAccountDetails: FieldValue.delete(),
      });
      console.log('      ↳ cleared user doc fields');
    }
    if (connectSnap.exists) {
      await connectRef.delete();
      console.log('      ↳ deleted stripeConnect doc');
    }
  }

  console.log(
    apply
      ? `\n✅ Done. Cleared ${userIds.length} user(s). They will re-onboard a fresh PIL Connect account on next attempt.`
      : `\n👀 Dry run complete. Re-run with --apply to clear the ${userIds.length} user(s) above.`,
  );
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
