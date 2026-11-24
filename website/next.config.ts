import type { NextConfig } from 'next';

// Pure static site: `next build` writes plain HTML/CSS/JS to ./out (no Node server needed).
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
