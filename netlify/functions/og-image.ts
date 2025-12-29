import { Handler } from '@netlify/functions';
import sharp from 'sharp';

const handler: Handler = async (event) => {
  try {
    const { title = 'Pulse', subtitle = '' } = event.queryStringParameters || {};
    
    // Decode URL-encoded parameters
    const decodedTitle = decodeURIComponent(title);
    const decodedSubtitle = decodeURIComponent(subtitle);
    
    // Calculate text positioning and sizing based on title length
    const titleFontSize = decodedTitle.length > 30 ? 52 : decodedTitle.length > 20 ? 58 : 64;
    const displayTitle = decodedTitle.length > 45 ? decodedTitle.substring(0, 42) + '...' : decodedTitle;
    
    // Truncate subtitle for display
    const displaySubtitle = decodedSubtitle.length > 90 ? decodedSubtitle.substring(0, 87) + '...' : decodedSubtitle;
    
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
  
  <!-- Pulse Logo Icon (simplified) -->
  <g transform="translate(525, 100)">
    <circle cx="75" cy="60" r="45" fill="none" stroke="white" stroke-width="3.5"/>
    <path d="M57 45 L67 78 L82 52 L92 78" stroke="white" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  
  <!-- "pulse" text -->
  <text x="600" y="220" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="bold" fill="white" text-anchor="middle">pulse</text>
  
  <!-- Main Title in Green -->
  <text x="600" y="340" font-family="Arial, Helvetica, sans-serif" font-size="${titleFontSize}" font-weight="bold" fill="#E0FE10" text-anchor="middle">${escapeXml(displayTitle)}</text>
  
  <!-- Subtitle if provided -->
  ${displaySubtitle ? `<text x="600" y="410" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#9CA3AF" text-anchor="middle">${escapeXml(displaySubtitle)}</text>` : ''}
  
  <!-- Bottom URL -->
  <text x="600" y="560" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#6B7280" text-anchor="middle">fitwithpulse.ai</text>
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
