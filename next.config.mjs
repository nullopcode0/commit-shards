/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Needed for @solana/wallet-adapter and @irys/sdk
    config.externals.push('pino-pretty', 'encoding', 'bufferutil', 'utf-8-validate');
    return config;
  },
};

export default nextConfig;
