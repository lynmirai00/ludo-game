import type { Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import type { ReactNode } from 'react';
import { COOKIE_NAME, languageFromRequest, translate } from '@/lib/i18n';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import './globals.css';

// No metadata.title here: I18nProvider renders the translated <title>, and a
// Next.js metadata title would overwrite it.
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Render the first page in the player's language already (cookie, then Accept-Language),
  // so the page has content even before (or without) JavaScript.
  const lang = languageFromRequest({
    cookie: (await cookies()).get(COOKIE_NAME)?.value,
    acceptLanguage: (await headers()).get('accept-language'),
  });

  return (
    // The provider keeps lang in sync after the browser refines the choice.
    <html lang={lang} suppressHydrationWarning>
      <body>
        <noscript>
          <p className="crash-banner">{translate(lang, 'crash.noScript')}</p>
        </noscript>
        <I18nProvider initialLang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
