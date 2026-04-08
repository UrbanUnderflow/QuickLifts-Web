import React from 'react';
import type { NextPage, GetServerSideProps } from 'next';
import Link from 'next/link';
import PageHead from '../components/PageHead';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';

interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string;
}

interface PrivacyPolicyPageProps {
  metaData: SerializablePageMetaData | null;
}

type Section = {
  title: string;
  body: string[];
  bullets?: string[];
};

const EFFECTIVE_DATE = 'April 8, 2026';

const quickFacts = [
  {
    title: 'Company-wide baseline policy',
    body: 'This policy covers Pulse Intelligence Labs services broadly, including Fit With Pulse, Pulse, QuickLifts, PulseCheck, Group Meet, and related pilots, apps, sites, and integrations.',
  },
  {
    title: 'Supplemental notices still matter',
    body: 'Some products, pilots, school or team workflows, or third-party integrations come with additional privacy notices, disclosures, or consent materials that also apply.',
  },
  {
    title: 'Health data is context-specific',
    body: 'Not every health, wearable, or wellness workflow is governed by HIPAA. The applicable privacy posture depends on the product, sponsor, and data flow.',
  },
];

const sections: Section[] = [
  {
    title: 'Scope',
    body: [
      'This Privacy Policy applies to the websites, mobile apps, pilots, beta features, hosted workflows, integrations, and related services offered by Pulse Intelligence Labs, Inc., including Fit With Pulse, Pulse, QuickLifts, PulseCheck, Group Meet, and other products we make available from time to time.',
      'Additional product-specific, pilot-specific, organization-sponsored, or integration-specific notices may also apply. Those supplemental notices explain details for a particular workflow and should be read together with this policy.',
    ],
  },
  {
    title: 'Categories of information we collect',
    body: [
      'Depending on the Services you use, we may collect personal information in the following categories:',
    ],
    bullets: [
      'Identifiers and contact data, such as name, email address, username, phone number, account IDs, and invitation or referral metadata.',
      'Profile and account data, such as photo, bio, preferences, plan details, role, organization or team affiliation, and login credentials or authentication tokens.',
      'Fitness, wellness, readiness, recovery, mental-performance, and support-related data, such as workouts, progress, achievements, check-ins, journaling, readiness signals, survey responses, training activity, session history, and support or escalation workflow events.',
      'Connected device and integration data, such as information you choose to authorize from Apple Health, HealthKit, Oura, Google Calendar, and other approved sources or integrations.',
      'User content and communications, such as videos, photos, posts, comments, messages, prompts, responses, attachments, and content you create or upload.',
      'Commercial and billing data, such as purchase history, subscription status, product selections, payment processor identifiers, and transaction records.',
      'Technical, device, and usage data, such as IP address, browser type, device identifiers, operating system, crash or diagnostic logs, approximate location inferred from network or device data, event telemetry, and interaction history.',
      'Organization-supplied or sponsor-linked data, such as team, school, coach, clinician, referral, roster, or program metadata when a service is offered through an organization or partner.',
      'Inferences and derived data, such as engagement trends, risk or support signals, readiness summaries, personalization outputs, and quality or safety review flags generated from the information above.',
    ],
  },
  {
    title: 'How we collect information',
    body: [
      'We collect information directly from you when you create an account, subscribe, connect a device, answer prompts, upload content, or communicate with us.',
      'We also collect information automatically from your device and browser when you use the Services, and from third parties when you choose to connect them or when an organization, partner, payment provider, or service provider legitimately supplies information needed to operate the workflow.',
    ],
    bullets: [
      'Directly from you',
      'From your devices, browsers, and apps',
      'From wearable, calendar, payment, and identity integrations you authorize',
      'From coaches, teams, schools, or program sponsors where the workflow is organization-sponsored',
      'From service providers that help us host, authenticate, secure, analyze, message, or process payments',
    ],
  },
  {
    title: 'How we use information',
    body: [
      'We use personal information to operate, maintain, secure, and improve the Services, and to provide the features you request.',
    ],
    bullets: [
      'Create and manage accounts, authenticate users, and personalize product experiences',
      'Deliver workouts, readiness flows, check-ins, scheduling, support tools, pilots, and related product features',
      'Process subscriptions, purchases, entitlement checks, billing, refunds, and transaction support',
      'Run analytics, debugging, quality assurance, product improvement, fraud detection, safety review, and operational monitoring',
      'Send administrative messages, service notices, invitations, reminders, support communications, and, where permitted, marketing messages',
      'Support organization-sponsored, coach-linked, team, school, clinician, and partner workflows when those are part of the product design and disclosures',
      'Generate de-identified or aggregated reporting, research, and product-improvement insights',
      'Comply with law, enforce our terms, protect rights and safety, and investigate incidents or abuse',
    ],
  },
  {
    title: 'How we disclose information',
    body: [
      'We disclose personal information only as reasonably necessary to operate the Services, support the workflows you use, comply with law, and protect people and systems.',
    ],
    bullets: [
      'Service providers and contractors that support hosting, cloud infrastructure, storage, authentication, communications, analytics, billing, subscriptions, and customer support, including providers such as Firebase, Mixpanel, Stripe, RevenueCat, Brevo, and similar operational vendors',
      'Third-party platforms or integrations you choose to connect, such as Apple Health, Oura, Google Calendar, app stores, and identity or messaging services',
      'Coaches, team admins, school staff, clinicians, support partners, or program sponsors when a product or pilot is designed to share information with those roles and the applicable disclosures, permissions, or role rules allow it',
      'Legal, regulatory, safety, audit, insurance, financing, or transaction counterparties where required or reasonably necessary',
      'Affiliates or successors in connection with a merger, financing, reorganization, asset sale, acquisition, or similar business transaction',
    ],
  },
  {
    title: 'Health, wearable, and organization-sponsored data',
    body: [
      'Some Services involve wellness, readiness, recovery, or support-related data. If you connect a wearable or health source, we use the data you authorize for the purposes described in the relevant workflow, such as providing product features, personalization, pilot operations, and internal evaluation.',
      'If a service is sponsored by a coach, team, school, clinic, employer, or other organization, authorized staff or partners may be able to view information consistent with that workflow’s permissions, disclosures, consents, and role boundaries.',
      'Not all information in our consumer products is protected by HIPAA. Unless a service is offered by or on behalf of a HIPAA covered entity or business associate in a qualifying workflow, information you enter into or connect to the Services may not be subject to HIPAA protections.',
    ],
    bullets: [
      'Review any pilot, school, team, or program disclosures carefully because those workflows may include different recipients, support partners, or retention expectations.',
      'Where health, wearable, or support data is especially sensitive, we aim to limit collection, use, and disclosure to the minimum reasonably necessary for the feature or workflow.',
      'If a workflow does involve a covered entity, business associate, or other regulated healthcare posture, additional notices or authorizations may apply.',
    ],
  },
  {
    title: 'AI and automated features',
    body: [
      'Some Services use AI-assisted or automated systems to generate workouts, prompts, summaries, recommendations, scheduling suggestions, support signals, or other outputs. We may use information you provide to generate those outputs, improve quality, review failures, or monitor product performance and safety.',
      'AI or automated outputs can be incomplete or inaccurate and should not be treated as medical, therapeutic, legal, or emergency guidance.',
    ],
  },
  {
    title: 'Cookies, SDKs, analytics, and communications',
    body: [
      'We and our service providers use cookies, SDKs, local storage, pixels, device identifiers, and similar technologies to keep you signed in, remember preferences, measure performance, secure the Services, understand usage, and communicate with you.',
      'Our products may use analytics and messaging providers, including web and mobile event tools, crash or usage diagnostics, email delivery, and subscription or payment vendors.',
    ],
    bullets: [
      'You can often control cookies through browser settings and device identifiers or permissions through your device settings, although disabling some tools may affect product functionality.',
      'You can opt out of marketing emails by using the unsubscribe link in the message or by contacting us.',
      'If you disconnect an integration, we will stop using it for future syncs, subject to operational records, cached data, and lawful retention obligations.',
    ],
  },
  {
    title: 'Retention',
    body: [
      'We retain personal information for as long as reasonably necessary for the purposes described in this policy, including product operation, account maintenance, security, fraud prevention, compliance, dispute resolution, and recordkeeping.',
      'Retention periods vary by category and context. We may delete, anonymize, aggregate, or de-identify data when it is no longer reasonably needed in identifiable form.',
    ],
    bullets: [
      'Account and profile data are generally retained while your account is active and for a reasonable period afterward to support deletion processing, security, fraud prevention, and legal compliance.',
      'Workout, wellness, pilot, check-in, communication, and content records are generally retained while needed for the product experience, the active program, operational review, or until deletion or de-identification is appropriate.',
      'Billing, tax, payout, payment, and subscription records may be retained longer to meet accounting, audit, tax, chargeback, platform, and legal requirements.',
      'Technical logs and diagnostics may be retained for shorter periods needed for debugging, security review, and abuse prevention, although certain incident or audit logs may be retained longer.',
      'De-identified or aggregated data may be retained longer for analytics, system improvement, research, benchmarking, and operational learning where permitted by law.',
    ],
  },
  {
    title: 'Security and incident response',
    body: [
      'We use administrative, technical, and organizational safeguards designed to protect personal information, such as access controls, encrypted transport, protected infrastructure, monitoring, and internal access restrictions.',
      'No method of transmission, storage, or security control is perfect, and we cannot guarantee absolute security.',
      'If we determine that a reportable security incident or breach has occurred, we will provide notices required by applicable law. Certain health-related products or workflows may also be subject to specific breach-notification obligations under applicable law, including the FTC Health Breach Notification Rule where relevant.',
    ],
  },
  {
    title: 'Your choices and privacy rights',
    body: [
      'Depending on where you live and the Services you use, you may have rights to request access to, correction of, deletion of, or a copy of certain personal information, and to object to or limit certain processing activities.',
      'You may also be able to withdraw permissions for device integrations, disconnect connected accounts, update profile information, manage communications, or delete your account directly through the app or related tools.',
    ],
    bullets: [
      'Account deletion: use the in-app flow where available or visit our account deletion page',
      'Marketing opt-out: use the unsubscribe link or contact us',
      'Integration permissions: disconnect the integration in the app or through the third-party provider settings where available',
      'Access, deletion, correction, portability, or appeal requests: contact us using the details below',
    ],
  },
  {
    title: 'California and similar U.S. state privacy notices',
    body: [
      'Residents of California and certain other U.S. states may have additional rights, including the right to know the categories of personal information we collect, sources, purposes, categories of recipients, the right to request deletion or correction, the right to obtain a portable copy of certain information, and the right to opt out of certain types of sale, sharing, or targeted advertising where those rights apply.',
      'We do not sell personal information for money. We disclose personal information to service providers, contractors, partners, and workflow participants as described in this policy. If we engage in an activity that triggers an additional opt-out right under applicable law, we will provide the notice and method required by that law.',
      'To exercise rights requests, contact us using the information below. We may need to verify your identity before completing certain requests.',
    ],
  },
  {
    title: 'Children and age-sensitive use',
    body: [
      'Our consumer Services are not directed to children under 13. If we learn that we collected personal information from a child under 13 without appropriate authorization, we will take steps to delete it as required by law.',
      'Some organization-sponsored or school-linked workflows may involve teens or student-athletes. Those programs may require parental, guardian, school, or program authorization depending on the workflow and applicable law.',
    ],
  },
  {
    title: 'Changes to this policy',
    body: [
      'We may update this Privacy Policy from time to time. If we make material changes, we may provide notice by updating this page, through the Services, or by other reasonable means. The “effective date” above reflects the latest version.',
    ],
  },
];

