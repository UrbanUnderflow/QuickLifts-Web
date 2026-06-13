// FWP Athlete Ecosystem Context Aggregator
// ----------------------------------------------------------------------------
// One best-effort pull of EVERYTHING the Pulse ecosystem knows about an athlete,
// assembled server-side (admin Firestore) for the FWP LLM workout generator.
// The coach-persona model owns the program decision, so the more real context we
// hand it, the less it has to guess.
//
// Design rule: every source is independent and best-effort. A missing source
// (no PulseCheck team, no device, no schedule) yields null/empty — it NEVER
// throws and NEVER blocks the others. An athlete with nothing here still gets a
// real workout from sport + goal + readiness alone.
//
// Sources (all keyed off the Firebase uid):
//   • pulsecheck-team-memberships   → team membership(s) + role
//   • pulsecheck-teams              → the team's sport (sportOrProgram / sportId)
//   • company-config/pulsecheck-sports → sport trainingNuance + loadModel
//   • coach-team-schedule           → next competition → weeksToNextCompetition
//   • coach-nora-vault              → what the coach trained Nora to know
//   • health-context-source-records → recent training load + recovery signal
// ----------------------------------------------------------------------------

import { db } from '../config/firebase';

const MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const SCHEDULE_COLLECTION = 'coach-team-schedule';
const VAULT_COLLECTION = 'coach-nora-vault';
const HEALTH_RECORDS_COLLECTION = 'health-context-source-records';
const SPORT_CONFIG_COLLECTION = 'company-config';
const SPORT_CONFIG_DOCUMENT = 'pulsecheck-sports';

const DAY = 24 * 60 * 60 * 1000;

const truncate = (value: unknown, max: number): string => {
  const str = String(value ?? '').trim();
  return str.length > max ? `${str.slice(0, max)}…` : str;
};

// "Men's Physique" (config) ⟷ "Men’s Physique" (user doc).
const normalizeSport = (value: string): string =>
  value.toLowerCase().replace(/[’‘]/g, "'").trim();

// ---------------------------------------------------------------------------
// Output shape — a flat, prompt-friendly context object. Everything optional.
// ---------------------------------------------------------------------------

export interface FwpAthleteContext {
  hasPulseCheck: boolean;
  team: { id: string; name?: string; sport?: string; sportId?: string } | null;
  sport: string | null;
  // Resolved Sports Intelligence taste for the sport.
  trainingNuance: Record<string, unknown> | null;
  nuanceDefaulted: boolean;
  // The sport's load model — the "track athlete tolerates more than a golfer" signal.
  loadModel: Record<string, unknown> | null;
  // Periodization signal derived from the team schedule.
  nextCompetition: { title: string; date: string; daysAway: number; weeksAway: number; opponent?: string } | null;
  upcomingEvents: Array<{ title: string; date: string; type: string; daysAway: number }>;
  // What the coach trained Nora to know (best-effort, summarized).
  coachGuidance: string[];
  // Recent training load + recovery story from connected devices / self-report.
  health: {
    recordsLast7d: number;
    recordsLast30d: number;
    domainsSeen: string[];
    latestRecovery: Record<string, unknown> | null;
    lastObservedDaysAgo: number | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Individual best-effort pulls.
// ---------------------------------------------------------------------------

async function loadMemberships(userId: string): Promise<any[]> {
  try {
    const snap = await db
      .collection(MEMBERSHIPS_COLLECTION)
      .where('userId', '==', userId)
      .get();
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[fwpAthleteContext] memberships load failed', err);
    return [];
  }
}

async function loadTeam(teamId: string): Promise<any | null> {
  try {
    const doc = await db.collection(TEAMS_COLLECTION).doc(teamId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch (err) {
    console.warn('[fwpAthleteContext] team load failed', err);
    return null;
  }
}

async function loadTeamCoachIds(teamId: string): Promise<string[]> {
  try {
    const snap = await db
      .collection(MEMBERSHIPS_COLLECTION)
      .where('teamId', '==', teamId)
      .where('role', '==', 'coach')
      .get();
    return snap.docs
      .map((d: any) => d.data()?.userId)
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
  } catch (err) {
    console.warn('[fwpAthleteContext] coach lookup failed', err);
    return [];
  }
}

// Resolve the sport entry from company-config/pulsecheck-sports. Mirrors the
// resolution in sports-intelligence-bridge.ts (exact → division → containment)
// but returns the RAW entry so we get loadModel too, not just trainingNuance.
async function loadSportEntry(sportRaw: string): Promise<{ entry: any; division: string | null } | null> {
  if (!sportRaw || !sportRaw.trim()) return null;
  try {
    const snap = await db.collection(SPORT_CONFIG_COLLECTION).doc(SPORT_CONFIG_DOCUMENT).get();
    const sports: any[] = snap.exists ? snap.data()?.sports || [] : [];
    const target = normalizeSport(sportRaw);
    for (const entry of sports) {
      if (normalizeSport(entry.name || '') === target || normalizeSport(entry.id || '') === target) {
        return { entry, division: null };
      }
    }
    for (const entry of sports) {
      const division = (entry.positions || []).find((p: string) => normalizeSport(p) === target);
      if (division) return { entry, division };
    }
    for (const entry of sports) {
      const name = normalizeSport(entry.name || '');
      if (name && (target.includes(name) || name.includes(target))) return { entry, division: null };
    }
    return null;
  } catch (err) {
    console.warn('[fwpAthleteContext] sport config load failed', err);
    return null;
  }
}

const resolveNuance = (entry: any, division: string | null): Record<string, unknown> | null => {
  const base = entry?.trainingNuance;
  if (!base) return null;
  const { divisionOverrides, ...sportLevel } = base;
  if (!division || !divisionOverrides) return sportLevel;
  const overrideKey = Object.keys(divisionOverrides).find(
    (key) => normalizeSport(key) === normalizeSport(division)
  );
  return overrideKey ? { ...sportLevel, ...divisionOverrides[overrideKey] } : sportLevel;
};

// Pull the team's schedule (via its coaches) and derive the next competition.
async function loadSchedule(coachIds: string[]): Promise<{
  nextCompetition: FwpAthleteContext['nextCompetition'];
  upcomingEvents: FwpAthleteContext['upcomingEvents'];
}> {
  const empty = { nextCompetition: null, upcomingEvents: [] as FwpAthleteContext['upcomingEvents'] };
  if (!coachIds.length) return empty;
  try {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const events: any[] = [];
    for (const coachId of coachIds) {
      const snap = await db.collection(SCHEDULE_COLLECTION).where('coachId', '==', coachId).get();
      snap.docs.forEach((d: any) => events.push(d.data()));
    }
    const future = events
      .filter((e) => typeof e?.date === 'string')
      .map((e) => {
        const when = new Date(`${e.date}T00:00:00`);
        const daysAway = Math.round((when.getTime() - todayMidnight.getTime()) / DAY);
        return { ...e, daysAway };
      })
      .filter((e) => Number.isFinite(e.daysAway) && e.daysAway >= 0)
      .sort((a, b) => a.daysAway - b.daysAway);

    const nextComp = future.find((e) => e.type === 'competition');
    return {
      nextCompetition: nextComp
        ? {
            title: nextComp.title || 'Competition',
            date: nextComp.date,
            daysAway: nextComp.daysAway,
            weeksAway: Math.round((nextComp.daysAway / 7) * 10) / 10,
            opponent: nextComp.opponent || undefined,
          }
        : null,
      upcomingEvents: future
        .slice(0, 8)
        .map((e) => ({ title: e.title || e.type, date: e.date, type: e.type || 'event', daysAway: e.daysAway })),
    };
  } catch (err) {
    console.warn('[fwpAthleteContext] schedule load failed', err);
    return empty;
  }
}

async function loadCoachGuidance(coachIds: string[]): Promise<string[]> {
  if (!coachIds.length) return [];
  const lines: string[] = [];
  for (const coachId of coachIds) {
    try {
      const snap = await db.collection(VAULT_COLLECTION).where('coachId', '==', coachId).get();
      snap.docs.forEach((d: any) => {
        const e = d.data() || {};
        const body = e.content || (e.type === 'file' || e.type === 'image' ? `(file: ${e.fileName || e.title})` : '');
        if (!body) return;
        const label = e.category ? `[${e.category}] ` : '';
        lines.push(`${label}${e.title ? `${e.title}: ` : ''}${truncate(body, 400)}`);
      });
    } catch (err) {
      console.warn('[fwpAthleteContext] vault load failed', err);
    }
  }
  return lines.slice(0, 20);
}

// Recent training load + recovery from health-context-source-records. The
// canonical snapshot/inference engine isn't running yet, so we read raw records
// live and summarize coarsely (counts + the latest recovery payload).
async function loadHealth(userId: string): Promise<FwpAthleteContext['health']> {
  try {
    const now = Date.now();
    const since30 = Math.floor((now - 30 * DAY) / 1000);
    const nowSec = Math.floor(now / 1000);
    const snap = await db
      .collection(HEALTH_RECORDS_COLLECTION)
      .where('athleteUserId', '==', userId)
      .where('observedAt', '>=', since30)
      .where('observedAt', '<=', nowSec)
      .orderBy('observedAt', 'desc')
      .limit(500)
      .get();

    if (snap.empty) return null;
    const since7 = Math.floor((now - 7 * DAY) / 1000);
    const records = snap.docs.map((d: any) => d.data());
    const domains = new Set<string>();
    let recordsLast7d = 0;
    let latestRecovery: Record<string, unknown> | null = null;
    let lastObservedAt = 0;

    for (const r of records) {
      if (typeof r?.domain === 'string') domains.add(r.domain);
      if (typeof r?.observedAt === 'number') {
        if (r.observedAt >= since7) recordsLast7d += 1;
        if (r.observedAt > lastObservedAt) lastObservedAt = r.observedAt;
      }
      if (!latestRecovery && r?.domain === 'recovery' && r?.payload && typeof r.payload === 'object') {
        // Surface a handful of common, decision-useful recovery fields if present.
        const p = r.payload as Record<string, unknown>;
        const picked: Record<string, unknown> = {};
        for (const key of ['readinessScore', 'recoveryScore', 'rmssdMs', 'hrvBaselineDeltaPct', 'restingHr', 'totalSleepMin']) {
          if (p[key] !== undefined && p[key] !== null) picked[key] = p[key];
        }
        if (Object.keys(picked).length) latestRecovery = picked;
      }
    }

    return {
      recordsLast7d,
      recordsLast30d: records.length,
      domainsSeen: Array.from(domains),
      latestRecovery,
      lastObservedDaysAgo: lastObservedAt ? Math.round((nowSec - lastObservedAt) / (60 * 60 * 24)) : null,
    };
  } catch (err) {
    // A missing composite index throws here — degrade gracefully, never block a workout.
    console.warn('[fwpAthleteContext] health load failed', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Build the athlete's full ecosystem context. `sportHint` lets the FWP client
 * pass the sport it already knows (from the shared User doc) so we still resolve
 * Sports Intelligence even when the athlete isn't on a PulseCheck team.
 */
export async function buildFwpAthleteContext(userId: string, sportHint?: string): Promise<FwpAthleteContext> {
  const memberships = await loadMemberships(userId);
  const athleteMembership =
    memberships.find((m) => m.role === 'athlete') || memberships.find((m) => !!m.teamId) || memberships[0] || null;

  let team: FwpAthleteContext['team'] = null;
  let coachIds: string[] = [];
  if (athleteMembership?.teamId) {
    const [teamDoc, ids] = await Promise.all([
      loadTeam(athleteMembership.teamId),
      loadTeamCoachIds(athleteMembership.teamId),
    ]);
    coachIds = ids;
    if (teamDoc) {
      team = {
        id: teamDoc.id,
        name: teamDoc.displayName,
        sport: teamDoc.sportOrProgram,
        sportId: teamDoc.sportId,
      };
    }
  }

  const sport = team?.sport || sportHint || null;

  const [sportMatch, schedule, coachGuidance, health] = await Promise.all([
    sport ? loadSportEntry(sport) : Promise.resolve(null),
    loadSchedule(coachIds),
    loadCoachGuidance(coachIds),
    loadHealth(userId),
  ]);

  return {
    hasPulseCheck: memberships.length > 0,
    team,
    sport,
    trainingNuance: sportMatch ? resolveNuance(sportMatch.entry, sportMatch.division) : null,
    nuanceDefaulted: !sportMatch && !!sport,
    loadModel: sportMatch?.entry?.loadModel || null,
    nextCompetition: schedule.nextCompetition,
    upcomingEvents: schedule.upcomingEvents,
    coachGuidance,
    health,
  };
}

// ---------------------------------------------------------------------------
// Prompt rendering — turn the context object into the lines the LLM reads.
// ---------------------------------------------------------------------------

export function renderAthleteContextForPrompt(ctx: FwpAthleteContext): string {
  const blocks: string[] = [];

  if (ctx.sport) {
    blocks.push(`SPORT: ${ctx.sport}${ctx.team?.name ? ` · team: ${ctx.team.name}` : ''}`);
  } else {
    blocks.push('SPORT: none declared — program for a strong, balanced, athletic physique.');
  }

  if (ctx.trainingNuance) {
    const n = ctx.trainingNuance as Record<string, any>;
    const parts: string[] = [];
    if (Array.isArray(n.muscleEmphases) && n.muscleEmphases.length) parts.push(`muscle priorities (in order): ${n.muscleEmphases.join(' > ')}`);
    if (Array.isArray(n.preferredPatterns) && n.preferredPatterns.length) parts.push(`prefer: ${n.preferredPatterns.join(', ')}`);
    if (Array.isArray(n.deprioritizedPatterns) && n.deprioritizedPatterns.length) parts.push(`deprioritize: ${n.deprioritizedPatterns.join(', ')}`);
    if (n.schemeBias) parts.push(`scheme bias: ${n.schemeBias}`);
    if (n.conditioningPosture) parts.push(`conditioning posture: ${n.conditioningPosture}`);
    if (n.coachNotes) parts.push(`coach notes: ${truncate(n.coachNotes, 600)}`);
    if (parts.length) {
      const header = ctx.nuanceDefaulted
        ? 'SPORTS INTELLIGENCE (default aesthetics-led taste — do NOT name any sport/division in copy)'
        : "SPORTS INTELLIGENCE (this sport's authoritative training taste)";
      blocks.push(`${header}:\n- ${parts.join('\n- ')}`);
    }
  }

  if (ctx.loadModel) {
    const lm = ctx.loadModel as Record<string, any>;
    const lmParts: string[] = [];
    if (lm.summary) lmParts.push(truncate(lm.summary, 400));
    if (lm.acwrCeiling) lmParts.push(`acute:chronic load ceiling ${lm.acwrCeiling}`);
    if (lm.thresholds) lmParts.push(`load thresholds ${JSON.stringify(lm.thresholds)}`);
    if (lmParts.length) {
      blocks.push(`SPORT LOAD TOLERANCE (weigh how much hard volume this athlete's sport absorbs):\n- ${lmParts.join('\n- ')}`);
    }
  }

  if (ctx.nextCompetition) {
    const c = ctx.nextCompetition;
    blocks.push(
      `COMPETITION TIMING: next competition "${c.title}"${c.opponent ? ` vs ${c.opponent}` : ''} is ${c.daysAway} day(s) / ~${c.weeksAway} week(s) away (${c.date}). ` +
        `PERIODIZE to it: the closer the meet, the more you taper/peak (cut volume, sharpen intensity, drop novelty/soreness). Do NOT prescribe a high-volume accumulation block on a peak/taper week.`
    );
  } else if (ctx.upcomingEvents.length) {
    blocks.push(
      `UPCOMING EVENTS: ${ctx.upcomingEvents.map((e) => `${e.title} (${e.type}, in ${e.daysAway}d)`).join('; ')}. Account for proximity/fatigue.`
    );
  }

  if (ctx.coachGuidance.length) {
    blocks.push(`COACH GUIDANCE (what this athlete's coach trained Nora to know — honor it):\n- ${ctx.coachGuidance.join('\n- ')}`);
  }

  if (ctx.health) {
    const h = ctx.health;
    const hp: string[] = [`${h.recordsLast7d} tracked sessions/records in last 7d, ${h.recordsLast30d} in 30d`];
    if (h.latestRecovery) hp.push(`latest recovery: ${JSON.stringify(h.latestRecovery)}`);
    if (h.lastObservedDaysAgo !== null) hp.push(`last device data ${h.lastObservedDaysAgo}d ago`);
    blocks.push(`RECENT LOAD & RECOVERY (from connected devices / self-report):\n- ${hp.join('\n- ')}`);
  }

  return blocks.join('\n\n');
}
