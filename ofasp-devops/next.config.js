/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizeCss: false,
  },
  // Prevent automatic timeout and keep server alive
  keepAlive: true,
  httpAgentOptions: {
    keepAlive: true,
  },
  env: {
    APP_ENV: process.env.NODE_ENV,
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:8000',
    PYTHON_SERVICE_URL: process.env.PYTHON_SERVICE_URL || 'http://localhost:3001',
    COBOL_SERVICE_URL: process.env.COBOL_SERVICE_URL || 'http://localhost:3002',
    DATASET_SERVICE_URL: process.env.DATASET_SERVICE_URL || 'http://localhost:3003',
  },
  async rewrites() {
    return [
      {
        source: '/api/python/:path*',
        destination: `${process.env.PYTHON_SERVICE_URL || 'http://localhost:3001'}/api/:path*`,
      },
      {
        source: '/api/cobol/:path*',
        destination: `${process.env.COBOL_SERVICE_URL || 'http://localhost:3002'}/api/:path*`,
      },
      {
        source: '/api/dataset/:path*',
        destination: `${process.env.DATASET_SERVICE_URL || 'http://localhost:3003'}/api/:path*`,
      },
    ];
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Connection',
          value: 'keep-alive',
        },
      ],
    },
  ],
  // Disable automatic static optimization to prevent timeouts
  staticPageGenerationTimeout: 0,
  // Increase server timeout
  serverRuntimeConfig: {
    timeout: 0,
  },
};

module.exports = nextConfig;