const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('netlify/functions/simpbudget-parse-statement.ts', 'utf8');
function fixture(options = {}) {
  let count = options.count || 0, calls = 0, verified = 0, request;
  const result = { transactions: [{ date: '2026-10-01', description: 'Hardware store', amount: 12.25, kind: 'expense', suggestedSpaceId: 'business', reason: 'Upload guidance', sourceRow: 'Page 1 row 1' }], openingBalance: null, closingBalance: null, statementTotal: null, warnings: [] };
  class OpenAI { responses = { create: async input => { calls++; request = input; if (options.providerError) throw options.providerError; return options.response || { status: 'completed', output_text: JSON.stringify(result) }; } }; }
  const db = { collection: name => ({ doc: () => name === 'simpbudget-parser-limits' ? {} : { collection: () => ({ get: async () => ({ docs: [{ id: 'business', data: () => ({ name: 'Pulse' }) }] }) }) } }), runTransaction: async fn => fn({ get: async () => ({ data: () => ({ count, startedAt: Date.now() }) }), set: (_, value) => { count = value.count; } }) };
  const exports = {};
  const requireStub = name => name === 'openai' ? OpenAI : name.includes('getSimpBudgetServiceAccount') ? { getSimpBudgetAuth: async () => ({ verifyIdToken: async (_, revoked) => { verified++; assert.equal(revoked, true); if (options.invalidAuth) throw Error('invalid'); return { uid: 'owner' }; } }), getSimpBudgetFirestore: async () => db } : { resolveOpenAIApiKey: () => options.noKey ? null : 'test-only' };
  new Function('require', 'exports', 'Buffer', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText)(requireStub, exports, Buffer);
  const payload = { fileName: 'statement.pdf', mimeType: 'application/pdf', dataBase64: Buffer.from('%PDF-1.7 test fixture').toString('base64'), spaces: [{ id: 'business', name: 'Untrusted label' }], guidance: 'Hardware is likely Pulse' };
  const run = (body = payload, overrides = {}) => exports.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer test-token' }, body: JSON.stringify(body), ...overrides });
  return { ...exports, run, payload, result, get calls() { return calls; }, get verified() { return verified; }, get request() { return request; } };
}
test('rejects missing and invalid authentication before parsing/model calls', async () => {
  const app = fixture(); assert.equal((await app.run({}, { headers: {} })).statusCode, 401); assert.equal(app.calls, 0);
  assert.equal((await fixture({ invalidAuth: true }).run()).statusCode, 401);
  assert.equal((await app.run({}, { httpMethod: 'GET' })).statusCode, 405);
});
test('bounds and validates file data, mime signatures, details, JSON and space ownership', async () => {
  const app = fixture();
  for (const patch of [{ mimeType: 'text/html' }, { dataBase64: 'not base64' }, { dataBase64: Buffer.from('not a PDF').toString('base64') }, { guidance: 'x'.repeat(2001) }, { spaces: [{ id: '../owner', name: 'bad' }] }]) assert.equal((await app.run({ ...app.payload, ...patch })).statusCode, 400);
  assert.equal((await app.run({ ...app.payload, dataBase64: 'A'.repeat(5600000) })).statusCode, 413);
  assert.equal((await app.run({}, { body: '{broken' })).statusCode, 400);
  assert.equal((await app.run({ ...app.payload, spaces: [{ id: 'other-user-space', name: 'Private' }] })).statusCode, 403);
  assert.equal(app.calls, 0);
});
test('durable per-user rate limit prevents model calls', async () => {
  const app = fixture({ count: 60 }); assert.equal((await app.run()).statusCode, 429); assert.equal(app.calls, 0);
});
test('valid PDF uses private nonstored extraction and owner-resolved labels, retaining rows', async () => {
  const app = fixture(); const response = await app.run(); assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body).transactions, app.result.transactions);
  assert.equal(response.headers['Cache-Control'], 'no-store'); assert.equal(app.request.store, false);
  assert.equal(app.request.input[0].content[1].type, 'input_file');
  assert.match(app.request.input[0].content[0].text, /Pulse/); assert.doesNotMatch(app.request.input[0].content[0].text, /Untrusted label/);
});
test('truncated model output never becomes a partial successful import', async () => {
  const app = fixture({ response: { status: 'incomplete', output_text: '{}' } }); assert.equal((await app.run()).statusCode, 502);
});
test('validation rejects invented dates, foreign space IDs, invalid amounts and oversized rows; preserves duplicate rows', () => {
  const app = fixture();
  for (const patch of [{ date: '2026-02-30' }, { suggestedSpaceId: 'foreign' }, { amount: '12' }, { amount: Infinity }, { kind: 'unsupported' }]) assert.throws(() => app.validateExtraction({ ...app.result, transactions: [{ ...app.result.transactions[0], ...patch }] }, new Set(['business'])));
  const duplicated = { ...app.result, transactions: [app.result.transactions[0], app.result.transactions[0]] }; assert.equal(app.validateExtraction(duplicated, new Set(['business'])).transactions.length, 2);
});
test('unavailable parser returns useful CSV fallback without leaking credentials', async () => {
  const app = fixture({ noKey: true }); const response = await app.run(); assert.equal(response.statusCode, 503); assert.match(response.body, /CSV/); assert.doesNotMatch(response.body, /test-token|test-only/);
});
test('PNG, JPEG and WebP are accepted only with matching signatures', async () => {
  const app = fixture();
  for (const [mimeType, bytes] of [['image/png', Buffer.from([137,80,78,71,13,10,26,10,0])], ['image/jpeg', Buffer.from([255,216,255,224,0])], ['image/webp', Buffer.from('RIFF0000WEBPdata')]]) {
    const response = await app.run({ ...app.payload, mimeType, dataBase64: bytes.toString('base64') });
    assert.equal(response.statusCode, 200);
    assert.equal(app.request.input[0].content[1].type, 'input_image');
  }
});

test('upstream quota exhaustion has a clear CSV fallback without upstream details', async () => {
  const app = fixture({ providerError: { status: 429, code: 'credit_balance_exhausted', message: 'private upstream details' } });
  const result = await app.run(); assert.equal(result.statusCode, 503); assert.match(result.body, /quota is exhausted/); assert.doesNotMatch(result.body, /private upstream details/);
});
