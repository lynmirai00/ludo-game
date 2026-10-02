import type { Viewport } from 'next';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import './globals.css';

// No metadata.title here: I18nProvider renders the translated <title>, and a
// Next.js metadata title would overwrite it.
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // lang is updated on the client after language detection.
    <html lang="en" suppressHydrationWarning>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
