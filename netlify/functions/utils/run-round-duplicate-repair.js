const {
  looksLikeSameRun,
  normalizeWindow,
  pickPreferredRunSummary,
} = require('../run-summary-dedupe');

const REPAIRABLE_SOURCE_COLLECTIONS = [
  'runSummaries',
  'fatBurnSummaries',
  'appleWatchWorkoutSummaries',
];

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toSeconds(value) {
  if (!value) return null;

  if (typeof value === 'number') {
    return value > 1e12 ? value / 1000 : value;
  }

  if (value instanceof Date) {
    return value.getTime() / 1000;
  }

  if (typeof value.toDate === 'function') {
    const asDate = value.toDate();
    return asDate instanceof Date ? asDate.getTime() / 1000 : null;
  }

  if (typeof value.seconds === 'number') {
    return value.seconds;
  }

  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed / 1000;
}

function parseDeleteSources(value) {
  const values = Array.isArray(value) ? value : [value];
  const normalized = values
    .flatMap((entry) => String(entry || '').split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (normalized.includes('all')) {
    return [...REPAIRABLE_SOURCE_COLLECTIONS];
  }

  return Array.from(
    new Set(normalized.filter((entry) => REPAIRABLE_SOURCE_COLLECTIONS.includes(entry)))
  );
}

function inRange(timestamp, startDate, endDate) {
  if (!timestamp) return true;
  if (startDate !== null && timestamp < startDate) return false;
  if (endDate !== null && timestamp > endDate) return false;
  return true;
}

function safeString(value) {
  return typeof value === 'string' ? value : '';
}

async function resolveRoundDocument(db, challengeId) {
  const collections = ['sweatlist-collection', 'sweatlistCollections'];

  for (const collectionName of collections) {
    const ref = db.collection(collectionName).doc(challengeId);
    const snapshot = await ref.get();
    if (snapshot.exists) {
      return {
        ref,
        collectionName,
        data: snapshot.data() || {},
      };
    }
  }

  return null;
}

async function loadParticipants(db, challengeId, userId, username) {
  let query = db.collection('user-challenge').where('challengeId', '==', challengeId);

  if (userId) {
    query = query.where('userId', '==', userId);
  }

  const snapshot = await query.get();
  let participants = snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      challengeId: data.challengeId || challengeId,
      userId: data.userId || '',
      username: data.username || '',
    };
  });

  if (username) {
    const needle = username.trim().toLowerCase();
    participants = participants.filter((participant) => participant.username.trim().toLowerCase() === needle);
  }

  if (participants.length === 0 && userId) {
    participants = [{ id: '', challengeId, userId, username: username || '' }];
  }

  return participants;
}

function buildRunSummaryCandidate(doc, data, userId) {
  const createdAt = toSeconds(data.createdAt);
  const completedAt = toSeconds(data.completedAt);
  const startTime = toSeconds(data.startTime);
  const provenance = data.provenance || {};
  const primarySource = safeString(provenance.primarySource || data.primarySource);

  return {
    userId,
    runId: doc.id,
    sourceCollection: 'runSummaries',
    sourceDocId: doc.id,
    title: safeString(data.title),
    location: safeString(data.location || 'outdoor'),
    distance: numberOrNull(data.distance) || 0,
    duration: numberOrNull(data.duration) || 0,
    averagePace: numberOrNull(data.averagePace) || 0,
    startTime,
    completedAt,
    createdAt,
    updatedAt: toSeconds(data.updatedAt),
    primarySource,
    sourceFamily: 'pulse_app',
    raw: data,
  };
}

function buildFatBurnCandidate(doc, data, userId) {
  return {
    userId,
    runId: `treadmill-${doc.id}`,
    sourceCollection: 'fatBurnSummaries',
    sourceDocId: doc.id,
    title: safeString(data.title || 'Treadmill Run'),
    location: 'treadmill',
    distance: numberOrNull(data.distance) || 0,
    duration: numberOrNull(data.duration) || 0,
    averagePace: numberOrNull(data.averagePace) || 0,
    startTime: toSeconds(data.startTime),
    completedAt: toSeconds(data.completedAt),
    createdAt: toSeconds(data.createdAt),
    updatedAt: toSeconds(data.updatedAt),
    primarySource: safeString(data.calorieSource || 'machineDisplay'),
    sourceFamily: 'fatburn',
    raw: data,
  };
}

