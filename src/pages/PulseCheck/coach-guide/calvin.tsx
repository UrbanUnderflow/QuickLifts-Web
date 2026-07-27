import Head from 'next/head';
import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Gauge,
  Heart,
  Link2,
  LogIn,
  MessageCircle,
  Sparkles,
  Target,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const LOGIN_URL = '/coach/login';
const DASHBOARD_URL = '/coach/dashboard';

type GuideStep = {
  number: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

const guideSteps: GuideStep[] = [
  { number: '01', label: 'Sign in', href: '#sign-in', icon: LogIn },
  { number: '02', label: 'View athletes', href: '#athletes', icon: Users },
  { number: '03', label: 'Read the scores', href: '#scores', icon: Gauge },
  { number: '04', label: 'Train Nora', href: '#train-nora', icon: Brain },
  { number: '05', label: 'Share referrals', href: '#referrals', icon: Link2 },
  { number: '06', label: 'Request a payout', href: '#earnings', icon: Wallet },
];

const SectionEyebrow = ({
  number,
  children,
}: {
  number: string;
  children: React.ReactNode;
}) => (
  <div className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#E0FE10]">
    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E0FE10]/30 bg-[#E0FE10]/10">
      {number}
    </span>
    <span>{children}</span>
  </div>
);

const GuideScreenshot = ({
  src,
  alt,
  label,
}: {
  src: string;
  alt: string;
  label: string;
}) => (
  <figure className="overflow-hidden rounded-2xl border border-white/10 bg-[#111217] shadow-2xl shadow-black/30">
    <div className="flex items-center gap-2 border-b border-white/10 bg-[#17181e] px-4 py-3">
      <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b6b]/80" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#ffd166]/80" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#4ade80]/80" />
      <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </span>
    </div>
    <img
      src={src}
      alt={alt}
      className="block h-auto w-full"
      loading="lazy"
    />
  </figure>
);

