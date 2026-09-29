import type { NextApiRequest, NextApiResponse } from 'next';
import { publicBookingProfile } from '../../../../lib/groupMeetBooking';
import { bookingApiError, createIndividualBooking, limitBookingRequests, listBookingSlots, requirePublicProfile, resolveCreateProfile } from '../../../../lib/groupMeetBookingServer';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method || '')) { res.setHeader('Allow', 'GET, POST'); return res.status(405).end(); }
  try {
    await limitBookingRequests(req, req.method === 'POST');
    const profile = req.method === 'POST' ? await resolveCreateProfile(req.query.slug, req.body) : await requirePublicProfile(req.query.slug);
    if (req.method === 'GET') {
      const duration = profile.durations.includes(Number(req.query.duration)) ? Number(req.query.duration) : profile.durations[0];
      return res.status(200).json({ profile: publicBookingProfile(profile), slots: await listBookingSlots(profile, duration) });
    }
    return res.status(200).json({ booking: await createIndividualBooking(profile, req.body) });
  } catch (error) { return bookingApiError(res, error); }
}
export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };
