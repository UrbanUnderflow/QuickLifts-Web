import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { auth } from '../../api/firebase/config';
import {
  fetchPulseCheckSportConfiguration,
  getDefaultPulseCheckSports,
  savePulseCheckSportConfiguration,
  type PulseCheckSportAttributeDefinition,
  type PulseCheckSportAttributeOption,
  type PulseCheckSportAttributeScope,
  type PulseCheckSportAttributeType,
  type PulseCheckSportMetricDefinition,
  type PulseCheckSportConfigurationEntry,
} from '../../api/firebase/pulsecheckSportConfig';

type EditableAttribute = PulseCheckSportAttributeDefinition & {
  optionsInput: string;
};

type EditableMetric = PulseCheckSportMetricDefinition;

type EditableSport = Omit<PulseCheckSportConfigurationEntry, 'attributes' | 'metrics' | 'prompting'> & {
  positionsInput: string;
  attributes: EditableAttribute[];
  metrics: EditableMetric[];
  noraContextInput: string;
  macraNutritionContextInput: string;
  riskFlagsInput: string;
  restrictedAdviceInput: string;
  recommendedLanguageInput: string;
};

const ATTRIBUTE_TYPES: PulseCheckSportAttributeType[] = ['text', 'number', 'date', 'boolean', 'singleSelect', 'multiSelect'];
const ATTRIBUTE_SCOPES: PulseCheckSportAttributeScope[] = ['athlete', 'team', 'season', 'competition', 'nutrition', 'recovery'];
const SPORT_INTELLIGENCE_BRIDGE_ENDPOINT = '/api/openai/v1/chat/completions';
const SPORT_INTELLIGENCE_FEATURE_ID = 'pulsecheckSportIntelligence';

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

type SportSeedingFeedback = {
  sportId: string;
  type: 'success' | 'error';
  message: string;
};

type GeneratedSportIntelligencePayload = {
  summary: string;
  sport: Pick<PulseCheckSportConfigurationEntry, 'emoji' | 'positions' | 'schemaVersion' | 'attributes' | 'metrics' | 'prompting'>;
};

type NormalizedGeneratedSportIntelligence = Omit<GeneratedSportIntelligencePayload['sport'], 'attributes' | 'metrics'> & {
  attributes: PulseCheckSportAttributeDefinition[];
  metrics: PulseCheckSportMetricDefinition[];
};

const extractFirstJSONObject = (value: string): string | null => {
  const startIndex = value.indexOf('{');
  if (startIndex < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < value.length; index += 1) {
    const char = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      return value.slice(startIndex, index + 1);
    }
  }

  return null;
};

const parseSportIntelligenceJSON = (content: string): GeneratedSportIntelligencePayload => {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const objectSlice = extractFirstJSONObject(withoutFence);
  const candidates = [trimmed, withoutFence, objectSlice].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    } catch (_error) {
      // Try the next representation. Models sometimes wrap JSON in prose or markdown fences.
    }
  }

  throw new Error('OpenAI bridge returned sport intelligence that was not valid JSON.');
};

const makeEditableAttribute = (attribute: PulseCheckSportAttributeDefinition): EditableAttribute => ({
  ...attribute,
  optionsInput: (attribute.options || []).map((option) => `${option.label}|${option.value}`).join('\n'),
});

const newLocalId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildEditableSports = (sports: PulseCheckSportConfigurationEntry[]): EditableSport[] =>
  sports.map((sport) => ({
    ...sport,
    positionsInput: sport.positions.join(', '),
    attributes: (sport.attributes || []).map(makeEditableAttribute),
    metrics: (sport.metrics || []).map((metric) => ({ ...metric })),
    noraContextInput: sport.prompting?.noraContext || '',
    macraNutritionContextInput: sport.prompting?.macraNutritionContext || '',
    riskFlagsInput: (sport.prompting?.riskFlags || []).join('\n'),
    restrictedAdviceInput: (sport.prompting?.restrictedAdvice || []).join('\n'),
    recommendedLanguageInput: (sport.prompting?.recommendedLanguage || []).join('\n'),
  }));

const buildNewSport = (): EditableSport => ({
  id: newLocalId('new-sport'),
  name: '',
  emoji: '🏅',
  positions: ['Individual'],
  positionsInput: 'Individual',
  sortOrder: 0,
  schemaVersion: 1,
  attributes: [],
  metrics: [],
  noraContextInput: '',
  macraNutritionContextInput: '',
  riskFlagsInput: '',
  restrictedAdviceInput: '',
  recommendedLanguageInput: '',
});

const buildNewAttribute = (sortOrder: number): EditableAttribute => ({
  id: newLocalId('attribute'),
  key: '',
  label: '',
  type: 'text',
  scope: 'athlete',
  required: false,
  includeInNoraContext: true,
  includeInMacraContext: false,
  options: [],
  optionsInput: '',
  placeholder: '',
  sortOrder,
});

const buildNewMetric = (sortOrder: number): EditableMetric => ({
  id: newLocalId('metric'),
  key: '',
  label: '',
  unit: '',
  scope: 'athlete',
  includeInNoraContext: true,
  sortOrder,
});

