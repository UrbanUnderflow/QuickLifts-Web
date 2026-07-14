import type { Handler } from '@netlify/functions';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import * as admin from 'firebase-admin';
import { recordAthleteReply } from '../../src/api/firebase/noraConversation/orchestrator';
import { translateForAthlete } from '../../src/api/firebase/adaptiveFramingLayer/translationService';

// Hard time budget for the Claude translation on the reply path. The
// synchronous Netlify function caps at ~10s; a cold start plus a full
// model generation was blowing through it, so the athlete saw "That
// didn't send" even though nothing was wrong with their reply. If the
// model can't answer inside the budget, the orchestrator's authored
// fallback action line delivers instead — the reply is never lost.
const TRANSLATE_BUDGET_MS = 3500;

const timeBudgetedTranslate: typeof translateForAthlete = (input, deps) =>
  Promise.race([
    translateForAthlete(input, deps),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), TRANSLATE_BUDGET_MS);
    }),
  ]) as ReturnType<typeof translateForAthlete>;

/**
 * POST /.netlify/functions/nora-athlete-reply
 *
 * Authenticated endpoint — athlete posts their reply to a Nora
 * conversation.  The orchestrator advances state: opened → awaiting-reply
 * (probe sent) OR awaiting-reply → action-delivered (final translated
 * guidance).
 *
 * Body shape:
 *   { conversationId: string, text: string }
 *
 * Returns:
 *   200 { conversation: NoraConversation }
 *   400 invalid input
 *   401 unauthenticated
 *   403 not the athlete on the conversation
 *   404 conversation not found
 */

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const verifyAuth = async (
  authHeader?: string,
): Promise<{ uid: string; email?: string } | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: RESPONSE_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  await initAdmin();
  const db = await getFirestore();

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const auth = await verifyAuth(authHeader);
  if (!auth) {
    return { statusCode: 401, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'unauthenticated' }) };
  }

  let body: { conversationId?: string; text?: string };
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as any) || {};
  } catch {
    return { statusCode: 400, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'invalid_json' }) };
  }
  const conversationId = (body.conversationId || '').trim();
  const text = (body.text || '').trim();
  if (!conversationId) {
    return { statusCode: 400, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'conversationId required' }) };
  }
  if (!text) {
    return { statusCode: 400, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'text required' }) };
  }
  if (text.length > 2000) {
    return { statusCode: 400, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'text too long' }) };
  }

  // Verify the athlete owns this conversation.
  const convoSnap = await db.collection('pulsecheck-nora-conversations').doc(conversationId).get();
  if (!convoSnap.exists) {
    return { statusCode: 404, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'conversation_not_found' }) };
  }
  const convo = convoSnap.data() as { athleteUserId?: string } | undefined;
  if (convo?.athleteUserId !== auth.uid) {
    return { statusCode: 403, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'not_your_conversation' }) };
  }

  try {
    const updated = await recordAthleteReply(
      { conversationId, text },
      { firestore: db, translate: timeBudgetedTranslate },
    );
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: JSON.stringify({ ok: true, conversation: updated }) };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'orchestrator_failed', detail: err?.message || String(err) }),
    };
  }
};
