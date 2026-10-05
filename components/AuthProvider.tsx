'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User, UserManager } from 'oidc-client-ts';
import type { GameRecord, GameResult, Me } from '@/lib/api';
import {
  ApiCallError,
  apiFetch,
  completeLoginRedirect,
  createUserManager,
  currentUser,
  fetchPublicConfig,
  isReachable,
  login,
  logout,
} from '@/lib/auth-client';
import { useI18n } from '@/lib/i18n/I18nProvider';

/** loading: checking the session; unreachable: ZITADEL is down, the game is guest-only. */
export type AuthStatus = 'loading' | 'guest' | 'user' | 'unreachable';

type Auth = {
  status: AuthStatus;
  me: Me | null;
  /** Error code of a failed login (e.g. the server rejected the token), shown once in the top bar. */
  error: string | null;
  login(): void;
  logout(): void;
  /** Saves the human's result when logged in. Throws ApiCallError on failure. */
  saveResult(result: GameResult): Promise<void>;
  /** The logged-in player's recent results. Throws ApiCallError on failure. */
  loadMyGames(): Promise<GameRecord[]>;
  /** Changes whenever a result is saved, so the leaderboard knows to reload. */
  resultsVersion: number;
};

const AuthContext = createContext<Auth | null>(null);

type Session =
  | { status: 'guest' | 'unreachable'; error?: string }
  | { status: 'user'; userManager: UserManager; user: User; me: Me };
type Started = { userManager: UserManager | null; session: Session };

// Runs once per page load, even when React mounts the provider twice in development:
// a login redirect code can only be exchanged once.
let started: Promise<Started> | null = null;

async function start(): Promise<Started> {
  const config = await fetchPublicConfig();
  if (!config.clientId || !(await isReachable(config.zitadelUrl))) {
    return { userManager: null, session: { status: 'unreachable' } };
  }
  const userManager = createUserManager(config);
  await completeLoginRedirect(userManager);
  const user = await currentUser(userManager);
  if (!user) return { userManager, session: { status: 'guest' } };
  try {
    const me = await apiFetch<Me>('/api/me', {}, user);
    return { userManager, session: { status: 'user', userManager, user, me } };
  } catch (error) {
    // An expired or rejected token means "logged out", not a broken page.
    if (error instanceof ApiCallError && error.code === 'UNAUTHORIZED') await userManager.removeUser();
    return { userManager, session: { status: 'guest', error: error instanceof ApiCallError ? error.code : 'UNKNOWN' } };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { lang, setLanguage } = useI18n();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultsVersion, setResultsVersion] = useState(0);
  const userManager = useRef<UserManager | null>(null);
  const user = useRef<User | null>(null);

  const becomeGuest = useCallback(async () => {
    user.current = null;
    setMe(null);
    setStatus('guest');
    await userManager.current?.removeUser();
  }, []);

  useEffect(() => {
    let active = true;
    (started ??= start())
      .then(({ userManager: manager, session }) => {
        if (!active) return;
        userManager.current = manager;
        if (session.status !== 'user') {
          setError(session.error ?? null);
          return setStatus(session.status);
        }
        user.current = session.user;
        setMe(session.me);
        setStatus('user');
        // The saved language wins over this device's choice (docs/04-i18n.md).
        if (session.me.locale) setLanguage(session.me.locale);
      })
      .catch(() => active && setStatus('unreachable'));
    return () => {
      active = false;
    };
  }, [setLanguage]);

  // Keep the profile's language in sync with the switcher while logged in.
  useEffect(() => {
    if (status !== 'user' || !me || me.locale === lang) return;
    setMe({ ...me, locale: lang });
    apiFetch('/api/me/locale', { method: 'PUT', body: JSON.stringify({ locale: lang }) }, user.current).catch((error) => {
      if (error instanceof ApiCallError && error.code === 'UNAUTHORIZED') void becomeGuest();
    });
  }, [lang, me, status, becomeGuest]);

  const saveResult = useCallback(
    async (result: GameResult) => {
      try {
        await apiFetch('/api/games', { method: 'POST', body: JSON.stringify(result) }, user.current);
        setMe(await apiFetch<Me>('/api/me', {}, user.current));
        setResultsVersion((v) => v + 1);
      } catch (error) {
        if (error instanceof ApiCallError && error.code === 'UNAUTHORIZED') await becomeGuest();
        throw error;
      }
    },
    [becomeGuest],
  );

  const loadMyGames = useCallback(async () => {
    try {
      return await apiFetch<GameRecord[]>('/api/me/games', {}, user.current);
    } catch (error) {
      if (error instanceof ApiCallError && error.code === 'UNAUTHORIZED') await becomeGuest();
      throw error;
    }
  }, [becomeGuest]);

  const value = useMemo<Auth>(
    () => ({
      status,
      me,
      error,
      resultsVersion,
      saveResult,
      loadMyGames,
      login: () => {
        if (userManager.current) void login(userManager.current, lang);
      },
      logout: () => {
        if (userManager.current) void logout(userManager.current);
      },
    }),
    [status, me, error, resultsVersion, saveResult, loadMyGames, lang],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth() must be used inside <AuthProvider>');
  return context;
}
