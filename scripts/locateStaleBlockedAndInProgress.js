#!/usr/bin/env node

// locateStaleBlockedAndInProgress.js
// Step 1 helper: programmatically locate all STATUS: BLOCKED or STATUS: in-progress
// tickets in project/kanban/board.md whose UPDATED_AT is older than 14 days.

const fs = require('fs');
const path = require('path');

const BOARD_PATH = path.join(__dirname, '..', 'project', 'kanban', 'board.md');

function parseDate(str) {
  const [y, m, d] = (str || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function main() {
  const board = fs.readFileSync(BOARD_PATH, 'utf8');
  const blocks = board.split(/\n\n+/);

  const nowStr = process.env.KANBAN_AUDIT_DATE || '2026-02-21';
  const now = parseDate(nowStr);
  const cutoffMs = 14 * 24 * 60 * 60 * 1000;

  const matches = [];

  for (const block of blocks) {
    const hasBlocked = /STATUS:\s*BLOCKED/i.test(block);
    const hasInProgress = /STATUS:\s*in-progress/i.test(block);
    if (!hasBlocked && !hasInProgress) continue;

    const updatedMatch = block.match(/UPDATED_AT:\s*(\d{4}-\d{2}-\d{2})/);
    if (!updatedMatch) continue;
    const updated = parseDate(updatedMatch[1]);
    if (!updated) continue;

    const ageMs = now - updated;
    if (ageMs > cutoffMs) {
      matches.push({
        status: hasBlocked ? 'BLOCKED' : 'IN_PROGRESS',
        updatedAt: updatedMatch[1],
        preview: block.substring(0, 200).replace(/\n/g, ' ')
      });
    }
  }

  console.log('KANBAN_STEP1_LOCATE');
  console.log(JSON.stringify({
    boardPath: BOARD_PATH,
    auditDate: nowStr,
    cutoffDays: 14,
    matchCount: matches.length,
    matches,
  }, null, 2));
}

main();
