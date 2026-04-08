import Head from 'next/head';
import Link from 'next/link';
import type { NextPage } from 'next';

type Section = {
  title: string;
  body: string[];
  bullets?: string[];
};

const EFFECTIVE_DATE = 'April 8, 2026';

const sections: Section[] = [
  {
    title: 'Scope and acceptance',
    body: [
      'These Terms of Service apply to the websites, mobile apps, pilots, beta programs, software, content, and related services offered by Pulse Intelligence Labs, Inc., including Fit With Pulse, Pulse, QuickLifts, PulseCheck, Group Meet, and related integrations or hosted workflows we make available from time to time.',
      'By accessing or using the Services, you agree to these Terms. If you use a specific product, pilot, organization-sponsored workflow, paid feature, or third-party integration, additional product-specific terms, disclosures, consent forms, or program materials may also apply. If there is a direct conflict, the more specific supplemental terms control for that workflow.',
      'If you use the Services on behalf of a company, team, school, department, or other organization, you represent that you have authority to bind that organization to these Terms for the portions of the Services it uses.',
    ],
  },
  {
    title: 'Eligibility and account responsibilities',
    body: [
      'You must be legally able to enter into these Terms. If you are under the age of majority in your jurisdiction, you may use the Services only with the permission of a parent, guardian, school, team, or other authorized adult as applicable to the program.',
      'You are responsible for maintaining accurate account information, safeguarding your credentials, and all activity that occurs through your account. Notify us promptly if you believe your account has been accessed without authorization.',
    ],
    bullets: [
      'Do not create accounts using false information or impersonate another person or organization.',
      'Do not share credentials in a way that defeats seat, role, or security limits.',
      'We may suspend or require verification for accounts that appear fraudulent, abusive, unsafe, or inconsistent with these Terms.',
    ],
  },
  {
    title: 'Health, wellness, AI, and emergency boundaries',
    body: [
      'The Services may provide fitness, wellness, training, readiness, recovery, mental-performance, educational, scheduling, or support-related features, including AI-assisted outputs. Those outputs can be incomplete, inaccurate, or inappropriate for your circumstances.',
      'The Services are not medical advice, mental health treatment, diagnosis, therapy, emergency response, or crisis care, and they are not a substitute for licensed professional judgment. Always use your own judgment and consult a qualified professional where appropriate before acting on training, wellness, or support information.',
      'If you believe you or someone else may be in immediate danger or needs urgent medical or mental health support, call 911, local emergency services, or the appropriate crisis resource immediately. Do not rely on the Services as an emergency channel.',
    ],
    bullets: [
      'Physical training and exercise involve inherent risk, including injury, illness, overtraining, and aggravation of existing conditions.',
      'Mental-performance, readiness, and support features may surface sensitive or imperfect signals and should be interpreted carefully.',
      'You are responsible for deciding whether any activity, recommendation, plan, or program is appropriate for you.',
    ],
  },
  {
    title: 'Organization-sponsored, coach, and pilot workflows',
    body: [
      'Some Services are offered through a school, coach, team, clinic, employer, partner, or other organization. In those workflows, authorized administrators, coaches, support staff, clinicians, or partner organizations may receive access to data, summaries, or status information according to your settings, the service design, role-based permissions, and any specific disclosures or consents that apply to that workflow.',
      'Certain Services may be released as pilots, previews, canaries, experimental programs, or beta features. Those features may change quickly, be incomplete, or be discontinued without notice.',
    ],
  },
  {
    title: 'Subscriptions, billing, and paid services',
    body: [
      'Some Services require payment, subscription, or in-app purchase. Pricing, billing intervals, included features, trial terms, and eligibility may vary by product and platform.',
      'If you purchase through Apple, Google, RevenueCat, Stripe, or another payment or subscription provider, your billing relationship may also be governed by that provider’s terms, refund rules, and account settings. We do not control third-party billing platforms.',
      'Unless otherwise stated, subscriptions automatically renew until canceled. You are responsible for canceling before renewal if you do not want the next billing cycle charged.',
    ],
    bullets: [
      'Fees are generally non-refundable except where required by law, the app store or payment provider rules, or an express written offer from us.',
      'We may change pricing, plans, or packaging prospectively. Material pricing changes for recurring plans will be communicated as required by law or platform rules.',
      'You are responsible for taxes, duties, and similar charges associated with your purchases unless law requires us to collect and remit them directly.',
    ],
  },
  {
    title: 'User content, public content, and feedback',
    body: [
      'You retain ownership of the content you submit, upload, or create in the Services. You grant Pulse Intelligence Labs, Inc. a non-exclusive, worldwide, royalty-free license to host, store, reproduce, adapt, modify for technical formatting, analyze, transmit, display, and distribute that content as needed to operate, secure, improve, and provide the Services to you and other authorized users.',
      'If you make content public or share it with others through the Services, you understand that authorized users may be able to view, copy, comment on, or redistribute that content within the normal operation of the product.',
      'If you send ideas, suggestions, bug reports, or feedback to us, we may use them without restriction or compensation to improve the Services.',
    ],
    bullets: [
      'You must have the rights needed to submit the content you upload.',
      'Do not upload content that infringes rights, violates privacy, contains unlawful material, or creates safety risks.',
      'If a product-specific disclosure says content will be retained, deleted, anonymized, or reviewed in a particular way, that disclosure also applies.',
    ],
  },
  {
    title: 'Acceptable use',
    body: [
      'You may not misuse the Services, interfere with other users, or attempt to bypass technical or policy controls. We may investigate and act on suspected misuse, security threats, or unlawful behavior.',
    ],
    bullets: [
      'Do not reverse engineer, scrape, copy, or systematically extract data from the Services except where a separate written agreement expressly permits it.',
      'Do not upload malware, abuse APIs, interfere with uptime, or attempt to gain access beyond your authorization.',
      'Do not use the Services to harass, discriminate against, exploit, stalk, or harm another person.',
      'Do not use the Services in a way that violates law, another party’s rights, or product-specific safety rules.',
    ],
  },
  {
    title: 'Third-party services and integrations',
    body: [
      'The Services may interoperate with third-party platforms, devices, SDKs, identity providers, app stores, wearables, payment providers, calendar providers, or communication services. Those third parties may have their own terms and privacy practices.',
      'We are not responsible for the availability, accuracy, security, billing, or acts or omissions of third-party products or services. Your use of third-party products is at your own risk and may be subject to separate terms.',
    ],
  },
  {
    title: 'Privacy and supplemental disclosures',
    body: [
      'Our collection, use, disclosure, and retention of personal information are described in our Privacy Policy and any supplemental privacy notices, pilot disclosures, or workflow-specific data-use documents that apply to a particular service or program.',
      'By using the Services, you acknowledge that data handling may differ across products, organization-sponsored workflows, and integrations, and that you should review any supplemental notices presented to you.',
    ],
  },
  {
    title: 'Suspension and termination',
    body: [
      'You may stop using the Services at any time. We may suspend, limit, or terminate access if we reasonably believe it is necessary for security, safety, fraud prevention, legal compliance, operational integrity, non-payment, product sunset, or violations of these Terms.',
      'Termination does not affect rights or obligations that by their nature should survive, including payment obligations, intellectual property provisions, disclaimers, limitations of liability, indemnity, dispute provisions, and any licenses necessary to resolve matters arising before termination.',
    ],
  },
  {
    title: 'Disclaimers',
    body: [
      'TO THE FULLEST EXTENT PERMITTED BY LAW, THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, QUIET ENJOYMENT, ACCURACY, OR SYSTEM INTEGRATION.',
      'We do not warrant that the Services will be uninterrupted, error-free, secure, available at any particular time or location, compatible with every device or workflow, or that any content, analytics, AI output, training recommendation, or support signal will be accurate, complete, or suitable for your needs.',
    ],
  },
  {
    title: 'Limitation of liability',
    body: [
      'TO THE FULLEST EXTENT PERMITTED BY LAW, PULSE INTELLIGENCE LABS, INC. AND ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, CONTRACTORS, LICENSORS, AND PARTNERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS INTERRUPTION, ARISING OUT OF OR RELATING TO THE SERVICES.',
      'TO THE FULLEST EXTENT PERMITTED BY LAW, THE TOTAL AGGREGATE LIABILITY OF PULSE INTELLIGENCE LABS, INC. FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE SERVICES WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US FOR THE RELEVANT SERVICE IN THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM OR (B) ONE HUNDRED U.S. DOLLARS (US $100).',
      'Nothing in these Terms limits liability that cannot be limited under applicable law.',
    ],
  },
  {
    title: 'Indemnity',
    body: [
      'To the fullest extent permitted by law, you will defend, indemnify, and hold harmless Pulse Intelligence Labs, Inc. and its affiliates, officers, directors, employees, contractors, licensors, and partners from and against claims, liabilities, damages, judgments, losses, costs, and expenses, including reasonable attorneys’ fees, arising out of or related to your content, your misuse of the Services, your violation of these Terms, or your violation of another party’s rights or applicable law.',
    ],
  },
  {
    title: 'Disputes, governing law, and changes',
    body: [
      'Unless a separate written agreement says otherwise or applicable law requires a different result, these Terms are governed by the laws applicable in the jurisdiction of Pulse Intelligence Labs, Inc.’s principal place of business, excluding conflict-of-law rules. You and Pulse Intelligence Labs, Inc. consent to the exclusive jurisdiction of the courts serving that location for disputes that may be heard in court.',
      'We may update these Terms from time to time. If we make material changes, we may provide notice by updating this page, through the Services, or by other reasonable means. Your continued use of the Services after updated Terms become effective means you accept the updated Terms.',
    ],
  },
];

