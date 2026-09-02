import type { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import {
  getSimpBudgetAuth,
  getSimpBudgetFirestore,
} from '../../../../netlify/functions/utils/getSimpBudgetServiceAccount';
import {
  buildPipeListsRunbookLineDiff,
  DEFAULT_PIPELISTS_RUNBOOK_CONTENT,
  DEFAULT_PIPELISTS_RUNBOOK_TITLE,
  PIPELISTS_RUNBOOK_CONTENT_MAX_LENGTH,
  PIPELISTS_RUNBOOK_ID,
  PIPELISTS_RUNBOOK_TITLE_MAX_LENGTH,
  summarizePipeListsRunbookDiff,
} from '../../../utils/pipelistsRunbook';

const WORKSPACES_COLLECTION = 'pipeListWorkspaces';
const WORKSPACE_ID = 'pulse-sales';
const MEMBERS_COLLECTION = 'members';
const RUNBOOKS_COLLECTION = 'runbooks';
const REVISIONS_COLLECTION = 'revisions';
const PIPELIST_SHARES_COLLECTION = 'pipeListShares';
const PIPELIST_PROFILES_COLLECTION = 'pipeListProfiles';
const HISTORY_PAGE_SIZE = 50;
const RUNBOOK_CONTENT_MAX_BYTES = 300_000;
const RUNBOOK_SUMMARY_MAX_LENGTH = 240;
const DEFAULT_OWNER_EMAIL = 'tremaine.grant@gmail.com';

type Firestore = FirebaseFirestore.Firestore;
type DocumentData = FirebaseFirestore.DocumentData;

type RunbookActor = {
  uid: string;
  email: string;
  name: string;
  role: 'owner' | 'editor';
  membershipSource: 'workspace-owner' | 'pipe-list-editor';
};

class RunbookHttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

class RunbookConflictError extends Error {}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function workspaceOwnerEmail() {
  return normalizeEmail(process.env.PIPELISTS_RUNBOOK_OWNER_EMAIL) || DEFAULT_OWNER_EMAIL;
}

function initialRunbookActor(): RunbookActor {
  return {
    uid: 'system',
    email: workspaceOwnerEmail(),
    name: 'PipeLists system',
    role: 'owner',
    membershipSource: 'workspace-owner',
  };
}

function readBearerToken(req: NextApiRequest) {
  const authorization = headerValue(req.headers.authorization);
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function serializeTimestamp(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { toDate?: () => Date };
  if (typeof candidate.toDate !== 'function') return null;

  try {
    return candidate.toDate().toISOString();
  } catch {
    return null;
  }
}

function serializeActor(value: unknown) {
  const actor = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    uid: String(actor.uid || ''),
    email: String(actor.email || ''),
    name: String(actor.name || actor.email || 'PipeLists teammate'),
  };
}

function serializeRunbook(id: string, data: DocumentData) {
  return {
    id,
    title: String(data.title || ''),
    content: String(data.content || ''),
    version: Number(data.version || 0),
    updatedAt: serializeTimestamp(data.updatedAt),
    updatedBy: serializeActor(data.updatedBy),
  };
}

function serializeRevision(id: string, data: DocumentData) {
  return {
    id,
    version: Number(data.version || 0),
    titleBefore: String(data.titleBefore || ''),
    titleAfter: String(data.titleAfter || ''),
    contentBefore: String(data.contentBefore || ''),
    contentAfter: String(data.contentAfter || ''),
    changeSummary: String(data.changeSummary || ''),
    changedAt: serializeTimestamp(data.changedAt),
    changedBy: serializeActor(data.changedBy),
  };
}

function serializeRevisionSummary(id: string, data: DocumentData) {
  return {
    id,
    version: Number(data.version || 0),
    titleBefore: String(data.titleBefore || ''),
    titleAfter: String(data.titleAfter || ''),
    changeSummary: String(data.changeSummary || ''),
    changedAt: serializeTimestamp(data.changedAt),
    changedBy: serializeActor(data.changedBy),
  };
}

async function hasOwnerEditorAccess(db: Firestore, email: string, ownerEmail: string) {
  const shares = db.collection(PIPELIST_SHARES_COLLECTION);
  const editorSnapshot = await shares.where('editorEmails', 'array-contains', email).get();

  return editorSnapshot.docs.some(
    (share) => normalizeEmail(share.data().ownerEmail) === ownerEmail,
  );
}

async function syncMemberRecord(db: Firestore, actor: RunbookActor) {
  const memberRef = db
    .collection(WORKSPACES_COLLECTION)
    .doc(WORKSPACE_ID)
    .collection(MEMBERS_COLLECTION)
    .doc(actor.uid);
  const snapshot = await memberRef.get();
  const current = snapshot.data() || {};
  const nextMember = {
    uid: actor.uid,
    email: actor.email,
    displayName: actor.name,
    role: actor.role,
    status: 'active',
    source: actor.membershipSource,
  };

  if (
    snapshot.exists &&
    current.email === nextMember.email &&
    current.displayName === nextMember.displayName &&
    current.role === nextMember.role &&
    current.status === nextMember.status &&
    current.source === nextMember.source
  ) {
    return;
  }

  await memberRef.set(
    {
      ...nextMember,
      ...(snapshot.exists ? {} : { joinedAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function revokeStaleMemberRecord(db: Firestore, uid: string) {
  const memberRef = db
    .collection(WORKSPACES_COLLECTION)
    .doc(WORKSPACE_ID)
    .collection(MEMBERS_COLLECTION)
    .doc(uid);
  const snapshot = await memberRef.get();
  if (!snapshot.exists || snapshot.data()?.status !== 'active') return;

  await memberRef.set(
    {
      status: 'revoked',
      revokedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function requireRunbookActor(req: NextApiRequest, db: Firestore): Promise<RunbookActor> {
  const idToken = readBearerToken(req);
  if (!idToken) {
    throw new RunbookHttpError(401, 'AUTH_REQUIRED', 'Sign in to open the shared runbook.');
  }

  let decoded: Awaited<ReturnType<Awaited<ReturnType<typeof getSimpBudgetAuth>>['verifyIdToken']>>;
  try {
    const auth = await getSimpBudgetAuth();
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    throw new RunbookHttpError(401, 'INVALID_TOKEN', 'Your session expired. Sign in again to continue.');
  }

  const email = normalizeEmail(decoded.email);
  if (!email) {
    throw new RunbookHttpError(403, 'EMAIL_REQUIRED', 'This workspace requires an account email.');
  }

  const ownerEmail = workspaceOwnerEmail();
  const isOwner = email === ownerEmail;
  const hasShareAccess = isOwner || (await hasOwnerEditorAccess(db, email, ownerEmail));

  if (!hasShareAccess) {
    await revokeStaleMemberRecord(db, decoded.uid).catch(() => undefined);
    throw new RunbookHttpError(
      403,
      'WORKSPACE_ACCESS_REQUIRED',
      'Ask the PipeLists owner to invite this account to the shared workspace.',
    );
  }

  const profileSnapshot = await db.collection(PIPELIST_PROFILES_COLLECTION).doc(decoded.uid).get();
  const profile = profileSnapshot.data() || {};
  const actor: RunbookActor = {
    uid: decoded.uid,
    email,
    name: String(profile.displayName || decoded.name || email),
    role: isOwner ? 'owner' : 'editor',
    membershipSource: isOwner ? 'workspace-owner' : 'pipe-list-editor',
  };

  await syncMemberRecord(db, actor);
  return actor;
}

function runbookReferences(db: Firestore) {
  const workspaceRef = db.collection(WORKSPACES_COLLECTION).doc(WORKSPACE_ID);
  const runbookRef = workspaceRef.collection(RUNBOOKS_COLLECTION).doc(PIPELISTS_RUNBOOK_ID);
  return {
    workspaceRef,
    runbookRef,
    revisionsRef: runbookRef.collection(REVISIONS_COLLECTION),
  };
}

async function ensureRunbookExists(db: Firestore) {
  const { workspaceRef, runbookRef, revisionsRef } = runbookReferences(db);
  const initialRevisionRef = revisionsRef.doc('v1-initial');

  await db.runTransaction(async (transaction) => {
    const [workspaceSnapshot, runbookSnapshot] = await Promise.all([
      transaction.get(workspaceRef),
      transaction.get(runbookRef),
    ]);
    if (runbookSnapshot.exists) return;

    const timestamp = FieldValue.serverTimestamp();
    if (!workspaceSnapshot.exists) {
      transaction.set(workspaceRef, {
        name: 'Pulse Sales Workspace',
        ownerEmail: workspaceOwnerEmail(),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const initialActor = initialRunbookActor();
    transaction.set(runbookRef, {
      title: DEFAULT_PIPELISTS_RUNBOOK_TITLE,
      content: DEFAULT_PIPELISTS_RUNBOOK_CONTENT,
      version: 1,
      currentRevisionId: initialRevisionRef.id,
      updatedAt: timestamp,
      updatedBy: initialActor,
    });
    transaction.set(initialRevisionRef, {
      version: 1,
      titleBefore: '',
      titleAfter: DEFAULT_PIPELISTS_RUNBOOK_TITLE,
      contentBefore: '',
      contentAfter: DEFAULT_PIPELISTS_RUNBOOK_CONTENT,
      changeSummary: 'Created the shared sales runbook',
      changedAt: timestamp,
      changedBy: initialActor,
    });
  });
}

async function readRunbookSnapshot(db: Firestore, beforeVersion?: number) {
  const { runbookRef, revisionsRef } = runbookReferences(db);
  let runbookSnapshot: FirebaseFirestore.DocumentSnapshot;
  let revisionSnapshot: FirebaseFirestore.QuerySnapshot;

  for (let attempt = 0; ; attempt += 1) {
    runbookSnapshot = await runbookRef.get();
    if (!runbookSnapshot.exists) {
      throw new RunbookHttpError(500, 'RUNBOOK_MISSING', 'The runbook could not be initialized.');
    }

    let revisionsQuery: FirebaseFirestore.Query = revisionsRef
      .select(
        'version',
        'titleBefore',
        'titleAfter',
        'changeSummary',
        'changedAt',
        'changedBy',
      )
      .orderBy('version', 'desc');
    if (beforeVersion && Number.isInteger(beforeVersion) && beforeVersion > 1) {
      revisionsQuery = revisionsQuery.where('version', '<', beforeVersion);
    }
    revisionSnapshot = await revisionsQuery.limit(HISTORY_PAGE_SIZE + 1).get();

    if (beforeVersion) break;
    const currentVersion = Number(runbookSnapshot.data()?.version || 0);
    const newestRevisionVersion = Number(revisionSnapshot.docs[0]?.data().version || 0);
    if (currentVersion === newestRevisionVersion) break;
    if (attempt >= 2) {
      throw new RunbookHttpError(503, 'SNAPSHOT_CHANGED', 'The runbook changed while loading. Refresh and try again.');
    }
  }

  const pageDocs = revisionSnapshot.docs.slice(0, HISTORY_PAGE_SIZE);

  return {
    workspace: {
      id: WORKSPACE_ID,
      name: 'Pulse Sales Workspace',
      ownerEmail: workspaceOwnerEmail(),
    },
    runbook: serializeRunbook(runbookSnapshot.id, runbookSnapshot.data() || {}),
    revisions: pageDocs.map((revision) => serializeRevisionSummary(revision.id, revision.data())),
    hasMoreHistory: revisionSnapshot.docs.length > HISTORY_PAGE_SIZE,
  };
}

async function readRunbookRevision(db: Firestore, revisionId: string) {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(revisionId)) {
    throw new RunbookHttpError(400, 'INVALID_REVISION', 'Choose a valid runbook revision.');
  }

  const { revisionsRef } = runbookReferences(db);
  const snapshot = await revisionsRef.doc(revisionId).get();
  if (!snapshot.exists) {
    throw new RunbookHttpError(404, 'REVISION_NOT_FOUND', 'That runbook revision could not be found.');
  }
  return serializeRevision(snapshot.id, snapshot.data() || {});
}

function normalizeRunbookInput(body: unknown) {
  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const content = typeof payload.content === 'string' ? payload.content.replace(/\r\n?/g, '\n') : '';
  const changeSummary =
    typeof payload.changeSummary === 'string'
      ? payload.changeSummary.trim().slice(0, RUNBOOK_SUMMARY_MAX_LENGTH)
      : '';
  const expectedVersion = Number(payload.expectedVersion);

  if (!title) {
    throw new RunbookHttpError(400, 'TITLE_REQUIRED', 'Add a runbook title before saving.');
  }
  if (title.length > PIPELISTS_RUNBOOK_TITLE_MAX_LENGTH) {
    throw new RunbookHttpError(
      400,
      'TITLE_TOO_LONG',
      `Keep the title under ${PIPELISTS_RUNBOOK_TITLE_MAX_LENGTH} characters.`,
    );
  }
  if (!content.trim()) {
    throw new RunbookHttpError(400, 'CONTENT_REQUIRED', 'Add runbook content before saving.');
  }
  if (
    content.length > PIPELISTS_RUNBOOK_CONTENT_MAX_LENGTH ||
    Buffer.byteLength(content, 'utf8') > RUNBOOK_CONTENT_MAX_BYTES
  ) {
    throw new RunbookHttpError(400, 'CONTENT_TOO_LONG', 'The runbook is too large to save safely.');
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new RunbookHttpError(400, 'VERSION_REQUIRED', 'Refresh the runbook before saving this edit.');
  }

  return { title, content, changeSummary, expectedVersion };
}

function automaticChangeSummary(
  titleBefore: string,
  titleAfter: string,
  contentBefore: string,
  contentAfter: string,
) {
  const titleChanged = titleBefore !== titleAfter;
  const diffSummary = summarizePipeListsRunbookDiff(
    buildPipeListsRunbookLineDiff(contentBefore, contentAfter),
  );
  const parts: string[] = [];
  if (titleChanged) parts.push('updated the title');
  if (diffSummary.additions) parts.push(`added ${diffSummary.additions} line${diffSummary.additions === 1 ? '' : 's'}`);
  if (diffSummary.removals) parts.push(`removed ${diffSummary.removals} line${diffSummary.removals === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(', ') : 'Saved the runbook';
}

async function saveRunbook(db: Firestore, actor: RunbookActor, body: unknown) {
  const input = normalizeRunbookInput(body);
  const { runbookRef, revisionsRef } = runbookReferences(db);
  const revisionRef = revisionsRef.doc();

  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(runbookRef);
    if (!snapshot.exists) {
      throw new RunbookHttpError(500, 'RUNBOOK_MISSING', 'Refresh the runbook and try again.');
    }

    const current = snapshot.data() || {};
    const currentVersion = Number(current.version || 0);
    if (currentVersion !== input.expectedVersion) {
      throw new RunbookConflictError();
    }

    const titleBefore = String(current.title || '');
    const contentBefore = String(current.content || '');
    if (titleBefore === input.title && contentBefore === input.content) {
      return { changed: false };
    }

    const nextVersion = currentVersion + 1;
    const timestamp = FieldValue.serverTimestamp();
    const changeSummary =
      input.changeSummary || automaticChangeSummary(titleBefore, input.title, contentBefore, input.content);

    transaction.set(revisionRef, {
      version: nextVersion,
      titleBefore,
      titleAfter: input.title,
      contentBefore,
      contentAfter: input.content,
      changeSummary,
      changedAt: timestamp,
      changedBy: actor,
    });
    transaction.update(runbookRef, {
      title: input.title,
      content: input.content,
      version: nextVersion,
      currentRevisionId: revisionRef.id,
      updatedAt: timestamp,
      updatedBy: actor,
    });

    return { changed: true };
  });

  return result;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  if (!readBearerToken(req)) {
    return res.status(401).json({ error: 'Sign in to open the shared runbook.', code: 'AUTH_REQUIRED' });
  }

  try {
    const db = await getSimpBudgetFirestore();
    const actor = await requireRunbookActor(req, db);

    const revisionId = headerValue(req.query.revisionId)?.trim();
    if (req.method === 'GET' && revisionId) {
      const revision = await readRunbookRevision(db, revisionId);
      return res.status(200).json({ revision, actor });
    }

    if (req.method === 'GET' && headerValue(req.query.currentOnly) === '1') {
      const { runbookRef } = runbookReferences(db);
      let currentSnapshot = await runbookRef.get();
      if (!currentSnapshot.exists) {
        await ensureRunbookExists(db);
        currentSnapshot = await runbookRef.get();
      }
      if (!currentSnapshot.exists) {
        throw new RunbookHttpError(500, 'RUNBOOK_MISSING', 'The runbook could not be initialized.');
      }
      return res.status(200).json({
        runbook: serializeRunbook(currentSnapshot.id, currentSnapshot.data() || {}),
        actor,
      });
    }

    await ensureRunbookExists(db);

    if (req.method === 'PUT') {
      try {
        const saveResult = await saveRunbook(db, actor, req.body);
        const snapshot = await readRunbookSnapshot(db);
        return res.status(200).json({ ...snapshot, actor, changed: saveResult.changed });
      } catch (error) {
        if (error instanceof RunbookConflictError) {
          const snapshot = await readRunbookSnapshot(db);
          return res.status(409).json({
            error: 'A teammate saved a newer version. Review their update before saving yours.',
            code: 'VERSION_CONFLICT',
            snapshot: { ...snapshot, actor },
          });
        }
        throw error;
      }
    }

    const beforeVersion = Number(headerValue(req.query.beforeVersion));
    const snapshot = await readRunbookSnapshot(db, beforeVersion);
    return res.status(200).json({ ...snapshot, actor });
  } catch (error) {
    if (error instanceof RunbookHttpError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }

    console.error('[PipeLists runbook] Request failed:', error);
    return res.status(500).json({
      error: 'The shared runbook could not be loaded. Try again in a moment.',
      code: 'RUNBOOK_ERROR',
    });
  }
}
