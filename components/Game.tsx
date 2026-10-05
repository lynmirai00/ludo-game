'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { SEATS as SEATS_BY_PLAYERS, type ActionsResponse, type MatchView, type PlayerCount } from '@/lib/api';
import { ApiCallError } from '@/lib/auth-client';
import { chooseMove } from '@/lib/bot';
import {
  COLORS,
  applyAction,
  applyMove,
  applyRoll,
  createGame,
  legalMoves,
  replay,
  type Action,
  type Color,
  type GameState,
  type TokenIndex,
} from '@/lib/game';
import { errorKey } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useAuth } from './AuthProvider';
import { Board } from './Board';
import { GameLog, describeEvent, placeName, playerName, type LogNote } from './GameLog';

const HUMAN: Color = 0; // the human always plays Red
const OPPONENT_CHOICES = [1, 2, 3] as const;
type Opponents = (typeof OPPONENT_CHOICES)[number];
const NO_MOVES: ReadonlySet<TokenIndex> = new Set();
const FAST_BOT_DELAY_MS = 120;

const seatsFor = (opponents: Opponents) => SEATS_BY_PLAYERS[(opponents + 1) as PlayerCount];

function toOpponents(value: string): Opponents {
  return OPPONENT_CHOICES.find((count) => String(count) === value) ?? 3;
}

// Unbiased 1..6 for guest games: reject bytes that would make some faces more likely.
function rollDie(): number {
  const byte = new Uint8Array(1);
  do crypto.getRandomValues(byte);
  while (byte[0]! >= 252);
  return 1 + (byte[0]! % 6);
}

function colorVar(color: Color): CSSProperties {
  return { '--player-color': `var(--${COLORS[color]})` } as CSSProperties;
}

/**
 * Two modes (docs/02-zitadel.md, "Matches"):
 * - guest: everything runs in the browser, bots included, and nothing is saved;
 * - logged in: the server rolls, checks moves, plays the bots and records the result; the browser
 *   only replays the actions it gets back, one by one, with the bot delay.
 */
