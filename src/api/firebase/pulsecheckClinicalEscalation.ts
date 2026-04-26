// =============================================================================
// PulseCheck Clinical Escalation — Tier 3 routing layer.
//
// What this service does (and only does):
//   1. Records an immutable Tier 3 escalation event in
//      `pulsecheck-clinical-escalations`.
//   2. Sets `crisisWallActive: true` on the athlete's user doc so iOS gates
//      the app to a crisis wall surfacing 988 / 911 / Crisis Text Line.
//   3. Fans out to the team's designated clinician staff member (email +
//      SMS via Twilio when phone on file).
//   4. Mirrors the event into the existing `escalation-records` collection
//      so the coach/admin dashboard surfaces it.
//
// What this service does NOT do:
//   - Auto-dial 988 (athlete must tap-to-call from the wall — never auto-call).
//   - Send anything to 988 (the line takes person-in-crisis calls only).
//   - Make a clinical decision. The Tier 3 signal comes upstream from
//     existing detection; this service is routing + notification + audit.
//
// Liability posture:
//   - Pulse is not a clinical service. The team's designated clinician
//     applies clinical judgment and is the human in the loop.
//   - Onboarding consent (v5+) explicitly authorizes this notification.
//   - All actions are logged with timestamps to discharge documented duty.
//
// AuntEDNA path (future):
//   - When AuntEDNA integration ships, escalations route through it and
//     this interim service either delegates to AuntEDNA or hands off the
//     athlete record after the on-staff clinician acknowledges. Either way
//     the contract on this side stays the same — recordTier3Escalation()
//     is the single entrypoint.
// =============================================================================

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './config';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type EscalationTier = 0 | 1 | 2 | 3;

export type EscalationSignalSource =
  | 'pulsecheck_chat_classifier'
  | 'pulsecheck_checkin_classifier'
  | 'pulsecheck_protocol_audit'
  | 'pulsecheck_inference_engine'
  | 'manual_pulse_review'
  | 'manual_coach_report';

export type EscalationDeliveryStatus =
  | 'pending'
  | 'clinician_paged'
  | 'clinician_acknowledged'
  | 'resolved'
  | 'failed';

export interface ClinicalEscalationEvidence {
  /** Plain-English label of the signal (reviewer/clinician facing only). */
  label: string;
  /** Optional raw quote / excerpt that triggered the detection. */
  excerpt?: string;
  /** Source collection/document for the signal. */
  sourceRef?: string;
  /** Confidence label of the detection. */
  confidence?: 'directional' | 'emerging' | 'stable' | 'high_confidence';
}

export interface ClinicalEscalationRecord {
  id: string;
  athleteUserId: string;
  teamId: string;
  organizationId?: string;
  pilotId?: string;
  tier: EscalationTier;
  signalSource: EscalationSignalSource;
  evidence: ClinicalEscalationEvidence[];
  /** Clinician membership id of the human paged. */
  pagedClinicianMembershipId?: string;
  /** Audit fields. */
  detectedAt: number;
  recordedAt: unknown;
  acknowledgedAt?: unknown;
  acknowledgedByUserId?: string;
  resolvedAt?: unknown;
  resolvedByUserId?: string;
  resolutionNote?: string;
  deliveryStatus: EscalationDeliveryStatus;
  /** Idempotency key (signal + window). */
  dedupeKey: string;
  /** Snapshot of the consent versions the athlete had accepted at trigger time. */
  consentSnapshot?: {
    productConsentVersion?: string;
    completedConsentIds?: string[];
  };
  /** Pulse staff or system that triggered the record (uid or service name). */
  triggeredBySource: string;
  /** Mirror id in the existing `escalation-records` collection. */
  legacyEscalationRecordId?: string;
}

export interface RecordClinicalEscalationInput {
  athleteUserId: string;
  teamId: string;
  organizationId?: string;
  pilotId?: string;
  tier: EscalationTier;
  signalSource: EscalationSignalSource;
  evidence: ClinicalEscalationEvidence[];
  detectedAt?: number;
  triggeredBySource: string;
  /** Override the dedupe window (default 60 minutes). */
  dedupeWindowSeconds?: number;
  /** When true, bypasses Firestore writes (preview/test mode). */
  preview?: boolean;
}

