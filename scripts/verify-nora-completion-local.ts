import { loadEnvConfig } from '@next/env';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { getFirebaseAdminApp } from '../src/lib/firebase-admin';

async function main() {
  loadEnvConfig(process.cwd());
  process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE = 'true';
  const admin = getFirebaseAdminApp(true);
  const uid = `nora-completion-test-${randomUUID()}`;
  const assignmentId = `${uid}-assignment`;
  const { auth, db, app } = await import('../src/api/firebase/config');
  assert.equal(
    app.options.projectId,
    admin.options.projectId,
    'Client and admin must both use development',
  );
  const { signInWithCustomToken, signOut } = require('firebase/auth');
  const { doc, getDocFromServer, terminate } = require('firebase/firestore');
  const { completionService } = await import(
    '../src/api/firebase/mentaltraining/completionService'
  );
  const { ExerciseCategory } = await import(
    '../src/api/firebase/mentaltraining/types'
  );
  const store = admin.firestore();
  try {
    await admin
      .auth()
      .createUser({
        uid,
        email: `${uid}@redteam.invalid`,
        emailVerified: true,
      });
    await store
      .collection('users')
      .doc(uid)
      .set({ userId: uid, role: 'athlete', syntheticRedTeam: true });
    await store
      .collection('sim-assignments')
      .doc(assignmentId)
      .set({
        athleteUserId: uid,
        exerciseId: 'synthetic-breathing',
        status: 'pending',
        syntheticRedTeam: true,
      });
    await signInWithCustomToken(
      auth,
      await admin.auth().createCustomToken(uid),
    );
    const result = await completionService.recordCompletion({
      userId: uid,
      exerciseId: 'synthetic-breathing',
      exerciseName: 'Synthetic practice',
      exerciseCategory: ExerciseCategory.Breathing,
      assignmentId,
      durationSeconds: 60,
    });
    const completion = await getDocFromServer(
      doc(db, 'sim-completions', uid, 'completions', result.id),
    );
    const assignment = await getDocFromServer(
      doc(db, 'sim-assignments', assignmentId),
    );
    assert.equal(completion.data()?.durationSeconds, 60);
    assert.equal(assignment.data()?.status, 'completed');
    writeFileSync(
      '/tmp/nora-completion-integration.json',
      JSON.stringify(
        {
          passed: true,
          completionPersisted: true,
          assignmentPersisted: true,
          readFromServer: true,
          syntheticOnly: true,
          environment: 'development',
          deviceUIVerified: false,
        },
        null,
        2,
      ),
    );
    console.log('Completion and assignment survived a fresh server read.');
  } finally {
    await signOut(auth);
    for (const root of [
      'users',
      'sim-completions',
      'mental-training-streaks',
      'athlete-mental-progress',
      'state-snapshots',
      'athlete-physiology-cognition',
    ])
      await store.recursiveDelete(store.collection(root).doc(uid));
    await store.collection('sim-assignments').doc(assignmentId).delete();
    await admin
      .auth()
      .deleteUser(uid)
      .catch(() => {});
    await terminate(db);
  }
}
void main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
