/**
 * Calculate Coach Revenue
 * 
 * Calculates revenue sharing for coaches based on the partnership model:
 * - Coach Partnership: 40% to coach, 60% to Pulse  
 * - Coach Referral: 20% to referring coach, 80% to Pulse
 */

const Stripe = require('stripe');
const { db, headers } = require('./config/firebase');

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Revenue sharing percentages
const REVENUE_SPLITS = {
  COACH_SHARE: 0.40,      // 40% to coach from their athletes
  PULSE_SHARE: 0.60,      // 60% to Pulse from coach's athletes
  REFERRAL_SHARE: 0.20,   // 20% to referring coach from referred coach's revenue
  PULSE_REFERRAL: 0.80    // 80% to Pulse from referred coach's athletes
};

// Get all active subscriptions for revenue calculation
const getActiveSubscriptions = async () => {
  try {
    // Get all subscriptions with limit and pagination
    const subscriptions = [];
    let hasMore = true;
    let startingAfter = null;

    while (hasMore) {
      const params = {
        status: 'active',
        limit: 100
      };

      if (startingAfter) {
        params.starting_after = startingAfter;
      }

      const batch = await stripe.subscriptions.list(params);
      subscriptions.push(...batch.data);
      
      hasMore = batch.has_more;
      if (hasMore) {
        startingAfter = batch.data[batch.data.length - 1].id;
      }
    }

    return subscriptions;
  } catch (error) {
    console.error('[RevenueCalc] Error fetching subscriptions:', error);
    throw error;
  }
};

// Calculate revenue for a specific coach
const calculateCoachRevenue = async (coachId, subscriptions) => {
  try {
    console.log(`[RevenueCalc] Calculating revenue for coach: ${coachId}`);

    // Get coach's athletes
    const coachAthletesQuery = await db.collection('coachAthletes')
      .where('coachId', '==', coachId)
      .get();

    const athleteUserIds = coachAthletesQuery.docs.map(doc => doc.data().athleteUserId);

    // Calculate direct revenue from coach's athletes
    let directRevenue = 0;
    let athleteCount = 0;
    const athleteSubscriptions = [];

    for (const subscription of subscriptions) {
      const userId = subscription.metadata?.userId;
      const userType = subscription.metadata?.userType;

      // Only count athlete subscriptions linked to this coach
      if (userId && userType === 'athlete' && athleteUserIds.includes(userId)) {
        const monthlyAmount = subscription.items.data[0].price.unit_amount / 100; // Convert from cents
        
        // Annualize if it's an annual subscription
        const annualAmount = subscription.items.data[0].price.recurring.interval === 'year' 
          ? monthlyAmount 
          : monthlyAmount * 12;

        directRevenue += annualAmount;
        athleteCount++;
        athleteSubscriptions.push({
          subscriptionId: subscription.id,
          userId: userId,
          amount: monthlyAmount,
          interval: subscription.items.data[0].price.recurring.interval
        });
      }
    }

    // Calculate coach's share (40%)
    const coachShare = directRevenue * REVENUE_SPLITS.COACH_SHARE;

    console.log(`[RevenueCalc] Coach ${coachId} direct revenue: $${directRevenue}/year from ${athleteCount} athletes`);
    console.log(`[RevenueCalc] Coach ${coachId} share (40%): $${coachShare}/year`);

    return {
      coachId,
      directRevenue,
      coachShare,
      athleteCount,
      athleteSubscriptions
    };

  } catch (error) {
    console.error(`[RevenueCalc] Error calculating revenue for coach ${coachId}:`, error);
    throw error;
  }
};

// Calculate referral revenue for a specific coach
const calculateReferralRevenue = async (coachId, allCoachRevenues) => {
  try {
    console.log(`[RevenueCalc] Calculating referral revenue for coach: ${coachId}`);

    // Get coaches referred by this coach
    const referralsQuery = await db.collection('coachReferrals')
      .where('referrerCoachId', '==', coachId)
      .get();

    let totalReferralRevenue = 0;
    const referralDetails = [];

    for (const referralDoc of referralsQuery.docs) {
      const referralData = referralDoc.data();
      const referredCoachId = referralData.referredCoachId;

      // Find the referred coach's revenue
      const referredCoachRevenue = allCoachRevenues.find(cr => cr.coachId === referredCoachId);
      
      if (referredCoachRevenue) {
        // Referring coach gets 20% of the TOTAL revenue from referred coach's athletes
        const referralBonus = referredCoachRevenue.directRevenue * REVENUE_SPLITS.REFERRAL_SHARE;
        totalReferralRevenue += referralBonus;

        referralDetails.push({
          referredCoachId,
          referredCoachRevenue: referredCoachRevenue.directRevenue,
          referralBonus,
          athleteCount: referredCoachRevenue.athleteCount
        });

        console.log(`[RevenueCalc] Referral bonus from ${referredCoachId}: $${referralBonus}/year`);
      }
    }

    console.log(`[RevenueCalc] Coach ${coachId} total referral revenue: $${totalReferralRevenue}/year`);

    return {
      totalReferralRevenue,
      referralDetails,
      referralCount: referralDetails.length
    };

  } catch (error) {
    console.error(`[RevenueCalc] Error calculating referral revenue for coach ${coachId}:`, error);
    throw error;
  }
};

