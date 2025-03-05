// FILE: pages/api/get-user-data.ts
// API route for fetching user data

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_SECRET_KEY) {
    throw new Error('Missing required Firebase environment variables');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "quicklifts-dd3f1",
      privateKey: process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
      clientEmail: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
    })
  });
}

const db = admin.firestore();

type ResponseData = {
  success: boolean;
  user?: {
    id: string;
    displayName?: string;
    username?: string;
    email?: string;
    creator?: {
      onboardingStatus?: string;
      onboardingLink?: string;
      onboardingExpirationDate?: string;
      stripeAccountId?: string;
    };
  };
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing userId parameter' });
  }
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const userData = userDoc.data();
    
    // Return only necessary user data (avoid sensitive info)
    res.status(200).json({
      success: true,
      user: {
        id: userDoc.id,
        displayName: userData?.displayName,
        username: userData?.username,
        email: userData?.email,
        creator: userData?.creator || null
      }
    });
  } catch (err) {
    console.error('Error fetching user data:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user data' 
    });
  }
}

