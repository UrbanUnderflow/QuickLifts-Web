import { publicProfile } from './publicProjection';
export type DirectoryQuery = { kind: 'username' | 'search' | 'directory' | 'featured'; value?: string; cursor?: string };
export function parseDirectoryQuery(input: Record<string, unknown>): DirectoryQuery | null {
  const { kind, value, cursor } = input;
  if (!['username','search','directory','featured'].includes(String(kind))) return null;
  if ((kind === 'username' || kind === 'search') && (typeof value !== 'string' || !value.trim() || value.length > 100)) return null;
  if (cursor !== undefined && (typeof cursor !== 'string' || !cursor || cursor.length > 128 || cursor.includes('/'))) return null;
  return { kind: kind as DirectoryQuery['kind'], value: typeof value === 'string' ? value : undefined, cursor: cursor as string | undefined };
}
export async function loadPublicDirectory(db: any, input: DirectoryQuery) {
  let query = db.collection('users');
  if (input.kind === 'username') query = query.where('username','==',input.value);
  if (input.kind === 'search') query = query.where('username','>=',input.value!.toLowerCase()).where('username','<=',input.value!.toLowerCase()+'\uf8ff').orderBy('username');
  if (input.kind === 'featured') query = query.where('videoCount','>',0).orderBy('videoCount');
  query = query.orderBy('__name__');
  if (input.cursor) {
    const cursor = await db.collection('users').doc(input.cursor).get();
    if (!cursor.exists) throw new Error('Invalid cursor');
    query = query.startAfter(cursor);
  }
  const size = input.kind === 'username' ? 1 : input.kind === 'search' ? 10 : 100;
  const snapshot = await query.limit(size).select('displayName','username','bio','profileImage').get();
  const profiles = (await Promise.all(snapshot.docs.map(async (doc: any) => {
    if ((await db.collection('account-closure-jobs').doc(doc.id).get()).exists) return null;
    return publicProfile(doc.id,doc.data());
  }))).filter(Boolean);
  return { profiles, nextCursor: snapshot.docs.length === size && input.kind !== 'username' && input.kind !== 'search' ? snapshot.docs.at(-1).id : null };
}
