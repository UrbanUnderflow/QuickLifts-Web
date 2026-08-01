import type { Firestore } from 'firebase-admin/firestore';

export type PulseCheckAthleteScope = {
  teamId: string;
  organizationId: string;
  timezone?: string;
};

export type PulseCheckAthleteScopeWarning =
  | 'no_active_team_scope'
  | 'multiple_active_team_scopes';

export type PulseCheckAthleteScopeResolution = {
  scope: PulseCheckAthleteScope | null;
  warning: PulseCheckAthleteScopeWarning | null;
  validScopeCount: number;
};

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const isExactlyActive = (data: Record<string, unknown>): boolean =>
  clean(data.status).toLowerCase() === 'active'
  && data.revokedAt == null
  && data.archivedAt == null
  && data.deletedAt == null;

export const selectUnambiguousAthleteScope = (
  scopes: PulseCheckAthleteScope[],
): PulseCheckAthleteScopeResolution => {
  const unique = new Map<string, PulseCheckAthleteScope>();
  for (const scope of scopes) {
    const teamId = clean(scope.teamId);
    const organizationId = clean(scope.organizationId);
    if (!teamId || !organizationId) continue;
    unique.set(`${organizationId}\u0000${teamId}`, {
      teamId,
      organizationId,
      timezone: clean(scope.timezone) || undefined,
    });
  }

  const validScopes = [...unique.values()];
  if (validScopes.length === 1) {
    return {
      scope: validScopes[0],
      warning: null,
      validScopeCount: 1,
    };
  }
  return {
    scope: null,
    warning: validScopes.length === 0
      ? 'no_active_team_scope'
      : 'multiple_active_team_scopes',
    validScopeCount: validScopes.length,
  };
};

/**
 * Resolves a scope only when one exact active athlete membership points to
 * one live team and organization. Multi-team athletes remain owner-only until
 * check-ins have a first-class per-team projection.
 */
export const resolveUnambiguousAthleteScope = async (
  db: Firestore,
  athleteUserId: string,
): Promise<PulseCheckAthleteScopeResolution> => {
  const userId = clean(athleteUserId);
  if (!userId) {
    return {
      scope: null,
      warning: 'no_active_team_scope',
      validScopeCount: 0,
    };
  }

  const membershipSnapshot = await db
    .collection('pulsecheck-team-memberships')
    .where('userId', '==', userId)
    .where('role', '==', 'athlete')
    .where('status', '==', 'active')
    .get();

  const candidates = membershipSnapshot.docs.flatMap((document) => {
    const data = document.data() as Record<string, unknown>;
    const teamId = clean(data.teamId);
    const organizationId = clean(data.organizationId);
    if (
      !teamId
      || !organizationId
      || document.id !== `${teamId}_${userId}`
      || clean(data.userId) !== userId
      || clean(data.role).toLowerCase() !== 'athlete'
      || !isExactlyActive(data)
    ) {
      return [];
    }
    return [{
      teamId,
      organizationId,
      timezone: clean(data.timezone) || undefined,
    }];
  });

  const validated = await Promise.all(candidates.map(async (candidate) => {
    const [teamSnapshot, organizationSnapshot] = await Promise.all([
      db.collection('pulsecheck-teams').doc(candidate.teamId).get(),
      db.collection('pulsecheck-organizations')
        .doc(candidate.organizationId)
        .get(),
    ]);
    if (!teamSnapshot.exists || !organizationSnapshot.exists) return null;

    const team = teamSnapshot.data() as Record<string, unknown>;
    const organization =
      organizationSnapshot.data() as Record<string, unknown>;
    if (
      !isExactlyActive(team)
      || !isExactlyActive(organization)
      || clean(team.organizationId) !== candidate.organizationId
    ) {
      return null;
    }
    return candidate;
  }));

  return selectUnambiguousAthleteScope(
    validated.filter(
      (candidate): candidate is PulseCheckAthleteScope => candidate != null,
    ),
  );
};
