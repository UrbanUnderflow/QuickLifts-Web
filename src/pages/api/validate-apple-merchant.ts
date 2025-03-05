// pages/api/validate-apple-merchant.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { validationURL } = req.body;
    
    if (!validationURL) {
      return res.status(400).json({ 
        error: 'Missing validationURL in request body' 
      });
    }
    
    // Use Stripe to validate the Apple Pay merchant
    const session = await stripe.applePayDomains.create({
      domain_name: process.env.NEXT_PUBLIC_DOMAIN || req.headers.host || '',
    });
    
    // Forward the validation URL to Apple Pay
    const response = await fetch(validationURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchantIdentifier: process.env.APPLE_MERCHANT_ID,
        displayName: 'Pulse',
        initiative: 'web',
        initiativeContext: process.env.NEXT_PUBLIC_DOMAIN || req.headers.host || '',
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Apple Pay validation failed: ${response.statusText}`);
    }
    
    const merchantSession = await response.json();
    return res.status(200).json(merchantSession);
    
  } catch (error) {
    console.error('Error validating Apple Pay merchant:', error);
    return res.status(500).json({ 
      error: 'Failed to validate Apple Pay merchant',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}