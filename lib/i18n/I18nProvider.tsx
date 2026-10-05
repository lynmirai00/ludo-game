'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  COOKIE_NAME,
  STORAGE_KEY,
  detectLanguage,
  saveLanguage,
  translate,
  type Language,
  type MessageKey,
  type Params,
} from './index';

type I18n = {
  lang: Language;
  t: (key: MessageKey, params?: Params) => string;
  setLanguage: (code: Language) => void;
};

const I18nContext = createContext<I18n | null>(null);

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Remembers the choice for the server too, so the next page load renders in this language right away. */
function saveCookie(code: Language) {
  const secure = location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${COOKIE_NAME}=${code}; path=/; max-age=31536000; samesite=lax${secure}`;
}

/**
 * `initialLang` comes from the server (cookie, then Accept-Language), so the page has content
 * before any JavaScript runs and the first render already uses the right language.
 */
export function I18nProvider({ children, initialLang }: { children: ReactNode; initialLang: Language }) {
  const [lang, setLang] = useState<Language>(initialLang);

  // The browser knows a little more than the server (localStorage, navigator.languages).
  useEffect(() => {
    const storage = getStorage();
    let stored: string | null = null;
    try {
      stored = storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      // Storage can be blocked; the cookie or the browser language is used then.
    }
    const detected = detectLanguage({ storage, languages: navigator.languages });
    if (detected !== initialLang) setLang(detected);
    // Players from before the cookie existed: copy their choice into it.
    if (stored) saveCookie(detected);
  }, [initialLang]);

  // Never reloads the page, so a running game is not interrupted.
  const setLanguage = useCallback((code: Language) => {
    setLang(code);
    saveLanguage(code, getStorage());
    saveCookie(code);
  }, []);

  const value = useMemo<I18n>(
    () => ({ lang, setLanguage, t: (key, params) => translate(lang, key, params) }),
    [lang, setLanguage],
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // React hoists <title> into <head> and keeps it in sync. Setting document.title
  // by hand would be overwritten when React re-commits the head.
  return (
    <I18nContext.Provider value={value}>
      <title>{value.t('app.title')}</title>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18n {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n() must be used inside <I18nProvider>');
  return context;
}
