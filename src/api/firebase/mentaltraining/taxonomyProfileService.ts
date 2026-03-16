import type { BaselineAssessment, MentalCheckIn } from './types';
import type {
  ProgramPrescription,
  SimSessionRecord,
  TaxonomyCheckInState,
  TaxonomyProfile,
} from './taxonomy';

const profileSnapshotRuntime = require('./profileSnapshotRuntime');

export function buildTaxonomyCheckInState(input: {
  readinessScore: number;
  energyLevel?: number;
  stressLevel?: number;
  sleepQuality?: number;
  moodWord?: string;
  priorProfile?: TaxonomyProfile | null;
}): TaxonomyCheckInState {
  return profileSnapshotRuntime.buildTaxonomyCheckInState(input);
}

export function bootstrapTaxonomyProfile(
  assessment?: BaselineAssessment | null
): TaxonomyProfile {
  return profileSnapshotRuntime.bootstrapTaxonomyProfile(assessment);
}

export function deriveTaxonomyProfile(input: {
  baselineAssessment?: BaselineAssessment | null;
  checkIns?: MentalCheckIn[];
  simSessions?: SimSessionRecord[];
}): TaxonomyProfile {
  return profileSnapshotRuntime.deriveTaxonomyProfile(input);
}

export function prescribeNextSession(input: {
  profile: TaxonomyProfile;
  checkInState?: TaxonomyCheckInState | null;
}): ProgramPrescription {
  return profileSnapshotRuntime.prescribeNextSession(input);
}

export function calculateTransferGap(trainingScore: number, trialScore: number): number {
  return profileSnapshotRuntime.calculateTransferGap(trainingScore, trialScore);
}
