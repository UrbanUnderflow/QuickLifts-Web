import { PULSECHECK_SCORING_VERSION } from './pulsecheckScoringV2';

export type PulseCheckTeamScoreResultRead = {
  score: number | null;
  status: string;
};

export type PulseCheckTeamScorecardRead = {
  methodologyVersion: string;
  coherence: PulseCheckTeamScoreResultRead;
  wellbeing: PulseCheckTeamScoreResultRead;
  recovery: PulseCheckTeamScoreResultRead;
  adherence: PulseCheckTeamScoreResultRead;
};

export type PulseCheckTeamScorecardSnapshot = {
  methodologyVersion: string;
  athleteCount: number;
  loadedAthleteCount: number;
  scoredAthleteCount: number;
  buildingAthleteCount: number;
  unavailableAthleteCount: number;
  coherencePercent: number | null;
  wellbeingPercent: number | null;
  recoveryPercent: number | null;
  showingUpPercent: number | null;
};

const availableScore = (result: PulseCheckTeamScoreResultRead): number | null =>
  result.status === 'available' && result.score !== null && Number.isFinite(result.score)
    ? Math.max(0, Math.min(100, Math.round(result.score)))
    : null;

const averageAvailable = (values: Array<number | null>): number | null => {
  const available = values.filter((value): value is number => value !== null);
  return available.length > 0
    ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length)
    : null;
};

export const calculatePulseCheckTeamScorecardSnapshot = (
  scorecards: PulseCheckTeamScorecardRead[],
  athleteCount: number,
): PulseCheckTeamScorecardSnapshot => {
  const totalAthletes = Math.max(0, Math.round(athleteCount));
  const canonical = scorecards.filter(
    (scorecard) => scorecard.methodologyVersion === PULSECHECK_SCORING_VERSION,
  );
  const coherenceScores = canonical.map((scorecard) => availableScore(scorecard.coherence));
  const scoredAthleteCount = coherenceScores.filter((score): score is number => score !== null).length;
  const buildingAthleteCount = canonical.filter(
    (scorecard) => scorecard.coherence.status === 'building',
  ).length;

  return {
    methodologyVersion: PULSECHECK_SCORING_VERSION,
    athleteCount: totalAthletes,
    loadedAthleteCount: canonical.length,
    scoredAthleteCount,
    buildingAthleteCount,
    unavailableAthleteCount: Math.max(0, totalAthletes - scoredAthleteCount - buildingAthleteCount),
    coherencePercent: averageAvailable(coherenceScores),
    wellbeingPercent: averageAvailable(canonical.map((scorecard) => availableScore(scorecard.wellbeing))),
    recoveryPercent: averageAvailable(canonical.map((scorecard) => availableScore(scorecard.recovery))),
    showingUpPercent: averageAvailable(canonical.map((scorecard) => availableScore(scorecard.adherence))),
  };
};
