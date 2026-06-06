/**
 * Utility functions for managing Stripe API keys
 */

/**
 * Returns true if the application is running on localhost
 */
export const isLocalhost = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1';
};

/**
 * Stripe publishable keys (Pulse Intelligence Labs, Inc. — acct_1Sd8YLIkArZc741W).
 * Publishable keys are PUBLIC and safe to hardcode. Hardcoded so checkout works
 * even without env config; the NEXT_PUBLIC_* env vars still override if present.
 */
export const STRIPE_PUBLISHABLE_KEY_LIVE =
  'pk_live_51Sd8YLIkArZc741WXCIF0xMlq4OUccnkkSsoJ3MqY9Wiu0xsAqRZeHdxijRnOa050a2k8WwqtVi6EsyhPZ6lfS5w00l9L49dzX';
export const STRIPE_PUBLISHABLE_KEY_TEST =
  'pk_test_51Sd8YLIkArZc741WNSWroMed1dRRfjfA2bQBniDTFsiEiVKtbxGU5IhpR5u2HimyiR9OHqgvxgHFFrMjqxFl7YUC00WpY2G0dn';

/**
 * Returns the appropriate Stripe publishable key based on environment
 * - Returns test key when running on localhost
 * - Returns live key when running in production
 */
export const getStripePublishableKey = (): string => {
  // Pure hardcode (publishable keys are public) so a stale Netlify env var can't override the PIL key.
  return isLocalhost() ? STRIPE_PUBLISHABLE_KEY_TEST : STRIPE_PUBLISHABLE_KEY_LIVE;
};

/**
 * For serverless functions: determines if request is from localhost
 * @param headers Request headers object containing referer or origin
 */
export const isLocalhostRequest = (headers: Record<string, string>): boolean => {
  const referer = headers.referer || headers.origin || '';
  return referer.includes('localhost') || referer.includes('127.0.0.1');
}; 