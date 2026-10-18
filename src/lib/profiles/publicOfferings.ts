export async function loadPublicOfferings(db: any,userId: string) {
  if ((await db.collection('account-closure-jobs').doc(userId).get()).exists) return null;
  const snapshot = await db.collection('users').doc(userId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  // Additional Services are immediately published by the existing coach profile editor.
  const services = data.activeCoachAccount === true && Array.isArray(data.services) ? data.services.flatMap((entry: any) => {
    if (!entry || typeof entry !== 'object' || entry.private === true || entry.isPrivate === true || entry.published === false || entry.isPublished === false || ['private','draft','unpublished'].includes(entry.visibility) || ['draft','unpublished','inactive','archived'].includes(entry.status)) return [];
    if (typeof entry.title !== 'string' || !entry.title.trim() || typeof entry.priceCents !== 'number' || !Number.isSafeInteger(entry.priceCents) || entry.priceCents < 0 || (entry.description !== undefined && typeof entry.description !== 'string')) return [];
    return [{title:entry.title,description:entry.description || '',priceCents:entry.priceCents}];
  }) : [];
  return {id:userId,services};
}
