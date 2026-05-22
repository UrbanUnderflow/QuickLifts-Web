import type { Handler } from '@netlify/functions';
import { getFirestore } from './getServiceAccount';
import {
  buildEmailDedupeKey,
  escapeHtml,
  getBaseSiteUrl,
  resolveRecipient,
  resolveSequenceTemplate,
  sendBrevoTransactionalEmail,
} from './emailSequenceHelpers';
import { evaluateMacraEmailEligibility, MACRA_EMAIL_SENDER } from './macraEmailEligibility';

type SendResponse = {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
};

type RequestBody = {
  userId?: string;
  toEmail?: string;
  firstName?: string;
  isTest?: boolean;
  subjectOverride?: string;
  htmlOverride?: string;
  scheduledAt?: string;
};

type MacroTarget = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type RetargetingContext = {
  goalDirection: string;
  goalLabel: string;
  biggestStruggle: string;
  biggestStruggleLabel: string;
  biggestStruggleProof: string;
  dietaryPreference: string;
  dailyCalories: string;
  proteinGrams: string;
  carbsGrams: string;
  fatGrams: string;
  macroSummary: string;
  mealPlanCount: string;
  mealPlanLabel: string;
};

export type MacraRetargetingEmailConfig = {
  sequenceId: string;
  stateKey: string;
  subject: string;
  eyebrow: string;
  headline: string;
  intro: string;
  proofTitle: string;
  proofBody: string;
  ctaLabel: string;
  tags: string[];
};

const BIGGEST_STRUGGLE_LABELS: Record<string, { label: string; proof: string }> = {
  consistency: {
    label: 'Staying consistent',
    proof: 'Macra keeps the next useful food decision close instead of leaving you with a blank tracker.',
  },
  cravings: {
    label: 'Resisting cravings',
    proof: 'Nora helps protect your calorie target while leaving room for real life.',
  },
  portions: {
    label: 'Knowing portion sizes',
    proof: 'Photo logging and label scanning turn food math into something you can actually see.',
  },
  planning: {
    label: 'Planning meals ahead',
    proof: 'Your meal plan stays connected to your live macro target instead of becoming a static list.',
  },
  knowledge: {
    label: 'Knowing what to eat',
    proof: 'Ask Nora what to change and get answers grounded in your own targets and logs.',
  },
  motivation: {
    label: 'Staying motivated',
    proof: 'Macra gives you a small next move each day, from one scan to one Nora check-in.',
  },
};

const poundsFromKg = (kg: number) => Math.round(kg * 2.20462);

const numberish = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const nonEmptyString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const titleCase = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

function goalLabelFromProfile(profile: Record<string, any> | null): string {
  if (!profile) return 'your goal';

  const currentKg = numberish(profile.currentWeightKg);
  const goalKg = numberish(profile.goalWeightKg);
  if (currentKg > 0 && goalKg > 0) {
    const delta = goalKg - currentKg;
    if (Math.abs(delta) < 1) return `maintain around ${poundsFromKg(goalKg)} lb`;
    return `${delta < 0 ? 'lose' : 'gain'} ${Math.abs(poundsFromKg(goalKg) - poundsFromKg(currentKg))} lb`;
  }

  const direction = nonEmptyString(profile.goalDirection);
  if (direction === 'lose') return 'lose weight';
  if (direction === 'gain') return 'gain weight';
  if (direction === 'maintain') return 'maintain your weight';
  return 'your goal';
}

async function loadMacroTarget(db: any, userId: string, userData: Record<string, any> | null): Promise<MacroTarget | null> {
  try {
    const snap = await db
      .collection('macro-profile')
      .doc(userId)
      .collection('macro-recommendations')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!snap.empty) {
      const data = snap.docs[0].data() || {};
      const target = {
        calories: Math.round(numberish(data.calories)),
        protein: Math.round(numberish(data.protein)),
        carbs: Math.round(numberish(data.carbs)),
        fat: Math.round(numberish(data.fat)),
      };
      if ([target.calories, target.protein, target.carbs, target.fat].some((value) => value > 0)) {
        return target;
      }
    }
  } catch (error) {
    console.warn('[macraRetargetingEmail] Failed to load macro-profile target:', error);
  }

  const personal = (userData?.macros as Record<string, any> | undefined)?.personal;
  if (personal) {
    const target = {
      calories: Math.round(numberish(personal.calories)),
      protein: Math.round(numberish(personal.protein)),
      carbs: Math.round(numberish(personal.carbs)),
      fat: Math.round(numberish(personal.fat)),
    };
    if ([target.calories, target.protein, target.carbs, target.fat].some((value) => value > 0)) {
      return target;
    }
  }

  return null;
}

