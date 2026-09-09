const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const pageSource = fs.readFileSync(path.join(repoRoot, 'src/pages/PipeLists.tsx'), 'utf8');

test('stage and priority summary cards use additive multi-select state', () => {
  assert.match(pageSource, /useState<string\[\]>\(\[\]\)/);
  assert.match(pageSource, /useState<PipelinePriority\[\]>\(\[\]\)/);
  assert.match(pageSource, /setStageFilters\(\(current\) => toggleFilterSelection\(current, stage\.id\)\)/);
  assert.match(pageSource, /setPriorityFilters\(\(current\) => toggleFilterSelection\(current, priorityKey\)\)/);
  assert.match(pageSource, /aria-pressed=\{isSelected\}/);
});

test('filtering is additive within categories and keeps selected Kanban columns in stage order', () => {
  assert.match(pageSource, /matchesPipelineFilters\(item, stageFilters, priorityFilters\)/);
  assert.match(pageSource, /stageFilters\.length > 0[\s\S]*stageFilters\.includes\(stage\.id\)/);
  assert.match(pageSource, /activeList\.stages\.filter\(\(stage\) => stageFilters\.includes\(stage\.id\)\)/);
});

test('clear and list changes reset both category groups while counts stay list-wide', () => {
  assert.match(pageSource, /useEffect\(\(\) => \{\s*setStageFilters\(\[\]\);\s*setPriorityFilters\(\[\]\);\s*\}, \[activeList\.id, user\?\.uid\]\)/);
  assert.match(pageSource, /setQuery\(''\);\s*setStageFilters\(\[\]\);\s*setPriorityFilters\(\[\]\);/);
  assert.match(pageSource, /const countsByStage = useMemo\([\s\S]*?activeList\.stages\.reduce<Record<string, number>>[\s\S]*?activeListItems\.filter\(\(item\) => item\.stage === stage\.id\)[\s\S]*?\[activeListItems, activeList\.stages\]/);
  assert.match(pageSource, /const countsByPriority = useMemo\([\s\S]*?activeListItems\.reduce<Record<PipelinePriority, number>>[\s\S]*?\[activeListItems\]/);
});

test('University Kanban retains an accessible priority filter control', () => {
  assert.match(pageSource, /!isInvestorUpdateContactsList && \(\s*<div className="mb-4 grid grid-cols-3 gap-2">/);
  assert.match(pageSource, /aria-pressed=\{isSelected\}/);
  assert.doesNotMatch(pageSource, /aria-label=\{`\$\{isSelected \? 'Remove' : 'Add'\}/);
});
