import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

/**
 * API route that acts as a CORS proxy for Firebase Storage
 * This allows the client to access Firebase Storage resources without CORS issues
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get the URL from the query parameters
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Validate that the URL is from Firebase Storage
    if (!url.includes('firebasestorage.googleapis.com')) {
      return res.status(403).json({ error: 'Only Firebase Storage URLs are allowed' });
    }

    console.log('[PROXY] Fetching resource from:', url);
    
    // Fetch the resource
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('[PROXY] Error fetching resource:', response.statusText);
      return res.status(response.status).json({ 
        error: `Failed to fetch resource: ${response.statusText}` 
      });
    }

    // Get the content type and other headers
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    const contentDisposition = response.headers.get('content-disposition');
    
    // Set the appropriate headers
    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    }
    
    // Allow caching for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Get the response body as a buffer
    const buffer = await response.buffer();
    
    // Send the response
    res.status(200).send(buffer);
  } catch (error) {
    console.error('[PROXY] Error in proxy handler:', error);
    res.status(500).json({ 
      error: 'Failed to proxy request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 