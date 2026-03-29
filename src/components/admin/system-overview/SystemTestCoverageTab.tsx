import React from 'react';
import { BarChart3, CheckCircle2, Layers3, ShieldCheck, Target, TestTube2, Wrench } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

type CoverageArea = {
  area: string;
  current: number;
  target: number;
  scope: string;
  evidence: string[];
  note: string;
  tone: 'blue' | 'green' | 'amber' | 'purple' | 'red';
};

const COVERAGE_AREAS: CoverageArea[] = [
  {
    area: 'Playwright harness and admin web',
    current: 72,
    target: 94,
    scope: 'Auth capture, smoke routes, write-path cleanup, share-link flows, and the admin surfaces that already have a runnable browser harness.',
    evidence: ['`npm run test:e2e:auth`', '`npm run test:e2e:smoke`', 'share-link lifecycle', 'admin route regression'],
    note: 'This is the strongest area because the repo already has a durable browser harness and explicit write-path safety rules.',
    tone: 'green',
  },
  {
    area: 'PulseCheck runtime web flows',
    current: 60,
    target: 90,
    scope: 'Onboarding, workspace, protocol launch, signal-layer behavior, and the core day-to-day PulseCheck loops.',
    evidence: ['onboarding/workspace harness', 'protocol launch QA', 'state-signal docs', 'assignment lifecycle coverage'],
    note: 'The runtime lane has real Playwright and node-harness coverage now, but most of the breadth still lives in a small number of flows.',
    tone: 'blue',
  },
  {
    area: 'QuickLifts iOS',
    current: 44,
    target: 85,
    scope: 'Profile-health stories, shared-link surfaces, and the native app paths that need deterministic device validation.',
    evidence: ['profile-health docs', 'share-preview strategy', 'surface-level regression intent'],
    note: 'The handbook coverage is solid, but the native test layer is still narrower than the product surface.',
    tone: 'purple',
  },
  {
    area: 'PulseCheck iOS',
    current: 41,
    target: 85,
    scope: 'Mock-club launch, activation flow, onboarding, intro composer, and native identifier contracts.',
    evidence: ['XCUITest launch lane', 'club activation identifiers', 'mock-club fixture strategy'],
    note: 'There is a real deterministic launch model, but the native suite is still mostly smoke depth.',
    tone: 'amber',
  },
  {
    area: 'Pulse Android',
    current: 34,
    target: 80,
    scope: 'Compose instrumentation, dev-Firebase E2E, permission-heavy native flows, and cleanup-safe write paths.',
    evidence: ['Compose tags', 'debug test hooks', 'dev-Firebase contract', 'namespace cleanup policy'],
    note: 'This is the largest remaining gap area and the one most in need of broader end-to-end protection.',
    tone: 'red',
  },
  {
    area: 'Shared backend and data contracts',
    current: 58,
    target: 88,
    scope: 'Firestore-backed models, API routes, index contracts, and the data dependencies that power the client surfaces.',
    evidence: ['manifested data contracts', 'index registry', 'shared API services', 'firebase-admin runtime harness', 'backend dependency maps'],
    note: 'This moved up because the shared Firebase adapter and high-risk route contracts now have runnable runtime coverage, but the backend surface is still much larger than the exercised set.',
    tone: 'blue',
  },
  {
    area: 'Operational safety and release tooling',
    current: 60,
    target: 92,
    scope: 'Admin guards, local machine setup, release handoff, share-link security, and other operator-facing protections.',
    evidence: ['admin auth guard', 'local machine setup', 'share link auth', 'release-path controls'],
    note: 'Operational guardrails are well articulated, but the release-safety net still needs more automated proof.',
    tone: 'green',
  },
];

const COVERAGE_LENS_ROWS = [
  ['System-level harness completeness', 'Estimated from runnable smoke and regression paths that exercise the real system, not from compiler line metrics.'],
  ['What counts', 'A flow only counts when it can be exercised end to end with stable selectors, setup, assertions, and cleanup where needed.'],
  ['What does not count', 'Line coverage, docs-only specs, screenshots without execution, and unit tests that never cross a system boundary.'],
  ['Write-path rule', 'Mutating coverage only counts when the test proves cleanup, namespacing, or rollback behavior in the same harness.'],
  ['Audit posture', 'These percentages are a live handbook estimate as of March 29, 2026, not a CI-exported coverage report.'],
];

