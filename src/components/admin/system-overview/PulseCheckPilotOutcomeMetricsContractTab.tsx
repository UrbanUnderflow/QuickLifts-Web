import React from 'react';
import {
  BarChart3,
  CheckSquare,
  Database,
  Layers,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

const ARCHITECTURE_ROWS = [
  ['Raw operational truth', 'Canonical Firestore and runtime collections that already power PulseCheck.', 'Source of truth layer.'],
  ['Pilot metric events', 'Append-only pilot-scoped events for milestones that are expensive or ambiguous to reconstruct later.', 'Audit and rollup input layer.'],
  ['Pilot metric rollups', 'Daily and current pilot summary documents for fast dashboard reads.', 'Read-model layer.'],
];

const METRIC_ROWS = [
  ['Enrollment', 'Athlete finished onboarding, accepted all required consents, and completed the initial baseline test.', 'Enrollment complete / invited'],
  ['Adherence', 'Expected active athlete-days where both the daily check-in and assigned action were completed.', 'Full-day adherence rate'],
  ['Mental performance improvement', 'Average pillar composite delta from valid pilot baseline to valid current profile.', 'Average pillar composite delta'],
  ['Escalations', 'Pilot-scoped escalation counts and status by tier.', 'Escalations total + tier mix'],
  ['Speed to care', 'Time from escalation creation to care-path movement.', 'Median minutes to handoff initiated'],
  ['Trust', 'Direct self-reported trust in PulseCheck guidance, role-specific.', 'Average most recent valid trust response'],
  ['NPS', 'Role-specific recommendation intent.', 'Promoters minus detractors'],
];

const EXECUTION_ROWS = [
  ['`pilotMentalPerformanceSnapshot` storage', 'Choose the exact collection/path and keep dashboard reads on the read-model, not ad hoc recompute.', 'Implementation choice'],
  ['Rollup recompute model', 'Choose whether recompute is function-based, job-based, or hybrid by metric family.', 'Implementation choice'],
  ['Trust battery storage', 'Store trust battery inside `pulsecheck-pilot-survey-responses` as one payload or a child structure.', 'Implementation choice'],
  ['Dashboard card order', 'Lock v1 card ordering for enrollment, adherence, escalations, speed to care, athlete trust, and athlete NPS.', 'Implementation choice'],
];

const OWNERSHIP_ROWS = [
  ['`baseline_completed`', 'Baseline completion backend path', 'Prevent duplicate event writes from client and server.'],
  ['`daily_checkin_completed`', '`submit-pulsecheck-checkin`', 'Canonical writer for check-in completion.'],
  ['`daily_assignment_completed`', '`record-pulsecheck-assignment-event`', 'Canonical writer when event type becomes `completed`.'],
  ['`care_handoff_initiated` / `care_handoff_completed`', 'Escalation backend', 'Canonical care lifecycle ownership.'],
  ['`nps_submitted` / `trust_submitted`', 'Survey submission endpoint', 'Canonical survey metric event ownership.'],
  ['`pilotMentalPerformanceSnapshot` writes', 'Backend jobs, functions, or lifecycle hooks', 'Dashboard must never write snapshots on read.'],
];

const RULES = [
  'Pilot metrics remain pilot-scoped first and must not silently drift into whole-team or whole-system reporting.',
  'Adherence denominators are athlete-local and exclude pause, escalation-hold, and no-task rest days.',
  'Mental performance delta reads persisted pilot-scoped snapshots rather than ad hoc live joins.',
  'Trust remains separate from NPS, and behavior does not replace direct trust reporting.',
  'Rollups are idempotent read models; nightly repair is the correction path, not a second truth model.',
  'Low-sample trust and NPS cards should stay visible and show `Not enough responses yet`.',
];

const PulseCheckPilotOutcomeMetricsContractTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Physiology-Cognition Correlation Engine"
        title="Pilot Outcome Metrics Contract"
        version="Version 1.0 | March 30, 2026"
        summary="Canonical contract for how PulseCheck pilots measure success across enrollment, adherence, mental performance improvement, escalations, speed to care, trust, and NPS. This artifact turns the pilot dashboard from a monitoring surface into a pilot outcome system."
        highlights={[
          {
            title: 'Outcome System, Not Just Dashboard',
            body: 'This contract defines the metric meanings, event boundaries, rollup rules, and display behavior needed to monitor pilot success honestly.',
          },
          {
            title: 'Pilot-Scoped By Default',
            body: 'Every denominator, rollup, and response rule stays rooted in pilot scope rather than slipping into whole-team or whole-system analytics.',
          },
          {
            title: 'Operationally Buildable',
            body: 'The contract locks the core metrics and ownership defaults while leaving only a few execution choices for engineering to finalize during implementation.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Canonical outcome-metrics contract for PulseCheck pilots."
        sourceOfTruth="This document is authoritative for pilot outcome metric definitions, event ownership defaults, trust measurement structure, and read-model requirements for the pilot dashboard."
        masterReference="Use this page when implementing pilot metrics, pilot rollups, trust measurement, speed-to-care reporting, or any dashboard card that claims to represent pilot success."
        relatedDocs={[
          'Correlation Engine Pilot Dashboard',
          'Pilot Dashboard Addendum',
          'Correlation Engine Pilot Ops Runbook',
          'Pilot Research Readout Implementation Spec',
          'Team & Pilot Onboarding',
        ]}
      />

      <SectionBlock icon={Layers} title="Three-Layer Architecture">
        <DataTable columns={['Layer', 'Meaning', 'Role']} rows={ARCHITECTURE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Locked Pilot Metrics">
        <DataTable columns={['Metric Family', 'Locked Definition', 'Headline Read']} rows={METRIC_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Users} title="Implementation Ownership Defaults">
        <DataTable columns={['Event / Object', 'Canonical Writer', 'Why']} rows={OWNERSHIP_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Remaining Execution Choices">
        <DataTable columns={['Choice', 'Decision Needed', 'Status']} rows={EXECUTION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Non-Negotiable Operating Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Locked Rules" accent="blue" body={<BulletList items={RULES} />} />
          <InfoCard
            title="Execution Posture"
            accent="green"
            body="Engineering can now move into implementation planning. Remaining choices are execution details such as exact collection paths, writer placement, recompute topology, and dashboard ordering rather than unresolved product architecture."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={CheckSquare} title="What This Unlocks">
        <InfoCard
          title="Pilot Success Readability"
          accent="amber"
          body="Once implemented, the pilot dashboard can answer four critical questions clearly: who truly enrolled, who is following through, whether mental performance is improving, and whether the support-and-care system is operating fast enough while athletes still trust the product."
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckPilotOutcomeMetricsContractTab;
