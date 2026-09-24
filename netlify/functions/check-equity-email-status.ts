import type {Handler} from '@netlify/functions';
import {admin, getFirebaseAdminApp} from './config/firebase';
import {applyBrevoEmailEvent, brevoEmailEventTimestamp, getEquityEmailDelivery, isEquityEmailRequest, normalizeBrevoMessageId} from '../../src/lib/equityEmailDelivery';

const fail = (statusCode: number, message: string) => Object.assign(new Error(message), {statusCode});
const API_URL = 'https://api.brevo.com/v3/smtp/statistics/events';

export const handler: Handler = async event => {
  const reply = (statusCode: number, body: unknown) => ({statusCode, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}, body: JSON.stringify(body)});
  if (event.httpMethod !== 'POST') return reply(405, {error: 'POST required.'});
  try {
    const token = (event.headers.authorization || event.headers.Authorization || '').match(/^Bearer (.+)$/i)?.[1];
    if (!token) throw fail(401, 'Sign in as an administrator to check email delivery.');
    const app = getFirebaseAdminApp(event); const db = admin.firestore(app);
    let identity;
    try { identity = await admin.auth(app).verifyIdToken(token, true); } catch { throw fail(401, 'Your sign-in has expired.'); }
    if (!identity.email || !(await db.collection('admin').doc(identity.email).get()).exists) throw fail(403, 'Administrator access required.');
    let body; try {body = JSON.parse(event.body || '{}');} catch {throw fail(400, 'Invalid request.');}
    if (!Array.isArray(body.requestIds) || !body.requestIds.length || body.requestIds.length > 20
      || body.requestIds.some((id: unknown) => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(id))) throw fail(400, 'Choose between 1 and 20 saved signing requests.');
    const requestIds = [...new Set<string>(body.requestIds)];
    const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
    const pending = new Map<string, Promise<{events: any[]; error?: string}>>();
    const results: any[] = new Array(requestIds.length);
    let cursor = 0;

    const check = async (requestId: string) => {
      const ref = db.collection('signingRequests').doc(requestId);
      const snapshot = await ref.get(); const saved = snapshot.data();
      if (!snapshot.exists || !isEquityEmailRequest(saved)) return {requestId, error: 'Equity signing request not found.'};
      const baseline = getEquityEmailDelivery(saved);
      let report: {events: any[]; error?: string};
      if (!baseline.messageId) report = {events: [], error: baseline.status === 'failed'
        ? 'This attempt has no Brevo message ID. Resolve the saved failure before resending.'
        : 'This attempt has no Brevo message ID, so delivery cannot be verified.'};
      else if (!apiKey) report = {events: [], error: 'Brevo delivery checking is not configured on this server.'};
      else {
        const key = `${normalizeBrevoMessageId(baseline.messageId)}|${baseline.recipientEmail}`;
        if (!pending.has(key)) pending.set(key, (async () => {
          const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 4000);
          try {
            const params = new URLSearchParams({messageId: baseline.messageId!, email: baseline.recipientEmail, days: '90', limit: '100', sort: 'desc'});
            const response = await fetch(`${API_URL}?${params}`, {headers: {'api-key': apiKey!, accept: 'application/json'}, signal: controller.signal});
            if (!response.ok) return {events: [], error: response.status === 429 ? 'Brevo is temporarily limiting delivery checks. Try again shortly.' : `Brevo could not confirm delivery (HTTP ${response.status}). Your last recorded status is unchanged.`};
            const data = await response.json();
            if (!data || typeof data !== 'object' || Array.isArray(data) || (data.events !== undefined && !Array.isArray(data.events))) return {events: [], error: 'Brevo returned an unreadable delivery report. Your last recorded status is unchanged.'};
            return {events: (data.events || []).slice(0, 100)};
          } catch {return {events: [], error: 'Could not reach Brevo to confirm delivery. Your last recorded status is unchanged.'};}
          finally {clearTimeout(timeout);}
        })());
        report = await pending.get(key)!;
      }
      const checkedAt = new Date().toISOString();
      return db.runTransaction(async transaction => {
        const latestSnapshot = await transaction.get(ref); const latest = latestSnapshot.data();
        if (!latestSnapshot.exists || !isEquityEmailRequest(latest)) return {requestId, error: 'Equity signing request no longer exists.'};
        const current = getEquityEmailDelivery(latest);
        if (normalizeBrevoMessageId(current.messageId) !== normalizeBrevoMessageId(baseline.messageId)
          || current.attemptId !== baseline.attemptId || current.recipientEmail !== baseline.recipientEmail) return {requestId, emailDelivery: current, skipped: 'A newer send attempt is already being tracked.'};
        let delivery = current;
        const events = [...report.events].sort((a, b) => brevoEmailEventTimestamp(a) - brevoEmailEventTimestamp(b));
        for (const item of events) delivery = applyBrevoEmailEvent(delivery, item);
        delivery = {...delivery, checkedAt, checkError: report.error || null};
        transaction.set(ref, {emailDelivery: delivery, emailStatus: delivery.status,
          lastEmailError: delivery.reason || delivery.unresolvedFailure?.reason || null,
          ...(delivery.providerEvent ? {lastEmailEvent: delivery.providerEvent} : {}),
          ...(delivery.eventAt ? {lastEmailEventAt: delivery.eventAt} : {}), updatedAt: new Date()}, {merge: true});
        return {requestId, emailDelivery: delivery, ...(report.error ? {error: report.error} : {})};
      });
    };
    await Promise.all(Array.from({length: Math.min(5, requestIds.length)}, async () => {
      while (cursor < requestIds.length) {
        const index = cursor++;
        try {results[index] = await check(requestIds[index]);}
        catch {results[index] = {requestId: requestIds[index], error: 'Could not save the email delivery check. Try again.'};}
      }
    }));
    return reply(200, {results});
  } catch (error: any) {
    return reply(error.statusCode || 500, {error: error.statusCode ? error.message : 'Unable to check email delivery.'});
  }
};
