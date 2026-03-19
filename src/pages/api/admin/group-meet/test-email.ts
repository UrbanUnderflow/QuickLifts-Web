import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminRequest } from '../_auth';
import { getGroupMeetBaseUrl, sendGroupMeetInviteEmail } from '../../../../lib/groupMeetAdmin';

type TestEmailBody = {
  recipientName?: string;
  recipientEmail?: string;
  requestTitle?: string;
  targetMonth?: string;
  deadlineAt?: string;
  timezone?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = (req.body || {}) as TestEmailBody;
    const recipientName = (body.recipientName || adminUser.email || 'there').trim();
    const recipientEmail = (body.recipientEmail || adminUser.email || '').trim().toLowerCase();
    const requestTitle = (body.requestTitle || 'Group Meet').trim() || 'Group Meet';
    const targetMonth = (body.targetMonth || '').trim();
    const timezone = (body.timezone || 'America/New_York').trim() || 'America/New_York';
    const deadlineAt = body.deadlineAt || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    if (!recipientEmail) {
      return res.status(400).json({ error: 'Recipient email is required.' });
    }

    const baseUrl = getGroupMeetBaseUrl(req).replace(/\/+$/, '');
    const shareUrl = `${baseUrl}/admin/groupMeet?emailTest=1`;

    const result = await sendGroupMeetInviteEmail({
      requestTitle,
      targetMonth: targetMonth || new Date().toISOString().slice(0, 7),
      deadlineAt,
      timezone,
      recipientName,
      recipientEmail,
      shareUrl,
      mode: 'test',
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to send test email.' });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[group-meet-test-email] Failed to send test email:', error);
    return res.status(500).json({ error: error?.message || 'Failed to send test email.' });
  }
}
