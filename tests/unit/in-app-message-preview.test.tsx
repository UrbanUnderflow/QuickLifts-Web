import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppMessageMarkdown } from '../../src/components/admin/AppMessageEditor';

test('Markdown preview renders semantic headings, lists, emphasis, and safe links',()=>{
  const html=renderToStaticMarkup(<AppMessageMarkdown content={'# Your next step\n\nTake your **baseline**.\n\n- Keep progress\n- [Open it](/PulseCheck/baseline)'}/>);
  assert.match(html,/<h2/);assert.match(html,/<strong[^>]*>baseline<\/strong>/);assert.match(html,/<ul/);assert.match(html,/href="\/PulseCheck\/baseline"/);
});
test('raw HTML and executable Markdown URLs never become executable preview markup',()=>{
  const html=renderToStaticMarkup(<AppMessageMarkdown content={'<script>alert(1)</script>\n\n[Unsafe](javascript:alert%281%29)\n\n![Unsafe image](data:image/svg+xml,bad)'}/>);
  assert.doesNotMatch(html,/<script|href="javascript:|src="data:/);assert.match(html,/&lt;script&gt;/);assert.match(html,/Unsafe/);
});
