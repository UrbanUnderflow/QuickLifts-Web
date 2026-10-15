/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    outputFileTracingIncludes: {
      '/developer/api/*': ['./docs/developer/**/*'],
      '/developer/api/*/artifacts/*': ['./docs/developer/**/*'],
      '/api/admin/system-overview/snapshot-artifacts': ['./docs/integrations/auntedna-snapshot/**/*'],
      '/api/admin/system-overview/share-links': ['./docs/integrations/auntedna-snapshot/**/*'],
    },
  },
  // Enable gzip compression for responses
  compress: true,
  // Enable SWC minification for smaller bundles
  swcMinify: true,
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/operations', destination: '/operations/index.html' },
        { source: '/university-sales-strategy', destination: '/university-sales-strategy/index.html' },
        { source: '/pilot-expansion', destination: '/pilot-expansion/index.html' },
        { source: '/RunOfShow', destination: '/RunOfShow/index.html' },
        { source: '/compress-pdf', destination: '/compress-pdf/index.html' },
        ...(process.env.NODE_ENV === 'development'
          ? [{ source: '/api/pipelists/runbook', destination: 'https://fitwithpulse.ai/api/pipelists/runbook' }]
          : []),
      ],
    };
  },
  images: {
    domains: ['fitwithpulse.ai', 'firebasestorage.googleapis.com'],
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
  // Add redirects for URL aliases
  async redirects() {
    return [
      {
        source: '/invest',
        destination: '/investor',
        permanent: true, // 301 redirect for SEO
      },
    ];
  },
};

module.exports = nextConfig;
