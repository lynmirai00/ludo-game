// Login and logout with ZITADEL via oidc-client-ts (Authorization Code + PKCE). Browser only.
// oidc-client-ts stores the session itself (sessionStorage); never store tokens by hand.
import { UserManager, type User } from 'oidc-client-ts';
import type { ApiErrorBody } from './api';
import type { Language } from './i18n';

export type PublicConfig = { zitadelUrl: string; clientId: string | null };

/** Thrown for API errors; `code` is a stable code the UI translates with errorKey(). */
export class ApiCallError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export async function fetchPublicConfig(): Promise<PublicConfig> {
  const response = await fetch('/api/config');
  if (!response.ok) throw new ApiCallError('NETWORK');
  return response.json();
}

export function createUserManager({ zitadelUrl, clientId }: PublicConfig): UserManager {
  return new UserManager({
    authority: zitadelUrl,
    client_id: clientId ?? '',
    redirect_uri: `${location.origin}/`,
    post_logout_redirect_uri: `${location.origin}/`,
    response_type: 'code',
    // No email scope: the game never needs the player's email.
    scope: 'openid profile',
    // No silent renew: when the token expires the player simply logs in again.
    automaticSilentRenew: false,
  });
}

/** True when ZITADEL answers within a few seconds; otherwise the game runs as guest only. */
export async function isReachable(zitadelUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${zitadelUrl}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(4000) });
    return response.ok;
  } catch {
    return false;
  }
}

/** Finishes a login if ZITADEL just redirected back with ?code=…, then cleans the URL. */
export async function completeLoginRedirect(userManager: UserManager): Promise<void> {
  const params = new URLSearchParams(location.search);
  if (!params.has('code') && !params.has('error')) return;
  try {
    if (params.has('code')) await userManager.signinRedirectCallback();
  } finally {
    history.replaceState(null, '', location.pathname);
  }
}

/** The stored session, or null when logged out or expired. */
export async function currentUser(userManager: UserManager): Promise<User | null> {
  const user = await userManager.getUser();
  if (!user || user.expired) {
    if (user) await userManager.removeUser();
    return null;
  }
  return user;
}

export function login(userManager: UserManager, lang: Language): Promise<void> {
  // ZITADEL has no Vietnamese login page; 'vi en' makes it fall back to English (docs/04-i18n.md).
  return userManager.signinRedirect({ extraQueryParams: { ui_locales: lang === 'vi' ? 'vi en' : lang } });
}

export function logout(userManager: UserManager): Promise<void> {
  return userManager.signoutRedirect();
}

/**
 * Calls the game API. With a user, sends `Authorization: Bearer <access_token>`.
 * Throws ApiCallError with the server's error code (or NETWORK).
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}, user?: User | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (user) headers.set('authorization', `Bearer ${user.access_token}`);
  if (init.body !== undefined) headers.set('content-type', 'application/json');

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiCallError('NETWORK');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiCallError(body?.error?.code ?? 'UNKNOWN');
  }
  return response.json() as Promise<T>;
}
