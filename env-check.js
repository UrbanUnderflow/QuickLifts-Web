// env-check.js
// Run this script with: node env-check.js

// Load env variables from .env.local
require('dotenv').config({ path: '.env.local' });

console.log('========= Environment Variables Check =========');
console.log('This script checks if your env variables are correctly loaded');
console.log('\nPRODUCTION VARIABLES:');
console.log('NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✓ Set' : '✗ Not set');
console.log('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✓ Set' : '✗ Not set');
console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✓ Set' : '✗ Not set');
console.log('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '✓ Set' : '✗ Not set');
console.log('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:', process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? '✓ Set' : '✗ Not set');
console.log('NEXT_PUBLIC_FIREBASE_APP_ID:', process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✓ Set' : '✗ Not set');

console.log('\nDEVELOPMENT VARIABLES:');
console.log('NEXT_PUBLIC_DEV_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY ? '✓ Set' : '✗ Not set');
console.log('NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN:', process.env.NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN ? '✓ Set' : '✗ Not set');
console.log('NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID ? '✓ Set' : '✗ Not set');
console.log('NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET:', process.env.NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET ? '✓ Set' : '✗ Not set');
console.log('NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID:', process.env.NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID ? '✓ Set' : '✗ Not set');
console.log('NEXT_PUBLIC_DEV_FIREBASE_APP_ID:', process.env.NEXT_PUBLIC_DEV_FIREBASE_APP_ID ? '✓ Set' : '✗ Not set');

console.log('\nSTRIPE VARIABLES:');
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✓ Set' : '✗ Not set');
console.log('STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET ? '✓ Set' : '✗ Not set');
console.log('STRIPE_WEBHOOK_SECRET_COACH:', process.env.STRIPE_WEBHOOK_SECRET_COACH ? '✓ Set' : '✗ Not set');
console.log('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? '✓ Set' : '✗ Not set');
console.log('NEXT_PUBLIC_TEST_STRIPE_PUBLISHABLE_KEY:', process.env.NEXT_PUBLIC_TEST_STRIPE_PUBLISHABLE_KEY ? '✓ Set' : '✗ Not set');

console.log('\nSTRIPE PRODUCT/PRICE IDs:');
console.log('STRIPE_PRICE_ATHLETE_MONTHLY:', process.env.STRIPE_PRICE_ATHLETE_MONTHLY ? '✓ Set' : '✗ Not set');
console.log('STRIPE_PRICE_ATHLETE_ANNUAL:', process.env.STRIPE_PRICE_ATHLETE_ANNUAL ? '✓ Set' : '✗ Not set');
console.log('STRIPE_PRICE_COACH_MONTHLY:', process.env.STRIPE_PRICE_COACH_MONTHLY ? '✓ Set' : '✗ Not set');
console.log('STRIPE_PRICE_COACH_ANNUAL:', process.env.STRIPE_PRICE_COACH_ANNUAL ? '✓ Set' : '✗ Not set');
console.log('STRIPE_PRODUCT_ATHLETE:', process.env.STRIPE_PRODUCT_ATHLETE ? '✓ Set' : '✗ Not set');
console.log('STRIPE_PRODUCT_COACH:', process.env.STRIPE_PRODUCT_COACH ? '✓ Set' : '✗ Not set');

console.log('\nSITE CONFIGURATION:');
console.log('SITE_URL:', process.env.SITE_URL ? '✓ Set' : '✗ Not set');

console.log('\nRunning in NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('============================================');

// Optional: Add this section if you want to see a sample of what's in each variable (first 5 chars)
console.log('\nPARTIAL VALUES (first 5 chars):');
if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.log('PROD API Key starts with:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 5) + '...');
}
if (process.env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY) {
  console.log('DEV API Key starts with:', process.env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY.substring(0, 5) + '...');
} 