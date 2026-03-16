import type { AthleteMentalProgress } from '../mentaltraining/types';
import type { PulseCheckAthleteOnboardingState } from './types';

export type PulseCheckBaselineTaskStatus = 'pending' | 'ready' | 'started' | 'complete';

export type PulseCheckBaselineCompletionSource =
  | 'web-assessment'
  | 'native-probe'
  | 'membership-sync'
  | null;

export interface PulseCheckAthleteTaskState {
  consentComplete: boolean;
  baselineStatus: PulseCheckBaselineTaskStatus;
  baselineComplete: boolean;
  baselineCompletionSource: PulseCheckBaselineCompletionSource;
  baselineCompletedAt: number | null;
  requiredTasksComplete: boolean;
}

function coerceMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (value && typeof value === 'object') {
    const candidate = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof candidate.toMillis === 'function') {
      return candidate.toMillis();
    }
    if (typeof candidate.seconds === 'number') {
      const nanos = typeof candidate.nanoseconds === 'number' ? candidate.nanoseconds : 0;
      return candidate.seconds * 1000 + Math.floor(nanos / 1_000_000);
    }
  }
  return null;
}

export function getCompletedBaselineEvidence(progress?: AthleteMentalProgress | null): {
  complete: boolean;
  source: PulseCheckBaselineCompletionSource;
  completedAt: number | null;
} {
  if (!progress || progress.assessmentNeeded) {
    return { complete: false, source: null, completedAt: null };
  }

  if (progress.baselineAssessment) {
    return {
      complete: true,
      source: 'web-assessment',
      completedAt: coerceMillis(progress.baselineAssessment.completedAt),
    };
  }

  if (progress.baselineProbe) {
    return {
      complete: true,
      source: 'native-probe',
      completedAt: coerceMillis(progress.baselineProbe.completedAt),
    };
  }

  return { complete: false, source: null, completedAt: null };
}

export function resolvePulseCheckAthleteTaskState(input: {
  athleteOnboarding?: PulseCheckAthleteOnboardingState | null;
  progress?: AthleteMentalProgress | null;
}): PulseCheckAthleteTaskState {
  const consentComplete = Boolean(input.athleteOnboarding?.productConsentAccepted);
  const baselineEvidence = getCompletedBaselineEvidence(input.progress);
  const membershipBaselineStatus = input.athleteOnboarding?.baselinePathStatus || 'pending';

  let baselineStatus: PulseCheckBaselineTaskStatus = membershipBaselineStatus;
  let baselineCompletionSource: PulseCheckBaselineCompletionSource = baselineEvidence.source;
  let baselineCompletedAt = baselineEvidence.completedAt;

  if (membershipBaselineStatus === 'complete') {
    baselineStatus = 'complete';
    if (!baselineCompletionSource) {
      baselineCompletionSource = 'membership-sync';
    }
  } else if (baselineEvidence.complete) {
    baselineStatus = 'complete';
  } else if (membershipBaselineStatus === 'started') {
    baselineStatus = 'started';
  } else if (membershipBaselineStatus === 'ready' || input.progress?.assessmentNeeded) {
    baselineStatus = 'ready';
  } else {
    baselineStatus = 'pending';
  }

  const baselineComplete = baselineStatus === 'complete';
  if (baselineComplete && !baselineCompletionSource) {
    baselineCompletionSource = 'membership-sync';
  }
  if (!baselineComplete) {
    baselineCompletedAt = null;
  }

  return {
    consentComplete,
    baselineStatus,
    baselineComplete,
    baselineCompletionSource,
    baselineCompletedAt,
    requiredTasksComplete: consentComplete && baselineComplete,
  };
}