// Main revenue calculation function
const calculateAllCoachRevenues = async () => {
  try {
    console.log('[RevenueCalc] Starting revenue calculation for all coaches');

    // Get all active coaches
    const coachesQuery = await db.collection('coaches')
      .where('subscriptionStatus', '==', 'active')
      .get();

    if (coachesQuery.empty) {
      console.log('[RevenueCalc] No active coaches found');
      return { coaches: [], summary: { totalCoaches: 0, totalRevenue: 0 } };
    }

    // Get all active subscriptions
    const subscriptions = await getActiveSubscriptions();
    console.log(`[RevenueCalc] Found ${subscriptions.length} active subscriptions`);

    // Calculate direct revenue for each coach
    const allCoachRevenues = [];
    for (const coachDoc of coachesQuery.docs) {
      const coachId = coachDoc.id;
      const coachRevenue = await calculateCoachRevenue(coachId, subscriptions);
      allCoachRevenues.push(coachRevenue);
    }

    // Calculate referral revenue for each coach
    const finalCoachRevenues = [];
    for (const coachRevenue of allCoachRevenues) {
      const referralRevenue = await calculateReferralRevenue(coachRevenue.coachId, allCoachRevenues);
      
      const totalRevenue = coachRevenue.coachShare + referralRevenue.totalReferralRevenue;

      finalCoachRevenues.push({
        ...coachRevenue,
        ...referralRevenue,
        totalRevenue,
        calculatedAt: new Date().toISOString()
      });
    }

    // Calculate summary
    const summary = {
      totalCoaches: finalCoachRevenues.length,
      totalRevenue: finalCoachRevenues.reduce((sum, coach) => sum + coach.totalRevenue, 0),
      totalAthletes: finalCoachRevenues.reduce((sum, coach) => sum + coach.athleteCount, 0),
      totalReferrals: finalCoachRevenues.reduce((sum, coach) => sum + coach.referralCount, 0)
    };

    console.log('[RevenueCalc] Revenue calculation completed');
    console.log(`[RevenueCalc] Summary: ${summary.totalCoaches} coaches, $${summary.totalRevenue}/year total`);

    return {
      coaches: finalCoachRevenues,
      summary
    };

  } catch (error) {
    console.error('[RevenueCalc] Error in revenue calculation:', error);
    throw error;
  }
};

// Store revenue calculation results
const storeRevenueCalculation = async (revenueData) => {
  try {
    const timestamp = new Date().toISOString();
    
    // Store in a revenue-calculations collection for history
    await db.collection('revenue-calculations').add({
      ...revenueData,
      calculatedAt: timestamp
    });

    // Update each coach's document with their current revenue
    for (const coach of revenueData.coaches) {
      await db.collection('coaches').doc(coach.coachId).update({
        currentRevenue: coach.totalRevenue,
        directRevenue: coach.coachShare,
        referralRevenue: coach.totalReferralRevenue,
        lastRevenueCalculation: timestamp,
        updatedAt: new Date()
      });
    }

    console.log('[RevenueCalc] Revenue calculation stored successfully');
  } catch (error) {
    console.error('[RevenueCalc] Error storing revenue calculation:', error);
    throw error;
  }
};

const handler = async (event) => {
  console.log(`[RevenueCalc] Received ${event.httpMethod} request.`);

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    // Calculate revenues for all coaches
    const revenueData = await calculateAllCoachRevenues();

    // Store the results
    await storeRevenueCalculation(revenueData);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Revenue calculation completed successfully',
        summary: revenueData.summary,
        calculatedAt: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error('[RevenueCalc] Error in revenue calculation handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: error.message || 'Failed to calculate coach revenues.' 
      }),
    };
  }
};

module.exports = { handler, calculateAllCoachRevenues };
