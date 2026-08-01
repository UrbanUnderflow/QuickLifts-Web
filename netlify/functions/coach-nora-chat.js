// Coach ↔ Nora Chat Function
// ----------------------------------------------------------------------------
// A coach-facing conversation with Nora that does two jobs:
//   1) Train Nora — when the coach says things like "remember this",
//      "make a note of this", or "train on this", Nora extracts a clean note
//      and writes it straight into the coach's knowledge vault
//      (coach-nora-vault), the same store the athlete-facing Nora reads from.
//   2) Team insight — the coach can ask "how is the team doing?",
//      "who should I check on?", etc. Nora answers from the live athlete
//      digest (sentiment + status derived from real athlete conversations)
//      and any recent escalation alerts.
//
// Request (POST):
//   {
//     coachId: string,
//     teamId: string,
//     message: string,
//     history?: Array<{ role: 'user' | 'assistant', content: string }>,
//     athletes?: Array<{ displayName, status, sentimentScore,
//                        conversationCount, totalSessions, lastActiveDays }>
//   }
//
// Response:
//   { reply: string, savedNote: { id, title, category } | null }

const { admin, headers } = require('./config/firebase');
const { verifyFirebaseUser } = require('./lib/pulsecheck-coach-services');

const VAULT_COLLECTION = 'coach-nora-vault';
const ESCALATIONS_COLLECTION = 'escalation-records';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const LEGACY_COACHES_COLLECTION = 'coaches';
const LEGACY_COACH_ATHLETES_COLLECTION = 'coachAthletes';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const KNOWN_STAFF_CAPABILITIES = new Set([
  'admin',
  'administrative',
  'coaching',
  'athletic_trainer',
]);

const truncate = (value, max) => {
  const str = String(value || '').trim();
  return str.length > max ? `${str.slice(0, max)}…` : str;
};

const normalizeString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const isSafeDocumentId = (value) => (
  Boolean(value)
  && value.length <= 256
  && value !== '.'
  && value !== '..'
  && !value.includes('/')
);

const snapshotExists = (snapshot) => (
  typeof snapshot?.exists === 'function'
    ? snapshot.exists()
    : snapshot?.exists === true
);

function isActiveMembership(data) {
  const status = normalizeString(data?.status).toLowerCase();
  return (!status || status === 'active') && data?.revokedAt == null;
}

function isActiveTeam(data) {
  const status = normalizeString(data?.status).toLowerCase();
  return status === 'active'
    && data?.deletedAt == null
    && data?.archivedAt == null;
}

function isValidLegacyCoachProfile(snapshot, coachId) {
  if (!snapshotExists(snapshot)) return false;
  const data = snapshot.data?.() || {};
  const profileUserId = normalizeString(data.userId);
  const userType = normalizeString(data.userType).toLowerCase();
  const status = normalizeString(data.status).toLowerCase();
  return (!profileUserId || profileUserId === coachId)
    && (!userType || userType === 'coach')
    && (!status || status === 'active')
    && data.deletedAt == null
    && data.revokedAt == null;
}

function isActiveLegacyLink(data) {
  const status = normalizeString(data?.status).toLowerCase();
  return (!status || status === 'active')
    && data?.disconnectedAt == null
    && data?.revokedAt == null;
}

function legacyCapabilitiesForRole(role) {
  switch (role) {
    case 'team-admin':
      return new Set(['admin']);
    case 'coach':
      return new Set(['coaching']);
    case 'performance-staff':
    case 'clinician':
      return new Set(['athletic_trainer']);
    case 'support-staff':
      return new Set(['administrative']);
    default:
      return new Set();
  }
}

function resolveStaffCapabilities(data, role) {
  const fallback = legacyCapabilitiesForRole(role);
  if (!Object.prototype.hasOwnProperty.call(data || {}, 'staffCapabilities')) {
    return fallback;
  }

  const rawCapabilities = data.staffCapabilities;
  if (!Array.isArray(rawCapabilities)) {
    return role === 'team-admin' ? new Set(['admin']) : new Set();
  }
  if (rawCapabilities.length === 0) {
    return fallback;
  }

  const capabilities = new Set();
  for (const value of rawCapabilities) {
    const capability = normalizeString(value);
    if (!KNOWN_STAFF_CAPABILITIES.has(capability)) {
      return role === 'team-admin' ? new Set(['admin']) : new Set();
    }
    capabilities.add(capability);
  }
  if (role === 'team-admin') capabilities.add('admin');
  return capabilities;
}

function resolveRosterVisibility(data, capabilities) {
  if (capabilities.size === 0) return 'none';
  if (Object.prototype.hasOwnProperty.call(data || {}, 'rosterVisibilityScope')) {
    const scope = normalizeString(data.rosterVisibilityScope).toLowerCase();
    return scope === 'team' || scope === 'assigned' || scope === 'none'
      ? scope
      : 'none';
  }
  return capabilities.has('admin')
    || capabilities.has('coaching')
    || capabilities.has('athletic_trainer')
    ? 'team'
    : 'none';
}


async function loadTeamAthleteIds(db, teamId, organizationId) {
  const snapshot = await db
    .collection(TEAM_MEMBERSHIPS_COLLECTION)
    .where('teamId', '==', teamId)
    .get();
  const athleteIds = new Set();
  for (const document of snapshot.docs || []) {
    const data = document.data?.() || {};
    const athleteId = normalizeString(data.userId);
    if (
      normalizeString(data.role).toLowerCase() === 'athlete'
      && athleteId
      && normalizeString(data.userId) === athleteId
      && normalizeString(data.teamId) === teamId
      && normalizeString(data.organizationId) === organizationId
      && isActiveMembership(data)
    ) {
      athleteIds.add(athleteId);
    }
  }
  return athleteIds;
}

async function resolveNoraCoachAccess(db, coachId, teamId) {
  const denied = {
    authorized: false,
    allowedAthleteIds: new Set(),
    allowLegacyVaultBridge: false,
  };

  if (teamId === `legacy:${coachId}`) {
    const legacyCoachSnapshot = await db
      .collection(LEGACY_COACHES_COLLECTION)
      .doc(coachId)
      .get();
    if (!isValidLegacyCoachProfile(legacyCoachSnapshot, coachId)) return denied;

    const legacyLinks = await db
      .collection(LEGACY_COACH_ATHLETES_COLLECTION)
      .where('coachId', '==', coachId)
      .get();
    const allowedAthleteIds = new Set();
    for (const document of legacyLinks.docs || []) {
      const data = document.data?.() || {};
      const athleteId = normalizeString(data.athleteUserId)
        || normalizeString(data.athleteId);
      if (
        normalizeString(data.coachId) === coachId
        && athleteId
        && isActiveLegacyLink(data)
      ) {
        allowedAthleteIds.add(athleteId);
      }
    }
    return {
      authorized: true,
      allowedAthleteIds,
      allowLegacyVaultBridge: true,
    };
  }
  if (teamId.startsWith('legacy:')) return denied;

  const teamSnapshot = await db.collection(TEAMS_COLLECTION).doc(teamId).get();
  if (!snapshotExists(teamSnapshot)) return denied;

  const team = teamSnapshot.data?.() || {};
  const organizationId = normalizeString(team.organizationId);
  if (!organizationId || !isActiveTeam(team)) return denied;

  const [membershipSnapshot, organizationSnapshot] = await Promise.all([
    db
      .collection(TEAM_MEMBERSHIPS_COLLECTION)
      .where('userId', '==', coachId)
      .where('teamId', '==', teamId)
      .get(),
    db.collection(ORGANIZATIONS_COLLECTION).doc(organizationId).get(),
  ]);
  if (
    !snapshotExists(organizationSnapshot)
    || !isActiveTeam(organizationSnapshot.data?.() || {})
  ) {
    return denied;
  }

  const candidateMemberships = [];
  for (const document of membershipSnapshot.docs || []) {
    const data = document.data?.() || {};
    const role = normalizeString(data.role).toLowerCase();
    if (
      normalizeString(data.userId) !== coachId
      || normalizeString(data.teamId) !== teamId
      || normalizeString(data.organizationId) !== organizationId
      || role === 'athlete'
      || !isActiveMembership(data)
    ) {
      continue;
    }

    const capabilities = resolveStaffCapabilities(data, role);
    const canUseNora = capabilities.has('admin')
      || capabilities.has('coaching')
      || capabilities.has('administrative');
    if (canUseNora) candidateMemberships.push({ data, capabilities });
  }
  if (candidateMemberships.length === 0) return denied;

  const policy = {
    entireTeam: false,
    assignedAthleteIds: new Set(),
  };
  for (const membership of candidateMemberships) {
    const canReadRoster = membership.capabilities.has('admin')
      || membership.capabilities.has('coaching')
      || membership.capabilities.has('athletic_trainer');
    const rosterVisibility = canReadRoster
      ? resolveRosterVisibility(membership.data, membership.capabilities)
      : 'none';

    if (rosterVisibility === 'team') {
      policy.entireTeam = true;
      policy.assignedAthleteIds.clear();
    } else if (rosterVisibility === 'assigned' && !policy.entireTeam) {
      for (const value of Array.isArray(membership.data.allowedAthleteIds)
        ? membership.data.allowedAthleteIds
        : []) {
        const athleteId = normalizeString(value);
        if (athleteId) policy.assignedAthleteIds.add(athleteId);
      }
    }
  }

  const allowedAthleteIds = new Set();
  if (policy.entireTeam || policy.assignedAthleteIds.size > 0) {
    const teamAthleteIds = await loadTeamAthleteIds(db, teamId, organizationId);
    for (const athleteId of teamAthleteIds) {
      if (policy.entireTeam || policy.assignedAthleteIds.has(athleteId)) {
        allowedAthleteIds.add(athleteId);
      }
    }
  }

  return {
    authorized: true,
    allowedAthleteIds,
    // Only the deterministic legacy team may adopt old unscoped entries.
    allowLegacyVaultBridge:
      teamId === `legacy-coach-team-${coachId}`
      && normalizeString(team.legacySource) === 'legacy-coach-roster'
      && normalizeString(team.legacyCoachId) === coachId,
  };
}

function scopeAthletes(athletes, allowedAthleteIds) {
  if (!Array.isArray(athletes) || allowedAthleteIds.size === 0) return [];
  const seen = new Set();
  const scoped = [];
  for (const athlete of athletes) {
    const athleteId = normalizeString(athlete?.id);
    if (!athleteId || seen.has(athleteId) || !allowedAthleteIds.has(athleteId)) {
      continue;
    }
    seen.add(athleteId);
    scoped.push({ ...athlete, id: athleteId });
    if (scoped.length === 30) break;
  }
  return scoped;
}

