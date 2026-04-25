import React, { useMemo } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { Users } from 'lucide-react';
import {
  CoachActionCandidate,
  PulseCheckSportConfigurationEntry,
  PulseCheckSportReportPolicy,
  ReportDimensionStateMap,
  applyCoachLanguageTranslations,
  composeGameDayLookFors,
  composeReportTopLine,
  composeTeamRead,
  enforceCoachActionSpecificity,
  enforceNamedAthleteWatchlist,
  getDefaultPulseCheckSports,
} from '../../api/firebase/pulsecheckSportConfig';
import {
  COACH_REPORT_DEMO_EXAMPLES,
  CoachReportDemoExample,
  getSportColor,
} from '../../api/firebase/pulsecheckSportReportDemos';

// Public, full-page, coach-first weekly report demo. Designed to feel like a
// thoughtful note from an assistant coach — not an analyst's deliverable.
// This route is intentionally PUBLIC (whitelisted in AuthWrapper) so stakeholders
// can review the demo without needing accounts. Internal QA artifacts (review
// status, audit chips, confidence-tier internal names) are absent on this
// surface; reviewer-facing details belong on the admin reviewer screen, not on
// the coach's report.

const STATE_TONE: Record<string, { label: string; bg: string; ring: string; text: string }> = {
  solid: { label: 'Solid', bg: 'bg-emerald-500/12', ring: 'ring-emerald-400/40', text: 'text-emerald-300' },
  watch: { label: 'One to watch', bg: 'bg-amber-500/12', ring: 'ring-amber-400/40', text: 'text-amber-200' },
  declining: { label: 'Trending down', bg: 'bg-rose-500/12', ring: 'ring-rose-400/40', text: 'text-rose-200' },
  thin_evidence: { label: 'Thin evidence', bg: 'bg-zinc-500/12', ring: 'ring-zinc-500/40', text: 'text-zinc-300' },
};

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_SHORT: Record<typeof DAY_ORDER[number], string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

const detectDay = (session: string | undefined): { dayIndex: number; dayLabel: string } | null => {
  if (!session) return null;
  const lower = session.toLowerCase();
  for (let i = 0; i < DAY_ORDER.length; i++) {
    if (lower.includes(DAY_ORDER[i])) {
      return { dayIndex: i, dayLabel: DAY_SHORT[DAY_ORDER[i]] };
    }
  }
  return null;
};

// Returns initials for a person-shaped name (e.g. "M. Johnson" → "MJ", "Bryan
// Holloway" → "BH"). Returns null for unit-shaped names ("sprinters as a group",
// "rotation guards", "whole team") so the renderer can fall back to a unit icon.
const getInitials = (name: string): string | null => {
  if (!name) return null;
  const trimmed = name.split(',')[0].split(' and ')[0].trim();
  // "X. Lastname" pattern (very common in roster shorthand)
  const dotMatch = trimmed.match(/^([A-Z])\.?\s+([A-Z])[a-z]+/);
  if (dotMatch) return `${dotMatch[1]}${dotMatch[2]}`;
  // "Firstname Lastname" pattern
  const fullMatch = trimmed.match(/^([A-Z])[a-z]+\s+([A-Z])[a-z]+/);
  if (fullMatch) return `${fullMatch[1]}${fullMatch[2]}`;
  return null;
};

const composeFallbackTeamSynthesis = (state: Partial<ReportDimensionStateMap>): string => {
  const declining = (Object.keys(state) as Array<keyof ReportDimensionStateMap>).filter((k) => state[k] === 'declining');
  const watch = (Object.keys(state) as Array<keyof ReportDimensionStateMap>).filter((k) => state[k] === 'watch');
  const solid = (Object.keys(state) as Array<keyof ReportDimensionStateMap>).filter((k) => state[k] === 'solid');
  if (declining.length > 0) {
    return `${capitalize(String(declining[0]))} is the layer that needs the most coaching this week — handle that before anything else.`;
  }
  if (watch.length === 1 && solid.length === 2) {
    return `This is a ${watch[0]}-week — the other layers are reading clean.`;
  }
  if (watch.length >= 2) {
    return `Several layers to manage this week — start with ${watch[0]}.`;
  }
  if (solid.length === 3) {
    return `Everything\'s reading clean. Just maintain.`;
  }
  return `Evidence is uneven this week — strong claims are held back where it\'s thin.`;
};

