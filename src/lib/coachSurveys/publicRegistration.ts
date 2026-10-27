import { randomBytes } from 'crypto';
import { COLLECTION, ROOT, SurveyError, tokenDigest } from './service';
import { VERSION } from './questionnaire';
import { activeRecord } from '../coach-dashboard/access';

export const UMES_ORGANIZATION_ID = '9b72a5f5a31c1a16c91138ca9e7f8fa1d0c57b7062ef56851479274245fc0351';
export function validatePublicRegistration(input: any) {
  if (input?.organization !== 'umes') throw new SurveyError(404, 'This program is unavailable.');
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@umes\.edu$/.test(email) || email.length > 254) throw new SurveyError(400, 'Enter your UMES institutional email.');
  const rawPhone = typeof input.phone === 'string' ? input.phone.trim() : '';
  let phone = rawPhone.replace(/[\s().-]/g, '');
  if (/^\d{10}$/.test(phone)) phone = `+1${phone}`;
  if (/^1\d{10}$/.test(phone)) phone = `+${phone}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new SurveyError(400, 'Enter a valid phone number, including the country code outside the US.');
  if (input.accountConsent !== true) throw new SurveyError(400, 'Agree to account setup to continue.');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(input.teamId || '') || !/^[a-f0-9-]{36}$/i.test(input.requestId || '')) throw new SurveyError(400, 'Refresh this page and choose your team again.');
  return { email, phone, teamId: input.teamId as string, requestId: input.requestId as string };
}
export async function publicProgram(db: FirebaseFirestore.Firestore, organization: unknown) {
  if (organization !== 'umes') throw new SurveyError(404, 'This program is unavailable.');
  const org = (await db.collection('pulsecheck-organizations').doc(UMES_ORGANIZATION_ID).get()).data();
  if (!org || org.status !== 'active' || !activeRecord(org)) throw new SurveyError(404, 'This program is unavailable.');
  const teams = await db.collection('pulsecheck-teams').where('organizationId', '==', UMES_ORGANIZATION_ID).get();
  return {
    organization: { id: UMES_ORGANIZATION_ID, name: org.displayName || org.name || 'University of Maryland Eastern Shore', productBrand: org.productBrand === 'athleticmind' ? 'athleticmind' : 'pulsecheck' },
    teams: teams.docs.filter(d => d.data().status === 'active' && activeRecord(d.data())).map(d => ({ id: d.id, name: String(d.data().displayName || d.data().name || d.data().teamName || 'Team') })).sort((a,b) => a.name.localeCompare(b.name)),
  };
}
// Registration is deliberately separate from users/team-memberships. Possession
// of a shared link and a typed institutional email do not establish a coach role.
export async function registerPublicCoach(db: FirebaseFirestore.Firestore, auth: { getUserByEmail(email: string): Promise<{uid:string}>; createUser(input: {email:string; emailVerified:boolean; password:string}): Promise<{uid:string}> }, input: unknown, rateKey: string, now = Date.now()) {
  const values = validatePublicRegistration(input);
  const program = await publicProgram(db, 'umes');
  if (!program.teams.some(team => team.id === values.teamId)) throw new SurveyError(400, 'Choose a current UMES team.');
  const root = db.collection(COLLECTION).doc(ROOT);
  const registrationId = tokenDigest(values.requestId);
  const ref = root.collection('public-registrations').doc(registrationId);
  const fingerprint = tokenDigest(JSON.stringify([values.email, values.phone, values.teamId]));
  const registration = await db.runTransaction(async tx => {
    const existing = (await tx.get(ref)).data();
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new SurveyError(409, 'Your details changed. Start a new registration.');
      if (existing.expiresAtMs <= now) throw new SurveyError(409, 'This registration expired. Start again.');
      return existing;
    }
    const rateRef = root.collection('public-rate-limits').doc(tokenDigest(`${rateKey}:${Math.floor(now / 3600000)}`));
    const rate = (await tx.get(rateRef)).data();
    if ((rate?.count || 0) >= 30) throw new SurveyError(429, 'Too many requests. Please try again later.');
    const token = randomBytes(32).toString('base64url');
    const record = { ...values, fingerprint, token, organizationId: UMES_ORGANIZATION_ID, participantId: `pending_${registrationId}`, programId: `public_umes_${values.teamId}`, identityStatus: 'unverified', membershipStatus: 'pending-verification-and-approval', accountSetupConsentVersion: 'public-coach-account-v1', accountSetupConsentAtMs: now, smsConsent: false, createdAtMs: now, expiresAtMs: now + 21 * 86400000 };
    tx.create(ref, record);
    tx.set(rateRef, { count: (rate?.count || 0) + 1, expiresAtMs: now + 7200000 });
    return record;
  });
  // Recover safely after an interrupted create: never update existing auth
  // credentials, phone, verification, roles or profile from this public input.
  let user;
  try { user = await auth.getUserByEmail(values.email); }
  catch (error: any) {
    if (error?.code !== 'auth/user-not-found') throw error;
    try { user = await auth.createUser({ email: values.email, emailVerified: false, password: randomBytes(48).toString('base64url') }); }
    catch (createError: any) {
      if (createError?.code !== 'auth/email-already-exists') throw createError;
      user = await auth.getUserByEmail(values.email);
    }
  }
  const invitationId = tokenDigest(registration.token);
  await db.runTransaction(async tx => {
    const invitation = root.collection('invitations').doc(invitationId);
    const current = await tx.get(invitation);
    if (!current.exists) tx.create(invitation, { enabled: true, version: VERSION, kind: 'baseline', participantId: registration.participantId, programId: registration.programId, teamId: values.teamId, organizationId: UMES_ORGANIZATION_ID, periodId: 'baseline', opensAtMs: registration.createdAtMs, expiresAtMs: registration.expiresAtMs, registrationId, identityStatus: 'unverified' });
    tx.set(ref, { candidateAuthUid: user.uid, accountPreparedAtMs: now, baselineResponseId: invitationId }, {merge:true});
  });
  return { path: `/PulseCheck/coach-survey/baseline#token=${registration.token}`, registrationStatus: 'pending-verification' };
}