const normalizePositionsInput = (value: string) => {
  const seen = new Set<string>();

  const normalized = value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => {
      if (!entry) return false;
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return normalized.length > 0 ? normalized : ['Individual'];
};

const normalizeListInput = (value: string) => {
  const seen = new Set<string>();
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => {
      if (!entry) return false;
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const slugifySportId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `sport-${Date.now()}`;

const slugifyKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const parseOptionsInput = (value: string): PulseCheckSportAttributeOption[] => {
  const seen = new Set<string>();
  return value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<PulseCheckSportAttributeOption[]>((acc, entry) => {
      const [rawLabel, rawValue] = entry.split('|').map((part) => part?.trim() || '');
      const label = rawLabel || rawValue;
      const optionValue = rawValue || slugifyKey(label);
      if (!label || !optionValue) return acc;
      const key = optionValue.toLowerCase();
      if (seen.has(key)) return acc;
      seen.add(key);
      acc.push({ label, value: optionValue });
      return acc;
    }, []);
};

const normalizeGeneratedOptions = (value: unknown): PulseCheckSportAttributeOption[] => {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();

  return source.reduce<PulseCheckSportAttributeOption[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object') return acc;
    const candidate = entry as Record<string, unknown>;
    const label = normalizeString(candidate.label);
    const optionValue = normalizeString(candidate.value) || slugifyKey(label);
    if (!label || !optionValue) return acc;
    const key = optionValue.toLowerCase();
    if (seen.has(key)) return acc;
    seen.add(key);
    acc.push({ label, value: optionValue });
    return acc;
  }, []);
};

const normalizeGeneratedAttribute = (
  raw: unknown,
  sportId: string,
  index: number
): PulseCheckSportAttributeDefinition | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  const label = normalizeString(candidate.label);
  const key = normalizeString(candidate.key) || slugifyKey(label);
  if (!label || !key) return null;

  const typeCandidate = normalizeString(candidate.type) as PulseCheckSportAttributeType;
  const type = ATTRIBUTE_TYPES.includes(typeCandidate) ? typeCandidate : 'text';
  const scopeCandidate = normalizeString(candidate.scope) as PulseCheckSportAttributeScope;
  const scope = ATTRIBUTE_SCOPES.includes(scopeCandidate) ? scopeCandidate : 'athlete';

  return {
    id: normalizeString(candidate.id) || `${sportId}-${key}`,
    key,
    label,
    type,
    scope,
    required: Boolean(candidate.required),
    includeInNoraContext: candidate.includeInNoraContext !== false,
    includeInMacraContext: Boolean(candidate.includeInMacraContext),
    options: type === 'singleSelect' || type === 'multiSelect' ? normalizeGeneratedOptions(candidate.options) : [],
    placeholder: normalizeString(candidate.placeholder),
    sortOrder: Number.isFinite(Number(candidate.sortOrder)) ? Number(candidate.sortOrder) : index,
  };
};

const normalizeGeneratedMetric = (
  raw: unknown,
  sportId: string,
  index: number
): PulseCheckSportMetricDefinition | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  const label = normalizeString(candidate.label);
  const key = normalizeString(candidate.key) || slugifyKey(label);
  if (!label || !key) return null;

  const scopeCandidate = normalizeString(candidate.scope) as PulseCheckSportAttributeScope;
  const scope = ATTRIBUTE_SCOPES.includes(scopeCandidate) ? scopeCandidate : 'athlete';

  return {
    id: normalizeString(candidate.id) || `${sportId}-${key}`,
    key,
    label,
    unit: normalizeString(candidate.unit),
    scope,
    includeInNoraContext: candidate.includeInNoraContext !== false,
    sortOrder: Number.isFinite(Number(candidate.sortOrder)) ? Number(candidate.sortOrder) : index,
  };
};

const normalizeGeneratedPrompting = (raw: unknown) => {
  const candidate = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    noraContext: normalizeString(candidate.noraContext),
    macraNutritionContext: normalizeString(candidate.macraNutritionContext),
    riskFlags: Array.isArray(candidate.riskFlags) ? normalizeListInput(candidate.riskFlags.join('\n')) : [],
    restrictedAdvice: Array.isArray(candidate.restrictedAdvice) ? normalizeListInput(candidate.restrictedAdvice.join('\n')) : [],
    recommendedLanguage: Array.isArray(candidate.recommendedLanguage) ? normalizeListInput(candidate.recommendedLanguage.join('\n')) : [],
  };
};

const normalizeGeneratedSportIntelligence = (raw: unknown, sportName: string): NormalizedGeneratedSportIntelligence => {
  const sportId = slugifySportId(sportName) || 'custom-sport';
  const candidate = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const positions = Array.isArray(candidate.positions) ? normalizePositionsInput(candidate.positions.join('\n')) : [];
  const attributes = Array.isArray(candidate.attributes)
    ? candidate.attributes
        .map((attribute, index) => normalizeGeneratedAttribute(attribute, sportId, index))
        .filter((attribute): attribute is PulseCheckSportAttributeDefinition => Boolean(attribute))
        .slice(0, 10)
    : [];
  const metrics = Array.isArray(candidate.metrics)
    ? candidate.metrics
        .map((metric, index) => normalizeGeneratedMetric(metric, sportId, index))
        .filter((metric): metric is PulseCheckSportMetricDefinition => Boolean(metric))
        .slice(0, 10)
    : [];

  return {
    emoji: normalizeString(candidate.emoji) || '🏅',
    positions: positions.length > 0 ? positions.slice(0, 18) : ['Individual'],
    schemaVersion: 2,
    attributes,
    metrics,
    prompting: normalizeGeneratedPrompting(candidate.prompting),
  };
};

