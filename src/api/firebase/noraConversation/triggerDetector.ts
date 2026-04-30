// =============================================================================
// Phase D · Trigger Detector — admin-SDK only.
//
// Per athlete, evaluate whether any of the 4 triggers should fire RIGHT NOW.
// Returns an array of fire candidates the orchestrator can act on.
//
// Trigger doctrine:
//   - coach-context-flag — coach set a flag on the athlete (e.g. competition
//     weekend) within the last 36 hours that hasn't been consumed yet.
//   - hcsr-delta-detected — latest snapshot circadianDisruption.disruptionBand
//     stepped to travel_signature/jetlag_significant, OR autonomic-load
//     minutes >= threshold, OR sleep efficiency dropped >15% vs 7d baseline.
//   - calendar-sport-event — athlete has a competition/game day scheduled
//     within CALENDAR_EVENT_WINDOW_HOURS.
//   - behavioral-drift — no completion events or chat replies in the last
//     BEHAVIORAL_DRIFT_DAYS.
//
// Detector is PURE w.r.t. side-effects: it reads Firestore but writes
// nothing.  The orchestrator's `openConversationFromTrigger` does the
// dedupe + write via `pulsecheck-nora-trigger-fires`.
// =============================================================================

import * as admin from 'firebase-admin';
import {
  BEHAVIORAL_DRIFT_DAYS,
  CALENDAR_EVENT_WINDOW_HOURS,
  HCSR_DELTA_THRESHOLDS,
  TriggerEvidence,
} from './types';
import type { ConversationTrigger, TranslationDomain } from '../adaptiveFramingLayer/types';

export interface TriggerCandidate {
  trigger: ConversationTrigger;
  /** Phase C domain to use for the action delivery once reply lands. */
  actionDomain: TranslationDomain;
  evidence: TriggerEvidence;
}

export interface DetectTriggersInput {
  athleteUserId: string;
  /** athlete-local YYYY-MM-DD; used by callers to dedupe. */
  dayKey: string;
}

export const detectTriggers = async (
  input: DetectTriggersInput,
  db: admin.firestore.Firestore = admin.firestore(),
): Promise<TriggerCandidate[]> => {
  const candidates: TriggerCandidate[] = [];
  const [coach, hcsr, calendar, behavioral] = await Promise.all([
    detectCoachContext(input, db).catch(() => null),
    detectHcsrDelta(input, db).catch(() => null),
    detectCalendarEvent(input, db).catch(() => null),
    detectBehavioralDrift(input, db).catch(() => null),
  ]);
  for (const c of [coach, hcsr, calendar, behavioral]) {
    if (c) candidates.push(c);
  }
  return candidates;
};

// ──────────────────────────────────────────────────────────────────────────────
// Detectors
// ──────────────────────────────────────────────────────────────────────────────

const detectCoachContext = async (
  input: DetectTriggersInput,
  db: admin.firestore.Firestore,
): Promise<TriggerCandidate | null> => {
  const cutoff = Date.now() - 36 * 60 * 60 * 1000;
  // Coach-set flags: collection 'pulsecheck-coach-context-flags' (additive,
  // future Phase F surface lets coaches set these). For now we just look
  // for any unconsumed flag.
  const snap = await db
    .collection('pulsecheck-coach-context-flags')
    .where('athleteUserId', '==', input.athleteUserId)
    .where('consumed', '==', false)
    .where('flaggedAt', '>=', cutoff)
    .orderBy('flaggedAt', 'desc')
    .limit(1)
    .get()
    .catch(() => null);
  if (!snap || snap.empty) return null;
  const doc = snap.docs[0];
  const flag = doc.data();
  return {
    trigger: 'coach-context-flag',
    actionDomain: (flag.suggestedDomain as TranslationDomain) || 'load',
    evidence: {
      summary: `Coach flagged: ${(flag.summary as string) || flag.kind || doc.id}.`,
      coachContextFlagId: doc.id,
    },
  };
};

