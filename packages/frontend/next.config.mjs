const backendUrl =
  process.env.BACKEND_URL || process.env.API_URL || 'http://127.0.0.1:3001';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl.replace(/\/$/, '')}/:path*`,
      },
    ];
  },
};

export default nextConfig;
