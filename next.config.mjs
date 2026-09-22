/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
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
    serverComponentsExternalPackages: [
      'genkit',
      '@genkit-ai/googleai',
      '@genkit-ai/next',
      'handlebars',
      'firebase-admin',
      '@google-cloud/firestore',
      '@grpc/grpc-js',
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@opentelemetry/exporter-jaeger': false,
    };
    return config;
  },
};

export default nextConfig;
