import React from 'react';
import { AlertTriangle, CheckSquare, ClipboardCheck, ShieldCheck, TestTube2, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const QA_ROWS = [
  ['Registry seed + integrity', 'Published runtime inventory loads cleanly, links to valid family/variant records, and orphaned live records are rejected.', 'Block launch if inventory is malformed.'],
  ['Publish gate enforcement', 'A runtime cannot become live through save-path metadata drift; only reviewed publish path makes it eligible.', 'Block launch if bypass still exists.'],
  ['Policy filtering', 'Avoid-window, contraindication, restricted, and context-fit rules remove invalid protocol candidates before ranking.', 'Block launch if filtering remains class-only.'],
  ['Fallback planner safety', 'When AI fails or selects invalid output, validator falls back to a bounded safe choice or defer.', 'Must pass before pilot expansion.'],
  ['Responsiveness ranking', 'Positive responsiveness can help a valid candidate win, while strong negative responsiveness suppresses it.', 'Must pass in dev and pilot-like fixtures.'],
  ['Archive / restrict behavior', 'Removing a runtime from inventory takes effect immediately in future candidate sets.', 'Must pass before launch.'],
  ['Evidence refresh', 'Assignment events refresh evidence and responsiveness traces automatically.', 'Must pass before launch.'],
  ['Coach audit visibility', 'Coach review shows ranked candidates, planner rationale, and responsiveness posture clearly.', 'Must pass before launch.'],
  ['Same-day revision lineage', 'Re-plans preserve assignment lineage instead of overwriting prior truth silently.', 'Strongly preferred for launch confidence.'],
  ['Inventory-gap handling', 'No-eligible-protocol scenarios create an explicit gap signal and degrade safely.', 'Must pass before launch.'],
];

const ENV_ROWS = [
  ['Deterministic local / dev fixtures', 'Fast protocol-policy regression checks without relying on live pilot data.'],
  ['Firestore-backed integration path', 'Verify registry, candidate-set, assignment, event, and responsiveness persistence together.'],
  ['Pilot-like end-to-end path', 'Exercise the athlete check-in, planner, coach review, and event refresh loop under realistic conditions.'],
];

const RELEASE_ROWS = [
  ['Red', 'Any launch-blocking QA row fails or is still untested.'],
  ['Amber', 'Core blockers pass, but one or more high-risk non-blockers still need follow-up under explicit owner/date.'],
  ['Green', 'All launch-blocking protocol rows pass and residual risks are documented but not release-stopping.'],
];

const EXTRA_CASES = [
  'Protocol-only day with no sim candidate available.',
  'Protocol-then-sim day where protocol candidate is valid but one sibling is excluded by avoid-window logic.',
  'Strong negative responsiveness profile suppresses a candidate that would otherwise rank highly.',
  'Archive a protocol and confirm the next check-in no longer sees it in the candidate set.',
  'Evidence refresh path updates after completion, defer, and override events.',
];

const PulseCheckProtocolLaunchQaMatrixTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Protocol Launch QA Matrix"
        version="Version 0.1 | March 18, 2026"
        summary="Launch-facing QA artifact for the protocol subsystem. This page defines the specific protocol scenarios that should pass before launch confidence is claimed, with release-blocking posture attached to each one."
        highlights={[
          {
            title: 'Launch QA Is Smaller Than Total QA',
            body: 'This matrix focuses on the protocol scenarios that are release-critical, not every future optimization or v2 idea.',
          },
          {
            title: 'Blockers Are Explicit',
            body: 'Each row states whether failure should actually block launch or whether it can ship with follow-up ownership.',
          },
          {
            title: 'Protocol QA Needs Full-Stack Coverage',
            body: 'Registry data, planner policy, assignment materialization, evidence refresh, and coach visibility all need validation.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Release-signoff QA matrix for the protocol subsystem. It turns protocol launch confidence into explicit pass / fail scenarios with blocker posture."
        sourceOfTruth="This document is authoritative for the minimum protocol QA rows that should be reviewed during launch sign-off."
        masterReference="Use Protocol Launch Readiness to define go / no-go standards, then use this matrix to prove those standards were actually exercised."
        relatedDocs={[
          'Protocol Launch Readiness',
          'Planner Policy Enforcement',
          'Protocol Evidence Dashboard',
          'Protocol Ops Runbook',
        ]}
      />

      <SectionBlock icon={ClipboardCheck} title="Launch-Blocking QA Rows">
        <DataTable columns={['Scenario', 'Pass Condition', 'Release Posture']} rows={QA_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Coverage Environments">
        <DataTable columns={['Environment', 'Why It Is Needed']} rows={ENV_ROWS} />
      </SectionBlock>

      <SectionBlock icon={TestTube2} title="Expanded Scenario Queue">
        <InfoCard title="Additional Cases Worth Running" accent="amber" body={<BulletList items={EXTRA_CASES} />} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Release Status Language">
        <DataTable columns={['Status', 'Meaning']} rows={RELEASE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={CheckSquare} title="How To Use In Launch Review">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Review Flow"
            accent="green"
            body={
              <BulletList
                items={[
                  'Walk each launch-blocking row and record pass / fail / not-run status.',
                  'Attach defects and owners to any amber or red rows.',
                  'Do not collapse untested protocol rows into general Nora QA confidence.',
                ]}
              />
            }
          />
          <InfoCard
            title="Launch Rule"
            accent="red"
            body="If a row marked as launch-blocking is still failing or untested, protocol launch readiness should remain red even if the rest of PulseCheck feels broadly healthy."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Launch Principle">
        <InfoCard
          title="QA Standard"
          accent="blue"
          body="The protocol subsystem should earn release confidence through a small set of sharp, realistic, blocker-labeled tests rather than through generic confidence that the broader runtime mostly works."
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckProtocolLaunchQaMatrixTab;
