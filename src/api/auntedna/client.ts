/**
 * AuntEDNA Clinical Services Client
 * 
 * Placeholder client for AuntEDNA's HIPAA-compliant clinical data services.
 * All clinical data is stored in AuntEDNA's infrastructure, not in Pulse.
 * 
 * API Endpoints (Placeholder - replace with real endpoints when available):
 * - POST /api/v1/athletes - Create or update athlete profile
 * - POST /api/v1/escalations - Submit clinical escalation
 * - GET /api/v1/athletes/{id}/status - Get clinical status
 * - POST /api/v1/conversations - Store clinical conversation data
 */

import {
  ShortUser,
  ClinicalHandoffPayload,
  EscalationTier,
  EscalationCategory,
  HandoffStatus
} from '../firebase/escalation/types';

// ============================================================================
// Configuration
// ============================================================================

// PLACEHOLDER: Replace with actual AuntEDNA API endpoint when available
const AUNTEDNA_BASE_URL = process.env.NEXT_PUBLIC_AUNTEDNA_API_URL || 'https://api.auntedna.com/v1';
const AUNTEDNA_API_KEY = process.env.AUNTEDNA_API_KEY || 'placeholder-api-key';

// For development/testing - simulates API responses
const USE_MOCK_RESPONSES = process.env.NEXT_PUBLIC_AUNTEDNA_MOCK === 'true' || true; // Default to mock for now

// ============================================================================
// Types
// ============================================================================

export interface AuntEDNAResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  requestId: string;
}

export interface AthleteRegistrationResponse {
  athleteId: string;
  externalId: string;  // Pulse userId
  createdAt: string;
  status: 'active' | 'pending';
}

export interface EscalationSubmissionResponse {
  escalationId: string;
  status: 'received' | 'processing' | 'assigned';
  clinicianAssigned?: {
    id: string;
    name: string;
    role: string;
  };
  estimatedContactTime?: string;
  crisisResourcesProvided: boolean;
}

export interface ClinicalStatusResponse {
  athleteId: string;
  escalationStatus: 'none' | 'active' | 'in_progress' | 'resolved';
  currentTier?: EscalationTier;
  lastContactAt?: string;
  clinicianId?: string;
  noteForCoach?: string;  // Limited, non-clinical note for coach visibility
}

export interface ConversationUploadResponse {
  conversationId: string;
  messagesStored: number;
  encryptionStatus: 'encrypted' | 'pending';
}

// ============================================================================
// Mock Response Generator
// ============================================================================

const generateMockResponse = <T>(data: T): AuntEDNAResponse<T> => ({
  success: true,
  data,
  requestId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
});

const generateMockError = (code: string, message: string): AuntEDNAResponse<never> => ({
  success: false,
  error: { code, message },
  requestId: `mock-err-${Date.now()}`
});

// Simulate network delay
const simulateDelay = (ms: number = 500) => 
  new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// API Client
// ============================================================================

class AuntEDNAClient {
  private baseUrl: string;
  private apiKey: string;
  private useMock: boolean;

  constructor() {
    this.baseUrl = AUNTEDNA_BASE_URL;
    this.apiKey = AUNTEDNA_API_KEY;
    this.useMock = USE_MOCK_RESPONSES;
  }

