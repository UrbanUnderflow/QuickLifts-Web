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
const AGGREGATE_PERIOD_COLLECTION = 'appsflyer-aggregate-periods';
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
const MACRA_TRIAL_EVENT_NAMES = ['af_start_trial', 'start_trial', 'trial_started', 'macra_trial_started'];

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
  lastModified?: number;
  reportType?: ReportType;
  organic?: boolean;
};

type NormalizedRow = Record<string, string>;

type AggregateCsvPeriod = {
  docId: string;
  preset: string;
  periodStart: string;
  periodEnd: string;
  source?: string;
};

type AggregatePeriodSnapshot = {
  id: string;
  periodStart: string;
  periodEnd: string;
  importedAt?: unknown;
  updatedAt?: unknown;
  summary?: SummaryShape;
  excludedFromRangeRollups?: boolean;
  supersededBy?: string;
  aggregateFingerprint?: string;
};

type AggregatePeriodImport = {
  period: AggregateCsvPeriod;
  summary: SummaryShape;
  uploadedRows: number;
};

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
  revenue: {
    total: number;
    byEventName: Record<string, number>;
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

const parseReportNumber = (value: unknown): number => {
  const cleaned = normalizeString(value).replace(/[$,%]/g, '').replace(/,/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDateOnly = (value: unknown): string => {
  const text = normalizeString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text ? text : '';
};

const dateOnlyFromMs = (millis: number): string =>
  Number.isFinite(millis) && millis > 0 ? new Date(millis).toISOString().slice(0, 10) : '';

const shiftDateOnly = (dateOnly: string, days: number): string => {
  const baseMs = Date.parse(`${dateOnly}T00:00:00.000Z`);
  if (!Number.isFinite(baseMs)) return '';
  return new Date(baseMs + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

const dateOnlyTokensFromText = (value: unknown): string[] => {
  const text = normalizeString(value);
  if (!text) return [];
  const tokens: string[] = [];
  const pushToken = (year: number, month: number, day: number) => {
    const dateOnly = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (normalizeDateOnly(dateOnly)) tokens.push(dateOnly);
  };

  for (const match of text.matchAll(/\b(20\d{2})[-_/ .](\d{1,2})[-_/ .](\d{1,2})\b/g)) {
    pushToken(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  for (const match of text.matchAll(/\b(\d{1,2})[-_/ .](\d{1,2})[-_/ .](20\d{2})\b/g)) {
    pushToken(Number(match[3]), Number(match[1]), Number(match[2]));
  }

  return Array.from(new Set(tokens)).sort();
};

const dateOnlyFromText = (value: unknown): string => {
  const text = normalizeString(value);
  if (!text) return '';

  const direct = normalizeDateOnly(text);
  if (direct) return direct;

  const token = dateOnlyTokensFromText(text)[0];
  if (token) return token;

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : '';
};

const aggregateRowDateOnly = (row: NormalizedRow): string =>
  dateOnlyFromText(
    getValue(row, [
      'date',
      'day',
      'event_date',
      'install_date',
      'event_time',
      'event_time_selected_timezone',
      'install_time',
      'install_time_selected_timezone',
    ])
  );

const resolveAggregateCsvPeriod = (args: {
  body: Record<string, any>;
  csvFiles: UploadedCsvFile[];
  minRowMs: number;
  maxRowMs: number;
}): AggregateCsvPeriod => {
  const rowStart = dateOnlyFromMs(args.minRowMs);
  const rowEnd = dateOnlyFromMs(args.maxRowMs);
  if (rowStart && rowEnd) {
    return {
      docId: `macra_${rowStart}_${rowEnd}`,
      preset: normalizeString(args.body.csvPeriodPreset || args.body.periodPreset || 'auto_row_dates') || 'auto_row_dates',
      periodStart: rowStart <= rowEnd ? rowStart : rowEnd,
      periodEnd: rowStart <= rowEnd ? rowEnd : rowStart,
      source: 'row_dates',
    };
  }

  const fileDateTokens = args.csvFiles.flatMap((file) => dateOnlyTokensFromText(file.name));
  const uniqueFileDates = Array.from(new Set(fileDateTokens)).sort();
  if (uniqueFileDates.length > 1) {
    const periodStart = uniqueFileDates[0];
    const periodEnd = uniqueFileDates[uniqueFileDates.length - 1];
    return {
      docId: `macra_${periodStart}_${periodEnd}`,
      preset: normalizeString(args.body.csvPeriodPreset || args.body.periodPreset || 'auto_file_name_dates') || 'auto_file_name_dates',
      periodStart,
      periodEnd,
      source: 'file_name_dates',
    };
  }

  const requestedStart = normalizeDateOnly(args.body.csvPeriodStart || args.body.periodStart || args.body.fromDate);
  const requestedEnd = normalizeDateOnly(args.body.csvPeriodEnd || args.body.periodEnd || args.body.toDate);
  if (requestedStart && requestedEnd) {
    return {
      docId: `macra_${requestedStart}_${requestedEnd}`,
      preset: normalizeString(args.body.csvPeriodPreset || args.body.periodPreset || 'request_fallback') || 'request_fallback',
      periodStart: requestedStart,
      periodEnd: requestedEnd,
      source: 'request_fallback',
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const periodStart = normalizeDateOnly(args.body.clientYesterday || args.body.csvDefaultDate) || shiftDateOnly(today, -1);
  return {
    docId: `macra_${periodStart}_${periodStart}`,
    preset: 'auto_yesterday_upload',
    periodStart,
    periodEnd: periodStart,
    source: 'auto_yesterday',
  };
};

const daysBetweenInclusive = (start: string, end: string): number => {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0;
  return Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
};

const dateOnlyRange = (start: string, end: string): string[] => {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return [];

  const days = Math.min(366, Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1);
  return Array.from({ length: days }, (_value, index) => new Date(startMs + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
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

const hasNormalizedColumn = (row: NormalizedRow, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(row, key);

const isAggregatedPerformanceRow = (row: NormalizedRow): boolean =>
  hasNormalizedColumn(row, 'in_apps_events') && hasNormalizedColumn(row, 'number_of_actions');

const isAggregatedPerformanceReport = (rows: NormalizedRow[]): boolean =>
  rows.some(isAggregatedPerformanceRow);

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
  revenue: {
    total: 0,
    byEventName: {},
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
  const aggregateEventName = getValue(row, ['in_apps_events']);
  const revenue = parseReportNumber(getValue(row, ['revenue', 'event_revenue', 'af_revenue']));
  const addRevenue = (eventName: string) => {
    if (!revenue) return;
    summary.revenue.total += revenue;
    bump(summary.revenue.byEventName, eventName || 'unknown_event', revenue);
    bump(summary.revenue.byMediaSource, mediaSource, revenue);
  };

  if (report.type === 'event' && isAggregatedPerformanceRow(row)) {
    if (!aggregateEventName) return;

    const actionCount = Math.max(0, Math.round(parseReportNumber(row.number_of_actions)));
    if (!actionCount) return;

    summary.events.total += actionCount;
    bump(summary.events.byName, aggregateEventName, actionCount);
    bump(summary.events.byMediaSource, mediaSource, actionCount);
    addRevenue(aggregateEventName);
    return;
  }

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
    addRevenue(eventName);
  }
};

const rowDateSourceLabel = (period: AggregateCsvPeriod, hasRowDates: boolean): string => {
  if (hasRowDates) return 'row_dates_daily';
  if (period.periodStart === period.periodEnd) return 'single_day_request_daily';
  return period.source || 'request_fallback';
};

const buildAggregatePeriodImports = (args: {
  appId: string;
  rows: Array<{ row: NormalizedRow; report: ReportConfig; rawRowId: string }>;
  period: AggregateCsvPeriod;
  fallbackSummary: SummaryShape;
}): { periodImports: AggregatePeriodImport[]; dateGranularity: 'daily' | 'period'; datedRows: number } => {
  const periodDayCount = daysBetweenInclusive(args.period.periodStart, args.period.periodEnd);
  const summariesByDate = new Map<string, SummaryShape>();
  const uploadedRowsByDate = new Map<string, number>();
  let datedRows = 0;

  args.rows.forEach(({ row, report }) => {
    const rowDate = aggregateRowDateOnly(row);
    if (rowDate) datedRows += 1;

    const targetDate = rowDate || (periodDayCount === 1 ? args.period.periodStart : '');
    if (!targetDate) return;

    const summary =
      summariesByDate.get(targetDate) ||
      createSummary({
        appId: args.appId,
        from: targetDate,
        to: targetDate,
        daysBack: 1,
        maximumRows: 0,
        timezone: 'aggregate_csv_day',
        importSource: 'aggregate_csv_upload',
      });

    summary.rows += 1;
    summary.maximumRows += 1;
    bump(summary.reports, report.key);
    addRowToSummary(summary, row, report);
    summariesByDate.set(targetDate, summary);
    uploadedRowsByDate.set(targetDate, (uploadedRowsByDate.get(targetDate) || 0) + 1);
  });

  if (summariesByDate.size) {
    return {
      periodImports: Array.from(summariesByDate.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, summary]) => ({
          period: {
            docId: `macra_${date}_${date}`,
            preset: args.period.preset,
            periodStart: date,
            periodEnd: date,
            source: rowDateSourceLabel(args.period, datedRows > 0),
          },
          summary: finalizeSummary(summary),
          uploadedRows: uploadedRowsByDate.get(date) || summary.rows,
        })),
      dateGranularity: 'daily',
      datedRows,
    };
  }

  return {
    periodImports: [
      {
        period: args.period,
        summary: args.fallbackSummary,
        uploadedRows: args.rows.length,
      },
    ],
    dateGranularity: 'period',
    datedRows,
  };
};

const finalizeSummary = (summary: SummaryShape) => {
  summary.topMediaSources = topEntries(
    summary.installs.total ? summary.installs.byMediaSource : summary.events.byMediaSource
  );
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
  merged.revenue.total = (Number(existing.revenue?.total || 0) || 0) + (Number(delta.revenue?.total || 0) || 0);
  merged.revenue.byEventName = mergeCountMaps(existing.revenue?.byEventName || {}, delta.revenue?.byEventName || {});
  merged.revenue.byMediaSource = mergeCountMaps(existing.revenue?.byMediaSource || {}, delta.revenue?.byMediaSource || {});
  merged.matchedCustomerUserRows = (Number(existing.matchedCustomerUserRows || 0) || 0) + delta.matchedCustomerUserRows;
  merged.unmatchedRows = (Number(existing.unmatchedRows || 0) || 0) + delta.unmatchedRows;
  merged.importedUserDocs = Math.max(Number(existing.importedUserDocs || 0) || 0, delta.importedUserDocs);

  return finalizeSummary(merged);
};

const summaryHasData = (summary: Record<string, any> | null | undefined): boolean =>
  Boolean(
    summary &&
      ((Number(summary.rows || 0) || 0) > 0 ||
        (Number(summary.installs?.total || 0) || 0) > 0 ||
        (Number(summary.events?.total || 0) || 0) > 0)
  );

const cloneSummary = (summary: Record<string, any> | null | undefined): SummaryShape | null =>
  summaryHasData(summary) ? mergeSummaryTotals({}, summary as SummaryShape) : null;

const summaryEventCount = (summary: Record<string, any> | null | undefined, eventNames: string[]): number =>
  eventNames.reduce((total, eventName) => total + (Number(summary?.events?.byName?.[eventName] || 0) || 0), 0);

const getRawCumulativeSummary = (scoreboard: Record<string, any>): SummaryShape | null => {
  const explicitRaw = cloneSummary(scoreboard.rawCumulativeSummary);
  if (explicitRaw) return explicitRaw;
  if (scoreboard.aggregateCsvSummary || looksLikeLegacyAggregateCsvInstallImport(scoreboard)) return null;
  return cloneSummary(scoreboard);
};

const mergeSummaryList = (summaries: SummaryShape[], seed: {
  appId: string;
  importSource: string;
  timezone: string;
}): SummaryShape => {
  let merged = createSummary({
    appId: seed.appId,
    from: '',
    to: '',
    daysBack: 0,
    maximumRows: 0,
    timezone: seed.timezone,
    importSource: seed.importSource,
  });

  summaries.forEach((summary) => {
    merged = mergeSummaryTotals(merged, summary);
  });

  const fromValues = summaries.map((summary) => normalizeString(summary.from)).filter(Boolean).sort();
  const toValues = summaries.map((summary) => normalizeString(summary.to)).filter(Boolean).sort();
  merged.from = fromValues[0] || '';
  merged.to = toValues[toValues.length - 1] || '';
  merged.daysBack = merged.from && merged.to ? daysBetweenInclusive(merged.from.slice(0, 10), merged.to.slice(0, 10)) : merged.daysBack;
  merged.importSource = seed.importSource;
  merged.timezone = seed.timezone;

  return finalizeSummary(merged);
};

const buildLayeredScoreboardSummary = (args: {
  appId: string;
  rawSummary: Record<string, any> | null | undefined;
  aggregateSummary: Record<string, any> | null | undefined;
}): SummaryShape => {
  const rawSummary = cloneSummary(args.rawSummary);
  const aggregateSummary = cloneSummary(args.aggregateSummary);

  if (!rawSummary && aggregateSummary) return aggregateSummary;
  if (rawSummary && !aggregateSummary) return rawSummary;
  if (!rawSummary && !aggregateSummary) {
    return createSummary({
      appId: args.appId,
      from: '',
      to: '',
      daysBack: 0,
      maximumRows: 0,
      timezone: '',
      importSource: 'empty',
    });
  }

  const raw = rawSummary as SummaryShape;
  const aggregate = aggregateSummary as SummaryShape;
  const fromValues = [normalizeString(raw.from), normalizeString(aggregate.from)].filter(Boolean).sort();
  const toValues = [normalizeString(raw.to), normalizeString(aggregate.to)].filter(Boolean).sort();
  const merged = createSummary({
    appId: args.appId,
    from: fromValues[0] || '',
    to: toValues[toValues.length - 1] || '',
    daysBack: Math.max(Number(raw.daysBack || 0), Number(aggregate.daysBack || 0)),
    maximumRows: (Number(raw.maximumRows || 0) || 0) + (Number(aggregate.maximumRows || 0) || 0),
    timezone: 'mixed',
    tokenSource: raw.tokenSource,
    importSource: 'layered_raw_and_aggregate_csv',
  });

  merged.rows = (Number(raw.rows || 0) || 0) + (Number(aggregate.rows || 0) || 0);
  merged.duplicateRows = (Number(raw.duplicateRows || 0) || 0) + (Number(aggregate.duplicateRows || 0) || 0);
  merged.reports = mergeCountMaps(raw.reports || {}, aggregate.reports || {});
  merged.installs = {
    total: Number(raw.installs?.total || 0) || 0,
    organic: Number(raw.installs?.organic || 0) || 0,
    nonOrganic: Number(raw.installs?.nonOrganic || 0) || 0,
    byMediaSource: { ...(raw.installs?.byMediaSource || {}) },
    byCampaign: { ...(raw.installs?.byCampaign || {}) },
  };
  merged.events = {
    total: Number(aggregate.events?.total || 0) || 0,
    byName: { ...(aggregate.events?.byName || {}) },
    byMediaSource: { ...(aggregate.events?.byMediaSource || {}) },
  };
  merged.revenue = {
    total: Number(aggregate.revenue?.total || 0) || 0,
    byEventName: { ...(aggregate.revenue?.byEventName || {}) },
    byMediaSource: { ...(aggregate.revenue?.byMediaSource || {}) },
  };
  merged.matchedCustomerUserRows = Number(raw.matchedCustomerUserRows || 0) || 0;
  merged.unmatchedRows = Number(raw.unmatchedRows || 0) || 0;
  merged.importedUserDocs = Number(raw.importedUserDocs || 0) || 0;

  return finalizeSummary(merged);
};

const looksLikeLegacyAggregateCsvInstallImport = (scoreboard: Record<string, any>): boolean => {
  const installTotal = Number(scoreboard.installs?.total || 0) || 0;
  const eventTotal = Number(scoreboard.events?.total || 0) || 0;
  const rowTotal = Number(scoreboard.rows || 0) || 0;
  const reports = Object.keys(scoreboard.reports || {});
  const source = normalizeString(scoreboard.source || scoreboard.importSource || scoreboard.latestRunSummary?.importSource);

  return (
    source === 'csv_upload' &&
    installTotal > 0 &&
    eventTotal === 0 &&
    rowTotal === installTotal &&
    reports.some((key) => key.startsWith('csv_')) &&
    !reports.some((key) => key.includes('_event_'))
  );
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
  const isAggregatePerformance = isAggregatedPerformanceReport(rows);
  const type: ReportType =
    file.reportType === 'install' || file.reportType === 'event'
      ? file.reportType
      : firstRow.event_name || firstRow.in_apps_events || isAggregatePerformance || name.includes('event') || name.includes('in_app')
        ? 'event'
        : 'install';
  const organic =
    typeof file.organic === 'boolean'
      ? file.organic
      : name.includes('organic') && !name.includes('non_organic') && !name.includes('non-organic') && !name.includes('non organic');
  const keyPrefix = organic ? 'organic' : 'non_organic';
  return {
    key: `csv_${isAggregatePerformance ? 'aggregate_' : ''}${keyPrefix}_${type}_${index + 1}`,
    path: 'csv_upload',
    type,
    organic,
  };
}

function stableRawRowId(row: NormalizedRow, report: ReportConfig, uploadKey = ''): string {
  const isAggregate = isAggregatedPerformanceRow(row);
  const eventName = report.type === 'event' ? getValue(row, ['event_name', 'in_apps_events']) || 'unknown_event' : '';
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
      uploadKey: isAggregate ? uploadKey : '',
      aggregateActionCount: isAggregate ? parseReportNumber(row.number_of_actions) : 0,
      aggregateUniqueUsers: isAggregate ? parseReportNumber(row.unique_users) : 0,
      fallback: identity || occurredAt ? '' : fallback,
    })
  );
}

const rawRowEventName = (row: NormalizedRow, report: ReportConfig): string =>
  report.type === 'event' ? getValue(row, ['event_name', 'in_apps_events']) || 'unknown_event' : '';

const rawRowMediaSource = (row: NormalizedRow, report: ReportConfig): string =>
  report.organic ? 'Organic' : getValue(row, ['media_source', 'pid', 'source']) || 'Unknown paid source';

const rawRowCampaign = (row: NormalizedRow): string => getValue(row, ['campaign', 'campaign_name', 'c']) || 'Unknown campaign';

const rawRowEventDate = (row: NormalizedRow): string => {
  const rowDate = aggregateRowDateOnly(row);
  if (rowDate) return rowDate;

  const occurredAt = getValue(row, ['event_time', 'event_time_selected_timezone', 'install_time', 'install_time_selected_timezone']);
  return dateOnlyFromText(occurredAt);
};

const rawRowEventTime = (row: NormalizedRow): string => {
  const occurredAt = getValue(row, ['event_time', 'event_time_selected_timezone', 'install_time', 'install_time_selected_timezone']);
  if (occurredAt) return occurredAt;

  const dateOnly = rawRowEventDate(row);
  return dateOnly ? `${dateOnly}T12:00:00.000Z` : '';
};

const rawRowActionCount = (row: NormalizedRow): number => {
  if (!isAggregatedPerformanceRow(row)) return 1;
  return Math.max(0, parseReportNumber(row.number_of_actions));
};

const stableAggregateRawRowId = (row: NormalizedRow, report: ReportConfig): string =>
  hashRowKey(
    JSON.stringify({
      source: 'aggregate_csv_upload',
      type: report.type,
      organic: report.organic,
      eventDate: rawRowEventDate(row),
      eventName: rawRowEventName(row, report),
      mediaSource: rawRowMediaSource(row, report),
      campaign: rawRowCampaign(row),
    })
  );

const rawRowMetadata = (row: NormalizedRow, report: ReportConfig): Record<string, any> => {
  const eventDate = rawRowEventDate(row);
  const eventTime = rawRowEventTime(row);
  const parsedEventTime = Date.parse(eventTime);
  const aggregatePerformance = isAggregatedPerformanceRow(row);
  const customerUserId = getValue(row, ['customer_user_id', 'customer_userid', 'customer_id', 'app_user_id']);
  const appsFlyerId = getValue(row, ['appsflyer_id', 'apps_flyer_id', 'af_id']);

  return {
    aggregatePerformance,
    eventName: rawRowEventName(row, report) || null,
    eventDate: eventDate || null,
    eventTime: eventTime || null,
    eventTimestampMs: Number.isFinite(parsedEventTime) ? parsedEventTime : null,
    actionCount: rawRowActionCount(row),
    uniqueUsers: aggregatePerformance ? Math.max(0, parseReportNumber(row.unique_users)) : 0,
    mediaSource: rawRowMediaSource(row, report),
    campaign: rawRowCampaign(row),
    campaignId: getValue(row, ['campaign_id', 'af_c_id']) || null,
    customerUserId: customerUserId || null,
    appsFlyerId: appsFlyerId || null,
  };
};

const aggregateDateMs = (dateOnly: string): number => {
  const ms = Date.parse(`${dateOnly}T00:00:00.000Z`);
  return Number.isFinite(ms) ? ms : 0;
};

const aggregatePeriodDays = (period: { periodStart: string; periodEnd: string }): number =>
  daysBetweenInclusive(period.periodStart, period.periodEnd) || 0;

const aggregatePeriodsOverlap = (
  left: { periodStart: string; periodEnd: string },
  right: { periodStart: string; periodEnd: string }
): boolean => {
  const leftStart = aggregateDateMs(left.periodStart);
  const leftEnd = aggregateDateMs(left.periodEnd);
  const rightStart = aggregateDateMs(right.periodStart);
  const rightEnd = aggregateDateMs(right.periodEnd);
  if (!leftStart || !leftEnd || !rightStart || !rightEnd) return false;
  return leftStart <= rightEnd && rightStart <= leftEnd;
};

const aggregateTimestampMs = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'object') {
    const candidate = value as { toMillis?: () => number; toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof candidate.toMillis === 'function') {
      const millis = candidate.toMillis();
      return Number.isFinite(millis) ? millis : 0;
    }
    if (typeof candidate.toDate === 'function') {
      const millis = candidate.toDate().getTime();
      return Number.isFinite(millis) ? millis : 0;
    }
    const seconds = Number(candidate.seconds ?? candidate._seconds ?? 0);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
  }
  return 0;
};

const aggregateImportMs = (snapshot: Pick<AggregatePeriodSnapshot, 'importedAt' | 'updatedAt'>): number => {
  return aggregateTimestampMs(snapshot.importedAt) || aggregateTimestampMs(snapshot.updatedAt);
};

const aggregateSummaryFingerprint = (summary: Record<string, any> | null | undefined): string => {
  const stableMap = (record: Record<string, any> | null | undefined) =>
    Object.entries(record || {})
      .map(([key, value]) => [key, Number(value || 0) || 0])
      .filter(([key, value]) => Boolean(key) && Number(value) !== 0)
      .sort(([a], [b]) => String(a).localeCompare(String(b)));

  return hashRowKey(
    JSON.stringify({
      rows: Number(summary?.rows || 0) || 0,
      eventsTotal: Number(summary?.events?.total || 0) || 0,
      installsTotal: Number(summary?.installs?.total || 0) || 0,
      reports: stableMap(summary?.reports),
      eventsByName: stableMap(summary?.events?.byName),
      eventsByMediaSource: stableMap(summary?.events?.byMediaSource),
      revenueTotal: Number(summary?.revenue?.total || 0) || 0,
      revenueByEventName: stableMap(summary?.revenue?.byEventName),
      revenueByMediaSource: stableMap(summary?.revenue?.byMediaSource),
      installsByMediaSource: stableMap(summary?.installs?.byMediaSource),
      installsByCampaign: stableMap(summary?.installs?.byCampaign),
    })
  );
};

const periodSnapshotFromFirestoreDoc = (snapshot: any): AggregatePeriodSnapshot | null => {
  const data = snapshot.data() || {};
  const periodStart = normalizeString(data.periodStart);
  const periodEnd = normalizeString(data.periodEnd);
  if (!periodStart || !periodEnd) return null;
  return {
    id: snapshot.id,
    periodStart,
    periodEnd,
    importedAt: data.importedAt || null,
    updatedAt: data.updatedAt || null,
    summary: data.summary,
    excludedFromRangeRollups: Boolean(data.excludedFromRangeRollups),
    supersededBy: normalizeString(data.supersededBy),
    aggregateFingerprint: normalizeString(data.aggregateFingerprint) || aggregateSummaryFingerprint(data.summary),
  };
};

const selectActiveAggregatePeriodSnapshots = (periods: AggregatePeriodSnapshot[]): AggregatePeriodSnapshot[] => {
  const candidates = periods
    .filter((period) => period.periodStart && period.periodEnd && summaryHasData(period.summary))
    .filter((period) => !period.excludedFromRangeRollups && !period.supersededBy)
    .sort((a, b) => {
      const spanDiff = aggregatePeriodDays(b) - aggregatePeriodDays(a);
      if (spanDiff) return spanDiff;
      const importedDiff = aggregateImportMs(b) - aggregateImportMs(a);
      if (importedDiff) return importedDiff;
      const eventsDiff = (Number(b.summary?.events?.total || 0) || 0) - (Number(a.summary?.events?.total || 0) || 0);
      if (eventsDiff) return eventsDiff;
      return a.id.localeCompare(b.id);
    });

  const selected: AggregatePeriodSnapshot[] = [];
  candidates.forEach((candidate) => {
    if (!selected.some((existing) => aggregatePeriodsOverlap(existing, candidate))) {
      selected.push(candidate);
    }
  });

  return selected.sort((a, b) => a.periodStart.localeCompare(b.periodStart));
};

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
      ...rawRowMetadata(row, report),
      row,
      firstImportRunId: runId,
      lastImportRunId: runId,
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
  const existingScoreboardRaw = scoreboardSnap.exists ? scoreboardSnap.data() || {} : {};
  const resetLegacyAggregateCsvImport =
    source === 'csv_upload' && looksLikeLegacyAggregateCsvInstallImport(existingScoreboardRaw);
  const existingScoreboard = resetLegacyAggregateCsvImport ? {} : existingScoreboardRaw;
  const existingRawSummary = getRawCumulativeSummary(existingScoreboard);
  const rawCumulativeSummary = mergeSummaryTotals(existingRawSummary || {}, summary);
  const aggregateCsvSummary = cloneSummary(existingScoreboard.aggregateCsvSummary);
  const cumulativeSummary = buildLayeredScoreboardSummary({
    appId: summary.appId,
    rawSummary: rawCumulativeSummary,
    aggregateSummary: aggregateCsvSummary,
  });

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
      rawCumulativeSummary,
      aggregateCsvSummary: aggregateCsvSummary || null,
      legacyAggregateCsvInstallImportResetAt: resetLegacyAggregateCsvImport ? now : existingScoreboardRaw.legacyAggregateCsvInstallImportResetAt || null,
      importedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  return cumulativeSummary;
}

async function persistRawRowsOnly(args: {
  db: any;
  runId: string;
  source: string;
  rawRows: Array<{ row: NormalizedRow; report: ReportConfig; rawRowId: string }>;
  replaceDates?: string[];
}) {
  const { db, runId, source, rawRows, replaceDates = [] } = args;
  const FieldValue = admin.firestore.FieldValue;
  const now = FieldValue.serverTimestamp();
  const incomingRawRowIds = new Set(rawRows.map((rawRow) => rawRow.rawRowId));
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
      ...rawRowMetadata(row, report),
      excludedFromRangeRollups: false,
      supersededBy: null,
      row,
      firstImportRunId: runId,
      lastImportRunId: runId,
      importRunIds: FieldValue.arrayUnion(runId),
      createdAt: now,
    },
  }));

  await commitInChunks(db, rawRowWrites);

  let retiredRawRows = 0;
  for (const dateOnly of Array.from(new Set(replaceDates)).filter(Boolean)) {
    const existingForDateSnap = await db.collection(RAW_ROW_COLLECTION).where('eventDate', '==', dateOnly).get();
    const staleWrites = existingForDateSnap.docs
      .filter((snapshot: any) => !incomingRawRowIds.has(snapshot.id))
      .filter((snapshot: any) => {
        const data = snapshot.data() || {};
        return data.product === 'macra' && data.source === source && !data.excludedFromRangeRollups;
      })
      .map((snapshot: any) => ({
        ref: snapshot.ref,
        data: {
          excludedFromRangeRollups: true,
          supersededBy: runId,
          retiredAt: now,
        },
      }));
    retiredRawRows += staleWrites.length;
    await commitInChunks(db, staleWrites);
  }

  return {
    persistedRawRows: rawRows.length,
    retiredRawRows,
  };
}

async function persistAggregateCsvPeriodImport(args: {
  db: any;
  adminRequest: any;
  runId: string;
  summary: SummaryShape;
  period: AggregateCsvPeriod;
  periodImports: AggregatePeriodImport[];
  sourceFiles: Array<Record<string, any>>;
  uploadedRows: number;
  dateGranularity: 'daily' | 'period';
}) {
  const { db, adminRequest, runId, summary, period, periodImports, sourceFiles, uploadedRows, dateGranularity } = args;
  const FieldValue = admin.firestore.FieldValue;
  const now = FieldValue.serverTimestamp();

  finalizeSummary(summary);
  const runAggregateFingerprint = aggregateSummaryFingerprint(summary);
  const existingPeriodDocsSnap = await db.collection(AGGREGATE_PERIOD_COLLECTION).where('product', '==', 'macra').get();
  const existingPeriodSnapshots = existingPeriodDocsSnap.docs
    .map(periodSnapshotFromFirestoreDoc)
    .filter(Boolean) as AggregatePeriodSnapshot[];
  const importedDocIds = new Set(periodImports.map((periodImport) => periodImport.period.docId));
  const importedDailyDates = new Set(
    periodImports
      .map((periodImport) => periodImport.period)
      .filter((periodImport) => periodImport.periodStart === periodImport.periodEnd)
      .map((periodImport) => periodImport.periodStart)
  );
  const supersededPeriodIds = existingPeriodSnapshots
    .filter((snapshot) => !importedDocIds.has(snapshot.id))
    .filter((snapshot) => !snapshot.excludedFromRangeRollups && !snapshot.supersededBy)
    .filter((snapshot) => periodImports.some((periodImport) => aggregatePeriodsOverlap(snapshot, periodImport.period)))
    .filter((snapshot) => {
      const sameAggregateData = snapshot.aggregateFingerprint && snapshot.aggregateFingerprint === runAggregateFingerprint;
      const dailyImportFullyCoversSnapshot =
        importedDailyDates.size > 0 &&
        aggregatePeriodDays(snapshot) > 1 &&
        dateOnlyRange(snapshot.periodStart, snapshot.periodEnd).every((date) => importedDailyDates.has(date));
      return sameAggregateData || dailyImportFullyCoversSnapshot;
    })
    .map((snapshot) => snapshot.id);
  const supersededById = periodImports.length === 1 ? periodImports[0].period.docId : runId;

  for (const periodImport of periodImports) {
    finalizeSummary(periodImport.summary);
    const periodRef = db.collection(AGGREGATE_PERIOD_COLLECTION).doc(periodImport.period.docId);
    const periodSnap = await periodRef.get();
    await periodRef.set(
      {
        id: periodImport.period.docId,
        product: 'macra',
        provider: 'appsflyer',
        source: 'csv_upload',
        importSource: 'aggregate_csv_upload',
        periodPreset: periodImport.period.preset,
        periodSource: periodImport.period.source || 'request_fallback',
        periodStart: periodImport.period.periodStart,
        periodEnd: periodImport.period.periodEnd,
        periodGranularity: periodImport.period.periodStart === periodImport.period.periodEnd ? 'daily' : 'range',
        sourcePeriodStart: period.periodStart,
        sourcePeriodEnd: period.periodEnd,
        latestRunId: runId,
        summary: periodImport.summary,
        aggregateFingerprint: aggregateSummaryFingerprint(periodImport.summary),
        sourceFiles,
        uploadedRows: periodImport.uploadedRows,
        trialStarts: summaryEventCount(periodImport.summary, MACRA_TRIAL_EVENT_NAMES),
        supersedes: supersededPeriodIds,
        supersededBy: null,
        excludedFromRangeRollups: false,
        firstImportedAt: periodSnap.exists ? periodSnap.data()?.firstImportedAt || now : now,
        importedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  if (supersededPeriodIds.length) {
    const batch = db.batch();
    supersededPeriodIds.forEach((periodId) => {
      batch.set(
        db.collection(AGGREGATE_PERIOD_COLLECTION).doc(periodId),
        {
          supersededBy: supersededById,
          supersededAt: now,
          excludedFromRangeRollups: true,
          updatedAt: now,
        },
        { merge: true }
      );
    });
    await batch.commit();
  }

  await db.collection(IMPORT_RUN_COLLECTION).doc(runId).set({
    id: runId,
    product: 'macra',
    provider: 'appsflyer',
    source: 'csv_upload',
    importSource: 'aggregate_csv_upload',
    requestedBy: adminRequest.email || adminRequest.uid,
    requestedByUid: adminRequest.uid,
    requestedBySource: adminRequest.source,
    aggregatePeriod: period,
    aggregatePeriods: periodImports.map((periodImport) => ({
      id: periodImport.period.docId,
      periodStart: periodImport.period.periodStart,
      periodEnd: periodImport.period.periodEnd,
      granularity: periodImport.period.periodStart === periodImport.period.periodEnd ? 'daily' : 'range',
      rows: periodImport.summary.rows,
      events: periodImport.summary.events.total,
      installs: periodImport.summary.installs.total,
    })),
    dateGranularity,
    uploadedRows,
    summary,
    createdAt: now,
    updatedAt: now,
  });

  const periodDocsSnap = await db.collection(AGGREGATE_PERIOD_COLLECTION).where('product', '==', 'macra').get();
  const activePeriodSnapshots = selectActiveAggregatePeriodSnapshots(
    periodDocsSnap.docs.map(periodSnapshotFromFirestoreDoc).filter(Boolean) as AggregatePeriodSnapshot[]
  );
  const aggregateCsvPeriods = activePeriodSnapshots
    .map((snapshot) => {
      const periodSummary = snapshot.summary || {};
      return {
        id: snapshot.id,
        periodStart: snapshot.periodStart,
        periodEnd: snapshot.periodEnd,
        rows: Number(periodSummary.rows || 0) || 0,
        events: Number(periodSummary.events?.total || 0) || 0,
        installs: Number(periodSummary.installs?.total || 0) || 0,
        trialStarts: summaryEventCount(periodSummary, MACRA_TRIAL_EVENT_NAMES),
        granularity: snapshot.periodStart === snapshot.periodEnd ? 'daily' : 'range',
        importedAt: snapshot.importedAt || snapshot.updatedAt || null,
      };
    })
    .sort((a: any, b: any) => a.periodStart.localeCompare(b.periodStart));

  const periodSummaries = activePeriodSnapshots
    .map((snapshot) => snapshot.summary)
    .filter(summaryHasData)
    .map((periodSummary: Record<string, any>) => mergeSummaryTotals({}, periodSummary as SummaryShape));
  const aggregateCsvSummary = mergeSummaryList(periodSummaries, {
    appId: summary.appId,
    importSource: 'aggregate_csv_upload',
    timezone: 'aggregate_csv_periods',
  });

  const scoreboardRef = db.collection(SCOREBOARD_COLLECTION).doc(SCOREBOARD_DOC_ID);
  const scoreboardSnap = await scoreboardRef.get();
  const existingScoreboardRaw = scoreboardSnap.exists ? scoreboardSnap.data() || {} : {};
  const rawCumulativeSummary = getRawCumulativeSummary(existingScoreboardRaw);
  const cumulativeSummary = buildLayeredScoreboardSummary({
    appId: summary.appId,
    rawSummary: rawCumulativeSummary,
    aggregateSummary: aggregateCsvSummary,
  });

  await scoreboardRef.set(
    {
      id: SCOREBOARD_DOC_ID,
      product: 'macra',
      provider: 'appsflyer',
      source: 'csv_upload',
      latestRunId: runId,
      latestRunSummary: summary,
      ...cumulativeSummary,
      rawCumulativeSummary: rawCumulativeSummary || null,
      aggregateCsvSummary,
      aggregateCsvPeriods,
      aggregateCsvPeriodCount: aggregateCsvPeriods.length,
      aggregateCsvCoverageStart: aggregateCsvSummary.from || null,
      aggregateCsvCoverageEnd: aggregateCsvSummary.to || null,
      aggregateCsvDateGranularity: dateGranularity,
      legacyAggregateCsvInstallImportResetAt: looksLikeLegacyAggregateCsvInstallImport(existingScoreboardRaw)
        ? now
        : existingScoreboardRaw.legacyAggregateCsvInstallImportResetAt || null,
      importedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    cumulativeSummary,
    aggregateCsvSummary,
    aggregateCsvPeriods,
    supersededPeriodIds,
    persistedPeriodCount: periodImports.length,
  };
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
      const sourceFiles: Array<Record<string, any>> = [];
      let minRowMs = 0;
      let maxRowMs = 0;

      csvFiles.forEach((file, index) => {
        const content = normalizeString(file.content);
        if (!content) return;
        const rows = parseCsv(content);
        const report = inferUploadedReport(file, rows, index);
        const isAggregatePerformance = isAggregatedPerformanceReport(rows);
        const uploadKey = [normalizeString(file.name) || `upload_${index + 1}`, String(file.lastModified || '')]
          .filter(Boolean)
          .join(':');
        let activeMediaSource = '';
        let activeAggregateDate = '';
        let importedFileRows = 0;
        rows.forEach((row) => {
          const aggregatePerformanceRow = isAggregatedPerformanceRow(row);
          const mediaSource = getValue(row, ['media_source', 'pid', 'source']);
          if (mediaSource) activeMediaSource = mediaSource;
          const aggregateDate = aggregateRowDateOnly(row);
          if (aggregateDate) activeAggregateDate = aggregateDate;

          const eventName = getValue(row, ['event_name', 'in_apps_events']);
          if (aggregatePerformanceRow && !eventName) return;

          const normalizedRow = aggregatePerformanceRow
            ? {
                ...row,
                date: aggregateDate || activeAggregateDate || row.date,
                media_source: mediaSource || activeMediaSource,
                event_name: eventName,
              }
            : row;

          const rowDate = aggregateRowDateOnly(normalizedRow);
          const occurredAt = getValue(normalizedRow, ['event_time', 'event_time_selected_timezone', 'install_time', 'install_time_selected_timezone']);
          const occurredMs = Date.parse(rowDate ? `${rowDate}T00:00:00.000Z` : occurredAt);
          if (Number.isFinite(occurredMs)) {
            minRowMs = minRowMs ? Math.min(minRowMs, occurredMs) : occurredMs;
            maxRowMs = Math.max(maxRowMs, occurredMs);
          }
          allRows.push({ row: normalizedRow, report, rawRowId: stableRawRowId(normalizedRow, report, uploadKey) });
          importedFileRows += 1;
        });
        sourceFiles.push({
          name: normalizeString(file.name) || `CSV ${index + 1}`,
          lastModified: file.lastModified || null,
          parsedRows: rows.length,
          importedRows: importedFileRows,
          reportKey: report.key,
          reportType: report.type,
          aggregatePerformance: isAggregatePerformance,
        });
      });

      if (!allRows.length) {
        return json(400, { error: 'No rows were found in the uploaded CSV file.' });
      }

      const aggregateCsvUpload = allRows.some(({ row }) => isAggregatedPerformanceRow(row));
      if (aggregateCsvUpload) {
        const period = resolveAggregateCsvPeriod({ body, csvFiles, minRowMs, maxRowMs });
        if (!period.periodStart || !period.periodEnd) {
          return json(400, { error: 'No AppsFlyer CSV date window could be inferred for the aggregate performance report.' });
        }
        if (period.periodStart > period.periodEnd) {
          return json(400, { error: 'AppsFlyer CSV start date must be on or before the end date.' });
        }
        const periodIsSingleDay = period.periodStart === period.periodEnd;
        const aggregateRows = allRows.map(({ row, report }) => {
          const aggregatePerformanceRow = isAggregatedPerformanceRow(row);
          const rowDate = aggregateRowDateOnly(row);
          const assignedDate = rowDate || (aggregatePerformanceRow && periodIsSingleDay ? period.periodStart : '');
          const assignedEventTime = assignedDate
            ? getValue(row, ['event_time', 'event_time_selected_timezone', 'install_time', 'install_time_selected_timezone']) || `${assignedDate}T12:00:00.000Z`
            : '';
          const normalizedRow =
            aggregatePerformanceRow && assignedDate
              ? {
                  ...row,
                  date: assignedDate,
                  event_time: assignedEventTime,
                }
              : row;

          return {
            row: normalizedRow,
            report,
            rawRowId: aggregatePerformanceRow ? stableAggregateRawRowId(normalizedRow, report) : stableRawRowId(normalizedRow, report),
          };
        });

        const summary = createSummary({
          appId,
          from: period.periodStart,
          to: period.periodEnd,
          daysBack: daysBetweenInclusive(period.periodStart, period.periodEnd),
          maximumRows: aggregateRows.length,
          timezone: 'aggregate_csv_period',
          importSource: 'aggregate_csv_upload',
        });

        for (const { row, report } of aggregateRows) {
          summary.rows += 1;
          bump(summary.reports, report.key);
          addRowToSummary(summary, row, report);
        }
        const { periodImports, dateGranularity, datedRows } = buildAggregatePeriodImports({
          appId,
          rows: aggregateRows,
          period,
          fallbackSummary: summary,
        });

        const runId = `macra-appsflyer-csv-period-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const eventDateDistribution = Object.entries(
          aggregateRows.reduce((out, { row }) => {
            const eventDate = rawRowEventDate(row) || 'missing_date';
            out[eventDate] = (out[eventDate] || 0) + 1;
            return out;
          }, {} as Record<string, number>)
        )
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([date, rows]) => ({ date, rows }));
        const rawRowDates = eventDateDistribution.map((row) => row.date).filter((date) => date !== 'missing_date');
        const missingDateRows = eventDateDistribution.find((row) => row.date === 'missing_date')?.rows || 0;
        const parsedDateRows = aggregateRows.length - missingDateRows;
        const dateHandling =
          parsedDateRows === aggregateRows.length
            ? 'row_level_dates'
            : period.periodStart === period.periodEnd
              ? 'single_day_assigned'
              : 'period_bucket_no_row_dates';
        const rawRowPersistence =
          dateHandling === 'period_bucket_no_row_dates'
            ? { persistedRawRows: 0, retiredRawRows: 0 }
            : await persistRawRowsOnly({
                db: adminRequest.db,
                runId,
                source: 'aggregate_csv_upload',
                rawRows: aggregateRows,
                replaceDates: rawRowDates,
              });
        const topUploadedEvents = topEntries(summary.events.byName, 12);
        const uploadDiagnostics = {
          mode: 'aggregate_csv_upload',
          period,
          periodSource: period.source || '',
          autoAssignedYesterday: period.source === 'auto_yesterday',
          requestedPeriod: {
            preset: normalizeString(body.csvPeriodPreset || body.periodPreset) || null,
            start: normalizeDateOnly(body.csvPeriodStart || body.periodStart || body.fromDate) || null,
            end: normalizeDateOnly(body.csvPeriodEnd || body.periodEnd || body.toDate) || null,
          },
          clientYesterday: normalizeDateOnly(body.clientYesterday) || null,
          uploadedRows: aggregateRows.length,
          rawRowsPersisted: rawRowPersistence.persistedRawRows,
          rawRowsRetired: rawRowPersistence.retiredRawRows,
          datedRows,
          parsedDateRows,
          missingDateRows,
          dateGranularity,
          dateHandling,
          eventDateDistribution,
          topUploadedEvents,
          revenueTotal: Number(summary.revenue?.total || 0) || 0,
          topRevenueEvents: topEntries(summary.revenue?.byEventName || {}, 8),
          eventSamples: aggregateRows.slice(0, 20).map(({ row, report }) => ({
            eventDate: rawRowEventDate(row) || null,
            eventTime: rawRowEventTime(row) || null,
            eventName: rawRowEventName(row, report) || null,
            mediaSource: rawRowMediaSource(row, report),
            actions: rawRowActionCount(row),
            uniqueUsers: Math.max(0, parseReportNumber(row.unique_users)),
            revenue: parseReportNumber(row.revenue),
          })),
          sourceFiles,
          rawRowCollection: RAW_ROW_COLLECTION,
        };
        if (dateHandling === 'period_bucket_no_row_dates') {
          console.warn('[sync-macra-appsflyer-raw-data] Aggregate CSV has no row-level dates; saved as a coverage bucket', {
            period,
            requestedPeriod: uploadDiagnostics.requestedPeriod,
            uploadedRows: aggregateRows.length,
          });
        }
        console.log('[sync-macra-appsflyer-raw-data] Aggregate CSV upload diagnostics', uploadDiagnostics);
        const { cumulativeSummary, aggregateCsvSummary, aggregateCsvPeriods, supersededPeriodIds, persistedPeriodCount } = await persistAggregateCsvPeriodImport({
          db: adminRequest.db,
          adminRequest,
          runId,
          summary,
          period,
          periodImports,
          sourceFiles,
          uploadedRows: aggregateRows.length,
          dateGranularity,
        });

        return json(200, {
          success: true,
          runId,
          summary,
          cumulativeSummary,
          aggregateCsvSummary,
          aggregateCsvPeriods,
          aggregatePeriod: period,
          aggregatePeriods: periodImports.map((periodImport) => ({
            id: periodImport.period.docId,
            periodStart: periodImport.period.periodStart,
            periodEnd: periodImport.period.periodEnd,
            granularity: periodImport.period.periodStart === periodImport.period.periodEnd ? 'daily' : 'range',
            rows: periodImport.summary.rows,
            events: periodImport.summary.events.total,
            installs: periodImport.summary.installs.total,
          })),
          dateGranularity,
          datedRows,
          uploadDiagnostics,
          uploadedRows: aggregateRows.length,
          importedRows: aggregateRows.length,
          duplicateRows: 0,
          supersededPeriodIds,
          persistedPeriodCount,
          replacedPeriod: true,
        });
      }

      const eventDateDistribution = Object.entries(
        allRows.reduce((out, { row }) => {
          const eventDate = rawRowEventDate(row) || 'missing_date';
          out[eventDate] = (out[eventDate] || 0) + 1;
          return out;
        }, {} as Record<string, number>)
      )
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, rows]) => ({ date, rows }));
      const missingDateRows = eventDateDistribution.find((row) => row.date === 'missing_date')?.rows || 0;
      const parsedDateRows = allRows.length - missingDateRows;

      if (!parsedDateRows) {
        const period = resolveAggregateCsvPeriod({ body, csvFiles, minRowMs, maxRowMs });
        if (!period.periodStart || !period.periodEnd) {
          return json(400, { error: 'No AppsFlyer CSV date window could be inferred for the upload.' });
        }
        if (period.periodStart > period.periodEnd) {
          return json(400, { error: 'AppsFlyer CSV start date must be on or before the end date.' });
        }

        const summary = createSummary({
          appId,
          from: period.periodStart,
          to: period.periodEnd,
          daysBack: daysBetweenInclusive(period.periodStart, period.periodEnd),
          maximumRows: allRows.length,
          timezone: 'csv_upload_period_bucket',
          importSource: 'csv_upload_period_bucket',
        });

        for (const { row, report } of allRows) {
          summary.rows += 1;
          bump(summary.reports, report.key);
          addRowToSummary(summary, row, report);
        }

        const runId = `macra-appsflyer-csv-period-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const periodImports = [{ period, summary, uploadedRows: allRows.length }];
        const uploadDiagnostics = {
          mode: 'csv_upload_period_bucket',
          period,
          periodSource: period.source || '',
          requestedPeriod: {
            preset: normalizeString(body.csvPeriodPreset || body.periodPreset) || null,
            start: normalizeDateOnly(body.csvPeriodStart || body.periodStart || body.fromDate) || null,
            end: normalizeDateOnly(body.csvPeriodEnd || body.periodEnd || body.toDate) || null,
          },
          clientYesterday: normalizeDateOnly(body.clientYesterday) || null,
          uploadedRows: allRows.length,
          importedRows: allRows.length,
          duplicateRows: 0,
          parsedDateRows,
          missingDateRows,
          dateGranularity: 'period',
          dateHandling: 'period_bucket_no_row_dates',
          eventDateDistribution,
          topUploadedEvents: topEntries(summary.events.byName, 12),
          revenueTotal: Number(summary.revenue?.total || 0) || 0,
          topRevenueEvents: topEntries(summary.revenue?.byEventName || {}, 8),
          eventSamples: allRows.slice(0, 20).map(({ row, report }) => ({
            eventDate: rawRowEventDate(row) || null,
            eventTime: rawRowEventTime(row) || null,
            eventName: rawRowEventName(row, report) || null,
            mediaSource: rawRowMediaSource(row, report),
            actions: rawRowActionCount(row),
            revenue: parseReportNumber(getValue(row, ['revenue', 'event_revenue', 'af_revenue'])),
          })),
          sourceFiles,
          rawRowCollection: RAW_ROW_COLLECTION,
        };
        console.warn('[sync-macra-appsflyer-raw-data] CSV upload has no row-level dates; saved as a coverage bucket', {
          period,
          requestedPeriod: uploadDiagnostics.requestedPeriod,
          uploadedRows: allRows.length,
        });
        console.log('[sync-macra-appsflyer-raw-data] CSV period bucket upload diagnostics', uploadDiagnostics);

        const { cumulativeSummary, aggregateCsvSummary, aggregateCsvPeriods, supersededPeriodIds, persistedPeriodCount } =
          await persistAggregateCsvPeriodImport({
            db: adminRequest.db,
            adminRequest,
            runId,
            summary,
            period,
            periodImports,
            sourceFiles,
            uploadedRows: allRows.length,
            dateGranularity: 'period',
          });

        return json(200, {
          success: true,
          runId,
          summary,
          cumulativeSummary,
          aggregateCsvSummary,
          aggregateCsvPeriods,
          aggregatePeriod: period,
          aggregatePeriods: periodImports.map((periodImport) => ({
            id: periodImport.period.docId,
            periodStart: periodImport.period.periodStart,
            periodEnd: periodImport.period.periodEnd,
            granularity: periodImport.period.periodStart === periodImport.period.periodEnd ? 'daily' : 'range',
            rows: periodImport.summary.rows,
            events: periodImport.summary.events.total,
            installs: periodImport.summary.installs.total,
          })),
          dateGranularity: 'period',
          uploadDiagnostics,
          uploadedRows: allRows.length,
          importedRows: allRows.length,
          duplicateRows: 0,
          supersededPeriodIds,
          persistedPeriodCount,
          replacedPeriod: true,
        });
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
      const uploadDiagnostics = {
        mode: 'raw_csv_upload',
        uploadedRows: allRows.length,
        importedRows: newRows.length,
        duplicateRows,
        parsedDateRows,
        missingDateRows,
        dateHandling: 'row_level_dates',
        eventDateDistribution,
        topUploadedEvents: topEntries(summary.events.byName, 12),
        revenueTotal: Number(summary.revenue?.total || 0) || 0,
        topRevenueEvents: topEntries(summary.revenue?.byEventName || {}, 8),
        sourceFiles,
        rawRowCollection: RAW_ROW_COLLECTION,
      };
      console.log('[sync-macra-appsflyer-raw-data] Raw CSV upload diagnostics', uploadDiagnostics);

      return json(200, {
        success: true,
        runId,
        summary,
        cumulativeSummary,
        uploadedRows: allRows.length,
        importedRows: newRows.length,
        duplicateRows,
        uploadDiagnostics,
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
