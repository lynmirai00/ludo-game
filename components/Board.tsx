'use client';

import type { CSSProperties, Ref } from 'react';
import {
  BASE_SLOTS,
  COLORS,
  HOME_COLUMNS,
  PATH,
  SAFE,
  START,
  cellOf,
  type Cell,
  type Color,
  type GameState,
  type TokenIndex,
} from '@/lib/game';
import { useI18n } from '@/lib/i18n/I18nProvider';

// Top-left corner [row, col] of each color's 6x6 base.
const BASE_CORNERS: readonly Cell[] = [[0, 0], [0, 9], [9, 9], [9, 0]];
const TOKEN_INDICES: readonly TokenIndex[] = [0, 1, 2, 3];

function area([row, col]: Cell, rows = 1, cols = 1): CSSProperties {
  return { gridArea: `${row + 1} / ${col + 1} / span ${rows} / span ${cols}` };
}

// The board itself never changes, so build it once.
function StaticBoard() {
  const cells = COLORS.flatMap((color, c) => {
    const [r, col] = BASE_CORNERS[c]!;
    return [
      <div key={`base-${color}`} className={`base base--${color}`} style={area([r, col], 6, 6)} />,
      <div key={`inner-${color}`} className="base-inner" style={area([r + 1, col + 1], 4, 4)} />,
      ...BASE_SLOTS[c as Color].map((slot, i) => (
        <div key={`slot-${color}-${i}`} className={`base-slot base-slot--${color}`} style={area(slot)} />
      )),
      ...HOME_COLUMNS[c as Color].map((cell, i) => (
        <div key={`home-${color}-${i}`} className={`cell cell--home cell--${color}`} style={area(cell)} />
      )),
    ];
  });

  const track = PATH.map((cell, i) => {
    const startColor = START.indexOf(i);
    let className = 'cell';
    if (startColor !== -1) className += ` cell--start cell--${COLORS[startColor]}`;
    else if (SAFE.has(i)) className += ' cell--star';
    return <div key={`track-${i}`} className={className} style={area(cell)} />;
  });

  return (
    <>
      {cells}
      {track}
      <div className="center" style={area([6, 6], 3, 3)} />
    </>
  );
}
const STATIC_BOARD = <StaticBoard />;

type Props = {
  state: GameState;
  /** The current player's tokens that the human may click. */
  movable: ReadonlySet<TokenIndex>;
  onTokenClick: (token: TokenIndex) => void;
  ref?: Ref<HTMLDivElement>;
};

export function Board({ state, movable, onTokenClick, ref }: Props) {
  const { t } = useI18n();

  // Group tokens by cell so several tokens on one cell are drawn side by side.
  const stacks = new Map<string, { cell: Cell; tokens: { color: Color; i: TokenIndex }[] }>();
  for (const color of state.players) {
    for (const i of TOKEN_INDICES) {
      const cell = cellOf(color, state.tokens[color][i], i);
      const key = cell.join(',');
      if (!stacks.has(key)) stacks.set(key, { cell, tokens: [] });
      stacks.get(key)!.tokens.push({ color, i });
    }
  }

  return (
    <div ref={ref} className="board" role="group" aria-label={t('game.board')}>
      {STATIC_BOARD}
      {[...stacks].map(([key, { cell, tokens }]) => (
        <div key={key} className={`stack stack--${Math.min(tokens.length, 4)}`} style={area(cell)}>
          {tokens.map(({ color, i }) => {
            const canClick = color === state.turn && movable.has(i);
            return (
              <button
                key={`${color}-${i}`}
                type="button"
                className={`token token--${COLORS[color]}${canClick ? ' is-movable' : ''}`}
                disabled={!canClick}
                aria-label={t('token.label', { color: t(`colors.${COLORS[color]}`), number: i + 1 })}
                onClick={canClick ? () => onTokenClick(i) : undefined}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
