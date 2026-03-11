import React from 'react';
import { Activity, BarChart3, Flag, GitBranch, Layers3, ShieldCheck } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const FLAG_ROWS = [
  ['Reset', 'False-start spike; widened Recovery Time variance; unusually slow first-block stabilization', 'Overactivation, emotional load, unstable composure'],
  ['Noise Gate', 'Distractor-cost spike; false-alarm spike; sudden cross-channel drop', 'Scattered attention, overstimulation, low focus readiness'],
  ['Brake Point', 'Stop-failure spike; commission-error jump; premature response burst', 'Overactivation, impatience, poor inhibitory readiness'],
  ['Signal Window', 'Correct-read drop under normal time windows; decoy error spike', 'Attentional scatter, decision fog, rising pressure sensitivity'],
  ['Sequence Shift', 'Old-rule intrusion spike; delayed stabilization after rule changes', 'Cognitive fatigue, reduced flexibility, low shift readiness'],
  ['Endurance Lock', 'Degradation onset earlier than baseline; volatility rise late in session', 'Mental fatigue, poor readiness, reduced recovery capacity'],
];

const INTERPRETATION_RULES = [
  ['Acute instability', 'Current-session behavior deviates sharply from the athlete’s recent norm.'],
  ['Cross-family dip', 'Multiple families degrade on the same day, suggesting state more than skill.'],
  ['Modifier sensitivity spike', 'A sudden worsening under evaluative threat, distraction, ambiguity, or fatigue load.'],
  ['Decay rule', 'State flags should decay over time unless reinforced by new evidence.'],
];

const GOVERNING_ROWS = [
  'Flags are for state inference, not athlete labeling.',
  'Compare current-session behavior to the athlete’s own rolling baseline wherever possible.',
  'A single flag should rarely drive routing by itself; confidence should increase when multiple signals align.',
  'Flags do not override hard safety policy.',
];

const PulseCheckPerformanceStateFlagDefinitionsTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Performance-State Flag Definitions"
        version="Version 1.0 | March 10, 2026"
        summary="Operational inference artifact for converting acute sim behavior into state flags. This page defines which family-level session patterns should be interpreted as state signals rather than long-term skill deficits."
        highlights={[
          {
            title: 'Telemetry Becomes State Context',
            body: 'These flags let the system use acute sim behavior as input to state inference instead of treating every bad rep as a skill problem.',
          },
          {
            title: 'Baseline Before Population',
            body: 'The default comparison is the athlete’s own rolling baseline rather than a generic cohort norm.',
          },
          {
            title: 'Flags Inform, Not Override',
            body: 'These signals feed confidence and routing, but they do not replace self-report, context, or hard safety policy.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Operational inference artifact for family-level acute behavior patterns that feed the State Signal Layer and inform Nora about whether a problem looks like state or skill."
        sourceOfTruth="This document is authoritative for the semantic meaning of performance-state flags at the family level. It governs what the flags mean, not the underlying raw metric collection rules."
        masterReference="Use Runtime Architecture for the system map, State Signal Layer for snapshot schema, and this page when deciding how session telemetry should be translated into state evidence."
        relatedDocs={[
          'Runtime Architecture v1.0',
          'State Signal Layer v1.2',
          'Nora Assignment Rules v1.1',
          'Sim Specification Standards Addendum',
        ]}
      />

      <SectionBlock icon={ShieldCheck} title="Governing Use">
        <InfoCard title="Flag Discipline" accent="blue" body={<BulletList items={GOVERNING_ROWS} />} />
      </SectionBlock>

      <SectionBlock icon={Flag} title="Family-Level Flag Patterns">
        <DataTable columns={['Family', 'Primary Acute Flags', 'Likely State Interpretation']} rows={FLAG_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Interpretation Rules">
        <DataTable columns={['Rule', 'Meaning']} rows={INTERPRETATION_RULES} />
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Initial Operating Guidance">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard title="Pilot Thresholds" accent="amber" body="Start with conservative thresholds during pilot and tune them only after enough valid athlete-session volume exists." />
          <InfoCard title="Low-History Athletes" accent="green" body="When the athlete lacks enough history, use softer confidence and lean more heavily on self-report and context." />
          <InfoCard title="Separation of Concerns" accent="purple" body="This page does not replace the Standards Addendum or raw family metric definitions. It interprets those measurements at the state layer." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Layers3} title="Relationship to Other Artifacts">
        <DataTable
          columns={['Relationship', 'Artifact']}
          rows={[
            ['Feeds', 'State Signal Layer v1.2'],
            ['Consumed by', 'Nora Assignment Rules v1.1'],
            ['Framed by', 'Runtime Architecture v1.0'],
            ['Does not replace', 'Sim Specification Standards Addendum or family metric definitions'],
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Companion Runtime Artifacts">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard title="Runtime Architecture" body="Defines where family-level state flags sit inside the full perception-to-action sequence." />
          <InfoCard title="State Signal Layer" body="Consumes these flags as part of state inference and confidence building." />
          <InfoCard title="Nora Assignment Rules" body="Uses the resulting state evidence to decide whether performance or state is the true bottleneck." />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckPerformanceStateFlagDefinitionsTab;
