// Server-only. Generates and resolves the short human-readable code athletes
// can type by hand to join a team when link-based attribution (AppsFlyer deep
// linking) fails or isn't available. Callers pass in an already-initialized
// Firestore admin instance so this stays usable from both the Next.js API
// route and the Netlify function that manage it — see manage-pulsecheck-team-code
// and team-code/redeem.ts.
import { randomUUID, randomInt } from 'node:crypto';
import { resolveActivation } from '../../../lib/server/pulsecheck/activation-preview';
import type { firestore as AdminFirestoreNamespace } from 'firebase-admin';

const TEAMS_COLLECTION = 'pulsecheck-teams';
const INVITES_COLLECTION = 'pulsecheck-invite-links';

// Same alphabet as the existing club join-code convention (src/pages/admin/adminLevers.tsx)
// — excludes 0/1/I/L/O so a spoken or handwritten code can't be misread.
const TEAM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.split('');
const TEAM_CODE_LENGTH = 6;
const MAX_GENERATION_ATTEMPTS = 50;

function makeCandidateTeamCode(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += TEAM_CODE_ALPHABET[randomInt(TEAM_CODE_ALPHABET.length)];
  }
  return out;
}

type GenerateArgs = {
  database: AdminFirestoreNamespace.Firestore;
  fieldValue: typeof AdminFirestoreNamespace.FieldValue;
  teamId: string;
};

const usable = (row: any) => row?.status === 'active' && !row.deletedAt && !row.archivedAt && !row.revokedAt && !['deleted', 'purging', 'purged'].includes(row.lifecycleState);

