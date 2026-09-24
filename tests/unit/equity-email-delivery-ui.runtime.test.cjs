const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const module = {exports: {}};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true}}).outputText;
  vm.runInNewContext(source, {module, exports: module.exports, require: name => {
    if (name.endsWith('/api/firebase/config')) return {auth: {currentUser: null}, isUsingDevFirebase: () => false};
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
    return require(name);
  }, Date, Set, Map, console});
  cache.set(file, module.exports);
  return module.exports;
}
const delivery = load(path.join(__dirname, '../../src/components/admin/EquityEmailDeliveryPanel.tsx'));
const Confirmation = load(path.join(__dirname, '../../src/components/admin/EquityEmailSendConfirmation.tsx')).default;
const controls = {check: async () => {}, checkingIds: [], error: ''};
const request = {id: 'founder', documentName: 'Founder share return', recipientName: 'Tremaine Grant', recipientEmail: 'exact@example.com', sentAt: '2026-09-23', status: 'sent', emailDelivery: {status: 'failed', recipientEmail: 'exact@example.com', messageId: 'message-1', reason: 'Recipient mailbox rejected this email.'}};
const render = (requests, extra = {}) => renderToStaticMarkup(React.createElement(delivery.default, {requests, controls, ...extra}));
test('a persisted failure wins over legacy sentAt and remains after remount', () => {
  for (let mount = 0; mount < 2; mount++) {
    const html = render([JSON.parse(JSON.stringify(request))]);
    assert.match(html, /Email delivery failed/);
    assert.match(html, /Recipient mailbox rejected this email/);
    assert.match(html, /Tremaine Grant/);
    assert.match(html, /exact@example.com/);
    assert.match(html, /Founder share return/);
    assert.match(html, /Check delivery status/);
    assert.doesNotMatch(html, /Dismiss|aria-label="Close/);
  }
});
test('a retry accepted by Brevo retains the previous failure until delivery is confirmed', () => {
  const retry = {...request, emailDelivery: {...request.emailDelivery, status: 'accepted', reason: null, unresolvedFailure: {reason: 'Prior email was blocked.', at: '2026-09-23'}}};
  assert.match(render([retry]), /Retry awaiting delivery/);
  assert.match(render([retry]), /Prior email was blocked/);
  const delivered = {...retry, emailDelivery: {...retry.emailDelivery, status: 'delivered', unresolvedFailure: null}};
  assert.doesNotMatch(render([delivered]), /need attention|Prior email was blocked/);
});
test('provider acceptance is never displayed as delivered', () => {
  const html = render([{...request, emailDelivery: {...request.emailDelivery, status: 'accepted', reason: null}}]);
  assert.match(html, /Accepted by Brevo. Delivery pending/);
  assert.doesNotMatch(html, /Email delivered|Brevo confirms delivery/);
});
test('status-check errors stay visible alongside the last failure', () => {
  const html = render([{...request, emailDelivery: {...request.emailDelivery, checkError: 'Brevo unavailable'}}]);
  assert.match(html, /Email delivery failed/);
  assert.match(html, /Brevo unavailable/);
  assert.match(html, /Last recorded status retained/);
});
test('a package and its children produce one recipient delivery row', () => {
  const parent = {...request, id: 'package', documentName: 'EDNA package'};
  const rows = delivery.deliveryRequests([{...request, id: 'child-1', packageId: 'package'}, parent, {...request, id: 'child-2', packageId: 'package'}]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'package');
});
function findButton(element, text) {
  if (!element || typeof element !== 'object') return null;
  const children = React.Children.toArray(element.props?.children);
  if (element.type === 'button' && children.some(child => child === text)) return element;
  for (const child of children) {const found = findButton(child, text); if (found) return found;}
  return null;
}
test('confirmation names the actual prepared recipient and sends only on explicit confirmation', () => {
  let sends = 0;
  const props = {documents: ['Board consent', 'Capitalization certificate (reference)'], recipients: [{recipientName: 'Tremaine Grant', recipientEmail: 'prepared-address@example.com'}], busy: false, onConfirm: () => {sends++;}, onCancel: () => {}};
  const html = renderToStaticMarkup(React.createElement(Confirmation, props));
  assert.match(html, /Board consent/);
  assert.match(html, /Capitalization certificate/);
  assert.match(html, /Tremaine Grant/);
  assert.match(html, /prepared-address@example.com/);
  assert.equal(sends, 0);
  findButton(Confirmation(props), 'Confirm send').props.onClick();
  assert.equal(sends, 1);
});
test('confirmation disables sending if a prepared recipient address is missing', () => {
  const element = Confirmation({documents: ['Board consent'], recipients: [{recipientName: 'Tremaine Grant', recipientEmail: ''}], busy: false, onConfirm: () => {}, onCancel: () => {}});
  assert.equal(findButton(element, 'Confirm send').props.disabled, true);
});

test('preparation failures remain visible even when no server request exists', () => {
  const html = render([], {controls: {...controls, submissionIssues: [{stage: 'prepare', documentId: 'board', documentName: 'Board consent', recipientName: 'Tremaine Grant', recipientEmail: 'saved@example.com', message: 'Signing service unavailable'}]}});
  assert.match(html, /Could not prepare request. No email was submitted/);
  assert.match(html, /Board consent/);
  assert.match(html, /saved@example.com/);
  assert.match(html, /Signing service unavailable/);
  assert.doesNotMatch(html, /Check delivery status/);
});
test('package delivery is projected into child display without changing signature status', () => {
  const rows = delivery.withPackageEmailDelivery([{...request, id: 'parent'}, {id: 'child', packageId: 'parent', status: 'signed', signedAt: '2026-09-23', recipientEmail: 'exact@example.com'}]);
  assert.equal(rows[1].status, 'signed');
  assert.equal(rows[1].emailDelivery.status, 'failed');
});
test('uncertain sends can be explicitly retried while recent active sends are protected', () => {
  assert.equal(delivery.emailDeliveryIsUnconfirmed({...request, emailDelivery: {...request.emailDelivery, status: 'unknown'}}), true);
  assert.equal(delivery.emailDeliverySendInProgress({...request, emailDelivery: {...request.emailDelivery, status: 'sending', attemptedAt: new Date().toISOString()}}), true);
  assert.equal(delivery.emailDeliverySendInProgress({...request, emailDelivery: {...request.emailDelivery, status: 'sending', attemptedAt: '2020-01-01'}}), false);
  const html = renderToStaticMarkup(React.createElement(Confirmation, {documents: ['Board consent'], recipients: [{recipientEmail: 'exact@example.com'}], warning: 'Previous delivery could not be verified. Sending again may deliver a duplicate email.', confirmLabel: 'Confirm resend', busy: false, onConfirm: () => {}, onCancel: () => {}}));
  assert.match(html, /duplicate email/);
  assert.match(html, /Confirm resend/);
});

test('per-request check errors remain visible without duplicating stored provider check errors', () => {
  const before = JSON.stringify(request);
  const messages = delivery.deliveryCheckErrors([
    {requestId: 'founder', error: 'Could not save the latest status.'},
    {requestId: 'missing', error: 'Signing request not found.'},
    {requestId: 'founder', error: 'Brevo unavailable.', emailDelivery: {checkError: 'Brevo unavailable.'}},
    {requestId: 'founder', emailDelivery: {}},
  ], [request]);
  assert.equal(messages.length, 2);
  assert.match(messages[0], /Founder share return: Could not save the latest status/);
  assert.match(messages[1], /Signing request not found/);
  const html = render([request], {controls: {...controls, error: messages.join(' ')}});
  assert.match(html, /Email delivery failed/);
  assert.match(html, /Could not save the latest status/);
  assert.doesNotMatch(html, /Brevo unavailable/);
  assert.equal(JSON.stringify(request), before);
});
test('clearing an issue hides only that attempt and does not change delivery evidence', () => {
 const copy=JSON.stringify(request); const key=delivery.deliveryIssueKey(request);
 assert.equal(render([request],{controls:{...controls,clearedIssues:[key]}}),'');
 assert.equal(JSON.stringify(request),copy);
 assert.match(render([request]),/Clear this issue/);
 const polled={...request,emailDelivery:{...request.emailDelivery,checkedAt:'2026-09-24'}};
 assert.equal(delivery.deliveryIssueKey(polled),key);
 const retried={...request,emailDelivery:{...request.emailDelivery,attemptId:'new-attempt'}};
 assert.match(render([retried],{controls:{...controls,clearedIssues:[key]}}),/Email delivery failed/);
});
test('a newly repeated preparation error appears after the earlier issue was cleared',()=>{
 const issue={stage:'prepare',documentId:'reserve',documentName:'Reserve approval',message:'Missing ledger',occurredAt:'first'};
 const options={...controls,submissionIssues:[issue],clearedIssues:[delivery.submissionIssueKey(issue)]};
 assert.equal(render([],{controls:options}),'');
 assert.match(render([],{controls:{...options,submissionIssues:[{...issue,occurredAt:'second'}]}}),/Missing ledger/);
});