  /**
   * Make authenticated request to AuntEDNA API
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: Record<string, any>
  ): Promise<AuntEDNAResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log(`[AuntEDNA] ${method} ${endpoint}`, body ? JSON.stringify(body, null, 2) : '');

    if (this.useMock) {
      console.log('[AuntEDNA] Using mock response');
      await simulateDelay();
      // Return mock based on endpoint
      throw new Error('Mock not implemented for this endpoint');
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Pulse-Integration': 'true'
        },
        body: body ? JSON.stringify(body) : undefined
      });

      const data = await response.json();
      return data as AuntEDNAResponse<T>;
    } catch (error) {
      console.error('[AuntEDNA] Request failed:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed'
        },
        requestId: `error-${Date.now()}`
      };
    }
  }

  /**
   * Register or update an athlete in AuntEDNA's system
   * Called when escalation is triggered to ensure athlete exists in clinical system
   */
  async registerAthlete(athlete: ShortUser): Promise<AuntEDNAResponse<AthleteRegistrationResponse>> {
    console.log('[AuntEDNA] Registering athlete:', athlete.userId);

    if (this.useMock) {
      await simulateDelay();
      return generateMockResponse({
        athleteId: `ae-${athlete.userId.slice(0, 8)}`,
        externalId: athlete.userId,
        createdAt: new Date().toISOString(),
        status: 'active'
      });
    }

    return this.request<AthleteRegistrationResponse>('POST', '/athletes', {
      externalId: athlete.userId,
      displayName: athlete.displayName,
      email: athlete.email,
      username: athlete.username,
      sport: athlete.sport,
      goals: athlete.goals,
      dateOfBirth: athlete.dateOfBirth,
      emergencyContact: athlete.emergencyContact,
      source: 'pulse-pulsecheck',
      registeredAt: new Date().toISOString()
    });
  }

