// Phase C — admin debug endpoint for Nora athlete translation.
//
// One-shot preview surface used during voice review and dev smoke tests.
// Defaults to persistLog=false so calls never pollute the audit collection
// unless the operator explicitly opts in. Returns the full TranslationResult
// including claudeOutputRaw so reviewers can compare Claude vs. seed.
//
// Phase E will replace this with a richer admin UI; Phase D will call
// translateForAthlete from the inference orchestrator (server-only, not via
// this endpoint).

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminRequest } from './_auth';
import { getFirebaseAdminApp } from '../../../lib/firebase-admin';
import { translateForAthlete } from '../../../api/firebase/adaptiveFramingLayer/translationService';
import {
  TRANSLATION_DOMAINS,
  TranslationDomain,
} from '../../../api/firebase/adaptiveFramingLayer/types';

const isTranslationDomain = (value: unknown): value is TranslationDomain =>
  typeof value === 'string' && (TRANSLATION_DOMAINS as readonly string[]).includes(value);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const adminRequest = await requireAdminRequest(req);
  if (!adminRequest) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }

  const source =
    req.method === 'POST' && req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>)
      : (req.query as Record<string, unknown>);

  const domainRaw = source.domain;
  const stateRaw = source.state;
  const signalRaw = source.signal;
  const athleteUserIdRaw = source.athleteUserId ?? `admin-preview:${adminRequest.email}`;
  const persistLogRaw = source.persistLog;
  const additionalContextRaw = source.additionalContext;

  if (!isTranslationDomain(domainRaw)) {
    return res.status(400).json({
      error: `domain is required and must be one of: ${TRANSLATION_DOMAINS.join(', ')}`,
    });
  }
  if (typeof stateRaw !== 'string' || stateRaw.trim().length === 0) {
    return res.status(400).json({ error: 'state is required (non-empty string)' });
  }

  let signal: Record<string, unknown> = {};
  if (typeof signalRaw === 'string' && signalRaw.trim().length > 0) {
    try {
      const parsed = JSON.parse(signalRaw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        signal = parsed as Record<string, unknown>;
      }
    } catch {
      return res.status(400).json({ error: 'signal must be valid JSON object' });
    }
  } else if (signalRaw && typeof signalRaw === 'object' && !Array.isArray(signalRaw)) {
    signal = signalRaw as Record<string, unknown>;
  }

  let additionalContext: Record<string, string> | undefined;
  if (additionalContextRaw && typeof additionalContextRaw === 'object' && !Array.isArray(additionalContextRaw)) {
    additionalContext = {};
    for (const [key, value] of Object.entries(additionalContextRaw as Record<string, unknown>)) {
      if (typeof value === 'string') additionalContext[key] = value;
      else if (typeof value === 'number' || typeof value === 'boolean') {
        additionalContext[key] = String(value);
      }
    }
  }

  const persistLog =
    persistLogRaw === true ||
    persistLogRaw === 'true' ||
    persistLogRaw === '1';

  const forceDevFirebase =
    req.headers['x-force-dev-firebase'] === 'true' ||
    req.headers['x-force-dev-firebase'] === '1' ||
    source.forceDevFirebase === true ||
    source.forceDevFirebase === 'true';

  try {
    const adminApp = getFirebaseAdminApp(forceDevFirebase);
    const result = await translateForAthlete(
      {
        athleteUserId: typeof athleteUserIdRaw === 'string' ? athleteUserIdRaw : 'admin-preview',
        signal,
        domain: domainRaw,
        state: stateRaw,
        additionalContext,
        persistLog,
      },
      { firestore: adminApp.firestore() },
    );

    if (!result) {
      return res.status(404).json({
        error: `No translation row found for (${domainRaw}, ${stateRaw})`,
      });
    }

    return res.status(200).json({
      success: true,
      persistLog,
      forceDevFirebase,
      result,
    });
  } catch (error) {
    console.error('[admin/test-nora-translation] Translation failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Translation failed',
    });
  }
}
