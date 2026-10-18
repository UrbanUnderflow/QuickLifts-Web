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
function outputFailure(code) {
  return fail(502, 'Your Clay Self could not be framed completely. Please try again.', code);
}
async function validatePortrait(bytes, requiredMargin = 0.02) {
  let image, metadata;
  try {
    image = sharp(bytes, { limitInputPixels: 1024 * 1536 });
    metadata = await image.metadata();
  } catch { throw outputFailure('output_decode'); }
  if (metadata.format !== 'png') throw outputFailure('output_format');
  if (metadata.width !== 1024 || metadata.height !== 1536) throw outputFailure('output_dimensions');
  if (!metadata.hasAlpha) throw outputFailure('output_alpha_missing');
  let data, info;
  try { ({ data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })); }
  catch { throw outputFailure('output_decode'); }
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      // Deliberately strict: even faint edge pixels cannot prove complete anatomy.
      if (data[(y * info.width + x) * info.channels + info.channels - 1] > 0) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left) throw outputFailure('output_empty');
  if (left === 0 || top === 0 || right === info.width - 1 || bottom === info.height - 1) throw outputFailure('output_edge_touch');
  const marginX = Math.ceil(info.width * requiredMargin), marginY = Math.ceil(info.height * requiredMargin);
  if (left < marginX || top < marginY || right >= info.width - marginX || bottom >= info.height - marginY) throw outputFailure('output_margin');
}

async function framePortrait(bytes) {
  // Reject any edge-touching source. Padding cannot reconstruct missing anatomy.
  await validatePortrait(bytes, 0);
  try { await validatePortrait(bytes, 0.08); return bytes; } catch (error) { if (error.failureCode !== 'output_margin') throw error; }
  const width = 858, height = 1288;
  let result;
  try {
    const resized = await sharp(bytes).resize(width, height, { fit: 'inside' }).png().toBuffer();
    result = await sharp({ create: { width: 1024, height: 1536, channels: 4, background: '#00000000' } })
      .composite([{ input: resized, gravity: 'centre' }]).png().toBuffer();
  } catch { throw outputFailure('output_processing'); }
  await validatePortrait(result, 0.08);
  return result;
}
const FAILURE_CODES = new Set(['provider_rejected', 'provider_timeout', 'provider_transport', 'provider_unavailable', 'output_invalid', 'output_payload', 'output_format', 'output_dimensions', 'output_alpha_missing', 'output_decode', 'output_empty', 'output_edge_touch', 'output_margin', 'output_processing', 'storage_read', 'storage_write', 'dispatch_failed', 'job_expired', 'internal_error']);
const FAILURE_PHASES = new Set(['input_read', 'input_upload', 'provider', 'output_validation', 'output_save', 'finalize', 'dispatch', 'expiry']);
function fail(statusCode, message, failureCode) { return Object.assign(new Error(message), { statusCode, ...(FAILURE_CODES.has(failureCode) ? { failureCode } : {}) }); }
function failureDetails(error, phase, startedAt, now = Date.now()) {
  const safePhase = FAILURE_CODES.has(error?.failureCode) && error.failureCode.startsWith('output_') ? 'output_validation' : FAILURE_PHASES.has(phase) ? phase : 'finalize';
  const defaults = { input_read: 'storage_read', input_upload: 'storage_write', provider: 'provider_transport', output_validation: 'output_invalid', output_save: 'storage_write', dispatch: 'dispatch_failed', expiry: 'job_expired' };
  return { failureCode: FAILURE_CODES.has(error?.failureCode) ? error.failureCode : defaults[safePhase] || 'internal_error', failurePhase: safePhase, failedAt: now, elapsedMs: Math.max(0, now - startedAt) };
}
function logFailure(details) {
  // Rebuild the allowlisted fields. Never log error objects, identifiers or content.
  const safe = failureDetails({ failureCode: details.failureCode }, details.failurePhase, details.failedAt - details.elapsedMs, details.failedAt);
  console.warn(JSON.stringify({ event: 'clay_self_failed', ...safe }));
}
function publicFailure(current, expired = false) {
  const failureCode = expired ? 'job_expired' : FAILURE_CODES.has(current.failureCode) ? current.failureCode : 'internal_error';
  const error = failureCode === 'job_expired' || failureCode === 'provider_timeout'
    ? 'This request timed out. Please try again. Your current profile is unchanged.'
    : failureCode.startsWith('output_')
      ? 'We could not finish the illustration. Please try again. Your current profile is unchanged.'
      : 'We could not create your Clay Self. Please try again. Your current profile is unchanged.';
  return { error, failureCode };
}
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
function successfulQuota(current, now) {
  const day = new Date(now).toISOString().slice(0, 10);
  if (current?.quotaVersion === 2) return { quotaVersion: 2, successDay: day, successfulCount: current.successDay === day ? Math.max(0, Number(current.successfulCount) || 0) : 0 };
  // Legacy count measured attempts, so it cannot reliably describe successes.
  // Carry forward the one known completed current result if it completed today.
  const completedDay = Number.isFinite(current?.completedAt) ? new Date(current.completedAt).toISOString().slice(0, 10) : null;
  return { quotaVersion: 2, successDay: day, successfulCount: ['ready', 'approved'].includes(current?.status) && completedDay === day ? 1 : 0 };
}
function testingQuotaOverride(uid, now) {
  if (!uid) return false;
  const until = Date.parse(process.env.CLAY_SELF_TESTING_UNTIL || '');
  const testers = (process.env.CLAY_SELF_TESTER_UIDS || '').split(',').map(value => value.trim()).filter(Boolean);
  return Number.isFinite(until) && now < until && testers.includes(uid);
}
function gate(current, now, uid) {
  if (['queued', 'processing'].includes(current?.status) && now - current.createdAt < MAX_AGE) throw fail(409, 'Your Clay Self is still being made.');
  const quota = successfulQuota(current, now);
  if (quota.successfulCount >= 3 && !testingQuotaOverride(uid, now)) throw fail(429, 'You can make another Clay Self tomorrow.');
  return quota;
}
function completedQuota(current, now) {
  const quota = successfulQuota(current, now);
  return { ...quota, successfulCount: quota.successfulCount + 1 };
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
  let response;
  try { response = await fetcher('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(240000) }); }
  catch (error) { throw fail(502, 'Image service temporarily unavailable. Please try again.', ['TimeoutError', 'AbortError'].includes(error?.name) ? 'provider_timeout' : 'provider_transport'); }
  if (!response.ok) throw fail(502, 'We could not make your Clay Self. Please try again.', 'provider_rejected');
  let payload;
  try { payload = await response.json(); } catch { throw fail(502, 'The image service did not return a portrait.', 'output_payload'); }
  const encoded = payload?.data?.[0]?.b64_json;
  if (typeof encoded !== 'string' || encoded.length > 24 * 1024 * 1024) throw fail(502, 'The image service did not return a portrait.', 'output_payload');
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw outputFailure('output_format');
  return framePortrait(bytes);
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

module.exports = { successfulQuota, testingQuotaOverride, completedQuota, framePortrait, failureDetails, logFailure, publicFailure, STYLE_VERSION, GENERATION_SETTINGS, validatePortrait, removeExpiredInputs, crypto, ROLES, MAX_AGE, parseImages, jobID, gate, paths, stateRef, bucketFor, authenticate, remove, signedURL, parseBody, providerKey, editImages, fail };
