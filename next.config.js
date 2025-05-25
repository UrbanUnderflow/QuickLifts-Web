/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
  reactStrictMode: true,
  images: {
    domains: ['fitwithpulse.ai'],
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  env: {
    // Production Firebase Config
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,

    // Development Firebase Config
    NEXT_PUBLIC_DEV_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY,
    NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_DEV_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_DEV_FIREBASE_APP_ID,

    // Other existing env vars
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  // Add trailing slashes to match Netlify's default behavior
  trailingSlash: false,
  // Ensure pages are generated statically when possible
  generateEtags: false,
  // Add headers for better caching and security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;