import React from 'react';
import { AlertTriangle, CheckSquare, ClipboardCheck, FileCheck2, Rocket, ShieldCheck } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const READINESS_ROWS = [
  ['Registry integrity', 'Every live protocol runtime record links to a valid family and variant, carries the right class/response metadata, and can be audited back to its published object.', 'No orphaned live records. Seed sync and runtime hydration complete successfully.'],
  ['Planner policy enforcement', 'The assignment planner only considers protocols that are truly eligible for launch use.', 'Published + active + context-fit + not excluded by avoid/contraindication rules.'],
  ['Evidence and responsiveness health', 'Protocol evidence and athlete responsiveness memory update automatically from runtime behavior and stay explainable.', 'Assignment events refresh evidence rollups and coach/operator surfaces show why a protocol was preferred.'],
  ['Operational control', 'Operators can publish, restrict, archive, and inspect protocol behavior without a deploy.', 'Bad protocol can be removed from inventory immediately and the reason is visible.'],
  ['QA sign-off', 'Launch-critical scenarios have passing test coverage and explicit expected behavior.', 'Core launch matrix passes in dev and pilot-like conditions.'],
  ['Observability and runbooks', 'The team can detect protocol regressions quickly and knows what to do next.', 'Metrics, dashboards, and incident playbooks exist for launch-day support.'],
];

const EXIT_ROWS = [
  ['Can a protocol bypass publish review and still become live?', 'No'],
  ['Can the planner explain why a protocol won or lost?', 'Yes'],
  ['Can staff remove a bad protocol from inventory in minutes?', 'Yes'],
  ['Can we trace a live assignment back to the protocol object and decision context that produced it?', 'Yes'],
  ['Do evidence and responsiveness updates happen without manual bookkeeping?', 'Yes'],
  ['Do we have launch-blocking QA scenarios with pass/fail status?', 'Yes'],
];

const REVIEW_PACKET_ROWS = [
  ['Registry snapshot', 'Current published runtime inventory, family/variant links, and blocked records.'],
  ['Planner policy checklist', 'Proof that live eligibility rules are enforced before candidate ranking.'],
  ['Evidence posture', 'Completion, defer, override, readiness-delta, and downstream-effect signals by protocol family and runtime.'],
  ['Responsiveness posture', 'How athlete-level responsiveness is applied and what freshness/decay rules are active.'],
  ['Operational controls', 'Archive/restrict controls, permissions, and incident response path.'],
  ['QA sign-off', 'Launch matrix status, known open issues, and release-blocking defects.'],
];

const BLOCKER_ROWS = [
  ['Publish bypass exists', 'A record can reach launch inventory without passing the intended publish gate.'],
  ['Planner policy is under-specified', 'The planner still relies on loose class matching instead of launch-safe policy filtering.'],
  ['Assignment provenance is incomplete', 'Launch review cannot confidently answer which revision or runtime shape produced a protocol assignment.'],
  ['Evidence is not trustworthy', 'Evidence panels lag runtime truth or omit meaningful negative signals.'],
  ['Ops cannot contain a bad protocol quickly', 'Archive/restrict path is unclear, delayed, or not verified.'],
];

const PulseCheckProtocolLaunchReadinessTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Protocol Launch Readiness"
        version="Version 0.1 | March 18, 2026"
        summary="Launch-gating artifact for deciding whether the PulseCheck protocol system is safe, observable, governable, and explainable enough to ship. This page turns the protocol stack into an explicit go / no-go checklist rather than assuming the existence of docs and code means launch readiness."
        highlights={[
          {
            title: 'Launch Means Operationally Defensible',
            body: 'The system is not launch-ready just because Nora can assign protocols. It has to be governable, explainable, and reversible under pressure.',
          },
          {
            title: 'Readiness Is Cross-Layer',
            body: 'Registry data, planner policy, evidence freshness, ops controls, and QA all need to pass together.',
          },
          {
            title: 'Go / No-Go Must Be Concrete',
            body: 'This artifact exists so launch review can answer specific questions instead of relying on general confidence.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Launch-gating artifact for the protocol subsystem. It defines the minimum conditions required before protocol planning should be treated as launch-ready rather than pilot-grade."
        sourceOfTruth="This document is authoritative for protocol launch criteria, required review packet contents, and the conditions that should block release if they remain unresolved."
        masterReference="Use Protocol Registry for current inventory shape, Planner Policy Enforcement for runtime eligibility rules, and Protocol Launch QA Matrix for sign-off evidence."
        relatedDocs={[
          'Protocol Registry',
          'Planner Policy Enforcement',
          'Protocol Evidence Dashboard',
          'Protocol Revision & Audit Trace',
          'Protocol Ops Runbook',
          'Protocol Launch QA Matrix',
        ]}
      />

      <SectionBlock icon={Rocket} title="Launch Gates">
        <DataTable columns={['Readiness Domain', 'What Must Be True', 'Launch Standard']} rows={READINESS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={CheckSquare} title="Exit Criteria">
        <DataTable columns={['Launch Question', 'Required Answer']} rows={EXIT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={FileCheck2} title="Launch Review Packet">
        <DataTable columns={['Artifact', 'What Launch Review Needs To See']} rows={REVIEW_PACKET_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Minimum Decision Rule"
            accent="green"
            body="If any exit-criteria question still answers 'not sure', the protocol system should be treated as not launch-ready even if the core assignment flow appears to work."
          />
          <InfoCard
            title="Why This Exists"
            accent="blue"
            body="Protocol launch risk is mostly in the edges: silent publish bypasses, weak policy filtering, unclear evidence, and slow incident response. This page forces those risks into one reviewable place."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Release Blockers">
        <DataTable columns={['Blocker', 'Why It Blocks Launch']} rows={BLOCKER_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Readiness Review Cadence">
        <InfoCard
          title="Suggested Review Flow"
          accent="amber"
          body={
            <BulletList
              items={[
                'Run registry integrity and planner-policy verification before every pilot expansion or public launch gate.',
                'Review evidence posture and responsiveness freshness weekly during early rollout.',
                'Treat archive / restrict drills and launch QA matrix results as part of release sign-off, not as optional follow-up work.',
              ]}
            />
          }
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Go / No-Go Principle">
        <InfoCard
          title="Launch Posture"
          accent="red"
          body="The protocol system is launch-ready only when the team can both explain a protocol decision and safely stop making that decision if the runtime starts behaving badly."
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckProtocolLaunchReadinessTab;
