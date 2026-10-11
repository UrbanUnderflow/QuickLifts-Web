const { createHash } = require('node:crypto');

const SCHEMA_VERSION = 'athleticmind-snapshot-v1';
const MAX_RECORDS = 5000;
const DOC_FIELDS = ['id', 'version', 'category', 'title', 'body'];
const idValid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const active = data => data?.status === 'active' && !data.revokedAt && !data.deletedAt && !data.archivedAt;
function timestamp(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return Date.parse(value);
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? (value < 1e11 ? value * 1000 : value) : NaN;
  if (Number.isFinite(value?._seconds ?? value?.seconds)) return (value._seconds ?? value.seconds) * 1000;
  return NaN;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
}
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const sameDocument = (value, expected) => DOC_FIELDS.every(field => value?.[field] === expected[field]);
const sameReceipt = (left, right) => left?.decision === right?.decision && left?.version === right?.version && left?.signedName === right?.signedName && left?.decidedAt === right?.decidedAt && sameDocument(left?.document, right?.document);
const deny = (...reasonCodes) => ({ eligible: false, reasonCodes, snapshot: null });
async function bounded(query, label, max = MAX_RECORDS) {
  const snapshot = await query.limit(max + 1).get();
  if (snapshot.docs.length > max) throw new Error(`ATHLETICMIND_SNAPSHOT_SCAN_LIMIT:${label}`);
  return snapshot.docs;
}
function policyDocument() {
  // This file is prepared locally. Deployment activation is owned by the authenticated delivery boundary.
  return require('../../../src/content/consents/athleticmind-processing-v1.json');
}

/** Read-only eligibility revalidation. Never trust caller-supplied organization, product, consent or actor. */
async function checkAthleticMindSnapshotEligibility(db, { teamId, athleteId, now = Date.now() }) {
  if (!idValid(teamId) || !idValid(athleteId) || !Number.isFinite(timestamp(now))) return deny('invalid_scope');
  const nowMs = timestamp(now);
  const [teamSnapshot, membershipSnapshot] = await Promise.all([
    db.collection('pulsecheck-teams').doc(teamId).get(),
    db.collection('pulsecheck-team-memberships').doc(`${teamId}_${athleteId}`).get(),
  ]);
  const team = teamSnapshot.data();
  const membership = membershipSnapshot.data();
  if (!teamSnapshot.exists || !active(team) || !idValid(team.organizationId)) return deny('inactive_or_missing_team');
  if (!membershipSnapshot.exists || !active(membership) || membership.userId !== athleteId || membership.role !== 'athlete' || membership.teamId !== teamId || membership.organizationId !== team.organizationId) return deny('inactive_or_mismatched_membership');
  const organizationSnapshot = await db.collection('pulsecheck-organizations').doc(team.organizationId).get();
  const organization = organizationSnapshot.data();
  if (!organizationSnapshot.exists || !active(organization) || organization.productBrand !== 'athleticmind') return deny('not_active_athleticmind');
  const document = policyDocument();
  const onboarding = membership.athleteOnboarding || {};
  if (!Array.isArray(onboarding.requiredConsents) || !onboarding.requiredConsents.some(value => sameDocument(value, document))) return deny('current_processing_terms_missing');
  if (onboarding.productConsentAccepted !== true) return deny('participation_not_active');
  const decision = onboarding.consentDecisions?.[document.id];
  if (decision?.decision !== 'accepted' || decision.version !== document.version || !sameDocument(decision.document, document) || typeof decision.signedName !== 'string' || !decision.signedName.trim() || !Number.isFinite(timestamp(decision.decidedAt)) || timestamp(decision.decidedAt) > nowMs) return deny('processing_consent_not_accepted');
  const eventDocuments = await bounded(db.collection('pulsecheck-team-memberships').doc(`${teamId}_${athleteId}`).collection('consent-events'), 'consent_events', 1000);
  const events = eventDocuments.map(event => ({ id: event.id, ...event.data() })).filter(event => event.actorUserId === athleteId && event.decisions?.[document.id] && Number.isFinite(timestamp(event.recordedAt)) && timestamp(event.recordedAt) <= nowMs).sort((a, b) => timestamp(a.recordedAt) - timestamp(b.recordedAt) || a.id.localeCompare(b.id));
  const latest = events.at(-1);
  if (!latest || !sameReceipt(latest.decisions[document.id], decision)) return deny('consent_evidence_missing_or_changed');
  // Repeated saves of the same signed receipt do not move its acceptance date.
  let first = events.length - 1;
  while (first > 0 && sameReceipt(events[first - 1].decisions[document.id], decision)) first -= 1;
  const acceptedAt = Math.max(timestamp(events[first].recordedAt), timestamp(decision.decidedAt));
  return { eligible: true, reasonCodes: [], scope: { teamId, organizationId: team.organizationId, athleteId, membershipId: membershipSnapshot.id }, consent: { id: document.id, version: document.version, eventId: events[first].id, latestEvidenceEventId: latest.id, acceptedAt: new Date(acceptedAt).toISOString(), documentHash: hash(Object.fromEntries(DOC_FIELDS.map(key => [key, document[key]]))) }, membership, snapshot: null };
}

/** Bounded, read-only assembly. No model, persistence, network delivery, optional-source inference or brand fallback. */
async function assembleAthleticMindSnapshot(db, { teamId, athleteId, windowStart, windowEnd, now = Date.now() }) {
  const start = timestamp(windowStart), end = timestamp(windowEnd), nowMs = timestamp(now);
  if (![start, end, nowMs].every(Number.isFinite) || start >= end || end > nowMs) return deny('invalid_window');
  const eligibility = await checkAthleticMindSnapshotEligibility(db, { teamId, athleteId, now });
  if (!eligibility.eligible) return eligibility;
  const { scope, consent, membership } = eligibility;
  const accepted = timestamp(consent.acceptedAt);
  if (end <= accepted) return deny('window_precedes_acceptance');
  const [checkDocuments, scheduledDocuments, mainDocuments, supportDocuments] = await Promise.all([
    bounded(db.collection('pulsecheck-morning-checkins').where('athleteUserId', '==', athleteId), 'checkins'),
    bounded(db.collection('pulsecheck-nora-conversations').where('athleteUserId', '==', athleteId), 'scheduled_nora'),
    bounded(db.collection('conversations').where('userId', '==', athleteId), 'main_nora'),
    bounded(db.collection('escalation-records').where('userId', '==', athleteId), 'support_status'),
  ]);
  const checkIns = [], noraMessages = [], supportStatus = [];
  const missing = new Set(['wearables_not_included_permission_unverified', 'journals_not_included_permission_unverified', 'legacy_mental_checkins_unscoped']);
  const range = value => value >= start && value < end;
  function sourceTimes(document, eventValue) {
    const eventAt = timestamp(eventValue), createdAt = timestamp(document.createTime), ingestedAt = timestamp(document.updateTime);
    if (![eventAt, createdAt, ingestedAt].every(Number.isFinite)) { missing.add('source_server_timestamps_missing'); return null; }
    if (eventAt < accepted || createdAt < accepted || eventAt >= end || ingestedAt > nowMs) return null;
    if (!range(eventAt) && !range(ingestedAt)) return null;
    return { eventAt: new Date(eventAt).toISOString(), sourceIngestedAt: new Date(ingestedAt).toISOString() };
  }
  const scoped = (value, userField, requireOrganization = true) => value[userField] === athleteId && value.teamId === teamId && (!requireOrganization || value.organizationId === scope.organizationId) && value.syntheticRedTeam !== true;
  const stamp = record => {
    const { sourceIngestedAt, ...content } = record;
    return { ...record, revision: hash(content) };
  };
  for (const document of checkDocuments) {
    const data = document.data();
    if (!scoped(data, 'athleteUserId')) { missing.add('unscoped_or_other_team_checkins_excluded'); continue; }
    if (typeof data.level === 'string' && data.eveningCheckIn && (!scoped(data.morningScope || {}, 'athleteUserId') || !scoped(data.eveningCheckIn, 'athleteUserId'))) {
      missing.add('checkin_component_scope_ambiguous');
      continue;
    }
    for (const [period, value] of [['morning', data], ['evening', data.eveningCheckIn]]) {
      if (!value || typeof value.level !== 'string') continue;
      const times = sourceTimes(document, value.updatedAt || value.createdAt);
      if (!times || timestamp(value.createdAt) < accepted) continue;
      const record = { sourceId: `pulsecheck-morning-checkins/${document.id}/${period}`, period, dayKey: typeof data.dayKey === 'string' ? data.dayKey : null, level: value.level, ...times };
      for (const field of ['levelLabel', 'subjectiveRecoveryLabel', 'reflection']) if (typeof value[field] === 'string') record[field] = value[field];
      if (Number.isFinite(value.subjectiveRecoveryLevel)) record.subjectiveRecoveryLevel = value.subjectiveRecoveryLevel;
      checkIns.push(stamp(record));
    }
  }
  for (const [source, documents, field, userField, requiresOrg] of [
    ['pulsecheck-nora-conversations', scheduledDocuments, 'turns', 'athleteUserId', false],
    ['conversations', mainDocuments, 'messages', 'userId', true],
  ]) {
    for (const document of documents) {
      const data = document.data();
      if (!scoped(data, userField, requiresOrg)) { missing.add(`${source}_unscoped_or_other_team_excluded`); continue; }
      if (data.state === 'closed-revoked' || data.storagePolicy?.restricted === true) { missing.add('nora_restricted_or_revoked_content_unavailable'); continue; }
      if (!Array.isArray(data[field])) continue;
      for (const message of data[field]) {
        const messageId = field === 'turns' ? message.turnId : message.id;
        const text = field === 'turns' ? message.text : message.content;
        const speaker = field === 'turns' ? (message.role === 'athlete-reply' ? 'athlete' : ['nora-opener', 'nora-probe', 'nora-action'].includes(message.role) ? 'nora' : null) : typeof message.isFromUser === 'boolean' ? message.isFromUser ? 'athlete' : 'nora' : null;
        if (!idValid(messageId) || typeof text !== 'string' || !speaker) { missing.add('invalid_nora_message_excluded'); continue; }
        if (text.includes('[Content withheld under the restricted-content policy]')) { missing.add('nora_restricted_or_revoked_content_unavailable'); continue; }
        const times = sourceTimes(document, field === 'turns' ? message.createdAt : message.timestamp);
        if (!times) continue;
        noraMessages.push(stamp({ sourceId: `${source}/${document.id}/${messageId}`, conversationId: document.id, speaker, text, ...times }));
      }
    }
  }
  const allowedStatuses = new Set(['pending', 'open', 'active', 'resolved', 'closed', 'initiated', 'completed', 'failed', 'not_initiated', 'pending_consent', 'declined', 'monitoring', 'merged', 'superseded']);
  for (const document of supportDocuments) {
    const data = document.data();
    if (!scoped(data, 'userId')) { missing.add('unscoped_or_other_team_support_status_excluded'); continue; }
    const times = sourceTimes(document, data.updatedAt || data.incidentLastActivityAt || data.createdAt);
    if (!times) continue;
    const record = { sourceId: `escalation-records/${document.id}`, ...times };
    for (const field of ['status', 'incidentStatus', 'handoffStatus']) if (allowedStatuses.has(data[field])) record[field] = data[field];
    if (Object.keys(record).some(key => ['status', 'incidentStatus', 'handoffStatus'].includes(key))) supportStatus.push(stamp(record));
  }
  const sort = (left, right) => left.eventAt.localeCompare(right.eventAt) || left.sourceId.localeCompare(right.sourceId);
  checkIns.sort(sort); noraMessages.sort(sort); supportStatus.sort(sort);
  const intake = membership.athleteOnboarding || {};
  const onboarding = { sourceId: `pulsecheck-team-memberships/${scope.membershipId}/athleteOnboarding`, formVersion: typeof intake.intakeFormVersion === 'string' ? intake.intakeFormVersion : null, completedAt: Number.isFinite(timestamp(intake.intakeCompletedAt)) ? new Date(timestamp(intake.intakeCompletedAt)).toISOString() : null, responses: canonical(intake.intakeResponses && typeof intake.intakeResponses === 'object' && !Array.isArray(intake.intakeResponses) ? intake.intakeResponses : {}) };
  if (!Object.keys(onboarding.responses).length) missing.add('onboarding_responses_missing');
  missing.add('no_per_message_ingestion_history');
  missing.add('full_nora_coverage_not_guaranteed');
  const levels = checkIns.reduce((result, checkin) => ({ ...result, [checkin.level]: (result[checkin.level] || 0) + 1 }), {});
  const lastEvent = [...checkIns, ...noraMessages, ...supportStatus].sort(sort).at(-1)?.eventAt || null;
  const snapshot = { schemaVersion: SCHEMA_VERSION, synthetic: false, scope, window: { start: new Date(start).toISOString(), end: new Date(end).toISOString() }, consent, onboarding, checkIns, noraMessages, supportStatus, coverage: { missing: [...missing].sort(), optionalSourcesIncluded: [], completeFullNoraTranscript: false }, summary: { method: 'deterministic_counts_only', checkInCount: checkIns.length, checkInLevelCounts: levels, noraMessageCount: noraMessages.length, athleteMessageCount: noraMessages.filter(message => message.speaker === 'athlete').length, supportStatusCount: supportStatus.length, latestSourceEventAt: lastEvent, sourceAgeAtWindowEndMs: lastEvent ? end - timestamp(lastEvent) : null }, ingestion: { selection: 'event_time_or_firestore_document_update_time', deduplicationKey: 'sourceId_and_revision', requiresRevisionDeduplication: true } };
  return { eligible: true, reasonCodes: [], snapshot: { ...snapshot, snapshotId: hash(snapshot), generatedAt: new Date(nowMs).toISOString() } };
}
module.exports = { SCHEMA_VERSION, assembleAthleticMindSnapshot, checkAthleticMindSnapshotEligibility };
