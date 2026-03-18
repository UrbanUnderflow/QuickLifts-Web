import React from 'react';
import { Database, Layers, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const PARTNERSHIP_SHAPE_CARDS = [
  {
    title: 'Data Access Partner',
    accent: 'blue' as const,
    body: <BulletList items={['Best for Garmin, Polar, Oura, WHOOP, COROS, and Fitbit.', 'Goal is structured athlete data with stable scopes or approved partner APIs.', 'Scale effect: more complete context and less dependence on one source.']} />,
  },
  {
    title: 'Platform Compatibility Partner',
    accent: 'green' as const,
    body: <BulletList items={['Best for Apple HealthKit and Samsung Health / Health Connect.', 'Goal is OS-level permissioned aggregation rather than device-specific contracts.', 'Scale effect: faster adoption across mobile ecosystems.']} />,
  },
  {
    title: 'Enterprise Alliance Partner',
    accent: 'amber' as const,
    body: <BulletList items={['Best for Catapult and similar team-performance systems.', 'Goal is distribution through clubs, colleges, and pro organizations.', 'Scale effect: higher ACV and stronger organizational stickiness.']} />,
  },
];

const PARTNER_MATRIX_ROWS = [
  ['Garmin', 'Data access + co-marketing', 'Training load, sleep, activity, and broad consumer trust', 'Broad athlete reach and strong brand credibility', 'Tier 1'],
  ['Oura', 'Premium recovery partnership', 'Readiness, sleep, HRV, and recovery context', 'High-intent premium audience and retention', 'Tier 1'],
  ['Withings', 'Clinical / wellness / research alliance', 'Body composition, weight, BP, and recovery-adjacent biometrics', 'Health credibility and adjacent B2B / RPM opportunities', 'Tier 1'],
  ['Samsung Health / Health Connect', 'Platform compatibility partnership', 'Android-side health aggregation and wearable mirror path', 'Android scale and platform coverage', 'Tier 1'],
  ['Catapult', 'Enterprise distribution partnership', 'Team workload, session, and athlete-performance feeds', 'Team, college, and pro channel expansion', 'Tier 1'],
  ['Polar', 'Data access partner', 'Training, HR, sleep, and sports-data pedigree', 'Sports credibility and clean structured data', 'Tier 2'],
  ['WHOOP', 'Recovery-oriented alliance', 'Recovery, strain, sleep, and coaching-adjacent audience', 'Premium recovery segment and high engagement', 'Tier 2'],
  ['COROS', 'Endurance partner', 'Workouts, activity, and endurance-athlete context', 'Niche but strong endurance credibility', 'Tier 2'],
  ['Fitbit', 'Consumer scale partnership', 'Activity, sleep, and heart-rate coverage', 'Mass-market reach and familiar consumer onboarding', 'Tier 2'],
  ['Nike', 'Brand / community partnership', 'Mostly bridgeable fitness context rather than a strong data API', 'Brand halo and consumer attention, but weak data depth', 'Bridge only'],
];

const SCALE_OUTCOME_ROWS = [
  ['Distribution scale', 'Partner channels and ecosystem placements can lower CAC and expand reach beyond direct acquisition.'],
  ['Context scale', 'More connected sources produce better athlete context and fewer blind spots in coaching.'],
  ['Retention scale', 'A more complete athlete story increases habit formation and reduces churn.'],
  ['Enterprise scale', 'Catapult-style alliances can create higher-value team and organization deals.'],
  ['Trust scale', 'Partnerships with recognizable health brands can increase user confidence in the product.'],
];

const GO_TO_MARKET_ROWS = [
  ['1', 'Win the platform bridges first', 'Keep Apple HealthKit and Samsung Health / Health Connect as base compatibility layers.'],
  ['2', 'Secure direct premium consumer data partners', 'Prioritize Garmin, Oura, Withings, and Polar for rich athlete context.'],
  ['3', 'Open the enterprise lane', 'Use Catapult and similar systems to reach teams, schools, and performance staff.'],
  ['4', 'Expand into broader consumer channels', 'Use Fitbit and COROS to widen coverage after the core lanes are solid.'],
  ['5', 'Treat brand-only ecosystems carefully', 'Use Nike for halo and marketing alignment, not as a core source of technical truth.'],
];

const RISKS_ROWS = [
  ['No stable API', 'Some vendors require partner approval or can change access rules.', 'Favor vendors with published developer programs and formal partner docs.'],
  ['Mirror gaps', 'Platform bridges do not always expose vendor-native detail.', 'Keep direct APIs primary where richness matters.'],
  ['Consent fatigue', 'Too many integrations can reduce opt-in rates.', 'Sequence partners and request minimum useful scopes.'],
  ['Duplicate sources', 'The same activity can arrive from multiple devices.', 'Use canonical source precedence and provenance.'],
  ['Operational burden', 'Each integration adds sync, QA, and support surface area.', 'Invest in a shared connector framework rather than one-off code.'],
];

const ROADMAP_ROWS = [
  ['Phase 1', 'Lock the taxonomy and partner scoring rubric.', 'Prevents arbitrary device decisions later.'],
  ['Phase 2', 'Pursue Garmin, Oura, Withings, and Samsung Health / Health Connect.', 'Best balance of technical value and scale.'],
  ['Phase 3', 'Add Polar, WHOOP, COROS, and Fitbit.', 'Widens the athlete base and recovery coverage.'],
  ['Phase 4', 'Pursue Catapult as a separate enterprise motion.', 'Highest-value team and performance alliance.'],
  ['Phase 5', 'Use Nike as a brand/community partnership only if it creates real distribution.', 'Avoid overbuilding around weak technical access.'],
];

const PulseCheckDeviceIntegrationPartnershipMatrixTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Health Context"
        title="Device Integration Partnership Matrix"
        version="Version 0.1 | March 17, 2026"
        summary="Strategic matrix for deciding which device, platform, and enterprise partners PulseCheck should pursue, what shape those relationships should take, and how each one contributes to scale. The goal is to align technical integration quality with distribution, trust, and alliance value."
        highlights={[
          {
            title: 'Partnerships Must Scale',
            body: 'A good integration is not only about data depth. It should also improve reach, trust, retention, or enterprise distribution.',
          },
          {
            title: 'One Canonical Pipeline',
            body: 'Every partner should ultimately feed the same normalized athlete-context pipeline so the product does not fragment by vendor.',
          },
          {
            title: 'Bridge vs Native Matters',
            body: 'Platform compatibility is useful, but native partner data should win when we need richness, control, or stability.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Partnership planning artifact for devices, platforms, and performance systems that can expand PulseCheck context and distribution."
        sourceOfTruth="Use this page to evaluate strategic fit, alliance shape, and scale upside before committing engineering time or partnership outreach."
        masterReference="This matrix should be read alongside the device integration strategy and health-context pipeline docs so business strategy and data architecture stay aligned."
        relatedDocs={[
          'Device Integration Strategy',
          'Health Context Architecture',
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
          'Oura Integration Strategy',
        ]}
      />

      <SectionBlock icon={Layers} title="Partnership Shapes">
        <CardGrid columns="md:grid-cols-3">
          {PARTNERSHIP_SHAPE_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Partner Matrix">
        <DataTable columns={['Partner', 'Best Partnership Shape', 'What We Gain', 'Scale Benefit', 'Priority']} rows={PARTNER_MATRIX_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Scale Outcomes">
        <DataTable columns={['Scale Lever', 'Why It Matters']} rows={SCALE_OUTCOME_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Go-To-Market Sequencing">
        <DataTable columns={['Step', 'Focus', 'Reason']} rows={GO_TO_MARKET_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Risks And Constraints">
        <DataTable columns={['Risk', 'Impact', 'Mitigation']} rows={RISKS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Recommended Rollout">
        <DataTable columns={['Phase', 'Scope', 'Why']} rows={ROADMAP_ROWS} />
        <StepRail
          steps={[
            {
              title: 'Start with reach plus richness',
              body: 'Garmin, Oura, Withings, and Samsung Health / Health Connect give us the most balanced combination of scale and technical signal.',
              owner: 'Partnership + platform leads',
            },
            {
              title: 'Expand into premium athlete ecosystems',
              body: 'Polar, WHOOP, and COROS widen the serious-athlete segment without changing the core contract.',
              owner: 'Growth + integrations',
            },
            {
              title: 'Close the enterprise lane',
              body: 'Catapult should be pursued as a separate team-performance motion with higher ACV potential.',
              owner: 'Enterprise partnerships',
            },
          ]}
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckDeviceIntegrationPartnershipMatrixTab;
