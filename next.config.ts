import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfkit', 'sharp'],
  outputFileTracingIncludes: { '/api/reports/*/exports': ['./assets/fonts/NotoSans-Regular.ttf'] },
  // Keep configured staging artifacts separate from unconfigured smoke-test builds.
  distDir: process.env.HOSTED_STAGING === '1' ? '.next-hosted' : process.env.TRADESAFE_STAGING_ARTIFACT === '1' ? '.next-staging' : '.next',
  // Invitation/callback query strings and browser Auth errors must not enter staging terminal logs.
  logging: process.env.HOSTED_STAGING === '1' || process.env.TRADESAFE_STAGING_ARTIFACT === '1' ? false : undefined,
  async headers() {
    return [{ source: '/auth/recovery', headers: [
      { key: 'Cache-Control', value: 'private, no-store' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ] }];
  },
};

export default nextConfig;
