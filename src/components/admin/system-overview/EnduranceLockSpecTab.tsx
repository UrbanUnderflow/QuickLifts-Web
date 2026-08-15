import React from 'react';
import EvidenceAlignedSimSpec, { type EvidenceAlignedSimSpecConfig } from './EvidenceAlignedSimSpec';

const config: EvidenceAlignedSimSpecConfig = {
  family: 'Endurance Lock',
  version: 'Spec v3.0 · August 2026',
  accent: '#fb923c',
  purpose: 'Observe response speed, variability, lapses, early responses, and timeouts while one task remains constant over time.',
  task: 'After four practice trials, the athlete waits through an unpredictable 1500-3500 ms foreperiod and taps once when the same visual center signal appears. Signal appearance and the 1500 ms response window remain unchanged across six scored blocks.',
  observedMeasures: [
    'Core: fitted correct-response-time change in milliseconds per minute when enough valid responses span enough blocks.',
    'Median correct response time and response-time variability.',
    'Responses at or above the declared 500 ms threshold, false-starts, and timeouts, plus valid-trial counts by block.',
  ],
  constructHypothesis: 'A constant PVT-inspired task can describe sustained-attention performance and time-on-task change within the session.',
  transferHypothesis: 'Practice may improve performance on similar vigilance tasks. Preservation of performance late in practice or competition is unproven.',
  evidenceStatus: 'Adjacent evidence. Vigilance and PVT research informs the task and metrics; this short mobile runtime cannot identify fatigue or its cause.',
  scheduleRules: [
    'Practice and warm-up trials are excluded.',
    'The response rule, signal, display load, and response window remain constant across scored blocks.',
    'Only the foreperiod varies unpredictably.',
    'No simultaneous audio cue is used; measured latency remains tied to visual-signal onset.',
    'Pressure and visual-load variants must be constant for the full session or separately balanced; they cannot appear only at the end.',
    'The slope is a fitted time trend, not a baseline-minus-finish difference divided by a constant.',
    'Withhold the fitted trend unless at least 24 valid responses remain and every scored block contains at least three.',
  ],
  telemetry: [
    'correct_rt_slope_ms_per_min plus slope_estimate_available',
    'median_correct_rt_ms and rt_variability_ms',
    'lapse_rate using the declared 500 ms threshold, false_start_rate, and timeout_rate',
    'Per-block medians and valid-trial counts',
    'Session duration, schedule version, interruption state, input method, and device class',
  ],
  prohibitedInferences: [
    'Do not infer fatigue, sleep loss, boredom, motivation, readiness, or a stable cognitive-endurance trait from one run.',
    'Do not attribute decline to time-on-task when difficulty or display load also changes over time.',
    'Do not claim late-practice or competition transfer without external validation.',
  ],
  validationRoadmap: [
    'Verify timer fidelity, foreperiod distribution, and fitted-slope fixtures.',
    'Assess floor, ceiling, lapse prevalence, split-half behavior, and test-retest reliability.',
    'Test sensitivity under controlled conditions before any causal fatigue interpretation.',
  ],
  sources: [
    { citation: 'Dinges and Powell (1985), Microcomputer analyses of a portable visual reaction-time task during sustained operations.', url: 'https://doi.org/10.3758/BF03200977' },
    { citation: 'Van Dongen et al. (2003), The cumulative cost of additional wakefulness.', url: 'https://doi.org/10.1093/sleep/26.2.117' },
    { citation: 'Owen et al. (2010), Putting brain training to the test.', url: 'https://doi.org/10.1038/nature09042' },
  ],
};

const EnduranceLockSpecTab: React.FC = () => <EvidenceAlignedSimSpec config={config} />;
export default EnduranceLockSpecTab;
