import { createHash } from 'crypto';
import { hasCompletedEntryOnboarding, hasCompletedRequiredConsents } from '../../api/firebase/pulsecheckProvisioning/accessState';
import { consentCategory, consentDecisionComplete, healthBaselineConsentDocuments } from '../../api/firebase/pulsecheckProvisioning/consentPolicy';
import { isHealthBaselineEnabled } from '../../api/firebase/pulsecheckProvisioning/healthBaselinePolicy';
import { canonicalConsentDocuments, resolveAtomicConsentDocuments, saveAtomicConsent } from '../server/pulsecheck/atomicConsent';

const active = (value: any) => value?.status === 'active' && !value.revokedAt && !value.archivedAt && !value.deletedAt;
const text = (value: any) => typeof value === 'string' ? value.trim() : '';

/** Scope, terms and decisions come from server records, never questionnaire input. */
export async function baselineHealthContext(db: any, uid: string, assignment: any) {
  const individual = assignment?.scope === 'individual';
  let eligible = individual, member: any, team: any, organization: any, pilot: any;
  let memberId = '', organizationId = '', latest: any, decisions: any = {}, sportName = 'Sport';
  if (individual) {
    const [profile, summary, evidence] = await Promise.all([
      db.collection('users').doc(uid).get(), db.collection('pulsecheck-private-users').doc(uid).get(),
      db.collection('pulsecheck-private-users').doc(uid).collection('consent-events').orderBy('recordedAt', 'desc').limit(1).get(),
    ]);
    sportName = text(profile.data()?.sport) || sportName;
    decisions = summary.data()?.baselineHealthConsentDecisions || {};
    latest = evidence.docs[0]?.data();
  } else if (assignment?.teamId) {
    memberId = assignment.teamMembershipId || `${assignment.teamId}_${uid}`;
    const reference = db.collection('pulsecheck-team-memberships').doc(memberId);
    const [membership, teamSnapshot, evidence] = await Promise.all([
      reference.get(), db.collection('pulsecheck-teams').doc(assignment.teamId).get(),
      reference.collection('consent-events').orderBy('recordedAt', 'desc').limit(1).get(),
    ]);
    member = membership.data(); team = teamSnapshot.data(); latest = evidence.docs[0]?.data();
    organizationId = text(team?.organizationId);
    if (organizationId) organization = (await db.collection('pulsecheck-organizations').doc(organizationId).get()).data();
    eligible = active(member) && member.userId === uid && member.role === 'athlete'
      && member.teamId === assignment.teamId && member.organizationId === organizationId
      && active(team) && active(organization) && ['pulsecheck', 'athleticmind'].includes(organization.productBrand);
    const pilotId = text(member?.athleteOnboarding?.targetPilotId);
    if (eligible && pilotId) {
      pilot = (await db.collection('pulsecheck-pilots').doc(pilotId).get()).data();
      eligible = active(pilot) && pilot.organizationId === organizationId && pilot.teamId === assignment.teamId;
    }
    sportName = text(team?.sportOrProgram) || sportName;
    decisions = member?.athleteOnboarding?.consentDecisions || {};
  }
  const documents = individual ? healthBaselineConsentDocuments([], undefined, undefined, 'pulsecheck')
    : resolveAtomicConsentDocuments(team || {}, pilot || {}, organization?.productBrand || 'pulsecheck', organization || {});
  const healthBaselineEnabled = isHealthBaselineEnabled(team, organization);
  const healthDocuments = documents.filter(document => consentCategory(document) === 'health_authorization');
  const currentDecision = (document: any) => {
    const entry = decisions[document.id], evidence = latest?.decisions?.[document.id];
    return latest?.actorUserId === uid && consentDecisionComplete(document, decisions)
      && consentDecisionComplete(document, latest?.decisions) && entry?.decision === evidence?.decision
      && (entry.decision !== 'accepted' || Boolean(text(entry.signedName)) && Boolean(text(evidence.signedName))
        && (!entry.expiresAt || Date.parse(entry.expiresAt) > Date.now())
        && (!evidence.expiresAt || Date.parse(evidence.expiresAt) > Date.now())) ? entry.decision : 'pending';
  };
  const choices = healthDocuments.map(currentDecision);
  const decision = !healthBaselineEnabled ? 'disabled' : !choices.length || choices.includes('pending') ? 'pending'
    : choices.includes('revoked') ? 'revoked' : choices.includes('declined') ? 'declined' : 'accepted';
  if (!individual && eligible) {
    const onboarding = member.athleteOnboarding;
    // Pending health decisions must not remove the baseline requirement.
    eligible = (!onboarding?.entryOnboardingStep || hasCompletedEntryOnboarding(onboarding))
      && onboarding?.productConsentAccepted !== false
      && hasCompletedRequiredConsents({ ...onboarding, requiredConsents: documents.filter(document => consentCategory(document) !== 'health_authorization') });
  }
  return { eligible, individual, member, memberId, organizationId, team, organization, pilot,
    documents, healthDocuments, decisions, sportName: sportName.slice(0, 120), healthBaselineEnabled,
    healthSharingAllowed: eligible && healthBaselineEnabled && decision === 'accepted',
    healthAuthorizationDecision: decision, healthAuthorizationRequired: healthBaselineEnabled && decision === 'pending',
    healthAuthorizationUrl: organizationId ? `/PulseCheck/athlete-onboarding?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(assignment.teamId)}` : null };
}

