
// FILE: pages/api/trainer/get-earnings.ts
// API endpoint to get trainer earnings data

import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
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
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' // Use an appropriate API version
});

type SaleData = {
  date: string;
  roundTitle: string;
  amount: number;
};

type EarningsData = {
  totalEarned: number;
  pendingPayout: number;
  roundsSold: number;
  recentSales: SaleData[];
};

type ResponseData = {
  success: boolean;
  earnings?: EarningsData;
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
    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const creatorData = userData?.creator || {};
    
    // If no Stripe account, return zeros
    if (!creatorData.stripeAccountId || creatorData.onboardingStatus !== 'complete') {
      return res.status(200).json({
        success: true,
        earnings: {
          totalEarned: 0,
          pendingPayout: 0,
          roundsSold: 0,
          recentSales: []
        }
      });
    }
    
    // Get Stripe balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: creatorData.stripeAccountId
    });
    
    // Calculate pending amount from balance
    const pendingAmount = balance.pending.reduce((sum, balance) => 
      sum + balance.amount, 0) / 100;
    
    // Get payment records from Firestore
    const paymentsSnapshot = await db.collection('payments')
      .where('trainerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(20) // Get last 20 payments
      .get();
    
    const totalEarned = paymentsSnapshot.docs.reduce((sum, doc) => 
      sum + (doc.data().amountTrainer || 0), 0);
    
    // Format recent sales data
    const recentSales: SaleData[] = [];
    const processedChallenges = new Map(); // To avoid redundant challenge lookups
    
    for (const paymentDoc of paymentsSnapshot.docs) {
      const payment = paymentDoc.data();
      const challengeId = payment.challengeId;
      
      let challengeTitle = 'Unknown Round';
      
      // Check if we've already looked up this challenge
      if (processedChallenges.has(challengeId)) {
        challengeTitle = processedChallenges.get(challengeId);
      } else {
        // Look up the challenge title
        try {
          const challengeDoc = await db.collection('challenges')
            .doc(challengeId)
            .get();
          
          if (challengeDoc.exists) {
            challengeTitle = challengeDoc.data()?.title || 'Unknown Round';
          }
          
          // Store for future lookups
          processedChallenges.set(challengeId, challengeTitle);
        } catch (err) {
          console.error(`Error fetching challenge ${challengeId}:`, err);
        }
      }
      
      recentSales.push({
        date: payment.createdAt?.toDate?.() 
          ? payment.createdAt.toDate().toISOString() 
          : new Date().toISOString(),
        roundTitle: challengeTitle,
        amount: payment.amountTrainer || 0
      });
    }
    
    res.status(200).json({
      success: true,
      earnings: {
        totalEarned,
        pendingPayout: pendingAmount,
        roundsSold: paymentsSnapshot.size,
        recentSales
      }
    });
  } catch (err) {
    console.error('Error fetching earnings data:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch earnings data' 
    });
  }
}