export interface RecordClinicalEscalationResult {
  /** True when this call wrote a new record. False when an active record
   * existed inside the dedupe window (no second page). */
  recorded: boolean;
  record: ClinicalEscalationRecord;
  /** Reason a duplicate was suppressed, when applicable. */
  dedupeReason?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

export const CLINICAL_ESCALATIONS_COLLECTION = 'pulsecheck-clinical-escalations';
export const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
export const USERS_COLLECTION = 'users';
export const LEGACY_ESCALATION_RECORDS_COLLECTION = 'escalation-records';
export const RECORD_CLINICAL_ESCALATION_FUNCTION_PATH =
  '/.netlify/functions/record-clinical-escalation';

const DEFAULT_DEDUPE_WINDOW_SECONDS = 60 * 60;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const requireString = (value: unknown, label: string): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`[ClinicalEscalation] ${label} is required.`);
  }
  return normalized;
};

const buildDedupeKey = (athleteUserId: string, signalSource: string, dayBucket: string): string =>
  `${athleteUserId}|${signalSource}|${dayBucket}`;

const dayBucket = (unixSec: number, windowSec: number): string => {
  const bucketStart = Math.floor(unixSec / windowSec) * windowSec;
  return new Date(bucketStart * 1000).toISOString().slice(0, 16);
};

const stripUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined) as unknown as T;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined) continue;
    out[key] = stripUndefinedDeep(entry);
  }
  return out as T;
};

// ──────────────────────────────────────────────────────────────────────────────
// Designated clinician resolution
// ──────────────────────────────────────────────────────────────────────────────

export interface DesignatedClinician {
  userId: string;
  membershipId: string;
  email: string;
  phone?: string;
  displayName?: string;
}

/**
 * Find the team's designated clinician membership. Spec rule: a team
 * cannot operate a Tier 3 escalation pathway without at least one
 * `clinician`-role membership with an email on file.
 *
 * If multiple clinicians are on the team, the one with `isPrimaryClinician: true`
 * wins; otherwise the first by `addedAt` ascending.
 */
