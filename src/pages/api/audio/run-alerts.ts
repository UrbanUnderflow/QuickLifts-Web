import type { NextApiRequest, NextApiResponse } from 'next';
import firebaseAdminRegistry from '../../../lib/server/firebase/app-registry';

const {
  admin,
  ensureDefaultFirebaseAdminApp,
} = firebaseAdminRegistry as any;

interface RunAlertCue {
  cueKey: string;
  label: string;
  bundleTarget: string;
  downloadURL: string;
  updatedAt: number;
}

type RunAlertResponse =
  | { cues: RunAlertCue[] }
  | { error: string; detail?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RunAlertResponse>
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
      .where('family', '==', 'community-run-alerts')
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ cues: [] });
    }

    const cuesByTarget = new Map<string, RunAlertCue>();

    snapshot.docs.forEach((document: any) => {
      const data = document.data();
      const cue = {
        cueKey: data.cueKey as string,
        label: data.label as string,
        bundleTarget: data.bundleTarget as string,
        downloadURL: data.downloadURL as string,
        updatedAt: (data.updatedAt as number) ?? 0,
      };

      if (!cue.bundleTarget || !cue.downloadURL) return;

      const existing = cuesByTarget.get(cue.bundleTarget);
      if (!existing || cue.updatedAt > existing.updatedAt) {
        cuesByTarget.set(cue.bundleTarget, cue);
      }
    });

    return res.status(200).json({ cues: Array.from(cuesByTarget.values()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[audio/run-alerts] Firestore error:', message);
    return res.status(500).json({ error: 'Failed to fetch run alert sounds', detail: message });
  }
}
