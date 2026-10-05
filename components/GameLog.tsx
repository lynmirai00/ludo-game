'use client';

import { COLORS, type Color, type GameEvent } from '@/lib/game';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { Params } from '@/lib/i18n';

type T = ReturnType<typeof useI18n>['t'];

const PLACE_KEYS = ['rank.first', 'rank.second', 'rank.third', 'rank.fourth'] as const;

export function colorName(t: T, color: Color): string {
  return t(`colors.${COLORS[color]}`);
}

export function playerName(t: T, color: Color): string {
  return t('player.bot', { color: colorName(t, color) });
}

/** "1st", "nhất", "1位"… for a finishing place from 1 to 4. */
export function placeName(t: T, place: number): string {
  const key = PLACE_KEYS[place - 1];
  return key ? t(key) : String(place);
}

// Events are stored as data and turned into text only here, at render time,
// so switching language re-renders the whole log in the new language.
export function describeEvent(t: T, event: GameEvent, human: Color): string {
  const params: Params = { player: playerName(t, event.player) };
  if (event.type === 'rolled') params.value = event.value;
  if (event.type === 'capture') params.color = colorName(t, event.victimColor);
  if (event.type === 'step') params.step = event.step;
  if (event.type === 'finish') params.place = placeName(t, event.place);
  const who = event.player === human ? 'self' : 'other';
  return t(`events.${event.type}.${who}`, params);
}

export function GameLog({ events, human }: { events: readonly GameEvent[]; human: Color }) {
  const { t } = useI18n();

  return (
    <section className="panel log-panel">
      <h2 className="panel-title">{t('game.log')}</h2>
      <ol className="log">
        {events
          .map((event, index) => ({ event, index }))
          .reverse()
          .map(({ event, index }) => (
            <li
              key={index}
              className={`log-item log-item--${COLORS[event.player]}${event.type === 'finish' ? ' log-item--finish' : ''}`}
            >
              {describeEvent(t, event, human)}
            </li>
          ))}
      </ol>
    </section>
  );
}
