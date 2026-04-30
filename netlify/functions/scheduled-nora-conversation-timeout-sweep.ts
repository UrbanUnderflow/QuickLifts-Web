import type { Handler } from '@netlify/functions';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import {
  closeConversation,
  type CloseConversationInput,
} from '../../src/api/firebase/noraConversation/orchestrator';
import {
  NORA_CONVERSATIONS_COLLECTION,
  type ConversationState,
} from '../../src/api/firebase/noraConversation/types';

const TIMEOUT_MS = 48 * 60 * 60 * 1000;
const PAGE_LIMIT = 250;
const MAX_PAGES_PER_STATE = 20;
const CLOSE_CONCURRENCY = 10;

const TIMEOUT_STATES: ConversationState[] = ['opened', 'awaiting-reply'];

type QueryDoc = {
  id: string;
  data?: () => Record<string, unknown>;
};

type QuerySnap = {
  docs: QueryDoc[];
};

type CloseFn = (
  input: CloseConversationInput,
  deps: { firestore?: any },
) => Promise<unknown>;

export interface NoraConversationTimeoutSweepDeps {
  firestore: any;
  closeConversationFn?: CloseFn;
  now?: Date;
  pageLimit?: number;
  maxPagesPerState?: number;
}

const runLimited = async <T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> => {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(worker));
  }
};

const queryTimedOutConversations = async (
  db: any,
  state: ConversationState,
  cutoff: number,
  pageLimit: number,
  startAfterDoc?: QueryDoc,
): Promise<QuerySnap> => {
  // Query one state at a time to avoid Firestore OR / `in` constraints with
  // the updatedAt inequality, then page by the same ordered field.
  let query = db
    .collection(NORA_CONVERSATIONS_COLLECTION)
    .where('state', '==', state)
    .where('updatedAt', '<', cutoff)
    .orderBy('updatedAt', 'asc')
    .limit(pageLimit);

  if (startAfterDoc) {
    query = query.startAfter(startAfterDoc);
  }

  return query.get();
};

export const sweepNoraConversationTimeouts = async (
  deps: NoraConversationTimeoutSweepDeps,
) => {
  const db = deps.firestore;
  const closeFn = deps.closeConversationFn || closeConversation;
  const now = deps.now || new Date();
  const cutoff = now.getTime() - TIMEOUT_MS;
  const pageLimit = deps.pageLimit || PAGE_LIMIT;
  const maxPagesPerState = deps.maxPagesPerState || MAX_PAGES_PER_STATE;

  const summary = {
    cutoff,
    scanned: 0,
    closed: 0,
    errors: 0,
    pages: 0,
    byState: {
      opened: 0,
      'awaiting-reply': 0,
    } as Record<'opened' | 'awaiting-reply', number>,
  };

  for (const state of TIMEOUT_STATES) {
    let lastDoc: QueryDoc | undefined;
    let page = 0;

    while (page < maxPagesPerState) {
      const snap = await queryTimedOutConversations(db, state, cutoff, pageLimit, lastDoc);
      const docs = snap.docs || [];
      page += 1;
      summary.pages += 1;
      summary.scanned += docs.length;

      if (docs.length === 0) break;

      await runLimited(docs, CLOSE_CONCURRENCY, async (doc) => {
        try {
          await closeFn({ conversationId: doc.id, reason: 'no-reply' }, { firestore: db });
          summary.closed += 1;
          summary.byState[state] += 1;
        } catch (err) {
          summary.errors += 1;
          console.error('[scheduled-nora-conversation-timeout-sweep] close failed', {
            conversationId: doc.id,
            state,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });

      if (docs.length < pageLimit) break;
      lastDoc = docs[docs.length - 1];
    }
  }

  return summary;
};

export const handler: Handler = async () => {
  await initAdmin();
  const db = await getFirestore();
  const summary = await sweepNoraConversationTimeouts({ firestore: db });

  return {
    statusCode: summary.errors > 0 ? 207 : 200,
    body: JSON.stringify({ ok: summary.errors === 0, summary }),
  };
};