async function loadRetargetingContext(userId: string, userData: Record<string, any> | null): Promise<RetargetingContext> {
  let profile: Record<string, any> | null = null;
  let mealPlanCount = 0;
  let target: MacroTarget | null = null;

  if (userId) {
    const db = await getFirestore();
    try {
      const profileSnap = await db.collection('users').doc(userId).collection('macra').doc('profile').get();
      if (profileSnap.exists) profile = profileSnap.data() || {};
    } catch (error) {
      console.warn('[macraRetargetingEmail] Failed to load Macra profile:', error);
    }

    target = await loadMacroTarget(db, userId, userData);

    try {
      const planSnap = await db.collection('users').doc(userId).collection('macraSuggestedMealPlans').doc('current').get();
      const planData = planSnap.exists ? planSnap.data() || {} : {};
      const meals = Array.isArray(planData?.plan?.meals) ? planData.plan.meals : [];
      mealPlanCount = meals.length;
    } catch (error) {
      console.warn('[macraRetargetingEmail] Failed to load Macra meal plan:', error);
    }
  }

  const biggestStruggle = nonEmptyString(profile?.biggestStruggle);
  const struggle = BIGGEST_STRUGGLE_LABELS[biggestStruggle] || {
    label: biggestStruggle ? titleCase(biggestStruggle) : 'Making nutrition feel doable',
    proof: 'Macra turns your target into one practical food decision at a time.',
  };
  const goalDirection = nonEmptyString(profile?.goalDirection) || 'unknown';
  const dietaryPreference = nonEmptyString(profile?.dietaryPreference);

  return {
    goalDirection,
    goalLabel: goalLabelFromProfile(profile),
    biggestStruggle,
    biggestStruggleLabel: struggle.label,
    biggestStruggleProof: struggle.proof,
    dietaryPreference: dietaryPreference ? titleCase(dietaryPreference) : 'No specific preference',
    dailyCalories: target?.calories ? String(target.calories) : '',
    proteinGrams: target?.protein ? String(target.protein) : '',
    carbsGrams: target?.carbs ? String(target.carbs) : '',
    fatGrams: target?.fat ? String(target.fat) : '',
    macroSummary: target
      ? `${target.calories} calories, ${target.protein}g protein, ${target.carbs}g carbs, ${target.fat}g fat`
      : 'your calorie and macro target',
    mealPlanCount: mealPlanCount > 0 ? String(mealPlanCount) : '',
    mealPlanLabel: mealPlanCount > 0 ? `${mealPlanCount} meal${mealPlanCount === 1 ? '' : 's'} planned` : 'a meal plan built around your target',
  };
}

