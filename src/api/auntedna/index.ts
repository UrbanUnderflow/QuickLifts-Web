/**
 * AuntEDNA Clinical Services Module
 * 
 * Export client and helper functions for integrating with AuntEDNA's
 * HIPAA-compliant clinical data services.
 */

export { 
  auntEDNAClient, 
  buildPulseCallbackUrl,
  createShortUser,
  buildHandoffPayload
} from './client';

export type {
  AuntEDNAResponse,
  AthleteRegistrationResponse,
  EscalationSubmissionResponse,
  ClinicalStatusResponse,
  ConversationUploadResponse
} from './client';
