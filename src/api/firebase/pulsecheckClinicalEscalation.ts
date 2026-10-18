// Tier 3 safety routing and minimal responder queue clients. All recording,
// acknowledgement and resolution go through authenticated server endpoints.
// Participation, optional health authorization and routine event consent stay
// separate from the configured urgent safety basis. Queue resolution records
// the responder's action; it never clears protective state or proves provider care.

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, getFirebaseModeRequestHeaders } from './config';

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
  | 'failed'
  | 'not_applicable';

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
  deliveryNeedsAttention?: boolean;
  stageStatus?: Record<string, string>;
  athleteDisplayName?: string;
  athletePhone?: string;
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
export const ATHLETE_SAFETY_STATE_COLLECTION = 'pulsecheck-athlete-safety-state';
export const LEGACY_ESCALATION_RECORDS_COLLECTION = 'escalation-records';
export const RECORD_CLINICAL_ESCALATION_FUNCTION_PATH =
  '/.netlify/functions/record-clinical-escalation';
export const PULSECHECK_ESCALATION_FUNCTION_PATH =
  '/.netlify/functions/pulsecheck-escalation';

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
// Crisis wall state in the private athlete safety-state collection. Firestore
// rules reject browser writes; these helpers remain for trusted/server-backed
// runtimes and must not be used as a staff-page mutation path.
// ──────────────────────────────────────────────────────────────────────────────

export const setAthleteCrisisWallActive = async (
  athleteUserId: string,
  context: { escalationId: string; reason: string; teamId?: string },
): Promise<void> => {
  const scopedAthleteId = requireString(athleteUserId, 'athleteUserId');
  await setDoc(
    doc(db, ATHLETE_SAFETY_STATE_COLLECTION, scopedAthleteId),
    stripUndefinedDeep({
      athleteUserId: scopedAthleteId,
      teamId: context.teamId,
      crisisWallActive: true,
      crisisWallActivatedAt: serverTimestamp(),
      crisisWallActiveEscalationId: context.escalationId,
      crisisWallReason: context.reason,
    }),
    { merge: true },
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Public entry — record a Tier 3 escalation
// ──────────────────────────────────────────────────────────────────────────────

/** Tier 3-only server fan-out. Preview builds a local record without submitting. */
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

  if (input.tier !== 3) throw new Error('Routine support requires the consent-based handoff.');
  const payload = await clinicalRequest(RECORD_CLINICAL_ESCALATION_FUNCTION_PATH, input);
  return { recorded: payload.recorded === true, record: payload.record as ClinicalEscalationRecord };

};

/** Records authenticated designated-responder receipt, separately from clinical care. */
export const acknowledgeClinicalEscalation = async (
  escalationId: string,
  acknowledgedByUserId: string,
): Promise<void> => {
  if (auth.currentUser?.uid !== acknowledgedByUserId) throw new Error('Sign in as the responding clinician.');
  await clinicalResponderRequest({ action: 'acknowledge', escalationId });
};

/** Records local responder resolution while preserving protective state and provider status. */
export const resolveClinicalEscalation = async (
  escalationId: string,
  options: {
    resolvedByUserId: string;
    resolutionNote?: string;
    athleteUserId: string;
    legacyEscalationRecordId?: string;
  },
): Promise<{
  resolved: boolean;
  crisisWallCleared: boolean;
  clearancePending: boolean;
  providerConfirmed: boolean;
}> => {
  if (auth.currentUser?.uid !== options.resolvedByUserId) throw new Error('Sign in as the responding clinician.');
  await clinicalResponderRequest({ action: 'resolve', escalationId, resolutionNote: options.resolutionNote });
  return { resolved: true, crisisWallCleared: false, clearancePending: true, providerConfirmed: false };
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
  CANONICAL_CRISIS_RESOURCES,
};

async function clinicalRequest(path: string, body: unknown): Promise<any> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in is required.');
  const response = await fetch(path, { method: 'POST', headers: { ...getFirebaseModeRequestHeaders(), 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok || response.status === 202) throw new Error(payload.error || 'Delivery is pending or unconfirmed. Review the safety status before retrying.');
  return payload;
}
export const clinicalResponderRequest = (body: unknown): Promise<{ records?: ClinicalEscalationRecord[]; record?: ClinicalEscalationRecord }> =>
  clinicalRequest('/.netlify/functions/clinical-responder', body);
