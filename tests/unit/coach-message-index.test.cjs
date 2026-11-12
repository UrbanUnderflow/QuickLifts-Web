const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
test('coach message history supports descending pagination without removing ascending clients', () => {
  const {indexes} = JSON.parse(fs.readFileSync(path.join(__dirname, '../../firestore.indexes.json'), 'utf8'));
  for (const direction of ['ASCENDING', 'DESCENDING']) {
    assert.ok(indexes.some(index => index.collectionGroup === 'coach-athlete-messages' && index.queryScope === 'COLLECTION' && JSON.stringify(index.fields) === JSON.stringify([
      {fieldPath: 'conversationId', order: 'ASCENDING'},
      {fieldPath: 'timestamp', order: direction},
    ])), `Missing ${direction} conversation history index`);
  }
});
