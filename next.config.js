/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['fitwithpulse.ai'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  // Add trailing slashes to match Netlify's default behavior
  trailingSlash: false,
  // Ensure pages are generated statically when possible
  generateEtags: false,
};

module.exports = nextConfig;