import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './config';
import { pulseCheckProvisioningService } from './pulsecheckProvisioning/service';
import type { PulseCheckTeam, PulseCheckTeamMembership, PulseCheckTeamMembershipRole } from './pulsecheckProvisioning/types';
import { convertFirestoreTimestamp } from '../../utils/formatDate';

const COACH_REPORTS_COLLECTION = 'coachReports';
const COACH_VISIBLE_REPORT_STATUSES = new Set(['published', 'sent', 'delivered']);
const COACH_REPORT_ACCESS_ROLES = new Set<PulseCheckTeamMembershipRole>(['team-admin', 'coach', 'performance-staff']);

export interface CoachReportAdherenceSummary {
  categoriesReady?: number;
  categoriesTotal?: number;
  label?: string;
  summary?: string;
}

export interface CoachReportListItem {
  id: string;
  reportId: string;
  teamId: string;
  teamName: string;
  sportId?: string;
  sportName: string;
  title: string;
  weekLabel: string;
  generatedAt?: Date;
  publishedAt?: Date;
  sentAt?: Date;
  reviewStatus?: string;
  adherence: CoachReportAdherenceSummary;
  href: string;
}

type CoachReportDocData = Record<string, any>;

const parseReportDate = (value: unknown): Date | undefined => {
  if (value == null) return undefined;
  const date = convertFirestoreTimestamp(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatWeekLabelFromDate = (date?: Date) => {
  if (!date) return 'Latest reviewed report';
  return `Week of ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
};

const isCoachVisibleReport = (data: CoachReportDocData) => {
  const reviewStatus = String(data.reviewStatus || data.status || '').trim().toLowerCase();
  const deliveryStatus = String(data.deliveryStatus || '').trim().toLowerCase();
  return (
    COACH_VISIBLE_REPORT_STATUSES.has(reviewStatus) ||
    COACH_VISIBLE_REPORT_STATUSES.has(deliveryStatus) ||
    Boolean(data.publishedAt || data.sentAt)
  );
};

const countReadyCategories = (adherence: CoachReportDocData) => {
  const explicitReady = Number(adherence.categoriesReady ?? adherence.readyCategories);
  const explicitTotal = Number(adherence.categoriesTotal ?? adherence.totalCategories);
  if (Number.isFinite(explicitReady) && Number.isFinite(explicitTotal) && explicitTotal > 0) {
    return {
      categoriesReady: Math.max(0, Math.min(explicitReady, explicitTotal)),
      categoriesTotal: explicitTotal,
    };
  }

  const possibleValues = [
    adherence.deviceCoveragePct ?? adherence.wearRatePct ?? adherence.wearRate7d,
    adherence.noraCompletionPct ?? adherence.noraCheckinCompletionPct ?? adherence.noraCheckinCompletion7d,
    adherence.protocolSimulationCompletionPct ?? adherence.protocolCompletionPct ?? adherence.simulationCompletionPct,
    adherence.trainingCoveragePct ?? adherence.trainingRpeCoveragePct ?? adherence.trainingCoverage,
  ];
  const ready = possibleValues.filter((value) => typeof value === 'number' && value >= 0.7).length;
  const present = possibleValues.filter((value) => typeof value === 'number').length;

  if (present === 0) return {};
  return {
    categoriesReady: ready,
    categoriesTotal: 4,
  };
};

export const normalizeCoachReportAdherence = (data?: CoachReportDocData | null): CoachReportAdherenceSummary => {
  const adherence = data || {};
  const counted = countReadyCategories(adherence);
  const label = String(adherence.label || adherence.confidenceLabel || adherence.readConfidenceLabel || '').trim();
  const summary = String(adherence.summary || adherence.coverageSummary || '').trim();

  return {
    ...counted,
    ...(label ? { label } : {}),
    ...(summary ? { summary } : {}),
  };
};

const resolveTeamName = (team?: PulseCheckTeam | null, membership?: PulseCheckTeamMembership) =>
  String(team?.displayName || membership?.teamId || 'Team').trim();

const normalizeReportListItem = (
  reportId: string,
  teamId: string,
  teamName: string,
  data: CoachReportDocData
): CoachReportListItem => {
  const coachSurface = data.coachSurface || data.report || data.coachView || data;
  const meta = coachSurface.meta || data.meta || {};
  const generatedAt = parseReportDate(meta.generatedAt || data.generatedAt || data.createdAt);
  const publishedAt = parseReportDate(data.publishedAt || data.reviewedAt);
  const sentAt = parseReportDate(data.sentAt || data.lastSentAt);
  const weekStart = parseReportDate(meta.weekStart || data.weekStart);
  const sportName = String(meta.sportName || data.sportName || meta.sport || data.sportId || 'Sports Intelligence').trim();

  return {
    id: reportId,
    reportId,
    teamId,
    teamName: String(meta.teamName || data.teamName || teamName || 'Team').trim(),
    sportId: String(data.sportId || meta.sportId || '').trim() || undefined,
    sportName,
    title: String(meta.title || data.title || 'Sports Intelligence Report').trim(),
    weekLabel: String(meta.weekLabel || data.weekLabel || '').trim() || formatWeekLabelFromDate(weekStart || generatedAt),
    generatedAt,
    publishedAt,
    sentAt,
    reviewStatus: String(data.reviewStatus || data.status || '').trim() || undefined,
    adherence: normalizeCoachReportAdherence(coachSurface.adherence || data.adherence || data.adherenceSummary),
    href: `/coach-reports/${encodeURIComponent(teamId)}/${encodeURIComponent(reportId)}`,
  };
};

export const listCoachSportsIntelligenceTeams = async (coachUserId: string) => {
  const memberships = (await pulseCheckProvisioningService.listUserTeamMemberships(coachUserId)).filter((membership) =>
    COACH_REPORT_ACCESS_ROLES.has(membership.role)
  );

  const teams = await Promise.all(
    memberships.map(async (membership) => ({
      membership,
      team: await pulseCheckProvisioningService.getTeam(membership.teamId),
    }))
  );

  return teams.map(({ membership, team }) => ({
    membership,
    team,
    teamName: resolveTeamName(team, membership),
  }));
};

export const listSentSportsIntelligenceReportsForTeam = async (
  teamId: string,
  teamName = 'Team'
): Promise<CoachReportListItem[]> => {
  const reportsQuery = query(
    collection(db, 'teams', teamId, COACH_REPORTS_COLLECTION),
    where('teamId', '==', teamId)
  );
  const snapshot = await getDocs(reportsQuery);

  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, data: docSnap.data() as CoachReportDocData }))
    .filter(({ data }) => isCoachVisibleReport(data))
    .map(({ id, data }) => normalizeReportListItem(id, teamId, teamName, data))
    .sort((left, right) => {
      const leftTime = (left.sentAt || left.publishedAt || left.generatedAt)?.getTime() || 0;
      const rightTime = (right.sentAt || right.publishedAt || right.generatedAt)?.getTime() || 0;
      return rightTime - leftTime;
    });
};

export const listSentSportsIntelligenceReportsForCoach = async (coachUserId: string): Promise<CoachReportListItem[]> => {
  const teams = await listCoachSportsIntelligenceTeams(coachUserId);
  const reportsByTeam = await Promise.all(
    teams.map(({ membership, teamName }) => listSentSportsIntelligenceReportsForTeam(membership.teamId, teamName))
  );

  return reportsByTeam
    .flat()
    .sort((left, right) => {
      const leftTime = (left.sentAt || left.publishedAt || left.generatedAt)?.getTime() || 0;
      const rightTime = (right.sentAt || right.publishedAt || right.generatedAt)?.getTime() || 0;
      return rightTime - leftTime;
    });
};

export const getLatestSportsIntelligenceReportForCoach = async (
  coachUserId: string
): Promise<CoachReportListItem | null> => {
  const [latest] = await listSentSportsIntelligenceReportsForCoach(coachUserId);
  return latest || null;
};
