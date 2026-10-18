const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../../netlify/functions/lib/pulsecheck-clay-self');
const sharp = require('sharp');
const portrait = (left = 200, top = 200) => sharp({ create: { width: 1024, height: 1536, channels: 4, background: '#00000000' } }).composite([{ input: Buffer.from('<svg width="500" height="1000"><rect width="500" height="1000" fill="brown"/></svg>'), left, top }]).png().toBuffer();
const jpeg = Buffer.from([255,216,255,224,0,4,255,217]);
const photos = () => c.ROLES.map(role => ({ role, mimeType: 'image/jpeg', imageBase64: jpeg.toString('base64') }));
test('requires precisely the three distinct guided references', () => {
  assert.deepEqual(c.parseImages({ images: photos() }).map(x => x.role), c.ROLES);
  assert.throws(() => c.parseImages({ images: photos().slice(1) }), { statusCode: 400 });
  const duplicates = photos(); duplicates[2].role = 'face';
  assert.throws(() => c.parseImages({ images: duplicates }), { statusCode: 400 });
});
test('rejects URLs, unsupported files, oversized photos and malformed base64', () => {
  for (const patch of [{ imageBase64: 'https://attacker.example/photo' }, { mimeType: 'image/png' }, { imageBase64: Buffer.alloc(210000).toString('base64') }, { imageBase64: 'aGVsbG8=' }]) {
    const images = photos(); Object.assign(images[0], patch);
    assert.throws(() => c.parseImages({ images }), { statusCode: 400 });
  }
});
test('transaction gate prevents concurrent jobs and caps daily generation', () => {
  const now = Date.parse('2026-10-18T12:00:00Z');
  assert.throws(() => c.gate({ status: 'processing', createdAt: now - 1 }, now), { statusCode: 409 });
  assert.throws(() => c.gate({ day: '2026-10-18', count: 3 }, now), { statusCode: 429 });
  assert.equal(c.gate({ day: '2026-10-17', count: 3 }, now).count, 1);
  assert.equal(c.gate({ status: 'processing', createdAt: now - c.MAX_AGE - 1 }, now).count, 1);
});
test('job identifiers cannot inject owner paths', () => {
  assert.throws(() => c.jobID('../../other-user'), { statusCode: 400 });
  const id = c.crypto.randomUUID();
  assert.equal(c.paths('owner', c.jobID(id)).sources.length, 3);
});
test('authentication rejects missing and invalid tokens', async () => {
  const admin = { auth: () => ({ verifyIdToken: async () => { throw Error('private token detail'); } }) };
  await assert.rejects(c.authenticate({ headers: {} }, admin, {}), { statusCode: 401 });
  await assert.rejects(c.authenticate({ headers: { authorization: 'Bearer invalid' } }, admin, {}), { statusCode: 401, message: 'Please sign in again.' });
});
test('real image edit sends all three references and returns generated PNG only', async () => {
  const png = await portrait();
  const output = await c.editImages(c.parseImages({ images: photos() }), 'synthetic-test-key', async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/images/edits');
    assert.deepEqual(options.body.getAll('image[]').map(file => file.name), ['full_body.jpg', 'face.jpg', 'reference.jpg', 'style-only-basketball.png', 'style-only-athlete.png']);
    assert.equal(options.body.get('quality'), 'high');
    assert.equal(options.body.get('size'), '1024x1536');
    const spec = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../netlify/functions/lib/clay-self-style/SCHEMATICS-v1.md'), 'utf8');
    assert.equal(options.body.get('prompt'), spec);
    assert.match(spec, /Images 4 and 5 are approved MATERIAL/);
    assert.match(spec, /both shoes including/);
    assert.equal(options.body.get('model'), 'gpt-image-1.5');
    assert.equal(options.body.get('input_fidelity'), 'high');
    assert.equal(options.body.get('background'), 'transparent');
    assert.equal(options.body.get('output_format'), 'png');
    return { ok: true, json: async () => ({ data: [{ b64_json: png.toString('base64') }] }) };
  });
  assert.deepEqual(output, png);
});
test('provider failure does not leak details or silently reuse source photo', async () => {
  await assert.rejects(c.editImages([], 'synthetic', async () => ({ ok: false })), { statusCode: 502 });
  await assert.rejects(c.editImages([], 'synthetic', async () => ({ ok: true, json: async () => ({ data: [{ b64_json: jpeg.toString('base64') }] }) })), { statusCode: 502 });
});

