import Head from 'next/head';
import Link from 'next/link';
import type { NextPage } from 'next';

type Section = {
  title: string;
  body: string[];
  bullets?: string[];
};

const EFFECTIVE_DATE = 'June 29, 2026';

const sections: Section[] = [
  {
    title: 'Scope',
    body: [
      'This PulseCheck Coach Privacy Notice explains how Pulse Intelligence Labs, Inc. handles information when coaches, administrators, trainers, clinicians, support staff, and other authorized adults use the PulseCheck coach dashboard, staff invite tools, reports, alerts, onboarding links, and related team workflows.',
      'This notice supplements the company-wide Pulse Privacy Policy. If there is a direct conflict for a PulseCheck coach workflow, this PulseCheck Coach Privacy Notice controls for that workflow.',
    ],
  },
  {
    title: 'Information we collect from coaches and staff',
    body: [
      'We collect account and profile information such as name, email address, title, team role, organization association, profile photo, phone number, notification preferences, and authentication identifiers.',
      'We collect operational information created through the dashboard, such as staff invite details, athlete invite activity, role and permission selections, team setup choices, onboarding progress, report access, copied links, support route configuration, and dashboard interaction logs.',
      'We may collect technical information such as device, browser, IP address, timestamps, error logs, authentication events, and diagnostic metadata needed to operate and secure PulseCheck.',
    ],
  },
  {
    title: 'Athlete and team information visible to coaches',
    body: [
      'Depending on your role, permissions, team configuration, athlete consent, and product design, PulseCheck may show athlete or team information such as roster status, onboarding state, adherence, readiness categories, report summaries, follow-up items, invite status, support indicators, or privacy-safe escalation awareness.',
      'PulseCheck is designed to limit coach visibility into sensitive information. Some athlete data may be aggregated, summarized, filtered, delayed, redacted, or withheld. Coach access does not mean unrestricted access to private conversations, clinical records, or sensitive details.',
      'Where clinician or trainer workflows are enabled, access may differ by role and may be governed by additional organization policies, contracts, disclosures, or consent documents.',
    ],
  },
  {
    title: 'How we use information',
    body: [
      'We use information to operate the coach dashboard, verify access, support team setup, process staff and athlete invites, route users to the correct onboarding flow, show appropriate reports, and enforce role-based permissions.',
      'We use information to generate or display PulseCheck reports, alerts, follow-up queues, training walkthroughs, staff management tools, notification settings, and team operational views.',
      'We use information to secure the platform, prevent misuse, troubleshoot errors, improve reliability, audit invite and acceptance events, and maintain product records.',
    ],
  },
  {
    title: 'AI-assisted features and reports',
    body: [
      'PulseCheck may use automated analysis and AI-assisted systems to create summaries, reports, insights, suggested follow-ups, adherence classifications, readiness patterns, or training walkthrough content.',
      'AI-assisted outputs may be incomplete or inaccurate. They are informational and performance-supportive, not medical advice, diagnosis, therapy, emergency response, or a substitute for professional judgment.',
      'We may process relevant team, athlete, coach, and platform information through trusted service providers to generate or improve these features, subject to security, access, and contractual controls.',
    ],
  },
  {
    title: 'Sharing and role-based access',
    body: [
      'Information may be available to authorized users in your organization based on role, permission, consent, and team configuration. For example, a team admin may manage staff invites and settings, while other staff may have narrower access.',
      'We may share information with trusted service providers that help us host, secure, authenticate, email, message, analyze, monitor, or operate PulseCheck.',
      'We may disclose information when required by law, to protect rights and safety, to investigate misuse, to enforce terms, or as part of a corporate transaction such as financing, merger, acquisition, or asset transfer.',
    ],
  },
  {
    title: 'Notifications and communications',
    body: [
      'PulseCheck may send or help your organization send activation emails, staff invites, athlete invites, onboarding reminders, report notifications, escalation awareness messages, product updates, or administrative notices.',
      'Notification availability and content may depend on your role, contact information, team setup, organization choices, and notification preferences.',
    ],
  },
  {
    title: 'Health, safety, and emergency boundaries',
    body: [
      'PulseCheck may surface support or escalation-related information, but it is not an emergency service. If immediate help is needed, contact emergency services, 988, campus safety, or the appropriate crisis or organization protocol.',
      'PulseCheck may show privacy-safe safety visibility to coaches while withholding sensitive details that are not appropriate for the coach role. Clinician-routed workflows may involve designated clinical or support staff according to team configuration and applicable disclosures.',
    ],
  },
  {
    title: 'Third-party services and integrations',
    body: [
      'PulseCheck may use third-party services for authentication, cloud hosting, analytics, crash reporting, email delivery, SMS or push delivery, storage, AI infrastructure, payment or subscription support, and wearable or health data integrations where enabled.',
      'Third-party services may process information according to their own terms and privacy practices. We use service providers to support PulseCheck operations and apply reasonable contractual and technical safeguards.',
    ],
  },
  {
    title: 'Retention',
    body: [
      'We retain coach account, staff invite, team setup, access, audit, and operational records for as long as reasonably necessary to provide PulseCheck, maintain security, resolve disputes, support customer organizations, comply with law, and enforce our terms.',
      'Some organization-sponsored, pilot, research, clinical handoff, or safety-related records may have different retention needs based on contracts, disclosures, consent materials, legal obligations, or operational requirements.',
      'If you leave an organization or your role changes, your access may be removed or narrowed, but records of past actions may remain where needed for audit, security, compliance, or team continuity.',
    ],
  },
  {
    title: 'Your choices and requests',
    body: [
      'You can update some profile and notification settings in the coach dashboard. Some team, organization, role, or athlete-related data may need to be updated by a team admin, organization admin, or PulseCheck support.',
      'You may contact us to request access, correction, deletion, or other privacy assistance. We may need to verify your identity and may retain certain information where required or permitted by law, security, contractual obligations, or legitimate operational needs.',
    ],
  },
  {
    title: 'Changes to this notice',
    body: [
      'We may update this PulseCheck Coach Privacy Notice as the platform changes. If we make material changes, we may provide notice through the platform or ask you to accept updated legal terms before continuing.',
    ],
  },
];

