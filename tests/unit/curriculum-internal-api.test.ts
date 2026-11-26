import test from 'node:test';
import assert from 'node:assert/strict';
import type { app } from 'firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';
import { ATHLETIC_MIND_STAFF_PROJECT, createCurriculumAdminAuthorizer, CurriculumApiError } from '../../src/pages/api/admin/curriculum/_auth';
import { createCurriculumCatalogHandler } from '../../src/pages/api/admin/curriculum/catalog';

const request = (extra: Record<string, string> = {}) => ({ headers: { authorization: 'Bearer synthetic-token', 'x-athleticmind-internal': 'skill-curriculum', ...extra } });
const staffClaims = () => ({ uid: 'synthetic-staff', email: 'Admin@Example.test', email_verified: true, aud: ATHLETIC_MIND_STAFF_PROJECT, iss: `https://securetoken.google.com/${ATHLETIC_MIND_STAFF_PROJECT}`, firebase: { sign_in_provider: 'google.com' } });
const fixture = (options: { claims?: Record<string, unknown>; tokenError?: boolean; registry?: Record<string, unknown> | null; projectId?: string; verifierProject?: string } = {}) => {
  const modes: boolean[] = [];
  const tokenChecks: boolean[] = [];
  const registryReads: string[] = [];
  const selected = {
    options: { projectId: options.projectId ?? 'quicklifts-dd3f1' },
    auth: () => ({ verifyIdToken: async (_token: string, revoked: boolean) => { tokenChecks.push(revoked); return staffClaims(); } }),
    firestore: () => ({ collection: (name: string) => ({ doc: (email: string) => ({ get: async () => {
      registryReads.push(`${name}/${email}`);
      return { exists: options.registry !== null, data: () => options.registry ?? {} };
    } }) }) }),
  } as unknown as app.App;
  const verifier = {
    options: { projectId: options.verifierProject ?? ATHLETIC_MIND_STAFF_PROJECT },
    auth: () => ({ verifyIdToken: async (token: string, revoked: boolean) => {
      assert.equal(token, 'synthetic-token');
      tokenChecks.push(revoked);
      if (options.tokenError) throw new Error('bad signature or expired token');
      return options.claims ?? staffClaims();
    } }),
  } as unknown as app.App;
  const authorize = createCurriculumAdminAuthorizer(dev => { modes.push(dev); return selected; }, () => verifier);
  return { authorize, modes, tokenChecks, registryReads };
};

test('staff identity retains production admin registry and namespaced audit actor', async () => {
  const context = fixture();
  const identity = await context.authorize(request());
  assert.equal(identity.uid, 'athleticmind:synthetic-staff');
  assert.equal(identity.email, 'admin@example.test');
  assert.equal(identity.projectId, 'quicklifts-dd3f1');
  assert.deepEqual(context.modes, [false]);
  assert.deepEqual(context.registryReads, ['admin/admin@example.test']);
  assert.deepEqual(context.tokenChecks, [false]);
});

test('existing QuickLifts sessions still select their environment and check revocation', async () => {
  const context = fixture({ projectId: 'synthetic-dev' });
  const identity = await context.authorize({ headers: { authorization: 'Bearer synthetic-token', 'x-pulsecheck-firebase-mode': 'dev' } });
  assert.equal(identity.uid, 'synthetic-staff');
  assert.deepEqual(context.modes, [true]);
  assert.deepEqual(context.tokenChecks, [true]);
});

test('staff tokens cannot select dev, unknown identity markers, or an unexpected backend project', async () => {
  for (const extra of [{ 'x-pulsecheck-firebase-mode': 'dev' }, { 'x-athleticmind-internal': 'other' }, { 'x-pulsecheck-firebase-mode': 'other' }]) {
    const context = fixture();
    await assert.rejects(context.authorize(request(extra)), (error: unknown) => error instanceof CurriculumApiError && error.statusCode === 400);
    assert.deepEqual(context.modes, []);
  }
  const context = fixture({ projectId: 'synthetic-dev' });
  await assert.rejects(context.authorize(request()), (error: unknown) => error instanceof CurriculumApiError && error.code === 'project_unavailable');
  assert.deepEqual(context.registryReads, []);
});

