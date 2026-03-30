import type { NextApiRequest, NextApiResponse } from 'next';

const SUPPORTED_FUNCTIONS = new Set([
  'submit-pulsecheck-checkin',
  'repair-pulsecheck-daily-assignment',
  'record-pulsecheck-assignment-event',
  'tts-mental-step',
  'pulsecheck-chat',
  'pulsecheck-escalation',
  'oura-auth-start',
  'oura-callback',
  'oura-status',
  'oura-disconnect',
  'oura-sync',
  'create-pulsecheck-oura-share',
]);

function normalizeQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
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

async function proxyNetlifyFunction(name: string, req: NextApiRequest, res: NextApiResponse) {
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
    const normalizedHeaderName = headerName.toLowerCase();
    if (
      normalizedHeaderName === 'content-length'
      || normalizedHeaderName === 'transfer-encoding'
      // Node/Next fetch may already decompress the upstream body before we relay it.
      // Forwarding the original content-encoding header can make iOS clients try to
      // decode already-decoded bytes, which surfaces as "cannot decode raw data".
      || normalizedHeaderName === 'content-encoding'
    ) {
      return;
    }
    res.setHeader(headerName, headerValue);
  });

  const arrayBuffer = await upstreamResponse.arrayBuffer();
  res.send(Buffer.from(arrayBuffer));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestedName = normalizeQueryValue(req.query.name);
  if (!requestedName) {
    res.status(400).json({ error: 'Missing function name.' });
    return;
  }

  if (!SUPPORTED_FUNCTIONS.has(requestedName)) {
    res.status(404).json({ error: `Unsupported PulseCheck function: ${requestedName}` });
    return;
  }

  try {
    await proxyNetlifyFunction(requestedName, req, res);
  } catch (error) {
    console.error(`[PulseCheck function proxy] Failed to proxy ${requestedName}:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'PulseCheck function proxy failed.',
    });
  }
}
