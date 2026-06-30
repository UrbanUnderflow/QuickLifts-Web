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
    title: 'Scope and coach acceptance',
    body: [
      'These PulseCheck Coach Terms apply when a coach, administrator, trainer, clinician, support staff member, or other authorized adult uses the PulseCheck coach dashboard, onboarding links, staff invite tools, team workspace links, reports, alerts, or related PulseCheck platform workflows.',
      'PulseCheck is provided by Pulse Intelligence Labs, Inc. These terms supplement the company-wide Pulse terms. If these PulseCheck Coach Terms conflict with the general Pulse terms for a coach dashboard workflow, these PulseCheck Coach Terms control for that workflow.',
      'If you use PulseCheck on behalf of a team, school, club, clinic, organization, or other program, you represent that you are authorized to use the platform for that organization and to invite appropriate staff into the workspace.',
    ],
  },
  {
    title: 'Coach role and account responsibilities',
    body: [
      'You are responsible for keeping your account credentials secure, maintaining accurate profile information, and using role-based access only for legitimate team operations.',
      'If you invite staff, assign permissions, generate onboarding links, or configure team settings, you are responsible for choosing appropriate recipients and permissions.',
    ],
    bullets: [
      'Do not share your account or use another person\'s login.',
      'Do not invite a person unless they are authorized to support the team, athlete group, or organization.',
      'Do not attempt to access athlete, staff, team, or organization information beyond your assigned role.',
    ],
  },
  {
    title: 'Athlete privacy and visibility boundaries',
    body: [
      'PulseCheck is designed to give coaches operational, privacy-aware visibility into readiness, adherence, support needs, and team workflows. It is not designed to give coaches unrestricted access to private athlete conversations, clinical records, or sensitive details outside the permissions and disclosures attached to the team.',
      'Athlete-facing data may be filtered, summarized, delayed, redacted, or withheld depending on role, consent, team configuration, safety posture, law, and product design.',
      'You agree to use athlete information only for appropriate team support, performance, safety, and operational purposes. You may not use PulseCheck information to shame, harass, discriminate against, retaliate against, or publicly expose an athlete.',
    ],
  },
  {
    title: 'Safety, escalation, and clinical boundaries',
    body: [
      'PulseCheck may surface alerts, watch-list states, support indicators, or escalation-related information. These features are awareness and coordination tools, not emergency response, medical care, mental health treatment, diagnosis, therapy, or crisis intervention.',
      'If you believe an athlete or any person may be in immediate danger, contact 911, local emergency services, 988, campus safety, your organization\'s emergency protocol, or another appropriate crisis resource. Do not rely on PulseCheck as the emergency channel.',
      'If your organization uses clinician-routed workflows, clinical judgment remains with the designated qualified professionals. Coaches must follow their organization\'s policies, legal obligations, safeguarding rules, and escalation protocols.',
    ],
  },
  {
    title: 'AI, reports, and performance guidance',
    body: [
      'PulseCheck may use automated analysis, AI-assisted summaries, generated reports, readiness patterns, adherence signals, or suggested coach follow-ups. These outputs can be incomplete, inaccurate, delayed, or inappropriate for a particular context.',
      'PulseCheck outputs are informational and performance-supportive. They do not replace your professional judgment, organization policy, licensed medical or mental health care, or direct communication with athletes and qualified staff.',
      'You are responsible for deciding how to use PulseCheck insights in a manner that is appropriate, respectful, privacy-aware, and consistent with your role.',
    ],
  },
  {
    title: 'Onboarding links, staff invites, and permissions',
    body: [
      'Activation links, staff invite links, athlete invite links, and onboarding flows are intended only for the named or intended recipients. You should not post restricted links publicly or send them to people who are not authorized to join the team workspace.',
      'PulseCheck roles and permissions may control what a user can view or do. You are responsible for reviewing staff permissions before sending invites and updating them if a person\'s role changes.',
    ],
    bullets: [
      'Team admins may have access to setup, invite, and staff-management tools.',
      'Coaches and performance staff may have access to athlete and team workflows based on permissions.',
      'Administrative-only staff may have limited operational access without full athlete visibility.',
      'Clinician or trainer access may be configured separately where supported.',
    ],
  },
  {
    title: 'Organization-sponsored use',
    body: [
      'Some PulseCheck workspaces are sponsored, configured, or administered by schools, teams, clubs, clinics, research groups, brands, or other organizations. Your access may be subject to organization policies, team rules, separate agreements, consent materials, pilot documents, or research disclosures.',
      'Pulse Intelligence Labs may modify, suspend, or remove access where needed for security, safety, legal compliance, product integrity, non-payment, product changes, or violation of these terms.',
    ],
  },
  {
    title: 'Acceptable use',
    body: [
      'You may not misuse PulseCheck, interfere with the platform, or use the platform in a way that harms athletes, staff, Pulse Intelligence Labs, or your organization.',
    ],
    bullets: [
      'Do not scrape, export, sell, or redistribute platform data except as expressly permitted.',
      'Do not upload unlawful, infringing, abusive, discriminatory, or unsafe content.',
      'Do not bypass access controls, impersonate another person, or interfere with uptime or security.',
      'Do not use PulseCheck to make medical, disciplinary, eligibility, scholarship, roster, or employment decisions without appropriate human review and applicable organizational process.',
    ],
  },
  {
    title: 'Third-party services and integrations',
    body: [
      'PulseCheck may connect with identity providers, email services, SMS or push providers, wearable or health platforms, analytics tools, cloud infrastructure, app stores, or other third-party services. Those third parties may have their own terms and privacy practices.',
      'We are not responsible for third-party products, services, outages, security incidents, billing rules, or acts or omissions outside our control.',
    ],
  },
  {
    title: 'Changes, suspension, and termination',
    body: [
      'We may update these PulseCheck Coach Terms from time to time. If we make material changes, we may ask you to accept the updated terms before continuing to use the coach dashboard.',
      'You may stop using PulseCheck at any time. We may suspend, restrict, or terminate access if we reasonably believe it is needed to protect users, the platform, legal compliance, operational integrity, or our rights.',
    ],
  },
  {
    title: 'Disclaimers and limitation of liability',
    body: [
      'To the fullest extent permitted by law, PulseCheck is provided as is and as available without warranties of any kind. We do not guarantee that PulseCheck will be uninterrupted, error-free, secure, accurate, complete, or suitable for every team, athlete, staff workflow, or organization.',
      'To the fullest extent permitted by law, Pulse Intelligence Labs, Inc. will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, data, goodwill, or business interruption arising out of or related to PulseCheck.',
      'Nothing in these terms limits liability that cannot be limited under applicable law.',
    ],
  },
];

