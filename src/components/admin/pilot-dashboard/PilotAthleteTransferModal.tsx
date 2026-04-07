import React from 'react';
import { ArrowRightLeft, Loader2, X } from 'lucide-react';

export type PilotAthleteTransferTeamOption = {
  id: string;
  displayName: string;
  sportOrProgram: string;
  status: string;
};

export type PilotAthleteTransferPilotOption = {
  id: string;
  teamId: string;
  name: string;
  studyMode: string;
  status: string;
};

export type PilotAthleteTransferCohortOption = {
  id: string;
  pilotId: string;
  name: string;
  status: string;
};

type Props = {
  isOpen: boolean;
  athleteName: string;
  athleteEmail: string;
  currentTeamName: string;
  currentPilotName: string;
  teamOptions: PilotAthleteTransferTeamOption[];
  pilotOptions: PilotAthleteTransferPilotOption[];
  cohortOptions: PilotAthleteTransferCohortOption[];
  selectedTeamId: string;
  selectedPilotId: string;
  selectedCohortId: string;
  loadingOptions: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onTeamChange: (teamId: string) => void;
  onPilotChange: (pilotId: string) => void;
  onCohortChange: (cohortId: string) => void;
  onConfirm: () => void;
};

const statusToneClassName = (status?: string) => {
  const normalized = (status || '').trim().toLowerCase();
  if (normalized === 'active') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100';
  if (normalized === 'paused') return 'border-amber-400/20 bg-amber-400/10 text-amber-100';
  if (normalized === 'archived' || normalized === 'withdrawn') return 'border-rose-400/20 bg-rose-400/10 text-rose-100';
  return 'border-white/10 bg-white/5 text-zinc-300';
};

export const PilotAthleteTransferModal: React.FC<Props> = ({
  isOpen,
  athleteName,
  athleteEmail,
  currentTeamName,
  currentPilotName,
  teamOptions,
  pilotOptions,
  cohortOptions,
  selectedTeamId,
  selectedPilotId,
  selectedCohortId,
  loadingOptions,
  saving,
  error,
  onClose,
  onTeamChange,
  onPilotChange,
  onCohortChange,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const selectedTeam = teamOptions.find((team) => team.id === selectedTeamId) || null;
  const selectedPilot = pilotOptions.find((pilot) => pilot.id === selectedPilotId) || null;
  const selectedCohort = cohortOptions.find((cohort) => cohort.id === selectedCohortId) || null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0f17] shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#11151f] px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-cyan-400/10 text-cyan-100">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Transfer athlete</div>
                <h3 className="mt-1 text-xl font-semibold text-white">{athleteName}</h3>
              </div>
            </div>
            <p className="mt-3 text-sm text-zinc-400">{athleteEmail || 'No email on file'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-0 lg:grid-cols-[280px,minmax(0,1fr)]">
          <div className="border-b border-white/10 bg-[#0f1420] p-6 lg:border-b-0 lg:border-r">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Current placement</div>
            <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Team</div>
              <div className="mt-2 text-base font-semibold text-white">{currentTeamName}</div>
              <div className="mt-4 text-xs uppercase tracking-[0.16em] text-zinc-500">Pilot</div>
              <div className="mt-2 text-sm text-zinc-200">{currentPilotName || 'No pilot selected'}</div>
            </div>

            <div className="mt-6 text-xs uppercase tracking-[0.18em] text-zinc-500">Destination preview</div>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Team</div>
                <div className="mt-2 text-sm font-medium text-white">{selectedTeam?.displayName || 'Choose a team'}</div>
                <div className="mt-1 text-xs text-zinc-400">{selectedTeam?.sportOrProgram || 'No sport/program set'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Pilot</div>
                <div className="mt-2 text-sm font-medium text-white">{selectedPilot?.name || 'Team only for now'}</div>
                <div className="mt-1 text-xs text-zinc-400">
                  {selectedPilot ? `${selectedPilot.studyMode || 'operational'} study mode` : 'No pilot enrollment will be created.'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Cohort</div>
                <div className="mt-2 text-sm font-medium text-white">{selectedCohort?.name || 'No cohort assignment'}</div>
              </div>
            </div>
          </div>

          <div className="min-h-[520px] bg-[#0b0f17] p-6">
            {loadingOptions ? (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-[28px] border border-white/10 bg-[#11151f]">
                <div className="flex items-center gap-3 text-sm text-zinc-300">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading transfer options…
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-3xl border border-cyan-400/15 bg-cyan-400/10 p-4 text-sm leading-6 text-cyan-50">
                  Transferring removes this athlete from the current team. If you choose a destination pilot below, they will land there with
                  their current consent/onboarding state preserved.
                </div>

                {error ? (
                  <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">{error}</div>
                ) : null}

                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-zinc-500">Destination team</label>
                  {teamOptions.length === 0 ? (
                    <div className="mt-3 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
                      No other teams exist under this organization yet. Create the volleyball team in provisioning first, then come back here to
                      transfer athletes.
                    </div>
                  ) : (
                    <>
                      <select
                        value={selectedTeamId}
                        onChange={(event) => onTeamChange(event.target.value)}
                        disabled={saving}
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">Choose destination team</option>
                        {teamOptions.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.displayName} • {team.sportOrProgram || 'No sport/program'}
                          </option>
                        ))}
                      </select>
                      {selectedTeam ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                          <span className={`rounded-full border px-3 py-1 ${statusToneClassName(selectedTeam.status)}`}>
                            {(selectedTeam.status || 'provisioning').toUpperCase()}
                          </span>
                          <span>{selectedTeam.sportOrProgram || 'No sport/program set'}</span>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-zinc-500">Destination pilot</label>
                  <select
                    value={selectedPilotId}
                    onChange={(event) => onPilotChange(event.target.value)}
                    disabled={saving || !selectedTeamId}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Move to team only</option>
                    {pilotOptions.map((pilot) => (
                      <option key={pilot.id} value={pilot.id}>
                        {pilot.name} • {pilot.studyMode || 'operational'}
                      </option>
                    ))}
                  </select>
                  {!selectedTeamId ? (
                    <div className="mt-2 text-xs text-zinc-500">Pick a destination team first.</div>
                  ) : pilotOptions.length === 0 ? (
                    <div className="mt-2 text-xs text-zinc-500">
                      No pilots exist on the selected team yet. This transfer will move the athlete to the team only.
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-zinc-500">
                      Optional. Leave this blank if you only want to move them to the destination team for now.
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-zinc-500">Destination cohort</label>
                  <select
                    value={selectedCohortId}
                    onChange={(event) => onCohortChange(event.target.value)}
                    disabled={saving || !selectedPilotId}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">No cohort assignment</option>
                    {cohortOptions.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>
                        {cohort.name}
                      </option>
                    ))}
                  </select>
                  {!selectedPilotId ? (
                    <div className="mt-2 text-xs text-zinc-500">Pick a destination pilot if you want a cohort assignment.</div>
                  ) : cohortOptions.length === 0 ? (
                    <div className="mt-2 text-xs text-zinc-500">This pilot does not have any cohorts yet.</div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={saving || loadingOptions || !selectedTeamId}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d7ff00] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#c5eb00] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                    {saving ? 'Transferring...' : 'Transfer athlete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PilotAthleteTransferModal;
