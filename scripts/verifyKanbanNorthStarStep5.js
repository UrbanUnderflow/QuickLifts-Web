#!/usr/bin/env node

// verifyKanbanNorthStarStep5.js
// Programmatic verification for Step 5 of the Partnership-Led kanban alignment task.

const fs = require('fs');
const path = require('path');

const BOARD_PATH = path.join(__dirname, '..', 'project', 'kanban', 'board.md');

function readBoard() {
  return fs.readFileSync(BOARD_PATH, 'utf8');
}

function verifyBlockedMetadata(board) {
  const blockedRegex = /STATUS:\s*BLOCKED/gi;
  const hasBlocked = blockedRegex.test(board);

  if (!hasBlocked) {
    return {
      hasBlocked: false,
      allHaveMetadata: true,
      details: 'No STATUS: BLOCKED tickets present in board.md; metadata requirement vacuously satisfied.'
    };
  }

  // If blocked tickets ever exist, enforce that they have BLOCKED_REASON and DEPENDENCY lines.
  const blocks = board.split(/\n\n+/);
  let missing = [];
  for (const block of blocks) {
    if (block.includes('STATUS: BLOCKED')) {
      const hasReason = /BLOCKED_REASON:/i.test(block);
      const hasDep = /DEPENDENCY:/i.test(block);
      if (!hasReason || !hasDep) {
        missing.push(block.substring(0, 120).replace(/\n/g, ' '));
      }
    }
  }

  return {
    hasBlocked: true,
    allHaveMetadata: missing.length === 0,
    details: missing.length === 0
      ? 'All STATUS: BLOCKED tickets have BLOCKED_REASON and DEPENDENCY.'
      : `Blocked tickets missing metadata (first 120 chars):\n- ${missing.join('\n- ')}`
  };
}

function verifyPartnershipSection(board) {
  const sectionIndex = board.indexOf('## Partnership-Led Community Growth');
  if (sectionIndex === -1) {
    return {
      hasSection: false,
      ticketCount: 0,
      northStarTicketCount: 0,
      details: 'Partnership-Led section not found.'
    };
  }

  // Grab everything from section header down to the next top-level heading or end of file.
  const rest = board.slice(sectionIndex);
  const nextHeaderIndex = rest.indexOf('\n## ');
  const section = nextHeaderIndex === -1 ? rest : rest.slice(0, nextHeaderIndex);

  const ticketBlocks = section.split(/\n\n+/).filter(b => b.startsWith('### '));
  const northStarTickets = ticketBlocks.filter(b => /NORTH_STAR:\s*Partnership-Led Community Growth/i.test(b));

  return {
    hasSection: true,
    ticketCount: ticketBlocks.length,
    northStarTicketCount: northStarTickets.length,
    details: `Found Partnership-Led section with ${ticketBlocks.length} tickets; ${northStarTickets.length} tagged with NORTH_STAR: Partnership-Led Community Growth.`
  };
}

function parseDate(str) {
  // Expect YYYY-MM-DD
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function verifyStaleInProgress(board) {
  const blocks = board.split(/\n\n+/);
  const inProgress = blocks.filter(b => /STATUS:\s*in-progress/i.test(b));

  // Use current audit date from environment if provided, else default to 2026-02-21 as per task context.
  const auditDateStr = process.env.KANBAN_AUDIT_DATE || '2026-02-21';
  const auditDate = parseDate(auditDateStr);
  const cutoffMs = 14 * 24 * 60 * 60 * 1000;

  const stale = [];

  for (const block of inProgress) {
    const updatedMatch = block.match(/UPDATED_AT:\s*(\d{4}-\d{2}-\d{2})/);
    if (!updatedMatch) continue;
    const updatedAt = parseDate(updatedMatch[1]);
    if (!updatedAt) continue;
    const ageMs = auditDate - updatedAt;
    if (ageMs > cutoffMs) {
      // stale candidate
      stale.push(block.substring(0, 160).replace(/\n/g, ' '));
    }
  }

  return {
    inProgressCount: inProgress.length,
    staleCount: stale.length,
    details: stale.length === 0
      ? 'No STATUS: in-progress tickets older than 14 days.'
      : `Stale in-progress tickets (>14 days) detected (first 160 chars):\n- ${stale.join('\n- ')}`
  };
}

function main() {
  const board = readBoard();
  const blocked = verifyBlockedMetadata(board);
  const partnership = verifyPartnershipSection(board);
  const stale = verifyStaleInProgress(board);

  const summary = {
    boardPath: BOARD_PATH,
    blocked,
    partnership,
    staleInProgress: stale,
  };

  console.log('KANBAN_STEP5_VERIFICATION');
  console.log(JSON.stringify(summary, null, 2));

  const ok = (!blocked.hasBlocked || blocked.allHaveMetadata)
    && partnership.hasSection
    && partnership.northStarTicketCount >= 3
    && stale.staleCount === 0;

  if (!ok) {
    process.exitCode = 1;
  }
}

main();
