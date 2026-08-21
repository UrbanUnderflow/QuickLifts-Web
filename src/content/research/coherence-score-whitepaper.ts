export const COHERENCE_SCORE_METHOD_VERSION = '2.2.2';
export const COHERENCE_SCORE_PUBLICATION_DATE = 'August 21, 2026';

export const COHERENCE_SCORE_WHITE_PAPER_SLUG =
  'coherence-score-methodology-evidence-and-validation';

export const COHERENCE_SCORE_WHITE_PAPER_METADATA = {
  title: 'The PulseCheck Coherence Score System: Methodology, Evidence, and Validation',
  subtitle:
    'The scientific basis, exact calculations, source-normalization rules, governance, and validation plan for Coherence, Wellbeing, Recovery, and Adherence.',
  excerpt:
    'A methods white paper defining the four PulseCheck scores, the evidence each score can support, the information each score excludes, and the validation still required.',
  category: 'Performance Science',
  author: 'Tremaine Grant',
  authorTitle: 'Founder of Pulse Intelligence Labs',
  readTime: '24 min read',
  contentType: 'white-paper' as const,
  featured: false,
  status: 'published' as const,
  createdAt: '2026-08-16T12:00:00.000Z',
  updatedAt: '2026-08-18T12:00:00.000Z',
  publishedAt: '2026-08-16T12:00:00.000Z',
  featuredImage: '/pulsecheck-pro/hero-athletes.webp',
};

export type ScoreAccent = 'lime' | 'mint' | 'blue' | 'amber';

export interface ScoreDefinition {
  key: 'coherence' | 'wellbeing' | 'recovery' | 'adherence';
  label: string;
  accent: ScoreAccent;
  question: string;
  summary: string;
  equation: string;
  inputs: string[];
  excludes: string[];
  minimumEvidence: string;
}

export const scoreDefinitions: ScoreDefinition[] = [
  {
    key: 'coherence',
    label: 'Coherence',
    accent: 'lime',
    question: 'How strong is the athlete\'s recent pattern across Wellbeing, Recovery, and follow-through?',
    summary:
      'Coherence is a continuous formative index with a 90-percent state core and a bounded 10-percent behavioral contribution. Wellbeing and Recovery remain the dominant read, while Adherence allows verified follow-through to matter without turning Coherence into a compliance grade. It is not a statistical correlation or a measure of obedience. The latest 14 days update the athlete\'s established read rather than restarting it.',
    equation: 'Current Coherence = round(0.45(Wellbeing) + 0.45(Recovery) + 0.10(Adherence))',
    inputs: [
      'Wellbeing = the current Wellbeing score for the same 14-day window',
      'Recovery = the current Recovery score for the same 14-day window',
      'Adherence = scheduled check-in completion and verified commitment follow-through for the same 14-day window',
      'Both Wellbeing and Recovery must be independently available to compute a current-window value',
      'When Adherence is unavailable, the valid Wellbeing and Recovery inputs are reweighted equally and evidence coverage reflects the missing 10-percent component',
      'The 10-percent Adherence weight bounds its maximum influence to 10 points on the 0-to-100 scale',
      'The established display scale is 1 to 100; missingness is represented by status and confidence, never by zero',
      'When a mature account has too little current evidence, the last established positive read remains visible with reduced current-window confidence',
    ],
    excludes: [
      'A nonlinear disagreement or spread multiplier',
      'App usage, screen time, or connected-device wear',
      'Any signal not already scored within Wellbeing, Recovery, or Adherence',
      'Comparison between athletes; Coherence is a within-person read',
      'Training load, performance outcomes, or competition results',
    ],
    minimumEvidence:
      'Building is limited to the first 3 account days. A current-window calculation requires both Wellbeing and Recovery to be independently available. Adherence contributes when available and is never imputed as zero; after onboarding, insufficient current evidence does not reset an established read.',
  },
  {
    key: 'wellbeing',
    label: 'Wellbeing',
    accent: 'mint',
    question: 'How has the athlete been feeling across the recent window?',
    summary:
      'Wellbeing keeps the athlete report visible as its own construct. Daily check-ins are summarized across 14 days and can be paired with a separately governed periodic wellbeing instrument.',
    equation: 'Wellbeing = 0.50(D) + 0.50(P)',
    inputs: [
      'D = mean of completed daily wellbeing check-ins in the 14-day window',
      'P = current periodic wellbeing instrument score, when an approved instrument is active',
      'Available components are reweighted; evidence coverage still shows what is missing',
    ],
    excludes: [
      'Training completion',
      'Physiological recovery signals',
      'AI-inferred emotions or diagnoses',
    ],
    minimumEvidence:
      'The displayed daily score remains in Building until 3 daily observations exist when no periodic instrument is present.',
  },
  {
    key: 'recovery',
    label: 'Recovery',
    accent: 'blue',
    question: 'What do the athlete report and available recovery signals show?',
    summary:
      'Recovery combines the athlete\'s latest recovery report with recent sleep and source-normalized autonomic context. It is informational and never a training prescription or medical clearance.',
    equation: 'Recovery = 0.40(S) + 0.35(L) + 0.25(Au)',
    inputs: [
      'S = latest athlete-reported recovery level in the current window',
      'L = 0.50 duration + 0.25 efficiency or continuity + 0.25 timing consistency',
      'Au = 0.50 source-normalized HRV + 0.50 source-normalized resting heart rate',
    ],
    excludes: [
      'Deep-sleep or REM-stage percentages',
      'Raw HRV comparisons across incompatible devices or algorithms',
      'Automated recommendations to rest, reduce intensity, or change practice',
    ],
    minimumEvidence:
      'A score can display from available evidence. HRV and resting heart rate require 14 valid prior nights in the active source lane before contributing.',
  },
  {
    key: 'adherence',
    label: 'Adherence',
    accent: 'amber',
    question: 'Is the athlete showing up for the commitments recorded in PulseCheck?',
    summary:
      'Adherence represents follow-through on valid opportunities, not app activity or obedience. It measures scorable scheduled check-in completion and final, verifiable outcomes for assigned or athlete-accepted mental-performance commitments.',
    equation: 'Adherence = 0.40(K) + 0.60(F)',
    inputs: [
      'K = completed scheduled check-ins divided by scorable scheduled check-ins; the open current day remains pending until completed or closed',
      'F = followed-through commitments divided by scorable commitments',
      'Planned rest counts only when it remains within the current plan and weekly follow-through policy',
    ],
    excludes: [
      'Screen time, taps, sessions opened, or connected-device wear',
      'Pre-activation check-in days and coach-excused, technical-failure, or no-assignment commitment outcomes',
      'Unverifiable self-reported claims that a task was completed elsewhere',
    ],
    minimumEvidence: 'The score remains in Building until at least 3 scheduled opportunity days are present in the window.',
  },
];

export const commitmentOutcomes = [
  ['Completed', 'Followed through', 'Included'],
  ['Planned rest within plan', 'Followed through', 'Included'],
  ['Planned rest over plan', 'Not followed through', 'Included'],
  ['Missed', 'Not followed through', 'Included'],
  ['Accepted or replacement accepted today', 'Pending', 'Not scored yet'],
  ['Accepted on a prior day without completion', 'Not followed through', 'Included'],
  ['Coach excused', 'Neutral', 'Excluded'],
  ['Technical failure', 'Neutral', 'Excluded'],
  ['No assignment', 'Neutral', 'Excluded'],
] as const;

export const evidenceMap = [
  {
    construct: 'Daily subjective wellbeing',
    productUse: 'Athlete-selected daily wellbeing level, summarized over a rolling 14-day window.',
    evidenceStatement:
      'Subjective self-report can be sensitive to changes in athlete wellbeing and training response, particularly when repeated and interpreted with context.',
    claimLimit:
      'The PulseCheck daily check-in is not a diagnostic screen and is not presented as a validated clinical outcome measure.',
    sourceLabel: 'Saw et al., 2016, British Journal of Sports Medicine',
    sourceUrl: 'https://bjsm.bmj.com/content/50/5/281',
  },
  {
    construct: 'Periodic wellbeing instrument',
    productUse:
      'A versioned 50-percent Wellbeing component slot. The production slot stays inactive until instrument selection, permissions, administration, scoring, accessibility, and referral governance are approved.',
    evidenceStatement:
      'WHO-5 is a brief self-report measure of current mental wellbeing with published administration and scoring guidance.',
    claimLimit:
      'PulseCheck does not reproduce or activate WHO-5 items in this release. Commercial rights and university governance review remain required.',
    sourceLabel: 'World Health Organization, WHO-5, 2024',
    sourceUrl: 'https://www.who.int/publications/m/item/WHO-UCN-MSD-MHE-2024.01',
  },
  {
    construct: 'Sleep duration and continuity',
    productUse:
      'Recent duration relative to an athlete target, efficiency or continuity, and timing consistency. Sleep stages are excluded.',
    evidenceStatement:
      'Sleep is relevant to athlete recovery and performance, but consumer-device outputs require careful interpretation and do not establish readiness by themselves.',
    claimLimit:
      'The score is not a sleep diagnosis, and it does not treat device-reported sleep stages as ground truth.',
    sourceLabel: 'Australian Institute of Sport Sleep Hub',
    sourceUrl: 'https://www.ais.gov.au/rest-hub/sleep',
  },
  {
    construct: 'HRV and resting heart rate',
    productUse:
      'Within-person comparison to a rolling baseline in one source, device, metric, method, measurement-window, and algorithm lane.',
    evidenceStatement:
      'Longitudinal resting heart rate and HRV can provide individual physiological context when measurement conditions and interpretation are controlled.',
    claimLimit:
      'A single low value does not establish fatigue, illness, overtraining, or a required training change.',
    sourceLabel: 'Plews et al., 2013, European Journal of Applied Physiology',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/23852425/',
  },
  {
    construct: 'Measurement validity and artifacts',
    productUse:
      'Freshness requirements, source lanes, baseline minimums, transition markers, and missing-data states.',
    evidenceStatement:
      'Wearable device, algorithm, recording window, and artifact handling can materially alter HRV estimates.',
    claimLimit:
      'The system does not claim that all consumer devices are interchangeable or equally accurate.',
    sourceLabel: 'Charlton et al., 2022, Physiological Measurement',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/35719238/',
  },
  {
    construct: 'Adherence and commitment definitions',
    productUse:
      'Operational definitions based on scheduled check-ins and final product-recorded commitment outcomes.',
    evidenceStatement:
      'Behavioral consistency and follow-through are useful implementation constructs, but their meaning depends on the defined behavior and opportunity to perform it.',
    claimLimit:
      'The PulseCheck weights are product-designed. They have not yet been established as validated psychometric constructs.',
    sourceLabel: 'Method definition and validation plan in this whitepaper',
    sourceUrl: '#validation',
  },
  {
    construct: 'Behavioral goal alignment',
    productUse:
      'Adherence contributes 10 percent of Coherence so verified follow-through matters while the Wellbeing and Recovery state core remains dominant.',
    evidenceStatement:
      'Alignment between a person\'s self-concordant goals or commitments and their actual behavior is associated with sustained effort and durable well-being gains in longitudinal goal-pursuit research.',
    claimLimit:
      'This literature supports self-endorsed behavioral follow-through as a meaningful construct in general. It does not validate the PulseCheck Adherence measure, the 10-percent bound, or the complete Coherence equation.',
    sourceLabel: 'Sheldon & Elliot, 1999, Journal of Personality and Social Psychology',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/10101878/',
  },
  {
    construct: 'State-signal agreement',
    productUse:
      'Coherence keeps Wellbeing, Recovery, and Adherence visible as separate components. Cross-domain differences remain auditable instead of being converted into a nonlinear penalty.',
    evidenceStatement:
      'Measuring the degree to which independently collected physiological and behavioral signal streams move together is an established methodological approach for characterizing coordinated versus divergent states.',
    claimLimit:
      'This literature establishes signal agreement as a measurable property between independent channels. PulseCheck Coherence is a weighted formative index, not a validated synchrony statistic or clinical state measure.',
    sourceLabel: 'Palumbo et al., 2017, Personality and Social Psychology Review',
    sourceUrl: 'https://journals.sagepub.com/doi/abs/10.1177/1088868316628405',
  },
  {
    construct: 'Self-report and objective divergence',
    productUse:
      'Coherence gives athlete-reported Wellbeing and available Recovery equal weight in its state core without treating either signal as automatically correct.',
    evidenceStatement:
      'Self-reported and objectively measured signals do not always agree, and studying that disagreement directly is an established approach distinct from treating either measure as uniquely correct.',
    claimLimit:
      'This literature examines self-report and objective-measure divergence in a different domain. It does not establish that PulseCheck\'s specific alignment calculation is clinically meaningful.',
    sourceLabel: 'Murphy et al., 2020, Quarterly Journal of Experimental Psychology',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/31519137/',
  },
  {
    construct: 'Multi-system divergence under stress',
    productUse:
      'The rationale for treating state-signal disagreement as informative draws on broader stress-physiology literature about coordinated versus divergent system function.',
    evidenceStatement:
      'Chronic stress is associated with dysregulation across multiple interdependent physiological systems rather than a single isolated marker.',
    claimLimit:
      'This literature describes physiological system dysregulation. It does not establish that PulseCheck\'s product-level Coherence score measures allostatic load or any specific physiological state.',
    sourceLabel: 'Juster, McEwen & Lupien, 2010, Neuroscience & Biobehavioral Reviews',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/19822172/',
  },
] as const;

export const implementationControls = [
  {
    title: 'Versioned calculation',
    body: `Every scorecard records methodologyVersion ${COHERENCE_SCORE_METHOD_VERSION}, a generated timestamp, the active window, evidence coverage, confidence, status, components, trend, notes, and limitations.`,
  },
  {
    title: 'Server-owned score',
    body: 'The server reads 60 days of source records, computes the current and previous 14-day windows, and writes the canonical result to pulsecheck-scorecards. iOS, Android, and coach surfaces read that shared contract.',
  },
  {
    title: 'Permission-scoped views',
    body: 'Athletes can request their own scorecard. Team staff require active team scope. Athlete responses omit raw autonomic values and internal lane identifiers; authorized staff receive contextual source-transition details.',
  },
  {
    title: 'Missingness is visible',
    body: 'Missing inputs never become zero. Available inputs can be reweighted to produce a descriptive score, while evidence coverage, observed days, confidence, and Building or Recalibrating states preserve uncertainty.',
  },
  {
    title: 'Coherence continuity',
    body: 'Coherence uses Building only during the first 3 account days. After a positive read is established, each valid rolling 14-day window updates it. A thin current window can reduce confidence and carry the last established read, but it cannot reset the athlete to zero or restart onboarding.',
  },
  {
    title: 'No autonomous training decision',
    body: 'A physiological discrepancy can generate coach-facing informational context. It never tells the athlete to alter training and never replaces coach, athletic trainer, sports medicine, or clinical judgment.',
  },
  {
    title: 'Source transition isolation',
    body: 'Apple HealthKit SDNN is never pooled with RMSSD from WHOOP, Oura, or Health Connect. A new lane recalibrates against its own history instead of forcing a conversion between incompatible raw values.',
  },
] as const;

export const evidenceStates = [
  ['Available', 'Enough current evidence exists to calculate the score under the active method.'],
  ['Building', 'For Coherence, the athlete is within the first 3 account days. Other scores use their own published minimum-observation rules.'],
  ['Recalibrating', 'A physiological source lane is new, stale, or lacks 14 same-lane baseline nights.'],
  ['Insufficient evidence', 'No valid score can be supported from the available record.'],
] as const;

export const confidenceRules = [
  ['Limited', 'Score unavailable, evidence coverage below 50 percent, or fewer than 3 observed days.'],
  ['Moderate', 'Score available with at least 50 percent coverage and at least 3 observed days.'],
  ['Strong', 'Score available with at least 80 percent coverage and at least 7 observed days.'],
] as const;

export const validationPlan = [
  {
    phase: '01',
    title: 'Technical verification',
    body: 'Deterministic fixtures, property tests, missingness tests, source-switch tests, permission tests, and cross-platform contract tests verify that implementation matches the published method.',
    status: 'Server fixtures implemented for method 2.2.2; native release verification remains required',
  },
  {
    phase: '02',
    title: 'Content and governance review',
    body: 'Sports medicine, sport psychology, privacy, accessibility, legal, and athlete reviewers examine wording, burden, escalation boundaries, and role-based visibility.',
    status: 'Required per deployment',
  },
  {
    phase: '03',
    title: 'Reliability and construct study',
    body: 'Pre-registered prospective work should evaluate stability, sensitivity to change, convergent and discriminant relationships, subgroup performance, missingness, source effects, and sensitivity of conclusions to alternative Adherence weights such as 0, 5, and 15 percent. The 10-percent production weight must not be tuned and validated on the same sample.',
    status: 'Not yet completed',
  },
  {
    phase: '04',
    title: 'Decision-impact evaluation',
    body: 'Assess whether coach-facing summaries improve communication without increasing false alarms, surveillance pressure, inequity, or inappropriate training decisions.',
    status: 'Not yet completed',
  },
] as const;

export const verificationMatrix = [
  ['Formula fixtures', 'Exact component weights, caps, rounding, trends, and status thresholds', 'Automated unit tests'],
  ['Missing data', 'No missing value becomes zero; coverage and confidence decline as designed', 'Automated unit tests'],
  ['Device change', 'New source lane recalibrates; incompatible raw HRV values never pool', 'Automated unit and ingestion tests'],
  ['Commitment lifecycle', 'Replacement, completion, planned rest, over-plan rest, excuses, and technical failures', 'Runtime API tests'],
  ['Access and permission boundary', 'Self access, team-scoped staff access, athlete-safe redaction, and denied cross-team access', 'Endpoint and Firestore rules tests'],
  ['Cross-platform display', 'iOS, Android, and coach web read the canonical four-score contract', 'Native build, unit, simulator, emulator, and browser checks'],
] as const;