function harness() {
  const Module = require('node:module');
  const states = new Map(), files = new Map();
  let currentUID = 'athlete-a';
  const db = { runTransaction: async fn => fn({ get: ref => ref.get(), set: (ref, value) => states.set(ref.path, value), update: (ref, value) => states.set(ref.path, { ...states.get(ref.path), ...value }) }), collection: name => collection(name) };
  function collection(path) { return { doc: id => document(`${path}/${id}`) }; }
  function document(path) { return { path, firestore: db, get: async () => ({ data: () => states.get(path) }), collection: name => collection(`${path}/${name}`) }; }
  const bucket = { file: path => ({ save: async bytes => files.set(path, bytes), download: async () => { if (!files.has(path)) throw Error('missing'); return [files.get(path)]; }, delete: async () => files.delete(path), getSignedUrl: async () => [`https://private.example/${path}?short-lived=1`] }) };
  const app = { options: { projectId: 'synthetic-test' } };
  const firebase = { headers: {}, isDevMode: () => false, getFirebaseAdminApp: () => app, admin: { auth: () => ({ verifyIdToken: async () => ({ uid: currentUID }) }), firestore: () => db, storage: () => ({ bucket: () => bucket }) } };
  function load(name) {
    const full = require.resolve(`../../netlify/functions/${name}`);
    delete require.cache[full];
    const original = Module._load;
    Module._load = function(id, ...args) { return id === './config/firebase' ? firebase : original.call(this, id, ...args); };
    try { return require(full).handler; } finally { Module._load = original; }
  }
  return { api: load('pulsecheck-clay-self'), worker: load('pulsecheck-clay-self-background'), states, files, setUID: uid => { currentUID = uid; }, event: (method, body, query = {}) => ({ httpMethod: method, headers: { authorization: 'Bearer synthetic-test' }, queryStringParameters: query, body: JSON.stringify(body || {}) }) };
}

test('owner-only lifecycle: create, background, preview, approve, restore, delete', async () => {
  const h = harness(), oldFetch = global.fetch, oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'synthetic-test';
  const png = await portrait();
  global.fetch = async url => url.toString().includes('api.openai.com') ? { ok: true, json: async () => ({ data: [{ b64_json: png.toString('base64') }] }) } : { ok: true };
  try {
    const created = await h.api(h.event('POST', { action: 'generate', images: photos() }));
    assert.equal(created.statusCode, 202);
    const { jobId } = JSON.parse(created.body);
    assert.equal(h.files.size, 3);
    assert.equal((await h.api(h.event('POST', { action: 'generate', images: photos() }))).statusCode, 409);
    h.setUID('athlete-b');
    assert.equal((await h.api(h.event('GET', {}, { jobId }))).statusCode, 404);
    assert.equal((await h.api(h.event('POST', { action: 'approve', jobId }))).statusCode, 409);
    await h.worker(h.event('POST', { jobId }));
    assert.equal(h.files.size, 3);
    h.setUID('athlete-a');
    await h.worker(h.event('POST', { jobId }));
    assert.equal(h.files.size, 1, 'reference photos erased after generation');
    const saved = [...h.states.values()][0];
    assert.equal(saved.styleVersion, 'clay-self-v1');
    assert.equal(saved.generationQuality, 'high');
    assert.equal(saved.generationSize, '1024x1536');
    const ready = JSON.parse((await h.api(h.event('GET', {}, { jobId }))).body);
    assert.equal(ready.status, 'ready');
    assert.match(ready.previewImageURL, /private.example/);
    const recovered = JSON.parse((await h.api(h.event('GET'))).body);
    assert.equal(recovered.jobId, jobId);
    assert.equal(recovered.imageURL, undefined, 'preview is not automatically published');
    assert.equal((await h.api(h.event('POST', { action: 'approve', jobId }))).statusCode, 200);
    assert.equal((await h.api(h.event('POST', { action: 'approve', jobId }))).statusCode, 200, 'approval is idempotent');
    assert.equal(JSON.parse((await h.api(h.event('GET', {}, { jobId }))).body).status, 'approved');
    const restored = JSON.parse((await h.api(h.event('GET'))).body);
    assert.equal(restored.status, 'approved');
    assert.match(restored.imageURL, /private.example/);
    await h.api(h.event('DELETE'));
    assert.equal(h.files.size, 0);
    assert.equal(JSON.parse((await h.api(h.event('GET'))).body).status, 'not_started');
  } finally { global.fetch = oldFetch; if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; }
});

test('worker failure erases source photos and cannot turn a failed job into ready', async () => {
  const h = harness(), oldFetch = global.fetch, oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'synthetic';
  global.fetch = async url => ({ ok: !url.toString().includes('api.openai.com') });
  try {
    const { jobId } = JSON.parse((await h.api(h.event('POST', { action: 'generate', images: photos() }))).body);
    await h.worker(h.event('POST', { jobId }));
    assert.equal(h.files.size, 0);
    assert.equal(JSON.parse((await h.api(h.event('GET', {}, { jobId }))).body).status, 'failed');
    assert.equal((await h.api(h.event('POST', { action: 'approve', jobId }))).statusCode, 409);
  } finally { global.fetch = oldFetch; if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; }
});
test('deleting during generation discards late provider output', async () => {
  const h = harness(), oldFetch = global.fetch, oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'synthetic';
  global.fetch = async url => {
    if (!url.toString().includes('api.openai.com')) return { ok: true };
    await h.api(h.event('DELETE'));
    return { ok: true, json: async () => ({ data: [{ b64_json: (await portrait()).toString('base64') }] }) };
  };
  try {
    const { jobId } = JSON.parse((await h.api(h.event('POST', { action: 'generate', images: photos() }))).body);
    await h.worker(h.event('POST', { jobId }));
    assert.equal(h.files.size, 0);
    assert.equal(JSON.parse((await h.api(h.event('GET'))).body).status, 'not_started');
  } finally { global.fetch = oldFetch; if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; }
});
test('retention sweep paginates private inputs and keeps fresh uploads', async () => {
  const now = Date.now(), deleted = [];
  const makeFile = (id, age) => ({ metadata: { timeCreated: new Date(now - age).toISOString() }, delete: async () => deleted.push(id) });
  let page = 0;
  const bucket = { getFiles: async query => {
    assert.equal(query.prefix, 'pulsecheck-clay-self-inputs/');
    return page++ === 0 ? [[makeFile('old-a', 7200000), makeFile('fresh', 30000)], { ...query, pageToken: 'next' }] : [[makeFile('old-b', 7200000)], undefined];
  } };
  assert.equal(await c.removeExpiredInputs(bucket, now), 2);
  assert.deepEqual(deleted, ['old-a', 'old-b']);
});
test('storage selection respects explicit prod/dev configuration without crossing environments', () => {
  const keys = ['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET', 'DEV_FIREBASE_STORAGE_BUCKET'];
  const saved = keys.map(key => process.env[key]);
  try {
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'synthetic-prod.firebasestorage.app';
    process.env.NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET = 'synthetic-dev.firebasestorage.app';
    delete process.env.DEV_FIREBASE_STORAGE_BUCKET;
    const admin = { storage: () => ({ bucket: name => name }) }, app = { options: { projectId: 'synthetic-dev' } };
    assert.equal(c.bucketFor(admin, app, 'prod'), 'synthetic-prod.firebasestorage.app');
    assert.equal(c.bucketFor(admin, app, 'dev'), 'synthetic-dev.firebasestorage.app');
    delete process.env.NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET;
    assert.equal(c.bucketFor(admin, app, 'dev'), 'synthetic-dev.appspot.com');
    assert.throws(() => c.bucketFor(admin, app), { statusCode: 500 });
  } finally { keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; }); }
});

