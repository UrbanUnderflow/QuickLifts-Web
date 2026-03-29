import type { Handler } from '@netlify/functions';
import crypto from 'crypto';
import { getFirestore } from './utils/getServiceAccount';
import { escapeHtml, getBaseSiteUrl, sendBrevoTransactionalEmail, toMillis } from './utils/emailSequenceHelpers';

const ASSIGNMENTS_COLLECTION = 'pulsecheck-daily-assignments';
const ASSIGNMENT_EVENTS_COLLECTION = 'pulsecheck-assignment-events';
const RESPONSIVENESS_PROFILES_COLLECTION = 'pulsecheck-protocol-responsiveness-profiles';
const ALERT_STATE_COLLECTION = 'protocol-monitoring-alert-state';
const NOTIFICATION_LOGS_COLLECTION = 'notification-logs';

const CURRENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const BASELINE_WINDOW_MS = 7 * CURRENT_WINDOW_MS;
const ALERT_COOLDOWN_MS = CURRENT_WINDOW_MS;

type AlertKind = 'assignment_volume' | 'defer_override_rate' | 'negative_response';

type AlertItem = {
  kind: AlertKind;
  title: string;
  severity: 'warning' | 'critical';
  summary: string;
  detailLines: string[];
  fingerprint: string;
};

type AssignmentRecord = {
  id: string;
  athleteId: string;
  sourceDate: string;
  protocolId?: string;
  protocolFamilyId?: string;
  protocolVariantId?: string;
  protocolLabel?: string;
  protocolVariantLabel?: string;
  createdAt: number;
  updatedAt: number;
  status?: string;
  actionType?: string;
};

type AssignmentEventRecord = {
  id: string;
  assignmentId: string;
  eventType: string;
  eventAt: number;
};

type ResponsivenessSummary = {
  protocolFamilyId?: string;
  protocolFamilyLabel?: string;
  variantId?: string;
  variantLabel?: string;
  responseDirection: 'positive' | 'neutral' | 'negative' | 'mixed';
  sampleSize: number;
  positiveSignals: number;
  neutralSignals: number;
  negativeSignals: number;
  freshness?: string;
  lastObservedAt?: number;
};

function parseRecipients(): string[] {
  return ['tre@fitwithpulse.ai'];
}

function toUtcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function hashFingerprint(parts: Array<string | number | undefined>) {
  return crypto.createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex').slice(0, 24);
}

