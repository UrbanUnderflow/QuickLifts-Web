import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Proxy endpoint to fetch a page's HTML for OG tag extraction.
 * Used by the OG Preview Tester (/admin/og-preview) to parse
 * meta tags from any URL without running into CORS restrictions.
 *
 * GET /api/og-fetch?url=https://fitwithpulse.ai/research/agile-is-dead
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const url = req.query.url as string;

    if (!url) {
        return res.status(400).json({ error: 'Missing ?url= parameter' });
    }

    try {
        // Use https/http modules which are always available in Node.js
        const https = require('https');
        const http = require('http');
        const { URL } = require('url');

        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        const html = await new Promise<string>((resolve, reject) => {
            const request = client.get(
                url,
                {
                    headers: {
                        'User-Agent':
                            'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
                        Accept: 'text/html,application/xhtml+xml',
                    },
                    timeout: 10000,
                },
                (response: any) => {
                    // Follow redirects
                    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        client.get(
                            response.headers.location,
                            {
                                headers: {
                                    'User-Agent':
                                        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
                                    Accept: 'text/html,application/xhtml+xml',
                                },
                                timeout: 10000,
                            },
                            (redirectRes: any) => {
                                let data = '';
                                redirectRes.on('data', (chunk: string) => (data += chunk));
                                redirectRes.on('end', () => resolve(data));
                                redirectRes.on('error', reject);
                            }
                        );
                        return;
                    }

                    if (response.statusCode !== 200) {
                        reject(new Error(`HTTP ${response.statusCode}`));
                        return;
                    }

                    let data = '';
                    response.on('data', (chunk: string) => (data += chunk));
                    response.on('end', () => resolve(data));
                    response.on('error', reject);
                }
            );

            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Request timed out'));
            });
        });

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).send(html);
    } catch (err: any) {
        console.error('[og-fetch] Error fetching URL:', url, err?.message);
        return res.status(500).json({
            error: err?.message || 'Failed to fetch URL',
        });
    }
}
