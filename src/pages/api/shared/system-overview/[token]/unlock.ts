import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../../../lib/firebase-admin';
import {
  createSystemOverviewShareAccessCookieValue,
  serializeSystemOverviewShareAccessCookie,
  verifyPasscodeHash,
} from '../../../../../lib/systemOverviewShareAccess';

import { SNAPSHOT_SECTION_ID, consumeSnapshotUnlockAttempt, isValidShareToken, shareExpired } from '../../../../../lib/systemOverviewSnapshotArtifacts';

const COLLECTION = 'systemOverviewShareLinks';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';

  res.setHeader('Cache-Control', 'private, no-store');
  if (!isValidShareToken(token) || !passcode || passcode.length > 256) {
    return res.status(400).json({ error: 'Token and passcode are required.' });
  }

  try {
    const shareSnap = await admin.firestore().collection(COLLECTION).doc(token).get();
    if (!shareSnap.exists) {
      return res.status(404).json({ error: 'Share link not found.' });
    }

    const share = shareSnap.data() || {};
    if (share.revokedAt || shareExpired(share)) {
      return res.status(404).json({ error: 'Share link not found.' });
    }

    if (!share.passcodeProtected || !share.passcodeSalt || !share.passcodeHash) {
      return res.status(400).json({ error: 'This share link does not require a passcode.' });
    }

    if (share.sectionId === SNAPSHOT_SECTION_ID) {
      // Netlify's edge-owned address avoids trusting arbitrary client-supplied forwarding headers.
      const address = String(req.headers['x-nf-client-connection-ip'] || req.socket.remoteAddress || 'unknown');
      if (!await consumeSnapshotUnlockAttempt(admin.firestore(), token, address)) {
        res.setHeader('Retry-After', '900');
        return res.status(429).json({ error: 'Too many attempts. Try again later.' });
      }
    }
    const verified = verifyPasscodeHash(passcode, String(share.passcodeSalt), String(share.passcodeHash));
    if (!verified) {
      return res.status(401).json({ error: 'Incorrect passcode.' });
    }

    const cookieValue = createSystemOverviewShareAccessCookieValue(token);
    res.setHeader('Set-Cookie', serializeSystemOverviewShareAccessCookie(token, cookieValue));
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[shared/system-overview/unlock] Failed to verify passcode:', error);
    return res.status(500).json({ error: 'Failed to unlock shared artifact.' });
  }
}
