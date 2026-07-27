const { getFirebaseAdminApp, headers } = require('./config/firebase');
const { buildMergePreview, executeMerge, rollbackMerge } = require('./lib/account-merge');

const json = (statusCode, body) => ({
  statusCode,
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const bearerToken = (event) => {
  const value = event.headers?.authorization || event.headers?.Authorization || '';
  return value.replace(/^Bearer\s+/i, '').trim();
};

const verifyAdmin = async ({ db, auth, decoded }) => {
  if (decoded.admin === true || decoded.isAdmin === true || decoded.role === 'admin') return true;
  const email = String(decoded.email || '').trim().toLowerCase();
  if (!email) return false;
  const [adminDoc, userDoc] = await Promise.all([
    db.collection('admin').doc(email).get(),
    db.collection('users').doc(decoded.uid).get(),
  ]);
  return adminDoc.exists || userDoc.data()?.isAdmin === true;
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  const app = getFirebaseAdminApp(event);
  const auth = app.auth();
  const db = app.firestore();
  const admin = require('firebase-admin');
  const token = bearerToken(event);
  if (!token) return json(401, { error: 'Sign in is required.' });

  let caller;
  try {
    caller = await auth.verifyIdToken(token);
  } catch {
    return json(401, { error: 'Your sign-in expired. Sign in again and retry.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request body.' });
  }

  try {
    if (body.action === 'resolve-current-alias') {
      const aliasRef = db.collection('account-aliases').doc(caller.uid);
      let alias = await aliasRef.get();

      if (!alias.exists) {
        const email = String(caller.email || '').trim().toLowerCase();
        const providerId = String(caller.firebase?.sign_in_provider || '').trim();
        const canUseVerifiedSignInEmail =
          ['google.com', 'password'].includes(providerId)
          && caller.email_verified === true
          && Boolean(email);

        if (canUseVerifiedSignInEmail) {
          const matches = await db.collection('users')
            .where('signInEmails', 'array-contains', email)
            .limit(2)
            .get();
          const canonicalMatches = matches.docs.filter((document) => document.id !== caller.uid);

          if (canonicalMatches.length === 1) {
            await aliasRef.set({
              sourceUid: caller.uid,
              canonicalUid: canonicalMatches[0].id,
              status: 'verified-email-alias',
              providerId,
              verifiedEmail: email,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            alias = await aliasRef.get();
          }
        }
      }

      if (!alias.exists) return json(200, { alias: false });
      const canonicalUid = alias.data()?.canonicalUid;
      const aliasStatus = alias.data()?.status || null;
      if (!canonicalUid || aliasStatus === 'failed' || aliasStatus === 'rolled-back') {
        return json(409, { error: 'This account alias is not ready for sign-in.' });
      }
      let canonicalEmail = null;
      if (canonicalUid) {
        canonicalEmail = (await auth.getUser(canonicalUid).catch(() => null))?.email || null;
      }
      const customToken = await auth.createCustomToken(canonicalUid, {
        accountAliasSourceUid: caller.uid,
      });
      return json(200, {
        alias: true,
        canonicalUid,
        canonicalEmail,
        customToken,
        status: aliasStatus,
      });
    }

    if (body.action === 'finalize-provider-link') {
      const sourceUid = String(body.sourceUid || '').trim();
      const providerId = String(body.providerId || '').trim();
      if (!sourceUid || !providerId) {
        return json(400, { error: 'Source account and provider are required.' });
      }
      const canonicalAuth = await auth.getUser(caller.uid);
      if (!canonicalAuth.providerData.some((provider) => provider.providerId === providerId)) {
        return json(409, { error: 'The sign-in method has not been connected yet.' });
      }
      const aliasRef = db.collection('account-aliases').doc(sourceUid);
      const alias = await aliasRef.get();
      if (!alias.exists || alias.data()?.canonicalUid !== caller.uid) {
        return json(404, { error: 'Account merge record not found.' });
      }
      const mergeId = body.mergeId || alias.data()?.mergeId;
      await aliasRef.set({
        status: 'complete',
        providerId,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      if (mergeId) {
        await db.collection('account-merge-audits').doc(mergeId).set({
          status: 'complete',
          providerLinked: true,
          providerId,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      return json(200, { complete: true });
    }

    if (body.action === 'self-service-merge') {
      if (!body.sourceIdToken) {
        return json(400, { error: 'Proof of the second account is required.' });
      }

      const source = await auth.verifyIdToken(body.sourceIdToken);
      if (source.uid === caller.uid) {
        return json(400, { error: 'These sign-in methods already open the same account.' });
      }

      const result = await executeMerge({
        db,
        auth,
        admin,
        sourceUid: source.uid,
        canonicalUid: caller.uid,
        actor: { type: 'self-service', uid: caller.uid },
        deleteSourceAuth: true,
        providerId: body.providerId || null,
      });
      return json(200, result);
    }

    const isAdmin = await verifyAdmin({ db, auth, decoded: caller });
    if (!isAdmin) return json(403, { error: 'Admin access is required.' });

    const sourceUid = String(body.sourceUid || '').trim();
    const canonicalUid = String(body.canonicalUid || '').trim();
    if (!sourceUid || !canonicalUid || sourceUid === canonicalUid) {
      return json(400, { error: 'Choose two different account IDs.' });
    }

    if (body.action === 'preview') {
      const preview = await buildMergePreview({ db, auth, sourceUid, canonicalUid });
      return json(200, preview);
    }

    if (body.action === 'merge-data') {
      const expectedConfirmation = `MERGE ${sourceUid} INTO ${canonicalUid}`;
      if (body.confirmation !== expectedConfirmation) {
        return json(400, { error: `Enter ${expectedConfirmation} to continue.` });
      }
      const result = await executeMerge({
        db,
        auth,
        admin,
        sourceUid,
        canonicalUid,
        actor: { type: 'admin', uid: caller.uid, email: caller.email || null },
        deleteSourceAuth: false,
        providerId: null,
      });
      return json(200, {
        ...result,
        nextStep: 'The account owner must connect the source sign-in method from Settings.',
      });
    }

    if (body.action === 'rollback') {
      const mergeId = String(body.mergeId || '').trim();
      if (!mergeId || body.confirmation !== `ROLLBACK ${mergeId}`) {
        return json(400, { error: `Enter ROLLBACK ${mergeId || '<merge id>'} to continue.` });
      }
      const result = await rollbackMerge({
        db,
        admin,
        mergeId,
        actor: { type: 'admin', uid: caller.uid, email: caller.email || null },
      });
      return json(200, result);
    }

    return json(400, { error: 'Unknown merge action.' });
  } catch (error) {
    console.error('[merge-accounts]', error);
    const message = error instanceof Error ? error.message : 'Account merge failed.';
    const statusCode = /user-not-found/i.test(message) ? 404 : 500;
    return json(statusCode, { error: message });
  }
};
