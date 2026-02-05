import type { Handler } from '@netlify/functions';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const OG_SIZE = { width: 1200, height: 630 };

const ARTICLE_IMAGE_MAP: Record<string, string> = {
  'the-system': 'public/research-the-system-featured.png',
};

async function resolveArticleImagePath(slug: string): Promise<string | null> {
  // First check explicit map for custom overrides
  if (ARTICLE_IMAGE_MAP[slug]) {
    return ARTICLE_IMAGE_MAP[slug];
  }

  // Then fallback to a standard naming convention:
  // public/research-{slug}-featured.png
  const candidate = `public/research-${slug}-featured.png`;
  try {
    await fs.access(path.join(process.cwd(), candidate));
    return candidate;
  } catch {
    return null;
  }
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
  const filePath = slug ? await resolveArticleImagePath(slug) : null;

  if (!filePath) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'Missing or invalid slug' }),
    };
  }

  try {
    const absolutePath = path.join(process.cwd(), filePath);
    const sourceBuffer = await fs.readFile(absolutePath);

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
  } catch (error: any) {
    console.error('[og-article] failed', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'OG image generation failed' }),
    };
  }
};
