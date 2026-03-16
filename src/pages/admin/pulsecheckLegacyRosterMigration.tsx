import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, Loader2, RefreshCcw, Users2 } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import type {
  PulseCheckLegacyCoachRosterCandidate,
  PulseCheckLegacyCoachRosterMigrationResult,
} from '../../api/firebase/pulsecheckProvisioning/types';

type MigrationNamingDraft = {
  organizationName: string;
  teamName: string;
};

const buildLegacyRosterDefaults = (coachDisplayName: string): MigrationNamingDraft => {
  const normalizedCoachName = coachDisplayName.trim() || 'Legacy Coach';
  return {
    organizationName: `${normalizedCoachName} Coaching`,
    teamName: `${normalizedCoachName} Legacy Roster`,
  };
};

const isNamingDraftValid = (draft: MigrationNamingDraft) =>
  Boolean(draft.organizationName.trim()) && Boolean(draft.teamName.trim());

const PulseCheckLegacyRosterMigrationPage: React.FC = () => {
  const [candidates, setCandidates] = useState<PulseCheckLegacyCoachRosterCandidate[]>([]);
  const [results, setResults] = useState<PulseCheckLegacyCoachRosterMigrationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [migratingIds, setMigratingIds] = useState<string[]>([]);
  const [namingDrafts, setNamingDrafts] = useState<Record<string, MigrationNamingDraft>>({});
  const [error, setError] = useState<string | null>(null);

  const loadCandidates = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);

    try {
      const nextCandidates = await pulseCheckProvisioningService.listLegacyCoachRosterCandidates();
      setCandidates(nextCandidates);
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load legacy coach rosters.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadCandidates();
  }, []);

  useEffect(() => {
    setNamingDrafts((current) => {
      const next: Record<string, MigrationNamingDraft> = {};
      let changed = false;

      for (const candidate of candidates) {
        if (candidate.existingTeamId) continue;

        const existingDraft = current[candidate.coachId];
        if (existingDraft) {
          next[candidate.coachId] = existingDraft;
          continue;
        }

        next[candidate.coachId] = buildLegacyRosterDefaults(candidate.coachDisplayName);
        changed = true;
      }

      const currentKeys = Object.keys(current);
      if (currentKeys.length !== Object.keys(next).length) {
        changed = true;
      } else if (!changed) {
        changed = currentKeys.some((coachId) => !next[coachId]);
      }

      return changed ? next : current;
    });
  }, [candidates]);

  const summary = useMemo(() => {
    const migratedCoachIds = new Set(results.map((result) => result.coachId));
    const visibleCandidates = candidates.filter((candidate) => !migratedCoachIds.has(candidate.coachId));
    const coachCount = visibleCandidates.length;
    const athleteCount = visibleCandidates.reduce((sum, candidate) => sum + candidate.athleteCount, 0);
    const alreadyMappedCount = visibleCandidates.filter((candidate) => candidate.existingTeamId).length;
    return { coachCount, athleteCount, alreadyMappedCount };
  }, [candidates, results]);

  const visibleCandidates = useMemo(() => {
    const migratedCoachIds = new Set(results.map((result) => result.coachId));
    return candidates.filter((candidate) => !migratedCoachIds.has(candidate.coachId));
  }, [candidates, results]);

  const getNamingDraft = (candidate: PulseCheckLegacyCoachRosterCandidate) =>
    namingDrafts[candidate.coachId] || buildLegacyRosterDefaults(candidate.coachDisplayName);

  const hasInvalidDrafts = visibleCandidates.some(
    (candidate) => !candidate.existingTeamId && !isNamingDraftValid(getNamingDraft(candidate))
  );

  const handleMigrate = async (candidate: PulseCheckLegacyCoachRosterCandidate) => {
    const coachId = candidate.coachId;
    const draft = getNamingDraft(candidate);
    const organizationName = draft.organizationName.trim();
    const teamName = draft.teamName.trim();

    if (!candidate.existingTeamId && (!organizationName || !teamName)) {
      setError(`Organization and team names are required before creating a new PulseCheck roster for ${candidate.coachDisplayName}.`);
      return false;
    }

    setMigratingIds((current) => [...current, coachId]);
    setError(null);

    try {
      const result = await pulseCheckProvisioningService.migrateLegacyCoachRoster({
        coachId,
        ...(candidate.existingTeamId
          ? {}
          : {
              organizationName,
              teamName,
            }),
      });
      setResults((current) => [result, ...current.filter((entry) => entry.coachId !== coachId)]);
      await loadCandidates('refresh');
      return true;
    } catch (migrationError: any) {
      setError(migrationError?.message || `Failed to migrate roster for ${coachId}.`);
      return false;
    } finally {
      setMigratingIds((current) => current.filter((id) => id !== coachId));
    }
  };

  const handleMigrateAll = async () => {
    for (const candidate of visibleCandidates) {
      // Keep this serial so we can see exactly where failures happen.
      const success = await handleMigrate(candidate);
      if (!success) break;
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>PulseCheck Legacy Roster Migration</title>
      </Head>

      <div className="min-h-screen bg-[#09090b] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10">
          <div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-black/30">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">PulseCheck Migration</p>
                <h1 className="mt-3 text-3xl font-semibold">Legacy coach roster cleanup</h1>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  This migrates active legacy <span className="font-medium text-white">coachAthletes</span> relationships into the
                  PulseCheck organization and team hierarchy. We create one real operating container per legacy coach roster, not one
                  per athlete pair, and we intentionally do not auto-create pilots or cohorts here.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void loadCandidates('refresh')}
                  disabled={refreshing || loading}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => void handleMigrateAll()}
                  disabled={loading || refreshing || visibleCandidates.length === 0 || migratingIds.length > 0 || hasInvalidDrafts}
                  className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {migratingIds.length > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Migrate All Rosters
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/8 p-5">
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-200">Legacy Coaches</div>
                <div className="mt-3 text-4xl font-semibold">{summary.coachCount}</div>
                <div className="mt-2 text-sm text-cyan-100/80">Coach rosters still living outside PulseCheck teams.</div>
              </div>
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/8 p-5">
                <div className="text-xs uppercase tracking-[0.3em] text-emerald-200">Linked Athletes</div>
                <div className="mt-3 text-4xl font-semibold">{summary.athleteCount}</div>
                <div className="mt-2 text-sm text-emerald-100/80">Active athlete relationships ready to backfill into team memberships.</div>
              </div>
              <div className="rounded-3xl border border-amber-500/20 bg-amber-500/8 p-5">
                <div className="text-xs uppercase tracking-[0.3em] text-amber-200">Existing Teams</div>
                <div className="mt-3 text-4xl font-semibold">{summary.alreadyMappedCount}</div>
                <div className="mt-2 text-sm text-amber-100/80">Rosters that can attach to an existing PulseCheck operating team.</div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-amber-400/20 bg-amber-400/6 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
              <div className="text-sm leading-7 text-zinc-200">
                <p className="font-medium text-white">Migration rules</p>
                <p>We create one organization and one team for a legacy coach roster only when the coach does not already have a PulseCheck operating team.</p>
                <p>Existing team memberships win. If an athlete is already on the target team, we mark that relationship as already present instead of duplicating it.</p>
                <p>The output is roster truth only. Pilots and cohorts stay clean until there is a real study design that needs them.</p>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-100">{error}</div>
          ) : null}

          {results.length > 0 ? (
            <div className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/8 p-6">
              <div className="mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <h2 className="text-lg font-medium">Recent migration results</h2>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {results.map((result) => (
                  <div key={result.coachId} className="rounded-3xl border border-white/10 bg-black/25 p-5">
                    <div className="text-lg font-medium">{result.coachDisplayName}</div>
                    <div className="mt-3 text-sm text-zinc-300">
                      {result.organizationName} <span className="text-zinc-500">{'->'}</span> {result.teamName}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                        {result.migratedAthleteCount} athletes migrated
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-zinc-300">
                        {result.alreadyPresentAthleteCount} already present
                      </span>
                      {result.createdOrganization ? (
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">Created org</span>
                      ) : null}
                      {result.createdTeam ? (
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">Created team</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-5">
            {loading ? (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-12 text-center text-zinc-400">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                <p className="mt-4 text-sm">Loading legacy coach rosters...</p>
              </div>
            ) : visibleCandidates.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-12 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
                <h2 className="mt-4 text-xl font-medium">No unmapped legacy coach rosters found</h2>
                <p className="mt-2 text-sm text-zinc-400">There are no active legacy coachAthletes links left to review on this environment.</p>
              </div>
            ) : (
              visibleCandidates.map((candidate) => {
                const isMigrating = migratingIds.includes(candidate.coachId);
                const namingDraft = getNamingDraft(candidate);
                const namingDraftInvalid = !candidate.existingTeamId && !isNamingDraftValid(namingDraft);

                return (
                  <div key={candidate.coachId} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/20">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-2xl font-semibold">{candidate.coachDisplayName}</h2>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.24em] text-zinc-300">
                            {candidate.athleteCount} athletes
                          </span>
                          {candidate.coachReferralCode ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.24em] text-zinc-400">
                              {candidate.coachReferralCode}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-zinc-400">{candidate.coachEmail || 'No coach email found'}</p>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                              <Users2 className="h-4 w-4 text-cyan-300" />
                              Target roster
                            </div>
                            {candidate.existingTeamId ? (
                              <div className="space-y-2 text-sm text-zinc-300">
                                <div>{candidate.existingOrganizationName || candidate.existingOrganizationId}</div>
                                <div className="text-white">{candidate.existingTeamName || candidate.existingTeamId}</div>
                                <div className="text-zinc-500">Role: {candidate.existingTeamMembershipRole || 'team member'}</div>
                              </div>
                            ) : (
                              <div className="space-y-2 text-sm text-zinc-300">
                                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-amber-100">
                                  <Building2 className="h-4 w-4" />
                                  New organization + team will be created
                                </div>
                                <p className="text-zinc-500">This legacy roster does not have a PulseCheck team yet.</p>
                                <div className="grid gap-3 pt-2">
                                  <label className="grid gap-2">
                                    <span className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">Organization Name</span>
                                    <input
                                      type="text"
                                      aria-label={`Organization name for ${candidate.coachDisplayName}`}
                                      placeholder="Organization name"
                                      value={namingDraft.organizationName}
                                      onChange={(event) =>
                                        setNamingDrafts((current) => ({
                                          ...current,
                                          [candidate.coachId]: {
                                            ...(current[candidate.coachId] || buildLegacyRosterDefaults(candidate.coachDisplayName)),
                                            organizationName: event.target.value,
                                          },
                                        }))
                                      }
                                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/50"
                                    />
                                  </label>
                                  <label className="grid gap-2">
                                    <span className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">Team Name</span>
                                    <input
                                      type="text"
                                      aria-label={`Team name for ${candidate.coachDisplayName}`}
                                      placeholder="Team name"
                                      value={namingDraft.teamName}
                                      onChange={(event) =>
                                        setNamingDrafts((current) => ({
                                          ...current,
                                          [candidate.coachId]: {
                                            ...(current[candidate.coachId] || buildLegacyRosterDefaults(candidate.coachDisplayName)),
                                            teamName: event.target.value,
                                          },
                                        }))
                                      }
                                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/50"
                                    />
                                  </label>
                                  <p className="text-xs text-zinc-500">These names are used only if this migration needs to create a new organization and team.</p>
                                  {namingDraftInvalid ? <p className="text-xs text-amber-200">Both names are required before this roster can be migrated.</p> : null}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                            <div className="mb-3 text-sm font-medium text-white">Athlete membership impact</div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                                {candidate.athletes.filter((athlete) => !athlete.alreadyOnTargetTeam).length} to add
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-zinc-300">
                                {candidate.athletes.filter((athlete) => athlete.alreadyOnTargetTeam).length} already present
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleMigrate(candidate)}
                        disabled={isMigrating || migratingIds.length > 0 || namingDraftInvalid}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isMigrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                        Migrate Roster
                      </button>
                    </div>

                    <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
                      <div className="mb-4 text-sm font-medium text-white">Athletes in this roster</div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {candidate.athletes.map((athlete) => (
                          <div key={athlete.athleteUserId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="font-medium text-white">{athlete.athleteDisplayName}</div>
                            <div className="mt-1 text-xs text-zinc-500">{athlete.athleteEmail || athlete.athleteUserId}</div>
                            <div className="mt-3">
                              {athlete.alreadyOnTargetTeam ? (
                                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-zinc-300">Already on target team</span>
                              ) : (
                                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">Will be added as athlete</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckLegacyRosterMigrationPage;
