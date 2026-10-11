import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { verifySystemOverviewShareAccessCookieValue } from './systemOverviewShareAccess';

export const SNAPSHOT_SECTION_ID = 'auntedna-snapshot-integration';
export const SNAPSHOT_ARTIFACT_FILES = ['README.md', 'snapshot.schema.json', 'examples/snapshot.synthetic.json', 'examples/pull-request.synthetic.json', 'examples/pull-response.synthetic.json', 'examples/push-ack.synthetic.json'] as const;
export type SnapshotArtifact = { name: string; content: string; contentType: string };
export const isSnapshotArtifactFile = (file: string) => (SNAPSHOT_ARTIFACT_FILES as readonly string[]).includes(file);
export const isValidShareToken = (token: string) => /^[a-f0-9]{48}$/.test(token);
export function shareExpired(share: Record<string, any>, now = Date.now()) {
  if (!share.expiresAt) return false;
  const expiry = typeof share.expiresAt?.toMillis === 'function' ? share.expiresAt.toMillis() : Date.parse(share.expiresAt);
  return !Number.isFinite(expiry) || expiry <= now;
}
export async function loadSnapshotArtifacts(): Promise<SnapshotArtifact[]> {
  return Promise.all(SNAPSHOT_ARTIFACT_FILES.map(async name => ({ name, content: await readFile(path.join(process.cwd(), 'docs/integrations/auntedna-snapshot', name), 'utf8'), contentType: name.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8' })));
}
export function authorizeSnapshotArtifact(share: Record<string, any> | undefined, token: string, file: string, cookie?: string, now = Date.now()): { status: number; artifact?: SnapshotArtifact } {
  if (!isValidShareToken(token) || !isSnapshotArtifactFile(file) || !share || share.sectionId !== SNAPSHOT_SECTION_ID || share.revokedAt || shareExpired(share, now)) return { status: 404 };
  if (!share.passcodeProtected || !share.passcodeHash || !share.passcodeSalt || !verifySystemOverviewShareAccessCookieValue(token, cookie)) return { status: 401 };
  const artifact = Array.isArray(share.snapshotArtifacts) ? share.snapshotArtifacts.find((value: SnapshotArtifact) => value.name === file) : null;
  if (!artifact || typeof artifact.content !== 'string') return { status: 404 };
  return { status: 200, artifact: { name: file, content: artifact.content, contentType: file.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8' } };
}
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
export function snapshotArtifactHtml(token: string, artifacts: SnapshotArtifact[]) {
  return artifacts.map(artifact => `<section><h2>${escapeHtml(artifact.name)}</h2><a href="/shared/system-overview/${token}/artifacts/${artifact.name}" download>Download ${escapeHtml(artifact.name)}</a><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(artifact.content)}</pre></section>`).join('');
}
/** A fixed window counter shared by server instances. Counts every attempt before expensive password hashing. */
export async function consumeSnapshotUnlockAttempt(db: any, token: string, address: string, now = Date.now()): Promise<boolean> {
  const windowMs = 15 * 60 * 1000;
  const bucket = Math.floor(now / windowMs);
  const key = createHash('sha256').update(`${token}|${address}|${bucket}`).digest('hex');
  const ref = db.collection('systemOverviewShareUnlockAttempts').doc(key);
  return db.runTransaction(async (transaction: any) => {
    const snapshot = await transaction.get(ref);
    const count = Number(snapshot.data()?.attempts || 0);
    if (count >= 10) return false;
    transaction.set(ref, { attempts: count + 1, expiresAt: new Date((bucket + 1) * windowMs), window: bucket });
    return true;
  });
}
