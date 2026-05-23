import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useDispatch } from 'react-redux';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Mail, Send, Loader2, CheckCircle, AlertCircle, X, Edit3, Eye, Copy, Clock, FilePlus2 } from 'lucide-react';
import { showToast } from '../../redux/toastSlice';
import { useUser } from '../../hooks/useUser';

type SequenceRow = {
  id: string;
  name: string;
  trigger: string;
  defaultSubject: string;
  functionPath: string;
  templateDocId: string;
  scheduleConfigDocId?: string; // if present, allows admin to control scheduled automation config
  scheduleDescription?: string;
  supportsScheduleTime?: boolean;
  defaultScheduleEnabled?: boolean;
  deliveryRuntime?: 'netlify' | 'firebase';
  supportsTemplateEditing?: boolean;
  supportsTestSend?: boolean;
  supportsCampaignConfig?: boolean;
  openInAdminPath?: string;
  openInAdminLabel?: string;
};

type TemplatePreviewSource = 'none' | 'firestore' | 'draft' | 'default' | 'generic';
type TemplateBuildMode = 'preview' | 'seed';

type DefaultTemplatePreview = {
  subject: string;
  html: string;
  source: Extract<TemplatePreviewSource, 'none' | 'default' | 'generic'>;
};

type MacraPreviewCopy = {
  eyebrow: string;
  headline: string;
  intro: string;
  proofTitle?: string;
  proofBody: string;
  ctaLabel: string;
  ctaHref?: string;
  contextRows?: Array<{ label: string; value: string }>;
};

type CampaignConfig = {
  delayHours: number;
  batchLimit: number;
  maxSendsPerRun: number;
  scanEveryHours: number;
  sendWindowStartLocal: string;
  sendWindowEndLocal: string;
  sendWindowTimezone: string;
};

const MACRA_WEB_OFFER_SEQUENCE_ID = 'macra-web-offer-24h-v1';
const MACRA_RETARGETING_SEQUENCE_CONFIG_ID = 'macra-retargeting-v1';
const CAMPAIGN_SEND_WINDOW_TIMEZONE = 'America/New_York';
const DEFAULT_CAMPAIGN_CONFIG: CampaignConfig = {
  delayHours: 24,
  batchLimit: 250,
  maxSendsPerRun: 80,
  scanEveryHours: 1,
  sendWindowStartLocal: '09:00',
  sendWindowEndLocal: '17:00',
  sendWindowTimezone: CAMPAIGN_SEND_WINDOW_TIMEZONE,
};

const normalizeLocalTime = (value: unknown, fallback: string) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{2}:\d{2}$/.test(raw)) return fallback;

  const [hourRaw, minuteRaw] = raw.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const normalizeCampaignConfig = (data: Record<string, any> = {}): CampaignConfig => ({
  delayHours: Math.max(1, Number(data.delayHours || DEFAULT_CAMPAIGN_CONFIG.delayHours) || DEFAULT_CAMPAIGN_CONFIG.delayHours),
  batchLimit: Math.max(25, Number(data.batchLimit || DEFAULT_CAMPAIGN_CONFIG.batchLimit) || DEFAULT_CAMPAIGN_CONFIG.batchLimit),
  maxSendsPerRun: Math.max(1, Number(data.maxSendsPerRun || DEFAULT_CAMPAIGN_CONFIG.maxSendsPerRun) || DEFAULT_CAMPAIGN_CONFIG.maxSendsPerRun),
  scanEveryHours: Math.max(1, Number(data.scanEveryHours || DEFAULT_CAMPAIGN_CONFIG.scanEveryHours) || DEFAULT_CAMPAIGN_CONFIG.scanEveryHours),
  sendWindowStartLocal: normalizeLocalTime(data.sendWindowStartLocal, DEFAULT_CAMPAIGN_CONFIG.sendWindowStartLocal),
  sendWindowEndLocal: normalizeLocalTime(data.sendWindowEndLocal, DEFAULT_CAMPAIGN_CONFIG.sendWindowEndLocal),
  sendWindowTimezone: typeof data.sendWindowTimezone === 'string' && data.sendWindowTimezone.trim()
    ? data.sendWindowTimezone.trim()
    : DEFAULT_CAMPAIGN_CONFIG.sendWindowTimezone,
});

const parseIntegerDraft = (value: string): number | null => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const hasCampaignControls = (seq: Pick<SequenceRow, 'id' | 'supportsCampaignConfig' | 'scheduleConfigDocId'> | null) =>
  Boolean(
    seq?.supportsCampaignConfig ||
    seq?.id === MACRA_WEB_OFFER_SEQUENCE_ID ||
    seq?.scheduleConfigDocId === MACRA_RETARGETING_SEQUENCE_CONFIG_ID
  );

const EMPTY_TEMPLATE_PREVIEW: DefaultTemplatePreview = { subject: '', html: '', source: 'none' };

const PREVIEW_TEMPLATE_VALUES: Record<string, string> = {
  firstName: 'Tremaine',
  followerName: 'Jordan',
  athleteName: 'Maya',
  teamName: 'PulseCheck Team',
  prizeAmount: '25',
  challengeTitle: 'May Challenge',
  source: 'App',
  username: 'sample-user',
  milestone: '7',
  hoursRemaining: '24',
  eventTitle: 'Community Lift Night',
  tipTitle: 'Build one anchor meal',
  daysInactive: '3',
  macroSummary: '2,150 calories, 165g protein, 210g carbs, 65g fat',
  mealPlanLabel: '3 meals plus 1 snack built from your onboarding profile',
  biggestStruggleLabel: 'Evening cravings',
  biggestStruggleProof: 'Keep a protein-first option ready before dinner.',
};

const MACRA_RETARGETING_PREVIEW_CONTEXT_ROWS = [
  { label: 'Your target', value: '{{macroSummary}}' },
  { label: 'Nora plan', value: '{{mealPlanLabel}}' },
  { label: 'Coaching focus', value: '{{biggestStruggleLabel}}. {{biggestStruggleProof}}' },
];

