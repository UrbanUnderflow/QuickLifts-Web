// =============================================================================
// Phase D · Nora Conversation Orchestrator — runtime.
//
// Server-side only (admin SDK). Three public entry points:
//
//   1. `openConversationFromTrigger(...)` — given a fired trigger, builds
//      the conversation doc, sends opener, persists turn 0.
//
//   2. `recordAthleteReply(...)` — appends athlete reply, classifies it,
//      sends probe (if state was 'opened') or action delivery (if state
//      was 'awaiting-reply').
//
//   3. `closeConversation(...)` — marks closed-no-reply or closed-revoked.
//
// The scheduled functions in netlify/functions are thin shells over these.
// =============================================================================

import * as admin from 'firebase-admin';
import {
  NORA_CONVERSATIONS_COLLECTION,
  NORA_TRIGGER_FIRES_COLLECTION,
  NoraConversation,
  NoraTriggerFire,
  ConversationTurn,
  ConversationState,
  TriggerEvidence,
} from './types';
import {
  type AnthropicLike,
  type TranslationResult,
  translateForAthlete,
} from '../adaptiveFramingLayer/translationService';
import type {
  ConversationBranch,
  ConversationTrigger,
  TranslationDomain,
} from '../adaptiveFramingLayer/types';
import {
  defaultNoraVoiceRubricFallback,
  enforceNoraVoiceRubric,
} from '../noraVoiceRubric';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const stripUndefinedDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep).filter((v) => v !== undefined);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [k, v]) => {
      if (v === undefined) return acc;
      acc[k] = stripUndefinedDeep(v);
      return acc;
    }, {});
  }
  return value;
};

const buildConversationId = (athleteUserId: string, triggerFireId: string): string =>
  `${athleteUserId}_${triggerFireId}`;

const buildTurnId = (conversationId: string, index: number): string =>
  `${conversationId}_t${index}`;

const buildTriggerFireId = (athleteUserId: string, trigger: ConversationTrigger, dayKey: string): string =>
  `${athleteUserId}_${trigger}_${dayKey}`;

const dateKey = (d: Date = new Date()): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const enforceConversationTurnText = (
  text: string,
  role: ConversationTurn['role'],
  previousTurns: ConversationTurn[] = [],
): string =>
  enforceNoraVoiceRubric(text, {
    fallback: defaultNoraVoiceRubricFallback(text),
    previousAssistantMessages: previousTurns
      .filter((turn) => turn.role !== 'athlete-reply')
      .map((turn) => turn.text)
      .filter(Boolean)
      .slice(-3),
    onViolation: ({ violations, original, repaired }) => {
      console.warn('[noraConversation] Nora voice rubric repaired turn', {
        role,
        violations,
        originalPreview: original.slice(0, 180),
        repairedPreview: repaired.slice(0, 180),
      });
    },
  });

// ──────────────────────────────────────────────────────────────────────────────
// Public: open conversation from a fired trigger
// ──────────────────────────────────────────────────────────────────────────────

export interface OpenConversationInput {
  athleteUserId: string;
  teamId: string;
  trigger: ConversationTrigger;
  branch: ConversationBranch;
  /** Phase C-mapped action domain (e.g. 'travel' for circadian disruption). */
  actionDomain: TranslationDomain;
  evidence: TriggerEvidence;
  /** athlete-local YYYY-MM-DD; used for trigger-fire dedupe. */
  dayKey?: string;
  scaleRevisionId?: string;
  treeRevisionId?: string;
}

export interface OpenConversationDeps {
  firestore?: admin.firestore.Firestore;
}

const ensureFirestore = (deps?: OpenConversationDeps): admin.firestore.Firestore => {
  return deps?.firestore || admin.firestore();
};

/**
 * Returns the existing conversation (if a fire already happened for the
 * athlete + trigger + dayKey) or creates a fresh one + sends opener.
 */
