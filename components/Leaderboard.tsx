'use client';

import { useEffect, useState } from 'react';
import { PLAYER_COUNTS, type Leaderboards, type PlayerCount } from '@/lib/api';
import { ApiCallError, apiFetch } from '@/lib/auth-client';
import { errorKey, type MessageKey } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useAuth } from './AuthProvider';

type Board = 'mostWins' | 'fastestWins';

export function Leaderboard() {
  const { t, lang } = useI18n();
  const { resultsVersion, me, call } = useAuth();
  const [reloads, setReloads] = useState(0);
  // A key, not text, so it follows language changes like everything else.
  const [notice, setNotice] = useState<MessageKey | null>(null);
  const [data, setData] = useState<Leaderboards | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<Board>('mostWins');
  const [players, setPlayers] = useState<PlayerCount>(4);

  // Public data: load on mount and after every saved result.
  useEffect(() => {
    let active = true;
    apiFetch<Leaderboards>('/api/leaderboard')
      .then((next) => {
        if (!active) return;
        setData(next);
        setError(null);
      })
      .catch((e) => active && setError(e instanceof ApiCallError ? e.code : 'UNKNOWN'));
    return () => {
      active = false;
    };
  }, [resultsVersion, reloads]);

  // Admins only (the server checks the role again): reset both leaderboards after a confirmation.
  async function reset() {
    if (!window.confirm(t('admin.confirmClear'))) return;
    try {
      await call('/api/leaderboard', { method: 'DELETE' });
      setNotice('admin.cleared');
      setReloads((n) => n + 1);
    } catch (e) {
      setNotice(errorKey(e instanceof ApiCallError ? e.code : 'UNKNOWN'));
    }
  }

  const number = new Intl.NumberFormat(lang);
  const rows =
    data === null
      ? []
      : board === 'mostWins'
        ? data.mostWins.map((row) => ({ name: row.name, value: t('stats.wins', { count: row.wins }) }))
        : data.fastestWins[`${players}`].map((row) => ({ name: row.name, value: t('leaderboard.rolls', { count: row.rolls }) }));

  return (
    <div className="page-content">
      <div className="tabs" role="tablist" aria-label={t('leaderboard.title')}>
        {(['mostWins', 'fastestWins'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={board === key}
            className="tab"
            onClick={() => setBoard(key)}
          >
            {t(`leaderboard.${key}`)}
          </button>
        ))}
      </div>
      {board === 'fastestWins' && (
        <div className="tabs tabs--small" role="tablist" aria-label={t('leaderboard.fastestWins')}>
          {PLAYER_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              role="tab"
              aria-selected={players === count}
              className="tab"
              onClick={() => setPlayers(count)}
            >
              {t('leaderboard.players', { count })}
            </button>
          ))}
        </div>
      )}
      {error ? (
        <p className="hint">{t(errorKey(error))}</p>
      ) : data && rows.length === 0 ? (
        <p className="hint">{t('leaderboard.empty')}</p>
      ) : (
        <ol className="leaderboard">
          {rows.map((row, i) => (
            <li key={`${row.name}-${i}`} className="leaderboard-row">
              <span className="leaderboard-rank">{number.format(i + 1)}</span>
              <span className="leaderboard-name">{row.name}</span>
              <span className="leaderboard-value">{row.value}</span>
            </li>
          ))}
        </ol>
      )}
      {me?.admin && (
        <div className="admin-tools">
          <button type="button" className="btn btn--small btn--danger" onClick={() => void reset()}>
            {t('admin.clearLeaderboard')}
          </button>
          {notice && (
            <p className="hint" role="status">
              {t(notice)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
