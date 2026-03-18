import React from 'react';
import { AlertTriangle, Brain, Database, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const LEGAL_SCREEN_ROWS = [
  ['35 U.S.C. 101', 'Subject matter eligibility', 'Must fit a statutory category and avoid a judicial exception unless integrated into a practical application.', 'Utility claims can be eligible if framed as a technical improvement.'],
  ['35 U.S.C. 102', 'Novelty', 'The claimed invention must be new over prior art.', 'Needs a real prior-art search before filing.'],
  ['35 U.S.C. 103', 'Non-obviousness', 'The claimed invention cannot be an obvious combination to a skilled practitioner.', 'This is the biggest risk for software/system claims.'],
  ['35 U.S.C. 112', 'Disclosure / enablement', 'Claims must be supported and enabled by the specification.', 'The docs need enough detail to support the claims we actually want.'],
];

const STATUS_LEGEND_CARDS = [
  {
    title: 'Strong Candidate',
    accent: 'green' as const,
    body: 'Likely worth counsel time because it looks like a concrete technical improvement and not just a business rule.',
  },
  {
    title: 'Possible Candidate',
    accent: 'blue' as const,
    body: 'Could be patentable if the claims are narrowed to a specific technical mechanism and the prior art search comes back clean enough.',
  },
  {
    title: 'Weak Candidate',
    accent: 'amber' as const,
    body: 'May be eligible in theory, but the novelty or obviousness bar looks hard and the filing may not be worth the cost.',
  },
  {
    title: 'Not a Patent Target',
    accent: 'red' as const,
    body: 'Business strategy, admin governance, and routine operations are usually better handled as product/process docs, not patents.',
  },
];

const PATENT_TARGET_ROWS = [
  ['Provenance-aware source-record normalization', 'Strong candidate', 'Technical data processing', 'Possible utility patent', 'This is the cleanest technical story if we claim a specific data-normalization improvement across health sources.'],
  ['Freshness-aware snapshot assembler', 'Strong candidate', 'Technical data processing', 'Possible utility patent', 'Most promising if the claim focuses on recency evaluation, source precedence, and snapshot recompute behavior.'],
  ['Canonical AthleteHealthContextSnapshot', 'Possible candidate', 'Data structure / system contract', 'Utility patent or trade secret', 'Could be patentable if framed as a technical data structure that improves downstream processing.'],
  ['HealthChat readiness resolver', 'Possible candidate', 'Runtime gating / reliability improvement', 'Utility patent', 'Better if the claim emphasizes reducing unsafe or misleading responses from stale or missing data.'],
  ['Connector lifecycle orchestration', 'Weak candidate', 'Operational workflow', 'Usually not worth filing', 'This looks closer to standard integration plumbing unless there is a very specific technical mechanism.'],
  ['Device partnership matrix', 'Not a patent target', 'Business strategy', 'None', 'This is alliance planning, not invention.'],
  ['Firestore index registry', 'Not a patent target', 'Administrative governance', 'None', 'Useful for operations, but not a patentable invention.'],
  ['Nora assignment rules', 'Weak candidate', 'Decision policy', 'Usually not worth filing', 'Likely too close to abstract rule-setting unless tied to a new technical runtime.'],
  ['Vision Pro immersive surfaces', 'Possible design patent candidate', 'Ornamental UI / environment', 'Design patent', 'If the visuals are novel and ornamental, design protection may be more realistic than a utility patent.'],
];

const PATENT_CRITERIA_ROWS = [
  ['Utility', 'High', 'These system docs describe a real software product with practical use.', 'This is not the problem.'],
  ['Subject matter eligibility', 'Medium', 'Pure business logic is weak; technical data-processing improvements are stronger.', 'Best chance lies in source normalization, freshness, and runtime reliability.'],
  ['Novelty', 'Unknown', 'We need prior-art search and claim scoping.', 'Some pieces may be novel in combination, but that must be proven.'],
  ['Non-obviousness', 'Medium', 'Combining wearables, context snapshots, and freshness gates may be obvious unless the implementation is specific and technical.', 'This is the main filing risk.'],
  ['Enablement / written description', 'High if documented', 'Our handbook already gives a strong architecture base.', 'A patent draft would still need tighter claim-ready detail.'],
];

const POTENTIAL_CLAIM_AREAS = [
  {
    title: 'Context Assembly Engine',
    accent: 'green' as const,
    body: <BulletList items={['Merging multiple health sources into one canonical athlete-context snapshot.', 'Using provenance and freshness to pick source winners.', 'This is the strongest technical story in the system.']} />,
  },
  {
    title: 'Honest Health-Chat Gating',
    accent: 'blue' as const,
    body: <BulletList items={['Resolving ready / stale / no-data / no-permission states before chat answers.', 'Preventing misleading responses by routing to fallback behavior.', 'Potentially eligible if framed as a runtime reliability improvement.']} />,
  },
  {
    title: 'Design Surface Protection',
    accent: 'amber' as const,
    body: <BulletList items={['Immersive Vision Pro layouts.', 'Branded share cards and ornamental HUD arrangements.', 'This is more likely a design-patent path than a utility patent path.']} />,
  },
];

const EVALUATION_STEPS = [
  {
    title: 'Define the claim boundary',
    body: 'Separate the technical mechanism from the business policy and from the user-facing copy.',
    owner: 'Product + counsel',
  },
  {
    title: 'Run a prior-art search',
    body: 'Look for similar health-context assembly, freshness gating, and wearable normalization systems before spending on filing.',
    owner: 'Counsel + technical lead',
  },
  {
    title: 'Score 101 / 102 / 103 / 112',
    body: 'Check subject matter eligibility, novelty, non-obviousness, and disclosure support independently.',
    owner: 'Counsel',
  },
  {
    title: 'Pick the right protection type',
    body: 'Utility patent for technical mechanisms, design patent for ornamental surfaces, or trade secret when the value is mostly operational.',
    owner: 'Leadership',
  },
  {
    title: 'File only the strongest slice',
    body: 'Avoid broad, abstract claims. Focus on the narrow technical improvement with the best chance of grantability.',
    owner: 'Filing strategy',
  },
];

const RISKS_ROWS = [
  ['Abstract-idea risk', 'Software/business rules can be rejected under 101 if the claim is too broad.', 'Claim a concrete technical improvement, not a generic coaching policy.'],
  ['Obviousness risk', 'Combining known wearables and health logic may be seen as routine.', 'Focus on the exact data structure and runtime behavior, not the concept alone.'],
  ['Disclosure risk', 'A broad idea without enough implementation detail can fail under 112.', 'Document the mechanism deeply before filing.'],
  ['Over-filing risk', 'Patents cost time and money, and weak claims can distract the team.', 'Only file where the business upside justifies the effort.'],
];

const ROADMAP_ROWS = [
  ['Phase 1', 'Tag the strongest technical inventions and the likely design-patent surfaces.', 'Prevents mixing business strategy with actual invention candidates.'],
  ['Phase 2', 'Have patent counsel run a prior-art and claim-scope screen.', 'Needed before any filing decision.'],
  ['Phase 3', 'Draft provisional or non-provisional claims for the best utility candidates.', 'Focus on the technical data pipeline first.'],
  ['Phase 4', 'Consider design patents for ornamental UI or immersive surfaces.', 'This is the most plausible protection for visual work.'],
  ['Phase 5', 'Keep weak areas as trade secrets or product docs instead of forcing patent filings.', 'Better to avoid thin filings than to overclaim.'],
];

const PulseCheckPatentEligibilityAuditTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck IP Screening"
        title="Patent Eligibility Audit"
        version="Version 0.1 | March 17, 2026"
        summary="Screening audit for which parts of the Pulse system may be worth patent counsel time. This is not legal advice. It is a product-level read on where the most defensible utility-patent or design-patent opportunities might exist based on novelty, non-obviousness, subject matter eligibility, and disclosure readiness."
        highlights={[
          {
            title: 'Strongest Technical Angle',
            body: 'The provenance-aware health-context assembly pipeline is the most credible utility-patent candidate because it is a concrete data-processing improvement.',
          },
          {
            title: 'Design Patents May Fit Better',
            body: 'Ornamental immersive surfaces and branded visual systems may be better protected as design patents than utility patents.',
          },
          {
            title: 'Business Rules Are Weak Targets',
            body: 'Partnership strategy, admin governance, and routine orchestration are usually better handled as product docs or trade secrets, not patents.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Internal screening artifact for deciding where patent counsel should focus and which system areas are likely better protected by utility patents, design patents, or no patent filing at all."
        sourceOfTruth="Use current USPTO guidance on subject matter eligibility plus the statutory patentability requirements under 35 U.S.C. 101, 102, 103, and 112. This is a screening pass, not a legal opinion."
        masterReference="Read this page as an internal triage guide before talking to counsel or drafting claims."
        relatedDocs={[
          'Health Context Architecture',
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
          'Health Context Snapshot Assembler Spec',
          'Device Integration Strategy',
          'Device Integration Partnership Matrix',
        ]}
      />

      <SectionBlock icon={ShieldCheck} title="Patentability Screen">
        <DataTable columns={['Criterion', 'Screening Status', 'What USPTO Looks At', 'What It Means Here']} rows={LEGAL_SCREEN_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Brain} title="Status Legend">
        <CardGrid columns="md:grid-cols-2">
          {STATUS_LEGEND_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Potential Patent Targets">
        <DataTable columns={['System Area', 'Screening Status', 'Claim Theme', 'Best Protection Type', 'Notes']} rows={PATENT_TARGET_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Brain} title="Most Promising Claim Areas">
        <CardGrid columns="md:grid-cols-3">
          {POTENTIAL_CLAIM_AREAS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Risks And Constraints">
        <DataTable columns={['Risk', 'Impact', 'Mitigation']} rows={RISKS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Evaluation Workflow">
        <DataTable columns={['Phase', 'Action', 'Why']} rows={ROADMAP_ROWS} />
        <StepRail steps={EVALUATION_STEPS} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckPatentEligibilityAuditTab;
