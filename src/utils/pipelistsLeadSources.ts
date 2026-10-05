// Only use URLs actually cited in the research response, never guessed alternatives.
export const getLeadSourceCandidates = (response: unknown): string[] => {
  const output = (response as { output?: unknown[] } | null)?.output;
  if (!Array.isArray(output)) return [];
  const urls: string[] = [];
  for (const item of output) {
    const content = (item as { content?: unknown[] } | null)?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const annotations = (part as { annotations?: unknown[] } | null)?.annotations;
      if (!Array.isArray(annotations)) continue;
      for (const annotation of annotations) {
        const citation = annotation as { type?: string; url?: unknown } | null;
        if (citation?.type !== 'url_citation' || typeof citation.url !== 'string') continue;
        try {
          const url = new URL(citation.url);
          if (['https:', 'http:'].includes(url.protocol)) urls.push(url.toString());
        } catch { /* Ignore malformed citations. */ }
      }
    }
  }
  return Array.from(new Set(urls)).slice(0, 5);
};
