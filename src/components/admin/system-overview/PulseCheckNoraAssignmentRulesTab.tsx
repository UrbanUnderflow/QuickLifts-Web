import React from 'react';
import { AlertTriangle, BrainCircuit, ClipboardList, Compass, Route, Shield, Target, TimerReset } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const INPUT_ROWS = [
  ['Latest valid state snapshot', 'Current state across four dimensions, overall readiness, and confidence.', 'Yes'],
  ['Current escalation status', 'Tier 0 to Tier 3, safety mode, or support visibility state.', 'Yes'],
  ['Program intent', 'Whether today is a probe, training rep, pressure exposure, reassessment, or competition-day support moment.', 'Yes'],
  ['Athlete profile', 'Longer-term strengths, weaknesses, modifier sensitivities, fatigability, and protocol responsiveness.', 'Yes'],
  ['Recent session history', 'Recent exposures and whether family, duration, or difficulty should vary.', 'Yes'],
  ['Schedule / context window', 'Pre-game, post-trial, travel, return-to-play, high-stakes week.', 'Yes'],
  ['Coach assignment / manual constraints', 'Cases where a coach has locked or requested a specific family, duration, or trial window.', 'When present'],
];

const PRECEDENCE = [
  ['1. Safety overrides', 'Tier 2 and Tier 3 suppress normal training flow. Tier 1 introduces coach-aware caution.'],
  ['2. Support visibility', 'Persistent-red patterns can reduce aggressiveness even without clinical escalation.'],
  ['3. State-fit', 'Green / Yellow / Red decides whether the athlete should regulate, prime, recover, train, assess, or defer.'],
  ['4. Program intent', 'Determines whether the day is a probe, skill rep, pressure exposure, reassessment, or support moment.'],
  ['5. Skill targeting', 'Choose the best-fit Sim family when skill is the bottleneck.'],
  ['6. Progression and dose', 'Set variant, difficulty, modifier intensity, and duration.'],
  ['7. Preference and presentation', 'Shape athlete-facing framing without changing the core decision.'],
];

const OUTCOME_CARDS = [
  ['Protocol only', 'Use when current state is clearly the bottleneck and a useful rep is unlikely right now.'],
  ['Sim only', 'Use when state is workable and trainable skill is the main opportunity.'],
  ['Trial only', 'Use only for standardized assessment timing when the athlete is fit to complete it.'],
  ['Protocol -> Sim', 'Use when a short state intervention will likely improve the next rep.'],
  ['Sim -> Protocol', 'Use when the rep is still useful but a downshift or recovery step should follow it.'],
  ['Defer / alternate path', 'Use when state, support, or safety makes a normal assignment inappropriate.'],
];

const ROUTING_ROWS = [
  ['Green', 'Tier 0', 'Sim only or Trial only', 'Proceed with normal assignment logic.'],
  ['Yellow', 'Tier 0', 'Protocol -> Sim', 'Support first; do not overreact.'],
  ['Red', 'Tier 0', 'Protocol only or Defer / alternate path', 'State bottleneck without clinical escalation.'],
  ['Any', 'Tier 1', 'Coach-aware routing; reduce intensity if needed', 'Protocols may be used, but coach review is active.'],
  ['Any', 'Tier 2', 'Pause normal programming', 'Consent-based escalation is primary.'],
  ['Any', 'Tier 3', 'Suspend training flow immediately', 'Safety mode overrides all normal assignments.'],
];

const SUPPORT_AND_STALE_ROWS = [
  ['Persistent red active, Tier 0', 'Reduce aggressiveness, prefer Protocol-first or lighter-load paths, and suppress high-pressure exposure by default.'],
  ['Snapshot stale at assignment time', 'Request a short check-in before assigning a non-trivial Protocol, Sim, or Trial.'],
  ['Low confidence with no fresh self-report', 'Prefer reversible, lower-cost actions rather than aggressive performance routing.'],
  ['Coach lock plus safety conflict', 'Safety wins. The coach lock becomes advisory until the safety override clears.'],
];

const PulseCheckNoraAssignmentRulesTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Nora Assignment Rules"
        version="Version 1.1 | March 10, 2026"
        summary="Execution-layer artifact for how Nora selects the next athlete action. This page formalizes the precedence ladder Nora uses after safety overrides are resolved and translates state, profile, program intent, and recent history into the next best performance move."
        highlights={[
          {
            title: 'State Is a Routing Input',
            body: 'Protocols are assigned when current state is the bottleneck. Sims and Trials are assigned when skill or assessment timing is the bottleneck.',
          },
          {
            title: 'Safety Overrides First',
            body: 'Tier 2 and Tier 3 escalation outcomes suppress normal performance routing before Nora considers any training recommendation.',
          },
          {
            title: 'Performance Language Only',
            body: 'Nora should explain assignments in performance terms rather than diagnostic or clinical language.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Execution-layer performance artifact for how Nora consumes the shared state snapshot, respects safety overrides, and turns athlete state plus program intent into the next best performance action."
        sourceOfTruth="This document is authoritative for performance-lane assignment behavior after safety overrides, lane boundaries, and state-schema interpretation have already been resolved."
        masterReference="Use Runtime Architecture for the top-level map, then use this page as the operational rulebook for real-time assignment decisions."
        relatedDocs={[
          'Runtime Architecture v1.0',
          'State Signal Layer v1.2',
          'Nora QA / Edge-Case Scenario Matrix v1.0',
          'State & Escalation Orchestration v1.2',
          'Escalation Integration Spec v1.1',
        ]}
      />

      <SectionBlock icon={ClipboardList} title="Inputs Nora Must Read Before Assigning">
        <DataTable columns={['Input', 'What It Tells Nora', 'Required']} rows={INPUT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Compass} title="Assignment Precedence Ladder">
        <CardGrid columns="md:grid-cols-2 xl:grid-cols-3">
          {PRECEDENCE.map(([title, body]) => (
            <InfoCard key={title} title={title} body={body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Route} title="Allowed Assignment Outcomes">
        <CardGrid columns="md:grid-cols-2 xl:grid-cols-3">
          {OUTCOME_CARDS.map(([title, body]) => (
            <InfoCard key={title} title={title} body={body} accent="blue" />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Shield} title="Default Routing Matrix">
        <DataTable columns={['Readiness', 'Escalation Status', 'Default Nora Action', 'Notes']} rows={ROUTING_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BrainCircuit} title="Protocol, Sim, and Trial Rules">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Protocol Rules"
            accent="green"
            body={
              <BulletList
                items={[
                  'Assign by protocol class and trigger pattern, not by generic calming content.',
                  'Regulation fits overactivation, frustration, and emotional spillover.',
                  'Priming fits underactivation, flatness, and scattered focus before a useful rep.',
                  'Recovery fits post-load, post-trial, and cognitive depletion states.',
                ]}
              />
            }
          />
          <InfoCard
            title="Sim Rules"
            accent="purple"
            body={
              <BulletList
                items={[
                  'When state is workable and skill is the bottleneck, assign the best-fit family and variant.',
                  'If state and skill bottlenecks both exist, prefer Protocol -> Sim instead of forcing a low-quality rep.',
                  'Yellow plus a high-pressure family should usually mean lighter modifier intensity or shorter duration.',
                  'Red without a trial or coach lock should not produce a normal pressure Sim.',
                ]}
              />
            }
          />
          <InfoCard
            title="Trial Rules"
            accent="amber"
            body={
              <BulletList
                items={[
                  'Trials are standardized assessments, not just harder Sims.',
                  'Assign them only when timing and state fit are both acceptable.',
                  'Yellow may justify a short protocol first if the trial protocol itself stays fixed.',
                  'Tier 2 and Tier 3 suppress Trial assignment completely.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Target} title="Readiness-Aware Decision Stance">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Why Underlying Dimensions Still Matter"
            body="Overall Readiness is only the first routing branch. Nora should preserve the underlying state pattern because an anxious athlete and a cognitively depleted athlete may both appear Yellow, but they should not receive the same next action."
          />
          <InfoCard
            title="Presentation Rule"
            accent="blue"
            body="Preference and presentation can change how an assignment is framed to the athlete, but they should not change the core performance decision once the precedence ladder is resolved."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={TimerReset} title="Confidence and Fallback Behavior">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard title="High Confidence" accent="green" body="Proceed with the default routing outcome when it matches program intent and escalation status." />
          <InfoCard title="Medium Confidence" accent="amber" body="Proceed, but prefer lighter-load options and reversible decisions." />
          <InfoCard title="Low Confidence" accent="red" body="Do not route aggressively on thin evidence. Prefer a brief check-in, lighter assignment, or conservative defer path." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Shield} title="Support Visibility and Stale Snapshot Rules">
        <DataTable columns={['Scenario', 'Required Nora Behavior']} rows={SUPPORT_AND_STALE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Detailed Companion Artifact">
        <InfoCard
          title="Nora QA / Edge-Case Scenario Matrix"
          accent="blue"
          body="Use the QA matrix as the concrete test artifact for the conflict scenarios summarized in this page. It defines expected behavior and ownership for pre-pilot validation."
        />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Assignment Guardrails">
        <InfoCard
          title="Non-Negotiable Rules"
          accent="red"
          body={
            <BulletList
              items={[
                'Tier 2 and Tier 3 never become disguised performance sessions.',
                'Protocols are a performance-state response, not a clinical substitute.',
                'Coach locks and manual constraints can narrow choices but cannot bypass safety.',
                'Nora should never speak in diagnostic language when explaining assignments.',
              ]}
            />
          }
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckNoraAssignmentRulesTab;
