#!/usr/bin/env node

// enumerateBlockedAndInProgressOlderThan14Step1.js
// Standalone Step 1 verifier that parses project/kanban/board.md directly
// (without relying on prior JSON/CSV artifacts) and enumerates all tickets
// where:
//   - STATUS is BLOCKED or IN_PROGRESS / in-progress, and
//   - UPDATED_AT is older than 14 days relative to a given audit date.
//
// For the 2026-02-21 audit, the cutoff date is 2026-02-07.
//
// It prints a JSON blob to stdout and can optionally write it to
// docs/deliverables/kanban-step1-enumeration-older14-live.json if desired.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BOARD_PATH = path.join(ROOT, 'project', 'kanban', 'board.md');

// Hard-code the audit date for this run; could be parameterized later.
const AUDIT_DATE_STR = '2026-02-21';
const CUTOFF_DAYS = 14;

function toDate(str) {
  // Expect YYYY-MM-DD; fall back to NaN if it doesn't parse.
  const parts = str.trim().split('-');
  if (parts.length !== 3) return new Date('invalid');
  const [y, m, d] = parts.map((p) => parseInt(p, 10));
  return new Date(y, m - 1, d);
}

function main() {
  const auditDate = toDate(AUDIT_DATE_STR);
  const cutoffMs = auditDate.getTime() - CUTOFF_DAYS * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(cutoffMs);

  const raw = fs.readFileSync(BOARD_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);

  const tickets = [];
  let current = [];

  // Simple ticket segmentation: separate on blank lines and section headers.
  for (const line of lines) {
    if (line.trim() === '' || line.startsWith('## ')) {
      if (current.length > 0) {
        tickets.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) tickets.push(current);

  const matches = [];

  for (const block of tickets) {
    let status = null;
    let updatedAtStr = null;
    let assignee = null;
    let title = null;

    for (const line of block) {
      if (line.startsWith('### ')) {
        title = line.replace(/^###\s+/, '').trim();
      } else if (line.startsWith('STATUS:')) {
        status = line.split('STATUS:')[1].trim();
      } else if (line.startsWith('UPDATED_AT:')) {
        updatedAtStr = line.split('UPDATED_AT:')[1].trim();
      } else if (line.startsWith('ASSIGNEE:')) {
        assignee = line.split('ASSIGNEE:')[1].trim();
      }
    }

    if (!status || !updatedAtStr) continue;

    const statusUpper = status.toUpperCase();
    if (statusUpper !== 'BLOCKED' && statusUpper !== 'IN_PROGRESS' && statusUpper !== 'IN-PROGRESS') {
      continue;
    }

    const updatedAt = toDate(updatedAtStr);
    if (Number.isNaN(updatedAt.getTime())) continue;

    const isOlderThanCutoff = updatedAt.getTime() < cutoffMs;
    if (isOlderThanCutoff) {
      matches.push({
        title,
        status,
        assignee,
        updated_at: updatedAtStr,
        cutoffDate: cutoffDate.toISOString().slice(0, 10),
      });
    }
  }

  const result = {
    auditDate: AUDIT_DATE_STR,
    cutoffDays: CUTOFF_DAYS,
    cutoffDate: cutoffDate.toISOString().slice(0, 10),
    matchCount: matches.length,
    matches,
  };

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}
