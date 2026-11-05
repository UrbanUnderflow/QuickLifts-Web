// Completion evidence only: never copy answers, decisions or health-sharing scope.
const ROOT='pulsecheck-restricted-questionnaire-submissions/coach-communications-v1/roster-relocations';
const text=(v:any)=>typeof v==='string'?v:'';
const millis=(v:any):number=>v?.toMillis?v.toMillis():typeof v==='number'?v:v?.seconds!=null?v.seconds*1000:0;
export async function hasAdministrativeBaselineCarry(db:any,uid:string,membershipId:string,member:any,canonical:any){
 const marker=member?.rosterRelocation,operationId=text(marker?.operationId);
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(operationId)||marker?.phase!=='destination-created'||member.userId!==uid||membershipId!==`${member.teamId}_${uid}`||member.athleteOnboarding?.baselinePathStatus!=='complete'||!canonical||!millis(canonical.completedAt))return false;
 const op=(await db.doc(`${ROOT}/${operationId}`).get()).data();
 if(op?.kind!=='athleticmind-roster-relocation-v1'||op.status!=='applied'||op.accessPolicy!=='sponsored-internal-test-v1'||!Array.isArray(op.accountIds)||!op.accountIds.includes(uid)||!op.destinationMembershipIds?.includes(membershipId)||op.destinationTeamId!==member.teamId||op.destinationOrganizationId!==member.organizationId||!millis(op.appliedAt)||millis(marker.transitionAt)!==millis(op.appliedAt)||millis(canonical.completedAt)>millis(op.appliedAt))return false;
 const sourceIds=(op.sourceMembershipIds||[]).filter((id:any)=>typeof id==='string'&&id.endsWith('_'+uid));
 if(!sourceIds.length)return false;
 for(const id of sourceIds){
  if(id.includes('/'))return false;
  const source=(await db.doc('pulsecheck-team-memberships/'+id).get()).data();
  if(source?.userId!==uid||source.role!=='athlete'||source.status!=='transferred'||source.organizationId!==op.sourceOrganizationId||source.transferOperationId!==operationId||source.destinationTeamId!==member.teamId||source.athleteOnboarding?.baselinePathStatus!=='complete')return false;
 }
 return true;
}

export async function hasAccountAdministrativeBaselineCarry(db:any,uid:string,canonical:any){
 if(!canonical)return false;
 const snapshot=await db.collection('pulsecheck-team-memberships').where('userId','==',uid).get();
 for(const doc of snapshot.docs){const m=doc.data();if(m.userId!==uid||m.role!=='athlete'||m.status!=='active'||m.revokedAt||m.removedAt||m.deletedAt||m.archivedAt||m.revoked===true)continue;if(await hasAdministrativeBaselineCarry(db,uid,doc.id,m,canonical))return true;}
 return false;
}
