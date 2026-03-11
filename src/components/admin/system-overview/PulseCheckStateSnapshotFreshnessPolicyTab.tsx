import React from 'react';
import { AlertTriangle, Clock3, Database, Gauge, RefreshCw, ShieldCheck } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const FRESHNESS_ROWS = [
  ['Explicit self-report', 'Immediate / most current', 'Best current-state signal when recent'],
  ['Recent performance', '4 hours', 'Useful for training-day routing and acute instability'],
  ['Context', '24 hours', 'Practice / game timing, high-stakes week, post-trial state'],
  ['Conversation sentiment', '12 hours', 'Decay unless superseded by newer explicit input'],
  ['Biometrics', 'Near-real-time when available', 'Interpret using vendor or source timestamp'],
];

const VALIDITY_ROWS = [
  ['Current snapshot', 'At least one high-priority signal is fresh and no stronger newer signal contradicts it.'],
  ['Degraded snapshot', 'Only older signals remain, or fresh signals materially conflict with each other.'],
  ['Refresh required', 'The snapshot is stale before a high-stakes Trial, before Protocol routing off Red state, or before attaching context to a new escalation message.'],
];

const DECAY_ROWS = [
  'Signals decay in influence rather than disappearing instantly once their window passes.',
  'Expired signals may remain in history but should not drive high-confidence routing.',
  'Low-freshness snapshots should push Nora toward asking, confirming, or choosing a lighter path.',
  'Escalation may still use older history, but current-state confidence must reflect recency.',
];

const PulseCheckStateSnapshotFreshnessPolicyTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="State Snapshot Freshness & Decay Policy"
        version="Version 1.0 | March 10, 2026"
        summary="Operational policy artifact for shared recency, validity, and decay rules across Nora and the escalation system. This page turns freshness from a guideline into a runtime rule set."
        highlights={[
          {
            title: 'One Freshness Policy',
            body: 'Performance and safety consumers should not disagree about whether state context is current enough to trust.',
          },
          {
            title: 'Recency Changes Confidence',
            body: 'Older signals do not vanish, but they should lose influence and stop driving high-confidence decisions.',
          },
          {
            title: 'Stale State Must Trigger Safer Behavior',
            body: 'When freshness is low or sources conflict, the system should ask, confirm, or route more conservatively.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Operational policy artifact for state recency, validity, and decay behavior used by both Nora and the escalation system."
        sourceOfTruth="This document is authoritative for freshness windows, degraded-snapshot interpretation, and when runtime consumers must refresh or downgrade confidence because state context is stale."
        masterReference="Use Runtime Architecture for the system map and State Signal Layer for the canonical snapshot schema. Use this page when the question is whether a snapshot is still safe to trust."
        relatedDocs={[
          'Runtime Architecture v1.0',
          'State Signal Layer v1.2',
          'Nora Assignment Rules v1.1',
          'Escalation Integration Spec v1.1',
        ]}
      />

      <SectionBlock icon={ShieldCheck} title="Core Policy">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Freshness Principles"
            body={
              <BulletList
                items={[
                  'One freshness policy applies across performance and safety consumers.',
                  'Explicit self-report is the highest-priority current-state signal when recent.',
                  'Older signals decay in influence rather than disappearing instantly.',
                  'When freshness is low or sources conflict, routing should become more conservative.',
                ]}
              />
            }
          />
          <InfoCard
            title="Why It Exists"
            accent="blue"
            body="This policy prevents one system from routing off stale state while another has already seen fresher evidence. It keeps Nora and escalation synchronized on what counts as current."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Clock3} title="Initial Freshness Windows">
        <DataTable columns={['Signal Source', 'Freshness Window', 'Notes']} rows={FRESHNESS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={RefreshCw} title="Decay Rules">
        <InfoCard title="Shared Decay Logic" accent="amber" body={<BulletList items={DECAY_ROWS} />} />
      </SectionBlock>

      <SectionBlock icon={Gauge} title="Snapshot Validity States">
        <DataTable columns={['State', 'Definition']} rows={VALIDITY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Operational Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Required Runtime Behavior"
            body={
              <BulletList
                items={[
                  'Persist source timestamps in every snapshot.',
                  'Store confidence separately from readiness so low-confidence Green is not treated like strong Green.',
                  'Refresh before high-stakes Trials and before Protocol routing off Red state if the current snapshot is stale.',
                  'When in doubt, ask the athlete rather than assuming.',
                ]}
              />
            }
          />
          <InfoCard
            title="Governance Note"
            accent="green"
            body="These windows are operating defaults for pilot. They should be tuned after real athlete-session volume shows where state context is expiring too aggressively or too slowly."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Companion Runtime Artifacts">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard title="Runtime Architecture" body="Defines how freshness policy fits into the shared runtime sequence and source-of-truth order." />
          <InfoCard title="State Signal Layer" body="Owns the snapshot schema that this freshness policy governs." />
          <InfoCard title="Escalation Integration Spec" body="Defines how stale and fresh snapshots should be treated inside classifier context." />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckStateSnapshotFreshnessPolicyTab;
