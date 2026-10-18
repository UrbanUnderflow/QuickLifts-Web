/** Intentionally public identity only. Never spread a root user document here. */
export function publicProfile(userId: string, data: Record<string, any>) {
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  return {
    id: userId,
    displayName: text(data.displayName),
    username: text(data.username),
    bio: text(data.bio),
    profileImage: { profileImageURL: text(data.profileImage?.profileImageURL) },
  };
}
export async function loadPublicProfile(db: any, userId: string) {
  const closed = await db.collection('account-closure-jobs').doc(userId).get();
  if (closed.exists) return null;
  const snapshot = await db.collection('users').doc(userId).get();
  return snapshot.exists ? publicProfile(userId, snapshot.data()) : null;
}