test('invalid, wrong-project, non-Google and unverified identities never reach the admin registry', async () => {
  for (const options of [
    { tokenError: true },
    { verifierProject: 'another-project' },
    { claims: { ...staffClaims(), aud: 'another-project' } },
    { claims: { ...staffClaims(), iss: 'https://issuer.invalid' } },
    { claims: { ...staffClaims(), firebase: { sign_in_provider: 'password' } } },
    { claims: { ...staffClaims(), email_verified: false } },
    { claims: { ...staffClaims(), email: 'admin/other@example.test' } },
  ]) {
    const context = fixture(options);
    await assert.rejects(context.authorize(request()), CurriculumApiError);
    assert.deepEqual(context.registryReads, []);
  }
});

test('a valid staff token never grants access without an active existing admin record', async () => {
  for (const registry of [null, { disabled: true }, { isActive: false }]) {
    const context = fixture({ registry });
    await assert.rejects(context.authorize(request()), (error: unknown) => error instanceof CurriculumApiError && error.statusCode === 403);
    assert.deepEqual(context.registryReads, ['admin/admin@example.test']);
  }
});

const invoke = async (handler: ReturnType<typeof createCurriculumCatalogHandler>, method = 'GET') => {
  let status = 0;
  let data: any;
  const headers: Record<string, string> = {};
  const response = {
    setHeader: (key: string, value: string) => { headers[key] = value; },
    status: (code: number) => { status = code; return response; },
    json: (value: unknown) => { data = value; },
  } as unknown as NextApiResponse;
  await handler({ method, headers: {} } as NextApiRequest, response);
  return { status, data, headers };
};

test('catalog reads only sequence metadata and returns the signed-in editor identity', async () => {
  const reads: string[] = [];
  const db: any = { collection: (name: string) => ({ select: (...fields: string[]) => {
    assert.deepEqual(fields, ['isActive', 'publishStatus', 'label', 'name', 'variantName', 'legacyExerciseId', 'publishedModuleId']);
    return { get: async () => {
      reads.push(name);
      return { docs: name === 'pulsecheck-protocols' ? [{ id: 'protocol-478-breathing', data: () => ({ isActive: true, publishStatus: 'published', label: 'Synthetic breathing' }) }] : [] };
    } };
  } }) };
  const handler = createCurriculumCatalogHandler({ authorize: async () => ({ uid: 'athleticmind:synthetic-staff', email: 'admin@example.test', projectId: 'quicklifts-dd3f1', db }) });
  const result = await invoke(handler);
  assert.equal(result.status, 200);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
  assert.deepEqual(reads.sort(), ['pulsecheck-protocols', 'sim-modules', 'mental-exercises', 'sim-variants', 'pulsecheck-protocol-variants'].sort());
  assert.deepEqual(result.data.catalog.proposedOrder, ['protocol-478-breathing']);
  assert.equal(result.data.catalog.active[0].name, 'Synthetic breathing');
  assert.equal(result.data.canEdit, true);
  assert.deepEqual(result.data.identity, { uid: 'athleticmind:synthetic-staff', email: 'admin@example.test', projectId: 'quicklifts-dd3f1' });
});

test('catalog denies writes before authorization and reports authorization/service failures safely', async () => {
  let authorizationCalls = 0;
  const denied = createCurriculumCatalogHandler({ authorize: async () => { authorizationCalls++; throw new CurriculumApiError(403, 'admin_required', 'Admin access is required.'); } });
  const method = await invoke(denied, 'POST');
  assert.equal(method.status, 405);
  assert.equal(method.headers.Allow, 'GET');
  assert.equal(authorizationCalls, 0);
  const unauthorized = await invoke(denied);
  assert.equal(unauthorized.status, 403);
  assert.equal(unauthorized.data.error, 'admin_required');
  const failing = createCurriculumCatalogHandler({ authorize: async () => { throw new Error('secret connection detail'); } });
  const failure = await invoke(failing);
  assert.equal(failure.status, 503);
  assert.equal(JSON.stringify(failure).includes('secret connection detail'), false);
});
