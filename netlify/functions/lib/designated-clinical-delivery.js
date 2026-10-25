const { createHash } = require('crypto');
const active = value => value?.status === 'active' && !value.revokedAt && !value.archivedAt && !value.deletedAt && !value.lifecycleState;
const text = value => typeof value === 'string' ? value.trim() : '';

/** The private settings document, verified program and athlete membership own the recipient. */
async function resolveDesignatedClinicalRoute(db, { teamId, userId, membershipId } = {}) {
  if (!text(teamId) || !text(userId)) return null;
  const team = (await db.collection('pulsecheck-teams').doc(teamId).get()).data();
  if (!active(team) || team.clinicalDeliveryMode !== 'designated_staff' || !text(team.organizationId)) return null;
  const [organization, settings, membership, closure] = await Promise.all([
    db.collection('pulsecheck-organizations').doc(team.organizationId).get(),
    db.collection('pulsecheck-team-escalation-settings').doc(teamId).get(),
    db.collection('pulsecheck-team-memberships').doc(membershipId || `${teamId}_${userId}`).get(),
    db.collection('account-closure-jobs').doc(userId).get(),
  ]);
  const config = settings.data(), member = membership.data();
  if (closure.exists || !active(organization.data()) || !['pulsecheck','athleticmind'].includes(organization.data()?.productBrand) || !active(member) || member.userId !== userId || member.role !== 'athlete'
    || member.teamId !== teamId || member.organizationId !== team.organizationId
    || config?.status !== 'active' || config.teamId !== teamId || config.organizationId !== team.organizationId
    || !Number.isInteger(config.revision) || !text(config.primary?.name)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.primary?.email || '')
    || !/^\+[1-9]\d{7,14}$/.test(config.primary?.phone || '')) return null;
  return { ...config, teamName: text(team.teamName || team.name), member };
}

function withinCoverage(config, now = new Date()) {
  if (config.coverage?.mode === 'always') return true;
  if (config.coverage?.mode !== 'scheduled') return false;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: config.timeZone, weekday: 'short',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(part => [part.type, part.value]));
    const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday);
    const time = `${parts.hour}:${parts.minute}`;
    return config.coverage.days.includes(day) && time >= config.coverage.start && time < config.coverage.end;
  } catch { return false; }
}

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function defaultEmail(input) {
  const { sendBrevoTransactionalEmail } = require('../utils/sendBrevoTransactionalEmail');
  return sendBrevoTransactionalEmail({ toEmail: input.contact.email, toName: input.contact.name,
    sender: { email: process.env.BREVO_SENDER_EMAIL || 'no-reply@fitwithpulse.ai', name: 'Pulse' },
    subject: 'Your program has a clinical support request', textContent: input.message,
    htmlContent: `<p style="white-space:pre-line">${escape(input.message)}</p>`,
    idempotencyKey: input.key, idempotencyMetadata: { sequence: 'designated-clinical-staff', escalationId: input.escalationId },
    bypassDailyRecipientLimit: true });
}

/** Send minimum contact context only. Delivery acknowledgment is never a clinician response. */
async function deliverDesignatedClinicalAlert(db, { config, userId, escalationId, tier }, transports = {}) {
  if (![2,3].includes(Number(tier))) throw Error('A clinical escalation is required.');
  if (!withinCoverage(config)) {
    await db.collection('escalation-records').doc(escalationId).set({staffNotificationStatus:'outside_coverage',handoffStatus:'failed',clinicalDeliveryMode:'designated_staff',providerConfirmed:false},{merge:true});
    return { success:false,status:'outside_coverage',emergencySupportMode:'designated_staff',emergencyHandoffStatus:'outside_coverage',supportRoute:'clinician',providerConfirmed:false };
  }
  const profile = (await db.collection('users').doc(userId).get()).data() || {};
  const message = `Your program has a Tier ${tier} clinical support request. Please use your institution’s response procedure.\nAthlete: ${text(profile.displayName || profile.username) || 'Name unavailable'}\nContact: ${text(config.member.phone || profile.phoneNumber || profile.phone) || 'Phone unavailable'}; ${text(profile.email) || 'Email unavailable'}\nReference: ${escalationId}\n\nThis alert contains no conversation, journal or baseline answers. Delivery does not confirm that a clinician has responded. Pulse does not call emergency services. Urgent resources remain available to the athlete.`;
  const sendEmail = transports.email || defaultEmail;
  const sendSms = transports.sms || require('../utils/sendTwilioSms').sendTwilioSms;
  const smsReady = transports.sms || process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER;
  async function send(channel, contact, slot) {
    const key = createHash('sha256').update(JSON.stringify([escalationId,config.teamId,config.revision,slot,channel])).digest('hex');
    const reference = db.collection('escalation-records').doc(escalationId).collection('staff-deliveries').doc(key);
    const claim = await db.runTransaction(async tx => {
      const prior = (await tx.get(reference)).data();
      if (prior?.status === 'sent') return 'sent';
      // Unknown delivery outcomes require operator reconciliation, never blind duplicate alerts.
      if (['sending','unknown'].includes(prior?.status)) return 'pending';
      tx.set(reference, { channel, slot, revision: config.revision, status:'sending', attemptedAt:Date.now() });
      return 'claimed';
    });
    if (claim !== 'claimed') return { success:claim === 'sent', pending:claim === 'pending' };
    let result;
    try { result = channel === 'email' ? await sendEmail({ contact, message, key, escalationId })
      : await sendSms({ to:contact.phone, body:`Pulse: your program has a clinical support request. Check your work email and use your institution’s response procedure. Reference: ${escalationId}` }); }
    catch { result = { success:false, outcomeUnknown:true }; }
    const confirmed = result.success === true && !result.suppressed && Boolean(text(result.messageId || result.messageSid));
    const unknown = result.outcomeUnknown === true || result.success === true && !result.suppressed && !confirmed;
    await reference.set({ status:confirmed ? 'sent' : unknown ? 'unknown' : 'failed',
      completedAt:Date.now(), messageId:result.messageId || result.messageSid || null }, {merge:true});
    return { success:confirmed, pending:unknown }; 
  }
  const email = await send('email', config.primary, 'primary');
  const sms = smsReady ? await send('sms', config.primary, 'primary') : { success:false, unavailable:true };
  // Confirmed primary failure can try the configured backup; no timed acknowledgment is claimed.
  const backup = !email.success && !sms.success && !email.pending && !sms.pending && config.backup
    ? await send('email', config.backup, 'backup') : null;
  const success = email.success || sms.success || backup?.success === true;
  const pending = !success && (email.pending || sms.pending || backup?.pending);
  const status = success ? 'sent' : pending ? 'pending' : 'failed';
  await db.collection('escalation-records').doc(escalationId).set({ clinicalDeliveryMode:'designated_staff',
    designatedClinicalStaffRevision:config.revision, staffNotificationStatus:status,
    handoffStatus:success ? 'completed' : pending ? 'initiated' : 'failed', providerConfirmed:false,
    staffEmailStatus:email.success?'sent':email.pending?'pending':'failed', staffSmsStatus:sms.unavailable?'unavailable':sms.success?'sent':sms.pending?'pending':'failed' },{merge:true});
  return { success, status, supportRoute:'clinician', emergencySupportMode:'designated_staff', emergencyHandoffStatus:status,
    providerConfirmed:false, message:success?'An alert was sent to your program’s clinical contact. A clinician response is not confirmed.':'Delivery to your program’s clinical contact is not confirmed. Use urgent resources now if you need immediate help.' };
}
module.exports = { resolveDesignatedClinicalRoute, withinCoverage, deliverDesignatedClinicalAlert };