export const openConversationFromTrigger = async (
  input: OpenConversationInput,
  deps: OpenConversationDeps = {},
): Promise<NoraConversation> => {
  const db = ensureFirestore(deps);
  const dayKey_ = input.dayKey || dateKey();
  const triggerFireId = buildTriggerFireId(input.athleteUserId, input.trigger, dayKey_);

  // Dedupe: if a trigger-fire doc already exists for today, return its
  // conversation rather than opening a new one.
  const fireRef = db.collection(NORA_TRIGGER_FIRES_COLLECTION).doc(triggerFireId);
  const fireSnap = await fireRef.get();
  if (fireSnap.exists) {
    const fireData = fireSnap.data() as NoraTriggerFire | undefined;
    if (fireData?.conversationId) {
      const convoSnap = await db.collection(NORA_CONVERSATIONS_COLLECTION).doc(fireData.conversationId).get();
      if (convoSnap.exists) {
        return { ...(convoSnap.data() as NoraConversation), id: convoSnap.id };
      }
    }
  }

  const now = Date.now();
  const conversationId = buildConversationId(input.athleteUserId, triggerFireId);
  const openerTurn: ConversationTurn = {
    turnId: buildTurnId(conversationId, 0),
    index: 0,
    role: 'nora-opener',
    text: enforceConversationTurnText(input.branch.opener.text, 'nora-opener'),
    voiceReviewStatus: input.branch.opener.voiceReviewStatus,
    createdAt: now,
  };

  const conversation: NoraConversation = {
    id: conversationId,
    athleteUserId: input.athleteUserId,
    teamId: input.teamId,
    trigger: input.trigger,
    branchId: input.branch.id,
    actionDomain: input.actionDomain,
    state: 'opened',
    openedAt: now,
    turns: [openerTurn],
    triggerEvidence: input.evidence,
    scaleRevisionAtOpen: input.scaleRevisionId,
    treeRevisionAtOpen: input.treeRevisionId,
    createdAt: now,
    updatedAt: now,
  };

  const fire: NoraTriggerFire = {
    id: triggerFireId,
    athleteUserId: input.athleteUserId,
    trigger: input.trigger,
    dayKey: dayKey_,
    conversationId,
    evidence: input.evidence,
    firedAt: now,
  };

  const batch = db.batch();
  batch.set(
    db.collection(NORA_CONVERSATIONS_COLLECTION).doc(conversationId),
    stripUndefinedDeep(conversation) as Record<string, unknown>,
    { merge: false },
  );
  batch.set(fireRef, stripUndefinedDeep(fire) as Record<string, unknown>, { merge: false });
  await batch.commit();

  return conversation;
};

// ──────────────────────────────────────────────────────────────────────────────
// Public: record athlete reply + advance state
// ──────────────────────────────────────────────────────────────────────────────

export interface RecordAthleteReplyInput {
  conversationId: string;
  text: string;
  /** Optional pre-classified bucket. If absent, orchestrator classifies via
   *  Anthropic before generating action. */
  preClassifiedStateBucket?: string;
}

export interface RecordAthleteReplyDeps extends OpenConversationDeps {
  anthropicClient?: AnthropicLike;
  /** Override the translateForAthlete call surface for tests. */
  translate?: typeof translateForAthlete;
  /** Override the state-bucket classifier (pure function injected). */
  classifyReply?: (replyText: string, conversation: NoraConversation) => Promise<string>;
}

/**
 * Athlete reply turn is appended. Then:
 *   - If conversation was 'opened', orchestrator generates the PROBE
 *     (next turn from the conversation tree, voiced through Phase C).
 *   - If conversation was 'awaiting-reply', orchestrator generates the
 *     ACTION DELIVERY (final translated guidance) + closes conversation.
 */
