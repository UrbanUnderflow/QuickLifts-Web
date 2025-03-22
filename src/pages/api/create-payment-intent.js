import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { challengeId, amount, currency, buyerId, buyerEmail } = req.body;
    
    if (!buyerId) {
      console.warn('create-payment-intent: No buyerId provided in request body');
    }
    
    // Create a payment intent with additional metadata for recovery
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        challengeId,
        buyerId: buyerId || 'unknown',
        buyerEmail: buyerEmail || 'unknown',
        createdAt: new Date().toISOString(),
        source: 'fitwithpulse-web'
      }
    });
    
    console.log(`Payment intent created: ${paymentIntent.id} for buyer: ${buyerId || 'unknown'}`);
    
    // Return the client secret to the client
    res.status(200).json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(500).json({ error: 'Failed to create payment' });
  }
}