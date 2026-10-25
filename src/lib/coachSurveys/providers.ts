import type { DeliveryDependencies, SendResult } from './delivery';
import { COLLECTION, ROOT, tokenDigest } from './service';
import { loadTeamAccess } from '../coach-dashboard/access';
// Signed opt-out handling is implemented locally. Keep SMS held until the
// registered provider configuration and suppression synchronization are verified.
export const SMS_RELEASE_APPROVED = false;
export function coachSurveyProviders(db: FirebaseFirestore.Firestore): DeliveryDependencies {
  return {
    async eligible(v, channel) {
      if (channel === 'sms') {
        if (!SMS_RELEASE_APPROVED || process.env.COACH_SURVEY_SMS_WEBHOOK_ENABLED !== 'true') return false;
        const destination = v.channels.sms?.destination;
        if (!destination) return false;
        const suppression = (await db.collection(COLLECTION).doc(ROOT).collection('sms-suppressions').doc(tokenDigest(destination)).get()).data();
        if (suppression?.suppressed !== false) return false; // Explicit reviewed provider/local synchronization required.
      }
      if ((await db.collection('account-closure-jobs').doc(v.participantId).get()).exists) return false;
      const pilot = (await db.collection('pulsecheck-pilots').doc(v.programId).get()).data();
      if (!pilot || pilot.teamId !== v.teamId || pilot.status !== 'active' ||
        (pilot.endAt?.toMillis && pilot.endAt.toMillis() <= Date.now())) return false;
      const { membership, access } = await loadTeamAccess(db, v.participantId, v.teamId);
      return membership.role === 'coach' && access.participation;
    },
    async send(channel, destination, message, key): Promise<SendResult> {
      if (channel === 'sms') {
        if (!SMS_RELEASE_APPROVED) return { status: 'suppressed' };
        const { sendTwilioSms } = await import('../../../netlify/functions/utils/sendTwilioSms');
        const result = await sendTwilioSms({ to: destination, body: message.sms });
        if (result.success && result.messageSid) return { status: 'sent', messageId: result.messageSid };
        return { status: result.skipped ? 'retryable' : 'uncertain' };
      }
      const { sendBrevoTransactionalEmail } = await import('../../../netlify/functions/utils/emailSequenceHelpers');
      const result = await sendBrevoTransactionalEmail({ toEmail: destination, subject: message.subject,
        htmlContent: message.html, textContent:message.text, idempotencyKey: `coach-survey-${key}`,
        failClosedOnSuppressionError: true, tags: ['coach-survey-check-in'],
      });
      if (result.suppressed) return { status: 'suppressed' };
      if (result.success && result.messageId) return { status: 'sent', messageId: result.messageId };
      // Only known pre-provider failures are automatically safe to retry.
      if (result.error === 'Brevo not configured' || result.error === 'Unable to verify email suppression. Sending stopped for review.') return { status: 'retryable' };
      return { status: 'uncertain' };
    },
  };
}