const quickFacts = [
  {
    title: 'Coach-specific data use',
    body: 'This notice covers dashboard setup, staff invites, reports, alerts, permissions, onboarding, and team operations.',
  },
  {
    title: 'Role-based visibility',
    body: 'Coach views may be privacy-filtered based on permissions, consent, team setup, and safety posture.',
  },
  {
    title: 'Sensitive athlete data',
    body: 'PulseCheck may summarize or withhold sensitive detail instead of exposing unrestricted athlete information.',
  },
];

const PulseCheckPrivacyPage: NextPage = () => (
  <div className="min-h-screen bg-[#070711] text-white">
    <Head>
      <title>PulseCheck Coach Privacy Notice | Pulse Intelligence Labs</title>
      <meta
        name="description"
        content="PulseCheck coach privacy notice for dashboard access, staff invites, reports, alerts, role-based visibility, and athlete privacy boundaries."
      />
      <link rel="canonical" href="https://fitwithpulse.ai/PulseCheck/privacy" />
      <meta property="og:title" content="PulseCheck Coach Privacy Notice" />
      <meta
        property="og:description"
        content="Privacy notice specific to coaches and authorized staff using PulseCheck team and dashboard workflows."
      />
      <meta property="og:url" content="https://fitwithpulse.ai/PulseCheck/privacy" />
      <meta property="og:type" content="website" />
    </Head>

    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
      <section className="rounded-[32px] border border-purple-300/20 bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.34),_transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-purple-100">
          PulseCheck Coach Privacy Notice
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">How PulseCheck handles coach dashboard and team workflow data.</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg">
          Effective date: {EFFECTIVE_DATE}. This notice is specific to coaches and authorized staff using PulseCheck dashboard,
          invite, report, alert, and team-support workflows.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/PulseCheck/terms" className="inline-flex items-center justify-center rounded-full bg-[#7C3AED] px-5 py-3 font-semibold text-white transition hover:bg-[#8B5CF6]">
            Review coach terms
          </Link>
          <Link href="/coach/dashboard" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 font-medium text-zinc-100 transition hover:bg-white/10">
            Back to dashboard
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {quickFacts.map((fact) => (
          <article key={fact.title} className="rounded-3xl border border-purple-300/15 bg-white/[0.035] p-6">
            <h2 className="text-xl font-semibold">{fact.title}</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300 sm:text-base">{fact.body}</p>
          </article>
        ))}
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
              {section.bullets ? (
                <ul className="space-y-3 pt-1 text-sm leading-7 text-zinc-300 sm:text-base">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#A78BFA]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-purple-300/15 bg-black/20 p-6 sm:p-8">
        <h2 className="text-2xl font-semibold">Privacy questions or requests</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300 sm:text-base">
          For PulseCheck coach privacy questions, access requests, deletion requests, or organization-specific data questions,
          contact{' '}
          <a className="text-[#A78BFA] underline underline-offset-4" href="mailto:tre@fitwithpulse.ai">
            tre@fitwithpulse.ai
          </a>{' '}
          or{' '}
          <a className="text-[#A78BFA] underline underline-offset-4" href="mailto:info@fitwithpulse.ai">
            info@fitwithpulse.ai
          </a>.
        </p>
      </section>
    </main>
  </div>
);

export default PulseCheckPrivacyPage;
