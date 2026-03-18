import type { PulseCheckProtocolFamily, PulseCheckProtocolResponseFamily } from './types';

type SeedProtocolFamilySpec = Pick<
  PulseCheckProtocolFamily,
  | 'id'
  | 'label'
  | 'protocolClass'
  | 'responseFamily'
  | 'familyStatus'
  | 'governanceStage'
  | 'mechanismSummary'
  | 'targetBottleneck'
  | 'expectedStateShift'
  | 'evidenceSummary'
  | 'sourceReferences'
>;

function buildFamilyId(
  protocolClass: SeedProtocolFamilySpec['protocolClass'],
  responseFamily: PulseCheckProtocolResponseFamily
) {
  return `${protocolClass}-${responseFamily}`;
}

function spec(
  protocolClass: SeedProtocolFamilySpec['protocolClass'],
  responseFamily: PulseCheckProtocolResponseFamily,
  input: Omit<SeedProtocolFamilySpec, 'id' | 'protocolClass' | 'responseFamily' | 'familyStatus' | 'governanceStage'>
): SeedProtocolFamilySpec {
  return {
    id: buildFamilyId(protocolClass, responseFamily),
    protocolClass,
    responseFamily,
    familyStatus: 'locked',
    governanceStage: 'published',
    ...input,
  };
}

export const SEEDED_PROTOCOL_FAMILY_SPECS: SeedProtocolFamilySpec[] = [
  spec('regulation', 'acute_downshift', {
    label: 'Acute Downshift',
    mechanismSummary:
      'Exhale-weighted respiratory control interrupts escalating autonomic arousal by extending expiration, normalizing breathing rhythm, and rapidly reducing stress spillover.',
    targetBottleneck:
      'Acute overactivation, panic-like respiratory escalation, and racing physiology immediately before or between reps.',
    expectedStateShift:
      'Rapidly reduce respiratory rate and perceived stress so the athlete can return to controllable execution without needing a long reset.',
    evidenceSummary:
      'Exhale-focused breathwork has direct human evidence for fast downregulation. In a randomized 28-day trial, brief structured respiration improved mood and reduced physiological arousal, with cyclic sighing producing the strongest reduction in respiratory rate relative to mindfulness meditation. Sigh physiology research also supports augmented breaths as a built-in reset for gas exchange and arousal control.',
    sourceReferences: [
      'Balban MY et al. Brief structured respiration practices enhance mood and reduce physiological arousal. Cell Reports Medicine (2023). PMID: 36630953. https://pubmed.ncbi.nlm.nih.gov/36630953/',
      'Ramirez JM et al. The sigh and related behaviors. Physiology (2022). PMID: 35965032. https://pubmed.ncbi.nlm.nih.gov/35965032/',
    ],
  }),
  spec('regulation', 'steady_regulation', {
    label: 'Steady Regulation',
    mechanismSummary:
      'Slow, even-paced breathing increases vagal influence and cardiorespiratory stability, helping the athlete stay composed without collapsing usable alertness.',
    targetBottleneck:
      'Sustained anxiety, anger, or mental noise when the athlete needs steadier regulation rather than an emergency downshift.',
    expectedStateShift:
      'Increase autonomic stability, heart-rate control, and emotional composure while preserving enough readiness to keep executing.',
    evidenceSummary:
      'Slow-paced breathing has consistent physiological support for regulation. A recent meta-analysis found immediate increases in HRV along with reductions in heart rate and systolic blood pressure. Controlled slow breathing also improves baroreflex sensitivity, which supports better autonomic control during stress. Box breathing should be treated as one structured paced-breathing format within this broader evidence base.',
    sourceReferences: [
      'Ma X et al. The Effect of Slow-Paced Breathing on Cardiovascular and Emotion Functions: A Meta-Analysis and Systematic Review. Mindfulness (2023). https://link.springer.com/article/10.1007/s12671-023-02294-2',
      'Joseph CN et al. Slow breathing improves arterial baroreflex sensitivity and decreases blood pressure in essential hypertension. Hypertension (2005). PMID: 16129818. https://pubmed.ncbi.nlm.nih.gov/16129818/',
    ],
  }),
  spec('regulation', 'focus_narrowing', {
    label: 'Focus Narrowing',
    mechanismSummary:
      'Interoceptive attention narrows awareness from diffuse threat monitoring toward concrete bodily signals, making tension easier to detect and less likely to run the session.',
    targetBottleneck:
      'Hidden tension, somatic noise, and scattered attention that prevent the athlete from settling into useful execution.',
    expectedStateShift:
      'Shift the athlete from diffuse stress monitoring to precise body awareness and quieter attentional control.',
    evidenceSummary:
      'Body-scan style practices appear to improve interoception and body awareness. Recent short-term intervention work found that daily body-scan practice increased self-reported interoception and several interoceptive outcomes relative to passive control. A broader mindfulness meta-analysis also found small-to-medium gains in self-reported interoception, supporting body-aware grounding as a plausible regulation tool.',
    sourceReferences: [
      'Desmedt O et al. Two weeks to tune in: Evaluating the effects of a short-term body scan on interoception. Applied Psychology: Health and Well-Being (2025). https://pmc.ncbi.nlm.nih.gov/articles/PMC12411690/',
      'Treves IN et al. A meta-analysis of the effects of mindfulness meditation training on self-reported interoception. Scientific Reports (2025). PMID: 41198766. https://pubmed.ncbi.nlm.nih.gov/41198766/',
    ],
  }),
  spec('regulation', 'cognitive_reframe', {
    label: 'Cognitive Reframe',
    mechanismSummary:
      'Cognitive reappraisal changes the meaning of arousal from threat to challenge, preserving usable activation while changing how the athlete interprets it.',
    targetBottleneck:
      'Pre-performance nerves, catastrophic interpretation of normal arousal, and pressure appraisal that turns readiness into threat.',
    expectedStateShift:
      'Maintain competitive activation while shifting the athlete into a challenge-oriented, performance-usable appraisal.',
    evidenceSummary:
      'Reappraisal has direct performance evidence. In pre-performance experiments, telling participants to reinterpret anxiety as excitement improved both subjective state and objective performance. Related challenge-threat work also shows that reappraising arousal can produce a more adaptive cardiovascular profile and better motor performance under pressure.',
    sourceReferences: [
      'Brooks AW. Get excited: reappraising pre-performance anxiety as excitement. Journal of Experimental Psychology: General (2014). PMID: 24364682. https://pubmed.ncbi.nlm.nih.gov/24364682/',
      'Moore LJ et al. Reappraising Threat: How to Optimize Performance Under Pressure. Journal of Sport & Exercise Psychology (2015). https://pubmed.ncbi.nlm.nih.gov/26265345/',
      'Jamieson JP et al. Mind over Matter: Reappraising Arousal Improves Cardiovascular and Cognitive Responses to Stress. Journal of Experimental Psychology: General (2012). https://pmc.ncbi.nlm.nih.gov/articles/PMC3410434/',
    ],
  }),
  spec('priming', 'activation_upshift', {
    label: 'Activation Upshift',
    mechanismSummary:
      'Inhale-dominant respiratory loading increases sympathetic drive and subjective activation, making it useful when the athlete is flat rather than overloaded.',
    targetBottleneck:
      'Underactivation, low energy, and sluggish readiness when the athlete needs to step up into a rep instead of calm down.',
    expectedStateShift:
      'Increase physiological activation and action-readiness without relying on external stimulants.',
    evidenceSummary:
      'The evidence for activation breathing is more mechanistic than performance-outcome specific, but it is still meaningful. Breathwork protocols that include cyclic hyperventilation and retention can increase epinephrine and sympathetic activation in humans, demonstrating that breathing can be used not only to calm the system but also to deliberately upshift it. Because fast-breathing effects differ from slow-breathing recovery effects, this family should be treated as a narrow priming tool for flat states rather than a general-purpose intervention.',
    sourceReferences: [
      'Kox M et al. Voluntary activation of the sympathetic nervous system and attenuation of the innate immune response in humans. PNAS (2014). PMID: 24799686. https://pubmed.ncbi.nlm.nih.gov/24799686/',
      'Guyenet PG, Bayliss DA. Regulation of breathing and autonomic outflows by chemoreceptors. Comprehensive Physiology (2015). PMID: 25428853. https://pubmed.ncbi.nlm.nih.gov/25428853/',
    ],
  }),
  spec('priming', 'focus_narrowing', {
    label: 'Focus Narrowing',
    mechanismSummary:
      'Instructional self-talk and cue-word anchoring compress attention around one task-relevant directive, reducing distraction and simplifying the next action.',
    targetBottleneck:
      'Scattered focus, between-attempt drift, and overthinking when the athlete needs one clean attentional anchor.',
    expectedStateShift:
      'Condense the athlete’s focus around one controllable cue and improve immediate attentional discipline before the next rep.',
    evidenceSummary:
      'Cue-based attentional priming is supported by the self-talk literature. Meta-analytic sport evidence shows that self-talk interventions improve task performance, with instructional self-talk especially helpful for fine-motor and precision demands. Experimental work also suggests instructional self-statements can outperform imagery and several other psychological techniques on task performance.',
    sourceReferences: [
      'Hatzigeorgiadis A et al. Self-Talk and Sports Performance: A Meta-Analysis. Perspectives on Psychological Science (2015). PMID: 26167788. https://pubmed.ncbi.nlm.nih.gov/26167788/',
      'Wright BJ et al. Enhancing Self-Efficacy and Performance: An Experimental Comparison of Psychological Techniques. Research Quarterly for Exercise and Sport (2016). PMID: 26523398. https://pubmed.ncbi.nlm.nih.gov/26523398/',
    ],
  }),
  spec('priming', 'imagery_priming', {
    label: 'Imagery Priming',
    mechanismSummary:
      'Motor imagery activates task-relevant sensorimotor representations before execution, helping the athlete refresh the intended movement pattern without physical load.',
    targetBottleneck:
      'Technical rust, confidence wobble, and weak pre-rep representation of the intended movement.',
    expectedStateShift:
      'Strengthen the athlete’s internal model of the upcoming action so execution feels more familiar and prepared.',
    evidenceSummary:
      'Imagery has a strong sport-psychology evidence base. A recent multilevel meta-analysis found that imagery practice improves athletic performance across multiple outcomes and sports, with stronger gains when it is integrated into a broader psychological-skills package. The family should therefore be treated as a legitimate priming lane rather than a motivational add-on.',
    sourceReferences: [
      'Liu Y et al. The Effects of Imagery Practice on Athletes\' Performance: A Multilevel Meta-Analysis with Systematic Review. Behavioral Sciences (2025). PMID: 40426460. https://pubmed.ncbi.nlm.nih.gov/40426460/',
      'Toth AJ et al. The effects of imagery interventions in sports: a meta-analysis. International Review of Sport and Exercise Psychology (2020). https://www.tandfonline.com/doi/abs/10.1080/1750984X.2020.1780627',
    ],
  }),
  spec('priming', 'confidence_priming', {
    label: 'Confidence Priming',
    mechanismSummary:
      'Embodied-confidence cues use posture and self-presentation to alter subjective readiness, but they should be treated as low-dose state nudges rather than as deep confidence builders on their own.',
    targetBottleneck:
      'Low presence, hesitation, and reduced felt readiness when the athlete needs a short embodied cue before stepping in.',
    expectedStateShift:
      'Increase subjective feelings of readiness and presence enough to help the athlete commit to action.',
    evidenceSummary:
      'The confidence-priming evidence base is more mixed than the breathing, self-talk, or imagery families. Recent posture-feedback work suggests body position can influence mood-related outcomes, but the older power-posing literature has important replication problems and at least one randomized trial found no meaningful augmentative effect. For launch, this family should be framed conservatively: a brief embodied cue that may help subjective readiness, not a stand-alone confidence treatment.',
    sourceReferences: [
      'Körner R et al. Dominance and Prestige: Meta-Analytic Review of Experimentally Induced Body Position Effects on Behavioral, Self-Report, and Physiological Dependent Variables. Psychological Bulletin (2022). DOI: 10.1037/bul0000356. https://www.researchgate.net/publication/360577810_Dominance_and_prestige_Meta-analytic_review_of_experimentally_induced_body_position_effects_on_behavioral_self-report_and_physiological_dependent_variables',
      'Davis ML et al. A randomized controlled study of power posing before public speaking exposure for social anxiety disorder: No evidence for augmentative effects. Journal of Anxiety Disorders (2017). PMID: 28946020. https://pubmed.ncbi.nlm.nih.gov/28946020/',
      'Peper E et al. Physical Mechanisms of Emotions Evoked by Postural Feedback. Comprehensive Results in Social Psychology (2024). PMID: 40583230. https://pubmed.ncbi.nlm.nih.gov/40583230/',
    ],
  }),
  spec('recovery', 'recovery_downregulation', {
    label: 'Recovery Downregulation',
    mechanismSummary:
      'Exhale-dominant breathing supports post-load parasympathetic recovery, helping the athlete transition from performance arousal into recovery physiology.',
    targetBottleneck:
      'Post-load sympathetic carryover, poor downregulation, and difficulty exiting competition or heavy training cleanly.',
    expectedStateShift:
      'Improve the downshift from exertion toward recovery by supporting autonomic balance and cardiorespiratory settling.',
    evidenceSummary:
      'Breathing-based recovery is supported by both athlete-monitoring and controlled-breathing literature. In sport settings, HRV and cortisol-linked recovery markers track training load and recovery state. Experimental work also shows that structured post-exercise breathing can meaningfully alter short-term cardiovascular recovery dynamics. This family therefore has a plausible physiological rationale for post-load recovery support, especially when framed as a recovery-state transition tool rather than a cure-all.',
    sourceReferences: [
      'Vacher P et al. Stress and recovery in sports: Effects on heart rate variability, cortisol, and subjective experience. International Journal of Psychophysiology (2019). PMID: 31255740. https://pubmed.ncbi.nlm.nih.gov/31255740/',
      'Kasprzak Z et al. Post-Exercise Controlled Breathing Enhances Cardiovascular Recovery and Autonomic Balance: A Randomised Crossover Study. Biology (2025). https://pmc.ncbi.nlm.nih.gov/articles/PMC12943789/',
    ],
  }),
  spec('recovery', 'recovery_reflection', {
    label: 'Recovery Reflection',
    mechanismSummary:
      'Structured reflection moves the athlete out of rumination and toward evidence, controllable process cues, and constructive meaning-making after setbacks or demanding sessions.',
    targetBottleneck:
      'Outcome rumination, self-doubt, and maladaptive post-session narratives that prolong distress and delay recovery.',
    expectedStateShift:
      'Reduce spiraling and restore a more grounded, process-oriented recovery posture built on evidence and controllables.',
    evidenceSummary:
      'This family sits at the intersection of reflective writing and process-focused coping. Written emotional disclosure work in athletes suggests structured writing can improve self-awareness, acceptance, and performance readiness during stressful periods. Choking-under-pressure research also supports interventions that reduce maladaptive self-focus and redirect attention toward more adaptive process cues. Taken together, the evidence supports reflective recovery as a useful post-load intervention when the athlete is cognitively stuck rather than physiologically overactivated.',
    sourceReferences: [
      'Harmes N et al. Written Emotional Disclosure Can Promote Athletes’ Mental Health and Performance Readiness During the COVID-19 Pandemic. Frontiers in Psychology (2020). https://pmc.ncbi.nlm.nih.gov/articles/PMC7728796/',
      'Hill DM et al. Choking under pressure: theoretical models and interventions. Current Opinion in Psychology (2017). https://pubmed.ncbi.nlm.nih.gov/28813345/',
      'Englert C. Attentional processes and choking under pressure. Frontiers in Psychology (2013). https://pubmed.ncbi.nlm.nih.gov/24032339/',
    ],
  }),
];

export function getSeededProtocolFamilySpecById(id: string) {
  return SEEDED_PROTOCOL_FAMILY_SPECS.find((specEntry) => specEntry.id === id) || null;
}
