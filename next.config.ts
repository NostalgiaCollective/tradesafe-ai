import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfkit', 'sharp'],
  outputFileTracingIncludes: { '/api/reports/*/exports': ['./assets/fonts/NotoSans-Regular.ttf'] },
  // Keep configured staging artifacts separate from unconfigured smoke-test builds.
  distDir: process.env.TRADESAFE_STAGING_ARTIFACT === '1' ? '.next-staging' : '.next',
  // Invitation/callback query strings and browser Auth errors must not enter staging terminal logs.
  logging: process.env.TRADESAFE_STAGING_ARTIFACT === '1' ? false : undefined,
};

export default nextConfig;
