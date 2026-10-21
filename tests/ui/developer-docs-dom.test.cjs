const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../..');
function load(relative) {
  const module = { exports: {} };
  const filename = path.join(root, relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const req = name => {
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => String(key) });
    if (name === 'next/link') return ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children);
    if (name === './DeveloperLayout') return ({ children }) => React.createElement('main', null, children);
    if (name.includes('SnapshotArtifactReader')) return load('src/components/admin/system-overview/SnapshotArtifactReader.tsx');
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(req, module, module.exports);
  return module.exports.default;
}
const Page = load('src/components/developer/DeveloperDocumentPage.tsx');
const Reader = load('src/components/admin/system-overview/SnapshotArtifactReader.tsx');
const props = { slug: 'auntedna', title: 'AuntEdna athlete baseline', description: 'Integration guide', locked: true, available: true };
function render(Component, values) {
  return new JSDOM(renderToStaticMarkup(React.createElement(Component, values)), { url: 'https://fixture.invalid/developer/api/auntedna' });
}
for (const slug of ['auntedna', 'athleticmind-snapshots', 'clinical-bridge']) {
  test(`${slug}: server-rendered form supports autofill and submission without JavaScript`, () => {
    const dom = render(Page, { ...props, slug });
    try {
      const form = dom.window.document.querySelector('form');
      const input = form.querySelector('input[type="password"]');
      const button = form.querySelector('button[type="submit"]');
      assert.equal(form.method, 'post');
      assert.equal(form.getAttribute('action'), `/api/developer/docs/${slug}/unlock`);
      assert.equal(input.name, 'password');
      assert.equal(input.autocomplete, 'current-password');
      assert.equal(input.required, true);
      assert.equal(input.maxLength, 256);
      assert.equal(button.disabled, false, 'React state must not disable the native submit button');
      assert.equal(form.checkValidity(), false, 'native required validation prevents empty submission');
      // Browser/password-manager autofill can change the DOM value without a React change event.
      input.value = 'Synthetic autofilled password';
      assert.equal(form.checkValidity(), true);
      assert.equal(button.disabled, false);
      assert.equal(new dom.window.FormData(form).get('password'), 'Synthetic autofilled password');
      // The named field and submit button provide the browser-native Enter/submit path.
      input.value = 'Synthetic typed password';
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      assert.equal(new dom.window.FormData(form).get('password'), 'Synthetic typed password');
      assert.equal(form.querySelectorAll('[type="submit"]').length, 1);
    } finally { dom.window.close(); }
  });
}
test('unavailable documentation renders a visible status rather than a dead submit control', () => {
  const dom = render(Page, { ...props, available: false });
  try {
    assert.equal(dom.window.document.querySelector('form'), null);
    assert.match(dom.window.document.querySelector('[role="status"]').textContent, /access|prepared/i);
  } finally { dom.window.close(); }
});
const artifacts = [
  { name: 'README.md', content: '# Guide\n\n[Snapshot guide](/developer/api/athleticmind-snapshots)\n\n[Clinical guide](/developer/api/clinical-bridge)\n\n[Baseline guide](/developer/api/auntedna)\n\n[Schema](baseline.schema.json)\n\n[Unsafe](javascript:alert%281%29)' },
  { name: 'baseline.schema.json', content: '{"type":"object"}' },
];
test('unlocked document renders cross-guide, artifact and download links usable without JavaScript', () => {
  const dom = render(Page, { ...props, locked: false, artifacts });
  try {
    const doc = dom.window.document;
    for (const slug of ['athleticmind-snapshots', 'clinical-bridge', 'auntedna']) {
      assert.ok(doc.querySelector(`a[href="/developer/api/${slug}"]`), `missing ${slug} guide link`);
    }
    const schema = [...doc.querySelectorAll('a')].find(link => link.textContent === 'Schema');
    assert.ok(schema, 'inline schema link must remain actionable');
    const schemaUrl = new URL(schema.href);
    assert.equal(schemaUrl.pathname, '/developer/api/auntedna');
    assert.equal(schemaUrl.searchParams.get('artifact'), 'baseline.schema.json');
    const navLinks = doc.querySelectorAll('nav[aria-label="Integration artifacts"] a');
    assert.equal(navLinks.length, artifacts.length);
    assert.ok([...doc.querySelectorAll('a')].some(link => link.getAttribute('href') === '/developer/api/auntedna/artifacts/README.md'));
    assert.equal(doc.querySelector('a[href^="javascript:"]'), null);
  } finally { dom.window.close(); }
});
test('requested artifact is visible in server-rendered document and downloadable', () => {
  const dom = render(Page, { ...props, locked: false, artifacts, selectedArtifact: 'baseline.schema.json' });
  try {
    const doc = dom.window.document;
    assert.match(doc.querySelector('section').textContent, /"type":"object"/);
    assert.ok(doc.querySelector('a[href="/developer/api/auntedna/artifacts/baseline.schema.json"]'));
    assert.match(doc.querySelector('nav [aria-current="page"]').textContent, /schema/i);
  } finally { dom.window.close(); }
});
test('reader rejects dangerous Markdown links while preserving safe internal links', () => {
  const dom = render(Reader, { artifacts });
  try {
    const links = [...dom.window.document.querySelectorAll('a')];
    assert.ok(links.some(a => a.getAttribute('href') === '/developer/api/clinical-bridge'));
    assert.ok(links.every(a => !/^javascript:/i.test(a.getAttribute('href') || '')));
    assert.match(dom.window.document.body.textContent, /Unsafe/);
  } finally { dom.window.close(); }
});

test('hydrated form keeps a password-manager DOM value and allows native submission', async () => {
  const markup = renderToStaticMarkup(React.createElement(Page, props));
  const dom = new JSDOM(`<div id="root">${markup}</div>`, { url: 'https://fixture.invalid/developer/api/auntedna' });
  const prior = {};
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    prior[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  let mounted;
  try {
    await React.act(async () => { mounted = require('react-dom/client').hydrateRoot(document.getElementById('root'), React.createElement(Page, props)); });
    const form = document.querySelector('form');
    const input = form.querySelector('input');
    const button = form.querySelector('button');
    input.value = 'Synthetic password-manager value'; // No React input/change event.
    let submission;
    form.addEventListener('submit', event => {
      assert.equal(event.defaultPrevented, false, 'the component must preserve native form submission');
      submission = new window.FormData(form).get('password');
      event.preventDefault(); // Test-only interception avoids navigation.
    });
    await React.act(async () => { mounted.render(React.createElement(Page, { ...props, description: 'Updated description' })); });
    assert.equal(input.value, 'Synthetic password-manager value');
    assert.equal(button.disabled, false);
    form.requestSubmit(button);
    assert.equal(submission, 'Synthetic password-manager value');
  } finally {
    if (mounted) await React.act(async () => mounted.unmount());
    dom.window.close();
    for (const [key, descriptor] of Object.entries(prior)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