function safeLabel(value?: string | null) {
  if (!value) return 'Unknown';
  return value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function formatRateStats(current: number, baseline: number) {
  const delta = current - baseline;
  return `${formatPercent(current)} current vs ${formatPercent(baseline)} baseline (${delta >= 0 ? '+' : ''}${formatPercent(delta)})`;
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
}

function buildVolumeAlert(assignments: AssignmentRecord[], windowStartMs: number, baselineStartMs: number): AlertItem | null {
  const protocolAssignments = assignments.filter((assignment) => Boolean(assignment.protocolId));
  const currentAssignments = protocolAssignments.filter((assignment) => assignment.createdAt >= windowStartMs);
  const baselineAssignments = protocolAssignments.filter((assignment) => assignment.createdAt >= baselineStartMs && assignment.createdAt < windowStartMs);
  const currentCount = currentAssignments.length;
  const baselineAverage = baselineAssignments.length / 7;

  const spikeThreshold = Math.max(12, Math.round(baselineAverage * 2.25));
  const hasSpike =
    currentCount >= spikeThreshold &&
    (baselineAverage < 4 ? currentCount >= 12 : currentCount - baselineAverage >= 6);

  if (!hasSpike) {
    return null;
  }

  const byRuntime = countBy(currentAssignments.filter((assignment) => assignment.protocolId), (assignment) => assignment.protocolLabel || assignment.protocolVariantLabel || assignment.protocolId || 'Unknown runtime').slice(0, 3);
  const byFamily = countBy(currentAssignments.filter((assignment) => assignment.protocolFamilyId), (assignment) => assignment.protocolFamilyId || 'Unknown family').slice(0, 3);

  return {
    kind: 'assignment_volume',
    title: 'Protocol assignment volume spike',
    severity: 'critical',
    summary: `Protocol assignment volume jumped to ${currentCount} in the last 24 hours.`,
    detailLines: [
      `Baseline average over the prior 7 days: ${baselineAverage.toFixed(1)} assignments per day.`,
      `Spike threshold: ${spikeThreshold} assignments in 24h.`,
      byRuntime.length ? `Top runtimes: ${byRuntime.map(([label, count]) => `${label} (${count})`).join(' • ')}` : 'No runtime labels were available in the spike window.',
      byFamily.length ? `Top families: ${byFamily.map(([label, count]) => `${safeLabel(label)} (${count})`).join(' • ')}` : 'No family labels were available in the spike window.',
    ],
    fingerprint: hashFingerprint(['assignment-volume', toUtcDayKey(windowStartMs)]),
  };
}

function buildDeferOverrideAlert(events: AssignmentEventRecord[], assignmentsById: Map<string, AssignmentRecord>, windowStartMs: number, baselineStartMs: number): AlertItem | null {
  const meaningfulEvents = events.filter((event) => ['completed', 'deferred', 'overridden'].includes(event.eventType));
  const currentEvents = meaningfulEvents.filter((event) => event.eventAt >= windowStartMs);
  const baselineEvents = meaningfulEvents.filter((event) => event.eventAt >= baselineStartMs && event.eventAt < windowStartMs);

  const latestOutcomeByAssignment = new Map<string, AssignmentEventRecord>();
  for (const event of meaningfulEvents) {
    if (!assignmentsById.get(event.assignmentId)?.protocolId) continue;
    const existing = latestOutcomeByAssignment.get(event.assignmentId);
    if (!existing || event.eventAt > existing.eventAt) {
      latestOutcomeByAssignment.set(event.assignmentId, event);
    }
  }

  const currentOutcomeAssignments = Array.from(latestOutcomeByAssignment.values()).filter((event) => event.eventAt >= windowStartMs);
  const baselineOutcomeAssignments = Array.from(latestOutcomeByAssignment.values()).filter((event) => event.eventAt >= baselineStartMs && event.eventAt < windowStartMs);

  const currentRejected = currentOutcomeAssignments.filter((event) => ['deferred', 'overridden'].includes(event.eventType)).length;
  const currentResolved = currentOutcomeAssignments.length;
  const baselineRejected = baselineOutcomeAssignments.filter((event) => ['deferred', 'overridden'].includes(event.eventType)).length;
  const baselineResolved = baselineOutcomeAssignments.length;

  const currentRate = currentResolved > 0 ? currentRejected / currentResolved : 0;
  const baselineRate = baselineResolved > 0 ? baselineRejected / baselineResolved : 0;

  const hasSpike = currentResolved >= 8 && currentRate >= 0.3 && currentRate >= baselineRate + 0.15;
  if (!hasSpike) {
    return null;
  }

  const topProtocols = countBy(currentOutcomeAssignments, (event) => {
    const assignment = assignmentsById.get(event.assignmentId);
    return assignment?.protocolLabel || assignment?.protocolVariantLabel || assignment?.protocolId || 'Unknown runtime';
  }).slice(0, 3);

  return {
    kind: 'defer_override_rate',
    title: 'Protocol defer / override rate spike',
    severity: 'critical',
    summary: `Deferred or overridden protocol outcomes are running hot in the last 24 hours.`,
    detailLines: [
      `Current rate: ${formatPercent(currentRate)} across ${currentResolved} resolved protocol outcomes.`,
      `Baseline rate: ${formatPercent(baselineRate)} across ${baselineResolved} resolved outcomes.`,
      `Rate gap: ${formatPercent(currentRate - baselineRate)}.`,
      topProtocols.length ? `Top affected runtimes: ${topProtocols.map(([label, count]) => `${label} (${count})`).join(' • ')}` : 'No protocol labels were available for the affected outcomes.',
    ],
    fingerprint: hashFingerprint(['defer-override-rate', toUtcDayKey(windowStartMs)]),
  };
}

function buildNegativeResponseAlert(profiles: Array<Record<string, any>>, windowStartMs: number): AlertItem | null {
  const items: Array<{
    label: string;
    subject: string;
    sampleSize: number;
    negativeSignals: number;
    positiveSignals: number;
    source: 'family' | 'variant';
    profileId: string;
    updatedAt: number;
  }> = [];

  for (const profile of profiles) {
    const updatedAt = toMillis(profile.updatedAt || profile.lastUpdatedAt) || 0;
    if (updatedAt < windowStartMs) continue;

    const scanSummary = (summary: ResponsivenessSummary | undefined, source: 'family' | 'variant') => {
      if (!summary) return;
      if (summary.sampleSize < 5) return;
      if (summary.responseDirection !== 'negative' && !(summary.responseDirection === 'mixed' && summary.negativeSignals >= summary.positiveSignals)) return;
      if (summary.lastObservedAt && summary.lastObservedAt < windowStartMs) return;

      const label = source === 'family'
        ? summary.protocolFamilyLabel || summary.protocolFamilyId || 'Unknown family'
        : summary.variantLabel || summary.variantId || 'Unknown variant';

      items.push({
        label,
        subject: source === 'family' ? 'family' : 'variant',
        sampleSize: summary.sampleSize,
        negativeSignals: summary.negativeSignals,
        positiveSignals: summary.positiveSignals,
        source,
        profileId: String(profile.id || profile.athleteId || 'unknown-profile'),
        updatedAt,
      });
    };

    const familyResponses = Object.values(profile.familyResponses || {}) as ResponsivenessSummary[];
    const variantResponses = Object.values(profile.variantResponses || {}) as ResponsivenessSummary[];
    familyResponses.forEach((summary) => scanSummary(summary, 'family'));
    variantResponses.forEach((summary) => scanSummary(summary, 'variant'));
  }

  if (!items.length) {
    return null;
  }

  const topItems = items.sort((left, right) => right.sampleSize - left.sampleSize).slice(0, 4);
  return {
    kind: 'negative_response',
    title: 'Negative-response posture spike',
    severity: 'warning',
    summary: `One or more protocol responsiveness profiles are currently leaning negative.`,
    detailLines: [
      `Current negative profiles: ${items.length}.`,
      topItems.map((item) => `${item.subject === 'family' ? 'Family' : 'Variant'} ${item.label}: ${item.negativeSignals} negative / ${item.sampleSize} samples (${item.positiveSignals} positive)`).join(' • '),
      `These profiles were refreshed within the last 24 hours and should be reviewed before the next publish decision.`,
    ],
    fingerprint: hashFingerprint(['negative-response', toUtcDayKey(windowStartMs), ...topItems.map((item) => item.profileId)]),
  };
}

function escapeListItem(line: string) {
  return `<li style="margin:0 0 8px 0;">${escapeHtml(line)}</li>`;
}

function renderEmailHtml(args: {
  alerts: AlertItem[];
  adminUrl: string;
  runAt: Date;
  currentAssignmentCount: number;
  baselineAssignmentAverage: number;
  currentResolveCount: number;
  deferOverrideRate: number;
  baselineDeferOverrideRate: number;
}) {
  const alertCards = args.alerts
    .map((alert) => `
      <div style="margin:0 0 14px 0;padding:16px;border-radius:14px;border:1px solid ${alert.severity === 'critical' ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'};background:${alert.severity === 'critical' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)'};">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="display:inline-flex;padding:4px 10px;border-radius:999px;background:${alert.severity === 'critical' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'};color:${alert.severity === 'critical' ? '#fecaca' : '#fde68a'};font-size:12px;font-weight:800;text-transform:uppercase;">${escapeHtml(alert.severity)}</span>
          <div style="font-size:16px;font-weight:800;color:#fff;">${escapeHtml(alert.title)}</div>
        </div>
        <div style="margin-top:8px;color:#e4e4e7;font-size:14px;line-height:1.6;">${escapeHtml(alert.summary)}</div>
        <ul style="margin:12px 0 0 18px;padding:0;color:#d4d4d8;font-size:13px;line-height:1.6;">
          ${alert.detailLines.map(escapeListItem).join('')}
        </ul>
      </div>
    `)
    .join('');

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Pulse Protocol Monitoring Alert</title>
    </head>
    <body style="margin:0;padding:0;background:#080b12;color:#fff;">
      <div style="padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
        <div style="max-width:760px;margin:0 auto;padding:24px;border:1px solid rgba(255,255,255,0.08);border-radius:20px;background:rgba(15,23,42,0.72);">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.18em;color:#94a3b8;font-weight:700;">Pulse protocol monitoring</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;font-weight:900;">Launch alert for protocol ops</h1>
          <p style="margin:12px 0 0;color:#cbd5e1;font-size:14px;line-height:1.7;">
            The monitoring job detected a protocol-system condition that should be reviewed before the next publish or rollout decision.
          </p>

          <div style="margin-top:18px;padding:16px;border-radius:16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
              <div>
                <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;">Current assignment count</div>
                <div style="font-size:22px;font-weight:800;margin-top:4px;">${args.currentAssignmentCount}</div>
              </div>
              <div>
                <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;">Baseline avg / day</div>
                <div style="font-size:22px;font-weight:800;margin-top:4px;">${args.baselineAssignmentAverage.toFixed(1)}</div>
              </div>
              <div>
                <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;">Resolved outcomes</div>
                <div style="font-size:22px;font-weight:800;margin-top:4px;">${args.currentResolveCount}</div>
              </div>
              <div>
                <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;">Defer / override rate</div>
                <div style="font-size:22px;font-weight:800;margin-top:4px;">${formatPercent(args.deferOverrideRate)}</div>
              </div>
            </div>
            <div style="margin-top:12px;color:#cbd5e1;font-size:13px;line-height:1.7;">
              Baseline assignment average: <strong>${args.baselineAssignmentAverage.toFixed(1)}</strong> per day
              <br/>
              ${escapeHtml(formatRateStats(args.deferOverrideRate, args.baselineDeferOverrideRate))}
            </div>
          </div>

          <div style="margin-top:18px;">${alertCards}</div>

          <div style="margin-top:18px;padding:16px;border-radius:16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.18em;color:#94a3b8;font-weight:700;">Recommended next steps</div>
            <ul style="margin:12px 0 0 18px;padding:0;color:#d4d4d8;font-size:13px;line-height:1.6;">
              <li>Open the Protocol Registry and confirm whether the affected runtime should be restricted or archived.</li>
              <li>Check the assignment audit trace and revision history for the affected runtime / family.</li>
              <li>Review the evidence dashboard and responsiveness inspector for negative-response posture or stale evidence.</li>
            </ul>
            <div style="margin-top:12px;">
              <a href="${escapeHtml(args.adminUrl)}" style="display:inline-block;background:#e0fe10;color:#0b0f16;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:900;">Open PulseCheck Admin</a>
            </div>
          </div>

          <div style="margin-top:16px;color:#94a3b8;font-size:12px;line-height:1.6;">
            Generated at ${escapeHtml(args.runAt.toISOString())}. This is an automated protocol ops alert from Pulse.
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

async function loadAssignmentsSince(db: FirebaseFirestore.Firestore, sinceMs: number) {
  const snap = await db.collection(ASSIGNMENTS_COLLECTION).where('createdAt', '>=', sinceMs).get();
  return snap.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      athleteId: String(data.athleteId || ''),
      sourceDate: String(data.sourceDate || ''),
      protocolId: typeof data.protocolId === 'string' ? data.protocolId : undefined,
      protocolFamilyId: typeof data.protocolFamilyId === 'string' ? data.protocolFamilyId : undefined,
      protocolVariantId: typeof data.protocolVariantId === 'string' ? data.protocolVariantId : undefined,
      protocolLabel: typeof data.protocolLabel === 'string' ? data.protocolLabel : undefined,
      protocolVariantLabel: typeof data.protocolVariantLabel === 'string' ? data.protocolVariantLabel : undefined,
      createdAt: Number(data.createdAt || 0),
      updatedAt: Number(data.updatedAt || 0),
      status: typeof data.status === 'string' ? data.status : undefined,
      actionType: typeof data.actionType === 'string' ? data.actionType : undefined,
    } as AssignmentRecord;
  });
}

