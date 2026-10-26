const { admin, findAppByName } = require('./app-registry');
const { resolveFirebaseAdminCredential } = require('./credential-source');

function createTokenSigner({ firebaseAdmin = admin, findApp = findAppByName, resolveCredential = resolveFirebaseAdminCredential } = {}) {
  return async (app, uid, mode, claims) => {
    const credential = resolveCredential({ mode });
    if (credential.source !== 'dev:service-account-impersonation') {
      return app.auth().createCustomToken(uid, claims);
    }
    if (!credential.projectId || app.options.projectId !== credential.projectId || !credential.clientEmail) {
      throw new Error('Custom-token signing project does not match the verified phone project.');
    }
    const name = `phone-token-signer-${credential.projectId}`;
    let signer = findApp(name);
    if (!signer) {
      // The configured source already impersonates this exact dev service account.
      // Use its existing IAM signBlob permission, without creating keys or widening
      // permissions. Regular dev database/Auth calls still use the scoped dev identity.
      const source = credential.sourceCredential;
      if (!source?.clientEmail || !source.privateKey) throw new Error('Custom-token signing credentials are unavailable.');
      const oauth = firebaseAdmin.credential.cert({ projectId: source.projectId, clientEmail: source.clientEmail, privateKey: source.privateKey });
      signer = firebaseAdmin.initializeApp({
        projectId: credential.projectId,
        serviceAccountId: credential.clientEmail,
        credential: { getAccessToken: () => oauth.getAccessToken() },
      }, name);
    }
    return signer.auth().createCustomToken(uid, claims);
  };
}

module.exports = { createTokenSigner, createCustomTokenForApp: createTokenSigner() };
