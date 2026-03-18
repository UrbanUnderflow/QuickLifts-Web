import { ExerciseCategory, type PulseCheckProtocolVariant } from './types';

type SeedProtocolVariantSpec = Pick<
  PulseCheckProtocolVariant,
  | 'id'
  | 'familyId'
  | 'label'
  | 'variantKey'
  | 'variantVersion'
  | 'category'
  | 'deliveryMode'
  | 'legacyExerciseId'
  | 'scriptSummary'
  | 'evidenceSummary'
  | 'sourceReferences'
>;

function buildVariantId(familyId: string, variantKey: string) {
  return `${familyId}--${variantKey}`;
}

function spec(
  familyId: string,
  input: Omit<SeedProtocolVariantSpec, 'id' | 'familyId' | 'variantVersion'>
): SeedProtocolVariantSpec {
  return {
    id: buildVariantId(familyId, input.variantKey),
    familyId,
    variantVersion: 'v1',
    ...input,
  };
}

export const SEEDED_PROTOCOL_VARIANT_SPECS: SeedProtocolVariantSpec[] = [
  spec('regulation-acute_downshift', {
    label: 'Physiological Sigh',
    variantKey: 'physiological-sigh',
    category: ExerciseCategory.Breathing,
    deliveryMode: 'guided_breathing',
    legacyExerciseId: 'breathing-physiological-sigh',
    scriptSummary:
      'Five short cycles of double inhale plus extended exhale for acute pre-rep downshift when the athlete needs the fastest possible reduction in respiratory and emotional escalation.',
    evidenceSummary:
      'This specific variant is the strongest acute-downshift expression in the registry because cyclic sighing has direct human trial support for rapidly lowering respiratory rate and perceived distress. It fits the "panic spike / racing heart" use case better than slower paced protocols because it is designed for immediate interruption of escalating arousal.',
    sourceReferences: [
      'Balban MY et al. Brief structured respiration practices enhance mood and reduce physiological arousal. Cell Reports Medicine (2023). PMID: 36630953. https://pubmed.ncbi.nlm.nih.gov/36630953/',
      'Ramirez JM et al. The sigh and related behaviors. Physiology (2022). PMID: 35965032. https://pubmed.ncbi.nlm.nih.gov/35965032/',
    ],
  }),
  spec('regulation-steady_regulation', {
    label: 'Box Breathing',
    variantKey: 'box-breathing',
    category: ExerciseCategory.Breathing,
    deliveryMode: 'guided_breathing',
    legacyExerciseId: 'breathing-box',
    scriptSummary:
      'Equal-phase inhale, hold, exhale, and hold pacing used as a steadier regulation tool when the athlete needs composure without the sharper drop of an emergency sigh.',
    evidenceSummary:
      'Box breathing is best understood as a structured paced-breathing variant inside the broader slow-breathing evidence base. The equal-phase rhythm supports autonomic stability, and it is well matched to between-rep or competition-window use cases where the athlete needs control, not sedation.',
    sourceReferences: [
      'Ma X et al. The Effect of Slow-Paced Breathing on Cardiovascular and Emotion Functions: A Meta-Analysis and Systematic Review. Mindfulness (2023). https://link.springer.com/article/10.1007/s12671-023-02294-2',
      'Joseph CN et al. Slow breathing improves arterial baroreflex sensitivity and decreases blood pressure in essential hypertension. Hypertension (2005). PMID: 16129818. https://pubmed.ncbi.nlm.nih.gov/16129818/',
    ],
  }),
  spec('regulation-focus_narrowing', {
    label: 'Body Scan Awareness',
    variantKey: 'body-scan-awareness',
    category: ExerciseCategory.Focus,
    deliveryMode: 'guided_focus',
    legacyExerciseId: 'focus-body-scan',
    scriptSummary:
      'A head-to-toe guided scan that helps the athlete notice hidden tension, tighten the link between body cues and attention, and release unnecessary muscular noise before technical work.',
    evidenceSummary:
      'This variant has the clearest rationale when the problem is unnamed tension rather than obvious anxiety. Body-scan interventions have been linked with improved interoception and body-awareness outcomes, which makes this a plausible pre-technical reset for athletes who need to detect and clear somatic interference.',
    sourceReferences: [
      'Desmedt O et al. Two weeks to tune in: Evaluating the effects of a short-term body scan on interoception. Applied Psychology: Health and Well-Being (2025). https://pmc.ncbi.nlm.nih.gov/articles/PMC12411690/',
      'Treves IN et al. A meta-analysis of the effects of mindfulness meditation training on self-reported interoception. Scientific Reports (2025). PMID: 41198766. https://pubmed.ncbi.nlm.nih.gov/41198766/',
    ],
  }),
  spec('regulation-cognitive_reframe', {
    label: 'Nerves to Excitement Reframe',
    variantKey: 'nerves-to-excitement-reframe',
    category: ExerciseCategory.Mindset,
    deliveryMode: 'guided_reframe',
    legacyExerciseId: 'mindset-nerves-excitement',
    scriptSummary:
      'A short verbal reappraisal that relabels butterflies and racing physiology as readiness so the athlete can keep the activation and change the interpretation.',
    evidenceSummary:
      'This is the most direct cognitive-reframe variant in the registry. The intervention closely matches the experimental "I am excited" paradigm, which has been shown to improve both subjective state and pressured task performance more effectively than trying to calm down completely.',
    sourceReferences: [
      'Brooks AW. Get excited: reappraising pre-performance anxiety as excitement. Journal of Experimental Psychology: General (2014). PMID: 24364682. https://pubmed.ncbi.nlm.nih.gov/24364682/',
      'Jamieson JP et al. Mind over Matter: Reappraising Arousal Improves Cardiovascular and Cognitive Responses to Stress. Journal of Experimental Psychology: General (2012). https://pmc.ncbi.nlm.nih.gov/articles/PMC3410434/',
      'Moore LJ et al. Reappraising Threat: How to Optimize Performance Under Pressure. Journal of Sport & Exercise Psychology (2015). https://pubmed.ncbi.nlm.nih.gov/26265345/',
    ],
  }),
  spec('priming-activation_upshift', {
    label: 'Activation Breathing',
    variantKey: 'activation-breathing',
    category: ExerciseCategory.Breathing,
    deliveryMode: 'guided_breathing',
    legacyExerciseId: 'breathing-activation',
    scriptSummary:
      'A short inhale-dominant breathing dose for flat or sluggish states where the athlete needs a controlled rise in activation before stepping into effort.',
    evidenceSummary:
      'This variant is appropriate when the athlete is underactivated, but it should stay narrowly scoped. Human evidence shows that breathing can intentionally increase sympathetic drive and catecholamine response, which supports its use as a pre-lift or pre-action energizer rather than as a general-purpose breathing tool.',
    sourceReferences: [
      'Kox M et al. Voluntary activation of the sympathetic nervous system and attenuation of the innate immune response in humans. PNAS (2014). PMID: 24799686. https://pubmed.ncbi.nlm.nih.gov/24799686/',
      'Guyenet PG, Bayliss DA. Regulation of breathing and autonomic outflows by chemoreceptors. Comprehensive Physiology (2015). PMID: 25428853. https://pubmed.ncbi.nlm.nih.gov/25428853/',
    ],
  }),
  spec('priming-focus_narrowing', {
    label: 'Cue Word Anchoring',
    variantKey: 'cue-word-anchoring',
    category: ExerciseCategory.Focus,
    deliveryMode: 'guided_focus',
    legacyExerciseId: 'focus-cue-word',
    scriptSummary:
      'A one-word attentional anchor trained ahead of time, then deployed between attempts or after mistakes to compress focus around the next controllable action.',
    evidenceSummary:
      'This variant is supported by the self-talk literature, especially when the athlete needs a simple instructional cue instead of a long reset. Instructional self-talk tends to help precision and execution tasks, making cue-word anchoring a good fit for between-attempt focus recovery.',
    sourceReferences: [
      'Hatzigeorgiadis A et al. Self-Talk and Sports Performance: A Meta-Analysis. Perspectives on Psychological Science (2015). PMID: 26167788. https://pubmed.ncbi.nlm.nih.gov/26167788/',
      'Wright BJ et al. Enhancing Self-Efficacy and Performance: An Experimental Comparison of Psychological Techniques. Research Quarterly for Exercise and Sport (2016). PMID: 26523398. https://pubmed.ncbi.nlm.nih.gov/26523398/',
      'Hardy J et al. Quantifying athlete self-talk. Journal of Sports Sciences (2005). PMID: 16195042. https://pubmed.ncbi.nlm.nih.gov/16195042/',
    ],
  }),
  spec('priming-imagery_priming', {
    label: 'Perfect Execution Replay',
    variantKey: 'perfect-execution-replay',
    category: ExerciseCategory.Visualization,
    deliveryMode: 'guided_imagery',
    legacyExerciseId: 'viz-perfect-execution',
    scriptSummary:
      'Brief first-person motor imagery that rehearses one clean upcoming movement so the athlete refreshes timing, feel, and technical intent before the real rep.',
    evidenceSummary:
      'This variant is the most execution-specific imagery protocol in the registry. Sport imagery meta-analyses support performance benefits across tasks, and the fit is strongest when the athlete needs to restore a crisp internal model of a movement rather than only boost motivation.',
    sourceReferences: [
      'Liu Y et al. The Effects of Imagery Practice on Athletes\' Performance: A Multilevel Meta-Analysis with Systematic Review. Behavioral Sciences (2025). PMID: 40426460. https://pubmed.ncbi.nlm.nih.gov/40426460/',
      'Toth AJ et al. The effects of imagery interventions in sports: a meta-analysis. International Review of Sport and Exercise Psychology (2020). https://www.tandfonline.com/doi/abs/10.1080/1750984X.2020.1780627',
    ],
  }),
  spec('priming-confidence_priming', {
    label: 'Power Posing',
    variantKey: 'power-posing',
    category: ExerciseCategory.Confidence,
    deliveryMode: 'embodied_reset',
    legacyExerciseId: 'confidence-power-pose',
    scriptSummary:
      'A short expansive-posture reset used as an embodied confidence cue before stepping into a rep, presentation, or high-visibility moment.',
    evidenceSummary:
      'This variant should be treated cautiously and never oversold. The best reading of the literature is that expansive posture can shift subjective feelings of power or readiness for some people, but the stronger hormonal-performance claims are not reliable enough to treat this as a deep confidence intervention on its own.',
    sourceReferences: [
      'Körner R et al. Dominance and Prestige: Meta-Analytic Review of Experimentally Induced Body Position Effects on Behavioral, Self-Report, and Physiological Dependent Variables. Psychological Bulletin (2022). DOI: 10.1037/bul0000356. https://www.researchgate.net/publication/360577810_Dominance_and_prestige_Meta-analytic_review_of_experimentally_induced_body_position_effects_on_behavioral_self-report_and_physiological_dependent_variables',
      'Davis ML et al. A randomized controlled study of power posing before public speaking exposure for social anxiety disorder: No evidence for augmentative effects. Journal of Anxiety Disorders (2017). PMID: 28946020. https://pubmed.ncbi.nlm.nih.gov/28946020/',
      'Peper E et al. Physical Mechanisms of Emotions Evoked by Postural Feedback. Comprehensive Results in Social Psychology (2024). PMID: 40583230. https://pubmed.ncbi.nlm.nih.gov/40583230/',
    ],
  }),
  spec('recovery-recovery_downregulation', {
    label: 'Recovery Breathing',
    variantKey: 'recovery-breathing',
    category: ExerciseCategory.Breathing,
    deliveryMode: 'guided_breathing',
    legacyExerciseId: 'breathing-recovery',
    scriptSummary:
      'A post-load exhale-emphasized recovery pattern designed to help the athlete clear sympathetic carryover and begin recovery physiology sooner.',
    evidenceSummary:
      'This is the default recovery-downregulation variant because it maps directly onto post-exercise breathing evidence. It is a better fit than deeper relaxation protocols when the athlete is coming off load and needs a clean return toward baseline rather than an evening wind-down.',
    sourceReferences: [
      'Vacher P et al. Stress and recovery in sports: Effects on heart rate variability, cortisol, and subjective experience. International Journal of Psychophysiology (2019). PMID: 31255740. https://pubmed.ncbi.nlm.nih.gov/31255740/',
      'Kasprzak Z et al. Post-Exercise Controlled Breathing Enhances Cardiovascular Recovery and Autonomic Balance: A Randomised Crossover Study. Biology (2025). https://pmc.ncbi.nlm.nih.gov/articles/PMC12943789/',
    ],
  }),
  spec('recovery-recovery_downregulation', {
    label: '4-7-8 Relaxation Breathing',
    variantKey: '4-7-8-relaxation-breathing',
    category: ExerciseCategory.Breathing,
    deliveryMode: 'guided_breathing',
    legacyExerciseId: 'breathing-478',
    scriptSummary:
      'A slower exhale-dominant breathing protocol reserved for heavier fatigue, evening recovery, and sleep-sensitive windows where deeper relaxation is appropriate.',
    evidenceSummary:
      'This variant is best positioned as a deeper recovery expression, not the default post-load cooldown. It sits within the broader slow-breathing evidence base and also has direct 4-7-8 breathing-control data showing reductions in heart rate and blood pressure, which makes it a reasonable evening or wind-down option when a stronger relaxation tilt is desired.',
    sourceReferences: [
      'Vierra J et al. Effects of sleep deprivation and 4-7-8 breathing control on heart rate variability, blood pressure, blood glucose, and endothelial function in healthy young adults. Physiological Reports (2022). https://pmc.ncbi.nlm.nih.gov/articles/PMC9277512/',
      'Ma X et al. The Effect of Slow-Paced Breathing on Cardiovascular and Emotion Functions: A Meta-Analysis and Systematic Review. Mindfulness (2023). https://link.springer.com/article/10.1007/s12671-023-02294-2',
      'Breathing Practices for Stress and Anxiety Reduction: Conceptual Framework of Implementation Guidelines Based on a Systematic Review of the Published Literature. (2023). PMID: 38137060. https://pubmed.ncbi.nlm.nih.gov/38137060/',
    ],
  }),
  spec('recovery-recovery_reflection', {
    label: 'Process Over Outcome',
    variantKey: 'process-over-outcome',
    category: ExerciseCategory.Mindset,
    deliveryMode: 'guided_reflection',
    legacyExerciseId: 'mindset-process-focus',
    scriptSummary:
      'A short reflection that redirects attention from result-spiraling toward controllable cues, execution truths, and next-action process anchors.',
    evidenceSummary:
      'This variant is strongest when the athlete is cognitively stuck on outcomes after a miss, competition, or stressful trial. Choking and attentional-control research supports reducing maladaptive self-focus and reallocating attention toward process cues, which fits the intended use of this reflection closely.',
    sourceReferences: [
      'Hill DM et al. Choking under pressure: theoretical models and interventions. Current Opinion in Psychology (2017). https://pubmed.ncbi.nlm.nih.gov/28813345/',
      'Englert C. Attentional processes and choking under pressure. Frontiers in Psychology (2013). https://pubmed.ncbi.nlm.nih.gov/24032339/',
      'Harmes N et al. Written Emotional Disclosure Can Promote Athletes’ Mental Health and Performance Readiness During the COVID-19 Pandemic. Frontiers in Psychology (2020). https://pmc.ncbi.nlm.nih.gov/articles/PMC7728796/',
    ],
  }),
  spec('recovery-recovery_reflection', {
    label: 'Evidence Journal',
    variantKey: 'evidence-journal',
    category: ExerciseCategory.Confidence,
    deliveryMode: 'guided_reflection',
    legacyExerciseId: 'confidence-evidence-journal',
    scriptSummary:
      'A brief written confidence reset that asks the athlete to record concrete proof of preparation, progress, and resilience instead of trusting the loudest current feeling.',
    evidenceSummary:
      'This variant is intentionally more evidence-based and less hype-based than affirmation work. Athlete disclosure research supports structured writing during stressful periods, and the broader expressive-writing literature supports reflection as a mechanism for organizing experience and reducing distress. That makes this a credible recovery-reflection tool when self-doubt is the main drag on recovery posture.',
    sourceReferences: [
      'Harmes N et al. Written Emotional Disclosure Can Promote Athletes’ Mental Health and Performance Readiness During the COVID-19 Pandemic. Frontiers in Psychology (2020). https://pmc.ncbi.nlm.nih.gov/articles/PMC7728796/',
      'Pennebaker JW. Expressive Writing in Psychological Science. Perspectives on Psychological Science (2018). PMID: 28992443. https://pubmed.ncbi.nlm.nih.gov/28992443/',
      'Hill DM et al. Choking under pressure: theoretical models and interventions. Current Opinion in Psychology (2017). https://pubmed.ncbi.nlm.nih.gov/28813345/',
    ],
  }),
];

export function getSeededProtocolVariantSpecById(id: string) {
  return SEEDED_PROTOCOL_VARIANT_SPECS.find((specEntry) => specEntry.id === id) || null;
}
