#!/usr/bin/env node

// checkBlockedTicketContext.js
// Step 2 helper: ensure every STATUS: BLOCKED ticket in project/kanban/board.md
// has BLOCKED_REASON and DEPENDENCY lines. Reports an empty result set when
// there are no blocked tickets.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BOARD_PATH = path.join(ROOT, 'project', 'kanban', 'board.md');

function main() {
  const raw = fs.readFileSync(BOARD_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);

  const blocked = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('STATUS:')) continue;

    const status = line.split('STATUS:')[1].trim();
    if (status.toUpperCase() !== 'BLOCKED') continue;

    // Find nearest heading above for title
    let title = null;
    for (let k = i - 1; k >= 0; k--) {
      const t = lines[k].trim();
      if (t.startsWith('### ')) {
        title = t.replace(/^###\s+/, '');
        break;
      }
      if (t.startsWith('## ')) break;
    }

    let hasBlockedReason = false;
    let hasDependency = false;

    for (let j = i + 1; j < Math.min(lines.length, i + 16); j++) {
      const l = lines[j].trim();
      if (l.startsWith('STATUS:')) break; // next ticket
      if (l.startsWith('BLOCKED_REASON:')) hasBlockedReason = true;
      if (l.startsWith('DEPENDENCY:')) hasDependency = true;
    }

    blocked.push({
      line: i + 1,
      title: title || '(no title found)',
      hasBlockedReason,
      hasDependency
    });
  }

  const missingContext = blocked.filter(b => !b.hasBlockedReason || !b.hasDependency);

  const result = {
    boardFile: BOARD_PATH,
    blockedTicketCount: blocked.length,
    blockedMissingContextCount: missingContext.length,
    blockedMissingContext: missingContext
  };

  console.log('KANBAN_STEP2_CHECK');
  console.log(JSON.stringify(result, null, 2));

  // exit non-zero if any blocked ticket is missing context
  if (missingContext.length > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
