'use client';

import { useI18n } from '@/lib/i18n/I18nProvider';

// The order players learn the rules in; the texts summarize docs/01-game-rules.md.
const RULES = ['players', 'leave', 'move', 'block', 'capture', 'extra', 'entrance', 'home', 'finish', 'saved'] as const;

/** The "How to play" page. */
export function Rules() {
  const { t } = useI18n();
  return (
    <div className="page-content">
      <ol className="rules">
        {RULES.map((key) => (
          <li key={key}>{t(`rules.items.${key}`)}</li>
        ))}
      </ol>
    </div>
  );
}
