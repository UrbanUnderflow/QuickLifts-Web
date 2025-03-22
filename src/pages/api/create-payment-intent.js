import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { challengeId, amount, currency, userId, buyerEmail } = req.body;
    
    if (!userId) {
      console.warn('create-payment-intent: No userId provided in request body');
    }
    
    // Create a payment intent with additional metadata for recovery
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        challengeId,
        userId: userId || 'unknown',
        buyerEmail: buyerEmail || 'unknown',
        createdAt: new Date().toISOString(),
        source: 'fitwithpulse-web'
      }
    });
    
    console.log(`Payment intent created: ${paymentIntent.id} for user: ${userId || 'unknown'}`);
    
    // Return the client secret to the client
    res.status(200).json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(500).json({ error: 'Failed to create payment' });
  }
}