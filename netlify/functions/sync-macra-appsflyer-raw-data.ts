import type { Handler } from '@netlify/functions';
import crypto from 'crypto';
import { getSecretManagerSecret } from '../../src/lib/secretManager';

const firebaseConfig = require('./config/firebase') as any;

const { admin, headers, getFirebaseAdminApp, initializeFirebaseAdmin } = firebaseConfig;

const APPSFLYER_BASE_URL = 'https://hq1.appsflyer.com/api/raw-data/export/app';
const MACRA_APPSFLYER_APP_ID = 'id6463771067';
const SCOREBOARD_COLLECTION = 'appsflyer-scoreboards';
const SCOREBOARD_DOC_ID = 'macra';
const USER_ATTRIBUTION_COLLECTION = 'appsflyer-macra-users';
const IMPORT_RUN_COLLECTION = 'appsflyer-import-runs';
const RAW_ROW_COLLECTION = 'appsflyer-macra-raw-rows';
const DEFAULT_DAYS_BACK = 7;
const DEFAULT_MAXIMUM_ROWS = 50000;
const MAX_DAYS_BACK = 31;
const APPSFLYER_SECRET_MANAGER_SECRET_NAMES = [
  'APPSFLYER_RAW_DATA_API_TOKEN',
  'appsflyer-raw-data-api-token',
  'macra-appsflyer-raw-data-api-token',
];

const DEFAULT_MACRA_EVENT_NAMES = [
  'af_complete_registration',
  'macra_onboarding_started',
  'macra_onboarding_profile_completed',
  'macra_onboarding_paywall_reached',
  'macra_onboarding_completed',
  'macra_paywall_viewed_standalone',
  'macra_paywall_primary_button_pressed',
  'af_initiated_checkout',
  'macra_subscription_purchase_cancelled',
  'macra_paywall_cancel_feedback_submitted',
  'macra_subscription_web_checkout_started',
  'macra_subscription_web_checkout_returned',
  'af_start_trial',
  'af_subscribe',
  'af_purchase',
];

type ReportType = 'install' | 'event';

type ReportConfig = {
  key: string;
  path: string;
  type: ReportType;
  organic: boolean;
  eventNames?: string[];
};

type UploadedCsvFile = {
  name?: string;
  content?: string;
  reportType?: ReportType;
  organic?: boolean;
};

type NormalizedRow = Record<string, string>;

type SummaryShape = {
  appId: string;
  from: string;
  to: string;
  daysBack: number;
  maximumRows: number;
  timezone: string;
  tokenSource?: string;
  importSource?: string;
  rows: number;
  duplicateRows: number;
  reports: Record<string, number>;
  installs: {
    total: number;
    organic: number;
    nonOrganic: number;
    byMediaSource: Record<string, number>;
    byCampaign: Record<string, number>;
  };
  events: {
    total: number;
    byName: Record<string, number>;
    byMediaSource: Record<string, number>;
  };
  matchedCustomerUserRows: number;
  unmatchedRows: number;
  importedUserDocs: number;
  topMediaSources: Array<{ label: string; count: number }>;
  topCampaigns: Array<{ label: string; count: number }>;
  topEvents: Array<{ label: string; count: number }>;
};

type AttributionAggregate = {
  docId: string;
  customerUserId: string;
  appsFlyerId: string;
  mediaSource: string;
  campaign: string;
  campaignId: string;
  adset: string;
  ad: string;
  isOrganic: boolean;
  installTime: string;
  latestEventTime: string;
  eventCounts: Record<string, number>;
  eventLatestAt: Record<string, string>;
};

const json = (statusCode: number, payload: Record<string, any>) => ({
  statusCode,
  headers,
  body: JSON.stringify(payload),
});

