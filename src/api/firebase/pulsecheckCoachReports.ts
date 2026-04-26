import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, getFirebaseModeRequestHeaders } from './config';
import type {
  CoachActionCandidate,
  CoachLanguagePostureAuditResult,
  GameDayLookFor,
  NamedAthleteWatchEntry,
  ReportDimensionStateMap,
} from './pulsecheckSportConfig';

export {
  enforceLanguagePosture,
  PULSECHECK_COACH_LANGUAGE_UNIVERSAL_BANLIST,
} from './pulsecheckSportConfig';
export type {
  CoachLanguagePostureAuditResult,
  CoachLanguagePostureViolation,
  CoachLanguageViolationSource,
} from './pulsecheckSportConfig';

export const SPORTS_INTELLIGENCE_REPORTS_ROOT_COLLECTION = 'teams';
export const SPORTS_INTELLIGENCE_REPORTS_SUBCOLLECTION = 'coachReports';
export const SPORTS_INTELLIGENCE_EMAIL_FUNCTION_PATH = '/.netlify/functions/send-sports-intelligence-report-email';

export type SportsIntelligenceConfidenceTier =
  | 'directional'
  | 'emerging'
  | 'stable'
  | 'high_confidence'
  | 'degraded';

export type CoachReportReviewStatus =
  | 'draft'
  | 'ready_for_review'
  | 'needs_review'
  | 'pending_review'
  | 'published'
  | 'sent'
  | 'archived';

export type CoachReportType = 'weekly' | 'game_day' | 'early_warning_candidate';
export type CoachReportDeliveryStatus = 'not_sent' | 'queued' | 'sent' | 'failed';
export type CoachReportSource = 'manual' | 'fixture' | 'generated' | 'demo_seed' | string;
export type SportsIntelligenceReviewStatus = CoachReportReviewStatus;

export interface CoachReportMeta {
  reportId?: string;
  teamId: string;
  teamName?: string;
  sportId: string;
  sportName?: string;
  reportType?: CoachReportType;
  weekStart?: string;
  weekLabel: string;
  generatedAt?: string;
  reviewedBy?: string;
  reviewerName?: string;
  reviewStatus?: CoachReportReviewStatus;
  source?: CoachReportSource;
  primarySportColor?: string;
  primarySportColorSoft?: string;
}

export interface CoachReportTopLine {
  whatChanged: string;
  who: string;
  firstAction: string;
  secondaryThread?: string;
}

export interface CoachReportWatchlistEntry {
  athleteName: string;
  role?: string;
  whyMatters: string;
  coachMove: string;
  readLabel?: string;
  supportingContext?: string[];
  evidenceRefs?: string[];
  confidenceTier?: NamedAthleteWatchEntry['confidenceTier'];
}

export interface CoachReportCoachAction extends CoachActionCandidate {
  id?: string;
  why?: string;
}

export interface CoachReportGameDayLookFor extends GameDayLookFor {
  id?: string;
}

export interface CoachReportAdherenceBlock {
  wearRate7d: number;
  noraCheckinCompletion7d: number;
  protocolOrSimCompletion7d: number;
  trainingOrNutritionCoverage7d: number;
  confidenceLabel: string;
  summary?: string;
  deviceCoveragePct?: number;
  noraCompletionPct?: number;
  protocolSimulationCompletionPct?: number;
  trainingNutritionCoveragePct?: number;
}

export type CoachReportAdherenceSummary = CoachReportAdherenceBlock;
export type CoachReportConfidenceLabel = 'Strong read' | 'Usable read' | 'Thin read' | 'Insufficient' | 'Holding back';

export interface CoachReportCoachSurface {
  meta: CoachReportMeta;
  topLine: CoachReportTopLine;
  dimensionState: Partial<ReportDimensionStateMap>;
  watchlist: CoachReportWatchlistEntry[];
  coachActions: CoachReportCoachAction[];
  gameDayLookFors: CoachReportGameDayLookFor[];
  noteOpener?: string;
  teamSynthesis?: string;
  closer?: string;
  adherence: CoachReportAdherenceBlock;
}

export interface CoachReportReviewerEvidence {
  athleteEvidenceRefs: string[];
  sourceProvenance: string[];
  confidenceTier?: SportsIntelligenceConfidenceTier | string;
  missingInputs: string[];
  thresholdTrace: string[];
  unsuppressedSignals: string[];
}

export interface CoachReportAuditTrace {
  localizationAuditResult?: CoachLanguagePostureAuditResult;
  suppressedWatchlistEntries: string[];
  suppressedCoachActions: any[];
  suppressionReasons: string[];
}

