'use client';

import { useEffect, useState } from 'react';
import type { GameRecord } from '@/lib/api';
import { ApiCallError } from '@/lib/auth-client';
import { errorKey } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useAuth } from './AuthProvider';
import { placeName } from './GameLog';
import { Replay } from './Replay';

/** The logged-in player's recent results (GET /api/me/games). Hidden for guests. */
export function MyGames() {
  const { t, lang } = useI18n();
  const { status, call, resultsVersion, logout } = useAuth();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replayId, setReplayId] = useState<string | null>(null);

  // Load after login and after every saved result.
  useEffect(() => {
    if (status !== 'user') return;
    let active = true;
    call<GameRecord[]>('/api/me/games')
      .then((list) => {
        if (!active) return;
        setGames(list);
        setError(null);
      })
      .catch((e) => active && setError(e instanceof ApiCallError ? e.code : 'UNKNOWN'));
    return () => {
      active = false;
    };
  }, [status, call, resultsVersion]);

  if (status !== 'user') return null;

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

  const date = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section className="panel history-panel">
      <h2 className="panel-title">{t('history.title')}</h2>
      {error ? (
        <p className="hint">{t(errorKey(error))}</p>
      ) : games && games.length === 0 ? (
        <p className="hint">{t('history.empty')}</p>
      ) : (
        <ol className="history">
          {(games ?? []).map((game, i) => (
            <li key={`${game.finishedAt}-${i}`} className={`history-row${game.place === 1 ? ' history-row--win' : ''}`}>
              <span className="history-place">{placeName(t, game.place)}</span>
              <span className="history-detail">
                <span>{t('leaderboard.players', { count: game.players })}</span>
                <span>{t('leaderboard.rolls', { count: game.rolls })}</span>
              </span>
              <time className="history-date" dateTime={game.finishedAt}>
                {date.format(new Date(game.finishedAt))}
              </time>
              {game.matchId && (
                <button type="button" className="btn btn--small" onClick={() => setReplayId(game.matchId)}>
                  {t('replay.button')}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
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
      {replayId && <Replay matchId={replayId} onClose={() => setReplayId(null)} />}
    </section>
  );
}
