import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './config';

export interface PulseCheckSportConfigurationEntry {
  id: string;
  name: string;
  emoji: string;
  positions: string[];
  sortOrder: number;
  schemaVersion?: number;
  attributes?: PulseCheckSportAttributeDefinition[];
  metrics?: PulseCheckSportMetricDefinition[];
  prompting?: PulseCheckSportPromptingConfiguration;
}

export type PulseCheckSportAttributeType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'singleSelect'
  | 'multiSelect';

export type PulseCheckSportAttributeScope =
  | 'athlete'
  | 'team'
  | 'season'
  | 'competition'
  | 'nutrition'
  | 'recovery';

export interface PulseCheckSportAttributeOption {
  label: string;
  value: string;
}

export interface PulseCheckSportAttributeDefinition {
  id: string;
  key: string;
  label: string;
  type: PulseCheckSportAttributeType;
  scope: PulseCheckSportAttributeScope;
  required?: boolean;
  includeInNoraContext?: boolean;
  includeInMacraContext?: boolean;
  options?: PulseCheckSportAttributeOption[];
  placeholder?: string;
  sortOrder?: number;
}

export interface PulseCheckSportMetricDefinition {
  id: string;
  key: string;
  label: string;
  unit?: string;
  scope?: PulseCheckSportAttributeScope;
  includeInNoraContext?: boolean;
  sortOrder?: number;
}

export interface PulseCheckSportPromptingConfiguration {
  noraContext?: string;
  macraNutritionContext?: string;
  riskFlags?: string[];
  restrictedAdvice?: string[];
  recommendedLanguage?: string[];
}

const CONFIG_COLLECTION = 'company-config';
const CONFIG_DOCUMENT = 'pulsecheck-sports';

