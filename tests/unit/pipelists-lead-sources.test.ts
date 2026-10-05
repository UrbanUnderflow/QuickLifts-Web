import assert from 'node:assert/strict';
import test from 'node:test';
import { getLeadSourceCandidates } from '../../src/utils/pipelistsLeadSources';
import handler from '../../src/pages/api/pipelists/extract-lead';

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
  const originalFetch = globalThis.fetch;
  let request: any;
  globalThis.fetch = async (_url, options) => {
    request = JSON.parse(String(options?.body));
    return new Response(JSON.stringify({ output: [{ content: [{
      text: JSON.stringify({ title: 'Dr. David Gazzaniga', sourceUrl: 'https://old.example/profile' }),
      annotations: [{ type: 'url_citation', url: 'https://official.example/profile' }],
    }] }] }), { status: 200 });
  };
  let status: number | undefined;
  let body: any;
  try {
    await handler({ method: 'POST', headers: { authorization: 'Bearer test' }, body: { input: 'Dr. David Gazzaniga' } } as any, {
      status(code: number) { status = code; return this; },
      json(value: unknown) { body = value; return this; },
    } as any);
    assert.equal(status, 200);
    assert.equal(request.tool_choice, 'required');
    assert.deepEqual(body.sourceCandidates, ['https://official.example/profile']);
    assert.equal(body.item.title, 'Dr. David Gazzaniga');
  } finally { globalThis.fetch = originalFetch; }
});
