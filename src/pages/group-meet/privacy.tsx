import Head from 'next/head';
import Link from 'next/link';
import type { NextPage } from 'next';

const sections = [
  {
    title: 'Scope',
    body: [
      'This privacy policy applies to Group Meet, the Pulse scheduling workflow available at fitwithpulse.ai/group-meet and individual invite links under fitwithpulse.ai/group-meet/[token].',
      'Group Meet is used to coordinate meeting availability for Pulse employees and invited participants, including invited external guests when an organizer includes them in a request.',
    ],
  },
  {
    title: 'Information we collect',
    body: [
      'Organizer-provided meeting data such as request title, target month, deadline, meeting duration, host, guest list, and optional contact photos or names.',
      'Guest-provided availability selections, response timestamps, and any message or scheduling metadata needed to run the request.',
      'Basic technical data needed to operate the service, such as logs, browser metadata, and request diagnostics.',
      'If a guest chooses to connect Google Calendar, Group Meet may access the guest Google account email address and read-only calendar busy blocks needed to generate editable availability suggestions.',
    ],
  },
  {
    title: 'How we use information',
    body: [
      'To present the scheduling request, collect availability, calculate overlaps, and help the organizer coordinate a final meeting time.',
      'To send invite, preview, resend, and administrative status emails related to the request.',
      'To diagnose failures, secure the service, prevent misuse, and improve reliability.',
      'To support optional Google Calendar import only when the guest actively chooses to connect it.',
    ],
  },
  {
    title: 'Google user data',
    body: [
      'Group Meet requests read-only access to Google Calendar solely to identify existing busy blocks and convert them into editable availability suggestions for the guest.',
      'Group Meet does not use Google Calendar access to create, edit, or delete calendar events during the guest import flow.',
      'Group Meet does not sell Google user data and does not use Google user data for advertising.',
      'Imported suggestions are not automatically saved as a response. The guest must still review the suggestions and choose what to save manually.',
      'Group Meet\'s use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.',
    ],
  },
  {
    title: 'Sharing and access',
    body: [
      'Availability and request data are visible to the organizer and the operational systems used to run Group Meet.',
      'Guests may see summarized overlap context or previously submitted day-level availability from other invited participants inside the scheduling flow where relevant to coordination.',
      'We may use trusted service providers to host infrastructure, email delivery, and authentication services necessary to run Group Meet.',
    ],
  },
  {
    title: 'Retention',
    body: [
      'We retain Group Meet request data for as long as reasonably necessary to operate the scheduling request, maintain operational records, resolve disputes, and meet legal, security, or compliance obligations.',
      'If a guest disconnects Google Calendar, we stop using the connection for future imports. If you need assistance removing stored Group Meet scheduling data, contact info@fitwithpulse.ai.',
      'When Google Calendar tokens are no longer needed for the feature, we remove or invalidate them according to our operational and security requirements.',
    ],
  },
  {
    title: 'Security',
    body: [
      'We use access controls, encrypted transport, and server-side safeguards designed to protect Group Meet data.',
      'Where Google Calendar tokens are used for guest import, they are stored in protected server-side infrastructure and are intended only for the scheduling feature described here.',
    ],
  },
  {
    title: 'Your choices',
    body: [
      'Guests can decline Google Calendar access and continue using Group Meet manually.',
      'Guests can disconnect Google Calendar after connecting it and may contact us with requests regarding scheduling data.',
      'Organizers control whether and when a request is sent, and guests control what availability they save in response.',
    ],
  },
];

const GroupMeetPrivacyPage: NextPage = () => {
  return (
    <div className="min-h-screen bg-[#05070b] text-white">
      <Head>
        <title>Group Meet Privacy Policy | Pulse</title>
        <meta
          name="description"
          content="Privacy policy for Group Meet, Pulse's invite-only meeting scheduling workflow with optional read-only Google Calendar import."
        />
        <link rel="canonical" href="https://fitwithpulse.ai/group-meet/privacy" />
        <meta property="og:title" content="Group Meet Privacy Policy | Pulse" />
        <meta
          property="og:description"
          content="Learn how Group Meet collects, uses, and protects availability and optional Google Calendar data."
        />
        <meta property="og:url" content="https://fitwithpulse.ai/group-meet/privacy" />
        <meta property="og:type" content="website" />
      </Head>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
        <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(224,254,16,0.12),_transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-zinc-300">
            Group Meet Privacy Policy
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">How Group Meet handles scheduling and Google Calendar data.</h1>
          <p className="mt-4 text-base leading-7 text-zinc-300 sm:text-lg">
            Effective date: April 5, 2026. This policy is specific to the Group Meet scheduling experience at
            fitwithpulse.ai/group-meet and is intended to support invite-only meeting coordination.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/group-meet" className="inline-flex items-center justify-center rounded-full bg-[#E0FE10] px-5 py-3 font-semibold text-black transition hover:bg-lime-300">
              Back to Group Meet
            </Link>
            <Link href="/group-meet/terms" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 font-medium text-zinc-100 transition hover:bg-white/10">
              Review terms
            </Link>
          </div>
        </section>

        <section className="space-y-6">
          {sections.map((section) => (
            <article key={section.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <div className="mt-4 space-y-4">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-zinc-300 sm:text-base">
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-[#E0FE10]/20 bg-[#E0FE10]/[0.06] p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Related Group Meet pages</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/group-meet" className="inline-flex items-center justify-center rounded-full bg-[#E0FE10] px-5 py-3 font-semibold text-black transition hover:bg-lime-300">
              Group Meet home
            </Link>
            <Link href="/group-meet/terms" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/20 px-5 py-3 font-medium text-zinc-100 transition hover:bg-white/10">
              Terms
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/20 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Contact us</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-300 sm:text-base">
            For Group Meet privacy questions, deletion requests, or Google Calendar access questions, contact
            Pulse Intelligence Labs at{' '}
            <a className="text-[#E0FE10] underline underline-offset-4" href="mailto:info@fitwithpulse.ai">
              info@fitwithpulse.ai
            </a>.
          </p>
        </section>
      </main>
    </div>
  );
};

export default GroupMeetPrivacyPage;
