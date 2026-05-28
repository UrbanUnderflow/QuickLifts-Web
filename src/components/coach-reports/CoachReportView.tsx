import React from 'react';
import { Activity, Brain, CheckCircle2, MessageCircle, Users } from 'lucide-react';
import type { CoachReportCoachSurface } from '../../api/firebase/pulsecheckCoachReports';
export type { CoachReportCoachSurface } from '../../api/firebase/pulsecheckCoachReports';
import {
  PulseCheckSportConfigurationEntry,
  PulseCheckSportReportPolicy,
  applyCoachLanguageTranslations,
  composeGameDayLookFors,
  composeReportTopLine,
  composeTeamRead,
  enforceCoachActionSpecificity,
  enforceNamedAthleteWatchlist,
  sanitizeCoachReportCopyForMentalLayer,
} from '../../api/firebase/pulsecheckSportConfig';
import { getSportColor } from '../../api/firebase/pulsecheckSportReportDemos';

interface CoachReportViewProps {
  report: CoachReportCoachSurface;
  sport: PulseCheckSportConfigurationEntry;
  generatedAtLabel?: string;
}

const STATE_TONE: Record<string, { label: string; bg: string; ring: string; text: string }> = {
  solid: { label: 'Solid', bg: 'bg-emerald-500/12', ring: 'ring-emerald-400/40', text: 'text-emerald-300' },
  watch: { label: 'One to watch', bg: 'bg-amber-500/12', ring: 'ring-amber-400/40', text: 'text-amber-200' },
  declining: { label: 'Trending down', bg: 'bg-rose-500/12', ring: 'ring-rose-400/40', text: 'text-rose-200' },
  thin_evidence: { label: 'Thin read', bg: 'bg-zinc-500/12', ring: 'ring-zinc-500/40', text: 'text-zinc-300' },
};

const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const dayShort: Record<typeof dayOrder[number], string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

const capitalize = (value: string) => (value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value);

const initialsFor = (name: string): string | null => {
  const trimmed = name.split(',')[0].split(' and ')[0].trim();
  const dotMatch = trimmed.match(/^([A-Z])\.?\s+([A-Z])[a-z]+/);
  if (dotMatch) return `${dotMatch[1]}${dotMatch[2]}`;
  const fullMatch = trimmed.match(/^([A-Z])[a-z]+\s+([A-Z])[a-z]+/);
  if (fullMatch) return `${fullMatch[1]}${fullMatch[2]}`;
  return null;
};

