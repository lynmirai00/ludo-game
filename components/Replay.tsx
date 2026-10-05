'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SEATS, type MatchView } from '@/lib/api';
import { ApiCallError } from '@/lib/auth-client';
import { applyAction, replay, type GameState } from '@/lib/game';
import { errorKey } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useAuth } from './AuthProvider';
import { Board } from './Board';
import { GameLog } from './GameLog';

const STEP_MS = 400;
const NO_MOVES = new Set<never>();

/** Replays a finished match step by step, from its stored actions (docs/02-zitadel.md, "Matches"). */
export function Replay({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { call } = useAuth();
  const [match, setMatch] = useState<MatchView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  // The state shown, kept so that stepping forward costs one action instead of a full replay.
  const shown = useRef<{ position: number; state: GameState } | null>(null);

  useEffect(() => {
    let active = true;
    call<MatchView>(`/api/matches/${matchId}`)
      .then((loaded) => active && setMatch(loaded))
      .catch((e) => active && setError(e instanceof ApiCallError ? e.code : 'UNKNOWN'));
    return () => {
      active = false;
    };
  }, [call, matchId]);

  // Keyboard: focus starts on "Back to the game"; Escape closes.
  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const total = match?.actions.length ?? 0;

  const state = useMemo(() => {
    if (!match) return null;
    const seats = SEATS[match.players];
    const previous = shown.current;
    const next =
      previous && previous.position === position - 1
        ? applyAction(previous.state, match.actions[position - 1]!)
        : replay(seats, match.actions.slice(0, position));
    shown.current = { position, state: next };
    return next;
  }, [match, position]);

  // Play: one step every STEP_MS until the end.
  useEffect(() => {
    if (!playing) return;
    if (position >= total) return setPlaying(false);
    const timer = setTimeout(() => setPosition((p) => Math.min(p + 1, total)), STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, position, total]);

  const number = new Intl.NumberFormat(lang);

  return (
    <div className="replay-backdrop">
      <section className="replay panel" role="dialog" aria-modal="true" aria-labelledby="replay-title">
        <div className="replay-header">
          <h2 id="replay-title" className="panel-title">
            {t('replay.title')}
          </h2>
          <button ref={closeButton} type="button" className="btn btn--small" onClick={onClose}>
            {t('replay.close')}
          </button>
        </div>
        {error ? (
          <p className="hint">{t(errorKey(error))}</p>
        ) : !state ? null : (
          <>
            <div className="replay-controls">
              <button
                type="button"
                className="btn btn--small"
                aria-label={t('replay.prev')}
                disabled={position === 0}
                onClick={() => {
                  setPlaying(false);
                  setPosition((p) => Math.max(p - 1, 0));
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="btn btn--small btn--primary"
                onClick={() => {
                  if (position >= total) setPosition(0);
                  setPlaying((on) => !on);
                }}
              >
                {playing ? t('replay.pause') : t('replay.play')}
              </button>
              <button
                type="button"
                className="btn btn--small"
                aria-label={t('replay.next')}
                disabled={position >= total}
                onClick={() => {
                  setPlaying(false);
                  setPosition((p) => Math.min(p + 1, total));
                }}
              >
                ›
              </button>
              <span className="replay-position">
                {t('replay.position', { current: number.format(position), total: number.format(total) })}
              </span>
            </div>
            <input
              className="replay-slider"
              type="range"
              min={0}
              max={total}
              value={position}
              aria-label={t('replay.position', { current: number.format(position), total: number.format(total) })}
              onChange={(event) => {
                setPlaying(false);
                setPosition(Number(event.target.value));
              }}
            />
            <div className="replay-body">
              <Board state={state} movable={NO_MOVES} onTokenClick={() => {}} />
              <GameLog events={state.events} human={0} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
