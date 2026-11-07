import type { Handler } from '@netlify/functions';
import { createHash } from 'crypto';
import { getSimpBudgetAuth, getSimpBudgetFirestore } from './utils/getSimpBudgetServiceAccount';

// Small, private originals use bounded Firestore chunks. No public download tokens or
// new storage permissions. Metadata + bytes commit atomically, independently of ledger rows.
const MAX_BYTES = 4 * 1024 * 1024;
const CHUNK_BYTES = 512 * 1024;
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (statusCode: number, body: unknown) => ({ statusCode, headers, body: JSON.stringify(body) });
class DocumentError extends Error { constructor(public status: number, message: string) { super(message); } }
const validId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
export function validateDocument(input: any) {
  if (typeof input.fileName !== 'string' || !input.fileName.trim() || input.fileName.length > 200 || /[\x00-\x1f/\\]/.test(input.fileName)) throw new DocumentError(400, 'Invalid document name.');
  if (typeof input.dataBase64 !== 'string' || !input.dataBase64 || input.dataBase64.length > Math.ceil(MAX_BYTES / 3) * 4) throw new DocumentError(413, 'Choose a file up to 4 MB.');
  const bytes = Buffer.from(input.dataBase64, 'base64');
  if (!bytes.length || bytes.length > MAX_BYTES || bytes.toString('base64') !== input.dataBase64) throw new DocumentError(400, 'Invalid document encoding.');
  const mime = input.mimeType;
  const valid = mime === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-'
    : mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : mime === 'image/webp' ? bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP'
    : mime === 'text/csv' ? /\.csv$/i.test(input.fileName) && !bytes.includes(0) : false;
  if (!valid) throw new DocumentError(400, 'Choose a valid PDF, image, or CSV.');
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Use POST.' });
  const bearer = event.headers.authorization || event.headers.Authorization || '';
  if (!/^Bearer \S+$/.test(bearer)) return reply(401, { error: 'Sign in to view statement documents.' });
  let owner: string;
  try { owner = (await (await getSimpBudgetAuth()).verifyIdToken(bearer.slice(7), true)).uid; }
  catch { return reply(401, { error: 'Your session has expired. Sign in again.' }); }
  try {
    if (!event.body || event.isBase64Encoded || event.body.length > 5_650_000) throw new DocumentError(413, 'Choose a file up to 4 MB.');
    let input: any;
    try { input = JSON.parse(event.body); } catch { throw new DocumentError(400, 'Invalid request.'); }
    if (!input || !['list','attach','read'].includes(input.action)) throw new DocumentError(400, 'Invalid action.');
    const db = await getSimpBudgetFirestore();
    const root = db.collection('simpbudget-users').doc(owner);
    const documents = root.collection('statementDocuments');
    if (input.action === 'list') {
      if (!Array.isArray(input.ids) || input.ids.length > 40 || !input.ids.every(validId)) throw new DocumentError(400, 'Choose up to 40 statements.');
      const snapshots = await Promise.all(input.ids.flatMap((id: string) => [documents.doc(id).get(), documents.doc(`${id}__import`).get()]));
      return reply(200, { documents: snapshots.filter(s => s.exists).map(s => s.data()) });
    }
    if (!validId(input.statementId)) throw new DocumentError(400, 'Invalid statement.');
    const statement = root.collection('statementImports').doc(input.statementId);
    const role = input.role === 'import' ? 'import' : 'original';
    const documentId = role === 'import' ? `${input.statementId}__import` : input.statementId;
    const metadata = documents.doc(documentId);
    if (!(await statement.get()).exists) throw new DocumentError(404, 'Statement not found in your account.');
    if (input.action === 'read') {
      const saved = (await metadata.get()).data();
      if (!saved) throw new DocumentError(404, 'No original document has been attached yet.');
      if (!Number.isInteger(saved.chunks) || saved.chunks < 1 || saved.chunks > 8) throw new DocumentError(500, 'Document is unavailable.');
      const pieces = await Promise.all(Array.from({ length: saved.chunks }, (_, i) => root.collection('statementDocumentChunks').doc(`${documentId}_${i}`).get()));
      if (pieces.some(p => !p.exists)) throw new DocumentError(500, 'Document is incomplete.');
      const bytes = Buffer.concat(pieces.map(p => Buffer.from(p.data()!.bytes)));
      if (bytes.length !== saved.size || createHash('sha256').update(bytes).digest('hex') !== saved.sha256) throw new DocumentError(500, 'Document integrity check failed.');
      return reply(200, { document: saved, dataBase64: bytes.toString('base64') });
    }
    const { bytes, sha256 } = validateDocument(input);
    const saved = { statementId: input.statementId, role, fileName: input.fileName, mimeType: input.mimeType, size: bytes.length, sha256, chunks: Math.ceil(bytes.length / CHUNK_BYTES), attachedAt: new Date().toISOString() };
    const result = await db.runTransaction(async tx => {
      const [existing, parent] = await Promise.all([tx.get(metadata), tx.get(statement)]);
      if (!parent.exists) throw new DocumentError(404, 'Statement not found.');
      if (existing.exists) {
        if (existing.data()!.sha256 === sha256) return existing.data();
        throw new DocumentError(409, 'This statement already has a different original attached. Nothing was replaced.');
      }
      tx.set(metadata, saved);
      for (let i = 0; i < saved.chunks; i++) tx.set(root.collection('statementDocumentChunks').doc(`${documentId}_${i}`), { bytes: bytes.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES) });
      return saved;
    });
    return reply(200, { document: result });
  } catch (error) {
    return error instanceof DocumentError ? reply(error.status, { error: error.message }) : reply(503, { error: 'Document storage is temporarily unavailable. Your transactions were not changed. Retry when connected.' });
  }
};