const quickFacts = [
  {
    title: 'Coach platform terms',
    body: 'These terms are specific to coach dashboard, staff invite, team setup, reports, and role-based PulseCheck workflows.',
  },
  {
    title: 'Privacy-aware visibility',
    body: 'Coach access is role-based and may show filtered or summarized athlete information rather than unrestricted sensitive detail.',
  },
  {
    title: 'Not emergency care',
    body: 'PulseCheck is not an emergency channel, medical service, therapy, or substitute for organizational safety protocols.',
  },
];

const PulseCheckTermsPage: NextPage = () => (
  <div className="min-h-screen bg-[#070711] text-white">
    <Head>
      <title>PulseCheck Coach Terms | Pulse Intelligence Labs</title>
      <meta
        name="description"
        content="PulseCheck coach platform terms for dashboard access, staff invites, athlete privacy boundaries, reports, and safety workflows."
      />
      <link rel="canonical" href="https://fitwithpulse.ai/PulseCheck/terms" />
      <meta property="og:title" content="PulseCheck Coach Terms" />
      <meta
        property="og:description"
        content="Terms specific to coaches and authorized staff using PulseCheck team and dashboard workflows."
      />
      <meta property="og:url" content="https://fitwithpulse.ai/PulseCheck/terms" />
      <meta property="og:type" content="website" />
    </Head>

    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
      <section className="rounded-[32px] border border-purple-300/20 bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.34),_transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-purple-100">
          PulseCheck Coach Terms
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Terms for coaches using PulseCheck.</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg">
          Effective date: {EFFECTIVE_DATE}. These terms apply to coach dashboard access, staff invites, role-based team workflows,
          PulseCheck reports, alerts, and privacy-aware athlete support tools.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/PulseCheck/privacy" className="inline-flex items-center justify-center rounded-full bg-[#7C3AED] px-5 py-3 font-semibold text-white transition hover:bg-[#8B5CF6]">
            Review privacy notice
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
        <h2 className="text-2xl font-semibold">Questions or legal notices</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300 sm:text-base">
          For questions about PulseCheck coach terms, privacy, access, or product-specific legal notices, contact{' '}
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

export default PulseCheckTermsPage;
