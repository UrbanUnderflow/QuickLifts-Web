#!/usr/bin/env node

// verifyBlockedTicketsForStep2.js
// Step 2 helper: programmatically inspect project/kanban/board.md
// for STATUS: BLOCKED tickets and whether they have BLOCKED_REASON and DEPENDENCY.

const fs = require('fs');
const path = require('path');

const BOARD_PATH = path.join(__dirname, '..', 'project', 'kanban', 'board.md');

function main() {
  const board = fs.readFileSync(BOARD_PATH, 'utf8');
  const blocks = board.split(/\n\n+/);

  const blockedSummaries = [];

  for (const block of blocks) {
    if (!/STATUS:\s*BLOCKED/i.test(block)) continue;

    const hasReason = /BLOCKED_REASON:/i.test(block);
    const hasDependency = /DEPENDENCY:/i.test(block);

    blockedSummaries.push({
      hasReason,
      hasDependency,
      preview: block.substring(0, 200).replace(/\n/g, ' '),
    });
  }

  const result = {
    boardPath: BOARD_PATH,
    blockedCount: blockedSummaries.length,
    blocked: blockedSummaries,
  };

  console.log('KANBAN_STEP2_VERIFY_BLOCKED');
  console.log(JSON.stringify(result, null, 2));

  // Non-zero exit if any blocked tickets are missing metadata
  if (blockedSummaries.some(b => !b.hasReason || !b.hasDependency)) {
    process.exitCode = 1;
  }
}

main();