export const limitations = [
  'The four scores are evidence-informed proprietary indices. They are not diagnoses, medical clearance, treatment recommendations, or clinically validated outcomes.',
  'Evidence supporting an input does not validate the selected product weights or the complete composite score.',
  'The 10-percent Adherence weight is an a priori governance bound selected to limit influence. It is not an empirically estimated or clinically validated coefficient.',
  'A score describes the evidence available to PulseCheck, not the athlete as a person and not every behavior that occurred outside the product.',
  'Adherence can be underestimated when legitimate activity occurs outside the verifiable workflow. The product intentionally does not accept an unverifiable completed-elsewhere claim.',
  'Consumer wearable accuracy, algorithms, missingness, source access, device fit, and measurement windows can differ across athletes and over time.',
  'The periodic wellbeing component is a governed integration slot, not an active claim that WHO-5 or another instrument is currently administered.',
  'The scores must not independently determine training decisions. Coaches and sports medicine staff review them alongside workload, symptoms, and direct observation.',
  'No score should be used alone for roster, scholarship, playing-time, discipline, diagnosis, treatment, or return-to-participation decisions.',
] as const;

export const references = [
  ['World Health Organization. The World Health Organization-Five Well-Being Index (WHO-5), 2024.', 'https://www.who.int/publications/m/item/WHO-UCN-MSD-MHE-2024.01'],
  ['Saw AE, Main LC, Gastin PB. Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures. British Journal of Sports Medicine. 2016;50:281-291.', 'https://bjsm.bmj.com/content/50/5/281'],
  ['Plews DJ et al. Training adaptation and heart rate variability in elite endurance athletes: opening the door to effective monitoring. European Journal of Applied Physiology. 2013.', 'https://pubmed.ncbi.nlm.nih.gov/23852425/'],
  ['Buchheit M. Monitoring training status with HR measures: do all roads lead to Rome? Frontiers in Physiology. 2014.', 'https://pubmed.ncbi.nlm.nih.gov/24578692/'],
  ['Australian Institute of Sport. Evidence-based position statements and Heart Rate Variability Best Practice Guidelines.', 'https://www.ais.gov.au/position_statements'],
  ['Apple Developer Documentation. Heart rate variability SDNN.', 'https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/heartratevariabilitysdnn'],
  ['Android Developers. HeartRateVariabilityRmssdRecord.', 'https://developer.android.com/reference/androidx/health/connect/client/records/HeartRateVariabilityRmssdRecord'],
  ['WHOOP. Heart Rate Variability and WHOOP metrics.', 'https://support.whoop.com/s/article/Heart-Rate-Variability-HRV-Insights-WHOOP-Metrics?language=en_US'],
  ['Stone JD et al. Evaluations of commercial sleep technologies for objective monitoring during routine sleeping conditions. Nature and Science of Sleep. 2020.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8147413/'],
  ['Charlton PH et al. Validity and reliability of wearable HRV measurement: artifact and methodological considerations. Physiological Measurement. 2022.', 'https://pubmed.ncbi.nlm.nih.gov/35719238/'],
  ['Herzig D et al. Reproducibility and longitudinal validity of nocturnal HRV and resting heart rate. Journal of Sports Sciences. 2021.', 'https://pubmed.ncbi.nlm.nih.gov/34883936/'],
  ['Sheldon KM, Elliot AJ. Goal striving, need satisfaction, and longitudinal well-being: the self-concordance model. Journal of Personality and Social Psychology. 1999;76(3):482-497.', 'https://pubmed.ncbi.nlm.nih.gov/10101878/'],
  ['Palumbo RV, Marraccini ME, Weyandt LL, Wilder-Smith O, McGee HA, Liu S, Goodwin MS. Interpersonal autonomic physiology: a systematic review of the literature. Personality and Social Psychology Review. 2017;21(2):99-141.', 'https://journals.sagepub.com/doi/abs/10.1177/1088868316628405'],
  ['Murphy J, Brewer R, Plans D, Khalsa SS, Catmur C, Bird G. Testing the independence of self-reported interoceptive accuracy and attention. Quarterly Journal of Experimental Psychology. 2020;73(1):115-133.', 'https://pubmed.ncbi.nlm.nih.gov/31519137/'],
  ['Juster RP, McEwen BS, Lupien SJ. Allostatic load biomarkers of chronic stress and impact on health and cognition. Neuroscience & Biobehavioral Reviews. 2010;35(1):2-16.', 'https://pubmed.ncbi.nlm.nih.gov/19822172/'],
  ['Jeffries AC, Wallace L, Coutts AJ, McLaren SJ, McCall A, Impellizzeri FM. Athlete-reported outcome measures for monitoring training responses: a systematic review of risk of bias and measurement property quality according to the COSMIN guidelines. International Journal of Sports Physiology and Performance. 2020;15(9):1203-1215.', 'https://pubmed.ncbi.nlm.nih.gov/32957081/'],
] as const;

const renderList = (items: readonly string[]) => items.map((item) => `- ${item}`).join('\n');

const renderScoreSection = (score: ScoreDefinition, index: number) => `
## 2.${index + 1} ${score.label}

**Question:** ${score.question}

${score.summary}

**Calculation:** ${score.equation}

**Inputs**

${renderList(score.inputs)}

**Not included**

${renderList(score.excludes)}

**Minimum evidence:** ${score.minimumEvidence}
`;

const commitmentOutcomeTable = commitmentOutcomes
  .map(([outcome, interpretation, treatment]) => `| ${outcome} | ${interpretation} | ${treatment} |`)
  .join('\n');

const implementationControlCopy = implementationControls
  .map((control) => `## 8.${implementationControls.indexOf(control) + 1} ${control.title}\n\n${control.body}`)
  .join('\n\n');

const evidenceStateTable = evidenceStates
  .map(([state, meaning]) => `| ${state} | ${meaning} |`)
  .join('\n');

const confidenceRuleTable = confidenceRules
  .map(([confidence, meaning]) => `| ${confidence} | ${meaning} |`)
  .join('\n');

const validationPlanTable = validationPlan
  .map((item) => `| ${item.phase} | ${item.title} | ${item.body} | ${item.status} |`)
  .join('\n');

const verificationMatrixTable = verificationMatrix
  .map(([family, verifies, method]) => `| ${family} | ${verifies} | ${method} |`)
  .join('\n');

const referenceBlock = references
  .map(([label, href], index) => `[${index + 1}] [${label}](${href})`)
  .join('\n');

export const COHERENCE_SCORE_WHITE_PAPER_CONTENT = `
:::abstract
PulseCheck reports four evidence-informed constructs. Wellbeing, Recovery, and Adherence are independent domain scores, each answering one question about the athlete's recent record. Coherence is a fourth, transparent formative index: Wellbeing and Recovery form a 90-percent state core, and Adherence provides a bounded 10-percent behavioral contribution. Separating the domain scores from the composite keeps each question distinct and auditable while still providing one recent-pattern read across self-report, recovery evidence, and verified follow-through. Each score uses a rolling 14-day window, carries its own evidence coverage and confidence state, and can remain unavailable when the record is too limited. Coherence is continuous after onboarding: the rolling window refreshes an established read rather than resetting the athlete every 14 days.

This paper defines the exact production method for version ${COHERENCE_SCORE_METHOD_VERSION}. Wellbeing summarizes athlete-reported experience. Recovery presents athlete report alongside recent sleep and source-normalized autonomic context. Adherence asks whether the athlete is showing up for scheduled check-ins and recorded mental-performance commitments. Coherence combines those three domain scores with a deliberately bounded behavioral weight. It never replaces the supporting scores or stands in as a single overall grade.

The four scores are evidence-informed proprietary descriptive indices. Research supports the relevance and careful use of several inputs, but it does not validate PulseCheck's selected weights, equations, or complete scorecard as a clinical outcome. The scores do not diagnose, prescribe physical training, determine medical clearance, or replace athlete, coach, athletic trainer, sports medicine, or licensed clinical judgment.
:::

# 1. Why the Domain Scores Stay Separate

An athlete can feel well while recovering poorly from a demanding schedule. Another athlete can show strong physiological recovery while not following through on commitments. A third can complete every assigned task while reporting a sustained decline in wellbeing. Treating those patterns as one construct makes the output difficult to explain and easier to misuse.

PulseCheck therefore keeps Wellbeing, Recovery, and Adherence as independent domain scores, and adds Coherence as a published weighted composite rather than a hidden or punitive calculation. The component cards show what changed, what evidence is present, and what remains unknown. The 45/45/10 weighting makes the athlete's state dominant while allowing verified follow-through to influence the headline within a fixed 10-point maximum.

:::callout
Evidence-informed does not mean clinically validated. Technical verification can establish that software follows the published method. Reliability, construct validity, fairness, decision impact, and improved athlete outcomes require separate prospective study.
:::

# 2. The Four-Score Architecture

Each score answers one defined question. Every result is accompanied by its methodology version, current window, observed days, evidence coverage, confidence, status, component record, trend, notes, and limitations. Missing evidence never becomes a zero.

${scoreDefinitions.map(renderScoreSection).join('\n')}

# 3. Windows, Missingness, and Trend

The current result uses a rolling 14-day window. Trend compares that current window with the immediately preceding 14-day window. The scoring service can read a longer source-record horizon so it can establish physiological baselines, preserve Coherence continuity, and identify source transitions without blending incompatible measurements.

For Coherence, **Building** is an onboarding state limited to the athlete's first 3 account days. Once a positive Coherence read has been established, every sufficiently evidenced 14-day window can replace it with a newer read. If the current window is too thin to support a new calculation, PulseCheck carries the last established read and lowers the current evidence coverage and confidence instead of displaying zero or restarting onboarding. The displayed established Coherence scale is 1 to 100; zero is not used as a missing-data state.

When a configured component is unavailable, the score may reweight the valid components that remain. Reweighting does not erase the missing evidence. Evidence coverage, observed days, confidence, and status remain visible beside the number. If no defensible result can be produced, the score remains unavailable.

- A recorded zero is data. A missing value is not converted to zero.
- Established Coherence is never displayed as zero; the lowest fully evidenced displayed value is 1.
- Current and previous windows are calculated under the same method version.
- A trend is not shown as meaningful when either comparison window lacks enough evidence.
- A score describes the evidence available to PulseCheck, not the athlete as a person.

# 4. Adherence as Showing Up

Adherence is not screen time, app opens, device wear, obedience, or a reward for using more product features. It represents follow-through on valid opportunities: scheduled check-ins and final, verifiable outcomes for assigned or athlete-accepted mental-performance commitments. Pre-activation days are excluded from the check-in denominator. Coach-excused, technical-failure, and no-assignment outcomes are excluded from the commitment denominator rather than treated as failures. An unverifiable self-reported claim that a task was completed elsewhere does not enter the calculation, because the product cannot confirm that claim consistently.

A replacement skill keeps the original commitment lineage. Planned rest can count as follow-through only when it remains inside the current plan and weekly policy. Repeated rest outside the plan remains visible as a follow-through issue rather than being silently rewarded.

The open current day remains pending until the athlete completes the check-in or the day closes. It is visible in the 14-day grid but does not lower Adherence early merely because the athlete has not checked in yet.

| Recorded outcome | Interpretation | Adherence treatment |
| --- | --- | --- |
${commitmentOutcomeTable}

# 5. Scientific Basis and Claim Limits

The evidence model separates support for an input from validation of the full product score. A citation showing that subjective self-report or longitudinal HRV can be useful does not prove that the PulseCheck weights are optimal or that a composite predicts performance.

## 5.1 Daily Subjective Wellbeing

Repeated subjective self-report can be sensitive to changes in athlete wellbeing and training response, particularly when interpreted alongside context. [cite:2] PulseCheck summarizes an athlete-selected daily wellbeing level across the recent window. The daily check-in is not a diagnostic screen and is not presented as a validated clinical outcome measure.

Reviews of athlete-reported monitoring measures have also identified important gaps in content validity, measurement error, and validation of commonly used single-item measures. [cite:16] PulseCheck therefore treats technical consistency with the published calculation as distinct from scientific validation of the underlying measures or composite.

## 5.2 Periodic Wellbeing Instrument

The Wellbeing method contains a versioned component slot for a separately governed periodic instrument. WHO-5 is a brief measure of current mental wellbeing with published administration and scoring guidance. [cite:1] PulseCheck does not reproduce or activate WHO-5 items in this release. Instrument permissions, administration, scoring, accessibility, referral governance, and university review must be complete before that component becomes active.

## 5.3 Sleep Duration and Continuity

Sleep is relevant to athlete recovery and performance, but consumer-device outputs require careful interpretation and do not establish readiness by themselves. [cite:5,9] Recovery uses recent duration relative to an athlete target, efficiency or continuity, and timing consistency. Deep-sleep and REM-stage percentages are excluded because device-reported stages are not treated as ground truth.

## 5.4 HRV and Resting Heart Rate

Longitudinal resting heart rate and HRV can provide individual physiological context when measurement conditions and interpretation are controlled. [cite:3,4,11] PulseCheck compares an athlete with their own recent history inside one compatible source lane. A single low value does not establish fatigue, illness, overtraining, or a required training change.

Wearable device, algorithm, recording window, method, and artifact handling can materially alter HRV estimates. [cite:6,7,8,10] The system does not claim that all consumer devices are interchangeable or equally accurate.

## 5.5 Adherence and Commitment Definitions

Adherence is an operational product construct defined by scheduled opportunities and final product-recorded outcomes. Its usefulness depends on whether the behavior, opportunity, exclusions, and follow-through rules remain stable. The selected weights are product-designed. They have not yet been established as validated psychometric constructs.

## 5.6 Coherence as a Bounded Formative Index

Alignment between a person's self-concordant commitments and their follow-through is associated with sustained effort and durable well-being gains in longitudinal goal-pursuit research. [cite:12] PulseCheck therefore includes Adherence as a bounded 10-percent contribution. This is a product-design rationale, not evidence that 10 percent is a biologically or psychometrically optimal weight.

Measuring the degree to which independently collected signal streams move together, rather than only their individual levels, is an established methodological approach in psychophysiology research. [cite:13] PulseCheck preserves that information by showing all three component scores and their evidence. The headline Coherence number itself is a weighted formative index, not a correlation, synchrony coefficient, or nonlinear disagreement score.

Self-reported and objectively measured signals do not always agree, and studying that disagreement directly is an established approach distinct from treating either measure as uniquely correct. [cite:14] Wellbeing and Recovery therefore receive equal weight inside the 90-percent state core. Their component cards keep a mixed state visible without applying the former spread multiplier. Divergence across behavioral, subjective, and physiological systems is also consistent with broader stress-physiology literature on multi-system dysregulation. [cite:15]

The selected Coherence equation is product-designed and prespecified for auditability. Its nonnegative weights sum to 100, so the result remains inside the range of its available component scores. Adherence can change the headline by no more than 10 points, and no multiplicative spread penalty can collapse the result. These mathematical properties make the behavior bounded and testable; they do not establish reliability, validity, fairness, or clinical meaning.

# 6. Wearable Source Normalization

Raw physiological values are grouped by source, device, metric, method, measurement window, and algorithm version. Apple HealthKit SDNN is never pooled with RMSSD from WHOOP, Oura, or Health Connect. Resting heart rate is isolated by source lane as well.

When an athlete changes devices, PulseCheck starts a new active lane. It does not force a conversion between incompatible HRV methods and does not rewrite the prior record. The new lane enters **Recalibrating** until it has 14 valid prior measurements within the 28-day baseline window. Authorized staff can see the source transition in context. The athlete sees a neutral recalibration state rather than a false physiological drop.

:::callout
A source transition is a measurement-context change, not evidence that the athlete's recovery suddenly improved or declined.
:::

# 7. Status, Coverage, and Confidence

A number without evidence context invites overinterpretation. PulseCheck keeps score status, evidence coverage, observed days, and confidence visible so uncertainty remains part of the output.

## 7.1 Score Status

| Status | Meaning |
| --- | --- |
${evidenceStateTable}

## 7.2 Evidence Confidence

| Confidence | Meaning |
| --- | --- |
${confidenceRuleTable}

# 8. Production Implementation

The canonical score is server-owned. The server reads source records, computes current and previous 14-day windows under method ${COHERENCE_SCORE_METHOD_VERSION}, and writes a versioned result to the shared scorecard contract. iOS, Android, athlete, coach, and staff surfaces read that contract instead of independently recreating formulas.

The source record includes check-ins, commitments and assignment outcomes, health snapshots, and governed assessments when active. Access is permission-scoped. Athletes can request their own scorecard. Team staff require active team scope. Athlete responses omit raw autonomic values and internal source-lane identifiers, while authorized staff can receive limited source-transition context.

${implementationControlCopy}

# 9. Athlete and Staff Boundaries

The athlete view can show the score, trend, status, confidence, evidence coverage, and a neutral explanation. It does not tell the athlete to change physical training because of a physiological discrepancy. A check-in response can invite a Pro athlete to continue a conversation with Nora, but Nora does not take the coach's role or prescribe the day's physical workload.

Authorized staff can review mixed recovery signals, source transitions, and evidence limits within their team scope. Those signals remain informational. Coaches, athletic trainers, sports medicine staff, and licensed clinicians retain their existing decision authority and interpret the score beside workload, symptoms, direct observation, and athlete conversation.

# 10. Technical Verification and Scientific Validation

Passing software tests confirms that the released implementation follows the published formulas and data rules. It cannot by itself establish reliability, construct validity, fairness, clinical utility, transfer to performance, or improved athlete outcomes.

## 10.1 Validation Plan

| Phase | Work | Purpose | Current status |
| --- | --- | --- | --- |
${validationPlanTable}

## 10.2 Release Verification Matrix

| Test family | What it verifies | Method |
| --- | --- | --- |
${verificationMatrixTable}

# 11. Known Limitations

${renderList(limitations)}

# 12. Deployment Review

Before the scores enter a university workflow, Pulse Intelligence Labs invites review from sports medicine, sport psychology, counseling, legal, privacy, accessibility, data science, coaching, and athlete representatives. That review should examine not only formulas, but also wording, burden, permissions, source quality, escalation boundaries, equity, and how staff will respond when evidence is mixed.

The governing question is not simply whether the system can calculate a number. It is whether each score is understandable, bounded, auditable, and useful without being given authority the evidence has not earned.

:::references
${referenceBlock}
:::
`;
