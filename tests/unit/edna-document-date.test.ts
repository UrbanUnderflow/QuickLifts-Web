import test from 'node:test';
import assert from 'node:assert/strict';
import {dateEdnaInstrument} from '../../src/lib/ednaDocumentDate';
test('dates current instruments while preserving historical and execution facts', () => {
  const original = 'STRATEGIC WARRANT\n\nThis Warrant is issued as of September 9, 2026.\nSide Letter dated September 9, 2026.\nVesting Commencement Date September 11, 2026.\nDate: __________________';
  const revised = dateEdnaInstrument(original);
  assert.match(revised, /issued as of September 23, 2026/);
  assert.match(revised, /Side Letter dated September 9, 2026/);
  assert.match(revised, /Vesting Commencement Date September 11, 2026/);
  assert.match(revised, /Date: __________________/);
  assert.equal(dateEdnaInstrument(revised), revised);
});
