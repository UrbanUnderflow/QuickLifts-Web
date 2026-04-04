'use strict';

const APPROVAL_DECISIONS = new Set(['approved', 'rejected', 'expired', 'revoked']);
const APPROVAL_SCOPE_TYPES = new Set(['task', 'outcome', 'stage', 'action', 'mission']);

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeApprovalDecision(value, fallback = 'approved') {
  const normalized = String(value || '').trim().toLowerCase();
  return APPROVAL_DECISIONS.has(normalized) ? normalized : fallback;
}

function normalizeApprovalScopeType(value, fallback = 'mission') {
  const normalized = String(value || '').trim().toLowerCase();
  return APPROVAL_SCOPE_TYPES.has(normalized) ? normalized : fallback;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') {
    try { return value.toDate().getTime(); } catch (_) { return 0; }
  }
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeApprovalEvent(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const createdAt = input.createdAt || now;
  const effectiveUntil = input.effectiveUntil || null;
  const normalizedDecision = normalizeApprovalDecision(input.decision, 'approved');
  const scopeType = normalizeApprovalScopeType(input.scopeType, options.scopeType || 'mission');

  return {
    id: normalizeText(input.id) || null,
    missionId: normalizeText(input.missionId) || normalizeText(options.missionId) || null,
    approvalType: normalizeText(input.approvalType) || normalizeText(options.approvalType) || null,
    scopeType,
    scopeId: normalizeText(input.scopeId) || normalizeText(options.scopeId) || null,
    decision: normalizedDecision,
    approverId: normalizeText(input.approverId) || null,
    rationale: normalizeText(input.rationale) || null,
    createdAt,
    createdAtMs: toMillis(createdAt),
    effectiveUntil,
    effectiveUntilMs: toMillis(effectiveUntil),
    active: normalizedDecision === 'approved' && (!effectiveUntil || toMillis(effectiveUntil) > toMillis(now)),
  };
}

function approvalAppliesToScope(event, scope = {}) {
  if (!event) return false;
  const normalized = normalizeApprovalEvent(event, scope);
  if (scope.scopeType && normalized.scopeType !== normalizeApprovalScopeType(scope.scopeType, normalized.scopeType)) return false;
  if (scope.scopeId && normalized.scopeId !== normalizeText(scope.scopeId)) return false;
  if (scope.missionId && normalized.missionId && normalized.missionId !== normalizeText(scope.missionId)) return false;
  if (scope.approvalType && normalized.approvalType !== normalizeText(scope.approvalType)) return false;
  return true;
}

function isApprovalActive(event, now = Date.now()) {
  const normalized = normalizeApprovalEvent(event, { now: new Date(now) });
  return normalized.decision === 'approved' && (!normalized.effectiveUntilMs || normalized.effectiveUntilMs > now);
}

function resolveApprovalEvents(approvalEvents = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const requiredApprovalTypes = Array.isArray(options.requiredApprovalTypes)
    ? options.requiredApprovalTypes.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  const scope = {
    missionId: normalizeText(options.missionId) || null,
    scopeType: options.scopeType ? normalizeApprovalScopeType(options.scopeType, 'mission') : null,
    scopeId: normalizeText(options.scopeId) || null,
    approvalType: normalizeText(options.approvalType) || null,
  };

  const normalizedEvents = approvalEvents
    .map((event) => normalizeApprovalEvent(event, { ...scope, now }))
    .filter((event) => approvalAppliesToScope(event, scope));

  const groupedByType = new Map();
  for (const event of normalizedEvents) {
    const key = event.approvalType || 'unknown';
    if (!groupedByType.has(key)) groupedByType.set(key, []);
    groupedByType.get(key).push(event);
  }

  const resolvedByType = {};
  const missingApprovalTypes = [];
  const blockedApprovalTypes = [];
  const approvedApprovalTypes = [];
  const expiredApprovalTypes = [];
  const revokedApprovalTypes = [];
  const rejectedApprovalTypes = [];
  const activeApprovalEventIds = [];

  for (const type of requiredApprovalTypes) {
    const history = (groupedByType.get(type) || []).sort((a, b) => b.createdAtMs - a.createdAtMs);
    const latest = history[0] || null;
    const active = history.find((event) => isApprovalActive(event, toMillis(now)));

    if (!latest) {
      missingApprovalTypes.push(type);
      resolvedByType[type] = { status: 'missing', latest: null, active: null, history };
      continue;
    }

    if (latest.decision === 'rejected') {
      rejectedApprovalTypes.push(type);
      blockedApprovalTypes.push(type);
      resolvedByType[type] = { status: 'rejected', latest, active: null, history };
      continue;
    }

    if (latest.decision === 'revoked') {
      revokedApprovalTypes.push(type);
      blockedApprovalTypes.push(type);
      resolvedByType[type] = { status: 'revoked', latest, active: null, history };
      continue;
    }

    if (latest.decision === 'expired' || (latest.effectiveUntilMs && latest.effectiveUntilMs <= toMillis(now))) {
      expiredApprovalTypes.push(type);
      blockedApprovalTypes.push(type);
      resolvedByType[type] = { status: 'expired', latest, active: null, history };
      continue;
    }

    if (active) {
      approvedApprovalTypes.push(type);
      if (active.id) activeApprovalEventIds.push(active.id);
      resolvedByType[type] = { status: 'approved', latest, active, history };
      continue;
    }

    missingApprovalTypes.push(type);
    resolvedByType[type] = { status: 'missing', latest, active: null, history };
  }

  let status = 'approved';
  if (missingApprovalTypes.length > 0) status = 'missing';
  if (blockedApprovalTypes.length > 0) status = 'blocked';

  return {
    status,
    requiredApprovalTypes,
    scope,
    resolvedByType,
    normalizedEvents,
    activeApprovalEventIds: activeApprovalEventIds.filter(Boolean),
    approvedApprovalTypes,
    missingApprovalTypes,
    blockedApprovalTypes,
    expiredApprovalTypes,
    revokedApprovalTypes,
    rejectedApprovalTypes,
    latestEvent: normalizedEvents[0] || null,
    resolvedAt: now,
  };
}

module.exports = {
  APPROVAL_DECISIONS,
  APPROVAL_SCOPE_TYPES,
  approvalAppliesToScope,
  isApprovalActive,
  normalizeApprovalDecision,
  normalizeApprovalEvent,
  normalizeApprovalScopeType,
  resolveApprovalEvents,
};
