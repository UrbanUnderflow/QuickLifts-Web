import { JWT, OAuth2Client } from "google-auth-library";
import type { GroupMeetCalendarSetup } from "./groupMeet";
import { getSecretManagerSecret } from "./secretManager";

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const DEFAULT_GOOGLE_CALENDAR_DELEGATED_USER_EMAIL = "tre@fitwithpulse.ai";

type GoogleServiceAccountSecret = {
  client_email?: string;
  private_key?: string;
};

type ServiceAccountSecretResolution = {
  secret: GoogleServiceAccountSecret | null;
  source: "env_json" | "secret_manager" | null;
  secretName: string | null;
  error: Error | null;
};

function normalizePrivateKey(value?: string): string | undefined {
  if (!value) return undefined;

  let normalized = value.trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }

  normalized = normalized.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n");
  return normalized || undefined;
}

function parseServiceAccountSecret(raw: string): GoogleServiceAccountSecret {
  const parsed = JSON.parse(raw) as GoogleServiceAccountSecret;
  return {
    client_email: parsed.client_email,
    private_key: normalizePrivateKey(parsed.private_key),
  };
}

function getGoogleCalendarServiceAccountSecretName() {
  return (
    process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_SECRET_NAME ||
    process.env.GROUP_MEET_GOOGLE_SERVICE_ACCOUNT_SECRET_NAME ||
    "GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON"
  );
}

function getGoogleCalendarDelegatedUserEmail() {
  return (
    process.env.GOOGLE_CALENDAR_DELEGATED_USER_EMAIL ||
    process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL ||
    DEFAULT_GOOGLE_CALENDAR_DELEGATED_USER_EMAIL
  );
}

async function getServiceAccountSecret(): Promise<ServiceAccountSecretResolution> {
  const raw =
    process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON ||
    process.env.GROUP_MEET_GOOGLE_SERVICE_ACCOUNT_JSON;

  if (raw) {
    try {
      return {
        secret: parseServiceAccountSecret(raw),
        source: "env_json",
        secretName: null,
        error: null,
      };
    } catch (_error) {
      return {
        secret: null,
        source: "env_json",
        secretName: null,
        error: new Error(
          "Failed to parse Google Calendar service account JSON from env vars.",
        ),
      };
    }
  }

  const secretName = getGoogleCalendarServiceAccountSecretName();
  try {
    return {
      secret: parseServiceAccountSecret(
        await getSecretManagerSecret(secretName),
      ),
      source: "secret_manager",
      secretName,
      error: null,
    };
  } catch (error) {
    return {
      secret: null,
      source: "secret_manager",
      secretName,
      error:
        error instanceof Error
          ? error
          : new Error("Failed to load Google Calendar service account secret."),
    };
  }
}

async function getOAuthAccessToken() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const client = new OAuth2Client({
    clientId,
    clientSecret,
    redirectUri:
      process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
      "https://developers.google.com/oauthplayground",
  });
  client.setCredentials({ refresh_token: refreshToken });

  const accessTokenResult = await client.getAccessToken();
  const accessToken =
    typeof accessTokenResult === "string"
      ? accessTokenResult
      : accessTokenResult.token;

  if (!accessToken) {
    throw new Error("Failed to retrieve Google Calendar OAuth access token.");
  }

  return {
    accessToken,
    organizerEmail: process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL || null,
  };
}

async function getServiceAccountAccessToken() {
  const secretResolution = await getServiceAccountSecret();
  const serviceAccountSecret = secretResolution.secret;
  const clientEmail =
    serviceAccountSecret?.client_email ||
    process.env.GOOGLE_CALENDAR_CLIENT_EMAIL;
  const privateKey =
    serviceAccountSecret?.private_key ||
    normalizePrivateKey(process.env.GOOGLE_CALENDAR_PRIVATE_KEY);

  if (!clientEmail || !privateKey) {
    if (secretResolution.error) {
      throw secretResolution.error;
    }
    return null;
  }

  const client = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [GOOGLE_CALENDAR_SCOPE],
    subject: getGoogleCalendarDelegatedUserEmail(),
  });

  const accessTokenResult = await client.getAccessToken();
  const accessToken =
    typeof accessTokenResult === "string"
      ? accessTokenResult
      : accessTokenResult?.token;

  if (!accessToken) {
    throw new Error(
      "Failed to retrieve Google Calendar service-account access token.",
    );
  }

  return {
    accessToken,
    organizerEmail: getGoogleCalendarDelegatedUserEmail() || clientEmail,
  };
}

