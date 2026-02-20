/**
 * Integration test for /api/partners/onboard
 *
 * NOTE: This test is designed as a true integration test:
 * - It assumes a Next.js dev server is running locally on http://localhost:3000
 * - It uses firebase-admin with serviceAccountKey.json to read back Firestore state
 *
 * To run (once a test runner like Jest is wired up):
 *   - Start the dev server: `npm run dev` or `yarn dev`
 *   - Run the test via your Jest setup (e.g., `jest tests/api/partners/onboard.test.ts`)
 */

import fetch from 'node-fetch';
import * as admin from 'firebase-admin';
import path from 'path';

// Lazy singleton admin initialization to avoid duplicate app errors in watch mode
let firestore: admin.firestore.Firestore | null = null;

function getFirestore(): admin.firestore.Firestore {
  if (firestore) return firestore;

  if (!admin.apps.length) {
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      projectId: (serviceAccount as any).project_id,
    });
  }

  firestore = admin.firestore();
  return firestore;
}

const BASE_URL = 'http://localhost:3000';

describe('/api/partners/onboard integration', () => {
  const collectionName = 'partners';

  it('creates a new partner with invitedAt and no firstRoundCreatedAt', async () => {
    const email = `test-partner-${Date.now()}@example.com`;

    const res = await fetch(`${BASE_URL}/api/partners/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'brand',
        contactEmail: email,
        onboardingStage: 'invited',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.partner).toBeDefined();
    expect(body.partner.type).toBe('brand');
    expect(body.partner.contactEmail).toBe(email.toLowerCase());
    expect(body.partner.onboardingStage).toBe('invited');
    expect(body.partner.invitedAt).toBeTruthy();
    expect(body.partner.firstRoundCreatedAt).toBeNull();

    const db = getFirestore();
    const docSnap = await db
      .collection(collectionName)
      .doc(body.partnerId)
      .get();

    expect(docSnap.exists).toBe(true);
    const data = docSnap.data() as any;

    expect(data.type).toBe('brand');
    expect(data.contactEmail).toBe(email.toLowerCase());
    expect(data.onboardingStage).toBe('invited');
    expect(data.invitedAt).toBeDefined();
    expect(data.firstRoundCreatedAt).toBeUndefined();
  });

  it('sets firstRoundCreatedAt only when firstRoundCreated flag is true', async () => {
    const email = `test-partner-first-round-${Date.now()}@example.com`;

    // 1) Create partner without firstRoundCreated flag
    const createRes = await fetch(`${BASE_URL}/api/partners/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'gym',
        contactEmail: email,
        onboardingStage: 'invited',
      }),
    });

    expect(createRes.status).toBe(200);
    const created = await createRes.json();

    const partnerId = created.partnerId as string;

    // 2) Update with firstRoundCreated flag set to true
    const updateRes = await fetch(`${BASE_URL}/api/partners/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: partnerId,
        type: 'gym',
        contactEmail: email,
        onboardingStage: 'active',
        firstRoundCreated: true,
      }),
    });

    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();

    expect(updated.success).toBe(true);
    expect(updated.partner.onboardingStage).toBe('active');
    expect(updated.partner.firstRoundCreatedAt).toBeTruthy();

    const db = getFirestore();
    const docSnap = await db.collection(collectionName).doc(partnerId).get();

    expect(docSnap.exists).toBe(true);
    const data = docSnap.data() as any;

    expect(data.type).toBe('gym');
    expect(data.contactEmail).toBe(email.toLowerCase());
    expect(data.onboardingStage).toBe('active');
    expect(data.invitedAt).toBeDefined();
    expect(data.firstRoundCreatedAt).toBeDefined();
  });

  it('returns 400 for invalid type or email', async () => {
    const res = await fetch(`${BASE_URL}/api/partners/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'invalid-type',
        contactEmail: 'not-an-email',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();

    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid request body');
    expect(Array.isArray(body.details)).toBe(true);
    const fields = body.details.map((d: any) => d.field).sort();
    expect(fields).toContain('type');
    expect(fields).toContain('contactEmail');
  });
});
