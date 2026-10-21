// Server operations must resolve the current parent state, never a cached membership grant.
const active = row => row && row.status === 'active' && !row.deletedAt && !row.archivedAt && !row.revokedAt;
async function organizationTeamIsActive(db, teamId, organizationId, reader = { get: ref => ref.get() }) {
  if (typeof teamId !== 'string' || !teamId || teamId.includes('/')) return false;
  const teamSnapshot = await reader.get(db.collection('pulsecheck-teams').doc(teamId));
  const team = teamSnapshot.exists ? teamSnapshot.data() : null;
  if (!active(team) || typeof team.organizationId !== 'string' || !team.organizationId || team.organizationId.includes('/') || (organizationId && organizationId !== team.organizationId)) return false;
  const organizationSnapshot = await reader.get(db.collection('pulsecheck-organizations').doc(team.organizationId));
  return organizationSnapshot.exists && active(organizationSnapshot.data());
}
module.exports = { organizationTeamIsActive };
