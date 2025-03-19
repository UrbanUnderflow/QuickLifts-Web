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