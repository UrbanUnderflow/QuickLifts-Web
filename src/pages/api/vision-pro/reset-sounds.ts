import type { NextApiRequest, NextApiResponse } from 'next';
import firebaseAdminRegistry from '../../../lib/server/firebase/app-registry';

const {
  admin,
  ensureDefaultFirebaseAdminApp,
} = firebaseAdminRegistry as any;

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
    ensureDefaultFirebaseAdminApp({
      mode: 'prod',
      runtime: 'next-api',
      allowApplicationDefault: process.env.NODE_ENV !== 'production',
      failClosed: process.env.NODE_ENV === 'production',
    });

    const firestore = admin.firestore();

    const snapshot = await firestore
      .collection('sim-audio-assets')
      .where('family', '==', 'vision-pro-reset')
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ cues: [] });
    }

    const cues: SoundCue[] = snapshot.docs
      .map((doc: any) => {
        const data = doc.data();
        return {
          cueKey: data.cueKey as string,
          label: data.label as string,
          downloadURL: data.downloadURL as string,
          updatedAt: (data.updatedAt as number) ?? 0,
        };
      })
      .filter((c: SoundCue) => c.cueKey && c.downloadURL); // drop any malformed docs

    return res.status(200).json({ cues });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[vision-pro/reset-sounds] Firestore error:', message);
    return res.status(500).json({ error: 'Failed to fetch sound cues', detail: message });
  }
}
