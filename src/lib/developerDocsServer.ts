import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { GetServerSidePropsContext } from 'next';
import { verifyPasscodeHash } from './systemOverviewShareAccess';

export const DEVELOPER_DOCS = {
  'auntedna': { title: 'AuntEdna athlete baseline', description: 'The 48-item Starting Point, question ownership, versioning, baseline payloads and receipts.', files: ['README.md', 'questionnaire.json', 'routing.json', 'baseline.schema.json', 'examples/baseline.synthetic.json', 'examples/receipt.synthetic.json'] },
  'athleticmind-snapshots': { title: 'Athletic Mind snapshots', description: 'Authenticated snapshot exchange, payload schemas and synthetic examples.', files: ['README.md', 'snapshot.schema.json', 'examples/snapshot.synthetic.json', 'examples/pull-request.synthetic.json', 'examples/pull-response.synthetic.json', 'examples/push-ack.synthetic.json'] },
  'clinical-bridge': { title: 'Clinical bridge', description: 'Emergency handoff, receipt and callback integration.', files: ['README.md', 'emergency-handoff.schema.json', 'webhook.schema.json', 'examples/emergency-handoff.synthetic.json', 'examples/case-receipt.synthetic.json', 'examples/webhook.synthetic.json'] },
} as const;
export type DeveloperDocSlug = keyof typeof DEVELOPER_DOCS;
export type DeveloperDocArtifact = { name: string; content: string; contentType: string };
const SESSION_MS = 12 * 60 * 60 * 1000;
export function isDeveloperDocSlug(value: unknown): value is DeveloperDocSlug { return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DEVELOPER_DOCS, value); }
export async function ensureDeveloperDocsRuntimeConfig() {
  const { ensurePartnerRuntimeConfig } = require('../../netlify/functions/lib/partner-runtime-config');
  await ensurePartnerRuntimeConfig();
}
export function developerDocsConfig() {
  const hash = process.env.DEVELOPER_DOCS_PASSWORD_HASH || '';
  const salt = process.env.DEVELOPER_DOCS_PASSWORD_SALT || '';
  const secret = process.env.DEVELOPER_DOCS_COOKIE_SECRET || '';
  return /^[a-f0-9]{128}$/i.test(hash) && /^[a-f0-9]{32}$/i.test(salt) && secret.length >= 32 ? { hash, salt, secret } : null;
}
export const developerDocsCookieName = (slug: DeveloperDocSlug) => `pulse_developer_${slug.replace(/-/g, '_')}`;
function signature(slug: DeveloperDocSlug, expiry: string, config: NonNullable<ReturnType<typeof developerDocsConfig>>) {
  return createHmac('sha256', config.secret).update(`${slug}.${expiry}.${config.hash}.${config.salt}`).digest('hex');
}
export function developerDocsCookie(slug: DeveloperDocSlug, now = Date.now()) {
  const config = developerDocsConfig(); if (!config) throw new Error('Developer documentation access is unavailable.');
  const expiry = String(now + SESSION_MS);
  const value = `${expiry}.${signature(slug, expiry, config)}`;
  return `${developerDocsCookieName(slug)}=${value}; Path=/developer/api; Max-Age=${SESSION_MS / 1000}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
export function developerDocsAuthorized(slug: DeveloperDocSlug, cookie: string | undefined, now = Date.now()) {
  const config = developerDocsConfig(); if (!config || typeof cookie !== 'string') return false;
  const parts = cookie.split('.'); if (parts.length !== 2 || !/^\d+$/.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[1])) return false;
  const expiry = Number(parts[0]); if (expiry <= now || expiry > now + SESSION_MS) return false;
  const expected = new Uint8Array(Buffer.from(signature(slug, parts[0], config))); const actual = new Uint8Array(Buffer.from(parts[1]));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const developerDocsPasswordValid = (password: unknown) => {
  const config = developerDocsConfig();
  return !!config && typeof password === 'string' && password.length <= 256 && verifyPasscodeHash(password, config.salt, config.hash);
};
export const developerArtifactAllowed = (slug: DeveloperDocSlug, file: string) => (DEVELOPER_DOCS[slug].files as readonly string[]).includes(file);
export async function loadDeveloperDocArtifact(slug: DeveloperDocSlug, name: string): Promise<DeveloperDocArtifact> {
  if (!developerArtifactAllowed(slug, name)) throw new Error('Unknown developer artifact.');
  return { name, content: await readFile(path.join(process.cwd(), 'docs/developer', slug, name), 'utf8'), contentType: name.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8' };
}
export async function getDeveloperDocumentPageProps(slug: DeveloperDocSlug, { req, res }: Pick<GetServerSidePropsContext, 'req' | 'res'>) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!isDeveloperDocSlug(slug)) return { notFound: true as const };
  try { await ensureDeveloperDocsRuntimeConfig(); } catch {
    res.statusCode = 503;
    return { props: { slug, title: DEVELOPER_DOCS[slug].title, description: DEVELOPER_DOCS[slug].description, locked: true, available: false, artifacts: [] as DeveloperDocArtifact[] } };
  }
  const available = !!developerDocsConfig();
  const locked = !developerDocsAuthorized(slug, req.cookies[developerDocsCookieName(slug)]);
  const artifacts = locked ? [] : await Promise.all(DEVELOPER_DOCS[slug].files.map(file => loadDeveloperDocArtifact(slug, file)));
  return { props: { slug, title: DEVELOPER_DOCS[slug].title, description: DEVELOPER_DOCS[slug].description, locked, available, artifacts } };
}
export async function consumeDeveloperDocsAttempt(db: any, slug: DeveloperDocSlug, address: string, now = Date.now()) {
  const windowMs = 15 * 60 * 1000; const window = Math.floor(now / windowMs);
  const key = createHash('sha256').update(`${slug}|${address}|${window}`).digest('hex');
  const ref = db.collection('developerDocsUnlockAttempts').doc(key);
  return db.runTransaction(async (tx: any) => {
    const saved = await tx.get(ref); const attempts = Number(saved.data()?.attempts || 0);
    if (attempts >= 10) return false;
    tx.set(ref, { attempts: attempts + 1, expiresAt: new Date((window + 1) * windowMs) });
    return true;
  });
}
