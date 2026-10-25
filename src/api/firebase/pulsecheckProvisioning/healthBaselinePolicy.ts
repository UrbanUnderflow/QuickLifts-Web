/** Admin-owned collection policy. Provider delivery and athlete authorization are separate. */
export type HealthBaselineConfiguration = { healthBaselineEnabled?: unknown } | null | undefined;

export function isHealthBaselineEnabled(
  team?: HealthBaselineConfiguration,
  organization?: HealthBaselineConfiguration,
): boolean {
  if (typeof team?.healthBaselineEnabled === 'boolean') return team.healthBaselineEnabled;
  if (typeof organization?.healthBaselineEnabled === 'boolean') return organization.healthBaselineEnabled;
  return true;
}
