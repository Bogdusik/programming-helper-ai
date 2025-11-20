import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Note: swcMinify is enabled by default in Next.js 15+ and no longer needs to be specified
  
  // Compress responses in production
  compress: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    // Disable image optimization in development for faster builds
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // Optimize webpack cache to reduce warning about big strings
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Optimize cache for client-side builds
      config.cache = {
        ...config.cache,
        compression: 'gzip',
      }
    }
    return config
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ],
      },
    ]
  },
};

export default nextConfig;
