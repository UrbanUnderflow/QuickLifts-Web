import type { Handler } from '@netlify/functions';
import crypto from 'crypto';

const firebaseConfig = require('./config/firebase') as any;

const { admin, headers, getFirebaseAdminApp, initializeFirebaseAdmin } = firebaseConfig;

const APPSFLYER_BASE_URL = 'https://hq1.appsflyer.com/api/raw-data/export/app';
const MACRA_APPSFLYER_APP_ID = 'id6463771067';
const SCOREBOARD_COLLECTION = 'appsflyer-scoreboards';
const SCOREBOARD_DOC_ID = 'macra';
const USER_ATTRIBUTION_COLLECTION = 'appsflyer-macra-users';
const IMPORT_RUN_COLLECTION = 'appsflyer-import-runs';
const DEFAULT_DAYS_BACK = 7;
const DEFAULT_MAXIMUM_ROWS = 50000;
const MAX_DAYS_BACK = 31;

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

type NormalizedRow = Record<string, string>;

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

const topEntries = (record: Record<string, number>, limit = 8) =>
  Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));

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
    const token = normalizeString(process.env.APPSFLYER_RAW_DATA_API_TOKEN || process.env.APPSFLYER_API_TOKEN_V2 || process.env.APPSFLYER_API_TOKEN);
    const appId = normalizeString(body.appId || process.env.APPSFLYER_MACRA_APP_ID || process.env.MACRA_APPSFLYER_APP_ID || MACRA_APPSFLYER_APP_ID);
    if (!token) return json(500, { error: 'Missing APPSFLYER_RAW_DATA_API_TOKEN or APPSFLYER_API_TOKEN_V2 in Netlify env.' });

    const { from, to, daysBack } = resolveDateRange(body);
    const timezone = normalizeString(body.timezone) || '+00:00';
    const maximumRows = Math.max(1000, Math.min(1000000, parseInteger(body.maximumRows, DEFAULT_MAXIMUM_ROWS)));
    const reports = resolveReports(body);
    const runId = `macra-appsflyer-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const summary = {
      appId,
      from,
      to,
      daysBack,
      maximumRows,
      timezone,
      rows: 0,
      reports: {} as Record<string, number>,
      installs: {
        total: 0,
        organic: 0,
        nonOrganic: 0,
        byMediaSource: {} as Record<string, number>,
        byCampaign: {} as Record<string, number>,
      },
      events: {
        total: 0,
        byName: {} as Record<string, number>,
        byMediaSource: {} as Record<string, number>,
      },
      matchedCustomerUserRows: 0,
      unmatchedRows: 0,
      importedUserDocs: 0,
      topMediaSources: [] as Array<{ label: string; count: number }>,
      topCampaigns: [] as Array<{ label: string; count: number }>,
      topEvents: [] as Array<{ label: string; count: number }>,
    };
    const aggregateByDocId = new Map<string, AttributionAggregate>();

    for (const report of reports) {
      const rows = await fetchAppsFlyerReport({ token, appId, report, from, to, maximumRows, timezone });
      summary.reports[report.key] = rows.length;
      summary.rows += rows.length;

      for (const row of rows) {
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

        mergeAttributionRow({ aggregateByDocId, row, report });
      }
    }

    summary.importedUserDocs = aggregateByDocId.size;
    summary.topMediaSources = topEntries(summary.installs.byMediaSource);
    summary.topCampaigns = topEntries(summary.installs.byCampaign);
    summary.topEvents = topEntries(summary.events.byName);

    const db = adminRequest.db;
    const FieldValue = admin.firestore.FieldValue;
    const now = FieldValue.serverTimestamp();
    const userWrites = Array.from(aggregateByDocId.values()).map((aggregate) => ({
      ref: db.collection(USER_ATTRIBUTION_COLLECTION).doc(aggregate.docId),
      data: {
        product: 'macra',
        customerUserId: aggregate.customerUserId || null,
        appsFlyerId: aggregate.appsFlyerId || null,
        mediaSource: aggregate.mediaSource || null,
        campaign: aggregate.campaign || null,
        campaignId: aggregate.campaignId || null,
        adset: aggregate.adset || null,
        ad: aggregate.ad || null,
        isOrganic: aggregate.isOrganic,
        installTime: aggregate.installTime || null,
        latestEventTime: aggregate.latestEventTime || null,
        eventCounts: aggregate.eventCounts,
        eventLatestAt: aggregate.eventLatestAt,
        lastImportRunId: runId,
        lastImportedRange: { from, to },
        importRunIds: FieldValue.arrayUnion(runId),
      },
    }));

    await commitInChunks(db, userWrites);
    await db.collection(IMPORT_RUN_COLLECTION).doc(runId).set({
      id: runId,
      product: 'macra',
      provider: 'appsflyer',
      requestedBy: adminRequest.email || adminRequest.uid,
      requestedByUid: adminRequest.uid,
      requestedBySource: adminRequest.source,
      summary,
      createdAt: now,
      updatedAt: now,
    });
    await db.collection(SCOREBOARD_COLLECTION).doc(SCOREBOARD_DOC_ID).set(
      {
        id: SCOREBOARD_DOC_ID,
        product: 'macra',
        provider: 'appsflyer',
        source: 'raw_data_pull_api_v2',
        latestRunId: runId,
        ...summary,
        importedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    return json(200, { success: true, runId, summary });
  } catch (error: any) {
    console.error('[sync-macra-appsflyer-raw-data] Failed:', error);
    return json(500, { error: error?.message || 'Failed to sync AppsFlyer raw data' });
  }
};
