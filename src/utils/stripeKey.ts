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
 * Returns the appropriate Stripe publishable key based on environment
 * - Returns test key when running on localhost
 * - Returns live key when running in production
 */
export const getStripePublishableKey = (): string => {
  if (isLocalhost()) {
    return process.env.NEXT_PUBLIC_TEST_STRIPE_PUBLISHABLE_KEY || '';
  }
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
};

/**
 * For serverless functions: determines if request is from localhost
 * @param headers Request headers object containing referer or origin
 */
export const isLocalhostRequest = (headers: Record<string, string>): boolean => {
  const referer = headers.referer || headers.origin || '';
  return referer.includes('localhost') || referer.includes('127.0.0.1');
}; 