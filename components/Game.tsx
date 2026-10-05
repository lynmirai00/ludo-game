'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { chooseMove } from '@/lib/bot';
import {
  COLORS,
  applyMove,
  applyRoll,
  createGame,
  legalMoves,
  type Color,
  type GameState,
  type TokenIndex,
} from '@/lib/game';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { Board } from './Board';
import { GameLog, describeEvent, playerName } from './GameLog';

const HUMAN: Color = 0; // the human always plays Red
const OPPONENT_CHOICES = [1, 3] as const;
type Opponents = (typeof OPPONENT_CHOICES)[number];
const NO_MOVES: ReadonlySet<TokenIndex> = new Set();

// 1 bot: Red vs Yellow (opposite corners). 3 bots: all four colors.
function playersFor(opponents: Opponents): Color[] {
  return opponents === 1 ? [0, 2] : [0, 1, 2, 3];
}

// Unbiased 1..6: reject bytes that would make some faces more likely.
function rollDie(): number {
  const byte = new Uint8Array(1);
  do crypto.getRandomValues(byte);
  while (byte[0]! >= 252);
  return 1 + (byte[0]! % 6);
}

function colorVar(color: Color): CSSProperties {
  return { '--player-color': `var(--${COLORS[color]})` } as CSSProperties;
}

export function Game() {
  const { t, lang } = useI18n();
  const [opponents, setOpponents] = useState<Opponents>(3);
  const [state, setState] = useState<GameState>(() => createGame({ players: playersFor(3) }));
  const rollButton = useRef<HTMLButtonElement>(null);
  const board = useRef<HTMLDivElement>(null);
  // Set by game actions (not by language changes) so focus only moves when the game does.
  const focusAfterUpdate = useRef(false);

  const isHumanTurn = state.phase !== 'over' && state.turn === HUMAN;
  const canRoll = isHumanTurn && state.phase === 'roll';
  const movable =
    isHumanTurn && state.phase === 'move' && state.dice !== null ? new Set(legalMoves(state, state.dice)) : NO_MOVES;

  const update = useCallback((next: GameState) => {
    focusAfterUpdate.current = true;
    setState(next);
  }, []);

  // Bot turns: one step (roll or move) per 0.7–0.9 s so the human can follow along.
  // Depends only on the game state, so changing language never interrupts it.
  useEffect(() => {
    if (state.phase === 'over' || state.turn === HUMAN) return;
    const timer = setTimeout(
      () => update(state.phase === 'roll' ? applyRoll(state, rollDie()) : applyMove(state, chooseMove(state))),
      700 + Math.random() * 200,
    );
    return () => clearTimeout(timer);
  }, [state, update]);

  // After a game step, move keyboard focus to what the human should do next.
  useEffect(() => {
    if (!focusAfterUpdate.current) return;
    focusAfterUpdate.current = false;
    if (state.phase === 'over' || state.turn !== HUMAN) return;
    if (state.phase === 'move') board.current?.querySelector<HTMLButtonElement>('.token.is-movable')?.focus();
    else rollButton.current?.focus();
  }, [state]);

  const lastRoll = state.events.findLast((e) => e.type === 'rolled');

  let turnText: string;
  let hintText: string;
  if (state.phase === 'over' && state.winner !== null) {
    turnText = describeEvent(t, { type: 'win', player: state.winner }, HUMAN);
    hintText = t('hint.gameOver');
  } else if (isHumanTurn) {
    turnText = t('turn.self');
    hintText = t(state.phase === 'move' ? 'hint.move' : 'hint.roll');
  } else {
    turnText = t('turn.other', { player: playerName(t, state.turn) });
    hintText = t('hint.botThinking', { player: playerName(t, state.turn) });
  }

  return (
    <>
      <section className="panel controls">
        <div className="status" aria-live="polite">
          <p className="turn" style={colorVar(state.winner ?? state.turn)}>
            {turnText}
          </p>
          <p className="hint">{hintText}</p>
        </div>
        <div className="actions">
          <div
            className="dice"
            role="img"
            aria-label={lastRoll ? t('game.lastRoll', { value: lastRoll.value }) : t('game.dice')}
            style={lastRoll ? colorVar(lastRoll.player) : undefined}
          >
            {lastRoll ? new Intl.NumberFormat(lang).format(lastRoll.value) : null}
          </div>
          <button
            ref={rollButton}
            type="button"
            className="btn btn--primary"
            disabled={!canRoll}
            onClick={() => canRoll && update(applyRoll(state, rollDie()))}
          >
            {t('game.roll')}
          </button>
        </div>
        <div className="setup">
          <label htmlFor="opponents" className="setup-label">
            {t('game.opponents')}
          </label>
          <select
            id="opponents"
            className="select"
            value={opponents}
            onChange={(event) => setOpponents(Number(event.target.value) === 1 ? 1 : 3)}
          >
            {OPPONENT_CHOICES.map((count) => (
              <option key={count} value={count}>
                {t('game.bots', { count })}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={() => update(createGame({ players: playersFor(opponents) }))}>
            {t('game.newGame')}
          </button>
        </div>
      </section>
      <Board
        ref={board}
        state={state}
        movable={movable}
        onTokenClick={(token) => {
          if (isHumanTurn && state.phase === 'move') update(applyMove(state, token));
        }}
      />
      <GameLog events={state.events} human={HUMAN} />
    </>
  );
}
