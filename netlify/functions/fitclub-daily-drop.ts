import { schedule } from '@netlify/functions';

// FitClub daily drop — the morning "today's workout just dropped" nudge
// that turns a club's daily programming into an event with a start
// time instead of an ambient to-do.
//
// Fires only for clubs that (a) opted into the rhythm and (b) have
// active programming (≥1 linked challenge) — so a club with nothing
// scheduled never sends an empty drop. Gated by FITCLUB_RHYTHM_LIVE
// (default dry-run).

const {
  getRecapEnabledClubs,
  getClubMemberUserIds,
  resolveTokens,
  sendPushes,
  rhythmIsLive,
} = require('./lib/clubRhythm');

const dailyDrop = async () => {
  const dryRun = !rhythmIsLive();
  const clubs = await getRecapEnabledClubs();
  const summary: any[] = [];

  for (const club of clubs) {
    try {
      const linked: string[] = club.linkedRoundIds || [];
      // Proxy for "has programming today". A richer version would
      // resolve the active challenge's movelist for the local date and
      // name today's workout in the push body.
      if (linked.length === 0) {
        summary.push({ club: club.id, skipped: 'no-programming' });
        continue;
      }

      const memberIds = await getClubMemberUserIds(club.id);
      const targets = await resolveTokens(memberIds);
      const title = `🔓 ${club.name || 'Your club'}`;
      const body = `Today's workout just dropped. Get it in — your crew is watching.`;
      const result = await sendPushes(targets, {
        title,
        body,
        data: { type: 'clubDailyDrop', clubId: club.id },
        dryRun,
      });

      summary.push({ club: club.id, members: memberIds.length, ...result });
    } catch (err: any) {
      console.error(`[daily-drop] club ${club.id} failed: ${err?.message || err}`);
      summary.push({ club: club.id, error: err?.message || String(err) });
    }
  }

  console.log('[daily-drop]', JSON.stringify({ dryRun, clubs: clubs.length, summary }));
  return { statusCode: 200, body: JSON.stringify({ ok: true, dryRun, summary }) };
};

// 13:00 UTC ≈ morning across the Americas. Per-club local-time
// scheduling is a future refinement.
export const handler = schedule('0 13 * * *', dailyDrop);
