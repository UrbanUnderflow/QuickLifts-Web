#!/usr/bin/env node

/**
 * Script to create Stripe products and prices for the Coach Partnership system
 * 
 * Run with: node scripts/create-stripe-products.js
 * 
 * This script creates:
 * - Athlete Monthly: $12.99/month 
 * - Athlete Annual: $119/year (8% discount)
 * - Coach Monthly: $24.99/month
 * - Coach Annual: $249/year (16% discount)
 */

require('dotenv').config({ path: '.env.local' });

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createStripeProducts() {
  console.log('🚀 Creating Stripe products and prices for Coach Partnership...\n');

  try {
    // Create Athlete Product
    const athleteProduct = await stripe.products.create({
      name: 'Pulse Athlete Subscription',
      description: 'Access to Pulse + PulseCheck for athletes. Includes workout tracking, mental performance insights, and all core features.',
      metadata: {
        type: 'athlete',
        features: 'pulse,pulsecheck,analytics,tracking'
      }
    });

    console.log('✅ Created Athlete Product:', athleteProduct.id);

    // Create Coach Product  
    const coachProduct = await stripe.products.create({
      name: 'Pulse Coach Subscription',
      description: 'Coach subscription with dashboard, athlete management, revenue sharing, and coaching tools.',
      metadata: {
        type: 'coach',
        features: 'dashboard,athlete_management,revenue_share,coaching_tools'
      }
    });

    console.log('✅ Created Coach Product:', coachProduct.id);

    // Create Athlete Monthly Price ($12.99/month)
    const athleteMonthlyPrice = await stripe.prices.create({
      product: athleteProduct.id,
      unit_amount: 1299, // $12.99 in cents
      currency: 'usd',
      recurring: {
        interval: 'month'
      },
      nickname: 'price_athlete_monthly_12_99',
      metadata: {
        type: 'athlete_monthly',
        amount_display: '$12.99/month'
      }
    });

    console.log('✅ Created Athlete Monthly Price:', athleteMonthlyPrice.id);

    // Create Athlete Annual Price ($119/year - 8% discount)
    const athleteAnnualPrice = await stripe.prices.create({
      product: athleteProduct.id,
      unit_amount: 11900, // $119 in cents
      currency: 'usd',
      recurring: {
        interval: 'year'
      },
      nickname: 'price_athlete_annual_119',
      metadata: {
        type: 'athlete_annual',
        amount_display: '$119/year',
        discount: '8% off monthly rate'
      }
    });

    console.log('✅ Created Athlete Annual Price:', athleteAnnualPrice.id);

    // Create Coach Monthly Price ($24.99/month)
    const coachMonthlyPrice = await stripe.prices.create({
      product: coachProduct.id,
      unit_amount: 2499, // $24.99 in cents
      currency: 'usd',
      recurring: {
        interval: 'month'
      },
      nickname: 'price_coach_monthly_24_99',
      metadata: {
        type: 'coach_monthly',
        amount_display: '$24.99/month'
      }
    });

    console.log('✅ Created Coach Monthly Price:', coachMonthlyPrice.id);

    // Create Coach Annual Price ($249/year - 16% discount)
    const coachAnnualPrice = await stripe.prices.create({
      product: coachProduct.id,
      unit_amount: 24900, // $249 in cents
      currency: 'usd',
      recurring: {
        interval: 'year'
      },
      nickname: 'price_coach_annual_249',
      metadata: {
        type: 'coach_annual',
        amount_display: '$249/year',
        discount: '16% off monthly rate'
      }
    });

    console.log('✅ Created Coach Annual Price:', coachAnnualPrice.id);

    // Summary
    console.log('\n🎉 All Stripe products and prices created successfully!\n');
    console.log('📋 Price IDs to add to your environment variables:');
    console.log(`STRIPE_PRICE_ATHLETE_MONTHLY=${athleteMonthlyPrice.id}`);
    console.log(`STRIPE_PRICE_ATHLETE_ANNUAL=${athleteAnnualPrice.id}`);
    console.log(`STRIPE_PRICE_COACH_MONTHLY=${coachMonthlyPrice.id}`);
    console.log(`STRIPE_PRICE_COACH_ANNUAL=${coachAnnualPrice.id}`);

    console.log('\n📋 Product IDs:');
    console.log(`STRIPE_PRODUCT_ATHLETE=${athleteProduct.id}`);
    console.log(`STRIPE_PRODUCT_COACH=${coachProduct.id}`);

    console.log('\n💰 Pricing Summary:');
    console.log('Athletes: $12.99/month or $119/year (8% discount)');
    console.log('Coaches: $24.99/month or $249/year (16% discount)');

  } catch (error) {
    console.error('❌ Error creating Stripe products:', error.message);
    if (error.type === 'StripeAuthenticationError') {
      console.error('💡 Make sure STRIPE_SECRET_KEY is set in your .env.local file');
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  createStripeProducts();
}

module.exports = { createStripeProducts };

