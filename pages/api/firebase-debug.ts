import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only available in development mode for security
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not available in production' });
  }

  // Check for Firebase environment variables
  const envVars = {
    // Production vars
    NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    
    // Development vars
    NEXT_DEV_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_DEV_PUBLIC_FIREBASE_API_KEY,
    NEXT_DEV_PUBLIC_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_DEV_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_DEV_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_DEV_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_DEV_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_DEV_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_DEV_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: !!process.env.NEXT_DEV_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_DEV_PUBLIC_FIREBASE_APP_ID: !!process.env.NEXT_DEV_PUBLIC_FIREBASE_APP_ID,
    
    // Node environment
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };

  // Return information about available environment variables
  res.status(200).json({
    message: 'Firebase environment variable status',
    environment: process.env.NODE_ENV,
    variables: envVars,
    // Don't include any sensitive data like actual API keys
    allVariablesSet: Object.entries(envVars)
      .filter(([key]) => key.includes('FIREBASE') && !key.includes('FIREBASE_PRIVATE_KEY'))
      .every(([_, value]) => value === true)
  });
} 