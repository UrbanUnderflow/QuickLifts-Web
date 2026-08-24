import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  FlaskConical,
  Layers3,
  RefreshCcw,
  Search,
  Users2,
} from 'lucide-react';
import AdminRouteGuard from '../../auth/AdminRouteGuard';
import { pulseCheckPilotDashboardService } from '../../../api/firebase/pulsecheckPilotDashboard/service';
import type {
  PilotDashboardAthleteRosterEntry,
  PilotDashboardHierarchyPilotSummary,
  PilotDashboardOrganizationDetail,
  PilotDashboardTeamDetail,
} from '../../../api/firebase/pulsecheckPilotDashboard/types';
import type {
  PulseCheckPilot,
  PulseCheckPilotCohort,
} from '../../../api/firebase/pulsecheckProvisioning/types';
import PilotTeamMultiSelect, { type PilotTeamFilterOption } from './PilotTeamMultiSelect';
import { PilotDashboardThemeFrame, PilotDashboardThemeToggle } from './PilotDashboardTheme';

type HierarchyScope = 'organization' | 'team';
type HierarchyDetail = PilotDashboardOrganizationDetail | PilotDashboardTeamDetail;
type HierarchyTab = 'overview' | 'teams' | 'athletes' | 'pilots' | 'cohorts';
type PilotLifecycleFilter = 'all' | PulseCheckPilot['status'];

interface PilotDashboardHierarchyPageProps {
  scope: HierarchyScope;
}

const DASHBOARD_PATH = '/admin/pulsecheckPilotDashboard';

const normalizeQueryValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value.find((item) => item.trim())?.trim() || '';
  return typeof value === 'string' ? value.trim() : '';
};

const titleCase = (value: string) =>
  value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const seconds = Number((value as { seconds?: number; _seconds?: number }).seconds ?? (value as { _seconds?: number })._seconds);
  if (Number.isFinite(seconds) && seconds > 0) return new Date(seconds * 1000);
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value: unknown) => {
  const date = toDate(value);
  return date
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
};

const formatSchedule = (pilot: PulseCheckPilot) => {
  const start = formatDate(pilot.startAt);
  const end = formatDate(pilot.endAt);
  if (start && end) return `${start} to ${end}`;
  if (start) return `Starts ${start}`;
  if (end) return `Ends ${end}`;
  return 'No dates set';
};

const getStatusMeta = (status: string) => {
  switch (status) {
    case 'active':
      return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100';
    case 'completed':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-100';
    case 'paused':
    case 'implementation-hold':
      return 'border-sky-400/25 bg-sky-400/10 text-sky-100';
    case 'archived':
    case 'withdrawn':
    case 'removed':
      return 'border-rose-400/25 bg-rose-400/10 text-rose-100';
    case 'pending-consent':
    case 'pending':
    case 'provisioning':
    case 'ready-for-activation':
      return 'border-amber-400/25 bg-amber-400/10 text-amber-100';
    default:
      return 'border-white/15 bg-white/[0.04] text-white/60';
  }
};

const getInitials = (value: string) => {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'PC';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
};

const getAthleteScopeContexts = (
  athlete: PilotDashboardAthleteRosterEntry,
  scope: HierarchyScope,
  scopeId: string,
) =>
  athlete.teamContexts.filter((context) =>
    scope === 'team' ? context.teamId === scopeId : context.organizationId === scopeId
  );

const getPilotLifecycleCounts = (pilots: PilotDashboardHierarchyPilotSummary[]) =>
  pilots.reduce(
    (counts, item) => {
      counts[item.pilot.status] = (counts[item.pilot.status] || 0) + 1;
      return counts;
    },
    {} as Record<string, number>
  );

const EmptySection: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="pilot-detail-panel rounded-[24px] border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
    <div className="text-sm font-semibold text-white/75">{title}</div>
    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/42">{body}</p>
  </div>
);

const PilotDashboardHierarchyPage: React.FC<PilotDashboardHierarchyPageProps> = ({ scope }) => {
  const router = useRouter();
  const hierarchyId = normalizeQueryValue(
    scope === 'organization' ? router.query.organizationId : router.query.teamId
  );
  const [detail, setDetail] = useState<HierarchyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<HierarchyTab>('overview');
  const [athleteSearchQuery, setAthleteSearchQuery] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [pilotLifecycleFilter, setPilotLifecycleFilter] = useState<PilotLifecycleFilter>('all');
  const loadRequestIdRef = useRef(0);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!router.isReady || !hierarchyId) return;
    const requestId = ++loadRequestIdRef.current;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);

    try {
      setDemoModeEnabled(pulseCheckPilotDashboardService.isDemoModeEnabled());
      const nextDetail = scope === 'organization'
        ? await pulseCheckPilotDashboardService.getOrganizationDashboardDetail(hierarchyId)
        : await pulseCheckPilotDashboardService.getTeamDashboardDetail(hierarchyId);
      if (requestId !== loadRequestIdRef.current) return;
      setDetail(nextDetail);
    } catch (loadError: any) {
      if (requestId !== loadRequestIdRef.current) return;
      setError(loadError?.message || `Failed to load ${scope} details.`);
    } finally {
      if (requestId !== loadRequestIdRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [hierarchyId, router.isReady, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setActiveTab('overview');
    setAthleteSearchQuery('');
    setSelectedTeamIds([]);
    setPilotLifecycleFilter('all');
  }, [hierarchyId, scope]);

  const organization = detail?.organization || null;
  const teamDetail = detail && 'team' in detail ? detail : null;
  const organizationDetail = detail && !('team' in detail) ? detail : null;
  const pilots = detail?.pilots || [];
  const cohorts = detail?.cohorts || [];
  const athletes = detail?.athletes || [];
  const scopeName = teamDetail?.team.displayName || organization?.displayName || '';
  const detailTestId = scope === 'organization' ? 'pilot-organization-detail' : 'pilot-team-detail';
  const notFoundTestId = scope === 'organization' ? 'pilot-organization-not-found' : 'pilot-team-not-found';

  const tabs = useMemo<Array<{ id: HierarchyTab; label: string; count?: number }>>(() => {
    const values: Array<{ id: HierarchyTab; label: string; count?: number }> = [
      { id: 'overview', label: 'Overview' },
    ];
    if (scope === 'organization') values.push({ id: 'teams', label: 'Teams', count: organizationDetail?.teams.length || 0 });
    values.push(
      { id: 'athletes', label: 'Athletes', count: athletes.length },
      { id: 'pilots', label: 'Pilots', count: pilots.length },
      { id: 'cohorts', label: 'Cohorts', count: cohorts.length },
    );
    return values;
  }, [athletes.length, cohorts.length, organizationDetail?.teams.length, pilots.length, scope]);

  const teamOptions = useMemo<PilotTeamFilterOption[]>(() => {
    if (!organizationDetail) return [];
    return organizationDetail.teams.map((item) => ({
      id: item.team.id,
      teamName: item.team.displayName,
      organizationName: organizationDetail.organization.displayName,
      athleteCount: item.activeRosterAthleteCount,
    }));
  }, [organizationDetail]);

  const filteredAthletes = useMemo(() => {
    const normalizedSearch = athleteSearchQuery.trim().toLowerCase();
    const selectedTeamIdSet = new Set(selectedTeamIds);
    return athletes.filter((athlete) => {
      const contexts = getAthleteScopeContexts(athlete, scope, hierarchyId);
      if (selectedTeamIdSet.size > 0 && !contexts.some((context) => selectedTeamIdSet.has(context.teamId))) {
        return false;
      }
      if (!normalizedSearch) return true;
      return [
        athlete.displayName,
        athlete.email,
        ...contexts.flatMap((context) => [context.teamName, context.pilotName || '', context.cohortName || '']),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [athleteSearchQuery, athletes, hierarchyId, scope, selectedTeamIds]);

  const filteredPilots = useMemo(
    () => pilots.filter((item) => pilotLifecycleFilter === 'all' || item.pilot.status === pilotLifecycleFilter),
    [pilotLifecycleFilter, pilots]
  );

  const pilotLifecycleCounts = useMemo(() => getPilotLifecycleCounts(pilots), [pilots]);
  const pilotById = useMemo(() => new Map(pilots.map((item) => [item.pilot.id, item])), [pilots]);
  const teamNameById = useMemo(
    () => new Map((organizationDetail?.teams || []).map((item) => [item.team.id, item.team.displayName])),
    [organizationDetail]
  );

  const renderOverview = () => {
    if (!detail) return null;
    const summaryCards = [
      ...(scope === 'organization'
        ? [{ label: 'Teams', value: organizationDetail?.summary.teamCount || 0, icon: Building2 }]
        : []),
      { label: 'Active athletes', value: detail.summary.activeRosterAthleteCount, icon: Users2 },
      { label: 'Pilots', value: detail.summary.pilotCount, icon: FlaskConical },
      { label: 'Cohorts', value: detail.summary.cohortCount, icon: Layers3 },
      { label: 'Active enrollments', value: detail.summary.activeEnrollmentCount, icon: CheckCircle2 },
    ];

    return (
      <div data-testid="overview-section" className="space-y-5">
        <div className={`grid gap-3 sm:grid-cols-2 ${scope === 'organization' ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="pilot-detail-panel rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">{card.label}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/10 text-[#9cf4e2]">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <div className="pilot-font-mono mt-5 text-3xl text-white">{card.value}</div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
          <section className="pilot-detail-panel rounded-[26px] border border-white/10 bg-white/[0.03] p-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Group snapshot</div>
            <h2 className="mt-2 text-xl font-semibold text-white">What is currently in {scopeName}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/48">
              Current team membership is kept separate from pilot enrollment, so an athlete can remain on the roster even when a pilot is completed or they are not enrolled in one.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Pending consent', value: detail.summary.pendingConsentEnrollmentCount },
                { label: 'Withdrawn history', value: detail.summary.withdrawnEnrollmentCount },
                { label: 'Total enrollment records', value: detail.summary.totalEnrollmentCount },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="pilot-font-mono text-xl text-white">{item.value}</div>
                  <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/32">{item.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="pilot-detail-panel rounded-[26px] border border-white/10 bg-white/[0.03] p-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Pilot lifecycle</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Current pilot mix</h2>
            <div className="mt-5 space-y-3">
              {(['active', 'completed', 'paused', 'draft', 'archived'] as PulseCheckPilot['status'][]).map((status) => (
                <div key={status} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] ${getStatusMeta(status)}`}>
                    {titleCase(status)}
                  </span>
                  <span className="pilot-font-mono text-sm text-white/70">{pilotLifecycleCounts[status] || 0}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {organizationDetail && organizationDetail.teams.length > 0 ? (
          <section className="pilot-detail-panel rounded-[26px] border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Teams</div>
                <h2 className="mt-2 text-xl font-semibold text-white">Teams inside this organization</h2>
              </div>
              <button type="button" onClick={() => setActiveTab('teams')} className="pilot-theme-soft-action rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white">
                View all teams
              </button>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {organizationDetail.teams.slice(0, 4).map((item) => (
                <Link
                  key={item.team.id}
                  href={`${DASHBOARD_PATH}/teams/${encodeURIComponent(item.team.id)}`}
                  data-testid={`pilot-team-open-${item.team.id}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-[#00d4aa]/30 hover:bg-[#00d4aa]/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00d4aa]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white group-hover:text-[#9cf4e2]">{item.team.displayName}</div>
                      <div className="mt-1 truncate text-xs text-white/42">{item.team.sportOrProgram || item.team.teamType || 'Team'}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/35 transition group-hover:translate-x-1 group-hover:text-[#9cf4e2]" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-white/50">
                    <span>{item.activeRosterAthleteCount} athletes</span>
                    <span aria-hidden="true">•</span>
                    <span>{item.pilotCount} pilots</span>
                    <span aria-hidden="true">•</span>
                    <span>{item.cohortCount} cohorts</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  };

  const renderTeams = () => {
    if (!organizationDetail) return null;
    if (organizationDetail.teams.length === 0) {
      return (
        <section data-testid="teams-section">
          <EmptySection title="No teams yet" body="This organization exists, but no teams have been added to it yet." />
        </section>
      );
    }
    return (
      <section data-testid="teams-section">
        <div className="grid gap-4 xl:grid-cols-2">
          {organizationDetail.teams.map((item) => {
            const teamPilots = pilots.filter((pilot) => pilot.pilot.teamId === item.team.id);
            const completedPilotCount = teamPilots.filter((pilot) => pilot.pilot.status === 'completed').length;
            return (
              <Link
                key={item.team.id}
                href={`${DASHBOARD_PATH}/teams/${encodeURIComponent(item.team.id)}`}
                data-testid={`pilot-team-open-${item.team.id}`}
                className="pilot-detail-panel group rounded-[26px] border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#00d4aa]/30 hover:bg-[#00d4aa]/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00d4aa]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                      <Users2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-white group-hover:text-[#9cf4e2]">{item.team.displayName}</h2>
                      <p className="mt-1 truncate text-sm text-white/42">{item.team.sportOrProgram || item.team.teamType || 'Team'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getStatusMeta(item.team.status)}`}>
                      {titleCase(item.team.status)}
                    </span>
                    <ArrowRight className="h-4 w-4 text-white/35 transition group-hover:translate-x-1 group-hover:text-[#9cf4e2]" />
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: 'Athletes', value: item.activeRosterAthleteCount },
                    { label: 'Pilots', value: item.pilotCount },
                    { label: 'Completed', value: completedPilotCount },
                    { label: 'Cohorts', value: item.cohortCount },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                      <div className="pilot-font-mono text-lg text-white">{metric.value}</div>
                      <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">{metric.label}</div>
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    );
  };

  const renderAthletes = () => (
    <section data-testid="athletes-section" className="space-y-4">
      {scope === 'organization' && teamOptions.length > 1 ? (
        <div className="pilot-detail-panel rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <PilotTeamMultiSelect
            options={teamOptions}
            selectedTeamIds={selectedTeamIds}
            totalAthleteCount={athletes.length}
            onChange={setSelectedTeamIds}
          />
        </div>
      ) : null}

      <div className="pilot-detail-panel rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Current athletes</h2>
            <p className="mt-1 text-sm text-white/45">Active team members in this {scope}.</p>
          </div>
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              type="search"
              value={athleteSearchQuery}
              onChange={(event) => setAthleteSearchQuery(event.target.value)}
              placeholder="Search athletes, teams, pilots, cohorts..."
              aria-label="Search athletes"
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#00d4aa]/40 focus-visible:ring-2 focus-visible:ring-[#00d4aa]/30"
            />
          </div>
        </div>
      </div>

      {athletes.length === 0 ? (
        <EmptySection title="No athletes on this roster" body={`This ${scope} is ready to remain visible even before its first athlete joins.`} />
      ) : filteredAthletes.length === 0 ? (
        <EmptySection title="No athletes match these filters" body="Clear the search or selected teams to show the full roster again." />
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.02]">
          <div className="divide-y divide-white/[0.07]">
            {filteredAthletes.map((athlete) => {
              const contexts = getAthleteScopeContexts(athlete, scope, hierarchyId);
              const visibleContexts = selectedTeamIds.length > 0
                ? contexts.filter((context) => selectedTeamIds.includes(context.teamId))
                : contexts;
              const primaryContext = visibleContexts[0] || contexts[0];
              const athletePilotLink = primaryContext?.pilotId && primaryContext.enrollmentStatus === 'active'
                ? `${DASHBOARD_PATH}/${encodeURIComponent(primaryContext.pilotId)}/athletes/${encodeURIComponent(athlete.athleteUserId)}`
                : '';
              return (
                <div key={athlete.athleteUserId} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_auto] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    {athlete.profileImageUrl ? (
                      <img src={athlete.profileImageUrl} alt="" className="h-11 w-11 shrink-0 rounded-full border border-white/10 object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-xs font-semibold text-cyan-100">
                        {getInitials(athlete.displayName || athlete.email)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{athlete.displayName || athlete.email || 'Athlete'}</div>
                      <div className="mt-1 truncate text-xs text-white/42">{athlete.email || 'No email on file'}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {visibleContexts.map((context) => (
                      <span key={context.key} className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60">
                        <span className="font-semibold text-white/80">{context.teamName || 'Team'}</span>
                        {context.pilotName ? <span className="text-white/40">{context.pilotName}</span> : null}
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${getStatusMeta(context.enrollmentStatus === 'none' ? 'draft' : context.enrollmentStatus)}`}>
                          {context.enrollmentStatus === 'none' ? 'Team member' : titleCase(context.enrollmentStatus)}
                        </span>
                      </span>
                    ))}
                  </div>

                  {athletePilotLink ? (
                    <Link href={athletePilotLink} className="inline-flex items-center gap-2 justify-self-start text-sm font-medium text-[#7cefd6] transition hover:text-white lg:justify-self-end">
                      View pilot record
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span className="text-xs text-white/35 lg:text-right">Not enrolled in an active pilot</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );

  const renderPilots = () => (
    <section data-testid="pilots-section" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" aria-label="Filter pilots by lifecycle">
        {(['all', 'active', 'completed', 'paused', 'draft', 'archived'] as PilotLifecycleFilter[]).map((status) => {
          const count = status === 'all' ? pilots.length : pilotLifecycleCounts[status] || 0;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setPilotLifecycleFilter(status)}
              aria-pressed={pilotLifecycleFilter === status}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00d4aa] ${
                pilotLifecycleFilter === status
                  ? 'border-[#00d4aa]/35 bg-[#00d4aa]/10 text-[#9cf4e2]'
                  : 'border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white/80'
              }`}
            >
              {titleCase(status)} <span className="pilot-font-mono ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {pilots.length === 0 ? (
        <EmptySection title="No pilots yet" body={`This ${scope} has no configured pilots yet. It remains available as a group workspace.`} />
      ) : filteredPilots.length === 0 ? (
        <EmptySection title="No pilots in this lifecycle" body="Choose another lifecycle to view the pilot history for this group." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredPilots.map((item) => (
            <Link
              key={item.pilot.id}
              href={`${DASHBOARD_PATH}/${encodeURIComponent(item.pilot.id)}`}
              data-testid={`pilot-pilot-open-${item.pilot.id}`}
              className="pilot-detail-panel group rounded-[26px] border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#00d4aa]/30 hover:bg-[#00d4aa]/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00d4aa]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.17em] text-white/32">
                    {scope === 'organization' ? teamNameById.get(item.pilot.teamId) || 'Team' : titleCase(item.pilot.studyMode)}
                  </div>
                  <h2 className="mt-2 truncate text-lg font-semibold text-white group-hover:text-[#9cf4e2]">{item.pilot.name}</h2>
                  <p className="mt-1 text-sm text-white/42">{formatSchedule(item.pilot)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getStatusMeta(item.pilot.status)}`}>
                    {titleCase(item.pilot.status)}
                  </span>
                  <ArrowRight className="h-4 w-4 text-white/35 transition group-hover:translate-x-1 group-hover:text-[#9cf4e2]" />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Active', value: item.activeEnrollmentCount },
                  { label: 'Pending', value: item.pendingConsentEnrollmentCount },
                  { label: 'Withdrawn', value: item.withdrawnEnrollmentCount },
                  { label: 'Cohorts', value: item.cohorts.length },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                    <div className="pilot-font-mono text-lg text-white">{metric.value}</div>
                    <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-white/30">{metric.label}</div>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );

  const renderCohorts = () => {
    if (cohorts.length === 0) {
      return <section data-testid="cohorts-section"><EmptySection title="No cohorts yet" body="Cohorts will appear here once they are created inside a pilot." /></section>;
    }
    return (
      <section data-testid="cohorts-section" className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.02]">
        <div className="divide-y divide-white/[0.07]">
          {cohorts.map((cohort: PulseCheckPilotCohort) => {
            const parentPilot = pilotById.get(cohort.pilotId)?.pilot;
            const teamName = scope === 'organization' ? teamNameById.get(cohort.teamId) : teamDetail?.team.displayName;
            return (
              <div key={cohort.id} className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{cohort.name}</div>
                  <div className="mt-1 truncate text-xs text-white/42">{teamName || 'Team not available'}</div>
                </div>
                <div className="min-w-0">
                  {parentPilot ? (
                    <Link href={`${DASHBOARD_PATH}/${encodeURIComponent(parentPilot.id)}`} className="inline-flex max-w-full items-center gap-2 text-sm text-[#7cefd6] transition hover:text-white">
                      <span className="truncate">{parentPilot.name}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    </Link>
                  ) : (
                    <span className="text-sm text-white/35">Pilot not available</span>
                  )}
                  <div className="mt-1 text-xs text-white/35">{cohort.cohortType ? titleCase(cohort.cohortType) : 'Pilot cohort'}</div>
                </div>
                <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getStatusMeta(cohort.status)}`}>
                  {titleCase(cohort.status)}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const renderActivePanel = () => {
    switch (activeTab) {
      case 'teams':
        return renderTeams();
      case 'athletes':
        return renderAthletes();
      case 'pilots':
        return renderPilots();
      case 'cohorts':
        return renderCohorts();
      case 'overview':
      default:
        return renderOverview();
    }
  };

  const headerFacts = detail
    ? scope === 'organization'
      ? [
          { label: 'Status', value: titleCase(detail.organization.status) },
          { label: 'Type', value: titleCase(detail.organization.organizationType || 'Organization') },
          { label: 'Study posture', value: titleCase(detail.organization.defaultStudyPosture || 'Not set') },
          { label: 'Clinician bridge', value: titleCase(detail.organization.defaultClinicianBridgeMode || 'Not set') },
          { label: 'Customer admin', value: detail.organization.primaryCustomerAdminName || detail.organization.primaryCustomerAdminEmail || 'Not assigned' },
        ]
      : [
          { label: 'Status', value: titleCase(teamDetail?.team.status || '') },
          { label: 'Sport / program', value: teamDetail?.team.sportOrProgram || 'Not set' },
          { label: 'Team type', value: titleCase(teamDetail?.team.teamType || 'Team') },
          { label: 'Invite policy', value: titleCase(teamDetail?.team.defaultInvitePolicy || 'Not set') },
          { label: 'Team admin', value: teamDetail?.team.defaultAdminName || teamDetail?.team.defaultAdminEmail || 'Not assigned' },
        ]
    : [];

  return (
    <AdminRouteGuard>
      <PilotDashboardThemeFrame>
        <Head>
          <title>{scopeName ? `${scopeName} | Pilot Dashboard` : `${titleCase(scope)} Details | Pilot Dashboard`}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Fraunces:opsz,wght@9..144,300..700&display=swap" rel="stylesheet" />
          <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800,900&display=swap" />
        </Head>

        <div className="pilot-detail-theme pilot-font-body min-h-screen text-white" data-testid={detailTestId}>
          <div className="pilot-ambient-layer" aria-hidden="true">
            <div className="pilot-ambient-orb pilot-ambient-orb-teal" />
            <div className="pilot-ambient-orb pilot-ambient-orb-blue" />
            <div className="pilot-ambient-orb pilot-ambient-orb-amber" />
          </div>

          <div className="relative z-10">
            <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(7,9,15,0.82)] backdrop-blur-2xl">
              <div className="mx-auto flex h-[52px] max-w-[1700px] items-center justify-between px-4 sm:px-8">
                <div className="flex min-w-0 items-center gap-4">
                  <Link href={DASHBOARD_PATH} className="pilot-font-display flex items-center gap-2 text-sm font-bold tracking-[-0.03em] text-white">
                    <span className="pilot-logo-dot" />
                    PulseCheck
                  </Link>
                  <div className="hidden h-5 w-px bg-white/10 sm:block" />
                  <Link href={DASHBOARD_PATH} className="inline-flex items-center gap-2 truncate text-xs text-white/40 transition hover:text-white/75">
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                    Pilot directory
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void load('refresh')}
                    disabled={loading || refreshing}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-45"
                  >
                    <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                  <PilotDashboardThemeToggle compact />
                  <span className={`hidden rounded-lg border px-3 py-1.5 text-[11px] md:inline-flex ${demoModeEnabled ? 'border-amber-400/20 bg-amber-400/10 text-amber-100' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'}`}>
                    {demoModeEnabled ? 'Demo dataset' : 'Live dataset'}
                  </span>
                </div>
              </div>
            </header>

            <div className="border-b border-white/10">
              <div className="mx-auto max-w-[1700px] px-4 pb-5 pt-6 sm:px-8">
                <div className="max-w-5xl">
                  <nav aria-label="Pilot dashboard hierarchy" className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#00d4aa]">
                    <Link href={DASHBOARD_PATH} className="rounded-sm transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00d4aa]">
                      Pilot Dashboard
                    </Link>
                    <span aria-hidden="true" className="text-[#00d4aa]/55">/</span>
                    {scope === 'team' && organization ? (
                      <>
                        <Link
                          href={`${DASHBOARD_PATH}/organizations/${encodeURIComponent(organization.id)}`}
                          data-testid="pilot-team-detail-organization-link"
                          className="rounded-sm transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00d4aa]"
                        >
                          {organization.displayName}
                        </Link>
                        <span aria-hidden="true" className="text-[#00d4aa]/55">/</span>
                      </>
                    ) : null}
                    <span aria-current="page" className="text-[#9cf4e2]">{scopeName || titleCase(scope)}</span>
                  </nav>
                  <div className="mt-3 flex items-start gap-4">
                    <span className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#00d4aa]/20 bg-[#00d4aa]/10 text-[#9cf4e2]">
                      {scope === 'organization' ? <Building2 className="h-5 w-5" /> : <Users2 className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">{titleCase(scope)} details</div>
                      <h1 className="pilot-font-display mt-1 text-3xl font-bold tracking-[-0.04em] text-white sm:text-[2.35rem]">{scopeName || `${titleCase(scope)} details`}</h1>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50 sm:text-[15px]">
                        {scope === 'organization'
                          ? 'A contained view of every team, athlete, pilot, and cohort in this organization.'
                          : `A contained view of this team's athletes, pilots, and cohorts inside ${organization?.displayName || 'its organization'}.`}
                      </p>
                    </div>
                  </div>

                  {headerFacts.length > 0 ? (
                    <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                      {headerFacts.map((item) => (
                        <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30">{item.label}</div>
                          <div className="mt-1 truncate text-xs font-medium text-white/75" title={item.value}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <main className="px-4 py-6 sm:px-8 sm:py-7">
              <div className="mx-auto max-w-[1700px]">
                {loading ? (
                  <div className="pilot-detail-panel rounded-[28px] p-8 text-sm text-white/50" role="status">Loading {scope} details...</div>
                ) : error ? (
                  <div className="rounded-[28px] border border-rose-500/30 bg-rose-500/10 p-8 text-sm text-rose-200" role="alert">{error}</div>
                ) : !detail ? (
                  <div data-testid={notFoundTestId} className="pilot-detail-panel rounded-[28px] border border-white/10 bg-white/[0.03] p-8">
                    <div className="text-lg font-semibold text-white">{titleCase(scope)} not found</div>
                    <p className="mt-2 text-sm leading-6 text-white/45">The record may have moved, or this link may no longer be valid.</p>
                    <Link
                      href={DASHBOARD_PATH}
                      data-testid={`${notFoundTestId}-back`}
                      className="pilot-theme-soft-action mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Pilot Dashboard
                    </Link>
                  </div>
                ) : (
                  <>
                    <div role="tablist" aria-label={`${titleCase(scope)} detail sections`} className="overflow-x-auto border-b border-white/10">
                      <div className="flex min-w-max gap-1">
                        {tabs.map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            id={`pilot-hierarchy-tab-${tab.id}`}
                            aria-controls={`pilot-hierarchy-panel-${tab.id}`}
                            aria-selected={activeTab === tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            data-testid={`pilot-hierarchy-tab-${tab.id}`}
                            className={`relative -mb-px inline-flex items-center gap-2 whitespace-nowrap px-5 py-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#00d4aa] ${
                              activeTab === tab.id
                                ? 'text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#00d4aa]'
                                : 'text-white/38 hover:text-white/75'
                            }`}
                          >
                            {tab.label}
                            {typeof tab.count === 'number' ? (
                              <span className="pilot-font-mono rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/45">{tab.count}</span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div
                      id={`pilot-hierarchy-panel-${activeTab}`}
                      role="tabpanel"
                      aria-labelledby={`pilot-hierarchy-tab-${activeTab}`}
                      className="mt-5"
                    >
                      {renderActivePanel()}
                    </div>
                  </>
                )}
              </div>
            </main>
          </div>
        </div>
      </PilotDashboardThemeFrame>
    </AdminRouteGuard>
  );
};

export default PilotDashboardHierarchyPage;
