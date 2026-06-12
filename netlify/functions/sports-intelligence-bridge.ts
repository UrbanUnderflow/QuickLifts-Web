import { Handler } from '@netlify/functions';
import { db, headers as corsHeaders } from './config/firebase';

// ---------------------------------------------------------------------------
// sports-intelligence-bridge
//
// The single gateway every Pulse app uses to consume the Sports Intelligence
// layer — the same posture as openai-bridge for model calls. Apps pass the
// athlete's sport string (e.g. "Men's Physique", "basketball"); the bridge
// resolves it against the per-sport configuration in Firestore
// (company-config/pulsecheck-sports) and returns the resolved intelligence
// packet: archetype, training nuance (with division overrides applied), and
// the sport's language posture.
//
//   GET  /.netlify/functions/sports-intelligence-bridge?sport=Men's%20Physique
//   POST { "sport": "Men's Physique", "division": "Men's Physique" }
//
// Consumers today: FWP workout generation (nuance → generator/critic),
// Nora prompting, SI report surfaces. Read-only; nothing here writes.
// ---------------------------------------------------------------------------

const CONFIG_COLLECTION = 'company-config';
const CONFIG_DOCUMENT = 'pulsecheck-sports';

type SportEntry = {
  id?: string;
  name?: string;
  emoji?: string;
  positions?: string[];
  trainingNuance?: Record<string, unknown> & {
    divisionOverrides?: Record<string, Record<string, unknown>>;
  };
  reportPolicy?: { languagePosture?: { mustAvoid?: string[]; recommendedLanguage?: string[] } };
};

/// Lowercase, trim, and normalize curly apostrophes so "Men’s Physique"
/// (config) matches "Men's Physique" (user doc).
const normalize = (value: string): string =>
  value.toLowerCase().replace(/[’‘]/g, "'").trim();

/// Same archetype families the iOS reasoning layer uses.
const archetypeFor = (sport: string): string => {
  const s = normalize(sport);
  const has = (keywords: string[]) => keywords.some((k) => s.includes(k));
  if (has(['physique', 'bodybuild', 'bikini', 'powerlift', 'weightlift', 'crossfit', 'olympic', 'strongman', 'throw'])) {
    return 'strength';
  }
  if (has(['esport', 'chess', 'golf', 'dart', 'racing', 'archery', 'shooting'])) {
    return 'mental';
  }
  if (has(['run', 'cycl', 'swim', 'triathlon', 'rowing', 'soccer', 'football', 'basketball',
           'hockey', 'tennis', 'lacrosse', 'rugby', 'volleyball', 'wrestling', 'track', 'baseball', 'softball'])) {
    return 'endurance';
  }
  return 'general';
};

/// Find the config entry for a sport string: exact name/id first, then
/// division (positions) membership — "Men's Physique" resolves to the
/// Bodybuilding/Physique entry with its division identified.
const resolveEntry = (
  sports: SportEntry[],
  sportRaw: string
): { entry: SportEntry; division: string | null } | null => {
  const target = normalize(sportRaw);
  for (const entry of sports) {
    if (normalize(entry.name || '') === target || normalize(entry.id || '') === target) {
      return { entry, division: null };
    }
  }
  for (const entry of sports) {
    const division = (entry.positions || []).find((p) => normalize(p) === target);
    if (division) return { entry, division };
  }
  // Loose containment as a last resort ("women's soccer" → Soccer).
  for (const entry of sports) {
    const name = normalize(entry.name || '');
    if (name && (target.includes(name) || name.includes(target))) {
      return { entry, division: null };
    }
  }
  return null;
};

/// Merge division overrides over the sport-level nuance.
const resolveNuance = (
  entry: SportEntry,
  division: string | null
): Record<string, unknown> | null => {
  const base = entry.trainingNuance;
  if (!base) return null;
  const { divisionOverrides, ...sportLevel } = base;
  if (!division || !divisionOverrides) return sportLevel;
  const overrideKey = Object.keys(divisionOverrides)
    .find((key) => normalize(key) === normalize(division));
  if (!overrideKey) return sportLevel;
  return { ...sportLevel, ...divisionOverrides[overrideKey] };
};

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  let sport = '';
  let division = '';
  if (event.httpMethod === 'GET') {
    sport = event.queryStringParameters?.sport || '';
    division = event.queryStringParameters?.division || '';
  } else if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      sport = typeof body.sport === 'string' ? body.sport : '';
      division = typeof body.division === 'string' ? body.division : '';
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid JSON body.' }),
      };
    }
  } else {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Use GET or POST.' }),
    };
  }

  if (!sport.trim()) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing required "sport" parameter.' }),
    };
  }

  try {
    const snapshot = await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOCUMENT).get();
    const sports: SportEntry[] = snapshot.exists ? (snapshot.data()?.sports || []) : [];

    const match = resolveEntry(sports, sport);
    const archetype = archetypeFor(sport);

    if (!match) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=300' },
        body: JSON.stringify({
          resolved: false,
          sport: { id: null, name: sport.trim(), emoji: null },
          division: null,
          archetype,
          trainingNuance: null,
          languagePosture: null,
        }),
      };
    }

    const resolvedDivision = division.trim() || match.division;
    const posture = match.entry.reportPolicy?.languagePosture;

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=300' },
      body: JSON.stringify({
        resolved: true,
        sport: {
          id: match.entry.id || null,
          name: match.entry.name || sport.trim(),
          emoji: match.entry.emoji || null,
        },
        division: resolvedDivision,
        archetype,
        trainingNuance: resolveNuance(match.entry, resolvedDivision),
        languagePosture: posture
          ? { mustAvoid: posture.mustAvoid || [], recommendedLanguage: posture.recommendedLanguage || [] }
          : null,
      }),
    };
  } catch (error) {
    console.error('[sports-intelligence-bridge] lookup failed:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Sports Intelligence lookup failed.' }),
    };
  }
};

export { handler };
