const { getFirebaseAdminApp, isDevMode, admin, headers } = require('./config/firebase');
const c = require('./lib/pulsecheck-clay-self');
const responseHeaders = { ...headers, 'Cache-Control': 'private, no-store', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' };
const reply = (statusCode, body) => ({ statusCode, headers: responseHeaders, body: JSON.stringify(body) });
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return reply(200, {});
  try {
    const app = getFirebaseAdminApp({ headers: event.headers || {} });
    const { uid } = await c.authenticate(event, admin, app);
    const db = admin.firestore(app), ref = c.stateRef(db, uid), bucket = c.bucketFor(admin, app, isDevMode({ headers: event.headers || {} }) ? 'dev' : 'prod');
    if (event.httpMethod === 'GET') {
      const current = (await ref.get()).data() || {};
      const id = event.queryStringParameters?.jobId;
      if (!id) {
        const active = current.jobId && current.status !== 'deleted';
        const expired = ['queued', 'processing'].includes(current.status) && Date.now() - current.createdAt >= c.MAX_AGE;
        return reply(200, {
          status: active ? (current.approvedPath === c.paths(uid, current.jobId).output ? 'approved' : expired ? 'failed' : current.status === 'queued' ? 'processing' : current.status) : current.approvedPath ? 'approved' : 'not_started',
          ...(active ? { jobId: current.jobId } : {}),
          ...(current.approvedPath ? { imageURL: await c.signedURL(bucket, current.approvedPath) } : {}),
          ...(active && current.status === 'ready' && current.approvedPath !== c.paths(uid, current.jobId).output ? { previewImageURL: await c.signedURL(bucket, c.paths(uid, current.jobId).output) } : {}),
          ...(expired || current.status === 'failed' ? { error: 'We could not make your Clay Self. Please try again.' } : {}),
        });
      }
      if (c.jobID(id) !== current.jobId) throw c.fail(404, 'Clay Self request not found.');
      if (['queued', 'processing'].includes(current.status) && Date.now() - current.createdAt >= c.MAX_AGE) return reply(200, { jobId: id, status: 'failed', error: 'This request timed out. Please try again.' });
      return reply(200, { jobId: id, status: current.status === 'queued' ? 'processing' : current.status, ...(current.status === 'approved' ? { imageURL: await c.signedURL(bucket, current.approvedPath) } : {}), ...(current.status === 'ready' ? { previewImageURL: await c.signedURL(bucket, c.paths(uid, id).output) } : {}), ...(current.status === 'failed' ? { error: 'We could not make your Clay Self. Please try again.' } : {}) });
    }
    if (event.httpMethod === 'DELETE') {
      let previous;
      await db.runTransaction(async (tx) => { previous = (await tx.get(ref)).data() || {}; tx.set(ref, { ...previous, status: 'deleted', approvedPath: null }); });
      const names = previous.jobId ? Object.values(c.paths(uid, previous.jobId)).flat() : [];
      await c.remove(bucket, [...names, previous.approvedPath]);
      return reply(200, { status: 'deleted' });
    }
    if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed.' });
    const body = c.parseBody(event);
    if (body.action === 'approve') {
      const id = c.jobID(body.jobId);
      let previousApproved;
      await db.runTransaction(async (tx) => {
        const current = (await tx.get(ref)).data();
        if (current?.jobId !== id || !['ready', 'approved'].includes(current.status)) throw c.fail(409, 'This portrait is not ready to save.');
        previousApproved = current.approvedPath;
        tx.update(ref, { status: 'approved', approvedPath: c.paths(uid, id).output, approvedAt: Date.now() });
      });
      if (previousApproved && previousApproved !== c.paths(uid, id).output) await c.remove(bucket, [previousApproved]);
      return reply(200, { status: 'approved', imageURL: await c.signedURL(bucket, c.paths(uid, id).output) });
    }
    if (body.action !== 'generate') throw c.fail(400, 'Choose a Clay Self action.');
    if (!c.providerKey()) throw c.fail(503, 'Clay Self creation is temporarily unavailable.');
    const images = c.parseImages(body), id = c.crypto.randomUUID(), now = Date.now();
    let previous;
    await db.runTransaction(async (tx) => {
      previous = (await tx.get(ref)).data() || {};
      const limits = c.gate(previous, now);
      tx.set(ref, { ...limits, jobId: id, status: 'queued', createdAt: now, approvedPath: previous.approvedPath || null });
    });
    const locations = c.paths(uid, id);
    try {
      // Never persist an input URL or public download token for reference photos.
      const uploads = await Promise.allSettled(images.map((image, index) => bucket.file(locations.sources[index]).save(image.bytes, { resumable: false, metadata: { contentType: 'image/jpeg', cacheControl: 'private, no-store' } })));
      if (uploads.some(result => result.status === 'rejected')) throw c.fail(503, 'Photo upload failed. Please try again.');
      const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai');
      if (origin.protocol !== 'https:') throw c.fail(503, 'Clay Self creation is temporarily unavailable.');
      const dispatch = await fetch(new URL('/.netlify/functions/pulsecheck-clay-self-background', origin), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: event.headers.authorization || event.headers.Authorization, 'x-pulsecheck-firebase-mode': isDevMode({ headers: event.headers || {} }) ? 'dev' : 'prod' }, body: JSON.stringify({ jobId: id }), signal: AbortSignal.timeout(10000) });
      if (!dispatch.ok) throw c.fail(503, 'Clay Self creation is temporarily unavailable.');
    } catch (error) {
      await db.runTransaction(async (tx) => { const current = (await tx.get(ref)).data(); if (current?.jobId === id) tx.update(ref, { status: 'failed' }); });
      await c.remove(bucket, locations.sources);
      throw error;
    }
    if (previous.jobId) {
      const old = c.paths(uid, previous.jobId);
      await c.remove(bucket, [...old.sources, ...(old.output !== previous.approvedPath ? [old.output] : [])]);
    }
    return reply(202, { jobId: id, status: 'processing' });
  } catch (error) {
    return reply(error.statusCode || 500, { error: error.statusCode ? error.message : 'Clay Self is temporarily unavailable. Please try again.' });
  }
};