export async function getGoogleCalendarAuth() {
  const oauthAuth = await getOAuthAccessToken();
  if (oauthAuth) {
    return oauthAuth;
  }

  const serviceAccountAuth = await getServiceAccountAccessToken();
  if (serviceAccountAuth) {
    return serviceAccountAuth;
  }

  throw new Error(
    "Google Calendar is not configured. Set OAuth refresh-token env vars or service-account credentials, or expose the service-account JSON through Secret Manager.",
  );
}

export function getGoogleCalendarId() {
  return (
    process.env.GOOGLE_CALENDAR_ID ||
    process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL ||
    "primary"
  );
}

export async function getGoogleCalendarSetupStatus(): Promise<GroupMeetCalendarSetup> {
  const calendarId = getGoogleCalendarId();
  const delegatedUserEmail = getGoogleCalendarDelegatedUserEmail();
  const organizerEmail =
    process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL || delegatedUserEmail || null;

  if (
    process.env.GOOGLE_CALENDAR_CLIENT_ID &&
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET &&
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN
  ) {
    return {
      ready: true,
      source: "oauth",
      message:
        "Google Calendar is configured through OAuth refresh-token credentials.",
      secretName: null,
      delegatedUserEmail,
      organizerEmail,
      calendarId,
    };
  }

  const secretResolution = await getServiceAccountSecret();
  const serviceAccountSecret = secretResolution.secret;
  const clientEmail =
    serviceAccountSecret?.client_email ||
    process.env.GOOGLE_CALENDAR_CLIENT_EMAIL ||
    null;
  const privateKey =
    serviceAccountSecret?.private_key ||
    normalizePrivateKey(process.env.GOOGLE_CALENDAR_PRIVATE_KEY) ||
    null;
  const credentialSource: GroupMeetCalendarSetup["source"] =
    serviceAccountSecret?.client_email && serviceAccountSecret?.private_key
      ? secretResolution.source || "env_json"
      : "split_env";

  if (clientEmail && privateKey) {
    return {
      ready: true,
      source: credentialSource,
      message:
        credentialSource === "secret_manager"
          ? `Google Calendar is ready. Service-account credentials are loading from Secret Manager secret ${secretResolution.secretName}, using delegated mailbox ${delegatedUserEmail}.`
          : credentialSource === "env_json"
            ? `Google Calendar is ready. Service-account credentials are loading from an env JSON blob, using delegated mailbox ${delegatedUserEmail}.`
            : `Google Calendar is ready. Service-account credentials are loading from split env vars, using delegated mailbox ${delegatedUserEmail}.`,
      secretName: secretResolution.secretName,
      delegatedUserEmail,
      organizerEmail,
      calendarId,
    };
  }

  if (secretResolution.error) {
    return {
      ready: false,
      source: secretResolution.source || "missing",
      message: secretResolution.error.message,
      secretName: secretResolution.secretName,
      delegatedUserEmail,
      organizerEmail,
      calendarId,
    };
  }

  return {
    ready: false,
    source: "missing",
    message:
      "Google Calendar is not configured yet. Add OAuth credentials, or expose the service-account JSON through Secret Manager or env vars.",
    secretName: getGoogleCalendarServiceAccountSecretName(),
    delegatedUserEmail,
    organizerEmail,
    calendarId,
  };
}

function getTimeZoneOffsetMs(timeZone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

export function convertLocalDateMinutesToUtcIso(
  date: string,
  totalMinutes: number,
  timeZone: string,
) {
  const [yearRaw, monthRaw, dayRaw] = date.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let utcGuess = Date.UTC(year, month - 1, day, hours, minutes, 0);
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const offsetMs = getTimeZoneOffsetMs(timeZone, new Date(utcGuess));
    const corrected =
      Date.UTC(year, month - 1, day, hours, minutes, 0) - offsetMs;
    if (corrected === utcGuess) break;
    utcGuess = corrected;
  }

  return new Date(utcGuess).toISOString();
}
