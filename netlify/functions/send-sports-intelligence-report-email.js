const { admin, getFirebaseAdminApp, headers, initializeFirebaseAdmin } = require('./config/firebase');
const { buildEmailDedupeKey, sendBrevoTransactionalEmail } = require('./utils/sendBrevoTransactionalEmail');

const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const SPORT_CONFIG_COLLECTION = 'company-config';
const SPORT_CONFIG_DOCUMENT = 'pulsecheck-sports';
const REPORTS_ROOT_COLLECTION = 'teams';
const REPORTS_SUBCOLLECTION = 'coachReports';
const ALLOWED_RECIPIENT_ROLES = ['team-admin', 'coach', 'performance-staff'];

const RESPONSE_HEADERS = {
  ...headers,
  'Content-Type': 'application/json',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-PulseCheck-Firebase-Mode, X-Force-Dev-Firebase, X-PulseCheck-Dev-Firebase',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UNIVERSAL_COACH_LANGUAGE_BANLIST = [
  'ACWR',
  'acwr',
  'load_au',
  'high_confidence',
  'degraded',
  'clinical threshold',
  'directional',
  'stable confidence',
  'emerging confidence',
  'simEvidenceCount',
  'confidenceTier',
  'rmssdMs',
  'externalLoadAU',
];

function json(statusCode, body) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(body),
  };
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function escapeHtml(value) {
  return normalizeString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeBaseUrl(value) {
  const normalized = normalizeString(value) || 'https://fitwithpulse.ai';
  return normalized.replace(/\/+$/, '');
}

function getBaseSiteUrl() {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || process.env.CUSTOM_BASE_URL);
}

function buildReportUrl(teamId, reportId) {
  return `${getBaseSiteUrl()}/coach-reports/${encodeURIComponent(teamId)}/${encodeURIComponent(reportId)}`;
}

function formatWeekLabel(report) {
  const surface = report.coachSurface || {};
  const meta = surface.meta || {};
  const explicit = normalizeString(meta.weekLabel || report.weekLabel);
  if (explicit) return explicit;

  const weekStart = normalizeString(meta.weekStart || report.weekStart);
  if (!weekStart) return 'this week';
  const parsed = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return `Week of ${weekStart}`;
  return `Week of ${parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function resolveSportName(report) {
  const surface = report.coachSurface || {};
  const meta = surface.meta || {};
  return normalizeString(meta.sportName || report.sportName || report.sportId || 'Sports Intelligence');
}

function resolveTeamName(report) {
  const surface = report.coachSurface || {};
  const meta = surface.meta || {};
  return normalizeString(meta.teamName || report.teamName || 'your team');
}

function buildSubject(report) {
  return `${resolveSportName(report)} \u00B7 ${formatWeekLabel(report)} \u2014 your Sports Intelligence read`;
}

function buildCoachTopLine(coachSurface) {
  const topLine = coachSurface?.topLine || {};
  const whatChanged = normalizeString(topLine.whatChanged);
  const who = normalizeString(topLine.who);
  const firstAction = normalizeString(topLine.firstAction);
  const secondaryThread = normalizeString(topLine.secondaryThread);

  const pieces = [];
  if (whatChanged) pieces.push(whatChanged.replace(/\.$/, ''));
  if (who) pieces.push(`This centers on ${who.replace(/\.$/, '')}`);
  if (firstAction) pieces.push(`First move: ${firstAction.replace(/\.$/, '')}`);
  if (secondaryThread) pieces.push(secondaryThread.replace(/\.$/, ''));
  return pieces.join('. ') || 'The Pulse team has your Sports Intelligence read ready for review.';
}

function buildEmailCopy(report, reportUrl) {
  const coachSurface = report.coachSurface || {};
  const teamName = resolveTeamName(report);
  const sportName = resolveSportName(report);
  const weekLabel = formatWeekLabel(report);
  const topLine = buildCoachTopLine(coachSurface);
  const closer = normalizeString(coachSurface.closer)
    || 'Use the report as the starting point for this week\'s walkthrough. The Pulse team has already held back anything that was not ready for coach action.';

  return {
    subject: buildSubject(report),
    intro: `${teamName}'s ${sportName} read for ${weekLabel} is ready.`,
    topLine,
    ctaLabel: 'Open the report',
    ctaUrl: reportUrl,
    closer,
  };
}