// Build a compact, text-only snapshot of the coach's vault for grounding.
async function loadVaultContext(db, coachId, teamId, allowLegacyVaultBridge = false) {
  try {
    const snap = await db
      .collection(VAULT_COLLECTION)
      .where('coachId', '==', coachId)
      .where('teamId', '==', teamId)
      .get();
    const documents = [...(snap.docs || [])];

    if (allowLegacyVaultBridge) {
      const legacySnapshot = await db
        .collection(VAULT_COLLECTION)
        .where('coachId', '==', coachId)
        .get();
      const legacyDocuments = (legacySnapshot.docs || []).filter((document) => {
        const entry = document.data?.() || {};
        return !normalizeString(entry.teamId);
      });
      await Promise.all(
        legacyDocuments.map((document) =>
          db.collection(VAULT_COLLECTION).doc(document.id).set(
            {
              teamId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
        )
      );
      documents.push(...legacyDocuments);
    }

    return documents
      .map((d) => d.data())
      .map((e) => {
        const label = e.category ? `[${e.category}] ` : '';
        const body = e.content || (e.type === 'file' || e.type === 'image' ? `(file: ${e.fileName || e.title})` : '');
        return `- ${label}${e.title}: ${truncate(body, 400)}`;
      })
      .filter(Boolean);
  } catch (err) {
    console.warn('[coach-nora-chat] vault load failed', err);
    return [];
  }
}

// Pull recent active escalations for the coach's athletes (best-effort).
async function loadEscalationContext(db, athletes) {
  const ids = (athletes || [])
    .map((a) => a && a.id)
    .filter(Boolean)
    .slice(0, 30);
  if (ids.length === 0) return [];
  const nameById = new Map((athletes || []).map((a) => [a.id, a.displayName]));
  const lines = [];
  try {
    // Firestore `in` supports up to 30 values per query.
    const snap = await db
      .collection(ESCALATIONS_COLLECTION)
      .where('userId', 'in', ids)
      .get();
    snap.docs.forEach((d) => {
      const e = d.data() || {};
      if (e.status && e.status !== 'active') return;
      const who = nameById.get(e.userId) || 'An athlete';
      const sev = e.severity || e.category || 'flagged';
      const needsReview = e.requiresCoachReview ? ' — needs coach review' : '';
      lines.push(`- ${who}: ${sev}${needsReview}`);
    });
  } catch (err) {
    console.warn('[coach-nora-chat] escalation load failed', err);
  }
  return lines.slice(0, 20);
}

function buildAthleteDigest(athletes) {
  if (!Array.isArray(athletes) || athletes.length === 0) return [];
  return athletes.map((a) => {
    const last =
      a.lastActiveDays === null || a.lastActiveDays === undefined
        ? 'no check-ins yet'
        : a.lastActiveDays === 0
        ? 'checked in today'
        : `${a.lastActiveDays}d since last check-in`;
    const mood =
      typeof a.sentimentScore === 'number' ? `mood ${a.sentimentScore.toFixed(2)}` : 'mood —';
    return `- ${a.displayName} (${a.status || 'unknown'}): ${mood}, ${a.conversationCount || 0} conversations, ${last}`;
  });
}

function buildSystemPrompt({ coachName, vaultLines, athleteLines, escalationLines }) {
  return [
    `You are Nora, the team's assistant, talking directly with ${coachName || 'the coach'} inside their coaching dashboard.`,
    `Speak like a sharp, supportive coach — plain and human. Never sound clinical or academic. Keep replies short and directional: one idea at a time, no walls of text.`,
    ``,
    `You help the coach in two ways:`,
    `1) TRAINING — The coach can teach you facts about the team (schedules, policies, playbook details, logistics). When the coach clearly wants you to retain something — e.g. "remember this", "make a note", "train on this", or they simply state a durable team fact — capture it as a note so athletes can ask you about it later.`,
    `2) INSIGHT — The coach can ask how the team is doing, who to check on, or about trends. Answer from the ATHLETE SNAPSHOT and ALERTS below. You speak with athletes regularly, so surface what's pertinent. Never invent specifics you don't have; if you lack the detail, say what you'd watch and suggest the coach check in directly. Never expose private clinical detail — keep it to coaching-relevant signal.`,
    ``,
    `=== KNOWLEDGE VAULT (what you already know) ===`,
    vaultLines.length ? vaultLines.join('\n') : '(empty — nothing trained yet)',
    ``,
    `=== ATHLETE SNAPSHOT (live, from real check-ins) ===`,
    athleteLines.length ? athleteLines.join('\n') : '(no connected athletes yet)',
    ``,
    `=== ALERTS ===`,
    escalationLines.length ? escalationLines.join('\n') : '(no active alerts)',
    ``,
    `Respond with STRICT JSON only, no markdown, in this exact shape:`,
    `{`,
    `  "reply": "<your message to the coach>",`,
    `  "note": null OR { "title": "<short title>", "content": "<the fact to remember, self-contained>", "category": "<optional one-word group like Schedule, Policy, Playbook, or empty string>" }`,
    `}`,
    `Set "note" to a value ONLY when the coach is teaching you something to retain. For insight questions or chit-chat, set "note" to null. Echo back in "reply" what you saved when you save a note.`,
  ].join('\n');
}

async function callOpenAi({ systemPrompt, history, message }) {
  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) throw new Error('Missing OPEN_AI_SECRET_KEY');

  const trimmedHistory = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-10)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory,
    { role: 'user', content: String(message).slice(0, 2000) },
  ];

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed (${response.status}): ${errorText.slice(0, 240)}`);
  }

  const completion = await response.json();
  const raw = completion?.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch (_err) {
    // Model didn't return clean JSON — treat the whole thing as a plain reply.
    return { reply: String(raw).trim(), note: null };
  }
}

async function saveNote(db, coachId, teamId, note) {
  if (!note || !note.content || !String(note.content).trim()) return null;
  const docRef = db.collection(VAULT_COLLECTION).doc();
  const payload = {
    id: docRef.id,
    coachId,
    teamId,
    type: 'note',
    title: String(note.title || '').trim() || 'Note from chat',
    content: String(note.content).trim(),
    category: note.category ? String(note.category).trim() : null,
    url: null,
    source: 'coach-chat',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await docRef.set(payload);
  return { id: payload.id, title: payload.title, category: payload.category };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let authenticatedCoach;
  try {
    authenticatedCoach = await verifyFirebaseUser(event, {
      authErrorMessage: 'Sign in is required to chat with Nora.',
    });
  } catch (error) {
    return {
      statusCode: Number(error.statusCode) || 401,
      headers,
      body: JSON.stringify({ error: error.message || 'Sign in is required to chat with Nora.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON in request body' }) };
  }

  const claimedCoachId = String(body.coachId || '').trim();
  if (claimedCoachId && claimedCoachId !== authenticatedCoach.userId) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'This coach account cannot access the requested Nora workspace.' }),
    };
  }

  const coachId = authenticatedCoach.userId;
  const teamId = normalizeString(body.teamId);
  const { message, history, athletes, coachName } = body;
  if (!teamId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing teamId' }) };
  }
  if (!isSafeDocumentId(teamId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid teamId' }) };
  }
  if (!message || !String(message).trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing message' }) };
  }

  try {
    const db = authenticatedCoach.app.firestore();
    const access = await resolveNoraCoachAccess(db, coachId, teamId);
    if (!access.authorized) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'This account does not have active coach access to Nora.' }),
      };
    }
    const scopedAthletes = scopeAthletes(athletes, access.allowedAthleteIds);
    const [vaultLines, escalationLines] = await Promise.all([
      loadVaultContext(db, coachId, teamId, access.allowLegacyVaultBridge),
      loadEscalationContext(db, scopedAthletes),
    ]);
    const athleteLines = buildAthleteDigest(scopedAthletes);

    const systemPrompt = buildSystemPrompt({ coachName, vaultLines, athleteLines, escalationLines });
    const result = await callOpenAi({ systemPrompt, history, message });

    const reply =
      (result && typeof result.reply === 'string' && result.reply.trim()) ||
      "I'm here — tell me what to remember, or ask me how the team's doing.";

    let savedNote = null;
    if (result && result.note && typeof result.note === 'object') {
      savedNote = await saveNote(db, coachId, teamId, result.note);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ reply, savedNote }) };
  } catch (err) {
    console.error('[coach-nora-chat] handler error', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Chat failed', detail: err.message }),
    };
  }
};
