import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { NextApiRequest } from 'next';
import { OAuth2Client } from 'google-auth-library';
import type { GroupMeetGuestCalendarImportSummary } from './groupMeet';
import { getSecretManagerSecret } from './secretManager';

export const GROUP_MEET_REQUESTS_COLLECTION = 'groupMeetRequests';
export const GROUP_MEET_INVITES_SUBCOLLECTION = 'groupMeetInvites';
const GOOGLE_GUEST_CALENDAR_SCOPE = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');
const GOOGLE_GUEST_CALENDAR_CALLBACK_PATH = '/api/group-meet/calendar/google/callback';
const GOOGLE_GUEST_CALENDAR_STATE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_GUEST_GOOGLE_CALENDAR_OAUTH_SECRET_NAME = 'group-meet-guest-google-oauth';

type GuestGoogleCalendarTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  expiryDate: number | null;
  scope: string | null;
  tokenType: string | null;
  connectedEmail: string | null;
};

type GuestGoogleCalendarSecretConfig = {
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
  encryptionKey: string | null;
};

type SignedStatePayload = {
  token: string;
  issuedAt: number;
};

type DecryptedStoredGuestCalendarTokens = GuestGoogleCalendarTokens & {
  encryptedToken: string;
};

export type GroupMeetGuestCalendarImportClientSummary =
  GroupMeetGuestCalendarImportSummary & {
    connected: boolean;
    connectedEmail: string | null;
    lastConnectedAt: string | null;
    lastImportedAt: string | null;
    error: string | null;
  };

export const toIso = (value: FirebaseFirestore.Timestamp | null | undefined) =>
  value?.toDate?.().toISOString?.() || null;

let guestGoogleCalendarSecretConfigPromise: Promise<GuestGoogleCalendarSecretConfig | null> | null = null;

function base64UrlEncode(value: any) {
  const bufferValue =
    typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value as any);
  return bufferValue
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
}

function getDerivedSecretKey(secret: string) {
  return createHash('sha256').update(secret).digest();
}

function parseGuestGoogleCalendarSecretConfig(raw: string): GuestGoogleCalendarSecretConfig {
  const parsed = JSON.parse(raw) as {
    web?: {
      client_id?: string;
      client_secret?: string;
      redirect_uri?: string;
      redirect_uris?: string[];
      encryption_key?: string;
    };
    client_id?: string;
    client_secret?: string;
    redirect_uri?: string;
    redirect_uris?: string[];
    encryption_key?: string;
  };
  const web = parsed.web || null;

  return {
    clientId: web?.client_id?.trim() || parsed.client_id?.trim() || null,
    clientSecret: web?.client_secret?.trim() || parsed.client_secret?.trim() || null,
    redirectUri:
      web?.redirect_uri?.trim() ||
      web?.redirect_uris?.[0]?.trim() ||
      parsed.redirect_uri?.trim() ||
      parsed.redirect_uris?.[0]?.trim() ||
      null,
    encryptionKey:
      web?.encryption_key?.trim() ||
      parsed.encryption_key?.trim() ||
      null,
  };
}

async function getGuestGoogleCalendarSecretConfig() {
  if (guestGoogleCalendarSecretConfigPromise) {
    return guestGoogleCalendarSecretConfigPromise;
  }

  guestGoogleCalendarSecretConfigPromise = (async () => {
    const inline = process.env.GOOGLE_GUEST_CALENDAR_OAUTH_JSON?.trim();
    if (inline) {
      return parseGuestGoogleCalendarSecretConfig(inline);
    }

    const secretName =
      process.env.GOOGLE_GUEST_CALENDAR_OAUTH_SECRET_NAME?.trim() ||
      process.env.GROUP_MEET_GUEST_GOOGLE_CALENDAR_OAUTH_SECRET_NAME?.trim() ||
      (process.env.NODE_ENV === 'production'
        ? DEFAULT_GUEST_GOOGLE_CALENDAR_OAUTH_SECRET_NAME
        : '');

    if (!secretName) {
      return null;
    }

    return parseGuestGoogleCalendarSecretConfig(await getSecretManagerSecret(secretName));
  })();

  return guestGoogleCalendarSecretConfigPromise;
}

