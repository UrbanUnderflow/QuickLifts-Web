import { cadenceDays, effectiveSchedule, nextScheduledDate } from './cadence';
import { randomBytes } from 'crypto';
import { COLLECTION, ROOT, tokenDigest } from './service';
import { validateEnrollment, enrollmentIdFor, DELIVERY_RELEASE_APPROVED, type Enrollment } from './delivery';
import { VERSION } from './questionnaire';
import { coachSurveyStatus } from './setup';
import { loadTeamAccess, validTeamId } from '../coach-dashboard/access';

export async function assertSurveyAdmin(app: { auth: () => { verifyIdToken: (token: string, revoked: boolean) => Promise<{ uid: string; email?: string }> }; firestore: () => FirebaseFirestore.Firestore }, token: string) {
  const actor = await app.auth().verifyIdToken(token, true), db = app.firestore();
  if (!actor.uid || !actor.email || (await db.collection('account-closure-jobs').doc(actor.uid).get()).exists) throw Error('Admin authentication required.');
  const emails = [...new Set([actor.email.trim(), actor.email.trim().toLowerCase(), actor.email.trim().toUpperCase()])];
  if (!(await Promise.all(emails.map(email => db.collection('admin').doc(email).get()))).some(record => record.exists)) throw Error('Admin authentication required.');
  return { db, uid: actor.uid };
}
export async function verifyCoach(db: FirebaseFirestore.Firestore, uid: string, teamId: string) {
  if (!validTeamId(uid) || !validTeamId(teamId)) throw Error('Choose a valid coach and team.');
  if ((await db.collection('account-closure-jobs').doc(uid).get()).exists) throw Error('Coach account is unavailable.');
  const { membership, access } = await loadTeamAccess(db, uid, teamId);
  if (membership.role !== 'coach' || !access.participation) throw Error('Choose an active coach in this team.');
  const user = (await db.collection('users').doc(uid).get()).data();
  return { uid, name: String(user?.displayName || user?.username || uid), email: String(user?.email || '').trim().toLowerCase(), phone: String(user?.phoneNumber || '').trim() };
}
export async function manageCoachSurvey(db: FirebaseFirestore.Firestore, actor: string, request: any, now = Date.now()) {
  const root = db.collection(COLLECTION).doc(ROOT);
  if (request?.action === 'team-cadence') {
    if (!validTeamId(request.teamId) || !(await db.collection('pulsecheck-teams').doc(request.teamId).get()).exists) throw Error('Choose an existing team.');
    const days = cadenceDays(request.cadenceDays);
    const ref = root.collection('team-settings').doc(request.teamId);
    return db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if ((current?.cadenceDays ?? null) === days) return { unchanged: true };
      tx.set(ref, { cadenceDays: days, changedAtMs: now, updatedBy: actor });
      tx.create(root.collection('admin-events').doc(randomBytes(16).toString('hex')), {action:'team-cadence', teamId:request.teamId, cadenceDays:days, actor, atMs:now});
      return { status:'updated' };
    });
  }
  if (!['save', 'baseline-link', 'pause', 'stop', 'enable', 'coach-cadence'].includes(request?.action)) throw Error('Unsupported survey action.');
  if (!validTeamId(request.teamId) || !validTeamId(request.participantId) || !validTeamId(request.programId)) throw Error('Choose valid team, program and coach IDs.');
  // Administrators can always pause/stop an existing enrollment, including after
  // a coach leaves the team. Creating links or resuming requires active access.
  const coach = ['pause', 'stop'].includes(request.action)
    ? { uid: request.participantId, email: '', phone: '' }
    : await verifyCoach(db, request.participantId, request.teamId);
  if (!['pause', 'stop'].includes(request.action)) {
    const pilot = (await db.collection('pulsecheck-pilots').doc(request.programId).get()).data();
    if (!pilot || pilot.teamId !== request.teamId || ['completed', 'archived'].includes(pilot.status)) throw Error('Choose an available pilot belonging to this team.');
  }
  const id = enrollmentIdFor(request.participantId, request.programId), ref = root.collection('enrollments').doc(id);
  return db.runTransaction(async tx => {
    const existing = (await tx.get(ref)).data();
    if (existing && existing.teamId !== request.teamId) throw Error('This program enrollment belongs to another team.');
    const event = root.collection('admin-events').doc(randomBytes(16).toString('hex'));
    if (request.action === 'save') {
      if (!request.consentConfirmed || !request.recipientVerified || typeof request.consentReference !== 'string' || !request.consentReference.trim() || request.consentReference.length > 500) throw Error('Record verified recipients, consent and its evidence reference.');
      const source = request.config || {};
      const baselineResponseId = existing?.baselineResponseId || tokenDigest(randomBytes(32).toString('base64url'));
      const channels: Enrollment['channels'] = {};
      for (const channel of ['email', 'sms'] as const) if (source.channels?.includes(channel)) {
        const destination = channel === 'email' ? coach.email : coach.phone;
        channels[channel] = { destination, consentRecordedAtMs: now, recipientVerifiedAtMs: now, suppressed: existing?.channels?.[channel]?.suppressed === true };
      }
      const config = validateEnrollment({ enabled: false, approved: false, participantId: coach.uid, programId: request.programId, teamId: request.teamId, baselineResponseId, startDate: source.startDate, endDate: source.endDate, timeZone: source.timeZone, sendHour: source.sendHour, messageVersion: 'coach-check-in-v1', channels, cadenceDaysOverride: existing?.cadenceDaysOverride ?? null, cadenceChangedAtMs: existing?.cadenceChangedAtMs || 0 });
      let smsSyncRef: FirebaseFirestore.DocumentReference | undefined;
      if (channels.sms && request.smsProviderStateConfirmed === true) {
        smsSyncRef = root.collection('sms-suppressions').doc(tokenDigest(channels.sms.destination));
        const current = (await tx.get(smsSyncRef)).data();
        if (current?.suppressed === true || current?.stoppedAtMs) throw Error('A prior SMS opt-out cannot be cleared by saving settings. Renewed consent and a reviewed restart are required.');
      }
      tx.set(ref, { ...config, ...(existing?.stoppedAtMs ? { stoppedAtMs: existing.stoppedAtMs } : {}), consentReference: request.consentReference.trim(), updatedBy: actor, updatedAtMs: now });
      if (smsSyncRef) tx.set(smsSyncRef, { suppressed: false, synchronizedAtMs: now, synchronizedBy: actor }, { merge: true });
      tx.create(event, { action: 'save-paused', enrollmentId: id, actor, atMs: now });
      return { id, status: 'paused' };
    }
    if (!existing) throw Error('Save a paused setup first.');
    if (request.action === 'coach-cadence') {
      const days = cadenceDays(request.cadenceDays);
      if ((existing.cadenceDaysOverride ?? null) === days) return { unchanged: true };
      tx.update(ref, {cadenceDaysOverride:days,cadenceChangedAtMs:now,updatedBy:actor,updatedAtMs:now});
      tx.create(event,{action:'coach-cadence',enrollmentId:id,cadenceDays:days,actor,atMs:now});
      return {status:'updated'};
    }
    if (request.action === 'baseline-link') {
      if ((await tx.get(root.collection('responses').doc(existing.baselineResponseId))).exists) throw Error('Baseline already completed.');
      const packetRef = root.collection('baseline-packets').doc(id);
      const packet = (await tx.get(packetRef)).data();
      const prior = (await tx.get(root.collection('invitations').doc(existing.baselineResponseId))).data();
      if (prior?.enabled && prior.expiresAtMs > now && packet?.token && tokenDigest(packet.token) === existing.baselineResponseId && !request.regenerate) {
        return {id,path:`/PulseCheck/coach-survey/baseline#token=${packet.token}`,managePath:`/PulseCheck/coach-survey/stop#token=${packet.stopToken}`,expiresAtMs:prior.expiresAtMs,reused:true};
      }
      if (prior && request.regenerate !== true) throw Error('This invitation expired or cannot be copied. Confirm regeneration to replace it.');
      const token = randomBytes(32).toString('base64url'), invitationId = tokenDigest(token), stopToken = randomBytes(32).toString('base64url');
      tx.set(packetRef,{token,stopToken,invitationId});
      tx.create(root.collection('stop-tokens').doc(tokenDigest(stopToken)),{enrollmentId:id});
      // Reissuing revokes the old capability before returning a new one.
      tx.set(root.collection('invitations').doc(existing.baselineResponseId), { enabled: false }, { merge: true });
      tx.create(root.collection('invitations').doc(invitationId), { enabled: true, version: VERSION, kind: 'baseline', participantId: coach.uid, programId: request.programId, teamId: request.teamId, periodId: 'baseline', opensAtMs: now, expiresAtMs: now + 21 * 86400000 });
      tx.update(ref, { baselineResponseId: invitationId, updatedBy: actor, updatedAtMs: now });
      tx.create(event, { action: 'baseline-link', enrollmentId: id, actor, atMs: now });
      return { id, path: `/PulseCheck/coach-survey/baseline#token=${token}`, managePath:`/PulseCheck/coach-survey/stop#token=${stopToken}`,expiresAtMs:now+21*86400000 };
    }
    if (request.action === 'enable') {
      if (!DELIVERY_RELEASE_APPROVED) throw Error('Recurring delivery is held for release approval.');
      if (existing.stoppedAtMs) throw Error('Stopped enrollments require renewed consent and a reviewed restart workflow.');
      const baseline = (await tx.get(root.collection('responses').doc(existing.baselineResponseId))).data();
      if (!baseline || baseline.participantId !== coach.uid || baseline.programId !== request.programId || baseline.kind !== 'baseline') throw Error('Complete the baseline first.');
      validateEnrollment(existing as Enrollment);
    }
    tx.update(ref, { enabled: request.action === 'enable', approved: request.action === 'enable', ...(request.action === 'stop' ? { stoppedAtMs: now } : {}), updatedBy: actor, updatedAtMs: now });
    tx.create(event, { action: request.action, enrollmentId: id, actor, atMs: now });
    return { id, status: request.action === 'enable' ? 'scheduled' : request.action === 'stop' ? 'stopped' : 'paused' };
  });
}
export async function readCoachSurveys(db: FirebaseFirestore.Firestore, teamId: string) {
  if (!validTeamId(teamId)) throw Error('Choose a valid team.');
  const root = db.collection(COLLECTION).doc(ROOT);
  const teamCadence = (await root.collection('team-settings').doc(teamId).get()).data() || {};
  const memberships = await db.collection('pulsecheck-team-memberships').where('teamId', '==', teamId).get();
  const candidates = (await Promise.all(memberships.docs.filter(doc => doc.data().role === 'coach').map(async doc => { try { return await verifyCoach(db, doc.data().userId, teamId); } catch { return null; } }))).filter(Boolean);
  const enrollments = await root.collection('enrollments').where('teamId', '==', teamId).get();
  const rows = [];
  for (const doc of enrollments.docs) {
    const v = doc.data() as Enrollment;
    const [baseline, responses, deliveries] = await Promise.all([root.collection('responses').doc(v.baselineResponseId).get(), root.collection('responses').where('participantId', '==', v.participantId).get(), root.collection('deliveries').where('enrollmentId', '==', doc.id).get()]);
    const history = deliveries.docs.map(d => d.data()).sort((a,b) => b.updatedAtMs-a.updatedAtMs);
    const invitation = (await root.collection('invitations').doc(v.baselineResponseId).get()).data();
    const baselineLinkState = baseline.exists ? 'completed' : !invitation ? 'not created' : invitation.enabled && invitation.expiresAtMs > Date.now() ? 'ready' : 'expired or replaced';
    rows.push({ id: doc.id, baselineLinkState, config: v, cadence: effectiveSchedule(v, teamCadence), nextScheduledDate: nextScheduledDate(v,teamCadence), status: coachSurveyStatus(v, baseline.exists, history[0] as {status:string}|undefined), responses: responses.docs.map(d => ({ id:d.id,...d.data() })).filter((d:any) => d.programId===v.programId).sort((a:any,b:any)=>b.submittedAtMs-a.submittedAtMs), deliveries: history.slice(0,20) });
  }
  return { candidates, enrollments: rows, teamCadence, manualEmailEnabled:process.env.COACH_SURVEY_MANUAL_EMAIL_ENABLED==='true', deliveryReleaseApproved: DELIVERY_RELEASE_APPROVED };
}

// One-time development test results, behind the same admin authorization.
export async function readCoachSurveyUserTest(db: FirebaseFirestore.Firestore) {
  const root = db.collection(COLLECTION).doc(ROOT);
  const records = await root.collection('responses').where('programId', '==', 'coach-user-test-20261025').get();
  return { responses: records.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((row: any) => ['coach-user-test-20261025-user', 'coach-user-test-20261025-qa'].includes(row.participantId)) };
}
