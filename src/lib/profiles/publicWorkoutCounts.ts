/** This persisted count is already published in club leaderboards and landing pages. */
export async function loadPublicWorkoutCount(db: any,userId: string) {
  if ((await db.collection('account-closure-jobs').doc(userId).get()).exists) return null;
  const snapshot = await db.collection('users').doc(userId).get();
  if (!snapshot.exists) return null;
  const value = snapshot.data().workoutCount;
  return {id:userId,workoutCount:typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null};
}
