import React from 'react';
import EvidenceAlignedSimSpec, { type EvidenceAlignedSimSpecConfig } from './EvidenceAlignedSimSpec';

const config: EvidenceAlignedSimSpecConfig = {
  family: 'Reset',
  version: 'Spec v3.0 · August 2026',
  accent: '#ef4444',
  purpose: 'Rehearse a fixed reset-and-return routine after a controlled interruption and observe how the athlete resumes the same task.',
  task: 'The athlete classifies left and right arrows. Each scored pair contains one reference trial and one otherwise matched trial with a controlled interruption followed by a fixed 800 ms reset interval before the arrow appears.',
  observedMeasures: [
    'Core: median within-pair response-time difference for correct post-interruption versus reference responses.',
    'Reference and post-interruption accuracy, accuracy difference, first post-interruption correctness, premature responses, and timeouts remain separate.',
    'Only valid correct matched pairs contribute to the response-time estimate; at least six are required and the fixed reset interval is stored separately.',
  ],
  constructHypothesis: 'The routine engages attentional reorientation and task re-entry after an interruption. Post-error behavior has multiple possible mechanisms, so response speed alone is not treated as better recovery.',
  transferHypothesis: 'Repeated rehearsal may make a personally selected reset routine easier to use after sport disruptions. Transfer to post-error sport behavior has not yet been established.',
  evidenceStatus: 'Adjacent evidence. Post-error and attentional-reorientation research informs the measurement boundary; the PulseCheck routine itself is not clinically or externally validated.',
  scheduleRules: [
    'Use one task and one response rule throughout a scored session.',
    'Practice is labeled and excluded from scoring.',
    'Reference and post-interruption conditions are balanced and their order is counterbalanced within matched pairs.',
    'The pre-target interval is identical in both conditions; the post-interruption condition replaces the neutral hold with a 900 ms interruption and 800 ms reset interval.',
    'Responses below the 150 ms artifact floor and timed-out trials do not contribute to the response-time estimate.',
    'Withhold the response-time estimate unless at least six matched pairs contain valid correct responses in both conditions.',
    'No universal speed target, automatic promotion, readiness label, or resilience score is produced.',
  ],
  telemetry: [
    'post_disruption_reengagement_cost_ms',
    'matched_pair_count plus estimate_available',
    'reference_accuracy and post_disruption_accuracy',
    'post_disruption_accuracy_cost and first_post_disruption_correct_rate',
    'premature_response_rate and timeout_rate',
    'mean_reset_interval_ms',
  ],
  prohibitedInferences: [
    'Do not label the metric emotional recovery time.',
    'Do not infer resilience, mental toughness, clinical state, readiness, or neural recovery.',
    'Do not claim faster task responses transfer to faster recovery after sport mistakes.',
  ],
  validationRoadmap: [
    'Establish timing fidelity and test-retest reliability on the fixed task.',
    'Compare with established post-error measures while prespecifying whether speed, accuracy, or both define adaptation.',
    'Use blinded sport-video coding before making any transfer claim.',
  ],
  sources: [
    { citation: 'Notebaert et al. (2009), Post-error slowing: an orienting account.', url: 'https://doi.org/10.1016/j.cognition.2009.02.002' },
    { citation: 'Dutilh et al. (2012), Testing theories of post-error slowing.', url: 'https://doi.org/10.3758/s13414-011-0243-2' },
  ],
};

const ResetSpecTab: React.FC = () => <EvidenceAlignedSimSpec config={config} />;
export default ResetSpecTab;
