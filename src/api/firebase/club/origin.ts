export type ClubMemberOriginCategory =
  | 'unknown'
  | 'creator'
  | 'manual'
  | 'backfill'
  | 'event-checkin'
  | 'round';

export interface ParsedClubMemberOrigin {
  category: ClubMemberOriginCategory;
  key: string;
  label: string;
  roundId?: string;
}

export function parseClubMemberOrigin(joinedVia?: string | null): ParsedClubMemberOrigin {
  const value = joinedVia?.trim();

  if (!value || value === 'unknown') {
    return { category: 'unknown', key: 'unknown', label: 'Unknown' };
  }

  if (value === 'creator') {
    return { category: 'creator', key: 'creator', label: 'Host' };
  }

  if (value === 'manual') {
    return { category: 'manual', key: 'manual', label: 'Manual Add' };
  }

  if (value === 'backfill') {
    return { category: 'backfill', key: 'backfill', label: 'Backfill' };
  }

  if (value.startsWith('event-checkin')) {
    return { category: 'event-checkin', key: 'event-checkin', label: 'Event QR Check-in' };
  }

  return {
    category: 'round',
    key: `round:${value}`,
    label: value,
    roundId: value,
  };
}

export function getClubMemberOriginDisplayLabel(
  origin: ParsedClubMemberOrigin | string | null | undefined,
  roundNameCache: Record<string, string> = {},
  options: { includeRoundPrefix?: boolean } = {}
): string {
  const parsed = typeof origin === 'string' || !origin
    ? parseClubMemberOrigin(origin)
    : origin;

  if (parsed.category !== 'round' || !parsed.roundId) {
    return parsed.label;
  }

  const includeRoundPrefix = options.includeRoundPrefix ?? true;
  const resolvedName = roundNameCache[parsed.roundId] || `${parsed.roundId.slice(0, 8)}...`;

  return includeRoundPrefix ? `Round: ${resolvedName}` : resolvedName;
}
