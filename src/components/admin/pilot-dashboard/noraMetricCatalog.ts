export interface PilotDashboardMetricExplanation {
  title: string;
  whatItMeans: string;
  whyItMatters: string;
  howToReadIt?: string;
  watchFor?: string;
}

export const PILOT_DASHBOARD_METRIC_EXPLANATIONS = {
  'active-pilots': {
    title: 'Active Pilots',
    whatItMeans: 'This is the number of pilots currently in an active state inside the filtered admin view.',
    whyItMatters: 'It tells the experiment team how many live pilot environments are being monitored right now. More active pilots usually means more review demand and more places where scope drift can hide.',
    howToReadIt: 'Use this as a workload and portfolio count, not as an outcome signal. A healthy pilot program can have one great pilot or several weaker ones.',
  },
  'active-pilot-athletes': {
    title: 'Active Pilot Athletes',
    whatItMeans: 'This counts athletes with an active PilotEnrollment inside the current pilot or filtered pilot directory view.',
    whyItMatters: 'This is one of the most important denominators in the dashboard. It defines who is truly in scope for the experiment and who should be contributing pilot evidence.',
    howToReadIt: 'When this number changes, re-read every rate beside it. Coverage, stable-rate, and hypothesis signals all become more or less trustworthy depending on the active athlete denominator.',
    watchFor: 'A low count can make promising findings look bigger than they really are, especially if only a few athletes are driving the patterns.',
  },
  'unsupported-hypotheses': {
    title: 'Unsupported Hypotheses',
    whatItMeans: 'These are pilot hypotheses currently marked as not supported by the evidence gathered so far.',
    whyItMatters: 'A strong experiment does not only confirm ideas. It should also surface where the pilot is not validating the original research assumptions.',
    howToReadIt: 'Treat this as a learning signal, not a failure counter. Unsupported hypotheses often tell you where guidance, sampling, or design assumptions need revision.',
  },
  coverage: {
    title: 'Coverage',
    whatItMeans: 'Coverage is the share of in-scope pilot athletes who have a usable correlation-engine record in the governed pilot frame.',
    whyItMatters: 'If coverage is weak, the experiment is not fully observing the pilot population. That limits both confidence and fairness because some athletes are effectively invisible to the engine.',
    howToReadIt: 'Higher is better, but only when the underlying data quality is real. Strong coverage means the pilot has enough reachable athletes to learn from, not that every insight is valid.',
    watchFor: 'If coverage drops, investigate sync issues, enrollment mismatches, stale wearable data, or missing engine refreshes before interpreting pilot findings.',
  },
  'stable-rate': {
    title: 'Stable Rate',
    whatItMeans: 'Stable rate is the share of active pilot athletes with at least one stable pattern, meaning the engine has found a repeatable body-state relationship strong enough to persist.',
    whyItMatters: 'This is one of the clearest pilot-learning signals. It tells you whether the experiment is producing usable personalization instead of only collecting raw telemetry.',
    howToReadIt: 'A higher stable rate suggests more athletes are crossing from early signal into repeatable pattern territory. That usually means the pilot is learning, not just logging.',
    watchFor: 'A low stable rate does not automatically mean the engine is wrong. It can also reflect short pilot duration, weak adherence, low physiological variance, or sparse evidence.',
  },
  'avg-evidence': {
    title: 'Average Evidence',
    whatItMeans: 'This is the average number of evidence records available per active pilot athlete in the current scope.',
    whyItMatters: 'Evidence depth affects how much the engine can actually learn. More evidence usually means stronger chances of finding meaningful and stable physiological-performance relationships.',
    howToReadIt: 'Use this with stable rate and coverage, not alone. High evidence with low stability may mean noisy inputs or weak experimental variance. Low evidence with good stability may mean only a subset of athletes is maturing.',
  },
  'promising-hypotheses': {
    title: 'Promising Hypotheses',
    whatItMeans: 'These are hypotheses showing early support, but not enough to claim strong confirmation yet.',
    whyItMatters: 'This is the middle zone where the research team should pay attention. Promising hypotheses often become the seeds for better follow-up analysis, stronger instrumentation, or a refined next pilot.',
    howToReadIt: 'Treat promising as directional support, not validation. It means the signal is moving in the hoped-for direction, but the confidence bar is not fully met yet.',
  },
  'high-confidence-hypotheses': {
    title: 'High Confidence Hypotheses',
    whatItMeans: 'These are hypotheses whose current evidence base is strong enough to be considered relatively robust within the governed pilot frame.',
    whyItMatters: 'This is where the pilot starts to generate the most actionable research momentum. High-confidence hypotheses are often the best candidates for internal decisions or formal follow-up work.',
    howToReadIt: 'Even high confidence is still pilot-bounded. It means strong support inside this frame, not universal truth across all athletes or future pilots.',
  },
  'avg-projections-per-athlete': {
    title: 'Average Projections Per Athlete',
    whatItMeans: 'This is the average number of recommendation or interpretation projections generated per active pilot athlete.',
    whyItMatters: 'It shows whether the engine is producing enough usable output to support the experiment, rather than only storing evidence and patterns.',
    howToReadIt: 'Very low values can mean the engine is not ready to speak often. Very high values can mean the system is generating plenty of output, but you still need to confirm that the outputs are grounded and useful.',
  },
  'active-cohorts': {
    title: 'Active Cohorts',
    whatItMeans: 'This is the number of cohorts currently active inside the pilot scope being viewed.',
    whyItMatters: 'Cohorts are often the operational units of a pilot. Knowing how many are active helps explain differences in readiness, adherence, and evidence maturity across the experiment.',
    howToReadIt: 'More active cohorts usually means more segmentation and more need to compare like with like before making pilot-level claims.',
  },
  'selected-cohort': {
    title: 'Selected Cohort',
    whatItMeans: 'This reflects the cohort lens currently applied to the pilot dashboard.',
    whyItMatters: 'A cohort filter changes the denominator and therefore changes what the pilot metrics actually describe. It helps keep conclusions tied to the exact subgroup being reviewed.',
    howToReadIt: 'Whenever a cohort is selected, read every nearby metric as cohort-scoped rather than pilot-wide.',
  },
  'athletes-with-stable-patterns': {
    title: 'Athletes With Stable Patterns',
    whatItMeans: 'This is the count of active pilot athletes who have at least one stable pattern in the current pilot or cohort view.',
    whyItMatters: 'It turns stable-rate from a percentage into a concrete headcount. That matters because a high percentage built on only a few athletes can sound stronger than it is.',
    howToReadIt: 'Pair this count with stable-rate. The count tells you how many actual people are carrying the signal.',
  },
  hypotheses: {
    title: 'Hypotheses',
    whatItMeans: 'This is the number of research hypotheses actively tracked for the pilot.',
    whyItMatters: 'It anchors the experiment to pre-declared questions rather than letting interpretation drift after the data arrives.',
    howToReadIt: 'A good hypothesis count is focused enough to review well and broad enough to cover the pilot goals.',
  },
  'enrollment-boundary': {
    title: 'Enrollment Boundary',
    whatItMeans: 'This compares active pilot athletes in the current view with the total enrollments recorded for the pilot.',
    whyItMatters: 'It shows how much of the pilot is currently alive and contributing. This is critical for keeping the dashboard pilot-native rather than quietly drifting into team- or system-wide analytics.',
    howToReadIt: 'If active athletes are much lower than total enrollments, the pilot may be mid-ramp, winding down, or struggling with participant activation.',
  },
  'engine-coverage': {
    title: 'Engine Coverage',
    whatItMeans: 'Engine coverage is the percentage of in-scope pilot athletes who currently have a persisted correlation-engine record.',
    whyItMatters: 'It answers whether the learning system is actually touching the experimental population. Weak coverage can make every downstream finding less representative.',
    howToReadIt: 'This is stronger than raw enrollment because it confirms that the engine has actually produced something for those athletes.',
  },
  'stable-pattern-rate': {
    title: 'Stable Pattern Rate',
    whatItMeans: 'This is the percentage of in-scope pilot athletes with at least one stable pattern in the selected frame.',
    whyItMatters: 'It tells you how much of the pilot has moved from possible signal into repeatable, governed signal.',
    howToReadIt: 'Use it as a pilot-learning read. If the rate climbs while coverage and evidence depth stay healthy, the experiment is likely maturing in a useful way.',
  },
  'athletes-with-engine-record': {
    title: 'Athletes With Engine Record',
    whatItMeans: 'This is the count of active pilot athletes who have at least one persisted engine record.',
    whyItMatters: 'It gives the raw headcount behind engine coverage. That makes it easier to understand whether the pilot is truly observed or only partially instrumented.',
    howToReadIt: 'Compare this against active pilot athletes. The closer the two are, the more complete the engine’s reach across the pilot population.',
  },
  'evidence-records': {
    title: 'Evidence Records',
    whatItMeans: 'Evidence records are the stored physiological-performance linkage records the engine uses to learn patterns.',
    whyItMatters: 'This is the substrate of the experiment. Without enough evidence records, stable relationships and trustworthy recommendations are hard to generate.',
    howToReadIt: 'More is not always better if the records are repetitive, stale, or low-quality. What matters is enough relevant evidence distributed across the pilot athletes.',
  },
  'pattern-models': {
    title: 'Pattern Models',
    whatItMeans: 'Pattern models are the learned athlete-level or pilot-relevant relationships built from the evidence layer.',
    whyItMatters: 'They are the step where raw evidence becomes interpretable structure. A pilot that cannot produce usable pattern models is not yet learning in the way the experiment hopes.',
    howToReadIt: 'Use this with stable-pattern counts and confidence tiers. A high model count with low stability can mean the system is detecting many weak or early-stage relationships.',
  },
  'avg-evidence-per-athlete': {
    title: 'Average Evidence Per Athlete',
    whatItMeans: 'This is the average evidence-record volume per active pilot athlete in the current frame.',
    whyItMatters: 'It helps you judge whether the experiment is producing enough per-person depth to support individualized interpretation rather than only pilot-wide aggregates.',
    howToReadIt: 'If this is low, be careful with claims about personalization. The pilot may still be in an early evidence-collection phase.',
  },
  'pattern-density': {
    title: 'Pattern Density',
    whatItMeans: 'Pattern density summarizes how many pattern models and recommendation projections the average active athlete is generating.',
    whyItMatters: 'It indicates whether the pilot is starting to convert evidence into usable interpretive output at the athlete level.',
    howToReadIt: 'Read this as a density signal, not a quality guarantee. More patterns and projections are only helpful if they remain stable, explainable, and well scoped.',
  },
  'pilot-health-read': {
    title: 'Pilot Health Read',
    whatItMeans: 'This is a narrative health check that rolls the key learning signals into a quick ops-and-research interpretation.',
    whyItMatters: 'Admins often need one fast read before drilling into the underlying tables. This panel helps them decide whether the pilot looks healthy enough to trust or needs operational attention.',
    howToReadIt: 'Use it as a summary lens only. The supporting metrics still matter more than the narrative shorthand.',
  },
  'not-enough-data': {
    title: 'Not Enough Data',
    whatItMeans: 'These are hypotheses that still lack enough evidence to interpret responsibly.',
    whyItMatters: 'This protects the experiment from forcing conclusions too early. Some of the most important pilot discipline comes from naming where the data is still too thin.',
    howToReadIt: 'A high count here usually means the team should wait, improve collection quality, or narrow claims rather than making stronger statements.',
  },
  promising: {
    title: 'Promising',
    whatItMeans: 'These are hypotheses showing directional support but not yet enough certainty to count as strong validation.',
    whyItMatters: 'They often reveal where the pilot is starting to teach you something meaningful, even if the evidence is not mature yet.',
    howToReadIt: 'Use this as a “watch closely” category, not as a victory category.',
  },
  mixed: {
    title: 'Mixed',
    whatItMeans: 'Mixed hypotheses show both supporting and contradictory evidence within the current pilot frame.',
    whyItMatters: 'Mixed results are valuable because they often reveal subgroup differences, weak baselines, or overgeneralized assumptions.',
    howToReadIt: 'Do not smooth these over. Mixed usually means you need better segmentation, more time, or a different interpretation lens.',
  },
  'not-supported': {
    title: 'Not Supported',
    whatItMeans: 'These hypotheses currently do not have evidence that supports the original expected relationship.',
    whyItMatters: 'They help the research team learn where the pilot is not behaving as expected and where the next design iteration may need to change.',
    howToReadIt: 'Not supported is still a useful experimental outcome. It often saves the team from scaling the wrong story.',
  },
  'high-confidence': {
    title: 'High Confidence',
    whatItMeans: 'This counts hypotheses or patterns that currently meet the dashboard’s strongest confidence tier in the governed frame.',
    whyItMatters: 'High-confidence results are the most likely to support stronger internal decisions and future replication planning.',
    howToReadIt: 'Keep the scope in mind. High confidence inside one pilot is still not the same as broad causal proof.',
  },
  'saved-readout': {
    title: 'Saved Readout',
    whatItMeans: 'This is the count of persisted pilot research readouts generated for the current pilot scope.',
    whyItMatters: 'It shows the history of formal interpretation snapshots taken over time, which is useful for reviewing how the research understanding evolved.',
    howToReadIt: 'More saved readouts means more interpretive checkpoints, not necessarily more confidence. Quality and review state matter more than count alone.',
  },
  'readiness-frame': {
    title: 'Readiness Frame',
    whatItMeans: 'The readiness frame names the exact pilot or cohort scope the research readout will interpret.',
    whyItMatters: 'It keeps the AI layer tied to one governed denominator and prevents the brief from drifting into unsupported whole-system claims.',
    howToReadIt: 'Always read the research brief as bounded by this frame. If the frame changes, the interpretation should change too.',
  },
  'eligible-athletes': {
    title: 'Eligible Athletes',
    whatItMeans: 'This is the number of active pilot athletes currently eligible to be included in the readout generation frame.',
    whyItMatters: 'It tells you how many people are actually contributing to the generated interpretation and whether the readout has a broad enough base to be useful.',
    howToReadIt: 'Low eligibility should lower your appetite for strong claims. It narrows the inferential weight of the readout.',
  },
  'hypotheses-in-scope': {
    title: 'Hypotheses In Scope',
    whatItMeans: 'This counts the pilot hypotheses included in the current research readout frame.',
    whyItMatters: 'It shows how much of the pilot’s original research agenda is actually being considered in the interpretation layer.',
    howToReadIt: 'If important hypotheses are missing or out of scope, the readout may be informative but incomplete.',
  },
  cohort: {
    title: 'Cohort',
    whatItMeans: 'This identifies the cohort the athlete belongs to within the selected pilot.',
    whyItMatters: 'Cohort membership shapes how the athlete should be interpreted inside the experiment, especially when cohorts differ by timing, intervention, or population.',
    howToReadIt: 'Use this as the athlete’s experimental lane, not just an administrative label.',
  },
  'stable-patterns': {
    title: 'Stable Patterns',
    whatItMeans: 'This is the count of stable patterns currently identified for the athlete in the pilot frame.',
    whyItMatters: 'It helps admins see whether the system has moved beyond early evidence into repeatable, athlete-specific learning.',
    howToReadIt: 'A higher count can mean the athlete has richer usable signal, but only if the patterns remain current and coherent.',
  },
  'profile-snapshots': {
    title: 'Profile Snapshots',
    whatItMeans: 'These are captured profile interpretations linked to the athlete in the pilot scope.',
    whyItMatters: 'Snapshots show how the athlete’s pilot-relevant interpretation has been recorded over time, which is important for longitudinal research review.',
    howToReadIt: 'More snapshots mean more interpretation checkpoints, not automatically better data quality.',
  },
  'pilot-enrollment': {
    title: 'Pilot Enrollment',
    whatItMeans: 'This section explains how the athlete is enrolled into the pilot, including status, study mode, and consent state.',
    whyItMatters: 'Without a valid enrollment, the athlete should not be treated as part of the experiment. This is the contract boundary for pilot inclusion.',
    howToReadIt: 'Review this first when something looks odd in the athlete’s pilot data. Enrollment problems often explain missing or partial downstream metrics.',
  },
  'engine-summary': {
    title: 'Engine Summary',
    whatItMeans: 'This section summarizes the engine footprint for the athlete, including evidence, patterns, projections, and refresh timing.',
    whyItMatters: 'It tells you whether the system has enough material to say anything meaningful about this athlete inside the experiment.',
    howToReadIt: 'If the engine summary is sparse, be careful not to over-interpret the athlete’s downstream pilot narrative.',
  },
  'milestone-context': {
    title: 'Milestone Context',
    whatItMeans: 'This shows the latest assessment-context flag captured for the athlete in the pilot frame.',
    whyItMatters: 'Milestone context ties body-state interpretation back to actual assessment moments, which is critical for understanding whether the pilot is seeing meaningful context effects.',
    howToReadIt: 'Treat it as timing-aware context, not as a final performance verdict.',
  },
  'recent-evidence': {
    title: 'Recent Evidence',
    whatItMeans: 'This section lists the most recent pilot-linked evidence records for the athlete.',
    whyItMatters: 'It lets reviewers inspect what the engine has actually been learning from, rather than only trusting summary counts.',
    howToReadIt: 'Use it to sanity-check freshness, alignment, and confidence before trusting downstream patterns.',
  },
  'recent-patterns': {
    title: 'Recent Patterns',
    whatItMeans: 'This section surfaces the athlete’s most recent active pattern models.',
    whyItMatters: 'It is one of the clearest windows into what the engine currently believes about the athlete inside the pilot.',
    howToReadIt: 'Look for confidence, recommendation eligibility, and freshness together. A pattern is more useful when those line up.',
  },
  'recent-projections': {
    title: 'Recent Projections',
    whatItMeans: 'This section lists the latest recommendation or interpretation projections generated for the athlete.',
    whyItMatters: 'It shows whether the learning engine is turning signal into athlete-facing or coach-facing output that the experiment can evaluate.',
    howToReadIt: 'Use this to judge practical output readiness, not just learning depth.',
  },
  'snapshot-history': {
    title: 'Snapshot History',
    whatItMeans: 'This section tracks the athlete’s pilot-linked profile snapshots across time.',
    whyItMatters: 'Longitudinal interpretation is often where research value emerges. Snapshot history helps reviewers see whether the athlete story is coherent across pilot moments.',
    howToReadIt: 'Read for change over time, not just for the latest point-in-time statement.',
  },
} satisfies Record<string, PilotDashboardMetricExplanation>;

export type PilotDashboardMetricExplanationKey = keyof typeof PILOT_DASHBOARD_METRIC_EXPLANATIONS;

export const getPilotDashboardMetricExplanation = (
  key: PilotDashboardMetricExplanationKey
): PilotDashboardMetricExplanation => PILOT_DASHBOARD_METRIC_EXPLANATIONS[key];
