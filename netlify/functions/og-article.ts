import type { Handler } from '@netlify/functions';
import sharp from 'sharp';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const OG_SIZE = { width: 1200, height: 630 };

const BASE_URL = process.env.URL || 'https://fitwithpulse.ai';

/**
 * Resolve slug to the public URL of the featured image.
 * Uses same convention as frontend: /research-{slug}-featured.png
 */
function getImageUrlForSlug(slug: string): string {
  const safe = slug.replace(/[^a-z0-9-]/gi, '');
  return `${BASE_URL.replace(/\/$/, '')}/research-${safe}-featured.png`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const slug = event.queryStringParameters?.slug?.trim();
  if (!slug) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'Missing slug' }),
    };
  }

  const imageUrl = getImageUrlForSlug(slug);

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ error: `Image not found: ${imageUrl}` }),
      };
    }

    const arrayBuffer = await res.arrayBuffer();
    const sourceBuffer = Buffer.from(arrayBuffer);

    const ogBuffer = await sharp(sourceBuffer)
      .resize(OG_SIZE.width, OG_SIZE.height, { fit: 'cover', position: 'center' })
      .png()
      .toBuffer();

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: ogBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error: unknown) {
    console.error('[og-article] failed', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'OG image generation failed' }),
    };
  }
};
