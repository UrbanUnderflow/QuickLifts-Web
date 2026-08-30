import type { Handler } from '@netlify/functions';
import { getFirebaseAdminApp } from '../../src/lib/firebase-admin';
import { NORA_RED_TEAM_JOB_COLLECTION } from '../../src/lib/nora-red-team/jobStore';

async function deleteExpiredJobs(forceDevProject: boolean): Promise<number> {
  const db = getFirebaseAdminApp(forceDevProject).firestore();
  const snapshot = await db
    .collection(NORA_RED_TEAM_JOB_COLLECTION)
    .where('expiresAt', '<=', new Date().toISOString())
    .limit(200)
    .get();
  if (snapshot.empty) return 0;
  const batch = db.batch();
  snapshot.docs.forEach((document) => batch.delete(document.ref));
  await batch.commit();
  return snapshot.size;
}

export const handler: Handler = async () => {
  const productionDeleted = await deleteExpiredJobs(false);
  let developmentDeleted = 0;
  try {
    developmentDeleted = await deleteExpiredJobs(true);
  } catch (error) {
    console.warn('[nora-red-team] Development job cleanup was unavailable.', {
      error: error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180),
    });
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ productionDeleted, developmentDeleted }),
  };
};