function renderEmailHtml(copy) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#080a12;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#080a12;padding:28px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;background:#111827;border:1px solid #263244;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:28px;font-family:Arial,sans-serif;color:#f8fafc;">
                <div style="display:inline-block;border:1px solid rgba(147,197,253,0.35);background:rgba(59,130,246,0.14);color:#bfdbfe;border-radius:999px;padding:7px 11px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">
                  Pulse Sports Intelligence
                </div>
                <h1 style="margin:18px 0 10px 0;font-size:28px;line-height:1.18;color:#ffffff;">${escapeHtml(copy.intro)}</h1>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.75;color:#d4d4d8;">
                  ${escapeHtml(copy.topLine)}
                </p>
                <p style="margin:22px 0 12px 0;">
                  <a href="${escapeHtml(copy.ctaUrl)}" style="display:inline-block;background:#e0fe10;color:#0b0f16;text-decoration:none;padding:13px 18px;border-radius:12px;font-weight:800;">
                    ${escapeHtml(copy.ctaLabel)}
                  </a>
                </p>
                <p style="margin:18px 0 0 0;font-size:13px;line-height:1.7;color:#a1a1aa;">
                  ${escapeHtml(copy.closer)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function collectCoachFacingStrings(value, path = '$') {
  if (typeof value === 'string') {
    return value.trim() ? [{ path, text: value }] : [];
  }
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectCoachFacingStrings(entry, `${path}[${index}]`));
  }

  const root = value.coachSurface && typeof value.coachSurface === 'object' ? value.coachSurface : value;
  return Object.entries(root).flatMap(([key, entry]) => {
    if (key === 'reviewerOnly') return [];
    return collectCoachFacingStrings(entry, `${path}.${key}`);
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expandBannedPhraseVariants(phrase) {
  const normalized = normalizeString(phrase);
  if (!normalized) return [];
  const variants = new Set([normalized]);
  if (normalized.includes('_')) variants.add(normalized.replace(/_/g, ' '));
  if (/^generic\s+/i.test(normalized)) variants.add(normalized.replace(/^generic\s+/i, ''));
  return Array.from(variants);
}

function findBannedPhrase(text, phrase) {
  for (const variant of expandBannedPhraseVariants(phrase)) {
    const escaped = escapeRegExp(variant).replace(/\s+/g, '\\s+');
    const startsWithWord = /^[a-z0-9_]/i.test(variant);
    const endsWithWord = /[a-z0-9_]$/i.test(variant);
    const pattern = `${startsWithWord ? '(^|[^a-z0-9_])' : ''}(${escaped})${endsWithWord ? '(?![a-z0-9_])' : ''}`;
    const match = new RegExp(pattern, 'i').exec(text);
    if (match && typeof match.index === 'number') {
      const boundaryOffset = startsWithWord && match[1] ? match[1].length : 0;
      return {
        matchedText: match[2] || match[0],
        matchedAt: match.index + boundaryOffset,
      };
    }
  }
  return null;
}

function enforceLocalLanguagePosture(coachFacingContent, sportPolicy) {
  const strings = collectCoachFacingStrings(coachFacingContent);
  const phrases = [
    ...UNIVERSAL_COACH_LANGUAGE_BANLIST.map((phrase) => ({ phrase, source: 'universal' })),
    ...((sportPolicy?.languagePosture?.mustAvoid || []).map((phrase) => ({ phrase, source: 'sport' }))),
    ...((sportPolicy?.prompting?.restrictedAdvice || []).map((phrase) => ({ phrase, source: 'sport' }))),
  ];

  const seen = new Set();
  const violations = [];
  for (const entry of phrases) {
    const phrase = normalizeString(entry.phrase);
    if (!phrase) continue;
    const key = `${entry.source}:${phrase.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    for (const candidate of strings) {
      const match = findBannedPhrase(candidate.text, phrase);
      if (!match) continue;
      violations.push({
        phrase,
        source: entry.source,
        path: candidate.path,
        matchedText: match.matchedText,
        matchedAt: match.matchedAt,
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

async function getReportDoc(db, teamId, reportId) {
  const reportRef = db
    .collection(REPORTS_ROOT_COLLECTION)
    .doc(teamId)
    .collection(REPORTS_SUBCOLLECTION)
    .doc(reportId);
  const snap = await reportRef.get();
  if (!snap.exists) return { reportRef, report: null };
  return {
    reportRef,
    report: {
      id: snap.id || reportId,
      ...(snap.data() || {}),
    },
  };
}

async function getSportPolicy(db, sportId) {
  if (!sportId) return null;
  const configSnap = await db.collection(SPORT_CONFIG_COLLECTION).doc(SPORT_CONFIG_DOCUMENT).get();
  const sports = configSnap.exists && Array.isArray(configSnap.data()?.sports) ? configSnap.data().sports : [];
  return sports.find((sport) => normalizeString(sport.id) === sportId)?.reportPolicy || null;
}

async function resolveUserEmail(db, userId) {
  const normalizedUserId = normalizeString(userId);
  if (!normalizedUserId) return '';
  const userSnap = await db.collection('users').doc(normalizedUserId).get();
  if (!userSnap.exists) return '';
  return normalizeEmail(userSnap.data()?.email);
}

async function listRecipients(db, teamId) {
  const snapshot = await db
    .collection(TEAM_MEMBERSHIPS_COLLECTION)
    .where('teamId', '==', teamId)
    .where('status', '==', 'active')
    .where('role', 'in', ALLOWED_RECIPIENT_ROLES)
    .get();

  const byEmail = new Map();
  for (const docSnap of snapshot.docs || []) {
    const data = docSnap.data() || {};
    const email = normalizeEmail(data.email) || (await resolveUserEmail(db, data.userId));
    if (!email || byEmail.has(email)) continue;
    byEmail.set(email, {
      email,
      userId: normalizeString(data.userId),
      role: normalizeString(data.role),
      membershipId: docSnap.id,
      name: normalizeString(data.displayName || data.name || data.title) || email,
    });
  }
  return Array.from(byEmail.values());
}

function buildRecipientAudit(recipient, sendResult) {
  return {
    email: recipient.email,
    userId: recipient.userId || null,
    role: recipient.role || null,
    membershipId: recipient.membershipId || null,
    messageId: sendResult.messageId || null,
    skipped: Boolean(sendResult.skipped),
    sentAt: new Date().toISOString(),
  };
}

async function markReportFailure(reportRef, error, auditResult) {
  await reportRef.set(
    {
      deliveryStatus: 'failed',
      lastEmailError: normalizeString(error) || 'Sports Intelligence report email failed.',
      ...(auditResult
        ? {
            reviewerOnly: {
              auditTrace: {
                localizationAuditResult: auditResult,
              },
            },
          }
        : {}),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function markReportSent(reportRef, sentTo) {
  await reportRef.set(
    {
      reviewStatus: 'sent',
      deliveryStatus: 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      sentTo,
      coachSurface: {
        meta: {
          reviewStatus: 'sent',
        },
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      emailDelivery: {
        sentCount: sentTo.filter((entry) => !entry.skipped).length,
        skippedCount: sentTo.filter((entry) => entry.skipped).length,
        lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  );
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed' });
  }

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
    const db = admin.firestore(adminApp);
    const body = JSON.parse(event.body || '{}');
    const teamId = normalizeString(body.teamId);
    const reportId = normalizeString(body.reportId);

    if (!teamId || !reportId) {
      return json(400, { success: false, error: 'teamId and reportId are required.' });
    }

    const { reportRef, report } = await getReportDoc(db, teamId, reportId);
    if (!report) {
      return json(404, { success: false, error: 'Sports Intelligence report was not found.' });
    }

    const reportTeamId = normalizeString(report.teamId || report.coachSurface?.meta?.teamId);
    if (reportTeamId && reportTeamId !== teamId) {
      return json(403, { success: false, error: 'Report teamId does not match requested teamId.' });
    }

    const reviewStatus = normalizeString(report.reviewStatus || report.coachSurface?.meta?.reviewStatus).toLowerCase();
    if (!['published', 'sent'].includes(reviewStatus)) {
      return json(409, { success: false, error: 'Report must be published before email delivery.' });
    }

    if (!report.coachSurface || typeof report.coachSurface !== 'object') {
      await markReportFailure(reportRef, 'Missing coach-surface report data.');
      return json(400, { success: false, error: 'Report is missing coach-surface data.' });
    }

    const sportId = normalizeString(report.sportId || report.coachSurface?.meta?.sportId);
    const sportPolicy = await getSportPolicy(db, sportId);
    const reportUrl = buildReportUrl(teamId, reportId);
    const copy = buildEmailCopy(report, reportUrl);
    const auditResult = enforceLocalLanguagePosture(
      {
        coachSurface: report.coachSurface,
        emailCopy: copy,
      },
      sportPolicy
    );

    if (!auditResult.passed) {
      await markReportFailure(reportRef, 'Language posture audit failed before email send.', auditResult);
      return json(422, {
        success: false,
        error: 'Language posture audit failed before email send.',
        auditResult,
      });
    }

    const recipients = await listRecipients(db, teamId);
    if (recipients.length === 0) {
      await markReportFailure(reportRef, 'No active coach or staff recipients were found for this team.', auditResult);
      return json(404, {
        success: false,
        error: 'No active coach or staff recipients were found for this team.',
      });
    }

    const baseIdempotencyKey = buildEmailDedupeKey(['si-report-v1', teamId, reportId]);
    const htmlContent = renderEmailHtml(copy);
    const sentTo = [];
    const failed = [];

    for (const recipient of recipients) {
      const recipientIdempotencyKey = buildEmailDedupeKey(['si-report-v1', teamId, reportId, recipient.email]);
      const sendResult = await sendBrevoTransactionalEmail({
        toEmail: recipient.email,
        toName: recipient.name,
        subject: copy.subject,
        htmlContent,
        tags: ['sports-intelligence', 'coach-report', sportId],
        sender: {
          email: process.env.BREVO_SENDER_EMAIL || 'no-reply@fitwithpulse.ai',
          name: process.env.BREVO_SENDER_NAME || 'Pulse Sports Intelligence',
        },
        headers: {
          'X-Email-Type': 'sports-intelligence-report',
          'X-Mailin-custom': JSON.stringify({
            sequence: 'si-report-v1',
            teamId,
            reportId,
            sportId,
            baseIdempotencyKey,
          }),
        },
        idempotencyKey: recipientIdempotencyKey,
        idempotencyMetadata: {
          sequence: 'si-report-v1',
          baseIdempotencyKey,
          teamId,
          reportId,
          sportId,
          toEmail: recipient.email,
        },
        dailyRecipientMetadata: {
          sequence: 'si-report-v1',
          teamId,
          reportId,
          sportId,
        },
      });

      if (!sendResult.success) {
        failed.push({ email: recipient.email, error: sendResult.error || 'Failed to send' });
        continue;
      }
      sentTo.push(buildRecipientAudit(recipient, sendResult));
    }

    if (failed.length > 0) {
      await reportRef.set(
        {
          deliveryStatus: 'failed',
          lastEmailError: failed.map((entry) => `${entry.email}: ${entry.error}`).join(' | '),
          sentTo,
          emailDelivery: {
            failed,
            sentCount: sentTo.filter((entry) => !entry.skipped).length,
            skippedCount: sentTo.filter((entry) => entry.skipped).length,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return json(502, {
        success: false,
        error: 'One or more report emails failed to send.',
        failed,
        sentTo,
      });
    }

    await markReportSent(reportRef, sentTo);

    return json(200, {
      success: true,
      message: 'Sports Intelligence report email sent.',
      sentCount: sentTo.filter((entry) => !entry.skipped).length,
      skippedCount: sentTo.filter((entry) => entry.skipped).length,
      sentTo: sentTo.map((entry) => ({
        email: entry.email,
        role: entry.role,
        skipped: entry.skipped,
        messageId: entry.messageId,
      })),
    });
  } catch (error) {
    console.error('[send-sports-intelligence-report-email] Unexpected error:', error);
    return json(500, {
      success: false,
      error: error?.message || 'Internal server error while sending Sports Intelligence report email.',
    });
  }
};

exports._private = {
  ALLOWED_RECIPIENT_ROLES,
  UNIVERSAL_COACH_LANGUAGE_BANLIST,
  buildCoachTopLine,
  buildEmailCopy,
  buildReportUrl,
  buildSubject,
  collectCoachFacingStrings,
  enforceLocalLanguagePosture,
  formatWeekLabel,
  renderEmailHtml,
};