function renderFallbackHtml(args: {
  firstName: string;
  macraUrl: string;
  config: MacraRetargetingEmailConfig;
  context: RetargetingContext;
}): string {
  const config = args.config;
  const context = args.context;
  const firstName = escapeHtml(args.firstName || 'there');
  const macraUrl = escapeHtml(args.macraUrl);
  const macroSummary = escapeHtml(context.macroSummary);
  const mealPlanLabel = escapeHtml(context.mealPlanLabel);
  const biggestStruggleLabel = escapeHtml(context.biggestStruggleLabel);
  const biggestStruggleProof = escapeHtml(context.biggestStruggleProof);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(config.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0a0a0b;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
            <tr>
              <td style="padding:6px 8px 18px 8px;text-align:center;">
                <img src="${getBaseSiteUrl()}/macra-icon.png" width="44" height="44" alt="Macra" style="display:inline-block;width:44px;height:44px;border-radius:12px;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="border:1px solid rgba(255,255,255,0.08);background:#18181b;border-radius:20px;overflow:hidden;">
                <div style="height:2px;background:linear-gradient(90deg, transparent, rgba(224,254,16,0.82), transparent);"></div>
                <div style="padding:28px 24px 10px 24px;">
                  <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#E0FE10;font-weight:800;">${escapeHtml(config.eyebrow)}</p>
                  <h1 style="margin:0 0 12px 0;font-size:29px;line-height:1.18;color:#ffffff;font-weight:900;">
                    ${escapeHtml(config.headline).replace('{{firstName}}', firstName)}
                  </h1>
                  <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:#D4D4D8;">
                    ${escapeHtml(config.intro)}
                  </p>
                  <a href="${macraUrl}" style="display:inline-block;background:#E0FE10;color:#101113;text-decoration:none;padding:13px 18px;border-radius:12px;font-weight:900;font-size:14px;">
                    ${escapeHtml(config.ctaLabel)}
                  </a>
                </div>
                <div style="padding:18px 24px 26px 24px;">
                  <div style="padding:16px;border-radius:16px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#ffffff;font-weight:800;">${escapeHtml(config.proofTitle)}</p>
                    <p style="margin:0 0 12px 0;font-size:13px;line-height:1.7;color:#D4D4D8;">${escapeHtml(config.proofBody)}</p>
                    <p style="margin:0;font-size:12px;line-height:1.8;color:#A1A1AA;">
                      <strong style="color:#E4E4E7;">Your target:</strong> ${macroSummary}<br />
                      <strong style="color:#E4E4E7;">Nora plan:</strong> ${mealPlanLabel}<br />
                      <strong style="color:#E4E4E7;">Coaching focus:</strong> ${biggestStruggleLabel}. ${biggestStruggleProof}
                    </p>
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 8px 0 8px;text-align:center;font-size:12px;line-height:1.6;color:#71717A;">
                Sent by Macra · A Pulse Intelligence Labs app<br />
                Reply to this email if you do not want Macra emails.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function markRetargetingSent(args: {
  userId: string;
  config: MacraRetargetingEmailConfig;
  messageId?: string;
}) {
  if (!args.userId) return;

  try {
    const db = await getFirestore();
    await db.collection('users').doc(args.userId).set(
      {
        macraEmailSequenceState: {
          [`${args.config.stateKey}SentAt`]: new Date(),
          [`${args.config.stateKey}EmailProvider`]: 'brevo',
          [`${args.config.stateKey}EmailMessageId`]: args.messageId || null,
          [`${args.config.stateKey}Status`]: 'sent',
          [`${args.config.stateKey}LastUpdatedAt`]: new Date(),
        },
      },
      { merge: true } as any
    );
  } catch (error) {
    console.warn('[macraRetargetingEmail] Failed to update user sent marker:', error);
  }
}

export function createMacraRetargetingEmailHandler(config: MacraRetargetingEmailConfig): Handler {
  return async (event) => {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Method not allowed' } satisfies SendResponse),
      };
    }

    try {
      const body = (event.body ? JSON.parse(event.body) : {}) as RequestBody;
      const { userId, toEmail, firstName, isTest, subjectOverride, htmlOverride, scheduledAt } = body;

      const recipient = await resolveRecipient({ userId, toEmail, firstName });
      if (!recipient) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Missing toEmail / could not resolve recipient' } satisfies SendResponse),
        };
      }

      const ageEligibility = await evaluateMacraEmailEligibility({
        userId,
        userData: recipient.userData,
        sequenceId: config.sequenceId,
        markSkipped: true,
      });
      if (!ageEligibility.eligible) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse),
        };
      }

      const context = await loadRetargetingContext(userId || '', recipient.userData);
      const siteUrl = getBaseSiteUrl();
      const macraUrl = `${siteUrl}/macra`;
      const fallbackHtml = renderFallbackHtml({
        firstName: recipient.firstName,
        macraUrl,
        config,
        context,
      });
      const template = await resolveSequenceTemplate({
        templateDocId: config.sequenceId,
        fallbackSubject: config.subject,
        fallbackHtml,
        subjectOverride,
        htmlOverride,
        vars: {
          firstName: recipient.firstName,
          first_name: recipient.firstName,
          username: recipient.username,
          user_name: recipient.username,
          macraUrl,
          macra_url: macraUrl,
          ...context,
        },
      });

      const idempotencyKey = !isTest
        ? buildEmailDedupeKey([config.sequenceId, userId || recipient.toEmail])
        : '';
      const customHeader = {
        emailSequenceId: config.sequenceId,
        campaignId: config.sequenceId,
        userId: userId || null,
        product: 'macra',
      };
      const idempotencyMetadata = idempotencyKey
        ? {
            sequence: config.sequenceId,
            campaignId: config.sequenceId,
            userId: userId || null,
            toEmail: recipient.toEmail,
            product: 'macra',
          }
        : undefined;

      const sendResult = await sendBrevoTransactionalEmail({
        toEmail: recipient.toEmail,
        toName: recipient.toName,
        subject: template.subject,
        htmlContent: template.html,
        tags: ['macra', 'macra-retargeting', ...config.tags, isTest ? 'test' : ''].filter(Boolean) as string[],
        headers: { 'X-Mailin-custom': JSON.stringify(customHeader) },
        sender: MACRA_EMAIL_SENDER,
        replyTo: MACRA_EMAIL_SENDER,
        scheduledAt,
        idempotencyKey,
        idempotencyMetadata,
        bypassDailyRecipientLimit: Boolean(isTest),
        dailyRecipientMetadata: idempotencyMetadata,
      });

      if (!sendResult.success) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: sendResult.error || 'Failed to send' } satisfies SendResponse),
        };
      }

      if (userId && !isTest && !sendResult.skipped) {
        await markRetargetingSent({ userId, config, messageId: sendResult.messageId });
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, skipped: sendResult.skipped, messageId: sendResult.messageId } satisfies SendResponse),
      };
    } catch (error: any) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: error?.message || 'Internal error' } satisfies SendResponse),
      };
    }
  };
}