export const recordAthleteReply = async (
  input: RecordAthleteReplyInput,
  deps: RecordAthleteReplyDeps = {},
): Promise<NoraConversation> => {
  const db = ensureFirestore(deps);
  const convoRef = db.collection(NORA_CONVERSATIONS_COLLECTION).doc(input.conversationId);
  const convoSnap = await convoRef.get();
  if (!convoSnap.exists) {
    throw new Error(`[noraOrchestrator] conversation ${input.conversationId} not found`);
  }
  const convo = { ...(convoSnap.data() as NoraConversation), id: convoSnap.id };
  if (convo.state === 'closed-no-reply' || convo.state === 'closed-revoked' || convo.state === 'action-delivered') {
    return convo; // closed conversations are terminal
  }

  const now = Date.now();
  const replyTurn: ConversationTurn = {
    turnId: buildTurnId(convo.id, convo.turns.length),
    index: convo.turns.length,
    role: 'athlete-reply',
    text: input.text,
    createdAt: now,
  };

  // Branch by state.
  let nextState: ConversationState = convo.state;
  const updatedTurns: ConversationTurn[] = [...convo.turns, replyTurn];

  if (convo.state === 'opened') {
    // Send probe — uses the conversation branch's static probe text.
    const probeBranch = await loadBranchForConversation(db, convo.branchId);
    const probeText = enforceConversationTurnText(
      probeBranch?.probe.text || 'Tell me a little more — how are things landing today?',
      'nora-probe',
      updatedTurns,
    );
    const probeTurn: ConversationTurn = {
      turnId: buildTurnId(convo.id, updatedTurns.length),
      index: updatedTurns.length,
      role: 'nora-probe',
      text: probeText,
      voiceReviewStatus: probeBranch?.probe.voiceReviewStatus,
      createdAt: now + 1,
    };
    updatedTurns.push(probeTurn);
    nextState = 'awaiting-reply';
  } else if (convo.state === 'awaiting-reply') {
    // Classify reply → state bucket → call translateForAthlete for action delivery.
    const classifier = deps.classifyReply || ((text: string) => defaultClassifyReply(text, convo, deps.anthropicClient));
    const stateBucket = input.preClassifiedStateBucket || (await classifier(input.text, convo));
    const translateFn = deps.translate || translateForAthlete;
    let translation: TranslationResult | null = null;
    try {
      translation = await translateFn(
        {
          athleteUserId: convo.athleteUserId,
          signal: { trigger: convo.trigger, replyText: input.text, stateBucket },
          domain: convo.actionDomain,
          state: stateBucket,
          additionalContext: { thread: serializeThread(convo.turns) },
          persistLog: true,
        },
        { firestore: db, anthropicClient: deps.anthropicClient },
      );
    } catch (err) {
      // Fallback handled below — translateForAthlete already has fallback,
      // but if the function itself throws, we synthesize a safe default.
      translation = null;
    }

    const actionText = enforceConversationTurnText(
      translation?.phrasing ||
        "Got it. I'll keep that in mind for today's training.",
      'nora-action',
      updatedTurns,
    );

    const actionTurn: ConversationTurn = {
      turnId: buildTurnId(convo.id, updatedTurns.length),
      index: updatedTurns.length,
      role: 'nora-action',
      text: actionText,
      rawModelOutput: translation?.claudeOutputRaw,
      classifiedStateBucket: stateBucket,
      fallbackTriggered: translation?.fallbackTriggered,
      fallbackReason: translation?.fallbackReason,
      guardrailViolations: translation?.guardrailViolations,
      voiceReviewStatus: translation?.voiceReviewStatus,
      translationRowRevision: translation?.translationRowRevision,
      createdAt: now + 2,
    };
    updatedTurns.push(actionTurn);
    nextState = 'action-delivered';
    convo.actionState = stateBucket;
  }

  const updatedConvo: NoraConversation = {
    ...convo,
    state: nextState,
    actionState: convo.actionState,
    turns: updatedTurns,
    closedAt: nextState === 'action-delivered' ? now + 2 : convo.closedAt,
    updatedAt: now,
  };

  await convoRef.set(stripUndefinedDeep(updatedConvo) as Record<string, unknown>, { merge: false });
  return updatedConvo;
};

const loadBranchForConversation = async (
  db: admin.firestore.Firestore,
  branchId: string,
): Promise<ConversationBranch | null> => {
  const snap = await db.collection('pulsecheck-conversation-tree').doc(branchId).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as ConversationBranch), id: snap.id };
};

const serializeThread = (turns: ConversationTurn[]): string =>
  turns.map((t) => `${t.role}: ${t.text}`).join('\n');

/**
 * Default reply classifier. Maps free-text reply to a state bucket using
 * Anthropic when available, falls back to a keyword heuristic. The
 * heuristic is always available so tests don't require Anthropic keys.
 */
