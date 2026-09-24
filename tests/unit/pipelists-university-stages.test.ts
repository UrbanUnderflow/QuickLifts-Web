import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../../src/pages/PipeLists.tsx', import.meta.url), 'utf8');
const stages = source.slice(source.indexOf('const legacyPilotContractStages:'), source.indexOf('const vcStages:'));
const normalizer = source.slice(source.indexOf('const normalizeStageId ='), source.indexOf('const normalizeActivityLog ='));
const api = new Function(ts.transpile(stages + normalizer + '\nreturn { pilotContractStages, contractStages, normalizeStageId, needsUniversityStageMigration };'))();

test('university stages follow the requested sequence and retain a lost/paused destination', () => {
  assert.deepEqual(api.pilotContractStages.map((s: any) => s.id), ['identified','outreach-queued','engaged','meeting-scheduled','proposal-sent','negotiating','pilot-agreed','contract-signed','pilot-active','pilot-complete','closed-lost-paused']);
  assert.equal(api.contractStages.some((s: any) => s.id === 'closed-won'), true);
});
test('existing university wins migrate to Pilot Active while contract wins stay unchanged', () => {
  assert.equal(api.normalizeStageId('closed-won', api.pilotContractStages), 'pilot-active');
  assert.equal(api.normalizeStageId('won', api.pilotContractStages), 'pilot-active');
  assert.equal(api.normalizeStageId('closed-won', api.contractStages), 'closed-won');
  assert.equal(api.needsUniversityStageMigration([{templateKey:'university-pilot', stages:api.pilotContractStages, items:[{stage:'closed-won'}]}]),true);
  assert.equal(api.needsUniversityStageMigration([{templateKey:'university-pilot', stages:api.pilotContractStages, items:[{stage:'pilot-active'}]}]),false);
});

test('existing university pipelines receive Meeting Scheduled and retain assigned stages', () => {
  const previousStages = api.pilotContractStages.filter((stage: any) => stage.id !== 'meeting-scheduled');
  assert.equal(api.needsUniversityStageMigration([{ templateKey: 'university-pilot', stages: previousStages, items: [{ stage: 'engaged' }] }]), true);
  for (const stage of api.pilotContractStages) {
    assert.equal(api.normalizeStageId(stage.id, api.pilotContractStages), stage.id);
  }
  assert.equal(api.contractStages.some((stage: any) => stage.id === 'meeting-scheduled'), false);
});