function buildAppleWatchCandidate(doc, data, userId) {
  const healthKitUUID = safeString(data.healthKitUUID);
  const runId = `hk-${healthKitUUID || doc.id}`;
  const distance = numberOrNull(data.distance) || 0;
  const duration = numberOrNull(data.duration) || 0;

  return {
    userId,
    runId,
    sourceCollection: 'appleWatchWorkoutSummaries',
    sourceDocId: doc.id,
    title: safeString(data.title || 'Outdoor Run'),
    location: 'outdoor',
    distance,
    duration,
    averagePace: distance > 0 && duration > 0 ? (duration / 60) / distance : 0,
    startTime: toSeconds(data.startTime),
    completedAt: toSeconds(data.endTime),
    createdAt: toSeconds(data.createdAt),
    updatedAt: toSeconds(data.updatedAt),
    primarySource: 'appleWatch',
    healthKitUUID,
    sourceFamily: 'apple_watch',
    raw: data,
  };
}

async function fetchRunCandidatesForUser(db, userId, options) {
  const { startDate, endDate, allowTreadmill } = options;
  const candidates = [];

  const runSummariesSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('runSummaries')
    .get();

  runSummariesSnapshot.forEach((doc) => {
    if (doc.id.startsWith('treadmill-')) {
      return;
    }
    const candidate = buildRunSummaryCandidate(doc, doc.data() || {}, userId);
    const runDate = candidate.completedAt || candidate.createdAt;
    if (inRange(runDate, startDate, endDate)) {
      candidates.push(candidate);
    }
  });

  if (allowTreadmill) {
    const fatBurnSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('fatBurnSummaries')
      .get();

    fatBurnSnapshot.forEach((doc) => {
      const data = doc.data() || {};
      if (safeString(data.equipment) !== 'treadmill') return;
      if ((numberOrNull(data.distance) || 0) <= 0) return;

      const candidate = buildFatBurnCandidate(doc, data, userId);
      const runDate = candidate.completedAt || candidate.createdAt;
      if (inRange(runDate, startDate, endDate)) {
        candidates.push(candidate);
      }
    });
  }

  const appleWatchSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('appleWatchWorkoutSummaries')
    .get();

  appleWatchSnapshot.forEach((doc) => {
    const data = doc.data() || {};
    const activityType = safeString(data.activityType).toLowerCase();
    if (!['walking', 'running'].includes(activityType)) return;
    if ((numberOrNull(data.distance) || 0) <= 0) return;

    const candidate = buildAppleWatchCandidate(doc, data, userId);
    const runDate = candidate.completedAt || candidate.createdAt;
    if (inRange(runDate, startDate, endDate)) {
      candidates.push(candidate);
    }
  });

  return candidates;
}

function pickPreferredWithSourcePriority(left, right) {
  const leftPriority = sourcePriority(left.sourceCollection);
  const rightPriority = sourcePriority(right.sourceCollection);

  if (leftPriority !== rightPriority) {
    return leftPriority < rightPriority ? left : right;
  }

  return pickPreferredRunSummary(left, right);
}

function sourcePriority(sourceCollection) {
  switch (sourceCollection) {
    case 'runSummaries':
      return 0;
    case 'fatBurnSummaries':
      return 1;
    case 'appleWatchWorkoutSummaries':
      return 2;
    default:
      return 99;
  }
}

function createDuplicateGroups(candidates) {
  const groups = [];

  for (const candidate of candidates) {
    const match = groups.find((group) => group.entries.some((entry) => looksLikeSameRun(entry, candidate)));
    if (!match) {
      groups.push({ entries: [candidate] });
      continue;
    }
    match.entries.push(candidate);
  }

  return groups.map((group, index) => {
    const preferred = group.entries.reduce((currentPreferred, entry) => {
      if (!currentPreferred) return entry;
      return pickPreferredWithSourcePriority(currentPreferred, entry);
    }, null);

    return {
      groupIndex: index + 1,
      preferred,
      entries: group.entries,
      duplicates: group.entries.filter((entry) => entry !== preferred),
    };
  });
}

