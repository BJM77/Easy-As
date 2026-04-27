/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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
      'handlebars',
      'firebase-admin',
      '@google-cloud/firestore',
      '@grpc/grpc-js',
    ],
  },
};

export default nextConfig;
