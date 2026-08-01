export interface PulseCheckWorkspaceScope {
  teamId: string;
  organizationId: string;
}

export const normalizePulseCheckWorkspaceScope = (
  scope?: Partial<PulseCheckWorkspaceScope> | null
): PulseCheckWorkspaceScope | null => {
  const teamId = String(scope?.teamId || '').trim();
  const organizationId = String(scope?.organizationId || '').trim();
  return teamId && organizationId ? { teamId, organizationId } : null;
};

/**
 * Coach-facing readiness data is visible only when both tenancy identifiers
 * match the selected workspace. Missing scope is intentionally not treated as
 * a legacy match: otherwise activity from another team can change this team's
 * dashboard cards.
 */
export const pulseCheckRecordMatchesWorkspace = (
  data: Record<string, unknown>,
  scope: PulseCheckWorkspaceScope
): boolean =>
  String(data.teamId || '').trim() === scope.teamId &&
  String(data.organizationId || '').trim() === scope.organizationId;
