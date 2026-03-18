import React from 'react';
import { Activity, BarChart3, BrainCircuit, Database, MessageCircleMore, ShieldCheck, TimerReset } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const PANEL_ROWS = [
  ['Inventory overview', 'Published runtime count, active family count, restricted/archive counts, and review-cadence due items.'],
  ['Assignment volume', 'Assignments by protocol family, runtime, team, date window, and routing posture.'],
  ['Outcome quality', 'Completion, defer, override, started-but-abandoned, no-signal, and downstream follow-through rates.'],
  ['State effect', 'Readiness delta and direction of post-protocol state movement.'],
  ['Downstream effect', 'Whether the next sim / trial / rep became more useful after the protocol and whether follow-through stayed clean.'],
  ['Negative response watchlist', 'Protocols with unusually high negative or mixed-response posture, especially when downstream follow-through is also poor.'],
  ['Athlete responsiveness rollups', 'Family- and variant-level responsiveness posture by freshness, confidence, state-fit, and negative-response concentration.'],
  ['Practice conversation readiness', 'Whether the protocol can support teach -> practice -> evaluate flow with transcript and scorecard capture.'],
  ['Practice transcript summary', 'Short review line for what Nora and the athlete actually practiced during the session.'],
  ['Practice scorecard', 'Signal awareness, technique fidelity, language quality, shift quality, and coachability.'],
  ['Governance review queue', 'Protocols due for review, protocols with evidence drift, and protocols operating under stale freshness or restrictions.'],
];

const KPI_ROWS = [
  ['Assignment count', 'How often a protocol is entering the runtime decision path.'],
  ['Completion rate', 'Whether athletes actually finish the intervention when assigned.'],
  ['Override / defer rate', 'Whether staff or athletes are rejecting the protocol in practice.'],
  ['Positive / neutral / negative signal mix', 'Whether the protocol appears to help, do little, or backfire.'],
  ['Freshness age', 'How old the latest credible signal is before the system trusts it for launch decisions.'],
  ['Median readiness delta', 'Whether post-protocol readiness tends to improve, hold, or worsen.'],
  ['Downstream execution success rate', 'Whether the next sim or rep is more likely to complete cleanly after the protocol.'],
  ['Negative-response concentration', 'Whether the same runtime keeps producing deferred or overridden outcomes.'],
  ['Practice transcript coverage', 'Whether the system captured a meaningful transcript summary for the practice conversation.'],
  ['Scorecard persistence rate', 'Whether evaluation results survive into assignment audit and evidence surfaces.'],
];

const SLICE_ROWS = [
  ['By family', 'See which intervention lanes are healthy or noisy overall.'],
  ['By runtime variant', 'Catch a bad published runtime even if the broader family is healthy.'],
  ['By readiness / routing posture', 'Understand which protocols work in red, yellow, protocol-only, or protocol-then-sim windows.'],
  ['By team / cohort', 'Detect rollout-specific or pilot-specific behavior shifts.'],
  ['By athlete segment', 'Inspect response patterns without collapsing into one average.'],
];

const ALERT_ROWS = [
  ['Negative response spike', 'Protocol enters review-required or restricted posture.'],
  ['Override / defer anomaly', 'Flag protocol for ops inspection and coach follow-up.'],
  ['Evidence freshness degradation', 'Reduce confidence in governance review and ranking usage until refreshed.'],
  ['Downstream failure pattern', 'Investigate whether the protocol is harming the next sim or preventing execution from carrying forward cleanly.'],
  ['Practice transcript missing', 'Treat the practice conversation as incomplete until a transcript summary or equivalent turn trace exists.'],
  ['Scorecard unavailable', 'Show the protocol as ready for conversation review but not yet review-complete.'],
  ['Large policy mismatch', 'Investigate whether the planner is selecting a poor-fit protocol too often in a given context.'],
  ['Review cadence overdue', 'Push protocol into governance queue before leaving it live indefinitely.'],
];

const PulseCheckProtocolEvidenceDashboardTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Protocol Evidence Dashboard"
        version="Version 0.1 | March 18, 2026"
        summary="Evidence and monitoring artifact for how the protocol system should be measured at launch. This page defines the dashboard panels, KPIs, alert conditions, and slice dimensions required to tell whether live protocols are helping, doing nothing, or causing bad outcomes."
        highlights={[
          {
            title: 'Evidence Must Be Reviewable',
            body: 'If protocol effectiveness only lives in scattered events or intuition, governance will stay too weak for launch.',
          },
          {
            title: 'Runtime Quality Matters More Than Volume',
            body: 'The dashboard should help the team detect harmful or low-value protocols, not just celebrate assignment counts.',
          },
          {
            title: 'Family And Variant Views Both Matter',
            body: 'A healthy family can still contain one runtime expression that performs badly in practice.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Monitoring artifact for protocol evidence health, runtime quality, and governance review posture. It defines what the launch dashboard should surface for product, ops, and review workflows."
        sourceOfTruth="This document is authoritative for the minimum protocol dashboard panels, KPIs, and alert conditions that should exist before launch confidence is claimed."
        masterReference="Use Protocol Registry for inventory context, Protocol Responsiveness Profile Spec for personalization rollups, and Protocol Launch Readiness for go / no-go standards."
        relatedDocs={[
          'Protocol Registry',
          'Protocol Responsiveness Profile Spec',
          'Protocol Launch Readiness',
          'Protocol Ops Runbook',
        ]}
      />

      <SectionBlock icon={BarChart3} title="Required Dashboard Panels">
        <DataTable columns={['Panel', 'What It Should Show']} rows={PANEL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Launch KPIs">
        <DataTable columns={['KPI', 'Why It Matters']} rows={KPI_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Required Slices">
        <DataTable columns={['Slice', 'Use']} rows={SLICE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={TimerReset} title="Alerting And Review Triggers">
        <DataTable columns={['Alert', 'Required Action']} rows={ALERT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={MessageCircleMore} title="Practice Conversation Evidence">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="What The Dashboard Should Surface"
            accent="blue"
            body={
              <BulletList
                items={[
                  'Whether a protocol can support the teach -> practice -> evaluate flow without leaving review surfaces guessing.',
                  'Whether transcript summary and turn-level evidence exist for the latest practice conversation.',
                  'Whether a scorecard was captured for signal awareness, technique fidelity, language quality, shift quality, and coachability.',
                  'Whether practice evidence is fresh enough to trust for launch or needs review.',
                ]}
              />
            }
          />
          <InfoCard
            title="How To Read Gaps"
            accent="amber"
            body={
              <BulletList
                items={[
                  'No transcript summary means the practice session should still be treated as incomplete for review.',
                  'No scorecard means the system has not yet proven it can evaluate applied practice, only instruction.',
                  'Practice readiness should never override registry launch gating or evidence freshness.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={BrainCircuit} title="Dashboard Interpretation Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="What Good Looks Like"
            accent="green"
            body={
              <BulletList
                items={[
                  'Positive signal mix meaningfully outweighs negative signal mix in the target contexts.',
                  'Completion and downstream execution remain healthy without heavy override pressure.',
                  'Evidence freshness stays current enough that planner confidence is not built on stale memory.',
                  'Negative-response concentration remains low instead of clustering around a single runtime variant.',
                ]}
              />
            }
          />
          <InfoCard
            title="What Should Trigger Intervention"
            accent="red"
            body={
              <BulletList
                items={[
                  'A protocol begins to produce mixed or negative posture in the exact window it was designed for.',
                  'One runtime variant is dragging down a family that otherwise looks healthy.',
                  'Evidence volume is low or stale, but the planner is still treating the protocol as confidently usable.',
                  'Downstream execution repeatedly fails to carry cleanly into the next sim or rep.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Launch Principle">
        <InfoCard
          title="Governance-Grade Evidence"
          accent="amber"
          body="The protocol system should not rely on manual spot-checking after launch. The evidence dashboard should make it obvious which protocols deserve wider trust, tighter restriction, or immediate removal."
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckProtocolEvidenceDashboardTab;
