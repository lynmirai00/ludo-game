import 'server-only';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { ProfileClaims } from '@/lib/display-name';
import { ApiError } from './errors';

export type AuthUser = {
  /** The token's `sub`: the only source of the player's identity. */
  id: string;
  /** Project roles from ZITADEL (phase 5). */
  roles: string[];
  /** The verified access token, e.g. to call ZITADEL's userinfo endpoint. */
  token: string;
};

export type Auth = {
  /** The verified user, or throws ApiError 401 UNAUTHORIZED. */
  requireUser(request: Request): Promise<AuthUser>;
  /** The verified user, or null for guests (also when the token is invalid). */
  optionalUser(request: Request): Promise<AuthUser | null>;
};

const ROLES_CLAIM = 'urn:zitadel:iam:org:project:roles';

function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '');
  return match?.[1] ?? null;
}

/** `keySet` is injectable so tests can sign their own tokens instead of calling ZITADEL. */
export function createAuth({ issuer, audience, keySet }: { issuer: string; audience: string; keySet: JWTVerifyGetKey }): Auth {
  async function verify(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, keySet, { issuer, audience });
      if (!payload.sub) throw new Error('token has no sub');
      const roles = payload[ROLES_CLAIM];
      return {
        id: payload.sub,
        roles: roles && typeof roles === 'object' ? Object.keys(roles) : [],
        token,
      };
    } catch (error) {
      // Bad signature, wrong issuer or audience, expired, malformed: all the same to the client.
      // Log only the reason (e.g. which claim failed), never the token.
      const { code, claim } = (error ?? {}) as { code?: string; claim?: string };
      console.warn(`Rejected access token: ${code ?? 'invalid'}${claim ? ` (claim "${claim}")` : ''}`);
      throw new ApiError(401, 'UNAUTHORIZED');
    }
  }

  return {
    async requireUser(request) {
      const token = bearerToken(request);
      if (!token) throw new ApiError(401, 'UNAUTHORIZED');
      return verify(token);
    },
    async optionalUser(request) {
      const token = bearerToken(request);
      if (!token) return null;
      return verify(token).catch(() => null);
    },
  };
}

export function requireRole(user: AuthUser, role: string): void {
  if (!user.roles.includes(role)) throw new ApiError(403, 'FORBIDDEN');
}

export function zitadelKeySet(zitadelUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(`${zitadelUrl}/oauth/v2/keys`));
}

export type FetchProfile = (token: string) => Promise<ProfileClaims>;

/** Reads the player's profile from ZITADEL with their own access token (never from the request body). */
export function zitadelProfile(zitadelUrl: string): FetchProfile {
  return async (token) => {
    const response = await fetch(`${zitadelUrl}/oidc/v1/userinfo`, { headers: { authorization: `Bearer ${token}` } });
    if (response.status === 401) throw new ApiError(401, 'UNAUTHORIZED');
    if (!response.ok) throw new Error(`userinfo failed with HTTP ${response.status}`);
    return (await response.json()) as ProfileClaims;
  };
}
