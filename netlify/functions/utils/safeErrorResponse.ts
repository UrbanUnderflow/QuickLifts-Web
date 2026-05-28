type HeaderMap = Record<string, string | number | boolean | undefined>;

interface FirestoreLike {
  collection?: (name: string) => {
    doc: (id?: string) => {
      set: (data: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
    };
  };
}

interface SafeErrorResponseOptions {
  statusCode: number;
  headers?: HeaderMap;
  code: string;
  message?: string;
  source: string;
  incidentPrefix?: string;
  error?: unknown;
  db?: FirestoreLike | null;
  context?: Record<string, unknown>;
}

const DEFAULT_MESSAGE = "We couldn't complete that request right now. Try again in a moment.";
const INCIDENT_COLLECTION = 'client-error-incidents';

const safeHeaders = (headers?: HeaderMap): HeaderMap => ({
  ...(headers || {}),
  'Content-Type': 'application/json',
});

const randomSuffix = (): string =>
  Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, '0');

export const makeIncidentId = (prefix = 'MACRA'): string => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${date}-${randomSuffix()}`;
};

const errorMessageOf = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
};

const errorNameOf = (error: unknown): string => {
  if (error instanceof Error) return error.name;
  return typeof error;
};

const safeContext = (context?: Record<string, unknown>): Record<string, unknown> => {
  if (!context) return {};
  const entries = Object.entries(context).filter(([key]) => {
    const lower = key.toLowerCase();
    return !lower.includes('token') && !lower.includes('key') && !lower.includes('secret') && !lower.includes('authorization');
  });
  return Object.fromEntries(entries);
};

export const safeErrorBody = (
  code: string,
  message = DEFAULT_MESSAGE,
  incidentId = makeIncidentId(),
) => ({
  error: {
    code,
    message,
    incidentId,
  },
  errorCode: code,
  message,
  incidentId,
});

export const recordErrorIncident = async ({
  db,
  incidentId,
  code,
  source,
  statusCode,
  error,
  context,
}: SafeErrorResponseOptions & { incidentId: string }): Promise<void> => {
  if (!db?.collection) return;

  try {
    await db.collection(INCIDENT_COLLECTION).doc(incidentId).set({
      incidentId,
      code,
      source,
      statusCode,
      errorName: errorNameOf(error),
      errorMessage: errorMessageOf(error).slice(0, 2000),
      context: safeContext(context),
      createdAt: Date.now(),
      createdAtIso: new Date().toISOString(),
    }, { merge: true });
  } catch (logError) {
    console.warn('[safe-error-response] Failed to record incident', {
      incidentId,
      code,
      source,
      message: errorMessageOf(logError).slice(0, 500),
    });
  }
};

export const safeErrorResponse = async (options: SafeErrorResponseOptions): Promise<{
  statusCode: number;
  headers: HeaderMap;
  body: string;
}> => {
  const incidentId = makeIncidentId(options.incidentPrefix || 'MACRA');
  const message = options.message || DEFAULT_MESSAGE;

  console.error(`[safe-error-response] ${options.source} ${options.code}`, {
    incidentId,
    statusCode: options.statusCode,
    context: safeContext(options.context),
    error: errorMessageOf(options.error).slice(0, 1000),
  });

  await recordErrorIncident({ ...options, incidentId });

  return {
    statusCode: options.statusCode,
    headers: safeHeaders(options.headers),
    body: JSON.stringify(safeErrorBody(options.code, message, incidentId)),
  };
};
