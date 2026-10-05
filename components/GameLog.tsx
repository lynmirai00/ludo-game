'use client';

import { COLORS, type Color, type GameEvent } from '@/lib/game';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { MessageKey, Params } from '@/lib/i18n';

type T = ReturnType<typeof useI18n>['t'];

/** A UI message (not a game event) shown in the log after the first `at` events, e.g. "Result saved". */
export type LogNote = { at: number; key: MessageKey };

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

type Item = { key: string; text: string; className: string };

export function GameLog({ events, human, notes = [] }: { events: readonly GameEvent[]; human: Color; notes?: readonly LogNote[] }) {
  const { t } = useI18n();

  // Oldest first, notes right after the event they follow; then shown newest first.
  const items: Item[] = [];
  const addNotes = (at: number) =>
    notes.forEach((note, i) => {
      if (note.at === at) items.push({ key: `note-${i}`, text: t(note.key), className: 'log-item log-item--note' });
    });
  addNotes(0);
  events.forEach((event, index) => {
    const finish = event.type === 'finish' ? ' log-item--finish' : '';
    items.push({ key: `event-${index}`, text: describeEvent(t, event, human), className: `log-item log-item--${COLORS[event.player]}${finish}` });
    addNotes(index + 1);
  });

  return (
    <section className="panel log-panel">
      <h2 className="panel-title">{t('game.log')}</h2>
      <ol className="log">
        {items.reverse().map((item) => (
          <li key={item.key} className={item.className}>
            {item.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
