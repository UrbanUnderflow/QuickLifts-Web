import type { User } from 'firebase/auth';

export type PipeListsRunbookActor = {
  uid: string;
  email: string;
  name: string;
};

export type PipeListsRunbookDocument = {
  id: string;
  title: string;
  content: string;
  version: number;
  updatedAt: string | null;
  updatedBy: PipeListsRunbookActor;
};

export type PipeListsRunbookRevision = {
  id: string;
  version: number;
  titleBefore: string;
  titleAfter: string;
  contentBefore?: string;
  contentAfter?: string;
  changeSummary: string;
  changedAt: string | null;
  changedBy: PipeListsRunbookActor;
};

export type PipeListsRunbookSnapshot = {
  workspace: {
    id: string;
    name: string;
    ownerEmail: string;
  };
  runbook: PipeListsRunbookDocument;
  revisions: PipeListsRunbookRevision[];
  hasMoreHistory: boolean;
  actor: PipeListsRunbookActor & {
    role: 'owner' | 'editor';
    membershipSource: 'workspace-owner' | 'pipe-list-editor';
  };
  changed?: boolean;
};

export type PipeListsRunbookCurrentResponse = Pick<PipeListsRunbookSnapshot, 'runbook' | 'actor'>;

export type PipeListsRunbookRevisionResponse = {
  revision: PipeListsRunbookRevision & {
    contentBefore: string;
    contentAfter: string;
  };
  actor: PipeListsRunbookSnapshot['actor'];
};

type RunbookErrorPayload = {
  error?: string;
  code?: string;
  snapshot?: PipeListsRunbookSnapshot;
};

export class PipeListsRunbookConflictError extends Error {
  snapshot?: PipeListsRunbookSnapshot;

  constructor(message: string, snapshot?: PipeListsRunbookSnapshot) {
    super(message);
    this.name = 'PipeListsRunbookConflictError';
    this.snapshot = snapshot;
  }
}

async function requestRunbook<ResponseBody>(
  user: User,
  path: string,
  init?: RequestInit,
): Promise<ResponseBody> {
  const idToken = await user.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as RunbookErrorPayload &
    Partial<PipeListsRunbookSnapshot>;

  if (response.status === 409 && payload.code === 'VERSION_CONFLICT') {
    throw new PipeListsRunbookConflictError(
      payload.error || 'A teammate saved a newer version.',
      payload.snapshot,
    );
  }
  if (!response.ok) {
    throw new Error(payload.error || 'The shared runbook could not be loaded.');
  }

  return payload as ResponseBody;
}

export function loadPipeListsRunbook(user: User, beforeVersion?: number) {
  const query = beforeVersion ? `?beforeVersion=${encodeURIComponent(beforeVersion)}` : '';
  return requestRunbook<PipeListsRunbookSnapshot>(user, `/api/pipelists/runbook${query}`);
}

export async function checkPipeListsRunbookCurrent(user: User) {
  return requestRunbook<PipeListsRunbookCurrentResponse>(user, '/api/pipelists/runbook?currentOnly=1');
}

export function loadPipeListsRunbookRevision(user: User, revisionId: string) {
  return requestRunbook<PipeListsRunbookRevisionResponse>(
    user,
    `/api/pipelists/runbook?revisionId=${encodeURIComponent(revisionId)}`,
  );
}

export function savePipeListsRunbook(
  user: User,
  input: {
    title: string;
    content: string;
    changeSummary: string;
    expectedVersion: number;
  },
) {
  return requestRunbook<PipeListsRunbookSnapshot>(user, '/api/pipelists/runbook', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