const quickFacts = [
  {
    title: 'Not medical or emergency care',
    body: 'Fit With Pulse, Pulse, QuickLifts, PulseCheck, and related pilots are not emergency response, crisis care, or a substitute for licensed professional treatment.',
  },
  {
    title: 'Beta and pilot features may change',
    body: 'Some features are experimental, incomplete, or may be suspended, changed, or discontinued as we keep building.',
  },
  {
    title: 'Platform billing may be separate',
    body: 'Apple, Google, Stripe, and RevenueCat may control billing, renewal, and refund rules for certain products or purchases.',
  },
];

const TermsPage: NextPage = () => {
  return (
    <div className="min-h-screen bg-[#05070b] text-white">
      <Head>
        <title>Terms of Service | Pulse Intelligence Labs, Inc.</title>
        <meta
          name="description"
          content="Terms of Service for Pulse Intelligence Labs, Inc. services, including Fit With Pulse, PulseCheck, QuickLifts, and related products."
        />
        <link rel="canonical" href="https://fitwithpulse.ai/terms" />
        <meta property="og:title" content="Terms of Service | Pulse Intelligence Labs, Inc." />
        <meta
          property="og:description"
          content="Review the terms that govern your use of Fit With Pulse, PulseCheck, QuickLifts, and related services."
        />
        <meta property="og:url" content="https://fitwithpulse.ai/terms" />
        <meta property="og:type" content="website" />
      </Head>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
        <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(224,254,16,0.12),_transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-zinc-300">
            Pulse Intelligence Labs, Inc. Terms of Service
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Terms for using Fit With Pulse, PulseCheck, and Pulse Intelligence Labs services.</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg">
            Effective date: {EFFECTIVE_DATE}. These terms are written to cover the company-level service layer across Fit With
            Pulse, Pulse, QuickLifts, PulseCheck, Group Meet, pilots, beta programs, and related integrations.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/privacy" className="inline-flex items-center justify-center rounded-full bg-[#E0FE10] px-5 py-3 font-semibold text-black transition hover:bg-lime-300">
              Review privacy policy
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

        <section className="rounded-3xl border border-white/10 bg-black/20 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Questions or legal notices</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-300 sm:text-base">
            For questions about these Terms, legal notices, or company-level service issues for Fit With Pulse, PulseCheck,
            and related Pulse Intelligence Labs, Inc. services, contact{' '}
            <a className="text-[#E0FE10] underline underline-offset-4" href="mailto:tre@fitwithpulse.ai">
              tre@fitwithpulse.ai
            </a>{' '}
            or{' '}
            <a className="text-[#E0FE10] underline underline-offset-4" href="mailto:info@fitwithpulse.ai">
              info@fitwithpulse.ai
            </a>.
          </p>
        </section>
      </main>
    </div>
  );
};

export default TermsPage;
