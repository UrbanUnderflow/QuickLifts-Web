'use strict';

const MACRA_EXPERIMENT_ID = 'macra_paywall_onboarding';

const FUNNEL_EVENTS = [
  'macra_onboarding_started',
  'macra_onboarding_paywall_reached',
  'macra_paywall_primary_button_pressed',
  'af_initiated_checkout',
  'macra_subscription_web_checkout_started',
  'af_start_trial',
  'af_purchase',
  'af_subscribe',
  'storekit_cancelled',
  'purchase_cancelled',
  'af_purchase_cancelled',
  'af_purchase_failed',
];

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    return new Date(millis).toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1_000_000)).toISOString();
  }
  return null;
}

function dateKeyInEt(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(dateKey, delta) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function etMidnightUtc(dateKey) {
  // Current Macra operating use is America/New_York. The explicit offset keeps
  // rolling reads stable for the July 2026 operating window.
  return new Date(`${dateKey}T00:00:00-04:00`);
}

function daysBetweenDateKeys(a, b) {
  if (!a || !b) return null;
  const start = new Date(`${a}T12:00:00.000Z`);
  const end = new Date(`${b}T12:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function countBy(rows, getKey) {
  const out = {};
  rows.forEach((row) => {
    const key = String(getKey(row) || 'unknown');
    out[key] = (out[key] || 0) + 1;
  });
  return out;
}

function eventCounts(events = {}) {
  return Object.fromEntries(FUNNEL_EVENTS.map((name) => [name, Number(events[name] || 0)]));
}

function periodStart(row) {
  return row?.startDate || row?.periodStart || row?.sourcePeriodStart || row?.from || null;
}

function periodEnd(row) {
  return row?.endDate || row?.periodEnd || row?.sourcePeriodEnd || row?.to || null;
}

function maxDateKey(...values) {
  return values.filter(Boolean).sort().slice(-1)[0] || null;
}

function pickDateKey(row) {
  const iso = toIso(row.createdAt || row.timestamp || row.eventTime || row.updatedAt);
  return iso ? dateKeyInEt(iso) : 'unknown';
}

function sourceFreshnessLabel({ targetDate, coverageEnd, importedAt }) {
  if (!coverageEnd) return 'missing';
  const lagDays = daysBetweenDateKeys(coverageEnd, targetDate);
  if (lagDays === null) return 'unknown';
  if (lagDays <= 0) return 'fresh';
  if (lagDays <= 2) return 'lagging';
  return importedAt ? 'stale' : 'stale-no-import-timestamp';
}

function summarizeRows(rows, options = {}) {
  const limit = options.limit || 5;
  return rows.slice(0, limit).map((row) => ({
    id: row.id || '',
    createdAt: toIso(row.createdAt || row.timestamp || row.eventTime || row.updatedAt),
    status: row.status || row.eventType || row.type || '',
    source: row.source || row.mediaSource || '',
    reason: row.reason || row.cancelReason || row.feedbackReason || '',
    trigger: row.trigger || '',
    planPeriod: row.planPeriod || row.period || '',
  }));
}

async function safeGetDoc(db, path) {
  try {
    const snap = await db.doc(path).get();
    return { exists: snap.exists, id: snap.id, data: snap.exists ? snap.data() || {} : null, error: null };
  } catch (error) {
    return { exists: false, id: path.split('/').pop(), data: null, error: error.message || String(error) };
  }
}

async function safeCollectionGet(db, collectionName, limit = 500) {
  try {
    const snap = await db.collection(collectionName).limit(limit).get();
    return { docs: snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })), error: null };
  } catch (error) {
    return { docs: [], error: error.message || String(error) };
  }
}

async function safeSinceQuery(db, collectionName, fieldName, sinceDate, limit = 500) {
  try {
    const snap = await db
      .collection(collectionName)
      .where(fieldName, '>=', sinceDate)
      .orderBy(fieldName, 'desc')
      .limit(limit)
      .get();
    return { docs: snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })), error: null };
  } catch (error) {
    return { docs: [], error: error.message || String(error) };
  }
}

async function safeWhereQuery(db, collectionName, fieldName, operator, value, limit = 500) {
  try {
    const snap = await db
      .collection(collectionName)
      .where(fieldName, operator, value)
      .limit(limit)
      .get();
    return { docs: snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })), error: null };
  } catch (error) {
    return { docs: [], error: error.message || String(error) };
  }
}

async function buildMacraOperatingRead(db, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const targetDate = options.dateKey || dateKeyInEt(now);
  const rollingStartDate = options.startDate || addDays(targetDate, -6);
  const rollingStart = etMidnightUtc(rollingStartDate);

  const [
    scoreboard,
    experimentConfig,
    experimentResults,
    aggregatePeriods,
    purchaseLogs,
    cancelReasons,
    macraUsers,
    pushLogs,
    tasks,
  ] = await Promise.all([
    safeGetDoc(db, 'appsflyer-scoreboards/macra'),
    safeGetDoc(db, `macra-experiments/${MACRA_EXPERIMENT_ID}`),
    safeGetDoc(db, `macra-experiment-results/${MACRA_EXPERIMENT_ID}`),
    safeCollectionGet(db, 'appsflyer-aggregate-periods', 1000),
    safeSinceQuery(db, 'Macra-purchase-logs', 'createdAt', rollingStart, 300),
    safeSinceQuery(db, 'Macrafeedbackreason', 'createdAt', rollingStart, 200),
    safeWhereQuery(db, 'users', 'registrationEntryPoint', '==', 'macra', 1000),
    safeSinceQuery(db, 'pulsecommand-notification-logs', 'createdAt', rollingStart, 300),
    safeCollectionGet(db, 'agent-tasks', 400),
  ]);

  const macraPeriods = aggregatePeriods.docs
    .filter((doc) => String(doc.id || '').startsWith('macra_') || String(doc.product || '').toLowerCase() === 'macra')
    .sort((a, b) => String(periodEnd(b) || b.id).localeCompare(String(periodEnd(a) || a.id)));
  const latestPeriod = macraPeriods[0] || null;
  const scoreboardData = scoreboard.data || {};
  const coverageStart = scoreboardData.aggregateCsvCoverageStart || scoreboardData.from || periodStart(latestPeriod) || null;
  const coverageEnd = maxDateKey(scoreboardData.aggregateCsvCoverageEnd, scoreboardData.to, periodEnd(latestPeriod));
  const scoreboardImportedAt = toIso(scoreboardData.importedAt || scoreboardData.updatedAt || latestPeriod?.importedAt || latestPeriod?.updatedAt);
  const freshness = sourceFreshnessLabel({ targetDate, coverageEnd, importedAt: scoreboardImportedAt });
  const coverageLagDays = daysBetweenDateKeys(coverageEnd, targetDate);
  const latestEvents = eventCounts(latestPeriod?.summary?.events?.byName || {});

  const purchaseRows = purchaseLogs.docs;
  const cancelRows = cancelReasons.docs;
  const macraUserRows = macraUsers.docs.filter((row) => {
    const createdAt = toIso(row.createdAt || row.updatedAt);
    if (!createdAt) return true;
    const key = dateKeyInEt(createdAt);
    return key >= rollingStartDate && key <= targetDate;
  });
  const pushRows = pushLogs.docs;
  const taskRows = tasks.docs.filter((row) => {
    const haystack = [
      row.project,
      row.product,
      row.missionId,
      row.name,
      row.description,
      row.taskTemplateId,
    ].join(' ').toLowerCase();
    return haystack.includes('macra') || haystack.includes('macra-growth-ops');
  });

  const activeVariant = (experimentConfig.data?.variants || []).find((variant) => variant?.isEnabled || Number(variant?.weight || 0) > 0);
  const generatedAt = toIso(experimentResults.data?.generatedAt);
  const qualityLabel = String(experimentResults.data?.qualityLabel || '');
  const configUpdatedAt = toIso(experimentConfig.data?.updatedAt);
  const resultGeneratedDate = generatedAt ? dateKeyInEt(generatedAt) : null;
  const resultLagDays = resultGeneratedDate ? daysBetweenDateKeys(resultGeneratedDate, targetDate) : null;
  const experimentDecisionGrade = Boolean(
    experimentConfig.exists &&
      experimentResults.exists &&
      activeVariant?.id === 'variant_a' &&
      resultLagDays !== null &&
      resultLagDays <= 2 &&
      !qualityLabel.toLowerCase().includes('inferred')
  );

  const pushFailures = pushRows.filter((row) => row.success === false);
  const pushSuccesses = pushRows.filter((row) => row.success === true);
  const staleActiveTasks = taskRows.filter((row) => {
    const status = String(row.status || '').toLowerCase();
    if (!['in-progress', 'working'].includes(status)) return false;
    const updatedIso = toIso(row.updatedAt || row.createdAt);
    if (!updatedIso) return true;
    return Date.now() - new Date(updatedIso).getTime() > 60 * 60 * 1000;
  });

  const blockers = [];
  if (freshness === 'missing' || freshness === 'stale' || freshness === 'stale-no-import-timestamp') {
    blockers.push(`AppsFlyer/Scoreboard coverage ends ${coverageEnd || 'unknown'}; import latest CSV before reading source quality.`);
  }
  if (!experimentDecisionGrade) {
    blockers.push(`Experiment results are not decision-grade (${qualityLabel || 'missing quality label'}, generated ${generatedAt || 'missing'}).`);
  }
  if (pushFailures.length > 0 && pushSuccesses.length === 0) {
    blockers.push('PulseCommand push delivery is failing; check Firebase/APNs credentials for the iOS app.');
  }
  if (staleActiveTasks.length > 0) {
    blockers.push(`${staleActiveTasks.length} Macra agent task(s) are stale in an active state.`);
  }

  const action =
    blockers.length > 0
      ? 'refresh_data_first'
      : purchaseRows.filter((row) => String(row.status || '').toLowerCase() === 'canceled').length > purchaseRows.filter((row) => String(row.status || '').toLowerCase() === 'success').length
        ? 'hold_and_diagnose_checkout'
        : 'ready_for_one_controlled_change';

  const read = {
    generatedAt: now.toISOString(),
    targetDate,
    rollingWindow: { startDate: rollingStartDate, endDate: targetDate },
    action,
    operatorSummary:
      action === 'refresh_data_first'
        ? `Macra is not decision-grade today: ${blockers[0]}`
        : action === 'hold_and_diagnose_checkout'
          ? 'Macra has fresh lower-funnel activity, but checkout cancels exceed successes. Hold funnel changes and diagnose checkout/trust friction.'
          : 'Macra sources are clean enough for one controlled operating change.',
    blockers,
    scoreboard: {
      exists: scoreboard.exists,
      error: scoreboard.error,
      importedAt: scoreboardImportedAt,
      updatedAt: toIso(scoreboardData.updatedAt),
      coverageStart,
      coverageEnd,
      freshness,
      coverageLagDays,
      latestRunId: scoreboardData.latestRunId || scoreboardData.runId || scoreboardData.id || '',
    },
    appsFlyer: {
      latestAggregatePeriod: latestPeriod
        ? {
            id: latestPeriod.id,
            startDate: periodStart(latestPeriod),
            endDate: periodEnd(latestPeriod),
            importedAt: toIso(latestPeriod.importedAt),
            updatedAt: toIso(latestPeriod.updatedAt),
            funnelEvents: latestEvents,
            mediaSourceEventVolume: latestPeriod.summary?.events?.byMediaSource || {},
          }
        : null,
      aggregatePeriodCount: macraPeriods.length,
      aggregateQueryError: aggregatePeriods.error,
    },
    experiment: {
      id: MACRA_EXPERIMENT_ID,
      configExists: experimentConfig.exists,
      configError: experimentConfig.error,
      resultsExists: experimentResults.exists,
      resultsError: experimentResults.error,
      activeVariantId: activeVariant?.id || '',
      activeVariantName: activeVariant?.name || '',
      configUpdatedAt,
      resultsGeneratedAt: generatedAt,
      qualityLabel,
      loadedUsers: Number(experimentResults.data?.loadedUsers || 0),
      inferredAssignments: Number(experimentResults.data?.inferredAssignments || 0),
      exactAssignments: Number(experimentResults.data?.exactAssignments || 0),
      resultLagDays,
      decisionGrade: experimentDecisionGrade,
    },
    lowerFunnel: {
      purchaseLogs: {
        queryError: purchaseLogs.error,
        total: purchaseRows.length,
        byDate: countBy(purchaseRows, pickDateKey),
        byStatus: countBy(purchaseRows, (row) => row.status || row.eventType || row.type),
        bySource: countBy(purchaseRows, (row) => row.source),
        sample: summarizeRows(purchaseRows),
      },
      cancelReasons: {
        queryError: cancelReasons.error,
        total: cancelRows.length,
        byDate: countBy(cancelRows, pickDateKey),
        byReason: countBy(cancelRows, (row) => row.reason || row.cancelReason || row.feedbackReason),
        byTrigger: countBy(cancelRows, (row) => row.trigger),
        sample: summarizeRows(cancelRows),
      },
      macraUsers: {
        queryError: macraUsers.error,
        total: macraUserRows.length,
        byDate: countBy(macraUserRows, pickDateKey),
        completedOnboarding: macraUserRows.filter((row) => (
          row.hasCompletedOnboarding ||
          row.hasCompletedMacraOnboarding ||
          row.onboardingCompleted ||
          row.completedOnboarding ||
          row.macraOnboardingCompletedAt
        )).length,
      },
    },
    systemHealth: {
      push: {
        queryError: pushLogs.error,
        successes: pushSuccesses.length,
        failures: pushFailures.length,
        failureCodes: countBy(pushFailures, (row) => row.error?.code || row.code),
      },
      tasks: {
        queryError: tasks.error,
        totalMacraTasks: taskRows.length,
        byStatus: countBy(taskRows, (row) => row.status),
        staleActive: staleActiveTasks.map((row) => ({
          id: row.id,
          name: row.name || '',
          assignee: row.assignee || '',
          status: row.status || '',
          updatedAt: toIso(row.updatedAt || row.createdAt),
        })),
      },
    },
    recommendedNextSteps: [
      freshness === 'fresh' ? null : 'Import the latest AppsFlyer CSV and refresh the Macra Scoreboard.',
      experimentDecisionGrade ? null : 'Backfill `/admin/experiments` so `variant_a` results are current and not mostly inferred.',
      pushFailures.length > 0 && pushSuccesses.length === 0 ? 'Repair PulseCommand APNs/FCM credentials so operator updates reach the iPhone.' : null,
      staleActiveTasks.length > 0 ? 'Move stale failed Macra tasks out of active work before restarting the agent loop.' : null,
      'Do not change onboarding, paywall, pricing, retargeting, or Apple Search Ads until the stale source blockers clear.',
    ].filter(Boolean),
  };

  return read;
}

function renderMacraOperatingReadMarkdown(read) {
  const events = read.appsFlyer.latestAggregatePeriod?.funnelEvents || {};
  const media = read.appsFlyer.latestAggregatePeriod?.mediaSourceEventVolume || {};
  const lines = [
    `# Macra Operating Read - ${read.targetDate}`,
    '',
    `Generated: \`${read.generatedAt}\``,
    '',
    `## Operator Summary`,
    '',
    read.operatorSummary,
    '',
    `Action: \`${read.action}\``,
    '',
    `## Source Freshness`,
    '',
    `- Scoreboard coverage: ${read.scoreboard.coverageStart || 'unknown'} through ${read.scoreboard.coverageEnd || 'unknown'}`,
    `- Scoreboard imported: ${read.scoreboard.importedAt || 'unknown'}`,
    `- Freshness: ${read.scoreboard.freshness}${read.scoreboard.coverageLagDays == null ? '' : ` (${read.scoreboard.coverageLagDays} day lag)`}`,
    `- Experiment: active ${read.experiment.activeVariantId || 'unknown'}; results generated ${read.experiment.resultsGeneratedAt || 'unknown'}; quality ${read.experiment.qualityLabel || 'unknown'}; decision-grade ${read.experiment.decisionGrade ? 'yes' : 'no'}`,
    '',
    `## Latest AppsFlyer Funnel`,
    '',
    `Aggregate period: ${read.appsFlyer.latestAggregatePeriod?.startDate || 'unknown'} through ${read.appsFlyer.latestAggregatePeriod?.endDate || 'unknown'}`,
    '',
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Onboarding starts | ${events.macra_onboarding_started || 0} |`,
    `| Paywall reached | ${events.macra_onboarding_paywall_reached || 0} |`,
    `| Paywall CTA pressed | ${events.macra_paywall_primary_button_pressed || 0} |`,
    `| af_initiated_checkout | ${events.af_initiated_checkout || 0} |`,
    `| Web checkout started | ${events.macra_subscription_web_checkout_started || 0} |`,
    `| Trial starts | ${events.af_start_trial || 0} |`,
    `| Purchases | ${events.af_purchase || 0} |`,
    `| Subscribes | ${events.af_subscribe || 0} |`,
    '',
    `Media-source event volume: ${Object.entries(media).map(([key, value]) => `${key}: ${value}`).join(', ') || 'unavailable'}`,
    '',
    `## Rolling Lower Funnel (${read.rollingWindow.startDate} through ${read.rollingWindow.endDate})`,
    '',
    `- Purchase logs: ${read.lowerFunnel.purchaseLogs.total}`,
    `- Purchase statuses: ${JSON.stringify(read.lowerFunnel.purchaseLogs.byStatus)}`,
    `- Cancel reasons: ${read.lowerFunnel.cancelReasons.total}`,
    `- Cancel-reason mix: ${JSON.stringify(read.lowerFunnel.cancelReasons.byReason)}`,
    `- Macra user docs: ${read.lowerFunnel.macraUsers.total}`,
    `- Completed onboarding rows: ${read.lowerFunnel.macraUsers.completedOnboarding}`,
    '',
    `## System Health`,
    '',
    `- PulseCommand push successes: ${read.systemHealth.push.successes}`,
    `- PulseCommand push failures: ${read.systemHealth.push.failures}`,
    `- Macra tasks by status: ${JSON.stringify(read.systemHealth.tasks.byStatus)}`,
    `- Stale active Macra tasks: ${read.systemHealth.tasks.staleActive.length}`,
    '',
    `## Blockers`,
    '',
    ...(read.blockers.length ? read.blockers.map((item) => `- ${item}`) : ['- None']),
    '',
    `## Recommended Next Steps`,
    '',
    ...read.recommendedNextSteps.map((item) => `- ${item}`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

module.exports = {
  buildMacraOperatingRead,
  renderMacraOperatingReadMarkdown,
};
