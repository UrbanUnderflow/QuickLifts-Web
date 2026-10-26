import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {
  createSelfReportStartingProfile, isSelfReportStartingProfile,
  MENTAL_SKILL_FAMILIES, scoreMentalSkillsBaseline,
  type MentalSkillsCurrentState, type MentalSkillFamiliarity,
} from '../../src/api/firebase/mentaltraining/mentalSkillsBaseline';

const require = createRequire(import.meta.url);
const runtime = require('../../src/api/firebase/mentaltraining/profileSnapshotRuntime.js');
const {loadPulsecheckMetrics} = require('../api/pulsecheck/pulsecheck-test-helpers.cjs');
const currentState: MentalSkillsCurrentState = {
  mood:'okay', rest:3, energy:3, confidence:3, motivation:3,
  sportConnection:3, selfBelief:3, improvementBelief:3,
};
const familiarity = Object.fromEntries(MENTAL_SKILL_FAMILIES.map(f => [f, 'new_to_me'])) as Record<typeof MENTAL_SKILL_FAMILIES[number], MentalSkillFamiliarity>;
const reported = () => createSelfReportStartingProfile({
  completedAt:123456,source:'test',sportName:' Golf ',sportArchetype:'precision',
  familiarity:{...familiarity,visualization:'practiced_it'},
  answeredFamiliarity:['visualization','visualization'],
});

test('starting profile records only reported context, with no invented ability scores', () => {
  const result=reported();
  assert.equal(isSelfReportStartingProfile(result),true);
  assert.equal(result.sportName,'Golf');
  assert.equal('currentState' in result,false);
  assert.deepEqual(createSelfReportStartingProfile({...result,currentState}).currentState,currentState);
  assert.deepEqual(result.answeredFamiliarity,['visualization']);
  for(const key of ['familyScores','overallCompetencyScore','evidence','beliefScore','coherenceKnowledgeScore','disciplineFocus']) assert.equal(key in result,false,key);
  assert.deepEqual(createSelfReportStartingProfile({...result,answeredFamiliarity:undefined}).answeredFamiliarity,[]);
});

test('tools-only starting profile omits current state instead of inventing check-in answers', () => {
  const result=createSelfReportStartingProfile({
    completedAt:123456,source:'tools-only-test',sportArchetype:'precision',
    familiarity,answeredFamiliarity:[],
  });
  assert.equal('currentState' in result,false);
  assert.deepEqual(result.answeredFamiliarity,[]);
  assert.equal(runtime.bootstrapMentalSkillsBaselineProfile(result),null);
  const metrics=loadPulsecheckMetrics();
  assert.equal(metrics.deriveMentalSkillsBaselineProfile({mentalSkillsBaseline:result}),null);
});

test('self-report never becomes cognitive abilities, including after check-ins and practice telemetry', () => {
  const baseline=reported();
  assert.equal(runtime.bootstrapMentalSkillsBaselineProfile(baseline),null);
  assert.equal(runtime.deriveTaxonomyProfile({mentalSkillsBaseline:baseline,checkIns:[{readinessScore:5}],simSessions:[{normalizedScore:95}]}),null);
  const metrics=loadPulsecheckMetrics();
  assert.equal(metrics.deriveMentalSkillsBaselineProfile({mentalSkillsBaseline:baseline}),null);
});

test('unmeasured starting context receives a transparent foundation default, not a diagnosed weakness', () => {
  const plan=runtime.prescribeNextSession({profile:null});
  assert.equal(plan.evidenceStatus,'provisional');
  assert.equal(plan.recommendationBasis,'foundation_default');
  assert.equal(plan.recommendedSimId,'reset');
  assert.deepEqual(plan.targetPressureTypes,[]);
  const dailyRecovery=runtime.prescribeNextSession({profile:null,checkInState:{readinessScore:20}});
  assert.equal(dailyRecovery.sessionType,'recovery_rep');
  assert.equal(dailyRecovery.recommendationBasis,'foundation_default');
  assert.deepEqual(dailyRecovery.targetPressureTypes,[]);
  assert.doesNotMatch(plan.rationale,/weakest|low score|inhibition|working memory/i);
});

test('starting profile snapshots carry empty scores and unknown measurement context', () => {
  const input=runtime.buildProfileSnapshotWriteInput({athleteId:'synthetic',progress:{mentalSkillsBaseline:reported(),taxonomyProfile:runtime.bootstrapTaxonomyProfile(),updatedAt:123456},milestoneType:'baseline'});
  assert.deepEqual(input.profilePayload.pillarScores,{});
  assert.deepEqual(input.profilePayload.modifierScores,{});
  assert.deepEqual(input.profilePayload.skillSummaries,[]);
  assert.equal(input.profilePayload.measurementStatus,'unmeasured');
  assert.equal(input.profilePayload.pressurePattern,'not yet observed');
  assert.equal(input.profilePayload.consistencyState,'not yet observed');
  assert.equal(input.sourceRefs.trialCompletedAt,null);
  assert.equal(runtime.validateProfileExplanation(input.noraExplanation).valid,true);
});

