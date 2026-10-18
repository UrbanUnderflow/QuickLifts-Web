const { getFirebaseAdminApp, isDevMode, admin } = require('./config/firebase');
const c = require('./lib/pulsecheck-clay-self');
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };
  let ref, bucket, locations, id;
  let claimed = false;
  let phase = 'input_read';
  const startedAt = Date.now();
  try {
    const app = getFirebaseAdminApp({ headers: event.headers || {} });
    const { uid } = await c.authenticate(event, admin, app);
    id = c.jobID(c.parseBody(event).jobId);
    const db = admin.firestore(app);
    ref = c.stateRef(db, uid);
    bucket = c.bucketFor(admin, app, isDevMode({ headers: event.headers || {} }) ? 'dev' : 'prod');
    locations = c.paths(uid, id);
    claimed = await db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      if (current?.jobId !== id || current.status !== 'queued') return false;
      tx.update(ref, { status: 'processing', styleVersion: c.STYLE_VERSION, generationModel: c.GENERATION_SETTINGS.model, generationQuality: c.GENERATION_SETTINGS.quality, generationSize: c.GENERATION_SETTINGS.size });
      return true;
    });
    if (!claimed) {
      const latest = (await ref.get()).data();
      // A delete/replacement may race the initial private upload. Never erase
      // another worker's in-flight inputs, but clean cancelled inputs.
      if (latest?.jobId !== id || latest.status === 'deleted') await c.remove(bucket, locations.sources);
      return { statusCode: 200 };
    }
    const key = c.providerKey();
    if (!key) throw c.fail(503, 'Image service unavailable.', 'provider_unavailable');
    const images = await Promise.all(locations.sources.map(async (path, index) => ({ role: c.ROLES[index], bytes: (await bucket.file(path).download())[0] })));
    phase = 'provider';
    const png = await c.editImages(images, key);
    phase = 'output_save';
    await bucket.file(locations.output).save(png, { resumable: false, metadata: { contentType: 'image/png', cacheControl: 'private, no-store' } });
    phase = 'finalize';
    const kept = await db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      if (current?.jobId !== id || current.status !== 'processing') return false;
      tx.update(ref, { status: 'ready', completedAt: Date.now() });
      return true;
    });
    if (!kept) await c.remove(bucket, [locations.output]);
    return { statusCode: 200 };
  } catch (error) {
    const details = c.failureDetails(error, phase, startedAt);
    if (claimed && ref) {
      const db = ref.firestore;
      await db.runTransaction(async (tx) => { const current = (await tx.get(ref)).data(); if (current?.jobId === id && current.status === 'processing') tx.update(ref, { status: 'failed', ...details }); });
    }
    if (claimed) c.logFailure(details);
    // Deliberately omit provider errors, request bodies, photo URLs and credentials.
    return { statusCode: 200 };
  } finally {
    if (claimed && bucket && locations) await c.remove(bucket, locations.sources);
  }
};