const getHeader = (event: any, name: string): string => {
  const wanted = name.toLowerCase();
  const found = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === wanted);
  return found ? String(found[1] || '') : '';
};

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeHeader = (value: string): string =>
  value
    .trim()
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const safeDocId = (value: string): string =>
  value && !/[/.#[\]]/.test(value) && value.length <= 140
    ? value
    : `af_${crypto.createHash('sha1').update(value || 'missing').digest('hex')}`;

const hashRowKey = (value: string): string => crypto.createHash('sha1').update(value).digest('hex');

const parseInteger = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
};

const formatDateParam = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
};

const parseCsv = (csv: string): NormalizedRow[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);

  const headersRow = rows.shift() || [];
  const normalizedHeaders = headersRow.map(normalizeHeader);
  return rows.map((values) => {
    const out: NormalizedRow = {};
    normalizedHeaders.forEach((header, index) => {
      if (!header) return;
      out[header] = normalizeString(values[index]);
    });
    return out;
  });
};

const getValue = (row: NormalizedRow, keys: string[]): string => {
  for (const key of keys) {
    const value = normalizeString(row[key]);
    if (value) return value;
  }
  return '';
};

const bump = (target: Record<string, number>, key: string, amount = 1) => {
  const normalized = key || 'unknown';
  target[normalized] = (target[normalized] || 0) + amount;
};

const mergeCountMaps = (base: Record<string, number> = {}, delta: Record<string, number> = {}) => {
  const out = { ...base };
  Object.entries(delta).forEach(([key, value]) => {
    out[key] = (Number(out[key] || 0) || 0) + (Number(value || 0) || 0);
  });
  return out;
};

const topEntries = (record: Record<string, number>, limit = 8) =>
  Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));

const createSummary = (args: {
  appId: string;
  from: string;
  to: string;
  daysBack: number;
  maximumRows: number;
  timezone: string;
  tokenSource?: string;
  importSource: string;
}): SummaryShape => ({
  appId: args.appId,
  from: args.from,
  to: args.to,
  daysBack: args.daysBack,
  maximumRows: args.maximumRows,
  timezone: args.timezone,
  tokenSource: args.tokenSource || '',
  importSource: args.importSource || '',
  rows: 0,
  duplicateRows: 0,
  reports: {},
  installs: {
    total: 0,
    organic: 0,
    nonOrganic: 0,
    byMediaSource: {},
    byCampaign: {},
  },
  events: {
    total: 0,
    byName: {},
    byMediaSource: {},
  },
  matchedCustomerUserRows: 0,
  unmatchedRows: 0,
  importedUserDocs: 0,
  topMediaSources: [],
  topCampaigns: [],
  topEvents: [],
});

const addRowToSummary = (summary: SummaryShape, row: NormalizedRow, report: ReportConfig) => {
  const customerUserId = getValue(row, ['customer_user_id', 'customer_userid', 'customer_id', 'app_user_id']);
  const mediaSource = report.organic ? 'Organic' : getValue(row, ['media_source', 'pid', 'source']) || 'Unknown paid source';
  const campaign = getValue(row, ['campaign', 'campaign_name', 'c']) || 'Unknown campaign';

  if (customerUserId) summary.matchedCustomerUserRows += 1;
  else summary.unmatchedRows += 1;

  if (report.type === 'install') {
    summary.installs.total += 1;
    if (report.organic) summary.installs.organic += 1;
    else summary.installs.nonOrganic += 1;
    bump(summary.installs.byMediaSource, mediaSource);
    bump(summary.installs.byCampaign, campaign);
  } else {
    const eventName = getValue(row, ['event_name']) || 'unknown_event';
    summary.events.total += 1;
    bump(summary.events.byName, eventName);
    bump(summary.events.byMediaSource, mediaSource);
  }
};

const finalizeSummary = (summary: SummaryShape) => {
  summary.topMediaSources = topEntries(summary.installs.byMediaSource);
  summary.topCampaigns = topEntries(summary.installs.byCampaign);
  summary.topEvents = topEntries(summary.events.byName);
  return summary;
};

