const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const pageSource = fs.readFileSync(path.join(repoRoot, 'src/pages/PipeLists.tsx'), 'utf8');
const collaborationSource = fs.readFileSync(
  path.join(repoRoot, 'src/utils/pipelistsCollaboration.ts'),
  'utf8',
);

test('each existing member can open an addition-only PipeList picker', () => {
  assert.match(pageSource, /startAddingListsForCollaborator\(invite\)/);
  assert.match(pageSource, /Add lists/);
  assert.match(pageSource, /All PipeLists added/);
  assert.match(pageSource, /aria-label=\{`\$\{isAddingLists \? 'Cancel adding' : 'Add'\} PipeLists for \$\{memberLabel\}`\}/);
  assert.match(pageSource, /const availableAdditionalLists = lists\.filter\(\(list\) => !assignedListIds\.has\(list\.id\)\)/);
  assert.match(pageSource, /Current access stays the same\. Choose only the additional lists they should see/);
});

test('member additions require explicit current owner lists and do not use an active-list fallback', () => {
  assert.match(pageSource, /planPipeListAccessAdditions\(\{/);
  assert.match(pageSource, /availableListIds: personalListsRef\.current\.map\(\(list\) => list\.id\)/);
  assert.match(pageSource, /existingListIds: existingMember\.listAccess\.map\(\(entry\) => entry\.listId\)/);
  assert.match(pageSource, /targetLists = personalListsRef\.current\.filter\(\(list\) => addListIds\.has\(list\.id\)\)/);
  assert.match(pageSource, /Choose at least one additional PipeList/);
  assert.doesNotMatch(pageSource, /selectedShareLists\.length > 0 \? selectedShareLists : \[activeList\]/);
  assert.match(collaborationSource, /alreadyAssignedListIds/);
  assert.match(collaborationSource, /unavailableListIds/);
});

test('the new permission applies only to new lists while share privacy and protected storage stay intact', () => {
  assert.match(pageSource, /Access for the new lists/);
  assert.match(pageSource, /View only/);
  assert.match(pageSource, /Can make changes/);
  assert.match(pageSource, /publicRead: existingShare\?\.publicRead \?\? true/);
  assert.match(pageSource, /list: publicSafePipeListSnapshot\(list\)/);
  assert.match(pageSource, /persistPipeListMemberAccessAddition\(\{/);
  assert.match(pageSource, /const publicSnapshot = await transaction\.get\(publicShareRef\)/);
  assert.match(pageSource, /const accessMerge = addPipeListMemberAccess\(\{/);
  assert.match(pageSource, /if \(!accessMerge\.added\) \{/);
  assert.match(pageSource, /publicSnapshot\.exists\(\) \? publicData\.publicRead === true : true/);
  assert.match(pageSource, /persistCollaborativePipeList\(\{/);
  assert.match(pageSource, /payloads\.forEach\(\(payload\) => sharesById\.set\(payload\.id, payload\)\)/);
  assert.match(pageSource, /listNames: targetLists\.map\(\(list\) => list\.name\)/);
});

test('member-list saves retain the server-confirmed access gate and lock to the selected member', () => {
  assert.match(pageSource, /if \(!user \|\| !isOwner \|\| isSharedView\) return/);
  assert.match(pageSource, /if \(!ownerSharesReady\)/);
  assert.match(pageSource, /existingMember = inviteHistory\.find\(\(invite\) => invite\.email === memberEmail\)/);
  assert.match(pageSource, /accountEmails = \[memberEmail\]/);
  assert.match(pageSource, /disabled=\{!ownerSharesReady \|\| additionalListIds\.length === 0/);
});
