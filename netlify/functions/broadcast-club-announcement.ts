import type { Handler } from '@netlify/functions';

// Host megaphone — reliable server-side fan-out of a club announcement.
// The iOS client posts the announcement doc (members see it live), then
// calls this endpoint to deliver the push to every member, replacing
// the client's best-effort, foreground-only loop.
//
// POST { clubId, clubName, fromUserId, fromUsername, text }
// Auth: the caller must be the club creator (verified against the club
// doc) — a member can't broadcast.

const {
  getClubMemberUserIds,
  resolveTokens,
  sendPushes,
  db,
} = require('./lib/clubRhythm');

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let payload: any;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { clubId, clubName, fromUserId, fromUsername, text } = payload;
  if (!clubId || !fromUserId || !text || !String(text).trim()) {
    return { statusCode: 400, body: 'Missing clubId, fromUserId, or text' };
  }

  try {
    // Authorize: only the club creator may broadcast.
    const clubSnap = await db.collection('clubs').doc(clubId).get();
    if (!clubSnap.exists) {
      return { statusCode: 404, body: 'Club not found' };
    }
    const club = clubSnap.data();
    if (club?.creatorId !== fromUserId) {
      return { statusCode: 403, body: 'Only the club host can broadcast' };
    }

    const memberIds = (await getClubMemberUserIds(clubId)).filter((id: string) => id !== fromUserId);
    const targets = await resolveTokens(memberIds);

    const trimmed = String(text).length > 140 ? `${String(text).slice(0, 137)}…` : String(text);
    const title = `📣 ${clubName || club?.name || 'Your club'}`;
    const body = `${fromUsername || 'Your host'}: ${trimmed}`;

    // This endpoint is the deliberate, host-triggered broadcast — send
    // for real (not dry-run gated like the scheduled rhythm).
    const result = await sendPushes(targets, {
      title,
      body,
      data: { type: 'clubAnnouncement', clubId, fromUsername: fromUsername || '' },
      dryRun: false,
    });

    console.log('[broadcast-announcement]', JSON.stringify({ clubId, recipients: targets.length, ...result }));
    return { statusCode: 200, body: JSON.stringify({ ok: true, recipients: targets.length, ...result }) };
  } catch (err: any) {
    console.error(`[broadcast-announcement] failed: ${err?.message || err}`);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err?.message || String(err) }) };
  }
};

export { handler };
