import { schedule } from '@netlify/functions';

// FitClub nightly recap — for every club whose host opted into the
// daily rhythm, count how many members showed up today and, when that
// number is > 0, write a recap doc the club home reads AND push
// "14 of 19 showed up today" to members.
//
// Safety: a recap NEVER fires for a club with zero activity, so quiet
// clubs never get a sad "0 of N" — exactly the host's concern. The
// whole send is also gated by FITCLUB_RHYTHM_LIVE (default dry-run) so
// a fresh deploy observes before it delivers.
//
// Activity source: `clubs/{clubId}/dailyActivity/{yyyy-MM-dd}` with an
// `activeMemberIds` array, written by the iOS workout-completion hook
// (ClubEventEngagementService.recordClubActivity).

import { narrateRecap } from './lib/clubRecapNarrator';

const {
  getRecapEnabledClubs,
  getClubMemberUserIds,
  resolveTokens,
  sendPushes,
  rhythmIsLive,
  dayBoundsForTimezone,
  db,
} = require('./lib/clubRhythm');

function dateKeyForTimezone(timezoneId: string): string {
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone: timezoneId || 'America/New_York' }));
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const d = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The calendar day before an ISO yyyy-MM-dd key (noon-UTC anchored to dodge DST). */
function previousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function weekdayForTimezone(dateKey: string, timezoneId: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezoneId || 'America/New_York' }).format(dt);
}

/**
 * How many consecutive calendar days (counting today) the club has had
 * activity, reading prior recap docs. Today counts as 1 because we only
 * reach this code when today's `showed > 0`.
 */
async function activeStreakDays(clubId: string, todayKey: string): Promise<number> {
  const snap = await db
    .collection('clubs').doc(clubId)
    .collection('recaps')
    .orderBy('dateKey', 'desc')
    .limit(14)
    .get();
  const showedByKey = new Map<string, number>();
  snap.docs.forEach((doc: any) => {
    const data = doc.data() || {};
    showedByKey.set(doc.id, Number(data.showedUp) || 0);
  });

  let streak = 1; // today
  let cursor = previousDateKey(todayKey);
  // Walk backwards while each prior day has a recap with activity.
  for (let i = 0; i < 14; i += 1) {
    const showed = showedByKey.get(cursor);
    if (typeof showed === 'number' && showed > 0) {
      streak += 1;
      cursor = previousDateKey(cursor);
    } else {
      break;
    }
  }
  return streak;
}

const nightlyRecap = async () => {
  const dryRun = !rhythmIsLive();
  const clubs = await getRecapEnabledClubs();
  const summary: any[] = [];

  for (const club of clubs) {
    try {
      const tz = club.timezoneIdentifier || 'America/New_York';
      const dateKey = dateKeyForTimezone(tz);

      const activityDoc = await db
        .collection('clubs').doc(club.id)
        .collection('dailyActivity').doc(dateKey)
        .get();

      const activeIds: string[] = activityDoc.exists
        ? (activityDoc.data()?.activeMemberIds || [])
        : [];
      const showed = new Set(activeIds).size;

      // The core safety rule: no activity → no recap.
      if (showed === 0) {
        summary.push({ club: club.id, skipped: 'no-activity' });
        continue;
      }

      const memberIds = await getClubMemberUserIds(club.id);
      const total = Math.max(memberIds.length, showed);

      // Context for Nora: yesterday's number (trend) + the active-day streak.
      const yesterdayDoc = await db
        .collection('clubs').doc(club.id)
        .collection('recaps').doc(previousDateKey(dateKey))
        .get();
      const yesterdayShowedUp = yesterdayDoc.exists
        ? (Number(yesterdayDoc.data()?.showedUp) || 0)
        : null;
      const streak = await activeStreakDays(club.id, dateKey);

      // Nora writes the line (falls back to the deterministic template).
      const narration = await narrateRecap({
        clubName: club.name || 'Your club',
        showedUp: showed,
        totalMembers: total,
        weekday: weekdayForTimezone(dateKey, tz),
        yesterdayShowedUp,
        activeStreakDays: streak,
      });

      // Persist the recap artifact the club home renders — now with Nora's copy.
      await db
        .collection('clubs').doc(club.id)
        .collection('recaps').doc(dateKey)
        .set({
          clubId: club.id,
          dateKey,
          showedUp: showed,
          totalMembers: total,
          recapText: narration.body,
          authoredBy: narration.authoredBy,
          streakDays: streak,
          createdAt: Date.now() / 1000,
        }, { merge: true });

      // Push to members — Nora's line is the body.
      const targets = await resolveTokens(memberIds);
      const title = `📊 ${club.name || 'Your club'}`;
      const result = await sendPushes(targets, {
        title,
        body: narration.body,
        data: { type: 'clubDailyRecap', clubId: club.id, dateKey },
        dryRun,
      });

      summary.push({ club: club.id, showed, total, authoredBy: narration.authoredBy, streak, ...result });
    } catch (err: any) {
      console.error(`[nightly-recap] club ${club.id} failed: ${err?.message || err}`);
      summary.push({ club: club.id, error: err?.message || String(err) });
    }
  }

  console.log('[nightly-recap]', JSON.stringify({ dryRun, clubs: clubs.length, summary }));
  return { statusCode: 200, body: JSON.stringify({ ok: true, dryRun, summary }) };
};

// 02:00 UTC ≈ late evening across the Americas. Per-club local-time
// scheduling is a future refinement (one cron, club-tz gating).
export const handler = schedule('0 2 * * *', nightlyRecap);
