#!/usr/bin/env node

// listBlockedAndInProgressOlderThan14.js
// Step 1 helper: enumerate all STATUS: BLOCKED or STATUS: in-progress tickets
// in project/kanban/board.md whose UPDATED_AT is older than 14 days

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BOARD_PATH = path.join(ROOT, 'project', 'kanban', 'board.md');

function parseDate(value) {
  const [y, m, d] = String(value).trim().split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function main() {
  const auditDate = new Date(Date.UTC(2026, 1, 21)); // 2026-02-21
  const cutoffMs = 14 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(auditDate.getTime() - cutoffMs); // 2026-02-07

  const raw = fs.readFileSync(BOARD_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);

  const matches = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('STATUS:')) continue;

    const status = line.split('STATUS:')[1].trim();
    if (status.toUpperCase() !== 'BLOCKED' && status.toLowerCase() !== 'in-progress') {
      continue;
    }

    // Look ahead within this ticket block for UPDATED_AT and title line
    let updatedAt = null;
    let title = null;
    // title assumed to be preceding markdown heading (### ...)
    for (let k = i - 1; k >= 0; k--) {
      const t = lines[k].trim();
      if (t.startsWith('### ')) {
        title = t.replace(/^###\s+/, '');
        break;
      }
      if (t.startsWith('## ')) break; // reached previous section
    }

    for (let j = i + 1; j < Math.min(lines.length, i + 16); j++) {
      const l = lines[j].trim();
      if (l.startsWith('STATUS:')) break; // next ticket block
      if (l.startsWith('UPDATED_AT:')) {
        updatedAt = l.split('UPDATED_AT:')[1].trim();
        break;
      }
    }

    const dt = updatedAt ? parseDate(updatedAt) : null;
    const isOlderThan14 = dt ? dt < cutoffDate : false;

    if (isOlderThan14) {
      matches.push({
        line: i + 1,
        status,
        updatedAt,
        title: title || '(no title found)'
      });
    }
  }

  const result = {
    auditDate: auditDate.toISOString().slice(0, 10),
    cutoffDate: cutoffDate.toISOString().slice(0, 10),
    boardFile: BOARD_PATH,
    matchCount: matches.length,
    matches
  };

  console.log('KANBAN_STEP1_LIST');
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}