const detectHcsrDelta = async (
  input: DetectTriggersInput,
  db: admin.firestore.Firestore,
): Promise<TriggerCandidate | null> => {
  // Read the latest snapshot for the athlete.
  const snap = await db
    .collection('health-context-snapshots')
    .where('athleteUserId', '==', input.athleteUserId)
    .where('snapshotType', '==', 'daily')
    .orderBy('snapshotDateKey', 'desc')
    .limit(1)
    .get()
    .catch(() => null);
  if (!snap || snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data();
  const recovery = (data.domains?.recovery?.data || {}) as Record<string, unknown>;
  const inferences = (data.domains?.inferences?.data || {}) as Record<string, unknown>;

  // 1. Circadian band fire.
  const circadianBand = (inferences.circadianDisruption as { disruptionBand?: string } | undefined)?.disruptionBand;
  if (circadianBand && (HCSR_DELTA_THRESHOLDS.circadianBands as readonly string[]).includes(circadianBand)) {
    return {
      trigger: 'hcsr-delta-detected',
      actionDomain: 'circadian',
      evidence: {
        summary: `Circadian disruption band stepped to ${circadianBand}.`,
        snapshotId: doc.id,
      },
    };
  }

  // 2. Autonomic load fire.
  const autonomicLoad = recovery.daytimeAutonomicLoadMinutes as number | undefined;
  if (typeof autonomicLoad === 'number' && autonomicLoad >= HCSR_DELTA_THRESHOLDS.autonomicLoadMinutes) {
    return {
      trigger: 'hcsr-delta-detected',
      actionDomain: 'autonomic',
      evidence: {
        summary: `Daytime autonomic load minutes hit ${Math.round(autonomicLoad)}.`,
        snapshotId: doc.id,
      },
    };
  }

  // 3. Sleep efficiency drop fire (vs 7d baseline if available).
  const sleepEfficiency = recovery.sleepEfficiency as number | undefined;
  const sleepEfficiency7dBaseline = recovery.sleepEfficiency7dBaseline as number | undefined;
  if (
    typeof sleepEfficiency === 'number' &&
    typeof sleepEfficiency7dBaseline === 'number' &&
    sleepEfficiency7dBaseline > 0
  ) {
    const dropPct = (sleepEfficiency7dBaseline - sleepEfficiency) / sleepEfficiency7dBaseline;
    if (dropPct >= HCSR_DELTA_THRESHOLDS.sleepEfficiencyDropPct) {
      return {
        trigger: 'hcsr-delta-detected',
        actionDomain: 'sleep',
        evidence: {
          summary: `Sleep efficiency dropped ${Math.round(dropPct * 100)}% vs 7-day baseline.`,
          snapshotId: doc.id,
        },
      };
    }
  }

  return null;
};

const detectCalendarEvent = async (
  input: DetectTriggersInput,
  db: admin.firestore.Firestore,
): Promise<TriggerCandidate | null> => {
  const horizon = Date.now() + CALENDAR_EVENT_WINDOW_HOURS * 60 * 60 * 1000;
  const now = Date.now();
  const snap = await db
    .collection('pulsecheck-athlete-calendar-events')
    .where('athleteUserId', '==', input.athleteUserId)
    .where('eventStartAt', '>=', now)
    .where('eventStartAt', '<=', horizon)
    .where('eventType', 'in', ['competition', 'game', 'tournament'])
    .orderBy('eventStartAt', 'asc')
    .limit(1)
    .get()
    .catch(() => null);
  if (!snap || snap.empty) return null;
  const doc = snap.docs[0];
  const evt = doc.data();
  return {
    trigger: 'calendar-sport-event',
    actionDomain: 'load',
    evidence: {
      summary: `Athlete has ${evt.eventType} on ${new Date(evt.eventStartAt).toISOString().slice(0, 10)}.`,
      calendarEventId: doc.id,
    },
  };
};

const detectBehavioralDrift = async (
  input: DetectTriggersInput,
  db: admin.firestore.Firestore,
): Promise<TriggerCandidate | null> => {
  const cutoff = Date.now() - BEHAVIORAL_DRIFT_DAYS * 24 * 60 * 60 * 1000;
  const cutoffSec = cutoff / 1000;
  // Most-recent assignment-event for athlete.
  const snap = await db
    .collection('pulsecheck-assignment-events')
    .where('athleteId', '==', input.athleteUserId)
    .orderBy('eventAt', 'desc')
    .limit(1)
    .get()
    .catch(() => null);
  if (!snap) return null;
  if (snap.empty) {
    // No engagement at all → fire.
    return {
      trigger: 'behavioral-drift',
      actionDomain: 'load',
      evidence: {
        summary: `No engagement on record.`,
        daysSinceEngagement: BEHAVIORAL_DRIFT_DAYS,
      },
    };
  }
  const lastDoc = snap.docs[0];
  const lastAt = lastDoc.data().eventAt as number | undefined;
  if (!lastAt) return null;
  const lastAtSec = lastAt > 1e12 ? lastAt / 1000 : lastAt;
  if (lastAtSec >= cutoffSec) return null;
  const daysSince = Math.floor((Date.now() / 1000 - lastAtSec) / (24 * 60 * 60));
  return {
    trigger: 'behavioral-drift',
    actionDomain: 'load',
    evidence: {
      summary: `${daysSince} days since last engagement.`,
      lastEngagementAt: lastAtSec * 1000,
      daysSinceEngagement: daysSince,
    },
  };
};
