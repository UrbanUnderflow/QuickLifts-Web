import type { ParticipationAthlete } from './types';

/** Balance check-ins and assigned training equally; syncing is not participation. */
export function participationAdherence(athlete: ParticipationAthlete): number | null {
  const days = athlete.dailyParticipation?.filter(day => day.scheduled) ?? [];
  const periods = ['morningCompleted', 'recoveryCompleted', 'eveningCompleted'] as const;
  const hasPeriods = days.length > 0 && days.every(day => periods.every(field => typeof day[field] === 'boolean'));
  const checkIns = hasPeriods
    ? days.reduce((sum, day) => sum + periods.filter(field => day[field]).length, 0) / (days.length * 3) * 100
    : athlete.checkIns.rate;
  const rates = [checkIns, athlete.skillTraining.rate].filter((rate): rate is number => rate !== null && Number.isFinite(rate));
  return rates.length ? Math.round(rates.reduce((sum, rate) => sum + Math.min(100, Math.max(0, rate)), 0) / rates.length) : null;
}

export function rankParticipation(athletes: ParticipationAthlete[]) {
  return athletes.map(athlete => ({ athlete, adherence: participationAdherence(athlete) }))
    .sort((a, b) => (b.adherence ?? -1) - (a.adherence ?? -1) || a.athlete.displayName.localeCompare(b.athlete.displayName))
    .map((row, index, rows) => ({ ...row, rank: row.adherence === null ? null : rows.findIndex(other => other.adherence === row.adherence) + 1 }));
}
