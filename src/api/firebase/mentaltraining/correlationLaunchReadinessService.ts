import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../config';
import { correlationOpsService } from './correlationOpsService';
import { CORRELATION_ENGINE_MONITOR_EVENTS_COLLECTION } from './collections';
import type {
  AthletePatternModel,
  CorrelationEvidenceRecord,
  RecommendationProjection,
} from './correlationEngineTypes';

type QaScenarioStatus = 'pass' | 'fail' | 'not_applicable';
type GateStatus = 'pass' | 'fail';

export interface CorrelationQaScenarioResult {
  key: string;
  status: QaScenarioStatus;
  summary: string;
  details?: Record<string, unknown>;
}

export interface CorrelationReadinessGateResult {
  key: string;
  status: GateStatus;
  summary: string;
  details?: Record<string, unknown>;
}

export interface CorrelationLaunchReadinessReport {
  athleteId: string;
  generatedAt: number;
  inspection: Awaited<ReturnType<typeof correlationOpsService.inspectAthlete>>;
  qaScenarios: CorrelationQaScenarioResult[];
  gates: CorrelationReadinessGateResult[];
  overallStatus: 'ready' | 'blocked';
}

function hasThresholdClaims(pattern: AthletePatternModel): boolean {
  return Boolean(pattern.sweetSpotRange || pattern.minimumFloor || pattern.instabilityBand || pattern.bestTrainingWindow);
}

function isProjectionSafeWithoutEvidence(projection: RecommendationProjection): boolean {
  return projection.supportingPatternKeys.length === 0
    && (projection.confidenceTier === 'directional' || projection.confidenceTier === 'degraded')
    && /learning|not enough|still learning/i.test(`${projection.summaryTitle} ${projection.summaryBody}`);
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

export const correlationLaunchReadinessService = {
  async evaluateAthlete(athleteId: string): Promise<CorrelationLaunchReadinessReport> {
    const [inspection, bundle] = await Promise.all([
      correlationOpsService.inspectAthlete(athleteId),
      correlationOpsService.buildResearchBundle(athleteId),
    ]);

    const evidence = bundle.evidence;
    const patterns = bundle.patterns;
    const projections = bundle.projections;
    const milestoneSnapshots = bundle.milestoneSnapshots;
    const now = Date.now();

    const noPhysiologyScenario: CorrelationQaScenarioResult = evidence.length === 0
      ? {
          key: 'no_physiology_connected',
          status: projections.every(isProjectionSafeWithoutEvidence) ? 'pass' : 'fail',
          summary: projections.every(isProjectionSafeWithoutEvidence)
            ? 'Engine stays in learning posture when no physiology evidence exists.'
            : 'Engine is producing stronger-than-allowed claims without physiology evidence.',
          details: { projectionCount: projections.length },
        }
      : {
          key: 'no_physiology_connected',
          status: 'not_applicable',
          summary: 'Athlete already has physiology-linked evidence.',
        };

    const earlyDataScenario: CorrelationQaScenarioResult = inspection.evidenceDensityDays > 0 && inspection.evidenceDensityDays < 7
      ? {
          key: 'early_data_athlete',
          status: patterns.every((pattern) =>
            ['directional', 'emerging', 'degraded'].includes(pattern.confidenceTier)
            && !hasThresholdClaims(pattern)
          ) ? 'pass' : 'fail',
          summary: patterns.every((pattern) =>
            ['directional', 'emerging', 'degraded'].includes(pattern.confidenceTier)
            && !hasThresholdClaims(pattern)
          )
            ? 'Early-data posture stays directional and avoids explicit threshold claims.'
            : 'Early-data athlete has patterns that are claiming more precision than allowed.',
          details: { evidenceDensityDays: inspection.evidenceDensityDays, patternCount: patterns.length },
        }
      : {
          key: 'early_data_athlete',
          status: 'not_applicable',
          summary: 'Athlete is not in the early-data window.',
        };

    const stableOuraScenario: CorrelationQaScenarioResult = evidence.some((record) => record.physiology.sourceFamily === 'oura')
      ? {
          key: 'stable_oura_backed_athlete',
          status: patterns.some((pattern) => ['stable', 'high_confidence'].includes(pattern.confidenceTier))
            && projections.some((projection) => projection.supportingPatternKeys.length > 0)
            ? 'pass'
            : 'fail',
          summary: patterns.some((pattern) => ['stable', 'high_confidence'].includes(pattern.confidenceTier))
            && projections.some((projection) => projection.supportingPatternKeys.length > 0)
            ? 'Oura-backed athlete shows stable pattern learning and projected outputs.'
            : 'Oura-backed athlete does not yet produce stable learned patterns and projections.',
          details: {
            ouraEvidenceCount: evidence.filter((record) => record.physiology.sourceFamily === 'oura').length,
            stablePatternCount: patterns.filter((pattern) => ['stable', 'high_confidence'].includes(pattern.confidenceTier)).length,
          },
        }
      : {
          key: 'stable_oura_backed_athlete',
          status: 'not_applicable',
          summary: 'Athlete has no Oura-backed evidence in the current bundle.',
        };

    const contradictionScenario: CorrelationQaScenarioResult = inspection.contradictionFlagCount > 0
      ? {
          key: 'contradictory_recent_evidence',
          status: inspection.degradedPatternCount > 0 ? 'pass' : 'fail',
          summary: inspection.degradedPatternCount > 0
            ? 'Contradictory evidence degrades active pattern confidence as expected.'
            : 'Contradictory evidence is present without degraded pattern posture.',
          details: {
            contradictionFlagCount: inspection.contradictionFlagCount,
            degradedPatternCount: inspection.degradedPatternCount,
          },
        }
      : {
          key: 'contradictory_recent_evidence',
          status: 'not_applicable',
          summary: 'No contradiction spike is present in recent evidence.',
        };

    const compromisedMilestoneScenario: CorrelationQaScenarioResult = milestoneSnapshots.some(
      (snapshot) => snapshot.profilePayload.stateContextAtCapture?.assessmentContextFlag?.status === 'compromised'
    )
      ? {
          key: 'milestone_compromised_recovery',
          status: milestoneSnapshots.every((snapshot) => {
            const flag = snapshot.profilePayload.stateContextAtCapture?.assessmentContextFlag;
            return !flag || (flag.milestoneType === snapshot.milestoneType && Boolean(flag.athleteSafeSummary) && Boolean(flag.coachDetailSummary));
          }) ? 'pass' : 'fail',
          summary: milestoneSnapshots.every((snapshot) => {
            const flag = snapshot.profilePayload.stateContextAtCapture?.assessmentContextFlag;
            return !flag || (flag.milestoneType === snapshot.milestoneType && Boolean(flag.athleteSafeSummary) && Boolean(flag.coachDetailSummary));
          })
            ? 'Compromised milestone captures carry valid assessment context flags.'
            : 'A compromised milestone capture is missing a valid assessment context flag payload.',
        }
      : {
          key: 'milestone_compromised_recovery',
          status: 'not_applicable',
          summary: 'No milestone in the current bundle is graded as compromised.',
        };

    const mirroredOrStaleScenario: CorrelationQaScenarioResult = evidence.some(
      (record) => record.quality.qualityFlags.includes('mirrored_source') || record.quality.qualityFlags.some((flag) => flag.startsWith('freshness_'))
    )
      ? {
          key: 'mirrored_or_stale_source',
          status: projections.some((projection) => ['watch', 'caution', 'protect'].includes(projection.warningLevel))
            || inspection.staleEvidenceCount > 0
            ? 'pass'
            : 'fail',
          summary: projections.some((projection) => ['watch', 'caution', 'protect'].includes(projection.warningLevel))
            || inspection.staleEvidenceCount > 0
            ? 'Mirrored or stale posture is being surfaced and downshifted.'
            : 'Mirrored or stale posture exists without any downshifted warning surface.',
          details: {
            staleEvidenceCount: inspection.staleEvidenceCount,
            mirroredEvidenceCount: evidence.filter((record) => record.quality.qualityFlags.includes('mirrored_source')).length,
          },
        }
      : {
          key: 'mirrored_or_stale_source',
          status: 'not_applicable',
          summary: 'No mirrored or stale-source posture is present in recent evidence.',
        };

    const protocolRecommendationScenario: CorrelationQaScenarioResult = projections.some(
      (projection) => projection.consumer === 'protocol_planner' && projection.currentPhysiologyBand === 'low_recovery_protect_window'
    )
      ? {
          key: 'protocol_recommendation_under_low_recovery',
          status: projections.some(
            (projection) =>
              projection.consumer === 'protocol_planner'
              && projection.currentPhysiologyBand === 'low_recovery_protect_window'
              && (projection.recommendedMode === 'protect' || projection.warningLevel === 'protect')
          )
            ? 'pass'
            : 'fail',
          summary: projections.some(
            (projection) =>
              projection.consumer === 'protocol_planner'
              && projection.currentPhysiologyBand === 'low_recovery_protect_window'
              && (projection.recommendedMode === 'protect' || projection.warningLevel === 'protect')
          )
            ? 'Low-recovery protocol posture is protective instead of overconfident.'
            : 'Low-recovery protocol projection is not downshifting strongly enough.',
        }
      : {
          key: 'protocol_recommendation_under_low_recovery',
          status: 'not_applicable',
          summary: 'No low-recovery protocol-planner projection is present right now.',
        };

    const exportLineageScenario: CorrelationQaScenarioResult = {
      key: 'export_lineage_check',
      status:
        bundle.joinedRows.every((row) => Boolean(row.evidenceId && row.simSessionId))
        && milestoneSnapshots.every((snapshot) => !('assessmentContextFlag' in (snapshot as unknown as Record<string, unknown>)))
          ? 'pass'
          : 'fail',
      summary:
        bundle.joinedRows.every((row) => Boolean(row.evidenceId && row.simSessionId))
        && milestoneSnapshots.every((snapshot) => !('assessmentContextFlag' in (snapshot as unknown as Record<string, unknown>)))
          ? 'Research bundle preserves joined lineage without duplicate top-level assessment fields.'
          : 'Research bundle lineage or snapshot schema integrity is failing.',
      details: {
        joinedRowCount: bundle.joinedRows.length,
        milestoneSnapshotCount: milestoneSnapshots.length,
      },
    };

    const qaScenarios = [
      noPhysiologyScenario,
      earlyDataScenario,
      stableOuraScenario,
      contradictionScenario,
      compromisedMilestoneScenario,
      mirroredOrStaleScenario,
      protocolRecommendationScenario,
      exportLineageScenario,
    ];

    const recentMonitorEvents = await getDocs(
      query(collection(db, CORRELATION_ENGINE_MONITOR_EVENTS_COLLECTION), orderBy('createdAt', 'desc'), limit(50))
    );
    const athleteMonitorEvents = recentMonitorEvents.docs
      .map((entry) => entry.data() as Record<string, unknown>)
      .filter((event) => event.athleteId === athleteId);

    const gates: CorrelationReadinessGateResult[] = [
      {
        key: 'schema_gate',
        status: milestoneSnapshots.every((snapshot) =>
          snapshot.profilePayload.stateContextAtCapture
          && !('assessmentContextFlag' in (snapshot as unknown as Record<string, unknown>))
        ) ? 'pass' : 'fail',
        summary: milestoneSnapshots.every((snapshot) =>
          snapshot.profilePayload.stateContextAtCapture
          && !('assessmentContextFlag' in (snapshot as unknown as Record<string, unknown>))
        )
          ? 'Snapshot schema stays canonical and embeds assessment context inside stateContextAtCapture.'
          : 'Snapshot schema is missing embedded assessment context or appears to have drifted.',
      },
      {
        key: 'evidence_gate',
        status: inspection.evidenceDensityDays >= 7 && ratio(inspection.staleEvidenceCount, Math.max(inspection.evidenceCount, 1)) <= 0.34 ? 'pass' : 'fail',
        summary: inspection.evidenceDensityDays >= 7 && ratio(inspection.staleEvidenceCount, Math.max(inspection.evidenceCount, 1)) <= 0.34
          ? 'Evidence density and freshness are strong enough for continued rollout.'
          : 'Evidence density or freshness posture is still too weak for broader rollout.',
      },
      {
        key: 'pattern_gate',
        status: patterns.length > 0 && ratio(inspection.degradedPatternCount, Math.max(patterns.length, 1)) <= 0.5 ? 'pass' : 'fail',
        summary: patterns.length > 0 && ratio(inspection.degradedPatternCount, Math.max(patterns.length, 1)) <= 0.5
          ? 'Pattern layer is populated and not dominated by degraded posture.'
          : 'Pattern layer is empty or too degraded for trusted rollout.',
      },
      {
        key: 'projection_gate',
        status: projections.length >= 4
          && projections.every((projection) => projection.copyValidated && projection.medicalClaimCheck !== 'rejected')
          ? 'pass' : 'fail',
        summary: projections.length >= 4
          && projections.every((projection) => projection.copyValidated && projection.medicalClaimCheck !== 'rejected')
          ? 'Consumer projections are populated and validator-safe.'
          : 'Projection layer is incomplete or contains invalid outputs.',
      },
      {
        key: 'assessment_gate',
        status: Object.values(inspection.milestoneAssessmentCoverage).every((entry) => entry.present) ? 'pass' : 'fail',
        summary: Object.values(inspection.milestoneAssessmentCoverage).every((entry) => entry.present)
          ? 'Milestone snapshots all carry assessment context flags.'
          : 'One or more milestone snapshots are missing assessment context flags.',
      },
      {
        key: 'ops_gate',
        status: athleteMonitorEvents.length > 0 || inspection.alerts.length === 0 ? 'pass' : 'fail',
        summary: athleteMonitorEvents.length > 0 || inspection.alerts.length === 0
          ? 'Operational monitoring is producing inspectable signals for this athlete scope.'
          : 'Operational monitoring has not yet produced enough signal to trust launch support.',
      },
      {
        key: 'qa_gate',
        status: qaScenarios.every((scenario) => scenario.status !== 'fail') ? 'pass' : 'fail',
        summary: qaScenarios.every((scenario) => scenario.status !== 'fail')
          ? 'Launch-blocking QA scenarios are either passing or not applicable.'
          : 'At least one launch-blocking QA scenario is currently failing.',
      },
    ];

    return {
      athleteId,
      generatedAt: now,
      inspection,
      qaScenarios,
      gates,
      overallStatus: gates.every((gate) => gate.status === 'pass') ? 'ready' : 'blocked',
    };
  },
};
