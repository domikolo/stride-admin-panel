import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Disable static page generation during build
  // This prevents Cognito initialization errors when env vars aren't available at build time
  experimental: {
    // Force all pages to be dynamically rendered
  },
};

export default nextConfig;
