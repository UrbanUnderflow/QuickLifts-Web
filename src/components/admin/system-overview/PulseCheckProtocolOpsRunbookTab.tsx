import React from 'react';
import { AlertTriangle, BellRing, ClipboardList, ShieldAlert, Siren, Wrench } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const INCIDENT_ROWS = [
  ['Protocol appears harmful in live use', 'Archive or restrict the runtime immediately, capture examples, review evidence posture, and notify protocol owners.'],
  ['No eligible protocols for a needed routing window', 'Treat as an inventory gap, confirm planner policy behavior, and decide whether defer or alternate path is the intended fallback.'],
  ['Responsiveness profile looks stale or wrong', 'Inspect source events, refresh path, freshness posture, and whether evidence windows are being classified correctly.'],
  ['Planner is repeatedly choosing an obviously poor-fit protocol', 'Inspect candidate filtering, ranked candidates, responsiveness summary, and state-fit logic before changing inventory.'],
  ['Registry record was published incorrectly', 'Remove or restrict it from live inventory first, then correct the registry object and audit the publish path.'],
  ['Evidence panels are not updating', 'Inspect assignment-event ingestion, evidence rollup path, and whether assignment provenance is still linking correctly.'],
];

const ROLE_ROWS = [
  ['Protocol owner', 'Owns family / variant / runtime intent, publish rationale, and follow-up decisions after evidence review.'],
  ['Operator / admin', 'Uses registry controls, inspector views, and runbook steps to contain launch-day problems quickly.'],
  ['Product / research', 'Interprets mixed evidence, decides whether a protocol should be restricted, revised, or retired.'],
  ['Engineering', 'Owns planner-policy enforcement, evidence freshness, trace integrity, and incident-level runtime debugging.'],
  ['Coach support', 'Reports field issues, override patterns, and athlete-facing failure modes observed in real usage.'],
];

const TRIAGE_ROWS = [
  ['Containment first', 'If a protocol may be harmful, remove it from live eligibility before debating the root cause.'],
  ['Prefer reversible controls', 'Archive, restrict, or defer rather than hot-patching logic in a rush unless the issue is clearly code-level and urgent.'],
  ['Use the trace chain', 'Check registry state, candidate set, planner audit, assignment events, and responsiveness posture in one pass.'],
  ['Write down the decision', 'Every launch-day intervention should capture what changed, why, and what signal triggered the change.'],
];

const MONITOR_ROWS = [
  ['Assignment volume by protocol', 'Detect sudden spikes or unexplained drops.'],
  ['Negative or mixed-response posture', 'Catch protocols drifting into watch territory quickly.'],
  ['Override and defer rates', 'Surface protocols staff or athletes keep rejecting.'],
  ['Review cadence due queue', 'Stop protocols from staying live without re-review.'],
  ['Evidence freshness', 'Detect when launch confidence is leaning on stale memory.'],
];

const ALERT_POLICY_ROWS = [
  ['Assignment volume alert', 'Send an email when 24h protocol assignment volume jumps above a 7-day baseline and clears the minimum spike threshold.'],
  ['Defer / override alert', 'Send an email when resolved protocol outcomes move into a high rejection band and exceed the 7-day baseline by a meaningful margin.'],
  ['Negative-response alert', 'Send an email when a fresh responsiveness profile is leaning negative with enough sample size to trust the signal.'],
  ['Cooldown policy', 'Suppress repeat alerts for the same condition for roughly 24 hours so ops gets signal, not spam.'],
];

const PulseCheckProtocolOpsRunbookTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Protocol Ops Runbook"
        version="Version 0.1 | March 18, 2026"
        summary="Operations artifact for how the team should monitor, contain, diagnose, and recover protocol-system issues at launch. This page defines the minimum operational posture required so protocol failures are survivable without ad hoc decision-making."
        highlights={[
          {
            title: 'Containment Beats Debate',
            body: 'If a protocol may be harmful or obviously wrong, the first job is to stop it from staying live.',
          },
          {
            title: 'The Trace Chain Is The Debug Path',
            body: 'Registry state, planner audit, assignment events, and evidence posture should be inspected together.',
          },
          {
            title: 'Ops Needs Named Owners',
            body: 'Launch-day protocol issues should never depend on vague shared ownership.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Operational playbook for launch-day and post-launch protocol issues. It defines how the team should respond when live protocol behavior looks unsafe, noisy, stale, or operationally confusing."
        sourceOfTruth="This document is authoritative for protocol operational response posture, named ownership, and the minimum steps required to triage live protocol incidents."
        masterReference="Use Protocol Launch Readiness to define what should already be true before launch, then use this runbook when something still goes wrong anyway."
        relatedDocs={[
          'Protocol Launch Readiness',
          'Protocol Registry',
          'Protocol Evidence Dashboard',
          'Protocol Revision & Audit Trace',
        ]}
      />

      <SectionBlock icon={Siren} title="Incident Classes">
        <DataTable columns={['Incident', 'First Response']} rows={INCIDENT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Named Roles">
        <DataTable columns={['Role', 'Operational Responsibility']} rows={ROLE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldAlert} title="Triage Principles">
        <InfoCard title="How To Triage" accent="amber" body={<BulletList items={TRIAGE_ROWS.map(([title, body]) => `${title}: ${body}`)} />} />
      </SectionBlock>

      <SectionBlock icon={BellRing} title="What Ops Should Watch">
        <DataTable columns={['Signal', 'Why It Matters']} rows={MONITOR_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BellRing} title="Monitoring Alert Policy">
        <DataTable columns={['Alert', 'Policy']} rows={ALERT_POLICY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Wrench} title="Containment Actions">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Preferred Live Controls"
            accent="green"
            body={
              <BulletList
                items={[
                  'Archive a harmful runtime so it leaves planner inventory immediately.',
                  'Restrict a noisy runtime when it is valid only in narrower windows.',
                  'Use evidence and audit trace to decide whether the issue is policy, registry data, or ranking behavior.',
                ]}
              />
            }
          />
          <InfoCard
            title="What Not To Do"
            accent="red"
            body={
              <BulletList
                items={[
                  'Do not leave a suspect protocol live while gathering more anecdotes if the risk looks real.',
                  'Do not patch over a policy bug by manually editing language only.',
                  'Do not rely on memory instead of recording what changed and why.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Launch Principle">
        <InfoCard
          title="Operational Standard"
          accent="blue"
          body="A launch-ready protocol system assumes incidents will happen and gives operators a clear, reversible path to contain them before root-cause work is complete."
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckProtocolOpsRunbookTab;
