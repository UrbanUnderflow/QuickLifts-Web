import { NextApiRequest, NextApiResponse } from 'next';

/**
 * This endpoint is for debugging environment variables.
 * IMPORTANT: Only use this during development and remove before production.
 * It doesn't expose sensitive values, just checks if they're defined.
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow this endpoint in development mode
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ message: 'Not found' });
  }

  // Check if the environment variables exist (without exposing values)
  const envCheck = {
    production: {
      NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      NEXT_PUBLIC_FIREBASE_APP_ID: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    },
    development: {
      NEXT_PUBLIC_DEV_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY,
      NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN,
      NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET,
      NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID: !!process.env.NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID,
      NEXT_PUBLIC_DEV_FIREBASE_APP_ID: !!process.env.NEXT_PUBLIC_DEV_FIREBASE_APP_ID,
    },
    // Include project IDs which is safe to expose and useful for debugging
    projectIds: {
      production: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      development: process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID,
    }
  };

  res.status(200).json({
    envCheck,
    nodeEnv: process.env.NODE_ENV,
    isLocalhost: req.headers.host?.includes('localhost') || req.headers.host?.includes('127.0.0.1'),
    timestamp: new Date().toISOString()
  });
} 