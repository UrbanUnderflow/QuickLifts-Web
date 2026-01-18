/**
 * PulseCheck Escalation Service
 * 
 * Handles Firestore operations for:
 * - Escalation Conditions (admin-managed)
 * - Escalation Records (audit log)
 * - Conversation escalation state
 */

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../config';
import {
  EscalationCondition,
  EscalationConditionInput,
  EscalationRecord,
  EscalationTier,
  EscalationCategory,
  ConsentStatus,
  HandoffStatus,
  EscalationRecordStatus,
  escalationConditionFromFirestore,
  escalationConditionToFirestore,
  escalationRecordFromFirestore,
  escalationRecordToFirestore,
  ConversationEscalationState
} from './types';

// ============================================================================
// Collection References
// ============================================================================

const ESCALATION_CONDITIONS_COLLECTION = 'escalation-conditions';
const ESCALATION_RECORDS_COLLECTION = 'escalation-records';
const CONVERSATIONS_COLLECTION = 'conversations';

// ============================================================================
// Escalation Conditions Service (Admin-managed)
// ============================================================================

export const escalationConditionsService = {
  /**
   * Load all escalation conditions (admin view)
   */
  async loadAll(): Promise<EscalationCondition[]> {
    const ref = collection(db, ESCALATION_CONDITIONS_COLLECTION);
    const q = query(ref, orderBy('tier', 'asc'), orderBy('priority', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => escalationConditionFromFirestore(doc.id, doc.data()));
  },

  /**
   * Load active conditions only (for classification)
   */
  async loadActive(): Promise<EscalationCondition[]> {
    const ref = collection(db, ESCALATION_CONDITIONS_COLLECTION);
    const q = query(
      ref, 
      where('isActive', '==', true),
      orderBy('tier', 'asc'), 
      orderBy('priority', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => escalationConditionFromFirestore(doc.id, doc.data()));
  },

  /**
   * Load conditions by tier
   */
  async loadByTier(tier: EscalationTier): Promise<EscalationCondition[]> {
    const ref = collection(db, ESCALATION_CONDITIONS_COLLECTION);
    const q = query(
      ref, 
      where('tier', '==', tier),
      where('isActive', '==', true),
      orderBy('priority', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => escalationConditionFromFirestore(doc.id, doc.data()));
  },

  /**
   * Get a single condition by ID
   */
  async get(conditionId: string): Promise<EscalationCondition | null> {
    const ref = doc(db, ESCALATION_CONDITIONS_COLLECTION, conditionId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;
    return escalationConditionFromFirestore(snapshot.id, snapshot.data());
  },

  /**
   * Create a new escalation condition
   */
  async create(input: EscalationConditionInput, createdBy: string): Promise<string> {
    const ref = collection(db, ESCALATION_CONDITIONS_COLLECTION);
    const now = Math.floor(Date.now() / 1000);
    const data = {
      ...escalationConditionToFirestore(input),
      createdAt: now,
      createdBy
    };
    const docRef = await addDoc(ref, data);
    return docRef.id;
  },

  /**
   * Update an existing condition
   */
  async update(conditionId: string, input: Partial<EscalationConditionInput>): Promise<void> {
    const ref = doc(db, ESCALATION_CONDITIONS_COLLECTION, conditionId);
    const data: Record<string, any> = {
      ...input,
      updatedAt: Math.floor(Date.now() / 1000)
    };
    await updateDoc(ref, data);
  },

  /**
   * Delete a condition
   */
  async delete(conditionId: string): Promise<void> {
    const ref = doc(db, ESCALATION_CONDITIONS_COLLECTION, conditionId);
    await deleteDoc(ref);
  },

  /**
   * Toggle condition active status
   */
  async toggleActive(conditionId: string, isActive: boolean): Promise<void> {
    const ref = doc(db, ESCALATION_CONDITIONS_COLLECTION, conditionId);
    await updateDoc(ref, { 
      isActive, 
      updatedAt: Math.floor(Date.now() / 1000) 
    });
  },

  /**
   * Listen to conditions changes (real-time)
   */
  listenAll(
    callback: (conditions: EscalationCondition[]) => void,
    onError?: (error: unknown) => void
  ): Unsubscribe {
    const ref = collection(db, ESCALATION_CONDITIONS_COLLECTION);
    const q = query(ref, orderBy('tier', 'asc'), orderBy('priority', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const conditions = snapshot.docs.map(doc =>
          escalationConditionFromFirestore(doc.id, doc.data())
        );
        callback(conditions);
      },
      (error) => {
        if (onError) onError(error);
      }
    );
  },

  /**
   * Build training context from conditions (for AI classification)
   */
  async buildTrainingContext(): Promise<string> {
    const conditions = await this.loadActive();
    
    const tier1 = conditions.filter(c => c.tier === EscalationTier.MonitorOnly);
    const tier2 = conditions.filter(c => c.tier === EscalationTier.ElevatedRisk);
    const tier3 = conditions.filter(c => c.tier === EscalationTier.CriticalRisk);

    const formatCondition = (c: EscalationCondition) => 
      `- ${c.title}: ${c.description}\n  Examples: ${c.examplePhrases.slice(0, 3).map(p => `"${p}"`).join(', ')}\n  Keywords: ${c.keywords.join(', ')}`;

    return `
## Tier 1 (Monitor-Only) - Notify coach, provide adaptive support:
${tier1.map(formatCondition).join('\n\n')}

## Tier 2 (Elevated Risk) - Consent-based clinical escalation:
${tier2.map(formatCondition).join('\n\n')}

## Tier 3 (Critical Risk) - MANDATORY clinical escalation:
${tier3.map(formatCondition).join('\n\n')}
    `.trim();
  }
};

// ============================================================================
// Escalation Records Service (Audit Log)
// ============================================================================

export const escalationRecordsService = {
  /**
   * Create a new escalation record
   */
  async create(record: Omit<EscalationRecord, 'id'>): Promise<string> {
    const ref = collection(db, ESCALATION_RECORDS_COLLECTION);
    const data = escalationRecordToFirestore(record);
    const docRef = await addDoc(ref, data);
    return docRef.id;
  },

  /**
   * Get escalation record by ID
   */
  async get(recordId: string): Promise<EscalationRecord | null> {
    const ref = doc(db, ESCALATION_RECORDS_COLLECTION, recordId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;
    return escalationRecordFromFirestore(snapshot.id, snapshot.data());
  },

  /**
   * Get active escalation for a conversation
   */
  async getActiveForConversation(conversationId: string): Promise<EscalationRecord | null> {
    const ref = collection(db, ESCALATION_RECORDS_COLLECTION);
    const q = query(
      ref,
      where('conversationId', '==', conversationId),
      where('status', '==', EscalationRecordStatus.Active)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return escalationRecordFromFirestore(snapshot.docs[0].id, snapshot.docs[0].data());
  },

  /**
   * Get all escalation records for a user
   */
  async getForUser(userId: string): Promise<EscalationRecord[]> {
    const ref = collection(db, ESCALATION_RECORDS_COLLECTION);
    const q = query(
      ref,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => escalationRecordFromFirestore(doc.id, doc.data()));
  },

  /**
   * Get active escalations for coach's athletes
   */
  async getActiveForCoach(coachId: string): Promise<EscalationRecord[]> {
    const ref = collection(db, ESCALATION_RECORDS_COLLECTION);
    const q = query(
      ref,
      where('coachId', '==', coachId),
      where('status', '==', EscalationRecordStatus.Active),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => escalationRecordFromFirestore(doc.id, doc.data()));
  },

  /**
   * Update consent status
   */
  async updateConsent(recordId: string, status: ConsentStatus): Promise<void> {
    const ref = doc(db, ESCALATION_RECORDS_COLLECTION, recordId);
    await updateDoc(ref, {
      consentStatus: status,
      consentTimestamp: Math.floor(Date.now() / 1000)
    });
  },

  /**
   * Update handoff status
   */
  async updateHandoff(recordId: string, status: HandoffStatus, clinicalReferenceId?: string): Promise<void> {
    const ref = doc(db, ESCALATION_RECORDS_COLLECTION, recordId);
    const update: Record<string, any> = { handoffStatus: status };
    if (clinicalReferenceId) {
      update.clinicalReferenceId = clinicalReferenceId;
    }
    await updateDoc(ref, update);
  },

  /**
   * Mark coach as notified
   */
  async markCoachNotified(recordId: string, coachId: string): Promise<void> {
    const ref = doc(db, ESCALATION_RECORDS_COLLECTION, recordId);
    await updateDoc(ref, {
      coachNotified: true,
      coachId,
      coachNotifiedAt: Math.floor(Date.now() / 1000)
    });
  },

  /**
   * Resolve an escalation
   */
  async resolve(recordId: string): Promise<void> {
    const ref = doc(db, ESCALATION_RECORDS_COLLECTION, recordId);
    await updateDoc(ref, {
      status: EscalationRecordStatus.Resolved,
      resolvedAt: Math.floor(Date.now() / 1000)
    });
  },

  /**
   * Mark escalation as declined (user declined Tier 2 consent)
   */
  async decline(recordId: string): Promise<void> {
    const ref = doc(db, ESCALATION_RECORDS_COLLECTION, recordId);
    await updateDoc(ref, {
      status: EscalationRecordStatus.Declined,
      consentStatus: ConsentStatus.Declined,
      consentTimestamp: Math.floor(Date.now() / 1000)
    });
  },

  /**
   * Set conversation summary (for clinical handoff)
   */
  async setSummary(recordId: string, summary: string): Promise<void> {
    const ref = doc(db, ESCALATION_RECORDS_COLLECTION, recordId);
    await updateDoc(ref, { conversationSummary: summary });
  },

  /**
   * Listen to active escalations for a coach
   */
  listenForCoach(coachId: string, callback: (records: EscalationRecord[]) => void): Unsubscribe {
    const ref = collection(db, ESCALATION_RECORDS_COLLECTION);
    const q = query(
      ref,
      where('coachId', '==', coachId),
      where('status', '==', EscalationRecordStatus.Active)
    );
    return onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => 
        escalationRecordFromFirestore(doc.id, doc.data())
      );
      callback(records);
    });
  },

  /**
   * Get recent escalations (for admin view)
   */
  async getRecent(limit: number = 50): Promise<EscalationRecord[]> {
    const ref = collection(db, ESCALATION_RECORDS_COLLECTION);
    const q = query(
      ref,
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .slice(0, limit)
      .map(doc => escalationRecordFromFirestore(doc.id, doc.data()));
  }
};

// ============================================================================
// Conversation Escalation State Service
// ============================================================================

export const conversationEscalationService = {
  /**
   * Update conversation with escalation state
   */
  async setEscalationState(
    conversationId: string, 
    state: ConversationEscalationState
  ): Promise<void> {
    const ref = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    // Spread to plain object for Firestore updateDoc compatibility
    await updateDoc(ref, { ...state });
  },

  /**
   * Get escalation state for a conversation
   */
  async getEscalationState(conversationId: string): Promise<ConversationEscalationState | null> {
    const ref = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;
    
    const data = snapshot.data();
    return {
      escalationTier: data.escalationTier,
      escalationStatus: data.escalationStatus,
      escalationRecordId: data.escalationRecordId,
      isInSafetyMode: data.isInSafetyMode,
      lastEscalationAt: data.lastEscalationAt
    };
  },

  /**
   * Enter safety mode (Tier 3)
   */
  async enterSafetyMode(conversationId: string): Promise<void> {
    const ref = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    await updateDoc(ref, {
      isInSafetyMode: true,
      escalationTier: EscalationTier.CriticalRisk,
      lastEscalationAt: Math.floor(Date.now() / 1000)
    });
  },

  /**
   * Exit safety mode
   */
  async exitSafetyMode(conversationId: string): Promise<void> {
    const ref = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    await updateDoc(ref, {
      isInSafetyMode: false
    });
  }
};

// ============================================================================
// Combined Exports
// ============================================================================

export const escalationService = {
  conditions: escalationConditionsService,
  records: escalationRecordsService,
  conversation: conversationEscalationService
};

export default escalationService;
