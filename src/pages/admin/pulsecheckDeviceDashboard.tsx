import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  Smartphone,
  Users2,
  WifiOff,
} from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import type {
  PulseCheckOrganization,
  PulseCheckTeam,
} from '../../api/firebase/pulsecheckProvisioning/types';
import {
  loadTeamDeviceStatuses,
  summarizeDeviceStatuses,
  DEVICE_MONITOR_DEFAULT_WINDOW_DAYS,
  type AthleteDeviceStatus,
  type AthleteDeviceConnectionStatus,
  type TeamDeviceStatusSummary,
} from '../../api/firebase/pulsecheckDeviceMonitor';

const WINDOW_OPTIONS = [7, 14, 30];

type StatusFilter = 'all' | AthleteDeviceConnectionStatus;

const STATUS_UI: Record<AthleteDeviceConnectionStatus, { label: string; badge: string; dot: string }> = {
  synced: {
    label: 'Synced',
    badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    dot: 'bg-emerald-400',
  },
  stale: {
    label: 'Stale',
    badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    dot: 'bg-amber-400',
  },
  not_connected: {
    label: 'Not connected',
    badge: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    dot: 'bg-rose-400',
  },
};

const formatRelative = (unixSeconds: number | null): string => {
  if (!unixSeconds) return 'Never';
  const diffSec = Math.max(0, Math.round(Date.now() / 1000) - unixSeconds);
  if (diffSec < 60) return 'Just now';
  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

const coverageColor = (pct: number): string => {
  if (pct >= 70) return 'bg-emerald-400';
  if (pct >= 35) return 'bg-amber-400';
  return 'bg-rose-400';
};

const StatTile: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
    <p className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500">{label}</p>
    <p className={`mt-1 text-2xl font-semibold ${accent || 'text-white'}`}>{value}</p>
  </div>
);

const DeviceDashboardInner: React.FC = () => {
  const router = useRouter();
  const focusOrg = typeof router.query.focusOrg === 'string' ? router.query.focusOrg : '';
  const focusTeam = typeof router.query.focusTeam === 'string' ? router.query.focusTeam : '';

  const [team, setTeam] = useState<PulseCheckTeam | null>(null);
  const [organization, setOrganization] = useState<PulseCheckOrganization | null>(null);
  const [statuses, setStatuses] = useState<AthleteDeviceStatus[]>([]);
  const [windowDays, setWindowDays] = useState<number>(DEVICE_MONITOR_DEFAULT_WINDOW_DAYS);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [lastComputedAt, setLastComputedAt] = useState<number | null>(null);

  const loadContext = useCallback(async () => {
    if (!focusTeam) return;
    try {
      const [teamRecord, orgRecord] = await Promise.all([
        pulseCheckProvisioningService.getTeam(focusTeam),
        focusOrg ? pulseCheckProvisioningService.getOrganization(focusOrg) : Promise.resolve(null),
      ]);
      setTeam(teamRecord);
      setOrganization(orgRecord);
    } catch (err) {
      console.error('[PulseCheckDeviceDashboard] Failed to load team context:', err);
    }
  }, [focusTeam, focusOrg]);

  const loadStatuses = useCallback(async () => {
    if (!focusTeam) {
      setError('No team specified. Open this dashboard from the onboarding playbook.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await loadTeamDeviceStatuses(focusTeam, windowDays);
      setStatuses(result.statuses);
      setLastComputedAt(result.computedAt);
    } catch (err) {
      console.error('[PulseCheckDeviceDashboard] Failed to load device statuses:', err);
      setError('Could not load device statuses. Check the team and try again.');
    } finally {
      setLoading(false);
    }
  }, [focusTeam, windowDays]);

  useEffect(() => {
    if (!router.isReady) return;
    void loadContext();
  }, [router.isReady, loadContext]);

  useEffect(() => {
    if (!router.isReady) return;
    void loadStatuses();
  }, [router.isReady, loadStatuses]);

  const summary: TeamDeviceStatusSummary = useMemo(() => summarizeDeviceStatuses(statuses), [statuses]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return statuses.filter((status) => {
      if (statusFilter !== 'all' && status.connectionStatus !== statusFilter) return false;
      if (!term) return true;
      return (
        status.displayName.toLowerCase().includes(term) ||
        (status.email || '').toLowerCase().includes(term) ||
        status.currentDeviceLabel.toLowerCase().includes(term)
      );
    });
  }, [statuses, search, statusFilter]);

  const teamName = team?.displayName || 'Team';
  const orgName = organization?.displayName || '';

  const filterChips: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: summary.athletes },
    { key: 'synced', label: 'Synced', count: summary.synced },
    { key: 'stale', label: 'Stale', count: summary.stale },
    { key: 'not_connected', label: 'Not connected', count: summary.notConnected },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e16] text-white">
      <Head>
        <title>Device Dashboard · PulseCheck</title>
      </Head>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/admin/pulsecheckOnboardingOverview"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Onboarding Playbook
            </Link>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]">
                <Smartphone className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold text-white">Device Dashboard</h1>
                <p className="truncate text-sm text-slate-400">
                  {orgName ? `${orgName} · ` : ''}
                  {teamName}
                  {lastComputedAt ? ` · updated ${formatRelative(lastComputedAt)}` : ''}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-white/10 bg-black/40 p-0.5">
              {WINDOW_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setWindowDays(option)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    windowDays === option ? 'bg-[#00d4aa]/15 text-[#00d4aa]' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {option}d
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void loadStatuses()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        ) : null}

        {/* Stat tiles */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Athletes" value={String(summary.athletes)} />
          <StatTile label="Synced" value={String(summary.synced)} accent="text-emerald-300" />
          <StatTile label="Stale" value={String(summary.stale)} accent="text-amber-300" />
          <StatTile label="Not connected" value={String(summary.notConnected)} accent="text-rose-300" />
          <StatTile label={`Avg wear (${windowDays}d)`} value={`${summary.avgWearCoveragePct}%`} />
        </div>

        {/* Controls */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setStatusFilter(chip.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === chip.key
                    ? 'border-[#00d4aa]/40 bg-[#00d4aa]/10 text-[#00d4aa]'
                    : 'border-white/10 bg-white/[0.02] text-slate-400 hover:text-white'
                }`}
              >
                {chip.label}
                <span className="rounded-full bg-black/30 px-1.5 text-[10px]">{chip.count}</span>
              </button>
            ))}
          </div>
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search athlete or device"
              className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-[#00d4aa]/40 focus:outline-none sm:w-72"
            />
          </label>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#10141d]">
          <div className="hidden grid-cols-[2fr_1.2fr_1fr_1fr_1.6fr] gap-4 border-b border-white/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 lg:grid">
            <span>Athlete</span>
            <span>Current device</span>
            <span>Status</span>
            <span>Last sync</span>
            <span>Wear consistency ({windowDays}d)</span>
          </div>

          {loading && statuses.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading device statuses…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-slate-400">
              <Users2 className="h-6 w-6 text-slate-600" />
              {statuses.length === 0
                ? 'No athletes on this team yet, or no device data in the window.'
                : 'No athletes match the current filters.'}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((status) => {
                const ui = STATUS_UI[status.connectionStatus];
                return (
                  <div
                    key={status.athleteUserId}
                    className="grid grid-cols-1 gap-3 px-4 py-3 lg:grid-cols-[2fr_1.2fr_1fr_1fr_1.6fr] lg:items-center lg:gap-4"
                  >
                    {/* Athlete */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${ui.dot}`} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{status.displayName}</p>
                        {status.email ? <p className="truncate text-xs text-slate-500">{status.email}</p> : null}
                      </div>
                    </div>

                    {/* Current device */}
                    <div className="flex items-center gap-2 text-sm text-slate-200">
                      {status.currentDeviceFamily ? (
                        <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <WifiOff className="h-3.5 w-3.5 text-slate-600" />
                      )}
                      <span className={status.currentDeviceFamily ? '' : 'text-slate-500'}>
                        {status.currentDeviceLabel}
                      </span>
                    </div>

                    {/* Status */}
                    <div>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ui.badge}`}>
                        {status.connectionStatus === 'synced' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : status.connectionStatus === 'stale' ? (
                          <Activity className="h-3 w-3" />
                        ) : (
                          <WifiOff className="h-3 w-3" />
                        )}
                        {ui.label}
                      </span>
                    </div>

                    {/* Last sync */}
                    <div className="text-sm text-slate-300">{formatRelative(status.lastObservedAt)}</div>

                    {/* Wear consistency */}
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-1 items-end gap-[2px]" title={`${status.wearDaysCovered}/${status.windowDays} days with data`}>
                          {status.dailyPresence.map((present, dayIndex) => (
                            <span
                              key={dayIndex}
                              className={`h-5 flex-1 rounded-sm ${present ? coverageColor(status.wearCoveragePct) : 'bg-white/[0.06]'}`}
                            />
                          ))}
                        </div>
                        <span className="w-10 flex-shrink-0 text-right text-xs font-semibold text-slate-300">
                          {status.wearCoveragePct}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Wear consistency is the share of the last {windowDays} days that produced device data. A device with no
          data in 36h reads as stale. Self-report and coach-entered lanes are excluded from device status.
        </p>
      </div>
    </div>
  );
};

const PulseCheckDeviceDashboardPage: React.FC = () => (
  <AdminRouteGuard>
    <DeviceDashboardInner />
  </AdminRouteGuard>
);

export default PulseCheckDeviceDashboardPage;