test('historical challenge baselines remain readable and scored under their existing model', () => {
  const legacy=scoreMentalSkillsBaseline({completedAt:123456,source:'legacy-test',sportArchetype:'precision',currentState,familiarity,evidence:[]});
  assert.equal(legacy.version,5);
  assert.equal(isSelfReportStartingProfile(legacy),false);
  assert(runtime.bootstrapMentalSkillsBaselineProfile(legacy));
});

test('recommendation confidence stays provisional for self-report completion even with an active program', async () => {
  const {build} = await import('esbuild');
  const vm = await import('node:vm');
  const mocks: Record<string,string> = {
    '../config': 'export const db={};',
    'firebase/firestore': `export const collection=(...x)=>x,doc=(...x)=>x,query=(...x)=>x,where=(...x)=>x,orderBy=(...x)=>x;export const getDocs=async()=>({empty:true,docs:[]}),getDoc=async()=>({exists:()=>false}),addDoc=async()=>({id:'synthetic'}),updateDoc=async()=>{},onSnapshot=()=>()=>{};`,
    './types': `export const MentalPathway={Foundation:'foundation',ArousalMastery:'arousal',ConfidenceResilience:'confidence',EliteRefinement:'elite',FocusMastery:'focus',PressurePerformance:'pressure'};export const RecommendationConfidence={High:'high',Medium:'medium',Low:'low'},RecommendationStatus={Pending:'pending'};export const recommendationFromFirestore=(id,x)=>({...x,id}),recommendationToFirestore=x=>x;`,
    './exerciseLibraryService': `export const simModuleLibraryService={getById:async()=>({id:'breathing-box',name:'Box Breathing'}),getAll:async()=>[]};`,
    './athleteProgressService': `export const athleteProgressService={get:async()=>globalThis.__progress,getPathwayDisplayName:()=>"Foundation"};`,
    './curriculumAssignmentService': `export const curriculumAssignmentService={getActiveForAthlete:async()=>null};`,
    './taxonomy': `export const getSimSpec=()=>({name:'Foundation practice'});`,
  };
  const bundled=await build({entryPoints:['src/api/firebase/mentaltraining/recommendationService.ts'],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'synthetic-recommendation-context',setup(b){b.onResolve({filter:/.*/},args=>args.kind==='entry-point'?undefined:{path:args.path,namespace:'fixture'});b.onLoad({filter:/.*/,namespace:'fixture'},args=>{assert(args.path in mocks,args.path);return {contents:mocks[args.path],loader:'js'};});}}]});
  const context:any={module:{exports:{}},exports:{},__progress:{assessmentNeeded:false,currentPathway:'foundation',pathwayStep:0,foundationComplete:false,activeProgram:{recommendedSimId:'reset',recommendedLegacyExerciseId:'breathing-box'},mentalSkillsBaseline:reported()}};
  vm.runInNewContext(bundled.outputFiles[0].text,context);
  const service=context.module.exports.recommendationService;
  const provisional=await service.generateRecommendation('synthetic-athlete','synthetic-coach','assessment_complete');
  assert.equal(provisional.confidence,'low');
  context.__progress.mentalSkillsBaseline={version:5};
  const historical=await service.generateRecommendation('synthetic-athlete','synthetic-coach','assessment_complete');
  assert.equal(historical.confidence,'high');
});

test('pilot outcome snapshots exclude unmeasured profiles without losing baseline-completion provenance', async () => {
  const {createPulsecheckFirestore}=require('../api/pulsecheck/pulsecheck-test-helpers.cjs');
  const {db}=createPulsecheckFirestore();
  const metrics=loadPulsecheckMetrics();
  db.seedDoc('pulsecheck-pilot-enrollments','synthetic-enrollment',{pilotId:'synthetic-pilot',organizationId:'synthetic-org',teamId:'synthetic-team'});
  db.seedDoc('athlete-mental-progress','synthetic-athlete',{mentalSkillsBaseline:reported(),taxonomyProfile:runtime.bootstrapTaxonomyProfile(),updatedAt:123456});
  const snapshot=await metrics.upsertPilotMentalPerformanceSnapshot({db,athleteId:'synthetic-athlete',snapshotType:'baseline',preferredPilotEnrollmentId:'synthetic-enrollment'});
  assert.equal(snapshot.taxonomyProfile,null);
  assert.equal(snapshot.pillarCompositeScore,null);
  assert.equal(snapshot.targetDeltaFromBaseline,null);
  assert.equal(snapshot.validity.hasBaselineAssessment,true);
  assert.equal(snapshot.validity.excludedFromHeadlineDelta,true);
  assert.equal(snapshot.validity.exclusionReason,'unmeasured_starting_profile');
});
