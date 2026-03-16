import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, Loader2, ShieldCheck, Users } from 'lucide-react';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import type {
  PulseCheckOrganization,
  PulseCheckOrganizationMembership,
  PulseCheckTeam,
  PulseCheckTeamMembership,
  PulseCheckTeamMembershipRole,
} from '../../api/firebase/pulsecheckProvisioning/types';
import { useUser, useUserLoading } from '../../hooks/useUser';

type TeamAccessEntry = {
  membership: PulseCheckTeamMembership;
  organization: PulseCheckOrganization | null;
  team: PulseCheckTeam | null;
  destinationHref: string;
  destinationLabel: string;
  nextStepLabel: string;
};

type OrganizationAccessGroup = {
  organization: PulseCheckOrganization | null;
  organizationId: string;
  organizationMembership: PulseCheckOrganizationMembership | null;
  teams: TeamAccessEntry[];
};

const teamRoleLabel = (role: PulseCheckTeamMembershipRole) => {
  switch (role) {
    case 'team-admin':
      return 'Team Admin';
    case 'performance-staff':
      return 'Performance Staff';
    case 'support-staff':
      return 'Support Staff';
    default:
      return role
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
};

const organizationRoleLabel = (role?: PulseCheckOrganizationMembership['role']) => {
  if (!role) return '';
  if (role === 'org-admin') return 'Org Admin';
  return role
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const teamDestinationForMembership = (membership: PulseCheckTeamMembership) => {
  const baseQuery = `organizationId=${encodeURIComponent(membership.organizationId)}&teamId=${encodeURIComponent(membership.teamId)}`;

  if (membership.role === 'team-admin') {
    return membership.onboardingStatus === 'profile-complete' || membership.onboardingStatus === 'complete'
      ? {
          destinationHref: `/PulseCheck/team-workspace?${baseQuery}`,
          destinationLabel: 'Open Team Workspace',
          nextStepLabel: 'Workspace and rollout controls',
        }
      : {
          destinationHref: `/PulseCheck/post-activation?${baseQuery}`,
          destinationLabel: 'Finish Admin Setup',
          nextStepLabel: 'Post-activation setup',
        };
  }

  if (membership.role === 'athlete') {
    const baselineComplete = membership.athleteOnboarding?.baselinePathStatus === 'complete';

    return membership.onboardingStatus === 'pending-consent'
      ? {
          destinationHref: `/PulseCheck/athlete-onboarding?${baseQuery}`,
          destinationLabel: 'Complete Athlete Onboarding',
          nextStepLabel: 'Consent and baseline entry',
        }
      : !baselineComplete
      ? {
          destinationHref: `/PulseCheck/team-workspace?${baseQuery}`,
          destinationLabel: 'Complete Baseline Tasks',
          nextStepLabel: 'Required tasks before training unlocks',
        }
      : {
          destinationHref: `/PulseCheck/team-workspace?${baseQuery}`,
          destinationLabel: 'Open Team Workspace',
          nextStepLabel: 'Training and team context',
        };
  }

  return membership.onboardingStatus === 'pending-profile'
    ? {
        destinationHref: `/PulseCheck/member-setup?${baseQuery}`,
        destinationLabel: 'Complete Member Setup',
        nextStepLabel: 'Profile and notification setup',
      }
    : {
        destinationHref: `/PulseCheck/team-workspace?${baseQuery}`,
        destinationLabel: 'Open Team Workspace',
        nextStepLabel: 'Operational team workspace',
      };
};

export default function PulseCheckAccessHub() {
  const currentUser = useUser();
  const currentUserLoading = useUserLoading();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [groups, setGroups] = useState<OrganizationAccessGroup[]>([]);

  useEffect(() => {
    if (currentUserLoading) return;
    if (!currentUser?.id) {
      setLoading(false);
      setGroups([]);
      return;
    }

    let active = true;

    (async () => {
      setLoading(true);
      setMessage(null);

      try {
        const [organizationMemberships, teamMemberships] = await Promise.all([
          pulseCheckProvisioningService.listUserOrganizationMemberships(currentUser.id),
          pulseCheckProvisioningService.listUserTeamMemberships(currentUser.id),
        ]);

        const organizationIds = Array.from(
          new Set([
            ...organizationMemberships.map((membership) => membership.organizationId),
            ...teamMemberships.map((membership) => membership.organizationId),
          ].filter(Boolean))
        );
        const teamIds = Array.from(new Set(teamMemberships.map((membership) => membership.teamId).filter(Boolean)));

        const [organizations, teams] = await Promise.all([
          Promise.all(
            organizationIds.map(async (organizationId) => {
              try {
                return await pulseCheckProvisioningService.getOrganization(organizationId);
              } catch {
                return null;
              }
            })
          ),
          Promise.all(
            teamIds.map(async (teamId) => {
              try {
                return await pulseCheckProvisioningService.getTeam(teamId);
              } catch {
                return null;
              }
            })
          ),
        ]);

        if (!active) return;

        const organizationMap = new Map(organizations.filter(Boolean).map((organization) => [organization!.id, organization!]));
        const teamMap = new Map(teams.filter(Boolean).map((team) => [team!.id, team!]));
        const organizationMembershipMap = new Map(
          organizationMemberships.map((membership) => [membership.organizationId, membership])
        );

        const nextGroups = organizationIds
          .map((organizationId) => {
            const organization = organizationMap.get(organizationId) || null;
            const teamsForOrganization = teamMemberships
              .filter((membership) => membership.organizationId === organizationId)
              .map((membership) => ({
                membership,
                organization,
                team: teamMap.get(membership.teamId) || null,
                ...teamDestinationForMembership(membership),
              }))
              .sort((left, right) =>
                String(left.team?.displayName || left.membership.teamId).localeCompare(
                  String(right.team?.displayName || right.membership.teamId)
                )
              );

            return {
              organization,
              organizationId,
              organizationMembership: organizationMembershipMap.get(organizationId) || null,
              teams: teamsForOrganization,
            };
          })
          .sort((left, right) =>
            String(left.organization?.displayName || left.organizationId).localeCompare(
              String(right.organization?.displayName || right.organizationId)
            )
          );

        setGroups(nextGroups);
      } catch (error) {
        console.error('[PulseCheck access hub] Failed to load memberships:', error);
        if (active) {
          setMessage('Failed to load your PulseCheck organizations and teams.');
          setGroups([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUserLoading]);

  const teamCount = useMemo(
    () => groups.reduce((total, group) => total + group.teams.length, 0),
    [groups]
  );

  return (
    <aside className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(224,254,16,0.08),_transparent_36%),#0b0b0d]">
      <div className="space-y-5 p-4 md:p-5">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="inline-flex rounded-2xl border border-[#E0FE10]/20 bg-[#E0FE10]/10 p-3">
            <ShieldCheck className="h-5 w-5 text-[#E0FE10]" />
          </div>
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Access Hub</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Organizations and teams you can enter</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Review every PulseCheck organization and team tied to this account, then jump into the right setup or workspace.
            </p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Organizations</div>
              <div className="mt-2 text-2xl font-semibold text-white">{groups.length}</div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Teams</div>
              <div className="mt-2 text-2xl font-semibold text-white">{teamCount}</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-300">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-[#E0FE10]" />
              Loading your access map...
            </div>
          </div>
        ) : null}

        {!loading && message ? (
          <div className="rounded-[28px] border border-red-500/20 bg-red-500/[0.06] p-5 text-sm text-red-200">
            {message}
          </div>
        ) : null}

        {!loading && !message && groups.length === 0 ? (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-lg font-semibold text-white">No PulseCheck team access yet</h3>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              This account is signed in, but it does not currently have a PulseCheck team membership to open. Once you redeem an invite,
              your organizations and teams will appear here automatically.
            </p>
          </div>
        ) : null}

        {!loading &&
          !message &&
          groups.map((group) => (
            <section
              key={group.organizationId}
              className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 inline-flex rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3">
                  <Building2 className="h-5 w-5 text-cyan-200" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">
                      {group.organization?.displayName || group.organizationId}
                    </h3>
                    {group.organizationMembership ? (
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                        {organizationRoleLabel(group.organizationMembership.role)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {group.teams.length === 0
                      ? 'Organization membership is active, but there is not a team-level workspace attached to this account yet.'
                      : `${group.teams.length} ${group.teams.length === 1 ? 'team' : 'teams'} under this organization.`}
                  </p>
                </div>
              </div>

              {group.teams.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {group.teams.map((entry) => (
                    <article
                      key={entry.membership.id}
                      className="rounded-2xl border border-white/5 bg-black/20 p-4 transition hover:border-white/15"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                          <Users className="h-4 w-4 text-zinc-200" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-white">
                              {entry.team?.displayName || entry.membership.teamId}
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                              {teamRoleLabel(entry.membership.role)}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-zinc-400">
                            {entry.team?.sportOrProgram || entry.team?.teamType || 'PulseCheck team'}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                              Status: {entry.membership.onboardingStatus || 'pending'}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                              Next step: {entry.nextStepLabel}
                            </span>
                          </div>
                          <Link
                            href={entry.destinationHref}
                            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
                          >
                            {entry.destinationLabel}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
      </div>
    </aside>
  );
}
