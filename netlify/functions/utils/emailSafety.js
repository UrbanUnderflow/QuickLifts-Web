const DEFAULT_EMAIL_LOCK_STALE_MS = 2 * 60 * 60 * 1000;

function normalizeDedupePart(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase()
    : String(value).trim().toLowerCase();

  // Firestore document IDs cannot contain forward slashes. Some email flows
  // intentionally use URLs inside dedupe keys, so normalize them here.
  return normalized.replace(/\//g, '%2f');
}

function buildEmailDedupeKey(parts) {
  return (Array.isArray(parts) ? parts : []).map(normalizeDedupePart).filter(Boolean).join('::');
}

function normalizeEmailAddress(email) {
  return String(email || '').trim().toLowerCase();
}

function getUtcDateKey(value) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = safeDate.getUTCFullYear();
  const month = String(safeDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildRecipientDailyQuotaKey(args = {}) {
  return buildEmailDedupeKey([
    normalizeEmailAddress(args.toEmail),
    getUtcDateKey(args.scheduledAt),
  ]);
}

function toEpochMs(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (value > 1_000_000_000_000) return value;
    if (value > 1_000_000_000) return value * 1000;
    return null;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : null;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }
  return null;
}

function shouldBlockRecipientDailyQuota(args = {}) {
  const sentCount = Number(args.state?.sentCount || 0) || 0;
  const dailyLimit = Math.max(1, Number(args.dailyLimit || 1) || 1);

  if (sentCount >= dailyLimit) {
    return true;
  }

  const activeRunId = args.state?.runId;
  if (activeRunId && activeRunId !== args.runId) {
    const claimedAtMs = toEpochMs(args.state?.claimedAt);
    const staleMs = args.staleMs ?? DEFAULT_EMAIL_LOCK_STALE_MS;
    if (claimedAtMs !== null && args.nowMs - claimedAtMs < staleMs) {
      return true;
    }
  }

  return false;
}

function buildStreakMilestoneDedupeKey(args = {}) {
  return buildEmailDedupeKey([
    args.userId || args.email || args.docId || 'unknown-user',
    args.milestone,
  ]);
}

function readDocData(candidate) {
  if (!candidate) return {};
  if (typeof candidate.data === 'function') return candidate.data() || {};
  if (candidate.data && typeof candidate.data === 'object') return candidate.data;
  return candidate;
}

function findSiblingSentStreakMilestone(args = {}) {
  const key = String(args.milestone || '');
  if (!key) return null;

  for (const candidate of args.candidates || []) {
    if (!candidate) continue;
    if (candidate.id && args.currentDocId && candidate.id === args.currentDocId) {
      continue;
    }

    const data = readDocData(candidate);
    const state = data.emailSequenceState || {};
    const sentState = state.streakMilestonesSent || {};
    if (sentState[key]) {
      return {
        sourceDocId: candidate.id || null,
        sentAt: sentState[key],
      };
    }
  }

  return null;
}

module.exports = {
  DEFAULT_EMAIL_LOCK_STALE_MS,
  buildEmailDedupeKey,
  buildRecipientDailyQuotaKey,
  buildStreakMilestoneDedupeKey,
  findSiblingSentStreakMilestone,
  getUtcDateKey,
  normalizeEmailAddress,
  shouldBlockRecipientDailyQuota,
  toEpochMs,
};