async function loadEventsSince(db: FirebaseFirestore.Firestore, sinceMs: number) {
  const snap = await db.collection(ASSIGNMENT_EVENTS_COLLECTION).where('eventAt', '>=', sinceMs).get();
  return snap.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      assignmentId: String(data.assignmentId || ''),
      eventType: String(data.eventType || ''),
      eventAt: Number(data.eventAt || data.createdAt || 0),
    } as AssignmentEventRecord;
  });
}

async function loadRecentProfiles(db: FirebaseFirestore.Firestore) {
  const snap = await db.collection(RESPONSIVENESS_PROFILES_COLLECTION).orderBy('updatedAt', 'desc').limit(80).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
}

async function shouldSendAlert(db: FirebaseFirestore.Firestore, fingerprint: string) {
  const stateRef = db.collection(ALERT_STATE_COLLECTION).doc(fingerprint);
  const stateSnap = await stateRef.get();
  const state = stateSnap.exists ? (stateSnap.data() || {}) : {};
  const lastSentAtMs = toMillis(state.lastSentAt);
  const nowMs = Date.now();
  if (typeof lastSentAtMs === 'number' && nowMs - lastSentAtMs < ALERT_COOLDOWN_MS) {
    return { send: false, cooldownRemainingMs: ALERT_COOLDOWN_MS - (nowMs - lastSentAtMs) };
  }

  await stateRef.set(
    {
      lastSentAt: new Date(nowMs),
      lastCheckedAt: new Date(nowMs),
    },
    { merge: true }
  );

  return { send: true, cooldownRemainingMs: 0 };
}

