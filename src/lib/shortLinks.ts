export const normalizeShortLinkSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

export const normalizeShortLinkDestination = (value: string) => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error('Enter a destination URL before saving this short link.');
  }

  if (normalizedValue.startsWith('/')) {
    return normalizedValue;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedValue);
  } catch {
    throw new Error('Enter a valid destination URL. Use https://... or start with / for an internal page.');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Short links can only redirect to http or https destinations.');
  }

  return parsedUrl.toString();
};

export const resolveShortLinkDestination = (destinationUrl: string, requestOrigin: string) => {
  const normalizedDestination = normalizeShortLinkDestination(destinationUrl);

  return normalizedDestination.startsWith('/')
    ? new URL(normalizedDestination, requestOrigin).toString()
    : normalizedDestination;
};

export const buildPublicShortLink = (slug: string, origin: string) =>
  `${origin.replace(/\/+$/, '')}/go/${slug}`;
