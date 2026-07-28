import Head from 'next/head';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Brain,
  CheckCircle2,
  Gauge,
  Heart,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const OPEN_APP_URL = '/PulseCheck/open';
const APP_STORE_URL = 'https://apps.apple.com/by/app/pulsecheck-mindset-coaching/id6747253393';

type GuideStep = {
  number: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

const guideSteps: GuideStep[] = [
  { number: '01', label: 'Get set up', href: '#setup', icon: Smartphone },
  { number: '02', label: 'Check in', href: '#check-in', icon: MessageCircle },
  { number: '03', label: 'Understand scores', href: '#scores', icon: Gauge },
  { number: '04', label: 'Train today', href: '#training', icon: Brain },
  { number: '05', label: 'Talk to Nora', href: '#nora', icon: Heart },
  { number: '06', label: 'Privacy and support', href: '#support', icon: ShieldCheck },
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

const PhoneScreenshot = ({
  src,
  alt,
  label,
  className = '',
}: {
  src: string;
  alt: string;
  label: string;
  className?: string;
}) => (
  <figure className={`mx-auto w-full max-w-[19rem] ${className}`}>
    <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#111217] p-2 shadow-2xl shadow-black/40">
      <img src={src} alt={alt} className="block h-auto w-full rounded-[1.55rem]" loading="lazy" />
    </div>
    <figcaption className="mt-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">
      {label}
    </figcaption>
  </figure>
);

const SignalCard = ({
  icon: Icon,
  title,
  value,
  copy,
  accent,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  copy: string;
  accent: string;
}) => (
  <div className="rounded-[1.75rem] border border-white/10 bg-[#111217] p-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-bold" style={{ color: accent }}>
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-semibold text-zinc-500">
        14-day view
      </span>
    </div>
    <div className="mt-6 text-5xl font-semibold tracking-tight text-white">
      {value}
      <span className="ml-1 text-2xl text-zinc-500">%</span>
    </div>
    <p className="mt-5 text-sm leading-6 text-zinc-400">{copy}</p>
  </div>
);

const MiniMetric = ({ label, value, accent }: { label: string; value: number; accent: string }) => (
  <div className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3">
    <div className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">{label}</div>
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: accent }} />
    </div>
    <div className="text-right text-sm font-semibold text-zinc-300">{value}%</div>
  </div>
);

export default function PulseCheckAthleteGuide() {
  return (
    <>
      <Head>
        <title>PulseCheck Athlete Guide</title>
        <meta
          name="description"
          content="A walkthrough for athletes using PulseCheck to check in, train mental skills, understand adherence and coherence, and connect with support."
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
            <Link href="/PulseCheck" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#5b3ac7] shadow-lg shadow-purple-950/40">
                <Brain className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold">PulseCheck</span>
                <span className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  Athlete guide
                </span>
              </span>
            </Link>

            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#ccef0e]"
            >
              Download app
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </header>

        <section className="relative z-10 overflow-hidden border-b border-white/10">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E0FE10]/25 bg-[#E0FE10]/8 px-3 py-1.5 text-xs font-semibold text-[#E0FE10]">
                <Sparkles className="h-3.5 w-3.5" />
                Your PulseCheck athlete guide
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                Train your mind.
                <span className="block bg-gradient-to-r from-white via-[#E0FE10] to-[#14E7D0] bg-clip-text text-transparent">
                  Use it in the game.
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
                PulseCheck helps you notice what is happening inside you, practice the right
                mental skill for the day, and build a pattern your coach can support. The daily
                check-in is simple on purpose: if you can name it, you can change it.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={OPEN_APP_URL}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-zinc-200"
                >
                  Open PulseCheck
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#check-in"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Start with check-ins
                  <MessageCircle className="h-4 w-4 text-[#14E7D0]" />
                </a>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:items-center">
              <PhoneScreenshot
                src="/pulsecheck-media/appstore-01-daily-skills.png"
                alt="PulseCheck home screen showing today's mental training and Nora check-in"
                label="Daily home"
              />
              <div className="space-y-4">
                {[
                  ['Check in honestly', 'Name the state before it runs the rep.'],
                  ['Train one skill', 'Do the next mental rep Nora assigns.'],
                  ['Talk it through', 'Use Nora when something needs language.'],
                  ['Build the pattern', 'Let your data show what helps you perform.'],
                ].map(([title, copy]) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-[#111217]/90 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-[#14E7D0]" />
                      <div>
                        <div className="text-sm font-semibold text-white">{title}</div>
                        <div className="mt-1 text-sm leading-6 text-zinc-500">{copy}</div>
                      </div>
                    </div>
                  </div>
                ))}
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
          <section id="setup" className="scroll-mt-24 border-b border-white/10 pb-20">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <SectionEyebrow number="01">Get set up</SectionEyebrow>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Join from your team invite, then let PulseCheck know you.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
                  Your coach sends an invite link. Use that link to create your account so you
                  land on the right team. From there, PulseCheck starts learning your pattern
                  through your check-ins, training, and connected signals.
                </p>
                <div className="mt-7">
                  <ActionList
                    items={[
                      <>Open the invite link from your coach or team.</>,
                      <>Create your PulseCheck account with the email you want to keep using.</>,
                      <>Complete the first setup prompts so Nora can personalize what happens next.</>,
                      <>Connect your wearable or health data when your team asks for it.</>,
                    ]}
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <PhoneScreenshot
                  src="/pulsecheck-media/00-app-store-meet-nora.png"
                  alt="PulseCheck introduction screen introducing Nora"
                  label="Meet Nora"
                />
                <PhoneScreenshot
                  src="/pulsecheck-media/04-connect-wearable.png"
                  alt="PulseCheck wearable connection screen"
                  label="Connect signals"
                  className="sm:mt-12"
                />
              </div>
            </div>
          </section>

          <section id="check-in" className="scroll-mt-24 border-b border-white/10 py-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <div>
                <SectionEyebrow number="02">Check in</SectionEyebrow>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  The check-in is where awareness starts.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
                  Checking in is not about giving the perfect answer. It is about telling the
                  truth clearly enough that you, Nora, and your support team can see the pattern.
                  You are practicing language for your internal state.
                </p>
                <div className="mt-8 rounded-[1.75rem] border border-[#8b5cf6]/30 bg-gradient-to-br from-[#7c3aed]/20 to-[#111217] p-7 sm:p-9">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                    <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#8b5cf6]/25">
                      <MessageCircle className="h-6 w-6 text-[#d5c3ff]" />
                    </span>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#c4a7ff]">
                        Check-in language
                      </div>
                      <blockquote className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
                        If you can name it, you can change it.
                      </blockquote>
                      <p className="mt-4 text-base leading-7 text-zinc-300">
                        Naming what you feel creates a little space between the feeling and your
                        next choice. That space is where emotional awareness becomes a trainable
                        skill.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <PhoneScreenshot
                src="/pulsecheck-media/01-today-checkin.png"
                alt="PulseCheck daily check-in screen"
                label="Daily check-in"
              />
            </div>
          </section>

          <section id="scores" className="scroll-mt-24 border-b border-white/10 py-20">
            <div className="max-w-3xl">
              <SectionEyebrow number="03">Understand your scores</SectionEyebrow>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Coherence shows how your pattern is coming together. Adherence shows how
                consistently you are showing up.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-400">
                These are not labels on who you are. They are mirrors for what is happening
                lately. Use them to ask better questions, make cleaner adjustments, and build
                trust with your own process.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <SignalCard
                icon={Heart}
                title="Coherence"
                value="78"
                accent="#14E7D0"
                copy="Coherence asks whether the main parts of your training life are lining up: showing up, doing the work, and reporting that you feel Solid or Locked In. A rising coherence score means your habits and state are starting to tell the same story."
              />
              <SignalCard
                icon={Activity}
                title="Adherence"
                value="71"
                accent="#E0FE10"
                copy="Adherence looks at the daily follow-through: check-ins, connected-device wear, and completed mental modules. It is the consistency score. It helps you and your coach see which habit needs support next."
              />
            </div>

            <div className="mt-8 grid gap-10 rounded-[1.75rem] border border-white/10 bg-[#111217] p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <PhoneScreenshot
                src="/pulsecheck-media/appstore-05-program.png"
                alt="PulseCheck program screen showing coherence and adherence"
                label="Program pattern"
              />
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                  How to read it
                </div>
                <div className="mt-5 space-y-4">
                  <MiniMetric label="Consistency" value={79} accent="#14E7D0" />
                  <MiniMetric label="Follow-through" value={82} accent="#14E7D0" />
                  <MiniMetric label="Feeling good" value={73} accent="#14E7D0" />
                </div>
                <p className="mt-7 text-sm leading-7 text-zinc-400">
                  Do not chase the number by pretending everything is fine. Honest check-ins make
                  the score useful. When the number drops, it is not a failure. It is a signal:
                  something changed, and now you can work with it.
                </p>
              </div>
            </div>
          </section>

          <section id="training" className="scroll-mt-24 border-b border-white/10 py-20">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <SectionEyebrow number="04">Train today</SectionEyebrow>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Mental training is a rep, not a speech.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
                  PulseCheck gives you a daily mental skill based on where you are in the program
                  and what your recent pattern says you need. Some days the rep is breathing.
                  Some days it is focus, composure, confidence, or reflection.
                </p>
                <div className="mt-7">
                  <ActionList
                    items={[
                      <>Open Today&apos;s Work in the Training Room.</>,
                      <>Read why the skill was assigned before starting the rep.</>,
                      <>Complete the exercise without rushing it.</>,
                      <>Use the skill later in practice, class, competition, or recovery.</>,
                    ]}
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <PhoneScreenshot
                  src="/pulsecheck-media/appstore-02-training-system.png"
                  alt="PulseCheck Training Room screen with daily assigned work"
                  label="Training room"
                />
                <PhoneScreenshot
                  src="/pulsecheck-media/appstore-03-box-breathing.png"
                  alt="PulseCheck guided breathing practice screen"
                  label="Practice the skill"
                  className="sm:mt-12"
                />
              </div>
            </div>
          </section>

          <section id="nora" className="scroll-mt-24 border-b border-white/10 py-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <div>
                <SectionEyebrow number="05">Talk to Nora</SectionEyebrow>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Use Nora to turn the moment into a plan.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
                  Nora is there when you need to talk through what just happened, what is building
                  up, or what you want to do next. Keep it honest and practical. The goal is not
                  to sound perfect. The goal is to leave with language and a next move.
                </p>
                <div className="mt-10 grid gap-4 md:grid-cols-3">
                  {[
                    ['Name it', 'Say what you feel in plain words.'],
                    ['Locate it', 'Connect it to the moment, trigger, or pattern.'],
                    ['Change it', 'Choose the next breath, action, message, or rep.'],
                  ].map(([title, copy]) => (
                    <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                      <div className="font-semibold">{title}</div>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">{copy}</p>
                    </div>
                  ))}
                </div>
              </div>

              <PhoneScreenshot
                src="/pulsecheck-media/appstore-04-nora-coaching.png"
                alt="PulseCheck Nora chat screen"
                label="Nora coaching"
              />
            </div>
          </section>

          <section id="support" className="scroll-mt-24 py-20">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <SectionEyebrow number="06">Privacy and support</SectionEyebrow>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  PulseCheck is private, but you are not alone.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
                  Your support team does not need every private detail to help you. PulseCheck is
                  built to show useful signals, protect sensitive context, and make sure the right
                  people can step in when support is needed.
                </p>
                <div className="mt-7">
                  <ActionList
                    items={[
                      <>Use the app honestly. Honest data is what makes the system useful.</>,
                      <>Review your privacy settings so you understand what is shared.</>,
                      <>Message your support team when you need a person in the loop.</>,
                      <>If something feels urgent or unsafe, reach out to a trusted adult, clinician, or emergency support right away.</>,
                    ]}
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <PhoneScreenshot
                  src="/pulsecheck-media/07-profile-private.png"
                  alt="PulseCheck privacy profile screen"
                  label="Private profile"
                />
                <PhoneScreenshot
                  src="/pulsecheck-media/appstore-06-support-system.png"
                  alt="PulseCheck conversations and support team screen"
                  label="Support system"
                  className="sm:mt-12"
                />
              </div>
            </div>
          </section>
        </div>

        <section className="relative z-10 border-t border-white/10 bg-[#111217]">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#E0FE10]">
                The rhythm
              </div>
              <h2 className="mt-2 text-2xl font-semibold">Check in. Train one skill. Talk when it matters.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                The athlete who can name their state has more control over the next choice. That
                is the work. Small honest reps, repeated often.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Target, label: 'Awareness' },
                { icon: Zap, label: 'Action' },
                { icon: Trophy, label: 'Growth' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <Icon className="h-5 w-5 text-[#E0FE10]" />
                    <div className="mt-3 text-sm font-semibold">{item.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <footer className="relative z-10 border-t border-white/10 bg-[#090a0d]">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
            <span>PulseCheck Athlete Guide</span>
            <span>Prepared for athletes learning to name it, train it, and change it.</span>
          </div>
        </footer>
      </main>
    </>
  );
}
