import assert from 'node:assert/strict';
import test from 'node:test';
import { createSyntheticFirebaseIdToken } from '../../src/lib/nora-red-team/syntheticFirebaseAuth';

test('synthetic staging auth signs in with a temporary password and applies claims', async () => {
  const calls: string[] = [];
  const auth = {
    async getUser() {
      const error = new Error('missing') as Error & { code: string };
      error.code = 'auth/user-not-found';
      throw error;
    },
    async createUser(input: { password?: string }) {
      assert.ok(input.password && input.password.length >= 20);
      calls.push('createUser');
    },
    async setCustomUserClaims(uid: string, claims: Record<string, unknown>) {
      assert.equal(uid, 'synthetic-athlete');
      assert.deepEqual(claims, { noraRedTeamSynthetic: true });
      calls.push('setCustomUserClaims');
    },
  };
  const app = { auth: () => auth } as never;

  const token = await createSyntheticFirebaseIdToken({
    app,
    uid: 'synthetic-athlete',
    email: 'synthetic-athlete@example.invalid',
    apiKey: 'dev-api-key',
    claims: { noraRedTeamSynthetic: true },
    fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      assert.match(String(url), /accounts:signInWithPassword/);
      const body = JSON.parse(String(init?.body));
      assert.equal(body.email, 'synthetic-athlete@example.invalid');
      assert.ok(body.password.length >= 20);
      assert.equal(body.returnSecureToken, true);
      calls.push('signInWithPassword');
      return new Response(JSON.stringify({ idToken: 'signed-staging-id-token' }), { status: 200 });
    }) as typeof fetch,
  });

  assert.equal(token, 'signed-staging-id-token');
  assert.deepEqual(calls, ['createUser', 'setCustomUserClaims', 'signInWithPassword']);
});
