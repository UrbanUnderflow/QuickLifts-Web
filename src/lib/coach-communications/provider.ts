import { createPublicKey, verify } from 'crypto';

export const smsProvider = () => process.env.COACH_COMMUNICATIONS_SMS_PROVIDER || 'twilio';
export const smsSender = () => smsProvider() === 'telnyx' ? process.env.TELNYX_FROM_NUMBER || '' : smsProvider() === 'twilio' ? process.env.TWILIO_FROM_NUMBER || '' : '';
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const phone = (value: unknown): value is string => typeof value === 'string' && /^\+[1-9]\d{9,14}$/.test(value);
const httpsEndpoint = (value: unknown): value is string => typeof value === 'string' && /^https:\/\/[^?#]+$/.test(value);
export const telnyxWebhookUrl = () => process.env.COACH_COMMUNICATIONS_TELNYX_WEBHOOK_URL || '';
export function providerConfigured() {
  if (smsProvider() === 'telnyx') return !!process.env.TELNYX_API_KEY && phone(smsSender()) && uuid(process.env.TELNYX_MESSAGING_PROFILE_ID) && validPublicKey() && httpsEndpoint(telnyxWebhookUrl());
  return smsProvider() === 'twilio' && !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!smsSender() && httpsEndpoint(process.env.COACH_COMMUNICATIONS_STATUS_WEBHOOK_URL) && /^https:\/\//.test(process.env.COACH_COMMUNICATIONS_SMS_WEBHOOK_URL || '');
}
function publicKey() {
  const raw = Buffer.from(process.env.TELNYX_PUBLIC_KEY || '', 'base64');
  if (raw.length !== 32) throw new Error('Invalid public key');
  return createPublicKey({ key: Buffer.concat([Uint8Array.from(Buffer.from('302a300506032b6570032100', 'hex')), Uint8Array.from(raw)]), format: 'der', type: 'spki' });
}
function validPublicKey() { try { publicKey(); return true; } catch { return false; } }
export function verifyTelnyxEvent(raw: Buffer, signature: unknown, timestamp: unknown, now = Date.now()): any | null {
  if (raw.length > 32768 || typeof signature !== 'string' || typeof timestamp !== 'string' || !/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return null;
  try {
    const sig = Buffer.from(signature, 'base64');
    if (sig.length !== 64 || !verify(null, Uint8Array.from([...Buffer.from(`${timestamp}|`), ...raw]), publicKey(), Uint8Array.from(sig))) return null;
    const event = JSON.parse(raw.toString('utf8'))?.data, p = event?.payload;
    if (!uuid(event?.id) || !uuid(p?.id) || p?.messaging_profile_id !== process.env.TELNYX_MESSAGING_PROFILE_ID || !uuid(p?.messaging_profile_id) || p?.type !== 'SMS' || !phone(p?.from?.phone_number) || !Array.isArray(p?.to) || p.to.length !== 1 || !phone(p.to[0]?.phone_number)) return null;
    return event;
  } catch { return null; }
}
export function telnyxIncomingForm(event: any): Record<string, string> | null {
  const p = event?.payload;
  if (event?.event_type !== 'message.received' || p?.direction !== 'inbound' || p?.to?.[0]?.phone_number !== process.env.TELNYX_FROM_NUMBER || !uuid(p?.id) || typeof p?.text !== 'string') return null;
  return { From: p.from.phone_number, To: p.to[0].phone_number, Body: p.text, MessageSid: `telnyx_${p.id}` };
}
export function telnyxDeliveryForm(event: any, jobId: unknown): Record<string, string> | null {
  const p = event?.payload;
  // Bind an early callback to its exact durable job using the signed request URL.
  if (typeof jobId !== 'string' || !/^[a-f0-9]{64}$/.test(jobId) || !httpsEndpoint(telnyxWebhookUrl()) || p?.webhook_url !== `${telnyxWebhookUrl()}?job=${jobId}` || p?.direction !== 'outbound' || p?.from?.phone_number !== process.env.TELNYX_FROM_NUMBER || !uuid(p?.id)) return null;
  const states: Record<string, string> = { delivered: 'delivered', delivery_failed: 'undelivered', sending_failed: 'failed', failed: 'failed', expired: 'undelivered' };
  const status = event.event_type === 'message.sent' ? (['queued', 'sent'].includes(p?.to?.[0]?.status) ? 'sent' : null) : event.event_type === 'message.finalized' ? states[p?.to?.[0]?.status] : null;
  return status ? { From: p.from.phone_number, To: p.to[0].phone_number, MessageSid: `telnyx_${p.id}`, MessageStatus: status } : null;
}
export async function sendTelnyxSms({ to, body, jobId }: { to: string; body: string; jobId: string }): Promise<{ state: 'accepted' | 'failed' | 'unknown'; providerId?: string }> {
  if (smsProvider() !== 'telnyx' || !providerConfigured() || !phone(to) || !/^[a-f0-9]{64}$/.test(jobId)) return { state: 'failed' };
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': jobId },
      body: JSON.stringify({ from: smsSender(), to, text: body, type: 'SMS', messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID, webhook_url: `${telnyxWebhookUrl()}?job=${jobId}`, use_profile_webhooks: false }),
    });
    const result = await response.json().catch(() => ({}));
    const accepted = result?.data;
    if (response.ok && uuid(accepted?.id) && accepted.direction === 'outbound' && accepted.type === 'SMS' && accepted.messaging_profile_id === process.env.TELNYX_MESSAGING_PROFILE_ID && accepted.from?.phone_number === smsSender() && Array.isArray(accepted.to) && accepted.to.length === 1 && accepted.to[0]?.phone_number === to) return { state: 'accepted', providerId: `telnyx_${accepted.id}` };
    return { state: response.ok || response.status >= 500 || [408, 409].includes(response.status) ? 'unknown' : 'failed' };
  } catch { return { state: 'unknown' }; }
  finally { clearTimeout(timeout); }
}
