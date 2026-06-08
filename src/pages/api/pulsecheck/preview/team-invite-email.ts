import type { NextApiRequest, NextApiResponse } from 'next';
import { renderTeamInviteEmail } from '../../../../lib/emails/pulsecheckTeamInviteEmail';

/**
 * GET /api/pulsecheck/preview/team-invite-email
 *
 * Renders the REAL PulseCheck team-invite email template (no send) so it can be
 * viewed in a browser — the source of truth, not a rebuilt copy. Unlike the
 * Netlify-function `?preview=1` endpoint, this is a Next.js API route, so it works
 * under plain `next dev` (the preview server) AND in production. The Screen Demo
 * "live template" card points here.
 *
 * Override the sample copy via query string:
 *   ?recipientName=Jordan&organizationName=Riverside&teamName=Varsity%20Football&title=Assistant%20Coach
 */
const str = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = req.query;
  const { html } = renderTeamInviteEmail({
    recipientName: str(q.recipientName) || 'Jordan',
    organizationName: str(q.organizationName) || 'Riverside Athletics',
    teamName: str(q.teamName) || "Men's Track & Field",
    title: str(q.title) || 'Assistant Coach',
    senderName: str(q.senderName) || 'Coach Taylor',
    activationUrl: str(q.activationUrl) || 'https://fitwithpulse.ai/PulseCheck/team-invite/preview-token',
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}
