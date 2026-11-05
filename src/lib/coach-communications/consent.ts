import { randomUUID } from 'crypto';
import type { firestore } from 'firebase-admin';
import { activeRecord, DashboardAccessError, loadTeamAccess, visibleAthlete } from '../coach-dashboard/access';
import { COLLECTION, ROOT, tokenDigest } from '../coachSurveys/service';
import { assertCommunicationAccountOpen, rootFor, scope, transactionReads, resolveTextContact, consentAllows, eligible } from './service';
export const SMS_CONSENT_VERSION = 'team-texts-v1';
export const SMS_CONSENT_TEXT = 'I agree to receive team texts from PulseCheck, including app invitations and team updates. Message frequency varies. Message and data rates may apply. I can turn texts off here or reply STOP. Texting is optional.';
export function recentPhoneProof(token: any, account: any, uid: string, now = Date.now()) {
  if (token?.uid !== uid || token.firebase?.sign_in_provider !== 'phone' || typeof token.auth_time !== 'number' || now / 1000 - token.auth_time > 600 || token.auth_time > now / 1000 + 60 || !/^\+[1-9]\d{9,14}$/.test(token.phone_number || '') || account?.disabled || account?.uid !== uid || account.phoneNumber !== token.phone_number || !account.providerData?.some((p: any) => p.providerId === 'phone')) throw new DashboardAccessError(401, 'Sign in with your verified phone again before turning texts on.');
  return token.phone_number as string;
}
export async function ownPreferences(db: firestore.Firestore, uid: string, teamId: string) {
  await assertCommunicationAccountOpen(db, uid);
  const { access } = await loadTeamAccess(db, uid, teamId);
  if (!access.athlete) throw new DashboardAccessError(403, 'An active athlete membership is required.');
  const [saved, profile] = await Promise.all([rootFor(db).collection('contacts').doc(`${teamId}_${uid}`).get(), db.collection('users').doc(uid).get()]);
  const contact = resolveTextContact(saved.data(), profile.data() || {}, teamId, uid);
  const stop = contact?.phone ? (await db.collection(COLLECTION).doc(ROOT).collection('sms-suppressions').doc(tokenDigest(contact.phone)).get()).data()?.suppressed === true : false;
  return { enabled: consentAllows(contact, teamId, uid) && !stop, suppressed: stop, phoneLast4: contact?.phone?.slice(-4) || null, version: SMS_CONSENT_VERSION, text: SMS_CONSENT_TEXT };
}
/** phoneProof is server-verified recent Firebase phone authentication, never a submitted contact number. */
export async function setOwnConsent(db: firestore.Firestore, uid: string, teamId: string, accepted: boolean, phoneProof?: string) {
  await assertCommunicationAccountOpen(db, uid);
  const { access } = await loadTeamAccess(db, uid, teamId);
  if (!access.athlete) throw new DashboardAccessError(403, 'An active athlete membership is required.');
  if (accepted && !/^\+[1-9]\d{9,14}$/.test(phoneProof || '')) throw new DashboardAccessError(401, 'Verify your phone again before turning texts on.');
  const root = rootFor(db), contact = root.collection('contacts').doc(`${teamId}_${uid}`), event = root.collection('consent-events').doc(randomUUID());
  const profile = (await db.collection('users').doc(uid).get()).data() || {};
  await db.runTransaction(async tx => {
    const readDb = transactionReads(db, tx);
    await assertCommunicationAccountOpen(readDb, uid);
    if (!(await loadTeamAccess(readDb, uid, teamId)).access.athlete) throw new DashboardAccessError(403, 'Your membership has changed.');
    const current = (await tx.get(contact)).data() || {};
    const member = (await tx.get(db.collection('pulsecheck-team-memberships').doc(`${teamId}_${uid}`))).data();
    const stopped = accepted ? (await tx.get(db.collection(COLLECTION).doc(ROOT).collection('sms-suppressions').doc(tokenDigest(phoneProof!)))).data()?.suppressed === true : false;
    if (!member || member.userId !== uid || member.teamId !== teamId || member.role !== 'athlete' || !activeRecord(member)) throw new DashboardAccessError(403, 'Your membership has changed.');
    if (stopped) throw new DashboardAccessError(409, 'A previous STOP is still active. Contact support to review restarting texts.');
    const atMs = Date.now();
    tx.set(contact, accepted ? { teamId, athleteId: uid, displayName: String(profile.preferredName || profile.displayName || 'Athlete').slice(0,100), phone: phoneProof!, enabled: true, consent: { purpose: 'team-communications', status: 'granted', grantedAtMs: atMs, evidenceId: event.id, version: SMS_CONSENT_VERSION } } : { ...current, teamId, athleteId: uid, enabled: false, consent: { ...(current.consent || {}), status: 'withdrawn', withdrawnAtMs: atMs } });
    tx.create(event, { uid, teamId, accepted, version: SMS_CONSENT_VERSION, text: SMS_CONSENT_TEXT, atMs, ...(accepted ? { phoneHash: tokenDigest(phoneProof!) } : {}) });
  });
  return ownPreferences(db, uid, teamId);
}
export async function pauseContact(db: firestore.Firestore, uid: string, teamId: string, athleteId: string) {
  const { membership } = await scope(db, uid, teamId);
  if (!visibleAthlete(membership, athleteId)) throw new DashboardAccessError(403, 'This athlete is outside your roster access.');
  const root = rootFor(db), ref = root.collection('contacts').doc(`${teamId}_${athleteId}`);
  await db.runTransaction(async tx => {
    const fresh = await scope(transactionReads(db, tx), uid, teamId);
    if (!visibleAthlete(fresh.membership, athleteId)) throw new DashboardAccessError(403, 'This athlete is outside your roster access.');
    // Validate active athlete/team authority even if STOP or pause already blocks sending.
    await eligible(transactionReads(db, tx), uid, teamId, athleteId);
    const c = (await tx.get(ref)).data();
    if (c && (c.teamId !== teamId || c.athleteId !== athleteId)) throw new DashboardAccessError(409, 'Texting contact scope changed.');
    tx.set(ref, { teamId, athleteId, enabled: false }, { merge: true });
    tx.create(root.collection('consent-events').doc(randomUUID()), { uid, teamId, athleteId, action: 'coach-paused', atMs: Date.now() });
  });
  return { paused: true };
}
