import type * as FirebaseAdmin from 'firebase-admin';

type FetchLike = typeof fetch;

export async function createSyntheticFirebaseIdToken(input: {
  app: FirebaseAdmin.app.App;
  uid: string;
  email: string;
  apiKey: string;
  claims: Record<string, unknown>;
  fetchImpl?: FetchLike;
}): Promise<string> {
  const apiKey = input.apiKey.trim();
  if (!apiKey || apiKey === 'local-preview-placeholder') {
    throw new Error('STAGING_AUTH_UNAVAILABLE: The development Firebase web API key is not configured.');
  }

  const auth = input.app.auth();
  try {
    await auth.getUser(input.uid);
  } catch (error) {
    if ((error as { code?: string })?.code !== 'auth/user-not-found') throw error;
    await auth.createUser({
      uid: input.uid,
      email: input.email,
      emailVerified: true,
      displayName: 'Nora Red Team Athlete',
      disabled: false,
    });
  }

  const customToken = await auth.createCustomToken(input.uid, input.claims);
  const response = await (input.fetchImpl || fetch)(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const payload = await response.json().catch(() => null) as {
    idToken?: string;
    error?: { message?: string };
  } | null;
  if (!response.ok || !payload?.idToken) {
    throw new Error(
      `STAGING_AUTH_UNAVAILABLE: ${payload?.error?.message || `Firebase token exchange returned HTTP ${response.status}.`}`,
    );
  }
  return payload.idToken;
}