const DEFAULT_PULSECHECK_SPORTS: PulseCheckSportConfigurationEntry[] = [
  { id: 'basketball', name: 'Basketball', emoji: '🏀', positions: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'], sortOrder: 0 },
  { id: 'soccer', name: 'Soccer', emoji: '⚽', positions: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'], sortOrder: 1 },
  { id: 'football', name: 'Football', emoji: '🏈', positions: ['Quarterback', 'Running Back', 'Wide Receiver', 'Tight End', 'Offensive Line', 'Defensive Line', 'Linebacker', 'Cornerback', 'Safety', 'Kicker'], sortOrder: 2 },
  { id: 'baseball', name: 'Baseball', emoji: '⚾', positions: ['Pitcher', 'Catcher', 'First Base', 'Second Base', 'Third Base', 'Shortstop', 'Left Field', 'Center Field', 'Right Field'], sortOrder: 3 },
  { id: 'softball', name: 'Softball', emoji: '🥎', positions: ['Pitcher', 'Catcher', 'First Base', 'Second Base', 'Third Base', 'Shortstop', 'Outfield'], sortOrder: 4 },
  { id: 'volleyball', name: 'Volleyball', emoji: '🏐', positions: ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Libero'], sortOrder: 5 },
  { id: 'tennis', name: 'Tennis', emoji: '🎾', positions: ['Singles', 'Doubles'], sortOrder: 6 },
  { id: 'swimming', name: 'Swimming', emoji: '🏊', positions: ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley'], sortOrder: 7 },
  { id: 'track-field', name: 'Track & Field', emoji: '🏃', positions: ['Sprinter', 'Middle Distance', 'Long Distance', 'Jumper', 'Thrower', 'Hurdler'], sortOrder: 8 },
  { id: 'wrestling', name: 'Wrestling', emoji: '🤼', positions: ['Individual'], sortOrder: 9 },
  { id: 'crossfit', name: 'CrossFit', emoji: '🏋️', positions: ['Individual'], sortOrder: 10 },
  { id: 'golf', name: 'Golf', emoji: '⛳', positions: ['Individual'], sortOrder: 11 },
  { id: 'lacrosse', name: 'Lacrosse', emoji: '🥍', positions: ['Attack', 'Midfield', 'Defense', 'Goalkeeper'], sortOrder: 12 },
  { id: 'hockey', name: 'Hockey', emoji: '🏒', positions: ['Forward', 'Defenseman', 'Goalie'], sortOrder: 13 },
  { id: 'gymnastics', name: 'Gymnastics', emoji: '🤸', positions: ['Individual'], sortOrder: 14 },
  {
    id: 'bodybuilding-physique',
    name: 'Bodybuilding / Physique',
    emoji: '🏆',
    positions: ['Men’s Physique', 'Classic Physique', 'Bodybuilding', 'Bikini', 'Figure', 'Wellness', 'Fitness'],
    sortOrder: 15,
    schemaVersion: 1,
    attributes: [
      {
        id: 'physique-division',
        key: 'division',
        label: 'Division',
        type: 'singleSelect',
        scope: 'competition',
        required: true,
        includeInNoraContext: true,
        includeInMacraContext: true,
        options: [
          { label: 'Men’s Physique', value: 'mens_physique' },
          { label: 'Classic Physique', value: 'classic_physique' },
          { label: 'Bodybuilding', value: 'bodybuilding' },
          { label: 'Bikini', value: 'bikini' },
          { label: 'Figure', value: 'figure' },
          { label: 'Wellness', value: 'wellness' },
          { label: 'Fitness', value: 'fitness' },
        ],
        sortOrder: 0,
      },
      {
        id: 'physique-competition-date',
        key: 'competitionDate',
        label: 'Competition Date',
        type: 'date',
        scope: 'competition',
        required: true,
        includeInNoraContext: true,
        includeInMacraContext: true,
        sortOrder: 1,
      },
      {
        id: 'physique-prep-phase',
        key: 'prepPhase',
        label: 'Prep Phase',
        type: 'singleSelect',
        scope: 'season',
        required: true,
        includeInNoraContext: true,
        includeInMacraContext: true,
        options: [
          { label: 'Improvement Season', value: 'improvement_season' },
          { label: 'Contest Prep', value: 'contest_prep' },
          { label: 'Peak Week', value: 'peak_week' },
          { label: 'Post-Show Reverse', value: 'post_show_reverse' },
          { label: 'Off-Season', value: 'off_season' },
        ],
        sortOrder: 2,
      },
      {
        id: 'physique-food-variance',
        key: 'foodVarianceTolerance',
        label: 'Food Variance Tolerance',
        type: 'singleSelect',
        scope: 'nutrition',
        required: false,
        includeInNoraContext: true,
        includeInMacraContext: true,
        options: [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' },
        ],
        sortOrder: 3,
      },
      {
        id: 'physique-approved-carb-sources',
        key: 'approvedCarbSources',
        label: 'Approved Carb Sources',
        type: 'multiSelect',
        scope: 'nutrition',
        required: false,
        includeInNoraContext: true,
        includeInMacraContext: true,
        options: [
          { label: 'Rice', value: 'rice' },
          { label: 'Cream of Rice', value: 'cream_of_rice' },
          { label: 'Potatoes', value: 'potatoes' },
          { label: 'Oats', value: 'oats' },
          { label: 'Rice Cakes', value: 'rice_cakes' },
        ],
        sortOrder: 4,
      },
      {
        id: 'physique-coach-macros-locked',
        key: 'coachMacrosLocked',
        label: 'Coach Macros Locked',
        type: 'boolean',
        scope: 'nutrition',
        required: false,
        includeInNoraContext: true,
        includeInMacraContext: true,
        sortOrder: 5,
      },
    ],
    metrics: [
      { id: 'physique-weeks-out', key: 'weeksOut', label: 'Weeks Out', unit: 'weeks', scope: 'competition', includeInNoraContext: true, sortOrder: 0 },
      { id: 'physique-stage-weight-target', key: 'stageWeightTarget', label: 'Stage Weight Target', unit: 'lb', scope: 'competition', includeInNoraContext: true, sortOrder: 1 },
      { id: 'physique-cardio-minutes', key: 'cardioMinutesPerWeek', label: 'Cardio Minutes / Week', unit: 'min', scope: 'nutrition', includeInNoraContext: true, sortOrder: 2 },
    ],
    prompting: {
      noraContext: 'Treat this athlete as a physique competitor. Always classify prep phase and show timeline before giving performance advice.',
      macraNutritionContext: 'In contest prep, peak week, or post-show reverse, audit macro targets against body size, show date, division, and food-variance tolerance. Favor predictable foods and controlled adjustments.',
      riskFlags: ['target mismatch', 'flatness', 'spillover', 'rebound overeating', 'digestion variance'],
      restrictedAdvice: ['Do not casually suggest fruit, whole grains, or generic starchy vegetables inside the near-show window unless already approved.'],
      recommendedLanguage: ['Use precise prep-coach language and explain when user-set targets should be questioned.'],
    },
  },
  { id: 'other', name: 'Other', emoji: '🏅', positions: ['Individual'], sortOrder: 16 },
];

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const slugifySportId = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || `sport-${Date.now()}`;
};

const normalizePositions = (value: unknown): string[] => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/)
      : [];

  const seen = new Set<string>();
  const normalized = rawValues.reduce<string[]>((acc, entry) => {
    const position = normalizeString(entry);
    if (!position) return acc;

    const key = position.toLowerCase();
    if (seen.has(key)) return acc;

    seen.add(key);
    acc.push(position);
    return acc;
  }, []);

  return normalized.length > 0 ? normalized : ['Individual'];
};

const normalizeList = (value: unknown): string[] => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/)
      : [];

  const seen = new Set<string>();
  return rawValues.reduce<string[]>((acc, entry) => {
    const item = normalizeString(entry);
    if (!item) return acc;
    const key = item.toLowerCase();
    if (seen.has(key)) return acc;
    seen.add(key);
    acc.push(item);
    return acc;
  }, []);
};

const normalizeOptionValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const ATTRIBUTE_TYPES: PulseCheckSportAttributeType[] = ['text', 'number', 'date', 'boolean', 'singleSelect', 'multiSelect'];
const ATTRIBUTE_SCOPES: PulseCheckSportAttributeScope[] = ['athlete', 'team', 'season', 'competition', 'nutrition', 'recovery'];

const normalizeAttributeOptions = (value: unknown): PulseCheckSportAttributeOption[] => {
  const entries = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/)
      : [];

  const seen = new Set<string>();
  return entries.reduce<PulseCheckSportAttributeOption[]>((acc, entry) => {
    let label = '';
    let optionValue = '';

    if (typeof entry === 'string') {
      label = entry.trim();
      optionValue = normalizeOptionValue(label);
    } else if (entry && typeof entry === 'object') {
      const candidate = entry as Record<string, unknown>;
      label = normalizeString(candidate.label);
      optionValue = normalizeString(candidate.value) || normalizeOptionValue(label);
    }

    if (!label || !optionValue) return acc;
    const key = optionValue.toLowerCase();
    if (seen.has(key)) return acc;
    seen.add(key);
    acc.push({ label, value: optionValue });
    return acc;
  }, []);
};

const normalizeAttributes = (value: unknown): PulseCheckSportAttributeDefinition[] => {
  if (!Array.isArray(value)) return [];

  const seenKeys = new Set<string>();
  return value.reduce<PulseCheckSportAttributeDefinition[]>((acc, entry, index) => {
    if (!entry || typeof entry !== 'object') return acc;
    const candidate = entry as Record<string, unknown>;
    const label = normalizeString(candidate.label);
    const key = normalizeString(candidate.key) || normalizeOptionValue(label);
    if (!label || !key) return acc;
    const normalizedKey = key.toLowerCase();
    if (seenKeys.has(normalizedKey)) return acc;
    seenKeys.add(normalizedKey);

    const rawType = normalizeString(candidate.type) as PulseCheckSportAttributeType;
    const rawScope = normalizeString(candidate.scope) as PulseCheckSportAttributeScope;
    const type = ATTRIBUTE_TYPES.includes(rawType) ? rawType : 'text';
    const scope = ATTRIBUTE_SCOPES.includes(rawScope) ? rawScope : 'athlete';
    const options = normalizeAttributeOptions(candidate.options);

    acc.push({
      id: normalizeString(candidate.id) || `${key}-${index}`,
      key,
      label,
      type,
      scope,
      required: Boolean(candidate.required),
      includeInNoraContext: candidate.includeInNoraContext !== false,
      includeInMacraContext: Boolean(candidate.includeInMacraContext),
      options: type === 'singleSelect' || type === 'multiSelect' ? options : [],
      placeholder: normalizeString(candidate.placeholder),
      sortOrder: typeof candidate.sortOrder === 'number' && Number.isFinite(candidate.sortOrder) ? candidate.sortOrder : index,
    });

    return acc;
  }, []).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
};

const normalizeMetrics = (value: unknown): PulseCheckSportMetricDefinition[] => {
  if (!Array.isArray(value)) return [];

  const seenKeys = new Set<string>();
  return value.reduce<PulseCheckSportMetricDefinition[]>((acc, entry, index) => {
    if (!entry || typeof entry !== 'object') return acc;
    const candidate = entry as Record<string, unknown>;
    const label = normalizeString(candidate.label);
    const key = normalizeString(candidate.key) || normalizeOptionValue(label);
    if (!label || !key) return acc;
    const normalizedKey = key.toLowerCase();
    if (seenKeys.has(normalizedKey)) return acc;
    seenKeys.add(normalizedKey);
    const rawScope = normalizeString(candidate.scope) as PulseCheckSportAttributeScope;

    acc.push({
      id: normalizeString(candidate.id) || `${key}-${index}`,
      key,
      label,
      unit: normalizeString(candidate.unit),
      scope: ATTRIBUTE_SCOPES.includes(rawScope) ? rawScope : 'athlete',
      includeInNoraContext: candidate.includeInNoraContext !== false,
      sortOrder: typeof candidate.sortOrder === 'number' && Number.isFinite(candidate.sortOrder) ? candidate.sortOrder : index,
    });

    return acc;
  }, []).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
};