const mergeSummaryTotals = (existing: Record<string, any>, delta: SummaryShape): SummaryShape => {
  const merged = createSummary({
    appId: delta.appId || normalizeString(existing.appId),
    from: delta.from || normalizeString(existing.from),
    to: delta.to || normalizeString(existing.to),
    daysBack: Number(delta.daysBack || existing.daysBack || 0),
    maximumRows: Number(delta.maximumRows || existing.maximumRows || 0),
    timezone: delta.timezone || normalizeString(existing.timezone),
    tokenSource: delta.tokenSource || normalizeString(existing.tokenSource),
    importSource: delta.importSource || normalizeString(existing.importSource) || 'unknown',
  });

  merged.rows = (Number(existing.rows || 0) || 0) + delta.rows;
  merged.duplicateRows = (Number(existing.duplicateRows || 0) || 0) + delta.duplicateRows;
  merged.reports = mergeCountMaps(existing.reports || {}, delta.reports);
  merged.installs.total = (Number(existing.installs?.total || 0) || 0) + delta.installs.total;
  merged.installs.organic = (Number(existing.installs?.organic || 0) || 0) + delta.installs.organic;
  merged.installs.nonOrganic = (Number(existing.installs?.nonOrganic || 0) || 0) + delta.installs.nonOrganic;
  merged.installs.byMediaSource = mergeCountMaps(existing.installs?.byMediaSource || {}, delta.installs.byMediaSource);
  merged.installs.byCampaign = mergeCountMaps(existing.installs?.byCampaign || {}, delta.installs.byCampaign);
  merged.events.total = (Number(existing.events?.total || 0) || 0) + delta.events.total;
  merged.events.byName = mergeCountMaps(existing.events?.byName || {}, delta.events.byName);
  merged.events.byMediaSource = mergeCountMaps(existing.events?.byMediaSource || {}, delta.events.byMediaSource);
  merged.matchedCustomerUserRows = (Number(existing.matchedCustomerUserRows || 0) || 0) + delta.matchedCustomerUserRows;
  merged.unmatchedRows = (Number(existing.unmatchedRows || 0) || 0) + delta.unmatchedRows;
  merged.importedUserDocs = Math.max(Number(existing.importedUserDocs || 0) || 0, delta.importedUserDocs);

  return finalizeSummary(merged);
};

async function resolveAppsFlyerToken() {
  const envToken = normalizeString(
    process.env.APPSFLYER_RAW_DATA_API_TOKEN ||
      process.env.APPSFLYER_API_TOKEN_V2 ||
      process.env.APPSFLYER_API_TOKEN
  );

  if (envToken) {
    return { token: envToken, source: 'netlify_env', errors: [] as string[] };
  }

  const configuredSecretNames = [
    process.env.APPSFLYER_RAW_DATA_SECRET_NAME,
    process.env.APPSFLYER_SECRET_MANAGER_SECRET_NAME,
  ]
    .map(normalizeString)
    .filter(Boolean);
  const secretNames = Array.from(new Set([...configuredSecretNames, ...APPSFLYER_SECRET_MANAGER_SECRET_NAMES]));
  const errors: string[] = [];

  for (const secretName of secretNames) {
    try {
      const secretValue = normalizeString(await getSecretManagerSecret(secretName));
      if (secretValue) {
        return { token: secretValue, source: `secret_manager:${secretName}`, errors };
      }
      errors.push(`${secretName}: empty secret payload`);
    } catch (error: any) {
      errors.push(`${secretName}: ${error?.message || 'failed to read secret'}`);
    }
  }

  return { token: '', source: 'missing', errors };
}

async function verifyAdminRequest(event: any) {
  const authHeader = getHeader(event, 'authorization');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  initializeFirebaseAdmin(event);
  const app = getFirebaseAdminApp(event);
  const db = app.firestore();
  const decoded = await admin.auth(app).verifyIdToken(match[1]);
  const email = normalizeString(decoded.email).toLowerCase();
  const hasAdminClaim = decoded.admin === true || decoded.isAdmin === true || decoded.role === 'admin';
  if (hasAdminClaim) return { uid: decoded.uid, email, source: 'claim', db };

  if (!email) return null;
  const adminSnap = await db.collection('admin').doc(email).get();
  if (!adminSnap.exists) return null;

  return { uid: decoded.uid, email, source: 'admin_collection', db };
}

function resolveDateRange(body: Record<string, any>) {
  const now = new Date();
  const daysBack = Math.max(1, Math.min(MAX_DAYS_BACK, parseInteger(body.daysBack, DEFAULT_DAYS_BACK)));
  const from = normalizeString(body.from) || formatDateParam(new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000));
  const to = normalizeString(body.to) || formatDateParam(now);
  return { from, to, daysBack };
}

function resolveReports(body: Record<string, any>): ReportConfig[] {
  const eventNames = Array.isArray(body.eventNames)
    ? body.eventNames.map(normalizeString).filter(Boolean)
    : DEFAULT_MACRA_EVENT_NAMES;

  const reports: ReportConfig[] = [
    { key: 'non_organic_installs', path: 'installs_report/v5', type: 'install', organic: false },
    { key: 'organic_installs', path: 'organic_installs_report/v5', type: 'install', organic: true },
    { key: 'non_organic_in_app_events', path: 'in_app_events_report/v5', type: 'event', organic: false, eventNames },
    { key: 'organic_in_app_events', path: 'organic_in_app_events_report/v5', type: 'event', organic: true, eventNames },
  ];

  if (body.includeRetargeting === true) {
    reports.push(
      { key: 'retargeting_conversions', path: 'installs-retarget/v5', type: 'install', organic: false },
      { key: 'retargeting_in_app_events', path: 'in-app-events-retarget/v5', type: 'event', organic: false, eventNames }
    );
  }

  return reports;
}

