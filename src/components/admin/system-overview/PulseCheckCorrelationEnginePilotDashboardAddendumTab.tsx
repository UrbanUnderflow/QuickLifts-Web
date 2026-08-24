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
  ['Active pilot', 'A pilot whose current status is active and that appears in the current pilot directory by default.'],
  ['PilotEnrollment', 'The pilot-scoped truth object connecting one athlete to one pilot and optional cohort.'],
  ['Pilot athlete', 'An athlete with a PilotEnrollment in the selected pilot.'],
  ['Active pilot athlete', 'A pilot athlete who meets the dashboard active-athlete definition inside that pilot.'],
  ['Eligible pilot athlete', 'An active pilot athlete who meets the minimum data requirements for a specific metric or feature.'],
  ['Eligible to invite', 'A team member who may be invited into the pilot and has no active enrollment in it. This person stays outside pilot KPIs.'],
  ['Connected data coverage', 'The share of active pilot athletes with usable data inside the freshness window, reported with the actual contributing providers.'],
  ['Stable pattern', 'An Athlete Pattern Model entry at Stage 3 or Stage 4.'],
  ['Recommendation attempted', 'An event where the engine tried to create a recommendation for a pilot athlete.'],
  ['Recommendation generated', 'A recommendation that was successfully created and delivered to a runtime consumer.'],
  ['Recommendation followed', 'A generated recommendation that the athlete or coach acted on in the relevant follow-through window.'],
];

const DIMENSION_ROWS = [
  ['System health', 'Is the pilot system running and producing current data?', 'Operations', 'Evidence quality and outcome validation.'],
  ['Evidence quality', 'Is the pilot evidence base sufficient and trustworthy?', 'Activity & Outcomes', 'System health and participation.'],
  ['Insight production', 'What stable patterns and projections is the pilot generating?', 'Insights & Research', 'Outcome validation.'],
  ['Outcome validation', 'Are the discovered relationships useful within the governed frame?', 'Activity & Outcomes', 'Participation and raw insight volume.'],
  ['Adoption', 'Are athletes and coaches engaging with expected pilot actions and outputs?', 'Activity & Outcomes', 'Outcome validation.'],
  ['Hypothesis governance', 'How are pilot beliefs changing with the evidence?', 'Insights & Research', 'Any single KPI alone.'],
];

const DISPLAY_STATE_ROWS = [
  ['Measured zero', 'A valid eligible population and period were evaluated, and the result is zero.', 'Show `0` with denominator and period.'],
  ['Waiting for data', 'More baseline days, responses, or source history are required.', 'Name the missing evidence and next checkpoint.'],
  ['Not available', 'No usable value is available for the requested metric frame.', 'Show the reason and preserve the missing state.'],
  ['Insufficient sample', 'The sample is below the governed interpretation threshold.', 'Show sample size and suppress interpretation.'],
  ['Setup required', 'A required owner, route, permission, or setting is incomplete.', 'Show a plain action with the correct destination.'],
  ['Not applicable', 'The pilot design excludes the measure or workflow.', 'Name the pilot rule that makes it inapplicable.'],
];

const REPORTING_RULES = [
  'Every KPI declares whether its denominator is pilot enrollments, active pilot athletes, or eligible pilot athletes.',
  'Pilot KPIs use active `PilotEnrollment` truth for the selected pilot.',
  'Eligible-to-invite team members remain outside every pilot KPI until an active enrollment exists.',
  'Each metric shows its period, eligibility rule, and data state.',
  'A cohort-scoped metric returns cohort data or a clear unavailable state. Silent fallback to a whole-pilot result is prohibited.',
  'The cohort lens appears when usable cohorts exist, and every card states whether the lens applies.',
  'Pre-pilot baseline context carries an explicit label and stays visually separate from pilot-period output.',
  'Operational readiness, evidence quality, participation, outcomes, and research conclusions remain separate meanings inside the task-based areas.',
  'Connected data coverage names the actual providers contributing data and stays separate from participation.',
  'A pilot summary covers current phase, People, Activity & Outcomes, Operations, and Insights & Research with the relevant limitations.',
];

const PulseCheckCorrelationEnginePilotDashboardAddendumTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Physiology-Cognition Correlation Engine"
        title="Correlation Engine Pilot Dashboard Addendum"
        version="Version 1.2 | August 23, 2026"
        summary="Glossary and reporting-governance addendum for the Correlation Engine Pilot Dashboard. This page locks pilot-scoped denominator vocabulary, meaningful data states, and layer-separation rules as the dashboard moves to a task-based structure."
        highlights={[
          {
            title: 'Pilot Denominators First',
            body: 'The default denominator vocabulary comes from Pilot, PilotEnrollment, active pilot athletes, and metric-specific eligibility.',
          },
          {
            title: 'Layer Separation Protects Trust',
            body: 'Operational readiness, evidence quality, participation, outcomes, and research conclusions keep their own meanings even when they appear in one task-based area.',
          },
          {
            title: 'Missing And Zero Are Different States',
            body: 'Every card preserves whether a value is measured, still forming, unavailable, below threshold, awaiting setup, or outside the pilot design.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Glossary and reporting-governance addendum for the task-based pilot dashboard."
        sourceOfTruth="This document is authoritative for pilot-dashboard denominator vocabulary, display-state meaning, cohort-scope behavior, and reporting separation rules. Read it alongside the Pilot Dashboard and Pilot Ops Runbook artifacts."
        masterReference="Use this page when a KPI needs a denominator, a data state needs a label, a cohort lens changes a metric, or a pilot report needs clear separation between operational, outcome, and research meanings."
        relatedDocs={[
          'Correlation Engine Pilot Dashboard',
          'Correlation Engine Pilot Ops Runbook',
          'Pilot Research Readout Implementation Spec',
          'Team & Pilot Onboarding',
          'Profile Snapshot & Export Spec',
        ]}
      />

      <SectionBlock icon={FileText} title="Pilot KPI Glossary">
        <DataTable columns={['Term', 'Definition']} rows={GLOSSARY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Layer Placement And Separation">
        <DataTable columns={['Dimension', 'Primary Question', 'Primary Area', 'Keep Separate From']} rows={DIMENSION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={FileText} title="Display State Vocabulary">
        <DataTable columns={['State', 'Meaning', 'Required Display']} rows={DISPLAY_STATE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Reporting Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Non-Negotiable Reporting Rules" accent="blue" body={<BulletList items={REPORTING_RULES} />} />
          <InfoCard
            title="Practical Reporting Pattern"
            accent="green"
            body="A pilot update starts with the current phase and next action, then reports People, Activity & Outcomes, Operations, and Insights & Research. Each section states the pilot, period, denominator, cohort lens, data state, and active limitations."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckCorrelationEnginePilotDashboardAddendumTab;
