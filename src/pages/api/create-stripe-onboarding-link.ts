import Stripe from 'stripe';
import { getFirestore } from 'firebase-admin/firestore';
import admin from '../../lib/firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  admin.initializeApp();
  const db = getFirestore();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing userId parameter' 
    });
  }
  
  try {
    // Get the user's Stripe Connect account ID
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    const user = userDoc.data()!;
    const connectAccountId = user.creator?.stripeAccountId;
    
    if (!connectAccountId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Stripe account not found for user' 
      });
    }
    
    // Create login link for the Connect account
    const loginLink = await stripe.accounts.createLoginLink(connectAccountId);
    
    res.status(200).json({ 
      success: true,
      url: loginLink.url 
    });
  } catch (err) {
    console.error('Error creating dashboard link:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create dashboard link' 
    });
  }
}