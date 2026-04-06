import Head from 'next/head';
import Link from 'next/link';
import type { NextPage } from 'next';

const sections = [
  {
    title: 'Acceptance',
    body: 'By using Group Meet, you agree to these terms as they apply to the invite-only scheduling workflow provided by Pulse Intelligence Labs, Inc.',
  },
  {
    title: 'Service description',
    body: 'Group Meet is a scheduling tool used to collect availability, optionally import read-only Google Calendar busy blocks into editable suggestions, and help organizers review overlap for a meeting.',
  },
  {
    title: 'Permitted use',
    body: 'Use Group Meet only for legitimate meeting coordination connected to the request you were invited to join. Do not misuse invite links, impersonate others, scrape data, or attempt to interfere with the service.',
  },
  {
    title: 'Google Calendar import',
    body: 'If you choose to connect Google Calendar, you authorize Group Meet to read the information described in the Group Meet privacy policy for the limited purpose of generating editable availability suggestions. Group Meet does not automatically save imported suggestions as your response.',
  },
  {
    title: 'Organizer and guest responsibilities',
    body: 'Organizers are responsible for the participant list and scheduling use of the request. Guests are responsible for reviewing any imported suggestions and saving only the availability they want to submit.',
  },
  {
    title: 'Availability of the service',
    body: 'Group Meet is provided on an as-available basis. We may update, improve, limit, or discontinue parts of the workflow as the product evolves.',
  },
  {
    title: 'Privacy and Google Calendar access',
    body: 'Use of optional Google Calendar import is also governed by the Group Meet privacy policy. Guests should review the privacy page before connecting Google Calendar.',
  },
  {
    title: 'Contact',
    body: 'If you have questions about Group Meet terms or operation, contact info@fitwithpulse.ai.',
  },
];

const GroupMeetTermsPage: NextPage = () => {
  return (
    <div className="min-h-screen bg-[#05070b] text-white">
      <Head>
        <title>Group Meet Terms | Pulse</title>
        <meta
          name="description"
          content="Terms for Group Meet, Pulse's invite-only scheduling workflow for collecting availability and reviewing overlap."
        />
        <link rel="canonical" href="https://fitwithpulse.ai/group-meet/terms" />
        <meta property="og:title" content="Group Meet Terms | Pulse" />
        <meta
          property="og:description"
          content="Terms governing the Group Meet invite-only scheduling workflow."
        />
        <meta property="og:url" content="https://fitwithpulse.ai/group-meet/terms" />
        <meta property="og:type" content="website" />
      </Head>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
        <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(224,254,16,0.12),_transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-zinc-300">
            Group Meet Terms
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Terms for using Group Meet.</h1>
          <p className="mt-4 text-base leading-7 text-zinc-300 sm:text-lg">
            Effective date: April 5, 2026. These terms apply to the Group Meet experience and related invite links.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/group-meet" className="inline-flex items-center justify-center rounded-full bg-[#E0FE10] px-5 py-3 font-semibold text-black transition hover:bg-lime-300">
              Back to Group Meet
            </Link>
            <Link href="/group-meet/privacy" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 font-medium text-zinc-100 transition hover:bg-white/10">
              Review privacy policy
            </Link>
          </div>
        </section>

        <section className="space-y-6">
          {sections.map((section) => (
            <article key={section.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-300 sm:text-base">{section.body}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/20 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Support</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-300 sm:text-base">
            For Group Meet support or legal questions, contact{' '}
            <a className="text-[#E0FE10] underline underline-offset-4" href="mailto:info@fitwithpulse.ai">
              info@fitwithpulse.ai
            </a>.
          </p>
        </section>
      </main>
    </div>
  );
};

export default GroupMeetTermsPage;
