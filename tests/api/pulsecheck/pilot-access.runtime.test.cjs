const test = require('node:test');
const assert = require('node:assert/strict');
const {compileTypeScriptRuntime, loadCompiledModule, createFirestoreAdminMock} = require('../firebase-admin/_runtimeHarness.cjs');
const compiled=compileTypeScriptRuntime({cacheKey:'school-pilot-access',entryPaths:['src/lib/server/pulsecheck/pilotAccess.ts','src/lib/server/pulsecheck/atomicConsent.ts']});
const {resolveActiveSchoolPilotAccess}=loadCompiledModule({compiled,fileName:'pilotAccess.js'});
const {resolveAtomicConsentDocuments}=loadCompiledModule({compiled,fileName:'atomicConsent.js'});
const build=()=>{
 const team={organizationId:'org',status:'active',commercialConfig:{commercialModel:'team-plan',teamPlanStatus:'inactive'}};
 const org={status:'active',productBrand:'athleticmind'};
 const pilot={status:'active',organizationId:'org',teamId:'team',studyMode:'pilot',startAt:'2099-01-01',endAt:'2099-12-31'};
 const docs=resolveAtomicConsentDocuments(team,pilot,'athleticmind',org);
 const member={id:'team_athlete',userId:'athlete',role:'athlete',organizationId:'org',teamId:'team',status:'active',athleteOnboarding:{targetPilotId:'pilot',entryOnboardingStep:'complete',productConsentAccepted:true,consentDecisions:Object.fromEntries(docs.map(d=>[d.id,{decision:d.category==='health_authorization'?'declined':'accepted',signedName:'Synthetic Athlete',version:d.version,document:d}]))}};
 const enrollment={status:'active',userId:'athlete',organizationId:'org',teamId:'team',pilotId:'pilot',teamMembershipId:member.id,enrollmentMode:'pilot'};
 const rows={'pulsecheck-organizations':[{id:'org',data:org}],'pulsecheck-pilots':[{id:'pilot',data:pilot}],'pulsecheck-pilot-enrollments':[{id:'pilot_athlete',data:enrollment}]};
 return {team,org,pilot,member,enrollment,rows,context:{isTeamAthlete:true,member,rawTeam:team,team:{id:'team'}}};
};
const access=f=>resolveActiveSchoolPilotAccess(createFirestoreAdminMock({collections:f.rows}).db,'athlete',f.context);
test('active school pilot grants access independently of inactive paid team plan and future start',async()=>{assert.equal(await access(build()),true)});
for(const [name,mutate] of Object.entries({
 foreignUID:f=>f.member.userId='other', revoked:f=>f.member.revokedAt=1, archivedTeam:f=>f.team.archivedAt=1,
 inactiveOrg:f=>f.org.status='paused', wrongParent:f=>f.pilot.teamId='other', expired:f=>f.pilot.endAt='2020-01-01',
 missingConsent:f=>f.member.athleteOnboarding.consentDecisions={}, athletePay:f=>f.team.commercialConfig.commercialModel='athlete-pay',
 wrongBrand:f=>f.org.productBrand='pulsecheck', withdrawn:f=>f.enrollment.status='withdrawn', wrongEnrollment:f=>f.enrollment.userId='other',
 missingCohort:f=>f.member.athleteOnboarding.targetCohortId='missing', staleConsent:f=>Object.values(f.member.athleteOnboarding.consentDecisions)[0].version='old',
 missingPilot:f=>f.rows['pulsecheck-pilots']=[]
})) test(`${name} denies pilot entitlement`,async()=>{const f=build();mutate(f);assert.equal(await access(f),false)});
test('active matching cohort grants access and archived cohort denies it',async()=>{
 const f=build(); f.member.athleteOnboarding.targetCohortId='cohort';f.enrollment.cohortId='cohort';
 const cohort={status:'active',organizationId:'org',teamId:'team',pilotId:'pilot'};
 f.rows['pulsecheck-pilot-cohorts']=[{id:'cohort',data:cohort}];
 assert.equal(await access(f),true);cohort.archivedAt=1;assert.equal(await access(f),false);
});
test('malformed pilot expiry fails closed',async()=>{const f=build();f.pilot.endAt='invalid';assert.equal(await access(f),false)});