  /**
   * Submit a clinical escalation to AuntEDNA
   * This triggers clinical handoff workflow
   */
  async submitEscalation(payload: ClinicalHandoffPayload): Promise<AuntEDNAResponse<EscalationSubmissionResponse>> {
    console.log('[AuntEDNA] Submitting escalation:', {
      userId: payload.pulseUserId,
      tier: payload.tier,
      category: payload.category
    });

    if (this.useMock) {
      await simulateDelay(800);
      
      // Tier 3 gets immediate assignment
      const isCritical = payload.tier === EscalationTier.CriticalRisk;
      
      return generateMockResponse({
        escalationId: `esc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        status: isCritical ? 'assigned' : 'received',
        clinicianAssigned: isCritical ? {
          id: 'clinician-001',
          name: 'Dr. Sarah Mitchell',
          role: 'Crisis Counselor'
        } : undefined,
        estimatedContactTime: isCritical ? 'Within 15 minutes' : 'Within 24 hours',
        crisisResourcesProvided: isCritical
      });
    }

    return this.request<EscalationSubmissionResponse>('POST', '/escalations', {
      athlete: payload.athlete,
      pulseUserId: payload.pulseUserId,
      pulseConversationId: payload.pulseConversationId,
      escalationRecordId: payload.escalationRecordId,
      tier: payload.tier,
      category: payload.category,
      triggerContent: payload.triggerContent,
      classificationReason: payload.classificationReason,
      conversationSummary: payload.conversationSummary,
      relevantMentalNotes: payload.relevantMentalNotes,
      escalationTimestamp: payload.escalationTimestamp,
      pulseApiCallback: payload.pulseApiCallback
    });
  }

  /**
   * Get clinical status for an athlete
   * Used for coach dashboard (limited information)
   */
  async getClinicalStatus(pulseUserId: string): Promise<AuntEDNAResponse<ClinicalStatusResponse>> {
    console.log('[AuntEDNA] Getting clinical status:', pulseUserId);

    if (this.useMock) {
      await simulateDelay(300);
      return generateMockResponse({
        athleteId: `ae-${pulseUserId.slice(0, 8)}`,
        escalationStatus: 'none',
        noteForCoach: undefined
      });
    }

    return this.request<ClinicalStatusResponse>('GET', `/athletes/${pulseUserId}/status`);
  }

  /**
   * Upload clinical conversation data
   * Called to transfer conversation history to AuntEDNA for clinical record
   */
  async uploadConversation(
    pulseUserId: string,
    conversationId: string,
    messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: number;
    }>,
    summary: string
  ): Promise<AuntEDNAResponse<ConversationUploadResponse>> {
    console.log('[AuntEDNA] Uploading conversation:', {
      userId: pulseUserId,
      conversationId,
      messageCount: messages.length
    });

    if (this.useMock) {
      await simulateDelay(600);
      return generateMockResponse({
        conversationId: `conv-${conversationId}`,
        messagesStored: messages.length,
        encryptionStatus: 'encrypted'
      });
    }

    return this.request<ConversationUploadResponse>('POST', '/conversations', {
      externalUserId: pulseUserId,
      externalConversationId: conversationId,
      messages,
      summary,
      uploadedAt: new Date().toISOString()
    });
  }

  /**
   * Store clinical message
   * Called for each message during an active clinical escalation
   */
  async storeClinicalMessage(
    pulseUserId: string,
    conversationId: string,
    message: {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: number;
    }
  ): Promise<AuntEDNAResponse<{ messageId: string; stored: boolean }>> {
    console.log('[AuntEDNA] Storing clinical message:', {
      userId: pulseUserId,
      conversationId,
      messageId: message.id
    });

    if (this.useMock) {
      await simulateDelay(200);
      return generateMockResponse({
        messageId: message.id,
        stored: true
      });
    }

    return this.request<{ messageId: string; stored: boolean }>('POST', '/conversations/messages', {
      externalUserId: pulseUserId,
      externalConversationId: conversationId,
      message
    });
  }

  /**
   * Resolve an escalation (clinical staff marks as resolved)
   */
  async resolveEscalation(
    escalationId: string,
    resolution: {
      status: 'resolved' | 'ongoing_care';
      notes?: string;  // Clinical notes, not visible to coach
      coachNote?: string;  // Limited note for coach
      followUpScheduled?: boolean;
    }
  ): Promise<AuntEDNAResponse<{ resolved: boolean }>> {
    console.log('[AuntEDNA] Resolving escalation:', escalationId);

    if (this.useMock) {
      await simulateDelay(400);
      return generateMockResponse({ resolved: true });
    }

    return this.request<{ resolved: boolean }>('POST', `/escalations/${escalationId}/resolve`, resolution);
  }

  /**
   * Check if AuntEDNA services are available
   */
  async healthCheck(): Promise<boolean> {
    console.log('[AuntEDNA] Health check');

    if (this.useMock) {
      await simulateDelay(100);
      return true;
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const auntEDNAClient = new AuntEDNAClient();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build the callback URL that AuntEDNA can use to fetch more athlete data
 */
export function buildPulseCallbackUrl(userId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pulsefitness.app';
  return `${baseUrl}/.netlify/functions/auntedna-callback?userId=${userId}`;
}

/**
 * Create a ShortUser object from full user profile data
 */
export function createShortUser(profile: {
  id: string;
  displayName?: string;
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
}): ShortUser {
  return {
    userId: profile.id,
    displayName: profile.displayName || 'Unknown User',
    email: profile.email,
    username: profile.username,
    sport: profile.sport,
    goals: profile.goals,
    dateOfBirth: profile.dateOfBirth,
    emergencyContact: profile.emergencyContact
  };
}

/**
 * Build the clinical handoff payload
 */
export function buildHandoffPayload(
  shortUser: ShortUser,
  conversationId: string,
  escalationRecordId: string,
  tier: EscalationTier,
  category: EscalationCategory,
  triggerContent: string,
  classificationReason: string,
  conversationSummary: string,
  mentalNotes?: Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    severity: string;
  }>
): ClinicalHandoffPayload {
  return {
    pulseUserId: shortUser.userId,
    pulseConversationId: conversationId,
    escalationRecordId,
    athlete: shortUser,
    tier,
    category,
    triggerContent,
    classificationReason,
    conversationSummary,
    relevantMentalNotes: mentalNotes,
    escalationTimestamp: Date.now(),
    pulseApiCallback: buildPulseCallbackUrl(shortUser.userId)
  };
}

export default auntEDNAClient;