async function fetchAppsFlyerReport(args: {
  token: string;
  appId: string;
  report: ReportConfig;
  from: string;
  to: string;
  maximumRows: number;
  timezone: string;
}) {
  const url = new URL(`${APPSFLYER_BASE_URL}/${encodeURIComponent(args.appId)}/${args.report.path}`);
  url.searchParams.set('from', args.from);
  url.searchParams.set('to', args.to);
  url.searchParams.set('maximum_rows', String(args.maximumRows));
  if (args.timezone) url.searchParams.set('timezone', args.timezone);
  if (args.report.eventNames?.length) url.searchParams.set('event_name', args.report.eventNames.join(','));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${args.token}`,
      Accept: 'text/csv',
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`AppsFlyer ${args.report.key} failed (${response.status}): ${text.slice(0, 300)}`);
  }

  return parseCsv(text);
}

function mergeAttributionRow(args: {
  aggregateByDocId: Map<string, AttributionAggregate>;
  row: NormalizedRow;
  report: ReportConfig;
}) {
  const { aggregateByDocId, row, report } = args;
  const customerUserId = getValue(row, ['customer_user_id', 'customer_userid', 'customer_id', 'app_user_id']);
  const appsFlyerId = getValue(row, ['appsflyer_id', 'apps_flyer_id', 'af_id']);
  const identity = customerUserId || appsFlyerId;
  if (!identity) return;

  const docId = customerUserId ? safeDocId(customerUserId) : `af_${hashRowKey(appsFlyerId)}`;
  const mediaSource = report.organic ? 'Organic' : getValue(row, ['media_source', 'pid', 'source']) || 'Unknown paid source';
  const campaign = getValue(row, ['campaign', 'campaign_name', 'c']) || 'Unknown campaign';
  const campaignId = getValue(row, ['campaign_id', 'af_c_id']);
  const adset = getValue(row, ['adset', 'adset_name', 'af_adset']);
  const ad = getValue(row, ['ad', 'ad_name', 'af_ad']);
  const installTime = getValue(row, ['install_time', 'install_time_selected_timezone']);
  const eventName = report.type === 'event' ? getValue(row, ['event_name']) || 'unknown_event' : '';
  const eventTime = getValue(row, ['event_time', 'event_time_selected_timezone', 'install_time']);

  const existing = aggregateByDocId.get(docId) || {
    docId,
    customerUserId,
    appsFlyerId,
    mediaSource,
    campaign,
    campaignId,
    adset,
    ad,
    isOrganic: report.organic,
    installTime,
    latestEventTime: eventTime,
    eventCounts: {},
    eventLatestAt: {},
  };

  existing.customerUserId = existing.customerUserId || customerUserId;
  existing.appsFlyerId = existing.appsFlyerId || appsFlyerId;
  existing.mediaSource = existing.mediaSource || mediaSource;
  existing.campaign = existing.campaign || campaign;
  existing.campaignId = existing.campaignId || campaignId;
  existing.adset = existing.adset || adset;
  existing.ad = existing.ad || ad;
  existing.isOrganic = existing.isOrganic && report.organic;
  existing.installTime = existing.installTime || installTime;
  existing.latestEventTime = eventTime || existing.latestEventTime;

  if (eventName) {
    existing.eventCounts[eventName] = (existing.eventCounts[eventName] || 0) + 1;
    existing.eventLatestAt[eventName] = eventTime || existing.eventLatestAt[eventName] || '';
  }

  aggregateByDocId.set(docId, existing);
}

function inferUploadedReport(file: UploadedCsvFile, rows: NormalizedRow[], index: number): ReportConfig {
  const name = normalizeString(file.name).toLowerCase();
  const firstRow = rows[0] || {};
  const type: ReportType =
    file.reportType === 'install' || file.reportType === 'event'
      ? file.reportType
      : firstRow.event_name || name.includes('event') || name.includes('in_app')
        ? 'event'
        : 'install';
  const organic =
    typeof file.organic === 'boolean'
      ? file.organic
      : name.includes('organic') && !name.includes('non_organic') && !name.includes('non-organic') && !name.includes('non organic');
  const keyPrefix = organic ? 'organic' : 'non_organic';
  return {
    key: `csv_${keyPrefix}_${type}_${index + 1}`,
    path: 'csv_upload',
    type,
    organic,
  };
}

function stableRawRowId(row: NormalizedRow, report: ReportConfig): string {
  const eventName = report.type === 'event' ? getValue(row, ['event_name']) || 'unknown_event' : '';
  const identity = getValue(row, ['customer_user_id', 'customer_userid', 'customer_id', 'app_user_id', 'appsflyer_id', 'apps_flyer_id', 'af_id']);
  const occurredAt = getValue(row, ['event_time', 'event_time_selected_timezone', 'install_time', 'install_time_selected_timezone']);
  const fallback = Object.keys(row)
    .sort()
    .map((key) => `${key}:${row[key]}`)
    .join('|');
  return hashRowKey(
    JSON.stringify({
      type: report.type,
      organic: report.organic,
      identity,
      eventName,
      occurredAt,
      installTime: getValue(row, ['install_time', 'install_time_selected_timezone']),
      mediaSource: getValue(row, ['media_source', 'pid', 'source']),
      campaign: getValue(row, ['campaign', 'campaign_name', 'c']),
      fallback: identity || occurredAt ? '' : fallback,
    })
  );
}

async function filterNewRows(db: any, rows: Array<{ row: NormalizedRow; report: ReportConfig; rawRowId: string }>) {
  const uniqueRows = new Map<string, { row: NormalizedRow; report: ReportConfig; rawRowId: string }>();
  rows.forEach((row) => {
    if (!uniqueRows.has(row.rawRowId)) uniqueRows.set(row.rawRowId, row);
  });

  const deduped = Array.from(uniqueRows.values());
  const newRows: Array<{ row: NormalizedRow; report: ReportConfig; rawRowId: string }> = [];
  for (let i = 0; i < deduped.length; i += 300) {
    const chunk = deduped.slice(i, i + 300);
    const refs = chunk.map((row) => db.collection(RAW_ROW_COLLECTION).doc(row.rawRowId));
    const snaps = refs.length ? await db.getAll(...refs) : [];
    snaps.forEach((snap: any, index: number) => {
      if (!snap.exists) newRows.push(chunk[index]);
    });
  }

  return {
    newRows,
    duplicateRows: rows.length - newRows.length,
  };
}

function pickLatestDateString(...values: unknown[]): string {
  let latest = '';
  let latestMs = 0;
  values.forEach((value) => {
    const text = normalizeString(value);
    if (!text) return;
    const parsed = Date.parse(text);
    const ms = Number.isFinite(parsed) ? parsed : 0;
    if (!latest || ms >= latestMs) {
      latest = text;
      latestMs = ms;
    }
  });
  return latest;
}

function pickEarliestDateString(...values: unknown[]): string {
  let earliest = '';
  let earliestMs = 0;
  values.forEach((value) => {
    const text = normalizeString(value);
    if (!text) return;
    const parsed = Date.parse(text);
    const ms = Number.isFinite(parsed) ? parsed : 0;
    if (!earliest || (ms > 0 && (!earliestMs || ms < earliestMs))) {
      earliest = text;
      earliestMs = ms;
    }
  });
  return earliest;
}

async function commitInChunks(db: any, writes: Array<{ ref: any; data: Record<string, any> }>) {
  const FieldValue = admin.firestore.FieldValue;
  for (let i = 0; i < writes.length; i += 450) {
    const batch = db.batch();
    writes.slice(i, i + 450).forEach(({ ref, data }) => {
      batch.set(
        ref,
        {
          ...data,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();
  }
}

async function persistImport(args: {
  db: any;
  adminRequest: any;
  runId: string;
  summary: SummaryShape;
  aggregateByDocId: Map<string, AttributionAggregate>;
  source: string;
  rawRows?: Array<{ row: NormalizedRow; report: ReportConfig; rawRowId: string }>;
}) {
  const { db, adminRequest, runId, summary, aggregateByDocId, source, rawRows = [] } = args;
  const FieldValue = admin.firestore.FieldValue;
  const now = FieldValue.serverTimestamp();

  const rawRowWrites = rawRows.map(({ row, report, rawRowId }) => ({
    ref: db.collection(RAW_ROW_COLLECTION).doc(rawRowId),
    data: {
      id: rawRowId,
      product: 'macra',
      provider: 'appsflyer',
      source,
      reportKey: report.key,
      reportType: report.type,
      organic: report.organic,
      row,
      firstImportRunId: runId,
      importRunIds: FieldValue.arrayUnion(runId),
      createdAt: now,
    },
  }));

  await commitInChunks(db, rawRowWrites);

  const userWrites: Array<{ ref: any; data: Record<string, any> }> = [];
  for (const aggregate of aggregateByDocId.values()) {
    const ref = db.collection(USER_ATTRIBUTION_COLLECTION).doc(aggregate.docId);
    const snap = await ref.get();
    const existing = snap.exists ? snap.data() || {} : {};
    const eventCounts = mergeCountMaps(existing.eventCounts || {}, aggregate.eventCounts);
    const eventLatestAt = { ...(existing.eventLatestAt || {}) };
    Object.entries(aggregate.eventLatestAt || {}).forEach(([eventName, latestAt]) => {
      eventLatestAt[eventName] = pickLatestDateString(eventLatestAt[eventName], latestAt);
    });

    userWrites.push({
      ref,
      data: {
        product: 'macra',
        customerUserId: existing.customerUserId || aggregate.customerUserId || null,
        appsFlyerId: existing.appsFlyerId || aggregate.appsFlyerId || null,
        mediaSource: aggregate.mediaSource || existing.mediaSource || null,
        campaign: aggregate.campaign || existing.campaign || null,
        campaignId: aggregate.campaignId || existing.campaignId || null,
        adset: aggregate.adset || existing.adset || null,
        ad: aggregate.ad || existing.ad || null,
        isOrganic: existing.isOrganic === undefined || existing.isOrganic === null ? aggregate.isOrganic : Boolean(existing.isOrganic && aggregate.isOrganic),
        installTime: pickEarliestDateString(existing.installTime, aggregate.installTime) || null,
        latestEventTime: pickLatestDateString(existing.latestEventTime, aggregate.latestEventTime) || null,
        eventCounts,
        eventLatestAt,
        lastImportRunId: runId,
        lastImportedRange: { from: summary.from, to: summary.to },
        importRunIds: FieldValue.arrayUnion(runId),
      },
    });
  }

  await commitInChunks(db, userWrites);

  summary.importedUserDocs = aggregateByDocId.size;
  finalizeSummary(summary);

  const scoreboardRef = db.collection(SCOREBOARD_COLLECTION).doc(SCOREBOARD_DOC_ID);
  const scoreboardSnap = await scoreboardRef.get();
  const existingScoreboard = scoreboardSnap.exists ? scoreboardSnap.data() || {} : {};
  const cumulativeSummary = mergeSummaryTotals(existingScoreboard, summary);

  await db.collection(IMPORT_RUN_COLLECTION).doc(runId).set({
    id: runId,
    product: 'macra',
    provider: 'appsflyer',
    source,
    requestedBy: adminRequest.email || adminRequest.uid,
    requestedByUid: adminRequest.uid,
    requestedBySource: adminRequest.source,
    summary,
    createdAt: now,
    updatedAt: now,
  });

  await scoreboardRef.set(
    {
      id: SCOREBOARD_DOC_ID,
      product: 'macra',
      provider: 'appsflyer',
      source,
      latestRunId: runId,
      latestRunSummary: summary,
      ...cumulativeSummary,
      importedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  return cumulativeSummary;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const adminRequest = await verifyAdminRequest(event);
    if (!adminRequest) return json(401, { error: 'Admin authorization required' });

    const body = event.body ? JSON.parse(event.body) : {};
    const appId = normalizeString(body.appId || process.env.APPSFLYER_MACRA_APP_ID || process.env.MACRA_APPSFLYER_APP_ID || MACRA_APPSFLYER_APP_ID);
    if (body.mode === 'csv_upload' || Array.isArray(body.csvFiles)) {
      const csvFiles = Array.isArray(body.csvFiles) ? (body.csvFiles as UploadedCsvFile[]) : [];
      if (!csvFiles.length) {
        return json(400, { error: 'Upload at least one AppsFlyer CSV file.' });
      }

      const allRows: Array<{ row: NormalizedRow; report: ReportConfig; rawRowId: string }> = [];
      let minRowMs = 0;
      let maxRowMs = 0;

      csvFiles.forEach((file, index) => {
        const content = normalizeString(file.content);
        if (!content) return;
        const rows = parseCsv(content);
        const report = inferUploadedReport(file, rows, index);
        rows.forEach((row) => {
          const occurredAt = getValue(row, ['event_time', 'event_time_selected_timezone', 'install_time', 'install_time_selected_timezone']);
          const occurredMs = Date.parse(occurredAt);
          if (Number.isFinite(occurredMs)) {
            minRowMs = minRowMs ? Math.min(minRowMs, occurredMs) : occurredMs;
            maxRowMs = Math.max(maxRowMs, occurredMs);
          }
          allRows.push({ row, report, rawRowId: stableRawRowId(row, report) });
        });
      });

      if (!allRows.length) {
        return json(400, { error: 'No rows were found in the uploaded CSV file.' });
      }

      const { newRows, duplicateRows } = await filterNewRows(adminRequest.db, allRows);
      const summary = createSummary({
        appId,
        from: normalizeString(body.from) || (minRowMs ? formatDateParam(new Date(minRowMs)) : ''),
        to: normalizeString(body.to) || (maxRowMs ? formatDateParam(new Date(maxRowMs)) : formatDateParam(new Date())),
        daysBack: parseInteger(body.daysBack, 0),
        maximumRows: allRows.length,
        timezone: normalizeString(body.timezone) || 'csv_upload',
        importSource: 'csv_upload',
      });
      summary.duplicateRows = duplicateRows;

      const aggregateByDocId = new Map<string, AttributionAggregate>();
      for (const { row, report } of newRows) {
        summary.rows += 1;
        bump(summary.reports, report.key);
        addRowToSummary(summary, row, report);
        mergeAttributionRow({ aggregateByDocId, row, report });
      }

      const runId = `macra-appsflyer-csv-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const cumulativeSummary = await persistImport({
        db: adminRequest.db,
        adminRequest,
        runId,
        summary,
        aggregateByDocId,
        source: 'csv_upload',
        rawRows: newRows,
      });

      return json(200, {
        success: true,
        runId,
        summary,
        cumulativeSummary,
        uploadedRows: allRows.length,
        importedRows: newRows.length,
        duplicateRows,
      });
    }

    const tokenResolution = await resolveAppsFlyerToken();
    const token = tokenResolution.token;
    if (!token) {
      return json(500, {
        error: 'Missing AppsFlyer raw-data API token. Set APPSFLYER_RAW_DATA_API_TOKEN in Netlify env, or create a Google Secret Manager secret named APPSFLYER_RAW_DATA_API_TOKEN.',
        secretManagerErrors: tokenResolution.errors.slice(0, 3),
      });
    }

    const { from, to, daysBack } = resolveDateRange(body);
    const timezone = normalizeString(body.timezone) || '+00:00';
    const maximumRows = Math.max(1000, Math.min(1000000, parseInteger(body.maximumRows, DEFAULT_MAXIMUM_ROWS)));
    const reports = resolveReports(body);
    const runId = `macra-appsflyer-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const allRows: Array<{ row: NormalizedRow; report: ReportConfig; rawRowId: string }> = [];

    for (const report of reports) {
      const rows = await fetchAppsFlyerReport({ token, appId, report, from, to, maximumRows, timezone });
      rows.forEach((row) => {
        allRows.push({ row, report, rawRowId: stableRawRowId(row, report) });
      });
    }

    const { newRows, duplicateRows } = await filterNewRows(adminRequest.db, allRows);
    const summary = createSummary({
      appId,
      from,
      to,
      daysBack,
      maximumRows,
      timezone,
      tokenSource: tokenResolution.source,
      importSource: 'raw_data_pull_api_v2',
    });
    summary.duplicateRows = duplicateRows;
    const aggregateByDocId = new Map<string, AttributionAggregate>();

    for (const { row, report } of newRows) {
      summary.rows += 1;
      bump(summary.reports, report.key);
      addRowToSummary(summary, row, report);
      mergeAttributionRow({ aggregateByDocId, row, report });
    }

    const cumulativeSummary = await persistImport({
      db: adminRequest.db,
      adminRequest,
      runId,
      summary,
      aggregateByDocId,
      source: 'raw_data_pull_api_v2',
      rawRows: newRows,
    });

    return json(200, {
      success: true,
      runId,
      summary,
      cumulativeSummary,
      fetchedRows: allRows.length,
      importedRows: newRows.length,
      duplicateRows,
    });
  } catch (error: any) {
    console.error('[sync-macra-appsflyer-raw-data] Failed:', error);
    return json(500, { error: error?.message || 'Failed to sync AppsFlyer raw data' });
  }
};