export function Game() {
  const { t, lang } = useI18n();
  const auth = useAuth();
  const online = auth.status === 'user';
  const [opponents, setOpponents] = useState<Opponents>(3);
  // Kept across new games; only changes how long bots wait, never the game itself.
  const [fastBots, setFastBots] = useState(false);
  const [state, setState] = useState<GameState>(() => createGame({ players: seatsFor(3) }));
  const [notes, setNotes] = useState<LogNote[]>([]);
  // Logged in: the server match being shown (null until the first roll of a new game).
  const [matchId, setMatchId] = useState<string | null>(null);
  // Logged in: actions received from the server, not shown yet.
  const [queue, setQueue] = useState<Action[]>([]);
  const [busy, setBusy] = useState(false);
  const [resumeChecked, setResumeChecked] = useState(false);
  // Bumped on every new game, so a late server answer for an old game is ignored.
  const generation = useRef(0);
  // The game whose result was already handled, so each game reports exactly once.
  // `players` keeps its identity for a whole game (unlike `ranking`, which grows as bots finish).
  const reported = useRef<GameState['players'] | null>(null);
  const rollButton = useRef<HTMLButtonElement>(null);
  const board = useRef<HTMLDivElement>(null);
  // Set by game actions (not by language changes) so focus only moves when the game does.
  const focusAfterUpdate = useRef(false);

  const ready = auth.status !== 'loading' && (!online || resumeChecked) && !busy && queue.length === 0;
  const isHumanTurn = state.phase !== 'over' && state.turn === HUMAN;
  const canRoll = ready && isHumanTurn && state.phase === 'roll';
  const movable =
    ready && isHumanTurn && state.phase === 'move' && state.dice !== null ? new Set(legalMoves(state, state.dice)) : NO_MOVES;
  // The human's place is known once they finish or are the last one left.
  const humanPlace = state.ranking.indexOf(HUMAN) + 1;

  const update = useCallback((next: GameState) => {
    focusAfterUpdate.current = true;
    setState(next);
  }, []);

  const addNote = useCallback((key: LogNote['key'], at: number) => setNotes((list) => [...list, { at, key }]), []);

  // --- logged in: the server match ------------------------------------------------------------

  const { call, resultRecorded } = auth;

  /** Shows the match exactly as the server has it (after an error, or to resume it). */
  const loadMatch = useCallback(
    (match: MatchView) => {
      setQueue([]);
      setMatchId(match.id);
      setOpponents((match.players - 1) as Opponents);
      update(replay(SEATS_BY_PLAYERS[match.players], match.actions));
    },
    [update],
  );

  // After login, continue the latest unfinished match, if any.
  useEffect(() => {
    if (!online || resumeChecked) return;
    call<{ match: MatchView | null }>('/api/matches/current')
      .then(({ match }) => {
        if (!match) return;
        reported.current = null;
        setNotes([]);
        loadMatch(match);
        if (match.actions.length > 0) addNote('match.resumed', replay(SEATS_BY_PLAYERS[match.players], match.actions).events.length);
      })
      .catch(() => {})
      .finally(() => setResumeChecked(true));
  }, [online, resumeChecked, call, loadMatch, addNote]);

  /** Sends the human's roll or move to the server and queues the actions it answers with. */
  async function playOnline(action: 'roll' | { token: TokenIndex }) {
    const mine = generation.current;
    setBusy(true);
    let id = matchId;
    try {
      if (!id) {
        const created = await call<MatchView>('/api/matches', {
          method: 'POST',
          body: JSON.stringify({ players: state.players.length }),
        });
        id = created.id;
        if (generation.current === mine) setMatchId(id);
      }
      const response = await call<ActionsResponse>(`/api/matches/${id}/${action === 'roll' ? 'roll' : 'move'}`, {
        method: 'POST',
        body: action === 'roll' ? undefined : JSON.stringify({ token: action.token }),
      });
      if (generation.current === mine) setQueue((list) => [...list, ...response.actions]);
    } catch (error) {
      if (generation.current !== mine) return;
      const code = error instanceof ApiCallError ? error.code : 'UNKNOWN';
      addNote(errorKey(code), state.events.length);
      // Whatever went wrong, show the match as the server has it.
      if (id && code !== 'UNAUTHORIZED') {
        call<MatchView>(`/api/matches/${id}`).then(loadMatch).catch(() => {});
      }
    } finally {
      if (generation.current === mine) setBusy(false);
    }
  }

  // Show queued server actions one at a time: the human's own action at once, bot actions with the bot delay.
  useEffect(() => {
    const next = queue[0];
    if (!next) return;
    const timer = setTimeout(
      () => {
        try {
          update(applyAction(state, next));
          setQueue((list) => list.slice(1));
        } catch {
          // The browser and the server disagree (should not happen): reload the server's version.
          if (matchId) call<MatchView>(`/api/matches/${matchId}`).then(loadMatch).catch(() => {});
        }
      },
      state.turn === HUMAN ? 0 : fastBots ? FAST_BOT_DELAY_MS : 700 + Math.random() * 200,
    );
    return () => clearTimeout(timer);
  }, [queue, state, fastBots, update, matchId, call, loadMatch]);

  // --- guest: everything in the browser ------------------------------------------------------

  // Bot turns: one step (roll or move) per 0.7–0.9 s so the human can follow along, or much faster
  // with "Fast bots". Bots keep playing for the remaining places after the human has finished.
  // Depends only on the game state, so changing language never interrupts it.
  useEffect(() => {
    if (online || auth.status === 'loading' || state.phase === 'over' || state.turn === HUMAN) return;
    const timer = setTimeout(
      () => update(state.phase === 'roll' ? applyRoll(state, rollDie()) : applyMove(state, chooseMove(state))),
      fastBots ? FAST_BOT_DELAY_MS : 700 + Math.random() * 200,
    );
    return () => clearTimeout(timer);
  }, [online, auth.status, state, update, fastBots]);

  // --- both modes ----------------------------------------------------------------------------

  // After a game step, move keyboard focus to what the human should do next.
  useEffect(() => {
    if (!focusAfterUpdate.current) return;
    focusAfterUpdate.current = false;
    if (state.phase === 'over' || state.turn !== HUMAN) return;
    if (state.phase === 'move') board.current?.querySelector<HTMLButtonElement>('.token.is-movable')?.focus();
    else rollButton.current?.focus();
  }, [state]);

  // As soon as the human's place is shown: logged in, the server has already recorded it;
  // as a guest, say that nothing was saved.
  useEffect(() => {
    if (humanPlace === 0 || auth.status === 'loading' || reported.current === state.players) return;
    reported.current = state.players;
    if (online) {
      addNote('result.saved', state.events.length);
      resultRecorded();
    } else {
      addNote('result.notSaved', state.events.length);
    }
  }, [humanPlace, auth.status, online, state, addNote, resultRecorded]);

  function newGame() {
    generation.current += 1;
    setNotes([]);
    setQueue([]);
    setBusy(false);
    setMatchId(null); // logged in: the server match is created on the first roll
    update(createGame({ players: seatsFor(opponents) }));
  }

  const lastRoll = state.events.findLast((e) => e.type === 'rolled');

  let turnText: string;
  let hintText: string;
  let turnColor: Color = state.turn;
  if (humanPlace > 0) {
    turnText = describeEvent(t, { type: 'finish', player: HUMAN, place: humanPlace }, HUMAN);
    hintText = t(state.phase === 'over' ? 'hint.gameOver' : 'hint.watching');
    turnColor = HUMAN;
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
          <p className="turn" style={colorVar(turnColor)}>
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
            onClick={() => {
              if (!canRoll) return;
              if (online) void playOnline('roll');
              else update(applyRoll(state, rollDie()));
            }}
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
            onChange={(event) => setOpponents(toOpponents(event.target.value))}
          >
            {OPPONENT_CHOICES.map((count) => (
              <option key={count} value={count}>
                {t('game.bots', { count })}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={newGame}>
            {t('game.newGame')}
          </button>
          <button
            type="button"
            className="btn btn--toggle"
            aria-pressed={fastBots}
            onClick={() => setFastBots((on) => !on)}
          >
            {t('game.fastBots')}
          </button>
        </div>
        {state.ranking.length > 0 && (
          <div className="ranking">
            <h2 className="panel-title">{t('game.ranking')}</h2>
            <ol className="ranking-list">
              {state.ranking.map((color, i) => (
                <li key={color} className="ranking-item" style={colorVar(color)}>
                  <span className="ranking-place">{placeName(t, i + 1)}</span>
                  <span>{color === HUMAN ? t('player.you') : playerName(t, color)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
      <Board
        ref={board}
        state={state}
        movable={movable}
        onTokenClick={(token) => {
          if (!movable.has(token)) return;
          if (online) void playOnline({ token });
          else update(applyMove(state, token));
        }}
      />
      <GameLog events={state.events} human={HUMAN} notes={notes} />
    </>
  );
}
