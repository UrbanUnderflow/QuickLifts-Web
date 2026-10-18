const { randomUUID } = require('crypto');
const COLLECTION = 'pulsecheck-invite-accepted-outbox';
const active = row => row && (!row.status || row.status === 'active') &&
  !row.revokedAt && !row.removedAt && !row.archivedAt && !row.deletedAt && row.revoked !== true;

async function processInviteAcceptedOutbox(db, id, send, now = Date.now(), resolveRecipient = async () => null) {
  const ref = db.collection(COLLECTION).doc(id);
  const lease = randomUUID();
  const job = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const row = snap.data();
    if (['sent', 'cancelled', 'needs-review'].includes(row.status) || (row.leaseUntil || 0) > now) return null;
    if (row.status === 'sending') {
      tx.set(ref, { status: 'needs-review', lastError: 'delivery-outcome-unknown' }, { merge: true });
      return null;
    }
    tx.set(ref, { status: 'pending', lease, leaseUntil: now + 120000, attempts: (row.attempts || 0) + 1 }, { merge: true });
    return row;
  });
  if (!job) return { skipped: true };
  const updateOwnedJob = patch => db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (!current.exists || current.data().lease !== lease) return false;
    tx.set(ref, patch, { merge: true });
    return true;
  });
  let sendStarted = false;
  try {
    const get = async (collection, key) => {
      if (typeof key !== 'string' || !key || key.includes('/')) return null;
      const snap = await db.collection(collection).doc(key).get();
      return snap.exists ? snap.data() : null;
    };
    const [membership, invite, team, organization] = await Promise.all([
      get('pulsecheck-team-memberships', job.membershipId), get('pulsecheck-invite-links', job.inviteToken),
      get('pulsecheck-teams', job.teamId), get('pulsecheck-organizations', job.organizationId)
    ]);
    const coach = invite?.createdByUserId ? await resolveRecipient(invite.createdByUserId) : null;
    const coaches = invite?.createdByUserId ? await db.collection('pulsecheck-team-memberships')
      .where('teamId', '==', job.teamId).where('userId', '==', invite.createdByUserId).get() : { docs: [] };
    const allowedCoach = coaches.docs.some(snap => {
      const row = snap.data();
      return active(row) && row.organizationId === job.organizationId &&
        (['coach', 'team-admin'].includes(row.role) || (row.staffCapabilities || []).includes('coaching')) &&
        row.rosterVisibilityScope !== 'none' && (row.rosterVisibilityScope !== 'assigned' || (row.allowedAthleteIds || []).includes(job.athleteUserId));
    });
    const [athleteClosure, coachClosure] = await Promise.all([get('account-closure-jobs', job.athleteUserId), get('account-closure-jobs', invite?.createdByUserId)]);
    const email = coach?.email?.trim().toLowerCase();
    if (athleteClosure || coachClosure || !active(membership) || membership.role !== 'athlete' || membership.userId !== job.athleteUserId ||
      membership.grantedByInviteToken !== job.inviteToken || membership.teamId !== job.teamId || membership.organizationId !== job.organizationId ||
      !active(team) || team.organizationId !== job.organizationId || !active(organization) ||
      !invite || !['active', 'redeemed'].includes(invite.status) || invite.revokedAt || invite.archivedAt || invite.deletedAt || invite.teamId !== job.teamId || invite.organizationId !== job.organizationId || !invite.notifyCoachOnAccept ||
      !allowedCoach || coach?.disabled || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await updateOwnedJob({ status: 'cancelled', reason: 'recipient-or-enrollment-unavailable', leaseUntil: 0 });
      return { cancelled: true };
    }
    if (!await updateOwnedJob({ status: 'sending' })) return { skipped: true };
    sendStarted = true;
    const result = await send({ id, coachEmail: email, coachName: coach.displayName || coach.preferredName || '',
      athleteName: membership.athleteOnboarding?.entryOnboardingName || membership.displayName || 'An athlete',
      teamName: team.displayName || 'Your team', organizationName: organization.displayName || '', role: 'athlete' });
    if (result?.suppressed) {
      await updateOwnedJob({ status: 'cancelled', reason: 'recipient-suppressed', leaseUntil: 0 });
      return { cancelled: true };
    }
    if (!result?.success || (result.skipped && !result.messageId)) throw Object.assign(new Error('Invite notification delivery failed.'), { retrySafe: result?.retrySafe === true });
    await updateOwnedJob({ status: 'sent', sentAt: now, leaseUntil: 0, messageId: result.messageId || null });
    return { sent: true };
  } catch (error) {
    await updateOwnedJob({ status: sendStarted && !error.retrySafe ? 'needs-review' : 'pending', leaseUntil: 0,
      lastError: sendStarted && !error.retrySafe ? 'delivery-outcome-unknown' : 'delivery-failed', lastAttemptAt: now });
    throw error;
  }
}
module.exports = { COLLECTION, processInviteAcceptedOutbox };
