#!/usr/bin/env node

/**
 * Ensure that every STATUS: BLOCKED ticket in project/kanban/board.md
 * has BLOCKED_REASON: and DEPENDENCY: lines present.
 *
 * This is a file-level guardrail around the canonical markdown export
 * so agents and scripts can rely on blocked tickets always carrying
 * explicit unblock context.
 */

const fs = require('fs');
const path = require('path');

const BOARD_PATH = path.join(__dirname, '..', 'project', 'kanban', 'board.md');

function enforceBlockedMetadataOnBoard() {
  if (!fs.existsSync(BOARD_PATH)) {
    console.error(`❌ Kanban board not found at ${BOARD_PATH}`);
    process.exit(1);
  }

  const original = fs.readFileSync(BOARD_PATH, 'utf8');
  const lines = original.split(/\r?\n/);

  const UPDATED_LINES = [];
  let i = 0;
  let changes = 0;

  while (i < lines.length) {
    const line = lines[i];
    UPDATED_LINES.push(line);

    // Block header: "### ... [id]"
    if (line.startsWith('### ')) {
      // Look ahead for STATUS: line and detect BLOCKED tickets
      let j = i + 1;
      let isBlocked = false;
      let statusLineIndex = -1;
      let blockEndIndex = lines.length;

      for (let k = i + 1; k < lines.length; k++) {
        const l = lines[k];
        if (l.startsWith('### ')) {
          blockEndIndex = k;
          break;
        }
      }

      for (let k = i + 1; k < blockEndIndex; k++) {
        const l = lines[k];
        if (l.toUpperCase().startsWith('STATUS:')) {
          statusLineIndex = k;
          const statusVal = l.slice('STATUS:'.length).trim().toUpperCase();
          if (statusVal === 'BLOCKED') {
            isBlocked = true;
          }
          break;
        }
      }

      if (isBlocked) {
        let hasBlockedReason = false;
        let hasDependency = false;

        for (let k = i + 1; k < blockEndIndex; k++) {
          const l = lines[k];
          if (l.startsWith('BLOCKED_REASON:')) hasBlockedReason = true;
          if (l.startsWith('DEPENDENCY:')) hasDependency = true;
        }

        // Inject missing lines just before the blank line that ends the block
        const insertionIndex = blockEndIndex; // index of next header or EOF

        const extraLines = [];
        if (!hasBlockedReason) {
          extraLines.push('BLOCKED_REASON: <fill in specific blocker, e.g., waiting on partner asset or missing API>');
        }
        if (!hasDependency) {
          extraLines.push('DEPENDENCY: <reference to file/api/partner input, e.g., src/pages/api/partners/onboard.ts>');
        }

        if (extraLines.length > 0) {
          UPDATED_LINES.push(...lines.slice(i + 1, blockEndIndex));
          UPDATED_LINES.push(...extraLines);
          changes += extraLines.length;
          i = blockEndIndex - 1; // -1 because loop will ++i
        }
      }
    }

    i++;
  }

  if (changes === 0) {
    console.log('✅ No STATUS: BLOCKED tickets found or all already have BLOCKED_REASON/DEPENDENCY. No changes made.');
    return;
  }

  fs.writeFileSync(BOARD_PATH, UPDATED_LINES.join('\n'), 'utf8');
  console.log(`✅ Updated ${BOARD_PATH} with ${changes} new metadata line(s) for blocked tickets.`);
}

enforceBlockedMetadataOnBoard();
