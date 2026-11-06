import type { firestore } from 'firebase-admin';
import { validTeamId } from '../coach-dashboard/access';
import { COLLECTION, tokenDigest } from '../coachSurveys/service';
import { SMS_CONSENT_TEXT, SMS_CONSENT_VERSION } from './consent-copy';
import { communicationSetting } from './config';

export const recordedConsentRequired = () => communicationSetting('COACH_COMMUNICATIONS_REQUIRE_RECORDED_CONSENT') === 'true';

/** Only saved, current-version, phone-bound acceptance evidence qualifies.
 * Keep this independent of delivery eligibility so STOP and pauses retain their
 * own meaning, and pass transactionReads(db, tx) when checking a queue claim. */
export async function hasRecordedTextConsent(db: firestore.Firestore, contact: Record<string, any> | undefined, teamId: string, uid: string): Promise<boolean> {
  const grant = contact?.consent;
  if (!contact || contact.teamId !== teamId || contact.athleteId !== uid ||
      typeof contact.phone !== 'string' || !/^\+[1-9]\d{9,14}$/.test(contact.phone) ||
      grant?.purpose !== 'team-communications' || grant.status !== 'granted' ||
      grant.withdrawnAtMs != null || grant.version !== SMS_CONSENT_VERSION || !validTeamId(grant.evidenceId)) return false;
  const event = (await db.collection(COLLECTION).doc('coach-communications-v1').collection('consent-events').doc(grant.evidenceId).get()).data();
  return event?.uid === uid && event?.teamId === teamId && event?.accepted === true &&
    event?.version === SMS_CONSENT_VERSION && event?.text === SMS_CONSENT_TEXT && event?.phoneHash === tokenDigest(contact.phone);
}
