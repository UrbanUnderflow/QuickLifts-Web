export type PulseCheckScorePresentationInput = {
  score: number | null;
  status: string;
};

export const pulseCheckScoreDisplayLabel = (
  result: PulseCheckScorePresentationInput,
): string => {
  if (result.score !== null && Number.isFinite(result.score)) {
    return String(Math.round(result.score));
  }

  switch (result.status) {
    case 'building':
      return 'Building';
    case 'recalibrating':
      return 'Recalibrating';
    default:
      return 'Unavailable';
  }
};

export const pulseCheckTeamScoreDisplayLabel = (input: {
  score: number | null;
  buildingAthleteCount: number;
  loading?: boolean;
}): string => {
  if (input.loading) return '...';
  if (input.score !== null && Number.isFinite(input.score)) {
    return String(Math.round(input.score));
  }
  return input.buildingAthleteCount > 0 ? 'Building' : 'Unavailable';
};
