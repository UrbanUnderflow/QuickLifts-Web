import React from 'react';
import { Users } from 'lucide-react';
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

const adherencePercent = (value?: number) => `${Math.round(Math.max(0, Math.min(100, normalizePct(value))))}%`;

const adherenceTone = (value?: number) => {
  const pct = normalizePct(value);
  if (pct >= 80) return 'text-emerald-300';
  if (pct >= 60) return 'text-zinc-200';
  return 'text-amber-300';
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

  return (
    <article
      className="min-h-full overflow-hidden rounded-3xl border border-zinc-800 bg-[#070912] text-zinc-100 shadow-2xl"
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
                className="mt-5 text-[42px] font-black leading-[0.95] text-white sm:text-[56px]"
                style={{ fontFamily: '"Thunder", "HK Grotesk", -apple-system, BlinkMacSystemFont, sans-serif' }}
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
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: accent }}>Coach move</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-100">{translate(entry.coachMove)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {calendarItems.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">The week ahead</h2>
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
              <p className="text-lg font-medium leading-relaxed text-white">{report.teamSynthesis || fallbackSynthesis(report)}</p>
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
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Participation this week</p>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                Wear <span className={adherenceTone(wearRate)}>{adherencePercent(wearRate)}</span>
                {' · '}daily check-ins <span className={adherenceTone(noraRate)}>{adherencePercent(noraRate)}</span>
                {' · '}mental performance reps <span className={adherenceTone(protocolRate)}>{adherencePercent(protocolRate)}</span>
                {' · '}training context <span className={adherenceTone(trainingRate)}>{adherencePercent(trainingRate)}</span>
              </p>
            </div>
            <p className="text-xs text-zinc-500">
              {adherence.summary || `${adherence.confidenceLabel}. We held back anything thin.`}
            </p>
          </div>
        </section>

        {report.closer && <p className="mt-8 text-center text-sm text-zinc-300">{report.closer}</p>}
        <p className="mt-4 text-center text-xs text-zinc-600">Decision support, not a clearance tool.</p>
      </div>
    </article>
  );
};

export default CoachReportView;
