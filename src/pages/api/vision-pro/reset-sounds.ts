import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';

// ─── Firebase Admin init (mirrors netlify/functions/config/firebase.js) ───────

function formatPrivateKey(key: string | undefined): string {
  if (!key) return '';
  let k = key.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1);
  }
  if (k.includes('\\n')) k = k.replace(/\\n/g, '\n');
  return k;
}

function getAdminApp(): admin.app.App {
  const appName = 'vision-pro-reset-sounds';
  try {
    return admin.app(appName);
  } catch {
    // Not yet initialized — create it now
  }

  const projectId   = process.env.FIREBASE_PROJECT_ID   || 'quicklifts-dd3f1';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com';
  const privateKey  = formatPrivateKey(process.env.FIREBASE_SECRET_KEY || process.env.FIREBASE_PRIVATE_KEY);

  console.log('[reset-sounds] Firebase init — project:', projectId, '| email present:', !!clientEmail, '| key present:', !!privateKey);

  return admin.initializeApp(
    {
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      } as admin.ServiceAccount),
    },
    appName,
  );
}

// ─── Response types ──────────────────────────────────────────────────────────

interface SoundCue {
  cueKey: string;
  label: string;
  downloadURL: string;
  updatedAt: number;
}

type ResetSoundsResponse =
  | { cues: SoundCue[] }
  | { error: string; detail?: string };

// ─── Handler ─────────────────────────────────────────────────────────────────

/**
 * GET /api/vision-pro/reset-sounds
 *
 * Returns the five Vision Pro Reset / Next Play spatial sound cues stored in
 * the `sim-audio-assets` Firestore collection (family = "vision-pro-reset").
 *
 * Called by the visionOS app at session start to preload audio without
 * requiring the Firebase SDK on the visionOS target.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResetSoundsResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const firestore = getAdminApp().firestore();

    const snapshot = await firestore
      .collection('sim-audio-assets')
      .where('family', '==', 'vision-pro-reset')
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ cues: [] });
    }

    const cues: SoundCue[] = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          cueKey: data.cueKey as string,
          label: data.label as string,
          downloadURL: data.downloadURL as string,
          updatedAt: (data.updatedAt as number) ?? 0,
        };
      })
      .filter((c) => c.cueKey && c.downloadURL); // drop any malformed docs

    return res.status(200).json({ cues });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[vision-pro/reset-sounds] Firestore error:', message);
    return res.status(500).json({ error: 'Failed to fetch sound cues', detail: message });
  }
}
