import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminRequest } from '../_auth';

type SmokeTargetId =
  | 'scheduled-nora-conversation'
  | 'nora-timeout-sweep'
  | 'daily-curriculum-assignment'
  | 'curriculum-reminder'
  | 'curriculum-assessment';

type SmokeTarget = {
  id: SmokeTargetId;
  label: string;
  description: string;
  functionName: string;
  method: 'GET';
  defaultQuery?: Record<string, string>;
};

const SMOKE_TARGETS: SmokeTarget[] = [
  {
    id: 'scheduled-nora-conversation',
    label: 'Scheduled Nora Conversation',
    description: 'Runs the Phase D trigger sweep and reports candidates, opens, pushes, dedupes, and errors.',
    functionName: 'scheduled-nora-conversation',
    method: 'GET',
  },
  {
    id: 'nora-timeout-sweep',
    label: 'Nora Timeout Sweep',
    description: 'Closes opened or awaiting-reply Nora conversations older than the timeout window.',
    functionName: 'scheduled-nora-conversation-timeout-sweep',
    method: 'GET',
  },
  {
    id: 'daily-curriculum-assignment',
    label: 'Daily Curriculum Assignment',
    description: 'Runs the Phase I daily assignment scheduler path and returns real assignment / skip counts.',
    functionName: 'scheduled-daily-curriculum-assignment',
    method: 'GET',
  },
  {
    id: 'curriculum-reminder',
    label: 'Curriculum Reminder',
    description: 'Runs the midpoint/evening reminder sweep for open curriculum-engine assignments.',
    functionName: 'scheduled-curriculum-reminder',
    method: 'GET',
  },
  {
    id: 'curriculum-assessment',
    label: 'Curriculum Assessment',
    description: 'Runs the monthly assessment scheduler in forced dev-smoke mode and returns candidate counts.',
    functionName: 'scheduled-curriculum-assessment',
    method: 'GET',
    defaultQuery: { force: '1', backfillMonths: '0' },
  },
];

const targetById = new Map(SMOKE_TARGETS.map((target) => [target.id, target]));

const asTargetId = (value: unknown): SmokeTargetId | null => {
  if (typeof value !== 'string') return null;
  return targetById.has(value as SmokeTargetId) ? (value as SmokeTargetId) : null;
};

const resolveOrigin = (req: NextApiRequest): string => {
  const forwardedHost = Array.isArray(req.headers['x-forwarded-host'])
    ? req.headers['x-forwarded-host'][0]
    : req.headers['x-forwarded-host'];
  const host = forwardedHost || (Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host);
  const forwardedProto = Array.isArray(req.headers['x-forwarded-proto'])
    ? req.headers['x-forwarded-proto'][0]
    : req.headers['x-forwarded-proto'];
  const proto = forwardedProto || (host?.includes('localhost') || host?.includes('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host || 'localhost:8888'}`;
};

const buildFunctionUrl = (
  req: NextApiRequest,
  target: SmokeTarget,
  query: Record<string, string> = {},
): string => {
  const url = new URL(`/.netlify/functions/${target.functionName}`, resolveOrigin(req));
  const params = {
    ...(target.defaultQuery || {}),
    ...query,
  };
  for (const [key, value] of Object.entries(params)) {
    if (value !== '') url.searchParams.set(key, value);
  }
  return url.toString();
};

const normalizeQuery = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string') out[key] = raw;
    else if (typeof raw === 'number' || typeof raw === 'boolean') out[key] = String(raw);
  }
  return out;
};

const getTargetLinks = (req: NextApiRequest) =>
  SMOKE_TARGETS.map((target) => ({
    ...target,
    endpoint: buildFunctionUrl(req, target),
  }));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const adminRequest = await requireAdminRequest(req);
  if (!adminRequest) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      generatedAt: new Date().toISOString(),
      targets: getTargetLinks(req),
      relatedAdminRoutes: [
        { label: 'Translation Preview', href: '/admin/adminLevers#nora-translation-preview' },
        { label: 'Nora Guard', href: '/admin/noraGuard' },
        { label: 'Curriculum Layer', href: '/admin/curriculumLayer' },
      ],
    });
  }

  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  const targetId = asTargetId(body.targetId);
  if (!targetId) {
    return res.status(400).json({ error: 'targetId is required and must be a supported smoke target.' });
  }

  const target = targetById.get(targetId)!;
  const endpoint = buildFunctionUrl(req, target, normalizeQuery(body.query));

  try {
    const startedAt = Date.now();
    const upstream = await fetch(endpoint, {
      method: target.method,
      headers: { 'x-admin-smoke-lever': adminRequest.email },
    });
    const text = await upstream.text();
    let payload: unknown = text;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    return res.status(upstream.ok ? 200 : 502).json({
      ok: upstream.ok,
      targetId,
      label: target.label,
      endpoint,
      upstreamStatus: upstream.status,
      durationMs: Date.now() - startedAt,
      payload,
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      targetId,
      label: target.label,
      endpoint,
      error: error instanceof Error ? error.message : 'Smoke target failed.',
    });
  }
}

export const __internal = {
  SMOKE_TARGETS,
  buildFunctionUrl,
  normalizeQuery,
};
