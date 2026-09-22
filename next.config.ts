import type {NextConfig} from 'next';

/**
 * Next.js Configuration (v57.7.0)
 * Hardened for Next.js 16 (Turbopack) and Cloud Workstation environments.
 */
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // Authorized origins for Cloud Workstation development (Fixes CORS/HMR)
    allowedDevOrigins: [
        '6000-firebase-studio-1762260425529.cluster-y3k7ko3fang56qzieg3trwgyfg.cloudworkstations.dev',
        '9000-firebase-studio-1762260425529.cluster-y3k7ko3fang56qzieg3trwgyfg.cloudworkstations.dev',
        '9002-firebase-studio-1762260425529.cluster-y3k7ko3fang56qzieg3trwgyfg.cloudworkstations.dev'
    ],
  },
  // Genkit and Handlebars must be treated as external to avoid bundling issues during flight action loading
  serverExternalPackages: [
    'genkit',
    '@genkit-ai/googleai',
    '@genkit-ai/next',
    'handlebars', 
    'firebase-admin', 
    '@google-cloud/firestore', 
    '@grpc/grpc-js'
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@opentelemetry/exporter-jaeger': false,
    };
    return config;
  },
};

export default nextConfig;
