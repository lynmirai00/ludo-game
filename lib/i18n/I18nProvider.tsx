'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LANGUAGE,
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

export function I18nProvider({ children }: { children: ReactNode }) {
  // null until detected on the client: the server cannot see localStorage, and
  // rendering English first would flash the wrong language for vi/ja users.
  const [lang, setLang] = useState<Language | null>(null);

  useEffect(() => {
    setLang(detectLanguage({ storage: getStorage(), languages: navigator.languages }));
  }, []);

  // Never reloads the page, so a running game is not interrupted.
  const setLanguage = useCallback((code: Language) => {
    setLang(code);
    saveLanguage(code, getStorage());
  }, []);

  const value = useMemo<I18n | null>(() => {
    if (!lang) return null;
    return { lang, setLanguage, t: (key, params) => translate(lang, key, params) };
  }, [lang, setLanguage]);

  useEffect(() => {
    if (value) document.documentElement.lang = value.lang;
  }, [value]);

  // React hoists <title> into <head> and keeps it in sync. Setting document.title
  // by hand would be overwritten when React re-commits the head.
  if (!value) return <title>{translate(DEFAULT_LANGUAGE, 'app.title')}</title>;
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
