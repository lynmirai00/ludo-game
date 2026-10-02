import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Do not let `next dev` append its own agent rules to CLAUDE.md; the project keeps its own.
  agentRules: false,
};

export default nextConfig;
