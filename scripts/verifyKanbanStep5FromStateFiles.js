#!/usr/bin/env node

// verifyKanbanStep5FromStateFiles.js
// Step 5 verifier that cross-checks both the live board.md and the
// step-specific state YAML files created during Steps 1–4.
//
// It enforces:
//  (a) No STATUS: BLOCKED tickets without metadata
//      (blockedTicketCount === 0 from step-2 YAML)
//  (b) Partnership-Led section present with 3–5 NORTH_STAR tickets
//      (from step-3 YAML and board.md)
//  (c) No STATUS: IN_PROGRESS tickets older than 14 days left untreated
//      (matchingTicketCount === 0 from step-4 YAML)
//
// Exit code:
//   0 → all conditions satisfied
//   1 → one or more conditions failed

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BOARD_PATH = path.join(ROOT, 'project', 'kanban', 'board.md');

const STEP2_YAML = path.join(
  ROOT,
  'docs',
  'deliverables',
  'kanban-step2-blocked-ticket-context-2026-02-21.yaml',
);
const STEP3_YAML = path.join(
  ROOT,
  'docs',
  'deliverables',
  'kanban-step3-partnership-led-section-state-2026-02-21.yaml',
);
const STEP4_YAML = path.join(
  ROOT,
  'docs',
  'deliverables',
  'kanban-step4-inprogress-deferral-state-2026-02-21.yaml',
);

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function requireIncludes(text, needle, context) {
  if (!text.includes(needle)) {
    throw new Error(`Missing required token "${needle}" in ${context}`);
  }
}

function main() {
  const errors = [];

  // (a) Blocked metadata via step-2 YAML and direct scan of board.md
  try {
    const step2 = readText(STEP2_YAML);
    requireIncludes(step2, 'blockedTicketCount: 0', 'step-2 YAML');
    requireIncludes(step2, 'blockedTicketsMissingContext: []', 'step-2 YAML');
    requireIncludes(step2, 'satisfied: true', 'step-2 YAML');

    const board = readText(BOARD_PATH);
    const blockedCount = (board.match(/STATUS: BLOCKED/g) || []).length;
    if (blockedCount !== 0) {
      errors.push(
        `Condition (a) failed: expected 0 STATUS: BLOCKED tickets, found ${blockedCount} in board.md`,
      );
    }
  } catch (err) {
    errors.push(`Condition (a) verification error: ${err.message}`);
  }

  // (b) Partnership-Led section with 3–5 NORTH_STAR tickets
  try {
    const step3 = readText(STEP3_YAML);
    requireIncludes(step3, 'sectionHeader: "## Partnership-Led Community Growth"', 'step-3 YAML');
    requireIncludes(step3, 'headerPresent: true', 'step-3 YAML');
    requireIncludes(step3, 'northStarTicketCount: 5', 'step-3 YAML');
    requireIncludes(step3, 'satisfied: true', 'step-3 YAML');

    const board = readText(BOARD_PATH);
    requireIncludes(board, '## Partnership-Led Community Growth', 'board.md');
    const nsCount = (board.match(/NORTH_STAR: Partnership-Led Community Growth/g) || []).length;
    if (nsCount < 3) {
      errors.push(
        `Condition (b) failed: expected at least 3 NORTH_STAR tickets under Partnership-Led section, found ${nsCount}`,
      );
    }
  } catch (err) {
    errors.push(`Condition (b) verification error: ${err.message}`);
  }

  // (c) No stale in-progress tickets older than 14 days left untreated
  try {
    const step4 = readText(STEP4_YAML);
    requireIncludes(step4, 'matchingTicketCount: 0', 'step-4 YAML');
    requireIncludes(step4, 'statusChangesApplied: 0', 'step-4 YAML');
  } catch (err) {
    errors.push(`Condition (c) verification error: ${err.message}`);
  }

  if (errors.length > 0) {
    console.error('KANBAN_STEP5_VERIFICATION: FAILED');
    for (const e of errors) {
      console.error(' -', e);
    }
    process.exit(1);
  } else {
    console.log('KANBAN_STEP5_VERIFICATION: OK');
    console.log(' - Blocked metadata guardrails satisfied (no blocked tickets present).');
    console.log(' - Partnership-Led Community Growth section present with >= 3 NORTH_STAR tickets.');
    console.log(' - No in-progress tickets older than 14 days left without deferral/backlog handling.');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}
