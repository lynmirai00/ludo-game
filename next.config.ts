import type { NextConfig } from 'next';
import { STATIC_SECURITY_HEADERS } from './lib/security';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Do not let `next dev` append its own agent rules to CLAUDE.md; the project keeps its own.
  agentRules: false,
  // The Content-Security-Policy is set per request in proxy.ts (it needs a fresh nonce).
  async headers() {
    return [{ source: '/:path*', headers: STATIC_SECURITY_HEADERS }];
  },
};

export default nextConfig;
