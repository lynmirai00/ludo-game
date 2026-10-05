'use client';

import { errorKey } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useAuth } from './AuthProvider';
import { LanguageSwitcher } from './LanguageSwitcher';

function AuthArea() {
  const { t } = useI18n();
  const { status, me, error, login, logout } = useAuth();

  if (status === 'loading') return null;
  if (status === 'unreachable') return <p className="auth-note">{t('auth.unreachable')}</p>;
  if (status === 'user' && me) {
    return (
      <div className="auth">
        <span className="auth-name">{me.name}</span>
        <span className="auth-stats">
          {t('stats.summary', {
            wins: t('stats.wins', { count: me.wins }),
            games: t('stats.games', { count: me.games }),
          })}
        </span>
        <button type="button" className="btn btn--small" onClick={logout}>
          {t('auth.logout')}
        </button>
      </div>
    );
  }
  return (
    <div className="auth">
      <span className="auth-note">{error ? t(errorKey(error)) : t('auth.prompt')}</span>
      <button type="button" className="btn btn--small btn--primary" onClick={login}>
        {t('auth.login')}
      </button>
    </div>
  );
}

export function TopBar() {
  const { t } = useI18n();

  return (
    <header className="topbar">
      <h1 className="app-title">{t('app.title')}</h1>
      <div className="topbar-end">
        <AuthArea />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
