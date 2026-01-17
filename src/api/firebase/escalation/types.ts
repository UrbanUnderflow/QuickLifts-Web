/**
 * PulseCheck Escalation System Types
 * 
 * Defines data models for the 3-tier escalation system:
 * - Tier 1: Monitor-Only (notify coach, no modal)
 * - Tier 2: Elevated Risk (consent-based clinical escalation)
 * - Tier 3: Critical Risk (mandatory clinical escalation)
 */

// ============================================================================
// Enums
// ============================================================================

export enum EscalationTier {
  None = 0,
  MonitorOnly = 1,      // Tier 1: Notify coach, adaptive support
  ElevatedRisk = 2,     // Tier 2: Consent-based clinical handoff
  CriticalRisk = 3      // Tier 3: Mandatory clinical handoff
}

export enum EscalationCategory {
  // Tier 1 Categories (Monitor-Only)
  PerformanceStress = 'performance-stress',
  Fatigue = 'fatigue',
  EmotionalVariability = 'emotional-variability',
  Burnout = 'burnout',
  
  // Tier 2 Categories (Elevated Risk)
  PersistentDistress = 'persistent-distress',
  AnxietyIndicators = 'anxiety-indicators',
  DisorderedEating = 'disordered-eating',
  IdentityImpact = 'identity-impact',
  InjuryPsychological = 'injury-psychological',
  RecurrentTier1 = 'recurrent-tier1',
  
  // Tier 3 Categories (Critical Risk)
  SelfHarm = 'self-harm',
  SuicidalIdeation = 'suicidal-ideation',
  ImminentSafetyRisk = 'imminent-safety-risk',
  SeverePsychologicalDistress = 'severe-psychological-distress',
  AbuseDisclosure = 'abuse-disclosure',
  RapidDeterioration = 'rapid-deterioration',
  
  // General
  General = 'general'
}

export enum ConsentStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Declined = 'declined',
  NotRequired = 'not-required'  // For Tier 3
}

export enum HandoffStatus {
  Pending = 'pending',
  Initiated = 'initiated',
  Completed = 'completed',
  Failed = 'failed'
}

export enum EscalationRecordStatus {
  Active = 'active',
  Resolved = 'resolved',
  Declined = 'declined'
}

// ============================================================================
// Escalation Condition (Admin-managed for AI fine-tuning)
// ============================================================================

export interface EscalationCondition {
  id: string;
  tier: EscalationTier;
  category: EscalationCategory;
  title: string;
  description: string;
  examplePhrases: string[];      // Example triggering phrases for AI
  keywords: string[];             // Keywords that may indicate this condition
  isActive: boolean;
  priority: number;               // Higher = more weight in classification
  createdAt: number;
  updatedAt: number;
  createdBy: string;              // Admin userId who created this
}

export interface EscalationConditionInput {
  tier: EscalationTier;
  category: EscalationCategory;
  title: string;
  description: string;
  examplePhrases: string[];
  keywords: string[];
  isActive: boolean;
  priority: number;
}

// ============================================================================
// Escalation Record (Audit log of escalation events)
// ============================================================================

export interface EscalationRecord {
  id: string;
  
  // User & Conversation Context
  userId: string;
  conversationId: string;
  
  // Classification Details
  tier: EscalationTier;
  category: EscalationCategory;
  triggerMessageId: string;
  triggerContent: string;         // The message that triggered escalation
  classificationReason: string;   // AI's reasoning for classification
  classificationConfidence: number; // 0-1 confidence score
  
  // Consent & Handoff Status
  consentStatus: ConsentStatus;
  consentTimestamp?: number;
  handoffStatus: HandoffStatus;
  
  // Coach Notification (Tier 1 & 2)
  coachNotified: boolean;
  coachId?: string;
  coachNotifiedAt?: number;
  
  // Clinical Handoff (Tier 2 & 3)
  clinicalReferenceId?: string;   // AuntEDNA reference ID
  conversationSummary?: string;   // AI-generated summary for clinical handoff
  
  // Timestamps
  createdAt: number;
  resolvedAt?: number;
  
  // Status
  status: EscalationRecordStatus;
}

// ============================================================================
// Short User Object (Sent to AuntEDNA)
// ============================================================================

