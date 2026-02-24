#!/usr/bin/env node

// enrichBlockedTicketsForStep2.js
// Step 2 helper: append BLOCKED_REASON and DEPENDENCY lines to any
// STATUS: BLOCKED tickets in project/kanban/board.md that are missing them.
// On the current board (2026-02-21), there are no STATUS: BLOCKED tickets,
// so this script performs no edits but serves as the mutation pipeline
// for when blocked tickets do appear.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BOARD_PATH = path.join(ROOT, 'project', 'kanban', 'board.md');

function main() {
  const raw = fs.readFileSync(BOARD_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);

  let changed = false;
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);

    if (!line.startsWith('STATUS:')) continue;

    const status = line.split('STATUS:')[1].trim();
    if (status.toUpperCase() !== 'BLOCKED') continue;

    // Scan ahead within this ticket block for BLOCKED_REASON and DEPENDENCY
    let hasBlockedReason = false;
    let hasDependency = false;
    let j = i + 1;
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (l.startsWith('STATUS:')) break; // next ticket block
      if (l.trim().startsWith('BLOCKED_REASON:')) hasBlockedReason = true;
      if (l.trim().startsWith('DEPENDENCY:')) hasDependency = true;
    }

    // If missing, append placeholder context lines immediately after this block
    const inserts = [];
    if (!hasBlockedReason) {
      inserts.push('BLOCKED_REASON: <add concrete reason referencing specific artifact(s)>');
    }
    if (!hasDependency) {
      inserts.push('DEPENDENCY: <add concrete dependency such as api/partners/onboard.ts or web/app/partners/dashboard.tsx>');
    }

    if (inserts.length > 0) {
      changed = true;
      // Insert just before the next STATUS: or end of file; since we've already
      // pushed current line, we push inserts here. The subsequent loop will
      // continue pushing original lines as normal.
      out.push(...inserts);
    }
  }

  if (changed) {
    fs.writeFileSync(BOARD_PATH, out.join('\n'), 'utf8');
    console.log('Step 2 enrichment applied: BLOCKED_REASON / DEPENDENCY added to one or more blocked tickets.');
  } else {
    console.log('Step 2 enrichment: no STATUS: BLOCKED tickets found; no changes made.');
  }
}

if (require.main === module) {
  main();
}
