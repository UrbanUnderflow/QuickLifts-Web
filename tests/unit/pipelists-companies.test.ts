import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { normalizeApplicableCompanies, matchesApplicableCompany } from '../../src/utils/pipelistsCompanies';
import { normalizeLeadTags } from '../../src/utils/pipelistsTags';
import { mergePipeListSnapshotsThreeWay } from '../../src/utils/pipelistsCollaboration';

const source = fs.readFileSync(new URL('../../src/features/PipeListsWorkspace.tsx', import.meta.url), 'utf8');
const factory = source.slice(source.indexOf('const createItem ='), source.indexOf('const createItem =') + source.slice(source.indexOf('const createItem =')).indexOf('\n};') + 3);
const scope = { normalizeApplicableCompanies, normalizeLeadTags, normalizeContactEmails: (v: unknown) => v || [], normalizeLinkedInProfileUrlForLead: (v: string) => v, cleanDealNotes: (v: string) => v };
const create = new Function(...Object.keys(scope), ts.transpile(factory + '\nreturn createItem;'))(...Object.values(scope));

test('exact company allowlist rejects malformed values and deduplicates', () => {
  for (const value of [undefined, null, 'PIL', {}, 1]) assert.deepEqual(normalizeApplicableCompanies(value), []);
  assert.deepEqual(normalizeApplicableCompanies(['AuntEdna', 'PIL', 'PIL', 'Other', 'pil']), ['PIL', 'AuntEdna']);
});

test('create, serialize, reload and clear company selections without altering sponsor', () => {
  const draft = { title: 'Grant', organization: 'Sponsor', description: '', contactPhone: '', linkedinUrl: '', notes: '', applicableCompanies: ['PIL', 'ATHLeda'] };
  const stored = JSON.parse(JSON.stringify(create(draft, 'grant')));
  assert.deepEqual(normalizeApplicableCompanies(stored.applicableCompanies), ['PIL', 'ATHLeda']);
  assert.equal(stored.organization, 'Sponsor');
  assert.deepEqual(create({ ...stored, applicableCompanies: [] }, 'grant').applicableCompanies, []);
});

test('editing one of 40 legacy records retains all records and concurrent changes', () => {
  const base = { id: 'grants', items: Array.from({length:40}, (_, i) => ({id:String(i), title:'Grant '+i, organization:'Sponsor', weeklyLogs:[{id:'log'+i}]})) };
  const local = structuredClone(base) as any;
  local.items[3].applicableCompanies = ['AthleticMind', 'AuntEdna'];
  const remote = structuredClone(base); remote.items[4].title = 'Concurrent edit';
  const saved = mergePipeListSnapshotsThreeWay(base, remote, local) as any;
  assert.equal(saved.items.length, 40);
  assert.deepEqual(saved.items[3].applicableCompanies, ['AthleticMind', 'AuntEdna']);
  assert.equal(saved.items[4].title, 'Concurrent edit');
  for (const item of saved.items) if (item.id !== '3') assert.equal('applicableCompanies' in item, false);
  assert.deepEqual(saved.items.map((v: any) => v.weeklyLogs), base.items.map(v => v.weeklyLogs));
});

test('company filter supports multiple assignments and legacy unassigned records', () => {
  assert.equal(matchesApplicableCompany(undefined, ''), true);
  assert.equal(matchesApplicableCompany(undefined, 'unassigned'), true);
  assert.equal(matchesApplicableCompany(undefined, 'PIL'), false);
  assert.equal(matchesApplicableCompany(['PIL','ATHLeda'], 'ATHLeda'), true);
  assert.equal(matchesApplicableCompany(['PIL'], 'unassigned'), false);
});