function buildAuditDocId(entry) {
  return `${entry.userId}_${entry.runId}`
    .replace(/\//g, '_')
    .replace(/:/g, '_');
}

function buildDuplicateAudit(roundId, entry, preferred) {
  const window = normalizeWindow(entry);
  const preferredWindow = normalizeWindow(preferred);
  const details = [
    `Suppressed duplicate ${entry.sourceCollection}/${entry.sourceDocId} for round scoring.`,
    `Preferred source: ${preferred.sourceCollection}/${preferred.sourceDocId}.`,
  ];

  if (window && preferredWindow) {
    details.push(
      `Session windows overlapped (${Math.round(window.startMs / 1000)}-${Math.round(window.endMs / 1000)} vs ${Math.round(preferredWindow.startMs / 1000)}-${Math.round(preferredWindow.endMs / 1000)}).`
    );
  }

  return {
    runId: entry.runId,
    userId: entry.userId,
    roundId,
    isFlagged: true,
    shortReason: 'Duplicate run source suppressed for round scoring',
    reasonDetails: details,
    auditedAt: Date.now() / 1000,
    leaderboardExcluded: true,
    status: 'flagged',
    duplicateSourceCollection: entry.sourceCollection,
    duplicateSourceDocId: entry.sourceDocId,
    preferredSourceCollection: preferred.sourceCollection,
    preferredSourceDocId: preferred.sourceDocId,
  };
}

async function applyAudits(roundRef, groups) {
  const batch = roundRef.firestore.batch();
  let auditCount = 0;

  groups.forEach((group) => {
    group.duplicates.forEach((entry) => {
      const payload = buildDuplicateAudit(roundRef.id, entry, group.preferred);
      batch.set(
        roundRef.collection('runValidationAudits').doc(buildAuditDocId(entry)),
        payload,
        { merge: true }
      );
      auditCount += 1;
    });
  });

  if (auditCount > 0) {
    await batch.commit();
  }

  return auditCount;
}

async function applyDeletes(db, userId, groups, deleteSources) {
  const enabledSources = new Set(parseDeleteSources(deleteSources));
  const deletes = [];

  if (enabledSources.size === 0) {
    return 0;
  }

  groups.forEach((group) => {
    group.duplicates
      .filter((entry) => enabledSources.has(entry.sourceCollection))
      .forEach((entry) => {
        const docRef = db
          .collection('users')
          .doc(userId)
          .collection(entry.sourceCollection)
          .doc(entry.sourceDocId);

        deletes.push(docRef.delete());
      });
  });

  if (deletes.length > 0) {
    await Promise.all(deletes);
  }

  return deletes.length;
}

function summarizeEntry(entry) {
  return {
    runId: entry.runId,
    sourceCollection: entry.sourceCollection,
    sourceDocId: entry.sourceDocId,
    title: entry.title,
    distance: entry.distance,
    duration: entry.duration,
    startTime: entry.startTime,
    completedAt: entry.completedAt,
    primarySource: entry.primarySource,
  };
}

function summarizeGroups(groups) {
  return groups
    .filter((group) => group.duplicates.length > 0)
    .map((group) => ({
      groupIndex: group.groupIndex,
      preferred: summarizeEntry(group.preferred),
      suppressed: group.duplicates.map(summarizeEntry),
    }));
}

function createEmptyReport({
  challengeId,
  mode = 'prod',
  roundDocument = null,
  roundData = {},
  effectiveOptions = {},
}) {
  return {
    mode,
    challengeId,
    roundFound: Boolean(roundDocument),
    roundCollection: roundDocument?.collectionName || null,
    roundTitle: roundData.title || null,
    startDate: effectiveOptions.startDate ?? null,
    endDate: effectiveOptions.endDate ?? null,
    allowTreadmill: effectiveOptions.allowTreadmill ?? true,
    participantsProcessed: [],
    totalRawRuns: 0,
    totalDedupedRuns: 0,
    totalDuplicateGroups: 0,
    totalSuppressedRuns: 0,
    auditsWritten: 0,
    deletesApplied: 0,
  };
}

async function repairRunRoundDuplicates(db, options) {
  const roundDocument = await resolveRoundDocument(db, options.challengeId);
  const roundData = roundDocument?.data || {};
  const roundRef = roundDocument?.ref || null;
  const deleteSources = parseDeleteSources(options.deleteSources || options.deleteSource);

  const effectiveOptions = {
    ...options,
    startDate: options.startDate ?? toSeconds(roundData.challenge?.startDate),
    endDate: options.endDate ?? toSeconds(roundData.challenge?.endDate),
    allowTreadmill:
      typeof options.allowTreadmill === 'boolean'
        ? options.allowTreadmill
        : roundData.runRoundConfig?.allowTreadmill !== false,
  };

  const participants = await loadParticipants(
    db,
    options.challengeId,
    options.userId,
    options.username
  );

  const report = createEmptyReport({
    challengeId: options.challengeId,
    mode: options.mode || 'prod',
    roundDocument,
    roundData,
    effectiveOptions,
  });

  for (const participant of participants) {
    const candidates = await fetchRunCandidatesForUser(db, participant.userId, effectiveOptions);
    const groups = createDuplicateGroups(candidates);
    const duplicateGroups = groups.filter((group) => group.duplicates.length > 0);

    report.totalRawRuns += candidates.length;
    report.totalDedupedRuns += groups.length;
    report.totalDuplicateGroups += duplicateGroups.length;
    report.totalSuppressedRuns += duplicateGroups.reduce((sum, group) => sum + group.duplicates.length, 0);

    if (roundRef && options.writeAudits) {
      report.auditsWritten += await applyAudits(roundRef, duplicateGroups);
    }

    if (deleteSources.length > 0) {
      report.deletesApplied += await applyDeletes(db, participant.userId, duplicateGroups, deleteSources);
    }

    report.participantsProcessed.push({
      userId: participant.userId,
      username: participant.username || null,
      rawRuns: candidates.length,
      dedupedRuns: groups.length,
      duplicateGroups: duplicateGroups.length,
      suppressedRuns: duplicateGroups.reduce((sum, group) => sum + group.duplicates.length, 0),
      groups: summarizeGroups(duplicateGroups),
    });
  }

  return report;
}

async function listRepairCandidateRunRounds(db, options = {}) {
  const lookbackDays = numberOrNull(options.lookbackDays) ?? 14;
  const nowSeconds = numberOrNull(options.nowSeconds) ?? Date.now() / 1000;
  const minEndDate = nowSeconds - (lookbackDays * 86400);
  const collections = ['sweatlist-collection', 'sweatlistCollections'];
  const roundsById = new Map();

  for (const collectionName of collections) {
    let snapshot;
    try {
      snapshot = await db
        .collection(collectionName)
        .where('challenge.endDate', '>=', minEndDate)
        .get();
    } catch (error) {
      console.warn(`[run-round-duplicate-repair] Falling back to full scan for ${collectionName}: ${error.message}`);
      snapshot = await db.collection(collectionName).get();
    }

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const challengeType = safeString(data.challenge?.challengeType || data.challengeType).toLowerCase();
      const startDate = toSeconds(data.challenge?.startDate || data.startDate);
      const endDate = toSeconds(data.challenge?.endDate || data.endDate);
      if (challengeType !== 'run') return;
      if (endDate !== null && endDate < minEndDate) return;

      roundsById.set(doc.id, {
        challengeId: doc.id,
        collectionName,
        title: data.title || null,
        startDate,
        endDate,
        allowTreadmill: data.runRoundConfig?.allowTreadmill !== false,
      });
    });
  }

  return Array.from(roundsById.values()).sort((left, right) => {
    return (right.endDate || 0) - (left.endDate || 0);
  });
}

module.exports = {
  REPAIRABLE_SOURCE_COLLECTIONS,
  listRepairCandidateRunRounds,
  parseDeleteSources,
  repairRunRoundDuplicates,
  resolveRoundDocument,
  toSeconds,
};
