import type { NextApiRequest, NextApiResponse } from 'next';
import { validateBookingProfile } from '../../../../lib/groupMeetBooking';
import { bookingApiError, getBookingProfile, saveBookingProfile, requireBookingAdmin } from '../../../../lib/groupMeetBookingServer';
import { getGoogleCalendarSetupStatus } from '../../../../lib/googleCalendar';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'PUT'].includes(req.method || '')) { res.setHeader('Allow', 'GET, PUT'); return res.status(405).end(); }
  try {
    if (!await requireBookingAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
    if (req.method === 'PUT') await saveBookingProfile(validateBookingProfile(req.body));
    return res.status(200).json({ profile: await getBookingProfile(), calendarSetup: await getGoogleCalendarSetupStatus() });
  } catch (error) { return bookingApiError(res, error); }
}
export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };
