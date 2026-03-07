import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config';
import { User } from '../user';
import { clubService } from './service';

interface CheckinAttribution {
  /** ID of the user who shared the QR code / link */
  referredBy?: string | null;
  /** How the user authenticated: 'apple' | 'email-signup' | 'email-signin' | 'existing' */
  authMethod?: string | null;
  /** Always 'web' for this flow */
  platform?: string;
  /** Raw user-agent string for device analytics */
  userAgent?: string | null;
}

interface RecordClubEventCheckinArgs {
  clubId: string;
  eventId?: string | null;
  user: User;
  source?: string;
  attribution?: CheckinAttribution;
}

export const recordClubEventCheckin = async ({
  clubId,
  eventId,
  user,
  source = 'event-checkin',
  attribution,
}: RecordClubEventCheckinArgs): Promise<void> => {
  if (!eventId) {
    return;
  }

  const eventRef = doc(db, 'clubEventCheckins', clubId, 'events', eventId);
  const checkinRef = doc(db, 'clubEventCheckins', clubId, 'events', eventId, 'checkins', user.id);

  const [eventSnapshot, checkinSnapshot] = await Promise.all([
    getDoc(eventRef),
    getDoc(checkinRef),
  ]);

  const eventPayload: Record<string, unknown> = {
    clubId,
    eventId,
    source,
    updatedAt: serverTimestamp(),
  };

  if (!eventSnapshot.exists()) {
    eventPayload.createdAt = serverTimestamp();
  }

  const checkinPayload: Record<string, unknown> = {
    clubId,
    eventId,
    userId: user.id,
    source,
    email: user.email,
    username: user.username,
    displayName: user.displayName || user.username,
    userInfo: user.toShortUser().toDictionary(),
    updatedAt: serverTimestamp(),
  };

  // Attribution fields for analytics
  if (attribution) {
    checkinPayload.referredBy = attribution.referredBy || null;
    checkinPayload.authMethod = attribution.authMethod || null;
    checkinPayload.platform = attribution.platform || 'web';
    checkinPayload.userAgent = attribution.userAgent || null;
  }

  if (!checkinSnapshot.exists()) {
    checkinPayload.checkedInAt = serverTimestamp();
    checkinPayload.createdAt = serverTimestamp();
  }

  await Promise.all([
    setDoc(eventRef, eventPayload, { merge: true }),
    setDoc(checkinRef, checkinPayload, { merge: true }),
  ]);
};

export const completeClubEventCheckin = async ({
  clubId,
  eventId,
  user,
  attribution,
}: RecordClubEventCheckinArgs): Promise<void> => {
  // Build a joinedVia string that encodes the source for membership analytics
  const joinedVia = attribution?.referredBy
    ? `event-checkin:${attribution.referredBy}`
    : 'event-checkin';

  await clubService.joinClub(clubId, user.id, user.toShortUser(), joinedVia);
  await recordClubEventCheckin({
    clubId,
    eventId,
    user,
    source: 'event-checkin',
    attribution,
  });
};