const buildSportIntelligencePrompt = (sport: EditableSport) => {
  const existingSummary = {
    name: sport.name.trim(),
    emoji: sport.emoji.trim(),
    positions: normalizePositionsInput(sport.positionsInput),
    existingAttributeLabels: sport.attributes.map((attribute) => attribute.label.trim()).filter(Boolean),
    existingMetricLabels: sport.metrics.map((metric) => metric.label.trim()).filter(Boolean),
  };

  return [
    'Generate a production-ready PulseCheck Sports Intelligence Configuration for this sport.',
    '',
    'Sport card:',
    JSON.stringify(existingSummary, null, 2),
    '',
    'Return valid JSON only with exactly this shape:',
    JSON.stringify(
      {
        summary: 'One sentence explaining what you generated.',
        sport: {
          emoji: 'single emoji',
          positions: ['sport-specific role or event names'],
          attributes: [
            {
              id: 'sport-slug-field-key',
              key: 'field_key',
              label: 'User-facing field label',
              type: 'singleSelect',
              scope: 'athlete',
              required: false,
              includeInNoraContext: true,
              includeInMacraContext: false,
              options: [{ label: 'Option label', value: 'option_value' }],
              placeholder: 'Short placeholder when useful',
              sortOrder: 0,
            },
          ],
          metrics: [
            {
              id: 'sport-slug-metric-key',
              key: 'metric_key',
              label: 'Metric label',
              unit: 'unit or empty string',
              scope: 'athlete',
              includeInNoraContext: true,
              sortOrder: 0,
            },
          ],
          prompting: {
            noraContext: 'Sport-specific coaching context Nora should inherit.',
            macraNutritionContext: 'Sport-specific nutrition context Macra should inherit.',
            riskFlags: ['specific risk to watch'],
            restrictedAdvice: ['specific advice Nora/Macra should avoid'],
            recommendedLanguage: ['specific phrasing style to use'],
          },
        },
      },
      null,
      2
    ),
    '',
    'Generation rules:',
    '- Create exactly 5 dynamic athlete fields and exactly 5 metrics.',
    '- Be deeply sport-specific across sports psychology, biomechanics, performance demands, training load, competition phase, role/event demands, and nutrition context.',
    '- Dynamic fields should help onboarding collect the minimum sport-specific context Nora and Macra need later.',
    '- Metrics should be vocabulary Nora can reference, not medical diagnostics.',
    `- Use only these attribute types: ${ATTRIBUTE_TYPES.join(', ')}.`,
    `- Use only these scopes: ${ATTRIBUTE_SCOPES.join(', ')}.`,
    '- For singleSelect and multiSelect fields, include 3-4 useful options with stable snake_case values.',
    '- includeInMacraContext should be true only when the field affects fueling, body composition, hydration, weight class, digestion, competition timeline, or recovery.',
    '- Restricted advice must prevent generic coaching mistakes for this sport.',
    '- Do not prescribe injury rehab, medical diagnosis, eating-disorder guidance, or unsafe weight manipulation.',
    '- If the current positions are generic like Individual, replace them with better sport-specific roles/events when appropriate.',
    '- Keep noraContext, macraNutritionContext, risk flags, restricted advice, and recommended language concise but sport-specific.',
    '- Return one JSON object only. The first character must be { and the last character must be }. Do not use markdown fences.',
  ].join('\n');
};

const readBridgeError = (payload: unknown, fallbackMessage: string) => {
  if (payload && typeof payload === 'object') {
    const candidate = payload as Record<string, unknown>;
    if (typeof candidate.error === 'string' && candidate.error.trim()) {
      return candidate.error;
    }
    if (candidate.error && typeof candidate.error === 'object') {
      const nestedError = candidate.error as Record<string, unknown>;
      if (typeof nestedError.message === 'string' && nestedError.message.trim()) {
        return nestedError.message;
      }
    }
    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      return candidate.message;
    }
  }

  return fallbackMessage;
};