export interface CoachReportReviewerOnly {
  evidence: CoachReportReviewerEvidence;
  auditTrace: CoachReportAuditTrace;
}

export interface CoachReportRecipientAudit {
  email: string;
  userId?: string;
  role?: string;
  sentAt?: unknown;
}

export interface StoredCoachReport {
  id: string;
  teamId: string;
  sportId: string;
  weekStart: string;
  reportType?: CoachReportType;
  source?: CoachReportSource;
  reviewStatus: CoachReportReviewStatus;
  deliveryStatus?: CoachReportDeliveryStatus;
  coachSurface: CoachReportCoachSurface;
  reviewerOnly: CoachReportReviewerOnly;
  createdAt?: unknown;
  updatedAt?: unknown;
  publishedAt?: unknown;
  publishedBy?: string;
  sentAt?: unknown;
  sentTo?: CoachReportRecipientAudit[];
}

export interface CoachReportDraftInput {
  teamId: string;
  sportId: string;
  weekStart?: string;
  reportType?: CoachReportType;
  source?: CoachReportSource;
  reviewStatus?: CoachReportReviewStatus;
  deliveryStatus?: CoachReportDeliveryStatus;
  coachSurface: CoachReportCoachSurface;
  reviewerOnly: CoachReportReviewerOnly;
}

export interface CreateCoachReportDraftInput {
  reportType?: CoachReportType;
  teamName?: string;
  sportName?: string;
}

export interface ListCoachReportDraftsFilter {
  teamId?: string;
  sportId?: string;
  reviewStatus?: CoachReportReviewStatus;
  max?: number;
  limit?: number;
}

export interface PublishCoachReportOptions {
  publishedBy?: string;
  sendEmail?: boolean;
  emailEndpoint?: string;
  fetchImpl?: typeof fetch;
}

const normalizeRequiredId = (value: string, label: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`[SportsIntelligenceReports] ${label} is required.`);
  }
  return normalized;
};

const normalizeLimit = (value?: number) => {
  if (!Number.isFinite(value) || !value) return 25;
  return Math.min(Math.max(Math.floor(value), 1), 100);
};

const buildWeekLabel = (weekStart: string) => {
  const parsed = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return `Week of ${weekStart}`;
  }
  return `Week of ${parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

const reportCollectionRef = (teamId: string) =>
  collection(
    db,
    SPORTS_INTELLIGENCE_REPORTS_ROOT_COLLECTION,
    teamId,
    SPORTS_INTELLIGENCE_REPORTS_SUBCOLLECTION
  );

const reportDocRef = (teamId: string, reportId: string) =>
  doc(
    db,
    SPORTS_INTELLIGENCE_REPORTS_ROOT_COLLECTION,
    teamId,
    SPORTS_INTELLIGENCE_REPORTS_SUBCOLLECTION,
    reportId
  );

const stripUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined) continue;
    output[key] = stripUndefinedDeep(entry);
  }
  return output as T;
};

export const createEmptyCoachReportSurface = (input: {
  reportId?: string;
  teamId: string;
  sportId: string;
  weekStart: string;
  reportType?: CoachReportType;
  teamName?: string;
  sportName?: string;
}): CoachReportCoachSurface => {
  const reportType = input.reportType || 'weekly';
  return {
    meta: {
      reportId: input.reportId,
      teamId: input.teamId,
      teamName: input.teamName,
      sportId: input.sportId,
      sportName: input.sportName,
      reportType,
      weekStart: input.weekStart,
      weekLabel: buildWeekLabel(input.weekStart),
      generatedAt: new Date().toISOString(),
      reviewStatus: 'draft',
    },
    topLine: {
      whatChanged: '',
      who: '',
      firstAction: '',
    },
    dimensionState: {},
    watchlist: [],
    coachActions: [],
    gameDayLookFors: [],
    adherence: {
      wearRate7d: 0,
      noraCheckinCompletion7d: 0,
      protocolOrSimCompletion7d: 0,
      trainingOrNutritionCoverage7d: 0,
      deviceCoveragePct: 0,
      noraCompletionPct: 0,
      protocolSimulationCompletionPct: 0,
      trainingNutritionCoveragePct: 0,
      confidenceLabel: 'Thin read',
      summary: 'Participation is still being filled in by the Pulse team before this report goes to the coach.',
    },
  };
};

export const createEmptyCoachReportReviewerOnly = (): CoachReportReviewerOnly => ({
  evidence: {
    athleteEvidenceRefs: [],
    sourceProvenance: [],
    missingInputs: [],
    thresholdTrace: [],
    unsuppressedSignals: [],
  },
  auditTrace: {
    suppressedWatchlistEntries: [],
    suppressedCoachActions: [],
    suppressionReasons: [],
  },
});

const fromReportSnapshot = (snapshot: { id: string; data: () => unknown }): StoredCoachReport => ({
  id: snapshot.id,
  ...(snapshot.data() as Omit<StoredCoachReport, 'id'>),
});

export const createDraft = async (
  teamId: string,
  sportId: string,
  weekStart: string,
  source: CoachReportSource | CoachReportDraftInput,
  input: CreateCoachReportDraftInput = {}
): Promise<string> => {
  const scopedTeamId = normalizeRequiredId(teamId, 'teamId');
  const normalizedSportId = normalizeRequiredId(sportId, 'sportId');
  const normalizedWeekStart = normalizeRequiredId(weekStart, 'weekStart');
  const sourceDraft = typeof source === 'object' && source !== null ? source : undefined;
  const normalizedSource = sourceDraft
    ? sourceDraft.source || sourceDraft.coachSurface?.meta?.source || 'manual'
    : normalizeRequiredId(String(source || ''), 'source');

  const draftRef = doc(reportCollectionRef(scopedTeamId));
  const reportId = draftRef.id;
  const timestamp = serverTimestamp();
  const reportType = input.reportType || sourceDraft?.reportType || sourceDraft?.coachSurface?.meta?.reportType || 'weekly';
  const coachSurface = sourceDraft?.coachSurface
    ? {
        ...sourceDraft.coachSurface,
        meta: {
          ...sourceDraft.coachSurface.meta,
          reportId,
          teamId: scopedTeamId,
          sportId: normalizedSportId,
          reportType,
          weekStart: normalizedWeekStart,
          reviewStatus: sourceDraft.reviewStatus || sourceDraft.coachSurface.meta.reviewStatus || 'draft',
          source: normalizedSource,
        },
      }
    : createEmptyCoachReportSurface({
        reportId,
        teamId: scopedTeamId,
        sportId: normalizedSportId,
        weekStart: normalizedWeekStart,
        reportType,
        teamName: input.teamName,
        sportName: input.sportName,
      });
  const payload = stripUndefinedDeep({
    ...(sourceDraft || {}),
    teamId: scopedTeamId,
    sportId: normalizedSportId,
    weekStart: normalizedWeekStart,
    reportType,
    source: normalizedSource,
    reviewStatus: sourceDraft?.reviewStatus || 'draft' as CoachReportReviewStatus,
    deliveryStatus: sourceDraft?.deliveryStatus || 'not_sent' as CoachReportDeliveryStatus,
    coachSurface,
    reviewerOnly: sourceDraft?.reviewerOnly || createEmptyCoachReportReviewerOnly(),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await setDoc(draftRef, payload);
  return reportId;
};

export const updateDraft = async (
  teamId: string,
  reportId: string,
  partial: Partial<Omit<StoredCoachReport, 'id' | 'teamId'>>
): Promise<StoredCoachReport> => {
  const scopedTeamId = normalizeRequiredId(teamId, 'teamId');
  const normalizedReportId = normalizeRequiredId(reportId, 'reportId');
  const existing = await getReport(scopedTeamId, normalizedReportId);
  if (!existing) {
    throw new Error(`[SportsIntelligenceReports] Report ${normalizedReportId} was not found for team ${scopedTeamId}.`);
  }
  if (!['draft', 'ready_for_review', 'needs_review', 'pending_review'].includes(existing.reviewStatus)) {
    throw new Error(`[SportsIntelligenceReports] Report ${normalizedReportId} is ${existing.reviewStatus} and cannot be edited as a draft.`);
  }

  await setDoc(
    reportDocRef(scopedTeamId, normalizedReportId),
    stripUndefinedDeep({
      ...partial,
      updatedAt: serverTimestamp(),
    }),
    { merge: true }
  );

  const updated = await getReport(scopedTeamId, normalizedReportId);
  if (!updated) {
    throw new Error(`[SportsIntelligenceReports] Report ${normalizedReportId} disappeared after update.`);
  }
  return updated;
};

export const upsertDraft = async (
  teamId: string,
  reportId: string,
  report: CoachReportDraftInput
): Promise<StoredCoachReport> => {
  const scopedTeamId = normalizeRequiredId(teamId, 'teamId');
  const normalizedReportId = normalizeRequiredId(reportId, 'reportId');

  await setDoc(
    reportDocRef(scopedTeamId, normalizedReportId),
    stripUndefinedDeep({
      ...report,
      teamId: scopedTeamId,
      sportId: report.sportId,
      reviewStatus: report.reviewStatus || 'draft',
      deliveryStatus: report.deliveryStatus || 'not_sent',
      coachSurface: {
        ...report.coachSurface,
        meta: {
          ...report.coachSurface.meta,
          reportId: normalizedReportId,
          teamId: scopedTeamId,
          reviewStatus: report.reviewStatus || 'draft',
        },
      },
      updatedAt: serverTimestamp(),
    }),
    { merge: true }
  );

  const stored = await getReport(scopedTeamId, normalizedReportId);
  if (!stored) {
    throw new Error(`[SportsIntelligenceReports] Report ${normalizedReportId} was not found after save.`);
  }
  return stored;
};

export const getReport = async (teamId: string, reportId: string): Promise<StoredCoachReport | null> => {
  const scopedTeamId = normalizeRequiredId(teamId, 'teamId');
  const normalizedReportId = normalizeRequiredId(reportId, 'reportId');
  const snapshot = await getDoc(reportDocRef(scopedTeamId, normalizedReportId));
  if (!snapshot.exists()) return null;
  return fromReportSnapshot(snapshot);
};

export const listDrafts = async (filter: ListCoachReportDraftsFilter): Promise<StoredCoachReport[]> => {
  const scopedTeamId = normalizeRequiredId(filter.teamId || '', 'teamId');
  const constraints = [
    where('reviewStatus', '==', filter.reviewStatus || 'draft'),
    ...(filter.sportId ? [where('sportId', '==', filter.sportId)] : []),
    orderBy('updatedAt', 'desc'),
    limit(normalizeLimit(filter.limit || filter.max)),
  ];
  const snapshot = await getDocs(query(reportCollectionRef(scopedTeamId), ...constraints));
  return snapshot.docs.map(fromReportSnapshot);
};

export const listSentForTeam = async (teamId: string, maxResults = 25): Promise<StoredCoachReport[]> => {
  const scopedTeamId = normalizeRequiredId(teamId, 'teamId');
  const snapshot = await getDocs(
    query(
      reportCollectionRef(scopedTeamId),
      where('reviewStatus', 'in', ['published', 'sent']),
      orderBy('publishedAt', 'desc'),
      limit(normalizeLimit(maxResults))
    )
  );
  return snapshot.docs.map(fromReportSnapshot);
};

const sendPublishedReportEmail = async (
  teamId: string,
  reportId: string,
  options: PublishCoachReportOptions
) => {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(options.emailEndpoint || SPORTS_INTELLIGENCE_EMAIL_FUNCTION_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getFirebaseModeRequestHeaders(),
    },
    body: JSON.stringify({ teamId, reportId }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`[SportsIntelligenceReports] Email send failed for ${reportId}: ${message || response.statusText}`);
  }
};

export const publish = async (
  teamId: string,
  reportId: string,
  options: PublishCoachReportOptions = {}
): Promise<StoredCoachReport> => {
  const scopedTeamId = normalizeRequiredId(teamId, 'teamId');
  const normalizedReportId = normalizeRequiredId(reportId, 'reportId');
  const existing = await getReport(scopedTeamId, normalizedReportId);
  if (!existing) {
    throw new Error(`[SportsIntelligenceReports] Report ${normalizedReportId} was not found for team ${scopedTeamId}.`);
  }

  await updateDoc(
    reportDocRef(scopedTeamId, normalizedReportId),
    stripUndefinedDeep({
      reviewStatus: 'published' as CoachReportReviewStatus,
      deliveryStatus: 'queued' as CoachReportDeliveryStatus,
      publishedAt: serverTimestamp(),
      publishedBy: options.publishedBy,
      updatedAt: serverTimestamp(),
    })
  );

  if (options.sendEmail !== false) {
    await sendPublishedReportEmail(scopedTeamId, normalizedReportId, options);
  }

  const published = await getReport(scopedTeamId, normalizedReportId);
  if (!published) {
    throw new Error(`[SportsIntelligenceReports] Report ${normalizedReportId} disappeared after publish.`);
  }
  return published;
};

export const pulsecheckCoachReportService = {
  createDraft,
  upsertDraft,
  updateDraft,
  publish,
  listDrafts,
  getReport,
  listSentForTeam,
};
