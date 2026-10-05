'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { errorKey, type MessageKey } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { Account } from './Account';
import { useAuth } from './AuthProvider';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Leaderboard } from './Leaderboard';
import { MyGames } from './MyGames';
import { Rules } from './Rules';

type View = 'leaderboard' | 'history' | 'account' | 'rules';
const TITLES: Record<View, MessageKey> = {
  leaderboard: 'leaderboard.title',
  history: 'history.title',
  account: 'account.title',
  rules: 'rules.title',
};
/** What the browser history entry says is open: the menu, a page, or nothing (the game). */
type Shown = 'menu' | View | null;

const isView = (value: unknown): value is View =>
  value === 'leaderboard' || value === 'history' || value === 'account' || value === 'rules';

/**
 * The header (title, login or player name, menu button), the menu drawer and the pages it opens.
 * Pages cover the game instead of navigating away, so a game in progress is never lost; each
 * open menu or page is a browser history entry, so the phone's Back button closes it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { status, me, error, login, logout } = useAuth();
  const [shown, setShown] = useState<Shown>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const loggedIn = status === 'user' && me !== null;

  // Back / forward: follow whatever the history entry says.
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const value = (event.state as { ludo?: unknown } | null)?.ludo;
      setShown(value === 'menu' || isView(value) ? value : null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openMenu = () => {
    history.pushState({ ludo: 'menu' }, '');
    setShown('menu');
  };
  // From the menu, a page replaces the menu's history entry: Back then returns to the game.
  const openView = (view: View) => {
    history.replaceState({ ludo: view }, '');
    setShown(view);
  };
  const close = useCallback(() => {
    if ((history.state as { ludo?: unknown } | null)?.ludo) history.back();
    else setShown(null);
  }, []);

  // Escape closes; focus moves into what opened and back to the menu button afterwards.
  useEffect(() => {
    if (shown === null) {
      // Only after closing something, not on page load.
      if (wasOpen.current) menuButton.current?.focus({ preventScroll: true });
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    (shown === 'menu' ? closeButton : backButton).current?.focus();
    const onKey = (event: KeyboardEvent) => {
      // The replay dialog handles its own Escape.
      if (event.key === 'Escape' && !document.querySelector('.replay-backdrop')) close();
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [shown, close]);

  // Logging out (or a rejected session) closes pages that need an account.
  useEffect(() => {
    if (!loggedIn && (shown === 'history' || shown === 'account')) setShown(null);
  }, [loggedIn, shown]);

  const items: View[] = loggedIn ? ['leaderboard', 'history', 'account', 'rules'] : ['leaderboard', 'rules'];

  return (
    <>
      <header className="topbar">
        <h1 className="app-title">{t('app.title')}</h1>
        <div className="topbar-end">
          {loggedIn ? (
            <button type="button" className="btn btn--small topbar-user" onClick={() => openView('account')}>
              {me.name}
            </button>
          ) : status === 'guest' ? (
            <button type="button" className="btn btn--small btn--primary" onClick={login}>
              {t('auth.login')}
            </button>
          ) : null}
          <button
            ref={menuButton}
            type="button"
            className="icon-button"
            aria-label={t('menu.open')}
            aria-expanded={shown === 'menu'}
            aria-controls="app-menu"
            onClick={openMenu}
          >
            <span className="icon-bars" aria-hidden="true" />
          </button>
        </div>
      </header>
      {error && (
        <p className="auth-banner" role="status">
          {t(errorKey(error))}
        </p>
      )}

      {children}

      {shown === 'menu' && (
        <div className="drawer-backdrop" onClick={close}>
          <nav
            id="app-menu"
            className="drawer"
            aria-label={t('menu.title')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <h2 className="panel-title">{t('menu.title')}</h2>
              <button ref={closeButton} type="button" className="icon-button" aria-label={t('menu.close')} onClick={close}>
                <span className="icon-close" aria-hidden="true" />
              </button>
            </div>

            <div className="drawer-section">
              {loggedIn ? (
                <p className="drawer-user">{me.name}</p>
              ) : status === 'guest' ? (
                <>
                  <p className="hint">{t('auth.prompt')}</p>
                  <button type="button" className="btn btn--primary" onClick={login}>
                    {t('auth.login')}
                  </button>
                </>
              ) : status === 'unreachable' ? (
                <p className="hint">{t('auth.unreachable')}</p>
              ) : null}
            </div>

            <div className="drawer-section">
              <label className="drawer-label" htmlFor="language">
                {t('lang.label')}
              </label>
              <LanguageSwitcher id="language" />
            </div>

            <ul className="drawer-nav">
              {items.map((view) => (
                <li key={view}>
                  <button type="button" className="drawer-item" onClick={() => openView(view)}>
                    <span>{t(TITLES[view])}</span>
                    <span className="drawer-chevron" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            {loggedIn && (
              <div className="drawer-section drawer-footer">
                <button type="button" className="btn" onClick={logout}>
                  {t('auth.logout')}
                </button>
              </div>
            )}
          </nav>
        </div>
      )}

      {isView(shown) && (
        <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
          <div className="sheet-header">
            <button ref={backButton} type="button" className="icon-button" aria-label={t('nav.back')} onClick={close}>
              <span className="icon-back" aria-hidden="true" />
            </button>
            <h2 id="sheet-title" className="sheet-title">
              {t(TITLES[shown])}
            </h2>
          </div>
          <div className="sheet-body">
            {shown === 'leaderboard' && <Leaderboard />}
            {shown === 'history' && <MyGames />}
            {shown === 'account' && <Account />}
            {shown === 'rules' && <Rules />}
          </div>
        </div>
      )}
    </>
  );
}
