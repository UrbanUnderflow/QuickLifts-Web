// Local, fictional-data-only UI preview. No Firebase, provider calls or delivery.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');

async function createPreviewServer(port = 4176) {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-messages-preview-'));
  await esbuild.build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Inbox from './src/components/coach/CoachMessagesInbox';createRoot(document.getElementById('root')).render(<main className="preview"><aside className="nav"><b>The Athletic Mind</b><span>Coach dashboard</span><small>SYNTHETIC TEAM</small><p>Overview</p><p>Athletes</p><p>Skill training</p><p className="active">Messages</p><p>Reports</p><p>Train Nora</p><p>Schedule</p><p>Team settings</p></aside><div className="content"><Inbox preview teamId="preview-team" coachId="preview-coach"/></div></main>);`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, outfile: path.join(output, 'app.js'), loader: { '.png': 'dataurl' },
    plugins: [{ name: 'no-live-auth', setup(build) {
      build.onResolve({ filter: /api\/firebase\/config$/ }, () => ({ path: 'no-live-auth', namespace: 'preview' }));
      build.onLoad({ filter: /.*/, namespace: 'preview' }, () => ({ contents: `export const auth={get currentUser(){throw Error('Live authentication is disabled in this preview')}};export const getFirebaseModeRequestHeaders=()=>{throw Error('Live requests are disabled in this preview')};` }));
    } }],
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coach Messages · Local preview</title><link rel="stylesheet" href="/app.css"><style>*{box-sizing:border-box}body{margin:0;background:#f7f8f5;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.preview{display:flex;min-height:100vh}.nav{width:215px;flex-shrink:0;background:#f9faf6;border-right:1px solid #dde3d7;padding:36px 24px;color:#60705f}.nav b{display:block;font:700 27px/1.2 Georgia,'Times New Roman',serif;letter-spacing:-1px;color:#22302e}.nav span{display:block;font-size:12px;margin:7px 0 40px}.nav small{font-size:10px;letter-spacing:1px}.nav p{padding:12px;font-size:13px}.nav .active{background:#e2ebd9;border-radius:10px;color:#25432b;font-weight:700}.content{padding:36px;flex:1;min-width:0}button,input,textarea{font:inherit}button{cursor:pointer}@media(max-width:850px){.nav{display:none}.content{padding:20px}}@media(max-width:600px){.content{padding:16px 10px}}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
  const server = http.createServer((request, response) => {
    const file = request.url === '/app.js' ? 'app.js' : request.url === '/app.css' ? 'app.css' : null;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'");
    if (file) { response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'application/javascript'); response.end(fs.readFileSync(path.join(output, file))); }
    else { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, output, url: `http://127.0.0.1:${server.address().port}`, close: async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(output, { recursive: true, force: true }); } };
}
module.exports = { createPreviewServer };
if (require.main === module) createPreviewServer(Number(process.env.PORT || 4176)).then(preview => {
  console.log(`Coach Messages local preview: ${preview.url}`);
  for (const event of ['SIGINT', 'SIGTERM']) process.once(event, async () => { await preview.close(); process.exit(0); });
}).catch(error => { console.error(error.message); process.exitCode = 1; });