const normalizePrompting = (value: unknown): PulseCheckSportPromptingConfiguration => {
  if (!value || typeof value !== 'object') return {};
  const candidate = value as Record<string, unknown>;
  return {
    noraContext: normalizeString(candidate.noraContext),
    macraNutritionContext: normalizeString(candidate.macraNutritionContext),
    riskFlags: normalizeList(candidate.riskFlags),
    restrictedAdvice: normalizeList(candidate.restrictedAdvice),
    recommendedLanguage: normalizeList(candidate.recommendedLanguage),
  };
};

const sortSports = (sports: PulseCheckSportConfigurationEntry[]) =>
  [...sports].sort((left, right) => {
    if (left.sortOrder === right.sortOrder) {
      return left.name.localeCompare(right.name);
    }

    return left.sortOrder - right.sortOrder;
  });

const cloneSports = (sports: PulseCheckSportConfigurationEntry[]) =>
  sports.map((sport) => ({
    ...sport,
    positions: [...sport.positions],
    attributes: (sport.attributes || []).map((attribute) => ({
      ...attribute,
      options: (attribute.options || []).map((option) => ({ ...option })),
    })),
    metrics: (sport.metrics || []).map((metric) => ({ ...metric })),
    prompting: {
      ...(sport.prompting || {}),
      riskFlags: [...(sport.prompting?.riskFlags || [])],
      restrictedAdvice: [...(sport.prompting?.restrictedAdvice || [])],
      recommendedLanguage: [...(sport.prompting?.recommendedLanguage || [])],
    },
  }));

const normalizeSportArray = (value: unknown): PulseCheckSportConfigurationEntry[] => {
  if (!Array.isArray(value)) {
    return getDefaultPulseCheckSports();
  }

  const seenNames = new Set<string>();
  const normalized = value.reduce<PulseCheckSportConfigurationEntry[]>((acc, entry, index) => {
    if (!entry || typeof entry !== 'object') return acc;

    const candidate = entry as Record<string, unknown>;
    const name = normalizeString(candidate.name);
    if (!name) return acc;

    const normalizedName = name.toLowerCase();
    if (seenNames.has(normalizedName)) return acc;
    seenNames.add(normalizedName);

    const parsedSortOrder =
      typeof candidate.sortOrder === 'number' && Number.isFinite(candidate.sortOrder)
        ? candidate.sortOrder
        : index;

    acc.push({
      id: normalizeString(candidate.id) || slugifySportId(name),
      name,
      emoji: normalizeString(candidate.emoji) || '🏅',
      positions: normalizePositions(candidate.positions),
      sortOrder: parsedSortOrder,
      schemaVersion: typeof candidate.schemaVersion === 'number' && Number.isFinite(candidate.schemaVersion)
        ? candidate.schemaVersion
        : 1,
      attributes: normalizeAttributes(candidate.attributes),
      metrics: normalizeMetrics(candidate.metrics),
      prompting: normalizePrompting(candidate.prompting),
    });

    return acc;
  }, []);

  if (normalized.length === 0) {
    return getDefaultPulseCheckSports();
  }

  return sortSports(normalized).map((sport, index) => ({
    ...sport,
    sortOrder: index,
  }));
};

export const getDefaultPulseCheckSports = () => cloneSports(DEFAULT_PULSECHECK_SPORTS);

export const fetchPulseCheckSportConfiguration = async (): Promise<PulseCheckSportConfigurationEntry[]> => {
  try {
    const snapshot = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOCUMENT));
    if (!snapshot.exists()) {
      return getDefaultPulseCheckSports();
    }

    return normalizeSportArray(snapshot.data()?.sports);
  } catch (error) {
    console.error('[PulseCheckSportConfig] Failed to fetch sport configuration:', error);
    return getDefaultPulseCheckSports();
  }
};

export const savePulseCheckSportConfiguration = async (
  sports: PulseCheckSportConfigurationEntry[]
): Promise<PulseCheckSportConfigurationEntry[]> => {
  const normalizedSports = normalizeSportArray(sports).map((sport, index) => ({
    ...sport,
    sortOrder: index,
  }));

  await setDoc(
    doc(db, CONFIG_COLLECTION, CONFIG_DOCUMENT),
    {
        sports: normalizedSports.map((sport) => ({
          id: sport.id,
          name: sport.name,
          emoji: sport.emoji,
          positions: sport.positions,
          sortOrder: sport.sortOrder,
          schemaVersion: sport.schemaVersion || 1,
          attributes: normalizeAttributes(sport.attributes),
          metrics: normalizeMetrics(sport.metrics),
          prompting: normalizePrompting(sport.prompting),
        })),
      updatedAt: serverTimestamp(),
      updatedBySource: 'human-ui',
      updatedByUid: auth.currentUser?.uid || '',
      updatedByEmail: auth.currentUser?.email || '',
    },
    { merge: true }
  );

  return normalizedSports;
};
