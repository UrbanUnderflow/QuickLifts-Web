import type {
  PulseCheckOperatingRole,
  PulseCheckRosterVisibilityScope,
  PulseCheckTeamMembershipRole,
  StaffPermission,
} from './types';

const STAFF_PERMISSION_VALUES: readonly StaffPermission[] = ['admin', 'administrative', 'coaching', 'athletic_trainer'];

/**
 * Normalize an arbitrary value into a clean, de-duped StaffPermission[]. Tolerant
 * of Firestore returning undefined / stray strings on legacy docs.
 */
export function normalizeStaffCapabilities(value: unknown): StaffPermission[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<StaffPermission>();
  for (const entry of value) {
    const candidate = typeof entry === 'string' ? (entry.trim() as StaffPermission) : null;
    if (candidate && STAFF_PERMISSION_VALUES.includes(candidate)) {
      seen.add(candidate);
    }
  }
  return STAFF_PERMISSION_VALUES.filter((permission) => seen.has(permission));
}

export interface DerivedMembershipAccess {
  teamMembershipRole: PulseCheckTeamMembershipRole;
  operatingRole: PulseCheckOperatingRole;
  rosterVisibilityScope: PulseCheckRosterVisibilityScope;
}

/**
 * Pure mapping from the three coach-facing capability checkboxes onto the legacy
 * membership access fields, so report-routing and the iOS app keep working off
 * the derived role while the dashboard gates directly on staffCapabilities.
 *
 * | capabilities include            | role             | operatingRole              | rosterVisibilityScope |
 * | admin (± others)                | team-admin       | admin-plus-coach           | team                  |
 * | coaching (± others)             | coach            | admin-plus-coach           | team                  |
 * | athletic_trainer only           | performance-staff| admin-plus-support-staff   | team                  |
 * | administrative only (or none)   | team-admin       | admin-only                 | none                  |
 *
 * New dashboard gating MUST key off staffCapabilities directly — these derived
 * fields exist only for backward-compat.
 */
export function deriveMembershipAccessFromCapabilities(
  capabilities: StaffPermission[] | undefined | null
): DerivedMembershipAccess {
  const caps = normalizeStaffCapabilities(capabilities);
  const has = (permission: StaffPermission) => caps.includes(permission);

  // admin is the superuser grant — full access. Maps to the team-admin permission
  // set (iOS) with coach-level roster visibility.
  if (has('admin')) {
    return {
      teamMembershipRole: 'team-admin',
      operatingRole: 'admin-plus-coach',
      rosterVisibilityScope: 'team',
    };
  }

  if (has('coaching')) {
    return {
      teamMembershipRole: 'coach',
      operatingRole: 'admin-plus-coach',
      rosterVisibilityScope: 'team',
    };
  }

  if (has('athletic_trainer')) {
    return {
      teamMembershipRole: 'performance-staff',
      operatingRole: 'admin-plus-support-staff',
      rosterVisibilityScope: 'team',
    };
  }

  // Manager (administrative): schedule + Train Nora, no roster. Post-split a Manager
  // is NOT an admin, so it derives to a non-admin role (support-staff) — this keeps
  // the 'role == team-admin' team-management gate reserved for real admins/founders.
  if (has('administrative')) {
    return {
      teamMembershipRole: 'support-staff',
      operatingRole: 'admin-only',
      rosterVisibilityScope: 'none',
    };
  }

  // Empty/unknown set: legacy permissive default (not reached from redemption, which
  // only derives when capabilities are present).
  return {
    teamMembershipRole: 'team-admin',
    operatingRole: 'admin-only',
    rosterVisibilityScope: 'none',
  };
}
