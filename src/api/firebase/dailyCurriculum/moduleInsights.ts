import { aggregateFollowOnAssessment } from './followOnAssessment';
/** Pure aggregation of projected activity records. No journals, Firebase imports or writes. */
export interface InsightAssignment {
  id: string; athleteId: string; moduleId?: string; protocolVariantId?: string; protocolId?: string;
  simSpecId?: string; legacyExerciseId?: string; startedAt?: number; completedAt?: number;
}
export interface InsightEvent {
  id: string; assignmentId: string; athleteId: string; eventType: string; eventAt: number;
}
export interface InsightCompletion {
  id: string; userId: string; exerciseId: string; dailyAssignmentId?: string;
  completedAt: number; helpfulnessRating?: number;
}
export interface ModuleInsight {
  moduleId: string;
  uniqueStarters: number;
  completionOfStarters: { numerator: number; denominator: number; rate: number | null };
  completedSessions: number; uniqueCompleters: number;
  repeatUse: { additionalSessions: number; numerator: number; denominator: number; rate: number | null };
  usefulness: { average: number | null; respondentRecords: number };
  followOnAssessment: ReturnType<typeof aggregateFollowOnAssessment>;
}
export interface ModuleInsightsInput {
  assignments: InsightAssignment[]; events: InsightEvent[]; completions: InsightCompletion[];
  /** Millisecond timestamps, inclusive start and exclusive end. Both periods must have equal source coverage. */
  window: { start: number; end: number }; aliasMap?: Record<string, string>;
}
const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const ratio = (n: number, d: number) => d ? n / d : null;

export function buildModuleInsights(input: ModuleInsightsInput): ModuleInsight[] {
  const { start, end } = input.window;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error('Invalid activity window');
  const inWindow = (time: number) => validTime(time) && time >= start && time < end;
  const canonical = (id: string) => input.aliasMap?.[id] || id;
  const assignments = new Map(input.assignments.filter(a => a.id && a.athleteId).map(a => [a.id, a]));
  const moduleFor = (a: InsightAssignment) => canonical(a.moduleId || a.protocolVariantId || a.protocolId || a.simSpecId || a.legacyExerciseId || '');
  const starts = new Map<string, number>();
  const finishes = new Map<string, number>();
  for (const a of assignments.values()) {
    // The completion handler synthesizes startedAt when absent. Equal timestamps are not independent start evidence.
    if (validTime(a.startedAt) && (!validTime(a.completedAt) || a.startedAt < a.completedAt)) starts.set(a.id, a.startedAt);
    if (validTime(a.completedAt)) finishes.set(a.id, a.completedAt);
  }
  for (const e of input.events) {
    const a = assignments.get(e.assignmentId);
    if (!a || a.athleteId !== e.athleteId || !validTime(e.eventAt)) continue;
    const target = e.eventType === 'started' ? starts : e.eventType === 'completed' ? finishes : null;
    if (target) target.set(a.id, Math.min(target.get(a.id) ?? Infinity, e.eventAt));
  }
  type Session = { athlete: string; module: string; time: number; rating?: number };
  const sessions = new Map<string, Session>();
  for (const [id, time] of finishes) {
    const a = assignments.get(id)!;
    if (moduleFor(a)) sessions.set(`assignment:${id}`, { athlete: a.athleteId, module: moduleFor(a), time });
  }
  for (const c of input.completions) {
    if (!c.id || !c.userId || !c.exerciseId || !validTime(c.completedAt)) continue;
    const linked = c.dailyAssignmentId ? assignments.get(c.dailyAssignmentId) : undefined;
    // Never guess an association or attach a completion to another athlete's assignment.
    // Unlinked records can duplicate assignment completions; exclude them from every session-based aggregate.
    if (!linked || linked.athleteId !== c.userId || !moduleFor(linked)) continue;
    const key = `assignment:${linked.id}`;
    const old = sessions.get(key);
    sessions.set(key, { athlete: c.userId, module: moduleFor(linked),
      time: Math.min(old?.time ?? Infinity, c.completedAt),
      rating: old?.rating ?? (Number.isInteger(c.helpfulnessRating) && c.helpfulnessRating! >= 1 && c.helpfulnessRating! <= 5 ? c.helpfulnessRating : undefined) });
  }
  const moduleIds = new Set<string>();
  for (const a of assignments.values()) if (moduleFor(a) && inWindow(starts.get(a.id) ?? 0)) moduleIds.add(moduleFor(a));
  for (const s of sessions.values()) if (inWindow(s.time)) moduleIds.add(s.module);
  return [...moduleIds].sort().map(moduleId => {
    const starters = new Set<string>(), completedStarters = new Set<string>();
    for (const a of assignments.values()) {
      const started = starts.get(a.id);
      if (moduleFor(a) !== moduleId || !started || !inWindow(started)) continue;
      starters.add(a.athleteId);
      const completed = sessions.get(`assignment:${a.id}`)?.time;
      if (completed !== undefined && completed >= started && completed < end) completedStarters.add(a.athleteId);
    }
    const counts = new Map<string, number>();
    const ratings: number[] = [];
    let completedSessions = 0;
    for (const s of sessions.values()) {
      if (s.module !== moduleId || !inWindow(s.time)) continue;
      completedSessions++;
      counts.set(s.athlete, (counts.get(s.athlete) || 0) + 1);
      if (s.rating !== undefined) ratings.push(s.rating);
    }
    const repeaters = [...counts.values()].filter(n => n >= 2).length;
    return { moduleId, uniqueStarters: starters.size,
      completionOfStarters: { numerator: completedStarters.size, denominator: starters.size, rate: ratio(completedStarters.size, starters.size) },
      completedSessions, uniqueCompleters: counts.size,
      repeatUse: { additionalSessions: completedSessions - counts.size, numerator: repeaters, denominator: counts.size, rate: ratio(repeaters, counts.size) },
      usefulness: { average: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null, respondentRecords: ratings.length },
      followOnAssessment: aggregateFollowOnAssessment({ moduleId, window: input.window, eligibility: [], responses: [] }) };
  });
}