const capitalize = (value: string) => (value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value);

const coverageBadge = (value: string, tone: 'strong' | 'good' | 'thin') => {
  const cls = tone === 'strong' ? 'text-emerald-300' : tone === 'good' ? 'text-zinc-200' : 'text-amber-300';
  return <span className={`font-semibold ${cls}`}>{value}</span>;
};

interface PageState {
  sport: PulseCheckSportConfigurationEntry | undefined;
  policy: PulseCheckSportReportPolicy | undefined;
  demo: CoachReportDemoExample | undefined;
}

const useReportData = (sportId: string | undefined): PageState => {
  return useMemo(() => {
    if (!sportId) return { sport: undefined, policy: undefined, demo: undefined };
    const sports = getDefaultPulseCheckSports();
    const sport = sports.find((s) => s.id === sportId);
    return {
      sport,
      policy: sport?.reportPolicy,
      demo: COACH_REPORT_DEMO_EXAMPLES[sportId],
    };
  }, [sportId]);
};

const formatGeneratedAt = () => {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

interface AvatarProps {
  name: string;
  accent: string;
  accentSoft: string;
  size?: 'sm' | 'md';
}

const AthleteAvatar: React.FC<AvatarProps> = ({ name, accent, accentSoft, size = 'md' }) => {
  const initials = getInitials(name);
  const dim = size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs';
  if (initials) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide ${dim}`}
        style={{ background: accentSoft, color: accent, boxShadow: `inset 0 0 0 1px ${accent}33` }}
      >
        {initials}
      </span>
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${dim}`}
      style={{ background: accentSoft, color: accent, boxShadow: `inset 0 0 0 1px ${accent}33` }}
    >
      <Users className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </span>
  );
};

interface WeekCalendarItem {
  dayIndex: number;
  dayLabel: string;
  action: CoachActionCandidate;
}

const buildWeekCalendar = (actions: CoachActionCandidate[]): { dayed: WeekCalendarItem[]; anytime: CoachActionCandidate[] } => {
  const dayed: WeekCalendarItem[] = [];
  const anytime: CoachActionCandidate[] = [];
  for (const action of actions) {
    const detected = detectDay(action.session);
    if (detected) {
      dayed.push({ dayIndex: detected.dayIndex, dayLabel: detected.dayLabel, action });
    } else {
      anytime.push(action);
    }
  }
  dayed.sort((a, b) => a.dayIndex - b.dayIndex);
  return { dayed, anytime };
};

const CoachReportDemoPage: React.FC = () => {
  const router = useRouter();
  const sportId = typeof router.query.sportId === 'string' ? router.query.sportId : undefined;
  const { sport, policy, demo } = useReportData(sportId);

  if (!sportId) {
    return null; // wait for router
  }

  if (!sport) {
    return (
      <div className="min-h-screen bg-[#080a14] text-zinc-200">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Coach Report Demo</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Sport not found</h1>
          <p className="mt-3 text-zinc-400">No sport configuration matches <code className="rounded bg-zinc-900 px-2 py-0.5 text-zinc-200">{sportId}</code>.</p>
        </div>
      </div>
    );
  }

  const sportColor = getSportColor(sport.id);
  const meta = demo?.meta || { weekLabel: 'Demo week', primarySportColor: sportColor.primary, primarySportColorSoft: sportColor.soft };

  const topLine = composeReportTopLine(demo?.topLine || { whatChanged: '', who: '', firstAction: '' }, { sportName: sport.name });
  const watchlistGate = enforceNamedAthleteWatchlist(demo?.watchlist || []);
  const coachActionGate = enforceCoachActionSpecificity(demo?.coachActions || []);
  const teamRead = policy ? composeTeamRead(demo?.dimensionState || {}, policy) : undefined;
  const gameDayGate = composeGameDayLookFors(demo?.gameDayLookFors);

  // Translate any remaining internal phrasing to coach English (also a defense
  // against operator-supplied jargon slipping into the rendered copy).
  //
  // IMPORTANT: only run this on machine-derived or operator-supplied strings
  // (top-line composition output, dimension-map cues, watchlist whyMatters,
  // coach-action labels). Hand-authored coach-voice copy — synthesis,
  // noteOpener, closer — must NOT be translated, otherwise a per-sport
  // translation key (e.g. "meet-day arousal" → "how amped they are at the
  // line") will over-rewrite a sentence that was already in coach voice and
  // produce garbled grammar like "This is a how amped they are at the line
  // week".
  const translate = (input: string) => applyCoachLanguageTranslations(input, policy);

  const generatedAt = formatGeneratedAt();
  const accent = meta.primarySportColor || sportColor.primary;
  const accentSoft = meta.primarySportColorSoft || sportColor.soft;

  // The synthesis line replaces the chip-restating prose paragraph. Demo data
  // can supply a sport-specific override; otherwise we derive from the state pattern.
  const synthesis =
    demo?.teamSynthesis ||
    (demo?.dimensionState ? composeFallbackTeamSynthesis(demo.dimensionState) : undefined);

  // Build a Mon→Sun calendar from the coach actions so we replace the standalone
  // Quick Reference list with a time-ordered "Week ahead" view. This adds
  // value over the watchlist (which is athlete-ordered) instead of repeating it.
  const weekCalendar = buildWeekCalendar(coachActionGate.rendered);
  const hasCalendarItems = weekCalendar.dayed.length > 0 || weekCalendar.anytime.length > 0;

  return (
    <>
      <Head>
        <title>{sport.name} — Sports Intelligence Report</title>
        {/* Demo route is public so stakeholders can review without auth, but we
            keep it out of search engines via noindex/nofollow. */}
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div
        className="min-h-screen text-zinc-100"
        style={{
          // Layered accent-tinted gradient so the report sits in ambient sport
          // color instead of floating in flat black on wide monitors. Three
          // sources: a top dome glow, a side fade on each shoulder, and a
          // subtle bottom rise — each clamped low enough that the reading area
          // stays high contrast.
          background: `
            radial-gradient(ellipse 110% 60% at 50% -10%, ${accent}26 0%, transparent 55%),
            radial-gradient(ellipse 40% 80% at 0% 35%, ${accent}14 0%, transparent 60%),
            radial-gradient(ellipse 40% 80% at 100% 35%, ${accent}14 0%, transparent 60%),
            radial-gradient(ellipse 70% 35% at 50% 105%, ${accent}1A 0%, transparent 70%),
            linear-gradient(180deg, #070912 0%, #050709 100%)
          `,
        }}
      >
        {/* Sport-color accent strip */}
        <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${accent} 0%, ${accent}66 50%, transparent 100%)` }} />

        <div className="mx-auto max-w-4xl px-6 pb-32 pt-12 sm:px-8 sm:pt-16">
          {/* Hero */}
          <header className="relative overflow-hidden border-b border-zinc-800/60 pb-12">
            {/* Subtle sport-color dot-grid texture behind the hero. Masked to fade
                out below the title so the rest of the page sits clean. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, ${accent}38 1px, transparent 0)`,
                backgroundSize: '22px 22px',
                maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 50%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 50%, transparent 100%)',
              }}
            />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                    style={{ background: accentSoft, boxShadow: `inset 0 0 0 1px ${accent}40` }}
                  >
                    {sport.emoji}
                  </span>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em]" style={{ color: accent }}>
                      Pulse Sports Intelligence
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">{meta.teamName || `${sport.name} program`}</p>
                  </div>
                </div>
                <h1
                  className="text-[56px] leading-[0.92] tracking-[-0.01em] text-white sm:text-[72px]"
                  style={{ fontFamily: '"Thunder", "HK Grotesk", -apple-system, BlinkMacSystemFont, sans-serif', fontWeight: 800 }}
                >
                  {sport.name} — This Week
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
                  <span>{meta.weekLabel}</span>
                  {meta.opponentOrEvent && (
                    <>
                      <span className="text-zinc-700">•</span>
                      <span>
                        {meta.competitionDate ? <span className="text-zinc-300">{meta.competitionDate}: </span> : null}
                        {meta.opponentOrEvent}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-zinc-500">
                <p>Sent {generatedAt}</p>
              </div>
            </div>
          </header>

          {/* The Note (Top Line) */}
          <section className="mt-12">
            {topLine.used === 'thin_read' ? (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-200">Thin read this week</p>
                <p className="mt-3 text-base leading-relaxed text-amber-100/95">{topLine.primary}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Note opener — sentence-case body voice, not a section eyebrow.
                    Hand-authored, so we render verbatim (no translate()). */}
                {demo?.noteOpener && (
                  <p className="text-[15px] leading-relaxed text-zinc-400">{demo.noteOpener}</p>
                )}
                <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 to-zinc-950 p-7 sm:p-9">
                  <div className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em]" style={{ color: accent }}>
                    Priority this week
                  </p>
                  <p className="mt-3 text-[19px] font-medium leading-[1.55] text-white sm:text-[21px]">
                    {translate(topLine.primary)}
                  </p>
                  {topLine.secondary && (
                    <div className="mt-6 border-t border-zinc-800/80 pt-5">
                      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">Also this week</p>
                      <p className="mt-2 text-[15px] leading-relaxed text-zinc-300">{translate(topLine.secondary)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Athletes To Watch — collapsed Watchlist + Recommended Actions */}
          {!watchlistGate.suppressed && watchlistGate.rendered.length > 0 && (
            <section className="mt-12 space-y-5">
              <div>
                <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">Athletes to watch this week</h2>
                <p className="mt-1 text-xs text-zinc-600">{watchlistGate.rendered.length} named — not a ranking</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {watchlistGate.rendered.map((entry, index) => (
                  <article
                    key={`${entry.athleteName}-${index}`}
                    className="group rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 transition hover:border-zinc-700"
                  >
                    <div className="flex items-center gap-4">
                      <AthleteAvatar name={entry.athleteName} accent={accent} accentSoft={accentSoft} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[17px] font-semibold tracking-tight text-white">{entry.athleteName}</p>
                        {entry.role && <p className="mt-0.5 text-xs text-zinc-500">{entry.role}</p>}
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-zinc-300">{translate(entry.whyMatters)}</p>
                    <div className="mt-5 rounded-xl p-4" style={{ background: accentSoft }}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: accent }}>
                        Coach move
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-zinc-100">{translate(entry.coachMove)}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Week ahead — replaces the standalone Quick Reference list with a
              day-ordered calendar so the page does not repeat the watchlist
              actions verbatim. */}
          {hasCalendarItems && (
            <section className="mt-12">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">The week ahead</h2>
              <p className="mt-1 text-xs text-zinc-600">When each move lands</p>
              <ul className="mt-4 divide-y divide-zinc-800/80 rounded-2xl border border-zinc-800/80 bg-zinc-950/40">
                {weekCalendar.dayed.map((item, idx) => (
                  <li key={`day-${idx}`} className="flex items-start gap-4 px-5 py-4">
                    <span
                      className="mt-0.5 flex h-9 w-12 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold uppercase tracking-wide"
                      style={{ background: accentSoft, color: accent, boxShadow: `inset 0 0 0 1px ${accent}33` }}
                    >
                      {item.dayLabel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed text-zinc-100">{translate(item.action.action)}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {item.action.appliesTo && <span>{item.action.appliesTo}</span>}
                        {item.action.appliesTo && item.action.session && <span className="text-zinc-700"> · </span>}
                        {item.action.session && <span>{item.action.session}</span>}
                      </p>
                    </div>
                  </li>
                ))}
                {weekCalendar.anytime.map((action, idx) => (
                  <li key={`any-${idx}`} className="flex items-start gap-4 px-5 py-4">
                    <span className="mt-0.5 flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-800/60 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                      Any
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed text-zinc-100">{translate(action.action)}</p>
                      {action.appliesTo && <p className="mt-1 text-xs text-zinc-500">{action.appliesTo}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Team This Week (dimension state) */}
          {teamRead && teamRead.lines.length > 0 && (
            <section className="mt-12">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">The team this week</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {teamRead.lines.map((line) => {
                  const tone = STATE_TONE[line.state] || STATE_TONE.thin_evidence;
                  return (
                    <div
                      key={line.dimension}
                      className={`rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-5 ring-1 ${tone.ring}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold capitalize text-white">{line.dimension}</p>
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone.bg} ${tone.text}`}>
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
              {synthesis && (
                // Hand-authored coach-voice line — bypass translate() so per-sport
                // translation keys can't over-rewrite it. Lifted out of footnote
                // territory into a soft thesis container so it reads as the
                // verdict, not an afterthought.
                <div
                  className="mt-6 rounded-2xl border p-5 sm:p-6"
                  style={{
                    background: `linear-gradient(135deg, ${accent}10 0%, transparent 80%)`,
                    borderColor: `${accent}33`,
                  }}
                >
                  <p
                    className="text-[18px] leading-[1.45] text-white sm:text-[20px]"
                    style={{ fontFamily: '"HK Grotesk", -apple-system, BlinkMacSystemFont, sans-serif', fontWeight: 500 }}
                  >
                    {synthesis}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Game-Day — Look-for / If-Then */}
          {!gameDayGate.suppressed && gameDayGate.items.length > 0 && (
            <section className="mt-12">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                {meta.competitionDate ? `${meta.competitionDate} morning` : 'Game-day'}
              </h2>
              <p className="mt-1 text-xs text-zinc-600">What to look for, and what to do if you see it</p>
              <div className="mt-5 space-y-3">
                {gameDayGate.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-5"
                  >
                    <div className="flex items-center gap-3">
                      <AthleteAvatar name={item.athleteOrUnit} accent={accent} accentSoft={accentSoft} size="sm" />
                      <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: accent }}>
                        {item.athleteOrUnit}
                      </p>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-x-5">
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

          {/* Coverage strip — small, footer-like */}
          <section className="mt-16 rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Participation this week</p>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                  Wear {coverageBadge('84%', 'good')} · daily check-ins {coverageBadge('76%', 'good')} · mental performance reps {coverageBadge('68%', 'thin')} · effort logging {coverageBadge('91%', 'strong')}
                </p>
              </div>
              <p className="text-xs text-zinc-500">Confidence is steady. We held back any claim where evidence was thin.</p>
            </div>
          </section>

          {/* Warm closer — turns the report from a deliverable into a relationship.
              Hand-authored, so we render verbatim (no translate()). */}
          {demo?.closer && (
            <p className="mt-10 text-center text-sm leading-relaxed text-zinc-300">
              {demo.closer}
            </p>
          )}

          {/* One-line decision-support disclaimer */}
          <p className="mt-4 text-center text-xs text-zinc-600">
            Decision support, not a clearance tool.
          </p>
        </div>
      </div>
    </>
  );
};

// Server-render the OG meta so iMessage / Slack / Twitter / WhatsApp link
// previews show "Track & Field — Sports Intelligence Report" instead of the
// slug-derived fallback ("Track Field — Pulse"). _app.tsx reads `ogMeta` from
// pageProps and writes the og:title / og:description / og:image / og:url tags
// into the SSR HTML before any crawler sees the page.
export const getServerSideProps: GetServerSideProps = async (context) => {
  const sportIdParam = context.params?.sportId;
  const sportId = typeof sportIdParam === 'string' ? sportIdParam : Array.isArray(sportIdParam) ? sportIdParam[0] : '';
  const sports = getDefaultPulseCheckSports();
  const sport = sports.find((s) => s.id === sportId);
  const sportName = sport?.name || 'Coach Report';

  return {
    props: {
      ogMeta: {
        title: `${sportName} — Sports Intelligence Report`,
        description: `Weekly coach report for ${sportName}. From Pulse Sports Intelligence — read in under 60 seconds.`,
        image: 'https://fitwithpulse.ai/pil-og.png',
        url: `https://fitwithpulse.ai/coach-report-demo/${sportId}`,
      },
    },
  };
};

export default CoachReportDemoPage;
