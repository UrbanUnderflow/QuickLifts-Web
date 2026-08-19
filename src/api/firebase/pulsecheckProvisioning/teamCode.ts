// Server-only. Generates and resolves the short human-readable code athletes
// can type by hand to join a team when link-based attribution (AppsFlyer deep
// linking) fails or isn't available. Callers pass in an already-initialized
// Firestore admin instance so this stays usable from both the Next.js API
// route and the Netlify function that manage it — see manage-pulsecheck-team-code
// and team-code/redeem.ts.
import type { firestore as AdminFirestoreNamespace } from 'firebase-admin';

const TEAMS_COLLECTION = 'pulsecheck-teams';

// Same alphabet as the existing club join-code convention (src/pages/admin/adminLevers.tsx)
// — excludes 0/1/I/L/O so a spoken or handwritten code can't be misread.
const TEAM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.split('');
const TEAM_CODE_LENGTH = 6;
const MAX_GENERATION_ATTEMPTS = 50;

function makeCandidateTeamCode(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += TEAM_CODE_ALPHABET[Math.floor(Math.random() * TEAM_CODE_ALPHABET.length)];
  }
  return out;
}

type GenerateArgs = {
  database: AdminFirestoreNamespace.Firestore;
  fieldValue: typeof AdminFirestoreNamespace.FieldValue;
  teamId: string;
};

async function generateAndPersistTeamCode(
  transaction: AdminFirestoreNamespace.Transaction,
  { database, fieldValue, teamId }: GenerateArgs
): Promise<string> {
  const teamRef = database.collection(TEAMS_COLLECTION).doc(teamId);
  let length = TEAM_CODE_LENGTH;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = makeCandidateTeamCode(length);
    const collisionSnapshot = await transaction.get(
      database.collection(TEAMS_COLLECTION).where('teamCode', '==', candidate)
    );
    if (collisionSnapshot.empty) {
      transaction.set(
        teamRef,
        {
          teamCode: candidate,
          teamCodeGeneratedAt: fieldValue.serverTimestamp(),
          updatedAt: fieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return candidate;
    }
    if (attempt > 0 && attempt % 4 === 0) length += 2;
  }

  throw new Error('Could not allocate a unique team code after 50 attempts.');
}

/**
 * Returns the team's existing code, or generates and persists one if it
 * doesn't have one yet (lazy backfill — no migration script needed for teams
 * created before this feature shipped).
 */
export async function getOrCreateTeamCode({
  database,
  fieldValue,
  teamId,
}: GenerateArgs): Promise<{ code: string; created: boolean }> {
  return database.runTransaction(async (transaction) => {
    const teamRef = database.collection(TEAMS_COLLECTION).doc(teamId);
    const teamSnapshot = await transaction.get(teamRef);
    if (!teamSnapshot.exists) {
      throw new Error('Team not found.');
    }

    const existingCode = String(teamSnapshot.data()?.teamCode || '').trim();
    if (existingCode) {
      return { code: existingCode, created: false };
    }

    const code = await generateAndPersistTeamCode(transaction, { database, fieldValue, teamId });
    return { code, created: true };
  });
}

/** Always overwrites with a fresh code, e.g. when a coach suspects theirs leaked. */
export async function regenerateTeamCode({
  database,
  fieldValue,
  teamId,
}: GenerateArgs): Promise<string> {
  return database.runTransaction(async (transaction) => {
    const teamRef = database.collection(TEAMS_COLLECTION).doc(teamId);
    const teamSnapshot = await transaction.get(teamRef);
    if (!teamSnapshot.exists) {
      throw new Error('Team not found.');
    }

    return generateAndPersistTeamCode(transaction, { database, fieldValue, teamId });
  });
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
