import React from 'react';
import { AlertTriangle, Filter, GitBranch, ShieldCheck, SlidersHorizontal, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const POLICY_ROWS = [
  ['Published + active only', 'A protocol candidate must be published and active before Nora can consider it.'],
  ['Family / variant / runtime linkage valid', 'Candidates with broken hierarchy links or malformed planner metadata must be excluded.'],
  ['Current-state class fit', 'A protocol must match the current bounded protocol class posture before it enters ranking.'],
  ['Trigger and context fit', 'A candidate should only enter ranking when current context meaningfully overlaps its trigger or preferred-use posture.'],
  ['Avoid-window exclusion', 'Candidates must be removed when the current window matches an avoid tag.'],
  ['Contraindication exclusion', 'Candidates must be removed or explicitly restricted when the athlete or context matches a contraindication rule.'],
  ['Governance restrictions respected', 'Restricted or review-required protocols must not behave like general-availability inventory.'],
  ['Responsiveness as ranking input only', 'Responsiveness may re-order valid candidates but must not override hard policy or current-state safety rules.'],
];

const FILTER_ROWS = [
  ['1', 'Load bounded live inventory', 'Start from published active runtime records only.'],
  ['2', 'Drop malformed records', 'Reject candidates missing required planner metadata or valid family/variant links.'],
  ['3', 'Match current protocol class posture', 'Keep only the subset that fits the current state posture.'],
  ['4', 'Apply context-fit rules', 'Prefer trigger/context overlap and reject obvious window mismatches.'],
  ['5', 'Apply avoid + contraindication rules', 'Remove candidates that should not be assigned in the current situation.'],
  ['6', 'Apply governance restrictions', 'Honor restricted, review-only, or temporary suppressions.'],
  ['7', 'Rank remaining candidates', 'Use responsiveness, sort order, and evidence-aware tie-breaks inside the valid set.'],
];

const VALIDATOR_ROWS = [
  ['Selected id must exist in candidate set', 'AI planner or fallback logic may not invent a protocol.'],
  ['Selected action type must match candidate type', 'A protocol candidate cannot be materialized as the wrong execution shape.'],
  ['Defer remains allowed', 'If all policy-safe candidates are filtered out, Nora may defer instead of forcing a bad assignment.'],
  ['Audit must persist', 'The assignment should keep enough planner audit detail for coach review and launch analysis.'],
];

const FAILURE_ROWS = [
  ['No eligible protocols remain', 'Create an inventory-gap signal and either fall back to a valid sim/trial path or defer.'],
  ['Only contraindicated candidates remain', 'Do not rank them. Prefer defer or alternate path with explicit audit note.'],
  ['AI planner selects an invalid candidate', 'Validator replaces it with bounded fallback logic; invalid output never reaches assignment truth.'],
  ['Responsiveness strongly favors a bad-fit protocol', 'Hard policy and current-state fit win over personalization.'],
];

const WORKFLOW_STEPS = [
  {
    title: 'Assemble live protocol inventory',
    body: 'Read only launch-eligible published runtime records from the registry.',
    owner: 'Registry + planner',
  },
  {
    title: 'Filter by policy',
    body: 'Apply class fit, context fit, avoid-window, contraindication, and governance restrictions before any ranking happens.',
    owner: 'Planner policy layer',
  },
  {
    title: 'Rank the valid set',
    body: 'Use responsiveness and deterministic tie-breaks only inside the already-valid candidate set.',
    owner: 'Planner ranking layer',
  },
  {
    title: 'Validate the planner decision',
    body: 'Reject invalid AI output and materialize only a bounded, policy-safe candidate or a defer.',
    owner: 'Decision validator',
  },
];

const PulseCheckProtocolPlannerPolicyEnforcementTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Planner Policy Enforcement"
        version="Version 0.1 | March 18, 2026"
        summary="Runtime-policy artifact for how Nora should filter, validate, and select protocol candidates safely at launch. This page defines the non-negotiable enforcement layer that sits between the registry and the assignment planner so a protocol cannot become assignable just because it exists."
        highlights={[
          {
            title: 'Filter Before Rank',
            body: 'Policy-safe candidate filtering must happen before responsiveness or AI ranking logic enters the picture.',
          },
          {
            title: 'Personalization Is Subordinate',
            body: 'Responsiveness is useful, but it cannot overrule hard policy, current-state fit, or contraindication logic.',
          },
          {
            title: 'Validator Is Mandatory',
            body: 'Even if AI participates in planning, the final decision must still pass deterministic bounded validation.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Policy-layer artifact for protocol candidate eligibility and planner validation. It exists to keep live protocol selection bounded, explainable, and launch-safe."
        sourceOfTruth="This document is authoritative for the enforcement order and validator rules the protocol planner must satisfy before a protocol candidate can materialize into assignment truth."
        masterReference="Use Protocol Registry for runtime inventory shape, Nora Assignment Rules for higher-level routing behavior, and this page for protocol-specific eligibility enforcement."
        relatedDocs={[
          'Protocol Registry',
          'Nora Assignment Rules',
          'Protocol Responsiveness Profile Spec',
          'Protocol Launch Readiness',
        ]}
      />

      <SectionBlock icon={ShieldCheck} title="Non-Negotiable Policy Rules">
        <DataTable columns={['Policy Rule', 'Required Planner Behavior']} rows={POLICY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Filter} title="Filtering Order">
        <DataTable columns={['Step', 'Filter', 'Purpose']} rows={FILTER_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Planner Enforcement Flow">
        <StepRail steps={WORKFLOW_STEPS} />
      </SectionBlock>

      <SectionBlock icon={SlidersHorizontal} title="Decision Validator Rules">
        <DataTable columns={['Validator Rule', 'Why It Exists']} rows={VALIDATOR_ROWS} />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Failure Handling">
        <DataTable columns={['Failure Case', 'Required Behavior']} rows={FAILURE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Launch Note">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="What This Should Prevent"
            accent="red"
            body={
              <BulletList
                items={[
                  'Unreviewed protocols reaching live inventory through metadata drift or publish-status mistakes.',
                  'Bad-fit protocols surviving to ranking because only class-level matching was applied.',
                  'AI planner output skipping past bounded candidate validation.',
                ]}
              />
            }
          />
          <InfoCard
            title="Definition Of Done"
            accent="green"
            body="A launch reviewer should be able to trace exactly why a protocol candidate was eligible, why another was filtered out, and why the selected candidate survived validation."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckProtocolPlannerPolicyEnforcementTab;