/** Reuse team consent transactions; individual receipts stay in the existing private user boundary. */
export async function saveBaselineHealthDecision(db: any, uid: string, context: Awaited<ReturnType<typeof baselineHealthContext>>, submitted: any, timestamp: () => any) {
  if (!context.eligible || !context.healthBaselineEnabled || !submitted || typeof submitted !== 'object' || Array.isArray(submitted)) throw Error('Health choices are unavailable.');
  for (const [id, entry] of Object.entries(submitted) as [string, any][]) {
    const document = context.healthDocuments.find(document => document.id === id);
    if (!document || !['accepted', 'declined', 'revoked'].includes(entry?.decision)
      || entry.version !== document.version || JSON.stringify(canonicalConsentDocuments([entry.document || {}])) !== JSON.stringify(canonicalConsentDocuments([document]))
      || entry.decision === 'accepted' && !text(entry.signedName) || text(entry.signedName).length > 200) throw Error('Review the current terms and record your choice.');
  }
  if (!context.individual) {
    return saveAtomicConsent(db, uid, { action: 'progress', teamMembershipId: context.memberId,
      expectedContext: { organizationId: context.organizationId, teamId: context.member.teamId,
        pilotId: context.member.athleteOnboarding?.targetPilotId || '', cohortId: context.member.athleteOnboarding?.targetCohortId || '',
        productBrand: context.organization.productBrand, documents: context.documents },
      onboarding: { consentDecisions: submitted } }, timestamp);
  }
  const reference = db.collection('pulsecheck-private-users').doc(uid);
  return db.runTransaction(async (tx: any) => {
    const previous = (await tx.get(reference)).data() || {};
    const closure = await tx.get(db.collection('account-closure-jobs').doc(uid));
    if (closure.exists) throw Error('Account is unavailable.');
    const decisions = { ...previous.baselineHealthConsentDecisions };
    for (const [id, raw] of Object.entries(submitted) as [string, any][]) {
      const document = context.healthDocuments.find(document => document.id === id)!;
      decisions[id] = { decision: raw.decision, version: document.version, document,
        signedName: text(raw.signedName), decidedAt: text(raw.decidedAt) || new Date().toISOString() };
    }
    if (JSON.stringify(decisions) === JSON.stringify(previous.baselineHealthConsentDecisions)) return;
    const eventId = createHash('sha256').update(JSON.stringify({ previous: previous.lastBaselineConsentEventId || null, decisions })).digest('hex');
    tx.create(reference.collection('consent-events').doc(eventId), { actorUserId: uid, decisions, recordedAt: timestamp() });
    tx.set(reference, { userId: uid, protected: true, baselineHealthConsentDecisions: decisions, lastBaselineConsentEventId: eventId }, { merge: true });
  });
}
