import type { CurrentSkill } from './types';
type Assignment = Record<string, any>;
const excluded = new Set(['cancelled', 'superseded', 'deferred']);
export function assignmentSkillId(row: Assignment): string | null {
  const id = row.skillId || row.protocolId || row.legacyExerciseId || row.exerciseId || row.simSpecId || row.simId;
  return typeof id === 'string' && id ? id : null;
}
/** Read the latest primary task using the athlete Today surface's freshness ordering. */
export function latestAssignedSkill(rows: Assignment[], teamId: string, from: string, today: string): CurrentSkill | null {
  const active = rows.filter(row => row.teamId === teamId && row.sourceDate >= from && row.sourceDate <= today && !excluded.has(row.status) && row.actionType !== 'defer')
    .sort((a,b) => String(b.sourceDate).localeCompare(String(a.sourceDate)) || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  if (!active.length) return null;
  const latest = active.filter(row => row.sourceDate === active[0].sourceDate);
  const row = latest.find(row => row.isPrimaryForDate !== false) || latest[0];
  const id = assignmentSkillId(row);
  const name = row.protocolLabel || row.simName || row.exerciseTitle || row.moduleTitle;
  return id && typeof name === 'string' && name.trim() ? {id, name: name.slice(0,160), phase: null, assignedDate: row.sourceDate} : null;
}
export function skillCompletion(rows: Assignment[], skillId: string) {
  const assigned = rows.filter(row => assignmentSkillId(row) === skillId && !excluded.has(row.status));
  const completed = assigned.filter(row => row.completedAt || row.status === 'completed').length;
  return {completed, expected: assigned.length, rate: assigned.length ? Math.round(completed / assigned.length * 100) : null};
}
