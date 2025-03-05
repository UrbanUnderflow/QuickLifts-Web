import { db } from '../../lib/firebase-admin'; // You'll need to set this up

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { challengeId, paymentId } = req.body;
    
    // Store payment record in your database
    // This should be associated with the user who is logged in
    // You might want to get the user from a session or token
    
    // Example: Store payment record
    await db.collection('payments').add({
      challengeId,
      paymentId,
      userId: req.user?.id, // Get from auth session
      status: 'completed',
      timestamp: new Date()
    });
    
    // Return success
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error completing payment:', err);
    res.status(500).json({ error: 'Failed to complete payment' });
  }
}