import type { NextApiRequest, NextApiResponse } from 'next';
import { renderAthleteInviteEmail } from '../../../../lib/emails/pulsecheckAthleteInviteEmail';

/**
 * GET /api/pulsecheck/preview/athlete-invite-email
 *
 * Renders the REAL PulseCheck athlete-invite email template (no send) so it can be
 * viewed in a browser — the source of truth, not a rebuilt copy. Next.js API route,
 * so it works under plain `next dev` (the preview server) AND in production. The
 * Screen Demo "athlete invite email" card points here.
 *
 * Override the sample copy via query string:
 *   ?recipientName=Jordan&organizationName=Riverside&teamName=Varsity%20Football
 */
const str = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = req.query;
  const { html } = renderAthleteInviteEmail({
    recipientName: str(q.recipientName) || 'Jordan',
    organizationName: str(q.organizationName) || 'Riverside Athletics',
    teamName: str(q.teamName) || "Men's Track & Field",
    senderName: str(q.senderName) || 'Coach Taylor',
    activationUrl: str(q.activationUrl) || 'https://fitwithpulse.ai/PulseCheck/team-invite/preview-token',
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}
