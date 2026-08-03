import type { GetStaticProps, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import React, { useState } from 'react';
import {
  BrainCircuit,
  Building2,
  ChevronDown,
  HeartHandshake,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type OrgPerson = {
  role: string;
  base: string;
  target: string;
  reports?: OrgPerson[];
};

type Division = {
  id: string;
  shortName: string;
  name: string;
  headcount: number;
  basePayroll: string;
  targetCash: string;
  accent: string;
  accentSoft: string;
  icon: LucideIcon;
  leader: OrgPerson;
};

type PlannedOrgPageProps = {
  ogMeta?: {
    title: string;
    description: string;
    image: string;
    url: string;
    type: string;
    siteName: string;
  };
};

const divisions: Division[] = [
  {
    id: 'operations',
    shortName: 'Operations',
    name: 'Operations, Finance, People & Risk',
    headcount: 6,
    basePayroll: '$945K',
    targetCash: '$1.087M',
    accent: '#E0FE10',
    accentSoft: 'rgba(224, 254, 16, 0.10)',
    icon: ShieldCheck,
    leader: {
      role: 'Chief Operating Officer',
      base: '$230K',
      target: '$276K',
      reports: [
        {
          role: 'Director, Finance & Business Operations',
          base: '$165K',
          target: '$190K',
          reports: [
            {
              role: 'Senior Accountant & FP&A Manager',
              base: '$120K',
              target: '$132K',
            },
          ],
        },
        { role: 'Head of People & Talent', base: '$155K', target: '$178K' },
        { role: 'Privacy, Risk & Compliance Lead', base: '$165K', target: '$190K' },
        { role: 'Executive Operations Manager', base: '$110K', target: '$121K' },
      ],
    },
  },
  {
    id: 'product',
    shortName: 'Product',
    name: 'Product & Technology',
    headcount: 6,
    basePayroll: '$1.020M',
    targetCash: '$1.147M',
    accent: '#60A5FA',
    accentSoft: 'rgba(96, 165, 250, 0.10)',
    icon: BrainCircuit,
    leader: {
      role: 'Chief Product Officer',
      base: '$230K',
      target: '$276K',
      reports: [
        { role: 'Development Product Manager', base: '$155K', target: '$171K' },
        {
          role: 'Senior Full-Stack Developer & Technical Lead',
          base: '$185K',
          target: '$204K',
          reports: [
            { role: 'Senior Full-Stack Developer', base: '$175K', target: '$193K' },
          ],
        },
        { role: 'Senior Data Analyst, Product & Impact', base: '$140K', target: '$154K' },
        { role: 'Senior Data Analyst, Institutional Insights', base: '$135K', target: '$149K' },
      ],
    },
  },
  {
    id: 'science',
    shortName: 'Science',
    name: 'Science, Research & Impact',
    headcount: 5,
    basePayroll: '$865K',
    targetCash: '$1.000M',
    accent: '#C084FC',
    accentSoft: 'rgba(192, 132, 252, 0.10)',
    icon: Sparkles,
    leader: {
      role: 'Chief Science & Impact Officer',
      base: '$220K',
      target: '$264K',
      reports: [
        {
          role: 'Director, Research, Measurement & Psychometrics',
          base: '$180K',
          target: '$207K',
        },
        {
          role: 'Director, Mental Performance',
          base: '$165K',
          target: '$190K',
          reports: [
            {
              role: 'Learning Experience & Curriculum Designer',
              base: '$125K',
              target: '$138K',
            },
          ],
        },
        {
          role: 'Director, Clinical Safety, Licensed Psychologist',
          base: '$175K',
          target: '$201K',
        },
      ],
    },
  },
  {
    id: 'university',
    shortName: 'University',
    name: 'University Partnerships & Success',
    headcount: 5,
    basePayroll: '$720K',
    targetCash: '$903K',
    accent: '#FBBF24',
    accentSoft: 'rgba(251, 191, 36, 0.10)',
    icon: Building2,
    leader: {
      role: 'Head of University Sales',
      base: '$180K',
      target: '$300K',
      reports: [
        {
          role: 'Director, University Success',
          base: '$160K',
          target: '$184K',
          reports: [
            { role: 'Enterprise Customer Success Manager I', base: '$125K', target: '$138K' },
            { role: 'Enterprise Customer Success Manager II', base: '$125K', target: '$138K' },
            { role: 'University Implementation Manager', base: '$130K', target: '$143K' },
          ],
        },
      ],
    },
  },
  {
    id: 'youth',
    shortName: 'Youth & family',
    name: 'Youth & Family',
    headcount: 6,
    basePayroll: '$815K',
    targetCash: '$990K',
    accent: '#22D3EE',
    accentSoft: 'rgba(34, 211, 238, 0.10)',
    icon: HeartHandshake,
    leader: {
      role: 'Head of Youth & Family Partnerships',
      base: '$160K',
      target: '$216K',
      reports: [
        { role: 'Youth Partnership Manager', base: '$120K', target: '$156K' },
        {
          role: 'Director, Family Growth & Community',
          base: '$160K',
          target: '$192K',
          reports: [
            {
              role: 'Lifecycle & Community Marketing Manager',
              base: '$120K',
              target: '$138K',
            },
          ],
        },
        {
          role: 'Director, Youth Success',
          base: '$145K',
          target: '$167K',
          reports: [
            { role: 'Youth Customer Success Manager', base: '$110K', target: '$121K' },
          ],
        },
      ],
    },
  },
  {
    id: 'brand',
    shortName: 'Brand',
    name: 'Brand & Category',
    headcount: 4,
    basePayroll: '$590K',
    targetCash: '$683K',
    accent: '#FB7185',
    accentSoft: 'rgba(251, 113, 133, 0.10)',
    icon: Megaphone,
    leader: {
      role: 'VP, Brand & Category',
      base: '$180K',
      target: '$216K',
      reports: [
        {
          role: 'Editorial & Content Director',
          base: '$145K',
          target: '$167K',
          reports: [
            { role: 'Senior Multimedia Producer', base: '$115K', target: '$127K' },
          ],
        },
        { role: 'Director, Communications & Events', base: '$150K', target: '$173K' },
      ],
    },
  },
];

const specialistAreas = [
  'Product design and accessibility',
  'Security and cloud review',
  'Research ethics and IRB support',
  'Youth safeguarding',
  'Legal and privacy counsel',
  'First-line consumer support',
];

const PersonNode: React.FC<{
  person: OrgPerson;
  division: Division;
  leader?: boolean;
}> = ({ person, division, leader = false }) => (
  <div className="org-person-branch">
    <article
      className={`org-person ${leader ? 'org-person-leader' : ''}`}
      style={{
        borderColor: leader ? division.accent : 'rgba(255, 255, 255, 0.12)',
        background: leader ? division.accentSoft : 'rgba(9, 9, 11, 0.72)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className={`${leader ? 'text-xl md:text-2xl' : 'text-base md:text-lg'} font-semibold leading-snug text-white`}>
            {person.role}
          </h3>
          <p className="mt-2 text-sm text-zinc-400">
            {person.base} base <span aria-hidden="true">·</span> {person.target} target cash
          </p>
        </div>
        {leader && (
          <span
            className="mt-1 h-3 w-3 flex-none rounded-full shadow-[0_0_24px_currentColor]"
            style={{ color: division.accent, backgroundColor: division.accent }}
            aria-hidden="true"
          />
        )}
      </div>
    </article>

    {person.reports && person.reports.length > 0 && (
      <div className="org-reports" style={{ '--org-accent': division.accent } as React.CSSProperties}>
        {person.reports.map((report) => (
          <PersonNode key={report.role} person={report} division={division} />
        ))}
      </div>
    )}
  </div>
);

const PlannedOrgPage: NextPage<PlannedOrgPageProps> = () => {
  const [selectedId, setSelectedId] = useState(divisions[0].id);
  const selectedDivision = divisions.find((division) => division.id === selectedId) || divisions[0];

  return (
    <>
      <Head>
        <title>Planned Organization | Pulse Intelligence Labs</title>
        <meta
          name="description"
          content="The planned 33-person organization designed to operate Pulse Intelligence Labs as a healthy $20 million ecosystem."
        />
        <meta name="theme-color" content="#09090B" />
      </Head>

      <main className="min-h-screen overflow-hidden bg-[#09090B] text-white">
        <div className="pointer-events-none fixed inset-0" aria-hidden="true">
          <div className="absolute left-[-12rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-[#E0FE10]/[0.06] blur-3xl" />
          <div className="absolute right-[-10rem] top-[22rem] h-[26rem] w-[26rem] rounded-full bg-purple-500/[0.06] blur-3xl" />
        </div>

        <header className="relative z-20 border-b border-white/10 bg-[#09090B]/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
            <Link href="/PIL" className="flex items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E0FE10]">
              <img src="/pulse-logo.svg" alt="" className="h-8 w-auto" />
              <span className="text-sm font-semibold tracking-wide text-white">Pulse Intelligence Labs</span>
            </Link>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
              Future operating model
            </span>
          </div>
        </header>

        <section className="relative z-10 mx-auto max-w-7xl px-5 pb-12 pt-14 md:px-8 md:pb-16 md:pt-20">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#E0FE10]">Planned organization</p>
            <h1 className="mt-5 text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl md:text-7xl">
              The team built for the $20M Pulse ecosystem.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300 md:text-xl">
              Thirty-three exceptional people own the product, evidence, relationships, safety, and brand. AI,
              automation, and specialized partners give this team the reach of a much larger company.
            </p>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Total team', '33 people'],
              ['Base payroll', '$5.18M'],
              ['Target cash', '$6.035M'],
              ['Share of revenue', '30.2%'],
            ].map(([label, value]) => (
              <div key={label} className="bg-[#111113] px-6 py-5">
                <p className="text-sm text-zinc-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative z-10 border-y border-white/10 bg-white/[0.025]">
          <div className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
            <div className="mx-auto max-w-xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Governance and category guidance</p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">Board of Directors and Expert Council</p>
              <div className="mx-auto my-5 h-10 w-px bg-gradient-to-b from-zinc-700 to-[#E0FE10]" aria-hidden="true" />
              <article className="rounded-3xl border border-[#E0FE10]/50 bg-[#E0FE10]/[0.07] p-7 shadow-[0_0_50px_rgba(224,254,16,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E0FE10]">Company leader</p>
                <h2 className="mt-3 text-2xl font-semibold text-white md:text-3xl">Founder &amp; CEO</h2>
                <p className="mt-2 text-sm text-zinc-400">$225K base <span aria-hidden="true">·</span> $225K target cash</p>
              </article>
              <div className="mx-auto h-10 w-px bg-white/20" aria-hidden="true" />
              <ChevronDown className="mx-auto h-5 w-5 text-zinc-600" aria-hidden="true" />
            </div>

            <div className="mt-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Executive team</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">Choose a division</h2>
                </div>
                <p className="hidden text-sm text-zinc-500 md:block">Each division leader reports to the Founder &amp; CEO.</p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="tablist" aria-label="Company divisions">
                {divisions.map((division) => {
                  const Icon = division.icon;
                  const selected = division.id === selectedDivision.id;
                  return (
                    <button
                      key={division.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls="division-panel"
                      id={`division-tab-${division.id}`}
                      onClick={() => setSelectedId(division.id)}
                      className="group rounded-2xl border p-5 text-left transition duration-200 focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-[#09090B]"
                      style={{
                        borderColor: selected ? division.accent : 'rgba(255, 255, 255, 0.10)',
                        background: selected ? division.accentSoft : 'rgba(255, 255, 255, 0.025)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-xl border"
                          style={{ color: division.accent, borderColor: `${division.accent}55`, background: division.accentSoft }}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400">
                          {division.headcount} people
                        </span>
                      </div>
                      <p className="mt-4 text-lg font-semibold text-white">{division.name}</p>
                      <p className="mt-2 text-sm text-zinc-500">{division.leader.role}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section
          id="division-panel"
          role="tabpanel"
          aria-labelledby={`division-tab-${selectedDivision.id}`}
          className="relative z-10 mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20"
        >
          <div className="flex flex-col gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: selectedDivision.accent }}>
                Reporting structure
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-5xl">{selectedDivision.name}</h2>
            </div>
            <dl className="grid grid-cols-3 gap-4 sm:gap-8">
              <div>
                <dt className="text-xs text-zinc-500">People</dt>
                <dd className="mt-1 text-lg font-semibold text-white">{selectedDivision.headcount}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Base</dt>
                <dd className="mt-1 text-lg font-semibold text-white">{selectedDivision.basePayroll}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Target</dt>
                <dd className="mt-1 text-lg font-semibold text-white">{selectedDivision.targetCash}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-10">
            <PersonNode person={selectedDivision.leader} division={selectedDivision} leader />
          </div>
        </section>

        <section className="relative z-10 border-t border-white/10 bg-[#0D0D0F]">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E0FE10]/30 bg-[#E0FE10]/[0.08] text-[#E0FE10]">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">Lean by design.</h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-zinc-400">
                Pulse retains ownership of its product, intellectual property, evidence, customer relationships,
                safety, and brand. A specialist bench adds depth when the work calls for focused expertise.
              </p>
              <p className="mt-5 text-sm font-medium text-zinc-300">Planned outside specialist budget: $500K to $900K annually.</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2" aria-label="Outside specialist areas">
              {specialistAreas.map((area) => (
                <li key={area} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-4 text-sm text-zinc-300">
                  <span className="h-2 w-2 flex-none rounded-full bg-[#E0FE10]" aria-hidden="true" />
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="relative z-10 border-t border-white/10 px-5 py-8 text-center text-xs text-zinc-600">
          Compensation reflects planned annual base salary and target cash compensation. Equity is excluded.
        </footer>

        <style jsx global>{`
          .org-person-branch {
            min-width: 0;
          }

          .org-person {
            position: relative;
            min-height: 118px;
            border-width: 1px;
            border-radius: 1rem;
            padding: 1.25rem;
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
          }

          .org-person-leader {
            width: min(100%, 520px);
            min-height: auto;
            margin: 0 auto;
            padding: 1.5rem;
            box-shadow: 0 18px 60px rgba(0, 0, 0, 0.24);
          }

          .org-reports {
            position: relative;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(min(230px, 100%), 1fr));
            gap: 1.25rem;
            margin-top: 3rem;
            padding-top: 1.5rem;
            border-top: 1px solid rgba(255, 255, 255, 0.14);
          }

          .org-reports::before {
            content: '';
            position: absolute;
            left: 50%;
            top: -3rem;
            height: 3rem;
            border-left: 1px solid rgba(255, 255, 255, 0.18);
          }

          .org-reports > .org-person-branch::before {
            content: '';
            display: block;
            width: 1px;
            height: 1.5rem;
            margin: -1.5rem auto 0;
            background: color-mix(in srgb, var(--org-accent) 55%, rgba(255, 255, 255, 0.15));
          }

          .org-reports .org-reports {
            grid-template-columns: 1fr;
            margin-top: 1.5rem;
            padding-top: 1rem;
          }

          .org-reports .org-reports::before {
            top: -1.5rem;
            height: 1.5rem;
          }

          .org-reports .org-reports > .org-person-branch::before {
            height: 1rem;
            margin-top: -1rem;
          }

          @media (max-width: 640px) {
            .org-reports {
              display: block;
              margin-left: 0.75rem;
              margin-top: 1.5rem;
              padding-left: 1rem;
              padding-top: 0;
              border-left: 1px solid rgba(255, 255, 255, 0.16);
              border-top: 0;
            }

            .org-reports::before,
            .org-reports > .org-person-branch::before {
              display: none;
            }

            .org-reports > .org-person-branch {
              position: relative;
              margin-top: 1rem;
            }

            .org-reports > .org-person-branch::after {
              content: '';
              position: absolute;
              left: -1rem;
              top: 1.5rem;
              width: 1rem;
              border-top: 1px solid rgba(255, 255, 255, 0.16);
            }

            .org-reports .org-reports {
              margin-left: 0.75rem;
              margin-top: 1rem;
              padding-left: 1rem;
            }

            .org-person {
              min-height: auto;
            }
          }
        `}</style>
      </main>
    </>
  );
};

export const getStaticProps: GetStaticProps<PlannedOrgPageProps> = async () => ({
  props: {
    ogMeta: {
      title: 'The Planned $20M Organization | Pulse Intelligence Labs',
      description: 'The 33-person operating model designed to build the Pulse mental-performance ecosystem.',
      image: 'https://pulseintelligencelabs.com/planned-org-og.png',
      url: 'https://pulseintelligencelabs.com/planned-org',
      type: 'website',
      siteName: 'Pulse Intelligence Labs',
    },
  },
});

export default PlannedOrgPage;
