// Security headers (docs/03-plan.md, Phase 6 security checklist). Pure, so they can be tested.

/**
 * Content-Security-Policy for the pages. Scripts need this request's nonce ('strict-dynamic' lets
 * Next.js's own scripts load their chunks); inline <style> elements need it too. Inline style
 * *attributes* are allowed separately: React sets the board positions with them, and they cannot
 * run code. The browser may only talk to this origin and to ZITADEL (oidc-client-ts).
 */
export function contentSecurityPolicy({ nonce, zitadelUrl, dev }: { nonce: string; zitadelUrl: string; dev: boolean }): string {
  const zitadel = new URL(zitadelUrl).origin;
  const directives = [
    "default-src 'self'",
    // React needs eval only in development, for its debugging tools.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${zitadel}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // Only when ZITADEL itself is https: locally it is http://localhost:8080, which this would break.
  if (zitadel.startsWith('https:')) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/** Headers for every response, pages and API alike. */
export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Older browsers that ignore CSP frame-ancestors.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];
