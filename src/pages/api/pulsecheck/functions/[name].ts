import type { NextApiRequest, NextApiResponse } from 'next';

type NetlifyFunctionResponse = {
  statusCode?: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
};

type NetlifyFunctionModule = {
  handler?: (event: Record<string, any>, context?: Record<string, any>) => Promise<NetlifyFunctionResponse> | NetlifyFunctionResponse;
};

const FUNCTION_LOADERS: Record<string, () => NetlifyFunctionModule> = {
  'submit-pulsecheck-checkin': () => require('../../../../../netlify/functions/submit-pulsecheck-checkin.js'),
  'record-pulsecheck-assignment-event': () => require('../../../../../netlify/functions/record-pulsecheck-assignment-event.js'),
  'pulsecheck-chat': () => require('../../../../../netlify/functions/pulsecheck-chat.js'),
  'pulsecheck-escalation': () => require('../../../../../netlify/functions/pulsecheck-escalation.js'),
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
  if (typeof loadedModule?.handler !== 'function') {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `PulseCheck function ${name} is missing a handler export.` }),
    } satisfies NetlifyFunctionResponse;
  }

  return loadedModule.handler(buildNetlifyEvent(req), {});
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestedName = normalizeQueryValue(req.query.name);
  if (!requestedName) {
    res.status(400).json({ error: 'Missing function name.' });
    return;
  }

  try {
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
