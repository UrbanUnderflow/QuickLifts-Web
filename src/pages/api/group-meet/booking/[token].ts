import type { NextApiRequest, NextApiResponse } from 'next';
import { publicBookingProfile } from '../../../../lib/groupMeetBooking';
import { bookingApiError, changeIndividualBooking, findBooking, getBookingProfile, limitBookingRequests, safeBooking, listRescheduleSlots, refreshBookingMeetingLink } from '../../../../lib/groupMeetBookingServer';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (!['GET', 'POST'].includes(req.method || '')) { res.setHeader('Allow', 'GET, POST'); return res.status(405).end(); }
  try {
    await limitBookingRequests(req, req.method === 'POST');
    if (req.method === 'GET') {
      if (req.query.slots === '1') return res.status(200).json({ slots: await listRescheduleSlots(req.query.token, Number(req.query.duration)) });
      const { ref, record } = await findBooking(req.query.token);
      return res.status(200).json({ booking: safeBooking(await refreshBookingMeetingLink(ref, record)), profile: publicBookingProfile(await getBookingProfile()) });
    }
    return res.status(200).json({ booking: await changeIndividualBooking(req.query.token, req.body) });
  } catch (error) { return bookingApiError(res, error); }
}
export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };
