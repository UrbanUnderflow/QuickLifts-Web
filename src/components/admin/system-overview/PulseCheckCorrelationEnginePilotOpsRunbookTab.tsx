import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
  Users,
  Workflow,
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

const OWNERSHIP_ROWS = [
  ['Wearable connection rate drops below threshold', 'Warning', 'Pilot Ops Lead', 'Product Lead if the pilot itself is at risk.'],
  ['Stale data rate rises above threshold', 'Warning', 'Pilot Ops Lead', 'Engineering Lead if pipeline recovery is required.'],
  ['Contradiction rate spikes', 'Warning', 'Data / Research Lead', 'Product + Research if the spike persists across review cycles.'],
  ['Evidence maturity stalls', 'Attention', 'Data / Research Lead', 'Pilot Owner if progression does not improve after intervention.'],
  ['Projection generation success falls below threshold', 'Warning', 'Engineering Lead', 'Pilot Owner if projections should be paused for that pilot.'],
  ['Failed recompute jobs remain unresolved', 'Attention', 'Engineering Lead', 'Pilot Ops Lead for manual intervention and pilot-risk triage.'],
  ['Hypothesis becomes not supported', 'Review required', 'Pilot Owner + Research Lead', 'Executive review when a core thesis hypothesis is affected.'],
];

const CADENCE_ROWS = [
  ['Daily', 'Pilot ops health check', 'Review active pilot directory plus system-health alerts for each active pilot.'],
  ['Twice weekly', 'Evidence quality review', 'Review maturity progression, signal diversity, and contradiction posture for active pilots.'],
  ['Weekly', 'Pilot progress review', 'Review pilot overview, findings, adoption posture, and open queue items.'],
  ['Biweekly', 'Hypothesis review', 'Update pilot hypotheses, confidence, rationale, and implications honestly.'],
  ['Monthly', 'Outcome validation review', 'Deep-review outcome charts, within-athlete comparisons, and recommendation efficacy.'],
];

const WORKFLOW_ROWS = [
  ['Stale data response', 'Detect affected pilot athletes, separate device-side versus pipeline-side issues, resolve, then confirm freshness has returned inside the pilot.'],
  ['Contradiction spike response', 'Determine whether the change is a true athlete shift, a data-quality issue, or model drift; then document and resolve inside the pilot review log.'],
  ['Evidence maturity stall response', 'Segment stalled athletes by no wearable, low sim volume, or low state diversity; intervene based on the real cause.'],
  ['Failed recompute response', 'Fix the root cause, rerun affected jobs, and confirm all impacted pilot athletes have fresh pattern models.'],
  ['Unsupported hypothesis response', 'Mark the hypothesis honestly, document the rationale, and escalate if the pilot thesis changes.'],
  ['Low adoption response', 'Separate awareness, trust, usability, and relevance problems; then track whether the intervention changes pilot behavior.'],
];

const QUEUE_ROWS = [
  ['Contradictions to inspect', 'Pattern families or athletes with conflicting recent evidence inside the pilot.'],
  ['Athletes with degraded evidence', 'Pilot athletes whose stable patterns dropped into degraded posture.'],
  ['Unsupported hypotheses', 'Pilot hypotheses that need status, rationale, or escalation review.'],
  ['Stale-source clusters', 'Pilot athletes without fresh physiology data inside the allowed freshness window.'],
  ['Low-adoption segments', 'Pilot athletes or coaches seeing outputs but not acting on them.'],
  ['Compromised milestone captures', 'Baseline, midpoint, endpoint, or retention captures flagged as compromised or unknown.'],
];

const RULES = [
  'Every alert and queue item must carry `pilotId` as its primary scope key.',
  'A pilot runbook may use team and organization context for routing and ownership, but the operational decision belongs to the pilot being monitored.',
  'Active pilot dashboards should ignore athletes outside that pilot, even if they are on the same team.',
  'Resolution is not complete until pilot metrics confirm recovery; operator belief is not enough.',
  'The runbook governs human response to pilot signals. It does not silently change engine behavior.',
];

const PulseCheckCorrelationEnginePilotOpsRunbookTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Physiology-Cognition Correlation Engine"
        title="Correlation Engine Pilot Ops Runbook"
        version="Version 1.0 | March 20, 2026"
        summary="Operational companion to the Correlation Engine Pilot Dashboard. This runbook defines how the team responds when an active pilot dashboard shows a problem: who owns the issue, how often it should be reviewed, how it should be escalated, and what must happen before the issue is considered resolved."
        highlights={[
          {
            title: 'Pilot Scope Is Operational Scope',
            body: 'Every alert, queue item, and response workflow should resolve against one pilot. This runbook is not a whole-system operations manual.',
          },
          {
            title: 'Every Alert Needs An Owner',
            body: 'If a pilot dashboard metric cannot be triaged and acted on, it should not be an alert yet.',
          },
          {
            title: 'Resolution Means Verified',
            body: 'An issue is not closed because someone thinks it was fixed. It is closed when pilot metrics confirm that the pilot recovered.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Pilot-scoped operational runbook for active Correlation Engine pilots. It defines alert ownership, review cadence, escalation paths, and pilot review-queue expectations."
        sourceOfTruth="This document is authoritative for pilot alert ownership, review rhythm, escalation behavior, and review-queue handling. It is not authoritative for dashboard structure, engine confidence rules, or pilot provisioning."
        masterReference="Use this page when deciding who should respond to a pilot dashboard signal, how often signals should be reviewed, and what constitutes a resolved pilot issue."
        relatedDocs={[
          'Correlation Engine Pilot Dashboard',
          'Correlation Engine Pilot Dashboard Addendum',
          'Correlation Engine Engineering Task Breakdown',
          'Team & Pilot Onboarding',
        ]}
      />

      <SectionBlock icon={Users} title="Alert Ownership Matrix">
        <DataTable columns={['Alert', 'Severity', 'Owner', 'Escalation']} rows={OWNERSHIP_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Review Cadence">
        <DataTable columns={['Frequency', 'Review', 'Expected Action']} rows={CADENCE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Response Workflows">
        <DataTable columns={['Workflow', 'Pilot-Scoped Response']} rows={WORKFLOW_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Review Queue">
        <DataTable columns={['Queue Item', 'What It Means']} rows={QUEUE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Operating Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Non-Negotiable Rules" accent="blue" body={<BulletList items={RULES} />} />
          <InfoCard
            title="V1 To V2 Transition"
            accent="amber"
            body="In V1, queue items may be tracked manually in the weekly pilot review. In V2, the same queue should move into an assignable in-product review panel without changing the underlying pilot scope."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={CheckCircle2} title="Success Condition">
        <InfoCard
          title="What Good Looks Like"
          accent="green"
          body="The ops layer is working when the team can look at the active pilot directory, open one pilot, see what needs attention, know who owns it, and verify within a defined cadence whether the pilot has actually recovered."
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckCorrelationEnginePilotOpsRunbookTab;
