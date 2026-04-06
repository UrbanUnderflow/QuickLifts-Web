import Head from 'next/head';
import Link from 'next/link';
import type { NextPage } from 'next';

const highlights = [
  {
    title: 'Invite-only scheduling',
    body: 'Group Meet is built for Pulse employees and invited participants coordinating a meeting around real availability.',
  },
  {
    title: 'Manual control stays with the guest',
    body: 'Guests can add availability manually, import Google Calendar suggestions, review them, edit them, and save only what they approve.',
  },
  {
    title: 'Read-only Google access',
    body: 'When a guest connects Google Calendar, Group Meet reads busy blocks to suggest open times. It does not create, edit, or delete calendar events.',
  },
];

const workflow = [
  {
    step: '1. Create the request',
    body: 'An organizer creates a Group Meet request, selects a target month, adds participants, and shares one invite link per person.',
  },
  {
    step: '2. Guests share availability',
    body: 'Guests open their invite, add time windows manually, or optionally connect Google Calendar to import editable suggestions.',
  },
  {
    step: '3. Organizers review overlaps',
    body: 'Group Meet compares responses, highlights where schedules overlap, and helps the organizer move toward a final meeting time.',
  },
];

const googleDataPoints = [
  'Google account basic profile information needed for sign-in context, such as email address.',
  'Read-only Google Calendar busy blocks for the selected month so Group Meet can suggest availability windows.',
  'No calendar-writing permissions. Group Meet does not create, update, or delete events in a guest calendar during import.',
  'No automatic submission. Imported suggestions stay editable until the guest saves availability manually.',
];

const faq = [
  {
    question: 'Do guests have to connect Google Calendar?',
    answer:
      'No. Google Calendar import is optional. Guests can skip it entirely and enter their availability manually.',
  },
  {
    question: 'What does Group Meet do with Google Calendar access?',
    answer:
      'Group Meet uses read-only calendar access to inspect busy blocks for the scheduling window and turn them into editable suggestions. It does not create, edit, or delete events during the guest import flow.',
  },
  {
    question: 'Can a guest review imported suggestions before saving?',
    answer:
      'Yes. Imported suggestions stay in draft form until the guest explicitly saves the availability they want to share.',
  },
];

const footerLinks = [
  { href: '/group-meet', label: 'Group Meet home' },
  { href: '/group-meet/privacy', label: 'Privacy policy' },
  { href: '/group-meet/terms', label: 'Terms' },
];

const GroupMeetHomePage: NextPage = () => {
  return (
    <div className="min-h-screen bg-[#05070b] text-white">
      <Head>
        <title>Group Meet | Pulse</title>
        <meta
          name="description"
          content="Group Meet is Pulse's invite-only scheduling tool for collecting availability, optionally importing read-only Google Calendar busy blocks, and finding overlap for a target month."
        />
        <link rel="canonical" href="https://fitwithpulse.ai/group-meet" />
        <meta property="og:title" content="Group Meet | Pulse" />
        <meta
          property="og:description"
          content="Coordinate meeting availability with invite-only scheduling, editable Google Calendar suggestions, and overlap review."
        />
        <meta property="og:url" content="https://fitwithpulse.ai/group-meet" />
        <meta property="og:type" content="website" />
      </Head>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
        <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(224,254,16,0.14),_transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-zinc-300">
                Group Meet
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
                Invite-only meeting coordination for Pulse teams and invited guests.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                Group Meet helps organizers collect availability for a target month, optionally lets guests connect
                Google Calendar in read-only mode to import editable suggestions, and keeps the final save decision in
                the guest's hands.
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                This page is the public product overview for the Group Meet scheduling workflow available on
                fitwithpulse.ai. It explains what the tool does, who it is for, and how optional Google Calendar import
                works.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/group-meet/privacy"
                  className="inline-flex items-center justify-center rounded-full bg-[#E0FE10] px-5 py-3 font-semibold text-black transition hover:bg-lime-300"
                >
                  Read Group Meet privacy
                </Link>
                <Link
                  href="/group-meet/terms"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 font-medium text-zinc-100 transition hover:bg-white/10"
                >
                  Review terms
                </Link>
                <a
                  href="mailto:info@fitwithpulse.ai?subject=Group%20Meet%20support"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/20 px-5 py-3 font-medium text-zinc-300 transition hover:bg-white/10"
                >
                  Email support
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-xl">
              {highlights.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {workflow.map((item) => (
            <article key={item.step} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#E0FE10]">{item.step}</div>
              <p className="mt-4 text-base leading-7 text-zinc-300">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">How Google Calendar import works</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
              Group Meet supports an optional Google Calendar connect flow for invited guests. The goal is to help the
              guest move faster by suggesting availability from existing calendar commitments, while keeping the guest in
              control of what gets saved back into the meeting request.
            </p>
            <ul className="mt-6 space-y-3">
              {googleDataPoints.map((item) => (
                <li key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-zinc-300">
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <aside className="rounded-3xl border border-[#E0FE10]/20 bg-[#E0FE10]/[0.06] p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-white">Privacy commitments</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-200">
              <li>Only invited participants can use a Group Meet scheduling link.</li>
              <li>Google Calendar import is optional. Manual entry remains available at all times.</li>
              <li>Imported suggestions are never auto-submitted as saved availability.</li>
              <li>Calendar import is read-only and limited to meeting coordination.</li>
              <li>Questions or deletion requests can be sent to <a className="text-[#E0FE10] underline underline-offset-4" href="mailto:info@fitwithpulse.ai">info@fitwithpulse.ai</a>.</li>
            </ul>
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-300">
              For Google OAuth review, use this page as the application home page and
              <span className="text-white"> /group-meet/privacy </span>
              as the Group Meet-specific privacy policy.
            </div>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">What Group Meet is for</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-300 sm:text-base">
              <li>Invite-only meeting scheduling for Pulse teams, advisors, and approved outside guests.</li>
              <li>Collecting availability for a defined target month with one secure response link per participant.</li>
              <li>Helping organizers see overlap without requiring guests to hand over final scheduling control.</li>
              <li>Reducing manual back-and-forth by combining saved availability with optional calendar-based suggestions.</li>
            </ul>
          </article>

          <article className="rounded-3xl border border-white/10 bg-black/20 p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
            <div className="mt-5 space-y-4">
              {faq.map((item) => (
                <div key={item.question} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="text-base font-semibold text-white">{item.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-300 sm:text-base">{item.answer}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/20 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Need help with Group Meet?</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400 sm:text-base">
                For support, privacy questions, or Google Calendar access questions, contact Pulse Intelligence Labs at
                info@fitwithpulse.ai.
              </p>
            </div>
            <a
              href="mailto:info@fitwithpulse.ai?subject=Group%20Meet%20question"
              className="inline-flex items-center justify-center rounded-full bg-[#E0FE10] px-5 py-3 font-semibold text-black transition hover:bg-lime-300"
            >
              Contact support
            </a>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-white/10 pt-2 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <div>Pulse Intelligence Labs, Inc. | Group Meet public information pages</div>
          <div className="flex flex-wrap gap-4">
            {footerLinks.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-white">
                {item.label}
              </Link>
            ))}
            <a href="mailto:info@fitwithpulse.ai" className="transition hover:text-white">
              info@fitwithpulse.ai
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default GroupMeetHomePage;
