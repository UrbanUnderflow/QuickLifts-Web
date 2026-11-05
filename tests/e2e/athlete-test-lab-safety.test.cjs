'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
const script=path.resolve(__dirname,'../../scripts/test-lab/emulator-fixtures.cjs');
const {assertManifest}=require('../../scripts/test-lab/emulator-fixtures.cjs');
for(const [name,env,runId,message]of [
 ['production project',{GCLOUD_PROJECT:'quicklifts-dd3f1'},'safety-check','Production/non-demo project is forbidden'],
 ['external Firestore emulator',{FIRESTORE_EMULATOR_HOST:'example.com:8080'},'safety-check','loopback emulator hosts'],
 ['external Auth emulator',{FIREBASE_AUTH_EMULATOR_HOST:'example.com:9099'},'safety-check','loopback emulator hosts'],
 ['real credentials',{GOOGLE_APPLICATION_CREDENTIALS:'/tmp/not-a-real-key'},'safety-check','must not load real cloud credentials'],
 ['path traversal',{},'../bad','run-id must contain'],
])test(`refuses ${name} before any network or seed`,()=>{const r=spawnSync(process.execPath,[script,'seed','--run-id',runId],{env:{...process.env,GCLOUD_PROJECT:'',GOOGLE_APPLICATION_CREDENTIALS:'',FIRESTORE_EMULATOR_HOST:'',FIREBASE_AUTH_EMULATOR_HOST:'',...env},encoding:'utf8',timeout:5000});assert.equal(r.status,2);assert.match(r.stderr,new RegExp(message));});
test('cleanup manifests cannot nominate an unrelated auth account',()=>{assert.throws(()=>assertManifest({projectId:'demo-pulsecheck-ui',namespace:'ui-lab-example',accounts:{athlete:{uid:'unrelated-account'}},documentPaths:[]}),/Invalid isolated/);});
