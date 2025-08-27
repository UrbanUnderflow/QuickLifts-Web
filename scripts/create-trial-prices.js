/**
 * Create Stripe prices with free trial periods
 * 
 * This script creates new Stripe prices with 30-day free trials.
 * Run this if you want dedicated trial prices instead of adding trials to checkout sessions.
 */

require('dotenv').config({ path: '.env.local' });

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createTrialPrices() {
  console.log('🚀 Creating Stripe prices with 30-day free trials...\n');

  try {
    // Get existing product IDs from environment
    const athleteProductId = process.env.STRIPE_PRODUCT_ATHLETE;
    const coachProductId = process.env.STRIPE_PRODUCT_COACH;

    if (!athleteProductId || !coachProductId) {
      throw new Error('Missing STRIPE_PRODUCT_ATHLETE or STRIPE_PRODUCT_COACH environment variables. Run create-stripe-products.js first.');
    }

    // Create Athlete Monthly Price with Trial ($12.99/month after 30-day free trial)
    const athleteMonthlyTrialPrice = await stripe.prices.create({
      product: athleteProductId,
      unit_amount: 1299, // $12.99 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
        trial_period_days: 30 // 30-day free trial
      },
      nickname: 'price_athlete_monthly_trial_12_99',
      metadata: {
        type: 'athlete_monthly_trial',
        amount_display: '$12.99/month after 30-day free trial',
        trial_days: '30'
      }
    });

    console.log('✅ Created Athlete Monthly Trial Price:', athleteMonthlyTrialPrice.id);

    // Create Athlete Annual Price with Trial ($119/year after 30-day free trial)
    const athleteAnnualTrialPrice = await stripe.prices.create({
      product: athleteProductId,
      unit_amount: 11900, // $119 in cents
      currency: 'usd',
      recurring: {
        interval: 'year',
        trial_period_days: 30 // 30-day free trial
      },
      nickname: 'price_athlete_annual_trial_119',
      metadata: {
        type: 'athlete_annual_trial',
        amount_display: '$119/year after 30-day free trial',
        discount: '8% off monthly rate',
        trial_days: '30'
      }
    });

    console.log('✅ Created Athlete Annual Trial Price:', athleteAnnualTrialPrice.id);

    // Create Coach Monthly Price with Trial ($24.99/month after 30-day free trial)
    const coachMonthlyTrialPrice = await stripe.prices.create({
      product: coachProductId,
      unit_amount: 2499, // $24.99 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
        trial_period_days: 30 // 30-day free trial
      },
      nickname: 'price_coach_monthly_trial_24_99',
      metadata: {
        type: 'coach_monthly_trial',
        amount_display: '$24.99/month after 30-day free trial',
        trial_days: '30'
      }
    });

    console.log('✅ Created Coach Monthly Trial Price:', coachMonthlyTrialPrice.id);

    // Create Coach Annual Price with Trial ($249/year after 30-day free trial)
    const coachAnnualTrialPrice = await stripe.prices.create({
      product: coachProductId,
      unit_amount: 24900, // $249 in cents
      currency: 'usd',
      recurring: {
        interval: 'year',
        trial_period_days: 30 // 30-day free trial
      },
      nickname: 'price_coach_annual_trial_249',
      metadata: {
        type: 'coach_annual_trial',
        amount_display: '$249/year after 30-day free trial',
        discount: '16% off monthly rate',
        trial_days: '30'
      }
    });

    console.log('✅ Created Coach Annual Trial Price:', coachAnnualTrialPrice.id);

    // Summary
    console.log('\n🎉 All trial prices created successfully!\n');
    console.log('📋 Trial Price IDs to add to your environment variables:');
    console.log(`STRIPE_PRICE_ATHLETE_MONTHLY_TRIAL=${athleteMonthlyTrialPrice.id}`);
    console.log(`STRIPE_PRICE_ATHLETE_ANNUAL_TRIAL=${athleteAnnualTrialPrice.id}`);
    console.log(`STRIPE_PRICE_COACH_MONTHLY_TRIAL=${coachMonthlyTrialPrice.id}`);
    console.log(`STRIPE_PRICE_COACH_ANNUAL_TRIAL=${coachAnnualTrialPrice.id}`);

    console.log('\n💰 Trial Pricing Summary:');
    console.log('Athletes: 30-day free trial, then $12.99/month or $119/year');
    console.log('Coaches: 30-day free trial, then $24.99/month or $249/year');

    console.log('\n📝 Next Steps:');
    console.log('1. Add the trial price IDs to your .env.local file');
    console.log('2. Update your subscribe page to use trial prices');
    console.log('3. Update stripeConstants.ts with trial price constants');

  } catch (error) {
    console.error('❌ Error creating trial prices:', error.message);
    process.exit(1);
  }
}

// Run the function
createTrialPrices();

