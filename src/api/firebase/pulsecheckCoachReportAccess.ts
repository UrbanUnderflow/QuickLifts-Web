import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './config';
import { pulseCheckProvisioningService } from './pulsecheckProvisioning/service';
import type {
  PulseCheckOrganization,
  PulseCheckTeam,
  PulseCheckTeamMembership,
  PulseCheckTeamMembershipRole,
} from './pulsecheckProvisioning/types';
import { convertFirestoreTimestamp } from '../../utils/formatDate';

const COACH_REPORTS_COLLECTION = 'coachReportViews';
const COACH_VISIBLE_REPORT_STATUSES = new Set(['published', 'sent', 'delivered']);
const COACH_REPORT_ACCESS_ROLES = new Set<PulseCheckTeamMembershipRole>(['team-admin', 'coach', 'performance-staff']);
const SAFE_FIRESTORE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export interface CoachReportAdherenceSummary {
  categoriesReady?: number;
  categoriesTotal?: number;
  overallAdherencePct?: number;
  noraCheckinCompletionPct?: number;
  mentalTrainingCompletionPct?: number;
  followUpCount?: number;
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

export interface AuthorizedCoachReportTeam {
  membership: PulseCheckTeamMembership;
  organization: PulseCheckOrganization;
  team: PulseCheckTeam;
  teamName: string;
}

const normalizeSafeId = (value: string) => {
  const normalized = String(value || '').trim();
  return SAFE_FIRESTORE_ID.test(normalized) ? normalized : '';
};

export const isActiveCoachReportMembership = (membership?: PulseCheckTeamMembership | null) => {
  if (!membership || membership.revokedAt) return false;
  const status = String(membership.status || '').trim().toLowerCase();
  return status === '' || status === 'active';
};

export const canAccessCoachReports = (membership?: PulseCheckTeamMembership | null) => {
  if (!membership || !COACH_REPORT_ACCESS_ROLES.has(membership.role)) return false;
  if (membership.role === 'team-admin') return true;
  if (Array.isArray(membership.staffCapabilities) && membership.staffCapabilities.length > 0) {
    return (
      membership.staffCapabilities.includes('admin')
      || membership.staffCapabilities.includes('coaching')
    );
  }
  return membership.role === 'coach' || membership.role === 'performance-staff';
};

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

const normalizeRatio = (value: unknown): number | undefined => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(0, Math.min(1, numeric > 1 ? numeric / 100 : numeric));
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
    normalizeRatio(adherence.deviceCoveragePct ?? adherence.wearRatePct ?? adherence.wearRate7d),
    normalizeRatio(adherence.noraCompletionPct ?? adherence.noraCheckinCompletionPct ?? adherence.noraCheckinCompletion7d),
    normalizeRatio(adherence.protocolSimulationCompletionPct ?? adherence.protocolCompletionPct ?? adherence.simulationCompletionPct),
    normalizeRatio(adherence.trainingCoveragePct ?? adherence.trainingRpeCoveragePct ?? adherence.trainingCoverage),
  ];
  const ready = possibleValues.filter((value) => typeof value === 'number' && value >= 0.7).length;
  const present = possibleValues.filter((value) => typeof value === 'number').length;

  if (present === 0) return {};
  return {
    categoriesReady: ready,
    categoriesTotal: 4,
  };
};

const normalizePct = (value: unknown): number | undefined => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(0, Math.min(100, numeric <= 1 ? numeric * 100 : numeric));
};

export const normalizeCoachReportAdherence = (data?: CoachReportDocData | null): CoachReportAdherenceSummary => {
  const adherence = data || {};
  const counted = countReadyCategories(adherence);
  const label = String(adherence.label || adherence.confidenceLabel || adherence.readConfidenceLabel || '').trim();
  const summary = String(adherence.summary || adherence.coverageSummary || '').trim();
  const noraPct = normalizePct(
    adherence.noraCompletionPct ?? adherence.noraCheckinCompletionPct ?? adherence.noraCheckinCompletion7d,
  );
  const mentalTrainingPct = normalizePct(
    adherence.protocolSimulationCompletionPct ?? adherence.protocolCompletionPct ?? adherence.simulationCompletionPct ?? adherence.protocolOrSimCompletion7d,
  );
  const explicitOverall = normalizePct(adherence.overallAdherencePct ?? adherence.overallAdherenceRate);
  const overallAdherencePct =
    explicitOverall
    ?? (noraPct !== undefined && mentalTrainingPct !== undefined ? (noraPct + mentalTrainingPct) / 2 : undefined);
  const followUpCount = Array.isArray(adherence.followUpAthletes) ? adherence.followUpAthletes.length : undefined;

  return {
    ...counted,
    ...(overallAdherencePct !== undefined ? { overallAdherencePct } : {}),
    ...(noraPct !== undefined ? { noraCheckinCompletionPct: noraPct } : {}),
    ...(mentalTrainingPct !== undefined ? { mentalTrainingCompletionPct: mentalTrainingPct } : {}),
    ...(followUpCount !== undefined ? { followUpCount } : {}),
    ...(label ? { label } : {}),
    ...(summary ? { summary } : {}),
  };
};

const resolveTeamName = (team?: PulseCheckTeam | null, membership?: PulseCheckTeamMembership) =>
  String(team?.displayName || membership?.teamId || 'Team').trim();

export const resolveAuthorizedCoachReportTeam = async (
  coachUserId: string,
  requestedTeamId: string
): Promise<AuthorizedCoachReportTeam | null> => {
  const userId = String(coachUserId || '').trim();
  const teamId = normalizeSafeId(requestedTeamId);
  if (!userId || !teamId) return null;

  const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(userId);
  const eligibleMemberships = memberships.filter(
    (membership) =>
      membership.userId === userId
      && membership.teamId === teamId
      && canAccessCoachReports(membership)
      && isActiveCoachReportMembership(membership)
  );
  if (eligibleMemberships.length === 0) return null;

  const team = await pulseCheckProvisioningService.getTeam(teamId);
  if (!team || team.status !== 'active' || normalizeSafeId(team.organizationId) === '') return null;

  const membership = eligibleMemberships.find(
    (entry) => entry.organizationId === team.organizationId
  );
  if (!membership) return null;

  const organization = await pulseCheckProvisioningService.getOrganization(team.organizationId);
  if (!organization || organization.status !== 'active' || organization.id !== team.organizationId) {
    return null;
  }

  return {
    membership,
    organization,
    team,
    teamName: resolveTeamName(team, membership),
  };
};

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
  const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(coachUserId);
  const teamIds = Array.from(
    new Set(
      memberships
        .filter(
          (membership) =>
            membership.userId === coachUserId
            && canAccessCoachReports(membership)
            && isActiveCoachReportMembership(membership)
        )
        .map((membership) => normalizeSafeId(membership.teamId))
        .filter(Boolean)
    )
  );

  const resolved = await Promise.all(
    teamIds.map((teamId) => resolveAuthorizedCoachReportTeam(coachUserId, teamId))
  );
  return resolved.filter((entry): entry is AuthorizedCoachReportTeam => Boolean(entry));
};

export const listSentSportsIntelligenceReportsForTeam = async (
  teamId: string,
  teamName = 'Team'
): Promise<CoachReportListItem[]> => {
  const reportsQuery = query(
    collection(db, 'teams', teamId, COACH_REPORTS_COLLECTION),
    where('teamId', '==', teamId),
    where('reviewStatus', 'in', ['published', 'sent'])
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

export const listSentSportsIntelligenceReportsForAuthorizedTeam = async (
  coachUserId: string,
  teamId: string
): Promise<CoachReportListItem[]> => {
  const access = await resolveAuthorizedCoachReportTeam(coachUserId, teamId);
  if (!access) return [];
  return listSentSportsIntelligenceReportsForTeam(access.team.id, access.teamName);
};

export const getLatestSportsIntelligenceReportForCoach = async (
  coachUserId: string
): Promise<CoachReportListItem | null> => {
  const [latest] = await listSentSportsIntelligenceReportsForCoach(coachUserId);
  return latest || null;
};
