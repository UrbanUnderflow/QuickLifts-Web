import React from 'react';
import { AlertTriangle, GitBranch, LayoutPanelTop, Shield, Split, Users, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const POSITION_ROWS = [
  ['Shared layer', 'State Signal Layer', 'Self-report, sentiment, biometrics, performance, context'],
  ['Performance lane', 'Protocol / Sim / Trial Orchestrator', 'Train, prime, regulate, recover, assess'],
  ['Safety lane', 'Escalation Orchestrator', 'Monitor, notify, consent, handoff, resolve'],
];

const DECISION_ROWS = [
  ['Green + Tier 0', 'Proceed with assigned Sim / Trial', 'No escalation'],
  ['Yellow + Tier 0', 'Short Protocol first, then Sim if trainable', 'No escalation'],
  ['Red + Tier 0', 'Protocol only, recovery path, or defer training', 'No clinical escalation by default'],
  ['Any state + Tier 1', 'Coach-aware routing; lower intensity if needed', 'Coach notification / monitor-only'],
  ['Any state + Tier 2', 'Pause normal programming; clinical handoff path', 'Consent-based escalation + coach notify'],
  ['Any state + Tier 3', 'Suspend training flow immediately', 'Immediate safety mode + AuntEDNA handoff'],
];

const DASHBOARD_ROWS = [
  ['State / readiness', 'Green / Yellow / Red distribution, sentiment and fatigue trends, protocol demand', 'Shows how the roster is trending right now'],
  ['Performance / profile', 'Skill trends, family scores, modifier sensitivities, sim and trial outputs', 'Shows what the athlete is good at and where they are improving'],
  ['Escalation / safety', 'Tier events, active escalations, support flags, handoff status', 'Shows when staff or clinical action is needed'],
];

const SUPPORT_DEFAULT_ROWS = [
  ['Activation rule', 'Use one global default to start: persistent red activates after 3 consecutive red snapshots or 4 red snapshots within the latest 7 state-bearing sessions.'],
  ['Clear rule', 'Clear the support flag after 2 consecutive non-red snapshots and no active Tier 1-3 escalation state.'],
  ['Programming effect', 'High-pressure exposure, max-intensity modifiers, and Trial scheduling should be reduced or deferred while the support flag is active unless explicitly staff-approved.'],
  ['Escalation handoff rule', 'If support visibility is active and explicit safety language or elevated-risk admin conditions appear, the safety lane immediately takes over.'],
];

const PulseCheckStateEscalationOrchestrationTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="State & Escalation Orchestration"
        version="Version 1.2 | March 10, 2026"
        summary="Architecture-layer artifact for how the shared State Signal Layer feeds the performance lane, support visibility lane, and safety lane without collapsing those responsibilities into a single severity system."
        highlights={[
          {
            title: 'Lane Boundaries Are Explicit',
            body: 'State is shared upstream context. Protocol / Sim / Trial orchestration is the performance lane. Escalation remains the safety lane.',
          },
          {
            title: 'Support Visibility Is Its Own Response',
            body: 'Persistent red creates a middle path between ordinary low-readiness days and clinical escalation.',
          },
          {
            title: 'Safety Authority Stays Intact',
            body: 'Admin-defined escalation conditions, consent flow, coach notification, and AuntEDNA handoff remain the hard safety policy layer.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Architecture-layer integration artifact for lane boundaries, lane interactions, override hierarchy, and the distinction between performance response, support visibility response, and safety response."
        sourceOfTruth="This document is authoritative when state, Protocol, support visibility, and escalation logic intersect and a team needs the governing lane boundary or override rule."
        masterReference="Use Runtime Architecture for the top-level system map, then use this page to resolve conflicts between performance, support, and safety responsibilities."
        relatedDocs={[
          'Runtime Architecture v1.0',
          'State Signal Layer v1.2',
          'Nora Assignment Rules v1.1',
          'Escalation Integration Spec v1.1',
        ]}
      />

      <SectionBlock icon={Split} title="Architectural Position">
        <DataTable columns={['Layer', 'System', 'Primary Job']} rows={POSITION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Shield} title="What Stays Unchanged">
        <InfoCard
          title="Safety Continuity"
          accent="red"
          body={
            <BulletList
              items={[
                'Admin-defined escalation conditions remain the hard safety policy layer.',
                'Tiering, coach notification, consent flow, and AuntEDNA handoff still follow the existing escalation protocol.',
                'Protocols do not become safety interventions and clinical escalation does not become performance support.',
                'Sims still train measurable skills, Trials still test transfer, and Protocols still regulate, prime, or stabilize state.',
              ]}
            />
          }
        />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Dual-Lane Routing Model">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Performance Lane"
            accent="green"
            body={
              <BulletList
                items={[
                  'If trainable skill is the bottleneck, assign the right Sim or Trial.',
                  'If current state is the bottleneck, assign the right Protocol, mixed sequence, recovery path, or defer path.',
                  'State should influence family choice, modifier intensity, duration, and interpretation of performance on that day.',
                ]}
              />
            }
          />
          <InfoCard
            title="Safety Lane"
            accent="red"
            body={
              <BulletList
                items={[
                  'Escalation conditions remain the hard safety policy layer.',
                  'The state snapshot can strengthen or weaken classifier confidence, but it does not replace explicit tier logic.',
                  'Tier 2 and Tier 3 outputs override normal training flow.',
                  'Protocols may be supportive after escalation, but they must never become the primary response to a safety event.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Decision Matrix">
        <DataTable columns={['State / Tier', 'Performance Action', 'Safety Action']} rows={DECISION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Users} title="Persistent-Red Support Logic">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard title="Trigger" accent="amber" body="Use one global pilot default: 3 consecutive red snapshots or 4 red snapshots within the latest 7 state-bearing sessions." />
          <InfoCard title="Response" accent="green" body="Elevate coach or support-staff visibility, recommend human follow-up, reduce programming aggressiveness, and track whether the pattern resolves." />
          <InfoCard title="Boundary" accent="red" body="Persistent red is a support flag, not a diagnosis and not an AuntEDNA handoff by default." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Support-Lane Defaults Locked for Pilot">
        <DataTable columns={['Policy', 'Operating Default']} rows={SUPPORT_DEFAULT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Integration With the Current Escalation Stack">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Existing Components to Preserve"
            body={
              <BulletList
                items={[
                  'classify-escalation for message classification against admin-defined conditions',
                  'pulsecheck-escalation for record creation, consent, clinical handoff, coach notification, and resolution',
                  'Firestore collections including escalation-conditions, escalation-records, conversations, notifications, athlete-coach-connections, and user-mental-notes',
                  'Tier 2 consent logic and Tier 3 immediate safety mode plus handoff',
                ]}
              />
            }
          />
          <InfoCard
            title="Recommended Orchestration Changes"
            accent="blue"
            body={
              <BulletList
                items={[
                  'Persist a state snapshot before or alongside training and conversation events.',
                  'Pass a compact stateSnapshot block or stateSnapshotId into classify-escalation.',
                  'Let classify-escalation use state context in addition to message history and mental notes.',
                  'Write escalation outcomes back into Nora routing context so Tier 2 and Tier 3 suppress normal assignments.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={LayoutPanelTop} title="Coach-Facing Dashboard Separation">
        <DataTable columns={['Panel', 'What It Shows', 'Why It Matters']} rows={DASHBOARD_ROWS} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckStateEscalationOrchestrationTab;
