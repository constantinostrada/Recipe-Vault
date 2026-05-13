import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Enable React strict mode for highlighting potential problems.
   * Recommended for development — keeps component lifecycle clean.
   */
  reactStrictMode: true,

  /**
   * Opt into the App Router experimental features where needed.
   * Uncomment items as the project grows.
   */
  // experimental: {
  //   serverActions: { allowedOrigins: ['localhost:3000'] },
  // },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
