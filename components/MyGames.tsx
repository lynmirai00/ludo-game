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
  const { status, call, resultsVersion } = useAuth();
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

  const date = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="page-content">
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
      {replayId && <Replay matchId={replayId} onClose={() => setReplayId(null)} />}
    </div>
  );
}
