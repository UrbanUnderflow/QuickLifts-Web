import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config';
import { User } from '../user';
import { clubService } from './service';

interface RecordClubEventCheckinArgs {
  clubId: string;
  eventId?: string | null;
  user: User;
  source?: string;
}

export const recordClubEventCheckin = async ({
  clubId,
  eventId,
  user,
  source = 'event-checkin',
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
}: RecordClubEventCheckinArgs): Promise<void> => {
  await clubService.joinClub(clubId, user.id, user.toShortUser(), 'event-checkin');
  await recordClubEventCheckin({
    clubId,
    eventId,
    user,
    source: 'event-checkin',
  });
};