const PulseCheckSportConfigurationPage: React.FC = () => {
  const router = useRouter();
  const [sports, setSports] = useState<EditableSport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedSportIds, setExpandedSportIds] = useState<Set<string>>(() => new Set());
  const [aiSeedingSportId, setAiSeedingSportId] = useState<string | null>(null);
  const [sportSeedingFeedback, setSportSeedingFeedback] = useState<SportSeedingFeedback | null>(null);

  const loadConfiguration = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const nextSports = await fetchPulseCheckSportConfiguration();
    setSports(buildEditableSports(nextSports));
    setExpandedSportIds(new Set());
    setHasChanges(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  const handleRefresh = async () => {
    setSuccessMessage(null);
    await loadConfiguration();
  };

  const markChanged = () => {
    setHasChanges(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setSportSeedingFeedback(null);
  };

  const handleToggleSportExpanded = (id: string) => {
    setExpandedSportIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSportFieldChange = (
    id: string,
    field:
      | 'name'
      | 'emoji'
      | 'positionsInput'
      | 'noraContextInput'
      | 'macraNutritionContextInput'
      | 'riskFlagsInput'
      | 'restrictedAdviceInput'
      | 'recommendedLanguageInput',
    value: string
  ) => {
    setSports((current) =>
      current.map((sport) => (sport.id === id ? { ...sport, [field]: value } : sport))
    );
    markChanged();
  };

  const handleAddAttribute = (sportId: string) => {
    setSports((current) =>
      current.map((sport) =>
        sport.id === sportId
          ? { ...sport, attributes: [...sport.attributes, buildNewAttribute(sport.attributes.length)] }
          : sport
      )
    );
    markChanged();
  };

  const handleRemoveAttribute = (sportId: string, attributeId: string) => {
    setSports((current) =>
      current.map((sport) =>
        sport.id === sportId
          ? { ...sport, attributes: sport.attributes.filter((attribute) => attribute.id !== attributeId) }
          : sport
      )
    );
    markChanged();
  };

  const handleAttributeChange = (
    sportId: string,
    attributeId: string,
    field: keyof EditableAttribute,
    value: string | boolean
  ) => {
    setSports((current) =>
      current.map((sport) => {
        if (sport.id !== sportId) return sport;
        return {
          ...sport,
          attributes: sport.attributes.map((attribute) => {
            if (attribute.id !== attributeId) return attribute;
            return { ...attribute, [field]: value };
          }),
        };
      })
    );
    markChanged();
  };

  const handleAddMetric = (sportId: string) => {
    setSports((current) =>
      current.map((sport) =>
        sport.id === sportId
          ? { ...sport, metrics: [...sport.metrics, buildNewMetric(sport.metrics.length)] }
          : sport
      )
    );
    markChanged();
  };

  const handleRemoveMetric = (sportId: string, metricId: string) => {
    setSports((current) =>
      current.map((sport) =>
        sport.id === sportId
          ? { ...sport, metrics: sport.metrics.filter((metric) => metric.id !== metricId) }
          : sport
      )
    );
    markChanged();
  };

  const handleMetricChange = (
    sportId: string,
    metricId: string,
    field: keyof EditableMetric,
    value: string | boolean
  ) => {
    setSports((current) =>
      current.map((sport) => {
        if (sport.id !== sportId) return sport;
        return {
          ...sport,
          metrics: sport.metrics.map((metric) => (
            metric.id === metricId ? { ...metric, [field]: value } : metric
          )),
        };
      })
    );
    markChanged();
  };

  const handleAddSport = () => {
    const nextSport = buildNewSport();
    setSports((current) => [
      ...current,
      {
        ...nextSport,
        sortOrder: current.length,
      },
    ]);
    setExpandedSportIds((current) => new Set(current).add(nextSport.id));
    markChanged();
  };

  const handleRemoveSport = (id: string) => {
    setSports((current) => current.filter((sport) => sport.id !== id));
    setExpandedSportIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    markChanged();
  };

  const handleMoveSport = (id: string, direction: 'up' | 'down') => {
    setSports((current) => {
      const index = current.findIndex((sport) => sport.id === id);
      if (index < 0) return current;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next.map((sport, nextIndex) => ({ ...sport, sortOrder: nextIndex }));
    });
    markChanged();
  };

  const handleResetDefaults = () => {
    setSports(buildEditableSports(getDefaultPulseCheckSports()));
    setExpandedSportIds(new Set());
    markChanged();
  };

  const validateSports = (): PulseCheckSportConfigurationEntry[] => {
    if (sports.length === 0) {
      throw new Error('At least one sport is required.');
    }

    const seenNames = new Set<string>();

    return sports.map((sport, index) => {
      const name = sport.name.trim();
      if (!name) {
        throw new Error(`Sport ${index + 1} is missing a name.`);
      }

      const normalizedName = name.toLowerCase();
      if (seenNames.has(normalizedName)) {
        throw new Error(`"${name}" appears more than once. Sport names must be unique.`);
      }
      seenNames.add(normalizedName);

	      return {
	        id: sport.id.startsWith('new-sport-') ? slugifySportId(name) : sport.id,
	        name,
	        emoji: sport.emoji.trim() || '🏅',
	        positions: normalizePositionsInput(sport.positionsInput),
	        sortOrder: index,
	        schemaVersion: sport.schemaVersion || 1,
	        attributes: sport.attributes.map((attribute, attributeIndex) => {
	          const label = attribute.label.trim();
	          const key = attribute.key.trim() || slugifyKey(label);
	          if (!label || !key) {
	            throw new Error(`${name} has an attribute missing a label or key.`);
	          }

	          const options = parseOptionsInput(attribute.optionsInput);
	          if ((attribute.type === 'singleSelect' || attribute.type === 'multiSelect') && options.length === 0) {
	            throw new Error(`${name} / ${label} needs at least one option.`);
	          }

	          return {
	            id: attribute.id.startsWith('attribute-') ? `${slugifySportId(name)}-${key}` : attribute.id,
	            key,
	            label,
	            type: attribute.type,
	            scope: attribute.scope,
	            required: Boolean(attribute.required),
	            includeInNoraContext: attribute.includeInNoraContext !== false,
	            includeInMacraContext: Boolean(attribute.includeInMacraContext),
	            options,
	            placeholder: attribute.placeholder?.trim() || '',
	            sortOrder: attributeIndex,
	          };
	        }),
	        metrics: sport.metrics.map((metric, metricIndex) => {
	          const label = metric.label.trim();
	          const key = metric.key.trim() || slugifyKey(label);
	          if (!label || !key) {
	            throw new Error(`${name} has a metric missing a label or key.`);
	          }

	          return {
	            id: metric.id.startsWith('metric-') ? `${slugifySportId(name)}-${key}` : metric.id,
	            key,
	            label,
	            unit: metric.unit?.trim() || '',
	            scope: metric.scope || 'athlete',
	            includeInNoraContext: metric.includeInNoraContext !== false,
	            sortOrder: metricIndex,
	          };
	        }),
	        prompting: {
	          noraContext: sport.noraContextInput.trim(),
	          macraNutritionContext: sport.macraNutritionContextInput.trim(),
	          riskFlags: normalizeListInput(sport.riskFlagsInput),
	          restrictedAdvice: normalizeListInput(sport.restrictedAdviceInput),
	          recommendedLanguage: normalizeListInput(sport.recommendedLanguageInput),
	        },
	        reportPolicy: sport.reportPolicy,
	      };
	    });
	  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const validatedSports = validateSports();
      const savedSports = await savePulseCheckSportConfiguration(validatedSports);
      setSports(buildEditableSports(savedSports));
      setHasChanges(false);
      setSuccessMessage('PulseCheck sport configuration saved.');
    } catch (error) {
      console.error('[PulseCheckSportConfiguration] Failed to save sport configuration:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save sport configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedSportWithAI = async (sport: EditableSport) => {
    const sportName = sport.name.trim();
    if (!sportName) {
      setErrorMessage('Add a sport name before seeding with AI.');
      setSportSeedingFeedback({
        sportId: sport.id,
        type: 'error',
        message: 'Add a sport name before seeding with AI.',
      });
      setSuccessMessage(null);
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setErrorMessage('Firebase auth session required for the OpenAI bridge. Sign in again, then retry.');
      setSportSeedingFeedback({
        sportId: sport.id,
        type: 'error',
        message: 'Firebase auth session required for the OpenAI bridge. Sign in again, then retry.',
      });
      setSuccessMessage(null);
      return;
    }

    setAiSeedingSportId(sport.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSportSeedingFeedback({
      sportId: sport.id,
      type: 'success',
      message: `Seeding ${sportName} with AI...`,
    });

    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch(SPORT_INTELLIGENCE_BRIDGE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'openai-organization': SPORT_INTELLIGENCE_FEATURE_ID,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          temperature: 0.25,
          max_tokens: 6500,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are PulseCheck Sports Intelligence architect. You design sport-specific onboarding fields, metric vocabularies, and AI coaching constraints for an athlete mental performance and nutrition product. Return exactly one JSON object only. No markdown fences, no prose before or after the JSON.',
            },
            {
              role: 'user',
              content: buildSportIntelligencePrompt(sport),
            },
          ],
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(readBridgeError(payload, 'Failed to seed sport intelligence through the OpenAI bridge.'));
      }

      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('OpenAI bridge returned an empty sport intelligence response.');
      }

      let parsed: GeneratedSportIntelligencePayload;
      try {
        parsed = parseSportIntelligenceJSON(content);
      } catch (error) {
        console.warn('[PulseCheckSportConfiguration] Invalid sport intelligence JSON excerpt:', content.slice(0, 1200));
        throw error;
      }

      const generated = normalizeGeneratedSportIntelligence(parsed?.sport, sportName);
      if (generated.attributes.length < 3 || generated.metrics.length < 3) {
        throw new Error('AI response did not include sport configuration.');
      }

      const nextSportEntry: PulseCheckSportConfigurationEntry = {
        id: sport.id,
        name: sportName,
        emoji: typeof generated.emoji === 'string' && generated.emoji.trim() ? generated.emoji.trim() : sport.emoji,
        positions: Array.isArray(generated.positions) && generated.positions.length > 0
          ? generated.positions
          : normalizePositionsInput(sport.positionsInput),
        sortOrder: sport.sortOrder,
        schemaVersion: generated.schemaVersion || 2,
        attributes: Array.isArray(generated.attributes) ? generated.attributes : sport.attributes,
        metrics: Array.isArray(generated.metrics) ? generated.metrics : sport.metrics,
        prompting: generated.prompting || {
          noraContext: sport.noraContextInput,
          macraNutritionContext: sport.macraNutritionContextInput,
          riskFlags: normalizeListInput(sport.riskFlagsInput),
          restrictedAdvice: normalizeListInput(sport.restrictedAdviceInput),
          recommendedLanguage: normalizeListInput(sport.recommendedLanguageInput),
        },
      };
      const [nextEditableSport] = buildEditableSports([nextSportEntry]);

      setSports((current) =>
        current.map((currentSport) =>
          currentSport.id === sport.id
            ? { ...nextEditableSport, id: currentSport.id, sortOrder: currentSport.sortOrder }
            : currentSport
        )
      );
      setExpandedSportIds((current) => new Set(current).add(sport.id));
      setHasChanges(true);
      const nextMessage = normalizeString(parsed?.summary) || `Seeded ${sportName} with AI-generated sport intelligence.`;
      setSportSeedingFeedback({
        sportId: sport.id,
        type: 'success',
        message: nextMessage,
      });
      setSuccessMessage(nextMessage);
    } catch (error) {
      console.error('[PulseCheckSportConfiguration] Failed to seed sport intelligence:', error);
      const nextMessage = error instanceof Error ? error.message : 'Failed to seed sport intelligence.';
      setSportSeedingFeedback({
        sportId: sport.id,
        type: 'error',
        message: nextMessage,
      });
      setErrorMessage(nextMessage);
    } finally {
      setAiSeedingSportId(null);
    }
  };

  const totalPositions = sports.reduce((sum, sport) => sum + normalizePositionsInput(sport.positionsInput).length, 0);

  return (
    <AdminRouteGuard>
      <Head>
        <title>PulseCheck Sport Configuration | Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#111417] px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <button
                onClick={() => router.push('/admin')}
                className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Admin
              </button>

              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1a1e24] text-[#d7ff00] shadow-lg shadow-black/20">
                  <Settings2 className="h-6 w-6" />
                </span>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">PulseCheck Sport Configuration</h1>
                  <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                    This lookup powers sport selection in PulseCheck onboarding, PulseCheck profile editing, and the
                    PulseCheck provisioning team form.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-[#1a1e24] px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Sports</div>
                <div className="mt-2 text-2xl font-semibold">{sports.length}</div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-[#1a1e24] px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Positions</div>
                <div className="mt-2 text-2xl font-semibold">{totalPositions}</div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-[#1a1e24] px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Consumers</div>
                <div className="mt-2 text-2xl font-semibold">3</div>
              </div>
            </div>
          </div>

          {successMessage && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-700 bg-green-900/20 px-4 py-3 text-green-200">
              <Check className="h-5 w-5" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-700 bg-red-900/20 px-4 py-3 text-red-200">
              <AlertCircle className="h-5 w-5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-zinc-800 bg-[#1a1e24]">
              <Loader2 className="h-8 w-8 animate-spin text-[#d7ff00]" />
              <span className="ml-3 text-zinc-400">Loading PulseCheck sports…</span>
            </div>
          ) : (
            <>
              <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-3xl border border-zinc-800 bg-[#1a1e24] p-5 shadow-2xl shadow-black/20">
                  <div className="flex flex-col gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Lookup Table</h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        Add sports, define the onboarding emoji, and set the position list used when an athlete chooses that sport.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleRefresh}
                        className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-black/20 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                      </button>
                      <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-black/20 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                      >
                        Reset Defaults
                      </button>
                      <button
                        type="button"
                        onClick={handleAddSport}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#d7ff00] px-3 py-2 text-sm font-medium text-black transition hover:brightness-110"
                      >
                        <Plus className="h-4 w-4" />
                        Add Sport
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {sports.map((sport, index) => {
                      const isExpanded = expandedSportIds.has(sport.id);
                      const isSeedingThisSport = aiSeedingSportId === sport.id;
                      const feedbackForSport = sportSeedingFeedback?.sportId === sport.id ? sportSeedingFeedback : null;
                      const sportLabel = sport.name.trim() || `Sport ${index + 1}`;
                      const positionCount = normalizePositionsInput(sport.positionsInput).length;

                      return (
                        <div key={sport.id} className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                          <div className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between ${isExpanded ? 'mb-4 border-b border-zinc-800 pb-4' : ''}`}>
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-[#111417] text-2xl">
                                {sport.emoji || '🏅'}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Sport {index + 1}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <h3 className="max-w-full truncate text-base font-semibold text-white">{sportLabel}</h3>
                                  <span className="rounded-full border border-zinc-800 bg-[#111417] px-2 py-1 text-[11px] text-zinc-400">
                                    {positionCount} {positionCount === 1 ? 'position' : 'positions'}
                                  </span>
                                  <span className="rounded-full border border-zinc-800 bg-[#111417] px-2 py-1 text-[11px] text-zinc-400">
                                    {sport.attributes.length} fields
                                  </span>
                                  <span className="rounded-full border border-zinc-800 bg-[#111417] px-2 py-1 text-[11px] text-zinc-400">
                                    {sport.metrics.length} metrics
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSeedSportWithAI(sport)}
                                disabled={Boolean(aiSeedingSportId) || isSaving || !sport.name.trim()}
                                className="inline-flex items-center gap-2 rounded-lg border border-[#d7ff00]/40 bg-[#d7ff00]/10 px-3 py-2 text-sm font-medium text-[#d7ff00] transition hover:border-[#d7ff00]/70 hover:bg-[#d7ff00]/15 disabled:cursor-not-allowed disabled:opacity-45"
                                aria-label={`Seed ${sport.name || `sport ${index + 1}`} with AI`}
                              >
                                {isSeedingThisSport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                {isSeedingThisSport ? 'Seeding...' : 'Seed with AI'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleSportExpanded(sport.id)}
                                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-[#171a1f] px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                                aria-expanded={isExpanded}
                                aria-controls={`sport-editor-${sport.id}`}
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                {isExpanded ? 'Collapse' : 'Expand'}
                              </button>
                            <button
                              type="button"
                              onClick={() => handleMoveSport(sport.id, 'up')}
                              disabled={index === 0}
                              className="rounded-lg border border-zinc-700 bg-[#171a1f] p-2 text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Move ${sport.name || `sport ${index + 1}`} up`}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveSport(sport.id, 'down')}
                              disabled={index === sports.length - 1}
                              className="rounded-lg border border-zinc-700 bg-[#171a1f] p-2 text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Move ${sport.name || `sport ${index + 1}`} down`}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSport(sport.id)}
                              className="rounded-lg border border-red-900/60 bg-red-950/30 p-2 text-red-300 transition hover:border-red-700 hover:text-red-200"
                              aria-label={`Remove ${sport.name || `sport ${index + 1}`}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {feedbackForSport && (
                          <div
                            className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                              feedbackForSport.type === 'error'
                                ? 'border-red-900/60 bg-red-950/30 text-red-200'
                                : 'border-[#d7ff00]/30 bg-[#d7ff00]/10 text-[#d7ff00]'
                            }`}
                          >
                            {feedbackForSport.message}
                          </div>
                        )}

                        {isExpanded && (
                          <div id={`sport-editor-${sport.id}`}>
                        <div className="grid gap-4 md:grid-cols-[96px_minmax(0,1fr)]">
                          <label className="space-y-2">
                            <span className="text-xs uppercase tracking-wide text-zinc-500">Emoji</span>
                            <input
                              value={sport.emoji}
                              onChange={(event) => handleSportFieldChange(sport.id, 'emoji', event.target.value)}
                              className="w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-3 text-center text-2xl text-white outline-none transition focus:border-[#d7ff00]"
                              placeholder="🏅"
                            />
                          </label>

                          <label className="space-y-2">
                            <span className="text-xs uppercase tracking-wide text-zinc-500">Sport Name</span>
                            <input
                              value={sport.name}
                              onChange={(event) => handleSportFieldChange(sport.id, 'name', event.target.value)}
                              className="w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-3 text-sm text-white outline-none transition focus:border-[#d7ff00]"
                              placeholder="Basketball"
                            />
                          </label>
                        </div>

	                        <label className="mt-4 block space-y-2">
	                          <span className="text-xs uppercase tracking-wide text-zinc-500">Positions</span>
	                          <textarea
	                            value={sport.positionsInput}
	                            onChange={(event) => handleSportFieldChange(sport.id, 'positionsInput', event.target.value)}
                            className="min-h-[110px] w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-3 text-sm text-white outline-none transition focus:border-[#d7ff00]"
                            placeholder="Point Guard, Shooting Guard, Small Forward"
                          />
                          <p className="text-xs text-zinc-500">
	                            Separate positions with commas or new lines. Leave it as <span className="text-zinc-300">Individual</span> for single-role sports.
	                          </p>
	                        </label>

	                        <div className="mt-5 rounded-2xl border border-zinc-800 bg-[#111417] p-4">
	                          <div className="mb-4 flex items-center justify-between gap-3">
	                            <div>
	                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Sport Intelligence</div>
	                              <div className="mt-1 text-sm text-zinc-400">Prompting and policy Nora can inherit for this sport.</div>
	                            </div>
	                          </div>

	                          <div className="grid gap-4 lg:grid-cols-2">
	                            <label className="space-y-2">
	                              <span className="text-xs uppercase tracking-wide text-zinc-500">Nora Context</span>
	                              <textarea
	                                value={sport.noraContextInput}
	                                onChange={(event) => handleSportFieldChange(sport.id, 'noraContextInput', event.target.value)}
	                                className="min-h-[96px] w-full rounded-xl border border-zinc-700 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-[#d7ff00]"
	                                placeholder="Classify phase and competition demands before coaching."
	                              />
	                            </label>

	                            <label className="space-y-2">
	                              <span className="text-xs uppercase tracking-wide text-zinc-500">Macra Nutrition Context</span>
	                              <textarea
	                                value={sport.macraNutritionContextInput}
	                                onChange={(event) => handleSportFieldChange(sport.id, 'macraNutritionContextInput', event.target.value)}
	                                className="min-h-[96px] w-full rounded-xl border border-zinc-700 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-[#d7ff00]"
	                                placeholder="Audit macro targets against timeline, phase, and body size."
	                              />
	                            </label>

	                            <label className="space-y-2">
	                              <span className="text-xs uppercase tracking-wide text-zinc-500">Risk Flags</span>
	                              <textarea
	                                value={sport.riskFlagsInput}
	                                onChange={(event) => handleSportFieldChange(sport.id, 'riskFlagsInput', event.target.value)}
	                                className="min-h-[96px] w-full rounded-xl border border-zinc-700 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-[#d7ff00]"
	                                placeholder="flatness&#10;spillover&#10;rebound"
	                              />
	                            </label>

	                            <label className="space-y-2">
	                              <span className="text-xs uppercase tracking-wide text-zinc-500">Restricted Advice</span>
	                              <textarea
	                                value={sport.restrictedAdviceInput}
	                                onChange={(event) => handleSportFieldChange(sport.id, 'restrictedAdviceInput', event.target.value)}
	                                className="min-h-[96px] w-full rounded-xl border border-zinc-700 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-[#d7ff00]"
	                                placeholder="Avoid casual food swaps near show day."
	                              />
	                            </label>
	                          </div>

	                          <label className="mt-4 block space-y-2">
	                            <span className="text-xs uppercase tracking-wide text-zinc-500">Recommended Language</span>
	                            <textarea
	                              value={sport.recommendedLanguageInput}
	                              onChange={(event) => handleSportFieldChange(sport.id, 'recommendedLanguageInput', event.target.value)}
	                              className="min-h-[76px] w-full rounded-xl border border-zinc-700 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-[#d7ff00]"
	                              placeholder="Use prep-coach language."
	                            />
	                          </label>
	                        </div>

	                        <div className="mt-5 rounded-2xl border border-zinc-800 bg-[#111417] p-4">
	                          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	                            <div>
	                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Dynamic Athlete Fields</div>
	                              <div className="mt-1 text-sm text-zinc-400">Fields rendered during onboarding after this sport is selected.</div>
	                            </div>
	                            <button
	                              type="button"
	                              onClick={() => handleAddAttribute(sport.id)}
	                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white"
	                            >
	                              <Plus className="h-4 w-4" />
	                              Add Field
	                            </button>
	                          </div>

	                          <div className="space-y-3">
	                            {sport.attributes.length === 0 ? (
	                              <div className="rounded-xl border border-dashed border-zinc-700 px-4 py-5 text-sm text-zinc-500">
	                                No sport-specific fields yet.
	                              </div>
	                            ) : sport.attributes.map((attribute) => (
	                              <div key={attribute.id} className="rounded-xl border border-zinc-800 bg-black/25 p-3">
	                                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_140px_150px]">
	                                  <label className="space-y-2">
	                                    <span className="text-xs uppercase tracking-wide text-zinc-500">Label</span>
	                                    <input
	                                      value={attribute.label}
	                                      onChange={(event) => handleAttributeChange(sport.id, attribute.id, 'label', event.target.value)}
	                                      className="w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#d7ff00]"
	                                      placeholder="Competition Date"
	                                    />
	                                  </label>
	                                  <label className="space-y-2">
	                                    <span className="text-xs uppercase tracking-wide text-zinc-500">Key</span>
	                                    <input
	                                      value={attribute.key}
	                                      onChange={(event) => handleAttributeChange(sport.id, attribute.id, 'key', slugifyKey(event.target.value))}
	                                      className="w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#d7ff00]"
	                                      placeholder="competitionDate"
	                                    />
	                                  </label>
	                                  <label className="space-y-2">
	                                    <span className="text-xs uppercase tracking-wide text-zinc-500">Type</span>
	                                    <select
	                                      value={attribute.type}
	                                      onChange={(event) => handleAttributeChange(sport.id, attribute.id, 'type', event.target.value as PulseCheckSportAttributeType)}
	                                      className="w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#d7ff00]"
	                                    >
	                                      {ATTRIBUTE_TYPES.map((type) => (
	                                        <option key={type} value={type}>{type}</option>
	                                      ))}
	                                    </select>
	                                  </label>
	                                  <label className="space-y-2">
	                                    <span className="text-xs uppercase tracking-wide text-zinc-500">Scope</span>
	                                    <select
	                                      value={attribute.scope}
	                                      onChange={(event) => handleAttributeChange(sport.id, attribute.id, 'scope', event.target.value as PulseCheckSportAttributeScope)}
	                                      className="w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#d7ff00]"
	                                    >
	                                      {ATTRIBUTE_SCOPES.map((scope) => (
	                                        <option key={scope} value={scope}>{scope}</option>
	                                      ))}
	                                    </select>
	                                  </label>
	                                </div>

	                                {(attribute.type === 'singleSelect' || attribute.type === 'multiSelect') && (
	                                  <label className="mt-3 block space-y-2">
	                                    <span className="text-xs uppercase tracking-wide text-zinc-500">Options</span>
	                                    <textarea
	                                      value={attribute.optionsInput}
	                                      onChange={(event) => handleAttributeChange(sport.id, attribute.id, 'optionsInput', event.target.value)}
	                                      className="min-h-[84px] w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#d7ff00]"
	                                      placeholder="Men’s Physique|mens_physique&#10;Classic Physique|classic_physique"
	                                    />
	                                  </label>
	                                )}

	                                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	                                  <div className="flex flex-wrap gap-3 text-xs text-zinc-300">
	                                    <label className="inline-flex items-center gap-2">
	                                      <input
	                                        type="checkbox"
	                                        checked={Boolean(attribute.required)}
	                                        onChange={(event) => handleAttributeChange(sport.id, attribute.id, 'required', event.target.checked)}
	                                        className="h-4 w-4 rounded border-zinc-700 bg-black"
	                                      />
	                                      Required
	                                    </label>
	                                    <label className="inline-flex items-center gap-2">
	                                      <input
	                                        type="checkbox"
	                                        checked={attribute.includeInNoraContext !== false}
	                                        onChange={(event) => handleAttributeChange(sport.id, attribute.id, 'includeInNoraContext', event.target.checked)}
	                                        className="h-4 w-4 rounded border-zinc-700 bg-black"
	                                      />
	                                      Nora
	                                    </label>
	                                    <label className="inline-flex items-center gap-2">
	                                      <input
	                                        type="checkbox"
	                                        checked={Boolean(attribute.includeInMacraContext)}
	                                        onChange={(event) => handleAttributeChange(sport.id, attribute.id, 'includeInMacraContext', event.target.checked)}
	                                        className="h-4 w-4 rounded border-zinc-700 bg-black"
	                                      />
	                                      Macra
	                                    </label>
	                                  </div>
	                                  <button
	                                    type="button"
	                                    onClick={() => handleRemoveAttribute(sport.id, attribute.id)}
	                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300 transition hover:border-red-700 hover:text-red-200"
	                                  >
	                                    <Trash2 className="h-4 w-4" />
	                                    Remove
	                                  </button>
	                                </div>
	                              </div>
	                            ))}
	                          </div>
	                        </div>

	                        <div className="mt-5 rounded-2xl border border-zinc-800 bg-[#111417] p-4">
	                          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	                            <div>
	                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Sport Metrics</div>
	                              <div className="mt-1 text-sm text-zinc-400">Metric vocabulary Nora can reference when this sport is active.</div>
	                            </div>
	                            <button
	                              type="button"
	                              onClick={() => handleAddMetric(sport.id)}
	                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white"
	                            >
	                              <Plus className="h-4 w-4" />
	                              Add Metric
	                            </button>
	                          </div>

	                          <div className="space-y-3">
	                            {sport.metrics.length === 0 ? (
	                              <div className="rounded-xl border border-dashed border-zinc-700 px-4 py-5 text-sm text-zinc-500">
	                                No metrics configured.
	                              </div>
	                            ) : sport.metrics.map((metric) => (
	                              <div key={metric.id} className="rounded-xl border border-zinc-800 bg-black/25 p-3">
	                                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_120px_150px]">
	                                  <label className="space-y-2">
	                                    <span className="text-xs uppercase tracking-wide text-zinc-500">Label</span>
	                                    <input
	                                      value={metric.label}
	                                      onChange={(event) => handleMetricChange(sport.id, metric.id, 'label', event.target.value)}
	                                      className="w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#d7ff00]"
	                                      placeholder="Weeks Out"
	                                    />
	                                  </label>
	                                  <label className="space-y-2">
	                                    <span className="text-xs uppercase tracking-wide text-zinc-500">Key</span>
	                                    <input
	                                      value={metric.key}
	                                      onChange={(event) => handleMetricChange(sport.id, metric.id, 'key', slugifyKey(event.target.value))}
	                                      className="w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#d7ff00]"
	                                      placeholder="weeksOut"
	                                    />
	                                  </label>
	                                  <label className="space-y-2">
	                                    <span className="text-xs uppercase tracking-wide text-zinc-500">Unit</span>
	                                    <input
	                                      value={metric.unit || ''}
	                                      onChange={(event) => handleMetricChange(sport.id, metric.id, 'unit', event.target.value)}
	                                      className="w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#d7ff00]"
	                                      placeholder="lb"
	                                    />
	                                  </label>
	                                  <label className="space-y-2">
	                                    <span className="text-xs uppercase tracking-wide text-zinc-500">Scope</span>
	                                    <select
	                                      value={metric.scope || 'athlete'}
	                                      onChange={(event) => handleMetricChange(sport.id, metric.id, 'scope', event.target.value as PulseCheckSportAttributeScope)}
	                                      className="w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#d7ff00]"
	                                    >
	                                      {ATTRIBUTE_SCOPES.map((scope) => (
	                                        <option key={scope} value={scope}>{scope}</option>
	                                      ))}
	                                    </select>
	                                  </label>
	                                </div>
	                                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	                                  <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
	                                    <input
	                                      type="checkbox"
	                                      checked={metric.includeInNoraContext !== false}
	                                      onChange={(event) => handleMetricChange(sport.id, metric.id, 'includeInNoraContext', event.target.checked)}
	                                      className="h-4 w-4 rounded border-zinc-700 bg-black"
	                                    />
	                                    Nora context
	                                  </label>
	                                  <button
	                                    type="button"
	                                    onClick={() => handleRemoveMetric(sport.id, metric.id)}
	                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300 transition hover:border-red-700 hover:text-red-200"
	                                  >
	                                    <Trash2 className="h-4 w-4" />
	                                    Remove
	                                  </button>
	                                </div>
	                              </div>
	                            ))}
	                          </div>
	                        </div>
                          </div>
                        )}
	                      </div>
                      );
                    })}
	                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-zinc-800 bg-[#1a1e24] p-5 shadow-2xl shadow-black/20">
                    <h2 className="text-lg font-semibold">Where This Flows</h2>
                    <div className="mt-4 space-y-3 text-sm text-zinc-300">
                      <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3">
                        PulseCheck onboarding uses the emoji, sport label, and position list.
                      </div>
                      <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3">
                        PulseCheck profile edit uses the sport names in the dropdown.
                      </div>
                      <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3">
                        PulseCheck provisioning uses the same lookup when attaching a sport to a team.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-amber-900/60 bg-amber-950/20 p-5 text-sm text-amber-100 shadow-2xl shadow-black/20">
                    <div className="font-semibold">Important</div>
                    <p className="mt-2 text-amber-100/80">
                      Removing a sport takes it out of future selectors. Existing athlete profiles and team records keep whatever sport string
                      was already saved until someone updates that record.
                    </p>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-[#111417]/95 p-4 shadow-2xl shadow-black/30 backdrop-blur md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-zinc-400">
                  {hasChanges ? 'You have unsaved changes.' : 'Configuration is in sync with Firestore.'}
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d7ff00] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSaving ? 'Saving…' : 'Save Configuration'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckSportConfigurationPage;
