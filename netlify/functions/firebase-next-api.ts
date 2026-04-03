import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';

type RouteLoader = () => Promise<{ default: NextApiHandler }>;

type RouteEntry = {
  pattern: string;
  loadHandler: RouteLoader;
};

type HeaderValue = string | string[];

function normalizeOriginalPath(value: string | undefined) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function matchRoutePattern(pattern: string, actualPath: string) {
  const patternSegments = pattern.split('/').filter(Boolean);
  const actualSegments = actualPath.split('/').filter(Boolean);

  if (patternSegments.length !== actualSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const actualSegment = actualSegments[index];
    const dynamicMatch = patternSegment.match(/^\[(.+)\]$/);

    if (dynamicMatch) {
      params[dynamicMatch[1]] = decodeURIComponent(actualSegment);
      continue;
    }

    if (patternSegment !== actualSegment) {
      return null;
    }
  }

  return params;
}

function parseBody(event: HandlerEvent) {
  if (!event.body) {
    return undefined;
  }

  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64');
  }

  const contentType = String(
    event.headers['content-type']
      || event.headers['Content-Type']
      || ''
  ).toLowerCase();

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(event.body);
    } catch (error) {
      return event.body;
    }
  }

  return event.body;
}

function buildQuery(event: HandlerEvent, params: Record<string, string>) {
  const query: Record<string, string> = {
    ...params,
  };

  for (const [key, value] of Object.entries(event.queryStringParameters || {})) {
    if (value == null || key === 'originalPath') {
      continue;
    }

    query[key] = value;
  }

  return query;
}

function createRequest(event: HandlerEvent, params: Record<string, string>) {
  const originalPath = normalizeOriginalPath(event.queryStringParameters?.originalPath);
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(event.queryStringParameters || {})) {
    if (key === 'originalPath' || value == null) {
      continue;
    }

    search.set(key, value);
  }

  const url = search.toString() ? `${originalPath}?${search.toString()}` : originalPath;
  const remoteAddress = String(
    event.headers['x-forwarded-for']
      || event.headers['client-ip']
      || event.headers['x-nf-client-connection-ip']
      || ''
  )
    .split(',')[0]
    .trim();

  return {
    method: event.httpMethod,
    headers: event.headers,
    query: buildQuery(event, params),
    body: parseBody(event),
    url,
    socket: {
      remoteAddress: remoteAddress || undefined,
    },
  } as unknown as NextApiRequest;
}

function createResponse() {
  const headers = new Map<string, HeaderValue>();
  let statusCode = 200;
  let body: Buffer = Buffer.alloc(0);
  let finished = false;

  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    setHeader(name: string, value: HeaderValue) {
      headers.set(name, value);
      return response;
    },
    getHeader(name: string) {
      return headers.get(name);
    },
    json(payload: unknown) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json; charset=utf-8');
      }
      body = Buffer.from(JSON.stringify(payload));
      finished = true;
      return response;
    },
    send(payload?: unknown) {
      if (Buffer.isBuffer(payload)) {
        body = payload;
      } else if (typeof payload === 'string') {
        body = Buffer.from(payload);
      } else if (payload == null) {
        body = Buffer.alloc(0);
      } else {
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json; charset=utf-8');
        }
        body = Buffer.from(JSON.stringify(payload));
      }
      finished = true;
      return response;
    },
    end(payload?: unknown) {
      return response.send(payload);
    },
    get statusCode() {
      return statusCode;
    },
    get bodyBuffer() {
      return body;
    },
    get headersMap() {
      return headers;
    },
    get finished() {
      return finished;
    },
  } as unknown as NextApiResponse & {
    bodyBuffer: Buffer;
    headersMap: Map<string, HeaderValue>;
    finished: boolean;
  };

  return response;
}

function toHandlerResponse(
  response: ReturnType<typeof createResponse>
): HandlerResponse {
  const headers: Record<string, string> = {};
  const multiValueHeaders: Record<string, string[]> = {};

  for (const [name, value] of response.headersMap.entries()) {
    if (Array.isArray(value)) {
      multiValueHeaders[name] = value.map((entry) => String(entry));
      continue;
    }

    headers[name] = String(value);
  }

  return {
    statusCode: response.statusCode,
    headers,
    multiValueHeaders: Object.keys(multiValueHeaders).length > 0 ? multiValueHeaders : undefined,
    body: response.bodyBuffer.toString('utf8'),
  };
}

export function createFirebaseNextApiHandler(routeEntries: RouteEntry[]): Handler {
  return async (event) => {
    const originalPath = normalizeOriginalPath(event.queryStringParameters?.originalPath);
    const matchedEntry = routeEntries.find((entry) => matchRoutePattern(entry.pattern, originalPath));

    if (!matchedEntry) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          error: 'Unsupported Firebase Next API route.',
          originalPath,
        }),
      };
    }

    const params = matchRoutePattern(matchedEntry.pattern, originalPath) || {};
    const request = createRequest(event, params);
    const response = createResponse();

    try {
      const module = await matchedEntry.loadHandler();
      await module.default(request, response);
      return toHandlerResponse(response);
    } catch (error) {
      console.error('[firebase-next-api] Route execution failed:', {
        originalPath,
        pattern: matchedEntry.pattern,
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          error: 'Firebase Next API proxy failed.',
          originalPath,
          detail: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  };
}

const ROUTE_ENTRIES: RouteEntry[] = [
  { pattern: '/api/admin/group-meet', loadHandler: () => import('../../src/pages/api/admin/group-meet/index.ts') },
  { pattern: '/api/admin/group-meet/contacts', loadHandler: () => import('../../src/pages/api/admin/group-meet/contacts/index.ts') },
  { pattern: '/api/admin/group-meet/test-email', loadHandler: () => import('../../src/pages/api/admin/group-meet/test-email.ts') },
  { pattern: '/api/admin/group-meet/[requestId]', loadHandler: () => import('../../src/pages/api/admin/group-meet/[requestId].ts') },
  { pattern: '/api/admin/group-meet/[requestId]/finalize', loadHandler: () => import('../../src/pages/api/admin/group-meet/[requestId]/finalize.ts') },
  { pattern: '/api/admin/group-meet/[requestId]/invites/[token]/resend', loadHandler: () => import('../../src/pages/api/admin/group-meet/[requestId]/invites/[token]/resend.ts') },
  { pattern: '/api/admin/group-meet/[requestId]/recommend', loadHandler: () => import('../../src/pages/api/admin/group-meet/[requestId]/recommend.ts') },
  { pattern: '/api/admin/group-meet/[requestId]/schedule', loadHandler: () => import('../../src/pages/api/admin/group-meet/[requestId]/schedule.ts') },
  { pattern: '/api/admin/group-meet/[requestId]/send', loadHandler: () => import('../../src/pages/api/admin/group-meet/[requestId]/send.ts') },
  { pattern: '/api/admin/pulsecheck/pilot-research-readout/generate', loadHandler: () => import('../../src/pages/api/admin/pulsecheck/pilot-research-readout/generate.ts') },
  { pattern: '/api/admin/pulsecheck/pilot-research-readout/review', loadHandler: () => import('../../src/pages/api/admin/pulsecheck/pilot-research-readout/review.ts') },
  { pattern: '/api/admin/system-overview/share-links', loadHandler: () => import('../../src/pages/api/admin/system-overview/share-links/index.ts') },
  { pattern: '/api/admin/system-overview/share-links/[token]', loadHandler: () => import('../../src/pages/api/admin/system-overview/share-links/[token].ts') },
  { pattern: '/api/agent/kickoff-mission', loadHandler: () => import('../../src/pages/api/agent/kickoff-mission.ts') },
  { pattern: '/api/backfill-badges', loadHandler: () => import('../../src/pages/api/backfill-badges.ts') },
  { pattern: '/api/group-meet/[token]', loadHandler: () => import('../../src/pages/api/group-meet/[token].ts') },
  { pattern: '/api/invest/analytics', loadHandler: () => import('../../src/pages/api/invest/analytics.ts') },
  { pattern: '/api/invest/record-view', loadHandler: () => import('../../src/pages/api/invest/record-view.ts') },
  { pattern: '/api/migrate/fitness-seeker-leads', loadHandler: () => import('../../src/pages/api/migrate/fitness-seeker-leads.ts') },
  { pattern: '/api/outreach/activate-campaign', loadHandler: () => import('../../src/pages/api/outreach/activate-campaign.ts') },
  { pattern: '/api/outreach/add-leads', loadHandler: () => import('../../src/pages/api/outreach/add-leads.ts') },
  { pattern: '/api/outreach/create', loadHandler: () => import('../../src/pages/api/outreach/create.ts') },
  { pattern: '/api/outreach/create-campaign', loadHandler: () => import('../../src/pages/api/outreach/create-campaign.ts') },
  { pattern: '/api/outreach/deploy-campaign', loadHandler: () => import('../../src/pages/api/outreach/deploy-campaign.ts') },
  { pattern: '/api/outreach/sync-campaign-settings', loadHandler: () => import('../../src/pages/api/outreach/sync-campaign-settings.ts') },
  { pattern: '/api/pitch/analytics', loadHandler: () => import('../../src/pages/api/pitch/analytics.ts') },
  { pattern: '/api/pitch/record-view', loadHandler: () => import('../../src/pages/api/pitch/record-view.ts') },
  { pattern: '/api/pulsecheck/admin-activation/redeem', loadHandler: () => import('../../src/pages/api/pulsecheck/admin-activation/redeem.ts') },
  { pattern: '/api/pulsecheck/team-invite/redeem', loadHandler: () => import('../../src/pages/api/pulsecheck/team-invite/redeem.ts') },
  { pattern: '/api/reset-badges', loadHandler: () => import('../../src/pages/api/reset-badges.ts') },
  { pattern: '/api/review/capture-reply', loadHandler: () => import('../../src/pages/api/review/capture-reply.ts') },
  { pattern: '/api/review/send-draft-reminder', loadHandler: () => import('../../src/pages/api/review/send-draft-reminder.ts') },
  { pattern: '/api/shared/system-overview/[token]/unlock', loadHandler: () => import('../../src/pages/api/shared/system-overview/[token]/unlock.ts') },
  { pattern: '/api/surveys/notify-completed', loadHandler: () => import('../../src/pages/api/surveys/notify-completed.ts') },
  { pattern: '/api/wunna-run/analytics', loadHandler: () => import('../../src/pages/api/wunna-run/analytics.ts') },
  { pattern: '/api/wunna-run/record-view', loadHandler: () => import('../../src/pages/api/wunna-run/record-view.ts') },
];

export const handler = createFirebaseNextApiHandler(ROUTE_ENTRIES);

export const __test = {
  matchRoutePattern,
  normalizeOriginalPath,
  createFirebaseNextApiHandler,
  resolveRoutePattern(actualPath: string) {
    return ROUTE_ENTRIES.find((entry) => matchRoutePattern(entry.pattern, actualPath))?.pattern || null;
  },
  routeCount: ROUTE_ENTRIES.length,
};