const METHOD_ROWS = [
  ['Step 1', 'Inventory the runnable harnesses and the major system areas they can actually reach.'],
  ['Step 2', 'Count only stable, repeatable paths that validate behavior across the system boundary.'],
  ['Step 3', 'Apply a penalty when a surface is mostly documented but still lacks a runnable regression lane.'],
  ['Step 4', 'Treat mutation paths as incomplete unless they prove cleanup and safe reuse of the namespace.'],
  ['Step 5', 'Revisit the estimate whenever a new harness, selector contract, or cleanup policy lands.'],
];

const getWeightedAverage = (areas: CoverageArea[]) => {
  const total = areas.reduce((sum, area) => sum + area.current, 0);
  return Math.round(total / areas.length);
};

const getTargetAverage = (areas: CoverageArea[]) => {
  const total = areas.reduce((sum, area) => sum + area.target, 0);
  return Math.round(total / areas.length);
};

const SystemCoverageTab: React.FC = () => {
  const averageCurrent = getWeightedAverage(COVERAGE_AREAS);
  const averageTarget = getTargetAverage(COVERAGE_AREAS);
  const areasAtTarget = COVERAGE_AREAS.filter((area) => area.current >= area.target).length;
  const areasBelow50 = COVERAGE_AREAS.filter((area) => area.current < 50).length;

  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Testing Coverage"
        title="System Coverage by Major Area"
        version="Audit estimate | March 29, 2026"
        summary="A system-level coverage view for the repo's major surfaces. These percentages describe harness completeness and end-to-end confidence, not line coverage or compiler metrics."
        highlights={[
          {
            title: 'Coverage Means Harness Completeness',
            body: 'Each percentage reflects how much of a major system area can be exercised by a real, repeatable harness with meaningful assertions.',
          },
          {
            title: 'Write Paths Only Count With Cleanup',
            body: 'Mutation-heavy coverage only counts when the test also proves namespacing, cleanup, or rollback behavior in the same run.',
          },
          {
            title: 'Docs Do Not Equal Coverage',
            body: 'Strong documentation is useful, but the score only moves when the repo can actually run the flow end to end.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Coverage governance artifact for estimating full-system test completeness across web, mobile, backend, and operational surfaces."
        sourceOfTruth="This page is the honest audit view for system-level test readiness. It should stay aligned with the real harness inventory, not with line coverage exports or aspirational specs."
        masterReference="Use this tab when deciding which system area needs the next real harness investment, which areas still rely on docs-only confidence, and where cleanup-safe write tests are missing."
        relatedDocs={['Playwright Testing Strategy', 'Android Testing Strategy', 'XCUITest Strategy', 'System Overview Manifest']}
      />

      <SectionBlock icon={BarChart3} title="Coverage Snapshot">
        <CardGrid columns="lg:grid-cols-4">
          <InfoCard
            title="Average completeness"
            accent="green"
            body={
              <div className="space-y-2">
                <p className="text-3xl font-semibold text-white">{averageCurrent}%</p>
                <p className="text-sm text-zinc-300">Estimated across the major system areas below.</p>
              </div>
            }
          />
          <InfoCard
            title="Average target"
            accent="blue"
            body={
              <div className="space-y-2">
                <p className="text-3xl font-semibold text-white">{averageTarget}%</p>
                <p className="text-sm text-zinc-300">The level we want each area to approach before calling it durable.</p>
              </div>
            }
          />
          <InfoCard
            title="Areas at target"
            accent="purple"
            body={
              <div className="space-y-2">
                <p className="text-3xl font-semibold text-white">{areasAtTarget}</p>
                <p className="text-sm text-zinc-300">This audit is still below target everywhere, which is the honest reading.</p>
              </div>
            }
          />
          <InfoCard
            title="Areas below 50%"
            accent="amber"
            body={
              <div className="space-y-2">
                <p className="text-3xl font-semibold text-white">{areasBelow50}</p>
                <p className="text-sm text-zinc-300">These are the surfaces most likely to fail a broad system regression pass.</p>
              </div>
            }
          />
        </CardGrid>

        <div className="space-y-3">
          {COVERAGE_AREAS.map((area) => {
            const targetLeft = Math.min(Math.max(area.target, 0), 100);
            return (
              <article key={area.area} className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{area.area}</p>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                        area.tone === 'green'
                          ? 'border-green-500/25 bg-green-500/10 text-green-200'
                          : area.tone === 'blue'
                            ? 'border-blue-500/25 bg-blue-500/10 text-blue-200'
                            : area.tone === 'purple'
                              ? 'border-purple-500/25 bg-purple-500/10 text-purple-200'
                              : area.tone === 'amber'
                                ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
                                : 'border-red-500/25 bg-red-500/10 text-red-200'
                      }`}>
                        {area.current >= area.target ? 'At target' : 'Below target'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">{area.scope}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-white">{area.current}%</p>
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Target {area.target}%</p>
                  </div>
                </div>

                <div className="mt-4 relative">
                  <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${
                        area.tone === 'green'
                          ? 'bg-gradient-to-r from-emerald-400 via-green-400 to-cyan-400'
                          : area.tone === 'blue'
                            ? 'bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-400'
                            : area.tone === 'purple'
                              ? 'bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400'
                              : area.tone === 'amber'
                                ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400'
                                : 'bg-gradient-to-r from-rose-400 via-red-400 to-orange-400'
                      }`}
                      style={{ width: `${area.current}%` }}
                    />
                  </div>
                  <div
                    className="pointer-events-none absolute top-[-2px] h-4 w-px bg-white/70"
                    style={{ left: `${targetLeft}%` }}
                    aria-hidden="true"
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                  <span>{area.note}</span>
                  <span className="text-zinc-400">
                    {area.current >= area.target ? 'Target met' : `${area.target - area.current}% to target`}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </SectionBlock>

      <SectionBlock icon={Layers3} title="Area Breakdown">
        <DataTable
          columns={['Major system area', 'Current', 'Target', 'What counts as coverage', 'Audit note']}
          rows={COVERAGE_AREAS.map((area) => [
            area.area,
            `${area.current}%`,
            `${area.target}%`,
            <div key={`${area.area}-evidence`} className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {area.evidence.map((item) => (
                  <span key={item} className="inline-flex rounded-full border border-zinc-700 bg-black/20 px-2 py-0.5 text-[11px] text-zinc-300">
                    {item}
                  </span>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-zinc-500">{area.scope}</p>
            </div>,
            area.note,
          ])}
        />
      </SectionBlock>

      <SectionBlock icon={CheckCircle2} title="Coverage Lens">
        <DataTable columns={['Rule', 'Interpretation']} rows={COVERAGE_LENS_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="What counts toward the score"
            accent="green"
            body={<BulletList items={[
              'A real harness must be able to reach the surface, not just describe it.',
              'The flow should assert something system-relevant, such as setup, state transition, or failure handling.',
              'If the test mutates data, cleanup or namespace safety has to be proven in the same lane.',
              'A surface only gets full credit when the confidence is repeatable, not just possible in theory.',
            ]} />}
          />
          <InfoCard
            title="What stays out of the score"
            accent="amber"
            body={<BulletList items={[
              'Compiler line coverage and unit-test counts.',
              'Documentation pages, architectural prose, and diagram-only confidence.',
              'Screenshots without a repeatable execution path.',
              'Manual checks that are useful but not yet tied to a durable harness.',
            ]} />}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Wrench} title="Methodology Note">
        <DataTable columns={['Step', 'Method']} rows={METHOD_ROWS} />
        <InfoCard
          title="How to read the estimate"
          accent="blue"
          body="The percentages are intentionally conservative. They reward real execution paths, stable selector contracts, and cleanup-safe write coverage. They do not pretend that a well-written spec or a broad unit-test suite is the same thing as end-to-end system protection."
        />
      </SectionBlock>

      <SectionBlock icon={TestTube2} title="Practical Takeaway">
        <InfoCard
          title="Next investment order"
          accent="red"
          body={<BulletList items={[
            'Expand the lowest native surfaces first, especially Pulse Android and PulseCheck iOS.',
            'Keep the Playwright admin harness broad enough to protect the web system surfaces that already have real browser coverage.',
            'Only raise a percentage when the harness can actually exercise the behavior, not when the doc page looks complete.',
          ]} />}
        />
      </SectionBlock>
    </div>
  );
};

export default SystemCoverageTab;
