'use client';

import { useI18n } from '@/lib/i18n/I18nProvider';

// Shown instead of a blank page when the game crashes in this browser (e.g. an old phone browser).
// The technical message helps to find out what failed.
export default function GameError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <main className="app">
      <section className="panel crash" role="alert">
        <h2 className="panel-title">{t('crash.title')}</h2>
        <p>{t('crash.message')}</p>
        <p className="crash-detail">{error.message || error.digest}</p>
        <button type="button" className="btn btn--primary" onClick={reset}>
          {t('crash.retry')}
        </button>
      </section>
    </main>
  );
}
