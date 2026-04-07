import { createHmac, timingSafeEqual } from 'crypto';

const GROUP_MEET_HOST_ACTION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 45;

export type GroupMeetHostActionPayload = {
  requestId: string;
  candidateKey: string;
  issuedAt: number;
};

function base64UrlEncode(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function getGroupMeetHostActionSecret() {
  return (
    process.env.GROUP_MEET_HOST_ACTION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SYSTEM_OVERVIEW_SHARE_COOKIE_SECRET ||
    process.env.FIREBASE_SECRET_KEY ||
    process.env.GOOGLE_GUEST_CALENDAR_ENCRYPTION_KEY ||
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET ||
    'development-group-meet-host-action-secret'
  );
}

export function createGroupMeetHostActionToken(payload: Omit<GroupMeetHostActionPayload, 'issuedAt'>) {
  const fullPayload: GroupMeetHostActionPayload = {
    ...payload,
    issuedAt: Date.now(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = createHmac('sha256', getGroupMeetHostActionSecret()).update(encodedPayload).digest();
  return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

export function verifyGroupMeetHostActionToken(token: string): GroupMeetHostActionPayload {
  const [encodedPayload, encodedSignature] = (token || '').split('.');
  if (!encodedPayload || !encodedSignature) {
    throw new Error('The host selection link is invalid.');
  }

  const expectedSignature = createHmac('sha256', getGroupMeetHostActionSecret())
    .update(encodedPayload)
    .digest();
  const actualSignature = base64UrlDecode(encodedSignature);
  const expectedView = new Uint8Array(expectedSignature);
  const actualView = new Uint8Array(actualSignature);

  if (
    expectedView.length !== actualView.length ||
    !timingSafeEqual(expectedView, actualView)
  ) {
    throw new Error('The host selection link could not be verified.');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as GroupMeetHostActionPayload;
  if (!payload?.requestId || !payload?.candidateKey || !Number.isFinite(payload?.issuedAt)) {
    throw new Error('The host selection link is incomplete.');
  }

  if (Date.now() - payload.issuedAt > GROUP_MEET_HOST_ACTION_TOKEN_TTL_MS) {
    throw new Error('This host selection link has expired.');
  }

  return payload;
}

export function buildGroupMeetHostSelectionUrl(baseUrl: string, token: string) {
  const trimmedBaseUrl = (baseUrl || '').replace(/\/+$/, '');
  return `${trimmedBaseUrl}/group-meet/host-selection/${encodeURIComponent(token)}`;
}
