const crypto = require('node:crypto');
const COLLECTION = 'pulsecheck-evidence-journals';
const AM_VERSION = 'athleticmind-journal-sharing-v1';
const PERSONAL_VERSION = 'nora-journal-sharing-v1';
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const validId = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const owner = (db, uid) => db.collection(COLLECTION).doc(uid);
const deleted = entry => !entry || !!entry.deletedAt || entry.isDeleted === true;
// Keep scope, consent evidence, entry and permission reads in the same Firestore transaction.
function transactionReader(tx, db) {
  const wrap = target => new Proxy(target, { get(value, property) {
    if (property === 'get') return () => tx.get(value);
    if (['collection', 'doc', 'where', 'limit'].includes(property)) return (...args) => wrap(value[property](...args));
    const result = value[property]; return typeof result === 'function' ? result.bind(value) : result;
  } });
  return wrap(db);
}
function journalEntryRevision(entry) {
  return hash({ type: entry.type || 'evidence', moment: entry.moment || '', action: entry.action || null, createdAt: entry.createdAt, updatedAt: entry.updatedAt || entry.createdAt });
}
const disclosures = {
  [AM_VERSION]: require('../../../src/content/consents/athleticmind-journal-sharing-v1.json'),
  [PERSONAL_VERSION]: require('../../../src/content/consents/nora-journal-sharing-v1.json'),
};
const disclosure = version => disclosures[version];
async function scopeFor(db, uid, teamId, now = Date.now()) {
  if (teamId === null) return { teamId: null, organizationId: null, label: 'Personal Nora analysis', productBrand: 'pulsecheck', eligible: true, disclosure: disclosure(PERSONAL_VERSION), consent: null };
  if (typeof teamId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(teamId)) fail('Choose a program or personal Nora analysis.');
  const { checkAthleticMindSnapshotEligibility } = require('./athleticmind-snapshot');
  const eligibility = await checkAthleticMindSnapshotEligibility(db, { teamId, athleteId: uid, now });
  if (!eligibility.eligible) fail('Review and accept the current Athletic Mind program terms before sharing an entry with that program.', 403);
  return { teamId, organizationId: eligibility.scope.organizationId, label: 'Athletic Mind program', productBrand: 'athleticmind', eligible: true, disclosure: disclosure(AM_VERSION), consent: eligibility.consent };
}
async function journalSharingState(db, uid, entryId, now = Date.now()) {
  if (!validId(entryId)) fail('Choose a valid entry.');
  entryId = entryId.toLowerCase();
  const root = owner(db, uid);
  const [entry, sharing, preference, memberships] = await Promise.all([
    root.collection('entries').doc(entryId).get(), root.collection('sharing').doc(entryId).get(), root.collection('preferences').doc('nora-sharing').get(),
    db.collection('pulsecheck-team-memberships').where('userId', '==', uid).limit(101).get(),
  ]);
  if (!entry.exists || deleted(entry.data())) fail('This entry was deleted.', 404);
  const scopes = [await scopeFor(db, uid, null, now)];
  if (memberships.docs.length <= 100) for (const membership of memberships.docs) {
    const m = membership.data();
    if (m.role !== 'athlete' || m.status !== 'active' || !m.teamId) continue;
    const team = await db.collection('pulsecheck-teams').doc(m.teamId).get();
    if (!team.exists || !team.data().organizationId) continue;
    const org = await db.collection('pulsecheck-organizations').doc(team.data().organizationId).get();
    if (!org.exists || org.data().productBrand !== 'athleticmind') continue;
    const label = `${org.data().name || 'Athletic Mind'} · ${team.data().name || 'Program team'}`;
    try { scopes.push({ ...await scopeFor(db, uid, m.teamId, now), label }); }
    catch { scopes.push({ teamId: m.teamId, organizationId: team.data().organizationId, label, productBrand: 'athleticmind', eligible: false, reason: 'Current program permission is required.', disclosure: disclosure(AM_VERSION) }); }
  }
  return { entry: entry.data(), entryRevision: journalEntryRevision(entry.data()), sharing: sharing.exists ? sharing.data() : null, futurePreference: preference.exists ? preference.data() : { enabled: false, teamId: null }, scopes: scopes.map(({ consent, ...scope }) => scope) };
}
function appendWithdrawal(tx, root, receipt, status, now) {
  if (!receipt || receipt.status !== 'shared') return;
  tx.create(root.collection('sharing-events').doc(crypto.randomUUID()), { ...receipt, status, updatedAt: now });
}
async function setJournalSharing(db, uid, input, now = Date.now()) {
  const root = owner(db, uid);
  if (!['share', 'unshare', 'preference'].includes(input.action)) fail('Choose a sharing action.');
  if (input.action === 'preference') {
    if (typeof input.enabled !== 'boolean') fail('Choose whether to share new entries.');
    return db.runTransaction(async tx => {
      const scope = input.enabled ? await scopeFor(transactionReader(tx, db), uid, input.teamId, now) : null;
      if (scope && (input.accepted !== true || input.disclosureVersion !== scope.disclosure.version)) fail('Read and accept the current sharing disclosure.');
      const value = { enabled: input.enabled, preferenceVersion: crypto.randomUUID(), teamId: scope?.teamId ?? null, organizationId: scope?.organizationId ?? null, disclosureVersion: scope?.disclosure.version ?? null, processingConsentEventId: scope?.consent?.eventId ?? null, processingDocumentHash: scope?.consent?.documentHash ?? null, updatedAt: now };
      tx.set(root.collection('preferences').doc('nora-sharing'), value);
      return { futurePreference: value };
    });
  }
  if (!validId(input.entryId)) fail('Choose a valid entry.');
  const entryId = input.entryId.toLowerCase();
  return db.runTransaction(async tx => {
    const scope = input.action === 'share' ? await scopeFor(transactionReader(tx, db), uid, input.teamId, now) : null;
    if (scope && (input.accepted !== true || input.disclosureVersion !== scope.disclosure.version)) fail('Read and accept the current sharing disclosure.');
    const ref = root.collection('entries').doc(entryId), shareRef = root.collection('sharing').doc(entryId);
    const [entry, saved] = await Promise.all([tx.get(ref), tx.get(shareRef)]);
    if (input.expectedPreferenceUpdatedAt !== undefined) {
      const preference = await tx.get(root.collection('preferences').doc('nora-sharing'));
      if (!preference.data()?.enabled || preference.data().updatedAt !== input.expectedPreferenceUpdatedAt || !input.expectedPreferenceVersion || preference.data().preferenceVersion !== input.expectedPreferenceVersion || preference.data().teamId !== scope?.teamId || preference.data().organizationId !== scope?.organizationId || preference.data().disclosureVersion !== scope?.disclosure.version || (scope?.consent && (preference.data().processingConsentEventId !== scope.consent.eventId || preference.data().processingDocumentHash !== scope.consent.documentHash))) fail('The new-entry preference changed.', 409);
      if (saved.exists) fail('An entry-specific choice already exists.', 409);
      if (!Number.isFinite(entry.data()?.createdAt) || entry.data().createdAt <= preference.data().updatedAt) fail('Only entries created after this preference may be shared automatically.', 409);
    }
    if (!entry.exists || deleted(entry.data())) fail('This entry was deleted.', 404);
    const revision = journalEntryRevision(entry.data());
    if (input.action === 'share' && input.entryRevision !== revision) fail('This entry changed. Review it before sharing again.', 409);
    const old = saved.data();
    appendWithdrawal(tx, root, old, 'unshared', now);
    const receipt = scope ? { entryId, athleteId: uid, teamId: scope.teamId, organizationId: scope.organizationId, status: 'shared', entryRevision: revision, permissionVersion: scope.disclosure.version, permissionEventId: crypto.randomUUID(), sharedAt: now, updatedAt: now, processingConsentEventId: scope.consent?.eventId ?? null, processingDocumentHash: scope.consent?.documentHash ?? null, processingConsentVersion: scope.consent?.version ?? null } : { ...(old || {}), entryId, athleteId: uid, status: 'unshared', updatedAt: now };
    tx.set(shareRef, receipt);
    return { sharing: receipt, entryRevision: revision };
  });
}
async function applyFutureJournalSharing(db, uid, entry, now = Date.now()) {
  const ref = owner(db, uid).collection('preferences').doc('nora-sharing'), saved = await ref.get(), pref = saved.data();
  if (!pref?.enabled || !pref.preferenceVersion || !Number.isFinite(entry.createdAt) || entry.createdAt <= pref.updatedAt) return null;
  const scope = await scopeFor(db, uid, pref.teamId, now);
  if (scope.disclosure.version !== pref.disclosureVersion || (scope.consent && (scope.consent.eventId !== pref.processingConsentEventId || scope.consent.documentHash !== pref.processingDocumentHash))) return null;
  // Preference is captured only for a newly created entry; callers never run this on replay or edit.
  return setJournalSharing(db, uid, { action: 'share', entryId: entry.id, entryRevision: journalEntryRevision(entry), teamId: pref.teamId, disclosureVersion: pref.disclosureVersion, accepted: true, expectedPreferenceUpdatedAt: pref.updatedAt, expectedPreferenceVersion: pref.preferenceVersion }, now);
}
async function authorizedJournalAnalysis(db, uid, entryId, now = Date.now()) {
  if (!validId(entryId)) fail('Choose a valid entry.');
  entryId = entryId.toLowerCase();
  return db.runTransaction(async tx => {
  const root = owner(db, uid), [entry, sharing] = await Promise.all([tx.get(root.collection('entries').doc(entryId)), tx.get(root.collection('sharing').doc(entryId))]);
  const receipt = sharing.data();
  if (!entry.exists || deleted(entry.data()) || receipt?.athleteId !== uid || receipt.entryId !== entryId || receipt.status !== 'shared' || receipt.entryRevision !== journalEntryRevision(entry.data())) fail('Share the current entry before asking Nora to analyze it.', 403);
  const scope = await scopeFor(transactionReader(tx, db), uid, receipt.teamId, now);
  if (receipt.organizationId !== scope.organizationId || receipt.permissionVersion !== scope.disclosure.version || (scope.consent && (receipt.processingConsentEventId !== scope.consent.eventId || receipt.processingDocumentHash !== scope.consent.documentHash || receipt.processingConsentVersion !== scope.consent.version))) fail('Review the current sharing permission again.', 403);
  return { entry: entry.data(), sharing: receipt, trustedSource: { kind: 'journal', recordedBy: 'pulsecheck-chat-v2', journalEntryId: entryId, journalPermissionEventId: receipt.permissionEventId } };
  });
}
module.exports = { AM_VERSION, PERSONAL_VERSION, journalEntryRevision, journalSharingState, setJournalSharing, applyFutureJournalSharing, authorizedJournalAnalysis, appendWithdrawal };
