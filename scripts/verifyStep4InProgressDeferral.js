#!/usr/bin/env node

// verifyStep4InProgressDeferral.js
// Dedicated Step 4 checker: enumerate STATUS: in-progress tickets in
// project/kanban/board.md, compute age vs 14-day cutoff, and flag any
// that require deferral per Partnership-Led focus.

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

  const auditDateStr = process.env.KANBAN_AUDIT_DATE || '2026-02-21';
  const auditDate = parseDate(auditDateStr);
  const cutoffMs = 14 * 24 * 60 * 60 * 1000;

  const inProgress = [];

  for (const block of blocks) {
    if (!/STATUS:\s*in-progress/i.test(block)) continue;

    const updatedMatch = block.match(/UPDATED_AT:\s*(\d{4}-\d{2}-\d{2})/);
    const updatedAtStr = updatedMatch ? updatedMatch[1] : null;
    const updatedAt = updatedAtStr ? parseDate(updatedAtStr) : null;

    let ageDays = null;
    let isOlderThanCutoff = false;
    if (updatedAt) {
      const ageMs = auditDate - updatedAt;
      ageDays = ageMs / (24 * 60 * 60 * 1000);
      isOlderThanCutoff = ageMs > cutoffMs;
    }

    // Very simple partnership-related heuristic: if the block mentions
    // "Partnership-Led Community Growth" or files we know are in the
    // partnership system, treat it as touching partnership artifacts.
    const touchesPartnership = /Partnership-Led Community Growth|partners\/onboard|partners\/dashboard|partnerPlaybook|BrandCampaignBanner/i.test(block);

    const needsDeferral = isOlderThanCutoff && !touchesPartnership;

    inProgress.push({
      updatedAt: updatedAtStr,
      ageDays,
      isOlderThanCutoff,
      touchesPartnership,
      needsDeferral,
      preview: block.substring(0, 200).replace(/\n/g, ' '),
    });
  }

  const needingDeferral = inProgress.filter(b => b.needsDeferral);

  const result = {
    boardPath: BOARD_PATH,
    auditDate: auditDateStr,
    cutoffDays: 14,
    inProgressCount: inProgress.length,
    needingDeferralCount: needingDeferral.length,
    inProgress,
  };

  console.log('KANBAN_STEP4_VERIFY_IN_PROGRESS');
  console.log(JSON.stringify(result, null, 2));

  if (needingDeferral.length > 0) {
    process.exitCode = 1;
  }
}

main();
