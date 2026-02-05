import { Handler } from '@netlify/functions';

/**
 * Dynamic OG image generator.
 *
 * Query params:
 *   title  – the single word / short label to display (default: "Pulse")
 *
 * Produces a 1200×630 PNG: black background, white title centered,
 * "PULSE" wordmark underneath.
 *
 * Uses only SVG → PNG via sharp. No external assets needed.
 */

const handler: Handler = async (event) => {
  // Dynamically import sharp so bundler doesn't choke on the native binary
  let sharp: any;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    // If sharp can't load, return a 1×1 transparent PNG as absolute fallback
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
    const rawTitle = params.title || 'Pulse';
    const decodedTitle = decodeURIComponent(rawTitle);

    // Keep it short – truncate to 30 chars max
    const displayTitle = decodedTitle.length > 30
      ? decodedTitle.substring(0, 28) + '...'
      : decodedTitle;

    // Scale font based on length
    const titleFontSize = displayTitle.length > 20 ? 60 : displayTitle.length > 12 ? 72 : 84;

    const svg = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#000000"/>
  <text x="600" y="280"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, Helvetica, sans-serif"
        font-size="${titleFontSize}"
        font-weight="700"
        fill="#FFFFFF"
        text-anchor="middle"
        dominant-baseline="central">${escapeXml(displayTitle)}</text>
  <text x="600" y="420"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, Helvetica, sans-serif"
        font-size="28"
        font-weight="600"
        fill="#666666"
        text-anchor="middle"
        letter-spacing="0.2em">PULSE</text>
</svg>`);

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

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export { handler };
