import { describe, expect, test } from 'vitest';
import { STATIC_SECURITY_HEADERS, contentSecurityPolicy } from '@/lib/security';

function directives(csp: string): Record<string, string> {
  return Object.fromEntries(
    csp.split(';').map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name!, values.join(' ')];
    }),
  );
}

describe('Content-Security-Policy', () => {
  const prod = directives(contentSecurityPolicy({ nonce: 'abc123', zitadelUrl: 'https://ludo.zitadel.cloud', dev: false }));
  const local = directives(contentSecurityPolicy({ nonce: 'abc123', zitadelUrl: 'http://localhost:8080/', dev: true }));

  test('scripts only with this request\'s nonce; no inline scripts and no eval in production', () => {
    expect(prod['script-src']).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(prod['script-src']).not.toContain('unsafe-inline');
    expect(local['script-src']).toContain("'unsafe-eval'"); // React dev tools only
  });

  test('styles need the nonce; only style attributes may be inline', () => {
    expect(prod['style-src']).toBe("'self' 'nonce-abc123'");
    expect(prod['style-src-attr']).toBe("'unsafe-inline'");
  });

  test('the page may only connect to itself and to ZITADEL (as an origin, without a path)', () => {
    expect(prod['connect-src']).toBe("'self' https://ludo.zitadel.cloud");
    expect(local['connect-src']).toBe("'self' http://localhost:8080");
  });

  test('no plugins, no framing, no foreign base or form targets', () => {
    expect(prod['object-src']).toBe("'none'");
    expect(prod['frame-ancestors']).toBe("'none'");
    expect(prod['base-uri']).toBe("'self'");
    expect(prod['form-action']).toBe("'self'");
  });

  test('upgrade-insecure-requests only when ZITADEL is https (it would break http://localhost)', () => {
    expect('upgrade-insecure-requests' in prod).toBe(true);
    expect('upgrade-insecure-requests' in local).toBe(false);
  });
});

test('static security headers', () => {
  const headers = Object.fromEntries(STATIC_SECURITY_HEADERS.map(({ key, value }) => [key, value]));
  expect(headers).toMatchObject({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
  });
  expect(headers['Permissions-Policy']).toContain('camera=()');
});