async function getGuestCalendarEncryptionSecret() {
  const inlineValue = process.env.GOOGLE_GUEST_CALENDAR_ENCRYPTION_KEY?.trim();
  if (inlineValue) {
    return inlineValue;
  }

  const encryptionSecretName =
    process.env.GOOGLE_GUEST_CALENDAR_ENCRYPTION_SECRET_NAME?.trim() || '';
  if (encryptionSecretName) {
    const value = (await getSecretManagerSecret(encryptionSecretName)).trim();
    if (value) {
      return value;
    }
  }

  const secretConfig = await getGuestGoogleCalendarSecretConfig();
  const value =
    secretConfig?.encryptionKey ||
    process.env.SYSTEM_OVERVIEW_SHARE_COOKIE_SECRET?.trim() ||
    process.env.FIREBASE_SECRET_KEY?.trim() ||
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!value) {
    throw new Error('Google Calendar import is not available right now.');
  }
  return value;
}

async function getGuestCalendarClientId() {
  const secretConfig = await getGuestGoogleCalendarSecretConfig();
  const value =
    secretConfig?.clientId ||
    process.env.GOOGLE_GUEST_CALENDAR_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  if (!value) {
    throw new Error('Google Calendar import is not available right now.');
  }
  return value;
}

async function getGuestCalendarClientSecret() {
  const secretConfig = await getGuestGoogleCalendarSecretConfig();
  const value =
    secretConfig?.clientSecret ||
    process.env.GOOGLE_GUEST_CALENDAR_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!value) {
    throw new Error('Google Calendar import is not available right now.');
  }
  return value;
}

export function getGroupMeetBaseUrl(req: NextApiRequest) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] || 'https' : forwardedProto || 'http';
  return process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${req.headers.host}`;
}

export async function getGuestGoogleCalendarRedirectUri(req: NextApiRequest) {
  const secretConfig = await getGuestGoogleCalendarSecretConfig();
  return (
    secretConfig?.redirectUri ||
    process.env.GOOGLE_GUEST_CALENDAR_REDIRECT_URI?.trim() ||
    process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ||
    `${getGroupMeetBaseUrl(req)}${GOOGLE_GUEST_CALENDAR_CALLBACK_PATH}`
  );
}

export function toPublicGuestCalendarErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');

  if (/not configured|not available right now|client id|client secret|redirect uri|encryption/i.test(message)) {
    return 'Google Calendar connect is not available right now. You can still add your availability manually.';
  }

  if (/access_denied|canceled/i.test(message)) {
    return 'Google Calendar connection was canceled.';
  }

  return message || 'Google Calendar connect could not be completed.';
}

export function hasTruthyHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.some((entry) => entry === 'true' || entry === '1');
  }

  return value === 'true' || value === '1';
}

export function shouldForceDevFirebase(req: NextApiRequest) {
  if (hasTruthyHeader(req.headers?.['x-force-dev-firebase'])) {
    return true;
  }

  const hostHeader = req.headers?.['x-forwarded-host'] || req.headers?.host || '';
  const host = Array.isArray(hostHeader) ? hostHeader[0] || '' : hostHeader;
  const normalizedHost = host.trim().toLowerCase();

  return (
    normalizedHost.startsWith('localhost:') ||
    normalizedHost.startsWith('127.0.0.1:') ||
    normalizedHost.startsWith('[::1]:')
  );
}

export async function findGroupMeetInviteByToken(
  db: FirebaseFirestore.Firestore,
  token: string
) {
  let snapshot: FirebaseFirestore.QuerySnapshot | null = null;

  try {
    snapshot = await db
      .collectionGroup(GROUP_MEET_INVITES_SUBCOLLECTION)
      .where('token', '==', token)
      .limit(1)
      .get();
  } catch (error) {
    console.warn('[group-meet-public] Token lookup fell back to scan:', error);
  }

  let inviteDoc = snapshot?.empty ? null : snapshot?.docs?.[0] || null;

  if (!inviteDoc) {
    const fallbackSnapshot = await db.collectionGroup(GROUP_MEET_INVITES_SUBCOLLECTION).get();
    inviteDoc =
      fallbackSnapshot.docs.find((docSnap) => docSnap.id === token || docSnap.data()?.token === token) || null;
  }

  if (!inviteDoc) return null;
  const requestRef = inviteDoc.ref.parent.parent;
  if (!requestRef) return null;

  const requestDoc = await requestRef.get();
  if (!requestDoc.exists) return null;

  return { inviteDoc, requestDoc };
}

async function getGoogleGuestOAuthClient(req: NextApiRequest) {
  return new OAuth2Client({
    clientId: await getGuestCalendarClientId(),
    clientSecret: await getGuestCalendarClientSecret(),
    redirectUri: await getGuestGoogleCalendarRedirectUri(req),
  });
}

async function signGuestCalendarState(payload: SignedStatePayload) {
  const secretKey = getDerivedSecretKey(await getGuestCalendarEncryptionSecret());
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac('sha256', secretKey as any).update(encodedPayload).digest();
  return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

export async function verifyGuestCalendarState(state: string): Promise<SignedStatePayload> {
  const [encodedPayload, encodedSignature] = (state || '').split('.');
  if (!encodedPayload || !encodedSignature) {
    throw new Error('Missing or invalid Google Calendar state.');
  }

  const secretKey = getDerivedSecretKey(await getGuestCalendarEncryptionSecret());
  const expectedSignature = createHmac('sha256', secretKey as any).update(encodedPayload).digest();
  const providedSignature = base64UrlDecode(encodedSignature);

  if (
    expectedSignature.length !== providedSignature.length ||
    !timingSafeEqual(expectedSignature as any, providedSignature as any)
  ) {
    throw new Error('Google Calendar state verification failed.');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as SignedStatePayload;
  if (!payload?.token || !payload?.issuedAt) {
    throw new Error('Google Calendar state payload is incomplete.');
  }

  if (Date.now() - payload.issuedAt > GOOGLE_GUEST_CALENDAR_STATE_TTL_MS) {
    throw new Error('Google Calendar connect session expired. Please try again.');
  }

  return payload;
}

export async function buildGuestGoogleCalendarConnectUrl(req: NextApiRequest, token: string) {
  const client = await getGoogleGuestOAuthClient(req);
  const state = await signGuestCalendarState({
    token,
    issuedAt: Date.now(),
  });

  return client.generateAuthUrl({
    access_type: 'offline',
    include_granted_scopes: true,
    prompt: 'consent',
    scope: GOOGLE_GUEST_CALENDAR_SCOPE,
    state,
  });
}

async function fetchGoogleUserEmail(accessToken: string) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => ({}))) as { email?: string };
  return payload.email?.trim() || null;
}

export async function exchangeGuestGoogleCalendarCode(
  req: NextApiRequest,
  code: string
): Promise<GuestGoogleCalendarTokens> {
  const client = await getGoogleGuestOAuthClient(req);
  const { tokens } = await client.getToken(code);
  const accessToken = tokens.access_token?.trim() || null;

  if (!accessToken) {
    throw new Error('Google Calendar did not return an access token.');
  }

  return {
    accessToken,
    refreshToken: tokens.refresh_token?.trim() || null,
    expiryDate: typeof tokens.expiry_date === 'number' ? tokens.expiry_date : null,
    scope: tokens.scope?.trim() || null,
    tokenType: tokens.token_type?.trim() || null,
    connectedEmail: await fetchGoogleUserEmail(accessToken),
  };
}

export async function encryptGuestGoogleCalendarTokens(tokens: GuestGoogleCalendarTokens) {
  const secretKey = getDerivedSecretKey(await getGuestCalendarEncryptionSecret());
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey as any, iv as any);
  const plaintext = Buffer.from(JSON.stringify(tokens), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext as any), cipher.final() as any]);
  const authTag = cipher.getAuthTag();

  return [base64UrlEncode(iv), base64UrlEncode(authTag), base64UrlEncode(encrypted)].join('.');
}

async function decryptGuestGoogleCalendarTokens(encryptedToken: string): Promise<GuestGoogleCalendarTokens> {
  const [ivEncoded, authTagEncoded, payloadEncoded] = (encryptedToken || '').split('.');
  if (!ivEncoded || !authTagEncoded || !payloadEncoded) {
    throw new Error('Stored Google Calendar credentials are invalid.');
  }

  const secretKey = getDerivedSecretKey(await getGuestCalendarEncryptionSecret());
  const decipher = createDecipheriv(
    'aes-256-gcm',
    secretKey as any,
    base64UrlDecode(ivEncoded) as any
  );
  decipher.setAuthTag(base64UrlDecode(authTagEncoded) as any);
  const decrypted = Buffer.concat([
    decipher.update(base64UrlDecode(payloadEncoded) as any),
    decipher.final() as any,
  ]);

  return JSON.parse(decrypted.toString('utf8')) as GuestGoogleCalendarTokens;
}

export function buildGroupMeetGuestCalendarImportSummary(
  calendarImportValue: FirebaseFirestore.DocumentData | null | undefined
): GroupMeetGuestCalendarImportClientSummary | null {
  const raw = calendarImportValue || null;
  if (!raw || raw.provider !== 'google') {
    return null;
  }

  const status =
    raw.status === 'connected' || raw.status === 'disconnected' || raw.status === 'error'
      ? raw.status
      : 'disconnected';
  const connectedAt = toIso(raw.connectedAt);
  const disconnectedAt = toIso(raw.disconnectedAt);
  const lastSyncedAt = toIso(raw.lastSyncedAt);
  const googleAccountEmail = raw.googleAccountEmail || null;
  const lastSyncStatus =
    raw.lastSyncStatus === 'success' || raw.lastSyncStatus === 'error' || raw.lastSyncStatus === 'never'
      ? raw.lastSyncStatus
      : 'never';
  const lastSyncError = raw.lastSyncError || null;

  return {
    provider: 'google',
    status,
    connectedAt,
    disconnectedAt,
    lastSyncedAt,
    lastSyncStatus,
    lastSyncError,
    googleAccountEmail,
    connected: status === 'connected',
    connectedEmail: googleAccountEmail,
    lastConnectedAt: connectedAt,
    lastImportedAt: lastSyncedAt,
    error: lastSyncError,
  };
}

async function refreshGuestGoogleCalendarTokens(
  req: NextApiRequest,
  currentTokens: GuestGoogleCalendarTokens
) {
  if (!currentTokens.refreshToken) {
    if (currentTokens.accessToken) {
      return currentTokens;
    }

    throw new Error('Google Calendar needs to be reconnected before it can import availability.');
  }

  const client = await getGoogleGuestOAuthClient(req);
  client.setCredentials({ refresh_token: currentTokens.refreshToken });
  const refreshResponse = await client.refreshAccessToken();
  const credentials = refreshResponse.credentials || client.credentials;
  const accessToken = credentials.access_token?.trim() || currentTokens.accessToken;

  if (!accessToken) {
    throw new Error('Google Calendar did not return a refreshed access token.');
  }

  return {
    accessToken,
    refreshToken: credentials.refresh_token?.trim() || currentTokens.refreshToken,
    expiryDate:
      typeof credentials.expiry_date === 'number'
        ? credentials.expiry_date
        : currentTokens.expiryDate,
    scope: credentials.scope?.trim() || currentTokens.scope,
    tokenType: credentials.token_type?.trim() || currentTokens.tokenType,
    connectedEmail: currentTokens.connectedEmail,
  } satisfies GuestGoogleCalendarTokens;
}

export async function getGuestGoogleCalendarAccessToken(args: {
  req: NextApiRequest;
  inviteData: FirebaseFirestore.DocumentData;
}) {
  const encryptedToken = args.inviteData?.calendarImport?.encryptedToken;
  if (!encryptedToken || typeof encryptedToken !== 'string') {
    throw new Error('Google Calendar is not connected for this invite yet.');
  }

  const storedTokens = await decryptGuestGoogleCalendarTokens(encryptedToken);
  const isAccessTokenFresh =
    storedTokens.accessToken &&
    (!storedTokens.expiryDate || storedTokens.expiryDate > Date.now() + 60_000);

  const nextTokens = isAccessTokenFresh
    ? storedTokens
    : await refreshGuestGoogleCalendarTokens(args.req, storedTokens);

  if (!nextTokens.accessToken) {
    throw new Error('Google Calendar did not return a usable access token.');
  }

  return {
    accessToken: nextTokens.accessToken,
    tokens: {
      ...nextTokens,
      encryptedToken: await encryptGuestGoogleCalendarTokens(nextTokens),
    } satisfies DecryptedStoredGuestCalendarTokens,
  };
}

export async function fetchGuestGoogleCalendarBusyIntervals(args: {
  accessToken: string;
  timeMin: string;
  timeMax: string;
  timeZone: string;
}) {
  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: args.timeMin,
      timeMax: args.timeMax,
      timeZone: args.timeZone,
      items: [{ id: 'primary' }],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    calendars?: Record<string, { busy?: Array<{ start?: string; end?: string }> }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Google Calendar busy lookup failed.');
  }

  const busy = payload.calendars?.primary?.busy || [];

  return busy
    .map((entry) => ({
      start: entry.start || '',
      end: entry.end || '',
    }))
    .filter((entry) => entry.start && entry.end);
}
