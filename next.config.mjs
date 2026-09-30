/** @type {import('next').NextConfig} */
const nextConfig = {
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
  serverExternalPackages: [
    'genkit',
    '@genkit-ai/googleai',
    '@genkit-ai/next',
    'handlebars',
    'firebase-admin',
    '@google-cloud/firestore',
    '@grpc/grpc-js',
  ],
  turbopack: {},
  allowedDevOrigins: [
    '6000-firebase-studio-1762260425529.cluster-y3k7ko3fang56qzieg3trwgyfg.cloudworkstations.dev',
    '9000-firebase-studio-1762260425529.cluster-y3k7ko3fang56qzieg3trwgyfg.cloudworkstations.dev',
    '9002-firebase-studio-1762260425529.cluster-y3k7ko3fang56qzieg3trwgyfg.cloudworkstations.dev',
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
