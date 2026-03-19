import type { NextApiRequest, NextApiResponse } from 'next';

type NetlifyFunctionResponse = {
  statusCode?: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
};

type NetlifyFunctionModule = {
  handler?: (event: Record<string, any>, context?: Record<string, any>) => Promise<NetlifyFunctionResponse> | NetlifyFunctionResponse;
  default?: {
    handler?: (event: Record<string, any>, context?: Record<string, any>) => Promise<NetlifyFunctionResponse> | NetlifyFunctionResponse;
  };
};

const FUNCTION_LOADERS: Record<string, () => NetlifyFunctionModule> = {
  'submit-pulsecheck-checkin': () => require('../../../../../netlify/functions/submit-pulsecheck-checkin.js'),
  'record-pulsecheck-assignment-event': () => require('../../../../../netlify/functions/record-pulsecheck-assignment-event.js'),
  'tts-mental-step': () => require('../../../../../netlify/functions/tts-mental-step.ts'),
  'pulsecheck-chat': () => require('../../../../../netlify/functions/pulsecheck-chat.js'),
  'pulsecheck-escalation': () => require('../../../../../netlify/functions/pulsecheck-escalation.js'),
  'oura-auth-start': () => require('../../../../../netlify/functions/oura-auth-start.js'),
  'oura-callback': () => require('../../../../../netlify/functions/oura-callback.js'),
  'oura-status': () => require('../../../../../netlify/functions/oura-status.js'),
  'oura-disconnect': () => require('../../../../../netlify/functions/oura-disconnect.js'),
  'oura-sync': () => require('../../../../../netlify/functions/oura-sync.js'),
  'create-pulsecheck-oura-share': () => require('../../../../../netlify/functions/create-pulsecheck-oura-share.js'),
};

function normalizeQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function buildNetlifyEvent(req: NextApiRequest) {
  const normalizedQuery = Object.entries(req.query).reduce<Record<string, string>>((accumulator, [key, value]) => {
    if (key === 'name') return accumulator;

    const normalizedValue = normalizeQueryValue(value);
    if (typeof normalizedValue === 'string') {
      accumulator[key] = normalizedValue;
    }

    return accumulator;
  }, {});

  return {
    httpMethod: req.method || 'GET',
    headers: Object.fromEntries(Object.entries(req.headers).flatMap(([key, value]) => {
      if (typeof value === 'undefined') return [];
      return [[key, Array.isArray(value) ? value.join(',') : String(value)]];
    })),
    body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}),
    queryStringParameters: normalizedQuery,
    pathParameters: {
      name: normalizeQueryValue(req.query.name),
    },
    rawUrl: req.url,
  };
}

function resolveSiteOrigin(req: NextApiRequest) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const protocol = typeof forwardedProto === 'string' && forwardedProto.trim() ? forwardedProto : 'https';
  const host = typeof forwardedHost === 'string' && forwardedHost.trim()
    ? forwardedHost
    : typeof req.headers.host === 'string' && req.headers.host.trim()
      ? req.headers.host
      : 'fitwithpulse.ai';

  return `${protocol}://${host}`;
}

async function proxyNetlifyBinaryFunction(name: string, req: NextApiRequest, res: NextApiResponse) {
  const targetURL = new URL(`/.netlify/functions/${name}`, resolveSiteOrigin(req));

  Object.entries(req.query).forEach(([key, value]) => {
    if (key === 'name') return;

    const normalizedValue = normalizeQueryValue(value);
    if (typeof normalizedValue === 'string') {
      targetURL.searchParams.set(key, normalizedValue);
    }
  });

  const requestHeaders = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (typeof value === 'undefined') return;
    if (key.toLowerCase() === 'host' || key.toLowerCase() === 'content-length') return;
    requestHeaders.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });

  const body = req.method === 'GET' || req.method === 'HEAD'
    ? undefined
    : typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body ?? {});

  const upstreamResponse = await fetch(targetURL, {
    method: req.method || 'GET',
    headers: requestHeaders,
    body,
  });

  res.status(upstreamResponse.status);

  upstreamResponse.headers.forEach((headerValue, headerName) => {
    if (headerName.toLowerCase() === 'content-length' || headerName.toLowerCase() === 'transfer-encoding') {
      return;
    }
    res.setHeader(headerName, headerValue);
  });

  const arrayBuffer = await upstreamResponse.arrayBuffer();
  res.send(Buffer.from(arrayBuffer));
}

async function invokeNetlifyFunction(name: string, req: NextApiRequest) {
  const loadModule = FUNCTION_LOADERS[name];
  if (!loadModule) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Unsupported PulseCheck function: ${name}` }),
    } satisfies NetlifyFunctionResponse;
  }

  const loadedModule = loadModule();
  const resolvedHandler =
    typeof loadedModule?.handler === 'function'
      ? loadedModule.handler
      : typeof loadedModule?.default?.handler === 'function'
        ? loadedModule.default.handler
        : null;

  if (!resolvedHandler) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `PulseCheck function ${name} is missing a handler export.` }),
    } satisfies NetlifyFunctionResponse;
  }

  return resolvedHandler(buildNetlifyEvent(req), {});
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestedName = normalizeQueryValue(req.query.name);
  if (!requestedName) {
    res.status(400).json({ error: 'Missing function name.' });
    return;
  }

  try {
    if (requestedName === 'tts-mental-step') {
      await proxyNetlifyBinaryFunction(requestedName, req, res);
      return;
    }

    const functionResponse = await invokeNetlifyFunction(requestedName, req);
    const statusCode = functionResponse?.statusCode || 200;

    Object.entries(functionResponse?.headers || {}).forEach(([headerName, headerValue]) => {
      if (typeof headerValue === 'string') {
        res.setHeader(headerName, headerValue);
      }
    });

    if (functionResponse?.isBase64Encoded && functionResponse.body) {
      res.status(statusCode).send(Buffer.from(functionResponse.body, 'base64'));
      return;
    }

    res.status(statusCode).send(functionResponse?.body || '');
  } catch (error) {
    console.error(`[PulseCheck local proxy] Failed to invoke ${requestedName}:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'PulseCheck local proxy failed.',
    });
  }
}
