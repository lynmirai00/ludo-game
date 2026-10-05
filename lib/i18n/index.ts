// Translation and language detection. Pure: no React, no DOM, so it can be tested directly.
import en from './locales/en';
import vi from './locales/vi';
import ja from './locales/ja';

// Names are always shown in their own language, never translated.
export const LANGUAGES = { en: 'English', vi: 'Tiếng Việt', ja: '日本語' } as const;
export type Language = keyof typeof LANGUAGES;
export const DEFAULT_LANGUAGE: Language = 'en';
export const STORAGE_KEY = 'lang';

type PluralCategory = Intl.LDMLPluralRule;
export type PluralForms = Partial<Record<PluralCategory, string>> & { other: string };

// The shape every locale must have, derived from en.ts. A plural object in en.ts
// (keys are all plural categories, e.g. { one, other }) may use different forms in
// another language; { self, other } event objects are nested keys, not plurals.
export type LocaleOf<T> = {
  [K in keyof T]: T[K] extends string ? string : keyof T[K] extends PluralCategory ? PluralForms : LocaleOf<T[K]>;
};
export type Locale = LocaleOf<typeof en>;

// Every dotted key that points at a translation, e.g. 'game.roll' or 'game.bots'.
export type MessageKey<T = typeof en, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : keyof T[K] extends PluralCategory
      ? `${Prefix}${K}`
      : MessageKey<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type Params = Record<string, string | number>;
type Dictionary = { [key: string]: string | Dictionary };

const DICTIONARIES: Record<Language, Locale> = { en, vi, ja };
const PLURAL_CATEGORIES = new Set<string>(['zero', 'one', 'two', 'few', 'many', 'other']);

export function isSupported(code: unknown): code is Language {
  return typeof code === 'string' && Object.hasOwn(LANGUAGES, code);
}

export function isPluralForms(value: unknown): value is PluralForms {
  if (!value || typeof value !== 'object') return false;
  const entries = Object.entries(value);
  return entries.length > 0 && entries.every(([k, v]) => PLURAL_CATEGORIES.has(k) && typeof v === 'string');
}

function lookup(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    return node && typeof node === 'object' ? (node as Dictionary)[part] : undefined;
  }, dict);
}

function isTranslation(value: unknown): value is string | PluralForms {
  return typeof value === 'string' || isPluralForms(value);
}

function interpolate(text: string, params: Params, lang: string): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!Object.hasOwn(params, name)) return match;
    const value = params[name];
    return typeof value === 'number' ? new Intl.NumberFormat(lang).format(value) : String(value);
  });
}

export type Translate = (lang: string, key: string, params?: Params) => string;

// Builds a translate function over the given dictionaries.
// Missing key → English (with a warning) → the key itself.
export function createTranslator(dictionaries: Record<string, unknown>): Translate {
  return function translate(lang, key, params = {}) {
    let value = lookup(dictionaries[lang], key);
    if (!isTranslation(value) && lang !== DEFAULT_LANGUAGE) {
      value = lookup(dictionaries[DEFAULT_LANGUAGE], key);
      if (isTranslation(value)) console.warn(`i18n: missing "${key}" in "${lang}", using English`);
    }
    if (!isTranslation(value)) return key;

    const text = isPluralForms(value)
      ? (value[new Intl.PluralRules(lang).select(Number(params.count ?? 0))] ?? value.other)
      : value;
    return interpolate(text, params, lang);
  };
}

export const translate = createTranslator(DICTIONARIES);

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

// Picks the UI language, first match wins:
// 1. the logged-in player's saved locale, 2. the choice stored on this device,
// 3. the first supported browser language (only the part before '-'), 4. English.
export function detectLanguage({
  savedLocale,
  storage,
  languages,
}: { savedLocale?: unknown; storage?: StorageLike | null; languages?: readonly string[] } = {}): Language {
  if (isSupported(savedLocale)) return savedLocale;

  let stored: string | null = null;
  try {
    stored = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    // Storage can be blocked (private mode, privacy settings); just skip it.
  }
  if (isSupported(stored)) return stored;

  for (const tag of languages ?? []) {
    const base = tag.toLowerCase().split('-')[0];
    if (isSupported(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

export function saveLanguage(code: Language, storage?: StorageLike | null): void {
  try {
    storage?.setItem(STORAGE_KEY, code);
  } catch {
    // Not fatal: the language just won't be remembered on this device.
  }
}

/** Translation key for an API error code; unknown codes map to errors.UNKNOWN. */
export function errorKey(code: string): MessageKey {
  return Object.hasOwn(en.errors, code) ? (`errors.${code}` as MessageKey) : 'errors.UNKNOWN';
}
