// netlify/functions/sitemap.js
// @ts-ignore
exports.handler = async (event) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://fitwithpulse.ai/${event.queryStringParameters?.username || ''}</loc>
          <lastmod>${new Date().toISOString()}</lastmod>
          <changefreq>daily</changefreq>
        </url>
      </urlset>`;
  
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=0, must-revalidate'
      },
      body: xml
    };
  };