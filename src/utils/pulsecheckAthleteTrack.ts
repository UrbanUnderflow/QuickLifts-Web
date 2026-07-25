import type { PulseCheckYouthTrack } from '../api/firebase/pulsecheckProvisioning/types';

export const PULSECHECK_PRO_TRACK_MIN_AGE = 18;

export type PulseCheckAthleteTrackSelection =
  | 'age-based'
  | 'team-default'
  | PulseCheckYouthTrack;

export const normalizePulseCheckAthleteAge = (value: unknown): number | null => {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(String(value ?? '').trim());

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 120) {
    return null;
  }

  return parsed;
};

export const normalizePulseCheckAthleteTrackOverride = (
  value: unknown
): PulseCheckYouthTrack | null => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'pro' || normalized === 'junior' || normalized === 'rookie') {
    return normalized;
  }
  return null;
};

export const resolvePulseCheckAthleteInviteTrack = (input: {
  athleteAge: unknown;
  selection: PulseCheckAthleteTrackSelection;
  teamYouthTrack: PulseCheckYouthTrack;
}): {
  athleteAge: number | null;
  effectiveTrack: PulseCheckYouthTrack;
  trackOverride: PulseCheckYouthTrack | null;
  source: 'age' | 'athlete-override' | 'team-default';
} => {
  const athleteAge = normalizePulseCheckAthleteAge(input.athleteAge);

  if (input.selection === 'age-based' && athleteAge !== null) {
    const trackOverride: PulseCheckYouthTrack =
      athleteAge >= PULSECHECK_PRO_TRACK_MIN_AGE ? 'pro' : 'junior';
    return {
      athleteAge,
      effectiveTrack: trackOverride,
      trackOverride,
      source: 'age',
    };
  }

  const explicitOverride = normalizePulseCheckAthleteTrackOverride(input.selection);
  if (explicitOverride) {
    return {
      athleteAge,
      effectiveTrack: explicitOverride,
      trackOverride: explicitOverride,
      source: 'athlete-override',
    };
  }

  return {
    athleteAge,
    effectiveTrack: input.teamYouthTrack,
    trackOverride: null,
    source: 'team-default',
  };
};
