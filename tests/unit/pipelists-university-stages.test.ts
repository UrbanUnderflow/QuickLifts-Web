import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../../src/pages/PipeLists.tsx', import.meta.url), 'utf8');
const stages = source.slice(source.indexOf('const legacyPilotContractStages:'), source.indexOf('const vcStages:'));
const normalizer = source.slice(source.indexOf('const normalizeStageId ='), source.indexOf('const normalizeActivityLog ='));
const api = new Function(ts.transpile(stages + normalizer + '\nreturn { pilotContractStages, contractStages, normalizeStageId, needsUniversityStageMigration, reconcileUniversityStages };'))();

test('university stages follow the requested sequence and retain a lost/paused destination', () => {
  assert.deepEqual(api.pilotContractStages.map((s: any) => s.id), ['identified','outreach-queued','cold-email-sent','engaged','meeting-scheduled','proposal-sent','negotiating','pilot-agreed','contract-signed','pilot-active','pilot-complete','closed-lost-paused']);
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

test('existing university boards receive Cold Email Sent between queued and engaged', () => {
  const previousStages = api.pilotContractStages.filter((stage: any) => stage.id !== 'cold-email-sent');
  assert.equal(api.needsUniversityStageMigration([{ templateKey: 'university-pilot', stages: previousStages, items: [{ stage: 'outreach-queued' }] }]), true);
  assert.equal(api.normalizeStageId('cold-email-sent', api.pilotContractStages), 'cold-email-sent');
  assert.equal(api.contractStages.some((stage: any) => stage.id === 'cold-email-sent'), false);
});


test('an older stage schema retains the Cold Email Sent lane and assignment through save/reload', () => {
  const olderStages = api.pilotContractStages.filter((stage: any) => stage.id !== 'cold-email-sent');
  let saved = { stages: api.pilotContractStages, items: [{ stage: 'cold-email-sent' }] };
  for (let round = 0; round < 3; round++) {
    const reconciled = api.reconcileUniversityStages(saved.stages, olderStages);
    saved = JSON.parse(JSON.stringify({ stages: reconciled, items: saved.items.map((item: any) => ({ ...item, stage: api.normalizeStageId(item.stage, reconciled) })) }));
    assert.deepEqual(saved.stages.map((stage: any) => stage.id), api.pilotContractStages.map((stage: any) => stage.id));
    assert.equal(saved.items[0].stage, 'cold-email-sent');
  }
});

test('future saved stages retain their insertion order without repeated migration', () => {
  const futureStages = [...api.pilotContractStages];
  futureStages.splice(3, 0, { id: 'future-review', label: 'Future Review' }, { id: 'future-followup', label: 'Future Followup' });
  const reconciled = api.reconcileUniversityStages(futureStages);
  assert.deepEqual(reconciled, futureStages);
  assert.deepEqual(api.reconcileUniversityStages(reconciled), reconciled);
  assert.equal(api.needsUniversityStageMigration([{ templateKey: 'university-pilot', stages: reconciled, items: [{ stage: 'future-followup' }] }]), false);
});

test('unknown persisted item stages are not silently reassigned when their configuration is unavailable', () => {
  assert.equal(api.normalizeStageId('future-review', api.pilotContractStages, true), 'future-review');
  assert.equal(api.normalizeStageId('future-review', api.pilotContractStages), 'identified');
  assert.equal(api.normalizeStageId('', api.pilotContractStages, true), 'identified');
  assert.equal(api.normalizeStageId('in-review', api.pilotContractStages), 'engaged');
  assert.equal(api.normalizeStageId('won', api.pilotContractStages), 'pilot-active');
});
