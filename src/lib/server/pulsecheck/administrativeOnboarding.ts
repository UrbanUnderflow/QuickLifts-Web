import {canonicalConsentDocuments,resolveAtomicConsentDocuments} from './atomicConsent';
const ROOT='pulsecheck-restricted-questionnaire-submissions/coach-communications-v1/roster-relocations';
const active=(m:any)=>m&&(m.status==null||m.status==='active')&&!m.revokedAt&&!m.removedAt&&!m.archivedAt&&!m.deletedAt&&m.revoked!==true;
const instant=(v:any)=>v?.toMillis?v.toMillis():v?.seconds!=null?v.seconds*1000+(v.nanoseconds||0)/1e6:typeof v==='number'?v:0;
const stable=(v:any)=>JSON.stringify(canonicalConsentDocuments(v));
/** Entry-routing reuse only. This never authorizes a destination health disclosure. */
export function reusableOriginalChoices(documents:any[],sources:any[]){
 if(!documents.length||documents.some(d=>!['participation','health_authorization'].includes(d.category)))return null;
 const choices=[];
 for(const document of documents){
  const candidates=[];
  for(const source of sources){const entry=source.decisions?.[document.id],event=source.event?.decisions?.[document.id];
   if(!entry&&!event)continue;
   if(!entry||!event||!entry.document||!event.document||source.event.actorUserId!==source.uid||!['accepted','declined','revoked'].includes(entry.decision)||entry.decision!==event.decision||entry.version!==document.version||event.version!==document.version||stable([entry.document])!==stable([document])||stable([event.document])!==stable([document])||entry.decision==='accepted'&&(!entry.signedName||entry.signedName!==event.signedName)||entry.expiresAt!==event.expiresAt||(entry.expiresAt&&(!Number.isFinite(Date.parse(entry.expiresAt))||Date.parse(entry.expiresAt)<=Date.now())))return null;
   if(!Number.isFinite(source.eventTime)||source.eventTime<=0)return null;
   candidates.push({decision:entry.decision,sourceReceiptPath:source.path,sourceReceiptVersion:source.version,eventTime:source.eventTime});
  }
  if(!candidates.length)return null;
  candidates.sort((a,b)=>b.eventTime-a.eventTime);const chosen=candidates[0];
  if(candidates.some(c=>c.eventTime===chosen.eventTime&&c.decision!==chosen.decision))return null;
  if(document.category==='participation'&&chosen.decision!=='accepted')return null;
  choices.push({id:document.id,version:document.version,...chosen});
 }
 return choices;
}
export async function administrativeOnboardingState(db:any,uid:string,teamId:string){
 const unavailable={skipEntry:false,baselineComplete:false,healthSharingAllowed:false,reuseType:'none',documents:[],choices:[]};
 const memberId=`${teamId}_${uid}`,member=(await db.doc('pulsecheck-team-memberships/'+memberId).get()).data();
 if(!member||member.userId!==uid||member.role!=='athlete'||!active(member))return unavailable;
 const [teamSnap,orgSnap,progressSnap,closure,profile]=await Promise.all([db.doc('pulsecheck-teams/'+teamId).get(),db.doc('pulsecheck-organizations/'+member.organizationId).get(),db.doc('athlete-mental-progress/'+uid).get(),db.doc('account-closure-jobs/'+uid).get(),db.doc('users/'+uid).get()]);
 const team=teamSnap.data(),org=orgSnap.data(),user=profile.data();if(!active(team)||!active(org)||team.organizationId!==member.organizationId||!['athleticmind','pulsecheck'].includes(org.productBrand)||closure.exists||!user||user.accountClosureRequestedAt||user.deletedAt||['closing','closed'].includes(user.accountStatus))return unavailable;
 const marker=member.rosterRelocation,id=marker?.operationId;
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(id)||marker.phase!=='destination-created'||member.athleteOnboarding?.targetPilotId||team.intake?.athlete?.questions?.some((q:any)=>q.required))return unavailable;
 const op=(await db.doc(`${ROOT}/${id}`).get()).data();
 if(op?.kind!=='athleticmind-roster-relocation-v1'||op.status!=='applied'||op.accessPolicy!=='sponsored-internal-test-v1'||!instant(op.appliedAt)||instant(marker.transitionAt)!==instant(op.appliedAt)||op.destinationTeamId!==teamId||op.destinationOrganizationId!==member.organizationId||!op.accountIds?.includes(uid)||!op.destinationMembershipIds?.includes(memberId))return unavailable;
 const documents=resolveAtomicConsentDocuments(team,{},org.productBrand,org),sources=[];
 // Local destination choices cannot be ignored, especially a more recent restriction.
 const destinationEvents=await db.doc('pulsecheck-team-memberships/'+memberId).collection('consent-events').orderBy('recordedAt','desc').limit(1).get();
 if(destinationEvents.size){const e=destinationEvents.docs[0];sources.push({uid,decisions:member.athleteOnboarding?.consentDecisions||{},event:e.data(),eventTime:e.createTime.toMillis(),path:e.ref.path,version:e.updateTime.toDate().toISOString()});}
 let completeSource=false;
 for(const sourceId of op.sourceMembershipIds||[]){if(typeof sourceId!=='string'||!sourceId.endsWith('_'+uid)||sourceId.includes('/'))continue;
  const ref=db.doc('pulsecheck-team-memberships/'+sourceId),source=(await ref.get()).data();
  if(source?.userId!==uid||source.role!=='athlete'||source.status!=='transferred'||source.transferOperationId!==id||source.organizationId!==op.sourceOrganizationId||source.destinationTeamId!==teamId||source.onboardingStatus!=='complete'||source.athleteOnboarding?.entryOnboardingStep!=='complete')return unavailable;
  const events=await ref.collection('consent-events').orderBy('recordedAt','desc').limit(1).get();if(!events.size)return unavailable;const event=events.docs[0];
  completeSource=true;sources.push({uid,decisions:source.athleteOnboarding?.consentDecisions||{},event:event.data(),eventTime:event.createTime.toMillis(),path:event.ref.path,version:event.updateTime.toDate().toISOString()});
 }
 if(!completeSource)return unavailable;
 const choices=reusableOriginalChoices(documents,sources);if(!choices)return unavailable;
 const progress=progressSnap.data()||{},baselineComplete=!!(progress.mentalSkillsBaseline||progress.baselineAssessment||progress.baselineProbe);
 return{userId:uid,skipEntry:baselineComplete,baselineComplete,healthSharingAllowed:false,reuseType:'administrative-entry-routing-only',membershipId:memberId,documents:canonicalConsentDocuments(documents),choices};
}
