/**
 * Stripe Constants for Coach Partnership System
 * 
 * These constants reference environment variables for Stripe price/product IDs.
 * To set up these IDs, run: npm run stripe:create-products
 */

// Stripe Price IDs from environment variables
export const STRIPE_PRICES = {
  // Athlete Subscriptions
  ATHLETE_MONTHLY: process.env.STRIPE_PRICE_ATHLETE_MONTHLY || process.env.NEXT_PUBLIC_STRIPE_PRICE_ATHLETE_MONTHLY || '',
  ATHLETE_ANNUAL: process.env.STRIPE_PRICE_ATHLETE_ANNUAL || process.env.NEXT_PUBLIC_STRIPE_PRICE_ATHLETE_ANNUAL || '',
  
  // Coach Subscriptions  
  COACH_MONTHLY: process.env.STRIPE_PRICE_COACH_MONTHLY || process.env.NEXT_PUBLIC_STRIPE_PRICE_COACH_MONTHLY || '',
  COACH_ANNUAL: process.env.STRIPE_PRICE_COACH_ANNUAL || process.env.NEXT_PUBLIC_STRIPE_PRICE_COACH_ANNUAL || ''
} as const;

// Stripe Product IDs from environment variables
export const STRIPE_PRODUCTS = {
  ATHLETE: process.env.STRIPE_PRODUCT_ATHLETE || process.env.NEXT_PUBLIC_STRIPE_PRODUCT_ATHLETE || '',
  COACH: process.env.STRIPE_PRODUCT_COACH || process.env.NEXT_PUBLIC_STRIPE_PRODUCT_COACH || ''
} as const;

// Price information for display (matches the created Stripe products)
export const PRICING_INFO = {
  ATHLETE: {
    MONTHLY: {
      amount: 1299, // $12.99 in cents
      display: '$12.99',
      interval: 'month' as const
    },
    ANNUAL: {
      amount: 11900, // $119 in cents
      display: '$119',
      interval: 'year' as const,
      discount: '8%'
    }
  },
  COACH: {
    MONTHLY: {
      amount: 2499, // $24.99 in cents
      display: '$24.99',
      interval: 'month' as const
    },
    ANNUAL: {
      amount: 24900, // $249 in cents  
      display: '$249',
      interval: 'year' as const,
      discount: '16%'
    }
  }
} as const;

// Helper function to get price ID by type
export const getPriceId = (userType: 'athlete' | 'coach', interval: 'monthly' | 'annual'): string => {
  if (userType === 'athlete') {
    return interval === 'monthly' ? STRIPE_PRICES.ATHLETE_MONTHLY : STRIPE_PRICES.ATHLETE_ANNUAL;
  } else {
    return interval === 'monthly' ? STRIPE_PRICES.COACH_MONTHLY : STRIPE_PRICES.COACH_ANNUAL;
  }
};

// Helper function to get product ID by type
export const getProductId = (userType: 'athlete' | 'coach'): string => {
  return userType === 'athlete' ? STRIPE_PRODUCTS.ATHLETE : STRIPE_PRODUCTS.COACH;
};

// Helper function to get pricing info
export const getPricingInfo = (userType: 'athlete' | 'coach', interval: 'monthly' | 'annual') => {
  const pricing = userType === 'athlete' ? PRICING_INFO.ATHLETE : PRICING_INFO.COACH;
  return interval === 'monthly' ? pricing.MONTHLY : pricing.ANNUAL;
};