test('framing gate rejects edge clipping, opaque backdrops, empty and malformed output', async () => {
  await c.validatePortrait(await portrait());
  await assert.rejects(c.validatePortrait(await portrait(0, 200)), { statusCode: 502 });
  await assert.rejects(c.validatePortrait(await portrait(200, 0)), { statusCode: 502 });
  for (const background of ['#ffffffff', '#00000000']) {
    const png = await sharp({ create: { width: 1024, height: 1536, channels: 4, background } }).png().toBuffer();
    await assert.rejects(c.validatePortrait(png), { statusCode: 502 });
  }
  await assert.rejects(c.validatePortrait(Buffer.from([137,80,78,71,13,10,26,10])), { statusCode: 502 });
  const square = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#ffffff00' } }).png().toBuffer();
  await assert.rejects(c.validatePortrait(square), { statusCode: 502 });
});

test('worker rejects a clipped provider result and erases private source photos', async () => {
  const h = harness(), oldFetch = global.fetch, oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'synthetic';
  const png = await portrait(200, 0);
  global.fetch = async url => url.toString().includes('api.openai.com') ? { ok: true, json: async () => ({ data: [{ b64_json: png.toString('base64') }] }) } : { ok: true };
  try {
    const { jobId } = JSON.parse((await h.api(h.event('POST', { action: 'generate', images: photos() }))).body);
    await h.worker(h.event('POST', { jobId }));
    assert.equal(h.files.size, 0);
    assert.equal(JSON.parse((await h.api(h.event('GET', {}, { jobId }))).body).status, 'failed');
    assert.equal((await h.api(h.event('POST', { action: 'approve', jobId }))).statusCode, 409);
  } finally { global.fetch = oldFetch; if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; }
});

test('padding preserves a fully contained image and never repairs edge-touching content', async () => {
  const tight = await portrait(200, 535);
  await assert.rejects(c.validatePortrait(tight), { statusCode: 502 });
  const padded = await c.framePortrait(tight);
  await c.validatePortrait(padded, 0.08);
  const metadata = await sharp(padded).metadata();
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 1536);
  assert.equal(metadata.hasAlpha, true);
  await assert.rejects(c.framePortrait(await portrait(200, 536)), { statusCode: 502 });
  await assert.rejects(c.framePortrait(await portrait(0, 200)), { statusCode: 502 });
});

test('diagnostics only retain allowlisted code, phase and timing', () => {
  const details = c.failureDetails({ message: 'secret-url', failureCode: 'private-key' }, 'provider', 1000, 1600);
  assert.deepEqual(details, { failureCode: 'provider_transport', failurePhase: 'provider', failedAt: 1600, elapsedMs: 600 });
  const oldWarn = console.warn; const events = [];
  console.warn = value => events.push(JSON.parse(value));
  try { c.logFailure({ ...details, uid: 'private-user', url: 'secret-url' }); } finally { console.warn = oldWarn; }
  assert.deepEqual(events, [{ event: 'clay_self_failed', ...details }]);
  assert.equal(c.publicFailure({ failureCode: 'secret-url' }).failureCode, 'internal_error');
  assert.equal(c.publicFailure({}, true).failureCode, 'job_expired');
});

test('provider timeout and transport errors become safe categories', async () => {
  await assert.rejects(c.editImages([], 'synthetic', async () => { throw Object.assign(Error('secret-url'), { name: 'TimeoutError' }); }), { failureCode: 'provider_timeout' });
  await assert.rejects(c.editImages([], 'synthetic', async () => { throw Error('secret-token'); }), { failureCode: 'provider_transport' });
});

test('dispatch failure records sanitized diagnostic fields in owner-only job', async () => {
  const h = harness(), oldFetch = global.fetch, oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'synthetic';
  global.fetch = async () => { throw Error('private transport detail'); };
  try {
    const result = await h.api(h.event('POST', { action: 'generate', images: photos() }));
    assert.equal(result.statusCode, 500);
    const state = [...h.states.values()][0];
    assert.equal(state.failureCode, 'dispatch_failed');
    assert.equal(state.failurePhase, 'dispatch');
    assert.equal(typeof state.failedAt, 'number');
    assert.equal(typeof state.elapsedMs, 'number');
    assert.equal(JSON.stringify(state).includes('private transport detail'), false);
    assert.equal(h.files.size, 0);
    const status = JSON.parse((await h.api(h.event('GET'))).body);
    assert.equal(status.failureCode, 'dispatch_failed');
    assert.equal(status.error.includes('different photo'), false);
  } finally { global.fetch = oldFetch; if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; }
});