const PULSE_PREVIEW_COPY_BY_SEQUENCE_ID: Record<string, MacraPreviewCopy> = {
  'welcome-v1': {
    eyebrow: 'Welcome',
    headline: 'Welcome to Pulse, {{firstName}}.',
    intro: 'Your account is ready. Set up your profile, find your first workout, and start building momentum inside Pulse.',
    proofTitle: 'Start here',
    proofBody: 'Open Pulse, finish your profile, and choose the next training action that fits your goal.',
    ctaLabel: 'Open Pulse',
    ctaHref: 'https://fitwithpulse.ai/dashboard',
  },
  'username-reminder-v1': {
    eyebrow: 'Almost done',
    headline: 'Finish setting up your Pulse account, {{firstName}}.',
    intro: 'You are one step away from completing registration. Pick your username so your account is ready when you come back.',
    proofTitle: 'Why it matters',
    proofBody: 'Your username helps connect your workouts, challenge activity, and community profile in Pulse.',
    ctaLabel: 'Finish setup',
    ctaHref: 'https://fitwithpulse.ai',
  },
  'new-follower-v1': {
    eyebrow: 'New follower',
    headline: '{{followerName}} is now following you on Pulse.',
    intro: 'Someone new is following your training activity. Open Pulse to view their profile and keep the connection moving.',
    proofTitle: 'Stay connected',
    proofBody: 'Followers help your workouts, challenges, and creator activity travel further through the Pulse community.',
    ctaLabel: 'Open Pulse',
    ctaHref: 'https://fitwithpulse.ai',
  },
  'coach-connection-v1': {
    eyebrow: 'PulseCheck',
    headline: '{{athleteName}} just connected with you on PulseCheck.',
    intro: '{{coachName}}, you can now message this athlete and support their training progress from your coach dashboard.',
    proofTitle: 'Next step',
    proofBody: 'Review their profile, open the conversation, and help them keep their training moving.',
    ctaLabel: 'View coach dashboard',
    ctaHref: '{{dashboardUrl}}',
  },
  'pulsecheck-pilot-activation-v1': {
    eyebrow: 'Access ready',
    headline: '{{teamName}} access is ready in PulseCheck.',
    intro: 'Your pilot access has been activated. Reopen the app to finish consent and complete setup.',
    proofTitle: 'What to do now',
    proofBody: 'Open PulseCheck, review the consent flow, and finish the remaining setup steps for your team experience.',
    ctaLabel: 'Open PulseCheck',
    ctaHref: '{{openAppUrl}}',
  },
  'winner-notification-v1': {
    eyebrow: 'Challenge winner',
    headline: 'You won ${{prizeAmount}} in {{challengeTitle}}!',
    intro: 'Nice work, {{firstName}}. Your challenge result has been confirmed and your prize details are ready to review.',
    proofTitle: 'Prize status',
    proofBody: 'Open your dashboard to review challenge results, payout details, and next steps.',
    ctaLabel: 'View results',
    ctaHref: '{{dashboardUrl}}',
  },
  'approval-v1': {
    eyebrow: 'Approved',
    headline: "You're approved, {{firstName}}.",
    intro: 'Welcome to Pulse Programming. You now have access to the Founding Coach experience.',
    proofTitle: 'Start here',
    proofBody: 'Download the app, complete your profile, create your first Move, Stack, and Round, then launch a challenge with your audience.',
    ctaLabel: 'Open getting started guide',
    ctaHref: '{{gettingStartedUrl}}',
  },
  'joined-round-no-workout-v1': {
    eyebrow: 'Round reminder',
    headline: 'Your Round is waiting, {{firstName}}.',
    intro: 'You joined {{challengeTitle}} but have not started your first workout yet.',
    proofTitle: 'Start with one session',
    proofBody: 'Open the Round and complete your first workout. Momentum starts with one completed training session.',
    ctaLabel: 'Start first workout',
    ctaHref: '{{roundUrl}}',
  },
  'first-workout-celebration-v1': {
    eyebrow: 'First workout complete',
    headline: 'First workout complete. Huge win, {{firstName}}.',
    intro: 'You just finished your first workout in {{challengeTitle}}.',
    proofTitle: 'Next action',
    proofBody: 'Lock in your next workout now while momentum is high, then review your progress on the dashboard.',
    ctaLabel: 'Plan next workout',
    ctaHref: '{{roundUrl}}',
  },
  'streak-milestone-v1': {
    eyebrow: 'Streak milestone',
    headline: '{{milestone}}-day streak unlocked.',
    intro: '{{firstName}}, you hit a {{milestone}}-day consistency milestone in {{challengeTitle}}.',
    proofTitle: 'Keep it alive',
    proofBody: 'Open your Round and complete the next session while your rhythm is still fresh.',
    ctaLabel: 'Keep streak going',
    ctaHref: '{{roundUrl}}',
  },
  'challenge-ending-soon-v1': {
    eyebrow: 'Challenge ending soon',
    headline: '{{hoursRemaining}} hours left in {{challengeTitle}}.',
    intro: '{{firstName}}, finish strong. You are at {{completedCount}}/{{totalPlanned}} planned workouts.',
    proofTitle: 'Final push',
    proofBody: 'Complete your next workout now, then keep momentum going with standalone workouts after this challenge.',
    ctaLabel: 'Finish challenge strong',
    ctaHref: '{{roundUrl}}',
  },
  'irl-event-analytics-report-v1': {
    eyebrow: 'Event analytics',
    headline: 'Your {{eventTitle}} analytics report is ready.',
    intro: 'Your event has wrapped, and the attendance and engagement summary is ready to review.',
    proofTitle: 'Inside the report',
    proofBody: 'Review check-ins, attendance timing, platform breakdown, and share-driven activity from the event.',
    ctaLabel: 'Open report',
    ctaHref: '{{clubUrl}}',
  },
  'inactivity-winback-v1': {
    eyebrow: 'Pulse check-in',
    headline: "Let's get you back in motion, {{firstName}}.",
    intro: 'It has been a few days since your last meaningful activity. Start small and rebuild the rhythm today.',
    proofTitle: 'One useful action',
    proofBody: 'Open Pulse, choose a workout, and complete one training session to get momentum back.',
    ctaLabel: 'Open Pulse',
    ctaHref: '{{dashboardUrl}}',
  },
  'password-reset-v1': {
    eyebrow: 'Password reset',
    headline: 'Reset your Pulse password.',
    intro: 'Use the secure link below to choose a new password for your account.',
    proofTitle: 'Security note',
    proofBody: 'If you did not request this reset, you can ignore this email and your password will stay the same.',
    ctaLabel: 'Reset password',
    ctaHref: '{{resetLink}}',
  },
  'error-alerts-v1': {
    eyebrow: 'Pulse error alert',
    headline: '[Pulse Error Alert] {{source}} ({{username}})',
    intro: 'A new app error was recorded and needs review.',
    proofTitle: 'Review context',
    proofBody: 'Open the error logs dashboard to inspect the source, user, and stack details.',
    ctaLabel: 'Open error logs',
    ctaHref: 'https://fitwithpulse.ai/admin/ErrorLogs',
  },
};

const MACRA_PREVIEW_COPY_BY_SEQUENCE_ID: Record<string, MacraPreviewCopy> = {
  'macra-welcome-v1': {
    eyebrow: 'Plan ready',
    headline: 'Welcome to Macra, {{firstName}}.',
    intro: 'Your plan is live. Nora, your AI nutrition coach, is ready to help you hit your macros every day.',
    proofTitle: 'Three ways to start strong',
    proofBody: 'Log your first meal, ask Nora what to adjust, then check what is left for the day before dinner.',
    ctaLabel: 'Open Macra',
    ctaHref: 'https://fitwithpulse.ai/macra',
  },
  'macra-tips-v1': {
    eyebrow: 'Nora tip',
    headline: 'Build one anchor meal today, {{firstName}}.',
    intro: 'A predictable breakfast or lunch makes the rest of the day easier to adjust. Nora can help you make that meal fit your target.',
    proofTitle: 'Small wins compound',
    proofBody: 'Once one meal is dialed in, Macra can show what is left for the day and help you avoid guessing later.',
    ctaLabel: 'Open Macra',
    ctaHref: '{{macraUrl}}',
  },
  'macra-inactivity-winback-v1': {
    eyebrow: 'Macra check-in',
    headline: "Nora's missing you, {{firstName}}.",
    intro: 'It has been a few days since your last food log. You already have the plan, so the fastest way back is one simple meal entry.',
    proofTitle: 'Pick the day back up',
    proofBody: 'Log one meal and Nora can rebuild the rest of today around your remaining calories, protein, carbs, and fat.',
    ctaLabel: 'Log a meal',
    ctaHref: '{{macraUrl}}',
  },
  [MACRA_WEB_OFFER_SEQUENCE_ID]: {
    eyebrow: 'One free month',
    headline: 'Your Macra plan is ready, {{firstName}}.',
    intro: 'You already built your nutrition profile. Start Macra today and your first month is free before the subscription renews.',
    proofTitle: 'What Nora unlocks',
    proofBody: 'Inside Macra, Nora helps turn your profile into targets, meal feedback, and daily coaching so you know exactly what to adjust next.',
    ctaLabel: 'Start your free month',
    ctaHref: '{{checkoutUrl}}',
  },
  'macra-paywall-cancel-trust-v1': {
    eyebrow: 'Macra trial',
    headline: 'No payment today, {{firstName}}. Apple confirms the details first.',
    intro:
      "You tapped to start Macra, then stopped before the trial began. The next screen is Apple's subscription sheet, where you can review the exact plan and renewal price before approving anything.",
    proofTitle: 'What happens when you try again',
    proofBody:
      'Macra unlocks your target, scanner, meal plan, and Nora coaching after you confirm. If it is not the right fit, you can cancel from Apple Subscriptions before renewal.',
    ctaLabel: 'Open Macra',
    ctaHref: '{{macraUrl}}',
    contextRows: MACRA_RETARGETING_PREVIEW_CONTEXT_ROWS,
  },
  'macra-web-offer-proof-v1': {
    eyebrow: 'Your plan preview',
    headline: '{{firstName}}, your Macra plan was built around your goal.',
    intro:
      'You already gave Macra enough context to build a useful starting point. Your targets, meal plan, and Nora coaching are meant to turn that goal into a clear food decision today.',
    proofTitle: 'Why this is different from a blank food tracker',
    proofBody:
      'Macra starts from your profile instead of asking you to guess. Nora uses your target, plan, and saved meals to help you decide what fits next.',
    ctaLabel: 'Review my plan',
    ctaHref: '{{macraUrl}}',
    contextRows: MACRA_RETARGETING_PREVIEW_CONTEXT_ROWS,
  },
  'macra-paywall-view-value-v1': {
    eyebrow: 'One useful action',
    headline: 'Start with one meal today, {{firstName}}.',
    intro: 'You do not need a perfect tracking day to learn something useful. Scan one real meal and Macra will show how it fits your target.',
    proofTitle: 'The first win is clarity',
    proofBody: 'A single photo can turn guessing into calories, protein, carbs, and fat, then Nora can help with what to eat next.',
    ctaLabel: 'Scan one meal',
    ctaHref: '{{macraUrl}}',
    contextRows: MACRA_RETARGETING_PREVIEW_CONTEXT_ROWS,
  },
  'macra-no-trial-7d-challenge-v1': {
    eyebrow: '7-day check-in',
    headline: 'Try Macra with one real meal, {{firstName}}.',
    intro: 'No hard sell. Open Macra, scan one meal you were already going to eat, and see what Nora does with the numbers.',
    proofTitle: 'One meal is enough to feel the loop',
    proofBody: 'Macra turns the scan into a macro breakdown, compares it to your target, and helps you make the next food choice.',
    ctaLabel: 'Try one meal',
    ctaHref: '{{macraUrl}}',
    contextRows: MACRA_RETARGETING_PREVIEW_CONTEXT_ROWS,
  },
  'macra-trial-no-activation-24h-v1': {
    eyebrow: 'Trial active',
    headline: 'Your trial is active, {{firstName}}. Start with one meal.',
    intro: 'The fastest way to feel Macra is to log one meal now. Nora can coach the day better once she has a first signal.',
    proofTitle: 'Start the trial with context',
    proofBody: 'After your first meal, Macra can show what is left for the day and Nora can help you adjust before dinner.',
    ctaLabel: 'Log my first meal',
    ctaHref: '{{macraUrl}}',
    contextRows: MACRA_RETARGETING_PREVIEW_CONTEXT_ROWS,
  },
};

const escapePreviewHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const applyPreviewTemplateValues = (value: string) =>
  value.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => PREVIEW_TEMPLATE_VALUES[key] || key);

const renderTemplateValue = (value: string, mode: TemplateBuildMode) =>
  mode === 'preview' ? applyPreviewTemplateValues(value) : value;

const renderTemplateHref = (value: string | undefined, mode: TemplateBuildMode) =>
  mode === 'preview' ? '#' : value || '#';

const getPreviewSiteOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://fitwithpulse.ai';
};

const buildMacraTemplateHtml = (seq: SequenceRow, copy: MacraPreviewCopy, subjectOverride?: string, mode: TemplateBuildMode = 'preview'): string => {
  const subject = renderTemplateValue((subjectOverride || seq.defaultSubject).trim() || seq.defaultSubject, mode);
  const logoUrl = `${getPreviewSiteOrigin()}/macra-icon.png`;
  const headline = renderTemplateValue(copy.headline, mode);
  const ctaHref = renderTemplateHref(copy.ctaHref, mode);
  const contextRows = copy.contextRows || [];
  const proofTitleHtml = copy.proofTitle
    ? `<p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#ffffff;font-weight:800;">${escapePreviewHtml(copy.proofTitle)}</p>`
    : '';
  const contextHtml = contextRows.length
    ? `<p style="margin:0;font-size:12px;line-height:1.8;color:#A1A1AA;">
${contextRows
  .map(
    (row) => `
                      <strong style="color:#E4E4E7;">${escapePreviewHtml(row.label)}:</strong> ${escapePreviewHtml(renderTemplateValue(row.value, mode))}<br />`
  )
  .join('')}                    </p>`
    : '';
  const proofBodyMargin = contextRows.length ? '0 0 12px 0' : '0';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapePreviewHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0a0a0b;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
            <tr>
              <td style="padding:6px 8px 18px 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
                  <tr>
                    <td style="vertical-align:middle;padding-right:12px;">
                      <img src="${escapePreviewHtml(logoUrl)}" width="44" height="44" alt="Macra" style="display:block;width:44px;height:44px;border-radius:12px;border:0;outline:none;text-decoration:none;" />
                    </td>
                    <td style="vertical-align:middle;font-weight:800;color:#ffffff;font-size:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">Macra</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid rgba(255,255,255,0.08);background:#18181b;border-radius:20px;overflow:hidden;">
                <div style="height:2px;background:linear-gradient(90deg, transparent, rgba(224,254,16,0.82), transparent);"></div>
                <div style="padding:28px 24px 10px 24px;">
                  <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#E0FE10;font-weight:800;">${escapePreviewHtml(copy.eyebrow)}</p>
                  <h1 style="margin:0 0 12px 0;font-size:29px;line-height:1.18;color:#ffffff;font-weight:900;">
                    ${escapePreviewHtml(headline)}
                  </h1>
                  <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:#D4D4D8;">
                    ${escapePreviewHtml(copy.intro)}
                  </p>
                  <a href="${escapePreviewHtml(ctaHref)}" style="display:inline-block;background:#E0FE10;color:#101113;text-decoration:none;padding:13px 18px;border-radius:12px;font-weight:900;font-size:14px;">
                    ${escapePreviewHtml(copy.ctaLabel)}
                  </a>
                </div>
                <div style="padding:18px 24px 26px 24px;">
                  <div style="padding:16px;border-radius:16px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.06);">
                    ${proofTitleHtml}
                    <p style="margin:${proofBodyMargin};font-size:13px;line-height:1.7;color:#D4D4D8;">${escapePreviewHtml(copy.proofBody)}</p>
                    ${contextHtml}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 8px 0 8px;text-align:center;font-size:12px;line-height:1.6;color:#71717A;">
                Sent by Macra &middot; A Pulse Intelligence Labs app<br />
                Reply to this email if you do not want Macra emails.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const buildGenericTemplateHtml = (seq: SequenceRow, copy: MacraPreviewCopy, subjectOverride?: string, mode: TemplateBuildMode = 'preview'): string => {
  const subject = renderTemplateValue((subjectOverride || seq.defaultSubject).trim() || seq.defaultSubject, mode);
  const headline = renderTemplateValue(copy.headline, mode);
  const intro = renderTemplateValue(copy.intro, mode);
  const proofBody = renderTemplateValue(copy.proofBody, mode);
  const ctaHref = renderTemplateHref(copy.ctaHref, mode);
  const proofTitleHtml = copy.proofTitle
    ? `<p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#ffffff;font-weight:800;">${escapePreviewHtml(copy.proofTitle)}</p>`
    : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapePreviewHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0f1216;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0f1216;padding:28px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background:#1a1e24;border:1px solid #2f3640;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:26px 24px;color:#f4f4f5;">
                <p style="margin:0 0 8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:#d7ff00;font-weight:800;">${escapePreviewHtml(copy.eyebrow)}</p>
                <h1 style="margin:0 0 12px 0;font-size:26px;line-height:1.22;color:#ffffff;">${escapePreviewHtml(headline)}</h1>
                <p style="margin:0 0 18px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  ${escapePreviewHtml(intro)}
                </p>
                <div style="margin:0 0 18px 0;padding:14px 14px;border-radius:14px;background:rgba(0,0,0,0.32);border:1px solid rgba(255,255,255,0.06);">
                  ${proofTitleHtml}
                  <p style="margin:0;font-size:13px;line-height:1.7;color:#d4d4d8;">${escapePreviewHtml(proofBody)}</p>
                </div>
                <a href="${escapePreviewHtml(ctaHref)}" style="display:inline-block;background:#d7ff00;color:#101113;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:800;font-size:14px;">
                  ${escapePreviewHtml(copy.ctaLabel)}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const buildDefaultEmailTemplate = (seq: SequenceRow, subjectOverride?: string, mode: TemplateBuildMode = 'preview'): DefaultTemplatePreview => {
  const subject = renderTemplateValue((subjectOverride || seq.defaultSubject).trim() || seq.defaultSubject, mode);
  const macraCopy = MACRA_PREVIEW_COPY_BY_SEQUENCE_ID[seq.id];
  if (macraCopy) {
    return { subject, html: buildMacraTemplateHtml(seq, macraCopy, subjectOverride, mode), source: 'default' };
  }
  const pulseCopy = PULSE_PREVIEW_COPY_BY_SEQUENCE_ID[seq.id];
  if (pulseCopy) {
    return { subject, html: buildGenericTemplateHtml(seq, pulseCopy, subjectOverride, mode), source: 'default' };
  }
  if (seq.id.startsWith('macra-')) {
    return {
      subject,
      html: buildMacraTemplateHtml(
        seq,
        {
          eyebrow: 'Macra email',
          headline: subjectOverride || seq.defaultSubject,
          intro: 'No custom HTML is saved yet, so this preview shows a Macra-styled fallback for the send function.',
          proofTitle: 'Fallback behavior',
          proofBody: 'Real sends continue to use the send-function fallback until a custom template is saved here.',
          ctaLabel: 'Open Macra',
          ctaHref: 'https://fitwithpulse.ai/macra',
        },
        subjectOverride,
        mode
      ),
      source: 'generic',
    };
  }
  return {
    subject,
    html: buildGenericTemplateHtml(
      seq,
      {
        eyebrow: 'Pulse email',
        headline: subjectOverride || seq.defaultSubject,
        intro: `No custom HTML is saved for ${seq.name} yet. Real sends will use the fallback built into its send function until custom HTML is saved here.`,
        proofTitle: 'Fallback behavior',
        proofBody: 'This generated seed gives the admin dashboard an editable starting point for the sequence.',
        ctaLabel: 'Open Pulse',
        ctaHref: 'https://fitwithpulse.ai',
      },
      subjectOverride,
      mode
    ),
    source: 'generic',
  };
};

const getPreviewSourceLabel = (source: TemplatePreviewSource) => {
  switch (source) {
    case 'firestore':
      return 'Saved HTML';
    case 'draft':
      return 'Unsaved draft';
    case 'default':
      return 'Function default';
    case 'generic':
      return 'Generic fallback';
    default:
      return 'No preview';
  }
};

const SEQUENCES: SequenceRow[] = [
  {
    id: 'welcome-v1',
    name: 'Welcome to Pulse',
    trigger: 'On registration (new user created)',
    defaultSubject: 'Welcome to Pulse — you’re in',
    functionPath: '/.netlify/functions/send-welcome-email',
    templateDocId: 'welcome-v1',
  },
  {
    id: 'username-reminder-v1',
    name: 'Forgot Username Reminder',
    trigger: 'User forgot to select username (registration incomplete after ~30 minutes)',
    defaultSubject: 'Finish setting up your Pulse account',
    functionPath: '/.netlify/functions/send-username-reminder-email',
    templateDocId: 'username-reminder-v1',
    scheduleConfigDocId: 'username-reminder-v1',
    scheduleDescription: 'Configurable daily UTC send window',
    defaultScheduleEnabled: true,
  },
  {
    id: 'new-follower-v1',
    name: 'New Follower Notification',
    trigger: 'When someone follows a user',
    defaultSubject: '{{followerName}} is now following you on Pulse',
    functionPath: '/.netlify/functions/send-new-follower-email',
    templateDocId: 'new-follower-v1',
  },
  {
    id: 'coach-connection-v1',
    name: 'Coach Connection Notification',
    trigger: 'When an athlete subscribes and connects with a coach',
    defaultSubject: '{{athleteName}} just connected with you on PulseCheck',
    functionPath: '/.netlify/functions/send-coach-connection-email',
    templateDocId: 'coach-connection-v1',
  },
  {
    id: 'pulsecheck-pilot-activation-v1',
    name: 'PulseCheck Pilot Activation',
    trigger: 'Manual from the PulseCheck pilot dashboard when an athlete is admitted and needs to reopen the app to finish consent',
    defaultSubject: '{{teamName}} access is ready in PulseCheck',
    functionPath: '/.netlify/functions/send-pulsecheck-pilot-activation-email',
    templateDocId: 'pulsecheck-pilot-activation-v1',
  },
  {
    id: 'winner-notification-v1',
    name: 'Winner Notification',
    trigger: 'When prize distribution is confirmed for challenge winners',
    defaultSubject: '🏆 You won ${{prizeAmount}} in {{challengeTitle}}!',
    functionPath: '/.netlify/functions/send-winner-notification-email',
    templateDocId: 'winner-notification-v1',
  },
  {
    id: 'approval-v1',
    name: 'Approval Notification',
    trigger: 'When a creator / coach application is approved',
    defaultSubject: "Congratulations, {{firstName}}! You're approved for Pulse Programming",
    functionPath: '/.netlify/functions/send-approval-email',
    templateDocId: 'approval-v1',
  },
  {
    id: 'joined-round-no-workout-v1',
    name: 'Joined Round, No First Workout',
    trigger: '24h after joining a Round with no completed workouts',
    defaultSubject: 'Your Round is waiting - start your first workout',
    functionPath: '/.netlify/functions/send-joined-round-no-workout-email',
    templateDocId: 'joined-round-no-workout-v1',
    scheduleConfigDocId: 'joined-round-no-workout-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends after the 24h no-workout delay',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'first-workout-celebration-v1',
    name: 'First Workout Completion Celebration',
    trigger: 'On first completed workout in a Round',
    defaultSubject: 'You completed your first workout - keep it rolling',
    functionPath: '/.netlify/functions/send-first-workout-celebration-email',
    templateDocId: 'first-workout-celebration-v1',
    scheduleConfigDocId: 'first-workout-celebration-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; detects recent first workout completions',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'streak-milestone-v1',
    name: 'Streak Milestones',
    trigger: 'When user reaches a 3, 7, 14, or 30-day streak',
    defaultSubject: '🔥 {{milestone}}-day streak - keep it alive',
    functionPath: '/.netlify/functions/send-streak-milestone-email',
    templateDocId: 'streak-milestone-v1',
    scheduleConfigDocId: 'streak-milestone-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends 3/7/14/30-day streak milestones',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'challenge-ending-soon-v1',
    name: 'Challenge Ending Soon',
    trigger: '72h and 24h before challenge end',
    defaultSubject: '{{hoursRemaining}}h left in {{challengeTitle}} - finish strong',
    functionPath: '/.netlify/functions/send-challenge-ending-soon-email',
    templateDocId: 'challenge-ending-soon-v1',
    scheduleConfigDocId: 'challenge-ending-soon-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends at roughly 72h and 24h remaining',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'irl-event-analytics-report-v1',
    name: 'IRL Event Analytics Report',
    trigger: '~1 hour after IRL event ends',
    defaultSubject: 'Your {{eventTitle}} analytics report',
    functionPath: '/.netlify/functions/send-irl-event-analytics-report-email',
    templateDocId: 'irl-event-analytics-report-v1',
    scheduleConfigDocId: 'irl-event-analytics-report-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends host report about 1 hour after an event ends',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'inactivity-winback-v1',
    name: 'Inactivity Winback',
    trigger: '3d, 7d, and 14d since last meaningful activity',
    defaultSubject: "Let's get you back in motion on Pulse",
    functionPath: '/.netlify/functions/send-inactivity-winback-email',
    templateDocId: 'inactivity-winback-v1',
    scheduleConfigDocId: 'inactivity-winback-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends at 3/7/14 days of inactivity',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'password-reset-v1',
    name: 'Password Reset',
    trigger: 'When user requests password reset',
    defaultSubject: 'Reset your Pulse password',
    functionPath: '/.netlify/functions/send-password-reset-email',
    templateDocId: 'password-reset-v1',
  },
  {
    id: 'error-alerts-v1',
    name: 'Error Alert Emails',
    trigger: 'On new Firestore error log creation (`errorLogs/{logId}`)',
    defaultSubject: '[Pulse Error Alert] {{source}} ({{username}})',
    functionPath: '',
    templateDocId: 'error-alerts-v1',
    deliveryRuntime: 'firebase',
    supportsTemplateEditing: false,
    supportsTestSend: false,
    openInAdminPath: '/admin/ErrorLogs',
    openInAdminLabel: 'Open error logs',
  },
  // ── Macra Nutrition ───────────────────────────────────
  {
    id: 'macra-welcome-v1',
    name: 'Macra Welcome',
    trigger: 'Fires once when a user finishes the Macra onboarding notification-preferences step (iOS) — plus an hourly server-side sweep that catches users whose client-side send never landed. Idempotent via users.macraWelcomeEmailSentAt.',
    defaultSubject: 'Welcome to Macra — your plan is ready',
    functionPath: '/.netlify/functions/send-macra-welcome-email',
    templateDocId: 'macra-welcome-v1',
    scheduleConfigDocId: 'macra-welcome-v1',
    scheduleDescription: 'Netlify cron: hourly safety-net sweep for missed client-side welcome sends',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'macra-tips-v1',
    name: 'Macra Tips Series',
    trigger: 'Scheduled function. Sends tip emails on day 2, day 4, and day 7 after Macra onboarding completion.',
    defaultSubject: 'Nora tip: {{tipTitle}}',
    functionPath: '/.netlify/functions/send-macra-tips-email',
    templateDocId: 'macra-tips-v1',
    scheduleConfigDocId: 'macra-tips-v1',
    scheduleDescription: 'Netlify cron: daily at 2:30 PM UTC',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'macra-inactivity-winback-v1',
    name: 'Macra Inactivity Winback',
    trigger: 'Scheduled function. Fires at 3, 7, and 14 days since last Macra food log.',
    defaultSubject: "You haven't logged in {{daysInactive}} days — Nora misses you",
    functionPath: '/.netlify/functions/send-macra-inactivity-email',
    templateDocId: 'macra-inactivity-winback-v1',
    scheduleConfigDocId: 'macra-inactivity-winback-v1',
    scheduleDescription: 'Netlify cron: daily at 3:00 PM UTC',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: MACRA_WEB_OFFER_SEQUENCE_ID,
    name: 'Macra Retargeting 1 - 24h Web Offer',
    trigger: 'Scheduled function. Sends once 24h after Macra onboarding when no active trial/subscription exists. Excludes missing-age and under-18 profiles. Checkout uses Stripe web, not StoreKit.',
    defaultSubject: 'Your Macra plan is ready, plus a free month',
    functionPath: '/.netlify/functions/send-macra-web-offer-email',
    templateDocId: 'macra-web-offer-24h-v1',
    scheduleConfigDocId: 'macra-web-offer-24h-v1',
    scheduleDescription: 'Netlify cron: hourly; sends only eligible users after the 24h delay',
    supportsScheduleTime: false,
    defaultScheduleEnabled: false,
    supportsCampaignConfig: true,
  },
  {
    id: 'macra-paywall-cancel-trust-v1',
    name: 'Macra Retargeting 2 - Paywall Cancel Trust',
    trigger: 'Shared scheduler. Sends after the paywall CTA was pressed and Apple purchase was cancelled or no trial started. Trust-focused message explaining Apple confirmation, visible renewal price, and no payment today.',
    defaultSubject: 'No payment today - Apple confirms the details first',
    functionPath: '/.netlify/functions/send-macra-paywall-cancel-trust-email',
    templateDocId: 'macra-paywall-cancel-trust-v1',
    scheduleConfigDocId: MACRA_RETARGETING_SEQUENCE_CONFIG_ID,
    scheduleDescription: 'Netlify cron: hourly shared scheduler for Macra retargeting rows 2-6; sends the next eligible email for each user.',
    supportsScheduleTime: false,
    defaultScheduleEnabled: false,
    supportsCampaignConfig: true,
  },
  {
    id: 'macra-web-offer-proof-v1',
    name: 'Macra Retargeting 3 - Offer Proof',
    trigger: 'Shared scheduler. Sends after the 24h web offer email is opened or clicked but no checkout starts. Proof-focused message using onboarding intent such as goal direction, biggest struggle, daily target, and meal plan count.',
    defaultSubject: 'Your Macra plan was built around your goal',
    functionPath: '/.netlify/functions/send-macra-web-offer-proof-email',
    templateDocId: 'macra-web-offer-proof-v1',
  },
  {
    id: 'macra-paywall-view-value-v1',
    name: 'Macra Retargeting 4 - Paywall View Value',
    trigger: 'Shared scheduler. Sends after multiple paywall views with no CTA tap and no trial. Value-objection recovery focused on one useful meal scan instead of another price push.',
    defaultSubject: 'Start with one useful scan today',
    functionPath: '/.netlify/functions/send-macra-paywall-view-value-email',
    templateDocId: 'macra-paywall-view-value-v1',
  },
  {
    id: 'macra-no-trial-7d-challenge-v1',
    name: 'Macra Retargeting 5 - 7d Meal Challenge',
    trigger: 'Shared scheduler. Sends 7 days after Macra onboarding when no trial/subscription exists and earlier retargeting did not convert. Softer one-real-meal challenge, no hard discount push.',
    defaultSubject: 'Try Macra with one real meal',
    functionPath: '/.netlify/functions/send-macra-no-trial-challenge-email',
    templateDocId: 'macra-no-trial-7d-challenge-v1',
  },
  {
    id: 'macra-trial-no-activation-24h-v1',
    name: 'Macra Retargeting 6 - Trial Activation',
    trigger: 'Shared scheduler. Sends 24h after trial start when no first Macra activation event exists, such as a meal scan, meal log, label scan, or Ask Nora message. Activation email focused on the first useful action.',
    defaultSubject: 'Your Macra trial is active - start with one meal',
    functionPath: '/.netlify/functions/send-macra-trial-activation-email',
    templateDocId: 'macra-trial-no-activation-24h-v1',
  },
];

const EmailSequencesAdmin: React.FC = () => {
  const dispatch = useDispatch();
  const currentUser = useUser();
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [seedingTemplates, setSeedingTemplates] = useState(false);

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [activeSequence, setActiveSequence] = useState<SequenceRow | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');
  const [testUserId, setTestUserId] = useState('');
  const [lastTestCheckoutUrl, setLastTestCheckoutUrl] = useState('');
  const [sending, setSending] = useState(false);

  // Template editing
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
  const [templateLoadedFromFirestore, setTemplateLoadedFromFirestore] = useState(false);
  const [templatePreviewSource, setTemplatePreviewSource] = useState<TemplatePreviewSource>('none');

  // Schedule config (daily send time)
  const [scheduleTimeById, setScheduleTimeById] = useState<Record<string, string>>({});
  const [scheduleEnabledById, setScheduleEnabledById] = useState<Record<string, boolean>>({});
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleEditingSequence, setScheduleEditingSequence] = useState<SequenceRow | null>(null);
  const [scheduleTimeDraft, setScheduleTimeDraft] = useState('14:00');
  const [scheduleEnabledDraft, setScheduleEnabledDraft] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingScheduleId, setSavingScheduleId] = useState<string | null>(null);
  const [campaignConfigById, setCampaignConfigById] = useState<Record<string, CampaignConfig>>({});
  const [delayHoursDraft, setDelayHoursDraft] = useState(String(DEFAULT_CAMPAIGN_CONFIG.delayHours));
  const [batchLimitDraft, setBatchLimitDraft] = useState(String(DEFAULT_CAMPAIGN_CONFIG.batchLimit));
  const [maxSendsPerRunDraft, setMaxSendsPerRunDraft] = useState(String(DEFAULT_CAMPAIGN_CONFIG.maxSendsPerRun));
  const [scanEveryHoursDraft, setScanEveryHoursDraft] = useState(String(DEFAULT_CAMPAIGN_CONFIG.scanEveryHours));
  const [sendWindowStartDraft, setSendWindowStartDraft] = useState(DEFAULT_CAMPAIGN_CONFIG.sendWindowStartLocal);
  const [sendWindowEndDraft, setSendWindowEndDraft] = useState(DEFAULT_CAMPAIGN_CONFIG.sendWindowEndLocal);

  const scheduleOptions = useMemo(() => {
    const out: string[] = [];
    for (let h = 0; h < 24; h++) {
      out.push(`${String(h).padStart(2, '0')}:00`);
      out.push(`${String(h).padStart(2, '0')}:30`);
    }
    return out;
  }, []);

  useEffect(() => {
    // Load schedule times for sequences that support scheduling (UTC time)
    const load = async () => {
      try {
        const updates: Record<string, string> = {};
        const enabledUpdates: Record<string, boolean> = {};
        const campaignConfigUpdates: Record<string, CampaignConfig> = {};
        for (const seq of SEQUENCES) {
          if (!seq.scheduleConfigDocId) continue;
          const ref = doc(db, 'email-sequence-config', seq.scheduleConfigDocId);
          const snap = await getDoc(ref);
          const data = snap.exists() ? ((snap.data() || {}) as any) : {};
          const time = (data?.sendTimeUtc as string) || '';
          updates[seq.id] = (time || '14:00').trim();
          enabledUpdates[seq.id] = snap.exists()
            ? seq.defaultScheduleEnabled === false
              ? data?.enabled === true
              : data?.enabled !== false
            : seq.defaultScheduleEnabled === true;
          if (hasCampaignControls(seq)) {
            campaignConfigUpdates[seq.id] = normalizeCampaignConfig(data);
          }
        }
        setScheduleTimeById(updates);
        setScheduleEnabledById(enabledUpdates);
        setCampaignConfigById(campaignConfigUpdates);
      } catch (_) {
        // Non-blocking; default values will display
      }
    };
    load();
  }, []);

  const defaultTemplatePreview = useMemo(
    () => (activeSequence ? buildDefaultEmailTemplate(activeSequence, templateSubject, 'preview') : EMPTY_TEMPLATE_PREVIEW),
    [activeSequence, templateSubject]
  );
  const hasTemplateHtml = Boolean(templateHtml.trim());
  const effectivePreviewSource: TemplatePreviewSource = hasTemplateHtml
    ? templatePreviewSource
    : defaultTemplatePreview.source;
  const previewSourceLabel = getPreviewSourceLabel(effectivePreviewSource);
  const previewSrcDoc = useMemo(() => {
    if (templateHtml.trim()) return templateHtml;
    return defaultTemplatePreview.html;
  }, [defaultTemplatePreview.html, templateHtml]);

  const openTestModal = (seq: SequenceRow) => {
    setActiveSequence(seq);
    setTestEmail('');
    setTestName('');
    setTestUserId('');
    setLastTestCheckoutUrl('');
    setIsTestModalOpen(true);
    setMessage(null);
  };

  const isScheduleEnabled = (seq: SequenceRow) =>
    scheduleEnabledById[seq.id] ?? (seq.defaultScheduleEnabled === true);

  const getCampaignConfig = (seq: SequenceRow): CampaignConfig =>
    campaignConfigById[seq.id] || DEFAULT_CAMPAIGN_CONFIG;

  const openScheduleModal = (seq: SequenceRow) => {
    setScheduleEditingSequence(seq);
    const existing = scheduleTimeById[seq.id] || '14:00';
    const campaignConfig = getCampaignConfig(seq);
    setScheduleTimeDraft(existing);
    setScheduleEnabledDraft(isScheduleEnabled(seq));
    setDelayHoursDraft(String(campaignConfig.delayHours));
    setBatchLimitDraft(String(campaignConfig.batchLimit));
    setMaxSendsPerRunDraft(String(campaignConfig.maxSendsPerRun));
    setScanEveryHoursDraft(String(campaignConfig.scanEveryHours));
    setSendWindowStartDraft(campaignConfig.sendWindowStartLocal);
    setSendWindowEndDraft(campaignConfig.sendWindowEndLocal);
    setIsScheduleModalOpen(true);
    setMessage(null);
  };

  const saveScheduleTime = async () => {
    if (!scheduleEditingSequence?.scheduleConfigDocId) return;
    const t = (scheduleTimeDraft || '').trim();
    if (scheduleEditingSequence.supportsScheduleTime !== false && !/^\d{2}:\d{2}$/.test(t)) {
      setMessage({ type: 'error', text: 'Invalid time format' });
      return;
    }

    let nextCampaignConfig: CampaignConfig | null = null;
    if (hasCampaignControls(scheduleEditingSequence)) {
      const delayHours = parseIntegerDraft(delayHoursDraft);
      const batchLimit = parseIntegerDraft(batchLimitDraft);
      const maxSendsPerRun = parseIntegerDraft(maxSendsPerRunDraft);
      const scanEveryHours = parseIntegerDraft(scanEveryHoursDraft);
      const sendWindowStartLocal = normalizeLocalTime(sendWindowStartDraft, '');
      const sendWindowEndLocal = normalizeLocalTime(sendWindowEndDraft, '');

      if (!delayHours || delayHours < 1 || delayHours > 168) {
        setMessage({
          type: 'error',
          text: scheduleEditingSequence.scheduleConfigDocId === MACRA_RETARGETING_SEQUENCE_CONFIG_ID
            ? 'Cooldown must be between 1 and 168 hours.'
            : 'Delay must be between 1 and 168 hours.',
        });
        return;
      }
      if (!batchLimit || batchLimit < 25 || batchLimit > 1000) {
        setMessage({ type: 'error', text: 'Batch limit must be between 25 and 1000 users.' });
        return;
      }
      if (!maxSendsPerRun || maxSendsPerRun < 1 || maxSendsPerRun > 500) {
        setMessage({ type: 'error', text: 'Max sends per run must be between 1 and 500.' });
        return;
      }
      if (maxSendsPerRun > batchLimit) {
        setMessage({ type: 'error', text: 'Max sends per run cannot be higher than the batch limit.' });
        return;
      }
      if (!scanEveryHours || scanEveryHours < 1 || scanEveryHours > 24) {
        setMessage({ type: 'error', text: 'Scan frequency must be between 1 and 24 hours.' });
        return;
      }
      if (!sendWindowStartLocal || !sendWindowEndLocal) {
        setMessage({ type: 'error', text: 'Send window times must use HH:MM format.' });
        return;
      }

      nextCampaignConfig = {
        delayHours,
        batchLimit,
        maxSendsPerRun,
        scanEveryHours,
        sendWindowStartLocal,
        sendWindowEndLocal,
        sendWindowTimezone: CAMPAIGN_SEND_WINDOW_TIMEZONE,
      };
    }

    setSavingSchedule(true);
    try {
      const ref = doc(db, 'email-sequence-config', scheduleEditingSequence.scheduleConfigDocId);
      await setDoc(
        ref,
        {
          id: scheduleEditingSequence.scheduleConfigDocId,
          ...(scheduleEditingSequence.supportsScheduleTime === false ? {} : { sendTimeUtc: t }),
          ...(nextCampaignConfig || {}),
          enabled: scheduleEnabledDraft,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setScheduleTimeById((prev) => ({ ...prev, [scheduleEditingSequence.id]: t || prev[scheduleEditingSequence.id] || '14:00' }));
      setScheduleEnabledById((prev) => ({ ...prev, [scheduleEditingSequence.id]: scheduleEnabledDraft }));
      if (nextCampaignConfig) {
        setCampaignConfigById((prev) => ({ ...prev, [scheduleEditingSequence.id]: nextCampaignConfig }));
      }
      setMessage({
        type: 'success',
        text: nextCampaignConfig
          ? `${scheduleEditingSequence.name} ${scheduleEnabledDraft ? 'enabled' : 'paused'} with ${nextCampaignConfig.maxSendsPerRun} max sends per run every ${nextCampaignConfig.scanEveryHours}h.`
          : `${scheduleEditingSequence.name} ${scheduleEnabledDraft ? 'enabled' : 'paused'}${scheduleEditingSequence.supportsScheduleTime === false ? '' : ` at ${t} UTC`}.`,
      });
      setIsScheduleModalOpen(false);
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to save scheduled time' });
    } finally {
      setSavingSchedule(false);
    }
  };

  const toggleScheduleEnabled = async (seq: SequenceRow) => {
    if (!seq.scheduleConfigDocId) return;
    const nextEnabled = !isScheduleEnabled(seq);
    setSavingScheduleId(seq.id);
    setMessage(null);
    try {
      const ref = doc(db, 'email-sequence-config', seq.scheduleConfigDocId);
      await setDoc(
        ref,
        {
          id: seq.scheduleConfigDocId,
          enabled: nextEnabled,
          ...(seq.supportsScheduleTime === false ? {} : { sendTimeUtc: scheduleTimeById[seq.id] || '14:00' }),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setScheduleEnabledById((prev) => ({ ...prev, [seq.id]: nextEnabled }));
      setMessage({ type: 'success', text: `${seq.name} ${nextEnabled ? 'enabled' : 'paused'}.` });
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to update automation status' });
    } finally {
      setSavingScheduleId(null);
    }
  };

  const scheduleConfigIsRetargeting = scheduleEditingSequence?.scheduleConfigDocId === MACRA_RETARGETING_SEQUENCE_CONFIG_ID;

  const loadTemplate = async (seq: SequenceRow) => {
    setLoadingTemplate(true);
    setTemplateLoadedFromFirestore(false);
    setTemplatePreviewSource('none');
    try {
      const ref = doc(db, 'email-templates', seq.templateDocId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        const loadedHtml = (data?.html as string) || '';
        setTemplateSubject((data?.subject as string) || seq.defaultSubject);
        setTemplateHtml(loadedHtml);
        setTemplateLoadedFromFirestore(Boolean(loadedHtml.trim()));
        setTemplatePreviewSource(loadedHtml.trim() ? 'firestore' : 'default');
      } else {
        // If not saved yet, start with defaults and let the function fallback render on send
        setTemplateSubject(seq.defaultSubject);
        setTemplateHtml('');
        setTemplatePreviewSource('default');
      }
    } catch (_e) {
      setTemplateSubject(seq.defaultSubject);
      setTemplateHtml('');
      setTemplatePreviewSource('default');
      setMessage({ type: 'error', text: 'Failed to load email template' });
    } finally {
      setLoadingTemplate(false);
    }
  };

  const seedMissingTemplates = async () => {
    setSeedingTemplates(true);
    setMessage(null);

    const seededBy = currentUser?.email || currentUser?.username || currentUser?.id || 'admin';
    let created = 0;
    let repaired = 0;
    let skipped = 0;
    let unsupported = 0;
    const seededTemplateIds: string[] = [];

    try {
      for (const seq of SEQUENCES) {
        if (seq.supportsTemplateEditing === false) {
          unsupported += 1;
          continue;
        }

        const ref = doc(db, 'email-templates', seq.templateDocId);
        const snap = await getDoc(ref);
        const data = snap.exists() ? ((snap.data() || {}) as any) : {};
        const existingSubject = typeof data?.subject === 'string' ? data.subject.trim() : '';
        const existingHtml = typeof data?.html === 'string' ? data.html.trim() : '';

        if (existingSubject && existingHtml) {
          skipped += 1;
          continue;
        }

        const seedTemplate = buildDefaultEmailTemplate(seq, existingSubject || undefined, 'seed');
        const nextSubject = existingSubject || seedTemplate.subject;
        const nextHtml = existingHtml || seedTemplate.html;
        await setDoc(
          ref,
          {
            id: seq.templateDocId,
            sequenceId: seq.id,
            subject: nextSubject,
            html: nextHtml,
            seededFrom: 'email-sequences-admin',
            seededFromSource: seedTemplate.source,
            seededBy,
            seededAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
          },
          { merge: true }
        );

        seededTemplateIds.push(seq.templateDocId);
        if (snap.exists()) {
          repaired += 1;
        } else {
          created += 1;
        }
      }

      const repairedText = repaired ? ` Repaired ${repaired} empty template${repaired === 1 ? '' : 's'}.` : '';
      const unsupportedText = unsupported ? ` Skipped ${unsupported} non-editable sequence${unsupported === 1 ? '' : 's'}.` : '';
      setMessage({
        type: 'success',
        text: `Seeded ${created} missing template${created === 1 ? '' : 's'}.${repairedText} ${skipped} already had saved HTML.${unsupportedText}`,
      });

      if (activeSequence && seededTemplateIds.includes(activeSequence.templateDocId)) {
        await loadTemplate(activeSequence);
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to seed email templates' });
    } finally {
      setSeedingTemplates(false);
    }
  };

  const openEditModal = async (seq: SequenceRow) => {
    setActiveSequence(seq);
    setIsEditModalOpen(true);
    setMessage(null);
    await loadTemplate(seq);
  };

  const saveTemplate = async () => {
    if (!activeSequence) return;
    if (!templateSubject.trim()) {
      setMessage({ type: 'error', text: 'Subject is required' });
      return;
    }
    if (!templateHtml.trim()) {
      setMessage({ type: 'error', text: 'HTML is required (paste your full HTML email)' });
      return;
    }

    setSavingTemplate(true);
    try {
      const ref = doc(db, 'email-templates', activeSequence.templateDocId);
      await setDoc(
        ref,
        {
          id: activeSequence.templateDocId,
          subject: templateSubject.trim(),
          html: templateHtml,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setTemplateLoadedFromFirestore(true);
      setTemplatePreviewSource('firestore');
      setMessage({ type: 'success', text: 'Template saved.' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to save template' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const copyHtmlToClipboard = async () => {
    try {
      const text = templateHtml || '';
      if (!text.trim()) {
        setMessage({ type: 'error', text: 'No HTML to copy' });
        return;
      }
      await navigator.clipboard.writeText(text);
      setMessage({ type: 'success', text: 'HTML copied to clipboard.' });
    } catch (_e) {
      // Fallback for older browsers / denied permissions
      try {
        const el = document.createElement('textarea');
        el.value = templateHtml || '';
        el.setAttribute('readonly', 'true');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setMessage({ type: 'success', text: 'HTML copied to clipboard.' });
      } catch {
        setMessage({ type: 'error', text: 'Failed to copy HTML to clipboard' });
      }
    }
  };

  const sendTest = async () => {
    if (!activeSequence) return;
    if (!testEmail.trim()) {
      setMessage({ type: 'error', text: 'Please enter a test email address' });
      return;
    }
    if (activeSequence.id === 'macra-web-offer-24h-v1' && !testUserId.trim()) {
      setMessage({ type: 'error', text: 'Macra web offer tests need a real user ID so the CTA can apply checkout to the correct account.' });
      return;
    }

    setSending(true);
    setMessage(null);
    setLastTestCheckoutUrl('');
    try {
      const resp = await fetch(activeSequence.functionPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: testEmail.trim(),
          firstName: testName.trim() || undefined,
          userId: testUserId.trim() || undefined,
          subjectOverride: templateSubject.trim() || undefined,
          htmlOverride: templateHtml.trim() || undefined,
          isTest: true,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.error || `Failed to send test email (HTTP ${resp.status})`);
      }
      const successMessage = 'Test email sent successfully.';
      setLastTestCheckoutUrl(typeof json?.checkoutUrl === 'string' ? json.checkoutUrl : '');
      setMessage({ type: 'success', text: successMessage });
      dispatch(showToast({ message: successMessage, type: 'success' }));
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to send test email';
      setMessage({ type: 'error', text: errorMessage });
      dispatch(showToast({ message: errorMessage, type: 'error', duration: 5000 }));
    } finally {
      setSending(false);
    }
  };

  const copyLastTestCheckoutUrl = async () => {
    if (!lastTestCheckoutUrl) return;
    await navigator.clipboard.writeText(lastTestCheckoutUrl);
    setMessage({ type: 'success', text: 'Generated offer link copied to clipboard.' });
  };

  const activeTestRequiresUserId = activeSequence?.id === 'macra-web-offer-24h-v1';

  return (
    <AdminRouteGuard>
      <Head>
        <title>Email Sequences | Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Mail className="w-7 h-7 text-[#d7ff00]" />
                Email Sequences
              </h1>
              <p className="text-zinc-400 mt-1">See what emails get sent when, and send test emails.</p>
            </div>
            <button
              type="button"
              onClick={seedMissingTemplates}
              disabled={seedingTemplates}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${seedingTemplates
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                }`}
              title="Create Firestore templates for editable sequences that do not have saved HTML yet"
            >
              {seedingTemplates ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
              Seed missing templates
            </button>
          </div>

          {message && (
            <div
              className={`mb-6 p-4 rounded-xl border ${message.type === 'success'
                ? 'bg-green-900/20 border-green-800 text-green-400'
                : message.type === 'error'
                  ? 'bg-red-900/20 border-red-800 text-red-400'
                  : 'bg-blue-900/20 border-blue-800 text-blue-400'
                }`}
            >
              <div className="flex items-center gap-2">
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                {message.text}
              </div>
            </div>
          )}

          <div className="bg-[#1a1e24] rounded-xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold">Sequence List</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/70">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Trigger</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Subject</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {SEQUENCES.map((seq) => {
                    const scheduleEnabled = isScheduleEnabled(seq);
                    const campaignConfig = getCampaignConfig(seq);
                    const showCampaignControls = hasCampaignControls(seq);
                    return (
                    <tr key={seq.id} className="hover:bg-zinc-900/30">
                      <td className="px-4 py-3 text-zinc-200 font-medium">{seq.name}</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {seq.trigger}
                        <div className="text-xs text-zinc-500 mt-1">
                          Runtime: {seq.deliveryRuntime === 'firebase' ? 'Firebase Functions' : 'Netlify Functions'}
                        </div>
                        {seq.scheduleConfigDocId ? (
                          <div className="mt-2 space-y-1">
                            <div
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${scheduleEnabled
                                ? 'bg-green-900/20 border-green-700/70 text-green-300'
                                : 'bg-amber-900/20 border-amber-700/70 text-amber-300'
                                }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${scheduleEnabled ? 'bg-green-300' : 'bg-amber-300'}`} />
                              {scheduleEnabled ? 'Enabled' : 'Paused'}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {seq.scheduleDescription || 'Scheduled automation'}
                            </div>
                            {showCampaignControls ? (
                              <>
                                <div className="text-xs text-zinc-500">
                                  Delay: {campaignConfig.delayHours}h · Batch: {campaignConfig.batchLimit} · Max sends/run: {campaignConfig.maxSendsPerRun}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  Scan every {campaignConfig.scanEveryHours}h · Window: {campaignConfig.sendWindowStartLocal}-{campaignConfig.sendWindowEndLocal} Eastern
                                </div>
                              </>
                            ) : null}
                            {seq.supportsScheduleTime !== false ? (
                              <div className="text-xs text-zinc-500">
                                Send time: {(scheduleTimeById[seq.id] || '14:00').trim()} UTC
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{seq.defaultSubject}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {seq.openInAdminPath ? (
                            <a
                              href={seq.openInAdminPath}
                              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                              title={seq.openInAdminLabel || 'Open in admin'}
                            >
                              <Eye className="w-4 h-4" />
                              {seq.openInAdminLabel || 'Open'}
                            </a>
                          ) : null}
                          {seq.scheduleConfigDocId ? (
                            <>
                              <button
                                onClick={() => toggleScheduleEnabled(seq)}
                                disabled={savingScheduleId === seq.id}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${scheduleEnabled
                                  ? 'bg-amber-900/30 hover:bg-amber-900/50 text-amber-200 border border-amber-800/60'
                                  : 'bg-green-900/30 hover:bg-green-900/50 text-green-200 border border-green-800/60'
                                  }`}
                                title={scheduleEnabled ? 'Pause this automation' : 'Enable this automation'}
                              >
                                {savingScheduleId === seq.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {scheduleEnabled ? 'Pause' : 'Enable'}
                              </button>
                              <button
                                onClick={() => openScheduleModal(seq)}
                                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                                title="Edit automation settings"
                              >
                                <Clock className="w-4 h-4" />
                                {showCampaignControls ? 'Configure' : 'Settings'}
                              </button>
                            </>
                          ) : null}
                          {seq.supportsTemplateEditing !== false ? (
                            <button
                              onClick={() => openEditModal(seq)}
                              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                              View / edit
                            </button>
                          ) : null}
                          {seq.supportsTestSend !== false ? (
                            <button
                              onClick={() => openTestModal(seq)}
                              className="flex items-center gap-2 px-3 py-2 bg-[#d7ff00] text-black hover:bg-[#c5eb00] rounded-lg text-sm font-medium transition-colors"
                            >
                              <Send className="w-4 h-4" />
                              Send test
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isTestModalOpen && activeSequence && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white">Send test email</h2>
                <p className="text-sm text-zinc-400 mt-1">{activeSequence.name}</p>
              </div>
              <button
                onClick={() => setIsTestModalOpen(false)}
                disabled={sending}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Test email address</label>
                <input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors"
                  disabled={sending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Name (optional)</label>
                <input
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="Tremaine"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors"
                  disabled={sending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  User ID {activeTestRequiresUserId ? '(required for this sequence)' : '(optional)'}
                </label>
                <input
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  placeholder="Paste a real user ID for signed offer links"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors"
                  disabled={sending}
                />
                <p className="text-xs text-zinc-500 mt-2">
                  Macra offer CTAs need this so the signed checkout bridge can apply the offer to the correct account.
                </p>
                {lastTestCheckoutUrl ? (
                  <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-900/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-zinc-400 truncate">{lastTestCheckoutUrl}</p>
                      <button
                        type="button"
                        onClick={copyLastTestCheckoutUrl}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => setIsTestModalOpen(false)}
                disabled={sending}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendTest}
                disabled={sending || !testEmail.trim() || (activeTestRequiresUserId && !testUserId.trim())}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${sending || !testEmail.trim() || (activeTestRequiresUserId && !testUserId.trim())
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-[#d7ff00] text-black hover:bg-[#c5eb00]'
                  }`}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send test
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isScheduleModalOpen && scheduleEditingSequence && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-zinc-300" />
                  {hasCampaignControls(scheduleEditingSequence) ? 'Configure campaign' : 'Automation settings'}
                </h2>
                <p className="text-sm text-zinc-400 mt-1">{scheduleEditingSequence.name}</p>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                disabled={savingSchedule}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(90vh-180px)] overflow-y-auto">
              <label className="flex items-center justify-between gap-4 rounded-xl border border-zinc-700 bg-zinc-900/70 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-white">Automation enabled</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Disabled automations exit before scanning users or sending email.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={scheduleEnabledDraft}
                  onChange={(e) => setScheduleEnabledDraft(e.target.checked)}
                  disabled={savingSchedule}
                  className="h-5 w-5 accent-[#d7ff00]"
                />
              </label>

              {scheduleEditingSequence.scheduleDescription ? (
                <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Schedule</div>
                  <div className="text-sm text-zinc-300">{scheduleEditingSequence.scheduleDescription}</div>
                </div>
              ) : null}

              {hasCampaignControls(scheduleEditingSequence) ? (
                <div className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-4">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="text-sm font-semibold text-white">Campaign launch controls</div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Use a small max-send cap for canaries, then increase it after the first run looks clean.
                      </div>
                    </div>
                    <span className="rounded-full border border-[#d7ff00]/30 bg-[#d7ff00]/10 px-2.5 py-1 text-[11px] font-bold text-[#d7ff00]">
                      Canary-safe
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">
                        {scheduleConfigIsRetargeting ? 'Cooldown between emails' : 'Delay after onboarding'}
                      </label>
                      <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 focus-within:border-[#d7ff00]">
                        <input
                          type="number"
                          min={1}
                          max={168}
                          step={1}
                          value={delayHoursDraft}
                          onChange={(e) => setDelayHoursDraft(e.target.value)}
                          disabled={savingSchedule}
                          className="w-full bg-transparent px-3 py-3 text-white outline-none"
                        />
                        <span className="pr-3 text-xs text-zinc-500">hours</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Users scanned/run</label>
                      <input
                        type="number"
                        min={25}
                        max={1000}
                        step={1}
                        value={batchLimitDraft}
                        onChange={(e) => setBatchLimitDraft(e.target.value)}
                        disabled={savingSchedule}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-[#d7ff00]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Max sends/run</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        step={1}
                        value={maxSendsPerRunDraft}
                        onChange={(e) => setMaxSendsPerRunDraft(e.target.value)}
                        disabled={savingSchedule}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-[#d7ff00]"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Scan frequency</label>
                      <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 focus-within:border-[#d7ff00]">
                        <input
                          type="number"
                          min={1}
                          max={24}
                          step={1}
                          value={scanEveryHoursDraft}
                          onChange={(e) => setScanEveryHoursDraft(e.target.value)}
                          disabled={savingSchedule}
                          className="w-full bg-transparent px-3 py-3 text-white outline-none"
                        />
                        <span className="pr-3 text-xs text-zinc-500">hours</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Window starts</label>
                      <select
                        value={sendWindowStartDraft}
                        onChange={(e) => setSendWindowStartDraft(e.target.value)}
                        disabled={savingSchedule}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-[#d7ff00]"
                      >
                        {scheduleOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Window ends</label>
                      <select
                        value={sendWindowEndDraft}
                        onChange={(e) => setSendWindowEndDraft(e.target.value)}
                        disabled={savingSchedule}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-[#d7ff00]"
                      >
                        {scheduleOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    Send windows use Eastern time. If the start time is later than the end time, the window wraps overnight.
                  </p>

                  <div className="mt-3 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
                    {scheduleConfigIsRetargeting
                      ? 'Recommended first launch: 24h cooldown, scan 50 users, max 5 sends per run, scan every 3h during your preferred Eastern-time window.'
                      : 'Recommended first launch: delay 24h, scan 50 users, max 5 sends per run, scan every 3h during your preferred Eastern-time window.'}
                  </div>
                </div>
              ) : null}

              {scheduleEditingSequence.supportsScheduleTime !== false ? (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Daily send time (UTC)</label>
                  <select
                    value={scheduleTimeDraft}
                    onChange={(e) => setScheduleTimeDraft(e.target.value)}
                    disabled={savingSchedule}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-[#d7ff00] transition-colors"
                  >
                    {scheduleOptions.map((t) => (
                      <option key={t} value={t}>
                        {t} UTC
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-zinc-500 mt-2">
                    Note: times are in 30-minute increments.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  This automation runs on the Netlify cron schedule shown above; this admin switch controls whether it is allowed to send.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                disabled={savingSchedule}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveScheduleTime}
                disabled={savingSchedule}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${savingSchedule ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' : 'bg-[#d7ff00] text-black hover:bg-[#c5eb00]'
                  }`}
              >
                {savingSchedule ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save automation'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && activeSequence && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-zinc-300" />
                  Edit email template
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  {activeSequence.name}
                  {templateLoadedFromFirestore ? ' • Saved template' : ' • Not saved yet (using default on send)'}
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                disabled={savingTemplate || loadingTemplate}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Modal message banner (so Save feedback is visible even with the overlay) */}
            {message && (
              <div className="px-6 pt-6">
                <div
                  className={`p-4 rounded-xl border ${message.type === 'success'
                    ? 'bg-green-900/20 border-green-800 text-green-400'
                    : message.type === 'error'
                      ? 'bg-red-900/20 border-red-800 text-red-400'
                      : 'bg-blue-900/20 border-blue-800 text-blue-400'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    {message.type === 'success' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                    {message.text}
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {loadingTemplate ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-10 h-10 animate-spin text-[#d7ff00]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Subject</label>
                      <input
                        value={templateSubject}
                        onChange={(e) => setTemplateSubject(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-zinc-400">HTML</label>
                        <button
                          type="button"
                          onClick={copyHtmlToClipboard}
                          disabled={!templateHtml.trim()}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200"
                          title="Copy HTML to clipboard"
                        >
                          <Copy className="w-4 h-4" />
                          Copy HTML
                        </button>
                      </div>
                      <textarea
                        value={templateHtml}
                        onChange={(e) => {
                          const nextHtml = e.target.value;
                          setTemplateHtml(nextHtml);
                          setTemplatePreviewSource(nextHtml.trim() ? 'draft' : 'default');
                        }}
                        placeholder="Paste the full HTML email here (<!doctype html> ...)"
                        className="w-full h-[520px] px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors resize-none font-mono text-xs"
                      />
                      <p className="text-xs text-zinc-500 mt-2">
                        This HTML is what gets sent to users when saved. Leave it empty to keep using the send-function default.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          Preview
                        </h3>
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${hasTemplateHtml
                          ? 'bg-blue-900/20 border-blue-700/60 text-blue-200'
                          : 'bg-[#d7ff00]/10 border-[#d7ff00]/30 text-[#d7ff00]'
                          }`}>
                          {previewSourceLabel}
                        </span>
                      </div>
                      <a
                        className="shrink-0 text-xs text-zinc-400 underline"
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          const w = window.open('', '_blank');
                          if (w) {
                            w.document.open();
                            w.document.write(previewSrcDoc || '<p>No preview available</p>');
                            w.document.close();
                          }
                        }}
                      >
                        Open in new tab
                      </a>
                    </div>
                    {!hasTemplateHtml ? (
                      <p className="text-xs text-zinc-500">
                        Previewing the default fallback. Paste custom HTML to override it.
                      </p>
                    ) : null}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                      <iframe
                        title="Email preview"
                        srcDoc={previewSrcDoc || '<p style=\"color:#999;font-family:Arial\">No preview available</p>'}
                        style={{ width: '100%', height: 640, border: 'none', background: '#0a0a0b' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => setIsEditModalOpen(false)}
                disabled={savingTemplate || loadingTemplate}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
              <button
                onClick={saveTemplate}
                disabled={savingTemplate || loadingTemplate || !templateSubject.trim() || !templateHtml.trim()}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${savingTemplate || loadingTemplate || !templateSubject.trim() || !templateHtml.trim()
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-[#d7ff00] text-black hover:bg-[#c5eb00]'
                  }`}
              >
                {savingTemplate ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save template'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default EmailSequencesAdmin;