const defaultClassifyReply = async (
  text: string,
  convo: NoraConversation,
  anthropicClient?: AnthropicLike,
): Promise<string> => {
  if (anthropicClient) {
    try {
      const result = await anthropicClient.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 64,
        system: buildClassifierSystemPrompt(convo.actionDomain),
        messages: [
          {
            role: 'user',
            content: `Classify this athlete reply into ONE state bucket. Reply ONLY with the bucket name.\n\nReply: "${text}"`,
          },
        ],
      });
      const block = result.content?.[0];
      const raw = (block?.type === 'text' && block.text) || '';
      return raw.trim().toLowerCase().split(/\s+/)[0] || keywordFallback(text, convo.actionDomain);
    } catch {
      // fall through to heuristic
    }
  }
  return keywordFallback(text, convo.actionDomain);
};

const buildClassifierSystemPrompt = (domain: TranslationDomain): string => `
You are a state-bucket classifier for an athlete-facing wellness platform.
Domain: ${domain}.
Possible buckets:
  - sleep: strong, adequate, debt, deficit
  - travel: pre-departure, day-of-arrival, day-2-post
  - autonomic: parasympathetic-restored, sympathetic-dominant
  - load: settled, climbing
  - circadian: settled, mild-shift, travel-signature, jetlag-significant
Reply with ONE bucket name only.  No explanation.
`;

const keywordFallback = (text: string, domain: TranslationDomain): string => {
  const t = text.toLowerCase();
  if (domain === 'sleep') {
    if (/(rough|terrible|bad|awful|exhausted)/.test(t)) return 'deficit';
    if (/(short|tired|not great)/.test(t)) return 'debt';
    if (/(great|amazing|solid|deep|rested)/.test(t)) return 'strong';
    return 'adequate';
  }
  if (domain === 'travel') {
    if (/(landed|just got in|arrived)/.test(t)) return 'day-of-arrival';
    if (/(yesterday|day after|day 2)/.test(t)) return 'day-2-post';
    return 'pre-departure';
  }
  if (domain === 'autonomic') {
    if (/(stressed|tense|anxious|wired|on edge)/.test(t)) return 'sympathetic-dominant';
    return 'parasympathetic-restored';
  }
  if (domain === 'load') {
    if (/(heavy|tough|sore|gassed|wrecked)/.test(t)) return 'climbing';
    return 'settled';
  }
  if (domain === 'circadian') {
    if (/(jetlag|jet lag|long flight|two days|three days)/.test(t)) return 'jetlag-significant';
    if (/(travel|flying|long day)/.test(t)) return 'travel-signature';
    if (/(later|earlier|shifted)/.test(t)) return 'mild-shift';
    return 'settled';
  }
  return 'unknown';
};

// ──────────────────────────────────────────────────────────────────────────────
// Public: close conversation
// ──────────────────────────────────────────────────────────────────────────────

export interface CloseConversationInput {
  conversationId: string;
  reason: 'no-reply' | 'revoked';
  revokedByUserId?: string;
  revokedReason?: string;
}

export const closeConversation = async (
  input: CloseConversationInput,
  deps: OpenConversationDeps = {},
): Promise<NoraConversation | null> => {
  const db = ensureFirestore(deps);
  const ref = db.collection(NORA_CONVERSATIONS_COLLECTION).doc(input.conversationId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const now = Date.now();
  const patch: Partial<NoraConversation> = {
    state: input.reason === 'no-reply' ? 'closed-no-reply' : 'closed-revoked',
    closedAt: now,
    updatedAt: now,
    revokedByUserId: input.revokedByUserId,
    revokedReason: input.revokedReason,
  };
  await ref.set(stripUndefinedDeep(patch) as Record<string, unknown>, { merge: true });
  return { ...(snap.data() as NoraConversation), ...patch, id: snap.id } as NoraConversation;
};

// Internal exports for tests
export const __internal = {
  buildConversationId,
  buildTurnId,
  buildTriggerFireId,
  defaultClassifyReply,
  keywordFallback,
};

export const noraConversationOrchestrator = {
  open: openConversationFromTrigger,
  recordReply: recordAthleteReply,
  close: closeConversation,
};
