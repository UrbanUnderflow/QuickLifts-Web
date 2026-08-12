const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('PipeLists Find leads routes pasted university batches through the local API', () => {
  const pipeLists = read('src/pages/PipeLists.tsx');

  assert.match(
    pipeLists,
    /const \[leadResearchPrompt, setLeadResearchPrompt\] = useState\(DEFAULT_LEAD_RESEARCH_PROMPT\)/,
    'Find leads should keep the research brief separate from the lead targets',
  );
  assert.match(
    pipeLists,
    /\{activeList\.name\} Profile/,
    'the profile modal title should include the active PipeList name',
  );
  assert.match(
    pipeLists,
    /const \[listProfileDraft, setListProfileDraft\] = useState/,
    'PipeLists should edit a profile draft before saving list-level research defaults',
  );
  assert.match(
    pipeLists,
    /objective: activeList\.objective/,
    'PipeLists should save an objective on the active list profile',
  );
  assert.match(
    pipeLists,
    /leadDefinition: activeList\.leadDefinition/,
    'PipeLists should save an ideal lead definition on the active list profile',
  );
  assert.match(
    pipeLists,
    /Lead targets[\s\S]*id="pipe-lead-search-prompt"/,
    'Find leads should label the pasted list field as lead targets',
  );
  assert.match(
    pipeLists,
    /Research brief[\s\S]*id="pipe-lead-research-prompt"/,
    'Find leads should expose a second field for the research to yield',
  );
  assert.match(
    pipeLists,
    /const pastedEntries = extractPastedLeadEntries\(searchPrompt\)/,
    'Find leads should parse newline-separated pasted entries before searching',
  );
  assert.match(
    pipeLists,
    /const LEAD_SEARCH_BATCH_SIZE = 1/,
    'pasted target lists should be researched one entry at a time so the full list is attempted',
  );
  assert.match(
    pipeLists,
    /const chunkLeadSearchEntries = \(entries: string\[\]\) =>/,
    'Find leads should split structured pasted entries into smaller research batches',
  );
  assert.match(
    pipeLists,
    /const activeLeadSearchEntryKeys = useMemo/,
    'Find leads should build a duplicate lookup for entries already in the active PipeList',
  );
  assert.match(
    pipeLists,
    /const researchablePastedEntries =[\s\S]*activeLeadSearchEntryKeys\.has\(normalizeOpportunityKey\(entry\)\)/,
    'Find leads should remove already-listed pasted entries before starting research',
  );
  assert.match(
    pipeLists,
    /chunkLeadSearchEntries\(researchablePastedEntries\)/,
    'Find leads should only spend research attempts on pasted entries that are not already in the list',
  );
  assert.match(
    pipeLists,
    /Skipped \$\{formatCount\(skippedExistingEntryCount, 'entry'\)\} already in \$\{activeList\.name\}/,
    'Find leads should tell the user when existing entries were skipped',
  );
  assert.match(
    pipeLists,
    /batchErrors\.push/,
    'Find leads should keep partial research results when one batch fails',
  );
  assert.match(
    pipeLists,
    /filteredDuplicateCount/,
    'Find leads should surface when the API filtered returned leads as duplicates',
  );
  assert.match(
    pipeLists,
    /exactRetryUsed && rawLeadCount === 0/,
    'Find leads should explain when an exact-entry retry still returns no usable candidates',
  );
  assert.match(
    pipeLists,
    /fetch\('\/api\/pipelists\/generate-leads'/,
    'Find leads should call the local PipeLists API instead of the browser calling the remote bridge',
  );
  assert.match(
    pipeLists,
    /inputEntries: entryBatch/,
    'Find leads should send pasted entries to the server for one-by-one extraction',
  );
  assert.match(
    pipeLists,
    /researchPrompt/,
    'Find leads should send the research brief to the server',
  );
  assert.match(
    pipeLists,
    /listObjective: activeList\.objective/,
    'Find leads should send the PipeList objective to the server',
  );
  assert.match(
    pipeLists,
    /leadDefinition: activeList\.leadDefinition/,
    'Find leads should send the PipeList ideal lead definition to the server',
  );
  assert.doesNotMatch(
    pipeLists,
    /buildStructuredEntryFallbackLeads/,
    'Find leads should not create addable copy-paste fallback records when research fails',
  );
});

test('PipeLists generate-leads API accepts larger structured pasted lists', () => {
  const apiRoute = read('src/pages/api/pipelists/generate-leads.ts');

  assert.match(apiRoute, /const MAX_ADJUSTMENTS_CHARS = 20000/);
  assert.match(apiRoute, /const MAX_LEAD_COUNT = 30/);
  assert.match(apiRoute, /const clampStructuredCount = \(value: unknown\) =>/);
  assert.match(apiRoute, /searchPrompt\?: string/);
  assert.match(apiRoute, /researchPrompt\?: string/);
  assert.match(apiRoute, /listObjective\?: string/);
  assert.match(apiRoute, /leadDefinition\?: string/);
  assert.match(apiRoute, /inputEntries\?: unknown\[\]/);
  assert.match(apiRoute, /requestedLeadCount\?: number/);
  assert.match(apiRoute, /stageOptions\?: StageInput\[\]/);
  assert.match(apiRoute, /When inputEntries is provided, research each input entry in order and return exactly one lead for every input entry/);
  assert.match(apiRoute, /When inputEntries contains one exact school or university name/);
  assert.match(apiRoute, /Exact-entry retry: the previous pass returned no candidates/);
  assert.match(apiRoute, /retryUsed/);
  assert.match(apiRoute, /filtered/);
  assert.match(apiRoute, /const exactEntryLabel = inputEntries\.length === 1/);
  assert.match(apiRoute, /const exactEntryKeys = exactEntryLabel/);
  assert.match(apiRoute, /isLikelyAggregateSource\(lead\) && !isExactEntryMatch/);
  assert.match(apiRoute, /const looksLikePersonName = \(value: string\) =>/);
  assert.match(apiRoute, /For university pilot PipeLists, never use an individual staff member as title/);
  assert.match(apiRoute, /decisionMaker: lead\.decisionMaker \|\| originalTitle/);
  assert.match(apiRoute, /Use the user's research brief to decide what insight to yield for each lead/);
  assert.match(apiRoute, /Use listObjective and leadDefinition as the qualification lens/);
});

test('PipeLists supports bulk select, delete, and move from the list toolbar', () => {
  const pipeLists = read('src/pages/PipeLists.tsx');

  assert.match(pipeLists, /const \[isBulkSelectionMode, setIsBulkSelectionMode\] = useState\(false\)/);
  assert.match(pipeLists, /const \[selectedBulkItemIds, setSelectedBulkItemIds\] = useState<string\[\]>\(\[\]\)/);
  assert.match(pipeLists, /const toggleSelectVisibleItems = \(\) =>/);
  assert.match(pipeLists, /const handleBulkDeleteSelected = \(\) =>/);
  assert.match(pipeLists, /const handleBulkMoveSelected = \(\) =>/);
  assert.match(pipeLists, /Move selected to\.\.\./);
  assert.match(pipeLists, /onClick=\{toggleBulkSelectionMode\}/);
  assert.match(pipeLists, /aria-pressed=\{isSelectedForBulkAction\}/);
});

test('PipeLists visible rows sort progressed stages before Identified and lost stages last', () => {
  const pipeLists = read('src/pages/PipeLists.tsx');

  assert.match(
    pipeLists,
    /const isIdentifiedStage = \(stage: StageConfig\) =>/,
    'PipeLists should recognize the Identified stage by id or label',
  );
  assert.match(
    pipeLists,
    /const isLostStage = \(list: PipeList, stageId: string\) => getStage\(list, stageId\)\.outcome === 'lost'/,
    'PipeLists should recognize lost stages from the stage outcome',
  );
  assert.match(
    pipeLists,
    /if \(isLostStage\(activeList, item\.stage\)\) return 2/,
    'lost stages should be ranked after active and Identified stages',
  );
  assert.match(
    pipeLists,
    /return isIdentifiedStage\(getStage\(activeList, item\.stage\)\) \? 1 : 0/,
    'the visible row sort should rank Identified rows after progressed stages',
  );
  assert.match(
    pipeLists,
    /if \(stageRankDifference !== 0\) return stageRankDifference/,
    'stage priority should be applied before date and title sorting',
  );
});

test('PipeLists opens an unverified source before allowing the lead to be added', () => {
  const pipeLists = read('src/pages/PipeLists.tsx');

  assert.match(
    pipeLists,
    /const \[openedGeneratedLeadSourceKeys, setOpenedGeneratedLeadSourceKeys\] = useState<string\[\]>\(\[\]\)/,
    'PipeLists should remember which generated lead sources the reviewer opened',
  );
  assert.match(
    pipeLists,
    /href=\{sourceUrl\}[\s\S]*target="_blank"[\s\S]*onClick=\{\(\) => handleOpenGeneratedLeadSource\(lead\)\}/,
    'Verify source should open the cited source in a new tab and record the review action',
  );
  assert.match(
    pipeLists,
    /sourceNeedsVerification && !sourceOpened[\s\S]*Verify source/,
    'an unverified source should show the Verify source action first',
  );
  assert.match(
    pipeLists,
    /sourceNeedsVerification && !sourceOpened[\s\S]*Source unavailable[\s\S]*Add lead/,
    'after the source opens, the generated lead action should become Add lead',
  );
});
