import { collection, doc } from 'firebase/firestore';
import { db } from '../config';
import {
  ATHLETE_PATTERN_MODELS_SUBCOLLECTION,
  ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION,
  CORRELATION_EVIDENCE_RECORDS_SUBCOLLECTION,
  PATTERN_MODEL_REVISIONS_SUBCOLLECTION,
  RECOMMENDATION_PROJECTIONS_SUBCOLLECTION,
} from './collections';
import type {
  AthletePhysiologyCognitionEngineRoot,
  CorrelationConsumer,
  CorrelationEngineTraceMetadata,
  CorrelationPatternFamily,
} from './correlationEngineTypes';

function sanitizeSegment(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'unknown'
  );
}

function buildTraceId(operation: CorrelationEngineTraceMetadata['operation'], createdAt: number): string {
  return `${sanitizeSegment(operation)}_${createdAt}`;
}

export function buildCorrelationEvidenceId(input: {
  sourceWindowStart: number;
  sourceWindowEnd: number;
  simSessionId: string;
}): string {
  return `ev__${input.sourceWindowStart}__${input.sourceWindowEnd}__${sanitizeSegment(input.simSessionId)}`;
}

export function buildAthletePatternKey(input: {
  patternFamily: CorrelationPatternFamily;
  targetDomain: string;
}): string {
  return `pat__${sanitizeSegment(input.patternFamily)}__${sanitizeSegment(input.targetDomain)}`;
}

export function buildRecommendationProjectionKey(input: {
  consumer: CorrelationConsumer;
  projectionDate: string;
}): string {
  return `proj__${sanitizeSegment(input.consumer)}__${sanitizeSegment(input.projectionDate)}`;
}

export function buildPatternRevisionId(revision: number): string {
  return `r${String(revision).padStart(4, '0')}`;
}

export function buildCorrelationEngineTraceMetadata(
  input: Omit<CorrelationEngineTraceMetadata, 'traceId' | 'createdAt'> & { createdAt?: number }
): CorrelationEngineTraceMetadata {
  const createdAt = input.createdAt ?? Date.now();
  return {
    traceId: buildTraceId(input.operation, createdAt),
    createdAt,
    ...input,
  };
}

export function buildAthletePhysiologyCognitionRoot(
  athleteId: string,
  engineVersion: string,
  now = Date.now()
): AthletePhysiologyCognitionEngineRoot {
  return {
    athleteId,
    engineVersion,
    activePatternKeys: [],
    activeProjectionKeys: [],
    lastEvidenceAt: null,
    lastPatternRefreshAt: null,
    lastProjectionRefreshAt: null,
    lastEngineRefreshAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export const correlationEngineService = {
  buildEvidenceId: buildCorrelationEvidenceId,
  buildPatternKey: buildAthletePatternKey,
  buildProjectionKey: buildRecommendationProjectionKey,
  buildPatternRevisionId,
  buildTraceMetadata: buildCorrelationEngineTraceMetadata,
  buildRoot: buildAthletePhysiologyCognitionRoot,

  buildRootPath(athleteId: string) {
    return `${ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION}/${athleteId}`;
  },

  buildEvidenceCollectionPath(athleteId: string) {
    return `${this.buildRootPath(athleteId)}/${CORRELATION_EVIDENCE_RECORDS_SUBCOLLECTION}`;
  },

  buildEvidencePath(athleteId: string, evidenceId: string) {
    return `${this.buildEvidenceCollectionPath(athleteId)}/${evidenceId}`;
  },

  buildPatternCollectionPath(athleteId: string) {
    return `${this.buildRootPath(athleteId)}/${ATHLETE_PATTERN_MODELS_SUBCOLLECTION}`;
  },

  buildPatternPath(athleteId: string, patternKey: string) {
    return `${this.buildPatternCollectionPath(athleteId)}/${patternKey}`;
  },

  buildPatternRevisionCollectionPath(athleteId: string, patternKey: string) {
    return `${this.buildPatternPath(athleteId, patternKey)}/${PATTERN_MODEL_REVISIONS_SUBCOLLECTION}`;
  },

  buildPatternRevisionPath(athleteId: string, patternKey: string, revisionId: string) {
    return `${this.buildPatternRevisionCollectionPath(athleteId, patternKey)}/${revisionId}`;
  },

  buildProjectionCollectionPath(athleteId: string) {
    return `${this.buildRootPath(athleteId)}/${RECOMMENDATION_PROJECTIONS_SUBCOLLECTION}`;
  },

  buildProjectionPath(athleteId: string, projectionKey: string) {
    return `${this.buildProjectionCollectionPath(athleteId)}/${projectionKey}`;
  },

  rootRef(athleteId: string) {
    return doc(db, ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION, athleteId);
  },

  evidenceCollectionRef(athleteId: string) {
    return collection(this.rootRef(athleteId), CORRELATION_EVIDENCE_RECORDS_SUBCOLLECTION);
  },

  evidenceRef(athleteId: string, evidenceId: string) {
    return doc(this.evidenceCollectionRef(athleteId), evidenceId);
  },

  patternCollectionRef(athleteId: string) {
    return collection(this.rootRef(athleteId), ATHLETE_PATTERN_MODELS_SUBCOLLECTION);
  },

  patternRef(athleteId: string, patternKey: string) {
    return doc(this.patternCollectionRef(athleteId), patternKey);
  },

  patternRevisionCollectionRef(athleteId: string, patternKey: string) {
    return collection(this.patternRef(athleteId, patternKey), PATTERN_MODEL_REVISIONS_SUBCOLLECTION);
  },

  patternRevisionRef(athleteId: string, patternKey: string, revisionId: string) {
    return doc(this.patternRevisionCollectionRef(athleteId, patternKey), revisionId);
  },

  projectionCollectionRef(athleteId: string) {
    return collection(this.rootRef(athleteId), RECOMMENDATION_PROJECTIONS_SUBCOLLECTION);
  },

  projectionRef(athleteId: string, projectionKey: string) {
    return doc(this.projectionCollectionRef(athleteId), projectionKey);
  },
};
