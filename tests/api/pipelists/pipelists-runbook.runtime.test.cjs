const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const apiSource = fs.readFileSync(path.join(repoRoot, 'src/pages/api/pipelists/runbook.ts'), 'utf8');
const componentSource = fs.readFileSync(
  path.join(repoRoot, 'src/components/pipelists/PipeListsRunbook.tsx'),
  'utf8',
);
const pageSource = fs.readFileSync(path.join(repoRoot, 'src/pages/PipeLists.tsx'), 'utf8');
const rulesSource = fs.readFileSync(path.join(repoRoot, 'firestore.simpbudget.rules'), 'utf8');

test('runbook API derives the actor and workspace access from verified SimpBudget identity', () => {
  assert.match(apiSource, /getSimpBudgetAuth/);
  assert.match(apiSource, /verifyIdToken\(idToken\)/);
  assert.match(apiSource, /PIPELISTS_RUNBOOK_OWNER_UID/);
  assert.match(apiSource, /getUserByEmail\(workspaceOwnerEmail\(\)\)/);
  assert.match(apiSource, /editorEmails', 'array-contains', email/);
  assert.match(apiSource, /data\.ownerUid === ownerUid && share\.id\.startsWith\(`\$\{ownerUid\}-`\)/);
  assert.match(apiSource, /const isOwner = decoded\.uid === ownerUid/);
  assert.match(apiSource, /membershipSource: isOwner \? 'workspace-owner' : 'pipe-list-editor'/);
  assert.doesNotMatch(apiSource, /viewerEmails', 'array-contains', email/);
  assert.doesNotMatch(apiSource, /resource\.data\.publicRead|data\(\)\.publicRead/);
});

test('runbook save uses an atomic version check and a permanent exact revision', () => {
  assert.match(apiSource, /db\.runTransaction/);
  assert.match(apiSource, /currentVersion !== input\.expectedVersion/);
  assert.match(apiSource, /res\.status\(409\)/);
  assert.match(apiSource, /code: 'VERSION_CONFLICT'/);
  assert.match(apiSource, /titleBefore/);
  assert.match(apiSource, /titleAfter/);
  assert.match(apiSource, /contentBefore/);
  assert.match(apiSource, /contentAfter/);
  assert.match(apiSource, /changedBy: actor/);
  assert.match(apiSource, /changedAt: timestamp/);
  assert.match(apiSource, /FieldValue\.serverTimestamp\(\)/);
});

test('runbook UI provides safe preview and exact side-panel change history', () => {
  assert.match(componentSource, /marked\.lexer/);
  assert.doesNotMatch(componentSource, /dangerouslySetInnerHTML/);
  assert.match(componentSource, /function HistoryDiff/);
  assert.match(componentSource, /Exact changes/);
  assert.match(componentSource, /changedBy\.email/);
  assert.match(componentSource, /Load older revisions/);
  assert.match(componentSource, /loadPipeListsRunbookRevision/);
  assert.match(componentSource, /Every save creates a permanent revision/);
  assert.match(apiSource, /\.select\([\s\S]*'changeSummary'/);
});

test('runbook edit mode keeps the editor interactive and the history rail out of its way', () => {
  assert.match(componentSource, /contentEditorRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(componentSource, /data-testid="runbook-content-editor"/);
  assert.match(componentSource, /onChange=\{\(event\) => setDraftContent\(event\.target\.value\)\}/);
  assert.match(componentSource, /xl:grid-cols-\[minmax\(0,1fr\)_minmax\(0,320px\)\]/);
  assert.match(componentSource, /grid min-w-0 grid-cols-\[minmax\(0,1fr\)\] gap-4/);
  assert.match(componentSource, /min-w-0 max-w-full resize-y/);
  assert.doesNotMatch(componentSource, /<textarea[\s\S]{0,500}(disabled|readOnly)=/);
});

test('runbook is a signed-in workspace tab and direct client Firestore access stays denied', () => {
  assert.match(pageSource, /type ViewMode = 'pipeline' \| 'success' \| 'metrics' \| 'logs' \| 'runbook'/);
  assert.match(pageSource, /runbookAvailable = !isSharedView/);
  assert.match(pageSource, /isOwner \|\| editableListIds\.size > 0/);
  assert.match(pageSource, /<PipeListsRunbook user=\{user\}/);
  assert.match(pageSource, /runbookHasUnsavedChanges/);
  assert.match(pageSource, /Discard your unsaved runbook changes/);
  assert.match(rulesSource, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false/);
  assert.doesNotMatch(rulesSource, /match \/pipeListWorkspaces/);
  assert.match(rulesSource, /request\.resource\.data\.ownerEmail == request\.auth\.token\.email/);
  assert.match(rulesSource, /request\.resource\.data\.ownerUid == resource\.data\.ownerUid/);
});