const PrivacyPolicy: NextPage<PrivacyPolicyPageProps> = ({ metaData }) => {
  return (
    <div className="min-h-screen bg-[#05070b] text-white">
      <PageHead metaData={metaData} pageOgUrl="https://fitwithpulse.ai/privacy" />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
        <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(224,254,16,0.12),_transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-zinc-300">
            Pulse Intelligence Labs, Inc. Privacy Policy
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">How Pulse Intelligence Labs handles Fit With Pulse and PulseCheck data.</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg">
            Effective date: {EFFECTIVE_DATE}. This is the company-wide baseline privacy policy for Fit With Pulse, Pulse,
            QuickLifts, PulseCheck, Group Meet, and related websites, apps, pilots, and hosted workflows.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/terms" className="inline-flex items-center justify-center rounded-full bg-[#E0FE10] px-5 py-3 font-semibold text-black transition hover:bg-lime-300">
              Review terms
            </Link>
            <Link href="/delete-account" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 font-medium text-zinc-100 transition hover:bg-white/10">
              Account deletion
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {quickFacts.map((fact) => (
            <article key={fact.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
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
                        <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#E0FE10]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-[#E0FE10]/20 bg-[#E0FE10]/[0.06] p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Contact us</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-200 sm:text-base">
            For privacy questions, data deletion requests, or rights requests related to Fit With Pulse, PulseCheck, or
            other Pulse Intelligence Labs, Inc. services, contact{' '}
            <a className="text-[#E0FE10] underline underline-offset-4" href="mailto:info@fitwithpulse.ai">
              info@fitwithpulse.ai
            </a>{' '}
            or{' '}
            <a className="text-[#E0FE10] underline underline-offset-4" href="mailto:tre@fitwithpulse.ai">
              tre@fitwithpulse.ai
            </a>.
          </p>
        </section>
      </main>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<PrivacyPolicyPageProps> = async (_context) => {
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    rawMetaData = await adminMethods.getPageMetaData('privacyPolicy');
  } catch (error) {
    console.error('Error fetching page meta data for privacy policy page:', error);
  }

  let serializableMetaData: SerializablePageMetaData | null = null;
  if (rawMetaData) {
    serializableMetaData = {
      ...rawMetaData,
      lastUpdated: rawMetaData.lastUpdated.toDate().toISOString(),
    };
  }

  return {
    props: {
      metaData: serializableMetaData,
    },
  };
};

export default PrivacyPolicy;
