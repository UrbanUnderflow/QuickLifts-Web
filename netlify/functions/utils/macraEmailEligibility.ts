import { getFirestore } from './getServiceAccount';

const { getMacraEmailEligibility } = require('./macraStripe');
const PERSONAL_SENDER_EMAIL = 'tre@fitwithpulse.ai';
const DEFAULT_MACRA_SENDER_EMAIL = 'hello@fitwithpulse.ai';

function resolveMacraSenderEmail() {
  const configuredEmail = String(process.env.MACRA_BREVO_SENDER_EMAIL || process.env.MACRA_EMAIL_SENDER_EMAIL || '').trim().toLowerCase();
  if (!configuredEmail || configuredEmail === PERSONAL_SENDER_EMAIL) {
    return DEFAULT_MACRA_SENDER_EMAIL;
  }

  return configuredEmail;
}

export type MacraEmailEligibilityResult = {
  eligible: boolean;
  reason: string | null;
  age: number | null;
  birthdateMs: number | null;
};

export const MACRA_EMAIL_SENDER = {
  email: resolveMacraSenderEmail(),
  name: process.env.MACRA_BREVO_SENDER_NAME || process.env.MACRA_EMAIL_SENDER_NAME || 'Macra',
};

export async function evaluateMacraEmailEligibility(args: {
  db?: any;
  userId?: string;
  userData?: Record<string, any> | null;
  nowMs?: number;
  sequenceId?: string;
  markSkipped?: boolean;
}): Promise<MacraEmailEligibilityResult> {
  const userId = (args.userId || '').trim();
  if (!userId) {
    return {
      eligible: true,
      reason: null,
      age: null,
      birthdateMs: null,
    };
  }

  const db = args.db || (await getFirestore());
  const result = await getMacraEmailEligibility({
    db,
    userId,
    userData: args.userData || {},
    nowMs: args.nowMs || Date.now(),
  });

  if (!result.eligible && args.markSkipped) {
    await db.collection('users').doc(userId).set(
      {
        macraEmailSequenceState: {
          lastEmailEligibilityCheckedAt: new Date(),
          lastEmailSkippedAt: new Date(),
          lastEmailSkipReason: result.reason || 'ineligible',
          lastEmailEligibilityAge: result.age ?? null,
          lastEmailEligibilitySequence: args.sequenceId || null,
        },
      },
      { merge: true } as any
    );
  }

  return result;
}
