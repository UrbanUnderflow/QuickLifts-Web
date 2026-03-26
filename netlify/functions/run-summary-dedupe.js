const DEFAULT_OVERLAP_THRESHOLD_MINUTES = 10;

function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
}

function toMillis(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return value > 1e12 ? value : value * 1000;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : null;
  }

  if (typeof value.seconds === 'number') {
    const seconds = value.seconds * 1000;
    const nanos = typeof value.nanoseconds === 'number' ? Math.round(value.nanoseconds / 1e6) : 0;
    return seconds + nanos;
  }

  return null;
}

function normalizeWindow(summary) {
  if (!summary) return null;

  const startMs = toMillis(summary.startTime) || toMillis(summary.createdAt) || null;
  const endMsFromCompletedAt = toMillis(summary.completedAt);
  const durationSeconds = numberValue(summary.duration);

  let endMs = endMsFromCompletedAt;
  if (!endMs && startMs !== null && durationSeconds !== null) {
    endMs = startMs + durationSeconds * 1000;
  }

  if (startMs === null || endMs === null || endMs <= startMs) {
    return null;
  }

  return {
    startMs,
    endMs,
    durationMs: endMs - startMs,
  };
}

function getRunOverlap(existingSummary, candidateSummary) {
  const existingWindow = normalizeWindow(existingSummary);
  const candidateWindow = normalizeWindow(candidateSummary);

  if (!existingWindow || !candidateWindow) {
    return null;
  }

  const overlapMs = Math.min(existingWindow.endMs, candidateWindow.endMs) - Math.max(existingWindow.startMs, candidateWindow.startMs);
  if (overlapMs <= 0) {
    return null;
  }

  return {
    existingWindow,
    candidateWindow,
    overlapMs,
    overlapMinutes: overlapMs / 60000,
    startDeltaMinutes: Math.abs(existingWindow.startMs - candidateWindow.startMs) / 60000,
    endDeltaMinutes: Math.abs(existingWindow.endMs - candidateWindow.endMs) / 60000,
    shorterDurationMinutes: Math.min(existingWindow.durationMs, candidateWindow.durationMs) / 60000,
  };
}

function looksLikeSameRun(existingSummary, candidateSummary, options = {}) {
  if (!existingSummary || !candidateSummary) return false;

  const identityKeys = options.identityKeys || ['sourceSessionId', 'dedupeKey', 'sourceEventId', 'sourceWorkoutId'];
  for (const key of identityKeys) {
    const left = String(existingSummary?.[key] || '').trim();
    const right = String(candidateSummary?.[key] || '').trim();
    if (left && right && left === right) {
      return true;
    }
  }

  const overlap = getRunOverlap(existingSummary, candidateSummary);
  if (!overlap) return false;

  if (
    overlap.overlapMinutes >= DEFAULT_OVERLAP_THRESHOLD_MINUTES &&
    overlap.overlapMinutes >= overlap.shorterDurationMinutes * 0.5
  ) {
    return true;
  }

  return overlap.startDeltaMinutes <= DEFAULT_OVERLAP_THRESHOLD_MINUTES &&
    overlap.endDeltaMinutes <= DEFAULT_OVERLAP_THRESHOLD_MINUTES;
}

function runSummaryQualityScore(summary) {
  const durationSeconds = numberValue(summary?.duration) || 0;
  const distanceMiles = numberValue(summary?.distance) || 0;
  const routeCoordinateCount = Array.isArray(summary?.routeCoordinates) ? summary.routeCoordinates.length : 0;
  const photoBonus = summary?.treadmillPhotoURL ? 5000 : 0;
  const intervalBonus = numberValue(summary?.completedIntervals) || 0;
  const ratingBonus = summary?.workoutRating ? 250 : 0;
  const sourceBonus = summary?.sourceFamily === 'pulse_app' ? 1000 : 0;

  return Math.round(
    durationSeconds +
      (distanceMiles * 3000) +
      (routeCoordinateCount * 100) +
      photoBonus +
      (intervalBonus * 60) +
      ratingBonus +
      sourceBonus
  );
}

function pickPreferredRunSummary(existingSummary, incomingSummary) {
  if (!existingSummary) return incomingSummary || null;
  if (!incomingSummary) return existingSummary;

  const existingScore = runSummaryQualityScore(existingSummary);
  const incomingScore = runSummaryQualityScore(incomingSummary);

  if (incomingScore > existingScore) {
    return incomingSummary;
  }

  if (incomingScore < existingScore) {
    return existingSummary;
  }

  const existingUpdatedAt = toMillis(existingSummary.updatedAt) || 0;
  const incomingUpdatedAt = toMillis(incomingSummary.updatedAt) || 0;
  if (incomingUpdatedAt > existingUpdatedAt) {
    return incomingSummary;
  }

  return existingSummary;
}

function dedupeRunSummaries(runSummaries) {
  const deduped = [];

  for (const summary of runSummaries || []) {
    if (!summary) continue;

    const matchIndex = deduped.findIndex((existing) => looksLikeSameRun(existing, summary));
    if (matchIndex === -1) {
      deduped.push(summary);
      continue;
    }

    deduped[matchIndex] = pickPreferredRunSummary(deduped[matchIndex], summary);
  }

  return deduped;
}

function findMatchingRunSummary(runSummaries, candidateSummary) {
  const matches = (runSummaries || []).filter((summary) => looksLikeSameRun(summary, candidateSummary));
  if (matches.length === 0) return null;

  return matches.reduce((preferred, summary) => pickPreferredRunSummary(preferred, summary), null);
}

function buildRunSummaryFingerprint(summary) {
  const startMs = toMillis(summary?.startTime);
  const completedMs = toMillis(summary?.completedAt);
  const durationSeconds = numberValue(summary?.duration);
  const roundedStart = startMs ? Math.round(startMs / 60000) : 'na';
  const roundedEnd = completedMs ? Math.round(completedMs / 60000) : 'na';
  const roundedDuration = durationSeconds !== null ? Math.round(durationSeconds / 60) : 'na';
  const sourceToken = String(summary?.sourceSessionId || summary?.dedupeKey || summary?.sourceEventId || '').trim() || 'na';
  return uniqueStrings([
    String(summary?.userId || '').trim(),
    String(summary?.runType || '').trim(),
    String(summary?.location || '').trim(),
    String(summary?.roundId || '').trim(),
    String(roundedStart),
    String(roundedEnd),
    String(roundedDuration),
    sourceToken,
  ]).join('|');
}

module.exports = {
  buildRunSummaryFingerprint,
  dedupeRunSummaries,
  findMatchingRunSummary,
  looksLikeSameRun,
  normalizeWindow,
  pickPreferredRunSummary,
  runSummaryQualityScore,
  toMillis,
};
