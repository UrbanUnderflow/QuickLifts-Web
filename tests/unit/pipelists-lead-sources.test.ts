import assert from 'node:assert/strict';
import test from 'node:test';
import { getLeadSourceCandidates } from '../../src/utils/pipelistsLeadSources';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

test('keeps only valid, unique citations, excluding uncited search results', () => {
  assert.deepEqual(getLeadSourceCandidates({ output: [
    { type: 'web_search_call', action: { sources: [{ url: 'https://unrelated.example' }] } },
    { content: [{ annotations: [
      { type: 'url_citation', url: 'https://profile.example/doctor' },
      { type: 'url_citation', url: 'https://profile.example/doctor' },
      { type: 'url_citation', url: 'javascript:alert(1)' },
      { type: 'url_citation', url: 'bad url' },
      null,
    ] }] },
  ] }), ['https://profile.example/doctor']);
  assert.deepEqual(getLeadSourceCandidates(null), []);
});

test('name analysis requires search and returns cited alternatives for source verification', async () => {
  let request: any;
  const fetchMock = async (_url: unknown, options: any) => {
    request = JSON.parse(String(options?.body));
    return new Response(JSON.stringify({ output: [{ content: [{
      text: JSON.stringify({ title: 'Dr. David Gazzaniga', sourceUrl: 'https://old.example/profile' }),
      annotations: [{ type: 'url_citation', url: 'https://official.example/profile' }],
    }] }] }), { status: 200 });
  };
  const module = { exports: {} as any };
  const source = fs.readFileSync(path.resolve('src/pages/api/pipelists/extract-lead.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module, exports: module.exports, process: { env: {} }, fetch: fetchMock, URL, console, AbortController, setTimeout, clearTimeout,
    require(name: string) {
      if (name === '../../../utils/pipelistsRuntime') return { guardPipeListsApiRequest: () => true };
      if (name === '../../../utils/pipelistsLeadSources') return { getLeadSourceCandidates };
      if (name === 'jsdom') return { JSDOM: class { constructor() { throw new Error('Unexpected page fetch'); } } };
      throw new Error(`Unmocked dependency: ${name}`);
    },
  });
  const handler = module.exports.default;
  let status: number | undefined;
  let body: any;
  {
    await handler({ method: 'POST', headers: { authorization: 'Bearer test' }, body: { input: 'Dr. David Gazzaniga' } } as any, {
      status(code: number) { status = code; return this; },
      json(value: unknown) { body = value; return this; },
    } as any);
    assert.equal(status, 200);
    assert.equal(request.tool_choice, 'required');
    assert.deepEqual(body.sourceCandidates, ['https://official.example/profile']);
    assert.equal(body.item.title, 'Dr. David Gazzaniga');
  }
});
