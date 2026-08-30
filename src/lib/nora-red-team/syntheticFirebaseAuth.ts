import { randomBytes } from 'node:crypto';
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
  const password = `Nrt!${randomBytes(24).toString('base64url')}`;
  try {
    await auth.getUser(input.uid);
    await auth.updateUser(input.uid, {
      email: input.email,
      emailVerified: true,
      displayName: 'Nora Red Team Athlete',
      password,
      disabled: false,
    });
  } catch (error) {
    if ((error as { code?: string })?.code !== 'auth/user-not-found') throw error;
    await auth.createUser({
      uid: input.uid,
      email: input.email,
      emailVerified: true,
      displayName: 'Nora Red Team Athlete',
      password,
      disabled: false,
    });
  }
  await auth.setCustomUserClaims(input.uid, input.claims);

  const response = await (input.fetchImpl || fetch)(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: input.email, password, returnSecureToken: true }),
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
