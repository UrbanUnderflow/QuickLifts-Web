export interface ParsedOgPreview {
  title: string;
  description: string;
  image: string;
  url: string;
  twitterImage: string;
}

export function normalizePreviewUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://${value}`;
}

export function extractSlugFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(normalizePreviewUrl(rawUrl));
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  } catch {
    return '';
  }
}

export function resolvePreviewImage(ogImage: string, slug: string): string {
  if (ogImage.trim()) return ogImage.trim();
  if (!slug.trim()) return '';
  return `https://fitwithpulse.ai/.netlify/functions/og-article?slug=${encodeURIComponent(slug.trim())}`;
}

export function buildOgTagSnippet({
  title,
  description,
  image,
  url,
  ogType = 'article',
}: {
  title: string;
  description: string;
  image: string;
  url: string;
  ogType?: string;
}): string[] {
  if (!title && !description && !image && !url) return [];

  return [
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ];
}

export function parseOgFromHtml(html: string): ParsedOgPreview {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const getMeta = (property: string): string => {
    const el =
      doc.querySelector(`meta[property="${property}"]`) ||
      doc.querySelector(`meta[name="${property}"]`);
    return el?.getAttribute('content') || '';
  };

  let ogTitle = getMeta('og:title');
  let ogDescription = getMeta('og:description');
  let ogImage = getMeta('og:image');
  const ogUrl = getMeta('og:url');
  const twitterImage = getMeta('twitter:image');

  const isGenericDefault =
    !ogTitle ||
    ogTitle === 'Pulse Community Fitness' ||
    ogImage.includes('og-image.png?title=Pulse');

  if (isGenericDefault) {
    try {
      const nextDataEl = doc.querySelector('#__NEXT_DATA__');
      if (nextDataEl?.textContent) {
        const nextData = JSON.parse(nextDataEl.textContent);
        const props = nextData?.props?.pageProps;

        if (props?.ogMeta) {
          ogTitle = props.ogMeta.title || ogTitle;
          ogDescription = props.ogMeta.description || ogDescription;
          ogImage = props.ogMeta.image || ogImage;
        } else if (props?.articleData) {
          const articleData = props.articleData;
          ogTitle = articleData.title || ogTitle;
          ogDescription = articleData.excerpt || articleData.subtitle || ogDescription;
          ogImage = articleData.featuredImage || ogImage;
        }
      }
    } catch {
      // Ignore parse failures and return the direct meta tag values.
    }
  }

  return {
    title: ogTitle,
    description: ogDescription,
    image: ogImage,
    url: ogUrl,
    twitterImage,
  };
}
