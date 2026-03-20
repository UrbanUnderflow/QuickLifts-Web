import React from 'react';
import { AlertTriangle, ClipboardCheck, GitBranch, Shield, TestTube2, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const SCENARIO_ROWS = [
  ['Athlete self-reports "locked in" but performance flags show acute instability', 'Lower confidence, ask / confirm, or assign a lighter path rather than blindly trusting either source.', 'Nora routing + State Signal'],
  ['Trial is scheduled but athlete is Red', 'Protocol-first or defer based on rules. Do not run the Trial as normal if the state bottleneck is severe.', 'Nora routing'],
  ['Coach locked a specific assignment but athlete is Red', 'Respect coach intent only if it does not violate safety or defer rules. Otherwise route through the override path.', 'Nora routing + Coaching controls'],
  ['Tier 1 escalation with Green readiness', 'Coach-aware performance routing remains active. Do not suppress training unnecessarily.', 'Orchestration'],
  ['Persistent red without safety language', 'Create support visibility, reduce aggressiveness, and do not jump directly to clinical escalation.', 'Support lane'],
  ['Two consecutive deferred days at Tier 0', 'Require fresh same-day signal weighting and prefer a bounded protocol route if one is valid before deferring again.', 'State Signal + Nora'],
  ['Conflicting signals across self-report, sentiment, and performance', 'Lower confidence and prefer confirmatory check rather than decisive routing.', 'State Signal'],
  ['Stale snapshot at time of assignment', 'Refresh or request a quick check-in before high-confidence routing.', 'State Signal + Nora'],
  ['Low protocol responsiveness across repeated sessions', 'Reduce reliance on that protocol, increase staff visibility, and reconsider routing strategy.', 'Nora + Protocol layer'],
];

const ADDITIONAL_SCENARIOS = [
  'Tier 2 or Tier 3 event occurs after a scheduled Sim has already been queued.',
  'Athlete starts Green, becomes Red mid-session, and the runtime must decide whether to stop, downshift, or finish.',
  'Missing biometric feed while other signals imply elevated activation.',
  'No usable self-report but strong context and performance pattern before a game.',
  'Athlete drops out of a Trial after a protocol-first routing decision.',
];

const OUTPUT_RULES = [
  ['Assigned routing', 'Verify the final assignment matches the governing rule for the scenario.'],
  ['Confidence behavior', 'Verify confidence rises or falls in the expected direction when signals conflict or go stale.'],
  ['Visible coach / staff outputs', 'Verify the right lane is visible to staff: performance, support, or safety.'],
  ['Training suppression or continuation', 'Verify the runtime either suppresses or continues normal training flow correctly.'],
  ['Athlete-facing messaging', 'Verify the athlete sees language that matches the selected lane and never diagnostic language.'],
  ['Rule conflict resolution', 'Log conflicts where document rules appear to disagree and resolve them at the Runtime Architecture layer.'],
];

const PulseCheckNoraQaEdgeCaseScenarioMatrixTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Nora QA / Edge-Case Scenario Matrix"
        version="Version 1.0 | March 10, 2026"
        summary="QA artifact for conflict, override, and runtime edge cases in Nora routing and state-aware performance decisions. This page turns architecture edge cases into explicit test scenarios before pilot."
        highlights={[
          {
            title: 'Real Failure Modes, Not Happy Paths',
            body: 'The matrix focuses on cases where state, skill programming, coach intent, and safety status point in different directions.',
          },
          {
            title: 'Expected Behavior Is Explicit',
            body: 'Each scenario names the correct runtime response and primary owner so QA can test the right thing.',
          },
          {
            title: 'Architecture Resolves Conflicts',
            body: 'If scenario testing exposes competing rules, the Runtime Architecture artifact is the place where governance conflicts get resolved.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="QA artifact for runtime conflicts, overrides, and edge cases that can break Nora routing if they are not explicitly tested before pilot."
        sourceOfTruth="This document is authoritative for the scenario classes that QA, engineering, and product should test when runtime rules collide. It does not replace the governing runtime rules themselves."
        masterReference="Use Runtime Architecture to determine which artifact governs a conflict, then use this page to verify the runtime behaves correctly under pressure."
        relatedDocs={[
          'Runtime Architecture v1.0',
          'Nora Assignment Rules v1.1',
          'State Signal Layer v1.2',
          'State & Escalation Orchestration v1.2',
        ]}
      />

      <SectionBlock icon={Shield} title="QA Principles">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Testing Principles"
            body={
              <BulletList
                items={[
                  'Safety overrides come first.',
                  'State routing comes before normal skill progression.',
                  'Coach locks and manual overrides must respect safety and defer rules.',
                  'Low-confidence state should produce more conservative, explainable behavior.',
                ]}
              />
            }
          />
          <InfoCard
            title="Why This Matrix Exists"
            accent="blue"
            body="These are the scenario classes most likely to create production failures because multiple runtime rules are all trying to apply at the same time."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Core Edge-Case Scenarios">
        <DataTable columns={['Scenario', 'Expected Behavior', 'Primary Owner']} rows={SCENARIO_ROWS} />
      </SectionBlock>

      <SectionBlock icon={TestTube2} title="Additional Scenarios to Test">
        <InfoCard title="Expanded QA Queue" accent="amber" body={<BulletList items={ADDITIONAL_SCENARIOS} />} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="QA Outputs">
        <DataTable columns={['Output to Verify', 'What QA Should Confirm']} rows={OUTPUT_RULES} />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Companion Runtime Artifacts">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard title="Nora Assignment Rules" body="Provides the performance-lane behavior QA should expect when scenarios affect assignment decisions." />
          <InfoCard title="State Signal Layer" body="Provides the confidence and freshness logic that should shift behavior under conflicting or stale inputs." />
          <InfoCard title="Runtime Architecture" body="Resolves cross-document conflicts if scenario testing exposes mismatched rules." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Pilot Readiness Note">
        <InfoCard
          title="How to Use Before Hampton"
          accent="red"
          body="Treat this matrix as the pre-pilot QA checklist for runtime conflicts. If a scenario is unresolved, the runtime should be considered under-specified for that edge case."
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckNoraQaEdgeCaseScenarioMatrixTab;
