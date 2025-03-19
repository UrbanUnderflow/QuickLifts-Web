import { NextApiRequest, NextApiResponse } from 'next';

/**
 * This endpoint is for debugging environment variables.
 * IMPORTANT: Only use this during development and remove before production!
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow this endpoint in development mode
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ message: 'Not found' });
  }

  const allEnvVars = Object.keys(process.env)
    .filter(key => key.startsWith('NEXT_PUBLIC_'))
    .reduce((obj, key) => {
      obj[key] = process.env[key] ? `${process.env[key]?.substring(0, 3)}...` : undefined;
      return obj;
    }, {} as Record<string, string | undefined>);

  const envGroups = {
    // Production Firebase variables
    production: {
      NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅' : '❌',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✅' : '❌',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✅' : '❌',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '✅' : '❌',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? '✅' : '❌',
      NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✅' : '❌',
    },
    // Development Firebase variables
    development: {
      NEXT_PUBLIC_DEV_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY ? '✅' : '❌',
      NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN ? '✅' : '❌',
      NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID ? '✅' : '❌',
      NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET ? '✅' : '❌',
      NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID ? '✅' : '❌',
      NEXT_PUBLIC_DEV_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_DEV_FIREBASE_APP_ID ? '✅' : '❌',
    },
  };

  // Add actual project IDs which is safe to expose and useful for debugging
  const projectIds = {
    production: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'not set',
    development: process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID || 'not set',
  };

  res.status(200).json({
    message: 'Environment variable debug info',
    nodeEnv: process.env.NODE_ENV,
    isLocalhost: req.headers.host?.includes('localhost') || req.headers.host?.includes('127.0.0.1'),
    allPublicEnvVars: allEnvVars,
    envCheckByGroup: envGroups,
    projectIds,
    nextPublicPrefixes: {
      hasDevVariables: Object.keys(process.env).some(key => key.startsWith('NEXT_PUBLIC_DEV_')),
      hasProductionVariables: Object.keys(process.env).some(key => key.startsWith('NEXT_PUBLIC_FIREBASE_')),
    },
    timestamp: new Date().toISOString()
  });
} 