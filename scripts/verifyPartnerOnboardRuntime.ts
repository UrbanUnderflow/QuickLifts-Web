import handler from '../src/pages/api/partners/onboard';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../serviceAccountKey.json';

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount as any) });
  }

  const db = getFirestore();
  const stamp = Date.now();
  const partnerId = `verify-partner-${stamp}`;
  const body = {
    id: partnerId,
    type: 'brand',
    name: 'Verification Partner',
    contactEmail: `verify+${stamp}@example.com`,
    onboardingStage: 'first-round-created',
  };

  const req: any = {
    method: 'POST',
    body,
  };

  const result: { statusCode?: number; jsonBody?: any; headers?: Record<string, string> } = {};
  const res: any = {
    status(code: number) {
      result.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      result.headers ||= {};
      result.headers[name] = value;
      return this;
    },
    json(payload: any) {
      result.jsonBody = payload;
      return this;
    },
  };

  await handler(req, res);

  const snap = await db.collection('partners').doc(partnerId).get();
  const data = snap.data() || null;

  console.log(
    JSON.stringify(
      {
        requestBody: body,
        response: result,
        firestore: {
          exists: snap.exists,
          id: snap.id,
          data,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
