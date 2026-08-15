import React from 'react';
import EvidenceAlignedSimSpec, { type EvidenceAlignedSimSpecConfig } from './EvidenceAlignedSimSpec';

const config: EvidenceAlignedSimSpecConfig = {
  family: 'Brake Point',
  version: 'Spec v3.0 · August 2026',
  accent: '#22c55e',
  purpose: 'Practice withholding an initiated left/right response when a delayed stop signal appears.',
  task: 'Most trials require a fast left or right response to an arrow. On one quarter of trials, a red stop signal appears after the arrow begins and the athlete must withhold the prepared response. The stop-signal delay adapts after scored stop trials.',
  observedMeasures: [
    'Core for a standard training rep: stop success rate, interpreted beside go accuracy and go response time.',
    'A stop-time estimate is secondary and appears only in a research-length run with at least 150 valid go trials and 50 stop trials that passes every quality check.',
    'Go accuracy, correct go response time, go omissions, stop success, and mean stop-signal delay are reported separately.',
    'Short or assumption-violating sessions do not emit an SSRT estimate.',
  ],
  constructHypothesis: 'The delayed-stop mechanic follows the independent race-model framework used to study response inhibition.',
  transferHypothesis: 'Practice may improve performance on similar stopping tasks. Reduced impulsive errors in sport is a separate, unproven transfer claim.',
  evidenceStatus: 'Paradigm-aligned, product-unvalidated. The task follows established stop-signal principles, but PulseCheck reliability, equivalence, and sport transfer remain untested.',
  scheduleRules: [
    'Four practice trials precede the scored task; 25% of scored trials are stop trials.',
    'Direction and stop-trial allocation are balanced and randomized.',
    'The stop-signal delay begins at 250 ms, changes by 50 ms after valid scored stop trials, and remains between 100 and 700 ms.',
    'Successful withholding increases the next delay; every failed stop response, including an anticipatory response, decreases it.',
    'No Brake button is shown. A successful stop is a withheld response.',
    'Scored trials do not reveal correctness during play.',
  ],
  telemetry: [
    'stop_success_rate as the standard-rep core measure',
    'provisional_ssrt_ms plus ssrt_estimate_available for research-length runs; athlete-facing copy calls this a stop-time estimate',
    'go_accuracy and correct_go_rt_ms',
    'go_omission_rate, go_choice_error_rate, and premature_response_rate',
    'mean_stop_signal_delay_ms, failed_stop_rt_ms, and race_model_check_passed',
    'valid_go_trials, valid_stop_trials, schedule version, and input method',
  ],
  prohibitedInferences: [
    'Do not call the time to press a Brake button stopping latency.',
    'Do not report SSRT when trial counts or race-model quality checks fail.',
    'Do not infer trait impulsivity, diagnosis, safety risk, readiness, or on-field inhibition.',
  ],
  validationRoadmap: [
    'Verify staircase behavior and SSRT integration against published fixtures.',
    'Establish test-retest reliability and convergence with an established stop-signal task.',
    'Run representative sport studies before publishing transfer language.',
  ],
  sources: [
    { citation: 'Logan, Cowan, and Davis (1984), On the ability to inhibit simple and choice reaction time responses.', url: 'https://doi.org/10.1037/0096-1523.10.2.276' },
    { citation: 'Verbruggen et al. (2019), Consensus guide to the stop-signal task.', url: 'https://doi.org/10.7554/eLife.46323' },
  ],
};

const BrakePointSpecTab: React.FC = () => <EvidenceAlignedSimSpec config={config} />;
export default BrakePointSpecTab;
