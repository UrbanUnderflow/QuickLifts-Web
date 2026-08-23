export type PulseCheckMoodLabel = 'Good' | 'Mixed' | 'Low';

export interface PulseCheckMoodHistorySource {
  label: string;
  sentimentScore: number;
  messageCount?: number;
}

export interface PulseCheckMoodEvidenceInput {
  hasEvidence: boolean;
  selfReportLevel?: string | null;
  selfReportPeriod?: 'Morning' | 'Evening' | null;
  noraSentimentScore?: number | null;
  noraMessageCount?: number;
  historySentimentScore?: number | null;
  historyMessageCount?: number;
  historySources?: readonly PulseCheckMoodHistorySource[];
  demoSignalScore?: number | null;
}

export interface PulseCheckMoodEvidence {
  score: number;
  label: PulseCheckMoodLabel;
  sourceLabel: string;
  sourceReadingLabel: string;
  explanation: string;
  wearableRole: string;
}

export const readinessLevelSentiment = (level?: string | null): number | null => {
  const normalized = String(level || '').trim().toLowerCase().replace(/-/g, '_');
  if (['locked', 'locked_in', 'great'].includes(normalized)) return 0.85;
  if (['solid', 'good', 'ready'].includes(normalized)) return 0.45;
  if (['okay', 'ok', 'mixed', 'neutral'].includes(normalized)) return 0;
  if (['low', 'rough', 'off'].includes(normalized)) return -0.45;
  if (['drained', 'terrible'].includes(normalized)) return -0.8;
  return null;
};

export const pulseCheckMoodLabel = (score: number): PulseCheckMoodLabel =>
  score >= 0.3 ? 'Good' : score >= -0.3 ? 'Mixed' : 'Low';

const formatScore = (score: number): string => `${score >= 0 ? '+' : ''}${score.toFixed(2)}`;

const levelLabel = (level?: string | null): string => {
  const normalized = String(level || '').trim().replace(/[_-]+/g, ' ');
  if (!normalized) return 'No mood level';
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const rangeLabel = (label: PulseCheckMoodLabel): string => {
  if (label === 'Good') return 'Good range (at least +0.30)';
  if (label === 'Low') return 'Low range (below -0.30)';
  return 'Mixed range (-0.30 to below +0.30)';
};

const joinLabels = (labels: string[]): string => {
  if (labels.length <= 1) return labels[0] || 'PulseCheck history';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
};

const result = (
  score: number,
  sourceLabel: string,
  explanationLead: string,
): PulseCheckMoodEvidence => {
  const label = pulseCheckMoodLabel(score);
  return {
    score,
    label,
    sourceLabel,
    sourceReadingLabel: `${formatScore(score)} · ${rangeLabel(label)}`,
    explanation: `${explanationLead} The ${formatScore(score)} result falls in the ${label} range.`,
    wearableRole: 'Wearable data was not used to determine this Mood label.',
  };
};

export const derivePulseCheckMoodEvidence = (
  input: PulseCheckMoodEvidenceInput,
): PulseCheckMoodEvidence => {
  if (!input.hasEvidence) {
    return {
      score: 0,
      label: 'Mixed',
      sourceLabel: 'No mood evidence',
      sourceReadingLabel: 'No source reading',
      explanation: 'No self-report or sentiment evidence was recorded for this day.',
      wearableRole: 'Wearable data was not used to determine this Mood label.',
    };
  }

  if (input.demoSignalScore != null) {
    return result(input.demoSignalScore, 'Demo mood signal', 'The demo mood signal set this label.');
  }

  const selfReportScore = readinessLevelSentiment(input.selfReportLevel);
  if (input.hasEvidence && selfReportScore != null) {
    const period = input.selfReportPeriod ? `${input.selfReportPeriod} ` : '';
    return result(
      selfReportScore,
      `${period}self-report`,
      `The athlete selected "${levelLabel(input.selfReportLevel)}" in the ${period.toLowerCase()}check-in.`,
    );
  }

  if (
    input.hasEvidence
    && input.noraSentimentScore != null
    && (input.noraMessageCount ?? 0) > 0
  ) {
    return result(
      input.noraSentimentScore,
      'Nora conversation sentiment',
      `Nora conversation sentiment produced a ${formatScore(input.noraSentimentScore)} Mood score.`,
    );
  }

  if (
    input.hasEvidence
    && input.historySentimentScore != null
    && (input.historyMessageCount ?? 0) > 0
  ) {
    const sources = (input.historySources || []).filter((source) =>
      source.label.trim().length > 0 && Number.isFinite(source.sentimentScore)
    );
    const sourceLabel = sources.length === 1
      ? `PulseCheck history · ${sources[0].label}`
      : sources.length > 1
        ? `PulseCheck history · ${sources.length} inputs`
        : 'PulseCheck history';
    const explanationLead = sources.length > 0
      ? `${joinLabels(sources.map((source) => `${source.label} (${formatScore(source.sentimentScore)})`))} produced a combined PulseCheck history score of ${formatScore(input.historySentimentScore)}.`
      : `PulseCheck history produced a ${formatScore(input.historySentimentScore)} Mood score.`;
    return result(input.historySentimentScore, sourceLabel, explanationLead);
  }

  return result(
    0,
    'Recorded activity without a mood value',
    'Activity was recorded, but no recognized self-report or sentiment value was available, so the current fallback is neutral.',
  );
};
