const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

test('in-app rename dialog focuses the name, cancels with Escape, submits, and shows errors', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  const prior = new Map();
  const globals = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, HTMLButtonElement: dom.window.HTMLButtonElement,
    HTMLInputElement: dom.window.HTMLInputElement, Element: dom.window.Element, Node: dom.window.Node,
    MutationObserver: dom.window.MutationObserver, getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    ResizeObserver: class { observe() {} disconnect() {} unobserve() {} },
    IntersectionObserver: class { observe() {} disconnect() {} unobserve() {} },
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  for (const [key, value] of Object.entries(globals)) {
    prior.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const React = require('react');
  const { act } = React;
  const code = ts.transpileModule(fs.readFileSync('src/components/simpbudget/RenameBudgetSpaceModal.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  const Modal = module.exports.default;
  const root = require('react-dom/client').createRoot(document.getElementById('root'));
  let closes = 0, saves = 0;
  const props = { open: true, name: 'Pulse', busy: false, error: null, onNameChange() {}, onClose() { closes++; }, onSave() { saves++; } };
  const render = async next => act(async () => { root.render(React.createElement(Modal, { ...props, ...next })); });
  try {
    await render();
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    const dialog = document.querySelector('[role="dialog"]');
    assert.ok(dialog);
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    assert.equal(document.activeElement.id, 'rename-budget-space-name');
    assert.equal(document.querySelector('input').value, 'Pulse');
    await act(async () => document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(closes, 1);
    await act(async () => document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(saves, 1);
    await render({ error: 'Try again.' });
    assert.equal(document.querySelector('[role="alert"]').textContent, 'Try again.');
    assert.equal(document.querySelector('input').getAttribute('aria-invalid'), 'true');
    await render({ busy: true });
    assert.ok(document.querySelector('input').disabled);
    assert.ok(document.querySelector('button[type="submit"]').disabled);
    assert.equal(document.querySelector('button[type="button"]').disabled, false);
    assert.match(document.querySelector('[role="status"]').textContent, /close this window/);
    await act(async () => document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(closes, 2);
    await act(async () => document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(saves, 1);
    await render({ open: false });
    assert.equal(document.querySelector('[role="dialog"]'), null);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of prior) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; }
  }
});
