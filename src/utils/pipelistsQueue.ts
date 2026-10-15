// This module is deliberately independent of Firebase, profile state and send helpers.
// The API remains the authorization boundary; the client only reads its existing owner GET.
export type QueueIdentity = { uid: string; getIdToken: () => Promise<string> };
export type QueueStep = {
  id: string;
  subject: string;
  sentAt: string;
  messageId: string;
  tracking: {
    status: string;
    lastEventAt: string;
    deliveredAt: string;
    openedAt: string;
    clickedAt: string;
    lastIssueAt: string;
    openCount: number | null;
    clickCount: number | null;
  } | null;
};
export type QueueSequence = {
  id: string;
  listId: string;
  itemId: string;
  status: string;
  fromEmail: string;
  toEmail: string;
  ccEmails: string[];
  bccEmails: string[];
  nextStepIndex: number | null;
  nextSendAt: string;
  attempt: { index: number | null; startedAt: string } | null;
  lastError: string;
  updatedAt: string;
  steps: QueueStep[];
};

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const count = (value: unknown): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
const texts = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export function validateQueueListId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || value.includes('/')) {
    throw new Error('Enter a valid list ID (up to 200 characters, without a slash).');
  }
  return value.trim();
}

export function parseQueueSequences(payload: unknown, listId: string, ownerUid: string): QueueSequence[] {
  const body = record(payload);
  if (body?.success !== true || !Array.isArray(body.sequences)) {
    throw new Error('Stored queue status could not be read. No queue result is available.');
  }
  return body.sequences.map(value => {
    const sequence = record(value);
    if (!sequence || sequence.listId !== listId || sequence.ownerUid !== ownerUid || !text(sequence.id) || !text(sequence.itemId) || !text(sequence.status) || !Array.isArray(sequence.steps)) {
      throw new Error('Stored queue status did not match the requested owner and list. No queue result is available.');
    }
    const attempt = record(sequence.attempt);
    return {
      id: text(sequence.id), listId, itemId: text(sequence.itemId), status: text(sequence.status),
      fromEmail: text(sequence.fromEmail), toEmail: text(sequence.toEmail),
      ccEmails: texts(sequence.ccEmails), bccEmails: texts(sequence.bccEmails),
      nextStepIndex: count(sequence.nextStepIndex), nextSendAt: text(sequence.nextSendAt),
      attempt: sequence.attempt ? { index: count(attempt?.index), startedAt: text(attempt?.startedAt) } : null,
      lastError: text(sequence.lastError), updatedAt: text(sequence.updatedAt),
      steps: sequence.steps.map(value => {
        const step = record(value);
        if (!step) throw new Error('Stored email evidence is malformed. No queue result is available.');
        const tracking = record(step.tracking);
        return {
          id: text(step.id), subject: text(step.subject), sentAt: text(step.sentAt), messageId: text(step.messageId),
          tracking: tracking ? {
            status: text(tracking.status), lastEventAt: text(tracking.lastEventAt),
            deliveredAt: text(tracking.deliveredAt), openedAt: text(tracking.openedAt),
            clickedAt: text(tracking.clickedAt), lastIssueAt: text(tracking.lastIssueAt),
            openCount: count(tracking.openCount), clickCount: count(tracking.clickCount),
          } : null,
        };
      }),
    };
  });
}

export async function readQueueSequences({ identity, listId, signal, fetchStatus = fetch }: {
  identity: QueueIdentity;
  listId: string;
  signal?: AbortSignal;
  fetchStatus?: typeof fetch;
}): Promise<QueueSequence[]> {
  const scope = validateQueueListId(listId);
  if (!identity?.uid || typeof identity.getIdToken !== 'function') throw new Error('An existing signed-in owner session is required.');
  const token = await identity.getIdToken();
  if (signal?.aborted) throw new Error('Queue read was cancelled.');
  if (!token) throw new Error('An existing signed-in owner session is required.');
  const response = await fetchStatus(`/api/pipelists/email-sequence?listId=${encodeURIComponent(scope)}`, {
    method: 'GET', headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store', redirect: 'error', signal,
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    if (response.status === 401) throw new Error('Your existing session could not be verified. Sign in to PipeLists and return to this page.');
    if (response.status === 403) throw new Error('This queue is available only to the existing PipeLists owner.');
    if (response.status === 404) throw new Error('This list is unavailable to the signed-in owner.');
    throw new Error('Stored queue status could not be read. Try inspecting the list again.');
  }
  return parseQueueSequences(payload, scope, identity.uid);
}

export function formatQueueTimestamp(value: string, missing = 'Not recorded'): string {
  if (!value) return missing;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? `Unrecognized timestamp: ${value}` : date.toISOString().replace('T', ' ').replace('.000Z', 'Z').replace(/Z$/, ' UTC');
}
