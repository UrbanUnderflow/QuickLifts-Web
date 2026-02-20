#!/usr/bin/env node

/**
 * Scan project/kanban/board.md for:
 * - STATUS: BLOCKED tickets
 * - STATUS: in-progress tickets with UPDATED_AT older than 14 days
 *
 * Writes a short report to stdout and can be used by other agents as a
 * single-source diagnostic instead of ad-hoc greps.
 */

const fs = require('fs');
const path = require('path');

const BOARD_PATH = path.join(__dirname, '..', 'project', 'kanban', 'board.md');
const CUTOFF_DAYS = 14;

function main() {
  if (!fs.existsSync(BOARD_PATH)) {
    console.error(`❌ Board file not found: ${BOARD_PATH}`);
    process.exit(1);
  }

  const text = fs.readFileSync(BOARD_PATH, 'utf8');
  const blocks = text.split(/\n(?=### )/); // each block starts with ###

  const cutoffDate = new Date(Date.now() - CUTOFF_DAYS * 24 * 60 * 60 * 1000);

  const blocked = [];
  const staleInProgress = [];

  for (const block of blocks) {
    const header = block.split('\n')[0];
    if (!header.startsWith('### ')) continue;

    const statusMatch = block.match(/STATUS:\s*(.+)/);
    const updatedAtMatch = block.match(/UPDATED_AT:\s*(\d{4}-\d{2}-\d{2})/);

    const status = statusMatch ? statusMatch[1].trim() : '';
    const updatedAt = updatedAtMatch ? new Date(updatedAtMatch[1]) : null;

    if (status.toUpperCase() === 'BLOCKED') {
      blocked.push({ header, updatedAt });
    }

    if (status === 'in-progress' && updatedAt && updatedAt < cutoffDate) {
      staleInProgress.push({ header, updatedAt });
    }
  }

  console.log('KANBAN_SCAN_RESULT');
  console.log(`BOARD: ${BOARD_PATH}`);
  console.log(`CUTOFF_DAYS: ${CUTOFF_DAYS}`);
  console.log(`BLOCKED_COUNT: ${blocked.length}`);
  console.log(`STALE_IN_PROGRESS_COUNT: ${staleInProgress.length}`);

  if (blocked.length) {
    console.log('\nBLOCKED_TICKETS:');
    for (const { header, updatedAt } of blocked) {
      console.log(`- ${header} (UPDATED_AT: ${updatedAt ? updatedAt.toISOString().slice(0,10) : 'N/A'})`);
    }
  }

  if (staleInProgress.length) {
    console.log('\nSTALE_IN_PROGRESS_TICKETS:');
    for (const { header, updatedAt } of staleInProgress) {
      console.log(`- ${header} (UPDATED_AT: ${updatedAt.toISOString().slice(0,10)})`);
    }
  }
}

main();