const ActionList = ({ items }: { items: React.ReactNode[] }) => (
  <ol className="space-y-4">
    {items.map((item, index) => (
      <li key={index} className="flex gap-3 text-sm leading-6 text-zinc-300 sm:text-base">
        <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white/5 text-xs font-bold text-[#E0FE10]">
          {index + 1}
        </span>
        <span>{item}</span>
      </li>
    ))}
  </ol>
);

const MetricBar = ({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) => (
  <div className="grid grid-cols-[92px_1fr_44px] items-center gap-3">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
    <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
      <span className={`block h-full rounded-full ${color}`} style={{ width: value }} />
    </span>
    <span className="text-right text-xs font-semibold text-zinc-300">{value}</span>
  </div>
);

export default function CoachCalvinGuide() {
  return (
    <>
      <Head>
        <title>Coach Calvin&apos;s PulseCheck Guide</title>
        <meta
          name="description"
          content="A step-by-step guide for Coach Calvin to use the PulseCheck coach dashboard."
        />
      </Head>

      <main className="min-h-screen bg-[#090a0d] text-white">
        <div className="fixed inset-0 -z-0 overflow-hidden" aria-hidden="true">
          <div className="absolute left-[-14rem] top-[-10rem] h-[34rem] w-[34rem] rounded-full bg-[#7c3aed]/15 blur-[130px]" />
          <div className="absolute right-[-12rem] top-[18rem] h-[30rem] w-[30rem] rounded-full bg-[#E0FE10]/10 blur-[150px]" />
          <div className="absolute bottom-[-14rem] left-[35%] h-[28rem] w-[28rem] rounded-full bg-[#14E7D0]/10 blur-[140px]" />
        </div>

        <header className="relative z-10 border-b border-white/10 bg-[#090a0d]/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#5b3ac7] shadow-lg shadow-purple-950/40">
                <Brain className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold">PulseCheck</span>
                <span className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  Coaching platform
                </span>
              </span>
            </Link>

            <Link
              href={LOGIN_URL}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#ccef0e]"
            >
              Coach sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="relative z-10 overflow-hidden border-b border-white/10">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E0FE10]/25 bg-[#E0FE10]/8 px-3 py-1.5 text-xs font-semibold text-[#E0FE10]">
                <Sparkles className="h-3.5 w-3.5" />
                Your PulseCheck field guide
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                Welcome,
                <span className="block bg-gradient-to-r from-white via-[#E0FE10] to-[#14E7D0] bg-clip-text text-transparent">
                  Coach Calvin.
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
                This guide shows you where to look, what each score means, how to give Nora
                team knowledge, how referrals work, and how to request your earnings.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={DASHBOARD_URL}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-zinc-200"
                >
                  Open your dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#scores"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Start with the two scores
                  <Gauge className="h-4 w-4 text-[#14E7D0]" />
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-[#8b5cf6]/20 via-transparent to-[#E0FE10]/10 blur-2xl" />
              <div className="relative rounded-[1.75rem] border border-white/10 bg-[#111217]/90 p-5 shadow-2xl shadow-black/40 sm:p-7">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Your weekly rhythm
                    </div>
                    <div className="mt-1 text-xl font-bold">See. Support. Strengthen.</div>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E0FE10]/10">
                    <Target className="h-5 w-5 text-[#E0FE10]" />
                  </span>
                </div>
                <div className="space-y-3">
                  {[
                    ['Start', 'Scan team coherence and adherence.'],
                    ['Focus', 'Open the athlete who needs your attention.'],
                    ['Coach', 'Message, train, and give Nora the right context.'],
                    ['Grow', 'Share the correct referral link and track earnings.'],
                  ].map(([label, copy]) => (
                    <div
                      key={label}
                      className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.035] p-3.5"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-[#14E7D0]" />
                      <div>
                        <span className="text-sm font-semibold text-white">{label}: </span>
                        <span className="text-sm text-zinc-400">{copy}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0c10]/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 py-3 sm:px-8">
            {guideSteps.map((step) => {
              const Icon = step.icon;
              return (
                <a
                  key={step.href}
                  href={step.href}
                  className="flex flex-none items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:bg-white/5 hover:text-white"
                >
                  <Icon className="h-3.5 w-3.5 text-[#E0FE10]" />
                  <span className="text-zinc-600">{step.number}</span>
                  {step.label}
                </a>
              );
            })}
          </div>
        </nav>

        <div className="relative z-10 mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <section id="sign-in" className="scroll-mt-24 border-b border-white/10 pb-20">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div>
                <SectionEyebrow number="01">Sign in</SectionEyebrow>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Enter the coach dashboard.
                </h2>
                <p className="mt-4 text-base leading-7 text-zinc-400">
                  Use the coach sign-in page each time you want to review your roster. Your
                  connected sign-in methods all lead to the same combined Calvin profile.
                </p>
                <div className="mt-7">
                  <ActionList
                    items={[
                      <>Open <strong className="text-white">Coach sign in</strong>.</>,
                      <>
                        Choose <strong className="text-white">Magic link</strong>,{' '}
                        <strong className="text-white">Google</strong>, or{' '}
                        <strong className="text-white">Apple</strong>.
                      </>,
                      <>
                        For a magic link, open the email on the same device and select the secure
                        sign-in button.
                      </>,
                      <>
                        After sign-in, PulseCheck opens your{' '}
                        <strong className="text-white">Readiness Dashboard</strong>.
                      </>,
                    ]}
                  />
                </div>
                <Link
                  href={LOGIN_URL}
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#8b5cf6]"
                >
                  Go to Coach sign in
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-[#111217] p-5 shadow-2xl shadow-black/30 sm:p-7">
                <div className="flex items-center gap-3 border-b border-white/10 pb-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7c3aed]/20">
                    <LogIn className="h-5 w-5 text-[#c4a7ff]" />
                  </span>
                  <div>
                    <div className="font-bold">Welcome back, Coach</div>
                    <div className="text-sm text-zinc-500">Choose the sign-in method you use.</div>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex gap-2">
                      <span className="rounded-md bg-[#7c3aed] px-3 py-1.5 text-xs font-semibold">
                        Magic link
                      </span>
                      <span className="rounded-md px-3 py-1.5 text-xs font-semibold text-zinc-500">
                        Password
                      </span>
                    </div>
                    <div className="h-11 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-3 text-sm text-zinc-600">
                      Email
                    </div>
                    <div className="mt-3 rounded-lg bg-[#7c3aed] py-3 text-center text-sm font-bold">
                      Send magic link
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.035] py-3 text-center text-sm font-semibold">
                      Continue with Google
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.035] py-3 text-center text-sm font-semibold">
                      Continue with Apple
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="athletes" className="scroll-mt-24 border-b border-white/10 py-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <div>
                <SectionEyebrow number="02">View your athletes</SectionEyebrow>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Start with the roster, then open the athlete.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
                  Team Roster gives you a quick list of every athlete, today&apos;s check-in
                  status, and who may need attention. Select any athlete row to open their
                  individual view.
                </p>
                <div className="mt-7">
                  <ActionList
                    items={[
                      <>
                        Select <strong className="text-white">Team Roster</strong> in the left menu.
                      </>,
                      <>
                        Scan <strong className="text-white">Team Status Overview</strong> for the
                        number checked in today.
                      </>,
                      <>
                        Select an athlete to see their recent check-ins, training, device status,
                        and messages.
                      </>,
                      <>
                        Use <strong className="text-white">Readiness Dashboard</strong> when you
                        want card views for the whole roster.
                      </>,
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <GuideScreenshot
                  src="/coach-guide/calvin/team-roster.png"
                  alt="PulseCheck Team Status Overview showing team check-in progress"
                  label="Live dashboard view"
                />
                <div className="rounded-2xl border border-white/10 bg-[#111217] p-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                    Select an athlete row
                  </div>
                  <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E0FE10]/10 text-sm font-bold text-[#E0FE10]">
                      A
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">Athlete profile</div>
                      <div className="text-sm text-zinc-500">Status, last check-in, training</div>
                    </div>
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                      Needs review
                    </span>
                    <ArrowRight className="h-4 w-4 text-zinc-500" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="scores" className="scroll-mt-24 border-b border-white/10 py-20">
            <div className="max-w-3xl">
              <SectionEyebrow number="03">Read the two primary scores</SectionEyebrow>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Coherence tells you how the pattern is coming together. Adherence tells you how
                consistently the athlete is showing up.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-400">
                Read these two scores first. Then use the smaller bars and the athlete&apos;s
                recent check-ins to understand what is driving the number.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              <article className="rounded-[1.75rem] border border-[#14E7D0]/25 bg-[#14E7D0]/[0.055] p-6 sm:p-8">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-[#63f6e8]">
                      <Heart className="h-4 w-4" />
                      Coherence
                    </div>
                    <div className="mt-3 text-4xl font-bold">
                      68<span className="ml-1 text-lg text-zinc-500">%</span>
                    </div>
                  </div>
                  <span className="rounded-full border border-[#14E7D0]/20 bg-[#14E7D0]/10 px-3 py-1 text-xs font-semibold text-[#63f6e8]">
                    14-day pattern
                  </span>
                </div>
                <div className="mt-7 space-y-3">
                  <MetricBar label="Showing up" value="71%" color="bg-[#14E7D0]" />
                  <MetricBar label="Training" value="62%" color="bg-[#14E7D0]" />
                  <MetricBar label="Feeling good" value="70%" color="bg-[#14E7D0]" />
                </div>
                <p className="mt-6 text-sm leading-6 text-zinc-400">
                  Coherence combines showing up, completing assigned training, and days the
                  athlete reports feeling Solid or Locked In. A rising score means those pieces
                  are lining up more often. “Building” means PulseCheck is still collecting the
                  athlete&apos;s first usable pattern.
                </p>
              </article>

              <article className="rounded-[1.75rem] border border-[#E0FE10]/25 bg-[#E0FE10]/[0.045] p-6 sm:p-8">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-[#E0FE10]">
                      <ClipboardCheck className="h-4 w-4" />
                      Adherence
                    </div>
                    <div className="mt-3 text-4xl font-bold">
                      54<span className="ml-1 text-lg text-zinc-500">%</span>
                    </div>
                  </div>
                  <span className="rounded-full border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-3 py-1 text-xs font-semibold text-[#E0FE10]">
                    Daily habits
                  </span>
                </div>
                <div className="mt-7 space-y-3">
                  <MetricBar label="Checked in" value="64%" color="bg-[#E0FE10]" />
                  <MetricBar label="Device worn" value="71%" color="bg-[#E0FE10]" />
                  <MetricBar label="Mental modules" value="27%" color="bg-[#E0FE10]" />
                </div>
                <p className="mt-6 text-sm leading-6 text-zinc-400">
                  Adherence averages check-ins, connected-device wear, and completed mental
                  modules across the last 14 days. A low smaller bar tells you the exact habit to
                  support next.
                </p>
              </article>
            </div>

            <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111217]">
              <GuideScreenshot
                src="/coach-guide/calvin/readiness-metrics.png"
                alt="PulseCheck readiness dashboard metrics including adherence"
                label="Live dashboard view"
              />
              <div className="grid gap-4 border-t border-white/10 p-6 sm:grid-cols-3">
                {[
                  ['Look at the trend', 'Compare this week with the athlete’s prior 14-day pattern.'],
                  ['Open the drivers', 'Use the smaller bars to see where support will help most.'],
                  ['Start a conversation', 'Ask what changed before assigning more training.'],
                ].map(([title, copy]) => (
                  <div key={title} className="rounded-xl bg-white/[0.035] p-4">
                    <div className="text-sm font-semibold">{title}</div>
                    <p className="mt-1 text-sm leading-6 text-zinc-500">{copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 rounded-[1.75rem] border border-[#8b5cf6]/30 bg-gradient-to-br from-[#7c3aed]/20 to-[#111217] p-7 sm:p-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#8b5cf6]/25">
                  <MessageCircle className="h-6 w-6 text-[#d5c3ff]" />
                </span>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#c4a7ff]">
                    Why the check-in matters
                  </div>
                  <blockquote className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
                    “If you can name it, you can change it.”
                  </blockquote>
                  <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300">
                    The check-in gives athletes a simple way to name what they feel before the
                    feeling drives the next choice. Repeating that practice helps them notice
                    patterns, speak about them clearly, and build emotional awareness they can
                    use in training, competition, and daily life.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section id="train-nora" className="scroll-mt-24 border-b border-white/10 py-20">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <SectionEyebrow number="04">Train Nora</SectionEyebrow>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Give Nora the team knowledge you want athletes to receive.
                </h2>
                <p className="mt-4 text-base leading-7 text-zinc-400">
                  Train Nora is your team knowledge vault. Add schedules, playbooks, policies,
                  meeting times, team language, and coaching notes that athletes may ask about.
                </p>
                <div className="mt-7">
                  <ActionList
                    items={[
                      <>
                        Use <strong className="text-white">Upload files</strong> for PDFs, documents,
                        and images.
                      </>,
                      <>
                        Use <strong className="text-white">Add note</strong> for a quick instruction,
                        team rule, or meeting update.
                      </>,
                      <>
                        Select <strong className="text-white">Chat with Nora</strong> and ask the
                        question an athlete may ask.
                      </>,
                      <>
                        Update old information so Nora keeps giving the current team answer.
                      </>,
                    ]}
                  />
                </div>
              </div>

              <GuideScreenshot
                src="/coach-guide/calvin/train-nora.png"
                alt="Train Nora knowledge vault with upload files and add note controls"
                label="Live dashboard view"
              />
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: FileText,
                  title: 'Schedules and logistics',
                  copy: 'Practice times, travel plans, meeting locations, and event details.',
                },
                {
                  icon: Brain,
                  title: 'Your coaching language',
                  copy: 'Short instructions, routines, team standards, and the phrases you want Nora to reinforce.',
                },
                {
                  icon: Check,
                  title: 'Test the answer',
                  copy: 'Ask Nora a sample athlete question and improve the note when the answer needs more detail.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                    <Icon className="h-5 w-5 text-[#c4a7ff]" />
                    <div className="mt-4 font-semibold">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">{item.copy}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section id="referrals" className="scroll-mt-24 border-b border-white/10 py-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-end">
              <div>
                <SectionEyebrow number="05">Referrals</SectionEyebrow>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Use the right link for the person you are inviting.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
                  Every referral link carries your coach and team attribution. Copy the link from
                  Referral Links and send that exact link to the athlete, parent, or coach.
                </p>
              </div>
              <GuideScreenshot
                src="/coach-guide/calvin/referral-links.png"
                alt="PulseCheck Referral Links screen with Athlete team invite"
                label="Live dashboard view"
              />
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {[
                {
                  icon: UserRound,
                  tag: 'Athlete',
                  title: 'Athlete team invite',
                  copy: 'Use this for an athlete who should join your Building Bodies roster.',
                  amount: '35%',
                  detail: 'of athlete-paid subscription revenue',
                  accent: 'text-[#E0FE10]',
                  border: 'border-[#E0FE10]/20',
                },
                {
                  icon: ClipboardCheck,
                  tag: 'Parent',
                  title: 'Parent readiness assessment',
                  copy: 'Use this for a parent who wants to complete the readiness assessment.',
                  amount: '15%',
                  detail: 'of the parent assessment purchase',
                  accent: 'text-[#63d7ff]',
                  border: 'border-[#38bdf8]/20',
                },
                {
                  icon: Users,
                  tag: 'Coach',
                  title: 'Coach referral',
                  copy: 'Use this for a coach who wants to bring a team to PulseCheck.',
                  amount: '20%',
                  detail: 'of athlete-paid subscriptions under that coach',
                  accent: 'text-[#d5a6ff]',
                  border: 'border-[#c084fc]/20',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className={`rounded-[1.5rem] border ${item.border} bg-[#111217] p-6`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                        <Icon className={`h-5 w-5 ${item.accent}`} />
                      </span>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                        {item.tag}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-bold">{item.title}</h3>
                    <p className="mt-2 min-h-[72px] text-sm leading-6 text-zinc-500">{item.copy}</p>
                    <div className="mt-5 border-t border-white/10 pt-5">
                      <div className={`text-3xl font-bold ${item.accent}`}>{item.amount}</div>
                      <div className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-6 flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.055] p-5">
              <CircleDollarSign className="mt-0.5 h-5 w-5 flex-none text-amber-300" />
              <p className="text-sm leading-6 text-amber-100/80">
                Apple App Store subscriptions show the 15% Apple fee first. Your 35% athlete
                referral share is calculated from the remaining net amount. Web subscriptions
                show their Stripe payment channel in the Earnings transaction history.
              </p>
            </div>
          </section>

          <section id="earnings" className="scroll-mt-24 py-20">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <SectionEyebrow number="06">Earnings and withdrawal</SectionEyebrow>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Request the full available payout when you are ready.
                </h2>
                <p className="mt-4 text-base leading-7 text-zinc-400">
                  Earnings shows each paid subscription transaction, the payment channel, any
                  recorded Apple fee, your share, and the total that is ready for payout.
                </p>
                <div className="mt-7">
                  <ActionList
                    items={[
                      <>
                        Select <strong className="text-white">Earnings</strong> in the left menu.
                      </>,
                      <>
                        Review <strong className="text-white">Available payout</strong> and the
                        member transaction history.
                      </>,
                      <>
                        Select <strong className="text-white">Request</strong> for the full available
                        amount.
                      </>,
                      <>
                        Choose <strong className="text-white">Zelle</strong>,{' '}
                        <strong className="text-white">Apple Pay</strong>, or{' '}
                        <strong className="text-white">Cash App</strong>, then enter the receiving
                        email, phone number, or handle.
                      </>,
                      <>
                        Submit the request. The balance moves to{' '}
                        <strong className="text-white">Payout requested</strong>. After the transfer
                        is sent and confirmed, it moves to{' '}
                        <strong className="text-white">Paid out</strong>.
                      </>,
                    ]}
                  />
                </div>
              </div>

              <GuideScreenshot
                src="/coach-guide/calvin/earnings-payout.png"
                alt="PulseCheck Earnings screen showing available payout and request payout button"
                label="Live dashboard view"
              />
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Estimated monthly', 'Forecast from currently active subscriptions.'],
                ['Available payout', 'Recorded referral earnings ready to request.'],
                ['Payout requested', 'A submitted request waiting for transfer completion.'],
                ['Paid out', 'Transfers that the Pulse team has marked complete.'],
              ].map(([title, copy], index) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E0FE10]/10 text-sm font-bold text-[#E0FE10]">
                    {index + 1}
                  </span>
                  <div className="mt-4 font-semibold">{title}</div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{copy}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="relative z-10 border-t border-white/10 bg-[#111217]">
          <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-12 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#E0FE10]">
                Ready for your weekly scan?
              </div>
              <h2 className="mt-2 text-2xl font-semibold">Open PulseCheck and start with the two scores.</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Coherence shows the pattern. Adherence shows the daily follow-through.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={DASHBOARD_URL}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-5 py-3 text-sm font-bold text-black transition hover:bg-[#ccef0e]"
              >
                Open Coach Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#sign-in"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/5"
              >
                Review from the top
              </a>
            </div>
          </div>
        </section>

        <footer className="relative z-10 border-t border-white/10 bg-[#090a0d]">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs text-zinc-600 sm:px-8 sm:flex-row sm:items-center sm:justify-between">
            <span>PulseCheck Coach Guide</span>
            <span>Prepared for Coach Calvin and Building Bodies</span>
          </div>
        </footer>
      </main>
    </>
  );
}