const Avatar: React.FC<{ name: string; accent: string; soft: string; size?: 'sm' | 'md' }> = ({ name, accent, soft, size = 'md' }) => {
  const initials = initialsFor(name);
  const dim = size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs';
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide ${dim}`}
      style={{ background: soft, color: accent, boxShadow: `inset 0 0 0 1px ${accent}33` }}
    >
      {initials || <Users className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
    </span>
  );
};

const detectDay = (session?: string): { index: number; label: string } | null => {
  const lower = (session || '').toLowerCase();
  for (let index = 0; index < dayOrder.length; index += 1) {
    const day = dayOrder[index];
    if (lower.includes(day)) return { index, label: dayShort[day] };
  }
  return null;
};

const normalizePct = (value?: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric <= 1 ? numeric * 100 : numeric;
};

const clampPct = (value?: number) => Math.round(Math.max(0, Math.min(100, normalizePct(value))));

const adherencePercent = (value?: number) => `${clampPct(value)}%`;

const adherenceTone = (value?: number) => {
  const pct = normalizePct(value);
  if (pct >= 80) return 'text-emerald-300';
  if (pct >= 60) return 'text-zinc-200';
  return 'text-amber-300';
};

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const readinessLabelFor = (score?: number) => {
  if (!Number.isFinite(Number(score))) return 'Pending';
  const pct = clampPct(score);
  if (pct >= 82) return 'Ready';
  if (pct >= 70) return 'Mostly ready';
  if (pct >= 58) return 'Uneven';
  return 'Needs attention';
};

const readinessToneFor = (score?: number) => {
  if (!Number.isFinite(Number(score))) return 'text-zinc-400';
  const pct = clampPct(score);
  if (pct >= 82) return 'text-emerald-300';
  if (pct >= 70) return 'text-sky-300';
  if (pct >= 58) return 'text-amber-300';
  return 'text-rose-300';
};

const inferReadinessScore = (state: CoachReportCoachSurface['dimensionState']) => {
  const scores = Object.values(state || {})
    .map((value) => {
      if (value === 'solid') return 84;
      if (value === 'watch') return 70;
      if (value === 'declining') return 56;
      return null;
    })
    .filter((value): value is 84 | 70 | 56 => typeof value === 'number');
  if (scores.length === 0) return undefined;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
};

const formatCountPair = (completed?: number, expected?: number) => {
  if (!Number.isFinite(Number(completed)) || !Number.isFinite(Number(expected)) || Number(expected) <= 0) {
    return undefined;
  }
  return `${Math.round(Number(completed))}/${Math.round(Number(expected))} completed`;
};

const missingAdherenceText = (entry: NonNullable<CoachReportCoachSurface['adherence']['followUpAthletes']>[number]) => {
  const missedCheckins = Math.max(0, Math.round(Number(entry.missedCheckins || 0)));
  const missedMentalTrainings = Math.max(0, Math.round(Number(entry.missedMentalTrainings || 0)));
  const parts = [
    missedCheckins > 0 ? pluralize(missedCheckins, 'check-in') : '',
    missedMentalTrainings > 0 ? pluralize(missedMentalTrainings, 'assigned mental training') : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' + ') : entry.followUpReason || 'Needs a quick adherence check';
};

const fallbackSynthesis = (report: CoachReportCoachSurface) => {
  const state = report.dimensionState || {};
  const watch = Object.entries(state).filter(([, value]) => value === 'watch').map(([key]) => key);
  const declining = Object.entries(state).filter(([, value]) => value === 'declining').map(([key]) => key);
  if (declining.length > 0) return `${capitalize(declining[0])} is the layer that needs the most coaching this week.`;
  if (watch.length === 1) return `This is a ${watch[0]} week — start there and keep the rest simple.`;
  if (watch.length > 1) return `Several layers need attention this week — start with ${watch[0]}.`;
  return 'The team read is clean enough to maintain the plan.';
};

const buildCalendarItems = (actions: CoachReportCoachSurface['coachActions']) => {
  return (actions || []).map((action) => ({ action, day: detectDay(action.session) }))
    .sort((a, b) => (a.day?.index ?? 99) - (b.day?.index ?? 99));
};

const translationFor = (policy?: PulseCheckSportReportPolicy) => (text: string) =>
  applyCoachLanguageTranslations(text, policy);

const CoachReportView: React.FC<CoachReportViewProps> = ({ report, sport, generatedAtLabel }) => {
  const policy = sport.reportPolicy;
  const colors = getSportColor(sport.id);
  const accent = report.meta.primarySportColor || colors.primary;
  const soft = report.meta.primarySportColorSoft || colors.soft;
  const translate = translationFor(policy);
  const topLine = composeReportTopLine(report.topLine, { sportName: sport.name });
  const watchlistGate = enforceNamedAthleteWatchlist(report.watchlist || []);
  const actionGate = enforceCoachActionSpecificity(report.coachActions || []);
  const gameDayGate = composeGameDayLookFors(report.gameDayLookFors || []);
  const teamRead = policy ? composeTeamRead(report.dimensionState || {}, policy) : undefined;
  const teamSynthesis = sanitizeCoachReportCopyForMentalLayer(
    report.teamSynthesis || fallbackSynthesis(report),
    'This week, the physical pattern tells us where focus, composure, or decision-making may get harder. The report should stop at the mental-performance moment and should not recommend changes to the physical plan.'
  );
  const calendarItems = buildCalendarItems(actionGate.rendered);
  const adherence = report.adherence || {
    wearRate7d: 0,
    noraCheckinCompletion7d: 0,
    protocolOrSimCompletion7d: 0,
    trainingOrNutritionCoverage7d: 0,
    confidenceLabel: 'Thin read',
  };
  const wearRate = adherence.wearRate7d ?? adherence.deviceCoveragePct;
  const noraRate = adherence.noraCheckinCompletion7d ?? adherence.noraCompletionPct;
  const protocolRate = adherence.protocolOrSimCompletion7d ?? adherence.protocolSimulationCompletionPct;
  const trainingRate = adherence.trainingOrNutritionCoverage7d ?? adherence.trainingNutritionCoveragePct;
  const overallAdherenceRate =
    adherence.overallAdherencePct
    ?? adherence.overallAdherenceRate
    ?? ((normalizePct(noraRate) + normalizePct(protocolRate)) / 2);
  const readinessScore = report.teamReadiness?.score ?? inferReadinessScore(report.dimensionState || {});
  const readinessLabel = report.teamReadiness?.label || readinessLabelFor(readinessScore);
  const readinessSummary =
    report.teamReadiness?.summary
    || 'Team readiness blends recovery, check-in signal, and current performance-state movement.';
  const checkinCountText = formatCountPair(adherence.completedCheckins, adherence.expectedCheckins);
  const mentalTrainingCountText = formatCountPair(adherence.completedMentalTrainings, adherence.expectedMentalTrainings);
  const followUpAthletes = (adherence.followUpAthletes || []).slice(0, 4);

  return (
    <article
      className="min-h-full overflow-hidden rounded-b-3xl border border-zinc-800 bg-[#070912] text-zinc-100 shadow-2xl"
      style={{
        background: `
          radial-gradient(ellipse 110% 55% at 50% -20%, ${accent}20 0%, transparent 58%),
          radial-gradient(ellipse 60% 40% at 100% 12%, ${accent}12 0%, transparent 70%),
          linear-gradient(180deg, #080a14 0%, #050608 100%)
        `,
      }}
    >
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${accent} 0%, ${accent}66 50%, transparent 100%)` }} />
      <div className="px-5 py-7 sm:px-8 sm:py-9">
        <header className="border-b border-zinc-800/80 pb-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-2xl"
                  style={{ background: soft, boxShadow: `inset 0 0 0 1px ${accent}40` }}
                >
                  {sport.emoji}
                </span>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em]" style={{ color: accent }}>
                    Pulse Sports Intelligence
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">{report.meta.teamName}</p>
                </div>
              </div>
              <h1
                className="mt-5 text-[38px] font-semibold leading-[1.08] text-white sm:text-[50px]"
              >
                {sport.name} — This Week
              </h1>
              <p className="mt-3 text-sm text-zinc-400">{report.meta.weekLabel}</p>
            </div>
            {(report.meta.generatedAt || generatedAtLabel) && (
              <p className="text-xs text-zinc-500">Sent {report.meta.generatedAt || generatedAtLabel}</p>
            )}
          </div>
        </header>

        <section className="mt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">Weekly snapshot</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Overall readiness and athlete adherence before the coach moves.
              </p>
            </div>
            {adherence.athleteCount ? (
              <p className="text-xs text-zinc-500">{adherence.athleteCount} athletes in this read</p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: soft, color: accent }}>
                    <Activity className="h-4 w-4" />
                  </span>
                  <span className={`text-xs font-medium ${readinessToneFor(readinessScore)}`}>{readinessLabel}</span>
                </div>
                <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Team readiness</p>
                <p className="mt-1 text-4xl font-semibold tracking-tight text-white">{readinessScore !== undefined ? `${clampPct(readinessScore)}` : '--'}</p>
                <p className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-zinc-500">
                  {report.teamReadiness?.trend || readinessSummary}
                </p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full" style={{ width: `${readinessScore !== undefined ? clampPct(readinessScore) : 0}%`, background: accent }} />
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <span className={`text-xs font-medium ${adherenceTone(overallAdherenceRate)}`}>{adherence.confidenceLabel}</span>
                </div>
                <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Overall adherence</p>
                <p className="mt-1 text-4xl font-semibold tracking-tight text-white">{adherencePercent(overallAdherenceRate)}</p>
                <p className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-zinc-500">
                  Daily check-ins plus assigned mental trainings.
                </p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${clampPct(overallAdherenceRate)}%` }} />
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/12 text-sky-300">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <span className={`text-xs font-medium ${adherenceTone(noraRate)}`}>{adherencePercent(noraRate)}</span>
                </div>
                <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Daily check-ins</p>
                <p className="mt-1 text-xl font-semibold text-white">{checkinCountText || 'Completion trend'}</p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">Athletes completing the daily signal Pulse needs.</p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/12 text-violet-300">
                    <Brain className="h-4 w-4" />
                  </span>
                  <span className={`text-xs font-medium ${adherenceTone(protocolRate)}`}>{adherencePercent(protocolRate)}</span>
                </div>
                <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Mental trainings</p>
                <p className="mt-1 text-xl font-semibold text-white">{mentalTrainingCountText || 'Completion trend'}</p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">Assigned reset, focus, or pressure work completed.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">Follow-up queue</h3>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">Athletes missing check-ins or assigned mental trainings.</p>
                </div>
                <span className="rounded-full border border-zinc-800 bg-black/30 px-2.5 py-1 text-xs text-zinc-400">
                  {followUpAthletes.length || 0} flagged
                </span>
              </div>
              {followUpAthletes.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {followUpAthletes.map((entry, index) => (
                    <div key={`${entry.athleteName}-${index}`} className="flex gap-3 rounded-xl border border-zinc-800/80 bg-black/20 p-3">
                      <Avatar name={entry.athleteName} accent={accent} soft={soft} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{entry.athleteName}</p>
                        {entry.role && <p className="text-xs text-zinc-500">{entry.role}</p>}
                        <p className="mt-1 text-xs leading-relaxed text-zinc-300">{missingAdherenceText(entry)}</p>
                        {entry.followUpReason && (
                          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{entry.followUpReason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-zinc-800/80 bg-black/20 p-4 text-sm text-zinc-400">
                  No adherence follow-ups flagged this week.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8">
          {report.noteOpener && <p className="mb-4 text-sm leading-relaxed text-zinc-400">{report.noteOpener}</p>}
          <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/75 p-6">
            <div className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
            <p className="text-[11px] font-medium uppercase tracking-[0.22em]" style={{ color: accent }}>
              Priority this week
            </p>
            <p className="mt-3 text-[18px] font-medium leading-[1.55] text-white">
              {translate(topLine.primary)}
            </p>
            {topLine.secondary && (
              <p className="mt-4 border-t border-zinc-800 pt-4 text-sm leading-relaxed text-zinc-300">
                {translate(topLine.secondary)}
              </p>
            )}
          </div>
        </section>

        {!watchlistGate.suppressed && (
          <section className="mt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">Athletes to watch</h2>
                <p className="mt-1 text-xs text-zinc-600">{watchlistGate.rendered.length} named — not a ranking</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {watchlistGate.rendered.map((entry, index) => (
                <div key={`${entry.athleteName}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={entry.athleteName} accent={accent} soft={soft} />
                    <div>
                      <p className="font-semibold text-white">{entry.athleteName}</p>
                      {entry.role && <p className="text-xs text-zinc-500">{entry.role}</p>}
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-300">{translate(entry.whyMatters)}</p>
                  <div className="mt-4 rounded-xl p-4" style={{ background: soft }}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: accent }}>What the coach says</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-100">{translate(entry.coachMove)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {calendarItems.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">Coach actions</h2>
            <ul className="mt-4 divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-950/45">
              {calendarItems.map(({ action, day }, index) => (
                <li key={`${action.action}-${index}`} className="flex gap-4 px-5 py-4">
                  <span
                    className="flex h-9 w-12 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold uppercase"
                    style={{ background: day ? soft : 'rgba(39,39,42,0.7)', color: day ? accent : '#a1a1aa' }}
                  >
                    {day?.label || 'Any'}
                  </span>
                  <div>
                    <p className="text-sm text-zinc-100">{translate(action.action)}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {[action.appliesTo, action.session].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {teamRead && (
          <section className="mt-8">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">The team this week</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {teamRead.lines.map((line) => {
                const tone = STATE_TONE[line.state] || STATE_TONE.thin_evidence;
                return (
                  <div key={line.dimension} className={`rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 ring-1 ${tone.ring}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold capitalize text-white">{line.dimension}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${tone.bg} ${tone.text}`}>
                        {tone.label}
                      </span>
                    </div>
                    {line.cue && line.state !== 'thin_evidence' && (
                      <p className="mt-3 text-xs leading-relaxed text-zinc-400">{translate(line.cue)}</p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 rounded-2xl border p-5" style={{ background: `${accent}10`, borderColor: `${accent}33` }}>
              <p className="text-lg font-medium leading-relaxed text-white">{teamSynthesis}</p>
            </div>
          </section>
        )}

        {!gameDayGate.suppressed && (
          <section className="mt-8">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">Game-day</h2>
            <div className="mt-4 space-y-3">
              {gameDayGate.items.map((item, index) => (
                <div key={`${item.athleteOrUnit}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={item.athleteOrUnit} accent={accent} soft={soft} size="sm" />
                    <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: accent }}>{item.athleteOrUnit}</p>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-[7rem_1fr]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">If you see</p>
                    <p className="text-sm leading-relaxed text-zinc-200">{translate(item.lookFor)}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Then</p>
                    <p className="text-sm leading-relaxed text-zinc-100">{translate(item.ifThen)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-950/45 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Data coverage this week</p>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                Wear <span className={adherenceTone(wearRate)}>{adherencePercent(wearRate)}</span>
                {' · '}daily check-ins <span className={adherenceTone(noraRate)}>{adherencePercent(noraRate)}</span>
                {' · '}mental trainings <span className={adherenceTone(protocolRate)}>{adherencePercent(protocolRate)}</span>
                {' · '}training context <span className={adherenceTone(trainingRate)}>{adherencePercent(trainingRate)}</span>
              </p>
            </div>
            <p className="text-xs text-zinc-500">
              {adherence.summary || `${adherence.confidenceLabel}. We held back anything thin.`}
            </p>
          </div>
        </section>

        {report.closer && <p className="mt-8 text-center text-sm text-zinc-300">{report.closer}</p>}
        <p className="mt-4 text-center text-xs text-zinc-600">This report explains mental-performance moments. It is not a clearance tool or a physical training plan.</p>
      </div>
    </article>
  );
};

export default CoachReportView;
