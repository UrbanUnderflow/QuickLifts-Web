// =============================================================================
// Phase D · Nora Conversation Orchestrator — types.
//
// One conversation = one trigger fire, opener → probe → action delivery.
// Every athlete reply advances state.  Backed by Firestore so the
// orchestrator can resume after restart (no in-memory state).
//
// Doctrine boundaries:
//   - Reactive only (the proactive curriculum is Phase I, separate path).
//   - All athlete-facing strings pass the Nora voice rubric runtime before
//     persistence. Action delivery also flows through Phase C's
//     translateForAthlete() for domain-specific guardrails. Conversation tree
//     provides the SHAPE (opener / probe / action), guardrails provide VOICE.
//   - Replies are stored verbatim, classified into a state bucket via the
//     same Anthropic SDK Phase C uses.  Classification result drives which
//     translation row gets used for the action delivery.
//
// Logging: every conversation step writes to `pulsecheck-nora-conversations`
// (this collection) AND `pulsecheck-nora-translation-log` (Phase C
// collection). Phase G (Nora Guard) reads both joined by `messageId`.
// =============================================================================

import type { Timestamp } from 'firebase-admin/firestore';
import type {
  ConversationTrigger,
  TranslationDomain,
} from '../adaptiveFramingLayer/types';

// Collection constants (Phase D-owned).
export const NORA_CONVERSATIONS_COLLECTION = 'pulsecheck-nora-conversations';
export const NORA_TRIGGER_FIRES_COLLECTION = 'pulsecheck-nora-trigger-fires';

export type ConversationState =
  | 'opened'           // opener sent, awaiting first reply
  | 'awaiting-reply'   // probe sent, awaiting reply
  | 'action-delivered' // final action delivered; closed-with-action
  | 'closed-no-reply'  // athlete never responded; closed-on-timeout
  | 'closed-revoked';  // operator-killed via Nora Guard

export type TurnRole = 'nora-opener' | 'nora-probe' | 'nora-action' | 'athlete-reply';

export interface ConversationTurn {
  turnId: string;          // doc-id-stable: `${conversationId}_t${index}`
  index: number;           // 0-based position in the thread
  role: TurnRole;
  text: string;            // the actual message (post-guardrails)
  rawModelOutput?: string; // Phase C's raw Claude output, for Nora Guard
  classifiedStateBucket?: string;
  fallbackTriggered?: boolean;
  fallbackReason?: string;
  guardrailViolations?: Array<{ field: string; message: string }>;
  voiceReviewStatus?: string;
  translationRowRevision?: string;
  createdAt: Timestamp | number;
}

export interface NoraConversation {
  id: string;                       // `${athleteUserId}_${triggerFireId}`
  athleteUserId: string;
  teamId: string;
  trigger: ConversationTrigger;
  /** Branch id from `pulsecheck-conversation-tree`. */
  branchId: string;
  /** Domain (sleep/travel/etc) the orchestrator chose for the action delivery. */
  actionDomain: TranslationDomain;
  /** State bucket the orchestrator chose for the action delivery (after reply
   *  classification). Empty until reply lands + classifies. */
  actionState?: string;
  state: ConversationState;
  openedAt: Timestamp | number;
  closedAt?: Timestamp | number;
  /** Embedded turn log — chronological. */
  turns: ConversationTurn[];
  /** Trigger evidence — why the orchestrator opened this conversation. */
  triggerEvidence: TriggerEvidence;
  /** Active config revision IDs at conversation-open time, for audit. */
  scaleRevisionAtOpen?: string;
  treeRevisionAtOpen?: string;
  /** Nora Guard kill-switch hooks. */
  staffNotes?: string;
  revokedByUserId?: string;
  revokedReason?: string;
  createdAt: Timestamp | number;
  updatedAt: Timestamp | number;
}

export interface TriggerEvidence {
  /** Free-form description shown to staff in Nora Guard. */
  summary: string;
  /** Snapshot id the trigger evaluated against (HCSR-delta only). */
  snapshotId?: string;
  /** Coach-context flag id (coach-context only). */
  coachContextFlagId?: string;
  /** Calendar event id (calendar-sport-event only). */
  calendarEventId?: string;
  /** Last engagement timestamp (behavioral-drift only). */
  lastEngagementAt?: number;
  /** Days since engagement (behavioral-drift only). */
  daysSinceEngagement?: number;
}

/**
 * Records that a trigger fired for a given athlete on a given dayKey.
 * Used to dedupe: if a trigger fired today, the orchestrator does not
 * re-open another conversation for that trigger today.
 *
 * Doc id format: `${athleteUserId}_${trigger}_${dayKey}`.
 */
export interface NoraTriggerFire {
  id: string;
  athleteUserId: string;
  trigger: ConversationTrigger;
  dayKey: string; // YYYY-MM-DD athlete-local
  conversationId?: string;
  evidence: TriggerEvidence;
  firedAt: Timestamp | number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Trigger-detection thresholds (Phase D doctrine — match the briefs)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * HCSR-delta thresholds. The detector reads the latest snapshot and fires
 * when the band has stepped to "travel_signature" or worse on the
 * circadian inference, OR when sleep efficiency dropped >15% vs 7d
 * baseline, OR when autonomic-load minutes >= 360.
 */
export const HCSR_DELTA_THRESHOLDS = {
  circadianBands: ['travel_signature', 'jetlag_significant'] as const,
  sleepEfficiencyDropPct: 0.15,
  autonomicLoadMinutes: 360,
};

/**
 * Behavioral drift thresholds. The detector fires when an athlete has
 * gone N days without engaging Nora (no completion event, no chat reply).
 */
export const BEHAVIORAL_DRIFT_DAYS = 5;

/**
 * Calendar-event window — fires when an athlete has a competition / game
 * day in the next 36 hours.
 */
export const CALENDAR_EVENT_WINDOW_HOURS = 36;
