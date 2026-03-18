const protocolSeed = require('./pulsecheckProtocolRegistry.json');

function normalizeStringArray(values, fallback = []) {
  const source = Array.isArray(values) ? values : fallback;
  return Array.from(
    new Set(
      source
        .filter((value) => typeof value === 'string' && value.trim())
        .map((value) => value.trim())
    )
  );
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toTitleCase(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function defaultExpectedStateShift(protocolClass) {
  switch (protocolClass) {
    case 'priming':
      return 'Increase focus readiness, activation, or execution confidence before the next rep.';
    case 'recovery':
      return 'Downregulate post-load stress and help the athlete exit the session in a cleaner recovery posture.';
    case 'regulation':
    default:
      return 'Reduce activation spillover or emotional noise so the athlete can return to useful execution.';
  }
}

function defaultAvoidWindowTags(protocolClass) {
  switch (protocolClass) {
    case 'priming':
      return ['late_evening', 'sleep_window'];
    case 'recovery':
      return ['immediate_pre_competition', 'pre_max_effort'];
    case 'regulation':
    default:
      return [];
  }
}

function derivePublishedRevisionId(protocolId, publishedAt) {
  if (!protocolId || typeof publishedAt !== 'number' || !Number.isFinite(publishedAt)) return undefined;
  return `${protocolId}@${publishedAt}`;
}

function normalizeProtocolRecord(record, now = Date.now(), fallbackSortOrder = 999) {
  const label = record.label || record.id || 'Protocol';
  const protocolClass = record.protocolClass || 'regulation';
  const responseFamily = record.responseFamily || 'steady_regulation';
  const preferredContextTags = normalizeStringArray(record.preferredContextTags);
  const publishStatus = record.publishStatus || 'draft';
  const variantLabel = record.variantLabel || label;
  const variantKey = record.variantKey || slugify(variantLabel || label || 'protocol');
  const familyId = record.familyId || `${protocolClass}-${responseFamily}`;
  const protocolId = record.id || '';
  const publishedAt = typeof record.publishedAt === 'number'
    ? record.publishedAt
    : publishStatus === 'published'
      ? now
      : undefined;

  return {
    id: protocolId,
    label,
    familyId,
    familyLabel: record.familyLabel || toTitleCase(responseFamily),
    familyStatus: record.familyStatus || (publishStatus === 'published' ? 'locked' : 'candidate'),
    variantId: record.variantId || `${familyId}--${variantKey}`,
    variantKey,
    variantLabel,
    variantVersion: record.variantVersion || 'v1',
    publishedRevisionId: record.publishedRevisionId || derivePublishedRevisionId(protocolId, publishedAt),
    governanceStage:
      record.governanceStage ||
      (publishStatus === 'published' ? 'published' : publishStatus === 'archived' ? 'archived' : 'structured'),
    legacyExerciseId: record.legacyExerciseId || '',
    protocolClass,
    category: record.category || 'breathing',
    responseFamily,
    deliveryMode: record.deliveryMode || 'guided_breathing',
    triggerTags: normalizeStringArray(record.triggerTags),
    preferredContextTags,
    useWindowTags: normalizeStringArray(record.useWindowTags, preferredContextTags),
    avoidWindowTags: normalizeStringArray(record.avoidWindowTags, defaultAvoidWindowTags(protocolClass)),
    contraindicationTags: normalizeStringArray(record.contraindicationTags),
    rationale: record.rationale || '',
    mechanism: record.mechanism || record.rationale || '',
    expectedStateShift: record.expectedStateShift || defaultExpectedStateShift(protocolClass),
    reviewNotes: record.reviewNotes || undefined,
    evidenceSummary: record.evidenceSummary || undefined,
    durationSeconds: typeof record.durationSeconds === 'number' ? record.durationSeconds : 180,
    sortOrder: typeof record.sortOrder === 'number' ? record.sortOrder : fallbackSortOrder,
    publishStatus,
    isActive: record.isActive !== false,
    publishedAt,
    archivedAt: typeof record.archivedAt === 'number' ? record.archivedAt : undefined,
    createdAt: typeof record.createdAt === 'number' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : now,
  };
}

function listPulseCheckProtocolSeedRecords(now = Date.now()) {
  return protocolSeed
    .map((record, index) => normalizeProtocolRecord(record, now, (index + 1) * 10))
    .sort((left, right) => {
      if ((left.sortOrder || 999) !== (right.sortOrder || 999)) {
        return (left.sortOrder || 999) - (right.sortOrder || 999);
      }
      return String(left.label || '').localeCompare(String(right.label || ''));
    });
}

function listPublishedPulseCheckProtocolSeedRecords(now = Date.now()) {
  return listPulseCheckProtocolSeedRecords(now).filter((record) => record.isActive && record.publishStatus === 'published');
}

function getPulseCheckProtocolSeedById(id, now = Date.now()) {
  return listPulseCheckProtocolSeedRecords(now).find((record) => record.id === id) || null;
}

function listPulseCheckProtocolSeedRecordsByClass(protocolClass, now = Date.now()) {
  return listPublishedPulseCheckProtocolSeedRecords(now).filter((record) => record.protocolClass === protocolClass);
}

module.exports = {
  normalizeProtocolRecord,
  listPulseCheckProtocolSeedRecords,
  listPublishedPulseCheckProtocolSeedRecords,
  getPulseCheckProtocolSeedById,
  listPulseCheckProtocolSeedRecordsByClass,
};
