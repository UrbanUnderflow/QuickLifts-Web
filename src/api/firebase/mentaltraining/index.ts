/**
 * Nora Mental Training System
 * 
 * Central export for all mental training related services and types.
 */

// Types
export * from './types';
export * from './taxonomy';
export * from './displayNames';

// Services
export { exerciseLibraryService, simModuleLibraryService } from './exerciseLibraryService';
export { assignmentService, assignmentService as simAssignmentService } from './assignmentService';
export { completionService, completionService as simCompletionService } from './completionService';
export { gameLevelProgressService } from './gameLevelProgressService';
export { simSessionService } from './simSessionService';
export {
  VISION_PRO_SIM_ASSIGNMENTS_COLLECTION,
  visionProTrialService,
  VISION_PRO_CURRICULUM_ASSIGNMENTS_COLLECTION,
  VISION_PRO_LEGACY_ASSIGNMENTS_COLLECTION,
} from './visionProTrialService';
export { buildTaxonomyCheckInState, bootstrapTaxonomyProfile, deriveTaxonomyProfile, prescribeNextSession, calculateTransferGap } from './taxonomyProfileService';
export * from './collections';
export { simVariantRegistryService, buildSimVariantId } from './variantRegistryService';
export * from './simBuild';

// Curriculum Services
export { curriculumAssignmentService } from './curriculumAssignmentService';
export { athleteProgressService } from './athleteProgressService';
export { recommendationService } from './recommendationService';
export { assignmentOrchestratorService } from './assignmentOrchestratorService';
export { stateSnapshotService } from './stateSnapshotService';
export { pulseCheckCheckInSubmissionService } from './pulseCheckCheckInSubmissionService';
export { protocolRegistryService } from './protocolRegistryService';
export { protocolResponsivenessService } from './protocolResponsivenessService';
export { protocolAudioAssetService } from './protocolAudioAssetService';
export { profileSnapshotService } from './profileSnapshotService';
export type {
  CanonicalProfileSnapshot,
  ProfileSnapshotExportJob,
  ProfileSnapshotExportJobInput,
  ProfileSnapshotMilestoneType,
  ProfileSnapshotNarrative,
  ProfileSnapshotPayload,
  ProfileSnapshotRevision,
  ProfileSnapshotWriteInput,
  ProfileSnapshotWriteResult,
} from './profileSnapshotService';
