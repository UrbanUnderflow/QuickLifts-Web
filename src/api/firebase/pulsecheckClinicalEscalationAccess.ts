import { normalizeStaffCapabilities } from './pulsecheckProvisioning/staffCapabilities';
import {
  isActivePulseCheckTeamMembership,
  type PulseCheckTeamMembership,
} from './pulsecheckProvisioning/types';

export interface ClinicalEscalationTeamScope {
  teamId: string;
  athleteUserIds: string[];
}

export type ClinicalEscalationQueueQueryScope =
  | { kind: 'admin' }
  | { kind: 'clinical-team'; teamId: string; athleteUserId: string };

const uniqueStrings = (values: Array<string | undefined>): string[] =>
  Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  ).sort();

/**
 * Mirrors pcCanAccessClinicalTeamAthlete in firestore.rules for the staff-side
 * membership portion of the check. The athlete membership is resolved when a
 * team scope is built below.
 */
export const hasClinicalEscalationMembershipAccess = (
  membership: PulseCheckTeamMembership,
): boolean => {
  if (
    !membership.teamId?.trim()
    || membership.role === 'athlete'
    || !isActivePulseCheckTeamMembership(membership)
  ) {
    return false;
  }

  const capabilities = normalizeStaffCapabilities(membership.staffCapabilities);
  const hasClinicalCapability =
    membership.role === 'team-admin'
    || capabilities.includes('admin')
    || capabilities.includes('athletic_trainer')
    || (
      capabilities.length === 0
      && (membership.role === 'performance-staff' || membership.role === 'clinician')
    );
  const rosterScope = membership.rosterVisibilityScope || 'team';

  return hasClinicalCapability
    && (rosterScope === 'team' || rosterScope === 'assigned');
};

/**
 * Builds the exact team and athlete scope that Firestore can prove from the
 * signed-in staff membership. Inactive athlete memberships never enter a
 * clinical queue query.
 */
export const buildClinicalEscalationTeamScope = (
  staffMembership: PulseCheckTeamMembership,
  teamMemberships: PulseCheckTeamMembership[],
): ClinicalEscalationTeamScope | null => {
  if (!hasClinicalEscalationMembershipAccess(staffMembership)) return null;

  const teamId = staffMembership.teamId.trim();
  const activeAthleteIds = uniqueStrings(
    teamMemberships
      .filter((membership) => (
        membership.teamId === teamId
        && membership.role === 'athlete'
        && isActivePulseCheckTeamMembership(membership)
      ))
      .map((membership) => membership.userId),
  );

  if ((staffMembership.rosterVisibilityScope || 'team') === 'assigned') {
    const allowedAthleteIds = new Set(uniqueStrings(staffMembership.allowedAthleteIds || []));
    return {
      teamId,
      athleteUserIds: activeAthleteIds.filter((athleteId) => allowedAthleteIds.has(athleteId)),
    };
  }

  return { teamId, athleteUserIds: activeAthleteIds };
};

export const mergeClinicalEscalationTeamScopes = (
  scopes: Array<ClinicalEscalationTeamScope | null>,
): ClinicalEscalationTeamScope[] => {
  const athleteIdsByTeam = new Map<string, Set<string>>();
  for (const scope of scopes) {
    if (!scope) continue;
    const teamAthleteIds = athleteIdsByTeam.get(scope.teamId) || new Set<string>();
    for (const athleteId of scope.athleteUserIds) teamAthleteIds.add(athleteId);
    athleteIdsByTeam.set(scope.teamId, teamAthleteIds);
  }

  return Array.from(athleteIdsByTeam.entries())
    .map(([teamId, athleteUserIds]) => ({
      teamId,
      athleteUserIds: Array.from(athleteUserIds).sort(),
    }))
    .sort((left, right) => left.teamId.localeCompare(right.teamId));
};

export const buildClinicalEscalationQueueQueryScopes = (
  isAdmin: boolean,
  teamScopes: ClinicalEscalationTeamScope[],
): ClinicalEscalationQueueQueryScope[] => {
  if (isAdmin) return [{ kind: 'admin' }];

  return teamScopes.flatMap((scope) =>
    scope.athleteUserIds.map((athleteUserId) => ({
      kind: 'clinical-team' as const,
      teamId: scope.teamId,
      athleteUserId,
    })),
  );
};

export const canAccessClinicalEscalationRecord = (
  teamScopes: ClinicalEscalationTeamScope[],
  record: { teamId?: string; athleteUserId?: string },
): boolean => {
  const teamId = record.teamId;
  const athleteUserId = record.athleteUserId;
  if (!teamId || !athleteUserId) return false;
  return teamScopes.some(
    (scope) => scope.teamId === teamId && scope.athleteUserIds.includes(athleteUserId),
  );
};
