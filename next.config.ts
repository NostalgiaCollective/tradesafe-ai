import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep configured staging artifacts separate from unconfigured smoke-test builds.
  distDir: process.env.TRADESAFE_STAGING_ARTIFACT === '1' ? '.next-staging' : '.next',
};

export default nextConfig;
