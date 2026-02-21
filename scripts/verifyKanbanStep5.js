#!/usr/bin/env node

// verifyKanbanStep5.js
// Consolidated verifier for Step 5 conditions on project/kanban/board.md:
// (a) BLOCKED tickets have BLOCKED_REASON + DEPENDENCY
// (b) Partnership-Led section with >=3 concrete NORTH_STAR tickets
// (c) No stale STATUS: in-progress tickets older than 14 days

const fs = require('fs');
const path = require('path');

const BOARD_PATH = path.join(__dirname, '..', 'project', 'kanban', 'board.md');

function parseDate(str) {
  const [y, m, d] = (str || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function verifyBlocked(board) {
  const blocks = board.split(/\n\n+/);
  const blocked = [];
  for (const block of blocks) {
    if (!/STATUS:\s*BLOCKED/i.test(block)) continue;
    const hasReason = /BLOCKED_REASON:/i.test(block);
    const hasDep = /DEPENDENCY:/i.test(block);
    blocked.push({
      hasReason,
      hasDependency: hasDep,
      preview: block.substring(0, 160).replace(/\n/g, ' '),
    });
  }
  const allHaveMetadata = blocked.every(b => b.hasReason && b.hasDependency);
  return {
    blockedCount: blocked.length,
    allHaveMetadata,
    blocked,
  };
}

function verifyPartnershipSection(board) {
  const idx = board.indexOf('## Partnership-Led Community Growth');
  if (idx === -1) {
    return {
      hasSection: false,
      ticketCount: 0,
      northStarTicketCount: 0,
      tickets: [],
    };
  }
  const rest = board.slice(idx);
  const next = rest.indexOf('\n## ');
  const section = next === -1 ? rest : rest.slice(0, next);

  const ticketBlocks = section.split(/\n\n+/).filter(b => b.trim().startsWith('### '));
  const northStarTickets = ticketBlocks.filter(b => /NORTH_STAR:\s*Partnership-Led Community Growth/i.test(b));

  return {
    hasSection: true,
    ticketCount: ticketBlocks.length,
    northStarTicketCount: northStarTickets.length,
    tickets: northStarTickets.map(b => b.substring(0, 200).replace(/\n/g, ' ')),
  };
}

function verifyStaleInProgress(board) {
  const blocks = board.split(/\n\n+/);
  const auditDateStr = process.env.KANBAN_AUDIT_DATE || '2026-02-21';
  const auditDate = parseDate(auditDateStr);
  const cutoffMs = 14 * 24 * 60 * 60 * 1000;

  const inProgress = [];
  for (const block of blocks) {
    if (!/STATUS:\s*in-progress/i.test(block)) continue;
    const updatedMatch = block.match(/UPDATED_AT:\s*(\d{4}-\d{2}-\d{2})/);
    const updatedStr = updatedMatch ? updatedMatch[1] : null;
    const updatedAt = updatedStr ? parseDate(updatedStr) : null;

    let ageDays = null;
    let isStale = false;
    if (updatedAt) {
      const ageMs = auditDate - updatedAt;
      ageDays = ageMs / (24 * 60 * 60 * 1000);
      isStale = ageMs > cutoffMs;
    }

    inProgress.push({
      updatedAt: updatedStr,
      ageDays,
      isStale,
      preview: block.substring(0, 200).replace(/\n/g, ' '),
    });
  }

  const stale = inProgress.filter(b => b.isStale);
  return {
    auditDate: auditDateStr,
    cutoffDays: 14,
    inProgressCount: inProgress.length,
    staleCount: stale.length,
    stale,
  };
}

function main() {
  const board = fs.readFileSync(BOARD_PATH, 'utf8');

  const blocked = verifyBlocked(board);
  const partnership = verifyPartnershipSection(board);
  const stale = verifyStaleInProgress(board);

  const summary = {
    boardPath: BOARD_PATH,
    blocked,
    partnership,
    staleInProgress: stale,
  };

  console.log('KANBAN_STEP5_VERIFY');
  console.log(JSON.stringify(summary, null, 2));

  const ok = (
    // (a) no blocked tickets missing metadata
    (blocked.blockedCount === 0 || blocked.allHaveMetadata) &&
    // (b) Partnership-Led section with >=3 North-Star tickets
    partnership.hasSection && partnership.northStarTicketCount >= 3 &&
    // (c) no stale in-progress tickets
    stale.staleCount === 0
  );

  if (!ok) {
    process.exitCode = 1;
  }
}

main();