export interface ShortUser {
  userId: string;
  displayName: string;
  email?: string;
  username?: string;
  sport?: string;
  goals?: string[];
  dateOfBirth?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

// ============================================================================
// Clinical Handoff Payload (Sent to AuntEDNA)
// ============================================================================

export interface ClinicalHandoffPayload {
  // Reference
  pulseUserId: string;
  pulseConversationId: string;
  escalationRecordId: string;
  
  // User Info (Short User)
  athlete: ShortUser;
  
  // Escalation Context
  tier: EscalationTier;
  category: EscalationCategory;
  triggerContent: string;
  classificationReason: string;
  
  // Clinical Data
  conversationSummary: string;
  relevantMentalNotes?: {
    id: string;
    title: string;
    content: string;
    category: string;
    severity: string;
  }[];
  
  // Timestamps
  escalationTimestamp: number;
  
  // Callback URL for AuntEDNA to fetch more data
  pulseApiCallback: string;
}

// ============================================================================
// Classification Response (from AI)
// ============================================================================

export interface EscalationClassification {
  tier: EscalationTier;
  category: EscalationCategory;
  reason: string;
  confidence: number;
  shouldEscalate: boolean;
  suggestedResponse?: string;    // Safety-mode response for Tier 3
}

// ============================================================================
// Conversation Escalation State (added to conversations collection)
// ============================================================================

export interface ConversationEscalationState {
  escalationTier?: EscalationTier;
  escalationStatus?: EscalationRecordStatus;
  escalationRecordId?: string;
  isInSafetyMode?: boolean;       // Tier 3: suspend normal conversation
  lastEscalationAt?: number;
}

// ============================================================================
// Coach Escalation View (What coaches see - no clinical details)
// ============================================================================

export interface CoachEscalationView {
  id: string;
  
  // Athlete Info (limited)
  athleteId: string;
  athleteName: string;
  athleteUsername?: string;
  athleteProfileImage?: string;
  
  // Status Indicators Only
  statusLabel: string;            // "Elevated concern flagged" | "Clinical escalation initiated" | "Engaged with care"
  tier: EscalationTier;
  category: EscalationCategory;   // General category only
  
  // Timestamps
  flaggedAt: number;
  lastUpdated: number;
  