// All entry points that display a code must persist its activation invitation in
// the same transaction. A teamCode alone is not consumable by native activation.
async function persistUsableCode(args: GenerateArgs, rotate: boolean): Promise<{code: string; created: boolean}> {
  const {database, fieldValue, teamId} = args;
  const result = await database.runTransaction(async transaction => {
    const teamRef = database.collection(TEAMS_COLLECTION).doc(teamId);
    const teamSnap = await transaction.get(teamRef);
    const team = teamSnap.data();
    if (!usable(team)) throw new Error('An active team is required.');
    const orgSnap = await transaction.get(database.collection('pulsecheck-organizations').doc(team!.organizationId));
    if (!usable(orgSnap.data())) throw new Error('An active organization is required.');
    const invites = database.collection(INVITES_COLLECTION);
    const oldCode = String(team!.teamCode || '').trim().toUpperCase();
    const matches = async (code: string) => {
      const codes = await transaction.get(invites.where('activationCode', '==', code));
      const aliases = await transaction.get(invites.where('activationAliases', 'array-contains', code));
      return [...new Map([...codes.docs, ...aliases.docs].map(d => [d.id, d])).values()];
    };
    const oldMatches = oldCode ? await matches(oldCode) : [];
    if (oldMatches.some(d => d.data().teamId !== teamId)) throw new Error('Team code conflicts with another invitation.');
    if (!rotate && oldCode && oldMatches.length) {
      if (oldMatches.length !== 1) throw new Error('Team code resolves to multiple invitations.');
      const teams = await transaction.get(database.collection(TEAMS_COLLECTION).where('teamCode', '==', oldCode));
      const shadow = await transaction.get(invites.doc(oldCode));
      if (teams.docs.some(d => d.id !== teamId) || shadow.exists) throw new Error('Team code conflicts with another invitation.');
      // Validation below also checks expiration, pilot window, role and cohort.
      return {code: oldCode, created: false};
    }
    let code = !rotate ? oldCode : '';
    for (let attempt = 0; !code && attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      const candidate = makeCandidateTeamCode(TEAM_CODE_LENGTH);
      if (candidate === oldCode) continue;
      const teams = await transaction.get(database.collection(TEAMS_COLLECTION).where('teamCode', '==', candidate));
      const existing = await matches(candidate);
      const tokenCollision = await transaction.get(invites.doc(candidate));
      if (teams.empty && !existing.length && !tokenCollision.exists) code = candidate;
    }
    if (!code) throw new Error('Could not allocate a unique team code.');
    // Also check legacy codes before lazily repairing them.
    const teams = await transaction.get(database.collection(TEAMS_COLLECTION).where('teamCode', '==', code));
    const tokenCollision = await transaction.get(invites.doc(code));
    if (teams.docs.some(d => d.id !== teamId) || tokenCollision.exists) throw new Error('Team code conflicts with another invitation.');
    const priorInvites = await transaction.get(invites.where('teamId', '==', teamId));
    const reusableAthleteInvites = priorInvites.docs.filter(d => {
      const row = d.data();
      return row.inviteType === 'team-access' && row.teamMembershipRole === 'athlete'
        && row.redemptionMode === 'general' && !row.targetEmail;
    });
    // Existing scoped enrollment must never be bypassed by creating a new
    // team-wide invite. Bind the code only when exactly one invitation resolves.
    if (reusableAthleteInvites.length) {
      const transactionDatabase = {collection: (name: string) => ({
        doc: (id: string) => ({get: () => transaction.get(database.collection(name).doc(id))}),
      })};
      const eligible: typeof reusableAthleteInvites = [];
      for (const candidate of reusableAthleteInvites) {
        try { await resolveActivation(transactionDatabase, candidate.id); eligible.push(candidate); }
        catch (error: any) { if (!error?.code?.startsWith('INVITE_')) throw error; }
      }
      if (eligible.length !== 1) throw new Error('Choose one active athlete invitation before sharing a team code.');
      const chosen = eligible[0];
      const aliases = (chosen.data().activationAliases || []).filter((v: string) => !rotate || v.toUpperCase() !== oldCode);
      const timestamp = fieldValue.serverTimestamp();
      transaction.update(chosen.ref, {activationAliases: [...new Set([...aliases, code])], ...(rotate && chosen.data().activationCode === oldCode ? {activationCode: code} : {}), updatedAt: timestamp});
      transaction.update(teamRef, {teamCode: code, teamCodeGeneratedAt: timestamp, updatedAt: timestamp});
      return {code, created: true};
    }
    const token = randomUUID();
    const timestamp = fieldValue.serverTimestamp();
    // Remove the old public code on rotation, retaining token-based invitations.
    for (const old of oldMatches) {
      const data = old.data();
      transaction.update(old.ref, {
        ...(data.activationCode === oldCode ? {activationCode: fieldValue.delete()} : {}),
        activationAliases: (data.activationAliases || []).filter((v: string) => v.toUpperCase() !== oldCode),
        updatedAt: timestamp,
      });
    }
    transaction.set(invites.doc(token), {
      token, inviteType: 'team-access', teamMembershipRole: 'athlete',
      redemptionMode: 'general', status: 'active', redemptionCount: 0,
      organizationId: team!.organizationId, teamId, pilotId: '', cohortId: '', targetEmail: '',
      activationCode: code, activationUrl: `https://fitwithpulse.ai/PulseCheck/team-invite/${token}`,
      source: 'authorized-team-code-management', createdAt: timestamp, updatedAt: timestamp,
    });
    transaction.update(teamRef, {teamCode: code, teamCodeGeneratedAt: timestamp, updatedAt: timestamp});
    return {code, created: true};
  });
  // Never display a code that the actual native activation resolver rejects.
  const resolved = await resolveActivation(database, result.code);
  if (resolved.teamId !== teamId) throw new Error('Team code resolved to a different team.');
  return result;
}

export async function getOrCreateTeamCode(args: GenerateArgs): Promise<{ code: string; created: boolean }> {
  return persistUsableCode(args, false);
}

/** Rotates the public short code without invalidating existing team memberships. */
export async function regenerateTeamCode(args: GenerateArgs): Promise<string> {
  return (await persistUsableCode(args, true)).code;
}

/** Resolves a team-code string to its team doc, or null if no active team matches. */
export async function findTeamByCode(
  database: AdminFirestoreNamespace.Firestore,
  code: string
): Promise<{ id: string; data: FirebaseFirestore.DocumentData } | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const snapshot = await database
    .collection(TEAMS_COLLECTION)
    .where('teamCode', '==', normalized)
    .limit(1)
    .get();
  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, data: doc.data() || {} };
}

/** Length/charset check used client-side context too (kept here as the single source of truth server-side). */
export function isTeamCodeShaped(value: string): boolean {
  const trimmed = value.trim().toUpperCase();
  if (trimmed.length < 5 || trimmed.length > 8) return false;
  return trimmed.split('').every((char) => TEAM_CODE_ALPHABET.includes(char));
}
