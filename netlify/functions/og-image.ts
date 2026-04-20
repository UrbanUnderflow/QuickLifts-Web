import { Handler } from '@netlify/functions';

/**
 * Dynamic OG image generator.
 *
 * Query params:
 *   variant=pil – 302 redirect to the pre-rendered static /pil-og.png
 *                 (Pulse Intelligence Labs splash). Also triggered by no
 *                 params at all or the legacy title="Pulse" URL, which covers
 *                 anything pinned in crawler caches.
 *   title       – a short label (e.g. "Research", "Coach") rendered on a dark
 *                 card with "PULSE" wordmark below. Note: the Lambda's
 *                 librsvg has no system fonts, so text renders as tofu in
 *                 production — prefer setting explicit ogMeta.image on pages
 *                 that need a specific title card.
 */

const handler: Handler = async (event) => {
  let sharp: any;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('sharp failed to load');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' },
      body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      isBase64Encoded: true,
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const variant = (params.variant || '').toLowerCase();
    const rawTitle = params.title ? decodeURIComponent(params.title) : '';

    // The PIL splash is the universal default: no title passed, variant=pil,
    // or the legacy title="Pulse" URL that's pinned in crawler caches. Serve
    // it as a 302 to the pre-rendered static PNG — the Lambda's librsvg has
    // no system fonts available and would render text as tofu. The static
    // PNG is generated locally via scripts/generate-pil-og.js.
    const usePilSplash =
      variant === 'pil' || !rawTitle || rawTitle.toLowerCase() === 'pulse';

    if (usePilSplash) {
      return {
        statusCode: 302,
        headers: {
          Location: 'https://fitwithpulse.ai/pil-og.png',
          'Cache-Control': 'public, max-age=3600',
        },
        body: '',
      };
    }

    const svg = Buffer.from(renderTitleCard(rawTitle));

    const pngBuffer = await sharp(svg).png().toBuffer();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
      body: pngBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('Error generating OG image:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to generate image' }),
    };
  }
};

const ROUNDED_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', 'SF Pro Display', 'Segoe UI', Inter, Arial, Helvetica, sans-serif";

function renderTitleCard(rawTitle: string): string {
  const displayTitle =
    rawTitle.length > 30 ? rawTitle.substring(0, 28) + '...' : rawTitle;
  const titleFontSize =
    displayTitle.length > 20 ? 60 : displayTitle.length > 12 ? 72 : 84;

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050608"/>
      <stop offset="55%" stop-color="#0A0A0B"/>
      <stop offset="100%" stop-color="#101218"/>
    </linearGradient>
    <radialGradient id="orbGreen" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#DFFD10" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#DFFD10" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbPurple" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8A2BE2" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#8A2BE2" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <ellipse cx="200" cy="140" rx="320" ry="320" fill="url(#orbGreen)"/>
  <ellipse cx="1000" cy="520" rx="280" ry="280" fill="url(#orbPurple)"/>
  <text x="600" y="300"
        font-family="${ROUNDED_FONT_STACK}"
        font-size="${titleFontSize}"
        font-weight="800"
        fill="#FFFFFF"
        text-anchor="middle"
        dominant-baseline="central">${escapeXml(displayTitle)}</text>
  <text x="600" y="440"
        font-family="${ROUNDED_FONT_STACK}"
        font-size="28"
        font-weight="600"
        fill="#DFFD10"
        fill-opacity="0.85"
        text-anchor="middle"
        letter-spacing="8">PULSE</text>
</svg>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export { handler };
