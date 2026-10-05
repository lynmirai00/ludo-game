'use client';

import { useState } from 'react';
import { ApiCallError } from '@/lib/auth-client';
import { errorKey } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useAuth } from './AuthProvider';

/** The "Account" page: who is logged in, their stats, their data, and logging out. */
export function Account() {
  const { t } = useI18n();
  const { me, call, logout } = useAuth();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!me) return null;

  // Privacy (docs/03-plan.md, Phase 6): delete this player's game data, then log out.
  async function deleteMyData() {
    if (!window.confirm(t('privacy.confirmDelete'))) return;
    try {
      await call('/api/me', { method: 'DELETE' });
      logout();
    } catch (e) {
      setDeleteError(e instanceof ApiCallError ? e.code : 'UNKNOWN');
    }
  }

  return (
    <div className="page-content account">
      <p className="account-name">{me.name}</p>
      <p className="hint">
        {t('stats.summary', {
          wins: t('stats.wins', { count: me.wins }),
          games: t('stats.games', { count: me.games }),
        })}
      </p>
      <button type="button" className="btn" onClick={logout}>
        {t('auth.logout')}
      </button>
      <div className="privacy">
        <h3 className="privacy-title">{t('privacy.title')}</h3>
        <p className="hint">{t('privacy.note')}</p>
        <button type="button" className="btn btn--small btn--danger" onClick={() => void deleteMyData()}>
          {t('privacy.delete')}
        </button>
        {deleteError && (
          <p className="hint" role="alert">
            {t(errorKey(deleteError))}
          </p>
        )}
      </div>
    </div>
  );
}
