import { Handler } from '@netlify/functions';

/**
 * Dynamic OG image generator.
 *
 * Query params:
 *   variant – "pil" (default when no title provided) renders the Pulse
 *             Intelligence Labs splash (dark gradient + soft orbs + "PIL"
 *             wordmark in white→lime gradient, styled after the Macra / Fit
 *             With Pulse app splash screens).
 *   title   – a short label (e.g. "Research", "Coach") rendered centered on a
 *             dark background with "PULSE" wordmark below.
 *
 * When neither is provided, returns the PIL splash as the universal default.
 *
 * Produces a 1200×630 PNG via SVG → sharp. No external assets required.
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
    // or the legacy title="Pulse" URL that's pinned in crawler caches.
    const usePilSplash =
      variant === 'pil' || !rawTitle || rawTitle.toLowerCase() === 'pulse';

    const svg = Buffer.from(usePilSplash ? renderPilSplash() : renderTitleCard(rawTitle));

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

function renderPilSplash(): string {
  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050608"/>
      <stop offset="55%" stop-color="#0A0A0B"/>
      <stop offset="100%" stop-color="#101218"/>
    </linearGradient>
    <linearGradient id="wordmark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#DFFD10"/>
    </linearGradient>
    <radialGradient id="orbGreen" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#DFFD10" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#DFFD10" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbBlue" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#007AFF" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#007AFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbPurple" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8A2BE2" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="#8A2BE2" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbRed" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#EF4444" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#EF4444" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <ellipse cx="170" cy="110" rx="340" ry="340" fill="url(#orbGreen)"/>
  <ellipse cx="1060" cy="180" rx="300" ry="300" fill="url(#orbBlue)"/>
  <ellipse cx="980" cy="560" rx="280" ry="280" fill="url(#orbPurple)"/>
  <ellipse cx="160" cy="540" rx="220" ry="220" fill="url(#orbRed)"/>

  <rect x="300" y="90" width="1" height="450" fill="#FFFFFF" opacity="0.05"/>
  <rect x="900" y="90" width="1" height="450" fill="#FFFFFF" opacity="0.06"/>

  <text x="600" y="320"
        font-family="${ROUNDED_FONT_STACK}"
        font-size="260"
        font-weight="900"
        fill="url(#wordmark)"
        text-anchor="middle"
        dominant-baseline="central"
        letter-spacing="8">PIL</text>

  <text x="600" y="475"
        font-family="${ROUNDED_FONT_STACK}"
        font-size="26"
        font-weight="600"
        fill="#FFFFFF"
        fill-opacity="0.55"
        text-anchor="middle"
        letter-spacing="7">PULSE INTELLIGENCE LABS</text>
</svg>`;
}

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
