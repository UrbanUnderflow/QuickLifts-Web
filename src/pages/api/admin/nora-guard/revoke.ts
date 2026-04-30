import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminRequest } from '../_auth';
import { getFirebaseAdminApp } from '../../../../lib/firebase-admin';

type RevokeResponse =
  | { success: true; conversationId: string; state?: string }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RevokeResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const adminRequest = await requireAdminRequest(req);
  if (!adminRequest) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
  const revokedReason = typeof body.revokedReason === 'string'
    ? body.revokedReason.trim()
    : 'Revoked from Nora Guard admin.';

  if (!conversationId) {
    return res.status(400).json({ error: 'conversationId is required.' });
  }

  try {
    const [{ closeConversation }] = await Promise.all([
      import('../../../../api/firebase/noraConversation/orchestrator'),
    ]);
    const adminApp = getFirebaseAdminApp();
    const conversation = await closeConversation(
      {
        conversationId,
        reason: 'revoked',
        revokedByUserId: adminRequest.email,
        revokedReason,
      },
      { firestore: adminApp.firestore() }
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    return res.status(200).json({
      success: true,
      conversationId,
      state: conversation.state,
    });
  } catch (error) {
    console.error('[admin/nora-guard/revoke] Failed to revoke conversation:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to revoke conversation.',
    });
  }
}
