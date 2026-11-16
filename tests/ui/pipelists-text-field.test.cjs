const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const React = require('react');
require('tsx/cjs');
const TextField = require('../../src/components/pipelists/PipeListsTextField.tsx').default;

test('focused text keeps its selection and keyboard composition while another editor types', async t => {
  const dom = new JSDOM('<div id="root"></div>');
  const oldGlobals = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })) {
    oldGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const root = require('react-dom/client').createRoot(document.getElementById('root'));
  t.after(async () => {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const [key, previous] of oldGlobals) {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else delete globalThis[key];
    }
  });
  const writes = [];
  const render = value => React.act(async () => root.render(React.createElement(TextField, {
    id: 'notes', multiline: true, value, onValueChange: next => writes.push(next),
  })));
  await render('one two');
  const field = document.getElementById('notes');
  field.focus();
  field.setSelectionRange(4, 7, 'backward');
  await render('new one two');
  assert.equal(field.value.slice(field.selectionStart, field.selectionEnd), 'two');
  assert.equal(field.selectionDirection, 'backward');
  assert.equal(document.activeElement, field);

  const composition = type => field.dispatchEvent(new dom.window.CompositionEvent(type, { bubbles: true }));
  await React.act(async () => composition('compositionstart'));
  const typed = 'new one two文';
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(field, typed);
    field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await render('remote new one two');
  assert.equal(field.value, typed);
  assert.deepEqual(writes, []);
  await React.act(async () => composition('compositionend'));
  assert.deepEqual(writes, ['remote new one two文']);
});
