const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const pageSource = fs.readFileSync(path.join(repoRoot, 'src/pages/PipeLists.tsx'), 'utf8');
const componentSource = fs.readFileSync(
  path.join(repoRoot, 'src/components/pipelists/PipeListsCustomerSuccess.tsx'),
  'utf8',
);
const rulesSource = fs.readFileSync(path.join(repoRoot, 'firestore.simpbudget.rules'), 'utf8');
const reminderSource = fs.readFileSync(
  path.join(repoRoot, 'netlify/functions/pipelists-deadline-reminders.ts'),
  'utf8',
);

test('university lists gain a Success tab while Pipeline List and Kanban remain available', () => {
  assert.match(pageSource, /type ViewMode = 'pipeline' \| 'success' \| 'metrics' \| 'logs' \| 'runbook'/);
  assert.match(pageSource, /successWorkspaceAvailable[\s\S]*id: 'success' as const, label: 'Success'/);
  assert.match(pageSource, /<PipeListsCustomerSuccess/);
  assert.match(pageSource, /id: 'list' as const, label: 'List'/);
  assert.match(pageSource, /id: 'kanban' as const, label: 'Kanban'/);
  assert.match(pageSource, /!isUniversitySuccessList \|\| pipelineDisplayMode === 'list'/);
});

test('the Success view separates commercial stage, delivery phase, health, action, launch, and renewal', () => {
  assert.match(componentSource, /commercialStage/);
  assert.match(componentSource, /Delivery phase/);
  assert.match(componentSource, /Customer health/);
  assert.match(componentSource, /Next customer action/);
  assert.match(componentSource, /Action status/);
  assert.match(componentSource, /<option value="complete">Complete<\/option>/);
  assert.match(componentSource, /Launch checklist/);
  assert.match(componentSource, /Success measures/);
  assert.match(componentSource, /Contract and renewal/);
  assert.match(componentSource, /Health unknown/);
  assert.match(componentSource, /Needs attention/);
});

test('the canonical success action stays synchronized with existing pipeline and reminder fields', () => {
  assert.match(pageSource, /nextStep: customerSuccessToSave\.nextAction\.summary/);
  assert.match(pageSource, /dueDate: customerSuccessToSave\.nextAction\.dueDate/);
  assert.match(pageSource, /nextStep: customerSuccess\.nextAction\.summary/);
  assert.match(pageSource, /dueDate: customerSuccess\.nextAction\.dueDate/);
  assert.match(pageSource, /if \(list\.templateKey === 'university-pilot'\) return item\.dueDate/);
});

test('both log forms expose aggregate metric fields with explicit period and source', () => {
  assert.match(pageSource, /const MetricLogFields/);
  assert.match(pageSource, /idPrefix="modal-log-metric"/);
  assert.match(pageSource, /idPrefix="detail-log-metric"/);
  assert.match(pageSource, /Period start/);
  assert.match(pageSource, /Period end/);
  assert.match(pageSource, /Evidence source/);
  assert.match(pageSource, /Blank means missing\. Enter 0 when the measured result is zero/);
  assert.match(pageSource, /max=\{maximum\}/);
  assert.match(pageSource, /Reporting period start must be on or before the end date/);
  assert.match(pageSource, /<MetricLogSummary log=\{log\}/);
});

test('metrics and logs default to selected-list scope and exclude future evidence', () => {
  assert.match(pageSource, /useState<MetricsScope>\('selected-list'\)/);
  assert.match(pageSource, /useState<string>\(initialLists\[0\]\.id\)/);
  assert.match(pageSource, /Workspace: all lists/);
  assert.match(pageSource, /Success evidence: last 90 days/);
  assert.match(pageSource, /logDate > reportingToday/);
  assert.match(pageSource, /successEvidenceTimestamp\(right\) - successEvidenceTimestamp\(left\)/);
  assert.match(pageSource, /latestCurrentSuccessEvidenceAt[\s\S]*includeStored: false/);
  assert.match(pageSource, /currentEditingItem\?\.weeklyLogs \|\| \[\]/);
  assert.match(pageSource, /deletedLog\?\.type === 'metrics'/);
  assert.match(pageSource, /updatedAt,/);
  assert.match(pageSource, /rates are kept unblended/);
  assert.doesNotMatch(pageSource, /completed\s*\/\s*rostered/);
});

