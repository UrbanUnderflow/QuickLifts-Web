import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { runbookElementToMarkdown } from '../../src/utils/pipelistsRichText';

test('formatted edits retain headings, emphasis, numbered lists, and table structure', () => {
  const dom = new JSDOM('<div id="editor"><h3>Performance</h3><p>Build <strong>focus</strong> and <em>resilience</em>.</p><ol start="1"><li><p>First</p></li><li>Second</li></ol><table><thead><tr><th>Audience</th><th>Ask</th></tr></thead><tbody><tr><td>Coach</td><td>Focus | recovery</td></tr></tbody></table></div>');
  const result = runbookElementToMarkdown(dom.window.document.getElementById('editor')!);
  assert.match(result, /### Performance/);
  assert.match(result, /Build \*\*focus\*\* and \*resilience\*\./);
  assert.match(result, /1\. First\n2\. Second/);
  assert.match(result, /\| Audience \| Ask \|\n\| --- \| --- \|\n\| Coach \| Focus \\\| recovery \|/);
});
