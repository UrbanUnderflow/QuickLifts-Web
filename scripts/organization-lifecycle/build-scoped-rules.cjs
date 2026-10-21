// Build a narrow patch over a downloaded production ruleset; never replace it with repository rules.
const fs=require('node:fs');
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node build-scoped-rules.cjs input.rules output.rules');
let source=fs.readFileSync(input,'utf8');const local=fs.readFileSync('firestore.rules','utf8');
function block(text,marker){const start=text.indexOf(marker);if(start<0)throw Error('Missing '+marker);const open=text.indexOf('{',start+marker.length);let depth=1,end=open+1;while(depth&&end<text.length){if(text[end]==='{')depth++;if(text[end]==='}')depth--;end++;}return text.slice(start,end);}
const functions=['pcTeamPath(teamId)','pcOrganizationPath(organizationId)','pcOrganizationNotDecommissioned(organizationId)','pcLifecycleScopeOpen(data)','pcMembershipDataIsActive(data)','pcTeamIsActive(teamId)','pcTeamOrganizationIsActive(teamId)','pcDataMatchesTeamOrganization(data, teamId)','pcHasActiveTeamMembership(teamId)','pcTeamScopedDataIsActive(data)'];
for(const name of functions){if(source.includes('function '+name))throw Error('Unexpected existing helper '+name);}
const helperBlocks=functions.map(n=>block(local,'function '+n)).join('\n    ');
source=source.replace('    function pcMembershipPath(teamId)',helperBlocks+'\n    function pcMembershipPath(teamId)');
const manage=block(source,'function pcCanManageTeam(teamId)');
source=source.replace(manage,manage.replace('return isSignedIn()', 'return isSignedIn() && pcHasActiveTeamMembership(teamId)'));
const names=['pulsecheck-organizations','pulsecheck-teams','pulsecheck-pilots','pulsecheck-pilot-cohorts','pulsecheck-organization-memberships'];
const exclusions=names.map(n=>"'"+n+"'").join(',');
source=source.replace(/(function isExplicitlyRuledCollection\(collectionName\) \{[\s\S]*?return )collectionName/,`$1collectionName in [${exclusions}] || collectionName`);
for(const name of names){const id={'pulsecheck-organizations':'organizationId','pulsecheck-teams':'teamId','pulsecheck-pilots':'pilotId','pulsecheck-pilot-cohorts':'cohortId','pulsecheck-organization-memberships':'membershipId'}[name];const marker=`match /${name}/{${id}}`;if(source.includes(marker))throw Error('Unexpected existing rule '+name);let rule=block(local,marker);
// Keep production's preactivation reads for consent/onboarding. Only lifecycle closure changes here.
if(name==='pulsecheck-organizations')rule=rule.replace(/allow read:[\s\S]*?;\n/,"allow read: if isAdminUser() || (isSignedIn() && resource.data.get('lifecycleState', null) == null && resource.data.get('deletedAt', null) == null);\n");
if(name==='pulsecheck-teams')rule=rule.replace('isAdminUser() || pcHasActiveTeamMembership(teamId);', 'isAdminUser() || (isSignedIn() && pcOrganizationNotDecommissioned(resource.data.organizationId));');
source=source.slice(0,source.lastIndexOf('  }'))+'    '+rule+'\n'+source.slice(source.lastIndexOf('  }'));}
// Known invite tokens must stop opening for decommissioned organizations.
const invite=block(source,'match /pulsecheck-invite-links/{inviteId}');
source=source.replace(invite,invite.replace('allow read: if isSignedIn();','allow read: if isAdminUser() || (isSignedIn() && pcLifecycleScopeOpen(resource.data));').replace('|| pcIsInviteRedemptionUpdate();','|| (pcIsInviteRedemptionUpdate() && pcLifecycleScopeOpen(resource.data));'));
source=source.replace(block(source,'match /pulsecheck-invite-activities/{activityId}'),block(local,'match /pulsecheck-invite-activities/{activityId}'));
for(const name of ['coach-team-schedule','coach-nora-vault']) {
 const marker=`match /${name}/{${name==='coach-team-schedule'?'eventId':'documentId'}}`;
 // These legacy workspaces can hold records scoped to an organization.
 const match=source.match(new RegExp('match /'+name+'/\\{[^}]+\\}'));
 if(!match)throw Error('Missing workspace rule '+name);
 const original=block(source,match[0]);
 source=source.replace(original,original.replace('allow read: if isSignedIn();','allow read: if isSignedIn() && pcLifecycleScopeOpen(resource.data);').replace('allow create: if isSignedIn()','allow create: if isSignedIn() && pcLifecycleScopeOpen(request.resource.data)').replace('allow update, delete: if isSignedIn()','allow update, delete: if isSignedIn() && pcLifecycleScopeOpen(resource.data)'));
}
// Preserve existing fallback semantics and add lifecycle checks to scoped data only.
source=source.replace('&& !isExplicitlyRuledCollection(collectionName);','&& !isExplicitlyRuledCollection(collectionName)\n        && (resource == null || pcLifecycleScopeOpen(resource.data));');
source=source.replace('&& pcLegacyAssignmentWriteAllowed(collectionName);','&& pcLifecycleScopeOpen(request.resource.data)\n        && (resource == null || pcLifecycleScopeOpen(resource.data))\n        && pcLegacyAssignmentWriteAllowed(collectionName);');
source=source.replace("&& (!(collectionName in ['pulsecheck-daily-assignments'", "&& pcLifecycleScopeOpen(resource.data)\n        && (!(collectionName in ['pulsecheck-daily-assignments'");
fs.writeFileSync(output,source);console.log('Wrote scoped lifecycle rules');