test('the first release stays visibly unconnected and does not expose product IDs in the public list editor', () => {
  assert.match(componentSource, /Connection required; manual evidence only/);
  assert.doesNotMatch(componentSource, /value\.linkage/);
  assert.doesNotMatch(componentSource, />Pilot ID</);
  assert.doesNotMatch(componentSource, />Organization ID</);
  assert.doesNotMatch(componentSource, />Team ID</);
  assert.doesNotMatch(componentSource, /<option value="connected">/);
  assert.match(componentSource, /Connected aggregate managed by PulseCheck/);
  assert.match(pageSource, /publicSafePipeListSnapshot/);
  assert.match(pageSource, /list\.templateKey !== 'university-pilot' && !item\.customerSuccess/);
  assert.match(pageSource, /delete publicItem\.customerSuccess/);
  assert.match(pageSource, /publicItem\.weeklyLogs\.filter\(\(log\) => log\.type !== 'metrics'\)/);
  assert.match(pageSource, /PIPELIST_PROTECTED_SHARES_COLLECTION/);
  assert.match(pageSource, /protectedDetails/);
  assert.match(pageSource, /publicRead: true/);
  assert.match(pageSource, /list: publicSafePipeListSnapshot\(list\)/);
  assert.match(rulesSource, /match \/pipeListProtectedShares\/\{shareId\}/);
  assert.match(rulesSource, /allow read: if isProtectedShareOwner\(\) \|\| isProtectedShareViewer\(\)/);
  assert.match(rulesSource, /request\.resource\.data\.lastEditedBy\.uid == request\.auth\.uid/);
  assert.match(rulesSource, /affectedKeys\(\)\.hasOnly\(\[[\s\S]*'list',[\s\S]*'lastEditedBy',[\s\S]*'updatedAt'/);
  assert.match(pageSource, /const nextShares = Array\.from\(sharesById\.values\(\)\)/);
  assert.match(pageSource, /protectedShareLists\[share\.id\]/);
  assert.match(pageSource, /doc\(simpBudgetDb, PIPELIST_PROTECTED_SHARES_COLLECTION, share\.id\)/);
  assert.match(pageSource, /organizationId: ''[\s\S]*teamId: ''[\s\S]*pilotId: ''/);
  assert.match(rulesSource, /resource\.data\.get\('protectedDetails', false\)/);
  assert.match(rulesSource, /isInvitedEditor\(\)[\s\S]*!isProtectedPublicProjection\(\)/);
  assert.match(pageSource, /isProtected && actor\.uid === ownerUid/);
  assert.match(pageSource, /lastEditedBy: deleteField\(\)/);
});

test('owner and collaborator list snapshots reconcile without a remote-write echo', () => {
  assert.match(pageSource, /mergeCollaboratorListSnapshot/);
  assert.match(pageSource, /directShareBaselineRef/);
  assert.match(pageSource, /serializedSnapshot === directShareBaselineRef\.current/);
  assert.match(pageSource, /persistCollaborativePipeList/);
  assert.match(pageSource, /runTransaction\(simpBudgetDb/);
  assert.match(pageSource, /nextShare\.lastEditedBy\.uid !== user\.uid/);
  assert.match(pageSource, /sharedUpdatedAt > personalUpdatedAt/);
  assert.match(pageSource, /movedToListId: targetList\.id/);
  assert.match(pageSource, /!item\.movedToListId/);
  assert.match(pageSource, /linkage: personalItem\.customerSuccess\.linkage/);
  assert.match(pageSource, /: personalItem\.customerSuccess/);
  assert.match(pageSource, /JSON\.stringify\(nextList\) !== JSON\.stringify\(share\.list\)/);
  assert.match(pageSource, /lastEditedBy:[\s\S]*uid: user\.uid/);
});

test('public links keep their setting while private links recover after invited-account sign-in', () => {
  assert.match(pageSource, /publicRead: existingShare\?\.publicRead \?\? true,[\s\S]*viewerEmails,[\s\S]*editorEmails/);
  assert.match(pageSource, /if \(!shareId \|\| !authReady\) return/);
  assert.match(pageSource, /data\.publicRead !== true && !accountCanRead/);
  assert.match(pageSource, /Sign in with an invited account to open this PipeLists share/);
  assert.match(pageSource, /\[authReady, shareId, user\?\.uid\]/);
  assert.doesNotMatch(
    pageSource,
    /persistCollaborativePipeList\([\s\S]{0,500}setDoc\([\s\S]{0,250}\{ publicRead: true \}/,
  );
});

test('protected success updates remain canonical for reminders and across account changes', () => {
  assert.match(reminderSource, /collection\('pipeListProtectedShares'\)\.doc\(shareId\)\.get\(\)/);
  assert.match(reminderSource, /if \(protectedList\?\.id === storedList\.id\) list = protectedList/);
  assert.match(reminderSource, /delete publicItem\.customerSuccess/);
  assert.match(reminderSource, /publicItem\.weeklyLogs\.filter\(\(log: Record<string, any>\) => log\?\.type !== 'metrics'\)/);
  assert.match(reminderSource, /items: \[publicItem\]/);
  assert.match(pageSource, /protectedDirectShareUid/);
  assert.match(pageSource, /protectedDirectShareIdentityChanged/);
  assert.match(pageSource, /setDataReady\(false\)[\s\S]*setProtectedDirectShareUid\(''\)/);
});

test('a viewer stays read-only when another collaborator has edit access', () => {
  assert.match(pageSource, /const shouldBlockEditShare = Boolean\(shareId && shareDoc && !shareDoc\.publicRead && !canReadShared\)/);
  assert.match(pageSource, /const canModify = isSharedView \? canEditShared/);
});

test('share management cannot overwrite access before the complete owner envelope is loaded', () => {
  assert.match(pageSource, /const \[ownerSharesReady, setOwnerSharesReady\] = useState\(false\)/);
  assert.match(pageSource, /includeMetadataChanges: true/);
  assert.match(pageSource, /const isServerSnapshot = !shareSnapshots\.metadata\.fromCache/);
  assert.match(pageSource, /setOwnerSharesReady\(isServerSnapshot\)/);
  assert.match(pageSource, /if \(!ownerSharesReady\) \{[\s\S]*Wait for current collaborator access to finish loading/);
  assert.match(
    pageSource,
    /disabled=\{!ownerSharesReady \|\| loadingOwnerShares \|\| selectedShareLists\.length === 0\}/,
  );
});
