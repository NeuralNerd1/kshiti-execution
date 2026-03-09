import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/execution/:path*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:8081'}/api/execution/:path*`, // Proxy to Go Backend
      },
    ]
  },
};

export default nextConfig;
