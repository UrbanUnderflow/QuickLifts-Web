import { Handler } from '@netlify/functions';
import sharp from 'sharp';

const handler: Handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const { title = 'Pulse', template } = params;

    // Research template: black background, "Research" text, Pulse logo (wordmark) under
    if (template === 'research') {
      const svg = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#000000"/>
  <text x="600" y="280"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, Helvetica, sans-serif"
        font-size="72"
        font-weight="700"
        fill="#FFFFFF"
        text-anchor="middle">Research</text>
  <text x="600" y="380"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, Helvetica, sans-serif"
        font-size="32"
        font-weight="600"
        fill="#FFFFFF"
        text-anchor="middle" letter-spacing="0.15em">PULSE</text>
</svg>`);
      const pngBuffer = await sharp(svg)
        .png()
        .toBuffer();
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
    }

    // Decode URL-encoded parameters (default template)
    const decodedTitle = decodeURIComponent(title);

    // Calculate text positioning and sizing based on title length
    const titleFontSize = decodedTitle.length > 30 ? 52 : decodedTitle.length > 20 ? 58 : 64;
    const displayTitle = decodedTitle.length > 45 ? decodedTitle.substring(0, 42) + '...' : decodedTitle;

    // SVG template with Pulse branding
    // Using system fonts for better compatibility
    const svg = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="1200" height="630" fill="#141A1E"/>
  
  <!-- Subtle gradient glow -->
  <defs>
    <radialGradient id="glow" cx="50%" cy="30%" r="50%">
      <stop offset="0%" stop-color="#E0FE10" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#141A1E" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#glow)"/>
  
  <!-- Main Title in Green (centered) -->
  <!-- shadow pass for readability -->
  <text x="602" y="282"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, Helvetica, sans-serif"
        font-size="${titleFontSize}"
        font-weight="900"
        fill="rgba(0,0,0,0.45)"
        text-anchor="middle">${escapeXml(displayTitle)}</text>
  <text x="600" y="280"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, Helvetica, sans-serif"
        font-size="${titleFontSize}"
        font-weight="900"
        fill="#E0FE10"
        text-anchor="middle">${escapeXml(displayTitle)}</text>
  
  <!-- Bottom URL (make it readable) -->
  <g>
    <rect x="430" y="512" rx="18" ry="18" width="340" height="60" fill="rgba(0,0,0,0.35)"/>
    <text x="600" y="552"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, Helvetica, sans-serif"
          font-size="28"
          font-weight="700"
          fill="white"
          text-anchor="middle">fitwithpulse.ai</text>
  </g>
</svg>`);

    // Convert SVG to PNG using sharp
    const pngBuffer = await sharp(svg)
      .png()
      .toBuffer();

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
    
    // Return a fallback response
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
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
