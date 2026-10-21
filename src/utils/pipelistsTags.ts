/** Keep display spelling while trimming and deduplicating user-created tags. */
export const normalizeLeadTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    if (typeof entry !== 'string') return [];
    const tag = entry.trim().replace(/\s+/g, ' ');
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) return [];
    seen.add(key);
    return [tag];
  });
};

/** Match any selected tag; an empty selection includes tagged and untagged leads. */
export const matchesLeadTagFilters = (tags: unknown, selectedTags: readonly string[]): boolean => {
  const filters = normalizeLeadTags(selectedTags).map((tag) => tag.toLowerCase());
  if (filters.length === 0) return true;
  return normalizeLeadTags(tags).some((tag) => filters.includes(tag.toLowerCase()));
};
