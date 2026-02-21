#!/usr/bin/env node

// verifyKanbanStep5Checklist.js
// Lightweight verifier for Step 5 conditions against project/kanban/board.md
// Conditions:
//  (a) Every STATUS: BLOCKED ticket has BLOCKED_REASON and DEPENDENCY (vacuous when none)
//  (b) There is a `## Partnership-Led Community Growth` section with >= 3 NORTH_STAR tickets
//  (c) No STATUS: in-progress tickets older than 14 days remain

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BOARD_PATH = path.join(ROOT, 'project', 'kanban', 'board.md');

function parseDate(value) {
  // Expect YYYY-MM-DD
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function main() {
  const auditDate = new Date(Date.UTC(2026, 1, 21)); // 2026-02-21
  const cutoffMs = 14 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(auditDate.getTime() - cutoffMs);

  const raw = fs.readFileSync(BOARD_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);

  let blockedCount = 0;
  let blockedMissingContext = 0;
  let inProgressTickets = [];
  let partnershipSectionPresent = false;
  let northStarTicketCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      if (line.trim() === '## Partnership-Led Community Growth') {
        partnershipSectionPresent = true;
      }
    }

    if (line.startsWith('STATUS:')) {
      const status = line.split('STATUS:')[1].trim();

      if (status.toUpperCase() === 'BLOCKED') {
        blockedCount++;
        // look ahead for BLOCKED_REASON and DEPENDENCY within next ~12 lines of this ticket block
        let hasBlockedReason = false;
        let hasDependency = false;
        for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
          const l = lines[j].trim();
          if (l.startsWith('STATUS:')) break; // next ticket
          if (l.startsWith('BLOCKED_REASON:')) hasBlockedReason = true;
          if (l.startsWith('DEPENDENCY:')) hasDependency = true;
        }
        if (!hasBlockedReason || !hasDependency) {
          blockedMissingContext++;
        }
      }

      if (status.toLowerCase() === 'in-progress') {
        // capture UPDATED_AT for this in-progress ticket
        let updatedAt = null;
        for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
          const l = lines[j].trim();
          if (l.startsWith('STATUS:')) break; // next ticket
          if (l.startsWith('UPDATED_AT:')) {
            updatedAt = l.split('UPDATED_AT:')[1].trim();
            break;
          }
        }
        inProgressTickets.push({ index: i + 1, statusLine: line.trim(), updatedAt });
      }
    }

    if (line.includes('NORTH_STAR:') && line.includes('Partnership-Led Community Growth')) {
      northStarTicketCount++;
    }
  }

  const staleInProgress = inProgressTickets.filter(t => {
    if (!t.updatedAt) return false; // if missing date, ignore for now
    const dt = parseDate(t.updatedAt);
    if (!dt) return false;
    return dt < cutoffDate;
  });

  const result = {
    auditDate: auditDate.toISOString().slice(0, 10),
    boardFile: BOARD_PATH,
    cutoffDate: cutoffDate.toISOString().slice(0, 10),
    conditions: {
      a_blockedMetadata: {
        blockedTicketCount: blockedCount,
        blockedTicketsMissingMetadata: blockedMissingContext,
        satisfied: blockedCount === 0 || blockedMissingContext === 0
      },
      b_partnershipSection: {
        sectionPresent: partnershipSectionPresent,
        northStarTicketCount,
        satisfied: partnershipSectionPresent && northStarTicketCount >= 3
      },
      c_noStaleInProgress: {
        inProgressTicketCount: inProgressTickets.length,
        staleInProgressCount: staleInProgress.length,
        satisfied: staleInProgress.length === 0
      }
    }
  };

  result.allConditionsSatisfied =
    result.conditions.a_blockedMetadata.satisfied &&
    result.conditions.b_partnershipSection.satisfied &&
    result.conditions.c_noStaleInProgress.satisfied;

  // Print a concise summary for CI / scripts
  console.log('KANBAN_STEP5_CHECK');
  console.log(JSON.stringify(result, null, 2));

  // Exit non-zero if any condition fails
  if (!result.allConditionsSatisfied) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
