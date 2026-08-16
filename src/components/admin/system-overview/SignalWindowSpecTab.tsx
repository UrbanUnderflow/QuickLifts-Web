import React from 'react';
import EvidenceAlignedSimSpec, { type EvidenceAlignedSimSpecConfig } from './EvidenceAlignedSimSpec';

const config: EvidenceAlignedSimSpecConfig = {
  family: 'Signal Window',
  version: 'Spec v3.1 · August 2026',
  accent: '#38bdf8',
  purpose: 'Practice a two-alternative perceptual decision while visual evidence is brief and varies in strength.',
  task: 'Nine arrows appear. Five, six, or seven arrows point in the target direction and the remainder point the other way. The athlete selects the majority direction using fixed left/right response keys, and response time starts at arrow-field onset.',
  observedMeasures: [
    'Core pair: decision accuracy and correct-response time. Neither is collapsed into a hidden speed-weighted score.',
    'Accuracy and correct-response time by evidence level, with response-time summaries withheld when valid correct samples are too small.',
    'Wrong-choice, timeout, and premature-response rates remain separate.',
  ],
  constructHypothesis: 'Controlled evidence strength engages a brief visual discrimination and perceptual decision process.',
  transferHypothesis: 'Practice may improve similar majority-direction discriminations. It does not establish faster or better sport decisions.',
  evidenceStatus: 'Adjacent evidence. Psychophysics supports the evidence-strength manipulation; the PulseCheck task and any sport transfer are not externally validated.',
  scheduleRules: [
    'Four practice trials precede scored trials.',
    'The decision instruction is visible before the field appears. Practice uses a 2,000 ms field and 4,000 ms total response window; scored trials use a 1,400 ms field and 3,000 ms total response window.',
    'Target direction and 5/9, 6/9, and 7/9 evidence levels are balanced.',
    'Response keys are available while the field is visible; hiding the field does not restart the response clock.',
    'Response mapping and response window remain constant within the scored session.',
    'Trial order is randomized; difficulty does not simply increase with time.',
    'Option labels, order, styling, and accessibility text cannot reveal the answer.',
    'Overall correct-response time requires at least six valid correct responses; each evidence-level response-time summary requires at least two.',
  ],
  telemetry: [
    'decision_accuracy and correct_decision_rt_ms',
    'wrong_choice_rate, timeout_rate, and premature_response_rate',
    'evidence_5_accuracy, evidence_6_accuracy, and evidence_7_accuracy',
    'Correct-response RT by evidence level, schedule version, and input method',
  ],
  prohibitedInferences: [
    'Do not call a wrong response decoy susceptibility without a separately manipulated and validated decoy condition.',
    'Do not infer sport vision, tactical intelligence, readiness, or game-day decision quality.',
    'Do not use an arbitrary combined accuracy-latency score as a cognitive measure.',
  ],
  validationRoadmap: [
    'Confirm psychometric ordering across evidence levels and check floor and ceiling effects.',
    'Establish reliability for accuracy and correct-response-time summaries.',
    'Compare with representative sport decisions only after the task itself is stable.',
  ],
  sources: [
    { citation: 'Palmer, Huk, and Shadlen (2005), The effect of stimulus strength on speed and accuracy of a perceptual decision.', url: 'https://doi.org/10.1167/5.5.1' },
    { citation: 'Owen et al. (2010), Putting brain training to the test.', url: 'https://doi.org/10.1038/nature09042' },
  ],
};

const SignalWindowSpecTab: React.FC = () => <EvidenceAlignedSimSpec config={config} />;
export default SignalWindowSpecTab;
