const crypto = require('crypto');
const ROLES = ['full_body', 'face', 'reference'];
const MAX_IMAGE_BYTES = 200 * 1024;
const MAX_AGE = 10 * 60 * 1000;
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const STYLE_VERSION = 'clay-self-v1';
// esbuild relocates this module into the function entrypoint directory.
const STYLE_DIRECTORY = [path.join(__dirname, 'clay-self-style'), path.join(__dirname, 'lib/clay-self-style')]
  .find(directory => fs.existsSync(path.join(directory, 'SCHEMATICS-v1.md')));
if (!STYLE_DIRECTORY) throw new Error('Clay Self style bundle is unavailable.');
const PROMPT = fs.readFileSync(path.join(STYLE_DIRECTORY, 'SCHEMATICS-v1.md'), 'utf8');
const STYLE_REFERENCES = ['basketball.png', 'athlete.png'].map(name => ({ name, bytes: fs.readFileSync(path.join(STYLE_DIRECTORY, name)) }));
// Only approved settings are used. A model change needs its own compatibility evaluation.
const GENERATION_SETTINGS = Object.freeze({ model: 'gpt-image-1.5', size: '1024x1536', quality: 'high' });

// This is a pixel framing gate, not a semantic likeness or style classifier.
async function validatePortrait(bytes) {
  try {
    const image = sharp(bytes, { limitInputPixels: 1024 * 1536 });
    const metadata = await image.metadata();
    if (metadata.format !== 'png' || metadata.width !== 1024 || metadata.height !== 1536 || !metadata.hasAlpha) throw new Error('format');
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width, top = info.height, right = -1, bottom = -1;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * info.channels + info.channels - 1] > 32) {
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
    }
    // Small tolerance for antialiasing; requested margins are considerably larger.
    const marginX = Math.ceil(info.width * 0.02), marginY = Math.ceil(info.height * 0.02);
    if (right < left || left < marginX || top < marginY || right >= info.width - marginX || bottom >= info.height - marginY) throw new Error('edge');
  } catch {
    throw fail(502, 'Your Clay Self could not be framed completely. Please try again.');
  }
}

function fail(statusCode, message) { return Object.assign(new Error(message), { statusCode }); }
function parseImages(body) {
  if (!Array.isArray(body.images) || body.images.length !== 3) throw fail(400, 'Add all three reference photos.');
  return ROLES.map((role) => {
    const matches = body.images.filter((image) => image?.role === role);
    const image = matches[0];
    if (matches.length !== 1 || image.mimeType !== 'image/jpeg' || typeof image.imageBase64 !== 'string'
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.imageBase64) || image.imageBase64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) {
      throw fail(400, 'Use a JPEG photo smaller than 200 KB for each reference.');
    }
    const bytes = Buffer.from(image.imageBase64, 'base64');
    if (bytes.length > MAX_IMAGE_BYTES || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw fail(400, 'One of the photos is not a valid JPEG.');
    return { role, bytes };
  });
}
function jobID(value) {
  if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/.test(value)) throw fail(400, 'Invalid Clay Self request.');
  return value;
}
function gate(current, now) {
  if (['queued', 'processing'].includes(current?.status) && now - current.createdAt < MAX_AGE) throw fail(409, 'Your Clay Self is still being made.');
  const day = new Date(now).toISOString().slice(0, 10);
  const count = current?.day === day ? current.count || 0 : 0;
  if (count >= 3) throw fail(429, 'You can make another Clay Self tomorrow.');
  return { day, count: count + 1 };
}
function paths(uid, id) {
  const prefix = `pulsecheck-clay-self-private/${uid}/${id}`;
  return { sources: ROLES.map((role) => `pulsecheck-clay-self-inputs/${uid}/${id}/${role}.jpg`), output: `${prefix}/portrait.png` };
}
function stateRef(db, uid) { return db.collection('pulsecheck-private-users').doc(uid).collection('clay-self').doc('current'); }
function bucketFor(admin, app, mode) {
  if (!['prod', 'dev'].includes(mode)) throw fail(500, 'Storage environment is unavailable.');
  const configured = mode === 'dev'
    ? process.env.NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET || process.env.DEV_FIREBASE_STORAGE_BUCKET
    : process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
  const name = configured?.trim() || app.options.storageBucket || `${app.options.projectId}.appspot.com`;
  return admin.storage(app).bucket(name);
}
async function authenticate(event, admin, app) {
  const value = event.headers?.authorization || event.headers?.Authorization || '';
  if (!value.startsWith('Bearer ')) throw fail(401, 'Please sign in to make your Clay Self.');
  try { return await admin.auth(app).verifyIdToken(value.slice(7), true); }
  catch { throw fail(401, 'Please sign in again.'); }
}
async function remove(bucket, names) { await Promise.all(names.filter(Boolean).map((name) => bucket.file(name).delete({ ignoreNotFound: true }))); }
async function signedURL(bucket, path) { return (await bucket.file(path).getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 }))[0]; }
function parseBody(event) { try { return JSON.parse(event.body || '{}'); } catch { throw fail(400, 'Invalid request.'); } }
function providerKey() { return process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_AI_SECRET_KEY?.trim(); }
async function editImages(images, key, fetcher = fetch) {
  const form = new FormData();
  form.set('model', GENERATION_SETTINGS.model);
  form.set('prompt', PROMPT);
  form.set('input_fidelity', 'high');
  form.set('size', GENERATION_SETTINGS.size);
  form.set('quality', GENERATION_SETTINGS.quality);
  form.set('output_format', 'png');
  form.set('background', 'transparent');
  for (const image of images) form.append('image[]', new Blob([image.bytes], { type: 'image/jpeg' }), `${image.role}.jpg`);
  for (const reference of STYLE_REFERENCES) form.append('image[]', new Blob([reference.bytes], { type: 'image/png' }), `style-only-${reference.name}`);
  const response = await fetcher('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(240000) });
  if (!response.ok) throw fail(502, 'We could not make your Clay Self. Please try again.');
  const payload = await response.json();
  const encoded = payload?.data?.[0]?.b64_json;
  if (typeof encoded !== 'string' || encoded.length > 24 * 1024 * 1024) throw fail(502, 'The image service did not return a portrait.');
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw fail(502, 'The image service did not return a portrait.');
  await validatePortrait(bytes);
  return bytes;
}
async function removeExpiredInputs(bucket, now = Date.now()) {
  let query = { prefix: 'pulsecheck-clay-self-inputs/', autoPaginate: false, maxResults: 500 };
  let removed = 0;
  while (query) {
    const [files, nextQuery] = await bucket.getFiles(query);
    const expired = files.filter(file => {
      const created = Date.parse(file.metadata?.timeCreated || '');
      return Number.isFinite(created) && created < now - 60 * 60 * 1000;
    });
    await Promise.all(expired.map(file => file.delete({ ignoreNotFound: true })));
    removed += expired.length;
    query = nextQuery;
  }
  return removed;
}

module.exports = { STYLE_VERSION, GENERATION_SETTINGS, validatePortrait, removeExpiredInputs, crypto, ROLES, MAX_AGE, parseImages, jobID, gate, paths, stateRef, bucketFor, authenticate, remove, signedURL, parseBody, providerKey, editImages, fail };