export const resolveDesignatedClinician = async (
  teamId: string,
): Promise<DesignatedClinician | null> => {
  const scopedTeamId = requireString(teamId, 'teamId');
  const snap = await getDocs(
    query(
      collection(db, TEAM_MEMBERSHIPS_COLLECTION),
      where('teamId', '==', scopedTeamId),
      where('role', '==', 'clinician'),
      where('status', '==', 'active'),
    ),
  );

  const candidates = snap.docs
    .map((docSnap) => {
      const data = docSnap.data() || {};
      const email = String(data.email || data.workEmail || '').trim().toLowerCase();
      const userId = String(data.userId || '').trim();
      if (!email || !userId) return null;
      return {
        userId,
        membershipId: docSnap.id,
        email,
        phone: typeof data.phone === 'string' ? data.phone.trim() : undefined,
        displayName:
          typeof data.displayName === 'string'
            ? data.displayName.trim()
            : undefined,
        isPrimary: Boolean(data.isPrimaryClinician),
        addedAt: typeof data.addedAt === 'number' ? data.addedAt : Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.addedAt - b.addedAt;
  });

  const winner = candidates[0];
  return {
    userId: winner.userId,
    membershipId: winner.membershipId,
    email: winner.email,
    phone: winner.phone,
    displayName: winner.displayName,
  };
};

/**
 * Validation: a team is ready to operate Tier 3 escalation when it has
 * at least one designated clinician with email. Used by the provisioning
 * flow to gate pilot activation.
 */
export const teamHasOperationalEscalationContact = async (
  teamId: string,
): Promise<{ ready: boolean; reason?: string }> => {
  const clinician = await resolveDesignatedClinician(teamId);
  if (!clinician) {
    return {
      ready: false,
      reason:
        'No active `clinician` role membership with an email on file. Add a clinician staff member before activating Tier 3 escalation routing.',
    };
  }
  return { ready: true };
};

// ──────────────────────────────────────────────────────────────────────────────
// Crisis wall state on the athlete user doc
// ──────────────────────────────────────────────────────────────────────────────

export const setAthleteCrisisWallActive = async (
  athleteUserId: string,
  context: { escalationId: string; reason: string },
): Promise<void> => {
  const scopedAthleteId = requireString(athleteUserId, 'athleteUserId');
  await updateDoc(doc(db, USERS_COLLECTION, scopedAthleteId), {
    crisisWallActive: true,
    crisisWallActivatedAt: serverTimestamp(),
    crisisWallActiveEscalationId: context.escalationId,
    crisisWallReason: context.reason,
  });
};

export const clearAthleteCrisisWall = async (
  athleteUserId: string,
  context: { resolvedByUserId: string; resolutionNote?: string },
): Promise<void> => {
  const scopedAthleteId = requireString(athleteUserId, 'athleteUserId');
  await updateDoc(doc(db, USERS_COLLECTION, scopedAthleteId), {
    crisisWallActive: false,
    crisisWallClearedAt: serverTimestamp(),
    crisisWallClearedByUserId: context.resolvedByUserId,
    crisisWallClearReason: context.resolutionNote || null,
  });
};

// ──────────────────────────────────────────────────────────────────────────────
// Public entry — record a Tier 3 escalation
// ──────────────────────────────────────────────────────────────────────────────

const findExistingActiveRecordWithinWindow = async (
  athleteUserId: string,
  dedupeKey: string,
): Promise<ClinicalEscalationRecord | null> => {
  const snap = await getDocs(
    query(
      collection(db, CLINICAL_ESCALATIONS_COLLECTION),
      where('athleteUserId', '==', athleteUserId),
      where('dedupeKey', '==', dedupeKey),
    ),
  );
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { ...(docSnap.data() as ClinicalEscalationRecord), id: docSnap.id };
};

/**
 * Records an immutable Tier 3 (or lower) clinical escalation. Idempotent
 * within the dedupe window: a same-signal trigger inside 60 minutes (by
 * default) doesn't create a second record or re-page.
 *
 * The Netlify function `record-clinical-escalation` is the recommended
 * server-side path for fan-out (email + SMS + crisis wall flag). This
 * client-side helper is also exported so the reviewer screen can record
 * a manual escalation without round-tripping through a function.
 */
export const recordClinicalEscalation = async (
  input: RecordClinicalEscalationInput,
): Promise<RecordClinicalEscalationResult> => {
  const athleteUserId = requireString(input.athleteUserId, 'athleteUserId');
  const teamId = requireString(input.teamId, 'teamId');
  const triggeredBySource = requireString(input.triggeredBySource, 'triggeredBySource');
  const detectedAt = input.detectedAt ?? Math.round(Date.now() / 1000);
  const dedupeWindowSeconds = input.dedupeWindowSeconds ?? DEFAULT_DEDUPE_WINDOW_SECONDS;
  const dedupeKey = buildDedupeKey(
    athleteUserId,
    input.signalSource,
    dayBucket(detectedAt, dedupeWindowSeconds),
  );

  // Idempotency check — same signal in the same window short-circuits.
  if (!input.preview) {
    const existing = await findExistingActiveRecordWithinWindow(athleteUserId, dedupeKey);
    if (existing) {
      return {
        recorded: false,
        record: existing,
        dedupeReason: `Existing escalation ${existing.id} matched dedupeKey within the ${dedupeWindowSeconds}s window.`,
      };
    }
  }

  const record: ClinicalEscalationRecord = {
    id: '', // assigned by Firestore
    athleteUserId,
    teamId,
    organizationId: input.organizationId,
    pilotId: input.pilotId,
    tier: input.tier,
    signalSource: input.signalSource,
    evidence: input.evidence,
    detectedAt,
    recordedAt: serverTimestamp(),
    deliveryStatus: 'pending',
    dedupeKey,
    triggeredBySource,
  };

  if (input.preview) {
    return {
      recorded: false,
      record: { ...record, id: 'preview' },
      dedupeReason: 'preview=true; no Firestore write performed',
    };
  }

  const docRef = await addDoc(collection(db, CLINICAL_ESCALATIONS_COLLECTION), stripUndefinedDeep(record));

  return {
    recorded: true,
    record: { ...record, id: docRef.id },
  };
};

/**
 * Acknowledge an escalation — called by the clinician via a magic-link
 * confirmation page (or the admin dashboard). Captures who and when so
 * the audit trail shows duty was discharged.
 */
export const acknowledgeClinicalEscalation = async (
  escalationId: string,
  acknowledgedByUserId: string,
): Promise<void> => {
  const scopedId = requireString(escalationId, 'escalationId');
  const scopedUser = requireString(acknowledgedByUserId, 'acknowledgedByUserId');
  await setDoc(
    doc(db, CLINICAL_ESCALATIONS_COLLECTION, scopedId),
    {
      acknowledgedAt: serverTimestamp(),
      acknowledgedByUserId: scopedUser,
      deliveryStatus: 'clinician_acknowledged' as EscalationDeliveryStatus,
    },
    { merge: true },
  );
};

/**
 * Resolve an escalation — clinician (or admin) marks the issue as
 * addressed. Optionally clears the athlete's crisis wall.
 */
export const resolveClinicalEscalation = async (
  escalationId: string,
  options: {
    resolvedByUserId: string;
    resolutionNote?: string;
    clearCrisisWallForAthleteUserId?: string;
  },
): Promise<void> => {
  const scopedId = requireString(escalationId, 'escalationId');
  const scopedUser = requireString(options.resolvedByUserId, 'resolvedByUserId');
  await setDoc(
    doc(db, CLINICAL_ESCALATIONS_COLLECTION, scopedId),
    stripUndefinedDeep({
      resolvedAt: serverTimestamp(),
      resolvedByUserId: scopedUser,
      resolutionNote: options.resolutionNote,
      deliveryStatus: 'resolved' as EscalationDeliveryStatus,
    }),
    { merge: true },
  );
  if (options.clearCrisisWallForAthleteUserId) {
    await clearAthleteCrisisWall(options.clearCrisisWallForAthleteUserId, {
      resolvedByUserId: scopedUser,
      resolutionNote: options.resolutionNote,
    });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Crisis resources (canonical list — surfaced on iOS crisis wall + web banners)
// ──────────────────────────────────────────────────────────────────────────────

export interface CrisisResource {
  id: string;
  label: string;
  /** What to display next to the resource; coach-voice neutral. */
  description: string;
  /** Optional tap-to-call number. iOS / web converts to `tel:` URL. */
  phone?: string;
  /** Optional tap-to-text number with body. */
  smsNumber?: string;
  smsBody?: string;
  /** Optional informational URL. */
  url?: string;
}

export const CANONICAL_CRISIS_RESOURCES: CrisisResource[] = [
  {
    id: 'us_988',
    label: '988 Suicide & Crisis Lifeline',
    description: 'Free, confidential, 24/7. Available by call or text.',
    phone: '988',
    smsNumber: '988',
    url: 'https://988lifeline.org',
  },
  {
    id: 'us_crisis_text_line',
    label: 'Crisis Text Line',
    description: 'Text HOME to 741741 to connect with a trained crisis counselor.',
    smsNumber: '741741',
    smsBody: 'HOME',
    url: 'https://www.crisistextline.org',
  },
  {
    id: 'us_911',
    label: '911',
    description: 'Call for immediate emergency response.',
    phone: '911',
  },
];

export const pulsecheckClinicalEscalationService = {
  recordClinicalEscalation,
  acknowledgeClinicalEscalation,
  resolveClinicalEscalation,
  resolveDesignatedClinician,
  teamHasOperationalEscalationContact,
  setAthleteCrisisWallActive,
  clearAthleteCrisisWall,
  CANONICAL_CRISIS_RESOURCES,
};
