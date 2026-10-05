'use client';

import { LANGUAGES, translate } from '@/lib/i18n';
import './globals.css';

// Last resort, when even the layout (and so the language provider) crashed: there is no
// language context here, so the message is shown in all three languages.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="app">
          <section className="panel crash" role="alert">
            {Object.keys(LANGUAGES).map((lang) => (
              <div key={lang} lang={lang}>
                <h2 className="panel-title">{translate(lang, 'crash.title')}</h2>
                <p>{translate(lang, 'crash.message')}</p>
              </div>
            ))}
            <p className="crash-detail">{error.message || error.digest}</p>
            <button type="button" className="btn btn--primary" onClick={reset}>
              {translate('en', 'crash.retry')} / {translate('vi', 'crash.retry')} / {translate('ja', 'crash.retry')}
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
