import type { NextApiRequest } from 'next';
import type { Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '../firebase-admin';
import { requireAdminRequest } from '../../pages/api/admin/_auth';
export const NORA_OWNER_ADMIN_EMAIL = 'tremaine.grant@gmail.com';
export type NoraTestingMember = { email: string; role: 'owner' | 'reviewer' };
export function normalizeNoraMembers(value: unknown): NoraTestingMember[] {
  if (!Array.isArray(value) || value.length > 50)
    throw new Error('Choose up to 50 team members.');
  const seen = new Set<string>();
  return value.map((entry) => {
    const email = String(entry?.email || '')
      .trim()
      .toLowerCase();
    if (
      !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email) ||
      !['owner', 'reviewer'].includes(entry?.role) ||
      seen.has(email)
    )
      throw new Error(
        'Use a unique valid email and choose Owner or Reviewer for each person.',
      );
    seen.add(email);
    return { email, role: entry.role };
  });
}
export function membersFromSettings(
  data: Record<string, unknown> | undefined,
): NoraTestingMember[] {
  if (Array.isArray(data?.members)) return normalizeNoraMembers(data.members);
  const email = String(
    data?.ownerEmail || process.env.NORA_RED_TEAM_OWNER_EMAIL || '',
  ).toLowerCase();
  return email ? [{ email, role: 'owner' }] : [];
}
export async function getNoraTestingTeam(
  db: Firestore = getFirebaseAdminApp(false).firestore(),
) {
  const snap = await db.doc('nora-red-team-settings/workflow').get();
  return {
    members: membersFromSettings(snap.data()),
    revision: Number(snap.data()?.revision) || 0,
  };
}
export async function requireNoraTestingRequest(
  req: NextApiRequest,
): Promise<{
  email: string;
  isGlobalAdmin: boolean;
  role: 'owner' | 'reviewer';
} | null> {
  if (!String(req.headers.authorization || '').startsWith('Bearer '))
    return null;
  const admin = await requireAdminRequest(req);
  const team = await getNoraTestingTeam();
  if (admin) {
    const email = admin.email.toLowerCase();
    return {
      email,
      isGlobalAdmin: true,
      role: team.members.find((m) => m.email === email)?.role || 'reviewer',
    };
  }
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  const modes =
    req.headers['x-pulsecheck-firebase-mode'] === 'dev'
      ? [false, true]
      : [false];
  for (const dev of modes) {
    try {
      const decoded = await getFirebaseAdminApp(dev)
        .auth()
        .verifyIdToken(header.slice(7), true);
      if (!decoded.email || decoded.email_verified !== true) continue;
      const email = decoded.email.toLowerCase();
      const member = team.members.find((m) => m.email === email);
      if (member) return { email, isGlobalAdmin: false, role: member.role };
    } catch {}
  }
  return null;
}
export async function updateNoraTestingTeam(
  db: Firestore,
  input: {
    members: unknown;
    revision: number;
    email: string;
    isGlobalAdmin: boolean;
  },
) {
  const members = normalizeNoraMembers(input.members);
  if (!members.some((m) => m.role === 'owner'))
    throw new Error('Keep at least one owner.');
  return db.runTransaction(async (tx) => {
    const ref = db.doc('nora-red-team-settings/workflow');
    const snap = await tx.get(ref);
    const current = membersFromSettings(snap.data());
    const revision = Number(snap.data()?.revision) || 0;
    if (revision !== input.revision)
      throw new Error('Team access changed. Refresh before saving.');
    if (
      current.length
        ? !current.some((m) => m.email === input.email && m.role === 'owner')
        : !input.isGlobalAdmin
    )
      throw new Error('Only an owner can manage Nora testing access.');
    const ownerSet = (list: NoraTestingMember[]) => list.filter(m => m.role === 'owner').map(m => m.email).sort().join('|');
    if (ownerSet(current) !== ownerSet(members) && input.email !== NORA_OWNER_ADMIN_EMAIL)
      throw new Error('Only the primary account can add or remove owners.');
    // Initial bootstrap is explicitly tied to the signed-in admin, with further members added afterward.
    if (
      !current.length &&
      (!members.some((m) => m.email === input.email && m.role === 'owner') ||
        members.length !== 1)
    )
      throw new Error(
        'Set yourself as the first owner before adding teammates.',
      );
    const next = {
      members,
      ownerEmail: members.find((m) => m.role === 'owner')!.email,
      revision: revision + 1,
      updatedBy: input.email,
      updatedAt: new Date().toISOString(),
    };
    tx.set(ref, next);
    return next;
  });
}
