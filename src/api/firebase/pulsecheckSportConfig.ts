import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './config';

export interface PulseCheckSportConfigurationEntry {
  id: string;
  name: string;
  emoji: string;
  positions: string[];
  sortOrder: number;
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
  { id: 'other', name: 'Other', emoji: '🏅', positions: ['Individual'], sortOrder: 15 },
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
