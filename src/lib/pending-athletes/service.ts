import type { firestore } from 'firebase-admin';
import { activeRecord, DashboardAccessError, loadTeamAccess, validTeamId } from '../coach-dashboard/access';
import { assertCommunicationAccountOpen, digest, rootFor, transactionReads } from '../coach-communications/service';
import { tokenDigest } from '../coachSurveys/service';
import { pendingClaimsEnabled } from '../server/auth/pending-claims-gate';

export function assertPendingClaimsEnabled() {
  if (!pendingClaimsEnabled()) throw new DashboardAccessError(503,'Athlete sign-in claims are not open yet. Your roster entry stays prepared.');
}

const records = (db: firestore.Firestore) => rootFor(db).collection('pending-athletes');
const phoneIndex = (db: firestore.Firestore, hash: string) => rootFor(db).collection('pending-phone-index').doc(hash);
const fullRoster = (m: any) => m.rosterVisibilityScope == null || m.rosterVisibilityScope === 'team';
// Match the existing team-workspace invite policy; capabilities do not bypass it.
export function canStagePendingAthlete(m: any, team: any) {
  if (!activeRecord(m) || !fullRoster(m)) return false;
  if (m.role === 'team-admin') return true;
  return ['admin-and-staff','admin-staff-and-coaches'].includes(team.defaultInvitePolicy) &&
    (['performance-staff','support-staff'].includes(m.role) || m.role === 'coach' && team.defaultInvitePolicy === 'admin-staff-and-coaches');
}
async function staffScope(db: firestore.Firestore, uid: string, teamId: string, write = false) {
  await assertCommunicationAccountOpen(db, uid);
  const result = await loadTeamAccess(db,uid,teamId);
  if (!activeRecord(result.membership) || result.membership.userId !== uid ||
    !['team-admin','coach','performance-staff','support-staff'].includes(result.membership.role) ||
    write && !canStagePendingAthlete(result.membership,result.team)) throw new DashboardAccessError(403,'Your team role does not permit managing pending athletes.');
  return result;
}
const allowedFields = new Set(['sourceReference','displayName','phoneNumber','role','rosterVerified','identityReview','expectedUserId','accountMatch']);
export function validatePendingAthlete(input: any) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k=>!allowedFields.has(k)) ||
    !validTeamId(input.sourceReference) || typeof input.displayName !== 'string' || !input.displayName.trim() || input.displayName.trim().length>100 ||
    /[\x00-\x1f<>]/.test(input.displayName) || typeof input.phoneNumber !== 'string' || !/^\+[1-9]\d{9,14}$/.test(input.phoneNumber) ||
    input.role!=='athlete' || input.rosterVerified!==true || !['review-required','reviewed'].includes(input.identityReview) ||
    !['none-found','existing','ambiguous'].includes(input.accountMatch) ||
    input.expectedUserId != null && !validTeamId(input.expectedUserId) || input.accountMatch==='existing' && !validTeamId(input.expectedUserId) || input.accountMatch==='none-found' && input.expectedUserId != null) {
    throw new DashboardAccessError(400,'Provide only reviewed athlete roster identity fields. Staff, consent and baseline answers cannot be staged here.');
  }
  return {sourceReference:input.sourceReference as string,displayName:input.displayName.trim() as string,phoneHash:tokenDigest(input.phoneNumber),
    accountMatch:input.accountMatch as string,phoneSupported:/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(input.phoneNumber),identityReview:input.identityReview as string,expectedUserId:input.expectedUserId || null};
}
/** Pending-only identity metadata. Never creates Auth, memberships, consents or baselines. */
export async function stagePendingAthlete(db: firestore.Firestore, uid: string, teamId: string, input: unknown) {
  const fields=validatePendingAthlete(input),id=digest([teamId,fields.sourceReference]),ref=records(db).doc(id);
  await staffScope(db,uid,teamId,true);
  return db.runTransaction(async tx=>{
    const readDb=transactionReads(db,tx),{team}=await staffScope(readDb,uid,teamId,true);
    if(fields.expectedUserId){
      await assertCommunicationAccountOpen(readDb,fields.expectedUserId);
      const member=(await tx.get(db.collection('pulsecheck-team-memberships').doc(`${teamId}_${fields.expectedUserId}`))).data();
      if(member && member.role!=='athlete')throw new DashboardAccessError(409,'This identity requires roster review. Staff cannot be staged as athletes.');
    }
    const [existing,index]=await Promise.all([tx.get(ref),tx.get(phoneIndex(db,fields.phoneHash))]);
    const fingerprint=digest(fields);
    if(existing.exists){if(existing.data()?.fingerprint!==fingerprint)throw new DashboardAccessError(409,'This source row is already staged. Identity changes require review.');return{id,created:false};}
    const ids=Array.isArray(index.data()?.recordIds)?index.data()!.recordIds:[];
    if(ids.length>=50)throw new DashboardAccessError(409,'This contact requires identity review.');
    const status=fields.identityReview==='reviewed' && fields.accountMatch!=='ambiguous' && fields.phoneSupported && ids.length===0?'pending':'review-required';
    tx.create(ref,{...fields,id,teamId,organizationId:team.organizationId,role:'athlete',rosterVerified:true,status,fingerprint,createdBy:uid,createdAtMs:Date.now()});
    tx.set(phoneIndex(db,fields.phoneHash),{recordIds:[...ids,id]});
    return{id,created:true};
  });
}
export async function listPendingAthletes(db: firestore.Firestore, uid: string, teamId: string) {
  const {membership}=await staffScope(db,uid,teamId);
  // No assignment exists yet: an assigned/none roster scope cannot see new identities.
  if(!fullRoster(membership))return{athletes:[],claimsEnabled:pendingClaimsEnabled()};
  const snapshot=await records(db).where('teamId','==',teamId).limit(200).get();
  const athletes=[];
  for(const doc of snapshot.docs){
    const d=doc.data();
    if(d.enrolledAtMs)continue;
    if(d.expectedUserId||d.claimedUserId){try{for(const owner of new Set([d.expectedUserId,d.claimedUserId].filter(Boolean))){const closed=await db.collection('account-closure-jobs').doc(String(owner)).get(),adminDeleted=await rootFor(db).collection('admin-deletions').doc(String(owner)).get(),profile=await db.collection('users').doc(String(owner)).get();if(closed.exists||adminDeleted.exists||profile.data()?.accountClosureRequestedAt!=null||['closing','closed'].includes(profile.data()?.accountStatus)||profile.data()?.deletedAt)throw new DashboardAccessError(403,'Closed account.');}}catch(e){if(e instanceof DashboardAccessError)continue;throw e;}}
    const index=(await phoneIndex(db,d.phoneHash).get()).data();
    const unique=index?.recordIds?.length===1 && index.recordIds[0]===doc.id;
    athletes.push({id:doc.id,displayName:d.displayName,status:unique?d.status:'review-required'});
  }
  return{athletes,claimsEnabled:pendingClaimsEnabled()};
}
/** phoneProof must be derived server-side from recent verified phone authentication.
 * Claim binds the OTP-authenticated UID; known existing candidates must match. Enrollment/participation remain independent. */
