import React from 'react';
import EvidenceAlignedSimSpec, { type EvidenceAlignedSimSpecConfig } from './EvidenceAlignedSimSpec';

const config: EvidenceAlignedSimSpecConfig = {
  family: 'Sequence Shift',
  version: 'Spec v3.0 · August 2026',
  accent: '#a78bfa',
  purpose: 'Practice switching between two cued classification rules while response keys remain stable.',
  task: 'Each stimulus contains a letter and a number. A cue selects the Letter or Number rule. The left key means vowel or odd; the right key means consonant or even. Balanced scored trials repeat or switch the active rule.',
  observedMeasures: [
    'Core: switch RT cost from artifact-valid correct switch trials minus matched correct repeat trials.',
    'Switch accuracy cost, repeat accuracy, and switch accuracy.',
    'Perseverative errors only on eligible incongruent switch trials, plus timeout and premature-response rates.',
  ],
  constructHypothesis: 'The repeat-versus-switch comparison is aligned with cued task-switching research and engages task-set reconfiguration.',
  transferHypothesis: 'Practice may improve similar cued rule switching. Transfer to audibles, assignments, or play changes is unproven.',
  evidenceStatus: 'Paradigm-informed, product-unvalidated. This runtime is a task-switching task, not a direct working-memory-updating measure.',
  scheduleRules: [
    'Practice each rule before mixed scored trials.',
    'Balance repeat and switch trials and congruent and incongruent stimuli.',
    'Cross-balance rule, response side, repeat or switch status, and congruency.',
    'Use the same 400 ms cue-to-stimulus interval, response keys, and 1800 ms response window across conditions.',
    'Do not identify which response matches the active or previous rule.',
    'Correct-response RT excludes errors, timeouts, and responses below the artifact floor.',
    'Withhold switch response-time cost unless at least eight valid correct repeat trials and eight valid correct switch trials remain.',
  ],
  telemetry: [
    'switch_rt_cost_ms plus availability and valid-trial counts',
    'switch_accuracy_cost, repeat_accuracy, and switch_accuracy',
    'perseverative_error_rate on eligible trials',
    'timeout_rate and premature_response_rate',
    'Schedule version, cue-response interval, input method, and device class',
  ],
  prohibitedInferences: [
    'Do not label this task working-memory capacity or updating unless a distinct updating paradigm is added.',
    'Do not interpret a single switch cost as broad cognitive flexibility, readiness, or sport IQ.',
    'Do not claim task improvement transfers to sport rule changes without representative testing.',
  ],
  validationRoadmap: [
    'Verify balanced schedules and known switch-versus-repeat behavior.',
    'Establish split-half and test-retest reliability with enough valid trials.',
    'Compare with an established cued task-switching paradigm before sport-transfer studies.',
  ],
  sources: [
    { citation: 'Rogers and Monsell (1995), Costs of a predictable switch between simple cognitive tasks.', url: 'https://doi.org/10.1037/0096-3445.124.2.207' },
    { citation: 'Meiran (1996), Reconfiguration of processing mode prior to task performance.', url: 'https://doi.org/10.1037/0278-7393.22.6.1423' },
  ],
};

const SequenceShiftSpecTab: React.FC = () => <EvidenceAlignedSimSpec config={config} />;
export default SequenceShiftSpecTab;
