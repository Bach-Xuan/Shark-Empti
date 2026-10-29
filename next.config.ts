import type {NextConfig} from 'next';
import { verificationBuildId } from './scripts/lib/demo-build.mjs';

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  allowedDevOrigins: ['127.0.0.1'],
  generateBuildId: () => Promise.resolve(verificationBuildId(process.cwd())),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
