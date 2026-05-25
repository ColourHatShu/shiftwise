/** @type {import('next').NextConfig} */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const nextConfig = {
  // Proxy all /api/* requests to the Express backend so frontend code can use
  // relative URLs consistently (fixes endpoint-mismatch bugs surfaced by the
  // integration audit).
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
