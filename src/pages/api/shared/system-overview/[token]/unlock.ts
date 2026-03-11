import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../../../lib/firebase-admin';
import {
  createSystemOverviewShareAccessCookieValue,
  serializeSystemOverviewShareAccessCookie,
  verifyPasscodeHash,
} from '../../../../../lib/systemOverviewShareAccess';

const COLLECTION = 'systemOverviewShareLinks';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';

  if (!token || !passcode) {
    return res.status(400).json({ error: 'Token and passcode are required.' });
  }

  try {
    const shareSnap = await admin.firestore().collection(COLLECTION).doc(token).get();
    if (!shareSnap.exists) {
      return res.status(404).json({ error: 'Share link not found.' });
    }

    const share = shareSnap.data() || {};
    if (share.revokedAt) {
      return res.status(404).json({ error: 'Share link not found.' });
    }

    if (!share.passcodeProtected || !share.passcodeSalt || !share.passcodeHash) {
      return res.status(400).json({ error: 'This share link does not require a passcode.' });
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