  // Actions Available
  canMessage: boolean;
}

// ============================================================================
// Firestore Conversion Helpers
// ============================================================================

export function escalationConditionFromFirestore(id: string, data: any): EscalationCondition {
  return {
    id,
    tier: data.tier ?? EscalationTier.None,
    category: data.category ?? EscalationCategory.General,
    title: data.title ?? '',
    description: data.description ?? '',
    examplePhrases: Array.isArray(data.examplePhrases) ? data.examplePhrases : [],
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    isActive: data.isActive ?? true,
    priority: data.priority ?? 0,
    createdAt: data.createdAt ?? Math.floor(Date.now() / 1000),
    updatedAt: data.updatedAt ?? Math.floor(Date.now() / 1000),
    createdBy: data.createdBy ?? ''
  };
}

export function escalationConditionToFirestore(condition: EscalationConditionInput): Record<string, any> {
  return {
    tier: condition.tier,
    category: condition.category,
    title: condition.title,
    description: condition.description,
    examplePhrases: condition.examplePhrases,
    keywords: condition.keywords,
    isActive: condition.isActive,
    priority: condition.priority,
    updatedAt: Math.floor(Date.now() / 1000)
  };
}

export function escalationRecordFromFirestore(id: string, data: any): EscalationRecord {
  return {
    id,
    userId: data.userId ?? '',
    conversationId: data.conversationId ?? '',
    tier: data.tier ?? EscalationTier.None,
    category: data.category ?? EscalationCategory.General,
    triggerMessageId: data.triggerMessageId ?? '',
    triggerContent: data.triggerContent ?? '',
    classificationReason: data.classificationReason ?? '',
    classificationConfidence: data.classificationConfidence ?? 0,
    consentStatus: data.consentStatus ?? ConsentStatus.Pending,
    consentTimestamp: data.consentTimestamp,
    handoffStatus: data.handoffStatus ?? HandoffStatus.Pending,
    coachNotified: data.coachNotified ?? false,
    coachId: data.coachId,
    coachNotifiedAt: data.coachNotifiedAt,
    clinicalReferenceId: data.clinicalReferenceId,
    conversationSummary: data.conversationSummary,
    createdAt: data.createdAt ?? Math.floor(Date.now() / 1000),
    resolvedAt: data.resolvedAt,
    status: data.status ?? EscalationRecordStatus.Active
  };
}

export function escalationRecordToFirestore(record: Omit<EscalationRecord, 'id'>): Record<string, any> {
  return {
    userId: record.userId,
    conversationId: record.conversationId,
    tier: record.tier,
    category: record.category,
    triggerMessageId: record.triggerMessageId,
    triggerContent: record.triggerContent,
    classificationReason: record.classificationReason,
    classificationConfidence: record.classificationConfidence,
    consentStatus: record.consentStatus,
    consentTimestamp: record.consentTimestamp,
    handoffStatus: record.handoffStatus,
    coachNotified: record.coachNotified,
    coachId: record.coachId,
    coachNotifiedAt: record.coachNotifiedAt,
    clinicalReferenceId: record.clinicalReferenceId,
    conversationSummary: record.conversationSummary,
    createdAt: record.createdAt,
    resolvedAt: record.resolvedAt,
    status: record.status
  };
}

// ============================================================================
// Tier Display Helpers
// ============================================================================

export function getTierLabel(tier: EscalationTier): string {
  switch (tier) {
    case EscalationTier.MonitorOnly:
      return 'Monitor Only';
    case EscalationTier.ElevatedRisk:
      return 'Elevated Risk';
    case EscalationTier.CriticalRisk:
      return 'Critical Risk';
    default:
      return 'None';
  }
}

export function getTierColor(tier: EscalationTier): { bg: string; text: string; border: string } {
  switch (tier) {
    case EscalationTier.MonitorOnly:
      return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' };
    case EscalationTier.ElevatedRisk:
      return { bg: 'rgba(249, 115, 22, 0.1)', text: '#F97316', border: 'rgba(249, 115, 22, 0.3)' };
    case EscalationTier.CriticalRisk:
      return { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' };
    default:
      return { bg: 'rgba(113, 113, 122, 0.1)', text: '#71717A', border: 'rgba(113, 113, 122, 0.3)' };
  }
}

export function getCategoryLabel(category: EscalationCategory): string {
  const labels: Record<EscalationCategory, string> = {
    [EscalationCategory.PerformanceStress]: 'Performance Stress',
    [EscalationCategory.Fatigue]: 'Fatigue',
    [EscalationCategory.EmotionalVariability]: 'Emotional Variability',
    [EscalationCategory.Burnout]: 'Burnout',
    [EscalationCategory.PersistentDistress]: 'Persistent Distress',
    [EscalationCategory.AnxietyIndicators]: 'Anxiety Indicators',
    [EscalationCategory.DisorderedEating]: 'Disordered Eating',
    [EscalationCategory.IdentityImpact]: 'Identity Impact',
    [EscalationCategory.InjuryPsychological]: 'Injury-Related',
    [EscalationCategory.RecurrentTier1]: 'Recurrent Concerns',
    [EscalationCategory.SelfHarm]: 'Self-Harm',
    [EscalationCategory.SuicidalIdeation]: 'Suicidal Ideation',
    [EscalationCategory.ImminentSafetyRisk]: 'Imminent Safety Risk',
    [EscalationCategory.SeverePsychologicalDistress]: 'Severe Distress',
    [EscalationCategory.AbuseDisclosure]: 'Abuse Disclosure',
    [EscalationCategory.RapidDeterioration]: 'Rapid Deterioration',
    [EscalationCategory.General]: 'General'
  };
  return labels[category] || 'Unknown';
}

export function getCoachStatusLabel(tier: EscalationTier, handoffStatus: HandoffStatus): string {
  if (tier === EscalationTier.CriticalRisk) {
    if (handoffStatus === HandoffStatus.Completed) {
      return 'Engaged with care';
    }
    return 'Clinical escalation initiated';
  }
  if (tier === EscalationTier.ElevatedRisk) {
    if (handoffStatus === HandoffStatus.Completed) {
      return 'Connected with support';
    }
    return 'Elevated concern flagged';
  }
  return 'Being monitored';
}
