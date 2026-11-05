const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { chromium } = require('@playwright/test');
const { harness } = require('./user-data-harness.cjs');

test('Chromium can send authenticated cross-origin requests after preflight', async () => {
  const h = harness({ profile: { creator: { stripeAccountId: 'synthetic-account' } } });
  const preflights = [];
  const api = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const route = url.pathname.slice(1);
    if (request.method === 'OPTIONS') preflights.push(route);
    let body = '';
    for await (const chunk of request) body += chunk;
    try {
      const result = await h.handler(route)({ httpMethod: request.method, headers: request.headers,
        queryStringParameters: Object.fromEntries(url.searchParams), body });
      response.writeHead(result.statusCode, result.headers);
      response.end(result.body);
    } catch { response.writeHead(500); response.end(); }
  });
  const web = http.createServer((_request, response) => response.end('<!doctype html><title>Synthetic security test</title>'));
  let browser;
  try {
    await Promise.all([new Promise(resolve => api.listen(0, '127.0.0.1', resolve)), new Promise(resolve => web.listen(0, '127.0.0.1', resolve))]);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${web.address().port}`);
    const results = await page.evaluate(async base => {
      const output = [];
      for (const route of ['get-body-weight', 'get-user-workouts', 'get-monthly-statement', 'save-fatburn-summary']) {
        const write = route === 'save-fatburn-summary';
        const response = await fetch(`${base}/${route}?userId=owner&month=2020-01`, {
          method: write ? 'POST' : 'GET', headers: { Authorization: 'Bearer owner', ...(write ? { 'Content-Type': 'application/json' } : {}) },
          ...(write ? { body: JSON.stringify({ userId: 'owner', id: 'browser-summary' }) } : {}),
        });
        output.push({ route, status: response.status, data: await response.json() });
      }
      return output;
    }, `http://127.0.0.1:${api.address().port}`);
    for (const result of results) {
      assert.equal(result.status, 200, result.route);
      assert.equal(result.data.success, true, result.route);
      assert.ok(preflights.includes(result.route), result.route);
    }
    assert.equal(h.calls.writes.length, 1);
  } finally {
    if (browser) await browser.close();
    await Promise.all([new Promise(resolve => api.close(resolve)), new Promise(resolve => web.close(resolve))]);
  }
});