export async function claimPendingAthlete(db: firestore.Firestore, uid: string, teamId: string, pendingId: string, phoneProof: string) {
  assertPendingClaimsEnabled();
  if(!validTeamId(teamId)||!validTeamId(pendingId)||!/^\+[1-9]\d{9,14}$/.test(phoneProof))throw new DashboardAccessError(400,'A valid pending athlete claim is required.');
  const ref=records(db).doc(pendingId);
  return db.runTransaction(async tx=>{
    assertPendingClaimsEnabled();
    const [closure,adminDeletion,profile]=await Promise.all([tx.get(db.collection('account-closure-jobs').doc(uid)),tx.get(rootFor(db).collection('admin-deletions').doc(uid)),tx.get(db.collection('users').doc(uid))]);
    if(closure.exists||adminDeletion.exists||profile.data()?.accountClosureRequestedAt!=null||['closing','closed'].includes(profile.data()?.accountStatus)||profile.data()?.deletedAt)throw new DashboardAccessError(403,'This account is closing or closed.');
    const record=(await tx.get(ref)).data();
    if(!record || record.teamId!==teamId || record.role!=='athlete' || !record.rosterVerified || record.phoneHash!==tokenDigest(phoneProof) ||
      record.accountMatch==='ambiguous' || record.accountMatch==='existing' && (record.expectedUserId!==uid || !profile.exists) || record.identityReview!=='reviewed' || !record.phoneSupported || record.status==='review-required' || record.claimedUserId && record.claimedUserId!==uid) {
      throw new DashboardAccessError(409,'This claim requires identity review. No account or baseline was changed.');
    }
    const [index,team,member]=await Promise.all([tx.get(phoneIndex(db,record.phoneHash)),tx.get(db.collection('pulsecheck-teams').doc(teamId)),tx.get(db.collection('pulsecheck-team-memberships').doc(`${teamId}_${uid}`))]);
    const t=team.data();
    if(!t || t.organizationId!==record.organizationId || t.status!=='active' || !activeRecord(t) || !validTeamId(t.organizationId))throw new DashboardAccessError(403,'This team is not available.');
    const org=(await tx.get(db.collection('pulsecheck-organizations').doc(t.organizationId))).data();
    if(!org || org.status!=='active' || !activeRecord(org) || member.exists && member.data()?.role!=='athlete')throw new DashboardAccessError(403,'This athlete claim is not available.');
    if(index.data()?.recordIds?.length!==1 || index.data()?.recordIds[0]!==pendingId)throw new DashboardAccessError(409,'This claim requires identity review. No account or baseline was changed.');
    tx.set(ref,{status:'claimed',claimedUserId:uid,claimedAtMs:record.claimedAtMs||Date.now()},{merge:true});
    return{claimed:true,enrollmentRequired:true,profileRequired:!profile.exists,message:'Account ownership confirmed. Complete your existing program invitation and personal participation choices before joining the active roster. No baseline answers were imported.'};
  });
}

/** No phone lookup is exposed: caller must first prove current phone ownership. */
export async function claimByVerifiedPhone(db:firestore.Firestore,uid:string,phoneProof:string){
 assertPendingClaimsEnabled();
 const index=(await phoneIndex(db,tokenDigest(phoneProof)).get()).data();
 if(index?.recordIds?.length!==1)throw new DashboardAccessError(409,'This claim requires identity review. No account or baseline was changed.');
 const id=index.recordIds[0],record=(await records(db).doc(id).get()).data();
 if(!record||!validTeamId(record.teamId))throw new DashboardAccessError(409,'This claim requires identity review. No account or baseline was changed.');
 return claimPendingAthlete(db,uid,record.teamId,id,phoneProof);
}
