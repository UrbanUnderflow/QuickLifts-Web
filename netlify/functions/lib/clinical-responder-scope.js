const text = value => typeof value === 'string' ? value.trim() : '';
const active = data => data && (!('status' in data) || data.status === 'active') && !data.revokedAt && !data.archivedAt && !data.deletedAt;
function deny(message = 'Current clinical scope could not be verified.', statusCode = 403) {
  throw Object.assign(new Error(message), { statusCode });
}
async function athleteScope(db, athleteUserId, teamId, read = ref => ref.get()) {
  if ((await read(db.collection('account-closure-jobs').doc(athleteUserId))).exists) deny('Account closure is in progress.');
  const team = await read(db.collection('pulsecheck-teams').doc(teamId));
  const teamData = team.exists ? team.data() : null;
  if (!active(teamData) || teamData.status !== 'active' || !text(teamData.organizationId)) deny();
  const org = await read(db.collection('pulsecheck-organizations').doc(teamData.organizationId));
  const organization = org.exists ? org.data() : null;
  if (!active(organization) || organization.status !== 'active' || !['pulsecheck', 'athleticmind'].includes(organization.productBrand)) deny();
  const members = await read(db.collection('pulsecheck-team-memberships').where('teamId', '==', teamId).where('userId', '==', athleteUserId));
  const member = members.docs.find(doc => active(doc.data()) && doc.data().role === 'athlete' && doc.data().organizationId === teamData.organizationId);
  if (!member) deny();
  return { team: teamData, organization, organizationId: teamData.organizationId, membership: member.data(), membershipId: member.id };
}
function responderAllowed(member, scope, athleteUserId, teamId) {
  const visibility = member?.rosterVisibilityScope ?? 'team';
  return active(member) && member.role === 'clinician' && member.teamId === teamId
    && member.organizationId === scope.organizationId && text(member.userId)
    && (visibility === 'team' || (visibility === 'assigned' && Array.isArray(member.allowedAthleteIds) && member.allowedAthleteIds.includes(athleteUserId)));
}
async function responderForRecord(db, record, uid, read = ref => ref.get()) {
  const scope = await athleteScope(db, record.athleteUserId, record.teamId, read);
  if (scope.organizationId !== record.organizationId || record.supportRoute !== 'clinician') deny();
  if (!record.pagedClinicianMembershipId) deny();
  const doc = await read(db.collection('pulsecheck-team-memberships').doc(record.pagedClinicianMembershipId));
  if (!doc.exists || doc.data().userId !== uid || !responderAllowed(doc.data(), scope, record.athleteUserId, record.teamId)) deny();
  return scope;
}
module.exports = { text, active, deny, athleteScope, responderAllowed, responderForRecord };