export const handler: Handler = async () => {
  const now = new Date();
  const nowMs = now.getTime();
  const currentWindowStartMs = nowMs - CURRENT_WINDOW_MS;
  const baselineWindowStartMs = nowMs - BASELINE_WINDOW_MS;
  const adminUrl = `${getBaseSiteUrl()}/admin/systemOverview`;
  const recipients = parseRecipients();

  try {
    const db = await getFirestore();
    const [assignments, events, profiles] = await Promise.all([
      loadAssignmentsSince(db, baselineWindowStartMs),
      loadEventsSince(db, baselineWindowStartMs),
      loadRecentProfiles(db),
    ]);

    const assignmentsById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
    const alerts: AlertItem[] = [];

    const volumeAlert = buildVolumeAlert(assignments, currentWindowStartMs, baselineWindowStartMs);
    if (volumeAlert) {
      const gate = await shouldSendAlert(db, volumeAlert.fingerprint);
      if (gate.send) alerts.push(volumeAlert);
    }

    const deferAlert = buildDeferOverrideAlert(events, assignmentsById, currentWindowStartMs, baselineWindowStartMs);
    if (deferAlert) {
      const gate = await shouldSendAlert(db, deferAlert.fingerprint);
      if (gate.send) alerts.push(deferAlert);
    }

    const negativeAlert = buildNegativeResponseAlert(profiles, currentWindowStartMs);
    if (negativeAlert) {
      const gate = await shouldSendAlert(db, negativeAlert.fingerprint);
      if (gate.send) alerts.push(negativeAlert);
    }

    const protocolAssignments = assignments.filter((assignment) => Boolean(assignment.protocolId));
    const currentAssignments = protocolAssignments.filter((assignment) => assignment.createdAt >= currentWindowStartMs);
    const baselineAssignments = protocolAssignments.filter((assignment) => assignment.createdAt >= baselineWindowStartMs && assignment.createdAt < currentWindowStartMs);
    const currentResolved = events.filter((event) => event.eventAt >= currentWindowStartMs && ['completed', 'deferred', 'overridden'].includes(event.eventType)).length;
    const baselineResolved = events.filter((event) => event.eventAt >= baselineWindowStartMs && event.eventAt < currentWindowStartMs && ['completed', 'deferred', 'overridden'].includes(event.eventType)).length;
    const currentRejected = events.filter((event) => event.eventAt >= currentWindowStartMs && ['deferred', 'overridden'].includes(event.eventType)).length;
    const baselineRejected = events.filter((event) => event.eventAt >= baselineWindowStartMs && event.eventAt < currentWindowStartMs && ['deferred', 'overridden'].includes(event.eventType)).length;

    const currentRate = currentResolved > 0 ? currentRejected / currentResolved : 0;
    const baselineRate = baselineResolved > 0 ? baselineRejected / baselineResolved : 0;

    if (!alerts.length) {
      await db.collection(NOTIFICATION_LOGS_COLLECTION).add({
        type: 'PROTOCOL_MONITORING_ALERT_RUN',
        runAt: now,
        success: true,
        alertsTriggered: 0,
        currentAssignmentCount: currentAssignments.length,
        baselineAssignmentAverage: baselineAssignments.length / 7,
        currentResolved,
        currentRejected,
        currentRate,
        baselineRate,
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          alertsTriggered: 0,
          currentAssignmentCount: currentAssignments.length,
          currentResolved,
        }),
      };
    }

    const subject =
      alerts.length === 1
        ? `Pulse Protocol Alert: ${alerts[0].title}`
        : `Pulse Protocol Alert: ${alerts.length} monitoring thresholds tripped`;

    const htmlContent = renderEmailHtml({
      alerts,
      adminUrl,
      runAt: now,
      currentAssignmentCount: currentAssignments.length,
      baselineAssignmentAverage: baselineAssignments.length / 7,
      currentResolveCount: currentResolved,
      deferOverrideRate: currentRate,
      baselineDeferOverrideRate: baselineRate,
    });

    const sendResults = await Promise.all(
      recipients.map((email) =>
        sendBrevoTransactionalEmail({
          toEmail: email,
          toName: 'Protocol Ops',
          subject,
          htmlContent,
          tags: ['protocol-monitoring-alert', ...alerts.map((alert) => alert.kind)],
          bypassDailyRecipientLimit: true,
          dailyRecipientMetadata: {
            sequence: 'protocol-monitoring-alert',
          },
        }).then((result) => ({ email, result }))
      )
    );

    const failedSends = sendResults.filter(({ result }) => !result.success);
    if (failedSends.length) {
      await db.collection(NOTIFICATION_LOGS_COLLECTION).add({
        type: 'PROTOCOL_MONITORING_ALERT_RUN',
        runAt: now,
        success: false,
        error: failedSends.map(({ email, result }) => `${email}: ${result.error || 'Failed to send protocol monitoring alert'}`).join(' | '),
        alertsTriggered: alerts.length,
        alerts,
        recipients,
        failedRecipients: failedSends.map(({ email }) => email),
      });

      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: failedSends.map(({ email, result }) => `${email}: ${result.error || 'Failed to send protocol monitoring alert'}`).join(' | '),
        }),
      };
    }

    const messageIds = sendResults.map(({ result }) => result.messageId).filter(Boolean);

    await db.collection(NOTIFICATION_LOGS_COLLECTION).add({
      type: 'PROTOCOL_MONITORING_ALERT_EMAIL',
      runAt: now,
      success: true,
      messageId: messageIds[0] || null,
      messageIds,
      recipients,
      alertsTriggered: alerts.length,
      alerts,
      currentAssignmentCount: currentAssignments.length,
      baselineAssignmentAverage: baselineAssignments.length / 7,
      currentResolved,
      currentRejected,
      currentRate,
      baselineRate,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        alertsTriggered: alerts.length,
        messageId: messageIds[0] || null,
        messageIds,
      }),
    };
  } catch (error: any) {
    console.error('[scheduled-pulsecheck-protocol-monitoring] Fatal error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error?.message || 'Internal error' }),
    };
  }
};
