import React from 'react';
import { BarChart3, FileText, ShieldCheck } from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

const GLOSSARY_ROWS = [
  ['Pilot', 'A time-bound program inside one team with its own goals, dates, checkpoints, and study posture.'],
  ['Active pilot', 'A pilot whose current status is active and that appears in the active pilot directory by default.'],
  ['PilotEnrollment', 'The pilot-scoped truth object connecting one athlete to one pilot and optional cohort.'],
  ['Pilot athlete', 'An athlete with a PilotEnrollment in the selected pilot.'],
  ['Active pilot athlete', 'A pilot athlete who meets the dashboard’s active-athlete definition inside that pilot.'],
  ['Eligible pilot athlete', 'An active pilot athlete who meets the minimum data requirements for a given metric or feature.'],
  ['Connected wearable', 'A physiology source that has synced usable data inside the freshness window.'],
  ['Stable pattern', 'An Athlete Pattern Model entry at Stage 3 or Stage 4.'],
  ['Recommendation attempted', 'An event where the engine tried to create a recommendation for a pilot athlete.'],
  ['Recommendation generated', 'A recommendation that was successfully created and delivered to a runtime consumer.'],
  ['Recommendation followed', 'A generated recommendation that the athlete or coach acted on in the relevant follow-through window.'],
];

const DIMENSION_ROWS = [
  ['Engine health', 'Is the pilot system running and producing current data?', 'Evidence quality or outcome validation.'],
  ['Evidence quality', 'Is the pilot evidence base sufficient and trustworthy?', 'Engine health or adoption.'],
  ['Insight production', 'What stable patterns and projections is the pilot generating?', 'Outcome validation.'],
  ['Outcome validation', 'Are the pilot’s discovered relationships predictive and useful?', 'Adoption or raw insight volume.'],
  ['Adoption', 'Are athletes and coaches engaging with the pilot outputs?', 'Outcome validation.'],
  ['Hypothesis governance', 'Are the pilot beliefs holding up honestly over time?', 'Any single KPI alone.'],
];

const REPORTING_RULES = [
  'Every KPI must declare whether its denominator is pilot enrollments, active pilot athletes, or eligible pilot athletes.',
  'Do not mix whole-team or whole-system populations into pilot KPIs by default.',
  'If a metric references pre-pilot baseline history, label that context explicitly instead of silently merging it into pilot-period output.',
  'Every pilot summary should address engine health, evidence quality, insight production, outcome validation, adoption, and hypothesis governance separately.',
];

const PulseCheckCorrelationEnginePilotDashboardAddendumTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Physiology-Cognition Correlation Engine"
        title="Correlation Engine Pilot Dashboard Addendum"
        version="Version 1.1 | March 20, 2026"
        summary="Glossary and reporting-governance addendum for the Correlation Engine Pilot Dashboard. This page locks the pilot-scoped denominator vocabulary and the layer-separation rules that keep pilot reporting honest as the dashboard grows."
        highlights={[
          {
            title: 'Pilot Denominators First',
            body: 'The default denominator vocabulary should be rooted in Pilot, PilotEnrollment, and active pilot athletes rather than whole-team membership.',
          },
          {
            title: 'Layer Separation Protects Trust',
            body: 'A pilot can be operationally healthy while producing weak evidence, or produce accurate recommendations that nobody follows. The dashboard has to keep those meanings separate.',
          },
          {
            title: 'Reporting Must Stay Pilot-Scoped',
            body: 'Pilot updates should describe what is true inside the selected pilot, not blur into global engine claims unless a separate rollup explicitly says so.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Glossary and reporting-governance addendum for the pilot dashboard."
        sourceOfTruth="This document is authoritative for pilot-dashboard denominator vocabulary and reporting separation rules. It should be read alongside the Pilot Dashboard and Pilot Ops Runbook artifacts."
        masterReference="Use this page when a KPI needs a denominator, a pilot report needs section discipline, or a dashboard review risks collapsing multiple meanings into one summary sentence."
        relatedDocs={[
          'Correlation Engine Pilot Dashboard',
          'Correlation Engine Pilot Ops Runbook',
          'Team & Pilot Onboarding',
          'Profile Snapshot & Export Spec',
        ]}
      />

      <SectionBlock icon={FileText} title="Pilot KPI Glossary">
        <DataTable columns={['Term', 'Definition']} rows={GLOSSARY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Layer Separation Rule">
        <DataTable columns={['Dimension', 'Primary Question', 'Cannot Be Conflated With']} rows={DIMENSION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Reporting Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Non-Negotiable Reporting Rules" accent="blue" body={<BulletList items={REPORTING_RULES} />} />
          <InfoCard
            title="Practical Reporting Pattern"
            accent="green"
            body="A written pilot update should use the dashboard dimensions as section headers and state the pilot scope plainly: which pilot is being described, what period is covered, and whether cohort filters or special eligibility rules were applied."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckCorrelationEnginePilotDashboardAddendumTab;
